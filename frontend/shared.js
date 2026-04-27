/**
 * shared.js — Shared code between dashboard (main.js) and editor (editor.js).
 * Loaded before both. Contains: inline checklist interactions, manual sort persistence,
 * drag-to-reorder, and any other reused utilities.
 */

// ── Settings Cache ───────────────────────────────────────────────────────────
// Promise-based cache so concurrent callers share a single in-flight request.
// Call _invalidateSettingsCache() after saving settings to force a fresh fetch.

let _cwocSettingsPromise = null;

function getCachedSettings() {
  if (!_cwocSettingsPromise) {
    _cwocSettingsPromise = fetch('/api/settings/default_user')
      .then(function (r) {
        if (!r.ok) throw new Error('Settings fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        window._cwocSettings = data;
        return data;
      })
      .catch(function (err) {
        console.error('getCachedSettings error:', err);
        _cwocSettingsPromise = null;   // allow retry on next call
        return {};                     // graceful fallback
      });
  }
  return _cwocSettingsPromise;
}

function _invalidateSettingsCache() {
  _cwocSettingsPromise = null;
  window._cwocSettings = undefined;
}

// ── Shared Utility Functions ─────────────────────────────────────────────────

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(date) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${date.getFullYear()}-${monthNames[date.getMonth()]}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function setSaveButtonUnsaved() {
  if (window._cwocSave) window._cwocSave.markUnsaved();
}

/**
 * Returns '#2b1e0f' (dark) or '#fff' (light) for readable text on the given background.
 * Uses WCAG-style relative luminance to pick the best contrast.
 */
function contrastColorForBg(hex) {
  if (!hex) return '#2b1e0f';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  if (hex.length !== 6) return '#2b1e0f';
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  var lum = (r * 299 + g * 587 + b * 114) / 1000;
  return lum > 150 ? '#2b1e0f' : '#fdf5e6';
}

/**
 * Apply background color and auto-contrast font color to an element based on a chit's color.
 * Call this instead of manually setting el.style.backgroundColor = chitColor(chit).
 */
function applyChitColors(el, bgColor) {
  el.style.backgroundColor = bgColor;
  el.style.color = contrastColorForBg(bgColor);
}

/**
 * Returns true if the given hex color is light (luminance > 140).
 * Used for deciding text color on colored backgrounds.
 */
function isLightColor(hex) {
  if (!hex) return true;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return true;
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

/**
 * Parse an ISO datetime string into a local Date object.
 * Returns null if the input is falsy.
 */
function _utcToLocalDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString);
}

/**
 * Parse an ISO datetime string and return a formatted time string (HH:MM).
 * Returns "" if the input is falsy or invalid.
 */
function _parseISOTime(isoString) {
  if (!isoString) return "";
  const date = _utcToLocalDate(isoString);
  if (isNaN(date.getTime())) return "";
  return formatTime(date);
}

/**
 * Generate a deterministic pastel RGB color from a string label.
 */
function getPastelColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const r = ((hash & 0xff) % 128) + 127;
  const g = (((hash >> 8) & 0xff) % 128) + 127;
  const b = (((hash >> 16) & 0xff) % 128) + 127;
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Shared Geocoding ─────────────────────────────────────────────────────────

/**
 * Geocode an address using Nominatim with progressive fallback.
 * Tries: full address → no zip → city/state/zip → city/state.
 * Returns {lat, lon} or throws Error("Location not found.") / Error("No address provided.").
 */
async function _geocodeAddress(address) {
  if (!address) throw new Error("No address provided.");
  var queries = [address];

  // Strip zip code (5-digit or 5+4 at end)
  var noZip = address.replace(/\s*\d{5}(-\d{4})?\s*$/, '').trim();
  if (noZip && noZip !== address) queries.push(noZip);

  // Normalize periods to commas for addresses like "123 Main St. City, ST 12345"
  var normalized = address.replace(/\.\s+/g, ', ');
  if (normalized !== address) queries.push(normalized);

  // Comma-split fallbacks
  var parts = normalized.split(',');
  if (parts.length >= 2) queries.push(parts.slice(1).join(',').trim());
  if (parts.length >= 3) queries.push(parts.slice(-2).join(',').trim());

  // Try to extract "City, ST ZIP" or "City, ST" via state abbreviation pattern
  var stateMatch = address.match(/([A-Za-z\s]+),?\s+([A-Z]{2})\s*(\d{5})?/);
  if (stateMatch) {
    var cityState = stateMatch[1].trim() + ', ' + stateMatch[2];
    if (stateMatch[3]) queries.push(cityState + ' ' + stateMatch[3]);
    queries.push(cityState);
  }

  // Deduplicate queries while preserving order
  var seen = {};
  var unique = [];
  for (var u = 0; u < queries.length; u++) {
    var key = queries[u].toLowerCase().trim();
    if (!key || seen[key]) continue;
    seen[key] = true;
    unique.push(queries[u]);
  }

  for (var i = 0; i < unique.length; i++) {
    var q = unique[i];
    try {
      // Use backend proxy to avoid CORS and rate-limit issues
      var url = '/api/geocode?q=' + encodeURIComponent(q);
      var resp = await fetch(url);
      if (!resp.ok) continue;
      var data = await resp.json();
      if (data && data.results && data.results.length > 0) {
        return { lat: data.results[0].lat, lon: data.results[0].lon };
      }
    } catch (e) {
      console.warn('Geocoding attempt', i + 1, 'failed:', e);
    }
  }
  throw new Error("Location not found.");
}

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
    li.style.cssText = `padding-left:${(item.level || 0) * 18 + 4}px;padding-top:4px;padding-bottom:4px;display:flex;align-items:center;gap:6px;cursor:grab;font-size:0.95em;line-height:1.4;min-height:1.8em;`;
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

    // Touch drag support for checklist item reorder
    enableTouchDrag(li, {
      onStart: function (data) {
        li._touchDragData = { chitId: chit.id, idx: idx };
        li.style.opacity = '0.4';
      },
      onMove: function (data) {
        // Clear previous highlights
        list.querySelectorAll('li[data-idx]').forEach(function (el) { el.style.borderTop = ''; });
        list.style.borderBottom = '';
        // Find the element under the touch point
        var target = document.elementFromPoint(data.clientX, data.clientY);
        if (!target) return;
        var targetLi = target.closest('li[data-idx]');
        if (targetLi && targetLi !== li) {
          targetLi.style.borderTop = '2px solid #8b5a2b';
        } else if (!targetLi && target.closest('ul[data-chit-id]')) {
          list.style.borderBottom = '2px solid #8b5a2b';
        }
      },
      onEnd: function (data) {
        li.style.opacity = '1';
        list.querySelectorAll('li[data-idx]').forEach(function (el) { el.style.borderTop = ''; });
        list.style.borderBottom = '';
        if (!li._touchDragData) return;
        var fromChitId = li._touchDragData.chitId;
        var fromIdx = li._touchDragData.idx;
        delete li._touchDragData;
        // Find drop target
        var target = document.elementFromPoint(data.clientX, data.clientY);
        if (!target) return;
        var targetLi = target.closest('li[data-idx]');
        if (targetLi && targetLi !== li) {
          var toChitId = targetLi.dataset.chitId || chit.id;
          var toIdx = parseInt(targetLi.dataset.idx);
          moveChecklistItemCrossChit(fromChitId, fromIdx, toChitId, toIdx).then(function () {
            if (onUpdate) onUpdate();
          });
        } else if (!targetLi) {
          // Dropped on the list itself — append to end
          var targetList = target.closest('ul[data-chit-id]');
          if (targetList) {
            var toChitId = targetList.dataset.chitId || chit.id;
            var toIdx = chit.checklist.length;
            moveChecklistItemCrossChit(fromChitId, fromIdx, toChitId, toIdx).then(function () {
              if (onUpdate) onUpdate();
            });
          }
        }
      },
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

  // Touch drag support for chit card reorder
  var _touchDraggedCard = null;
  container.querySelectorAll('.chit-card[data-chit-id]').forEach(function (card) {
    // Skip cards inside checklist areas
    if (card.closest('ul[data-chit-id]')) return;

    enableTouchDrag(card, {
      onStart: function (data) {
        // Don't hijack checklist-item touch drags
        if (data.target && data.target.closest && data.target.closest('li[data-idx]')) return;
        if (data.target && data.target.closest && data.target.closest('ul[data-chit-id]')) return;
        _touchDraggedCard = card;
        card.style.opacity = '0.4';
      },
      onMove: function (data) {
        if (!_touchDraggedCard) return;
        // Clear previous highlights
        container.querySelectorAll('.chit-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
        // Find the card under the touch point
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
        _touchDraggedCard.style.opacity = '1';
        container.querySelectorAll('.chit-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });

        // Find drop target
        var target = document.elementFromPoint(data.clientX, data.clientY);
        if (!target) { _touchDraggedCard = null; return; }
        var targetCard = target.closest('.chit-card');
        if (!targetCard || targetCard === _touchDraggedCard) { _touchDraggedCard = null; return; }

        // Compute new order
        var cards = Array.from(container.querySelectorAll('.chit-card[data-chit-id]'));
        var ids = cards.map(function (c) { return c.dataset.chitId; });
        var fromId = _touchDraggedCard.dataset.chitId;
        var toId = targetCard.dataset.chitId;
        var fromIdx = ids.indexOf(fromId);
        var toIdx = ids.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) { _touchDraggedCard = null; return; }

        // Determine if dropping above or below
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
    });
  });
}


// ── Alert Indicator Helpers ───────────────────────────────────────────────────

/** Valid alert _type values (excludes _notify_flags) */
var _ALERT_TYPES = ['alarm', 'timer', 'stopwatch', 'notification'];

/**
 * Returns true if a chit has any real alerts.
 * Checks the alerts array for entries with _type in {alarm, timer, stopwatch, notification},
 * excluding _notify_flags entries. Falls back to legacy boolean alarm/notification flags
 * when alerts is null, undefined, or not an array.
 * @param {object} chit
 * @returns {boolean}
 */
function _chitHasAlerts(chit) {
  if (!chit) return false;
  var alerts = chit.alerts;
  if (Array.isArray(alerts)) {
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i] && _ALERT_TYPES.indexOf(alerts[i]._type) !== -1) return true;
    }
  }
  // Legacy boolean flags fallback
  if (chit.alarm === true || chit.notification === true) return true;
  return false;
}

/** Icon map for individual alert types */
var _ALERT_ICON_MAP = {
  alarm:        '🔔 ',
  notification: '📢 ',
  timer:        '⏱️ ',
  stopwatch:    '⏲️ '
};

/** Status icon map for task views */
var _STATUS_ICONS = {
  'ToDo':        '<i class="fas fa-circle" style="color:#8b5a2b;font-size:0.85em;"></i>',
  'In Progress': '<i class="fas fa-spinner" style="color:#d68a59;font-size:0.85em;"></i>',
  'Blocked':     '<i class="fas fa-ban" style="color:#b22222;font-size:0.85em;"></i>',
  'Complete':    '<i class="fas fa-check-circle" style="color:#5a8a5b;font-size:0.85em;"></i>'
};

