# Requirements Document

## Introduction

This document specifies every requirement for making the Android app's "Notes" zone in the chit editor visually and functionally identical to the mobile browser version. The authoritative reference is `Tasks/mobile-browser-notes-zone-spec.md`. After implementation, a user must not be able to distinguish whether they are using the mobile browser or the Android app. Every layout, color, font, spacing, border, interaction, state transition, and behavioral rule must match exactly. No detail is too small to omit.

## Glossary

- **Notes_Zone**: The "Notes" section of the chit editor (`#notesSection`), containing the zone container, zone header with action buttons, zone body with format toolbar, textarea, and rendered output
- **Zone_Container**: The outer wrapper element with background `#fff8dc`, no border-radius, no left/right borders, full width, flex 1, min-height 0 in mobile zone mode
- **Zone_Header**: The header area showing the zone title "📝 Notes", action buttons (Full Editor, Data, Render), and toggle icon
- **Zone_Body**: The content area containing the format toolbar and the textarea/rendered output, with flex column layout
- **Format_Toolbar**: The inline toolbar (`#notesFormatToolbar`) containing 12 formatting buttons, always visible in mobile zone mode
- **Textarea**: The `#note` textarea element that fills available vertical space, auto-grows on input, and supports markdown editing
- **Rendered_Output**: The `#notes-rendered-output` div that displays parsed markdown when in render mode
- **Full_Editor_Button**: The "Full Editor" zone-button that is a no-op on mobile (modal is blocked)
- **Data_Menu_Button**: The "Data" zone-button that toggles the more-actions dropdown menu
- **More_Menu**: The `#notesMoreMenu` dropdown containing Copy, Download, Send, and Move to Checklist actions
- **Render_Toggle_Button**: The zone-button that switches between edit mode (textarea) and render mode (rendered markdown)
- **Chit_Link_Autocomplete**: The `[[` triggered autocomplete dropdown that shows matching chit titles for insertion as `[[Title]]` links
- **List_Continuation**: The Enter key behavior that auto-continues bullet lists, numbered lists, checkboxes, and blockquotes with auto-increment and break-out
- **Markdown_Renderer**: The marked.js equivalent rendering engine with GFM breaks enabled and `==highlight==` extension support
- **Undo_Redo**: The undo/redo system using toolbar buttons (↺/↻) that leverages the platform's native text undo stack
- **Parchment_Theme**: The CWOC visual theme using Lora serif font, brown tones, parchment backgrounds (`#fff8dc`, `#fff8e1`, `#fffaf0`), borders `#8b4513`, and 1940s aesthetic
- **Mobile_Zone_Mode**: The layout mode (viewport ≤768px equivalent) where zones fill full width, navigation handled by zone nav bar, and the fullscreen modal is blocked
- **Zone_Button**: A styled button with padding 5dp 10dp, font-size 12sp, background `#a0522d`, color `#fdf5e6`, border 1px outset `#8b4513`, white-space nowrap
- **Heading_Dropdown**: The "H ▾" toolbar button that reveals H1/H2/H3 sub-options on tap/long-press
- **ESC_Chain**: The layered escape/back-button behavior: close menus → switch to render mode → exit zone
- **Auto_Render**: The behavior where the textarea automatically switches to rendered markdown on blur (losing focus) and on initial load when content exists

## Requirements

### Requirement 1: Zone Container and Layout Structure

**User Story:** As a user, I want the Notes zone container on Android to have the exact same structure, background, borders, and flex layout as the mobile browser, so that the zone framing is indistinguishable.

#### Acceptance Criteria

