# Notes Zone — Mobile Browser Complete Specification

This document describes the **Notes zone** of the chit editor as it appears and behaves on a **mobile browser** (viewport ≤768px). It is detailed enough to recreate the feature identically from scratch.

---

## 1. Context: Mobile Zone Mode

On mobile (≤768px), the editor enters **mobile zone mode**. Instead of showing all zones stacked vertically, it shows **one zone at a time** filling the full viewport. The user navigates between zones via:
- Swiping left/right on the zone header → next/previous zone
- A zone list overlay (swipe right on zone body)
- An actions sidebar (swipe left on zone body)

The Notes zone is the **3rd zone** in the ordered list (after Overview, Dates & Times, and before Checklist). Its registry entry:
```
{ id: 'notesSection', contentId: 'notesContent', label: 'Notes', icon: '📝' }
```

**Key mobile behaviors:**
- The fullscreen notes modal (`#notesModal`) is **never opened** on mobile — it's blocked by both JS (`if (window.innerWidth <= 768) return;`) and CSS (`body.mobile-zone-mode #notesModal { display: none !important; }`)
- The format toolbar is always visible inline (not hidden behind a modal)
- The textarea fills all available vertical space
- Zone headers don't collapse/expand (tapping the header does nothing)

---

## 2. HTML Structure

### 2.1 Zone Container

```html
<div id="notesSection" class="zone-container">
  <!-- Zone Header -->
  <div class="zone-header" onclick="toggleZone(event, 'notesSection', 'notesContent')">
    <h2 class="zone-title">📝 Notes</h2>
    <div class="zone-actions notes-zone-actions">
      <!-- Full Editor button (hidden on mobile — modal never opens) -->
      <button type="button" onclick="openNotesModal(event)"
              id="open-notes-modal-button" class="zone-button notes-left-btn"
              title="Open full editor">
        <i class="fas fa-expand"></i>
        <span class="hideWhenNarrow">Full Editor</span>
      </button>
      <!-- Data menu (more actions) -->
      <div style="position:relative;display:inline-block;">
        <button type="button" onclick="_toggleNotesMoreMenu(event)"
                class="zone-button notes-left-btn" id="notes-more-btn"
                title="Data actions">
          <i class="fas fa-ellipsis-v"></i>
          <span class="hideWhenNarrow">Data</span>
        </button>
        <div id="notesMoreMenu" class="zone-more-menu" style="display:none;">
          <button type="button" onclick="copyNotesToClipboard(event, 'main'); _closeNotesMoreMenu();">
            <i class="fas fa-clipboard"></i> Copy to clipboard
          </button>
          <button type="button" onclick="downloadNotes(event, 'main'); _closeNotesMoreMenu();">
            <i class="fas fa-download"></i> Download as file
          </button>
          <button type="button" onclick="_openSendContentModal(event, 'notes'); _closeNotesMoreMenu();">
            <i class="fas fa-paper-plane"></i> Send to another chit
          </button>
          <button type="button" onclick="_noteToChecklistFromHeader(event); _closeNotesMoreMenu();">
            <i class="fas fa-arrow-right"></i> Move to checklist
          </button>
        </div>
      </div>
      <!-- Spacer pushes Render button to the right -->
      <span class="location-actions-spacer"></span>
      <!-- Render toggle -->
      <button type="button" onclick="toggleNotesViewMode(event)"
              id="notes-render-toggle-btn" class="zone-button"
              title="Toggle rendered markdown view">
        <i class="fas fa-eye"></i>
        <span class="hideWhenNarrow">Render</span>
      </button>
    </div>
    <span class="zone-toggle-icon">🔼</span>
  </div>

  <!-- Zone Body -->
  <div id="notesContent" class="zone-body">
    <!-- Format Toolbar -->
    <div id="notesFormatToolbar" class="notes-format-toolbar">
      <button type="button" title="Bold (Cmd+B)" onclick="_notesFormatBtn('b')"><strong>B</strong></button>
      <button type="button" title="Italic (Cmd+I)" onclick="_notesFormatBtn('i')"><em>I</em></button>
      <button type="button" title="Strikethrough (Cmd+Shift+X)" onclick="_notesFormatBtn('s')"><s>S</s></button>
      <button type="button" title="Link (Cmd+K)" onclick="_notesFormatBtn('k')">🔗</button>
      <span class="notes-toolbar-sep"></span>
      <div class="notes-toolbar-dropdown">
        <button type="button" title="Heading">H ▾</button>
        <div class="notes-toolbar-dropdown-menu">
          <button type="button" onclick="_notesFormatBtn('h1')" style="font-size:1.2em;font-weight:bold;">H1</button>
          <button type="button" onclick="_notesFormatBtn('h2')" style="font-size:1.05em;font-weight:bold;">H2</button>
          <button type="button" onclick="_notesFormatBtn('h3')" style="font-size:0.95em;font-weight:bold;">H3</button>
        </div>
      </div>
      <button type="button" title="Bullet List (Cmd+Shift+8)" onclick="_notesFormatBtn('ul')">• List</button>
      <button type="button" title="Numbered List (Cmd+Shift+7)" onclick="_notesFormatBtn('ol')">1. List</button>
      <button type="button" title="Blockquote (Cmd+Shift+.)" onclick="_notesFormatBtn('q')">❝ Quote</button>
      <button type="button" title="Code (Cmd+E)" onclick="_notesFormatBtn('code')">⟨⟩</button>
      <button type="button" title="Horizontal Rule (Cmd+Shift+-)" onclick="_notesFormatBtn('hr')">―</button>
      <span class="notes-toolbar-spacer"></span>
      <button type="button" title="Undo (Cmd+Z)" onclick="_notesUndo(event)" class="notes-undo-redo">↺</button>
      <button type="button" title="Redo (Cmd+Shift+Z)" onclick="_notesRedo(event)" class="notes-undo-redo">↻</button>
    </div>
    <!-- Textarea + Rendered Output -->
    <div class="field full-width">
      <textarea id="note"
        style="width:100%;height:100%;min-height:3em;resize:vertical;overflow-y:hidden;box-sizing:border-box;"
        oninput="autoGrowNote(this)"
        onkeydown="var a=_getNotesFormatAction&&_getNotesFormatAction(event);if(a){event.preventDefault();_notesFormatBtn(a);}else if(event.key==='Enter'&&!event.shiftKey&&_notesListContinue&&_notesListContinue(this)){event.preventDefault();autoGrowNote(this);if(typeof markEditorUnsaved==='function')markEditorUnsaved();}">
      </textarea>
      <div id="notes-rendered-output" class="markdown-output"
           style="display:none;cursor:pointer;min-height:4em;padding:0.5em;"
           title="Double-click to edit"
           ondblclick="toggleNotesViewMode(event)">
      </div>
      <input type="hidden" id="description" name="description" />
    </div>
  </div>
</div>
```

