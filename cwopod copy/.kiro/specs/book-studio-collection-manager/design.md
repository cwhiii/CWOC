# Technical Design Document

## Overview

This document describes the technical design for the Collection Manager module of C.W.'s O-POD. The module provides the bookshelf view (paginated listing of book projects with status filtering), drag-and-drop sort order persistence, and batch ordering capabilities that route to the appropriate print provider adapter based on multi-title support.

The backend exposes three primary endpoints: `GET /api/bookshelf` for paginated listing with filters, `PATCH /api/bookshelf/order` for persisting drag-and-drop sort changes, and `POST /api/bookshelf/batch-order` for submitting batch orders. The frontend provides a responsive grid/list view with drag-and-drop reordering, multi-select for batch ordering, and status badge display.

The design leverages the existing `BookProject` model (with its `sort_order` and `status` fields) and the `PrintOrder`/`OrderItem` models from the Print & Order Service. The `BatchOrderService` aggregates selected books and delegates to the `PrintProviderAdapter` interface, handling the distinction between providers that support multi-title shipments (Lulu xPress) and those that require individual orders.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Bookshelf Page Component                      │  │
│  │  - Grid/List view toggle                                  │  │
│  │  - Status filter bar                                      │  │
│  │  - Pagination controls                                    │  │
│  │  - Drag-and-drop reordering (SortableJS)                  │  │
│  │  - Multi-select checkboxes for batch ordering             │  │
│  │  - Batch order confirmation modal                         │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │ HTTP (API calls)                   │
└──────────────────────────────┼───────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Bookshelf Router                              │  │
│  │  GET  /api/bookshelf          (list + paginate + filter)   │  │
│  │  PATCH /api/bookshelf/order   (persist sort order)         │  │
│  │  POST  /api/bookshelf/batch-order (submit batch)           │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │              BookshelfAPI Service                          │  │
│  │  - list_projects(page, per_page, status_filter)           │  │
│  │  - update_sort_order(project_ids_in_order)                │  │
│  │  - get_projects_by_ids(project_ids)                       │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │              BatchOrderService                             │  │
│  │  - validate_selection(project_ids)                        │  │
│  │  - get_pricing_estimate(project_ids, provider)            │  │
│  │  - submit_batch_order(project_ids, provider, address)     │  │
│  │  - retry_failed(order_id, failed_project_ids)             │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │         PrintProviderAdapter (from Print & Order Service)  │  │
│  │  - LuluAdapter (supports multi-title)                     │  │
│  │  - BookVaultAdapter (individual orders only)              │  │
│  │  - KDPAdapter (manual export, individual)                 │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │              Database Layer (SQLAlchemy)                   │  │
│  │  - BookProject (status, sort_order)                       │  │
│  │  - PrintOrder + OrderItem                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flows

**Bookshelf Listing:**
1. Client requests `GET /api/bookshelf?page=1&per_page=50&status=print_ready`
2. BookshelfAPI queries BookProject table scoped to user, filtered by status, ordered by sort_order
3. Returns paginated results with total count and pagination metadata

**Sort Order Persistence:**
1. User drags a book to a new position in the grid
2. Frontend sends `PATCH /api/bookshelf/order` with the ordered list of project IDs
3. BookshelfAPI updates `sort_order` field on each project in a single transaction
4. Returns 200 OK

**Batch Order:**
1. User selects 2-20 print_ready books and clicks "Batch Order"
2. Frontend requests pricing estimate via `POST /api/bookshelf/batch-order` with `action: "estimate"`
3. User confirms; frontend sends `POST /api/bookshelf/batch-order` with `action: "submit"`
4. BatchOrderService checks provider's multi-title support
5. If Lulu: creates single PrintOrder with multiple OrderItems
6. If BookVault/KDP: creates individual PrintOrders, one per book
7. Returns order result with success/failure per title

## Components and Interfaces

### BookshelfAPI Service

**Location:** `backend/app/services/bookshelf_service.py`

**Responsibility:** Handles paginated listing, status filtering, and sort order persistence for the bookshelf view.

