/* Main application functionality */
let currentTab = "Calendar";
let chits = [];
let currentWeekStart = null;
let currentView = "Week";
let previousState = { tab: "Calendar", view: "Week" };

// ── Sort & filter state ──────────────────────────────────────────────────────
let currentSortField = null;   // null | 'title' | 'start' | 'due' | 'updated' | 'created'
let currentSortDir = 'asc';    // 'asc' | 'desc'

// ── Hotkey submenu state ─────────────────────────────────────────────────────
let _hotkeyMode = null;  // null | 'PERIOD' | 'FILTER' | 'ORDER' | 'FILTER_STATUS' | 'FILTER_LABEL' | 'FILTER_PRIORITY'

function onSortSelectChange() {
  const sel = document.getElementById('sort-select');
  currentSortField = sel ? sel.value || null : null;
  currentSortDir = 'asc';
  _updateSortUI();
  displayChits();
}

function toggleSortDir() {
  currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  _updateSortUI();
  displayChits();
}

function _updateSortUI() {
  const dirBtn = document.getElementById('sort-dir-btn');
  if (!dirBtn) return;
  if (currentSortField && currentSortField !== 'manual') {
    dirBtn.style.display = '';
    dirBtn.textContent = currentSortDir === 'asc' ? '▲' : '▼';
    dirBtn.title = currentSortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse';
  } else {
    dirBtn.style.display = 'none';
  }
}

function onFilterChange() {
  displayChits();
  _updateClearFiltersButton();
}

function _clearAllFilters() {
  document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  const sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
  const sa = document.getElementById('show-archived'); if (sa) sa.checked = false;
  const su = document.getElementById('show-unmarked'); if (su) su.checked = true;
  const search = document.getElementById('search'); if (search) search.value = '';
  currentSortField = null;
  const sortSel = document.getElementById('sort-select'); if (sortSel) sortSel.value = '';
  _updateSortUI();
  onFilterChange();
}

function _updateClearFiltersButton() {
  const btn = document.getElementById('section-clear-filters');
  if (!btn) return;
  // Check if any filters are active
  const hasStatusFilter = _getSelectedStatuses().length > 0;
  const hasLabelFilter = _getSelectedLabels().length > 0;
  const hasPriorityFilter = _getSelectedPriorities().length > 0;
  const searchText = document.getElementById('search')?.value || '';
  const showPinned = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? false;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;
  // Default state: pinned=true, archived=false, unmarked=true, no search, no filters, no sort
  const isDefault = !hasStatusFilter && !hasLabelFilter && !hasPriorityFilter
    && !searchText && showPinned && !showArchived && showUnmarked && !currentSortField;
  btn.style.display = isDefault ? 'none' : '';
}

function _applyArchiveFilter(chitList) {
  const showPinned   = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? true;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;

  if (showPinned && showArchived && showUnmarked) return chitList;
  if (!showPinned && !showArchived && !showUnmarked) return chitList;

  return chitList.filter((c) => {
    const isPinned   = !!c.pinned;
    const isArchived = !!c.archived;
    const isUnmarked = !isPinned && !isArchived;
    return (isPinned && showPinned) || (isArchived && showArchived) || (isUnmarked && showUnmarked);
  });
}

