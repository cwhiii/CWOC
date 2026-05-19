# Recurrence (Inline in Dates Zone)

**Category:** Editor Zones
**Item #:** 31
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/editor/editor-dates.js` (UI controls)
- `src/frontend/js/shared/shared-recurrence.js` (expansion logic)

## Editor-Dates Recurrence Functions

### Recurrence UI Controls

- [ ] `onRecurrenceChange()` — Handle recurrence dropdown change: show/hide custom row, update icon
- [ ] `onRepeatToggle()` — Toggle repeat options visibility when checkbox changes
- [ ] `onRecurrenceFreqChange()` — Show/hide byDay checkboxes when custom frequency is WEEKLY
- [ ] `onRecurrenceEndsToggle()` — Show/hide "ends on" date input based on "never" checkbox
- [ ] `_updateRecurrenceLabels()` — Update dropdown labels with context (day name, date ordinal)
- [ ] `_onRecurrenceFreqChange()` — Alias for onRecurrenceFreqChange
- [ ] `_updateByDayVisibility()` — Alias for onRecurrenceFreqChange
- [ ] `onRecurrenceToggle()` — Alias for onRecurrenceChange

### Recurrence Data

- [ ] `_buildRecurrenceRule()` — Build recurrence rule object from UI fields
- [ ] `_loadRecurrenceRule(rule)` — Load recurrence rule into UI fields from chit data

### Recurrence Rule Object Structure

- [ ] `freq` — Frequency: DAILY, WEEKLY, MONTHLY, YEARLY (or CUSTOM → customFreq)
- [ ] `interval` — Repeat every N periods (default 1)
- [ ] `byDay` — Array of day codes for WEEKLY: SU, MO, TU, WE, TH, FR, SA
- [ ] `until` — End date (ISO string) or null for "never"

## UI Controls & Inputs

### Repeat Toggle

- [ ] Repeat checkbox (`#repeatEnabled`) — Enable/disable recurrence
- [ ] Recurrence icon (`#recurrenceIcon`) — Shows 🔁 when repeat is active (🎯 for habits)

### Recurrence Dropdown

- [ ] Recurrence select (`#recurrence`) — Options: DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM
- [ ] Dynamic labels — "Weekly on Saturday", "Monthly on the 15th", "Yearly on March 15th"
- [ ] Habit-simplified labels — Just "Weekly", "Monthly", "Yearly" when habit is active

### Custom Recurrence Options

- [ ] Custom row (`#recurrenceCustomRow`) — Shown only when CUSTOM selected
- [ ] Frequency select (`#recurrenceFreq`) — WEEKLY, DAILY, MONTHLY, YEARLY
- [ ] Interval input (`#recurrenceInterval`) — Number input for "every N"
- [ ] By-day checkboxes (`#recurrenceByDay`) — 7 checkboxes for days of week (shown only for WEEKLY)
- [ ] Day checkbox values — SU, MO, TU, WE, TH, FR, SA

### Ends Configuration

- [ ] "Ends never" checkbox (`#recurrenceEndsNever`) — Toggle between never/date
- [ ] Until date input (`#recurrenceUntil`) — Flatpickr date picker for end date
- [ ] Date wrap (`#recurrenceEndsDateWrap`) — Container for until date (hidden when "never" checked)

### Repeat Options Block

- [ ] Inline options (`#repeatOptionsInline`) — Shown when repeat enabled
- [ ] Options block (`#repeatOptionsBlock`) — Custom details (shown for CUSTOM)

## Shared-Recurrence Functions (Expansion Logic)

### Timezone Helpers

- [ ] `_parseNaiveDatetime(isoStr)` — Parse ISO datetime to {year, month, day, hour, minute, second}
- [ ] `_wallClockToUtcMs(parts, tzName)` — Convert wall-clock in timezone to UTC milliseconds (handles DST gaps/ambiguity)
- [ ] `_utcMsToWallClock(utcMs, tzName)` — Convert UTC ms to wall-clock components in timezone
- [ ] `_advanceWallClock(parts, freq, interval, byDayNums)` — Advance date by frequency preserving wall-clock time
- [ ] `_isRecurrenceTzValid(tzName)` — Check if timezone is valid via Intl API
- [ ] `_resolveRecurrenceTz(chit, currentTz)` — Resolve effective timezone (anchored vs floating)

### Expansion

- [ ] `expandRecurrence(chit, rangeStart, rangeEnd, currentTz)` — Expand recurring chit into virtual instances for date range
- [ ] Virtual instance properties — `_isVirtual`, `_parentId`, `_virtualDate`, `_isCompleted`, `_instanceNum`
- [ ] Exception handling — Skip broken_off dates, apply overrides (title, note, location, times)
- [ ] Completed instances — Mark with status='Complete' based on exception.completed
- [ ] byDay filtering — For WEEKLY with byDay, only generate on matching days
- [ ] Until date check — Stop expansion when past until date
- [ ] Max instances cap — 365 instances maximum per expansion
- [ ] Duration preservation — End time computed from start + original duration
- [ ] Sub-daily support — MINUTELY and HOURLY use UTC-based uniform intervals

### Legacy Advancement

- [ ] `_advanceRecurrence(current, freq, interval, byDayNums)` — Non-timezone-aware date advancement (for series info)

### Formatting

- [ ] `formatRecurrenceRule(rule, isHabit)` — Format rule as human-readable string
- [ ] Frequency text — "Daily", "Every 3 days", "Weekly on Mon, Wed", "Monthly", "Yearly"
- [ ] Until suffix — "until [date]" appended if until is set
- [ ] Habit mode — Simplified labels without day/date suffixes

### Series Info

- [ ] `getRecurrenceSeriesInfo(chit, virtualDate)` — Count occurrence number, total past, completed past, success rate
- [ ] Returns — {instanceNum, totalPast, completedPast, successRate}

## Behaviors

- [ ] Greyed-out when no date mode — Recurrence fields greyed when date mode is "none" or "pointintime"
- [ ] Hidden when habit active — Repeat row hidden (habit controls subsume it)
- [ ] Auto-enable for habits — Repeat auto-enabled when habit is toggled on
- [ ] Context-aware labels — Labels update when date changes (e.g., "Weekly on Tuesday")
- [ ] Timezone-aware expansion — Anchored chits expand in stored timezone, floating in user's timezone
- [ ] DST handling — Wall-clock time preserved across DST transitions for daily+ frequencies
