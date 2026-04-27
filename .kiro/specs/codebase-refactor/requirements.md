# Requirements Document — Codebase Refactor

## Introduction

This spec defines a comprehensive refactor of the C.W.'s Omni Chits (CWOC) codebase. The refactor preserves 100% identical functionality while eliminating redundancies, improving performance, improving code organization, and aligning the entire codebase with the General Principles steering file. Every existing feature, API endpoint, UI interaction, and data flow documented below MUST remain functionally identical after the refactor.

## Glossary

- **Chit**: The universal data record in CWOC — a flexible unit that can serve as a task, note, calendar event, alarm, checklist, or project.
- **C_CAPTN**: The six dashboard views — Calendar, Checklists, Alarms, Projects, Tasks, Notes.
- **System_Tag**: Auto-assigned tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) based on chit properties.
- **Dashboard**: The main page (`index.html` + `main.js` + `styles.css`) with tab views, sidebar, and calendar.
- **Editor**: The chit editor page (`editor.html` + `editor.js` + `editor.css`) with collapsible zones.
- **Contact_Editor**: The contact editor page (`contact-editor.html` + `contact-editor.js`).
- **People_Page**: The contacts browse page (`people.html` + `people.js`).
- **Settings_Page**: The settings page (`settings.html` + `settings.js`).
- **Trash_Page**: The soft-deleted chits view (`trash.html`).
- **Help_Page**: The documentation/help page (`help.html`).
- **Backend**: The single FastAPI application (`backend/main.py`).
- **Shared_JS**: Shared JavaScript utilities (`shared.js`) loaded before page-specific scripts.
- **Shared_Page_JS**: Shared page components (`shared-page.js`) for secondary pages.
- **Shared_Editor_JS**: Shared editor framework (`shared-editor.js`) for zone toggle, save system, hotkeys.
- **Shared_Page_CSS**: Shared styles for secondary pages (`shared-page.css`).
- **Shared_Editor_CSS**: Shared editor styles (`shared-editor.css`) for header, zones, forms, buttons.
- **General_Principles**: The steering file (`.kiro/steering/General Principles.md`) defining DRY, naming, consistency, and architecture rules.
- **Refactor_Engine**: The process that transforms the codebase while preserving all functionality.

## Requirements

### Requirement 1: Preserve All Backend API Endpoints

**User Story:** As a developer, I want every existing API endpoint to remain functionally identical after the refactor, so that no frontend behavior breaks.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all 24 API endpoints with identical request/response contracts:
   - `GET /` — serve `index.html`
   - `GET /editor` — serve `editor.html` with optional `?id=` param
   - `GET /api/instance-id` — return instance UUID
   - `GET /api/chits` — return all non-deleted chits
   - `POST /api/chits` — create a new chit
   - `GET /api/chit/{chit_id}` — return a single chit by ID
   - `PUT /api/chits/{chit_id}` — update a chit
   - `DELETE /api/chits/{chit_id}` — soft-delete a chit
   - `PATCH /api/chits/{chit_id}/recurrence-exceptions` — add/update recurrence exception
   - `GET /api/trash` — return all soft-deleted chits
   - `POST /api/trash/{chit_id}/restore` — restore a soft-deleted chit
   - `DELETE /api/trash/{chit_id}/purge` — permanently delete a chit
   - `GET /api/settings/{user_id}` — return user settings
   - `POST /api/settings` — save user settings
   - `GET /api/contacts` — return all contacts (optional `?q=` search)
   - `POST /api/contacts` — create a contact
   - `GET /api/contacts/{contact_id}` — return a single contact
   - `PUT /api/contacts/{contact_id}` — update a contact
   - `DELETE /api/contacts/{contact_id}` — delete a contact
   - `PATCH /api/contacts/{contact_id}/favorite` — toggle contact favorite
   - `POST /api/contacts/{contact_id}/image` — upload contact image
   - `DELETE /api/contacts/{contact_id}/image` — remove contact image
   - `GET /api/contacts/export` — export contacts as .vcf or .csv
   - `GET /api/contacts/{contact_id}/export` — export single contact
   - `POST /api/contacts/import` — import contacts from .vcf or .csv
   - `GET /health` — health check
