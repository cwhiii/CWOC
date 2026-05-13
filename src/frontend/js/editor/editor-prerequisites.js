/**
 * editor-prerequisites.js — Prerequisites picker for the chit editor.
 *
 * Uses the shared cwocChitPickerModal (same UI as "Add Child Chits" in Projects)
 * with multi-select checkmarks. Shows selected prerequisites as a colored list
 * with inline-editable status. Handles circular dependency detection and auto-blocking.
 *
 * Globals used: window.currentChitId, setSaveButtonUnsaved, cwocToast, cwocConfirm,
 *               cwocChitPickerModal (from shared-utils.js)
 */

// ── State ─────────────────────────────────────────────────────────────────────

/** Currently selected prerequisite IDs */
var _prereqSelectedIds = [];

/** Cached chit data for rendering the list */
var _prereqChitCache = {};

/** Whether the current chit was auto-blocked by prerequisites */
window._prereqAutoBlocked = false;

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Load prerequisites from a chit object into the UI.
 * Called from editor-init.js after chit data is loaded.
 */
function initPrerequisites(chit) {
  _prereqSelectedIds = Array.isArray(chit.prerequisites) ? [...chit.prerequisites] : [];
  _prereqChitCache = {};
  _renderPrereqList();
}

/**
 * Get the current prerequisites array for saving.
 */
function getPrerequisitesData() {
  return _prereqSelectedIds.length > 0 ? [..._prereqSelectedIds] : null;
}

/**
 * Check if all prerequisites are Complete.
 * Returns true if there are no prerequisites or all are Complete.
 */
function _prereqAllComplete() {
  if (_prereqSelectedIds.length === 0) return true;
  for (var i = 0; i < _prereqSelectedIds.length; i++) {
    var chit = _prereqChitCache[_prereqSelectedIds[i]];
    if (!chit || chit.status !== 'Complete') return false;
  }
  return true;
}

// ── Render Selected List ──────────────────────────────────────────────────────

/**
 * Render the selected prerequisites list below the add button.
 * Each item shows the chit's color as full background, title, inline status dropdown, and remove button.
 */
