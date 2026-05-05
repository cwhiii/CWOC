/**
 * editor-send-content.js — Send notes/checklist content to another chit
 *
 * Provides a "Send to Chit" button in the Notes and Checklist zone headers.
 * Opens a single-select chit picker modal (reusing the same style as the
 * project child-chit picker), then offers Copy, Move, or Cancel.
 * After execution, shows an undo bar in the zone header.
 *
 * Depends on: shared-utils.js (cwocToast, generateUniqueId),
 *             editor.js (_onChecklistChange),
 *             editor_checklists.js (Checklist class)
 * Loaded before: editor-init.js
 */

/* ── State ────────────────────────────────────────────────────────────────── */

var _sendContentModal = null;
var _sendContentModalOpen = false;
var _sendContentType = null; // 'notes' or 'checklist'

/* ── Open the single-select chit picker ───────────────────────────────────── */

async function _openSendContentModal(e, contentType) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  _sendContentType = contentType;

  // Validate there's content to send
  if (contentType === 'notes') {
    var noteEl = document.getElementById('note');
    if (!noteEl || !noteEl.value.trim()) {
      cwocToast('No notes content to send.', 'info');
      return;
    }
  } else if (contentType === 'checklist') {
    if (!window.checklist || window.checklist.getChecklistData().length === 0) {
      cwocToast('No checklist items to send.', 'info');
      return;
    }
  }

  // Create modal if it doesn't exist
  if (!_sendContentModal) {
    _sendContentModal = document.createElement('div');
    _sendContentModal.id = 'sendContentModal';
    _sendContentModal.className = 'modal-overlay-new';
    document.body.appendChild(_sendContentModal);

    _sendContentModal.innerHTML = `
      <div class="modal-content-new">
        <div class="modal-header-new">
          <h2 id="sendContentModalTitle">Select Target Chit</h2>
          <div class="modal-buttons"></div>
        </div>
        <div class="modal-body-new">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
            <select id="sendContentFilterStatus" style="padding:4px 8px;border:1px solid #a0522d;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#fff8f0;">
              <option value="">All Statuses</option>
              <option value="ToDo">ToDo</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Complete">Complete</option>
            </select>
            <input type="text" id="sendContentSearch" class="chit-search-input-new" placeholder="Search chits..." autofocus style="flex:1;">
          </div>
          <table class="chit-table-new">
            <thead>
              <tr>
                <th style="width:30px;"></th>
                <th>Title</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="sendContentChitList"></tbody>
          </table>
        </div>
        <div class="modal-footer-new">
          <span id="sendContentSelectedName" style="font-size:0.85em;opacity:0.7;flex:1;"></span>
          <button class="modal-button-new cancel" id="sendContentCancelBtn">Cancel</button>
          <button class="modal-button-new" id="sendContentCopyBtn" disabled>📋 Copy</button>
          <button class="modal-button-new" id="sendContentMoveBtn" disabled>📤 Move</button>
        </div>
      </div>
    `;

    // Event listeners (attached once)
    document.getElementById('sendContentSearch').addEventListener('input', _sendContentApplyFilters);
    document.getElementById('sendContentFilterStatus').addEventListener('change', _sendContentApplyFilters);

    document.getElementById('sendContentCancelBtn').addEventListener('click', function() {
      _closeSendContentModal();
    });

    document.getElementById('sendContentCopyBtn').addEventListener('click', function() {
      _executeSendContent('copy');
    });

    document.getElementById('sendContentMoveBtn').addEventListener('click', function() {
      _executeSendContent('move');
    });

    // Click overlay to close
    _sendContentModal.addEventListener('click', function(ev) {
      if (ev.target === _sendContentModal) _closeSendContentModal();
    });

    // ESC handler
    _sendContentModal._escHandler = function(ev) {
      if (ev.key === 'Escape' && _sendContentModalOpen) {
        ev.preventDefault();
        ev.stopPropagation();
        var searchInput = document.getElementById('sendContentSearch');
        if (searchInput && searchInput.value.trim()) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        } else {
          _closeSendContentModal();
        }
      }
    };
    document.addEventListener('keydown', _sendContentModal._escHandler, true);
  }

  // Update title based on content type
  var titleEl = document.getElementById('sendContentModalTitle');
  if (titleEl) {
    titleEl.textContent = contentType === 'notes'
      ? 'Send Notes To...'
      : 'Send Checklist To...';
  }

  // Show modal
  _sendContentModal.style.display = 'flex';
  _sendContentModalOpen = true;

  // Fetch chits and populate
  try {
    var response = await fetch('/api/chits');
    if (!response.ok) throw new Error('Failed to fetch chits');
    var allChits = await response.json();

    // Exclude current chit, sort alphabetically
    var available = allChits
      .filter(function(c) { return c.id !== window.currentChitId; })
      .sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });

    _sendContentModal._availableChits = available;
    _sendContentModal._selectedChit = null;

    _sendContentRenderChits(available);

    // Update header count
    if (titleEl) {
      var label = contentType === 'notes' ? 'Send Notes To' : 'Send Checklist To';
      titleEl.textContent = label + ' (' + available.length + ' available)';
    }
  } catch (err) {
    console.error('Error fetching chits for send-content modal:', err);
    cwocToast('Failed to load chits.', 'error');
    _closeSendContentModal();
    return;
  }

  // Reset state
  document.getElementById('sendContentSearch').value = '';
  _sendContentModal._selectedChit = null;
  _sendContentUpdateButtons();
  setTimeout(function() { document.getElementById('sendContentSearch').focus(); }, 50);
}

