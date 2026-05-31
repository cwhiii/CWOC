# Implementation Plan: Collection Manager Module

## Overview

This plan implements the Collection Manager module for C.W.'s O-POD, providing the bookshelf view with pagination and status filtering, drag-and-drop sort order persistence, and batch ordering with multi-title routing logic. The module builds on the existing BookProject model and integrates with the Print & Order Service's PrintProviderAdapter interface.

Technology: Python 3.11+, FastAPI, SQLAlchemy (async), PostgreSQL, SvelteKit, SortableJS, pytest + pytest-asyncio for testing.

## Tasks

- [x] 1. Implement BookshelfAPI service (list with pagination, status filter)
  - [x] 1.1 Create BookshelfAPI service class
    - Create `backend/app/services/bookshelf_service.py`
    - Implement `BookshelfAPI.__init__(db, user_id)` with UserScopedQuery setup
    - Implement `list_projects(page, per_page, status_filter)`:
      - Build query on BookProject scoped to user_id
      - Apply status filter: `WHERE status IN (...)` if status_filter provided
      - Order by `sort_order ASC, created_at DESC` (sort_order primary, created_at tiebreaker)
      - Calculate total_count with COUNT query
      - Apply OFFSET/LIMIT for pagination: `offset = (page - 1) * per_page`
      - Return PaginatedResult with items, total_count, page, per_page, total_pages
    - Implement `get_projects_by_ids(project_ids)`:
      - Query BookProject WHERE id IN (...) AND user_id = self.user_id
      - Return list of BookProject instances
      - Raise NotFoundError if any ID not found for user
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.2 Create Pydantic schemas for bookshelf
    - Create `backend/app/schemas/bookshelf.py`
    - Define BookProjectSummary: id, title, author, status, sort_order, cover_thumbnail_url, created_at, updated_at
    - Define PaginatedBookshelfResponse: items, total_count, page, per_page, total_pages
    - Define SortOrderRequest: project_ids (list[UUID], min_length=1, max_length=50)
    - Define BatchOrderRequest: action (Literal["estimate", "submit", "retry"]), project_ids (list[UUID], min_length=2, max_length=20), provider (str), shipping_address (str)
    - Define PricingEstimate, TitlePricing, BatchOrderResult, OrderSuccess, OrderFailure, BatchOrderResponse
    - _Requirements: 1.1, 1.3, 3.1_

  - [x] 1.3 Create bookshelf router with list endpoint
    - Create `backend/app/routers/bookshelf.py`
    - Implement `GET /api/bookshelf`:
      - Query params: page (int, default=1, ge=1), per_page (int, default=50, ge=1, le=50), status (list[ProjectStatus], optional)
      - Depends on get_current_user
      - Instantiate BookshelfAPI(db, current_user.id)
      - Call list_projects(page, per_page, status)
      - Return PaginatedBookshelfResponse
    - Register router in `backend/app/main.py`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.4 Implement view preference persistence
    - Create `backend/app/models/user_preference.py` with UserPreference model
    - Create Alembic migration for user_preferences table
    - Add `get_view_preference(user_id)` and `set_view_preference(user_id, mode)` to BookshelfAPI
    - Add `GET /api/bookshelf/preferences` and `PATCH /api/bookshelf/preferences` endpoints
    - _Requirements: 1.6_

- [x] 2. Implement sort order persistence (PATCH /api/bookshelf/order)
  - [x] 2.1 Implement update_sort_order in BookshelfAPI
    - Add `update_sort_order(project_ids: list[UUID])` method to BookshelfAPI:
      - Validate all project_ids belong to authenticated user (query by IDs with user_id filter)
      - If any ID not found: raise NotFoundError("One or more projects not found")
      - Assign sort_order values: enumerate(project_ids) → project.sort_order = index
      - Execute all updates in a single transaction (flush once at end)
      - Handle partial page updates: only update sort_order for provided IDs, leave others unchanged
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.2 Implement sort order endpoint
    - Add `PATCH /api/bookshelf/order` to bookshelf router:
      - Parse SortOrderRequest body (project_ids list)
      - Depends on get_current_user
      - Call BookshelfAPI.update_sort_order(body.project_ids)
      - Return `{"success": true}` with 200 status
      - Handle NotFoundError → 404
      - Handle validation errors → 400
    - _Requirements: 6.2_