---

## 3. Zone Header Buttons (Mobile Behavior)

### 3.1 Full Editor Button (`#open-notes-modal-button`)
- **Icon:** `fa-expand` + text "Full Editor" (text visible on mobile via `.hideWhenNarrow` override in mobile-zone-mode)
- **Mobile behavior:** Calls `openNotesModal(event)` which immediately returns without doing anything (`if (window.innerWidth <= 768) return;`). The button is effectively a no-op on mobile.
- **Note:** The button is still visible but non-functional. The zone itself fills the screen, serving the same purpose as the modal would on desktop.

### 3.2 Data Menu Button (`#notes-more-btn`)
- **Icon:** `fa-ellipsis-v` + text "Data"
- **Behavior:** Toggles the `#notesMoreMenu` dropdown (a `.zone-more-menu` positioned absolutely below the button)
- **Menu items (4 buttons):**
  1. **Copy to clipboard** — `fa-clipboard` icon, calls `copyNotesToClipboard(event, 'main')`
  2. **Download as file** — `fa-download` icon, calls `downloadNotes(event, 'main')`
  3. **Send to another chit** — `fa-paper-plane` icon, calls `_openSendContentModal(event, 'notes')`
  4. **Move to checklist** — `fa-arrow-right` icon, calls `_noteToChecklistFromHeader(event)`
- **Dismissal:** Clicking anywhere outside closes the menu (via `document.addEventListener('click', _closeNotesMoreMenu, { once: true })`)
- **Mobile backdrop:** A `.mobile-menu-backdrop` element appears behind the menu to block interaction and dismiss on tap

### 3.3 Render Toggle Button (`#notes-render-toggle-btn`)
- **Default state:** `fa-eye` icon + text "Render"
- **When rendered:** Changes to `fa-edit` icon + text "Edit"
- **Behavior:** Calls `toggleNotesViewMode(event)` — switches between textarea (edit) and rendered markdown (preview)
- **Position:** Pushed to the right side of the header by the `.location-actions-spacer` flex spacer

### 3.4 Zone Toggle Icon
- Shows `🔼` when expanded, `🔽` when collapsed
- **On mobile:** Zone headers don't collapse/expand (the `toggleZone` function returns immediately when `_mobileZoneModeActive` is true), so this icon is always `🔼`

---

## 4. Format Toolbar (`#notesFormatToolbar`)

### 4.1 Layout
- **Container:** `div.notes-format-toolbar`
- **Display:** `flex`, `flex-wrap: wrap`, `align-items: center`, `gap: 3px`
- **Background:** `rgba(139, 90, 43, 0.06)` (very light brown tint)
- **Border:** `1px solid rgba(139, 90, 43, 0.15)`, `border-radius: 4px`
- **Padding:** `5px 8px`, `margin-bottom: 6px`
- **Mobile override:** `body.mobile-zone-mode #notesFormatToolbar { display: flex !important; flex-wrap: wrap; gap: 2px; padding: 4px; }` — always visible, never hidden

### 4.2 Buttons (left to right)