/**
 * Returns a string of alert indicator icon(s) for a chit,
 * based on visual_indicators settings and rendering context.
 *
 * @param {object} chit - The chit object
 * @param {object} settings - The visual_indicators settings object
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {string} Icon string (may be empty)
 */
function _getAlertIndicators(chit, settings, context) {
  if (!_chitHasAlerts(chit)) return '';

  // Normalise settings — treat null/undefined as empty object
  var s = settings || {};

  // Default missing keys
  var combineAlerts = (s.combine_alerts === true);
  var combinedMode  = s.combined_alert || 'always';

  // Determine whether to use combined (single icon) path
  var useCombined = combineAlerts || context === 'calendar-month' || context === 'calendar-slot';

  if (useCombined) {
    if (_shouldShow(combinedMode, context)) return '🛎️ ';
    return '';
  }

  // Individual mode — only applies in 'card' context
  if (context !== 'card') return '';

  // Collect which alert types are present on this chit
  var present = _chitAlertTypesPresent(chit);
  var result = '';
  for (var i = 0; i < _ALERT_TYPES.length; i++) {
    var aType = _ALERT_TYPES[i];
    if (!present[aType]) continue;
    // Read per-type display mode; default timer/stopwatch to "always"
    var mode = s[aType];
    if (mode === undefined || mode === null) {
      mode = 'always'; // default for any missing key
    }
    if (_shouldShow(mode, context)) {
      result += _ALERT_ICON_MAP[aType];
    }
  }
  return result;
}

/**
 * Returns a string of ALL visual indicator icons for a chit:
 * alert icons + weather + people + recurrence.
 * Respects visual_indicators settings.
 *
 * @param {object} chit - The chit object
 * @param {object} settings - The visual_indicators settings object
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {string} Icon string (may be empty)
 */
function _getAllIndicators(chit, settings, context) {
  var s = settings || {};
  var result = '';

  // Alert indicators
  result += _getAlertIndicators(chit, s, context);

  // Weather indicator — handled by _buildChitHeader with async fetch
  // (no longer a static icon here)

  // People indicator — show when chit has people assigned
  if (Array.isArray(chit.people) && chit.people.length > 0) {
    var peopleMode = s.people || 'always';
    if (_shouldShow(peopleMode, context)) result += '👥 ';
  }

  // Health indicator — show when chit has any health data
  if (chit.health_indicators && typeof chit.health_indicators === 'object' && Object.keys(chit.health_indicators).length > 0) {
    var healthMode = s.indicators || 'always';
    if (_shouldShow(healthMode, context)) result += '❤️ ';
  }

  // Recurrence indicator
  if (chit.recurrence_rule && chit.recurrence_rule.freq) {
    result += '🔁 ';
  }

  return result;
}

/**
 * Returns true if the given display mode permits showing in the given context.
 * Invalid/unknown mode values are treated as "always" (fail-open).
 * "space" resolves to show for 'card' and 'calendar-slot'; hide for 'calendar-month'.
 * @param {string} mode - "always" | "never" | "space"
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {boolean}
 */
function _shouldShow(mode, context) {
  if (mode === 'never') return false;
  if (mode === 'space') {
    // "If Space": hide only in month cells to save space
    return context !== 'calendar-month';
  }
  // "always" or any invalid/unknown value → fail-open → show
  return true;
}

/**
 * Returns an object mapping each alert type to true/false indicating
 * whether the chit has that type of alert present.
 * @param {object} chit
 * @returns {object}
 */