function _getSelectedStatuses() {
  const boxes = document.querySelectorAll('#status-multi input[data-filter="status"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals; // empty = "Any" checked or nothing specific = show all
}

function _getSelectedLabels() {
  const boxes = document.querySelectorAll('#label-multi input[data-filter="label"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals;
}

function _getSelectedPriorities() {
  const boxes = document.querySelectorAll('#priority-multi input[data-filter="priority"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals;
}

function _applyMultiSelectFilters(chitList) {
  let result = chitList;

  const statuses = _getSelectedStatuses();
  if (statuses.length > 0) {
    result = result.filter(c => c.status && statuses.includes(c.status));
  }

  const labels = _getSelectedLabels();
  if (labels.length > 0) {
    result = result.filter(c => {
      const tags = c.tags || [];
      return labels.some(l => tags.includes(l));
    });
  }

  const priorities = _getSelectedPriorities();
  if (priorities.length > 0) {
    result = result.filter(c => c.priority && priorities.includes(c.priority));
  }

  return result;
}

function _applySort(chitList) {
  if (!currentSortField) return chitList;
  if (currentSortField === 'manual') {
    return applyManualOrder(currentTab, chitList);
  }
  const nullLast = currentSortDir === 'asc' ? Infinity : -Infinity;
  return [...chitList].sort((a, b) => {
    let valA, valB;
    if (currentSortField === 'title') {
      valA = a.title ? a.title.toLowerCase() : null;
      valB = b.title ? b.title.toLowerCase() : null;
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
    } else if (currentSortField === 'start') {
      valA = a.start_datetime ? new Date(a.start_datetime).getTime() : nullLast;
      valB = b.start_datetime ? new Date(b.start_datetime).getTime() : nullLast;
    } else if (currentSortField === 'due') {
      valA = a.due_datetime ? new Date(a.due_datetime).getTime() : nullLast;
      valB = b.due_datetime ? new Date(b.due_datetime).getTime() : nullLast;
    } else if (currentSortField === 'updated') {
      valA = a.modified_datetime ? new Date(a.modified_datetime).getTime() : nullLast;
      valB = b.modified_datetime ? new Date(b.modified_datetime).getTime() : nullLast;
    } else if (currentSortField === 'created') {
      valA = a.created_datetime ? new Date(a.created_datetime).getTime() : nullLast;
      valB = b.created_datetime ? new Date(b.created_datetime).getTime() : nullLast;
    } else if (currentSortField === 'status') {
      const order = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, 'Complete': 4 };
      valA = order[a.status] || 99;
      valB = order[b.status] || 99;
    }
    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Sidebar dimming → Full-screen overlay + floating panels ──────────────────

// Helper: build a chit card header row with icons, title, and orderable meta
// Returns a div with: [pinned icon][archived icon] Title ... meta values
function _buildChitHeader(chit, titleHtml) {
  const row = document.createElement('div');
  row.className = 'chit-header-row';

  const left = document.createElement('div');
  left.className = 'chit-header-left';

  if (chit.pinned) {
    const icon = document.createElement('i');
    icon.className = 'fas fa-bookmark';
    icon.title = 'Pinned';
    icon.style.fontSize = '0.85em';
    left.appendChild(icon);
  }
  if (chit.archived) {
    const icon = document.createElement('span');
    icon.textContent = '📦';
    icon.title = 'Archived';
    left.appendChild(icon);
  }

  const title = document.createElement('span');
  title.className = 'chit-header-title';
  if (titleHtml) {
    title.innerHTML = titleHtml;
  } else {
    title.textContent = chit.title || '(Untitled)';
  }
  left.appendChild(title);

  row.appendChild(left);

  // Meta values in a single row on the right
  const right = document.createElement('div');
  right.className = 'chit-header-meta';

  const sortIndicator = currentSortDir === 'asc' ? ' ▲' : ' ▼';

  function addMeta(text, fieldName) {
    const s = document.createElement('span');
    s.textContent = text;
    if (currentSortField === fieldName) {
      s.style.fontWeight = 'bold';
      s.textContent = text + sortIndicator;
    }
    right.appendChild(s);
  }

  if (chit.status) addMeta(chit.status, 'status');
  if (chit.priority) addMeta(chit.priority, null);
  if (chit.due_datetime) addMeta(`Due: ${formatDate(new Date(chit.due_datetime))}`, 'due');
  if (chit.start_datetime) addMeta(`Start: ${formatDate(new Date(chit.start_datetime))}`, 'start');
  if (chit.modified_datetime) addMeta(`Upd: ${formatDate(new Date(chit.modified_datetime))}`, 'updated');
  if (chit.created_datetime) addMeta(`Cre: ${formatDate(new Date(chit.created_datetime))}`, 'created');
  const tags = chit.tags || [];
  if (tags.length > 0) addMeta(tags.join(', '), null);

  row.appendChild(right);
  return row;
}

// Compact meta for Notes view (just icons before title, no meta row)
function _renderChitMeta(chit, mode) {
  // Legacy — kept for any remaining callers but views should use _buildChitHeader
  const meta = document.createElement('div');
  meta.className = 'chit-meta';
  return meta;
}

function _showPanel(panelId) {
  document.getElementById('hotkey-overlay')?.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
}

function _hideAllPanels() {
  document.getElementById('hotkey-overlay')?.classList.remove('active');
  document.querySelectorAll('.hotkey-panel').forEach(p => p.classList.remove('active'));
}

function _dimSidebar(activeId, activeFilterGroupId) {
  // Now uses full-screen overlay + floating panels instead of sidebar dimming
}

function _undimSidebar() {
  _hideAllPanels();
}

function _exitHotkeyMode() {
  _hotkeyMode = null;
  _hideAllPanels();
}

// ── Panel click handlers ─────────────────────────────────────────────────────
function _pickPeriod(period) {
  currentView = period;
  const sel = document.getElementById('period-select');
  if (sel) sel.value = currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
  _exitHotkeyMode();
}

function _enterFilterSub(type) {
  _hideAllPanels();
  if (type === 'status') {
    _hotkeyMode = 'FILTER_STATUS';
    _buildFilterSubPanel('panel-status-options', '#status-multi input[data-filter="status"]');
    _showPanel('panel-filter-status');
  } else if (type === 'label') {
    _hotkeyMode = 'FILTER_LABEL';
    _buildFilterSubPanel('panel-label-options', '#label-multi input[data-filter="label"]');
    _showPanel('panel-filter-label');
  } else if (type === 'priority') {
    _hotkeyMode = 'FILTER_PRIORITY';
    _buildFilterSubPanel('panel-priority-options', '#priority-multi input[data-filter="priority"]');
    _showPanel('panel-filter-priority');
  }
}

function _buildFilterSubPanel(containerId, checkboxSelector) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const boxes = document.querySelectorAll(checkboxSelector);
  boxes.forEach((cb, i) => {
    const label = cb.parentElement?.textContent?.trim() || cb.value || '—';
    const div = document.createElement('div');
    div.className = 'hotkey-panel-option' + (cb.checked ? ' selected' : '');
    div.innerHTML = `<span class="panel-key">${i + 1}</span><span class="panel-label">${label}</span>`;
    div.onclick = () => {
      cb.checked = !cb.checked;
      div.classList.toggle('selected', cb.checked);
      onFilterChange();
    };
    container.appendChild(div);
  });
}

function _toggleFilterArchived() {
  const cb = document.getElementById('show-archived');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _toggleFilterPinned() {
  const cb = document.getElementById('show-pinned');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _filterFocusSearch() {
  _exitHotkeyMode();
  const searchInput = document.getElementById('search');
  if (searchInput) searchInput.focus();
}

function _pickSort(field) {
  currentSortField = field;
  currentSortDir = 'asc';
  const sel = document.getElementById('sort-select');
  if (sel) sel.value = currentSortField;
  _updateSortUI();
  displayChits();
  _exitHotkeyMode();
}

// ── Reference overlay ────────────────────────────────────────────────────────
function _toggleReference() {
  const overlay = document.getElementById('reference-overlay');
  if (!overlay) return;
  overlay.classList.toggle('active');
}

function _closeReference() {
  const overlay = document.getElementById('reference-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── Load label/tag filters from settings ─────────────────────────────────────
async function _loadLabelFilters() {
  try {
    const container = document.getElementById('label-multi');
    if (!container) return;

    // Collect tags from settings API
    let tagNames = [];
    try {
      const resp = await fetch('/api/settings/default_user');
      if (resp.ok) {
        const settings = await resp.json();
        const tags = settings.tags ? (typeof settings.tags === 'string' ? JSON.parse(settings.tags) : settings.tags) : [];
        tagNames = tags.map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
      }
    } catch (e) { /* ignore */ }

    // Also collect tags from loaded chits as fallback
    if (tagNames.length === 0 && chits.length > 0) {
      const seen = new Set();
      chits.forEach(c => {
        (c.tags || []).forEach(t => {
          if (t && !seen.has(t)) { seen.add(t); tagNames.push(t); }
        });
      });
      tagNames.sort();
    }

    // Preserve current selections (or restore pending from state)
    const prevSelected = new Set();
    container.querySelectorAll('input:checked').forEach(cb => prevSelected.add(cb.value));
    if (window._pendingLabelFilters) {
      window._pendingLabelFilters.forEach(v => prevSelected.add(v));
      delete window._pendingLabelFilters;
    }

    container.innerHTML = '';
    if (tagNames.length === 0) {
      container.innerHTML = '<span style="font-size:0.8em;opacity:0.5;">No tags defined</span>';
      return;
    }
    tagNames.forEach(name => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = name;
      cb.dataset.filter = 'label';
      cb.checked = prevSelected.has(name);
      cb.onchange = onFilterChange;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + name));
      container.appendChild(lbl);
    });
  } catch (e) {
    console.log('Could not load label filters:', e);
  }
}

// ── Period (was "View") ──────────────────────────────────────────────────────
function changePeriod() {
  const sel = document.getElementById('period-select');
  if (!sel) return;
  currentView = sel.value;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function goToToday() {
  const now = new Date();
  if (currentView === 'Week') currentWeekStart = getWeekStart(now);
  else if (currentView === 'Month') currentWeekStart = getMonthStart(now);
  else if (currentView === 'Year') currentWeekStart = getYearStart(now);
  else currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  updateDateRange();
  displayChits();
}

// ── Global Alert System ──────────────────────────────────────────────────────

const _globalTriggeredAlarms = new Set(); // "chitId-alarmIdx-HH:MM-dateStr"
const _globalFiredNotifications = new Set(); // "chitId-notifIdx-fireISOStr"
let _globalAlarmInterval = null;
let _globalNotifInterval = null;
let _globalAlarmAudio = null;
let _globalTimerAudio = null;
let _globalTimeFormat = "24hour";

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
    _globalAlarmAudio.loop = true;
  }
  // Resume AudioContext if suspended (browser autoplay policy)
  _globalAlarmAudio.currentTime = 0;
  const playPromise = _globalAlarmAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — queue it to play on next user interaction
      const unlock = () => {
        _globalAlarmAudio.play().catch(() => {});
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    });
  }
}

function _globalStopAlarm() {
  if (_globalAlarmAudio) { _globalAlarmAudio.pause(); _globalAlarmAudio.currentTime = 0; }
}

function _globalPlayTimer() {
  if (!_globalTimerAudio) _globalTimerAudio = new Audio("/static/timer.mp3");
  _globalTimerAudio.currentTime = 0;
  _globalTimerAudio.play().catch(() => {});
}

function _globalDayAbbr(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

/**
 * Show a persistent toast notification with chit title and Open button.
 * Clicking Open navigates to the chit editor.
 */
function _showGlobalToast(emoji, label, chitTitle, chitId, onDismiss) {
  const toast = document.createElement("div");
  toast.style.cssText = [
    "position:fixed",
    "top:16px",
    "right:16px",
    "z-index:99999",
    "background:#fff5e6",
    "border:2px solid #8b5a2b",
    "border-radius:8px",
    "padding:0.75em 1em",
    "box-shadow:0 4px 20px rgba(0,0,0,0.35)",
    "min-width:240px",
    "max-width:320px",
    "font-family:'Courier New',monospace",
    "display:flex",
    "flex-direction:column",
    "gap:0.4em",
  ].join(";");

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
  openBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
    window.location.href = `/editor?id=${chitId}`;
  };

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.cssText = "padding:3px 8px;cursor:pointer;";
  dismissBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
  };

  const snoozeBtn = document.createElement("button");
  snoozeBtn.textContent = "Snooze 5m";
  snoozeBtn.style.cssText = "padding:3px 8px;cursor:pointer;";
  snoozeBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
    // Snooze handled by caller if needed
  };

  btnRow.appendChild(openBtn);
  btnRow.appendChild(dismissBtn);
  if (emoji === "🔔") btnRow.appendChild(snoozeBtn);

  toast.appendChild(titleRow);
  toast.appendChild(labelRow);
  toast.appendChild(btnRow);
  document.body.appendChild(toast);

  // Auto-dismiss after 60 seconds
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 60000);

  return toast;
}

function _sendBrowserNotification(title, body, chitId) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/static/cwod_logo-favicon.png" });
  n.onclick = () => {
    window.focus();
    window.location.href = `/editor?id=${chitId}`;
  };
}

function _globalCheckAlarms() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const currentTime = `${hh}:${mm}`;
  const currentDay = _globalDayAbbr(now);
  const dateStr = now.toDateString();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "alarm" || !alert.enabled || !alert.time) return;
      const days = alert.days && alert.days.length > 0 ? alert.days : [currentDay];
      if (!days.includes(currentDay)) return;
      if (alert.time !== currentTime) return;

      const key = `${chit.id}-${alertIdx}-${alert.time}-${dateStr}`;
      if (_globalTriggeredAlarms.has(key)) return;
      _globalTriggeredAlarms.add(key);

      const label = `${_globalFmtTime(alert.time)}${alert.name ? " — " + alert.name : ""}`;
      _globalPlayAlarm();
      const toast = _showGlobalToast("🔔", label, chit.title, chit.id, _globalStopAlarm);

      // Snooze: update the alert time +5 min in the chit (requires re-save — just update display for now)
      const snoozeBtn = toast.querySelector("button:last-child");
      if (snoozeBtn) {
        snoozeBtn.onclick = () => {
          toast.remove();
          _globalStopAlarm();
          // Re-trigger in 5 minutes by removing the key after 5 min
          setTimeout(() => _globalTriggeredAlarms.delete(key), 5 * 60 * 1000);
        };
      }

      _sendBrowserNotification(`🔔 Alarm: ${chit.title}`, label, chit.id);
    });
  });

  // Clean up old keys
  _globalTriggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _globalTriggeredAlarms.delete(key);
  });
}

