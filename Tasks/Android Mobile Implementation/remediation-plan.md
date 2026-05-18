# Android Remediation Plan

**Source:** Phases 1–7 audits (v m20260517.1037)
**Total gaps:** 182 (phases 1-6) + 18 new from phase 7 = ~200 unique gaps (some overlap between phases)
**Principle:** The web version IS the spec. Every gap is a defect.

---

## All Gaps Organized by Functional Area

### A. Visual Identity & Theme (5 gaps)

| # | Gap | Source |
|---|---|---|
| A1 | No parchment theme (Material 3 defaults instead of brown/gold aesthetic) | P1 |
| A2 | No Lora font (system default instead) | P1 |
| A3 | No parchment background texture | P1 |
| A4 | Login welcome message not rendered as markdown | P1 |
| A5 | No profile menu (avatar, switch user, logout) | P1, P5 |

### B. Card Rendering (all list views) (14 gaps)

| # | Gap | Source |
|---|---|---|
| B1 | No tag chips on cards (Tasks, Notes, Checklists) | P1 |
| B2 | No chit color applied to cards (background/border from chit.color) | P1, P4 |
| B3 | No checklist progress count on cards ("3/7 complete") | P1, P4 |
| B4 | No people chips on cards | P1 |
| B5 | No overdue border (red border on past-due tasks) | P1 |
| B6 | No weather indicator on cards | P1 |
| B7 | No map thumbnail on cards | P1, P7 |
| B8 | No sharing/stealth indicator on cards | P1 |
| B9 | No archive/snooze indicators on cards | P4 |
| B10 | No visual indicators system (_getAllIndicators) | P7 |
| B11 | No tab counts (number of items per tab) | P7 |
| B12 | No chit display options (fade past events, highlight overdue) | P7 |
| B13 | Pinned items don't sort to top | P6 |
| B14 | Snoozed items don't auto-hide/show based on time | P6 |

### C. Calendar (12 gaps)

| # | Gap | Source |
|---|---|---|
| C1 | Day/Week view is a flat list, not a time grid | P1 |
| C2 | No drag-to-resize events | P1 |
| C3 | No drag-to-move events | P1 |
| C4 | No click-to-create on empty time slot | P1 |
| C5 | No multi-day event spanning | P1, P7 |
| C6 | No weather overlay on calendar day headers | P1 |
| C7 | No pinch-to-zoom | P1, P7 |
| C8 | Tap event doesn't open editor (onNavigateToEditor not passed) | P1, P6 |
| C9 | Month view is a stub (not a real grid) | P6 |
| C10 | Year view is a stub (not 12 mini-month grids) | P6 |
| C11 | Itinerary/X-Day views are stubs | P6 |
| C12 | No today highlight, no week numbers | P6 |

### D. Notes View (7 gaps)

| # | Gap | Source |
|---|---|---|
| D1 | No masonry layout (single column instead of multi-column) | P1 |
| D2 | No drag-to-reorder for notes | P1 |
| D3 | No quick-edit modal for notes | P1, P7 |
| D4 | No tags/color/people/sharing on note cards | P1 |
| D5 | No notebook view (combined Notes + Checklists) | P7 |
| D6 | Notes drag-reorder with column awareness | P7 |
| D7 | No inline note editing (expand/collapse preview) | P7 |

### E. Editor — Dates & Times Zone (6 gaps)

| # | Gap | Source |
|---|---|---|
| E1 | Due date "Complete" checkbox missing | P2 |
| E2 | Point in Time "Now" button missing | P2 |
| E3 | All Day toggle not in zone header (in body as Switch) | P2 |
| E4 | Repeat checkbox not in dates zone header (separate zone) | P2 |
| E5 | Timezone abbreviation labels on date fields | P7 |
| E6 | Timezone suggestion from geocoded location | P2 |

### F. Editor — Task Zone (4 gaps)

| # | Gap | Source |
|---|---|---|
| F1 | Assignee dropdown has EMPTY options (sharedUsers never loaded) | P2 |
| F2 | Auto-Complete Checklist not in zone header button | P2 |
| F3 | Habit toggle not in zone header button | P2 |
| F4 | No inline status change dropdown on list cards | P1 |

### G. Editor — Habits Zone (6 gaps)

