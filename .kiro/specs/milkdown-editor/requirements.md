# Requirements Document

## Introduction

This document defines the requirements for integrating Milkdown — a plugin-driven WYSIWYG markdown editor built on ProseMirror and Remark — into CWOC as the primary rich markdown editing experience. Milkdown replaces the current textarea + marked.js render-toggle approach in the chit editor's Notes zone and the fullscreen Notes modal, providing inline WYSIWYG editing where users see formatted output as they type while the underlying data remains standard markdown. The existing custom "Obsidian-style Token-Level Live Preview" spec is superseded by this integration.

Milkdown is self-hosted on the CWOC server — the configurator downloads ESM bundles during install/update to `/static/vendor/milkdown/`, and an import map in the HTML maps module specifiers to these local files. This eliminates runtime internet dependency and is compatible with CWOC's no-build-step architecture. The editor is themed to match CWOC's 1940s parchment aesthetic and integrates with the existing save system, chit link autocomplete, and mobile touch interactions.

## Glossary

- **Milkdown_Editor**: The Milkdown editor instance that provides WYSIWYG markdown editing within a container element
- **Editor_Loader**: The CWOC module responsible for loading Milkdown from CDN, initializing editor instances, and handling load failures
- **Theme_Layer**: The custom CSS and ProseMirror node view styling that adapts Milkdown's appearance to CWOC's parchment aesthetic
- **Content_Bridge**: The integration layer that syncs markdown content between Milkdown editor instances and CWOC's data model (the hidden textarea and save system)
- **Plugin_Set**: The collection of Milkdown plugins loaded for CWOC (commonmark, listener, history, etc.)
- **Chit_Link_Plugin**: A custom Milkdown plugin that provides `[[title]]` autocomplete for linking between chits
- **Import_Map**: The `<script type="importmap">` block in HTML that maps bare module specifiers to local static file paths for self-hosted Milkdown packages
- **Notes_Zone**: The collapsible notes editing area in the chit editor page
- **Notes_Modal**: The fullscreen modal for expanded note editing
- **Fallback_Mode**: The degraded editing experience (plain textarea) used when Milkdown fails to load
- **Configurator**: The `install/configurinator.sh` script that provisions the server, downloads vendor assets (including Milkdown ESM bundles), and handles updates

## Requirements

### Requirement 1: Self-Hosted Loading via Import Map

**User Story:** As a developer, I want Milkdown served from the local CWOC server using an import map, so that the no-build-step architecture is preserved, no npm/bundler tooling is required, and the editor works without runtime internet access.

#### Acceptance Criteria

1. THE Editor_Loader SHALL load Milkdown packages from local static files (`/static/vendor/milkdown/`) using a `<script type="importmap">` declaration in the HTML file
2. WHEN the page loads, THE Editor_Loader SHALL dynamically import Milkdown core modules using the mapped specifiers pointing to self-hosted ESM bundles
3. THE Import_Map SHALL reference specific pinned versions of all Milkdown packages stored locally on the server
4. THE Configurator SHALL download the required Milkdown ESM bundles from a CDN during install or update and place them in `/app/src/static/vendor/milkdown/`
5. WHEN Milkdown modules are loaded successfully, THE Editor_Loader SHALL resolve a ready state that other components can await before creating editor instances
6. IF the local Milkdown files fail to load, THEN THE Editor_Loader SHALL detect the failure within 5 seconds and activate Fallback_Mode

### Requirement 2: Editor Initialization and Lifecycle

**User Story:** As a user opening the chit editor, I want the Milkdown editor to initialize with my existing note content, so that I can immediately begin editing in WYSIWYG mode.

#### Acceptance Criteria

1. WHEN the chit editor page loads and Milkdown is ready, THE Editor_Loader SHALL create a Milkdown_Editor instance inside the Notes_Zone container with the chit's existing markdown content
2. WHEN the Notes_Modal is opened, THE Editor_Loader SHALL create a separate Milkdown_Editor instance inside the modal with the current note content
3. WHEN the Notes_Modal is closed with "Done," THE Content_Bridge SHALL sync the modal editor's markdown back to the Notes_Zone editor instance
4. WHEN the chit editor page is navigated away from, THE Editor_Loader SHALL destroy all active Milkdown_Editor instances to prevent memory leaks
5. THE Editor_Loader SHALL support multiple independent Milkdown_Editor instances on the same page without interference

### Requirement 3: Content Synchronization with Save System

**User Story:** As a user editing notes, I want my changes tracked by the existing save system, so that I see unsaved-change indicators and can save or discard edits normally.

#### Acceptance Criteria

