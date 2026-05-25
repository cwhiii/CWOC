# Design Document: Task Timeline View

## Overview

The Task Timeline View is a horizontal, side-scrolling sub-mode within the existing Tasks tab that visualizes chits as positioned nodes with dependency lines drawn between them. It reuses the existing `prerequisites` field (a JSON array of chit IDs stored on each chit) — no schema changes are required.

The view provides:
- Two-lane layout (dated chits above, undated below)
- Date markers at equal spacing for dates that have chits
- Curved SVG dependency lines (subway-map style)
- Drag-to-link, context menu, and Link Mode for dependency creation
- Cycle detection (BFS) before any link is persisted
- Critical path highlighting (longest chain in the DAG)
- Zoom/pan with three detail levels
- Full integration with existing sidebar filters

**Key Design Decision: SVG-based rendering.** The timeline uses an inline SVG element for dependency lines and DOM elements for nodes. This hybrid approach gives us:
- CSS-styled nodes that match the existing parchment theme
- Hardware-accelerated SVG path rendering for lines
- Native hit-testing on lines (no manual coordinate math for click detection)
- Accessibility via DOM semantics on nodes

This avoids Canvas API (no native hit-testing, no CSS styling) and pure-DOM lines (poor performance with many connections, no smooth curves).

## Architecture

```mermaid
graph TD
    subgraph Dashboard
        SB[Sidebar - shared-sidebar.js]
        MV[main-views-tasks.js]
        TL[main-timeline.js - NEW]
        TLA[main-timeline-algo.js - NEW]
    end

    subgraph Shared
        ST[shared-touch.js]
        SU[shared-utils.js]
        SI[shared-indicators.js]
    end

    subgraph Backend
        API[/api/chits - existing]
        CP[/api/chits/check-prerequisites - existing]
    end

    SB -->|mode button click| MV
    MV -->|_tasksViewMode === 'timeline'| TL
    TL -->|layout computation| TLA
    TL -->|dependency CRUD| API
    TL -->|cycle check| CP
    TL -->|touch gestures| ST
    TL -->|toasts, confirms| SU
    TL -->|prereq flags| SI
```

### File Organization

| File | Purpose |
|------|---------|
| `src/frontend/js/dashboard/main-timeline.js` | Timeline view rendering, interaction handlers, SVG management |
| `src/frontend/js/dashboard/main-timeline-algo.js` | Pure algorithm functions: topological sort, critical path, layout computation, cycle detection (client-side) |
| `src/frontend/css/dashboard/styles-timeline.css` | All timeline-specific CSS (nodes, lines, lanes, toolbar) |

**Rationale for two JS files:** Separating pure algorithms from DOM/interaction code keeps each file under ~400 lines and makes the algorithm functions independently testable.

### Integration Points

1. **View Mode Switch** — `_setTasksMode('timeline')` in `main-views-tasks.js` delegates to `displayTimelineView(chitsToDisplay)` in `main-timeline.js`
2. **Sidebar Button** — A fourth button `🔗 Timeline` added to the Tasks View Mode section in `shared-sidebar.js`
3. **URL Hash** — `#tasks/timeline` follows the existing `#tab/mode` pattern
4. **Filter State** — Timeline receives the same filtered chit array as other Tasks sub-modes (filtering happens upstream in `filterChits()`)
5. **Chit CRUD** — Uses existing `PUT /api/chits/{id}` to update `prerequisites` field; uses existing `POST /api/chits/check-prerequisites` for cycle detection
6. **Refresh** — Listens to the same `fetchChits()` cycle; re-renders when `displayChits()` is called

## Components and Interfaces

### 1. Timeline Container (`_tlContainer`)

A wrapper `<div>` injected into `#chit-list` when timeline mode is active. Structure:

