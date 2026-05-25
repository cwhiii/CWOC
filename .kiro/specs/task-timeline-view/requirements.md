# Requirements Document

## Introduction

A horizontal, side-scrolling timeline sub-mode within the existing Tasks tab (C CAPTN). The Timeline View visualizes chits as nodes positioned by date or dependency depth, with dependency lines drawn between connected nodes. It reuses the existing `prerequisites` field on chits — no new data model is required. The view provides drag-and-drop dependency management, cycle detection, critical path highlighting, and multi-level zoom.

## Platform Scope

All platforms: Web (desktop browser), Mobile (mobile browser), App (Android).

## Glossary

- **Timeline_View**: The horizontal scrolling sub-mode of the Tasks tab that renders chits as positioned nodes with dependency lines.
- **Dated_Lane**: The upper horizontal band of the Timeline View where chits with dates are positioned at date markers.
- **Undated_Lane**: The lower horizontal band below a divider where chits without dates are displayed.
- **Dependency_Line**: A curved SVG path connecting a prerequisite chit to its dependent chit (left to right).
- **Date_Marker**: A vertical line in the Dated Lane representing a specific date that has at least one chit.
- **Critical_Path**: The longest chain of dependency-connected chits from a root node (no prerequisites) to a leaf node (no dependents).
- **Node**: A visual representation of a single chit on the timeline.
- **Link_Mode**: A toggle state where clicking two nodes in sequence creates a dependency between them.
- **Topological_Order**: The arrangement of nodes by dependency depth (number of prerequisite hops from a root node).
- **Order_Toggle**: A control that switches the horizontal axis between date-based positioning and dependency-depth positioning.

## Requirements

### Requirement 1: Timeline Sub-Mode Activation

**User Story:** As a user, I want to switch to a Timeline sub-mode within the Tasks tab, so that I can visualize my tasks spatially by date and dependency.

#### Acceptance Criteria

