# Implementation Plan: Email View Performance

## Overview

Implement four layered performance optimizations for the Email tab: thread cache, DOM cache, progressive rendering, and editor return single-chit refresh. All changes are web-only, confined to `main-email.js` and `main-init.js`, with no backend changes and no new dependencies.

## Tasks

- [x] 1. Implement thread cache with fingerprint detection in `main-email.js`
  - Add `_emailThreadCache` state variable (fingerprint, threads, allEmailChits)
  - Implement `_emailComputeFingerprint(emailChits)` — builds deterministic string from count + IDs + email_read + archived
  - Implement `_emailInvalidateThreadCache()` helper
  - Modify `displayEmailView()` to check fingerprint before calling `_emailGroupByThread()` — use cached threads on match
  - Call `_emailInvalidateThreadCache()` in `fetchChits()` completion handler (main-init.js)
  - Call `_emailInvalidateThreadCache()` in `_syncPatchSingleChit()` after modifying chits array
  - Verify sub-filter switching still shows correct threads
  - Verify marking email read/unread triggers cache miss and re-threads correctly
  - **Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8

- [x] 2. Implement DOM cache for Email tab in `main-email.js` and `main-init.js`
  - Add `_emailDomCache` state variable (dom, scrollTop, fingerprint, bundleToolbar)
  - Add `_emailRenderRafId` variable for tracking in-progress progressive renders
  - In `displayChits()` (main-init.js), before clearing container, detect email view and detach `.email-scroll-wrap` + `.bundle-toolbar` into `_emailDomCache`
  - In `displayEmailView()`, after computing fingerprint, check DOM cache — if match, reattach and restore scrollTop, return early
  - Implement `_emailInvalidateDomCache()` helper
  - Call `_emailInvalidateDomCache()` in `fetchChits()` completion, `_syncPatchSingleChit()`, `_setEmailSubFilter()`, `_emailToggleAccountFilter()`, and `_setActiveBundle()`
  - Cancel any in-progress progressive render on tab switch away
  - Verify tab switch away and back shows email list instantly without flicker
  - Verify filter changes correctly discard DOM cache and rebuild
  - **Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

- [x] 3. Implement progressive rendering for email thread cards in `main-email.js`
  - Create `_emailRenderThreadsProgressively(scrollWrap, threads, viSettings, groupBy)` function
  - First batch (10 threads) renders synchronously in the function body
  - Remaining threads render in chunks of 10 via `requestAnimationFrame` callbacks
  - Store rAF ID in `_emailRenderRafId` for cancellation
  - If total threads ≤ 10, render all synchronously without scheduling rAF
  - Replace existing `threadsToRender.forEach(...)` loop in `displayEmailView()` with call to progressive renderer
  - Handle "Load More" pagination button — append after last progressive batch completes
  - Verify email list appears within ~100ms on cold load with 50+ threads
  - Verify scrolling and clicking cards works while remaining threads render
  - Verify tab switch during progressive render cancels cleanly
  - **Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

- [x] 4. Implement editor return single-chit refresh in `main-email.js` and `main-init.js`
  - In email card click handlers, before navigating to editor: save `cwoc_editor_return_chit_id` to localStorage, save email scroll position to `cwoc_email_scroll_top`, persist chits array to sessionStorage as `cwoc_chits_snapshot` (try/catch for quota)
  - In DOMContentLoaded handler (main-init.js), check for `cwoc_editor_return_chit_id`
  - If editor return and no `cwoc_sync_occurred_during_edit` flag: restore chits from snapshot, apply timezone conversions, fetch single chit via `GET /api/chit/{id}`
  - On response: patch into chits array, invalidate thread and DOM caches, call `displayChits()`
  - After render, restore email scroll position from `cwoc_email_scroll_top`
  - On fetch failure: fall back to full `fetchChits()`
  - If sync flag is set: clear flags and proceed with normal `fetchChits()`
  - Clean up all localStorage/sessionStorage keys after reading
  - Verify opening email and pressing back shows inbox instantly
  - Verify editing email and returning shows updated state
  - Verify F5 refresh still does full fetch
  - Verify sync event during edit triggers full fetch on return
  - **Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7

- [x] 5. Integration verification and edge case testing
  - Verify thread grouping produces identical results with cache enabled vs disabled
  - Verify all sub-filters work correctly with all caches active
  - Verify account filtering works with cached threads
  - Verify bundle filtering works with cached threads and DOM cache
  - Verify multi-select and bulk actions work after DOM cache reattach
  - Verify WebSocket sync patches invalidate caches and trigger correct re-render
  - Verify no new external dependencies introduced
  - Verify "Load More" pagination works with progressive rendering
  - Verify email compose from dashboard still works
  - Verify email send undo countdown still works on dashboard return
  - **Requirements:** 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4]},
    {"tasks": [5]}
  ]
}
```

## Notes

- All changes are web-only (vanilla JS). No backend modifications needed.
- No new external dependencies. No build step changes.
- The existing `_syncPatchSingleChit()` function in main-init.js already demonstrates the single-chit-fetch-and-patch pattern — Task 4 reuses this approach for editor return.
- sessionStorage is used for the chits snapshot because it's tab-scoped and auto-clears on tab close, preventing stale data accumulation.
- The fingerprint intentionally excludes fields like `title`, `note`, and `tags` — thread grouping only depends on message IDs and structure, while DOM cache validity depends on read/archived status (which affects visual state).
