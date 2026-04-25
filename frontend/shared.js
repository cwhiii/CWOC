/**
 * shared.js — Shared code between dashboard (main.js) and editor (editor.js).
 * Loaded before both. Contains: inline checklist interactions, manual sort persistence,
 * drag-to-reorder, and any other reused utilities.
 */

// ── Inline Checklist Toggle & Reorder (for dashboard views) ──────────────────

/**
 * Toggle a checklist item's checked state and save to the API.
 * @param {string} chitId - The chit ID
 * @param {number} itemIndex - Index of the checklist item
 * @param {boolean} newChecked - New checked state
 */
async function toggleChecklistItem(chitId, itemIndex, newChecked) {
  try {
    const resp = await fetch(`/api/chit/${chitId}`);
    if (!resp.ok) return;
    const chit = await resp.json();
    if (!Array.isArray(chit.checklist) || !chit.checklist[itemIndex]) return;
    chit.checklist[itemIndex].checked = newChecked;
    await fetch(`/api/chits/${chitId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit),
    });
  } catch (e) {
    console.error('Failed to toggle checklist item:', e);
  }
}

/**
 * Move a checklist item within a chit's checklist and save.
 * @param {string} chitId
 * @param {number} fromIndex
 * @param {number} toIndex
 */
async function moveChecklistItem(chitId, fromIndex, toIndex) {
  try {
    const resp = await fetch(`/api/chit/${chitId}`);
    if (!resp.ok) return;
    const chit = await resp.json();
    if (!Array.isArray(chit.checklist)) return;
    const [item] = chit.checklist.splice(fromIndex, 1);
    chit.checklist.splice(toIndex, 0, item);
    await fetch(`/api/chits/${chitId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit),
    });
  } catch (e) {
    console.error('Failed to move checklist item:', e);
  }
}

/**
 * Move a checklist item from one chit to another (or within the same chit) and save both.
 * @param {string} fromChitId
 * @param {number} fromIndex
 * @param {string} toChitId
 * @param {number} toIndex
 */
async function moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex) {
  try {
    if (fromChitId === toChitId) {
      return moveChecklistItem(fromChitId, fromIndex, toIndex);
    }
    // Fetch both chits
    const [respFrom, respTo] = await Promise.all([
      fetch(`/api/chit/${fromChitId}`),
      fetch(`/api/chit/${toChitId}`),
    ]);
    if (!respFrom.ok || !respTo.ok) return;
    const chitFrom = await respFrom.json();
    const chitTo = await respTo.json();
    if (!Array.isArray(chitFrom.checklist)) return;
    if (!Array.isArray(chitTo.checklist)) chitTo.checklist = [];

    // Remove from source
    const [item] = chitFrom.checklist.splice(fromIndex, 1);
    // Insert into target
    chitTo.checklist.splice(toIndex, 0, item);

    // Save both
    await Promise.all([
      fetch(`/api/chits/${fromChitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chitFrom),
      }),
      fetch(`/api/chits/${toChitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chitTo),
      }),
    ]);
  } catch (e) {
    console.error('Failed to move checklist item cross-chit:', e);
  }
}

/**
 * Render an interactive checklist inside a container element.
 * Supports checking/unchecking, drag-to-reorder within a chit,
 * and drag items between different chits.
 */
