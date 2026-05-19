# Design Document

## Overview

This design replaces the existing `FilterPanel.kt` with a new implementation that achieves exact visual and functional parity with the mobile web sidebar filter panel. The architecture leverages the existing `FilterState` data class, `FilterSortViewModel`, `CollapsibleSection` composable, and `SettingsRepository` (for tags). The new panel is composed of modular sub-composables for each filter group, all styled with parchment theme colors.

## Architecture

```
SidebarContent
└── CollapsibleSection("🔍 Filters") ← already exists in SidebarContent.kt
    └── FilterPanel (rewritten)
        ├── FilterHeaderButtons (Clear ✕ + Defaults ↺)
        ├── FilterTextSection (always visible, not collapsible)
        ├── CollapsibleSection("Status")
        │   └── AnyToggleCheckboxGroup
        ├── CollapsibleSection("Priority")
        │   └── AnyToggleCheckboxGroup
        ├── CollapsibleSection("Tags")
        │   └── TagTreeFilter
        ├── CollapsibleSection("People")
        │   └── PeopleChipFilter
        ├── CollapsibleSection("Project")
        │   └── ProjectFilterDropdown
        └── CollapsibleSection("Display")
            └── DisplayToggleCheckboxes
```

### Data Flow

```
FilterSortViewModel (activity-scoped)
    │
    ├── filterState: StateFlow<FilterState>  ← single source of truth
    │       ↕ collected by FilterPanel composable
    │
    ├── updateFilter(FilterState)  ← called on every filter change
    │       → triggers recomposition of chit list screens
    │
    └── clearFilters()  ← resets to FilterState() defaults
```

## Components and Interfaces

### FilterPanel.kt (Rewritten)

```kotlin
@Composable
fun FilterPanel(
    filterState: FilterState,
    onFilterStateChanged: (FilterState) -> Unit,
    availableTags: List<TagItem>,
    availablePeople: List<PersonItem>,
    availableProjects: List<ProjectItem>,
    savedSearches: List<String>,
    onSavedSearchDelete: (String) -> Unit,
    currentTab: String?,
    hasCustomDefaults: Boolean,
    onClearAll: () -> Unit,
    onApplyDefaults: () -> Unit,
    modifier: Modifier = Modifier
)
```

Orchestrates all sub-group composables in the correct order. Passes filter state slices to each sub-group. Constructs updated `FilterState` on each change and calls `onFilterStateChanged`.

### AnyToggleCheckboxGroup

```kotlin
@Composable
fun AnyToggleCheckboxGroup(
    options: List<String>,
    selectedOptions: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit
)
```

Renders "— Any" checkbox (checked when `selectedOptions` is empty). Implements mutual exclusion: tapping "— Any" clears all; tapping specific removes "— Any"; when last specific unchecked, reverts to "— Any". "— Any" cannot be directly unchecked. FilterClearButton at bottom.

### TagTreeFilter

```kotlin
@Composable
fun TagTreeFilter(
    tags: List<TagItem>,
    selectedTags: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit
)
```

"Select All / Select None" toggle button. Search input filters by substring. Hierarchical tree with expand/collapse. Colored badges, favorites first. Tap toggles selection. Empty selection = show all.

### PeopleChipFilter

```kotlin
@Composable
fun PeopleChipFilter(
    people: List<PersonItem>,
    selectedPeople: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit
)
```

Search input. Chips in vertical Column. Each chip: circular image (18dp) + name + ★. Background = person's color. System users: 2dp dark border. Selected: outline + bold + full opacity. Unselected: 0.7 alpha. Sorted favorites-first.

### ProjectFilterDropdown

```kotlin
@Composable
fun ProjectFilterDropdown(
    projects: List<ProjectItem>,
    selectedProjectId: String?,
    onSelectionChanged: (String?) -> Unit,
    onClear: () -> Unit
)
```

ExposedDropdownMenuBox with static options (—, Any, None) + dynamic project titles sorted alphabetically.

### DisplayToggleCheckboxes

```kotlin
@Composable
fun DisplayToggleCheckboxes(
    filterState: FilterState,
    onFilterStateChanged: (FilterState) -> Unit
)
```

ParchmentCheckbox rows with emoji labels. Three groups separated by dashed dividers. Each toggle immediately updates FilterState.

### FilterTextSection

