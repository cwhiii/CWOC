# Implementation Plan: Global Chit Search

## Overview

Add a cross-category global search to the CWOC dashboard. Implement a backend search API endpoint (`GET /api/chits/search?q=...`) that performs case-insensitive substring matching across all chit fields, a new Search tab (magnifying glass icon, hotkey G) in the tab bar, a dedicated search view with input/Go button and highlighted result cards, and rename the sidebar "Search" label to "Filter by Words" (hotkey D). Sidebar filters remain functional during search.

## Tasks

- [x] 1. Implement the backend search API endpoint in `backend/main.py`
  - [x] 1.1 Add `GET /api/chits/search` endpoint
    - Accept query parameter `q` (string)
    - If `q` is missing or empty, return empty JSON array `[]`
    - Fetch all non-deleted chits from SQLite (reuse existing chit-fetching pattern)
    - Deserialize JSON fields (tags, people, checklist, alerts, recurrence_rule, recurrence_exceptions)
    - Perform case-insensitive substring matching of `q` against each searchable field
    - Searchable fields: title, note, tags (each tag name), status, priority, severity, location, people (each person), checklist items (each item text), start_datetime, end_datetime, due_datetime, created_datetime, modified_datetime, color, alert descriptions
    - For array fields, check each element individually
    - Return JSON array of `{"chit": {...}, "matched_fields": ["title", "note", ...]}` objects
    - Exclude soft-deleted chits (`deleted = true`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.2 Write property test for search completeness and soundness (Property 1)
    - **Property 1: Search completeness and soundness**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations)
    - Generate random chits with various field values, pick random substrings from field values
    - Verify the search endpoint returns the chit when searching for that substring
    - Verify every returned chit actually contains the query in at least one searchable field
    - **Validates: Requirements 3.1, 3.3, 3.4, 7.5**

  - [x] 1.3 Write property test for case-insensitive matching (Property 2)
    - **Property 2: Case-insensitive matching**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations)
    - Generate random query strings, verify same result set regardless of query case
    - **Validates: Requirements 3.2**

  - [x] 1.4 Write property test for matched_fields accuracy (Property 3)
    - **Property 3: matched_fields accuracy**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations)
    - Generate random chits and queries, verify `matched_fields` contains exactly the field names where the query appears as a case-insensitive substring
    - **Validates: Requirements 3.6, 7.2**

  - [x] 1.5 Write property test for deleted chits exclusion (Property 4)
    - **Property 4: Deleted chits exclusion**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations)
    - Generate chits with `deleted=true`, verify they never appear in search results
    - **Validates: Requirements 7.3**

- [x] 2. Checkpoint — Verify backend search API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add the Search tab and search view to the frontend
  - [x] 3.1 Add the Search tab HTML element to `frontend/index.html`
    - Append a new tab after the Notes tab in the `#cwoc-tabs` div
    - Use Font Awesome `fa-search` icon (magnifying glass)
    - Label: "Global Search"
    - `onclick`: `filterChits('Search')`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Add `displaySearchView()` function to `frontend/main.js`
    - Add state variables: `_globalSearchResults = []`, `_globalSearchQuery = ''`
    - Render a search bar area at the top of the chit list: text input (`#global-search-input`) + Go button, styled with CWOC parchment aesthetic
    - Auto-focus the search input when the view is first displayed
    - Enter key on input triggers search (same as Go button)
    - If input is empty, do not call API and show no results
    - On search: call `GET /api/chits/search?q=...`, store results in `_globalSearchResults`
    - Apply sidebar filters (`_applyMultiSelectFilters`, `_applyArchiveFilter`) to results before rendering
    - Render Result_Cards for each matching chit (see task 3.3)
    - Show empty-state message when no results found
    - Handle API errors gracefully with a user-visible message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.5, 4.1, 4.7, 5.1, 5.2, 5.3_

  - [x] 3.3 Implement Result_Card rendering and `highlightMatch()` function in `frontend/main.js`
    - `highlightMatch(text, query)`: HTML-escape text first, then wrap all case-insensitive occurrences of query in `<mark>` tags; return original text if query is empty
    - Each Result_Card displays: chit title (via `_buildChitHeader`), chit color as background, matched field names with highlighted excerpts
    - When a chit matches on multiple fields, display all matching fields
    - Click handler navigates to `/frontend/editor.html?id={chitId}`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.4 Write property test for highlight function preserves text (Property 5)
    - **Property 5: Highlight function preserves text**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations), or inline JS test
    - Generate random text and query strings, verify that stripping `<mark>` and `</mark>` tags from `highlightMatch` output equals the HTML-escaped original text
    - **Validates: Requirements 4.4**

