// ── Settings: Data Management (Import/Export) ────────────────────────────────
// Export/import chit data, user data, ICS calendars, and login message.
// Extracted from settings.js for modularity.

/**
 * Create a Blob from a data string and trigger a browser download.
 * @param {string} data - The JSON string to download
 * @param {string} filename - The filename for the download
 */
function _triggerJsonDownload(data, filename) {
  var blob = new Blob([data], { type: 'application/json' });
  var a = document.createElement('a');
  var url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export all chit data as a JSON file download.
 */
async function exportChitData() {
  try {
    var response = await fetch('/api/export/chits');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-chits-' + date + '.json');
  } catch (error) {
    console.error('Export chit data failed:', error);
    cwocToast('Export failed: ' + error.message, 'error');
  }
}

/**
 * Export all user data (settings + contacts) as a JSON file download.
 */
async function exportUserData() {
  try {
    var response = await fetch('/api/export/userdata');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-userdata-' + date + '.json');
  } catch (error) {
    console.error('Export user data failed:', error);
    cwocToast('Export failed: ' + error.message, 'error');
  }
}

/**
 * Show the import mode dialog (Add / Replace choice).
 */
function _showImportModeDialog(type, fileData) {
  var modal = document.getElementById('import-mode-modal');
  var addBtn = document.getElementById('import-mode-add-btn');
  var replaceBtn = document.getElementById('import-mode-replace-btn');
  var cancelBtn = document.getElementById('import-mode-cancel-btn');

  function cleanup() {
    modal.style.display = 'none';
    addBtn.removeEventListener('click', onAdd);
    replaceBtn.removeEventListener('click', onReplace);
    cancelBtn.removeEventListener('click', onCancel);
  }

  function onAdd() {
    cleanup();
    _doImport(type, 'add', fileData);
  }

  function onReplace() {
    cleanup();
    _showReplaceConfirmDialog(type, function() {
      _doImport(type, 'replace', fileData);
    });
  }

  function onCancel() {
    cleanup();
  }

  addBtn.addEventListener('click', onAdd);
  replaceBtn.addEventListener('click', onReplace);
  cancelBtn.addEventListener('click', onCancel);
  modal.style.display = 'flex';
}

/**
 * Show the replace confirmation dialog with type-specific warning text.
 */
function _showReplaceConfirmDialog(type, onConfirm) {
  var typeLabels = { chits: 'CHIT', userdata: 'USER', all: 'ALL' };
  var typeLabel = typeLabels[type] || type.toUpperCase();

  cwocConfirm('This will permanently replace all ' + typeLabel + ' data with the imported file. This cannot be undone.', {
    title: '⚠️ Replace ' + typeLabel + ' Data?',
    confirmLabel: '🔄 Replace',
    cancelLabel: 'Cancel',
    danger: true,
  }).then(function(first) {
    if (!first) return;
    cwocConfirm('Are you REALLY sure you want to nuke ALL ' + typeLabel + ' data and replace it?', {
      title: '🚨 Final Confirmation',
      confirmLabel: '🗑️ Yes, Replace Everything',
      cancelLabel: 'No, Cancel',
      danger: true,
    }).then(function(second) {
      if (second) onConfirm();
    });
  });
}

/**
 * Perform the actual import POST request.
 */
async function _doImport(type, mode, fileData) {
  var endpoint = '/api/import/' + (type === 'chits' ? 'chits' : type === 'userdata' ? 'userdata' : 'all');
  try {
    var response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, data: fileData })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var result = await response.json();
    var summary = result.summary || {};

    var msg;
    if (type === 'chits') {
      msg = 'Imported ' + (summary.imported || 0) + ' chits';
    } else if (type === 'all') {
      msg = 'Imported ' + (summary.chits_imported || 0) + ' chits, ' +
            (summary.settings_imported || 0) + ' settings, ' +
            (summary.contacts_imported || 0) + ' contacts, ' +
            (summary.alerts_imported || 0) + ' alerts';
    } else {
      if (mode === 'add') {
        msg = 'Added ' + (summary.contacts_added || 0) + ' contacts, merged ' + (summary.settings_merged || 0) + ' settings';
      } else {
        msg = 'Replaced ' + (summary.settings_replaced || 0) + ' settings, ' + (summary.contacts_replaced || 0) + ' contacts';
      }
    }
    cwocToast(msg, 'success');

    _invalidateSettingsCache();

    if ((type === 'userdata' || type === 'all') && mode === 'replace') {
      if (window.settingsManager) {
        window.settingsManager.initialize();
      }
    }
  } catch (error) {
    console.error('Import failed:', error);
    cwocToast('Import failed: ' + error.message, 'error');
  }
}

