/**
 * main-views-alarms.js — Alarms view + Independent Alerts board.
 *
 * Contains:
 *   - displayAlarmsView (chits with alerts)
 *   - _displayIndependentAlertsBoard (standalone alarms/timers/stopwatches)
 *   - _setAlarmsMode (list/independent toggle)
 *   - Independent alerts CRUD (_fetchIndependentAlerts, _createIndependentAlert, etc.)
 *   - Card builders (_buildSaAlarmCard, _buildSaTimerCard, _buildSaStopwatchCard)
 *   - Timer/stopwatch runtime state and formatters
 *
 * Depends on: main-views.js (shared helpers), shared.js, main.js globals
 */

// ── Alarms View Mode (Chits list vs Independent board) ───────────────────────
let _alarmsViewMode = localStorage.getItem('cwoc_alarmsViewMode') || 'list'; // 'list' | 'independent'
let _independentAlerts = []; // cached independent alerts from API
let _saTimerRuntime = {}; // independent timer runtime state
let _saSwRuntime = {}; // independent stopwatch runtime state


function _setAlarmsMode(mode) {
  _alarmsViewMode = mode;
  localStorage.setItem('cwoc_alarmsViewMode', mode);
  const listBtn = document.getElementById('alarms-mode-list');
  const indBtn = document.getElementById('alarms-mode-independent');
  const notifBtn = document.getElementById('alarms-mode-notifications');
  if (listBtn) { listBtn.style.background = mode === 'list' ? 'ivory' : ''; listBtn.style.color = mode === 'list' ? '#3b1f0a' : ''; }
  if (indBtn) { indBtn.style.background = mode === 'independent' ? 'ivory' : ''; indBtn.style.color = mode === 'independent' ? '#3b1f0a' : ''; }
  if (notifBtn) { notifBtn.style.background = mode === 'notifications' ? 'ivory' : ''; notifBtn.style.color = mode === 'notifications' ? '#3b1f0a' : ''; }
  if (mode === 'independent') {
    _fetchIndependentAlerts().then(() => displayChits());
  } else {
    displayChits();
  }
}

async function _fetchIndependentAlerts() {
  try {
    const resp = await fetch('/api/standalone-alerts');
    if (!resp.ok) throw new Error('Failed to fetch independent alerts');
    _independentAlerts = await resp.json();
  } catch (e) {
    console.error('Error fetching independent alerts:', e);
    _independentAlerts = [];
  }
}

async function _createIndependentAlert(alertData) {
  try {
    const resp = await fetch('/api/standalone-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData),
    });
    if (!resp.ok) throw new Error('Failed to create independent alert');
    const created = await resp.json();
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
    return created;
  } catch (e) {
    console.error('Error creating independent alert:', e);
  }
}

async function _updateIndependentAlert(id, alertData) {
  try {
    const resp = await fetch(`/api/standalone-alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData),
    });
    if (!resp.ok) throw new Error('Failed to update independent alert');
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
  } catch (e) {
    console.error('Error updating independent alert:', e);
  }
}

async function _deleteIndependentAlert(id) {
  // Clean up runtime state
  const idx = _independentAlerts.findIndex(a => a.id === id);
  if (idx !== -1) {
    const a = _independentAlerts[idx];
    if (a._type === 'timer' && _saTimerRuntime[id]) {
      clearInterval(_saTimerRuntime[id].intervalId);
      delete _saTimerRuntime[id];
    }
    if (a._type === 'stopwatch' && _saSwRuntime[id]) {
      clearInterval(_saSwRuntime[id].intervalId);
      delete _saSwRuntime[id];
    }
  }
  try {
    const resp = await fetch(`/api/standalone-alerts/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete independent alert');
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
  } catch (e) {
    console.error('Error deleting independent alert:', e);
  }
}

/**
 * Alarms tab: list all chits that have any alert (alarm, notification, timer, stopwatch).
 */
function displayAlarmsView(chitsToDisplay) {
  if (_alarmsViewMode === 'independent') {
    return _displayIndependentAlertsBoard();
  }
  if (_alarmsViewMode === 'notifications') {
    return _displayNotificationsView();
  }

  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Include chits with any alert type: alarm flag, notification flag, or alerts array entries
  // But don't count notify-at-start/due flags as alerts for this view
  const alertChits = chitsToDisplay.filter((c) => {
    if (!Array.isArray(c.alerts) || c.alerts.length === 0) {
      return c.alarm || c.notification;
    }
    return c.alerts.length > 0;
  });

  if (alertChits.length === 0) {
    chitList.innerHTML = _emptyState("No chits with alerts found.");
    return;
  }

  const view = document.createElement("div");
  view.className = "alarms-view";

  alertChits.forEach((chit) => {
    const card = document.createElement("div");
    card.className = "chit-card";
    card.draggable = true;
    card.dataset.chitId = chit.id;
    if (chit.archived) card.classList.add("archived-chit");
    if (_isDeclinedByCurrentUser(chit)) card.classList.add("declined-chit");
    applyChitColors(card, chitColor(chit));

    card.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

    // Alert summary
    const alerts = Array.isArray(chit.alerts) ? chit.alerts : [];
    const alarmCount = alerts.filter((a) => a._type === "alarm").length;
    const timerCount = alerts.filter((a) => a._type === "timer").length;
    const swCount = alerts.filter((a) => a._type === "stopwatch").length;
    const notifCount = alerts.filter((a) => a._type === "notification").length;

    const summaryRow = document.createElement("div");
    summaryRow.style.cssText = "margin-top:0.3em;display:flex;align-items:center;gap:0.5em;font-size:0.9em;";
    if (notifCount > 0 || chit.notification) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `📢 ${notifCount || 1}` }));
    if (alarmCount > 0 || chit.alarm) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `🔔 ${alarmCount || 1}` }));
    if (timerCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏱️ ${timerCount}` }));
    if (swCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏲️ ${swCount}` }));
    if (summaryRow.children.length > 0) card.appendChild(summaryRow);

    card.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    // Shift+click: open quick-edit modal
    card.addEventListener("click", (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      if (typeof showQuickEditModal === 'function') {
        showQuickEditModal(chit, function() { displayChits(); });
      }
    });
    // Right-click: open context menu
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (typeof _showChitContextMenu === 'function') {
        _showChitContextMenu(e, chit, function() { displayChits(); });
      }
    });

    view.appendChild(card);
  });

  chitList.appendChild(view);

  // Build long-press map for unified touch gesture (drag + quick-edit)
  var _alLongPressMap = {};
  alertChits.forEach(function (chit) {
    _alLongPressMap[chit.id] = function () { showQuickEditModal(chit, function () { displayChits(); }); };
  });
  enableDragToReorder(view, 'Alarms', () => displayChits(), _alLongPressMap);
}

