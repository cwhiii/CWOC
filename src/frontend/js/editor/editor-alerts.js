/**
 * editor-alerts.js — Alerts zone: alarms, timers, stopwatches, notifications
 *
 * Manages the full alerts system within the editor: rendering all four alert
 * types (alarms, timers, stopwatches, notifications), CRUD operations for each,
 * the alarm checker that fires at scheduled times, notification scheduling,
 * default notification auto-population, and sound playback.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, getCachedSettings, cwocPlayAudio,
 *             syncSend, _sharedPlayTimer, _sharedStopTimer, _sharedStopAlarm,
 *             _sharedShowAlertModal, _sharedSnoozeRegistry, _sharedPersistDismiss,
 *             _sharedPersistSnooze, _sharedGetSnoozeMs)
 * Loaded before: editor-init.js, editor.js
 */

// Alert data is stored in window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] }
// Each type has its own array. Saved to chit.alerts as a flat array with _type field.

window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
let _stopwatchIntervals = {}; // id -> intervalId

// ── Time format helper ───────────────────────────────────────────────────────
// Loaded from settings on init; used for alarm time display
window._editorTimeFormat = "24hour"; // default until settings load

async function _loadEditorTimeFormat() {
  try {
    const s = await getCachedSettings();
    window._editorTimeFormat = s.time_format || "24hour";
  } catch (e) { /* keep default */ }
}

function _fmtAlarmTime(time24) {
  // time24 is "HH:MM"
  if (!time24) return "";
  if (window._editorTimeFormat === "12hour" || window._editorTimeFormat === "12houranalog") {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  }
  return time24;
}

// ── Sound helpers ────────────────────────────────────────────────────────────
let _alarmAudio = null;
let _timerAudio = null;

function _playAlarmSound() {
  if (!_alarmAudio) {
    _alarmAudio = new Audio("/static/alarm.mp3");
  }
  _alarmAudio.loop = true;
  cwocPlayAudio(_alarmAudio, { loop: true });
}

function _stopAlarmSound() {
  if (_alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
}

function _playTimerSound() {
  if (!_timerAudio) {
    _timerAudio = new Audio("/static/timer.mp3");
  }
  _timerAudio.loop = true;
  cwocPlayAudio(_timerAudio, { loop: true });
}

// ── Alarm checker — runs every second ───────────────────────────────────────
let _alarmCheckerInterval = null;
const _triggeredAlarms = new Set(); // "idx-HH:MM-dayAbbr"

function _startAlarmChecker() {
  if (_alarmCheckerInterval) return;
  _alarmCheckerInterval = setInterval(_checkAlarms, 1000);
}

function _stopAlarmChecker() {
  if (_alarmCheckerInterval) { clearInterval(_alarmCheckerInterval); _alarmCheckerInterval = null; }
}

function _dayAbbr(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

function _checkAlarms() {
  const now = new Date();
  const currentHH = String(now.getHours()).padStart(2,"0");
  const currentMM = String(now.getMinutes()).padStart(2,"0");
  const currentTime = `${currentHH}:${currentMM}`;
  const currentDay = _dayAbbr(now);

  window._alertsData.alarms.forEach((alarm, idx) => {
    if (!alarm.enabled || !alarm.time) return;
    const days = alarm.days && alarm.days.length > 0 ? alarm.days : [currentDay];
    if (!days.includes(currentDay)) return;
    if (alarm.time !== currentTime) return;

    const key = `${idx}-${alarm.time}-${currentDay}-${now.toDateString()}`;
    if (_triggeredAlarms.has(key)) return;
    _triggeredAlarms.add(key);

    // Fire alarm
    _playAlarmSound();
    _showAlarmAlert(alarm, () => _stopAlarmSound());

    // Request browser notification
    if (Notification.permission === "granted") {
      var _alarmNotif = new Notification(`🔔 Alarm: ${alarm.name || "Alarm"}`, { body: `Time: ${_fmtAlarmTime(alarm.time)}` });
      _alarmNotif.onclick = function() { window.focus(); };
    }
  });

  // Clean up old keys (keep only today's)
  _triggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _triggeredAlarms.delete(key);
  });
}

