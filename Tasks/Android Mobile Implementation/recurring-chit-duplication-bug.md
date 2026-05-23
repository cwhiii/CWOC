# Recurring / All-Day / Habit Chit Duplication Bug — Android App

## How It Works on Web & Mobile (Correct Behavior)

### Expansion Model

The web/mobile frontend uses a **single-pass, client-side expansion** model:

1. The server sends each recurring chit **once** — just the base chit with its `recurrence_rule` JSON field.
2. When the Calendar tab is active, `main-init.js` iterates all chits. If a chit has `recurrence_rule.freq`, it calls `expandRecurrence(chit, rangeStart, rangeEnd)` from `shared-recurrence.js`.
3. `expandRecurrence` generates **virtual instances** — copies of the chit with adjusted dates and `_isVirtual: true` — for each occurrence within the visible date range.
4. Non-recurring chits pass through untouched.
5. The result is a flat array: non-recurring chits + virtual instances. This array is rendered once.

### Key Constraints

- **Max 365 iterations** per expansion call — prevents runaway loops.
- **Range-bounded** — expansion stops as soon as an instance exceeds `rangeEnd`.
- **Single execution** — the expansion runs once per render cycle. Navigating to a new date re-runs the entire filter/expand pipeline from scratch (not additively).
- **No persistent storage of instances** — virtual instances exist only in memory for display. They're regenerated fresh each time the view updates.

### All-Day Chits

- `getCalendarDateInfo(chit)` checks `chit.all_day`. If truthy, returns `isAllDay: true`.
- The calendar separates all-day events into a dedicated header section above the time grid.
- All-day recurring chits expand the same way as timed ones — one virtual instance per occurrence date, rendered in the all-day section.

### Habits

- Habits are recurring chits with `is_habit: true`. They use the exact same expansion logic.
- Display differences: habits show a 🎯 icon instead of 🔁, and `formatRecurrenceRule()` omits day suffixes when `isHabit=true`.
- A sidebar toggle ("show-habits") can hide all habits from the calendar.
- Expansion-wise, habits are identical to any other recurring chit.

### Recurrence Exceptions

- `recurrence_exceptions` is a JSON array of `{date, broken_off, completed, ...}` objects.
- `broken_off` dates are skipped entirely (no instance generated).
- `completed` dates still generate an instance but may render with a checkmark/strikethrough.
- Modified exceptions can override the time/title of a specific instance.

---

## How the Android App Does It (Broken)

### The Architecture

`CalendarViewModel.loadEvents()` uses a two-query `combine` pattern:

```kotlin
combine(
    chitRepository.getChitsForDay(dayStart, dayEnd),  // Room Flow — never completes
    chitRepository.getRecurringChits()                 // Room Flow — never completes
) { rangeEvents, recurringChits ->
    // Expand recurring chits via RecurrenceEngine
    // Merge: non-recurring + expanded instances + birthdays
    nonRecurring + expandedInstances + expandedBirthdays
}.collect { mergedEvents ->
    _uiState.update { it.copy(events = mergedEvents) }
}
```

The expansion logic itself (`RecurrenceEngine.expand()`) is a correct Kotlin port of the web's `expandRecurrence`. It respects the same max-iterations cap, range bounds, and exception handling.

### The Bug: Uncancelled Coroutine Collectors

`loadEvents()` is called from **7 places**:
- `init {}` (on ViewModel creation)
- `setViewMode()`
- `previousPeriod()`
- `nextPeriod()`
- `goToToday()`
- `setDate()`

Each call does:
```kotlin
private fun loadEvents() {
    viewModelScope.launch {   // ← NEW coroutine every time
        // combine(...).collect { ... }  ← NEVER terminates (Room Flows are infinite)
    }
}
```

**There is no `Job` reference stored, and no cancellation of the previous collector.**

Since Room `Flow`s never complete, each `collect` call runs **indefinitely**. After N navigations, there are N active collectors all:
1. Receiving emissions from Room whenever the DB changes
2. Independently expanding all recurring chits
3. Writing their results to `_uiState.events`

The result: the UI state gets updated by multiple collectors, each producing a full set of expanded instances. Depending on timing and Room re-emission patterns, this manifests as **10-20 duplicated instances per recurring/habit/all-day chit per day**.

### Secondary Issue: Double-Counting from getChitsForDay

The `getChitsForDay` query returns chits whose date fields fall within the visible range — including recurring chits that happen to have their base date in range. The code attempts to deduplicate:

```kotlin
val nonRecurring = rangeEvents.filter { it.id !in recurringIds }
```

This works correctly for a single collector. But with multiple stacked collectors, the deduplication only applies within each collector's own pass — it doesn't prevent cross-collector duplication in the UI state.

---

## What Needs to Change to Match Web/Mobile Behavior

### Fix 1: Cancel Previous Collector (Critical)

Store the `loadEvents` job and cancel it before launching a new one:

```kotlin
private var loadEventsJob: Job? = null

private fun loadEvents() {
    loadEventsJob?.cancel()  // Kill the previous infinite collector
    loadEventsJob = viewModelScope.launch {
        val state = _uiState.value
        // ... existing combine/collect logic unchanged
    }
}
```

This ensures only **one** collector is active at any time, matching the web's "single expansion pass per render" model.

### Fix 2: Verify No Other Views Have the Same Pattern

Check any other ViewModel that calls `getRecurringChits()` or uses `combine(...).collect` in a re-callable function. The same bug pattern (launch without cancel) could exist in:
- Tasks/Notes/Checklists list views if they expand recurrences
- Alerts view
- Any view that re-fetches on navigation

### Fix 3: Consider Using flatMapLatest (Alternative)

Instead of manual job cancellation, restructure to use `flatMapLatest` on a trigger flow:

```kotlin
private val _loadTrigger = MutableStateFlow(0L)

init {
    viewModelScope.launch {
        _loadTrigger.flatMapLatest {
            val state = _uiState.value
            val (dayStart, dayEnd) = getDateRange(...)
            combine(
                chitRepository.getChitsForDay(dayStart, dayEnd),
                chitRepository.getRecurringChits()
            ) { rangeEvents, recurringChits ->
                // expansion logic
            }
        }.collect { mergedEvents ->
            _uiState.update { it.copy(events = mergedEvents) }
        }
    }
}

private fun loadEvents() {
    _loadTrigger.value = System.currentTimeMillis()
}
```

`flatMapLatest` automatically cancels the previous inner flow when a new emission arrives — structurally preventing the stacking bug.

### Fix 4: Add Deduplication Safety Net

As a belt-and-suspenders measure, deduplicate the final event list by virtual ID before setting state:

```kotlin
val deduplicated = mergedEvents.distinctBy { it.id }
_uiState.update { it.copy(events = deduplicated) }
```

This won't fix the root cause (wasted computation from stacked collectors) but prevents visible duplication if any edge case slips through.

---

## Summary

| Aspect | Web/Mobile (Correct) | Android App (Broken) |
|--------|---------------------|---------------------|
| Expansion trigger | Once per render cycle | Once per navigation (stacks) |
| Collector lifetime | Synchronous — runs and finishes | Infinite — Room Flow never completes |
| Active collectors | Always 1 | Accumulates: 1 per navigation |
| Result | 1 instance per occurrence per day | 10-20× duplicated instances |
| Root cause | N/A | No `Job` cancellation in `loadEvents()` |
