# Phase 5 Audit: Core Usability (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC with Zone/Page/View Completeness Rule. "Partial" banned. Web = spec.
**Android files read:** SidebarContent.kt, FilterPanel.kt, SortPanel.kt, SearchScreen.kt, SearchViewModel.kt, TrashScreen.kt, TrashViewModel.kt, SettingsScreen.kt, GeneralSettingsTab.kt, ViewsSettingsTab.kt, AdminSettingsTab.kt, SettingsViewModel.kt
**Web files read:** settings.html, settings.js (field inventory from prior audit knowledge)

---

## 5.1 Sidebar/Menu

### Web
- Logo + app name
- "New Chit" button
- Navigation links (Settings, Contacts, Trash, Help, Weather, Map, Audit Log, Custom Objects)
- Filter controls (status, priority, tags with ANY/ALL, people, boolean toggles)
- Sort controls (field dropdown + direction toggle)
- Profile menu (user avatar, switch user, logout)
- Hotkey reference button
- Collapse/expand sidebar

### Android (SidebarContent.kt)
- "New Chit" button ✅
- Navigation links: Omni View, Search, Settings, Contacts, Trash, Help, Weather, Map ✅
- Filter/sort content slots (passed as composable params) ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| "New Chit" button | ✅ | ✅ | ✅ |
| Settings link | ✅ | ✅ | ✅ |
| Contacts link | ✅ | ✅ | ✅ |
| Trash link | ✅ | ✅ | ✅ |
| Help link | ✅ | ✅ | ✅ |
| Weather link | ✅ | ✅ | ✅ |
| Map link | ✅ | ✅ | ✅ |
| Audit Log link | ✅ | ❌ | ❌ |
| Custom Objects link | ✅ | ❌ | ❌ |
| Profile menu (avatar, switch user, logout) | ✅ | ❌ | ❌ |
| Hotkey reference | ✅ | ❌ (N/A on mobile — no keyboard) | ✅ (platform-appropriate) |
| Collapse/expand sidebar | ✅ | ✅ (drawer open/close) | ✅ |
| Logo + app name | ✅ | ❌ (no logo in drawer) | ❌ |

**Verdict: 💀 BROKEN** (missing Audit Log link, Custom Objects link, profile menu, logo)

---

## 5.2 Search

### Web
- Search field in sidebar (always visible)
- Searches: title, notes, tags, people, location, checklist items
- Results show highlighted matching terms
- Results show matched field indicator
- Keyboard shortcut (/) to focus search

### Android (SearchScreen.kt + SearchViewModel.kt)
- Dedicated search screen (not inline in sidebar)
- Auto-focused search field in TopAppBar ✅
- Results with highlighted matching terms ✅
- Matched fields indicator ✅
- Searches title, notes, tags, people ✅
- Tap result opens editor ✅
- Back button returns ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Search field | ✅ in sidebar (always visible) | Dedicated screen (tap search icon) | 💀 |
| Auto-focus on open | ✅ | ✅ FocusRequester | ✅ |
| Search title | ✅ | ✅ | ✅ |
| Search notes | ✅ | ✅ | ✅ |
| Search tags | ✅ | ✅ | ✅ |
| Search people | ✅ | ✅ | ✅ |
| Search location | ✅ | ❌ | ❌ |
| Search checklist items | ✅ | ❌ | ❌ |
| Highlighted matches | ✅ | ✅ buildHighlightedText | ✅ |
| Matched fields indicator | ✅ | ✅ | ✅ |
| Result shows status + tags | ✅ | ✅ | ✅ |
| Tap opens editor | ✅ | ✅ | ✅ |
| Empty state | ✅ | ✅ "No results" | ✅ |
| Keyboard shortcut (/) | ✅ | N/A (mobile) | ✅ |

