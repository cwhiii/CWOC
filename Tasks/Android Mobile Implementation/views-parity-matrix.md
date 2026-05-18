# Complete Views, Pages, Tabs & Modes — Web vs Android Parity Matrix

## Web: Complete Inventory

### Standalone Pages (separate HTML files, separate URLs)

| # | Page | URL / File | Purpose |
|---|------|-----------|---------|
| 1 | Login | `/frontend/html/login.html` | Authentication |
| 2 | Dashboard | `/frontend/html/index.html` | Main app — hosts all C CAPTN tabs |
| 3 | Chit Editor | `/frontend/html/editor.html` | Create/edit chits |
| 4 | Settings | `/frontend/html/settings.html` | User/admin settings (5 tabs) |
| 5 | People (Contact List) | `/frontend/html/people.html` | Contact list with import/export |
| 6 | Contact Editor | `/frontend/html/contact-editor.html` | Create/edit contacts |
| 7 | Contact Trash | `/frontend/html/contact-trash.html` | Restore/purge deleted contacts |
| 8 | Trash | `/frontend/html/trash.html` | Restore/purge deleted chits |
| 9 | Weather | `/frontend/html/weather.html` | 16-day forecast grid |
| 10 | Maps | `/frontend/html/maps.html` | Full-page map with markers |
| 11 | Help | `/frontend/html/help.html` | Documentation viewer |
| 12 | Audit Log | `/frontend/html/audit-log.html` | View/filter/export audit entries |
| 13 | Attachments | `/frontend/html/attachments.html` | Browse all attachments |
| 14 | Rules Manager | `/frontend/html/rules-manager.html` | List/manage automation rules |
| 15 | Rule Editor | `/frontend/html/rule-editor.html` | Create/edit a single rule |
| 16 | Custom Objects Editor | `/frontend/html/custom-objects-editor.html` | Manage health indicators/zones |
| 17 | User Admin | `/frontend/html/user-admin.html` | Manage users (admin only) |
| 18 | Admin Chits | `/frontend/html/admin-chits.html` | Bulk chit management (admin) |
| 19 | Kiosk | `/frontend/html/kiosk.html` | Multi-user kiosk display |
| 20 | Notifications | `/frontend/html/notifications.html` | Notification center (standalone) |

### Dashboard Tabs (within index.html)

| # | Tab | Internal Name | Implementation |
|---|-----|--------------|----------------|
| 1 | Calendar | `Calendar` | `main-calendar.js` |
| 2 | Checklists | `Checklists` | `main-views.js` (displayChecklistView) |
| 3 | Tasks | `Tasks` | `main-views-tasks.js` |
| 4 | Projects | `Projects` | `main-views-projects.js` |
| 5 | Notes | `Notes` | `main-views-notes.js` |
| 6 | Notebook | `Notebook` | `main-views-notebook.js` (hidden by default) |
| 7 | Email | `Email` | `main-email.js` + `main-email-bundles.js` |
| 8 | Indicators | `Indicators` | `main-views-indicators.js` |
| 9 | Alerts | `Alarms` | `main-views-alarms.js` |
| 10 | Search | `Search` | `main-search.js` (icon-only tab) |
| 11 | Omni View | (programmatic) | `main-omni.js` |

### Tab Sub-Modes (within dashboard tabs)

