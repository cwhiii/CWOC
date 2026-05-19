# Implementation Plan: Android Sidebar Filters Parity

## Overview

Replace the Android app's FilterPanel with a web-parity implementation. Work is split into 11 tasks: shared primitives first, then individual filter sub-components, then orchestration and wiring.

## Tasks

- [x] 1. Create shared filter UI primitives (ParchmentCheckbox, FilterClearButton, color constants)
  - Create `ui/navigation/filter/FilterColors.kt` with all parchment theme color constants (ParchmentBg, BrownBorder, BrownText, HeaderBrown, DarkestBrown, DefaultChipColor, SelectedOutline)
  - Add `generatePastelColor(name: String): Color` utility (deterministic hue from hashCode, saturation 0.4, lightness 0.8)
  - Add `isLightColor(color: Color): Boolean` utility (luminance formula)
  - Create `ui/navigation/filter/ParchmentCheckbox.kt` — Row with custom-colored Checkbox + Spacer + Text (Lora, 13.sp, #4a2c2a)
  - Create `ui/navigation/filter/FilterClearButton.kt` — small OutlinedButton (1dp border #6b4e31 at 30%, 3dp corners, "Clear" 11.sp, transparent bg)
  - Requirements: 12.1–12.6

- [x] 2. Create AnyToggleCheckboxGroup composable
  - Create `ui/navigation/filter/AnyToggleCheckboxGroup.kt`
  - Render "— Any" ParchmentCheckbox (checked when selectedOptions is empty)
  - Render each option as ParchmentCheckbox
  - Mutual exclusion: "— Any" clears all; specific removes "— Any"; last unchecked reverts to "— Any"
  - "— Any" cannot be directly unchecked when already checked
  - FilterClearButton at bottom resets to empty set
  - Call onSelectionChanged immediately on every change
  - Requirements: 3.1–3.7, 4.1–4.8, 11.1–11.2

- [x] 3. Create TagTreeFilter composable
  - Create `ui/navigation/filter/TagTreeFilter.kt` with TagItem and TagTreeNode data classes
  - Implement buildTagTree: split by "/", build hierarchy, sort favorites first then alphabetical
  - "Select All / Select None" toggle button (text changes based on selection state)
  - Search input "Search tags..." with parchment styling, filters by case-insensitive substring on full path
  - Recursive tree rendering: 16.dp indent per level, ▶/▼ expand/collapse for parents
  - Colored badge per tag (background = color or generated pastel, rounded 4.dp)
  - ★ prefix for favorites
  - Tap toggles selection; empty selection = show all
  - Tag matching includes descendants (chit tag starts with selectedTag + "/")
  - FilterClearButton at bottom
  - Requirements: 5.1–5.11

- [x] 4. Create PeopleChipFilter composable
  - Create `ui/navigation/filter/PeopleChipFilter.kt` with PersonItem data class
  - Search input "Search people..." with parchment styling
  - Chips in vertical Column: circular image (18dp, Coil AsyncImage or placeholder) + name (prefix stripped) + ★
  - Background = person's color (default #d2b48c); text color by luminance
  - System users: 2dp border #1a1208; contacts: 1dp border
  - Selected: outline 2dp #4a2c2a, bold, alpha 1.0; Unselected: alpha 0.7
  - Sort: contacts favorites-first → alphabetical, then users alphabetical, deduplicate by name
  - "No contacts or users" when empty; "No matches" when search yields nothing
  - FilterClearButton at bottom
  - Requirements: 6.1–6.14

- [x] 5. Create ProjectFilterDropdown composable
  - Create `ui/navigation/filter/ProjectFilterDropdown.kt` with ProjectItem data class
  - ExposedDropdownMenuBox: "—" (null), "Any (has a project)" ("__any__"), "None (no project)" ("__none__")
  - Dynamic project titles sorted alphabetically; "(Untitled Project)" for blank
  - Map selection to FilterState.projectFilter values
  - FilterClearButton at bottom
  - Requirements: 7.1–7.8

- [x] 6. Create DisplayToggleCheckboxes composable
  - Create `ui/navigation/filter/DisplayToggleCheckboxes.kt`
  - ParchmentCheckbox rows with emoji labels in exact web order and defaults
  - Dashed separators (Canvas + PathEffect.dashPathEffect, dash 4dp gap 4dp, color #c4a882)
  - Each toggle immediately updates FilterState copy
  - Requirements: 8.1–8.5

- [x] 7. Create FilterTextSection composable
  - Create `ui/navigation/filter/FilterTextSection.kt`
  - OutlinedTextField "Filter Chits..." with parchment styling
  - 300ms debounce via LaunchedEffect + delay before calling onSearchTextChanged
  - Saved search chips in FlowRow (truncated 15 chars + "…", ✕ delete icon)
  - Tap chip → set search text; tap ✕ → delete; hide container when empty
  - Requirements: 2.1–2.7, 11.4

- [x] 8. Create FilterHeaderButtons composable
  - Create `ui/navigation/filter/FilterHeaderButtons.kt`
  - Row: "✕ Clear" (visible when activeFilterCount > 0) + "↺ Defaults" (visible when hasCustomDefaults)
  - Parchment-themed small button styling
  - Requirements: 10.1–10.8

- [x] 9. Rewrite FilterPanel.kt to orchestrate all sub-components
  - Replace FilterPanel.kt contents with new signature and orchestration
  - FilterTextSection (always visible, not collapsible)
  - CollapsibleSection("Status") { AnyToggleCheckboxGroup(statuses) }
  - CollapsibleSection("Priority") { AnyToggleCheckboxGroup(priorities: Low, Medium, High) }
  - CollapsibleSection("Tags") { TagTreeFilter }
  - CollapsibleSection("People") { PeopleChipFilter }
  - CollapsibleSection("Project") { ProjectFilterDropdown }
  - CollapsibleSection("Display") { DisplayToggleCheckboxes }
  - All sub-groups start collapsed
  - Remove Color and Date Range sections; onClearAll resets hidden fields too
  - Requirements: 1.1–1.7, 9.1–9.4, 11.1–11.3, 13.1

- [x] 10. Wire FilterPanel into SidebarContent via MainActivity
  - Pass filterContent lambda to SidebarContent in MainActivity.kt
  - Collect filterState, parse tags from settings, load contacts → PersonItems, load projects → ProjectItems
  - Wire onFilterStateChanged to filterSortViewModel.updateFilter()
  - Wire onClearAll to filterSortViewModel.clearFilters()
  - Update CollapsibleSection("🔍 Filters") in SidebarContent.kt to pass FilterHeaderButtons via headerExtra
  - Ensure sidebar does NOT close on filter changes
  - Requirements: 1.1, 10.1–10.8, 11.1–11.5

- [x] 11. Verify FilterState.activeFilterCount covers all dimensions
  - Review activeFilterCount property in FilterState.kt
  - Confirm it counts: statuses, priorities, tags, people, colors, dateRange, searchText, projectFilter, all boolean toggles
  - Add any missing dimensions
  - Confirm priority UI shows only "Low", "Medium", "High" (no "Critical")
  - Requirements: 13.1–13.4

## Task Dependency Graph

```json
{
  "waves": [
    [1, 11],
    [2, 3, 4, 5, 6, 7, 8],
    [9],
    [10]
  ]
}
```

## Notes

- Tasks 2–8 can be implemented in parallel after Task 1 is complete
- No software installation required — all work is Kotlin/Compose code
- No tests required per project rules
- The existing CollapsibleSection composable is reused as-is (already has headerExtra support)
- FilterState.kt data class requires no structural changes — only the UI presentation changes