| # | Label | Action | Keyboard Shortcut |
|---|-------|--------|-------------------|
| 1 | **B** (bold) | `_notesFormatBtn('b')` | Cmd+B |
| 2 | *I* (italic) | `_notesFormatBtn('i')` | Cmd+I |
| 3 | ~~S~~ (strikethrough) | `_notesFormatBtn('s')` | Cmd+Shift+X |
| 4 | 🔗 (link) | `_notesFormatBtn('k')` | Cmd+K |
| — | Separator | `.notes-toolbar-sep` (1px wide, 20px tall, brown line) | — |
| 5 | H ▾ (heading dropdown) | Opens dropdown with H1, H2, H3 | Cmd+Shift+1/2/3 |
| 6 | • List (bullet) | `_notesFormatBtn('ul')` | Cmd+Shift+8 |
| 7 | 1. List (numbered) | `_notesFormatBtn('ol')` | Cmd+Shift+7 |
| 8 | ❝ Quote (blockquote) | `_notesFormatBtn('q')` | Cmd+Shift+. |
| 9 | ⟨⟩ (code) | `_notesFormatBtn('code')` | Cmd+E |
| 10 | ― (horizontal rule) | `_notesFormatBtn('hr')` | Cmd+Shift+- |
| — | Spacer | `.notes-toolbar-spacer` (`flex: 1`) | — |
| 11 | ↺ (undo) | `_notesUndo(event)` | Cmd+Z |
| 12 | ↻ (redo) | `_notesRedo(event)` | Cmd+Shift+Z |

### 4.3 Button Styling
- **Normal buttons:** `background: var(--button-bg, #d4c5a9)`, `border: 1px solid rgba(139, 90, 43, 0.3)`, `border-radius: 3px`, `padding: 4px 8px`, `font-size: 0.85em`, `min-width: 28px`, `color: #2a1a0a`
- **Undo/Redo buttons (`.notes-undo-redo`):** `background: var(--accent-teal, #008080)`, `color: #fff`, `border-color: rgba(0, 100, 100, 0.5)` — teal colored to distinguish from formatting buttons
- **Mobile override:** `padding: 6px 8px`, `font-size: 0.8em`, `min-width: 32px` (larger tap targets)

### 4.4 Heading Dropdown
- **Container:** `div.notes-toolbar-dropdown` (position: relative)
- **Trigger:** Button labeled "H ▾"
- **Menu:** `div.notes-toolbar-dropdown-menu` — appears on hover (`:hover` CSS), positioned absolutely below trigger
- **Menu styling:** `background: #fff8e1`, `border: 1px solid rgba(139, 90, 43, 0.3)`, `border-radius: 4px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.15)`, `padding: 4px`
- **Menu items:** H1 (font-size 1.2em, bold), H2 (font-size 1.05em, bold), H3 (font-size 0.95em, bold)

### 4.5 Toolbar Visibility
- **When in edit mode:** Toolbar is visible
- **When in render mode:** Toolbar is hidden (`toolbar.style.display = isRendered ? 'none' : ''`)
- **On mobile zone mode:** Always forced visible via CSS `display: flex !important`

---

## 5. Textarea (`#note`)

### 5.1 Inline Styles
```css
width: 100%;
height: 100%;
min-height: 3em;
resize: vertical;
overflow-y: hidden;
box-sizing: border-box;
```

### 5.2 Mobile Zone Mode CSS Override
```css
body.mobile-zone-mode #notesContent {
    flex: 1;
    display: flex !important;
    flex-direction: column;
}

body.mobile-zone-mode #notesContent .field.full-width {
    flex: 1;
    display: flex;
    flex-direction: column;
}

body.mobile-zone-mode #notesContent #note {
    flex: 1;
    min-height: calc(100vh - 180px) !important;
    height: auto !important;
    resize: none;
    width: 100%;
    box-sizing: border-box;
}
```
This makes the textarea fill all available vertical space below the format toolbar, minus ~180px for the zone header, format toolbar, and mobile navigation elements.

### 5.3 General Mobile Input Override
```css
body.mobile-zone-mode .zone-body textarea {
    min-height: 38px;
    font-size: 16px; /* prevents iOS zoom on focus */
    box-sizing: border-box;
    max-width: 100%;
}
```

### 5.4 Auto-Grow Behavior (`autoGrowNote`)
On every `input` event, the textarea auto-grows to fit content:
1. Sets `height: 0px` to measure `scrollHeight`
2. Caps at `window.innerHeight`
3. Minimum height: 48px
4. Sets parent `.field.full-width` height to the target
5. Sets grandparent `.zone-body` height to `auto`
6. Sets textarea `height: 100%` to fill parent
7. Sets `overflow-y: auto` if content exceeds viewport, `hidden` otherwise
8. Triggers `_checkChitLinkAutocomplete(el)` for `[[` detection

**On mobile zone mode:** The CSS overrides (`flex: 1`, `min-height: calc(100vh - 180px)`) effectively make the textarea fill the screen regardless of auto-grow calculations.

---

## 6. Rendered Output (`#notes-rendered-output`)

