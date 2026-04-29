/**
 * shared-checklist.js — Inline checklist interactions for dashboard views.
 *
 * Provides toggle, move, cross-chit move, and interactive rendering
 * of checklist items with drag-and-drop (mouse and touch) support.
 *
 * Depends on: shared-utils.js (for API helpers)
 *             shared-touch.js (for enableTouchDrag)
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
