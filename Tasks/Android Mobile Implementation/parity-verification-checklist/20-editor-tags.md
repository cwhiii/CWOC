# Tags

**Category:** Editor Zones
**Item #:** 20
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Tag Zone Structure (editor.html)

- [ ] `<div id="tagsSection" class="zone-container">` — Tags zone container
- [ ] `<div id="tagsContent" class="zone-body">` — Tags zone body (collapsible)
- [ ] Zone header with `toggleZone(event, 'tagsSection', 'tagsContent')` — Expand/collapse
- [ ] `<span class="zone-toggle-icon">` — Expand/collapse icon (🔼/🔽)

### Tag Zone Header Buttons (editor.html)

- [ ] Expand/Collapse All button (`id="tags-expand-collapse-btn"`) — Toggles all tag tree nodes
- [ ] Create Tag button (`onclick="createTag(event)"`) — Opens tag creation modal
- [ ] Settings button (`onclick="navigateToSettings()"`) — Navigates to settings page for tag management

### Active Tags Display (editor.html + editor-tags.js)

- [ ] `<div id="activeTagsListContainer">` — Container for active tag chips (selected tags)
- [ ] `<span id="activeTagsCount">` — Count of active non-system tags
- [ ] Each active tag chip: colored background, tag name text, ✕ remove button
- [ ] Click on active tag chip → `editTag(e, tagName)` — Opens tag edit modal
- [ ] ✕ button on chip → removes tag from selection, re-renders

### Tag Search (editor.html + editor-tags.js)

- [ ] `<input id="labels">` — Tag search/filter input
- [ ] `_filterTagTree(query)` — Filters tag tree in realtime (hides non-matching rows)
- [ ] `clearTagSearch(event)` — Clears search input and resets filter

### Favorites Row (editor-tags.js)

- [ ] `<div id="favTags">` — Favorites container
- [ ] Favorite tag chips: ★ star prefix, colored background, click to toggle selection
- [ ] Outline highlight when tag is selected (`outline:2px solid #8b5a2b`)

### Recent Tags Row (editor-tags.js)

- [ ] `<div id="mostRecentTags">` — Most recent tags container
- [ ] Recent tag chips: colored background, click to toggle selection
- [ ] `getRecentTags()` — Gets recently used tags from localStorage
- [ ] `trackRecentTag(fullPath)` — Tracks tag usage for recents

### Tag Tree (editor-tags.js)

- [ ] `<div id="tagTreeContainer">` — Tag tree container
- [ ] `_renderTags(tags, selectedTags)` — Master render function for entire tag zone
- [ ] `buildTagTree(tags)` — Builds nested tree structure from flat tag list (from shared-tags.js)
- [ ] `renderTagTree(treeContainer, tree, selectedTags, callback)` — Renders tree with checkboxes (from shared-tags.js)
- [ ] Tree nodes: expandable/collapsible with ▼/▶ arrows
- [ ] Tag rows: `[data-tag-row="fullPath"]` — Each tag row with full path data attribute
- [ ] Child containers: `[data-tag-children]` — Nested child containers
- [ ] Click on tag row → toggles selection, calls callback

### Tag Selection Logic (editor-tags.js)

- [ ] Auto-color: first non-system tag selected auto-applies its color to chit (if chit color is transparent)
- [ ] System tags excluded from active count and active tags display
- [ ] `window._currentTagSelection` — Global array of currently selected tag paths
- [ ] Selection persisted via `_renderTags` callback → `setSaveButtonUnsaved()`

### Expand/Collapse Functions (editor-tags.js)

- [ ] `toggleAllTags(event, expand)` — Expands or collapses all tag tree nodes
- [ ] `_toggleTagsExpandCollapse(event)` — Toggles expand/collapse state
- [ ] `_updateTagsExpandCollapseBtn()` — Updates button icon/text
- [ ] `var _tagsAllExpanded` — Tracks current expand/collapse state

### Tag CRUD (editor-tags.js)

- [ ] `createTag(event)` — Opens `cwocTagModal` for new tag creation
- [ ] `editTag(event, tagName)` — Opens `cwocTagModal` for editing existing tag
- [ ] On save callback: adds to selection, invalidates settings cache, re-renders
- [ ] On delete callback: removes from selection, invalidates settings cache, re-renders

### Data Loading (editor-tags.js)

- [ ] `_loadTags()` — Fetches all tags via `loadAllTags()` (from shared)
- [ ] Tags loaded from settings API, rendered with colors and hierarchy
- [ ] `_invalidateSettingsCache()` — Invalidates cached settings after tag CRUD

### Navigation (editor-tags.js)

- [ ] `navigateToSettings()` — Saves return URL to localStorage, navigates to settings page