| # | Gap | Source |
|---|---|---|
| G1 | Frequency and Reset Period write to same field (conflict) | P2 |
| G2 | Reset period missing interval value input | P2 |
| G3 | No completion chart (Canvas) | P2 |
| G4 | No success rate chart (Canvas) | P2 |
| G5 | No streak chart (Canvas) | P2 |
| G6 | No period history list | P2 |

### H. Editor — Location Zone (6 gaps)

| # | Gap | Source |
|---|---|---|
| H1 | No geocoding (text input only, no coordinate resolution) | P2, P4 |
| H2 | No map preview (embedded map) | P2 |
| H3 | No search/geocode button | P2 |
| H4 | No context button (view in maps page) | P2 |
| H5 | No weather display for location+date | P2 |
| H6 | Geocode cache (shared across app) | P7 |

### I. Editor — Tags Zone (3 gaps)

| # | Gap | Source |
|---|---|---|
| I1 | No recent tags row (settings.recentTags not loaded) | P2 |
| I2 | No expand/collapse all button | P2 |
| I3 | No tag edit/delete (only create) | P7 |

### J. Editor — Notes Zone (6 gaps)

| # | Gap | Source |
|---|---|---|
| J1 | Format toolbar appends to end instead of wrapping selection | P2 |
| J2 | No side-by-side live preview (toggle only) | P2 |
| J3 | No download button (.md file) | P2 |
| J4 | No to-checklist action (move lines to checklist) | P2 |
| J5 | No [[ ]] chit link autocomplete | P2, P7 |
| J6 | No Enter key list continuation (auto-continue bullets/numbers) | P2, P7 |

### K. Editor — Checklist Zone (3 gaps)

| # | Gap | Source |
|---|---|---|
| K1 | No drag-drop reorder (move up/down buttons only) | P2 |
| K2 | No cross-chit checklist move | P7 |
| K3 | No send-item to another chit | P7 |

### L. Editor — Alerts Zone (7 gaps)

| # | Gap | Source |
|---|---|---|
| L1 | Wrong type names (alarm/timer/reminder vs notification/alarm/timer/stopwatch) | P2, P3 |
| L2 | No stopwatch type | P2, P3, P4 |
| L3 | No days-of-week selection for alarms | P2 |
| L4 | No duration input for timers | P2 |
| L5 | No loop toggle for timers | P2 |
| L6 | No default notifications auto-populate from settings | P2, P7 |
| L7 | No in-app alarm sound playback | P3 |

### M. Editor — People Zone (5 gaps)

| # | Gap | Source |
|---|---|---|
| M1 | No contact tree (flat autocomplete only) | P2 |
| M2 | No system user role toggles (Viewer/Manager) | P2 |
| M3 | No contact images/colors on chips | P2 |
| M4 | Assignee dropdown not synced with People zone | P2 |
| M5 | No people expand modal (full-screen picker) | P2, P7 |

### N. Editor — Projects Zone (5 gaps)

| # | Gap | Source |
|---|---|---|
| N1 | No chit picker (raw ID input only) | P2 |
| N2 | No "Create new child" button | P2 |
| N3 | No "Move to Project" dropdown | P2 |
| N4 | No Kanban board display in editor | P2 |
| N5 | No child chit cards (only truncated IDs) | P2 |

### O. Editor — Other Zones (10 gaps)

| # | Gap | Source |
|---|---|---|
| O1 | Health Indicators: raw JSON instead of structured UI | P2 |
| O2 | Email: no autocomplete on From/To | P2 |
| O3 | Email: no format toolbar on body | P2 |
| O4 | Email: no PGP encrypt | P2 |
| O5 | Email: no Send/Send Later/Reply/Forward | P2 |
| O6 | Attachments: placeholder only (no file list/upload/download/delete) | P2, P3 |
| O7 | Series Log: placeholder text, no actual data | P2 |
| O8 | Options menu: no QR code action | P2 |
| O9 | No instance banner for recurrence editing | P2 |
| O10 | No auto-save system | P7 |

### P. Editor — Header/Structure (2 gaps)

| # | Gap | Source |
|---|---|---|
| P1 | Nest thread label not clickable | P2 |
| P2 | Pin toggle not in title row (in TopAppBar instead) | P2 |

### Q. Projects/Kanban View (7 gaps)