```kotlin
@Composable
fun FilterTextSection(
    searchText: String,
    onSearchTextChanged: (String) -> Unit,
    savedSearches: List<String>,
    onSavedSearchTap: (String) -> Unit,
    onSavedSearchDelete: (String) -> Unit
)
```

OutlinedTextField with 300ms debounce. Saved search chips in FlowRow (truncated 15 chars). Hidden when empty.

### FilterHeaderButtons

```kotlin
@Composable
fun FilterHeaderButtons(
    showClear: Boolean,
    showDefaults: Boolean,
    onClear: () -> Unit,
    onDefaults: () -> Unit
)
```

Rendered via CollapsibleSection's `headerExtra` parameter. "Clear" visible when activeFilterCount > 0. "Defaults" visible when tab has custom defaults.

### ParchmentCheckbox

```kotlin
@Composable
fun ParchmentCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    modifier: Modifier = Modifier
)
```

Unchecked: parchment fill + brown border. Checked: brown fill + parchment checkmark. Row: Checkbox + Spacer(4.dp) + Text(Lora, #4a2c2a, 13.sp).

### FilterClearButton

```kotlin
@Composable
fun FilterClearButton(onClick: () -> Unit)
```

Small OutlinedButton: 1dp border (#6b4e31 at 30% alpha), 3dp corners, "Clear" 11.sp #6b4e31, transparent bg.

## Data Models

### TagItem

```kotlin
data class TagItem(
    val name: String,       // full path e.g. "Work/Projects/CWOC"
    val color: String?,     // hex color or null
    val favorite: Boolean
)
```

### TagTreeNode

```kotlin
data class TagTreeNode(
    val name: String,           // leaf segment (e.g., "CWOC")
    val fullPath: String,       // full path (e.g., "Work/Projects/CWOC")
    val color: String?,
    val favorite: Boolean,
    val children: List<TagTreeNode>
)
```

Built from flat TagItem list by splitting on "/" and recursively grouping. Sorted at each level: favorites first, then alphabetical.

### PersonItem

```kotlin
data class PersonItem(
    val name: String,           // display name
    val color: String?,         // hex color
    val imageUrl: String?,      // profile image URL
    val favorite: Boolean,
    val prefix: String?,        // name prefix to strip from display
    val isSystemUser: Boolean   // true = thicker border
)
```

Built from ContactEntity list + system users. Contacts sorted favorites-first then alphabetical, users appended alphabetically, deduplicated by name.

### ProjectItem

```kotlin
data class ProjectItem(
    val id: String,
    val title: String       // "(Untitled Project)" if blank
)
```

Built from chits where `isProjectMaster == true && !deleted`, sorted alphabetically by title.

### FilterState (existing, unchanged)

Already contains all needed fields: `statuses`, `priorities`, `tags`, `people`, `showPinned`, `showArchived`, `showSnoozed`, `showUnmarked`, `showPastDue`, `showComplete`, `showDeclined`, `showHabits`, `showEmailReceived`, `showEmailSent`, `sharedWithMe`, `sharedByMe`, `colors`, `dateRangeStart`, `dateRangeEnd`, `searchText`, `projectFilter`, `tagMatchMode`, `activeFilterCount`.

### Color Constants

```kotlin
private val ParchmentBg = Color(0xFFFFFAF0)
private val ParchmentLight = Color(0xFFF5E6CC)
private val BrownBorder = Color(0xFF6B4E31)
private val BrownPrimary = Color(0xFF8B5A2B)
private val BrownText = Color(0xFF4A2C2A)
private val BrownDark = Color(0xFF3B1F0A)
private val HeaderBrown = Color(0xFF4A3728)
private val DarkestBrown = Color(0xFF1A1208)
private val DefaultChipColor = Color(0xFFD2B48C)
private val SelectedOutline = Color(0xFF4A2C2A)
```

### Utility Functions

```kotlin
fun generatePastelColor(name: String): Color {
    val hash = name.hashCode()
    val hue = (hash and 0x7FFFFFFF) % 360
    return Color.hsl(hue.toFloat(), 0.4f, 0.8f)
}

fun isLightColor(color: Color): Boolean {
    val luminance = (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue)
    return luminance > 0.5
}
```

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `ui/navigation/FilterPanel.kt` | **Rewrite** | Complete replacement with web-parity implementation |
| `ui/navigation/filter/FilterColors.kt` | **New** | Color constants + utility functions |
| `ui/navigation/filter/ParchmentCheckbox.kt` | **New** | Custom-styled checkbox |
| `ui/navigation/filter/FilterClearButton.kt` | **New** | Per-group clear button |
| `ui/navigation/filter/AnyToggleCheckboxGroup.kt` | **New** | Status/Priority checkbox group |
| `ui/navigation/filter/TagTreeFilter.kt` | **New** | Tag tree with hierarchy/colors/search |
| `ui/navigation/filter/PeopleChipFilter.kt` | **New** | People chips with images/colors |
| `ui/navigation/filter/ProjectFilterDropdown.kt` | **New** | Project dropdown |
| `ui/navigation/filter/DisplayToggleCheckboxes.kt` | **New** | Display toggle checkboxes |
| `ui/navigation/filter/FilterTextSection.kt` | **New** | Search + saved searches |
| `ui/navigation/filter/FilterHeaderButtons.kt` | **New** | Clear/Defaults header buttons |
| `MainActivity.kt` | **Modify** | Pass filterContent lambda to SidebarContent |
| `SidebarContent.kt` | **Modify** | Pass headerExtra to Filters CollapsibleSection |

## Error Handling

- If tags JSON parsing fails (malformed `sharedTags`), display empty tag list with no error UI
- If contact image URL fails to load (Coil), show placeholder (? circle for contacts, user icon for system users)
- If API call for contacts/users fails, show "No contacts or users" message
- If project list is empty, show only the three static dropdown options (—, Any, None)
- All filter state changes are in-memory; no persistence failures possible

## Testing Strategy

Tests are optional per project rules. The implementation can be verified by:
1. Visual comparison against the mobile web sidebar on the same device
2. Functional verification: toggle each filter type and confirm chit list updates immediately
3. Edge cases: empty tag list, no contacts, no projects, all filters active then Clear

## Correctness Properties

### Property 1: Single Source of Truth
FilterState is the single source of truth — UI always reflects current FilterState. No local component state diverges from the ViewModel's StateFlow.

**Validates: Requirements 11.1, 11.3**

### Property 2: Empty Set Semantics
Empty sets in FilterState mean "no filtering" (show all) for that dimension. This applies to statuses, priorities, tags, and people.

**Validates: Requirements 3.2, 4.2, 5.8**

### Property 3: Immediate Application
Filter changes are immediate (no Apply button, no batching). Every user interaction that modifies filter state calls `onFilterStateChanged` synchronously.

**Validates: Requirements 11.1, 11.2**

### Property 4: Clear All Resets to Defaults
Clear All resets to `FilterState()` defaults (matching web's `_applySystemDefaults`). This includes hidden fields (colors, dateRange).

**Validates: Requirements 10.3, 10.4, 9.4**

### Property 5: Sidebar Stays Open
The sidebar drawer does NOT close on filter changes (only on navigation button taps).

**Validates: Requirements 11.1**

### Property 6: Hidden Fields Retained
Color and DateRange fields remain in FilterState but have no UI controls. They are reset on Clear All to prevent orphaned state.

**Validates: Requirements 9.3, 9.4**

## Traceability Matrix

| Requirement | Components |
|-------------|-----------|
| Req 1: Collapsible Sub-Groups | CollapsibleSection (existing), FilterPanel orchestration |
| Req 2: Filter Text + Saved Searches | FilterTextSection |
| Req 3: Status Multi-Select | AnyToggleCheckboxGroup |
| Req 4: Priority Multi-Select | AnyToggleCheckboxGroup |
| Req 5: Tag Tree Filter | TagTreeFilter, TagItem, TagTreeNode |
| Req 6: People Chip Filter | PeopleChipFilter, PersonItem |
| Req 7: Project Dropdown | ProjectFilterDropdown, ProjectItem |
| Req 8: Display Checkboxes | DisplayToggleCheckboxes, ParchmentCheckbox |
| Req 9: Remove Non-Web Sections | FilterPanel (omits Color/DateRange UI) |
| Req 10: Header Clear/Defaults | FilterHeaderButtons, CollapsibleSection.headerExtra |
| Req 11: Immediate Application | All components call onFilterStateChanged immediately |
| Req 12: Parchment Styling | ParchmentCheckbox, FilterClearButton, FilterColors |
| Req 13: FilterState Updates | FilterState.kt (no code change needed, just UI alignment) |
