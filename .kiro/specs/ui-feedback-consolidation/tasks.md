# Implementation Plan: UI Feedback Consolidation

## Overview

Consolidate ~15 distinct UI feedback mechanisms into 5 universal shared functions. Eliminate copy-paste duplicates, remove one-off implementations, and establish a single source of truth for each feedback pattern. No user-facing behavior changes.

## Tasks

- [x] 1. Add `.cwoc-overlay` CSS class to shared-page.css
  - Add a `/* ── Universal Modal Overlay ── */` section in `src/frontend/css/shared/shared-page.css`
  - Define `.cwoc-overlay` with: position fixed, full viewport, rgba(0,0,0,0.5) background, z-index 9999, flexbox centering
  - This is purely additive — nothing uses it yet
  - _Requirements: 5.1, 5.2_

- [x] 2. Implement `cwocUndoToast()` in shared-utils.js
  - [x] 2.1 Add the `cwocUndoToast(message, opts)` function after the existing `cwocToast` function
    - Parameters: `message` (string, supports HTML), `opts` object with `duration` (default 5000), `onExpire`, `onUndo`, `id` (default 'cwoc-undo-toast')
    - Create a `.cwoc-undo-toast` element with the given `id`
    - If element with same `id` exists, remove it (call its `onExpire` if not yet dismissed)
    - Build DOM: message row (span + Undo button) + progress bar (outer + inner)
    - Start countdown interval updating bar width every 50ms
    - On countdown complete: remove toast, call `onExpire`
    - On Undo click: remove toast, call `onUndo`
    - Use `innerHTML` for message to support HTML content (bold, icons)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Refactor `_showDeleteUndoToast` in shared.js to delegate to `cwocUndoToast`
    - Replace the full DOM construction with a single `cwocUndoToast()` call
    - Preserve the existing function signature: `_showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo, customMessage)`
    - Format the message the same way (customMessage or "🗑️ Deleted: title")
    - Pass `onExpire` and `onUndo` through to `cwocUndoToast`
    - `_showArchiveUndoToast` and `_showSnoozeUndoToast` already delegate to `_showDeleteUndoToast` — they need no changes
    - _Requirements: 1.8, 8.4, 8.5_

