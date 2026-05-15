/**
 * editor-dates.js — Date mode system, recurrence, and time picker
 *
 * Handles the date mode radio buttons (Start/End, Due, None), the all-day
 * toggle, the recurrence picker (simple presets + custom), the time-input
 * snap dropdown, and date-clearing helpers.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, getCachedSettings, convertMonthFormat)
 * Loaded before: editor-init.js, editor.js
 */

// ── Date mode radio buttons ──────────────────────────────────────────────────
var _dateModeSuppressUnsaved = false; // suppress during init (var for cross-script access)

function onDateModeChange() {
  const mode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
  const startEndFields = document.getElementById('startEndFields');
  const dueFields = document.getElementById('dueFields');
  const perpetualFields = document.getElementById('perpetualFields');
  const pointInTimeFields = document.getElementById('pointInTimeFields');
  const recurrenceFields = document.getElementById('recurrenceFields');
  const alldayRow = document.getElementById('alldayRepeatRow');
  const _habitActive = document.getElementById('habitEnabled');
  const _isHabitOn = _habitActive && _habitActive.checked;

  // Show/hide input fields based on selected mode (hide non-selected, show selected)
  if (startEndFields) startEndFields.style.display = (mode === 'startend') ? '' : 'none';
  if (dueFields) dueFields.style.display = (mode === 'due') ? '' : 'none';
  if (perpetualFields) perpetualFields.style.display = (mode === 'perpetual') ? '' : 'none';
  if (pointInTimeFields) pointInTimeFields.style.display = (mode === 'pointintime') ? '' : 'none';

  if (recurrenceFields) {
    recurrenceFields.classList.toggle('greyed-out', mode === 'none' || mode === 'pointintime');
  }
  if (alldayRow) {
    alldayRow.style.display = (mode === 'none' || mode === 'pointintime') ? 'none' : '';
  }

  // Handle perpetual mode: set start date to today, clear end date
  if (mode === 'perpetual') {
    var startDateInput = document.getElementById('start_datetime');
    if (startDateInput && !startDateInput.value) {
      var now = new Date();
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      startDateInput.value = now.getFullYear() + '-' + months[now.getMonth()] + '-' + String(now.getDate()).padStart(2, '0');
    }
    var endDateInput = document.getElementById('end_datetime');
    var endTimeInput = document.getElementById('end_time');
    if (endDateInput) endDateInput.value = '';
    if (endTimeInput) endTimeInput.value = '';
    // Update description with start date
    var descEl = document.getElementById('perpetualDescription');
    if (descEl && startDateInput && typeof _fmtPerpetualDate === 'function') {
      var dateFmt = _fmtPerpetualDate(startDateInput.value);
      descEl.textContent = dateFmt
        ? 'Starts now, continues forever. (Started ' + dateFmt + '.)'
        : 'Starts now, continues forever';
    }
  }

  // Handle Point in Time mode: default to now if empty
  if (mode === 'pointintime') {
    var pitDateInput = document.getElementById('point_in_time_date');
    if (pitDateInput && !pitDateInput.value) {
      setPointInTimeNow();
    }
  }

  // Always hide None row when habit is active
  var noneRow = document.getElementById('dateModeNoneRow');
  if (_isHabitOn && noneRow) noneRow.style.display = 'none';

  // Show/hide All Day button based on whether a date mode is active (not for Point in Time)
  var allDayBtn = document.getElementById('allDayToggleBtn');
  if (allDayBtn) allDayBtn.style.display = (mode === 'none' || mode === 'pointintime') ? 'none' : '';

  // Hide repeat row unless a date mode is active — also keep hidden when habit is active or Point in Time
  const repeatRow = document.getElementById('repeatCheckboxRow');
  const repeatOptions = document.getElementById('repeatOptionsBlock');
  if (repeatRow) repeatRow.style.display = (mode === 'none' || mode === 'pointintime' || _isHabitOn) ? 'none' : '';
  if ((mode === 'none' || mode === 'pointintime' || _isHabitOn) && repeatOptions) repeatOptions.style.display = 'none';

  // Re-apply all-day visibility for the active mode
  const allDayCheckbox = document.getElementById("allDay");
  if (allDayCheckbox && allDayCheckbox.checked && !window._allDayAutoDefaulted) {
    toggleAllDay();
  } else if (!allDayCheckbox || !allDayCheckbox.checked) {
    // Show all time inputs when not all-day
    document.querySelectorAll('#startEndFields .time-input').forEach(i => { i.style.display = ''; });
    const sep = document.querySelector('#startEndFields .date-mode-separator');
    if (sep) sep.style.display = '';
    const dueTime = document.getElementById('due_time');
    if (dueTime) dueTime.style.display = '';
  }

  // Auto-default to all-day when a date mode is first activated
  if (!_dateModeSuppressUnsaved && (mode === 'due' || mode === 'startend' || mode === 'perpetual')) {
    if (allDayCheckbox && !allDayCheckbox.checked) {
      window._allDayAutoDefaulted = true;
      allDayCheckbox.checked = true;
      // Don't call toggleAllDay — keep time inputs visible
      _updateAllDayBtnState();
    }
  }

  // Update recurrence labels when date context changes
  _updateRecurrenceLabels();

  // Show/hide timezone row based on date mode
  _updateTimezoneRowVisibility();

  // Auto-populate default notifications for NEW chits when a date mode is first activated
  if (!_dateModeSuppressUnsaved && window.isNewChit && mode !== 'none') {
    _applyDefaultNotifications(mode);
  }

  // Re-render notifications so direction options update based on new date mode
  if (!_dateModeSuppressUnsaved && typeof renderNotificationsContainer === 'function') {
    renderNotificationsContainer();
  }

  if (!_dateModeSuppressUnsaved) setSaveButtonUnsaved();
}

/** Sync the Due Complete checkbox when status dropdown changes */
function onStatusChange() {
  const statusSel = document.getElementById('status');

  // Prevent clearing status on a child chit (it would orphan it from the project)
  if (statusSel && !statusSel.value && window._cwocParentProjectId) {
    cwocConfirm(
      'Removing the status will also remove this chit from its project.\n\nContinue?',
      { title: 'Remove Status', confirmLabel: 'Remove & Unlink', danger: true }
    ).then(function(ok) {
      if (ok) {
        // Clear the project membership
        window._pendingProjectRemoval = { projectId: window._cwocParentProjectId, chitId: chitId };
        window._cwocParentProjectId = '';
        var label = document.getElementById('moveToProjectLabel');
        if (label) label.textContent = 'Add to Project…';
        var removeBtn = document.getElementById('removeFromProjectBtn');
        if (removeBtn) removeBtn.style.display = 'none';
        setSaveButtonUnsaved();
        cwocToast('Status cleared — project removal pending on save.', 'info');
      } else {
        // Revert to ToDo
        statusSel.value = 'ToDo';
      }
    });
    return;
  }

  // Check prerequisite override warning
  if (typeof checkPrereqStatusOverride === 'function' && statusSel && statusSel.value !== 'Blocked') {
    var newVal = statusSel.value;
    checkPrereqStatusOverride(newVal).then(function(ok) {
      if (!ok) {
        statusSel.value = 'Blocked';
      } else {
        setSaveButtonUnsaved();
      }
    });
    return;
  }

  setSaveButtonUnsaved();
}

