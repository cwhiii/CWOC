# Requirements Document

## Introduction

Consolidate CWOC's ~15 distinct UI feedback mechanisms (toasts, undo bars, confirmation modals, inline messages, auto-fade modals, unsaved-changes dialogs) into a minimal set of 5 universal shared functions. The goal is to eliminate copy-paste duplicates, remove one-off implementations that serve the same purpose as existing shared utilities, and establish a single source of truth for each feedback pattern. All existing user-facing behavior is preserved — this is a code consolidation, not a UX redesign.

## Glossary

- **Toast**: A brief, auto-dismissing notification message that appears at a fixed screen position (top-center) and fades away after a timeout
- **Undo_Toast**: A toast with a countdown progress bar and an Undo button; the associated action executes when the countdown expires unless the user clicks Undo
- **Confirm_Modal**: A centered overlay modal that asks the user a yes/no question and returns a boolean promise
- **Prompt_Modal**: A centered overlay modal with a text input field that returns the entered value
- **Unsaved_Modal**: A centered overlay modal with three options (Save, Discard, Cancel) shown when navigating away from dirty state
- **Inline_Feedback**: A status message rendered inside a specific DOM element near the control that triggered it (e.g., Tailscale status area)
- **Auto_Fade_Modal**: A modal that appears briefly and auto-dismisses via CSS animation without user interaction (e.g., duplicate-tag-modal)
- **Overlay_Backdrop**: The semi-transparent fixed-position background behind a modal that blocks interaction with the page

## Requirements

### Requirement 1: Unified Undo Toast Function

**User Story:** As a developer, I want a single `cwocUndoToast()` function that handles all reversible-action feedback, so that I don't maintain duplicate implementations for email, delete, archive, and snooze undo toasts.

#### Acceptance Criteria

1. THERE SHALL be a single function `cwocUndoToast(message, opts)` in `shared-utils.js` that creates an undo toast with a countdown bar and Undo button
2. THE `opts` parameter SHALL support: `duration` (ms, default 5000), `onExpire` (callback when countdown finishes), `onUndo` (callback when Undo is clicked), `id` (unique identifier to allow multiple coexisting toasts)
3. WHEN `onExpire` is provided and the countdown completes without the user clicking Undo, THE function SHALL call `onExpire`
4. WHEN the user clicks the Undo button before the countdown expires, THE function SHALL call `onUndo` and remove the toast
5. THE undo toast SHALL support HTML content in the message (for bold text, icons, etc.)
6. WHEN a new undo toast is created with the same `id` as an existing one, THE existing toast SHALL be removed (executing its `onExpire` if not yet dismissed) before the new one appears
7. THE undo toast SHALL be positioned at bottom-center of the viewport, matching the current `.cwoc-undo-toast` visual style
8. THE existing `_showDeleteUndoToast`, `_showArchiveUndoToast`, and `_showSnoozeUndoToast` functions SHALL become thin wrappers that format their message and call `cwocUndoToast`
9. THE `_emailUndoToast` function in `main-email.js` SHALL be deleted and its callers SHALL use `cwocUndoToast` directly
10. THE `_emailShowUndoSendBar` function in `main-email.js` SHALL be deleted and its callers SHALL use `cwocUndoToast` with a configurable duration read from settings

### Requirement 2: Eliminate Duplicate Undo Toast CSS

**User Story:** As a developer, I want one CSS class for undo toasts, so that styling changes only need to happen in one place.

#### Acceptance Criteria

1. THE `.email-undo-toast` CSS class in `styles-cards.css` SHALL be deleted
2. THE `.email-undo-send-toast` CSS class in `editor-email.css` SHALL be deleted
3. ALL undo toasts SHALL use the existing `.cwoc-undo-toast` class and its sub-classes (`.cwoc-undo-msg-row`, `.cwoc-undo-btn`, `.cwoc-undo-bar-outer`, `.cwoc-undo-bar-inner`)
4. THE responsive rules for `.email-undo-toast` and `.email-undo-send-toast` in `styles-responsive.css` SHALL be deleted (the `.cwoc-undo-toast` responsive rules already cover the same breakpoints)
5. THE duplicate `.cwoc-undo-toast` definition in `styles-cards.css` SHALL be deleted (the canonical definition lives in `shared-page.css`)

### Requirement 3: Replace Auto-Fade Modals with cwocToast

**User Story:** As a developer, I want to eliminate the "modal that auto-fades after 2 seconds" pattern and use `cwocToast` instead, since these are functionally identical to toasts.

#### Acceptance Criteria

1. THE `#duplicate-tag-modal` HTML element in `settings.html` SHALL be removed
2. THE `#reserved-tag-modal` HTML element in `settings.html` SHALL be removed
3. THE `#cwoc-tag-modal-dup` HTML element injected by `shared-tag-modal.js` SHALL be removed
4. THE `#cwoc-tag-modal-reserved` HTML element injected by `shared-tag-modal.js` SHALL be removed
5. ALL code that previously showed these modals SHALL instead call `cwocToast(message, 'info')` or `cwocToast(message, 'error')` as appropriate
6. THE CSS `@keyframes fadeOut` rule used exclusively by these modals SHALL be removed from `settings.html`
7. THE `closeDuplicateTagModal()` function in `settings.js` SHALL be deleted
8. THE ESC chain references to `duplicate-tag-modal` in `settings.js` SHALL be removed