| # | Parent Tab | Sub-Mode | Toggle |
|---|-----------|----------|--------|
| 1 | Calendar | Day | Period selector dropdown |
| 2 | Calendar | Week | Period selector dropdown |
| 3 | Calendar | Work (work hours only) | Period selector dropdown |
| 4 | Calendar | SevenDay (X-Day) | Period selector dropdown |
| 5 | Calendar | Month | Period selector dropdown |
| 6 | Calendar | Year | Period selector dropdown |
| 7 | Calendar | Itinerary | Period selector dropdown |
| 8 | Tasks | Tasks (default) | Sidebar mode button |
| 9 | Tasks | Habits | Sidebar mode button |
| 10 | Tasks | Assigned to Me | Sidebar mode button |
| 11 | Projects | Kanban (default) | Sidebar mode button |
| 12 | Projects | List (hidden/preserved) | Sidebar mode button |
| 13 | Alerts | Independent (default) | Sidebar mode button |
| 14 | Alerts | List | Sidebar mode button |
| 15 | Alerts | Notifications | Sidebar mode button |
| 16 | Alerts | Reminders | Sidebar mode button |
| 17 | Indicators | Charts (default) | Pill toggle |
| 18 | Indicators | Calendar | Pill toggle |
| 19 | Indicators | Log | Pill toggle |
| 20 | Email | Inbox (default) | Sidebar radio |
| 21 | Email | Sent | Sidebar radio |
| 22 | Email | Drafts | Sidebar radio |
| 23 | Email | Scheduled | Sidebar radio |
| 24 | Email | Trash | Sidebar radio |
| 25 | Email | Archived | Sidebar radio |
| 26 | Month view | Compress mode | Pill toggle |
| 27 | Month view | Scroll mode | Pill toggle |

### Settings Page Tabs

| # | Tab | Content |
|---|-----|---------|
| 1 | General | Core preferences, clocks, timezone, chit options, visual indicators |
| 2 | Views | Calendar, Omni, habits, projects, maps settings |
| 3 | Collections | Tags, colors, saved locations, default notifications |
| 4 | Email | Accounts, sync, privacy, bundles, badges |
| 5 | Administration | Users, data management, dependent apps, version |

---

## Android: Complete Inventory

### Registered Navigation Routes (from CwocNavGraph.kt)

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| 1 | Login | `Screen.Login` | Authentication |
| 2 | Tasks | `Screen.Tasks` | Tasks view (default after login) |
| 3 | Notes | `Screen.Notes` | Notes view |
| 4 | Calendar | `Screen.Calendar` | Calendar views |
| 5 | Checklists | `Screen.Checklists` | Checklists view |
| 6 | Alerts | `Screen.Alarms` | Alerts view |
| 7 | Projects | `Screen.Projects` | Projects/Kanban view |
| 8 | Indicators | `Screen.Indicators` | Health indicators charts |
| 9 | Contacts | `Screen.Contacts` | Contact list |
| 10 | Contact Editor | `Screen.ContactEditor` | Create/edit contacts |
| 11 | Map | `Screen.Map` | Map with markers |
| 12 | Settings | `Screen.Settings` | Settings (3 tabs) |
| 13 | Trash | `Screen.Trash` | Restore/purge deleted chits |
| 14 | Weather | `Screen.Weather` | Weather forecasts |
| 15 | Omni View | `Screen.OmniView` | Omni dashboard |
| 16 | Search | `Screen.Search` | Search screen |
| 17 | Help | `Screen.Help` | Documentation viewer |
| 18 | Notifications | `Screen.Notifications` | Notification center |
| 19 | Chit Editor | `Screen.Editor` | Create/edit chits |

### Android Tab Sub-Modes

| # | Parent Screen | Sub-Mode | Available |
|---|--------------|----------|-----------|
| 1 | Calendar | Day | ✅ (FilterChip) |
| 2 | Calendar | Week | ✅ (FilterChip) |
| 3 | Calendar | Month | ✅ (FilterChip) |
| 4 | Calendar | Year | ✅ (FilterChip) |
| 5 | Calendar | Itinerary | ✅ (FilterChip) |
| 6 | Calendar | X-Day | ✅ (FilterChip) |
| 7 | Indicators | Charts only | (no mode toggle) |

### Android Settings Tabs

| # | Tab | Content |
|---|-----|---------|
| 1 | General | Unit system, snooze, calendar snap, time format, timezone, default view, view order, enabled periods |
| 2 | Views | Week start day, enabled periods, X-Day count |
| 3 | Admin | Sync diagnostics (Android-specific) |

