/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Profile Page
   
   Handles user profile display, profile editing (display name + email),
   and password change. Uses CwocSaveSystem for save/cancel button state.
   
   Depends on: shared-auth.js (getCurrentUser, waitForAuth),
               shared-page.js (CwocSaveSystem)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────────────────

var _viewingOtherUser = false;  // True when viewing another user's profile (read-only)
var _viewedUserId = null;       // The user_id being viewed (null = self)

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
 * Fetch user data and populate form fields.
 * If ?user_id= is in the URL and it's not the current user, load in read-only mode.
 */
async function _loadProfile() {
  // Check for ?user_id= parameter
  var params = new URLSearchParams(window.location.search);
  var targetUserId = params.get('user_id');

  // Determine if we're viewing another user
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

  if (targetUserId && targetUserId !== currentUserId) {
    _viewingOtherUser = true;
    _viewedUserId = targetUserId;
    _loadOtherUserProfile(targetUserId);
    return;
  }

  // Load own profile
  try {
    var response = await fetch('/api/auth/me');
    if (!response.ok) {
      console.error('[Profile] Failed to load profile:', response.status);
      _showMessage(_profileMessageDiv, 'Failed to load profile data.', 'error');
      return;
    }

    var user = await response.json();
    _populateProfileFields(user);

    // Mark as saved (clean state)
    if (window._cwocSave) window._cwocSave.markSaved();
  } catch (err) {
    console.error('[Profile] Error loading profile:', err);
    _showMessage(_profileMessageDiv, 'Failed to load profile data.', 'error');
  }
}

/**
 * Load another user's profile in read-only mode.
 */
async function _loadOtherUserProfile(userId) {
  try {
    var response = await fetch('/api/auth/user-profile/' + encodeURIComponent(userId));
    if (!response.ok) {
      console.error('[Profile] Failed to load user profile:', response.status);
      _showMessage(_profileMessageDiv, 'User not found or not accessible.', 'error');
      return;
    }

    var user = await response.json();

    // If the API says it's actually our own profile, switch to edit mode
    if (user.is_self) {
      _viewingOtherUser = false;
      _viewedUserId = null;
      _populateProfileFields(user);
      if (window._cwocSave) window._cwocSave.markSaved();
      return;
    }

    _populateProfileFields(user);
    _applyReadOnlyMode(user.display_name || user.username);
  } catch (err) {
    console.error('[Profile] Error loading user profile:', err);
    _showMessage(_profileMessageDiv, 'Failed to load user profile.', 'error');
  }
}

/**
 * Populate profile form fields from a user object.
 */
function _populateProfileFields(user) {
  if (_profileUsernameInput) {
    _profileUsernameInput.value = user.username || '';
  }
  if (_profileDisplayNameInput) {
    _profileDisplayNameInput.value = user.display_name || '';
  }
  if (_profileEmailInput) {
    _profileEmailInput.value = user.email || '';
  }

  // Name fields
  var prefixEl = document.getElementById('profile-prefix');
  if (prefixEl) prefixEl.value = user.prefix || '';
  var givenEl = document.getElementById('profile-given-name');
  if (givenEl) givenEl.value = user.given_name || '';
  var middleEl = document.getElementById('profile-middle-names');
  if (middleEl) middleEl.value = user.middle_names || '';
  var surnameEl = document.getElementById('profile-surname');
  if (surnameEl) surnameEl.value = user.surname || '';
  var suffixEl = document.getElementById('profile-suffix');
  if (suffixEl) suffixEl.value = user.suffix || '';

  // Other text fields
  var nicknameEl = document.getElementById('profile-nickname');
  if (nicknameEl) nicknameEl.value = user.nickname || '';
  var orgEl = document.getElementById('profile-organization');
  if (orgEl) orgEl.value = user.organization || '';
  var scEl = document.getElementById('profile-social-context');
  if (scEl) scEl.value = user.social_context || '';
  var notesEl = document.getElementById('profile-notes');
  if (notesEl) notesEl.value = user.notes || '';

  // Security fields
  var signalCb = document.getElementById('profile-has-signal');
  if (signalCb) {
    signalCb.checked = !!user.has_signal;
    var signalRow = document.getElementById('profile-signal-row');
    if (signalRow) signalRow.style.display = user.has_signal ? '' : 'none';
  }
  var signalUser = document.getElementById('profile-signal-username');
  if (signalUser) signalUser.value = user.signal_username || '';
  var pgpEl = document.getElementById('profile-pgp-key');
  if (pgpEl) pgpEl.value = user.pgp_key || '';

  // Color
  var colorHex = document.getElementById('profile-color-hex');
  var colorPreview = document.getElementById('profile-color-preview');
  if (colorHex) colorHex.value = user.color || '';
  if (colorPreview) colorPreview.style.backgroundColor = user.color || 'transparent';

  // Multi-value fields
  _setProfileMvEntries('phones', user.phones);
  _setProfileMvEntries('emails', user.emails_json);
  _setProfileMvEntries('addresses', user.addresses);
  _setProfileMvEntries('callsigns', user.call_signs);
  _setProfileMvEntries('xhandles', user.x_handles);
  _setProfileMvEntries('websites', user.websites);

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

  // Init color swatches and apply background tint
  _initProfileColorSwatches(user.color);
  _applyProfileColorTint(user.color);
}

