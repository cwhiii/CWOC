# Requirements Document — Manageable Code Blocks

## Introduction

This spec defines three coordinated changes to the CWOC codebase, executed in isolated phases so each step can be verified independently:

1. **Directory restructuring** — Organize all source code under a single `src/` top-level directory with logical subdirectories, and flatten the data directory to a top-level `data/` path.
2. **File decomposition** — Split the five largest monolithic files into smaller, focused files so that when something breaks, the relevant code is easy to find.
3. **Data directory reorganization** — Move contact profile images from `/app/static/contact_images/` into a well-organized `data/contacts/` directory structure, and establish a `data/` layout that accommodates future data types cleanly.

All changes are tracked in a `mega_restructure_plan.md` master plan with 12 sequential phases, each leaving the application in a fully working state.

The five target files for decomposition are `backend/main.py` (~4,500 lines), `frontend/main.js` (~7,300 lines), `frontend/editor.js` (~4,600 lines), `frontend/shared.js` (~5,000 lines), and `frontend/styles.css` (~3,081 lines).

The backend split uses Python's native `import` system. The frontend split uses additional `<script>` tags in the correct load order — no ES modules, no bundlers, no build step. CSS is split into multiple `<link>` tags loaded in order.

This spec builds on the completed codebase-refactor spec (`.kiro/specs/codebase-refactor/`), which reorganized code *within* existing files. This spec restructures the directory layout and splits those files *into* separate files.

## Glossary

- **Decomposition_Engine**: The process that restructures directories and splits monolithic files into smaller focused files while preserving all functionality.
- **Backend**: The FastAPI application, currently in `backend/main.py`, moving to `src/backend/`.
- **Dashboard**: The main page (`index.html` + `main.js` + `styles.css`) with tab views, sidebar, and calendar.
- **Editor**: The chit editor page (`editor.html` + `editor.js` + `editor.css`) with collapsible zones.
- **Shared_JS**: Shared JavaScript utilities (`shared.js`) loaded before page-specific scripts.
- **Script_Load_Order**: The sequence of `<script>` tags in each HTML file, which determines global function availability since there are no ES modules.
- **Module_File**: A Python file within `src/backend/` that is imported by `main.py` to provide a subset of functionality.
- **Sub_Script**: A frontend JavaScript file extracted from a larger file, loaded via an additional `<script>` tag in the correct position.
- **Sub_Stylesheet**: A CSS file extracted from a larger stylesheet, loaded via an additional `<link>` tag in the correct position.
- **System_Tag**: Auto-assigned tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) based on chit properties.
- **C_CAPTN**: The six dashboard views — Calendar, Checklists, Alarms, Projects, Tasks, Notes.
- **Data_Directory**: The top-level `data/` directory that stores the SQLite database and all user-generated data files, organized by data type (e.g., `data/contacts/profile_pictures/`, `data/contacts/pgp_keys/`).
- **Profile_Picture**: A contact's uploaded image file (JPEG, PNG, GIF, or WebP), currently stored in `/app/static/contact_images/` and referenced by the `image_url` column in the contacts table.
- **Mega_Restructure_Plan**: The `mega_restructure_plan.md` master tracking document at the project root that defines all restructuring phases, their task lists, verification steps, and completion status.

## Requirements

### Requirement 1: Restructure Project into src/ Directory with Subdirectories

