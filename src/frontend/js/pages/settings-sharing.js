// ── Settings: Tag Sharing, Kiosk, Default Notifications ──────────────────────
// Tag-level sharing config, kiosk tag picker, default notification rows,
// login message load (admin).
// Extracted from settings.js for modularity.

// ── Tag Sharing Configuration ────────────────────────────────────────────────

/** Cached shared_tags config from the server */
var _tagSharingConfig = [];

/** Cached user list for the tag sharing user picker */
var _tagSharingUserList = null;

/** Current tag's shares being edited in the tag modal */
var _currentTagShares = [];

/**
 * Load shared_tags config from GET /api/settings/shared-tags.
 */
async function _loadTagSharingData() {
  if (typeof waitForAuth === 'function') {
    await waitForAuth();
  }
  try {
    var response = await fetch('/api/settings/shared-tags');
    if (!response.ok) {
      console.error('[TagSharing] Failed to load shared tags:', response.status);
      _tagSharingConfig = [];
      return;
    }
    var data = await response.json();
    _tagSharingConfig = Array.isArray(data.shared_tags) ? data.shared_tags : [];
  } catch (err) {
    console.error('[TagSharing] Error loading shared tags:', err);
    _tagSharingConfig = [];
  }

  _renderSettingsTagTree();
}

/**
 * Fetch the switchable user list for the tag sharing picker (cached).
 */
async function _loadTagSharingUserList() {
  if (_tagSharingUserList !== null) return;
  try {
    var response = await fetch('/api/auth/switchable-users');
    if (!response.ok) {
      console.error('[TagSharing] Failed to load user list:', response.status);
      _tagSharingUserList = [];
      return;
    }
    _tagSharingUserList = await response.json();
  } catch (err) {
    console.error('[TagSharing] Error loading user list:', err);
    _tagSharingUserList = [];
  }
}

/**
 * Get the shares array for a given tag name from the cached config.
 */
function _getTagShares(tagName) {
  if (!tagName || !_tagSharingConfig) return [];
  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === tagName) {
      return _tagSharingConfig[i].shares || [];
    }
  }
  return [];
}

/**
 * Check if a tag has any active sharing configuration.
 */
function _tagHasSharing(tagName) {
  return _getTagShares(tagName).length > 0;
}

/**
 * Populate the tag sharing user picker dropdown.
 */
function _populateTagSharingUserPicker() {
  var picker = document.getElementById('tag-sharing-user-picker');
  if (!picker || !_tagSharingUserList) return;

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? currentUser.user_id : null;

  var sharedIds = new Set();
  _currentTagShares.forEach(function(s) {
    sharedIds.add(s.user_id);
  });

  picker.innerHTML = '<option value="">— Select User —</option>';

  _tagSharingUserList.forEach(function(user) {
    if (user.id === currentUserId) return;
    if (sharedIds.has(user.id)) return;

    var opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.display_name || user.username;
    picker.appendChild(opt);
  });
}

/**
 * Render the current tag's shares list in the tag modal.
 */
