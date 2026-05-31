"""Lulu xPress print-on-demand adapter.

Authentication: OAuth2 client credentials flow.
Supports: multi-title orders, pricing, order status, ISBN requests.
API Base: https://api.lulu.com/
"""

import logging
import time

import httpx

from app.services.print_service.base import (
    BookSpec,
    OrderStatusResult,
    OrderSubmissionResult,
    PricingEstimate,
    PrintProviderAdapter,
    ProviderError,
)

logger = logging.getLogger(__name__)

LULU_API_BASE = "https://api.lulu.com"
LULU_AUTH_URL = "https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token"
REQUEST_TIMEOUT = 30.0


class LuluAdapter(PrintProviderAdapter):
    """Lulu xPress print-on-demand adapter.

    Uses OAuth2 client credentials for authentication.
    Supports multi-title orders in a single print job.
    """

    def __init__(self, client_id: str, client_secret: str):
        logger.info("LuluAdapter initialized, client_id=%s", client_id[:8] + "...")
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token: str | None = None
        self._token_expires_at: float = 0

    @property
    def provider_name(self) -> str:
        return "lulu"

    async def _authenticate(self) -> str:
        """Obtain or refresh OAuth2 access token."""
        logger.debug("LuluAdapter._authenticate: checking token validity")

        # Return cached token if still valid
        if self._access_token and time.time() < self._token_expires_at - 60:
            logger.debug("LuluAdapter._authenticate: using cached token")
            return self._access_token

        logger.info("LuluAdapter._authenticate: requesting new OAuth2 token")
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    LULU_AUTH_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                )

            logger.debug(
                "LuluAdapter._authenticate: response status=%d", response.status_code
            )

            if response.status_code == 401:
                raise ProviderError(
                    "Invalid Lulu credentials. Please check your client ID and secret.",
                    provider="lulu",
                    is_retryable=False,
                )

            if response.status_code != 200:
                raise ProviderError(
                    f"Lulu authentication failed with status {response.status_code}: {response.text}",
                    provider="lulu",
                    is_retryable=response.status_code >= 500,
                )

            data = response.json()
            self._access_token = data["access_token"]
            self._token_expires_at = time.time() + data.get("expires_in", 3600)
            logger.info("LuluAdapter._authenticate: token obtained, expires_in=%d", data.get("expires_in", 3600))
            return self._access_token

        except httpx.TimeoutException:
            raise ProviderError(
                "Lulu authentication timed out after 30 seconds.",
                provider="lulu",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error during Lulu authentication: {e}",
                provider="lulu",
                is_retryable=True,
            )

    def _get_pod_package_id(self, book_spec: BookSpec) -> str:
        """Determine the Lulu POD package ID based on book specs.

        Lulu uses package IDs to identify trim size + color + binding + paper + cover combos.
        Format: {size}{color}{quality}{binding}{paper_weight}{paper_type}{cover_finish}{extras}

        Example: 0550X0850BWSTDPB060UW444GXX
          - 0550X0850 = 5.5" x 8.5" trim
          - BW = black & white interior (or FC for full color)
          - STD = standard quality
          - PB = perfect binding (paperback)
          - 060 = 60# paper weight
          - UW444 = uncoated white paper
          - G = glossy cover laminate (M = matte)
          - XX = no extras
        """
        # Trim size — for micro hardback, use a smaller fixed size (4.25x6.87)
        if book_spec.binding_type == "micro":
            w = "0425"
            h = "0687"
        else:
            w = f"{int(book_spec.trim_width_inches * 100):04d}"
            h = f"{int(book_spec.trim_height_inches * 100):04d}"
        size_code = f"{w}X{h}"

        # Interior color
        color_code = "FC" if book_spec.color_interior else "BW"

        # Quality + binding
        quality = "STD"
        if book_spec.binding_type == "hardback":
            binding = "CW"  # Case wrap (hardcover)
        elif book_spec.binding_type == "micro":
            binding = "CW"  # Micro hardback uses case wrap at smaller size
        else:
            binding = "PB"  # Perfect binding paperback

        # Paper weight + type
        paper_weight = "060"  # 60# standard
        if book_spec.paper_type == "cream":
            paper_type = "UC444"  # Uncoated cream
        else:
            paper_type = "UW444"  # Uncoated white

        # Cover finish
        cover_finish = "M" if book_spec.cover_finish == "matte" else "G"  # G=glossy, M=matte
        extras = "XX"  # No extras

        package_id = f"{size_code}{color_code}{quality}{binding}{paper_weight}{paper_type}{cover_finish}{extras}"
        logger.debug("LuluAdapter._get_pod_package_id: %s (binding_type=%s)", package_id, book_spec.binding_type)
        return package_id

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Get pricing from Lulu's Print Job Cost Calculator."""
        logger.info(
            "LuluAdapter.get_pricing: project_id=%s, pages=%d, quantity=%d",
            book_spec.project_id, book_spec.page_count, book_spec.quantity,
        )

        token = await self._authenticate()
        pod_package_id = self._get_pod_package_id(book_spec)

        payload = {
            "line_items": [
                {
                    "page_count": book_spec.page_count,
                    "pod_package_id": pod_package_id,
                    "quantity": book_spec.quantity,
                }
            ],
            "shipping_address": {
                "name": shipping_address.get("name", ""),
                "street1": shipping_address.get("street1", ""),
                "street2": shipping_address.get("street2", ""),
                "city": shipping_address.get("city", ""),
                "state_code": shipping_address.get("state", ""),
                "country_code": shipping_address.get("country", "US"),
                "postcode": shipping_address.get("postal_code", ""),
                "phone_number": shipping_address.get("phone_number", ""),
            },
            "shipping_level": "MAIL",
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{LULU_API_BASE}/print-job-cost-calculations/",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )

            logger.debug("LuluAdapter.get_pricing: response status=%d", response.status_code)

            if response.status_code == 401:
                # Token expired, retry once
                self._access_token = None
                token = await self._authenticate()
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    response = await client.post(
                        f"{LULU_API_BASE}/print-job-cost-calculations/",
                        json=payload,
                        headers={"Authorization": f"Bearer {token}"},
                    )

            if response.status_code not in (200, 201):
                raise ProviderError(
                    f"Pricing request failed: {response.status_code} - {response.text}",
                    provider="lulu",
                    is_retryable=response.status_code >= 500,
                )

            data = response.json()
            total_cost = float(data.get("total_cost_incl_tax", 0))
            shipping_cost = float(data.get("shipping_cost", {}).get("total_cost_incl_tax", 0))
            unit_cost = total_cost - shipping_cost

            estimate = PricingEstimate(
                unit_cost=unit_cost,
                shipping_cost=shipping_cost,
                total_cost=total_cost,
                currency=data.get("currency", "USD"),
                provider="lulu",
                details=data,
            )
            logger.info(
                "LuluAdapter.get_pricing: total=%.2f %s (unit=%.2f, shipping=%.2f)",
                estimate.total_cost, estimate.currency, estimate.unit_cost, estimate.shipping_cost,
            )
            return estimate

        except httpx.TimeoutException:
            raise ProviderError(
                "Pricing request timed out. The provider may be experiencing high load.",
                provider="lulu",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error during pricing request: {e}",
                provider="lulu",
                is_retryable=True,
            )

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Submit a print job to Lulu. Supports multi-title orders."""
        logger.info(
            "LuluAdapter.submit_order: %d books, shipping_country=%s, contact_email=%s",
            len(book_specs), shipping_address.get("country", "?"), contact_email or "(none)",
        )

        token = await self._authenticate()

        # Lulu needs publicly accessible URLs for PDF files.
        # Construct URLs using the app's public URL with signed download tokens.
        from app.config import settings
        from app.utils.encryption import generate_download_token
        app_url = settings.app_url.rstrip("/")

        logger.info(
            "LuluAdapter.submit_order: constructing source URLs with app_url=%s", app_url
        )

        line_items = []
        for spec in book_specs:
            pod_package_id = self._get_pod_package_id(spec)
            interior_token = generate_download_token(str(spec.project_id), "interior")
            cover_token = generate_download_token(str(spec.project_id), "cover")
            interior_url = f"{app_url}/api/projects/{spec.project_id}/interior-pdf?token={interior_token}"
            cover_url = f"{app_url}/api/projects/{spec.project_id}/cover/pdf?token={cover_token}"
            logger.debug(
                "LuluAdapter.submit_order: interior_url=%s, cover_url=%s",
                interior_url, cover_url,
            )
            item = {
                "pod_package_id": pod_package_id,
                "quantity": spec.quantity,
                "interior": {"source_url": interior_url},
                "cover": {"source_url": cover_url},
            }
            if spec.title:
                item["title"] = spec.title
            if spec.isbn:
                item["isbn"] = spec.isbn
            line_items.append(item)

        payload = {
            "contact_email": contact_email,
            "line_items": line_items,
            "shipping_address": {
                "name": shipping_address.get("name", ""),
                "street1": shipping_address.get("street1", ""),
                "street2": shipping_address.get("street2", ""),
                "city": shipping_address.get("city", ""),
                "state_code": shipping_address.get("state", ""),
                "country_code": shipping_address.get("country", "US"),
                "postcode": shipping_address.get("postal_code", ""),
                "phone_number": shipping_address.get("phone_number", ""),
            },
            "shipping_level": "MAIL",
        }

        logger.info(
            "LuluAdapter.submit_order: posting to %s/print-jobs/ with %d line items",
            LULU_API_BASE, len(line_items),
        )
        logger.debug("LuluAdapter.submit_order: payload=%s", payload)

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{LULU_API_BASE}/print-jobs/",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )

            logger.info(
                "LuluAdapter.submit_order: response status=%d, body=%s",
                response.status_code, response.text[:1000],
            )

            if response.status_code in (401, 403):
                return OrderSubmissionResult(
                    success=False,
                    error_message="Authentication failed. Please update your Lulu credentials.",
                    is_retryable=False,
                )

            if response.status_code >= 500:
                return OrderSubmissionResult(
                    success=False,
                    error_message=f"Lulu server error ({response.status_code}). Please try again.",
                    is_retryable=True,
                )

            if response.status_code >= 400:
                error_detail = response.text[:500]
                return OrderSubmissionResult(
                    success=False,
                    error_message=f"Order rejected by Lulu: {error_detail}",
                    is_retryable=False,
                )

            data = response.json()
            order_id = str(data.get("id", ""))
            logger.info("LuluAdapter.submit_order: success, provider_order_id=%s", order_id)

            return OrderSubmissionResult(
                success=True,
                provider_order_id=order_id,
            )

        except httpx.TimeoutException:
            return OrderSubmissionResult(
                success=False,
                error_message="Order submission timed out after 30 seconds.",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            return OrderSubmissionResult(
                success=False,
                error_message=f"Network error: {e}",
                is_retryable=True,
            )

    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Get print job status from Lulu."""
        logger.info("LuluAdapter.get_order_status: order_id=%s", provider_order_id)

        token = await self._authenticate()

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.get(
                    f"{LULU_API_BASE}/print-jobs/{provider_order_id}/",
                    headers={"Authorization": f"Bearer {token}"},
                )

            if response.status_code == 404:
                raise ProviderError(
                    f"Order {provider_order_id} not found on Lulu.",
                    provider="lulu",
                    is_retryable=False,
                )

            if response.status_code != 200:
                raise ProviderError(
                    f"Failed to get order status: {response.status_code}",
                    provider="lulu",
                    is_retryable=response.status_code >= 500,
                )

            data = response.json()
            status_map = {
                "CREATED": "pending",
                "UNPAID": "pending",
                "PAYMENT_IN_PROGRESS": "pending",
                "PRODUCTION_READY": "submitted",
                "PRODUCTION_DELAYED": "submitted",
                "IN_PRODUCTION": "printing",
                "SHIPPED": "shipped",
                "DELIVERED": "delivered",
                "CANCELED": "failed",
                "ERROR": "failed",
            }
            lulu_status = data.get("status", {}).get("name", "CREATED")
            mapped_status = status_map.get(lulu_status, "pending")

            # Extract tracking info
            tracking_number = None
            tracking_url = None
            shipments = data.get("line_items", [{}])[0].get("tracking", [])
            if shipments:
                tracking_number = shipments[0].get("tracking_id")
                tracking_url = shipments[0].get("tracking_url")

            result = OrderStatusResult(
                provider_order_id=provider_order_id,
                status=mapped_status,
                tracking_number=tracking_number,
                tracking_url=tracking_url,
            )
            logger.info(
                "LuluAdapter.get_order_status: status=%s, tracking=%s",
                result.status, result.tracking_number,
            )
            return result

        except httpx.TimeoutException:
            raise ProviderError(
                "Order status request timed out.",
                provider="lulu",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error getting order status: {e}",
                provider="lulu",
                is_retryable=True,
            )

    async def request_free_isbn(self, book_spec: BookSpec) -> str:
        """Request a free ISBN through Lulu's ISBN program."""
        logger.info(
            "LuluAdapter.request_free_isbn: title=%s, author=%s",
            book_spec.title, book_spec.author,
        )

        token = await self._authenticate()

        payload = {
            "title": book_spec.title,
            "contributors": [{"name": book_spec.author, "role": "AUTHOR"}],
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{LULU_API_BASE}/isbns/",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )

            if response.status_code not in (200, 201):
                raise ProviderError(
                    f"ISBN request failed: {response.status_code} - {response.text[:200]}",
                    provider="lulu",
                    is_retryable=response.status_code >= 500,
                )

            data = response.json()
            isbn = data.get("isbn", "")
            logger.info("LuluAdapter.request_free_isbn: assigned ISBN=%s", isbn)
            return isbn

        except httpx.TimeoutException:
            raise ProviderError(
                "ISBN request timed out after 30 seconds.",
                provider="lulu",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error during ISBN request: {e}",
                provider="lulu",
                is_retryable=True,
            )
