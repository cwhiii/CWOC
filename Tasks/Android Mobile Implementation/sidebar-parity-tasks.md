# Android Sidebar Parity — Task Tracker

**Spec**: `sidebar-parity-spec.md`
**Web Reference**: `/Tasks/sidebar-mobile-spec.md`

---

## Phase 1: Foundation (State & Components)

### Task 1.1: Create SidebarStateViewModel
- [x] Create `ui/viewmodel/SidebarStateViewModel.kt`
- [x] Define `SidebarState` data class with all fields:
  - `currentDate: LocalDate`
  - `currentPeriod: String` (Itinerary|Day|Work|Week|SevenDay|Month|Year)
  - `dateRangeDisplay: String`
  - `yearDisplay: String`
  - `projectsViewMode: String` (list|kanban)
  - `alarmsViewMode: String` (list|independent|notifications|reminders)
  - `tasksViewMode: String` (tasks|habits|assigned)
  - `monthMode: String` (compress|scroll)
  - `habitsSuccessWindow: Int` (7|30|90|-1)
  - `habitsIncludeRules: Boolean`
  - `indicatorsRange: String` (day|week|month|year|all)
  - `indicatorsCustomStart: String?`
  - `indicatorsCustomEnd: String?`
  - `indicatorsVisibleGraphs: Set<String>`
  - `searchText: String`
  - `savedSearches: List<String>`
- [x] Expose as `StateFlow<SidebarState>`
- [x] Add update functions for each field
- [x] Persist view modes and period to SharedPreferences
- [x] Restore on init from SharedPreferences
- [x] Inject via Hilt, scope to activity

### Task 1.2: Update FilterState
- [x] Add `showUnmarked: Boolean = true`
- [x] Add `showComplete: Boolean = true`
- [x] Change `showDeclined: Boolean = true` (was false)
- [x] Add `showHabits: Boolean = true`
- [x] Add `showEmailReceived: Boolean = false`
- [x] Add `showEmailSent: Boolean = false`
- [x] Add `sharedWithMe: Boolean = false`
- [x] Add `sharedByMe: Boolean = false`
- [x] Add `searchText: String = ""`
- [x] Add `projectFilter: String? = null`
- [x] Update `activeFilterCount` to include all new fields

### Task 1.3: Update SortField Enum
- [x] Add `RANDOM` to `SortField` enum
- [x] Add `UPCOMING` to `SortField` enum
- [x] Update `SortField.displayLabel()` in `SortPanel.kt`:
  - RANDOM → "Random / Shuffle"
  - UPCOMING → "Upcoming (Due Soon)"
- [x] Rename section title from "Sort" to "Order" (matches web label)
- [x] Layout: Horizontal row — [Dropdown (flex:1)] [Direction button]
  - Dropdown is a standard select/spinner, NOT an exposed text field
  - Direction button is a small square icon button (▲/▼)

### Task 1.4: Create CollapsibleSection Composable
- [x] Create `ui/components/CollapsibleSection.kt`
- [x] Parameters: `title: String`, `initiallyExpanded: Boolean = false`, `content: @Composable () -> Unit`
- [x] Header row: expand/collapse arrow (▶/▼) + title text
- [x] Animated expand/collapse of body (AnimatedVisibility)
- [x] Clickable header to toggle
- [x] Style: brown text, 0.85em label size

