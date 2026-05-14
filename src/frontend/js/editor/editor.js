/**
 * editor.js — Coordinator for the chit editor page
 *
 * This file is the minimal coordinator that loads AFTER all editor sub-scripts.
 * It holds shared editor state variables that multiple sub-scripts reference,
 * plus a few small utility functions that don't belong in any specific zone.
 *
 * Sub-scripts (loaded before this file):
 *   editor-dates.js    — Date mode, recurrence, time picker
 *   editor-tags.js     — Tag tree, search, selection
 *   editor-people.js   — People zone, contact chips, grouped tree
 *   editor-location.js — Location, weather, map, saved locations
 *   editor-notes.js    — Notes zone, markdown render, chit linking
 *   editor-alerts.js   — Alarms, timers, stopwatches, notifications
 *   editor-color.js    — Color swatches, custom colors, background tinting
 *   editor-health.js   — Health indicators
 *   editor-save.js     — Build chit, save, delete, pin, archive, QR
 *   editor-init.js     — Initialization, zone management, DOMContentLoaded
 *
 * Depends on: shared.js, shared-page.js, shared-editor.js,
 *             editor_checklists.js, editor_projects.js
 */

// ── Shared editor state variables ────────────────────────────────────────────
// These are referenced by multiple sub-scripts and must be defined before
// any sub-script code runs. Since this coordinator loads LAST, the sub-scripts
// declare these as needed. The variables below serve as documentation of the
// shared state contract.

// chitId — current chit ID (set by _initializeChitId in editor-init.js)
// Using var so it's globally accessible across all script tags
var chitId = null;

// Weather state — set by editor-location.js, read by editor-save.js
var currentWeatherLat = null;
var currentWeatherLon = null;
var currentWeatherData = null;

// weatherIcons — now in shared-utils.js as _cwocWeatherIcons
var weatherIcons = _cwocWeatherIcons;

// WMO weather code descriptions
const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// Default color palette — references shared _cwocDefaultColors from shared-utils.js
// Adds "Transparent" as the first option (editor-specific, not in shared palette)
const defaultColors = [
  { hex: "transparent", name: "Transparent" },
  ...(_cwocDefaultColors || [])
];

// ── Small shared utilities ───────────────────────────────────────────────────

const checklistContainer = document.getElementById("checklist-container");

function _onChecklistChange() {
  if (_isChecklistAutosaveActive() && window.currentChitId && !window.isNewChit) {
    // Auto-save handles it
    _checklistAutosave();
  } else {
    // No autosave — use normal unsaved flow so save/discard/cancel works
    setSaveButtonUnsaved();
  }
  // Evaluate auto-complete status toggle
  _evaluateAutoCompleteChecklist();
}

/* ── Checklist Auto-Save ──────────────────────────────────────────────────── */

var _checklistAutosaveTimer = null;
var _checklistAutosaveEnabled = true; // global default, overridden by settings
var _checklistAutosaveChitOverride = null; // per-chit: null=use global, true/false=override

/**
 * Determine if checklist autosave is active for the current chit.
 */
function _isChecklistAutosaveActive() {
  if (_checklistAutosaveChitOverride !== null) return _checklistAutosaveChitOverride;
  return _checklistAutosaveEnabled;
}

/**
 * Debounced auto-save of checklist data only.
 * Waits 2s after last change before saving.
 */
function _checklistAutosave() {
  if (!_isChecklistAutosaveActive()) return;
  if (!window.currentChitId || window.isNewChit) return; // can't autosave a new chit

  if (_checklistAutosaveTimer) clearTimeout(_checklistAutosaveTimer);
  _showChecklistPending();
  _checklistAutosaveTimer = setTimeout(function() {
    _doChecklistAutosave();
  }, 2000);
}

/**
 * Perform the actual checklist-only save via PATCH.
 */
async function _doChecklistAutosave() {
  if (!window.currentChitId || window.isNewChit) return;
  var checklistData = window.checklist ? window.checklist.getChecklistData() : [];
  try {
    var resp = await fetch('/api/chits/' + window.currentChitId + '/checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: checklistData })
    });
    if (resp.ok) {
      _flashChecklistSaved();
    } else {
      // Auto-save failed — fall back to marking unsaved so user can manual-save
      console.error('[checklistAutosave] Failed:', resp.status);
      setSaveButtonUnsaved();
    }
  } catch (e) {
    console.error('[checklistAutosave] Error:', e);
    setSaveButtonUnsaved();
  }
}