// ── Independent Alerts Board ─────────────────────────────────────────────────

function _displayIndependentAlertsBoard() {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const types = [
    { key: 'alarm', icon: '🔔', label: 'Alarms' },
    { key: 'timer', icon: '⏱️', label: 'Timers' },
    { key: 'stopwatch', icon: '⏲️', label: 'Stopwatches' },
  ];

  const wrapper = document.createElement("div");
  wrapper.className = "independent-alerts-board";


  types.forEach(typeInfo => {
    const col = document.createElement("div");
    col.className = "sa-column";
    col.dataset.saType = typeInfo.key;

    // Column header with add button
    const colHeader = document.createElement("div");
    colHeader.className = "sa-column-header";
    colHeader.innerHTML = `<span>${typeInfo.icon} ${typeInfo.label}</span>`;
    const addBtn = document.createElement("button");
    addBtn.className = "sa-add-btn";
    addBtn.textContent = "+";
    addBtn.title = `Add ${typeInfo.label.slice(0, -1)}`;
    addBtn.onclick = () => _addIndependentAlert(typeInfo.key);
    colHeader.appendChild(addBtn);
    col.appendChild(colHeader);

    // Cards for this type — apply saved order from localStorage
    var items = _independentAlerts.filter(a => a._type === typeInfo.key);
    var savedOrderKey = 'cwoc_sa_order_' + typeInfo.key;
    try {
      var savedOrder = JSON.parse(localStorage.getItem(savedOrderKey));
      if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        items.sort(function (a, b) {
          var ai = savedOrder.indexOf(String(a.id));
          var bi = savedOrder.indexOf(String(b.id));
          if (ai === -1) ai = savedOrder.length;
          if (bi === -1) bi = savedOrder.length;
          return ai - bi;
        });
      }
    } catch (e) { /* ignore bad localStorage data */ }

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sa-empty";
      empty.textContent = `No independent ${typeInfo.label.toLowerCase()} yet.`;
      col.appendChild(empty);
    } else {
      items.forEach(alert => {
        const data = alert.data || alert;
        var card = _buildIndependentCard(alert.id, typeInfo.key, data);
        card.draggable = true;
        col.appendChild(card);
      });

      // ── HTML5 drag events for desktop parity ─────────────────────────
      var _html5DraggedCard = null;
      col.addEventListener('dragstart', function (e) {
        var card = e.target.closest('.sa-card');
        if (!card) return;
        _html5DraggedCard = card;
        card.classList.add('cwoc-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.alertId || '');
      });
      col.addEventListener('dragend', function (e) {
        if (_html5DraggedCard) {
          _html5DraggedCard.classList.remove('cwoc-dragging');
          _html5DraggedCard = null;
        }
        col.querySelectorAll('.sa-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
      });
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.querySelectorAll('.sa-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
        var target = e.target.closest('.sa-card');
        if (target && target !== _html5DraggedCard) {
          var rect = target.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            target.style.borderTop = '3px solid #8b5a2b';
          } else {
            target.style.borderBottom = '3px solid #8b5a2b';
          }
        }
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!_html5DraggedCard) return;
        var target = e.target.closest('.sa-card');
        if (!target || target === _html5DraggedCard) return;
        var rect = target.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          col.insertBefore(_html5DraggedCard, target);
        } else {
          col.insertBefore(_html5DraggedCard, target.nextSibling);
        }
        // Save new order to localStorage
        var ids = Array.from(col.querySelectorAll('.sa-card[data-alert-id]')).map(function (c) { return c.dataset.alertId; });
        try { localStorage.setItem(savedOrderKey, JSON.stringify(ids)); } catch (e) {}
        _html5DraggedCard.classList.remove('cwoc-dragging');
        _html5DraggedCard = null;
      });

      // ── Touch drag-to-reorder within column (mobile) ─────────────────
      if (typeof enableTouchGesture === 'function') {
        var _saDraggedCard = null;
        col.querySelectorAll('.sa-card').forEach(function (cardEl) {
          enableTouchGesture(cardEl, {
            onDragStart: function () {
              _saDraggedCard = cardEl;
              cardEl.classList.add('cwoc-dragging');
            },
            onDragMove: function (data) {
              if (!_saDraggedCard) return;
              // Clear all drop indicators in this column
              col.querySelectorAll('.sa-card').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Temporarily hide dragged card from hit testing
              _saDraggedCard.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _saDraggedCard.style.pointerEvents = '';
              if (!target) return;
              var targetCard = target.closest('.sa-card');
              if (targetCard && targetCard !== _saDraggedCard) {
                var rect = targetCard.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (data.clientY < midY) {
                  targetCard.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetCard.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_saDraggedCard) return;
              _saDraggedCard.classList.remove('cwoc-dragging');
              // Clear all drop indicators
              col.querySelectorAll('.sa-card').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Find drop target
              _saDraggedCard.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _saDraggedCard.style.pointerEvents = '';
              if (!target) { _saDraggedCard = null; return; }
              var targetCard = target.closest('.sa-card');
              if (!targetCard || targetCard === _saDraggedCard) { _saDraggedCard = null; return; }

              // Reorder in DOM
              var rect = targetCard.getBoundingClientRect();
              if (data.clientY < rect.top + rect.height / 2) {
                col.insertBefore(_saDraggedCard, targetCard);
              } else {
                col.insertBefore(_saDraggedCard, targetCard.nextSibling);
              }

              // Save new order to localStorage
              var ids = Array.from(col.querySelectorAll('.sa-card[data-alert-id]')).map(function (c) { return c.dataset.alertId; });
              try { localStorage.setItem(savedOrderKey, JSON.stringify(ids)); } catch (e) {}
              _saDraggedCard = null;
            },
          });
        });
      }
    }

    wrapper.appendChild(col);
  });

  chitList.appendChild(wrapper);
}

