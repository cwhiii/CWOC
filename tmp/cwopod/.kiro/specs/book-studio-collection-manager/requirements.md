# Requirements Document

## Introduction

The Collection Manager module provides the bookshelf view and batch ordering capabilities for C.W.'s O-POD. It allows users to browse their completed book projects in a paginated library view, track project status through the production lifecycle, reorder their collection via drag-and-drop, and submit batch orders for multiple books in a single transaction. This module depends on the Print & Order Service for order submission and integrates with all project data produced by upstream modules.

## Glossary

- **Bookshelf**: The paginated collection view displaying all of a user's book projects with status indicators and management controls
- **BookshelfAPI**: The backend service responsible for listing, filtering, and persisting sort order for book projects in the bookshelf
- **BatchOrderService**: The service that aggregates selected books and routes them to the appropriate print provider, handling both multi-title and individual order submission
- **Project_Status**: The lifecycle state of a book project: draft, typeset, cover_ready, print_ready, ordered, shipped
- **Batch_Order**: A single order containing 2-20 books submitted together, either as a multi-title shipment or as individual orders depending on provider support
- **Sort_Order**: The user-defined display order of books in the bookshelf, persisted across sessions via the sort_order field on each project
- **PrintProviderAdapter**: The interface through which orders are submitted to external print-on-demand services (Lulu xPress, BookVault, KDP Print)

## Requirements

### Requirement 1: Bookshelf View and Pagination

**User Story:** As a user, I want to see all my book projects in a paginated library view, so that I can browse and manage my collection without overwhelming the interface.

#### Acceptance Criteria

1. WHEN a user navigates to the bookshelf, THE Collection_Manager SHALL display all book projects belonging to the authenticated user, showing a maximum of 50 books per page
2. WHEN the user's collection exceeds 50 books, THE Collection_Manager SHALL provide pagination controls (next, previous, page number) allowing navigation between pages
3. THE Collection_Manager SHALL display each book with its title, author, cover thumbnail (if available), and current project status
4. THE Collection_Manager SHALL support filtering the bookshelf by project status (draft, typeset, cover_ready, print_ready, ordered, shipped) with the ability to select one or more status values
5. WHEN a status filter is applied, THE Collection_Manager SHALL display only books matching the selected status values and update pagination accordingly
6. THE Collection_Manager SHALL support both grid view and list view display modes, with the user's preference persisted across sessions

### Requirement 2: Project Status Display

**User Story:** As a user, I want to see the current production status of each book project, so that I know which books are ready to print and which are still in progress.

#### Acceptance Criteria

1. THE Collection_Manager SHALL display the status of each book project using one of the following values: draft, typeset, cover_ready, print_ready, ordered, shipped
2. THE Collection_Manager SHALL display status using visually distinct badges or indicators (color-coded) so that status is immediately recognizable at a glance
3. THE Collection_Manager SHALL enforce the following valid status transitions: draft → typeset → cover_ready → print_ready → ordered → shipped, where each status can only advance to the next state in sequence
4. WHEN a book's status changes due to upstream module actions (e.g., typesetting completes, cover is finalized, order is placed), THE Collection_Manager SHALL reflect the updated status in the bookshelf view without requiring a manual page refresh beyond normal navigation

### Requirement 3: Batch Order Selection

**User Story:** As a user, I want to select multiple books from my bookshelf for batch ordering, so that I can order several books at once without repeating the order process for each one.

#### Acceptance Criteria

1. THE Collection_Manager SHALL allow users to select between 2 and 20 books from the bookshelf for batch ordering
2. THE Collection_Manager SHALL only allow selection of books with a status of "print_ready" for batch ordering
3. WHEN fewer than 2 books are selected, THE Collection_Manager SHALL disable the batch order action and display a message indicating the minimum selection requirement
4. WHEN 20 books are already selected, THE Collection_Manager SHALL prevent additional selections and display a message indicating the maximum has been reached
5. THE Collection_Manager SHALL display a running count of selected books and a clear "Batch Order" action button when the selection is within the valid range (2-20)
6. THE Collection_Manager SHALL provide a "Select All" action that selects all print_ready books on the current page (up to the 20-book maximum) and a "Clear Selection" action to deselect all

### Requirement 4: Batch Order Submission (Multi-Title)

**User Story:** As a user, I want my batch order submitted as a single shipment when the provider supports it, so that I save on shipping costs and receive all books together.

#### Acceptance Criteria

1. WHEN a batch order is submitted and the selected Print_Provider supports multi-title shipments (Lulu xPress), THE BatchOrderService SHALL submit all selected books as a single order with one shipment
2. WHEN a multi-title batch order is submitted successfully, THE BatchOrderService SHALL update the status of all included books to "ordered" and display a single order confirmation with the provider's order identifier
3. THE BatchOrderService SHALL display a pricing estimate for the batch order (including all selected titles and shipping) before the user confirms submission
4. WHEN the user confirms the batch order, THE BatchOrderService SHALL submit the order to the provider's API and display a confirmation or error within 60 seconds

### Requirement 5: Batch Order Submission (Individual Orders)

**User Story:** As a user, I want to be clearly informed when my batch order will result in individual orders, so that I understand the shipping implications before confirming.

#### Acceptance Criteria

1. WHEN a batch order is submitted to a provider that does not support multi-title shipments (BookVault, KDP Print), THE BatchOrderService SHALL submit individual orders for each selected book
2. WHEN individual orders are placed, THE BatchOrderService SHALL display a notification indicating that separate orders were placed per title, along with the total count of orders created
3. BEFORE submitting to a provider without multi-title support, THE BatchOrderService SHALL display a warning to the user explaining that each book will be ordered separately and may ship individually, and require explicit confirmation to proceed
4. WHEN individual orders are submitted, THE BatchOrderService SHALL update the status of each successfully ordered book to "ordered" independently

### Requirement 6: Drag-and-Drop Reordering

**User Story:** As a user, I want to reorder books in my bookshelf by dragging and dropping, so that I can organize my collection in a way that makes sense to me.

#### Acceptance Criteria

1. THE Collection_Manager SHALL allow users to reorder books in the bookshelf view via drag-and-drop interaction
2. WHEN a user completes a drag-and-drop reorder, THE Collection_Manager SHALL persist the new sort order to the database within 2 seconds so that the order is maintained across sessions and devices
3. THE Collection_Manager SHALL display the bookshelf in the user's custom sort order by default, falling back to creation date (newest first) if no custom order has been set
4. WHEN a status filter is active, THE Collection_Manager SHALL allow drag-and-drop reordering within the filtered results and persist the relative order correctly
5. THE Collection_Manager SHALL provide visual feedback during drag operations (drag handle, drop target indicator, placeholder for the dragged item)

### Requirement 7: Batch Order Error Handling

**User Story:** As a user, I want to know exactly which books failed in a batch order so that I can fix issues and retry without re-selecting everything.

#### Acceptance Criteria

1. IF a batch order submission fails entirely (provider unreachable, authentication error), THEN THE Collection_Manager SHALL display an error message indicating the failure reason, preserve the user's selection, and allow the user to retry the submission
2. IF a batch order partially fails (some titles succeed, some fail), THEN THE Collection_Manager SHALL display which specific titles failed and which succeeded, update the status of successful titles to "ordered", and preserve the selection of failed titles for retry
3. WHEN a batch order fails, THE Collection_Manager SHALL allow the user to retry the failed titles without re-selecting them, up to 3 retry attempts
4. IF all retry attempts are exhausted for a title, THEN THE Collection_Manager SHALL display a message suggesting the user check the book's files and provider configuration, and allow manual retry after addressing the issue
