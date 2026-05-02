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
  const recurrenceFields = document.getElementById('recurrenceFields');
  const alldayRow = document.getElementById('alldayRepeatRow');

  if (startEndFields) {
    startEndFields.classList.toggle('greyed-out', mode !== 'startend');
  }
  if (dueFields) {
    dueFields.classList.toggle('greyed-out', mode !== 'due');
  }
  if (recurrenceFields) {
    recurrenceFields.classList.toggle('greyed-out', mode === 'none');
  }
  if (alldayRow) {
    alldayRow.style.display = (mode === 'none') ? 'none' : '';
  }

  // Show/hide All Day button based on whether a date mode is active
  var allDayBtn = document.getElementById('allDayToggleBtn');
  if (allDayBtn) allDayBtn.style.display = (mode === 'none') ? 'none' : '';

  // Hide repeat row unless a date mode is active — also keep hidden when habit is active
  const repeatRow = document.getElementById('repeatCheckboxRow');
  const repeatOptions = document.getElementById('repeatOptionsBlock');
  const _habitActive = document.getElementById('habitEnabled');
  const _isHabitOn = _habitActive && _habitActive.checked;
  if (repeatRow) repeatRow.style.display = (mode === 'none' || _isHabitOn) ? 'none' : '';
  if ((mode === 'none' || _isHabitOn) && repeatOptions) repeatOptions.style.display = 'none';

  // Show Complete checkbox only when Due mode is active AND habit is NOT active
  const dueCompleteLabel = document.getElementById('dueCompleteLabel');
  const _habitOn = document.getElementById('habitEnabled');
  if (dueCompleteLabel) {
    dueCompleteLabel.style.display = (mode === 'due' && !(_habitOn && _habitOn.checked)) ? 'inline-flex' : 'none';
  }

  // Re-apply all-day visibility for the active mode
  const allDayCheckbox = document.getElementById("allDay");
  if (allDayCheckbox && allDayCheckbox.checked) {
    toggleAllDay();
  } else {
    // Show all time inputs when not all-day
    document.querySelectorAll('#startEndFields .time-input').forEach(i => { i.style.display = ''; });
    const sep = document.querySelector('#startEndFields .date-mode-separator');
    if (sep) sep.style.display = '';
    const dueTime = document.getElementById('due_time');
    if (dueTime) dueTime.style.display = '';
  }

  // Update recurrence labels when date context changes
  _updateRecurrenceLabels();

  // Auto-populate default notifications for NEW chits when a date mode is first activated
  if (!_dateModeSuppressUnsaved && window.isNewChit && mode !== 'none') {
    _applyDefaultNotifications(mode);
  }

  if (!_dateModeSuppressUnsaved) setSaveButtonUnsaved();
}

/** Toggle status to Complete when the Due date Complete checkbox is checked */
function onDueCompleteToggle() {
  const cb = document.getElementById('dueComplete');
  const statusSel = document.getElementById('status');
  if (!cb || !statusSel) return;
  if (cb.checked) {
    statusSel.value = 'Complete';
  } else {
    if (statusSel.value === 'Complete') statusSel.value = '';
  }
  setSaveButtonUnsaved();
}

/** Sync the Due Complete checkbox when status dropdown changes */
function onStatusChange() {
  const statusSel = document.getElementById('status');
  const cb = document.getElementById('dueComplete');
  if (cb) cb.checked = (statusSel && statusSel.value === 'Complete');
  setSaveButtonUnsaved();
}

function _detectDateMode(chit) {
  const hasDue = !!(chit.due_datetime);
  const hasStart = !!(chit.start_datetime);
  if (hasDue) return 'due';
  if (hasStart) return 'startend';
  return 'none';
}

// Set the radio button and apply greying
function _setDateMode(mode) {
  const radio = document.getElementById(
    mode === 'due' ? 'dateModeDue' : mode === 'startend' ? 'dateModeStartEnd' : 'dateModeNone'
  );
  if (radio) radio.checked = true;
  onDateModeChange();
}

function toggleAllDay() {
  const allDayCheckbox = document.getElementById("allDay");
  if (!allDayCheckbox) return;
  const allDay = allDayCheckbox.checked;

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

// ── Time picker dropdown ─────────────────────────────────────────────────────
var _snapMinutes = 15; // default, loaded from settings (var for cross-script access)

// ── Recurrence picker ─────────────────────────────────────────────────────────

/** Update recurrence dropdown labels based on the current date context */
function _updateRecurrenceLabels() {
  const sel = document.getElementById('recurrence');
  if (!sel) return;

  // Get the active date for context
  const mode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
  let refDate = null;
  if (mode === 'startend') {
    const v = document.getElementById('start_datetime')?.value;
    if (v) refDate = new Date(convertMonthFormat(v) + 'T12:00:00');
  } else if (mode === 'due') {
    const v = document.getElementById('due_datetime')?.value;
    if (v) refDate = new Date(convertMonthFormat(v) + 'T12:00:00');
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

function _showTimeDropdown(inputEl) {
  document.querySelectorAll('.time-dropdown').forEach(d => d.remove());

  const currentVal = inputEl.value || '12:00';
  const parts = currentVal.split(':');
  const h = parseInt(parts[0]) || 12;
  const m = parseInt(parts[1]) || 0;
  const baseMinutes = h * 60 + m;

  const dropdown = document.createElement('div');
  dropdown.className = 'time-dropdown';

  const snap = _snapMinutes || 15;
  for (let i = 0; i < 5; i++) {
    const totalMin = baseMinutes + i * snap;
    const hr = Math.floor(totalMin / 60) % 24;
    const mn = totalMin % 60;
    const timeStr = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;

    const opt = document.createElement('div');
    opt.className = 'time-dropdown-option';
    opt.textContent = timeStr;
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      inputEl.value = timeStr;
      dropdown.remove();
      setSaveButtonUnsaved();
    });
    dropdown.appendChild(opt);
  }

  const rect = inputEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 2) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.minWidth = rect.width + 'px';
  document.body.appendChild(dropdown);

  inputEl.addEventListener('blur', () => {
    setTimeout(() => dropdown.remove(), 150);
  }, { once: true });
}

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

    // Hide the Due Complete checkbox — habits manage completion via goal
    var dueCompleteLabel = document.getElementById('dueCompleteLabel');
    if (dueCompleteLabel) dueCompleteLabel.style.display = 'none';

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

    // Update progress display
    _updateHabitProgressDisplay();
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

    // Show the repeat row again (if a date mode is active and repeat is on)
    var activeMode = document.querySelector('input[name="dateMode"]:checked');
    if (repeatRow && activeMode && activeMode.value !== 'none') {
      repeatRow.style.display = '';
    }

    // Hide habit controls row and calendar row
    if (controlsRow) controlsRow.style.display = 'none';
    if (calendarRow) calendarRow.style.display = 'none';

    // Restore recurrence labels to normal format
    _updateRecurrenceLabels();
  }

  // Toggle Habit Log zone visibility
  if (typeof _toggleHabitLogZone === 'function') {
    _toggleHabitLogZone(isHabit);
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
  setSaveButtonUnsaved();
}

/** Update the "X / Y" progress display from current field values */
function _updateHabitProgressDisplay() {
  var goalEl = document.getElementById('habitGoal');
  var display = document.getElementById('habitProgressDisplay');
  if (!display) return;
  var goal = goalEl ? (parseInt(goalEl.value) || 1) : 1;
  var success = window._currentHabitSuccess || 0;
  display.textContent = success + ' / ' + goal;
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
