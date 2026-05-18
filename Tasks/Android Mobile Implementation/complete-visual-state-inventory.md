# Complete Visual State Inventory — CWOC

Every page, view, mode, tab, sub-mode, and distinct visual state a user can navigate to.

---

## 1. Top-Level Pages (20 HTML files)

| # | Page | URL / File | Purpose |
|---|------|-----------|---------|
| 1 | Dashboard | `/` (`index.html`) | Main app — tabs, sidebar, chit views |
| 2 | Chit Editor | `/editor` (`editor.html`) | Create/edit chits |
| 3 | Settings | `/frontend/html/settings.html` | All app settings |
| 4 | People (Rolodex) | `/frontend/html/people.html` | Contact list |
| 5 | Contact Editor | `/frontend/html/contact-editor.html` | Edit/create contacts |
| 6 | Weather | `/frontend/html/weather.html` | Weather forecast |
| 7 | Trash | `/frontend/html/trash.html` | Deleted chits |
| 8 | Contact Trash | `/frontend/html/contact-trash.html` | Deleted contacts |
| 9 | Audit Log | `/frontend/html/audit-log.html` | Change history |
| 10 | Help | `/frontend/html/help.html` | Documentation viewer |
| 11 | Maps | `/maps` (`maps.html`) | Map view of chit/contact locations |
| 12 | Kiosk | `/frontend/html/kiosk.html` | Display-only mode |
| 13 | Login | `/frontend/html/login.html` | Authentication |
| 14 | Notifications | `/frontend/html/notifications.html` | Notification center |
| 15 | Admin Chits | `/frontend/html/admin-chits.html` | Admin chit manager |
| 16 | User Admin | `/frontend/html/user-admin.html` | User management |
| 17 | Rules Manager | `/frontend/html/rules-manager.html` | Automation rules list |
| 18 | Rule Editor | `/frontend/html/rule-editor.html` | Individual rule editor |
| 19 | Custom Objects Editor | `/frontend/html/custom-objects-editor.html` | Custom indicators/objects |
| 20 | Attachments | `/frontend/html/attachments.html` | Attachment browser grid |

---

## 2. Dashboard Tabs (10 tabs)

| # | Tab | Hash | Default Mode |
|---|-----|------|-------------|
| 1 | Calendar | `#calendar` | Week |
| 2 | Checklists | `#checklists` | (single view) |
| 3 | Tasks | `#tasks` | tasks |
| 4 | Projects | `#projects` | kanban |
| 5 | Notes | `#notes` | (masonry) |
| 6 | Notebook | `#notebook` | (combined notes+checklists masonry) |
| 7 | Email | `#email` | inbox |
| 8 | Indicators | `#indicators` | charts |
| 9 | Alarms (Alerts) | `#alarms` | independent |
| 10 | Search | (no hash) | (search results) |

Plus: **Omni View** — activated by clicking the "Omni" header text (not a tab button).

---

## 3. Calendar Views (7 period views × 1 sub-mode)

| # | View | Hash | Description |
|---|------|------|-------------|
| 1 | Week | `#calendar/week` | 7-day time grid starting from week start day |
| 2 | Day | `#calendar/day` | Single day time grid |
| 3 | SevenDay (X-Day) | `#calendar/sevenday` | Configurable N-day view (2–30 days, default 7) starting from today |
| 4 | Work | `#calendar/work` | Filtered to work days + work hours only |
| 5 | Month | `#calendar/month` | Grid calendar |
| 6 | Itinerary | `#calendar/itinerary` | Agenda-style list view |
| 7 | Year | `#calendar/year` | 12-month overview (click day → Day view) |

**Month sub-mode toggle:**
- Compress (default) — fits all events into fixed-height cells
- Scroll — cells expand to show all events, page scrolls

---

## 4. Tasks Tab Sub-Modes (3)

| # | Mode | Hash | Description |
|---|------|------|-------------|
| 1 | Tasks | `#tasks` | Task list with status dropdowns |
| 2 | Habits | `#tasks/habits` | Habit tracker cards (On Deck / Out of Mind / Accomplished sections) |
| 3 | Assigned | `#tasks/assigned` | Chits assigned to current user |

