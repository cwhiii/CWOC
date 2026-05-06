# Implementation Plan: Milkdown Editor Integration

## Overview

Integrate Milkdown — a plugin-driven WYSIWYG markdown editor — into CWOC's chit editor as the primary rich editing experience for the Notes zone and Notes modal. The implementation uses self-hosted ESM bundles loaded via import map, a custom parchment theme, content bridge to the existing save system, chit link autocomplete plugin, and format toolbar. Fallback to plain textarea when vendor files are unavailable.

## Tasks

- [ ] 1. Update configurator with Milkdown ESM bundle download step
  - [ ] 1.1 Add Milkdown download function to `install/configurinator.sh`
    - Write a new `download_milkdown_vendor()` function that downloads pinned Milkdown ESM bundles (core.js, ctx.js, prose.js, preset-commonmark.js, plugin-history.js, plugin-listener.js, plugin-clipboard.js, transformer.js, utils.js) from esm.sh/jsdelivr to `/app/src/static/vendor/milkdown/`
    - Function must be idempotent (skip download if files already exist and match expected size)
    - Add the function call to both the upgrade and fresh-install paths in `main()`
    - This task is writing the bash code only — NOT running the configurator
    - _Requirements: 1.4_

- [ ] 2. HTML changes to editor.html
  - [ ] 2.1 Add import map and Milkdown references to `editor.html`
    - Add `<script type="importmap">` block mapping `@milkdown/*` specifiers to `/static/vendor/milkdown/*.js`
    - Add `<link rel="stylesheet" href="/frontend/css/editor/editor-milkdown.css" />`
    - Add `<script type="module" src="/frontend/js/editor/editor-milkdown.js"></script>`
    - Add `<script src="/frontend/js/editor/editor-milkdown-chitlink.js"></script>` (non-module, for fallback compatibility)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 2.2 Update Notes zone HTML container in `editor.html`
    - Add a `<div id="milkdown-editor-container" class="milkdown-editor"></div>` inside the Notes zone, above the existing `#note` textarea
    - Add format toolbar HTML buttons above the milkdown container: Bold, Italic, Strikethrough, Link, H1, H2, H3, Bullet List, Ordered List, Blockquote, Code, HR
    - Keep the existing `#note` textarea in the DOM (will be hidden when Milkdown is active)
    - Add a `<div id="milkdown-modal-container" class="milkdown-editor"></div>` inside the Notes modal
    - Ensure toolbar is wrapped in a horizontally-scrollable container for mobile
    - _Requirements: 2.1, 7.1, 7.5, 9.2_

- [ ] 3. Create Theme CSS file
  - [ ] 3.1 Create `src/frontend/css/editor/editor-milkdown.css`
    - Style `.milkdown-editor` container with parchment background using CSS variables from `shared-page.css`
    - Style `.ProseMirror` content area: font family Lora, min-height 6em, max-height 60vh, overflow-y auto, auto-grow behavior
    - Style headings H1–H6 with decreasing sizes, color `var(--aged-brown-dark)`
    - Style blockquotes with left border `3px solid var(--accent-gold)`, italic
    - Style code blocks with `background: var(--parchment-medium)`, monospace font
    - Style links with `color: var(--info-blue)`, underline on hover
    - Style focus state with `box-shadow: 0 0 0 2px var(--accent-gold)`
    - Style format toolbar: horizontal layout, parchment-themed buttons, active state highlighting
    - Add mobile responsive rules: toolbar horizontal scroll, min touch target 200px height
    - Ensure minimum 14px font size, high contrast dark text on parchment
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.2, 9.4, 13.1, 13.2, 13.3_

