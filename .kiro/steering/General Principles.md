---
inclusion: always
---
# DO NOT TRY TO INSTALL ANY SOFTWARE AT ANY POINT! ONLY BUILD THE CODE!
- DO NOT TRY TO INSTALL ANY SOFTWARE AT ANY POINT! ONLY BUILD THE CODE! 
- update the task list to skip any installs!
- Ensure that no step in a test requires installing software, such as with ".venv/bin/python."



no installs, no pip, no npm.
DO NOT INSTALL THINGS!

# General Principles

## DRY — Don't Repeat Yourself
- Before writing a new helper, check `shared.js` and `shared-page.js` for an existing equivalent.
- Reuse `shared-page.css` for all secondary pages. Only add page-specific styles when truly unique to that page.
- Extract repeated logic into parameterized functions rather than copy-pasting across files.
- **Never use inline styles in JS for things that belong in a shared CSS file.** If you're injecting DOM elements from JS, define the CSS classes in `shared-page.css` (or `styles.css` for dashboard-only) and just assign the class names. Inline style injection via JS `<style>` tags is a last resort, not a default.
- **Proactively consolidate.** When adding new functionality, always check: can this reuse an existing shared pattern? Would a small refactor to an existing shared file make this cleaner for everyone? If the cost is trivial, do it. If it's not worth the change, leave a comment explaining why.
- **One source of truth.** If the same HTML structure, CSS, or JS logic appears on multiple pages, it must live in a shared file (`shared-page.js`, `shared-page.css`, `shared.js`). Page-specific files should only contain what's truly unique to that page.

## Keep It Simple
- This is a vanilla JS/HTML/CSS project with no frameworks and no build step. Do not introduce bundlers, transpilers, or JS module systems.
- Prefer straightforward, readable code over clever abstractions. Favor flat control flow with early returns and guard clauses over deep nesting.
- Solve the current problem cleanly. Only refactor when a pattern repeats three or more times.

## Naming Conventions
- Python (backend): `snake_case` for variables, functions, and route names.
- JavaScript (frontend): `camelCase` for variables and functions. Prefix private/internal helpers with `_` (e.g., `_calDragState`, `_onCalDragMove`).
- CSS: `kebab-case` for class names. Prefix CWOC-specific shared classes with `cwoc-` (e.g., `cwoc-table`, `cwoc-btn`, `cwoc-empty`).
- HTML data attributes: `kebab-case` (e.g., `data-chit-id`, `data-page-title`).

## Consistency
- Match the style and structure of surrounding code when editing a file. Continue existing patterns.
- All API endpoints live under `/api/` and follow REST conventions — JSON in, JSON out.
- Frontend globals (e.g., `_globalTimeFormat`, `_calSnapMinutes`) are loaded from `/api/settings/default_user` at page init.
- Use `async/await` with `try/catch` for all `fetch` calls. Log errors with `console.error`.

## Minimal Surface Area
- Keep changes focused. When fixing a bug or adding a feature, avoid unrelated refactors in the same change.
- New frontend pages must start from `src/frontend/html/_template.html` and use `shared-page.js` for automatic header/footer injection (triggered by `data-page-title` on `<body>`).
- Database schema changes go in `src/backend/migrations.py` as inline migration functions with column-existence checks — no external migration tools.
- JSON-serialized fields (`tags`, `checklist`, `alerts`, `recurrence_rule`, etc.) use `serialize_json_field` / `deserialize_json_field` helpers in the backend.

## Code Quality
- Functions should do one thing. If a function exceeds ~40 lines, consider splitting it.
- Use descriptive variable and function names. Avoid single-letter names outside short loops or lambdas.
- Comment the "why," not the "what." Code should be self-explanatory; comments explain intent or non-obvious decisions.
- Handle errors gracefully — return meaningful JSON error responses from API endpoints, and show user-friendly messages in the UI.

## Frontend Architecture
- All JS is loaded via `<script>` tags in HTML — no ES modules, no imports. Load order matters: `shared.js` before page-specific scripts.
- The dashboard (`index.html` + `main.js` + `styles.css`) has its own independent styling. All other pages share `shared-page.css`.
- `CwocSaveSystem` (in `shared-page.js`) provides the standard save/cancel button pattern — use it for any page with editable state.
- External CDN libraries (Flatpickr, Font Awesome 6, marked.js) are loaded via `<link>` / `<script>` tags in HTML. Do not add npm dependencies.

## Typography & Contrast
- Text must be high-contrast and easily readable. Use dark colors (`#1a1208` or darker) on parchment backgrounds — never light brown on light brown.
- Avoid `opacity` values below 0.7 on text elements. If text looks faded, increase the opacity or darken the color.
- Base font size is 16px. Don't go below 14px for any user-facing text. Labels, table cells, and form elements should all be comfortably readable.
- When in doubt, make text darker and larger rather than lighter and smaller.

## Backend Architecture
- The backend is modular under `src/backend/`: `main.py` (entry point), `routes/` (6 route modules), `db.py`, `models.py`, `migrations.py`, `weather.py`, `serializers.py`.
- SQLite3 via Python stdlib. Single database file. No ORM.
- Pydantic v1 models for request validation. All fields use `Optional` with defaults.
- Soft delete throughout — chits are never hard-deleted. Use the `deleted` flag and `deleted_datetime` column.

## Escape Key Behavior
- ESC should NEVER navigate away from a page while any modal or overlay is open. It must close the topmost modal first.
- Only when no modals are open should ESC trigger page exit — and it must always check for unsaved changes before navigating.
- ESC priority chain: close QR modal → close upgrade/update modal → close tag modal → close delete confirm → close unsaved-changes modal → blur focused input → exit page (with save check).
- Every page that has modals must implement this layered ESC pattern. Don't rely on separate ESC listeners per modal — use a single handler that checks from innermost to outermost.

when adding code, ensure youre doing so in an organized manner. Use the applicable section if there is one, and if not, make a new section. 

Ensure there's no tasks that require installing software (no hypothisys!), or running the server here.

no installs, no pip, no npm.

## Help & Reference
Ensure that any time you change or add a feature that has or should have, documentaion that you update both the help & reference, as applicable.

## Versioning

Version numbering is: 
YYYYMMDD.time, with time in format HHMM.

As the last step of any change, call the real time and use that to  Update the version number every time you make changes. (via  src/VERSION)

NEVER guess the time! always run date "+%Y%m%d.%H%M", and use the returned value. 

ALSO: only do this ONCE at the VERY END of any set of work/tasks. Not multiple times throught the task.

## The Mega Index
There is an index. It contains a complete map of where every function is, and what it does. If this is helpful, use it for finding where to do work. Anytime you change something that would impact this, make sure you update the index. But only at the end of the task.

## Modularity
CWOC is broken up into a bunch of code files. Each one is very tight and directed. Ensure that code that you ad gets put in the correct file for the applicable functionality. If there is not a good file to place a new functionality into, find the best place to put a new file based on the structure and index, and then make the new file. The point of these is to keep each file relatively small and more maintainable. If you ever create new files, ensure you update the index file.

## Release Notes
Every time you complete a new version, update a file called "release_notes-[version#].md". In extremely brief summary of what you did. Most of these should be one sentence. Replace the entire contents of the file with your new version update description.

On some super long and complex new feature additions, it may be as much as a paragraph. But it should basically never exceed that.

In the settings page should be a button in the "🔄 Version & Updates" section, which you can click to bring up a model just like the upgrade one. It should show the HTML converted markdown from the file. It should have a simple dismiss button.

I'm sure that the release notes file is emtied, and rebuilt a the completion of every new feature.