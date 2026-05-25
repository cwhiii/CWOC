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
  // dist[node] = longest path length (in edges) from any root to this node
  var dist = new Map();
  var predecessor = new Map(); // node → [predecessor nodes on longest path]

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
  // Compute in-degrees
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
        // Tied path — add this predecessor too
        var preds = predecessor.get(dep) || [];
        preds.push(current);
        predecessor.set(dep, preds);
      }

      // Decrement in-degree and enqueue when all predecessors processed
      var deg = inDegree.get(dep) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) {
        queue.push(dep);
      }
    }
  }

  // Find the maximum distance (longest path length)
  var maxDist = 0;
  dist.forEach(function(d) {
    if (d > maxDist) maxDist = d;
  });

  // If max distance is 0, no meaningful path exists
  if (maxDist === 0) return new Set();

  // Find all leaf nodes (no outgoing edges) that have the maximum distance
  var endNodes = [];
  dist.forEach(function(d, id) {
    var outgoing = forward.get(id);
    if ((!outgoing || outgoing.length === 0) && d === maxDist) {
      endNodes.push(id);
    }
  });

  // If no end nodes at max distance, find any nodes at max distance
  if (endNodes.length === 0) {
    dist.forEach(function(d, id) {
      if (d === maxDist) endNodes.push(id);
    });
  }

  // Trace back from end nodes through predecessors to collect all critical path nodes
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
 * Chits are positioned horizontally under their date column marker.
 * Within each date column, chits stack vertically.
 * Undated chits go at the end (rightmost column).
 * Dependency lines route through the gaps between date columns.
 *
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - { canvasWidth, nodeWidth, nodeHeight }
 * @returns {Map<string, {x: number, y: number, lane: string}>} - Position map
 */
