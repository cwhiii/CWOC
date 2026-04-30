/**
 * shared-calendar.js — Calendar display helpers, drag interactions, and pinch zoom.
 *
 * Provides date normalization, day matching, event title/tooltip building,
 * timed event drag-move/resize, month drag, all-day drag, multi-day event
 * rendering, and pinch-to-zoom for calendar time views.
 *
 * Depends on: shared-utils.js (for getCachedSettings, formatTime)
 *             shared-touch.js (for enableTouchDrag)
 *             shared-indicators.js (for _getAllIndicators, _shouldShow)
 *             shared-recurrence.js (for formatRecurrenceRule)
 */

// ── Calendar display helpers ─────────────────────────────────────────────────

/**
 * Normalize a chit's date info for calendar display.
 * Rules:
 * - If chit has due_datetime, use that (ignore start/end even if present)
 * - If chit has start_datetime (no due), use start/end
 * - Returns { start, end, isAllDay, isDueOnly, hasDate }
 * @param {object} chit
 * @returns {object}
 */
function getCalendarDateInfo(chit) {
  const DEFAULT_DUE_DURATION_MIN = 30; // due-date-only events — enough height for one line of text

  const hasDue = !!chit.due_datetime;
  const hasStart = !!chit.start_datetime;
  const isAllDay = !!(chit.all_day || chit.allDay);

  if (hasDue) {
    const dueDate = new Date(chit.due_datetime);
    if (isNaN(dueDate.getTime())) return { hasDate: false };
    if (isAllDay) {
      return { start: dueDate, end: dueDate, isAllDay: true, isDueOnly: true, hasDate: true };
    }
    const endDate = new Date(dueDate.getTime() + DEFAULT_DUE_DURATION_MIN * 60 * 1000);
    return { start: dueDate, end: endDate, isAllDay: false, isDueOnly: true, hasDate: true };
  }

  if (hasStart) {
    const startDate = chit.start_datetime_obj || new Date(chit.start_datetime);
    if (isNaN(startDate.getTime())) return { hasDate: false };
    if (isAllDay) {
      const endDate = chit.end_datetime_obj || (chit.end_datetime ? new Date(chit.end_datetime) : startDate);
      return { start: startDate, end: endDate, isAllDay: true, isDueOnly: false, hasDate: true };
    }
    const endDate = chit.end_datetime_obj || (chit.end_datetime ? new Date(chit.end_datetime) : new Date(startDate.getTime() + 60 * 60 * 1000));
    return { start: startDate, end: endDate, isAllDay: false, isDueOnly: false, hasDate: true };
  }

  return { hasDate: false };
}

/**
 * Check if a chit should appear on a given day in the calendar.
 * @param {object} chit
 * @param {Date} day
 * @returns {boolean}
 */
function chitMatchesDay(chit, day) {
  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return false;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const evStart = new Date(info.start);
  const evEnd = new Date(info.end);
  // Event overlaps this day if it starts before day ends AND ends after day starts
  return evStart <= dayEnd && evEnd >= dayStart;
}

/**
 * Build the title HTML for a calendar event.
 * Adds ⌚ icon for due-date-only chits.
 * Prepends alert indicator icon(s) when settings/context are provided.
 * Includes a title attribute (tooltip) with the chit title and date/time.
 * @param {object} chit
 * @param {boolean} isDueOnly
 * @param {object} [info] - from getCalendarDateInfo
 * @param {object} [settings] - visual_indicators settings object (optional for backward compat)
 * @param {string} [context] - 'calendar-month' | 'calendar-slot' | 'card' (optional)
 * @returns {string}
 */