function _addIndependentAlert(type) {
  if (type === 'alarm') {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const defaultTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const dayAbbrs = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    _createIndependentAlert({ _type: 'alarm', name: '', time: defaultTime, days: [dayAbbrs[now.getDay()]], enabled: true });
  } else if (type === 'timer') {
    _createIndependentAlert({ _type: 'timer', name: '', totalSeconds: 0, loop: false });
  } else if (type === 'stopwatch') {
    _createIndependentAlert({ _type: 'stopwatch', name: '' }).then(created => {
      // Auto-start the stopwatch immediately
      if (created && created.id) {
        const id = created.id;
        if (!_saSwRuntime[id]) {
          _saSwRuntime[id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
        }
        const rt = _saSwRuntime[id];
        const startMs = Date.now();
        rt.intervalId = setInterval(() => {
          rt.elapsed = Date.now() - startMs;
          const d = document.getElementById(`sa-sw-display-${id}`);
          if (d) d.textContent = _saSwFmt(rt.elapsed);
        }, 50);
        rt.running = true;
        const btn = document.getElementById(`sa-sw-startstop-${id}`);
        if (btn) btn.textContent = "⏸ Pause";
      }
    });
  }
}

function _buildIndependentCard(id, type, data) {
  const card = document.createElement("div");
  card.className = "sa-card";
  card.dataset.alertId = id;

  if (type === 'alarm') _buildSaAlarmCard(card, id, data);
  else if (type === 'timer') _buildSaTimerCard(card, id, data);
  else if (type === 'stopwatch') _buildSaStopwatchCard(card, id, data);

  return card;
}

// ── Independent Alarm Card ───────────────────────────────────────────────────

function _parseTimeInput(str) {
  // Parse "HH:MM", "H:MM", "HH:MM AM/PM", "H:MM PM" etc. into "HH:MM" 24h format
  if (!str) return null;
  str = str.trim().toUpperCase();
  var match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  var h = parseInt(match[1]), m = parseInt(match[2]), ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function _buildSaAlarmCard(card, id, data) {
  // Name row
  const row1 = document.createElement("div");
  row1.className = "sa-card-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Alarm name";
  nameInput.className = "sa-input sa-name-input";
  if (!data.enabled) nameInput.style.opacity = "0.45";

  // Text input for time — displays in CWOC format, stores as 24h HH:MM
  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.value = _globalFmtTime(data.time || "") || "";
  timeInput.placeholder = _globalTimeFormat === '24hour' ? "HH:MM" : "H:MM AM";
  timeInput.className = "sa-time-input";
  timeInput.inputMode = "numeric";
  if (!data.enabled) timeInput.style.opacity = "0.45";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sa-btn";
  toggleBtn.textContent = data.enabled ? "On" : "Off";
  toggleBtn.onclick = () => {
    data.enabled = !data.enabled;
    // If turning off while snoozed, cancel the snooze
    if (!data.enabled) {
      var _snzKey = 'ia-' + id;
      if (_snoozeRegistry[_snzKey]) {
        delete _snoozeRegistry[_snzKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[_snzKey];
        _persistDismiss(_snzKey);
        syncSend('alert_dismissed', { snoozeKey: _snzKey });
      }
    }
    _updateIndependentAlert(id, data);
  };

  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);

  row1.appendChild(nameInput);
  row1.appendChild(timeInput);
  row1.appendChild(toggleBtn);
  row1.appendChild(delBtn);
  card.appendChild(row1);

  // Days row
  const daysRow = document.createElement("div");
  daysRow.className = "sa-days-row";
  if (!data.enabled) daysRow.style.opacity = "0.45";
  const allDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const wsd = (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) ? parseInt(window._cwocSettings.week_start_day) || 0 : 0;
  for (let d = 0; d < 7; d++) {
    const day = allDays[(wsd + d) % 7];
    const lbl = document.createElement("label");
    lbl.className = "sa-day-label";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = (data.days || []).includes(day);
    cb.addEventListener("change", () => {
      const days = data.days || [];
      if (cb.checked) { if (!days.includes(day)) days.push(day); }
      else { const i = days.indexOf(day); if (i !== -1) days.splice(i, 1); }
      data.days = days;
      _updateIndependentAlert(id, data);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(day));
    daysRow.appendChild(lbl);
  }
  card.appendChild(daysRow);

  // Save name/time on blur
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });
  timeInput.addEventListener("change", () => {
    const parsed = _parseTimeInput(timeInput.value);
    if (parsed) {
      data.time = parsed;
      timeInput.value = _globalFmtTime(parsed);
      if (!data.days || data.days.length === 0) {
        data.days = [allDays[new Date().getDay()]];
      }
      _updateIndependentAlert(id, data);
    } else {
      // Revert to current value
      timeInput.value = _globalFmtTime(data.time || "") || "";
    }
  });

  // Snooze countdown bar — show if this alarm is currently snoozed
  const snoozeKey = `ia-${id}`;
  const snoozeEnd = _snoozeRegistry[snoozeKey];
  if (snoozeEnd && Date.now() < snoozeEnd) {
    const snoozeBar = document.createElement("div");
    snoozeBar.className = "sa-timer-bar";
    snoozeBar.style.marginTop = "0.3em";
    snoozeBar.style.cursor = "pointer";
    snoozeBar.title = "Click to restart snooze · Shift+click to cancel";
    const snoozeFill = document.createElement("div");
    snoozeFill.className = "sa-timer-bar-fill";
    snoozeFill.style.transition = 'none';
    const snoozeText = document.createElement("div");
    snoozeText.className = "sa-timer-bar-text";
    snoozeText.style.fontSize = "1em";
    snoozeBar.appendChild(snoozeFill);
    snoozeBar.appendChild(snoozeText);
    card.appendChild(snoozeBar);

    let _snoozeEndLocal = snoozeEnd;
    const _snoozeInterval = setInterval(() => {
      const remain = Math.max(0, _snoozeEndLocal - Date.now());
      const secs = Math.ceil(remain / 1000);
      const pct = Math.max(0, (remain / _getSnoozeMs()) * 100);
      snoozeFill.style.width = pct + '%';
      const m = Math.floor(secs / 60), s = secs % 60;
      snoozeText.textContent = `💤 ${m}:${String(s).padStart(2,'0')}`;
      if (remain <= 0) { clearInterval(_snoozeInterval); snoozeBar.remove(); }
    }, 200);

    // Click = restart snooze, Shift+click = cancel snooze
    snoozeBar.addEventListener("click", (e) => {
      if (e.shiftKey) {
        // Cancel snooze — dismiss the alarm
        clearInterval(_snoozeInterval);
        delete _snoozeRegistry[snoozeKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[snoozeKey];
        _persistDismiss(snoozeKey);
        syncSend('alert_dismissed', { snoozeKey: snoozeKey });
        snoozeBar.remove();
      } else {
        // Restart snooze
        const newEnd = Date.now() + _getSnoozeMs();
        _snoozeEndLocal = newEnd;
        _snoozeRegistry[snoozeKey] = newEnd;
        if (window._sharedSnoozeRegistry) window._sharedSnoozeRegistry[snoozeKey] = newEnd;
        _persistSnooze(snoozeKey, newEnd);
        syncSend('alert_snoozed', { snoozeKey: snoozeKey, snoozeUntil: newEnd });
      }
    });

    // Long press on mobile = cancel snooze
    let _lpTimer = null;
    snoozeBar.addEventListener("touchstart", () => {
      _lpTimer = setTimeout(() => {
        clearInterval(_snoozeInterval);
        delete _snoozeRegistry[snoozeKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[snoozeKey];
        _persistDismiss(snoozeKey);
        syncSend('alert_dismissed', { snoozeKey: snoozeKey });
        snoozeBar.remove();
      }, 600);
    }, { passive: true });
    snoozeBar.addEventListener("touchend", () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
    snoozeBar.addEventListener("touchmove", () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
  }
}

// ── Independent Timer Card ───────────────────────────────────────────────────

function _saFmtTimer(s, tenths) {
  if (s === undefined || s === null) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  let str = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  if (tenths !== undefined) str += `.${tenths}`;
  return str;
}

function _buildSaTimerCard(card, id, data) {
  if (!_saTimerRuntime[id]) {
    _saTimerRuntime[id] = { remaining: data.totalSeconds || 0, intervalId: null, running: false };
  }
  const rt = _saTimerRuntime[id];

  // Name row (always visible)
  const nameRow = document.createElement("div");
  nameRow.className = "sa-card-row";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Timer name";
  nameInput.className = "sa-input sa-name-input";
  const loopLbl = document.createElement("label");
  loopLbl.className = "sa-day-label";
  const loopCb = document.createElement("input");
  loopCb.type = "checkbox";
  loopCb.checked = !!data.loop;
  loopCb.addEventListener("change", () => { data.loop = loopCb.checked; _updateIndependentAlert(id, data); });
  loopLbl.appendChild(loopCb);
  loopLbl.appendChild(document.createTextNode("🔁"));
  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);
  nameRow.appendChild(nameInput);
  nameRow.appendChild(loopLbl);
  nameRow.appendChild(delBtn);
  card.appendChild(nameRow);
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });

  // Shared display area
  const displayArea = document.createElement("div");
  displayArea.className = "sa-timer-area";

  // Input mode: HH:MM:SS inputs
  const inputRow = document.createElement("div");
  inputRow.className = "sa-timer-input-row";
  const hInput = document.createElement("input");
  hInput.type = "number"; hInput.min = "0"; hInput.placeholder = "HH";
  hInput.value = Math.floor((data.totalSeconds || 0) / 3600) || "";
  hInput.className = "sa-dur-input";
  const mInput = document.createElement("input");
  mInput.type = "number"; mInput.min = "0"; mInput.max = "59"; mInput.placeholder = "MM";
  mInput.value = Math.floor(((data.totalSeconds || 0) % 3600) / 60) || "";
  mInput.className = "sa-dur-input";
  const sInput = document.createElement("input");
  sInput.type = "number"; sInput.min = "0"; sInput.max = "59"; sInput.placeholder = "SS";
  sInput.value = (data.totalSeconds || 0) % 60 || "";
  sInput.className = "sa-dur-input";
  inputRow.appendChild(hInput);
  inputRow.appendChild(document.createTextNode(":"));
  inputRow.appendChild(mInput);
  inputRow.appendChild(document.createTextNode(":"));
  inputRow.appendChild(sInput);

  // Countdown mode: progress bar (HST-style, no CSS transition — instant updates)
  const countdownBar = document.createElement("div");
  countdownBar.className = "sa-timer-bar";
  const barFill = document.createElement("div");
  barFill.className = "sa-timer-bar-fill";
  barFill.style.transition = 'none';
  const barText = document.createElement("div");
  barText.className = "sa-timer-bar-text";
  barText.textContent = _saFmtTimer(rt.remaining);
  countdownBar.appendChild(barFill);
  countdownBar.appendChild(barText);

  displayArea.appendChild(inputRow);
  displayArea.appendChild(countdownBar);
  card.appendChild(displayArea);

  function _showInputMode() { inputRow.style.display = ''; countdownBar.style.display = 'none'; }
  function _showBarMode() { inputRow.style.display = 'none'; countdownBar.style.display = ''; }
  function _updateBar(remainSec, tenths) {
    const total = data.totalSeconds || 1;
    const effective = tenths !== undefined ? remainSec + tenths / 10 : remainSec;
    const pct = Math.max(0, Math.min(100, (effective / total) * 100));
    barFill.style.width = pct + '%';
    barFill.style.background = '';
    barText.textContent = (remainSec < 10 && tenths !== undefined) ? _saFmtTimer(remainSec, tenths) : _saFmtTimer(remainSec);
  }

  // Click countdown bar to pause (keep bar visible, frozen)
  countdownBar.addEventListener("click", () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      if (startStopBtn) startStopBtn.textContent = "▶ Start";
    } else {
      _showInputMode();
    }
  });

  // Controls (declared early so auto-start can reference startStopBtn)
  const controls = document.createElement("div");
  controls.className = "sa-controls";

  const startStopBtn = document.createElement("button");
  startStopBtn.className = "sa-btn";
  startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";

  const resetBtn = document.createElement("button");
  resetBtn.className = "sa-btn";
  resetBtn.textContent = "🔄 Reset";

  // Set initial mode — if running (from sync), auto-start the local countdown
  if (rt.running) {
    _showBarMode();
    _updateBar(rt.remaining);
    if (!rt.intervalId) {
      var _fracRemainInit = rt.remaining * 10;
      rt.intervalId = setInterval(function() {
        _fracRemainInit = Math.max(0, _fracRemainInit - 1);
        rt.remaining = _fracRemainInit / 10;
        var wholeSec = Math.floor(rt.remaining);
        var tenths = Math.floor(_fracRemainInit % 10);
        if (wholeSec < 10) { _updateBar(wholeSec, tenths); } else { _updateBar(Math.ceil(rt.remaining)); }
        if (_fracRemainInit <= 0) {
          clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
          startStopBtn.textContent = "▶ Start";
          rt.remaining = 0;
          _globalPlayTimer();
          barFill.style.width = '100%'; barFill.style.background = ''; barText.textContent = '✓ DONE';
          _showTimerDoneModal(data.name, function() { _globalStopTimer(); });
          if (data.loop) { setTimeout(function() { rt.remaining = data.totalSeconds || 0; startStopBtn.click(); }, 1500); }
          else { setTimeout(function() { _showInputMode(); }, 2500); }
        }
      }, 100);
      startStopBtn.textContent = "⏸ Pause";
    }
  } else if (rt.remaining > 0 && rt.remaining < (data.totalSeconds || 0)) {
    _showBarMode(); _updateBar(rt.remaining);
  } else {
    _showInputMode();
  }

  const updateDuration = () => {
    const total = (parseInt(hInput.value) || 0) * 3600 + (parseInt(mInput.value) || 0) * 60 + (parseInt(sInput.value) || 0);
    data.totalSeconds = total;
    if (!rt.running) { rt.remaining = total; }
    _updateIndependentAlert(id, data);
  };
  [hInput, mInput, sInput].forEach(inp => inp.addEventListener("change", updateDuration));

  // Wire up button handlers
  startStopBtn.onclick = () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      startStopBtn.textContent = "▶ Start";
      syncSend('timer_paused', { alertId: id, remaining: rt.remaining });
      // Cancel server-side timer tracking
      fetch('/api/timer-state', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'independent', source_id: id }) }).catch(function() {});
    } else {
      if (rt.remaining <= 0) rt.remaining = data.totalSeconds || 0;
      _showBarMode();
      _updateBar(rt.remaining);
      var endTs = Date.now() + rt.remaining * 1000;
      rt._endTs = endTs;
      syncSend('timer_started', { alertId: id, totalSeconds: data.totalSeconds, endTs: endTs, name: data.name });
      // Register with server for Ntfy notification when timer expires
      fetch('/api/timer-state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'independent', source_id: id,
          end_ts: new Date(endTs).toISOString(), name: data.name || 'Timer' }) }).catch(function() {});
      // Use 100ms ticks for precision; decrement by 0.1s internally
      let _fracRemain = rt.remaining * 10; // tenths of a second
      rt.intervalId = setInterval(() => {
        _fracRemain = Math.max(0, _fracRemain - 1);
        rt.remaining = _fracRemain / 10;
        const wholeSec = Math.floor(rt.remaining);
        const tenths = Math.floor(_fracRemain % 10);
        if (wholeSec < 10) {
          _updateBar(wholeSec, tenths);
        } else {
          _updateBar(Math.ceil(rt.remaining));
        }
        if (_fracRemain <= 0) {
          clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
          startStopBtn.textContent = "▶ Start";
          rt.remaining = 0;
          _globalPlayTimer();
          barFill.style.width = '100%';
          barFill.style.background = '';
          barText.textContent = '✓ DONE';
          _showTimerDoneModal(data.name, () => { _globalStopTimer(); });
          syncSend('timer_fired', { timerName: data.name, alertId: id });
          if (data.loop) {
            setTimeout(() => {
              rt.remaining = data.totalSeconds || 0;
              startStopBtn.click();
            }, 1500);
          } else {
            setTimeout(() => { _showInputMode(); }, 2500);
          }
        }
      }, 100);
      rt.running = true;
      startStopBtn.textContent = "⏸ Pause";
    }
  };

  resetBtn.onclick = () => {
    clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
    rt.remaining = data.totalSeconds || 0;
    startStopBtn.textContent = "▶ Start";
    _showInputMode();
    syncSend('timer_reset', { alertId: id });
    // Cancel server-side timer tracking
    fetch('/api/timer-state', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_type: 'independent', source_id: id }) }).catch(function() {});
  };

  controls.appendChild(startStopBtn);
  controls.appendChild(resetBtn);
  card.appendChild(controls);
}