- [ ] 4. Create Editor_Loader and Content_Bridge
  - [ ] 4.1 Create `src/frontend/js/editor/editor-milkdown.js` — Editor_Loader
    - Implement `window.CwocMilkdown` namespace with `ready`, `createEditor`, `destroyEditor`, `getMarkdown`, `setMarkdown`, `isLoaded`, `isFallback` properties
    - Dynamic import of Milkdown modules (`@milkdown/core`, `@milkdown/preset-commonmark`, `@milkdown/plugin-history`, `@milkdown/plugin-listener`, `@milkdown/plugin-clipboard`)
    - 5-second timeout on import — if exceeded, set `isFallback = true` and show textarea
    - `createEditor()`: create Milkdown instance in container with full plugin set, return instance object
    - `destroyEditor()`: clean up instance, null references, guard against double-destroy
    - `getMarkdown()` / `setMarkdown()`: extract/set content from/to editor instance
    - Register `beforeunload` listener to destroy all active instances
    - On fallback: show non-blocking toast notification, log error to console.error
    - _Requirements: 1.5, 1.6, 2.1, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.4_

  - [ ] 4.2 Implement Content_Bridge in `editor-milkdown.js`
    - `_initContentBridge()`: register Milkdown listener callback, on content change write markdown to `#note` textarea and call `markEditorUnsaved()`
    - Use `_suppressUnsaved` flag during initial content load to avoid false dirty state
    - `_syncModalToMain()`: on modal close, extract modal markdown, set into main editor, sync to textarea
    - `_getActiveMarkdown()`: return current markdown from whichever editor is active (modal or main)
    - On save action: always do fresh `getMarkdown()` extraction as safety net before POST
    - Handle empty extraction guard: if extraction returns empty but content existed, don't overwrite textarea
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.3_

  - [ ] 4.3 Implement Format Toolbar logic in `editor-milkdown.js`
    - `_milkdownFormat(action)`: execute ProseMirror commands for bold, italic, strikethrough, link, h1–h3, bulletList, orderedList, blockquote, code, hr
    - `_updateToolbarState()`: on selection change, highlight active format buttons
    - Wire keyboard shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+K, Ctrl/Cmd+E, Ctrl/Cmd+Shift+X
    - Toolbar buttons call `_milkdownFormat()` with the appropriate action string
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 5. Create Chit_Link_Plugin
  - [ ] 5.1 Create `src/frontend/js/editor/editor-milkdown-chitlink.js`
    - Implement `createChitLinkPlugin(currentChitId)` function
    - Monitor text input for `[[` trigger sequence in the Milkdown editor
    - On trigger: fetch chit titles from `/api/chits` (cache after first fetch in `window._allChitTitles`)
    - Display positioned dropdown below cursor with filtered matches (case-insensitive substring)
    - Exclude current chit from results
    - Keyboard navigation: Arrow Up/Down to highlight, Enter to select, Escape to dismiss
    - On selection: replace `[[query` text with `[[selected title]]`
    - Style dropdown to match CWOC parchment theme
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 6. Checkpoint — Core editor components complete
  - Ensure all new files are syntactically valid and internally consistent. Ask the user if questions arise.

- [ ] 7. Modify editor-notes.js for fallback guard
  - [ ] 7.1 Add Milkdown fallback guard to `src/frontend/js/editor/editor-notes.js`
    - Guard the existing textarea auto-grow, chit link autocomplete, and markdown render-toggle functions behind a `CwocMilkdown.isFallback` check
    - When Milkdown is active (`isFallback === false`), skip textarea-based initialization for the Notes zone
    - Preserve all existing functionality for fallback mode (textarea + marked.js render toggle)
    - Ensure the existing "Copy to Clipboard" and "Download as .md" features read from `_getActiveMarkdown()` when Milkdown is active
    - _Requirements: 8.1, 8.3, 11.1, 11.2, 11.3_

- [ ] 8. Modify editor-init.js for Milkdown initialization
  - [ ] 8.1 Add Milkdown initialization to `src/frontend/js/editor/editor-init.js`
    - After page load and chit data is populated into `#note` textarea, await `CwocMilkdown.ready`
    - On ready: call `createEditor()` for the Notes zone container with textarea content
    - Call `_initContentBridge()` to wire up sync
    - Wire the "Expand to Modal" button to create a modal Milkdown instance
    - Wire the modal "Done" button to call `_syncModalToMain()`
    - On `CwocMilkdown.isFallback`: skip Milkdown init, let existing textarea code run
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 11.4_