---

## Parity Comparison

### Pages: Web → Android

| # | Web Page | Android Equivalent | Status |
|---|----------|-------------------|--------|
| 1 | Login | LoginScreen | ✅ Present |
| 2 | Dashboard (tabs) | Individual tab screens | ✅ Present (split into separate screens) |
| 3 | Chit Editor | ChitEditorScreen | ✅ Present |
| 4 | Settings | SettingsScreen | ⚠️ Present (3 tabs vs 5, ~9% field coverage) |
| 5 | People (Contact List) | ContactListScreen | ⚠️ Present (missing import/export/group) |
| 6 | Contact Editor | ContactEditorScreen | ⚠️ Present (missing many zones/fields) |
| 7 | Contact Trash | — | ❌ **NOT PRESENT** |
| 8 | Trash | TrashScreen | ⚠️ Present (missing bulk ops) |
| 9 | Weather | WeatherScreen | ⚠️ Present (different layout) |
| 10 | Maps | MapScreen | ⚠️ Present (missing filters/modes) |
| 11 | Help | HelpScreen | ⚠️ Present (missing search) |
| 12 | Audit Log | — | ❌ **NOT PRESENT** |
| 13 | Attachments Browser | — | ❌ **NOT PRESENT** |
| 14 | Rules Manager | — | ❌ **NOT PRESENT** |
| 15 | Rule Editor | — | ❌ **NOT PRESENT** |
| 16 | Custom Objects Editor | — | ❌ **NOT PRESENT** |
| 17 | User Admin | — | ❌ **NOT PRESENT** |
| 18 | Admin Chits | — | ❌ **NOT PRESENT** |
| 19 | Kiosk | — | ❌ **NOT PRESENT** |
| 20 | Notifications | NotificationsScreen | ✅ Present |

### Dashboard Tabs: Web → Android

| # | Web Tab | Android Screen | Status |
|---|---------|---------------|--------|
| 1 | Calendar | CalendarScreen | ⚠️ Present (missing time grid, Work view, drag) |
| 2 | Checklists | ChecklistsScreen | ⚠️ Present (missing masonry, drag, colors) |
| 3 | Tasks | TasksScreen | ⚠️ Present (missing sub-modes) |
| 4 | Projects | ProjectsScreen | ⚠️ Present (missing drag, metadata, create child) |
| 5 | Notes | NotesScreen | ⚠️ Present (missing masonry, colors) |
| 6 | Notebook | — | ❌ **NOT PRESENT** (hidden on web too) |
| 7 | **Email** | — | ❌ **NOT PRESENT** |
| 8 | Indicators | IndicatorsScreen | ⚠️ Present (missing Calendar/Log modes) |
| 9 | Alerts | AlertsScreen | ⚠️ Present (missing 3 of 4 modes) |
| 10 | Search | SearchScreen | ⚠️ Present (local-only, missing fields) |
| 11 | Omni View | OmniViewScreen | ⚠️ Present (missing settings integration) |

### Tab Sub-Modes: Web → Android