1. THE Notes_Zone SHALL render with background `#fff8dc`, no border-radius, no left border, no right border, full width, flex 1, and min-height 0
2. THE Zone_Header SHALL render as a flex row containing the zone title "📝 Notes", the zone actions row (Full_Editor_Button, Data_Menu_Button, spacer, Render_Toggle_Button), and the toggle icon "🔼"
3. THE Zone_Header SHALL use justify-content flex-start with the zone title having flex-shrink 0 and flex-grow 0
4. THE zone actions container SHALL use flex 1, margin-left 1em, and pointer-events none on the container with pointer-events auto on child elements
5. THE Zone_Body SHALL render with display flex, flex-direction column, and fill all available vertical space below the header
6. THE Zone_Body content area (`.field.full-width`) SHALL use flex 1, display flex, flex-direction column so the textarea fills remaining space
7. THE Notes_Zone SHALL NOT support collapsed state in Mobile_Zone_Mode (tapping the header does nothing, toggle icon always shows "🔼")
8. THE zone toggle icon SHALL render with margin-left 1em after the zone actions

### Requirement 2: Zone Header Buttons

**User Story:** As a user, I want the Notes zone header on Android to show the same three action buttons (Full Editor, Data, Render) with the same icons, labels, positioning, and behavior as the mobile browser.

#### Acceptance Criteria

1. THE Full_Editor_Button SHALL render with icon `fa-expand` and text label "Full Editor", styled as a Zone_Button with class `notes-left-btn`
2. WHEN the Full_Editor_Button is tapped, THE Notes_Zone SHALL do nothing (no-op) — the fullscreen modal is blocked on mobile
3. THE Data_Menu_Button SHALL render with icon `fa-ellipsis-v` and text label "Data", styled as a Zone_Button with class `notes-left-btn`
4. WHEN the Data_Menu_Button is tapped, THE Notes_Zone SHALL toggle the More_Menu dropdown visibility
5. THE Render_Toggle_Button SHALL render on the right side of the header (pushed by a flex spacer) with icon `fa-eye` and text label "Render" in edit mode
6. WHEN in render mode, THE Render_Toggle_Button SHALL display icon `fa-edit` and text label "Edit"
7. WHEN the Render_Toggle_Button is tapped, THE Notes_Zone SHALL call the render toggle logic to switch between edit and render modes
8. ALL button text labels (`.hideWhenNarrow` spans) SHALL be visible on mobile (display inline, not hidden)

### Requirement 3: Data Menu (More Menu)

**User Story:** As a user, I want the Data menu on Android to show the same four actions with the same icons, labels, styling, and dismissal behavior as the mobile browser.

#### Acceptance Criteria

1. THE More_Menu SHALL render as an absolutely-positioned dropdown below the Data_Menu_Button with background `var(--parchment-light, #fdf5e6)`, border 2dp solid `var(--aged-brown-medium, #8b5a2b)`, border-radius 6dp, box-shadow 0 4dp 12dp rgba(0, 0, 0, 0.2), padding 6dp 0, min-width 200dp, and flex-direction column
2. THE More_Menu SHALL contain exactly four buttons in this order: "Copy to clipboard" (fa-clipboard), "Download as file" (fa-download), "Send to another chit" (fa-paper-plane), "Move to checklist" (fa-arrow-right)
3. EACH More_Menu button SHALL render with display flex, align-items center, gap 8dp, width 100%, padding 8dp 14dp, no border, no background, font-family Lora, font-size 0.9em, color `var(--text-color, #1a1208)`, text-align left, white-space nowrap
4. EACH More_Menu button icon SHALL have width 18dp, text-align center, and flex-shrink 0
5. WHEN a More_Menu button is pressed/hovered, THE button SHALL show background rgba(139, 90, 43, 0.1)
6. WHEN the user taps outside the More_Menu, THE More_Menu SHALL close (dismiss on outside tap)
7. WHEN the back button or ESC equivalent is pressed while the More_Menu is open, THE More_Menu SHALL close before any other action fires
8. THE More_Menu SHALL display a mobile backdrop element behind it to block interaction and dismiss on tap
9. THE More_Menu SHALL default to hidden (display none) and toggle to display flex when opened

### Requirement 4: Format Toolbar Layout and Visibility

**User Story:** As a user, I want the format toolbar on Android to always be visible inline with the same flex-wrap layout, background, border, padding, and gap as the mobile browser.

#### Acceptance Criteria