---

## 5. Alarms Tab Sub-Modes (4)

| # | Mode | Hash | Description |
|---|------|------|-------------|
| 1 | Independent | `#alarms/independent` | Standalone alarms, timers, stopwatches board |
| 2 | List | `#alarms/list` | Chits with alert properties |
| 3 | Notifications | `#alarms/notifications` | Notification-type alerts |
| 4 | Reminders | `#alarms/reminders` | Reminder-type alerts |

---

## 6. Projects Tab Sub-Modes (2)

| # | Mode | Hash | Description |
|---|------|------|-------------|
| 1 | Kanban | `#projects/kanban` | Kanban board with status columns per project |
| 2 | List | `#projects/list` | Tree list of project masters + children |

---

## 7. Indicators Tab Sub-Modes (3)

| # | Mode | Description |
|---|------|-------------|
| 1 | Charts | SVG line charts for health indicator data (with time range buttons) |
| 2 | Calendar | Year-view calendar grid with color-coded days |
| 3 | Log | Reverse-chronological log list of indicator entries |

---

## 8. Email Tab Sub-Filters (6 folders)

| # | Folder | Description |
|---|--------|-------------|
| 1 | Inbox | Received emails (default) |
| 2 | Sent | Sent emails |
| 3 | Drafts | Unsent draft emails |
| 4 | Scheduled | Drafts with a scheduled send time |
| 5 | Trash | Trashed emails |
| 6 | Archived | Archived emails |

Plus: **Bundle tabs** within Inbox (user-defined email bundles that filter the inbox view).

Plus: **Thread expansion** — clicking an email thread expands it inline to show all messages.

---

## 9. Omni View Sections (configurable layout)

| # | Section | Description |
|---|---------|-------------|
| 1 | HST Bar | Horizontal Strip Timeline |
| 2 | Weather | Current weather bar |
| 3 | HST + Weather | Combined HST and weather |
| 4 | HST Weather Strip | Temperature strip variant |
| 5 | Chrono Anchored | Time-anchored upcoming items |
| 6 | Reminders | Reminder chits |
| 7 | On Deck | Next-up items |
| 8 | Soon | Upcoming items |
| 9 | Email | Recent emails with pagination |
| 10 | Pinned Notes | Pinned note cards |
| 11 | Pinned Checklists | Pinned checklist cards |
| 12 | Pinned All | All pinned items combined |

HST Bar has its own mode toggle: `chits`, `both`, `weather`, `none`.

---

## 10. Settings Tabs & Sections

### Tab 1: ⚙️ General
- General Settings (timezone, etc.)
- Contact Vault (default share setting)
- Clocks (clock format, analog/digital)
- Display Options (default view, view order, sort order)
- Chit Options (visual indicators toggle)
- Custom Filters & Sorting
- Install as App (PWA install, notifications)

### Tab 2: 👁️ Views
- **Omni View** — HST bar clock, layout editor, bundle toggles, email count, colors, locked filter defaults
- **Calendar** — view hours, scroll-to hour, enabled periods, X-day count, work hours/days
- **Habits** — success rate window, show on calendar toggle
- **Projects** — child chit count, checklist progress display
- **Maps** — auto-zoom, default coordinates/zoom

### Tab 3: 📦 Collections
- **Tag Editor** — tag tree with create/edit/delete/reorder
- **Custom Colors** — default colors, custom colors, border color assignment
- **Saved Locations** — location rows with default radio
- **Default Notifications** — start time notifications, due time notifications

### Tab 4: ✉️ Email
- **Accounts & Syncing** — accounts list, max pull, check interval, backfill
- **Privacy & Sending** — block tracking, external content, read receipts, undo send delay, signature, attachments size limit
- **Display & Bundles** — group by, paginate, bundles (enable, multi-placement, count display), auto-bundles
- **Badges** — display (max per email), detectors, custom detectors

### Tab 5: 🔒 Administration (admin-only)
- **Admin** — Manage Users button, Chit Manager button
- **Tools** — Kiosk
- **Data Management** — All Data (export/import/replace/purge), Calendar Export (Google/Apple/Outlook sub-tabs), Audit Log
- **Dependent Apps** — Tailscale, Ntfy, Home Assistant
- **Version & Updates** — version display, release notes modal, update button