function renderInlineChecklist(container, chit, onUpdate) {
  if (!chit.checklist || !Array.isArray(chit.checklist) || chit.checklist.length === 0) return;

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0.25em 0 0 0;padding:0;list-style:none;';
  list.dataset.chitId = chit.id;
  list.draggable = false;

  chit.checklist.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || !item.text) return;

    const li = document.createElement('li');
    li.style.cssText = `padding-left:${(item.level || 0) * 18 + 4}px;padding-top:2px;padding-bottom:2px;display:flex;align-items:center;gap:4px;cursor:grab;`;
    li.draggable = true;
    li.dataset.idx = idx;
    li.dataset.chitId = chit.id;

    const isDone = item.checked === true || item.done === true;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDone;
    cb.style.cursor = 'pointer';
    cb.addEventListener('change', async () => {
      await toggleChecklistItem(chit.id, idx, cb.checked);
      item.checked = cb.checked;
      textSpan.style.textDecoration = cb.checked ? 'line-through' : '';
      textSpan.style.opacity = cb.checked ? '0.55' : '1';
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = item.text;
    textSpan.style.textDecoration = isDone ? 'line-through' : '';
    textSpan.style.opacity = isDone ? '0.55' : '1';
    textSpan.style.flex = '1';

    li.appendChild(cb);
    li.appendChild(textSpan);

    // Drag events — support within-chit and cross-chit moves
    li.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer.setData('application/x-checklist-item', JSON.stringify({
        chitId: chit.id,
        idx: idx,
      }));
      e.dataTransfer.effectAllowed = 'move';
      li.style.opacity = '0.4';
    });
    li.addEventListener('dragend', () => { li.style.opacity = '1'; });
    li.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('application/x-checklist-item')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      li.style.borderTop = '2px solid #8b5a2b';
    });
    li.addEventListener('dragleave', () => { li.style.borderTop = ''; });
    li.addEventListener('drop', async (e) => {
      if (!e.dataTransfer.types.includes('application/x-checklist-item')) return;
      e.preventDefault();
      e.stopPropagation();
      li.style.borderTop = '';
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/x-checklist-item'));
        const fromChitId = data.chitId;
        const fromIdx = data.idx;
        const toChitId = chit.id;
        const toIdx = parseInt(li.dataset.idx);
        await moveChecklistItemCrossChit(fromChitId, fromIdx, toChitId, toIdx);
        if (onUpdate) onUpdate();
      } catch (err) {
        console.error('Checklist drop error:', err);
      }
    });

    list.appendChild(li);
  });

  // Also allow dropping onto the list itself (append to end)
  list.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-checklist-item')) return;
    // Only if not over a specific li
    if (e.target.closest('li[data-idx]')) return;
    e.preventDefault();
    e.stopPropagation();
    list.style.borderBottom = '2px solid #8b5a2b';
  });
  list.addEventListener('dragleave', () => { list.style.borderBottom = ''; });
  list.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.types.includes('application/x-checklist-item')) return;
    if (e.target.closest('li[data-idx]')) return; // handled by li handler
    e.preventDefault();
    e.stopPropagation();
    list.style.borderBottom = '';
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/x-checklist-item'));
      const fromChitId = data.chitId;
      const fromIdx = data.idx;
      const toChitId = chit.id;
      const toIdx = chit.checklist.length; // append to end
      await moveChecklistItemCrossChit(fromChitId, fromIdx, toChitId, toIdx);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Checklist drop error:', err);
    }
  });

  container.appendChild(list);
}


// ── Manual Sort Order (per-view, persisted in localStorage) ──────────────────

const MANUAL_ORDER_KEY = 'cwoc_manual_order';

/**
 * Get the manual sort order for a specific view tab.
 * @param {string} tab - e.g. 'Checklists', 'Tasks', 'Notes', 'Alarms', 'Projects'
 * @returns {string[]} Array of chit IDs in order
 */
function getManualOrder(tab) {
  try {
    const all = JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY) || '{}');
    return Array.isArray(all[tab]) ? all[tab] : [];
  } catch (e) { return []; }
}

/**
 * Save the manual sort order for a specific view tab.
 * @param {string} tab
 * @param {string[]} ids - Array of chit IDs in desired order
 */
function saveManualOrder(tab, ids) {
  try {
    const all = JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY) || '{}');
    all[tab] = ids;
    localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(all));
  } catch (e) { console.error('Failed to save manual order:', e); }
}

/**
 * Apply manual sort order to a chit list.
 * Chits in the saved order come first (in that order), then any new chits not in the order.
 * @param {string} tab
 * @param {object[]} chitList
 * @returns {object[]}
 */
function applyManualOrder(tab, chitList) {
  const order = getManualOrder(tab);
  if (order.length === 0) return chitList;
  const orderMap = {};
  order.forEach((id, i) => { orderMap[id] = i; });
  return [...chitList].sort((a, b) => {
    const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : Infinity;
    const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : Infinity;
    return posA - posB;
  });
}

/**
 * Enable drag-to-reorder on chit cards within a container.
 * After a drop, saves the new order and calls onReorder.
 * @param {HTMLElement} container - The view container with .chit-card children
 * @param {string} tab - The current tab name
 * @param {function} [onReorder] - Callback after reorder (e.g. to re-render)
 */
