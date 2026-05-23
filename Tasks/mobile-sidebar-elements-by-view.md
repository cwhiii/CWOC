# Mobile Sidebar Elements by View & Mode

This documents the EXACT elements present in the left sidebar for every view and mode on mobile (≤480px). On mobile, the sidebar is a full-width overlay opened via the hamburger button or swipe-from-left-edge.

The sidebar is the same on mobile as desktop — no elements are hidden specifically for mobile. The only difference is presentation (overlay vs. persistent panel).

---

## Sidebar Structure (top to bottom)

### Always Visible (all views)

| # | Element | ID | Description |
|---|---|---|---|
| 1 | **Create Chit** button | `#section-create` | Action button with icon + "Create Chit" text. Right-click opens Quick Alert modal. |
| 2 | **People** button | `#sidebar-contacts-btn` | Navigates to People page |
| 3 | **Maps** / **Weather** buttons | `#sidebar-maps-btn`, `#sidebar-weather-btn` | Side-by-side compact buttons |
| 4 | **Clock** / **Kiosk** buttons | `#sidebar-clock-btn`, `#sidebar-kiosk-btn` | Side-by-side compact buttons |
| 5 | **Calculator** / **Rules** buttons | `#sidebar-calculator-btn`, `#sidebar-rules-btn` | Side-by-side compact buttons |
| 6 | **Trash** / **Custom Objects** buttons | `#sidebar-trash-btn`, `#sidebar-custom-objects-btn` | Side-by-side compact buttons |
| 7 | **Settings** button | `#sidebar-settings-btn` | Pinned to bottom of sidebar |
| 8 | **Reference** / **Help** buttons | `#sidebar-reference-btn`, `#sidebar-help-btn` | Pinned to bottom, side-by-side |
| 9 | **Version footer** | `#sidebar-version-footer` | "C.W.'s Omni Chits" link, pinned bottom |

---

## View-Specific Elements

### 📅 Calendar

| Element | ID | Details |
|---|---|---|
| **Today** button | `#sidebar-today-btn` | "Today" with calendar icon |
| **◄ / ►** nav buttons | `#sidebar-prev-btn`, `#sidebar-next-btn` | Previous/next period |
| **Year display** | `#year-display` | Current year |
| **Week range** | `#week-range` | Date range label |
| **Time Period** dropdown | `#period-select` | Options: Itinerary, Day, Work Hours, Week, X Days, Month, Year |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Calendar + Month mode only:**

| Element | ID | Details |
|---|---|---|
| **Options** (collapsible) | `#section-cal-options` | Contains Month compress/scroll toggle |
| └ Month mode pill toggle | `#month-mode-pill` | 2-value toggle: Compress / Scroll |

**Calendar does NOT show:** Order/Sort

---

### ✅ Checklists

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Options: None, Title, Start, Due, Updated, Created, Status, Manual, Random, Upcoming |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ (visible only when a sort is selected) |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Checklists does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Tasks mode, Indicators, Email controls

---

### 📋 Tasks

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **View Mode** buttons | `#section-tasks-mode` | 3-button grid: |
| └ 📋 Tasks | `#tasks-mode-tasks` | Default mode |
| └ 🎯 Habits | `#tasks-mode-habits` | Habits mode |
| └ 📌 Assigned | `#tasks-mode-assigned` | Assigned-to-me mode |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Tasks → Habits sub-mode additionally shows:**

| Element | ID | Details |
|---|---|---|
| **Success Window** dropdown | `#habits-success-window-sidebar` | Options: Last 7 days, Last 30 days, Last 90 days, All time |
| **Rule Habits** checkbox | `#habits-include-rules-cb` | "Include in success rate" |

**Tasks does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Indicators, Email controls

---

### 📁 Projects

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Projects does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Tasks mode, Indicators, Email controls

---

### 📝 Notes

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Notes does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Tasks mode, Indicators, Email controls

---

### 📓 Notebook (hidden by default, user-enabled via Settings → Views)

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

Same sidebar as Notes. Notebook is a combined Notes + Checklists view. Mutually exclusive with Notes/Checklists tabs.

---

### 🔔 Alarms (Alerts)

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **View Mode** buttons | `#section-alarms-mode` | 2×2 grid: |
| └ 📋 Chits | `#alarms-mode-list` | Chits with alarms |
| └ 🛎️ Independent | `#alarms-mode-independent` | Standalone alerts |
| └ 🔔 Notifs | `#alarms-mode-notifications` | Notifications view |
| └ 📢 Reminders | `#alarms-mode-reminders` | Reminders view |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

