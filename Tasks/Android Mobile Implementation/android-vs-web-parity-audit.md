# Android vs. Mobile Web — Visual State Parity Audit

Comparison of every navigable visual state in the web app against what exists (and is accessible the same way) in the Android app.

Legend:
- ✅ = Exists and accessible the same way
- ⚠️ = Exists but partially implemented or different access pattern
- ❌ = Missing entirely

---

## 1. Top-Level Pages

| # | Web Page | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Dashboard (tabs) | ✅ | C CAPTN tab row |
| 2 | Chit Editor | ✅ | Full editor with zones |
| 3 | Settings | ✅ | 5 tabs (General, Views, Email, Badges, Admin) |
| 4 | People (Rolodex) | ✅ | Contact list screen |
| 5 | Contact Editor | ✅ | Full contact editor |
| 6 | Weather | ✅ | Accessible from sidebar |
| 7 | Trash | ✅ | Accessible from sidebar |
| 8 | Contact Trash | ❌ | No separate contact trash screen |
| 9 | Audit Log | ⚠️ | Route defined, sidebar link exists, but NO screen implementation (crashes/blank) |
| 10 | Help | ✅ | Accessible from sidebar |
| 11 | Maps | ⚠️ | Exists but NO Chits/Both/People mode toggle — only shows chit markers |
| 12 | Kiosk | ❌ | No kiosk mode |
| 13 | Login | ✅ | Login screen |
| 14 | Notifications | ✅ | Accessible from top bar bell icon |
| 15 | Admin Chits | ❌ | No admin chit manager screen |
| 16 | User Admin | ❌ | Route defined but NO screen, NO nav link |
| 17 | Rules Manager | ❌ | Route defined but NO screen, NO nav link |
| 18 | Rule Editor | ❌ | Route defined but NO screen, NO nav link |
| 19 | Custom Objects Editor | ⚠️ | Route defined, sidebar link exists, but NO screen implementation |
| 20 | Attachments (browser) | ❌ | No standalone attachments browser page |

---

## 2. Dashboard Tabs

| # | Web Tab | Android Status | Notes |
|---|---------|---------------|-------|
| 1 | Calendar | ✅ | C CAPTN tab |
| 2 | Checklists | ✅ | C CAPTN tab |
| 3 | Tasks | ✅ | C CAPTN tab |
| 4 | Projects | ✅ | C CAPTN tab |
| 5 | Notes | ✅ | C CAPTN tab |
| 6 | Notebook | ⚠️ | Exists as a mode toggle WITHIN the Notes tab (not a separate tab) — functionally equivalent |
| 7 | Email | ❌ | Route defined but NO screen, NO tab, NO nav link |
| 8 | Indicators | ⚠️ | Screen exists but NOT in C CAPTN tab row — only accessible if you know the route (no nav link in sidebar either!) |
| 9 | Alarms (Alerts) | ✅ | C CAPTN tab |
| 10 | Search | ✅ | Accessible from top bar search icon + sidebar |
| 11 | Omni View | ✅ | Accessible from sidebar |

---

## 3. Calendar Views

| # | Web View | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Week | ✅ | WeekTimeGrid |
| 2 | Day | ✅ | DayTimeGrid |
| 3 | SevenDay (X-Day) | ✅ | CalendarXDayView |
| 4 | Work | ✅ | WORK_HOURS mode |
| 5 | Month | ✅ | CalendarMonthView |
| 6 | Itinerary | ✅ | CalendarItineraryView |
| 7 | Year | ✅ | CalendarYearView |
| 8 | Month compress/scroll toggle | ❌ | No compress/scroll sub-mode on month view |

---

## 4. Tasks Tab Sub-Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Tasks (status groups) | ✅ | Default view with status grouping |
| 2 | Habits | ❌ | No habits sub-mode toggle on Tasks tab (habit data shows on cards but no dedicated view) |
| 3 | Assigned-to-Me | ❌ | No assigned-to-me sub-mode toggle |

---

## 5. Alarms Tab Sub-Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Independent | ⚠️ | Toggle exists ("List" / "Independent") but only 2 modes vs web's 4 |
| 2 | List | ✅ | Default mode |
| 3 | Notifications | ❌ | No notifications sub-mode |
| 4 | Reminders | ❌ | No reminders sub-mode |

