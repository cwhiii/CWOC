/**
 * main-alerts.js — Global alert system for the dashboard.
 *
 * Contains:
 *   - Alarm checking (_globalCheckAlarms)
 *   - Notification checking (_globalCheckNotifications)
 *   - Alert system startup (_startGlobalAlertSystem)
 *   - Alert modal display (_showAlertModal, _dismissAlertModal, _showTimerDoneModal)
 *   - Browser notifications (_sendBrowserNotification)
 *   - Audio playback (_globalPlayAlarm, _globalStopAlarm, _globalPlayTimer, _globalStopTimer)
 *   - Toast notifications (_showGlobalToast)
 *   - Alert state persistence (_loadAlertStates, _persistDismiss, _persistSnooze)
 *   - Snooze helpers (_getSnoozeMs)
 *
 * Depends on globals from main.js: chits, _chitOptions, _snoozeRegistry
 * Depends on shared.js: cwocPlayAudio, syncOn, syncSend, getCachedSettings
 * Depends on main-views.js: _independentAlerts, _alarmsViewMode, _saTimerRuntime,
 *   _fetchIndependentAlerts, displayChits, fetchChits
 */

/* ── Global Alert System state ───────────────────────────────────────────── */

const _globalTriggeredAlarms = new Set();
const _globalFiredNotifications = new Set();
let _globalAlarmInterval = null;
let _globalNotifInterval = null;
let _globalAlarmAudio = null;
let _globalTimerAudio = null;
let _globalTimeFormat = "24hour";
let _globalAlarmTimeout = null;
async function _loadAlertStates() {
  try {
    const resp = await fetch('/api/alert-state');
    if (!resp.ok) return;
    const states = await resp.json();
    states.forEach(s => {
      if (s.state === 'dismissed') {
        _globalTriggeredAlarms.add(s.alert_key);
      } else if (s.state === 'snoozed' && s.until_ts) {
        _snoozeRegistry[s.alert_key] = new Date(s.until_ts).getTime();
      }
    });
  } catch (e) { console.error('Failed to load alert states:', e); }
}

// Persist dismiss state to backend
function _persistDismiss(alertKey) {
  _globalTriggeredAlarms.add(alertKey);
  fetch('/api/alert-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: alertKey, state: 'dismissed' }),
  }).catch(e => console.error('Failed to persist dismiss:', e));
}

// Persist snooze state to backend
function _persistSnooze(snoozeKey, untilTs) {
  _snoozeRegistry[snoozeKey] = untilTs;
  fetch('/api/alert-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: snoozeKey, state: 'snoozed', until_ts: new Date(untilTs).toISOString() }),
  }).catch(e => console.error('Failed to persist snooze:', e));
}

function _globalFmtTime(time24) {
  if (!time24) return "";
  if (_globalTimeFormat === "12hour" || _globalTimeFormat === "12houranalog") {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
  }
  return time24;
}

function _globalPlayAlarm() {
  if (!_globalAlarmAudio) {
    _globalAlarmAudio = new Audio("/static/alarm.mp3");
  }
  _globalAlarmAudio.loop = true;
  cwocPlayAudio(_globalAlarmAudio, { loop: true });
  // Auto-stop after 5 minutes
  if (_globalAlarmTimeout) clearTimeout(_globalAlarmTimeout);
  _globalAlarmTimeout = setTimeout(() => _globalStopAlarm(), 5 * 60 * 1000);
}

function _globalStopAlarm() {
  if (_globalAlarmAudio) { _globalAlarmAudio.pause(); _globalAlarmAudio.currentTime = 0; }
  if (_globalAlarmTimeout) { clearTimeout(_globalAlarmTimeout); _globalAlarmTimeout = null; }
  if ('vibrate' in navigator) { try { navigator.vibrate(0); } catch (e) {} }
}

function _globalPlayTimer() {
  if (!_globalTimerAudio) _globalTimerAudio = new Audio("/static/timer.mp3");
  _globalTimerAudio.loop = true;
  cwocPlayAudio(_globalTimerAudio, { loop: true });
}

function _globalStopTimer() {
  if (_globalTimerAudio) { _globalTimerAudio.pause(); _globalTimerAudio.currentTime = 0; _globalTimerAudio.loop = false; }
}