**User Story:** As a developer, I want all source code organized under a single `src/` directory with logical subdirectories, so that the project has a clean, navigable structure with code separated from data and configuration.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL move all source code into a `src/` top-level directory with the following structure:
   ```
   src/
     backend/
       __init__.py
       main.py              (FastAPI app entry point — imports and registers routes)
       models.py
       db.py
       migrations.py
       serializers.py
       weather.py
       routes/
         __init__.py
         chits.py
         trash.py
         settings.py
         contacts.py
         audit.py
         health.py
     frontend/
       html/
         index.html
         editor.html
         settings.html
         people.html
         contact-editor.html
         help.html
         trash.html
         audit-log.html
         weather.html
         _template.html
       js/
         shared/
           shared-utils.js
           shared-checklist.js
           shared-sort.js
           shared-indicators.js
           shared-calendar.js
           shared-tags.js
           shared-touch.js
           shared-recurrence.js
           shared-geocoding.js
           shared-qr.js
           shared.js            (minimal coordinator)
         dashboard/
           main-sidebar.js
           main-hotkeys.js
           main-calendar.js
           main-views.js
           main-alerts.js
           main-search.js
           main-modals.js
           main-init.js
           main.js              (minimal coordinator)
         editor/
           editor-dates.js
           editor-tags.js
           editor-people.js
           editor-location.js
           editor-notes.js
           editor-alerts.js
           editor-color.js
           editor-health.js
           editor-save.js
           editor-init.js
           editor.js            (minimal coordinator)
           editor_checklists.js
           editor_projects.js
         pages/
           shared-page.js
           shared-editor.js
           settings.js
           people.js
           contact-editor.js
           contact-qr.js
           weather.js
       css/
         shared/
           shared-page.css
           shared-editor.css
         dashboard/
           styles-variables.css
           styles-layout.css
           styles-sidebar.css
           styles-tabs.css
           styles-calendar.css
           styles-cards.css
           styles-hotkeys.css
           styles-modals.css
           styles-responsive.css
           styles.css           (minimal coordinator)
         editor/
           editor.css
     static/
       (all existing static assets — images, audio, parchment.jpg)
   ```
2. THE Decomposition_Engine SHALL flatten the data directory to a top-level `data/` path containing the SQLite database file directly (not nested `data/data/`).
3. THE Decomposition_Engine SHALL update `DB_PATH` in the backend to reference the correct data directory path.
4. THE Decomposition_Engine SHALL update the FastAPI `StaticFiles` mounts to serve from the new directory paths:
   - `/frontend/html/` serving HTML files from `src/frontend/html/`
   - `/frontend/js/` serving JS files from `src/frontend/js/`
   - `/frontend/css/` serving CSS files from `src/frontend/css/`
   - `/static/` serving from `src/static/`
5. THE Decomposition_Engine SHALL update the uvicorn startup command from `uvicorn backend.main:app` to `uvicorn src.backend.main:app` in `start.sh`, `cwoc.service`, and all documentation.
6. THE Decomposition_Engine SHALL update all `FileResponse` paths in the backend to reference the new HTML file locations.
7. THE Decomposition_Engine SHALL update all `<script src="...">` and `<link href="...">` paths in every HTML file to reference the new JS and CSS file locations.
8. THE Decomposition_Engine SHALL update all `window.location.href` and `fetch()` URL references in JavaScript files that point to frontend pages (e.g., `/frontend/editor.html` → `/frontend/html/editor.html`).
9. THE Decomposition_Engine SHALL add `__init__.py` files to `src/backend/` and `src/backend/routes/` to make them proper Python packages.
10. THE Decomposition_Engine SHALL preserve the `install/` directory and `configurinator.sh` at the project root, updating any paths within them that reference the old directory structure.

### Requirement 2: Split backend/main.py into Python Modules

**User Story:** As a developer, I want the backend code split into focused Python modules, so that when a route or migration breaks I can locate the problem in a small, specific file instead of scrolling through 4,500 lines.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL split `backend/main.py` into the following Module_Files within `src/backend/`:
   - `src/backend/models.py` — all Pydantic model classes (Chit, Settings, Contact, Tag, MultiValueEntry, ImportRequest)
   - `src/backend/db.py` — database initialization (`init_db`), instance ID management, JSON serialization/deserialization helpers (`serialize_json_field`, `deserialize_json_field`), `compute_display_name`, `compute_system_tags`, export envelope builder, version info helpers
   - `src/backend/migrations.py` — all `migrate_*` functions and the contacts table initialization (`init_contacts_table`)
   - `src/backend/routes/chits.py` — all chit-related API route handlers (CRUD, recurrence exceptions)
   - `src/backend/routes/trash.py` — all trash-related API route handlers (list, restore, purge)
   - `src/backend/routes/settings.py` — all settings-related API route handlers
   - `src/backend/routes/contacts.py` — all contact-related API route handlers (CRUD, favorite, image, export, import)
   - `src/backend/routes/audit.py` — audit log route handlers and audit helper functions
   - `src/backend/routes/health.py` — health check, version, instance ID, and WebSocket routes
   - `src/backend/serializers.py` — vCard parser/printer and CSV export/import functions
   - `src/backend/weather.py` — weather API proxy, geocoding proxy, and scheduling helpers