1. WHEN the user modifies content in a Milkdown_Editor instance, THE Content_Bridge SHALL call `markEditorUnsaved()` to activate the save button indicators
2. WHEN the save action is triggered, THE Content_Bridge SHALL extract the current markdown string from the active Milkdown_Editor and write it to the hidden `#note` textarea before the save request is sent
3. THE Content_Bridge SHALL use Milkdown's listener plugin to detect content changes and update the hidden textarea on every edit
4. WHEN the editor page loads existing content, THE Content_Bridge SHALL set the Milkdown_Editor's initial document from the `#note` textarea value without triggering an unsaved-change state
5. FOR ALL valid markdown content, setting content into the Milkdown_Editor and then extracting it SHALL produce markdown equivalent to the original input (round-trip property)

### Requirement 4: Plugin Selection and Configuration

**User Story:** As a user, I want standard markdown features available in the editor, so that I can use headings, lists, bold, italic, links, code blocks, and other common formatting.

#### Acceptance Criteria

1. THE Plugin_Set SHALL include the commonmark preset providing headings (H1–H6), bold, italic, inline code, code blocks, blockquotes, ordered lists, unordered lists, links, images, horizontal rules, and paragraphs
2. THE Plugin_Set SHALL include the history plugin providing undo (Ctrl+Z / Cmd+Z) and redo (Ctrl+Shift+Z / Cmd+Shift+Z) functionality
3. THE Plugin_Set SHALL include the listener plugin for content change detection
4. THE Plugin_Set SHALL include clipboard handling that pastes plain text or markdown rather than rich HTML from external sources
5. WHEN a user pastes content from an external source, THE Milkdown_Editor SHALL strip HTML formatting and insert only the plain text or markdown equivalent

### Requirement 5: Custom Parchment Theme

**User Story:** As a user, I want the editor to match CWOC's visual theme, so that the editing experience feels cohesive with the rest of the application.

#### Acceptance Criteria

1. THE Theme_Layer SHALL style the Milkdown_Editor using CWOC's CSS variables (`--bg-color`, `--text-color`, `--accent-color`, font family Lora) defined in `shared-page.css`
2. THE Theme_Layer SHALL render headings, blockquotes, code blocks, and horizontal rules with styling consistent with CWOC's existing markdown output appearance
3. THE Theme_Layer SHALL ensure all editor text meets CWOC's contrast requirements (dark text on parchment background, minimum 14px font size)
4. THE Theme_Layer SHALL style the editor's focused state with a subtle border or shadow consistent with other CWOC input fields
5. THE Theme_Layer SHALL define styles in a dedicated CSS file (`editor-milkdown.css`) rather than using inline styles injected via JavaScript

### Requirement 6: Chit Link Autocomplete Plugin

**User Story:** As a user, I want to type `[[` to get autocomplete suggestions for linking to other chits, so that I can cross-reference chits within my notes.

#### Acceptance Criteria

1. WHEN the user types `[[` in the Milkdown_Editor, THE Chit_Link_Plugin SHALL display an autocomplete dropdown with matching chit titles
2. WHEN the user selects a chit from the dropdown, THE Chit_Link_Plugin SHALL insert `[[selected title]]` as the completed link text
3. THE Chit_Link_Plugin SHALL fetch chit titles from `/api/chits` and filter results based on the characters typed after `[[`
4. WHEN the user presses Escape while the autocomplete dropdown is visible, THE Chit_Link_Plugin SHALL close the dropdown without inserting text
5. THE Chit_Link_Plugin SHALL support keyboard navigation (Arrow Up, Arrow Down, Enter) within the autocomplete dropdown
6. THE Chit_Link_Plugin SHALL exclude the currently-edited chit from autocomplete results

### Requirement 7: Format Toolbar Integration

**User Story:** As a user, I want a formatting toolbar above the editor, so that I can apply markdown formatting without memorizing syntax.

#### Acceptance Criteria

1. THE Notes_Zone SHALL display a format toolbar above the Milkdown_Editor with buttons for bold, italic, strikethrough, link, headings (H1–H3), bullet list, numbered list, blockquote, inline code, and horizontal rule
2. WHEN a toolbar button is clicked, THE Milkdown_Editor SHALL execute the corresponding ProseMirror command to apply or toggle that formatting
3. THE format toolbar SHALL visually indicate which formatting is active at the current cursor position (e.g., bold button highlighted when cursor is in bold text)
4. THE format toolbar SHALL support the same keyboard shortcuts as the current implementation: Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic), Ctrl/Cmd+K (link), Ctrl/Cmd+E (code), Ctrl/Cmd+Shift+X (strikethrough)
5. WHEN the editor is in the Notes_Modal, THE format toolbar SHALL also be present and functional

