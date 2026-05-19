# Card Rendering (Tags, Color, Progress, People, Indicators, Map Thumbnails, Sharing Badges)

**Category:** Cross-Cutting Behaviors
**Item #:** 72
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-views.js`
- `src/frontend/js/shared/shared-indicators.js`
- `src/frontend/js/shared/shared-utils.js`
- `src/frontend/css/dashboard/styles-cards.css`

## Functions, Buttons, Controls & Inputs

### Core Card Rendering Functions

- [ ] `_buildChitHeader(chit, titleHtml, settings, opts)` — Main card header builder; assembles left (icons/indicators/title) and right (meta/tags/sharing) sections
- [ ] `_buildNotePreview(chit, extraStyle)` — Expandable note preview with markdown rendering and mobile show more/less toggle
- [ ] `_renderChitMeta(chit, mode)` — Legacy meta renderer (kept for backward compat)
- [ ] `_emptyState(message)` — Styled empty-state message with optional "Create Chit" button
- [ ] `displayChecklistView(chitsToDisplay)` — Full checklist view renderer with cards, inline checklists, masonry layout
- [ ] `_restoreViewModeButtons()` — Restores active/inactive styling on Projects/Alarms/Tasks mode buttons
- [ ] `_updateFavicon(tab)` — Updates browser favicon per active view tab

### Card Header — Left Side (Icons & Indicators)

- [ ] Pinned icon (`fas fa-bookmark`) — shown when `chit.pinned` is true
- [ ] Archived icon (`📦`) — shown when `chit.archived` is true
- [ ] Snoozed icon (`😴`) — shown when `chit.snoozed_until` is in the future, tooltip shows snooze-until time
- [ ] Timezone warning icon (`⚠️`) — shown when `chit._tzWarning` is true (unrecognized timezone)
- [ ] Stealth icon (`🥷`) — shown only to the owner when `chit.stealth` is true
- [ ] Sub-chit icon (`fas fa-project-diagram`) — shown when chit is a child of a project master
- [ ] Visual indicators (alerts, weather, people, recurrence) — via `_getAllIndicators(chit, settings, 'card')`
- [ ] Weather indicator — icon from `_getWeatherIcon(weatherCode)` with high/low temp tooltip
- [ ] Weather stale indicator (`⏳`) — shown when weather data is older than 1 hour
- [ ] Map pin icon (`fas fa-map-marker-alt`) — for non-default locations in compact views (skipped if `opts.skipMapIcon`)
- [ ] Title span (`chit-header-title`) — displays `titleHtml` or `chit.title` or "(Untitled)"
- [ ] Checklist count span — inline `(checked/total ✓)` when `opts.checklistCount` is true

### Card Header — Right Side (Meta & Badges)

- [ ] Status badge — text with sort indicator; Blocked status gets configurable background color + contrast text + chain icon for prereqs
- [ ] Priority badge — text display of priority value
- [ ] Due date badge — colored/bold if overdue with configurable `overdue_border_color`; format "Past Due: YYYY-Mon-DD" or "Due: formatted"
- [ ] Start date badge — "Start: formatted date"
- [ ] Point-in-time badge — "📌 formatted date"
- [ ] Modified date badge — "Updated: formatted date"
- [ ] Created date badge — "Created: formatted date"
- [ ] Tag chips — colored inline chips with `_getTagColor()` background and `_getTagFontColor()` text; system tags filtered out
- [ ] RSVP indicators — per-user status icons (✓ accepted, ✗ declined, ⏳ invited) with tooltip
- [ ] RSVP action buttons — Accept (✓) and Decline (✗) buttons for shared users; PATCH `/api/chits/{id}/rsvp`
- [ ] Shared icon (`🔗`) — tooltip shows owner, shared users with roles, current user's role
- [ ] Assignee badge (`📌 name`) — shown when `chit.assigned_to_display_name` is set

### Tag Color Helpers

- [ ] `_getTagColor(tagName)` — Returns tag color from cached settings, fallback to `getPastelColor()`
- [ ] `_getTagFontColor(tagName)` — Returns tag font color from cached settings, fallback to `#2b1e0f`

### Map Location Helpers

- [ ] `_hasNonDefaultLocation(chit)` — Checks if chit location differs from user's default saved location
- [ ] `_buildMapThumbnail(chit)` — Builds OSM tile thumbnail with pin overlay; respects `show_map_thumbnails` setting
- [ ] `_renderMapTile(container, lat, lon)` — Renders OSM tile image at zoom 14 with pin overlay
- [ ] `_buildMapIcon(chit)` — Simple map pin icon for compact views; respects `show_map_thumbnails` setting

### Shared Chit Helpers

- [ ] `_isViewerRole(chit)` — Returns true if chit is shared with viewer-only access
- [ ] `_isSharedChit(chit)` — Returns true if chit has `_shared` flag
- [ ] `_getUserRsvpStatus(chit)` — Returns current user's RSVP status from shares array
- [ ] `_isDeclinedByCurrentUser(chit)` — Returns true if current user declined this shared chit

### Card Color & Styling

- [ ] `applyChitColors(el, bgColor)` — Sets background color and auto-contrast font color
- [ ] `contrastColorForBg(hex)` — Returns dark or light text color for WCAG contrast
- [ ] `chitColor(chit)` — Returns the chit's display color (from shared.js)
- [ ] `.archived-chit` CSS class — applied when chit is archived
- [ ] `.declined-chit` CSS class — applied when current user declined the chit
- [ ] `.checklist-all-done` CSS class — applied when all checklist items are checked

### Card Interactions

- [ ] Double-click card → navigate to editor (`/editor?id={id}`)
- [ ] Double-click map thumbnail → navigate to maps page with focus on chit location
- [ ] Shift+click card → open quick-edit modal (disabled for viewer-role)
- [ ] Right-click card → open context menu (disabled for viewer-role)
- [ ] Note preview "show more…" / "show less" toggle (mobile)
- [ ] Long-press (mobile) → open quick-edit modal via `enableLongPress`
- [ ] Drag-to-reorder (mobile flat mode) via `enableDragToReorder`
- [ ] Masonry drag-reorder (desktop) via `enableNotesDragReorder`

### URL Hash Routing

- [ ] `_updateUrlHash()` — Updates URL hash to reflect current tab + mode
- [ ] `_parseUrlHash()` — Parses URL hash and returns `{ tab, mode }`
- [ ] `_hashTabModes` — Map of tab names to mode getter functions
- [ ] `_hashDefaultModes` — Default modes per tab (not shown in hash)

### View Filtering & Search

- [ ] `filterChits(tab)` — Main tab switch handler; updates UI, applies filters, dispatches to view renderers
- [ ] `searchChits()` — Triggers `displayChits()` on search input
- [ ] `highlightMatch(text, query)` — HTML-escapes text and wraps query matches in `<mark>` tags