```html
<div class="timeline-container">
  <!-- Toolbar -->
  <div class="timeline-toolbar">
    <div class="cwoc-2val-toggle" id="tl-order-toggle">
      <input type="hidden" id="tl-order-val" value="date" />
      <span data-val="date" class="active">By Date</span>
      <span data-val="dependency">By Dependency</span>
    </div>
    <button class="action-button" id="tl-link-mode-btn">🔗 Link Mode</button>
    <button class="action-button" id="tl-critical-path-btn">⚡ Critical Path</button>
  </div>

  <!-- Canvas area (scrollable) -->
  <div class="timeline-viewport" id="tl-viewport">
    <div class="timeline-canvas" id="tl-canvas">
      <!-- Dated Lane -->
      <div class="timeline-lane timeline-dated-lane" id="tl-dated-lane">
        <!-- Date markers and nodes rendered here -->
      </div>
      <!-- Divider -->
      <div class="timeline-lane-divider"></div>
      <!-- Undated Lane -->
      <div class="timeline-lane timeline-undated-lane" id="tl-undated-lane">
        <!-- Undated nodes rendered here -->
      </div>
      <!-- SVG overlay for dependency lines -->
      <svg class="timeline-svg-overlay" id="tl-svg"></svg>
    </div>
  </div>
</div>
```

### 2. Node Rendering

Each node is a `<div class="timeline-node">` positioned absolutely within its lane. Nodes contain:
- Title text (always visible)
- Status border color (CSS class: `tl-node-todo`, `tl-node-inprogress`, `tl-node-blocked`, `tl-node-complete`)
- Custom background color (inline style from chit.color)
- At medium/close zoom: status text, dates, tags, description preview

### 3. Dependency Line Rendering

Lines are `<path>` elements in the SVG overlay. Each path uses rounded orthogonal routing:

```
M startX,startY        → start at prerequisite node right edge
H startX+offset        → horizontal segment out
Q controlX,controlY    → quarter-circle turn
V endY                 → vertical segment to target row
Q controlX2,controlY2  → quarter-circle turn
H endX                 → horizontal segment to dependent node left edge
```

Lines carry `data-from` and `data-to` attributes for hit-testing and interaction.

### 4. Algorithm Module (`main-timeline-algo.js`)

Pure functions with no DOM dependencies:

```javascript
/**
 * Compute topological depth for each chit in the dependency graph.
 * @param {Array} chits - Array of chit objects with .id and .prerequisites
 * @returns {Map<string, number>} - Map of chit ID to depth (0 = root)
 */
function _tlComputeDepths(chits) { ... }

/**
 * Detect if adding an edge would create a cycle (BFS from target).
 * @param {string} fromId - Proposed prerequisite
 * @param {string} toId - Proposed dependent
 * @param {Map<string, string[]>} adjList - Current adjacency list (prereq → dependents)
 * @returns {boolean} - true if cycle would result
 */
function _tlWouldCycle(fromId, toId, adjList) { ... }

/**
 * Compute the critical path (longest chain from any root to any leaf).
 * @param {Array} chits - Array of chit objects
 * @returns {Set<string>} - Set of chit IDs on the critical path
 */
function _tlCriticalPath(chits) { ... }

/**
 * Compute node positions for date-based layout.
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - { canvasWidth, nodeWidth, nodeHeight, markerSpacing }
 * @returns {Map<string, {x, y, lane}>} - Position map
 */
function _tlLayoutByDate(chits, opts) { ... }

/**
 * Compute node positions for dependency-depth layout.
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - { canvasWidth, nodeWidth, nodeHeight, depthSpacing }
 * @returns {Map<string, {x, y, lane}>} - Position map
 */
function _tlLayoutByDependency(chits, opts) { ... }

/**
 * Build adjacency list from chit array.
 * @param {Array} chits - Array of chit objects
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]> }}
 */
function _tlBuildGraph(chits) { ... }
```

### 5. Interaction Handlers