---

## 6. Projects Tab Sub-Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Kanban | ✅ | Default and only mode |
| 2 | List (tree view) | ❌ | No list/tree view toggle |

---

## 7. Indicators Sub-Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Charts | ✅ | Default view with time range selector |
| 2 | Calendar (year grid) | ❌ | No calendar sub-mode |
| 3 | Log (reverse-chronological) | ❌ | No log sub-mode |

---

## 8. Email Tab (entire feature)

| # | Web Feature | Android Status | Notes |
|---|-------------|---------------|-------|
| 1 | Email tab | ❌ | No email tab in C CAPTN row |
| 2 | Inbox folder | ❌ | — |
| 3 | Sent folder | ❌ | — |
| 4 | Drafts folder | ❌ | — |
| 5 | Scheduled folder | ❌ | — |
| 6 | Trash folder | ❌ | — |
| 7 | Archived folder | ❌ | — |
| 8 | Bundle tabs | ❌ | — |
| 9 | Thread expansion | ❌ | — |
| 10 | Compose/Reply/Forward | ❌ | — |

---

## 9. Omni View Sections

| # | Web Section | Android Status | Notes |
|---|-------------|---------------|-------|
| 1 | HST Bar | ❌ | Not implemented |
| 2 | Weather | ❌ | Not implemented |
| 3 | HST + Weather | ❌ | Not implemented |
| 4 | HST Weather Strip | ❌ | Not implemented |
| 5 | Chrono Anchored | ✅ | Implemented |
| 6 | Reminders | ✅ | Implemented |
| 7 | On Deck | ✅ | Implemented |
| 8 | Soon | ✅ | Implemented |
| 9 | Email | ❌ | Not implemented (no email feature) |
| 10 | Pinned Notes | ✅ | Implemented |
| 11 | Pinned Checklists | ✅ | Implemented |
| 12 | Pinned All | ❌ | Not implemented |

---

## 10. Settings Tabs & Sections

| # | Web Tab/Section | Android Status | Notes |
|---|----------------|---------------|-------|
| 1 | General tab | ✅ | GeneralSettingsTab |
| 2 | Views tab | ✅ | ViewsSettingsTab |
| 3 | Collections tab | ❌ | No Collections tab (Tag Editor, Custom Colors, Saved Locations, Default Notifications) |
| 4 | Email tab | ⚠️ | Tab exists but is a PLACEHOLDER (just text listing what will go there) |
| 5 | Admin tab | ✅ | AdminSettingsTab |
| 6 | Badges section | ⚠️ | Tab exists but is a PLACEHOLDER |

**Missing settings sections (not in any tab):**
- Tag Editor (create/edit/delete/reorder tags)
- Custom Colors editor
- Saved Locations editor
- Default Notifications editor
- Calendar Export (Google/Apple/Outlook)
- Data Management (export/import/replace/purge)
- Dependent Apps (Tailscale, Ntfy, Home Assistant)
- Version & Updates (release notes modal, update button)
- Install as App / PWA section

---

## 11. Editor Zones

| # | Web Zone | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Header (title, status, priority) | ✅ | Top section of editor |
| 2 | Dates & Times | ✅ | DateZone |
| 3 | Tags | ✅ | TagsPickerSheet |
| 4 | People | ✅ | PeopleZone (inline in editor) |
| 5 | Location | ✅ | LocationZone (inline in editor) |
| 6 | Notes | ✅ | NotesZone (inline in editor) |
| 7 | Alerts | ✅ | AlertsZone |
| 8 | Color | ✅ | ColorZone |
| 9 | Health Indicators | ✅ | HealthIndicatorsZone |
| 10 | Checklist | ✅ | ChecklistZone |
| 11 | Projects | ✅ | ProjectsZone |
| 12 | Email | ⚠️ | "Make Email" option in overflow menu sets email_status=draft, but NO full email compose UI (To/CC/BCC/Subject/Body) |
| 13 | Attachments | ⚠️ | Zone exists but read-only ("Upload from web editor") — no upload capability |
| 14 | Recurrence | ✅ | RecurrenceZone |
| 15 | Habits | ✅ | HabitsZone |