2. THE Refactor_Engine SHALL preserve all Pydantic model fields and their types for `Chit`, `Settings`, `Contact`, `Tag`, and `MultiValueEntry`.
3. THE Refactor_Engine SHALL preserve all JSON serialization/deserialization behavior for fields stored as JSON strings in SQLite (`tags`, `checklist`, `people`, `child_chits`, `alerts`, `recurrence_rule`, `recurrence_exceptions`, `phones`, `emails`, `addresses`, `call_signs`, `x_handles`, `websites`, `custom_colors`, `visual_indicators`, `chit_options`, `default_filters`, `saved_locations`, `active_clocks`).
4. THE Refactor_Engine SHALL preserve all database migration functions and their column-existence checks.
5. IF a request is made to a non-existent chit or contact, THEN THE Backend SHALL return the same HTTP error codes as before the refactor.

### Requirement 2: Preserve All Dashboard Functionality

**User Story:** As a user, I want the main dashboard to work identically after the refactor, so that my daily workflow is uninterrupted.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all six C_CAPTN tab views (Calendar, Checklists, Alarms, Projects, Tasks, Notes) with identical rendering behavior.
2. THE Refactor_Engine SHALL preserve all seven calendar period views (Itinerary, Day, Week, Work Hours, X Days, Month, Year) with identical layout and event positioning.
3. THE Refactor_Engine SHALL preserve the sidebar with all sections: Create, Order, Period, Filters (Search, Status, Priority, Tags, People, Show), Clear Filters, People link, Settings link, Clock, Save Search, Reference, Help.
4. THE Refactor_Engine SHALL preserve all sorting options (Title, Start Date, Due Date, Updated, Created, Status, Manual, Random, Upcoming) with identical sort behavior and direction toggle.
5. THE Refactor_Engine SHALL preserve all filter functionality: status multi-select, priority multi-select, tag tree filter, people filter, pinned/archived/unmarked toggles, hide-past-due toggle, and text search.
6. THE Refactor_Engine SHALL preserve all keyboard hotkeys: tab switching (C/H/A/P/T/N), create (K), period (.), filter (F), order (O), clock (L), reference (R), settings (S), help (Shift+R), ESC, Backspace.
7. THE Refactor_Engine SHALL preserve all mouse interactions: double-click to open editor, shift-click for quick edit modal, drag-to-reorder chit cards, drag-to-move/resize calendar events, double-click empty space to create chit at time.
8. THE Refactor_Engine SHALL preserve the hotkey overlay panel system (period panel, filter panel, order panel, filter sub-panels).
9. THE Refactor_Engine SHALL preserve the reference overlay with all documented shortcuts.
10. THE Refactor_Engine SHALL preserve the Notes view masonry layout with rendered markdown, `[[chit title]]` auto-linking, and shift-click inline editing.
11. THE Refactor_Engine SHALL preserve the clock modal with all four formats (24 Hour, 12 Hour, 12 Hour Analog, HST).
12. THE Refactor_Engine SHALL preserve the weather modal triggered by W hotkey.
13. THE Refactor_Engine SHALL preserve the saved search chip functionality.
14. THE Refactor_Engine SHALL preserve default filter per-tab behavior loaded from settings.
15. THE Refactor_Engine SHALL preserve touch drag support for chit card reorder and checklist item reorder.

### Requirement 3: Preserve All Chit Editor Functionality

