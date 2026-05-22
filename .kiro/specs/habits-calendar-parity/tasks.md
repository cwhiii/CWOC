# Implementation Plan: Habits System Parity (Items 1–25)

## Overview

Achieve full behavioral parity between the CWOC Android app and the mobile browser version for the Habits System. After implementation, an end user should not be able to distinguish between using the Android app and the mobile browser — identical calculations, identical sort order, identical visual output.

## Tasks

- [x] 1. Create HabitPeriodCalculator utility class
  - [x] 1.1 Implement `getCurrentPeriodDate()` in `HabitPeriodCalculator.kt`
    - Create `android/app/src/main/java/com/cwoc/app/domain/recurrence/HabitPeriodCalculator.kt`
    - Match the web's `shared-habits.js` logic exactly for all frequency types (DAILY, WEEKLY with/without byDay, MONTHLY, YEARLY)
    - Handle all interval values, week_start_day setting, future start dates, and missing data edge cases
    - Use `java.time.LocalDate` for date arithmetic, return YYYY-MM-DD strings
    - _Requirements: 1_
  - [x] 1.2 Implement `getPreviousPeriodDate()` in `HabitPeriodCalculator.kt`
    - Compute the period immediately before the current one for each frequency type
    - Handle interval > 1, month clamping, leap year clamping
    - Return null for missing/invalid recurrence rules
    - _Requirements: 2_

- [x] 2. Create HabitRolloverEngine
  - [x] 2.1 Implement rollover detection logic in `HabitRolloverEngine.kt`
    - Create `android/app/src/main/java/com/cwoc/app/domain/recurrence/HabitRolloverEngine.kt`
    - Implement the three rollover rules: (1) no history = no rollover, (2) recent snapshot = no rollover, (3) stale snapshot = snapshot current progress + reset
    - Handle existing exception entries for the previous period date
    - _Requirements: 3_
  - [x] 2.2 Implement rollover persistence in `HabitRolloverEngine.kt`
    - Persist via PATCH `/api/chits/{id}/fields` asynchronously
    - Mark dirty on failure for sync retry
    - Handle 404 responses by discarding the persistence attempt
    - _Requirements: 4_

- [x] 3. Rewrite success rate and streak calculations
  - [x] 3.1 Rewrite `calculateHistoricalSuccessRate` in `TasksScreen.kt`
    - Collect existing snapshot entries (with habit_success + habit_goal, excluding broken_off)
    - Add current period if complete (habit_success >= habit_goal)
    - Apply window as ENTRY COUNT (not days), count met entries for rate
    - Return Math.round((metCount / totalEntries) * 100) or 0 when no entries
    - _Requirements: 5_
  - [x] 3.2 Rewrite `calculateStreak` in `HabitsZone.kt`
    - Change signature to accept `ChitEntity` directly
    - Walk backward from last entry counting consecutive entries where habit_success >= habit_goal
    - Stop at first entry where habit_success < habit_goal
    - _Requirements: 6_

- [x] 4. Rewrite urgency score to use getCurrentPeriodDate
  - [x] 4.1 Rewrite `habitUrgencyScore` in `TasksScreen.kt`
    - Use `HabitPeriodCalculator.getCurrentPeriodDate()` to get period start
    - Use recurrence frequency (DAILY=1, WEEKLY=7, MONTHLY=30, YEARLY=365) for daysInCycle
    - Compute elapsed days from period start, daysLeft = max(1, daysInCycle - elapsed)
    - Formula: daysLeft / remaining where remaining = goal - success; return 9999 if complete
    - _Requirements: 7_

- [x] 5. Add period label and "next cycle starts" to HabitCard
  - [x] 5.1 Add period label display to `HabitCard` composable
    - Display period label after title separated by " · "
    - Format: WEEKLY→"Week of Apr 28", MONTHLY→"May 2026", YEARLY→"2026", DAILY→"May 19, 2026"
    - Omit label if getCurrentPeriodDate returns null
    - _Requirements: 8_
  - [x] 5.2 Add "next cycle starts" text for accomplished habits
    - For accomplished habits show "✅ Complete for this cycle. (Next cycle starts {Mon} {day}.)"
    - Compute next period by advancing currentPeriod by one interval
    - Omit parenthetical if next period cannot be computed
    - _Requirements: 9_

- [x] 6. Integrate rollover into habits view and editor
  - [x] 6.1 Wire `HabitRolloverEngine` into `TasksViewModel`
    - Evaluate rollover for each habit chit before emitting UI state
    - Inject via Hilt, pass weekStartDay from settings
    - Ensure idempotency — multiple calls in same session don't double-rollover
    - _Requirements: 12_
  - [x] 6.2 Wire `HabitRolloverEngine` into `ChitEditorViewModel`
    - Evaluate rollover when loading a habit chit before populating the form
    - Inject via Hilt, pass weekStartDay from settings
    - _Requirements: 12_

- [x] 7. Fix habits success window server sync
  - [x] 7.1 Update `SidebarStateViewModel.setHabitsSuccessWindow()` to sync to Room
    - Update `SettingsEntity.habitsSuccessWindow` in Room database
    - Mark settings dirty for sync push
    - Convert -1 to "all" for the entity value
    - The existing sync mechanism handles the server push
    - _Requirements: 10_

- [x] 8. Fix combined success rate calculation
  - [x] 8.1 Update `calculateCombinedSuccessRate` in `TasksViewModel.kt`
    - Use entry-count-based windowing (take last N entries) instead of date-based windowing
    - Match the same snapshot-based logic as the individual card calculations from Task 3
    - _Requirements: 11_

- [x] 9. Update Web Function Index with task file references
  - [x] 9.1 Add "Resolved By" column to Web Function Index tables
    - Add column to Habits System and Calendar Drag tables in `Web Function Index.md`
    - Show which task resolves each incomplete item
    - Leave already-complete items blank

## Notes

- Task 9 is already complete (the Web Function Index was updated as part of this spec creation).
- Wave 1: Tasks 1, 3, 7 have no dependencies and can be done in parallel.
- Wave 2: Tasks 2, 4, 5 depend on Task 1 (HabitPeriodCalculator).
- Wave 3: Task 6 depends on Task 2; Task 8 depends on Task 3.
- Wave 4: Task 9 (index update) is a final bookkeeping step.
- The web's `getHabitSuccessRate` and `getHabitStreak` functions in `shared-habits.js` walk the full recurrence but are NEVER called from the habits view. The actual user-visible behavior uses a simpler inline calculation. Tasks 3 and 8 match the ACTUAL behavior.
- Item 5 (`_habitUrgencyScore`) is marked complete in the Web Function Index but uses a completely wrong algorithm on Android. Task 4 fixes this.
- Item 12 (`_renderAggregateSuccessRate`) is marked complete but uses wrong windowing logic internally. Task 8 fixes this.
- No tasks install software — all dependencies are already available.
- No tasks require running the server.