| Interaction | Handler | Behavior |
|-------------|---------|----------|
| Drag node → node | `_tlOnNodeDragStart/Move/End` | Creates dependency (with cycle check) |
| Click line | `_tlOnLineClick` | Removes dependency (with undo toast) |
| Right-click / long-press node | `_tlOnNodeContext` | Context menu (add prereq, remove prereq) |
| Click empty dated space | `_tlOnCanvasClick` | Navigate to editor with date pre-filled |
| Click empty undated space | `_tlOnCanvasClick` | Navigate to editor with no date |
| Drag empty space | `_tlOnViewportDrag` | Pan the viewport |
| Pinch / Ctrl+scroll | `_tlOnZoom` | Zoom in/out (25%–300%) |
| Drag-select (empty space) | `_tlOnRectSelect` | Multi-select nodes |
| Link Mode click | `_tlOnLinkModeClick` | Sequential two-click linking |

### 6. Zoom Levels

| Range | Class | Detail |
|-------|-------|--------|
| 25%–60% | `tl-zoom-far` | Dot + title only |
| 61%–150% | `tl-zoom-medium` | Card with title + status |
| 151%–300% | `tl-zoom-close` | Full card: title, status, dates, tags, description preview |

Zoom is applied via CSS `transform: scale(N)` on `#tl-canvas` with `transform-origin: 0 0`. The viewport uses `overflow: auto` for scrolling.

## Data Models

### Existing Data (No Changes Required)

**Chit model** (`src/backend/models.py`):
```python
prerequisites: Optional[List[str]] = None  # JSON array of chit IDs
```

**API endpoints used:**
- `GET /api/chits` — Returns all chits (filtered by user). Each chit includes `prerequisites` as a JSON array.
- `PUT /api/chits/{id}` — Updates a chit. Used to modify the `prerequisites` array.
- `POST /api/chits/check-prerequisites` — Body: `{ "chit_id": "...", "prerequisite_id": "..." }`. Returns `{ "circular": true/false }`.

### Client-Side Derived State

The timeline computes and caches these structures on each render:

```javascript
// Built from chit.prerequisites arrays
var _tlGraph = {
  forward: new Map(),   // prereqId → [dependentId, ...]
  reverse: new Map()    // dependentId → [prereqId, ...]
};

// Node positions (recomputed on layout change)
var _tlPositions = new Map(); // chitId → { x, y, lane: 'dated'|'undated' }

// Current zoom level
var _tlZoom = 1.0; // 0.25 to 3.0

// Current order mode
var _tlOrderMode = 'date'; // 'date' | 'dependency'

// Link mode state
var _tlLinkMode = false;
var _tlLinkSource = null; // chit ID of first-clicked node

// Critical path state
var _tlCriticalPathActive = false;
var _tlCriticalPathNodes = new Set(); // chit IDs on critical path
```

### Dependency Graph Representation

The graph is built client-side from the chit array on every render:

```javascript
function _tlBuildGraph(visibleChits) {
  var forward = new Map(); // prereq → dependents
  var reverse = new Map(); // dependent → prereqs
  var idSet = new Set(visibleChits.map(c => c.id));

  visibleChits.forEach(function(chit) {
    var prereqs = chit.prerequisites || [];
    if (typeof prereqs === 'string') { try { prereqs = JSON.parse(prereqs); } catch(e) { prereqs = []; } }
    prereqs.forEach(function(prereqId) {
      // Only include edges where both endpoints are visible
      if (!idSet.has(prereqId)) return;
      if (!forward.has(prereqId)) forward.set(prereqId, []);
      forward.get(prereqId).push(chit.id);
      if (!reverse.has(chit.id)) reverse.set(chit.id, []);
      reverse.get(chit.id).push(prereqId);
    });
  });

  return { forward: forward, reverse: reverse };
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Lane Assignment

*For any* chit, if it has at least one date field set (start_datetime, due_datetime, or point_in_time), it SHALL be assigned to the dated lane; otherwise it SHALL be assigned to the undated lane.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Undated Lane Ordering

*For any* set of undated chits in the undated lane, their horizontal positions SHALL be ordered by ascending creation date (oldest leftmost).

**Validates: Requirements 2.4**

### Property 3: No Vertical Overlap at Same Marker

*For any* set of chits sharing the same date marker, no two node bounding boxes SHALL overlap by even one pixel in the vertical dimension.

**Validates: Requirements 2.5**

### Property 4: Date Marker Correctness

*For any* set of visible chits, the rendered date markers SHALL satisfy all three conditions: (a) a marker exists if and only if at least one visible chit has that date, (b) all markers are equally spaced horizontally regardless of calendar distance, and (c) each marker has a formatted date label.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Dependency Line Existence and Direction

*For any* dependency edge (prerequisite → dependent) where both nodes are visible, a corresponding SVG path SHALL exist, and the path's start x-coordinate SHALL be less than its end x-coordinate (left-to-right direction).

**Validates: Requirements 4.1, 4.2**

### Property 6: Status-Based Line Styling

*For any* dependency line, if both connected chits have status "Complete" then the line SHALL be rendered as dashed at 0.4 opacity; otherwise the line SHALL be rendered as solid at full opacity with 2px width.

**Validates: Requirements 4.3, 4.4, 14.2, 14.3**

### Property 7: Node Styling by Status and Color

*For any* chit node, the border color SHALL match its status (brown for ToDo, green for In Progress, red for Blocked, and opacity 0.5 for Complete), and the background SHALL be the chit's custom color if set or the default parchment background otherwise, with both applied simultaneously without one overriding the other.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 14.1**

### Property 8: Cycle Detection Correctness

*For any* directed graph of chit dependencies and any proposed new edge (A → B), the cycle detection algorithm SHALL return true if and only if there exists a path from B to A in the current graph (i.e., adding the edge would create a cycle).

**Validates: Requirements 5.2, 7.6, 9.3**

### Property 9: Topological Depth Positioning

*For any* set of chits in "By Dependency" mode, each node's horizontal position SHALL correspond to its topological depth (number of prerequisite hops from a root node), with nodes at the same depth sharing the same x-position band.

**Validates: Requirements 10.3**

### Property 10: Critical Path is Longest Path

*For any* DAG of chit dependencies, the critical path computation SHALL return the set of nodes on the longest chain(s) from any root (no prerequisites) to any leaf (no dependents), and if multiple paths tie for longest, all tied paths SHALL be included.

**Validates: Requirements 13.2, 13.3**

### Property 11: Chain Ordering by Position

*For any* set of 2+ selected nodes, the "Link as chain" action SHALL create sequential dependencies ordered by ascending horizontal position, using ascending vertical position as tiebreaker when horizontal positions are equal.

**Validates: Requirements 9.2**

### Property 12: Chain Preserves Existing Edges

*For any* set of selected nodes with pre-existing dependency links among them, the "Link as chain" action SHALL preserve all existing links that do not conflict with the new chain order, adding only the missing sequential links.

**Validates: Requirements 9.4**

### Property 13: No Transitive Connections Through Hidden Nodes

*For any* graph where node B is hidden by a filter and A→B→C exists, the timeline SHALL NOT render a direct A→C connection that was not explicitly present in the original dependency data.

**Validates: Requirements 15.3**

### Property 14: Deterministic Layout

*For any* identical set of chit data and filter state, the layout algorithm SHALL produce identical node positions on every invocation.

**Validates: Requirements 19.1, 19.2**

### Property 15: Position Unaffected by Completion Status

*For any* chit, changing its status to or from "Complete" SHALL NOT change its computed position in the layout (only its visual styling changes).

**Validates: Requirements 14.4**

### Property 16: Click vs Drag Discrimination

*For any* pointer interaction, if the total movement from pointer-down to pointer-up is ≤ 5 pixels, it SHALL be classified as a click; if > 5 pixels, it SHALL be classified as a drag.

**Validates: Requirements 17.4**

## Error Handling

### Dependency Creation Failures

| Scenario | Behavior |
|----------|----------|
| Cycle detected (client-side BFS) | Block operation, show `cwocToast('Cannot link: would create a circular dependency.', 'error')` |
| Self-link attempted | Block operation, show `cwocToast('Cannot link a task to itself.', 'error')` |
| Duplicate link attempted | Block operation, show `cwocToast('This dependency already exists.', 'info')` |
| API PUT fails (network/server error) | Revert visual change, show `cwocToast('Failed to save dependency. Please try again.', 'error')` |
| API cycle check disagrees with client | Trust server response, revert if server says circular |

### Dependency Removal Failures

| Scenario | Behavior |
|----------|----------|
| API PUT fails on removal | Restore the line visually, show `cwocToast('Failed to remove dependency.', 'error')` |
| API PUT fails on undo-restore | Remove the line again, show `cwocToast('Failed to restore dependency.', 'error')` |

### Layout Edge Cases

| Scenario | Behavior |
|----------|----------|
| Chit has prerequisites pointing to deleted/non-existent chits | Ignore those edges (filter out IDs not in visible set) |
| Chit has prerequisites pointing to chits in other tabs (non-task chits) | Include them if they pass the current filter; otherwise treat as hidden |
| Extremely large graph (500+ nodes) | Render visible viewport only; use `requestAnimationFrame` for smooth layout |
| Zero chits visible | Show empty state with `.cwoc-empty` class |

### Zoom/Pan Edge Cases

| Scenario | Behavior |
|----------|----------|
| Zoom at boundary (25% or 300%) | Clamp to boundary, no further zoom |
| Pan beyond canvas bounds | Allow overscroll with elastic snap-back (CSS `scroll-behavior: smooth`) |
| Resize during animation | Cancel current animation, recompute layout fresh |

## Testing Strategy

### Unit Tests (Example-Based)

Focus on specific interactions and edge cases:
- Mode switching (timeline ↔ tasks/habits/assigned)
- URL hash persistence (`#tasks/timeline`)
- Empty state rendering
- Context menu display and dismissal
- Link Mode toggle behavior (ESC cancellation, cursor change)
- Undo toast for dependency removal
- Zoom level class application at boundaries
- Click vs drag threshold at exactly 5px

