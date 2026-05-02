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

  // ── Touch drag support: float card under finger, shift others out of the way ──
  var _touchDragState = null;

  container.querySelectorAll('.chit-card[data-chit-id]').forEach(function (card) {
    // Skip cards inside checklist areas
    if (card.closest('ul[data-chit-id]')) return;

    var chitId = card.dataset.chitId;
    var lpCallback = longPressMap ? longPressMap[chitId] : null;

    var dragCallbacks = {
      onStart: function (data) {
        if (data.target && data.target.closest && data.target.closest('li[data-idx]')) return;
        if (data.target && data.target.closest && data.target.closest('ul[data-chit-id]')) return;

        // Remove the default touch-drag class — we apply our own floating styles
        card.classList.remove('cwoc-touch-dragging');

        var rect = card.getBoundingClientRect();

        // Create a placeholder to hold the card's space in the flow
        var placeholder = document.createElement('div');
        placeholder.className = 'cwoc-drag-placeholder';
        placeholder.style.cssText = 'height:' + rect.height + 'px;border:2px dashed #8b5a2b;border-radius:6px;background:rgba(139,90,43,0.08);box-sizing:border-box;margin-bottom:' + (getComputedStyle(card).marginBottom || '0') + ';transition:height 0.15s ease;';
        card.parentNode.insertBefore(placeholder, card);

        // Float the card under the finger
        card.style.position = 'fixed';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.width = rect.width + 'px';
        card.style.zIndex = '10000';
        card.style.opacity = '0.9';
        card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        card.style.transition = 'none';
        card.style.pointerEvents = 'none';

        // Prevent pull-to-refresh during drag
        document.body.style.overscrollBehavior = 'contain';

        _touchDragState = {
          card: card,
          placeholder: placeholder,
          offsetX: data.clientX - rect.left,
          offsetY: data.clientY - rect.top,
          startScrollTop: container.scrollTop || 0,
          lastInsertIdx: -1,
        };
      },
      onMove: function (data) {
        if (!_touchDragState) return;
        var s = _touchDragState;

        // Move the floating card to follow the finger
        s.card.style.left = (data.clientX - s.offsetX) + 'px';
        s.card.style.top = (data.clientY - s.offsetY) + 'px';

        // Find which card the finger is over (excluding the dragged card)
        var allCards = Array.from(container.querySelectorAll('.chit-card[data-chit-id]'));
        var otherCards = allCards.filter(function (c) { return c !== s.card; });

        // Determine insert position based on finger Y
        var insertIdx = otherCards.length; // default: end
        for (var i = 0; i < otherCards.length; i++) {
          var r = otherCards[i].getBoundingClientRect();
          if (data.clientY < r.top + r.height / 2) {
            insertIdx = i;
            break;
          }
        }

        // Only reorder DOM if position changed
        if (insertIdx !== s.lastInsertIdx) {
          s.lastInsertIdx = insertIdx;

          // Move placeholder to the new position in the DOM
          if (insertIdx >= otherCards.length) {
            // After the last card
            container.appendChild(s.placeholder);
          } else {
            container.insertBefore(s.placeholder, otherCards[insertIdx]);
          }
        }

        // Auto-scroll when near edges of the container
        var containerRect = container.getBoundingClientRect();
        var edgeZone = 50;
        var scrollSpeed = 8;
        if (data.clientY < containerRect.top + edgeZone) {
          container.scrollTop -= scrollSpeed;
        } else if (data.clientY > containerRect.bottom - edgeZone) {
          container.scrollTop += scrollSpeed;
        }
      },
      onEnd: function (data) {
        if (!_touchDragState) return;
        var s = _touchDragState;

        // Restore body overscroll
        document.body.style.overscrollBehavior = '';

        // Remove floating styles and touch-drag class
        s.card.classList.remove('cwoc-touch-dragging');
        s.card.style.position = '';
        s.card.style.left = '';
        s.card.style.top = '';
        s.card.style.width = '';
        s.card.style.zIndex = '';
        s.card.style.opacity = '';
        s.card.style.boxShadow = '';
        s.card.style.transition = '';
        s.card.style.pointerEvents = '';

        // Insert the card where the placeholder is
        s.placeholder.parentNode.insertBefore(s.card, s.placeholder);
        s.placeholder.remove();

        // Read the new order from the DOM
        var cards = Array.from(container.querySelectorAll('.chit-card[data-chit-id]'));
        var ids = cards.map(function (c) { return c.dataset.chitId; });

        saveManualOrder(tab, ids);
        currentSortField = 'manual';
        var sel = document.getElementById('sort-select');
        if (sel) sel.value = 'manual';
        _updateSortUI();
        _touchDragState = null;
        if (onReorder) onReorder();
      },
    };

    // Use unified gesture if long-press callback is provided, otherwise drag-only
    if (lpCallback && typeof enableTouchGesture === 'function') {
      enableTouchGesture(card, {
        onDragStart: dragCallbacks.onStart,
        onDragMove: dragCallbacks.onMove,
        onDragEnd: dragCallbacks.onEnd,
        onLongPress: function () {
          // Clean up floating card state if drag was active before long-press took over
          if (_touchDragState) {
            var s = _touchDragState;
            document.body.style.overscrollBehavior = '';
            s.card.classList.remove('cwoc-touch-dragging');
            s.card.style.position = '';
            s.card.style.left = '';
            s.card.style.top = '';
            s.card.style.width = '';
            s.card.style.zIndex = '';
            s.card.style.opacity = '';
            s.card.style.boxShadow = '';
            s.card.style.transition = '';
            s.card.style.pointerEvents = '';
            // Put card back where placeholder is, then remove placeholder
            if (s.placeholder && s.placeholder.parentNode) {
              s.placeholder.parentNode.insertBefore(s.card, s.placeholder);
              s.placeholder.remove();
            }
            _touchDragState = null;
          }
          lpCallback();
        },
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