function _showAlarmAlert(alarm, onDismiss) {
  // Create a non-blocking overlay alert
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:1em 1.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);min-width:220px;";
  overlay.innerHTML = `
    <div style="font-weight:bold;font-size:1.1em;margin-bottom:0.4em;">🔔 ${alarm.name || "Alarm"}</div>
    <div style="font-size:0.9em;margin-bottom:0.6em;">${_fmtAlarmTime(alarm.time)}</div>
    <button id="_alarm-dismiss-btn" style="padding:4px 14px;margin-right:6px;">Dismiss</button>
    <button id="_alarm-snooze-btn" style="padding:4px 14px;">Snooze 5m</button>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#_alarm-dismiss-btn").onclick = () => {
    overlay.remove();
    if (onDismiss) onDismiss();
    // Delete chit after dismissal if flag is set
    if (alarm.delete_after_dismiss && chitId) {
      fetch(`/api/chits/${chitId}`, { method: 'DELETE' })
        .then(() => { window.location.href = '/'; })
        .catch(err => console.error('Delete after dismiss failed:', err));
    }
  };
  overlay.querySelector("#_alarm-snooze-btn").onclick = () => {
    overlay.remove();
    if (onDismiss) onDismiss();
    // Snooze: add 5 minutes
    const [h, m] = alarm.time.split(":").map(Number);
    const snoozeDate = new Date();
    snoozeDate.setHours(h, m + 5, 0, 0);
    alarm.time = `${String(snoozeDate.getHours()).padStart(2,"0")}:${String(snoozeDate.getMinutes()).padStart(2,"0")}`;
  };
}

// ── Notification checker ─────────────────────────────────────────────────────
let _notifCheckerInterval = null;
const _firedNotifications = new Set();

function _startNotificationChecker() {
  if (_notifCheckerInterval) return;
  _notifCheckerInterval = setInterval(_checkNotificationAlerts, 30000); // check every 30s
  _checkNotificationAlerts(); // check immediately
}

function _stopNotificationChecker() {
  if (_notifCheckerInterval) { clearInterval(_notifCheckerInterval); _notifCheckerInterval = null; }
}

function _checkNotificationAlerts() {
  const startVal = document.getElementById("start_datetime")?.value;
  const endVal = document.getElementById("end_datetime")?.value;
  const dueVal = document.getElementById("due_datetime")?.value;
  const pitBtn = document.getElementById("point_in_time_time");
  const pitDateVal = document.getElementById("point_in_time_date")?.value;
  const pitTimeVal = pitBtn ? (pitBtn.dataset.time || '') : '';
  const title = document.getElementById("title")?.value || "Chit";

  // Habit state for cycle-based notifications
  const habitCb = document.getElementById('habitEnabled');
  const isHabit = habitCb && habitCb.checked;

  window._alertsData.notifications.forEach((n, idx) => {
    // ── Weather notifications — check against stored forecast data ──
    if (n.unit === "weather") {
      _checkWeatherNotification(n, idx, title);
      return;
    }

    if (!n.value || !n.unit) return;

    // Skip habit notifications if goal already met and only_if_undone is set
    if (isHabit && n.only_if_undone !== false) {
      const goalEl = document.getElementById('habitGoal');
      const goal = goalEl ? (parseInt(goalEl.value) || 1) : 1;
      const success = window._currentHabitSuccess || 0;
      if (success >= goal) return;
    }

    // Convert to milliseconds — "at" mode uses 0 offset
    const unitMs = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
    const offsetMs = n.atTarget ? 0 : (n.value * (unitMs[n.unit] || 60000));

    let targetDate = null;

    if (n.targetType === "cycle" && isHabit) {
      // Calculate end of current habit cycle period
      targetDate = _getHabitCycleEnd();
    } else {
      // Resolve target datetime based on targetType
      const targetType = n.targetType || (dueVal && !startVal ? "due" : "start");
      let targetStr = null;
      if (targetType === "end") {
        targetStr = endVal || startVal;
      } else if (targetType === "point") {
        // Build point-in-time datetime from date + time fields
        if (pitDateVal) {
          var pitIso = pitDateVal;
          if (pitTimeVal) pitIso += 'T' + pitTimeVal + ':00';
          else pitIso += 'T00:00:00';
          targetStr = pitIso;
        }
      } else if (targetType === "due") {
        targetStr = dueVal || startVal;
      } else {
        targetStr = startVal || dueVal;
      }
      if (!targetStr) return;
      targetDate = new Date(targetStr);
    }

    if (!targetDate || isNaN(targetDate.getTime())) return;

    // at = exactly at target, before = target - offset, after = target + offset
    const fireAt = n.atTarget
      ? targetDate
      : n.afterTarget
      ? new Date(targetDate.getTime() + offsetMs)
      : new Date(targetDate.getTime() - offsetMs);
    const now = new Date();

    // Fire if we're within 30 seconds past the fire time
    const diff = now - fireAt;
    if (diff >= 0 && diff < 30000) {
      const key = `notif-${idx}-${fireAt.toISOString()}`;
      if (_firedNotifications.has(key)) return;
      _firedNotifications.add(key);

      const timingLabel = _notifTimingLabel(n);
      const msg = `${n.value} ${n.unit} ${timingLabel}: "${title}"`;
      _fireNotificationAlert(msg, n, idx);
    }
  });
}

/**
 * Check a weather-based notification against the current chit's weather data.
 * Fires once per page load if the condition is met.
 */
function _checkWeatherNotification(n, idx, title) {
  var wd = window._currentChitWeatherData;
  if (!wd) return;

  var condition = n.weather_condition;
  var threshold = n.weather_threshold;
  if (!condition) return;

  var conditionMet = false;
  var condLabel = '';
  var unitLabel = (typeof _tempUnit === 'function') ? _tempUnit() : '°';
  var windUnit = _isMetricUnits() ? 'km/h' : 'mph';
  var precipUnit = _isMetricUnits() ? 'mm' : 'in';
  var precipMode = n.weather_precip_mode || 'any';

  switch (condition) {
    case 'high_above':
    case 'high_below':
    case 'low_above':
    case 'low_below': {
      if (wd.high == null || wd.low == null || threshold == null) return;
      var high = (typeof _convertTemp === 'function') ? _convertTemp(wd.high) : wd.high;
      var low = (typeof _convertTemp === 'function') ? _convertTemp(wd.low) : wd.low;
      if (condition === 'high_above') { conditionMet = high > threshold; condLabel = 'high (' + high + unitLabel + ') above ' + threshold + unitLabel; }
      else if (condition === 'high_below') { conditionMet = high < threshold; condLabel = 'high (' + high + unitLabel + ') below ' + threshold + unitLabel; }
      else if (condition === 'low_above') { conditionMet = low > threshold; condLabel = 'low (' + low + unitLabel + ') above ' + threshold + unitLabel; }
      else if (condition === 'low_below') { conditionMet = low < threshold; condLabel = 'low (' + low + unitLabel + ') below ' + threshold + unitLabel; }
      break;
    }
    case 'precipitation': {
      // Any type of precipitation
      if (precipMode === 'more_than') {
        if (wd.precipitation == null || threshold == null) return;
        var pDisplay = _isMetricUnits() ? wd.precipitation : wd.precipitation / 25.4;
        conditionMet = pDisplay > threshold;
        condLabel = 'precipitation (' + pDisplay.toFixed(1) + ' ' + precipUnit + ') over ' + threshold + ' ' + precipUnit;
      } else {
        if (wd.weather_code == null) return;
        conditionMet = [51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(wd.weather_code);
        condLabel = 'precipitation in forecast';
      }
      break;
    }
    case 'rain': {
      if (precipMode === 'more_than') {
        if (wd.precipitation == null || threshold == null) return;
        var rCodes = [61,63,65,66,67,80,81,82,51,53,55,56,57];
        var isRain = wd.weather_code != null && rCodes.includes(wd.weather_code);
        var rDisplay = _isMetricUnits() ? wd.precipitation : wd.precipitation / 25.4;
        conditionMet = isRain && rDisplay > threshold;
        condLabel = 'rain (' + rDisplay.toFixed(1) + ' ' + precipUnit + ') over ' + threshold + ' ' + precipUnit;
      } else {
        if (wd.weather_code == null) return;
        conditionMet = [61,63,65,66,67,80,81,82,51,53,55,56,57].includes(wd.weather_code);
        condLabel = 'rain in forecast';
      }
      break;
    }
    case 'snow': {
      if (precipMode === 'more_than') {
        if (wd.precipitation == null || threshold == null) return;
        var sCodes = [71,73,75,77,85,86];
        var isSnow = wd.weather_code != null && sCodes.includes(wd.weather_code);
        var sDisplay = _isMetricUnits() ? wd.precipitation : wd.precipitation / 25.4;
        conditionMet = isSnow && sDisplay > threshold;
        condLabel = 'snow (' + sDisplay.toFixed(1) + ' ' + precipUnit + ') over ' + threshold + ' ' + precipUnit;
      } else {
        if (wd.weather_code == null) return;
        conditionMet = [71,73,75,77,85,86].includes(wd.weather_code);
        condLabel = 'snow in forecast';
      }
      break;
    }
    case 'hail': {
      if (precipMode === 'more_than') {
        if (wd.precipitation == null || threshold == null) return;
        var hCodes = [96,99];
        var isHail = wd.weather_code != null && hCodes.includes(wd.weather_code);
        var hDisplay = _isMetricUnits() ? wd.precipitation : wd.precipitation / 25.4;
        conditionMet = isHail && hDisplay > threshold;
        condLabel = 'hail (' + hDisplay.toFixed(1) + ' ' + precipUnit + ') over ' + threshold + ' ' + precipUnit;
      } else {
        if (wd.weather_code == null) return;
        conditionMet = [96,99].includes(wd.weather_code);
        condLabel = 'hail in forecast';
      }
      break;
    }
    case 'wind_above': {
      var wMax = (typeof _getWindMax === 'function') ? _getWindMax(wd) : wd.wind_gusts;
      if (wMax == null || threshold == null) return;
      var windVal = _isMetricUnits() ? Math.round(wMax) : Math.round(wMax * 0.621371);
      conditionMet = windVal > threshold;
      condLabel = 'wind (' + windVal + ' ' + windUnit + ') over ' + threshold + ' ' + windUnit;
      break;
    }
  }

  if (!conditionMet) return;

  var key = 'weather-notif-' + idx + '-' + (wd.focus_date || 'today');
  if (_firedNotifications.has(key)) return;
  _firedNotifications.add(key);

  var msg = 'Weather alert for "' + title + '": ' + condLabel;
  _fireNotificationAlert(msg, n, idx);
}

/**
 * Calculate the end-of-cycle datetime for the current habit period.
 * Returns a Date representing midnight at the end of the current cycle.
 */
function _getHabitCycleEnd() {
  const habitFreqSel = document.getElementById('habitFrequency');
  const freq = habitFreqSel ? habitFreqSel.value : 'DAILY';
  const now = new Date();

  switch (freq) {
    case 'DAILY': {
      // End of today (midnight tonight)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      return end;
    }
    case 'WEEKLY': {
      // End of this week (next Sunday midnight, or next week-start-day)
      const wsd = (window._cwocSettings && window._cwocSettings.week_start_day !== undefined)
        ? parseInt(window._cwocSettings.week_start_day) || 0 : 0;
      const dayOfWeek = now.getDay();
      const daysUntilEnd = (7 - dayOfWeek + wsd) % 7 || 7;
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilEnd, 0, 0, 0);
      return end;
    }
    case 'MONTHLY': {
      // End of this month (first of next month midnight)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
      return end;
    }
    case 'YEARLY': {
      // End of this year (Jan 1 next year midnight)
      const end = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
      return end;
    }
    default:
      return null;
  }
}

function _notifTimingLabel(n) {
  if (n.targetType === "cycle") {
    return "before end of " + (typeof _habitPeriodLabel === 'function' ? _habitPeriodLabel() : "cycle");
  }
  const hasStart = !!document.getElementById("start_datetime")?.value;
  const hasDue = !!document.getElementById("due_datetime")?.value;
  const targetType = n.targetType || (hasDue && !hasStart ? "due" : "start");
  if (n.atTarget) return "at " + targetType;
  const dir = n.afterTarget ? "after" : "before";
  return `${dir} ${targetType}`;
}

function _fireNotificationAlert(msg, notif, notifIdx) {
  if (Notification.permission === "granted") {
    var _reminderNotif = new Notification("📢 Reminder", { body: msg });
    _reminderNotif.onclick = function() { window.focus(); };
  }
  // Always show inline toast as well
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:0.75em 1.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:0.5em;";
  toast.innerHTML = `<span>📢 ${msg}</span>`;
  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.cssText = "padding:3px 8px;cursor:pointer;margin-left:0.5em;";
  dismissBtn.onclick = () => { toast.remove(); };
  toast.appendChild(dismissBtn);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function _alertsFromChit(chit) {
  if (!Array.isArray(chit.alerts)) chit.alerts = [];
  window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
  chit.alerts.forEach((a) => {
    if (a._type === "alarm") window._alertsData.alarms.push(a);
    else if (a._type === "timer") window._alertsData.timers.push(a);
    else if (a._type === "stopwatch") window._alertsData.stopwatches.push(a);
    else if (a._type === "notification") window._alertsData.notifications.push(a);
  });

  renderAllAlerts();
  // Alarm checking is handled by the shared system in shared.js (runs on all pages)
  if (window._alertsData.notifications.length > 0) _startNotificationChecker();
}

function _alertsToArray() {
  // Filter out unset (incomplete) notifications — they haven't been configured yet
  var validNotifs = window._alertsData.notifications.filter(function(n) {
    return !n._direction || n._direction !== "unset";
  });
  return [
    ...window._alertsData.alarms,
    ...window._alertsData.timers,
    ...window._alertsData.stopwatches,
    ...validNotifs,
  ];
}

// ── Render all alert containers ──────────────────────────────────────────────

function renderAllAlerts() {
  renderNotificationsContainer();
  renderAlarmsContainer();
  renderTimersContainer();
  renderStopwatchesContainer();
}

function renderAlarmsContainer() {
  const c = document.getElementById("alarms-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.alarms.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "🔔 Alarms";
  c.appendChild(header);

  window._alertsData.alarms.forEach((alarm, idx) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = `border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;${!alarm.enabled ? "background:rgba(0,0,0,0.04);" : ""}`;

    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = alarm.name || "";
    nameInput.placeholder = "Alarm name";
    nameInput.style.cssText = `flex:1;font-size:0.9em;padding:2px 4px;${!alarm.enabled ? "opacity:0.45;" : ""}`;
    nameInput.addEventListener("input", () => { window._alertsData.alarms[idx].name = nameInput.value; setSaveButtonUnsaved(); });

    const timeInput = document.createElement("input");
    timeInput.type = "text";
    timeInput.value = _fmtAlarmTime(alarm.time || "") || "";
    timeInput.placeholder = window._editorTimeFormat === '24hour' ? "HH:MM" : "H:MM AM";
    timeInput.readOnly = true;
    timeInput.style.cssText = `font-size:1.1em;padding:3px 6px;font-weight:bold;width:7em;cursor:pointer;text-align:center;${!alarm.enabled ? "opacity:0.45;" : ""}`;

    timeInput.addEventListener("mousedown", (e) => { e.preventDefault(); });
    timeInput.addEventListener("click", () => {
      // Set value to 24h for the picker to read
      var raw24 = alarm.time || "12:00";
      var origVal = timeInput.value;
      timeInput.value = raw24;
      cwocTimePicker.open(timeInput);
      // After picker closes, the value will be in 24h format — convert for display
      timeInput.addEventListener("change", function _onPickerDone() {
        timeInput.removeEventListener("change", _onPickerDone);
        var newVal = timeInput.value.trim();
        var match24 = newVal.match(/^(\d{1,2}):(\d{2})$/);
        if (match24) {
          var h = parseInt(match24[1]), m = parseInt(match24[2]);
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            var parsed = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
            window._alertsData.alarms[idx].time = parsed;
            timeInput.value = _fmtAlarmTime(parsed);
            if (!window._alertsData.alarms[idx].days || window._alertsData.alarms[idx].days.length === 0) {
              window._alertsData.alarms[idx].days = [_dayAbbr(new Date())];
              renderAlarmsContainer();
            }
            setSaveButtonUnsaved();
            return;
          }
        }
        timeInput.value = origVal;
      }, { once: true });
    });

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.textContent = alarm.enabled ? "On" : "Off";
    toggleBtn.style.cssText = "padding:1px 6px;";
    toggleBtn.onclick = () => toggleAlarmEnabled(idx);

    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteAlarmItem(idx);

    row1.appendChild(nameInput);
    row1.appendChild(timeInput);
    row1.appendChild(toggleBtn);
    row1.appendChild(delBtn);
    wrap.appendChild(row1);

    // Days row — order honors week_start_day setting
    const daysRow = document.createElement("div");
    daysRow.style.cssText = `display:flex;gap:0.3em;flex-wrap:wrap;font-size:0.8em;${!alarm.enabled ? "opacity:0.45;" : ""}`;
    const allDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const wsd = (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) ? parseInt(window._cwocSettings.week_start_day) || 0 : 0;
    const orderedDays = [];
    for (let d = 0; d < 7; d++) orderedDays.push(allDays[(wsd + d) % 7]);
    orderedDays.forEach((day) => {
      const lbl = document.createElement("label");
      lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (alarm.days || []).includes(day);
      cb.addEventListener("change", () => {
        const days = window._alertsData.alarms[idx].days || [];
        if (cb.checked) { if (!days.includes(day)) days.push(day); }
        else { const i = days.indexOf(day); if (i !== -1) days.splice(i, 1); }
        window._alertsData.alarms[idx].days = days;
        setSaveButtonUnsaved();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(day));
      daysRow.appendChild(lbl);
    });
    wrap.appendChild(daysRow);

    // Delete after dismissal checkbox
    const dadRow = document.createElement("div");
    dadRow.style.cssText = `display:flex;align-items:center;gap:4px;font-size:0.8em;margin-top:0.2em;${!alarm.enabled ? "opacity:0.45;" : ""}`;
    const dadLbl = document.createElement("label");
    dadLbl.style.cssText = "display:flex;align-items:center;gap:3px;cursor:pointer;";
    const dadCb = document.createElement("input");
    dadCb.type = "checkbox";
    dadCb.checked = !!alarm.delete_after_dismiss;
    dadCb.addEventListener("change", () => {
      window._alertsData.alarms[idx].delete_after_dismiss = dadCb.checked;
      setSaveButtonUnsaved();
    });
    dadLbl.appendChild(dadCb);
    dadLbl.appendChild(document.createTextNode("Delete chit after dismissal"));
    dadRow.appendChild(dadLbl);
    wrap.appendChild(dadRow);

    // Snooze countdown bar — show if this alarm is currently snoozed
    var _chitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
    if (_chitId) {
      var _snKey = _chitId + '-' + idx;
      var _snEnd = (window._sharedSnoozeRegistry || {})[_snKey];
      if (_snEnd && Date.now() < _snEnd) {
        var snzBar = document.createElement('div');
        snzBar.style.cssText = 'position:relative;width:100%;height:2em;background:#f5e6cc;border:2px solid #8b4513;border-radius:6px;overflow:hidden;margin-top:0.3em;cursor:pointer;';
        snzBar.title = 'Click to restart snooze · Shift+click to cancel';
        var snzFill = document.createElement('div');
        snzFill.style.cssText = 'position:absolute;top:2px;left:2px;bottom:2px;width:100%;background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);border-radius:4px;';
        var snzText = document.createElement('div');
        snzText.style.cssText = "position:relative;width:100%;text-align:center;font-family:monospace;font-size:1em;font-weight:bold;color:#4a2c2a;line-height:2em;text-shadow:0 0 4px #fff8e1;z-index:1;";
        snzBar.appendChild(snzFill); snzBar.appendChild(snzText);
        wrap.appendChild(snzBar);
        var _snzMs = (typeof _sharedGetSnoozeMs === 'function') ? _sharedGetSnoozeMs() : 300000;
        var _snEndLocal = _snEnd;
        var _snzInt = setInterval(function() {
          var remain = Math.max(0, _snEndLocal - Date.now());
          var secs = Math.ceil(remain / 1000);
          var pct = Math.max(0, (remain / _snzMs) * 100);
          snzFill.style.width = pct + '%';
          var m = Math.floor(secs / 60), s = secs % 60;
          snzText.textContent = '💤 ' + m + ':' + String(s).padStart(2, '0');
          if (remain <= 0) { clearInterval(_snzInt); snzBar.remove(); }
        }, 200);

        // Click = restart snooze, Shift+click = cancel
        snzBar.addEventListener('click', function(e) {
          if (e.shiftKey) {
            clearInterval(_snzInt);
            delete (window._sharedSnoozeRegistry || {})[_snKey];
            if (typeof _sharedPersistDismiss === 'function') _sharedPersistDismiss(_snKey);
            if (typeof syncSend === 'function') syncSend('alert_dismissed', { snoozeKey: _snKey });
            snzBar.remove();
          } else {
            var newEnd = Date.now() + _snzMs;
            _snEndLocal = newEnd;
            if (window._sharedSnoozeRegistry) window._sharedSnoozeRegistry[_snKey] = newEnd;
            if (typeof _sharedPersistSnooze === 'function') _sharedPersistSnooze(_snKey, newEnd);
            if (typeof syncSend === 'function') syncSend('alert_snoozed', { snoozeKey: _snKey, snoozeUntil: newEnd });
          }
        });

        // Long press on mobile = cancel
        var _lpT = null;
        snzBar.addEventListener('touchstart', function() {
          _lpT = setTimeout(function() {
            clearInterval(_snzInt);
            delete (window._sharedSnoozeRegistry || {})[_snKey];
            if (typeof _sharedPersistDismiss === 'function') _sharedPersistDismiss(_snKey);
            if (typeof syncSend === 'function') syncSend('alert_dismissed', { snoozeKey: _snKey });
            snzBar.remove();
          }, 600);
        }, { passive: true });
        snzBar.addEventListener('touchend', function() { if (_lpT) { clearTimeout(_lpT); _lpT = null; } }, { passive: true });
        snzBar.addEventListener('touchmove', function() { if (_lpT) { clearTimeout(_lpT); _lpT = null; } }, { passive: true });
      }
    }

    c.appendChild(wrap);
  });
}

/**
 * Apply default notifications from settings when a date mode is activated on a new chit.
 * Only adds if no notifications exist yet.
 */
var _defaultNotifsApplied = {};
function _applyDefaultNotifications(mode) {
  if (_defaultNotifsApplied[mode]) return;
  if (!window._alertsData) window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
  if (window._alertsData.notifications.length > 0) return;

  console.debug('_applyDefaultNotifications: mode=' + mode + ', fetching settings...');
  getCachedSettings().then(function(settings) {
    var dn = settings.default_notifications;
    console.debug('_applyDefaultNotifications: default_notifications=', dn);
    if (!dn) { console.debug('_applyDefaultNotifications: no defaults configured'); return; }

    var toAdd = [];
    // For 'startend' mode, add start-time defaults only
    if (mode === 'startend' && Array.isArray(dn.start)) {
      dn.start.forEach(function(n) {
        toAdd.push({ _type: 'notification', value: n.value, unit: n.unit || 'minutes', afterTarget: !!n.afterTarget, only_if_undone: true, message: '' });
      });
    }
    // For 'due' mode, add due-time defaults only
    if (mode === 'due' && Array.isArray(dn.due)) {
      dn.due.forEach(function(n) {
        toAdd.push({ _type: 'notification', value: n.value, unit: n.unit || 'minutes', afterTarget: !!n.afterTarget, only_if_undone: true, message: '' });
      });
    }

    if (toAdd.length === 0) { console.debug('_applyDefaultNotifications: no matching defaults for mode=' + mode); return; }
    console.debug('_applyDefaultNotifications: adding ' + toAdd.length + ' notifications');
    _defaultNotifsApplied[mode] = true;
    toAdd.forEach(function(n) { window._alertsData.notifications.push(n); });
    renderNotificationsContainer();
    setSaveButtonUnsaved();

    // Expand the alerts zone so the user sees the added notifications
    var alertsSection = document.getElementById('alertsSection');
    var alertsContent = document.getElementById('alertsContent');
    if (alertsSection && alertsContent && alertsSection.classList.contains('collapsed')) {
      alertsSection.classList.remove('collapsed');
      alertsContent.style.display = '';
      var icon = alertsSection.querySelector('.zone-toggle-icon');
      if (icon) icon.textContent = '🔼';
      alertsSection.querySelectorAll('.zone-button').forEach(function(b) { b.style.display = ''; });
    }
  }).catch(function() { /* ignore */ });
}

function renderNotificationsContainer() {
  const c = document.getElementById("notifications-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.notifications.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "📢 Notifications";
  c.appendChild(header);

  // Detect if this chit is a habit
  const habitCb = document.getElementById('habitEnabled');
  const isHabit = habitCb && habitCb.checked;

  window._alertsData.notifications.forEach((n, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:0.4em;padding:4px 0;border-bottom:1px solid #e0d4b5;flex-wrap:wrap;";

    const isWeatherMode = (n.unit === "weather");
    const isDesktopMode = (n.unit === "on_desktop");
    const isUnset = (n._direction === "unset");
    const isTriggered = isDesktopMode && n.triggered;

    // If triggered, cross out the whole row
    if (isTriggered) {
      row.style.textDecoration = "line-through";
      row.style.opacity = "0.6";
    }

    // ── Direction dropdown (first control) ──────────────────────────────
    const dirSel = document.createElement("select");
    dirSel.style.cssText = "font-size:0.9em;padding:2px 4px;";
    if (isTriggered) dirSel.disabled = true;

    // Determine current direction
    let curDir = "unset";
    if (isUnset) curDir = "unset";
    else if (isWeatherMode) curDir = "weather";
    else if (isDesktopMode) curDir = "desktop";
    else if (n.atTarget) curDir = "at";
    else if (n.afterTarget) curDir = "after";
    else if (n.unit && n.unit !== "on_desktop" && n.unit !== "weather") curDir = "before";

    // Build direction options — depends on date mode, habit state
    const dateMode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
    const hasTimeMode = (dateMode !== 'none' && dateMode !== 'perpetual');
    const hasWeatherData = !!(window._currentChitWeatherData || (document.getElementById('location') && document.getElementById('location').value && hasTimeMode));

    let dirOptions;
    if (!hasTimeMode && !isHabit) {
      // No date mode — desktop only (+ weather if location has weather)
      dirOptions = [
        { value: "desktop", label: "Next Time on Desktop" }
      ];
      if (hasWeatherData) dirOptions.push({ value: "weather", label: "Weather" });
      // Force to desktop or weather if currently set to a time-based direction (but not if unset)
      if (curDir !== "desktop" && curDir !== "weather" && curDir !== "unset") {
        curDir = "desktop";
        window._alertsData.notifications[idx].unit = "on_desktop";
        window._alertsData.notifications[idx].delivery_target = "desktop";
        window._alertsData.notifications[idx].value = 0;
        window._alertsData.notifications[idx].atTarget = false;
        window._alertsData.notifications[idx].afterTarget = false;
      }
    } else if (isHabit) {
      dirOptions = [
        { value: "before",  label: "Before" },
        { value: "desktop", label: "Next Time on Desktop" }
      ];
      if (hasWeatherData) dirOptions.push({ value: "weather", label: "Weather" });
    } else {
      dirOptions = [
        { value: "at",      label: "At" },
        { value: "before",  label: "Before" },
        { value: "after",   label: "After" },
        { value: "desktop", label: "Next Time on Desktop" }
      ];
      if (hasWeatherData) dirOptions.push({ value: "weather", label: "Weather" });
    }

    // Add placeholder if unset
    if (curDir === "unset") {
      dirOptions.unshift({ value: "unset", label: "— Choose —" });
    }

    dirOptions.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.value; opt.textContent = d.label;
      if (d.value === curDir) opt.selected = true;
      dirSel.appendChild(opt);
    });

    dirSel.addEventListener("change", () => {
      const dir = dirSel.value;
      if (dir === "unset") return; // ignore placeholder re-selection
      // Clear the unset marker
      delete window._alertsData.notifications[idx]._direction;
      if (dir === "weather") {
        window._alertsData.notifications[idx].unit = "weather";
        window._alertsData.notifications[idx].value = 0;
        window._alertsData.notifications[idx].atTarget = false;
        window._alertsData.notifications[idx].afterTarget = false;
        delete window._alertsData.notifications[idx].delivery_target;
        delete window._alertsData.notifications[idx].triggered;
        // Don't set weather_condition yet — let user pick from the type dropdown
      } else if (dir === "desktop") {
        window._alertsData.notifications[idx].unit = "on_desktop";
        window._alertsData.notifications[idx].delivery_target = "desktop";
        window._alertsData.notifications[idx].value = 0;
        window._alertsData.notifications[idx].atTarget = false;
        window._alertsData.notifications[idx].afterTarget = false;
        delete window._alertsData.notifications[idx].weather_condition;
        delete window._alertsData.notifications[idx].weather_threshold;
      } else {
        // at, before, or after — don't pre-fill values, let user set them
        window._alertsData.notifications[idx].unit = window._alertsData.notifications[idx].unit || "minutes";
        if (window._alertsData.notifications[idx].unit === "on_desktop" || window._alertsData.notifications[idx].unit === "weather") {
          window._alertsData.notifications[idx].unit = "minutes";
        }
        delete window._alertsData.notifications[idx].delivery_target;
        delete window._alertsData.notifications[idx].triggered;
        delete window._alertsData.notifications[idx].weather_condition;
        delete window._alertsData.notifications[idx].weather_threshold;
        delete window._alertsData.notifications[idx].weather_precip_mode;
        window._alertsData.notifications[idx].atTarget = (dir === "at");
        window._alertsData.notifications[idx].afterTarget = (dir === "after");
        if (dir === "at") {
          window._alertsData.notifications[idx].value = 0;
        }
        // Don't set default target yet — let user pick
      }
      setSaveButtonUnsaved();
      renderNotificationsContainer();
    });

    // ── Value input (number) ────────────────────────────────────────────
    const valInput = document.createElement("input");
    valInput.type = "number"; valInput.min = "1"; valInput.value = n.value || '';
    valInput.placeholder = "#";
    valInput.style.cssText = "width:55px;font-size:0.9em;padding:2px 4px;";
    if (isTriggered) valInput.disabled = true;
    valInput.addEventListener("change", () => {
      window._alertsData.notifications[idx].value = parseInt(valInput.value) || 0;
      setSaveButtonUnsaved();
      renderNotificationsContainer();
    });

    // ── Unit dropdown ───────────────────────────────────────────────────
    const unitSel = document.createElement("select");
    unitSel.style.cssText = "font-size:0.9em;padding:2px 4px;";
    if (isTriggered) unitSel.disabled = true;
    ["minutes","hours","days","weeks"].forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u; opt.textContent = u;
      if (n.unit === u) opt.selected = true;
      unitSel.appendChild(opt);
    });
    unitSel.addEventListener("change", () => {
      window._alertsData.notifications[idx].unit = unitSel.value;
      setSaveButtonUnsaved();
    });

    // ── Target element (dropdown if multiple options, plain text if single) ──
    const dateMode2 = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
    let targetOptions = [];
    let targetEl = null; // will be a <select> or <span>

    if (isHabit && !isDesktopMode && !isWeatherMode && !isUnset) {
      const cycleLabel = _habitPeriodLabel();
      targetEl = document.createElement("span");
      targetEl.style.cssText = "font-size:0.9em;font-style:italic;opacity:0.8;";
      targetEl.textContent = "end of " + cycleLabel;
      if (!n.targetType) window._alertsData.notifications[idx].targetType = "cycle";
    } else if (!isDesktopMode && !isWeatherMode && !isUnset) {
      if (dateMode2 === 'startend') {
        targetOptions = [{ value: "start", label: "start" }, { value: "end", label: "end" }];
      } else if (dateMode2 === 'due') {
        targetOptions = [{ value: "due", label: "due" }];
      } else if (dateMode2 === 'pointintime') {
        targetOptions = [{ value: "point", label: "point" }];
      } else {
        targetOptions = [{ value: "start", label: "start" }];
      }

      if (targetOptions.length === 1) {
        // Single option — show as plain text label
        targetEl = document.createElement("span");
        targetEl.style.cssText = "font-size:0.9em;font-style:italic;opacity:0.8;";
        targetEl.textContent = targetOptions[0].label;
        if (!n.targetType) window._alertsData.notifications[idx].targetType = targetOptions[0].value;
      } else {
        // Multiple options — show as dropdown
        targetEl = document.createElement("select");
        targetEl.style.cssText = "font-size:0.85em;padding:2px 4px;";
        const curTarget = n.targetType || _defaultTargetForMode(dateMode2);
        targetOptions.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t.value; opt.textContent = t.label;
          if (t.value === curTarget) opt.selected = true;
          targetEl.appendChild(opt);
        });
        targetEl.addEventListener("change", () => {
          window._alertsData.notifications[idx].targetType = targetEl.value;
          setSaveButtonUnsaved();
        });
      }
    }

    // ── Delete button ───────────────────────────────────────────────────
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = isTriggered ? "✅" : "❌";
    delBtn.style.cssText = "padding:1px 5px;";
    delBtn.title = isTriggered ? "Clear triggered notification" : "Remove notification";
    delBtn.onclick = () => deleteNotificationItem(idx);

    // ── Assemble row based on direction ─────────────────────────────────
    // Natural English order: "Notify [value] [unit] [direction] [target]"
    row.appendChild(document.createTextNode("Notify "));

    if (isUnset) {
      // Unset — only the direction dropdown, highlighted
      dirSel.style.cssText += "border:2px solid #d4af37;background:#fff8e1;";
      row.appendChild(dirSel);
    } else if (isWeatherMode) {
      // Weather mode: "Notify [Weather ▾] [type controls...]"
      row.appendChild(dirSel);
      _appendWeatherControls(row, n, idx);
    } else if (!isDesktopMode && !n.atTarget) {
      // "before" or "after": "Notify [value] [unit] [direction] [target]"
      if (!n.value) {
        // No value yet — show highlighted empty input, then direction + target
        valInput.style.cssText += "border:2px solid #d4af37;background:#fff8e1;";
        row.appendChild(valInput);
        row.appendChild(dirSel);
        if (targetEl) row.appendChild(targetEl);
      } else {
        // Value set — show full: "12 minutes before start"
        row.appendChild(valInput);
        if (n.value) row.appendChild(unitSel);
        row.appendChild(dirSel);
        if (targetEl) row.appendChild(targetEl);
      }
    } else if (!isDesktopMode && n.atTarget) {
      // "at": "Notify at [target]"
      row.appendChild(dirSel);
      if (targetEl) row.appendChild(targetEl);
    } else {
      // desktop
      row.appendChild(dirSel);
      if (!hasTimeMode && !isHabit) {
        var hint = document.createElement("span");
        hint.style.cssText = "font-size:0.8em;opacity:0.65;font-style:italic;";
        hint.textContent = "(add a time for more options)";
        row.appendChild(hint);
      }
    }

    // Habit mode: "Disable if complete for [period]" checkbox
    if (isHabit && !isDesktopMode && !isWeatherMode && !isUnset) {
      const disableLbl = document.createElement("label");
      disableLbl.style.cssText = "display:flex;align-items:center;gap:3px;font-size:0.8em;cursor:pointer;white-space:nowrap;";
      disableLbl.title = "Skip this notification if the habit goal is already met for the current " + _habitPeriodLabel();
      const disableCb = document.createElement("input");
      disableCb.type = "checkbox";
      disableCb.checked = n.only_if_undone !== false;
      disableCb.addEventListener("change", () => {
        window._alertsData.notifications[idx].only_if_undone = disableCb.checked;
        setSaveButtonUnsaved();
      });
      disableLbl.appendChild(disableCb);
      disableLbl.appendChild(document.createTextNode("disable if done"));
      row.appendChild(disableLbl);
    }

    row.appendChild(delBtn);
    c.appendChild(row);
  });
}

/**
 * Append weather condition controls (condition dropdown + threshold) to a notification row.
 * Called inline from renderNotificationsContainer when direction is "weather".
 */
function _appendWeatherControls(row, n, idx) {
  var unitLabel = (typeof _tempUnit === 'function') ? _tempUnit() : '°F';
  var windUnit = _isMetricUnits() ? 'km/h' : 'mph';
  var precipUnit = _isMetricUnits() ? 'mm' : 'in';
  var hasCondition = !!n.weather_condition;

  // ── Condition dropdown (always shown) ──
  var condSel = document.createElement("select");
  condSel.style.cssText = "font-size:0.9em;padding:2px 4px;";
  var conditions = [
    { value: "high_above", label: "high above" },
    { value: "high_below", label: "high below" },
    { value: "low_above",  label: "low above" },
    { value: "low_below",  label: "low below" },
    { value: "precipitation", label: "any precipitation" },
    { value: "rain",       label: "rain" },
    { value: "snow",       label: "snow" },
    { value: "hail",       label: "hail" },
    { value: "wind_above", label: "wind over" }
  ];
  // Add placeholder if no condition chosen yet
  if (!hasCondition) {
    conditions.unshift({ value: "", label: "— Type —" });
    condSel.style.cssText += "border:2px solid #d4af37;background:#fff8e1;";
  }
  conditions.forEach(function(c) {
    var opt = document.createElement("option");
    opt.value = c.value; opt.textContent = c.label;
    if (n.weather_condition === c.value) opt.selected = true;
    if (!hasCondition && c.value === "") opt.selected = true;
    condSel.appendChild(opt);
  });
  condSel.addEventListener("change", function() {
    if (!condSel.value) return;
    window._alertsData.notifications[idx].weather_condition = condSel.value;
    // Set sensible defaults
    if (['high_above','high_below','low_above','low_below'].includes(condSel.value)) {
      if (!window._alertsData.notifications[idx].weather_threshold) {
        window._alertsData.notifications[idx].weather_threshold = _isMetricUnits() ? 32 : 90;
      }
    } else if (condSel.value === 'wind_above') {
      if (!window._alertsData.notifications[idx].weather_threshold) {
        window._alertsData.notifications[idx].weather_threshold = _isMetricUnits() ? 50 : 30;
      }
    } else if (['precipitation','rain','snow','hail'].includes(condSel.value)) {
      if (!window._alertsData.notifications[idx].weather_precip_mode) {
        window._alertsData.notifications[idx].weather_precip_mode = "any";
      }
    }
    setSaveButtonUnsaved();
    renderNotificationsContainer();
  });
  row.appendChild(condSel);

  // ── Stop here if no condition chosen yet (progressive disclosure) ──
  if (!hasCondition) return;

  // ── Precipitation conditions: "any" vs "more than X" toggle ──
  var isPrecipCondition = ['precipitation','rain','snow','hail'].includes(n.weather_condition);
  if (isPrecipCondition) {
    var precipMode = n.weather_precip_mode || "any";
    var modeSel = document.createElement("select");
    modeSel.style.cssText = "font-size:0.9em;padding:2px 4px;";
    [{ value: "any", label: "any amount" }, { value: "more_than", label: "more than" }].forEach(function(m) {
      var opt = document.createElement("option");
      opt.value = m.value; opt.textContent = m.label;
      if (precipMode === m.value) opt.selected = true;
      modeSel.appendChild(opt);
    });
    modeSel.addEventListener("change", function() {
      window._alertsData.notifications[idx].weather_precip_mode = modeSel.value;
      if (modeSel.value === "more_than" && !window._alertsData.notifications[idx].weather_threshold) {
        window._alertsData.notifications[idx].weather_threshold = _isMetricUnits() ? 5 : 0.2;
      }
      setSaveButtonUnsaved();
      renderNotificationsContainer();
    });
    row.appendChild(modeSel);

    // Show threshold input only if "more than" mode
    if (precipMode === "more_than") {
      var precipInput = document.createElement("input");
      precipInput.type = "number";
      precipInput.step = _isMetricUnits() ? "1" : "0.1";
      precipInput.min = "0";
      precipInput.value = n.weather_threshold != null ? n.weather_threshold : (_isMetricUnits() ? 5 : 0.2);
      precipInput.style.cssText = "width:60px;font-size:0.9em;padding:2px 4px;";
      precipInput.addEventListener("change", function() {
        window._alertsData.notifications[idx].weather_threshold = parseFloat(precipInput.value) || 0;
        setSaveButtonUnsaved();
      });
      row.appendChild(precipInput);
      var pUnitSpan = document.createElement("span");
      pUnitSpan.style.cssText = "font-size:0.9em;";
      pUnitSpan.textContent = precipUnit;
      row.appendChild(pUnitSpan);
    }
  }

  // ── Threshold input (temp and wind conditions) ──
  var needsThreshold = ['high_above','high_below','low_above','low_below','wind_above'].includes(n.weather_condition);
  if (needsThreshold) {
    var threshInput = document.createElement("input");
    threshInput.type = "number";
    var defaultThresh = (n.weather_condition === 'wind_above')
      ? (_isMetricUnits() ? 50 : 30)
      : (_isMetricUnits() ? 32 : 90);
    threshInput.value = n.weather_threshold != null ? n.weather_threshold : defaultThresh;
    threshInput.style.cssText = "width:60px;font-size:0.9em;padding:2px 4px;";
    threshInput.addEventListener("change", function() {
      window._alertsData.notifications[idx].weather_threshold = parseInt(threshInput.value) || 0;
      setSaveButtonUnsaved();
    });
    row.appendChild(threshInput);

    var threshUnit = (n.weather_condition === 'wind_above') ? windUnit : unitLabel;
    var unitSpan = document.createElement("span");
    unitSpan.style.cssText = "font-size:0.9em;";
    unitSpan.textContent = threshUnit;
    row.appendChild(unitSpan);
  }

  // ── Current forecast hint ──
  if (window._currentChitWeatherData) {
    var wd = window._currentChitWeatherData;
    var hintText = '';
    if (['high_above','high_below','low_above','low_below'].includes(n.weather_condition)) {
      var high = (typeof _convertTemp === 'function') ? _convertTemp(wd.high) : wd.high;
      var low = (typeof _convertTemp === 'function') ? _convertTemp(wd.low) : wd.low;
      if (high != null && low != null) hintText = "(forecast: " + low + "–" + high + unitLabel + ")";
    } else if (n.weather_condition === 'wind_above') {
      var wMax = _getWindMax(wd);
      if (wMax != null) {
        var windVal = _isMetricUnits() ? Math.round(wMax) : Math.round(wMax * 0.621371);
        hintText = "(forecast wind: " + windVal + " " + windUnit + ")";
      }
    } else if (['precipitation','rain','snow','hail'].includes(n.weather_condition)) {
      var parts = [];
      if (wd.weather_code != null) {
        var precipType = _weatherCodeToPrecipType(wd.weather_code);
        if (precipType) parts.push(precipType);
      }
      if (wd.precipitation != null) {
        var pVal = _isMetricUnits() ? Math.round(wd.precipitation) + 'mm' : (wd.precipitation / 25.4).toFixed(1) + 'in';
        parts.push(pVal);
      }
      hintText = parts.length ? "(forecast: " + parts.join(", ") + ")" : "(forecast: clear)";
    }
    if (hintText) {
      var hint = document.createElement("span");
      hint.style.cssText = "font-size:0.75em;opacity:0.6;font-style:italic;margin-left:4px;";
      hint.textContent = hintText;
      row.appendChild(hint);
    }
  }
}

/** Get the higher of wind_gusts and wind_speed from weather data (km/h). */
function _getWindMax(wd) {
  var gusts = wd.wind_gusts != null ? wd.wind_gusts : null;
  var speed = wd.wind_speed != null ? wd.wind_speed : null;
  if (gusts == null && speed == null) return null;
  if (gusts == null) return speed;
  if (speed == null) return gusts;
  return Math.max(gusts, speed);
}

/**
 * Map a WMO weather code to a precipitation type string.
 * Returns "rain", "snow", "hail", "drizzle", "thunder", or "" for clear/cloudy.
 */
function _weatherCodeToPrecipType(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([96, 99].includes(code)) return "hail";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([95].includes(code)) return "thunder";
  return "";
}

/**
 * Returns a human-readable label for the current habit's cycle period.
 * Uses the habit frequency dropdown (DAILY/WEEKLY/MONTHLY/YEARLY).
 */
function _habitPeriodLabel() {
  const habitFreqSel = document.getElementById('habitFrequency');
  const freq = habitFreqSel ? habitFreqSel.value : 'DAILY';
  switch (freq) {
    case 'DAILY': return 'day';
    case 'WEEKLY': return 'week';
    case 'MONTHLY': return 'month';
    case 'YEARLY': return 'year';
    default: return 'cycle';
  }
}

/** Returns "start", "due", or "start/due" based on which date fields the chit has */
function _notifTargetLabel() {
  const hasStart = !!document.getElementById("start_datetime")?.value;
  const hasDue = !!document.getElementById("due_datetime")?.value;
  if (hasStart && hasDue) return "start/due";
  if (hasDue) return "due";
  return "start";
}

/** Returns the default target type for a given date mode */
function _defaultTargetForMode(dateMode) {
  switch (dateMode) {
    case 'startend': return 'start';
    case 'due': return 'due';
    case 'pointintime': return 'point';
    default: return 'start';
  }
}

// ── Alarm CRUD ───────────────────────────────────────────────────────────────

let _editingAlarmIdx = null;

function openAlarmModal(event) {
  if (event) event.stopPropagation();
  // Add a new alarm inline — no modal needed, default time to now+1min, days to today
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  const defaultTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  window._alertsData.alarms.push({ _type: "alarm", name: "", time: defaultTime, recurrence: "none", days: [_dayAbbr(new Date())], enabled: true });
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function editAlarmItem(idx) {
  _editingAlarmIdx = idx;
  const alarm = window._alertsData.alarms[idx];
  const modal = document.getElementById("alarmModal");
  if (!modal) return;
  document.getElementById("alarmName").value = alarm.name || "";
  document.getElementById("alarmTime").value = alarm.time || "";
  document.getElementById("alarmRecurrence").value = alarm.recurrence || "none";
  document.querySelectorAll(".alarm-day").forEach((cb) => {
    cb.checked = (alarm.days || []).includes(cb.value);
  });
  document.getElementById("modalAlarmSubmit").textContent = "Update Alarm";
  modal.style.display = "flex";
}

function addAlarm() {
  const name = document.getElementById("alarmName")?.value.trim() || "";
  const time = document.getElementById("alarmTime")?.value.trim() || "";
  const recurrence = document.getElementById("alarmRecurrence")?.value || "none";
  const days = Array.from(document.querySelectorAll(".alarm-day:checked")).map((cb) => cb.value);
  if (!time) { cwocToast("Please enter a time for the alarm.", "error"); return; }
  const alarm = { _type: "alarm", name, time, recurrence, days, enabled: true };
  if (_editingAlarmIdx !== null) {
    window._alertsData.alarms[_editingAlarmIdx] = alarm;
    _editingAlarmIdx = null;
  } else {
    window._alertsData.alarms.push(alarm);
  }
  closeAlarmModal(true);
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function toggleAlarmEnabled(idx) {
  window._alertsData.alarms[idx].enabled = !window._alertsData.alarms[idx].enabled;
  // If turning off while snoozed, cancel the snooze
  if (!window._alertsData.alarms[idx].enabled) {
    var _chitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
    if (_chitId) {
      var _snKey = _chitId + '-' + idx;
      if (window._sharedSnoozeRegistry && window._sharedSnoozeRegistry[_snKey]) {
        delete window._sharedSnoozeRegistry[_snKey];
        if (typeof _sharedPersistDismiss === 'function') _sharedPersistDismiss(_snKey);
        if (typeof syncSend === 'function') syncSend('alert_dismissed', { snoozeKey: _snKey });
      }
    }
  }
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function deleteAlarmItem(idx) {
  window._alertsData.alarms.splice(idx, 1);
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function closeAlarmModal(save) {
  const modal = document.getElementById("alarmModal");
  if (modal) modal.style.display = "none";
}

// ── Timer CRUD ───────────────────────────────────────────────────────────────

let _editingTimerIdx = null;

function openTimerModal(event) {
  if (event) event.stopPropagation();
  // Add a new timer inline — no modal needed
  window._alertsData.timers.push({ _type: "timer", name: "", totalSeconds: 0, loop: false });
  const idx = window._alertsData.timers.length - 1;
  window._timerRuntime[idx] = { remaining: 0, intervalId: null, running: false };
  renderTimersContainer();
  setSaveButtonUnsaved();
}

function editTimerItem(idx) {
  _editingTimerIdx = idx;
  const timer = window._alertsData.timers[idx];
  const modal = document.getElementById("timerModal");
  if (!modal) return;
  document.getElementById("timerNameModal").value = timer.name || "";
  document.getElementById("timerHoursModal").value = Math.floor(timer.totalSeconds / 3600);
  document.getElementById("timerMinutesModal").value = Math.floor((timer.totalSeconds % 3600) / 60);
  document.getElementById("timerSecondsModal").value = timer.totalSeconds % 60;
  document.getElementById("timerLoopModal").checked = !!timer.loop;
  document.getElementById("modalTimerSubmit").textContent = "Update Timer";
  modal.style.display = "flex";
}

function addTimer() {
  const name = document.getElementById("timerNameModal")?.value.trim() || "";
  const h = parseInt(document.getElementById("timerHoursModal")?.value) || 0;
  const m = parseInt(document.getElementById("timerMinutesModal")?.value) || 0;
  const s = parseInt(document.getElementById("timerSecondsModal")?.value) || 0;
  const loop = document.getElementById("timerLoopModal")?.checked || false;
  const totalSeconds = h * 3600 + m * 60 + s;
  if (totalSeconds <= 0) { cwocToast("Please enter a duration greater than 0.", "error"); return; }
  const timer = { _type: "timer", name, totalSeconds, loop };
  if (_editingTimerIdx !== null) {
    window._alertsData.timers[_editingTimerIdx] = timer;
    _editingTimerIdx = null;
  } else {
    window._alertsData.timers.push(timer);
  }
  closeTimerModal(true);
  renderTimersContainer();
  setSaveButtonUnsaved();
}

function closeTimerModal(save) {
  const modal = document.getElementById("timerModal");
  if (modal) modal.style.display = "none";
}

// ── Stopwatch CRUD — with live running clock ─────────────────────────────────

// Runtime state for running stopwatches (not persisted)
window._swRuntime = {}; // idx -> { running, elapsed, intervalId, laps }

function addStopwatch(event) {
  if (event) event.stopPropagation();
  const idx = window._alertsData.stopwatches.length;
  window._alertsData.stopwatches.push({ _type: "stopwatch", name: "" });
  window._swRuntime[idx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
  renderStopwatchesContainer();
  setSaveButtonUnsaved();
}

function deleteStopwatchItem(idx) {
  // Stop interval if running
  const rt = window._swRuntime[idx];
  if (rt && rt.intervalId) clearInterval(rt.intervalId);
  window._alertsData.stopwatches.splice(idx, 1);
  // Rebuild runtime map
  const newRuntime = {};
  Object.keys(window._swRuntime).forEach((k) => {
    const ki = parseInt(k);
    if (ki < idx) newRuntime[ki] = window._swRuntime[ki];
    else if (ki > idx) newRuntime[ki - 1] = window._swRuntime[ki];
  });
  window._swRuntime = newRuntime;
  renderStopwatchesContainer();
  setSaveButtonUnsaved();
}

function _swFmt(ms) {
  const cs = Math.floor((ms % 1000) / 10);
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}

function renderStopwatchesContainer() {
  const c = document.getElementById("stopwatches-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.stopwatches.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "⏲️ Stopwatches";
  c.appendChild(header);

  window._alertsData.stopwatches.forEach((sw, idx) => {
    if (!window._swRuntime[idx]) {
      window._swRuntime[idx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
    }
    const rt = window._swRuntime[idx];

    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;";
    wrap.id = `sw-wrap-${idx}`;

    // Name row
    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = sw.name || "";
    nameInput.placeholder = "Stopwatch name";
    nameInput.style.cssText = "flex:1;font-size:0.9em;padding:2px 4px;";
    nameInput.addEventListener("input", () => {
      window._alertsData.stopwatches[idx].name = nameInput.value;
      setSaveButtonUnsaved();
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "❌";
    delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteStopwatchItem(idx);
    nameRow.appendChild(nameInput);
    nameRow.appendChild(delBtn);
    wrap.appendChild(nameRow);

    // Display
    const display = document.createElement("div");
    display.id = `sw-display-${idx}`;
    display.style.cssText = "font-family:monospace;font-size:1.4em;text-align:center;padding:0.2em 0;letter-spacing:0.05em;";
    display.textContent = _swFmt(rt.elapsed);
    wrap.appendChild(display);

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:0.4em;justify-content:center;margin-top:0.3em;";

    const startStopBtn = document.createElement("button");
    startStopBtn.type = "button";
    startStopBtn.id = `sw-startstop-${idx}`;
    startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
    startStopBtn.style.cssText = "padding:2px 10px;";
    startStopBtn.onclick = () => {
      if (rt.running) {
        clearInterval(rt.intervalId);
        rt.intervalId = null;
        rt.running = false;
        startStopBtn.textContent = "▶ Start";
      } else {
        const startMs = Date.now() - rt.elapsed;
        rt.intervalId = setInterval(() => {
          rt.elapsed = Date.now() - startMs;
          const d = document.getElementById(`sw-display-${idx}`);
          if (d) d.textContent = _swFmt(rt.elapsed);
        }, 50);
        rt.running = true;
        startStopBtn.textContent = "⏸ Pause";
      }
    };

    const lapBtn = document.createElement("button");
    lapBtn.type = "button";
    lapBtn.textContent = "🏁 Lap";
    lapBtn.style.cssText = "padding:2px 10px;";
    lapBtn.onclick = () => {
      if (rt.running) {
        rt.laps.push(_swFmt(rt.elapsed));
        renderLaps(idx, lapsDiv);
      }
    };

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "🔄 Reset";
    resetBtn.style.cssText = "padding:2px 10px;";
    resetBtn.onclick = () => {
      clearInterval(rt.intervalId);
      rt.intervalId = null;
      rt.running = false;
      rt.elapsed = 0;
      rt.laps = [];
      display.textContent = _swFmt(0);
      startStopBtn.textContent = "▶ Start";
      renderLaps(idx, lapsDiv);
    };

    controls.appendChild(startStopBtn);
    controls.appendChild(lapBtn);
    controls.appendChild(resetBtn);
    wrap.appendChild(controls);

    // Laps
    const lapsDiv = document.createElement("div");
    lapsDiv.id = `sw-laps-${idx}`;
    lapsDiv.style.cssText = "font-size:0.8em;margin-top:0.3em;max-height:80px;overflow-y:auto;";
    renderLaps(idx, lapsDiv);
    wrap.appendChild(lapsDiv);

    c.appendChild(wrap);
  });
}

function renderLaps(idx, container) {
  const rt = window._swRuntime[idx];
  if (!rt || !container) return;
  container.innerHTML = "";
  rt.laps.forEach((lap, i) => {
    const d = document.createElement("div");
    d.style.cssText = "border-bottom:1px solid #e0d4b5;padding:1px 0;";
    d.textContent = `Lap ${i + 1}: ${lap}`;
    container.appendChild(d);
  });
}

function closeStopwatchModal() {
  var modal = document.getElementById('stopwatchModal');
  if (modal) modal.style.display = 'none';
}

function saveStopwatchDetails() {
  // Read the name from the modal input and apply it to the stopwatch
  var nameInput = document.getElementById('stopwatchNameModal');
  if (nameInput && window._swEditIdx !== undefined) {
    var sw = window._alertsData.stopwatches[window._swEditIdx];
    if (sw) {
      sw.name = nameInput.value.trim() || '';
      renderStopwatchesContainer();
      setSaveButtonUnsaved();
    }
  }
  closeStopwatchModal();
}

// ── Timer CRUD — with countdown display ──────────────────────────────────────

// Runtime state for running timers
window._timerRuntime = {}; // idx -> { remaining, intervalId, running }

function renderTimersContainer() {
  const c = document.getElementById("timers-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.timers.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "⏱️ Timers";
  c.appendChild(header);

  window._alertsData.timers.forEach((timer, idx) => {
    if (!window._timerRuntime[idx]) {
      window._timerRuntime[idx] = { remaining: timer.totalSeconds, intervalId: null, running: false };
    }
    const rt = window._timerRuntime[idx];

    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;";

    // Name row (always visible)
    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;";
    const nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.value = timer.name || ""; nameInput.placeholder = "Timer name";
    nameInput.style.cssText = "flex:1;min-width:80px;font-size:0.9em;padding:2px 4px;";
    nameInput.addEventListener("input", () => { window._alertsData.timers[idx].name = nameInput.value; setSaveButtonUnsaved(); });
    const loopLbl = document.createElement("label");
    loopLbl.style.cssText = "display:flex;align-items:center;gap:2px;font-size:0.85em;cursor:pointer;";
    const loopCb = document.createElement("input");
    loopCb.type = "checkbox"; loopCb.checked = !!timer.loop;
    loopCb.addEventListener("change", () => { window._alertsData.timers[idx].loop = loopCb.checked; setSaveButtonUnsaved(); });
    loopLbl.appendChild(loopCb);
    loopLbl.appendChild(document.createTextNode("🔁"));
    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteTimerItem(idx);
    nameRow.appendChild(nameInput);
    nameRow.appendChild(loopLbl);
    nameRow.appendChild(delBtn);
    wrap.appendChild(nameRow);

    // Shared display area
    const displayArea = document.createElement("div");
    displayArea.style.cssText = "margin:0.3em 0;";

    // Input mode: HH:MM:SS
    const inputRow = document.createElement("div");
    inputRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:0.2em;";
    const hInput = document.createElement("input");
    hInput.type = "number"; hInput.min = "0"; hInput.placeholder = "HH";
    hInput.value = Math.floor(timer.totalSeconds / 3600) || "";
    hInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";
    const mInput = document.createElement("input");
    mInput.type = "number"; mInput.min = "0"; mInput.max = "59"; mInput.placeholder = "MM";
    mInput.value = Math.floor((timer.totalSeconds % 3600) / 60) || "";
    mInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";
    const sInput = document.createElement("input");
    sInput.type = "number"; sInput.min = "0"; sInput.max = "59"; sInput.placeholder = "SS";
    sInput.value = timer.totalSeconds % 60 || "";
    sInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";
    inputRow.appendChild(hInput);
    inputRow.appendChild(document.createTextNode(":"));
    inputRow.appendChild(mInput);
    inputRow.appendChild(document.createTextNode(":"));
    inputRow.appendChild(sInput);

    // Countdown mode: progress bar (HST-style)
    const countdownBar = document.createElement("div");
    countdownBar.style.cssText = "position:relative;width:100%;height:2.2em;background:#f5e6cc;border:2px solid #8b4513;border-radius:6px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);cursor:pointer;";
    const barFill = document.createElement("div");
    barFill.style.cssText = "position:absolute;top:2px;left:2px;bottom:2px;width:100%;background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);border-radius:4px;";
    const barText = document.createElement("div");
    barText.style.cssText = "position:relative;width:100%;text-align:center;font-family:monospace;font-size:1.3em;font-weight:bold;color:#4a2c2a;line-height:2.2em;letter-spacing:2px;text-shadow:0 0 4px #fff8e1,0 0 8px #fff8e1,0 0 2px #fff8e1;z-index:1;";
    const fmtTimer = (s) => {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    };
    barText.textContent = fmtTimer(rt.remaining);
    countdownBar.appendChild(barFill);
    countdownBar.appendChild(barText);

    displayArea.appendChild(inputRow);
    displayArea.appendChild(countdownBar);
    wrap.appendChild(displayArea);

    function _showInputMode() { inputRow.style.display = ''; countdownBar.style.display = 'none'; }
    function _showCountdownMode() { inputRow.style.display = 'none'; countdownBar.style.display = ''; _updateBar(); }
    function _updateBar() {
      const total = window._alertsData.timers[idx].totalSeconds || 1;
      const pct = Math.max(0, Math.min(100, (rt.remaining / total) * 100));
      barFill.style.width = pct + '%';
      barText.textContent = fmtTimer(rt.remaining);
    }

    countdownBar.addEventListener("click", () => {
      if (rt.running) {
        clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
        startStopBtn.textContent = "▶ Start";
      } else {
        _showInputMode();
      }
    });

    if (rt.running) { _showCountdownMode(); }
    else if (rt.remaining > 0 && rt.remaining < (window._alertsData.timers[idx].totalSeconds || 0)) { _showCountdownMode(); }
    else { _showInputMode(); }

    const updateDuration = () => {
      const h = parseInt(hInput.value) || 0;
      const m = parseInt(mInput.value) || 0;
      const s = parseInt(sInput.value) || 0;
      const total = h * 3600 + m * 60 + s;
      window._alertsData.timers[idx].totalSeconds = total;
      if (!rt.running) { rt.remaining = total; _updateBar(); }
      setSaveButtonUnsaved();
    };
    [hInput, mInput, sInput].forEach((inp) => inp.addEventListener("change", updateDuration));

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:0.4em;justify-content:center;margin-top:0.3em;";

    const startStopBtn = document.createElement("button");
    startStopBtn.type = "button";
    startStopBtn.id = `timer-startstop-${idx}`;
    startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
    startStopBtn.style.cssText = "padding:2px 10px;";
    startStopBtn.onclick = () => {
      if (rt.running) {
        clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
        startStopBtn.textContent = "▶ Start";
        // Keep bar visible, frozen — click bar to edit
        // Cancel server-side timer tracking
        var _pauseChitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
        if (_pauseChitId) {
          fetch('/api/timer-state', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_type: 'chit', source_id: _pauseChitId, alert_index: idx }) }).catch(function() {});
        }
      } else {
        if (rt.remaining <= 0) rt.remaining = window._alertsData.timers[idx].totalSeconds;
        _showCountdownMode();
        // Register with server for Ntfy notification when timer expires
        var _startChitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
        if (_startChitId) {
          var _endTs = new Date(Date.now() + rt.remaining * 1000).toISOString();
          var _timerName = window._alertsData.timers[idx].name || 'Timer';
          fetch('/api/timer-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_type: 'chit', source_id: _startChitId, alert_index: idx,
              end_ts: _endTs, name: _timerName }) }).catch(function() {});
        }
        let _edFracRemain = rt.remaining * 10;
        const _edTickFn = () => {
          _edFracRemain = Math.max(0, _edFracRemain - 1);
          rt.remaining = _edFracRemain / 10;
          const wholeSec = Math.floor(rt.remaining);
          const tenths = Math.floor(_edFracRemain % 10);
          if (wholeSec < 10) {
            const total = window._alertsData.timers[idx].totalSeconds || 1;
            const pct = Math.max(0, Math.min(100, (rt.remaining / total) * 100));
            barFill.style.width = pct + '%';
            barText.textContent = fmtTimer(wholeSec) + '.' + tenths;
          } else {
            _updateBar();
          }
          if (_edFracRemain <= 0) {
            clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
            startStopBtn.textContent = "▶ Start";
            rt.remaining = 0;
            // Use shared audio so dismiss stops the right one
            if (typeof _sharedPlayTimer === 'function') { _sharedPlayTimer(); } else { _playTimerSound(); }
            barFill.style.width = '100%';
            barFill.style.background = '';
            barText.textContent = '✓ DONE';
            var timerName = window._alertsData.timers[idx].name || 'Timer';
            var _chitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
            if (typeof _sharedShowAlertModal === 'function') {
              _sharedShowAlertModal({ icon: '⏱️', title: timerName, subtitle: "Time's up!", chitId: _chitId, onDismiss: function() { _sharedStopTimer(); _sharedStopAlarm(); if (_timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; } if (_alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; } }, showSnooze: false });
            }
            // Sync to other devices
            if (typeof syncSend === 'function') syncSend('timer_fired', { timerName: timerName, chitId: _chitId });
            if (window._alertsData.timers[idx].loop) {
              setTimeout(() => {
                rt.remaining = window._alertsData.timers[idx].totalSeconds;
                startStopBtn.click();
              }, 1500);
            } else {
              setTimeout(() => { _showInputMode(); }, 2500);
            }
          }
        };
        rt.intervalId = setInterval(_edTickFn, 100);
        rt.running = true; startStopBtn.textContent = "⏸ Pause";
      }
    };

    const resetBtn = document.createElement("button");
    resetBtn.type = "button"; resetBtn.textContent = "🔄 Reset"; resetBtn.style.cssText = "padding:2px 10px;";
    resetBtn.onclick = () => {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      rt.remaining = window._alertsData.timers[idx].totalSeconds;
      startStopBtn.textContent = "▶ Start";
      _showInputMode();
      _updateBar();
      // Cancel server-side timer tracking
      var _resetChitId = window.currentChitId || new URLSearchParams(window.location.search).get('id');
      if (_resetChitId) {
        fetch('/api/timer-state', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_type: 'chit', source_id: _resetChitId, alert_index: idx }) }).catch(function() {});
      }
    };

    controls.appendChild(startStopBtn);
    controls.appendChild(resetBtn);
    wrap.appendChild(controls);
    c.appendChild(wrap);
  });
}

function deleteTimerItem(idx) {
  const rt = window._timerRuntime[idx];
  if (rt && rt.intervalId) clearInterval(rt.intervalId);
  window._alertsData.timers.splice(idx, 1);
  const newRt = {};
  Object.keys(window._timerRuntime).forEach((k) => {
    const ki = parseInt(k);
    if (ki < idx) newRt[ki] = window._timerRuntime[ki];
    else if (ki > idx) newRt[ki - 1] = window._timerRuntime[ki];
  });
  window._timerRuntime = newRt;
  renderTimersContainer();
  setSaveButtonUnsaved();
}

// ── Notification CRUD ────────────────────────────────────────────────────────

// Notification add button — only allows time-based notifications when a date mode is active

function openNotificationModal(event) {
  if (event) event.stopPropagation();
  // Add a new notification with no direction chosen yet — just the dropdown
  window._alertsData.notifications.push({ _type: "notification", _direction: "unset" });
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function addNotification() {
  const value = parseInt(document.getElementById("notificationValue")?.value);
  const unit = document.getElementById("notificationUnit")?.value || "minutes";
  const onlyIfUndone = document.getElementById("notificationOnlyIfUndone")?.checked ?? true;
  const message = document.getElementById("notificationMessage")?.value?.trim() || '';
  if (!value || value <= 0) { cwocToast("Please enter a valid number.", "error"); return; }
  window._alertsData.notifications.push({ _type: "notification", value, unit, afterTarget: false, only_if_undone: onlyIfUndone, message });
  closeNotificationModal(true);
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function deleteNotificationItem(idx) {
  window._alertsData.notifications.splice(idx, 1);
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function closeNotificationModal(save) {
  const modal = document.getElementById("notificationModal");
  if (modal) modal.style.display = "none";
}

function validateNotificationInputs() {
  const val = document.getElementById("notificationValue")?.value;
  const btn = document.getElementById("modalNotificationSubmit");
  if (btn) btn.disabled = !val || isNaN(val) || Number(val) <= 0;
}