/**
 * Import chit data: open file picker, read JSON, validate, show mode dialog.
 */
function importChitData() {
  var fileInput = document.getElementById('importChitFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        cwocToast('Invalid file: could not parse JSON', 'error');
        return;
      }
      if (!parsed || parsed.type !== 'chits') {
        cwocToast('Invalid file: expected a CWOC chit data export', 'error');
        return;
      }
      _showImportModeDialog('chits', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import user data: open file picker, read JSON, validate, show mode dialog.
 */
function importUserData() {
  var fileInput = document.getElementById('importUserFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        cwocToast('Invalid file: could not parse JSON', 'error');
        return;
      }
      if (!parsed || parsed.type !== 'userdata') {
        cwocToast('Invalid file: expected a CWOC user data export', 'error');
        return;
      }
      _showImportModeDialog('userdata', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import Calendar (.ics): open file picker, read ICS text, POST to /api/import/ics.
 */
function triggerIcsImport() {
  var fileInput = document.getElementById('icsImportFile');
  var btn = document.getElementById('icsImportBtn');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function(e) {
      var icsContent = e.target.result;
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Importing…';

      try {
        var payload = { ics_content: icsContent };
        // If admin has selected a target user, include it
        var ownerSelect = document.getElementById('ics-import-owner');
        if (ownerSelect && ownerSelect.value) {
          payload.target_user_id = ownerSelect.value;
        }

        var response = await fetch('/api/import/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          var errData = await response.json().catch(function() { return {}; });
          throw new Error(errData.detail || response.statusText);
        }

        var result = await response.json();
        var msg = 'Imported ' + result.imported + ' events';
        if (result.skipped > 0) msg += ', skipped ' + result.skipped + ' duplicates';
        if (result.errors && result.errors.length > 0) msg += ', ' + result.errors.length + ' errors';
        cwocToast(msg, 'success');
        loadImportBatches();
      } catch (error) {
        console.error('ICS import failed:', error);
        cwocToast('Import failed: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import Google Tasks (.json): open file picker, read JSON, POST to /api/import/google-tasks.
 */
function triggerGoogleTasksImport() {
  var fileInput = document.getElementById('googleTasksImportFile');
  var btn = document.getElementById('googleTasksImportBtn');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function(e) {
      var jsonContent = e.target.result;
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Importing…';

      try {
        var payload = { json_content: jsonContent };
        // If admin has selected a target user, include it
        var ownerSelect = document.getElementById('ics-import-owner');
        if (ownerSelect && ownerSelect.value) {
          payload.target_user_id = ownerSelect.value;
        }

        var response = await fetch('/api/import/google-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          var errData = await response.json().catch(function() { return {}; });
          throw new Error(errData.detail || response.statusText);
        }

        var result = await response.json();
        var msg = 'Imported ' + result.imported + ' tasks';
        if (result.list_name) msg += ' from "' + result.list_name + '"';
        if (result.skipped > 0) msg += ', skipped ' + result.skipped + ' duplicates';
        if (result.errors && result.errors.length > 0) msg += ', ' + result.errors.length + ' errors';
        cwocToast(msg, 'success');
        loadImportBatches();
      } catch (error) {
        console.error('Google Tasks import failed:', error);
        cwocToast('Import failed: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import Google Keep (.json): open multi-file picker, read all JSON files,
 * POST array of note objects to /api/import/google-keep.
 */
function triggerGoogleKeepImport() {
  var fileInput = document.getElementById('googleKeepImportFile');
  var btn = document.getElementById('googleKeepImportBtn');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var files = fileInput.files;
    if (!files || files.length === 0) return;

    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = 'Reading files…';

    var notes = [];
    var filesRead = 0;
    var totalFiles = files.length;

    for (var i = 0; i < totalFiles; i++) {
      (function(file) {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var parsed = JSON.parse(e.target.result);
            notes.push(parsed);
          } catch (err) {
            // Skip non-JSON files silently
          }
          filesRead++;
          if (filesRead === totalFiles) {
            _sendKeepImport(notes, btn, originalText);
          }
        };
        reader.onerror = function() {
          filesRead++;
          if (filesRead === totalFiles) {
            _sendKeepImport(notes, btn, originalText);
          }
        };
        reader.readAsText(file);
      })(files[i]);
    }
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Send parsed Keep notes to the backend.
 */
async function _sendKeepImport(notes, btn, originalText) {
  if (notes.length === 0) {
    btn.disabled = false;
    btn.textContent = originalText;
    cwocToast('No valid JSON files found', 'error');
    return;
  }

  btn.textContent = 'Importing ' + notes.length + ' notes…';

  try {
    var payload = { notes: notes };
    var ownerSelect = document.getElementById('ics-import-owner');
    if (ownerSelect && ownerSelect.value) {
      payload.target_user_id = ownerSelect.value;
    }

    var response = await fetch('/api/import/google-keep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      throw new Error(errData.detail || response.statusText);
    }

    var result = await response.json();
    var msg = 'Imported ' + result.imported + ' notes from Google Keep';
    if (result.skipped > 0) msg += ', skipped ' + result.skipped + ' duplicates';
    if (result.errors && result.errors.length > 0) msg += ', ' + result.errors.length + ' errors';
    cwocToast(msg, 'success');
    loadImportBatches();
  } catch (error) {
    console.error('Google Keep import failed:', error);
    cwocToast('Import failed: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Export ALL data (chits + settings + contacts + alerts) as a single JSON file.
 */
async function exportAllData() {
  try {
    var response = await fetch('/api/export/all');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-all-' + date + '.json');
  } catch (error) {
    console.error('Export all data failed:', error);
    cwocToast('Export failed: ' + error.message, 'error');
  }
}

/**
 * Import ALL data: open file picker, read JSON, validate, show mode dialog.
 */
function importAllData() {
  var fileInput = document.getElementById('importAllFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        cwocToast('Invalid file: could not parse JSON', 'error');
        return;
      }
      if (!parsed || parsed.type !== 'all') {
        cwocToast('Invalid file: expected a CWOC combined data export. For chit-only or user-only exports, use the specific import buttons.', 'error');
        return;
      }
      _showImportModeDialog('all', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

// ── Login Welcome Message (admin) ────────────────────────────────────────────

/**
 * Save the login welcome message to the server.
 */
async function _saveLoginMessage() {
  var ta = document.getElementById('login-message-input');
  if (!ta) return;
  try {
    var response = await fetch('/api/auth/login-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ta.value })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    cwocToast('Login message saved.', 'success');
  } catch (error) {
    console.error('Save login message failed:', error);
    cwocToast('Failed to save login message: ' + error.message, 'error');
  }
}

// ── Calendar Export Help Modal ───────────────────────────────────────────────

/**
 * Show the calendar export instructions modal.
 */
function showCalendarExportHelp() {
  var modal = document.getElementById('calendar-export-help-modal');
  if (modal) modal.style.display = 'flex';
}

/**
 * Close the calendar export instructions modal.
 */
function closeCalendarExportHelp() {
  var modal = document.getElementById('calendar-export-help-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * Switch between Google/Apple/Outlook tabs in the export help modal.
 */
function switchCalExportTab(tab) {
  // Update tab buttons
  var tabs = document.querySelectorAll('.cal-export-tab');
  tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tab); });
  // Show/hide panels
  var panels = document.querySelectorAll('.cal-export-panel');
  panels.forEach(function(p) { p.style.display = 'none'; });
  var target = document.getElementById('cal-export-' + tab);
  if (target) target.style.display = 'block';
}


// ── Import Batch Management ─────────────────────────────────────────────────

/**
 * Populate the ICS import owner picker with all users (admin only).
 * Defaults to the current logged-in user.
 */
async function loadIcsImportOwnerPicker() {
  var select = document.getElementById('ics-import-owner');
  if (!select) return;

  try {
    var response = await fetch('/api/users');
    if (!response.ok) return;

    var users = await response.json();
    select.innerHTML = '';

    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentId = currentUser ? currentUser.id : '';

    users.forEach(function(user) {
      if (user.deactivated) return;
      var opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.display_name || user.username;
      if (user.id === currentId) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Failed to load users for ICS import picker:', error);
  }
}

/**
 * Load and display ICS import batches.
 * Shows the section only if there are batches to display.
 */
async function loadImportBatches() {
  var section = document.getElementById('import-batches-section');
  var list = document.getElementById('import-batches-list');
  if (!section || !list) return;

  try {
    var response = await fetch('/api/import/ics/batches');
    if (!response.ok) return;

    var data = await response.json();
    var batches = data.batches || [];

    if (batches.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    list.innerHTML = '';

    batches.forEach(function(batch) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #e0d5c8;';

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var ownerHtml = (batch.owners && batch.owners.length) ?
        '<span style="color:#5a4025;font-size:0.85em;margin-left:8px;">👤 ' + _escHtml(batch.owners.join(', ')) + '</span>' : '';
      info.innerHTML = '<strong style="color:#3d2b1f;">' + _escHtml(batch.calendar_name) + '</strong>' +
        '<span style="color:#6b4e31;font-size:0.9em;margin-left:8px;">' + _escHtml(batch.date) + '</span>' +
        '<span style="color:#8b7355;font-size:0.85em;margin-left:8px;">(' + batch.count + ' chit' + (batch.count !== 1 ? 's' : '') + ')</span>' +
        ownerHtml;

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'standard-button';
      deleteBtn.style.cssText = 'padding:4px 10px;font-size:0.85em;white-space:nowrap;';
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.onclick = function() { _deleteImportBatch(batch); };

      row.appendChild(info);
      row.appendChild(deleteBtn);
      list.appendChild(row);
    });
  } catch (error) {
    console.error('Failed to load import batches:', error);
  }
}

/**
 * Escape HTML for safe insertion.
 */
function _escHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Delete an import batch after confirmation.
 */
function _deleteImportBatch(batch) {
  var label = batch.calendar_name + ' (' + batch.date + ', ' + batch.count + ' chits)';
  cwocConfirm('This will send all ' + batch.count + ' chits from "' + batch.calendar_name + '" (imported ' + batch.date + ') to the trash.', {
    title: '🗑️ Delete Import Batch?',
    confirmLabel: '🗑️ Delete Batch',
    cancelLabel: 'Cancel',
    danger: true,
  }).then(function(confirmed) {
    if (!confirmed) return;

    fetch('/api/import/ics/batches/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: batch.tag }),
    }).then(function(response) {
      if (!response.ok) {
        return response.json().then(function(err) { throw new Error(err.detail || 'Failed'); });
      }
      return response.json();
    }).then(function(result) {
      cwocToast('Deleted ' + result.deleted + ' chits from "' + batch.calendar_name + '"', 'success');
      loadImportBatches();
    }).catch(function(error) {
      console.error('Batch delete failed:', error);
      cwocToast('Delete failed: ' + error.message, 'error');
    });
  });
}