function _chitAlertTypesPresent(chit) {
  var present = {};
  var alerts = chit.alerts;
  if (Array.isArray(alerts)) {
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i] && _ALERT_TYPES.indexOf(alerts[i]._type) !== -1) {
        present[alerts[i]._type] = true;
      }
    }
  }
  // Legacy boolean flags
  if (chit.alarm === true) present.alarm = true;
  if (chit.notification === true) present.notification = true;
  return present;
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
      _showSnapGrid(el.parentElement);
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
          _showSnapGrid(el.parentElement);
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
      el.style.opacity = '0.6';
      el.style.zIndex = '50';
      _showSnapGrid(el.parentElement);
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
        el.style.opacity = '0.6';
        el.style.zIndex = '50';
        _showSnapGrid(el.parentElement);
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
  s.hasMoved = true;
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
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:300px;max-width:380px;font-family:"Courier New",monospace;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

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
          fontColor: isLeaf ? (tag.fontColor || null) : null,
          favorite: isLeaf ? !!tag.favorite : false,
          children: [],
        };
        nodeMap[pathSoFar] = node;
        currentLevel.push(node);
      }
      currentLevel = nodeMap[pathSoFar].children;
    });
  });

  // Color inheritance: children with no color inherit from parent
  function inheritColors(nodes, parentColor) {
    nodes.forEach(n => {
      if (!n.color && parentColor) n.color = parentColor;
      if (n.children.length > 0) inheritColors(n.children, n.color || parentColor);
    });
  }
  inheritColors(root, null);

  // Sort alphabetically at every level
  function sortLevel(nodes) {
    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    nodes.forEach(n => { if (n.children.length > 0) sortLevel(n.children); });
  }
  sortLevel(root);

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
      row.style.cssText = `display:flex;align-items:center;justify-content:flex-start;gap:4px;padding:1px 0;padding-left:${depth * 16}px;cursor:pointer;`;

      // Create child container first so toggle can reference it
      let childContainer = null;
      if (node.children.length > 0) {
        childContainer = document.createElement('div');
      }

      // Expand/collapse toggle for nodes with children
      if (childContainer) {
        const toggle = document.createElement('span');
        toggle.style.cssText = 'font-size:0.7em;width:14px;text-align:center;cursor:pointer;user-select:none;flex-shrink:0;';
        toggle.textContent = '▼';
        toggle.dataset.tagToggle = 'true';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = childContainer.style.display === 'none';
          childContainer.style.display = isHidden ? '' : 'none';
          toggle.textContent = isHidden ? '▼' : '▶';
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.style.cssText = 'width:14px;flex-shrink:0;';
        row.appendChild(spacer);
      }

      // Checkbox
      const isSelected = selectedTags.includes(node.fullPath);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isSelected;
      cb.style.cssText = 'margin:0;cursor:pointer;flex-shrink:0;';
      cb.addEventListener('click', (e) => { e.stopPropagation(); });
      cb.addEventListener('change', () => {
        if (onToggle) onToggle(node.fullPath, cb.checked);
      });
      row.appendChild(cb);

      // Favorite star (inline before name)
      if (node.favorite) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.85em;flex-shrink:0;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        row.appendChild(star);
      }

      // Tag name with color background — always shows tag color
      const tagColor = node.color || (typeof getPastelColor === 'function' ? getPastelColor(node.fullPath) : 'rgba(139,90,43,0.15)');
      const tagFontColor = node.fontColor || '#3c2f2f';
      const badge = document.createElement('span');
      badge.textContent = node.name;
      badge.style.cssText = `font-size:0.85em;padding:1px 6px;border-radius:4px;background:${tagColor};color:${tagFontColor};white-space:nowrap;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      row.appendChild(badge);

      // Click row to toggle selection
      row.addEventListener('click', () => {
        if (onToggle) onToggle(node.fullPath, !isSelected);
      });

      parentEl.appendChild(row);

      // Render children
      if (childContainer) {
        childContainer.dataset.tagChildren = 'true';
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

/**
 * Replace [[title]] patterns in text/HTML with links to matching chits.
 * Call AFTER marked.parse() so we operate on rendered HTML.
 * @param {string} html - rendered HTML string
 * @param {Array} allChits - array of chit objects with id and title
 * @returns {string} HTML with [[title]] replaced by <a> links
 */
function resolveChitLinks(html, allChits) {
  if (!html || !allChits) return html;
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    const lower = title.toLowerCase().trim();
    const found = allChits.find(c => c.title && c.title.toLowerCase().trim() === lower);
    if (found) {
      return `<a href="/frontend/editor.html?id=${found.id}" title="Open chit: ${found.title}" style="color:#4682b4;text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();">${found.title}</a>`;
    }
    return match; // leave as-is if no match
  });
}


// ── Recurrence Expansion ─────────────────────────────────────────────────────

/** Advance a date by the recurrence frequency and interval */

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

  // ── Mobile: limit to 3 visible rows with expand/shrink ─────────────────
  var totalRows = rowOccupancy.length;
  var MAX_VISIBLE = 3;
  if (window.innerWidth <= 768 && totalRows > MAX_VISIBLE) {
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

function _advanceRecurrence(current, freq, interval, byDayNums) {
  if (freq === 'MINUTELY') current.setMinutes(current.getMinutes() + interval);
  else if (freq === 'HOURLY') current.setHours(current.getHours() + interval);
  else if (freq === 'DAILY') current.setDate(current.getDate() + interval);
  else if (freq === 'WEEKLY') {
    if (byDayNums && byDayNums.length > 0) {
      current.setDate(current.getDate() + 1);
      if (current.getDay() === byDayNums[0] && interval > 1) {
        current.setDate(current.getDate() + (interval - 1) * 7);
      }
    } else {
      current.setDate(current.getDate() + interval * 7);
    }
  } else if (freq === 'MONTHLY') current.setMonth(current.getMonth() + interval);
  else if (freq === 'YEARLY') current.setFullYear(current.getFullYear() + interval);
  else return false; // unknown freq
  return true;
}

/**
 * Expand a recurring chit into virtual instances for a date range.
 */
function expandRecurrence(chit, rangeStart, rangeEnd) {
  const rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return [chit]; // not recurring, return as-is

  const exceptions = chit.recurrence_exceptions || [];
  const exceptionDates = new Set(exceptions.map(e => e.date));
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));

  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return [chit];

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const baseTimeMs = info.start.getTime() - baseDate.getTime(); // time-of-day offset
  const durationMs = info.isAllDay ? 0 : (info.end.getTime() - info.start.getTime());

  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || []; // ["MO","TU","WE","TH","FR","SA","SU"]
  const until = rule.until ? new Date(rule.until) : null;

  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const instances = [];
  const maxInstances = 365; // safety limit
  let current = new Date(baseDate);
  let count = 0;
  let occurrenceNum = 0; // counts all non-broken-off occurrences from series start

  while (count < maxInstances) {
    if (until && current > until) break;
    if (current > rangeEnd) break;

    const dateStr = current.toISOString().slice(0, 10);
    // For sub-daily frequencies, use datetime as the instance key
    const isSubDaily = freq === 'MINUTELY' || freq === 'HOURLY';
    const instanceKey = isSubDaily ? current.toISOString().slice(0, 16) : dateStr; // YYYY-MM-DDTHH:MM or YYYY-MM-DD
    const inRange = current >= rangeStart;

    // For weekly with byDay, check if current day matches
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches && !brokenOffDates.has(instanceKey)) {
      occurrenceNum++;
    }

    if (dayMatches && inRange && !brokenOffDates.has(instanceKey)) {
      // Check for exception modifications
      const exception = exceptions.find(e => e.date === instanceKey && !e.broken_off);

      const virtualStart = new Date(current.getTime() + baseTimeMs);
      const virtualEnd = info.isAllDay ? virtualStart : new Date(virtualStart.getTime() + durationMs);

      const instance = {
        ...chit,
        _isVirtual: true,
        _parentId: chit.id,
        _virtualDate: instanceKey,
        _isCompleted: completedDates.has(instanceKey),
        _instanceNum: occurrenceNum,
      };

      // Mark completed instances visually
      if (instance._isCompleted) {
        instance.status = 'Complete';
      }

      // Apply exception overrides
      if (exception) {
        if (exception.title) instance.title = exception.title;
        if (exception.note !== undefined) instance.note = exception.note;
        if (exception.location !== undefined) instance.location = exception.location;
        if (exception.start_datetime) {
          instance.start_datetime = exception.start_datetime;
        } else if (!info.isDueOnly) {
          instance.start_datetime = virtualStart.toISOString();
          instance.end_datetime = virtualEnd.toISOString();
        }
        if (exception.end_datetime) instance.end_datetime = exception.end_datetime;
        if (exception.due_datetime) instance.due_datetime = exception.due_datetime;
      } else {
        if (info.isDueOnly) {
          instance.due_datetime = virtualStart.toISOString();
        } else {
          instance.start_datetime = virtualStart.toISOString();
          instance.end_datetime = virtualEnd.toISOString();
        }
      }

      // Update the datetime objects for calendar rendering
      if (instance.start_datetime) instance.start_datetime_obj = new Date(instance.start_datetime);
      if (instance.end_datetime) instance.end_datetime_obj = new Date(instance.end_datetime);

      instances.push(instance);
    }

    // Advance to next occurrence
    count++;
    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  return instances.length > 0 ? instances : [chit];
}

/**
 * Format a recurrence rule as a human-readable string.
 * @param {object} rule - { freq, interval, byDay, until }
 * @returns {string}
 */
function formatRecurrenceRule(rule) {
  if (!rule || !rule.freq) return '';
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const dayNames = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

  let text = '';
  if (freq === 'MINUTELY') text = interval === 1 ? 'Every minute' : `Every ${interval} minutes`;
  else if (freq === 'HOURLY') text = interval === 1 ? 'Hourly' : `Every ${interval} hours`;
  else if (freq === 'DAILY') text = interval === 1 ? 'Daily' : `Every ${interval} days`;
  else if (freq === 'WEEKLY') {
    const days = (rule.byDay || []).map(d => dayNames[d] || d).join(', ');
    text = interval === 1 ? `Weekly` : `Every ${interval} weeks`;
    if (days) text += ` on ${days}`;
  }
  else if (freq === 'MONTHLY') text = interval === 1 ? 'Monthly' : `Every ${interval} months`;
  else if (freq === 'YEARLY') text = interval === 1 ? 'Yearly' : `Every ${interval} years`;
  else text = freq;

  if (rule.until) text += ` until ${new Date(rule.until).toLocaleDateString()}`;
  return text;
}


// ── Recurrence Series Info (Phase R3) ────────────────────────────────────────

/**
 * Count which occurrence number a virtual date is in a series,
 * and how many total past instances exist, how many are completed.
 * @param {object} chit - the parent chit with recurrence_rule
 * @param {string} virtualDate - YYYY-MM-DD of the instance
 * @returns {{ instanceNum: number, totalPast: number, completedPast: number, successRate: number }}
 */
function getRecurrenceSeriesInfo(chit, virtualDate) {
  const rule = chit.recurrence_rule;
  if (!rule || !rule.freq) return null;

  const exceptions = chit.recurrence_exceptions || [];
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));

  const info = getCalendarDateInfo(chit);
  if (!info.hasDate) return null;

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || [];
  const until = rule.until ? new Date(rule.until) : null;
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const targetDate = virtualDate ? new Date(virtualDate + 'T23:59:59') : today;

  let current = new Date(baseDate);
  let instanceNum = 0;
  let totalPast = 0;
  let completedPast = 0;
  const maxIter = 730;

  for (let i = 0; i < maxIter; i++) {
    if (until && current > until) break;
    if (current > today && current > targetDate) break;

    const dateStr = current.toISOString().slice(0, 10);
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches && !brokenOffDates.has(dateStr)) {
      if (current <= today) {
        totalPast++;
        if (completedDates.has(dateStr)) completedPast++;
      }
      if (current <= targetDate) instanceNum++;
    }

    // Advance
    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  const successRate = totalPast > 0 ? Math.round((completedPast / totalPast) * 100) : 0;
  return { instanceNum, totalPast, completedPast, successRate };
}


// ── Recurrence Instance Actions (Phase R2) ───────────────────────────────────

/**
 * Quick Edit Modal — shift+click on any calendar chit.
 * Shows editable dropdowns for task fields, plus recurrence options if recurring.
 */
function showQuickEditModal(chit, onRefresh) {
  document.querySelectorAll('.recurrence-modal-overlay').forEach(el => el.remove());

  const isRecurring = !!(chit._isVirtual && chit._parentId);
  const parentId = chit._parentId || chit.id;
  const chitId = chit._isVirtual ? chit._parentId : chit.id;
  const dateStr = chit._virtualDate;

  const overlay = document.createElement('div');
  overlay.className = 'recurrence-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:320px;max-width:420px;font-family:"Courier New",monospace;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px 0;color:#4a2c2a;font-size:1.1em;cursor:text;';
  title.textContent = chit.title || '(Untitled)';
  title.title = 'Double-click to edit title';
  title.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    title.contentEditable = 'true';
    title.style.outline = '2px solid #8b4513';
    title.style.borderRadius = '3px';
    title.style.padding = '2px 4px';
    title.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(title);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const saveTitle = () => {
      title.contentEditable = 'false';
      title.style.outline = '';
      title.style.padding = '';
      const newTitle = title.textContent.trim();
      if (newTitle && newTitle !== chit.title) {
        fetch(`/api/chit/${chitId}`).then(r => r.ok ? r.json() : null).then(fullChit => {
          if (!fullChit) return;
          fullChit.title = newTitle;
          return fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
        }).then(() => {
          chit.title = newTitle;
          if (typeof fetchChits === 'function') fetchChits();
        }).catch(() => {});
      }
    };
    title.addEventListener('blur', saveTitle, { once: true });
    title.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); title.blur(); }
      if (ke.key === 'Escape') { ke.preventDefault(); title.textContent = chit.title || '(Untitled)'; title.blur(); }
    });
  });
  modal.appendChild(title);

  if (isRecurring) {
    const dateLine = document.createElement('div');
    dateLine.style.cssText = 'margin-bottom:4px;color:#6b4e31;font-size:0.9em;';
    dateLine.textContent = `🔁 ${formatRecurrenceRule(chit.recurrence_rule)} — ${dateStr}`;
    if (chit._instanceNum) dateLine.textContent += ` (#${chit._instanceNum})`;
    modal.appendChild(dateLine);

    // Series stats
    const seriesInfo = getRecurrenceSeriesInfo(chit, dateStr);
    if (seriesInfo && seriesInfo.totalPast > 0) {
      const statsLine = document.createElement('div');
      statsLine.style.cssText = 'margin-bottom:12px;color:#6b4e31;font-size:0.8em;opacity:0.8;';
      statsLine.textContent = `✅ ${seriesInfo.completedPast}/${seriesInfo.totalPast} completed (${seriesInfo.successRate}% success rate)`;
      modal.appendChild(statsLine);
    }
  }

  // --- People chips (read-only, with color + thumbnail like chit editor) ---
  if (Array.isArray(chit.people) && chit.people.length > 0) {
    const peopleRow = document.createElement('div');
    peopleRow.className = 'cwoc-people-chips-row';

    // Try to match people names to contacts for color/image
    var _qeContactMap = {};
    if (window._cachedPeopleContacts) {
      window._cachedPeopleContacts.forEach(function (c) {
        _qeContactMap[(c.display_name || '').toLowerCase()] = c;
      });
    }

    chit.people.forEach(name => {
      var match = _qeContactMap[name.toLowerCase()] || null;
      const chip = document.createElement('span');
      chip.className = 'cwoc-people-chip';

      var bgColor = (match && match.color) ? match.color : '#e8dcc8';
      chip.style.backgroundColor = bgColor;
      chip.style.borderColor = bgColor;
      // Contrast text
      var hex = bgColor.replace('#', '');
      if (hex.length === 6) {
        var lum = (parseInt(hex.substr(0,2),16)*299 + parseInt(hex.substr(2,2),16)*587 + parseInt(hex.substr(4,2),16)*114) / 1000;
        chip.style.color = lum > 140 ? '#2b1e0f' : '#fff';
      }

      // Thumbnail
      if (match && match.image_url) {
        var img = document.createElement('img');
        img.src = match.image_url;
        img.style.cssText = 'width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:3px;';
        chip.appendChild(img);
      }

      // Display name without prefix
      var chipName = name;
      if (match && match.prefix && chipName.startsWith(match.prefix)) {
        chipName = chipName.substring(match.prefix.length).trim();
      }
      chip.appendChild(document.createTextNode(chipName));

      // Double-click to open contact editor
      if (match && match.id) {
        chip.style.cursor = 'pointer';
        chip.title = 'Double-click to edit contact';
        chip.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          window.location.href = '/frontend/contact-editor.html?id=' + encodeURIComponent(match.id);
        });
      }

      peopleRow.appendChild(chip);
    });

    modal.appendChild(peopleRow);

    // After render, check for overflow and add "+N more" if needed
    requestAnimationFrame(() => {
      const rowHeight = peopleRow.offsetHeight;
      const chips = Array.from(peopleRow.querySelectorAll('.cwoc-people-chip'));
      if (chips.length === 0) return;
      const firstTop = chips[0].offsetTop;
      // Find chips that overflow past the first row
      let visibleCount = 0;
      for (const c of chips) {
        if (c.offsetTop <= firstTop + chips[0].offsetHeight + 4) {
          visibleCount++;
        } else {
          break;
        }
      }
      const hiddenCount = chips.length - visibleCount;
      if (hiddenCount > 0) {
        // Hide overflowing chips
        for (let i = visibleCount; i < chips.length; i++) {
          chips[i].style.display = 'none';
        }
        // Add "+N more" indicator
        const more = document.createElement('span');
        more.className = 'cwoc-people-chip cwoc-people-more';
        more.textContent = `+${hiddenCount} more`;
        more.title = chit.people.join(', ');
        peopleRow.appendChild(more);
      }
    });
  }

  const btnStyle = 'display:block;width:100%;padding:10px 12px;margin-bottom:8px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:inherit;font-size:0.95em;cursor:pointer;text-align:left;';
  const selStyle = 'padding:4px 6px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;color:#4a2c2a;font-family:inherit;font-size:0.9em;flex:1;';
  const rowStyle = 'display:flex;align-items:center;gap:8px;padding:6px 12px;margin-bottom:6px;border:1px solid #d4c5a9;border-radius:4px;background:#fdf5e6;font-size:0.9em;';

  function addBtn(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = btnStyle;
    btn.innerHTML = `${icon} ${label}`;
    btn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    btn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    btn.addEventListener('click', () => { close(); onClick(); });
    modal.appendChild(btn);
  }

  function addSep() {
    const hr = document.createElement('hr');
    hr.style.cssText = 'border:none;border-top:1px solid #d4c5a9;margin:12px 0;';
    modal.appendChild(hr);
  }

  function close() { overlay.remove(); }

  // --- Editable Task Fields (only show fields that already have values) ---
  let pendingChanges = {};
  let hasTaskFields = false;

  // Track per-field "all instances" state
  const allInstancesFlags = {};

  function addDropdown(icon, label, fieldKey, currentVal, options, onChange) {
    hasTaskFields = true;
    const row = document.createElement('div');
    row.style.cssText = rowStyle;
    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:#6b4e31;white-space:nowrap;';
    lbl.textContent = `${icon} ${label}:`;
    const sel = document.createElement('select');
    sel.style.cssText = selStyle;
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt || '—';
      if (opt === currentVal) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(lbl);
    row.appendChild(sel);

    // Inline "All" checkbox for recurring chits
    if (isRecurring) {
      const allCb = document.createElement('input');
      allCb.type = 'checkbox';
      allCb.title = 'Apply to all instances';
      allCb.style.cssText = 'margin:0;cursor:pointer;flex-shrink:0;';
      allCb.addEventListener('change', () => { allInstancesFlags[fieldKey] = allCb.checked; });
      const allLbl = document.createElement('span');
      allLbl.textContent = 'All';
      allLbl.style.cssText = 'font-size:0.8em;color:#6b4e31;white-space:nowrap;cursor:pointer;';
      allLbl.title = 'Apply to all instances';
      allLbl.addEventListener('click', () => { allCb.checked = !allCb.checked; allInstancesFlags[fieldKey] = allCb.checked; });
      row.appendChild(allCb);
      row.appendChild(allLbl);
    }

    modal.appendChild(row);
  }

  if (chit.priority) addDropdown('🔺', 'Priority', 'priority', chit.priority, ['', 'High', 'Medium', 'Low'], (v) => { pendingChanges.priority = v || null; });
  if (chit.severity) addDropdown('⚠️', 'Severity', 'severity', chit.severity, ['', 'Critical', 'Major', 'Normal', 'Minor'], (v) => { pendingChanges.severity = v || null; });
  if (chit.status) addDropdown('📋', 'Status', 'status', chit.status, ['', 'ToDo', 'In Progress', 'Blocked', 'Complete'], (v) => { pendingChanges.status = v || null; });

  if (hasTaskFields) {
    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'text-align:right;margin-bottom:4px;';
    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'padding:6px 16px;border:1px solid #6b4e31;border-radius:4px;background:#d4c5a9;color:#4a2c2a;font-family:inherit;font-size:0.85em;cursor:pointer;';
    saveBtn.textContent = 'Save Changes';
    saveBtn.onmouseover = function() { this.style.background = '#c4b599'; };
    saveBtn.onmouseout = function() { this.style.background = '#d4c5a9'; };
    saveBtn.addEventListener('click', async () => {
      if (Object.keys(pendingChanges).length === 0) { close(); return; }
      try {
        if (isRecurring) {
          // Split changes: fields with "All" checked go to parent, others go to exception
          const parentChanges = {};
          const instanceChanges = {};
          for (const [key, val] of Object.entries(pendingChanges)) {
            if (allInstancesFlags[key]) {
              parentChanges[key] = val;
            } else {
              instanceChanges[key] = val;
            }
          }
          // Save instance-only changes as exception
          if (Object.keys(instanceChanges).length > 0) {
            const exception = { date: dateStr, ...instanceChanges };
            if (instanceChanges.status === 'Complete') exception.completed = true;
            await fetch(`/api/chits/${chitId}/recurrence-exceptions`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ exception })
            });
          }
          // Save all-instances changes to parent
          if (Object.keys(parentChanges).length > 0) {
            const resp = await fetch(`/api/chit/${chitId}`);
            if (!resp.ok) throw new Error('Chit not found');
            const fullChit = await resp.json();
            Object.assign(fullChit, parentChanges);
            if (parentChanges.status === 'Complete' && !fullChit.completed_datetime) {
              fullChit.completed_datetime = new Date().toISOString();
            }
            await fetch(`/api/chits/${chitId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fullChit)
            });
          }
        } else {
          // Non-recurring: save directly to chit
          const resp = await fetch(`/api/chit/${chitId}`);
          if (!resp.ok) throw new Error('Chit not found');
          const fullChit = await resp.json();
          Object.assign(fullChit, pendingChanges);
          if (pendingChanges.status === 'Complete' && !fullChit.completed_datetime) {
            fullChit.completed_datetime = new Date().toISOString();
          }
          await fetch(`/api/chits/${chitId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullChit)
          });
        }
        close();
        if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
      } catch (e) {
        console.error('Quick edit save failed:', e);
        alert('Failed to save changes.');
      }
    });
    saveRow.appendChild(saveBtn);
    modal.appendChild(saveRow);
  }

  // --- Recurrence actions (only for recurring chits) ---
  if (isRecurring) {
    addSep();
    const recRow = document.createElement('div');
    recRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    const recBtnStyle = 'flex:1;padding:8px;border:1px solid #6b4e31;border-radius:4px;background:#fdf5e6;font-size:1.2em;cursor:pointer;text-align:center;';

    const editSeriesBtn = document.createElement('button');
    editSeriesBtn.style.cssText = recBtnStyle;
    editSeriesBtn.textContent = '✏️🔁';
    editSeriesBtn.title = 'Edit entire series';
    editSeriesBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    editSeriesBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    editSeriesBtn.addEventListener('click', () => {
      close();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${parentId}`;
    });
    recRow.appendChild(editSeriesBtn);

    const editInstanceBtn = document.createElement('button');
    editInstanceBtn.style.cssText = recBtnStyle;
    editInstanceBtn.textContent = '✏️1️⃣';
    editInstanceBtn.title = 'Edit only this one instance (keeps series)';
    editInstanceBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    editInstanceBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    editInstanceBtn.addEventListener('click', () => {
      close();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${parentId}&instance=${dateStr}`;
    });
    recRow.appendChild(editInstanceBtn);

    const breakOffBtn = document.createElement('button');
    breakOffBtn.style.cssText = recBtnStyle;
    breakOffBtn.textContent = '✏️✂️';
    breakOffBtn.title = 'Break off from series & edit as standalone';
    breakOffBtn.onmouseover = function() { this.style.background = '#f0e6d3'; };
    breakOffBtn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    breakOffBtn.addEventListener('click', async () => {
      close();
      await _recurrenceBreakOff(parentId, chit, dateStr);
      if (onRefresh) onRefresh();
    });
    recRow.appendChild(breakOffBtn);

    modal.appendChild(recRow);
  }

  // --- Pin / Archive / Delete row ---
  addSep();
  const actionRow = document.createElement('div');
  actionRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';

  const iconBtnStyle = 'flex:1;padding:8px;border:1px solid #6b4e31;border-radius:4px;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:center;';

  // Pin toggle
  const pinBtn = document.createElement('button');
  pinBtn.style.cssText = iconBtnStyle + `background:${chit.pinned ? '#d4c5a9' : '#fdf5e6'};`;
  pinBtn.innerHTML = `<i class="fas fa-bookmark"></i> ${chit.pinned ? 'Unpin' : 'Pin'}`;
  pinBtn.title = chit.pinned ? 'Unpin this chit' : 'Pin this chit';
  pinBtn.addEventListener('click', async () => {
    try {
      const resp = await fetch(`/api/chit/${chitId}`);
      if (!resp.ok) return;
      const fullChit = await resp.json();
      fullChit.pinned = !fullChit.pinned;
      await fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
      close();
      if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
    } catch (e) { console.error('Pin toggle failed:', e); }
  });
  actionRow.appendChild(pinBtn);

  // Archive toggle
  const archBtn = document.createElement('button');
  archBtn.style.cssText = iconBtnStyle + `background:${chit.archived ? '#d4c5a9' : '#fdf5e6'};color:#666;`;
  archBtn.innerHTML = `📦 ${chit.archived ? 'Unarchive' : 'Archive'}`;
  archBtn.title = chit.archived ? 'Unarchive this chit' : 'Archive this chit';
  archBtn.addEventListener('click', async () => {
    try {
      const resp = await fetch(`/api/chit/${chitId}`);
      if (!resp.ok) return;
      const fullChit = await resp.json();
      fullChit.archived = !fullChit.archived;
      await fetch(`/api/chits/${chitId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
      close();
      if (typeof fetchChits === 'function') fetchChits(); else if (onRefresh) onRefresh();
    } catch (e) { console.error('Archive toggle failed:', e); }
  });
  actionRow.appendChild(archBtn);

  // Delete — always present, shows sub-options for recurring
  const delBtn = document.createElement('button');
  delBtn.style.cssText = iconBtnStyle + 'background:#fdf5e6;color:#a33;';
  delBtn.innerHTML = '🗑️ Delete';
  delBtn.title = 'Delete this chit';
  delBtn.addEventListener('click', () => {
    if (isRecurring) {
      // Show delete sub-menu inline
      _showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, close, onRefresh);
    } else {
      if (!confirm('Delete this chit?')) return;
      fetch(`/api/chits/${chitId}`, { method: 'DELETE' }).then(() => {
        close();
        if (typeof fetchChits === 'function') fetchChits();
        else if (onRefresh) onRefresh();
      });
    }
  });
  actionRow.appendChild(delBtn);

  // QR code button
  const qrBtn = document.createElement('button');
  qrBtn.style.cssText = iconBtnStyle + 'background:#fdf5e6;';
  qrBtn.innerHTML = '📱 QR';
  qrBtn.title = '📦 Data QR (Shift+click for 🔗 Link QR)';
  qrBtn.addEventListener('click', (ev) => {
    const url = `${window.location.origin}/frontend/editor.html?id=${chitId}`;
    const isLink = ev.shiftKey;

    if (isLink) {
      showQRModal({ title: '🔗 Link QR Code', data: url, info: url });
    } else {
      const chitData = { _cwoc: window._instanceId || 'unknown', id: chitId, title: chit.title || '', status: chit.status || '', priority: chit.priority || '', tags: (chit.tags || []).join(';'), note: (chit.note || '').slice(0, 300) };
      const json = JSON.stringify(chitData);
      showQRModal({ title: '📦 Data QR Code', data: json, ecl: json.length > 500 ? 'L' : 'M', info: json.length + ' chars encoded' });
      if (!window._instanceId) {
        fetch('/api/instance-id').then(r => r.ok ? r.json() : {}).then(d => { window._instanceId = d.instance_id || 'unknown'; }).catch(() => {});
      }
    }
  });
  actionRow.appendChild(qrBtn);

  modal.appendChild(actionRow);

  // Open in editor (only for non-recurring — recurring has edit buttons in the recurrence row)
  if (!isRecurring) {
    addBtn('Open in editor', '📝', () => {
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = `/editor?id=${chitId}`;
    });
  }

  // Cancel
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = btnStyle + 'margin-top:8px;text-align:center;background:#e8dcc8;font-weight:bold;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onmouseover = function() { this.style.background = '#d4c5a9'; };
  cancelBtn.onmouseout = function() { this.style.background = '#e8dcc8'; };
  cancelBtn.addEventListener('click', close);
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } }
  document.addEventListener('keydown', onKey);
}

/**
 * Show a delete sub-menu replacing the delete button with options:
 * This instance / This and following / All / Cancel
 */
function _showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, closeModal, onRefresh) {
  // Hide all modal content except the delete options
  const modal = actionRow.closest('.recurrence-modal-overlay > div') || actionRow.parentElement;
  const allChildren = Array.from(modal.children);
  const hiddenEls = [];
  allChildren.forEach(el => {
    if (el !== actionRow && el.style.display !== 'none') {
      hiddenEls.push({ el, prev: el.style.display });
      el.style.display = 'none';
    }
  });
  actionRow.style.display = 'none';

  const subMenu = document.createElement('div');
  subMenu.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';

  const headerEl = document.createElement('h3');
  headerEl.style.cssText = 'margin:0 0 12px 0;color:#a33;font-size:1.05em;';
  headerEl.textContent = '🗑️ Delete — ' + (chit.title || '(Untitled)');
  subMenu.appendChild(headerEl);

  const subBtnStyle = 'padding:8px 10px;border:1px solid #a33;border-radius:4px;background:#fdf5e6;color:#a33;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:left;';

  function addSubBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = subBtnStyle;
    btn.textContent = label;
    btn.onmouseover = function() { this.style.background = '#fce4e4'; };
    btn.onmouseout = function() { this.style.background = '#fdf5e6'; };
    btn.addEventListener('click', async () => {
      await onClick();
      closeModal();
      if (typeof fetchChits === 'function') fetchChits();
      else if (onRefresh) onRefresh();
    });
    subMenu.appendChild(btn);
  }

  addSubBtn('🗑️ Delete this instance', async () => {
    await _recurrenceAddException(parentId, { date: dateStr, broken_off: true });
  });

  addSubBtn('🗑️ Delete this and following', async () => {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) return;
    const fullChit = await resp.json();
    const rule = fullChit.recurrence_rule || {};
    const endDate = new Date(dateStr);
    endDate.setDate(endDate.getDate() - 1);
    rule.until = endDate.toISOString().slice(0, 10);
    fullChit.recurrence_rule = rule;
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullChit)
    });
  });

  addSubBtn('🗑️ Delete all (entire series)', async () => {
    if (!confirm('Delete the entire recurring series?')) return;
    await fetch(`/api/chits/${parentId}`, { method: 'DELETE' });
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'padding:8px 10px;border:1px solid #6b4e31;border-radius:4px;background:#e8dcc8;color:#4a2c2a;font-family:inherit;font-size:0.9em;cursor:pointer;text-align:center;margin-top:8px;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    subMenu.remove();
    actionRow.style.display = 'flex';
    hiddenEls.forEach(({ el, prev }) => { el.style.display = prev; });
  });
  subMenu.appendChild(cancelBtn);

  modal.appendChild(subMenu);
}

// Backward compat alias
function showRecurrenceActionModal(chit, onRefresh) { showQuickEditModal(chit, onRefresh); }

/** Add or replace an exception on a recurring chit via PATCH */
async function _recurrenceAddException(parentId, exception) {
  try {
    const resp = await fetch(`/api/chits/${parentId}/recurrence-exceptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exception })
    });
    if (!resp.ok) throw new Error(await resp.text());
    // Check if series should be auto-archived
    await _checkRecurrenceAutoArchive(parentId);
  } catch (e) {
    console.error('Failed to add recurrence exception:', e);
    alert('Failed to update recurrence instance.');
  }
}

