# W14: getCurrentPeriodDate(chit)

## What the web function does
Calculates the start date (YYYY-MM-DD) of the current recurrence period for a habit chit. Complex logic handling:
- DAILY: interval=1 returns today; interval>1 walks from start_datetime by interval days
- WEEKLY with byDay: finds most recent scheduled day ≤ today (handles multi-week intervals)
- WEEKLY without byDay: returns start of current week (respects week_start_day setting)
- MONTHLY: interval=1 returns 1st of current month; interval>1 walks from start month
- YEARLY: interval=1 returns Jan 1; interval>1 walks from start year

Used by: _habitUrgencyScore (W5), _evaluateHabitRollover (W16), period label display in habit cards

## What exists on Android
Nothing. No equivalent function exists. The Android app uses `habitLastActionDate` as a proxy in urgency scoring, which is incorrect when the user hasn't acted yet in a new period.

## What's missing
The entire function needs to be implemented. It's a core dependency for:
1. Correct urgency scoring (W5 gap)
2. Client-side rollover detection (W1/W16 gap)
3. Period label display on habit cards (showing "Week of Apr 28" etc.)

## Fix needed
Implement `getCurrentPeriodDate(chit: ChitEntity): LocalDate` in a shared domain utility (e.g., `domain/habits/HabitPeriodCalculator.kt`) matching the web's logic for all frequency types and intervals.
