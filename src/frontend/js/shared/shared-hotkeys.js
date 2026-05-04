/**
 * shared-hotkeys.js — Universal hotkey dispatch for all pages.
 *
 * Provides the top-level hotkey mappings (tab switching, actions, navigation)
 * in a single file loaded by both the dashboard and secondary pages.
 *
 * On the dashboard, tab keys call filterChits() directly and action keys
 * invoke their native functions (_openClockModal, _openWeatherModal, etc.).
 * On secondary pages, tab keys navigate to the dashboard with the target
 * tab set via localStorage (cwoc_jump_tab).
 *
 * Depends on: nothing (guards all function calls with typeof checks)
 * Loaded before: main-init.js (dashboard), shared-page.js (secondary pages)
 */

// ── Tab map: key → tab name ─────────────────────────────────────────────────
var _cwocHotkeyTabMap = {
  c: 'Calendar',
  h: 'Checklists',
  a: 'Alarms',
  p: 'Projects',
  t: 'Tasks',
  n: 'Notes',
  e: 'Email',
  i: 'Indicators',
  g: 'Search'
};

/**
 * Returns true if we're on the main dashboard (index.html).
 */
function _cwocIsDashboard() {
  var path = window.location.pathname;
  return path === '/' || path === '/index.html' || path === '/frontend/html/index.html';
}

/**
 * Handle a tab hotkey press. On the dashboard, switches tabs directly.
 * On secondary pages, navigates to the dashboard with the tab pre-selected.
 * @param {string} tabName — e.g. 'Calendar', 'Tasks', 'Email'
 */
function _cwocSwitchTab(tabName) {
  if (_cwocIsDashboard() && typeof filterChits === 'function') {
    filterChits(tabName);
  } else {
    localStorage.setItem('cwoc_jump_tab', tabName);
    window.location.href = '/';
  }
}

/**
 * Handle action hotkeys that work the same everywhere.
 * Returns true if the key was handled, false otherwise.
 * @param {string} keyLower — lowercase key
 * @param {KeyboardEvent} e — the original event
 * @returns {boolean}
 */
function _cwocHandleActionHotkey(keyLower, e) {
  var isDash = _cwocIsDashboard();

  // K — Create chit
  if (keyLower === 'k') {
    e.preventDefault();
    if (isDash && typeof storePreviousState === 'function') storePreviousState();
    if (isDash && typeof currentTab !== 'undefined' && currentTab === 'Email') {
      window.location.href = '/frontend/html/editor.html?new=email&expand=email';
    } else {
      window.location.href = '/frontend/html/editor.html';
    }
    return true;
  }

  // S — Settings
  if (keyLower === 's') {
    e.preventDefault();
    if (isDash && typeof storePreviousState === 'function') storePreviousState();
    localStorage.setItem('cwoc_settings_return', isDash ? '/' : window.location.pathname);
    window.location.href = '/frontend/html/settings.html';
    return true;
  }

  // W — Weather page / Shift+W — Weather modal
  if (keyLower === 'w') {
    e.preventDefault();
    if (e.shiftKey) {
      // Weather modal — only available on dashboard
      if (isDash && typeof _openWeatherModal === 'function') {
        _openWeatherModal();
      }
      // On secondary pages, Shift+W is a no-op (modal not available)
    } else {
      if (isDash && typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/frontend/html/weather.html';
    }
    return true;
  }

  // L — Clock modal
  if (keyLower === 'l') {
    e.preventDefault();
    if (isDash && typeof _openClockModal === 'function') {
      _openClockModal();
    }
    // On secondary pages, no clock modal available — no-op
    return true;
  }

  // R — Reference overlay / Shift+R — Help page
  if (keyLower === 'r') {
    e.preventDefault();
    if (e.shiftKey) {
      if (typeof openHelpPage === 'function') {
        openHelpPage();
      } else {
        window.location.href = '/frontend/html/help.html';
      }
    } else {
      if (isDash && typeof _toggleReference === 'function') {
        _toggleReference();
      }
      // On secondary pages, no reference overlay — no-op
    }
    return true;
  }

  return false;
}

/**
 * Main hotkey dispatch — called from the keydown listener.
 * Handles tab switching and action keys. Returns true if handled.
 * Dashboard-only features (submenus, filters, modes) are NOT here —
 * they stay in main-init.js since they need dashboard DOM/state.
 *
 * @param {KeyboardEvent} e
 * @returns {boolean} true if the key was consumed
 */
function _cwocDispatchHotkey(e) {
  var el = document.activeElement;
  var tag = el ? (el.tagName || '').toLowerCase() : '';
  var inputType = el ? (el.type || '').toLowerCase() : '';
  var isTextInput = (tag === 'input' && inputType !== 'checkbox' && inputType !== 'radio')
    || tag === 'textarea' || tag === 'select'
    || (el && el.isContentEditable);
  if (isTextInput) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;

  var key = e.key;
  var keyLower = key.toLowerCase();

  // On the dashboard, defer to the existing _hotkeyMode state machine
  // (submenus, filters, etc.) — those are handled in main-init.js
  if (_cwocIsDashboard() && typeof _hotkeyMode !== 'undefined' && _hotkeyMode) {
    return false; // let main-init.js handle it
  }

  // Tab switching
  if (_cwocHotkeyTabMap[keyLower] && !e.shiftKey) {
    e.preventDefault();
    _cwocSwitchTab(_cwocHotkeyTabMap[keyLower]);
    return true;
  }

  // Action keys
  return _cwocHandleActionHotkey(keyLower, e);
}