- [x] 3. Implement BatchOrderService (multi-title routing logic)
  - [x] 3.1 Create BatchOrderService class
    - Create `backend/app/services/batch_order_service.py`
    - Implement `BatchOrderService.__init__(db, user_id)` with BookshelfAPI and provider adapter references
    - Define `MULTI_TITLE_PROVIDERS = {"lulu_xpress"}` class constant
    - Implement `validate_selection(project_ids)`:
      - Check len(project_ids) between 2 and 20
      - Fetch projects via BookshelfAPI.get_projects_by_ids()
      - Check all projects have status == ProjectStatus.PRINT_READY
      - Return ValidationResult(valid=True/False, issues=[...])
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Implement pricing estimate
    - Implement `get_pricing_estimate(project_ids, provider, shipping_address)`:
      - Validate selection first
      - Determine if multi-title (provider in MULTI_TITLE_PROVIDERS)
      - Call PrintProviderAdapter.get_estimate() with project details
      - Return PricingEstimate with per_title pricing, subtotal, shipping, total, is_multi_title flag
      - Timeout after 60 seconds with appropriate error
    - _Requirements: 4.3_

  - [x] 3.3 Implement multi-title batch order submission
    - Implement `_submit_multi_title(projects, provider, shipping_address)`:
      - Create single PrintOrder record with provider and shipping_address
      - Create OrderItem for each project (order_id, project_id)
      - Call PrintProviderAdapter.submit_order() with all items
      - On success: update all project statuses to ORDERED, set provider_order_id
      - On failure: rollback all changes (no partial state), return failure
      - Return BatchOrderResult
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 3.4 Implement individual batch order submission
    - Implement `_submit_individual(projects, provider, shipping_address)`:
      - For each project:
        - Create individual PrintOrder record
        - Create single OrderItem
        - Call PrintProviderAdapter.submit_order() for that title
        - On success: update project status to ORDERED
        - On failure: record failure, continue with next project
      - Collect successes and failures
      - Return BatchOrderResult with both lists
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 3.5 Implement submit_batch_order orchestrator
    - Implement `submit_batch_order(project_ids, provider, shipping_address)`:
      - Call validate_selection(project_ids) — reject if invalid
      - Check if provider in MULTI_TITLE_PROVIDERS
      - If yes: call _submit_multi_title()
      - If no: call _submit_individual()
      - Return BatchOrderResult
    - _Requirements: 4.1, 5.1_

  - [x] 3.6 Implement retry logic
    - Implement `retry_failed(failed_project_ids, provider, shipping_address)`:
      - Validate projects are still print_ready
      - Track retry count per project (stored in order metadata or separate tracking)
      - If retry_count >= 3 for any project: exclude from retry, include in failures with max-retry message
      - Resubmit remaining projects using same multi-title/individual logic
      - Return BatchOrderResult
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. Create batch order endpoint (POST /api/bookshelf/batch-order)
  - [x] 4.1 Implement batch order endpoint
    - Add `POST /api/bookshelf/batch-order` to bookshelf router:
      - Parse BatchOrderRequest body
      - Depends on get_current_user
      - Instantiate BatchOrderService(db, current_user.id)
      - Switch on body.action:
        - "estimate": call get_pricing_estimate(), return pricing in BatchOrderResponse
        - "submit": call submit_batch_order(), return result in BatchOrderResponse
        - "retry": call retry_failed(), return result in BatchOrderResponse
      - Handle validation errors → 400
      - Handle provider errors → 502 (with failure details)
      - Handle timeout → 504
    - _Requirements: 3.1, 4.1, 4.4, 5.1, 5.3, 7.1_

  - [x] 4.2 Add multi-title warning to estimate response
    - When action is "estimate" and provider is NOT in MULTI_TITLE_PROVIDERS:
      - Include `warning: "This provider does not support multi-title shipments. Each book will be ordered separately."` in response
      - Include `is_multi_title: false` flag
    - Frontend uses this to show warning before confirmation
    - _Requirements: 5.3_

