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
  setSaveButtonUnsaved();
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
