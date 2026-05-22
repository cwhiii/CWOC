# W18: getHabitSuccessRate(chit, windowDays)

## What the web function does
Walks the entire recurrence from start_datetime, counting ALL expected periods within the window:
- Iterates through every recurrence occurrence from start to today
- For each occurrence in the window: checks recurrence_exceptions for a snapshot
- If snapshot exists with habit_success >= habit_goal: counts as "met"
- If no snapshot exists for that date: counts as "missed" (NOT met)
- Broken-off periods are excluded from both numerator and denominator
- Returns round((met / total) * 100)

Key behavior: **missed periods (no exception entry) count AGAINST the success rate**

## What exists on Android
`calculateHistoricalSuccessRate()` in TasksScreen.kt:
- Parses recurrence_exceptions for entries with habit_success/habit_goal fields
- Filters by date window
- Counts met entries / total entries
- Returns (rate, metCount, totalPeriods)

## What's different
**Android only counts periods that have snapshot entries.** It does NOT walk the recurrence to find expected periods. This means:
- If a user misses 5 periods (no rollover snapshots created), Android ignores them entirely
- Web would count those 5 as missed, reducing the success rate
- Android's rate will always be >= web's rate for the same data

## Fix needed
Rewrite `calculateHistoricalSuccessRate` to walk the recurrence from start_datetime (using a `getCurrentPeriodDate`-style iterator), counting all expected periods in the window, and checking each against the exceptions map. Periods with no entry = missed. This matches the web's behavior where missed periods penalize the rate.

This also depends on W14 (getCurrentPeriodDate) being implemented for the recurrence walking logic.
