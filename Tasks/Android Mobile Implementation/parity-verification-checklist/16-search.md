# Search

**Category:** Dashboard Views
**Item #:** 16
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-search.js` — Global search overlay

---

## Entry Point — `displaySearchView()`

- [ ] Clears `#chit-list` container
- [ ] Builds and renders: search bar, email filter, dropdown filters, hints, results container
- [ ] Auto-focuses search input (unless sidebar filter is focused)
- [ ] If existing results + query: re-renders results immediately

---

## Search Bar

- [ ] Input element: `id="global-search-input"`, `type="text"`
  - [ ] Placeholder: "Search all chits…"
  - [ ] Pre-filled with `_globalSearchQuery` if exists
- [ ] "Go" button: class `action-button`
  - [ ] Click: executes search
- [ ] Enter key: executes search
- [ ] Input event: debounced search (300ms) — search-as-you-type

---

## Email Filter Toggle (3-Value Pill)

- [ ] Container: class `global-search-email-filter`
- [ ] 3-value pill: `cwoc-2val-toggle cwoc-3val-toggle`, `id="search-email-pill"`
- [ ] Hidden input: `id="search-email-toggle"`, default value `"no_email"`
- [ ] Options:
  - [ ] `no_email` — "Exclude" (default, active)
  - [ ] `all` — "All"
  - [ ] `only_email` — "Only"
- [ ] Click handler: updates hidden value, toggles active class, re-renders results

---

## Dropdown Filters Row

- [ ] Container: class `global-search-filters-row`

### Status Dropdown
- [ ] `<select id="search-filter-status">`
- [ ] Options: Any, ToDo, In Progress, Blocked, Complete
- [ ] Change event: re-renders results

### Priority Dropdown
- [ ] `<select id="search-filter-priority">`
- [ ] Options: Any, Critical, High, Medium, Low
- [ ] Change event: re-renders results

### Tag Filter
- [ ] Wrapper: class `search-tag-filter-wrap`
- [ ] Button: class `action-button search-tag-filter-btn`, `id="search-tag-filter-btn"`
  - [ ] Icon: `fas fa-tag` + "Tags"
  - [ ] Shows count when tags selected: "Tags (N)"
- [ ] Dropdown: class `search-tag-filter-dropdown`, `id="search-tag-filter-dropdown"`
  - [ ] Initially hidden (`display: none`)
  - [ ] Click button: toggles dropdown visibility
  - [ ] Populates via `buildTagPicker(container, tags, { compact: true, onChange })`
  - [ ] Outside click: closes dropdown
- [ ] Tag filter state: `_searchFilterTags` array
  - [ ] Stored on `chitList._searchFilterTags` and `chitList._getSearchFilterTags()`
  - [ ] Changes trigger re-render of results

---

## Search Tips Hint

- [ ] Container: class `global-search-hint`
- [ ] Operators: `&&` (AND), `||` (OR), `!` (NOT), `()` (group), `#tag`, `field::value`
- [ ] Supported fields:
  - [ ] `title`, `note`, `location`, `status`, `priority`
  - [ ] `people`, `checklist`, `subject`, `sender`, `from`, `to`, `cc`, `bcc`, `body`
  - [ ] `child`, `due`, `start`, `end`, `assigned`
- [ ] Examples shown inline

---

## Search Execution — `executeSearch()`

- [ ] Reads query from input, trims
- [ ] Stores in `_globalSearchQuery`
- [ ] Empty query: clears results
- [ ] API call: `GET /api/chits/search?q=${encodeURIComponent(q)}`
- [ ] Stores results in `_globalSearchResults`
- [ ] Error handling: shows error message with ⚠ icon
- [ ] Calls `_renderSearchResults()` on success

---

## Results Rendering — `_renderSearchResults(container, viSettings)`

### Pre-Filtering
- [ ] Extracts chit objects from results (with `_matchedFields`, `_titleMatch`, `_score`)
- [ ] Applies sidebar multi-select filters via `_applyMultiSelectFilters()`
- [ ] Applies archive filter via `_applyArchiveFilter()`
- [ ] Applies email filter (no_email / all / only_email)
- [ ] Applies status dropdown filter
- [ ] Applies priority dropdown filter
- [ ] Applies tag picker filter (all selected tags must match)
  - [ ] Uses `matchesTagFilter()` for hierarchical tag matching
- [ ] Applies sidebar text filter (searches title, note, tags, status, people, location, priority)

