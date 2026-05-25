# Implementation Plan: Task Timeline View

## Overview

Implement a horizontal, side-scrolling Timeline sub-mode within the Tasks tab that visualizes chits as positioned nodes with SVG dependency lines. The implementation uses two new JS files (`main-timeline.js` for rendering/interactions, `main-timeline-algo.js` for pure algorithms), one new CSS file (`styles-timeline.css`), and integrates via the existing view mode pattern. No backend changes required.

## Tasks

- [x] 1. Create algorithm module and CSS foundation
  - [x] 1.1 Create `src/frontend/js/dashboard/main-timeline-algo.js` with pure algorithm functions
    - Implement `_tlBuildGraph(chits)` — builds forward/reverse adjacency maps from chit prerequisites
    - Implement `_tlComputeDepths(chits)` — BFS-based topological depth computation
    - Implement `_tlWouldCycle(fromId, toId, adjList)` — BFS cycle detection for proposed edges
    - Implement `_tlCriticalPath(chits)` — longest-path computation returning Set of chit IDs
    - Implement `_tlLayoutByDate(chits, opts)` — date-based node positioning (dated lane + undated lane)
    - Implement `_tlLayoutByDependency(chits, opts)` — dependency-depth-based node positioning
    - Implement `_tlChainOrder(nodes)` — sorts selected nodes by ascending x then y for bulk linking
    - All functions must be deterministic (identical input → identical output)
    - _Requirements: 2.1–2.5, 3.1–3.2, 4.6, 9.2, 10.3, 13.2–13.3, 19.1–19.2_

  - [x] 1.2 Create `src/frontend/css/dashboard/styles-timeline.css` with all timeline-specific styles
    - `.timeline-container` — full-height flex column
    - `.timeline-toolbar` — toolbar row with toggle, buttons
    - `.timeline-viewport` — scrollable overflow container
    - `.timeline-canvas` — positioned container for lanes and SVG
    - `.timeline-lane`, `.timeline-dated-lane`, `.timeline-undated-lane` — lane layout
    - `.timeline-lane-divider` — visible horizontal separator
    - `.timeline-node` — absolutely positioned card (base styles, hover, selected states)
    - `.tl-node-todo`, `.tl-node-inprogress`, `.tl-node-blocked`, `.tl-node-complete` — status border colors
    - `.timeline-svg-overlay` — SVG overlay positioning (pointer-events: none on container, stroke on paths)
    - `.tl-zoom-far`, `.tl-zoom-medium`, `.tl-zoom-close` — detail level visibility rules
    - `.tl-date-marker` — vertical date line + label
    - `.tl-link-mode-active` — cursor crosshair state
    - `.tl-node-highlighted`, `.tl-node-dimmed`, `.tl-line-highlighted`, `.tl-line-dimmed` — hover/focus states
    - `.tl-critical-path-line`, `.tl-critical-path-node` — critical path highlight styles
    - `.tl-selection-rect` — drag-select rectangle
    - `.tl-context-menu` — right-click/long-press context menu
    - Responsive rules for mobile (touch-friendly node sizes, toolbar stacking)
    - _Requirements: 11.1–11.7, 12.1–12.5, 13.4, 14.1–14.2, 16.5–16.6, 18.2_

