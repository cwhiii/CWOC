/**
 * editor-sharing.js — Sharing data-layer module for the chit editor
 *
 * Thin data-layer module that provides:
 *   - Fetching and caching the switchable user list (_sharingUserList)
 *   - getSharingData() for buildChitObject() in editor-save.js
 *   - hasSharingData() for applyZoneStates in editor-init.js
 *   - _getUserDisplayName() for looking up display names from the cached user list
 *
 * UI rendering has been moved to editor-people.js (merged People zone).
 *
 * Depends on: shared-auth.js (getCurrentUser)
 * Loaded before: editor-people.js, editor-init.js
 *
 * Requirements: 1.1
 */

// ── Module state ─────────────────────────────────────────────────────────────

/** Cached list of switchable users (fetched once). Exported as a global for editor-people.js. */
var _sharingUserList = null;


// ── User list fetching ───────────────────────────────────────────────────────

/**
 * Fetch the list of switchable users from the API (cached after first call).
 */
async function _loadSharingUserList() {
  if (_sharingUserList !== null) return;

  try {
    var response = await fetch('/api/auth/switchable-users');
    if (!response.ok) {
      console.error('[Sharing] Failed to load user list:', response.status);
      _sharingUserList = [];
      return;
    }
    _sharingUserList = await response.json();
  } catch (err) {
    console.error('[Sharing] Error loading user list:', err);
    _sharingUserList = [];
  }
}


// ── Display name lookup ──────────────────────────────────────────────────────

/**
 * Look up a user's display name from the cached user list.
 *
 * @param {string} userId
 * @returns {string}
 */
function _getUserDisplayName(userId) {
  if (!_sharingUserList) return '(Unknown User)';

  for (var i = 0; i < _sharingUserList.length; i++) {
    if (_sharingUserList[i].id === userId) {
      return _sharingUserList[i].display_name || _sharingUserList[i].username;
    }
  }

  // Check if we have a display_name in the current shares (from enriched API response)
  var shares = (typeof _currentShares !== 'undefined') ? _currentShares : [];
  for (var j = 0; j < shares.length; j++) {
    if (shares[j].user_id === userId && shares[j].display_name) {
      return shares[j].display_name;
    }
  }

  return '(Unknown User)';
}


// ── Save sharing data ────────────────────────────────────────────────────────

/**
 * Gather sharing fields for buildChitObject() in editor-save.js.
 *
 * Reads _currentShares from editor-people.js globals, stealth checkbox
 * from the people zone, and assigned-to dropdown from the task zone.
 *
 * @returns {Object} sharing fields to merge into the chit object
 */
function getSharingData() {
  // _sharingInitialized is set by editor-people.js when sharing controls are loaded
  if (typeof _sharingInitialized !== 'undefined' && !_sharingInitialized) {
    return { shares: null, stealth: false, assigned_to: null };
  }

  var stealthCheckbox = document.getElementById('sharingStealthToggle');
  var assignedToPicker = document.getElementById('sharingAssignedTo');

  // Read _currentShares from editor-people.js global
  var shares = (typeof _currentShares !== 'undefined') ? _currentShares : [];

  // Clean shares — strip display_name before saving, preserve rsvp_status
  var cleanShares = shares.map(function (s) {
    return { user_id: s.user_id, role: s.role, rsvp_status: s.rsvp_status || 'invited' };
  });

  return {
    shares: cleanShares.length > 0 ? cleanShares : null,
    stealth: stealthCheckbox ? stealthCheckbox.checked : false,
    assigned_to: (assignedToPicker && assignedToPicker.value) ? assignedToPicker.value : null,
  };
}


// ── Zone state for applyZoneStates ───────────────────────────────────────────

/**
 * Returns true if the sharing zone has data (shares, stealth, or assigned_to).
 * Used by applyZoneStates in editor-init.js.
 *
 * @param {Object} chit — the chit object
 * @returns {boolean}
 */
function hasSharingData(chit) {
  if (chit.stealth) return true;
  if (chit.assigned_to) return true;
  var shares = Array.isArray(chit.shares) ? chit.shares : [];
  return shares.length > 0;
}