**User Story:** As a user, I want the chit editor to work identically after the refactor, so that I can create and edit chits without any changes to my workflow.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all editor zones with identical collapse/expand behavior: Dates & Times, Task, Location, Tags, People, Notes, Checklist, Alerts, Health Indicators, Color, Projects.
2. THE Refactor_Engine SHALL preserve the date mode system (Start/End, Due, None) with radio buttons and greyed-out inactive modes.
3. THE Refactor_Engine SHALL preserve the recurrence system: repeat toggle, preset frequencies (Daily/Weekly/Monthly/Yearly), custom frequency with interval and by-day selection, ends-never/end-date options.
4. THE Refactor_Engine SHALL preserve the recurrence instance editing: edit series, edit instance, break off & edit.
5. THE Refactor_Engine SHALL preserve the tag system: hierarchical tag tree, search, favorites, recent tags, create new tag, active tags display, tag selection/deselection.
6. THE Refactor_Engine SHALL preserve the people system: contact search, group tree, active people chips, people selection/deselection.
7. THE Refactor_Engine SHALL preserve the notes zone: markdown input with render toggle, expand modal, shrink to 4 lines, `[[chit title]]` linking.
8. THE Refactor_Engine SHALL preserve the checklist zone: add items, nested indentation (Tab/Shift+Tab), drag-to-reorder, check/uncheck with subtree propagation, delete with undo, completed section, keyboard navigation (Enter/Arrow keys/Escape).
9. THE Refactor_Engine SHALL preserve the alerts zone with alarm, timer, stopwatch, and notification functionality.
10. THE Refactor_Engine SHALL preserve the location zone: address input, saved locations dropdown, compact location dropdown in title area, search map, open map, directions, add default location, clear location, weather display.
11. THE Refactor_Engine SHALL preserve the weather display in the compact title/weather section with temperature track, precipitation, and weather icons.
12. THE Refactor_Engine SHALL preserve the color zone with default colors, custom colors from settings, and editor background tinting.
13. THE Refactor_Engine SHALL preserve the projects zone: project master toggle, child chit management (add via modal, status dropdown, drag-drop between status groups, due date, open in new tab, move to project, delete).
14. THE Refactor_Engine SHALL preserve the QR code system: data QR (chit payload with instance ID) and link QR (URL to chit).
15. THE Refactor_Engine SHALL preserve the save system: Save & Stay, Save & Exit, unsaved changes detection, cancel/exit with confirmation modal.
16. THE Refactor_Engine SHALL preserve pinned/archived toggle buttons and their visual states.
17. THE Refactor_Engine SHALL preserve the all-day toggle that hides time inputs across all date modes.
18. THE Refactor_Engine SHALL preserve Alt+1 through Alt+0 hotkeys for zone focus/expand.
19. THE Refactor_Engine SHALL preserve the health indicators section with all subsections.

### Requirement 4: Preserve All Settings Page Functionality

**User Story:** As a user, I want the settings page to work identically after the refactor, so that my preferences are maintained.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all settings sections: General (time format, sex toggle, snooze length, calendar snap), Period Options (enabled periods, X days count, week start day, working hours, working days), Default Filters (per-tab search text), Alarms (clock format grid with drag-to-reorder, active/inactive zones, orientation toggle), Tag Editor (tree view, create/edit/delete/favorite, child tag creation, color picker), Saved Locations (add/remove/default radio), Custom Colors (color picker, add/delete), Chit Options (fade past, highlight overdue, delete past alarms), Export/Import, Trash link.
2. THE Refactor_Engine SHALL preserve the save system: Save & Stay, Save & Exit, unsaved changes detection, cancel/exit with confirmation.
3. THE Refactor_Engine SHALL preserve the tag modal with name editing, color picker, and favorite toggle.
4. THE Refactor_Engine SHALL preserve the settings tag tree rendering with "+" child-create buttons.
5. THE Refactor_Engine SHALL preserve the clock format drag-and-drop between active grid and inactive zone.

### Requirement 5: Preserve All Contacts/People Functionality