2. THE Decomposition_Engine SHALL keep `src/backend/main.py` as the FastAPI app entry point that imports from all Module_Files and registers routes.
3. WHEN `src/backend/main.py` starts, THE Backend SHALL execute all migrations and database initialization in the same order as before the split.
4. THE Decomposition_Engine SHALL preserve the `DB_PATH` constant and `_update_lock` as shared state accessible to all Module_Files that need them.
5. IF a Module_File depends on a function or class from another Module_File, THEN THE Decomposition_Engine SHALL use standard Python imports to resolve the dependency.
6. THE Decomposition_Engine SHALL preserve all 24+ API endpoints with identical request/response contracts after the split.
7. THE Decomposition_Engine SHALL ensure each Module_File is under 500 lines, with the exception of `src/backend/routes/contacts.py` which may be up to 700 lines due to the vCard/CSV import complexity being closely coupled to contact routes.

### Requirement 3: Split frontend/main.js into Focused Sub-Scripts

**User Story:** As a developer, I want the dashboard JavaScript split into focused files, so that when a calendar view or sidebar feature breaks I can find the relevant code in a small file instead of searching through 7,300 lines.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL split `frontend/main.js` into the following Sub_Scripts under `src/frontend/js/dashboard/`:
   - `main-sidebar.js` — sidebar rendering, filter UI, filter toggle, clear filters, saved searches, people filter panel, archive/pinned/unmarked toggles
   - `main-hotkeys.js` — hotkey mode state machine, hotkey overlay/panel system, period/filter/order/navigate panel handlers, reference overlay, keyboard event dispatcher
   - `main-calendar.js` — all calendar period views (Itinerary, Day, Week, Work Hours, X Days, Month, Year), date navigation (previous/next period, go to today), week range display, calendar event rendering and positioning
   - `main-views.js` — list-based views for Checklists, Tasks, Projects, Alarms, Notes (masonry layout), Indicators, chit card rendering (`_buildChitHeader`), empty state rendering
   - `main-alerts.js` — alert system (alarm/timer/stopwatch/notification modals), snooze registry, alert checking loop, audio playback
   - `main-search.js` — global search overlay, search result rendering, search hotkey handler
   - `main-modals.js` — clock modal, weather modal, quick-edit modal (shift-click), delete confirmation modal, QR code modal integration
   - `main-init.js` — application initialization (`DOMContentLoaded` handler), settings loading, chit fetching, tab switching, `displayChits` orchestrator, sort/filter application, responsive layout, `storePreviousState`
2. THE Decomposition_Engine SHALL keep `main.js` as a minimal coordinator file that declares shared state variables (`currentTab`, `chits`, `currentWeekStart`, `currentView`, `currentSortField`, `currentSortDir`, `_hotkeyMode`, `_cachedTagObjects`, `_chitOptions`, `_snoozeRegistry`, `_defaultFilters`) and loads after all sub-scripts.
3. WHEN `index.html` loads, THE Dashboard SHALL include all Sub_Scripts via `<script>` tags after shared scripts and before the coordinator `main.js`.
4. THE Decomposition_Engine SHALL preserve all global function names so that `onclick` handlers in `index.html` continue to work without modification to the handler names.
5. THE Decomposition_Engine SHALL ensure each Sub_Script is under 1,200 lines.

### Requirement 4: Split frontend/editor.js into Focused Sub-Scripts

