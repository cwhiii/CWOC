# Requirements Document

## Introduction

This feature addresses all visual and behavioral differences between the CWOC Android app and the mobile web version (viewed at phone widths ≤480px). The Android app currently uses stock Material3 styling in many places, resulting in a generic appearance that breaks the distinctive 1940s parchment/magic brand identity. This spec brings the Android app's visual presentation into alignment with the mobile web version across theming, card rendering, layout behavior, typography, interactions, and editor styling.

Reference document: `Tasks/Android Mobile Implementation/visual-brokenness.md`

## Glossary

- **App**: The CWOC Android mobile application built with Kotlin, Jetpack Compose, Room, and Hilt
- **Mobile_Web**: The CWOC web app viewed in a mobile browser at ≤480px viewport width
- **Parchment_Texture**: The `parchment_bg.jpg` drawable used as a background texture overlay
- **ParchmentBackground**: The existing composable in `ui/theme/ParchmentBackground.kt` that renders the texture
- **CwocChitCardStyle**: The existing object in `ui/components/CwocChitCardStyle.kt` defining shared card styling
- **CCaptnTabRow**: The existing composable rendering the scrollable tab row
- **ViewsPanel**: The existing right-slide panel for view switching
- **EditorZoneHeader**: The existing composable for collapsible zone headers in the editor
- **SidebarContent**: The existing composable for the navigation drawer content
- **ChitActionMenu**: The existing dropdown menu shown on long-press of chit cards
- **Zone_Header_Color**: The background color used for collapsible zone headers in the editor
- **Card_Border_Radius**: The corner rounding applied to chit card containers
- **Outset_Border**: A CSS-style raised/3D border effect simulating embossed buttons

## Requirements

### Requirement 1: Parchment Texture Opacity and Card Transparency

**User Story:** As a user, I want the app to have the same rich parchment texture as the web version, so that it feels like the same branded experience.

#### Acceptance Criteria

1. WHEN the ParchmentBackground composable renders, THE App SHALL display the parchment texture at 70% alpha (changed from current 30%), matching the web's full-opacity `background-size: cover` appearance
2. WHEN a chit card renders with no custom color set, THE App SHALL use a semi-transparent background (`Color(0xCCFDF6E3)` — ~80% opacity cream) so that the parchment texture is partially visible through the card, matching the web's transparent card behavior
3. WHEN a chit card renders with a custom color set, THE App SHALL use that color at full opacity as the card background (no transparency), matching the web's `applyChitColors` behavior
4. WHEN the sidebar drawer is open, THE App SHALL display the parchment texture as the drawer background (using ParchmentBackground or equivalent) instead of the current solid `#FFFAF0`
5. WHEN any modal dialog, bottom sheet, or dropdown menu is displayed, THE App SHALL use `Color(0xFFFFFAF0)` (floral white) as the container background with a `1.dp` border of `Color(0xFF6B4E31)`, matching the web's modal styling pattern

### Requirement 2: Card Border Radius and Styling

**User Story:** As a user, I want chit cards to look like aged paper cards with sharp corners, matching the web's aesthetic.

#### Acceptance Criteria

1. WHEN a chit card renders, THE App SHALL use `RoundedCornerShape(6.dp)` for the card border radius (changed from current 12.dp), matching the web's `border-radius: 6px`
2. WHEN a chit card renders, THE App SHALL use `BorderStroke(2.dp, Color(0xFF8B5A2B))` for the card border, matching the web's `border: 2px solid #8b5a2b`
3. WHEN a chit card renders in a list view (Tasks, Alarms), THE App SHALL add a subtle content zone recess below the header row using `Modifier.background(Color(0x0A000000))` (rgba(0,0,0,0.04) equivalent) with `RoundedCornerShape(3.dp)` and `4.dp` padding, matching the web's `.chit-header-row ~ *` styling
4. WHEN a chit card renders with the "archived" flag, THE App SHALL apply `alpha(0.45f)` (changed from current 0.5f), matching the web's `.archived-chit { opacity: 0.45 }`

### Requirement 3: Notes View Single-Column on Phone

**User Story:** As a user, I want notes to display in a single readable column on my phone, matching the web's mobile layout.

#### Acceptance Criteria

