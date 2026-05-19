# Notes

**Category:** Editor Zones
**Item #:** 23
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Notes Zone Structure (editor.html)

- [ ] `<div id="notesSection" class="zone-container">` — Notes zone container
- [ ] `<div id="notesContent" class="zone-body">` — Notes zone body (collapsible)
- [ ] Zone header with `toggleZone(event, 'notesSection', 'notesContent')` — Expand/collapse

### Notes Zone Header Buttons (editor.html)

- [ ] Undo button (`onclick="_notesUndo(e)"`) — Triggers browser undo on textarea
- [ ] Redo button (`onclick="_notesRedo(e)"`) — Triggers browser redo on textarea
- [ ] Render/Edit toggle button (`id="notes-render-toggle-btn"`) — Toggles markdown render view
- [ ] Shrink button (`onclick="shrinkNoteToFourLines(event)"`) — Shrinks textarea to 4 lines
- [ ] Fullscreen/Modal button (`onclick="openNotesModal(event)"`) — Opens fullscreen notes modal (desktop only)
- [ ] More menu button (`onclick="_toggleNotesMoreMenu(e)"`) — Opens more options dropdown
- [ ] Copy button (`onclick="copyNotesToClipboard(event, 'main')"`) — Copies notes to clipboard
- [ ] Download button (`onclick="downloadNotes(event, 'main')"`) — Downloads notes as .md file

### Notes Textarea (editor.html + editor-notes.js)

- [ ] `<textarea id="note">` — Main notes textarea
- [ ] `autoGrowNote(el)` — Auto-grows textarea height to fit content (up to viewport height)
- [ ] Notes value loaded from `chit.note` in `loadChitData()`
- [ ] Auto-switches to rendered view if note has content on load

### Markdown Rendering (editor-notes.js)

- [ ] `<div id="notes-rendered-output">` — Rendered markdown output container
- [ ] `toggleNotesViewMode(event)` — Toggles between edit and rendered markdown view
- [ ] `_setNotesRenderToggleLabel(isRendered, source)` — Updates toggle button label (Edit/Render)
- [ ] Uses `marked.js` CDN library for markdown parsing
- [ ] Fallback to `<pre>` if marked.js not available
- [ ] Format toolbar hidden when in rendered mode

### Format Toolbar (editor-notes.js)

- [ ] `<div id="notesFormatToolbar">` — Format toolbar container
- [ ] `_notesFormatBtn(action)` — Applies format action to notes textarea
- [ ] `_getNotesFormatAction(e)` — Gets format action from keyboard event
- [ ] Reuses `_emailFormatBtn()` and `_getEmailFormatAction()` from editor-email.js
- [ ] Auto-switches from rendered to edit mode before applying format

### List Continuation (editor-notes.js)

- [ ] `_notesListContinue(textarea)` — Auto-continues list items on Enter key
- [ ] Supports: `-` bullets, `*` bullets, `+` bullets, numbered lists (`1.` / `1)`), checkboxes (`- [ ]` / `- [x]`), blockquotes (`>`)
- [ ] Empty list prefix on Enter → breaks out of list (removes prefix)
- [ ] Ordered lists auto-increment number
- [ ] `_notesRenumberOrderedList(textarea, fromPos)` — Renumbers subsequent ordered list items

### Undo/Redo (editor-notes.js)

- [ ] `_notesUndo(e)` — Focuses textarea and executes browser undo
- [ ] `_notesRedo(e)` — Focuses textarea and executes browser redo

### More Menu (editor-notes.js)

- [ ] `<div id="notesMoreMenu">` — More menu dropdown container
- [ ] `_toggleNotesMoreMenu(e)` — Toggles more menu visibility
- [ ] `_closeNotesMoreMenu()` — Closes more menu
- [ ] Auto-closes on next click anywhere

### Copy & Download (editor-notes.js)

- [ ] `copyNotesToClipboard(event, source)` — Copies notes text to clipboard (main or modal)
- [ ] `downloadNotes(event, source)` — Downloads notes as markdown file
- [ ] Filename derived from chit title (sanitized to lowercase with underscores)
- [ ] Clipboard fallback using textarea + `document.execCommand("copy")`
- [ ] Visual feedback: button shows "✅" for 1.2 seconds after copy

### Shrink (editor-notes.js)

- [ ] `shrinkNoteToFourLines(event)` — Shrinks textarea and rendered output to 4 lines height

### Chit Link Autocomplete (editor-notes.js)

- [ ] `_checkChitLinkAutocomplete(textarea)` — Checks for `[[` pattern and shows autocomplete
- [ ] `_showChitLinkDropdown(textarea, matches)` — Shows dropdown with matching chit titles
- [ ] `_removeChitLinkDropdown()` — Removes the autocomplete dropdown
- [ ] `_insertChitLink(textarea, title)` — Inserts selected chit title and closes `]]`
- [ ] `window._allChitTitles` — Cached list of all chit titles (fetched on first `[[`)
- [ ] Dropdown: max 8 matches, positioned below cursor, keyboard navigable
- [ ] Arrow keys navigate dropdown, Enter selects highlighted, Escape closes
- [ ] Excludes current chit from results

### Fullscreen Notes Modal (editor-notes.js)

- [ ] `<div id="notesModal">` — Fullscreen notes modal overlay
- [ ] `openNotesModal(event)` — Opens modal (desktop only, ≤768px returns)
- [ ] `closeNotesModal(save)` — Closes modal, optionally saves content back to main textarea
- [ ] `<div id="notes-markdown-input-modal" contenteditable>` — Modal edit input (contenteditable div)
- [ ] `<div id="notes-rendered-output-modal">` — Modal rendered output
- [ ] `toggleModalNotesRender()` — Toggles render in modal
- [ ] `_getContentEditableText(el)` — Extracts plain text from contenteditable (preserving newlines)

### Notes Modal Mode Switching (editor-notes.js)

- [ ] `var _notesModalMode` — Current modal mode: 'editrender' or 'livepreview'
- [ ] `_switchNotesModalMode(mode)` — Switches between Edit/Render and Live Preview modes
- [ ] `<div id="notesModalModeToggle">` — Mode toggle pill (Edit/Render vs Live Preview)
- [ ] `<div id="notesModalEditRenderWrap">` — Edit/Render mode wrapper
- [ ] `<div id="notesModalLivePreviewWrap">` — Live Preview mode wrapper
- [ ] `<textarea id="notes-livepreview-input-modal">` — Live preview textarea input
- [ ] `<div id="notes-livepreview-output-modal">` — Live preview rendered output
- [ ] `_wireNotesModalLivePreview()` — Wires live preview input listener
- [ ] `_updateNotesModalLivePreview()` — Updates live preview output
- [ ] Content synced between modes on switch
- [ ] `<div id="notesModalFormatToolbar">` — Modal format toolbar
- [ ] `<button id="modal-render-toggle-btn">` — Modal render toggle button
- [ ] Uses shared `cwocWireLivePreview` and `cwocUpdateLivePreview` functions