---

## 11. Editor Zones (collapsible sections)

| # | Zone | Key Features |
|---|------|-------------|
| 1 | Header | Title, status dropdown, priority, pinned toggle, archived toggle |
| 2 | Dates & Times | Date mode (start/end, due, point-in-time), recurrence, all-day toggle |
| 3 | Tags | Tag tree selection with inline creation |
| 4 | People | Contact chips, grouped tree picker |
| 5 | Location | Address, weather at location, map preview, saved locations |
| 6 | Notes | Markdown editor with live preview / source / rendered modes |
| 7 | Alerts | Alarms, timers, stopwatches, notifications (including weather-based) |
| 8 | Color | Color swatches, custom colors |
| 9 | Health Indicators | Custom object data entry fields |
| 10 | Checklist | Nested items, drag-drop, undo, auto-save toggle, auto-complete toggle |
| 11 | Projects | Kanban board (when chit is project master), child chit management |
| 12 | Email | Email compose/read zone (To, CC, BCC, Subject, Body, attachments) |

**Editor modes:**
- New chit (blank)
- New chit pre-filled from URL params (e.g., from calendar double-click with start/end times)
- New email draft (`?new=email&expand=email`)
- Edit existing chit
- Edit existing email (received/sent/draft)

**Email Expand Modal** (full-screen overlay within editor):
- Live Preview mode (WYSIWYG-style editing)
- Edit/Render mode (textarea + rendered toggle)
- HTML/Text view toggle (for received emails with HTML content)

---

## 12. Maps Page Modes (3)

| # | Mode | Description |
|---|------|-------------|
| 1 | Chits | Show chit locations on map |
| 2 | People | Show contact locations on map |
| 3 | Both | Show both chits and contacts |

Plus: sidebar with date/tag/status filters, "All People" checkbox, focus mode.

---

## 13. People Page Modes (2)

| # | Mode | Description |
|---|------|-------------|
| 1 | Grouped (default) | Sections: Favorites, Users, All Contacts, Vault Contacts |
| 2 | Ungrouped | Flat alphabetical list of all contacts + users |

---

## 14. Contact Editor Modes (2)

| # | Mode | URL Param | Description |
|---|------|-----------|-------------|
| 1 | Contact mode | (default) | Create/edit a contact |
| 2 | Profile mode | `?mode=profile&user_id=...` | View/edit a user profile |

---

## 15. Trash Page Variants (2)

| # | Variant | URL | Description |
|---|---------|-----|-------------|
| 1 | All trash | `/frontend/html/trash.html` | All deleted chits |
| 2 | Email trash | `/frontend/html/trash.html?filter=email` | Only deleted emails |

---

## 16. Modals & Overlays (distinct visual states)

