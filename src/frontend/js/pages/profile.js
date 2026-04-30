/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Profile Page
   
   Handles user profile display, profile editing (display name + email),
   and password change. Uses CwocSaveSystem for save/cancel button state.
   
   Depends on: shared-auth.js (getCurrentUser, waitForAuth),
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

    // Set profile image
    var displayImg = document.getElementById('profile-image-display');
    var removeBtn = document.getElementById('remove-profile-image-btn');
    if (user.profile_image_url) {
      if (displayImg) displayImg.src = user.profile_image_url + '?t=' + Date.now();
      if (removeBtn) removeBtn.style.display = '';
    } else {
      if (displayImg) displayImg.src = '/static/default-avatar.svg';
      if (removeBtn) removeBtn.style.display = 'none';
    }

    // Mark as saved (clean state)
    if (window._cwocSave) window._cwocSave.markSaved();
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
    if (window._cwocSave) window._cwocSave.markSaved();

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
      if (window._cwocSave) window._cwocSave.markUnsaved();
    });
    el.addEventListener('change', function() {
      if (window._cwocSave) window._cwocSave.markUnsaved();
    });
  });
}

// ── Profile Image ────────────────────────────────────────────────────────────

var _MAX_PROFILE_IMAGE_SIZE = 512;

/**
 * Handle profile image file selection — resize and upload immediately.
 */
function _handleProfileImageSelect(file) {
  if (!file) return;

  var msgDiv = document.getElementById('profile-image-message');
  if (msgDiv) { msgDiv.textContent = ''; msgDiv.className = 'profile-message'; }

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > _MAX_PROFILE_IMAGE_SIZE || h > _MAX_PROFILE_IMAGE_SIZE) {
        if (w > h) { h = Math.round(h * _MAX_PROFILE_IMAGE_SIZE / w); w = _MAX_PROFILE_IMAGE_SIZE; }
        else { w = Math.round(w * _MAX_PROFILE_IMAGE_SIZE / h); h = _MAX_PROFILE_IMAGE_SIZE; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(function(blob) {
        if (!blob) { console.error('[Profile] Image resize failed'); return; }
        var resizedFile = new File([blob], file.name || 'profile.jpg', { type: blob.type });
        _uploadProfileImage(resizedFile, canvas.toDataURL());
      }, file.type || 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Upload the profile image to the server.
 */
async function _uploadProfileImage(file, previewDataUrl) {
  var msgDiv = document.getElementById('profile-image-message');
  try {
    var formData = new FormData();
    formData.append('file', file);
    var resp = await fetch('/api/auth/profile-image', { method: 'POST', body: formData });
    if (!resp.ok) {
      var err = await resp.json().catch(function() { return {}; });
      _showMessage(msgDiv, err.detail || 'Failed to upload image.', 'error');
      return;
    }
    var result = await resp.json();
    // Update the preview
    var displayImg = document.getElementById('profile-image-display');
    if (displayImg) displayImg.src = result.profile_image_url + '?t=' + Date.now();
    // Show remove button
    var removeBtn = document.getElementById('remove-profile-image-btn');
    if (removeBtn) removeBtn.style.display = '';
    // Update the top-right profile menu image
    var topImg = document.getElementById('cwoc-profile-img');
    if (topImg) topImg.src = result.profile_image_url + '?t=' + Date.now();
    _showMessage(msgDiv, 'Profile image updated.', 'success');
  } catch (err) {
    console.error('[Profile] Image upload error:', err);
    _showMessage(msgDiv, 'Failed to upload image.', 'error');
  }
}

/**
 * Remove the profile image.
 */
async function _removeProfileImage() {
  var msgDiv = document.getElementById('profile-image-message');
  try {
    var resp = await fetch('/api/auth/profile-image', { method: 'DELETE' });
    if (!resp.ok) {
      _showMessage(msgDiv, 'Failed to remove image.', 'error');
      return;
    }
    var displayImg = document.getElementById('profile-image-display');
    if (displayImg) displayImg.src = '/static/default-avatar.svg';
    var removeBtn = document.getElementById('remove-profile-image-btn');
    if (removeBtn) removeBtn.style.display = 'none';
    var topImg = document.getElementById('cwoc-profile-img');
    if (topImg) topImg.src = '/static/default-avatar.svg';
    _showMessage(msgDiv, 'Profile image removed.', 'success');
  } catch (err) {
    console.error('[Profile] Image remove error:', err);
    _showMessage(msgDiv, 'Failed to remove image.', 'error');
  }
}

// Export for inline onclick
window._removeProfileImage = _removeProfileImage;

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

  // Wire up profile image upload
  var imageInput = document.getElementById('profile-image-input');
  if (imageInput) {
    imageInput.addEventListener('change', function() {
      if (imageInput.files.length > 0) _handleProfileImageSelect(imageInput.files[0]);
      imageInput.value = ''; // reset so same file can be re-selected
    });
  }

  // Load profile data (wait for auth to complete first)
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(function() {
      _loadProfile();
    });
  } else {
    _loadProfile();
  }
});
