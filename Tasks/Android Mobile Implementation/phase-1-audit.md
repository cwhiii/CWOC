# Phase 1 Audit: Read-Only App + Core Views (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Android files read:** LoginScreen.kt, LoginViewModel.kt, TasksScreen.kt, TasksViewModel.kt, NotesScreen.kt, NotesViewModel.kt, CalendarScreen.kt, CalendarViewModel.kt, MainActivity.kt, CwocNavGraph.kt, CCaptnTabRow.kt, SidebarContent.kt, FilterPanel.kt, SortPanel.kt, Screen.kt
**Web files read:** login.html, main-views.js (header)

---

## 1.1 Login

### Web
- Parchment background, Lora font
- Circular logo (80px, `/static/cwod_logo.png`)
- Title "C.W.'S OMNI CHITS" (uppercase, letter-spacing)
- Username field (autofocus)
- Password field
- "LOG IN" button (changes to "Logging in…" while loading)
- Error display (red border card)
- Instance name (italic, below form, from `/api/auth/login-message`)
- Welcome message (markdown rendered, separate card, from same endpoint)
- Error: 429 → "Too many login attempts…", 401 → "Invalid username or password", network → "Unable to reach the server…"

### Android
- Circular logo (80dp, `R.drawable.cwoc_logo`) ✅
- Title "C.W.'S OMNI CHITS" (uppercase, letter-spacing) ✅
- Server URL field (Android-specific, pre-populated) ✅
- Username field ✅
- Password field (Done triggers login) ✅
- "LOG IN" button (shows "Logging in…" while loading) ✅
- Error display (red text) ✅
- Instance name (italic, below form, fetched from `/api/auth/login-message`) ✅
- Welcome message (Card, plain text — NOT markdown rendered) 💀
- Error: RateLimited → "Too many login attempts…" ✅, InvalidCredentials → "Invalid username or password" ✅, NetworkError → "Cannot reach server…" ✅
- Version number at bottom ✅
- Initial sync (since=0) triggered on success ✅

### Gaps
1. **Welcome message not rendered as markdown** — web uses `marked.parse()`, Android shows raw text in a Card. If the message contains markdown formatting, it displays as plain text with `**` and `#` visible.

### Verdict: 💀 BROKEN (welcome message doesn't render markdown like web)

---

## 1.2 Core Views — Tasks

### Web
- Cards grouped by status with colored headers
- Each card shows: title, priority badge, due date, tags (colored chips), checklist progress, people chips, color indicator, pin/archive/snooze indicators, overdue border, weather indicator, map thumbnail, sharing indicator, RSVP controls
- Quick-edit modal on long-press
- Drag-to-reorder (manual sort)
- Inline status change dropdown
- Habits sub-view with streak/progress
- "Assigned to Me" sub-view