function enableDragToReorder(container, tab, onReorder) {
  let draggedEl = null;

  container.addEventListener('dragstart', (e) => {
    // Don't hijack checklist-item drags
    if (e.target.closest('ul[data-chit-id]') || e.target.closest('li[data-idx]')) return;
    if (e.dataTransfer.types.includes('application/x-checklist-item')) return;
    const card = e.target.closest('.chit-card');
    if (!card || !card.dataset.chitId) return;
    draggedEl = card;
    e.dataTransfer.setData('application/x-chit-reorder', card.dataset.chitId);
    e.dataTransfer.effectAllowed = 'move';
    card.style.opacity = '0.4';
  });

  container.addEventListener('dragend', () => {
    if (draggedEl) draggedEl.style.opacity = '1';
    draggedEl = null;
    container.querySelectorAll('.chit-card').forEach(c => {
      c.style.borderTop = '';
      c.style.borderBottom = '';
    });
  });

  container.addEventListener('dragover', (e) => {
    if (!draggedEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.chit-card');
    container.querySelectorAll('.chit-card').forEach(c => {
      c.style.borderTop = '';
      c.style.borderBottom = '';
    });
    if (card && card !== draggedEl) {
      // Show indicator above or below based on mouse position
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        card.style.borderTop = '3px solid #8b5a2b';
      } else {
        card.style.borderBottom = '3px solid #8b5a2b';
      }
    }
  });

  container.addEventListener('drop', (e) => {
    if (!draggedEl) return;
    e.preventDefault();
    const card = e.target.closest('.chit-card');
    if (!card || card === draggedEl) return;

    // Collect current order of chit IDs from DOM
    const cards = Array.from(container.querySelectorAll('.chit-card[data-chit-id]'));
    const ids = cards.map(c => c.dataset.chitId);

    const fromId = draggedEl.dataset.chitId;
    const toId = card.dataset.chitId;
    const fromIdx = ids.indexOf(fromId);
    let toIdx = ids.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;

    // Determine if dropping above or below
    const rect = card.getBoundingClientRect();
    if (e.clientY > rect.top + rect.height / 2) toIdx++;

    ids.splice(fromIdx, 1);
    if (fromIdx < toIdx) toIdx--;
    ids.splice(toIdx, 0, fromId);

    saveManualOrder(tab, ids);
    // Auto-switch to manual sort
    currentSortField = 'manual';
    const sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    _updateSortUI();
    if (onReorder) onReorder();
  });
}


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
  return info.start.toDateString() === day.toDateString();
}

/**
 * Build the title HTML for a calendar event.
 * Adds ⌚ icon for due-date-only chits.
 * Includes a title attribute (tooltip) with the chit title and date/time.
 * @param {object} chit
 * @param {boolean} isDueOnly
 * @param {object} [info] - from getCalendarDateInfo
 * @returns {string}
 */
function calendarEventTitle(chit, isDueOnly, info) {
  const icon = isDueOnly ? '⌚ ' : '';
  return `<span style="font-weight:bold;font-size:1.1em;">${icon}${chit.title || '(Untitled)'}</span>`;
}

/**
 * Build a tooltip string for a calendar event.
 * Uses the time format from settings (loaded into _globalTimeFormat on dashboard).
 */
function calendarEventTooltip(chit, info) {
  let tooltip = chit.title || '(Untitled)';
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
    const resp = await fetch('/api/settings/default_user');
    if (!resp.ok) return;
    const s = await resp.json();
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
        const entry = chitsMap.find(c => c.el === el);
        if (!entry) return;
      _calDragState = {
        el, chit: entry.chit, info: entry.info, mode: 'resize',
        startY: e.clientY,
        origTop: parseInt(el.style.top),
        origHeight: parseInt(el.style.height),
        dayCol: el.parentElement,
      };
      _showSnapGrid(el.parentElement);
      document.addEventListener('mousemove', _onCalDragMove);
      document.addEventListener('mouseup', _onCalDragEnd);
    });
    } // end if (!info.isDueOnly) — resize only for start/end chits

    // Move: mousedown on event (not on handle)
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cal-resize-handle')) return;
      // Don't interfere with dblclick
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
      };
      el.style.opacity = '0.6';
      el.style.zIndex = '50';
      _showSnapGrid(el.parentElement);
      document.addEventListener('mousemove', _onCalDragMove);
      document.addEventListener('mouseup', _onCalDragEnd);
    });
  });
}