| # | Gap | Source |
|---|---|---|
| Q1 | No drag-drop between Kanban columns | P4 |
| Q2 | Child cards don't show due date | P4 |
| Q3 | Child cards don't have status dropdown | P4 |
| Q4 | Child cards don't have open/move/remove/delete buttons | P4 |
| Q5 | No "Add existing chit" button | P4 |
| Q6 | No "Create new child" button | P4 |
| Q7 | No project progress bar | P4 |

### R. Alerts View (8 gaps)

| # | Gap | Source |
|---|---|---|
| R1 | No inline snooze button (only via long-press menu) | P4 |
| R2 | No inline dismiss button | P4 |
| R3 | No independent alerts board | P4 |
| R4 | No stopwatch display | P4 |
| R5 | No timer countdown display | P3, P4 |
| R6 | Filter is a no-op (all alerts pass through) | P4 |
| R7 | No "List" vs "Independent" mode toggle | P4 |
| R8 | No notification action buttons (snooze/dismiss from shade) | P3 |

### S. Indicators View (3 gaps)

| # | Gap | Source |
|---|---|---|
| S1 | All charts same color (should differ per type) | P4 |
| S2 | No "add new reading" button | P4 |
| S3 | No chart legend | P4 |

### T. Maps (3 gaps)

| # | Gap | Source |
|---|---|---|
| T1 | Saved locations not shown as markers | P4 |
| T2 | No settings integration (default lat/lon/zoom) | P4 |
| T3 | Text addresses not geocoded (most chits invisible) | P4 |

### U. Search (3 gaps)

| # | Gap | Source |
|---|---|---|
| U1 | Not inline in sidebar (dedicated screen) | P5 |
| U2 | Doesn't search location field | P5 |
| U3 | Doesn't search checklist items | P5 |

### V. Filters & Sort (6 gaps)

| # | Gap | Source |
|---|---|---|
| V1 | Missing "Rejected" status option | P5 |
| V2 | Missing "Show Declined" toggle | P5 |
| V3 | No color filter | P5 |
| V4 | No date range filter | P5 |
| V5 | No active filter count badge | P5 |
| V6 | Manual sort: drag-to-reorder not implemented | P5 |

### W. Settings Page (4 gaps — representing ~94 missing fields)

| # | Gap | Source |
|---|---|---|
| W1 | ~94 fields missing (6 of ~100+ implemented) | P5 |
| W2 | Entire Email tab missing | P5 |
| W3 | Entire Badges tab missing | P5 |
| W4 | Views + Admin tabs have zero functional fields | P5 |

### X. Contact Editor (12 gaps)

| # | Gap | Source |
|---|---|---|
| X1 | Display name not shown/editable | P6 |
| X2 | Phones/emails/addresses lack type labels (Home/Work/Mobile) | P6 |
| X3 | Call signs field missing | P6 |
| X4 | X handles field missing | P6 |
| X5 | Websites field missing | P6 |
| X6 | Has Signal toggle missing | P6 |
| X7 | Signal username field missing | P6 |
| X8 | PGP key field missing | P6 |
| X9 | Image upload (profile photo) missing | P6 |
| X10 | Tags use comma input, not tree picker | P6 |
| X11 | Shared to vault toggle missing | P6 |
| X12 | QR code / vCard export missing | P6 |

### Y. Conflict & Edge Cases (4 gaps)

| # | Gap | Source |
|---|---|---|
| Y1 | Conflict banner "View in audit log" not clickable | P3 |
| Y2 | Contact conflict banner not shown in ContactEditorScreen | P3 |
| Y3 | Lost edit log has no UI (user never informed) | P3 |
| Y4 | Attachment download progress not shown (StateFlow exists, no UI) | P3 |

### Z. Entire Pages/Features Missing (8 gaps)

| # | Gap | Source |
|---|---|---|
| Z1 | Audit Log page | P5, P7 |
| Z2 | Custom Objects editor page | P7 |
| Z3 | Rules Manager page | P7 |
| Z4 | User Admin page | P7 |
| Z5 | Habits dedicated view (within Tasks tab) | P1, P7 |
| Z6 | Assigned-to-Me view (within Tasks tab) | P1, P7 |
| Z7 | Email dashboard tab (inbox/threads/bundles) — see Section CC for full breakdown | P7 |
| Z8 | Notebook view (combined Notes+Checklists) | P7 |

### AA. Widgets (1 gap)

| # | Gap | Source |
|---|---|---|
| AA1 | All 3 widgets non-functional on device | P4 |