function _globalCheckNotifications() {
  const now = new Date();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "notification" || !alert.value || !alert.unit) return;

      const unitMs = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const offsetMs = alert.value * (unitMs[alert.unit] || 60000);

      const targetStr = alert.relativeTo
        ? (chit.due_datetime || chit.start_datetime)
        : chit.start_datetime;
      if (!targetStr) return;

      const targetDate = new Date(targetStr);
      if (isNaN(targetDate.getTime())) return;

      const fireAt = new Date(targetDate.getTime() - offsetMs);
      const diff = now - fireAt;

      // Fire if within 60 seconds past the fire time (check runs every 30s)
      if (diff < 0 || diff > 60000) return;

      const key = `${chit.id}-notif-${alertIdx}-${fireAt.toISOString()}`;
      if (_globalFiredNotifications.has(key)) return;
      _globalFiredNotifications.add(key);

      const label = `${alert.value} ${alert.unit} before ${alert.relativeTo ? "due/start" : "start"}`;
      _showGlobalToast("📢", label, chit.title, chit.id, null);
      _sendBrowserNotification(`📢 Reminder: ${chit.title}`, label, chit.id);
    });
  });
}

function _startGlobalAlertSystem() {
  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Pre-unlock audio on first user interaction so alarms can play immediately
  const unlockAudio = () => {
    if (!_globalAlarmAudio) _globalAlarmAudio = new Audio("/static/alarm.mp3");
    if (!_globalTimerAudio) _globalTimerAudio = new Audio("/static/timer.mp3");
    // Play and immediately pause to unlock the audio context
    _globalAlarmAudio.play().then(() => _globalAlarmAudio.pause()).catch(() => {});
    _globalTimerAudio.play().then(() => _globalTimerAudio.pause()).catch(() => {});
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
  };
  document.addEventListener("click", unlockAudio, { once: true });
  document.addEventListener("keydown", unlockAudio, { once: true });

  // Load time format
  fetch("/api/settings/default_user")
    .then((r) => r.json())
    .then((s) => { _globalTimeFormat = s.time_format || "24hour"; })
    .catch(() => {});

  // Start alarm checker (every second)
  if (!_globalAlarmInterval) {
    _globalAlarmInterval = setInterval(_globalCheckAlarms, 1000);
  }

  // Start notification checker (every 30 seconds)
  if (!_globalNotifInterval) {
    _globalNotifInterval = setInterval(_globalCheckNotifications, 30000);
    _globalCheckNotifications(); // check immediately on start
  }
}

// ── End Global Alert System ──────────────────────────────────────────────────

function storePreviousState() {
  previousState = { tab: currentTab, view: currentView };
  // Save full UI state to localStorage for restoration after editor
  const state = {
    tab: currentTab,
    view: currentView,
    sortField: currentSortField,
    sortDir: currentSortDir,
    search: document.getElementById('search')?.value || '',
    statusFilters: Array.from(document.querySelectorAll('#status-multi input:checked')).map(cb => cb.value),
    labelFilters: Array.from(document.querySelectorAll('#label-multi input:checked')).map(cb => cb.value),
    priorityFilters: Array.from(document.querySelectorAll('#priority-multi input:checked')).map(cb => cb.value),
    showPinned: document.getElementById('show-pinned')?.checked ?? true,
    showArchived: document.getElementById('show-archived')?.checked ?? false,
    showUnmarked: document.getElementById('show-unmarked')?.checked ?? true,
  };
  localStorage.setItem('cwoc_ui_state', JSON.stringify(state));
}