- [ ] 9. Mobile and responsive adjustments
  - [ ] 9.1 Verify and refine mobile styles in `editor-milkdown.css`
    - Ensure format toolbar scrolls horizontally on screens < 600px
    - Ensure editor container has min touch target height of 200px on mobile
    - Add `@media` rules for virtual keyboard visibility (editor remains scrollable)
    - Test that toolbar is not obscured when virtual keyboard appears (use `visualViewport` API if needed in JS)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Security hardening
  - [ ] 10.1 Add link security attributes
    - In the Milkdown editor configuration, customize the link node view to add `rel="noopener noreferrer"` and `target="_blank"` to all rendered anchor elements
    - Ensure paste handling strips HTML and only inserts plain text/markdown (via clipboard plugin configuration)
    - Verify that ProseMirror schema prevents script tags, javascript: URLs, on* event handlers, and iframe elements from appearing in the DOM
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 11. Checkpoint — Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Property-based tests
  - [ ]* 12.1 Write property test for chit link autocomplete filtering
    - **Property 5: Chit Link Autocomplete Filtering**
    - Generate random chit title lists and query strings, verify filtering returns only case-insensitive substring matches and excludes current chit
    - Python stdlib `unittest` + `random`, 120 iterations
    - **Validates: Requirements 6.3, 6.6**

  - [ ]* 12.2 Write property test for chit link insertion format
    - **Property 6: Chit Link Insertion Format**
    - Generate random title strings (including special characters, unicode, brackets), verify output is exactly `[[title]]`
    - Python stdlib `unittest` + `random`, 120 iterations
    - **Validates: Requirements 6.2**

  - [ ]* 12.3 Write property test for paste sanitization
    - **Property 4: Paste Sanitization**
    - Generate random HTML strings with script tags, event handlers, style elements, verify stripping produces safe output with no raw HTML
    - Python stdlib `unittest` + `random`, 120 iterations
    - **Validates: Requirements 4.4, 4.5, 10.3**

  - [ ]* 12.4 Write property test for XSS prevention
    - **Property 8: Schema-Based XSS Prevention**
    - Generate markdown with embedded `<script>`, `javascript:` URLs, `on*` attributes, `<iframe>` — verify none survive schema processing
    - Python stdlib `unittest` + `random`, 120 iterations
    - **Validates: Requirements 10.1**

- [ ] 13. Help documentation updates
  - [ ] 13.1 Update help page with Milkdown editor documentation
    - Add a section to the help page documenting the rich text editor: available formatting, keyboard shortcuts, chit link autocomplete (`[[`), toolbar usage
    - Document fallback behavior (plain textarea if vendor files missing)
    - Document the "Expand to Modal" workflow for longer notes
    - _Requirements: 7.1, 7.4, 6.1_

- [ ] 14. Final wiring — INDEX.md, VERSION, and release notes
  - [ ] 14.1 Update `src/INDEX.md` with new files and functions
    - Add entries for `editor-milkdown.js` (Editor_Loader, Content_Bridge, Format Toolbar functions)
    - Add entries for `editor-milkdown-chitlink.js` (Chit_Link_Plugin)
    - Add entries for `editor-milkdown.css` (Theme_Layer sections)
    - Add entry for `static/vendor/milkdown/` directory
    - Document modifications to `editor-notes.js`, `editor-init.js`, `configurinator.sh`
    - _Requirements: all_

  - [ ] 14.2 Update `src/VERSION` with current datetime
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - This is done ONCE at the very end
    - _Requirements: all_

  - [ ] 14.3 Create release notes file
    - Create `documents/release_notes/cwoc_release_[version].md` with a brief summary of the Milkdown editor integration
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- NO software installation tasks — the configurator task writes download code but does NOT run it
- All JavaScript is vanilla (no framework, no build step) — Milkdown is the exception loaded via import map as ESM modules
- Property-based tests use Python stdlib `unittest` + `random` only (no hypothesis, no pip)
- INDEX.md and VERSION are updated only once at the very end (task 14)
- The dashboard Notes view is NOT modified — it continues using marked.js for read-only rendering
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