/**
 * Auto-archive a recurring chit if it has an end date and all instances
 * up to that date are either completed or broken off.
 */
async function _checkRecurrenceAutoArchive(parentId) {
  try {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) return;
    const chit = await resp.json();
    const rule = chit.recurrence_rule;
    if (!rule || !rule.freq || !rule.until) return; // no end date = infinite series, skip
    if (chit.archived) return; // already archived

    const until = new Date(rule.until);
    const today = new Date();
    if (until > today) return; // series hasn't ended yet

    // Count all instances from start to until
    const info = getCalendarDateInfo(chit);
    if (!info.hasDate) return;

    const exceptions = chit.recurrence_exceptions || [];
    const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));
    const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));

    const baseDate = new Date(info.start);
    baseDate.setHours(0, 0, 0, 0);
    const freq = rule.freq;
    const interval = rule.interval || 1;
    const byDay = rule.byDay || [];
    const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

    let current = new Date(baseDate);
    let allHandled = true;

    for (let i = 0; i < 730; i++) {
      if (current > until) break;
      const dateStr = current.toISOString().slice(0, 10);
      let dayMatches = true;
      if (freq === 'WEEKLY' && byDayNums.length > 0) {
        dayMatches = byDayNums.includes(current.getDay());
      }
      if (dayMatches && !brokenOffDates.has(dateStr) && !completedDates.has(dateStr)) {
        allHandled = false;
        break;
      }
      // Advance
      if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
    }

    if (allHandled) {
      chit.archived = true;
      chit.status = 'Complete';
      chit.completed_datetime = new Date().toISOString();
      await fetch(`/api/chits/${parentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chit)
      });
      console.log(`Auto-archived recurring chit ${parentId} — all instances complete`);
    }
  } catch (e) {
    console.error('Auto-archive check failed:', e);
  }
}

/**
 * Render a series summary showing all instances with their completion status.
 * Shows past instances (up to today + 30 days future), max 50.
 */
function _renderSeriesSummary(container, virtualChit, parentId) {
  container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">Loading...</div>';

  const rule = virtualChit.recurrence_rule;
  if (!rule || !rule.freq) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">No recurrence rule</div>';
    return;
  }

  const exceptions = virtualChit.recurrence_exceptions || [];
  const completedDates = new Set(exceptions.filter(e => e.completed).map(e => e.date));
  const brokenOffDates = new Set(exceptions.filter(e => e.broken_off).map(e => e.date));

  const info = getCalendarDateInfo(virtualChit);
  if (!info.hasDate) { container.innerHTML = ''; return; }

  const baseDate = new Date(info.start);
  baseDate.setHours(0, 0, 0, 0);
  const freq = rule.freq;
  const interval = rule.interval || 1;
  const byDay = rule.byDay || [];
  const until = rule.until ? new Date(rule.until) : null;
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const byDayNums = byDay.map(d => dayMap[d]).filter(n => n !== undefined);

  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = new Date(baseDate);
  const rows = [];
  const maxRows = 50;

  for (let i = 0; i < 730 && rows.length < maxRows; i++) {
    if (until && current > until) break;
    if (current > futureLimit) break;

    const dateStr = current.toISOString().slice(0, 10);
    let dayMatches = true;
    if (freq === 'WEEKLY' && byDayNums.length > 0) {
      dayMatches = byDayNums.includes(current.getDay());
    }

    if (dayMatches) {
      let status = '⬜';
      let label = 'Upcoming';
      let opacity = '0.5';
      if (brokenOffDates.has(dateStr)) {
        status = '✂️'; label = 'Broken off'; opacity = '0.4';
      } else if (completedDates.has(dateStr)) {
        status = '✅'; label = 'Completed'; opacity = '1';
      } else if (current < today) {
        status = '❌'; label = 'Missed'; opacity = '0.7';
      } else {
        status = '⬜'; label = 'Upcoming'; opacity = '0.5';
      }
      rows.push({ dateStr, status, label, opacity, isFuture: current >= today });
    }

    if (!_advanceRecurrence(current, freq, interval, byDayNums)) break;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.style.cssText = 'max-height:200px;overflow-y:auto;font-size:0.8em;';

  rows.forEach(row => {
    const r = document.createElement('div');
    r.style.cssText = `display:flex;align-items:center;gap:6px;padding:2px 4px;opacity:${row.opacity};${row.isFuture ? '' : ''}`;
    const d = new Date(row.dateStr + 'T12:00:00');
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    r.innerHTML = `<span>${row.status}</span><span style="min-width:80px;">${row.dateStr}</span><span style="min-width:30px;opacity:0.6;">${dayName}</span><span style="color:#6b4e31;">${row.label}</span>`;
    list.appendChild(r);
  });

  if (rows.length === 0) {
    list.innerHTML = '<div style="opacity:0.5;padding:4px;">No instances found</div>';
  }

  container.appendChild(list);
}

/** Remove an exception for a specific date (e.g. un-complete) */
async function _recurrenceRemoveException(parentId, dateStr) {
  try {
    // Fetch current chit, remove the exception, save back
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) throw new Error('Chit not found');
    const chit = await resp.json();
    const exceptions = (chit.recurrence_exceptions || []).filter(e => e.date !== dateStr);
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...chit, recurrence_exceptions: exceptions })
    });
  } catch (e) {
    console.error('Failed to remove recurrence exception:', e);
    alert('Failed to update recurrence instance.');
  }
}

/** Mark the entire series as Complete */
async function _recurrenceCompleteSeries(parentId) {
  try {
    const resp = await fetch(`/api/chit/${parentId}`);
    if (!resp.ok) throw new Error('Chit not found');
    const chit = await resp.json();
    chit.status = 'Complete';
    chit.completed_datetime = new Date().toISOString();
    await fetch(`/api/chits/${parentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chit)
    });
  } catch (e) {
    console.error('Failed to complete series:', e);
    alert('Failed to complete series.');
  }
}