### Requirement 4: Unified Unsaved-Changes Modal

**User Story:** As a developer, I want a single `cwocUnsavedModal()` function for the save/discard/cancel pattern, so that the 4 duplicate implementations are replaced by one shared function.

#### Acceptance Criteria

1. THERE SHALL be a single function `cwocUnsavedModal(opts)` in `shared-utils.js` that returns a Promise resolving to `'save'`, `'discard'`, or `'cancel'`
2. THE `opts` parameter SHALL support: `message` (optional custom message, defaults to "You have unsaved changes"), `saveLabel` (default "Save & Continue"), `discardLabel` (default "Discard & Continue"), `cancelLabel` (default "Cancel")
3. THE modal SHALL use the standard parchment styling (same as `cwocConfirm`) with three buttons
4. THE modal SHALL use the element ID `cwoc-unsaved-modal` for ESC chain compatibility
5. WHEN the user presses ESC while the modal is open, THE modal SHALL resolve with `'cancel'`
6. WHEN the user clicks outside the modal, THE modal SHALL resolve with `'cancel'`
7. THE duplicate unsaved-changes modal construction in `shared-page.js` (CwocSaveSystem) SHALL be replaced with a call to `cwocUnsavedModal`
8. THE duplicate unsaved-changes modal construction in `editor-save.js` (`_navigateWithSaveCheck`) SHALL be replaced with a call to `cwocUnsavedModal`
9. THE duplicate unsaved-changes modal construction in `editor-send-item.js` SHALL be replaced with a call to `cwocUnsavedModal`
10. THE duplicate unsaved-changes modal construction in `editor-prerequisites.js` SHALL be replaced with a call to `cwocUnsavedModal`

### Requirement 5: Unified Overlay Backdrop CSS

**User Story:** As a developer, I want one CSS class for modal overlay backdrops, so that the 5+ duplicate overlay definitions are consolidated.

#### Acceptance Criteria

1. THERE SHALL be a single `.cwoc-overlay` class defined in `shared-page.css` that provides the standard fixed-position, semi-transparent backdrop
2. THE `.cwoc-overlay` class SHALL set: `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`
3. THE `cwocConfirm` function SHALL use the `.cwoc-overlay` class instead of inline styles for its backdrop
4. THE `cwocPromptModal` function SHALL use the `.cwoc-overlay` class instead of inline styles for its backdrop
5. THE `cwocUnsavedModal` function SHALL use the `.cwoc-overlay` class for its backdrop
6. THE `cwocUndoToast` function SHALL NOT use an overlay (it floats without a backdrop, as it does today)
7. THE `.cwoc-prompt-modal-overlay` inline styles in `shared-utils.js` SHALL be replaced by the `.cwoc-overlay` class

### Requirement 6: Migrate Legacy HTML Delete Modals to cwocConfirm

**User Story:** As a developer, I want to remove the legacy HTML-based delete modals that predate `cwocConfirm`, so that all confirmation dialogs use the same shared function.

#### Acceptance Criteria

1. THE `#deleteChitModal` HTML element and its associated CSS in `editor.css` SHALL be removed
2. THE JavaScript that shows `#deleteChitModal` SHALL be replaced with a `cwocConfirm()` call
3. THE `#deleteEmailAccountModal` HTML element and its associated CSS in `settings.html` SHALL be removed
4. THE JavaScript that shows `#deleteEmailAccountModal` SHALL be replaced with a `cwocConfirm()` call
5. THE `#delete-modal` HTML element in `settings.html` (for color deletion) SHALL be removed
6. THE JavaScript that shows `#delete-modal` for color deletion SHALL be replaced with a `cwocConfirm()` call
7. ALL migrated confirmations SHALL preserve their existing button labels, danger styling, and behavior

### Requirement 7: Inline Feedback Remains As-Is (No Change)

**User Story:** As a developer, I want clarity that inline feedback patterns (`_tsFeedback`, `_ntfyFeedback`, `_showAdminMessage`) are intentionally kept separate from the toast system, since they serve a distinct UX purpose of showing status near the relevant control.

#### Acceptance Criteria

1. THE `_tsFeedback` function in `settings-integrations.js` SHALL NOT be modified or replaced
2. THE `_ntfyFeedback` function in `settings-integrations.js` SHALL NOT be modified or replaced
3. THE `_showAdminMessage` function in `user-admin.js` SHALL NOT be modified or replaced
4. THESE functions are documented as intentionally distinct from `cwocToast` because they provide contextual feedback anchored to a specific UI section

### Requirement 8: Backward Compatibility

**User Story:** As a user, I want all existing feedback behavior to work exactly as before after the consolidation, so that nothing breaks or changes from my perspective.

#### Acceptance Criteria

1. ALL existing `cwocConfirm` call sites SHALL continue to work without modification
2. ALL existing `cwocToast` call sites SHALL continue to work without modification
3. ALL existing `cwocPromptModal` call sites SHALL continue to work without modification
4. THE wrapper functions `_showDeleteUndoToast`, `_showArchiveUndoToast`, and `_showSnoozeUndoToast` SHALL remain available with their existing signatures (they become thin wrappers)
5. THE visual appearance of all feedback elements SHALL remain unchanged (same colors, fonts, positioning, animations)
6. THE ESC key behavior for all modals SHALL remain unchanged
7. NO new external dependencies SHALL be introduced