**User Story:** As a developer, I want the editor JavaScript split into focused files, so that when a specific editor zone breaks I can isolate the problem to a small, zone-specific file.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL split `frontend/editor.js` into the following Sub_Scripts under `src/frontend/js/editor/`:
   - `editor-dates.js` — date mode system (Start/End, Due, None), all-day toggle, time picker dropdown, recurrence picker (repeat toggle, preset frequencies, custom frequency, ends-never/end-date), recurrence rule building and loading
   - `editor-tags.js` — tag tree rendering in editor, tag search, favorites/recent tags, create new tag, active tags display, tag selection/deselection
   - `editor-people.js` — people zone: contact search, group tree rendering, active people chips, people selection/deselection
   - `editor-location.js` — location zone: address input, saved locations dropdown, geocoding, map display, directions, weather fetching and compact weather display, default location population, clear location
   - `editor-notes.js` — notes zone: markdown input with render toggle, expand modal, shrink to 4 lines, `[[chit title]]` linking
   - `editor-alerts.js` — alerts zone: alarm, timer, stopwatch, and notification CRUD, default notification population, notification button visibility
   - `editor-color.js` — color zone: default color swatches, custom colors from settings, editor background tinting
   - `editor-health.js` — health indicators section with all subsections and readings
   - `editor-save.js` — save system: `saveChit`, `saveChitAndStay`, chit building/payload assembly, unsaved changes detection, cancel/exit with confirmation, delete chit, pin/archive toggles, QR code display
   - `editor-init.js` — editor initialization: chit ID parsing, zone collapse state restoration, settings loading, chit data loading and field population, `DOMContentLoaded` handler
2. THE Decomposition_Engine SHALL keep `editor.js` as a minimal coordinator file that declares shared editor state variables (`chitId`, `currentWeatherLat`, `currentWeatherLon`, `currentWeatherData`, `weatherIcons`, `defaultColors`) and loads after all sub-scripts.
3. WHEN `editor.html` loads, THE Editor SHALL include all Sub_Scripts via `<script>` tags after shared scripts, `shared-editor.js`, `editor_checklists.js`, and `editor_projects.js`, and before the coordinator `editor.js`.
4. THE Decomposition_Engine SHALL preserve all global function names so that `onclick` handlers in `editor.html` continue to work without modification to the handler names.
5. THE Decomposition_Engine SHALL ensure each Sub_Script is under 800 lines.

### Requirement 5: Split frontend/shared.js into Focused Sub-Scripts

**User Story:** As a developer, I want the shared utilities split into focused files, so that when a shared helper like calendar drag or tag tree breaks I can find it in a small, topic-specific file.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL split `frontend/shared.js` into the following Sub_Scripts under `src/frontend/js/shared/`:
   - `shared-utils.js` — core utility functions: `generateUniqueId`, `formatDate`, `formatTime`, `setSaveButtonUnsaved`, `contrastColorForBg`, `applyChitColors`, `isLightColor`, `_utcToLocalDate`, `_parseISOTime`, `getPastelColor`, `cwocConfirm`, settings cache (`getCachedSettings`, `_invalidateSettingsCache`)
   - `shared-checklist.js` — inline checklist interactions: `toggleChecklistItem`, `moveChecklistItem`, `moveChecklistItemCrossChit`, `renderInlineChecklist`
   - `shared-sort.js` — manual sort order persistence: `getManualOrder`, `saveManualOrder`, `applyManualOrder`, `enableDragToReorder`
   - `shared-indicators.js` — alert indicator helpers: `_chitHasAlerts`, `_getAlertIndicators`, `_shouldShow`, `_chitAlertTypesPresent`, `_ALERT_TYPES`, `_ALERT_ICON_MAP`, `_STATUS_ICONS`, and all visual indicator functions
   - `shared-calendar.js` — calendar display helpers: `getCalendarDateInfo`, `chitMatchesDay`, `calendarEventTitle`, `calendarEventTooltip`, `enableCalendarDrag` (move and resize)
   - `shared-tags.js` — tag tree and filtering: `buildTagTree`, `renderTagTree`, `matchesTagFilter`, `isSystemTag`
   - `shared-touch.js` — touch drag support: `enableTouchDrag` and all touch event handling
   - `shared-recurrence.js` — recurrence helpers: `formatRecurrenceRule`, `expandRecurrences`
   - `shared-geocoding.js` — shared geocoding: `_geocodeAddress` with progressive fallback
   - `shared-qr.js` — QR code modal: `showQRModal` and related display functions
