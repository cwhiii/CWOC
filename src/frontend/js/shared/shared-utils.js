/**
 * shared-utils.js — Core utility functions shared across all CWOC pages.
 *
 * Contains: ID generation, date/time formatting, color contrast helpers,
 * settings cache, save button state, cwocConfirm modal, and cwocToast notifications.
 *
 * This file MUST load after shared-auth.js (uses waitForAuth() for user-scoped settings).
 * Dependencies: shared-auth.js (getCurrentUser, waitForAuth)
 *
 * Dependents: shared-checklist.js, shared-sort.js, shared-indicators.js,
 *             shared-calendar.js, shared-tags.js, shared-recurrence.js,
 *             shared-geocoding.js, shared-qr.js, shared.js
 */

// ── Global marked.js configuration ──────────────────────────────────────────
// Enable GFM line breaks globally so single newlines render as <br>.
// This applies to ALL marked.parse() calls without needing per-call options.
if (typeof marked !== 'undefined' && marked.use) {
  marked.use({ breaks: true });

  // ==highlight== extension — wraps ==text== in <mark> tags
  marked.use({
    extensions: [{
      name: 'highlight',
      level: 'inline',
      start: function(src) { var m = src.match(/==/); return m ? m.index : -1; },
      tokenizer: function(src) {
        var match = src.match(/^==([^=]+)==/);
        if (match) {
          return { type: 'highlight', raw: match[0], text: match[1] };
        }
      },
      renderer: function(token) {
        return '<mark>' + token.text + '</mark>';
      }
    }]
  });
}

// Version is logged once via _logCwocVersion() in shared.js

// ── Settings Cache ───────────────────────────────────────────────────────────
// Promise-based cache so concurrent callers share a single in-flight request.
// Call _invalidateSettingsCache() after saving settings to force a fresh fetch.

let _cwocSettingsPromise = null;

function getCachedSettings() {
  if (!_cwocSettingsPromise) {
    _cwocSettingsPromise = waitForAuth()
      .then(function (user) {
        var userId = (user && user.user_id) ? user.user_id : 'default_user';
        return fetch('/api/settings/' + encodeURIComponent(userId));
      })
      .then(function (r) {
        if (!r.ok) throw new Error('Settings fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        window._cwocSettings = data;
        return data;
      })
      .catch(function (err) {
        console.error('getCachedSettings error:', err);
        _cwocSettingsPromise = null;   // allow retry on next call
        return {};                     // graceful fallback
      });
  }
  return _cwocSettingsPromise;
}

function _invalidateSettingsCache() {
  _cwocSettingsPromise = null;
  window._cwocSettings = undefined;
}

// ── Shared Utility Functions ─────────────────────────────────────────────────

/**
 * Show a parchment-styled confirm modal. Returns a Promise that resolves to boolean.
 * Usage: if (await cwocConfirm('Delete this chit?')) { ... }
 * @param {string} message - The confirmation message
 * @param {object} [opts] - Options: { title, confirmLabel, cancelLabel, danger }
 */
function cwocConfirm(message, opts) {
  opts = opts || {};
  var title = opts.title || 'Confirm';
  var confirmLabel = opts.confirmLabel || 'OK';
  var cancelLabel = opts.cancelLabel || 'Cancel';
  var danger = opts.danger || false;

  return new Promise(function (resolve) {
    // Remove any existing confirm modal
    var existing = document.getElementById('cwoc-confirm-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'cwoc-confirm-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fffaf0;border:2px solid #8b5a2b;border-radius:8px;padding:20px 28px;max-width:400px;width:90%;font-family:Lora, Georgia, serif;color:#2b1e0f;box-shadow:0 4px 16px rgba(0,0,0,0.3);text-align:center;';

    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 12px;font-size:1.2em;color:#4a2c2a;';
    h3.textContent = title;
    box.appendChild(h3);

    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 18px;font-size:1em;line-height:1.4;white-space:pre-line;';
    if (opts.html) {
      p.innerHTML = message;
    } else {
      p.textContent = message;
    }
    box.appendChild(p);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'standard-button';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.cssText = 'padding:8px 18px;font-family:inherit;cursor:pointer;';
    cancelBtn.onclick = function () { overlay.remove(); resolve(false); };

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'standard-button';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.style.cssText = 'padding:8px 18px;font-family:inherit;cursor:pointer;' + (danger ? 'background:#b22222;color:#fff;border-color:#8b1a1a;' : '');
    confirmBtn.onclick = function () { overlay.remove(); resolve(true); };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);

    // ESC to cancel
    var onKey = function (e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); }
    };
    document.addEventListener('keydown', onKey, true);

    // Click outside to cancel
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); } });

    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

/**
 * Show a parchment-styled toast notification. Auto-dismisses after a delay.
 * Click to dismiss early. Supports success, error, and info types.
 * Usage: cwocToast('Saved!');  cwocToast('Failed!', 'error');
 * @param {string} message - The message to display
 * @param {string} [type='success'] - 'success', 'error', or 'info'
 * @param {number} [duration=3000] - Auto-dismiss time in ms (0 = no auto-dismiss)
 */
function cwocToast(message, type, duration) {
  type = type || 'success';
  if (duration === undefined) duration = (type === 'error') ? 5000 : 3000;

  // Remove any existing toast
  var existing = document.getElementById('cwoc-toast');
  if (existing) existing.remove();

  var colors = {
    success: { bg: '#2d5a1e', border: '#1e3f14' },
    error:   { bg: '#8b1a1a', border: '#5c1010' },
    info:    { bg: '#4a2c2a', border: '#2b1e0f' }
  };
  var c = colors[type] || colors.info;
  var icons = { success: '✅', error: '❌', info: 'ℹ️' };

  var toast = document.createElement('div');
  toast.id = 'cwoc-toast';
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'
    + 'background:' + c.bg + ';color:#fdf5e6;border:2px solid ' + c.border + ';'
    + 'border-radius:8px;padding:12px 20px;font-family:Lora,Georgia,serif;font-size:0.95em;'
    + 'box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:10000;cursor:pointer;'
    + 'max-width:90%;text-align:center;opacity:0;transition:opacity 0.3s ease;';
  toast.innerHTML = (icons[type] || '') + '  ' + message;
  if (duration === 0) {
    // Add dismiss X button for persistent toasts
    var closeBtn = document.createElement('span');
    closeBtn.textContent = ' ✕';
    closeBtn.style.cssText = 'margin-left:12px;font-weight:bold;opacity:0.7;';
    toast.appendChild(closeBtn);
  }
  toast.onclick = function () { dismiss(); };

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(function () { toast.style.opacity = '1'; });

  var timer = null;
  function dismiss() {
    if (timer) clearTimeout(timer);
    toast.style.opacity = '0';
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
  }

  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
  }
}