function _tlLayoutByDate(chits, opts) {
  var nodeWidth = opts.nodeWidth || 180;
  var nodeHeight = opts.nodeHeight || 52;
  var hGap = 60; // Horizontal gap between date columns (lines route here)
  var vGap = 10; // Vertical gap between nodes in same column
  var topPadding = 30; // Clear date labels
  var leftPadding = 12;

  var positions = new Map();
  var graph = _tlBuildGraph(chits);

  // Separate dated and undated chits
  var datedChits = [];
  var undatedChits = [];
  for (var i = 0; i < chits.length; i++) {
    if (_tlChitHasDate(chits[i])) datedChits.push(chits[i]);
    else undatedChits.push(chits[i]);
  }

  // Group dated chits by their effective date
  var dateGroups = new Map(); // dateString → [chit, ...]
  for (var i = 0; i < datedChits.length; i++) {
    var dateStr = _tlGetEffectiveDate(datedChits[i]);
    if (!dateGroups.has(dateStr)) dateGroups.set(dateStr, []);
    dateGroups.get(dateStr).push(datedChits[i]);
  }

  // Sort dates chronologically
  var sortedDates = Array.from(dateGroups.keys()).sort();

  // Position dated chits under their date column
  var colWidth = nodeWidth + hGap;
  for (var colIdx = 0; colIdx < sortedDates.length; colIdx++) {
    var date = sortedDates[colIdx];
    var chitsAtDate = dateGroups.get(date);
    var x = leftPadding + colIdx * colWidth;

    // Sort within column: connected first, incomplete before complete, then alphabetical
    chitsAtDate.sort(function(a, b) {
      var aConn = (graph.forward.has(a.id) || graph.reverse.has(a.id)) ? 0 : 1;
      var bConn = (graph.forward.has(b.id) || graph.reverse.has(b.id)) ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      var aC = ((a.status || '').toLowerCase().replace(/\s+/g, '') === 'complete') ? 1 : 0;
      var bC = ((b.status || '').toLowerCase().replace(/\s+/g, '') === 'complete') ? 1 : 0;
      if (aC !== bC) return aC - bC;
      return (a.title || '').toLowerCase() < (b.title || '').toLowerCase() ? -1 : 1;
    });

    for (var j = 0; j < chitsAtDate.length; j++) {
      var y = topPadding + j * (nodeHeight + vGap);
      positions.set(chitsAtDate[j].id, { x: x, y: y, lane: 'dated' });
    }
  }

  // Position undated chits in their own lane using dependency-aware layout.
  // Connected chits are laid out left-to-right by dependency depth (prereqs left,
  // dependents right). Unconnected chits fill remaining grid positions after.
  var undatedConnected = [];
  var undatedUnconnected = [];
  var undatedIdSet = new Set();
  for (var i = 0; i < undatedChits.length; i++) {
    undatedIdSet.add(undatedChits[i].id);
    if (graph.forward.has(undatedChits[i].id) || graph.reverse.has(undatedChits[i].id)) {
      undatedConnected.push(undatedChits[i]);
    } else {
      undatedUnconnected.push(undatedChits[i]);
    }
  }

  // Compute dependency depths for undated connected chits only
  // (depth 0 = no prereqs among undated set, depth 1 = depends on depth 0, etc.)
  var undatedDepths = new Map();
  if (undatedConnected.length > 0) {
    // Find roots among undated (no prereqs that are also undated)
    var udQueue = [];
    for (var i = 0; i < undatedConnected.length; i++) {
      var uid = undatedConnected[i].id;
      var prereqs = graph.reverse.get(uid) || [];
      var hasUndatedPrereq = false;
      var maxDatedPrereqCol = -1;
      for (var p = 0; p < prereqs.length; p++) {
        if (undatedIdSet.has(prereqs[p])) { hasUndatedPrereq = true; }
        else {
          // Dated prereq — find its column index
          var datedPos = positions.get(prereqs[p]);
          if (datedPos) {
            var col = Math.round((datedPos.x - leftPadding) / colWidth);
            if (col > maxDatedPrereqCol) maxDatedPrereqCol = col;
          }
        }
      }
      if (!hasUndatedPrereq) {
        // No undated prereqs — this is a root in the undated graph.
        // If it has a dated prereq, start at the column after that prereq.
        var startDepth = maxDatedPrereqCol >= 0 ? (maxDatedPrereqCol + 1) : 0;
        undatedDepths.set(uid, startDepth);
        udQueue.push(uid);
      }
    }
    // BFS to assign depths
    var udHead = 0;
    while (udHead < udQueue.length) {
      var cur = udQueue[udHead++];
      var curDepth = undatedDepths.get(cur);
      var deps = graph.forward.get(cur) || [];
      for (var d = 0; d < deps.length; d++) {
        if (!undatedIdSet.has(deps[d])) continue;
        var newDepth = curDepth + 1;
        var existing = undatedDepths.get(deps[d]);
        if (existing === undefined || newDepth > existing) {
          undatedDepths.set(deps[d], newDepth);
          udQueue.push(deps[d]);
        }
      }
    }
    // Any not reached get depth 0
    for (var i = 0; i < undatedConnected.length; i++) {
      if (!undatedDepths.has(undatedConnected[i].id)) {
        undatedDepths.set(undatedConnected[i].id, 0);
      }
    }
  }

  // Group connected undated by depth (column)
  var depthGroups = new Map();
  for (var i = 0; i < undatedConnected.length; i++) {
    var depth = undatedDepths.get(undatedConnected[i].id) || 0;
    if (!depthGroups.has(depth)) depthGroups.set(depth, []);
    depthGroups.get(depth).push(undatedConnected[i]);
  }

  // Position connected undated: use depth value directly as column index
  // (depth already accounts for dated prereq positions)
  var sortedUdDepths = Array.from(depthGroups.keys()).sort(function(a, b) { return a - b; });
  var nextUndatedCol = 0;
  for (var di = 0; di < sortedUdDepths.length; di++) {
    var depth = sortedUdDepths[di];
    var depthChits = depthGroups.get(depth);
    var x = leftPadding + depth * colWidth;
    for (var j = 0; j < depthChits.length; j++) {
      var y = topPadding + j * (nodeHeight + vGap);
      positions.set(depthChits[j].id, { x: x, y: y, lane: 'undated' });
    }
    if (depth >= nextUndatedCol) nextUndatedCol = depth + 1;
  }

  // Position unconnected undated: fill from bottom-left, going right then up.
  // Calculate how many columns fit in the viewport, then pack them tightly.
  undatedUnconnected.sort(function(a, b) {
    return (a.title || '').toLowerCase() < (b.title || '').toLowerCase() ? -1 : 1;
  });

  if (undatedUnconnected.length > 0) {
    // Determine available columns based on connected section width
    var connectedMaxX = 0;
    for (var i = 0; i < undatedConnected.length; i++) {
      var p = positions.get(undatedConnected[i].id);
      if (p && p.x > connectedMaxX) connectedMaxX = p.x;
    }
    // How many rows the connected section uses (to place unconnected below)
    var connectedMaxRow = 0;
    depthGroups.forEach(function(chitsAtDepth) {
      if (chitsAtDepth.length > connectedMaxRow) connectedMaxRow = chitsAtDepth.length;
    });

    // Start unconnected below the connected section with a gap
    var unconnectedTopY = topPadding + (connectedMaxRow + 1) * (nodeHeight + vGap);

    // Use 2 rows max for unconnected items — wide layout to fit on screen
    var ucRows = 2;
    var ucGridCols = Math.ceil(undatedUnconnected.length / ucRows);

    // Fill bottom-left to right, then up: row 0 = bottom, row N = top
    for (var i = 0; i < undatedUnconnected.length; i++) {
      var col = i % ucGridCols;
      var rowFromBottom = Math.floor(i / ucGridCols);
      var row = (ucRows - 1) - rowFromBottom; // flip so first items are at bottom
      var x = leftPadding + col * colWidth;
      var y = unconnectedTopY + row * (nodeHeight + vGap);
      positions.set(undatedUnconnected[i].id, { x: x, y: y, lane: 'undated' });
    }
  }

  return positions;
}

/**
 * Sort chits so that connected ones (sharing dependency edges) are adjacent.
 * Groups chits by connected component, then orders components by earliest date.
 * Within each component, orders by dependency chain (prereqs first).
 *
 * @param {Array} chits - Array of chit objects
 * @param {{forward: Map, reverse: Map}} graph - Dependency graph
 * @returns {Array} Sorted chit array
 */