```python
class BookshelfAPI:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.scoped = UserScopedQuery(db, user_id)

    async def list_projects(
        self,
        page: int = 1,
        per_page: int = 50,
        status_filter: list[ProjectStatus] | None = None,
    ) -> PaginatedResult[BookProjectSummary]:
        """
        List book projects with pagination and optional status filtering.
        - Queries BookProject scoped to user
        - Applies status filter if provided (WHERE status IN (...))
        - Orders by sort_order ASC, then created_at DESC as tiebreaker
        - Returns page of results with total_count, page, per_page, total_pages
        """

    async def update_sort_order(self, project_ids: list[UUID]) -> None:
        """
        Persist custom sort order from drag-and-drop.
        - Receives ordered list of project IDs
        - Validates all IDs belong to the authenticated user
        - Updates sort_order field: first ID gets 0, second gets 1, etc.
        - Executes as single transaction (all-or-nothing)
        - Raises NotFoundError if any ID doesn't belong to user
        """

    async def get_projects_by_ids(self, project_ids: list[UUID]) -> list[BookProject]:
        """
        Retrieve full project records by IDs, scoped to user.
        Used by BatchOrderService to validate selection.
        """

    async def get_view_preference(self) -> str:
        """
        Get user's bookshelf view preference (grid or list).
        Returns 'grid' as default if not set.
        """

    async def set_view_preference(self, mode: str) -> None:
        """
        Persist user's bookshelf view preference.
        Accepts 'grid' or 'list'.
        """
```

### BatchOrderService

**Location:** `backend/app/services/batch_order_service.py`

**Responsibility:** Validates batch selections, routes to the appropriate print provider adapter, and handles multi-title vs individual order logic.

```python
class BatchOrderService:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.bookshelf = BookshelfAPI(db, user_id)

    async def validate_selection(self, project_ids: list[UUID]) -> ValidationResult:
        """
        Validate batch order selection.
        - Checks count is between 2 and 20
        - Checks all projects belong to user
        - Checks all projects have status == 'print_ready'
        - Returns ValidationResult with valid flag and list of issues
        """

    async def get_pricing_estimate(
        self, project_ids: list[UUID], provider: str, shipping_address: str
    ) -> PricingEstimate:
        """
        Get pricing estimate for batch order.
        - Calls PrintProviderAdapter.get_estimate() for the selected provider
        - Returns per-title pricing and total (including shipping)
        - Indicates whether order will be multi-title or individual
        """

    async def submit_batch_order(
        self,
        project_ids: list[UUID],
        provider: str,
        shipping_address: str,
    ) -> BatchOrderResult:
        """
        Submit batch order to print provider.
        - Validates selection (2-20 books, all print_ready)
        - Checks provider's multi-title support via MULTI_TITLE_PROVIDERS
        - If multi-title supported (Lulu):
            - Creates single PrintOrder with all books as OrderItems
            - Submits to provider API
            - On success: updates all project statuses to 'ordered'
        - If individual orders required (BookVault, KDP):
            - Creates separate PrintOrder per book
            - Submits each individually
            - Updates status per-book on success
            - Collects failures separately
        - Returns BatchOrderResult with successes, failures, and order IDs
        """

    async def retry_failed(
        self, failed_project_ids: list[UUID], provider: str, shipping_address: str
    ) -> BatchOrderResult:
        """
        Retry previously failed batch order titles.
        - Validates failed_project_ids are still print_ready
        - Resubmits using same logic as submit_batch_order
        - Tracks retry count (max 3 per title)
        - Returns updated BatchOrderResult
        """

    MULTI_TITLE_PROVIDERS = {"lulu_xpress"}
```

### Bookshelf Router

**Location:** `backend/app/routers/bookshelf.py`