function _onCalDragMove(e) {
  if (!_calDragState) return;
  const s = _calDragState;
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
    const resp = await fetch(`/api/chit/${s.chit.id}`);
    if (!resp.ok) return;
    const chit = await resp.json();

    const info = getCalendarDateInfo(chit);
    if (!info.hasDate) return;

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

    await fetch(`/api/chits/${chit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit),
    });

    // Don't re-render — DOM is already updated by the drag
  } catch (err) {
    console.error('Calendar drag save failed:', err);
  }
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


// ── Nested Tag Utilities ─────────────────────────────────────────────────────

/**
 * Build a nested tree structure from a flat list of tag objects.
 * Tags with "/" in the name are nested: "Work/Projects/CWOC" → Work → Projects → CWOC
 * @param {Array} flatTags - Array of { name, color, favorite } objects
 * @returns {Array} Tree nodes: { name, fullPath, color, favorite, children: [] }
 */
function buildTagTree(flatTags) {
  const root = [];
  const nodeMap = {};

  flatTags.forEach(tag => {
    const parts = tag.name.split('/');
    let currentLevel = root;
    let pathSoFar = '';

    parts.forEach((part, i) => {
      pathSoFar = pathSoFar ? pathSoFar + '/' + part : part;
      if (!nodeMap[pathSoFar]) {
        const isLeaf = i === parts.length - 1;
        const node = {
          name: part,
          fullPath: pathSoFar,
          color: isLeaf ? tag.color : null,
          favorite: isLeaf ? !!tag.favorite : false,
          children: [],
        };
        nodeMap[pathSoFar] = node;
        currentLevel.push(node);
      }
      currentLevel = nodeMap[pathSoFar].children;
    });
  });

  return root;
}

/**
 * Flatten a tag tree back to a flat list of { name, color, favorite }.
 * Only includes leaf nodes (or nodes that were originally defined).
 * @param {Array} tree
 * @param {Array} originalNames - original flat tag names for reference
 * @returns {Array}
 */
function flattenTagTree(tree, originalNames) {
  const result = [];
  function walk(nodes) {
    nodes.forEach(node => {
      if (node.children.length === 0 || originalNames.includes(node.fullPath)) {
        result.push({ name: node.fullPath, color: node.color, favorite: node.favorite });
      }
      walk(node.children);
    });
  }
  walk(tree);
  return result;
}

/**
 * Check if a chit's tags match a filter tag (including descendants).
 * E.g., filter "Work" matches chit tag "Work/Projects/CWOC".
 * @param {string[]} chitTags - tags on the chit
 * @param {string} filterTag - the filter tag path
 * @returns {boolean}
 */
function matchesTagFilter(chitTags, filterTag) {
  if (!Array.isArray(chitTags) || !filterTag) return false;
  return chitTags.some(t => t === filterTag || t.startsWith(filterTag + '/'));
}

/**
 * Render a tag tree as an expandable/collapsible HTML tree.
 * @param {HTMLElement} container - element to render into
 * @param {Array} tree - from buildTagTree()
 * @param {string[]} selectedTags - currently selected full paths
 * @param {function} onToggle - callback(fullPath, isNowSelected) when a tag is toggled
 * @param {object} [opts] - { showFavorites: bool }
 */
function renderTagTree(container, tree, selectedTags, onToggle, opts) {
  container.innerHTML = '';

  function renderLevel(nodes, parentEl, depth) {
    nodes.forEach(node => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 0;padding-left:${depth * 16}px;cursor:pointer;`;

      // Expand/collapse toggle for nodes with children
      if (node.children.length > 0) {
        const toggle = document.createElement('span');
        toggle.style.cssText = 'font-size:0.7em;width:14px;text-align:center;cursor:pointer;user-select:none;';
        toggle.textContent = '▼';
        const childContainer = document.createElement('div');
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = childContainer.style.display === 'none';
          childContainer.style.display = isHidden ? '' : 'none';
          toggle.textContent = isHidden ? '▼' : '▶';
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.style.cssText = 'width:14px;';
        row.appendChild(spacer);
      }

      // Favorite star
      if (node.favorite) {
        const star = document.createElement('span');
        star.textContent = '⭐';
        star.style.fontSize = '0.8em';
        row.appendChild(star);
      }

      // Color swatch
      if (node.color) {
        const swatch = document.createElement('span');
        swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${node.color};flex-shrink:0;`;
        row.appendChild(swatch);
      }

      // Tag name badge
      const isSelected = selectedTags.includes(node.fullPath);
      const badge = document.createElement('span');
      badge.textContent = node.name;
      badge.style.cssText = `font-size:0.85em;padding:1px 6px;border-radius:10px;${isSelected ? 'background:#8b5a2b;color:#fff;' : 'background:rgba(139,90,43,0.1);color:#3c2f2f;'}`;
      row.appendChild(badge);

      // Click to toggle selection
      row.addEventListener('click', () => {
        if (onToggle) onToggle(node.fullPath, !isSelected);
      });

      parentEl.appendChild(row);

      // Children
      if (node.children.length > 0) {
        const childContainer = document.createElement('div');
        renderLevel(node.children, childContainer, depth + 1);
        parentEl.appendChild(childContainer);
      }
    });
  }

  renderLevel(tree, container, 0);
}

// Session-level recent tags tracking
let _recentTags = [];

function trackRecentTag(tagPath) {
  _recentTags = _recentTags.filter(t => t !== tagPath);
  _recentTags.unshift(tagPath);
  if (_recentTags.length > 3) _recentTags = _recentTags.slice(0, 3);
}

function getRecentTags() {
  return _recentTags.slice(0, 3);
}


// ── System tags (auto-generated by backend, should not appear in user-facing tag lists) ──
const SYSTEM_TAGS = ['Calendar', 'Checklists', 'Alarms', 'Projects', 'Tasks', 'Notes'];

function isSystemTag(tagName) {
  return SYSTEM_TAGS.includes(tagName);
}