### BB. Miscellaneous (5 gaps)

| # | Gap | Source |
|---|---|---|
| BB1 | No unit conversion system (°C/°F, km/h/mph) | P7 |
| BB2 | No chit picker modal (reusable component) | P7 |
| BB3 | No prompt modal (text input modal) | P7 |
| BB4 | No clock modal (multi-timezone display) | P7 |
| BB5 | Sidebar: no logo, no Audit Log link, no Custom Objects link | P5 |

### CC. Email Client (entire feature — 15+ gaps)

The web has a full email client built into the dashboard as a tab. This is NOT just the editor email zone (O2–O5). This is an entire inbox/compose/thread system.

| # | Gap | Source |
|---|---|---|
| CC1 | Email dashboard tab (inbox list view with cards) | P7 |
| CC2 | Email thread view (grouped by conversation) | P7 |
| CC3 | Email compose (new draft creation from dashboard) | P7 |
| CC4 | Email read/unread toggle | P7 |
| CC5 | Email quick-archive with undo | P7 |
| CC6 | Email quick-delete with undo | P7 |
| CC7 | Email sub-filters (inbox/by-tag/drafts/trash) | P7 |
| CC8 | Email bundles (tabs, toolbar, drag-reorder, create/edit/delete) | P7 |
| CC9 | Email "Check Mail" button (trigger IMAP sync) | P7 |
| CC10 | Email unread count badge on tab | P7 |
| CC11 | Email bulk actions (select all, bulk read/unread) | P7 |
| CC12 | Email tracking detection (UPS/USPS/FedEx/flight numbers) | P7 |
| CC13 | Email nested chits in threads (non-email chits nested into threads) | P7 |
| CC14 | Email contact image lookup on cards | P7 |
| CC15 | Email shift+click range selection | P7 |
| CC16 | Email settings tab (accounts, IMAP/SMTP config, privacy settings) | P5 |

---

## Remediation Sweeps

### Sweep 1: Foundation (Theme + Card Rendering)

**Goal:** Make the app LOOK like CWOC. Every screen should feel like the web version at a glance.

**Items:** A1–A5, B1–B14

**What this delivers:**
- Parchment theme with Lora font and brown tones across all screens
- Cards that show the full data: tags, color, progress, people, indicators, overdue borders
- Profile menu with logout
- Login welcome message rendered as markdown
- Tab counts, display options (fade past, highlight overdue)
- Pinned sort-to-top, snoozed auto-hide

**Estimated scope:** Medium-large. Theme is a one-time change that propagates. Card rendering requires a shared `ChitCard` composable used by all list views.

---

### Sweep 2: Calendar (Time Grid + Interactions)

**Goal:** Calendar that works like the web — time grid, drag, multi-day, all view modes.

**Items:** C1–C12

**What this delivers:**
- Day/Week as a proper time grid with events positioned by time
- Drag-to-move and drag-to-resize events
- Click empty slot to create
- Multi-day event spanning
- Month grid with day cells and event dots
- Year view with 12 mini-months
- Itinerary and X-Day views fully implemented
- Tap event opens editor
- Pinch-to-zoom, weather overlay, today highlight, week numbers

**Estimated scope:** Large. The time grid is the most complex UI component in the app.

---

### Sweep 3: Editor Zones (Full Parity)

**Goal:** Every editor zone matches the web exactly — all buttons, all interactions, all data sources.

**Items:** E1–E6, F1–F4, G1–G6, H1–H6, I1–I3, J1–J6, K1–K3, L1–L7, M1–M5, N1–N5, O1–O10, P1–P2

**What this delivers:**
- Dates zone: Due Complete checkbox, Now button, header buttons
- Task zone: Assignee populated from API, header buttons
- Habits: separate frequency/reset, charts, history
- Location: geocoding, map preview, weather
- Tags: recent row, expand/collapse, edit/delete
- Notes: selection-aware toolbar, live preview, download, [[ ]], list continuation
- Checklist: drag-drop, cross-chit move, send-item
- Alerts: correct 4 types, days-of-week, duration, loop, defaults
- People: contact tree, role toggles, images, expand modal, synced assignee
- Projects: chit picker, create child, Kanban in editor
- Health: structured UI from custom objects
- Email: autocomplete, toolbar, PGP, send actions
- Attachments: file list, upload, download, delete
- Series Log: actual data
- Auto-save, instance banner, QR