**User Story:** As a user, I want the contacts system to work identically after the refactor, so that my contact management is unaffected.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve the People page: contact list with favorites section, search with highlight, star toggle, thumbnail/placeholder, detail line (email/phone/org), share QR button, click-to-edit navigation.
2. THE Refactor_Engine SHALL preserve the Contact Editor: 3-column zone layout (Name + Security, Phone & Email + Context, Social & Web + Color), profile image upload/view/remove, display name live header, prefix/suffix custom dropdowns, multi-value fields (phones, emails, addresses, call signs, X handles, websites) with add/remove, Signal toggle with username field, PGP key textarea, color picker with swatches, favorite toggle, QR sharing, save/delete/exit.
3. THE Refactor_Engine SHALL preserve contact import from .vcf and .csv files with result modal showing imported/skipped/errors.
4. THE Refactor_Engine SHALL preserve contact export as .vcf and .csv file downloads (all contacts and single contact).
5. THE Refactor_Engine SHALL preserve the vCard 3.0 parser and printer with round-trip fidelity for all mapped properties.
6. THE Refactor_Engine SHALL preserve the CSV export/import with numbered multi-value columns (up to 5 each).
7. THE Refactor_Engine SHALL preserve the contact QR code generation using client-side vCard string.

### Requirement 6: Preserve All Secondary Pages

**User Story:** As a user, I want the trash, help, and template pages to work identically after the refactor.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve the Trash page: table view with select-all, individual selection, bulk restore, bulk purge, individual restore/purge, column display (title, status, priority, due/start, tags, note preview, deleted date).
2. THE Refactor_Engine SHALL preserve the Help page with all documented sections and the table of contents.
3. THE Refactor_Engine SHALL preserve the `_template.html` page template with all documented shared classes and structure.
4. THE Refactor_Engine SHALL preserve the auto-header/footer injection system in `shared-page.js` triggered by `data-page-title` on `<body>`.

### Requirement 7: Preserve All Shared Utilities

**User Story:** As a developer, I want all shared utilities to remain functionally identical after the refactor, so that all pages continue to work correctly.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all `shared.js` functions: `toggleChecklistItem`, `moveChecklistItem`, `moveChecklistItemCrossChit`, `renderInlineChecklist`, `getManualOrder`, `saveManualOrder`, `applyManualOrder`, `enableDragToReorder`, `getCalendarDateInfo`, `chitMatchesDay`, `calendarEventTitle`, `calendarEventTooltip`, `enableCalendarDrag`, `enableTouchDrag`, `formatRecurrenceRule`, `expandRecurrences`, `buildTagTree`, `renderTagTree`, `matchesTagFilter`, `isSystemTag`, `getPastelColor`, `formatDate`.
2. THE Refactor_Engine SHALL preserve the `CwocSaveSystem` class in `shared-page.js` with `markSaved`, `markUnsaved`, `hasChanges`, `cancelOrExit` methods.
3. THE Refactor_Engine SHALL preserve the `CwocEditorSaveSystem` class in `shared-editor.js` wrapping `CwocSaveSystem` with auto-input listeners.
4. THE Refactor_Engine SHALL preserve the `cwocToggleZone` function for zone collapse/expand.
5. THE Refactor_Engine SHALL preserve the `cwocInitEditorHotkeys` function for Alt+N zone focus.
6. THE Refactor_Engine SHALL preserve the `Checklist` class in `editor_checklists.js` with all methods: `loadItems`, `getChecklistData`, `addNewItem`, `render`, `startEditing`, `toggleCheck`, `deleteItem`, `undoDelete`, drag-and-drop, keyboard navigation.
7. THE Refactor_Engine SHALL preserve all project zone functions in `editor_projects.js`: `initializeProjectZone`, `renderChildChitsByStatus`, `createChildChitCard`, `saveProjectChanges`, `openAddChitModal`, `toggleProjectMaster`.
8. THE Refactor_Engine SHALL preserve the `generateContactVCard` and `showContactQrCode` functions in `contact-qr.js`.