/**
 * Show a styled input modal (replaces browser prompt()).
 * @param {string} title - Modal title text
 * @param {string} placeholder - Input placeholder text
 * @param {function} onConfirm - Called with the input value when confirmed
 * @param {object} [opts] - Optional: { defaultValue: '' }
 */
function cwocPromptModal(title, placeholder, onConfirm, opts) {
  opts = opts || {};
  // Remove any existing prompt modal
  document.querySelectorAll('.cwoc-prompt-modal-overlay').forEach(function(el) { el.remove(); });

  var overlay = document.createElement('div');
  overlay.className = 'cwoc-prompt-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:300px;max-width:400px;width:90%;font-family:Lora,Georgia,serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  var titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin:0 0 12px 0;color:#4a2c2a;font-size:1.1em;';
  titleEl.textContent = title;
  modal.appendChild(titleEl);

  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder || '';
  input.value = opts.defaultValue || '';
  input.style.cssText = 'width:100%;padding:8px 10px;font-family:Lora,Georgia,serif;font-size:1em;border:1px solid #a0522d;border-radius:4px;background:#fff8f0;box-sizing:border-box;color:#1a1208;';
  modal.appendChild(input);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:6px 14px;font-family:Lora,Georgia,serif;font-size:0.9em;background:#e8dcc8;color:#4a2c2a;border:1px solid #a0522d;border-radius:4px;cursor:pointer;';
  cancelBtn.addEventListener('mouseenter', function() { this.style.background = '#d4c5a9'; });
  cancelBtn.addEventListener('mouseleave', function() { this.style.background = '#e8dcc8'; });

  var confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Create';
  confirmBtn.style.cssText = 'padding:6px 14px;font-family:Lora,Georgia,serif;font-size:0.9em;background:#8b5a2b;color:#fdf5e6;border:1px solid #5a3f2a;border-radius:4px;cursor:pointer;font-weight:bold;';
  confirmBtn.addEventListener('mouseenter', function() { this.style.background = '#6b4e31'; });
  confirmBtn.addEventListener('mouseleave', function() { this.style.background = '#8b5a2b'; });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', function() {
    var val = input.value.trim();
    if (!val) { input.focus(); return; }
    close();
    onConfirm(val);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;
      close();
      onConfirm(val);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  // Focus the input after a tick
  setTimeout(function() { input.focus(); input.select(); }, 50);
}

// ── Temperature & Wind Conversion (unit_system-aware) ────────────────────────

/**
 * Convert a Celsius temperature for display based on the user's unit_system setting.
 * Returns a rounded integer. If unit_system is 'metric', returns Celsius as-is.
 * @param {number} c - Temperature in Celsius
 * @returns {number} Temperature in the user's preferred unit
 */
function _convertTemp(c) {
  var s = window._cwocSettings;
  if (s && s.unit_system === 'metric') return Math.round(c);
  return Math.round(c * 9 / 5 + 32);
}

/**
 * Returns the temperature unit label based on the user's unit_system setting.
 * @returns {string} '°C' or '°F'
 */
function _tempUnit() {
  var s = window._cwocSettings;
  return (s && s.unit_system === 'metric') ? '°C' : '°F';
}

/**
 * Returns true if the user's unit_system is 'metric'.
 */
function _isMetricUnits() {
  var s = window._cwocSettings;
  return s && s.unit_system === 'metric';
}

/**
 * Convert wind speed from km/h for display based on the user's unit_system setting.
 * Metric: returns km/h. Imperial: returns mph.
 * @param {number} kmh - Wind speed in km/h
 * @returns {{ value: number, unit: string }}
 */
function _convertWind(kmh) {
  var s = window._cwocSettings;
  if (s && s.unit_system === 'metric') return { value: Math.round(kmh), unit: 'km/h' };
  return { value: Math.round(kmh * 0.621371), unit: 'mph' };
}

/**
 * Get the temperature bar range (min/max) for visual temperature bars.
 * Metric: -10°C to 40°C. Imperial: -14°F to 104°F (equivalent range).
 * @returns {{ barMin: number, barMax: number }}
 */
function _tempBarRange() {
  var s = window._cwocSettings;
  if (s && s.unit_system === 'metric') return { barMin: -10, barMax: 40 };
  return { barMin: -14, barMax: 104 };
}

// WMO weather code descriptions — shared across editor and dashboard
var _weatherDescriptions = {
  0: "Clear", 1: "Partly cloudy", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  56: "Drizzle", 57: "Drizzle",
  61: "Rain", 63: "Rain", 65: "Rain",
  66: "Rain", 67: "Rain",
  71: "Snow", 73: "Snow", 75: "Snow",
  77: "Snow", 85: "Snow", 86: "Snow",
  80: "Rain", 81: "Rain", 82: "Rain",
  95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Thunderstorm + hail"
};

/** Get a temperature feeling word based on the most extreme temp (in Celsius). */
function _getTempFeeling(minC, maxC) {
  var extremeC = Math.abs(maxC) >= Math.abs(minC) ? maxC : minC;
  if (extremeC <= -5) return "frigid";
  if (extremeC <= 0) return "freezing";
  if (extremeC <= 8) return "cold";
  if (extremeC <= 14) return "cool";
  if (extremeC <= 20) return "mild";
  if (extremeC <= 25) return "warm";
  if (extremeC <= 30) return "hot";
  return "scorching";
}

/** Get full weather description with temperature feeling.
 *  windGustsKmh is optional — if provided and snow codes are active with gusts >= 56 km/h, returns "Blizzard".
 */
