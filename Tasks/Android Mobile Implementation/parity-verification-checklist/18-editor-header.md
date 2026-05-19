# Editor Header (Title, Status, Priority, Pin, Archive)

**Category:** Editor Zones
**Item #:** 18
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Title Zone (editor.html + editor-init.js)

- [ ] `<input type="text" id="title">` — Main title text input with placeholder "Enter title"
- [ ] `<span id="chitUuidDisplay">` — Displays the chit UUID next to the title (read-only)
- [ ] `<span id="cwoc-owner-chip-container">` — Owner chip display (shows owner name + avatar when chit is shared by another user)
- [ ] `<span id="recurrenceIcon">` — Recurrence/habit icon indicator (🔁 for recurring, 🎯 for habit), hidden by default
- [ ] `<input type="hidden" id="nestThreadId">` — Hidden input for nest thread ID
- [ ] `<span id="nestButtonLabel">` — Nest label pill (hidden by default)

### Pin Toggle (editor.html + editor-init.js + editor-save.js)

- [ ] `<button id="pinnedButton" onclick="togglePinned()">` — Pin toggle button with bookmark icon
- [ ] `<input type="hidden" id="pinned" value="false">` — Hidden input storing pin state ("true"/"false")
- [ ] `togglePinned()` — Toggles pinned state, swaps icon between `fas fa-bookmark` (pinned) and `far fa-bookmark` (unpinned)
- [ ] Pin state loaded from `chit.pinned` in `loadChitData()` — sets hidden input value and icon class

### Archive Toggle (editor.html + editor-init.js + editor-save.js)

- [ ] `<button id="archivedButton">` — Archive toggle button (text changes: "📦 Archive" / "📦 Archived")
- [ ] `<input type="hidden" id="archived" value="false">` — Hidden input storing archive state ("true"/"false")
- [ ] Archive button gets class `archived-active` when archived
- [ ] Archive state loaded from `chit.archived` in `loadChitData()` — sets hidden input value, button text, and active class

### Status Dropdown (editor.html + editor-dates.js)

- [ ] `<select id="status" onchange="onStatusChange()">` — Status dropdown
- [ ] Option: `""` (dash, no status)
- [ ] Option: `"ToDo"`
- [ ] Option: `"In Progress"`
- [ ] Option: `"Blocked"`
- [ ] Option: `"Complete"`
- [ ] Option: `"Rejected"`
- [ ] `onStatusChange()` — Handles status change, checks project membership removal, prerequisite override warning
- [ ] `setSelectValue(statusSelect, chit.status)` — Loads status from chit data (case-insensitive match)
- [ ] Due Complete checkbox sync: `dueComplete` checkbox checked when status is "Complete"

### Priority Dropdown (editor.html + editor-init.js)

- [ ] `<select id="priority">` — Priority dropdown
- [ ] Option: `""` (dash, no priority)
- [ ] Option: `"High"`
- [ ] Option: `"Medium"`
- [ ] Option: `"Low"`
- [ ] `setSelectValue(prioritySelect, chit.priority)` — Loads priority from chit data

### Severity Dropdown (editor.html + editor-init.js)

- [ ] `<select id="severity">` — Severity dropdown
- [ ] Option: `""` (dash, no severity)
- [ ] Option: `"Critical"`
- [ ] Option: `"Major"`
- [ ] Option: `"Normal"`
- [ ] Option: `"Minor"`
- [ ] `setSelectValue(severitySelect, chit.severity)` — Loads severity from chit data

### Assignee Dropdown (editor.html + editor-people.js)

- [ ] `<select id="sharingAssignedTo">` — Assignee dropdown (hidden by default, shown when sharing is active)
- [ ] `<div id="sharingAssignedRow">` — Row container, visibility controlled by sharing state
- [ ] `_syncAssignedToDropdown()` — Populates options from owner + all system users
- [ ] `_onAssignedToChange()` — Auto-adds user to shares as manager when assigned

### Prerequisites (editor.html + editor-init.js)

- [ ] `<div id="prereqRow">` — Prerequisites field row
- [ ] `<button id="prereqAddBtn" onclick="openPrereqPicker()">` — Add prerequisite button
- [ ] `<div id="prereqListContainer">` — Container for prerequisite chips
- [ ] `initPrerequisites(chit)` — Initializes prerequisites from chit data

### Header Bar Buttons (editor.html)