// ── Independent Stopwatch Card ───────────────────────────────────────────────

function _saSwFmt(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function _buildSaStopwatchCard(card, id, data) {
  if (!_saSwRuntime[id]) {
    _saSwRuntime[id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
  }
  const rt = _saSwRuntime[id];

  // Name row
  const row1 = document.createElement("div");
  row1.className = "sa-card-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Stopwatch name";
  nameInput.className = "sa-input sa-name-input";
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });

  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);

  row1.appendChild(nameInput);
  row1.appendChild(delBtn);
  card.appendChild(row1);

  // Display
  const display = document.createElement("div");
  display.className = "sa-timer-display";
  display.id = `sa-sw-display-${id}`;
  display.textContent = _saSwFmt(rt.elapsed);
  card.appendChild(display);

  // Controls
  const controls = document.createElement("div");
  controls.className = "sa-controls";

  const startStopBtn = document.createElement("button");
  startStopBtn.className = "sa-btn";
  startStopBtn.id = `sa-sw-startstop-${id}`;
  startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
  startStopBtn.onclick = () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      startStopBtn.textContent = "▶ Start";
    } else {
      const startMs = Date.now() - rt.elapsed;
      rt.intervalId = setInterval(() => {
        rt.elapsed = Date.now() - startMs;
        display.textContent = _saSwFmt(rt.elapsed);
      }, 50);
      rt.running = true;
      startStopBtn.textContent = "⏸ Pause";
    }
  };

  const lapBtn = document.createElement("button");
  lapBtn.className = "sa-btn";
  lapBtn.textContent = "🏁 Lap";
  lapBtn.onclick = () => {
    if (rt.running) {
      rt.laps.push(_saSwFmt(rt.elapsed));
      _renderSaLaps(lapsDiv, rt.laps);
    }
  };

  const resetBtn = document.createElement("button");
  resetBtn.className = "sa-btn";
  resetBtn.textContent = "🔄 Reset";
  resetBtn.onclick = () => {
    clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
    rt.elapsed = 0; rt.laps = [];
    display.textContent = _saSwFmt(0);
    startStopBtn.textContent = "▶ Start";
    _renderSaLaps(lapsDiv, rt.laps);
  };

  controls.appendChild(startStopBtn);
  controls.appendChild(lapBtn);
  controls.appendChild(resetBtn);
  card.appendChild(controls);

  // Laps
  const lapsDiv = document.createElement("div");
  lapsDiv.className = "sa-laps";
  _renderSaLaps(lapsDiv, rt.laps);
  card.appendChild(lapsDiv);
}

