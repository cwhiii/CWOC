/**
 * editor-people.js — People zone: contacts, system users, sharing controls
 *
 * Loads all contacts and system users from the API, renders them in a merged
 * grouped alphabetical tree, manages people chips (add/remove), syncs the
 * hidden people field for save, provides search/filter within the people tree,
 * and manages sharing state (shares, stealth, assigned-to).
 *
 * System users appear with inline pill toggles (Viewer/Manager) for role
 * selection. Contacts appear as plain chips (no pill toggle).
 *
 * Depends on: shared.js (setSaveButtonUnsaved, isLightColor),
 *             shared-auth.js (getCurrentUser),
 *             editor-sharing.js (_sharingUserList, _loadSharingUserList, getSharingData)
 * Loaded after: editor-sharing.js
 * Loaded before: editor-init.js, editor.js
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10,
 *               2.2, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

// ── Existing people state ────────────────────────────────────────────────────

var _peopleDropdown = null;
var _peopleDebounceTimer = null;
var _peopleApiAvailable = true;
var _peopleChipData = []; // Array of {display_name, id, color, image_url}
var _allContactsCache = []; // Full contacts list for the tree
var _peopleGroupsExpanded = {}; // Track which letter groups are expanded
var _currentPeopleFilter = ''; // Current search filter (preserved across re-renders)

// ── Sharing state (Task 5.1) ────────────────────────────────────────────────

var _allUsersCache = [];       // System users from /api/auth/switchable-users
var _currentShares = [];       // Array of {user_id, role, display_name?}
var _sharingInitialized = false;
var _effectiveRole = null;     // 'owner', 'manager', 'viewer', or null (for new chits)
var _chitOwnerId = null;       // Owner user_id of the current chit (used to hide owner from people list)
var _chitOwnerDisplayName = null; // Owner display name (for assignee dropdown)

// ── People search ────────────────────────────────────────────────────────────

function _focusPeopleSearch() {
  var input = document.getElementById('peopleSearchInput');
  if (input) input.focus();
}

function _initPeopleAutocomplete() {
  _loadAllContactsForTree();
  _loadAllUsersForTree();

  var input = document.getElementById('peopleSearchInput');
  if (!input) return;

  input.addEventListener('input', function () {
    _currentPeopleFilter = input.value.trim().toLowerCase();
    _renderPeopleTree();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      _currentPeopleFilter = '';
      _renderPeopleTree();
      input.blur();
    }
    // Enter adds the typed name as a free-text person (if not empty)
    if (e.key === 'Enter') {
      e.preventDefault();
      var name = input.value.trim();
      if (!name) return;
      _addPeopleChip({ display_name: name, id: null, color: null, image_url: null });
      input.value = '';
      _currentPeopleFilter = '';
    }
  });

  // Wire up assigned-to dropdown change handler (Requirements 2.1, 2.2, 2.3)
  var assignedSelect = document.getElementById('sharingAssignedTo');
  if (assignedSelect) {
    assignedSelect.addEventListener('change', function () {
      _onAssignedToChange();
      setSaveButtonUnsaved();
    });
  }
}

function _clearPeopleSearch(event) {
  if (event) event.stopPropagation();
  var input = document.getElementById('peopleSearchInput');
  if (input) { input.value = ''; }
  _currentPeopleFilter = '';
  _renderPeopleTree();
}

// ── Contact loading ──────────────────────────────────────────────────────────

async function _loadAllContactsForTree() {
  try {
    var resp = await fetch('/api/contacts');
    if (!resp.ok) {
      console.error('[People] Contacts API returned status:', resp.status);
      _renderPeopleTree();
      return;
    }
    _allContactsCache = await resp.json();
    _renderPeopleTree();
    // Re-render chips to pick up colors/images if chips were loaded before cache
    if (_peopleChipData.length > 0) {
      var contactMap = {};
      _allContactsCache.forEach(function (c) {
        contactMap[(c.display_name || '').toLowerCase()] = c;
      });
      _peopleChipData.forEach(function (chip) {
        var match = contactMap[(chip.display_name || '').toLowerCase()];
        if (match) {
          chip.color = match.color || chip.color;
          chip.image_url = match.image_url || chip.image_url;
          chip.id = match.id || chip.id;
        }
      });
      _renderPeopleChips();
    }
  } catch (e) {
    console.error('[People] Failed to load contacts for tree:', e);
    _renderPeopleTree();
  }
}

// ── System user loading (Task 5.1) ──────────────────────────────────────────

async function _loadAllUsersForTree() {
  try {
    // Reuse the sharing user list if already loaded
    if (typeof _sharingUserList !== 'undefined' && _sharingUserList && _sharingUserList.length > 0) {
      _allUsersCache = _sharingUserList;
      _renderPeopleTree();
      return;
    }
    // Otherwise load via the sharing data-layer function
    if (typeof _loadSharingUserList === 'function') {
      await _loadSharingUserList();
      _allUsersCache = (typeof _sharingUserList !== 'undefined' && _sharingUserList) ? _sharingUserList : [];
    } else {
      var resp = await fetch('/api/auth/switchable-users');
      if (!resp.ok) {
        console.error('[People] Failed to load system users:', resp.status);
        _allUsersCache = [];
        _renderPeopleTree();
        return;
      }
      _allUsersCache = await resp.json();
    }
    _renderPeopleTree();
  } catch (e) {
    console.error('[People] Error loading system users:', e);
    _allUsersCache = [];
    _renderPeopleTree();
  }
}

// ── Merged tree rendering (Task 5.2) ────────────────────────────────────────

function _renderPeopleTree(filter) {
  var container = document.getElementById('peopleTreeContainer');
  if (!container) return;
  container.innerHTML = '';

  // Use the stored filter if none is passed explicitly
  if (filter === undefined) filter = _currentPeopleFilter || undefined;

  // Get current user to exclude from system user list
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

  // Determine if sharing controls should be shown
  var showSharingControls = (_effectiveRole === 'owner' || _effectiveRole === 'manager' || _effectiveRole === null);

  // ── Filter contacts (search all fields) ──
  var contacts = _allContactsCache;
  if (filter) {
    contacts = contacts.filter(function (c) {
      return _contactMatchesFilter(c, filter);
    });
  }

  // ── Filter system users (exclude current user and owner for non-owners) ──
  var systemUsers = (_allUsersCache || []).filter(function (u) {
    var uid = u.id || u.user_id;
    if (currentUserId && uid === currentUserId) return false;
    // Hide the owner from the people list for non-owner users
    if (_chitOwnerId && _effectiveRole !== 'owner' && _effectiveRole !== null && uid === _chitOwnerId) return false;
    if (filter) {
      var matchesDisplay = (u.display_name || '').toLowerCase().includes(filter);
      var matchesUsername = (u.username || '').toLowerCase().includes(filter);
      if (!matchesDisplay && !matchesUsername) return false;
    }
    return true;
  });

  // ── Build merged groups ──
  // Each entry: { type: 'contact'|'user', data: ... }
  var groups = {};

  contacts.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push({ type: 'contact', data: c });
  });

  systemUsers.forEach(function (u) {
    var letter = ((u.display_name || u.username || '?')[0] || '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push({ type: 'user', data: u });
  });

  var letters = Object.keys(groups).sort();

  // Sort each group: contacts first (favorites first, then alpha), then users (alpha)
  letters.forEach(function (letter) {
    groups[letter].sort(function (a, b) {
      // Contacts before users
      if (a.type !== b.type) return a.type === 'contact' ? -1 : 1;
      if (a.type === 'contact') {
        if (a.data.favorite && !b.data.favorite) return -1;
        if (!a.data.favorite && b.data.favorite) return 1;
      }
      var nameA = (a.data.display_name || '').toLowerCase();
      var nameB = (b.data.display_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  });

  letters.forEach(function (letter) {
    var isExpanded = _peopleGroupsExpanded[letter] !== false; // default expanded

    // Count visible items (contacts not already added, users not already shared)
    var visibleCount = 0;
    groups[letter].forEach(function (entry) {
      if (entry.type === 'contact') {
        var isActive = _peopleChipData.some(function (p) {
          return p.display_name.toLowerCase() === (entry.data.display_name || '').toLowerCase();
        });
        if (!isActive) visibleCount++;
      } else {
        var uid = entry.data.id || entry.data.user_id;
        var isShared = _findShareByUserId(uid);
        if (!isShared && showSharingControls) visibleCount++;
      }
    });

    // Skip empty groups entirely
    if (visibleCount === 0) return;

    var groupDiv = document.createElement('div');
    groupDiv.className = 'people-tree-group';
    groupDiv.dataset.letter = letter;

    var header = document.createElement('div');
    header.className = 'people-tree-group-header';
    header.style.cssText = 'cursor:pointer;font-weight:bold;font-size:0.85em;color:#6b4e31;padding:2px 0;user-select:none;display:flex;align-items:center;gap:4px;';
    header.innerHTML = '<span class="people-tree-arrow">' + (isExpanded ? '▼' : '▶') + '</span> ' + letter + ' <span style="opacity:0.5;font-weight:normal;">(' + visibleCount + ')</span>';
    header.addEventListener('click', function () {
      _peopleGroupsExpanded[letter] = !isExpanded;
      _renderPeopleTree(filter);
    });
    groupDiv.appendChild(header);

    if (isExpanded) {
      groups[letter].forEach(function (entry) {
        if (entry.type === 'contact') {
          _renderContactChipInTree(groupDiv, entry.data);
        } else {
          _renderUserChipInTree(groupDiv, entry.data, showSharingControls);
        }
      });
    }

    container.appendChild(groupDiv);
  });

  if (container.children.length === 0) {
    var emptyMsg = filter
      ? 'No matches for "' + filter + '". Press Enter to add as a person.'
      : 'No contacts or users found. Type a name and press Enter to add.';
    container.innerHTML = '<div style="color:#6b4e31;font-size:0.85em;padding:8px;">' + emptyMsg + '</div>';
  }

  // Render stealth toggle at the bottom (Task 5.4)
  _renderStealthToggle();
}

/**
 * Render a contact chip in the tree (plain chip, no pill toggle).
 * Contacts that are already added to the chit are hidden completely in the left column.
 */