function calendarEventTitle(chit, isDueOnly, info, settings, context) {
  const allIcons = settings ? _getAllIndicators(chit, settings, context || 'calendar-slot') : '';
  const pinnedIcon = chit.pinned ? '<i class="fas fa-bookmark" style="font-size:0.8em;margin-right:2px;"></i>' : '';
  const dueIcon = isDueOnly ? '⌚ ' : '';
  // Recurrence icon is already included in _getAllIndicators, so skip if allIcons has it
  const recurIcon = (!allIcons.includes('🔁') && ((chit.recurrence_rule && chit.recurrence_rule.freq) || chit._isVirtual)) ? '🔁 ' : '';
  // Weather icon from cache (if chit has location and weather setting allows)
  var wxIcon = '';
  if (chit.location && chit.location.trim() && settings) {
    var wxMode = settings.weather || 'always';
    if (typeof _shouldShow === 'function' && _shouldShow(wxMode, context || 'calendar-slot')) {
      var wxKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
      try {
        var wxCached = JSON.parse(localStorage.getItem(wxKey));
        if (wxCached && wxCached.icon && (Date.now() - wxCached.ts < 3600000)) {
          wxIcon = '<span class="chit-weather-indicator" title="' + (wxCached.tooltip || '').replace(/"/g, '&quot;') + '">' + wxCached.icon + '</span> ';
        }
      } catch (e) {}
    }
  }
  return `<span style="font-weight:bold;font-size:1.1em;">${allIcons}${wxIcon}${pinnedIcon}${recurIcon}${dueIcon}${chit.title || '(Untitled)'}</span>`;
}

/**
 * Build a tooltip string for a calendar event.
 * Uses the time format from settings (loaded into _globalTimeFormat on dashboard).
 */
function calendarEventTooltip(chit, info) {
  let tooltip = chit.title || '(Untitled)';
  if (chit.recurrence_rule && chit.recurrence_rule.freq) {
    tooltip += ' — ' + formatRecurrenceRule(chit.recurrence_rule);
    if (chit._instanceNum) tooltip += ` (#${chit._instanceNum})`;
  }
  if (info && info.hasDate) {
    if (info.isAllDay) {
      tooltip += ' — All Day';
    } else {
      // Format time respecting settings (24hour vs 12hour)
      const fmt = typeof _globalTimeFormat !== 'undefined' ? _globalTimeFormat : '24hour';
      const fmtTime = (d) => {
        const h = d.getHours(), m = d.getMinutes();
        if (fmt === '12hour' || fmt === '12houranalog') {
          const ampm = h >= 12 ? 'PM' : 'AM';
          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
        }
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      const dateStr = info.start.toLocaleDateString();
      if (info.isDueOnly) {
        tooltip += ` — Due: ${dateStr} ${fmtTime(info.start)}`;
      } else {
        tooltip += ` — ${dateStr} ${fmtTime(info.start)} to ${fmtTime(info.end)}`;
      }
    }
  }
  return tooltip;
}
// ── Calendar Drag — Move & Resize ────────────────────────────────────────────

let _calSnapMinutes = 15; // loaded from settings
let _calDragState = null; // { el, chit, mode: 'move'|'resize', startY, startX, origTop, origHeight, origDay, dayColumns }
let _calSnapGrid = null; // the snap grid overlay element

async function _loadCalSnapSetting() {
  try {
    const s = await getCachedSettings();
    if (s.calendar_snap && parseInt(s.calendar_snap) > 0) {
      _calSnapMinutes = parseInt(s.calendar_snap);
    } else if (s.calendar_snap === '0') {
      _calSnapMinutes = 1; // no snapping = 1 min resolution
    }
  } catch (e) { /* default */ }
}

function _snapToGrid(minutes) {
  if (_calSnapMinutes <= 1) return minutes;
  return Math.round(minutes / _calSnapMinutes) * _calSnapMinutes;
}

function _showSnapGrid(container) {
  _hideSnapGrid();
  if (_calSnapMinutes <= 1) return;
  const grid = document.createElement('div');
  grid.className = 'cal-snap-grid';
  grid.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:1440px;pointer-events:none;z-index:5;';
  for (let m = 0; m < 1440; m += _calSnapMinutes) {
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;top:${m}px;left:0;width:100%;height:0;border-top:1px solid rgba(139,90,43,0.15);`;
    grid.appendChild(line);
    // Time label every hour or every snap if snap >= 30
    if (m % 60 === 0 || (_calSnapMinutes >= 30 && m % _calSnapMinutes === 0)) {
      const h = Math.floor(m / 60);
      const mn = m % 60;
      const label = document.createElement('span');
      label.style.cssText = `position:absolute;top:${m}px;left:2px;font-size:0.65em;color:rgba(139,90,43,0.35);pointer-events:none;`;
      label.textContent = `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
      grid.appendChild(label);
    }
  }
  container.appendChild(grid);
  _calSnapGrid = grid;
}

function _hideSnapGrid() {
  if (_calSnapGrid) { _calSnapGrid.remove(); _calSnapGrid = null; }
}

/**
 * Make timed calendar events draggable (move) and resizable (bottom edge).
 * Call after rendering a time-based calendar view.
 * @param {HTMLElement} scrollContainer - the scrollable grid container
 * @param {HTMLElement[]} dayColumns - array of day column elements (in order)
 * @param {Date[]} days - array of Date objects corresponding to dayColumns
 * @param {object[]} chitsMap - map of element -> { chit, info }
 */
function enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap) {
  if (!scrollContainer) return;

  // Add resize handle to each timed event (only for start/end chits, not due-only)
  chitsMap.forEach(({ el, info }) => {
    if (!info.isDueOnly) {
      const handle = document.createElement('div');
      handle.className = 'cal-resize-handle';
      handle.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:6px;cursor:ns-resize;';
      el.appendChild(handle);

      // Resize: mousedown on handle
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey || e.metaKey || e.ctrlKey) return;
        const entry = chitsMap.find(c => c.el === el);
        if (!entry) return;
      _calDragState = {
        el, chit: entry.chit, info: entry.info, mode: 'resize',
        startY: e.clientY,
        origTop: parseInt(el.style.top),
        origHeight: parseInt(el.style.height),
        dayCol: el.parentElement,
        hasMoved: false,
      };
      document.addEventListener('mousemove', _onCalDragMove);
      document.addEventListener('mouseup', _onCalDragEnd);
    });

      // Resize: touch support via enableTouchDrag
      enableTouchDrag(handle, {
        onStart: function (data) {
          const entry = chitsMap.find(c => c.el === el);
          if (!entry) return;
          _calDragState = {
            el, chit: entry.chit, info: entry.info, mode: 'resize',
            startY: data.clientY,
            origTop: parseInt(el.style.top),
            origHeight: parseInt(el.style.height),
            dayCol: el.parentElement,
            hasMoved: false,
          };
        },
        onMove: function (data) {
          _onCalDragMove({ clientX: data.clientX, clientY: data.clientY });
        },
        onEnd: function (data) {
          _onCalDragEnd({ clientX: data.clientX, clientY: data.clientY });
        },
      });
    } // end if (!info.isDueOnly) — resize only for start/end chits

    // Move: mousedown on event (not on handle)
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cal-resize-handle')) return;
      // Don't start drag on modifier clicks (shift=quick edit, cmd/ctrl=browser)
      if (e.shiftKey || e.metaKey || e.ctrlKey) return;
      const entry = chitsMap.find(c => c.el === el);
      if (!entry) return;
      e.preventDefault();
      const colIdx = dayColumns.indexOf(el.parentElement);
      _calDragState = {
        el, chit: entry.chit, info: entry.info, mode: 'move',
        startY: e.clientY, startX: e.clientX,
        origTop: parseInt(el.style.top),
        origHeight: parseInt(el.style.height),
        origColIdx: colIdx,
        dayColumns, days,
        dayCol: el.parentElement,
        hasMoved: false,
      };
      document.addEventListener('mousemove', _onCalDragMove);
      document.addEventListener('mouseup', _onCalDragEnd);
    });

    // Move: touch support via enableTouchDrag
    enableTouchDrag(el, {
      onStart: function (data) {
        // Don't start move if touch is on the resize handle
        if (data.target && data.target.closest && data.target.closest('.cal-resize-handle')) return;
        const entry = chitsMap.find(c => c.el === el);
        if (!entry) return;
        const colIdx = dayColumns.indexOf(el.parentElement);
        _calDragState = {
          el, chit: entry.chit, info: entry.info, mode: 'move',
          startY: data.clientY, startX: data.clientX,
          origTop: parseInt(el.style.top),
          origHeight: parseInt(el.style.height),
          origColIdx: colIdx,
          dayColumns, days,
          dayCol: el.parentElement,
          hasMoved: false,
        };
      },
      onMove: function (data) {
        _onCalDragMove({ clientX: data.clientX, clientY: data.clientY });
      },
      onEnd: function (data) {
        _onCalDragEnd({ clientX: data.clientX, clientY: data.clientY });
      },
    });
  });
}

