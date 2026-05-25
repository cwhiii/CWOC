/**
 * main-timeline-algo.js — Pure algorithm functions for the Timeline View.
 *
 * Contains ONLY deterministic pure functions with no DOM access.
 * Separated from main-timeline.js for testability and to keep files focused.
 *
 * Functions:
 *   _tlBuildGraph(chits)          — builds forward/reverse adjacency maps
 *   _tlComputeDepths(chits)      — BFS-based topological depth computation
 *   _tlWouldCycle(fromId, toId, adjList) — BFS cycle detection
 *   _tlCriticalPath(chits)       — longest-path computation (critical path)
 *   _tlLayoutByDate(chits, opts) — date-based node positioning
 *   _tlLayoutByDependency(chits, opts) — dependency-depth-based positioning
 *   _tlChainOrder(nodes)         — sorts nodes by ascending x then y
 *
 * Depends on: nothing (pure functions, no globals, no DOM)
 */

// ── Graph Construction ───────────────────────────────────────────────────────

/**
 * Build adjacency lists from chit prerequisites arrays.
 * Only includes edges where both endpoints are in the visible chit set.
 *
 * @param {Array} chits - Array of chit objects with .id and .prerequisites
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]> }}
 *   forward: prereqId → [dependentId, ...]
 *   reverse: dependentId → [prereqId, ...]
 */
function _tlBuildGraph(chits) {
  var forward = new Map();
  var reverse = new Map();
  var idSet = new Set();

  for (var i = 0; i < chits.length; i++) {
    idSet.add(chits[i].id);
  }

  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];
    var prereqs = chit.prerequisites || [];
    if (typeof prereqs === 'string') {
      try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
    }
    if (!Array.isArray(prereqs)) prereqs = [];

    for (var j = 0; j < prereqs.length; j++) {
      var prereqId = prereqs[j];
      // Only include edges where both endpoints are in the visible set
      if (!idSet.has(prereqId)) continue;

      if (!forward.has(prereqId)) forward.set(prereqId, []);
      forward.get(prereqId).push(chit.id);

      if (!reverse.has(chit.id)) reverse.set(chit.id, []);
      reverse.get(chit.id).push(prereqId);
    }
  }

  return { forward: forward, reverse: reverse };
}


// ── Topological Depth Computation ────────────────────────────────────────────

/**
 * Compute topological depth for each chit using BFS from root nodes.
 * Root nodes (no prerequisites in the visible set) get depth 0.
 * Each subsequent layer gets depth = max(predecessor depths) + 1.
 *
 * @param {Array} chits - Array of chit objects with .id and .prerequisites
 * @returns {Map<string, number>} - Map of chit ID to depth (0 = root)
 */
function _tlComputeDepths(chits) {
  var graph = _tlBuildGraph(chits);
  var forward = graph.forward;
  var reverse = graph.reverse;
  var depths = new Map();
  var idSet = new Set();

  for (var i = 0; i < chits.length; i++) {
    idSet.add(chits[i].id);
  }

  // Find root nodes (no incoming edges in the visible set)
  var queue = [];
  for (var i = 0; i < chits.length; i++) {
    var id = chits[i].id;
    var prereqs = reverse.get(id);
    if (!prereqs || prereqs.length === 0) {
      depths.set(id, 0);
      queue.push(id);
    }
  }

  // BFS: propagate depths forward
  var head = 0;
  while (head < queue.length) {
    var current = queue[head++];
    var currentDepth = depths.get(current);
    var dependents = forward.get(current) || [];

    for (var i = 0; i < dependents.length; i++) {
      var dep = dependents[i];
      var newDepth = currentDepth + 1;
      var existingDepth = depths.get(dep);

      if (existingDepth === undefined || newDepth > existingDepth) {
        depths.set(dep, newDepth);
        queue.push(dep);
      }
    }
  }

  // Any nodes not reached (isolated or in cycles) get depth 0
  for (var i = 0; i < chits.length; i++) {
    if (!depths.has(chits[i].id)) {
      depths.set(chits[i].id, 0);
    }
  }

  return depths;
}


// ── Cycle Detection ──────────────────────────────────────────────────────────

