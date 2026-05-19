# Dates & Times

**Category:** Editor Zones
**Item #:** 19
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Date Mode Radio Buttons (editor-dates.js + editor.html)

- [ ] `<input type="radio" name="dateMode" value="none" id="dateModeNone">` — None (no dates)
- [ ] `<input type="radio" name="dateMode" value="startend" id="dateModeStartEnd">` — Start/End mode
- [ ] `<input type="radio" name="dateMode" value="due" id="dateModeDue">` — Due mode
- [ ] `<input type="radio" name="dateMode" value="pointintime" id="dateModePointInTime">` — Point in Time mode
- [ ] `<input type="radio" name="dateMode" value="perpetual" id="dateModePerpetual">` — Perpetual mode (habits only)
- [ ] `onDateModeChange()` — Master handler for date mode radio changes; shows/hides fields, manages all-day, repeat, timezone
- [ ] `_detectDateMode(chit)` — Detects date mode from chit data (due > startend > pointintime > none)
- [ ] `_setDateMode(mode)` — Programmatically sets radio button and triggers onDateModeChange

### Start/End Date Fields (editor.html)

- [ ] `<input type="text" id="start_datetime" class="date-input">` — Start date (Flatpickr)
- [ ] `<button type="button" id="start_time" class="cwoc-time-btn" onclick="cwocTimePicker.open(this)">` — Start time (drum roller picker)
- [ ] `<input type="text" id="end_datetime" class="date-input">` — End date (Flatpickr)
- [ ] `<button type="button" id="end_time" class="cwoc-time-btn" onclick="cwocTimePicker.open(this)">` — End time (drum roller picker)
- [ ] `<span class="date-mode-separator">to</span>` — "to" separator between start time and end time

### Due Date Fields (editor.html)

- [ ] `<input type="text" id="due_datetime" class="date-input">` — Due date (Flatpickr)
- [ ] `<button type="button" id="due_time" class="cwoc-time-btn" onclick="cwocTimePicker.open(this)">` — Due time (drum roller picker)
- [ ] `<input type="checkbox" id="dueComplete" onchange="onDueCompleteToggle()">` — Due Complete checkbox (syncs with status)
- [ ] `<label id="dueCompleteLabel">` — Complete label (shown only in due mode)

### Point in Time Fields (editor.html + editor-dates.js)

- [ ] `<input type="text" id="point_in_time_date" class="date-input">` — Point in Time date (Flatpickr)
- [ ] `<button type="button" id="point_in_time_time" class="cwoc-time-btn" onclick="cwocTimePicker.open(this)">` — Point in Time time (drum roller picker)
- [ ] `<button onclick="setPointInTimeNow()">Now</button>` — Set to current date/time button
- [ ] `setPointInTimeNow()` — Sets point-in-time fields to current date and time
- [ ] `clearPointInTime()` — Clears point-in-time fields

### Perpetual Mode (editor.html + editor-dates.js)

- [ ] `<div id="perpetualRow">` — Perpetual row (hidden by default, shown for habits)
- [ ] `<span id="perpetualDescription">` — Description text ("Starts now, continues forever")
- [ ] `onPerpetualToggle()` — Legacy handler, delegates to onDateModeChange
- [ ] `_fmtPerpetualDate(raw)` — Formats date for perpetual description display

### All Day Toggle (editor-dates.js + editor.html)

- [ ] `<button id="allDayToggleBtn" onclick="_toggleAllDayBtn()">` — All Day toggle button in zone header
- [ ] `<input type="checkbox" id="allDay">` — Hidden all-day checkbox
- [ ] `toggleAllDay()` — Hides/shows time inputs based on all-day state
- [ ] `_toggleAllDayBtn()` — User-facing button handler (toggles checkbox + calls toggleAllDay)
- [ ] `_updateAllDayBtnState()` — Syncs button appearance (active/inactive/disabled)
- [ ] `_wireAllDayAutoDeselect()` — Wires time input change listeners to auto-deselect all-day
- [ ] Auto-default: all-day auto-checked when date mode first activated (flag `_allDayAutoDefaulted`)

### Recurrence / Repeat (editor-dates.js + editor.html)

- [ ] `<input type="checkbox" id="repeatEnabled" onchange="onRepeatToggle()">` — Repeat enabled checkbox
- [ ] `<select id="recurrence" onchange="onRecurrenceChange()">` — Recurrence frequency dropdown
- [ ] Option: `"DAILY"` — Daily
- [ ] Option: `"WEEKLY"` — Weekly (contextual: "Weekly on Saturday")
- [ ] Option: `"MONTHLY"` — Monthly (contextual: "Monthly on the 15th")
- [ ] Option: `"YEARLY"` — Yearly (contextual: "Yearly on May 15th")
- [ ] Option: `"CUSTOM"` — Custom...
- [ ] `<input type="checkbox" id="recurrenceEndsNever" onchange="onRecurrenceEndsToggle()">` — Ends never checkbox
- [ ] `<input type="text" id="recurrenceUntil" class="date-input">` — Recurrence end date (Flatpickr)
- [ ] `onRepeatToggle()` — Shows/hides repeat options
- [ ] `onRecurrenceChange()` — Handles frequency change, shows/hides custom row
- [ ] `onRecurrenceEndsToggle()` — Shows/hides end date input
- [ ] `_updateRecurrenceLabels()` — Updates dropdown labels with contextual date info
- [ ] `_buildRecurrenceRule()` — Builds recurrence rule object from UI state
- [ ] `_loadRecurrenceRule(rule)` — Loads recurrence rule into UI from chit data