function _getWeatherDescription(weatherCode, minC, maxC, windGustsKmh) {
  var desc = _weatherDescriptions[weatherCode] || "Unknown conditions";
  // NWS blizzard: snow + wind gusts >= 35 mph (56 km/h)
  if (windGustsKmh && windGustsKmh >= 56 && [71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    desc = "Blizzard";
  }
  var feeling = _getTempFeeling(minC, maxC);
  return desc + ' & ' + feeling;
}

/** Get the gradient color for a given temperature (Celsius). */
function _getTempColor(tempC) {
  // Canonical gradient stops: -10=#001040, 0=#2166ac, 15=#e0ddd4, 22=#f0c830, 30=#d73027, 40=#3a0000
  var stops = _cwocTempGradientStops;
  if (tempC <= stops[0].t) return 'rgb(' + stops[0].r + ',' + stops[0].g + ',' + stops[0].b + ')';
  if (tempC >= stops[stops.length - 1].t) return 'rgb(' + stops[stops.length - 1].r + ',' + stops[stops.length - 1].g + ',' + stops[stops.length - 1].b + ')';
  for (var i = 0; i < stops.length - 1; i++) {
    if (tempC >= stops[i].t && tempC <= stops[i + 1].t) {
      var pct = (tempC - stops[i].t) / (stops[i + 1].t - stops[i].t);
      var r = Math.round(stops[i].r + pct * (stops[i + 1].r - stops[i].r));
      var g = Math.round(stops[i].g + pct * (stops[i + 1].g - stops[i].g));
      var b = Math.round(stops[i].b + pct * (stops[i + 1].b - stops[i].b));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
  }
  return '#3a2a1a';
}

// Canonical temperature gradient stops — single source of truth
var _cwocTempGradientStops = [
  { t: -10, r: 0, g: 16, b: 64, hex: '#001040' },
  { t: 0, r: 33, g: 102, b: 172, hex: '#2166ac' },
  { t: 15, r: 224, g: 221, b: 212, hex: '#e0ddd4' },
  { t: 22, r: 240, g: 200, b: 48, hex: '#f0c830' },
  { t: 30, r: 215, g: 48, b: 39, hex: '#d73027' },
  { t: 40, r: 58, g: 0, b: 0, hex: '#3a0000' }
];

/** Build the CSS linear-gradient string for the temperature bar. */
function _buildTempGradient() {
  var barR = _tempBarRange();
  var barMin = barR.barMin, barMax = barR.barMax, range = barMax - barMin;
  var parts = [];
  for (var i = 0; i < _cwocTempGradientStops.length; i++) {
    var stop = _cwocTempGradientStops[i];
    // Convert Celsius stop to position on the bar (accounting for imperial range)
    var tempInDisplayUnits = _isMetricUnits() ? stop.t : Math.round(stop.t * 9 / 5 + 32);
    var pct = ((tempInDisplayUnits - barMin) / range) * 100;
    pct = Math.max(0, Math.min(100, pct));
    parts.push(stop.hex + ' ' + pct.toFixed(1) + '%');
  }
  return 'linear-gradient(to right, ' + parts.join(', ') + ')';
}

/** Get border color for a temperature — same as gradient color. */
function _getTempBorderColor(tempC) {
  return _getTempColor(tempC);
}

/** Convert a temperature to the OPPOSITE unit system for tooltip display. */
function _tempAltUnit(tempC) {
  if (_isMetricUnits()) {
    // Currently showing metric — tooltip shows imperial
    return Math.round(tempC * 9 / 5 + 32) + '°F';
  } else {
    // Currently showing imperial — tooltip shows metric (convert from F to C)
    return Math.round((tempC - 32) * 5 / 9) + '°C';
  }
}

/** Convert a temperature (already in display units) to the opposite for tooltip. */
function _tempDisplayAlt(displayTemp) {
  if (_isMetricUnits()) {
    // Display is °C, show °F
    return Math.round(displayTemp * 9 / 5 + 32) + '°F';
  } else {
    // Display is °F, show °C
    return Math.round((displayTemp - 32) * 5 / 9) + '°C';
  }
}

/** Convert wind speed to the opposite unit for tooltip. Input is in display units. */
function _windDisplayAlt(displayValue) {
  if (_isMetricUnits()) {
    // Display is km/h, show mph
    return Math.round(displayValue * 0.621371) + ' mph';
  } else {
    // Display is mph, show km/h
    return Math.round(displayValue / 0.621371) + ' km/h';
  }
}

/** Convert precipitation to the opposite unit for tooltip. Input is mm. */
function _precipAlt(precipMm) {
  if (_isMetricUnits()) {
    // Display is metric (cm), show inches
    return (precipMm / 25.4).toFixed(1) + ' in';
  } else {
    // Display is imperial (in), show cm
    return (precipMm / 10).toFixed(1) + ' cm';
  }
}

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(date) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${date.getFullYear()}-${monthNames[date.getMonth()]}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function setSaveButtonUnsaved() {
  if (window._cwocSave) window._cwocSave.markUnsaved();
}

/**
 * Returns '#2b1e0f' (dark) or '#fff' (light) for readable text on the given background.
 * Uses WCAG-style relative luminance to pick the best contrast.
 */
function contrastColorForBg(hex) {
  if (!hex) return '#2b1e0f';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  if (hex.length !== 6) return '#2b1e0f';
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  var lum = (r * 299 + g * 587 + b * 114) / 1000;
  return lum > 150 ? '#2b1e0f' : '#fdf5e6';
}

/**
 * Apply background color and auto-contrast font color to an element based on a chit's color.
 * Call this instead of manually setting el.style.backgroundColor = chitColor(chit).
 */
function applyChitColors(el, bgColor) {
  el.style.backgroundColor = bgColor;
  el.style.color = contrastColorForBg(bgColor);
}

/**
 * Returns true if the given hex color is light (luminance > 140).
 * Used for deciding text color on colored backgrounds.
 */
function isLightColor(hex) {
  if (!hex) return true;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return true;
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ── Shared Color Picker ──────────────────────────────────────────────────────

/** Default color palette used across CWOC (editor color zone, bundle tabs, etc.) */
var _cwocDefaultColors = [
  { hex: '#C66B6B', name: 'Dusty Rose' },
  { hex: '#D68A59', name: 'Burnt Sienna' },
  { hex: '#E3B23C', name: 'Golden Ochre' },
  { hex: '#8A9A5B', name: 'Mossy Sage' },
  { hex: '#6B8299', name: 'Slate Teal' },
  { hex: '#8B6B99', name: 'Muted Lilac' }
];

/**
 * Render a color picker (swatches) into a container element.
 * Uses the default palette + user's custom colors from settings.
 * Calls onChange(hex) when a swatch is clicked.
 *
 * @param {HTMLElement} container — element to render swatches into (cleared first)
 * @param {string} currentColor — currently selected hex color (or '' for none)
 * @param {Function} onChange — callback(hex) when selection changes
 * @param {object} [opts] — options: { showNone: true } to include a "no color" swatch
 */
function cwocRenderColorPicker(container, currentColor, onChange, opts) {
  opts = opts || {};
  container.innerHTML = '';

  var colors = _cwocDefaultColors.slice();

  // Add custom colors from settings
  var customColors = (window._cwocSettings || {}).custom_colors;
  if (Array.isArray(customColors)) {
    customColors.forEach(function(c) {
      var hex = (typeof c === 'string') ? c : (c.hex || c.color || '');
      var name = (typeof c === 'string') ? c : (c.name || c.hex || '');
      if (hex) colors.push({ hex: hex, name: name });
    });
  }

  // "None" swatch
  if (opts.showNone !== false) {
    var noneSwatch = document.createElement('button');
    noneSwatch.type = 'button';
    noneSwatch.className = 'color-swatch cwoc-color-none';
    noneSwatch.textContent = '\u2718';
    noneSwatch.title = 'No color';
    if (!currentColor) noneSwatch.classList.add('selected');
    noneSwatch.addEventListener('click', function() {
      container.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('selected'); });
      noneSwatch.classList.add('selected');
      onChange('');
    });
    container.appendChild(noneSwatch);
  }

  // Color swatches
  colors.forEach(function(c) {
    var swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = c.hex;
    swatch.title = c.name;
    if (c.hex.toLowerCase() === (currentColor || '').toLowerCase()) swatch.classList.add('selected');
    swatch.addEventListener('click', function() {
      container.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('selected'); });
      swatch.classList.add('selected');
      onChange(c.hex);
    });
    container.appendChild(swatch);
  });
}