```python
router = APIRouter(prefix="/api/bookshelf", tags=["bookshelf"])

@router.get("", response_model=PaginatedBookshelfResponse)
async def list_bookshelf(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=50),
    status: list[ProjectStatus] | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List bookshelf with pagination and optional status filter.
    Response: {items: [...], total_count, page, per_page, total_pages}
    """

@router.patch("/order", status_code=200)
async def update_sort_order(
    body: SortOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Persist drag-and-drop sort order.
    Request: {project_ids: [UUID, ...]}
    Response: {success: true}
    Errors: 400 (invalid IDs), 404 (project not found for user)
    """

@router.post("/batch-order", response_model=BatchOrderResponse)
async def batch_order(
    body: BatchOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit batch order or get pricing estimate.
    Request: {action: "estimate"|"submit"|"retry", project_ids: [...], provider: str, shipping_address: str}
    Response varies by action:
      - estimate: {pricing: {...}, is_multi_title: bool}
      - submit: {successes: [...], failures: [...], order_ids: [...]}
      - retry: {successes: [...], failures: [...], order_ids: [...]}
    Errors: 400 (validation), 422 (invalid selection)
    """
```

### Frontend Bookshelf Component

**Location:** `frontend/src/routes/bookshelf/+page.svelte`

**Responsibility:** Renders the bookshelf grid/list view with drag-and-drop, selection, filtering, and batch order UI.

```
BookshelfPage
├── ViewToggle (grid/list switch)
├── StatusFilterBar (multi-select status chips)
├── BookGrid / BookList (conditional on view mode)
│   ├── BookCard (repeated)
│   │   ├── CoverThumbnail
│   │   ├── TitleAuthor
│   │   ├── StatusBadge (color-coded)
│   │   ├── SelectCheckbox (for batch ordering)
│   │   └── DragHandle
│   └── EmptyState (when no books match filter)
├── PaginationControls (prev/next/page numbers)
├── BatchOrderBar (floating, shows when selection active)
│   ├── SelectionCount ("3 of 20 selected")
│   ├── SelectAll / ClearSelection buttons
│   └── BatchOrderButton (disabled if < 2 selected)
└── BatchOrderModal (confirmation dialog)
    ├── SelectedBooksList
    ├── ProviderSelector
    ├── MultiTitleWarning (if provider doesn't support)
    ├── PricingEstimate
    ├── ShippingAddressForm
    └── ConfirmButton / CancelButton
```

**Drag-and-drop:** Uses SortableJS (via `svelte-sortablejs` or direct integration) for drag-and-drop reordering. On drop, sends the new order to `PATCH /api/bookshelf/order` with debouncing (500ms) to avoid excessive API calls during rapid reordering.

**Selection state:** Managed in a Svelte store (`selectedProjectIds: Set<string>`) that persists during the session. Selection is cleared on page navigation away from bookshelf or on successful batch order submission.

## Data Models

### BookProject (existing, relevant fields)

The Collection Manager uses the existing `BookProject` model. Key fields for this module:

```python
# backend/app/models/project.py (already exists)
class ProjectStatus(str, PyEnum):
    DRAFT = "draft"
    TYPESET = "typeset"
    COVER_READY = "cover_ready"
    PRINT_READY = "print_ready"
    ORDERED = "ordered"
    SHIPPED = "shipped"

class BookProject(Base, TimestampMixin, UserScopedMixin):
    # ... existing fields ...
    status: Mapped[ProjectStatus]  # Current lifecycle state
    sort_order: Mapped[int]        # User-defined display order (0-based)
    title: Mapped[str]             # Book title
    author: Mapped[str | None]     # Book author
    cover_pdf_path: Mapped[str | None]  # Used for thumbnail generation
```

### UserPreference (new, for view mode persistence)

```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value VARCHAR(500) NOT NULL,
    UNIQUE(user_id, key)
);

CREATE INDEX idx_user_preferences_user_key ON user_preferences (user_id, key);
```

```python
# backend/app/models/user_preference.py
class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "key"),)
```

### Pydantic Schemas