---

## 12. Editor Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | New chit (blank) | ✅ | Via "New Chit" button |
| 2 | New chit pre-filled (from calendar) | ❌ | No pre-fill from calendar tap |
| 3 | New email draft | ⚠️ | Can set email_status=draft but no email compose UI |
| 4 | Edit existing chit | ✅ | Tap any chit card |
| 5 | Edit existing email | ❌ | No email viewing/editing |
| 6 | Email Expand Modal | ❌ | No full-screen email compose/read overlay |

---

## 13. Maps Page Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Chits | ✅ | Default (only) mode |
| 2 | People | ❌ | No people markers on map |
| 3 | Both | ❌ | No combined mode |
| 4 | Sidebar filters | ❌ | No date/tag/status filters on map |

---

## 14. People Page Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Grouped (Favorites/Users/Contacts/Vault) | ❌ | Flat list only (with section index) |
| 2 | Ungrouped (flat alphabetical) | ✅ | This is the only mode |
| 3 | Import modal (vCard/CSV) | ❌ | No import capability |
| 4 | Export dropdown | ❌ | No export capability |

---

## 15. Contact Editor Modes

| # | Web Mode | Android Status | Notes |
|---|----------|---------------|-------|
| 1 | Contact mode | ✅ | Default mode |
| 2 | Profile mode (user profile) | ❌ | No profile mode — can't view/edit user profiles |

---

## 16. Trash Page Variants

| # | Web Variant | Android Status | Notes |
|---|-------------|---------------|-------|
| 1 | All trash | ✅ | TrashScreen |
| 2 | Email trash filter | ❌ | No email filter on trash |
| 3 | Contact Trash | ❌ | No separate contact trash page |

---

## 17. Modals & Overlays

| # | Web Modal | Android Status | Notes |
|---|-----------|---------------|-------|
| 1 | Clock Modal | ✅ | ClockModal component |
| 2 | Weather Modal | ❌ | No weather modal (separate Weather page instead) |
| 3 | Quick-Edit Modal | ✅ | QuickEditSheet (bottom sheet) |
| 4 | Alert Modal (alarm fires) | ❌ | Uses system notifications, no in-app full-screen alarm |
| 5 | Timer Done Modal | ❌ | No in-app timer completion overlay |
| 6 | Delete Confirm | ✅ | AlertDialog |
| 7 | Unsaved Changes | ✅ | AlertDialog via BackHandler |
| 8 | Prompt Modal | ✅ | CwocPromptDialog |
| 9 | QR Code Modal | ❌ | No QR code sharing for contacts |
| 10 | Omni Layout Modal | ❌ | No drag-to-arrange Omni sections |
| 11 | Arrange Views Modal | ❌ | No reorder/hide tabs modal |
| 12 | Import Mode Modal | ❌ | No data import |
| 13 | Calendar Export Help | ❌ | No calendar export |
| 14 | Replace Confirm | ❌ | No data replace |
| 15 | Email Accounts Modal | ❌ | No email accounts management |
| 16 | Signature Modal | ❌ | No email signature editor |
| 17 | Badge Custom Detector | ❌ | No badge detector editor |
| 18 | Context Menu (right-click) | ✅ | ChitActionMenu (long-press) |
| 19 | Project Quick Menu | ❌ | No project-specific quick menu |
| 20 | Recurring Drag Modal | ❌ | No recurring event drag disambiguation |
| 21 | Tag Create/Edit Modal | ❌ | No tag creation/editing UI |
| 22 | Hotkey Reference Overlay | N/A | Not applicable on mobile |
| 23 | Search Overlay | ✅ | SearchScreen |
| 24 | Calculator Popover | ❌ | No calculator |
| 25 | Email Expand Modal | ❌ | No email compose/read overlay |
| 26 | Attachment Preview Modal | ❌ | No attachment preview |
| 27 | Image View Modal | ❌ | No full-size image viewer for contacts |
| 28 | Camera Capture Modal | ❌ | No camera capture for contact photos |
| 29 | Bundle Edit Modal | ❌ | No email bundle editor |
| 30 | Release Notes Modal | ❌ | No release notes viewer |
| 31 | Account Error Details | ❌ | No email account error details |
| 32 | Snooze Picker | ✅ | SnoozePickerDialog |
| 33 | Conflict Banner | ✅ | ConflictBanner component |

