/**
 * main-views-notebook.js — Combined Notes + Checklists "Notebook" view.
 *
 * Displays both notes and checklists in a single masonry layout,
 * using the same column-persistent positioning as the Notes view.
 *
 * Depends on: main-views.js (shared helpers), main-views-notes.js (notes rendering),
 *   shared.js (applyNotesLayout, enableNotesDragReorder, enableDragToReorder),
 *   shared-checklist.js (renderInlineChecklist), main.js globals
 */


function displayNotebookView(chitsToDisplay) {
  var chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  var notebookView = document.createElement("div");
  notebookView.className = "notebook-view";
  var _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Combine: chits with notes OR chits with checklist items
  var notebookChits = chitsToDisplay.filter(function(c) {
    var hasNote = c.note && c.note.trim() !== '';
    var hasChecklist = Array.isArray(c.checklist) && c.checklist.some(function(i) { return i && i.text && i.text.trim(); });
    return hasNote || hasChecklist;
  });

  // Default sort: pinned first, then by modified date
  var sortedChits = currentSortField ? notebookChits : notebookChits.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    var dateA = new Date(a.modified_datetime || a.last_edited || a.created_datetime || a.start_datetime || 0);
    var dateB = new Date(b.modified_datetime || b.last_edited || b.created_datetime || b.start_datetime || 0);
    return dateB - dateA;
  });

  if (sortedChits.length === 0) {
    notebookView.innerHTML = _emptyState("No notes or checklists found.");
  } else {
    sortedChits.forEach(function(chit) {
      var hasNote = chit.note && chit.note.trim() !== '';
      var hasChecklist = Array.isArray(chit.checklist) && chit.checklist.some(function(i) { return i && i.text && i.text.trim(); });

      var chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.archived) chitElement.classList.add("archived-chit");
      if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

      // Type badge (note vs checklist vs both)
      var typeBadge = '';
      if (hasNote && hasChecklist) typeBadge = '📝☑ ';
      else if (hasChecklist) typeBadge = '☑ ';
      else typeBadge = '📝 ';

      // Title row (similar to Notes view)
      var titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { var pi = document.createElement('i'); pi.className = 'fas fa-bookmark'; pi.title = 'Pinned'; pi.style.fontSize = '0.85em'; titleRow.appendChild(pi); }
      if (chit.archived) { var ai = document.createElement('span'); ai.textContent = '📦'; ai.title = 'Archived'; titleRow.appendChild(ai); }

      // Alert indicators
      if (typeof _getAllIndicators === 'function') {
        var indicators = _getAllIndicators(chit, _viSettings, 'card');
        if (indicators) { var s = document.createElement('span'); s.className = 'alert-indicators'; s.textContent = indicators; titleRow.appendChild(s); }
      }

      // Type badge element
      var badgeSpan = document.createElement('span');
      badgeSpan.style.cssText = 'font-size:0.8em;opacity:0.7;';
      badgeSpan.textContent = typeBadge;
      titleRow.appendChild(badgeSpan);

      var titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);

      chitElement.appendChild(titleRow);

      // Render note content if present
      if (hasNote) {
        var noteEl = document.createElement("div");
        noteEl.className = "note-content";
        noteEl.style.cssText = "overflow-y:auto;";
        if (typeof marked !== "undefined" && chit.note) {
          noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note, { breaks: true }), chits);
        } else {
          noteEl.style.whiteSpace = "pre-wrap";
          noteEl.textContent = chit.note;
        }
        chitElement.appendChild(noteEl);

        // Single click on note text: edit in place
        noteEl.addEventListener("click", function(e) {
          if (e.shiftKey) return;
          e.stopPropagation();
          if (typeof _isViewerRole === 'function' && _isViewerRole(chit)) return;
          if (noteEl.contentEditable === 'true') return;
          noteEl.contentEditable = 'true';
          noteEl.style.outline = '2px solid #8b4513';
          noteEl.style.borderRadius = '4px';
          noteEl.style.padding = '6px';
          noteEl.style.whiteSpace = 'pre-wrap';
          noteEl.style.maxHeight = 'none';
          noteEl.style.overflow = 'visible';
          noteEl.style.userSelect = 'text';
          chitElement.style.cursor = 'auto';
          chitElement.style.overflow = 'visible';
          chitElement.style.userSelect = 'text';
          chitElement.setAttribute('draggable', 'false');
          noteEl.textContent = chit.note || '';
          noteEl.focus();
          var _nbContainer = chitElement.closest('.notebook-view');
          if (_nbContainer && typeof applyNotesLayout === 'function') {
            setTimeout(function() { applyNotesLayout(_nbContainer); }, 10);
          }
          var saveEdit = function() {
            noteEl.contentEditable = 'false';
            noteEl.style.outline = '';
            noteEl.style.padding = '';
            noteEl.style.maxHeight = '';
            noteEl.style.overflow = '';
            noteEl.style.userSelect = '';
            chitElement.style.cursor = 'grab';
            chitElement.style.overflow = '';
            chitElement.style.userSelect = '';
            chitElement.removeAttribute('draggable');
            var newNote = noteEl.textContent;
            if (newNote !== chit.note) {
              fetch('/api/chits/' + chit.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
              }).then(function(r) { if (r.ok) { chit.note = newNote; fetchChits(); } });
            } else {
              if (typeof marked !== 'undefined' && chit.note) {
                noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note, { breaks: true }), chits);
              }
            }
            if (_nbContainer && typeof applyNotesLayout === 'function') {
              setTimeout(function() { applyNotesLayout(_nbContainer); }, 10);
            }
          };
          noteEl.addEventListener('blur', saveEdit, { once: true });
          noteEl.addEventListener('keydown', function(ke) {
            if (ke.key === 'Escape') { ke.preventDefault(); noteEl.blur(); }
          });
        });
      }

      // Render checklist if present
      if (hasChecklist) {
        // Checklist progress in header
        var _clNonEmpty = (chit.checklist || []).filter(function(i) { return i && i.text && i.text.trim(); });
        var _clAllChecked = _clNonEmpty.length > 0 && _clNonEmpty.every(function(i) { return i.checked || i.done; });
        if (_clAllChecked) chitElement.classList.add('checklist-all-done');

        if (typeof _isViewerRole !== 'function' || !_isViewerRole(chit)) {
          renderInlineChecklist(chitElement, chit, function() { fetchChits(); });
        } else {
          var roList = document.createElement('div');
          roList.style.cssText = 'opacity:0.8;font-size:0.9em;';
          (chit.checklist || []).forEach(function(item) {
            if (item.checked || item.done) return;
            var row = document.createElement('div');
            row.style.cssText = 'padding:2px 0;';
            var rowText = document.createElement('span');
            rowText.textContent = '☐ ';
            row.appendChild(rowText);
            var rowMd = document.createElement('span');
            renderChecklistItemMarkdown(rowMd, item.text || item.label || '');
            row.appendChild(rowMd);
            roList.appendChild(row);
          });
          chitElement.appendChild(roList);
        }
      }

      // Double-click: open in editor
      chitElement.addEventListener("dblclick", function() {
        storePreviousState();
        window.location.href = '/editor?id=' + chit.id;
      });
      // Shift+click: open quick-edit modal
      chitElement.addEventListener("click", function(e) {
        if (!e.shiftKey) return;
        e.preventDefault();
        if (typeof showQuickEditModal === 'function' && (!_isViewerRole || !_isViewerRole(chit))) {
          showQuickEditModal(chit, function() { displayChits(); });
        }
      });
      // Right-click: open context menu
      chitElement.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        if (typeof _showChitContextMenu === 'function' && (!_isViewerRole || !_isViewerRole(chit))) {
          _showChitContextMenu(e, chit, function() { displayChits(); });
        }
      });

      notebookView.appendChild(chitElement);
    });
  }

  chitList.appendChild(notebookView);

  // Restore saved column assignments from localStorage
  var savedOrder = getManualOrder('Notebook');
  if (Array.isArray(savedOrder) && savedOrder.length > 0 && typeof savedOrder[0] === 'object') {
    var allCol0 = savedOrder.every(function(e) { return e.col === 0; });
    if (!allCol0) {
      var colMap = {};
      savedOrder.forEach(function(entry) { if (entry.id && entry.col !== undefined) colMap[entry.id] = entry.col; });
      notebookView.querySelectorAll('.chit-card').forEach(function(card) {
        var id = card.dataset.chitId;
        if (id in colMap) card.dataset.col = colMap[id];
      });
    }
  }

  // Apply column-persistent masonry layout
  setTimeout(function() {
    applyNotesLayout(notebookView);
    setTimeout(function() { applyNotesLayout(notebookView); }, 200);
    setTimeout(function() { applyNotesLayout(notebookView); }, 500);
  }, 50);

  // Re-layout on window resize
  var _nbResizeHandler = function() {
    if (currentTab === 'Notebook') {
      var nv = document.querySelector('.notebook-view');
      if (nv) applyNotesLayout(nv);
    }
  };
  window.removeEventListener('resize', window._notebookResizeHandler);
  window._notebookResizeHandler = _nbResizeHandler;
  window.addEventListener('resize', _nbResizeHandler);

  // On mobile (single column), use flat drag; on desktop, use masonry-aware drag
  var _nbMobileMode = (window.innerWidth <= 480);
  if (_nbMobileMode) {
    var _nbLongPressMap = {};
    sortedChits.forEach(function(chit) {
      if (typeof _isViewerRole !== 'function' || !_isViewerRole(chit)) {
        _nbLongPressMap[chit.id] = function() {
          if (typeof showQuickEditModal === 'function') {
            showQuickEditModal(chit, function() { displayChits(); });
          }
        };
      }
    });
    enableDragToReorder(notebookView, 'Notebook', function() { displayChits(); }, _nbLongPressMap);
  } else {
    enableNotesDragReorder(notebookView, 'Notebook', function() { displayChits(); });
  }
}
