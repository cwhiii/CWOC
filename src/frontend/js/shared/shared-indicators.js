/**
 * shared-indicators.js — Visual indicator helpers for chit cards and calendar events.
 *
 * Provides alert type detection, icon mapping, and display-mode logic
 * for showing alert, people, health, and recurrence indicators based
 * on visual_indicators settings and rendering context.
 *
 * No dependencies on other shared sub-scripts (uses only built-in types).
 */

// ── Alert Indicator Helpers ───────────────────────────────────────────────────

/** Valid alert _type values */
var _ALERT_TYPES = ['alarm', 'timer', 'stopwatch', 'notification'];

/**
 * Returns true if a chit has any real alerts.
 * Checks the alerts array for entries with _type in {alarm, timer, stopwatch, notification}.
 * Falls back to legacy boolean alarm/notification flags
 * when alerts is null, undefined, or not an array.
 * @param {object} chit
 * @returns {boolean}
 */
function _chitHasAlerts(chit) {
  if (!chit) return false;
  var alerts = chit.alerts;
  if (Array.isArray(alerts)) {
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i] && _ALERT_TYPES.indexOf(alerts[i]._type) !== -1) return true;
    }
  }
  // Legacy boolean flags fallback
  if (chit.alarm === true || chit.notification === true) return true;
  return false;
}

/** Icon map for individual alert types */
var _ALERT_ICON_MAP = {
  alarm:        '🔔 ',
  notification: '📢 ',
  timer:        '⏱️ ',
  stopwatch:    '⏲️ '
};

/** Status icon map for task views */
var _STATUS_ICONS = {
  'ToDo':        '<i class="fas fa-circle" style="color:#8b5a2b;font-size:0.85em;"></i>',
  'In Progress': '<i class="fas fa-spinner" style="color:#d68a59;font-size:0.85em;"></i>',
  'Blocked':     '<i class="fas fa-ban" style="color:#b22222;font-size:0.85em;"></i>',
  'Complete':    '<i class="fas fa-check-circle" style="color:#5a8a5b;font-size:0.85em;"></i>'
};

/**
 * Returns a string of alert indicator icon(s) for a chit,
 * based on visual_indicators settings and rendering context.
 *
 * @param {object} chit - The chit object
 * @param {object} settings - The visual_indicators settings object
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {string} Icon string (may be empty)
 */
function _getAlertIndicators(chit, settings, context) {
  if (!_chitHasAlerts(chit)) return '';

  // Normalise settings — treat null/undefined as empty object
  var s = settings || {};

  // Default missing keys
  var combineAlerts = (s.combine_alerts === true);
  var combinedMode  = s.combined_alert || 'always';

  // Determine whether to use combined (single icon) path
  var useCombined = combineAlerts || context === 'calendar-month' || context === 'calendar-slot';

  if (useCombined) {
    if (_shouldShow(combinedMode, context)) return '🛎️ ';
    return '';
  }

  // Individual mode — only applies in 'card' context
  if (context !== 'card') return '';

  // Collect which alert types are present on this chit
  var present = _chitAlertTypesPresent(chit);
  var result = '';
  for (var i = 0; i < _ALERT_TYPES.length; i++) {
    var aType = _ALERT_TYPES[i];
    if (!present[aType]) continue;
    // Read per-type display mode; default timer/stopwatch to "always"
    var mode = s[aType];
    if (mode === undefined || mode === null) {
      mode = 'always'; // default for any missing key
    }
    if (_shouldShow(mode, context)) {
      result += _ALERT_ICON_MAP[aType];
    }
  }
  return result;
}

/**
 * Returns a string of ALL visual indicator icons for a chit:
 * alert icons + weather + people + recurrence.
 * Respects visual_indicators settings.
 *
 * @param {object} chit - The chit object
 * @param {object} settings - The visual_indicators settings object
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {string} Icon string (may be empty)
 */
function _getAllIndicators(chit, settings, context) {
  var s = settings || {};
  var result = '';

  // Alert indicators
  result += _getAlertIndicators(chit, s, context);

  // Weather indicator — handled by _buildChitHeader with async fetch
  // (no longer a static icon here)

  // People indicator — show when chit has people assigned
  if (Array.isArray(chit.people) && chit.people.length > 0) {
    var peopleMode = s.people || 'always';
    if (_shouldShow(peopleMode, context)) result += '👥 ';
  }

  // Health indicator — show when chit has any health data
  if (chit.health_indicators && typeof chit.health_indicators === 'object' && Object.keys(chit.health_indicators).length > 0) {
    var healthMode = s.indicators || 'always';
    if (_shouldShow(healthMode, context)) result += '❤️ ';
  }

  // Habit / Recurrence indicator
  if (chit.habit) {
    result += '🎯 ';
  } else if (chit.recurrence_rule && chit.recurrence_rule.freq) {
    result += '🔁 ';
  }

  return result;
}

/**
 * Returns true if the given display mode permits showing in the given context.
 * Invalid/unknown mode values are treated as "always" (fail-open).
 * "space" resolves to show for 'card' and 'calendar-slot'; hide for 'calendar-month'.
 * @param {string} mode - "always" | "never" | "space"
 * @param {string} context - 'calendar-month' | 'calendar-slot' | 'card'
 * @returns {boolean}
 */
function _shouldShow(mode, context) {
  if (mode === 'never') return false;
  if (mode === 'space') {
    // "If Space": hide only in month cells to save space
    return context !== 'calendar-month';
  }
  // "always" or any invalid/unknown value → fail-open → show
  return true;
}

/**
 * Returns an object mapping each alert type to true/false indicating
 * whether the chit has that type of alert present.
 * @param {object} chit
 * @returns {object}
 */
function _chitAlertTypesPresent(chit) {
  var present = {};
  var alerts = chit.alerts;
  if (Array.isArray(alerts)) {
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i] && _ALERT_TYPES.indexOf(alerts[i]._type) !== -1) {
        present[alerts[i]._type] = true;
      }
    }
  }
  // Legacy boolean flags
  if (chit.alarm === true) present.alarm = true;
  if (chit.notification === true) present.notification = true;
  return present;
}
