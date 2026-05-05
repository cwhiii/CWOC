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

// Weather icon map — used by editor-location.js
const weatherIcons = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

// Default color palette — used by editor-color.js and editor-save.js
const defaultColors = [
  { hex: "transparent", name: "Transparent" },
  { hex: "#C66B6B", name: "Dusty Rose" },
  { hex: "#D68A59", name: "Burnt Sienna" },
  { hex: "#E3B23C", name: "Golden Ochre" },
  { hex: "#8A9A5B", name: "Mossy Sage" },
  { hex: "#6B8299", name: "Slate Teal" },
  { hex: "#8B6B99", name: "Muted Lilac" },
];

// ── Small shared utilities ───────────────────────────────────────────────────

const checklistContainer = document.getElementById("checklist-container");

function _onChecklistChange() {
  if (_isChecklistAutosaveActive() && window.currentChitId && !window.isNewChit) {
    // Auto-save handles it — don't mark the editor as unsaved for checklist-only changes
    _checklistAutosave();
  } else {
    // No autosave — use normal unsaved flow
    setSaveButtonUnsaved();
  }
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
 * Waits 1.5s after last change before saving.
 */
function _checklistAutosave() {
  if (!_isChecklistAutosaveActive()) return;
  if (!window.currentChitId || window.isNewChit) return; // can't autosave a new chit

  if (_checklistAutosaveTimer) clearTimeout(_checklistAutosaveTimer);
  _checklistAutosaveTimer = setTimeout(function() {
    _doChecklistAutosave();
  }, 1500);
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
  var indicator = document.getElementById('checklist-autosave-indicator');
  if (!indicator) {
    // Create a small indicator in the checklist zone header
    var header = document.getElementById('checklistSection')?.querySelector('.zone-header');
    if (!header) return;
    indicator = document.createElement('span');
    indicator.id = 'checklist-autosave-indicator';
    indicator.style.cssText = 'font-size:0.75em;color:#008080;opacity:0;transition:opacity 0.3s;margin-left:0.5em;';
    indicator.textContent = '✓ saved';
    var title = header.querySelector('.zone-title');
    if (title) title.appendChild(indicator);
  }
  indicator.style.opacity = '1';
  setTimeout(function() { indicator.style.opacity = '0'; }, 2000);
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

// formatDate() and formatTime() are in shared.js

const userTimezoneOffset = new Date().getTimezoneOffset();

// _utcToLocalDate, _parseISOTime moved to shared.js

function _convertDBDateToDisplayDate(dateString) {
  if (!dateString) return "";
  const date = _utcToLocalDate(dateString);
  if (isNaN(date.getTime())) return "";
  return formatDate(date);
}
