# Design: Timeline Mode for Tasks View (Android App)

## Architecture

The timeline is implemented as a Compose Canvas-based view within the existing `TasksScreen`. The architecture mirrors the web implementation's separation of concerns:

1. **Algorithm layer** (pure functions, no UI) — `TimelineAlgorithms.kt`
2. **State management** — `TimelineViewModel` (or state within `TasksViewModel`)
3. **Rendering** — `TimelineCanvas` composable using Compose Canvas API
4. **Interaction handlers** — gesture detectors layered on the canvas

## File Structure

```
android/app/src/main/java/com/cwoc/app/ui/screens/tasks/timeline/
├── TimelineAlgorithms.kt      — Pure graph/layout functions (mirrors main-timeline-algo.js)
├── TimelineState.kt           — Data classes for timeline state
├── TimelineCanvas.kt          — Main composable: canvas rendering + gesture handling
├── TimelineNodeRenderer.kt    — Node drawing logic (status colors, zoom levels, text)
├── TimelineLineRenderer.kt    — SVG-equivalent path drawing (dependency lines, routing)
├── TimelineInteractions.kt    — Gesture handlers (tap, long-press, drag, pinch)
├── TimelineContextMenu.kt     — Context menu composable (long-press menu)
├── TimelineChitPicker.kt      — Chit picker dialog (add/remove prerequisites)
└── TimelineZoomControls.kt    — Zoom +/−/⊙ buttons overlay
```

## Key Design Decisions

### Canvas vs LazyLayout
Using **Compose Canvas** (not LazyColumn/LazyGrid) because:
- Nodes are absolutely positioned at arbitrary (x,y) coordinates
- SVG-equivalent line drawing requires a drawing surface
- Zoom/pan transforms the entire canvas
- This matches the web's approach (absolutely positioned divs + SVG overlay)

### State Model
```kotlin
data class TimelineState(
    val zoom: Float = 1.0f,                    // 0.25–3.0
    val panOffset: Offset = Offset.Zero,       // Current scroll position
    val orderMode: OrderMode = OrderMode.DATE, // DATE or DEPENDENCY
    val linkMode: Boolean = false,
    val linkSource: String? = null,            // Chit ID of first-clicked node
    val criticalPathActive: Boolean = false,
    val criticalPathNodes: Set<String> = emptySet(),
    val highlightedNodeId: String? = null,
    val selectedNodes: Set<String> = emptySet(),
    val greyCompleted: Boolean = true,
    val positions: Map<String, NodePosition> = emptyMap(),
    val graph: DependencyGraph = DependencyGraph(),
    val undoStack: List<DependencyAction> = emptyList(),
    val redoStack: List<DependencyAction> = emptyList(),
    val contextMenuState: ContextMenuState? = null
)

data class NodePosition(val x: Float, val y: Float, val lane: Lane)
enum class Lane { DATED, UNDATED }
enum class OrderMode { DATE, DEPENDENCY }

data class DependencyGraph(
    val forward: Map<String, List<String>> = emptyMap(),  // prereqId → [dependentIds]
    val reverse: Map<String, List<String>> = emptyMap()   // dependentId → [prereqIds]
)

data class DependencyAction(
    val type: ActionType,  // ADD or REMOVE
    val chitId: String,
    val oldPrereqs: List<String>,
    val newPrereqs: List<String>
)
```

### Rendering Pipeline (matches web's `_tlRender`)
1. Filter chits (status filter, completed filter)
2. Build graph (`buildGraph`)
3. Compute layout (`layoutByDate` or `layoutByDependency`)
4. Draw date markers (date mode only)
5. Draw nodes at computed positions
6. Draw dependency lines between connected nodes
7. Apply zoom transform
8. Apply highlighting/dimming

### Gesture Handling
- **Single tap on node**: highlight (or Link Mode select)
- **Double tap on node**: navigate to editor
- **Long press on node**: context menu OR drag-to-link (if finger moves)
- **Single tap on empty space**: clear highlight
- **Single finger drag on empty space**: pan
- **Two-finger pinch**: zoom
- **Tap on line**: confirm remove dependency

### Line Routing Algorithm
Ported directly from `_tlRouteAroundNodes`:
1. If same Y and no blocking nodes → straight horizontal line
2. If adjacent columns (gap < 80dp) → L-route through gap center with rounded corners
3. Otherwise → find clear vertical channel, route with collision avoidance
4. Backward connections → route down/up then left

### Zoom Levels (matches CSS classes)
- **Far** (≤60%): nodes 120×32dp, title only
- **Medium** (61–150%): nodes 180×48dp, title + status
- **Close** (>150%): nodes 220×64dp, title + status + detail

## Integration Points

### Sidebar
Add "⏱️ Timeline" button to the Tasks view mode row in `SidebarContent.kt`.

### TasksScreen
Add `"timeline"` case to the `when (tasksMode)` block that renders `TimelineCanvas` instead of `TasksFlatList`.

### ChitRepository
Use existing `updateFields(chitId, fields)` method to persist prerequisite changes. The `prerequisites` field is a JSON array of chit IDs.

### Offline Support
All dependency mutations go through `ChitRepository` which handles offline queuing and sync. No direct API calls from the timeline code.