---

## 18. Help Topics

| Web (41 topics) | Android Status | Notes |
|-----------------|---------------|-------|
| All 41 help topics | ⚠️ | HelpScreen exists but need to verify it loads all topics from the API |

---

## Summary: Critical Gaps

### Entire Features Missing (❌)
1. **Email client** — No email tab, no folders, no compose, no thread view, no bundles
2. **Audit Log screen** — Route exists but no implementation
3. **Custom Objects Editor screen** — Route exists but no implementation
4. **User Admin screen** — Route exists but no implementation
5. **Rules Manager/Editor** — Routes exist but no implementation
6. **Admin Chits screen** — Not even a route
7. **Contact Trash** — No separate page
8. **Attachments browser** — No standalone page
9. **Kiosk mode** — Not applicable? (but exists on web)
10. **Calculator** — No calculator popover

### Sub-Modes/Views Missing Within Existing Screens (❌)
1. **Tasks → Habits view** — No dedicated habits sub-mode toggle
2. **Tasks → Assigned-to-Me view** — No assigned sub-mode
3. **Alarms → Notifications sub-mode** — Only list/independent, missing notifications/reminders
4. **Alarms → Reminders sub-mode** — Missing
5. **Projects → List/tree view** — Only kanban
6. **Indicators → Calendar view** — Only charts
7. **Indicators → Log view** — Only charts
8. **Month → Compress/Scroll toggle** — Missing
9. **Maps → People mode** — Only chit markers
10. **Maps → Both mode** — Missing
11. **People → Grouped mode** — Only flat list
12. **Contact Editor → Profile mode** — Can't view user profiles

### Partially Implemented (⚠️)
1. **Settings Email tab** — Placeholder only
2. **Settings Badges tab** — Placeholder only
3. **Settings Collections tab** — Entirely missing (tags, colors, locations, notifications)
4. **Indicators tab** — Not in C CAPTN row, no sidebar link (unreachable without direct route)
5. **Omni View** — Missing HST, Weather, Email, Pinned All sections
6. **Editor Attachments zone** — Read-only, no upload
7. **Editor Email** — Can mark as draft but no compose UI

### Navigation/Access Differences
1. **Indicators** — On web it's a tab in the tab row; on Android it's not in the tab row AND not in the sidebar (effectively hidden)
2. **Email** — On web it's a tab; on Android it doesn't exist at all
3. **Notebook** — On web it's a separate tab; on Android it's a mode within Notes (functionally OK)
4. **Omni View** — On web it's triggered by clicking "Omni" in the header; on Android it's in the sidebar (acceptable difference)

---

## Priority Ranking (by user impact)

### P0 — Broken/Unreachable
1. Indicators screen has no way to navigate to it (not in tabs, not in sidebar)
2. Audit Log sidebar link leads to crash/blank (no composable registered in NavGraph)
3. Custom Objects sidebar link leads to crash/blank (no composable registered in NavGraph)

### P1 — Major Feature Gaps
4. Email client (entire feature)
5. Tasks → Habits dedicated view
6. Tasks → Assigned-to-Me view
7. Settings → Collections tab (tag editor, colors, locations, notifications)
8. Settings → Email tab (real implementation)
9. Maps → People/Both modes
10. People → Grouped mode (Favorites/Users/Contacts/Vault sections)

### P2 — Missing Screens
11. Audit Log screen implementation
12. Custom Objects Editor screen implementation
13. User Admin screen
14. Rules Manager/Editor screens
15. Contact Trash screen
16. Attachments browser screen
17. Admin Chits screen

### P3 — Missing Sub-Modes & Features
18. Alarms → Notifications/Reminders sub-modes
19. Projects → List/tree view
20. Indicators → Calendar/Log sub-modes
21. Month → Compress/Scroll toggle
22. Contact Editor → Profile mode
23. Omni View → HST/Weather/Email/Pinned All sections
24. Calculator popover
25. QR code sharing for contacts
26. Camera capture for contact photos
27. Release notes viewer
28. Tag create/edit modal
29. Attachment upload in editor
30. Omni layout configuration modal
