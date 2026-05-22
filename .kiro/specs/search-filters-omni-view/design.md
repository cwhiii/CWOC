# Design Document

## Overview

This design covers the implementation of 25 missing/partial web functions for Android parity across saved searches, search result snippets, Omni View filter locking, section deduplication, custom view filters, quick edit enhancements, chit link resolution, section collapse persistence, and HST bar interactions.

The existing Android infrastructure provides strong foundations: `SearchViewModel` with boolean search parsing and field-level matching; `OmniViewViewModel` with section-based layout and weather data; `FilterSortViewModel` with Omni locked filter logic already implemented; `MarkdownRenderer` with `[[title]]` pattern detection (visual only, no click handling); `RecentTagsManager` with MRU tracking and persistence; and `ChitActionMenu` with an existing `onQuickEdit` callback.

Several features are partially implemented — the data models and some UI exist but key behaviors are missing: search has no saved queries or snippets, Omni View has no deduplication or collapse persistence, filter locking has backend logic but no UI, and `[[title]]` links render visually but aren't clickable.

## Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer (Compose)                           │
├─────────────────────────────────────────────────────────────────────┤
│ SearchScreen                                                         │
│   ├── SavedSearchChips (Req 1 - LazyRow of FilterChips)             │
│   ├── SnippetResultCards (Req 2 - field-labeled snippet rows)       │
│   └── SaveSearchAction (Req 1 - icon button in TopAppBar)           │
│                                                                      │
│ OmniViewScreen                                                       │
│   ├── FilterLockButton (Req 3 - 🔒/🔓 toggle)                      │
│   ├── CollapsibleSectionHeaders (Req 8 - ▼/▶ with persistence)     │
│   └── WeatherInfoDialog (Req 9 - on HST bar tap)                    │
│                                                                      │
│ QuickEditSheet (Req 6 - status/priority dropdowns)                  │
│ MarkdownRenderer (Req 7 - chit link click handling)                 │
├─────────────────────────────────────────────────────────────────────┤
│                       ViewModel Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│ SearchViewModel                                                      │
│   ├── savedSearches: StateFlow<List<SavedSearchEntity>>             │
│   ├── saveCurrentSearch() / deleteSavedSearch() / applySavedSearch()│
│   └── snippets integrated into SearchResult                          │
│                                                                      │
│ OmniViewViewModel                                                    │
│   ├── collapseStates: StateFlow<Map<OmniSectionType, Boolean>>      │
│   ├── toggleSectionCollapse(type)                                    │
│   └── observeChits() → OmniDeduplicationEngine.deduplicate()        │
│                                                                      │
│ FilterSortViewModel (already has lock/unlock logic)                  │
│   ├── applyCustomViewFilters(tabRoute) — NEW                        │
│   └── resetFilters() — modified to use tab defaults                  │
├─────────────────────────────────────────────────────────────────────┤
│                       Domain Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│ SnippetExtractor — pure snippet extraction from chit fields          │
│ OmniDeduplicationEngine — priority-ordered section assignment        │
│ CustomViewFilterParser — JSON → Map<String, FilterState>             │
├─────────────────────────────────────────────────────────────────────┤
│                       Data Layer                                      │
├─────────────────────────────────────────────────────────────────────┤
│ SavedSearchEntity + SavedSearchDao — Room persistence                │
│ SharedPreferences — omni collapse states                             │
│ SettingsRepository — customViewFilters, omniLockedFilters            │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

- **SavedSearchEntity** (`data/local/entity/SavedSearchEntity.kt`) — Room entity with `id` (Long PK auto-gen), `query` (String), `createdAt` (String ISO datetime).
- **SavedSearchDao** (`data/local/dao/SavedSearchDao.kt`) — Room DAO with `getAll(): Flow<List<SavedSearchEntity>>`, `insert()`, `delete()`, `existsByQuery(): Int`.
- **SnippetExtractor** (`domain/search/SnippetExtractor.kt`) — Pure utility object with `extractSnippets(chit, searchTerms, maxLength, contextBefore): List<SearchSnippet>`.
- **OmniDeduplicationEngine** (`domain/omni/OmniDeduplicationEngine.kt`) — Pure utility object with `deduplicate(activeChits, allChits, today, zone, now): DeduplicatedSections`.
- **CustomViewFilterParser** (`domain/filter/CustomViewFilterParser.kt`) — Pure utility object with `parse(json): Map<String, FilterState>` and `parseTabFilters(json, tabName): FilterState?`.
- **QuickEditSheet** (`ui/components/QuickEditSheet.kt`) — ModalBottomSheet composable with status/priority dropdowns and save/cancel buttons.
- **WeatherInfoDialog** — Dialog composable showing weather summary on HST bar tap.