function _renderTagSharesList() {
  var container = document.getElementById('tag-sharing-list');
  if (!container) return;

  if (_currentTagShares.length === 0) {
    container.innerHTML = '<div class="tag-sharing-empty">Not shared with anyone</div>';
    return;
  }

  container.innerHTML = '';

  _currentTagShares.forEach(function(share) {
    var row = document.createElement('div');
    row.className = 'tag-sharing-item';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'tag-share-name';
    nameSpan.textContent = _getTagSharingUserName(share.user_id);
    row.appendChild(nameSpan);

    var badge = document.createElement('span');
    badge.className = 'tag-share-role tag-share-role-' + share.role;
    badge.textContent = share.role === 'manager' ? '✏️ Manager' : '👁️ Viewer';
    row.appendChild(badge);

    var permToggle = document.createElement('button');
    permToggle.type = 'button';
    permToggle.className = 'tag-share-perm-toggle';
    var perm = share.tag_permission || 'view';
    permToggle.textContent = perm === 'manage' ? '🔧 Manage' : '👁️ View';
    permToggle.title = perm === 'manage' ? 'Tag permission: can rename, recolor, delete' : 'Tag permission: read-only tag access';
    permToggle.dataset.perm = perm;
    permToggle.addEventListener('click', (function(uid) {
      return function() {
        for (var i = 0; i < _currentTagShares.length; i++) {
          if (_currentTagShares[i].user_id === uid) {
            var cur = _currentTagShares[i].tag_permission || 'view';
            _currentTagShares[i].tag_permission = cur === 'view' ? 'manage' : 'view';
            break;
          }
        }
        _renderTagSharesList();
        _saveTagSharingConfig();
      };
    })(share.user_id));
    row.appendChild(permToggle);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tag-share-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove share';
    removeBtn.addEventListener('click', (function(uid) {
      return function() { _removeTagShare(uid); };
    })(share.user_id));
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

/**
 * Look up a user's display name from the cached user list.
 */
function _getTagSharingUserName(userId) {
  if (_tagSharingUserList) {
    for (var i = 0; i < _tagSharingUserList.length; i++) {
      if (_tagSharingUserList[i].id === userId) {
        return _tagSharingUserList[i].display_name || _tagSharingUserList[i].username;
      }
    }
  }
  for (var j = 0; j < _currentTagShares.length; j++) {
    if (_currentTagShares[j].user_id === userId && _currentTagShares[j].display_name) {
      return _currentTagShares[j].display_name;
    }
  }
  return userId;
}

/**
 * Add a user share to the current tag.
 */
function _addTagShare() {
  var picker = document.getElementById('tag-sharing-user-picker');
  var roleSelect = document.getElementById('tag-sharing-role-select');
  if (!picker || !roleSelect) return;

  var userId = picker.value;
  var role = roleSelect.value;

  if (!userId) {
    cwocToast('Please select a user to share with.', 'error');
    return;
  }

  for (var i = 0; i < _currentTagShares.length; i++) {
    if (_currentTagShares[i].user_id === userId) {
      cwocToast('This user already has access to this tag.', 'error');
      return;
    }
  }

  _currentTagShares.push({ user_id: userId, role: role, tag_permission: 'view' });
  _renderTagSharesList();
  _populateTagSharingUserPicker();
  _saveTagSharingConfig();
}

/**
 * Remove a user from the current tag's shares.
 */
function _removeTagShare(userId) {
  _currentTagShares = _currentTagShares.filter(function(s) {
    return s.user_id !== userId;
  });
  _renderTagSharesList();
  _populateTagSharingUserPicker();
  _saveTagSharingConfig();
}

/**
 * Save the full shared_tags config to the server.
 */
async function _saveTagSharingConfig(tagName) {
  if (tagName === undefined) {
    var tagNameInput = document.getElementById('tag-name');
    if (!tagNameInput) return;
    tagName = tagNameInput.value.trim();
    if (!tagName) return;
  }

  if (tagName) {
    var found = false;
    for (var i = 0; i < _tagSharingConfig.length; i++) {
      if (_tagSharingConfig[i].tag === tagName) {
        if (_currentTagShares.length === 0) {
          _tagSharingConfig.splice(i, 1);
        } else {
          _tagSharingConfig[i].shares = _currentTagShares.map(function(s) {
            return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
          });
        }
        found = true;
        break;
      }
    }
    if (!found && _currentTagShares.length > 0) {
      _tagSharingConfig.push({
        tag: tagName,
        shares: _currentTagShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        }),
      });
    }

    _propagateTagSharingToSubTags(tagName);
  }

  try {
    var response = await fetch('/api/settings/shared-tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shared_tags: _tagSharingConfig }),
    });
    if (!response.ok) {
      var errText = await response.text();
      console.error('[TagSharing] Failed to save shared tags:', response.status, errText);
      cwocToast('Failed to save tag sharing: ' + errText, 'error');
      return;
    }
    var data = await response.json();
    _tagSharingConfig = Array.isArray(data.shared_tags) ? data.shared_tags : _tagSharingConfig;
  } catch (err) {
    console.error('[TagSharing] Error saving shared tags:', err);
    cwocToast('Failed to save tag sharing configuration.', 'error');
  }

  _renderSettingsTagTree();
}

/**
 * Propagate a parent tag's sharing config to all its sub-tags.
 */