### Requirement 8: Fallback Mode on Load Failure

**User Story:** As a user, I want to still be able to edit my notes if the CDN is unavailable, so that I never lose the ability to work with my content.

#### Acceptance Criteria

1. IF Milkdown fails to load from local static files, THEN THE Editor_Loader SHALL display the original textarea with the existing format toolbar as the editing interface
2. IF Milkdown fails to load, THEN THE Editor_Loader SHALL display a brief non-blocking notification informing the user that rich editing is unavailable
3. WHILE in Fallback_Mode, THE Content_Bridge SHALL continue to use the textarea value directly for save operations, identical to the pre-Milkdown behavior
4. WHEN Milkdown fails to load, THE Editor_Loader SHALL log the error to `console.error` with the specific failure reason
5. IF the Milkdown vendor files are missing from the server, THEN THE Configurator SHALL download them on the next update cycle

### Requirement 9: Mobile and Touch Support

**User Story:** As a mobile user, I want the Milkdown editor to be usable on touch devices, so that I can edit notes on my phone or tablet.

#### Acceptance Criteria

1. THE Milkdown_Editor SHALL be fully functional on mobile browsers (iOS Safari, Android Chrome) with touch input for cursor placement and text selection
2. THE format toolbar SHALL be scrollable horizontally on narrow screens rather than wrapping to multiple lines
3. WHEN the virtual keyboard appears on mobile, THE Milkdown_Editor SHALL remain visible and scrollable without the toolbar being obscured
4. THE Milkdown_Editor container SHALL have a minimum touch target height of 200px to ensure easy tap-to-focus on mobile

### Requirement 10: Security and Sanitization

**User Story:** As a user, I want the editor to be safe from script injection, so that pasted or typed content cannot execute malicious code.

#### Acceptance Criteria

1. THE Milkdown_Editor SHALL rely on ProseMirror's schema-based rendering which only produces DOM nodes defined in the document schema, preventing arbitrary HTML injection
2. WHEN rendering link nodes, THE Milkdown_Editor SHALL add `rel="noopener noreferrer"` and `target="_blank"` to anchor elements
3. WHEN content is pasted, THE Milkdown_Editor SHALL process it through the ProseMirror clipboard parser which strips elements not in the schema
4. THE Theme_Layer SHALL NOT use `innerHTML` with unsanitized content for any editor chrome or toolbar elements

### Requirement 11: Relationship to Existing Live Preview Spec

**User Story:** As a developer, I want clarity on what this integration replaces, so that there is no confusion about which editing approach is active.

#### Acceptance Criteria

1. WHEN the Milkdown_Editor is active, THE Notes_Zone SHALL NOT load or initialize the custom token-level live preview engine from `editor-notes-live-preview.js`
2. THE Editor_Loader SHALL fully replace the textarea + render-toggle pattern in the Notes_Zone with the Milkdown WYSIWYG editor
3. THE Content_Bridge SHALL preserve the existing "Copy to Clipboard" and "Download as .md" functionality by reading markdown from the Milkdown_Editor
4. THE Editor_Loader SHALL preserve the "Expand to Modal" functionality, creating a new Milkdown_Editor instance in the modal context

### Requirement 12: Notes View Dashboard Rendering

**User Story:** As a user browsing the Notes view on the dashboard, I want my notes to continue rendering as formatted markdown, so that the read-only display remains unchanged.

#### Acceptance Criteria

1. THE dashboard Notes view SHALL continue using marked.js for read-only markdown rendering of chit note content
2. WHEN a user shift-clicks a note card to edit inline on the dashboard, THE system SHALL use a plain textarea for inline editing (not a Milkdown instance) to keep the dashboard lightweight
3. THE Milkdown_Editor SHALL only be instantiated on the chit editor page and within the Notes_Modal, not on the dashboard

### Requirement 13: Editor Resize and Auto-grow

**User Story:** As a user writing longer notes, I want the editor to grow to accommodate my content, so that I don't have to manually resize it.

#### Acceptance Criteria

1. THE Milkdown_Editor container SHALL auto-grow in height as content is added, up to a maximum of 60% of the viewport height
2. WHEN content exceeds the maximum height, THE Milkdown_Editor container SHALL become scrollable with a visible scrollbar
3. THE Milkdown_Editor container SHALL have a minimum height of 6em to match the current textarea minimum
4. WHEN the "shrink to 4 lines" action is triggered, THE Milkdown_Editor container SHALL collapse to approximately 4 lines of height
