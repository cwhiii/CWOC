/**
 * shared-utils.js — Core utility functions shared across all CWOC pages.
 *
 * Contains: ID generation, date/time formatting, color contrast helpers,
 * settings cache, save button state, and the cwocConfirm modal.
 *
 * This file MUST load first among all shared sub-scripts.
 * No dependencies on other shared sub-scripts.
 *
 * Dependents: shared-checklist.js, shared-sort.js, shared-indicators.js,
 *             shared-calendar.js, shared-tags.js, shared-recurrence.js,
 *             shared-geocoding.js, shared-qr.js, shared.js
 */

console.log('%c[CWOC] post-mega src/ layout — 20260429.1655', 'color:#8b4513;font-weight:bold;');

// ── Settings Cache ───────────────────────────────────────────────────────────
// Promise-based cache so concurrent callers share a single in-flight request.
// Call _invalidateSettingsCache() after saving settings to force a fresh fetch.

let _cwocSettingsPromise = null;

function getCachedSettings() {
  if (!_cwocSettingsPromise) {
    _cwocSettingsPromise = fetch('/api/settings/default_user')
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
    box.style.cssText = 'background:#fffaf0;border:2px solid #8b5a2b;border-radius:8px;padding:20px 28px;max-width:400px;width:90%;font-family:"Courier New",monospace;color:#2b1e0f;box-shadow:0 4px 16px rgba(0,0,0,0.3);text-align:center;';

    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 12px;font-size:1.2em;color:#4a2c2a;';
    h3.textContent = title;
    box.appendChild(h3);

    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 18px;font-size:1em;line-height:1.4;';
    p.textContent = message;
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
    confirmBtn.style.cssText = 'padding:8px 18px;font-family:inherit;cursor:pointer;' + (danger ? 'background:#a0522d;color:#fdf5e6;' : '');
    confirmBtn.onclick = function () { overlay.remove(); resolve(true); };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);

    // ESC to cancel
    var onKey = function (e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); }
    };
    document.addEventListener('keydown', onKey);

    // Click outside to cancel
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); } });

    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
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