function _closeSendContentModal() {
  if (_sendContentModal) {
    _sendContentModal.style.display = 'none';
  }
  _sendContentModalOpen = false;
}

/* ── Render chit list (single-select via radio-style) ─────────────────────── */

function _sendContentRenderChits(chits) {
  var list = document.getElementById('sendContentChitList');
  if (!list) return;
  list.innerHTML = '';
  var searchTerm = (document.getElementById('sendContentSearch')?.value || '').toLowerCase().trim();

  chits.forEach(function(chit) {
    var row = document.createElement('tr');
    row.dataset.chitId = chit.id;
    row.style.cursor = 'pointer';

    // Radio cell
    var radioCell = document.createElement('td');
    radioCell.style.textAlign = 'center';
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'sendContentTarget';
    radio.value = chit.id;
    radio.checked = (_sendContentModal._selectedChit && _sendContentModal._selectedChit.id === chit.id);
    radio.addEventListener('change', function() {
      _sendContentModal._selectedChit = chit;
      _sendContentUpdateButtons();
    });
    radioCell.appendChild(radio);
    row.appendChild(radioCell);

    // Title cell
    var titleCell = document.createElement('td');
    var titleText = chit.title || '(No Title)';
    if (searchTerm) {
      titleCell.innerHTML = _sendContentHighlight(titleText, searchTerm);
    } else {
      titleCell.textContent = titleText;
    }
    row.appendChild(titleCell);

    // Due date cell
    var dueCell = document.createElement('td');
    dueCell.textContent = chit.due_datetime ? new Date(chit.due_datetime).toISOString().slice(0, 10) : '';
    row.appendChild(dueCell);

    // Status cell
    var statusCell = document.createElement('td');
    statusCell.textContent = chit.status || '';
    row.appendChild(statusCell);

    // Click row to select
    row.addEventListener('click', function(ev) {
      if (ev.target.tagName === 'INPUT') return;
      radio.checked = true;
      _sendContentModal._selectedChit = chit;
      _sendContentUpdateButtons();
    });

    list.appendChild(row);
  });
}

function _sendContentHighlight(text, term) {
  if (!text) return '';
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!term) return escaped;
  var safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp('(' + safeTerm + ')', 'gi'), '<mark>$1</mark>');
}

function _sendContentUpdateButtons() {
  var hasSelection = !!(_sendContentModal && _sendContentModal._selectedChit);
  var copyBtn = document.getElementById('sendContentCopyBtn');
  var moveBtn = document.getElementById('sendContentMoveBtn');
  var nameSpan = document.getElementById('sendContentSelectedName');

  if (copyBtn) copyBtn.disabled = !hasSelection;
  if (moveBtn) moveBtn.disabled = !hasSelection;
  if (nameSpan) {
    nameSpan.textContent = hasSelection
      ? '→ ' + (_sendContentModal._selectedChit.title || '(No Title)')
      : '';
  }
}