### 6.1 Element
```html
<div id="notes-rendered-output" class="markdown-output"
     style="display:none;cursor:pointer;min-height:4em;padding:0.5em;"
     title="Double-click to edit"
     ondblclick="toggleNotesViewMode(event)">
</div>
```

### 6.2 CSS Class `.markdown-output`
```css
.markdown-output {
    overflow-wrap: break-word;
    word-break: break-word;
    max-width: 100%;
}
```

### 6.3 Behavior
- **Default:** Hidden (`display: none`)
- **When Render is toggled:** Shows rendered markdown, hides textarea
- **Double-click:** Switches back to edit mode
- **Content:** Rendered via `marked.parse(textarea.value || "")` with GFM breaks enabled globally

---

## 7. Markdown Rendering

### 7.1 Library
- **marked.js** loaded via CDN `<script>` tag
- **Global configuration** (in `shared-utils.js`):
  ```js
  marked.use({ breaks: true }); // single newlines → <br>
  marked.use({
    extensions: [{
      name: 'highlight',
      level: 'inline',
      start: function(src) { var m = src.match(/==/); return m ? m.index : -1; },
      tokenizer: function(src) {
        var match = src.match(/^==([^=]+)==/);
        if (match) return { type: 'highlight', raw: match[0], text: match[1] };
      },
      renderer: function(token) { return '<mark>' + token.text + '</mark>'; }
    }]
  });
  ```

### 7.2 Supported Markdown Features
- **Standard GFM:** headings, bold, italic, strikethrough, links, images, code (inline + fenced), blockquotes, ordered/unordered lists, horizontal rules, tables
- **Line breaks:** Single newline = `<br>` (GFM breaks mode)
- **Highlight extension:** `==text==` renders as `<mark>text</mark>`
- **Fallback:** If marked.js is unavailable, content is shown in a `<pre style="white-space:pre-wrap;">` block

### 7.3 Chit Links (`[[ ]]`)
- In rendered views on the dashboard, `[[Title]]` patterns are resolved to clickable links via `resolveChitLinks()`
- In the editor's rendered output, this resolution is NOT applied — the raw `[[Title]]` text renders as-is in the markdown

---

## 8. Format Actions (Shared with Email)

The notes format toolbar calls `_notesFormatBtn(action)` which delegates to `_emailFormatBtn(action, 'note')` — the same formatting engine used by the email zone.

### 8.1 `_notesFormatBtn(action)`
1. If currently in rendered mode, switches back to edit mode first
2. Calls `_emailFormatBtn(action, 'note')` to apply the formatting
3. Calls `autoGrowNote(document.getElementById('note'))` to resize

### 8.2 `_emailFormatBtn(action, textareaId)` — Formatting Logic

Each action wraps or prefixes the selected text in the textarea:

| Action | Effect | Requires Selection? |
|--------|--------|---------------------|
| `b` | Wraps selection in `**...**` | Yes |
| `i` | Wraps selection in `_..._` | Yes |
| `s` | Wraps selection in `~~...~~` | Yes |
| `k` | If selection is URL: `[link text](selection)` (selects "link text"); else: `[selection](url)` (selects "url") | Yes |
| `h1` | Prefixes current line with `# ` (strips existing `#` prefixes first) | No (operates on current line) |
| `h2` | Prefixes current line with `## ` | No |
| `h3` | Prefixes current line with `### ` | No |
| `ul` | Prefixes each selected line with `- `; if no selection, prefixes current line | No |
| `ol` | Prefixes each selected line with `1. `, `2. `, etc.; if no selection, prefixes current line with `1. ` | No |
| `q` | Prefixes each selected line with `> ` | Yes |
| `code` | Wraps selection in `` ` `` backticks | Yes |
| `hr` | Inserts `\n---\n` at cursor | No |

### 8.3 Keyboard Shortcuts (`_getNotesFormatAction` / `_getEmailFormatAction`)

Detected via `onkeydown` on the textarea. Returns the action string if a shortcut matches:

| Shortcut | Action |
|----------|--------|
| Cmd+B | `b` (bold) |
| Cmd+I | `i` (italic) |
| Cmd+K | `k` (link) |
| Cmd+E | `code` (inline code) |
| Cmd+Shift+X | `s` (strikethrough) |
| Cmd+Shift+7 | `ol` (numbered list) |
| Cmd+Shift+8 | `ul` (bullet list) |
| Cmd+Shift+. | `q` (blockquote) |
| Cmd+Shift+1 | `h1` |
| Cmd+Shift+2 | `h2` |
| Cmd+Shift+3 | `h3` |
| Cmd+Shift+- | `hr` (horizontal rule) |

When a shortcut is detected, `event.preventDefault()` is called and `_notesFormatBtn(action)` is invoked.

---

## 9. Enter Key: List Continuation (`_notesListContinue`)

When the user presses Enter (without Shift) in the textarea, `_notesListContinue(textarea)` is called. It auto-continues list items.

### 9.1 Supported Prefixes
Detected via regex: `/^(\s*)([-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s|>\s?)/`

- `- ` / `* ` / `+ ` — unordered list bullets
- `- [ ] ` / `- [x] ` / `- [X] ` — checkbox items
- `1. ` / `2) ` etc. — ordered list items (any number + `.` or `)`)
- `> ` — blockquotes

### 9.2 Behavior
1. **If the current line has content after the prefix:** Insert a newline + the same prefix (with appropriate modifications):
   - Checkboxes → always insert unchecked `[ ] `
   - Ordered lists → increment the number by 1
   - Bullets/blockquotes → same prefix
2. **If the current line is ONLY the prefix (empty content):** Remove the prefix from the current line (breaks out of the list)
3. **After inserting a numbered list continuation:** Calls `_notesRenumberOrderedList(textarea, newPos)` to renumber all subsequent consecutive ordered list items at the same indent level

### 9.3 Indentation Awareness
The function preserves leading whitespace (indent) from the current line and applies it to the continuation.

### 9.4 Integration
- Called from the textarea's `onkeydown` handler
- If it returns `true`, `event.preventDefault()` is called, then `autoGrowNote(this)` and `markEditorUnsaved()` are called
- Only fires when `event.key === 'Enter'` and `!event.shiftKey`

---

## 10. Chit Link Autocomplete (`[[ ]]`)

### 10.1 Trigger
Every time `autoGrowNote` runs (on every `input` event), `_checkChitLinkAutocomplete(textarea)` is called. It checks if the text before the cursor contains an unclosed `[[`.

### 10.2 Detection Logic
1. Find the last `[[` and last `]]` before the cursor position
2. If `[[` exists and is after the last `]]` (i.e., unclosed), extract the query text after `[[`
3. If query length < 1, remove dropdown
4. Otherwise, fetch all chits from `/api/chits` (cached in `window._allChitTitles`)
5. Filter chits whose title contains the query (case-insensitive), excluding the current chit
6. Show up to 8 matches

### 10.3 Dropdown UI
- **Element:** Dynamically created `div#chit-link-dropdown`
- **Styling:** `position: fixed`, `z-index: 9999`, `background: #fff8e1`, `border: 2px solid #8b4513`, `border-radius: 6px`, `max-height: 200px`, `overflow-y: auto`, `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`, `font-size: 0.9em`, `min-width: 200px`
- **Position:** Fixed below the textarea (`rect.left + 20`, `rect.bottom + 2`)
- **Items:** Each match is a `div` with `padding: 6px 10px`, `cursor: pointer`, `border-bottom: 1px solid #e0d4b5`
- **Highlight:** First item highlighted with `background: #f0e6d0`; hover changes highlight

### 10.4 Keyboard Navigation
- **Escape:** Removes dropdown
- **Enter:** Inserts the highlighted chit's title
- **ArrowDown/ArrowUp:** Moves highlight between items (with `scrollIntoView({ block: 'nearest' })`)

### 10.5 Selection/Insertion (`_insertChitLink`)
When a chit is selected (click or Enter):
1. Replaces text from `[[` to cursor with `[[title]]`
2. Positions cursor after the closing `]]`
3. Focuses textarea
4. Removes dropdown
5. Calls `markEditorUnsaved()`

### 10.6 Dismissal
- Dropdown is removed when:
  - `]]` is typed (closing the link)
  - Cursor moves before the `[[`
  - Escape is pressed
  - A selection is made

---

## 11. Undo/Redo

### 11.1 `_notesUndo(e)`
1. Stops propagation and prevents default
2. Focuses the `#note` textarea
3. Calls `document.execCommand('undo')` — uses the browser's native undo stack

### 11.2 `_notesRedo(e)`
1. Stops propagation and prevents default
2. Focuses the `#note` textarea
3. Calls `document.execCommand('redo')` — uses the browser's native redo stack

**Note:** These rely on the browser's built-in undo/redo for textareas, which tracks all text changes made through user input and programmatic `document.execCommand` calls.

---

## 12. Render Toggle (`toggleNotesViewMode`)

### 12.1 Edit → Render
1. Resets parent `.field.full-width` height to `""` (auto)
2. Renders markdown: `marked.parse(textarea.value || "")` → sets `innerHTML` of `#notes-rendered-output`
3. Shows rendered div (`display: block`), hides textarea (`display: none`)
4. Updates button label to "Edit" with `fa-edit` icon
5. Hides format toolbar

### 12.2 Render → Edit
1. Hides rendered div (`display: none`), shows textarea (`display: ""`)
2. Updates button label to "Render" with `fa-eye` icon
3. Shows format toolbar
4. Calls `autoGrowNote(textarea)` to resize
5. Focuses textarea

### 12.3 Auto-Render on Blur
When the textarea loses focus (blur event):
- If the blur target is NOT the render button itself
- AND the textarea has content (`.value.trim()`)
- → Automatically switches to rendered mode

This means on mobile, when the user taps away from the textarea, the notes automatically render as formatted markdown.

### 12.4 Auto-Render on Load
When a chit is loaded with existing note content:
```js
if (chit.note && chit.note.trim()) {
  setTimeout(() => toggleNotesViewMode(null), 50);
}
```
The notes zone starts in rendered mode if there's content.

### 12.5 ESC Key Behavior
If the textarea is visible (edit mode) and has content, pressing ESC switches to rendered mode (instead of exiting the page). This is part of the layered ESC chain in `editor-init.js`.

---

## 13. Data Actions (More Menu)

### 13.1 Copy to Clipboard (`copyNotesToClipboard`)
1. Gets text from `#note` textarea (`.value`)
2. Attempts `navigator.clipboard.writeText(text)`
3. Fallback: creates a temporary `<textarea>`, selects it, calls `document.execCommand("copy")`
4. Visual feedback: button innerHTML changes to "✅" for 1200ms, then reverts

### 13.2 Download as File (`downloadNotes`)
1. Gets text from `#note` textarea
2. Generates filename from chit title: `title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".md"` (fallback: `"note.md"`)
3. Creates a `Blob` with type `text/markdown`
4. Creates an object URL, triggers download via a temporary `<a>` element
5. Revokes the object URL

### 13.3 Send to Another Chit (`_openSendContentModal`)
Opens a modal that lets the user search for and select another chit, then appends the current note content to that chit's notes. This is a shared feature (also used by checklist zone).

### 13.4 Move to Checklist (`_noteToChecklistFromHeader`)
Converts note lines into checklist items:

**Parsing rules:**
- Each non-empty line becomes a checklist item
- Lines starting with `- [ ] ` or `- [x] ` → recognized as markdown checkboxes (preserves checked state)
- Lines starting with `- `, `* `, `• ` → prefix stripped
- Lines starting with `1. `, `2) ` etc. → prefix stripped
- Standalone `[x]` or `[ ]` at line start → recognized as legacy checkbox format
- Indentation detection: 4 spaces or 1 tab = 1 indent level; 2 spaces = 1 level
- Maximum indent level: `MAX_INDENT_LEVEL` (defined in checklist code)

**After conversion:**
1. New items are appended to the existing checklist
2. Parent-child relationships are assigned based on indent levels
3. Checklist is re-rendered
4. Note textarea is cleared
5. `autoGrowNote` is called
6. `setSaveButtonUnsaved()` is called
7. If rendered view was showing, its innerHTML is cleared
8. An **undo toast** appears (via `_showDeleteUndoToast`) that allows reversing the operation (restores both the note content and the previous checklist state)

---

## 14. More Menu (`#notesMoreMenu`)

### 14.1 Toggle Behavior (`_toggleNotesMoreMenu`)
1. Stops propagation and prevents default
2. Checks current display state of `#notesMoreMenu`
3. If closed → sets `display: flex`, then after a `setTimeout(0)` adds a one-time click listener on `document` to close it
4. If open → sets `display: none`

### 14.2 Styling (`.zone-more-menu`)
```css
.zone-more-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 100;
    background: var(--parchment-light, #fdf5e6);
    border: 2px solid var(--aged-brown-medium, #8b5a2b);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    padding: 6px 0;
    min-width: 200px;
    flex-direction: column;
}
.zone-more-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: none;
    font-family: 'Lora', Georgia, serif;
    font-size: 0.9em;
    color: var(--text-color, #1a1208);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    justify-content: flex-start;
}
.zone-more-menu button:hover {
    background: rgba(139, 90, 43, 0.1);
}
.zone-more-menu button i {
    width: 18px;
    text-align: center;
    flex-shrink: 0;
}
```

### 14.3 ESC Dismissal
The ESC key handler in `editor-init.js` checks for open more menus before other actions:
```js
var _notesMenu = document.getElementById('notesMoreMenu');
if (_notesMenu && _notesMenu.style.display === 'flex') {
  _closeNotesMoreMenu();
  return;
}
```

---

## 15. Zone Header Styling (Mobile)

### 15.1 Header Layout
```css
#notesSection > .zone-header {
    justify-content: flex-start;
}
#notesSection > .zone-header .zone-title {
    flex-shrink: 0;
    flex-grow: 0;
}
#notesSection > .zone-header .zone-actions.notes-zone-actions {
    flex: 1;
    margin-left: 1em;
    pointer-events: none; /* container doesn't capture clicks */
}
#notesSection > .zone-header .zone-actions.notes-zone-actions > * {
    pointer-events: auto; /* but children do */
}
#notesSection > .zone-header .zone-toggle-icon {
    margin-left: 1em;
}
```

### 15.2 Mobile Zone Mode: `.hideWhenNarrow` Override
On mobile zone mode, button labels that are normally hidden on narrow screens are shown:
```css
body.mobile-zone-mode .zone-header .zone-button .hideWhenNarrow {
    display: inline !important;
}
```
This means "Full Editor", "Data", and "Render" text labels are all visible on mobile.

---

## 16. Zone Collapse/Expand (Desktop Only)

On desktop, clicking the zone header toggles collapse:
- **Collapsed:** `#notesContent` gets `display: none`, icon changes to `🔽`, zone buttons are hidden
- **Expanded:** `#notesContent` gets `display: ''`, icon changes to `🔼`, zone buttons are shown

**On mobile:** `toggleZone()` returns immediately when `_mobileZoneModeActive` is true — zones never collapse.

### 16.1 Initial State on Load
The notes zone starts **expanded** if the chit has note content, **collapsed** if empty:
```js
["notesSection", "notesContent", () => !!(chit.note && chit.note.trim())]
```

---

## 17. Zone Empty Detection (Mobile Zone List)

The mobile zone list shows all zones with empty ones greyed out. For notes:
```js
if (id === 'notesSection') {
    var note = document.getElementById('note');
    return !note || !note.value.trim();
}
```
A zone is "empty" if the textarea has no content (after trimming whitespace).

---

## 18. Hidden Description Field

```html
<input type="hidden" id="description" name="description" />
```
This hidden field exists in the notes zone but is a legacy element. The actual note content is stored in the `#note` textarea and saved as the `note` field on the chit object.

---

## 19. Fullscreen Modal (Desktop Only — Blocked on Mobile)

The fullscreen notes modal (`#notesModal`) exists in the HTML but is **completely blocked on mobile**:

### 19.1 JS Block
```js
function openNotesModal(event) {
  if (event) event.stopPropagation();
  if (window.innerWidth <= 768) return; // ← exits immediately on mobile
  // ... modal logic ...
}
```

### 19.2 CSS Block
```css
body.mobile-zone-mode #notesModal {
    display: none !important;
}
```

### 19.3 Rationale
On mobile, the zone itself fills the entire screen (via mobile zone mode), making a fullscreen modal redundant. The inline format toolbar, textarea, and all actions are directly accessible.

---

## 20. Dirty State / Save Integration

### 20.1 Marking Unsaved
- The textarea has a generic `input` event listener (wired in `editor-init.js`) that calls `setSaveButtonUnsaved()` on any change
- Format toolbar actions dispatch an `input` event on the textarea after modifying content
- `_noteToChecklistFromHeader` explicitly calls `setSaveButtonUnsaved()`
- `_insertChitLink` calls `markEditorUnsaved()`

### 20.2 Save Flow
When the chit is saved, the value of `document.getElementById('note').value` is sent as the `note` field in the chit JSON payload to the API.

---

## 21. ESC Key Chain (Notes-Specific Steps)

The ESC key handler processes notes-related states in this order within the full chain:

1. **Notes More Menu open** → Close it (`_closeNotesMoreMenu()`)
2. **Notes Modal open** (desktop only) → Close with save (`closeNotesModal(true)`)
3. **Textarea visible in edit mode with content** → Switch to rendered mode (`toggleNotesViewMode()`)
4. **Textarea focused** → Blur it (generic input blur step)
5. **No modals, no focused inputs** → Exit page (with unsaved changes check)

---

## 22. Mobile Navigation Context

### 22.1 Zone Order Position
Notes is zone index 3 (0-indexed) in the visible zones list:
```
0: Overview (title)
1: Dates & Times
2: Task
3: Notes        ← here
4: Checklist
5: Tags
6: People
7: Location
8: Alerts
9: Projects
10: Color
11: Indicators
12: Attachments
13: Email (if visible)
14: Habits (if visible)
```

### 22.2 Starting Zone
If the user came from the "Notes" tab on the dashboard, the editor starts on the Notes zone:
```js
var _mobileTabZoneMap = {
  'Notes': 'notesSection',
  // ...
};
```

### 22.3 Swipe Navigation
- **Swipe left on zone header** → Next zone (Checklist)
- **Swipe right on zone header** → Previous zone (Task)
- **Swipe left on zone body** → Actions sidebar (exit/save controls)
- **Swipe right on zone body** → Zone list overlay

---

## 23. CSS Variables Used

The notes zone uses these CSS custom properties (defined in `styles-variables.css`):

| Variable | Typical Value | Usage |
|----------|---------------|-------|
| `--button-bg` | `#d4c5a9` | Toolbar button background |
| `--button-hover` | `#c4b599` | Toolbar button hover |
| `--accent-teal` | `#008080` | Undo/redo button background |
| `--parchment-light` | `#fdf5e6` | More menu background |
| `--aged-brown-medium` | `#8b5a2b` | More menu border |
| `--aged-brown-dark` | darker brown | Zone title color |
| `--text-color` | `#1a1208` | General text |
| `--input-bg` | `#fdf5e6` | Textarea background |
| `--border-color` | brown tone | Textarea border |
| `--zone-header-bg` | light parchment | Zone header background |
| `--info-blue` | blue tone | Location buttons (not notes) |

---

## 24. Font Stack

All text in the notes zone uses:
```css
font-family: 'Lora', Georgia, serif;
```
Lora is a self-hosted variable font loaded from `static/fonts/lora/`.

---

## 25. Accessibility Notes

- All toolbar buttons have `title` attributes describing their function and keyboard shortcut
- The rendered output has `title="Double-click to edit"` for discoverability
- Minimum font size is 16px on mobile (prevents iOS auto-zoom on focus)
- Touch targets on mobile are minimum 32px wide (toolbar buttons) and 44px for general inputs
- The format toolbar wraps (`flex-wrap: wrap`) to accommodate narrow viewports

---

## 26. Complete Function Reference

| Function | File | Purpose |
|----------|------|---------|
| `autoGrowNote(el)` | editor-notes.js | Auto-resize textarea to fit content |
| `_notesListContinue(textarea)` | editor-notes.js | Enter key list continuation |
| `_notesRenumberOrderedList(textarea, fromPos)` | editor-notes.js | Renumber ordered list after insertion |
| `_notesUndo(e)` | editor-notes.js | Browser native undo |
| `_notesRedo(e)` | editor-notes.js | Browser native redo |
| `_toggleNotesMoreMenu(e)` | editor-notes.js | Toggle data actions menu |
| `_closeNotesMoreMenu()` | editor-notes.js | Close data actions menu |
| `shrinkNoteToFourLines(event)` | editor-notes.js | Collapse textarea to 4 lines height |
| `_setNotesRenderToggleLabel(isRendered, source)` | editor-notes.js | Update render button icon/text |
| `toggleNotesViewMode(event)` | editor-notes.js | Switch between edit and rendered |
| `copyNotesToClipboard(event, source)` | editor-notes.js | Copy note text to clipboard |
| `downloadNotes(event, source)` | editor-notes.js | Download note as .md file |
| `openNotesModal(event)` | editor-notes.js | Open fullscreen modal (no-op on mobile) |
| `closeNotesModal(save)` | editor-notes.js | Close modal, optionally save back |
| `_getContentEditableText(el)` | editor-notes.js | Extract plain text from contenteditable |
| `toggleModalNotesRender()` | editor-notes.js | Toggle render in modal (desktop only) |
| `_switchNotesModalMode(mode)` | editor-notes.js | Switch modal between edit/render and live preview |
| `_notesFormatBtn(action)` | editor-notes.js | Apply format action to notes textarea |
| `_getNotesFormatAction(e)` | editor-notes.js | Detect keyboard shortcut → action |
| `_checkChitLinkAutocomplete(textarea)` | editor-notes.js | Check for `[[` and show dropdown |
| `_showChitLinkDropdown(textarea, matches)` | editor-notes.js | Render autocomplete dropdown |
| `_removeChitLinkDropdown()` | editor-notes.js | Remove autocomplete dropdown |
| `_insertChitLink(textarea, title)` | editor-notes.js | Insert selected chit link |
| `_emailFormatBtn(action, textareaId)` | editor-email.js | Shared markdown formatting engine |
| `_getEmailFormatAction(e)` | editor-email.js | Shared keyboard shortcut detection |
| `_noteToChecklistFromHeader(e)` | editor_checklists.js | Move note lines to checklist |
| `cwocWireLivePreview(textareaId, previewId)` | shared-utils.js | Wire live preview (desktop modal) |
| `cwocUpdateLivePreview(textareaId, previewId)` | shared-utils.js | Render live preview |
| `cwocToggleZone(event, sectionId, contentId)` | shared-editor.js | Generic zone collapse/expand |
| `toggleZone(event, sectionId, contentId)` | editor-init.js | Zone toggle (no-op on mobile) |

---

## 27. Data Flow Summary

```
User types in #note textarea
  → oninput: autoGrowNote() → resize + _checkChitLinkAutocomplete()
  → generic input listener: setSaveButtonUnsaved()
  → onkeydown: check format shortcuts → _notesFormatBtn()
  → onkeydown: check Enter → _notesListContinue()

User taps Render button
  → toggleNotesViewMode() → marked.parse() → show rendered div, hide textarea

User taps rendered output (double-click/double-tap)
  → toggleNotesViewMode() → show textarea, hide rendered div

User taps Data → Copy/Download/Send/Move
  → respective function operates on #note.value

User saves chit
  → #note.value sent as chit.note to POST/PUT /api/chits/:id
```

---

## 28. Differences from Desktop

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Fullscreen modal | Available via "Full Editor" button | Blocked (no-op) |
| Zone collapse | Click header to collapse/expand | Disabled (always expanded) |
| Navigation | Scroll to zone | Swipe between zones |
| Textarea height | Auto-grows to content | Fills viewport (`calc(100vh - 180px)`) |
| Format toolbar | Can be hidden in modal | Always visible inline |
| Live Preview mode | Available in modal (side-by-side) | Not available (modal blocked) |
| Blur behavior | Auto-renders on blur | Same (auto-renders on blur) |
| `.hideWhenNarrow` labels | Hidden on narrow viewports | Shown (forced `display: inline !important`) |
| Heading dropdown | Hover to open | Hover to open (works with long-press on touch) |