- [x] 2. Create main timeline rendering module
  - [x] 2.1 Create `src/frontend/js/dashboard/main-timeline.js` — core rendering and state management
    - Define module globals: `_tlContainer`, `_tlZoom`, `_tlOrderMode`, `_tlLinkMode`, `_tlLinkSource`, `_tlCriticalPathActive`, `_tlCriticalPathNodes`, `_tlGraph`, `_tlPositions`
    - Implement `displayTimelineView(chits)` — main entry point called by `_setTasksMode('timeline')`
    - Implement `_tlRender(chits)` — full re-render: build graph, compute layout, render nodes, render lines
    - Implement `_tlRenderNodes(chits, positions)` — create/update DOM nodes in dated and undated lanes
    - Implement `_tlRenderLines(graph, positions)` — create SVG `<path>` elements with rounded orthogonal routing
    - Implement `_tlRenderDateMarkers(chits, opts)` — render vertical date lines with labels at equal spacing
    - Implement `_tlApplyZoomClass()` — set `tl-zoom-far`/`tl-zoom-medium`/`tl-zoom-close` based on `_tlZoom`
    - Implement `_tlBuildNodeHTML(chit, zoomLevel)` — returns node DOM element with status class, custom color, detail level
    - Implement `_tlComputePathD(fromPos, toPos)` — compute SVG path `d` attribute for subway-map routing
    - Implement empty state rendering using `.cwoc-empty` class
    - Handle resize with debounced re-render (200ms)
    - _Requirements: 1.1, 1.5, 2.1–2.7, 3.1–3.5, 4.1–4.7, 10.1–10.5, 11.1–11.7, 14.1–14.4, 15.1–15.6, 18.1–18.3, 19.1–19.5_

  - [x] 2.2 Implement zoom and pan interactions in `main-timeline.js`
    - Implement `_tlOnZoom(e)` — Ctrl+scroll / pinch zoom (25%–300%, 10% per tick), clamp at boundaries
    - Implement `_tlOnViewportDrag(e)` — click-drag on empty space pans with 1:1 pixel correspondence
    - Implement horizontal/vertical scroll handling (two-finger swipe / scroll wheel)
    - Apply zoom via CSS `transform: scale(N)` on `#tl-canvas` with `transform-origin: 0 0`
    - Integrate with `shared-touch.js` for touch gesture handling
    - _Requirements: 16.1–16.7_

  - [x] 2.3 Implement hover/focus highlighting in `main-timeline.js`
    - Implement `_tlOnNodeHover(e)` — highlight node + direct connections, dim everything else (opacity 0.3)
    - Implement `_tlOnNodeHoverEnd(e)` — restore all elements to default within 150ms
    - Handle touch: tap to highlight, tap elsewhere to clear
    - Handle case where node has zero dependency lines (highlight only that node)
    - _Requirements: 12.1–12.5_

- [x] 3. Implement dependency management interactions
  - [x] 3.1 Implement drag-to-link dependency creation in `main-timeline.js`
    - Implement `_tlOnNodeDragStart(e)` — begin drag, show visual connector line following pointer
    - Implement `_tlOnNodeDragMove(e)` — update connector line position
    - Implement `_tlOnNodeDragEnd(e)` — on drop: cycle check via `_tlWouldCycle`, then persist via `PUT /api/chits/{id}`
    - Distinguish drag-to-link (node→node) from drag-to-pan (empty space) using 5px threshold
    - Block self-links, duplicates, and cycles with appropriate `cwocToast` messages
    - Revert visual on API failure
    - _Requirements: 5.1–5.5, 17.4_

  - [x] 3.2 Implement context menu and chit picker in `main-timeline.js`
    - Implement `_tlOnNodeContext(e)` — right-click (desktop) / 500ms long-press (touch) shows context menu
    - Context menu options: "Add prerequisite...", "Remove prerequisite" (if has prereqs)
    - Implement `_tlShowChitPicker(targetChitId)` — searchable modal listing eligible chits, filterable by title
    - On confirm: run cycle detection for each proposed link, add valid ones, toast for blocked ones (5s)
    - Implement "Remove prerequisite" — list current prereqs, allow selection, remove with undo toast
    - Dismiss context menu on click/tap outside
    - _Requirements: 6.1–6.5, 8.2–8.3, 8.5–8.6_

  - [x] 3.3 Implement Link Mode in `main-timeline.js`
    - Implement `_tlToggleLinkMode()` — toggle button state, cursor style, `_tlLinkMode` flag
    - Implement `_tlOnLinkModeClick(e)` — first click selects source (highlight), second click creates dependency
    - ESC or toggle-off cancels partial selection
    - Block cycles, self-links, duplicates with toast + clear source selection
    - _Requirements: 7.1–7.7_

  - [x] 3.4 Implement dependency line click-to-remove in `main-timeline.js`
    - Implement `_tlOnLineClick(e)` — click/tap on SVG path removes dependency
    - Show `cwocUndoToast` with 5-second countdown
    - On undo: restore dependency, re-render, persist via API
    - Revert visual on API failure
    - _Requirements: 8.1, 8.3–8.5_

  - [x] 3.5 Implement multi-select and bulk linking in `main-timeline.js`
    - Implement `_tlOnRectSelect(e)` — drag-select on empty space draws selection rectangle
    - Select all nodes whose center falls within rectangle boundary
    - Implement `_tlLinkAsChain()` — "Link as chain" action on 2+ selected nodes
    - Order by ascending horizontal position (vertical as tiebreaker via `_tlChainOrder`)
    - Preserve existing non-conflicting edges, add only missing sequential links
    - Block entire operation if it would create a cycle, toast with cycle info
    - _Requirements: 9.1–9.4_