### Requirement 8: Preserve All Visual Styling and Theme

**User Story:** As a user, I want the visual appearance to remain identical after the refactor, so that the 1940s parchment/magic aesthetic is unchanged.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all CSS variables defined in `styles.css`, `shared-page.css`, `shared-editor.css`, and `editor.css`.
2. THE Refactor_Engine SHALL preserve the parchment background texture, Courier New font family, brown color palette, and all visual effects (gradients, shadows, borders).
3. THE Refactor_Engine SHALL preserve all responsive breakpoints and their layout changes (768px tablet, 480px mobile, 400px small mobile).
4. THE Refactor_Engine SHALL preserve all animations: jiggle for tag highlight, spin for loader, fadeOut for duplicate tag modal.
5. THE Refactor_Engine SHALL preserve the dashboard-specific styling independence from shared-page.css.

### Requirement 9: Preserve All Data Persistence

**User Story:** As a user, I want all my data to remain intact and accessible after the refactor.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve the SQLite database schema with all tables (`chits`, `settings`, `contacts`, `instance_meta`) and all columns.
2. THE Refactor_Engine SHALL preserve all database migration functions that run at startup with column-existence checks.
3. THE Refactor_Engine SHALL preserve localStorage usage: `cwoc_manual_order` for manual sort order, `cwoc_settings_return` for return URL, zone collapse states.
4. THE Refactor_Engine SHALL preserve soft-delete behavior: chits are never hard-deleted except via explicit purge from trash.
5. THE Refactor_Engine SHALL preserve the `compute_display_name` function for contact display name generation.

### Requirement 10: Preserve All External Integrations

**User Story:** As a user, I want all external service integrations to continue working identically after the refactor.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve OpenStreetMap Nominatim geocoding with progressive query fallback (full address → no zip → city/state).
2. THE Refactor_Engine SHALL preserve Open-Meteo weather API integration with temperature conversion (C→F), weather code icons, and precipitation display.
3. THE Refactor_Engine SHALL preserve all CDN library integrations: Flatpickr (date picker), Font Awesome 6 (icons), marked.js (markdown rendering), qrcode-generator (QR codes).
4. THE Refactor_Engine SHALL preserve the OpenStreetMap embed iframe for location map display.

### Requirement 11: Eliminate Code Redundancies (DRY)

**User Story:** As a developer, I want redundant code eliminated so that the codebase is easier to maintain without changing any behavior.

#### Acceptance Criteria

1. WHEN duplicate CSS variable definitions exist across `styles.css`, `shared-page.css`, `shared-editor.css`, and `editor.css`, THE Refactor_Engine SHALL consolidate them into a single source of truth while preserving all computed values.
2. WHEN duplicate JavaScript utility functions exist across files, THE Refactor_Engine SHALL consolidate them into `shared.js` or `shared-page.js` as appropriate, following the General_Principles load order rules.
3. WHEN duplicate inline styles exist in HTML files, THE Refactor_Engine SHALL extract them into appropriate CSS classes.
4. WHEN duplicate API fetch patterns exist across frontend files, THE Refactor_Engine SHALL extract them into shared helper functions.
5. THE Refactor_Engine SHALL identify and consolidate duplicate `formatDate` / `formatTime` implementations across `editor.js`, `main.js`, and `shared.js`.
6. THE Refactor_Engine SHALL identify and consolidate duplicate `generateUniqueId` implementations across `editor.js` and `editor_projects.js`.

### Requirement 12: Improve Code Organization and Logical Consistency