- [x] 5. Build frontend bookshelf component (grid view, status badges, selection)
  - [x] 5.1 Create bookshelf page layout and API integration
    - Update `frontend/src/routes/bookshelf/+page.svelte`:
      - Add page load function to fetch `GET /api/bookshelf?page=1&per_page=50`
      - Create reactive state: books, totalCount, currentPage, totalPages, viewMode, statusFilter
      - Create selectedProjectIds store (Set<string>) for batch selection
      - Add API helper functions: fetchBookshelf(), updateSortOrder(), submitBatchOrder()
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.2 Build BookGrid and BookCard components
    - Create `frontend/src/lib/components/BookGrid.svelte`:
      - Responsive CSS grid layout (auto-fill, min 200px card width)
      - Accepts books array and renders BookCard for each
    - Create `frontend/src/lib/components/BookCard.svelte`:
      - Cover thumbnail (placeholder if no cover_pdf_path)
      - Title and author text (truncated with ellipsis)
      - StatusBadge component with color mapping:
        - draft: gray, typeset: blue, cover_ready: purple, print_ready: green, ordered: orange, shipped: emerald
      - Checkbox for batch selection (only shown for print_ready books)
      - Drag handle icon (grip dots)
    - Create `frontend/src/lib/components/BookList.svelte` (alternative list view):
      - Table-style layout with columns: cover, title, author, status, actions
    - _Requirements: 1.3, 1.6, 2.1, 2.2_

  - [x] 5.3 Build status filter bar and view toggle
    - Create `frontend/src/lib/components/StatusFilterBar.svelte`:
      - Horizontal row of filter chips for each status value
      - Multi-select: clicking a chip toggles it on/off
      - "All" chip to clear filters
      - On change: re-fetch bookshelf with updated status filter, reset to page 1
    - Create `frontend/src/lib/components/ViewToggle.svelte`:
      - Grid/List icon toggle button
      - Persists preference via `PATCH /api/bookshelf/preferences`
      - Loads initial preference on mount
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 5.4 Build pagination controls
    - Create `frontend/src/lib/components/PaginationControls.svelte`:
      - Previous/Next buttons (disabled at boundaries)
      - Page number buttons (show first, last, and surrounding pages with ellipsis)
      - Current page indicator
      - On page change: re-fetch bookshelf with new page number
    - _Requirements: 1.2_

  - [x] 5.5 Build selection UI and batch order bar
    - Add selection logic to BookshelfPage:
      - Checkboxes only visible on print_ready books
      - Running count display: "X books selected"
      - "Select All" selects all print_ready on current page (up to 20 max)
      - "Clear Selection" deselects all
      - Disable additional selection when 20 reached (with tooltip message)
      - Minimum 2 required to enable batch order button
    - Create floating BatchOrderBar component:
      - Appears when selection count >= 1
      - Shows count, Select All, Clear, and "Batch Order" button
      - "Batch Order" button disabled if count < 2
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Build frontend drag-and-drop reordering
  - [x] 6.1 Integrate SortableJS for drag-and-drop
    - Install SortableJS: `npm install sortablejs @types/sortablejs`
    - Create `frontend/src/lib/components/SortableGrid.svelte` wrapper:
      - Wraps BookGrid with SortableJS initialization
      - Configures drag handle selector (`.drag-handle` class)
      - Provides visual feedback: ghost element, drop placeholder
      - Emits `on:reorder` event with new order of project IDs
    - _Requirements: 6.1, 6.5_

  - [x] 6.2 Implement sort order persistence on drop
    - On `reorder` event from SortableGrid:
      - Extract ordered project IDs from new DOM order
      - Debounce API call (500ms) to handle rapid reordering
      - Call `PATCH /api/bookshelf/order` with project_ids array
      - Show subtle success indicator (brief checkmark or toast)
      - On error: revert to previous order, show error toast
    - Handle sort within filtered view: only send IDs of visible (filtered) projects
    - _Requirements: 6.2, 6.4_