1. WHEN the user selects the Timeline sub-mode button in the Tasks tab sidebar View Mode section, THE Timeline_View SHALL replace the standard task list content area with a horizontal scrolling canvas that displays tasks positioned along a date-based horizontal axis.
2. WHEN the Timeline sub-mode is active, THE Timeline_View SHALL highlight the Timeline button in the sidebar View Mode section using the active button style (ivory background, #3b1f0a text) and de-highlight all other mode buttons.
3. WHEN the user selects any other mode button (Tasks, Habits, or Assigned) while the Timeline sub-mode is active, THE Timeline_View SHALL be removed and the selected mode's standard view SHALL render in the content area.
4. THE Timeline_View SHALL persist the selected sub-mode in the URL hash as `#tasks/timeline` so that refreshing the page restores the Timeline sub-mode, consistent with the existing `#tab/mode` hash routing pattern.
5. IF the browser window is resized or the canvas viewport width changes while the Timeline sub-mode is active, THEN THE Timeline_View SHALL re-render the canvas layout to fit the available width within 200 milliseconds of the resize event settling (debounced).

### Requirement 2: Two-Lane Layout

**User Story:** As a user, I want dated and undated tasks separated into distinct lanes, so that I can see temporal positioning without undated tasks cluttering the timeline.

#### Acceptance Criteria

1. THE Timeline_View SHALL display a Dated_Lane in the upper portion of the canvas for chits that have at least one date field set (start_datetime, due_datetime, or point_in_time).
2. THE Timeline_View SHALL display an Undated_Lane in the lower portion of the canvas, separated by a visible horizontal divider, for chits that have no date fields set.
3. WHEN a chit has a date assigned, THE Timeline_View SHALL position that chit's Node in the Dated_Lane at the corresponding Date_Marker.
4. WHEN a chit has no date assigned, THE Timeline_View SHALL position that chit's Node in the Undated_Lane, ordered horizontally by creation date (oldest to the left).
5. WHEN multiple chits share the same Date_Marker, THE Timeline_View SHALL spread their Nodes vertically within the Dated_Lane such that no two Node bounding boxes overlap by even one pixel.
6. WHEN a chit's date fields change from unset to set (or set to unset), THE Timeline_View SHALL move that chit's Node from the Undated_Lane to the Dated_Lane (or from the Dated_Lane to the Undated_Lane) without requiring a manual refresh.
7. IF the number of Nodes stacked at a single Date_Marker exceeds the vertical space available in the Dated_Lane, THEN THE Timeline_View SHALL allow vertical scrolling within the Dated_Lane to reveal all Nodes at that marker.

### Requirement 3: Date Markers

**User Story:** As a user, I want date markers only at dates that have tasks, so that the timeline is compact and focused on relevant dates.

#### Acceptance Criteria

1. THE Timeline_View SHALL render Date_Markers as vertical lines only at dates where at least one chit matching the current filter and visibility criteria exists, ordered chronologically from left to right.
2. THE Timeline_View SHALL space Date_Markers with equal horizontal distance between them regardless of the actual calendar distance between dates.
3. THE Timeline_View SHALL display the date label (formatted per user settings) at each Date_Marker.
4. IF no dates contain chits matching the current filter and visibility criteria, THEN THE Timeline_View SHALL render no Date_Markers and display an empty-state indicator.
5. WHEN the set of visible chits changes due to filtering, completion, or deletion, THE Timeline_View SHALL add or remove Date_Markers so that only dates with at least one qualifying chit are marked.

### Requirement 4: Dependency Line Rendering

**User Story:** As a user, I want to see visual lines connecting prerequisite tasks to their dependents, so that I can understand the flow of work.

#### Acceptance Criteria

1. THE Timeline_View SHALL draw a Dependency_Line from each prerequisite Node to each dependent Node using curved SVG paths with rounded orthogonal routing (subway-map style).
2. THE Timeline_View SHALL draw Dependency_Lines from left to right (prerequisite on the left, dependent on the right).
3. IF a Dependency_Line connects two Nodes where at least one has a status other than Complete, THEN THE Timeline_View SHALL render the line as a solid stroke with a width of 2px in a brown tone derived from the parchment theme CSS variables.
4. IF both the prerequisite and dependent Nodes have status Complete, THEN THE Timeline_View SHALL render the Dependency_Line as a dashed stroke (6px dash, 4px gap) at 0.4 opacity.
5. WHEN a dependency crosses between the Dated_Lane and the Undated_Lane, THE Timeline_View SHALL draw the Dependency_Line continuously across the lane divider without clipping or interruption.
6. THE Timeline_View SHALL position dependency-connected Nodes such that directly connected Nodes are placed within 200px horizontal distance of each other where layout constraints allow, to minimize line crossing and long-distance traversal.
7. IF two or more Dependency_Lines overlap along the same path segment, THEN THE Timeline_View SHALL offset each overlapping line by at least 4px so that individual lines remain visually distinguishable.

### Requirement 5: Dependency Creation via Drag and Drop

**User Story:** As a user, I want to drag one task onto another to create a dependency, so that I can quickly build task chains.

#### Acceptance Criteria

1. WHEN the user drags Node A onto Node B, THE Timeline_View SHALL display a visual connector line following the pointer from Node A toward the drop target during the drag, and upon drop SHALL set chit A as a prerequisite of chit B.
2. IF the proposed link would create a circular dependency (including a self-loop), THEN THE Timeline_View SHALL block the operation and display a toast indicating a circular dependency would result.
3. IF the dependency between chit A and chit B already exists, THEN THE Timeline_View SHALL ignore the drop and display a toast indicating the dependency already exists.
4. WHEN a valid drag-to-link completes, THE Timeline_View SHALL render the new Dependency_Line within 200ms and persist the change via the API.
5. IF the API call to persist the dependency fails, THEN THE Timeline_View SHALL remove the rendered Dependency_Line, display a toast indicating the save failed, and leave the dependency graph unchanged.

### Requirement 6: Dependency Creation via Context Menu

**User Story:** As a user, I want to add prerequisites through a context menu, so that I can link tasks without drag-and-drop.

#### Acceptance Criteria

1. WHEN the user right-clicks (desktop) or long-presses for at least 500 ms (touch) a Node, THE Timeline_View SHALL display a context menu with an "Add prerequisite..." option that dismisses when the user clicks or taps outside it.
2. WHEN the user selects "Add prerequisite..." from the context menu, THE Timeline_View SHALL open a searchable chit picker modal listing all chits except the target node itself and any chits already linked as its direct prerequisites, filterable by title starting from the first character typed.
3. WHEN the user confirms selections in the chit picker, THE Timeline_View SHALL run cycle detection for each proposed link and add only links that do not create a circular dependency.
4. IF any selected link would create a circular dependency, THEN THE Timeline_View SHALL skip that link and display a toast for 5 seconds identifying the source and target chit names of the blocked link.
5. IF the chit picker contains no eligible chits to select, THEN THE Timeline_View SHALL display an empty-state message indicating no available prerequisites exist.

### Requirement 7: Link Mode

**User Story:** As a user, I want a Link Mode toggle where I can click two nodes in sequence to link them, so that I have a third method for creating dependencies.

#### Acceptance Criteria

1. THE Timeline_View SHALL provide a "Link Mode" toggle button in the timeline toolbar.
2. WHILE Link_Mode is active, WHEN the user clicks a first Node, THE Timeline_View SHALL visually highlight that Node as the selected source and await a second click.
3. WHILE Link_Mode is active AND a source Node is selected, WHEN the user clicks a second (different) Node, THE Timeline_View SHALL create a dependency where the first Node becomes a prerequisite of the second Node and clear the source selection so the user can begin a new pair.
4. WHILE Link_Mode is active, THE Timeline_View SHALL visually indicate that Link Mode is engaged by displaying a distinct cursor style.
5. WHILE Link_Mode is active AND a source Node is selected, IF the user presses Escape or toggles Link Mode off, THEN THE Timeline_View SHALL cancel the partial selection without creating a dependency.
6. WHEN a link is created in Link Mode, IF the link would create a cycle, a self-link, or a duplicate of an existing dependency, THEN THE Timeline_View SHALL block the link, display a toast message indicating the reason, and clear the source selection.
7. WHEN a link is successfully created in Link Mode, THE Timeline_View SHALL run cycle detection before persisting the dependency.

### Requirement 8: Dependency Removal

**User Story:** As a user, I want to remove dependencies by clicking on lines or through a context menu, so that I can correct mistakes.

#### Acceptance Criteria

1. WHEN the user clicks or taps on a Dependency_Line, THE Timeline_View SHALL remove that dependency and display an undo toast with a 5-second countdown.
2. WHEN the user selects "Remove prerequisite" from a Node's context menu and the Node has one or more prerequisites, THE Timeline_View SHALL display a list of that Node's current prerequisites and allow the user to select which to remove.
3. WHEN a dependency is removed, THE Timeline_View SHALL update the visual rendering within 200ms and persist the change via the API.
4. WHEN an undo toast is active and the user clicks Undo, THE Timeline_View SHALL restore the removed dependency, update the visual rendering, and persist the restoration via the API.
5. IF the API call to persist a dependency removal or restoration fails, THEN THE Timeline_View SHALL revert the visual rendering to the previous state and display an error message indicating the operation could not be saved.
6. WHEN the user selects "Remove prerequisite" from a Node's context menu and the Node has no prerequisites, THE Timeline_View SHALL display a message indicating no prerequisites exist and offer no removal action.

### Requirement 9: Multi-Select and Bulk Linking

**User Story:** As a user, I want to select multiple nodes and link them as a chain, so that I can quickly build sequential dependency chains.

#### Acceptance Criteria

1. WHEN the user drag-selects across empty space, THE Timeline_View SHALL display a visible selection rectangle and select all Nodes whose center point falls within the rectangle boundary.
2. WHEN 2 or more Nodes are selected, THE Timeline_View SHALL provide a "Link as chain" action that creates sequential dependencies ordered by ascending horizontal position on the timeline (left to right), using ascending vertical position as a tiebreaker when two nodes share the same horizontal position.
3. IF bulk linking would create a cycle in the dependency graph, THEN THE Timeline_View SHALL block the operation, leave all existing dependencies unchanged, and display an error message indicating which nodes would form the cycle.
4. WHEN the "Link as chain" action is executed successfully, THE Timeline_View SHALL preserve any pre-existing dependency links among the selected nodes that do not conflict with the new chain order, and add only the missing sequential links.

### Requirement 10: Order Toggle (Date vs Dependency)

**User Story:** As a user, I want to switch between date-based and dependency-based ordering, so that I can view my tasks from different perspectives.

#### Acceptance Criteria

1. THE Timeline_View SHALL provide an Order_Toggle with two modes: "By Date" and "By Dependency," defaulting to "By Date" on initial load.
2. WHILE the Order_Toggle is set to "By Date," THE Timeline_View SHALL position Nodes on the horizontal axis by their date, with Date_Markers at equal spacing, and SHALL place Nodes that have no date in a separate "Undated" region at the end of the axis.
3. WHILE the Order_Toggle is set to "By Dependency," THE Timeline_View SHALL position Nodes on the horizontal axis by Topological_Order (dependency depth from root nodes), placing Nodes with no incoming or outgoing dependencies at depth 0 alongside other root nodes.
4. WHILE the Order_Toggle is set to "By Dependency," THE Timeline_View SHALL display date annotations on each Node rather than using Date_Markers as the axis.
5. WHEN the user switches the Order_Toggle, THE Timeline_View SHALL re-render the layout with an animated transition completing within 300 milliseconds.
6. THE Timeline_View SHALL persist the Order_Toggle selection for the duration of the user session so that navigating away and returning preserves the chosen mode.

### Requirement 11: Node Visual Styling

**User Story:** As a user, I want task nodes styled by status with the existing CWOC visual language, so that I can quickly identify task states.

#### Acceptance Criteria

1. WHEN a chit has status "ToDo," THE Timeline_View SHALL render its Node with a brown border matching the application's neutral parchment-brown tone.
2. WHEN a chit has status "In Progress," THE Timeline_View SHALL render its Node with a green border.
3. WHEN a chit has status "Blocked," THE Timeline_View SHALL render its Node with a red border using the existing blocked-status color from the color tools.
4. WHEN a chit has status "Complete," THE Timeline_View SHALL render its Node with opacity 0.5, consistent with the existing `.completed-task` card treatment.
5. IF a chit has a custom color set, THEN THE Timeline_View SHALL apply that color as the Node background fill.
6. IF a chit does not have a custom color set, THEN THE Timeline_View SHALL use the default parchment background for the Node.
7. WHEN a chit has both a custom background color and a status, THE Timeline_View SHALL display the status-based border and the custom background simultaneously without one overriding the other.

### Requirement 12: Hover and Focus Highlighting

**User Story:** As a user, I want to hover or tap a node to see its dependency connections highlighted, so that I can trace relationships in complex graphs.

#### Acceptance Criteria

1. WHEN the user hovers over (desktop) or taps (touch) a Node, THE Timeline_View SHALL highlight that Node and all directly connected incoming and outgoing Dependency_Lines by rendering them at full opacity and at 2x the default line width.
2. WHEN a Node is highlighted, THE Timeline_View SHALL dim all Nodes and Dependency_Lines that are not the highlighted Node or its direct incoming/outgoing connections by reducing their opacity to 0.3.
3. WHEN the user moves the cursor away from the Node (desktop) or taps elsewhere (touch), THE Timeline_View SHALL restore all elements to their default opacity and line width within 150ms.
4. IF the user hovers over or taps a Node that has zero Dependency_Lines, THEN THE Timeline_View SHALL highlight only that Node and dim all other Nodes and Dependency_Lines.
5. WHEN the user hovers over or taps a second Node while a first Node is already highlighted, THE Timeline_View SHALL remove highlighting from the first Node and apply highlighting to the second Node and its direct connections.

### Requirement 13: Critical Path Display

**User Story:** As a user, I want to see the critical path (longest dependency chain) highlighted, so that I can identify bottleneck sequences.

#### Acceptance Criteria

1. THE Timeline_View SHALL provide a "Show critical path" toggle in the toolbar.
2. WHEN the "Show critical path" toggle is activated, THE Timeline_View SHALL compute the longest chain of Dependency_Lines from any root Node (no prerequisites) to any leaf Node (no dependents), highlight those Dependency_Lines at no less than 2× normal line thickness and in a color visually distinguishable from the default Dependency_Line color, and highlight the Nodes along that chain.
3. IF multiple paths share the same longest length, THEN THE Timeline_View SHALL highlight all tied paths.
4. WHEN the "Show critical path" toggle is active, THE Timeline_View SHALL render all Nodes and Dependency_Lines not on the critical path at reduced opacity (no greater than 50% of normal opacity) so they remain visible but visually recede.
5. WHEN the user deactivates the toggle, THE Timeline_View SHALL restore all Nodes and Dependency_Lines to normal opacity, thickness, and coloring within 300 ms.
6. IF the "Show critical path" toggle is activated and no Dependency_Lines exist in the timeline, THEN THE Timeline_View SHALL keep the toggle inactive and display a message indicating that no dependency chain is available to highlight.

### Requirement 14: Completed Task Treatment

**User Story:** As a user, I want completed tasks to fade on the timeline, consistent with the existing task view behavior, so that active work stands out.

#### Acceptance Criteria

1. WHEN a chit has status "Complete," THE Timeline_View SHALL render its Node at opacity 0.5, matching the existing task view's completed-task treatment.
2. IF a Dependency_Line connects two chits that both have status "Complete," THEN THE Timeline_View SHALL render that line as dashed with opacity 0.5.
3. IF a Dependency_Line connects one Complete chit and one non-Complete chit, THEN THE Timeline_View SHALL render that line at full opacity with a solid stroke.
4. THE Timeline_View SHALL position Complete chits in the same location they would occupy if not complete (position is not affected by completion status).

### Requirement 15: Filtered Node Behavior

**User Story:** As a user, I want filtered-out tasks to disappear cleanly without breaking the visual flow, so that filtering doesn't create confusing gaps.

#### Acceptance Criteria

1. WHEN a sidebar filter hides a chit, THE Timeline_View SHALL remove that Node from the canvas and reflow remaining visible Nodes to close the vacated space within 300 milliseconds.
2. WHEN a filtered-out Node has Dependency_Lines, THE Timeline_View SHALL render those lines with a gradient that transitions from full opacity to zero opacity over the final 20% of the line length at the end where the hidden Node was.
3. THE Timeline_View SHALL NOT redraw direct connections between visible nodes that were only connected through a now-hidden intermediate node.
4. THE Timeline_View SHALL apply all existing sidebar filters (tags, status, people, date ranges) to the set of visible Nodes.
5. WHEN a sidebar filter is cleared and previously hidden Nodes become visible again, THE Timeline_View SHALL restore those Nodes to their correct positions and reflow the layout within 300 milliseconds.
6. WHILE Nodes are being removed or restored due to filter changes, THE Timeline_View SHALL animate the position transitions of remaining visible Nodes so that no instantaneous jumps occur.

### Requirement 16: Scroll and Zoom

**User Story:** As a user, I want to scroll and zoom the timeline fluidly, so that I can navigate large task graphs.

#### Acceptance Criteria

1. WHEN the user performs a two-finger horizontal swipe (touch) or horizontal scroll (desktop), THE Timeline_View SHALL scroll the canvas left or right proportionally to the gesture distance.
2. WHEN the user performs a two-finger vertical swipe (touch) or vertical scroll (desktop), THE Timeline_View SHALL scroll the canvas up or down through stacked nodes proportionally to the gesture distance.
3. WHEN the user pinches (touch) or Ctrl+scrolls (desktop), THE Timeline_View SHALL zoom the canvas in or out within a range of 25% to 300% magnification, changing by 10% per scroll tick.
4. WHEN the user clicks and drags on empty canvas space, THE Timeline_View SHALL pan the view in the drag direction with 1:1 pixel correspondence to pointer movement.
5. THE Timeline_View SHALL support three zoom levels with the following rendering: far (25%–60%: dot indicators with title text only), medium (61%–150%: card-sized nodes showing title and status), and close (151%–300%: full detail cards showing title, status, dates, tags, and description preview).
6. THE Timeline_View SHALL render Nodes at the detail level corresponding to the current zoom percentage as defined by the three zoom level thresholds in criterion 5.
7. IF the user attempts to zoom beyond the minimum (25%) or maximum (300%) magnification, THEN THE Timeline_View SHALL stop zooming and hold at the boundary value without further visual change.

### Requirement 17: Creating Tasks on the Timeline

**User Story:** As a user, I want to create new tasks directly on the timeline at a specific date, so that I can plan without leaving the view.

#### Acceptance Criteria

1. WHEN the user clicks (without dragging) on empty space within a Date_Marker column in the Dated_Lane, THE Timeline_View SHALL navigate to the chit editor with the start_datetime field pre-filled to that Date_Marker's date at 00:00:00.
2. WHEN the user clicks (without dragging) on empty space in the Undated_Lane that is not within a Date_Marker column, THE Timeline_View SHALL navigate to the chit editor with no date fields pre-filled.
3. WHEN the user returns to the Timeline_View after saving a new chit, THE Timeline_View SHALL re-render the canvas and display the new Node positioned according to the Two-Lane Layout rules (Dated_Lane at the corresponding Date_Marker if the chit has a date, Undated_Lane otherwise).
4. THE Timeline_View SHALL distinguish a click (pointer down and up without movement beyond 5 pixels) from a drag-to-pan gesture, and SHALL only trigger chit creation on a click.

### Requirement 18: Empty State

**User Story:** As a user, I want a helpful empty state when the timeline has no content, so that I understand how to use the feature.

#### Acceptance Criteria

1. WHEN no chits are visible on the timeline (either no tasks exist or all are filtered out), THE Timeline_View SHALL display the message: "Drag a task onto another to create a dependency, or add dates to see them on the timeline."
2. THE Timeline_View SHALL style the empty state message using the `.cwoc-empty` class, matching the centered text presentation used by other CWOC empty states (trash, audit log, search results).
3. WHEN chits become visible on the timeline (due to filter changes, new tasks being added, or date assignments), THE Timeline_View SHALL remove the empty state message and display the timeline content.

### Requirement 19: Position Derivation

**User Story:** As a user, I want node positions to be automatically derived from data, so that I don't need to manually arrange the timeline.

#### Acceptance Criteria

1. THE Timeline_View SHALL derive all Node horizontal positions from chit dates (in "By Date" mode) or dependency depth (in "By Dependency" mode), and all vertical positions from lane assignment and stacking order within that lane.
2. THE Timeline_View SHALL produce identical Node positions given identical chit data and filter state (deterministic layout).
3. THE Timeline_View SHALL NOT store or persist any manual sort order for timeline node positions.
4. WHEN chit data affecting position changes (date added, date removed, dependency created, dependency removed, chit deleted, or chit restored), THE Timeline_View SHALL recompute and update all affected Node positions within the same render frame.
5. WHEN a filter change alters the set of visible Nodes, THE Timeline_View SHALL recompute positions for all remaining visible Nodes within the same render frame.

### Requirement 20: Existing Filter Integration

**User Story:** As a user, I want all my existing sidebar filters to work on the timeline, so that I can focus on relevant subsets of tasks.

#### Acceptance Criteria

1. THE Timeline_View SHALL apply the same filtering logic as the Tasks list view — including status, tags, people, date ranges, project, archive/pinned/snoozed toggles, and custom view filters — to determine which Nodes are visible, hiding any Node whose underlying chit does not pass the active filter criteria.
2. WHEN a sidebar filter is changed while the Timeline View is active, THE Timeline_View SHALL re-render with the updated filter applied within 500 milliseconds of the filter change event.
3. THE Timeline_View SHALL share filter state with the standard Tasks list view such that switching between the two sub-modes preserves all current filter selections without resetting or reloading them.
4. IF all Nodes are excluded by the active filters, THEN THE Timeline_View SHALL display an empty-state message indicating that no tasks match the current filters.