/** Break off a single instance into a standalone chit */
async function _recurrenceBreakOff(parentId, virtualChit, dateStr) {
  try {
    // 1. Fetch the full parent chit from the API
    const parentResp = await fetch(`/api/chit/${parentId}`);
    if (!parentResp.ok) throw new Error('Failed to fetch parent chit');
    const parentChit = await parentResp.json();

    // 2. Create a new standalone chit as a full copy
    const newChit = { ...parentChit };
    newChit.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    newChit.recurrence_rule = null;
    newChit.recurrence_exceptions = null;
    newChit.recurrence = null;
    newChit.recurrence_id = null;
    newChit.created_datetime = new Date().toISOString();
    newChit.modified_datetime = new Date().toISOString();

    // Use the virtual instance's specific dates
    if (virtualChit.start_datetime) newChit.start_datetime = virtualChit.start_datetime;
    if (virtualChit.end_datetime) newChit.end_datetime = virtualChit.end_datetime;
    if (virtualChit.due_datetime) newChit.due_datetime = virtualChit.due_datetime;

    console.log('Breaking off chit:', newChit.id, 'from parent:', parentId, 'date:', dateStr);

    const createResp = await fetch('/api/chits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChit)
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      throw new Error('Failed to create broken-off chit: ' + errText);
    }

    // 3. Add exception to parent so this date is skipped
    await _recurrenceAddException(parentId, { date: dateStr, broken_off: true });

    // 4. Open the new chit in the editor
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = `/editor?id=${newChit.id}`;
  } catch (e) {
    console.error('Failed to break off instance:', e);
    alert('Failed to break off instance: ' + e.message);
  }
}


