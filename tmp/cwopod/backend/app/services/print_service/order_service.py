"""Order service: orchestrates the print ordering workflow with retry logic."""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import OrderItem, OrderStatus, PrintOrder
from app.models.project import BookProject
from app.services.print_service.base import (
    BookSpec,
    OrderSubmissionResult,
    PricingEstimate,
    PrintProviderAdapter,
    ProviderError,
)
from app.services.print_service.bookvault_adapter import BookVaultAdapter
from app.services.print_service.credential_service import CredentialService
from app.services.print_service.isbn import ISBNManager
from app.services.print_service.kdp_adapter import KDPAdapter
from app.services.print_service.lulu_adapter import LuluAdapter
from app.services.print_service.address_utils import normalize_state_code

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
BACKOFF_BASE = 1.0  # seconds; delays: 1s, 2s, 4s


class OrderService:
    """Orchestrates the print ordering workflow.

    Responsibilities:
    - Validates print readiness
    - Resolves provider adapter from user credentials
    - Manages retry logic (3 attempts, exponential backoff)
    - Persists orders to database
    - Coordinates with ISBNManager
    """

    def __init__(self, db: AsyncSession, user_id: UUID):
        logger.debug("OrderService initialized: user_id=%s", user_id)
        self.db = db
        self.user_id = user_id
        self.credential_service = CredentialService(db, user_id)
        self.isbn_manager = ISBNManager()

    async def get_pricing(
        self, project_id: UUID, provider: str, shipping_address: dict
    ) -> PricingEstimate:
        """Get pricing for a book project from the specified provider."""
        logger.info(
            "OrderService.get_pricing: project_id=%s, provider=%s",
            project_id, provider,
        )

        # Load project
        project = await self._load_project(project_id)
        book_spec = self._build_book_spec(project)

        # Resolve adapter
        adapter = await self._resolve_adapter(provider)

        # Get pricing
        estimate = await adapter.get_pricing(book_spec, shipping_address)
        logger.info(
            "OrderService.get_pricing: total=%.2f %s",
            estimate.total_cost, estimate.currency,
        )
        return estimate

    async def submit_order(
        self,
        project_ids: list[UUID],
        provider: str,
        shipping_address: str,
        isbn_option: str | None = None,
        user_isbn: str | None = None,
        quantity: int = 1,
        contact_email: str = "",
    ) -> PrintOrder:
        """Submit a print order with retry logic.

        Retry strategy:
        - Up to 3 attempts for transient failures (timeout, 5xx)
        - Exponential backoff: 1s, 2s, 4s between attempts
        - Non-retryable errors (4xx auth, validation) fail immediately
        """
        logger.info(
            "OrderService.submit_order: projects=%d, provider=%s, isbn_option=%s, contact_email=%s",
            len(project_ids), provider, isbn_option, contact_email or "(none)",
        )

        # Validate all projects are print-ready
        book_specs = []
        for pid in project_ids:
            project = await self._load_project(pid)
            if not project.interior_pdf_path or not project.cover_pdf_path:
                raise ValueError(
                    f"Project '{project.title}' is not print-ready (missing PDFs)"
                )
            spec = self._build_book_spec(project, quantity=quantity)

            # Validate page count against provider + binding limits
            from app.services.typeset.provider_specs import validate_page_count
            binding = project.binding_type or "paperback"
            page_count = project.page_count or spec.page_count
            validation_error = validate_page_count(page_count, provider, binding)
            if validation_error:
                logger.warning(
                    "OrderService.submit_order: page count validation failed for '%s': %s",
                    project.title, validation_error["message"],
                )
                raise ValueError(validation_error["message"])

            book_specs.append(spec)

        # Handle ISBN
        if isbn_option == "user_provided" and user_isbn:
            is_valid, error = self.isbn_manager.validate_isbn13(user_isbn)
            if not is_valid:
                raise ValueError(f"Invalid ISBN: {error}")
            book_specs[0] = BookSpec(
                **{**book_specs[0].__dict__, "isbn": user_isbn}
            )
        elif isbn_option == "lulu_free" and provider == "lulu":
            adapter = await self._resolve_adapter(provider)
            if isinstance(adapter, LuluAdapter):
                try:
                    isbn = await adapter.request_free_isbn(book_specs[0])
                    book_specs[0] = BookSpec(
                        **{**book_specs[0].__dict__, "isbn": isbn}
                    )
                    logger.info("OrderService.submit_order: Lulu ISBN assigned: %s", isbn)
                except ProviderError as e:
                    logger.warning("OrderService.submit_order: ISBN request failed: %s", e.message)
                    # Continue without ISBN rather than failing the order

        # Create order record
        shipping_dict = self._parse_shipping_address(shipping_address)
        order = PrintOrder(
            user_id=self.user_id,
            provider=provider,
            status=OrderStatus.PENDING,
            shipping_address=shipping_address,
            shipping_address_json=shipping_dict,
            ordered_at=datetime.now(timezone.utc),
        )
        self.db.add(order)
        await self.db.flush()

        for i, pid in enumerate(project_ids):
            project = await self._load_project(pid)
            item = OrderItem(
                order_id=order.id,
                project_id=pid,
                title=project.title or "Untitled",
                author=project.author or "Unknown",
                quantity=quantity,
            )
            self.db.add(item)
        await self.db.flush()

        # Resolve adapter and submit with retry
        adapter = await self._resolve_adapter(provider)

        # shipping_dict already parsed above for the order record

        # Get pricing before submission to record costs
        try:
            if provider != "kdp" and len(book_specs) == 1:
                estimate = await adapter.get_pricing(book_specs[0], shipping_dict)
                order.total_price = estimate.total_cost
                order.shipping_cost = estimate.shipping_cost
                order.currency = estimate.currency
                # Set unit_price on the single item
                items_result = await self.db.execute(
                    select(OrderItem).where(OrderItem.order_id == order.id)
                )
                items = items_result.scalars().all()
                if items:
                    items[0].unit_price = estimate.unit_cost
                await self.db.flush()
                logger.info(
                    "OrderService.submit_order: pricing recorded total=%.2f %s",
                    estimate.total_cost, estimate.currency,
                )
        except (ProviderError, Exception) as e:
            logger.warning(
                "OrderService.submit_order: could not fetch pricing for record: %s", str(e)
            )

        # For BookVault: submit individual orders per title
        if provider == "bookvault" and len(book_specs) > 1:
            result = await self._submit_bookvault_multi(adapter, book_specs, shipping_dict, order, contact_email)
        else:
            result = await self._submit_with_retry(adapter, book_specs, shipping_dict, contact_email)

        # Update order based on result
        if result.success:
            order.status = OrderStatus.SUBMITTED
            order.provider_order_id = result.provider_order_id
            logger.info(
                "OrderService.submit_order: success, order_id=%s, provider_order_id=%s",
                order.id, order.provider_order_id,
            )
        else:
            order.status = OrderStatus.FAILED
            logger.error(
                "OrderService.submit_order: failed, order_id=%s, error=%s",
                order.id, result.error_message,
            )

        await self.db.flush()
        return order

    async def _submit_with_retry(
        self,
        adapter: PrintProviderAdapter,
        book_specs: list[BookSpec],
        shipping_address: dict,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Submit order with exponential backoff retry logic."""
        last_result: OrderSubmissionResult | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            logger.info(
                "OrderService._submit_with_retry: attempt %d/%d, provider=%s",
                attempt, MAX_RETRIES, adapter.provider_name,
            )

            result = await adapter.submit_order(book_specs, shipping_address, contact_email=contact_email)

            if result.success:
                return result

            last_result = result

            # Don't retry non-retryable errors
            if not result.is_retryable:
                logger.warning(
                    "OrderService._submit_with_retry: non-retryable error, stopping. error=%s",
                    result.error_message,
                )
                return result

            # Wait before retry (exponential backoff)
            if attempt < MAX_RETRIES:
                delay = BACKOFF_BASE * (2 ** (attempt - 1))
                logger.info(
                    "OrderService._submit_with_retry: retrying in %.1f seconds", delay
                )
                await asyncio.sleep(delay)

        logger.error(
            "OrderService._submit_with_retry: all %d attempts failed", MAX_RETRIES
        )
        return last_result or OrderSubmissionResult(
            success=False,
            error_message="All retry attempts exhausted.",
            is_retryable=False,
        )

    async def _submit_bookvault_multi(
        self,
        adapter: PrintProviderAdapter,
        book_specs: list[BookSpec],
        shipping_address: dict,
        order: PrintOrder,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Submit multiple individual orders to BookVault (doesn't support multi-title).

        Returns success if at least one order succeeds.
        """
        logger.info(
            "OrderService._submit_bookvault_multi: submitting %d individual orders",
            len(book_specs),
        )

        successes = []
        failures = []

        for spec in book_specs:
            result = await self._submit_with_retry(adapter, [spec], shipping_address, contact_email)
            if result.success:
                successes.append(result)
            else:
                failures.append((spec.title, result.error_message))

        if successes:
            # Use first successful order ID as the primary reference
            provider_ids = [r.provider_order_id for r in successes if r.provider_order_id]
            combined_id = ",".join(provider_ids)

            if failures:
                failed_titles = [f[0] for f in failures]
                logger.warning(
                    "OrderService._submit_bookvault_multi: partial success. "
                    "Failed titles: %s", failed_titles,
                )
                return OrderSubmissionResult(
                    success=True,
                    provider_order_id=combined_id,
                    error_message=f"Partial success: {len(failures)} title(s) failed: {', '.join(failed_titles)}",
                )

            return OrderSubmissionResult(
                success=True,
                provider_order_id=combined_id,
            )
        else:
            return OrderSubmissionResult(
                success=False,
                error_message=f"All {len(book_specs)} orders failed. First error: {failures[0][1] if failures else 'Unknown'}",
                is_retryable=False,
            )

    async def _resolve_adapter(self, provider: str) -> PrintProviderAdapter:
        """Instantiate the appropriate adapter with decrypted credentials."""
        logger.debug("OrderService._resolve_adapter: provider=%s", provider)

        if provider == "kdp":
            return KDPAdapter()

        credentials = await self.credential_service.get_credentials(provider)

        if provider == "lulu":
            if not credentials:
                raise ProviderError(
                    "No credentials configured for Lulu. Please add your API credentials in settings.",
                    provider="lulu",
                    is_retryable=False,
                )
            return LuluAdapter(
                client_id=credentials.get("client_id", ""),
                client_secret=credentials.get("client_secret", ""),
            )

        elif provider == "bookvault":
            if not credentials:
                raise ProviderError(
                    "No credentials configured for BookVault. Please add your API key in settings.",
                    provider="bookvault",
                    is_retryable=False,
                )
            return BookVaultAdapter(api_key=credentials.get("api_key", ""))

        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _load_project(self, project_id: UUID) -> BookProject:
        """Load a project, verifying user ownership."""
        result = await self.db.execute(
            select(BookProject).where(
                BookProject.id == project_id,
                BookProject.user_id == self.user_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError(f"Project {project_id} not found")
        return project

    def _build_book_spec(self, project: BookProject, quantity: int = 1) -> BookSpec:
        """Build a BookSpec from a project model."""
        # Parse trim size into width/height
        trim_width = 5.5
        trim_height = 8.5
        if project.trim_size:
            try:
                parts = project.trim_size.split("x")
                trim_width = float(parts[0])
                trim_height = float(parts[1])
            except (ValueError, IndexError):
                logger.warning("_build_book_spec: invalid trim_size '%s', using default", project.trim_size)

        return BookSpec(
            project_id=project.id,
            title=project.title or "Untitled",
            author=project.author or "Unknown",
            interior_pdf_path=project.interior_pdf_path or "",
            cover_pdf_path=project.cover_pdf_path or "",
            page_count=project.page_count or 200,
            trim_width_inches=trim_width,
            trim_height_inches=trim_height,
            paper_type=project.paper_type or "white",
            color_interior=project.color_interior if project.color_interior is not None else False,
            cover_finish=project.cover_finish or "glossy",
            binding_type=project.binding_type or "paperback",
            font_size=project.font_size or "11pt",
            isbn=project.isbn,
            quantity=quantity,
        )

    def _parse_shipping_address(self, address_text: str) -> dict:
        """Parse a free-text shipping address into structured fields.

        Best-effort parsing. For production, this would use an address
        parsing library or require structured input.
        """
        lines = [l.strip() for l in address_text.strip().split("\n") if l.strip()]

        result = {
            "name": lines[0] if len(lines) > 0 else "",
            "street1": lines[1] if len(lines) > 1 else "",
            "street2": "",
            "city": "",
            "state": "",
            "postal_code": "",
            "country": "US",
        }

        if len(lines) > 2:
            # Try to parse city, state, zip from last line(s)
            last_line = lines[-1]
            # Check if last line is a country
            if len(last_line) == 2 or last_line.lower() in ("us", "usa", "uk", "gb", "ca", "au"):
                result["country"] = last_line.upper()[:2]
                if len(lines) > 3:
                    city_state_zip = lines[-2]
                else:
                    city_state_zip = ""
            else:
                city_state_zip = last_line

            if city_state_zip:
                # Try "City, State ZIP" format
                parts = city_state_zip.split(",")
                if len(parts) >= 2:
                    result["city"] = parts[0].strip()
                    state_zip = parts[1].strip().split()
                    if len(state_zip) >= 2:
                        result["state"] = state_zip[0]
                        result["postal_code"] = " ".join(state_zip[1:])
                    elif len(state_zip) == 1:
                        result["state"] = state_zip[0]
                else:
                    result["city"] = city_state_zip

            # If there are extra lines between street and city, use as street2
            if len(lines) > 3 and result["country"] != lines[-1].upper()[:2]:
                result["street2"] = lines[2] if len(lines) > 3 else ""

        # Normalize state to 2-letter code for provider APIs
        result["state"] = normalize_state_code(result["state"])
        return result
