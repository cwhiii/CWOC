# CWOC Left Sidebar — Mobile Browser Exhaustive Specification

## Overview

The left sidebar is a full-screen overlay panel on mobile (≤768px viewport). It slides in from the left edge, covering the entire screen with a semi-transparent backdrop behind it. It contains navigation, filtering, sorting, view mode controls, and quick-access buttons.

---

## Opening & Closing the Sidebar

### How to Open
1. **Hamburger button (☰)**: Visible in the top-left header bar on mobile (≤480px). Tapping it calls `toggleSidebar()`.
2. **Logo tap**: Tapping the CWOC logo in the header also calls `toggleSidebar()`.
3. **Swipe right from left edge**: A touch swipe starting within 30px of the left screen edge and moving >50px rightward opens the sidebar (only if the Views panel is NOT open).

### How to Close
1. **"⇤ Hide Sidebar" button**: A sticky close button at the very top of the sidebar. Full-width, brown background (#8b5a2b), white text, min-height 44px.
2. **Backdrop tap**: Tapping the semi-transparent dark backdrop (rgba(0,0,0,0.4)) behind the sidebar closes it.
3. **Swipe left**: A leftward swipe (>50px) while the sidebar is open closes it.

### Mobile Layout Behavior
- **Width**: 100% of viewport
- **Position**: Fixed, full height, z-index 1003
- **Background**: Parchment texture image (`/static/parchment.jpg`) with fallback color
- **Transition**: Slides from left: -110% to left: 0
- **Backdrop**: `.sidebar-backdrop` element, fixed full-screen, rgba(0,0,0,0.4), z-index 1002
- **On page load at ≤768px**: Sidebar is forced closed regardless of localStorage state

---

## Internal Structure (Top to Bottom)

The sidebar has two main regions:
1. **`.sidebar-scroll`** — Scrollable content area (flex: 1, overflow-y: auto)
2. **`.sidebar-bottom`** — Pinned to the bottom (flex-shrink: 0, border-top separator)

---

## Section 1: Close Button (Mobile Only)

- **Element**: `<button class="sidebar-close-btn">`
- **Position**: Sticky at top of sidebar (stays visible while scrolling)
- **Content**: Large "⇤" arrow icon + "Hide Sidebar" text
- **Style**: Full width, brown background (#8b5a2b), white text (#fff8e1), min-height 44px, bold font
- **Action**: Closes sidebar + hides backdrop

---

## Section 2: Create Chit Button

- **Element**: `<button class="create-chit action-button" id="sidebar-create-btn">`
- **Content**: Icon image (`/static/create_new.png`) + "Create Chit" text
- **Actions**:
  - **Tap (left click)**: Navigates to `/frontend/html/editor.html` (new chit). If on Email tab, navigates to `/frontend/html/editor.html?new=email`.
  - **Middle click (aux click)**: Opens editor in new tab
  - **Long press / right-click (context menu)**: Opens Quick Alert modal
- **Style**: Standard action button (brown background, parchment text)
- **Margin-top**: 0 (first item in scroll area after close button)

---

## Section 3: Email Controls (Conditional — Email Tab Only)

- **Element**: `<div id="section-email-controls">` — `display:none` by default, shown only when Email tab is active
- **Contains**:

### 3a. Check Mail Button
- `<button id="sidebar-check-mail-btn">`: Icon (fa-sync) + "Check Mail"
- Action: Calls `_checkMail()` to fetch new emails

### 3b. Email Account Filter
- `<div id="email-account-filter-wrap">`: Dynamically populated with pill buttons for each configured email account
- Each pill shows the account nickname, toggles that account in/out of the email view
- Active pills are highlighted; error-state pills show ⚠️ icon and red styling
- Only visible if at least one email account has a nickname configured

### 3c. Folder Filter
- **Collapsible group** with label "▼ Folder" (click to expand/collapse)
- **Radio buttons** (only one active at a time):
  - 📥 **Inbox** (default, checked) — `value="inbox"`
  - ✈️ **Sent** — `value="sent"`
  - 📄 **Drafts** — `value="drafts"`
  - 🕐 **Scheduled** — `value="scheduled"`
  - 🗑️ **Trash** — navigates to `/frontend/html/trash.html?filter=email`
- Action: Calls `_setEmailSubFilter(value)` on change

### 3d. Unread at Top Toggle
- `<input type="checkbox" id="email-unread-top-toggle">` with label "📧 Unread at top"
- Action: Calls `_toggleEmailUnreadTop()` — sorts unread emails to top of list

---

## Section 4: Date Navigation

- **Container**: `<div id="year-week-container">`

### 4a. Today Button
- `<button class="action-button today-btn" id="sidebar-today-btn">`
- Content: Calendar icon (fa-calendar-days) + "Today"
- Action: Calls `goToToday()` — jumps calendar to current date

### 4b. Week Navigation Row
- **Container**: `<div class="week-nav" id="week-nav">`
- **Layout**: Horizontal flex — [◄ Prev] [Center] [Next ►]
- **Previous button** (`id="sidebar-prev-btn"`): "◄" — calls `previousPeriod()`
- **Center area** (`class="week-nav-center"`):
  - `<div id="year-display">` — Shows the year (e.g., "2026")
  - `<span class="week-range" id="week-range">` — Shows date range (e.g., "May 18 – May 24")
- **Next button** (`id="sidebar-next-btn"`): "►" — calls `nextPeriod()`

---

## Section 5: Order (Sort)

- **Container**: `<div class="sidebar-section" id="section-order">`
- **Label**: "Order" (bold, 0.85em, brown)
- **Controls** (`id="order-controls"`): Horizontal flex row

### 5a. Sort Dropdown
- `<select id="sort-select">` — Full width (flex: 1)
- **Options**:
  - `""` — "— None —" (default)
  - `"title"` — "Title"
  - `"start"` — "Start Date"
  - `"due"` — "Due Date"
  - `"updated"` — "Updated"
  - `"created"` — "Created"
  - `"status"` — "Status"
  - `"manual"` — "Manual"
  - `"random"` — "Random / Shuffle"
  - `"upcoming"` — "Upcoming (Due Soon)"
- Action: Calls `onSortSelectChange()` → sets `currentSortField`, resets direction to 'asc', re-renders chits

### 5b. Sort Direction Button
- `<button id="sort-dir-btn">` — Shows "▲" (ascending) or "▼" (descending)
- **Visibility**: Hidden when sort is None, Manual, Random, or Upcoming. Visible for all other sort fields.
- Action: Toggles between 'asc' and 'desc', calls `toggleSortDir()`
- Style: Brown background (#8b5a2b), white text, small padding

---

## Section 6: Time Period

- **Container**: `<div class="sidebar-section" id="section-period">`
- **Label**: "Time Period" (bold, 0.85em, brown)
- **Dropdown**: `<select id="period-select">`
- **Options** (populated from context, default set):
  - `"Itinerary"` — "Itinerary"
  - `"Day"` — "Day"
  - `"Work"` — "Work Hours"
  - `"Week"` — "Week" (selected by default)
  - `"SevenDay"` — "X Days"
  - `"Month"` — "Month"
  - `"Year"` — "Year"
- Action: Calls `changePeriod()` — switches calendar view period
- **Visibility**: Always visible (relevant to Calendar tab primarily, but available on all tabs)

---

## Section 7: Calendar Options (Conditional — Calendar Tab + Month View Only)

- **Container**: `<div id="section-cal-options">` — `display:none` by default
- **Shown when**: Calendar tab is active AND Month period is selected
- **Collapsible**: Label "▶ ⚙ Options" (click to expand/collapse body)

### 7a. Month Mode Toggle (2-value pill)
- **Label**: "Month"
- **Pill toggle** (`id="month-mode-pill"`, class `cwoc-2val-toggle`):
  - Hidden input `id="month-mode-toggle"` holds value
  - **Option 1**: "Compress" (`data-val="compress"`) — default active
  - **Option 2**: "Scroll" (`data-val="scroll"`)
- **Behavior**: Click anywhere on pill to switch between compress (fixed-height month cells) and scroll (scrollable month cells)

---

## Section 8: View Mode — Projects (Conditional — Projects Tab Only)

- **Container**: `<div id="section-kanban">` — `display:none` by default
- **Shown when**: Projects tab is active
- **Label**: "View Mode"
- **Buttons** (horizontal flex, 2 buttons):
  - `id="projects-mode-list"`: "📋 List" — calls `_setProjectsMode('list')`
  - `id="projects-mode-kanban"`: "📊 Kanban" — calls `_setProjectsMode('kanban')`
- **Active state**: The active mode button has `background:ivory;color:#3b1f0a` styling

---

## Section 9: View Mode — Alarms (Conditional — Alarms Tab Only)

- **Container**: `<div id="section-alarms-mode">` — `display:none` by default
- **Shown when**: Alarms/Alerts tab is active
- **Label**: "View Mode"
- **Buttons** (2×2 grid layout):
  - `id="alarms-mode-list"`: "📋 Chits" — calls `_setAlarmsMode('list')`
  - `id="alarms-mode-independent"`: "🛎️ Independent" — calls `_setAlarmsMode('independent')`
  - `id="alarms-mode-notifications"`: "🔔 Notifs" — calls `_setAlarmsMode('notifications')`
  - `id="alarms-mode-reminders"`: "📢 Reminders" — calls `_setAlarmsMode('reminders')`
- **Active state**: Active mode button has `background:ivory;color:#3b1f0a`

---

## Section 10: View Mode — Tasks (Conditional — Tasks Tab Only)

- **Container**: `<div id="section-tasks-mode">` — `display:none` by default
- **Shown when**: Tasks tab is active
- **Label**: "View Mode"
- **Buttons** (horizontal flex, 3 buttons):
  - `id="tasks-mode-tasks"`: "📋 Tasks" — calls `_setTasksMode('tasks')` (default active)
  - `id="tasks-mode-habits"`: "🎯 Habits" — calls `_setTasksMode('habits')`
  - `id="tasks-mode-assigned"`: "📌 Assigned" — calls `_setTasksMode('assigned')`
- **Active state**: Active mode button has `background:ivory;color:#3b1f0a`

### 10a. Habits Sub-Options (Conditional — Tasks Tab + Habits Mode Only)
- **Container**: `<div id="habits-window-wrap">` — `display:none` by default
- **Shown when**: Tasks tab is active AND habits mode is selected

#### Success Window Dropdown
- **Label**: "Success Window"
- `<select id="habits-success-window-sidebar">`:
  - `"7"` — "Last 7 days"
  - `"30"` — "Last 30 days" (default selected)
  - `"90"` — "Last 90 days"
  - `"all"` — "All time"
- Action: Calls `_onHabitsWindowChange(value)`

#### Rule Habits Checkbox
- **Label**: "Rule Habits"
- `<input type="checkbox" id="habits-include-rules-cb">` with label "Include in success rate"
- Action: Calls `_onHabitsIncludeRulesChange(checked)`

---

## Section 11: Indicators Controls (Conditional — Indicators Tab Only)

- **Container**: `<div id="section-indicators">` — `display:none` by default
- **Shown when**: Indicators tab is active

### 11a. Time Range Buttons
- **Label**: "Time Range"
- **Buttons** (horizontal flex-wrap, 5 buttons):
  - "Day" — `_indicatorsSetRange('day')` (default active, class `_ind-active`)
  - "Week" — `_indicatorsSetRange('week')`
  - "Month" — `_indicatorsSetRange('month')`
  - "Year" — `_indicatorsSetRange('year')`
  - "All" — `_indicatorsSetRange('all')`
- Active button gets class `_ind-active`

### 11b. Custom Range
- **Label**: "Custom Range"
- **Start date**: `<input type="date" id="ind-start">`
- **End date**: `<input type="date" id="ind-end">`
- **Go button**: Calls `_indicatorsLoadCustomRange()`
- Layout: Vertical stack (flex-direction: column)

### 11c. Show Graphs
- **Label**: "Show Graphs"
- **Container**: `<div class="multi-select" id="ind-select">` — max-height 200px, scrollable
- Dynamically populated with checkboxes for each available indicator graph
- Initially shows "Loading…" placeholder

### 11d. Add Graph (Collapsible)
- **Label**: "▶ + Add Graph" (click to expand/collapse)
- **Body**: `<div id="ind-add-graph-section">` — hidden by default
- Max-height 250px, scrollable, bordered container
- Dynamically populated with available graphs to add
- Initially shows "Loading…" placeholder

---

## Section 12: Filters (Collapsible)

- **Container**: `<div class="sidebar-section" id="section-filters">`
- **Header row** (flex, gap 6px):
  - **Toggle label** (`id="filters-toggle-btn"`): "▶ 🔍 Filters" — click to expand/collapse the filters body
  - **Clear button** (`id="sidebar-clear-all-btn"`): "✕ Clear" — visible only when any filter is non-default. Resets all filters.
  - **Defaults button** (`id="reset-defaults-btn"`): "↩ Defaults" — visible only when the current tab has custom default filters configured. Resets to tab-specific defaults.
- **Body**: `<div id="filters-body">` — hidden by default (collapsed)

### 12a. Filter Text (Search)
- **Group**: `<div class="filter-group" id="filter-words">`
- **Label**: "Filter Text"
- **Input**: `<input type="text" id="search" placeholder="Filter Chits...">`
- **Behavior**: Filters chits in real-time as you type (onkeyup triggers `searchChits()`)
- **Saved Searches**: `<div id="saved-searches">` — flex-wrap row of saved search chips below the input. Each chip is a clickable button that populates the search field with a saved query. Stored in localStorage (`cwoc_saved_searches`).

### 12b. Status Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-status">`
- **Label**: "▶ Status" (click to expand/collapse)
- **Body** (hidden by default):
  - **Multi-select checkboxes** (`id="status-multi"`):
    - ☐ **— Any** (`value=""`, `data-any="true"`, checked by default) — when checked, all statuses shown
    - ☐ **ToDo** (`value="ToDo"`)
    - ☐ **In Progress** (`value="In Progress"`)
    - ☐ **Blocked** (`value="Blocked"`)
    - ☐ **Complete** (`value="Complete"`)
    - ☐ **Rejected** (`value="Rejected"`)
  - **Clear button**: Resets to "Any" checked, all others unchecked
- **Behavior**:
  - Checking "Any" unchecks all specific options
  - Checking any specific option unchecks "Any"
  - If all specific options are unchecked, "Any" re-checks automatically

### 12c. Priority Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-priority">`
- **Label**: "▶ Priority" (click to expand/collapse)
- **Body** (hidden by default):
  - **Multi-select checkboxes** (`id="priority-multi"`):
    - ☐ **— Any** (`value=""`, `data-any="true"`, checked by default)
    - ☐ **Low** (`value="Low"`)
    - ☐ **Medium** (`value="Medium"`)
    - ☐ **High** (`value="High"`)
  - **Clear button**: Resets to "Any" checked
- **Behavior**: Same Any/specific toggle logic as Status

### 12d. Tags Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-label">`
- **Label**: "▶ Tags" (click to expand/collapse)
- **Body** (hidden by default):
  - **Container**: `<div class="multi-select" id="label-multi">`
  - **Dynamically populated** by `cwocLoadTagFilter()`:

#### Tag Filter Contents:
1. **"Select All / Select None" button** (`id="tag-filter-toggle-all"`, class `tag-virtual-btn`):
   - Full width button at top
   - Text toggles between "Select All" and "Select None" based on current state
   - Active state: brown background (#6b4e31), light text
   - Click: Selects all tags or deselects all tags

2. **Search input**: Text field, placeholder "Search tags...", filters visible tags in real-time

3. **Tag tree**: Hierarchical tree of all user-defined tags (excludes system tags)
   - Each tag row shows:
     - Checkbox (checked = selected for filtering)
     - Tag name with colored background badge (color from tag settings)
     - Favorite tags (★) sorted first
   - Parent tags can be expanded/collapsed to show children
   - **Click**: Toggle tag selection
   - **Shift+Click**: Select ONLY this tag (deselects all others)
   - Tags are organized hierarchically (parent/child via "/" separator)
   - Search filters visible rows in real-time

  - **Clear button**: Calls `cwocClearTagFilter()` — empties selection (shows all chits)
- **Selection state**: Stored in `window._sidebarTagSelection` array
- **Filter logic**: Empty selection = show all chits. Non-empty = show only chits matching at least one selected tag (including descendants)

### 12e. People Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-people">`
- **Label**: "▶ People" (click to expand/collapse)
- **Body** (hidden by default):
  - **Container**: `<div id="people-multi">`
  - **Dynamically populated** by `_buildPeopleFilterPanel()`:

#### People Filter Contents:
1. **Search input**: Text field, placeholder "Search people...", filters visible chips

2. **Chip list** (vertical flex column):
   - Merged list of **contacts** + **system users**
   - Sorted: favorites first (★ prefix), then alphabetical
   - Each chip shows:
     - Thumbnail (profile image, or placeholder icon/circle)
     - Display name (prefix stripped if present)
     - Favorite indicator (★)
   - **Contact chips**: Standard border matching their color
   - **User chips**: Thicker dark brown border (#1a1208), user icon placeholder if no image
   - **Selected state**: Bold text, 2px solid outline (#4a2c2a), full opacity
   - **Unselected state**: 0.7 opacity
   - **Click**: Toggle person in/out of filter selection
   - Background color: Person's assigned color (or default tan #d2b48c)
   - Text color: Auto-contrasted (dark on light backgrounds, white on dark)

  - **Clear button**: Calls `clearPeopleFilter()` — empties selection
- **Selection state**: Stored in `window._sidebarPeopleSelection` array
- **Refresh**: Re-fetches contacts when page becomes visible (visibilitychange event)

### 12f. Project Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-project">`
- **Label**: "▶ Project" (click to expand/collapse)
- **Body** (hidden by default):
  - **Dropdown**: `<select id="project-filter-select" class="cwoc-project-filter-select">`
  - **Options**:
    - `""` — "—" (no filter, default)
    - `"__any__"` — "Any (has a project)" — shows only chits that belong to any project
    - `"__none__"` — "None (no project)" — shows only chits not in any project
    - *Dynamically added*: One option per project master chit, sorted alphabetically by title
  - **Clear button**: Calls `_clearProjectFilter()` — resets to "—"
  - Action: Calls `_onProjectFilterChange()` on change
  - **Style**: Custom styled select with SVG dropdown arrow, parchment background (#f5e6cc)

### 12g. Display Filter (Collapsible Sub-Group)
- **Group**: `<div class="filter-group" id="filter-archive">`
- **Label**: "▶ Display" (click to expand/collapse)
- **Body** (hidden by default):
  - **Multi-select checkboxes**:
    - ☑ **📌 Pinned** (`id="show-pinned"`, checked by default) — show/hide pinned chits
    - ☐ **📦 Archived** (`id="show-archived"`, unchecked by default) — show/hide archived chits
    - ☐ **😴 Snoozed** (`id="show-snoozed"`, unchecked by default) — show/hide snoozed chits
    - ☑ **📄 Unmarked** (`id="show-unmarked"`, checked by default) — show/hide chits with no pin/archive status
    - --- *(dashed separator)* ---
    - ☑ **⏰ Past-Due** (`id="show-past-due"`, checked by default) — show/hide past-due chits
    - ☑ **✅ Complete** (`id="show-complete"`, checked by default) — show/hide completed chits
    - ☑ **✗ Declined** (`id="show-declined"`, checked by default) — show/hide declined/rejected chits
    - ☑ **🎯 Habits** (`id="show-habits"`, checked by default) — show/hide habit chits
    - ☐ **📨 Email (Received)** (`id="show-email-received"`, unchecked by default) — show received emails in non-email views
    - ☐ **📤 Email (Sent)** (`id="show-email-sent"`, unchecked by default) — show sent emails in non-email views
    - --- *(dashed separator)* ---
    - ☐ **🔗 Shared with me** (`id="filter-shared-with-me"`, unchecked by default) — show only chits shared with current user
    - ☐ **📤 Shared by me** (`id="filter-shared-by-me"`, unchecked by default) — show only chits shared by current user
  - Each checkbox triggers `onFilterChange()` on change

---

## Section 13: Quick Access Buttons

- **Container**: `<div class="sidebar-section" id="section-settings">`

### 13a. People Button (Full Width)
- `<button id="sidebar-contacts-btn">`: Icon (fa-address-book) + "People"
- Action: Navigates to `/frontend/html/people.html`
- Style: Full-width action button, margin-bottom 6px

### 13b. Maps + Weather Row
- **Layout**: Horizontal flex, gap 6px
- `<button id="sidebar-maps-btn" class="sidebar-compact-btn">`: "🗺️ Maps"
  - Action: Navigates to `/maps`
- `<button id="sidebar-weather-btn" class="sidebar-compact-btn">`: "🌤️ Weather"
  - **Tap**: Navigates to `/frontend/html/weather.html`
  - **Shift+click** (desktop): Opens weather modal
  - **Long press** (mobile): Opens weather modal (equivalent to shift+click)

### 13c. Clock + Kiosk Row
- **Layout**: Horizontal flex, gap 6px, margin-top 6px
- `<button id="sidebar-clock-btn" class="sidebar-compact-btn">`: "🕐 Clock"
  - Action: Opens clock modal (`_openClockModal()`)
- `<button id="sidebar-kiosk-btn" class="sidebar-compact-btn">`: "📺 Kiosk"
  - Action: Navigates to `/kiosk`

### 13d. Calculator + Rules Row
- **Layout**: Horizontal flex, gap 6px, margin-top 6px
- `<button id="sidebar-calculator-btn" class="sidebar-compact-btn">`: "🧮 Calculator"
  - Action: Toggles calculator overlay (`cwocToggleCalculator()`)
- `<button id="sidebar-rules-btn" class="sidebar-compact-btn">`: "🤖 Rules"
  - Action: Navigates to `/frontend/html/rules-manager.html`

---

## Section 14: Trash & Custom Objects

- **Container**: `<div class="sidebar-section" id="section-notif-inbox">`
- **Layout**: Horizontal flex, gap 6px

### 14a. Trash Button
- `<button id="sidebar-trash-btn" class="sidebar-compact-btn">`: "🗑️ Trash"
- Action: Navigates to `/frontend/html/trash.html`

### 14b. Custom Objects Button
- `<button id="sidebar-custom-objects-btn" class="sidebar-compact-btn">`: "🧩 Custom Objects"
- Action: Navigates to `/frontend/html/custom-objects-editor.html`

---

## Section 15: Bottom Pinned Area (`.sidebar-bottom`)

This section is pinned to the bottom of the sidebar and does NOT scroll with the content above. Separated by a 1px border-top (rgba(107, 78, 49, 0.3)).

### 15a. Settings Button (Full Width)
- `<button id="sidebar-settings-btn">`: Icon image (`/static/settings.png`) + "Settings"
- Action: Stores previous state, sets return URL, navigates to `/frontend/html/settings.html`
- Style: Full-width action button, margin-bottom 6px

### 15b. Reference + Help Row
- **Layout**: Horizontal flex, gap 6px
- `<button id="sidebar-reference-btn" class="sidebar-compact-btn">`: "📖 Reference"
  - Action: Toggles keyboard/mouse reference overlay (`_toggleReference()`)
- `<button id="sidebar-help-btn" class="sidebar-compact-btn">`: "📘 Help"
  - Action: Navigates to `/frontend/html/help.html`

### 15c. Version Footer
- `<div id="sidebar-version-footer">`: Centered, tiny text (0.65em, 0.45 opacity)
- Content: Link to "C.W.'s Omni Chits" (links to cwholemaniii.com)
- Title attribute: Populated dynamically with version number from `/api/version`

---

## Compact Button Styling (`.sidebar-compact-btn`)

All half-width buttons in the sidebar share this class:
- `flex: 1 1 calc(50% - 3px)` — fills half the row
- `margin-bottom: 0`
- `font-size: 0.8em`
- `padding: 6px`
- Standard action button appearance (brown background, parchment text, 1px border)

---

## View Mode Visibility Matrix

Which sidebar sections are visible depends on the active tab:

| Section | Calendar | Checklists | Tasks | Projects | Notes | Email | Indicators | Alarms | Search | Omni |
|---------|----------|------------|-------|----------|-------|-------|------------|--------|--------|------|
| Create Chit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email Controls | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Date Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order (Sort) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Time Period | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calendar Options | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Projects Mode | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Alarms Mode | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Tasks Mode | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Indicators | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Filters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quick Access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trash/Custom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bottom (Settings) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Calendar Options only visible when Month period is selected

---

## Tab Sub-Modes Summary

### Calendar Tab
- Period options: Itinerary, Day, Work Hours, Week, X Days, Month, Year
- Month mode: Compress / Scroll toggle (only when Month period selected)

### Tasks Tab
- View modes: Tasks (default), Habits, Assigned
- Habits sub-options (only in Habits mode):
  - Success Window: 7 days / 30 days / 90 days / All time
  - Rule Habits: Include in success rate checkbox

### Projects Tab
- View modes: List (default), Kanban

### Alarms Tab
- View modes: Chits (list), Independent, Notifs, Reminders

### Indicators Tab
- Time range: Day / Week / Month / Year / All
- Custom range: Start date + End date + Go button
- Show Graphs: Multi-select checkboxes
- Add Graph: Expandable section with available graphs

### Email Tab
- Check Mail button
- Account filter pills
- Folder: Inbox / Sent / Drafts / Scheduled / Trash
- Unread at top toggle

---

## Filter State Persistence

- **Sort preference**: Persisted per-tab via `saveSortPreference(tab, field, dir)`
- **UI state**: Saved to localStorage (`cwoc_ui_state`) including all display toggles, sort, and filter states
- **Tag selection**: `window._sidebarTagSelection` array (in-memory, restored from saved state on load)
- **People selection**: `window._sidebarPeopleSelection` array (in-memory)
- **Custom view filters**: Per-tab filter presets stored in `_customViewFilters[tab]` — applied automatically when switching tabs
- **Default filters**: Legacy per-tab text search defaults in `_defaultFilters[tabKey]`

---

## Clear Filters Behavior

### "Clear" button (sidebar-clear-all-btn)
Resets ALL filters to either:
1. Custom view defaults for the current tab (if configured), OR
2. System defaults (hardcoded baseline)

### System Defaults (when no custom view filters exist):
- Status: "Any" checked, all specific unchecked
- Priority: "Any" checked, all specific unchecked
- Tags: Empty selection (show all)
- People: Empty selection (show all)
- Search text: Empty
- Display: Pinned ✓, Archived ✗, Snoozed ✗, Unmarked ✓, Past-Due ✓, Complete ✓, Declined ✓, Habits ✓, Email Received ✗, Email Sent ✗
- Sharing: Both unchecked
- Project: "—" (no filter)
- Sort: None, ascending

### "Defaults" button (reset-defaults-btn)
Resets to the tab's configured default filter (custom view filter or legacy text default). Only visible when such defaults exist.

---

## Clear All Button Visibility Logic

The "✕ Clear" button (`sidebar-clear-all-btn`) is shown when ANY of these conditions are true:
- Any status checkbox (other than "Any") is checked
- Any priority checkbox (other than "Any") is checked
- Search text field is non-empty
- Any tags are selected (`_sidebarTagSelection.length > 0`)
- Any people are selected (`_sidebarPeopleSelection.length > 0`)
- Display toggles differ from defaults (Pinned unchecked, Archived checked, Unmarked unchecked, Past-Due unchecked, Complete unchecked, Declined unchecked, Habits unchecked, Email Received checked, Email Sent checked)
- Sharing filters are checked
- Sort field is set (not "None")
- Project filter is set (not "—")

---

## Mobile-Specific Interactions

### Swipe Gestures
- **Left edge swipe right (30px zone)**: Opens sidebar
- **Swipe left while sidebar open**: Closes sidebar
- **Right edge swipe left (25px zone)**: Opens Views panel (separate from sidebar)
- **Swipe right while Views panel open**: Closes Views panel

### Touch Targets
- All action buttons: min-height 36px on mobile (44px for close button)
- Checkboxes and selects: standard mobile touch sizing
- Sidebar close button: min-height 44px, full width, sticky at top

### Views Panel (Separate from Sidebar)
On mobile (≤480px), the tab bar is hidden and replaced by a "☰ [CurrentTab]" button in the header. Tapping it opens a slide-in panel from the right with all tab options:
- Calendar, Checklists, Tasks, Projects, Notes, Notebook (if enabled), Email, Indicators, Alerts, Search
- Each option shows the tab icon + label
- Active tab is highlighted
- Close button at bottom
- Backdrop behind panel

---

## Notification System (Background)

The sidebar fetches notifications from `/api/notifications` on initialization and periodically:
- Pending notifications trigger in-app toasts and browser system notifications
- Notification badge count is tracked (though the inbox UI is in `section-notif-inbox` which currently holds Trash/Custom Objects buttons)
- Notification types: assigned, reminder
- Actions: Accept, Decline, Snooze, Dismiss

---

## Styling Summary

| Property | Value |
|----------|-------|
| Sidebar background | Parchment texture + var(--sidebar-bg) |
| Border | 1px solid var(--sidebar-border) on right edge |
| Font | Lora, Georgia, serif |
| Text color | #4a3728 (labels), #1a1208 (inputs) |
| Button background | #8b5a2b (var(--btn-bg)) |
| Button text | #fff8e1 |
| Button border | 1px solid #5a3f2a |
| Input background | #f5e6cc |
| Input border | 1px solid #6b4e31 |
| Section spacing | margin-bottom: 12px |
| Label font-size | 0.85em |
| Filter label font-size | 0.8em |
| Compact button font-size | 0.8em |
| Scrollbar | 6px wide, brown tones |
| Transition | left 0.3s ease |
