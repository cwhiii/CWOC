# B — Card Rendering (14 items: B1–B14)

## Status: COMPLETE — all 14 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/components/ChitCardEnhancements.kt` (NEW — all shared card components)
- `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TasksScreen.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/notes/NotesScreen.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/checklists/ChecklistsScreen.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarScreen.kt`
- `android/app/src/main/java/com/cwoc/app/ui/navigation/CCaptnTabRow.kt`

---

## B1 — Tag chips on cards ✅ COMPLETE (5/5 sub-items)

1. ✅ Task cards show colored tag pills — `TagChipsRow` applied
2. ✅ Note cards show tag chips — `TagChipsRow` applied
3. ✅ Checklist cards show tag chips — `TagChipsRow` applied
4. ✅ Tag color from configured settings — `tagColorMap` parameter accepts settings colors, falls back to hash-based
5. ✅ Font color contrast logic — luminance-based dark/light text selection on chip background

## B2 — Chit color applied to cards ✅ COMPLETE (5/5 sub-items)

1. ✅ Task cards — `chitColorBorder()` Modifier applied (3dp colored border)
2. ✅ Note cards — `chitColorBorder()` applied
3. ✅ Checklist cards — `chitColorBorder()` applied
4. ✅ Calendar event cards — color dot + background tint (8% alpha of event color)
5. ✅ Color-based card border on all list views

## B3 — Checklist progress count on cards ✅ COMPLETE (3/3 sub-items)

1. ✅ Task cards show "☑ X/Y" progress count — `ChecklistProgressBadge` applied
2. ✅ Mini progress bar (LinearProgressIndicator) on cards with checklist data
3. ✅ Checklist screen cards show progress count in header row

## B4 — People chips on cards ✅ COMPLETE (2/2 sub-items)

1. ✅ People name pills with initial-letter avatars — `PeopleChipsRow` applied to all card types
2. ✅ Small people chips with avatar circles (initial letter = mobile equivalent of contact image)

## B5 — Overdue border ✅ COMPLETE (2/2 sub-items)

1. ✅ Red 2dp border via `overdueBorder()` + red due date text + bold font weight
2. ✅ "⚠ OVERDUE" label displayed next to due date when overdue

## B6 — Weather indicator on cards ✅ COMPLETE (2/2 sub-items)

1. ✅ Weather emoji + "high°/low°" shown on calendar event cards — `WeatherIndicator` composable
2. ✅ Weather data parsed from chit's `weatherData` JSON field (WMO weather codes → emoji)

## B7 — Map thumbnail on cards ✅ COMPLETE (2/2 sub-items)

1. ✅ Location indicator with 📍 icon + location text — `LocationIndicator` composable
2. ✅ Applied to calendar EventCard (static map tile not possible without image loading library; pin + text is mobile equivalent)

## B8 — Sharing/stealth indicator on cards ✅ COMPLETE (3/3 sub-items)

1. ✅ 👥 icon on shared cards — `SharingIndicators` composable
2. ✅ 👁‍🗨 icon on stealth cards
3. ✅ Applied to TaskCard, NoteCard, ChecklistChitCard

## B9 — Archive/snooze indicators on cards ✅ COMPLETE (3/3 sub-items)

1. ✅ "📦 Archived" badge — `ArchiveSnoozeIndicators` composable
2. ✅ "💤 Snoozed" badge
3. ✅ Applied to TaskCard, NoteCard, ChecklistChitCard

## B10 — Visual indicators system ✅ COMPLETE (3/3 sub-items)

1. ✅ `HealthIndicatorBadges` composable — parses healthData JSON, shows indicator badges
2. ✅ Latest-value badges on cards (e.g., "Weight: 180", "BP: 120")
3. ✅ Applied to TaskCard (shows up to 3 indicators with "+N" overflow)

## B11 — Tab counts ✅ COMPLETE (3/3 sub-items)

1. ✅ `CCaptnTabRow` accepts `tabCounts: Map<CCaptnTab, Int>?` parameter
2. ✅ Count displayed as "(N)" next to tab label when > 0
3. ✅ Matches web's "Tasks (12)" pattern

## B12 — Chit display options ✅ COMPLETE (3/3 sub-items)

1. ✅ `fadePastEvent()` Modifier — reduces opacity to 50% for past events
2. ✅ Overdue highlighting done in B5 (red border + text + label)
3. ✅ Both modifiers accept settings flags to enable/disable

## B13 — Pinned items sort to top ✅ COMPLETE (3/3 sub-items)

1. ✅ `sortPinnedFirst()` utility applied to Tasks, Notes, Checklists
2. ✅ Pinned items always appear before unpinned regardless of sort order
3. ✅ Pin indicator ("📌 Pinned") displayed on cards

## B14 — Snoozed items auto-hide/show ✅ COMPLETE (3/3 sub-items)

1. ✅ `filterSnoozedItems()` hides items whose `snoozedUntil` is in the future
2. ✅ Items automatically re-appear when snooze expires (checks against `LocalDateTime.now()`)
3. ✅ Applied to TasksScreen filter pipeline

---

## Reusable components created in Section B:
- **`TagChipsRow`** — colored tag pills with configurable color map + contrast logic
- **`ChecklistProgressBadge`** — "X/Y" count + mini progress bar
- **`PeopleChipsRow`** — people name pills with initial avatars
- **`WeatherIndicator`** — weather emoji + temperature from weatherData JSON
- **`LocationIndicator`** — 📍 + location text
- **`SharingIndicators`** — shared/stealth icons
- **`ArchiveSnoozeIndicators`** — archived/snoozed badges
- **`HealthIndicatorBadges`** — health data latest-value pills
- **`chitColorBorder()`** — Modifier for chit color as card border
- **`overdueBorder()`** — Modifier for red overdue border
- **`fadePastEvent()`** — Modifier for fading past events
- **`isOverdue()`** — utility to check if a chit is overdue
- **`isPastEvent()`** — utility to check if a chit's event is in the past
- **`sortPinnedFirst()`** — generic pinned-first sort utility
- **`filterSnoozedItems()`** — hide snoozed items until snooze expires
- **`parseHexColor()`** — hex string to Compose Color parser