// ── Column-Persistent Layout for Notes View ─────────────────────────────────
//
// Each card stores its column as data-col (integer). Layout reads data-col to
// group cards, then stacks each group top-to-bottom. Dragging within the same
// column only re-stacks that column. Dragging to a different column changes
// data-col and re-stacks only the source and target columns.
//
// Saved order: array of {id, col} pairs in localStorage.

const NOTES_CARD_WIDTH = 336;
const NOTES_GAP = 10;

/** Calculate how many columns fit and the actual card width.
 *  Responsive: ≤480px → 1 column, 481–768px → 2 columns, >768px → current masonry. */
function _notesColMetrics(container) {
  // clientWidth includes padding; subtract it to get usable content area
  const style = getComputedStyle(container);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const contentWidth = container.clientWidth - padL - padR;

  // Responsive column count based on viewport width
  const vw = window.innerWidth;
  let colCount;
  if (vw <= 480) {
    colCount = 1;
  } else if (vw <= 768) {
    colCount = 2;
  } else {
    // Desktop: fit as many columns as the container allows
    colCount = Math.max(1, Math.floor(contentWidth / (NOTES_CARD_WIDTH + NOTES_GAP)));
  }

  const actualCardWidth = Math.floor((contentWidth - (colCount - 1) * NOTES_GAP) / colCount);
  return { colCount, actualCardWidth, contentWidth };
}

/** Get the left px offset for a given column index */
function _notesColLeft(colIdx, actualCardWidth) {
  return NOTES_GAP + colIdx * (actualCardWidth + NOTES_GAP);
}

/**
 * Assign initial data-col to cards that don't have one yet.
 * New cards go to the column with the fewest cards.
 */
function _assignMissingCols(cards, colCount) {
  // Count existing assignments
  const colCounts = new Array(colCount).fill(0);
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && col >= 0 && col < colCount) {
      colCounts[col]++;
    }
  });
  cards.forEach(card => {
    let col = parseInt(card.dataset.col, 10);
    if (isNaN(col) || col < 0 || col >= colCount) {
      // Assign to shortest column
      col = colCounts.indexOf(Math.min(...colCounts));
      card.dataset.col = col;
      colCounts[col]++;
    }
  });
}

/**
 * Build column groups from cards' data-col attributes.
 * Returns array of arrays: columns[colIdx] = [card, card, ...]
 */
function _buildNoteColumns(cards, colCount) {
  const columns = Array.from({ length: colCount }, () => []);
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && col >= 0 && col < colCount) {
      columns[col].push(card);
    }
  });
  return columns;
}

/**
 * Position cards in a single column top-to-bottom.
 * Optionally skip a card (the one being dragged).
 */
function _stackColumn(colCards, colIdx, actualCardWidth, skipCard) {
  const left = _notesColLeft(colIdx, actualCardWidth);
  let top = NOTES_GAP;
  colCards.forEach(card => {
    if (card === skipCard) return;
    card.style.position = 'absolute';
    card.style.width = actualCardWidth + 'px';
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    top += card.offsetHeight + NOTES_GAP;
  });
  return top; // total height of this column
}

/**
 * Apply column-persistent layout to a notes-view container.
 * Reads data-col from each card. Cards without data-col get assigned
 * to the shortest column. Only repositions — never changes DOM order.
 */
function applyNotesLayout(container) {
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('.chit-card'));
  if (cards.length === 0) return;

  const { colCount, actualCardWidth } = _notesColMetrics(container);

  // Clamp out-of-range columns (e.g. window resized narrower)
  // but leave unassigned cards (NaN) for _assignMissingCols to distribute
  cards.forEach(card => {
    const col = parseInt(card.dataset.col, 10);
    if (!isNaN(col) && (col < 0 || col >= colCount)) {
      // Out of range — reassign to last valid column
      card.dataset.col = String(colCount - 1);
    }
  });
  _assignMissingCols(cards, colCount);

  const columns = _buildNoteColumns(cards, colCount);

  let maxHeight = 0;
  columns.forEach((colCards, colIdx) => {
    const h = _stackColumn(colCards, colIdx, actualCardWidth);
    if (h > maxHeight) maxHeight = h;
  });

  // Use a spacer div to create real scrollable content height
  // (absolute-positioned cards don't contribute to scroll height)
  let spacer = container.querySelector('.notes-height-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'notes-height-spacer';
    spacer.style.cssText = 'pointer-events:none;visibility:hidden;width:100%;';
    container.appendChild(spacer);
  }
  spacer.style.height = maxHeight + 'px';
}


// ── Notes View: Column-Aware Drag-to-Reorder ────────────────────────────────

let _notesDragState = null;

function enableNotesDragReorder(container, tab, onReorder) {
  if (!container) return;

  container.querySelectorAll('.chit-card').forEach(card => {
    card.style.cursor = 'grab';

    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, textarea, select, button, a, ul, li, [contenteditable="true"]')) return;
      if (card.querySelector('[contenteditable="true"]')) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const rect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const { colCount, actualCardWidth } = _notesColMetrics(container);

      // Snapshot every card's {id, col, position-within-col} for cancel restore
      const allCards = Array.from(container.querySelectorAll('.chit-card'));
      const columns = _buildNoteColumns(allCards, colCount);
      const origSnapshot = [];
      columns.forEach((colCards, ci) => {
        colCards.forEach((c, ri) => {
          origSnapshot.push({ id: c.dataset.chitId, col: ci, row: ri });
        });
      });

      _notesDragState = {
        card,
        container,
        tab,
        onReorder,
        origSnapshot,
        origCol: parseInt(card.dataset.col, 10),
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        colCount,
        actualCardWidth,
        cancelled: false,
        targetCol: undefined,
        targetInsertIdx: undefined,
      };

      card.style.zIndex = '100';
      card.style.opacity = '0.85';
      card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      card.style.cursor = 'grabbing';
      card.style.transition = 'none';

      document.addEventListener('mousemove', _onNotesDragMove);
      document.addEventListener('mouseup', _onNotesDragEnd);
      document.addEventListener('keydown', _onNotesDragKey);
    });
  });
}

function _onNotesDragMove(e) {
  if (!_notesDragState) return;
  const s = _notesDragState;
  const containerRect = s.container.getBoundingClientRect();

  // Float the dragged card under the cursor
  const newLeft = e.clientX - containerRect.left - s.offsetX + s.container.scrollLeft;
  const newTop = e.clientY - containerRect.top - s.offsetY + s.container.scrollTop;
  s.card.style.left = newLeft + 'px';
  s.card.style.top = newTop + 'px';

  // Which column is the cursor over?
  const cursorX = e.clientX - containerRect.left;
  const targetCol = Math.min(
    s.colCount - 1,
    Math.max(0, Math.floor((cursorX - NOTES_GAP) / (s.actualCardWidth + NOTES_GAP)))
  );

  // Build columns excluding the dragged card
  const allCards = Array.from(s.container.querySelectorAll('.chit-card'));
  const columns = _buildNoteColumns(allCards, s.colCount);
  const colCards = columns[targetCol].filter(c => c !== s.card);

  // Find vertical insert position within target column
  let insertIdx = colCards.length;
  for (let i = 0; i < colCards.length; i++) {
    const r = colCards[i].getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) {
      insertIdx = i;
      break;
    }
  }

  // Live preview: re-stack affected columns with a gap where the card will land
  // Only re-stack source column and target column (if different)
  const srcCol = parseInt(s.card.dataset.col, 10);
  const affectedCols = new Set([srcCol, targetCol]);

  affectedCols.forEach(ci => {
    const col = columns[ci].filter(c => c !== s.card);
    const left = _notesColLeft(ci, s.actualCardWidth);
    let top = NOTES_GAP;

    for (let i = 0; i < col.length; i++) {
      // If this is the target column, leave a gap at insertIdx
      if (ci === targetCol && i === insertIdx) {
        top += s.card.offsetHeight + NOTES_GAP;
      }
      const c = col[i];
      c.style.position = 'absolute';
      c.style.width = s.actualCardWidth + 'px';
      c.style.left = left + 'px';
      c.style.top = top + 'px';
      c.style.transition = 'top 0.15s ease';
      top += c.offsetHeight + NOTES_GAP;
    }
    // Gap at end of column
    if (ci === targetCol && insertIdx >= col.length) {
      top += s.card.offsetHeight + NOTES_GAP;
    }
  });

  // Drop indicator line
  s.container.querySelectorAll('.notes-drop-indicator').forEach(el => el.remove());
  const indicator = document.createElement('div');
  indicator.className = 'notes-drop-indicator';
  const colLeft = _notesColLeft(targetCol, s.actualCardWidth);

  let indicatorTop;
  if (colCards.length === 0) {
    indicatorTop = NOTES_GAP;
  } else if (insertIdx >= colCards.length) {
    const lastCard = colCards[colCards.length - 1];
    const r = lastCard.getBoundingClientRect();
    indicatorTop = r.bottom - containerRect.top + s.container.scrollTop + 2;
  } else {
    const r = colCards[insertIdx].getBoundingClientRect();
    indicatorTop = r.top - containerRect.top + s.container.scrollTop - 2;
  }

  indicator.style.cssText = `position:absolute;left:${colLeft}px;top:${indicatorTop}px;width:${s.actualCardWidth}px;height:3px;background:#4a2c2a;border-radius:2px;z-index:90;pointer-events:none;`;
  s.container.appendChild(indicator);

  s.targetCol = targetCol;
  s.targetInsertIdx = insertIdx;
}

