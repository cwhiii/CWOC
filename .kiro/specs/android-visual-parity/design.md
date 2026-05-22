# Design Document

## Overview

This design addresses the comprehensive visual and behavioral differences between the CWOC Android app and the mobile web version. The Android app currently uses stock Material3 defaults in many places (white dialogs, grey borders, flat buttons, faint texture, rounded cards) that break the distinctive 1940s parchment/magic brand identity established by the web version.

The existing Android infrastructure provides strong foundations: `CwocTheme` with correct color values, `ParchmentBackground` composable, `CwocChitCardStyle` object, `LoraFontFamily`, and all the correct hex values already defined in `Color.kt`. The problem is not missing values — it's that many composables use Material3 defaults instead of the CWOC theme values.

The fix strategy is primarily about applying existing theme values more consistently, adjusting a few constants (texture alpha, border radius), and creating shared styling utilities that enforce the parchment aesthetic across all UI components.

## Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Shared Theme Layer (Modified)                      │
├─────────────────────────────────────────────────────────────────────┤
│ ParchmentBackground.kt — alpha 30% → 70%                            │
│ CwocChitCardStyle.kt — borderRadius 12dp → 6dp, semi-transparent bg │
│ Color.kt — add ZoneHeaderTan, OutsetBorderBrown                      │
│ CwocDialogDefaults.kt — NEW: shared dialog/sheet/menu colors         │
│ CwocButtonDefaults.kt — NEW: shared outset button styling            │
│ CwocInputDefaults.kt — NEW: shared input field colors                │
│ CwocDividerDefaults.kt — NEW: shared divider styling                 │
├─────────────────────────────────────────────────────────────────────┤
│                    Layout Adaptations (Modified)                      │
├─────────────────────────────────────────────────────────────────────┤
│ MainActivity.kt — conditional tab row vs Views button based on width │
│ CCaptnTabRow.kt — filled button style for tablet, hidden on phone    │
│ ViewsPanel.kt — add visible trigger button in TopAppBar              │
│ SidebarContent.kt — ParchmentBackground, pinned bottom, full-width   │
├─────────────────────────────────────────────────────────────────────┤
│                    Card Layer (Modified)                              │
├─────────────────────────────────────────────────────────────────────┤
│ CwocChitCardStyle.kt — 6dp radius, transparent default bg            │
│ NotesScreen.kt — single column on phone, direct-tap navigation       │
│ ChecklistsScreen.kt — single column on phone                         │
│ TasksScreen.kt — inline checklist items, stacked header on phone     │
│ ProjectsScreen.kt — compressed kanban cards on phone                 │
├─────────────────────────────────────────────────────────────────────┤
│                    Editor & Pages Layer (Modified)                    │
├─────────────────────────────────────────────────────────────────────┤
│ EditorZoneHeader.kt — tan background instead of dark brown            │
│ ChitEditorScreen.kt — outset buttons, themed inputs                  │
│ SettingsScreen.kt — gradient panel, uppercase headings               │
│ All secondary screens — gradient panel wrapper                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

- **CwocDialogDefaults** (`ui/theme/CwocDialogDefaults.kt`) — Object providing shared dialog/sheet/menu color configurations:
  - `containerColor = Color(0xFFFFFAF0)`
  - `borderModifier = Modifier.border(1.dp, Color(0xFF6B4E31), RoundedCornerShape(10.dp))`
  - `titleStyle` — Lora, 20sp, bold, Color(0xFF1A1208)
  - `buttonColors()` — tan background, brown border for confirm; red for destructive

- **CwocButtonDefaults** (`ui/theme/CwocButtonDefaults.kt`) — Object providing shared button styling:
  - `outsetButtonColors()` — containerColor=#D2B48C, contentColor=#4A2C2A, border=2dp #8B4513
  - `dangerButtonColors()` — containerColor=#B22222, contentColor=#FDF5E6, border=2dp #4A2C2A
  - `cancelButtonColors()` — containerColor=#A0522D, contentColor=#FDF5E6

- **CwocInputDefaults** (`ui/theme/CwocInputDefaults.kt`) — Object providing shared input field colors:
  - `outlinedTextFieldColors()` — focusedBorder=teal, unfocusedBorder=#8B4513, container=#FDF5E6
  - `dropdownColors()` — same border/container pattern

