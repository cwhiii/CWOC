# Implementation Plan: Timeline Mode for Tasks View (Android App)

## Overview

Implement the full Timeline mode as a sub-mode of the Tasks view in the Android app. This is a 1:1 port of the mobile web timeline (5,068 lines of JS across 91 functions) into Kotlin/Compose. The user must not be able to distinguish between the app and mobile browser versions.

## Tasks

- [ ] 1. Algorithm Layer — Pure graph and layout functions
  - [ ] 1.1 Create `TimelineAlgorithms.kt` with `buildGraph(chits)` function
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineAlgorithms.kt`
    - Port `_tlBuildGraph` exactly: build forward/reverse adjacency maps from `prerequisites` JSON arrays, only include edges where both endpoints are in the visible chit set
    - Input: `List<ChitEntity>`, Output: `DependencyGraph(forward: Map<String, List<String>>, reverse: Map<String, List<String>>)`
    - Parse `prerequisites` field: if String, JSON.parse it; if null/empty, treat as empty list
    - _Requirements: 3.1_

  - [ ] 1.2 Add `computeDepths(chits)` function
    - Port `_tlComputeDepths` exactly: BFS from root nodes (no incoming edges), each layer = max(predecessor depths) + 1
    - Unreached nodes (isolated or in cycles) get depth 0
    - Returns `Map<String, Int>` (chitId → depth)
    - _Requirements: 3.2_

  - [ ] 1.3 Add `wouldCycle(fromId, toId, forwardAdj)` function
    - Port `_tlWouldCycle` exactly: BFS from toId through forward edges; if fromId is reachable, return true
    - Self-loop (fromId == toId) always returns true
    - _Requirements: 3.3_

  - [ ] 1.4 Add `criticalPath(chits)` function
    - Port `_tlCriticalPath` exactly: Kahn's algorithm for longest path, trace back from max-distance leaf nodes through predecessors
    - Returns `Set<String>` of chit IDs on critical path(s)
    - If no edges exist, return empty set
    - _Requirements: 3.4_

  - [ ] 1.5 Add `layoutByDate(chits, canvasWidth)` function
    - Port `_tlLayoutByDate` exactly: dated chits grouped by `due_datetime` into columns (one per date, sorted chronologically), undated split into connected/unaffiliated
    - Constants: nodeWidth=180, nodeHeight=52, hGap=60, vGap=10, topPadding=30, leftPadding=12, colWidth=240
    - Connected undated: depth computed via BFS considering connections to dated chits, rows built by tracing chains from roots
    - Unaffiliated undated: sorted alphabetically, placed in 2-row grid below connected section
    - Returns `Map<String, NodePosition>` where `NodePosition(x, y, lane: DATED|UNDATED)`
    - _Requirements: 3.5, 3.7, 3.8_

  - [ ] 1.6 Add `layoutByDependency(chits, canvasWidth)` function
    - Port `_tlLayoutByDependency` exactly: column per topological depth, first column sorted by forward-edge count descending, subsequent columns positioned at average Y of predecessors with minimum gap enforcement
    - Constants: nodeWidth=180, nodeHeight=52, hGap=60, vGap=14, padding=16
    - Returns `Map<String, NodePosition>` (all nodes in DATED lane since single-section mode)
    - _Requirements: 3.6_

  - [ ] 1.7 Add helper functions: `chitHasDate`, `getEffectiveDate`, `chainOrder`
    - `chitHasDate(chit)`: returns `chit.dueDatetime != null`
    - `getEffectiveDate(chit)`: returns YYYY-MM-DD substring of `dueDatetime`
    - `chainOrder(nodes)`: sort by ascending x then y
    - _Requirements: 3.7, 3.8, 3.9_

- [ ] 2. State & Data Classes
  - [ ] 2.1 Create `TimelineState.kt` with all state data classes
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineState.kt`
    - Define: `TimelineState`, `NodePosition`, `Lane`, `OrderMode`, `DependencyGraph`, `DependencyAction`, `ActionType`, `ContextMenuState`, `ZoomLevel`
    - `ZoomLevel` enum: FAR (≤60%), MEDIUM (61–150%), CLOSE (>150%)
    - `ContextMenuState(chitId: String, position: Offset)`
    - _Requirements: 4.2, 5.3_

  - [ ] 2.2 Add timeline state to `TasksViewModel` (or create `TimelineViewModel`)
    - Add `timelineState: StateFlow<TimelineState>` 
    - Add functions: `setZoom`, `setOrderMode`, `toggleLinkMode`, `toggleCriticalPath`, `setHighlightedNode`, `clearHighlight`, `addToSelection`, `clearSelection`, `setGreyCompleted`
    - Add dependency mutation functions: `addDependency(sourceId, targetId)`, `removeDependency(dependentId, prereqId)`, `undo()`, `redo()`
    - Persist `orderMode` and `greyCompleted` in SharedPreferences
    - _Requirements: 1.3, 11.3, 14.1, 17.2_

