# Implementation Plan: Email Zone Notes Parity

## Overview

Restructure the Email zone on both Android app and mobile web to follow the Notes zone's bottom-pinned toolbar pattern. The body fills available space, a pinned toolbar provides formatting/undo/redo/preview, and email-specific actions move into an overflow menu. Desktop web (>768px) is unchanged.

## Tasks

- [ ] 1. Android App — Extract shared formatting utilities
  - [ ] 1.1 Create `MarkdownFormatUtils.kt` shared utility object
    - Create new file at `android/app/src/main/java/com/cwoc/app/ui/screens/editor/utils/MarkdownFormatUtils.kt`
    - Extract formatting functions from `NotesZone` in `ChitEditorScreen.kt` (lines 2316-2742) into static utility functions: `applyWrapFormat`, `applyLinkFormat`, `applyHeadingFormat`, `applyLinePrefixFormat`, `applyBlockquoteFormat`, `applyHorizontalRule`
    - Each function takes a `TextFieldValue` and returns a new `TextFieldValue` (text + selection)
    - _Requirements: 10.1, 10.3_

  - [ ] 1.2 Refactor `NotesZone` to use shared `MarkdownFormatUtils`
    - Replace inline formatting lambdas in `NotesZone` (ChitEditorScreen.kt) with calls to `MarkdownFormatUtils` functions
    - Verify NotesZone behavior is unchanged after refactor
    - _Requirements: 10.1_

- [ ] 2. Android App — Restructure EmailComposeZone layout
  - [ ] 2.1 Restructure `EmailComposeZone.kt` to Column with three sections
    - Replace the current flat Column layout with the Notes zone pattern: Address Header (scrollable top) + Body (`Modifier.weight(1f)`) + Bottom Toolbar (pinned with `imePadding()` + `navigationBarsPadding()`)
    - The `DraftComposeContent` becomes the address header section (From, To, CC/BCC, Subject fields only — body and action buttons removed from it)
    - Body becomes a standalone `OutlinedTextField` with `Modifier.weight(1f)` filling remaining space
    - Remove the inline action button Rows (Send, Later, Send & Archive, Discard, Reply, Forward, Archive)
    - _Requirements: 1.1, 1.2, 6.1, 6.3, 6.4, 7.1, 7.2, 7.4_

  - [ ] 2.2 Implement Address Header scrollable section
    - Wrap From/To/CC-BCC/Subject fields in a scrollable Column that caps at 40% of zone height
    - When content exceeds 40% height, the section becomes independently scrollable
    - For received/sent emails, display address fields as read-only text (reuse existing `ReadOnlyEmailField`)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 2.3 Implement Email Bottom Toolbar composable
    - Create the bottom toolbar Row matching Notes zone pattern: Overflow (⋮) | Preview (👁) | Undo (↺) | Redo (↻) | scrollable formatting buttons
    - Use `Modifier.imePadding().navigationBarsPadding()` to stay above keyboard
    - Use `IconButton` with `combinedClickable` (tap = action, long-press = tooltip toast) — same as Notes
    - Formatting section uses `horizontalScroll(rememberScrollState())` for scrollable overflow
    - Include Heading dropdown (H1/H2/H3) and Block dropdown (Blockquote/Code/HR) matching Notes
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1_

- [ ] 3. Android App — Implement toolbar functionality
  - [ ] 3.1 Wire formatting buttons to shared `MarkdownFormatUtils`
    - Connect each formatting button (Bold, Italic, Strikethrough, Link, Heading, Bullet, Numbered, Blockquote, Code, HR) to the corresponding `MarkdownFormatUtils` function
    - Pass the email body `TextFieldValue` state and update it with the result
    - Disable formatting buttons when not in edit mode or when body field is not focused
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 10.1, 10.3_

  - [ ] 3.2 Implement Undo/Redo state management for email body
    - Add `undoStack` and `redoStack` state (max 50 entries, oldest discarded first)
    - Push to undo stack on text change with 500ms debounce or word-boundary detection
    - Clear redo stack on new edit
    - Undo button reverts text + cursor; Redo button restores text + cursor
    - Dim buttons when respective stack is empty
    - Preserve stacks across preview/edit mode switches
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 3.3 Implement Preview/Edit toggle for email body
    - Draft mode: toggle between raw markdown `OutlinedTextField` and `MarkdownRenderer` preview
    - Received mode: toggle between HTML rendered view and plain text (replaces FilterChip toggle)
    - Sent mode: same as received
    - In preview mode, show minimal toolbar (Overflow + Edit button only)
    - In edit mode, show full toolbar
    - Remove the existing `FilterChip` HTML/Text toggle from `ReceivedEmailContent`
    - Default to HTML view for received emails when HTML content is available
    - Hide Preview toggle if received email has no HTML content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4_

  - [ ] 3.4 Implement Email Overflow Menu (⋮) with context-dependent items
    - Draft menu: Send, Send Later, Send & Archive, PGP Encrypt toggle, Copy body, Discard draft
    - Received menu: Reply, Forward, Archive, Copy body, Download, Add sender to contacts
    - Sent menu: Forward, Copy body, Download
    - Disable Send/Send Later/Send & Archive when To field is empty
    - Discard shows confirmation dialog (confirm/cancel)
    - Dismiss menu on tap outside
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 4. Checkpoint — Android app complete
  - Ensure all changes compile, ask the user if questions arise.