function _globalDayAbbr(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

/**
 * Show a persistent toast notification with chit title and Open button.
 * Clicking Open navigates to the chit editor.
 */
function _showGlobalToast(emoji, label, chitTitle, chitId, onDismiss) {
  // Delegate to the bold alert modal for alarms
  if (emoji === "🔔") {
    return _showAlertModal({
      icon: "🔔",
      title: chitTitle || "Alarm",
      subtitle: label,
      chitId: chitId,
      onDismiss: onDismiss,
      showSnooze: true,
    });
  }
  // Notifications still use a compact toast
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;top:16px;right:16px;z-index:99999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:0.75em 1em;box-shadow:0 4px 20px rgba(0,0,0,0.35);min-width:240px;max-width:320px;font-family:'Courier New',monospace;display:flex;flex-direction:column;gap:0.4em;";
  const titleRow = document.createElement("div");
  titleRow.style.cssText = "font-weight:bold;font-size:1em;";
  titleRow.textContent = `${emoji} ${chitTitle || "Alert"}`;
  const labelRow = document.createElement("div");
  labelRow.style.cssText = "font-size:0.85em;opacity:0.8;";
  labelRow.textContent = label;
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:0.5em;margin-top:0.2em;";
  const openBtn = document.createElement("button");
  openBtn.textContent = chitTitle || "Open Chit";
  openBtn.style.cssText = "flex:1;padding:3px 8px;cursor:pointer;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;";
  openBtn.onclick = () => { toast.remove(); if (onDismiss) onDismiss(); window.location.href = `/editor?id=${chitId}`; };
  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.cssText = "padding:3px 8px;cursor:pointer;";
  dismissBtn.onclick = () => { toast.remove(); if (onDismiss) onDismiss(); };
  btnRow.appendChild(openBtn);
  btnRow.appendChild(dismissBtn);
  toast.appendChild(titleRow);
  toast.appendChild(labelRow);
  toast.appendChild(btnRow);
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 60000);
  return toast;
}