/* ── Filter logic ─────────────────────────────────────────────────────────── */

function _sendContentApplyFilters() {
  var searchTerm = (document.getElementById('sendContentSearch')?.value || '').toLowerCase().trim();
  var statusFilter = (document.getElementById('sendContentFilterStatus')?.value || '').toLowerCase();

  var filtered = (_sendContentModal._availableChits || []).filter(function(chit) {
    if (statusFilter && (chit.status || '').toLowerCase() !== statusFilter) return false;
    if (searchTerm && !_sendContentMatchesSearch(chit, searchTerm)) return false;
    return true;
  });

  _sendContentRenderChits(filtered);

  var titleEl = document.getElementById('sendContentModalTitle');
  if (titleEl) {
    var label = _sendContentType === 'notes' ? 'Send Notes To' : 'Send Checklist To';
    titleEl.textContent = label + ' (' + filtered.length + ' shown)';
  }
}

function _sendContentMatchesSearch(chit, term) {
  if ((chit.title || '').toLowerCase().includes(term)) return true;
  if ((chit.status || '').toLowerCase().includes(term)) return true;
  if (term.startsWith('#')) {
    var tagTerm = term.slice(1);
    return (chit.tags || []).some(function(t) {
      return t.toLowerCase().includes(tagTerm) && !t.startsWith('CWOC_System/');
    });
  }
  if ((chit.tags || []).some(function(t) {
    return !t.startsWith('CWOC_System/') && t.toLowerCase().includes(term);
  })) return true;
  return false;
}

/* ── Execute copy or move ─────────────────────────────────────────────────── */

async function _executeSendContent(mode) {
  var targetChit = _sendContentModal._selectedChit;
  if (!targetChit) return;

  _closeSendContentModal();

  try {
    // Fetch the full target chit from the API to get current state
    var resp = await fetch('/api/chit/' + encodeURIComponent(targetChit.id));
    if (!resp.ok) throw new Error('Failed to fetch target chit');
    var fullTarget = await resp.json();

    var undoData = {};

    if (_sendContentType === 'notes') {
      var noteEl = document.getElementById('note');
      var sourceContent = noteEl ? noteEl.value.trim() : '';
      if (!sourceContent) { cwocToast('No notes to send.', 'info'); return; }

      // Save original target notes for undo
      undoData.targetOriginalNote = fullTarget.note || '';
      undoData.sourceOriginalNote = sourceContent;

      // Append to target
      var targetNote = fullTarget.note || '';
      fullTarget.note = targetNote
        ? targetNote + '\n\n' + sourceContent
        : sourceContent;

      // If move, clear source (don't mark editor unsaved — only destination is saved)
      if (mode === 'move') {
        noteEl.value = '';
        autoGrowNote(noteEl);
        // Refresh rendered view if showing
        var rendered = document.getElementById('notes-rendered-output');
        if (rendered && rendered.style.display !== 'none') {
          rendered.innerHTML = '';
        }
      }

    } else if (_sendContentType === 'checklist') {
      var sourceItems = window.checklist ? window.checklist.getChecklistData() : [];
      if (sourceItems.length === 0) { cwocToast('No checklist items to send.', 'info'); return; }

      // Save original target checklist for undo
      undoData.targetOriginalChecklist = fullTarget.checklist || [];
      undoData.sourceOriginalChecklist = JSON.parse(JSON.stringify(sourceItems));

      // Append items to target (generate new IDs to avoid conflicts)
      var targetChecklist = Array.isArray(fullTarget.checklist) ? fullTarget.checklist : [];
      var idMap = {};
      // Normalize levels so the top-level items start at level 0
      var minLevel = sourceItems.reduce(function(min, item) {
        return item.level < min ? item.level : min;
      }, sourceItems[0].level);
      var newItems = sourceItems.map(function(item) {
        var newId = generateUniqueId();
        idMap[item.id] = newId;
        return {
          id: newId,
          text: item.text,
          level: item.level - minLevel,
          checked: item.checked,
          parent: item.parent ? (idMap[item.parent] || null) : null
        };
      });
      fullTarget.checklist = targetChecklist.concat(newItems);

      // If move, clear source checklist (silently — don't trigger autosave or mark unsaved)
      if (mode === 'move') {
        window.checklist.items = [];
        window.checklist.render();
      }
    }

    // Save target chit
    // Remove read-only computed fields before saving
    delete fullTarget.effective_role;
    delete fullTarget.assigned_to_display_name;
    // Re-serialize fields that GET returns as objects but PUT expects as JSON strings
    if (fullTarget.weather_data && typeof fullTarget.weather_data === 'object') {
      fullTarget.weather_data = JSON.stringify(fullTarget.weather_data);
    }
    if (fullTarget.health_data && typeof fullTarget.health_data === 'object') {
      fullTarget.health_data = JSON.stringify(fullTarget.health_data);
    }
    if (fullTarget.email_to && typeof fullTarget.email_to === 'object') {
      fullTarget.email_to = JSON.stringify(fullTarget.email_to);
    }
    if (fullTarget.email_cc && typeof fullTarget.email_cc === 'object') {
      fullTarget.email_cc = JSON.stringify(fullTarget.email_cc);
    }
    if (fullTarget.email_bcc && typeof fullTarget.email_bcc === 'object') {
      fullTarget.email_bcc = JSON.stringify(fullTarget.email_bcc);
    }

    var saveResp = await fetch('/api/chits/' + encodeURIComponent(targetChit.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullTarget)
    });

    if (!saveResp.ok) throw new Error('Failed to save target chit');

    var actionLabel = mode === 'copy' ? 'Copied' : 'Moved';
    var contentLabel = _sendContentType === 'notes' ? 'notes' : 'checklist';
    cwocToast(actionLabel + ' ' + contentLabel + ' to "' + (targetChit.title || 'Untitled') + '"', 'success');

    // Show undo bar
    _showSendContentUndoBar(mode, targetChit, fullTarget, undoData);

  } catch (err) {
    console.error('Error sending content:', err);
    cwocToast('Failed to send content: ' + err.message, 'error');
  }
}