/**
 * Detect if adding an edge fromId → toId would create a cycle.
 * Uses BFS from toId through the forward adjacency list to see if fromId
 * is reachable (which would mean adding fromId→toId creates a cycle).
 *
 * Also returns true for self-loops (fromId === toId).
 *
 * @param {string} fromId - Proposed prerequisite (source of new edge)
 * @param {string} toId - Proposed dependent (target of new edge)
 * @param {Map<string, string[]>} adjList - Current forward adjacency list (prereq → dependents)
 * @returns {boolean} - true if adding the edge would create a cycle
 */
function _tlWouldCycle(fromId, toId, adjList) {
  // Self-loop is always a cycle
  if (fromId === toId) return true;

  // BFS from toId through forward edges — if we can reach fromId, adding
  // fromId→toId would create a cycle
  var visited = new Set();
  var queue = [toId];
  visited.add(toId);

  var head = 0;
  while (head < queue.length) {
    var current = queue[head++];
    var neighbors = adjList.get(current) || [];

    for (var i = 0; i < neighbors.length; i++) {
      var neighbor = neighbors[i];
      if (neighbor === fromId) return true;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}


// ── Critical Path Computation ────────────────────────────────────────────────

/**
 * Compute the critical path — the longest chain(s) from any root node
 * (no prerequisites) to any leaf node (no dependents).
 * If multiple paths tie for longest, all tied paths are included.
 *
 * @param {Array} chits - Array of chit objects with .id and .prerequisites
 * @returns {Set<string>} - Set of chit IDs on the critical path(s)
 */
function _tlCriticalPath(chits) {
  if (!chits || chits.length === 0) return new Set();

  var graph = _tlBuildGraph(chits);
  var forward = graph.forward;
  var reverse = graph.reverse;
  var idSet = new Set();

  for (var i = 0; i < chits.length; i++) {
    idSet.add(chits[i].id);
  }

  // If no edges exist, no critical path
  if (forward.size === 0) return new Set();

  // Compute longest distance from any root to each node using topological processing
  var dist = new Map();
  var predecessor = new Map();

  // Find roots (no incoming edges)
  var roots = [];
  for (var i = 0; i < chits.length; i++) {
    var id = chits[i].id;
    var prereqs = reverse.get(id);
    if (!prereqs || prereqs.length === 0) {
      roots.push(id);
      dist.set(id, 0);
      predecessor.set(id, []);
    }
  }

  // BFS-based longest path (process in topological order via Kahn's algorithm)
  var inDegree = new Map();
  for (var i = 0; i < chits.length; i++) {
    var id = chits[i].id;
    var prereqs = reverse.get(id);
    inDegree.set(id, prereqs ? prereqs.length : 0);
  }

  var queue = [];
  for (var i = 0; i < roots.length; i++) {
    queue.push(roots[i]);
  }

  var head = 0;
  while (head < queue.length) {
    var current = queue[head++];
    var currentDist = dist.get(current) || 0;
    var dependents = forward.get(current) || [];

    for (var i = 0; i < dependents.length; i++) {
      var dep = dependents[i];
      var newDist = currentDist + 1;
      var existingDist = dist.get(dep);

      if (existingDist === undefined || newDist > existingDist) {
        dist.set(dep, newDist);
        predecessor.set(dep, [current]);
      } else if (newDist === existingDist) {
        var preds = predecessor.get(dep) || [];
        preds.push(current);
        predecessor.set(dep, preds);
      }

      var deg = inDegree.get(dep) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) {
        queue.push(dep);
      }
    }
  }

  // Find the maximum distance
  var maxDist = 0;
  dist.forEach(function(d) {
    if (d > maxDist) maxDist = d;
  });

  if (maxDist === 0) return new Set();

  // Find all leaf nodes at maximum distance
  var endNodes = [];
  dist.forEach(function(d, id) {
    var outgoing = forward.get(id);
    if ((!outgoing || outgoing.length === 0) && d === maxDist) {
      endNodes.push(id);
    }
  });

  if (endNodes.length === 0) {
    dist.forEach(function(d, id) {
      if (d === maxDist) endNodes.push(id);
    });
  }

  // Trace back from end nodes through predecessors
  var criticalNodes = new Set();
  var traceQueue = [];
  for (var i = 0; i < endNodes.length; i++) {
    traceQueue.push(endNodes[i]);
    criticalNodes.add(endNodes[i]);
  }

  var traceHead = 0;
  while (traceHead < traceQueue.length) {
    var node = traceQueue[traceHead++];
    var preds = predecessor.get(node) || [];
    for (var i = 0; i < preds.length; i++) {
      var pred = preds[i];
      if (!criticalNodes.has(pred)) {
        criticalNodes.add(pred);
        traceQueue.push(pred);
      }
    }
  }

  return criticalNodes;
}


// ── Date-Based Layout ────────────────────────────────────────────────────────

/**
 * Compute node positions for date-based layout.
 * Dated chits are grouped by date into columns (one column per date).
 * Undated chits are placed below, split into "connected" (have edges to other
 * undated chits) and "unaffiliated" (no edges to other undated chits).
 * Connected undated chits are laid out by dependency depth in horizontal chains.
 * Unaffiliated undated chits fill a 2-row grid below the connected section.
 *
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - { canvasWidth, nodeWidth, nodeHeight }
 * @returns {Map<string, {x: number, y: number, lane: string}>} - Position map
 */
function _tlLayoutByDate(chits, opts) {
  var nodeWidth = 180;
  var nodeHeight = 52;
  var hGap = 60;
  var vGap = 10;
  var topPadding = 30;
  var leftPadding = 12;
  var colWidth = nodeWidth + hGap; // 240

  var positions = new Map();
  var graph = _tlBuildGraph(chits);

  // ── DATED SECTION ──────────────────────────────────────────────────────────
  // Only chits with due_datetime appear here, grouped by date, one column per date.

  var datedChits = [];
  var undatedChits = [];
  for (var i = 0; i < chits.length; i++) {
    if (_tlChitHasDate(chits[i])) datedChits.push(chits[i]);
    else undatedChits.push(chits[i]);
  }

  // Group dated chits by effective date
  var dateGroups = new Map();
  for (var i = 0; i < datedChits.length; i++) {
    var dateStr = _tlGetEffectiveDate(datedChits[i]);
    if (!dateGroups.has(dateStr)) dateGroups.set(dateStr, []);
    dateGroups.get(dateStr).push(datedChits[i]);
  }

  // Sort dates chronologically
  var sortedDates = Array.from(dateGroups.keys()).sort();

  // Build a lookup: dated chit ID → column index (for depth computation later)
  var datedColMap = new Map();

  for (var colIdx = 0; colIdx < sortedDates.length; colIdx++) {
    var date = sortedDates[colIdx];
    var chitsAtDate = dateGroups.get(date);
    var x = leftPadding + colIdx * colWidth;

    // Sort alphabetically within column
    chitsAtDate.sort(function(a, b) {
      var ta = (a.title || '').toLowerCase();
      var tb = (b.title || '').toLowerCase();
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    for (var j = 0; j < chitsAtDate.length; j++) {
      var y = topPadding + j * (nodeHeight + vGap);
      positions.set(chitsAtDate[j].id, { x: x, y: y, lane: 'dated' });
      datedColMap.set(chitsAtDate[j].id, colIdx);
    }
  }

  // ── UNDATED SECTION ────────────────────────────────────────────────────────

  // Build undated ID set
  var undatedIdSet = new Set();
  for (var i = 0; i < undatedChits.length; i++) {
    undatedIdSet.add(undatedChits[i].id);
  }

  // Classification: "connected" vs "unaffiliated"
  // Connected = has at least one edge to ANOTHER undated chit OR to a dated chit
  // Unaffiliated = no edges at all (truly isolated)
  var undatedConnected = [];
  var undatedUnaffiliated = [];
  for (var i = 0; i < undatedChits.length; i++) {
    var uid = undatedChits[i].id;
    var fwd = graph.forward.get(uid) || [];
    var rev = graph.reverse.get(uid) || [];
    var hasAnyEdge = fwd.length > 0 || rev.length > 0;
    if (hasAnyEdge) {
      undatedConnected.push(undatedChits[i]);
    } else {
      undatedUnaffiliated.push(undatedChits[i]);
    }
  }

  // ── Depth computation for connected chits ──────────────────────────────────
  var undatedDepths = new Map();

  if (undatedConnected.length > 0) {
    // Roots = connected chits with no UNDATED prereqs
    var roots = [];
    for (var i = 0; i < undatedConnected.length; i++) {
      var uid = undatedConnected[i].id;
      var rev = graph.reverse.get(uid) || [];
      var hasUndatedPrereq = false;
      for (var k = 0; k < rev.length; k++) {
        if (undatedIdSet.has(rev[k])) { hasUndatedPrereq = true; break; }
      }
      if (!hasUndatedPrereq) roots.push(undatedConnected[i]);
    }

    // Root starting depth: consider connections to dated chits
    for (var i = 0; i < roots.length; i++) {
      var uid = roots[i].id;
      var startDepth = 0;

      // Check if this root is a prereq OF a dated chit → depth = dated dependent's column - 1
      var fwdEdges = graph.forward.get(uid) || [];
      for (var f = 0; f < fwdEdges.length; f++) {
        if (datedColMap.has(fwdEdges[f])) {
          var depCol = datedColMap.get(fwdEdges[f]);
          var candidate = depCol - 1;
          if (candidate > startDepth) startDepth = candidate;
        }
      }

      // Check if this root depends ON a dated chit → depth = dated prereq's column + 1
      var revEdges = graph.reverse.get(uid) || [];
      for (var r = 0; r < revEdges.length; r++) {
        if (datedColMap.has(revEdges[r])) {
          var prereqCol = datedColMap.get(revEdges[r]);
          var candidate = prereqCol + 1;
          if (candidate > startDepth) startDepth = candidate;
        }
      }

      undatedDepths.set(uid, startDepth);
    }

    // BFS forward through undated edges to assign depths
    var bfsQueue = [];
    for (var i = 0; i < roots.length; i++) bfsQueue.push(roots[i].id);
    var bfsHead = 0;
    while (bfsHead < bfsQueue.length) {
      var cur = bfsQueue[bfsHead++];
      var curDepth = undatedDepths.get(cur);
      var deps = graph.forward.get(cur) || [];
      for (var d = 0; d < deps.length; d++) {
        if (!undatedIdSet.has(deps[d])) continue;
        var newDepth = curDepth + 1;
        var existing = undatedDepths.get(deps[d]);
        if (existing === undefined || newDepth > existing) {
          undatedDepths.set(deps[d], newDepth);
          bfsQueue.push(deps[d]);
        }
      }
    }

    // Unreached chits get depth 0
    for (var i = 0; i < undatedConnected.length; i++) {
      if (!undatedDepths.has(undatedConnected[i].id)) {
        undatedDepths.set(undatedConnected[i].id, 0);
      }
    }

    // Enforce left-to-right: if any undated chit has depth <= its undated prereq's depth, bump it
    var enforceChanged = true;
    var enforcePass = 0;
    while (enforceChanged && enforcePass < undatedConnected.length) {
      enforceChanged = false;
      enforcePass++;
      for (var i = 0; i < undatedConnected.length; i++) {
        var uid = undatedConnected[i].id;
        var myDepth = undatedDepths.get(uid) || 0;
        var rev = graph.reverse.get(uid) || [];
        for (var r = 0; r < rev.length; r++) {
          if (!undatedIdSet.has(rev[r])) continue;
          var prereqDepth = undatedDepths.get(rev[r]);
          if (prereqDepth !== undefined && myDepth <= prereqDepth) {
            undatedDepths.set(uid, prereqDepth + 1);
            enforceChanged = true;
          }
        }
      }
    }
  }

  // ── Connected components (BFS through ALL undated edges) ───────────────────
  var components = []; // Array of arrays of chit IDs
  var componentOf = new Map(); // chitId → component index
  var visitedComp = new Set();

  for (var i = 0; i < undatedConnected.length; i++) {
    var startId = undatedConnected[i].id;
    if (visitedComp.has(startId)) continue;

    var comp = [];
    var cQueue = [startId];
    visitedComp.add(startId);
    var cHead = 0;
    while (cHead < cQueue.length) {
      var cur = cQueue[cHead++];
      comp.push(cur);
      componentOf.set(cur, components.length);
      var edges = (graph.forward.get(cur) || []).concat(graph.reverse.get(cur) || []);
      for (var e = 0; e < edges.length; e++) {
        if (undatedIdSet.has(edges[e]) && !visitedComp.has(edges[e])) {
          visitedComp.add(edges[e]);
          cQueue.push(edges[e]);
        }
      }
    }
    components.push(comp);
  }

  // ── Row building within each component ─────────────────────────────────────
  // Build a chit lookup for undated connected
  var undatedChitMap = new Map();
  for (var i = 0; i < undatedConnected.length; i++) {
    undatedChitMap.set(undatedConnected[i].id, undatedConnected[i]);
  }

  var allRows = []; // Each entry: { row: [chit, ...], componentIdx: number }

  for (var ci = 0; ci < components.length; ci++) {
    var compIds = new Set(components[ci]);
    var compPlaced = new Set();

    // Find roots within this component (no undated prereqs within component)
    var compRoots = [];
    for (var j = 0; j < components[ci].length; j++) {
      var cid = components[ci][j];
      var rev = graph.reverse.get(cid) || [];
      var hasCompPrereq = false;
      for (var k = 0; k < rev.length; k++) {
        if (compIds.has(rev[k])) { hasCompPrereq = true; break; }
      }
      if (!hasCompPrereq) compRoots.push(cid);
    }

    // Sort roots by forward-edge count descending (most connections first)
    compRoots.sort(function(a, b) {
      var aFwd = (graph.forward.get(a) || []).filter(function(id) { return undatedIdSet.has(id); }).length;
      var bFwd = (graph.forward.get(b) || []).filter(function(id) { return undatedIdSet.has(id); }).length;
      return bFwd - aFwd;
    });

    // Trace chains: from each root, follow forward edges picking unplaced items
    for (var ri = 0; ri < compRoots.length; ri++) {
      var rootId = compRoots[ri];
      if (compPlaced.has(rootId)) continue;
      var chain = [undatedChitMap.get(rootId)];
      compPlaced.add(rootId);

      var current = rootId;
      while (true) {
        var fwd = graph.forward.get(current) || [];
        var nextId = null;
        for (var f = 0; f < fwd.length; f++) {
          if (compIds.has(fwd[f]) && !compPlaced.has(fwd[f])) {
            nextId = fwd[f];
            break;
          }
        }
        if (!nextId) break;
        chain.push(undatedChitMap.get(nextId));
        compPlaced.add(nextId);
        current = nextId;
      }
      allRows.push({ row: chain, componentIdx: ci });
    }

    // Remaining unplaced items in component = single-item rows
    for (var j = 0; j < components[ci].length; j++) {
      var cid = components[ci][j];
      if (!compPlaced.has(cid)) {
        allRows.push({ row: [undatedChitMap.get(cid)], componentIdx: ci });
        compPlaced.add(cid);
      }
    }
  }

  // ── Row sorting (determines vertical order) ────────────────────────────────
  // Priority 1: Rows where a member DIRECTLY connects to a dated chit (not through undated chain)
  // Priority 2: Keep clusters together (by component index)
  // Priority 3: Longer chains higher
  allRows.sort(function(a, b) {
    // Check for DIRECT dated connection (the chit itself has a dated prereq/dependent)
    var aDirectDated = a.row.some(function(c) {
      var fwd = graph.forward.get(c.id) || [];
      var rev = graph.reverse.get(c.id) || [];
      for (var k = 0; k < fwd.length; k++) {
        if (!undatedIdSet.has(fwd[k]) && positions.has(fwd[k])) return true;
      }
      for (var k = 0; k < rev.length; k++) {
        if (!undatedIdSet.has(rev[k]) && positions.has(rev[k])) return true;
      }
      return false;
    });
    var bDirectDated = b.row.some(function(c) {
      var fwd = graph.forward.get(c.id) || [];
      var rev = graph.reverse.get(c.id) || [];
      for (var k = 0; k < fwd.length; k++) {
        if (!undatedIdSet.has(fwd[k]) && positions.has(fwd[k])) return true;
      }
      for (var k = 0; k < rev.length; k++) {
        if (!undatedIdSet.has(rev[k]) && positions.has(rev[k])) return true;
      }
      return false;
    });
    if (aDirectDated && !bDirectDated) return -1;
    if (!aDirectDated && bDirectDated) return 1;
    // Then by component index (keeps clusters together)
    if (a.componentIdx !== b.componentIdx) return a.componentIdx - b.componentIdx;
    // Then by chain length descending
    return b.row.length - a.row.length;
  });

  // ── Row placement ──────────────────────────────────────────────────────────
  // Merge all direct-dated single-item rows onto row 0 (they share the first row)
  var directDatedRow = [];
  var otherRows = [];
  for (var ri = 0; ri < allRows.length; ri++) {
    var row = allRows[ri].row;
    // A row is "direct dated" if it's a single item with a direct dated connection
    // and no undated prereqs (it's a leaf hanging off the dated section)
    if (row.length === 1) {
      var c = row[0];
      var fwd = graph.forward.get(c.id) || [];
      var rev = graph.reverse.get(c.id) || [];
      var hasDatedEdge = false;
      for (var k = 0; k < fwd.length; k++) {
        if (!undatedIdSet.has(fwd[k]) && positions.has(fwd[k])) { hasDatedEdge = true; break; }
      }
      if (!hasDatedEdge) {
        for (var k = 0; k < rev.length; k++) {
          if (!undatedIdSet.has(rev[k]) && positions.has(rev[k])) { hasDatedEdge = true; break; }
        }
      }
      // Also check: no undated dependents (it's truly just hanging off dated)
      var hasUndatedDep = fwd.some(function(id) { return undatedIdSet.has(id); });
      var hasUndatedPrereq = rev.some(function(id) { return undatedIdSet.has(id); });
      if (hasDatedEdge && !hasUndatedDep && !hasUndatedPrereq) {
        directDatedRow.push(c);
        continue;
      }
    }
    otherRows.push(allRows[ri]);
  }

  var currentRow = 0;

  // Place direct-dated items: pack onto as few rows as possible.
  // Items only need a new row if their X (depth) collides with another on the same row.
  if (directDatedRow.length > 0) {
    // Sort by depth so we can pack efficiently
    directDatedRow.sort(function(a, b) {
      return (undatedDepths.get(a.id) || 0) - (undatedDepths.get(b.id) || 0);
    });

    // Greedy row packing: for each item, find the first row where its X isn't taken
    var ddRows = [[]]; // array of arrays, each sub-array = items on that row
    var ddRowDepths = [new Set()]; // track which depths are used per row

    for (var mi = 0; mi < directDatedRow.length; mi++) {
      var depth = undatedDepths.get(directDatedRow[mi].id) || 0;
      var placed = false;
      for (var r = 0; r < ddRows.length; r++) {
        if (!ddRowDepths[r].has(depth)) {
          ddRows[r].push(directDatedRow[mi]);
          ddRowDepths[r].add(depth);
          placed = true;
          break;
        }
      }
      if (!placed) {
        ddRows.push([directDatedRow[mi]]);
        ddRowDepths.push(new Set([depth]));
      }
    }

    // Place each packed row
    for (var r = 0; r < ddRows.length; r++) {
      var y = topPadding + currentRow * (nodeHeight + vGap);
      for (var mi = 0; mi < ddRows[r].length; mi++) {
        var depth = undatedDepths.get(ddRows[r][mi].id) || 0;
        var x = leftPadding + depth * colWidth;
        positions.set(ddRows[r][mi].id, { x: x, y: y, lane: 'undated' });
      }
      currentRow++;
    }
  }

  // Place remaining rows
  for (var ri = 0; ri < otherRows.length; ri++) {
    var row = otherRows[ri].row;
    var y = topPadding + currentRow * (nodeHeight + vGap);
    for (var mi = 0; mi < row.length; mi++) {
      var depth = undatedDepths.get(row[mi].id) || 0;
      var x = leftPadding + depth * colWidth;
      positions.set(row[mi].id, { x: x, y: y, lane: 'undated' });
    }
    currentRow++;
  }

  // ── Unaffiliated placement ─────────────────────────────────────────────────
  // Sort alphabetically, place BELOW connected section with 1 extra row gap.
  // 2-row grid, fill left-to-right then next row.
  undatedUnaffiliated.sort(function(a, b) {
    var ta = (a.title || '').toLowerCase();
    var tb = (b.title || '').toLowerCase();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  if (undatedUnaffiliated.length > 0) {
    // Gap of 1 extra row below connected section
    var unaffiliatedStartRow = currentRow + 1;
    var ucCols = Math.ceil(undatedUnaffiliated.length / 2);

    for (var i = 0; i < undatedUnaffiliated.length; i++) {
      var col = i % ucCols;
      var rowOffset = Math.floor(i / ucCols);
      var x = leftPadding + col * colWidth;
      var y = topPadding + (unaffiliatedStartRow + rowOffset) * (nodeHeight + vGap);
      positions.set(undatedUnaffiliated[i].id, { x: x, y: y, lane: 'undated' });
    }
  }

  return positions;
}


// ── Dependency-Based Layout ──────────────────────────────────────────────────

/**
 * Compute node positions for dependency-depth layout (flowchart style).
 * Left-to-right: Column 1 = no prerequisites, Column 2 = depends on col 1, etc.
 * Within each column, nodes are ordered to minimize line crossing
 * (connected nodes are vertically close to each other).
 *
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - { canvasWidth, nodeWidth, nodeHeight, depthSpacing }
 * @returns {Map<string, {x: number, y: number, lane: string}>} - Position map
 */
function _tlLayoutByDependency(chits, opts) {
  var nodeWidth = opts.nodeWidth || 180;
  var nodeHeight = opts.nodeHeight || 60;
  var hGap = 60;
  var vGap = 14;
  var padding = 16;

  var positions = new Map();
  var depths = _tlComputeDepths(chits);
  var graph = _tlBuildGraph(chits);

  // Group chits by depth (column)
  var depthGroups = new Map();
  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];
    var depth = depths.get(chit.id) || 0;
    if (!depthGroups.has(depth)) depthGroups.set(depth, []);
    depthGroups.get(depth).push(chit);
  }

  var sortedDepths = Array.from(depthGroups.keys()).sort(function(a, b) { return a - b; });
  var colWidth = nodeWidth + hGap;

  for (var di = 0; di < sortedDepths.length; di++) {
    var depth = sortedDepths[di];
    var chitsAtDepth = depthGroups.get(depth);
    var x = padding + depth * colWidth;

    if (di === 0) {
      // First column: connected nodes first (those that have dependents), then unconnected
      chitsAtDepth.sort(function(a, b) {
        var aHasDeps = (graph.forward.has(a.id) && graph.forward.get(a.id).length > 0) ? 0 : 1;
        var bHasDeps = (graph.forward.has(b.id) && graph.forward.get(b.id).length > 0) ? 0 : 1;
        if (aHasDeps !== bHasDeps) return aHasDeps - bHasDeps;
        var ta = (a.title || '').toLowerCase();
        var tb = (b.title || '').toLowerCase();
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });

      for (var j = 0; j < chitsAtDepth.length; j++) {
        var y = padding + j * (nodeHeight + vGap);
        positions.set(chitsAtDepth[j].id, { x: x, y: y, lane: 'dated' });
      }
    } else {
      // Subsequent columns: target Y = average Y of predecessors
      var desired = [];
      for (var j = 0; j < chitsAtDepth.length; j++) {
        var targetY = _tlAvgPredecessorY(chitsAtDepth[j].id, graph, positions, nodeHeight);
        desired.push({ chit: chitsAtDepth[j], targetY: targetY });
      }

      desired.sort(function(a, b) { return a.targetY - b.targetY; });

      var lastBottom = -Infinity;
      for (var j = 0; j < desired.length; j++) {
        var y = desired[j].targetY - nodeHeight / 2;
        if (y < lastBottom + vGap) {
          y = lastBottom + vGap;
        }
        positions.set(desired[j].chit.id, { x: x, y: y, lane: 'dated' });
        lastBottom = y + nodeHeight;
      }
    }
  }

  return positions;
}

/**
 * Compute the average Y center of a node's predecessors (for ordering).
 * If no predecessors have positions yet, returns a large number (goes to bottom).
 */
function _tlAvgPredecessorY(chitId, graph, positions, nodeHeight) {
  var preds = graph.reverse.get(chitId) || [];
  if (preds.length === 0) return 0;
  var sum = 0;
  var count = 0;
  for (var i = 0; i < preds.length; i++) {
    var pos = positions.get(preds[i]);
    if (pos) {
      sum += pos.y + nodeHeight / 2;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}


// ── Chain Ordering ───────────────────────────────────────────────────────────

/**
 * Sort selected nodes by ascending x position, using ascending y as tiebreaker.
 * Used for "Link as chain" bulk linking.
 *
 * @param {Array} nodes - Array of objects with at least { id, x, y }
 * @returns {Array} - Sorted array (new array, does not mutate input)
 */
function _tlChainOrder(nodes) {
  return nodes.slice().sort(function(a, b) {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
}


// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if a chit has a due date set.
 * @param {object} chit
 * @returns {boolean}
 */
function _tlChitHasDate(chit) {
  return !!chit.due_datetime;
}

/**
 * Get the due date string for a chit (for positioning on the timeline).
 * Returns the date portion only (YYYY-MM-DD).
 * @param {object} chit
 * @returns {string}
 */
function _tlGetEffectiveDate(chit) {
  var dt = chit.due_datetime || '';
  if (dt.length >= 10) return dt.substring(0, 10);
  return dt;
}
