# 20260505 Highlights

- Integrated Milkdown WYSIWYG markdown editor for Notes zone
- Cross-folder email thread grouping
- Fixed database locking issues with email sync

---

## 20260505.2256

Integrated Milkdown WYSIWYG markdown editor into the chit editor's Notes zone. The editor provides inline rich text editing (headings, bold, italic, lists, blockquotes, code, links) while storing standard markdown. Self-hosted ESM bundles loaded via import map — no build step or npm required. Includes a format toolbar, `[[` chit link autocomplete, full-screen modal editing, content bridge to the existing save system, parchment theme CSS, link security hardening, and graceful fallback to plain textarea when vendor files are unavailable. Updated configurator with Milkdown download step, help documentation, and property-based tests for filtering, insertion format, paste sanitization, and XSS prevention.

## 20260505.2216

— Email Sync Improvements

- Email sync now fetches newest messages first and processes ALL messages (no max_pull cap), committing in batches of 50
- Sync response includes per-account details (nickname, messages found, new count, since date)
- Check Mail toast shows account-specific results
- Failed accounts turn their sidebar pill red with a pulse animation instead of a generic error toast
- Clicking a red error pill shows a persistent toast with full error details and a "Copy Error" button
- Successful syncs clear the error state on that account's pill
- Fixed database locking (WAL mode + busy_timeout)
- Fixed startup crash (sqlite3 import in main.py)
- Fixed duplicate try: block in email.py

## 20260505.2154

— Database Locking Fix + Email Improvements

