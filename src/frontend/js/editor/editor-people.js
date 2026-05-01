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

// ── Sharing state (Task 5.1) ────────────────────────────────────────────────

var _allUsersCache = [];       // System users from /api/auth/switchable-users
var _currentShares = [];       // Array of {user_id, role, display_name?}
var _sharingInitialized = false;
var _effectiveRole = null;     // 'owner', 'manager', 'viewer', or null (for new chits)
var _chitOwnerId = null;       // Owner user_id of the current chit (used to hide owner from people list)

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
    _filterPeopleTree(input.value.trim().toLowerCase());
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      _filterPeopleTree('');
      input.blur();
    }
  });
}

function _clearPeopleSearch(event) {
  if (event) event.stopPropagation();
  var input = document.getElementById('peopleSearchInput');
  if (input) { input.value = ''; _filterPeopleTree(''); }
}

// ── Contact loading ──────────────────────────────────────────────────────────

async function _loadAllContactsForTree() {
  try {
    var resp = await fetch('/api/contacts');
    if (!resp.ok) return;
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
        return;
      }
      _allUsersCache = await resp.json();
    }
    _renderPeopleTree();
  } catch (e) {
    console.error('[People] Error loading system users:', e);
    _allUsersCache = [];
  }
}

// ── Merged tree rendering (Task 5.2) ────────────────────────────────────────

function _renderPeopleTree(filter) {
  var container = document.getElementById('peopleTreeContainer');
  if (!container) return;
  container.innerHTML = '';

  // Get current user to exclude from system user list
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

  // Determine if sharing controls should be shown
  var showSharingControls = (_effectiveRole === 'owner' || _effectiveRole === 'manager' || _effectiveRole === null);

  // ── Filter contacts ──
  var contacts = _allContactsCache;
  if (filter) {
    contacts = contacts.filter(function (c) {
      return (c.display_name || '').toLowerCase().includes(filter);
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
    container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:8px;">No contacts or users found.</div>';
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

  var thumbEl = document.createElement('span');
  thumbEl.className = 'chip-thumb';
  if (u.profile_image_url) {
    thumbEl.innerHTML = '<img src="' + u.profile_image_url + '" />';
  } else {
    thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
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
  _currentShares.push({ user_id: userId, role: role, display_name: displayName || '(Unknown User)' });
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
}

// ── Stealth toggle (Task 5.4) ────────────────────────────────────────────────

function _renderStealthToggle() {
  var container = document.getElementById('peopleContent');
  if (!container) return;

  // Remove existing stealth toggle if present
  var existing = document.getElementById('cwoc-stealth-toggle-row');
  if (existing) existing.remove();

  // Only show for owners and managers (not viewers)
  if (_effectiveRole === 'viewer') return;

  var row = document.createElement('div');
  row.id = 'cwoc-stealth-toggle-row';
  row.className = 'cwoc-stealth-toggle-row';
  row.style.cssText = 'padding:8px 4px 4px 4px;border-top:1px solid #d4c5a9;margin-top:8px;';

  var label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85em;color:#6b4e31;';

  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'sharingStealthToggle';
  checkbox.addEventListener('change', function () {
    setSaveButtonUnsaved();
  });

  label.appendChild(checkbox);
  label.appendChild(document.createTextNode('🥷 Stealth — hide from all other users'));

  row.appendChild(label);
  container.appendChild(row);
}

// ── Assigned-to dropdown sync (stub for Task 6) ─────────────────────────────

/**
 * Sync the assigned-to dropdown in the Task zone with current shares.
 * Shows/hides the row, populates options from _currentShares, and clears
 * the value if the assigned user was removed.
 */
function _syncAssignedToDropdown() {
  var row = document.getElementById('sharingAssignedRow');
  var select = document.getElementById('sharingAssignedTo');
  if (!row || !select) return;

  if (_currentShares.length === 0) {
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

  _currentShares.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s.user_id;
    // Show "First Last - username" format
    var userInfo = _getUserInfoById(s.user_id);
    var displayName = s.display_name || (userInfo ? (userInfo.display_name || userInfo.username) : _getUserDisplayName(s.user_id));
    var username = userInfo ? (userInfo.username || '') : '';
    // Only append username if it differs from display_name
    if (username && username.toLowerCase() !== displayName.toLowerCase()) {
      opt.textContent = displayName + ' - ' + username;
    } else {
      opt.textContent = displayName;
    }
    select.appendChild(opt);
    if (s.user_id === currentVal) currentStillValid = true;
  });

  if (currentStillValid) {
    select.value = currentVal;
  } else if (currentVal) {
    // Assigned user was removed from shares — clear and mark unsaved
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

  // Load shares from chit
  _currentShares = [];
  if (Array.isArray(chit.shares)) {
    chit.shares.forEach(function (s) {
      _currentShares.push({
        user_id: s.user_id,
        role: s.role || 'viewer',
        display_name: s.display_name || (typeof _getUserDisplayName === 'function' ? _getUserDisplayName(s.user_id) : '(Unknown User)')
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

  // For viewers: hide pill toggles and stealth toggle (read-only mode)
  // This is handled by _renderPeopleTree checking _effectiveRole

  // Sync assigned-to dropdown
  if (typeof _syncAssignedToDropdown === 'function') _syncAssignedToDropdown();

  // Set assigned-to value if present
  var assignedSelect = document.getElementById('sharingAssignedTo');
  if (assignedSelect && chit.assigned_to) {
    assignedSelect.value = chit.assigned_to;
  }

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
  _chitOwnerId = null;   // No owner yet for new chits

  // Re-render tree to show sharing controls
  _renderPeopleTree();
  _renderPeopleChips();

  // Reset stealth
  var stealthCb = document.getElementById('sharingStealthToggle');
  if (stealthCb) stealthCb.checked = false;

  // Hide assigned-to row
  var row = document.getElementById('sharingAssignedRow');
  if (row) row.style.display = 'none';
}

// ── Tree filter ──────────────────────────────────────────────────────────────

function _filterPeopleTree(query) {
  _renderPeopleTree(query || undefined);
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

// ── Contact chip management (existing, unchanged) ────────────────────────────

function _addPeopleChip(data) {
  if (_peopleChipData.some(function (c) { return c.display_name.toLowerCase() === data.display_name.toLowerCase(); })) return;
  _peopleChipData.push(data);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
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

    var thumbEl = document.createElement('span');
    thumbEl.className = 'chip-thumb';
    if (userInfo && userInfo.profile_image_url) {
      thumbEl.innerHTML = '<img src="' + userInfo.profile_image_url + '" />';
    } else {
      thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
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

    // Pill toggle (viewer/manager) — only in the right column
    if (showControls) {
      var pill = document.createElement('div');
      pill.className = 'cwoc-pill-toggle cwoc-pill-toggle-share';
      pill.style.cssText = 'display:flex;border:1px solid #8b5a2b;border-radius:4px;overflow:hidden;cursor:pointer;font-size:0.75em;';

      var viewerSpan = document.createElement('span');
      viewerSpan.setAttribute('data-val', 'viewer');
      viewerSpan.textContent = '👁️ Viewer';

      var managerSpan = document.createElement('span');
      managerSpan.setAttribute('data-val', 'manager');
      managerSpan.textContent = '✏️ Manager';

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
