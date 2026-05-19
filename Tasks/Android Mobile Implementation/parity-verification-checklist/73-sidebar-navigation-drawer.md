# Sidebar / Navigation Drawer

**Category:** Cross-Cutting Behaviors
**Item #:** 73
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/js/shared/shared-sidebar.js`
- `src/frontend/js/dashboard/main-sidebar.js`
- `src/frontend/css/dashboard/styles-sidebar.css`

## Functions, Buttons, Controls & Inputs

### Sidebar Injection & Initialization

- [ ] `_cwocInjectSidebar()` — IIFE that builds and injects the full sidebar HTML into the DOM (triggered by `data-sidebar` on `<body>`)
- [ ] `_cwocInitSidebar(context)` — Wires all button handlers, toggle behavior, filters, notifications; accepts Page_Context object with callbacks
- [ ] `_initDashboardSidebar()` — Dashboard-specific wrapper that registers callbacks with shared sidebar (called from `main-init.js`)

### Sidebar Toggle & State

- [ ] `toggleSidebar()` — Opens/closes sidebar; persists state to localStorage; handles mobile overlay backdrop
- [ ] `restoreSidebarState()` — Restores sidebar open/closed from localStorage; auto-closes on mobile (≤768px)
- [ ] `toggleSidebarSection(sectionId)` — Toggles a sidebar section's body visibility
- [ ] `expandSidebarSection(sectionId)` — Expands a sidebar section (used by hotkeys)
- [ ] `_toggleFiltersSection()` — Toggles the entire Filters section open/closed
- [ ] `_expandFiltersSection()` — Ensures filters section is expanded (used by hotkeys)
- [ ] `toggleFilterGroup(groupId)` — Toggles a filter sub-group's body
- [ ] `expandFilterGroup(groupId)` — Expands a filter sub-group (used by hotkeys)

### Sidebar Buttons (Section: Create)

- [ ] "Create Chit" button (`#sidebar-create-btn`) — Click: navigate to editor; Middle-click: open editor in new tab; Right-click: open Quick Alert modal
- [ ] "Check Mail" button (`#sidebar-check-mail-btn`) — Triggers `_checkMail()` (Email tab only)

### Sidebar Buttons (Section: Date Navigation)

- [ ] "Today" button (`#sidebar-today-btn`) — Navigates calendar to today
- [ ] "◄" Previous button (`#sidebar-prev-btn`) — Previous period
- [ ] "►" Next button (`#sidebar-next-btn`) — Next period
- [ ] Year display (`#year-display`) — Shows current year
- [ ] Week range display (`#week-range`) — Shows current date range

### Sidebar Controls (Section: Order)

- [ ] Sort select dropdown (`#sort-select`) — Options: None, Title, Start Date, Due Date, Updated, Created, Status, Manual, Random/Shuffle, Upcoming
- [ ] Sort direction button (`#sort-dir-btn`) — Toggles ▲/▼ ascending/descending

### Sidebar Controls (Section: Time Period)

- [ ] Period select dropdown (`#period-select`) — Options: Itinerary, Day, Work Hours, Week, X Days, Month, Year

### Sidebar Controls (Section: Calendar Options)

- [ ] Month mode pill toggle (`#month-mode-pill`) — Compress vs Scroll mode for month view
- [ ] Hidden input (`#month-mode-toggle`) — Stores current month mode value

### Sidebar Controls (Section: View Mode — Projects)

- [ ] "📋 List" button (`#projects-mode-list`) — Switches to list view
- [ ] "📊 Kanban" button (`#projects-mode-kanban`) — Switches to Kanban view

### Sidebar Controls (Section: View Mode — Alarms)

- [ ] "📋 Chits" button (`#alarms-mode-list`) — Chit-based alarms list
- [ ] "🛎️ Independent" button (`#alarms-mode-independent`) — Independent alerts board
- [ ] "🔔 Notifs" button (`#alarms-mode-notifications`) — Notifications view
- [ ] "📢 Reminders" button (`#alarms-mode-reminders`) — Reminders view

### Sidebar Controls (Section: View Mode — Tasks)

- [ ] "📋 Tasks" button (`#tasks-mode-tasks`) — Standard tasks view
- [ ] "🎯 Habits" button (`#tasks-mode-habits`) — Habits tracker view
- [ ] "📌 Assigned" button (`#tasks-mode-assigned`) — Assigned-to-me view
- [ ] Habits success window select (`#habits-success-window-sidebar`) — Options: 7 days, 30 days, 90 days, All time
- [ ] "Include in success rate" checkbox (`#habits-include-rules-cb`) — Toggle rule-based habits in success rate

### Sidebar Controls (Section: Indicators)

- [ ] Time range buttons (Day, Week, Month, Year, All) — `_indicatorsSetRange(range)`
- [ ] Custom range start date input (`#ind-start`)
- [ ] Custom range end date input (`#ind-end`)
- [ ] "Go" button — `_indicatorsLoadCustomRange()`
- [ ] Show Graphs multi-select (`#ind-select`)
- [ ] "+ Add Graph" toggle (`#ind-add-graph-toggle`) — Expands/collapses add graph section
- [ ] Add graph section (`#ind-add-graph-section`)

### Sidebar Controls (Section: Filters)

- [ ] Filters toggle label (`#filters-toggle-btn`) — Expands/collapses filters body
- [ ] "Clear" button (`#sidebar-clear-all-btn`) — Clears all filters, search, and sort
- [ ] "Defaults" button (`#reset-defaults-btn`) — Resets to tab's default filter
- [ ] Filter text input (`#search`) — Free-text filter with `onkeyup` → `searchChits()`
- [ ] Saved searches container (`#saved-searches`)