function _onCalDragMove(e) {
  if (!_calDragState) return;
  const s = _calDragState;

  // Show snap grid on first actual movement (not on click)
  if (!s.hasMoved) {
    s.hasMoved = true;
    s.el.style.opacity = '0.6';
    s.el.style.zIndex = '50';
    _showSnapGrid(s.el.parentElement);
  }

  const dy = e.clientY - s.startY;

  if (s.mode === 'resize') {
    let newHeight = s.origHeight + dy;
    newHeight = _snapToGrid(newHeight);
    if (newHeight < 15) newHeight = 15;
    s.el.style.height = `${newHeight}px`;
  } else if (s.mode === 'move') {
    let newTop = s.origTop + dy;
    newTop = _snapToGrid(newTop);
    if (newTop < 0) newTop = 0;
    if (newTop > 1440 - 15) newTop = 1440 - 15;
    s.el.style.top = `${newTop}px`;

    // Horizontal: detect column change
    if (s.dayColumns && s.dayColumns.length > 1) {
      const dx = e.clientX - s.startX;
      const colWidth = s.dayColumns[0].getBoundingClientRect().width;
      const colShift = Math.round(dx / colWidth);
      const newColIdx = Math.max(0, Math.min(s.dayColumns.length - 1, s.origColIdx + colShift));
      if (newColIdx !== s.dayColumns.indexOf(s.el.parentElement)) {
        s.dayColumns[newColIdx].appendChild(s.el);
        _hideSnapGrid();
        _showSnapGrid(s.dayColumns[newColIdx]);
      }
    }
  }
}