- [ ] 3. Core Canvas Rendering
  - [ ] 3.1 Create `TimelineCanvas.kt` — main composable
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineCanvas.kt`
    - Composable signature: `TimelineCanvas(chits: List<ChitEntity>, onNavigateToEditor: (String) -> Unit, viewModel, modifier)`
    - Filter chits: only those with status; hide completed unless in dependency graph (matches `displayTimelineView` filtering logic exactly)
    - Compute layout on chit list change (remember + derivedStateOf)
    - Use `Box` with `Modifier.clipToBounds()` as viewport, inner `Canvas` with scale/translate transforms
    - Overlay zoom controls (bottom-right)
    - _Requirements: 2.1, 2.2, 2.3, 4.1_

  - [ ] 3.2 Create `TimelineNodeRenderer.kt` — node drawing
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineNodeRenderer.kt`
    - Function `drawNode(drawScope, chit, position, zoomLevel, state)` draws a single node on the canvas
    - Node dimensions by zoom: FAR=120×32, MEDIUM=180×52, CLOSE=220×64
    - Border color by status: ToDo=#8b4513, InProgress=#2e7d32, Blocked=#c0392b, Complete=#999
    - Background: ivory (#fffaf0) default, chit.color if valid and non-transparent
    - Grey completed: if status is Complete/Rejected AND greyCompleted=true → ColorFilter.saturation(0.15f) + alpha 0.5f
    - Text: title always; status line at medium+close; detail at close only
    - Highlighted node: elevated shadow + full opacity; dimmed node: 0.3 alpha
    - Critical path node: gold (#d4af37) border + glow shadow
    - Selected node: 3dp outline, offset 2dp
    - Link source node: gold outline + glow
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.3, 9.3, 10.2, 12.2_

  - [ ] 3.3 Create `TimelineLineRenderer.kt` — dependency line drawing
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineLineRenderer.kt`
    - Function `drawLines(drawScope, graph, positions, nodeRects, state)` draws all dependency lines
    - Line connects from right-center of source node to left-center of target node
    - Routing algorithm (port `_tlRouteAroundNodes` exactly):
      - Same Y + no blocking nodes → straight line
      - Adjacent columns (gap < 80dp) → L-route through gap center with rounded corners (radius 12dp)
      - Otherwise → find clear vertical channel via candidate search, route with collision avoidance
      - Backward connections → route down then left
    - Line grouping: lines sharing vertical channels get spread offsets (4dp apart)
    - Both-complete lines: dashed (6,4) at 0.4 alpha
    - Critical path lines: gold color, 4dp width
    - Highlighted lines: full alpha, 4dp width, dark color
    - Dimmed lines: 0.3 alpha
    - Hit testing: store line paths for tap detection (expanded 6dp hit area)
    - _Requirements: 4.8, 4.9, 4.10, 12.3, 13.1, 13.3_

  - [ ] 3.4 Add date marker rendering
    - Function `drawDateMarkers(drawScope, chits, positions)` draws vertical date lines with labels
    - One marker per unique date column, positioned at leftPadding + colIdx * colWidth
    - Line: 1dp wide, rgba(139,90,43,0.3) color, full height of dated lane
    - Label: date formatted as "Mon Jan 5" style, positioned at top of marker
    - Only rendered in DATE order mode
    - _Requirements: 4.7, 4.12_

  - [ ] 3.5 Add lane divider rendering
    - Draw bold horizontal divider between dated and undated lanes (4dp height, #8b4513 at 0.8 alpha)
    - In dependency mode: hide divider and lane labels
    - Divider has gaps where dependency lines cross it (gradient with transparent sections)
    - _Requirements: 4.1, 4.12_

  - [ ] 3.6 Add empty state rendering
    - When no chits pass the filter, show centered text: "Drag a task onto another to create a dependency, or add dates to see them on the timeline."
    - Use standard CWOC empty state styling (parchment theme)
    - _Requirements: 15.1_

- [ ] 4. Zoom & Pan Interactions
  - [ ] 4.1 Create `TimelineInteractions.kt` — gesture handling
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineInteractions.kt`
    - Implement `timelineGestureModifier()` that combines all gesture detectors
    - Pinch-to-zoom: detect two-finger pinch, scale proportionally, clamp 0.25–3.0
    - Pan: single-finger drag on empty space translates the canvas offset 1:1
    - Drag threshold: 5dp before distinguishing click from drag
    - _Requirements: 5.1, 5.4_

  - [ ] 4.2 Create `TimelineZoomControls.kt` — zoom button overlay
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineZoomControls.kt`
    - Three buttons stacked vertically in bottom-right: + (zoom in 10%), − (zoom out 10%), ⊙ (recenter)
    - Buttons: 36×36dp, 2dp border, 6dp radius, parchment background, brown text
    - Recenter: zoom=1.0, offset=(0,0)
    - _Requirements: 5.2, 5.5_

  - [ ] 4.3 Wire zoom level to node detail visibility
    - Compute `ZoomLevel` from current zoom float: ≤0.6→FAR, ≤1.5→MEDIUM, >1.5→CLOSE
    - Pass zoom level to node renderer to control what text is drawn
    - _Requirements: 5.3_

- [ ] 5. Node Interactions
  - [ ] 5.1 Implement single-tap on node — highlighting
    - Tap a node: set `highlightedNodeId` in state
    - Compute connected set (node + all direct forward/reverse neighbors)
    - Connected nodes: full alpha + elevated shadow
    - All other nodes: 0.3 alpha
    - Connected lines: full alpha + 4dp width
    - All other lines: 0.3 alpha
    - Tap empty space: clear highlight (set highlightedNodeId = null)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 5.2 Implement double-tap on node — navigate to editor
    - Detect double-tap (two taps within 350ms on same node)
    - Call `onNavigateToEditor(chitId)`
    - _Requirements: 18.1_

  - [ ] 5.3 Implement tap on dependency line — remove dependency
    - Hit test: check if tap point is within 6dp of any stored line path
    - On hit: show confirmation dialog "Remove dependency: [source title] → [target title]?"
    - On confirm: call `removeDependency(dependentId, prereqId)`, push to undo stack, re-render
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 6. Context Menu & Long-Press
  - [ ] 6.1 Create `TimelineContextMenu.kt` — context menu composable
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineContextMenu.kt`
    - Composable: `TimelineContextMenu(state: ContextMenuState, onDismiss, onOpenEditor, onAddPrereq, onRemovePrereq, onLinkMode)`
    - Menu items: "Open in Editor", "Add Prerequisite…", "Remove Prerequisite…", "Link Mode"
    - Positioned at touch point (offset to stay on screen)
    - Dismiss on tap outside or back gesture
    - Parchment theme: #fffaf0 background, #8b4513 border, Lora font
    - _Requirements: 7.1, 7.2, 7.5_

  - [ ] 6.2 Implement long-press detection (500ms threshold)
    - On long-press without movement: show context menu
    - On long-press with movement (drag): initiate drag-to-link (task 7)
    - Distinguish via movement threshold (5dp)
    - _Requirements: 7.1_

  - [ ] 6.3 Create `TimelineChitPicker.kt` — prerequisite picker dialog
    - Create file at `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/TimelineChitPicker.kt`
    - "Add Prerequisite" mode: show all visible tasks (excluding self and existing prereqs), searchable, multi-select
    - "Remove Prerequisite" mode: show only current prerequisites of the target chit
    - On confirm: persist changes via `ChitRepository`, push to undo stack, re-render
    - Cycle detection on add: if `wouldCycle` returns true for any selection, show error toast and skip that one
    - _Requirements: 7.3, 7.4_

- [ ] 7. Drag-to-Link
  - [ ] 7.1 Implement drag-to-link gesture
    - Long-press (500ms) + drag movement (>5dp) initiates drag-to-link
    - Draw dashed line from source node right-center to current finger position
    - Line: 2dp width, dashed (6,4), #4a2c2a color, 0.7 alpha
    - On finger up: check if finger is over another node (hit test)
    - If over a valid target: call `addDependency(sourceId, targetId)`
    - If cycle detected: show error toast "Cannot add: would create a cycle"
    - If over empty space or same node: cancel silently
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 8. Link Mode
  - [ ] 8.1 Implement Link Mode toggle
    - When Link Mode active: all node taps become source/target selection instead of highlighting
    - First tap: set `linkSource` (gold outline + glow on that node)
    - Second tap: attempt to create dependency (source → target), then clear Link Mode state
    - Cycle detection applies
    - Back gesture or tap on empty space: exit Link Mode
    - _Requirements: 9.1, 9.2, 9.3, 18.2_

- [ ] 9. Multi-Select & Chain Linking
  - [ ] 9.1 Implement selection rectangle (two-finger drag)
    - Two-finger drag on empty space draws a dashed selection rectangle
    - On release: all nodes within the rectangle are added to `selectedNodes`
    - Selected nodes get 3dp outline
    - _Requirements: 10.1, 10.2_

  - [ ] 9.2 Implement "Link as Chain" action
    - When ≥2 nodes selected: show floating action button "Link as Chain"
    - On tap: sort selected nodes by `chainOrder` (ascending x then y), link sequentially (A→B→C→…)
    - Each link: cycle check, persist, push to undo stack
    - Clear selection after linking
    - _Requirements: 10.3, 10.4_

- [ ] 10. Order Toggle & Critical Path
  - [ ] 10.1 Add order toggle to sidebar (Tasks section)
    - Two-value pill toggle: "By Date" | "By Dependency"
    - Changing mode triggers full re-layout and re-render
    - Persisted in SharedPreferences
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 10.2 Implement critical path toggle
    - Button in sidebar or toolbar: "Critical Path" (toggles on/off)
    - On activate: compute `criticalPath(chits)`, store in state, apply highlighting
    - Critical path nodes: gold border + glow
    - Critical path lines: gold, 4dp
    - Non-critical: 0.4 alpha
    - 300ms animation on activate/deactivate
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 11. Undo/Redo
  - [ ] 11.1 Implement undo/redo stack management
    - Every `addDependency` and `removeDependency` pushes to undo stack and clears redo stack
    - `undo()`: pop from undo stack, reverse the action (add→remove, remove→add), push to redo stack, persist, re-render
    - `redo()`: pop from redo stack, re-apply the action, push to undo stack, persist, re-render
    - Stack max size: 50 entries
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 12. Sidebar & Mode Integration
  - [ ] 12.1 Add "Timeline" button to Tasks view mode row in `SidebarContent.kt`
    - Add fourth button: `ViewModeButton(text = "⏱️ Timeline", isActive = sidebarState.tasksViewMode == "timeline", onClick = { onTasksViewModeChange("timeline") })`
    - When timeline is active, show additional controls below: Order toggle, Critical Path button, Grey Completed checkbox
    - _Requirements: 1.1, 1.3_

  - [ ] 12.2 Add `"timeline"` case to `TasksScreen` when block
    - In the `when (tasksMode)` block, add: `"timeline" -> TimelineCanvas(chits = filteredSortedTasks, onNavigateToEditor = { onNavigateToEditor(it) }, ...)`
    - Pass necessary dependencies (viewModel, chitRepository, coroutineScope)
    - _Requirements: 1.2_

- [ ] 13. Orientation & Resize Handling
  - [ ] 13.1 Re-compute layout on configuration change
    - Use `LocalConfiguration.current` to detect orientation changes
    - Debounce re-layout by 200ms after configuration change
    - Recalculate canvas width from new viewport dimensions
    - _Requirements: 16.1_

- [ ] 14. Final Integration & Polish
  - [ ] 14.1 Wire all persistence through ChitRepository
    - `addDependency`: read current prerequisites, append new ID, call `updateFields(chitId, mapOf("prerequisites" to newJson))`
    - `removeDependency`: read current prerequisites, remove ID, call `updateFields`
    - Handle offline gracefully (repository queues for sync)
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [ ] 14.2 Verify visual parity with mobile web
    - Compare side-by-side: node sizes, colors, border widths, line routing, zoom behavior, context menu appearance
    - Ensure touch targets are ≥44dp for accessibility
    - Test with real data: dated tasks, undated tasks, dependency chains, completed tasks

## Notes

- This is a large feature (~5000 lines of JS being ported to Kotlin/Compose). The algorithm layer (task 1) is the foundation — everything else depends on it.
- The Canvas API in Compose is the closest equivalent to the web's absolutely-positioned divs + SVG overlay. DrawScope provides path drawing, text drawing, and transform capabilities.
- The line routing algorithm (`_tlRouteAroundNodes`) is the most complex single function — it must be ported exactly to achieve visual parity.
- No schema changes or migrations needed — `prerequisites` field already exists on ChitEntity.
- No new API endpoints needed — uses existing PATCH `/api/chits/{id}/fields`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "12.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "4.2"] },
    { "id": 3, "tasks": ["4.1", "4.3", "5.1", "5.2", "12.2"] },
    { "id": 4, "tasks": ["5.3", "6.1", "6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["8.1", "9.1", "9.2", "10.1", "10.2", "11.1"] },
    { "id": 6, "tasks": ["13.1", "14.1", "14.2"] }
  ]
}
```