function _propagateTagSharingToSubTags(parentTag) {
  if (!parentTag) return;

  var parentShares = null;
  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === parentTag) {
      parentShares = _tagSharingConfig[i].shares;
      break;
    }
  }

  var tagDivs = document.querySelectorAll('#tag-editor-hidden .tag:not(.tag-input-container .tag)');
  var allTagNames = Array.from(tagDivs).map(function(div) {
    return (div.childNodes[0]?.textContent || '').trim();
  }).filter(function(n) { return n; });

  var prefix = parentTag + '/';

  allTagNames.forEach(function(tagName) {
    if (!tagName.startsWith(prefix)) return;

    if (parentShares && parentShares.length > 0) {
      var subShares = parentShares.map(function(s) {
        return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
      });

      var found = false;
      for (var j = 0; j < _tagSharingConfig.length; j++) {
        if (_tagSharingConfig[j].tag === tagName) {
          _tagSharingConfig[j].shares = subShares;
          found = true;
          break;
        }
      }
      if (!found) {
        _tagSharingConfig.push({ tag: tagName, shares: subShares });
      }
    } else {
      _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
        return entry.tag !== tagName;
      });
    }
  });
}

/**
 * When a sub-tag is added to a shared parent, copy the parent's sharing config.
 */
function _inheritParentTagSharing(newTagName) {
  if (!newTagName || !newTagName.includes('/')) return;

  var parts = newTagName.split('/');
  for (var depth = parts.length - 1; depth >= 1; depth--) {
    var parentPath = parts.slice(0, depth).join('/');
    var parentShares = _getTagShares(parentPath);
    if (parentShares.length > 0) {
      var subShares = parentShares.map(function(s) {
        return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
      });
      _tagSharingConfig.push({ tag: newTagName, shares: subShares });
      _saveTagSharingConfig(null);
      return;
    }
  }
}

/**
 * Initialize the tag sharing section when the tag modal opens.
 */
async function _initTagSharingSection(tagName) {
  await _loadTagSharingUserList();

  _currentTagShares = _getTagShares(tagName).map(function(s) {
    return {
      user_id: s.user_id,
      role: s.role,
      tag_permission: s.tag_permission || 'view',
      display_name: s.display_name || '',
    };
  });

  _populateTagSharingUserPicker();
  _renderTagSharesList();
}

/**
 * Enforce tag permission on the tag edit modal.
 */
function _enforceTagPermission(tagName) {
  var tagNameInput = document.getElementById('tag-name');
  var colorInput = document.getElementById('tag-color');
  var fontColorInput = document.getElementById('tag-font-color');
  var bgSwatches = document.getElementById('tag-color-swatches');
  var fgSwatches = document.getElementById('tag-font-color-swatches');
  var deleteBtn = document.querySelector('#tag-modal button[onclick="deleteTag()"]');

  if (tagNameInput) tagNameInput.disabled = false;
  if (colorInput) colorInput.disabled = false;
  if (fontColorInput) fontColorInput.disabled = false;
  if (bgSwatches) bgSwatches.style.pointerEvents = '';
  if (fgSwatches) fgSwatches.style.pointerEvents = '';
  if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.style.opacity = ''; }

  var perm = _getTagPermissionForCurrentUser(tagName);
  if (!perm) return;

  if (perm === 'view') {
    if (tagNameInput) tagNameInput.disabled = true;
    if (colorInput) colorInput.disabled = true;
    if (fontColorInput) fontColorInput.disabled = true;
    if (bgSwatches) bgSwatches.style.pointerEvents = 'none';
    if (fgSwatches) fgSwatches.style.pointerEvents = 'none';
    if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.style.opacity = '0.4'; }
  }
}

/**
 * Check if the current user has a tag_permission on a tag shared by another user.
 */
function _getTagPermissionForCurrentUser(tagName) {
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? currentUser.user_id : null;
  if (!currentUserId || !tagName) return null;

  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === tagName) {
      return null;
    }
  }

  if (window._receivedSharedTags) {
    for (var j = 0; j < window._receivedSharedTags.length; j++) {
      var entry = window._receivedSharedTags[j];
      if (entry.tag === tagName) {
        var shares = entry.shares || [];
        for (var k = 0; k < shares.length; k++) {
          if (shares[k].user_id === currentUserId) {
            return shares[k].tag_permission || 'view';
          }
        }
      }
    }
  }

  return null;
}