- [ ] 5. Mobile Web — Create bottom-pinned email toolbar
  - [ ] 5.1 Create `_createMobileEmailToolbar()` function in `editor-email.js`
    - Mirror the structure of `_createMobileNotesToolbar()` from `editor-notes.js`
    - Build toolbar DOM: Overflow (⋮) | Preview (👁) | Undo (↺) | Redo (↻) | separator | scrollable formatting buttons (Bold, Italic, Strikethrough, Link, Heading▾, Bullet, Numbered, Block▾)
    - Append toolbar to document body, position fixed at bottom
    - Include heading dropdown (H1/H2/H3) and block dropdown (Blockquote/Code) that pop up above the toolbar
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.6, 2.7_

  - [ ] 5.2 Implement keyboard tracking and toolbar visibility
    - Show toolbar when email body textarea is focused (keyboard open)
    - Hide toolbar on blur (with 150ms delay for button taps)
    - Track keyboard via `visualViewport` resize events (same pattern as Notes)
    - Position toolbar above keyboard using `visualViewport.height + offsetTop`
    - _Requirements: 1.3, 1.6_

  - [ ] 5.3 Wire formatting buttons to existing `_emailFormatBtn()` function
    - Each formatting button calls `_emailFormatBtn(action, 'emailBody')` directly
    - Disable buttons when textarea is not focused
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.8, 10.2, 10.3_

  - [ ] 5.4 Implement Undo/Redo for mobile email toolbar
    - Add undo/redo stack management (same pattern as Notes mobile toolbar)
    - Push state on text change with debounce/word-boundary logic
    - Wire Undo/Redo buttons to stack operations
    - Dim buttons when stacks are empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 5.5 Implement Preview/Edit toggle for mobile email toolbar
    - Draft: toggle between textarea (edit) and rendered markdown (preview)
    - Received/Sent: toggle between HTML rendered view and plain text
    - In preview mode, show minimal toolbar (Overflow + Edit only)
    - In edit mode, show full toolbar
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.6 Implement Overflow Menu dropdown with context-dependent items
    - Draft menu: Send, Send Later, Send & Archive, PGP Encrypt toggle, Copy body, Discard draft
    - Received menu: Reply, Forward, Archive, Copy body, Download, Add sender to contacts
    - Sent menu: Forward, Copy body, Download
    - Disable send actions when To field is empty
    - Discard shows confirmation dialog
    - Dismiss on tap outside
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 5.7 Hide zone-header action buttons on mobile (≤768px)
    - On mobile, hide Send, Reply, Forward, Discard, Undo, Redo, Render buttons from the email zone header
    - Keep only the collapse toggle in the zone header on mobile
    - Desktop (>768px) retains all zone-header buttons unchanged
    - _Requirements: 5.1, 8.1, 8.2, 8.3_

- [ ] 6. Mobile Web — Email body fills remaining space
  - [ ] 6.1 Implement auto-grow body textarea behavior
    - Email body textarea uses auto-grow (same as Notes textarea) with minimum height 200px
    - Body fills available viewport space between address header and bottom toolbar
    - Address header occupies only the height needed by its content
    - _Requirements: 6.2, 6.3_

- [ ] 7. Final checkpoint
  - Ensure all changes work correctly on both platforms, ask the user if questions arise.

## Notes

- Desktop web (>768px) is explicitly unchanged — Requirements 8.1, 8.2, 8.3 confirm this
- No schema changes, no migrations, no API changes needed
- Formatting logic is already shared on web (`_notesFormatBtn` calls `_emailFormatBtn`); the mobile toolbar just needs to call `_emailFormatBtn` directly
- The Android app needs formatting logic extracted from NotesZone into a shared utility before EmailComposeZone can use it
- Each task references specific requirements for traceability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "5.2", "5.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "5.4", "5.5", "5.6"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4", "5.7", "6.1"] }
  ]
}
```