function _onNotesDragEnd(e) {
  document.removeEventListener('mousemove', _onNotesDragMove);
  document.removeEventListener('mouseup', _onNotesDragEnd);
  document.removeEventListener('keydown', _onNotesDragKey);

  if (!_notesDragState) return;
  const s = _notesDragState;

  // Clean up indicator and card styles
  s.container.querySelectorAll('.notes-drop-indicator').forEach(el => el.remove());
  s.card.style.zIndex = '';
  s.card.style.opacity = '';
  s.card.style.boxShadow = '';
  s.card.style.cursor = 'grab';
  s.card.style.transition = '';

  // Remove transition from all cards
  s.container.querySelectorAll('.chit-card').forEach(c => { c.style.transition = ''; });

  if (s.cancelled) {
    // Restore original column assignments and order
    s.origSnapshot.forEach(({ id, col }) => {
      const el = s.container.querySelector(`[data-chit-id="${id}"]`);
      if (el) el.dataset.col = col;
    });
    applyNotesLayout(s.container);
    _notesDragState = null;
    return;
  }

  if (s.targetCol !== undefined) {
    const srcCol = parseInt(s.card.dataset.col, 10);
    const targetCol = s.targetCol;

    // Update the dragged card's column assignment
    s.card.dataset.col = targetCol;

    // Build columns from data-col (card is now in targetCol)
    const allCards = Array.from(s.container.querySelectorAll('.chit-card'));
    const columns = _buildNoteColumns(allCards, s.colCount);

    // Remove dragged card from its position in the target column array
    const targetCards = columns[targetCol].filter(c => c !== s.card);
    // Insert at the correct position
    const insertIdx = Math.min(s.targetInsertIdx || 0, targetCards.length);
    targetCards.splice(insertIdx, 0, s.card);
    columns[targetCol] = targetCards;

    // Re-stack only affected columns (source and target)
    const affectedCols = new Set([srcCol, targetCol]);
    affectedCols.forEach(ci => {
      if (ci >= 0 && ci < s.colCount) {
        _stackColumn(columns[ci], ci, s.actualCardWidth);
      }
    });

    // Update container height via spacer
    let maxH = 0;
    columns.forEach(col => {
      const h = col.reduce((acc, c) => acc + c.offsetHeight + NOTES_GAP, NOTES_GAP);
      if (h > maxH) maxH = h;
    });
    let spacer = s.container.querySelector('.notes-height-spacer');
    if (spacer) spacer.style.height = maxH + 'px';

    // Save order as {id, col} pairs, preserving within-column order
    const orderData = [];
    columns.forEach((colCards, ci) => {
      colCards.forEach(c => {
        orderData.push({ id: c.dataset.chitId, col: ci });
      });
    });
    saveManualOrder(s.tab, orderData);
    currentSortField = 'manual';
    const sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    if (typeof _updateSortUI === 'function') _updateSortUI();
  }

  _notesDragState = null;
}

function _onNotesDragKey(e) {
  if (e.key === 'Escape' && _notesDragState) {
    _notesDragState.cancelled = true;
    _onNotesDragEnd(e);
  }
}


// ── Touch Event Adapter ──────────────────────────────────────────────────────

/**
 * Enable touch-based drag on an element by mapping touch events to mouse-like callbacks.
 * Maps touchstart → onStart, touchmove → onMove (with preventDefault), touchend → onEnd.
 * Each callback receives { clientX, clientY, target, event }.
 *
 * Idempotent — safe to call multiple times on the same element (previous listeners
 * are removed via the _touchDragCleanup property before attaching new ones).
 *
 * @param {HTMLElement} element - The DOM element to attach touch listeners to
 * @param {object} callbacks - { onStart, onMove, onEnd } functions
 */
function enableTouchDrag(element, callbacks) {
  try {
    if (!element || !callbacks) return;

    // Clean up previous listeners if called again on the same element (idempotent)
    if (element._touchDragCleanup) {
      element._touchDragCleanup();
    }

    function _extractTouchData(touchEvent) {
      const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touch) return null;
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: touchEvent.target,
        event: touchEvent,
      };
    }

    function _onTouchStart(e) {
      const data = _extractTouchData(e);
      if (!data) return;
      if (typeof callbacks.onStart === 'function') {
        callbacks.onStart(data);
      }
    }

    function _onTouchMove(e) {
      e.preventDefault(); // Block browser scroll during drag
      const data = _extractTouchData(e);
      if (!data) return;
      if (typeof callbacks.onMove === 'function') {
        callbacks.onMove(data);
      }
    }

    function _onTouchEnd(e) {
      const data = _extractTouchData(e);
      if (!data) return;
      if (typeof callbacks.onEnd === 'function') {
        callbacks.onEnd(data);
      }
    }

    element.addEventListener('touchstart', _onTouchStart, { passive: true });
    element.addEventListener('touchmove', _onTouchMove, { passive: false });
    element.addEventListener('touchend', _onTouchEnd, { passive: true });

    // Store cleanup function for idempotent re-attachment
    element._touchDragCleanup = function () {
      element.removeEventListener('touchstart', _onTouchStart);
      element.removeEventListener('touchmove', _onTouchMove);
      element.removeEventListener('touchend', _onTouchEnd);
      delete element._touchDragCleanup;
    };
  } catch (e) {
    // No-op fallback if touch events are unsupported
  }
}


// ── Mobile Sidebar Overlay Behavior ──────────────────────────────────────────

/** @type {HTMLElement|null} Cached reference to the sidebar backdrop element */
let _sidebarBackdropEl = null;

/**
 * Ensure the .sidebar-backdrop element exists in the DOM.
 * Reuses an existing one if present; otherwise creates and appends it to <body>.
 * @returns {HTMLElement} The backdrop element
 */
function _ensureSidebarBackdrop() {
  if (_sidebarBackdropEl && document.body.contains(_sidebarBackdropEl)) {
    return _sidebarBackdropEl;
  }
  _sidebarBackdropEl = document.querySelector('.sidebar-backdrop');
  if (!_sidebarBackdropEl) {
    _sidebarBackdropEl = document.createElement('div');
    _sidebarBackdropEl.className = 'sidebar-backdrop';
    document.body.appendChild(_sidebarBackdropEl);
  }
  // Attach click handler (idempotent — remove first to avoid duplicates)
  _sidebarBackdropEl.removeEventListener('click', _onSidebarBackdropClick);
  _sidebarBackdropEl.addEventListener('click', _onSidebarBackdropClick);
  return _sidebarBackdropEl;
}

/**
 * Handle click on the sidebar backdrop — close sidebar and hide backdrop.
 */
function _onSidebarBackdropClick() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
  }
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Show the sidebar backdrop (only meaningful at ≤768px where CSS makes it visible).
 */
function _showSidebarBackdrop() {
  const backdrop = _ensureSidebarBackdrop();
  backdrop.classList.add('active');
}

/**
 * Hide the sidebar backdrop.
 */
function _hideSidebarBackdrop() {
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Check if the current viewport is in mobile/tablet overlay mode (≤768px).
 * @returns {boolean}
 */
function _isMobileOverlay() {
  return window.innerWidth <= 768;
}

/**
 * Initialize mobile sidebar overlay behavior.
 * - On ≤768px: sidebar defaults to closed on page load
 * - Creates/manages the .sidebar-backdrop element
 * - Adds a visible close button inside the sidebar for mobile
 * - Listens for resize events to handle crossing the 768px boundary
 *
 * Call this once from DOMContentLoaded (e.g., in main.js).
 * Does NOT call toggleSidebar — it only sets up the overlay infrastructure.
 */
function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Ensure backdrop element exists
  _ensureSidebarBackdrop();

  // Add a close button inside the sidebar for mobile (only once)
  if (!sidebar.querySelector('.sidebar-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.innerHTML = '✕ Close';
    closeBtn.setAttribute('aria-label', 'Close sidebar');
    closeBtn.addEventListener('click', function () {
      _onSidebarBackdropClick();
    });
    sidebar.insertBefore(closeBtn, sidebar.firstChild);
  }

  // On page load at ≤768px: force sidebar closed
  if (_isMobileOverlay()) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
    _hideSidebarBackdrop();
  }

  // ── Touch swipe to open/close sidebar ──────────────────────────────
  var _swipeStartX = 0;
  var _swipeStartY = 0;
  var _swipeTracking = false;
  var SWIPE_THRESHOLD = 50;
  var EDGE_ZONE = 30; // px from left edge to start swipe-open

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _swipeStartX = touch.clientX;
    _swipeStartY = touch.clientY;
    // Only track swipe-open if starting from left edge, or swipe-close if sidebar is open
    _swipeTracking = (touch.clientX < EDGE_ZONE) || sidebar.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_swipeTracking || !_isMobileOverlay()) { _swipeTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _swipeStartX;
    var dy = Math.abs(touch.clientY - _swipeStartY);
    _swipeTracking = false;

    // Only count horizontal swipes (dx > dy)
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx > 0 && !sidebar.classList.contains('active') && _swipeStartX < EDGE_ZONE) {
      // Swipe right from left edge → open sidebar (only if views panel is NOT open)
      var viewsPanel = document.querySelector('.mobile-views-panel');
      if (viewsPanel && viewsPanel.classList.contains('active')) return;
      sidebar.classList.add('active');
      localStorage.setItem('sidebarState', 'open');
      _showSidebarBackdrop();
    } else if (dx < 0 && sidebar.classList.contains('active')) {
      // Swipe left → close sidebar
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }
  }, { passive: true });

  // Listen for resize to handle crossing the 768px boundary
  let _prevWasMobile = _isMobileOverlay();
  window.addEventListener('resize', function _onMobileSidebarResize() {
    const isMobile = _isMobileOverlay();

    // Crossing from desktop → mobile: close sidebar, hide backdrop
    if (isMobile && !_prevWasMobile) {
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }

    // Crossing from mobile → desktop: hide backdrop (sidebar state stays as-is)
    if (!isMobile && _prevWasMobile) {
      _hideSidebarBackdrop();
    }

    // If still mobile and sidebar is open, ensure backdrop is shown
    if (isMobile && sidebar.classList.contains('active')) {
      _showSidebarBackdrop();
    }

    _prevWasMobile = isMobile;
  });
}


// ── Shared QR Code Display ────────────────────────────────────────────────────

/**
 * Show a QR code in a full-screen modal overlay.
 * Single source of truth for ALL QR display across the app.
 *
 * @param {object} opts
 * @param {string} opts.title   — modal title text (e.g. "🔗 Link QR Code")
 * @param {string} opts.data    — the string to encode in the QR
 * @param {string} [opts.info]  — small info text below the QR (e.g. URL or byte count)
 * @param {string} [opts.ecl]   — error correction level: 'L','M','Q','H' (default 'M')
 * @param {Function} [opts.onClose] — callback when modal closes
 * @returns {HTMLElement} the overlay element (for further customization)
 */