/**
 * Parse an ISO datetime string into a local Date object.
 * Returns null if the input is falsy.
 */
function _utcToLocalDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString);
}

/**
 * Parse an ISO datetime string and return a formatted time string (HH:MM).
 * Returns "" if the input is falsy or invalid.
 */
function _parseISOTime(isoString) {
  if (!isoString) return "";
  const date = _utcToLocalDate(isoString);
  if (isNaN(date.getTime())) return "";
  return formatTime(date);
}

/**
 * Generate a deterministic pastel RGB color from a string label.
 */
function getPastelColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const r = ((hash & 0xff) % 128) + 127;
  const g = (((hash >> 8) & 0xff) % 128) + 127;
  const b = (((hash >> 16) & 0xff) % 128) + 127;
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Shared Chit Text Search ──────────────────────────────────────────────────

/**
 * Test whether a chit matches a text search term.
 * Searches: title, note, tags (non-system), status, people, location,
 * priority, severity, and checklist item text.
 * Handles HTML entity encoding in titles (e.g. &amp; → &).
 *
 * @param {Object} chit — the chit object from the API
 * @param {string} searchText — lowercase search term
 * @returns {boolean}
 */
function chitMatchesSearch(chit, searchText) {
  if (!searchText) return true;

  // If search starts with #, it's a tag-only search (strip the #)
  if (searchText.startsWith('#')) {
    var tagTerm = searchText.slice(1);
    if (!tagTerm) return true;
    return Array.isArray(chit.tags) && chit.tags.some(function(t) {
      if (t.startsWith('CWOC_System/')) return false;
      var tLower = t.toLowerCase();
      return tLower === tagTerm || tLower.includes(tagTerm) || tLower.split('/').some(function(seg) { return seg === tagTerm || seg.includes(tagTerm); });
    });
  }

  // Title (normalize HTML entities)
  var title = (chit.title || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').toLowerCase();
  if (title.includes(searchText)) return true;
  // Note content
  if (chit.note && chit.note.toLowerCase().includes(searchText)) return true;
  // Tags (exclude system tags)
  if (Array.isArray(chit.tags) && chit.tags.some(function(t) { return !t.startsWith('CWOC_System/') && t.toLowerCase().includes(searchText); })) return true;
  // Status
  if (chit.status && chit.status.toLowerCase().includes(searchText)) return true;
  // People
  if (Array.isArray(chit.people) && chit.people.some(function(p) { return p.toLowerCase().includes(searchText); })) return true;
  // Location
  if (chit.location && chit.location.toLowerCase().includes(searchText)) return true;
  // Priority & severity
  if (chit.priority && chit.priority.toLowerCase().includes(searchText)) return true;
  if (chit.severity && chit.severity.toLowerCase().includes(searchText)) return true;
  // Checklist item text
  if (Array.isArray(chit.checklist) && chit.checklist.some(function(item) { return item.text && item.text.toLowerCase().includes(searchText); })) return true;
  return false;
}

// ── Global Search Helpers (shared across dashboard and editor) ────────────────

/**
 * Extract positive (non-negated) search terms from a query string for highlighting.
 * Strips operators (&&, ||, !, ()) and #tag prefixes, returns array of lowercase terms.
 * Used by the global search, send-content modals, and send-item modals.
 */
function cwocExtractSearchTerms(query) {
  if (!query) return [];
  var terms = [];
  var i = 0;
  var q = query.toLowerCase();
  // Known field prefixes for field::value syntax
  var _fieldNames = ['title','note','notes','location','loc','status','priority','severity',
    'color','people','person','assigned','assigned_to','checklist','subject','sender',
    'from','to','cc','bcc','body','child','start','end','due','created','modified'];
  while (i < q.length) {
    if (q[i] === ' ' || q[i] === '\t') { i++; continue; }
    if (q[i] === '(' || q[i] === ')') { i++; continue; }
    if (q.substring(i, i + 2) === '&&' || q.substring(i, i + 2) === '||') { i += 2; continue; }
    if ((q[i] === '&' || q[i] === '|') && q.substring(i, i + 2) !== '&&' && q.substring(i, i + 2) !== '||') {
      // Lone & or | (not && or ||) — treat as literal text, read until next delimiter
      var start3 = i;
      i++;
      while (i < q.length && ' \t()!#'.indexOf(q[i]) === -1) {
        if (q.substring(i, i + 2) === '&&' || q.substring(i, i + 2) === '||') break;
        i++;
      }
      var loneWord = q.substring(start3, i);
      if (loneWord.length > 0) terms.push(loneWord);
      continue;
    }
    if (q[i] === '!') {
      i++;
      while (i < q.length && (q[i] === ' ' || q[i] === '\t')) i++;
      if (i < q.length && q[i] === '(') {
        var depth = 1; i++;
        while (i < q.length && depth > 0) { if (q[i] === '(') depth++; else if (q[i] === ')') depth--; i++; }
      } else if (i < q.length && q[i] === '#') {
        i++;
        while (i < q.length && ' \t()&|!#'.indexOf(q[i]) === -1) i++;
      } else {
        while (i < q.length && ' \t()&|!#'.indexOf(q[i]) === -1) i++;
      }
      continue;
    }
    if (q[i] === '#') {
      i++;
      var start = i;
      while (i < q.length && ' \t()&|!#'.indexOf(q[i]) === -1) i++;
      if (i > start) terms.push(q.substring(start, i));
      continue;
    }
    // Read a word (may be field::value)
    var start2 = i;
    while (i < q.length && ' \t()&|!#'.indexOf(q[i]) === -1) i++;
    var word = q.substring(start2, i);
    // Check for field::value syntax
    var colonPos = word.indexOf('::');
    if (colonPos > 0) {
      var fieldPart = word.substring(0, colonPos);
      if (_fieldNames.indexOf(fieldPart) !== -1) {
        var valuePart = word.substring(colonPos + 2);
        if (!valuePart && i < q.length && q[i] === '(') {
          // field::(multi word value) — extract the parenthesized content
          i++; // skip (
          var valStart = i;
          var d = 1;
          while (i < q.length && d > 0) { if (q[i] === '(') d++; else if (q[i] === ')') d--; i++; }
          var multiVal = q.substring(valStart, i - 1).trim();
          // Split multi-word value into individual terms for highlighting
          var parts = multiVal.split(/\s+/);
          for (var p = 0; p < parts.length; p++) {
            if (parts[p].length > 0) terms.push(parts[p]);
          }
        } else if (valuePart.length > 0) {
          terms.push(valuePart);
        }
        continue;
      }
    }
    if (word.length > 0) terms.push(word);
  }
  return terms.filter(function(t) { return t.length > 0; });
}

/**
 * Highlight multiple terms in text. HTML-escapes first, then wraps matches in <mark>.
 * @param {string} text - raw text to highlight
 * @param {string[]} terms - array of lowercase terms to highlight
 * @returns {string} HTML with matches wrapped in <mark>
 */
function cwocHighlightTerms(text, terms) {
  if (!text) return '';
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!terms || terms.length === 0) return escaped;
  // HTML-escape each term so it matches against the escaped text
  var parts = terms.map(function(t) {
    var htmlTerm = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return htmlTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\' + '$&');
  });
  var regex = new RegExp('(' + parts.join('|') + ')', 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

// ── Shared Live Preview ──────────────────────────────────────────────────────
// One function used by both the Notes modal and Email expand modal for
// real-time markdown rendering from a textarea into a preview div.

/** Active debounce timers keyed by textarea ID */
var _livePreviewTimers = {};

/**
 * Wire live markdown preview on a textarea → preview div pair.
 * Debounced at 300ms. Only wires once per textarea (guarded by _lpWired flag).
 *
 * @param {string} textareaId — ID of the source textarea
 * @param {string} previewId  — ID of the target preview div
 */
function cwocWireLivePreview(textareaId, previewId) {
  var ta = document.getElementById(textareaId);
  var pv = document.getElementById(previewId);
  if (!ta || !pv) return;
  if (ta._lpWired) return;
  ta._lpWired = true;

  ta.addEventListener('input', function() {
    clearTimeout(_livePreviewTimers[textareaId]);
    _livePreviewTimers[textareaId] = setTimeout(function() {
      cwocUpdateLivePreview(textareaId, previewId);
    }, 300);
  });

  // Initial render
  cwocUpdateLivePreview(textareaId, previewId);
}

/**
 * Render the current textarea value as markdown into the preview div.
 *
 * @param {string} textareaId — ID of the source textarea
 * @param {string} previewId  — ID of the target preview div
 */
function cwocUpdateLivePreview(textareaId, previewId) {
  var ta = document.getElementById(textareaId);
  var pv = document.getElementById(previewId);
  if (!ta || !pv) return;

  var raw = ta.value || '';
  if (!raw.trim()) {
    pv.innerHTML = '<em style="opacity:0.4;">Preview appears here as you type\u2026</em>';
    return;
  }
  if (typeof marked !== 'undefined' && marked.parse) {
    pv.innerHTML = marked.parse(raw, { breaks: true });
  } else {
    pv.innerHTML = '<pre style="white-space:pre-wrap;">' + raw.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>';
  }
}


// ── Shared 2-Value Toggle ────────────────────────────────────────────────────
// Clicking ANYWHERE on a .cwoc-2val-toggle switches to the other value.
// Only applies to toggles whose spans have onclick handlers (mode toggles).
// Settings-style toggles use _initPillToggle() which handles clicks separately.

document.addEventListener('click', function(e) {
  var toggle = e.target.closest('.cwoc-2val-toggle');
  if (!toggle) return;
  var spans = toggle.querySelectorAll('span[data-val]');
  if (spans.length !== 2) return;

  // Only handle toggles whose spans have onclick (mode toggles, not settings pills)
  if (!spans[0].onclick && !spans[1].onclick) return;

  // If user clicked directly on the inactive span, its onclick already fired — skip
  var clickedSpan = e.target.closest('span[data-val]');
  if (clickedSpan && !clickedSpan.classList.contains('active')) return;

  // Otherwise (clicked active span, or the container gap) — switch to the other one
  var activeSpan = toggle.querySelector('span.active');
  var targetSpan = (activeSpan === spans[0]) ? spans[1] : spans[0];

  // Call the onclick directly to avoid re-triggering this handler
  if (targetSpan.onclick) {
    targetSpan.onclick(e);
  }
});

// ── Shared Chit Picker Modal ──────────────────────────────────────────────────

/**
 * Open a reusable chit picker modal (same UI as "Add Child Chits" in Projects).
 * Supports multi-select with checkboxes, search, status/priority filters.
 *
 * @param {object} options
 * @param {string} options.title - Modal title (e.g. "Add Child Chits", "Select Prerequisites")
 * @param {string} options.confirmLabel - Confirm button label (e.g. "Add Selected")
 * @param {function} options.onConfirm - Called with array of selected chit objects
 * @param {function} [options.filterChits] - Optional filter function(chit) → boolean to exclude chits
 * @param {Set} [options.disabledIds] - IDs shown as already-selected/greyed (with ✓)
 * @param {Set} [options.preSelectedIds] - IDs that start checked
 * @param {function} [options.onItemDblClick] - Optional double-click handler(chit) for immediate action
 * @param {function} [options.beforeSelect] - Optional async function(chitId) → boolean; return false to block selection
 */
async function cwocChitPickerModal(options) {
  var title = options.title || 'Select Chits';
  var confirmLabel = options.confirmLabel || 'Add Selected';
  var onConfirm = options.onConfirm;
  var filterChits = options.filterChits;
  var disabledIds = options.disabledIds || new Set();
  var preSelectedIds = options.preSelectedIds || new Set();
  var onItemDblClick = options.onItemDblClick;
  var beforeSelect = options.beforeSelect;

  // Create modal
  var modal = document.createElement('div');
  modal.className = 'modal-overlay-new';
  modal.style.display = 'flex';
  document.body.appendChild(modal);

  modal.innerHTML =
    '<div class="modal-content-new">' +
      '<div class="modal-header-new">' +
        '<h2>' + (title.replace(/</g, '&lt;')) + '</h2>' +
        '<div class="modal-buttons"></div>' +
      '</div>' +
      '<div class="modal-body-new">' +
        '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">' +
          '<select class="cwoc-picker-filter-status" style="padding:4px 8px;border:1px solid #a0522d;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#fff8f0;">' +
            '<option value="">All Statuses</option>' +
            '<option value="ToDo">ToDo</option>' +
            '<option value="In Progress">In Progress</option>' +
            '<option value="Blocked">Blocked</option>' +
            '<option value="Complete">Complete</option>' +
          '</select>' +
          '<select class="cwoc-picker-filter-priority" style="padding:4px 8px;border:1px solid #a0522d;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#fff8f0;">' +
            '<option value="">All Priorities</option>' +
            '<option value="Low">Low</option>' +
            '<option value="Medium">Medium</option>' +
            '<option value="High">High</option>' +
            '<option value="Critical">Critical</option>' +
          '</select>' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;white-space:nowrap;cursor:pointer;"><input type="checkbox" class="cwoc-picker-include-email"> Email</label>' +
          '<input type="text" class="cwoc-picker-search chit-search-input-new" placeholder="Search chits..." autofocus style="flex:1;">' +
        '</div>' +
        '<table class="chit-table-new">' +
          '<thead><tr><th style="width:30px;"></th><th>Title</th><th>Due</th><th>Status</th></tr></thead>' +
          '<tbody class="cwoc-picker-list"></tbody>' +
        '</table>' +
      '</div>' +
      '<div class="modal-footer-new">' +
        '<span class="cwoc-picker-count" style="font-size:0.85em;opacity:0.7;"></span>' +
        '<button class="modal-button-new cancel cwoc-picker-cancel">Cancel</button>' +
        '<button class="modal-button-new cwoc-picker-confirm" disabled>' + (confirmLabel.replace(/</g, '&lt;')) + '</button>' +
      '</div>' +
    '</div>';

  var searchInput = modal.querySelector('.cwoc-picker-search');
  var statusFilter = modal.querySelector('.cwoc-picker-filter-status');
  var priorityFilter = modal.querySelector('.cwoc-picker-filter-priority');
  var emailCheckbox = modal.querySelector('.cwoc-picker-include-email');
  var listEl = modal.querySelector('.cwoc-picker-list');
  var confirmBtn = modal.querySelector('.cwoc-picker-confirm');
  var cancelBtn = modal.querySelector('.cwoc-picker-cancel');
  var countSpan = modal.querySelector('.cwoc-picker-count');
  var headerH2 = modal.querySelector('.modal-header-new h2');

  var selectedIds = new Set(preSelectedIds);
  var availableChits = [];
  var filteredChits = [];

  function _updateBtn() {
    var count = selectedIds.size;
    confirmBtn.disabled = count === 0;
    countSpan.textContent = count > 0 ? count + ' selected' : '';
  }

  function _highlightText(text, term) {
    if (!text) return '';
    var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!term) return escaped;
    var safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp('(' + safeTerm + ')', 'gi'), '<mark>$1</mark>');
  }

  function _findMatchedField(chit, term) {
    // Returns {field, snippet} for the first non-title field that matches
    var fields = [
      { name: 'note', val: chit.note },
      { name: 'checklist', val: Array.isArray(chit.checklist) ? chit.checklist.map(function(i) { return i.text || ''; }).join(' | ') : '' },
      { name: 'people', val: Array.isArray(chit.people) ? chit.people.join(', ') : '' },
      { name: 'location', val: chit.location },
      { name: 'priority', val: chit.priority },
      { name: 'severity', val: chit.severity },
      { name: 'status', val: chit.status },
      { name: 'tags', val: Array.isArray(chit.tags) ? chit.tags.filter(function(t) { return !t.startsWith('CWOC_System/'); }).join(', ') : '' }
    ];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f.val) continue;
      var idx = f.val.toLowerCase().indexOf(term);
      if (idx !== -1) {
        var start = Math.max(0, idx - 10);
        var end = Math.min(f.val.length, idx + 40);
        var snippet = '';
        if (start > 0) snippet += '\u2026';
        snippet += f.val.substring(start, end);
        if (end < f.val.length) snippet += '\u2026';
        return { field: f.name, snippet: snippet };
      }
    }
    return null;
  }

  function _renderList(chitsToRender) {
    var searchTerm = (searchInput.value || '').toLowerCase().trim();
    var highlightTerm = searchTerm.startsWith('#') ? '' : searchTerm;
    var tagHighlight = searchTerm.startsWith('#') ? searchTerm.slice(1) : searchTerm;

    listEl.innerHTML = '';
    chitsToRender.forEach(function(chit) {
      var isDisabled = disabledIds.has(chit.id);
      var row = document.createElement('tr');
      row.dataset.chitId = chit.id;
      if (isDisabled) {
        row.style.cssText = 'opacity:0.6;background:#e8dcc8;';
        row.title = 'Already selected';
      }

      // Checkbox cell
      var cbCell = document.createElement('td');
      cbCell.style.textAlign = 'center';
      if (isDisabled) {
        var icon = document.createElement('span');
        icon.textContent = '✓';
        icon.style.cssText = 'color:#4a7c59;font-weight:bold;';
        cbCell.appendChild(icon);
      } else {
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedIds.has(chit.id);
        cb.dataset.chitId = chit.id;
        cb.addEventListener('change', async function() {
          if (this.checked) {
            if (beforeSelect) {
              var allowed = await beforeSelect(chit.id);
              if (!allowed) { this.checked = false; return; }
            }
            selectedIds.add(chit.id);
          } else {
            selectedIds.delete(chit.id);
          }
          _updateBtn();
        });
        cbCell.appendChild(cb);
      }
      row.appendChild(cbCell);

      // Title + Tags cell
      var titleCell = document.createElement('td');
      var titleSpan = document.createElement('span');
      titleSpan.innerHTML = highlightTerm ? _highlightText(chit.title || '(No Title)', highlightTerm) : (chit.title || '(No Title)').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      if (isDisabled) titleSpan.style.fontStyle = 'italic';
      titleCell.appendChild(titleSpan);

      var userTags = (chit.tags || []).filter(function(t) { return !t.startsWith('CWOC_System/'); });
      if (userTags.length > 0) {
        var tagsSpan = document.createElement('span');
        tagsSpan.style.cssText = 'margin-left:6px;font-size:0.8em;opacity:0.7;';
        tagsSpan.innerHTML = userTags.map(function(t) {
          var tagHtml = tagHighlight ? _highlightText(t, tagHighlight) : t.replace(/&/g, '&amp;');
          return '<span style="background:#f0e6d0;padding:1px 5px;border-radius:3px;margin-right:3px;white-space:nowrap;">' + tagHtml + '</span>';
        }).join('');
        titleCell.appendChild(tagsSpan);
      }

      // Show which field matched (with snippet) when match isn't in title
      if (searchTerm && !searchTerm.startsWith('#')) {
        var titleLower = (chit.title || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').toLowerCase();
        if (!titleLower.includes(searchTerm)) {
          var matchInfo = _findMatchedField(chit, searchTerm);
          if (matchInfo) {
            var matchSpan = document.createElement('div');
            matchSpan.style.cssText = 'font-size:0.78em;color:#6b4e31;margin-top:2px;opacity:0.85;';
            matchSpan.innerHTML = '<b>' + matchInfo.field + ':</b> ' + _highlightText(matchInfo.snippet, searchTerm);
            titleCell.appendChild(matchSpan);
          }
        }
      }

      row.appendChild(titleCell);

      // Due date cell
      var dueCell = document.createElement('td');
      dueCell.textContent = chit.due_datetime ? new Date(chit.due_datetime).toISOString().slice(0, 10) : '';
      row.appendChild(dueCell);

      // Status cell
      var statusCell = document.createElement('td');
      statusCell.innerHTML = highlightTerm ? _highlightText(chit.status || '', highlightTerm) : (chit.status || '');
      row.appendChild(statusCell);

      // Click row to toggle checkbox
      if (!isDisabled) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(e) {
          if (e.target.tagName === 'INPUT') return;
          var checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
        if (onItemDblClick) {
          row.addEventListener('dblclick', function() {
            onItemDblClick(chit);
            disabledIds.add(chit.id);
            selectedIds.delete(chit.id);
            _renderList(filteredChits);
            _updateBtn();
          });
        }
      }

      listEl.appendChild(row);
    });
  }

  function _applyFilters() {
    var searchTerm = (searchInput.value || '').toLowerCase().trim();
    var statusVal = (statusFilter.value || '').toLowerCase();
    var priorityVal = (priorityFilter.value || '').toLowerCase();
    var includeEmail = emailCheckbox.checked;

    filteredChits = availableChits.filter(function(chit) {
      // Exclude email chits unless checkbox is checked
      if (!includeEmail && (chit.email_message_id || chit.email_status)) return false;
      if (statusVal && (chit.status || '').toLowerCase() !== statusVal) return false;
      if (priorityVal && (chit.priority || '').toLowerCase() !== priorityVal) return false;
      if (searchTerm && !chitMatchesSearch(chit, searchTerm)) return false;
      return true;
    });

    _renderList(filteredChits);
    if (headerH2) headerH2.textContent = title + ' (' + filteredChits.length + ' shown)';
  }

  // Close helper
  function _close() {
    modal.remove();
    document.removeEventListener('keydown', _escHandler, true);
  }

  // ESC handler
  function _escHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (searchInput && searchInput.value.trim()) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      } else {
        _close();
      }
    }
  }

  // Attach listeners
  searchInput.addEventListener('input', _applyFilters);
  statusFilter.addEventListener('change', _applyFilters);
  priorityFilter.addEventListener('change', _applyFilters);
  emailCheckbox.addEventListener('change', _applyFilters);
  confirmBtn.addEventListener('click', function() {
    var selected = [];
    selectedIds.forEach(function(id) {
      var chit = availableChits.find(function(c) { return c.id === id; });
      if (chit) selected.push(chit);
    });
    _close();
    if (onConfirm) onConfirm(selected);
  });
  cancelBtn.addEventListener('click', _close);
  modal.addEventListener('click', function(e) { if (e.target === modal) _close(); });
  document.addEventListener('keydown', _escHandler, true);

  // Fetch chits
  try {
    var resp = await fetch('/api/chits');
    if (!resp.ok) throw new Error('Failed to fetch chits');
    var allChits = await resp.json();

    availableChits = allChits
      .filter(function(c) { return !c.deleted && (!filterChits || filterChits(c)); })
      .sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });

    // Apply initial filter (excludes email chits by default)
    filteredChits = availableChits.filter(function(c) {
      return !(c.email_message_id || c.email_status);
    });
    _renderList(filteredChits);
    if (headerH2) headerH2.textContent = title + ' (' + filteredChits.length + ' available)';
    _updateBtn();
    setTimeout(function() { searchInput.focus(); }, 50);
  } catch (e) {
    console.error('[cwocChitPickerModal] Failed to fetch chits:', e);
    cwocToast('Failed to load chits.', 'error');
    _close();
  }
}