2. THE Decomposition_Engine SHALL keep `shared.js` as a minimal coordinator file that loads after all shared Sub_Scripts and provides any remaining glue code.
3. WHEN any HTML page loads shared scripts, THE page SHALL include all shared Sub_Scripts via `<script>` tags before the coordinator `shared.js`, which loads before `shared-page.js` and page-specific scripts.
4. THE Decomposition_Engine SHALL preserve all global function names so that callers in dashboard, editor, settings, and other files continue to work without modification.
5. THE Decomposition_Engine SHALL ensure `shared-utils.js` loads first among the shared Sub_Scripts since other shared files depend on its utility functions.
6. THE Decomposition_Engine SHALL ensure `shared-touch.js` loads before `shared-checklist.js` and `shared-sort.js` since both use `enableTouchDrag`.
7. THE Decomposition_Engine SHALL ensure each Sub_Script is under 600 lines.

### Requirement 6: Split frontend/styles.css into Focused Sub-Stylesheets

**User Story:** As a developer, I want the dashboard CSS split into focused files, so that when a calendar layout or sidebar style breaks I can find the relevant rules in a small, topic-specific file.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL split `frontend/styles.css` into the following Sub_Stylesheets under `src/frontend/css/dashboard/`:
   - `styles-variables.css` — CSS custom properties (`:root` block with all dashboard variables)
   - `styles-layout.css` — main content wrapper, body, header, top bar, logo, responsive layout containers
   - `styles-sidebar.css` — sidebar positioning, sidebar sections, sidebar buttons, sidebar scroll, sidebar bottom, filter groups, multi-select controls, order controls, clear filters button
   - `styles-tabs.css` — tab bar, tab styling, active/hover states, icon-only mode, tab counts
   - `styles-calendar.css` — all calendar view styles: week view grid, day columns, hour blocks, month view grid, month days, year view, timed events, all-day events, multi-day spans, day headers, calendar drag resize handles
   - `styles-cards.css` — chit card styling, chit header row, chit meta, completed task styling, archived chit transparency, drag-to-reorder feedback, notes view masonry layout, note content markdown styling
   - `styles-hotkeys.css` — hotkey overlay, hotkey panels, panel options, reference overlay, reference columns
   - `styles-modals.css` — delete chit modal, clock modal, weather modal, quick-edit modal, all modal overlays and content boxes
   - `styles-responsive.css` — all `@media` breakpoint rules (768px tablet, 480px mobile, 400px small mobile)
2. THE Decomposition_Engine SHALL keep `styles.css` as a minimal file that contains only an organizational comment and any rules that do not fit cleanly into the sub-stylesheets.
3. WHEN `index.html` loads, THE Dashboard SHALL include all Sub_Stylesheets via `<link>` tags with `styles-variables.css` loaded first, followed by the other sub-stylesheets in any order, followed by `styles.css` last.
4. THE Decomposition_Engine SHALL ensure CSS specificity is preserved — rules that override other rules SHALL remain in the same relative order after the split.
5. THE Decomposition_Engine SHALL ensure each Sub_Stylesheet is under 500 lines.

### Requirement 7: Preserve All Existing Functionality

**User Story:** As a user, I want the application to work identically after the restructuring and file split, so that my workflow is completely unaffected.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL preserve all 24+ API endpoints with identical request/response contracts.
2. THE Decomposition_Engine SHALL preserve all six C_CAPTN tab views with identical rendering behavior.
3. THE Decomposition_Engine SHALL preserve all seven calendar period views with identical layout and event positioning.
4. THE Decomposition_Engine SHALL preserve all editor zones with identical collapse/expand behavior and data handling.
5. THE Decomposition_Engine SHALL preserve all keyboard hotkeys across all pages.
6. THE Decomposition_Engine SHALL preserve all mouse interactions: double-click, shift-click, drag-to-reorder, drag-to-move/resize calendar events.
7. THE Decomposition_Engine SHALL preserve all settings page functionality including tag editor, clock format drag-drop, and saved locations.
8. THE Decomposition_Engine SHALL preserve all contacts/people functionality including import/export, QR sharing, and image upload.
9. THE Decomposition_Engine SHALL preserve all visual styling — no pixel-level changes to any rendered page.
10. THE Decomposition_Engine SHALL preserve all database migrations, schema, and data persistence behavior.
11. THE Decomposition_Engine SHALL preserve all external integrations (OpenStreetMap, Open-Meteo, CDN libraries).
12. THE Decomposition_Engine SHALL preserve the `_template.html` page template and `shared-page.js` auto-header/footer injection system.

