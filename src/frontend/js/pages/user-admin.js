/* ═══════════════════════════════════════════════════════════════════════════
   CWOC User Admin Page

   Admin-only page for managing user accounts. Provides:
     - User table listing (username, display name, email, status, role, actions)
     - Create user modal (POST /api/users)
     - Deactivate / reactivate user (PUT /api/users/{id}/deactivate|reactivate)
     - Reset password modal (PUT /api/users/{id}/reset-password)

   Depends on: shared-auth.js (isAdmin, waitForAuth),
               shared-utils.js,
               shared-page.js (header/footer injection)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────────────────────

var _adminUsers = [];
var _resetPasswordUserId = null;

// ── DOM References ───────────────────────────────────────────────────────────

var _adminMessageDiv = null;
var _userTableWrap = null;
var _createUserModal = null;
var _resetPasswordModal = null;

// ── Message Helpers ──────────────────────────────────────────────────────────

/**
 * Show an inline message in the admin message area.
 * @param {string} text    Message text
 * @param {string} type    'success' or 'error'
 */
function _showAdminMessage(text, type) {
  if (!_adminMessageDiv) return;
  _adminMessageDiv.textContent = text;
  _adminMessageDiv.className = 'admin-message ' + type;
}

/**
 * Clear the admin message area.
 */
function _clearAdminMessage() {
  if (!_adminMessageDiv) return;
  _adminMessageDiv.textContent = '';
  _adminMessageDiv.className = 'admin-message';
}

// ── Fetch & Render Users ─────────────────────────────────────────────────────

/**
 * Fetch all users from GET /api/users and render the table.
 */
async function _loadUsers() {
  _clearAdminMessage();
  try {
    var response = await fetch('/api/users');
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      _showAdminMessage(errData.detail || 'Failed to load users.', 'error');
      return;
    }
    _adminUsers = await response.json();
    _renderUserTable();
  } catch (err) {
    console.error('[User Admin] Error loading users:', err);
    _showAdminMessage('Failed to load users.', 'error');
  }
}

/**
 * Render the user table into #user-table-wrap.
 */