**Verdict: 💀 BROKEN** (search not inline in sidebar like web, doesn't search location or checklist items)

---

## 5.3 Filters

### Web (sidebar filter panel)
- Status multi-select (ToDo, In Progress, Blocked, Complete, Rejected)
- Priority multi-select (Critical, High, Medium, Low)
- Tags with checkboxes + ANY/ALL match mode toggle
- People chip selection
- Boolean toggles: Show Archived, Show Pinned, Show Snoozed, Show Past Due, Show Declined
- Color filter
- Date range filter
- "Clear All Filters" button
- Active filter count badge on sidebar

### Android (FilterPanel.kt)
- Status multi-select (ToDo, In Progress, Blocked, Complete) ✅
- Priority multi-select (Critical, High, Medium, Low) ✅
- Tags with checkboxes + ANY/ALL toggle ✅
- People chip selection ✅
- Boolean toggles: Archived, Pinned, Snoozed, Past Due ✅
- "Clear All Filters" button ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Status: ToDo/InProgress/Blocked/Complete | ✅ | ✅ | ✅ |
| Status: Rejected | ✅ | ❌ not in filter options | ❌ |
| Priority: Critical/High/Medium/Low | ✅ | ✅ | ✅ |
| Tags with checkboxes | ✅ | ✅ | ✅ |
| Tags ANY/ALL toggle | ✅ | ✅ | ✅ |
| People chips | ✅ | ✅ | ✅ |
| Show Archived toggle | ✅ | ✅ | ✅ |
| Show Pinned toggle | ✅ | ✅ | ✅ |
| Show Snoozed toggle | ✅ | ✅ | ✅ |
| Show Past Due toggle | ✅ | ✅ | ✅ |
| Show Declined toggle | ✅ | ❌ | ❌ |
| Color filter | ✅ | ❌ | ❌ |
| Date range filter | ✅ | ❌ | ❌ |
| Clear All button | ✅ | ✅ | ✅ |
| Active filter count badge | ✅ | ❌ | ❌ |

**Verdict: 💀 BROKEN** (missing Rejected status, Declined toggle, color filter, date range filter, active filter badge)

---

## 5.4 Sort

### Web
- Sort field: Title, Due Date, Start Date, Created, Modified, Priority, Status, Manual (drag)
- Sort direction: ASC/DESC toggle
- Manual sort (drag-to-reorder, persisted per view)

### Android (SortPanel.kt)
- Sort field dropdown: Title, Due Date, Start Date, Created Date, Modified Date, Priority, Status, Manual ✅
- ASC/DESC toggle button ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Sort field dropdown | ✅ | ✅ all 8 fields | ✅ |
| ASC/DESC toggle | ✅ | ✅ IconButton | ✅ |
| Manual sort (drag-to-reorder) | ✅ persisted per view | ❌ option exists in dropdown but no drag gesture | ❌ |

**Verdict: 💀 BROKEN** (Manual sort option exists but drag-to-reorder is not implemented)

---

## 5.5 Settings Page

### Web (settings.html + settings.js)
The web settings page has **5 tabs** (General, Email, Views, Admin, Badges) with approximately **100+ fields** total.

### Android (SettingsScreen.kt)
The Android settings page has **3 tabs** (General, Views, Admin) with **6 fields** in General.

### Field Inventory — General Tab

| Web Field | Android | Status |
|---|---|---|
| Time format (12h/24h) | ✅ SegmentedButton | ✅ |
| Sex (Male/Female/Other) | ❌ | ❌ |
| Snooze length | ✅ dropdown | ✅ |
| Week start day | ✅ dropdown | ✅ |
| Calendar snap interval | ✅ dropdown | ✅ |
| Default timezone | ✅ searchable | ✅ |
| Unit system (imperial/metric) | ✅ SegmentedButton | ✅ |
| Alarm orientation | ❌ | ❌ |
| Active clocks (multi-timezone) | ❌ | ❌ |
| Habits success window | ❌ | ❌ |
| Default show habits on calendar | ❌ | ❌ |
| Session lifetime | ❌ | ❌ |
| Autosave desktop | ❌ | ❌ |
| Autosave mobile | ❌ | ❌ |
| Checklist autosave (global) | ❌ | ❌ |

### Field Inventory — Email Tab (ENTIRE TAB MISSING)

| Web Field | Android | Status |
|---|---|---|
| Email accounts (multi-account) | ❌ | ❌ |
| IMAP/SMTP server config | ❌ | ❌ |
| Email pagination | ❌ | ❌ |
| Block tracking pixels | ❌ | ❌ |
| External content | ❌ | ❌ |
| Read receipts | ❌ | ❌ |
| Undo send delay | ❌ | ❌ |
| Email group by | ❌ | ❌ |

### Field Inventory — Views Tab

| Web Field | Android | Status |
|---|---|---|
| Default view | ❌ | ❌ |
| View order (drag-reorder) | ❌ | ❌ |
| Custom days count (X-Day) | ❌ | ❌ |
| Work start/end hour | ❌ | ❌ |
| Work days | ❌ | ❌ |
| Day scroll-to hour | ❌ | ❌ |
| All-view start/end hour | ❌ | ❌ |
| Overdue border color | ❌ | ❌ |
| Blocked border color | ❌ | ❌ |
| Hide declined | ❌ | ❌ |
| Omni layout | ❌ | ❌ |
| Omni locked filters | ❌ | ❌ |
| Omni HST clock mode | ❌ | ❌ |
| Omni email count | ❌ | ❌ |
| Omni normalize colors | ❌ | ❌ |
| Show map thumbnails | ❌ | ❌ |
| Custom view filters | ❌ | ❌ |

### Field Inventory — Admin Tab

| Web Field | Android | Status |
|---|---|---|
| Saved locations (CRUD list) | ❌ | ❌ |
| Tags management (CRUD tree) | ❌ | ❌ |
| Custom colors (CRUD list) | ❌ | ❌ |
| Visual indicators (CRUD) | ❌ | ❌ |
| Default notifications | ❌ | ❌ |
| Shared tags | ❌ | ❌ |
| Kiosk users | ❌ | ❌ |
| Map settings (default lat/lon/zoom, auto-zoom) | ❌ | ❌ |
| Audit log settings (max days, max MB) | ❌ | ❌ |
| Attachment limits (max size, max storage) | ❌ | ❌ |
| Default share contacts | ❌ | ❌ |
| Smart actions config | ❌ | ❌ |
| Data management (export, import, purge) | ❌ | ❌ |
| Version info + update check | ❌ | ❌ |
| Bundles config | ❌ | ❌ |

### Field Inventory — Badges Tab (ENTIRE TAB MISSING)

| Web Field | Android | Status |
|---|---|---|
| Badge configuration | ❌ | ❌ |

**Android has 6 out of ~100+ settings fields. The entire Email tab and Badges tab are missing. Views and Admin tabs have zero fields implemented.**

**Verdict: 💀 BROKEN** (6/100+ fields implemented — 94% missing)

---

## 5.6 Trash

### Web
- List of soft-deleted chits
- Each shows: title, deletion date, type indicators
- Restore button per item
- Purge (permanent delete) button per item with confirmation
- "Empty Trash" button (purge all)
- Empty state

### Android (TrashScreen.kt + TrashViewModel.kt)
- List of soft-deleted chits ✅
- Title, deletion date, type indicator chips ✅
- Restore button per item ✅
- Purge button per item with confirmation dialog ✅
- Empty state ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| List of deleted chits | ✅ | ✅ LazyColumn | ✅ |
| Title display | ✅ | ✅ | ✅ |
| Deletion date | ✅ | ✅ | ✅ |
| Type indicators | ✅ | ✅ AssistChips | ✅ |
| Restore button | ✅ | ✅ OutlinedButton | ✅ |
| Purge button | ✅ | ✅ OutlinedButton | ✅ |
| Purge confirmation | ✅ | ✅ AlertDialog | ✅ |
| "Empty Trash" (purge all) | ✅ | ❌ | ❌ |
| Empty state | ✅ | ✅ | ✅ |

**Verdict: 💀 BROKEN** (missing "Empty Trash" / purge-all button)

---

## 5.7 Unsaved Changes

### Web
- Detects unsaved changes on page exit
- Shows Save/Discard/Cancel modal
- ESC key triggers exit check
- Browser beforeunload event

### Android
- BackHandler intercepts system back ✅
- isDirty computed from form vs saved state ✅
- AlertDialog with Save/Discard/Cancel ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Detect unsaved changes | ✅ | ✅ isDirty StateFlow | ✅ |
| Save/Discard/Cancel dialog | ✅ | ✅ AlertDialog | ✅ |
| Back button triggers check | ✅ | ✅ BackHandler | ✅ |
| ESC triggers check | ✅ | N/A (no ESC on mobile) | ✅ |

**Verdict: ✅ Complete**

---

## 5.8 Undo (Swipe-to-Delete)

### Web
- Delete shows undo toast with countdown
- Undo restores the chit
- Countdown expires → permanent (syncs deletion)

### Android
- UndoToast composable with countdown ✅
- Undo restores (chitDao.restoreDeleted) ✅
- Expire finalizes (markDirty + push) ✅
- Implemented on Tasks and Notes screens ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Undo toast with countdown | ✅ | ✅ UndoToast composable | ✅ |
| Undo restores chit | ✅ | ✅ restoreDeleted | ✅ |
| Countdown expires → sync | ✅ | ✅ finalizeDelete | ✅ |
| Available on all list views | ✅ | 💀 only Tasks + Notes, not Checklists/Projects/Alerts | 💀 |

**Verdict: 💀 BROKEN** (undo only on 2 of 6 list views)

---

## Phase 5 Summary

| Section | Verdict |
|---|---|
| 5.1 Sidebar/Menu | 💀 BROKEN |
| 5.2 Search | 💀 BROKEN |
| 5.3 Filters | 💀 BROKEN |
| 5.4 Sort | 💀 BROKEN |
| 5.5 Settings Page | 💀 BROKEN |
| 5.6 Trash | 💀 BROKEN |
| 5.7 Unsaved Changes | ✅ Complete |
| 5.8 Undo | 💀 BROKEN |

---

## Complete Gap List (Phase 5)

1. **Sidebar: no Audit Log link**
2. **Sidebar: no Custom Objects link**
3. **Sidebar: no profile menu** (avatar, switch user, logout)
4. **Sidebar: no logo in drawer**
5. **Search: not inline in sidebar** (dedicated screen instead of always-visible field)
6. **Search: doesn't search location field**
7. **Search: doesn't search checklist items**
8. **Filters: missing "Rejected" status option**
9. **Filters: missing "Show Declined" toggle**
10. **Filters: no color filter**
11. **Filters: no date range filter**
12. **Filters: no active filter count badge**
13. **Sort: Manual sort option exists but drag-to-reorder not implemented**
14. **Settings: ~94 fields missing** (6 of ~100+ implemented)
15. **Settings: entire Email tab missing**
16. **Settings: entire Badges tab missing**
17. **Settings: Views tab has zero fields**
18. **Settings: Admin tab has zero settings fields** (only debug info)
19. **Trash: no "Empty Trash" / purge-all button**
20. **Undo: only available on Tasks + Notes** (not Checklists, Projects, Alerts, Calendar)

**Total: 20 gaps (all 💀 BROKEN)**

The settings page alone accounts for the majority of missing functionality — the web has ~100 configurable fields and the Android app has 6.