**Estimated scope:** Very large. This is the bulk of the work — 63 gaps in the editor alone.

---

### Sweep 4: List Views (Checklists, Projects, Alerts, Indicators)

**Goal:** All C CAPTN views match web behavior — drag-drop, inline actions, mode toggles.

**Items:** Q1–Q7, R1–R8, S1–S3, D1–D7

**What this delivers:**
- Projects: drag-drop Kanban, child card actions, add/create buttons, progress bar
- Alerts: inline snooze/dismiss, independent board, stopwatch, timer countdown, mode toggle, working filter
- Indicators: per-type colors, add button, legend, calendar/log modes
- Notes: masonry layout, drag-reorder, quick-edit

**Estimated scope:** Large. Drag-drop is the recurring challenge.

---

### Sweep 5: Settings + Contact Editor + Missing Pages

**Goal:** Settings page with all ~100 fields. Contact editor with all 25+ fields. Missing pages built.

**Items:** W1–W4, X1–X12, Z1–Z6, Z8, BB5

**What this delivers:**
- Settings: all tabs populated (General, Email, Views, Admin, Badges)
- Contact editor: all fields with type labels, Signal, PGP, image, vCard, tree picker
- New pages: Audit Log, Custom Objects, Rules Manager, User Admin
- New views: Habits, Assigned-to-Me, Notebook

**Estimated scope:** Very large. Settings alone is ~94 fields. Four entire new pages.

---

### Sweep 6: Email Client

**Goal:** Full email client matching the web — inbox, threads, compose, bundles, sync.

**Items:** CC1–CC16, O2–O5

**What this delivers:**
- Email dashboard tab with inbox list view
- Thread grouping and conversation view
- Compose new email from dashboard
- Read/unread toggle, quick-archive, quick-delete with undo
- Sub-filters (inbox/by-tag/drafts/trash)
- Bundles (tabs, create/edit/delete, drag-reorder)
- "Check Mail" button triggering IMAP sync
- Unread badge on tab
- Bulk actions (select all, bulk read/unread)
- Tracking detection (shipping/flight numbers)
- Nested chits in threads
- Contact images on cards
- Editor email zone: autocomplete, format toolbar, PGP, Send/Reply/Forward
- Settings email tab (accounts, IMAP/SMTP, privacy)

**Estimated scope:** Very large. This is essentially building a mail client inside the app.

---

### Sweep 7: Search, Filters, Sort, Sidebar, Misc

**Goal:** Search/filter/sort match web. Sidebar complete. Remaining gaps closed.

**Items:** U1–U3, V1–V6, T1–T3, Y1–Y4, AA1, BB1–BB4

**What this delivers:**
- Search: inline in sidebar (or equivalent UX), searches all fields
- Filters: all options (Rejected, Declined, color, date range, badge)
- Sort: working drag-to-reorder (manual sort)
- Maps: geocoding, saved locations, settings
- Conflict/edge case UI: clickable audit log link, contact banner, lost edit notification
- Widgets: actually functional
- Unit conversion, chit picker modal, prompt modal, clock modal
- Sidebar: logo, all links

**Estimated scope:** Medium. Many small items.

---

## Priority Order

1. **Sweep 1** (Foundation) — Do this first. Everything else looks wrong without the theme and card data.
2. **Sweep 3** (Editor Zones) — The editor is the core interaction. Users can't create/edit chits properly without this.
3. **Sweep 2** (Calendar) — The calendar is the most-used view. Time grid is essential.
4. **Sweep 4** (List Views) — Makes the other C CAPTN tabs functional.
5. **Sweep 6** (Email Client) — Full email client. Large standalone feature.
6. **Sweep 5** (Settings + Pages) — Fills in the configuration and management layer.
7. **Sweep 7** (Polish) — Closes remaining gaps.

---

## Totals

| Sweep | Gap Count | Estimated Effort |
|---|---|---|
| 1: Foundation | 19 | Medium-Large |
| 2: Calendar | 12 | Large |
| 3: Editor Zones | 63 | Very Large |
| 4: List Views | 25 | Large |
| 5: Settings + Pages | 28 | Very Large |
| 6: Email Client | 20 | Very Large |
| 7: Search/Filters/Misc | 17 | Medium |
| **TOTAL** | **184** | — |

(Some gaps appear in multiple phases but are counted once here by functional area.)
