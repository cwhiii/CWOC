"""Print provider adapter base classes and data models."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from uuid import UUID

logger = logging.getLogger(__name__)


class ProviderError(Exception):
    """Raised when a print provider operation fails."""

    def __init__(self, message: str, provider: str, is_retryable: bool = False):
        self.message = message
        self.provider = provider
        self.is_retryable = is_retryable
        super().__init__(f"[{provider}] {message}")


@dataclass
class PricingEstimate:
    """Pricing information returned by a provider."""

    unit_cost: float
    shipping_cost: float
    total_cost: float
    currency: str  # ISO 4217 code (e.g., "USD", "GBP")
    provider: str
    details: dict | None = None


@dataclass
class OrderSubmissionResult:
    """Result of an order submission attempt."""

    success: bool
    provider_order_id: str | None = None
    error_message: str | None = None
    is_retryable: bool = False


@dataclass
class OrderStatusResult:
    """Current status of an order from the provider."""

    provider_order_id: str
    status: str  # Maps to OrderStatus enum values
    tracking_number: str | None = None
    tracking_url: str | None = None
    estimated_delivery: str | None = None


@dataclass
class BookSpec:
    """Book specification for pricing and ordering."""

    project_id: UUID
    title: str
    author: str
    interior_pdf_path: str
    cover_pdf_path: str
    page_count: int
    trim_width_inches: float = 5.5
    trim_height_inches: float = 8.5
    paper_type: str = "white"  # "cream", "white"
    color_interior: bool = False
    cover_finish: str = "glossy"  # "glossy", "matte"
    binding_type: str = "paperback"  # "paperback", "hardback", "micro"
    font_size: str = "11pt"  # "9pt" through "14pt"
    quantity: int = 1
    isbn: str | None = None


class PrintProviderAdapter(ABC):
    """Abstract base class for print-on-demand provider adapters."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier string."""
        ...

    @abstractmethod
    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Get a pricing estimate for printing and shipping.

        Args:
            book_spec: Specification of the book to be printed.
            shipping_address: Shipping destination with country, state, city, postal_code.

        Returns:
            PricingEstimate with cost breakdown.

        Raises:
            ProviderError: On timeout (30s), network failure, or provider error.
        """
        ...

    @abstractmethod
    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Submit a print order to the provider.

        Args:
            book_specs: List of books to print.
            shipping_address: Shipping destination.
            contact_email: Email for order notifications (required by some providers).

        Returns:
            OrderSubmissionResult with provider order ID on success.

        Raises:
            ProviderError: On timeout (30s), network failure, or provider error.
        """
        ...

    @abstractmethod
    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Get the current status of a previously submitted order.

        Args:
            provider_order_id: The order ID returned by the provider on submission.

        Returns:
            OrderStatusResult with current status and tracking info.

        Raises:
            ProviderError: On timeout (30s), network failure, or provider error.
        """
        ...
