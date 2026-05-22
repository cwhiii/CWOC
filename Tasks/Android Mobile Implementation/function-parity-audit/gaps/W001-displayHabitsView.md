# W1: displayHabitsView(chitsToDisplay)

## What the web function does
1. Filters chits by `habit === true`
2. Shows empty state if no habits found
3. For each habit, calls `_evaluateHabitRollover(chit)` — detects if the current period has changed since last action, and if so, snapshots the current success/goal into `recurrence_exceptions` and resets `habit_success` to 0
4. Persists rollover via `_persistHabitRollover(chit)` (PATCH to API)
5. Computes per-habit: goal, success, isCompleted, successRate (from historical snapshots), streak, metCount, totalPeriods
6. Sorts: incomplete first (by urgency score), completed last
7. Renders habit cards via `_renderHabitCards()`
8. Fetches and renders rule habits below chit habits
9. Optionally renders aggregate success rate combining chit + rule habits

## What exists on Android
- `HabitsView` (A#1843) in TasksScreen.kt: filters by `habit`, groups into On Deck / Out of Mind / Accomplished, sorts by urgency, renders HabitCards, renders rule habits, shows aggregate success rate bar
- `HabitCard` (A#1841): renders individual habit with progress, streak, success rate, +/- buttons
- `habitUrgencyScore` (A#1856): urgency calculation
- `isResetPeriodActive` (A#1857): reset period check
- `calculateHistoricalSuccessRate` in TasksScreen.kt: reads rollover snapshots from recurrence_exceptions
- `calculateStreak` (A#1197) in HabitsZone.kt

## What's missing
1. **Client-side habit rollover detection and persistence** — The web calls `_evaluateHabitRollover()` on every render to detect period changes and reset the counter. The Android app does NOT do this. It relies entirely on the server-side scheduler to perform rollovers. If the user opens the Android app before the server scheduler runs (e.g., server is down, or timing gap), they'll see stale habit data with the old period's success count still showing.

   **Fix needed:** Add a client-side rollover check in the Android HabitsView (or TasksViewModel) that mirrors the web's `_evaluateHabitRollover` logic — detect if `habit_last_action_date` is in a previous period, snapshot current success into recurrence_exceptions, reset habit_success to 0, and PATCH to the server.
