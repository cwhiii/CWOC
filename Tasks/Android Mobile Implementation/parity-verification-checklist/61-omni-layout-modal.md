# Omni Layout Modal

**Category:** Modals & Overlays
**Item #:** 61
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (settings.js)
- [ ] _openOmniLayoutModal — Opens the Omni Layout modal; renders the layout grid
- [ ] _closeOmniLayoutModal — Closes the modal (sets display: none)
- [ ] _renderOmniLayoutGrid — Renders the full drag-and-drop layout configurator with three zones (Full Width, Left/Right columns, Unused)
- [ ] _buildOmniLayoutCard(area) — Creates a single draggable card element for a layout area with label and "Hide When Empty" toggle
- [ ] _setupOmniDragListeners — Attaches drag-and-drop event listeners to all cards and drop zones
- [ ] _recalcOmniPositions — Recalculates position values after a drag-drop operation
- [ ] _loadOmniLayout(settings) — Loads saved layout from settings, merging with defaults for any new areas
- [ ] _collectOmniLayout — Serializes current layout state to JSON for saving
- [ ] _getDefaultOmniLayout — Returns the default layout configuration
- [ ] _resetOmniViewDefaults — Resets layout to defaults and re-renders

### Layout Areas (configurable sections)
- [ ] hst — 📊 HST Bar (full width, hideWhenEmpty: true)
- [ ] weather — 🌤️ Weather Bar (full width, hideWhenEmpty: true)
- [ ] calendar — 📅 Calendar (half width, left column)
- [ ] tasks — ✅ Tasks (half width, right column)
- [ ] checklists — ☑️ Checklists (half width, left column)
- [ ] notes — 📝 Notes (half width, right column)
- [ ] projects — 📋 Projects (half width, left column)
- [ ] email — ✉️ Email (half width, right column)
- [ ] indicators — 💓 Indicators (half width, left column)
- [ ] alarms — 🔔 Alerts (half width, right column)

### Drop Zones
- [ ] Full Width zone (top) — For sections that span the entire width
- [ ] Left Column — Left half of the two-column layout
- [ ] Right Column — Right half of the two-column layout
- [ ] Unused zone — For hidden/disabled sections (drag here to hide)

### Card Controls
- [ ] Draggable card — Each area is a draggable card with label and icon
- [ ] "Hide When Empty" checkbox — Per-card toggle; when checked, section is hidden if it has no content
- [ ] Drag handle — Entire card is draggable (draggable=true attribute)

### Drag-and-Drop Behavior
- [ ] dragstart — Sets dragged card reference and area ID, adds .dragging class
- [ ] dragend — Clears dragging state and insertion indicators
- [ ] dragover on lists — Shows insertion indicator (border-top or border-bottom on nearest card)
- [ ] dragleave — Removes drop highlight
- [ ] drop — Determines target zone and insert position; updates area's width/column/visible/position; re-renders grid

### Zone Assignment Logic
- [ ] Full Width zone → area.width = 'full', area.visible = true, area.column = null
- [ ] Left Column → area.width = 'half', area.visible = true, area.column = 'left'
- [ ] Right Column → area.width = 'half', area.visible = true, area.column = 'right'
- [ ] Unused zone → area.visible = false

### Visual Indicators
- [ ] Drop highlight class — .omni-drop-highlight on target list during dragover
- [ ] Insertion indicator — Border-top or border-bottom on cards to show drop position
- [ ] Hidden area styling — .hidden-area class for cards in the Unused zone
- [ ] Empty zone hints — "Drop sections here for full width", "Drop here", "Drag sections here to hide them"

### Column Labels
- [ ] "Full Width (top)" label
- [ ] "Left Column" label
- [ ] "Right Column" label
- [ ] "Unused" label

### State
- [ ] _omniLayoutAreas — Default area definitions array
- [ ] _omniLayoutState — Current layout state (array of area objects with id, width, visible, position, column, hideWhenEmpty)

### Persistence
- [ ] Saved as omni_layout JSON string in settings
- [ ] setSaveButtonUnsaved() called after any drag-drop change
