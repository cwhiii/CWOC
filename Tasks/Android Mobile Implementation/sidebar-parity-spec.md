# Android Sidebar Full Parity Spec

## Reference Document
`/Tasks/sidebar-mobile-spec.md` — the exhaustive web sidebar specification.

## Current Android State
The Android app has a `ModalNavigationDrawer` (left sidebar) with:
- ✅ New Chit button
- ✅ Navigation links (Search, Settings, Contacts, Trash, Help, Weather, Map, Audit Log, Custom Objects, Rules, User Admin, Attachments)
- ✅ Email controls (folder radios, account checkboxes, unread-at-top, Check Mail)
- ✅ Filter panel (status, priority, tags, people, display toggles, color, date range)
- ✅ Sort panel (field dropdown + direction toggle)
- ✅ Version footer
- ❌ Missing: Date navigation (Today, Prev/Next, year/week display)
- ❌ Missing: Time Period selector
- ❌ Missing: Calendar Options (Month compress/scroll toggle)
- ❌ Missing: View Mode sections (Projects: List/Kanban, Alarms: Chits/Independent/Notifs/Reminders, Tasks: Tasks/Habits/Assigned)
- ❌ Missing: Indicators controls (time range, custom range, show/add graphs)
- ❌ Missing: Habits sub-options (success window, rule habits checkbox)
- ❌ Missing: Saved searches
- ❌ Missing: Project filter dropdown
- ❌ Missing: "Unmarked" display toggle
- ❌ Missing: "Complete" display toggle
- ❌ Missing: "Declined" display toggle (exists but labeled differently)
- ❌ Missing: "Habits" display toggle
- ❌ Missing: "Email (Received)" / "Email (Sent)" display toggles
- ❌ Missing: "Shared with me" / "Shared by me" display toggles
- ❌ Missing: Sort options: Random/Shuffle, Upcoming (Due Soon)
- ❌ Missing: Clear All button with visibility logic
- ❌ Missing: Defaults button (per-tab custom view defaults)
- ❌ Missing: Kiosk button
- ❌ Missing: Calculator button
- ❌ Missing: Clock button
- ❌ Missing: Rules button (exists as nav link but not as quick-access)
- ❌ Missing: Reference button
- ❌ Missing: Proper section ordering matching web

---

## Implementation Tasks

Every task below is MANDATORY. Skipping any single item is a failure.

### Task 1: Restructure Sidebar Section Order

The sidebar content must be reordered to match the web's exact top-to-bottom layout:

1. Create Chit button
2. Email Controls (conditional — Email tab only)
3. Date Navigation (Today + Prev/Next with year/week display)
4. Order (Sort dropdown + direction)
5. Time Period selector
6. Calendar Options (conditional — Calendar tab + Month period)
7. View Mode — Projects (conditional — Projects tab)
8. View Mode — Alarms (conditional — Alarms tab)
9. View Mode — Tasks (conditional — Tasks tab, with Habits sub-options)
10. Indicators Controls (conditional — Indicators tab)
11. Filters (collapsible section with all sub-groups)
12. Quick Access Buttons (People, Maps, Weather, Clock, Kiosk, Calculator, Rules)
13. Trash & Custom Objects
14. Bottom Pinned: Settings, Reference, Help, Version

**Files to modify**: `SidebarContent.kt`

---

### Task 2: Add Date Navigation Section

Add a date navigation section to the sidebar with:
- **Today button**: Icon + "Today" text. Calls a callback to jump to current date.
- **Navigation row**: [◄ Prev] [Year + Date Range display] [Next ►]
  - Previous button: Navigates to previous period
  - Center: Shows year (e.g., "2026") and date range (e.g., "May 18 – May 24")
  - Next button: Navigates to next period
- This section is always visible regardless of active tab.
- The date range text updates dynamically based on the current period and selected date.

**New composable**: `DateNavigationSection` in `SidebarContent.kt` or a new file.
**State needed**: Current date, current period, formatted range string — passed from CalendarViewModel or a shared ViewModel.

