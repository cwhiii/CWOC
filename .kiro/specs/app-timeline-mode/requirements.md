# Requirements: Timeline Mode for Tasks View (Android App)

## Goal
Implement the Timeline mode as a sub-mode of the Tasks view in the Android app, achieving pixel-perfect functional parity with the mobile web implementation. The user should not be able to tell whether they are on the app or the mobile browser.

## Platform
- **App only** (Android Kotlin/Compose)

## Source of Truth
- `src/frontend/js/dashboard/main-timeline.js` (4200 lines, 81 functions)
- `src/frontend/js/dashboard/main-timeline-algo.js` (868 lines, 10 functions)
- `src/frontend/css/dashboard/styles-timeline.css` (visual styling)

## Functional Requirements

### 1. Entry Point & Mode Switching
- 1.1 Add "Timeline" as a fourth view mode button in the Tasks section of the sidebar (alongside Tasks, Habits, Assigned)
- 1.2 When timeline mode is active, replace the flat task list with the timeline canvas
- 1.3 Persist the selected mode in SharedPreferences (key: `sidebar_tasks_mode`)

### 2. Data Filtering (matches `displayTimelineView`)
- 2.1 Filter to chits with a non-null `status` field (actual tasks only)
- 2.2 Hide completed/rejected chits UNLESS they have dependencies (are in the graph)
- 2.3 Build the dependency graph from `prerequisites` JSON field on each chit

### 3. Graph Algorithm (matches `main-timeline-algo.js`)
- 3.1 `buildGraph(chits)` — forward/reverse adjacency maps from prerequisites arrays; only include edges where both endpoints are in the visible set
- 3.2 `computeDepths(chits)` — BFS-based topological depth (root=0, each layer = max predecessor depth + 1)
- 3.3 `wouldCycle(fromId, toId, adjList)` — BFS cycle detection (returns true if adding edge creates cycle or self-loop)
- 3.4 `criticalPath(chits)` — longest-path computation returning Set of chit IDs on critical path(s)
- 3.5 `layoutByDate(chits, opts)` — date-based positioning: dated chits grouped by due_datetime into columns, undated split into connected/unaffiliated
- 3.6 `layoutByDependency(chits, opts)` — depth-based flowchart layout: column per depth, vertical ordering minimizes line crossing
- 3.7 `chitHasDate(chit)` — returns true if chit has `due_datetime`
- 3.8 `getEffectiveDate(chit)` — returns YYYY-MM-DD portion of `due_datetime`
- 3.9 `chainOrder(nodes)` — sort by ascending x then y (for "Link as chain")

### 4. Layout & Rendering
- 4.1 Two-lane layout: "📅 Dated Tasks" (top) and "📋 Undated Tasks" (bottom), separated by a bold divider
- 4.2 Nodes are 180×52dp cards with 2dp border, 6dp border-radius, positioned absolutely within lanes
- 4.3 Node content: title (always), status line (medium/close zoom), detail (close zoom only)
- 4.4 Node border color by status: ToDo=#8b4513, InProgress=#2e7d32, Blocked=#c0392b, Complete=#999
- 4.5 Node background: ivory default, chit's custom color if set
- 4.6 Completed nodes: grayscale(85%) + opacity(0.5) when "grey completed" is checked
- 4.7 Date markers: vertical lines with date labels at each column position (date mode only)
- 4.8 SVG dependency lines connecting right-center of source to left-center of target
- 4.9 Line routing: L-route through gap center for adjacent columns, Z-route for blocked paths, collision avoidance against all node rects
- 4.10 Both-complete lines: dashed (6,4) at 0.4 opacity
- 4.11 Canvas auto-sizes to fit all content with padding
- 4.12 In dependency mode: hide lane labels and divider, use single section

### 5. Zoom & Pan
- 5.1 Pinch-to-zoom: 25%–300% range, proportional to finger distance
- 5.2 Zoom buttons: +, −, ⊙ (recenter) in bottom-right corner
- 5.3 Three zoom levels control node detail: far (≤60%), medium (61–150%), close (>150%)
- 5.4 Pan: single-finger drag on empty space scrolls the viewport 1:1
- 5.5 Recenter: reset zoom to 1.0, scroll to (0,0)