### Modified Interfaces

- **SearchViewModel** — New state: `savedSearches`. New methods: `saveCurrentSearch()`, `deleteSavedSearch(id)`, `applySavedSearch(query)`. Modified: `SearchResult` gains `snippets` field.
- **OmniViewViewModel** — New state: `collapseStates`. New methods: `toggleSectionCollapse(type)`, `loadCollapseStates()`. Modified: `observeChits()` uses deduplication engine.
- **FilterSortViewModel** — New method: `applyCustomViewFilters(tabRoute)`. Modified: `clearFilters()` becomes tab-aware, `onTabChanged()` applies custom defaults.
- **MarkdownRenderer** — New parameter: `onChitLinkClick: ((String) -> Unit)?`. Modified: `parseInlineFormatting()` adds CHIT_LINK annotations.
- **CwocDatabase** — New entity: `SavedSearchEntity`. New DAO: `SavedSearchDao`. New migration for `saved_searches` table.

## Data Models

### SavedSearchEntity
```kotlin
@Entity(tableName = "saved_searches")
data class SavedSearchEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val query: String,
    val createdAt: String
)
```

### SearchSnippet
```kotlin
data class SearchSnippet(
    val fieldName: String,    // "title", "note", "location", etc.
    val snippet: String,      // "…prefix MATCH suffix…"
    val matchStart: Int,      // offset of match within snippet
    val matchEnd: Int         // end offset of match within snippet
)
```

### DeduplicatedSections
```kotlin
data class DeduplicatedSections(
    val reminders: List<ChitEntity>,
    val email: List<ChitEntity>,
    val chrono: List<ChitEntity>,
    val onDeck: List<ChitEntity>,
    val soon: List<ChitEntity>,
    val pinnedNotes: List<ChitEntity>,
    val pinnedChecklists: List<ChitEntity>
)
```

### Existing Models (No Changes)
- `ChitEntity` — already has all required fields for search, filtering, and section assignment
- `SettingsEntity` — already has `omniLockedFilters`, `customViewFilters`, `recentTags`, `omniLayout`
- `FilterState` — already has all filter dimensions needed for custom view filters
- `OmniLockedFilters` — already defined in FilterSortViewModel
- `SearchResult` — extended with `snippets` field (additive change)

## Error Handling

- **Saved search duplicate:** Show toast "Already saved" — no crash, no error state.
- **Malformed customViewFilters JSON:** Fall back to empty map (no custom filters for any tab). Log parse error.
- **Malformed omniLockedFilters JSON:** Treat as empty (no locked filters). Already handled in FilterSortViewModel.
- **Chit link not found:** Show toast "Chit not found" when user taps an unresolvable `[[title]]` link.
- **Quick edit save failure:** Show error toast, keep sheet open with user's selections for retry.
- **SharedPreferences write failure (collapse state):** Retain visual state in current session without reverting.
- **Room migration failure:** Standard Room fallback — destructive migration would lose saved searches only (not critical data).

## Testing Strategy

Tests are optional per project rules. No test-writing tasks are included. The implementation can be verified manually by:
1. Saving/loading/deleting search queries
2. Observing snippet highlights in search results
3. Locking/unlocking Omni filters and verifying persistence across app restarts
4. Confirming no duplicate chits appear across Omni sections
5. Switching tabs and verifying custom filter defaults apply
6. Long-pressing a chit and changing status/priority via Quick Edit
7. Tapping `[[title]]` links in rendered markdown and verifying navigation
8. Collapsing Omni sections, restarting app, verifying state persists
9. Tapping HST bar and seeing weather modal