```python
# backend/app/schemas/bookshelf.py

class BookProjectSummary(BaseModel):
    id: UUID
    title: str
    author: str | None
    status: ProjectStatus
    sort_order: int
    cover_thumbnail_url: str | None
    created_at: datetime
    updated_at: datetime

class PaginatedBookshelfResponse(BaseModel):
    items: list[BookProjectSummary]
    total_count: int
    page: int
    per_page: int
    total_pages: int

class SortOrderRequest(BaseModel):
    project_ids: list[UUID] = Field(min_length=1, max_length=50)

class BatchOrderRequest(BaseModel):
    action: Literal["estimate", "submit", "retry"]
    project_ids: list[UUID] = Field(min_length=2, max_length=20)
    provider: str
    shipping_address: str = ""

class PricingEstimate(BaseModel):
    per_title: list[TitlePricing]
    subtotal: Decimal
    shipping: Decimal
    total: Decimal
    is_multi_title: bool
    provider: str

class TitlePricing(BaseModel):
    project_id: UUID
    title: str
    price: Decimal

class BatchOrderResult(BaseModel):
    successes: list[OrderSuccess]
    failures: list[OrderFailure]
    order_ids: list[str]
    is_multi_title: bool

class OrderSuccess(BaseModel):
    project_id: UUID
    title: str
    order_id: str

class OrderFailure(BaseModel):
    project_id: UUID
    title: str
    error: str
    retry_count: int

class BatchOrderResponse(BaseModel):
    pricing: PricingEstimate | None = None
    result: BatchOrderResult | None = None
```

### Project Status State Machine

```
┌───────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────┐
│ draft │────▶│ typeset  │────▶│ cover_ready │────▶│ print_ready │────▶│ ordered │────▶│ shipped │
└───────┘     └─────────┘     └─────────────┘     └─────────────┘     └─────────┘     └─────────┘
```

Valid transitions (enforced by the application layer):
- `draft` → `typeset` (interior PDF generated)
- `typeset` → `cover_ready` (cover PDF generated)
- `cover_ready` → `print_ready` (both PDFs validated for provider)
- `print_ready` → `ordered` (order submitted to provider)
- `ordered` → `shipped` (provider reports shipment)

The Collection Manager reads status but does not directly advance it except for `print_ready → ordered` (via batch order submission) and `ordered → shipped` (via provider webhook/polling). All other transitions are performed by upstream modules.

## Correctness Properties

### Property 1: Pagination Completeness

For any user with N book projects, the union of all pages (each containing at most 50 items) must equal exactly the set of all N projects. No project is duplicated across pages, and no project is missing. `total_count` always equals the actual number of matching projects, and `total_pages = ceil(total_count / per_page)`.

**Validates: Requirements 1.1, 1.2**

### Property 2: Sort Order Consistency

After a successful `PATCH /api/bookshelf/order` with a list of project IDs, a subsequent `GET /api/bookshelf` must return those projects in exactly the submitted order. The sort_order values stored in the database must form a contiguous sequence starting from 0 with no gaps or duplicates within a user's projects.

**Validates: Requirements 6.2, 6.3**

### Property 3: Batch Selection Validity

A batch order submission must be rejected if: (a) fewer than 2 or more than 20 project IDs are provided, (b) any project ID does not belong to the authenticated user, or (c) any project's status is not `print_ready`. No order is created if validation fails.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: Multi-Title Routing Correctness

For any batch order, if the selected provider is in `MULTI_TITLE_PROVIDERS`, exactly one PrintOrder is created with N OrderItems. If the provider is not in `MULTI_TITLE_PROVIDERS`, exactly N PrintOrders are created, each with one OrderItem. The total number of OrderItems always equals the number of selected projects.

**Validates: Requirements 4.1, 5.1**

### Property 5: Batch Order Atomicity (Multi-Title)

For a multi-title batch order (single shipment), either all books are ordered successfully (all statuses become `ordered`) or none are (all statuses remain `print_ready`). There is no partial state for multi-title orders.

**Validates: Requirements 4.1, 4.2**

### Property 6: Failure Preservation

After a batch order failure (full or partial), the user's selection of failed project IDs must be preserved in the response. The set of failed project IDs in the response must be a subset of the originally submitted project IDs. Successfully ordered projects must not appear in the failure list.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 7: User Data Isolation

All bookshelf queries are scoped by `user_id`. A user can never see, reorder, or batch-order projects belonging to another user. Attempting to include another user's project ID in a sort order update or batch order returns 404 for that ID.

**Validates: Requirements 1.1, 3.2 (implicitly via UserScopedQuery)**

### Property 8: Status Filter Correctness

