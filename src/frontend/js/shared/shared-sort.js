/**
 * shared-sort.js — Manual sort order persistence and drag-to-reorder.
 *
 * Provides per-view manual ordering of chit cards, persisted in localStorage.
 * Supports both mouse drag and touch drag for reordering.
 *
 * Depends on: shared-touch.js (for enableTouchDrag)
 */

// ── Drag Suppression Flag ─────────────────────────────────────────────────────
// After any drag-and-drop completes, the browser fires a click event on the
// dragged element. This flag lets click/dblclick handlers know to ignore that
// spurious click so it doesn't open quick-edit, navigate to the editor, etc.

/**
 * Mark that a drag operation just finished. Clears automatically after the
 * browser's post-drag click event has had a chance to fire.
 */
function _markDragJustEnded() {
  window._dragJustEnded = true;
  // Clear after a generous delay — the browser's post-drag click can fire
  // asynchronously, so we hold the flag for 300ms to be safe.
  setTimeout(function () { window._dragJustEnded = false; }, 300);
}

// Capture-phase listener: swallow click/dblclick on chit cards and calendar events
// that fire immediately after a drag operation ends. This prevents navigation,
// quick-edit, and link-following that the browser triggers post-drag.
document.addEventListener('click', function (e) {
  if (!window._dragJustEnded) return;
  if (e.target.closest('.chit-card, .timed-event, .month-event, .all-day-event, .day-event, .itinerary-event, .kanban-project-header, .projects-child-item')) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
document.addEventListener('dblclick', function (e) {
  if (!window._dragJustEnded) return;
  if (e.target.closest('.chit-card, .timed-event, .month-event, .all-day-event, .day-event, .itinerary-event, .kanban-project-header, .projects-child-item')) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

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
    const data = all[tab];
    if (!data) return [];
    // Support both old format (flat array of IDs) and new format (array of {id, col})
    if (Array.isArray(data)) return data;
    return [];
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
  order.forEach((entry, i) => {
    // Handle both old format (string ID) and new format ({id, col})
    const id = typeof entry === 'object' ? entry.id : entry;
    orderMap[id] = i;
  });
  return [...chitList].sort((a, b) => {
    const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : Infinity;
    const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : Infinity;
    return posA - posB;
  });
}

/**
 * Enable drag-to-reorder on chit cards within a container.
 * After a drop, saves the new order and calls onReorder.
 *
 * Supports an optional onLongPress callback per card. When provided,
 * uses enableTouchGesture() for unified drag + long-press on mobile.
 * When not provided, uses enableTouchDrag() for drag-only (backward compat).
 *
 * @param {HTMLElement} container - The view container with .chit-card children
 * @param {string} tab - The current tab name
 * @param {function} [onReorder] - Callback after reorder (e.g. to re-render)
 * @param {object} [longPressMap] - Map of chitId → long-press callback function
 */
function enableDragToReorder(container, tab, onReorder, longPressMap) {
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
    card.classList.add('cwoc-dragging');
  });

  container.addEventListener('dragend', () => {
    if (draggedEl) draggedEl.classList.remove('cwoc-dragging');
    draggedEl = null;
    container.querySelectorAll('.chit-card').forEach(c => {
      c.style.borderTop = '';
      c.style.borderBottom = '';
    });
    _markDragJustEnded();
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

  // Touch drag support for chit card reorder (unified with long-press)
  var _touchDraggedCard = null;
  container.querySelectorAll('.chit-card[data-chit-id]').forEach(function (card) {
    // Skip cards inside checklist areas
    if (card.closest('ul[data-chit-id]')) return;

    var chitId = card.dataset.chitId;
    var lpCallback = longPressMap ? longPressMap[chitId] : null;

    // Build drag callbacks (shared between both paths)
    var dragCallbacks = {
      onStart: function (data) {
        if (data.target && data.target.closest && data.target.closest('li[data-idx]')) return;
        if (data.target && data.target.closest && data.target.closest('ul[data-chit-id]')) return;
        _touchDraggedCard = card;
      },
      onMove: function (data) {
        if (!_touchDraggedCard) return;
        container.querySelectorAll('.chit-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
        var target = document.elementFromPoint(data.clientX, data.clientY);
        if (!target) return;
        var targetCard = target.closest('.chit-card');
        if (targetCard && targetCard !== _touchDraggedCard) {
          var rect = targetCard.getBoundingClientRect();
          var midY = rect.top + rect.height / 2;
          if (data.clientY < midY) {
            targetCard.style.borderTop = '3px solid #8b5a2b';
          } else {
            targetCard.style.borderBottom = '3px solid #8b5a2b';
          }
        }
      },
      onEnd: function (data) {
        if (!_touchDraggedCard) return;
        container.querySelectorAll('.chit-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });

        var target = document.elementFromPoint(data.clientX, data.clientY);
        if (!target) { _touchDraggedCard = null; return; }
        var targetCard = target.closest('.chit-card');
        if (!targetCard || targetCard === _touchDraggedCard) { _touchDraggedCard = null; return; }

        var cards = Array.from(container.querySelectorAll('.chit-card[data-chit-id]'));
        var ids = cards.map(function (c) { return c.dataset.chitId; });
        var fromId = _touchDraggedCard.dataset.chitId;
        var toId = targetCard.dataset.chitId;
        var fromIdx = ids.indexOf(fromId);
        var toIdx = ids.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) { _touchDraggedCard = null; return; }

        var rect = targetCard.getBoundingClientRect();
        if (data.clientY > rect.top + rect.height / 2) toIdx++;

        ids.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx--;
        ids.splice(toIdx, 0, fromId);

        saveManualOrder(tab, ids);
        currentSortField = 'manual';
        var sel = document.getElementById('sort-select');
        if (sel) sel.value = 'manual';
        _updateSortUI();
        _touchDraggedCard = null;
        if (onReorder) onReorder();
      },
    };

    // Use unified gesture if long-press callback is provided, otherwise drag-only
    if (lpCallback && typeof enableTouchGesture === 'function') {
      enableTouchGesture(card, {
        onDragStart: dragCallbacks.onStart,
        onDragMove: dragCallbacks.onMove,
        onDragEnd: dragCallbacks.onEnd,
        onLongPress: function () { lpCallback(); },
      });
    } else {
      enableTouchDrag(card, {
        onStart: dragCallbacks.onStart,
        onMove: dragCallbacks.onMove,
        onEnd: dragCallbacks.onEnd,
      });
    }
  });
}