function _tlSortByConnectedness(chits, graph) {
  if (chits.length <= 1) return chits;

  var idSet = new Set();
  for (var i = 0; i < chits.length; i++) idSet.add(chits[i].id);

  // Find connected components using BFS
  var visited = new Set();
  var components = []; // Array of arrays of chit IDs

  for (var i = 0; i < chits.length; i++) {
    var startId = chits[i].id;
    if (visited.has(startId)) continue;

    // BFS to find all nodes in this component
    var component = [];
    var queue = [startId];
    visited.add(startId);

    var head = 0;
    while (head < queue.length) {
      var current = queue[head++];
      component.push(current);

      // Follow forward edges
      var fwd = graph.forward.get(current) || [];
      for (var j = 0; j < fwd.length; j++) {
        if (idSet.has(fwd[j]) && !visited.has(fwd[j])) {
          visited.add(fwd[j]);
          queue.push(fwd[j]);
        }
      }
      // Follow reverse edges
      var rev = graph.reverse.get(current) || [];
      for (var j = 0; j < rev.length; j++) {
        if (idSet.has(rev[j]) && !visited.has(rev[j])) {
          visited.add(rev[j]);
          queue.push(rev[j]);
        }
      }
    }

    components.push(component);
  }

  // Build a lookup map: id → chit
  var chitMap = new Map();
  for (var i = 0; i < chits.length; i++) chitMap.set(chits[i].id, chits[i]);

  // Sort components: larger components first (connected items are more important),
  // then by earliest date within the component
  components.sort(function(a, b) {
    if (a.length !== b.length) return b.length - a.length; // Larger first
    var dateA = _tlGetEarliestDate(a, chitMap);
    var dateB = _tlGetEarliestDate(b, chitMap);
    return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  });

  // Within each component, sort by dependency order (prereqs before dependents)
  var result = [];
  for (var c = 0; c < components.length; c++) {
    var comp = components[c];
    // Simple topological sort within the component
    var sorted = _tlTopoSortComponent(comp, graph);
    for (var i = 0; i < sorted.length; i++) {
      var chit = chitMap.get(sorted[i]);
      if (chit) result.push(chit);
    }
  }

  return result;
}

/**
 * Get the earliest date string from a set of chit IDs.
 */
function _tlGetEarliestDate(ids, chitMap) {
  var earliest = 'zzzz';
  for (var i = 0; i < ids.length; i++) {
    var chit = chitMap.get(ids[i]);
    if (chit) {
      var d = _tlGetEffectiveDate(chit) || chit.created_datetime || '';
      if (d && d < earliest) earliest = d;
    }
  }
  return earliest;
}

/**
 * Topological sort within a connected component.
 * Prereqs come before their dependents.
 */
function _tlTopoSortComponent(ids, graph) {
  var idSet = new Set(ids);
  var inDegree = new Map();
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var rev = graph.reverse.get(id) || [];
    var count = 0;
    for (var j = 0; j < rev.length; j++) {
      if (idSet.has(rev[j])) count++;
    }
    inDegree.set(id, count);
  }

  var queue = [];
  for (var i = 0; i < ids.length; i++) {
    if (inDegree.get(ids[i]) === 0) queue.push(ids[i]);
  }

  var result = [];
  var head = 0;
  while (head < queue.length) {
    var current = queue[head++];
    result.push(current);
    var fwd = graph.forward.get(current) || [];
    for (var j = 0; j < fwd.length; j++) {
      if (!idSet.has(fwd[j])) continue;
      var deg = inDegree.get(fwd[j]) - 1;
      inDegree.set(fwd[j], deg);
      if (deg === 0) queue.push(fwd[j]);
    }
  }

  // Add any remaining (cycles) at the end
  for (var i = 0; i < ids.length; i++) {
    if (result.indexOf(ids[i]) === -1) result.push(ids[i]);
  }

  return result;
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
  var hGap = 60; // Horizontal gap between columns (room for connecting lines)
  var vGap = 14; // Vertical gap between nodes in same column
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
      // Subsequent columns: place each node directly to the right of its prerequisite.
      // Target Y = average Y of predecessors (so it lines up horizontally).
      // If multiple nodes target the same Y, fan them out vertically.
      
      // First, compute desired Y for each node (avg of predecessors)
      var desired = [];
      for (var j = 0; j < chitsAtDepth.length; j++) {
        var targetY = _tlAvgPredecessorY(chitsAtDepth[j].id, graph, positions, nodeHeight);
        desired.push({ chit: chitsAtDepth[j], targetY: targetY });
      }
      
      // Sort by desired Y
      desired.sort(function(a, b) { return a.targetY - b.targetY; });
      
      // Place nodes, ensuring no overlap (push down if needed)
      var lastBottom = -Infinity;
      for (var j = 0; j < desired.length; j++) {
        var y = desired[j].targetY - nodeHeight / 2; // Center on target Y
        // Ensure no overlap with previous node in this column
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