function showQRModal(opts) {
  // Remove any existing QR modal
  var existing = document.getElementById('cwoc-qr-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cwoc-qr-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:20px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);width:100%;max-width:360px;box-sizing:border-box;max-height:90vh;overflow-y:auto;';

  // Title
  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:bold;margin-bottom:12px;color:#4a2c2a;font-size:1.05em;word-wrap:break-word;';
  titleEl.textContent = opts.title || 'QR Code';
  modal.appendChild(titleEl);

  // QR render area
  var qrDiv = document.createElement('div');
  qrDiv.style.cssText = 'margin:12px auto;display:flex;justify-content:center;';

  if (typeof qrcode !== 'undefined') {
    try {
      var ecl = opts.ecl || 'M';
      var qr = qrcode(0, ecl);
      qr.addData(opts.data);
      qr.make();
      // Size the QR to fit the modal (max ~280px)
      var moduleCount = qr.getModuleCount();
      var maxSize = Math.min(280, window.innerWidth - 80);
      var cellSize = Math.max(2, Math.floor(maxSize / moduleCount));
      qrDiv.innerHTML = qr.createImgTag(cellSize, 4);
      // Ensure the image is responsive
      var img = qrDiv.querySelector('img');
      if (img) img.style.cssText = 'max-width:100%;height:auto;display:block;';
    } catch (err) {
      qrDiv.innerHTML = '<div style="padding:12px;color:#a33;font-size:0.85em;">Data too large for QR code.</div>';
    }
  } else {
    qrDiv.innerHTML = '<div style="padding:12px;opacity:0.6;">QR library not loaded.</div>';
  }
  modal.appendChild(qrDiv);

  // Info text
  if (opts.info) {
    var infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'font-size:0.75em;opacity:0.5;margin-top:4px;word-break:break-all;max-width:100%;';
    infoDiv.textContent = opts.info;
    modal.appendChild(infoDiv);
  }

  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'margin-top:14px;padding:10px 24px;width:100%;min-height:44px;font-size:1em;font-weight:bold;font-family:"Courier New",monospace;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;cursor:pointer;';
  closeBtn.textContent = '✕ Close';
  closeBtn.addEventListener('click', function () { _closeQR(); });
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);

  // Click backdrop to close
  overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeQR(); });

  // ESC to close (capture phase so it fires before other ESC handlers)
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      _closeQR();
    }
  }
  document.addEventListener('keydown', onKey, true);

  function _closeQR() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (opts.onClose) opts.onClose();
  }

  document.body.appendChild(overlay);
  return overlay;
}


// ── Mobile Actions Modal (editor header buttons) ─────────────────────────────

/**
 * On mobile (≤768px), hide the .buttons container in .header-row and show
 * a single "☰ Actions" trigger button. Tapping it opens a full-screen modal
 * with all the original buttons cloned and stacked vertically.
 *
 * Call once from DOMContentLoaded on editor pages.
 */
function initMobileActionsModal() {
  var headerRow = document.querySelector('.header-row');
  var buttonsDiv = headerRow && headerRow.querySelector('.buttons');
  if (!headerRow || !buttonsDiv) return;

  // Create the trigger button (hidden at desktop via CSS)
  var trigger = document.createElement('button');
  trigger.className = 'mobile-actions-trigger';
  trigger.innerHTML = '☰ Actions';
  trigger.addEventListener('click', function () { _openMobileActionsModal(); });
  headerRow.appendChild(trigger);

  // Create the modal container (hidden by default)
  var modal = document.createElement('div');
  modal.id = 'mobile-actions-modal';
  modal.className = 'mobile-actions-modal';
  modal.innerHTML = '<div class="mobile-actions-modal-content">' +
    '<h3>Actions</h3>' +
    '<div class="mobile-actions-list"></div>' +
    '<button class="mobile-actions-close">✕ Close</button>' +
    '</div>';
  document.body.appendChild(modal);

  modal.querySelector('.mobile-actions-close').addEventListener('click', function () {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('active');
  });
}

function _openMobileActionsModal() {
  var modal = document.getElementById('mobile-actions-modal');
  if (!modal) return;
  var list = modal.querySelector('.mobile-actions-list');
  list.innerHTML = '';

  // Grab all buttons from the header .buttons container (works even when hidden by CSS)
  var buttonsDiv = document.querySelector('.header-row .buttons');
  if (!buttonsDiv) return;

  var buttons = buttonsDiv.querySelectorAll('button');
  buttons.forEach(function (btn) {
    // Skip disabled "Saved" indicator buttons (any page)
    if (btn.disabled && btn.style.pointerEvents === 'none') return;
    // Skip buttons hidden by save-state logic (display:none means not relevant right now)
    if (btn.style.display === 'none') return;
    var clone = document.createElement('button');
    clone.className = 'mobile-action-btn ' + (btn.className || '');
    clone.innerHTML = btn.innerHTML;
    clone.disabled = btn.disabled;

    // Extract the onclick handler — call it directly instead of btn.click()
    // (btn.click() can fail on elements inside display:none containers)
    var onclickAttr = btn.getAttribute('onclick');
    clone.addEventListener('click', function () {
      modal.classList.remove('active');
      if (onclickAttr) {
        // Execute the onclick attribute string
        new Function(onclickAttr).call(btn);
      } else {
        // Fallback: dispatch click on the original
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    list.appendChild(clone);
  });

  modal.classList.add('active');
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


// ── Long-press to simulate shift-click (mobile quick edit) ───────────────────

/**
 * Attach a long-press handler to an element. On mobile, a ~500ms press
 * triggers the callback (used to open quick edit modal, same as shift-click).
 * Cancels if the finger moves (drag) or lifts early (tap).
 *
 * @param {HTMLElement} el - The element to attach to
 * @param {Function} callback - Called on successful long press, receives the element
 */
function enableLongPress(el, callback) {
  if (!el || !callback) return;
  var _lpTimer = null;
  var _lpFired = false;
  var _startX = 0;
  var _startY = 0;
  var HOLD_MS = 500;
  var MOVE_THRESHOLD = 10;

  el.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    _lpFired = false;
    _startX = e.touches[0].clientX;
    _startY = e.touches[0].clientY;
    _lpTimer = setTimeout(function () {
      _lpFired = true;
      // Vibrate if available (haptic feedback)
      if (navigator.vibrate) navigator.vibrate(30);
      callback(el);
    }, HOLD_MS);
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    if (!_lpTimer) return;
    var dx = e.touches[0].clientX - _startX;
    var dy = e.touches[0].clientY - _startY;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearTimeout(_lpTimer);
      _lpTimer = null;
    }
  }, { passive: true });

  el.addEventListener('touchend', function (e) {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    // If long press fired, prevent the subsequent click/tap
    if (_lpFired) {
      e.preventDefault();
      _lpFired = false;
    }
  });

  el.addEventListener('touchcancel', function () {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    _lpFired = false;
  });
}


// ── Mobile Views Button (replaces tab bar on mobile) ─────────────────────────

/**
 * On mobile (≤480px), add a "Views" button next to the header title.
 * Tapping it opens a full-screen dropdown with the 6 C CAPTN tabs.
 * The original .tabs row is hidden via CSS.
 *
 * Call once from DOMContentLoaded on the dashboard page.
 */
function initMobileViewsButton() {
  var header = document.querySelector('.header');
  if (!header) return;

  // Tab button in header, pushed to right edge via margin-left:auto
  var btn = document.createElement('button');
  btn.className = 'mobile-views-btn';
  btn.textContent = '☰ Views';
  header.appendChild(btn);

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-views-backdrop';
  document.body.appendChild(backdrop);

  // Slide-in panel
  var panel = document.createElement('div');
  panel.className = 'mobile-views-panel';
  panel.innerHTML = '<h3>Views</h3>';

  // Build options from the existing tabs
  var tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(function (tab) {
    var opt = document.createElement('div');
    opt.className = 'mobile-view-option';
    if (tab.classList.contains('active')) opt.classList.add('active');
    opt.innerHTML = tab.innerHTML;
    opt.addEventListener('click', function () {
      _closeViewsPanel();
      tab.click();
      panel.querySelectorAll('.mobile-view-option').forEach(function (o) { o.classList.remove('active'); });
      opt.classList.add('active');
    });
    panel.appendChild(opt);
  });

  var closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-views-close';
  closeBtn.textContent = '✕ Close';
  closeBtn.addEventListener('click', function () { _closeViewsPanel(); });
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);

  function _openViewsPanel() {
    // Refresh active state
    var currentTabs = document.querySelectorAll('.tabs .tab');
    var opts = panel.querySelectorAll('.mobile-view-option');
    currentTabs.forEach(function (t, i) {
      if (opts[i]) {
        opts[i].classList.toggle('active', t.classList.contains('active'));
      }
    });
    backdrop.classList.add('active');
    panel.classList.add('active');
  }

  function _closeViewsPanel() {
    panel.classList.remove('active');
    backdrop.classList.remove('active');
  }

  btn.addEventListener('click', _openViewsPanel);
  backdrop.addEventListener('click', _closeViewsPanel);

  // ── Swipe from right edge to open, swipe right to close ────────────
  var _vsStartX = 0, _vsStartY = 0, _vsTracking = false;
  var EDGE_ZONE = 25; // px from right edge
  var SWIPE_THRESHOLD = 40;

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _vsStartX = touch.clientX;
    _vsStartY = touch.clientY;
    var fromRightEdge = window.innerWidth - touch.clientX < EDGE_ZONE;
    _vsTracking = fromRightEdge || panel.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_vsTracking || !_isMobileOverlay()) { _vsTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _vsStartX;
    var dy = Math.abs(touch.clientY - _vsStartY);
    _vsTracking = false;
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx < 0 && !panel.classList.contains('active') && (window.innerWidth - _vsStartX) < EDGE_ZONE) {
      // Swipe left from right edge → open (only if sidebar is NOT open)
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) return;
      _openViewsPanel();
    } else if (dx > 0 && panel.classList.contains('active')) {
      // Swipe right → close
      _closeViewsPanel();
    }
  }, { passive: true });
}


// ── Mobile Reference Close Button ────────────────────────────────────────────

/**
 * Add a close button inside the reference overlay content for mobile.
 * On desktop, clicking outside the content closes it. On mobile the content
 * fills the screen so there's no outside area to tap.
 */
function initMobileReferenceClose() {
  var content = document.querySelector('.reference-content');
  if (!content) return;
  if (content.querySelector('.ref-close-btn')) return; // already added

  var btn = document.createElement('button');
  btn.className = 'ref-close-btn';
  btn.textContent = '✕ Close';
  btn.style.cssText = 'display:block;width:100%;margin-top:12px;padding:10px;' +
    'font-size:1em;font-weight:bold;font-family:"Courier New",monospace;' +
    'background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;' +
    'cursor:pointer;min-height:44px;';
  btn.addEventListener('click', function () {
    if (typeof _closeReference === 'function') _closeReference();
  });
  content.appendChild(btn);
}


// ── Saved Locations Utilities ────────────────────────────────────────────────

/**
 * Fetch saved locations from settings and cache them for the page lifetime.
 * Returns the saved_locations array (or empty array on error / no data).
 * Subsequent calls return the cached value without re-fetching.
 * @returns {Promise<object[]>}
 */
async function loadSavedLocations() {
  if (window._savedLocations) return window._savedLocations;
  try {
    const settings = await getCachedSettings();
    window._savedLocations = Array.isArray(settings.saved_locations) ? settings.saved_locations : [];
    return window._savedLocations;
  } catch (e) {
    console.error('Error loading saved locations:', e);
    window._savedLocations = [];
    return [];
  }
}

/**
 * Return the saved location marked as default (is_default === true), or null.
 * Reads from the cached window._savedLocations — call loadSavedLocations() first.
 * @returns {object|null}
 */
function getDefaultLocation() {
  if (!Array.isArray(window._savedLocations)) return null;
  return window._savedLocations.find(function (loc) { return loc.is_default === true; }) || null;
}
