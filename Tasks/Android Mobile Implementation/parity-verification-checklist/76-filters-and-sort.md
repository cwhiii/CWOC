# Filters & Sort (All Filter Types, Manual Drag Sort, Active Filter Badge)

**Category:** Cross-Cutting Behaviors
**Item #:** 76
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-sidebar.js`
- `src/frontend/js/dashboard/main-init.js`
- `src/frontend/js/shared/shared-sidebar.js`
- `src/frontend/js/shared/shared-sort.js`
- `src/frontend/js/shared/shared-tags.js`
- `src/frontend/css/dashboard/styles-sidebar.css`

## Functions, Buttons, Controls & Inputs

### Sort Functions

- [ ] `onSortSelectChange()` — Reads sort-select value, sets `currentSortField` and `currentSortDir`, updates UI, persists preference, re-renders
- [ ] `toggleSortDir()` — Toggles between 'asc' and 'desc', updates UI, persists preference, re-renders
- [ ] `_updateSortUI()` — Shows/hides direction button; sets ▲/▼ text and title; hides for manual/random/upcoming
- [ ] `_pickSort(field)` — Sets sort field directly (used by hotkeys), updates select, persists, re-renders
- [ ] `_applySort(chitList)` — Applies current sort to chit array; handles all sort modes
- [ ] `saveSortPreference(tab, field, dir)` — Persists sort preference per tab (from shared-sort.js)
- [ ] `getSortPreference(tab)` — Retrieves saved sort preference for a tab

### Sort Modes

- [ ] "None" (empty) — No sort applied, uses view's default ordering
- [ ] "Title" — Alphabetical by title (case-insensitive), nulls last
- [ ] "Start Date" — By start_datetime, nulls last
- [ ] "Due Date" — By due_datetime, nulls last
- [ ] "Updated" — By modified_datetime, nulls last
- [ ] "Created" — By created_datetime, nulls last
- [ ] "Status" — By status order: ToDo=1, In Progress=2, Blocked=3, Complete=4, Rejected=5
- [ ] "Manual" — User-defined drag order via `applyManualOrder(tab, chitList)`
- [ ] "Random / Shuffle" — Fisher-Yates shuffle
- [ ] "Upcoming (Due Soon)" — By nearest due/start date; completed/rejected at bottom

### Manual Drag Sort

- [ ] `enableDragToReorder(container, tab, onReorder, longPressMap)` — Enables drag-to-reorder on mobile (flat list)
- [ ] `enableNotesDragReorder(container, tab, onReorder)` — Enables masonry-aware drag on desktop
- [ ] `getManualOrder(tab)` — Retrieves saved manual order from localStorage
- [ ] `applyManualOrder(tab, chitList)` — Reorders chit array based on saved manual order
- [ ] Column assignment persistence — Saves `{ id, col }` entries for masonry views

### Filter Change Handlers

- [ ] `onFilterChange()` — Triggers `displayChits()` and `_updateClearFiltersButton()`
- [ ] `onFilterAnyToggle(anyCb)` — When "Any" is checked, unchecks all specific options in that group
- [ ] `onFilterSpecificToggle(filterType)` — When a specific option is checked, unchecks "Any"; if all unchecked, re-checks "Any"
- [ ] `clearFilterGroup(containerId)` — Clears all checkboxes in a filter group, re-checks "Any"
- [ ] `_filterTagCheckboxes()` — Filters tag checkboxes by search query in the tag filter search input

### Clear & Reset Functions

- [ ] `_clearAllFilters()` — Resets to custom view defaults (if exist) or system defaults; persists sort preference
- [ ] `_applySystemDefaults()` — Resets ALL filter UI to hardcoded baseline defaults
- [ ] `_applyFilterStateToSidebar(state)` — Applies a saved filter state object to all sidebar UI elements
- [ ] `_applyCustomViewFilters(tab)` — Applies custom view filters for a tab on entry (from settings)
- [ ] `_resetDefaultFilters()` — Resets search to the default filter for the current tab
- [ ] `_updateClearFiltersButton()` — Shows/hides "Defaults" button based on whether tab has custom/legacy defaults

### Filter Value Getters

- [ ] `_getSelectedFilterValues(containerId, filterType)` — Generic getter for checked checkbox values
- [ ] `_getSelectedStatuses()` — Returns array of checked status values
- [ ] `_getSelectedLabels()` — Returns `_sidebarTagSelection` array (tag names)
- [ ] `_getSelectedPriorities()` — Returns array of checked priority values

### Multi-Select Filter Application

- [ ] `_applyMultiSelectFilters(chitList)` — Applies all active filters to chit array:
  - [ ] Status filter — includes only chits matching selected statuses
  - [ ] Tag filter — via `cwocChitPassesTagFilter(chit.tags)`
  - [ ] Priority filter — includes only chits matching selected priorities
  - [ ] People filter — includes chits where `chit.people` contains any selected person
  - [ ] Sharing filter (shared-with-me) — `_shared === true && owner_id !== currentUserId`
  - [ ] Sharing filter (shared-by-me) — `owner_id === currentUserId && shares.length > 0`
  - [ ] Project filter (__any__) — only chits in any project's child_chits
  - [ ] Project filter (__none__) — only chits NOT in any project
  - [ ] Project filter (specific ID) — only children of selected project + the project itself

### Archive/Display Filter

- [ ] `_applyArchiveFilter(chitList)` — Filters by pinned/archived/unmarked toggle states
- [ ] Snooze filter — Hides snoozed chits unless "show snoozed" is checked
- [ ] Past-due filter — Hides/shows past-due items based on checkbox
- [ ] Complete filter — Hides/shows completed items
- [ ] Declined filter — Hides/shows declined shared chits
- [ ] Habits filter — Hides/shows habit chits
- [ ] Email received filter — Shows/hides received emails
- [ ] Email sent filter — Shows/hides sent emails

### Archive/Pinned Hotkey Toggles

- [ ] `_toggleFilterArchived()` — Toggles show-archived checkbox, triggers filter change, exits hotkey mode
- [ ] `_toggleFilterPinned()` — Toggles show-pinned checkbox, triggers filter change, exits hotkey mode
- [ ] `_filterFocusSearch()` — Exits hotkey mode, expands filters section, focuses search input

### Tag Filter Panel

- [ ] `_buildTagFilterPanel()` — Builds tag filter using `CwocSidebarFilter` component with search, favorites-first, colored badges
- [ ] `_syncSidebarTagCheckboxes(container, tagObjects)` — Syncs hidden checkboxes with `_sidebarTagSelection` array
- [ ] `_loadLabelFilters()` — Loads/refreshes tag filter panel (called on tab switch)
- [ ] `cwocClearTagFilter()` — Clears tag selection (from shared-tags.js)
- [ ] `cwocChitPassesTagFilter(tags)` — Checks if a chit's tags pass the current tag filter
- [ ] `_cwocUpdateTagVirtualOptions()` — Updates virtual tag options after selection change
- [ ] Tag search input — Filters visible tags in the panel
- [ ] Tag color badges — Colored circles next to tag names
- [ ] Favorite tags — Sorted to top of list

### People Filter Panel

- [ ] `_buildPeopleFilterPanel()` — Fetches contacts + system users, renders chip-based filter
- [ ] `_renderPeopleFilterPanel(contacts)` — Renders people chips into both sidebar and hotkey panel containers
- [ ] `_renderPeopleChipFilter(containerId, contacts, users, selection)` — Builds chip UI with search, avatars, selection state
- [ ] `clearPeopleFilter()` — Clears people selection, re-renders panel
- [ ] People search input — Filters visible people chips by name
- [ ] People chip — Colored chip with avatar thumbnail, name, favorite star; click toggles selection
- [ ] User chip (`.cwoc-sidebar-user-chip`) — Thicker dark border to distinguish from contacts
- [ ] Selected chip — Bold text, outline highlight
- [ ] Unselected chip — Reduced opacity (0.7)
- [ ] Visibility change listener — Re-fetches people filter when returning from another page

### Project Filter

- [ ] `_populateProjectFilter()` — Populates project dropdown with current project masters (alphabetical)
- [ ] `_onProjectFilterChange()` — Triggers filter change when project dropdown changes
- [ ] `_clearProjectFilter(silent)` — Resets project dropdown to empty
- [ ] `_getSelectedProjectId()` — Returns currently selected project ID or empty string
- [ ] Project dropdown options: "—" (none), "Any (has a project)", "None (no project)", + dynamic project list

### Active Filter Badge / Clear All Button

- [ ] `_updateClearAllButton()` — Checks all possible non-default filter states and shows/hides the "Clear" button
- [ ] Checks: status filter, priority filter, search text, tag filter, people filter, display toggles, sharing filters, sort field, project filter
- [ ] "Clear" button (`#sidebar-clear-all-btn`) — Visible only when any filter is active
- [ ] "Defaults" button (`#reset-defaults-btn`) — Visible only when tab has custom/legacy defaults

### Custom View Filters (Per-Tab Saved Filters)

- [ ] `_customViewFilters` global — Object mapping tab names to saved filter state objects
- [ ] Filter state structure: `{ statuses, priorities, tags, people, text, display, sort, project }`
- [ ] Display sub-object: `{ pinned, archived, snoozed, unmarked, pastDue, complete, declined, habits, emailReceived, emailSent, sharedWithMe, sharedByMe }`
- [ ] Sort sub-object: `{ field, dir }`

### Text Search Filter

- [ ] Search input (`#search`) — Free-text filter; `onkeyup` triggers `searchChits()`
- [ ] `chitMatchesSearch(chit, searchText)` — Checks if chit matches search text across title, note, tags, people, location, status
- [ ] Saved searches container (`#saved-searches`) — Quick-access saved search buttons