// ── Bold full-screen alert modal for alarms & timers ─────────────────────────
function _showAlertModal(opts) {
  // opts: { icon, title, subtitle, chitId, onDismiss, showSnooze, snoozeKey, triggerKey }

  // Lock body scroll
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';

  const overlay = document.createElement("div");
  overlay.className = "cwoc-alert-overlay";

  // Block all scroll/touch events on the overlay
  overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  overlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  // Block clicks on the backdrop (only buttons should work)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) e.stopPropagation();
  });

  const modal = document.createElement("div");
  modal.className = "cwoc-alert-modal";

  // Pulsing progress bar at top
  const bar = document.createElement("div");
  bar.className = "cwoc-alert-bar";
  const barFill = document.createElement("div");
  barFill.className = "cwoc-alert-bar-fill";
  bar.appendChild(barFill);
  modal.appendChild(bar);

  // Icon
  const iconEl = document.createElement("div");
  iconEl.className = "cwoc-alert-icon";
  iconEl.textContent = opts.icon || "🔔";
  modal.appendChild(iconEl);

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "cwoc-alert-title";
  titleEl.textContent = opts.title || "Alert";
  modal.appendChild(titleEl);

  // Subtitle
  if (opts.subtitle) {
    const subEl = document.createElement("div");
    subEl.className = "cwoc-alert-subtitle";
    subEl.textContent = opts.subtitle;
    modal.appendChild(subEl);
  }

  // Buttons
  const btnRow = document.createElement("div");
  btnRow.className = "cwoc-alert-buttons";

  if (opts.chitId) {
    const openBtn = document.createElement("button");
    openBtn.className = "cwoc-alert-btn";
    openBtn.textContent = "📝 Open Chit";
    openBtn.onclick = () => {
      _dismissAlertModal(overlay, opts.onDismiss);
      window.location.href = `/editor?id=${opts.chitId}`;
    };
    btnRow.appendChild(openBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "cwoc-alert-btn cwoc-alert-btn-primary";
  dismissBtn.textContent = "✕ Dismiss";
  dismissBtn.onclick = () => {
    // Stop ALL sounds immediately
    _globalStopAlarm();
    if (typeof _globalStopTimer === 'function') _globalStopTimer();
    _dismissAlertModal(overlay, opts.onDismiss);
    // Persist dismiss and sync
    if (opts.triggerKey) _persistDismiss(opts.triggerKey);
    if (opts.snoozeKey) _persistDismiss(opts.snoozeKey);
    syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
  };
  btnRow.appendChild(dismissBtn);

  if (opts.showSnooze) {
    const snoozeBtn = document.createElement("button");
    snoozeBtn.className = "cwoc-alert-btn";
    snoozeBtn.textContent = "💤 Snooze";
    snoozeBtn.onclick = () => {
      _globalStopAlarm();
      if (typeof _globalStopTimer === 'function') _globalStopTimer();
      _dismissAlertModal(overlay, opts.onDismiss);
      if (opts.snoozeKey) {
        const snoozeMs = _getSnoozeMs();
        const untilTs = Date.now() + snoozeMs;
        _persistSnooze(opts.snoozeKey, untilTs);
        if (opts.triggerKey) _globalTriggeredAlarms.delete(opts.triggerKey);
        syncSend('alert_snoozed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey, snoozeUntil: untilTs });
      }
      // Re-render to show snooze countdown bar
      if (currentTab === 'Alarms' && _alarmsViewMode === 'independent') {
        setTimeout(function() { displayChits(); }, 400);
      }
    };
    btnRow.appendChild(snoozeBtn);
  }

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  overlay._alertSnoozeKey = opts.snoozeKey || null;
  overlay._alertTriggerKey = opts.triggerKey || null;
  overlay._alertOnDismiss = opts.onDismiss || null;
  document.body.appendChild(overlay);

  // Force reflow then add active class for animation
  void overlay.offsetWidth;
  overlay.classList.add("active");

  // Block keyboard shortcuts but allow clicks (needed for audio retry)
  function _blockKeys(e) {
    // Allow Tab for accessibility
    if (e.key === 'Tab') return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  document.addEventListener('keydown', _blockKeys, true);
  overlay._blockKeys = _blockKeys;

  // Try to play audio on first button interaction (unlocks audio on desktop)
  modal.addEventListener('click', function() {
    if (_globalAlarmAudio && _globalAlarmAudio.paused && _globalAlarmAudio.loop) {
      _globalAlarmAudio.play().catch(function() {});
    }
    if (_globalTimerAudio && _globalTimerAudio.paused && _globalTimerAudio.loop) {
      _globalTimerAudio.play().catch(function() {});
    }
  }, { once: true });

  return overlay;
}

function _dismissAlertModal(overlay, onDismiss) {
  overlay.classList.remove("active");
  // Remove keyboard blocker
  if (overlay._blockKeys) {
    document.removeEventListener('keydown', overlay._blockKeys, true);
  }
  // Unlock body scroll (only if no other alert modals are open)
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
    if (!document.querySelector('.cwoc-alert-overlay')) {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }, 300);
  if (onDismiss) onDismiss();
}

function _showTimerDoneModal(timerName, onDismiss) {
  return _showAlertModal({
    icon: "⏱️",
    title: timerName || "Timer",
    subtitle: "Time's up!",
    onDismiss: function() {
      if (onDismiss) onDismiss();
      syncSend('timer_dismissed', { timerName: timerName });
    },
    showSnooze: false,
  });
}

function _sendBrowserNotification(title, body, chitId, playSound) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  var opts = {
    body: body,
    icon: "/static/cwod_logo-favicon.png",
    tag: 'cwoc-alert-' + (chitId || 'independent'),
    renotify: true,
    requireInteraction: true,
    silent: true
  };
  // Vibrate pattern for Android/mobile (200ms on, 100ms off, 200ms on)
  if ('vibrate' in navigator) {
    opts.vibrate = [200, 100, 200, 100, 300];
  }
  try {
    var n = new Notification(title, opts);
    n.onclick = function() {
      window.focus();
      if (chitId) window.location.href = '/editor?id=' + chitId;
    };
  } catch (e) {
    // Fallback for environments where Notification constructor fails (some Android browsers)
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.showNotification(title, opts).catch(function() {});
      });
    }
  }
}

