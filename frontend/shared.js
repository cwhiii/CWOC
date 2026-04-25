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
 */
function calendarEventTooltip(chit, info) {
  let tooltip = chit.title || '(Untitled)';
  if (info && info.hasDate) {
    if (info.isAllDay) {
      tooltip += ' — All Day';
    } else if (info.isDueOnly) {
      tooltip += ' — Due: ' + info.start.toLocaleString();
    } else {
      tooltip += ' — ' + info.start.toLocaleString() + ' to ' + info.end.toLocaleString();
    }
  }
  return tooltip;
}