function _renderContactChipInTree(parent, c) {
  var isActive = _peopleChipData.some(function (p) {
    return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase();
  });

  // Hide completely when already added to the chit
  if (isActive) return;

  var chip = document.createElement('span');
  chip.className = 'people-chip';
  chip.style.margin = '2px 0 2px 12px';
  if (c.color) {
    chip.style.backgroundColor = c.color;
    chip.style.color = _isLightColor(c.color) ? '#2b1e0f' : '#fff';
    chip.style.borderColor = c.color;
  }

  var thumbEl = document.createElement('span');
  thumbEl.className = 'chip-thumb';
  if (c.image_url) {
    thumbEl.innerHTML = '<img src="' + c.image_url + '" />';
  } else {
    thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
  }
  chip.appendChild(thumbEl);

  var nameSpan = document.createElement('span');
  nameSpan.className = 'chip-name-text';
  var starPrefix = c.favorite ? '★ ' : '';
  nameSpan.textContent = starPrefix + (c.display_name || c.given_name || '(unnamed)');
  chip.appendChild(nameSpan);

  chip.addEventListener('click', function () {
    _addPeopleChip({ display_name: c.display_name, id: c.id, color: c.color || null, image_url: c.image_url || null });
  });

  parent.appendChild(chip);
}

/**
 * Render a system user chip in the tree (left column).
 * Users show as simple clickable chips with display_name and username tooltip.
 * Clicking moves them to the right column (shared users). No pill toggle here.
 * Users already shared are hidden from the left column.
 */
function _renderUserChipInTree(parent, u, showControls) {
  var userId = u.id || u.user_id;
  var shareEntry = _findShareByUserId(userId);
  var isShared = !!shareEntry;

  // Hide completely when already shared (moved to right column)
  if (isShared) return;

  // Only show clickable chip if controls are available
  if (!showControls) return;

  // User chip (simple, clickable)
  var chip = document.createElement('span');
  chip.className = 'people-chip people-chip-user';
  chip.style.margin = '2px 0 2px 12px';
  chip.style.cursor = 'pointer';
  chip.title = u.username || ''; // Show username on hover

  // Apply user color if available
  if (u.color) {
    chip.style.backgroundColor = u.color;
    chip.style.color = _isLightColor(u.color) ? '#2b1e0f' : '#fff';
  }

  var thumbEl = document.createElement('span');
  thumbEl.className = 'chip-thumb';
  if (u.profile_image_url) {
    thumbEl.innerHTML = '<img src="' + u.profile_image_url + '" />';
  } else {
    thumbEl.innerHTML = '<span class="chip-thumb-placeholder chip-thumb-user"><i class="fas fa-users"></i></span>';
  }
  chip.appendChild(thumbEl);

  var nameSpan = document.createElement('span');
  nameSpan.className = 'chip-name-text';
  nameSpan.textContent = u.display_name || u.username || '(unknown)';
  chip.appendChild(nameSpan);

  // Click adds user as shared viewer (moves to right column)
  chip.addEventListener('click', function () {
    _addShare(userId, 'viewer', u.display_name || u.username);
  });

  parent.appendChild(chip);
}

// ── Share mutation helpers (Task 5.3) ────────────────────────────────────────

function _getUserInfoById(userId) {
  for (var i = 0; i < _allUsersCache.length; i++) {
    var u = _allUsersCache[i];
    if ((u.id || u.user_id) === userId) return u;
  }
  return null;
}

function _findShareByUserId(userId) {
  for (var i = 0; i < _currentShares.length; i++) {
    if (_currentShares[i].user_id === userId) return _currentShares[i];
  }
  return null;
}

function _addShare(userId, role, displayName) {
  if (_findShareByUserId(userId)) return; // already shared

  // Self-invite prevention (Requirement 1.6)
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;
  if (currentUserId && userId === currentUserId) return;

  _currentShares.push({ user_id: userId, role: role, display_name: displayName || '(Unknown User)', rsvp_status: 'invited' });
  setSaveButtonUnsaved();
  _renderPeopleChips();
  _renderPeopleTree();
  _updateActivePeopleCount();
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();
}

function _removeShare(userId) {
  _currentShares = _currentShares.filter(function (s) { return s.user_id !== userId; });
  setSaveButtonUnsaved();
  _renderPeopleChips();
  _renderPeopleTree();
  _updateActivePeopleCount();
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();
}

function _updateShareRole(userId, newRole) {
  var wasAssigned = false;

  // If downgrading to viewer, check if this user is currently assigned
  if (newRole === 'viewer') {
    var assignedSelect = document.getElementById('sharingAssignedTo');
    if (assignedSelect && assignedSelect.value === userId) {
      wasAssigned = true;
      assignedSelect.value = '';
      _onAssignedToChange();
    }
  }

  for (var i = 0; i < _currentShares.length; i++) {
    if (_currentShares[i].user_id === userId) {
      _currentShares[i].role = newRole;
      break;
    }
  }
  setSaveButtonUnsaved();
  _renderPeopleChips();
  _renderPeopleTree();
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();

  // Flash assign indicators if we just unassigned
  if (wasAssigned) {
    // Flash in expand modal
    _renderExpandModalContent();
    setTimeout(function () {
      var allBtns = document.querySelectorAll('.cwoc-people-expand-assign-btn');
      allBtns.forEach(function (btn) {
        if (!btn.classList.contains('cwoc-people-expand-assigned-active')) {
          btn.classList.add('cwoc-pex-assign-flash');
          setTimeout(function () { btn.classList.remove('cwoc-pex-assign-flash'); }, 1200);
        }
      });
    }, 50);

    // Flash in compact view
    setTimeout(function () {
      var badge = document.querySelector('.cwoc-compact-assign-badge[data-user-id="' + userId + '"]');
      if (badge) {
        badge.classList.add('cwoc-pex-assign-flash');
        setTimeout(function () { badge.classList.remove('cwoc-pex-assign-flash'); }, 1200);
      }
    }, 50);
  }
}

