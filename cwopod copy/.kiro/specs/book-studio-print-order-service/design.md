# Technical Design Document

## Overview

The Print & Order Service module provides the integration layer between C.W.'s O-POD's completed book assets (interior PDF + cover PDF) and external print-on-demand providers. It implements a strategy pattern with provider-specific adapters, handles pricing estimation, order submission with retry logic, ISBN management, and secure credential storage. The module exposes REST API endpoints for pricing, order creation, order listing, and order detail retrieval.

The module integrates with the existing backend infrastructure: FastAPI for API endpoints, SQLAlchemy for persistence, the shared encryption utility (`app/utils/encryption.py`) for credential storage, and the existing `PrintOrder`/`OrderItem` models (`app/models/order.py`) and `ProviderCredential` model (`app/models/credentials.py`).

## Architecture

The Print & Order Service follows a strategy pattern where the appropriate provider adapter is selected based on user configuration. All adapters implement a common `PrintProviderAdapter` interface, making them interchangeable from the ordering logic's perspective.

```
┌─────────────────────────────────────────────────────────────┐
│              API Layer (FastAPI Routers)                      │
│  GET /api/print/pricing                                      │
│  POST /api/print/orders                                      │
│  GET /api/print/orders                                       │
│  GET /api/print/orders/{id}                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   OrderService                                │
│  - Validates print readiness (interior + cover PDFs)         │
│  - Resolves provider adapter from user config                │
│  - Manages retry logic (3 attempts, exponential backoff)     │
│  - Persists orders to database                               │
│  - Coordinates with ISBNManager                              │
└────┬──────────────────────┬──────────────────────────────────┘
     │                      │
     ▼                      ▼
┌─────────────────┐  ┌─────────────────────────────────────────┐
│  ISBNManager    │  │         PrintProviderAdapter (ABC)       │
│  - Toggle       │  │  - get_pricing()                         │
│  - Validation   │  │  - submit_order()                        │
│  - Lulu API     │  │  - get_order_status()                    │
└─────────────────┘  └────┬──────────────┬──────────────┬──────┘
                          │              │              │
                          ▼              ▼              ▼
                   ┌───────────┐  ┌───────────┐  ┌───────────┐
                   │LuluAdapter│  │BookVault  │  │KDPAdapter │
                   │- OAuth2   │  │Adapter    │  │- File gen  │
                   │- Multi-   │  │- API key  │  │- No API    │
                   │  title    │  │- Single-  │  │  submit    │
                   │- ISBN API │  │  title    │  │- Manual    │
                   └───────────┘  └───────────┘  │  instruct. │
                                                 └───────────┘
```

## Components and Interfaces

### PrintProviderAdapter (Abstract Base Class)

The common interface that all provider adapters implement.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID


@dataclass
class PricingEstimate:
    """Pricing information returned by a provider."""
    unit_cost: float
    shipping_cost: float
    total_cost: float
    currency: str  # ISO 4217 code (e.g., "USD", "GBP")
    provider: str
    details: dict | None = None  # Provider-specific breakdown


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
    status: str  # Maps to OrderStatus enum
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
    trim_width_inches: float
    trim_height_inches: float
    paper_type: str  # "cream", "white"
    color_interior: bool
    quantity: int
    isbn: str | None = None