/* ── Undo Bar ─────────────────────────────────────────────────────────────── */

var _sendContentUndoState = null;

function _showSendContentUndoBar(mode, targetChit, savedTarget, undoData) {
  // Remove any existing undo bar
  var existing = document.getElementById('sendContentUndoBar');
  if (existing) {
    if (_sendContentUndoState && _sendContentUndoState.interval) {
      clearInterval(_sendContentUndoState.interval);
    }
    existing.remove();
  }

  var zoneId = _sendContentType === 'notes' ? 'notesSection' : 'checklistSection';
  var zoneHeader = document.getElementById(zoneId)?.querySelector('.zone-header');
  if (!zoneHeader) return;

  var actionLabel = mode === 'copy' ? 'Copied' : 'Moved';
  var contentLabel = _sendContentType === 'notes' ? 'notes' : 'checklist';

  var bar = document.createElement('div');
  bar.id = 'sendContentUndoBar';
  bar.style.cssText = 'display:flex;align-items:center;gap:0.6em;padding:6px 10px;margin:4px 0;background:#fff5e6;border:2px solid #8b5a2b;border-radius:6px;font-size:0.9em;';

  var msg = document.createElement('span');
  msg.style.cssText = 'flex:1;color:#1a1208;';
  msg.textContent = '📤 ' + actionLabel + ' ' + contentLabel + ' → "' + (targetChit.title || 'Untitled') + '"';
  bar.appendChild(msg);

  var undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'zone-button';
  undoBtn.style.cssText = 'padding:3px 10px;font-size:0.85em;cursor:pointer;flex-shrink:0;';
  bar.appendChild(undoBtn);

  var timerOuter = document.createElement('div');
  timerOuter.style.cssText = 'width:60px;height:6px;background:#f5e6cc;border:1px solid #8b4513;border-radius:3px;overflow:hidden;flex-shrink:0;';
  var timerFill = document.createElement('div');
  timerFill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#d4af37,#8b4513);border-radius:2px;';
  timerOuter.appendChild(timerFill);
  bar.appendChild(timerOuter);

  // Insert after zone header
  zoneHeader.insertAdjacentElement('afterend', bar);

  var UNDO_DURATION = 8000;
  var start = Date.now();
  var dismissed = false;

  var interval = setInterval(function() {
    var pct = Math.max(0, 100 - ((Date.now() - start) / UNDO_DURATION) * 100);
    timerFill.style.width = pct + '%';
    if (pct <= 0) {
      clearInterval(interval);
      if (!dismissed) { dismissed = true; bar.remove(); _sendContentUndoState = null; }
    }
  }, 50);

  undoBtn.addEventListener('click', function(ev) {
    ev.stopPropagation();
    if (dismissed) return;
    dismissed = true;
    clearInterval(interval);
    bar.remove();
    _sendContentUndoState = null;
    _undoSendContent(mode, targetChit, undoData);
  });

  _sendContentUndoState = { interval: interval, el: bar };
}