/**
 * Brief visual feedback that checklist was auto-saved.
 */
function _flashChecklistSaved() {
  _hideChecklistPending();
  var indicator = document.getElementById('checklist-autosave-indicator');
  if (!indicator) {
    var header = document.getElementById('checklistSection')?.querySelector('.zone-header');
    if (!header) return;
    var zoneActions = header.querySelector('.zone-actions');
    if (!zoneActions) return;
    indicator = document.createElement('span');
    indicator.id = 'checklist-autosave-indicator';
    indicator.style.cssText = 'font-size:0.75em;color:#008080;opacity:0;transition:opacity 0.3s;margin-right:1em;';
    indicator.textContent = '✓ saved';
    // Insert before the undo button (first .notes-undo-redo in zone-actions)
    var undoBtn = zoneActions.querySelector('.notes-undo-redo');
    if (undoBtn) {
      zoneActions.insertBefore(indicator, undoBtn);
    } else {
      zoneActions.appendChild(indicator);
    }
  }
  indicator.style.opacity = '1';
  setTimeout(function() { indicator.style.opacity = '0'; }, 2000);
}

/**
 * Show "changes pending" yellow text in the checklist zone header.
 * Appears immediately when changes are made, before autosave fires.
 */
function _showChecklistPending() {
  var pending = document.getElementById('checklist-pending-indicator');
  if (!pending) {
    var header = document.getElementById('checklistSection')?.querySelector('.zone-header');
    if (!header) return;
    var zoneActions = header.querySelector('.zone-actions');
    if (!zoneActions) return;
    pending = document.createElement('span');
    pending.id = 'checklist-pending-indicator';
    pending.style.cssText = 'font-size:0.75em;color:#b8860b;margin-right:1em;';
    pending.textContent = 'changes pending';
    // Insert before the undo button
    var undoBtn = zoneActions.querySelector('.notes-undo-redo');
    if (undoBtn) {
      zoneActions.insertBefore(pending, undoBtn);
    } else {
      zoneActions.appendChild(pending);
    }
  }
  pending.style.display = '';
}

/**
 * Hide the "changes pending" indicator (called after successful save).
 */
function _hideChecklistPending() {
  var pending = document.getElementById('checklist-pending-indicator');
  if (pending) pending.style.display = 'none';
}

/**
 * Load the global checklist autosave setting from user settings.
 */
async function _loadChecklistAutosaveSetting() {
  try {
    var s = await getCachedSettings();
    var co = s.chit_options || {};
    _checklistAutosaveEnabled = (s.checklist_autosave !== '0' && co.checklist_autosave !== false);
  } catch (e) { /* keep default (true) */ }
}

/**
 * Toggle the per-chit checklist autosave override.
 * Cycles: null (use global) → true (force on) → false (force off) → null
 */