// ── Stealth toggle (Task 5.4) ────────────────────────────────────────────────

function _renderStealthToggle() {
  var container = document.getElementById('peopleContent');
  if (!container) return;

  // Remove existing stealth toggle row if present (legacy)
  var existing = document.getElementById('cwoc-stealth-toggle-row');
  if (existing) existing.remove();

  // Ensure hidden checkbox exists for data reading
  var cb = document.getElementById('sharingStealthToggle');
  if (!cb) {
    cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'sharingStealthToggle';
    cb.style.display = 'none';
    container.appendChild(cb);
  }

  _updateStealthHeaderBtn();
}

function _toggleStealthFromHeader(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var cb = document.getElementById('sharingStealthToggle');
  if (!cb) return;
  cb.checked = !cb.checked;
  setSaveButtonUnsaved();
  _applyStealthGreyout();
  _updateStealthHeaderBtn();
}

function _updateStealthHeaderBtn() {
  var btn = document.getElementById('stealthHeaderBtn');
  if (!btn) return;
  var cb = document.getElementById('sharingStealthToggle');
  var isActive = cb && cb.checked;
  if (isActive) {
    btn.style.background = '#6b4e31';
    btn.style.color = '#fff';
    btn.title = 'Stealth ON — hidden from other users (click to disable)';
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.title = 'Stealth — hide from all other users';
  }
  // Hide for viewers
  if (_effectiveRole === 'viewer') {
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
  }
}

// ── Assigned-to dropdown sync (Requirement 2.5) ─────────────────────────

// ── Stealth greyout — disable sharing & assignment when stealth is on ────

function _applyStealthGreyout() {
  var stealthCb = document.getElementById('sharingStealthToggle');
  var isStealth = stealthCb && stealthCb.checked;

  // Grey out the people tree container (sharing controls)
  var treeContainer = document.getElementById('peopleTreeContainer');
  if (treeContainer) {
    treeContainer.style.opacity = isStealth ? '0.35' : '';
    treeContainer.style.pointerEvents = isStealth ? 'none' : '';
  }

  // Grey out the people chips (shared users)
  var chipsContainer = document.getElementById('peopleChips');
  if (chipsContainer) {
    chipsContainer.style.opacity = isStealth ? '0.35' : '';
    chipsContainer.style.pointerEvents = isStealth ? 'none' : '';
  }

  // Grey out the assigned-to row
  var assignedRow = document.getElementById('sharingAssignedRow');
  if (assignedRow) {
    assignedRow.style.opacity = isStealth ? '0.35' : '';
    assignedRow.style.pointerEvents = isStealth ? 'none' : '';
  }

  // Grey out the people search
  var searchInput = document.getElementById('peopleSearchInput');
  if (searchInput) {
    searchInput.disabled = !!isStealth;
    searchInput.style.opacity = isStealth ? '0.35' : '';
  }
}

/**
 * Handle assigned-to dropdown change: auto-add user to shares as manager.
 * Requirements 2.1, 2.2, 2.3, 10.2, 10.3
 */
function _onAssignedToChange() {
  var select = document.getElementById('sharingAssignedTo');
  if (!select) return;

  var userId = select.value;
  if (!userId) {
    // "None" selected — re-render to clear assign badges
    _renderPeopleChips();
    return;
  }

  // Skip if the assigned user is the chit owner (owner doesn't need a share entry)
  if (userId === _chitOwnerId) {
    _renderPeopleChips();
    return;
  }

  var existingShare = _findShareByUserId(userId);
  if (!existingShare) {
    // User not in shares — add with role "manager" and rsvp_status "invited"
    var userInfo = _getUserInfoById(userId);
    var displayName = userInfo ? (userInfo.display_name || userInfo.username) : _getUserDisplayName(userId);
    _currentShares.push({
      user_id: userId,
      role: 'manager',
      display_name: displayName || '(Unknown User)',
      rsvp_status: 'invited'
    });
    setSaveButtonUnsaved();
    _renderPeopleChips();
    _renderPeopleTree();
    _updateActivePeopleCount();
  } else if (existingShare.role === 'viewer') {
    // User is a viewer — upgrade to manager
    existingShare.role = 'manager';
    setSaveButtonUnsaved();
    _renderPeopleChips();
    _renderPeopleTree();
  } else {
    // Already manager — still re-render to update assign badge
    _renderPeopleChips();
  }
}

/**
 * Sync the assigned-to dropdown in the Task zone with current shares.
 * Shows/hides the row, populates options from owner + all system users
 * (Requirement 2.5), and clears the value if the assigned user was removed.
 */
function _syncAssignedToDropdown() {
  var row = document.getElementById('sharingAssignedRow');
  var select = document.getElementById('sharingAssignedTo');
  if (!row || !select) return;

  // Determine if current user can manage (owner or manager)
  var canManage = (_effectiveRole === 'owner' || _effectiveRole === 'manager' || _effectiveRole === null);

  // Get current user to exclude from the dropdown
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

  // Show the row if there are system users OR if the owner can be assigned
  var hasAssignableUsers = (_allUsersCache && _allUsersCache.length > 0) || (_chitOwnerId && canManage);
  if (!hasAssignableUsers) {
    row.style.display = 'none';
    if (select.value) {
      select.value = '';
      setSaveButtonUnsaved();
    }
    return;
  }

  row.style.display = '';

  // Preserve current selection
  var currentVal = select.value;
  var currentStillValid = false;

  // Rebuild options
  select.innerHTML = '';
  var noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '— None —';
  select.appendChild(noneOpt);

  // Track user IDs already added to avoid duplicates
  var addedUserIds = {};

  // Add the chit owner as an assignable option (only if owner/manager)
  if (_chitOwnerId && canManage) {
    var ownerOpt = document.createElement('option');
    ownerOpt.value = _chitOwnerId;
    var ownerName = _chitOwnerDisplayName || _getUserDisplayName(_chitOwnerId) || '(Owner)';
    var ownerInfo = _getUserInfoById(_chitOwnerId);
    var ownerUsername = ownerInfo ? (ownerInfo.username || '') : '';
    if (ownerUsername && ownerUsername.toLowerCase() !== ownerName.toLowerCase()) {
      ownerOpt.textContent = ownerName + ' - ' + ownerUsername + ' (owner)';
    } else {
      ownerOpt.textContent = ownerName + ' (owner)';
    }
    select.appendChild(ownerOpt);
    addedUserIds[_chitOwnerId] = true;
    if (_chitOwnerId === currentVal) currentStillValid = true;
  }

  // Populate with all system users (Requirement 2.5)
  (_allUsersCache || []).forEach(function (u) {
    var uid = u.id || u.user_id;
    // Skip owner (already added above) and current user
    if (addedUserIds[uid]) return;
    if (currentUserId && uid === currentUserId) return;

    var opt = document.createElement('option');
    opt.value = uid;
    var displayName = u.display_name || u.username || '(Unknown)';
    var username = u.username || '';
    if (username && username.toLowerCase() !== displayName.toLowerCase()) {
      opt.textContent = displayName + ' - ' + username;
    } else {
      opt.textContent = displayName;
    }
    select.appendChild(opt);
    addedUserIds[uid] = true;
    if (uid === currentVal) currentStillValid = true;
  });

  if (currentStillValid) {
    select.value = currentVal;
  } else if (currentVal) {
    // Assigned user is no longer valid — clear and mark unsaved
    select.value = '';
    setSaveButtonUnsaved();
  }
}

// ── Sharing initialization (Task 5.5) ───────────────────────────────────────

