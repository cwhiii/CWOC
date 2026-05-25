# Requirements Document

## Introduction

The CWOC Email tab on the dashboard suffers from poor load performance, particularly when returning from the chit editor. The current implementation fetches all chits on every page load, recomputes thread grouping on every render, rebuilds the entire DOM from scratch, and blocks all rendering until processing completes. This feature introduces four targeted optimizations — thread cache, single-chit refresh on editor return, DOM caching, and progressive rendering — to eliminate unnecessary work and provide instant perceived responsiveness.

## Glossary

- **Email_View**: The Email tab on the CWOC dashboard that displays email chits in a threaded inbox-style list
- **Thread_Cache**: A module-level variable storing the result of `_emailGroupByThread()` along with a fingerprint of the input data
- **Thread_Grouping**: The `_emailGroupByThread()` algorithm that groups email chits into conversation threads using Message-ID, In-Reply-To, References, and subject fallback
- **Fingerprint**: A lightweight hash derived from email chit IDs, count, and mutable status fields (read, archived) used to detect whether thread recomputation is needed
- **Editor_Return**: The navigation event when a user returns from the chit editor page back to the dashboard Email tab
- **Single_Chit_Refresh**: A targeted API call (`GET /api/chit/{id}`) that fetches only the chit that was just edited, patching it into the existing chits array
- **DOM_Cache**: A detached DOM DocumentFragment holding the previously rendered email scroll container for reattachment without rebuild
- **Progressive_Renderer**: A rendering strategy that displays the first batch of email thread cards immediately and renders remaining batches asynchronously via `requestAnimationFrame`
- **Chits_Array**: The global `chits` variable holding all fetched chit objects in memory
- **Display_Chits**: The `displayChits()` function that filters and routes chits to the appropriate view renderer
- **Scroll_Container**: The `.email-scroll-wrap` DOM element that holds all rendered email cards within the Email tab

## Requirements

### Requirement 1: Cache Thread Grouping Results

**User Story:** As a user, I want the email thread grouping to be cached and only recomputed when email data actually changes, so that switching to the Email tab or re-rendering is near-instant when nothing has changed.

#### Acceptance Criteria

1. THE Thread_Cache SHALL store the output of Thread_Grouping along with the Fingerprint of the input email chits
2. WHEN `displayEmailView` is called, THE Thread_Cache SHALL return the cached thread array if the current Fingerprint matches the stored Fingerprint
3. WHEN the Fingerprint differs from the stored value, THE Thread_Cache SHALL recompute Thread_Grouping and update the stored result and Fingerprint
4. THE Fingerprint SHALL be derived deterministically from the set of email chit IDs, the total count of email chits, and the `email_read` and `archived` status of each email chit, such that identical inputs always produce an identical Fingerprint
5. WHEN a new chit is added to the Chits_Array, THE Fingerprint SHALL differ from the previously stored Fingerprint
6. WHEN a chit's `email_read` or `archived` status changes, THE Fingerprint SHALL differ from the previously stored Fingerprint
7. IF the Thread_Cache stores a thread array that is null or empty while the Chits_Array contains email chits, THEN THE Email_View SHALL discard the cached result and perform a full recomputation of Thread_Grouping
8. WHEN a chit's non-fingerprint fields change (title, notes, email_body, tags, or other fields not included in the Fingerprint derivation), THE Thread_Cache SHALL return the existing cached thread array without recomputation

### Requirement 2: Skip Full Re-fetch on Editor Return

**User Story:** As a user, I want returning from the chit editor to the Email tab to be instant, so that I do not have to wait for a full API re-fetch of all chits every time I view or edit a single email.

#### Acceptance Criteria

1. WHEN the user navigates back from the editor to the dashboard, THE Email_View SHALL read the edited chit ID from the navigation state and perform a Single_Chit_Refresh (a single `GET /api/chits/{id}` call) for that chit instead of a full `fetchChits()` call
2. WHEN the Single_Chit_Refresh response is received and the chit ID exists in the Chits_Array, THE Email_View SHALL replace the matching entry by ID with the updated data; IF the chit ID does not exist in the Chits_Array (newly created chit), THEN THE Email_View SHALL append the new chit to the Chits_Array
3. WHEN the Single_Chit_Refresh completes, THE Email_View SHALL call Display_Chits to re-render the view with the patched data
4. WHEN the page is loaded via a full browser refresh (F5 or address bar navigation) with no editor-return state present, THE Email_View SHALL perform a full `fetchChits()` call
5. WHEN a `chits_changed` WebSocket sync event was received while the user was in the editor, THE Email_View SHALL perform a full `fetchChits()` call instead of a Single_Chit_Refresh
6. IF the Single_Chit_Refresh API call returns a non-2xx response or a network error, THEN THE Email_View SHALL fall back to a full `fetchChits()` call
7. THE Email_View SHALL save the scroll position before navigating to the editor and restore it after the Single_Chit_Refresh completes and Display_Chits re-renders