---

### Task 3: Add Time Period Selector

Add a dropdown selector for time period with these exact options:
- Itinerary
- Day
- Work Hours
- Week (default)
- X Days
- Month
- Year

This is always visible in the sidebar. Changing it updates the calendar view period.

**State**: Needs to be shared between sidebar and CalendarViewModel. Either lift period state to a shared ViewModel or pass callbacks.

---

### Task 4: Add Calendar Options Section (Conditional)

Add a collapsible "Options" section visible ONLY when:
- Calendar tab is active AND Month period is selected

Contents:
- **Month Mode toggle** (2-value pill/segmented button):
  - "Compress" (default) — fixed-height month cells
  - "Scroll" — scrollable month cells
- Uses a `SegmentedButton` or custom pill toggle composable.

**State**: `monthMode: String` ("compress" | "scroll") in CalendarViewModel or shared state.

---

### Task 5: Add Projects View Mode Section (Conditional)

Add a "View Mode" section visible ONLY when Projects tab is active.

Two buttons in a horizontal row:
- "📋 List" — default active
- "📊 Kanban"

Active button is visually highlighted (different background).
Switching mode changes how the Projects screen renders its content.

**State**: `projectsViewMode: String` ("list" | "kanban") in a ProjectsViewModel or shared state.

---

### Task 6: Add Alarms View Mode Section (Conditional)

Add a "View Mode" section visible ONLY when Alarms/Alerts tab is active.

Four buttons in a 2×2 grid:
- "📋 Chits" (list mode) — default
- "🛎️ Independent"
- "🔔 Notifs"
- "📢 Reminders"

Active button is visually highlighted.

**State**: `alarmsViewMode: String` ("list" | "independent" | "notifications" | "reminders") in AlarmsViewModel or shared state.

---

### Task 7: Add Tasks View Mode Section (Conditional)

Add a "View Mode" section visible ONLY when Tasks tab is active.

Three buttons in a horizontal row:
- "📋 Tasks" — default active
- "🎯 Habits"
- "📌 Assigned"

When "Habits" mode is selected, show additional sub-options:

#### Habits Sub-Options (visible only in Habits mode):
- **Success Window dropdown**:
  - "Last 7 days"
  - "Last 30 days" (default)
  - "Last 90 days"
  - "All time"
- **Rule Habits checkbox**: "Include in success rate"

**State**: `tasksViewMode: String` ("tasks" | "habits" | "assigned"), `habitsSuccessWindow: Int` (7/30/90/-1), `habitsIncludeRules: Boolean` in TasksViewModel or shared state.

---

### Task 8: Add Indicators Controls Section (Conditional)

Add a section visible ONLY when Indicators tab is active.

Contents:
1. **Time Range buttons** (horizontal wrap, 5 buttons):
   - Day (default active), Week, Month, Year, All
   - Active button visually highlighted
2. **Custom Range**:
   - Start date picker (date input)
   - End date picker (date input)
   - "Go" button to apply custom range
3. **Show Graphs**: Multi-select list of available indicator graphs (checkboxes). Dynamically populated from indicator data.
4. **Add Graph** (collapsible): Expandable section listing available graphs that can be added. Dynamically populated.

**State**: Lives in `IndicatorsViewModel` — `selectedRange`, `customStart`, `customEnd`, `visibleGraphs`, `availableGraphs`.

---

### Task 9: Update Filter Panel — Add Missing Filters

The existing `FilterPanel.kt` is missing several filters that exist on web. Add ALL of the following:

#### 9a. Filter Text (Search)
- Text input field at the top of the filters section
- Placeholder: "Filter Chits..."
- Filters chits in real-time as user types
- **Saved Searches**: Below the text field, show a row of saved search chips (stored in SharedPreferences). Each chip populates the search field when tapped.