### Requirement 8: Maintain Script and Stylesheet Load Order Integrity

**User Story:** As a developer, I want the script and stylesheet load order to be correct in every HTML file, so that global functions and CSS variables are available when needed.

#### Acceptance Criteria

1. WHEN `index.html` loads scripts, THE Dashboard SHALL load them in this order: shared Sub_Scripts (with `shared-utils.js` first) → `shared.js` → `shared-page.js` → dashboard Sub_Scripts → `main.js`.
2. WHEN `editor.html` loads scripts, THE Editor SHALL load them in this order: shared Sub_Scripts (with `shared-utils.js` first) → `shared.js` → `shared-page.js` → `shared-editor.js` → `editor_checklists.js` → `editor_projects.js` → editor Sub_Scripts → `editor.js` → Flatpickr → marked.js.
3. WHEN any secondary page loads scripts, THE page SHALL load shared Sub_Scripts (with `shared-utils.js` first) → `shared.js` → `shared-page.js` → page-specific scripts, preserving the existing load order for page-specific scripts.
4. WHEN `index.html` loads stylesheets, THE Dashboard SHALL load `styles-variables.css` first, then remaining sub-stylesheets, then `styles.css` last.
5. THE Decomposition_Engine SHALL update ALL HTML files that reference the split files to include the new Sub_Scripts and Sub_Stylesheets in the correct order with the correct paths.
6. IF a Sub_Script defines a function that another Sub_Script calls, THEN THE Sub_Script defining the function SHALL be loaded before the Sub_Script calling it.

### Requirement 9: Preserve Vanilla Architecture Constraints

**User Story:** As a developer, I want the split to respect the project's vanilla JS/HTML/CSS architecture, so that no new tooling or complexity is introduced.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL use only `<script>` tags for JavaScript loading — no ES modules (`import`/`export`), no bundlers, no transpilers.
2. THE Decomposition_Engine SHALL use only `<link>` tags for CSS loading — no CSS `@import` statements, no preprocessors.
3. THE Decomposition_Engine SHALL use standard Python `import` statements for backend module splitting — no additional frameworks or tools.
4. THE Decomposition_Engine SHALL introduce no new dependencies — no npm, no pip installs, no new CDN libraries.
5. THE Decomposition_Engine SHALL ensure all frontend functions remain in the global scope so that `onclick` handlers in HTML continue to work.
6. THE Decomposition_Engine SHALL ensure the FastAPI `StaticFiles` mounts serve all new Sub_Scripts and Sub_Stylesheets from the new directory paths.

### Requirement 10: Ensure Each File Has a Clear Single Responsibility

**User Story:** As a developer, I want each new file to have a clear, documented purpose, so that when something breaks I know exactly which file to look at.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL add a file-level comment block at the top of each new Sub_Script and Sub_Stylesheet describing its purpose, what it contains, and which files depend on it.
2. THE Decomposition_Engine SHALL add a file-level docstring at the top of each new Module_File describing its purpose and its relationship to `main.py`.
3. THE Decomposition_Engine SHALL ensure no function or CSS rule is duplicated across the new files — each piece of code SHALL exist in exactly one file.
4. THE Decomposition_Engine SHALL ensure each file focuses on a single logical concern (e.g., one editor zone, one view type, one API resource group).
5. WHEN a developer encounters a bug in calendar rendering, THE developer SHALL find all calendar-related code in `src/frontend/js/dashboard/main-calendar.js` and `src/frontend/css/dashboard/styles-calendar.css` without needing to search other files.
6. WHEN a developer encounters a bug in a backend contact route, THE developer SHALL find all contact route code in `src/backend/routes/contacts.py` without needing to search other files.

### Requirement 11: Provide a Function and File Index

**User Story:** As a developer, I want a reference index that maps every function, class, and CSS section to its file, so that when I need to find or debug something I can look it up instantly instead of guessing which file it lives in.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL create a `src/INDEX.md` file that serves as the master reference for the entire codebase.
2. THE Index SHALL contain a **Backend section** organized by Module_File, listing every public function, class, and route handler with a one-line description. Example format:
   ```
   ## Backend
   ### src/backend/models.py
   - `Chit` — Pydantic model for chit records
   - `Settings` — Pydantic model for user settings
   ...
   ### src/backend/routes/chits.py
   - `GET /api/chits` — list all non-deleted chits
   - `POST /api/chits` — create a new chit
   ...
   ```