function _renderUserTable() {
  if (!_userTableWrap) return;

  if (_adminUsers.length === 0) {
    _userTableWrap.innerHTML = '<div class="cwoc-empty">No users found.</div>';
    return;
  }

  var table = document.createElement('table');
  table.className = 'cwoc-table';

  // ── Table header ──
  var thead = document.createElement('thead');
  thead.innerHTML =
    '<tr>' +
      '<th>Username</th>' +
      '<th>Display Name</th>' +
      '<th>Email</th>' +
      '<th>Status</th>' +
      '<th>Role</th>' +
      '<th>Actions</th>' +
    '</tr>';
  table.appendChild(thead);

  // ── Table body ──
  var tbody = document.createElement('tbody');
  for (var i = 0; i < _adminUsers.length; i++) {
    var user = _adminUsers[i];
    var tr = document.createElement('tr');

    // Username
    var tdUsername = document.createElement('td');
    tdUsername.setAttribute('data-label', 'Username');
    tdUsername.textContent = user.username;
    tr.appendChild(tdUsername);

    // Display Name
    var tdDisplayName = document.createElement('td');
    tdDisplayName.setAttribute('data-label', 'Display Name');
    tdDisplayName.textContent = user.display_name;
    tr.appendChild(tdDisplayName);

    // Email
    var tdEmail = document.createElement('td');
    tdEmail.setAttribute('data-label', 'Email');
    tdEmail.textContent = user.email || '—';
    tr.appendChild(tdEmail);

    // Status badge
    var tdStatus = document.createElement('td');
    tdStatus.setAttribute('data-label', 'Status');
    var statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge ' + (user.is_active ? 'active' : 'inactive');
    statusBadge.textContent = user.is_active ? 'Active' : 'Inactive';
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    // Role badge
    var tdRole = document.createElement('td');
    tdRole.setAttribute('data-label', 'Role');
    var roleBadge = document.createElement('span');
    roleBadge.className = 'status-badge ' + (user.is_admin ? 'admin' : 'user');
    roleBadge.textContent = user.is_admin ? 'Admin' : 'User';
    tdRole.appendChild(roleBadge);
    tr.appendChild(tdRole);

    // Actions
    var tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';
    tdActions.setAttribute('data-label', 'Actions');
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'row-actions';

    // Deactivate / Reactivate button
    if (user.is_active) {
      var deactivateBtn = document.createElement('button');
      deactivateBtn.className = 'action-btn danger';
      deactivateBtn.textContent = 'Deactivate';
      deactivateBtn.setAttribute('data-user-id', user.id);
      deactivateBtn.onclick = (function(userId) {
        return function() { deactivateUser(userId); };
      })(user.id);
      actionsDiv.appendChild(deactivateBtn);
    } else {
      var reactivateBtn = document.createElement('button');
      reactivateBtn.className = 'action-btn restore';
      reactivateBtn.textContent = 'Reactivate';
      reactivateBtn.setAttribute('data-user-id', user.id);
      reactivateBtn.onclick = (function(userId) {
        return function() { reactivateUser(userId); };
      })(user.id);
      actionsDiv.appendChild(reactivateBtn);
    }

    // Edit button
    var editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.textContent = 'Edit';
    editBtn.onclick = (function(u) {
      return function() { openEditUserModal(u); };
    })(user);
    actionsDiv.appendChild(editBtn);

    // Reset Password button
    var resetBtn = document.createElement('button');
    resetBtn.className = 'action-btn';
    resetBtn.textContent = 'Reset Password';
    resetBtn.onclick = (function(userId, username) {
      return function() { openResetPasswordModal(userId, username); };
    })(user.id, user.username);
    actionsDiv.appendChild(resetBtn);

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  _userTableWrap.innerHTML = '';
  _userTableWrap.appendChild(table);
}

// ── Create User Modal ────────────────────────────────────────────────────────

/**
 * Open the create user modal and clear previous input.
 */
function openCreateUserModal() {
  var usernameInput = document.getElementById('new-username');
  var displayNameInput = document.getElementById('new-display-name');
  var passwordInput = document.getElementById('new-password');
  var emailInput = document.getElementById('new-email');
  var isAdminCheckbox = document.getElementById('new-is-admin');
  var errorDiv = document.getElementById('create-user-error');

  if (usernameInput) usernameInput.value = '';
  if (displayNameInput) displayNameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (emailInput) emailInput.value = '';
  if (isAdminCheckbox) isAdminCheckbox.checked = false;
  if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; }

  if (_createUserModal) _createUserModal.style.display = 'flex';
}

/**
 * Close the create user modal.
 */
function closeCreateUserModal() {
  if (_createUserModal) _createUserModal.style.display = 'none';
}

/**
 * Submit the create user form via POST /api/users.
 */
async function submitCreateUser() {
  var errorDiv = document.getElementById('create-user-error');
  if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; }

  var username = (document.getElementById('new-username') || {}).value || '';
  var displayName = (document.getElementById('new-display-name') || {}).value || '';
  var password = (document.getElementById('new-password') || {}).value || '';
  var email = (document.getElementById('new-email') || {}).value || '';
  var isAdmin = !!(document.getElementById('new-is-admin') || {}).checked;

  // Basic client-side validation
  if (!username.trim() || !displayName.trim() || !password.trim()) {
    if (errorDiv) {
      errorDiv.textContent = 'Username, display name, and password are required.';
      errorDiv.style.display = 'block';
    }
    return;
  }

  try {
    var response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        display_name: displayName.trim(),
        password: password,
        email: email.trim() || null,
        is_admin: isAdmin
      })
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      var errMsg = errData.detail || 'Failed to create user.';
      if (errorDiv) {
        errorDiv.textContent = errMsg;
        errorDiv.style.display = 'block';
      }
      return;
    }

    // Success — close modal, show message, refresh table
    closeCreateUserModal();
    _showAdminMessage('User "' + username.trim() + '" created successfully.', 'success');
    await _loadUsers();
  } catch (err) {
    console.error('[User Admin] Error creating user:', err);
    if (errorDiv) {
      errorDiv.textContent = 'Failed to create user.';
      errorDiv.style.display = 'block';
    }
  }
}