// ── Shared HTML Escape ───────────────────────────────────────────────────────

/**
 * Escape HTML special characters for safe insertion into the DOM.
 * Single source of truth — all pages use this instead of local copies.
 */
function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Shared Weather Utilities ─────────────────────────────────────────────────

/** WMO weather code → emoji icon map. Single source of truth. */
var _cwocWeatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

/** Get weather emoji icon for a WMO weather code. */
function _cwocGetWeatherIcon(code) {
  return _cwocWeatherIcons[code] || '❓';
}

/** Get precipitation type string from a WMO weather code. */
function _cwocGetPrecipType(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  return '';
}

/**
 * Format precipitation amount with type for display.
 * @param {number} precipMm - precipitation in millimeters
 * @param {number} weatherCode - WMO weather code
 * @param {string} [emptyVal=''] - what to return when there's no precipitation
 * @returns {string} formatted precipitation string
 */
function _cwocFormatPrecip(precipMm, weatherCode, emptyVal) {
  if (emptyVal === undefined) emptyVal = '';
  if (!precipMm || precipMm <= 0) return emptyVal;
  var pType = _cwocGetPrecipType(weatherCode);
  var cm = precipMm / 10;
  if (cm < 0.5) return pType || emptyVal;
  return Math.round(cm) + 'cm ' + pType;
}