function _detectDateMode(chit) {
  const hasDue = !!(chit.due_datetime);
  const hasStart = !!(chit.start_datetime);
  const hasPointInTime = !!(chit.point_in_time);
  if (hasDue) return 'due';
  if (hasStart) return 'startend';
  if (hasPointInTime) return 'pointintime';
  return 'none';
}

// Set the radio button and apply greying
function _setDateMode(mode) {
  var radioId = 'dateModeNone';
  if (mode === 'due') radioId = 'dateModeDue';
  else if (mode === 'startend') radioId = 'dateModeStartEnd';
  else if (mode === 'perpetual') radioId = 'dateModePerpetual';
  else if (mode === 'pointintime') radioId = 'dateModePointInTime';
  var radio = document.getElementById(radioId);
  if (radio) radio.checked = true;
  onDateModeChange();
}

function toggleAllDay() {
  const allDayCheckbox = document.getElementById("allDay");
  if (!allDayCheckbox) return;
  const allDay = allDayCheckbox.checked;

  // If all-day was auto-defaulted (initial creation), keep time inputs visible
  if (window._allDayAutoDefaulted && allDay) return;

  // Hide/show time inputs for ALL date modes (All Day is global)
  const startEndTimes = document.querySelectorAll('#startEndFields .time-input');
  startEndTimes.forEach(input => { input.style.display = allDay ? 'none' : ''; });
  // Keep the "to" separator visible between date fields
  const sep = document.querySelector('#startEndFields .date-mode-separator');
  if (sep) sep.style.display = '';

  const dueTime = document.getElementById('due_time');
  if (dueTime) dueTime.style.display = allDay ? 'none' : '';

  if (!_dateModeSuppressUnsaved) setSaveButtonUnsaved();
}

// ── Time picker (now handled by shared-timepicker.js drum roller) ────────────
var _snapMinutes = 15; // default, loaded from settings (var for cross-script access)

// ── Recurrence picker ─────────────────────────────────────────────────────────

/** Update recurrence dropdown labels based on the current date context */
function _updateRecurrenceLabels() {
  const sel = document.getElementById('recurrence');
  if (!sel) return;

  // Get the active date for context
  const mode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
  let refDate = null;
  if (typeof convertMonthFormat === 'function') {
    if (mode === 'startend') {
      const v = document.getElementById('start_datetime')?.value;
      if (v) refDate = new Date(convertMonthFormat(v) + 'T12:00:00');
    } else if (mode === 'due') {
      const v = document.getElementById('due_datetime')?.value;
      if (v) refDate = new Date(convertMonthFormat(v) + 'T12:00:00');
    }
  }
  if (!refDate || isNaN(refDate.getTime())) refDate = new Date();

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = dayNames[refDate.getDay()];
  const monthName = monthNames[refDate.getMonth()];
  const dayOfMonth = refDate.getDate();
  const ordinal = dayOfMonth === 1 || dayOfMonth === 21 || dayOfMonth === 31 ? 'st' : dayOfMonth === 2 || dayOfMonth === 22 ? 'nd' : dayOfMonth === 3 || dayOfMonth === 23 ? 'rd' : 'th';

  // When habit is active, use simplified labels (no "on Saturday" etc.)
  var habitCb = document.getElementById('habitEnabled');
  var isHabit = habitCb && habitCb.checked;

  Array.from(sel.options).forEach(opt => {
    switch (opt.value) {
      case 'DAILY': opt.textContent = 'Daily'; break;
      case 'WEEKLY': opt.textContent = isHabit ? 'Weekly' : 'Weekly on ' + dayName; break;
      case 'MONTHLY': opt.textContent = isHabit ? 'Monthly' : 'Monthly on the ' + dayOfMonth + ordinal; break;
      case 'YEARLY': opt.textContent = isHabit ? 'Yearly' : 'Yearly on ' + monthName + ' ' + dayOfMonth + ordinal; break;
      case 'CUSTOM': opt.textContent = 'Custom…'; break;
    }
  });
}

function onRecurrenceChange() {
  const sel = document.getElementById('recurrence');
  const customRow = document.getElementById('recurrenceCustomRow');
  const block = document.getElementById('repeatOptionsBlock');
  const icon = document.getElementById('recurrenceIcon');

  const isCustom = sel && sel.value === 'CUSTOM';
  if (customRow) customRow.style.display = isCustom ? '' : 'none';
  // Show/hide the custom details block
  if (block) block.style.display = isCustom ? 'table-row-group' : 'none';
  const intervalEl = document.getElementById('recurrenceInterval');
  const freqEl = document.getElementById('recurrenceFreq');
  if (intervalEl) intervalEl.style.display = isCustom ? '' : 'none';
  if (freqEl) freqEl.style.display = isCustom ? '' : 'none';

  if (icon) icon.style.display = (document.getElementById('repeatEnabled')?.checked) ? '' : 'none';

  onRecurrenceFreqChange();
  setSaveButtonUnsaved();
}

/** Toggle repeat options visibility */
function onRepeatToggle() {
  const cb = document.getElementById('repeatEnabled');
  const inlineOpts = document.getElementById('repeatOptionsInline');
  const block = document.getElementById('repeatOptionsBlock');
  const icon = document.getElementById('recurrenceIcon');
  const isChecked = cb && cb.checked;
  // Show/hide the inline dropdown + ends-never
  if (inlineOpts) inlineOpts.style.display = isChecked ? 'inline' : 'none';
  // Update labels based on current date
  if (isChecked) _updateRecurrenceLabels();
  // Show/hide the custom details block (only if Custom is selected)
  const sel = document.getElementById('recurrence');
  if (block) block.style.display = (isChecked && sel && sel.value === 'CUSTOM') ? 'table-row-group' : 'none';
  if (icon) icon.style.display = isChecked ? '' : 'none';
  setSaveButtonUnsaved();
}

function onRecurrenceFreqChange() {
  const byDayDiv = document.getElementById('recurrenceByDay');
  const sel = document.getElementById('recurrence');
  const freq = document.getElementById('recurrenceFreq')?.value;
  const isCustomWeekly = sel?.value === 'CUSTOM' && freq === 'WEEKLY';
  if (byDayDiv) byDayDiv.style.display = isCustomWeekly ? 'flex' : 'none';
  setSaveButtonUnsaved();
}