### Empty State
- [ ] "No results found." centered message

### Sorting
- [ ] By relevance score descending (higher = better match)

### Result Card Rendering (per chit)
- [ ] Class: `chit-card global-search-result-card`
- [ ] `dataset.chitId`
- [ ] `applyChitColors()` with `chitColor(chit)`
- [ ] `archived-chit` class when archived
- [ ] `cursor: pointer`

#### Title Row
- [ ] Uses `_buildChitHeader(chit, titleHtml, viSettings)`
- [ ] Title highlighted with search terms via `_highlightMultiTerms()`

#### Matched Fields Display
- [ ] Container: class `global-search-matched-fields`
- [ ] For each matched field (excluding 'full_text'):
  - [ ] Field label (bold)
  - [ ] Snippet: extracted via `_getSearchSnippet()`, highlighted via `_highlightMultiTerms()`

#### Click Handler
- [ ] Calls `storePreviousState()`
- [ ] Navigates to `/frontend/html/editor.html?id=${chit.id}`

---

## Highlight Helpers

### `_extractHighlightTerms(query)`
- [ ] Thin wrapper around `cwocExtractSearchTerms(query)` from shared-utils.js

### `_highlightMultiTerms(text, terms)`
- [ ] Thin wrapper around `cwocHighlightTerms(text, terms)` from shared-utils.js

### `_getSearchSnippet(text, terms)`
- [ ] Extracts ~50 char snippet centered on first match
- [ ] Adds ellipsis (…) at start/end if truncated
- [ ] Falls back to first 50 chars if no match found

---

## Field Value Extraction — `_getChitFieldValue(chit, fieldName)`

- [ ] `title` → `chit.title`
- [ ] `note` → `chit.note`
- [ ] `tags` → comma-joined array
- [ ] `status` → `chit.status`
- [ ] `priority` → `chit.priority`
- [ ] `severity` → `chit.severity`
- [ ] `location` → `chit.location`
- [ ] `people` → comma-joined array
- [ ] `checklist` → comma-joined item texts
- [ ] `color` → `chit.color`
- [ ] `child_chits` → "(child chits)" if array exists
- [ ] `start_datetime` → raw ISO string
- [ ] `end_datetime` → raw ISO string
- [ ] `due_datetime` → raw ISO string
- [ ] `created_datetime` → raw ISO string
- [ ] `modified_datetime` → raw ISO string
- [ ] `alerts` → comma-joined alert descriptions/labels
- [ ] `email_from` → `chit.email_from`
- [ ] `email_subject` → `chit.email_subject`
- [ ] `email_body_text` → first 200 chars with ellipsis
- [ ] `email_to` → comma-joined array
- [ ] `email_cc` → comma-joined array
- [ ] `email_bcc` → comma-joined array
- [ ] `assigned_to` → `chit.assigned_to`
- [ ] Default: `String(chit[fieldName])` if not null

---

## Saved Searches

### `_saveSearch()`
- [ ] Reads sidebar `#search` input value
- [ ] Skips if empty or already saved
- [ ] Appends to `localStorage('cwoc_saved_searches')` JSON array
- [ ] Calls `_renderSavedSearches()`

### `_loadSavedSearch(text)`
- [ ] Sets sidebar `#search` input value
- [ ] Calls `searchChits()` to filter

### `_deleteSavedSearch(text)`
- [ ] Removes from localStorage array
- [ ] Calls `_renderSavedSearches()`

### `_renderSavedSearches()`
- [ ] Renders into `#saved-searches` container
- [ ] Each saved search as a chip:
  - [ ] Label (truncated to 15 chars) — click to load
  - [ ] ✕ delete button — click to remove
  - [ ] Styled: inline-flex, brown background, 0.75em font

---

## Global State

- [ ] `_globalSearchResults` — array of search result objects
- [ ] `_globalSearchQuery` — current search query string

---

## Integration with Main Views

### `highlightMatch(text, query)`
- [ ] Delegates to `cwocHighlightMatch(text, query)` from shared-utils.js
- [ ] HTML-escapes text, wraps matches in `<mark>` tags

### `searchChits()`
- [ ] Calls `displayChits()` (triggers re-render with current filters)

### Tab Switching
- [ ] Search is accessed as a special tab/view (not in C CAPTN tabs)
- [ ] Favicon: `/static/cwod_logo-favicon.png`
