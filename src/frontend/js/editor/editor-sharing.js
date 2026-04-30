/**
 * editor-sharing.js — Sharing panel zone for the chit editor
 *
 * Provides the "🔗 Sharing" zone visible only to the chit owner.
 * Handles:
 *   - Loading and displaying current shares with role badges
 *   - User picker dropdown (from /api/auth/switchable-users)
 *   - Role selector (Manager / Viewer) and Add/Remove share buttons
 *   - Stealth toggle checkbox with 🥷 icon
 *   - Assigned-to user picker dropdown
 *   - Saving shares via PUT /api/chits/{chit_id}/shares
 *
 * Depends on: shared-auth.js (getCurrentUser), shared.js (setSaveButtonUnsaved),
 *             editor.js (chitId), editor-init.js (loadChitData)
 * Loaded before: editor-init.js
 *
 * Requirements: 1.6, 6.4, 7.5
 */

// ── Module state ─────────────────────────────────────────────────────────────

/** Cached list of switchable users (fetched once) */
var _sharingUserList = null;

/** Current shares array mirroring what's on the server */
var _currentShares = [];

/** Whether the sharing zone has been initialized for this chit */
var _sharingInitialized = false;


// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the sharing zone after chit data is loaded.
 * Called from loadChitData in editor-init.js.
 *
 * @param {Object} chit — the full chit object from the API
 */
async function initSharingZone(chit) {
  var section = document.getElementById('sharingSection');
  var content = document.getElementById('sharingContent');
  if (!section || !content) return;

  var currentUser = getCurrentUser();
  if (!currentUser) {
    section.style.display = 'none';
    return;
  }

  // Only show sharing zone to the chit owner
  var isOwner = chit.effective_role === 'owner' ||
                chit.owner_id === currentUser.user_id;

  if (!isOwner) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  _sharingInitialized = true;

  // Load the user list for dropdowns
  await _loadSharingUserList();

  // Populate the current shares list
  _currentShares = Array.isArray(chit.shares) ? chit.shares : [];

  // Set stealth toggle state
  var stealthCheckbox = document.getElementById('sharingStealthToggle');
  if (stealthCheckbox) {
    stealthCheckbox.checked = !!chit.stealth;
  }

  // Populate user picker dropdowns
  _populateUserPicker();
  _populateAssignedToPicker(chit.assigned_to);

  // Render current shares list
  _renderSharesList();
}

/**
 * Initialize the sharing zone for a new chit (no shares yet).
 * Shows the zone for the owner (current user is always owner of new chits).
 */
function initSharingZoneForNewChit() {
  var section = document.getElementById('sharingSection');
  if (!section) return;

  var currentUser = getCurrentUser();
  if (!currentUser) {
    section.style.display = 'none';
    return;
  }

  // New chits are always owned by the current user — show the zone
  section.style.display = '';
  _sharingInitialized = true;
  _currentShares = [];

  // Load user list and populate pickers
  _loadSharingUserList().then(function () {
    _populateUserPicker();
    _populateAssignedToPicker(null);
    _renderSharesList();
  });

  // Reset stealth toggle
  var stealthCheckbox = document.getElementById('sharingStealthToggle');
  if (stealthCheckbox) {
    stealthCheckbox.checked = false;
  }
}


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


// ── User picker dropdowns ────────────────────────────────────────────────────

/**
 * Populate the "Add user" dropdown with users not already in the shares list
 * and not the current user (owner).
 */
function _populateUserPicker() {
  var picker = document.getElementById('sharingUserPicker');
  if (!picker || !_sharingUserList) return;

  var currentUser = getCurrentUser();
  var currentUserId = currentUser ? currentUser.user_id : null;

  // Build set of already-shared user IDs
  var sharedIds = new Set();
  _currentShares.forEach(function (s) {
    sharedIds.add(s.user_id);
  });

  picker.innerHTML = '<option value="">— Select User —</option>';

  _sharingUserList.forEach(function (user) {
    // Skip the owner and already-shared users
    if (user.id === currentUserId) return;
    if (sharedIds.has(user.id)) return;

    var opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.display_name || user.username;
    picker.appendChild(opt);
  });
}

/**
 * Populate the assigned-to dropdown with all users except the owner.
 *
 * @param {string|null} assignedTo — current assigned_to user ID
 */
function _populateAssignedToPicker(assignedTo) {
  var picker = document.getElementById('sharingAssignedTo');
  if (!picker || !_sharingUserList) return;

  var currentUser = getCurrentUser();
  var currentUserId = currentUser ? currentUser.user_id : null;

  picker.innerHTML = '<option value="">— None —</option>';

  _sharingUserList.forEach(function (user) {
    // Skip the owner
    if (user.id === currentUserId) return;

    var opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.display_name || user.username;
    picker.appendChild(opt);
  });

  // Set current value
  if (assignedTo) {
    picker.value = assignedTo;
  }
}


// ── Shares list rendering ────────────────────────────────────────────────────

/**
 * Render the current shares list with role badges and remove buttons.
 */
