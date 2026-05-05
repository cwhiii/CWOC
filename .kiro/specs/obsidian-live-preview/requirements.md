# Requirements Document

## Introduction

This document defines the requirements for the Obsidian-style Token-Level Live Preview feature in the CWOC chit editor. The feature provides an inline markdown editing experience where the entire note renders as formatted markdown except the specific inline token the cursor currently touches — that token reveals its raw markdown syntax. The system supports three cycling modes (Source, Live Preview, Reading), a format toolbar with keyboard shortcuts, and is reusable across both the Notes zone and Email body editor.

## Glossary

- **Live_Preview_Engine**: The core system that manages token-level rendering, cursor tracking, and inline editing within a contenteditable div
- **Tokenizer**: The component that splits a single line of markdown into an ordered array of token objects with raw source, rendered HTML, character offsets, and type classification
- **Line_Parser**: The component that identifies block-level prefixes (headings, lists, blockquotes, horizontal rules, checkboxes) and separates them from inline content
- **DOM_Builder**: The component that constructs the contenteditable DOM tree from parsed markdown, creating line divs and token spans
- **Cursor_Tracker**: The component that listens to browser selectionchange events and determines which token span the cursor currently occupies
- **Token_Activator**: The component that manages the visual swap between rendered HTML and raw markdown text for individual token spans
- **Mode_Controller**: The component that manages transitions between Source, Live Preview, and Reading modes
- **Format_Toolbar**: The UI component providing markdown formatting actions via buttons and keyboard shortcuts
- **Markdown_Extractor**: The component that reconstructs the full markdown string from the live preview DOM
- **Token_Span**: A `span.nlp-tok` DOM element representing a single inline markdown token, storing raw markdown in a `data-raw` attribute
- **Active_Token**: The token span currently showing raw markdown syntax because the cursor is inside it
- **Block_Prefix**: The leading syntax of a line that determines its block-level type (e.g., `#` for headings, `-` for bullets, `>` for quotes)

## Requirements

### Requirement 1: Token-Level Inline Tokenization

**User Story:** As a user editing markdown, I want the system to split each line into discrete inline tokens, so that individual formatting segments can be independently activated and deactivated.

#### Acceptance Criteria