// ── Default Notifications (settings UI) ──────────────────────────────────────

/**
 * Render the list of default notification rows for a given type ('start' or 'due').
 */
function _renderDefaultNotifList(type, items) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">None configured.</div>';
    return;
  }
  items.forEach(function(item, idx) {
    var row = document.createElement('div');
    row.className = 'default-notif-row';
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:5px;';

    var valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.min = '1';
    valInput.value = item.value || 15;
    valInput.style.cssText = 'width:40px !important;min-width:40px !important;max-width:40px !important;flex:0 0 40px !important;padding:3px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.85em;box-sizing:border-box;text-align:center;';
    valInput.addEventListener('input', function() { setSaveButtonUnsaved(); });
    row.appendChild(valInput);

    var unitSel = document.createElement('select');
    [{v:'minutes',t:'min'},{v:'hours',t:'hr'},{v:'days',t:'day'}].forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = u.v;
      opt.textContent = u.t;
      if (u.v === (item.unit || 'minutes')) opt.selected = true;
      unitSel.appendChild(opt);
    });
    unitSel.style.cssText = 'width:auto !important;min-width:auto !important;max-width:none !important;flex:0 0 auto !important;padding:3px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.8em;';
    unitSel.addEventListener('change', function() { setSaveButtonUnsaved(); });
    row.appendChild(unitSel);

    var isAfter = !!item.afterTarget;
    var toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex;border:1px solid #8b5a2b;border-radius:4px;overflow:hidden;flex-shrink:0;cursor:pointer;font-size:0.75em;line-height:1;';
    var hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.value = isAfter ? 'true' : 'false';
    toggleWrap.appendChild(hiddenInput);

    var beforeSide = document.createElement('span');
    var afterSide = document.createElement('span');
    var activeStyle = 'padding:3px 5px;background:#8b5a2b;color:#fff8e1;font-weight:bold;';
    var inactiveStyle = 'padding:3px 5px;background:#f5e6cc;color:#bbb;';

    beforeSide.textContent = 'before';
    afterSide.textContent = 'after';

    function _updateToggle() {
      var after = hiddenInput.value === 'true';
      beforeSide.style.cssText = after ? inactiveStyle : activeStyle;
      afterSide.style.cssText = after ? activeStyle : inactiveStyle;
    }
    _updateToggle();

    toggleWrap.addEventListener('click', function() {
      hiddenInput.value = hiddenInput.value === 'true' ? 'false' : 'true';
      _updateToggle();
      setSaveButtonUnsaved();
    });
    toggleWrap.appendChild(beforeSide);
    toggleWrap.appendChild(afterSide);
    row.appendChild(toggleWrap);

    var label = document.createElement('span');
    label.textContent = type === 'start' ? 'start' : 'due';
    label.style.cssText = 'font-size:0.85em;color:#1a1208;flex-shrink:0;';
    row.appendChild(label);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove';
    removeBtn.style.cssText = 'background:#a0522d;color:#fdf5e6;border:1px solid #5c4033;border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;font-family:inherit;flex-shrink:0;margin-left:auto;';
    removeBtn.addEventListener('click', function() {
      row.remove();
      setSaveButtonUnsaved();
      if (container.children.length === 0) {
        container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">None configured.</div>';
      }
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

/**
 * Add a new default notification row for a given type.
 */
function _addDefaultNotifRow(type) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return;
  _renderDefaultNotifList(type, _gatherDefaultNotifList(type).concat([{ value: 15, unit: 'minutes', afterTarget: false }]));
  setSaveButtonUnsaved();
}

/**
 * Gather default notification rows from the DOM for a given type.
 */
function _gatherDefaultNotifList(type) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return [];
  var rows = container.querySelectorAll('.default-notif-row');
  if (rows.length === 0) {
    rows = container.querySelectorAll('div');
  }
  var result = [];
  rows.forEach(function(row) {
    var valInput = row.querySelector('input[type="number"]');
    var unitSel = row.querySelector('select');
    var hiddenInput = row.querySelector('input[type="hidden"]');
    if (!valInput || !unitSel) return;
    var val = parseInt(valInput.value);
    if (!val || val <= 0) return;
    result.push({
      value: val,
      unit: unitSel.value || 'minutes',
      afterTarget: hiddenInput ? hiddenInput.value === 'true' : false,
    });
  });
  console.debug('_gatherDefaultNotifList(' + type + '): found ' + rows.length + ' rows, gathered ' + result.length + ' items', result);
  return result;
}