// ── Deactivate / Reactivate ──────────────────────────────────────────────────

/**
 * Deactivate a user via PUT /api/users/{id}/deactivate.
 * @param {string} userId  The user UUID to deactivate
 */
async function deactivateUser(userId) {
  _clearAdminMessage();
  try {
    var response = await fetch('/api/users/' + userId + '/deactivate', {
      method: 'PUT'
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      _showAdminMessage(errData.detail || 'Failed to deactivate user.', 'error');
      return;
    }

    _showAdminMessage('User deactivated.', 'success');
    await _loadUsers();
  } catch (err) {
    console.error('[User Admin] Error deactivating user:', err);
    _showAdminMessage('Failed to deactivate user.', 'error');
  }
}

/**
 * Reactivate a user via PUT /api/users/{id}/reactivate.
 * @param {string} userId  The user UUID to reactivate
 */
async function reactivateUser(userId) {
  _clearAdminMessage();
  try {
    var response = await fetch('/api/users/' + userId + '/reactivate', {
      method: 'PUT'
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      _showAdminMessage(errData.detail || 'Failed to reactivate user.', 'error');
      return;
    }

    _showAdminMessage('User reactivated.', 'success');
    await _loadUsers();
  } catch (err) {
    console.error('[User Admin] Error reactivating user:', err);
    _showAdminMessage('Failed to reactivate user.', 'error');
  }
}

// ── Reset Password Modal ─────────────────────────────────────────────────────

/**
 * Open the reset password modal for a specific user.
 * @param {string} userId    The user UUID
 * @param {string} username  The username (for display)
 */
function openResetPasswordModal(userId, username) {
  _resetPasswordUserId = userId;

  var label = document.getElementById('reset-pw-user-label');
  var passwordInput = document.getElementById('reset-new-password');
  var errorDiv = document.getElementById('reset-pw-error');

  if (label) label.textContent = 'User: ' + username;
  if (passwordInput) passwordInput.value = '';
  if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; }

  if (_resetPasswordModal) _resetPasswordModal.style.display = 'flex';
}

/**
 * Close the reset password modal.
 */
function closeResetPasswordModal() {
  _resetPasswordUserId = null;
  if (_resetPasswordModal) _resetPasswordModal.style.display = 'none';
}

/**
 * Submit the reset password form via PUT /api/users/{id}/reset-password.
 */
async function submitResetPassword() {
  var errorDiv = document.getElementById('reset-pw-error');
  if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; }

  if (!_resetPasswordUserId) return;

  var newPassword = (document.getElementById('reset-new-password') || {}).value || '';

  if (!newPassword.trim()) {
    if (errorDiv) {
      errorDiv.textContent = 'Password is required.';
      errorDiv.style.display = 'block';
    }
    return;
  }

  try {
    var response = await fetch('/api/users/' + _resetPasswordUserId + '/reset-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword })
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      var errMsg = errData.detail || 'Failed to reset password.';
      if (errorDiv) {
        errorDiv.textContent = errMsg;
        errorDiv.style.display = 'block';
      }
      return;
    }

    // Success — close modal, show message
    closeResetPasswordModal();
    _showAdminMessage('Password reset successfully.', 'success');
  } catch (err) {
    console.error('[User Admin] Error resetting password:', err);
    if (errorDiv) {
      errorDiv.textContent = 'Failed to reset password.';
      errorDiv.style.display = 'block';
    }
  }
}