// ── Shared Date Display ──────────────────────────────────────────────────────

/**
 * Convert a UTC ISO date string to a local display date (YYYY-Mon-DD).
 * Single source of truth — used by editor.js and main-modals.js.
 */
function _convertDBDateToDisplayDate(dateString) {
  if (!dateString) return '';
  var date = _utcToLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  return formatDate(date);
}

// ── Shared Contact Filter ────────────────────────────────────────────────────

/**
 * Check if a contact matches a search query across all fields.
 * Case-insensitive substring match against name, email, phone, address, org, etc.
 * Single source of truth — used by editor-people.js and maps.js.
 */
function cwocContactMatchesFilter(contact, query) {
  if (!query) return true;
  var q = query.toLowerCase();
  var c = contact;
  var fields = [
    c.display_name || '',
    c.given_name || '',
    c.surname || '',
    c.middle_names || '',
    c.nickname || '',
    c.organization || '',
    c.social_context || '',
    c.notes || ''
  ];
  // Multi-value fields
  var mvFields = ['emails', 'phones', 'addresses', 'call_signs', 'x_handles', 'websites'];
  for (var i = 0; i < mvFields.length; i++) {
    var arr = c[mvFields[i]];
    if (Array.isArray(arr)) {
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].value) fields.push(arr[j].value);
        if (arr[j] && arr[j].label) fields.push(arr[j].label);
      }
    }
  }
  // Tags
  if (Array.isArray(c.tags)) {
    for (var k = 0; k < c.tags.length; k++) {
      if (c.tags[k] && c.tags[k].name) fields.push(c.tags[k].name);
      else if (typeof c.tags[k] === 'string') fields.push(c.tags[k]);
    }
  }
  for (var f = 0; f < fields.length; f++) {
    if (fields[f] && fields[f].toLowerCase().indexOf(q) !== -1) return true;
  }
  return false;
}