1. WHEN the Notes view renders on a device with screen width ≤ 600dp, THE App SHALL use `StaggeredGridCells.Fixed(1)` (single column) instead of the current `StaggeredGridCells.Adaptive(160.dp)`, matching the web's forced single-column at 480px
2. WHEN the Notes view renders on a device with screen width > 600dp (tablet), THE App SHALL continue using `StaggeredGridCells.Adaptive(160.dp)` for multi-column masonry
3. WHEN the Checklists view renders on a device with screen width ≤ 600dp, THE App SHALL use `StaggeredGridCells.Fixed(1)` (single column), matching the web's behavior
4. WHEN the Notebook view renders on a device with screen width ≤ 600dp, THE App SHALL use `StaggeredGridCells.Fixed(1)` (single column)

### Requirement 4: Tab Row Behavior Matching Mobile Web

**User Story:** As a user, I want the tab row to be hidden on phone-sized screens and replaced by a visible Views button, matching the web's mobile navigation pattern.

#### Acceptance Criteria

1. WHEN the app runs on a device with screen width ≤ 600dp, THE App SHALL hide the CCaptnTabRow and instead display a "Views" button in the TopAppBar (matching the web's `.tabs { display: none }` + `.mobile-views-btn` pattern at 480px)
2. WHEN the "Views" button is tapped, THE App SHALL open the ViewsPanel from the right edge (existing behavior)
3. WHEN the app runs on a device with screen width > 600dp (tablet), THE App SHALL continue showing the CCaptnTabRow as currently implemented
4. THE "Views" button SHALL be styled as a compact brown pill (`Color(0xFF8B5A2B)` background, `Color(0xFFFFF8E1)` text, `RoundedCornerShape(4.dp)`) matching the web's `.mobile-views-btn` styling
5. WHEN the tab row is hidden, THE App SHALL reclaim the ~48dp of vertical space for content display

### Requirement 5: Zone Header and Button Styling

**User Story:** As a user, I want editor zone headers and buttons to match the web's warm tan aesthetic rather than the current dark brown.

#### Acceptance Criteria

1. WHEN an EditorZoneHeader renders, THE App SHALL use `Color(0xFFD2B48C)` (tan/wheat) as the background color (changed from current `Color(0xFF6B4E31)` dark brown), matching the web's `--zone-header-bg: #d2b48c`
2. WHEN an EditorZoneHeader renders, THE App SHALL use `Color(0xFF4A2C2A)` (aged brown dark) as the text color on the zone header, matching the web's `--text-color: #4a2c2a`
3. WHEN action buttons render in the editor or secondary pages, THE App SHALL apply a simulated outset border effect using `Modifier.border(BorderStroke(2.dp, Color(0xFF8B4513)))` with `Color(0xFFD2B48C)` background and `RoundedCornerShape(4.dp)`, matching the web's `button { border: 2px outset #8b4513; background: #d2b48c }`
4. WHEN a delete/danger button renders, THE App SHALL use `Color(0xFFB22222)` background with `Color(0xFFFDF5E6)` text and `BorderStroke(2.dp, Color(0xFF4A2C2A))`, matching the web's `button.delete` styling

### Requirement 6: Dialog and Bottom Sheet Theming

**User Story:** As a user, I want all modals and dialogs to match the parchment theme instead of looking like generic Material white popups.

#### Acceptance Criteria

1. WHEN an AlertDialog is displayed, THE App SHALL use `containerColor = Color(0xFFFFFAF0)` and apply a `Modifier.border(1.dp, Color(0xFF6B4E31), RoundedCornerShape(10.dp))`, matching the web's modal styling
2. WHEN a ModalBottomSheet is displayed, THE App SHALL use `containerColor = Color(0xFFFFFAF0)` with the sheet handle tinted `Color(0xFF8B5A2B)`, matching the parchment theme
3. WHEN a DropdownMenu is displayed (including ChitActionMenu), THE App SHALL use `containerColor = Color(0xFFFFFAF0)` with `Modifier.border(1.dp, Color(0xFF6B4E31), RoundedCornerShape(4.dp))`
4. WHEN dialog title text renders, THE App SHALL use the Lora font family with `Color(0xFF1A1208)` color, matching the web's modal typography
5. WHEN dialog buttons render, THE App SHALL use the parchment button styling (tan background, brown border) for confirm actions and the danger styling (red background) for destructive actions, NOT the default Material3 TextButton styling

### Requirement 7: Typography and Heading Styling

**User Story:** As a user, I want section headings to have the same uppercase, letter-spaced "official document" feel as the web version.

#### Acceptance Criteria

1. WHEN section headings render on secondary pages (Settings, Help, Trash, Audit Log, etc.), THE App SHALL apply uppercase text transform and 2sp letter spacing, matching the web's `h2, h3 { text-transform: uppercase; letter-spacing: 2px }`
2. WHEN section headings render, THE App SHALL include a bottom border of `1.dp` in `Color(0xFF8B5A2B)` with `10.dp` bottom padding, matching the web's `border-bottom: 1px solid #8b5a2b; padding-bottom: 10px`
3. WHEN the page title renders in the editor or secondary pages, THE App SHALL use `fontSize = 26.sp` with `Color(0xFF1A1208)`, matching the web's `h2 { font-size: 26px; color: #1a1208 }`

### Requirement 8: Input Field Theming

**User Story:** As a user, I want form inputs to have warm brown borders on parchment backgrounds, matching the web's styled inputs.

#### Acceptance Criteria

1. WHEN an OutlinedTextField renders in the editor or settings, THE App SHALL use `focusedBorderColor = Color(0xFF008080)` (teal), `unfocusedBorderColor = Color(0xFF8B4513)` (aged brown medium), and `containerColor = Color(0xFFFDF5E6)` (parchment light), matching the web's `input { border: 1px inset #8b4513; background: #fdf5e6 }` and `input:focus { border-color: teal }`
2. WHEN a text field gains focus, THE App SHALL show a teal-tinted focus indicator (matching the web's `--accent-teal: #008080` focus color) instead of the default Material3 primary brown
3. WHEN dropdown/select fields render, THE App SHALL use the same brown border and parchment background styling as text inputs

### Requirement 9: Note Card Interaction Model

**User Story:** As a user, I want tapping a note card to open the editor directly (like the web), not require a double-tap.

#### Acceptance Criteria

1. WHEN the user taps a note card in the Notes view, THE App SHALL navigate directly to the editor for that chit (removing the current expand-on-first-tap behavior)
2. WHEN a note card renders, THE App SHALL show a "Show more" / "Show less" text toggle below truncated content (matching the web's `.note-preview-toggle` pattern) instead of relying on tap-to-expand
3. WHEN the "Show more" toggle is tapped, THE App SHALL expand the note preview content without navigating to the editor
4. WHEN the note content is shorter than the truncation threshold (4 lines), THE App SHALL not show the toggle and the full content SHALL be visible

### Requirement 10: Inline Checklist Display on Task Cards

**User Story:** As a user, I want to see actual checklist items with checkboxes on task cards, not just a count.

#### Acceptance Criteria

1. WHEN a chit card renders in the Tasks view and the chit has checklist items, THE App SHALL display the first 5 checklist items with checkboxes inline on the card (matching the web's inline checklist rendering)
2. WHEN more than 5 checklist items exist, THE App SHALL show "+N more" text below the displayed items
3. WHEN the user taps a checklist checkbox on a card, THE App SHALL toggle that item's completion state and persist the change (matching the web's inline toggle behavior)
4. THE App SHALL continue showing the "☑ X/Y" progress summary in the card header meta area in addition to the inline items

### Requirement 11: Kanban Card Compression on Mobile

**User Story:** As a user, I want kanban project cards to be compact on my phone, matching the web's compressed mobile layout.

#### Acceptance Criteria

1. WHEN the Projects view renders in kanban mode on a device with screen width ≤ 600dp, THE App SHALL render child chit cards with reduced padding (`4.dp` horizontal, `2.dp` vertical), smaller font size (`12.sp`), and single-line title truncation, matching the web's `.kanban-project-box .chit-card { padding: 0.3em 0.4em; font-size: 0.78em }`
2. WHEN kanban column headers render on a device with screen width ≤ 600dp, THE App SHALL use `11.sp` font size and `3.dp` vertical padding, matching the web's `.kanban-col-header { font-size: 0.8em; padding: 3px }`
3. WHEN the project header renders on a device with screen width ≤ 600dp, THE App SHALL use `14.sp` font size and `4.dp` padding, matching the web's `.kanban-project-header { font-size: 0.9em; padding: 0.4em 0.5em }`

### Requirement 12: Settings and Secondary Page Styling

**User Story:** As a user, I want settings and other secondary pages to have the same gradient panel with gold shimmer as the web version.

#### Acceptance Criteria

1. WHEN a secondary page (Settings, Help, Trash, Audit Log, People, Contact Editor, Weather) renders its main content panel, THE App SHALL apply a vertical gradient background from `Color(0xFFFFF8E1)` to `Color(0xFFF5E6CC)`, a `2.dp` border of `Color(0xFF8B5A2B)`, and `RoundedCornerShape(10.dp)`, matching the web's `.settings-panel` styling
2. WHEN the page header bar renders (logo + title + buttons), THE App SHALL display a bottom border of `1.dp` in `Color(0xFF8B5A2B)` with `10.dp` bottom padding, matching the web's `.header-and-buttons { border-bottom: 1px solid #8b5a2b }`
3. WHEN form sections render within settings tabs, THE App SHALL use the same brown-bordered input styling defined in Requirement 8

### Requirement 13: Sidebar Texture and Bottom Pinning

**User Story:** As a user, I want the sidebar to have the parchment texture and pinned bottom navigation, matching the web.

#### Acceptance Criteria

1. WHEN the sidebar drawer opens, THE App SHALL render the ParchmentBackground composable (at 70% texture alpha per Requirement 1) as the drawer background
2. WHEN the sidebar content renders, THE App SHALL pin the Settings and Help navigation buttons to the bottom of the drawer (visible without scrolling), matching the web's sticky bottom section
3. WHEN the sidebar drawer opens on a device with screen width ≤ 600dp, THE App SHALL expand the drawer to full viewport width (matching the web's `sidebar { width: 100% }` at 480px)

### Requirement 14: Active Tab Indicator Styling

**User Story:** As a user on a tablet (where tabs are visible), I want the active tab to use a filled brown button style matching the web.

#### Acceptance Criteria

1. WHEN a tab is selected in the CCaptnTabRow (on tablet-width devices where tabs are visible), THE App SHALL render the active tab with `containerColor = Color(0xFFFFFFF0)` (ivory) and `contentColor = Color(0xFF3B1F0A)` (dark brown), matching the web's `.tab.active { background-color: ivory; color: #3b1f0a }`
2. WHEN a tab is not selected, THE App SHALL render it with `containerColor = Color(0xFF8B5A2B)` (brown) and `contentColor = Color(0xFFFFFFF0)` (ivory), matching the web's `.tab { background-color: var(--btn-bg); color: ivory }`
3. THE App SHALL remove the current underline indicator and replace it with the filled tab button styling described above

### Requirement 15: Card Header Layout on Mobile

**User Story:** As a user, I want card headers to stack title and meta vertically on phone screens, matching the web's mobile card layout.

#### Acceptance Criteria

1. WHEN a chit card header renders on a device with screen width ≤ 600dp, THE App SHALL stack the title and meta information vertically (title on top, meta row below) with `4.dp` gap, matching the web's `.chit-header-row { flex-direction: column }` at 480px
2. WHEN the title renders in the stacked layout, THE App SHALL allow full word-wrapping without truncation (no `maxLines` limit), matching the web's `white-space: normal; word-break: break-word`
3. WHEN the meta row renders in the stacked layout, THE App SHALL use `12.sp` font size with `FlowRow` wrapping, matching the web's `.chit-header-meta { font-size: 0.78em; flex-wrap: wrap }`

### Requirement 16: Divider and Border Color Consistency

**User Story:** As a user, I want all dividers and borders throughout the app to use the warm brown color, not neutral grey.

#### Acceptance Criteria

1. WHEN a HorizontalDivider renders anywhere in the app (sidebar, settings, editor zones, lists), THE App SHALL use `color = Color(0xFF8B5A2B)` with `thickness = 1.dp`, matching the web's `border: 1px solid #8b5a2b` pattern
2. WHEN a card or panel border renders, THE App SHALL use `Color(0xFF8B5A2B)` (not Material3's default outline color), matching the web's consistent brown border usage
3. WHEN the gold divider variant is needed (between major sections), THE App SHALL use `Color(0xFFC9B896)`, matching the web's `--outline-variant / gold divider` color