#### 9b. Project Filter
- Dropdown/spinner with options:
  - "—" (no filter, default)
  - "Any (has a project)" — shows only chits belonging to any project
  - "None (no project)" — shows only chits not in any project
  - Dynamically added: One entry per project master chit, sorted alphabetically
- Add `projectFilter: String?` to `FilterState`

#### 9c. Update Display Toggles
The current display toggles are incomplete. The FULL list must be:
- ☑ 📌 Pinned (default: checked)
- ☐ 📦 Archived (default: unchecked)
- ☐ 😴 Snoozed (default: unchecked)
- ☑ 📄 Unmarked (default: checked) — **NEW**
- --- separator ---
- ☑ ⏰ Past-Due (default: checked)
- ☑ ✅ Complete (default: checked) — **NEW**
- ☑ ✗ Declined (default: checked) — **UPDATE** (was "Show Declined" with default false)
- ☑ 🎯 Habits (default: checked) — **NEW**
- ☐ 📨 Email (Received) (default: unchecked) — **NEW**
- ☐ 📤 Email (Sent) (default: unchecked) — **NEW**
- --- separator ---
- ☐ 🔗 Shared with me (default: unchecked) — **NEW**
- ☐ 📤 Shared by me (default: unchecked) — **NEW**

Add to `FilterState`:
```kotlin
val showUnmarked: Boolean = true,
val showComplete: Boolean = true,
val showHabits: Boolean = true,
val showEmailReceived: Boolean = false,
val showEmailSent: Boolean = false,
val sharedWithMe: Boolean = false,
val sharedByMe: Boolean = false,
```

#### 9d. Update Sort Options
Add missing sort fields to `SortField` enum:
- `RANDOM` — "Random / Shuffle"
- `UPCOMING` — "Upcoming (Due Soon)"

The sort direction button should be hidden when sort is MANUAL, RANDOM, or UPCOMING (same as web).

---

### Task 10: Add Clear All Button with Visibility Logic

Add a "Clear" button next to the Filters section header. It must:
- Be visible ONLY when any filter is in a non-default state
- Reset all filters to either:
  1. Custom view defaults for the current tab (if configured), OR
  2. System defaults (hardcoded baseline)

**Visibility conditions** (show if ANY is true):
- Any status filter is selected
- Any priority filter is selected
- Search text is non-empty
- Any tags are selected
- Any people are selected
- Any display toggle differs from default
- Any sharing filter is checked
- Sort field is set (not "None"/MANUAL)
- Project filter is set
- Color filter is set
- Date range is set

---

### Task 11: Add Defaults Button

Add a "Defaults" button next to the Clear button. It must:
- Be visible ONLY when the current tab has custom default filters configured (from settings)
- Reset filters to the tab's configured default filter state
- This requires reading `custom_view_filters` from settings (synced from server)

---

### Task 12: Make Filters Section Collapsible

The entire Filters section must be collapsible:
- Header shows "▶ Filters" (collapsed) or "▼ Filters" (expanded)
- Tapping the header toggles visibility of the filter body
- Default state: collapsed (matches web)
- Each sub-group (Status, Priority, Tags, People, Project, Display) is also independently collapsible with its own expand/collapse toggle

---

### Task 13: Add Quick Access Buttons Section

Add a section with quick-access navigation buttons matching the web layout:

Row 1 (full width):
- **People** button: Icon + "People" — navigates to Contacts screen

Row 2 (two half-width buttons):
- **🗺️ Maps** — navigates to Map screen
- **🌤️ Weather** — navigates to Weather screen

Row 3 (two half-width buttons):
- **🕐 Clock** — opens a clock modal/dialog (shows world clocks)
- **📺 Kiosk** — navigates to Kiosk screen (or shows toast if not implemented)

Row 4 (two half-width buttons):
- **🧮 Calculator** — opens calculator overlay/dialog
- **🤖 Rules** — navigates to Rules Manager screen

---

### Task 14: Separate Trash & Custom Objects Row

