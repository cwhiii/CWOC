# Implementation Plan

## Overview Past 2

This plan implements 25 missing/partial web functions for Android parity across search, filters, and Omni View. Tasks are ordered by dependency — data layer first, then domain logic, then UI integration.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Data Layer & Domain Utilities",
      "tasks": [1, 4, 7, 8, 10, 11, 12, 13],
      "description": "Independent foundation tasks — Room entity/DAO, snippet extractor, deduplication engine, custom filter parser, quick edit sheet, markdown link handling, collapse persistence, weather modal"
    },
    {
      "name": "Wave 2: ViewModel Integration",
      "tasks": [2, 5, 6, 9],
      "description": "Wire domain utilities into ViewModels — saved searches in SearchViewModel, snippets in search results, filter lock UI, deduplication in OmniViewViewModel"
    },
    {
      "name": "Wave 3: UI Layer",
      "tasks": [3],
      "description": "Final UI composables — saved search chips in SearchScreen"
    }
  ]
}
```

## Tasks

- [x] 1. Create SavedSearchEntity and DAO <!-- dep: none -->
  - [x] 1.1. Create `android/app/src/main/java/com/cwoc/app/data/local/entity/SavedSearchEntity.kt` with fields: `id` (Long, auto-generated PK), `query` (String), `createdAt` (String ISO datetime)
  - [x] 1.2. Create `android/app/src/main/java/com/cwoc/app/data/local/dao/SavedSearchDao.kt` with methods: `getAll(): Flow<List<SavedSearchEntity>>`, `insert(search: SavedSearchEntity)`, `delete(id: Long)`, `existsByQuery(query: String): Int`
  - [x] 1.3. Add `SavedSearchEntity` to the `@Database` entities array in `CwocDatabase.kt`
  - [x] 1.4. Add `abstract fun savedSearchDao(): SavedSearchDao` to `CwocDatabase`
  - [x] 1.5. Create a Room migration that creates the `saved_searches` table (increment database version)
  - [x] 1.6. Register the migration in `AppModule.provideCwocDatabase()` via `.addMigrations(...)`
  - [x] 1.7. Add `@Provides` for `SavedSearchDao` in `AppModule`
  - Requirements: 1

- [x] 2. Implement Saved Searches in SearchViewModel <!-- dep: 1 -->
  - [x] 2.1. Inject `SavedSearchDao` into `SearchViewModel`
  - [x] 2.2. Add `val savedSearches: StateFlow<List<SavedSearchEntity>>` collecting from `savedSearchDao.getAll()`
  - [x] 2.3. Add `fun saveCurrentSearch()` — validates query is non-blank, trims to 200 chars, checks `existsByQuery()` for duplicates, inserts with current ISO datetime
  - [x] 2.4. Add `fun deleteSavedSearch(id: Long)` — calls `savedSearchDao.delete(id)`
  - [x] 2.5. Add `fun applySavedSearch(query: String)` — sets `query.value = query` which triggers the debounced search
  - Requirements: 1

- [x] 3. Add Saved Search Chips UI to SearchScreen <!-- dep: 2 -->
  - [x] 3.1. In `SearchScreen.kt`, collect `viewModel.savedSearches` as state
  - [x] 3.2. When `query.isBlank()` (initial state), display saved search chips as a horizontal `LazyRow` of `FilterChip` composables above the search tips card
  - [x] 3.3. Also display saved search chips above results when query is active (between filter row and results)
  - [x] 3.4. On chip tap, call `viewModel.applySavedSearch(chip.query)`
  - [x] 3.5. On chip long-press, show a confirmation dialog asking to delete, then call `viewModel.deleteSavedSearch(chip.id)`
  - [x] 3.6. Add a "Save" icon button in the TopAppBar that calls `viewModel.saveCurrentSearch()` — disabled/hidden when query is blank
  - [x] 3.7. Show toast feedback on save success ("Search saved") and duplicate ("Already saved")
  - Requirements: 1

- [x] 4. Create SnippetExtractor Utility <!-- dep: none -->
  - [x] 4.1. Create `android/app/src/main/java/com/cwoc/app/domain/search/SnippetExtractor.kt`
  - [x] 4.2. Define `data class SearchSnippet(val fieldName: String, val snippet: String, val matchStart: Int, val matchEnd: Int)`
  - [x] 4.3. Implement `fun extractSnippets(chit: ChitEntity, searchTerms: List<String>, maxLength: Int = 50, contextBefore: Int = 15): List<SearchSnippet>`
  - [x] 4.4. For each searchable field (title, note, location, tags joined, people joined, checklist text, email subject/body/from/to), find first case-insensitive occurrence of any search term
  - [x] 4.5. Extract snippet window: center on match, ensure at least `contextBefore` chars before match start, total length ≤ `maxLength`
  - [x] 4.6. Prepend "…" if snippet doesn't start at field beginning, append "…" if doesn't end at field end
  - [x] 4.7. Return one SearchSnippet per matched field (skip fields with no match)
  - Requirements: 2

- [x] 5. Integrate Snippets into Search Results <!-- dep: 4 -->
  - [x] 5.1. Add `snippets: List<SearchSnippet>` field to the `SearchResult` data class in `SearchViewModel.kt`
  - [x] 5.2. In `performSearch()`, after computing `matchedFields` and `highlightRanges`, call `SnippetExtractor.extractSnippets(chit, queryTerms)` and include in the SearchResult
  - [x] 5.3. In `SearchScreen.kt` `SearchResultCard`, render snippet rows below the title: each snippet shows field label in small caps + snippet text with bold on the matched portion
  - [x] 5.4. Use `buildAnnotatedString` with `SpanStyle(fontWeight = FontWeight.Bold)` for the matched range within each snippet
  - [x] 5.5. Limit to showing max 3 snippet rows per card to avoid excessive height
  - Requirements: 2

- [x] 6. Add Omni Filter Lock Button to UI <!-- dep: none -->
  - [x] 6.1. In `OmniViewScreen.kt`, collect `filterSortViewModel.omniLockedFilters` and `filterSortViewModel.isOmniTabActive`
  - [x] 6.2. Add a lock/unlock IconButton to the Omni View header area (near the layout config button)
  - [x] 6.3. When `omniLockedFilters != null`, show filled lock icon with tint indicating active state
  - [x] 6.4. When `omniLockedFilters == null`, show open lock icon
  - [x] 6.5. On tap when unlocked: call `filterSortViewModel.lockOmniFilters()` and show toast "Filters locked"
  - [x] 6.6. On tap when locked: call `filterSortViewModel.unlockOmniFilters()` and show toast "Filters unlocked"
  - [x] 6.7. Show a subtle "Filters locked" indicator text below the toolbar when locked
  - Requirements: 3

- [x] 7. Implement Omni Section Deduplication Engine <!-- dep: none -->
  - [x] 7.1. Create `android/app/src/main/java/com/cwoc/app/domain/omni/OmniDeduplicationEngine.kt`
  - [x] 7.2. Define `data class DeduplicatedSections(val reminders, val email, val chrono, val onDeck, val soon, val pinnedNotes, val pinnedChecklists: List<ChitEntity>)`
  - [x] 7.3. Implement `fun deduplicate(activeChits, allChits, today, zone, now): DeduplicatedSections`
  - [x] 7.4. Process sections in priority order: Reminders → Email → Chrono → On Deck → Soon → Pinned Notes → Pinned Checklists
  - [x] 7.5. Maintain `placedIds: MutableSet<String>` — after each section filter, add placed chit IDs and exclude them from subsequent sections
  - [x] 7.6. Exclude completed (status = "Complete") and archived chits before processing
  - Requirements: 4

- [x] 8. Implement Custom View Filters (Per-Tab Defaults) <!-- dep: none -->
  - [x] 8.1. Create `android/app/src/main/java/com/cwoc/app/domain/filter/CustomViewFilterParser.kt`
  - [x] 8.2. Implement `fun parse(json: String?): Map<String, FilterState>` — parses the `custom_view_filters` JSON into a map keyed by tab name, returns empty map on null/blank/malformed input
  - [x] 8.3. Implement `fun parseTabFilters(json: String?, tabName: String): FilterState?` — convenience method for single tab lookup
  - [x] 8.4. In `FilterSortViewModel`, load `customViewFilters` from SettingsRepository on init and store parsed map
  - [x] 8.5. Modify `onTabChanged(tabRoute)` to call `applyCustomViewFilters(tabRoute)` which reads the parsed custom filters for that tab and applies them via `updateFilter()`
  - [x] 8.6. Modify `clearFilters()` to become tab-aware: if the current tab has custom defaults, reset to those defaults instead of empty FilterState
  - [x] 8.7. Handle gracefully: deleted tags, removed contacts, or other invalid filter references in the JSON (skip invalid values, apply valid ones)
  - Requirements: 5

- [x] 9. Integrate Deduplication into OmniViewViewModel <!-- dep: 7 -->
  - [x] 9.1. In `OmniViewViewModel.observeChits()`, replace the independent `filterXxx()` calls with a single `OmniDeduplicationEngine.deduplicate()` call
  - [x] 9.2. Assign the deduplication results to the respective StateFlows (`_chronoAnchored`, `_reminders`, `_onDeck`, `_soon`, `_pinnedNotes`, `_pinnedChecklists`, `_emailChits`)
  - [x] 9.3. Keep the existing filter logic as reference for the deduplication engine's per-section criteria (move filter logic into the engine or call existing filter methods from within it)
  - [x] 9.4. Verify that `_pinnedAll` and `_hstItems` remain independent (they are display-only overlays, not subject to deduplication)
  - Requirements: 4

- [x] 10. Add Quick Edit Status/Priority Dropdowns <!-- dep: none -->
  - [x] 10.1. Create or modify `android/app/src/main/java/com/cwoc/app/ui/components/QuickEditSheet.kt` as a ModalBottomSheet composable
  - [x] 10.2. Accept parameters: `chit: ChitEntity`, `onSave: (status: String?, priority: String?) -> Unit`, `onDismiss: () -> Unit`
  - [x] 10.3. Display chit title as header (read-only context)
  - [x] 10.4. Add Status dropdown (ExposedDropdownMenuBox) with options: "None", "ToDo", "In Progress", "Blocked", "Complete", "Rejected" — pre-selected to chit's current status
  - [x] 10.5. Add Priority dropdown with options: "None", "Low", "Medium", "High" — pre-selected to chit's current priority
  - [x] 10.6. Add "Save" button that calls `onSave` with the selected values (null for "None")
  - [x] 10.7. In the calling screen (wherever ChitActionMenu's `onQuickEdit` is handled), show QuickEditSheet, and on save: update chit via repository, trigger sync, refresh the list, show toast "Updated"
  - [x] 10.8. Handle save failure: show error toast, keep sheet open with selected values
  - Requirements: 6

- [x] 11. Add Chit Link Click Handling to MarkdownRenderer <!-- dep: none -->
  - [x] 11.1. Add `onChitLinkClick: ((String) -> Unit)? = null` parameter to `MarkdownRenderer` composable
  - [x] 11.2. In `parseInlineFormatting()`, when processing "chitlink" matches, push a string annotation with tag `"CHIT_LINK"` and the link title as the annotation value
  - [x] 11.3. In all `ClickableText` `onClick` handlers within `MarkdownRenderer`, add detection for `"CHIT_LINK"` annotations and call `onChitLinkClick?.invoke(title)` when tapped
  - [x] 11.4. In screens that use `MarkdownRenderer` (OmniViewScreen cards, NotesZone preview, SearchResultCard), pass an `onChitLinkClick` lambda that: looks up the chit by title via repository, navigates to editor if found, shows toast "Chit not found" if not found
  - [x] 11.5. For `[[]]` or whitespace-only patterns, render as plain text (no annotation, no click handler)
  - [x] 11.6. Ensure `[[title]]` inside code blocks/inline code are NOT processed (already handled by code span priority in parseInlineFormatting)
  - Requirements: 7

- [x] 12. Implement Omni Section Collapse Persistence <!-- dep: none -->
  - [x] 12.1. In `OmniViewViewModel`, add `private val _collapseStates = MutableStateFlow<Map<OmniSectionType, Boolean>>(emptyMap())` and expose as `val collapseStates: StateFlow`
  - [x] 12.2. Add `fun toggleSectionCollapse(type: OmniSectionType)` — toggles the boolean for that section, updates the map, persists to SharedPreferences key `omni_collapse_<sectionId>`
  - [x] 12.3. Add `private fun loadCollapseStates()` — reads all `omni_collapse_*` keys from SharedPreferences on init, defaults to `false` (expanded) for missing keys
  - [x] 12.4. Call `loadCollapseStates()` in the ViewModel's `init` block
  - [x] 12.5. In `OmniViewScreen.kt`, collect `viewModel.collapseStates` and pass collapsed state to each section header
  - [x] 12.6. Each section header gets a clickable expand/collapse icon (▼/▶) that calls `viewModel.toggleSectionCollapse(sectionType)`
  - [x] 12.7. When collapsed, hide the section's content (chit cards) but keep the header visible with item count badge
  - Requirements: 8

- [x] 13. Add HST Bar Weather Modal <!-- dep: none -->
  - [x] 13.1. In `OmniViewScreen.kt`, add a `var showWeatherModal by remember { mutableStateOf(false) }` state
  - [x] 13.2. Change the `OmniHstBar` `onBarClick` callback to set `showWeatherModal = true` instead of cycling HST mode (move mode cycling to a long-press or separate button)
  - [x] 13.3. Create a `WeatherInfoDialog` composable (AlertDialog) that displays: weather icon emoji, condition text, high/low temperature from `viewModel.weatherData`, and a "View Full Forecast" button
  - [x] 13.4. When weather data is null/unavailable, show "Weather data not available" message in the dialog
  - [x] 13.5. "View Full Forecast" button calls `onNavigateToWeather()` and dismisses the dialog
  - [x] 13.6. Dismiss on outside tap or back button press
  - Requirements: 9

## Notes

- Requirement 10 (Recent Tags) is already fully implemented by `RecentTagsManager` + `TagsPickerSheet`. No task needed — verified during context gathering.
- The Omni filter locking logic (Requirement 3) is already implemented in `FilterSortViewModel` — only the UI button/indicator is missing (Task 6).
- The `QuickEditSheet` may already exist in some form from the recurrence spec work — check before creating a new file. If it exists, add status/priority dropdowns to it.
- Room database version must be incremented exactly once for the `saved_searches` table migration (Task 1).