| # | Web Sub-Mode | Android | Status |
|---|-------------|---------|--------|
| 1 | Calendar → Day | ✅ (but flat list, no time grid) | ⚠️ PARTIAL |
| 2 | Calendar → Week | ✅ (but flat list, no time grid) | ⚠️ PARTIAL |
| 3 | Calendar → Work | — | ❌ **NOT PRESENT** |
| 4 | Calendar → SevenDay/X-Day | ✅ | ✅ |
| 5 | Calendar → Month | ✅ | ✅ |
| 6 | Calendar → Year | ✅ | ✅ |
| 7 | Calendar → Itinerary | ✅ | ✅ |
| 8 | Tasks → Tasks | ✅ (default) | ✅ |
| 9 | Tasks → Habits | — | ❌ **NOT PRESENT** |
| 10 | Tasks → Assigned to Me | — | ❌ **NOT PRESENT** |
| 11 | Projects → Kanban | ✅ (expandable) | ⚠️ PARTIAL |
| 12 | Projects → List | — | ❌ NOT PRESENT (hidden on web too) |
| 13 | Alerts → Independent | — | ❌ **NOT PRESENT** |
| 14 | Alerts → List | ✅ (classified list) | ⚠️ PARTIAL |
| 15 | Alerts → Notifications | — | ❌ **NOT PRESENT** |
| 16 | Alerts → Reminders | — | ❌ **NOT PRESENT** |
| 17 | Indicators → Charts | ✅ | ✅ |
| 18 | Indicators → Calendar | — | ❌ **NOT PRESENT** |
| 19 | Indicators → Log | — | ❌ **NOT PRESENT** |
| 20 | Email → Inbox | — | ❌ **NOT PRESENT** |
| 21 | Email → Sent | — | ❌ **NOT PRESENT** |
| 22 | Email → Drafts | — | ❌ **NOT PRESENT** |
| 23 | Email → Scheduled | — | ❌ **NOT PRESENT** |
| 24 | Email → Trash | — | ❌ **NOT PRESENT** |
| 25 | Email → Archived | — | ❌ **NOT PRESENT** |
| 26 | Month → Compress | — | ❌ **NOT PRESENT** |
| 27 | Month → Scroll | — | ❌ **NOT PRESENT** |

### Settings Tabs: Web → Android

| # | Web Tab | Android | Status |
|---|---------|---------|--------|
| 1 | General | General tab (partial) | ⚠️ ~20% coverage |
| 2 | Views | Views tab (partial) | ⚠️ ~17% coverage |
| 3 | Collections | — | ❌ **NOT PRESENT** |
| 4 | Email | — | ❌ **NOT PRESENT** |
| 5 | Administration | Admin tab (diagnostics only) | 🔄 DIFFERENT (Android-specific content) |

---

## Summary: What's Missing

### Entire Pages/Screens Not Present on Android (8)
1. **Email View** (full email client — inbox, compose, reply, bundles, multi-account)
2. **Audit Log** (view, filter, export audit entries)
3. **Attachments Browser** (browse all attachments across chits)
4. **Rules Manager** (list, manage, reorder automation rules)
5. **Rule Editor** (create/edit rules with triggers, conditions, actions)
6. **Custom Objects Editor** (manage health indicators and zones)
7. **User Admin** (manage users — create, edit, deactivate)
8. **Contact Trash** (restore/purge deleted contacts separately from chit trash)

### Entire Tab Sub-Modes Not Present on Android (12)
1. Calendar → Work view
2. Tasks → Habits sub-mode
3. Tasks → Assigned to Me sub-mode
4. Alerts → Independent board (standalone alarms/timers/stopwatches)
5. Alerts → Notifications mode
6. Alerts → Reminders mode
7. Indicators → Calendar mode
8. Indicators → Log mode
9. Email → Inbox (entire tab missing)
10. Email → Sent/Drafts/Scheduled/Trash/Archived (all sub-filters)
11. Month → Compress/Scroll toggle
12. Notebook tab (hidden on web, not on Android)

### Pages Present But Significantly Incomplete (10)
1. Calendar Day/Week — flat list instead of time grid
2. Settings — ~9% field coverage (10 of 115 fields)
3. Contact Editor — missing image, security, social zones
4. People List — missing import/export/group
5. Checklists — missing masonry, drag, colors, indicators
6. Projects — missing drag-drop, create child, metadata
7. Alerts — only has classified list (1 of 4 modes)
8. Indicators — only has charts (1 of 3 modes)
9. Maps — missing filters, modes, geocoding
10. Weather — fundamentally different layout

### Low Priority (hidden/admin features)
- Kiosk view (admin-only display mode)
- Admin Chits page (admin bulk operations)
- Notebook tab (hidden by default on web)
- Projects List mode (hidden on web, Kanban is default)