function onRecurrenceEndsToggle() {
  const neverCb = document.getElementById('recurrenceEndsNever');
  const dateWrap = document.getElementById('recurrenceEndsDateWrap');
  if (dateWrap) dateWrap.style.display = neverCb && neverCb.checked ? 'none' : '';
  if (neverCb && neverCb.checked) {
    const untilEl = document.getElementById('recurrenceUntil');
    if (untilEl) untilEl.value = '';
  }
  setSaveButtonUnsaved();
}

function _onRecurrenceFreqChange() { onRecurrenceFreqChange(); }
function _updateByDayVisibility() { onRecurrenceFreqChange(); }
function onRecurrenceToggle() { onRecurrenceChange(); }

function _buildRecurrenceRule() {
  const enabled = document.getElementById('repeatEnabled')?.checked;
  if (!enabled) return null;

  const sel = document.getElementById('recurrence');
  const freq = sel ? sel.value : 'DAILY';
  const until = document.getElementById('recurrenceUntil')?.value || null;
  const endsNever = document.getElementById('recurrenceEndsNever')?.checked;

  if (freq === 'CUSTOM') {
    const customFreq = document.getElementById('recurrenceFreq')?.value || 'WEEKLY';
    const interval = parseInt(document.getElementById('recurrenceInterval')?.value) || 1;
    const byDay = [];
    if (customFreq === 'WEEKLY') {
      document.querySelectorAll('#recurrenceByDay input:checked').forEach(cb => byDay.push(cb.value));
    }
    const rule = { freq: customFreq, interval };
    if (byDay.length > 0) rule.byDay = byDay;
    if (!endsNever && until) rule.until = until;
    return rule;
  }

  const rule = { freq, interval: 1 };
  if (!endsNever && until) rule.until = until;
  return rule;
}