1. WHEN a line of markdown is provided, THE Tokenizer SHALL split it into an ordered array of token objects each containing raw source, rendered HTML, start offset, end offset, and type classification
2. THE Tokenizer SHALL recognize bold (`**` only, never `__`), italic (`_` only, never `*`), inline code (`` ` ``), strikethrough (`~~`), links (`[text](url)`), images (`![alt](url)`), and chit links (`[[title]]`) as distinct token types
3. WHEN a line contains no formatting syntax, THE Tokenizer SHALL return a single plain-text token spanning the entire line
4. THE Tokenizer SHALL preserve character offsets so that each token's start and end positions map exactly to the original line string
5. WHEN adjacent formatting tokens exist (e.g., `**bold** _italic_`), THE Tokenizer SHALL produce separate token objects for each with correct boundaries

### Requirement 2: Block-Level Line Parsing

**User Story:** As a user writing structured markdown, I want headings, lists, blockquotes, checkboxes, and horizontal rules to be recognized, so that block-level formatting is preserved in live preview.

#### Acceptance Criteria

1. WHEN a line begins with a heading prefix (`#` through `######`), THE Line_Parser SHALL classify it as a heading with the correct level and tokenize the remaining inline content
2. WHEN a line begins with a bullet marker (`-`, `*`, `+`), THE Line_Parser SHALL classify it as an unordered list item and preserve its indentation level
3. WHEN a line begins with a numbered marker (e.g., `1.`), THE Line_Parser SHALL classify it as an ordered list item and preserve its indentation level
4. WHEN a line begins with a checkbox marker (`- [ ]` or `- [x]`), THE Line_Parser SHALL classify it as a checkbox item with the correct checked/unchecked state
5. WHEN a line begins with a blockquote marker (`>`), THE Line_Parser SHALL classify it as a blockquote and tokenize the remaining inline content
6. WHEN a line matches a horizontal rule pattern (`---`, `***`, `___`), THE Line_Parser SHALL classify it as a horizontal rule
7. WHEN a line has no block-level prefix, THE Line_Parser SHALL classify it as a plain paragraph and tokenize its full content

### Requirement 3: DOM Construction from Parsed Markdown

**User Story:** As a user entering live preview mode, I want the markdown to be rendered as a structured DOM with individually addressable token spans, so that cursor-based activation works correctly.

#### Acceptance Criteria

1. WHEN building the live preview DOM, THE DOM_Builder SHALL create one `div.nlp-line` element per line with a `data-line-idx` attribute and a `data-raw` attribute containing the original line text
2. WHEN building a line element, THE DOM_Builder SHALL create one `span.nlp-tok` element per token with a `data-raw` attribute storing the token's raw markdown and innerHTML set to the rendered HTML
3. WHEN a line is empty, THE DOM_Builder SHALL insert a `<br>` element inside the line div to maintain editability
4. WHEN a line has a block-level classification, THE DOM_Builder SHALL apply appropriate CSS classes for visual styling (heading sizes, list indentation, quote borders)
5. THE DOM_Builder SHALL sanitize all rendered HTML content to prevent XSS injection

### Requirement 4: Cursor Tracking and Token Activation

**User Story:** As a user moving my cursor through formatted text, I want only the token under my cursor to reveal its raw markdown syntax, so that I can edit formatting inline without switching modes.

#### Acceptance Criteria

1. WHEN the cursor moves into a token span, THE Cursor_Tracker SHALL identify that span as the new active token
2. WHEN a new active token is identified, THE Token_Activator SHALL replace the token span's rendered HTML with its raw markdown text and add the `.nlp-active` CSS class
3. WHEN the cursor leaves a previously active token, THE Token_Activator SHALL save the current text content back to `data-raw`, re-tokenize it, and restore rendered HTML
4. WHEN the cursor moves to a different token, THE Live_Preview_Engine SHALL deactivate the previous token before activating the new token
5. WHEN the cursor is positioned in whitespace between tokens or in a block prefix area, THE Cursor_Tracker SHALL deactivate any currently active token without activating a new one
6. WHEN the cursor remains within the same token span, THE Cursor_Tracker SHALL perform no activation or deactivation operations

### Requirement 5: Token Deactivation with Re-tokenization

**User Story:** As a user who has edited a token's raw markdown, I want the system to correctly re-parse my edits when I move away, so that new formatting is immediately rendered.

#### Acceptance Criteria

1. WHEN a token is deactivated and its edited text produces a single token on re-tokenization, THE Token_Activator SHALL update the span's innerHTML with the newly rendered HTML
2. WHEN a token is deactivated and its edited text produces multiple tokens on re-tokenization, THE Token_Activator SHALL trigger a full rebuild of the containing line element
3. WHEN a token is deactivated and its edited text contains no valid formatting, THE Token_Activator SHALL render it as a plain text token
4. WHEN a line is rebuilt after token splitting, THE DOM_Builder SHALL preserve the line's position and update its `data-raw` attribute

### Requirement 6: Three-Mode Cycling

**User Story:** As a user, I want to cycle between Source, Live Preview, and Reading modes, so that I can choose the editing experience appropriate to my current task.

#### Acceptance Criteria

1. WHEN the user activates the mode toggle, THE Mode_Controller SHALL cycle through modes in the order Source → Live Preview → Reading → Source
2. WHEN transitioning from Source to Live Preview, THE Mode_Controller SHALL read the textarea value, build the live preview DOM from it, and display the contenteditable div
3. WHEN transitioning from Live Preview to Reading, THE Mode_Controller SHALL extract markdown from the live preview DOM back to the textarea, then render full HTML via marked.js in a non-editable div
4. WHEN transitioning from Reading to Source, THE Mode_Controller SHALL hide the reading div and display the textarea with its current value
5. THE Mode_Controller SHALL preserve markdown content exactly across all mode transitions without data loss
6. WHEN in Reading mode, THE Mode_Controller SHALL prevent editing of the displayed content

### Requirement 7: Format Toolbar and Keyboard Shortcuts

**User Story:** As a user, I want a formatting toolbar and keyboard shortcuts for common markdown operations, so that I can apply formatting without memorizing syntax.

#### Acceptance Criteria

1. THE Format_Toolbar SHALL provide buttons for bold, italic, strikethrough, inline code, link, headings (H1-H3), unordered list, ordered list, blockquote, and horizontal rule
2. WHEN a format action is triggered in Source mode, THE Format_Toolbar SHALL wrap the selected text in the textarea with the appropriate markdown syntax characters
3. WHEN a format action is triggered in Live Preview mode, THE Format_Toolbar SHALL apply the formatting to the active token's raw text and rebuild the affected line
4. THE Format_Toolbar SHALL support keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link), Ctrl+E (code), Ctrl+Shift+X (strikethrough), Ctrl+Shift+1/2/3 (H1/H2/H3), Ctrl+Shift+7 (ordered list), Ctrl+Shift+8 (unordered list), Ctrl+Shift+. (blockquote), Ctrl+Shift+- (horizontal rule)
5. WHEN in Reading mode, THE Format_Toolbar SHALL be hidden
6. WHEN in Source or Live Preview mode, THE Format_Toolbar SHALL be visible

