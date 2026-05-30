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
  var _editingTagId = null;     // Tag_ID (UUID) of the tag being edited (null = new tag)
  var _currentTagData = null;   // { name, color, fontColor, favorite }
  var _isNewTag = false;
  var _onSave = null;           // Callback: function(tagData, oldName)
  var _onDelete = null;         // Callback: function(tagName)
  var _onClose = null;          // Callback: function()
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

  // Also include the shared default palette colors (with auto-contrast fg)
  // so tags can use any color from the unified bank
  (typeof _cwocDefaultColors !== 'undefined' ? _cwocDefaultColors : []).forEach(function(c) {
    var alreadyInPalette = _tagColorPalette.some(function(p) { return p.bg.toLowerCase() === c.hex.toLowerCase(); });
    if (!alreadyInPalette) {
      var fg = (typeof contrastColorForBg === 'function') ? contrastColorForBg(c.hex) : '#2b1e0f';
      _tagColorPalette.push({ bg: c.hex, fg: fg });
    }
  });


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
   *   tagId — Tag_ID (UUID) of the tag to edit (preferred over tagName for lookup)
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

    var title = document.getElementById('cwoc-tag-modal-title');
    var nameInput = document.getElementById('cwoc-tag-modal-name');
    var bgColor = document.getElementById('cwoc-tag-modal-bg-color');
    var fgColor = document.getElementById('cwoc-tag-modal-fg-color');
    var favStar = document.getElementById('cwoc-tag-modal-fav');
    var deleteBtn = document.getElementById('cwoc-tag-modal-delete-btn');

    // Determine if new or edit
    _isNewTag = !tagName && !opts.tagId;
    _currentTagName = tagName || null;
    _editingTagId = opts.tagId || null;

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
      // Look up by ID first (preferred), fall back to name
      var existing = null;
      if (_editingTagId) {
        existing = allTags.find(function(t) { return t.id === _editingTagId; });
      }
      if (!existing && tagName) {
        existing = allTags.find(function(t) { return t.name === tagName; });
      }
      // If we found the tag, capture its ID
      if (existing && existing.id) {
        _editingTagId = existing.id;
      }
      _currentTagName = (existing && existing.name) || tagName;
      _currentTagData = {
        name: _currentTagName,
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
    await _initSharing(_editingTagId, _currentTagData.name);

    // Show modal
    var modal = document.getElementById('cwoc-tag-modal');
    if (modal) modal.style.display = 'flex';
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  function close() {
    var modal = document.getElementById('cwoc-tag-modal');
    if (modal) modal.style.display = 'none';
    _currentTagName = null;
    _editingTagId = null;
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
      cwocToast('Tag name cannot be empty.', 'error');
      return;
    }

    // Block reserved prefix
    if (isReservedTagPrefix(newName)) {
      cwocToast('Reserved tag prefix.', 'error');
      return;
    }

    // Invalidate cache to get fresh data for duplicate check
    _invalidateSettingsCache();
    var settings = null;
    try { settings = await getCachedSettings(); } catch (e) { settings = {}; }
    var existingTags = Array.isArray(settings.tags) ? settings.tags : [];
    var isDuplicate = existingTags.some(function(t) {
      var tName = (typeof t === 'string') ? t : (t.name || '');
      // Skip the tag we're currently editing (identified by ID)
      if (_editingTagId && t.id === _editingTagId) return false;
      // Fallback: skip by name if no ID match
      if (!_editingTagId && _currentTagName && tName.toLowerCase() === _currentTagName.toLowerCase()) return false;
      return tName.toLowerCase() === newName.toLowerCase();
    });

    if (isDuplicate) {
      cwocToast('A tag with that name already exists.', 'info');
      return;
    }

    var tagData = {
      name: newName,
      color: bgColor ? bgColor.value : '#d4c4b0',
      fontColor: fgColor ? fgColor.value : '#5c3317',
      favorite: favStar ? (favStar.textContent === '★') : false,
    };

    // Persist to settings
    var saved = await _persistTag(tagData);
    if (!saved) {
      cwocToast('Failed to save tag. Please try again.', 'error');
      return;
    }

    // Save sharing config (by tag ID for existing tags)
    await _saveSharingConfig(_editingTagId, tagData.name);

    // Callback
    if (_onSave) _onSave(tagData, _currentTagName);

    close();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function _handleDelete() {
    if (!_editingTagId && !_currentTagName) { close(); return; }

    var displayName = _currentTagName || 'this tag';

    // Confirm
    var confirmed = false;
    if (typeof cwocConfirm === 'function') {
      confirmed = await cwocConfirm('Delete tag "' + displayName + '"? This removes it globally from all chits.', {
        title: 'Delete Tag',
        confirmLabel: 'Delete',
        danger: true,
      });
    } else {
      confirmed = false; // cwocConfirm should always be available
    }
    if (!confirmed) return;

    // Remove from settings by ID
    await _deleteTagFromSettings(_editingTagId);
    await _deleteSharingConfig(_editingTagId);

    if (_onDelete) _onDelete(_editingTagId || _currentTagName);
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
    container.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:8px 0;';
    var seen = new Set();

    // Helper: make a section label
    function makeLabel(text) {
      var label = document.createElement('div');
      label.style.cssText = 'font-size:0.7em;text-transform:uppercase;letter-spacing:0.5px;color:#8b5a2b;font-weight:600;opacity:0.8;margin-top:4px;';
      label.textContent = text;
      return label;
    }

    // Helper: make a swatch row
    function makeRow() {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      return row;
    }

    // ── Default palette section ──
    container.appendChild(makeLabel('Default'));
    var defaultRow = makeRow();
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
      defaultRow.appendChild(s);
    });
    container.appendChild(defaultRow);

    // ── Custom colors from settings ──
    var customColors = (window._cwocSettings || {}).custom_colors;
    var hasCustom = false;
    var customRow = makeRow();
    if (Array.isArray(customColors)) {
      customColors.forEach(function(c) {
        var hex = (typeof c === 'string') ? c : (c.hex || '');
        if (hex && !seen.has(hex) && !seen.has(hex.toLowerCase())) {
          seen.add(hex.toLowerCase());
          hasCustom = true;
          var fg = (typeof contrastColorForBg === 'function') ? contrastColorForBg(hex) : '#2b1e0f';
          var s = document.createElement('span');
          s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;';
          s.style.backgroundColor = hex;
          s.title = hex;
          if (bgColor && hex.toLowerCase() === bgColor.value.toLowerCase()) s.style.borderColor = '#4a2c2a';
          s.addEventListener('click', function() {
            if (bgColor) bgColor.value = hex;
            if (fgColor) fgColor.value = fg;
            _updatePreview();
            _highlightBgSwatches();
            _highlightFgSwatches();
          });
          customRow.appendChild(s);
        }
      });
    }
    if (hasCustom) {
      container.appendChild(makeLabel('Custom'));
      container.appendChild(customRow);
    }

    // ── Existing tag colors (from other tags) ──
    var hasTagColors = false;
    var tagRow = makeRow();
    if (allTags && allTags.length) {
      allTags.forEach(function(t) {
        var c = t.color;
        if (c && !seen.has(c) && !seen.has(c.toLowerCase())) {
          seen.add(c.toLowerCase());
          hasTagColors = true;
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
          tagRow.appendChild(s);
        }
      });
    }
    if (hasTagColors) {
      container.appendChild(makeLabel('From Tags'));
      container.appendChild(tagRow);
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
  // Uses the shared functions from shared-tags.js: createTagInline, updateTagInline, deleteTagInline

  /**
   * Save or update a tag in settings via shared-tags.js functions.
   * For edits: calls updateTagInline(tagId, tagData) with the Tag_ID.
   * For creates: calls createTagInline(name, opts) which returns the new UUID.
   * @returns {Promise<boolean>} true if saved successfully
   */
  async function _persistTag(tagData) {
    try {
      if (_editingTagId) {
        // Editing existing tag — identify by ID
        return await updateTagInline(_editingTagId, tagData);
      } else {
        // Creating new tag — send name, backend assigns UUID
        var newId = await createTagInline(tagData.name, { color: tagData.color, fontColor: tagData.fontColor, favorite: tagData.favorite });
        if (newId) {
          _editingTagId = newId; // Capture the new ID for sharing config
          return true;
        }
        return false;
      }
    } catch (e) {
      console.error('[cwocTagModal] _persistTag failed:', e);
      return false;
    }
  }

  /**
   * Delete a tag from settings via shared-tags.js deleteTagInline.
   * @param {string} tagId — Tag_ID (UUID) to delete
   */
  async function _deleteTagFromSettings(tagId) {
    if (!tagId) return;
    await deleteTagInline(tagId);
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

  function _getSharesForTag(tagId, tagName) {
    if (!_tagSharingConfig) return [];
    // Look up by tag_id first (new format)
    if (tagId) {
      for (var i = 0; i < _tagSharingConfig.length; i++) {
        if (_tagSharingConfig[i].tag === tagId || _tagSharingConfig[i].tag_id === tagId) {
          return _tagSharingConfig[i].shares || [];
        }
      }
    }
    // Fallback: look up by name (legacy format)
    if (tagName) {
      for (var j = 0; j < _tagSharingConfig.length; j++) {
        if (_tagSharingConfig[j].tag === tagName) {
          return _tagSharingConfig[j].shares || [];
        }
      }
    }
    return [];
  }

  async function _initSharing(tagId, tagName) {
    await _loadSharingConfig();
    await _loadSharingUserList();

    _currentTagShares = _getSharesForTag(tagId, tagName).map(function(s) {
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
    if (!userId) { cwocToast('Please select a user to share with.', 'error'); return; }

    for (var i = 0; i < _currentTagShares.length; i++) {
      if (_currentTagShares[i].user_id === userId) {
        cwocToast('This user already has access to this tag.', 'error');
        return;
      }
    }

    _currentTagShares.push({ user_id: userId, role: role, tag_permission: 'view' });
    _renderSharesList();
    _populateUserPicker();
  }

  async function _saveSharingConfig(tagId, tagName) {
    // Use tag_id as the identifier in sharing config
    var identifier = tagId || tagName;
    if (!identifier) return;

    // Update the entry for this tag (by tag_id)
    var found = false;
    for (var k = 0; k < _tagSharingConfig.length; k++) {
      var entry = _tagSharingConfig[k];
      if (entry.tag === identifier || entry.tag_id === identifier) {
        if (_currentTagShares.length === 0) {
          _tagSharingConfig.splice(k, 1);
        } else {
          // Store tag_id as the identifier
          _tagSharingConfig[k].tag = tagId || tagName;
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
        tag: tagId || tagName,
        shares: _currentTagShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        }),
      });
    }

    // Propagate to sub-tags (by ID)
    _propagateToSubTags(tagId, tagName);

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

  async function _deleteSharingConfig(tagId) {
    if (!tagId) return;

    // Remove entries matching this tag_id
    // Also remove child tags — look up the tag name to find children
    var tagName = '';
    if (typeof getTagById === 'function') {
      var tagObj = getTagById(tagId);
      if (tagObj) tagName = tagObj.name;
    }

    _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
      // Remove exact match by ID
      if (entry.tag === tagId || entry.tag_id === tagId) return false;
      // Remove child tags by name prefix (if we know the name)
      if (tagName) {
        var prefix = tagName + '/';
        // Check if entry references a child by name (legacy) or by ID of a child
        if (entry.tag === tagName) return false;
        if (typeof entry.tag === 'string' && entry.tag.startsWith(prefix)) return false;
      }
      return true;
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

  function _propagateToSubTags(tagId, tagName) {
    if (!tagId && !tagName) return;

    // Find the parent shares
    var parentShares = null;
    for (var i = 0; i < _tagSharingConfig.length; i++) {
      if (_tagSharingConfig[i].tag === tagId || _tagSharingConfig[i].tag === tagName) {
        parentShares = _tagSharingConfig[i].shares;
        break;
      }
    }

    // Resolve the tag name for prefix matching
    var resolvedName = tagName;
    if (!resolvedName && tagId && typeof getTagById === 'function') {
      var tagObj = getTagById(tagId);
      if (tagObj) resolvedName = tagObj.name;
    }
    if (!resolvedName) return;

    // Get all tag objects from settings cache
    var settings = window._cwocSettings || {};
    var allTags = Array.isArray(settings.tags) ? settings.tags : [];
    var prefix = resolvedName + '/';

    allTags.forEach(function(t) {
      var tName = (typeof t === 'string') ? t : (t.name || '');
      var tId = (typeof t === 'object') ? t.id : null;
      if (!tName.startsWith(prefix)) return;

      // Use the child's tag_id as the identifier
      var childIdentifier = tId || tName;

      if (parentShares && parentShares.length > 0) {
        var subShares = parentShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        });
        var found = false;
        for (var j = 0; j < _tagSharingConfig.length; j++) {
          if (_tagSharingConfig[j].tag === childIdentifier) {
            _tagSharingConfig[j].shares = subShares;
            found = true;
            break;
          }
        }
        if (!found) {
          _tagSharingConfig.push({ tag: childIdentifier, shares: subShares });
        }
      } else {
        _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
          return entry.tag !== childIdentifier;
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