function _loadRecurrenceRule(rule) {
  const repeatCb = document.getElementById('repeatEnabled');
  const sel = document.getElementById('recurrence');
  if (!repeatCb || !sel) return;

  if (!rule || !rule.freq) {
    repeatCb.checked = false;
    onRepeatToggle();
    return;
  }

  // Enable repeat
  repeatCb.checked = true;
  onRepeatToggle();

  // Load until
  const neverCb = document.getElementById('recurrenceEndsNever');
  const dateWrap = document.getElementById('recurrenceEndsDateWrap');
  if (rule.until) {
    const untilEl = document.getElementById('recurrenceUntil');
    if (untilEl) untilEl.value = rule.until;
    if (neverCb) neverCb.checked = false;
    if (dateWrap) dateWrap.style.display = '';
  } else {
    if (neverCb) neverCb.checked = true;
    if (dateWrap) dateWrap.style.display = 'none';
  }

  // Simple preset?
  const isSimple = (rule.interval || 1) === 1 && (!rule.byDay || rule.byDay.length === 0);
  if (isSimple && ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) {
    sel.value = rule.freq;
  } else {
    sel.value = 'CUSTOM';
    const freqEl = document.getElementById('recurrenceFreq');
    const intervalEl = document.getElementById('recurrenceInterval');
    if (freqEl) freqEl.value = rule.freq;
    if (intervalEl) intervalEl.value = rule.interval || 1;
    if (rule.byDay) {
      rule.byDay.forEach(d => {
        const cb = document.querySelector(`#recurrenceByDay input[value="${d}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  onRecurrenceChange();
}

async function _loadSnapSetting() {
  try {
    const settings = await getCachedSettings();
    if (settings.calendar_snap && parseInt(settings.calendar_snap) > 0) {
      _snapMinutes = parseInt(settings.calendar_snap);
    }
  } catch (e) { /* use default */ }
}

// _showTimeDropdown removed — replaced by cwocTimePicker drum roller

function clearStartAndEndDates() {
  document.getElementById("start_datetime").value = "";
  document.getElementById("start_time").value = "";
  document.getElementById("end_datetime").value = "";
  document.getElementById("end_time").value = "";
}

function clearDueDate() {
  document.getElementById("due_datetime").value = "";
  document.getElementById("due_time").value = "";
}

// ── Habit toggle & controls ──────────────────────────────────────────────────

/**
 * Handle "Track as habit" checkbox toggle.
 * When checked: auto-enable Repeat with Daily if not already on, reveal
 * habit controls, lock Repeat checkbox.
 * When unchecked: hide habit controls, unlock Repeat checkbox.
 */
function onHabitToggle() {
  var habitCb = document.getElementById('habitEnabled');
  var controlsRow = document.getElementById('habitControlsRow');
  var calendarRow = document.getElementById('habitCalendarRow');
  var repeatCb = document.getElementById('repeatEnabled');
  var repeatRow = document.getElementById('repeatCheckboxRow');
  var repeatBlock = document.getElementById('repeatOptionsBlock');
  var allDayCb = document.getElementById('allDay');
  var dateModeNone = document.getElementById('dateModeNone');
  var habitFreqSel = document.getElementById('habitFrequency');
  var recurrenceSel = document.getElementById('recurrence');
  var toggleBtn = document.getElementById('habitToggleBtn');
  var recurrenceIcon = document.getElementById('recurrenceIcon');

  // Toggle the hidden checkbox state
  if (habitCb) habitCb.checked = !habitCb.checked;
  var isHabit = habitCb && habitCb.checked;

  // Update button appearance
  if (toggleBtn) {
    if (isHabit) {
      toggleBtn.style.background = '#008080';
      toggleBtn.style.color = '#fff8e1';
      toggleBtn.style.borderColor = '#006060';
      toggleBtn.textContent = '🎯 Habit ✓';
    } else {
      toggleBtn.style.background = '';
      toggleBtn.style.color = '';
      toggleBtn.style.borderColor = '';
      toggleBtn.textContent = '🎯 Habit';
    }
  }

  if (isHabit) {
    // Force a date mode if currently "none"
    var currentMode = document.querySelector('input[name="dateMode"]:checked');
    if (currentMode && currentMode.value === 'none') {
      var startEndRadio = document.getElementById('dateModeStartEnd');
      if (startEndRadio) startEndRadio.checked = true;
      onDateModeChange();
    }

    // Force all-day and lock it
    if (allDayCb && !allDayCb.checked) {
      allDayCb.checked = true;
      toggleAllDay();
    }
    if (allDayCb) {
      allDayCb.disabled = true;
      allDayCb.title = 'Habits are always all-day';
    }
    // Update All Day button to show active+disabled state
    _updateAllDayBtnState();

    // Update recurrence icon to show habit target instead of repeat
    if (recurrenceIcon) {
      recurrenceIcon.textContent = '🎯';
      recurrenceIcon.title = 'Habit';
      recurrenceIcon.style.display = '';
    }

    // Lock and hide the "none" date mode row
    if (dateModeNone) {
      dateModeNone.disabled = true;
      dateModeNone.title = 'Habits require a date';
    }
    var noneRow = document.getElementById('dateModeNoneRow');
    if (noneRow) noneRow.style.display = 'none';

    // Show the Due row for habits — "do X times before date Y"
    // (Due mode for habits = start now, end on due date)

    // Auto-enable Repeat if not already on, sync frequency
    if (repeatCb && !repeatCb.checked) {
      repeatCb.checked = true;
      if (recurrenceSel) recurrenceSel.value = habitFreqSel ? habitFreqSel.value : 'DAILY';
      onRepeatToggle();
    } else if (recurrenceSel && habitFreqSel) {
      var curFreq = recurrenceSel.value;
      if (['DAILY','WEEKLY','MONTHLY','YEARLY'].indexOf(curFreq) !== -1) {
        habitFreqSel.value = curFreq;
      }
    }

    // Set "ends never" since end date is handled by the start/end date fields
    var endsNeverCb = document.getElementById('recurrenceEndsNever');
    if (endsNeverCb && !endsNeverCb.checked) {
      endsNeverCb.checked = true;
      onRecurrenceEndsToggle();
    }

    // Hide the repeat row entirely — habit controls row subsumes it
    if (repeatRow) repeatRow.style.display = 'none';
    if (repeatBlock) repeatBlock.style.display = 'none';

    // Show habit controls row and calendar row
    if (controlsRow) controlsRow.style.display = '';
    if (calendarRow) calendarRow.style.display = '';

    // Show perpetual radio option (only for habits)
    var perpetualRow = document.getElementById('perpetualRow');
    if (perpetualRow) perpetualRow.style.display = '';

    // Auto-collapse Task zone when habit is toggled on
    var taskSection = document.getElementById('taskSection');
    var taskContent = document.getElementById('taskContent');
    if (taskSection && taskContent) {
      taskContent.style.display = 'none';
      taskSection.classList.add('collapsed');
      var tIcon = taskSection.querySelector('.zone-toggle-icon');
      if (tIcon) tIcon.textContent = '🔽';
    }

    // Header counter will be built by _updateHabitProgressDisplay

    // Show reset period and hide overall rows
    var resetRow = document.getElementById('habitResetRow');
    var habitFreqSel = document.getElementById('habitFrequency');
    var cycleFreq = habitFreqSel ? habitFreqSel.value : 'DAILY';
    // Hide reset row for DAILY habits (no smaller unit available)
    if (resetRow) resetRow.style.display = (cycleFreq === 'DAILY') ? 'none' : '';
    var hideOverallRow = document.getElementById('habitHideOverallRow');
    if (hideOverallRow) hideOverallRow.style.display = '';

    // Update reset unit options based on cycle frequency
    _updateResetUnitOptions();

    // Update progress display
    _updateHabitProgressDisplay();

    // Expand the Settings section in the Habits zone
    var habitSettingsBody = document.getElementById('habitSettingsBody');
    if (habitSettingsBody) habitSettingsBody.style.display = '';

    // Auto-expand Dates zone when habit is toggled on
    var datesSection = document.getElementById('datesSection');
    var datesContent = document.getElementById('datesContent');
    if (datesSection && datesContent) {
      datesContent.style.display = '';
      datesSection.classList.remove('collapsed');
      var dIcon = datesSection.querySelector('.zone-toggle-icon');
      if (dIcon) dIcon.textContent = '🔼';
    }
  } else {
    // Unlock all-day checkbox
    if (allDayCb) {
      allDayCb.disabled = false;
      allDayCb.title = '';
    }
    // Update All Day button to reflect unlocked state
    _updateAllDayBtnState();

    // Restore recurrence icon to repeat symbol
    if (recurrenceIcon) {
      recurrenceIcon.textContent = '🔁';
      recurrenceIcon.title = 'Recurring chit';
      // Only show if repeat is actually enabled
      var _repeatOn = document.getElementById('repeatEnabled');
      recurrenceIcon.style.display = (_repeatOn && _repeatOn.checked) ? '' : 'none';
    }

    // Unlock and show the "none" date mode row
    if (dateModeNone) {
      dateModeNone.disabled = false;
      dateModeNone.title = '';
    }
    var noneRow = document.getElementById('dateModeNoneRow');
    if (noneRow) noneRow.style.display = '';

    // Uncheck repeat (habit was managing it) but show the row so user can re-enable manually
    if (repeatCb) {
      repeatCb.checked = false;
      onRepeatToggle();
    }
    var activeMode = document.querySelector('input[name="dateMode"]:checked');
    if (repeatRow && activeMode && activeMode.value !== 'none') {
      repeatRow.style.display = '';
    }

    // Hide habit controls row and calendar row
    if (controlsRow) controlsRow.style.display = 'none';
    if (calendarRow) calendarRow.style.display = 'none';

    // Hide perpetual row
    var perpetualRow = document.getElementById('perpetualRow');
    if (perpetualRow) perpetualRow.style.display = 'none';

    // Hide reset period and hide overall rows
    var resetRow = document.getElementById('habitResetRow');
    if (resetRow) resetRow.style.display = 'none';
    var hideOverallRow = document.getElementById('habitHideOverallRow');
    if (hideOverallRow) hideOverallRow.style.display = 'none';

    // Restore recurrence labels to normal format
    _updateRecurrenceLabels();
  }

  // Toggle Habit Log zone visibility
  if (typeof _toggleHabitLogZone === 'function') {
    _toggleHabitLogZone(isHabit);
  }

  // Re-render notifications so timing dropdown reflects habit/non-habit mode
  if (typeof renderNotificationsContainer === 'function') {
    renderNotificationsContainer();
  }

  setSaveButtonUnsaved();
}

/**
 * Handle habit frequency dropdown change — sync to the hidden recurrence dropdown.
 */
function onHabitFrequencyChange() {
  var habitFreqSel = document.getElementById('habitFrequency');
  var recurrenceSel = document.getElementById('recurrence');
  if (habitFreqSel && recurrenceSel) {
    recurrenceSel.value = habitFreqSel.value;
    onRecurrenceChange();
  }
  // Update reset unit options — limit to one level smaller than cycle
  _updateResetUnitOptions();
  // Hide reset row for DAILY habits
  var resetRow = document.getElementById('habitResetRow');
  if (resetRow) resetRow.style.display = (habitFreqSel && habitFreqSel.value === 'DAILY') ? 'none' : '';
  // Re-render notifications so "before end of [period]" label updates
  if (typeof renderNotificationsContainer === 'function') {
    renderNotificationsContainer();
  }
  setSaveButtonUnsaved();
}

/**
 * Update the reset unit dropdown options based on the cycle frequency.
 * Reset units must be smaller than the cycle:
 * - DAILY cycle → no reset (hide row)
 * - WEEKLY cycle → Day(s) only
 * - MONTHLY cycle → Day(s), Week(s)
 * - YEARLY cycle → Day(s), Week(s), Month(s)
 */
function _updateResetUnitOptions() {
  var habitFreqSel = document.getElementById('habitFrequency');
  var resetUnitSel = document.getElementById('habitResetUnit');
  if (!habitFreqSel || !resetUnitSel) return;

  var freq = habitFreqSel.value;
  var currentVal = resetUnitSel.value;

  // Clear and rebuild options
  resetUnitSel.innerHTML = '<option value="">— None —</option>';

  if (freq === 'WEEKLY') {
    resetUnitSel.innerHTML += '<option value="DAILY">Day(s)</option>';
  } else if (freq === 'MONTHLY') {
    resetUnitSel.innerHTML += '<option value="DAILY">Day(s)</option>';
    resetUnitSel.innerHTML += '<option value="WEEKLY">Week(s)</option>';
  } else if (freq === 'YEARLY') {
    resetUnitSel.innerHTML += '<option value="DAILY">Day(s)</option>';
    resetUnitSel.innerHTML += '<option value="WEEKLY">Week(s)</option>';
    resetUnitSel.innerHTML += '<option value="MONTHLY">Month(s)</option>';
  }
  // DAILY cycle → no reset options (just "None")

  // Restore previous value if still valid
  var options = Array.from(resetUnitSel.options).map(function(o) { return o.value; });
  if (options.indexOf(currentVal) !== -1) {
    resetUnitSel.value = currentVal;
  } else {
    resetUnitSel.value = '';
  }
}

/** Update the "X / Y" progress display from current field values */
function _updateHabitProgressDisplay() {
  var goalEl = document.getElementById('habitGoal');
  var display = document.getElementById('habitProgressDisplay');
  var logHeaderCounter = document.getElementById('habitLogHeaderCounter');
  var goal = goalEl ? (parseInt(goalEl.value) || 1) : 1;
  var success = window._currentHabitSuccess || 0;

  // Update the simple text display in the controls row
  if (display) display.textContent = success + ' / ' + goal;

  // Shared callback for increment/decrement
  function _onInc(newVal) {
    window._currentHabitSuccess = newVal;
    if (display) display.textContent = newVal + ' / ' + goal;
    // Rebuild all counters to sync
    _updateHabitProgressDisplay();
    setSaveButtonUnsaved();
  }
  function _onDec(newVal) {
    window._currentHabitSuccess = newVal;
    if (display) display.textContent = newVal + ' / ' + goal;
    _updateHabitProgressDisplay();
    setSaveButtonUnsaved();
  }

  var counterOpts = {
    success: success,
    goal: goal,
    freqLabel: '',
    disabled: false,
    onIncrement: _onInc,
    onDecrement: _onDec
  };

  // Build counter in Habit Log zone header
  if (logHeaderCounter && typeof _buildHabitCounter === 'function') {
    logHeaderCounter.innerHTML = '';
    logHeaderCounter.appendChild(_buildHabitCounter(counterOpts));
  }
}

/** Handle goal input change — clamp to min 1 and update progress display */
function onHabitGoalChange() {
  var goalEl = document.getElementById('habitGoal');
  if (goalEl) {
    var val = parseInt(goalEl.value);
    if (!val || val < 1) {
      goalEl.value = 1;
    }
  }
  _updateHabitProgressDisplay();
  setSaveButtonUnsaved();
}

// ── All Day button toggle ────────────────────────────────────────────────────

/** Toggle the All Day button — mirrors the hidden checkbox and calls toggleAllDay() */
function _toggleAllDayBtn() {
  var allDayCb = document.getElementById('allDay');
  if (!allDayCb || allDayCb.disabled) return;
  // User explicitly toggled — clear auto-default flag
  window._allDayAutoDefaulted = false;
  allDayCb.checked = !allDayCb.checked;
  toggleAllDay();
  _updateAllDayBtnState();
}

/** Sync the All Day button appearance from the hidden checkbox state */
function _updateAllDayBtnState() {
  var allDayCb = document.getElementById('allDay');
  var btn = document.getElementById('allDayToggleBtn');
  if (!btn) return;
  var isChecked = allDayCb && allDayCb.checked;
  var isDisabled = allDayCb && allDayCb.disabled;
  if (isChecked) {
    btn.style.background = '#008080';
    btn.style.color = '#fff8e1';
    btn.style.borderColor = '#006060';
    btn.textContent = '🗓️ All Day ✓';
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.textContent = '🗓️ All Day';
  }
  if (isDisabled) {
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    btn.title = 'Habits are always all-day';
  } else {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    btn.title = 'Toggle all-day';
  }
}


// ── Perpetual toggle ─────────────────────────────────────────────────────

// ── Habit reset toggle ───────────────────────────────────────────────────

/**
 * Handle the Reset checkbox toggle.
 * When unchecked: hide the number and unit inputs.
 * When checked: show them.
 */
function onHabitResetToggle() {
  var cb = document.getElementById('habitResetEnabled');
  var valEl = document.getElementById('habitResetValue');
  var unitEl = document.getElementById('habitResetUnit');
  var isOn = cb && cb.checked;
  if (valEl) valEl.style.display = isOn ? '' : 'none';
  if (unitEl) unitEl.style.display = isOn ? '' : 'none';
  setSaveButtonUnsaved();
}

// ── Perpetual toggle ─────────────────────────────────────────────────────

/**
 * Handle the Perpetual checkbox toggle.
 * When checked: set start date to today, clear end date, disable end date input,
 * set date mode to startend if not already.
 * When unchecked: re-enable end date input.
 */
function onPerpetualToggle() {
  // Legacy — perpetual is now a radio option handled by onDateModeChange
  onDateModeChange();
}

/**
 * Format a date string for the perpetual description.
 * Handles "YYYY-Mon-DD" format (e.g. "2026-May-02") → "May 2, 2026".
 */
function _fmtPerpetualDate(raw) {
  if (!raw) return '';
  var parts = raw.split('-');
  if (parts.length === 3) {
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var monthIdx = monthNames.indexOf(parts[1]);
    if (monthIdx !== -1) {
      var fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return fullMonths[monthIdx] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
    }
    return raw;
  }
  return raw;
}

// ── Point in Time ────────────────────────────────────────────────────────────

/** Set the Point in Time fields to the current date and time */
function setPointInTimeNow() {
  var now = new Date();
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var dateStr = now.getFullYear() + '-' + months[now.getMonth()] + '-' + String(now.getDate()).padStart(2, '0');
  var dateInput = document.getElementById('point_in_time_date');
  var timeBtn = document.getElementById('point_in_time_time');
  if (dateInput) dateInput.value = dateStr;
  if (timeBtn) {
    var h = now.getHours();
    var m = now.getMinutes();
    // Store 24-hour value in dataset.time so the time picker reads it correctly
    var raw24 = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    timeBtn.dataset.time = raw24;
    timeBtn.classList.toggle('cwoc-time-btn-empty', false);
    // Display formatted for user's time preference
    var timeFormat = (typeof window._editorTimeFormat !== 'undefined') ? window._editorTimeFormat
                   : (typeof window._globalTimeFormat !== 'undefined') ? window._globalTimeFormat
                   : '24hour';
    if (timeFormat === '12hour' || timeFormat === '12houranalog') {
      var ampm = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 || 12;
      timeBtn.textContent = h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    } else {
      timeBtn.textContent = raw24;
    }
  }
  setSaveButtonUnsaved();
}

/** Clear the Point in Time fields */
function clearPointInTime() {
  var dateInput = document.getElementById('point_in_time_date');
  var timeBtn = document.getElementById('point_in_time_time');
  if (dateInput) dateInput.value = '';
  if (timeBtn) {
    timeBtn.dataset.time = '';
    timeBtn.textContent = 'HH:MM';
    timeBtn.classList.toggle('cwoc-time-btn-empty', true);
  }
  setSaveButtonUnsaved();
}

// ── Auto-deselect All Day when a time is entered ─────────────────────────────

/**
 * Wire up change listeners on time inputs so that when the user picks a time,
 * all-day is automatically deselected.
 * Called once from editor-init.js after DOM is ready.
 */
function _wireAllDayAutoDeselect() {
  var timeIds = ['start_time', 'end_time', 'due_time'];
  timeIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        var allDayCb = document.getElementById('allDay');
        if (allDayCb && allDayCb.checked && !allDayCb.disabled) {
          window._allDayAutoDefaulted = false;
          allDayCb.checked = false;
          toggleAllDay();
          _updateAllDayBtnState();
        }
      });
    }
  });
}

// ── Timezone picker (modal-based) ────────────────────────────────────────────

/**
 * Get the short timezone abbreviation for today's date in the given timezone.
 * Uses Intl.DateTimeFormat with timeZoneName: 'short'.
 * @param {string} ianaTimezone - IANA timezone identifier
 * @returns {string} Short abbreviation (e.g., "MST", "PST") or empty string
 */
function _getTimezoneAbbreviation(ianaTimezone) {
  try {
    var now = new Date();
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'short'
    });
    var parts = formatter.formatToParts(now);
    var tzPart = parts.find(function(p) { return p.type === 'timeZoneName'; });
    return tzPart ? tzPart.value : '';
  } catch (e) {
    return '';
  }
}

/**
 * Get the long timezone name for a given IANA timezone.
 * Uses Intl.DateTimeFormat with timeZoneName: 'long'.
 * @param {string} ianaTimezone - IANA timezone identifier
 * @returns {string} Long name (e.g., "Mountain Standard Time") or empty string
 */
function _getTimezoneLongName(ianaTimezone) {
  try {
    var now = new Date();
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'long'
    });
    var parts = formatter.formatToParts(now);
    var tzPart = parts.find(function(p) { return p.type === 'timeZoneName'; });
    return tzPart ? tzPart.value : '';
  } catch (e) {
    return '';
  }
}

/**
 * Common timezone abbreviation entries to add to the datalist.
 * Maps representative IANA timezone to its full name for display.
 * Only the currently active abbreviation (based on today) is shown.
 */
var _COMMON_TZ_ENTRIES = [
  { iana: 'America/New_York', name: 'Eastern Time' },
  { iana: 'America/Chicago', name: 'Central Time' },
  { iana: 'America/Denver', name: 'Mountain Time' },
  { iana: 'America/Los_Angeles', name: 'Pacific Time' },
  { iana: 'America/Anchorage', name: 'Alaska Time' },
  { iana: 'Pacific/Honolulu', name: 'Hawaii Time' },
  { iana: 'Europe/London', name: 'United Kingdom' },
  { iana: 'Europe/Paris', name: 'Central European Time' },
  { iana: 'Europe/Helsinki', name: 'Eastern European Time' },
  { iana: 'Europe/Moscow', name: 'Moscow Time' },
  { iana: 'Asia/Dubai', name: 'Gulf Standard Time' },
  { iana: 'Asia/Kolkata', name: 'India Standard Time' },
  { iana: 'Asia/Bangkok', name: 'Indochina Time' },
  { iana: 'Asia/Shanghai', name: 'China Standard Time' },
  { iana: 'Asia/Tokyo', name: 'Japan Standard Time' },
  { iana: 'Australia/Sydney', name: 'Australian Eastern Time' },
  { iana: 'Australia/Adelaide', name: 'Australian Central Time' },
  { iana: 'Australia/Perth', name: 'Australian Western Time' },
  { iana: 'Pacific/Auckland', name: 'New Zealand Time' }
];

/**
 * Initialize the timezone picker modal in the editor.
 * Populates the datalist with IANA timezone names + common abbreviation entries.
 * Injects timezone abbreviation labels into date rows.
 * Wires modal buttons and ESC handler.
 * Called once from editor-init.js after DOM is ready.
 */
function _initTimezonePicker() {
  var datalist = document.getElementById('tz-list-editor');
  if (!datalist) return;

  // Build common abbreviation entries first (at top of datalist)
  var fragment = document.createDocumentFragment();
  _COMMON_TZ_ENTRIES.forEach(function(entry) {
    var abbrev = _getTimezoneAbbreviation(entry.iana);
    if (abbrev) {
      var opt = document.createElement('option');
      opt.value = entry.iana;
      opt.textContent = abbrev + ' - ' + entry.name + ' (' + entry.iana + ')';
      fragment.appendChild(opt);
    }
  });

  // Add all IANA timezones
  var tzList;
  try {
    tzList = Intl.supportedValuesOf('timeZone');
  } catch (e) {
    console.error('[EditorDates] Intl.supportedValuesOf not available:', e);
    tzList = [];
  }
  tzList.forEach(function(tz) {
    var opt = document.createElement('option');
    opt.value = tz;
    fragment.appendChild(opt);
  });
  datalist.appendChild(fragment);

  // Wire up the modal input events
  var input = document.getElementById('chit-timezone');
  if (input) {
    input.addEventListener('change', _onTimezoneModalInputChange);
    input.addEventListener('input', _onTimezoneModalInputChange);
    // Address geocoding on Enter key
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        _onTimezoneInputSubmit();
      }
    });
  }

  // Wire modal buttons
  var clearBtn = document.getElementById('tzModalClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', _onTzModalClear);
  var cancelBtn = document.getElementById('tzModalCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', _closeTzPickerModal);

  // Click outside modal content closes it (cancel behavior)
  var overlay = document.getElementById('tzPickerModal');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _closeTzPickerModal();
    });
  }

  // ESC handler in capture phase — closes modal without propagating
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('tzPickerModal');
      if (modal && modal.style.display !== 'none') {
        e.stopImmediatePropagation();
        e.preventDefault();
        _closeTzPickerModal();
      }
    }
  }, true);

  // Inject abbreviation labels into date rows
  _injectTzAbbrevLabels();
}

/**
 * Inject timezone abbreviation labels at the end of each date-mode-fields div.
 * Creates or updates the labels based on current timezone state.
 */
function _injectTzAbbrevLabels() {
  var fieldIds = ['startEndFields', 'dueFields', 'pointInTimeFields'];
  fieldIds.forEach(function(id) {
    var container = document.getElementById(id);
    if (!container) return;
    // Check if label already exists
    var existing = container.querySelector('.tz-abbrev-label');
    if (!existing) {
      var label = document.createElement('span');
      label.className = 'tz-abbrev-label';
      label.addEventListener('click', _onTzAbbrevClick);
      container.appendChild(label);
    }
  });
  // Update the text/state of all labels
  _updateTzAbbrevLabels();
}

/**
 * Build a multi-line title string with all forms of the timezone name.
 * Format: "MST\nMountain Standard Time\nAmerica/Denver"
 * @param {string} ianaTimezone - IANA timezone identifier
 * @returns {string} Multi-line title for tooltip
 */
function _buildTzTooltip(ianaTimezone) {
  var abbrev = _getTimezoneAbbreviation(ianaTimezone);
  var longName = _getTimezoneLongName(ianaTimezone);
  var parts = [];
  if (abbrev) parts.push(abbrev);
  if (longName) parts.push(longName);
  parts.push(ianaTimezone);
  return parts.join('\n');
}

/**
 * Update all timezone abbreviation labels based on current timezone state.
 * Floating = user's current timezone (muted), Anchored = chit's timezone (full).
 * Tooltip shows all forms of the timezone name on hover.
 */
function _updateTzAbbrevLabels() {
  var labels = document.querySelectorAll('.tz-abbrev-label');
  if (!labels.length) return;

  var chitTz = window._chitTimezone || null;

  if (chitTz) {
    // Anchored — show chit's timezone abbreviation
    var abbrev = _getTimezoneAbbreviation(chitTz);
    var tooltip = _buildTzTooltip(chitTz);
    labels.forEach(function(label) {
      label.textContent = abbrev || chitTz;
      label.className = 'tz-abbrev-label tz-abbrev-anchored';
      label.title = tooltip;
    });
  } else {
    // Floating — show user's current timezone abbreviation (muted)
    if (typeof getCurrentTimezone === 'function') {
      getCurrentTimezone().then(function(userTz) {
        var abbrev = _getTimezoneAbbreviation(userTz);
        var tooltip = _buildTzTooltip(userTz) + '\n(assumed — click to set)';
        labels.forEach(function(label) {
          label.textContent = abbrev || userTz;
          label.className = 'tz-abbrev-label tz-abbrev-floating';
          label.title = tooltip;
        });
      });
    } else {
      // Fallback if getCurrentTimezone not available
      var browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      var abbrev = _getTimezoneAbbreviation(browserTz);
      var tooltip = _buildTzTooltip(browserTz) + '\n(assumed — click to set)';
      labels.forEach(function(label) {
        label.textContent = abbrev || browserTz;
        label.className = 'tz-abbrev-label tz-abbrev-floating';
        label.title = tooltip;
      });
    }
  }
}

/**
 * Handle click on a timezone abbreviation label — open the timezone picker modal.
 */
function _onTzAbbrevClick(e) {
  e.preventDefault();
  _openTzPickerModal();
}

/**
 * Open the timezone picker modal.
 * Pre-fills the input if a timezone is already set.
 */
function _openTzPickerModal() {
  var modal = document.getElementById('tzPickerModal');
  if (!modal) return;

  var input = document.getElementById('chit-timezone');
  var display = document.getElementById('timezoneDisplay');

  // Pre-fill with current timezone if anchored
  if (window._chitTimezone && input) {
    input.value = window._chitTimezone;
    if (display) display.textContent = '✓ ' + window._chitTimezone;
  } else {
    if (input) input.value = '';
    if (display) display.textContent = '';
  }

  modal.style.display = '';
  // Focus input after a tick for immediate typing
  setTimeout(function() { if (input) input.focus(); }, 50);
}

/**
 * Close the timezone picker modal without applying changes (cancel).
 */
function _closeTzPickerModal() {
  var modal = document.getElementById('tzPickerModal');
  if (modal) modal.style.display = 'none';
}

/**
 * Handle timezone input change inside the modal — validate and auto-close on valid selection.
 */
function _onTimezoneModalInputChange() {
  var input = document.getElementById('chit-timezone');
  if (!input) return;
  var val = input.value.trim();
  var display = document.getElementById('timezoneDisplay');

  if (!val) {
    if (display) display.textContent = '';
    return;
  }

  // Validate against the datalist options
  var valid = _isValidTimezone(val);
  if (valid) {
    if (display) display.textContent = '✓ ' + val;
    // Auto-close after brief delay so user sees confirmation
    setTimeout(function() {
      _onTzModalSelect(val);
    }, 200);
  } else {
    if (display) display.textContent = '';
  }
}

/**
 * Apply a timezone selection from the modal and close it.
 * @param {string} tz - Valid IANA timezone to apply
 */
function _onTzModalSelect(tz) {
  window._chitTimezone = tz;
  _updateTzAbbrevLabels();
  setSaveButtonUnsaved();
  _closeTzPickerModal();
}

/**
 * Handle the Clear button in the modal — remove timezone, revert to floating, close modal.
 */
function _onTzModalClear() {
  window._chitTimezone = null;
  _updateTzAbbrevLabels();
  setSaveButtonUnsaved();
  _closeTzPickerModal();
}

/**
 * Handle Enter on timezone input — attempt address geocoding if value
 * doesn't match a known timezone.
 */
function _onTimezoneInputSubmit() {
  var input = document.getElementById('chit-timezone');
  if (!input) return;
  var val = input.value.trim();
  if (!val) return;

  // If it's already a valid timezone, do nothing (handled by _onTimezoneModalInputChange)
  if (_isValidTimezone(val)) return;

  // Attempt geocoding
  _geocodeForTimezone(val);
}

/**
 * Geocode an address/place name and detect its timezone.
 * Calls /api/geocode?q=... then _detectTimezoneFromCoords.
 * On success, applies the timezone and closes the modal.
 * @param {string} query - Address or place name to geocode
 */
async function _geocodeForTimezone(query) {
  var input = document.getElementById('chit-timezone');
  var display = document.getElementById('timezoneDisplay');

  if (display) display.textContent = '🔍 Looking up…';

  try {
    var response = await fetch('/api/geocode?q=' + encodeURIComponent(query));
    if (!response.ok) {
      if (display) display.textContent = '⚠️ Lookup failed';
      setTimeout(function() { if (display) display.textContent = ''; }, 3000);
      return;
    }
    var data = await response.json();
    if (!data.results || data.results.length === 0) {
      if (display) display.textContent = '⚠️ No results for "' + query + '"';
      setTimeout(function() { if (display) display.textContent = ''; }, 3000);
      return;
    }

    var result = data.results[0];
    var lat = result.lat;
    var lon = result.lon;
    var country = result.country_code || null;

    // Detect timezone from coordinates
    if (typeof _detectTimezoneFromCoords !== 'function') {
      if (display) display.textContent = '⚠️ Timezone detection unavailable';
      setTimeout(function() { if (display) display.textContent = ''; }, 3000);
      return;
    }

    var detectedTz = _detectTimezoneFromCoords(lat, lon, country);
    if (detectedTz && _isValidTimezone(detectedTz)) {
      // Show confirmation then auto-close
      if (input) input.value = detectedTz;
      if (display) display.textContent = '✓ ' + detectedTz + ' (from "' + query + '")';

      // Also populate the location field with the address
      var locationInput = document.getElementById('location');
      if (locationInput) {
        var displayName = result.display_name || result.name || query;
        locationInput.value = displayName;
        setSaveButtonUnsaved();

        // Expand the location zone so the user sees the populated field
        var locSection = document.getElementById('locationSection');
        var locContent = document.getElementById('locationContent');
        if (locSection && locContent) {
          locContent.style.display = '';
          locSection.classList.remove('collapsed');
          var icon = locSection.querySelector('.zone-toggle-icon');
          if (icon) icon.textContent = '🔼';
          locSection.querySelectorAll('.zone-button:not(.zone-button-persist)').forEach(function(btn) { btn.style.display = ''; });
        }

        // Trigger weather/map refresh if available
        if (typeof _refreshWeatherOnDateChange === 'function') {
          _refreshWeatherOnDateChange();
        }
        if (typeof _updateViewInContextBtn === 'function') {
          _updateViewInContextBtn();
        }
      }

      setTimeout(function() {
        _onTzModalSelect(detectedTz);
      }, 200);
    } else {
      if (display) display.textContent = '⚠️ Could not determine timezone';
      setTimeout(function() { if (display) display.textContent = ''; }, 3000);
    }
  } catch (e) {
    console.error('[EditorDates] Geocode for timezone failed:', e);
    if (display) display.textContent = '⚠️ Lookup error';
    setTimeout(function() { if (display) display.textContent = ''; }, 3000);
  }
}

/**
 * Check if a timezone string is valid (present in Intl.supportedValuesOf).
 * @param {string} tz - Timezone string to validate
 * @returns {boolean}
 */
function _isValidTimezone(tz) {
  if (!tz) return false;
  try {
    var list = Intl.supportedValuesOf('timeZone');
    return list.indexOf(tz) !== -1;
  } catch (e) {
    return false;
  }
}

/**
 * Update timezone visibility — now just injects/updates abbreviation labels.
 * The inline row was removed; this is kept for backward compatibility with onDateModeChange().
 */
function _updateTimezoneRowVisibility() {
  _injectTzAbbrevLabels();
}

/**
 * Load a timezone value (used when opening an anchored chit).
 * Sets the global state and updates abbreviation labels.
 * @param {string|null} tz - IANA timezone or null
 */
function _loadTimezoneValue(tz) {
  window._chitTimezone = tz || null;
  _updateTzAbbrevLabels();
}

/**
 * Handle the Clear action — remove timezone, revert to floating.
 * Legacy function kept for compatibility with suggestion prompt.
 */
function _onTimezoneClear() {
  _onTzModalClear();
}

/**
 * Get the current timezone value from the picker.
 * @returns {string|null} IANA timezone or null (floating)
 */
function _getTimezoneValue() {
  return window._chitTimezone || null;
}

// ── Timezone suggestion prompt (location-based) ──────────────────────────────

/**
 * Show the timezone suggestion prompt when location geocode detects a different TZ.
 * Inserts a prompt into the date zone with accept/dismiss buttons.
 * Does NOT show if chit already has an explicit timezone set.
 * Does NOT show if date mode is "none" (no dates = no timezone relevance).
 * @param {string} detectedTz - IANA timezone from geocode detection
 */
function _showTimezoneSuggestion(detectedTz) {
  if (!detectedTz) return;

  // Do not show if chit already has an explicit timezone
  if (window._chitTimezone) return;

  // Do not show if date mode is "none" (timezone row is hidden)
  var mode = document.querySelector('input[name="dateMode"]:checked');
  var modeVal = mode ? mode.value : 'none';
  if (modeVal === 'none') return;

  // Remove any existing suggestion prompt
  _dismissTimezoneSuggestion();

  // Find a date-mode-fields container to attach the suggestion to
  var container = document.getElementById('startEndFields') ||
                  document.getElementById('dueFields') ||
                  document.getElementById('pointInTimeFields');
  if (!container) return;

  var prompt = document.createElement('div');
  prompt.className = 'tz-suggestion';
  prompt.id = 'tzSuggestionPrompt';

  var text = document.createElement('span');
  text.className = 'tz-suggestion-text';
  text.textContent = '📍 Detected: ' + detectedTz;

  var acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'tz-suggestion-btn tz-suggestion-accept';
  acceptBtn.textContent = 'Use';
  acceptBtn.title = 'Set chit timezone to ' + detectedTz;
  acceptBtn.onclick = function() {
    _acceptTimezoneSuggestion(detectedTz);
  };

  var dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'tz-suggestion-btn tz-suggestion-dismiss';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.title = 'Keep timezone unchanged';
  dismissBtn.onclick = function() {
    _dismissTimezoneSuggestion();
  };

  prompt.appendChild(text);
  prompt.appendChild(acceptBtn);
  prompt.appendChild(dismissBtn);
  container.appendChild(prompt);
}

/**
 * Accept the timezone suggestion — set chit.timezone to detected value, dismiss prompt.
 * @param {string} detectedTz - IANA timezone to apply
 */
function _acceptTimezoneSuggestion(detectedTz) {
  // Set the timezone via the picker
  _loadTimezoneValue(detectedTz);
  setSaveButtonUnsaved();

  // Remove the suggestion prompt
  _dismissTimezoneSuggestion();
}

/**
 * Dismiss the timezone suggestion prompt — leave timezone unchanged, hide prompt.
 */
function _dismissTimezoneSuggestion() {
  var prompt = document.getElementById('tzSuggestionPrompt');
  if (prompt) prompt.remove();
}
