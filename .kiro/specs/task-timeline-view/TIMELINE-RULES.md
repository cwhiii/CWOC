# Timeline View — Absolute Rules & Behavior Spec

This document describes EXACTLY how the Timeline View must behave. Every rule is non-negotiable.

---

## 1. Node Appearance

### 1.1 Background Color
- **EVERY node MUST have a solid, opaque background color. NO node may EVER be transparent or show the page texture behind it.**
- If a chit has a custom `color` field set (non-null, non-empty, not "null", not "undefined"): use that color.
- If a chit has NO custom color: use `ivory` (#FFFFF0).
- If a chit is Complete or Rejected: use solid gray `#d4d4d4` with border `#999` and text `#666`. NOT transparent. NOT opacity-based. Solid gray.
- The CSS class `.timeline-node` MUST have `background-color: ivory` as a default.
- The JS MUST set `node.style.backgroundColor = 'ivory'` unconditionally FIRST, then override with custom color or gray.

### 1.2 Fixed Height
- All nodes are exactly 52px tall. No min-height, no variable height. Fixed `height: 52px`.

### 1.3 No Dates Displayed
- Do NOT show dates on nodes. Completion date goes in the tooltip only.
- Tooltip format: "Title — Status\nCompleted: YYYY-MM-DD" (only if complete).

### 1.4 Status Border Colors
- ToDo: brown border (#8b4513)
- In Progress: green border (#2e7d32)
- Blocked: red border (#c0392b)
- Complete: gray border (#999)

---

## 2. Line Routing — THE MOST IMPORTANT RULE

### 2.1 ABSOLUTE RULE: Lines may NEVER cross, overlap, or touch ANY node except at their start and end points.

- A line starts at the RIGHT-CENTER of the source node (vertically centered on the right edge).
- A line ends at the LEFT-CENTER of the target node (vertically centered on the left edge).
- Between those two points, the line may ONLY travel through EMPTY SPACE — the gaps between nodes.

### 2.2 Available Routing Space
The layout creates a grid of nodes with:
- **Horizontal gaps** between columns (60px wide). Lines can travel VERTICALLY in these gaps.
- **Vertical gaps** between rows (the space between the bottom of one node and the top of the next). Lines can travel HORIZONTALLY in these gaps.

### 2.3 Routing Algorithm
For a line from source (col A, row X) to target (col B, row Y):

**If same row (X == Y):** Straight horizontal line through the gap. Simple.

**If different row (X != Y):**
1. Exit source node horizontally into the gap between col A and col B (travel right into the 60px gap).
2. Travel VERTICALLY within that gap (this is safe — no nodes exist in the gap between columns).
3. When you reach the target's row (Y), turn and travel horizontally into the target.

**CRITICAL: The vertical segment MUST be in the gap between columns.** The gap between columns is the 60px space between the right edge of column A nodes and the left edge of column B nodes. The vertical segment runs at the MIDPOINT of this gap. Since no nodes exist in this gap, the vertical segment can NEVER cross a node.

**CRITICAL: The horizontal segments at startY and endY MUST NOT cross any node.** The horizontal segment at startY goes from the source's right edge to the vertical channel — this is WITHIN the gap (source right edge → midpoint of gap). The horizontal segment at endY goes from the vertical channel to the target's left edge — this is also WITHIN the gap (midpoint of gap → target left edge). NEITHER horizontal segment enters any node's column space.

### 2.4 Why This Works
In the dependency layout, connected nodes are ALWAYS in adjacent columns (source in col N, target in col N+1). The gap between col N and col N+1 is 60px wide. The line travels:
- 4px out from source right edge (still in the gap)
- Horizontally to the midpoint of the gap (30px into the gap)
- Vertically to the target's Y (entirely within the gap — no nodes here)
- Horizontally from the midpoint to 4px before the target's left edge
- Into the target

At NO point does the line enter any node's bounding box.

### 2.5 Multi-Column Connections
If source is in col 0 and target is in col 2 (skipping col 1), the line must route through the gap between col 0 and col 1, then through the gap between col 1 and col 2. It must NOT cross through col 1 nodes.

### 2.6 Line Style
- Orthogonal (right-angle) routing with small rounded corners (radius 6-8px).
- 2px stroke width, brown color matching the theme.
- Lines render BEHIND nodes (SVG z-index 0, nodes z-index 1).

---

## 3. Layout — By Dependency Mode

### 3.1 Column Assignment
- Column 0: Nodes with NO prerequisites (root nodes + unconnected nodes).
- Column 1: Nodes whose prerequisites are ALL in column 0.
- Column 2: Nodes whose prerequisites include at least one in column 1.
- Column N: Nodes whose deepest prerequisite is in column N-1.

### 3.2 Column 0 Ordering (top to bottom)
1. Connected nodes first (those that have dependents in later columns).
2. Then unconnected nodes.
3. Within each group: incomplete before complete, then alphabetical.

### 3.3 Column 1+ Ordering
Each node is placed at the SAME Y as its prerequisite (directly to the right).
- If a node has multiple prerequisites, place it at the average Y of its prerequisites.
- If multiple nodes target the same Y, stack them vertically starting from that Y (push down to avoid overlap).
- Minimum vertical gap between nodes: 10px.

### 3.4 Spacing
- Horizontal gap between columns: 60px (lines route here).
- Vertical gap between nodes in same column: 10px minimum.
- Node width: 180px.
- Node height: 52px.

---

## 4. Layout — By Date Mode

### 4.1 Same as Dependency Mode
The "By Date" mode uses the SAME column-based layout as dependency mode. The only difference is that unconnected nodes may be sorted by date instead of alphabetically.

This ensures lines always route through column gaps and never cross nodes.

---

## 5. Filtering

### 5.1 Completed Chits
- Completed chits are HIDDEN unless they are part of a dependency tree (have prerequisites or are a prerequisite of something).
- Hidden means NOT RENDERED — not on screen at all.

### 5.2 Only Tasks
- Only show chits with a `status` field. No birthdays, no date-only items.

---

## 6. Interactions

### 6.1 Opening Chits
- Double-click: opens the full editor.
- Right-click / long-press: context menu with "Quick Edit", "Edit Chit", "Add prerequisite...", "Remove prerequisite".

### 6.2 Remove Prerequisite
- If only ONE prerequisite exists: remove it immediately (no picker).
- If multiple: show picker.

### 6.3 Undo/Redo
- Cmd+Z: undo last dependency action.
- Cmd+Shift+Z: redo.

### 6.4 Link Mode
- Toggle button in sidebar. Crosshair cursor.
- Click source, click target → creates dependency.
- ESC cancels.

---

## 7. Controls Location

### 7.1 Sidebar
- View Mode buttons: 2×2 grid (Timeline top-left, List top-right, Assigned bottom-left, Habits bottom-right).
- Timeline Controls section (visible when in timeline mode): By Date / By Dependency toggle, Link Mode button, Critical Path button.
- All controls have tooltips.

### 7.2 Bottom-Right Corner
- Zoom In (+), Zoom Out (−), Recenter (⊙) buttons.

---

## 8. What NOT To Do

- Do NOT make nodes transparent. Ever.
- Do NOT route lines through nodes. Ever.
- Do NOT change things that aren't broken when fixing something else.
- Do NOT use opacity for completed nodes. Use solid gray.
- Do NOT show dates on nodes.
- Do NOT use S-curves or organic lines. Use orthogonal (right-angle) with small corner radius.
