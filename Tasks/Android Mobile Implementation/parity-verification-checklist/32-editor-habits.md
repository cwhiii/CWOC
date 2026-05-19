# Habits Zone

**Category:** Editor Zones
**Item #:** 32
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor-dates.js` (habits section)

## Functions

### Habit Toggle

- [ ] `onHabitToggle()` — Main toggle handler: enable/disable habit mode with all side effects
- [ ] Habit checkbox (`#habitEnabled`) — Hidden checkbox tracking habit state
- [ ] Habit toggle button (`#habitToggleBtn`) — Visible button "🎯 Habit" / "🎯 Habit ✓"
- [ ] Button active style — Teal background (#008080), light text when active
- [ ] Button inactive style — Default zone-button styling when inactive

### Habit Frequency

- [ ] `onHabitFrequencyChange()` — Sync habit frequency to hidden recurrence dropdown
- [ ] Habit frequency select (`#habitFrequency`) — Options: DAILY, WEEKLY, MONTHLY, YEARLY
- [ ] Sync to recurrence — Changes propagate to `#recurrence` select

### Habit Goal

- [ ] `onHabitGoalChange()` — Clamp goal to min 1, update progress display
- [ ] Goal input (`#habitGoal`) — Number input for target completions per period
- [ ] Minimum value — Clamped to 1 (cannot be 0 or negative)

### Habit Progress

- [ ] `_updateHabitProgressDisplay()` — Update "X / Y" display from current values
- [ ] Progress display (`#habitProgressDisplay`) — Shows "success / goal" text
- [ ] Log header counter (`#habitLogHeaderCounter`) — Counter widget in Habit Log zone header
- [ ] `_buildHabitCounter(opts)` — Build increment/decrement counter widget (external)
- [ ] Increment callback — Updates `window._currentHabitSuccess`, syncs all counters
- [ ] Decrement callback — Updates `window._currentHabitSuccess`, syncs all counters

### Habit Reset Period

- [ ] `onHabitResetToggle()` — Show/hide reset value and unit inputs
- [ ] `_updateResetUnitOptions()` — Rebuild reset unit dropdown based on cycle frequency
- [ ] Reset enabled checkbox (`#habitResetEnabled`) — Toggle reset period on/off
- [ ] Reset value input (`#habitResetValue`) — Number input for reset interval
- [ ] Reset unit select (`#habitResetUnit`) — Options depend on cycle frequency:
  - DAILY cycle → no reset (just "None")
  - WEEKLY cycle → Day(s) only
  - MONTHLY cycle → Day(s), Week(s)
  - YEARLY cycle → Day(s), Week(s), Month(s)
- [ ] Reset row (`#habitResetRow`) — Hidden for DAILY habits (no smaller unit available)

### Habit Controls Row

- [ ] Controls row (`#habitControlsRow`) — Shown when habit active, hidden otherwise
- [ ] Calendar row (`#habitCalendarRow`) — Habit calendar display row

### Habit State

- [ ] `window._currentHabitSuccess` — Current period's success count
- [ ] `window._currentHabitLastActionDate` — Last action date for rollover detection
- [ ] Show on calendar checkbox (`#showOnCalendar`) — Whether habit appears on calendar
- [ ] Hide overall checkbox (`#habitHideOverall`) — Hide overall stats (reversed: hide=true means unchecked)

## Side Effects When Habit Enabled

### Date Mode

- [ ] Force date mode if "none" — Auto-switch to Start/End mode
- [ ] Hide "None" radio option — Disabled and hidden (habits require a date)
- [ ] Show Perpetual radio option — Only visible for habits

### All Day

- [ ] Force all-day on — Habits are always all-day
- [ ] Lock all-day checkbox — Disabled with tooltip "Habits are always all-day"
- [ ] Update All Day button state — Shows disabled appearance

### Recurrence

- [ ] Auto-enable repeat — If not already on, enable with habit frequency
- [ ] Set "ends never" — Since end date handled by start/end fields
- [ ] Hide repeat row — Habit controls row subsumes it
- [ ] Hide repeat options block — Custom recurrence hidden
- [ ] Sync frequency — Habit frequency dropdown syncs to recurrence dropdown
- [ ] Update recurrence icon — Shows 🎯 instead of 🔁

### Other Zones

- [ ] Auto-collapse Task zone — Task section collapsed when habit toggled on
- [ ] Auto-expand Dates zone — Dates section expanded when habit toggled on
- [ ] Toggle Habit Log zone — Show/hide via `_toggleHabitLogZone(isHabit)`
- [ ] Re-render notifications — Timing dropdown reflects habit mode

## Side Effects When Habit Disabled

- [ ] Unlock all-day checkbox — Re-enable
- [ ] Restore recurrence icon — Back to 🔁
- [ ] Show "None" radio option — Re-enable and show
- [ ] Uncheck repeat — Disable recurrence
- [ ] Show repeat row — If date mode is active
- [ ] Hide habit controls row — Hide controls and calendar
- [ ] Hide perpetual row — Only for habits
- [ ] Hide reset/hide-overall rows — Habit-specific settings hidden
- [ ] Restore recurrence labels — Normal format (with day/date suffixes)

## Data Persistence (from editor-init.js loadChitData)

- [ ] `chit.habit` — Boolean: is this a habit chit
- [ ] `chit.habit_success` — Current period success count
- [ ] `chit.habit_goal` — Target completions per period
- [ ] `chit.habit_reset_period` — Format "N:UNIT" (e.g., "3:DAILY") or legacy "DAILY"
- [ ] `chit.habit_last_action_date` — Last action date for rollover
- [ ] `chit.habit_hide_overall` — Boolean: hide overall stats
- [ ] `chit.show_on_calendar` — Boolean: show on calendar (default true)
- [ ] `_evaluateHabitRollover(chit)` — Lazy rollover: reset success if period expired (external)
- [ ] `_persistHabitRollover(chit)` — Save rollover state to server in background (external)
- [ ] `_loadHabitLog(chit)` — Load Habit Log zone with period history + charts (external)

## All Day Button (Related)

- [ ] `_toggleAllDayBtn()` — Toggle All Day button (mirrors hidden checkbox)
- [ ] `_updateAllDayBtnState()` — Sync button appearance from checkbox state
- [ ] Button active style — Teal background, "🗓️ All Day ✓"
- [ ] Button inactive style — Default, "🗓️ All Day"
- [ ] Button disabled style — opacity 0.6, pointer-events none (when habit locks it)
