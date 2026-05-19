# Arrange Views Modal

**Category:** Modals & Overlays
**Item #:** 62
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (settings-views.js)
- [ ] _openArrangeViewsModal — Opens the modal; loads current view_order from settings or defaults; renders the grid
- [ ] _closeArrangeViewsModal — Hides the modal (display: none)
- [ ] _cancelArrangeViews — Reverts to saved state and closes modal
- [ ] _resetViewOrder — Resets to default view order and re-renders
- [ ] _renderArrangeViewsGrid — Renders all view tab items in the Active and Hidden zones; includes fixed Omni tab
- [ ] _createViewTabItem(viewName) — Creates a single draggable tab button element with icon and label
- [ ] _setupArrangeViewsDrag — Attaches desktop drag-and-drop listeners to all items and zones
- [ ] _setupArrangeViewsTouch — Attaches touch-based drag support for mobile devices
- [ ] _applyNotebookExclusion — Enforces mutual exclusion: Notebook vs Notes/Checklists (most recently added wins)
- [ ] _getViewItemAtPointAll — Finds the view-tab-item element at a given point across multiple containers
- [ ] _collectViewOrder — Serializes current view order for saving (returns JSON string or null if default)

### Available Views
- [ ] Calendar — img icon (/static/calendar.png), label "<u>C</u>alendar"
- [ ] Checklists — img icon (/static/checklists.png), label "<u>C</u>hecklists"
- [ ] Tasks — img icon (/static/tasks.png), label "<u>T</u>asks"
- [ ] Projects — img icon (/static/projects.png), label "<u>P</u>rojects"
- [ ] Notes — img icon (/static/notes.png), label "<u>N</u>otes"
- [ ] Notebook — FA icon (fas fa-book), label "Note<u>b</u>ook"
- [ ] Email — FA icon (fas fa-envelope), label "<u>E</u>mail"
- [ ] Indicators — FA icon (fas fa-heartbeat), label "<u>I</u>ndicators"
- [ ] Alarms — img icon (/static/alerts.png), label "<u>A</u>lerts"

### Fixed Elements
- [ ] Omni tab — Always first, non-draggable (.view-tab-item-fixed), FA icon (fas fa-layer-group), label "<u>O</u>mni"

### Drop Zones
- [ ] Active views grid (#arrange-views-grid) — Visible tabs in display order
- [ ] Hidden views zone (#arrange-views-hidden) — Tabs hidden from the dashboard

### Drag-and-Drop (Desktop)
- [ ] dragstart — Sets dragged item, adds .dragging class, sets effectAllowed to 'move'
- [ ] dragend — Clears dragging state and border indicators
- [ ] dragover on items — Shows insertion indicator (borderLeft or borderRight based on cursor position relative to midpoint)
- [ ] dragleave — Removes border indicators
- [ ] drop on item — Determines insert position (before/after based on cursor), updates _currentViewOrder or _hiddenViews, re-renders
- [ ] drop on grid (empty area) — Appends to end of active views
- [ ] drop on hidden zone (empty area) — Appends to hidden views

### Touch Drag (Mobile)
- [ ] touchstart — Records start position, creates floating clone after 150ms delay
- [ ] touchmove — Moves clone to follow finger, shows insertion indicators on target items
- [ ] touchend — Determines drop target and position, updates arrays, re-renders
- [ ] touchcancel — Cleans up clone and state

### Mutual Exclusion Logic
- [ ] Notebook vs Notes/Checklists — When both are in active views, the most recently dropped item wins
- [ ] window._lastDroppedView — Tracks which view was just dropped for exclusion logic
- [ ] If Notebook dropped: Notes and Checklists move to hidden
- [ ] If Notes/Checklists dropped: Notebook moves to hidden

### State Variables
- [ ] _defaultViewOrder — Default tab order array
- [ ] _allAvailableViews — All possible views including hidden-by-default ones
- [ ] _currentViewOrder — Current active view order (array)
- [ ] _hiddenViews — Currently hidden views (array)
- [ ] _viewMeta — Metadata object with icon type, source, and label for each view

### Persistence
- [ ] Saved as view_order JSON string in settings
- [ ] setSaveButtonUnsaved() called after any reorder operation
