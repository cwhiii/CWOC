# Implementation Plan: Obsidian-Style Token-Level Live Preview

## Overview

Replace the existing broken live preview implementation in `editor-notes.js` with a complete token-level Obsidian-style live preview engine. The system renders all markdown as formatted HTML except the specific inline token the cursor touches, which reveals its raw markdown syntax. Supports three cycling modes (Source → Live Preview → Reading), a format toolbar with keyboard shortcuts, and is reusable for both Notes and Email body editors.

This is a vanilla JS implementation with no build step, no frameworks, and no package installations. marked.js and DOMPurify are already available via CDN.

## Tasks

- [x] 1. Replace CSS styles for token-level live preview
  - [x] 1.1 Replace block-level `.nlp-block` styles with token-level styles in `src/frontend/css/editor/editor.css`
    - Remove all `.nlp-block`, `.nlp-block.nlp-rendered`, `.nlp-block.nlp-raw` rules (the old block-level approach)
    - Add `.nlp-line` styles (line container divs with appropriate margins)
    - Add `.nlp-line-h1` through `.nlp-line-h6` styles (heading sizes using Lora font)
    - Add `.nlp-line-list`, `.nlp-line-check`, `.nlp-line-quote`, `.nlp-line-hr` styles
    - Add `.nlp-tok` base styles (inline display, cursor: text)
    - Add `.nlp-tok.nlp-active` styles (monospace font, dashed border, subtle background highlight)
    - Add `.nlp-tok-bold strong`, `.nlp-tok-italic em`, `.nlp-tok-code code`, `.nlp-tok-strike s`, `.nlp-tok-link a`, `.nlp-tok-chitlink a` rendered styles
    - Add `.nlp-prefix` styles (non-editable block prefix markers like bullets, numbers, checkboxes, quote bars)
    - Add `.nlp-hr` horizontal rule styles
    - Preserve existing `.notes-format-toolbar`, `.notes-live-preview`, `#notes-rendered-output`, and mode toggle button styles
    - Ensure mobile responsive styles for token-level elements
    - _Requirements: 3.4, 4.2_

