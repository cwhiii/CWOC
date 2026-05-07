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
        var response = await fetch('/api/import/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ics_content: icsContent }),
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
