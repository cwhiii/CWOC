/**
 * shared-alarms.js — Global alarm system + quick alert modal + global hotkeys.
 *
 * Runs on EVERY page (dashboard, editor, settings, etc.):
 *   - Fetches chits + independent alerts
 *   - Checks alarms every second, shows modal notifications
 *   - Handles snooze/dismiss with cross-device sync
 *   - Quick Alert modal (! hotkey — adds alarm/timer/stopwatch)
 *   - Global hotkey listener (!, `, ~ — works on all pages)
 *
 * Depends on: shared-utils.js (getCachedSettings), shared.js (syncSend, syncOn,
 *   cwocPlayAudio, initAudioUnlock — but those are defined before this runs
 *   at DOMContentLoaded time since all scripts are loaded synchronously).
 *
 * Loaded BEFORE shared.js.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Global Alarm System — runs on EVERY page (dashboard, editor, settings, etc.)
// Fetches chits + independent alerts, checks alarms every second, shows modals.
// ══════════════════════════════════════════════════════════════════════════════

window._sharedAlarmTriggered = window._sharedAlarmTriggered || new Set();
window._sharedSnoozeRegistry = window._sharedSnoozeRegistry || {};
window._sharedAlarmInterval = null;
window._sharedAlarmAudio = null;
window._sharedTimerAudio = null;
window._sharedAlarmTimeout = null;
window._sharedTimeFormat = '24hour';
window._sharedChits = [];
window._sharedIndependentAlerts = [];

// ── Time format ──
function _sharedFmtTime(time24) {
  if (!time24) return '';
  if (window._sharedTimeFormat === '12hour' || window._sharedTimeFormat === '12houranalog') {
    var parts = time24.split(':').map(Number);
    var h = parts[0], m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }
  return time24;
}

// ── Sound ──
function _sharedPlayAlarm() {
  if (!window._sharedAlarmAudio) window._sharedAlarmAudio = new Audio('/static/alarm.mp3');
  window._sharedAlarmAudio.loop = true;
  cwocPlayAudio(window._sharedAlarmAudio, { loop: true });
  if (window._sharedAlarmTimeout) clearTimeout(window._sharedAlarmTimeout);
  window._sharedAlarmTimeout = setTimeout(_sharedStopAlarm, 5 * 60 * 1000);
}
function _sharedStopAlarm() {
  if (window._sharedAlarmAudio) { window._sharedAlarmAudio.pause(); window._sharedAlarmAudio.currentTime = 0; }
  if (window._sharedAlarmTimeout) { clearTimeout(window._sharedAlarmTimeout); window._sharedAlarmTimeout = null; }
  if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) {}
}
function _sharedPlayTimer() {
  if (!window._sharedTimerAudio) window._sharedTimerAudio = new Audio('/static/timer.mp3');
  window._sharedTimerAudio.loop = true;
  cwocPlayAudio(window._sharedTimerAudio, { loop: true });
}
function _sharedStopTimer() {
  if (window._sharedTimerAudio) { window._sharedTimerAudio.pause(); window._sharedTimerAudio.currentTime = 0; window._sharedTimerAudio.loop = false; }
}

// ── Snooze helpers ──
function _sharedGetSnoozeMs() {
  var len = window._snoozeLength || window._sharedSnoozeLength || '5 minutes';
  var match = String(len).match(/(\d+)\s*(minute|hour|second)/i);
  if (!match) return 5 * 60 * 1000;
  var val = parseInt(match[1]);
  var unit = match[2].toLowerCase();
  if (unit.startsWith('hour')) return val * 3600000;
  if (unit.startsWith('second')) return val * 1000;
  return val * 60000;
}

function _sharedPersistDismiss(key) {
  window._sharedAlarmTriggered.add(key);
  fetch('/api/alert-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: key, state: 'dismissed' }) }).catch(function() {});
}
function _sharedPersistSnooze(key, untilTs) {
  window._sharedSnoozeRegistry[key] = untilTs;
  fetch('/api/alert-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_key: key, state: 'snoozed', until_ts: new Date(untilTs).toISOString() }) }).catch(function() {});
}

// ── Load persisted state ──
function _sharedLoadAlertStates() {
  fetch('/api/alert-state').then(function(r) { return r.json(); }).then(function(states) {
    states.forEach(function(s) {
      if (s.state === 'dismissed') window._sharedAlarmTriggered.add(s.alert_key);
      else if (s.state === 'snoozed' && s.until_ts) window._sharedSnoozeRegistry[s.alert_key] = new Date(s.until_ts).getTime();
    });
  }).catch(function() {});
}

// ── Fetch data ──
function _sharedFetchData() {
  // Sync from dashboard's chits array if available and populated
  if (typeof chits !== 'undefined' && Array.isArray(chits)) {
    window._sharedChits = chits;
  }
  // Always fetch fresh from API too (covers non-dashboard pages and stale data)
  fetch('/api/chits').then(function(r) { return r.json(); }).then(function(data) {
    if (Array.isArray(data) && data.length > 0) window._sharedChits = data;
  }).catch(function() {});

  if (typeof _independentAlerts !== 'undefined' && Array.isArray(_independentAlerts)) {
    window._sharedIndependentAlerts = _independentAlerts;
  }
  fetch('/api/standalone-alerts').then(function(r) { return r.json(); }).then(function(data) {
    if (Array.isArray(data)) window._sharedIndependentAlerts = data;
  }).catch(function() {});
}

// ── Bold alert modal (works on any page) ──
function _sharedShowAlertModal(opts) {
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100000;display:flex;justify-content:center;align-items:center;opacity:0;transition:opacity 0.3s ease;touch-action:none;user-select:none;';
  overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  overlay.addEventListener('wheel', function(e) { e.preventDefault(); }, { passive: false });

  var modal = document.createElement('div');
  modal.style.cssText = "background:url('/static/parchment.jpg') center/cover;background-color:#fff8e1;border:3px solid #8b4513;border-radius:12px;padding:0;width:90%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 60px rgba(212,175,55,0.3);font-family:Lora, Georgia, serif;color:#3c2f2f;text-align:center;overflow:hidden;";
  var bar = document.createElement('div'); bar.style.cssText = 'width:100%;height:6px;background:#e8dcc8;overflow:hidden;';
  var barFill = document.createElement('div'); barFill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);';
  bar.appendChild(barFill); modal.appendChild(bar);
  var iconEl = document.createElement('div'); iconEl.style.cssText = 'font-size:3em;margin:20px 0 8px;line-height:1;'; iconEl.textContent = opts.icon || '🔔'; modal.appendChild(iconEl);
  var titleEl = document.createElement('div'); titleEl.style.cssText = 'font-size:1.5em;font-weight:bold;color:#4a2c2a;margin:0 16px 6px;word-break:break-word;'; titleEl.textContent = opts.title || 'Alert'; modal.appendChild(titleEl);
  if (opts.subtitle) { var subEl = document.createElement('div'); subEl.style.cssText = 'font-size:1.1em;color:#6b4226;margin:0 16px 16px;opacity:0.85;'; subEl.textContent = opts.subtitle; modal.appendChild(subEl); }

  var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:8px;padding:12px 16px 16px;flex-wrap:wrap;justify-content:center;';
  var btnStyle = "flex:1;min-width:100px;padding:10px 16px;font-size:1em;font-weight:bold;font-family:Lora, Georgia, serif;border:2px solid #8b5a2b;border-radius:6px;background:#fdf5e6;color:#4a2c2a;cursor:pointer;min-height:44px;";
  var btnPrimaryStyle = btnStyle + "background:#8b5a2b;color:#fff8e1;border-color:#5a3f2a;";

  // Navigation button — "Go to Chit" or "Go to Alerts"
  function _safeNavigate(url) {
    (async function() {
      // Check for unsaved changes on editor page
      if (typeof markEditorSaved === 'function' && typeof window._editorUnsaved !== 'undefined' && window._editorUnsaved) {
        if (!(await cwocConfirm('You have unsaved changes. Leave this page?', { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }))) return;
      }
      // Check shared-page save system
      if (typeof CwocSaveSystem !== 'undefined' && CwocSaveSystem._instance && CwocSaveSystem._instance._dirty) {
        if (!(await cwocConfirm('You have unsaved changes. Leave this page?', { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }))) return;
      }
      window.location.href = url;
    })();
  }

  if (opts.chitId) {
    var openBtn = document.createElement('button'); openBtn.style.cssText = btnStyle; openBtn.textContent = '📝 Go to Chit';
    openBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      _safeNavigate('/editor?id=' + opts.chitId);
    };
    btnRow.appendChild(openBtn);
  } else {
    // Independent alert — navigate to the independent alerts view
    var goBtn = document.createElement('button'); goBtn.style.cssText = btnStyle; goBtn.textContent = '🛎️ Go to Alerts';
    goBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      // Set the alarms view mode to independent and navigate to dashboard
      try { localStorage.setItem('cwoc_alarmsViewMode', 'independent'); } catch(e) {}
      _safeNavigate('/?tab=Alarms');
    };
    btnRow.appendChild(goBtn);
  }
  var dismissBtn = document.createElement('button'); dismissBtn.style.cssText = btnPrimaryStyle; dismissBtn.textContent = '✕ Dismiss';
  dismissBtn.onclick = function() {
    _sharedStopAlarm(); _sharedStopTimer();
    // Also stop editor-specific audio
    if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
    if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
    _sharedDismissModal(overlay, opts);
    if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
    if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
    syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
  };
  btnRow.appendChild(dismissBtn);
  if (opts.showSnooze) {
    var snoozeBtn = document.createElement('button'); snoozeBtn.style.cssText = btnStyle; snoozeBtn.textContent = '💤 Snooze';
    snoozeBtn.onclick = function() {
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
      _sharedDismissModal(overlay, opts);
      if (opts.snoozeKey) {
        var untilTs = Date.now() + _sharedGetSnoozeMs();
        _sharedPersistSnooze(opts.snoozeKey, untilTs);
        if (opts.triggerKey) window._sharedAlarmTriggered.delete(opts.triggerKey);
        syncSend('alert_snoozed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey, snoozeUntil: untilTs });
      }
      // Re-render alarm containers to show snooze countdown bar
      setTimeout(function() {
        if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
        if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
      }, 400);
    };
    btnRow.appendChild(snoozeBtn);
  }
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  overlay._snoozeKey = opts.snoozeKey; overlay._triggerKey = opts.triggerKey;
  overlay.setAttribute('data-cwoc-alert', 'true');
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.style.opacity = '1';

  // Block keyboard but allow ESC to dismiss and Tab for accessibility
  function _block(e) {
    if (e.key === 'Tab') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      _sharedStopAlarm(); _sharedStopTimer();
      if (typeof _timerAudio !== 'undefined' && _timerAudio) { _timerAudio.pause(); _timerAudio.currentTime = 0; }
      if (typeof _alarmAudio !== 'undefined' && _alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
      _sharedDismissModal(overlay, opts);
      if (opts.triggerKey) _sharedPersistDismiss(opts.triggerKey);
      if (opts.snoozeKey) _sharedPersistDismiss(opts.snoozeKey);
      syncSend('alert_dismissed', { snoozeKey: opts.snoozeKey, triggerKey: opts.triggerKey });
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
  }
  document.addEventListener('keydown', _block, true);
  overlay._blockKeys = _block;

  // Try to unlock audio on click
  modal.addEventListener('click', function() {
    if (window._sharedAlarmAudio && window._sharedAlarmAudio.paused && window._sharedAlarmAudio.loop) window._sharedAlarmAudio.play().catch(function(){});
    if (window._sharedTimerAudio && window._sharedTimerAudio.paused && window._sharedTimerAudio.loop) window._sharedTimerAudio.play().catch(function(){});
  }, { once: true });

  return overlay;
}

function _sharedDismissModal(overlay, opts) {
  overlay.style.opacity = '0';
  if (overlay._blockKeys) document.removeEventListener('keydown', overlay._blockKeys, true);
  setTimeout(function() {
    if (overlay.parentNode) overlay.remove();
    if (!document.querySelector('[data-cwoc-alert]')) { document.body.style.overflow = ''; document.body.style.touchAction = ''; }
  }, 300);
}


// ── Browser notification ──
function _sharedBrowserNotif(title, body, chitId) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    var n = new Notification(title, { body: body, icon: '/static/cwod_logo-favicon.png', tag: 'cwoc-' + (chitId || 'alert'), renotify: true, requireInteraction: true, silent: true });
    n.onclick = function() { window.focus(); if (chitId) window.location.href = '/editor?id=' + chitId; };
  } catch (e) {}
}

// ── The alarm checker — runs every second on every page ──
function _sharedCheckAlarms() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  var currentTime = hh + ':' + mm;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var currentDay = days[now.getDay()];
  var dateStr = now.toDateString();

  // Check chit alarms
  window._sharedChits.forEach(function(chit) {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach(function(alert, idx) {
      if (alert._type !== 'alarm' || !alert.enabled || !alert.time) return;
      var alertDays = alert.days && alert.days.length > 0 ? alert.days : [currentDay];
      if (alertDays.indexOf(currentDay) === -1) return;
      if (alert.time !== currentTime) return;
      var key = chit.id + '-' + idx + '-' + alert.time + '-' + dateStr;
      if (window._sharedAlarmTriggered.has(key)) return;
      var snoozeKey = chit.id + '-' + idx;
      if (window._sharedSnoozeRegistry[snoozeKey] && Date.now() < window._sharedSnoozeRegistry[snoozeKey]) return;
      window._sharedAlarmTriggered.add(key);
      _sharedPlayAlarm();
      _sharedShowAlertModal({ icon: '🔔', title: chit.title || 'Alarm', subtitle: _sharedFmtTime(alert.time) + (alert.name ? ' — ' + alert.name : ''), chitId: chit.id, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: key });
      _sharedBrowserNotif('🔔 Alarm: ' + (chit.title || 'Alarm'), _sharedFmtTime(alert.time), chit.id);
      syncSend('alarm_fired', { title: chit.title, subtitle: _sharedFmtTime(alert.time), chitId: chit.id, snoozeKey: snoozeKey, triggerKey: key });
    });
  });

  // Check independent alarms
  window._sharedIndependentAlerts.forEach(function(ia) {
    var ad = ia.data || ia;
    if (ad._type !== 'alarm' || !ad.enabled || !ad.time) return;
    var alertDays = ad.days && ad.days.length > 0 ? ad.days : [currentDay];
    if (alertDays.indexOf(currentDay) === -1) return;
    if (ad.time !== currentTime) return;
    var key = 'ia-' + ia.id + '-' + ad.time + '-' + dateStr;
    if (window._sharedAlarmTriggered.has(key)) return;
    var snoozeKey = 'ia-' + ia.id;
    if (window._sharedSnoozeRegistry[snoozeKey] && Date.now() < window._sharedSnoozeRegistry[snoozeKey]) return;
    window._sharedAlarmTriggered.add(key);
    var name = ad.name || 'Independent Alarm';
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: name, subtitle: _sharedFmtTime(ad.time), onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: key });
    _sharedBrowserNotif('🔔 ' + name, _sharedFmtTime(ad.time));
    syncSend('alarm_fired', { title: name, subtitle: _sharedFmtTime(ad.time), snoozeKey: snoozeKey, triggerKey: key });
  });

  // Check expired snoozes
  Object.keys(window._sharedSnoozeRegistry).forEach(function(snoozeKey) {
    var until = window._sharedSnoozeRegistry[snoozeKey];
    if (!until || Date.now() < until) return;
    var refireKey = 'snooze-refire-' + snoozeKey + '-' + dateStr;
    if (window._sharedAlarmTriggered.has(refireKey)) return;
    window._sharedAlarmTriggered.add(refireKey);
    delete window._sharedSnoozeRegistry[snoozeKey];
    var name = 'Alarm', time = '', chitId = null;
    if (snoozeKey.indexOf('ia-') === 0) {
      var iaId = snoozeKey.slice(3);
      var ia = window._sharedIndependentAlerts.find(function(a) { return a.id === iaId; });
      if (ia) { var ad = ia.data || ia; name = ad.name || 'Independent Alarm'; time = ad.time || ''; }
    } else {
      var parts = snoozeKey.split('-'); var cId = parts.slice(0,-1).join('-'); var aIdx = parseInt(parts[parts.length-1]);
      var chit = window._sharedChits.find(function(c) { return c.id === cId; });
      if (chit && Array.isArray(chit.alerts) && chit.alerts[aIdx]) { name = chit.title || 'Alarm'; time = chit.alerts[aIdx].time || ''; chitId = chit.id; }
    }
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: name, subtitle: _sharedFmtTime(time) + ' (snoozed)', chitId: chitId, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: snoozeKey, triggerKey: refireKey });
    _sharedBrowserNotif('🔔 ' + name, _sharedFmtTime(time));
    syncSend('alarm_fired', { title: name, subtitle: _sharedFmtTime(time) + ' (snoozed)', chitId: chitId, snoozeKey: snoozeKey, triggerKey: refireKey });
  });

  // Cleanup old keys
  window._sharedAlarmTriggered.forEach(function(key) {
    if (key.indexOf(dateStr) === -1 && key.indexOf('snooze-refire') === -1) window._sharedAlarmTriggered.delete(key);
  });
}

// ── Sync handlers for the shared alarm system ──
function _initSharedAlarmSync() {
  if (typeof syncOn !== 'function') return;

  syncOn('alarm_fired', function(msg) {
    if (msg.triggerKey && window._sharedAlarmTriggered.has(msg.triggerKey)) return;
    if (msg.triggerKey) window._sharedAlarmTriggered.add(msg.triggerKey);
    _sharedPlayAlarm();
    _sharedShowAlertModal({ icon: '🔔', title: msg.title || 'Alarm', subtitle: msg.subtitle || '', chitId: msg.chitId, onDismiss: _sharedStopAlarm, showSnooze: true, snoozeKey: msg.snoozeKey, triggerKey: msg.triggerKey });
  });

  syncOn('alert_dismissed', function(msg) {
    if (msg.triggerKey) window._sharedAlarmTriggered.add(msg.triggerKey);
    if (msg.snoozeKey) {
      window._sharedAlarmTriggered.add(msg.snoozeKey);
      // Clear snooze from registry so the bar disappears
      delete window._sharedSnoozeRegistry[msg.snoozeKey];
      if (typeof _snoozeRegistry !== 'undefined') delete _snoozeRegistry[msg.snoozeKey];
    }
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._snoozeKey === msg.snoozeKey || ov._triggerKey === msg.triggerKey) {
        if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
        ov.remove();
      }
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
    // Re-render to remove snooze bars
    setTimeout(function() {
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
      if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
    }, 300);
  });

  syncOn('alert_snoozed', function(msg) {
    if (msg.snoozeKey && msg.snoozeUntil) window._sharedSnoozeRegistry[msg.snoozeKey] = msg.snoozeUntil;
    if (msg.triggerKey) window._sharedAlarmTriggered.delete(msg.triggerKey);
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._snoozeKey === msg.snoozeKey || ov._triggerKey === msg.triggerKey) {
        if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
        ov.remove();
      }
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
    // Re-render to show snooze countdown bar
    setTimeout(function() {
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
      if (typeof displayChits === 'function' && typeof currentTab !== 'undefined' && currentTab === 'Alarms') displayChits();
    }, 400);
  });

  syncOn('timer_fired', function(msg) {
    _sharedPlayTimer();
    _sharedShowAlertModal({ icon: '⏱️', title: msg.timerName || 'Timer', subtitle: "Time's up!", chitId: msg.chitId || null, onDismiss: _sharedStopTimer, showSnooze: false });
  });

  syncOn('timer_dismissed', function(msg) {
    _sharedStopAlarm(); _sharedStopTimer();
    document.querySelectorAll('[data-cwoc-alert]').forEach(function(ov) {
      if (ov._blockKeys) document.removeEventListener('keydown', ov._blockKeys, true);
      ov.remove();
    });
    document.body.style.overflow = ''; document.body.style.touchAction = '';
  });

  // Data sync
  syncOn('alerts_changed', function() { _sharedFetchData(); });
  syncOn('chits_changed', function() { _sharedFetchData(); });
}

// ── Init the shared alarm system ──
function _initSharedAlarmSystem() {
  // Load settings
  getCachedSettings().then(function(s) {
    window._sharedTimeFormat = s.time_format || '24hour';
    window._sharedSnoozeLength = s.snooze_length || '5 minutes';
  }).catch(function() {});

  // Load persisted state
  _sharedLoadAlertStates();

  // Fetch data
  _sharedFetchData();

  // Request notification permission
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Start alarm checker (every second)
  if (!window._sharedAlarmInterval) {
    window._sharedAlarmInterval = setInterval(_sharedCheckAlarms, 1000);
  }

  // Periodic data refresh (every 30s)
  setInterval(function() { _sharedFetchData(); _sharedLoadAlertStates(); }, 30000);

  // Init sync handlers
  _initSharedAlarmSync();
}


// ── Quick Alert Modal (! hotkey) ─────────────────────────────────────────────
// Opens a modal with A/T/S type picker, then shows a full inline editor
// for the selected alert type. Works on all pages.

function _openQuickAlertModal() {
  if (document.getElementById('cwoc-quick-alert-overlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-quick-alert-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeQuickAlertModal();
  });

  var box = document.createElement('div');
  box.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:24px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:Lora, Georgia, serif;min-width:260px;max-width:340px;text-align:center;color:#2b1e0f;';
  box.className = 'cwoc-quick-alert-box';

  var _optStyle = 'display:flex;align-items:center;gap:12px;padding:10px 14px;margin:4px 0;border:1px solid #e0d4b5;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:1.05em;';
  var _keyStyle = 'display:inline-flex;align-items:center;justify-content:center;min-width:2em;height:2em;background:#8b5a2b;color:#fff8e1;font-weight:bold;font-size:0.95em;border-radius:4px;border:1px solid #5a3f2a;flex-shrink:0;';
  var _btnStyle = 'padding:8px 24px;font-family:Lora, Georgia, serif;font-size:1em;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;cursor:pointer;';

  box.innerHTML =
    '<h3 style="margin:0 0 12px;font-size:1.15em;color:#4a2c2a;">⚡ Quick Alert</h3>' +
    '<p style="margin:0 0 14px;font-size:0.9em;opacity:0.7;">Press a key or click to add:</p>' +
    '<div style="display:flex;flex-direction:column;gap:6px;">' +
      '<div class="cwoc-qa-opt" data-type="alarm" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">A</span>' +
        '<span>🔔 Alarm</span>' +
      '</div>' +
      '<div class="cwoc-qa-opt" data-type="timer" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">T</span>' +
        '<span>⏱️ Timer</span>' +
      '</div>' +
      '<div class="cwoc-qa-opt" data-type="stopwatch" tabindex="0" style="' + _optStyle + '">' +
        '<span style="' + _keyStyle + '">S</span>' +
        '<span>⏲️ Stopwatch</span>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;text-align:center;">' +
      '<button style="' + _btnStyle + '">Cancel</button>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:0.75em;opacity:0.45;text-align:center;">ESC or click outside to close</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Done button handler
  box.querySelector('button').addEventListener('click', function() {
    _closeQuickAlertModal();
  });

  // Hover effect for options
  var opts = box.querySelectorAll('.cwoc-qa-opt');
  for (var i = 0; i < opts.length; i++) {
    (function(opt) {
      opt.addEventListener('mouseenter', function() { opt.style.background = 'rgba(139,69,19,0.12)'; });
      opt.addEventListener('mouseleave', function() { opt.style.background = ''; });
      opt.addEventListener('click', function() {
        _quickAlertShowEditor(opt.getAttribute('data-type'));
      });
    })(opts[i]);
  }

  // Keyboard handler for the modal (capture phase so it fires before page handlers)
  function _qaKeyHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _closeQuickAlertModal();
      return;
    }
    var k = e.key.toLowerCase();
    if (k === 'a') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('alarm'); }
    else if (k === 't') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('timer'); }
    else if (k === 's') { e.preventDefault(); e.stopPropagation(); _quickAlertShowEditor('stopwatch'); }
  }
  overlay._keyHandler = _qaKeyHandler;
  document.addEventListener('keydown', _qaKeyHandler, true);
}

function _closeQuickAlertModal() {
  var overlay = document.getElementById('cwoc-quick-alert-overlay');
  if (!overlay) return;
  if (overlay._keyHandler) {
    document.removeEventListener('keydown', overlay._keyHandler, true);
  }
  overlay.remove();
}

/** Show the inline editor for the selected alert type inside the quick alert modal */
function _quickAlertShowEditor(type) {
  var overlay = document.getElementById('cwoc-quick-alert-overlay');
  if (!overlay) return;
  var box = overlay.querySelector('.cwoc-quick-alert-box');
  if (!box) return;
  if (overlay._keyHandler) { document.removeEventListener('keydown', overlay._keyHandler, true); overlay._keyHandler = null; }
  box.innerHTML = '';
  var labels = { alarm: '🔔 Alarm', timer: '⏱️ Timer', stopwatch: '⏲️ Stopwatch' };
  var heading = document.createElement('h3');
  heading.style.cssText = 'margin:0 0 12px;font-size:1.15em;color:#4a2c2a;';
  heading.textContent = labels[type] || 'Alert';
  box.appendChild(heading);
  var formDiv = document.createElement('div');
  formDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  if (type === 'alarm') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Alarm name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var now = new Date(); now.setMinutes(now.getMinutes() + 1);
    var defTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    var timeInput = document.createElement('input');
    timeInput.type = 'time'; timeInput.value = defTime;
    timeInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:1.1em;font-weight:bold;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(timeInput);
    var daysDiv = document.createElement('div');
    daysDiv.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;font-size:0.9em;';
    var allDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var today = allDays[new Date().getDay()];
    allDays.forEach(function(day) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:2px;cursor:pointer;';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = day; cb.checked = (day === today);
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(day)); daysDiv.appendChild(lbl);
    });
    formDiv.appendChild(daysDiv);
    formDiv._getData = function() {
      var days = []; daysDiv.querySelectorAll('input:checked').forEach(function(cb) { days.push(cb.value); });
      return { _type: 'alarm', name: nameInput.value.trim(), time: timeInput.value, days: days, enabled: true };
    };
    setTimeout(function() { timeInput.focus(); timeInput.select(); }, 50);
  } else if (type === 'timer') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Timer name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var durRow = document.createElement('div');
    durRow.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:center;';
    var hInput = document.createElement('input'); hInput.type = 'number'; hInput.min = '0'; hInput.placeholder = 'HH'; hInput.value = '0';
    hInput.style.cssText = 'width:55px;padding:6px 4px;font-family:inherit;font-size:1.1em;text-align:center;border:1px solid #8b5a2b;border-radius:4px;background:#f5e6cc;';
    var mInput = document.createElement('input'); mInput.type = 'number'; mInput.min = '0'; mInput.max = '59'; mInput.placeholder = 'MM'; mInput.value = '5';
    mInput.style.cssText = hInput.style.cssText;
    var sInput = document.createElement('input'); sInput.type = 'number'; sInput.min = '0'; sInput.max = '59'; sInput.placeholder = 'SS'; sInput.value = '0';
    sInput.style.cssText = hInput.style.cssText;
    durRow.appendChild(hInput); durRow.appendChild(document.createTextNode(':')); durRow.appendChild(mInput);
    durRow.appendChild(document.createTextNode(':')); durRow.appendChild(sInput); formDiv.appendChild(durRow);
    var loopLbl = document.createElement('label');
    loopLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:0.9em;cursor:pointer;';
    var loopCb = document.createElement('input'); loopCb.type = 'checkbox';
    loopLbl.appendChild(loopCb); loopLbl.appendChild(document.createTextNode('🔁 Loop when done')); formDiv.appendChild(loopLbl);
    formDiv._getData = function() {
      var total = (parseInt(hInput.value)||0)*3600 + (parseInt(mInput.value)||0)*60 + (parseInt(sInput.value)||0);
      return { _type: 'timer', name: nameInput.value.trim(), totalSeconds: total, loop: loopCb.checked };
    };
    setTimeout(function() { mInput.focus(); mInput.select(); }, 50);
  } else if (type === 'stopwatch') {
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Stopwatch name (optional)';
    nameInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    formDiv.appendChild(nameInput);
    var note = document.createElement('div'); note.style.cssText = 'font-size:0.85em;opacity:0.6;text-align:center;';
    note.textContent = 'Stopwatch will start automatically'; formDiv.appendChild(note);
    formDiv._getData = function() { return { _type: 'stopwatch', name: nameInput.value.trim() }; };
    setTimeout(function() { nameInput.focus(); }, 50);
  }
  box.appendChild(formDiv);
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:14px;';
  var _qaBtnPrimary = 'padding:8px 14px;cursor:pointer;font-size:0.95em;font-weight:bold;font-family:Lora, Georgia, serif;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;white-space:nowrap;';
  var _qaBtnSecondary = 'padding:8px 14px;cursor:pointer;font-size:0.95em;font-family:Lora, Georgia, serif;background:#fdf5e6;color:#4a2c2a;border:1px solid #8b5a2b;border-radius:4px;white-space:nowrap;';

  var saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Create'; saveBtn.title = 'Enter'; saveBtn.style.cssText = _qaBtnPrimary;
  saveBtn.onclick = function() { _quickAlertSave(type, formDiv._getData(), false); };
  btnRow.appendChild(saveBtn);

  var saveViewBtn = document.createElement('button');
  saveViewBtn.textContent = '✓ Create & View'; saveViewBtn.title = 'Shift+Enter'; saveViewBtn.style.cssText = _qaBtnSecondary + 'font-weight:bold;';
  saveViewBtn.onclick = function() { _quickAlertSave(type, formDiv._getData(), true); };
  btnRow.appendChild(saveViewBtn);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel'; cancelBtn.title = 'Escape'; cancelBtn.style.cssText = _qaBtnSecondary;
  cancelBtn.onclick = function() { _closeQuickAlertModal(); };
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  function _editorKeyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _closeQuickAlertModal(); }
    else if (e.key === 'Enter') {
      var tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag !== 'textarea') {
        e.preventDefault(); e.stopPropagation();
        _quickAlertSave(type, formDiv._getData(), e.shiftKey);
      }
    }
  }
  overlay._keyHandler = _editorKeyHandler;
  document.addEventListener('keydown', _editorKeyHandler, true);
}