When a status filter is applied, every project in the response must have a status that is in the filter set. The total_count must reflect only the filtered count, not the total collection size.

**Validates: Requirements 1.4, 1.5**

## Error Handling

| Scenario | HTTP Status | Response Body | Notes |
|----------|-------------|---------------|-------|
| Bookshelf request with invalid page number | 400 | `{"detail": "Page must be >= 1"}` | Query validation |
| Sort order with project ID not belonging to user | 404 | `{"detail": "One or more projects not found"}` | Does not reveal other user's data |
| Sort order with invalid UUID format | 422 | `{"detail": "Validation error", "errors": [...]}` | Pydantic validation |
| Batch order with < 2 or > 20 selections | 400 | `{"detail": "Selection must contain between 2 and 20 books"}` | Range validation |
| Batch order with non-print_ready books | 400 | `{"detail": "All selected books must have status 'print_ready'", "invalid_ids": [...]}` | Lists which books are invalid |
| Batch order with project not belonging to user | 404 | `{"detail": "One or more projects not found"}` | Same as sort order |
| Provider API unreachable during batch order | 502 | `{"detail": "Print provider unavailable", "failures": [...]}` | Preserves selection |
| Provider API returns error for specific titles | 207 | `{"result": {successes: [...], failures: [...]}}` | Multi-status response |
| Pricing estimate timeout | 504 | `{"detail": "Pricing estimate timed out. Please try again."}` | 60-second timeout |
| Retry count exceeded (> 3 attempts) | 400 | `{"detail": "Maximum retry attempts exceeded for titles", "project_ids": [...]}` | Suggests checking files |
| Unauthenticated request | 401 | `{"detail": "Authentication required"}` | Standard auth middleware |

### Error Response Schema

```python
class BookshelfErrorResponse(BaseModel):
    detail: str
    invalid_ids: list[UUID] | None = None
    failures: list[OrderFailure] | None = None
```

## Testing Strategy

### Unit Tests

- **BookshelfAPI.list_projects:** Verify pagination math (total_count, total_pages), status filtering returns only matching projects, sort_order is respected, empty collection returns empty page
- **BookshelfAPI.update_sort_order:** Verify sort_order values are assigned sequentially, invalid project IDs raise error, partial list updates only listed projects
- **BatchOrderService.validate_selection:** Verify rejection for < 2 or > 20 books, rejection for non-print_ready status, rejection for other user's projects, acceptance for valid selection
- **BatchOrderService.submit_batch_order (multi-title):** Verify single PrintOrder created for Lulu, all statuses updated on success, no status change on failure (atomicity)
- **BatchOrderService.submit_batch_order (individual):** Verify N PrintOrders created for BookVault, partial failure updates only successful titles, failure list is accurate
- **BatchOrderService.retry_failed:** Verify retry count tracking, rejection after 3 attempts, successful retry updates status
- **Status state machine:** Verify only valid transitions are allowed, invalid transitions raise error

### Integration Tests

- **GET /api/bookshelf:** Full request/response with pagination, verify correct page sizes, verify status filter works, verify sort order is applied
- **PATCH /api/bookshelf/order:** Verify sort order persists across requests, verify rejection of other user's project IDs
- **POST /api/bookshelf/batch-order (estimate):** Verify pricing returned for valid selection, verify error for invalid selection
- **POST /api/bookshelf/batch-order (submit):** Verify order creation with mocked provider, verify status updates, verify multi-title vs individual routing
- **POST /api/bookshelf/batch-order (retry):** Verify retry resubmits failed titles, verify retry count enforcement
- **Data isolation:** Verify user A cannot see or order user B's projects
- **Concurrent sort order updates:** Verify last-write-wins behavior without data corruption

### Frontend Tests

- **BookGrid rendering:** Verify correct number of cards displayed per page, verify status badges show correct colors
- **Drag-and-drop:** Verify sort order API called on drop, verify visual feedback during drag
- **Selection:** Verify checkbox state management, verify count display, verify min/max enforcement
- **Batch order flow:** Verify modal shows pricing, verify confirmation triggers submit, verify error display on failure
- **Pagination:** Verify page navigation updates displayed books, verify filter changes reset to page 1