function _renderSaLaps(container, laps) {
  container.innerHTML = "";
  if (!laps || laps.length === 0) return;
  laps.forEach((lap, i) => {
    const el = document.createElement("div");
    el.style.cssText = "font-size:0.8em;opacity:0.7;font-family:monospace;";
    el.textContent = `Lap ${i + 1}: ${lap}`;
    container.appendChild(el);
    container.appendChild(el);
  });
}


/* ── Notifications View (Alarms tab mode) ─────────────────────────────────── */

var _notifViewRendering = false;

async function _displayNotificationsView() {
  // Prevent duplicate concurrent renders
  if (_notifViewRendering) return;
  _notifViewRendering = true;

  var chitList = document.getElementById('chit-list');
  chitList.innerHTML = '';

  var container = document.createElement('div');
  container.className = 'notifications-view';
  container.style.cssText = 'padding:12px;';

  try {
    var deviceParam = (typeof _isMobileOverlay === 'function' && _isMobileOverlay()) ? '?device=mobile' : '?device=desktop';
    var resp = await fetch('/api/notifications' + deviceParam);
    if (!resp.ok) { chitList.innerHTML = '<div class="cwoc-empty">Failed to load notifications.</div>'; return; }
    var allNotifs = await resp.json();

    if (allNotifs.length === 0) {
      chitList.innerHTML = '<div class="cwoc-empty">No notifications.</div>';
      return;
    }

    // Split into unread (pending) and addressed (everything else)
    var unread = allNotifs.filter(function(n) { return n.status === 'pending'; });
    var addressed = allNotifs.filter(function(n) { return n.status !== 'pending'; });

    // Sort both by most recent first
    var _sortByDate = function(a, b) { return (b.created_datetime || '').localeCompare(a.created_datetime || ''); };
    unread.sort(_sortByDate);
    addressed.sort(_sortByDate);

    // ── Unread section ──
    if (unread.length > 0) {
      var unreadHeader = document.createElement('div');
      unreadHeader.style.cssText = 'font-size:0.95em;font-weight:bold;color:#4a2c2a;margin-bottom:8px;';
      unreadHeader.textContent = '📬 Unread (' + unread.length + ')';
      container.appendChild(unreadHeader);

      unread.forEach(function(notif) {
        container.appendChild(_buildNotifCard(notif, true));
      });
    }

    // ── Addressed section ──
    if (addressed.length > 0) {
      var addressedHeader = document.createElement('div');
      addressedHeader.style.cssText = 'font-size:0.95em;font-weight:bold;color:#4a2c2a;margin:16px 0 8px;display:flex;align-items:center;gap:10px;';

      var addressedLabel = document.createElement('span');
      addressedLabel.textContent = '📭 Addressed (' + addressed.length + ')';
      addressedHeader.appendChild(addressedLabel);

      var clearBtn = document.createElement('button');
      clearBtn.className = 'action-button';
      clearBtn.style.cssText = 'font-size:0.85em;padding:5px 14px;margin:0;width:auto;';
      clearBtn.textContent = 'Clear Addressed';
      clearBtn.onclick = function(e) { e.stopPropagation(); _clearAddressedNotifsInView(); };
      addressedHeader.appendChild(clearBtn);

      container.appendChild(addressedHeader);

      addressed.forEach(function(notif) {
        container.appendChild(_buildNotifCard(notif, false));
      });
    }

    chitList.appendChild(container);
  } catch (e) {
    chitList.innerHTML = '<div class="cwoc-empty">Error loading notifications.</div>';
  } finally {
    _notifViewRendering = false;
  }
}