- [x] 3. Delete email undo toast duplicates
  - [x] 3.1 Delete `_emailUndoToast` function from `main-email.js`
    - Find all callers of `_emailUndoToast` (email archive, email delete actions)
    - Replace each call with `cwocUndoToast(message, { onExpire: ..., onUndo: ..., id: 'emailUndoToast' })`
    - _Requirements: 1.9_

  - [x] 3.2 Delete `_emailShowUndoSendBar` function from `main-email.js`
    - Move the settings-read logic (email_undo_send_delay) inline at the call site
    - Replace with `cwocUndoToast('✉️ Sending email...', { duration: delaySec * 1000, onExpire: sendFn, onUndo: cancelFn, id: 'emailUndoSendToast' })`
    - Also update `_emailCheckPendingSend` which calls `_emailShowUndoSendBar`
    - _Requirements: 1.10_

  - [x] 3.3 Delete duplicate email undo CSS
    - Remove `.email-undo-toast` section from `src/frontend/css/dashboard/styles-cards.css`
    - Remove `.email-undo-send-toast` section from `src/frontend/css/editor/editor-email.css`
    - Remove `.email-undo-toast` and `.email-undo-send-toast` responsive rules from `src/frontend/css/dashboard/styles-responsive.css`
    - Remove the duplicate `.cwoc-undo-toast` definition from `styles-cards.css` (canonical is in `shared-page.css`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Replace auto-fade modals with cwocToast
  - [x] 4.1 Replace settings.html auto-fade modals
    - Remove `#duplicate-tag-modal` HTML element from `settings.html`
    - Remove `#reserved-tag-modal` HTML element from `settings.html`
    - Remove the `@keyframes fadeOut` CSS rule from `settings.html` (if only used by these)
    - In `settings.js`: replace all `document.getElementById("reserved-tag-modal")` show/hide with `cwocToast('Tags starting with "CWOC_System/" are reserved.', 'error')`
    - In `settings.js`: delete `closeDuplicateTagModal()` function
    - In `settings.js`: remove ESC chain references to `duplicate-tag-modal`
    - In `settings.js`: remove Enter key handler for `duplicate-tag-modal`
    - In `settings.js`: remove click listener on `duplicate-tag-modal`
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8_

  - [x] 4.2 Replace shared-tag-modal.js auto-fade modals
    - Remove the HTML injection of `#cwoc-tag-modal-dup` element
    - Remove the HTML injection of `#cwoc-tag-modal-reserved` element
    - Replace show logic with `cwocToast('Duplicate tag not created.', 'info')` and `cwocToast('Reserved tag prefix.', 'error')`
    - _Requirements: 3.3, 3.4, 3.5_

- [x] 5. Implement `cwocUnsavedModal()` in shared-utils.js
  - [x] 5.1 Add the `cwocUnsavedModal(opts)` function
    - Parameters: `opts` object with `message`, `saveLabel`, `discardLabel`, `cancelLabel`
    - Returns Promise resolving to `'save'`, `'discard'`, or `'cancel'`
    - Create overlay using `.cwoc-overlay` class
    - Create parchment-styled modal box (same style as `cwocConfirm`)
    - Use element ID `cwoc-unsaved-modal`
    - Three buttons: Save (primary brown), Discard (danger red), Cancel (neutral)
    - ESC key resolves with `'cancel'`
    - Click outside resolves with `'cancel'`
    - Remove any existing `#cwoc-unsaved-modal` before creating new one
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Replace unsaved-modal in shared-page.js (CwocSaveSystem)
    - Find the inline DOM construction for the unsaved-changes modal
    - Replace with `cwocUnsavedModal(opts).then(result => { ... })`
    - Map 'save' → save and navigate, 'discard' → navigate without saving, 'cancel' → stay
    - _Requirements: 4.7_

  - [x] 5.3 Replace unsaved-modal in editor-save.js
    - Find `_navigateWithSaveCheck` inline modal construction
    - Replace with `cwocUnsavedModal(opts).then(result => { ... })`
    - _Requirements: 4.8_

  - [x] 5.4 Replace unsaved-modal in editor-send-item.js
    - Find the inline modal construction for navigating to new chit
    - Replace with `cwocUnsavedModal(opts).then(result => { ... })`
    - _Requirements: 4.9_

  - [x] 5.5 Replace unsaved-modal in editor-prerequisites.js
    - Find the inline modal construction
    - Replace with `cwocUnsavedModal(opts).then(result => { ... })`
    - _Requirements: 4.10_

- [x] 6. Migrate legacy HTML delete modals to cwocConfirm
  - [x] 6.1 Migrate `#deleteChitModal` in editor
    - Find the JS that shows `#deleteChitModal` (likely in editor-save.js or editor-init.js)
    - Replace with `cwocConfirm(message, { title: 'Delete Chit', confirmLabel: '🗑️ Delete', danger: true })`
    - Remove `#deleteChitModal` HTML from `editor.html`
    - Remove `#deleteChitModal` CSS from `editor.css`
    - _Requirements: 6.1, 6.2, 6.7_

  - [x] 6.2 Migrate `#deleteEmailAccountModal` in settings
    - Find the JS that shows this modal (likely in settings-email.js)
    - Replace with `cwocConfirm(message, { title: 'Delete Email Account', confirmLabel: '🗑️ Delete', danger: true })`
    - Remove `#deleteEmailAccountModal` HTML from `settings.html`
    - Remove `#deleteEmailAccountModal` CSS from `settings.html`
    - _Requirements: 6.3, 6.4, 6.7_

  - [x] 6.3 Migrate `#delete-modal` in settings (color deletion)
    - Find the JS that shows this modal for color deletion
    - Replace with `cwocConfirm(message, { title: 'Delete Color', confirmLabel: '🗑️ Delete', danger: true })`
    - Remove `#delete-modal` HTML from `settings.html`
    - _Requirements: 6.5, 6.6, 6.7_

- [x] 7. Apply `.cwoc-overlay` class to existing modal functions
  - [x] 7.1 Update `cwocConfirm` to use `.cwoc-overlay` class
    - Replace the inline `overlay.style.cssText = '...'` with `overlay.className = 'cwoc-overlay'`
    - Keep the `overlay.id = 'cwoc-confirm-modal'` for ESC chain detection
    - _Requirements: 5.3_

  - [x] 7.2 Update `cwocPromptModal` to use `.cwoc-overlay` class
    - Replace the inline `overlay.style.cssText = '...'` with `overlay.className = 'cwoc-overlay cwoc-prompt-modal-overlay'`
    - Keep the class name for any existing selectors that target it
    - _Requirements: 5.4, 5.7_

- [x] 8. Verify and clean up
  - [x] 8.1 Search for any remaining references to deleted functions/elements
    - Grep for `_emailUndoToast`, `_emailShowUndoSendBar`, `emailUndoToast`, `emailUndoSendToast`
    - Grep for `duplicate-tag-modal`, `reserved-tag-modal`, `closeDuplicateTagModal`
    - Grep for `deleteChitModal`, `deleteEmailAccountModal`, `delete-modal`
    - Grep for `.email-undo-toast`, `.email-undo-send-toast`
    - Fix any remaining references
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.2 Verify ESC chain still works on all pages
    - Editor page: ESC closes modals in correct priority order
    - Settings page: ESC chain no longer references deleted modals
    - Dashboard page: ESC behavior unchanged
    - _Requirements: 8.6_

- [x] 9. Update INDEX.md, release notes, and version
  - Add `cwocUndoToast` and `cwocUnsavedModal` to the shared-utils.js section of `src/INDEX.md`
  - Add `.cwoc-overlay` to the shared-page.css section of INDEX.md
  - Note the deletion of `_emailUndoToast` and `_emailShowUndoSendBar` from main-email.js
  - Note the deletion of `closeDuplicateTagModal` from settings.js
  - Create release notes entry in `documents/release_notes/`
  - Update `src/VERSION` using `date "+%Y%m%d.%H%M"` (run once at the very end)
  - _Requirements: 8.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "4.1", "4.2", "5.1", "6.1", "6.2", "6.3"] },
    { "id": 1, "tasks": ["2.2", "3.1", "3.2", "5.2", "5.3", "5.4", "5.5", "7.1", "7.2"] },
    { "id": 2, "tasks": ["3.3"] },
    { "id": 3, "tasks": ["8.1", "8.2"] },
    { "id": 4, "tasks": ["9"] }
  ]
}
```

## Notes

- Each task is independently deployable — the phases are designed so nothing breaks mid-migration
- Task 2 (cwocUndoToast) must complete before Task 3 (email undo deletion)
- Task 5.1 (cwocUnsavedModal) must complete before Tasks 5.2–5.5
- Task 1 (.cwoc-overlay) must complete before Task 7
- Tasks 4 and 6 are independent of each other and can be done in any order
- No software installation required — all changes are vanilla JS/CSS
- Inline feedback functions (_tsFeedback, _ntfyFeedback, _showAdminMessage) are intentionally left alone