**User Story:** As a developer, I want the code organized logically and consistently so that it's easier to navigate and understand.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL organize `backend/main.py` into clearly separated sections with consistent ordering: imports, constants, models, database helpers, migrations, route handlers (grouped by resource: chits, settings, contacts, trash, health).
2. THE Refactor_Engine SHALL ensure all JavaScript functions follow the General_Principles naming conventions: `camelCase` for public functions, `_prefixed` for private/internal helpers.
3. THE Refactor_Engine SHALL ensure all CSS classes follow `kebab-case` naming and CWOC-specific shared classes use the `cwoc-` prefix.
4. THE Refactor_Engine SHALL ensure all Python code follows `snake_case` naming for variables, functions, and route names.
5. THE Refactor_Engine SHALL ensure consistent error handling patterns: `async/await` with `try/catch` for all `fetch` calls, `console.error` for logging.
6. THE Refactor_Engine SHALL ensure functions follow the single-responsibility principle — functions exceeding ~40 lines SHALL be split where doing so does not change behavior.
7. THE Refactor_Engine SHALL ensure comments explain "why" not "what" — remove redundant comments, add intent comments where non-obvious.
8. THE Refactor_Engine SHALL ensure consistent use of `serialize_json_field` / `deserialize_json_field` helpers for all JSON-stored database fields.

### Requirement 13: Improve Performance

**User Story:** As a user, I want the application to run faster after the refactor without any visible behavior changes.

#### Acceptance Criteria

1. WHEN the Dashboard loads chits, THE Refactor_Engine SHALL ensure efficient DOM manipulation (batch updates, minimize reflows).
2. WHEN the Backend queries the database, THE Refactor_Engine SHALL ensure database connections are properly opened and closed with no connection leaks.
3. WHEN the Frontend makes API calls, THE Refactor_Engine SHALL ensure no unnecessary duplicate requests are made during page initialization.
4. THE Refactor_Engine SHALL ensure event listeners are not duplicated when views are re-rendered.
5. THE Refactor_Engine SHALL ensure CSS selectors are efficient and do not use overly broad or deeply nested selectors.

### Requirement 14: Preserve All Static Assets and File Serving

**User Story:** As a developer, I want all static file serving to remain identical after the refactor.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL preserve all static assets in the `static/` directory: all PNG images (logos, tab icons, large variants), `parchment.jpg`, `alarm.mp3`, `timer.mp3`, `settings.png`, `create_new.png`, `editor.png`.
2. THE Refactor_Engine SHALL preserve FastAPI static file mounts: `/frontend/` serving from `/app/frontend/`, `/static/` serving from `/app/static/`.
3. THE Refactor_Engine SHALL preserve all `<script>` tag load orders in every HTML file.
4. THE Refactor_Engine SHALL preserve the `_template.html` as the starting point for new pages.

### Requirement 15: Align with General Principles Steering File

**User Story:** As a developer, I want the refactored codebase to fully comply with the General Principles steering file so that future development follows consistent patterns.

#### Acceptance Criteria

1. THE Refactor_Engine SHALL ensure all code complies with the DRY principle: no repeated logic across files, shared utilities in `shared.js` and `shared-page.js`.
2. THE Refactor_Engine SHALL ensure the project remains vanilla JS/HTML/CSS with no frameworks, no build step, no bundlers, no transpilers, no ES modules.
3. THE Refactor_Engine SHALL ensure all API endpoints follow REST conventions under `/api/` with JSON in/out.
4. THE Refactor_Engine SHALL ensure frontend globals are loaded from `/api/settings/default_user` at page init.
5. THE Refactor_Engine SHALL ensure database schema changes use inline migration functions with column-existence checks.
6. THE Refactor_Engine SHALL ensure all JSON-serialized fields use `serialize_json_field` / `deserialize_json_field` helpers.
7. THE Refactor_Engine SHALL ensure `CwocSaveSystem` is used for all pages with editable state.
8. THE Refactor_Engine SHALL ensure new pages start from `_template.html` and use `shared-page.js` for header/footer injection.
9. THE Refactor_Engine SHALL ensure soft delete is used throughout — chits are never hard-deleted except via explicit purge.
10. THE Refactor_Engine SHALL ensure error handling is graceful: meaningful JSON error responses from API endpoints, user-friendly messages in the UI.