function _restoreUIState() {
  try {
    const raw = localStorage.getItem('cwoc_ui_state');
    if (!raw) return false;
    const state = JSON.parse(raw);
    localStorage.removeItem('cwoc_ui_state'); // one-time restore

    if (state.tab) currentTab = state.tab;
    if (state.view) currentView = state.view;
    if (state.sortField !== undefined) currentSortField = state.sortField;
    if (state.sortDir) currentSortDir = state.sortDir;

    // Restore search
    const search = document.getElementById('search');
    if (search && state.search) search.value = state.search;

    // Restore sort UI
    const sortSel = document.getElementById('sort-select');
    if (sortSel && state.sortField) sortSel.value = state.sortField;
    _updateSortUI();

    // Restore status checkboxes
    if (state.statusFilters) {
      document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => {
        cb.checked = state.statusFilters.includes(cb.value);
      });
    }

    // Restore priority checkboxes
    if (state.priorityFilters) {
      document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => {
        cb.checked = state.priorityFilters.includes(cb.value);
      });
    }

    // Restore archive/pinned toggles
    const sp = document.getElementById('show-pinned');
    const sa = document.getElementById('show-archived');
    const su = document.getElementById('show-unmarked');
    if (sp) sp.checked = state.showPinned ?? true;
    if (sa) sa.checked = state.showArchived ?? false;
    if (su) su.checked = state.showUnmarked ?? true;

    // Restore tab highlight
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick="filterChits('${currentTab}')"]`)?.classList.add('active');

    // Restore period select
    const periodSel = document.getElementById('period-select');
    if (periodSel) periodSel.value = currentView;

    // Show/hide sections based on tab
    const periodSection = document.getElementById('section-period');
    const yearWeekContainer = document.getElementById('year-week-container');
    const orderSection = document.getElementById('section-order');
    if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (orderSection) orderSection.style.display = (currentTab === 'Calendar') ? 'none' : '';

    // Restore label filters after they load
    if (state.labelFilters && state.labelFilters.length > 0) {
      window._pendingLabelFilters = state.labelFilters;
    }

    return true;
  } catch (e) {
    return false;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("active");
  if (sidebar.classList.contains("active")) {
    localStorage.setItem("sidebarState", "open");
  } else {
    localStorage.setItem("sidebarState", "closed");
  }
  window.dispatchEvent(new Event("resize"));
}

function restoreSidebarState() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("Sidebar element not found");
    return;
  }
  const savedState = localStorage.getItem("sidebarState");
  if (savedState === "open") {
    sidebar.classList.add("active");
  } else {
    sidebar.classList.remove("active");
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getYearStart(date) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${monthNames[date.getMonth()]}\n${String(date.getDate()).padStart(2, "0")}\n${dayNames[date.getDay()]}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWeekRange(start, end) {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  return `<span>${startStr}</span><span>${endStr}</span>`;
}

function getPastelColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const r = ((hash & 0xff) % 128) + 127;
  const g = (((hash >> 8) & 0xff) % 128) + 127;
  const b = (((hash >> 16) & 0xff) % 128) + 127;
  return `rgb(${r}, ${g}, ${b})`;
}

function getChitDisplayColor(chit) {
  // Return pale cream for no color or transparent — never show transparent in views
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
}

/**
 * Returns the display color for a chit. Transparent/null → pale cream.
 */
function chitColor(chit) {
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
}

function previousPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
  if (currentView === "Day") {
    currentWeekStart.setDate(currentWeekStart.getDate() - 1);
  } else if (currentView === "Week") {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  } else if (currentView === "Month") {
    currentWeekStart.setMonth(currentWeekStart.getMonth() - 1);
  } else if (currentView === "Year") {
    currentWeekStart.setFullYear(currentWeekStart.getFullYear() - 1);
  }
  updateDateRange();
  displayChits();
}

function nextPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
  if (currentView === "Day") {
    currentWeekStart.setDate(currentWeekStart.getDate() + 1);
  } else if (currentView === "Week") {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  } else if (currentView === "Month") {
    currentWeekStart.setMonth(currentWeekStart.getMonth() + 1);
  } else if (currentView === "Year") {
    currentWeekStart.setFullYear(currentWeekStart.getFullYear() + 1);
  }
  updateDateRange();
  displayChits();
}

function fetchChits() {
  console.log("Fetching chits...");
  fetch("/api/chits")
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      chits = Array.isArray(data) ? data : [];
      chits.forEach((chit) => {
        if (chit.start_datetime)
          chit.start_datetime_obj = new Date(chit.start_datetime);
        if (chit.end_datetime)
          chit.end_datetime_obj = new Date(chit.end_datetime);
      });
      console.log("Fetched chits:", chits);
      if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
      updateDateRange();
      displayChits();
      restoreSidebarState();
      // Re-check notifications immediately after chits refresh
      if (typeof _globalCheckNotifications === "function") _globalCheckNotifications();
    })
    .catch((err) => {
      console.error("Error fetching chits:", err);
      document.getElementById("chit-list").innerHTML = `
      <div class="error-message">
      <h3>Error loading chits</h3>
      <p>${err.message}</p>
      <button onclick="fetchChits()">Try Again</button>
      </div>
      `;
      restoreSidebarState();
    });
}

function updateDateRange() {
  const rangeElement = document.getElementById("week-range");
  const yearElement = document.getElementById("year-display");
  if (!rangeElement || !yearElement) {
    console.error("Week range or year display element not found");
    return;
  }
  if (!currentWeekStart) {
    currentWeekStart = getWeekStart(new Date());
  }
  if (currentView === "Day") {
    yearElement.textContent = currentWeekStart.getFullYear();
    rangeElement.textContent = formatDate(currentWeekStart);
  } else if (currentView === "Week") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = start.getFullYear();
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "SevenDay") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = start.getFullYear();
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "Month") {
    const monthStart = getMonthStart(currentWeekStart);
    yearElement.textContent = monthStart.getFullYear();
    rangeElement.textContent = `${monthStart.toLocaleString("default", { month: "long" })}`;
  } else if (currentView === "Year") {
    const yearStart = getYearStart(currentWeekStart);
    yearElement.textContent = yearStart.getFullYear();
    rangeElement.textContent = "";
  } else {
    yearElement.textContent = "";
    rangeElement.textContent = "";
  }
}

function displayChits() {
  const listContainer = document.getElementById("chit-list");
  if (!listContainer) {
    console.error("Chit list container not found");
    return;
  }
  const searchText = document.getElementById("search")?.value?.toLowerCase() || "";

  let filteredChits = chits.filter((chit) => {
    if (!searchText) return true;
    // Always search title
    if (chit.title && chit.title.toLowerCase().includes(searchText)) return true;
    // Search note content (visible in Notes, Checklists, Projects)
    if (chit.note && chit.note.toLowerCase().includes(searchText)) return true;
    // Search tags
    if (Array.isArray(chit.tags) && chit.tags.some(t => t.toLowerCase().includes(searchText))) return true;
    // Search status (visible in Tasks)
    if (chit.status && chit.status.toLowerCase().includes(searchText)) return true;
    // Search people
    if (Array.isArray(chit.people) && chit.people.some(p => p.toLowerCase().includes(searchText))) return true;
    // Search location
    if (chit.location && chit.location.toLowerCase().includes(searchText)) return true;
    return false;
  });

  // Apply multi-select filters (status, label, priority)
  filteredChits = _applyMultiSelectFilters(filteredChits);

  // Apply archive/pinned filter
  filteredChits = _applyArchiveFilter(filteredChits);

  // Apply sort
  filteredChits = _applySort(filteredChits);

  switch (currentTab) {
    case "Calendar":
      if (currentView === "Week") displayWeekView(filteredChits);
      else if (currentView === "Month") displayMonthView(filteredChits);
      else if (currentView === "Itinerary") displayItineraryView(filteredChits);
      else if (currentView === "Day") displayDayView(filteredChits);
      else if (currentView === "Year") displayYearView(filteredChits);
      else if (currentView === "SevenDay") displaySevenDayView(filteredChits);
      else
        listContainer.innerHTML = `<p>${currentView} view not implemented yet.</p>`;
      break;
    case "Checklists":
      displayChecklistView(filteredChits);
      break;
    case "Tasks":
      displayTasksView(filteredChits);
      break;
    case "Notes":
      displayNotesView(filteredChits);
      break;
    case "Alarms":
      displayAlarmsView(filteredChits);
      break;
    case "Projects":
      displayProjectsView(filteredChits);
      break;
    default:
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
  }
}

function displayWeekView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const weekView = document.createElement("div");
  weekView.className = "week-view";
  weekView.style.display = "flex";
  weekView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.width = "60px";
  hourColumn.style.flexShrink = "0";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  weekView.appendChild(hourColumn);

  const dayColumnsContainer = document.createElement("div");
  dayColumnsContainer.style.display = "flex";
  dayColumnsContainer.style.order = "2";
  dayColumnsContainer.style.flex = "1";
  dayColumnsContainer.style.width = "calc(100% - 60px)";

  const weekStart = new Date(currentWeekStart);
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.flex = "1";
    dayColumn.style.minWidth = "0";
    dayColumn.style.position = "relative";

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = formatDate(day);
    dayColumn.appendChild(dayHeader);

    const allDaySection = document.createElement("div");
    allDaySection.className = "all-day-section";
    dayColumn.appendChild(allDaySection);

    // Include chits with start_datetime or due_datetime on this day
    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch =
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === day.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch =
        dueDateObj && dueDateObj.toDateString() === day.toDateString();
      return startDateMatch || dueDateMatch;
    });

    dayChits.forEach((chit) => {
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          allDayEvent.classList.add("completed-task");
        }

                allDayEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span>`;
        allDayEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          timedEvent.classList.add("completed-task");
        }

        let chitStart = chit.start_datetime_obj;
        let chitEnd = chit.end_datetime_obj;

        // If no start_datetime but has due_datetime, treat due_datetime as start and end +30 mins
        if (!chitStart && chit.due_datetime) {
          chitStart = new Date(chit.due_datetime);
          chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000);
        }

        const startHour = chitStart.getHours();
        const startMinute = chitStart.getMinutes();
        const endHour = chitEnd.getHours();
        const endMinute = chitEnd.getMinutes();
        const top = startHour * 60 + startMinute;
        const height = endHour * 60 + endMinute - top;

        timedEvent.style.top = `${top}px`;
        timedEvent.style.height = `${height}px`;
        timedEvent.style.backgroundColor = chitColor(chit);
        timedEvent.style.width = "calc(100% - 4px)";
        timedEvent.style.boxSizing = "border-box";

                timedEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
        timedEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        dayColumn.appendChild(timedEvent);
      }
    });

    dayColumnsContainer.appendChild(dayColumn);
  }

  weekView.appendChild(dayColumnsContainer);
  chitList.appendChild(weekView);

  scrollToSixAM();
  renderTimeBar("Week");
}

function displayMonthView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const monthView = document.createElement("div");
  monthView.className = "month-view";

  const currentMonth = getMonthStart(new Date(currentWeekStart));
  const monthStart = new Date(currentMonth);
  const monthEnd = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  );
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const monthHeader = document.createElement("div");
  monthHeader.className = "month-header";
  monthHeader.textContent = `${currentMonth.toLocaleString("default", { month: "long" })} ${currentMonth.getFullYear()}`;
  monthView.appendChild(monthHeader);

  const dayHeaders = document.createElement("div");
  dayHeaders.className = "day-headers";
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  daysOfWeek.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = day;
    dayHeaders.appendChild(dayHeader);
  });
  monthView.appendChild(dayHeaders);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "month-day empty";
    monthGrid.appendChild(emptyDay);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const monthDay = document.createElement("div");
    monthDay.className = "month-day";
    monthDay.innerHTML = `<div class="day-number">${day}</div>`;

    // Include chits with start_datetime or due_datetime on this day
    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch =
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === dayDate.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch =
        dueDateObj && dueDateObj.toDateString() === dayDate.toDateString();
      return startDateMatch || dueDateMatch;
    });

    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.style.backgroundColor = chitColor(chit);
        chitElement.style.cursor = "pointer";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          chitElement.classList.add("completed-task");
        }

                chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em; text-decoration: none; color: inherit;">${chit.title}</span>`;
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }

    monthGrid.appendChild(monthDay);
  }

  monthView.appendChild(monthGrid);
  chitList.appendChild(monthView);
}