function _toggleChecklistAutosaveChit(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  if (_checklistAutosaveChitOverride === null) {
    _checklistAutosaveChitOverride = !_checklistAutosaveEnabled; // flip from global
  } else {
    _checklistAutosaveChitOverride = null; // back to global
  }
  _updateChecklistAutosaveToggle();
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/**
 * Update the autosave toggle button text in the checklist zone header.
 */
function _updateChecklistAutosaveToggle() {
  var btn = document.getElementById('checklistAutosaveBtn');
  if (!btn) return;
  var active = _isChecklistAutosaveActive();
  var isOverride = _checklistAutosaveChitOverride !== null;
  if (active) {
    btn.innerHTML = '<i class="fas fa-bolt"></i> Auto-save: On' + (isOverride ? ' (chit)' : '');
    btn.title = 'Auto-save on — click to toggle';
    btn.style.opacity = '';
  } else {
    btn.innerHTML = '<i class="fas fa-ban"></i> Auto-save: Off' + (isOverride ? ' (chit)' : '');
    btn.title = 'Auto-save off — click to toggle';
    btn.style.opacity = '0.6';
  }
}

var dragIndicator = null;
var healthIndicatorWarningsShown = new Set();

/* ── Auto-Complete Checklist ──────────────────────────────────────────────── */

var _autoCompleteChecklistEnabled = false; // per-chit flag

/**
 * Initialize the auto-complete checklist button.
 * Shows only when the chit is a child of a project.
 */
function _initAutoCompleteChecklist(chit) {
  var btn = document.getElementById('autoCompleteChecklistBtn');
  if (!btn) return;

  // Determine if enabled from chit data
  // Default to true when in a project (null/undefined means not explicitly set)
  if (chit && (chit.auto_complete_checklist === false || chit.auto_complete_checklist === 'false' || chit.auto_complete_checklist === '0' || chit.auto_complete_checklist === 0)) {
    _autoCompleteChecklistEnabled = false;
  } else {
    // Default to true (covers: true, null, undefined — i.e. new chits in a project)
    _autoCompleteChecklistEnabled = true;
  }

  _updateAutoCompleteBtn();

  // Wire up click handler (only once)
  if (!btn._acWired) {
    btn._acWired = true;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      _autoCompleteChecklistEnabled = !_autoCompleteChecklistEnabled;
      _updateAutoCompleteBtn();
      if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
      // If just enabled, run the check immediately
      if (_autoCompleteChecklistEnabled) {
        _evaluateAutoCompleteChecklist();
      }
    });
  }
}

/**
 * Show/hide the auto-complete button. Always visible (no longer restricted to project children).
 */
function _showAutoCompleteBtnIfChild() {
  var btn = document.getElementById('autoCompleteChecklistBtn');
  if (!btn) return;
  btn.style.display = 'inline-flex';
}

/**
 * Update the auto-complete button visual state.
 */
function _updateAutoCompleteBtn() {
  var btn = document.getElementById('autoCompleteChecklistBtn');
  if (!btn) return;
  if (_autoCompleteChecklistEnabled) {
    btn.classList.add('zone-button-active');
    btn.style.opacity = '';
    btn.innerHTML = '<i class="fas fa-check-double"></i> <span class="hideWhenNarrow">Auto-Complete:</span> On';
  } else {
    btn.classList.remove('zone-button-active');
    btn.style.opacity = '0.6';
    btn.innerHTML = '<i class="fas fa-check-double"></i> <span class="hideWhenNarrow">Auto-Complete</span>';
  }
}

/**
 * Evaluate checklist state and auto-set status if auto-complete is enabled.
 * Called on every checklist change. Also checks prerequisites.
 */
function _evaluateAutoCompleteChecklist() {
  if (!_autoCompleteChecklistEnabled) return;
  if (!window.checklist) return;

  var items = window.checklist.getChecklistData();
  // Only consider non-blank items (items with text)
  var nonBlank = items.filter(function(item) { return item.text && item.text.trim() !== ''; });

  // Check prerequisites
  var prereqsOk = true;
  if (typeof getPrerequisitesData === 'function') {
    var prereqIds = getPrerequisitesData() || [];
    if (prereqIds.length > 0 && typeof _prereqAllComplete === 'function') {
      prereqsOk = _prereqAllComplete();
    }
  }

  var checklistOk = nonBlank.length === 0 || nonBlank.every(function(item) { return item.checked; });
  var hasSomething = nonBlank.length > 0 || (typeof getPrerequisitesData === 'function' && (getPrerequisitesData() || []).length > 0);

  if (!hasSomething) return; // Nothing to evaluate

  var statusEl = document.getElementById('status');
  if (!statusEl) return;

  var currentStatus = statusEl.value;

  if (checklistOk && prereqsOk && currentStatus !== 'Complete') {
    statusEl.value = 'Complete';
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    if (typeof cwocToast === 'function') cwocToast('All conditions met — status set to Complete', 'success');
  } else if ((!checklistOk || !prereqsOk) && currentStatus === 'Complete') {
    statusEl.value = 'ToDo';
    if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
    if (typeof cwocToast === 'function') cwocToast('Conditions no longer met — status reverted to ToDo', 'info');
  }
}

// formatDate() and formatTime() are in shared.js

const userTimezoneOffset = new Date().getTimezoneOffset();

// _utcToLocalDate, _parseISOTime moved to shared.js

// _convertDBDateToDisplayDate — now in shared-utils.js (single source of truth)