### Requirement 8: Input Handling in Live Preview

**User Story:** As a user editing in live preview mode, I want Enter, Backspace, and paste to behave predictably, so that line-level operations work correctly within the contenteditable environment.

#### Acceptance Criteria

1. WHEN the user presses Enter in live preview mode, THE Live_Preview_Engine SHALL split the current line at the cursor position and create a new line element below
2. WHEN the user presses Backspace at the start of a line in live preview mode, THE Live_Preview_Engine SHALL merge the current line with the previous line
3. WHEN the user pastes content into the live preview, THE Live_Preview_Engine SHALL intercept the paste event, extract plain text only, and insert it at the cursor position
4. WHEN any edit occurs in live preview mode, THE Live_Preview_Engine SHALL mark the document as unsaved

### Requirement 9: Markdown Extraction from Live Preview DOM

**User Story:** As a user saving or switching modes, I want the system to accurately reconstruct my markdown from the live preview DOM, so that no content is lost.

#### Acceptance Criteria

1. WHEN extracting markdown, THE Markdown_Extractor SHALL iterate all line elements and reconstruct each line from its token `data-raw` attributes
2. WHEN the active token is encountered during extraction, THE Markdown_Extractor SHALL read its current textContent instead of `data-raw` to capture in-progress edits
3. WHEN extraction is complete, THE Markdown_Extractor SHALL sync the result back to the hidden textarea
4. FOR ALL valid markdown content, extracting from the live preview DOM after building it SHALL produce content equivalent to the original input (round-trip property)

### Requirement 10: Email Body Live Preview Reuse

**User Story:** As a user composing emails, I want the same token-level live preview experience in the email body editor, so that I have a consistent markdown editing experience across the application.

#### Acceptance Criteria

1. THE Live_Preview_Engine SHALL be reusable across both the Notes zone and the Email body editor without code duplication
2. WHEN the email body mode toggle is activated, THE Mode_Controller SHALL cycle through the same three modes (Source → Live Preview → Reading) for the email body
3. THE Email body live preview SHALL operate independently from the Notes live preview (separate state, separate active token tracking)
4. WHEN the email expand modal is open, THE Email body live preview SHALL function correctly within the modal context

### Requirement 11: Security and Sanitization

**User Story:** As a user, I want the live preview to be safe from script injection, so that pasted or typed content cannot execute malicious code.

#### Acceptance Criteria

1. WHEN rendering token HTML in live preview mode, THE DOM_Builder SHALL sanitize output using DOMPurify or equivalent escaping
2. WHEN rendering full HTML in Reading mode, THE Mode_Controller SHALL pass the output through DOMPurify before inserting into the DOM
3. WHEN rendering link tokens, THE DOM_Builder SHALL add `rel="noopener noreferrer"` to all anchor elements
4. WHEN pasting content, THE Live_Preview_Engine SHALL strip all HTML and insert only plain text

### Requirement 12: Error Handling and Graceful Degradation

**User Story:** As a user, I want the editor to remain functional even when unexpected conditions occur, so that I never lose my work.

#### Acceptance Criteria

1. IF marked.js fails to load from CDN, THEN THE Live_Preview_Engine SHALL fall back to plain text display with HTML escaping
2. IF the DOM state becomes desynchronized from `data-raw` attributes, THEN THE Markdown_Extractor SHALL reconcile by reading directly from DOM text content on mode switch
3. IF a token edit produces invalid or unmatched markdown delimiters, THEN THE Token_Activator SHALL render the content as plain text without error
4. IF the cursor is positioned in an area with no identifiable token ancestor, THEN THE Cursor_Tracker SHALL gracefully deactivate any active token and continue normal operation

### Requirement 13: Mobile and Touch Support

**User Story:** As a mobile user, I want the live preview to respond correctly to touch interactions, so that I can edit markdown on my phone or tablet.

#### Acceptance Criteria

1. WHEN a user taps within a token on a touch device, THE Cursor_Tracker SHALL activate that token the same as a click on desktop
2. THE Format_Toolbar SHALL be accessible and usable on mobile screen sizes
3. WHEN in live preview mode on mobile, THE Live_Preview_Engine SHALL handle virtual keyboard appearance without losing cursor position or active token state