### Sidebar Controls (Section: Filters — Status)

- [ ] "— Any" checkbox (`data-any="true"`)
- [ ] "ToDo" checkbox
- [ ] "In Progress" checkbox
- [ ] "Blocked" checkbox
- [ ] "Complete" checkbox
- [ ] "Rejected" checkbox
- [ ] "Clear" button for status group

### Sidebar Controls (Section: Filters — Priority)

- [ ] "— Any" checkbox (`data-any="true"`)
- [ ] "Low" checkbox
- [ ] "Medium" checkbox
- [ ] "High" checkbox
- [ ] "Clear" button for priority group

### Sidebar Controls (Section: Filters — Tags)

- [ ] Tag multi-select container (`#label-multi`) — Populated by `_buildTagFilterPanel()`
- [ ] "Clear" button for tags group

### Sidebar Controls (Section: Filters — People)

- [ ] People container (`#people-multi`) — Populated by `_buildPeopleFilterPanel()`
- [ ] "Clear" button for people group

### Sidebar Controls (Section: Filters — Project)

- [ ] Project filter select (`#project-filter-select`) — Options: —, Any (has a project), None (no project), + dynamic project list
- [ ] "Clear" button for project group

### Sidebar Controls (Section: Filters — Display)

- [ ] "📌 Pinned" checkbox (`#show-pinned`) — default checked
- [ ] "📦 Archived" checkbox (`#show-archived`) — default unchecked
- [ ] "😴 Snoozed" checkbox (`#show-snoozed`) — default unchecked
- [ ] "📄 Unmarked" checkbox (`#show-unmarked`) — default checked
- [ ] "⏰ Past-Due" checkbox (`#show-past-due`) — default checked
- [ ] "✅ Complete" checkbox (`#show-complete`) — default checked
- [ ] "✗ Declined" checkbox (`#show-declined`) — default checked
- [ ] "🎯 Habits" checkbox (`#show-habits`) — default checked
- [ ] "📨 Email (Received)" checkbox (`#show-email-received`) — default unchecked
- [ ] "📤 Email (Sent)" checkbox (`#show-email-sent`) — default unchecked
- [ ] "🔗 Shared with me" checkbox (`#filter-shared-with-me`) — default unchecked
- [ ] "📤 Shared by me" checkbox (`#filter-shared-by-me`) — default unchecked

### Sidebar Controls (Section: Email)

- [ ] Email folder radio buttons: Inbox, Sent, Drafts, Scheduled, Trash
- [ ] "Unread at top" checkbox (`#email-unread-top-toggle`)
- [ ] Email account filter wrapper (`#email-account-filter-wrap`)

### Sidebar Navigation Buttons

- [ ] "People" button (`#sidebar-contacts-btn`) — Navigate to people page
- [ ] "🗺️ Maps" button (`#sidebar-maps-btn`) — Navigate to maps page
- [ ] "🌤️ Weather" button (`#sidebar-weather-btn` / `#cal-weather-btn`) — Click: weather page; Shift+click: weather modal; Long-press (mobile): weather modal
- [ ] "🕐 Clock" button (`#sidebar-clock-btn`) — Open clock modal
- [ ] "📺 Kiosk" button (`#sidebar-kiosk-btn`) — Navigate to kiosk view
- [ ] "🧮 Calculator" button (`#sidebar-calculator-btn`) — Toggle calculator overlay
- [ ] "🤖 Rules" button (`#sidebar-rules-btn`) — Navigate to rules manager
- [ ] "🗑️ Trash" button (`#sidebar-trash-btn`) — Navigate to trash page
- [ ] "🧩 Custom Objects" button (`#sidebar-custom-objects-btn`) — Navigate to custom objects editor

### Sidebar Bottom (Pinned)

- [ ] "Settings" button (`#sidebar-settings-btn`) — Navigate to settings page
- [ ] "📖 Reference" button (`#sidebar-reference-btn`) — Toggle keyboard shortcuts reference
- [ ] "📘 Help" button (`#sidebar-help-btn`) — Navigate to help page
- [ ] Version footer (`#sidebar-version-footer`) — Shows "C.W.'s Omni Chits" with version tooltip from `/api/version`

### Topbar Toggle

- [ ] `_toggleTopbar()` — Toggles header visibility; persists to localStorage
- [ ] `_restoreTopbarState()` — Restores topbar visibility from localStorage on load

### Notification Inbox

- [ ] `_toggleNotifInbox()` — Toggles notification inbox expanded/collapsed
- [ ] `_fetchNotifications()` — Fetches pending notifications from `/api/notifications`; fires toasts + system notifications for new items
- [ ] `_updateNotifBadge()` — Updates badge count on inbox button
- [ ] `_renderNotifInbox()` — Renders expanded notification list with Accept/Decline/Snooze/Dismiss buttons
- [ ] `_respondNotification(notifId, status)` — PATCH notification status (accepted/declined)
- [ ] `_dismissNotification(notifId)` — PATCH notification as dismissed
- [ ] `_snoozeNotification(notifId, minutes)` — POST snooze for given minutes

### Version Footer

- [ ] `_fetchSidebarVersion()` — Fetches version from `/api/version` and populates sidebar footer tooltip

### Filter Checkbox Wiring

- [ ] `_wireFilterCheckboxes(context)` — Wires onchange events on all filter checkboxes to invoke page's `onFilterChange`
- [ ] `_updateClearAllButton()` — Shows/hides Clear All button based on whether any filter is non-default