function _renderSharesList() {
  var container = document.getElementById('sharingCurrentList');
  if (!container) return;

  if (_currentShares.length === 0) {
    container.innerHTML = '<div class="sharing-empty">No users shared with this chit</div>';
    return;
  }

  container.innerHTML = '';

  _currentShares.forEach(function (share) {
    var row = document.createElement('div');
    row.className = 'sharing-list-item';

    // User display name
    var nameSpan = document.createElement('span');
    nameSpan.className = 'sharing-user-name';
    nameSpan.textContent = _getUserDisplayName(share.user_id);
    row.appendChild(nameSpan);

    // Role badge
    var badge = document.createElement('span');
    badge.className = 'sharing-role-badge sharing-role-' + share.role;
    badge.textContent = share.role === 'manager' ? '✏️ Manager' : '👁️ Viewer';
    row.appendChild(badge);

    // Remove button
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'sharing-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove share';
    removeBtn.setAttribute('data-user-id', share.user_id);
    removeBtn.addEventListener('click', function () {
      _removeShare(share.user_id);
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

/**
 * Look up a user's display name from the cached user list.
 *
 * @param {string} userId
 * @returns {string}
 */
function _getUserDisplayName(userId) {
  if (!_sharingUserList) return userId;

  for (var i = 0; i < _sharingUserList.length; i++) {
    if (_sharingUserList[i].id === userId) {
      return _sharingUserList[i].display_name || _sharingUserList[i].username;
    }
  }

  // Check if we have a display_name in the current shares (from enriched API response)
  for (var j = 0; j < _currentShares.length; j++) {
    if (_currentShares[j].user_id === userId && _currentShares[j].display_name) {
      return _currentShares[j].display_name;
    }
  }

  return userId;
}


// ── Add / Remove shares ──────────────────────────────────────────────────────

/**
 * Add a share from the user picker and role selector.
 * Called by the "Add" button onclick.
 */
function addShare() {
  var picker = document.getElementById('sharingUserPicker');
  var roleSelect = document.getElementById('sharingRoleSelect');
  if (!picker || !roleSelect) return;

  var userId = picker.value;
  var role = roleSelect.value;

  if (!userId) {
    alert('Please select a user to share with.');
    return;
  }

  // Check if already shared
  for (var i = 0; i < _currentShares.length; i++) {
    if (_currentShares[i].user_id === userId) {
      alert('This user already has access to this chit.');
      return;
    }
  }

  _currentShares.push({ user_id: userId, role: role });

  // Re-render and refresh the picker (to remove the added user)
  _renderSharesList();
  _populateUserPicker();

  // Mark editor as unsaved
  setSaveButtonUnsaved();
}

/**
 * Remove a user from the shares list.
 *
 * @param {string} userId — the user ID to remove
 */
function _removeShare(userId) {
  _currentShares = _currentShares.filter(function (s) {
    return s.user_id !== userId;
  });

  _renderSharesList();
  _populateUserPicker();
  setSaveButtonUnsaved();
}


// ── Stealth toggle ───────────────────────────────────────────────────────────

/**
 * Handle stealth toggle change.
 * Called by the checkbox onchange.
 */
function onStealthToggle() {
  setSaveButtonUnsaved();
}


// ── Assigned-to change ───────────────────────────────────────────────────────

/**
 * Handle assigned-to dropdown change.
 * Called by the select onchange.
 */
function onAssignedToChange() {
  setSaveButtonUnsaved();
}


// ── Save sharing data ────────────────────────────────────────────────────────

/**
 * Save the current shares to the server via PUT /api/chits/{chit_id}/shares.
 * Also updates stealth and assigned_to on the chit via the normal save flow.
 *
 * This is called from buildChitObject in editor-save.js to include sharing
 * data in the chit save payload.
 *
 * @returns {Object} sharing fields to merge into the chit object
 */
function getSharingData() {
  if (!_sharingInitialized) {
    return { shares: null, stealth: false, assigned_to: null };
  }

  var stealthCheckbox = document.getElementById('sharingStealthToggle');
  var assignedToPicker = document.getElementById('sharingAssignedTo');

  // Clean shares — strip display_name before saving
  var cleanShares = _currentShares.map(function (s) {
    return { user_id: s.user_id, role: s.role };
  });

  return {
    shares: cleanShares.length > 0 ? cleanShares : null,
    stealth: stealthCheckbox ? stealthCheckbox.checked : false,
    assigned_to: (assignedToPicker && assignedToPicker.value) ? assignedToPicker.value : null,
  };
}

/**
 * Save shares to the dedicated sharing endpoint after the main chit save.
 * Called after a successful chit save when the chit already exists.
 *
 * @param {string} chitIdToSave — the chit ID to save shares for
 */
async function saveSharingData(chitIdToSave) {
  if (!_sharingInitialized || !chitIdToSave) return;

  // Clean shares — strip display_name
  var cleanShares = _currentShares.map(function (s) {
    return { user_id: s.user_id, role: s.role };
  });

  try {
    var response = await fetch('/api/chits/' + encodeURIComponent(chitIdToSave) + '/shares', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shares: cleanShares }),
    });

    if (!response.ok) {
      var errorText = await response.text();
      console.error('[Sharing] Failed to save shares:', response.status, errorText);
    }
  } catch (err) {
    console.error('[Sharing] Error saving shares:', err);
  }
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