1. THE Format_Toolbar SHALL render with display flex, flex-wrap wrap, align-items center, gap 2dp (mobile override), padding 4dp (mobile override)
2. THE Format_Toolbar SHALL have background rgba(139, 90, 43, 0.06), border 1dp solid rgba(139, 90, 43, 0.15), border-radius 4dp, and margin-bottom 6dp
3. THE Format_Toolbar SHALL always be visible in Mobile_Zone_Mode (never hidden, equivalent to `display: flex !important`)
4. WHEN in render mode, THE Format_Toolbar SHALL be hidden (display none)
5. WHEN switching back to edit mode, THE Format_Toolbar SHALL become visible again
6. THE Format_Toolbar SHALL contain a visual separator (1dp wide, 20dp tall, brown line) between the Link button and the Heading dropdown
7. THE Format_Toolbar SHALL contain a flex spacer (flex 1) between the Horizontal Rule button and the Undo button, pushing Undo/Redo to the right

### Requirement 5: Format Toolbar Buttons

**User Story:** As a user, I want all 12 format toolbar buttons on Android to have the exact same labels, order, styling, and tap targets as the mobile browser.

#### Acceptance Criteria

1. THE Format_Toolbar SHALL contain exactly 12 buttons in this order: Bold (**B**), Italic (*I*), Strikethrough (~~S~~), Link (🔗), Heading dropdown (H ▾), Bullet List (• List), Numbered List (1. List), Blockquote (❝ Quote), Code (⟨⟩), Horizontal Rule (―), Undo (↺), Redo (↻)
2. EACH normal formatting button SHALL render with background `var(--button-bg, #d4c5a9)`, border 1dp solid rgba(139, 90, 43, 0.3), border-radius 3dp, padding 6dp 8dp (mobile override), font-size 0.8em (mobile override), min-width 32dp (mobile override), and color `#2a1a0a`
3. THE Undo and Redo buttons (`.notes-undo-redo`) SHALL render with background `var(--accent-teal, #008080)`, color `#fff`, and border-color rgba(0, 100, 100, 0.5) — teal colored to distinguish from formatting buttons
4. THE Heading_Dropdown trigger button SHALL display "H ▾" and reveal a sub-menu with H1, H2, H3 options on tap
5. THE Heading_Dropdown menu SHALL render with background `#fff8e1`, border 1dp solid rgba(139, 90, 43, 0.3), border-radius 4dp, box-shadow 0 2dp 8dp rgba(0, 0, 0, 0.15), padding 4dp, positioned absolutely below the trigger
6. THE H1 option SHALL render with font-size 1.2em and font-weight bold; H2 with font-size 1.05em and font-weight bold; H3 with font-size 0.95em and font-weight bold
7. ALL toolbar buttons SHALL have title attributes describing their function (e.g., "Bold (Cmd+B)")

### Requirement 6: Format Actions (Markdown Insertion)

**User Story:** As a user, I want each format button on Android to insert or wrap markdown syntax in the textarea identically to the mobile browser's formatting engine.

#### Acceptance Criteria

1. WHEN the Bold button is tapped, THE Notes_Zone SHALL wrap the selected text in `**...**`
2. WHEN the Italic button is tapped, THE Notes_Zone SHALL wrap the selected text in `_..._`
3. WHEN the Strikethrough button is tapped, THE Notes_Zone SHALL wrap the selected text in `~~...~~`
4. WHEN the Link button is tapped with a URL selected, THE Notes_Zone SHALL format as `[link text](selection)` and select "link text" for editing; otherwise format as `[selection](url)` and select "url" for editing
5. WHEN the H1 button is tapped, THE Notes_Zone SHALL prefix the current line with `# ` (stripping any existing `#` prefixes first)
6. WHEN the H2 button is tapped, THE Notes_Zone SHALL prefix the current line with `## ` (stripping any existing `#` prefixes first)
7. WHEN the H3 button is tapped, THE Notes_Zone SHALL prefix the current line with `### ` (stripping any existing `#` prefixes first)
8. WHEN the Bullet List button is tapped, THE Notes_Zone SHALL prefix each selected line with `- `; if no selection, prefix the current line
9. WHEN the Numbered List button is tapped, THE Notes_Zone SHALL prefix each selected line with sequential numbers (`1. `, `2. `, etc.); if no selection, prefix the current line with `1. `
10. WHEN the Blockquote button is tapped, THE Notes_Zone SHALL prefix each selected line with `> `
11. WHEN the Code button is tapped, THE Notes_Zone SHALL wrap the selected text in single backticks
12. WHEN the Horizontal Rule button is tapped, THE Notes_Zone SHALL insert `\n---\n` at the cursor position
13. WHEN any format action is applied while in render mode, THE Notes_Zone SHALL switch to edit mode first, then apply the formatting
14. AFTER any format action is applied, THE Notes_Zone SHALL trigger auto-grow and mark the editor as unsaved