// ── Shared Habit Cycle End ───────────────────────────────────────────────────

/**
 * Calculate the end-of-cycle datetime for a habit based on its recurrence frequency.
 * @param {string} freq - Recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY)
 * @returns {Date} End of the current cycle period
 */
function _cwocGetHabitCycleEnd(freq) {
  var now = new Date();
  var end = new Date(now);
  switch ((freq || 'DAILY').toUpperCase()) {
    case 'WEEKLY':
      end.setDate(end.getDate() + (7 - end.getDay()));
      end.setHours(0, 0, 0, 0);
      break;
    case 'MONTHLY':
      end.setMonth(end.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      break;
    case 'YEARLY':
      end.setFullYear(end.getFullYear() + 1, 0, 1);
      end.setHours(0, 0, 0, 0);
      break;
    default: // DAILY
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      break;
  }
  return end;
}

// ── Shared Highlight Match ───────────────────────────────────────────────────

/**
 * HTML-escape text and highlight matching query substrings with <mark> tags.
 * @param {string} text - raw text to display
 * @param {string} query - search query to highlight
 * @returns {string} HTML string with matches wrapped in <mark>
 */
function cwocHighlightMatch(text, query) {
  if (!text) return '';
  var escaped = _escHtml(text);
  if (!query) return escaped;
  var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}


// ── Attachment Preview Modal ─────────────────────────────────────────────────

/**
 * Show an attachment in a preview modal. Supports images, PDFs, text, and audio/video.
 * For unsupported types, shows filename with a download button.
 *
 * @param {string} url — the attachment download URL
 * @param {string} filename — display name
 * @param {string} mimeType — MIME type (e.g., "image/png", "application/pdf")
 */
function cwocAttachmentPreview(url, filename, mimeType) {
  // Remove any existing preview modal
  var existing = document.getElementById('cwocAttachmentPreviewModal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cwocAttachmentPreviewModal';
  overlay.className = 'cwoc-attachment-preview-overlay';

  var modal = document.createElement('div');
  modal.className = 'cwoc-attachment-preview-modal';

  // Header with filename and close button
  var header = document.createElement('div');
  header.className = 'cwoc-attachment-preview-header';
  var titleEl = document.createElement('span');
  titleEl.className = 'cwoc-attachment-preview-title';
  titleEl.textContent = filename || 'Attachment';
  header.appendChild(titleEl);

  var btnRow = document.createElement('div');
  btnRow.className = 'cwoc-attachment-preview-btns';
  var downloadBtn = document.createElement('a');
  downloadBtn.href = url;
  downloadBtn.download = filename || 'attachment';
  downloadBtn.className = 'cwoc-attachment-preview-dl';
  downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
  downloadBtn.addEventListener('click', function(e) { e.stopPropagation(); });
  btnRow.appendChild(downloadBtn);

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cwoc-attachment-preview-close';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(closeBtn);
  header.appendChild(btnRow);
  modal.appendChild(header);

  // Content area
  var content = document.createElement('div');
  content.className = 'cwoc-attachment-preview-content';

  var mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/')) {
    var img = document.createElement('img');
    img.src = url;
    img.alt = filename;
    img.style.cssText = 'max-width:100%;max-height:75vh;object-fit:contain;border-radius:4px;';
    content.appendChild(img);
  } else if (mime === 'application/pdf') {
    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:75vh;border:1px solid #c4a882;border-radius:4px;';
    content.appendChild(iframe);
  } else if (mime.startsWith('text/') || mime === 'application/json') {
    var pre = document.createElement('pre');
    pre.style.cssText = 'max-height:75vh;overflow:auto;padding:16px;background:#fff;border:1px solid #c4a882;border-radius:4px;font-size:0.85em;white-space:pre-wrap;word-break:break-word;';
    pre.textContent = 'Loading...';
    content.appendChild(pre);
    fetch(url).then(function(r) { return r.text(); }).then(function(text) {
      pre.textContent = text;
    }).catch(function() { pre.textContent = 'Failed to load file content.'; });
  } else if (mime.startsWith('audio/')) {
    var audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    audio.style.cssText = 'width:100%;margin-top:20px;';
    content.appendChild(audio);
  } else if (mime.startsWith('video/')) {
    var video = document.createElement('video');
    video.controls = true;
    video.src = url;
    video.style.cssText = 'max-width:100%;max-height:75vh;border-radius:4px;';
    content.appendChild(video);
  } else {
    // Unsupported type — show icon and download prompt
    var noPreview = document.createElement('div');
    noPreview.style.cssText = 'text-align:center;padding:40px 20px;color:#6b4e31;';
    noPreview.innerHTML = '<div style="font-size:3em;margin-bottom:16px;">📄</div>' +
      '<p style="margin:0 0 16px;">Preview not available for this file type.</p>' +
      '<a href="' + url + '" download="' + (filename || 'attachment') + '" class="zone-button" style="display:inline-block;"><i class="fas fa-download"></i> Download File</a>';
    content.appendChild(noPreview);
  }

  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // Close on ESC
  function _escHandler(e) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      overlay.remove();
      document.removeEventListener('keydown', _escHandler, true);
    }
  }
  document.addEventListener('keydown', _escHandler, true);
}