- [x] 4. Wire Search tab into dashboard tab logic in `frontend/main.js`
  - [x] 4.1 Update `filterChits()` and `displayChits()` to handle the `'Search'` tab
    - When `currentTab === 'Search'`, call `displaySearchView()`
    - Hide Period selector and date navigation when Search tab is active (same as non-Calendar tabs)
    - Show Order controls in sidebar
    - Sidebar filters remain visible and functional
    - _Requirements: 1.3, 1.4, 1.5, 5.1, 5.2_

  - [x] 4.2 Add "G" hotkey binding for the Search tab
    - In the existing keydown handler, add "G" key (outside text inputs) to activate the Search tab via `filterChits('Search')`
    - _Requirements: 1.6_

  - [x] 4.3 Write property test for sidebar filter intersection (Property 6)
    - **Property 6: Sidebar filter intersection**
    - Use Python `unittest` with manual randomized data generation (min 100 iterations)
    - Generate random search results and filter configurations, verify displayed results equal the subset of search results that also satisfy all active sidebar filter criteria
    - **Validates: Requirements 5.2**

- [x] 5. Checkpoint — Verify search tab and view rendering
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Rename sidebar "Search" to "Filter by Words" and update hotkeys
  - [x] 6.1 Update sidebar label and hotkey hint in `frontend/index.html`
    - Change the filter-words label from "Search" to "Filter by Words"
    - Change the hotkey hint from "W" to "D"
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Update hotkey panel and reference overlay in `frontend/index.html`
    - In `#panel-filter`, change "Search Words" option label to "Filter by Words"
    - Update the reference overlay Filter section to show "D" key for "Filter by Words" instead of "W" for "Words"
    - _Requirements: 6.3, 6.5_

  - [x] 6.3 Update hotkey binding in `frontend/main.js`
    - In the filter submenu keydown handler, change the "W" key binding to "D" for focusing the Filter_By_Words_Input
    - _Requirements: 6.6_

  - [x] 6.4 Add search view CSS styles to `frontend/styles.css`
    - Style `#global-search-input` and Go button with CWOC parchment aesthetic
    - Style Result_Cards with matched field labels and `<mark>` highlight color
    - Style the search view container layout
    - _Requirements: 2.2, 2.3, 4.2, 4.4_

- [x] 7. Update help page and reference documentation
  - [x] 7.1 Update `frontend/help.html`
    - Add a new "Global Search" section documenting the Search tab, search view, result cards, and hotkey G
    - Update the "Filtering & Sorting" section to reference "Filter by Words" instead of "Search"
    - Update the "Keyboard Shortcuts" section: add G for Global Search, change W to D for Filter by Words in the filter submenu
    - _Requirements: 6.5_

  - [x] 7.2 Update the `VERSION` file with the current date/time stamp
    - Format: `YYYYMMDD.HHMM`

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Python's built-in `unittest` with manual randomized data generation — no external libraries (no hypothesis, no pip installs)
- No new database tables or columns are needed — the search operates on the existing `chits` table
- The sidebar Filter_By_Words_Input placeholder text remains "Filter Chits..." (unchanged)