/** Build a notification card for the notifications view. */
function _buildNotifCard(notif, isUnread) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function _fmtD(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return ''; return d.getFullYear() + '-' + months[d.getMonth()] + '-' + String(d.getDate()).padStart(2,'0'); }

  var card = document.createElement('div');
  card.className = 'chit-card';
  card.style.cssText = 'margin-bottom:6px;padding:8px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;';
  if (!isUnread) card.style.opacity = '0.7';

  // Title
  if (notif.notification_type === 'reminder') {
    var reminderTitle = document.createElement('span');
    reminderTitle.style.cssText = 'font-weight:bold;color:#4a2c2a;white-space:nowrap;';
    reminderTitle.textContent = '📌 ' + (notif.chit_title || 'Reminder');
    card.appendChild(reminderTitle);
  } else {
    var titleLink = document.createElement('a');
    titleLink.href = '/editor?id=' + encodeURIComponent(notif.chit_id);
    titleLink.textContent = notif.chit_title || '(Untitled)';
    titleLink.style.cssText = 'font-weight:bold;color:#4a2c2a;text-decoration:none;white-space:nowrap;';
    titleLink.onclick = function(e) { e.preventDefault(); if (typeof storePreviousState === 'function') storePreviousState(); window.location.href = this.href; };
    card.appendChild(titleLink);
  }

  // Separator + type info
  var sep1 = document.createElement('span');
  sep1.style.cssText = 'opacity:0.4;';
  sep1.textContent = '·';
  card.appendChild(sep1);

  var infoSpan = document.createElement('span');
  infoSpan.style.cssText = 'font-size:0.8em;opacity:0.7;white-space:nowrap;';
  if (notif.notification_type === 'reminder') {
    infoSpan.textContent = 'Type: ' + (notif.delivery_target === 'desktop' ? 'Next Time On Desktop' : (notif.delivery_target ? notif.delivery_target : 'Reminder'));
  } else {
    var typeWord = notif.notification_type === 'assigned' ? 'Assigned by' : 'From';
    infoSpan.textContent = typeWord + ': ' + (notif.owner_display_name || '?');
  }
  card.appendChild(infoSpan);

  // Sent date
  if (notif.created_datetime) {
    var sentDate = _fmtD(notif.created_datetime);
    if (sentDate) {
      var sep2 = document.createElement('span');
      sep2.style.cssText = 'opacity:0.4;';
      sep2.textContent = '·';
      card.appendChild(sep2);
      var sentSpan = document.createElement('span');
      sentSpan.style.cssText = 'font-size:0.8em;opacity:0.7;white-space:nowrap;';
      sentSpan.textContent = 'Sent: ' + sentDate;
      card.appendChild(sentSpan);
    }
  }

  // Due date
  if (notif.due_datetime) {
    var dueDate = _fmtD(notif.due_datetime);
    if (dueDate) {
      var sepDue = document.createElement('span');
      sepDue.style.cssText = 'opacity:0.4;';
      sepDue.textContent = '·';
      card.appendChild(sepDue);
      var dueSpan = document.createElement('span');
      dueSpan.style.cssText = 'font-size:0.8em;opacity:0.7;white-space:nowrap;';
      dueSpan.textContent = 'Due: ' + dueDate;
      card.appendChild(dueSpan);
    }
  }

  // Start date
  if (notif.start_datetime) {
    var startDate = _fmtD(notif.start_datetime);
    if (startDate) {
      var sepStart = document.createElement('span');
      sepStart.style.cssText = 'opacity:0.4;';
      sepStart.textContent = '·';
      card.appendChild(sepStart);
      var startSpan = document.createElement('span');
      startSpan.style.cssText = 'font-size:0.8em;opacity:0.7;white-space:nowrap;';
      startSpan.textContent = 'Starts: ' + startDate;
      card.appendChild(startSpan);
    }
  }

  // Status badge for addressed items
  if (!isUnread && notif.status) {
    var sep3 = document.createElement('span');
    sep3.style.cssText = 'opacity:0.4;';
    sep3.textContent = '·';
    card.appendChild(sep3);
    var statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size:0.75em;opacity:0.6;white-space:nowrap;font-style:italic;';
    statusSpan.textContent = 'State: ' + notif.status;
    card.appendChild(statusSpan);
  }

  // Spacer
  var spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';
  card.appendChild(spacer);

  // Action buttons
  var btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;align-items:center;';

  if (notif.notification_type === 'reminder') {
    // Reminder: Snooze + Dismiss (only if still unread)
    if (isUnread) {
      var snoozeLen = window._snoozeLength || window._sharedSnoozeLength || '5 minutes';
      var snoozeMatch = String(snoozeLen).match(/(\d+)/);
      var snoozeMins = snoozeMatch ? parseInt(snoozeMatch[1]) : 5;

      var snoozeBtn = document.createElement('button');
      snoozeBtn.className = 'action-button';
      snoozeBtn.style.cssText = 'font-size:0.85em;padding:5px 12px;margin:0;width:auto;';
      snoozeBtn.textContent = 'Snooze ' + snoozeMins + 'm';
      snoozeBtn.onclick = function(e) { e.stopPropagation(); _snoozeNotifInView(notif.id, snoozeMins); };
      btnWrap.appendChild(snoozeBtn);

      var dismissBtn = document.createElement('button');
      dismissBtn.className = 'action-button';
      dismissBtn.style.cssText = 'font-size:0.85em;padding:5px 12px;margin:0;width:auto;';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.onclick = function(e) { e.stopPropagation(); _dismissNotifInView(notif.id); };
      btnWrap.appendChild(dismissBtn);
    }
  } else {
    // Sharing notifications: Accept / Decline pill (always visible)
    var pill = document.createElement('div');
    pill.className = 'cwoc-pill-toggle';
    pill.style.cssText = 'font-size:0.8em;flex-shrink:0;';
    var acceptOpt = document.createElement('span');
    acceptOpt.dataset.val = 'accepted';
    acceptOpt.textContent = '✓ Accept';
    acceptOpt.className = notif.status === 'accepted' ? 'pill-active' : (notif.status === 'pending' ? '' : 'pill-inactive');
    acceptOpt.onclick = function(e) { e.stopPropagation(); _respondNotifInView(notif.id, 'accepted'); };
    pill.appendChild(acceptOpt);
    var declineOpt = document.createElement('span');
    declineOpt.dataset.val = 'declined';
    declineOpt.textContent = '✕ Decline';
    declineOpt.className = notif.status === 'declined' ? 'pill-active' : (notif.status === 'pending' ? '' : 'pill-inactive');
    declineOpt.onclick = function(e) { e.stopPropagation(); _respondNotifInView(notif.id, 'declined'); };
    pill.appendChild(declineOpt);
    btnWrap.appendChild(pill);
  }

  // Delete button (always present)
  var delBtn = document.createElement('button');
  delBtn.className = 'action-button';
  delBtn.style.cssText = 'font-size:0.85em;padding:5px 8px;margin:0;opacity:0.6;width:auto;';
  delBtn.textContent = '🗑️';
  delBtn.title = 'Delete permanently';
  delBtn.onclick = function(e) { e.stopPropagation(); _deleteNotifInView(notif.id); };
  btnWrap.appendChild(delBtn);

  card.appendChild(btnWrap);

  // Double-click to open chit
  if (notif.chit_id) {
    card.addEventListener('dblclick', function() {
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + encodeURIComponent(notif.chit_id);
    });
  }

  return card;
}