**Alarms does NOT show:** Date nav, Time Period, Cal Options, Tasks mode, Indicators, Email controls

---

### 📧 Email

| Element | ID | Details |
|---|---|---|
| **Check Mail** button | `#sidebar-check-mail-btn` | Sync icon + "Check Mail" |
| **Account filter** | `#email-account-filter-wrap` | Dynamic account buttons |
| **Folder** radio group | `#email-folder-select` | Radio buttons: |
| └ 📥 Inbox | `value="inbox"` | Default selected |
| └ ✈️ Sent | `value="sent"` | |
| └ 📄 Drafts | `value="drafts"` | |
| └ 🕐 Scheduled | `value="scheduled"` | |
| └ 📦 Archive | `value="archived"` | |
| └ 🗑️ Trash | `value="email-trash"` | Navigates to trash page |
| **Unread at top** checkbox | `#email-unread-top-toggle` | Toggle unread sorting |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) — but "Email (Received)" and "Email (Sent)" display toggles are hidden |

**Email does NOT show:** Date nav, Time Period, Cal Options, Order/Sort, Alarms mode, Tasks mode, Indicators

---

### 📊 Indicators

| Element | ID | Details |
|---|---|---|
| **View Mode** buttons | `._ind-mode-btn` | 3-button row: 📊 Charts, 📅 Calendar, 📋 Log |
| **Time Range** buttons | `#section-indicators` | 5-button row: Day, Week, Month, Year, All |
| **Custom Range** inputs | `#ind-start`, `#ind-end` | Date pickers + Go button |
| **Show Graphs** checklist | `#ind-select` | Multi-select of available graphs |
| **+ Add Graph** toggle | `#ind-add-graph-toggle` | Expandable section to add new graphs |
| └ Graph list | `#ind-add-graph-section` | Available graphs to add |

**Indicators does NOT show:** Date nav, Time Period, Cal Options, Order/Sort, Alarms mode, Tasks mode, Email controls, **Filters**

---

### 🔍 Search

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

Same sidebar as Checklists/Notes/Projects. Search uses the filter text input as its search query.

**Search does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Tasks mode, Indicators, Email controls

---

### 🌐 Omni View (triggered from logo/profile, not a tab)

| Element | ID | Details |
|---|---|---|
| **Order** dropdown | `#sort-select` | Same options as above |
| **Sort direction** button | `#sort-dir-btn` | ▲/▼ |
| **Filters** (collapsible) | `#section-filters` | Full filter panel (see below) |

Same sidebar as Checklists/Notes/Projects. Omni View shows a combined calendar-style view of all chits.

**Omni does NOT show:** Date nav, Time Period, Cal Options, Alarms mode, Tasks mode, Indicators, Email controls

---

## Filters Section (when visible)

The Filters section (`#section-filters`) is collapsible (collapsed by default). When expanded, it contains:

| # | Filter Group | ID | Contents |
|---|---|---|---|
| 1 | **Header row** | — | "▶ Filters" label + Clear button + Defaults button |
| 2 | **Filter Text** | `#filter-words` | Text input (`#search`) + saved searches chips |
| 3 | **Status** (collapsible) | `#filter-status` | Multi-select: Any, ToDo, In Progress, Blocked, Complete, Rejected |
| 4 | **Priority** (collapsible) | `#filter-priority` | Multi-select: Any, Low, Medium, High |
| 5 | **Tags** (collapsible) | `#filter-label` | Dynamic tag tree with checkboxes |
| 6 | **People** (collapsible) | `#filter-people` | Dynamic people chips/checkboxes |
| 7 | **Project** (collapsible) | `#filter-project` | Dropdown: —, Any (has a project), None (no project), + all project names |
| 8 | **Display** (collapsible) | `#filter-archive` | Checkboxes: |
| | | | 📌 Pinned (checked by default) |
| | | | 📦 Archived |
| | | | 😴 Snoozed |
| | | | 📄 Unmarked (checked by default) |
| | | | ─── separator ─── |
| | | | ⏰ Past-Due (checked by default) |
| | | | ✅ Complete (checked by default) |
| | | | ✗ Declined (checked by default) |
| | | | 🎯 Habits (checked by default) |
| | | | 📨 Email (Received) — hidden on Email tab |
| | | | 📤 Email (Sent) — hidden on Email tab |
| | | | ─── separator ─── |
| | | | 🔗 Shared with me |
| | | | 📤 Shared by me |