async function _undoSendContent(mode, targetChit, undoData) {
  try {
    // Restore target chit to original state
    var resp = await fetch('/api/chit/' + encodeURIComponent(targetChit.id));
    if (!resp.ok) throw new Error('Failed to fetch target for undo');
    var currentTarget = await resp.json();

    if (_sendContentType === 'notes') {
      currentTarget.note = undoData.targetOriginalNote;

      // If it was a move, restore source notes (silently)
      if (mode === 'move') {
        var noteEl = document.getElementById('note');
        if (noteEl) {
          noteEl.value = undoData.sourceOriginalNote;
          autoGrowNote(noteEl);
          // Refresh rendered view if showing
          var rendered = document.getElementById('notes-rendered-output');
          if (rendered && rendered.style.display !== 'none') {
            if (typeof marked !== 'undefined') {
              rendered.innerHTML = marked.parse(noteEl.value || '');
            } else {
              rendered.innerHTML = '<pre style="white-space:pre-wrap;">' + noteEl.value + '</pre>';
            }
          }
        }
      }
    } else if (_sendContentType === 'checklist') {
      currentTarget.checklist = undoData.targetOriginalChecklist;

      // If it was a move, restore source checklist (silently)
      if (mode === 'move') {
        if (window.checklist) {
          window.checklist.items = undoData.sourceOriginalChecklist.map(function(item) {
            return {
              id: item.id,
              text: item.text || '',
              level: Math.min(item.level || 0, MAX_INDENT_LEVEL),
              checked: !!item.checked,
              parent: item.parent || null
            };
          });
          window.checklist.render();
        }
      }
    }

    // Save restored target
    delete currentTarget.effective_role;
    delete currentTarget.assigned_to_display_name;
    // Re-serialize fields that GET returns as objects but PUT expects as JSON strings
    if (currentTarget.weather_data && typeof currentTarget.weather_data === 'object') {
      currentTarget.weather_data = JSON.stringify(currentTarget.weather_data);
    }
    if (currentTarget.health_data && typeof currentTarget.health_data === 'object') {
      currentTarget.health_data = JSON.stringify(currentTarget.health_data);
    }
    if (currentTarget.email_to && typeof currentTarget.email_to === 'object') {
      currentTarget.email_to = JSON.stringify(currentTarget.email_to);
    }
    if (currentTarget.email_cc && typeof currentTarget.email_cc === 'object') {
      currentTarget.email_cc = JSON.stringify(currentTarget.email_cc);
    }
    if (currentTarget.email_bcc && typeof currentTarget.email_bcc === 'object') {
      currentTarget.email_bcc = JSON.stringify(currentTarget.email_bcc);
    }

    var saveResp = await fetch('/api/chits/' + encodeURIComponent(targetChit.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTarget)
    });

    if (!saveResp.ok) throw new Error('Failed to save undo');
    cwocToast('Undone!', 'success');
  } catch (err) {
    console.error('Error undoing send content:', err);
    cwocToast('Undo failed: ' + err.message, 'error');
  }
}