function displayItineraryView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const itineraryView = document.createElement("div");
  itineraryView.className = "itinerary-view";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureChits = chitsToDisplay
    .filter(
      (chit) => chit.start_datetime_obj && chit.start_datetime_obj >= today,
    )
    .sort((a, b) => a.start_datetime_obj - b.start_datetime_obj);

  if (futureChits.length === 0) {
    itineraryView.innerHTML = "<p>No upcoming events found.</p>";
  } else {
    let currentDay = null;
    futureChits.forEach((chit) => {
      const chitDate = new Date(chit.start_datetime_obj);
      chitDate.setHours(0, 0, 0, 0);

      if (!currentDay || chitDate.getTime() !== currentDay.getTime()) {
        currentDay = chitDate;
        const daySeparator = document.createElement("div");
        daySeparator.className = "day-separator";
        daySeparator.innerHTML = `<hr><h3>${formatDate(chitDate)}</h3>`;
        itineraryView.appendChild(daySeparator);
      }

      const chitElement = document.createElement("div");
      chitElement.className = "itinerary-event";
      chitElement.style.display = "flex";
      chitElement.style.justifyContent = "flex-start";
      chitElement.style.padding = "10px";
      chitElement.style.backgroundColor = chitColor(chit);
      chitElement.style.marginBottom = "5px";
      chitElement.style.borderRadius = "5px";
      chitElement.style.marginLeft = "100px";

      // Fade completed tasks
      if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
        chitElement.classList.add("completed-task");
      }

      const timeColumn = document.createElement("div");
      timeColumn.className = "time-column";
      timeColumn.style.width = "100px";
      timeColumn.style.marginRight = "15px";
      const chitStart = chit.start_datetime_obj;
      const chitEnd =
        chit.end_datetime_obj || new Date(chitStart.getTime() + 60 * 60 * 1000);
      timeColumn.innerHTML = `${formatTime(chitStart)} - ${formatTime(chitEnd)}`;

      const detailsColumn = document.createElement("div");
      detailsColumn.className = "details-column";
      detailsColumn.style.textAlign = "center";
      detailsColumn.style.flex = "1";

            detailsColumn.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span>`;

      chitElement.appendChild(timeColumn);
      chitElement.appendChild(detailsColumn);
      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      itineraryView.appendChild(chitElement);
    });
  }

  chitList.appendChild(itineraryView);

  renderTimeBar("Itinerary");
}

function displayDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-header";
  dayHeader.style.textAlign = "center";
  dayHeader.style.marginBottom = "10px";
  dayHeader.textContent = formatDate(currentWeekStart);
  chitList.appendChild(dayHeader);

  const dayView = document.createElement("div");
  dayView.className = "day-view";
  dayView.style.display = "flex";
  dayView.style.position = "relative";
  dayView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.position = "sticky";
  hourColumn.style.left = "0";
  hourColumn.style.zIndex = "1";
  hourColumn.style.backgroundColor = "#fff5e6";
  hourColumn.style.width = "80px";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  dayView.appendChild(hourColumn);

  const eventsContainer = document.createElement("div");
  eventsContainer.style.order = "2";
  eventsContainer.style.position = "relative";
  eventsContainer.style.flex = "1";
  eventsContainer.style.marginLeft = "15px";
  eventsContainer.style.width = "calc(100% - 95px)";

  // Include chits with start_datetime or due_datetime on this day
  const dayChits = chitsToDisplay.filter((chit) => {
    const startDateMatch =
      chit.start_datetime_obj &&
      chit.start_datetime_obj.toDateString() ===
        currentWeekStart.toDateString();
    const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
    const dueDateMatch =
      dueDateObj &&
      dueDateObj.toDateString() === currentWeekStart.toDateString();
    return startDateMatch || dueDateMatch;
  });

  const timeSlots = {};

  dayChits.forEach((chit) => {
    let chitStart = chit.start_datetime_obj;
    let chitEnd = chit.end_datetime_obj;

    // If no start_datetime but has due_datetime, treat due_datetime as start and end with +30 mins
    if (!chitStart && chit.due_datetime) {
      chitStart = new Date(chit.due_datetime);
      chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000); // 30 minutes later
    }

    const startHour = chitStart.getHours();
    const startMinute = chitStart.getMinutes();
    const startTime = startHour * 60 + startMinute;
    const endHour = chitEnd.getHours();
    const endMinute = chitEnd.getMinutes();
    const endTime = endHour * 60 + endMinute;

    for (let t = startTime; t < endTime; t++) {
      if (!timeSlots[t]) timeSlots[t] = [];
    }

    let position = 0;
    while (true) {
      let collision = false;
      for (let t = startTime; t < endTime; t++) {
        if (timeSlots[t].includes(position)) {
          collision = true;
          break;
        }
      }
      if (!collision) break;
      position++;
    }

    for (let t = startTime; t < endTime; t++) {
      timeSlots[t].push(position);
    }

    const chitElement = document.createElement("div");
    chitElement.className = "day-event";
    const height = endTime - startTime;
    const maxOverlap = Math.max(
      ...Object.values(timeSlots).map((slot) => slot.length),
    );
    const widthPercentage = 95 / maxOverlap;

    chitElement.style.top = `${startTime}px`;
    chitElement.style.height = `${height}px`;
    chitElement.style.left = `${position * widthPercentage}%`;
    chitElement.style.width = `${widthPercentage - 1}%`;
    chitElement.style.position = "absolute";
    chitElement.style.backgroundColor = chitColor(chit);
    chitElement.style.boxSizing = "border-box";

    // Fade completed tasks
    if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
      chitElement.classList.add("completed-task");
    }

    
    chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    eventsContainer.appendChild(chitElement);
  });

  dayView.appendChild(eventsContainer);
  chitList.appendChild(dayView);

  scrollToSixAM();
  renderTimeBar("Day");
}

function displayYearView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const yearView = document.createElement("div");
  yearView.className = "year-view";
  yearView.style.backgroundColor = "#fff5e6";
  yearView.style.display = "flex";
  yearView.style.flexWrap = "wrap";
  yearView.style.width = "100%";

  const currentYear = new Date(currentWeekStart).getFullYear();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  months.forEach((month, idx) => {
    const monthBlock = document.createElement("div");
    monthBlock.className = "year-month";
    monthBlock.style.flex = "1 0 25%";
    monthBlock.style.padding = "10px";
    monthBlock.style.boxSizing = "border-box";
    monthBlock.style.minWidth = "200px";

    const monthHeader = document.createElement("div");
    monthHeader.className = "month-header";
    monthHeader.textContent = `${month} ${currentYear}`;
    monthHeader.style.fontWeight = "bold";
    monthBlock.appendChild(monthHeader);

    const daysInMonth = new Date(currentYear, idx + 1, 0).getDate();
    const firstDay = new Date(currentYear, idx, 1).getDay();
    const monthGrid = document.createElement("div");
    monthGrid.className = "month-grid";
    monthGrid.style.display = "grid";
    monthGrid.style.gridTemplateColumns = "repeat(7, 1fr)";
    monthGrid.style.gap = "2px";

    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "day empty";
      monthGrid.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(currentYear, idx, day);
      const dayElement = document.createElement("div");
      dayElement.className = "day";
      dayElement.textContent = day;
      dayElement.style.padding = "5px";
      dayElement.style.textAlign = "center";
      dayElement.style.cursor = "pointer";

      // Include chits with start_datetime or due_datetime on this day
      const dayChits = chitsToDisplay.filter((chit) => {
        const startDateMatch =
          chit.start_datetime_obj &&
          chit.start_datetime_obj.toDateString() === dayDate.toDateString();
        const dueDateObj = chit.due_datetime
          ? new Date(chit.due_datetime)
          : null;
        const dueDateMatch =
          dueDateObj && dueDateObj.toDateString() === dayDate.toDateString();
        return startDateMatch || dueDateMatch;
      });

      const chitCount = dayChits.length;
      dayElement.style.backgroundColor =
        chitCount === 0 ? "#fff5e6" : chitCount === 1 ? "#e6d5b8" : "#D68A59";

      dayElement.addEventListener("click", () => {
        currentView = "Day";
        currentWeekStart = dayDate;
        document.getElementById("period-select").value = "Day";
        updateDateRange();
        displayChits();
      });
      monthGrid.appendChild(dayElement);
    }

    monthBlock.appendChild(monthGrid);
    yearView.appendChild(monthBlock);
  });

  chitList.appendChild(yearView);
}

function displayChecklistView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const checklistView = document.createElement("div");
  checklistView.className = "checklist-view";

  // Only show chits that have checklist items
  const checklistChits = chitsToDisplay.filter(c =>
    Array.isArray(c.checklist) && c.checklist.length > 0
  );

  // Only apply default sort if no global sort is active
  const sortedChits = currentSortField ? checklistChits : [...checklistChits].sort((a, b) => {
    const dateA = new Date(
      a.last_edited || a.created_datetime || a.start_datetime || 0,
    );
    const dateB = new Date(
      b.last_edited || b.created_datetime || b.start_datetime || 0,
    );
    return dateB - dateA;
  });

  if (sortedChits.length === 0)
    checklistView.innerHTML = "<p>No chits found.</p>";
  else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.draggable = true;
      chitElement.dataset.chitId = chit.id;
      chitElement.style.backgroundColor = chitColor(chit);
      if (chit.status === "Complete") chitElement.classList.add("completed-task");
      if (chit.archived) chitElement.classList.add("archived-chit");

      chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

      // Interactive checklist from shared.js
      renderInlineChecklist(chitElement, chit, () => fetchChits());

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);
  enableDragToReorder(checklistView, 'Checklists', () => displayChits());
}

function displayTasksView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  let taskChits = chitsToDisplay.filter(
    (chit) => chit.status || chit.due_datetime,
  );

  if (taskChits.length === 0) {
    chitList.innerHTML = "<p>No tasks found.</p>";
    return;
  }

  const tasksContainer = document.createElement("div");
  tasksContainer.className = "checklist-view"; // reuse consistent spacing

  taskChits.forEach((chit) => {
    const chitElement = document.createElement("div");
    chitElement.className = "chit-card";
    chitElement.draggable = true;
    chitElement.dataset.chitId = chit.id;
    if (chit.archived) chitElement.classList.add("archived-chit");
    chitElement.style.backgroundColor = typeof chitColor === 'function' ? chitColor(chit) : '';
    if (chit.status === "Complete") chitElement.classList.add("completed-task");

    chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

    // Inline status dropdown
    const controls = document.createElement("div");
    controls.style.cssText = "margin-top:0.3em;display:flex;align-items:center;gap:0.5em;font-size:0.9em;";
    const label = document.createElement("span");
    label.textContent = "Status:";
    controls.appendChild(label);

    const statusDropdown = document.createElement("select");
    statusDropdown.style.cssText = "font-family:inherit;font-size:inherit;";
    ["ToDo", "In Progress", "Blocked", "Complete"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      if (chit.status === status) option.selected = true;
      statusDropdown.appendChild(option);
    });
    if (!chit.status) statusDropdown.value = "";
    statusDropdown.addEventListener("change", () => {
      fetch(`/api/chits/${chit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chit, status: statusDropdown.value || null }),
      }).then(r => { if (r.ok) fetchChits(); });
    });
    controls.appendChild(statusDropdown);
    chitElement.appendChild(controls);

    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    tasksContainer.appendChild(chitElement);
  });
  chitList.appendChild(tasksContainer);
  enableDragToReorder(tasksContainer, 'Tasks', () => displayChits());
}