- [ ] `<button id="saveButton" onclick="saveChit()" disabled>` — Save button (disabled when no changes)
- [ ] `<button id="saveStayButton" onclick="saveChitAndStay()">` — Save & Stay button (shown when unsaved)
- [ ] `<button id="saveExitButton" onclick="saveChit()">` — Save & Exit button (shown when unsaved)
- [ ] `<button onclick="cancelOrExit()" class="cancel">` — Exit button
- [ ] `<button id="editorMoreBtn" onclick="_toggleOptionsMenu(event)">` — Options/More menu button
- [ ] `<span id="autosave-indicator">` — Auto-save indicator (hidden by default)
- [ ] `<button id="saveDraftButton" onclick="saveChitAndStay()">` — Save as Draft (email chits only)
- [ ] `<button id="saveSendButton" onclick="_emailSaveAndSend()">` — Save & Send (email chits only)
- [ ] `<button id="saveSendArchiveButton" onclick="_emailSaveAndSendArchive()">` — Send & Archive (email chits only)

### Header Bar — Profile Menu (editor.html)

- [ ] `<div id="cwoc-profile-menu">` — Profile menu container
- [ ] `<button id="cwoc-profile-btn" onclick="_cwocToggleProfileMenu()">` — Profile button with avatar image
- [ ] `<img id="cwoc-profile-img">` — Profile avatar image

### Initialization Functions (editor-init.js)

- [ ] `_initializeChitId()` — Parses URL params for chit ID, sets `window.currentChitId`, `window.isNewChit`, `window._editingInstance`
- [ ] `resetEditorForNewChit()` — Resets all fields to defaults for a new chit
- [ ] `loadChitData(chitId)` — Fetches chit from API and populates all fields
- [ ] `_collapseAllZonesForNewChit()` — Collapses all zones, expands relevant zone based on source tab
- [ ] `toggleZone(event, sectionId, contentId)` — Zone expand/collapse toggle (respects mobile zone mode)
- [ ] `_toggleSection(contentId, button)` — Generic section show/hide toggle
- [ ] `setSelectValue(selectElement, value)` — Case-insensitive select value setter
- [ ] `initializeFlatpickr(selector, options)` — Flatpickr date picker initialization with `disableMobile: true`

### Owner Chip Functions (editor-init.js)

- [ ] `_renderOwnerChip(chit)` — Renders owner chip for existing chits (hidden if owner is current user)
- [ ] `_renderOwnerChipForCurrentUser()` — Clears owner chip for new chits (owner is self)
- [ ] `_buildOwnerChipElement(displayName, profileImageUrl)` — Builds the owner chip DOM element with avatar

### Shared Editor State (editor.js)

- [ ] `var chitId` — Current chit ID global
- [ ] `setSaveButtonUnsaved()` — Marks editor as having unsaved changes (enables save buttons)
- [ ] `_onChecklistChange()` — Handles checklist changes (autosave or unsaved state)
- [ ] `_evaluateAutoCompleteChecklist()` — Auto-sets status to Complete when all checklist items checked

### Auto-Complete Checklist (editor.js)

- [ ] `<button id="autoCompleteChecklistBtn">` — Auto-complete toggle button in Task zone header
- [ ] `_initAutoCompleteChecklist(chit)` — Initializes auto-complete from chit data
- [ ] `_showAutoCompleteBtnIfChild()` — Shows the auto-complete button (always visible)
- [ ] `_updateAutoCompleteBtn()` — Updates button visual state (On/Off)
- [ ] `_evaluateAutoCompleteChecklist()` — Evaluates checklist + prerequisites, auto-sets status

### Checklist Autosave (editor.js)

- [ ] `_isChecklistAutosaveActive()` — Determines if autosave is active (global + per-chit override)
- [ ] `_checklistAutosave()` — Debounced autosave (2s delay)
- [ ] `_doChecklistAutosave()` — Performs PATCH to `/api/chits/{id}/checklist`
- [ ] `_flashChecklistSaved()` — Shows "✓ saved" indicator
- [ ] `_showChecklistPending()` — Shows "changes pending" indicator
- [ ] `_hideChecklistPending()` — Hides pending indicator
- [ ] `_loadChecklistAutosaveSetting()` — Loads global autosave setting from user settings
- [ ] `_toggleChecklistAutosaveChit(e)` — Cycles per-chit autosave override (null → true → false → null)
- [ ] `_updateChecklistAutosaveToggle()` — Updates autosave toggle button text
