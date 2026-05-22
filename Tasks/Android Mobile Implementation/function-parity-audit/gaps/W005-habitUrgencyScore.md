# W5: _habitUrgencyScore(h)

## What the web function does
- Takes habit data object with chit, goal, success
- If remaining <= 0 (complete): returns 9999 (least urgent)
- Gets recurrence freq from chit.recurrence_rule
- Calculates daysInCycle: DAILY=1, WEEKLY=7, MONTHLY=30, YEARLY=365
- Calls `getCurrentPeriodDate(chit)` to find the START of the current period
- Computes elapsed = days since period start
- daysLeft = daysInCycle - elapsed (minimum 1)
- Returns daysLeft / remaining (lower = more urgent)

## What exists on Android
- `habitUrgencyScore` (A#1856) in TasksScreen.kt
- Same overall formula: daysLeft / remaining
- Returns 9999f when complete

## What's different
- **Web** uses `getCurrentPeriodDate(chit)` to calculate the period start date from the recurrence rule, then computes elapsed from that anchor.
- **Android** uses `habitLastActionDate` directly as the reference point for computing elapsed days.

These diverge when a user hasn't acted yet in a new period — `habitLastActionDate` would still point to the previous period's action, making `elapsed` much larger than it should be (potentially exceeding daysInCycle). The web's approach anchors to the period start regardless of when the user last acted.

## Fix needed
Android should compute elapsed from the current period start date (matching the web's `getCurrentPeriodDate` logic) rather than from `habitLastActionDate`. This requires implementing `getCurrentPeriodDate` equivalent logic in the urgency calculation.