- [x] 2. Implement core tokenizer and line parser
  - [x] 2.1 Rewrite `_nlpTokenize()` function in `src/frontend/js/editor/editor-notes.js`
    - Implement regex-based inline tokenizer that splits a line into ordered token objects
    - Each token: `{ raw, html, start, end, type }` with correct character offsets
    - Support token types: bold (`**` only, never `__`), italic (`_` only, never `*`), inline code (`` ` ``), strikethrough (`~~`), links (`[text](url)`), images (`![alt](url)`), chit links (`[[title]]`), bold+italic (`**_text_**`)
    - Handle priority ordering (code first to prevent inner parsing, then bolditalic before bold/italic)
    - Return single plain-text token for lines with no formatting
    - Ensure concatenating all token `raw` values reproduces the original line content
    - Sanitize rendered HTML: add `rel="noopener noreferrer"` to link anchors, use DOMPurify where applicable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.3_

  - [ ]* 2.2 Write property test for tokenizer structural invariants
    - **Property 1: Tokenization Structural Invariants**
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [ ]* 2.3 Write property test for token type classification
    - **Property 2: Token Type Classification Correctness**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.4 Rewrite `_nlpParseLine()` function for block-level classification
    - Detect headings (`#` through `######`), unordered lists (`-`, `*`, `+`), ordered lists (`1.`), checkboxes (`- [ ]`, `- [x]`), blockquotes (`>`), horizontal rules (`---`, `***`, `___`)
    - Return `ParsedLine` object with block metadata and inline tokens
    - Preserve indentation level for nested lists
    - Classify lines with no block prefix as plain paragraphs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.5 Write property test for block-level classification
    - **Property 3: Block-Level Classification Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7**

- [x] 3. Implement DOM builder
  - [x] 3.1 Rewrite `_nlpBuild()` and `_nlpBuildLine()` in `src/frontend/js/editor/editor-notes.js`
    - `_nlpBuild()`: Read textarea value, split into lines, build one `div.nlp-line` per line with `data-line-idx` and `data-raw` attributes
    - `_nlpBuildLine(rawLine, idx)`: Create line div with CSS classes for block type, create `span.nlp-tok` per token with `data-raw` attribute and rendered `innerHTML`
    - Apply block-level CSS classes: `.nlp-line-h1`–`.nlp-line-h6`, `.nlp-line-list`, `.nlp-line-check`, `.nlp-line-quote`, `.nlp-line-hr`
    - Build non-editable prefix spans (bullets `•`, numbers, checkboxes `☐`/`☑`, quote bars `┃`)
    - Handle empty lines with `<br>` for editability
    - Sanitize all rendered HTML via DOMPurify to prevent XSS
    - Ensure at least one empty line div exists for new/empty notes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1_

  - [ ]* 3.2 Write property test for DOM construction correctness
    - **Property 4: DOM Construction Correctness**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 4. Checkpoint - Verify tokenizer and DOM builder
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement cursor tracking and token activation/deactivation
  - [x] 5.1 Rewrite `_nlpOnSelectionChange()` cursor tracker
    - Listen to `document` `selectionchange` event (registered when entering live mode, removed when leaving)
    - Verify cursor is within `#notesLivePreview` div
    - Walk up DOM from `sel.anchorNode` to find `.nlp-tok` ancestor
    - Compare found token with `_nlpActiveTokenEl` — no-op if same token
    - If cursor is in whitespace/prefix/empty area (no `.nlp-tok` ancestor), deactivate current token without activating new one
    - Deactivate old token before activating new token
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Rewrite `_nlpActivateToken(tokEl)` function
    - Set `_nlpActiveTokenEl = tokEl`
    - Add `.nlp-active` CSS class to the span
    - Replace span's innerHTML with textContent set to `data-raw` value (shows raw markdown syntax)
    - _Requirements: 4.2_

  - [x] 5.3 Rewrite `_nlpDeactivateToken(tokEl)` function
    - Save current `textContent` back to `data-raw` attribute
    - Remove `.nlp-active` CSS class
    - Re-tokenize the saved raw text via `_nlpTokenize()`
    - If single token result: update span's innerHTML with rendered HTML, update className
    - If multiple tokens result: trigger `_nlpRebuildLine()` for the containing line
    - If no valid formatting: render as plain text token
    - Update parent line's `data-raw` attribute
    - Set `_nlpActiveTokenEl = null`
    - Call `setSaveButtonUnsaved()`
    - _Requirements: 4.3, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.4 Write property test for cursor idempotence
    - **Property 8: Cursor Idempotence**
    - **Validates: Requirement 4.6**

  - [ ]* 5.5 Write property test for token deactivation and re-rendering
    - **Property 7: Token Deactivation and Re-rendering**
    - **Validates: Requirements 4.3, 5.1, 5.2, 5.3**

- [x] 6. Implement markdown extraction
  - [x] 6.1 Rewrite `_nlpExtract()` and `_nlpExtractLineRaw()` functions
    - `_nlpExtract()`: Iterate all `.nlp-line` elements, reconstruct each line from token `data-raw` attributes
    - For lines containing the active token, read `textContent` instead of `data-raw` to capture in-progress edits
    - Reconstruct block prefixes from line's parsed structure
    - Join lines with `\n` and sync result back to hidden textarea
    - `_nlpExtractLineRaw(lineEl)`: Rebuild a single line's raw markdown from its prefix + token data-raw values
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 6.2 Write property test for build-extract round trip
    - **Property 5: Build-Extract Round Trip**
    - **Validates: Requirements 6.5, 9.4**

- [x] 7. Implement input handling (Enter, Backspace, Paste)
  - [x] 7.1 Rewrite `_nlpOnKeydown()` for Enter and Backspace handling
    - **Enter**: Deactivate active token, get cursor offset in line, split line raw text at cursor position, rebuild current line with text before cursor, create new line div with text after cursor, re-index all lines, place cursor at start of new line
    - **Backspace at line start**: Detect cursor at offset 0, merge current line with previous line (concatenate raw texts), rebuild merged line, remove current line, re-index, place cursor at merge point
    - Delegate format hotkeys to `_getNotesFormatAction()` → `_notesFormatBtn()`
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 7.2 Implement paste handler for live preview
    - Intercept `paste` event on `#notesLivePreview`
    - Extract plain text only from clipboard (`e.clipboardData.getData('text/plain')`)
    - Strip all HTML tags and scripts
    - Insert plain text at cursor position
    - If multi-line paste, split into multiple line divs
    - Rebuild affected lines and re-index
    - Mark document as unsaved
    - _Requirements: 8.3, 11.4_

  - [ ]* 7.3 Write property test for line split and merge inverses
    - **Property 9: Line Split and Merge Inverses**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 7.4 Write property test for paste sanitization
    - **Property 11: Paste Sanitization**
    - **Validates: Requirements 8.3, 11.4**

- [x] 8. Checkpoint - Verify core live preview engine
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement mode controller and three-mode cycling
  - [x] 9.1 Rewrite `_setNotesMode(mode)` and `_cycleNotesRenderMode(event)` functions
    - Cycle order: Source → Live Preview → Reading → Source
    - **Source → Live**: Read textarea value, call `_nlpBuild()`, show `#notesLivePreview`, register `selectionchange` listener, show toolbar
    - **Live → Reading**: Call `_nlpExtract()` to sync textarea, hide live div, render full HTML via `marked.parse()` sanitized through DOMPurify, show `#notes-rendered-output` (non-editable), hide toolbar, remove `selectionchange` listener
    - **Reading → Source**: Hide reading div, show textarea, call `autoGrowNote()`, show toolbar
    - Update toggle button icon/label via `_updateRenderToggleBtn()`
    - Preserve markdown content exactly across all transitions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 9.2 Implement `selectionchange` listener lifecycle management
    - Register `document.addEventListener('selectionchange', _nlpOnSelectionChange)` when entering live mode
    - Remove listener when leaving live mode (to avoid unnecessary processing in other modes)
    - Register `focusout` handler on live div for deactivating token when focus leaves
    - Register `input` handler on live div for marking unsaved state
    - _Requirements: 4.1, 8.4_

- [x] 10. Implement format toolbar and keyboard shortcuts
  - [x] 10.1 Rewrite `_notesFormatBtn(action)` for Source mode formatting
    - Wrap selected text in textarea with appropriate markdown syntax
    - Bold: `**selection**` (always `**`, never `__`), Italic: `_selection_` (always `_`, never `*`), Strikethrough: `~~selection~~`, Code: `` `selection` ``, Link: `[selection](url)`
    - Headings: prepend `# `, `## `, `### ` to line
    - Lists: prepend `- ` or `1. ` to line
    - Blockquote: prepend `> ` to line
    - Horizontal rule: insert `---` on new line
    - If no selection, insert syntax with placeholder and select the placeholder
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Implement `_notesFormatBtnLive(action)` for Live Preview mode formatting
    - Get selection range within active token's raw text
    - Wrap selected portion with appropriate markdown syntax characters
    - Rebuild the affected line from updated raw text
    - Restore cursor position after formatting
    - If no active token, insert formatting at cursor position
    - _Requirements: 7.1, 7.3_

  - [x] 10.3 Implement `_getNotesFormatAction(e)` keyboard shortcut mapper
    - Map Ctrl+B → bold, Ctrl+I → italic, Ctrl+K → link, Ctrl+E → code
    - Map Ctrl+Shift+X → strikethrough, Ctrl+Shift+1/2/3 → H1/H2/H3
    - Map Ctrl+Shift+7 → ordered list, Ctrl+Shift+8 → unordered list
    - Map Ctrl+Shift+. → blockquote, Ctrl+Shift+- → horizontal rule
    - Return null if no matching shortcut
    - _Requirements: 7.4_

  - [x] 10.4 Implement toolbar visibility based on mode
    - Show `#notesFormatToolbar` in Source and Live Preview modes
    - Hide `#notesFormatToolbar` in Reading mode
    - _Requirements: 7.5, 7.6_

  - [ ]* 10.5 Write property test for format wrapping correctness
    - **Property 10: Format Wrapping Correctness**
    - **Validates: Requirement 7.2**

- [x] 11. Implement error handling and graceful degradation
  - [x] 11.1 Add marked.js fallback and DOM desync recovery
    - Check `typeof marked !== 'undefined'` before using `marked.parse()`; fall back to `_escHtml()` plain text display
    - In `_nlpExtract()`, if DOM state appears desynchronized (no `.nlp-tok` children in a line), fall back to reading `textContent` directly
    - In `_nlpDeactivateToken()`, if re-tokenization produces unexpected results, render as plain text without throwing
    - In `_nlpOnSelectionChange()`, if no `.nlp-tok` ancestor found, gracefully deactivate any active token
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 11.2 Write property test for XSS prevention
    - **Property 12: XSS Prevention in Rendered Output**
    - **Validates: Requirements 3.5, 11.1, 11.2**

  - [ ]* 11.3 Write property test for link security attributes
    - **Property 13: Link Security Attributes**
    - **Validates: Requirement 11.3**

- [x] 12. Checkpoint - Verify complete Notes live preview
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Email body live preview reuse
  - [x] 13.1 Refactor live preview engine for reuse with configurable DOM targets
    - Extract shared state into a factory or parameterized approach so the same tokenizer, parser, DOM builder, cursor tracker, and activator work with different container elements
    - Notes uses: `#note` textarea, `#notesLivePreview` div, `#notes-rendered-output` div, `#notesFormatToolbar`
    - Email uses: `#emailBody` textarea, `#emailLivePreview` div (new), `#email-rendered-output` div (new or existing), email toolbar
    - Each instance maintains its own `_activeTokenEl` and `_renderMode` state
    - _Requirements: 10.1, 10.3_

  - [x] 13.2 Add Email body live preview HTML elements to `src/frontend/html/editor.html`
    - Add `#emailLivePreview` contenteditable div (hidden by default) near the email body textarea
    - Add email mode toggle button in the email zone header
    - Add email format toolbar (or reuse notes toolbar pattern)
    - Ensure it works within the email expand modal context
    - _Requirements: 10.2, 10.4_

  - [x] 13.3 Wire up email mode cycling and event listeners
    - Implement `_emailSetMode(mode)` and `_emailCycleMode(event)` using the shared engine
    - Register/remove selectionchange listener scoped to email live preview div
    - Ensure email and notes live previews operate independently (separate active token tracking)
    - _Requirements: 10.2, 10.3, 10.4_

- [x] 14. Implement mobile and touch support
  - [x] 14.1 Ensure touch interactions trigger token activation
    - Verify that `selectionchange` fires correctly on tap (it does natively on iOS/Android)
    - Add `touchend` fallback listener on `#notesLivePreview` that triggers `_nlpOnSelectionChange()` after a short delay (for browsers where selectionchange is unreliable on touch)
    - Ensure format toolbar buttons are touch-friendly (adequate tap targets, no hover-only interactions)
    - Test that virtual keyboard appearance doesn't lose cursor position or active token state
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 15. Wire integration with editor-init.js and editor-save.js
  - [x] 15.1 Verify `_getNotesValue()` and `_setNotesValue()` integration
    - Ensure `_getNotesValue()` calls `_nlpExtract()` when in live mode (already implemented, verify it works with new engine)
    - Ensure `_setNotesValue()` updates textarea and triggers rebuild if in live mode
    - Verify `editor-init.js` call to `_setNotesMode('live')` works with the new implementation
    - Verify `editor-save.js` correctly reads note value via `_getNotesValue()` in all modes
    - _Requirements: 6.5, 9.3_

  - [x] 15.2 Register and clean up event listeners properly
    - Register `keydown` handler on `#notesLivePreview` for Enter/Backspace/format hotkeys
    - Register `paste` handler on `#notesLivePreview`
    - Register `input` handler on `#notesLivePreview` for unsaved state marking
    - Ensure listeners are added when entering live mode and removed when leaving
    - Handle `focusout` to deactivate active token when focus leaves the live div
    - _Requirements: 4.1, 8.1, 8.2, 8.3, 8.4_

- [x] 16. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify mode cycling preserves content (Source → Live → Reading → Source roundtrip)
  - Verify cursor tracking activates/deactivates tokens correctly
  - Verify format toolbar works in both Source and Live modes
  - Verify Enter/Backspace/Paste operations maintain data integrity
  - Verify email body live preview operates independently from Notes

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- This is a frontend-only feature — no backend changes, no installations, no server restarts needed
- The existing `editor-notes.js` has a partially working implementation that will be rewritten in place
- marked.js and DOMPurify are already loaded via CDN in editor.html
- All code is vanilla JavaScript with no build step
