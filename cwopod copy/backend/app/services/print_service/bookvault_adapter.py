"""BookVault print-on-demand adapter.

Authentication: API key in header (X-API-Key).
Supports: single-title orders, pricing, order status.
API Base: https://api.bookvault.app/
"""

import logging

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

BOOKVAULT_API_BASE = "https://api.bookvault.app/v1"
REQUEST_TIMEOUT = 30.0


class BookVaultAdapter(PrintProviderAdapter):
    """BookVault print-on-demand adapter.

    Uses API key authentication via X-API-Key header.
    Only supports single-title orders; caller must submit multiple
    orders for multi-title requests.
    """

    def __init__(self, api_key: str):
        logger.info("BookVaultAdapter initialized")
        self.api_key = api_key

    @property
    def provider_name(self) -> str:
        return "bookvault"

    def _headers(self) -> dict:
        """Build request headers with API key."""
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    def _build_product_spec(self, book_spec: BookSpec) -> dict:
        """Build BookVault product specification from BookSpec."""
        # Convert inches to mm for BookVault
        width_mm = book_spec.trim_width_inches * 25.4
        height_mm = book_spec.trim_height_inches * 25.4

        # Map binding type to BookVault binding codes
        if book_spec.binding_type == "hardback":
            bv_binding = "casebound"
        elif book_spec.binding_type == "micro":
            # Micro hardback: smaller size with case binding
            bv_binding = "casebound"
            width_mm = 4.25 * 25.4  # 107.95mm
            height_mm = 6.87 * 25.4  # 174.5mm
        else:
            bv_binding = "perfect"

        return {
            "title": book_spec.title,
            "author": book_spec.author,
            "pages": book_spec.page_count,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "paper_type": book_spec.paper_type,
            "colour_interior": book_spec.color_interior,
            "binding": bv_binding,
            "cover_finish": "gloss",
            "quantity": book_spec.quantity,
        }

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Get pricing from BookVault."""
        logger.info(
            "BookVaultAdapter.get_pricing: project_id=%s, pages=%d, quantity=%d",
            book_spec.project_id, book_spec.page_count, book_spec.quantity,
        )

        payload = {
            "product": self._build_product_spec(book_spec),
            "destination": {
                "country": shipping_address.get("country", "GB"),
                "postcode": shipping_address.get("postal_code", ""),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{BOOKVAULT_API_BASE}/quotes",
                    json=payload,
                    headers=self._headers(),
                )

            logger.debug("BookVaultAdapter.get_pricing: response status=%d", response.status_code)

            if response.status_code in (401, 403):
                raise ProviderError(
                    "Invalid BookVault API key. Please check your credentials.",
                    provider="bookvault",
                    is_retryable=False,
                )

            if response.status_code >= 500:
                raise ProviderError(
                    f"BookVault server error ({response.status_code}). Please try again.",
                    provider="bookvault",
                    is_retryable=True,
                )

            if response.status_code != 200:
                raise ProviderError(
                    f"Pricing request failed: {response.status_code} - {response.text[:200]}",
                    provider="bookvault",
                    is_retryable=False,
                )

            data = response.json()
            unit_cost = float(data.get("print_cost", 0))
            shipping_cost = float(data.get("shipping_cost", 0))
            total_cost = float(data.get("total_cost", unit_cost + shipping_cost))

            estimate = PricingEstimate(
                unit_cost=unit_cost,
                shipping_cost=shipping_cost,
                total_cost=total_cost,
                currency=data.get("currency", "GBP"),
                provider="bookvault",
                details=data,
            )
            logger.info(
                "BookVaultAdapter.get_pricing: total=%.2f %s",
                estimate.total_cost, estimate.currency,
            )
            return estimate

        except httpx.TimeoutException:
            raise ProviderError(
                "Pricing request timed out. The provider may be experiencing high load.",
                provider="bookvault",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error during pricing request: {e}",
                provider="bookvault",
                is_retryable=True,
            )

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Submit a single-title order to BookVault.

        BookVault only supports one title per order. Only processes book_specs[0].
        Caller must submit multiple orders for multi-title requests.
        """
        if not book_specs:
            return OrderSubmissionResult(
                success=False,
                error_message="No books specified for order.",
                is_retryable=False,
            )

        spec = book_specs[0]
        logger.info(
            "BookVaultAdapter.submit_order: title=%s, pages=%d",
            spec.title, spec.page_count,
        )

        # BookVault needs publicly accessible URLs for PDF files.
        from app.config import settings
        from app.utils.encryption import generate_download_token
        app_url = settings.app_url.rstrip("/")
        interior_token = generate_download_token(str(spec.project_id), "interior")
        cover_token = generate_download_token(str(spec.project_id), "cover")
        interior_url = f"{app_url}/api/projects/{spec.project_id}/interior-pdf?token={interior_token}"
        cover_url = f"{app_url}/api/projects/{spec.project_id}/cover/pdf?token={cover_token}"

        payload = {
            "product": self._build_product_spec(spec),
            "files": {
                "interior_url": interior_url,
                "cover_url": cover_url,
            },
            "shipping": {
                "name": shipping_address.get("name", ""),
                "address_1": shipping_address.get("street1", ""),
                "address_2": shipping_address.get("street2", ""),
                "city": shipping_address.get("city", ""),
                "county": shipping_address.get("state", ""),
                "postcode": shipping_address.get("postal_code", ""),
                "country": shipping_address.get("country", "GB"),
            },
        }

        if spec.isbn:
            payload["product"]["isbn"] = spec.isbn

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{BOOKVAULT_API_BASE}/orders",
                    json=payload,
                    headers=self._headers(),
                )

            logger.debug("BookVaultAdapter.submit_order: response status=%d", response.status_code)

            if response.status_code in (401, 403):
                return OrderSubmissionResult(
                    success=False,
                    error_message="Authentication failed. Please update your BookVault API key.",
                    is_retryable=False,
                )

            if response.status_code >= 500:
                return OrderSubmissionResult(
                    success=False,
                    error_message=f"BookVault server error ({response.status_code}). Please try again.",
                    is_retryable=True,
                )

            if response.status_code >= 400:
                error_detail = response.text[:500]
                return OrderSubmissionResult(
                    success=False,
                    error_message=f"Order rejected by BookVault: {error_detail}",
                    is_retryable=False,
                )

            data = response.json()
            order_id = str(data.get("order_id", data.get("id", "")))
            logger.info("BookVaultAdapter.submit_order: success, order_id=%s", order_id)

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
        """Get order status from BookVault."""
        logger.info("BookVaultAdapter.get_order_status: order_id=%s", provider_order_id)

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.get(
                    f"{BOOKVAULT_API_BASE}/orders/{provider_order_id}",
                    headers=self._headers(),
                )

            if response.status_code == 404:
                raise ProviderError(
                    f"Order {provider_order_id} not found on BookVault.",
                    provider="bookvault",
                    is_retryable=False,
                )

            if response.status_code != 200:
                raise ProviderError(
                    f"Failed to get order status: {response.status_code}",
                    provider="bookvault",
                    is_retryable=response.status_code >= 500,
                )

            data = response.json()
            status_map = {
                "received": "submitted",
                "processing": "printing",
                "printing": "printing",
                "dispatched": "shipped",
                "delivered": "delivered",
                "cancelled": "failed",
                "error": "failed",
            }
            bv_status = data.get("status", "received").lower()
            mapped_status = status_map.get(bv_status, "submitted")

            result = OrderStatusResult(
                provider_order_id=provider_order_id,
                status=mapped_status,
                tracking_number=data.get("tracking_number"),
                tracking_url=data.get("tracking_url"),
                estimated_delivery=data.get("estimated_delivery"),
            )
            logger.info(
                "BookVaultAdapter.get_order_status: status=%s", result.status
            )
            return result

        except httpx.TimeoutException:
            raise ProviderError(
                "Order status request timed out.",
                provider="bookvault",
                is_retryable=True,
            )
        except httpx.HTTPError as e:
            raise ProviderError(
                f"Network error getting order status: {e}",
                provider="bookvault",
                is_retryable=True,
            )
