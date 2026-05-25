# Technical Design: Email View Performance

## Overview

This design introduces four layered performance optimizations to the Email tab on the CWOC dashboard. Each layer targets a different bottleneck in the current render pipeline:

1. **Thread Cache** — avoids recomputing `_emailGroupByThread()` when email data hasn't changed
2. **Editor Return Optimization** — patches a single chit instead of re-fetching all chits
3. **DOM Cache** — reattaches previously rendered email DOM instead of rebuilding
4. **Progressive Rendering** — renders visible threads first, rest async

All changes are confined to `main-email.js` and `main-init.js`. No backend changes. No new dependencies.

## Architecture

### Data Flow (Current)

```
Page Load → fetchChits() [ALL chits] → displayChits() → displayEmailView()
  → filter email chits
  → _emailGroupByThread(allEmailChits)  [O(n) threading]
  → _emailInjectNests(threads)
  → filter to visible threads
  → sort threads
  → build ALL cards synchronously
  → append to DOM
```

### Data Flow (Optimized)

```
Page Load (cold):
  fetchChits() → displayChits() → displayEmailView()
    → filter email chits
    → compute fingerprint → MISS → _emailGroupByThread() → store in cache
    → filter/sort visible threads
    → Progressive Render: first 10 sync, rest via rAF
    → store DOM in _emailDomCache

Editor Return (warm):
  _editorReturnPatch(chitId) → GET /api/chit/{id} → patch chits[] → invalidate caches
    → displayChits() → displayEmailView()
      → compute fingerprint → MISS (chit changed) → rethread → progressive render

Tab Switch Away:
  displayChits() for other tab → _emailDetachDom() saves scrollWrap + scrollTop

Tab Switch Back (no changes):
  displayEmailView()
    → compute fingerprint → MATCH → reattach _emailDomCache → restore scrollTop → done

Tab Switch Back (data changed):
  displayEmailView()
    → compute fingerprint → MISS → discard DOM cache → full render path
```

## Components and Interfaces

### Thread Cache Component

**Interface:**

- `_emailComputeFingerprint(emailChits)` → string — deterministic hash of email chit state
- `_emailInvalidateThreadCache()` → void — clears cached fingerprint forcing recomputation
- `_emailThreadCache` — module-level state object

**Behavior:**

In `displayEmailView()`, before calling `_emailGroupByThread()`:
1. Compute fingerprint of current email chits
2. Compare to stored fingerprint
3. On match: return cached threads
4. On miss: recompute, store result + fingerprint

### DOM Cache Component

**Interface:**

- `_emailDomCache` — module-level state object (dom, scrollTop, fingerprint, bundleToolbar)
- `_emailInvalidateDomCache()` → void — nulls the cached DOM
- `_emailDetachDom()` → void — called before container.innerHTML is cleared

**Behavior:**

In `displayEmailView()`, before any rendering:
1. Check if `_emailDomCache.dom` exists and fingerprint matches
2. On match: reattach DOM, restore scroll, return early
3. On miss: discard cache, proceed with normal render

### Progressive Renderer Component

**Interface:**

- `_emailRenderThreadsProgressively(scrollWrap, threads, viSettings, groupBy)` → void
- `_emailRenderRafId` — module-level rAF handle for cancellation

**Behavior:**

1. Render first 10 threads synchronously
2. Schedule remaining in chunks of 10 via `requestAnimationFrame`
3. Cancellable via `cancelAnimationFrame(_emailRenderRafId)`

### Editor Return Component

**Interface:**

- `cwoc_editor_return_chit_id` — localStorage key (set before navigating to editor)
- `cwoc_chits_snapshot` — sessionStorage key (serialized chits array)
- `cwoc_email_scroll_top` — localStorage key (scroll position)
- `cwoc_sync_occurred_during_edit` — localStorage key (set by WebSocket handler)

**Behavior:**

On DOMContentLoaded:
1. Check for editor return signal
2. If present and no sync occurred: restore chits from snapshot, fetch single chit, patch, render
3. Otherwise: normal `fetchChits()` flow

## Data Models

### _emailThreadCache

```javascript
{
    fingerprint: string | null,  // deterministic hash of email chit state
    threads: Array | null,       // output of _emailGroupByThread()
    allEmailChits: Array | null  // reference to input array
}
```

### _emailDomCache

```javascript
{
    dom: HTMLElement | null,      // detached .email-scroll-wrap element
    scrollTop: number,           // saved scroll position
    fingerprint: string | null,  // fingerprint at time of caching
    bundleToolbar: HTMLElement | null  // detached bundle toolbar
}
```

### Fingerprint Format

A pipe-delimited string: `count|id1+read+archived|id2+read+archived|...`

Example: `3|abc-123-10|def-456-01|ghi-789-11`

Where each segment after count is `chitId + emailReadBit + archivedBit`.

### localStorage/sessionStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `cwoc_editor_return_chit_id` | string (chit ID) | Signals editor return, identifies which chit to refresh |
| `cwoc_email_scroll_top` | string (integer) | Email scroll position to restore |
| `cwoc_sync_occurred_during_edit` | string ("1") | Flags that a sync event occurred while in editor |
| `cwoc_chits_snapshot` | string (JSON array) | Full chits array for instant restore on editor return |

## Error Handling

| Scenario | Handling |
|----------|----------|
| sessionStorage quota exceeded on chits snapshot | Catch error, skip snapshot — editor return will fall back to full fetchChits |
| Single-chit fetch returns 404 | Remove chit from array (it was deleted), invalidate caches, re-render |
| Single-chit fetch returns non-2xx or network error | Fall back to full fetchChits() |
| DOM cache reattach fails (element was garbage collected) | Set dom to null, proceed with normal render |
| Fingerprint computation on empty array | Returns "0" — always misses against any non-empty cache |
| Progressive render interrupted by tab switch | cancelAnimationFrame — partial DOM is valid and usable |

## Correctness Properties

### Property 1: Cache Coherence
Any mutation to the chits array (fetch, sync, patch) invalidates both thread cache and DOM cache. Stale data is never displayed.

**Validates: Requirements 1.7, 3.4, 5.8**

### Property 2: Fingerprint Determinism
Same input always produces same fingerprint. Different inputs always produce different fingerprints (within the tracked fields).

**Validates: Requirements 1.4, 1.5, 1.6**

### Property 3: Render Equivalence
The final DOM state after progressive rendering is identical to what synchronous rendering would produce.

**Validates: Requirements 4.4, 5.1**

### Property 4: Feature Preservation
All existing email features (threading, bundles, multi-select, bulk actions, account filters, sub-filters) continue to work identically.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

## Testing Strategy

Since this project does not use automated tests, verification is manual:

1. **Thread cache:** Toggle email read status, verify thread list updates. Switch tabs rapidly, verify no stale data.
2. **DOM cache:** Switch to Tasks tab and back to Email — should be instant with no flicker. Change a filter — should rebuild.
3. **Progressive render:** Load with 50+ emails, verify first batch appears immediately, rest fills in smoothly.
4. **Editor return:** Open an email, press back — should be instant. Edit an email (mark read), return — should show updated state. F5 refresh — should do full load.
5. **Sync:** Have another tab trigger a sync while on Email — verify data updates correctly.