/**
 * Initialize sharing controls for an existing chit.
 * Called from loadChitData() in editor-init.js.
 *
 * @param {Object} chit — the chit object from the API
 */
function initPeopleSharingControls(chit) {
  _sharingInitialized = true;

  // Track the chit owner so we can hide them from the people list for non-owners
  _chitOwnerId = chit.owner_id || null;
  _chitOwnerDisplayName = chit.owner_display_name || null;

  // Load shares from chit (preserve rsvp_status for RSVP display)
  _currentShares = [];
  if (Array.isArray(chit.shares)) {
    chit.shares.forEach(function (s) {
      _currentShares.push({
        user_id: s.user_id,
        role: s.role || 'viewer',
        display_name: s.display_name || (typeof _getUserDisplayName === 'function' ? _getUserDisplayName(s.user_id) : '(Unknown User)'),
        rsvp_status: s.rsvp_status || 'invited'
      });
    });
  }

  // Determine effective role
  _effectiveRole = chit.effective_role || 'owner';

  // Set stealth toggle state
  var stealthCb = document.getElementById('sharingStealthToggle');
  // Re-render tree to apply role-based visibility
  _renderPeopleTree();
  // Re-render chips to show shared users in right column
  _renderPeopleChips();

  // Set stealth after render (since render recreates the checkbox)
  stealthCb = document.getElementById('sharingStealthToggle');
  if (stealthCb) {
    stealthCb.checked = !!chit.stealth;
  }
  _applyStealthGreyout();
  _updateStealthHeaderBtn();

  // For viewers: hide pill toggles and stealth toggle (read-only mode)
  // This is handled by _renderPeopleTree checking _effectiveRole

  // Sync assigned-to dropdown
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();

  // Set assigned-to value if present
  var assignedSelect = document.getElementById('sharingAssignedTo');
  if (assignedSelect && chit.assigned_to) {
    assignedSelect.value = chit.assigned_to;
  }

  // Re-render chips now that assigned-to is set (badge needs the dropdown value)
  _renderPeopleChips();

  _updateActivePeopleCount();
}

/**
 * Initialize sharing controls for a new chit.
 * Called from resetEditorForNewChit() in editor-init.js.
 */
function initPeopleSharingForNewChit() {
  _sharingInitialized = true;
  _currentShares = [];
  _effectiveRole = null; // null = owner of new chit
  _chitOwnerDisplayName = null;

  // For new chits, the current user is the owner
  var currentUser = getCurrentUser();
  _chitOwnerId = currentUser ? currentUser.user_id : null;
  _chitOwnerDisplayName = currentUser ? (currentUser.display_name || currentUser.username) : null;

  // Re-render tree to show sharing controls
  _renderPeopleTree();
  _renderPeopleChips();

  // Reset stealth
  var stealthCb = document.getElementById('sharingStealthToggle');
  if (stealthCb) stealthCb.checked = false;

  // Sync assigned-to dropdown (will show owner as assignable option)
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();
}

// ── Tree filter ──────────────────────────────────────────────────────────────

/**
 * Check if a contact matches a search filter across all fields.
 * Searches: display_name, nickname, organization, social_context,
 * emails, phones, addresses, call_signs, x_handles, websites, notes, tags.
 */
function _contactMatchesFilter(c, filter) {
  var fields = [
    c.display_name || '',
    c.given_name || '',
    c.surname || '',
    c.nickname || '',
    c.organization || '',
    c.social_context || '',
    c.notes || '',
    (c.emails || []).map(function (e) { return (e.value || '') + ' ' + (e.label || ''); }).join(' '),
    (c.phones || []).map(function (p) { return (p.value || '') + ' ' + (p.label || ''); }).join(' '),
    (c.addresses || []).map(function (a) { return (a.value || ''); }).join(' '),
    (c.call_signs || []).map(function (cs) { return (cs.value || ''); }).join(' '),
    (c.x_handles || []).map(function (x) { return (x.value || ''); }).join(' '),
    (c.websites || []).map(function (w) { return (w.value || ''); }).join(' '),
    (c.dates || []).map(function (d) { return (d.label || '') + ' ' + (d.value || ''); }).join(' '),
    (c.tags || []).join(' ')
  ];
  return fields.some(function (f) { return f.toLowerCase().includes(filter); });
}

function _filterPeopleTree(query) {
  _currentPeopleFilter = query || '';
  _renderPeopleTree();
}

function _toggleAllPeopleGroups(event, expand) {
  if (event) event.stopPropagation();
  // Include all letters from contacts
  _allContactsCache.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!_peopleGroupsExpanded.hasOwnProperty(letter)) _peopleGroupsExpanded[letter] = true;
  });
  // Include all letters from system users
  (_allUsersCache || []).forEach(function (u) {
    var letter = ((u.display_name || u.username || '?')[0] || '?').toUpperCase();
    if (!_peopleGroupsExpanded.hasOwnProperty(letter)) _peopleGroupsExpanded[letter] = true;
  });
  Object.keys(_peopleGroupsExpanded).forEach(function (k) {
    _peopleGroupsExpanded[k] = expand;
  });
  _renderPeopleTree();
}

var _peopleGroupsAllExpanded = true;

function _togglePeopleExpandCollapse(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _peopleGroupsAllExpanded = !_peopleGroupsAllExpanded;
  _toggleAllPeopleGroups(null, _peopleGroupsAllExpanded);
  _updatePeopleExpandCollapseBtn();
}

function _updatePeopleExpandCollapseBtn() {
  // Update both the zone header and modal buttons
  var btns = [document.getElementById('people-expand-collapse-btn'), document.getElementById('people-expand-collapse-btn-modal')];
  btns.forEach(function(btn) {
    if (!btn) return;
    if (_peopleGroupsAllExpanded) {
      btn.innerHTML = '<i class="fas fa-compress-alt"></i><span class="hideWhenNarrow"> Collapse</span>';
      btn.title = 'Collapse all groups';
    } else {
      btn.innerHTML = '<i class="fas fa-expand-alt"></i><span class="hideWhenNarrow"> Expand</span>';
      btn.title = 'Expand all groups';
    }
  });
}

// ── Contact chip management (existing, unchanged) ────────────────────────────

function _addPeopleChip(data) {
  if (_peopleChipData.some(function (c) { return c.display_name.toLowerCase() === data.display_name.toLowerCase(); })) return;
  _peopleChipData.push(data);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  // Clear search after adding so the tree refreshes to show remaining contacts
  var input = document.getElementById('peopleSearchInput');
  if (input && input.value) {
    input.value = '';
    _currentPeopleFilter = '';
  }
  _renderPeopleTree();
  setSaveButtonUnsaved();
}

function _removePeopleChip(index) {
  _peopleChipData.splice(index, 1);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  _renderPeopleTree();
  setSaveButtonUnsaved();
}