### Android
- Cards grouped by status (ToDo, In Progress, Blocked, Complete) with colored headers ✅
- Title ✅, priority badge ✅, due date ✅, pin indicator ✅
- Habit indicators (streak badge, progress bar, success rate) ✅
- Swipe-to-delete with undo toast ✅
- Long-press action menu (pin/archive/snooze/edit/delete) ✅
- FAB for new chit ✅
- Filter/sort integration ✅
- Sync state indicator ✅
- Tags colored chips on cards ❌ MISSING
- Checklist progress on cards ❌ MISSING
- People chips on cards ❌ MISSING
- Color indicator (card background/border from chit.color) ❌ MISSING
- Overdue border (red border on past-due tasks) ❌ MISSING
- Weather indicator on cards ❌ MISSING
- Map thumbnail on cards ❌ MISSING
- Sharing/stealth indicator on cards ❌ MISSING
- Quick-edit modal (web's inline edit without opening full editor) ❌ MISSING
- Drag-to-reorder (manual sort) ❌ MISSING
- Inline status change dropdown ❌ MISSING
- "Assigned to Me" sub-view ❌ MISSING
- Habits sub-view (separate tab/mode) ❌ MISSING

### Gaps
2. **No tag chips on task cards** — web shows colored tag chips on every card
3. **No checklist progress on task cards** — web shows "3/7" progress
4. **No people chips on task cards** — web shows assigned people
5. **No chit color on cards** — web applies chit.color as card background/border
6. **No overdue border** — web shows red border on past-due tasks
7. **No weather indicator** — web shows weather icon on cards with location+date
8. **No map thumbnail** — web shows small map preview on cards with location
9. **No sharing/stealth indicator** — web shows icons for shared/stealth chits
10. **No quick-edit modal** — web has inline edit without opening full editor
11. **No drag-to-reorder** — web supports manual sort via drag
12. **No inline status change** — web has dropdown on card to change status without opening editor
13. **No "Assigned to Me" sub-view** — web has a separate view for chits assigned to current user
14. **No Habits sub-view** — web has a dedicated habits mode within the Tasks tab

### Verdict: 💀 BROKEN (14 features missing from task cards vs web)

---

## 1.3 Core Views — Notes

### Web
- Masonry layout (multi-column, Pinterest-style)
- Cards show: title, markdown preview, tags, color, pin indicator, people, sharing indicator
- Drag-to-reorder
- Quick-edit modal on long-press

### Android
- Flat LazyColumn (single column) 💀
- Title ✅, markdown preview (first 300 chars) ✅, pin indicator ✅
- Swipe-to-delete with undo ✅
- Long-press action menu ✅
- FAB ✅, filter/sort ✅, sync indicator ✅
- Masonry layout ❌ MISSING
- Tags on cards ❌ MISSING
- Color on cards ❌ MISSING
- People on cards ❌ MISSING
- Sharing indicator ❌ MISSING
- Drag-to-reorder ❌ MISSING
- Quick-edit modal ❌ MISSING

### Gaps
15. **No masonry layout** — web uses multi-column Pinterest-style; Android is single-column list
16. **No tags on note cards** — web shows colored tag chips
17. **No color on note cards** — web applies chit.color
18. **No people on note cards** — web shows people chips
19. **No sharing indicator on note cards**
20. **No drag-to-reorder for notes**
21. **No quick-edit modal for notes**

### Verdict: 💀 BROKEN (7 features missing, wrong layout)

---

## 1.4 Core Views — Calendar

### Web
- 6 view modes: Day, Week, Month, Year, Itinerary, X-Day ✅ (all present as FilterChips)
- Day/Week: time grid with events positioned by time, multi-day spanning, drag-to-resize, drag-to-move, click-to-create
- Month: grid with day cells, event dots/chips, click day → day view
- Year: 12 mini-month grids with event dots
- Itinerary: chronological list of upcoming events
- X-Day: configurable multi-day view
- Event colors from chit.color
- All-day events at top
- Pinch-to-zoom (mobile web)
- Weather overlay on day headers

### Android
- 6 view modes (Day/Week/Month/Year/Itinerary/X-Day) ✅
- Date navigation (prev/next/today) ✅
- View mode persisted to SharedPreferences ✅
- X-Day count from settings ✅
- Day/Week: flat event list (NOT a time grid) 💀
- Month: MonthView composable exists (referenced) — needs verification
- Year: YearView composable exists (referenced) — needs verification
- Itinerary: ItineraryView composable exists (referenced) — needs verification
- X-Day: XDayView composable exists (referenced) — needs verification
- Event color dot on cards ✅
- Time text (all-day or start–end) ✅
- Time grid with positioned events ❌ MISSING
- Drag-to-resize events ❌ MISSING
- Drag-to-move events ❌ MISSING
- Click-to-create on empty time slot ❌ MISSING
- Multi-day event spanning ❌ MISSING
- Weather overlay on day headers ❌ MISSING
- Pinch-to-zoom ❌ MISSING
- Tap event opens editor ❌ (no onNavigateToEditor passed to CalendarScreen)

### Gaps
22. **Day/Week view is a flat list, not a time grid** — web shows events positioned vertically by time; Android shows a simple list
23. **No drag-to-resize events** — web allows dragging event edges to change duration
24. **No drag-to-move events** — web allows dragging events to different times/days
25. **No click-to-create on empty time slot** — web creates a new chit when clicking empty space
26. **No multi-day event spanning** — web shows events that span multiple days
27. **No weather overlay on calendar day headers**
28. **No pinch-to-zoom on calendar**
29. **Tap event doesn't open editor** — CalendarScreen doesn't receive `onNavigateToEditor` callback

### Gaps (need verification — composables referenced but may be stubs):
30. **Month/Year/Itinerary/X-Day views may be stubs** — CalendarScreen references MonthView, YearView, ItineraryView, XDayView but the CalendarScreen.kt file ends with `// --- Additional view composables (stubs for tasks 2.2–2.5) ---` suggesting they may be incomplete

### Verdict: 💀 BROKEN (calendar is a flat list instead of a time grid, no drag interactions, tap doesn't navigate)

---

## 1.5 Navigation & Visual Identity

### Web
- Sidebar with: logo, navigation links, filter controls, sort controls
- Tab bar: C CAPTN (Calendar, Checklists, Alarms, Projects, Tasks, Notes)
- Parchment theme (brown tones, Lora font, textured background)
- Profile menu (top-right)
- Hotkey overlay system

### Android
- ModalNavigationDrawer with sidebar ✅
- Sidebar: "New Chit" button, nav links (Omni View, Search, Settings, Contacts, Trash, Help, Weather, Map) ✅
- C CAPTN tab row (ScrollableTabRow with 6 tabs) ✅
- TopAppBar: hamburger menu, "CWOC {version}", notification bell with badge, search icon ✅
- Material 3 theme (not parchment) 💀
- No Lora font ❌
- No parchment background texture ❌
- No profile menu ❌
- Filter panel in sidebar ✅
- Sort panel in sidebar ✅
- Token revocation → navigate to login ✅
- SyncWorker enqueued on non-login routes ✅

### Gaps
31. **No parchment theme** — Android uses Material 3 default colors, not the 1940s parchment/magic aesthetic with brown tones
32. **No Lora font** — web uses self-hosted Lora variable font throughout; Android uses system default
33. **No parchment background texture** — web has `parchment.jpg` background
34. **No profile menu** — web has a profile button (top-right) with user avatar and switchable accounts

### Verdict: 💀 BROKEN (visual identity doesn't match web — wrong colors, wrong font, no texture)

---

## 1.6 Database Parity

Database parity was audited in the original Phase 1 audit and all 72 column gaps were fixed. The Room entities now match the server schema. This section is ✅ **Complete** (verified by the original remediation at v m20260517.0856).

### Verdict: ✅ Complete

---

## 1.7 Initial Sync

- Login triggers `syncEngine.performSync(since = 0)` ✅
- Processes chits, contacts, settings, tag_renames ✅
- Schedules alarms for synced chits ✅
- Updates high-water mark ✅
- SyncWorker enqueued for periodic background sync ✅

### Verdict: ✅ Complete

---

## Phase 1 Summary

| Section | Verdict |
|---|---|
| 1.1 Login | 💀 BROKEN (welcome message not markdown-rendered) |
| 1.2 Tasks View | 💀 BROKEN (14 card features missing) |
| 1.3 Notes View | 💀 BROKEN (7 features missing, wrong layout) |
| 1.4 Calendar View | 💀 BROKEN (flat list not time grid, no drag, no tap-to-edit) |
| 1.5 Visual Identity | 💀 BROKEN (wrong theme, wrong font, no texture) |
| 1.6 Database Parity | ✅ Complete |
| 1.7 Initial Sync | ✅ Complete |

---

## Complete Gap List (Phase 1)

1. Welcome message not rendered as markdown (shows raw text)
2. No tag chips on task cards
3. No checklist progress on task cards
4. No people chips on task cards
5. No chit color applied to task cards
6. No overdue border on past-due tasks
7. No weather indicator on task cards
8. No map thumbnail on task cards
9. No sharing/stealth indicator on task cards
10. No quick-edit modal (inline edit without full editor)
11. No drag-to-reorder (manual sort)
12. No inline status change dropdown on task cards
13. No "Assigned to Me" sub-view
14. No Habits sub-view (dedicated mode within Tasks tab)
15. No masonry layout for notes (single column instead of multi-column)
16. No tags on note cards
17. No color on note cards
18. No people on note cards
19. No sharing indicator on note cards
20. No drag-to-reorder for notes
21. No quick-edit modal for notes
22. Calendar Day/Week is a flat list, not a time grid
23. No drag-to-resize events on calendar
24. No drag-to-move events on calendar
25. No click-to-create on empty time slot
26. No multi-day event spanning on calendar
27. No weather overlay on calendar day headers
28. No pinch-to-zoom on calendar
29. Tap event on calendar doesn't open editor
30. Month/Year/Itinerary/X-Day views may be stubs (needs device verification)
31. No parchment theme (Material 3 defaults instead of brown/gold aesthetic)
32. No Lora font (system default instead)
33. No parchment background texture
34. No profile menu

**Total: 34 gaps (all 💀 BROKEN)**

The infrastructure (database, sync, auth) is solid. The gaps are ALL in the UI rendering layer — the data is there but it's not displayed the way the web displays it.