3. THE Index SHALL contain a **Frontend JS section** organized by directory and file, listing every global function with a one-line description. Example format:
   ```
   ## Frontend JavaScript
   ### src/frontend/js/shared/shared-utils.js
   - `generateUniqueId()` — create a unique ID string
   - `formatDate(date)` — format a Date as YYYY-Mon-DD
   ...
   ### src/frontend/js/dashboard/main-calendar.js
   - `renderWeekView()` — render the 7-day week calendar grid
   ...
   ```
4. THE Index SHALL contain a **Frontend CSS section** organized by directory and file, listing the major rule groups or sections in each stylesheet.
5. THE Index SHALL contain a **Load Order section** documenting the required `<script>` tag order for each HTML page.
6. THE Index SHALL contain a **File Dependency Map** showing which files depend on which other files (e.g., `shared-checklist.js` depends on `shared-utils.js` and `shared-touch.js`).

### Requirement 12: Update Template, Documentation, and Deployment Configuration

**User Story:** As a developer, I want all templates, documentation, and deployment files updated to reflect the new directory structure, so that new development and deployments work correctly.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL update `src/frontend/html/_template.html` to include all shared Sub_Scripts in the correct load order with the new paths, and add a comment documenting the required script load order for new pages.
2. THE Decomposition_Engine SHALL update `start.sh` to use the new uvicorn module path (`src.backend.main:app`).
3. THE Decomposition_Engine SHALL update `cwoc.service` to use the new uvicorn module path.
4. THE Decomposition_Engine SHALL update `install/configurinator.sh` to reference the new directory paths.
5. THE Decomposition_Engine SHALL update `README.md` and `documentation/overview.md` to reflect the new project structure.
6. THE Decomposition_Engine SHALL update any steering files (`.kiro/steering/`) that reference the old directory paths.
7. WHEN the backend references `/app/VERSION`, THE Decomposition_Engine SHALL preserve that path since it is an absolute production path independent of the source code structure.
8. THE Decomposition_Engine SHALL update all `window.location.href` assignments and `fetch()` URL references in JavaScript that navigate to frontend pages to use the new paths (e.g., `/frontend/html/editor.html`).

### Requirement 13: Reorganize Data Directory for Contact Assets and Future Data Types

**User Story:** As a developer, I want contact profile images and key files stored in a well-organized `data/contacts/` directory structure instead of scattered under `static/`, so that user-generated data is separated from application assets and the layout scales cleanly for future data types like email attachments.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL create the following subdirectories within the top-level `data/` directory (the same directory referenced in Requirement 1 AC2):
   ```
   data/
     app.db                        (existing — SQLite database)
     contacts/
       profile_pictures/            (contact profile images, moved from /app/static/contact_images/)
       pgp_keys/                    (PGP key files for contacts)
   ```
2. THE Decomposition_Engine SHALL move all existing contact profile image files from `/app/static/contact_images/` into `data/contacts/profile_pictures/`, preserving filenames.
3. THE Decomposition_Engine SHALL update `CONTACT_IMAGES_DIR` in the backend from `/app/static/contact_images/` to the new `data/contacts/profile_pictures/` path.
4. THE Decomposition_Engine SHALL update the `upload_contact_image` route handler to save uploaded images to `data/contacts/profile_pictures/` and store the updated URL path in the `image_url` database column.
5. THE Decomposition_Engine SHALL update the `delete_contact_image` route handler to resolve and delete image files from `data/contacts/profile_pictures/`.
6. THE Decomposition_Engine SHALL add a FastAPI `StaticFiles` mount (or equivalent serving mechanism) so that profile images in `data/contacts/profile_pictures/` are accessible via HTTP at a stable URL path.
7. THE Decomposition_Engine SHALL write a data migration that updates all existing `image_url` values in the contacts table from the old path prefix (`/static/contact_images/`) to the new serving path.
8. WHEN the migration encounters a contact with a NULL or empty `image_url`, THE Decomposition_Engine SHALL skip that row without error.
9. THE Decomposition_Engine SHALL organize the `data/` directory so that future data types (e.g., `data/email/attachments/`) can be added as sibling directories without restructuring existing paths.
10. THE Decomposition_Engine SHALL create the `data/contacts/pgp_keys/` directory as an empty placeholder for future PGP key file storage.
11. THE Decomposition_Engine SHALL remove the old `/app/static/contact_images/` directory after all images have been moved and the migration has completed.
12. THE Decomposition_Engine SHALL ensure the frontend contact pages (people.html, contact-editor.html) continue to display profile images correctly using the new URL path.