Move Trash and Custom Objects into their own section as two half-width buttons:
- **🗑️ Trash** — navigates to Trash screen
- **🧩 Custom Objects** — navigates to Custom Objects screen

---

### Task 15: Pin Bottom Section (Settings, Reference, Help)

The bottom of the sidebar must have a pinned (non-scrolling) section containing:
- **Settings** button (full width): Icon + "Settings" — navigates to Settings
- Row of two half-width buttons:
  - **📖 Reference** — shows keyboard/gesture reference (or help overlay)
  - **📘 Help** — navigates to Help screen
- **Version footer**: Centered, small text showing version number

This section must NOT scroll with the rest of the sidebar content. It stays pinned at the bottom.

**Implementation**: Use a `Column` with the scrollable content in a `Modifier.weight(1f)` section and the bottom pinned section below it without weight.

---

### Task 16: Implement Swipe-to-Open Sidebar

The sidebar must be openable via a right-swipe gesture from the left edge of the screen:
- Touch starting within 30dp of the left screen edge
- Horizontal swipe >50dp rightward
- Only opens if the Views panel is NOT currently open
- This may already work via Material3's `ModalNavigationDrawer` gesture handling — verify and ensure it works.

---

### Task 17: Implement Swipe-to-Close Sidebar

The sidebar must be closable via:
- Left swipe gesture while sidebar is open (>50dp leftward)
- Tapping the backdrop/scrim area
- These should already work via Material3's drawer — verify.

---

### Task 18: Tag Filter — Tree Structure with Search

The current tag filter shows a flat list of checkboxes. Update it to match the web:

1. **"Select All / Select None" button** at the top — toggles all tags
2. **Search input**: Filters visible tags in real-time
3. **Hierarchical tree**: Tags organized by parent/child (using "/" separator)
   - Parent tags can be expanded/collapsed
   - Each tag shows its assigned color as a background badge
   - Favorite tags (★) sorted first
4. **Click**: Toggle tag selection
5. **Long-press**: Select ONLY this tag (deselect all others) — equivalent to web's Shift+Click
6. **Clear button**: Empties tag selection

**State**: `window._sidebarTagSelection` equivalent → `filterState.tags` in `FilterState`

---

### Task 19: People Filter — Chip-Based with Search

The current people filter shows flat chips. Update to match the web:

1. **Search input**: Filters visible chips by name
2. **Merged list**: Contacts + system users (from `/api/auth/switchable-users`)
   - Sorted: favorites first (★), then alphabetical
3. **Each chip shows**:
   - Thumbnail (profile image or placeholder)
   - Display name (prefix stripped)
   - Favorite indicator (★)
   - Background color: Person's assigned color
   - Text color: Auto-contrasted
4. **Contact chips**: Standard border
5. **User chips**: Thicker dark border, user icon placeholder
6. **Selected state**: Bold, outline, full opacity
7. **Unselected state**: Reduced opacity
8. **Tap**: Toggle person in/out of selection
9. **Clear button**: Empties selection

---

### Task 20: Saved Searches

Implement saved searches in the filter text section:
- Below the search text field, show a horizontal scrollable row of saved search chips
- Each chip shows the saved search text
- Tapping a chip populates the search field with that text and triggers filtering
- Long-press a chip to delete it
- Add a "Save" button/icon next to the search field that saves the current search text
- Stored in SharedPreferences as a JSON array

---

### Task 21: Per-Tab Sort Persistence

Sort preferences must be persisted per-tab (this already exists in `FilterSortViewModel`). Verify:
- When switching tabs, the sort state loads the saved preference for that tab
- When changing sort, it persists for the current tab
- Default is "None" (MANUAL) ascending

---

### Task 22: Custom View Filters (Per-Tab Defaults)

Implement support for per-tab custom view filter defaults:
- Read `custom_view_filters` from synced settings (JSON object keyed by tab name)
- When switching to a tab that has custom filters configured, auto-apply them
- The "Defaults" button resets to these custom filters
- The "Clear" button resets to custom filters if they exist, otherwise system defaults
- Structure matches web: `{ statuses, priorities, tags, people, text, display, sort, project }`