### Task 1.5: Create SidebarCompactButton Composable
- [x] Create `ui/components/SidebarCompactButton.kt`
- [x] Parameters: `text: String`, `onClick: () -> Unit`, `modifier: Modifier`
- [x] Style: Brown background (#8B5A2B), parchment text (#FFF8E1), compact padding, 0.8em text
- [x] `Modifier.weight(1f)` when used in a Row (fills half)

### Task 1.6: Add "None" Sort Option
- [x] Add `NONE` to `SortField` enum (or treat null/MANUAL as "no sort")
- [x] The sort dropdown must have "— None —" as the first/default option meaning no sorting applied
- [x] When "None" is selected, chits display in their natural/default order
- [x] Sort direction button hidden when NONE, MANUAL, RANDOM, or UPCOMING is selected

---

## Phase 2: Filter & Sort Engine Updates

### Task 2.1: Update FilterEngine — New Filter Dimensions
- [x] `showUnmarked`: If false, hide chits that are neither pinned nor archived nor snoozed
- [x] `showComplete`: If false, hide chits with status "Complete"
- [x] `showDeclined`: If false, hide chits with status "Rejected" or "Declined"
- [x] `showHabits`: If false, hide chits with `is_habit` flag or habit recurrence
- [x] `showEmailReceived`: If true in non-email views, include received email chits
- [x] `showEmailSent`: If true in non-email views, include sent email chits
- [x] `sharedWithMe`: If true, show only chits shared with current user
- [x] `sharedByMe`: If true, show only chits shared by current user
- [x] `searchText`: Filter by title/notes containing text (case-insensitive)
- [x] `projectFilter`:
  - `null` → no filter
  - `"__any__"` → only chits with a project
  - `"__none__"` → only chits without a project
  - specific ID → only chits in that project

### Task 2.2: Update SortEngine — New Sort Fields
- [x] `RANDOM`: Shuffle list randomly (new random order each application)
- [x] `UPCOMING`: Sort by nearest upcoming due date; nulls sort last
- [x] Update `SortPanel.kt`: Hide direction button when field is NONE, MANUAL, RANDOM, or UPCOMING
- [x] When sort field changes, reset direction to ASC (matches web behavior)

### Task 2.3: Priority Filter Options Parity
- [ ] Change priority options from `["Critical", "High", "Medium", "Low"]` to `["Low", "Medium", "High"]`
- [ ] Update `FilterPanel.kt` priority section

### Task 2.4: Status Filter — Add "Any" Toggle Logic
- [ ] Add "Any" option at top of status filter (checked by default)
- [ ] When "Any" is checked, uncheck all specific options
- [ ] When any specific option is checked, uncheck "Any"
- [ ] When all specific options are unchecked, re-check "Any"
- [ ] Same logic for Priority filter
- [ ] Layout: Vertical list of checkboxes with labels (matching web), NOT horizontal chips
  - Web uses: vertical column of `<label><input type="checkbox"> Status Name</label>`
  - Each option on its own line with a checkbox + label
  - "Clear" button below each group resets to "Any" checked
- [ ] Apply same vertical checkbox layout to Priority filter

---

## Phase 3: Sidebar Restructure

### Task 3.1: Restructure SidebarContent Layout
- [x] Remove current flat navigation list
- [x] Implement two-region layout:
  - Scrollable content area (`Modifier.weight(1f).verticalScroll(...)`)
  - Bottom pinned section (no weight, no scroll)
- [x] Add a close/dismiss button at the very top of the sidebar (inside the drawer sheet)
  - Full width, brown background, parchment text, "⇤ Hide Sidebar"
  - Tapping it closes the drawer
- [x] Order sections top-to-bottom:
  1. Create Chit button
  2. Email Controls (conditional)
  3. Date Navigation
  4. Order (Sort)
  5. Time Period
  6. Calendar Options (conditional)
  7. Projects View Mode (conditional)
  8. Alarms View Mode (conditional)
  9. Tasks View Mode (conditional)
  10. Indicators Controls (conditional)
  11. Filters (collapsible)
  12. Quick Access Buttons
  13. Trash & Custom Objects
- [x] Bottom pinned: Settings, Reference + Help row, Version footer

### Task 3.2: Add Date Navigation Section
- [x] Today button: FULL WIDTH, calendar icon + "Today" text, standard action button style
- [x] Navigation row: horizontal flex — [◄ Prev button] [Center: Year text + Date Range text stacked] [Next ► button]
  - Prev/Next are small square buttons
  - Center area is flex:1, text centered, year on top line, range on second line
- [x] Wire to SidebarStateViewModel callbacks
- [x] Date range text updates dynamically from state
- [x] Always visible regardless of tab

### Task 3.3: Add Time Period Selector
- [x] Dropdown with options: Itinerary, Day, Work Hours, Week, X Days, Month, Year
- [x] Default: Week
- [x] Wire to SidebarStateViewModel.currentPeriod
- [x] Always visible regardless of tab

### Task 3.4: Add Calendar Options Section
- [x] Visible ONLY when: Calendar tab active AND Month period selected
- [x] Collapsible "Options" header
- [x] Month Mode segmented button: "Compress" (default) | "Scroll"
- [x] Wire to SidebarStateViewModel.monthMode

### Task 3.5: Add Projects View Mode Section
- [x] Visible ONLY when Projects tab active
- [x] Label: "View Mode"
- [x] Two buttons in row: "📋 List" (default) | "📊 Kanban"
- [x] Active button highlighted (ivory background)
- [x] Wire to SidebarStateViewModel.projectsViewMode

### Task 3.6: Add Alarms View Mode Section
- [x] Visible ONLY when Alarms tab active
- [x] Label: "View Mode"
- [x] 2×2 grid: "📋 Chits" | "🛎️ Independent" | "🔔 Notifs" | "📢 Reminders"
- [x] Active button highlighted
- [x] Wire to SidebarStateViewModel.alarmsViewMode

### Task 3.7: Add Tasks View Mode Section
- [x] Visible ONLY when Tasks tab active
- [x] Label: "View Mode"
- [x] Three buttons in row: "📋 Tasks" (default) | "🎯 Habits" | "📌 Assigned"
- [x] Active button highlighted
- [x] Wire to SidebarStateViewModel.tasksViewMode
- [x] When Habits mode selected, show sub-options:
  - Success Window dropdown: 7 days / 30 days (default) / 90 days / All time
  - Rule Habits checkbox: "Include in success rate"
- [x] Wire to SidebarStateViewModel.habitsSuccessWindow and habitsIncludeRules

### Task 3.8: Add Indicators Controls Section
- [x] Visible ONLY when Indicators tab active
- [x] Time Range: 5 buttons in a HORIZONTAL FLEX-WRAP row (all same width, wrap to second line if needed): Day (default) | Week | Month | Year | All
- [x] Custom Range: VERTICAL STACK layout:
  - Start date input (full width)
  - End date input (full width)
  - "Go" button (full width)
- [x] Show Graphs: Scrollable multi-select list of checkboxes (max-height ~200dp, vertical list)
- [x] Add Graph: Collapsible section (▶ + Add Graph), body is scrollable list (max-height ~250dp)
- [x] Wire to SidebarStateViewModel indicators fields

---

## Phase 4: Filter Panel Overhaul

### Task 4.1: Make Filters Section Collapsible
- [ ] Wrap entire filter panel in CollapsibleSection
- [ ] Default state: collapsed
- [ ] Header layout: HORIZONTAL ROW with:
  - Left: Clickable label "▶ 🔍 Filters" / "▼ 🔍 Filters" (flex:1)
  - Right: "✕ Clear" button (small, compact) — visible only when filters active
  - Right: "↩ Defaults" button (small, compact) — visible only when tab has custom defaults
- [ ] Tapping the label toggles expand/collapse
- [ ] Clear and Defaults buttons do NOT toggle expand/collapse (they have their own actions)

### Task 4.2: Add Filter Text (Search) with Saved Searches
- [ ] Label above input: "Filter Text" (matching web)
- [ ] Text input at top of filters body: FULL WIDTH, placeholder "Filter Chits..."
- [ ] Real-time filtering on text change (debounced)
- [ ] Wire to FilterState.searchText
- [ ] Save button/icon next to search field (or at end of input row)
- [ ] Saved searches row below: HORIZONTAL SCROLLABLE row of chips (flex-wrap)
  - Each chip shows the saved search text
  - Tap chip → populate search field and trigger filter
  - Long-press chip → delete it (with confirmation)
- [ ] Store in SharedPreferences as JSON array
- [ ] Wire to SidebarStateViewModel.savedSearches

### Task 4.3: Make Each Filter Sub-Group Collapsible
- [ ] Status: collapsible, default collapsed
- [ ] Priority: collapsible, default collapsed
- [ ] Tags: collapsible, default collapsed
- [ ] People: collapsible, default collapsed
- [ ] Project: collapsible, default collapsed
- [ ] Display: collapsible, default collapsed
- [ ] Each has its own expand/collapse toggle

### Task 4.4: Add Project Filter
- [ ] New collapsible sub-group "Project"
- [ ] Dropdown with options:
  - "—" (no filter)
  - "Any (has a project)"
  - "None (no project)"
  - Dynamic: one per project master chit, sorted alphabetically
- [ ] Wire to FilterState.projectFilter
- [ ] Clear button resets to null
- [ ] Populate from ChitRepository (project masters)

### Task 4.5: Update Display Toggles — Full List
- [ ] Rewrite display toggles section with ALL 14 items as CHECKBOXES (not switches):
  - Layout: Vertical list, each item is a row with checkbox + emoji + label
  - ☑ 📌 Pinned (default: true)
  - ☐ 📦 Archived (default: false)
  - ☐ 😴 Snoozed (default: false)
  - ☑ 📄 Unmarked (default: true)
  - --- visual separator (thin dashed line) ---
  - ☑ ⏰ Past-Due (default: true)
  - ☑ ✅ Complete (default: true)
  - ☑ ✗ Declined (default: true)
  - ☑ 🎯 Habits (default: true)
  - ☐ 📨 Email Received (default: false)
  - ☐ 📤 Email Sent (default: false)
  - --- visual separator (thin dashed line) ---
  - ☐ 🔗 Shared with me (default: false)
  - ☐ 📤 Shared by me (default: false)
- [ ] Wire each to corresponding FilterState field
- [ ] Use Checkbox composable (NOT Switch) to match web's checkbox style
- [ ] Visual separators (HorizontalDivider with dashed style or low opacity) between the 3 groups

### Task 4.6: Tag Filter — Tree with Search
- [ ] "Select All / Select None" button at top (full width)
  - Text toggles: shows "Select All" when not all selected, "Select None" when all selected
  - Active state (all selected): brown background, light text
  - Inactive state: transparent background, brown border
- [ ] Search input below button: full width, placeholder "Search tags...", filters visible tags in real-time
- [ ] Hierarchical tree below search:
  - Tags organized by parent/child via "/" separator (e.g., "Work/Projects" is child of "Work")
  - Parent tags show expand/collapse arrow (▶/▼) to show/hide children
  - Children are indented under their parent
  - Flat tags (no "/") appear at root level
- [ ] Each tag row shows:
  - Checkbox (checked = selected for filtering)
  - Tag name with COLORED BACKGROUND BADGE (color from tag's `color` setting, or auto-generated pastel)
  - Favorite tags show ★ prefix and sort to the top of their level
- [ ] SELECTED (active) tag visual state:
  - Checkbox: checked
  - Tag badge: `font-weight: bold`, `outline: 2px solid #4A2C2A`
  - Full opacity
- [ ] UNSELECTED (inactive) tag visual state:
  - Checkbox: unchecked
  - Tag badge: normal weight, no outline
  - Full opacity (NOT dimmed — only people chips dim when unselected)
- [ ] Tap anywhere on tag row: toggle selection (check/uncheck)
- [ ] Long-press on tag row: select ONLY this tag (deselect all others)
- [ ] Search: hides non-matching tags in real-time, shows parent containers if any child matches
- [ ] Clear button below tree: empties all tag selection
- [ ] Wire to FilterState.tags
- [ ] Empty selection = show all chits (no tag filtering applied)

### Task 4.7: People Filter — Chips with Search
- [ ] Search input: filters visible chips (full width text field at top)
- [ ] Merged list: contacts + system users
- [ ] Sorted: favorites first, then alphabetical
- [ ] Layout: VERTICAL COLUMN of chips (one per line, not a flow/wrap row)
- [ ] Each chip: horizontal row containing thumbnail + display name + favorite star
  - Background color: person's assigned color
  - Text color: auto-contrasted (dark on light, light on dark)
- [ ] Contact chips: 1dp border matching their color
- [ ] User chips: 2dp dark brown border (#1A1208), user icon placeholder if no image
- [ ] Selected: bold text, 2dp outline (#4A2C2A), full opacity
- [ ] Unselected: 0.7 opacity
- [ ] Tap: toggle selection
- [ ] Clear button below: empties selection
- [ ] Wire to FilterState.people

### Task 4.8: Clear All Button Logic
- [ ] Show "Clear" button when `activeFilterCount > 0` OR sort is non-default
- [ ] On tap: reset to custom view defaults (if exist for tab) or system defaults
- [ ] System defaults: all fields at their default values in FilterState constructor

### Task 4.9: Defaults Button Logic
- [ ] Read `custom_view_filters` from synced settings
- [ ] Parse JSON: `{ "Calendar": {...}, "Tasks": {...}, ... }`
- [ ] Show "Defaults" button only when current tab has custom filters
- [ ] On tap: apply the tab's custom filter state
- [ ] Structure: `{ statuses, priorities, tags, people, text, display, sort, project }`

---

## Phase 5: Quick Access & Navigation

### Task 5.1: Add Quick Access Buttons Section
- [ ] Section between Filters and Trash
- [ ] Row 1 (full width): People button (icon + "People") → Contacts screen
- [ ] Row 2 (half-width): 🗺️ Maps | 🌤️ Weather
- [ ] Row 3 (half-width): 🕐 Clock | 📺 Kiosk
- [ ] Row 4 (half-width): 🧮 Calculator | 🤖 Rules
- [ ] All navigation buttons close sidebar after action
- [ ] Use SidebarCompactButton composable for half-width buttons

### Task 5.2: Trash & Custom Objects Row
- [ ] Own section below Quick Access
- [ ] Two half-width buttons: 🗑️ Trash | 🧩 Custom Objects
- [ ] Both close sidebar and navigate

### Task 5.3: Bottom Pinned Section
- [ ] Non-scrolling, pinned at bottom of sidebar
- [ ] Settings button (full width): icon + "Settings" → Settings screen
- [ ] Row: 📖 Reference | 📘 Help (half-width)
- [ ] Version footer: centered, small, low opacity, shows version number
- [ ] Separated from scrollable content by border-top divider

### Task 5.4: Clock Modal/Dialog
- [ ] Create `ui/dialogs/ClockDialog.kt`
- [ ] Shows world clocks from settings (saved_locations with timezone)
- [ ] Each clock: location name, current time (updating), timezone offset
- [ ] If no clocks configured: message directing to Settings
- [ ] Close/dismiss button
- [ ] Opens when Clock button tapped in sidebar

### Task 5.5: Calculator Dialog
- [ ] Create `ui/dialogs/CalculatorDialog.kt`
- [ ] Basic calculator UI (number pad, operators, display)
- [ ] Or simple expression evaluator with text input
- [ ] Close/dismiss button
- [ ] Opens when Calculator button tapped in sidebar

### Task 5.6: Kiosk Navigation
- [ ] When Kiosk button tapped:
  - If Kiosk screen exists → navigate to it
  - If not → show toast "Kiosk view coming soon"
- [ ] Close sidebar after action

### Task 5.7: Reference Dialog
- [ ] Create `ui/dialogs/ReferenceDialog.kt`
- [ ] Content: gesture and interaction reference for Android
  - Swipe right from left edge → open sidebar
  - Swipe left from right edge → open Views panel
  - Long-press chit → quick edit
  - Tap chit → open in editor
  - Swipe left on chit → actions (if implemented)
  - Pull to refresh
- [ ] Close/dismiss button
- [ ] Opens when Reference button tapped in sidebar

---

## Phase 6: Wiring & Integration

### Task 6.1: Wire Sidebar State to Calendar Screen
- [ ] CalendarScreen reads `currentPeriod` from SidebarStateViewModel
- [ ] CalendarScreen reads `currentDate` for navigation
- [ ] CalendarScreen reads `monthMode` for month view rendering
- [ ] Date navigation callbacks update SidebarStateViewModel
- [ ] Period changes update SidebarStateViewModel
- [ ] Remove duplicate state in CalendarViewModel (or sync bidirectionally)

### Task 6.2: Wire Sidebar State to Tasks Screen
- [ ] TasksScreen reads `tasksViewMode` from SidebarStateViewModel
- [ ] Renders different content based on mode (tasks list, habits view, assigned view)
- [ ] Habits mode reads `habitsSuccessWindow` and `habitsIncludeRules`

### Task 6.3: Wire Sidebar State to Projects Screen
- [ ] ProjectsScreen reads `projectsViewMode` from SidebarStateViewModel
- [ ] Renders list view or kanban view based on mode

### Task 6.4: Wire Sidebar State to Alarms Screen
- [ ] AlarmsScreen reads `alarmsViewMode` from SidebarStateViewModel
- [ ] Renders different content based on mode (chits list, independent board, notifications, reminders)

### Task 6.5: Wire Sidebar State to Indicators Screen
- [ ] IndicatorsScreen reads range, custom dates, visible graphs from SidebarStateViewModel
- [ ] Updates chart rendering based on sidebar selections

### Task 6.6: Wire Search Text to All List Views
- [ ] All list views (Tasks, Notes, Checklists, Projects, Alarms, Calendar, Email) filter by `searchText`
- [ ] Real-time filtering as text changes
- [ ] Case-insensitive match on title and notes content

### Task 6.7: Update MainActivity — Pass SidebarStateViewModel
- [ ] Instantiate SidebarStateViewModel in MainActivity
- [ ] Pass to SidebarContent composable
- [ ] Pass to CwocNavGraph (or individual screens via Hilt)
- [ ] Wire selectedTab to SidebarStateViewModel for conditional visibility

### Task 6.8: Email Tab — Create Chit Behavior
- [ ] When Email tab active, Create Chit navigates to editor with email zone pre-opened
- [ ] Pass parameter to editor route (e.g., `editor/new?zone=email`)
- [ ] Editor reads parameter and auto-opens email zone

### Task 6.9: Create Chit — Long-Press Quick Alert
- [ ] Long-press on the Create Chit button opens a Quick Alert modal/dialog
- [ ] Quick Alert allows creating a quick reminder/alarm/timer/stopwatch without full editor
- [ ] If Quick Alert modal doesn't exist yet, create a basic version or show toast placeholder

### Task 6.10: Weather Button — Long-Press Opens Weather Modal
- [ ] Long-press on the Weather quick-access button opens a weather summary modal/dialog
- [ ] Shows current weather conditions inline (without navigating to full Weather screen)
- [ ] Regular tap still navigates to full Weather screen
- [ ] If weather modal doesn't exist yet, create a basic version showing current conditions

### Task 6.11: People Filter — Refresh on Visibility
- [ ] When the sidebar is opened, refresh the people filter data (re-fetch contacts + users)
- [ ] Ensures newly added contacts appear without app restart
- [ ] Debounce to avoid excessive API calls (only refresh if >30s since last fetch)

### Task 6.12: Tag Filter — Descendant Matching
- [ ] When a parent tag is selected, chits with any descendant tag also match
- [ ] Example: selecting "Work" also matches chits tagged "Work/Projects" or "Work/Meetings"
- [ ] Uses "/" separator to determine parent/child relationships
- [ ] Update FilterEngine tag matching logic to include descendants

---

## Phase 7: Behavior & Polish

### Task 7.1: Sidebar Close Behavior
- [ ] Verify: navigation buttons close sidebar (People, Maps, Weather, Clock, Kiosk, Calculator, Rules, Trash, Custom Objects, Settings, Help, Create Chit)
- [ ] Verify: filter/sort/mode/period/date changes do NOT close sidebar
- [ ] Fix any incorrect close behavior

### Task 7.2: Swipe Gestures
- [ ] Verify: left-edge swipe right opens sidebar (Material3 drawer default)
- [ ] Verify: swipe left closes sidebar
- [ ] Verify: backdrop tap closes sidebar
- [ ] Verify: sidebar doesn't open when Views panel is open
- [ ] Verify: CWOC logo in TopAppBar also opens sidebar (matches web where logo tap toggles sidebar)
- [ ] Fix any issues

### Task 7.3: Per-Tab Sort Persistence
- [ ] Verify existing implementation in FilterSortViewModel
- [ ] Ensure `onTabChanged()` loads correct sort for new tab
- [ ] Ensure sort changes persist immediately
- [ ] Default: MANUAL ascending

### Task 7.4: Filter State Persistence (App Background)
- [ ] On app going to background: save display toggles to SharedPreferences
- [ ] On app launch: restore display toggles from SharedPreferences
- [ ] Save: sort state, view modes, period, display toggles
- [ ] Do NOT save: status/priority/tag/people selections (reset on launch)

### Task 7.5: Custom View Filters — Per-Tab Defaults
- [ ] Read `custom_view_filters` from SettingsRepository
- [ ] Parse JSON structure per tab
- [ ] On tab switch: if custom filters exist, auto-apply them
- [ ] Clear button: reset to custom defaults (or system defaults if none)
- [ ] Defaults button: apply custom defaults

### Task 7.6: Notification System Verification
- [ ] Verify notification badge in TopAppBar works
- [ ] Verify notifications fetched and cached
- [ ] Verify new notifications trigger toasts
- [ ] Verify bell icon navigates to Notifications screen

### Task 7.8: Email Trash Folder Navigation
- [ ] Verify: When "Trash" is selected in the email folder radio buttons, it navigates to the Trash screen with an email filter applied (not just changes the folder variable)
- [ ] This matches web behavior where email Trash navigates to `/frontend/html/trash.html?filter=email`

### Task 7.9: Email Account Error State
- [ ] Verify: Account filter pills show error state (⚠️ icon, red/warning styling) when an account has sync errors
- [ ] Error details shown on tap (or in tooltip)

### Task 7.10: Email Account Filter — Pill Button Layout
- [ ] Account filter should use PILL BUTTONS (not checkboxes) matching web layout
- [ ] Each pill: shows account nickname, colored background, toggles in/out on tap
- [ ] Active pills: highlighted (full opacity, bold)
- [ ] Inactive pills: dimmed
- [ ] Error pills: red/warning styling with ⚠️ prefix
- [ ] Layout: horizontal flex-wrap row of pills
- [ ] Only visible when multiple accounts are configured

### Task 7.11: Email Folder — Collapsible Group
- [ ] The folder radio buttons should be inside a collapsible group
- [ ] Header: "▼ Folder" (click to expand/collapse)
- [ ] Default: expanded
- [ ] Matches web's collapsible folder group pattern
- [ ] Unread-at-top checkbox is OUTSIDE the folder group (separate item below it)
- [ ] Email controls internal order (top to bottom):
  1. Check Mail button (full width)
  2. Account filter pills (flex-wrap row)
  3. Folder group (collapsible, radio buttons: Inbox, Sent, Drafts, Scheduled, Trash)
  4. Unread at top checkbox

### Task 7.7: Sidebar State Restoration on Launch
- [ ] Restore last active tab
- [ ] Restore time period
- [ ] Restore view modes (projects, alarms, tasks)
- [ ] Restore month mode
- [ ] Restore habits options
- [ ] Restore indicators range
- [ ] Do NOT restore date (always start at today)

---

## Phase 8: Visual Styling

### Task 8.1: Sidebar Parchment Theme
- [ ] Background: Color(0xFFFFFAF0) or parchment drawable
- [ ] Section labels: Bold, ~14sp, Color(0xFF4A3728)
- [ ] Filter labels: ~13sp, Color(0xFF4A3728)
- [ ] Buttons: Background Color(0xFF8B5A2B), text Color(0xFFFFF8E1), border Color(0xFF5A3F2A)
- [ ] Inputs: Background Color(0xFFF5E6CC), border Color(0xFF6B4E31)
- [ ] Dividers: Color(0xFF6B4E31) at 0.3 alpha
- [ ] Active/selected: Brown highlight tones
- [ ] Compact buttons: Same style, smaller text (~12sp)

### Task 8.2: View Mode Button Styling
- [ ] Active button: ivory background, dark brown text
- [ ] Inactive button: standard brown background, parchment text
- [ ] Consistent across all view mode sections (Projects, Alarms, Tasks)

### Task 8.3: Tag Color Badges
- [ ] Each tag in the filter tree shows its color as a rounded background badge behind the tag name
- [ ] Badge color comes from the tag's `color` field in settings (or auto-generated pastel via `getPastelColor(name)`)
- [ ] Text color on badge: auto-contrasted — dark text (#3C2F2F) on light backgrounds, white text on dark backgrounds
- [ ] Use `isLightColor()` equivalent to determine contrast
- [ ] Selected tags: badge gets bold text + 2dp solid outline (#4A2C2A)
- [ ] Unselected tags: badge has normal weight, no outline
- [ ] Favorite tags show ★ prefix before the tag name (inside the badge)
- [ ] Badge has small border-radius (4dp) and horizontal padding (6dp)

### Task 8.4: People Chip Styling
- [ ] Background: person's assigned color
- [ ] Text: auto-contrasted
- [ ] Selected: bold, 2dp outline, full opacity
- [ ] Unselected: 0.7 opacity
- [ ] User chips: thicker border (2dp dark brown)
- [ ] Contact chips: 1dp border matching color

---

## Completion Checklist

When ALL tasks above are done, verify against these acceptance criteria:

- [ ] 1. Sidebar opens via hamburger button tap
- [ ] 2. Sidebar opens via left-edge swipe
- [ ] 3. Sidebar closes via backdrop tap
- [ ] 4. Sidebar closes via swipe-left
- [ ] 5. Sidebar has a visible "Hide Sidebar" close button at the top
- [ ] 6. Create Chit button with correct behavior per tab (Email → email zone)
- [ ] 7. Create Chit long-press opens Quick Alert
- [ ] 8. Email controls (Check Mail, account pills, folder radios, unread toggle)
- [ ] 9. Date navigation (Today, Prev, Next, year/range display)
- [ ] 10. Sort dropdown with "— None —" + ALL 9 sort options + direction toggle
- [ ] 11. Sort direction hidden for None/Manual/Random/Upcoming
- [ ] 12. Time Period dropdown with all 7 options
- [ ] 13. Calendar Options (Month compress/scroll) — conditional on Calendar + Month
- [ ] 14. Projects View Mode (List/Kanban) — conditional on Projects tab
- [ ] 15. Alarms View Mode (Chits/Independent/Notifs/Reminders) — conditional on Alarms tab
- [ ] 16. Tasks View Mode (Tasks/Habits/Assigned) — conditional on Tasks tab
- [ ] 17. Habits sub-options (success window, rule habits) — conditional on Habits mode
- [ ] 18. Indicators controls (range, custom range, graphs) — conditional on Indicators tab
- [ ] 19. Filters section — collapsible, default collapsed
- [ ] 20. Filter Text with saved searches (save, tap to apply, long-press to delete)
- [ ] 21. Status filter (Any + 5 options with mutual exclusion logic)
- [ ] 22. Priority filter (Any + 3 options: Low, Medium, High)
- [ ] 23. Tags filter (tree, search, select all/none, colors, favorites, descendant matching)
- [ ] 24. People filter (chips, search, contacts + users, colors, thumbnails, refresh on open)
- [ ] 25. Project filter (dropdown: —, Any, None, + dynamic project list)
- [ ] 26. Display toggles (ALL 14 checkboxes with correct defaults and separators)
- [ ] 27. Clear button with correct visibility logic
- [ ] 28. Defaults button with per-tab custom filter support
- [ ] 29. Quick access buttons (People, Maps, Weather, Clock, Kiosk, Calculator, Rules)
- [ ] 30. Weather long-press opens weather modal
- [ ] 31. Trash + Custom Objects buttons
- [ ] 32. Bottom pinned section (Settings, Reference, Help, Version) — non-scrolling
- [ ] 33. Correct section visibility per active tab (visibility matrix)
- [ ] 34. Sidebar stays open during filter/sort/mode/period/date changes
- [ ] 35. Sidebar closes on navigation actions (People, Maps, Settings, etc.)
- [ ] 36. Per-tab sort persistence (SharedPreferences)
- [ ] 37. State restoration on app launch (view modes, period, display toggles)
- [ ] 38. Custom view filters per-tab (auto-apply on tab switch)
- [ ] 39. CWOC parchment theme styling throughout
- [ ] 40. All filter sub-groups independently collapsible