/**
 * Apply read-only mode: disable all inputs, hide save/password sections.
 */
function _applyReadOnlyMode(displayName) {
  // Update page title
  var titleEl = document.querySelector('[data-page-title]');
  if (titleEl) titleEl.setAttribute('data-page-title', (displayName || 'User') + "'s Profile");
  // Update the header text if already injected
  var headerH2 = document.querySelector('.header-and-buttons h2');
  if (headerH2) {
    var textNode = headerH2.lastChild;
    if (textNode && textNode.nodeType === 3) {
      textNode.textContent = ' ' + (displayName || 'User') + "'s Profile";
    }
  }

  // Make all inputs read-only
  if (_profileDisplayNameInput) { _profileDisplayNameInput.readOnly = true; _profileDisplayNameInput.style.opacity = '0.6'; _profileDisplayNameInput.style.cursor = 'not-allowed'; }
  if (_profileEmailInput) { _profileEmailInput.readOnly = true; _profileEmailInput.style.opacity = '0.6'; _profileEmailInput.style.cursor = 'not-allowed'; }

  // Disable all new profile fields
  ['profile-nickname', 'profile-organization', 'profile-social-context', 'profile-notes',
   'profile-given-name', 'profile-middle-names', 'profile-surname',
   'profile-signal-username', 'profile-pgp-key', 'profile-color-hex'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.readOnly = true; el.style.opacity = '0.6'; el.style.cursor = 'not-allowed'; }
  });

  // Disable selects and checkboxes
  ['profile-prefix', 'profile-suffix', 'profile-has-signal'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.disabled = true; el.style.opacity = '0.6'; }
  });

  // Hide color swatches
  var swatches = document.getElementById('profile-color-swatches');
  if (swatches) swatches.style.display = 'none';

  // Hide all add-entry buttons and remove buttons
  document.querySelectorAll('.profile-mv-row .mv-remove').forEach(function (btn) { btn.style.display = 'none'; });
  document.querySelectorAll('.profile-form button[onclick*="_addProfileMvEntry"]').forEach(function (btn) { btn.style.display = 'none'; });
  document.querySelectorAll('.profile-mv-row input').forEach(function (inp) { inp.readOnly = true; inp.style.opacity = '0.6'; inp.style.cursor = 'not-allowed'; });

  // Hide save buttons
  var saveToolbar = document.querySelector('.cwoc-toolbar');
  if (saveToolbar) saveToolbar.style.display = 'none';

  // Hide password section
  var passwordGroups = document.querySelectorAll('.setting-group');
  passwordGroups.forEach(function (g) {
    var h3 = g.querySelector('h3');
    if (h3 && h3.textContent.includes('Password')) g.style.display = 'none';
  });

  // Hide image upload controls
  var imageInput = document.getElementById('profile-image-input');
  if (imageInput) imageInput.disabled = true;
  var imagePreview = document.getElementById('profile-image-preview');
  if (imagePreview) { imagePreview.style.cursor = 'default'; imagePreview.onclick = null; }
  var uploadBtns = document.querySelectorAll('.profile-image-actions');
  uploadBtns.forEach(function (el) { el.style.display = 'none'; });

  // Show a read-only banner
  var banner = document.createElement('div');
  banner.className = 'cwoc-readonly-banner';
  banner.textContent = '👁️ Viewing ' + (displayName || 'user') + "'s profile (read-only)";
  var panel = document.querySelector('.settings-panel');
  if (panel) panel.insertBefore(banner, panel.firstChild);
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

  // Collect all fields
  var payload = { display_name: displayName, email: email };

  // Name fields
  var prefixEl = document.getElementById('profile-prefix');
  if (prefixEl) payload.prefix = prefixEl.value;
  var givenEl = document.getElementById('profile-given-name');
  if (givenEl) payload.given_name = givenEl.value.trim();
  var middleEl = document.getElementById('profile-middle-names');
  if (middleEl) payload.middle_names = middleEl.value.trim();
  var surnameEl = document.getElementById('profile-surname');
  if (surnameEl) payload.surname = surnameEl.value.trim();
  var suffixEl = document.getElementById('profile-suffix');
  if (suffixEl) payload.suffix = suffixEl.value;

  // Text fields
  var nicknameEl = document.getElementById('profile-nickname');
  if (nicknameEl) payload.nickname = nicknameEl.value.trim();
  var orgEl = document.getElementById('profile-organization');
  if (orgEl) payload.organization = orgEl.value.trim();
  var scEl = document.getElementById('profile-social-context');
  if (scEl) payload.social_context = scEl.value.trim();
  var notesEl = document.getElementById('profile-notes');
  if (notesEl) payload.notes = notesEl.value.trim();

  // Security fields
  var signalCb = document.getElementById('profile-has-signal');
  if (signalCb) payload.has_signal = signalCb.checked;
  var signalUser = document.getElementById('profile-signal-username');
  if (signalUser) payload.signal_username = signalUser.value.trim();
  var pgpEl = document.getElementById('profile-pgp-key');
  if (pgpEl) payload.pgp_key = pgpEl.value.trim();

  // Color
  var colorHex = document.getElementById('profile-color-hex');
  if (colorHex) payload.color = colorHex.value.trim();

  // Multi-value fields
  payload.phones = _getProfileMvEntries('phones');
  payload.emails_json = _getProfileMvEntries('emails');
  payload.addresses = _getProfileMvEntries('addresses');
  payload.call_signs = _getProfileMvEntries('callsigns');
  payload.x_handles = _getProfileMvEntries('xhandles');
  payload.websites = _getProfileMvEntries('websites');

  try {
    var response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

// ── Signal Toggle ─────────────────────────────────────────────────────────────

function _onProfileSignalToggle() {
  var cb = document.getElementById('profile-has-signal');
  var row = document.getElementById('profile-signal-row');
  if (row) row.style.display = cb && cb.checked ? '' : 'none';
  if (cb && !cb.checked) {
    var input = document.getElementById('profile-signal-username');
    if (input) input.value = '';
  }
  if (window._cwocSave) window._cwocSave.markUnsaved();
}
window._onProfileSignalToggle = _onProfileSignalToggle;

// ── Color Swatches ───────────────────────────────────────────────────────────

// Standard palette (matches settings page defaults)
var _profileStandardPalette = [
  { hex: '#C66B6B', name: 'Dusty Rose' },
  { hex: '#D68A59', name: 'Burnt Sienna' },
  { hex: '#E3B23C', name: 'Golden Ochre' },
  { hex: '#8A9A5B', name: 'Mossy Sage' },
  { hex: '#6B8299', name: 'Slate Teal' },
  { hex: '#8B6B99', name: 'Muted Lilac' },
  { hex: '#b22222', name: 'Firebrick' },
  { hex: '#DAA520', name: 'Goldenrod' }
];

async function _initProfileColorSwatches(currentColor) {
  var container = document.getElementById('profile-color-swatches');
  if (!container) return;
  container.innerHTML = '';

  // Clear swatch
  var clearBtn = document.createElement('span');
  clearBtn.className = 'profile-color-swatch profile-color-swatch-clear';
  clearBtn.title = 'No color';
  clearBtn.addEventListener('click', function () { _selectProfileColor(''); });
  container.appendChild(clearBtn);

  // Standard colors label
  var stdLabel = document.createElement('div');
  stdLabel.style.cssText = 'width:100%;font-size:0.75em;color:#6b4e31;margin:4px 0 2px;font-weight:bold;';
  stdLabel.textContent = 'Standard';
  container.appendChild(stdLabel);

  // Standard color swatches
  _profileStandardPalette.forEach(function (c) {
    var swatch = _createProfileColorSwatch(c.hex, c.name, currentColor);
    container.appendChild(swatch);
  });

  // Load custom colors from settings
  try {
    var settings = await getCachedSettings();
    var customColors = settings.custom_colors || [];
    if (customColors.length > 0) {
      var customLabel = document.createElement('div');
      customLabel.style.cssText = 'width:100%;font-size:0.75em;color:#6b4e31;margin:6px 0 2px;font-weight:bold;';
      customLabel.textContent = 'Custom';
      container.appendChild(customLabel);

      customColors.forEach(function (c) {
        var hex = (typeof c === 'string') ? c : (c.hex || c);
        var name = (typeof c === 'object' && c.name) ? c.name : hex;
        // Skip transparent or duplicates of standard palette
        if (!hex || hex === 'transparent') return;
        var swatch = _createProfileColorSwatch(hex, name, currentColor);
        container.appendChild(swatch);
      });
    }
  } catch (e) {
    console.error('Could not load custom colors for profile:', e);
  }
}

function _createProfileColorSwatch(hex, name, currentColor) {
  var swatch = document.createElement('span');
  swatch.className = 'profile-color-swatch';
  swatch.style.backgroundColor = hex;
  if (currentColor && hex.toLowerCase() === (currentColor || '').toLowerCase()) {
    swatch.style.borderColor = '#4a2c2a';
  }
  swatch.title = (name || hex) + ' (' + hex + ')';
  swatch.addEventListener('click', function () { _selectProfileColor(hex); });
  swatch.addEventListener('mouseenter', function () { swatch.style.transform = 'scale(1.2)'; });
  swatch.addEventListener('mouseleave', function () { swatch.style.transform = ''; });
  return swatch;
}

function _selectProfileColor(hex) {
  var colorHex = document.getElementById('profile-color-hex');
  var colorPreview = document.getElementById('profile-color-preview');
  if (colorHex) colorHex.value = hex;
  if (colorPreview) colorPreview.style.backgroundColor = hex || 'transparent';

  // Tint the page background like the chit editor does
  _applyProfileColorTint(hex);

  // Update swatch borders
  var swatches = document.querySelectorAll('#profile-color-swatches .profile-color-swatch');
  swatches.forEach(function (s) {
    if (s.classList.contains('profile-color-swatch-clear')) return;
    s.style.borderColor = (s.style.backgroundColor && hex && _colorsMatch(s.style.backgroundColor, hex)) ? '#4a2c2a' : 'transparent';
  });
  if (window._cwocSave) window._cwocSave.markUnsaved();
}

/** Apply a background color tint to the profile page, matching the chit editor behavior. */
function _applyProfileColorTint(hex) {
  var panel = document.querySelector('.settings-panel');
  if (!panel) return;
  if (hex) {
    // Override the gradient background and apply contrast text color
    panel.style.background = hex;
    applyChitColors(panel, hex);
  } else {
    // Restore default parchment gradient
    panel.style.background = '';
    panel.style.backgroundColor = '';
    panel.style.color = '';
  }
}

/** Compare two color values (handles rgb vs hex). */
function _colorsMatch(a, b) {
  if (!a || !b) return false;
  // Normalize both to lowercase hex
  function toHex(c) {
    c = c.trim().toLowerCase();
    if (c.startsWith('#')) return c;
    var m = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m) return '#' + ((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1);
    return c;
  }
  return toHex(a) === toHex(b);
}

// ── Multi-Value Entry Helpers ─────────────────────────────────────────────────

var _mvContainerMap = {
  phones: 'profile-phones-entries',
  emails: 'profile-emails-entries',
  addresses: 'profile-addresses-entries',
  callsigns: 'profile-callsigns-entries',
  xhandles: 'profile-xhandles-entries',
  websites: 'profile-websites-entries'
};

var _mvPlaceholders = {
  phones: '+1-555-0100',
  emails: 'user@example.com',
  addresses: '123 Main St, City, ST 00000',
  callsigns: 'KD2ABC',
  xhandles: '@username',
  websites: 'https://example.com'
};

function _addProfileMvEntry(fieldName, label, value) {
  var containerId = _mvContainerMap[fieldName];
  if (!containerId) return;
  var container = document.getElementById(containerId);
  if (!container) return;

  var row = document.createElement('div');
  row.className = 'profile-mv-row';

  var labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'mv-label';
  labelInput.placeholder = 'Label';
  labelInput.value = label || '';

  var valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.className = 'mv-value';
  valueInput.placeholder = _mvPlaceholders[fieldName] || 'Value';
  valueInput.value = value || '';

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'mv-remove';
  removeBtn.innerHTML = '<i class="fas fa-times"></i>';
  removeBtn.title = 'Remove';
  removeBtn.addEventListener('click', function () {
    row.remove();
    if (window._cwocSave) window._cwocSave.markUnsaved();
  });

  labelInput.addEventListener('input', function () { if (window._cwocSave) window._cwocSave.markUnsaved(); });
  valueInput.addEventListener('input', function () { if (window._cwocSave) window._cwocSave.markUnsaved(); });

  row.appendChild(labelInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  container.appendChild(row);

  if (window._cwocSave) window._cwocSave.markUnsaved();
  valueInput.focus();
}
window._addProfileMvEntry = _addProfileMvEntry;

function _setProfileMvEntries(fieldName, entries) {
  var containerId = _mvContainerMap[fieldName];
  if (!containerId) return;
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!entries || !entries.length) return;
  for (var i = 0; i < entries.length; i++) {
    _addProfileMvEntry(fieldName, entries[i].label || '', entries[i].value || '');
  }
}

function _getProfileMvEntries(fieldName) {
  var containerId = _mvContainerMap[fieldName];
  if (!containerId) return [];
  var container = document.getElementById(containerId);
  if (!container) return [];
  var entries = [];
  var rows = container.querySelectorAll('.profile-mv-row');
  for (var i = 0; i < rows.length; i++) {
    var label = rows[i].querySelector('.mv-label').value.trim();
    var value = rows[i].querySelector('.mv-value').value.trim();
    if (value) entries.push({ label: label, value: value });
  }
  return entries.length > 0 ? entries : [];
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
  var editableFields = [
    _profileDisplayNameInput, _profileEmailInput,
    document.getElementById('profile-nickname'),
    document.getElementById('profile-organization'),
    document.getElementById('profile-social-context'),
    document.getElementById('profile-notes'),
    document.getElementById('profile-given-name'),
    document.getElementById('profile-middle-names'),
    document.getElementById('profile-surname'),
    document.getElementById('profile-signal-username'),
    document.getElementById('profile-pgp-key'),
    document.getElementById('profile-color-hex')
  ];
  editableFields.forEach(function(el) {
    if (!el) return;
    el.addEventListener('input', function() {
      if (window._cwocSave) window._cwocSave.markUnsaved();
    });
    el.addEventListener('change', function() {
      if (window._cwocSave) window._cwocSave.markUnsaved();
    });
  });
  // Selects and checkboxes
  ['profile-prefix', 'profile-suffix', 'profile-has-signal'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function() {
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