/* ═══════════════════════════════════════════════════════════════════════════
   Login Message — load, preview, dirty tracking (admin only)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load the current login message and instance name into the form fields.
 */
function _loadLoginMessage() {
  var textarea = document.getElementById('login-message-input');
  var preview = document.getElementById('login-message-preview');
  var instanceInput = document.getElementById('instance-name-input');
  if (!textarea) return;

  fetch('/api/auth/login-message')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.message) {
        textarea.value = data.message;
        if (preview && typeof marked !== 'undefined') {
          preview.innerHTML = marked.parse(data.message);
        }
      }
      if (data && data.instance_name && instanceInput) {
        instanceInput.value = data.instance_name;
      }
    })
    .catch(function(e) { console.error('Failed to load login message:', e); });

  textarea.addEventListener('input', function() {
    if (preview && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(textarea.value);
    }
    setSaveButtonUnsaved();
  });

  if (instanceInput) {
    instanceInput.addEventListener('input', function() {
      setSaveButtonUnsaved();
    });
  }
}

// Login message initialization is handled by settings.js DOMContentLoaded

// ── Kiosk Tag Picker ─────────────────────────────────────────────────────────

/** Cached tree and selection state for the kiosk tag picker */
var _kioskTagTree = [];
var _kioskSelectedTags = [];

/**
 * Load all tags from settings and render the kiosk tag picker as a tree.
 */
function _loadKioskTagPicker() {
  var container = document.getElementById('kiosk-tag-list');
  if (!container) return;

  var tags = [];
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.tags) {
    tags = window.settingsManager.settings.tags;
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch (e) { tags = []; }
    }
  }
  if (!Array.isArray(tags)) tags = [];

  var userTags = tags.filter(function(t) {
    return t.name && typeof isSystemTag === 'function' && !isSystemTag(t.name);
  });

  if (userTags.length === 0) {
    container.innerHTML = '<span style="opacity:0.5;font-size:0.85em;">No tags found. Create tags in the Tag Editor above.</span>';
    return;
  }

  _kioskSelectedTags = [];
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.kiosk_users) {
    _kioskSelectedTags = window.settingsManager.settings.kiosk_users;
    if (typeof _kioskSelectedTags === 'string') {
      try { _kioskSelectedTags = JSON.parse(_kioskSelectedTags); } catch (e) { _kioskSelectedTags = []; }
    }
  }
  if (!Array.isArray(_kioskSelectedTags)) _kioskSelectedTags = [];

  _kioskTagTree = buildTagTree(userTags);
  _renderKioskTagTree();
}

/**
 * Re-render the kiosk tag tree with current selection state.
 */
function _renderKioskTagTree() {
  var container = document.getElementById('kiosk-tag-list');
  if (!container) return;

  renderTagTree(container, _kioskTagTree, _kioskSelectedTags, function(fullPath, isNowSelected) {
    if (isNowSelected) {
      if (_kioskSelectedTags.indexOf(fullPath) === -1) _kioskSelectedTags.push(fullPath);
    } else {
      _kioskSelectedTags = _kioskSelectedTags.filter(function(t) { return t !== fullPath; });
    }
    _renderKioskTagTree();
    setSaveButtonUnsaved();
  });
}

/**
 * Gather the selected kiosk tag names.
 */
function _gatherKioskTags() {
  return _kioskSelectedTags.slice();
}

/**
 * Open the kiosk with the selected tags.
 */
function _openKiosk() {
  var selected = _gatherKioskTags();
  if (selected.length === 0) {
    cwocToast('Please select at least one tag for the kiosk view.', 'error');
    return;
  }
  window.location.href = '/kiosk?tags=' + encodeURIComponent(selected.join(','));
}

// Load kiosk tag picker after settings are loaded
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function(user) {
    setTimeout(_loadKioskTagPicker, 500);
  });
}
