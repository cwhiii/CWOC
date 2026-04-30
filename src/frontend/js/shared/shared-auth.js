/**
 * shared-auth.js — Frontend authentication guard for all CWOC pages.
 *
 * This file MUST load BEFORE shared-utils.js in the script order.
 * It runs on every page (except login.html) and:
 *   1. Calls GET /api/auth/me on page load
 *   2. If 401: stores current URL in localStorage, redirects to /login
 *   3. Caches the authenticated user object for other scripts
 *
 * Exports (globals):
 *   getCurrentUser()  — returns the cached user object or null
 *   isAdmin()         — returns true if the cached user has is_admin === true
 *
 * No dependencies on other shared sub-scripts.
 *
 * Dependents: shared-utils.js (uses getCurrentUser() for settings fetch),
 *             shared-page.js (uses getCurrentUser() for header display)
 */

// ── Auth State ───────────────────────────────────────────────────────────────

var _cwocCurrentUser = null;
var _cwocAuthReady = null; // Promise that resolves when auth check completes

/**
 * Returns the cached authenticated user object, or null if not yet loaded
 * or if the auth check failed.
 *
 * Shape: { user_id, username, display_name, email, is_admin, profile_image_url }
 */
function getCurrentUser() {
  return _cwocCurrentUser;
}

/**
 * Returns true if the cached user has admin privileges.
 */
function isAdmin() {
  return !!(_cwocCurrentUser && _cwocCurrentUser.is_admin);
}

/**
 * Returns a Promise that resolves to the user object once the auth check
 * completes. Other scripts can await this to ensure auth is ready.
 */
function waitForAuth() {
  return _cwocAuthReady;
}

// ── Auth Check (runs immediately) ────────────────────────────────────────────

_cwocAuthReady = (async function _checkAuth() {
  try {
    var response = await fetch('/api/auth/me');

    if (response.status === 401) {
      // Store current URL for post-login redirect
      localStorage.setItem('cwoc_auth_return', window.location.href);
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      console.error('[CWOC Auth] Unexpected response from /api/auth/me:', response.status);
      return null;
    }

    var user = await response.json();
    _cwocCurrentUser = user;
    console.log('%c[CWOC Auth] Authenticated as ' + user.display_name + ' (' + user.username + ')',
      'color:#2e7d32;font-weight:bold;');
    return user;
  } catch (err) {
    console.error('[CWOC Auth] Auth check failed:', err);
    // Network error — don't redirect, let the page degrade gracefully
    return null;
  }
})();
