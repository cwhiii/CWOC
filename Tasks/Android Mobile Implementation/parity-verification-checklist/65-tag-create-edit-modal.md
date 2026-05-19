# Tag Create/Edit Modal

**Category:** Modals & Overlays
**Item #:** 65
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Public API (shared-tag-modal.js — cwocTagModal IIFE)
- [ ] cwocTagModal.open(tagName, opts) — Opens modal for editing (tagName) or creating (null); loads tag data, builds swatches, initializes sharing
- [ ] cwocTagModal.close() — Closes the modal, clears state, calls onClose callback
- [ ] cwocTagModal.inject() — Injects modal HTML into the page DOM (called once at init, auto-injected on DOMContentLoaded)
- [ ] cwocTagModal.isOpen() — Returns true if the modal is currently visible

### Modal Fields & Inputs
- [ ] Tag name input (#cwoc-tag-modal-name) — Text input for tag name; placeholder "Enter tag name"
- [ ] Favorite star toggle (#cwoc-tag-modal-fav) — Click toggles between ☆ (unfavorited, #999) and ★ (favorited, #DAA520)
- [ ] Background color picker (#cwoc-tag-modal-bg-color) — Native color input, default #d4c4b0
- [ ] Background color swatches (#cwoc-tag-modal-bg-swatches) — Circular color dots from palette + existing tag colors; click sets both bg and fg
- [ ] Font color picker (#cwoc-tag-modal-fg-color) — Native color input, default #5c3317
- [ ] Font color swatches (#cwoc-tag-modal-fg-swatches) — Circular color dots for text colors; click sets fg only
- [ ] Live preview (#cwoc-tag-modal-preview) — Shows tag name with current bg/fg colors applied in real-time

### Sharing Section (#cwoc-tag-modal-sharing)
- [ ] Share list (#cwoc-tag-modal-share-list) — Displays current shares with user name, role badge, permission toggle, remove button
- [ ] User picker dropdown (#cwoc-tag-modal-share-user) — Select from available users (excludes current user and already-shared users)
- [ ] Role dropdown (#cwoc-tag-modal-share-role) — "👁️ Viewer" or "✏️ Manager"
- [ ] "➕ Share" button (#cwoc-tag-modal-share-add) — Adds selected user with selected role to shares list
- [ ] Permission toggle button per share — Toggles between "👁️ View" and "🔧 Manage" tag permission
- [ ] Remove button (✕) per share — Removes user from shares list

### Action Buttons
- [ ] "✓ Done" button (#cwoc-tag-modal-save-btn) — Validates, persists tag, saves sharing config, calls onSave callback
- [ ] "✕ Cancel" button (#cwoc-tag-modal-cancel-btn) — Closes modal without saving
- [ ] "🗑️ Delete" button (#cwoc-tag-modal-delete-btn) — Confirms deletion, removes tag from settings, deletes sharing config, calls onDelete callback; hidden for new tags

### Internal Functions
- [ ] _bindEvents — Attaches all event listeners (save, cancel, delete, favorite, share add, color changes, name input, backdrop click)
- [ ] _handleSave — Validates name (non-empty, not reserved prefix, not duplicate), persists tag, saves sharing, calls callback
- [ ] _handleDelete — Confirms via cwocConfirm, deletes from settings and sharing config, calls callback
- [ ] _toggleFavorite — Toggles star between ☆ and ★ with color change
- [ ] _updatePreview — Updates preview element with current bg color, fg color, and name text
- [ ] _buildBgSwatches(allTags) — Builds background color swatch circles from palette + existing tag colors
- [ ] _buildFgSwatches — Builds font color swatch circles (8 predefined colors)
- [ ] _highlightBgSwatches — Highlights the swatch matching current bg color value
- [ ] _highlightFgSwatches — Highlights the swatch matching current fg color value
- [ ] _persistTag(tagData, oldName) — Calls updateTagInline (edit) or createTagInline (new) from shared-tags.js
- [ ] _deleteTagFromSettings(tagName) — Calls deleteTagInline from shared-tags.js

### Sharing Functions
- [ ] _loadSharingConfig — Fetches /api/settings/shared-tags
- [ ] _loadSharingUserList — Fetches /api/auth/switchable-users
- [ ] _getSharesForTag(tagName) — Finds shares for a specific tag in the config
- [ ] _initSharing(tagName) — Loads config + user list, populates picker, renders shares list
- [ ] _populateUserPicker — Fills user dropdown (excludes current user and already-shared)
- [ ] _renderSharesList — Renders share items with name, role badge, permission toggle, remove button
- [ ] _getUserName(userId) — Resolves user ID to display name
- [ ] _addShare — Validates and adds new share to _currentTagShares
- [ ] _saveSharingConfig(newName, oldName) — Saves sharing config to server; handles renames and sub-tag propagation
- [ ] _deleteSharingConfig(tagName) — Removes sharing config for tag and all sub-tags
- [ ] _propagateToSubTags(parentTag) — Propagates parent tag's shares to all child tags

### Color Palette (15 preset combinations)
- [ ] #8b5a2b / #fff8e1 (dark brown / cream)
- [ ] #a0522d / #fff8e1 (sienna / cream)
- [ ] #4a2c2a / #fdf5e6 (dark maroon / old lace)
- [ ] #6b4e31 / #fff8e1 (medium brown / cream)
- [ ] #b22222 / #fff8e1 (firebrick / cream)
- [ ] #8b0000 / #fdf5e6 (dark red / old lace)
- [ ] #2e4057 / #fdf5e6 (dark blue / old lace)
- [ ] #1b4332 / #e8dcc8 (dark green / tan)
- [ ] #5c4033 / #faebd7 (dark brown / antique white)
- [ ] #d4af37 / #2b1e0f (gold / very dark brown)
- [ ] #c4a484 / #2b1e0f (tan / very dark brown)
- [ ] #e8dcc8 / #4a2c2a (light tan / dark maroon)
- [ ] #d2b48c / #2b1e0f (tan / very dark brown)
- [ ] #f5e6cc / #4a2c2a (cream / dark maroon)
- [ ] #fff8e1 / #4a2c2a (light cream / dark maroon)

### Font Color Swatches (8 options)
- [ ] #2b1e0f, #4a2c2a, #fff8e1, #fdf5e6, #faebd7, #e8dcc8, #000000, #ffffff

### Validation Rules
- [ ] Name cannot be empty
- [ ] Name cannot use reserved tag prefix (isReservedTagPrefix check)
- [ ] Name cannot duplicate existing tag (case-insensitive, excluding self when editing)

### Modal Interactions
- [ ] ESC key — Closes modal (handled by page-level ESC handler checking cwocTagModal.isOpen())
- [ ] Click backdrop — Closes modal (click on .modal element outside .modal-content)
- [ ] Enter key — Triggers save (handled by page-level Enter handler)

### State Variables
- [ ] _currentTagName — Original tag name being edited (null for new)
- [ ] _currentTagData — {name, color, fontColor, favorite}
- [ ] _isNewTag — Boolean
- [ ] _onSave, _onDelete, _onClose — Callback functions
- [ ] _injected — Whether modal HTML has been injected
- [ ] _tagColorPalette — Array of {bg, fg} preset colors
- [ ] _tagSharingConfig — Full sharing config from server
- [ ] _tagSharingUserList — Available users for sharing
- [ ] _currentTagShares — Current tag's shares being edited
