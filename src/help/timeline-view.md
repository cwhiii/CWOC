# Timeline View

- [Activation](#activation)
- [Two-Lane Layout](#two-lane-layout)
- [Date Markers](#date-markers)
- [Dependency Lines](#dependency-lines)
- [Creating Dependencies](#creating-dependencies)
- [Removing Dependencies](#removing-dependencies)
- [Link Mode](#link-mode)
- [Order Toggle](#order-toggle)
- [Critical Path](#critical-path)
- [Zoom & Pan](#zoom--pan)
- [Multi-Select](#multi-select)
- [Task Creation](#task-creation)
- [Filters](#filters)


The Timeline View is a horizontal, side-scrolling sub-mode within the Tasks tab that visualizes chits as positioned nodes with dependency lines drawn between them. It provides a spatial view of task relationships, letting you see prerequisite chains, identify bottlenecks, and manage dependencies visually.

## Activation

Switch to the Timeline by opening the Tasks tab and selecting **🔗 Timeline** in the sidebar View Mode section. The URL updates to `#tasks/timeline` and persists across page refreshes. Switch back to any other mode (Tasks, Habits, Assigned) by clicking its button in the sidebar.

## Two-Lane Layout

The timeline canvas is divided into two horizontal lanes separated by a visible divider:

- **Dated Lane** (upper) — Chits that have at least one date field set (start, due, or point-in-time) are positioned here at their corresponding date marker
- **Undated Lane** (lower) — Chits with no dates are placed here, ordered left-to-right by creation date (oldest first)

When multiple chits share the same date, they stack vertically within the Dated Lane without overlapping. If a chit gains or loses a date, it moves between lanes automatically.

## Date Markers

Vertical lines appear only at dates where at least one visible chit exists. Markers are equally spaced regardless of actual calendar distance between dates, keeping the timeline compact and focused. Each marker displays a formatted date label.

## Dependency Lines

Curved SVG lines (subway-map style) connect prerequisite chits to their dependents, flowing left to right. Lines cross between lanes seamlessly when a dependency spans dated and undated chits.

- **Active lines** — Solid stroke, 2px width, brown tone
- **Completed lines** — Dashed stroke (6px dash, 4px gap) at 0.4 opacity (when both connected chits are Complete)

Hover or tap a node to highlight its direct connections and dim everything else. Move away or tap elsewhere to restore.

## Creating Dependencies

Three methods to link tasks:

### Drag-to-Link

Drag from one node onto another. A visual connector follows your pointer during the drag. On drop, the dragged node becomes a prerequisite of the target. Blocked if it would create a circular dependency, a self-link, or a duplicate.

### Context Menu

Right-click (desktop) or long-press (touch, 500ms) a node to open its context menu. Select **"Add prerequisite..."** to open a searchable chit picker. Select one or more chits to link as prerequisites. Any selection that would create a cycle is skipped with a toast notification.

### Link Mode

Toggle the **🔗 Link Mode** button in the toolbar. Click a first node (highlighted as source), then click a second node to create the dependency. The first becomes a prerequisite of the second. Press **Escape** or toggle off to cancel a partial selection.

## Removing Dependencies

Two methods:

- **Click a dependency line** — The line is removed immediately and an undo toast appears with a 5-second countdown. Click Undo to restore it
- **Context menu → "Remove prerequisite"** — Right-click/long-press a node, select "Remove prerequisite," then choose which prerequisite(s) to remove from the list

All removals are persisted via the API. If the save fails, the line is restored and an error toast appears.

## Link Mode

The toolbar's **🔗 Link Mode** button toggles a sequential two-click linking workflow:

1. Toggle on — cursor changes to crosshair
2. Click first node — highlighted as source
3. Click second node — dependency created (first → second)
4. Source clears, ready for next pair

Cancel anytime with **Escape** or by toggling the button off. Cycles, self-links, and duplicates are blocked with a toast message.

## Order Toggle

The toolbar provides a **By Date / By Dependency** toggle:

- **By Date** (default) — Nodes positioned at date markers; undated chits in a separate region at the end
- **By Dependency** — Nodes positioned by topological depth (number of prerequisite hops from a root). Date annotations appear on each node instead of date markers

Switching animates the layout transition (300ms). The selection persists for the session.

## Critical Path

Toggle **⚡ Critical Path** in the toolbar to highlight the longest dependency chain from any root (no prerequisites) to any leaf (no dependents):

- Critical path lines render at 2× thickness in a distinct color
- Critical path nodes are highlighted
- All other nodes and lines dim to ≤50% opacity
- If multiple paths tie for longest, all are highlighted

If no dependency lines exist, the toggle stays inactive with a message indicating no chain is available.

## Zoom & Pan

- **Zoom** — Ctrl+scroll (desktop) or pinch (touch). Range: 25%–300%, 10% per tick
- **Pan** — Click and drag empty space for 1:1 pixel panning
- **Scroll** — Two-finger swipe or scroll wheel for horizontal/vertical movement

Three detail levels based on zoom percentage:

| Zoom | Detail |
|------|--------|
| 25%–60% | Dot + title only |
| 61%–150% | Card with title and status |
| 151%–300% | Full card: title, status, dates, tags, description preview |

## Multi-Select

**Shift+drag** on empty space draws a selection rectangle. All nodes whose center falls within the rectangle are selected.

With 2+ nodes selected, a **"Link as chain"** action creates sequential dependencies ordered by horizontal position (left to right), using vertical position as tiebreaker. Existing non-conflicting links among the selected nodes are preserved; only missing sequential links are added. The entire operation is blocked if it would create a cycle.

## Task Creation

Click (without dragging) on empty space to create a new chit:

- **In the Dated Lane** at a date marker column — navigates to the [Chit Editor](/editor) with the date pre-filled
- **In the Undated Lane** — navigates to the [Chit Editor](/editor) with no date pre-filled

A click is distinguished from a drag by ≤5px total pointer movement.

## Filters

All existing sidebar [filters](/frontend/html/help.html#filters) (status, tags, people, date ranges, project, archive/pinned/snoozed toggles, custom view filters) apply to the Timeline View. Filtered-out nodes are removed and the layout reflows. Dependency lines to hidden nodes fade out with a gradient. Switching between Timeline and Tasks list preserves all filter selections.

---

**See also:** [Views](/frontend/html/help.html#views) · [Chit Editor](/editor) · [Filtering & Sorting](/frontend/html/help.html#filters) · [Keyboard Shortcuts](/frontend/html/help.html#hotkeys) · [Settings → Views](/frontend/html/settings.html#views)