### Requirement 7: Textarea Layout and Auto-Grow

**User Story:** As a user, I want the textarea on Android to fill all available vertical space below the format toolbar and auto-grow to fit content, exactly like the mobile browser.

#### Acceptance Criteria

1. THE Textarea SHALL render with flex 1, min-height equivalent to `calc(100vh - 180dp)`, height auto, resize none, width 100%, and box-sizing border-box
2. THE Textarea SHALL use font-size 16sp (prevents zoom on focus), font-family Lora, and max-width 100%
3. THE Textarea SHALL use background `var(--input-bg, #fdf5e6)` and border color `var(--border-color)` matching the Parchment_Theme
4. WHEN text is entered, THE Textarea SHALL auto-grow to fit content by measuring scroll height, capping at viewport height, with a minimum height of 48dp
5. WHEN content exceeds viewport height, THE Textarea SHALL show vertical scrollbar (overflow-y auto); otherwise overflow-y shall be hidden
6. THE Textarea SHALL fill all available vertical space below the format toolbar in Mobile_Zone_Mode regardless of content length
7. WHEN the textarea is empty, THE Textarea SHALL still maintain the full-height layout (min-height calc(100vh - 180dp))

### Requirement 8: Markdown Rendering

**User Story:** As a user, I want the rendered markdown output on Android to support the same GFM features, line break behavior, and highlight extension as the mobile browser's marked.js rendering.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL support all standard GFM features: headings, bold, italic, strikethrough, links, images, inline code, fenced code blocks, blockquotes, ordered lists, unordered lists, horizontal rules, and tables
2. THE Markdown_Renderer SHALL treat single newlines as `<br>` elements (GFM breaks mode enabled)
3. THE Markdown_Renderer SHALL support the `==text==` highlight extension, rendering it as `<mark>text</mark>`
4. THE Rendered_Output SHALL render with overflow-wrap break-word, word-break break-word, max-width 100%, cursor pointer, min-height 4em, and padding 0.5em
5. WHEN the Rendered_Output is double-tapped, THE Notes_Zone SHALL switch back to edit mode
6. THE Rendered_Output SHALL have title "Double-click to edit" for discoverability
7. IF the markdown rendering library is unavailable, THE Notes_Zone SHALL display content in a preformatted block with white-space pre-wrap as a fallback
8. THE Rendered_Output SHALL NOT resolve `[[Title]]` chit links into clickable links (raw text renders as-is in the editor's rendered view)

### Requirement 9: Render Toggle Behavior

**User Story:** As a user, I want the render toggle on Android to switch between edit and rendered modes with the same state transitions, auto-render on blur, and auto-render on load as the mobile browser.

#### Acceptance Criteria

1. WHEN switching from edit to render mode, THE Notes_Zone SHALL hide the textarea, render markdown content into the Rendered_Output div, show the Rendered_Output (display block), update the Render_Toggle_Button to show `fa-edit` icon and "Edit" label, and hide the Format_Toolbar
2. WHEN switching from render to edit mode, THE Notes_Zone SHALL hide the Rendered_Output (display none), show the textarea (display visible), update the Render_Toggle_Button to show `fa-eye` icon and "Render" label, show the Format_Toolbar, trigger auto-grow, and focus the textarea
3. WHEN the textarea loses focus (blur) and the blur target is NOT the Render_Toggle_Button and the textarea has content (trimmed), THE Notes_Zone SHALL automatically switch to render mode (Auto_Render)
4. WHEN a chit is loaded with existing note content (non-empty after trim), THE Notes_Zone SHALL start in render mode (auto-render on load with a brief delay)
5. WHEN a chit is loaded with no note content, THE Notes_Zone SHALL start in edit mode with the textarea visible
6. WHEN the Rendered_Output is double-tapped, THE Notes_Zone SHALL switch to edit mode
7. THE render toggle SHALL reset the parent field container height to auto before rendering

### Requirement 10: Enter Key List Continuation

**User Story:** As a user, I want pressing Enter in the textarea on Android to auto-continue list items (bullets, numbers, checkboxes, blockquotes) with auto-increment and break-out behavior identical to the mobile browser.

#### Acceptance Criteria

1. WHEN Enter is pressed (without Shift) on a line with content after a list prefix, THE Notes_Zone SHALL insert a newline followed by the appropriate continuation prefix
2. THE List_Continuation SHALL detect these prefixes via regex: `- `, `* `, `+ ` (bullets), `- [ ] `, `- [x] `, `- [X] ` (checkboxes), `1. `, `2) ` etc. (ordered lists with any number + `.` or `)`), and `> ` (blockquotes)
3. WHEN continuing a checkbox item, THE List_Continuation SHALL always insert an unchecked `[ ] ` prefix (never carry forward checked state)
4. WHEN continuing an ordered list item, THE List_Continuation SHALL increment the number by 1 (e.g., after `3. ` insert `4. `)
5. WHEN continuing a bullet or blockquote, THE List_Continuation SHALL insert the same prefix character
6. WHEN Enter is pressed on a line that contains ONLY the prefix (no content after it), THE List_Continuation SHALL remove the prefix from the current line (break out of the list)
7. THE List_Continuation SHALL preserve leading whitespace (indentation) from the current line and apply it to the continuation line
8. AFTER inserting a numbered list continuation, THE Notes_Zone SHALL renumber all subsequent consecutive ordered list items at the same indent level
9. AFTER list continuation fires, THE Notes_Zone SHALL trigger auto-grow and mark the editor as unsaved
10. THE List_Continuation SHALL only fire when Enter is pressed without Shift held

### Requirement 11: Chit Link Autocomplete

**User Story:** As a user, I want typing `[[` in the textarea on Android to trigger an autocomplete dropdown showing matching chit titles, with keyboard/tap navigation and insertion behavior identical to the mobile browser.

#### Acceptance Criteria

1. WHEN the user types `[[` followed by at least 1 character, THE Chit_Link_Autocomplete SHALL detect the unclosed `[[` pattern and show a dropdown of matching chit titles
2. THE Chit_Link_Autocomplete SHALL filter all chits whose title contains the query text (case-insensitive), excluding the currently-edited chit, showing up to 8 matches
3. THE dropdown SHALL render as a fixed-position element with z-index 9999, background `#fff8e1`, border 2dp solid `#8b4513`, border-radius 6dp, max-height 200dp, overflow-y auto, box-shadow 0 4dp 12dp rgba(0, 0, 0, 0.3), font-size 0.9em, and min-width 200dp
4. THE dropdown SHALL be positioned below the textarea (fixed below the textarea rect)
5. EACH dropdown item SHALL render with padding 6dp 10dp, cursor pointer, and border-bottom 1dp solid `#e0d4b5`
6. THE first item SHALL be highlighted with background `#f0e6d0`; tapping or pressing Enter on a highlighted item SHALL insert it
7. THE user SHALL be able to navigate items with ArrowDown/ArrowUp keys, with the highlight moving between items and scrolling into view
8. WHEN a chit title is selected (via tap or Enter), THE Chit_Link_Autocomplete SHALL replace text from `[[` to cursor with `[[title]]`, position cursor after the closing `]]`, focus the textarea, remove the dropdown, and mark the editor as unsaved
9. THE dropdown SHALL be dismissed when: `]]` is typed (closing the link), cursor moves before the `[[`, Escape/back is pressed, or a selection is made
10. THE Chit_Link_Autocomplete SHALL fetch all chit titles from the API (cached after first fetch) for filtering

### Requirement 12: Undo and Redo

**User Story:** As a user, I want the Undo and Redo toolbar buttons on Android to use the platform's native text undo stack, matching the mobile browser's behavior.

#### Acceptance Criteria

1. WHEN the Undo button (↺) is tapped, THE Notes_Zone SHALL focus the textarea and invoke the platform's native undo operation
2. WHEN the Redo button (↻) is tapped, THE Notes_Zone SHALL focus the textarea and invoke the platform's native redo operation
3. THE Undo and Redo buttons SHALL stop event propagation and prevent default behavior when tapped
4. THE native undo stack SHALL track all text changes made through user input and programmatic text modifications
5. THE Undo and Redo buttons SHALL be visually distinct from formatting buttons using teal styling: background `var(--accent-teal, #008080)`, color `#fff`, border-color rgba(0, 100, 100, 0.5)

### Requirement 13: Copy to Clipboard

**User Story:** As a user, I want the "Copy to clipboard" action on Android to copy the raw note text to the system clipboard with visual feedback, identical to the mobile browser.

#### Acceptance Criteria

1. WHEN "Copy to clipboard" is tapped in the More_Menu, THE Notes_Zone SHALL copy the textarea's raw text value to the system clipboard
2. AFTER a successful copy, THE Notes_Zone SHALL show visual feedback (button text changes to "✅" for 1200ms, then reverts)
3. THE copy operation SHALL use the platform's clipboard API (equivalent to `navigator.clipboard.writeText`)
4. IF the primary clipboard API fails, THE Notes_Zone SHALL use a fallback mechanism to complete the copy
5. THE More_Menu SHALL close after the copy action is triggered

### Requirement 14: Download as File

**User Story:** As a user, I want the "Download as file" action on Android to save the note content as a `.md` file with a filename derived from the chit title, identical to the mobile browser.

#### Acceptance Criteria

1. WHEN "Download as file" is tapped in the More_Menu, THE Notes_Zone SHALL generate a file from the textarea's raw text value with MIME type `text/markdown`
2. THE filename SHALL be derived from the chit title: replace all non-alphanumeric characters with underscores, convert to lowercase, and append `.md` (fallback: `note.md` if no title)
3. THE Notes_Zone SHALL trigger a file download/save using the platform's file sharing or download mechanism
4. THE More_Menu SHALL close after the download action is triggered

### Requirement 15: Send to Another Chit

**User Story:** As a user, I want the "Send to another chit" action on Android to open a chit search/selection modal that appends the current note content to the selected chit's notes, identical to the mobile browser.

#### Acceptance Criteria

1. WHEN "Send to another chit" is tapped in the More_Menu, THE Notes_Zone SHALL open a modal allowing the user to search for and select another chit
2. THE modal SHALL allow searching chits by title with results displayed as a selectable list
3. WHEN a target chit is selected, THE Notes_Zone SHALL append the current note content to that chit's notes field via the API
4. THE More_Menu SHALL close after the send action is triggered
5. THE send modal SHALL follow the same shared send-content modal pattern used by other zones (e.g., checklist zone)

### Requirement 16: Move to Checklist

**User Story:** As a user, I want the "Move to checklist" action on Android to convert note lines into checklist items with the same parsing rules, indent detection, undo toast, and state clearing as the mobile browser.

#### Acceptance Criteria

1. WHEN "Move to checklist" is tapped in the More_Menu, THE Notes_Zone SHALL parse each non-empty line of the note into a checklist item
2. THE parsing SHALL recognize these line formats: `- [ ] ` and `- [x] ` (markdown checkboxes preserving checked state), `- `, `* `, `• ` (bullet prefixes stripped), `1. `, `2) ` etc. (numbered prefixes stripped), standalone `[x]` or `[ ]` at line start (legacy checkbox format)
3. THE parsing SHALL detect indentation: 4 spaces or 1 tab equals 1 indent level, 2 spaces equals 1 level, with a maximum indent level cap
4. AFTER conversion, THE Notes_Zone SHALL append new items to the existing checklist with parent-child relationships based on indent levels
5. AFTER conversion, THE Notes_Zone SHALL clear the textarea content, trigger auto-grow, mark the editor as unsaved, and clear the rendered output innerHTML if it was showing
6. AFTER conversion, THE Notes_Zone SHALL display an undo toast that allows reversing the operation (restoring both the note content and the previous checklist state)
7. THE More_Menu SHALL close after the move action is triggered

### Requirement 17: Keyboard Shortcuts

**User Story:** As a user, I want hardware keyboard shortcuts on Android to trigger the same format actions as the mobile browser's Cmd+key shortcuts, so that external keyboard users have the same experience.

#### Acceptance Criteria

1. WHEN Ctrl+B is pressed in the textarea, THE Notes_Zone SHALL trigger the Bold format action
2. WHEN Ctrl+I is pressed in the textarea, THE Notes_Zone SHALL trigger the Italic format action
3. WHEN Ctrl+K is pressed in the textarea, THE Notes_Zone SHALL trigger the Link format action
4. WHEN Ctrl+E is pressed in the textarea, THE Notes_Zone SHALL trigger the Code format action
5. WHEN Ctrl+Shift+X is pressed in the textarea, THE Notes_Zone SHALL trigger the Strikethrough format action
6. WHEN Ctrl+Shift+7 is pressed in the textarea, THE Notes_Zone SHALL trigger the Numbered List format action
7. WHEN Ctrl+Shift+8 is pressed in the textarea, THE Notes_Zone SHALL trigger the Bullet List format action
8. WHEN Ctrl+Shift+. is pressed in the textarea, THE Notes_Zone SHALL trigger the Blockquote format action
9. WHEN Ctrl+Shift+1 is pressed, THE Notes_Zone SHALL trigger the H1 format action; Ctrl+Shift+2 for H2; Ctrl+Shift+3 for H3
10. WHEN Ctrl+Shift+- is pressed in the textarea, THE Notes_Zone SHALL trigger the Horizontal Rule format action
11. WHEN a keyboard shortcut is detected, THE Notes_Zone SHALL prevent the default browser/system action for that key combination

### Requirement 18: ESC/Back Key Behavior Chain

**User Story:** As a user, I want the back button (or ESC with hardware keyboard) on Android to follow the same layered dismissal chain as the mobile browser: close menus first, then switch to render mode, then exit.

#### Acceptance Criteria

1. WHEN the back button is pressed and the More_Menu is open, THE Notes_Zone SHALL close the More_Menu and consume the event (no further action)
2. WHEN the back button is pressed and the Chit_Link_Autocomplete dropdown is open, THE Notes_Zone SHALL dismiss the dropdown and consume the event
3. WHEN the back button is pressed and the Heading_Dropdown menu is open, THE Notes_Zone SHALL close the dropdown and consume the event
4. WHEN the back button is pressed and the textarea is visible in edit mode with content, THE Notes_Zone SHALL switch to render mode and consume the event (not exit the zone)
5. WHEN the back button is pressed and no menus are open and the zone is in render mode (or textarea is empty), THE Notes_Zone SHALL allow normal back navigation (exit the editor with unsaved changes check)
6. THE ESC_Chain SHALL process in strict priority order: menus → dropdowns → edit-to-render → exit

### Requirement 19: Visual Styling and Parchment Theme

**User Story:** As a user, I want the Notes zone on Android to use the exact same colors, fonts, spacing, and parchment aesthetic as the mobile browser so the two are visually indistinguishable.

#### Acceptance Criteria

1. THE Notes_Zone SHALL use font-family Lora (serif) for all text elements including toolbar buttons, menu items, textarea, and rendered output
2. THE Notes_Zone SHALL use these CSS variable equivalents: `--button-bg: #d4c5a9`, `--button-hover: #c4b599`, `--accent-teal: #008080`, `--parchment-light: #fdf5e6`, `--aged-brown-medium: #8b5a2b`, `--text-color: #1a1208`, `--input-bg: #fdf5e6`, `--zone-header-bg: light parchment`
3. THE zone title "📝 Notes" SHALL render in the zone header with the standard zone title styling (brown color, Lora font)
4. THE textarea SHALL use background `#fdf5e6` (parchment light) with brown-toned border
5. THE Rendered_Output SHALL inherit the parchment background and use dark text color `#1a1208` for maximum readability
6. ALL touch targets SHALL be minimum 32dp wide (toolbar buttons) and 44dp for general interactive elements
7. THE Format_Toolbar SHALL wrap its buttons (flex-wrap) to accommodate narrow viewports without horizontal scrolling
8. THE zone container background SHALL be `#fff8dc` (cornsilk/parchment)

### Requirement 20: Fullscreen Modal Blocking

**User Story:** As a user, I want the fullscreen notes modal to be completely blocked on Android (same as mobile browser), with the zone itself filling the screen directly.

#### Acceptance Criteria

1. THE Notes_Zone SHALL block the fullscreen notes modal from ever appearing on mobile — the Full_Editor_Button tap handler SHALL return immediately without opening any modal
2. THE Notes_Zone SHALL fill the entire available screen space in Mobile_Zone_Mode, making a fullscreen modal redundant
3. THE Format_Toolbar, textarea, and all action buttons SHALL be directly accessible inline without needing a modal
4. THE Live Preview mode (side-by-side edit + rendered) SHALL NOT be available on mobile (it exists only in the desktop modal)

### Requirement 21: Dirty State and Save Integration

**User Story:** As a user, I want all text changes and format actions in the Notes zone on Android to mark the editor as unsaved, and the note content to be saved as the `note` field on the chit, identical to the mobile browser.

#### Acceptance Criteria

1. WHEN text is entered or modified in the textarea, THE Notes_Zone SHALL mark the editor as unsaved (dirty state)
2. WHEN any format toolbar action modifies the textarea content, THE Notes_Zone SHALL mark the editor as unsaved
3. WHEN a chit link is inserted via autocomplete, THE Notes_Zone SHALL mark the editor as unsaved
4. WHEN "Move to checklist" clears the textarea, THE Notes_Zone SHALL mark the editor as unsaved
5. WHEN the chit is saved, THE Notes_Zone SHALL send the textarea's raw text value as the `note` field in the chit JSON payload to the API
6. THE Notes_Zone SHALL load the `note` field from the chit data into the textarea when the editor opens

### Requirement 22: Zone Empty Detection

**User Story:** As a user, I want the mobile zone list on Android to correctly detect whether the Notes zone is empty (greyed out) or has content, identical to the mobile browser.

#### Acceptance Criteria

1. THE Notes_Zone SHALL report as "empty" when the textarea has no content after trimming whitespace
2. THE Notes_Zone SHALL report as "not empty" when the textarea has any non-whitespace content
3. THE zone list overlay SHALL display the Notes zone greyed out when it is empty and normal when it has content

### Requirement 23: Zone Navigation Context

**User Story:** As a user, I want the Notes zone on Android to be in the correct position in the zone order and respond to swipe navigation, identical to the mobile browser.

#### Acceptance Criteria

1. THE Notes_Zone SHALL be positioned as the 4th zone (index 3, zero-based) in the zone order: Overview, Dates & Times, Task, Notes, Checklist, Tags, People, Location, Alerts, Projects, Color, Indicators, Attachments
2. WHEN the user navigates from the dashboard "Notes" tab, THE editor SHALL start on the Notes zone directly
3. WHEN the user swipes left on the zone header, THE editor SHALL navigate to the next zone (Checklist)
4. WHEN the user swipes right on the zone header, THE editor SHALL navigate to the previous zone (Task)
5. WHEN the user swipes left on the zone body, THE editor SHALL show the actions sidebar
6. WHEN the user swipes right on the zone body, THE editor SHALL show the zone list overlay
