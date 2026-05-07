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

console.log('%c[CWOC] post-mega src/ layout — 20260429.1655', 'color:#8b4513;font-weight:bold;');

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
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); }
    };
    document.addEventListener('keydown', onKey);

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
  // Known field prefixes for field:value syntax
  var _fieldNames = ['title','note','notes','location','loc','status','priority','severity',
    'color','people','person','assigned','assigned_to','checklist','subject','sender',
    'from','to','cc','bcc','body','child','start','end','due','created','modified'];
  while (i < q.length) {
    if (q[i] === ' ' || q[i] === '\t') { i++; continue; }
    if (q[i] === '(' || q[i] === ')') { i++; continue; }
    if (q.substring(i, i + 2) === '&&' || q.substring(i, i + 2) === '||') { i += 2; continue; }
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
    // Read a word (may be field:value)
    var start2 = i;
    while (i < q.length && ' \t()&|!#'.indexOf(q[i]) === -1) i++;
    var word = q.substring(start2, i);
    // Check for field:value syntax
    var colonPos = word.indexOf(':');
    if (colonPos > 0) {
      var fieldPart = word.substring(0, colonPos);
      if (_fieldNames.indexOf(fieldPart) !== -1) {
        var valuePart = word.substring(colonPos + 1);
        if (!valuePart && i < q.length && q[i] === '(') {
          // field:(multi word value) — extract the parenthesized content
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
  var parts = terms.map(function(t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, '\\' + '$&');
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
