# Tasks

## Task 1: Frontend — Status Icon & Shared Indicators

- [x] 1.1 Add `'Rejected': '<i class="fas fa-times-circle" style="color:#9E9E9E;font-size:0.85em;"></i>'` to `_STATUS_ICONS` in `src/frontend/js/shared/shared-indicators.js`

## Task 2: Frontend — Editor Status Dropdown

- [x] 2.1 Add `<option value="Rejected">Rejected</option>` after the "Complete" option in the status `<select>` in `src/frontend/html/editor.html`

## Task 3: Frontend — Tasks View Updates

- [x] 3.1 Update `statusOrder` in `src/frontend/js/dashboard/main-views-tasks.js` to include `'Rejected': 6`
- [x] 3.2 Add "Rejected" to the status dropdown options array in the Tasks view card rendering
- [x] 3.3 Update `_styleStatusDropdown()` to apply muted grey + opacity style for "Rejected" (same opacity as Complete, grey text color `#9E9E9E`)
- [x] 3.4 Apply `completed-task` CSS class to chits with status "Rejected" (same fade as Complete)
- [x] 3.5 Update overdue date logic to exempt "Rejected" chits (same as Complete exemption)

## Task 4: Frontend — Projects Kanban Integration

- [x] 4.1 Add "Rejected" to the `statuses` array in `renderChildChitsByStatus()` in `src/frontend/js/editor/editor_projects.js`
- [x] 4.2 Add `"rejected": "Rejected"` to the `statusMapLower` normalization map (all instances)
- [x] 4.3 Update the collapse-by-default logic to also collapse "Rejected" when it has items (same as Complete)
- [x] 4.4 Add "Rejected" to the dashboard Projects Kanban (`main-views-projects.js`) — statuses array, normalization map, line-through, opacity

## Task 5: Frontend — Sidebar Filters & Display Filters

- [x] 5.1 Add a "Rejected" checkbox to the status filter group in `src/frontend/js/shared/shared-sidebar.js`
- [x] 5.2 Update the "Hide Complete" filter logic in `src/frontend/js/dashboard/main-init.js` to also hide chits with status "Rejected"
- [x] 5.3 Update the "Hide Past-Due" filter to exempt Rejected (same as Complete)
- [x] 5.4 Update the "upcoming" sort to push Rejected to bottom (same as Complete)
- [x] 5.5 Update the "status" sort order in main-init.js to include Rejected

## Task 6: Frontend — Other Views & Pages

- [x] 6.1 Add "Rejected" to the quick-edit modal status dropdown in `shared.js`
- [x] 6.2 Add "Rejected" to the calendar event status dropdown in `main-calendar.js`
- [x] 6.3 Add "Rejected" to the rules engine status options in `rule-editor.js`
- [x] 6.4 Add "Rejected" to the maps status colors and popup icons in `maps.js`
- [x] 6.5 Add "Rejected" to the kiosk page (`kiosk.html`) — _isTask, _statusIcon, CSS class, task filter
- [x] 6.6 Update calendar habit filter to exclude Rejected habits

## Task 7: Backend Updates

- [x] 7.1 Add "Rejected" to `compute_system_tags()` status list in `db.py`
- [x] 7.2 Add `rejected_count` to the Home Assistant sensor endpoint in `routes/ha.py`
- [x] 7.3 Update HA overdue logic to exempt Rejected

## Task 8: Help Page Documentation

- [x] 8.1 Add "Rejected" to the map marker color legend in `src/frontend/html/help.html` (grey `#9E9E9E`)
- [x] 8.2 Add "Rejected" to the status search prefix documentation
- [x] 8.3 Add "Rejected" to the sidebar filter status list documentation
- [x] 8.4 Add "Rejected" to the Task zone status icons description
- [x] 8.5 Update the kiosk tasks description

## Task 9: Finalization

- [x] 9.1 Update version number in `src/VERSION`
- [x] 9.2 Write release notes file