Fixed "database is locked" errors that were blocking email sync and auth. Added WAL journal mode (set at init, persists at file level) and 5-second busy_timeout on middleware connections so concurrent requests wait instead of failing. Added sync diagnostic logging. Also: discard draft button, reply/forward deduplication (won't create duplicate drafts), email card hover contrast fix, and thread ribbon visual on dashboard.

## 20260505.2122

— Discard Draft Button + Thread Fixes

Added "Discard" button to the email zone header and expand modal for draft emails. Confirms before soft-deleting the draft and navigating back. Styled with a dark red danger color to distinguish from Send. Also fixed thread grouping — restored subject-based matching (matching backend behavior) with Re:/Fwd: prefix awareness, and switched to Option B ribbon visual for threaded emails on the dashboard.

## 20260505.2035

— Cross-Folder Thread Grouping

Fixed thread grouping to work across email folders. Previously, threads were only grouped within the current folder view (inbox/sent/drafts), so a received email and its sent reply wouldn't stack together. Now builds the thread map from ALL emails regardless of folder, then displays stacked cards for any thread that has at least one message in the current view. Expanding a thread shows all messages including those from other folders, with a small folder tag indicator.

## 20260505.2030

— Thread Grouping Fix

Fixed email thread grouping on the dashboard not displaying. The issue was twofold: (1) processing order — replies were processed before their parents, so In-Reply-To lookups failed; now processes oldest-first to build the thread map correctly. (2) CSS pseudo-elements were clipped by the scroll container's overflow; switched to box-shadow technique for the stacked parchment layers which works within overflow contexts. Also syncs the threaded toggle checkbox state when switching to the Email tab.

## 20260505.2025

— Stacked Parchment Thread View

Added threaded email grouping on the dashboard Email tab. Emails in the same conversation are visually grouped with a "stacked parchment" effect — layered card edges behind the latest message with a count badge. Clicking the badge expands the thread inline showing all messages. A "Group threads" toggle in the email sidebar switches between threaded and flat views. Also fixed the editor thread list not refreshing after sending, and added collapsible stack for long threads (>3) in the editor.

## 20260505.2019

— Email Thread UI Improvements

Fixed thread list not refreshing after sending an email from the editor. Added collapsible "stacked parchment" view for threads with more than 3 messages — shows a layered card preview with message count that expands to the full scrollable thread list on click.

## 20260505.2005

Added field-scoped search to Global Search. You can now use `field:value` or `field:(multi word)` syntax to restrict searches to specific fields (title, note, location, status, priority, people, checklist, child, sender, to, cc, bcc, body, subject, due, start, end, assigned, etc.). Combines with existing boolean operators and tag filters.

## 20260505.1957

## v20260505.1957

Extracted live preview split layout into shared CSS classes in shared-editor.css: `.cwoc-lp-split.cwoc-lp-vertical` (side-by-side, used by notes modal) and `.cwoc-lp-split.cwoc-lp-horizontal` (stacked, used by email expand modal). Vertical collapses to stacked on mobile. Removed the old page-specific `.notes-live-preview-wrap` CSS.

## 20260505.1956

## v20260505.1956

Fixed live preview to use shared code (`cwocWireLivePreview`/`cwocUpdateLivePreview` in shared-utils.js) for both Notes and Email expand modals — one function, two callers. Fixed notes live preview treating content as a single line by switching from contenteditable div to textarea. Renamed toggle labels to "Live" / "Render". Moved Render button to the left of the toggle so it doesn't shift. Made the 2-value toggle clickable anywhere (delegated click handler in shared-utils.js).

## 20260505.1944

Unified tag management code. Both the settings page and chit editor now use the exact same shared code path: `cwocTagModal.open()` for the UI, and `createTagInline`/`updateTagInline`/`deleteTagInline` from `shared-tags.js` for persistence. Removed the `skipPersist` option and all settings-page-specific tag modal wrappers. The settings page tag tree now reads from the API after each change, same as the editor.

## 20260505.1942

Fixed tag creation from the chit editor not persisting. Removed duplicated persistence logic from `shared-tag-modal.js` and replaced it with calls to the shared functions in `shared-tags.js` (`createTagInline`, `updateTagInline`, `deleteTagInline`). Both the settings page and the editor now use the exact same code path for tag CRUD operations.

## 20260505.1940

## v20260505.1940

Unified markdown editing modes across Notes and Email zones. Both the Notes expand modal and Email expand modal now have a 2-value pill toggle to switch between "Edit/Render" mode (toggle between editing and seeing rendered markdown) and "Live Preview" mode (side-by-side input and real-time rendered output). The small Notes zone and small Email zone use Edit/Render toggle only. Also extracted the settings pill toggle (Man/Woman, Imperial/Metric) into a reusable `.cwoc-2val-toggle` CSS class in shared-editor.css, replacing inline styles across settings and contact-editor pages.

## 20260505.1936

Fixed realtime tag filtering. Added `data-tag-row` attribute to each rendered tag tree row in `renderTagTree` for reliable DOM selection. Rewrote `_filterTagTree` to hide all rows first, then show only those whose full path matches the query, walking up the DOM to reveal ancestor containers and parent group headers.

## 20260505.1917

Upgraded the "Send to chit" modals (for notes, whole checklist, and single item) to use the full server-side search API with boolean operators (&&, ||, !, (), #tag) — matching the global search capability. Removed the limited client-side status dropdown filter and replaced it with the same search input + Go button pattern used by the dashboard search.

## 20260505.1909

Fixed the tag zone expand/collapse button to start in "Collapse" state (matching the default expanded tree). Fixed the tag filter input to work as realtime as-you-type filtering — it now correctly targets the rendered div rows and span badges produced by `renderTagTree`, showing/hiding rows and their parent group containers based on the search query.

## 20260505.1905

Simplified the editor tag zone: removed the X/clear button and + Add button, replaced with a single text input that filters the tag tree as-you-type. Extracted tag zone CSS (`.tags-search-row`, `.tag-container`, `.tag-container-Active`, `.verticalBox`) from `editor.css` into `shared-editor.css` so both the chit editor and settings page share consistent styling.

## 20260505.1902

Added per-item "Send to chit" feature for checklist items. Hovering a checklist item now shows a 📤 icon that opens a quick popup with the 3 most recently edited chits (copy/move buttons) plus a "Search..." button for the full chit picker modal. Moving/copying includes all child items and auto-demotes nested items to top-level. Also added a brief ↓ flash arrow when adding new checklist items from the input box.

## 20260505.1855

Checklist ↔ Note conversion now uses proper markdown task list format (`- [ ] item` / `- [x] item`) with 2-space indentation for sub-levels. Note-to-checklist also preserves checked state from markdown checkboxes.

## 20260505.1849

Fixed "Add to Project" from a child chit's editor not working — the backend generates its own UUID for new chits, so the pending project addition was referencing the wrong ID. Now correctly updates the child chit ID after save before executing the project linkage. Also ensures child chits automatically get status "ToDo" when added to a project if they don't already have one.

## 20260505.1827

Extracted the tag creation/editing modal from the settings page into a shared component (`shared-tag-modal.js`) and integrated it into the chit editor. Users can now create, rename, recolor, set favorites, delete, and manage sharing for tags directly from the editor's tag zone without navigating to settings. The settings page continues to use the same shared modal with its batch-save model preserved via a `skipPersist` option.

## 20260505.1350

Fixed project Kanban not showing child chits with lowercase statuses (e.g. "todo" instead of "ToDo"). Added case-insensitive status normalization to the dashboard Kanban grouping logic, matching what the editor already does.

## 20260505.1345

Admin Chit Manager now uses the same boolean search engine as global search (supports #tags, &&, ||, !, parentheses). Added status filter dropdown, "No Status" filter option, bulk Set Priority action, and increased result limit to 1000. Search logic extracted into shared `_search_filter_chits()` function in chits.py — no code duplication.

## 20260505.1322

Added Admin Chit Manager tool with styling matching the User Admin page. Uses cwoc-table, status badges, action buttons, admin-toolbar, bulk-bar, and mobile-responsive patterns consistent with the existing admin UI. Accessible from Settings → Administration → 🔧 Chit Manager.

## 20260505.1319

Added Admin Chit Manager tool (Settings → Administration → Chit Manager). Allows admins to search all chits regardless of owner, filter by owner or orphaned chits with no owner, and perform bulk updates (set owner, set status, delete/undelete). Also fixed project views auto-pruning stale child references that point to inaccessible or deleted chits.

## 20260505.1159

Fixed project views (Kanban and list) not showing all child chits. The dashboard was only displaying children already in the global chits array, silently skipping any that were missing. Both views now fetch missing child chits on demand before rendering. Also fixed the editor's project zone showing soft-deleted children that should be hidden.

## 20260505.1152

Removed the fixed-height scroll constraint on the tags zone in the chit editor so the tag containers expand to fit all tags without needing to scroll in a small box.

## 20260505.1137

Fixed "Add to Project" in editor: now defers the project master update until the user clicks Save (instead of saving immediately). Also auto-sets status to "ToDo" if empty when adding to a project, with a note in the toast. Fixed the underlying PUT failure by re-serializing JSON fields (weather_data, health_data, email_to/cc/bcc) before saving project masters.

## 20260505.1128

Fixed Projects view issues: creating a chit from the Projects tab now auto-populates status to "ToDo"; adding a chit to a project via the "Add to Project" dropdown now saves the chit first if it's new (preventing dangling references); clearing status on a child chit now warns that it will remove the chit from its project.

## 20260505.1051

People filter now shows one person per line (no wrapping) and expands fully without internal scrolling. Removed the 9-item cap from CwocSidebarFilter so all tags/people show. Removed max-height from .cwoc-sidebar-filter-list. Merged Sharing filters into the Display group.

## 20260505.1031

Arrange Views modal buttons now equal width and properly styled — Cancel (left), Reset to Default (center), Done (right, highlighted). Fixed hidden tabs not being hidden on the dashboard after save.

## 20260505.1029

Added a "Hidden" zone to the Arrange Views modal. Tabs dragged into the Hidden zone are no longer displayed as buttons on the dashboard tab bar, but remain fully accessible via hotkeys, search, and other navigation. Drag tabs back to the visible row to restore them.

## 20260505.1028

Fixed browser authentication popup (username/password dialog) appearing when navigating back to the dashboard. Added a middleware layer that strips the WWW-Authenticate header from all 401 responses, preventing the browser from showing its built-in auth challenge regardless of which code path generates the 401.

## 20260505.1025

Fixed Arrange Views modal — modal now expands to fit all tabs on one line instead of constraining width and adding a scrollbar.

## 20260505.1024

Fixed Arrange Views modal tabs wrapping to two lines — added flex-shrink: 0 to force all tabs onto a single scrollable row.

## 20260505.1023

Arrange Views modal now displays tabs in a single non-wrapping horizontal line with overflow scroll. Swapped button order to Cancel / Reset to Default / Done, and added a Cancel button that reverts any unsaved drag changes.

## 20260505.1017

Added per-user "Arrange Views" setting that lets you drag-reorder the dashboard tab bar. Accessible via a button in Settings > Display Options. The modal shows tabs styled like the real dashboard buttons, supports drag-and-drop (desktop and mobile touch), and includes a reset-to-default option. The custom order is applied on dashboard load.

## 20260505.1016

Project zone overhaul:
- All status dropdowns are now fixed-width (110px) for visual consistency
- Added ✕ "Remove from project" button on each child chit card (unlinks without deleting, with confirmation)
- Delete child chit confirmation now shows "child" in red, bold, underlined — matches the main editor delete style
- `cwocConfirm` now supports `html: true` option for rich confirmation messages
- Fixed `renderKanbanBoard` reference error (was calling non-existent function)
- Fixed overflow: project zone content now clips horizontally and scrolls vertically
- Move-to-project button only shows when multiple projects exist

## 20260505.1003

Reordered views header tabs: moved Alerts to just before Global Search, moved Tasks to before Projects. New order: Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, Alerts, Search.

## 20260505.0750

Moved Home Assistant into the Dependent Apps block as a collapsible subsection. Button shows a lightning bolt icon (green when connected, dim when unconfigured) with "Home Assistant" on hover. Removed collapse arrows from the Dependent Apps group.

## 20260505.0739

Added checklist auto-save. Checklist changes (add, delete, check, reorder) are now automatically saved to the server after a 1.5s debounce, without requiring a full chit save. Other fields still require the normal Save button. Includes a per-user global setting (default: on) in Settings → Chit Options, and a per-chit toggle button in the checklist zone header to override the global. A brief "✓ saved" indicator flashes in the zone header on successful auto-save.

## 20260505.0711

Refined the Project filter dropdown: renamed default to "—", added "Any (has a project)" and "None (no project)" special options at the top with a distinct background color. Styled the dropdown to match the sidebar's Lora font, parchment background, and custom caret arrow consistent with other filter inputs.

## 20260505.0708

## Release 20260505.0708

Global search now supports full boolean expressions on both text and tags. `&&` (AND, default), `||` (OR), `!` (NOT), and `()` grouping all work on any term. Examples: `el !hello` finds "elizabeth" but excludes "hello"; `(meeting || lunch) && #work && !cancelled` combines text and tag logic. Sub-tag hierarchy matching preserved.

## 20260505.0707

Added a Project filter dropdown to the sidebar. When a project is selected, all views (Calendar, Tasks, Checklists, Notes, Alarms) are filtered to only show child chits of that project (plus the project master itself). The filter integrates with the existing Clear All button and is populated dynamically from project masters.

## 20260505.0654

Added 6-dot drag indicators (⠿) to checklist items in both the editor and dashboard inline checklists, providing a clear visual affordance for drag-to-reorder especially on mobile/touch devices.

## 20260505.0613

Added full bidirectional Home Assistant integration: CWOC backend HA bridge module with service calls, event firing, entity state polling, and webhook receiver; HA custom integration package (`ha_integration/custom_components/cwoc/`) with config flow, DataUpdateCoordinator, sensor platform (chit counts + tag sensors), and six service actions (create_chit, add_checklist_item, update_chit, set_chit_status, add_tag, remove_tag); rules engine extended with call_ha_service and fire_ha_event actions plus ha_state_change and ha_webhook triggers; frontend settings page HA configuration panel, rule editor HA action/trigger UI with entity and service pickers; 17 property-based tests (39 test methods) covering stats computation, config round-trip, webhook validation, template substitution, state change detection, and more; help page documentation section; and configurinator HA deployment function.