async function _onCalDragEnd(e) {
  document.removeEventListener('mousemove', _onCalDragMove);
  document.removeEventListener('mouseup', _onCalDragEnd);
  _hideSnapGrid();
  if (!_calDragState) return;

  const s = _calDragState;
  s.el.style.opacity = '';
  s.el.style.zIndex = '';
  _calDragState = null;

  // If mouse didn't actually move, don't save anything
  if (!s.hasMoved) return;

  const newTop = parseInt(s.el.style.top);
  const newHeight = parseInt(s.el.style.height);
  const newStartMin = newTop;
  const newEndMin = newTop + newHeight;

  // Determine new day
  let newDay = null;
  if (s.dayColumns && s.days) {
    const colIdx = s.dayColumns.indexOf(s.el.parentElement);
    if (colIdx >= 0 && colIdx < s.days.length) newDay = s.days[colIdx];
  }

  // Build new date values
  const newStartH = Math.floor(newStartMin / 60);
  const newStartM = newStartMin % 60;
  const newEndH = Math.floor(newEndMin / 60);
  const newEndM = newEndMin % 60;

  try {
    // For virtual recurring instances, ask how to apply the change
    if (s.chit._isVirtual && s.chit._parentId) {
      const parentId = s.chit._parentId;
      const dateStr = s.chit._virtualDate;
      const info = getCalendarDateInfo(s.chit);
      if (!info.hasDate) return;

      // Build the new time values
      const d = newDay || info.start;
      let newTimes = {};
      if (info.isDueOnly) {
        const newDue = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newStartH, newStartM);
        newTimes = { due_datetime: newDue.toISOString() };
      } else if (s.mode === 'move') {
        const duration = info.end.getTime() - info.start.getTime();
        const newStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newStartH, newStartM);
        const newEnd = new Date(newStart.getTime() + duration);
        newTimes = { start_datetime: newStart.toISOString(), end_datetime: newEnd.toISOString() };
      } else {
        const newEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newEndH, newEndM);
        newTimes = { end_datetime: newEnd.toISOString() };
      }

      // Show confirmation modal
      _showRecurringDragModal(parentId, dateStr, newTimes, s.chit);
      return;
    }

    const resp = await fetch(`/api/chit/${s.chit.id}`);
    if (!resp.ok) { console.error('Calendar drag: failed to fetch chit', s.chit.id); return; }
    const chit = await resp.json();

    const info = getCalendarDateInfo(chit);
    if (!info.hasDate) { console.error('Calendar drag: chit has no date info'); return; }

    if (info.isDueOnly) {
      // Update due_datetime
      const d = newDay || info.start;
      const newDue = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newStartH, newStartM);
      chit.due_datetime = newDue.toISOString();
    } else {
      // Update start/end, preserve duration on move
      const d = newDay || info.start;
      if (s.mode === 'move') {
        const duration = info.end.getTime() - info.start.getTime();
        const newStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newStartH, newStartM);
        const newEnd = new Date(newStart.getTime() + duration);
        chit.start_datetime = newStart.toISOString();
        chit.end_datetime = newEnd.toISOString();
      } else {
        // Resize: only change end time
        const newEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), newEndH, newEndM);
        chit.end_datetime = newEnd.toISOString();
      }
    }

    const putResp = await fetch(`/api/chits/${chit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit),
    });
    console.log('Calendar drag saved:', chit.id, putResp.status, 'start:', chit.start_datetime, 'end:', chit.end_datetime, 'due:', chit.due_datetime);
  } catch (err) {
    console.error('Calendar drag save failed:', err);
  }
}

/**
 * Show a modal after dragging a recurring instance, asking how to apply the change.
 * Options: This instance / All in series / All following / Cancel
 */
function _showRecurringDragModal(parentId, dateStr, newTimes, virtualChit) {
  document.querySelectorAll('.recurrence-modal-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'recurrence-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:300px;max-width:380px;font-family:Lora, Georgia, serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 16px 0;color:#4a2c2a;font-size:1.1em;';
  title.textContent = 'Edit recurring event';
  modal.appendChild(title);

  const btnStyle = 'display:block;width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:inherit;font-size:0.95em;cursor:pointer;text-align:left;';

  function addBtn(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = btnStyle;
    btn.innerHTML = `${icon} ${label}`;
    btn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    btn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    btn.addEventListener('click', async () => { await onClick(); close(); });
    modal.appendChild(btn);
  }

  function close() { overlay.remove(); }

  addBtn('This instance only', '✂️', async () => {
    // Break off: create a standalone copy at the new time, skip original
    try {
      const parentResp = await fetch(`/api/chit/${parentId}`);
      if (!parentResp.ok) return;
      const parentChit = await parentResp.json();
      const newChit = { ...parentChit };
      newChit.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      newChit.recurrence_rule = null;
      newChit.recurrence_exceptions = null;
      newChit.recurrence = null;
      newChit.recurrence_id = null;
      newChit.created_datetime = new Date().toISOString();
      newChit.modified_datetime = new Date().toISOString();
      Object.assign(newChit, newTimes);
      await fetch('/api/chits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newChit) });
      await _recurrenceAddException(parentId, { date: dateStr, broken_off: true });
    } catch (e) { console.error('Drag break-off failed:', e); }
    if (typeof fetchChits === 'function') fetchChits();
  });

  addBtn('All in series', '🔁', async () => {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) { console.error('Failed to fetch chit for drag save'); return; }
    const chit = await resp.json();
    Object.assign(chit, newTimes);
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
    if (typeof fetchChits === 'function') fetchChits();
    else if (typeof displayChits === 'function') displayChits();
  });

  addBtn('All following', '➡️🔁', async () => {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) { console.error('Failed to fetch chit for drag save'); return; }
    const chit = await resp.json();
    Object.assign(chit, newTimes);
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
    if (typeof fetchChits === 'function') fetchChits();
    else if (typeof displayChits === 'function') displayChits();
  });

  // Cancel
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = btnStyle + 'margin-top:8px;text-align:center;background:#e8dcc8;font-weight:bold;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onmouseover = function() { this.style.background = '#d4c5a9'; };
  cancelBtn.onmouseout = function() { this.style.background = '#e8dcc8'; };
  cancelBtn.addEventListener('click', () => { close(); if (typeof fetchChits === 'function') fetchChits(); else if (typeof displayChits === 'function') displayChits(); });
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { close(); if (typeof fetchChits === 'function') fetchChits(); } });
  document.body.appendChild(overlay);

  function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); if (typeof fetchChits === 'function') fetchChits(); } }
  document.addEventListener('keydown', onKey);
}

/**
 * Enable month view drag — move chits between day cells.
 * @param {HTMLElement} monthGrid - the month grid container
 * @param {function} onDrop - callback(chitId, newDate) after drop
 */
function enableMonthDrag(monthGrid, onDrop) {
  let draggedChitId = null;

  monthGrid.addEventListener('dragstart', (e) => {
    const ev = e.target.closest('.month-event');
    if (!ev || !ev.dataset.chitId) return;
    draggedChitId = ev.dataset.chitId;
    e.dataTransfer.setData('text/plain', draggedChitId);
    e.dataTransfer.effectAllowed = 'move';
    ev.style.opacity = '0.4';
  });

  monthGrid.addEventListener('dragend', (e) => {
    const ev = e.target.closest('.month-event');
    if (ev) ev.style.opacity = '';
    draggedChitId = null;
  });

  monthGrid.addEventListener('dragover', (e) => {
    if (!draggedChitId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  monthGrid.addEventListener('drop', async (e) => {
    if (!draggedChitId) return;
    e.preventDefault();
    const dayCell = e.target.closest('.month-day');
    if (!dayCell || !dayCell.dataset.date) return;
    const newDate = new Date(dayCell.dataset.date);
    if (isNaN(newDate.getTime())) return;

    try {
      const resp = await fetch(`/api/chit/${draggedChitId}`);
      if (!resp.ok) return;
      const chit = await resp.json();
      const info = getCalendarDateInfo(chit);
      if (!info.hasDate) return;

      // Shift dates by the day difference, preserving times
      const oldDay = new Date(info.start.getFullYear(), info.start.getMonth(), info.start.getDate());
      const dayDiff = (newDate.getTime() - oldDay.getTime());

      if (info.isDueOnly) {
        const d = new Date(new Date(chit.due_datetime).getTime() + dayDiff);
        chit.due_datetime = d.toISOString();
      } else {
        if (chit.start_datetime) {
          const d = new Date(new Date(chit.start_datetime).getTime() + dayDiff);
          chit.start_datetime = d.toISOString();
        }
        if (chit.end_datetime) {
          const d = new Date(new Date(chit.end_datetime).getTime() + dayDiff);
          chit.end_datetime = d.toISOString();
        }
      }

      await fetch(`/api/chits/${chit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chit),
      });
      if (typeof fetchChits === 'function') fetchChits();
    } catch (err) {
      console.error('Month drag save failed:', err);
    }
    draggedChitId = null;
  });
}