### Property Tests

The following properties are suitable for property-based testing using the algorithm module (`main-timeline-algo.js`), which contains pure functions with clear input/output behavior:

**Library:** fast-check (JavaScript property-based testing library — already usable without npm install since tests are optional per project rules)

**Configuration:** Minimum 100 iterations per property test.

**Tag format:** `Feature: task-timeline-view, Property {N}: {title}`

Properties to test:
1. **Lane Assignment** — Generate random chits with/without dates, verify lane classification
2. **Cycle Detection** — Generate random DAGs + proposed edges, verify correct cycle/no-cycle classification
3. **Topological Depth** — Generate random DAGs, verify depth computation matches BFS from roots
4. **Critical Path** — Generate random DAGs, verify returned path is longest (no longer path exists)
5. **Deterministic Layout** — Generate random chit sets, run layout twice, verify identical output
6. **Chain Ordering** — Generate random 2D positions, verify chain order matches ascending x then y
7. **No Overlap** — Generate random chits at same date, verify layout produces no overlapping bounding boxes
8. **Date Marker Correctness** — Generate random dated chits, verify marker set equals unique date set

### Integration Tests

- Filter changes propagate correctly to timeline
- API calls for prerequisite updates succeed and reflect in UI
- Navigation to editor with pre-filled date works correctly
- Shared filter state between timeline and task list modes

### Manual Testing Checklist

- Touch gestures on mobile (pinch zoom, two-finger scroll, long-press context menu)
- Performance with 100+ nodes and 200+ edges
- Cross-lane dependency lines render smoothly
- Critical path highlighting with complex graphs
- Drag-to-link visual feedback during drag

