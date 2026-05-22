# W19: getHabitStreak(chit)

## What the web function does
Walks ALL recurrence occurrences from start_datetime to today, then walks backward from the most recent, counting consecutive periods where habit_success >= habit_goal:
- Builds full list of occurrence dates by walking the recurrence rule
- Builds exception lookup map from recurrence_exceptions
- Walks backward through occurrences:
  - Broken-off periods: skipped (neutral)
  - Met periods (habit_success >= habit_goal): streak++
  - Missed periods (no exception or not met): BREAK streak
- Returns the streak count (can be any positive integer)

## What exists on Android
`calculateStreak()` (A#1197) in HabitsZone.kt:
- Only checks if `lastActionDate` is within 0-1 periods of today
- Returns 1 if within current/previous period, 0 otherwise
- Comment says "Without full history, we can only confirm the streak is at least 1"

## What's different
The Android version is a stub that returns 0 or 1. The web computes the actual streak by walking recurrence history. A user with a 30-day streak would see "🔥 30" on web but "🔥 1" on Android.

## Fix needed
Rewrite `calculateStreak` to walk the recurrence occurrences (same pattern as `getHabitSuccessRate`) and count consecutive met periods walking backward. This requires the same recurrence-walking infrastructure as W14 and W18.