function displayNotesView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const notesView = document.createElement("div");
  notesView.className = "notes-view";

  const filteredNotes = [...chitsToDisplay].filter((chit) => chit.note && chit.note.trim() !== "");
  const sortedChits = currentSortField ? filteredNotes : filteredNotes.sort((a, b) => {
      const dateA = new Date(
        a.last_edited || a.created_datetime || a.start_datetime || 0,
      );
      const dateB = new Date(
        b.last_edited || b.created_datetime || b.start_datetime || 0,
      );
      return dateB - dateA;
    });

  if (sortedChits.length === 0) {
    notesView.innerHTML = "<p>No notes found.</p>";
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.draggable = true;
      chitElement.dataset.chitId = chit.id;
      chitElement.style.backgroundColor = chitColor(chit);
      if (chit.archived) chitElement.classList.add("archived-chit");

      // Simple title with icons
      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { const i = document.createElement('i'); i.className = 'fas fa-bookmark'; i.title = 'Pinned'; i.style.fontSize = '0.85em'; titleRow.appendChild(i); }
      if (chit.archived) { const i = document.createElement('span'); i.textContent = '📦'; i.title = 'Archived'; titleRow.appendChild(i); }
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);
      chitElement.appendChild(titleRow);

      const noteEl = document.createElement("div");
      noteEl.className = "note-content";
      noteEl.style.cssText = "overflow:hidden;font-size:0.9em;";
      if (typeof marked !== "undefined" && chit.note) {
        noteEl.innerHTML = marked.parse(chit.note);
      } else {
        noteEl.style.whiteSpace = "pre-wrap";
        noteEl.textContent = chit.note;
      }
      chitElement.appendChild(noteEl);

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      notesView.appendChild(chitElement);
    });
  }
  chitList.appendChild(notesView);
  enableDragToReorder(notesView, 'Notes', () => displayChits());
}

/**
 * Scroll the time-based view so 6:00am is the first visible slot.
 * Uses setTimeout(0) to ensure the DOM is fully painted before scrolling.
 */
function scrollToSixAM() {
  setTimeout(() => {
    const scrollable =
      document.querySelector(".week-view") ||
      document.querySelector(".day-view");
    if (scrollable) {
      scrollable.scrollTop = 360;
    }
  }, 50);
}

/**
 * Render and maintain a "current time" bar in time-based views.
 * Only shows in today's column. Updates every minute.
 */
let _timeBarInterval = null;

function renderTimeBar(viewType) {
  // Clear any existing interval
  if (_timeBarInterval) {
    clearInterval(_timeBarInterval);
    _timeBarInterval = null;
  }

  function placeBar() {
    // Remove any existing bars
    document.querySelectorAll(".current-time-bar").forEach((el) => el.remove());

    const now = new Date();
    const todayStr = now.toDateString();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();

    if (viewType === "Day") {
      // Day view: events container is position:relative, events use top = minuteOfDay
      const eventsContainer = document.querySelector(".day-view > div:last-child");
      if (!eventsContainer) return;
      const bar = document.createElement("div");
      bar.className = "current-time-bar";
      bar.style.cssText = `position:absolute;left:0;right:0;top:${minuteOfDay}px;height:2px;background:#e63946;z-index:10;pointer-events:none;`;
      const dot = document.createElement("div");
      dot.style.cssText = `position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:#e63946;`;
      bar.appendChild(dot);
      eventsContainer.appendChild(bar);
    } else if (viewType === "Week" || viewType === "SevenDay") {
      // Find today's column and measure actual header + all-day section height
      const dayColumns = document.querySelectorAll(".day-column");
      dayColumns.forEach((col) => {
        const headerEl = col.querySelector(".day-header");
        const headerText = headerEl?.textContent || "";
        const parts = headerText.trim().split(/\s+/);
        if (parts.length >= 3) {
          const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const monthIdx = monthNames.indexOf(parts[0]);
          const day = parseInt(parts[1]);
          const year = new Date().getFullYear();
          if (monthIdx !== -1 && !isNaN(day)) {
            const colDate = new Date(year, monthIdx, day);
            if (colDate.toDateString() === todayStr) {
              // Measure actual offset at runtime
              const headerH = headerEl ? headerEl.offsetHeight : 0;
              const allDayEl = col.querySelector(".all-day-section");
              const allDayH = allDayEl ? allDayEl.offsetHeight : 0;
              const offset = headerH + allDayH;

              col.style.position = "relative";
              const bar = document.createElement("div");
              bar.className = "current-time-bar";
              bar.style.cssText = `position:absolute;left:0;right:0;top:${minuteOfDay + offset}px;height:2px;background:#e63946;z-index:10;pointer-events:none;`;
              const dot = document.createElement("div");
              dot.style.cssText = `position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:#e63946;`;
              bar.appendChild(dot);
              col.appendChild(bar);
            }
          }
        }
      });
    } else if (viewType === "Itinerary") {
      // In itinerary, show a horizontal rule at "now" between past and future events
      const itineraryView = document.querySelector(".itinerary-view");
      if (!itineraryView) return;
      const bar = document.createElement("div");
      bar.className = "current-time-bar";
      bar.style.cssText = `width:100%;height:2px;background:#e63946;margin:4px 0;position:relative;`;
      const label = document.createElement("span");
      label.style.cssText = `position:absolute;left:0;top:-10px;font-size:0.75em;color:#e63946;font-weight:bold;`;
      label.textContent = `▶ Now (${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})})`;
      bar.appendChild(label);
      // Insert before the first future event separator
      const separators = itineraryView.querySelectorAll(".day-separator");
      let inserted = false;
      separators.forEach((sep) => {
        if (!inserted) {
          const h3 = sep.querySelector("h3");
          if (h3) {
            // Try to parse the date from the separator
            const parts = h3.textContent.trim().split(/\s+/);
            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const monthIdx = monthNames.indexOf(parts[0]);
            const day = parseInt(parts[1]);
            const year = new Date().getFullYear();
            if (monthIdx !== -1 && !isNaN(day)) {
              const sepDate = new Date(year, monthIdx, day);
              if (sepDate >= now) {
                itineraryView.insertBefore(bar, sep);
                inserted = true;
              }
            }
          }
        }
      });
      if (!inserted) itineraryView.appendChild(bar);
    }
  }

  // Use setTimeout so layout is fully computed before measuring offsetHeight
  setTimeout(() => {
    placeBar();
  }, 60);
  // Update at the start of each minute
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => {
    placeBar();
    _timeBarInterval = setInterval(placeBar, 60000);
  }, msUntilNextMinute);
}

/**
 * Seven-day view: same as week view but always starts from today.
 */
function displaySevenDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const weekView = document.createElement("div");
  weekView.className = "week-view";
  weekView.style.display = "flex";
  weekView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.width = "60px";
  hourColumn.style.flexShrink = "0";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  weekView.appendChild(hourColumn);

  const dayColumnsContainer = document.createElement("div");
  dayColumnsContainer.style.display = "flex";
  dayColumnsContainer.style.order = "2";
  dayColumnsContainer.style.flex = "1";
  dayColumnsContainer.style.width = "calc(100% - 60px)";

  // Always start from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.flex = "1";
    dayColumn.style.minWidth = "0";
    dayColumn.style.position = "relative";

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = formatDate(day);
    dayColumn.appendChild(dayHeader);

    const allDaySection = document.createElement("div");
    allDaySection.className = "all-day-section";
    dayColumn.appendChild(allDaySection);

    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch = chit.start_datetime_obj && chit.start_datetime_obj.toDateString() === day.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch = dueDateObj && dueDateObj.toDateString() === day.toDateString();
      return startDateMatch || dueDateMatch;
    });

    dayChits.forEach((chit) => {
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event";
        if (chit.status === "Complete") allDayEvent.classList.add("completed-task");
                allDayEvent.innerHTML = `<span style="font-weight:bold;font-size:1.1em;">${chit.title}</span>`;
        allDayEvent.addEventListener("dblclick", () => { storePreviousState(); window.location.href = `/editor?id=${chit.id}`; });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event";
        if (chit.status === "Complete") timedEvent.classList.add("completed-task");

        let chitStart = chit.start_datetime_obj;
        let chitEnd = chit.end_datetime_obj;
        if (!chitStart && chit.due_datetime) {
          chitStart = new Date(chit.due_datetime);
          chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000);
        }

        const top = chitStart.getHours() * 60 + chitStart.getMinutes();
        const height = (chitEnd.getHours() * 60 + chitEnd.getMinutes()) - top;
        timedEvent.style.top = `${top}px`;
        timedEvent.style.height = `${height}px`;
        timedEvent.style.backgroundColor = chitColor(chit);
        timedEvent.style.width = "calc(100% - 4px)";
        timedEvent.style.boxSizing = "border-box";

                timedEvent.innerHTML = `<span style="font-weight:bold;font-size:1.1em;">${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
        timedEvent.addEventListener("dblclick", () => { storePreviousState(); window.location.href = `/editor?id=${chit.id}`; });
        dayColumn.appendChild(timedEvent);
      }
    });

    dayColumnsContainer.appendChild(dayColumn);
  }

  weekView.appendChild(dayColumnsContainer);
  chitList.appendChild(weekView);

  scrollToSixAM();
  renderTimeBar("SevenDay");
}

/**
 * Projects tab: tree view — each project master with its child chits nested.
 */
function displayProjectsView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const projects = chitsToDisplay.filter((c) => c.is_project_master);

  if (projects.length === 0) {
    chitList.innerHTML = "<p>No projects found. Create a chit and enable Project Master in the Projects zone.</p>";
    return;
  }

  // Build a lookup map of all chits by ID
  const chitMap = {};
  chits.forEach((c) => { chitMap[c.id] = c; });

  const view = document.createElement("div");
  view.className = "projects-view";

  projects.forEach((project) => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);

    // Outer box colored with project color
    const box = document.createElement("div");
    box.style.cssText = `border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};`;

    // Project header row — use standard header builder
    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};cursor:pointer;`;
    header.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)"));

    if (project.note) {
      const note = document.createElement("div");
      note.style.cssText = "font-size:0.8em;opacity:0.65;margin-top:2px;padding:0 0.7em;";
      note.textContent = project.note.slice(0, 100) + (project.note.length > 100 ? "…" : "");
      header.appendChild(note);
    }
    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });
    box.appendChild(header);

    // Child chits tree
    if (childIds.length > 0) {
      const tree = document.createElement("ul");
      tree.style.cssText = "list-style:none;margin:0;padding:0 0 0.5em 0;border-top:1px solid rgba(139,90,43,0.2);";

      childIds.forEach((childId) => {
        const child = chitMap[childId];
        const li = document.createElement("li");
        li.style.cssText = `display:flex;align-items:center;gap:0.5em;padding:0.35em 0.8em 0.35em 1.5em;border-bottom:1px solid rgba(139,90,43,0.1);background:${child ? chitColor(child) : "#fdf6e3"};cursor:pointer;`;

        const bullet = document.createElement("span");
        bullet.style.cssText = "opacity:0.4;font-size:0.8em;flex-shrink:0;";
        bullet.textContent = "▸";
        li.appendChild(bullet);

        const childTitle = document.createElement("span");
        childTitle.style.cssText = "flex:1;font-size:0.95em;";
        childTitle.textContent = child ? (child.title || "(Untitled)") : `[${childId.slice(0,8)}…]`;
        li.appendChild(childTitle);

        if (child) {
          if (child.status) {
            const status = document.createElement("span");
            status.style.cssText = "font-size:0.75em;opacity:0.7;white-space:nowrap;";
            status.textContent = child.status;
            li.appendChild(status);
          }
          if (child.due_datetime) {
            const due = document.createElement("span");
            due.style.cssText = "font-size:0.75em;opacity:0.6;white-space:nowrap;";
            due.textContent = formatDate(new Date(child.due_datetime));
            li.appendChild(due);
          }
          li.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${child.id}`;
          });
        }

        tree.appendChild(li);
      });

      box.appendChild(tree);
    }

    view.appendChild(box);
  });

  chitList.appendChild(view);
}

/**
 * Alarms tab: list all chits that have any alert (alarm, notification, timer, stopwatch).
 */
function displayAlarmsView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  // Include chits with any alert type: alarm flag, notification flag, or alerts array entries
  const alertChits = chitsToDisplay.filter((c) =>
    c.alarm || c.notification ||
    (Array.isArray(c.alerts) && c.alerts.length > 0)
  );

  if (alertChits.length === 0) {
    chitList.innerHTML = "<p>No chits with alerts found.</p>";
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
    card.style.backgroundColor = chitColor(chit);

    card.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

    // Alert summary
    const alerts = Array.isArray(chit.alerts) ? chit.alerts : [];
    const alarmCount = alerts.filter((a) => a._type === "alarm").length;
    const timerCount = alerts.filter((a) => a._type === "timer").length;
    const swCount = alerts.filter((a) => a._type === "stopwatch").length;
    const notifCount = alerts.filter((a) => a._type === "notification").length;

    const summaryRow = document.createElement("div");
    summaryRow.style.cssText = "margin-top:0.3em;display:flex;align-items:center;gap:0.5em;font-size:0.9em;";
    if (alarmCount > 0 || chit.alarm) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `🔔 ${alarmCount || 1}` }));
    if (timerCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏱️ ${timerCount}` }));
    if (swCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏲️ ${swCount}` }));
    if (notifCount > 0 || chit.notification) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `📢 ${notifCount || 1}` }));
    if (summaryRow.children.length > 0) card.appendChild(summaryRow);

    card.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });

    view.appendChild(card);
  });

  chitList.appendChild(view);
  enableDragToReorder(view, 'Alarms', () => displayChits());
}

function filterChits(tab) {
  storePreviousState();

  currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="filterChits('${tab}')"]`)
    ?.classList.add("active");

  // Show/hide period selector and date nav based on Calendar tab
  const periodSection = document.getElementById('section-period');
  const yearWeekContainer = document.getElementById('year-week-container');
  const orderSection = document.getElementById('section-order');
  if (periodSection) {
    periodSection.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (yearWeekContainer) {
    yearWeekContainer.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (orderSection) {
    orderSection.style.display = (tab === 'Calendar') ? 'none' : '';
  }

  _loadLabelFilters();

  updateDateRange();
  displayChits();
}

function searchChits() {
  displayChits();
}

function changeView() {
  storePreviousState();
  currentView = document.getElementById("period-select")?.value || currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function toggleAllDay() {
  const allDay = document.getElementById("all_day").checked;
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  if (allDay) {
    startTime.dataset.previousValue = startTime.value;
    endTime.dataset.previousValue = endTime.value;
    startTime.style.display = "none";
    endTime.style.display = "none";
    startTime.value = "";
    endTime.value = "";
  } else {
    startTime.style.display = "";
    endTime.style.display = "";
    if (startTime.dataset.previousValue)
      startTime.value = startTime.dataset.previousValue;
    if (endTime.dataset.previousValue)
      endTime.value = endTime.dataset.previousValue;
  }
}

function setColor(color, name) {
  document.getElementById("color").value = color;
  document.getElementById("selected-color").textContent = name;
}

function utcToLocalDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date;
}

function parseISOTime(isoString) {
  if (!isoString) return "";
  const date = utcToLocalDate(isoString);
  if (isNaN(date.getTime())) return "";
  return formatTime(date);
}

function convertDBDateToDisplayDate(dateString) {
  if (!dateString) return "";
  const date = utcToLocalDate(dateString);
  if (isNaN(date.getTime())) return "";
  return formatDate(date);
}

const userTimezoneOffset = new Date().getTimezoneOffset();
console.log(`User timezone offset: ${userTimezoneOffset} minutes`);

const chitId = new URLSearchParams(window.location.search).get("id");
if (chitId) {
  fetch(`/api/chits/${chitId}`)
    .then((response) => response.json())
    .then((chit) => {
      document.getElementById("pinned").checked = chit.pinned || false;
      document.getElementById("title").value = chit.title || "";
      document.getElementById("note").value = chit.note || "";
      document.getElementById("labels").value = (chit.labels || []).join(", ");
      document.getElementById("all_day").checked = chit.all_day || false;

      if (chit.start_datetime) {
        document.getElementById("start_datetime").value =
          convertDBDateToDisplayDate(chit.start_datetime);
        if (!chit.all_day)
          document.getElementById("start_time").value = parseISOTime(
            chit.start_datetime,
          );
      }
      if (chit.end_datetime) {
        document.getElementById("end_datetime").value =
          convertDBDateToDisplayDate(chit.end_datetime);
        if (!chit.all_day)
          document.getElementById("end_time").value = parseISOTime(
            chit.end_datetime,
          );
      }
      if (chit.due_datetime) {
        document.getElementById("due_datetime").value =
          convertDBDateToDisplayDate(chit.due_datetime);
        document.getElementById("due_time").value = parseISOTime(
          chit.due_datetime,
        );
      }

      toggleAllDay();

      document.getElementById("status").value = chit.status || "";
      document.getElementById("priority").value = chit.priority || "Medium";
      document.getElementById("checklist").value = chit.checklist
        ? JSON.stringify(chit.checklist)
        : "";
      document.getElementById("alarm").checked = chit.alarm || false;
      document.getElementById("notification").checked =
        chit.notification || false;
      document.getElementById("recurrence").value = chit.recurrence || "";
      document.getElementById("location").value = chit.location || "";
      document.getElementById("color").value = chitColor(chit);
      document.getElementById("selected-color").textContent = chit.color
        ? chit.color === "#C66B6B"
          ? "Dusty Rose"
          : chit.color === "#D68A59"
            ? "Burnt Sienna"
            : chit.color === "#E3B23C"
              ? "Golden Ochre"
              : chit.color === "#8A9A5B"
                ? "Mossy Sage"
                : chit.color === "#6B8299"
                  ? "Slate Teal"
                  : "Muted Lilac"
        : "Dusty Rose";
      document.getElementById("people").value = (chit.people || []).join(", ");
      document.getElementById("archived").checked = chit.archived || false;
    })
    .catch((err) => {
      console.error("Error loading chit:", err);
      alert("Failed to load chit. Check console for details.");
    });
}

function deleteChit() {
  if (!chitId) {
    alert("No chit to delete.");
    return;
  }
  if (!confirm("Are you sure you want to delete this chit?")) return;
  fetch(`/api/chits/${chitId}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(() => {
      currentTab = previousState.tab;
      currentView = previousState.view;
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelector(
          `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
        )
        .classList.add("active");
      document.getElementById("period-select").value = currentView;
      fetchChits();
    })
    .catch((err) => {
      console.error("Error deleting chit:", err);
      alert("Failed to delete chit. Check console for details.");
    });
}