function _renderPeopleChips() {
  var container = document.getElementById('peopleChips');
  if (!container) return;
  container.innerHTML = '';

  // ── Render contact chips ──
  _peopleChipData.forEach(function (data, idx) {
    var chip = document.createElement('span');
    chip.className = 'people-chip';
    if (data.color) {
      chip.style.backgroundColor = data.color;
      chip.style.color = _isLightColor(data.color) ? '#2b1e0f' : '#fff';
      chip.style.borderColor = data.color;
    }

    var thumbEl = document.createElement('span');
    thumbEl.className = 'chip-thumb';
    if (data.image_url) {
      thumbEl.innerHTML = '<img src="' + data.image_url + '" />';
    } else {
      thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
    }
    chip.appendChild(thumbEl);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'chip-name-text';
    nameSpan.textContent = data.display_name;
    chip.appendChild(nameSpan);

    // Double-click opens contact editor
    if (data.id) {
      chip.title = 'Double-click to edit contact';
      chip.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        window.open('/frontend/html/contact-editor.html?id=' + encodeURIComponent(data.id), '_blank');
      });
    }

    var removeX = document.createElement('span');
    removeX.className = 'chip-remove';
    removeX.textContent = '✕';
    removeX.title = 'Remove';
    removeX.addEventListener('click', function (e) {
      e.stopPropagation();
      _removePeopleChip(idx);
    });
    chip.appendChild(removeX);
    container.appendChild(chip);
  });

  // ── Render shared users in the right column with pill toggles ──
  var showControls = (_effectiveRole === 'owner' || _effectiveRole === 'manager' || _effectiveRole === null);
  _currentShares.forEach(function (share) {
    var userInfo = _getUserInfoById(share.user_id);
    var displayName = share.display_name || (userInfo ? (userInfo.display_name || userInfo.username) : '(Unknown User)');
    var username = userInfo ? (userInfo.username || '') : '';

    var row = document.createElement('div');
    row.className = 'people-user-row';

    // User chip
    var chip = document.createElement('span');
    chip.className = 'people-chip people-chip-user people-chip-shared';
    chip.title = username; // Show username on hover

    // Apply user color if available
    if (userInfo && userInfo.color) {
      chip.style.backgroundColor = userInfo.color;
      chip.style.color = _isLightColor(userInfo.color) ? '#2b1e0f' : '#fff';
    }

    var thumbEl = document.createElement('span');
    thumbEl.className = 'chip-thumb';
    if (userInfo && userInfo.profile_image_url) {
      thumbEl.innerHTML = '<img src="' + userInfo.profile_image_url + '" />';
    } else {
      thumbEl.innerHTML = '<span class="chip-thumb-placeholder chip-thumb-user"><i class="fas fa-users"></i></span>';
    }
    chip.appendChild(thumbEl);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'chip-name-text';
    nameSpan.textContent = displayName;
    chip.appendChild(nameSpan);

    // ✕ remove button
    if (showControls) {
      var removeX = document.createElement('span');
      removeX.className = 'chip-remove';
      removeX.textContent = '✕';
      removeX.title = 'Remove share';
      removeX.addEventListener('click', function (e) {
        e.stopPropagation();
        _removeShare(share.user_id);
      });
      chip.appendChild(removeX);
    }

    row.appendChild(chip);

    // RSVP status badge (Requirements 6.1, 6.2)
    var rsvpStatus = share.rsvp_status || 'invited';
    var rsvpBadge = document.createElement('span');
    rsvpBadge.className = 'cwoc-editor-rsvp-badge';
    if (rsvpStatus === 'accepted') {
      rsvpBadge.textContent = '✓';
      rsvpBadge.classList.add('cwoc-editor-rsvp-accepted');
      rsvpBadge.title = displayName + ' — accepted';
    } else if (rsvpStatus === 'declined') {
      rsvpBadge.textContent = '✗';
      rsvpBadge.classList.add('cwoc-editor-rsvp-declined');
      rsvpBadge.title = displayName + ' — declined';
    } else {
      rsvpBadge.textContent = '⏳';
      rsvpBadge.classList.add('cwoc-editor-rsvp-invited');
      rsvpBadge.title = displayName + ' — invited';
    }
    row.appendChild(rsvpBadge);

    // RSVP accept/decline controls for the current user (Requirements 6.3, 6.4)
    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;
    if (currentUserId && share.user_id === currentUserId && _effectiveRole !== 'owner') {
      var rsvpActions = document.createElement('span');
      rsvpActions.className = 'cwoc-editor-rsvp-actions';

      var acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'cwoc-editor-rsvp-btn cwoc-editor-rsvp-accept-btn';
      acceptBtn.textContent = '✓';
      acceptBtn.title = 'Accept invitation';
      if (rsvpStatus === 'accepted') acceptBtn.classList.add('cwoc-editor-rsvp-btn-active');

      var declineBtn = document.createElement('button');
      declineBtn.type = 'button';
      declineBtn.className = 'cwoc-editor-rsvp-btn cwoc-editor-rsvp-decline-btn';
      declineBtn.textContent = '✗';
      declineBtn.title = 'Decline invitation';
      if (rsvpStatus === 'declined') declineBtn.classList.add('cwoc-editor-rsvp-btn-active');

      acceptBtn.addEventListener('click', (function (userId) {
        return function (e) {
          e.stopPropagation();
          var cid = window.currentChitId || (typeof chitId !== 'undefined' ? chitId : null);
          if (!cid) { console.error('[RSVP] No chit ID available'); return; }
          fetch('/api/chits/' + cid + '/rsvp', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rsvp_status: 'accepted' })
          }).then(function (r) {
            if (r.ok) {
              // Update local state
              var s = _findShareByUserId(userId);
              if (s) s.rsvp_status = 'accepted';
              _renderPeopleChips();
            } else {
              console.error('[RSVP] Accept failed:', r.status);
            }
          }).catch(function (err) {
            console.error('[RSVP] Accept error:', err);
          });
        };
      })(share.user_id));

      declineBtn.addEventListener('click', (function (userId) {
        return function (e) {
          e.stopPropagation();
          var cid = window.currentChitId || (typeof chitId !== 'undefined' ? chitId : null);
          if (!cid) { console.error('[RSVP] No chit ID available'); return; }
          fetch('/api/chits/' + cid + '/rsvp', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rsvp_status: 'declined' })
          }).then(function (r) {
            if (r.ok) {
              var s = _findShareByUserId(userId);
              if (s) s.rsvp_status = 'declined';
              _renderPeopleChips();
            } else {
              console.error('[RSVP] Decline failed:', r.status);
            }
          }).catch(function (err) {
            console.error('[RSVP] Decline error:', err);
          });
        };
      })(share.user_id));

      rsvpActions.appendChild(acceptBtn);
      rsvpActions.appendChild(declineBtn);
      row.appendChild(rsvpActions);
    }

    // Pill toggle (viewer/manager) — only in the right column
    if (showControls) {
      var pill = document.createElement('div');
      pill.className = 'cwoc-pill-toggle cwoc-pill-toggle-share';
      pill.style.cssText = 'display:flex;border:1px solid #8b5a2b;border-radius:4px;overflow:hidden;cursor:pointer;font-size:0.75em;';

      var viewerSpan = document.createElement('span');
      viewerSpan.setAttribute('data-val', 'viewer');
      viewerSpan.textContent = '👁️ V';
      viewerSpan.title = 'Viewer';

      var managerSpan = document.createElement('span');
      managerSpan.setAttribute('data-val', 'manager');
      managerSpan.textContent = '✏️ M';
      managerSpan.title = 'Manager';

      var activeStyle = 'padding:3px 6px;background:#8b5a2b;color:#fff8e1;font-weight:bold;';
      var inactiveStyle = 'padding:3px 6px;background:#f5e6cc;color:#bbb;';

      viewerSpan.style.cssText = (share.role === 'viewer') ? activeStyle : inactiveStyle;
      managerSpan.style.cssText = (share.role === 'manager') ? activeStyle : inactiveStyle;

      pill.appendChild(viewerSpan);
      pill.appendChild(managerSpan);

      // Click pill toggle to flip role
      pill.addEventListener('click', (function (userId, currentRole) {
        return function (e) {
          e.stopPropagation();
          var newRole = (currentRole === 'viewer') ? 'manager' : 'viewer';
          _updateShareRole(userId, newRole);
        };
      })(share.user_id, share.role));

      row.appendChild(pill);

      // Assigned indicator (after pill toggle) — clickable to toggle
      var assignedSelect = document.getElementById('sharingAssignedTo');
      var isAssigned = assignedSelect && assignedSelect.value === share.user_id;
      var assignIndicator = document.createElement('span');
      assignIndicator.className = 'cwoc-compact-assign-badge' + (isAssigned ? ' cwoc-compact-assign-active' : '');
      assignIndicator.innerHTML = '<i class="fas fa-thumbtack"></i>';
      assignIndicator.title = isAssigned ? 'Click to unassign' : 'Click to assign';
      assignIndicator.dataset.userId = share.user_id;
      assignIndicator.style.cursor = 'pointer';
      assignIndicator.addEventListener('click', (function (uid, assigned) {
        return function (e) {
          e.stopPropagation();
          var sel = document.getElementById('sharingAssignedTo');
          if (!sel) return;
          if (assigned) {
            sel.value = '';
          } else {
            sel.value = uid;
          }
          _onAssignedToChange();
          setSaveButtonUnsaved();
        };
      })(share.user_id, isAssigned));
      row.appendChild(assignIndicator);
    }

    container.appendChild(row);
  });
}