class PrintProviderAdapter(ABC):
    """Abstract base class for print-on-demand provider adapters."""

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
        self, book_specs: list[BookSpec], shipping_address: dict
    ) -> OrderSubmissionResult:
        """Submit a print order to the provider.

        Args:
            book_specs: List of books to print (single item for BookVault).
            shipping_address: Shipping destination.

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
```

### LuluAdapter

Integration with Lulu xPress API using OAuth2 authentication.

```python
class LuluAdapter(PrintProviderAdapter):
    """Lulu xPress print-on-demand adapter.

    Authentication: OAuth2 client credentials flow.
    Supports: multi-title orders, pricing, order status, ISBN requests.
    API Base: https://api.lulu.com/
    """

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token: str | None = None
        self._token_expires_at: float = 0

    async def _authenticate(self) -> str:
        """Obtain or refresh OAuth2 access token.

        POST https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token
        Body: grant_type=client_credentials, client_id, client_secret
        Returns: access_token (cached until expiry)
        """
        ...

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Get pricing from Lulu's Print Job Cost Calculator.

        POST https://api.lulu.com/print-job-cost-calculations/
        Body: line_items with page_count, pod_package_id, quantity
              shipping_address with country, state
        Timeout: 30 seconds
        """
        ...

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict
    ) -> OrderSubmissionResult:
        """Submit a print job to Lulu.

        POST https://api.lulu.com/print-jobs/
        Body: line_items (one per book), shipping_address, contact_email
        Supports multiple line_items for multi-title orders.
        Timeout: 30 seconds
        """
        ...

    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Get print job status from Lulu.

        GET https://api.lulu.com/print-jobs/{id}/
        Returns: status object with fulfillment status and tracking.
        Timeout: 30 seconds
        """
        ...

    async def request_free_isbn(self, book_spec: BookSpec) -> str:
        """Request a free ISBN through Lulu's ISBN program.

        POST https://api.lulu.com/isbns/
        Body: title, contributors, etc.
        Timeout: 30 seconds
        Returns: Assigned ISBN-13 string.
        Raises: ProviderError on failure or timeout.
        """
        ...
```

### BookVaultAdapter

Integration with BookVault API using API key authentication.

```python
class BookVaultAdapter(PrintProviderAdapter):
    """BookVault print-on-demand adapter.

    Authentication: API key in header (X-API-Key).
    Supports: single-title orders, pricing, order status.
    API Base: https://api.bookvault.app/
    """

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Get pricing from BookVault.

        POST https://api.bookvault.app/v1/quotes
        Headers: X-API-Key: {api_key}
        Body: product specification (pages, size, paper, quantity), destination
        Timeout: 30 seconds
        """
        ...

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict
    ) -> OrderSubmissionResult:
        """Submit a single-title order to BookVault.

        POST https://api.bookvault.app/v1/orders
        Headers: X-API-Key: {api_key}
        Body: single product specification, files, shipping
        Note: Only processes book_specs[0]; caller must submit multiple
              orders for multi-title requests.
        Timeout: 30 seconds
        """
        ...

    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Get order status from BookVault.

        GET https://api.bookvault.app/v1/orders/{id}
        Headers: X-API-Key: {api_key}
        Timeout: 30 seconds
        """
        ...
```

### KDPAdapter

File generation and instruction provider for KDP Print (no API submission).

```python
class KDPAdapter(PrintProviderAdapter):
    """KDP Print adapter (file generation only, no API submission).

    KDP Print does not offer a public submission API.
    This adapter generates properly formatted files and provides
    step-by-step manual upload instructions.
    """

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Return estimated KDP pricing based on page count and trim size.

        Uses KDP's published pricing formula:
        - Fixed cost + (per-page cost × page_count)
        - Varies by trim size, color/BW, and marketplace
        No API call; calculated locally from KDP's published rates.
        """
        ...

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict
    ) -> OrderSubmissionResult:
        """Generate KDP-ready files and return upload instructions.

        Does NOT submit via API. Instead:
        1. Packages interior PDF with KDP-specific naming conventions
        2. Packages cover PDF with KDP-specific naming conventions
        3. Generates a ZIP archive of the files
        4. Returns instructions for manual upload

        Returns: OrderSubmissionResult with success=True and instructions
                 in error_message field (repurposed as instructions_text).
        """
        ...

    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Not supported for KDP (manual process).

        Returns a status indicating manual tracking is required.
        """
        ...
```

### ISBNManager

Handles ISBN toggle state, validation, and Lulu free ISBN requests.

```python
class ISBNManager:
    """Manages ISBN assignment for book projects.

    Supports three modes:
    - No ISBN (toggle off): proceed without ISBN
    - Lulu free ISBN: request via Lulu API
    - User-provided ISBN: validate ISBN-13 format
    """

    def validate_isbn13(self, isbn: str) -> tuple[bool, str | None]:
        """Validate an ISBN-13 string.

        Checks:
        1. Exactly 13 digits (after removing hyphens/spaces)
        2. Valid check digit using ISBN-13 algorithm:
           - Alternating weights of 1 and 3 for first 12 digits
           - Check digit = (10 - (sum % 10)) % 10
           - Must match the 13th digit

        Args:
            isbn: The ISBN string to validate.

        Returns:
            Tuple of (is_valid, error_message).
            error_message is None when valid.
        """
        ...

    async def request_lulu_isbn(
        self, lulu_adapter: LuluAdapter, book_spec: BookSpec
    ) -> tuple[str | None, str | None]:
        """Request a free ISBN through Lulu's program.

        Args:
            lulu_adapter: Authenticated LuluAdapter instance.
            book_spec: Book details for ISBN registration.

        Returns:
            Tuple of (isbn, error_message).
            isbn is None on failure; error_message is None on success.

        Timeout: 30 seconds (enforced by LuluAdapter).
        """
        ...
```

### OrderService

The central orchestrator for the print ordering workflow.

```python
class OrderService:
    """Orchestrates the print ordering workflow.

    Responsibilities:
    - Validates print readiness
    - Resolves provider adapter from user config/credentials
    - Manages retry logic (3 attempts, exponential backoff)
    - Persists orders to database
    - Coordinates with ISBNManager
    """

    def __init__(self, db_session, user_id: UUID):
        self.db_session = db_session
        self.user_id = user_id

    async def get_pricing(
        self, project_id: UUID, provider: str, shipping_address: dict
    ) -> PricingEstimate:
        """Get pricing for a book project from the specified provider."""
        ...

    async def submit_order(
        self, project_ids: list[UUID], provider: str, shipping_address: dict,
        isbn_option: str | None = None, user_isbn: str | None = None
    ) -> PrintOrder:
        """Submit a print order with retry logic.

        Retry strategy:
        - Up to 3 attempts for transient failures (timeout, 5xx)
        - Exponential backoff: 1s, 2s, 4s between attempts
        - Non-retryable errors (4xx auth, validation) fail immediately
        """
        ...

    async def get_order(self, order_id: UUID) -> PrintOrder:
        """Get a specific order by ID (user-scoped)."""
        ...

    async def list_orders(self, page: int = 1, per_page: int = 20) -> list[PrintOrder]:
        """List all orders for the current user with pagination."""
        ...

    def _resolve_adapter(self, provider: str, credentials: dict) -> PrintProviderAdapter:
        """Instantiate the appropriate adapter with decrypted credentials."""
        ...
```

### Credential Storage

Provider credentials are stored using the existing `ProviderCredential` model and `app/utils/encryption.py`.

```python
# Credential format stored as encrypted JSON per provider:
# Lulu: {"client_id": "...", "client_secret": "..."}
# BookVault: {"api_key": "..."}
# KDP: {} (no credentials needed)

class CredentialService:
    """Manages encrypted provider credentials."""

    def __init__(self, db_session, user_id: UUID, user_salt: str):
        self.db_session = db_session
        self.user_id = user_id
        self.user_salt = user_salt

    async def store_credentials(self, provider: str, credentials: dict) -> None:
        """Encrypt and store credentials for a provider.

        Uses encrypt_value() from app/utils/encryption.py.
        Serializes credentials dict to JSON before encryption.
        Upserts: updates existing record or creates new one.
        """
        ...

    async def get_credentials(self, provider: str) -> dict | None:
        """Retrieve and decrypt credentials for a provider.

        Returns None if no credentials stored for this provider.
        Decrypts using decrypt_value() from app/utils/encryption.py.
        """
        ...

    async def delete_credentials(self, provider: str) -> None:
        """Delete stored credentials for a provider."""
        ...

    async def list_configured_providers(self) -> list[str]:
        """Return list of provider names that have stored credentials."""
        ...
```

## Data Models

### PrintOrder (Existing - app/models/order.py)

The existing `PrintOrder` model is used as-is:

```python
class OrderStatus(str, PyEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    PRINTING = "printing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    FAILED = "failed"


class PrintOrder(Base, TimestampMixin, UserScopedMixin):
    __tablename__ = "print_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_order_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    total_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
```

### OrderItem (Existing - app/models/order.py)

The existing `OrderItem` model is used as-is:

```python
class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
```

### ProviderCredential (Existing - app/models/credentials.py)

The existing `ProviderCredential` model is used as-is:

```python
class ProviderCredential(Base, TimestampMixin, UserScopedMixin):
    __tablename__ = "provider_credentials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    credentials_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
```

### Pydantic Schemas

```python
from pydantic import BaseModel, field_validator
from uuid import UUID


class ShippingAddress(BaseModel):
    name: str
    street1: str
    street2: str | None = None
    city: str
    state: str | None = None
    postal_code: str
    country: str  # ISO 3166-1 alpha-2


class PricingRequest(BaseModel):
    project_id: UUID
    provider: str
    shipping_address: ShippingAddress

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v


class PricingResponse(BaseModel):
    unit_cost: float
    shipping_cost: float
    total_cost: float
    currency: str
    provider: str


class OrderCreateRequest(BaseModel):
    project_ids: list[UUID]
    provider: str
    shipping_address: ShippingAddress
    isbn_option: str | None = None  # "lulu_free", "user_provided", or None
    user_isbn: str | None = None
    quantity: int = 1

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v

    @field_validator("isbn_option")
    @classmethod
    def validate_isbn_option(cls, v):
        if v is not None and v not in ("lulu_free", "user_provided"):
            raise ValueError("isbn_option must be one of: lulu_free, user_provided")
        return v


class OrderItemResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str


class OrderResponse(BaseModel):
    id: UUID
    provider: str
    provider_order_id: str | None
    status: str
    total_price: float | None
    items: list[OrderItemResponse]
    created_at: str


class OrderListResponse(BaseModel):
    orders: list[OrderResponse]
    total: int
    page: int
    per_page: int


class CredentialStoreRequest(BaseModel):
    provider: str
    credentials: dict  # Provider-specific credential fields

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        if v not in ("lulu", "bookvault", "kdp"):
            raise ValueError("provider must be one of: lulu, bookvault, kdp")
        return v


class CredentialStatusResponse(BaseModel):
    provider: str
    configured: bool
```

## Correctness Properties

### Property 1: Print Readiness Gate

A book project must not enter the print submission workflow unless both a valid interior PDF and a valid cover PDF exist for that project. Any attempt to get pricing or submit an order for a project missing either file must be rejected with a clear error.

**Validates: Requirements 3.1, 3.2**

### Property 2: Pricing Before Commitment

No order may be submitted without first presenting a pricing estimate to the user. The pricing endpoint must be called and return successfully before the order submission endpoint accepts a request for the same project and provider combination.

**Validates: Requirements 4.1, 4.2**

### Property 3: Retry Bound Enforcement

Order submission retry logic must never exceed 3 total attempts. After 3 failed attempts, the system must stop retrying and report the failure. Retries must only occur for transient errors (timeouts, 5xx responses); non-retryable errors (4xx) must fail immediately without consuming retry attempts.

**Validates: Requirements 5.5, 5.6**

### Property 4: ISBN-13 Validation Correctness

The ISBN-13 validation algorithm must correctly compute the check digit using alternating weights of 1 and 3 for the first 12 digits, with check digit = (10 - (weighted_sum % 10)) % 10. Any ISBN that fails this check or is not exactly 13 digits must be rejected. Any valid ISBN-13 must be accepted.

**Validates: Requirements 7.4, 7.5**

### Property 5: Provider Adapter Isolation

Each provider adapter must operate independently. A failure in one adapter (e.g., Lulu timeout) must not affect the availability or behavior of other adapters. The KDP adapter must never attempt network API calls for order submission.

**Validates: Requirements 1.4, 5.1, 5.2, 6.3**

### Property 6: Credential Security

Provider credentials must be encrypted at rest using Fernet encryption. Decrypted credentials must only exist in memory during the scope of a single API request. No API endpoint may return decrypted credentials. One user's credentials must never be accessible to another user.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 7: Timeout Enforcement

All external API calls (pricing, submission, ISBN requests) must complete or abort within 30 seconds. No request may exceed this timeout regardless of provider or operation type.

**Validates: Requirements 4.3, 7.6, 9.4**

### Property 8: Order Persistence Atomicity

When an order is submitted successfully, the PrintOrder record and all associated OrderItem records must be persisted atomically. If database persistence fails after a successful provider submission, the provider_order_id must still be logged for manual recovery.

**Validates: Requirements 8.1, 5.1, 5.2**

## Error Handling

### Pricing Errors

- **Timeout (30s):** Return error with message "Pricing request timed out. The provider may be experiencing high load." Offer retry and provider switch.
- **Authentication failure (401/403):** Return error with message "Provider credentials are invalid or expired. Please update your credentials in settings." Do not retry.
- **Provider error (5xx):** Return error with message "The provider is temporarily unavailable." Offer retry.
- **Network error:** Return error with message "Unable to reach the provider. Check your internet connection." Offer retry.

### Order Submission Errors

- **Transient failures (timeout, 5xx):** Automatically retry up to 3 times with exponential backoff (1s, 2s, 4s delays). If all retries exhausted, persist order as "failed" and report to user.
- **Authentication failure (401/403):** Fail immediately (no retry). Report credential issue.
- **Validation error (400/422):** Fail immediately (no retry). Report the specific validation error from the provider.
- **Partial success (multi-title Lulu order):** If the provider reports partial fulfillment, persist the order with the returned status and report which items succeeded/failed.

### ISBN Errors

- **Lulu ISBN request timeout (30s):** Report "ISBN request timed out" and offer retry or proceed without ISBN.
- **Lulu ISBN request failure:** Report the specific error and offer retry or proceed without ISBN.
- **User ISBN validation failure:** Return immediately with the specific format error. Retain the user's input for correction.

### KDP-Specific Handling

- **File generation failure:** Report which file could not be packaged and suggest re-generating the problematic PDF.
- **No submission errors possible:** Since KDP has no API submission, there are no network-related submission errors for this provider.

### Credential Errors

- **Encryption/decryption failure:** Log the error (without exposing key material) and report "Unable to access stored credentials. Please re-enter your provider credentials."
- **Missing credentials:** Report "No credentials configured for {provider}. Please add your API credentials in settings before ordering."

## Testing Strategy

### Unit Tests

- **ISBN validation tests:** Test valid ISBN-13 numbers, invalid check digits, wrong length, non-numeric input, hyphens/spaces handling
- **LuluAdapter tests:** Mock HTTP responses for OAuth2 token exchange, pricing, order submission, ISBN request; test timeout handling
- **BookVaultAdapter tests:** Mock HTTP responses for pricing and order submission; test API key header inclusion
- **KDPAdapter tests:** Test file packaging logic, pricing calculation from published rates, instruction generation
- **OrderService retry tests:** Test retry count enforcement (max 3), exponential backoff timing, non-retryable error short-circuit
- **CredentialService tests:** Test encrypt/decrypt round-trip, upsert behavior, user isolation

### Integration Tests

- **Pricing endpoint tests:** Authenticated request → pricing response with correct structure; test timeout error response; test missing credentials error
- **Order submission endpoint tests:** Full flow from request → adapter call → database persistence; test retry behavior with mocked transient failures; test ISBN validation in order flow
- **Order listing/detail tests:** Create orders, verify list pagination, verify detail includes items
- **Credential endpoint tests:** Store credentials, verify encrypted in DB, verify retrieval works for adapter instantiation, verify user isolation
- **Print readiness tests:** Verify orders are rejected for projects without valid PDFs

### Mock Strategy

- External provider APIs are mocked using `respx` or `httpx.MockTransport`
- Tests use a test database with the existing models
- File system operations (PDF existence checks) are mocked with `unittest.mock.patch`
- The `app/utils/encryption.py` functions are used directly (not mocked) to verify real encryption behavior