- **CwocPagePanel** (`ui/components/CwocPagePanel.kt`) — Composable wrapping secondary page content with gradient background, brown border, and rounded corners (matching web's `.settings-panel`)

- **CwocSectionHeading** (`ui/components/CwocSectionHeading.kt`) — Composable rendering uppercase, letter-spaced headings with brown bottom border

### Modified Components

- **ParchmentBackground.kt** — Change `alpha = 0.3f` → `alpha = 0.7f`

- **CwocChitCardStyle.kt**:
  - Change `RoundedCornerShape(12.dp)` → `RoundedCornerShape(6.dp)` (referenced in cardBorder shape)
  - Change `CardBackground = Color(0xFFFDF5E6)` → `Color(0xCCFDF6E3)` (semi-transparent)
  - Add `CardBackgroundColored` for when chit has a color (full opacity)

- **Color.kt** — Add:
  - `val CwocZoneHeaderTan = Color(0xFFD2B48C)` (replaces dark brown for zone headers)
  - `val CwocOutsetBorder = Color(0xFF8B4513)`
  - `val CwocTealAccent = Color(0xFF008080)`
  - `val CwocIvory = Color(0xFFFFFFF0)`

- **MainActivity.kt**:
  - Add `BoxWithConstraints` to detect screen width
  - When width ≤ 600dp: hide CCaptnTabRow, show "Views" button in TopAppBar
  - When width > 600dp: show CCaptnTabRow with filled button styling

- **CCaptnTabRow.kt**:
  - Replace underline indicator with filled button tabs (brown bg inactive, ivory bg active)
  - Match web's `.tab` / `.tab.active` styling

- **SidebarContent.kt**:
  - Wrap in ParchmentBackground
  - Pin Settings + Help to bottom using `Modifier.weight(1f)` on scrollable content + fixed bottom Column
  - On phone width: expand to full width

- **EditorZoneHeader.kt**:
  - Change background from `CwocZoneHeaderBrown` (#6B4E31) → `CwocZoneHeaderTan` (#D2B48C)
  - Change text color to `Color(0xFF4A2C2A)`

- **NotesScreen.kt**:
  - Add `BoxWithConstraints` check: if maxWidth ≤ 600.dp → `StaggeredGridCells.Fixed(1)`
  - Change NoteCard click behavior: single tap → navigate to editor
  - Add "Show more" / "Show less" text toggle for long content

- **ChecklistsScreen.kt** — Same single-column logic as NotesScreen

- **TasksScreen.kt** (TaskCard):
  - Add inline checklist items (first 5 with checkboxes)
  - On phone width: stack header vertically (title above, meta below)

- **ProjectsScreen.kt** (kanban cards):
  - On phone width: reduce padding, font size, single-line titles

- **All AlertDialog usages** — Apply CwocDialogDefaults colors and border
- **All ModalBottomSheet usages** — Apply CwocDialogDefaults containerColor
- **All DropdownMenu usages** — Apply CwocDialogDefaults containerColor and border
- **All OutlinedTextField usages in editor/settings** — Apply CwocInputDefaults colors
- **All Button usages in editor/settings** — Apply CwocButtonDefaults outset styling
- **All HorizontalDivider usages** — Apply `color = Color(0xFF8B5A2B), thickness = 1.dp`

## Data Models

No new data models are required. All changes are purely visual/UI layer modifications.

## Screen Width Detection Strategy

Use `BoxWithConstraints` at the top level of screens that need responsive behavior:

```kotlin
BoxWithConstraints {
    val isPhone = maxWidth <= 600.dp
    // Use isPhone to conditionally render phone vs tablet layouts
}
```

This matches the web's `@media (max-width: 480px)` breakpoint (600dp on Android accounts for density differences).

## Migration Strategy

Changes should be applied in waves to minimize risk:

1. **Wave 1 (Theme foundation):** ParchmentBackground alpha, Color.kt additions, CwocDialogDefaults, CwocButtonDefaults, CwocInputDefaults, CwocChitCardStyle radius/transparency
2. **Wave 2 (Layout):** Tab row conditional visibility, Views button, sidebar texture/pinning, card header stacking
3. **Wave 3 (Component styling):** Dialog theming, button outset styling, input theming, divider colors, zone header color
4. **Wave 4 (View-specific):** Notes single-column, note tap behavior, inline checklists, kanban compression, settings panel gradient, section headings

## Error Handling

- **Screen width detection:** If `BoxWithConstraints` fails to provide dimensions (edge case during composition), default to phone layout (single column, hidden tabs)
- **Semi-transparent card background:** If the parchment texture fails to load (missing drawable), the solid `#FDF5E6` background ensures cards remain readable
- **Font loading:** If Lora font fails to load from resources, the system serif fallback maintains readability

## Testing Strategy

Tests are optional per project rules. Manual verification:
1. Compare screenshots of each screen against mobile web at same viewport width
2. Verify parchment texture is clearly visible through cards and on sidebar
3. Verify all dialogs/sheets use parchment colors (no white Material popups)
4. Verify notes show single column on phone, multi-column on tablet
5. Verify tab row hidden on phone, visible on tablet
6. Verify zone headers are warm tan, not dark brown
7. Verify buttons have raised/outset appearance
8. Verify input fields have brown borders and parchment fill
9. Verify section headings are uppercase with letter spacing