function _syncPeopleHiddenField() {
  var hidden = document.getElementById('people');
  if (hidden) {
    hidden.value = _peopleChipData.map(function (c) { return c.display_name; }).join(', ');
  }
}

function _updateActivePeopleCount() {
  var el = document.getElementById('activePeopleCount');
  if (el) el.textContent = _peopleChipData.length + _currentShares.length;
}

// _isLightColor moved to shared.js as isLightColor()
function _isLightColor(hex) { return isLightColor(hex); }

// Populate chips from a chit's people array (called from loadChitData)
function _setPeopleFromArray(peopleArray) {
  _peopleChipData = [];
  if (!peopleArray || !peopleArray.length) {
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
    return;
  }

  function _buildChips() {
    var contactMap = {};
    (_allContactsCache || []).forEach(function (c) {
      contactMap[(c.display_name || '').toLowerCase()] = c;
    });
    _peopleChipData = [];
    peopleArray.forEach(function (name) {
      var match = contactMap[name.toLowerCase()];
      _peopleChipData.push({
        display_name: name,
        id: match ? match.id : null,
        color: match ? (match.color || null) : null,
        image_url: match ? (match.image_url || null) : null
      });
    });
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
  }

  // If cache is empty, fetch first then build
  if (!_allContactsCache || _allContactsCache.length === 0) {
    fetch('/api/contacts').then(function (r) { return r.ok ? r.json() : []; }).then(function (contacts) {
      _allContactsCache = contacts;
      _buildChips();
    }).catch(function () { _buildChips(); });
  } else {
    _buildChips();
  }
}

document.addEventListener('DOMContentLoaded', _initPeopleAutocomplete);

// ── People Expand Modal (Requirements 8.1–8.6) ──────────────────────────────

/** State for expand modal search */
var _expandModalFilter = '';

/** State for expand modal column sorting: { column: 'name'|'email'|'org'|'notes'|'status', dir: 'asc'|'desc' } or null */
var _expandModalSort = null;

/**
 * Open the People expand modal — fully interactive management view.
 * Supports add/remove contacts, add/remove/change role for users,
 * set assigned, show favorites, show user icons.
 */
function openPeopleExpandModal(event) {
  if (event) event.stopPropagation();
  var modal = document.getElementById('peopleExpandModal');
  if (!modal) return;

  _expandModalFilter = '';
  _expandModalSort = null;
  _renderExpandModalContent();
  modal.style.display = 'flex';

  // Add Enter key listener to close modal
  document.addEventListener('keydown', _onExpandModalKeydown);

  // Focus search input after render
  setTimeout(function () {
    var input = document.getElementById('expandModalSearch');
    if (input) input.focus();
  }, 50);
}

/** Keydown handler for the expand modal — Enter closes (unless search is focused) */
function _onExpandModalKeydown(e) {
  if (e.key === 'Enter') {
    // Don't close if the search input is focused
    var search = document.getElementById('expandModalSearch');
    if (search && document.activeElement === search) return;
    e.preventDefault();
    closePeopleExpandModal();
  }
}

/**
 * Render the full expand modal content (called on open and after any mutation).
 */
function _renderExpandModalContent() {
  var listContainer = document.getElementById('peopleExpandList');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  var filter = _expandModalFilter;

  // Get current user to exclude
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

  // Determine if sharing controls should be shown
  var showControls = (_effectiveRole === 'owner' || _effectiveRole === 'manager' || _effectiveRole === null);

  // Get assigned-to value
  var assignedSelect = document.getElementById('sharingAssignedTo');
  var assignedToId = assignedSelect ? assignedSelect.value : '';

  // ── Search bar ──
  var searchRow = document.createElement('div');
  searchRow.className = 'cwoc-people-expand-search-row';
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'expandModalSearch';
  searchInput.className = 'cwoc-people-expand-search';
  searchInput.placeholder = 'Search or type a name & press Enter to add...';
  searchInput.value = filter;
  searchInput.addEventListener('input', function () {
    _expandModalFilter = searchInput.value.trim().toLowerCase();
    _renderExpandModalContent();
    // Re-focus and restore cursor
    var el = document.getElementById('expandModalSearch');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (searchInput.value) {
        searchInput.value = '';
        _expandModalFilter = '';
        _renderExpandModalContent();
        var el = document.getElementById('expandModalSearch');
        if (el) el.focus();
        e.stopPropagation();
      }
    }
    // Enter adds the typed name as a free-text person (if not empty)
    if (e.key === 'Enter') {
      e.preventDefault();
      var name = searchInput.value.trim();
      if (!name) return;
      _addPeopleChip({ display_name: name, id: null, color: null, image_url: null });
      searchInput.value = '';
      _expandModalFilter = '';
      _renderExpandModalContent();
      var el = document.getElementById('expandModalSearch');
      if (el) el.focus();
    }
  });
  searchRow.appendChild(searchInput);
  listContainer.appendChild(searchRow);

  // ── Build unified list ──
  var allPeople = [];

  // Add contacts
  (_allContactsCache || []).forEach(function (c) {
    var isActive = _peopleChipData.some(function (p) {
      return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase();
    });
    if (filter && !_contactMatchesFilter(c, filter)) return;
    allPeople.push({
      displayName: c.display_name || c.given_name || '(unnamed)',
      type: 'contact',
      isActive: isActive,
      favorite: !!c.favorite,
      imageUrl: c.image_url || null,
      color: c.color || null,
      contactData: c
    });
  });

  // Add system users (exclude current user)
  (_allUsersCache || []).forEach(function (u) {
    var uid = u.id || u.user_id;
    if (currentUserId && uid === currentUserId) return;
    // Hide the owner from the people list for non-owner users
    if (_chitOwnerId && _effectiveRole !== 'owner' && _effectiveRole !== null && uid === _chitOwnerId) return;

    if (filter) {
      var matchesDisplay = (u.display_name || '').toLowerCase().includes(filter);
      var matchesUsername = (u.username || '').toLowerCase().includes(filter);
      if (!matchesDisplay && !matchesUsername) return;
    }

    var shareEntry = _findShareByUserId(uid);
    allPeople.push({
      displayName: u.display_name || u.username || '(unknown)',
      type: 'user',
      userId: uid,
      username: u.username || '',
      isShared: !!shareEntry,
      shareEntry: shareEntry,
      isAssigned: uid === assignedToId,
      imageUrl: u.profile_image_url || null,
      color: null,
      userData: u
    });
  });

  // Sort: apply column sort if active, otherwise default alphabetical
  if (_expandModalSort) {
    var sortKey = _expandModalSort.column;
    var sortDir = _expandModalSort.dir === 'desc' ? -1 : 1;
    allPeople.sort(function (a, b) {
      var va = _getExpandSortValue(a, sortKey);
      var vb = _getExpandSortValue(b, sortKey);
      return va.localeCompare(vb) * sortDir;
    });
  } else {
    allPeople.sort(function (a, b) {
      return (a.displayName || '').toLowerCase().localeCompare((b.displayName || '').toLowerCase());
    });
  }

  if (allPeople.length === 0) {
    listContainer.appendChild(_el('div', 'cwoc-people-expand-empty', 'No people found.'));
    return;
  }

  // ── Table header (sortable columns) ──
  var headerRow = document.createElement('div');
  headerRow.className = 'cwoc-pex-row cwoc-pex-header';

  headerRow.appendChild(_el('span', 'cwoc-pex-col-controls'));
  headerRow.appendChild(_el('span', 'cwoc-pex-col-icon'));
  headerRow.appendChild(_el('span', 'cwoc-pex-col-thumb'));

  var sortableCols = [
    { key: 'name', label: 'Name', cls: 'cwoc-pex-col-name' },
    { key: 'email', label: 'Email', cls: 'cwoc-pex-col-email' },
    { key: 'org', label: 'Org', cls: 'cwoc-pex-col-org' },
    { key: 'notes', label: 'Notes', cls: 'cwoc-pex-col-notes' },
    { key: 'status', label: 'Status', cls: 'cwoc-pex-col-status' }
  ];

  sortableCols.forEach(function (col) {
    var hdr = document.createElement('span');
    hdr.className = col.cls;
    var arrow = '';
    if (_expandModalSort && _expandModalSort.column === col.key) {
      arrow = ' <span class="cwoc-pex-sort-arrow">' + (_expandModalSort.dir === 'asc' ? '▲' : '▼') + '</span>';
    }
    hdr.innerHTML = col.label + arrow;
    hdr.addEventListener('click', (function (k) {
      return function () {
        if (_expandModalSort && _expandModalSort.column === k) {
          _expandModalSort.dir = _expandModalSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _expandModalSort = { column: k, dir: 'asc' };
        }
        _renderExpandModalContent();
      };
    })(col.key));
    headerRow.appendChild(hdr);
  });

  headerRow.appendChild(_el('span', 'cwoc-pex-col-edit'));
  listContainer.appendChild(headerRow);

  // When a column sort is active, render flat (no grouping)
  if (_expandModalSort) {
    allPeople.forEach(function (person) {
      listContainer.appendChild(_renderExpandRow(person, showControls, assignedToId));
    });
    return;
  }

  // ── Favorites section (contacts only, default sort) ──
  var favorites = allPeople.filter(function (p) { return p.type === 'contact' && p.favorite; });
  if (favorites.length > 0) {
    var favHeader = document.createElement('div');
    favHeader.className = 'cwoc-pex-section-header cwoc-pex-fav-header';
    favHeader.innerHTML = '★ Favorites (' + favorites.length + ')';
    listContainer.appendChild(favHeader);

    favorites.forEach(function (person) {
      listContainer.appendChild(_renderExpandRow(person, showControls, assignedToId));
    });
  }

  // ── Remaining people grouped by letter (skip favorites) ──
  var nonFavorites = allPeople.filter(function (p) { return !(p.type === 'contact' && p.favorite); });

  var groups = {};
  nonFavorites.forEach(function (person) {
    var letter = ((person.displayName || '?')[0] || '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(person);
  });

  var letters = Object.keys(groups).sort();

  letters.forEach(function (letter) {
    var groupHeader = document.createElement('div');
    groupHeader.className = 'cwoc-pex-section-header';
    groupHeader.textContent = letter;
    listContainer.appendChild(groupHeader);

    groups[letter].forEach(function (person) {
      listContainer.appendChild(_renderExpandRow(person, showControls, assignedToId));
    });
  });
}

