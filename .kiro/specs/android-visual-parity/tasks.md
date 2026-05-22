# Implementation Plan

## Overview

This plan brings the Android app's visual presentation into alignment with the mobile web version. All changes are UI-layer only — no data models, no backend changes, no Room migrations. Tasks are ordered by dependency: shared theme utilities first, then layout changes, then per-screen styling.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Theme Foundation",
      "tasks": [1, 2, 3, 4, 5, 6],
      "description": "Shared styling utilities and core theme constants — everything else depends on these"
    },
    {
      "name": "Wave 2: Layout Adaptations",
      "tasks": [7, 8, 9, 10],
      "description": "Responsive layout changes — tab row, sidebar, card headers, views button"
    },
    {
      "name": "Wave 3: Component Styling",
      "tasks": [11, 12, 13, 14, 15],
      "description": "Apply themed styling to dialogs, buttons, inputs, dividers, zone headers"
    },
    {
      "name": "Wave 4: View-Specific Fixes",
      "tasks": [16, 17, 18, 19, 20, 21],
      "description": "Per-screen visual fixes — notes layout, note interaction, checklists, kanban, settings panels, section headings"
    }
  ]
}
```

## Tasks

- [x] 1. Increase parchment texture opacity <!-- dep: none -->
  - [x] 1.1. In `android/app/src/main/java/com/cwoc/app/ui/theme/ParchmentBackground.kt`, change `alpha = 0.3f` to `alpha = 0.7f`
  - [x] 1.2. Verify the texture is clearly visible on all screens that use ParchmentBackground
  - Requirements: 1

- [x] 2. Update CwocChitCardStyle for border radius and transparency <!-- dep: none -->
  - [x] 2.1. In `android/app/src/main/java/com/cwoc/app/ui/components/CwocChitCardStyle.kt`, change `CardBackground` from `Color(0xFFFDF5E6)` to `Color(0xCCFDF6E3)` (80% opacity cream)
  - [x] 2.2. Add `val CardBackgroundOpaque = Color(0xFFFDF6E3)` for use when chit has a custom color (full opacity)
  - [x] 2.3. Find all usages of `RoundedCornerShape(12.dp)` in card-related code and change to `RoundedCornerShape(6.dp)` — update `cardBorder` to use the 6dp shape
  - [x] 2.4. Update `resolveChitBgColor()` to return the semi-transparent default when color is null/blank, and full-opacity parsed color when a custom color is set
  - [x] 2.5. Update `cardColors()` to use the semi-transparent `CardBackground`
  - Requirements: 1, 2

- [x] 3. Add new color constants to Color.kt <!-- dep: none -->
  - [x] 3.1. In `android/app/src/main/java/com/cwoc/app/ui/theme/Color.kt`, add: `val CwocZoneHeaderTan = Color(0xFFD2B48C)`
  - [x] 3.2. Add: `val CwocOutsetBorder = Color(0xFF8B4513)`
  - [x] 3.3. Add: `val CwocTealAccent = Color(0xFF008080)`
  - [x] 3.4. Add: `val CwocIvory = Color(0xFFFFFFF0)`
  - [x] 3.5. Add: `val CwocDialogBg = Color(0xFFFFFAF0)`
  - [x] 3.6. Add: `val CwocButtonTan = Color(0xFFD2B48C)`
  - [x] 3.7. Add: `val CwocInputBg = Color(0xFFFDF5E6)`
  - Requirements: 5, 6, 8, 14, 16

- [x] 4. Create CwocDialogDefaults utility <!-- dep: 3 -->
  - [x] 4.1. Create `android/app/src/main/java/com/cwoc/app/ui/theme/CwocDialogDefaults.kt`
  - [x] 4.2. Define `object CwocDialogDefaults` with `val containerColor = CwocDialogBg`
  - [x] 4.3. Add `val borderModifier = Modifier.border(1.dp, CwocOutline, RoundedCornerShape(10.dp))`
  - [x] 4.4. Add `val titleStyle` using Lora, 20sp, Bold, Color(0xFF1A1208)
  - [x] 4.5. Add `@Composable fun confirmButtonColors()` returning ButtonColors with CwocButtonTan container, CwocAgedBrownDark content
  - [x] 4.6. Add `@Composable fun dangerButtonColors()` returning ButtonColors with CwocError container, CwocOnError content
  - Requirements: 6

- [x] 5. Create CwocButtonDefaults utility <!-- dep: 3 -->
  - [x] 5.1. Create `android/app/src/main/java/com/cwoc/app/ui/theme/CwocButtonDefaults.kt`
  - [x] 5.2. Define `object CwocButtonDefaults` with `@Composable fun outsetColors()` returning ButtonColors(containerColor=CwocButtonTan, contentColor=CwocAgedBrownDark)
  - [x] 5.3. Add `val outsetBorder = BorderStroke(2.dp, CwocOutsetBorder)`
  - [x] 5.4. Add `val outsetShape = RoundedCornerShape(4.dp)`
  - [x] 5.5. Add `@Composable fun dangerColors()` returning ButtonColors(containerColor=CwocError, contentColor=CwocOnError)
  - [x] 5.6. Add `val dangerBorder = BorderStroke(2.dp, CwocAgedBrownDark)`
  - Requirements: 5

- [x] 6. Create CwocInputDefaults utility <!-- dep: 3 -->
  - [x] 6.1. Create `android/app/src/main/java/com/cwoc/app/ui/theme/CwocInputDefaults.kt`
  - [x] 6.2. Define `object CwocInputDefaults` with `@Composable fun outlinedColors()` returning OutlinedTextFieldColors with focusedBorderColor=CwocTealAccent, unfocusedBorderColor=CwocOutsetBorder, containerColor=CwocInputBg
  - [x] 6.3. Add `@Composable fun dropdownColors()` with same border/container pattern for ExposedDropdownMenuBox
  - Requirements: 8

- [x] 7. Implement conditional tab row vs Views button <!-- dep: 3 -->
  - [x] 7.1. In `MainActivity.kt` `CwocApp` composable, wrap the Scaffold content in `BoxWithConstraints`
  - [x] 7.2. Define `val isPhone = maxWidth <= 600.dp`
  - [x] 7.3. When `isPhone == true`: hide the CCaptnTabRow (don't compose it), add a "Views" Button to the TopAppBar actions area styled as a compact brown pill (CwocPrimary bg, ivory text, RoundedCornerShape(4.dp))
  - [x] 7.4. When the "Views" button is tapped, set `viewsPanelOpen = true` (existing state)
  - [x] 7.5. When `isPhone == false`: show CCaptnTabRow as currently implemented
  - [x] 7.6. Verify the ~48dp of reclaimed vertical space is used by content
  - Requirements: 4

- [x] 8. Update sidebar with parchment texture and pinned bottom <!-- dep: 1 -->
  - [x] 8.1. In `SidebarContent.kt`, wrap the entire Column content in a `ParchmentBackground` composable (or apply the parchment texture directly to the ModalDrawerSheet)
  - [x] 8.2. Restructure the layout: scrollable content in `Column(Modifier.weight(1f).verticalScroll(...))` + fixed bottom `Column` containing Settings and Help buttons
  - [x] 8.3. In `MainActivity.kt`, when `isPhone == true`, set the ModalNavigationDrawer's drawerContent width to fill the screen (`Modifier.fillMaxWidth()`)
  - [x] 8.4. Verify Settings and Help buttons are always visible at the bottom without scrolling
  - Requirements: 13

- [x] 9. Implement card header vertical stacking on phone <!-- dep: none -->
  - [x] 9.1. In all card composables that have a header row (TaskCard, NoteCard, ChecklistCard, AlertCard), add a `BoxWithConstraints` or accept an `isPhone: Boolean` parameter
  - [x] 9.2. When `isPhone == true`: render title and meta in a `Column` (title on top with no maxLines limit and word-wrap, meta below in a `FlowRow` at 12.sp)
  - [x] 9.3. When `isPhone == false`: keep current horizontal `Row` layout
  - [x] 9.4. Pass `isPhone` from parent screens using `LocalConfiguration.current.screenWidthDp <= 600`
  - Requirements: 15

- [x] 10. Add visible Views button affordance to ViewsPanel <!-- dep: 7 -->
  - [x] 10.1. Verify the "Views" button added in Task 7 correctly opens the ViewsPanel
  - [x] 10.2. Ensure the ViewsPanel still responds to right-edge swipe gesture (existing behavior preserved)
  - [x] 10.3. On tablet (tabs visible), hide the "Views" button since tabs serve the same purpose
  - Requirements: 4

- [x] 11. Theme all AlertDialogs with parchment styling <!-- dep: 4 -->
  - [x] 11.1. Search all `AlertDialog(` usages across the codebase
  - [x] 11.2. For each AlertDialog, add `containerColor = CwocDialogDefaults.containerColor` and wrap in `Modifier.then(CwocDialogDefaults.borderModifier)` (or use a Surface wrapper)
  - [x] 11.3. Update title text styles to use `CwocDialogDefaults.titleStyle`
  - [x] 11.4. Update confirm buttons to use `CwocDialogDefaults.confirmButtonColors()`
  - [x] 11.5. Update destructive/delete buttons to use `CwocDialogDefaults.dangerButtonColors()`
  - [x] 11.6. Verify no white/Material-default dialogs remain
  - Requirements: 6

- [x] 12. Theme all ModalBottomSheets and DropdownMenus <!-- dep: 4 -->
  - [x] 12.1. Search all `ModalBottomSheet(` usages and add `containerColor = CwocDialogDefaults.containerColor`
  - [x] 12.2. Search all `DropdownMenu(` usages (including ChitActionMenu) and wrap content in a Surface with `CwocDialogDefaults.containerColor` and brown border
  - [x] 12.3. For ModalBottomSheet, set `dragHandle` tint to `CwocPrimary`
  - [x] 12.4. Verify all sheets and menus use parchment colors
  - Requirements: 6

- [x] 13. Apply outset button styling to editor and settings <!-- dep: 5 -->
  - [x] 13.1. In `ChitEditorScreen.kt`, update all Button composables to use `colors = CwocButtonDefaults.outsetColors()`, `border = CwocButtonDefaults.outsetBorder`, `shape = CwocButtonDefaults.outsetShape`
  - [x] 13.2. In `SettingsScreen.kt` and all settings tab composables, apply the same button styling
  - [x] 13.3. For delete buttons, use `CwocButtonDefaults.dangerColors()` and `CwocButtonDefaults.dangerBorder`
  - [x] 13.4. In secondary pages (Trash, AuditLog, People, ContactEditor, Weather, Help), apply the same button styling
  - [x] 13.5. Verify buttons have the raised/outset appearance matching web
  - Requirements: 5

- [x] 14. Apply themed input field colors <!-- dep: 6 -->
  - [x] 14.1. In `ChitEditorScreen.kt`, update all `OutlinedTextField` composables to use `colors = CwocInputDefaults.outlinedColors()`
  - [x] 14.2. In all editor zone files (DateZone, AlertsZone, etc.), apply the same input colors
  - [x] 14.3. In `SettingsScreen.kt` and settings tab composables, apply the same input colors
  - [x] 14.4. In `SearchScreen.kt`, apply the same input colors to the search field
  - [x] 14.5. Verify all text fields show brown borders unfocused and teal borders focused
  - Requirements: 8

- [x] 15. Update all HorizontalDividers to brown <!-- dep: 3 -->
  - [x] 15.1. Search all `HorizontalDivider(` usages across the codebase
  - [x] 15.2. For each, add `color = Color(0xFF8B5A2B)` and `thickness = 1.dp` (unless it already uses the gold variant `CwocGoldDivider`)
  - [x] 15.3. Verify no grey/default dividers remain
  - Requirements: 16

- [x] 16. Fix Notes view to single column on phone <!-- dep: none -->
  - [x] 16.1. In `NotesScreen.kt` `NotesList` composable, wrap the `LazyVerticalStaggeredGrid` in `BoxWithConstraints`
  - [x] 16.2. When `maxWidth <= 600.dp`: use `StaggeredGridCells.Fixed(1)` instead of `StaggeredGridCells.Adaptive(160.dp)`
  - [x] 16.3. When `maxWidth > 600.dp`: keep `StaggeredGridCells.Adaptive(160.dp)`
  - [x] 16.4. Apply the same logic to `ChecklistsScreen.kt` and `NotebookScreen.kt` if they use staggered grids
  - Requirements: 3

- [x] 17. Fix note card tap behavior <!-- dep: 16 -->
  - [x] 17.1. In `NotesScreen.kt` `NoteCard` composable, change the `combinedClickable` `onClick` to always call `onClick()` (navigate to editor) regardless of expanded state
  - [x] 17.2. Remove the `isExpanded` state and the expand-on-first-tap logic
  - [x] 17.3. Add a "Show more" / "Show less" `Text` composable below the note content when content exceeds 4 lines (use `onTextLayout` to detect line count)
  - [x] 17.4. When "Show more" is tapped, expand the content preview (increase maxLines from 4 to Int.MAX_VALUE) — this tap should NOT navigate to editor (use `Modifier.clickable` with `stopPropagation` on the toggle text)
  - [x] 17.5. Style the toggle text: `fontSize = 12.sp, color = Color(0xFF8B5A2B), fontStyle = FontStyle.Italic`
  - Requirements: 9

- [x] 18. Add inline checklist items to task cards <!-- dep: none -->
  - [x] 18.1. In `TasksScreen.kt` `TaskCard` composable, after the header row, check if the chit has checklist items (parse `checklistJson`)
  - [x] 18.2. If checklist items exist, render the first 5 items as `Row` composables with a `Checkbox` + item text
  - [x] 18.3. If more than 5 items exist, show a `Text("+${remaining} more", fontSize = 11.sp, color = Color(0xFF8B7355))`
  - [x] 18.4. When a checkbox is tapped, toggle the item's `done` state, serialize back to JSON, and persist via `chitRepository.updateChecklist(chitId, newJson)`
  - [x] 18.5. Keep the existing "☑ X/Y" progress indicator in the header meta area
  - [x] 18.6. Wrap the checklist section in the content zone recess background (`Color(0x0A000000)`, `RoundedCornerShape(3.dp)`, `4.dp` padding)
  - Requirements: 10

- [x] 19. Compress kanban cards on phone <!-- dep: none -->
  - [x] 19.1. In `ProjectsScreen.kt` `ProjectCard` composable, detect phone width (`LocalConfiguration.current.screenWidthDp <= 600`)
  - [x] 19.2. When on phone: render child chit cards with `padding(horizontal = 4.dp, vertical = 2.dp)`, `fontSize = 12.sp`, `maxLines = 1` for title
  - [x] 19.3. When on phone: render column headers with `fontSize = 11.sp`, `padding(vertical = 3.dp)`
  - [x] 19.4. When on phone: render project headers with `fontSize = 14.sp`, `padding(4.dp)`
  - [x] 19.5. When on tablet: keep current sizing
  - Requirements: 11

- [x] 20. Add gradient panel to settings and secondary pages <!-- dep: 3 -->
  - [x] 20.1. Create `android/app/src/main/java/com/cwoc/app/ui/components/CwocPagePanel.kt` composable that wraps content in a `Surface` with: `Brush.verticalGradient(listOf(Color(0xFFFFF8E1), Color(0xFFF5E6CC)))` background, `BorderStroke(2.dp, Color(0xFF8B5A2B))`, `RoundedCornerShape(10.dp)`
  - [x] 20.2. In `SettingsScreen.kt`, wrap the main content area in `CwocPagePanel`
  - [x] 20.3. In other secondary screens (HelpScreen, TrashScreen, AuditLogScreen, WeatherScreen, ContactListScreen, ContactEditorScreen), wrap main content in `CwocPagePanel`
  - [x] 20.4. Verify the gradient and border are visible on all secondary pages
  - Requirements: 12

- [x] 21. Add uppercase section headings <!-- dep: 3 -->
  - [x] 21.1. Create `android/app/src/main/java/com/cwoc/app/ui/components/CwocSectionHeading.kt` composable that renders text with: `fontSize = 22.sp` (or 26.sp for h2-equivalent), `fontWeight = Bold`, `color = Color(0xFF1A1208)`, `letterSpacing = 2.sp`, uppercase transform via `.uppercase()`, bottom border `HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)` with `10.dp` bottom padding
  - [x] 21.2. In `SettingsScreen.kt`, replace section header `Text` composables with `CwocSectionHeading`
  - [x] 21.3. In other secondary screens that have section headers, replace with `CwocSectionHeading`
  - [x] 21.4. Verify headings are uppercase with letter spacing and brown underline
  - Requirements: 7

- [x] 22. Update EditorZoneHeader color <!-- dep: 3 -->
  - [x] 22.1. In `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/EditorZoneHeader.kt`, change the background color from `CwocZoneHeaderBrown` (or whatever dark brown is currently used) to `CwocZoneHeaderTan` (`Color(0xFFD2B48C)`)
  - [x] 22.2. Change the text/icon color on zone headers to `Color(0xFF4A2C2A)` (aged brown dark) for contrast on the lighter tan background
  - [x] 22.3. Verify all editor zones display with the warm tan header
  - Requirements: 5

- [x] 23. Update active tab indicator styling (tablet) <!-- dep: 7 -->
  - [x] 23.1. In `CCaptnTabRow.kt`, replace the `ScrollableTabRow` with a custom `Row` of `Button` composables (or style tabs as filled buttons)
  - [x] 23.2. Active tab: `containerColor = CwocIvory`, `contentColor = Color(0xFF3B1F0A)`, `border = BorderStroke(1.dp, Color(0xFF5A3F2A))`
  - [x] 23.3. Inactive tab: `containerColor = CwocPrimary` (#8B5A2B), `contentColor = CwocIvory`, `border = BorderStroke(1.dp, Color(0xFF5A3F2A))`
  - [x] 23.4. Remove the underline indicator (`TabRowDefaults.SecondaryIndicator`)
  - [x] 23.5. Keep icons (18dp) to the left of labels (not above), matching web's inline icon+text layout
  - [x] 23.6. Verify tabs look like brown filled buttons with ivory active state
  - Requirements: 14

- [x] 24. Add content zone recess to list view cards <!-- dep: 2 -->
  - [x] 24.1. In `TaskCard`, `AlertCard`, and `ChecklistCard` composables (in Tasks, Alarms, Checklists views), wrap content below the header row in a `Box` with `Modifier.background(Color(0x0A000000), RoundedCornerShape(3.dp)).padding(horizontal = 6.dp, vertical = 4.dp)`
  - [x] 24.2. This applies to: inline checklists, note previews, status/priority metadata sections — anything rendered below the title/indicator header row
  - [x] 24.3. Do NOT apply to calendar event cards or note cards in masonry view (matching web's selector specificity)
  - Requirements: 2

## Notes

- All changes are UI-only. No Room migrations, no backend changes, no new API calls.
- The `BoxWithConstraints` approach for responsive layout is preferred over `LocalConfiguration` where possible, as it responds to actual available space rather than device screen size.
- When updating AlertDialogs, some may use the `AlertDialog` overload with `properties` parameter — ensure `containerColor` is set regardless of which overload is used.
- The semi-transparent card background (`0xCC` alpha = 80%) may need fine-tuning based on how it looks over the 70% texture. If cards become hard to read, increase to `0xDD` (87%) or `0xEE` (93%).
- Button "outset" effect on Android is simulated with a `BorderStroke` — it won't be pixel-identical to CSS `border: 2px outset` but will convey the same raised/embossed feel.
- The tab row change (Task 7) is the most impactful layout change — it affects the entire app's navigation pattern on phone. Test thoroughly on multiple phone sizes.