/**
 * Enable drag for all-day events between day cells in the all-day row.
 * @param {HTMLElement} allDayEventsRow - the flex row containing day cells
 * @param {Date[]} days - array of Date objects for each cell
 */
function enableAllDayDrag(allDayEventsRow, days) {
  if (!allDayEventsRow) return;
  let draggedEv = null;
  let draggedChitId = null;

  allDayEventsRow.addEventListener('dragstart', (e) => {
    const ev = e.target.closest('.all-day-event');
    if (!ev) return;
    draggedEv = ev;
    draggedChitId = null; // will get from chit lookup
    e.dataTransfer.setData('text/plain', 'allday');
    e.dataTransfer.effectAllowed = 'move';
    ev.style.opacity = '0.4';
  });

  allDayEventsRow.addEventListener('dragend', () => {
    if (draggedEv) draggedEv.style.opacity = '';
    draggedEv = null;
  });

  allDayEventsRow.addEventListener('dragover', (e) => {
    if (!draggedEv) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  allDayEventsRow.addEventListener('drop', async (e) => {
    if (!draggedEv) return;
    e.preventDefault();
    // Find which day cell was dropped on (skip the spacer — first child)
    const cells = Array.from(allDayEventsRow.children).slice(1); // skip spacer
    let targetIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const rect = cells[i].getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx < 0 || targetIdx >= days.length) return;

    const chitId = draggedEv.dataset.chitId;
    if (!chitId) return;
    const newDay = days[targetIdx];

    try {
      const resp = await fetch(`/api/chit/${chitId}`);
      if (!resp.ok) return;
      const chit = await resp.json();
      const info = getCalendarDateInfo(chit);
      if (!info.hasDate) return;

      const oldDay = new Date(info.start.getFullYear(), info.start.getMonth(), info.start.getDate());
      const dayDiff = newDay.getTime() - oldDay.getTime();

      if (info.isDueOnly) {
        chit.due_datetime = new Date(new Date(chit.due_datetime).getTime() + dayDiff).toISOString();
      } else {
        if (chit.start_datetime) chit.start_datetime = new Date(new Date(chit.start_datetime).getTime() + dayDiff).toISOString();
        if (chit.end_datetime) chit.end_datetime = new Date(new Date(chit.end_datetime).getTime() + dayDiff).toISOString();
      }

      await fetch(`/api/chits/${chit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chit),
      });
      if (typeof fetchChits === 'function') fetchChits();
    } catch (err) {
      console.error('All-day drag failed:', err);
    }
  });

  // Make all-day events draggable
  allDayEventsRow.querySelectorAll('.all-day-event').forEach(ev => {
    ev.draggable = true;
  });
}


/**
 * Render all-day events into the all-day row.
 * Multi-day events span across multiple day columns as a single div.
 * Uses CSS Grid with columns matching the day count.
 */
function renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context) {
  const numDays = dayData.length;

  // Create a grid container for spanning events
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${numDays}, 1fr);gap:0;width:100%;position:relative;`;

  // Collect all unique all-day chits with their day spans
  const seen = new Map(); // chitId -> { chit, info, startCol, endCol }
  dayData.forEach((dd, colIdx) => {
    dd.allDay.forEach(({ chit, info }) => {
      const key = chit.id + (chit._virtualDate || '');
      if (!seen.has(key)) {
        seen.set(key, { chit, info, startCol: colIdx, endCol: colIdx });
      } else {
        seen.get(key).endCol = colIdx;
      }
    });
  });

  // Create empty cells for the grid background (borders)
  for (let i = 0; i < numDays; i++) {
    const cell = document.createElement('div');
    cell.style.cssText = `grid-column:${i + 1};grid-row:1;border-left:${i > 0 ? '1px solid #d3d3d3' : 'none'};min-height:4px;`;
    grid.appendChild(cell);
  }

  // Render each unique event, packing into rows (reuse rows when spans don't overlap)
  const rowOccupancy = []; // rowOccupancy[r] = Set of occupied column indices
  seen.forEach(({ chit, info, startCol, endCol }) => {
    // Find the first row where columns startCol..endCol are all free
    let targetRow = -1;
    for (let r = 0; r < rowOccupancy.length; r++) {
      let fits = true;
      for (let c = startCol; c <= endCol; c++) {
        if (rowOccupancy[r].has(c)) { fits = false; break; }
      }
      if (fits) { targetRow = r; break; }
    }
    if (targetRow === -1) {
      targetRow = rowOccupancy.length;
      rowOccupancy.push(new Set());
    }
    // Mark columns as occupied in this row
    for (let c = startCol; c <= endCol; c++) {
      rowOccupancy[targetRow].add(c);
    }

    const ev = document.createElement('div');
    ev.className = 'all-day-event';
    ev.dataset.chitId = chit.id;
    ev.dataset.allDayRow = String(targetRow);
    ev.style.backgroundColor = chitColor(chit);
    ev.style.gridColumn = `${startCol + 1} / ${endCol + 2}`; // grid is 1-indexed, end is exclusive
    ev.style.gridRow = `${targetRow + 2}`; // +2 because row 1 is the border cells
    ev.style.margin = '1px 2px';
    if (chit.status === "Complete") ev.classList.add("completed-task");
    ev.title = calendarEventTooltip(chit, info);
    ev.innerHTML = calendarEventTitle(chit, info.isDueOnly, info, settings, context);
    if (typeof attachCalendarChitEvents === 'function') attachCalendarChitEvents(ev, chit);
    grid.appendChild(ev);
  });

  allDayEventsRow.appendChild(grid);

  // ── Limit to MAX_VISIBLE rows with expand/shrink ─────────────────
  var totalRows = rowOccupancy.length;
  var MAX_VISIBLE = 6;
  if (totalRows > MAX_VISIBLE) {
    var _expanded = false;

    // Hide rows beyond MAX_VISIBLE - 1 (reserve last visible slot for the button)
    function _applyRowVisibility() {
      var events = grid.querySelectorAll('.all-day-event');
      events.forEach(function (ev) {
        var row = parseInt(ev.dataset.allDayRow, 10);
        if (_expanded) {
          ev.style.display = '';
        } else {
          ev.style.display = (row < MAX_VISIBLE - 1) ? '' : 'none';
        }
      });
    }

    // Create expand/shrink button
    var toggleBtn = document.createElement('div');
    toggleBtn.className = 'all-day-expand-btn';
    var hiddenCount = 0;
    grid.querySelectorAll('.all-day-event').forEach(function (ev) {
      if (parseInt(ev.dataset.allDayRow, 10) >= MAX_VISIBLE - 1) hiddenCount++;
    });
    toggleBtn.textContent = '▼ ' + hiddenCount + ' more';
    toggleBtn.style.cssText = 'grid-column:1/-1;grid-row:' + (MAX_VISIBLE + 1) +
      ';text-align:center;padding:4px;font-size:0.8em;cursor:pointer;' +
      'background:#e0d4b5;border-radius:3px;margin:2px;font-weight:bold;color:#4a2c2a;';
    toggleBtn.addEventListener('click', function () {
      _expanded = !_expanded;
      _applyRowVisibility();
      if (_expanded) {
        toggleBtn.textContent = '▲ Show less';
        toggleBtn.style.gridRow = String(totalRows + 2);
      } else {
        toggleBtn.textContent = '▼ ' + hiddenCount + ' more';
        toggleBtn.style.gridRow = String(MAX_VISIBLE + 1);
      }
    });
    grid.appendChild(toggleBtn);
    _applyRowVisibility();
  }
}


// ── Calendar Pinch-to-Zoom (vertical axis only) ─────────────────────────────

/** Current vertical zoom scale for calendar time views */
var _calZoomScale = 1.0;
var _calZoomMin = 0.4;
var _calZoomMax = 3.0;

/**
 * Enable pinch-to-zoom on a calendar scroll container.
 * Scales the vertical axis only (time grid) using CSS transform scaleY.
 * Works on touch devices with 2-finger pinch gestures.
 *
 * @param {HTMLElement} scrollContainer - The .week-view scroll container
 */
function enableCalendarPinchZoom(scrollContainer) {
  if (!scrollContainer) return;

  var _pinchStartDist = 0;
  var _pinchStartScale = 1;
  var _isPinching = false;

  // Find the inner content elements to scale (hour column + day columns)
  function _getScalableChildren() {
    return scrollContainer.querySelectorAll('.hour-column, .day-column');
  }

  function _applyZoom(scale) {
    _calZoomScale = Math.max(_calZoomMin, Math.min(_calZoomMax, scale));
    var children = _getScalableChildren();
    children.forEach(function (el) {
      el.style.transform = 'scaleY(' + _calZoomScale + ')';
      el.style.transformOrigin = 'top left';
    });
    // Also scale hour blocks text to stay readable
    var hourBlocks = scrollContainer.querySelectorAll('.hour-block');
    hourBlocks.forEach(function (hb) {
      hb.style.transform = 'scaleY(' + (1 / _calZoomScale) + ')';
      hb.style.transformOrigin = 'top right';
    });
    // Scale timed event text to stay readable
    var events = scrollContainer.querySelectorAll('.timed-event');
    events.forEach(function (ev) {
      ev.style.transform = 'scaleY(' + (1 / _calZoomScale) + ')';
      ev.style.transformOrigin = 'top left';
    });
  }

  function _getTouchDist(e) {
    if (e.touches.length < 2) return 0;
    var t1 = e.touches[0];
    var t2 = e.touches[1];
    // Only care about vertical distance for vertical-only zoom
    return Math.abs(t2.clientY - t1.clientY);
  }

  scrollContainer.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      _isPinching = true;
      _pinchStartDist = _getTouchDist(e);
      _pinchStartScale = _calZoomScale;
    }
  }, { passive: true });

  scrollContainer.addEventListener('touchmove', function (e) {
    if (!_isPinching || e.touches.length < 2) return;
    e.preventDefault();
    var dist = _getTouchDist(e);
    if (_pinchStartDist === 0) return;
    var ratio = dist / _pinchStartDist;
    _applyZoom(_pinchStartScale * ratio);
  }, { passive: false });

  scrollContainer.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) {
      _isPinching = false;
    }
  }, { passive: true });

  // Apply current zoom level (persists across re-renders)
  if (_calZoomScale !== 1.0) {
    _applyZoom(_calZoomScale);
  }
}
