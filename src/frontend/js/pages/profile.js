/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Profile Page
   
   Handles user profile display, profile editing (display name + email),
   and password change. Uses CwocSaveSystem for save/cancel button state.
   
   Depends on: shared-auth.js (getCurrentUser, waitForAuth),
               shared-utils.js (setSaveButtonUnsaved, setSaveButtonSaved),
               shared-page.js (CwocSaveSystem)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── DOM References ───────────────────────────────────────────────────────────

var _profileUsernameInput = null;
var _profileDisplayNameInput = null;
var _profileEmailInput = null;
var _profileMessageDiv = null;
var _passwordMessageDiv = null;
var _changePasswordBtn = null;

// ── Save System ──────────────────────────────────────────────────────────────

/**
 * Initialize CwocSaveSystem and wire up save/cancel buttons.
 * Follows the same pattern as settings.js.
 */
function _initProfileSaveSystem() {
  window._cwocSave = new CwocSaveSystem({
    singleBtnId: 'save-single-btn',
    stayBtnId: 'save-stay-btn',
    exitBtnId: 'save-exit-btn',
    cancelSelector: '.cancel-settings',
    getReturnUrl: function() {
      var url = localStorage.getItem('cwoc_settings_return');
      localStorage.removeItem('cwoc_settings_return');
      return url || '/';
    },
  });

  // Wire save buttons
  var stayBtn = document.getElementById('save-stay-btn');
  var exitBtn = document.getElementById('save-exit-btn');
  var cancelBtn = document.querySelector('.cancel-settings');

  if (stayBtn) {
    stayBtn.addEventListener('click', function() {
      _saveProfile(false);
    });
  }
  if (exitBtn) {
    exitBtn.addEventListener('click', function() {
      _saveProfile(true);
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      if (window._cwocSave) window._cwocSave.cancelOrExit();
    });
  }
}

// ── Message Helpers ──────────────────────────────────────────────────────────

/**
 * Show a message in the specified message div.
 * @param {HTMLElement} el  The message div element
 * @param {string} text    Message text
 * @param {string} type    'success' or 'error'
 */
function _showMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'profile-message ' + type;
}

/**
 * Clear a message div.
 * @param {HTMLElement} el  The message div element
 */
function _clearMessage(el) {
  if (!el) return;
  el.textContent = '';
  el.className = 'profile-message';
}

// ── Load Profile ─────────────────────────────────────────────────────────────

/**
 * Fetch user data from GET /api/auth/me and populate form fields.
 */
async function _loadProfile() {
  try {
    var response = await fetch('/api/auth/me');
    if (!response.ok) {
      console.error('[Profile] Failed to load profile:', response.status);
      _showMessage(_profileMessageDiv, 'Failed to load profile data.', 'error');
      return;
    }

    var user = await response.json();

    // Populate form fields
    if (_profileUsernameInput) {
      _profileUsernameInput.value = user.username || '';
    }
    if (_profileDisplayNameInput) {
      _profileDisplayNameInput.value = user.display_name || '';
    }
    if (_profileEmailInput) {
      _profileEmailInput.value = user.email || '';
    }

    // Mark as saved (clean state)
    setSaveButtonSaved();
  } catch (err) {
    console.error('[Profile] Error loading profile:', err);
    _showMessage(_profileMessageDiv, 'Failed to load profile data.', 'error');
  }
}

// ── Save Profile ─────────────────────────────────────────────────────────────

/**
 * Save profile changes via PUT /api/auth/profile.
 * @param {boolean} exitAfter  If true, navigate away after successful save
 */
async function _saveProfile(exitAfter) {
  _clearMessage(_profileMessageDiv);

  var displayName = _profileDisplayNameInput ? _profileDisplayNameInput.value.trim() : '';
  var email = _profileEmailInput ? _profileEmailInput.value.trim() : '';

  try {
    var response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, email: email }),
    });

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      var errMsg = errData.detail || 'Failed to save profile.';
      _showMessage(_profileMessageDiv, errMsg, 'error');
      return;
    }

    _showMessage(_profileMessageDiv, 'Profile updated successfully.', 'success');
    setSaveButtonSaved();

    if (exitAfter) {
      var returnUrl = localStorage.getItem('cwoc_settings_return');
      localStorage.removeItem('cwoc_settings_return');
      window.location.href = returnUrl || '/';
    }
  } catch (err) {
    console.error('[Profile] Error saving profile:', err);
    _showMessage(_profileMessageDiv, 'Failed to save profile.', 'error');
  }
}

// ── Password Change ──────────────────────────────────────────────────────────

/**
 * Handle password change via PUT /api/auth/password.
 * Validates that new password and confirm match before sending.
 */
async function _handlePasswordChange() {
  _clearMessage(_passwordMessageDiv);

  var currentPw = document.getElementById('current-password');
  var newPw = document.getElementById('new-password');
  var confirmPw = document.getElementById('confirm-new-password');

  var currentVal = currentPw ? currentPw.value : '';
  var newVal = newPw ? newPw.value : '';
  var confirmVal = confirmPw ? confirmPw.value : '';

  // Validate fields are filled
  if (!currentVal || !newVal || !confirmVal) {
    _showMessage(_passwordMessageDiv, 'Please fill in all password fields.', 'error');
    return;
  }

  // Validate new password matches confirmation
  if (newVal !== confirmVal) {
    _showMessage(_passwordMessageDiv, 'New passwords do not match.', 'error');
    return;
  }

  try {
    var response = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentVal, new_password: newVal }),
    });

    if (response.status === 403) {
      _showMessage(_passwordMessageDiv, 'Current password is incorrect.', 'error');
      return;
    }

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      var errMsg = errData.detail || 'Failed to change password.';
      _showMessage(_passwordMessageDiv, errMsg, 'error');
      return;
    }

    _showMessage(_passwordMessageDiv, 'Password changed successfully.', 'success');

    // Clear password fields
    if (currentPw) currentPw.value = '';
    if (newPw) newPw.value = '';
    if (confirmPw) confirmPw.value = '';
  } catch (err) {
    console.error('[Profile] Error changing password:', err);
    _showMessage(_passwordMessageDiv, 'Failed to change password.', 'error');
  }
}

// ── Dirty State Tracking ─────────────────────────────────────────────────────

/**
 * Wire up input listeners on editable profile fields to track dirty state.
 */
function _monitorProfileChanges() {
  var editableFields = [_profileDisplayNameInput, _profileEmailInput];
  editableFields.forEach(function(el) {
    if (!el) return;
    el.addEventListener('input', function() {
      setSaveButtonUnsaved();
    });
    el.addEventListener('change', function() {
      setSaveButtonUnsaved();
    });
  });
}

// ── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  // Cache DOM references
  _profileUsernameInput = document.getElementById('profile-username');
  _profileDisplayNameInput = document.getElementById('profile-display-name');
  _profileEmailInput = document.getElementById('profile-email');
  _profileMessageDiv = document.getElementById('profile-message');
  _passwordMessageDiv = document.getElementById('password-message');
  _changePasswordBtn = document.getElementById('change-password-btn');

  // Initialize save system
  _initProfileSaveSystem();

  // Wire up password change button
  if (_changePasswordBtn) {
    _changePasswordBtn.addEventListener('click', _handlePasswordChange);
  }

  // Monitor editable fields for dirty state
  _monitorProfileChanges();

  // Load profile data (wait for auth to complete first)
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(function() {
      _loadProfile();
    });
  } else {
    _loadProfile();
  }
});