// ── Edit User Modal ──────────────────────────────────────────────────────────

var _editUserId = null;

/**
 * Open the edit user modal pre-filled with the user's current values.
 */
function openEditUserModal(user) {
  _editUserId = user.id;
  _clearAdminMessage();

  // Remove any existing edit modal
  var existing = document.getElementById('edit-user-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'edit-user-modal';
  overlay.className = 'modal';
  overlay.style.display = 'flex';

  overlay.innerHTML =
    '<div class="modal-content">' +
      '<h3>✏️ Edit User</h3>' +
      '<div class="modal-form">' +
        '<label>Username</label>' +
        '<input type="text" id="edit-user-username" value="' + _escHtml(user.username) + '" />' +
        '<label>Display Name</label>' +
        '<input type="text" id="edit-user-display-name" value="' + _escHtml(user.display_name) + '" />' +
        '<label>Email</label>' +
        '<input type="email" id="edit-user-email" value="' + _escHtml(user.email || '') + '" />' +
        '<label><input type="checkbox" id="edit-user-is-admin" ' + (user.is_admin ? 'checked' : '') + ' /> Admin</label>' +
      '</div>' +
      '<div id="edit-user-error" class="modal-error" style="display:none;"></div>' +
      '<div class="modal-buttons">' +
        '<button class="standard-button" onclick="closeEditUserModal()">Cancel</button>' +
        '<button class="standard-button" onclick="submitEditUser()">Save</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // ESC closes
  function _onKey(e) {
    if (e.key === 'Escape') { closeEditUserModal(); document.removeEventListener('keydown', _onKey, true); }
  }
  document.addEventListener('keydown', _onKey, true);

  // Focus first field
  setTimeout(function() {
    var el = document.getElementById('edit-user-username');
    if (el) el.focus();
  }, 50);
}

function closeEditUserModal() {
  var modal = document.getElementById('edit-user-modal');
  if (modal) modal.remove();
  _editUserId = null;
}

/**
 * Submit the edit user form via PUT /api/users/{id}.
 */
async function submitEditUser() {
  if (!_editUserId) return;

  var username = document.getElementById('edit-user-username').value.trim();
  var displayName = document.getElementById('edit-user-display-name').value.trim();
  var email = document.getElementById('edit-user-email').value.trim();
  var isAdmin = document.getElementById('edit-user-is-admin').checked;
  var errorDiv = document.getElementById('edit-user-error');

  if (!username || !displayName) {
    if (errorDiv) { errorDiv.textContent = 'Username and display name are required.'; errorDiv.style.display = 'block'; }
    return;
  }

  try {
    var response = await fetch('/api/users/' + _editUserId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, display_name: displayName, email: email, is_admin: isAdmin })
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      var errMsg = errData.detail || 'Failed to update user.';
      if (errorDiv) { errorDiv.textContent = errMsg; errorDiv.style.display = 'block'; }
      return;
    }

    closeEditUserModal();
    _showAdminMessage('User updated successfully.', 'success');
    _loadUsers();
  } catch (err) {
    console.error('[User Admin] Error updating user:', err);
    if (errorDiv) { errorDiv.textContent = 'Failed to update user.'; errorDiv.style.display = 'block'; }
  }
}

function _escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  // Cache DOM references
  _adminMessageDiv = document.getElementById('admin-message');
  _userTableWrap = document.getElementById('user-table-wrap');
  _createUserModal = document.getElementById('create-user-modal');
  _resetPasswordModal = document.getElementById('reset-password-modal');

  // Wait for auth, then check admin and load users
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(function() {
      // Admin guard — redirect non-admins to dashboard
      if (!isAdmin()) {
        window.location.href = '/';
        return;
      }
      _loadUsers();
    });
  } else {
    // Fallback if waitForAuth not available
    if (typeof isAdmin === 'function' && !isAdmin()) {
      window.location.href = '/';
      return;
    }
    _loadUsers();
  }
});
