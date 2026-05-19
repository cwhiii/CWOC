# Settings — Collections Tab

**Category:** Standalone Pages
**Item #:** 36
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Tag Editor Section
- [ ] new-tag (text input) — "New tag name" input field
- [ ] handleTagInput(event) — handles Enter (quick-create) and Shift+Enter (open modal) in tag input
- [ ] handleInfoClick(event) — handles click on Add button (plain = quick-create, Shift = modal)
- [ ] addTag() — quick-creates a tag with default color (no modal)
- [ ] "➕ Add" button — triggers addTag() on click
- [ ] isReservedTagPrefix(tagText) — blocks tags starting with "CWOC_System/"
- [ ] createTagInline(tagText) — creates tag via API with default settings
- [ ] _renderSettingsTagTree() — fetches all tags, builds tree, renders into #settings-tag-tree
- [ ] buildTagTree(tags) — builds hierarchical tree structure from flat tag list
- [ ] renderTagTree(container, tree, ...) — renders tree with expand/collapse and click handlers
- [ ] _syncHiddenTagEditor(tags) — syncs hidden tag-editor-hidden div with current tags
- [ ] openTagModal(tag) — opens cwocTagModal for editing a tag
- [ ] closeTagModal() — closes the tag modal
- [ ] openDeleteModal(event, item) — confirms and deletes a tag or color via cwocConfirm
- [ ] toggleTagFavorite() — (stub, handled by cwocTagModal)
- [ ] saveTag() — (stub, handled by cwocTagModal)
- [ ] deleteTag() — (stub, handled by cwocTagModal)
- [ ] "+" button per tag row — creates child tag under the clicked parent
- [ ] 🔗 sharing link icon — shown on tags that have active sharing

### Tag Modal (cwocTagModal)
- [ ] tag-modal — modal overlay for editing tag properties
- [ ] tag-name (text input) — tag name field
- [ ] tag-favorite-star — clickable star to toggle favorite
- [ ] tag-color (color input) — background color picker
- [ ] tag-font-color (color input) — font color picker
- [ ] tag-color-swatches — preset background color swatches
- [ ] tag-font-color-swatches — preset font color swatches
- [ ] tag-preview — live preview of tag appearance
- [ ] "Done" button — saves tag changes
- [ ] "Cancel" button — closes modal without saving
- [ ] "Delete" button — deletes the tag

### Tag Sharing (within Tag Modal)
- [ ] tag-sharing-section — sharing configuration area
- [ ] tag-sharing-list — list of current shares (user + role + remove button)
- [ ] tag-sharing-user-picker (select) — user dropdown for adding shares
- [ ] tag-sharing-role-select (select) — role dropdown (Viewer/Manager)
- [ ] "➕ Share" button — adds a new share
- [ ] _addTagShare() — adds share entry
- [ ] tag-share-perm-toggle — toggles permission between view/manage
- [ ] tag-share-remove button — removes a share entry
- [ ] _loadTagSharingData() — loads sharing data on page init
- [ ] _tagHasSharing(fullPath) — checks if a tag has active shares
- [ ] _getTagShares(fullPath) — returns share entries for a tag
- [ ] _getTagSharingUserName(userId) — resolves user ID to display name

### Custom Colors Section
- [ ] default-color-list — renders default palette (9 colors including transparent)
- [ ] color-list — renders user's custom colors with delete buttons
- [ ] "➕ Add Color" button — triggers openColorPicker()
- [ ] color-picker (hidden color input) — native color picker
- [ ] openColorPicker() — opens native color picker, adds color on change
- [ ] loadColors() — fetches custom colors from settings
- [ ] renderColors(colors) — renders both default and custom color swatches
- [ ] addColor(newColor) — adds a color to the list and saves
- [ ] deleteColor(hex, name) — confirms and removes a color (cwocConfirm)
- [ ] saveColors(colors) — saves color array to API

### Border Color Assignment
- [ ] border-assign-popup — floating popup for assigning overdue/blocked border colors
- [ ] assign-overdue-btn — "🚨 Overdue Border" button
- [ ] assign-blocked-btn — "🚧 Blocked Border" button
- [ ] assign-cancel-btn — "Cancel" button
- [ ] _openBorderAssignPopup(e, hex) — shows popup positioned near clicked swatch
- [ ] _applyBorderColorRings() — applies ring indicators to swatches showing current assignments
- [ ] _onHighlightToggle() — re-renders rings when highlight checkboxes change
- [ ] _borderColorOverdue variable — tracks current overdue border color
- [ ] _borderColorBlocked variable — tracks current blocked border color

### Saved Locations Section
- [ ] locations-list container — holds all location rows
- [ ] renderLocationsSection(locations) — renders location rows from data array
- [ ] _appendLocationRow(container, label, address, isDefault) — creates a single location row
- [ ] addLocationRow() — "➕ Add Location" button handler (adds empty row)
- [ ] _autoSelectSingleLocation() — auto-checks radio if only one non-empty row
- [ ] collectLocationsData() — reads all location rows from DOM for saving
- [ ] Each location row contains:
  - [ ] Radio button (default-location) — marks as default location
  - [ ] Label input (.location-label-input) — location label
  - [ ] Address input (.location-address-input) — location address
  - [ ] "✕" remove button (.remove-location-btn) — removes or clears the row

### Default Notifications Section
- [ ] default-notif-start-list container — start time notification rows
- [ ] default-notif-due-list container — due time notification rows
- [ ] "➕ Add" button (start) — _addDefaultNotifRow('start')
- [ ] "➕ Add" button (due) — _addDefaultNotifRow('due')
- [ ] _renderDefaultNotifList(type, list) — renders notification rows from data
- [ ] _addDefaultNotifRow(type) — adds an empty notification row
- [ ] _gatherDefaultNotifList(type) — collects notification data for saving