function _globalCheckAlarms() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const currentTime = `${hh}:${mm}`;
  const currentDay = _globalDayAbbr(now);
  const dateStr = now.toDateString();

  // ── Check chit-based alarms ──
  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "alarm" || !alert.enabled || !alert.time) return;
      const days = alert.days && alert.days.length > 0 ? alert.days : [currentDay];
      if (!days.includes(currentDay)) return;
      if (alert.time !== currentTime) return;

      const key = `${chit.id}-${alertIdx}-${alert.time}-${dateStr}`;
      if (_globalTriggeredAlarms.has(key)) return;
      // Check snooze registry
      const snoozeKey = `${chit.id}-${alertIdx}`;
      if (_snoozeRegistry[snoozeKey] && Date.now() < _snoozeRegistry[snoozeKey]) return;
      _globalTriggeredAlarms.add(key);

      const label = `${_globalFmtTime(alert.time)}${alert.name ? " — " + alert.name : ""}`;
      _globalPlayAlarm();
      const modal = _showAlertModal({
        icon: "🔔",
        title: chit.title || "Alarm",
        subtitle: label,
        chitId: chit.id,
        onDismiss: () => {
          _globalStopAlarm();
          if (alert.delete_after_dismiss) {
            fetch(`/api/chits/${chit.id}`, { method: 'DELETE' })
              .then(() => fetchChits())
              .catch(err => console.error('Delete after dismiss failed:', err));
          }
        },
        showSnooze: true,
        snoozeKey: snoozeKey,
        triggerKey: key,
      });

      _sendBrowserNotification(`🔔 Alarm: ${chit.title}`, label, chit.id);
      syncSend('alarm_fired', { title: chit.title, subtitle: label, chitId: chit.id, snoozeKey: snoozeKey, triggerKey: key });
    });
  });

  // ── Check independent alarms ──
  if (Array.isArray(_independentAlerts)) {
    _independentAlerts.forEach((ia) => {
      const alertData = ia.data || ia;
      if (alertData._type !== 'alarm' || !alertData.enabled || !alertData.time) return;
      const days = alertData.days && alertData.days.length > 0 ? alertData.days : [currentDay];
      if (!days.includes(currentDay)) return;
      if (alertData.time !== currentTime) return;

      const key = `ia-${ia.id}-${alertData.time}-${dateStr}`;
      if (_globalTriggeredAlarms.has(key)) return;
      const snoozeKey = `ia-${ia.id}`;
      if (_snoozeRegistry[snoozeKey] && Date.now() < _snoozeRegistry[snoozeKey]) return;
      _globalTriggeredAlarms.add(key);

      const alarmName = alertData.name || 'Independent Alarm';
      const label = `${_globalFmtTime(alertData.time)}${alertData.name ? " — " + alertData.name : ""}`;
      _globalPlayAlarm();

      _showAlertModal({
        icon: "🔔",
        title: alarmName,
        subtitle: label,
        onDismiss: () => _globalStopAlarm(),
        showSnooze: true,
        snoozeKey: snoozeKey,
        triggerKey: key,
      });

      _sendBrowserNotification(`🔔 ${alarmName}`, label);
      syncSend('alarm_fired', { title: alarmName, subtitle: label, snoozeKey: snoozeKey, triggerKey: key });
    });
  }

  // Clean up old keys
  _globalTriggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _globalTriggeredAlarms.delete(key);
  });

  // ── Check for expired snoozes — re-fire alarms whose snooze just ran out ──
  var _snoozeKeys = Object.keys(_snoozeRegistry);
  _snoozeKeys.forEach(function(snoozeKey) {
    var until = _snoozeRegistry[snoozeKey];
    if (!until || Date.now() < until) return; // still snoozed
    // Snooze expired — check if we already re-fired (use a special key)
    var refireKey = 'snooze-refire-' + snoozeKey + '-' + dateStr;
    if (_globalTriggeredAlarms.has(refireKey)) return;
    _globalTriggeredAlarms.add(refireKey);
    delete _snoozeRegistry[snoozeKey];

    // Find the alarm to get its name/title
    var alarmName = 'Alarm';
    var alarmTime = '';
    var chitId = null;

    // Check independent alarms
    if (snoozeKey.startsWith('ia-') && Array.isArray(_independentAlerts)) {
      var iaId = snoozeKey.slice(3);
      var ia = _independentAlerts.find(function(a) { return a.id === iaId; });
      if (ia) {
        var ad = ia.data || ia;
        alarmName = ad.name || 'Independent Alarm';
        alarmTime = ad.time || '';
      }
    } else {
      // Check chit alarms (snoozeKey = "chitId-alertIdx")
      var parts = snoozeKey.split('-');
      if (parts.length >= 2) {
        var cId = parts.slice(0, -1).join('-');
        var aIdx = parseInt(parts[parts.length - 1]);
        var chit = chits.find(function(c) { return c.id === cId; });
        if (chit && Array.isArray(chit.alerts) && chit.alerts[aIdx]) {
          alarmName = chit.title || 'Alarm';
          alarmTime = chit.alerts[aIdx].time || '';
          chitId = chit.id;
        }
      }
    }

    var label = _globalFmtTime(alarmTime) + (alarmName !== 'Alarm' ? ' — ' + alarmName : '');
    _globalPlayAlarm();
    _showAlertModal({
      icon: '🔔',
      title: alarmName,
      subtitle: label + ' (snoozed)',
      chitId: chitId,
      onDismiss: function() { _globalStopAlarm(); },
      showSnooze: true,
      snoozeKey: snoozeKey,
      triggerKey: refireKey,
    });
    _sendBrowserNotification('🔔 ' + alarmName, label);
    syncSend('alarm_fired', { title: alarmName, subtitle: label + ' (snoozed)', chitId: chitId, snoozeKey: snoozeKey, triggerKey: refireKey });
  });

  // Delete Past Alarm Chits: auto-archive alarm-only chits whose time has passed
  if (_chitOptions.delete_past_alarm_chits) {
    chits.forEach((chit) => {
      if (!Array.isArray(chit.alerts) || chit.alerts.length === 0) return;
      if (chit.archived || chit.deleted) return;
      // Only affect chits that are alarm-only (no dates, no notes, no checklist)
      if (chit.start_datetime || chit.due_datetime || chit.note) return;
      const hasActiveAlarm = chit.alerts.some(a => a._type === 'alarm' && a.enabled);
      if (!hasActiveAlarm) return;
      // Check if all alarm times for today have passed
      const allPast = chit.alerts.filter(a => a._type === 'alarm' && a.enabled && a.time).every(a => a.time < currentTime);
      if (allPast) {
        fetch(`/api/chits/${chit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...chit, archived: true }) }).catch(() => {});
      }
    });
  }
}

function _globalCheckNotifications() {
  const now = new Date();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "notification" || !alert.value || !alert.unit) return;

      // "Only if undone" — skip if chit is complete (default: true)
      const onlyIfUndone = alert.only_if_undone !== false; // default true
      if (onlyIfUndone && chit.status === 'Complete') return;

      const unitMs = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const offsetMs = alert.value * (unitMs[alert.unit] || 60000);

      // Determine target — use due if present, otherwise start
      const targetStr = chit.due_datetime || chit.start_datetime;
      if (!targetStr) return;

      const targetDate = new Date(targetStr);
      if (isNaN(targetDate.getTime())) return;

      // before = target - offset, after = target + offset
      const fireAt = alert.afterTarget
        ? new Date(targetDate.getTime() + offsetMs)
        : new Date(targetDate.getTime() - offsetMs);
      const diff = now - fireAt;

      // Fire if within 60 seconds past the fire time
      if (diff < 0 || diff > 60000) return;

      const key = `${chit.id}-notif-${alertIdx}-${fireAt.toISOString()}`;
      if (_globalFiredNotifications.has(key)) return;
      _globalFiredNotifications.add(key);

      const targetName = chit.due_datetime ? "due" : "start";
      const dir = alert.afterTarget ? "after" : "before";
      const label = `${alert.value} ${alert.unit} ${dir} ${targetName}`;
      const toastTitle = alert.message ? `${chit.title} — ${alert.message}` : chit.title;
      _showGlobalToast("📢", label, toastTitle, chit.id, null);
      _sendBrowserNotification(`📢 Reminder: ${toastTitle}`, label, chit.id);
    });
  });
}

function _getSnoozeMs() {
  // Delegate to shared helper which properly parses units
  if (typeof _sharedGetSnoozeMs === 'function') return _sharedGetSnoozeMs();
  var s = window._snoozeLength || window._sharedSnoozeLength || '5 minutes';
  var match = String(s).match(/(\d+)\s*(minute|hour|second)/i);
  if (!match) return 5 * 60 * 1000;
  var val = parseInt(match[1]);
  var unit = match[2].toLowerCase();
  if (unit.startsWith('hour')) return val * 3600000;
  if (unit.startsWith('second')) return val * 1000;
  return val * 60000;
}

function _startGlobalAlertSystem() {
  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Parse snooze length from settings
  window._snoozeLength = '5 minutes'; // default
  getCachedSettings().then(s => {
    if (s.snooze_length) window._snoozeLength = s.snooze_length;
  }).catch(() => {});

  // Audio unlock is handled by shared.js initAudioUnlock()

  // Load time format
  getCachedSettings()
    .then((s) => { _globalTimeFormat = s.time_format || "24hour"; })
    .catch(() => {});

  // Load persisted dismiss/snooze states before starting alarm checker
  _loadAlertStates();

  // Alarm checker is now handled by shared.js (_sharedCheckAlarms) on all pages.
  // Keep the dashboard's _globalCheckAlarms for backward compat but don't start a separate interval.
  // The shared system in shared.js handles everything.

  // Start notification checker (every 30 seconds)
  if (!_globalNotifInterval) {
    _globalNotifInterval = setInterval(_globalCheckNotifications, 30000);
    _globalCheckNotifications(); // check immediately on start
  }

  // ── WebSocket sync listeners — dashboard-specific (alarm/timer modals handled by shared.js) ──
  if (typeof syncOn === 'function') {
    // Re-render snooze bars when snoozed on another device
    syncOn('alert_snoozed', function(msg) {
      if (msg.snoozeKey && msg.snoozeUntil) _snoozeRegistry[msg.snoozeKey] = msg.snoozeUntil;
      if (currentTab === 'Alarms' && _alarmsViewMode === 'independent') {
        displayChits();
      }
    });

    // Another device started a timer — start local countdown from end timestamp
    syncOn('timer_started', function(msg) {
      if (!msg.alertId || !msg.endTs) return;
      var rt = _saTimerRuntime[msg.alertId];
      if (!rt) { rt = { remaining: 0, intervalId: null, running: false }; _saTimerRuntime[msg.alertId] = rt; }
      var remainMs = msg.endTs - Date.now();
      if (remainMs <= 0) return;
      rt.remaining = remainMs / 1000;
      rt.running = true;
      rt._endTs = msg.endTs;
      if (currentTab === 'Alarms' && _alarmsViewMode === 'independent') {
        displayChits();
      }
    });

    // Another device paused a timer
    syncOn('timer_paused', function(msg) {
      if (!msg.alertId) return;
      var rt = _saTimerRuntime[msg.alertId];
      if (!rt) return;
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      if (msg.remaining !== undefined) rt.remaining = msg.remaining;
      if (currentTab === 'Alarms' && _alarmsViewMode === 'independent') {
        displayChits();
      }
    });

    // Another device reset a timer
    syncOn('timer_reset', function(msg) {
      if (!msg.alertId) return;
      var rt = _saTimerRuntime[msg.alertId];
      if (rt) {
        clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
        var alert = _independentAlerts.find(function(a) { return a.id === msg.alertId; });
        var alertData = alert ? (alert.data || alert) : {};
        rt.remaining = alertData.totalSeconds || 0;
      }
      if (currentTab === 'Alarms' && _alarmsViewMode === 'independent') {
        displayChits();
      }
    });

    // Another device created/updated/deleted an independent alert — re-fetch
    syncOn('alerts_changed', function() {
      _fetchIndependentAlerts();
    });

    // Another device saved a chit — re-fetch chits
    syncOn('chits_changed', function() {
      fetchChits();
    });
  }

  // Periodic re-fetch of independent alerts as safety net (every 30s)
  setInterval(function() {
    _fetchIndependentAlerts();
    _loadAlertStates();
  }, 30000);
}

// ── End Global Alert System ──────────────────────────────────────────────────
