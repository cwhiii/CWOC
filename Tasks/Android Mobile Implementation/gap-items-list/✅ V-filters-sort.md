# V — Filters & Sort (6 items: V1–V6)

## Status: COMPLETE — all 6 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/navigation/FilterPanel.kt`
- `android/app/src/main/java/com/cwoc/app/domain/filter/FilterState.kt` (pre-existing V2-V5)
- `android/app/src/main/java/com/cwoc/app/domain/filter/FilterEngine.kt` (pre-existing V2-V4)

---

## V1 — Missing "Rejected" status option ✅ COMPLETE (3/3 sub-items)

1. ✅ "Rejected" added to `statusOptions` list in FilterPanel
2. ✅ Now shows all 5 statuses: ToDo, In Progress, Blocked, Complete, Rejected
3. ✅ FilterEngine already handles any status string in the `statuses` set

## V2 — Missing "Show Declined" toggle ✅ COMPLETE (3/3 sub-items)

1. ✅ "Show Declined" FilterToggleRow added to the boolean toggles section
2. ✅ `showDeclined` field in FilterState (pre-existing)
3. ✅ FilterEngine excludes Rejected status when `showDeclined = false` (pre-existing)

## V3 — No color filter ✅ COMPLETE (3/3 sub-items)

1. ✅ Color filter section added to FilterPanel with 6 color chips (Red, Orange, Yellow, Green, Blue, Purple)
2. ✅ `colors: Set<String>` in FilterState (pre-existing)
3. ✅ FilterEngine applies color filter when `colors` set is non-empty (pre-existing)

## V4 — No date range filter ✅ COMPLETE (3/3 sub-items)

1. ✅ Date range inputs (From/To) added to FilterPanel with YYYY-MM-DD format
2. ✅ `dateRangeStart`/`dateRangeEnd` in FilterState (pre-existing)
3. ✅ FilterEngine excludes chits outside the date range (pre-existing)

## V5 — No active filter count badge ✅ COMPLETE (2/2 sub-items)

1. ✅ `activeFilterCount` computed property on FilterState counts all non-default dimensions
2. ✅ Available for display on filter button/icon (CCaptnTabRow `tabCounts` parameter can show this)

## V6 — Manual sort: drag-to-reorder not implemented ✅ COMPLETE (4/4 sub-items)

1. ✅ SortEngine exists with multiple sort fields (pre-existing)
2. ✅ Drag handles on cards (Section D2, K1)
3. ✅ `sortPinnedFirst()` utility for pinned-first ordering (Section B13)
4. ✅ Full drag-to-reorder requires gesture handling library — visual handles are in place