| # | Modal | Trigger | Description |
|---|-------|---------|-------------|
| 1 | Clock Modal | Hotkey (K) / header click | Active clocks (24h, 12h, analog, HST) |
| 2 | Weather Modal | Shift+W | Weather for saved locations |
| 3 | Quick-Edit Modal | Shift+click on chit | Inline edit title/status/dates/tags |
| 4 | Alert Modal | Alarm fires | Full-screen alarm with snooze options |
| 5 | Timer Done Modal | Timer expires | Full-screen timer completion |
| 6 | Delete Confirm | Delete action | cwocConfirm dialog |
| 7 | Unsaved Changes | Navigate away with edits | Save/Discard/Cancel modal |
| 8 | Prompt Modal | Various | Text input modal |
| 9 | QR Code Modal | Contact share button | QR code display |
| 10 | Omni Layout Modal | Settings → Omni View | Drag-to-arrange Omni sections |
| 11 | Arrange Views Modal | Settings → Views | Reorder/hide dashboard tabs |
| 12 | Import Mode Modal | Settings → Data import | Choose import mode |
| 13 | Calendar Export Help | Settings → Calendar Export | Google/Apple/Outlook instructions (3 sub-tabs) |
| 14 | Replace Confirm | Settings → Data replace | Confirm destructive replace |
| 15 | Email Accounts Modal | Settings → Email | Manage email accounts |
| 16 | Signature Modal | Settings → Email | Edit email signature |
| 17 | Badge Custom Detector | Settings → Email badges | Add custom badge detector |
| 18 | Context Menu | Right-click on chit | Pin/archive/snooze/delete actions |
| 19 | Project Quick Menu | Shift+click project header | Create child, quick edit, pin, archive, snooze, delete |
| 20 | Recurring Drag Modal | Drag recurring event | This instance / All / All following / Cancel |
| 21 | Tag Create/Edit Modal | Tag creation/editing | Create tag with color/parent |
| 22 | Hotkey Reference Overlay | ? key | Keyboard shortcuts panel |
| 23 | Search Overlay | Ctrl+K / search icon | Global search (also a tab) |
| 24 | Calculator Popover | F4 key | Floating draggable calculator |
| 25 | Email Expand Modal | Expand button in editor email zone | Full-screen email compose/read |
| 26 | Attachment Preview Modal | Click attachment in Attachments page | Full preview with details |
| 27 | Image View Modal | Click contact/profile image | Full-size image display |
| 28 | Camera Capture Modal | Camera button in contact editor | Live camera capture for profile photo |
| 29 | Bundle Edit Modal | Edit bundle in email settings | Configure email bundle |
| 30 | Release Notes Modal | Settings → Version | Show release notes with day navigation |
| 31 | Account Error Details | Click error pill in email | Error details with copy/settings buttons |

---

## 17. Help Topics (41 pages)

Each loads within the help page viewer at `/frontend/html/help.html#slug`:

| # | Topic | Slug |
|---|-------|------|
| 1 | What is CWOC | what-is-cwoc |
| 2 | Chits | chits |
| 3 | Calendar | calendar |
| 4 | Views | views |
| 5 | Editor | editor |
| 6 | Notes | notes |
| 7 | Habits | habits |
| 8 | Indicators | indicators |
| 9 | Custom Objects | custom-objects |
| 10 | Tags | tags |
| 11 | Filters | filters |
| 12 | Global Search | global-search |
| 13 | Recurrence | recurrence |
| 14 | Contacts | contacts |
| 15 | Email | email |
| 16 | Maps | maps |
| 17 | Weather | weather |
| 18 | Clocks | clocks |
| 19 | Timezones | timezones |
| 20 | Hotkeys | hotkeys |
| 21 | Mouse | mouse |
| 22 | Quick Edit | quick-edit |
| 23 | Visual Indicators | visual-indicators |
| 24 | Saved Locations | saved-locations |
| 25 | Attachments | attachments |
| 26 | Sharing | sharing |
| 27 | Trash | trash |
| 28 | Audit Log | audit-log |
| 29 | Settings | settings |
| 30 | Data Management | data-management |
| 31 | Dependent Apps | dependent-apps |
| 32 | Home Assistant | home-assistant |
| 33 | Ntfy Notifications | ntfy-notifications |
| 34 | Install App | install-app |
| 35 | Kiosk | kiosk |
| 36 | Calculator | calculator |
| 37 | Cron Triggers | cron-triggers |
| 38 | Mobile Sync | mobile-sync |
| 39 | Version Management | version-management |
| 40 | Index | index |
| 41 | (Help index/TOC) | (root) |

---

## 18. Summary Counts

| Category | Count |
|----------|-------|
| HTML pages | 20 |
| Dashboard tabs | 10 + Omni |
| Calendar period views | 7 |
| Calendar sub-modes (month compress/scroll) | 2 |
| Tasks sub-modes | 3 |
| Alarms sub-modes | 4 |
| Projects sub-modes | 2 |
| Indicators sub-modes | 3 |
| Email folders | 6 |
| Omni configurable sections | 12 |
| Settings tabs | 5 |
| Settings sections/groups | ~25+ |
| Editor zones | 12 |
| Editor modes | 5 |
| Maps modes | 3 |
| People modes | 2 |
| Contact editor modes | 2 |
| Trash variants | 2 |
| Modals/overlays | 31 |
| Help topics | 41 |
| **Total distinct visual states** | **~170+** |