/** Helper: create element with class and optional text */
function _el(tag, cls, text) {
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

/**
 * Get a sortable string value for a person entry by column key.
 */
function _getExpandSortValue(person, key) {
  switch (key) {
    case 'name':
      return (person.displayName || '').toLowerCase();
    case 'email':
      if (person.type === 'contact' && person.contactData) {
        return ((person.contactData.emails && person.contactData.emails.length > 0) ? person.contactData.emails[0].value : '').toLowerCase();
      }
      return (person.username || '').toLowerCase();
    case 'org':
      if (person.type === 'contact' && person.contactData) {
        return (person.contactData.organization || '').toLowerCase();
      }
      return '';
    case 'notes':
      if (person.type === 'contact' && person.contactData) {
        return (person.contactData.notes || '').toLowerCase();
      }
      return '';
    case 'status':
      if (person.type === 'contact') return person.isActive ? 'added' : 'contact';
      if (person.isShared) return 'shared';
      return 'user';
    default:
      return '';
  }
}

/**
 * Render a single table row in the expand modal.
 * Column order: Controls | Icon | Thumb | Name | Email | Org | Notes | Status | Edit
 * Controls column (left): +/✕ button, pill toggle, assign, RSVP badge
 * Edit column (right): open profile/contact in new tab
 */
function _renderExpandRow(person, showControls, assignedToId) {
  var row = document.createElement('div');
  row.className = 'cwoc-pex-row';
  if (person.type === 'contact' && person.isActive) row.classList.add('cwoc-pex-active');
  if (person.type === 'user' && person.isShared) row.classList.add('cwoc-pex-active');

  // ── Controls column (LEFT — all interactive controls) ──
  var ctrlCol = _el('span', 'cwoc-pex-col-controls');

  if (person.type === 'contact') {
    // Add/Remove button
    var actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'cwoc-people-expand-action-btn';
    if (person.isActive) {
      actionBtn.textContent = '✕'; actionBtn.title = 'Remove from chit';
      actionBtn.classList.add('cwoc-people-expand-action-remove');
      actionBtn.addEventListener('click', (function (cd) {
        return function (e) {
          e.stopPropagation();
          for (var i = 0; i < _peopleChipData.length; i++) {
            if (_peopleChipData[i].display_name.toLowerCase() === (cd.display_name || '').toLowerCase()) {
              _removePeopleChip(i); break;
            }
          }
          _renderExpandModalContent();
        };
      })(person.contactData));
    } else {
      actionBtn.textContent = '+'; actionBtn.title = 'Add to chit';
      actionBtn.classList.add('cwoc-people-expand-action-add');
      actionBtn.addEventListener('click', (function (cd) {
        return function (e) {
          e.stopPropagation();
          _addPeopleChip({ display_name: cd.display_name, id: cd.id, color: cd.color || null, image_url: cd.image_url || null });
          _renderExpandModalContent();
        };
      })(person.contactData));
    }
    ctrlCol.appendChild(actionBtn);
  } else {
    // System user controls
    if (person.isShared && person.shareEntry && showControls) {
      // Add/Remove button
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'cwoc-people-expand-action-btn cwoc-people-expand-action-remove';
      removeBtn.textContent = '✕'; removeBtn.title = 'Remove share';
      removeBtn.addEventListener('click', (function (uid) {
        return function (e) {
          e.stopPropagation();
          _removeShare(uid);
          _renderExpandModalContent();
        };
      })(person.userId));
      ctrlCol.appendChild(removeBtn);

      // Pill toggle (Viewer/Manager)
      var pill = document.createElement('div');
      pill.className = 'cwoc-pill-toggle cwoc-pill-toggle-share cwoc-pex-pill';
      var viewerSpan = _el('span', person.shareEntry.role === 'viewer' ? 'pill-active' : 'pill-inactive', '👁️ Viewer');
      viewerSpan.setAttribute('data-val', 'viewer');
      var managerSpan = _el('span', person.shareEntry.role === 'manager' ? 'pill-active' : 'pill-inactive', '✏️ Manager');
      managerSpan.setAttribute('data-val', 'manager');
      pill.appendChild(viewerSpan);
      pill.appendChild(managerSpan);
      pill.addEventListener('click', (function (userId, currentRole) {
        return function (e) {
          e.stopPropagation();
          _updateShareRole(userId, currentRole === 'viewer' ? 'manager' : 'viewer');
          _renderExpandModalContent();
        };
      })(person.userId, person.shareEntry.role));
      ctrlCol.appendChild(pill);

      // Assign button
      var assignBtn = document.createElement('button');
      assignBtn.type = 'button';
      assignBtn.className = 'cwoc-people-expand-assign-btn';
      if (person.isAssigned) {
        assignBtn.innerHTML = '<i class="fas fa-thumbtack"></i> Assigned';
        assignBtn.title = 'Unassign';
        assignBtn.classList.add('cwoc-people-expand-assigned-active');
        assignBtn.addEventListener('click', (function () {
          return function (e) {
            e.stopPropagation();
            var sel = document.getElementById('sharingAssignedTo');
            if (sel) { sel.value = ''; _onAssignedToChange(); setSaveButtonUnsaved(); }
            _renderExpandModalContent();
          };
        })());
      } else {
        assignBtn.innerHTML = '<i class="fas fa-thumbtack"></i>';
        assignBtn.title = 'Set as assigned';
        assignBtn.addEventListener('click', (function (uid) {
          return function (e) {
            e.stopPropagation();
            var sel = document.getElementById('sharingAssignedTo');
            if (sel) { sel.value = uid; _onAssignedToChange(); setSaveButtonUnsaved(); }
            _renderExpandModalContent();
          };
        })(person.userId));
      }
      ctrlCol.appendChild(assignBtn);

      // RSVP badge
      var rsvpStatus = person.shareEntry.rsvp_status || 'invited';
      var rsvpBadge = document.createElement('span');
      rsvpBadge.className = 'cwoc-editor-rsvp-badge';
      if (rsvpStatus === 'accepted') {
        rsvpBadge.textContent = '✓'; rsvpBadge.classList.add('cwoc-editor-rsvp-accepted');
        rsvpBadge.title = person.displayName + ' — accepted';
      } else if (rsvpStatus === 'declined') {
        rsvpBadge.textContent = '✗'; rsvpBadge.classList.add('cwoc-editor-rsvp-declined');
        rsvpBadge.title = person.displayName + ' — declined';
      } else {
        rsvpBadge.textContent = '⏳'; rsvpBadge.classList.add('cwoc-editor-rsvp-invited');
        rsvpBadge.title = person.displayName + ' — invited';
      }
      ctrlCol.appendChild(rsvpBadge);
    } else if (!person.isShared && showControls) {
      // Not shared — add button
      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cwoc-people-expand-action-btn cwoc-people-expand-action-add';
      addBtn.textContent = '+'; addBtn.title = 'Share with this user';
      addBtn.addEventListener('click', (function (uid, dn) {
        return function (e) {
          e.stopPropagation();
          _addShare(uid, 'viewer', dn);
          _renderExpandModalContent();
        };
      })(person.userId, person.displayName));
      ctrlCol.appendChild(addBtn);
    } else if (person.isShared && person.shareEntry && !showControls) {
      // Read-only role label
      var roleLabel = _el('span', 'cwoc-pex-label', person.shareEntry.role === 'manager' ? 'Manager' : 'Viewer');
      roleLabel.classList.add(person.shareEntry.role === 'manager' ? 'cwoc-pex-label-manager' : 'cwoc-pex-label-viewer');
      ctrlCol.appendChild(roleLabel);
    }
  }
  row.appendChild(ctrlCol);

  // ── Icon/Star column ──
  var iconCol = _el('span', 'cwoc-pex-col-icon');
  if (person.type === 'contact') {
    iconCol.textContent = person.favorite ? '★' : '';
    if (person.favorite) iconCol.title = 'Favorite';
  } else {
    iconCol.innerHTML = '<i class="fas fa-users"></i>';
    iconCol.classList.add('cwoc-pex-user-icon');
  }
  row.appendChild(iconCol);

  // ── Thumbnail column ──
  var thumbCol = _el('span', 'cwoc-pex-col-thumb');
  if (person.imageUrl) {
    thumbCol.innerHTML = '<img src="' + person.imageUrl + '" alt="" />';
  } else if (person.type === 'user') {
    thumbCol.innerHTML = '<span class="cwoc-pex-thumb-placeholder cwoc-pex-thumb-user"><i class="fas fa-users"></i></span>';
  } else {
    var ph = document.createElement('span');
    ph.className = 'cwoc-pex-thumb-placeholder';
    ph.textContent = (person.displayName || '?')[0].toUpperCase();
    if (person.color) {
      ph.style.backgroundColor = person.color;
      ph.style.color = (typeof isLightColor === 'function' && isLightColor(person.color)) ? '#2b1e0f' : '#fff';
    }
    thumbCol.appendChild(ph);
  }
  row.appendChild(thumbCol);

  // ── Name column ──
  var nameCol = _el('span', 'cwoc-pex-col-name');
  nameCol.textContent = person.displayName;
  row.appendChild(nameCol);

  // ── Email column ──
  var emailCol = _el('span', 'cwoc-pex-col-email');
  if (person.type === 'contact' && person.contactData) {
    var c = person.contactData;
    var firstEmail = (c.emails && c.emails.length > 0) ? c.emails[0].value : '';
    emailCol.textContent = firstEmail;
    emailCol.title = firstEmail;
  } else if (person.type === 'user' && person.username) {
    emailCol.textContent = '@' + person.username;
    emailCol.title = '@' + person.username;
  }
  row.appendChild(emailCol);

  // ── Org column ──
  var orgCol = _el('span', 'cwoc-pex-col-org');
  if (person.type === 'contact' && person.contactData) {
    orgCol.textContent = person.contactData.organization || '';
    orgCol.title = person.contactData.organization || '';
  }
  row.appendChild(orgCol);

  // ── Notes column ──
  var notesCol = _el('span', 'cwoc-pex-col-notes');
  if (person.type === 'contact' && person.contactData && person.contactData.notes) {
    var noteSnippet = person.contactData.notes.replace(/\n/g, ' ').substring(0, 80);
    notesCol.textContent = noteSnippet;
    notesCol.title = person.contactData.notes.substring(0, 200);
  }
  row.appendChild(notesCol);

  // ── Status column (simple label) ──
  var statusCol = _el('span', 'cwoc-pex-col-status');
  if (person.type === 'contact') {
    var label = _el('span', 'cwoc-pex-label cwoc-pex-label-contact', person.isActive ? 'Added' : 'Contact');
    statusCol.appendChild(label);
  } else if (person.isShared) {
    var label2 = _el('span', 'cwoc-pex-label cwoc-pex-label-shared', 'Shared');
    statusCol.appendChild(label2);
  } else {
    var label3 = _el('span', 'cwoc-pex-label cwoc-pex-label-user', 'User');
    statusCol.appendChild(label3);
  }
  row.appendChild(statusCol);

  // ── Edit column (RIGHT — open profile/contact in new tab) ──
  var editCol = _el('span', 'cwoc-pex-col-edit');
  if (person.type === 'contact' && person.contactData && person.contactData.id) {
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'cwoc-pex-edit-btn';
    editBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
    editBtn.title = 'Edit contact in new tab';
    editBtn.addEventListener('click', (function (contactId) {
      return function (e) {
        e.stopPropagation();
        window.open('/frontend/html/contact-editor.html?id=' + encodeURIComponent(contactId), '_blank');
      };
    })(person.contactData.id));
    editCol.appendChild(editBtn);
  } else if (person.type === 'user' && person.userId) {
    var userEditBtn = document.createElement('button');
    userEditBtn.type = 'button';
    userEditBtn.className = 'cwoc-pex-edit-btn';
    userEditBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
    userEditBtn.title = 'View user profile';
    userEditBtn.addEventListener('click', (function (uid) {
      return function (e) {
        e.stopPropagation();
        window.open('/frontend/html/contact-editor.html?mode=profile&user_id=' + encodeURIComponent(uid), '_blank');
      };
    })(person.userId));
    editCol.appendChild(userEditBtn);
  }
  row.appendChild(editCol);

  return row;
}

/**
 * Close the People expand modal and return focus to the People zone.
 * Requirements: 8.5
 */
function closePeopleExpandModal() {
  var modal = document.getElementById('peopleExpandModal');
  if (modal) modal.style.display = 'none';
  // Remove Enter key listener
  document.removeEventListener('keydown', _onExpandModalKeydown);
  // Return focus to the People zone
  var peopleSection = document.getElementById('peopleSection');
  if (peopleSection) peopleSection.focus();
}