### Requirement 3: Cache Rendered DOM

**User Story:** As a user, I want switching away from and back to the Email tab to be instant when no data has changed, so that I do not experience a blank screen and full DOM rebuild on every tab switch.

#### Acceptance Criteria

1. WHEN the user switches away from the Email tab, THE Email_View SHALL store the current scrollTop value of the Scroll_Container and detach the Scroll_Container into a DOM_Cache (DocumentFragment) instead of discarding it
2. WHEN the user switches back to the Email tab and the Fingerprint has not changed and the DOM_Cache is non-null, THE Email_View SHALL reattach the cached DOM_Cache to the container without rebuilding and restore the stored scrollTop value
3. WHEN the user switches back to the Email tab and the Fingerprint has changed, THE Email_View SHALL discard the DOM_Cache and rebuild the Scroll_Container via the standard render path (Progressive_Renderer for cold renders, full rebuild otherwise)
4. WHEN the Chits_Array is modified by a fetch, sync event, or Single_Chit_Refresh, THE Email_View SHALL set the DOM_Cache to null so that the next tab switch triggers a rebuild
5. IF the user switches to the Email tab and no DOM_Cache exists (first visit, post-invalidation, or post-Fingerprint change), THEN THE Email_View SHALL build the Scroll_Container from scratch via the standard render path
6. WHILE the DOM_Cache is detached, THE Email_View SHALL retain event listeners and interactive state (multi-select checkboxes, expanded threads) on the cached elements

### Requirement 4: Progressive Rendering

**User Story:** As a user, I want to see the first email threads immediately on cold load rather than staring at a blank screen, so that the Email tab feels responsive even when there are many threads to render.

#### Acceptance Criteria

1. WHEN the Email_View renders threads from scratch, THE Progressive_Renderer SHALL render the first 10 thread cards synchronously within 100 milliseconds of render initiation, filling the visible viewport area
2. WHEN the initial batch of 10 cards is rendered, THE Progressive_Renderer SHALL render remaining thread cards in chunks of 10 cards per `requestAnimationFrame` callback to allow browser paint between batches
3. WHILE progressive rendering is in progress, THE Email_View SHALL allow the user to scroll through and click/tap on already-rendered cards (including opening threads, selecting via multi-select, and expanding bundles)
4. THE Progressive_Renderer SHALL render all threads exactly once, producing the same final DOM state as if all threads had been rendered synchronously (no dropped or duplicated thread cards)
5. IF the user switches away from the Email tab during progressive rendering, THEN THE Progressive_Renderer SHALL cancel remaining render work and preserve all already-rendered cards in their current state
6. IF the total number of threads is 10 or fewer, THEN THE Progressive_Renderer SHALL render all threads in the initial synchronous batch without scheduling any additional animation frame work
7. THE Email_View SHALL not break existing email functionality including threading, bundles, multi-select, bulk actions, and account filters

### Requirement 5: Compatibility and Correctness

**User Story:** As a user, I want the performance optimizations to be invisible — existing email features must continue to work exactly as before.

#### Acceptance Criteria

1. THE Email_View SHALL produce identical thread groupings to the non-optimized Thread_Grouping algorithm — the same set of emails grouped into the same threads in the same order — using Message-ID, In-Reply-To, References, and subject fallback
2. THE Email_View SHALL display the correct filtered subset of email threads when any sub-filter is selected (inbox, sent, drafts, scheduled, trash, archived), matching the results that would be produced by a full recomputation from the Chits_Array
3. THE Email_View SHALL display only emails belonging to the selected account when account filtering by nickname is active
4. THE Email_View SHALL display only emails belonging to the selected bundle when bundle filtering is active
5. THE Email_View SHALL allow the user to select multiple email threads via checkboxes and execute bulk actions (archive, delete, mark read/unread) that update the correct chits in the Chits_Array and persist via API
6. WHEN a WebSocket sync patch is received, THE Email_View SHALL apply the patch to the Chits_Array, invalidate the Thread_Cache and DOM_Cache, and re-render the view reflecting the updated data
7. THE Email_View SHALL not introduce any new external dependencies beyond those already loaded by the dashboard
8. IF the Email_View serves data from any cache (Thread_Cache or DOM_Cache), THEN the displayed thread list SHALL be identical to what a full recomputation and re-render would produce for the current Chits_Array state