- [x] 4. Implement toolbar controls and critical path
  - [x] 4.1 Implement Order Toggle (By Date / By Dependency) in `main-timeline.js`
    - Wire the `cwoc-2val-toggle` for order mode switching
    - "By Date" mode: position by date markers, undated region at end
    - "By Dependency" mode: position by topological depth, show date annotations on nodes
    - Animated transition on switch (300ms)
    - Persist selection for session duration (variable, not localStorage)
    - _Requirements: 10.1–10.6_

  - [x] 4.2 Implement Critical Path toggle in `main-timeline.js`
    - Wire "⚡ Critical Path" button toggle
    - On activate: compute via `_tlCriticalPath`, highlight all tied longest paths at 2× line thickness + distinct color
    - Dim non-critical nodes/lines to ≤50% opacity
    - On deactivate: restore all to normal within 300ms
    - If no dependency lines exist: keep toggle inactive, show message via `cwocToast`
    - _Requirements: 13.1–13.6_

- [x] 5. Integrate with dashboard navigation and filters
  - [x] 5.1 Wire timeline mode into existing view system
    - Add fourth button "🔗 Timeline" to Tasks View Mode section in sidebar (`main-sidebar.js`)
    - Implement `_setTasksMode('timeline')` case in `main-views.js` (or `main-views-tasks.js`) to call `displayTimelineView()`
    - Handle active button highlighting (ivory background, #3b1f0a text) and de-highlighting other mode buttons
    - Add `#tasks/timeline` URL hash routing — persist on activation, restore on page load
    - Ensure switching away from timeline removes the timeline container and renders the selected mode
    - _Requirements: 1.1–1.4, 20.3_

  - [x] 5.2 Implement filter integration and task creation in `main-timeline.js`
    - Timeline receives the same filtered chit array as other Tasks sub-modes (upstream `filterChits()`)
    - Re-render within 500ms of filter change events
    - Shared filter state: switching between timeline and task list preserves all filter selections
    - Implement `_tlOnCanvasClick(e)` — click on empty dated space → navigate to editor with date pre-filled; click on empty undated space → navigate to editor with no date
    - Distinguish click (≤5px movement) from drag
    - On return from editor: re-render with new chit in correct position
    - _Requirements: 15.1–15.6, 17.1–17.4, 20.1–20.4_

- [x] 6. Add script/CSS references and finalize
  - [x] 6.1 Update `index.html` to load new files
    - Add `<link>` for `styles-timeline.css` in the dashboard CSS section
    - Add `<script>` for `main-timeline-algo.js` before `main-timeline.js` (load order matters)
    - Add `<script>` for `main-timeline.js` after `main-timeline-algo.js` and before `main.js`
    - Add `<template id="tmpl-timeline-node">` element for node rendering
    - _Requirements: 1.1_

  - [x] 6.2 Update help documentation
    - Create or update help file in `src/help/` covering the Timeline View feature
    - Document: activation, two-lane layout, dependency creation (3 methods), removal, Link Mode, Order Toggle, Critical Path, zoom/pan, multi-select, task creation on timeline
    - Include deep-links to relevant settings and pages
    - _Requirements: all (documentation)_

  - [x] 6.3 Update `src/INDEX.md` with new files and functions
    - Add entries for `main-timeline.js` (all public functions)
    - Add entries for `main-timeline-algo.js` (all algorithm functions)
    - Add entry for `styles-timeline.css` (sections)
    - _Requirements: project convention_

- [x] 7. Final checkpoint
  - Ensure all interactions work together: mode switching, dependency CRUD, zoom/pan, filters, critical path, Link Mode, multi-select
  - Verify mobile-friendly touch interactions (long-press, pinch zoom, two-finger scroll)
  - Ensure no regressions in existing Tasks/Habits/Assigned modes
  - Update version number (run `date "+%Y%m%d_%H%M"` and update `src/VERSION` + `LATEST`)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No backend changes required — reuses existing `prerequisites` field and API endpoints
- No external dependencies needed — pure vanilla JS + SVG
- The algorithm module (`main-timeline-algo.js`) contains only pure functions with no DOM access, making it independently verifiable
- All UI feedback uses existing shared functions (`cwocToast`, `cwocUndoToast`, `cwocConfirm`)
- The Order Toggle uses the standard CWOC 2-value pill toggle pattern (`cwoc-2val-toggle`)
- Context menu and chit picker follow existing modal patterns (parchment theme, ESC to dismiss)
- Zoom is CSS transform-based for performance; detail levels controlled by CSS class visibility
- Each task references specific requirements for traceability
- Platform scope: Web (desktop + mobile browser). Android app parity is a separate follow-up per platform scope rules.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "5.1"] },
    { "id": 3, "tasks": ["3.1", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 4, "tasks": ["3.2", "3.5", "5.2"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] }
  ]
}
```