function _quickAlertAddToChit() { /* deprecated — now handled by _quickAlertSave */ }
function _quickAlertAddIndependent() { /* deprecated */ }
function _quickAlertAddIndependentDashboard() { /* deprecated */ }

/** Save the alert from the quick alert editor — context-aware */
function _quickAlertSave(type, data, andView) {
  var isEditor = !!document.getElementById('mainEditor');
  if (isEditor) {
    if (!window._alertsData) window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
    var alertsSection = document.getElementById('alertsSection');
    var alertsContent = document.getElementById('alertsContent');
    if (alertsSection && alertsSection.classList.contains('collapsed')) {
      alertsSection.classList.remove('collapsed');
      if (alertsContent) alertsContent.style.display = '';
      var zIcon = alertsSection.querySelector('.zone-toggle-icon');
      if (zIcon) zIcon.textContent = '🔼';
      alertsSection.querySelectorAll('.zone-button').forEach(function(b) { b.style.display = ''; });
    }
    if (type === 'alarm') {
      window._alertsData.alarms.push(data);
      if (typeof renderAlarmsContainer === 'function') renderAlarmsContainer();
    } else if (type === 'timer') {
      window._alertsData.timers.push(data);
      var tIdx = window._alertsData.timers.length - 1;
      if (!window._timerRuntime) window._timerRuntime = {};
      window._timerRuntime[tIdx] = { remaining: data.totalSeconds, intervalId: null, running: false };
      if (typeof renderTimersContainer === 'function') renderTimersContainer();
    } else if (type === 'stopwatch') {
      var swIdx = window._alertsData.stopwatches.length;
      window._alertsData.stopwatches.push(data);
      if (!window._swRuntime) window._swRuntime = {};
      window._swRuntime[swIdx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
      var swRt = window._swRuntime[swIdx]; var swStart = Date.now();
      swRt.intervalId = setInterval(function() { swRt.elapsed = Date.now() - swStart; var swD = document.getElementById('sw-display-' + swIdx); if (swD && typeof _swFmt === 'function') swD.textContent = _swFmt(swRt.elapsed); }, 50);
      swRt.running = true;
      if (typeof renderStopwatchesContainer === 'function') renderStopwatchesContainer();
      setTimeout(function() { var swBtn = document.getElementById('sw-startstop-' + swIdx); if (swBtn) swBtn.textContent = '⏸ Pause'; }, 50);
    }
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    _closeQuickAlertModal();
    if (alertsSection) alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (typeof _createIndependentAlert === 'function') {
    _createIndependentAlert(data).then(function(created) {
      if (type === 'stopwatch' && created && created.id && typeof _saSwRuntime !== 'undefined') {
        if (!_saSwRuntime[created.id]) _saSwRuntime[created.id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
        var saRt = _saSwRuntime[created.id]; var saMs = Date.now();
        saRt.intervalId = setInterval(function() { saRt.elapsed = Date.now() - saMs; var saD = document.getElementById('sa-sw-display-' + created.id); if (saD) saD.textContent = _saSwFmt(saRt.elapsed); }, 50);
        saRt.running = true;
      }
      if (andView) {
        _quickAlertJumpToIndependent();
      } else {
        _closeQuickAlertModal();
      }
    });
  } else {
    fetch('/api/standalone-alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(function(r) { if (!r.ok) throw new Error('Failed'); return r.json(); })
    .then(function() {
      _closeQuickAlertModal();
      if (andView) {
        // Store desired tab in localStorage so dashboard picks it up on load
        try { localStorage.setItem('cwoc_jump_tab', 'Alarms'); localStorage.setItem('cwoc_jump_alarms_mode', 'independent'); } catch(e) {}
        window.location.href = '/';
      } else {
        _showQuickAlertToast(type);
      }
      if (typeof syncSend === 'function') syncSend('alerts_changed', {});
    })
    .catch(function(e) { console.error('Quick alert creation failed:', e); });
  }
}

function _quickAlertJumpToIndependent() {
  _closeQuickAlertModal();
  if (typeof _alarmsViewMode !== 'undefined') {
    _alarmsViewMode = 'independent';
    var toggle = document.getElementById('alerts-view-toggle');
    if (toggle) toggle.value = 'independent';
  }
  if (typeof filterChits === 'function') filterChits('Alarms');
}

function _showQuickAlertToast(type) {
  var labels = { alarm: '🔔 Alarm', timer: '⏱️ Timer', stopwatch: '⏲️ Stopwatch' };
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#fff8e1;border:2px solid #8b4513;border-radius:8px;padding:10px 18px;box-shadow:0 4px 16px rgba(0,0,0,0.3);font-family:Lora, Georgia, serif;font-size:0.95em;color:#4a2c2a;display:flex;align-items:center;gap:10px;';
  toast.appendChild(document.createTextNode((labels[type] || 'Alert') + ' created '));
  var viewLink = document.createElement('a'); viewLink.textContent = 'View →'; viewLink.href = '/?tab=Alarms&view=independent';
  viewLink.style.cssText = 'color:#6b4226;font-weight:bold;text-decoration:underline;'; toast.appendChild(viewLink);
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 3000);
  setTimeout(function() { toast.remove(); }, 3300);
}

// ── Global Hotkey Listener (shared across ALL pages) ─────────────────────────
// This runs on every page that loads shared.js — dashboard, editor, settings, etc.
// Handles: ! (quick alert), ` (sidebar toggle, dashboard only), ~ (topbar toggle, dashboard only)

function _initSharedHotkeys() {
  document.addEventListener('keydown', function(e) {
    // Skip if inside a text input
    var el = document.activeElement;
    var tag = el ? (el.tagName || '').toLowerCase() : '';
    var inputType = el ? (el.type || '').toLowerCase() : '';
    var isTextInput = (tag === 'input' && inputType !== 'checkbox' && inputType !== 'radio')
      || tag === 'textarea' || tag === 'select'
      || (el && el.isContentEditable);
    if (isTextInput) return;

    // Skip if modifier keys (except Shift, which is needed for ! and ~)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Skip if the quick alert modal is already open (it has its own capture handler)
    if (document.getElementById('cwoc-quick-alert-overlay')) return;

    var key = e.key;

    // ── ! = Quick Alert modal (works on ALL pages) ──
    if (key === '!') {
      e.preventDefault();
      _openQuickAlertModal();
      return;
    }

    // ── Dashboard-only hotkeys (check for sidebar element) ──
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return; // Not on dashboard — skip ` and ~

    // Skip if dashboard has its own hotkey mode active
    if (typeof _hotkeyMode !== 'undefined' && _hotkeyMode) return;

    // ── ` = Toggle sidebar ──
    if (key === '`' && !e.shiftKey) {
      e.preventDefault();
      if (typeof toggleSidebar === 'function') toggleSidebar();
      return;
    }

    // ── ~ = Toggle topbar ──
    if (key === '~') {
      e.preventDefault();
      if (typeof _toggleTopbar === 'function') _toggleTopbar();
      return;
    }
  });
}
