/**
 * main-views-notes.js — Notes masonry view.
 *
 * Contains:
 *   - displayNotesView (masonry layout with inline editing, drag reorder)
 *
 * Depends on: main-views.js (shared helpers), shared.js (applyNotesLayout,
 *   enableNotesDragReorder, enableDragToReorder), main.js globals
 */


function displayNotesView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const notesView = document.createElement("div");
  notesView.className = "notes-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

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
    notesView.innerHTML = _emptyState("No notes found.");
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.archived) chitElement.classList.add("archived-chit");
      if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

      // Simple title with icons
      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { const i = document.createElement('i'); i.className = 'fas fa-bookmark'; i.title = 'Pinned'; i.style.fontSize = '0.85em'; titleRow.appendChild(i); }
      if (chit.archived) { const i = document.createElement('span'); i.textContent = '📦'; i.title = 'Archived'; titleRow.appendChild(i); }
      // Stealth indicator — visible only to the owner (Requirement 6.5)
      if (chit.stealth) {
        var _notesStealth = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (_notesStealth && chit.owner_id === _notesStealth.user_id) {
          var _nsi = document.createElement('span'); _nsi.textContent = '🥷'; _nsi.title = 'Stealth — hidden from other users'; _nsi.className = 'cwoc-stealth-indicator'; titleRow.appendChild(_nsi);
        }
      }
      // Alert indicators
      if (typeof _getAllIndicators === 'function') {
        const indicators = _getAllIndicators(chit, _viSettings, 'card');
        if (indicators) { const s = document.createElement('span'); s.className = 'alert-indicators'; s.textContent = indicators; titleRow.appendChild(s); }
      }
      // Weather indicator
      if (chit.location && chit.location.trim()) {
        var _nwMode = (_viSettings || {}).weather || 'always';
        if (typeof _shouldShow === 'function' && _shouldShow(_nwMode, 'card')) {
          const wxSpan = document.createElement('span');
          wxSpan.className = 'chit-weather-indicator';

          // Prefer stored weather_data from backend
          var _nwWd = chit.weather_data;
          if (typeof _nwWd === 'string') { try { _nwWd = JSON.parse(_nwWd); } catch (e) { _nwWd = null; } }
          if (_nwWd && _nwWd.weather_code !== undefined && _nwWd.high !== undefined && _nwWd.low !== undefined) {
            var _nwIcon = _getWeatherIcon(_nwWd.weather_code);
            var _nwHighF = _celsiusToFahrenheit(_nwWd.high);
            var _nwLowF = _celsiusToFahrenheit(_nwWd.low);
            var _nwStale = _isWeatherStale(_nwWd.updated_time) ? '⏳' : '';
            var _nwTooltip = _nwHighF + '°/' + _nwLowF + '°';
            var _nwPrecipText = _formatPrecip(_nwWd.precipitation, _nwWd.weather_code);
            if (_nwPrecipText) _nwTooltip += ' · ' + _nwPrecipText;
            if (_nwStale) _nwTooltip += ' (stale)';
            wxSpan.textContent = _nwStale + _nwIcon;
            wxSpan.title = _nwTooltip;
          } else {
            var _nwKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
            var _nwCached = null;
            try { _nwCached = JSON.parse(localStorage.getItem(_nwKey)); } catch (e) {}
            if (_nwCached && _nwCached.icon && (Date.now() - _nwCached.ts < 3600000)) {
              wxSpan.textContent = _nwCached.icon;
              wxSpan.title = _nwCached.tooltip;
            } else {
              wxSpan.textContent = '⏳';
              wxSpan.title = 'Loading weather…';
              _queueChitWeatherFetch(chit.location, wxSpan);
            }
          }
          titleRow.appendChild(wxSpan);
        }
      }
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);

      // Owner badge — show only when owner differs from current user
      if (chit.owner_display_name) {
        var _notesUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!_notesUser || chit.owner_display_name !== _notesUser.display_name) {
          var _notesOwner = document.createElement('span');
          _notesOwner.className = 'cwoc-owner-badge';
          _notesOwner.textContent = '👤 ' + chit.owner_display_name;
          _notesOwner.title = 'Owner: ' + chit.owner_display_name;
          titleRow.appendChild(_notesOwner);
        }
      }

      // Assignee display name (Requirement 7.4)
      if (chit.assigned_to_display_name) {
        var _notesAssignee = document.createElement('span');
        _notesAssignee.className = 'cwoc-assignee-badge';
        _notesAssignee.textContent = '📌 ' + chit.assigned_to_display_name;
        _notesAssignee.title = 'Assigned to: ' + chit.assigned_to_display_name;
        titleRow.appendChild(_notesAssignee);
      }

      chitElement.appendChild(titleRow);

      const noteEl = document.createElement("div");
      noteEl.className = "note-content";
      noteEl.style.cssText = "overflow-y:auto;";
      if (typeof marked !== "undefined" && chit.note) {
        noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
      } else {
        noteEl.style.whiteSpace = "pre-wrap";
        noteEl.textContent = chit.note;
      }
      chitElement.appendChild(noteEl);

      // Double-click: open in editor. Shift+click: edit in place.
      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      chitElement.addEventListener("click", (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        // Prevent inline editing for viewer-role shared chits
        if (_isViewerRole(chit)) return;
        // Toggle in-place editing
        if (noteEl.contentEditable === 'true') return;
        noteEl.contentEditable = 'true';
        noteEl.style.outline = '2px solid #8b4513';
        noteEl.style.borderRadius = '4px';
        noteEl.style.padding = '6px';
        noteEl.style.whiteSpace = 'pre-wrap';
        chitElement.style.cursor = 'auto';
        chitElement.setAttribute('draggable', 'false');
        noteEl.textContent = chit.note || '';
        noteEl.focus();
        const saveEdit = () => {
          noteEl.contentEditable = 'false';
          noteEl.style.outline = '';
          noteEl.style.padding = '';
          chitElement.style.cursor = 'grab';
          chitElement.removeAttribute('draggable');
          const newNote = noteEl.textContent;
          if (newNote !== chit.note) {
            fetch(`/api/chits/${chit.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...chit, note: newNote })
            }).then(r => { if (r.ok) { chit.note = newNote; fetchChits(); } });
          } else {
            if (typeof marked !== 'undefined' && chit.note) {
              noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
            }
          }
        };
        noteEl.addEventListener('blur', saveEdit, { once: true });
        noteEl.addEventListener('keydown', (ke) => {
          if (ke.key === 'Escape') { ke.preventDefault(); noteEl.blur(); }
        });
      });
      // Long-press on mobile: toggle in-place editing (same as shift-click)
      // Uses unified touch gesture: drag to reorder, very long press to edit
      // (enableTouchGesture is attached after all cards are added, via enableNotesDragReorder)
      notesView.appendChild(chitElement);
    });
  }
  chitList.appendChild(notesView);

  // Restore saved column assignments from localStorage
  const savedOrder = getManualOrder('Notes');
  if (Array.isArray(savedOrder) && savedOrder.length > 0 && typeof savedOrder[0] === 'object') {
    // New format: [{id, col}, ...]
    // Check if all are in col 0 (buggy save) — if so, ignore and let auto-distribute
    const allCol0 = savedOrder.every(e => e.col === 0);
    if (!allCol0) {
      const colMap = {};
      savedOrder.forEach(entry => { if (entry.id && entry.col !== undefined) colMap[entry.id] = entry.col; });
      notesView.querySelectorAll('.chit-card').forEach(card => {
        const id = card.dataset.chitId;
        if (id in colMap) card.dataset.col = colMap[id];
      });
    }
  }

  // Apply column-persistent layout — delay to ensure markdown is rendered
  setTimeout(() => {
    applyNotesLayout(notesView);
    // Re-measure after images/markdown finish rendering
    setTimeout(() => applyNotesLayout(notesView), 200);
    // Final safety re-layout in case container width wasn't ready
    setTimeout(() => applyNotesLayout(notesView), 500);
  }, 50);

  // Re-layout on window resize
  const resizeHandler = () => {
    if (currentTab === 'Notes') {
      var nv = document.querySelector('.notes-view');
      if (nv) applyNotesLayout(nv);
    }
  };
  window.removeEventListener('resize', window._notesResizeHandler);
  window._notesResizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  // On mobile (single column), use the same drag system as Tasks/Checklists
  // which floats the card under the finger with a placeholder.
  // On desktop, use the masonry-aware notes drag.
  var _notesMobileMode = (window.innerWidth <= 480);
  if (_notesMobileMode) {
    // Build long-press map: inline note editing (same as shift-click)
    var _notesLpMap = {};
    sortedChits.forEach(function (chit) {
      if (_isViewerRole(chit)) return;
      _notesLpMap[chit.id] = function () {
        var card = notesView.querySelector('[data-chit-id="' + chit.id + '"]');
        if (!card) return;
        var noteEl = card.querySelector('.note-content');
        if (!noteEl || noteEl.contentEditable === 'true') return;
        noteEl.contentEditable = 'true';
        noteEl.style.outline = '2px solid #8b4513';
        noteEl.style.borderRadius = '4px';
        noteEl.style.padding = '6px';
        noteEl.style.whiteSpace = 'pre-wrap';
        card.style.cursor = 'auto';
        card.setAttribute('draggable', 'false');
        noteEl.textContent = chit.note || '';
        noteEl.focus();
        var _saveEdit = function () {
          noteEl.contentEditable = 'false';
          noteEl.style.outline = '';
          noteEl.style.padding = '';
          card.style.cursor = '';
          card.removeAttribute('draggable');
          var newNote = noteEl.textContent;
          if (newNote !== chit.note) {
            fetch('/api/chits/' + chit.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
            }).then(function (r) { if (r.ok) { chit.note = newNote; if (typeof fetchChits === 'function') fetchChits(); } });
          } else {
            if (typeof marked !== 'undefined' && chit.note) {
              noteEl.innerHTML = (typeof resolveChitLinks === 'function') ? resolveChitLinks(marked.parse(chit.note), chits) : marked.parse(chit.note);
            }
          }
        };
        noteEl.addEventListener('blur', _saveEdit, { once: true });
      };
    });
    enableDragToReorder(notesView, 'Notes', function () { displayChits(); }, _notesLpMap);
  } else {
    enableNotesDragReorder(notesView, 'Notes', () => displayChits());
  }
}