- [x] 7. Build frontend batch order UI (selection, provider choice, confirmation)
  - [x] 7.1 Create BatchOrderModal component
    - Create `frontend/src/lib/components/BatchOrderModal.svelte`:
      - Triggered by "Batch Order" button click
      - Step 1: Show selected books list with titles and cover thumbnails
      - Step 2: Provider selector dropdown (from user's configured providers)
      - Step 3: If provider not multi-title capable, show warning message:
        "This provider does not support multi-title shipments. Each book will be ordered separately and may ship individually."
        Require explicit "I understand, proceed" confirmation
      - Step 4: Shipping address form (or use saved default address)
      - Step 5: Show pricing estimate (fetched via action: "estimate")
      - Step 6: Confirm button → submit order
    - _Requirements: 4.3, 5.3_

  - [x] 7.2 Implement batch order submission and result display
    - On confirm:
      - Call `POST /api/bookshelf/batch-order` with action: "submit"
      - Show loading state during submission
      - On success: display confirmation with order ID(s), clear selection, refresh bookshelf
      - On partial failure: display which titles succeeded and which failed
      - On full failure: display error message, keep selection intact
    - _Requirements: 4.2, 4.4, 5.2, 7.1, 7.2_

  - [x] 7.3 Implement retry UI for failed orders
    - When batch order has failures:
      - Show failed titles with error messages
      - "Retry Failed" button pre-selects failed titles
      - Call `POST /api/bookshelf/batch-order` with action: "retry" and failed project_ids
      - Display retry count (X of 3 attempts used)
      - After 3 failed retries: show message suggesting user check book files and provider config
      - "Dismiss" button clears the failure state
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Write unit tests (pagination, batch routing logic)
  - [x] 8.1 Test BookshelfAPI.list_projects
    - Test pagination: 120 books returns 3 pages (50, 50, 20), correct total_count and total_pages
    - Test page boundaries: page 1 returns first 50, page 3 returns last 20
    - Test empty collection returns empty items with total_count=0
    - Test status filter: only matching statuses returned, total_count reflects filtered count
    - Test multi-status filter: books matching any selected status are included
    - Test sort order: books returned in sort_order ASC, then created_at DESC
    - Test user isolation: only returns projects for authenticated user
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 8.2 Test BookshelfAPI.update_sort_order
    - Test sort_order values assigned sequentially (0, 1, 2, ...)
    - Test partial update: only listed IDs get new sort_order, others unchanged
    - Test invalid project ID (not belonging to user) raises NotFoundError
    - Test empty list is rejected by schema validation
    - Test idempotent: submitting same order twice produces same result
    - _Requirements: 6.2, 6.3_

  - [x] 8.3 Test BatchOrderService.validate_selection
    - Test valid selection (2-20 print_ready books) returns valid=True
    - Test < 2 books returns valid=False with appropriate message
    - Test > 20 books returns valid=False with appropriate message
    - Test non-print_ready book in selection returns valid=False with list of invalid IDs
    - Test project belonging to different user returns NotFoundError
    - _Requirements: 3.1, 3.2_

  - [x] 8.4 Test BatchOrderService.submit_batch_order routing
    - Test Lulu xPress (multi-title provider): creates single PrintOrder with N OrderItems
    - Test BookVault (individual provider): creates N PrintOrders with 1 OrderItem each
    - Test multi-title success: all project statuses updated to ORDERED
    - Test multi-title failure: no project statuses changed (atomicity)
    - Test individual partial failure: only successful projects updated to ORDERED
    - Test individual failure list contains correct project IDs and error messages
    - _Requirements: 4.1, 4.2, 5.1, 5.4_

  - [x] 8.5 Test BatchOrderService.retry_failed
    - Test retry resubmits only failed project IDs
    - Test retry count increments per attempt
    - Test retry rejected after 3 attempts for a project
    - Test successful retry updates project status to ORDERED
    - _Requirements: 7.3, 7.4_

- [x] 9. Write integration tests (bookshelf CRUD, batch ordering)
  - [x] 9.1 Test GET /api/bookshelf endpoint
    - Test returns paginated results for authenticated user
    - Test pagination params (page, per_page) work correctly
    - Test status filter query param filters results
    - Test unauthenticated request returns 401
    - Test user A cannot see user B's projects
    - Test response includes all required fields (title, author, status, sort_order, etc.)
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 9.2 Test PATCH /api/bookshelf/order endpoint
    - Test successful sort order update returns 200
    - Test sort order persists: subsequent GET returns books in new order
    - Test invalid project ID returns 404
    - Test other user's project ID returns 404
    - Test unauthenticated request returns 401
    - _Requirements: 6.2, 6.3_

  - [x] 9.3 Test POST /api/bookshelf/batch-order endpoint
    - Test estimate action returns pricing for valid selection
    - Test estimate with non-multi-title provider includes warning
    - Test submit action with Lulu creates single order (mock provider API)
    - Test submit action with BookVault creates individual orders (mock provider API)
    - Test submit with < 2 books returns 400
    - Test submit with > 20 books returns 400
    - Test submit with non-print_ready books returns 400
    - Test submit with other user's project returns 404
    - Test provider API failure returns 502 with failure details
    - Test retry action resubmits failed titles
    - Test retry after 3 attempts returns 400
    - Test unauthenticated request returns 401
    - _Requirements: 3.1, 4.1, 4.4, 5.1, 7.1, 7.3_

  - [x] 9.4 Test batch order status updates
    - Test successful multi-title order updates all project statuses to ORDERED
    - Test failed multi-title order leaves all statuses as PRINT_READY
    - Test partial individual order failure: successful titles ORDERED, failed titles PRINT_READY
    - Test status transitions are enforced (cannot order a DRAFT book)
    - _Requirements: 2.3, 4.2, 5.4, 7.2_

## Notes

- The existing `BookProject` model already has `sort_order` (Integer, default=0) and `status` (Enum) fields — no migration needed for core bookshelf functionality
- The `UserPreference` model is new and requires a migration for the `user_preferences` table
- The `PrintProviderAdapter` interface is provided by the Print & Order Service module — this module calls it but does not implement it
- SortableJS is chosen for drag-and-drop because it's lightweight, framework-agnostic, and works well with Svelte's reactive DOM
- The batch order endpoint uses a single URL with an `action` field to keep the API surface small while supporting estimate/submit/retry flows
- Cover thumbnails are generated from `cover_pdf_path` — if no cover exists, a placeholder is shown
- The retry tracking can be stored as metadata on the PrintOrder record or in a separate `batch_order_attempts` table; implementation should choose based on simplicity

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 5, "tasks": ["3.5", "3.6"] },
    { "id": 6, "tasks": ["4.1", "4.2"] },
    { "id": 7, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 8, "tasks": ["5.5", "6.1"] },
    { "id": 9, "tasks": ["6.2", "7.1"] },
    { "id": 10, "tasks": ["7.2", "7.3"] },
    { "id": 11, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 12, "tasks": ["9.1", "9.2", "9.3", "9.4"] }
  ]
}
```