function cancelEdit() {
  currentTab = previousState.tab;
  currentView = previousState.view;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(
      `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
    )
    .classList.add("active");
  document.getElementById("period-select").value = currentView;
  fetchChits();
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded, initializing...");

  // Default: hide archived chits, show pinned
  const saInit = document.getElementById('show-archived');
  if (saInit) saInit.checked = false;

  // Try to restore previous UI state (from editor return)
  const restored = _restoreUIState();
  if (!restored) {
    currentTab = "Calendar";
  }

  // Hide Order on Calendar, show date nav + period
  const orderSection = document.getElementById('section-order');
  if (orderSection) orderSection.style.display = (currentTab === 'Calendar') ? 'none' : '';
  const periodSection = document.getElementById('section-period');
  if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const yearWeekContainer = document.getElementById('year-week-container');
  if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';

  _loadLabelFilters();
  _updateSortUI();
  fetchChits();
  updateDateRange();
  restoreSidebarState();
  _startGlobalAlertSystem();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const startDateTime = document.getElementById("start_datetime");
  const startTime = document.getElementById("start_time");
  const endDateTime = document.getElementById("end_datetime");
  const endTime = document.getElementById("end_time");

  if (startDateTime) startDateTime.value = formatDate(now);
  if (startTime) startTime.value = formatTime(now);
  if (endDateTime) endDateTime.value = formatDate(now);
  if (endTime) endTime.value = formatTime(oneHourLater);

  flatpickr("#start_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#start_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
    onChange: function (selectedDates, dateStr, instance) {
      const startTime = new Date(`1970-01-01T${dateStr}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const endTimeInput = document.getElementById("end_time");
      if (
        !endTimeInput._flatpickr.selectedDates.length &&
        !document.getElementById("all_day").checked
      ) {
        endTimeInput._flatpickr.setDate(formatTime(endTime));
      }
    },
  });
  flatpickr("#end_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#end_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });
  flatpickr("#due_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#due_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });

  window.addEventListener("resize", () => {
    if (currentTab === "Notes") {
      displayChits();
    }
  });

  // ── Keyboard shortcuts (hotkey state machine) ────────────────────────────
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const tag = el?.tagName?.toLowerCase();
    const inputType = el?.type?.toLowerCase();
    const isTextInput = (tag === "input" && inputType !== "checkbox" && inputType !== "radio")
      || tag === "textarea" || tag === "select"
      || el?.isContentEditable;
    if (isTextInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    const keyLower = key.toLowerCase();

    // ── ESC: exit any submenu or close reference ──
    // Shift+ESC: clear all values in the active filter panel
    if (key === "Escape") {
      if (e.shiftKey && (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY')) {
        const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
          : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
        document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'FILTER') {
        // Clear ALL filters
        document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        const sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
        const sa = document.getElementById('show-archived'); if (sa) sa.checked = true;
        const su = document.getElementById('show-unmarked'); if (su) su.checked = true;
        const search = document.getElementById('search'); if (search) search.value = '';
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'ORDER') {
        currentSortField = null;
        const sel = document.getElementById('sort-select'); if (sel) sel.value = '';
        _updateSortUI();
        displayChits();
        _exitHotkeyMode();
        return;
      }
      if (document.getElementById('reference-overlay')?.classList.contains('active')) {
        _closeReference();
        return;
      }
      if (_hotkeyMode) {
        _exitHotkeyMode();
        return;
      }
      return;
    }

    // ── Reference overlay toggle ──
    if (keyLower === 'r' && !_hotkeyMode) {
      e.preventDefault();
      _toggleReference();
      return;
    }

    // Close reference if open and any other key pressed
    if (document.getElementById('reference-overlay')?.classList.contains('active')) {
      _closeReference();
    }

    // ── PERIOD submenu (after '.') ──
    if (_hotkeyMode === 'PERIOD') {
      const periodMap = { i: 'Itinerary', d: 'Day', w: 'Week', s: 'SevenDay', m: 'Month', y: 'Year' };
      if (periodMap[keyLower]) {
        e.preventDefault();
        _pickPeriod(periodMap[keyLower]);
      }
      return;
    }

    // ── FILTER submenu (after 'F') ──
    if (_hotkeyMode === 'FILTER') {
      e.preventDefault();
      if (keyLower === 's') {
        _enterFilterSub('status');
      } else if (keyLower === 't') {
        _enterFilterSub('label');
      } else if (keyLower === 'p') {
        _enterFilterSub('priority');
      } else if (keyLower === 'a') {
        _toggleFilterArchived();
      } else if (keyLower === 'i') {
        _toggleFilterPinned();
      } else if (keyLower === 'w') {
        _filterFocusSearch();
      }
      return;
    }

    // ── Inside a multi-select filter (number keys toggle, Enter/letter confirms) ──
    if (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY') {
      const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
        : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
      const panelId = _hotkeyMode === 'FILTER_STATUS' ? 'panel-status-options'
        : _hotkeyMode === 'FILTER_LABEL' ? 'panel-label-options' : 'panel-priority-options';
      const boxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);

      if (key === 'Enter') {
        e.preventDefault();
        onFilterChange();
        _exitHotkeyMode();
        return;
      }

      // Number keys toggle checkboxes (1-indexed)
      const num = parseInt(key);
      if (num >= 1 && num <= boxes.length) {
        e.preventDefault();
        const cb = boxes[num - 1];
        cb.checked = !cb.checked;
        onFilterChange();
        // Update panel visual
        const panelOptions = document.querySelectorAll(`#${panelId} .hotkey-panel-option`);
        if (panelOptions[num - 1]) {
          panelOptions[num - 1].classList.toggle('selected', cb.checked);
        }
        return;
      }
      return;
    }

    // ── ORDER submenu (after 'O') ──
    if (_hotkeyMode === 'ORDER') {
      e.preventDefault();
      const orderMap = { t: 'title', s: 'start', d: 'due', u: 'updated', c: 'created', x: 'status', m: 'manual' };
      if (orderMap[keyLower]) {
        _pickSort(orderMap[keyLower]);
        return;
      }
      if (key === 'ArrowUp') {
        currentSortDir = 'asc';
        _updateSortUI();
        displayChits();
        return;
      }
      if (key === 'ArrowDown') {
        currentSortDir = 'desc';
        _updateSortUI();
        displayChits();
        return;
      }
      return;
    }

    // ── Top-level hotkeys ──
    const tabMap = { c: 'Calendar', h: 'Checklists', a: 'Alarms', p: 'Projects', t: 'Tasks', n: 'Notes' };
    if (tabMap[keyLower]) {
      e.preventDefault();
      filterChits(tabMap[keyLower]);
      return;
    }

    if (keyLower === 'k') {
      e.preventDefault();
      window.location.href = '/frontend/editor.html';
      return;
    }

    if (keyLower === 's' && !_hotkeyMode) {
      e.preventDefault();
      window.location.href = '/frontend/settings.html';
      return;
    }

    if (key === '.') {
      e.preventDefault();
      if (currentTab === 'Calendar') {
        _hotkeyMode = 'PERIOD';
        _showPanel('panel-period');
      }
      return;
    }

    if (keyLower === 'f') {
      e.preventDefault();
      _hotkeyMode = 'FILTER';
      _showPanel('panel-filter');
      return;
    }

    if (keyLower === 'o') {
      e.preventDefault();
      _hotkeyMode = 'ORDER';
      _showPanel('panel-order');
      return;
    }
  });
});