function _renderPrereqList() {
  var container = document.getElementById('prereqListContainer');
  if (!container) return;

  if (_prereqSelectedIds.length === 0) {
    container.innerHTML = '';
    return;
  }

  // If cache is empty, fetch chit data first
  var needsFetch = false;
  for (var i = 0; i < _prereqSelectedIds.length; i++) {
    if (!_prereqChitCache[_prereqSelectedIds[i]]) { needsFetch = true; break; }
  }
  if (needsFetch) {
    fetch('/api/chits').then(function(r) { return r.ok ? r.json() : []; }).then(function(allChits) {
      allChits.forEach(function(c) { _prereqChitCache[c.id] = c; });
      _renderPrereqList();
    });
    container.innerHTML = '<span style="color:#8b7355;font-style:italic;font-size:0.9em;">Loading…</span>';
    return;
  }

  var html = '';
  _prereqSelectedIds.forEach(function(id) {
    var chit = _prereqChitCache[id];
    var title = chit ? (chit.title || '(untitled)') : '(deleted)';
    var bgColor = chit && chit.color && chit.color !== 'transparent' ? chit.color : '#e8dcc8';
    var textColor = _prereqContrastColor(bgColor);
    var status = chit ? (chit.status || '') : '';

    html += '<div class="prereq-item" style="background:' + _prereqEsc(bgColor) + ';color:' + textColor + ';" ondblclick="_openPrereqChit(\'' + _prereqEsc(id) + '\')" title="Double-click to open">';
    html += '<span class="prereq-item-title">' + _prereqEsc(title) + '</span>';
    html += '<select class="prereq-item-status-select" data-prereq-id="' + _prereqEsc(id) + '" onchange="_onPrereqStatusChange(this)" style="color:' + textColor + ';">';
    html += '<option value=""' + (!status ? ' selected' : '') + '>—</option>';
    html += '<option value="ToDo"' + (status === 'ToDo' ? ' selected' : '') + '>ToDo</option>';
    html += '<option value="In Progress"' + (status === 'In Progress' ? ' selected' : '') + '>In Progress</option>';
    html += '<option value="Blocked"' + (status === 'Blocked' ? ' selected' : '') + '>Blocked</option>';
    html += '<option value="Complete"' + (status === 'Complete' ? ' selected' : '') + '>Complete</option>';
    html += '</select>';
    html += '<button type="button" class="prereq-remove-btn" onclick="_removePrereq(\'' + _prereqEsc(id) + '\')" title="Remove prerequisite" style="color:' + textColor + ';">';
    html += '<i class="fas fa-times"></i></button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

// ── Open Picker (uses shared cwocChitPickerModal) ─────────────────────────────

/**
 * Open the shared chit picker modal for selecting prerequisites.
 */
function openPrereqPicker() {
  var currentId = window.currentChitId || '';

  cwocChitPickerModal({
    title: 'Select Prerequisites',
    confirmLabel: 'Add Selected',
    preSelectedIds: new Set(),
    disabledIds: new Set(_prereqSelectedIds),
    filterChits: function(c) {
      // Exclude current chit and project masters
      return c.id !== currentId && !c.is_project_master;
    },
    beforeSelect: async function(chitId) {
      // Circular dependency check
      if (currentId) {
        try {
          var resp = await fetch('/api/chits/check-prerequisites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chit_id: currentId, prerequisite_id: chitId })
          });
          var result = await resp.json();
          if (result.circular) {
            cwocToast('Cannot add: would create a circular dependency.', 'error');
            return false;
          }
        } catch (e) {
          console.error('[Prerequisites] Circular check failed:', e);
        }
      }
      return true;
    },
    onConfirm: function(selectedChits) {
      // Warn about chits without status
      var noStatusChits = selectedChits.filter(function(c) { return !c.status; });
      if (noStatusChits.length > 0) {
        var names = noStatusChits.map(function(c) { return '"' + (c.title || '(untitled)') + '"'; }).join(', ');
        cwocToast(noStatusChits.length + ' chit(s) have no status and can never unblock: ' + names, 'warning');
      }

      // Add to selection
      selectedChits.forEach(function(c) {
        if (_prereqSelectedIds.indexOf(c.id) === -1) {
          _prereqSelectedIds.push(c.id);
          _prereqChitCache[c.id] = c;
        }
      });

      setSaveButtonUnsaved();
      _renderPrereqList();
      _checkPrereqAutoBlock();
      // Re-evaluate auto-complete since prereqs were added
      if (typeof _evaluateAutoCompleteChecklist === 'function') _evaluateAutoCompleteChecklist();
    }
  });
}

// ── Inline Status Change ──────────────────────────────────────────────────────

/**
 * Handle inline status change on a prerequisite item.
 * Patches the prerequisite chit's status directly via the API.
 */
async function _onPrereqStatusChange(selectEl) {
  var prereqId = selectEl.getAttribute('data-prereq-id');
  var newStatus = selectEl.value || null;

  try {
    var resp = await fetch('/api/chits/' + prereqId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!resp.ok) throw new Error('Failed to update');

    // Update cache
    if (_prereqChitCache[prereqId]) _prereqChitCache[prereqId].status = newStatus;

    cwocToast('Prerequisite status updated.', 'info');
    _checkPrereqAutoBlock();
    // Re-evaluate auto-complete since prereq status changed
    if (typeof _evaluateAutoCompleteChecklist === 'function') _evaluateAutoCompleteChecklist();
  } catch (e) {
    console.error('[Prerequisites] Status update failed:', e);
    cwocToast('Failed to update prerequisite status.', 'error');
  }
}

// ── Remove ────────────────────────────────────────────────────────────────────

function _removePrereq(id) {
  _prereqSelectedIds = _prereqSelectedIds.filter(function(pid) { return pid !== id; });
  setSaveButtonUnsaved();
  _renderPrereqList();
  _checkPrereqAutoBlock();
  // Re-evaluate auto-complete since prereq was removed
  if (typeof _evaluateAutoCompleteChecklist === 'function') _evaluateAutoCompleteChecklist();
}

// ── Auto-block Logic ──────────────────────────────────────────────────────────

function _checkPrereqAutoBlock() {
  var statusEl = document.getElementById('status');
  if (!statusEl) return;

  if (_prereqSelectedIds.length === 0) {
    if (statusEl.value === 'Blocked' && window._prereqAutoBlocked) {
      statusEl.value = 'ToDo';
      window._prereqAutoBlocked = false;
      cwocToast('Prerequisites cleared — status set to To Do.', 'info');
      setSaveButtonUnsaved();
    }
    return;
  }

  // Check if all prerequisites are complete
  var allComplete = true;
  for (var i = 0; i < _prereqSelectedIds.length; i++) {
    var prereq = _prereqChitCache[_prereqSelectedIds[i]];
    if (!prereq || prereq.status !== 'Complete') {
      allComplete = false;
      break;
    }
  }

  if (!allComplete) {
    if (statusEl.value !== 'Blocked') {
      statusEl.value = 'Blocked';
      window._prereqAutoBlocked = true;
      cwocToast('Status set to Blocked — prerequisites incomplete.', 'info');
      setSaveButtonUnsaved();
    }
  } else {
    if (statusEl.value === 'Blocked' && window._prereqAutoBlocked) {
      statusEl.value = 'ToDo';
      window._prereqAutoBlocked = false;
      cwocToast('All prerequisites complete — status set to To Do.', 'info');
      setSaveButtonUnsaved();
    }
  }
}

// ── Status Change Override Warning ────────────────────────────────────────────

/**
 * Called from onStatusChange() to warn when manually overriding a prereq-blocked status.
 */
async function checkPrereqStatusOverride(newStatus) {
  if (_prereqSelectedIds.length === 0) return true;
  if (newStatus === 'Blocked') return true;

  // Check if any prereqs are incomplete
  var hasIncomplete = false;
  for (var i = 0; i < _prereqSelectedIds.length; i++) {
    var prereq = _prereqChitCache[_prereqSelectedIds[i]];
    if (!prereq || prereq.status !== 'Complete') {
      hasIncomplete = true;
      break;
    }
  }

  if (!hasIncomplete) return true;

  var ok = await cwocConfirm(
    'This chit has incomplete prerequisites. Changing status away from "Blocked" may cause inconsistency.\n\nProceed anyway?',
    { title: 'Override Prerequisites', confirmLabel: 'Override', danger: true }
  );
  if (ok) window._prereqAutoBlocked = false;
  return ok;
}

// ── Navigation ────────────────────────────────────────────────────────────────

/**
 * Double-click a prerequisite item to open it in the editor.
 * Shows the standard Save & Go / Discard & Go / Cancel dialog if unsaved changes exist.
 */
function _openPrereqChit(chitId) {
  if (!chitId) return;
  var url = '/frontend/html/editor.html?id=' + encodeURIComponent(chitId);

  if (window._cwocSave && window._cwocSave.hasChanges()) {
    var existing = document.getElementById('cwoc-unsaved-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'cwoc-unsaved-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML =
      '<div class="modal-content">' +
        '<h3>Unsaved Changes</h3>' +
        '<p>You have unsaved changes. What would you like to do?</p>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">' +
          '<button class="standard-button" id="cwoc-stay-here">Cancel</button>' +
          '<button class="standard-button" id="cwoc-save-exit">💾 Save &amp; Go</button>' +
          '<button class="standard-button" id="cwoc-confirm-exit" style="background:#a0522d;color:#fdf5e6;">🗑️ Discard</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('cwoc-stay-here').onclick = function() { modal.remove(); };
    document.getElementById('cwoc-save-exit').onclick = function() {
      modal.remove();
      saveChitData().then(function(success) {
        if (success !== false) {
          window._cwocSkipBeforeUnload = true;
          window.location.href = url;
        }
      });
    };
    document.getElementById('cwoc-confirm-exit').onclick = function() {
      if (typeof _cancelServerTimersForChit === 'function') _cancelServerTimersForChit();
      window._cwocSkipBeforeUnload = true;
      window.location.href = url;
    };
    var _onKey = function(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', _onKey); } };
    document.addEventListener('keydown', _onKey);
  } else {
    window.location.href = url;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _prereqEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _prereqContrastColor(hex) {
  if (!hex || hex === 'transparent') return '#1a1208';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1208' : '#fffaf0';
}