### Requirement 14: Execute Restructuring in Isolated Phases with a Master Plan

**User Story:** As a developer, I want the restructuring executed in isolated, sequential phases — each completing one logical unit of work — so that I can verify each phase independently, catch problems early, and never have the entire codebase in a broken state.

#### Acceptance Criteria

1. THE Decomposition_Engine SHALL create a `mega_restructure_plan.md` file at the project root that serves as the master tracking document for all restructuring phases.
2. THE mega_restructure_plan.md SHALL define each phase with a clear name, description, list of files affected, verification steps, and a completion checkbox.
3. THE Decomposition_Engine SHALL organize the restructuring into the following phases (executed in order):
   - **Phase 1: Create directory structure** — Create all new directories (`src/backend/`, `src/backend/routes/`, `src/frontend/html/`, `src/frontend/js/`, `src/frontend/css/`, `data/contacts/`, etc.) without moving or modifying any existing files.
   - **Phase 2: Reorganize data directory** — Move contact images to `data/contacts/profile_pictures/`, create `data/contacts/pgp_keys/`, update backend paths and DB migration (Requirement 13).
   - **Phase 3: Split backend/main.py** — Extract Python modules (`models.py`, `db.py`, `migrations.py`, `serializers.py`, `weather.py`, route files) and verify the backend starts and all API endpoints respond correctly (Requirement 2).
   - **Phase 4: Move backend to src/backend/** — Relocate the split backend files into `src/backend/`, update `DB_PATH`, `StaticFiles` mounts, uvicorn startup, and deployment configs (Requirement 1 backend portions, Requirement 12).
   - **Phase 5: Split frontend/shared.js** — Extract shared Sub_Scripts, update all HTML files to load them in the correct order, verify all pages load without errors (Requirement 5).
   - **Phase 6: Split frontend/main.js** — Extract dashboard Sub_Scripts, update `index.html` script tags, verify all dashboard views and interactions work (Requirement 3).
   - **Phase 7: Split frontend/editor.js** — Extract editor Sub_Scripts, update `editor.html` script tags, verify all editor zones and save behavior work (Requirement 4).
   - **Phase 8: Split frontend/styles.css** — Extract dashboard Sub_Stylesheets, update `index.html` link tags, verify visual rendering matches pre-split state (Requirement 6).
   - **Phase 9: Move frontend to src/frontend/** — Relocate all frontend files into `src/frontend/html/`, `src/frontend/js/`, `src/frontend/css/`, update all paths in HTML, JS, and backend (Requirement 1 frontend portions).
   - **Phase 10: Move static assets to src/static/** — Relocate static assets, update `StaticFiles` mount and all references (Requirement 1 static portions).
   - **Phase 11: Create INDEX.md and finalize documentation** — Generate the function/file index, update all documentation, templates, and steering files (Requirements 11, 12).
   - **Phase 12: Cleanup** — Remove old empty directories, verify no broken references remain, final end-to-end verification.
4. EACH phase SHALL have its own task list (either inline in `mega_restructure_plan.md` or as a linked spec task file) with granular checkboxes for each step.
5. EACH phase SHALL include a verification section listing specific checks to confirm the phase completed successfully (e.g., "all API endpoints return 200", "all pages load without console errors", "no broken image references").
6. THE Decomposition_Engine SHALL ensure each phase leaves the application in a fully working state — no phase SHALL introduce changes that require a subsequent phase to restore functionality.
7. IF a phase fails verification, THE developer SHALL be able to revert that single phase without affecting prior completed phases.
8. THE mega_restructure_plan.md SHALL track overall progress with a summary table showing phase name, status (Not Started / In Progress / Complete), and completion date.