### Custom Recurrence (editor.html + editor-dates.js)

- [ ] `<div id="recurrenceCustomRow">` — Custom recurrence row (hidden unless Custom selected)
- [ ] `<input type="number" id="recurrenceInterval" min="1" max="999">` — Interval number
- [ ] `<select id="recurrenceFreq" onchange="onRecurrenceFreqChange()">` — Custom frequency (MINUTELY/HOURLY/DAILY/WEEKLY/MONTHLY/YEARLY)
- [ ] `<div id="recurrenceByDay">` — Day-of-week checkboxes (shown for WEEKLY)
- [ ] Day checkboxes: SU, MO, TU, WE, TH, FR, SA
- [ ] `onRecurrenceFreqChange()` — Shows/hides day-of-week checkboxes

### Habit Controls (editor-dates.js + editor.html)

- [ ] `<input type="checkbox" id="habitEnabled">` — Hidden habit enabled checkbox
- [ ] `<button id="habitToggleBtn" onclick="onHabitToggle()">` — Habit toggle button in Task zone header
- [ ] `onHabitToggle()` — Toggles habit mode (forces date mode, all-day, repeat; shows habit controls)
- [ ] `<input type="number" id="habitGoal" min="1">` — Habit goal input
- [ ] `<select id="habitFrequency">` — Habit frequency (DAILY/WEEKLY/MONTHLY/YEARLY)
- [ ] `onHabitFrequencyChange()` — Syncs habit frequency to recurrence dropdown
- [ ] `onHabitGoalChange()` — Clamps goal to min 1, updates progress display
- [ ] `_updateHabitProgressDisplay()` — Updates "X / Y" progress display and counter
- [ ] `_updateResetUnitOptions()` — Rebuilds reset unit dropdown based on cycle frequency

### Habit Reset Period (editor-dates.js + editor.html)

- [ ] `<input type="checkbox" id="habitResetEnabled" onchange="onHabitResetToggle()">` — Reset enabled checkbox
- [ ] `<input type="number" id="habitResetValue" min="1">` — Reset value input
- [ ] `<select id="habitResetUnit">` — Reset unit dropdown (DAILY/WEEKLY/MONTHLY)
- [ ] `onHabitResetToggle()` — Shows/hides reset value and unit inputs

### Habit Calendar & Display (editor.html)

- [ ] `<input type="checkbox" id="showOnCalendar" checked>` — Show on calendar checkbox
- [ ] `<input type="checkbox" id="habitHideOverall" checked>` — Show overall % in view checkbox

### Timezone Picker (editor-dates.js)

- [ ] `_initTimezonePicker()` — Initializes timezone picker modal, populates datalist, wires events
- [ ] `_openTzPickerModal()` — Opens timezone picker modal
- [ ] `_closeTzPickerModal()` — Closes timezone picker modal
- [ ] `_onTimezoneModalInputChange()` — Validates timezone input, auto-closes on valid selection
- [ ] `_onTzModalSelect(tz)` — Applies timezone selection
- [ ] `_onTzModalClear()` — Clears timezone (reverts to floating)
- [ ] `_onTimezoneInputSubmit()` — Handles Enter key (geocode if not a known timezone)
- [ ] `_geocodeForTimezone(query)` — Geocodes address to detect timezone
- [ ] `_isValidTimezone(tz)` — Validates against Intl.supportedValuesOf
- [ ] `_loadTimezoneValue(tz)` — Loads timezone from chit data
- [ ] `_getTimezoneValue()` — Returns current timezone value
- [ ] `_getTimezoneAbbreviation(ianaTimezone)` — Gets short abbreviation (e.g., "MST")
- [ ] `_getTimezoneLongName(ianaTimezone)` — Gets long name (e.g., "Mountain Standard Time")
- [ ] `_injectTzAbbrevLabels()` — Injects timezone abbreviation labels into date rows
- [ ] `_updateTzAbbrevLabels()` — Updates label text/style (floating vs anchored)
- [ ] `_onTzAbbrevClick(e)` — Click handler on abbreviation label opens modal
- [ ] `_buildTzTooltip(ianaTimezone)` — Builds multi-line tooltip for timezone
- [ ] `_updateTimezoneRowVisibility()` — Updates timezone label visibility on date mode change

### Timezone Suggestion (editor-dates.js)

- [ ] `_showTimezoneSuggestion(detectedTz)` — Shows suggestion prompt when location detects different TZ
- [ ] `_acceptTimezoneSuggestion(detectedTz)` — Accepts suggestion, sets timezone
- [ ] `_dismissTimezoneSuggestion()` — Dismisses suggestion prompt

### Utility Functions (editor-dates.js)

- [ ] `clearStartAndEndDates()` — Clears all start/end date and time fields
- [ ] `clearDueDate()` — Clears due date and time fields
- [ ] `_loadSnapSetting()` — Loads time snap setting from user settings
- [ ] `var _snapMinutes` — Time snap interval (default 15)
- [ ] `var _dateModeSuppressUnsaved` — Flag to suppress unsaved marking during init