---

### Task 23: Filter State Persistence

Filter state should persist across tab switches within a session (already in-memory via ViewModel). Additionally:
- Save UI state to SharedPreferences on app background (all display toggles, sort, active filters)
- Restore on app restart
- Match web's `cwoc_ui_state` localStorage behavior

---

### Task 24: Email Tab — Sidebar Controls Parity

Verify the existing email sidebar controls match the web exactly:
- ✅ Check Mail button
- ✅ Account filter (pill buttons per account, toggle in/out)
- ✅ Folder radio buttons: Inbox, Sent, Drafts, Scheduled, Trash
- ✅ Unread at top toggle
- Verify: Trash folder option navigates to Trash screen with email filter (not just changes folder)
- Verify: Account pills show error state (⚠️) when account has errors

---

### Task 25: Sidebar Visual Styling

Ensure the sidebar matches the CWOC parchment theme:
- Background: Parchment color (#FFFAF0) or parchment texture
- Section labels: Bold, 0.85em equivalent, brown (#4A3728)
- Filter labels: 0.8em equivalent, brown
- Buttons: Brown background (#8B5A2B), light text (#FFF8E1), 1px border (#5A3F2A)
- Half-width buttons: Same style, smaller text
- Inputs: Parchment background (#F5E6CC), brown border (#6B4E31)
- Dropdowns: Same input styling with custom arrow
- Dividers: Brown with low opacity
- Active/selected states: Highlighted with brown tones
- Font: Use the app's Lora font (or closest equivalent already in use)

---

### Task 26: View Mode Visibility Matrix

Implement conditional visibility for sidebar sections based on active tab. The sidebar must show/hide sections dynamically:

| Section | Calendar | Checklists | Tasks | Projects | Notes | Email | Indicators | Alarms | Omni |
|---------|----------|------------|-------|----------|-------|-------|------------|--------|------|
| Create Chit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email Controls | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Date Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order (Sort) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time Period | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calendar Options | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Projects Mode | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Alarms Mode | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Tasks Mode | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Indicators | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Filters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quick Access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trash/Custom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bottom Pinned | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Calendar Options only visible when Month period is selected

---

### Task 27: Sidebar Close Behavior

When the user taps a navigation button in the sidebar, the sidebar must close automatically after navigation begins. This applies to:
- All quick-access buttons (People, Maps, Weather, Clock, Kiosk, Calculator, Rules)
- Trash, Custom Objects
- Settings, Help
- The Create Chit button

The sidebar should NOT close when:
- Changing filters (user stays in sidebar to adjust multiple filters)
- Changing sort
- Changing view mode
- Changing time period
- Using date navigation (Today, Prev, Next)

---

### Task 28: FilterState — Update activeFilterCount

Update the `activeFilterCount` computed property in `FilterState` to account for ALL new fields:
```kotlin
val activeFilterCount: Int get() {
    var count = 0
    if (statuses.isNotEmpty()) count++
    if (priorities.isNotEmpty()) count++
    if (tags.isNotEmpty()) count++
    if (people.isNotEmpty()) count++
    if (colors.isNotEmpty()) count++
    if (dateRangeStart != null || dateRangeEnd != null) count++
    if (showArchived) count++
    if (!showPinned) count++
    if (showSnoozed) count++
    if (!showPastDue) count++
    if (!showComplete) count++  // NEW
    if (!showDeclined) count++  // UPDATED default
    if (!showUnmarked) count++  // NEW
    if (!showHabits) count++    // NEW
    if (showEmailReceived) count++  // NEW
    if (showEmailSent) count++      // NEW
    if (sharedWithMe) count++       // NEW
    if (sharedByMe) count++         // NEW
    if (searchText.isNotEmpty()) count++  // NEW
    if (projectFilter != null) count++    // NEW
    return count
}
```

---

### Task 29: FilterEngine — Apply New Filters

Update `FilterEngine` to apply all new filter dimensions:
- `showUnmarked`: If false, hide chits that are neither pinned nor archived
- `showComplete`: If false, hide chits with status "Complete"
- `showDeclined`: If false, hide chits with status "Rejected"/"Declined"
- `showHabits`: If false, hide chits that are habits (have `is_habit` flag or habit recurrence)
- `showEmailReceived`: If true, include received email chits in non-email views
- `showEmailSent`: If true, include sent email chits in non-email views
- `sharedWithMe`: If true, show only chits shared with current user
- `sharedByMe`: If true, show only chits shared by current user
- `searchText`: Filter by title/notes content containing the text (case-insensitive)
- `projectFilter`: Filter by project membership ("__any__", "__none__", or specific project ID)

---

### Task 30: SortEngine — Apply New Sort Fields

Update `SortEngine` to handle new sort fields:
- `RANDOM`: Shuffle the list randomly (new random order each time sort is applied)
- `UPCOMING`: Sort by nearest upcoming due date (chits with no due date sort last)

Hide the sort direction button when field is MANUAL, RANDOM, or UPCOMING.

---

### Task 31: Shared Sidebar State ViewModel

Create a `SidebarStateViewModel` (or extend `FilterSortViewModel`) to hold all sidebar state that needs to be shared across the sidebar and the content screens:

```kotlin
data class SidebarState(
    // Date navigation
    val currentDate: LocalDate = LocalDate.now(),
    val currentPeriod: String = "Week", // Itinerary|Day|Work|Week|SevenDay|Month|Year
    val dateRangeDisplay: String = "",
    val yearDisplay: String = "",
    
    // View modes
    val projectsViewMode: String = "list", // list|kanban
    val alarmsViewMode: String = "list", // list|independent|notifications|reminders
    val tasksViewMode: String = "tasks", // tasks|habits|assigned
    
    // Calendar options
    val monthMode: String = "compress", // compress|scroll
    
    // Habits sub-options
    val habitsSuccessWindow: Int = 30, // 7|30|90|-1(all)
    val habitsIncludeRules: Boolean = false,
    
    // Indicators
    val indicatorsRange: String = "day", // day|week|month|year|all
    val indicatorsCustomStart: String? = null,
    val indicatorsCustomEnd: String? = null,
    val indicatorsVisibleGraphs: Set<String> = emptySet(),
    
    // Search
    val searchText: String = "",
    val savedSearches: List<String> = emptyList()
)
```

---

### Task 32: Wire Sidebar State to Content Screens

Each content screen must react to sidebar state changes:
- **Calendar**: Responds to period changes, date navigation, month mode
- **Tasks**: Responds to tasks view mode, habits options
- **Projects**: Responds to projects view mode (list/kanban)
- **Alarms**: Responds to alarms view mode
- **Indicators**: Responds to time range, custom range, visible graphs
- **All list views**: Respond to filter state, sort state, search text

This requires either:
- A shared ViewModel scoped to the activity (recommended — extend existing `FilterSortViewModel`)
- Or event bus / shared state holder injected via Hilt

---

### Task 33: Collapsible Section Component

Create a reusable `CollapsibleSection` composable for the sidebar:

```kotlin
@Composable
fun CollapsibleSection(
    title: String,
    initiallyExpanded: Boolean = false,
    content: @Composable () -> Unit
)
```

Features:
- Header with expand/collapse arrow (▶/▼) + title
- Animated expand/collapse of body content
- Used for: Filters section, each filter sub-group (Status, Priority, Tags, People, Project, Display), Calendar Options, Indicators Add Graph

---

### Task 34: Navigation Links Reorganization

The current sidebar has navigation links as a flat list. Reorganize into the web's grouped layout:

**Quick Access section** (between Filters and Trash):
- People (full width)
- Maps + Weather (half-width row)
- Clock + Kiosk (half-width row)
- Calculator + Rules (half-width row)

**Trash & Custom Objects** (own section):
- Trash + Custom Objects (half-width row)

**Bottom pinned** (non-scrolling):
- Settings (full width)
- Reference + Help (half-width row)
- Version footer

Remove the current flat navigation list and replace with this grouped layout.

---

### Task 35: Half-Width Button Component

Create a reusable composable for the half-width sidebar buttons:

```kotlin
@Composable
fun SidebarCompactButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
)
```

Style:
- `flex: 1` (fills half the row)
- Smaller text (0.8em equivalent)
- Compact padding
- Brown background, parchment text
- Used for: Maps, Weather, Clock, Kiosk, Calculator, Rules, Trash, Custom Objects, Reference, Help

---

### Task 36: Clock Modal/Dialog

When the Clock button is tapped in the sidebar:
- Open a dialog/bottom sheet showing world clocks
- Clocks are configured in settings (saved_locations with timezone)
- Each clock shows: location name, current time, timezone offset
- Close button to dismiss

If no clocks are configured, show a message directing to Settings.

---

### Task 37: Calculator Dialog

When the Calculator button is tapped in the sidebar:
- Open a calculator overlay/dialog
- Basic calculator functionality (matches web's `cwocToggleCalculator()`)
- Can be a simple evaluator or a proper calculator UI
- Close button to dismiss

---

### Task 38: Kiosk Navigation

When the Kiosk button is tapped:
- Navigate to a Kiosk screen (if implemented)
- If not yet implemented, show a toast "Kiosk view coming soon" and add a TODO

---

### Task 39: Reference Dialog

When the Reference button is tapped:
- Open a dialog/bottom sheet showing gesture and interaction reference
- Content: List of available gestures and their actions (swipe left/right, long-press, tap, etc.)
- This is the Android equivalent of the web's keyboard shortcuts reference
- Close button to dismiss

---

### Task 40: Notification System Integration

The sidebar must integrate with the notification system:
- Notification badge count is shown in the TopAppBar (already exists)
- Notifications are fetched from the server and cached locally
- New notifications trigger in-app toasts
- The notification bell in the TopAppBar navigates to the Notifications screen

Verify this all works correctly and matches the web behavior.

---

### Task 41: Email Tab — Create Chit Behavior

When on the Email tab, the "Create Chit" button should navigate to the editor with the email zone pre-opened:
- Route: `editor/new?new=email` or equivalent parameter
- The editor should auto-open the email composition zone

---

### Task 42: Sidebar State Restoration on App Launch

On app launch:
- Restore the last active tab from SharedPreferences
- Restore sort preferences per-tab (already exists)
- Restore display toggle states from SharedPreferences
- Restore the last used time period
- Restore view modes (projects list/kanban, tasks mode, alarms mode)
- Do NOT restore filter selections (status, priority, tags, people) — these reset on launch (matches web behavior where they're in-memory)

---

### Task 43: Filter Change Does Not Close Sidebar

Critical UX requirement: When the user changes any filter, sort, view mode, time period, or date navigation within the sidebar, the sidebar must remain open. Only explicit navigation actions (tapping People, Maps, Weather, Settings, etc.) should close the sidebar.

Verify this behavior is correct in the current implementation and fix if needed.

---

### Task 44: Priority Filter Options Parity

The web has these priority options: Low, Medium, High.
The Android currently has: Critical, High, Medium, Low.

Update to match the web exactly:
- Low
- Medium  
- High

Remove "Critical" unless it exists in the web (it does not appear in the sidebar filter).

---

### Task 45: Status Filter Options Parity

Verify the status filter options match the web exactly:
- Any (default — no filtering)
- ToDo
- In Progress
- Blocked
- Complete
- Rejected

The "Any" option behavior: When "Any" is checked, all specific options are unchecked. When any specific option is checked, "Any" is unchecked. If all specific options are unchecked, "Any" re-checks automatically.

---

## Summary of New Files Needed

1. `SidebarStateViewModel.kt` — Shared state for sidebar controls
2. `CollapsibleSection.kt` — Reusable collapsible section composable
3. `SidebarCompactButton.kt` — Half-width button composable
4. `DateNavigationSection.kt` — Date nav composable (or inline in SidebarContent)
5. `ViewModeSection.kt` — View mode buttons composable (or inline)
6. `IndicatorsSidebarControls.kt` — Indicators-specific sidebar controls
7. `ClockDialog.kt` — World clocks dialog
8. `CalculatorDialog.kt` — Calculator overlay
9. `ReferenceDialog.kt` — Gesture reference dialog
10. `SavedSearchesRow.kt` — Saved searches chip row

## Files to Modify

1. `SidebarContent.kt` — Major restructure (section order, new sections, pinned bottom)
2. `FilterPanel.kt` — Add missing filters, collapsible sub-groups, search text, project filter
3. `FilterState.kt` — Add new fields (showUnmarked, showComplete, showHabits, showEmailReceived, showEmailSent, sharedWithMe, sharedByMe, searchText, projectFilter)
4. `FilterSortViewModel.kt` — Extend with sidebar state, persistence
5. `SortEngine.kt` — Add RANDOM and UPCOMING sort fields
6. `SortPanel.kt` — Hide direction button for MANUAL/RANDOM/UPCOMING
7. `FilterEngine.kt` — Apply new filter dimensions
8. `MainActivity.kt` — Pass additional state/callbacks to SidebarContent

---

## Acceptance Criteria

Every single item from the web sidebar spec (`/Tasks/sidebar-mobile-spec.md`) must have a corresponding implementation in the Android app. Specifically:

1. ✅ Sidebar opens via hamburger button tap
2. ✅ Sidebar opens via left-edge swipe
3. ✅ Sidebar closes via backdrop tap
4. ✅ Sidebar closes via swipe-left
5. ✅ Create Chit button with correct behavior per tab
6. ✅ Email controls (Check Mail, account pills, folder radios, unread toggle)
7. ✅ Date navigation (Today, Prev, Next, year/range display)
8. ✅ Sort dropdown with ALL 9 options + direction toggle
9. ✅ Time Period dropdown with all 7 options
10. ✅ Calendar Options (Month compress/scroll) — conditional
11. ✅ Projects View Mode (List/Kanban) — conditional
12. ✅ Alarms View Mode (Chits/Independent/Notifs/Reminders) — conditional
13. ✅ Tasks View Mode (Tasks/Habits/Assigned) — conditional
14. ✅ Habits sub-options (success window, rule habits) — conditional
15. ✅ Indicators controls (range, custom range, graphs) — conditional
16. ✅ Filters section — collapsible
17. ✅ Filter Text with saved searches
18. ✅ Status filter (Any + 5 options with mutual exclusion logic)
19. ✅ Priority filter (Any + 3 options with mutual exclusion logic)
20. ✅ Tags filter (tree, search, select all/none, colors, favorites)
21. ✅ People filter (chips, search, contacts + users, colors, thumbnails)
22. ✅ Project filter (dropdown with meta options + project list)
23. ✅ Display toggles (ALL 14 checkboxes with correct defaults)
24. ✅ Clear button with correct visibility logic
25. ✅ Defaults button with per-tab custom filter support
26. ✅ Quick access buttons (People, Maps, Weather, Clock, Kiosk, Calculator, Rules)
27. ✅ Trash + Custom Objects buttons
28. ✅ Bottom pinned section (Settings, Reference, Help, Version)
29. ✅ Correct section visibility per active tab
30. ✅ Sidebar stays open during filter/sort changes, closes on navigation
31. ✅ Sort direction hidden for Manual/Random/Upcoming
32. ✅ Per-tab sort persistence
33. ✅ State restoration on app launch
34. ✅ CWOC parchment theme styling throughout