### 6. Hover/Focus Highlighting
- 6.1 Tap a node: highlight it + all directly connected nodes/lines at full opacity; dim everything else to 0.3
- 6.2 Tap empty space: clear all highlighting
- 6.3 If node has zero connections, highlight only that node
- 6.4 Tapping a second node replaces the first highlight

### 7. Context Menu (long-press)
- 7.1 Long-press a node (500ms) shows context menu at touch position
- 7.2 Menu items: Open in Editor, Add Prerequisite…, Remove Prerequisite…, Link Mode
- 7.3 "Add Prerequisite" opens a chit picker (searchable list of all visible tasks)
- 7.4 "Remove Prerequisite" opens a picker showing current prerequisites
- 7.5 Dismiss on tap outside

### 8. Drag-to-Link
- 8.1 Long-press + drag from a node draws a dashed connector line following the finger
- 8.2 Releasing on another node creates a dependency (source → target)
- 8.3 Cycle detection: if adding the edge would create a cycle, show error toast and abort
- 8.4 Visual feedback: dashed line from source right-center to finger position
- 8.5 On successful link: persist to server (PATCH prerequisites), re-render

### 9. Link Mode
- 9.1 Toggle via context menu or toolbar: cursor changes to crosshair, first tap = source (gold outline), second tap = target → create dependency
- 9.2 ESC or back gesture exits Link Mode
- 9.3 Source node gets gold outline + glow while waiting for target

### 10. Multi-Select & Chain Linking
- 10.1 Two-finger drag (or shift+drag on desktop) draws a selection rectangle
- 10.2 Nodes within the rectangle get selected (outline)
- 10.3 When ≥2 nodes selected, show "Link as Chain" action button
- 10.4 "Link as Chain" sorts selected by x→y position and links them sequentially

### 11. Order Toggle
- 11.1 "By Date" mode (default): dated chits in date columns, undated below
- 11.2 "By Dependency" mode: flowchart layout by topological depth
- 11.3 Toggle persisted in localStorage equivalent (SharedPreferences)

### 12. Critical Path
- 12.1 Toggle button activates critical path highlighting
- 12.2 Critical path nodes get gold border + glow
- 12.3 Critical path lines get gold color + 4px width
- 12.4 Non-critical elements dim to 0.4 opacity
- 12.5 300ms transition on activate/deactivate

### 13. Dependency Line Interaction
- 13.1 Tap a dependency line: show confirmation to remove that dependency
- 13.2 On confirm: PATCH prerequisites on the dependent chit, re-render
- 13.3 Lines have expanded hit area (6dp) for touch targets

### 14. Undo/Redo
- 14.1 All dependency changes (add/remove) are undoable
- 14.2 Ctrl+Z / Ctrl+Y (or toolbar buttons) to undo/redo
- 14.3 Stack stores {action, chitId, oldPrereqs, newPrereqs}

### 15. Empty State
- 15.1 When no tasks have status, show empty state message: "Drag a task onto another to create a dependency, or add dates to see them on the timeline."

### 16. Resize/Orientation
- 16.1 Re-render on orientation change (debounced 200ms)

### 17. Grey Completed Toggle
- 17.1 Checkbox in sidebar: "Grey out completed" (default: checked)
- 17.2 Persisted in SharedPreferences
- 17.3 When checked: completed nodes get grayscale + 0.5 opacity

### 18. Navigation
- 18.1 Double-tap a node opens the chit editor
- 18.2 Single tap in Link Mode selects source/target

### 19. API Integration
- 19.1 Dependencies are stored in `prerequisites` JSON array field on each chit
- 19.2 Adding a dependency: PATCH `/api/chits/{id}/fields` with updated `prerequisites` JSON
- 19.3 Removing a dependency: same PATCH with the ID removed from the array
- 19.4 All mutations go through the existing `ChitRepository` for offline-first sync