---

## Summary Matrix

| Section | Calendar | Checklists | Tasks | Projects | Notes | Notebook | Alarms | Email | Indicators | Search | Omni |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Create Chit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Email Controls | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Date Nav (Today/◄►/range) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Order/Sort | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Time Period | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cal Options (Month) | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Alarms Mode | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tasks Mode | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Indicators Controls | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Filters | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Nav Buttons (People/Maps/etc) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trash/Custom Objects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings/Reference/Help | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Cal Options only visible when Time Period = Month


---

## Android App — Summary Matrix

The Android app sidebar is built in Jetpack Compose (`SidebarContent.kt`). After fixes, Date Nav, Time Period, Order/Sort, and Filters now match the web's conditional visibility rules.

| Section | Calendar | Checklists | Tasks | Projects | Notes | Notebook | Alarms | Email | Indicators | Search | Omni |
|---|---|---|---|---|---|---|---|---|---|---|---|
| New Chit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Email Controls | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Date Nav (Today/◄►/range) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Order/Sort | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Time Period | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cal Options (Month) | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Alarms Mode | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tasks Mode | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Indicators Controls | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Filters | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Nav Buttons (People/Maps/etc) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trash/Custom Objects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings/Reference/Help | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Cal Options only visible when Time Period = Month

### Key Differences: App vs Web (after fix)

| Section | Web Behavior | App Behavior | Parity? |
|---|---|---|---|
| Date Nav (Today/◄►/range) | Only on Calendar | Only on Calendar | ✅ |
| Order/Sort | Hidden on Calendar, Email, Indicators | Hidden on Calendar, Email, Indicators | ✅ |
| Time Period | Only on Calendar | Only on Calendar | ✅ |
| Filters | Hidden on Indicators | Hidden on Indicators | ✅ |
| Indicators View Mode | Charts/Calendar/Log toggle | Charts/Calendar/Log toggle | ✅ |
| Email Folders | Inbox, Sent, Drafts, Scheduled, Archive, Trash | Inbox, Sent, Drafts, Scheduled, Trash, Archive | ✅ |

### App Sidebar Structure (top to bottom, from SidebarContent.kt)

1. **✚ New Chit** button — always visible
2. **📬 Check Mail** button — Email tab only
3. **Email Account pills** — Email tab only (when accounts exist)
4. **Folder** radio group — Email tab only (Inbox/Sent/Drafts/Scheduled/Trash/Archive)
5. **Unread at top** checkbox — Email tab only
6. **📅 Today** button — Calendar tab only
7. **◄ / ►** nav + year + date range — Calendar tab only
8. **Order** dropdown (Sort) + direction toggle — hidden on Calendar, Email, Indicators
9. **Time Period** dropdown — Calendar tab only
10. **Options → Month Mode** (Compress/Scroll) — Calendar + Month only
11. **View Mode** (Chits/Independent/Notifs/Reminders) — Alarms tab only
12. **View Mode** (Tasks/Habits/Assigned) — Tasks tab only
13. **Habits Success Window** dropdown + Include Rule Habits checkbox — Tasks tab + Habits mode only
14. **View Mode** (Charts/Calendar/Log) — Indicators tab only
15. **Time Range** buttons (Day/Week/Month/Year/All) — Indicators tab only
16. **🔍 Filters** (collapsible) — hidden on Indicators, contains:
    - Filter Text + saved searches
    - Status (collapsible): Any/ToDo/In Progress/Blocked/Complete/Rejected
    - Priority (collapsible): Any/Low/Medium/High
    - Tags (collapsible): tag tree with checkboxes
    - People (collapsible): people chips
    - Project (collapsible): dropdown
    - Display (collapsible): same checkboxes as web
17. **👥 People** button — always visible
18. **🗺️ Maps** / **🌤️ Weather** — always visible, side-by-side
19. **🕐 Clock** / **📺 Kiosk** — always visible, side-by-side
20. **🧮 Calc** / **🤖 Rules** — always visible, side-by-side
21. **🗑️ Trash** / **🧩 Custom** — always visible, side-by-side
22. ─── Bottom pinned (non-scrolling) ───
23. **⚙️ Settings** button
24. **📖 Reference** / **📘 Help** — side-by-side
25. **Version** footer (vX.X.X)