async function _respondNotifInView(notifId, status) {
  try {
    var resp = await fetch('/api/notifications/' + encodeURIComponent(notifId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (resp.ok) {
      _displayNotificationsView();
      // Update sidebar/profile badge
      if (typeof _fetchNotifications === 'function') _fetchNotifications();
      if (typeof _fetchProfileNotifications === 'function') _fetchProfileNotifications();
    }
  } catch (e) { console.error('Failed to respond to notification:', e); }
}

async function _dismissNotifInView(notifId) {
  try {
    var resp = await fetch('/api/notifications/' + encodeURIComponent(notifId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' })
    });
    if (resp.ok) {
      _displayNotificationsView();
      if (typeof _fetchNotifications === 'function') _fetchNotifications();
      if (typeof _fetchProfileNotifications === 'function') _fetchProfileNotifications();
    }
  } catch (e) { console.error('Failed to dismiss notification:', e); }
}

async function _deleteNotifInView(notifId) {
  try {
    var resp = await fetch('/api/notifications/' + encodeURIComponent(notifId), {
      method: 'DELETE'
    });
    if (resp.ok) {
      _displayNotificationsView();
      if (typeof _fetchNotifications === 'function') _fetchNotifications();
      if (typeof _fetchProfileNotifications === 'function') _fetchProfileNotifications();
    }
  } catch (e) { console.error('Failed to delete notification:', e); }
}

async function _clearAddressedNotifsInView() {
  try {
    var deviceParam = (typeof _isMobileOverlay === 'function' && _isMobileOverlay()) ? '?device=mobile' : '?device=desktop';
    var resp = await fetch('/api/notifications' + deviceParam);
    if (!resp.ok) return;
    var all = await resp.json();
    var addressed = all.filter(function(n) { return n.status !== 'pending'; });
    for (var i = 0; i < addressed.length; i++) {
      await fetch('/api/notifications/' + encodeURIComponent(addressed[i].id), { method: 'DELETE' });
    }
    _displayNotificationsView();
    if (typeof _fetchNotifications === 'function') _fetchNotifications();
    if (typeof _fetchProfileNotifications === 'function') _fetchProfileNotifications();
  } catch (e) { console.error('Failed to clear addressed notifications:', e); }
}

async function _snoozeNotifInView(notifId, minutes) {
  try {
    var resp = await fetch('/api/notifications/' + encodeURIComponent(notifId) + '/snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: minutes })
    });
    if (resp.ok) {
      if (typeof cwocToast === 'function') cwocToast('Snoozed for ' + minutes + ' minutes', 'info');
      _displayNotificationsView();
      if (typeof _fetchNotifications === 'function') _fetchNotifications();
      if (typeof _fetchProfileNotifications === 'function') _fetchProfileNotifications();
    }
  } catch (e) { console.error('Failed to snooze notification:', e); }
}
