/**
 * shared-tag-modal.js — Shared tag creation/editing modal with full functionality.
 *
 * Provides the tag edit modal (create, rename, recolor, font color, swatches,
 * favorite, delete, sharing) as a self-contained injectable component usable
 * from both the settings page and the chit editor.
 *
 * Depends on: shared-utils.js (getCachedSettings, _invalidateSettingsCache, setSaveButtonUnsaved)
 *             shared-tags.js (isReservedTagPrefix, isSystemTag, createTagInline, loadAllTags)
 *
 * Usage:
 *   cwocTagModal.open(tagName, opts)   — open modal for existing or new tag
 *   cwocTagModal.close()               — close the modal
 *   cwocTagModal.inject()              — inject modal HTML into the page (call once at init)
 */

var cwocTagModal = (function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  var _currentTagName = null;   // Original tag name being edited (null = new tag)
  var _currentTagData = null;   // { name, color, fontColor, favorite }
  var _isNewTag = false;
  var _onSave = null;           // Callback: function(tagData, oldName)
  var _onDelete = null;         // Callback: function(tagName)
  var _onClose = null;          // Callback: function()
  var _skipPersist = false;     // If true, don't save to API (caller handles persistence)
  var _injected = false;

  // Tag sharing state
  var _tagSharingConfig = [];
  var _tagSharingUserList = null;
  var _currentTagShares = [];

  // Default tag color palette — warm parchment-themed, high contrast
  var _tagColorPalette = [
    { bg: '#8b5a2b', fg: '#fff8e1' },
    { bg: '#a0522d', fg: '#fff8e1' },
    { bg: '#4a2c2a', fg: '#fdf5e6' },
    { bg: '#6b4e31', fg: '#fff8e1' },
    { bg: '#b22222', fg: '#fff8e1' },
    { bg: '#8b0000', fg: '#fdf5e6' },
    { bg: '#2e4057', fg: '#fdf5e6' },
    { bg: '#1b4332', fg: '#e8dcc8' },
    { bg: '#5c4033', fg: '#faebd7' },
    { bg: '#d4af37', fg: '#2b1e0f' },
    { bg: '#c4a484', fg: '#2b1e0f' },
    { bg: '#e8dcc8', fg: '#4a2c2a' },
    { bg: '#d2b48c', fg: '#2b1e0f' },
    { bg: '#f5e6cc', fg: '#4a2c2a' },
    { bg: '#fff8e1', fg: '#4a2c2a' },
  ];


  // ── Modal HTML ─────────────────────────────────────────────────────────────

  var _modalHTML = `
    <div class="modal" id="cwoc-tag-modal" style="display:none;">
      <div class="modal-content" style="text-align:left;max-width:450px;">
        <h3 style="text-align:center;" id="cwoc-tag-modal-title">Edit Tag</h3>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span id="cwoc-tag-modal-fav" style="font-size:1.4em;cursor:pointer;color:#999;flex-shrink:0;" title="Favorite this Tag">☆</span>
          <input type="text" id="cwoc-tag-modal-name" placeholder="Enter tag name" style="flex:1;min-width:0;" />
        </div>

        <!-- Sharing section -->
        <div id="cwoc-tag-modal-sharing" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(139,90,43,0.3);">
          <label class="setting-subheader" style="margin-top:0;cursor:default;">🔗 Sharing</label>
          <div id="cwoc-tag-modal-share-list" style="margin-bottom:8px;"></div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <select id="cwoc-tag-modal-share-user" style="flex:1;min-width:100px;">
              <option value="">— Select User —</option>
            </select>
            <select id="cwoc-tag-modal-share-role" style="width:auto;">
              <option value="viewer">👁️ Viewer</option>
              <option value="manager">✏️ Manager</option>
            </select>
            <button type="button" id="cwoc-tag-modal-share-add" class="standard-button" style="flex-shrink:0;">➕ Share</button>
          </div>
        </div>

        <!-- Colors -->
        <label for="cwoc-tag-modal-bg-color" style="margin-top:10px;">Background Color:</label>
        <input type="color" id="cwoc-tag-modal-bg-color" value="#d4c4b0" />
        <div id="cwoc-tag-modal-bg-swatches" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;"></div>
        <label for="cwoc-tag-modal-fg-color">Font Color:</label>
        <input type="color" id="cwoc-tag-modal-fg-color" value="#5c3317" />
        <div id="cwoc-tag-modal-fg-swatches" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;"></div>
        <div id="cwoc-tag-modal-preview" style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:1em;margin:8px 0;font-family:'Lora', Georgia, serif;">Preview</div>

        <!-- Buttons -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
          <button id="cwoc-tag-modal-save-btn" class="standard-button">
            <i class="fas fa-check"></i> Done
          </button>
          <button id="cwoc-tag-modal-cancel-btn" class="standard-button">
            <i class="fas fa-times"></i> Cancel
          </button>
          <span style="flex:1;"></span>
          <button id="cwoc-tag-modal-delete-btn" class="standard-button" style="background:#a0522d;color:#fdf5e6;">
            <i class="fas fa-trash-alt"></i> Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Duplicate tag toast -->
    <div class="modal" id="cwoc-tag-modal-dup" style="display:none;">
      <div class="modal-content" style="animation:fadeOut 2s forwards;">
        <h3>Duplicate Tag</h3>
        <p>Duplicate tag not created</p>
      </div>
    </div>

    <!-- Reserved tag toast -->
    <div class="modal" id="cwoc-tag-modal-reserved" style="display:none;">
      <div class="modal-content" style="animation:fadeOut 2s forwards;">
        <h3>Reserved Tag</h3>
        <p>Tags starting with 'CWOC_System/' are reserved for system use.</p>
      </div>
    </div>
  `;


  // ── Inject ─────────────────────────────────────────────────────────────────

  function inject() {
    if (_injected) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = _modalHTML;
    document.body.appendChild(wrapper);
    _injected = true;
    _bindEvents();
  }

  // ── Event Binding ──────────────────────────────────────────────────────────

  function _bindEvents() {
    var saveBtn = document.getElementById('cwoc-tag-modal-save-btn');
    var cancelBtn = document.getElementById('cwoc-tag-modal-cancel-btn');
    var deleteBtn = document.getElementById('cwoc-tag-modal-delete-btn');
    var favStar = document.getElementById('cwoc-tag-modal-fav');
    var shareAddBtn = document.getElementById('cwoc-tag-modal-share-add');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    var nameInput = document.getElementById('cwoc-tag-modal-name');

    if (saveBtn) saveBtn.addEventListener('click', _handleSave);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (deleteBtn) deleteBtn.addEventListener('click', _handleDelete);
    if (favStar) favStar.addEventListener('click', _toggleFavorite);
    if (shareAddBtn) shareAddBtn.addEventListener('click', _addShare);

    if (bgColor) {
      bgColor.addEventListener('change', function() { _updatePreview(); _highlightBgSwatches(); });
      bgColor.addEventListener('input', _updatePreview);
    }
    if (fgColor) {
      fgColor.addEventListener('change', function() { _updatePreview(); _highlightFgSwatches(); });
      fgColor.addEventListener('input', _updatePreview);
    }
    if (nameInput) {
      nameInput.addEventListener('input', _updatePreview);
    }

    // Close on backdrop click
    var modal = document.getElementById('cwoc-tag-modal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) close();
      });
    }
  }

  // ── Open ───────────────────────────────────────────────────────────────────

  /**
   * Open the tag modal for editing or creating a tag.
   * @param {string|null} tagName — name of existing tag to edit, or null for new
   * @param {Object} opts
   *   onSave(tagData, oldName) — called after save with { name, color, fontColor, favorite }
   *   onDelete(tagName) — called after delete
   *   onClose() — called when modal closes
   *   allTags — array of all tag objects (for swatch colors); if omitted, loads from settings
   *   tagData — { color, fontColor, favorite } overrides for new tags
   */
  async function open(tagName, opts) {
    if (!_injected) inject();
    opts = opts || {};
    _onSave = opts.onSave || null;
    _onDelete = opts.onDelete || null;
    _onClose = opts.onClose || null;
    _skipPersist = !!opts.skipPersist;

    var title = document.getElementById('cwoc-tag-modal-title');
    var nameInput = document.getElementById('cwoc-tag-modal-name');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    var favStar = document.getElementById('cwoc-tag-modal-fav');
    var deleteBtn = document.getElementById('cwoc-tag-modal-delete-btn');

    // Determine if new or edit
    _isNewTag = !tagName;
    _currentTagName = tagName || null;

    // Load tag data
    var allTags = opts.allTags || [];
    if (allTags.length === 0 && typeof loadAllTags === 'function') {
      try { allTags = await loadAllTags(); } catch (e) { allTags = []; }
    }

    if (_isNewTag) {
      var td = opts.tagData || {};
      _currentTagData = {
        name: opts.prefillName || '',
        color: td.color || '#d4c4b0',
        fontColor: td.fontColor || '#5c3317',
        favorite: td.favorite || false,
      };
      if (title) title.textContent = 'Create Tag';
      if (deleteBtn) deleteBtn.style.display = 'none';
    } else {
      var existing = allTags.find(function(t) { return t.name === tagName; });
      _currentTagData = {
        name: tagName,
        color: (existing && existing.color) || '#d4c4b0',
        fontColor: (existing && existing.fontColor) || '#5c3317',
        favorite: (existing && existing.favorite) || false,
      };
      if (title) title.textContent = 'Edit Tag';
      if (deleteBtn) deleteBtn.style.display = '';
    }

    // Populate fields
    if (nameInput) nameInput.value = _currentTagData.name;
    if (bgColor) bgColor.value = _currentTagData.color;
    if (fgColor) fgColor.value = _currentTagData.fontColor;
    if (favStar) {
      favStar.textContent = _currentTagData.favorite ? '★' : '☆';
      favStar.style.color = _currentTagData.favorite ? '#DAA520' : '#999';
      favStar.title = _currentTagData.favorite ? 'Unfavorite this Tag' : 'Favorite this Tag';
    }

    // Build swatches
    _buildBgSwatches(allTags);
    _buildFgSwatches();
    _updatePreview();

    // Sharing
    await _initSharing(_currentTagData.name);

    // Show modal
    var modal = document.getElementById('cwoc-tag-modal');
    if (modal) modal.style.display = 'flex';
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  function close() {
    var modal = document.getElementById('cwoc-tag-modal');
    if (modal) modal.style.display = 'none';
    _currentTagName = null;
    _currentTagData = null;
    _currentTagShares = [];
    if (_onClose) _onClose();
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function _handleSave() {
    var nameInput = document.getElementById('cwoc-tag-modal-name');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    var favStar = document.getElementById('cwoc-tag-modal-fav');

    var newName = (nameInput ? nameInput.value.trim() : '');
    if (!newName) {
      alert('Tag name cannot be empty.');
      return;
    }

    // Block reserved prefix
    if (isReservedTagPrefix(newName)) {
      var reservedModal = document.getElementById('cwoc-tag-modal-reserved');
      if (reservedModal) {
        reservedModal.style.display = 'flex';
        setTimeout(function() { reservedModal.style.display = 'none'; }, 2000);
      }
      return;
    }

    // Check for duplicates (excluding current tag being edited)
    var settings = null;
    try { settings = await getCachedSettings(); } catch (e) { settings = {}; }
    var existingTags = Array.isArray(settings.tags) ? settings.tags : [];
    var isDuplicate = existingTags.some(function(t) {
      var tName = (typeof t === 'string') ? t : (t.name || '');
      if (_currentTagName && tName.toLowerCase() === _currentTagName.toLowerCase()) return false;
      return tName.toLowerCase() === newName.toLowerCase();
    });

    if (isDuplicate) {
      var dupModal = document.getElementById('cwoc-tag-modal-dup');
      if (dupModal) {
        dupModal.style.display = 'flex';
        setTimeout(function() { dupModal.style.display = 'none'; }, 2000);
      }
      return;
    }

    var tagData = {
      name: newName,
      color: bgColor ? bgColor.value : '#d4c4b0',
      fontColor: fgColor ? fgColor.value : '#5c3317',
      favorite: favStar ? (favStar.textContent === '★') : false,
    };

    // Persist to settings (unless caller handles persistence)
    if (!_skipPersist) {
      await _persistTag(tagData, _currentTagName);
    }

    // Save sharing config (unless caller handles persistence)
    if (!_skipPersist) {
      await _saveSharingConfig(tagData.name, _currentTagName);
    }

    // Callback
    if (_onSave) _onSave(tagData, _currentTagName);

    close();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function _handleDelete() {
    if (!_currentTagName) { close(); return; }

    // Confirm
    var confirmed = false;
    if (typeof cwocConfirm === 'function') {
      confirmed = await cwocConfirm('Delete tag "' + _currentTagName + '"? This removes it globally from all chits.', {
        title: 'Delete Tag',
        confirmLabel: 'Delete',
        danger: true,
      });
    } else {
      confirmed = confirm('Delete tag "' + _currentTagName + '"? This removes it globally.');
    }
    if (!confirmed) return;

    // Remove from settings (unless caller handles persistence)
    if (!_skipPersist) {
      await _deleteTagFromSettings(_currentTagName);
      await _deleteSharingConfig(_currentTagName);
    }

    if (_onDelete) _onDelete(_currentTagName);
    close();
  }

  // ── Favorite Toggle ────────────────────────────────────────────────────────

  function _toggleFavorite() {
    var star = document.getElementById('cwoc-tag-modal-fav');
    if (!star) return;
    var isFav = star.textContent === '★';
    star.textContent = isFav ? '☆' : '★';
    star.style.color = isFav ? '#999' : '#DAA520';
    star.title = isFav ? 'Favorite this Tag' : 'Unfavorite this Tag';
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  function _updatePreview() {
    var preview = document.getElementById('cwoc-tag-modal-preview');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    var nameInput = document.getElementById('cwoc-tag-modal-name');
    if (preview) {
      preview.style.backgroundColor = bgColor ? bgColor.value : '#d4c4b0';
      preview.style.color = fgColor ? fgColor.value : '#5c3317';
      preview.textContent = (nameInput && nameInput.value.trim()) || 'Preview';
    }
  }

  // ── Swatches ───────────────────────────────────────────────────────────────

  function _buildBgSwatches(allTags) {
    var container = document.getElementById('cwoc-tag-modal-bg-swatches');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    if (!container) return;
    container.innerHTML = '';
    var seen = new Set();

    // Palette colors
    _tagColorPalette.forEach(function(c) {
      if (seen.has(c.bg)) return;
      seen.add(c.bg);
      var s = document.createElement('span');
      s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;';
      s.style.backgroundColor = c.bg;
      s.title = c.bg;
      if (bgColor && c.bg === bgColor.value) s.style.borderColor = '#4a2c2a';
      s.addEventListener('click', function() {
        if (bgColor) bgColor.value = c.bg;
        if (fgColor) fgColor.value = c.fg;
        _updatePreview();
        _highlightBgSwatches();
        _highlightFgSwatches();
      });
      container.appendChild(s);
    });

    // Existing tag colors
    if (allTags && allTags.length) {
      allTags.forEach(function(t) {
        var c = t.color;
        if (c && !seen.has(c)) {
          seen.add(c);
          var s = document.createElement('span');
          s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;';
          s.style.backgroundColor = c;
          s.title = c;
          if (bgColor && c === bgColor.value) s.style.borderColor = '#4a2c2a';
          s.addEventListener('click', function() {
            if (bgColor) bgColor.value = c;
            _updatePreview();
            _highlightBgSwatches();
          });
          container.appendChild(s);
        }
      });
    }
  }

  function _buildFgSwatches() {
    var container = document.getElementById('cwoc-tag-modal-fg-swatches');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    if (!container) return;
    container.innerHTML = '';
    var fgColors = ['#2b1e0f', '#4a2c2a', '#fff8e1', '#fdf5e6', '#faebd7', '#e8dcc8', '#000000', '#ffffff'];
    fgColors.forEach(function(c) {
      var s = document.createElement('span');
      var lightColors = ['#ffffff', '#fff8e1', '#fdf5e6', '#faebd7', '#e8dcc8'];
      s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid ' +
        (lightColors.includes(c) ? '#8b5a2b' : 'transparent') + ';display:inline-block;';
      s.style.backgroundColor = c;
      s.title = c;
      if (fgColor && c === fgColor.value) s.style.borderColor = '#4a2c2a';
      s.addEventListener('click', function() {
        if (fgColor) fgColor.value = c;
        _updatePreview();
        _highlightFgSwatches();
      });
      container.appendChild(s);
    });
  }

  function _highlightBgSwatches() {
    var container = document.getElementById('cwoc-tag-modal-bg-swatches');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    if (!container || !bgColor) return;
    container.querySelectorAll('span').forEach(function(s) {
      s.style.borderColor = s.title === bgColor.value ? '#4a2c2a' : 'transparent';
    });
  }

  function _highlightFgSwatches() {
    var container = document.getElementById('cwoc-tag-modal-fg-swatches');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    if (!container || !fgColor) return;
    var lightColors = ['#ffffff', '#fff8e1', '#fdf5e6', '#faebd7', '#e8dcc8'];
    container.querySelectorAll('span').forEach(function(s) {
      s.style.borderColor = s.title === fgColor.value ? '#4a2c2a' :
        (lightColors.includes(s.title) ? '#8b5a2b' : 'transparent');
    });
  }


  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Save or update a tag in settings.
   * @param {Object} tagData — { name, color, fontColor, favorite }
   * @param {string|null} oldName — previous name if renaming, null if new
   */
  async function _persistTag(tagData, oldName) {
    try {
      _invalidateSettingsCache();
      var settings = await getCachedSettings();
      var tags = Array.isArray(settings.tags) ? settings.tags : [];

      if (oldName) {
        // Update existing
        var found = false;
        for (var i = 0; i < tags.length; i++) {
          var tName = (typeof tags[i] === 'string') ? tags[i] : (tags[i].name || '');
          if (tName.toLowerCase() === oldName.toLowerCase()) {
            tags[i] = { name: tagData.name, color: tagData.color, fontColor: tagData.fontColor, favorite: tagData.favorite };
            found = true;

            // If renamed, also rename sub-tags
            if (oldName !== tagData.name) {
              var prefix = oldName + '/';
              for (var j = 0; j < tags.length; j++) {
                var subName = (typeof tags[j] === 'string') ? tags[j] : (tags[j].name || '');
                if (subName.startsWith(prefix)) {
                  var newSubName = tagData.name + '/' + subName.substring(prefix.length);
                  if (typeof tags[j] === 'string') {
                    tags[j] = newSubName;
                  } else {
                    tags[j].name = newSubName;
                  }
                }
              }
            }
            break;
          }
        }
        if (!found) {
          tags.push({ name: tagData.name, color: tagData.color, fontColor: tagData.fontColor, favorite: tagData.favorite });
        }
      } else {
        // New tag
        tags.push({ name: tagData.name, color: tagData.color, fontColor: tagData.fontColor, favorite: tagData.favorite });
      }

      settings.tags = tags;
      var resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) {
        console.error('cwocTagModal: failed to save tag', resp.status);
      }
      _invalidateSettingsCache();
    } catch (e) {
      console.error('cwocTagModal: _persistTag error:', e);
    }
  }

  /**
   * Delete a tag from settings (and all its sub-tags).
   */
  async function _deleteTagFromSettings(tagName) {
    try {
      _invalidateSettingsCache();
      var settings = await getCachedSettings();
      var tags = Array.isArray(settings.tags) ? settings.tags : [];
      var prefix = tagName + '/';
      tags = tags.filter(function(t) {
        var tName = (typeof t === 'string') ? t : (t.name || '');
        return tName !== tagName && !tName.startsWith(prefix);
      });
      settings.tags = tags;
      var resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) {
        console.error('cwocTagModal: failed to delete tag', resp.status);
      }
      _invalidateSettingsCache();
    } catch (e) {
      console.error('cwocTagModal: _deleteTagFromSettings error:', e);
    }
  }

  // ── Sharing ────────────────────────────────────────────────────────────────

  async function _loadSharingConfig() {
    try {
      var response = await fetch('/api/settings/shared-tags');
      if (!response.ok) {
        _tagSharingConfig = [];
        return;
      }
      var data = await response.json();
      _tagSharingConfig = Array.isArray(data.shared_tags) ? data.shared_tags : [];
    } catch (err) {
      console.error('[cwocTagModal] Error loading shared tags:', err);
      _tagSharingConfig = [];
    }
  }

  async function _loadSharingUserList() {
    if (_tagSharingUserList !== null) return;
    try {
      var response = await fetch('/api/auth/switchable-users');
      if (!response.ok) {
        _tagSharingUserList = [];
        return;
      }
      _tagSharingUserList = await response.json();
    } catch (err) {
      console.error('[cwocTagModal] Error loading user list:', err);
      _tagSharingUserList = [];
    }
  }

  function _getSharesForTag(tagName) {
    if (!tagName || !_tagSharingConfig) return [];
    for (var i = 0; i < _tagSharingConfig.length; i++) {
      if (_tagSharingConfig[i].tag === tagName) {
        return _tagSharingConfig[i].shares || [];
      }
    }
    return [];
  }

  async function _initSharing(tagName) {
    await _loadSharingConfig();
    await _loadSharingUserList();

    _currentTagShares = _getSharesForTag(tagName).map(function(s) {
      return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view', display_name: s.display_name || '' };
    });

    _populateUserPicker();
    _renderSharesList();
  }

  function _populateUserPicker() {
    var picker = document.getElementById('cwoc-tag-modal-share-user');
    if (!picker || !_tagSharingUserList) return;

    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var currentUserId = currentUser ? currentUser.user_id : null;

    var sharedIds = new Set();
    _currentTagShares.forEach(function(s) { sharedIds.add(s.user_id); });

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

  function _renderSharesList() {
    var container = document.getElementById('cwoc-tag-modal-share-list');
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
      nameSpan.textContent = _getUserName(share.user_id);
      row.appendChild(nameSpan);

      var badge = document.createElement('span');
      badge.className = 'tag-share-role tag-share-role-' + share.role;
      badge.textContent = share.role === 'manager' ? '✏️ Manager' : '👁️ Viewer';
      row.appendChild(badge);

      // Permission toggle
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
          _renderSharesList();
        };
      })(share.user_id));
      row.appendChild(permToggle);

      // Remove button
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-share-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove share';
      removeBtn.addEventListener('click', (function(uid) {
        return function() {
          _currentTagShares = _currentTagShares.filter(function(s) { return s.user_id !== uid; });
          _renderSharesList();
          _populateUserPicker();
        };
      })(share.user_id));
      row.appendChild(removeBtn);

      container.appendChild(row);
    });
  }

  function _getUserName(userId) {
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

  function _addShare() {
    var picker = document.getElementById('cwoc-tag-modal-share-user');
    var roleSelect = document.getElementById('cwoc-tag-modal-share-role');
    if (!picker || !roleSelect) return;

    var userId = picker.value;
    var role = roleSelect.value;
    if (!userId) { alert('Please select a user to share with.'); return; }

    for (var i = 0; i < _currentTagShares.length; i++) {
      if (_currentTagShares[i].user_id === userId) {
        alert('This user already has access to this tag.');
        return;
      }
    }

    _currentTagShares.push({ user_id: userId, role: role, tag_permission: 'view' });
    _renderSharesList();
    _populateUserPicker();
  }

  async function _saveSharingConfig(newName, oldName) {
    // Update config if tag was renamed
    if (oldName && oldName !== newName) {
      for (var i = 0; i < _tagSharingConfig.length; i++) {
        if (_tagSharingConfig[i].tag === oldName) {
          _tagSharingConfig[i].tag = newName;
          break;
        }
      }
      // Also rename sub-tag sharing entries
      var prefix = oldName + '/';
      for (var j = 0; j < _tagSharingConfig.length; j++) {
        if (_tagSharingConfig[j].tag.startsWith(prefix)) {
          _tagSharingConfig[j].tag = newName + '/' + _tagSharingConfig[j].tag.substring(prefix.length);
        }
      }
    }

    // Update the entry for this tag
    var found = false;
    for (var k = 0; k < _tagSharingConfig.length; k++) {
      if (_tagSharingConfig[k].tag === newName) {
        if (_currentTagShares.length === 0) {
          _tagSharingConfig.splice(k, 1);
        } else {
          _tagSharingConfig[k].shares = _currentTagShares.map(function(s) {
            return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
          });
        }
        found = true;
        break;
      }
    }
    if (!found && _currentTagShares.length > 0) {
      _tagSharingConfig.push({
        tag: newName,
        shares: _currentTagShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        }),
      });
    }

    // Propagate to sub-tags
    _propagateToSubTags(newName);

    // Save to server
    try {
      var response = await fetch('/api/settings/shared-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_tags: _tagSharingConfig }),
      });
      if (!response.ok) {
        console.error('[cwocTagModal] Failed to save shared tags:', response.status);
      }
    } catch (err) {
      console.error('[cwocTagModal] Error saving shared tags:', err);
    }
  }

  async function _deleteSharingConfig(tagName) {
    var prefix = tagName + '/';
    _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
      return entry.tag !== tagName && !entry.tag.startsWith(prefix);
    });

    try {
      await fetch('/api/settings/shared-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_tags: _tagSharingConfig }),
      });
    } catch (err) {
      console.error('[cwocTagModal] Error deleting shared tags:', err);
    }
  }

  function _propagateToSubTags(parentTag) {
    if (!parentTag) return;
    var parentShares = null;
    for (var i = 0; i < _tagSharingConfig.length; i++) {
      if (_tagSharingConfig[i].tag === parentTag) {
        parentShares = _tagSharingConfig[i].shares;
        break;
      }
    }

    // Get all tag names from settings cache
    var settings = window._cwocSettings || {};
    var allTags = Array.isArray(settings.tags) ? settings.tags : [];
    var prefix = parentTag + '/';

    allTags.forEach(function(t) {
      var tName = (typeof t === 'string') ? t : (t.name || '');
      if (!tName.startsWith(prefix)) return;

      if (parentShares && parentShares.length > 0) {
        var subShares = parentShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        });
        var found = false;
        for (var j = 0; j < _tagSharingConfig.length; j++) {
          if (_tagSharingConfig[j].tag === tName) {
            _tagSharingConfig[j].shares = subShares;
            found = true;
            break;
          }
        }
        if (!found) {
          _tagSharingConfig.push({ tag: tName, shares: subShares });
        }
      } else {
        _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
          return entry.tag !== tName;
        });
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    inject: inject,
    open: open,
    close: close,
    isOpen: function() {
      var modal = document.getElementById('cwoc-tag-modal');
      return modal && modal.style.display === 'flex';
    },
  };

})();

// Auto-inject the modal HTML when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { cwocTagModal.inject(); });
} else {
  cwocTagModal.inject();
}
