/**
 * main-timeline.js — Timeline View rendering and state management.
 *
 * Main entry point: displayTimelineView(chits)
 * Called by displayTasksView() when _tasksViewMode === 'timeline'.
 *
 * Contains:
 *   - Module globals (state)
 *   - displayTimelineView(chits) — main entry point
 *   - _tlRender(chits) — full re-render orchestrator
 *   - _tlRenderNodes(chits, positions) — DOM node creation/update
 *   - _tlRenderLines(graph, positions) — SVG path rendering
 *   - _tlRenderDateMarkers(chits, opts) — vertical date lines
 *   - _tlApplyZoomClass() — zoom level CSS class management
 *   - _tlBuildNodeHTML(chit, zoomLevel) — node DOM element builder
 *   - _tlComputePathD(fromPos, toPos) — SVG path d-attribute computation
 *   - Empty state rendering
 *   - Resize handler (debounced 200ms)
 *
 * Depends on (loaded before this file):
 *   - main-timeline-algo.js (_tlBuildGraph, _tlComputeDepths, _tlLayoutByDate,
 *     _tlLayoutByDependency, _tlCriticalPath, _tlChitHasDate, _tlGetEffectiveDate)
 *   - shared-utils.js (cwocToast, formatDate)
 *
 * Subsequent tasks will add interaction handlers on top of this foundation:
 *   - 2.2: zoom/pan interactions
 *   - 2.3: hover/focus highlighting
 *   - 3.x: dependency management (drag-to-link, context menu, Link Mode, etc.)
 *   - 4.x: toolbar controls (order toggle, critical path)
 */

// ══════════════════════════════════════════════════════════════════════════════
// ── Module Globals (State) ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/** @type {HTMLElement|null} Timeline container element */
var _tlContainer = null;

/** @type {number} Current zoom level (0.25 to 3.0, default 1.0) */
var _tlZoom = 1.0;

/** @type {string} Current order mode: 'date' or 'dependency' */
var _tlOrderMode = 'date';

/** @type {boolean} Whether Link Mode is active */
var _tlLinkMode = false;

/** @type {string|null} Chit ID of first-clicked node in Link Mode */
var _tlLinkSource = null;

/** @type {boolean} Whether critical path highlighting is active */
var _tlCriticalPathActive = false;

/** @type {Set<string>} Set of chit IDs on the critical path */
var _tlCriticalPathNodes = new Set();

/** @type {{forward: Map, reverse: Map}} Current dependency graph */
var _tlGraph = { forward: new Map(), reverse: new Map() };

/** @type {Map<string, {x: number, y: number, lane: string}>} Current node positions */
var _tlPositions = new Map();

/** @type {number|null} Resize debounce timer ID */
var _tlResizeTimer = null;

/** @type {Array} Cached chits array for re-render on resize */
var _tlCurrentChits = [];

/** @type {Array} Undo stack — stores {action, chitId, oldPrereqs, newPrereqs} */
var _tlUndoStack = [];

/** @type {Array} Redo stack */
var _tlRedoStack = [];


// ══════════════════════════════════════════════════════════════════════════════
// ── Main Entry Point ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Main entry point for the Timeline View.
 * Called by displayTasksView() when _tasksViewMode === 'timeline'.
 *
 * @param {Array} chitsToDisplay - Filtered array of chit objects
 */
function displayTimelineView(chitsToDisplay) {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;

  // Clear existing content
  chitList.innerHTML = '';

  console.log('[Timeline] Input chits:', chitsToDisplay.length);

  // Filter to task-relevant chits — only show chits with a status (actual tasks)
  var allTaskChits = chitsToDisplay.filter(function(chit) {
    return !!chit.status;
  });

  console.log('[Timeline] After status filter:', allTaskChits.length, '(removed', chitsToDisplay.length - allTaskChits.length, 'without status)');

  // Hide completed chits UNLESS they are part of a dependency tree
  // (have prerequisites or are a prerequisite of something else)
  var graph = _tlBuildGraph(allTaskChits);
  var taskChits = allTaskChits.filter(function(chit) {
    var status = (chit.status || '').toLowerCase().replace(/\s+/g, '');
    if (status !== 'complete' && status !== 'rejected') return true;
    // Keep completed chits that have dependencies
    if (graph.forward.has(chit.id) && graph.forward.get(chit.id).length > 0) return true;
    if (graph.reverse.has(chit.id) && graph.reverse.get(chit.id).length > 0) return true;
    return false;
  });

  console.log('[Timeline] After complete filter:', taskChits.length, '(removed', allTaskChits.length - taskChits.length, 'completed without deps)');

  // Log date grouping
  var _datedCount = 0, _undatedCount = 0;
  var _dateGroups = {};
  taskChits.forEach(function(c) {
    if (c.start_datetime || c.due_datetime || c.point_in_time) {
      _datedCount++;
      var d = (c.point_in_time || c.start_datetime || c.due_datetime || '').substring(0, 10);
      if (!_dateGroups[d]) _dateGroups[d] = [];
      _dateGroups[d].push(c.title);
    } else {
      _undatedCount++;
    }
  });
  console.log('[Timeline] Dated:', _datedCount, 'Undated:', _undatedCount);
  console.log('[Timeline] Date groups:', JSON.stringify(_dateGroups));

  // Cache for resize re-render
  _tlCurrentChits = taskChits;

  // Build container structure
  _tlContainer = _tlBuildContainer();
  chitList.appendChild(_tlContainer);

  // Render content
  _tlRender(taskChits);

  // Attach resize listener
  _tlAttachResizeListener();

  // Attach zoom and pan listeners (Task 2.2)
  _tlAttachZoomPanListeners();

  // Attach lane divider drag-to-resize
  _tlAttachDividerDrag();

  // Attach canvas-level touch listener for clearing highlights (Req 12.3 touch)
  _tlAttachCanvasTouchClearListener();

  // Wire Link Mode button and ESC key listener (Task 3.3)
  _tlAttachLinkModeListeners();

  // Wire order toggle (By Date / By Dependency) — Task 4.1
  _tlInitOrderToggle();

  // Wire critical path toggle button (Req 13.1–13.6) — Task 4.2
  _tlInitCriticalPathToggle();
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Container Builder ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build the timeline container DOM structure.
 * @returns {HTMLElement} The timeline container element
 */
function _tlBuildContainer() {
  var container = document.createElement('div');
  container.className = 'timeline-container';

  // Viewport (scrollable) — toolbar controls are now in the sidebar
  var viewport = document.createElement('div');
  viewport.className = 'timeline-viewport';
  viewport.id = 'tl-viewport';

  // Canvas (transform target for zoom)
  var canvas = document.createElement('div');
  canvas.className = 'timeline-canvas';
  canvas.id = 'tl-canvas';

  // Dated lane
  var datedLabel = document.createElement('div');
  datedLabel.className = 'tl-lane-label';
  datedLabel.textContent = '📅 Dated Tasks';
  canvas.appendChild(datedLabel);

  var datedLane = document.createElement('div');
  datedLane.className = 'timeline-lane timeline-dated-lane';
  datedLane.id = 'tl-dated-lane';
  canvas.appendChild(datedLane);

  // Lane divider (full-width, bold)
  var divider = document.createElement('div');
  divider.className = 'timeline-lane-divider';
  divider.id = 'tl-lane-divider';
  canvas.appendChild(divider);

  // Undated lane
  var undatedLabel = document.createElement('div');
  undatedLabel.className = 'tl-lane-label';
  undatedLabel.textContent = '📋 Undated Tasks';
  canvas.appendChild(undatedLabel);

  var undatedLane = document.createElement('div');
  undatedLane.className = 'timeline-lane timeline-undated-lane';
  undatedLane.id = 'tl-undated-lane';
  canvas.appendChild(undatedLane);

  // SVG overlay for dependency lines
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'timeline-svg-overlay');
  svg.id = 'tl-svg';
  canvas.appendChild(svg);

  viewport.appendChild(canvas);
  container.appendChild(viewport);

  // Zoom controls (bottom-right corner)
  var zoomControls = document.createElement('div');
  zoomControls.className = 'tl-zoom-controls';
  zoomControls.innerHTML = '<button class="tl-zoom-btn" id="tl-zoom-in-btn" title="Zoom In">+</button>' +
    '<button class="tl-zoom-btn" id="tl-zoom-out-btn" title="Zoom Out">−</button>' +
    '<button class="tl-zoom-btn" id="tl-recenter-btn" title="Recenter">⊙</button>';
  container.appendChild(zoomControls);

  return container;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Full Re-Render ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Full re-render: build graph, compute layout, render nodes, render lines.
 * @param {Array} chits - Filtered chit array
 */
function _tlRender(chits) {
  if (!_tlContainer) return;

  // Empty state
  if (!chits || chits.length === 0) {
    _tlRenderEmptyState();
    return;
  }

  // Remove empty state if present
  var emptyEl = _tlContainer.querySelector('.cwoc-empty');
  if (emptyEl) emptyEl.remove();

  // Build dependency graph
  _tlGraph = _tlBuildGraph(chits);

  // Compute layout positions based on current order mode
  var viewport = document.getElementById('tl-viewport');
  var chitList = document.getElementById('chit-list');
  var canvasWidth = (viewport && viewport.clientWidth > 100) ? viewport.clientWidth :
                    (chitList && chitList.clientWidth > 100) ? chitList.clientWidth : 1200;
  var opts = {
    canvasWidth: canvasWidth,
    nodeWidth: 180,
    nodeHeight: 52,
    markerSpacing: 200,
    depthSpacing: 220
  };

  if (_tlOrderMode === 'dependency') {
    _tlPositions = _tlLayoutByDependency(chits, opts);
  } else {
    _tlPositions = _tlLayoutByDate(chits, opts);
  }

  // Apply zoom class
  _tlApplyZoomClass();

  // Render date markers (only in date mode)
  if (_tlOrderMode === 'date') {
    _tlRenderDateMarkers(chits, opts);
  } else {
    // Clear date markers in dependency mode
    var datedLane = document.getElementById('tl-dated-lane');
    if (datedLane) {
      var markers = datedLane.querySelectorAll('.tl-date-marker');
      for (var i = 0; i < markers.length; i++) markers[i].remove();
    }
  }

  // Render nodes
  _tlRenderNodes(chits, _tlPositions);

  // Size the canvas to fit all content (must happen before lines so layout is final)
  _tlSizeCanvas();

  // Render dependency lines (uses getBoundingClientRect, needs final layout)
  requestAnimationFrame(function() {
    _tlRenderLines(_tlGraph, _tlPositions);
    _tlAttachLineClickListener();
    _tlUpdateDividerGaps();
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Node Rendering ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create/update DOM nodes in dated and undated lanes.
 * @param {Array} chits - Filtered chit array
 * @param {Map} positions - Map of chit ID to {x, y, lane}
 */
function _tlRenderNodes(chits, positions) {
  var datedLane = document.getElementById('tl-dated-lane');
  var undatedLane = document.getElementById('tl-undated-lane');
  if (!datedLane || !undatedLane) return;

  // Clear existing nodes (preserve date markers in dated lane)
  var existingNodes = datedLane.querySelectorAll('.timeline-node');
  for (var i = 0; i < existingNodes.length; i++) existingNodes[i].remove();
  existingNodes = undatedLane.querySelectorAll('.timeline-node');
  for (var i = 0; i < existingNodes.length; i++) existingNodes[i].remove();

  // Determine zoom level for detail rendering
  var zoomLevel = _tlGetZoomLevel();

  // Place nodes in their correct lane
  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];
    var pos = positions.get(chit.id);
    if (!pos) continue;

    var node = _tlBuildNodeHTML(chit, zoomLevel);
    node.style.left = pos.x + 'px';
    node.style.top = pos.y + 'px';

    if (pos.lane === 'undated') {
      undatedLane.appendChild(node);
    } else {
      datedLane.appendChild(node);
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Node HTML Builder ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a timeline node DOM element for a chit.
 * @param {object} chit - The chit object
 * @param {string} zoomLevel - 'far', 'medium', or 'close'
 * @returns {HTMLElement} The node element
 */
function _tlBuildNodeHTML(chit, zoomLevel) {
  var node = document.createElement('div');
  node.className = 'timeline-node';
  node.dataset.chitId = chit.id;

  // Status class
  var status = (chit.status || '').toLowerCase().replace(/\s+/g, '');
  var isComplete = (status === 'complete' || status === 'rejected');

  if (status === 'todo') {
    node.classList.add('tl-node-todo');
  } else if (status === 'inprogress') {
    node.classList.add('tl-node-inprogress');
  } else if (status === 'blocked') {
    node.classList.add('tl-node-blocked');
  } else if (isComplete) {
    node.classList.add('tl-node-complete');
  } else {
    node.classList.add('tl-node-todo');
  }

  // ALWAYS set a solid background — never transparent
  node.style.backgroundColor = 'ivory';

  // Completed nodes: solid gray, no color
  if (isComplete) {
    node.style.backgroundColor = '#d4d4d4';
    node.style.borderColor = '#999';
    node.style.color = '#666';
  } else if (chit.color && chit.color !== 'null' && chit.color !== 'undefined' && chit.color.trim() !== '') {
    node.style.backgroundColor = chit.color;
  }

  // Tooltip: title + status + completion date if complete
  var tooltip = (chit.title || '(Untitled)') + ' — ' + (chit.status || 'ToDo');
  if (isComplete && chit.completed_datetime) {
    tooltip += '\nCompleted: ' + chit.completed_datetime.substring(0, 10);
  }
  node.title = tooltip;

  // Title (always visible)
  var titleEl = document.createElement('div');
  titleEl.className = 'timeline-node-title';
  titleEl.textContent = chit.title || '(Untitled)';
  node.appendChild(titleEl);

  // Status text (visible at medium and close zoom)
  if (zoomLevel === 'medium' || zoomLevel === 'close') {
    var statusEl = document.createElement('div');
    statusEl.className = 'timeline-node-status';
    statusEl.textContent = chit.status || '';
    if (isComplete) statusEl.style.color = '#888';
    node.appendChild(statusEl);
  }

  // Single click: handle Link Mode only. Double-click to open editor.
  node.addEventListener('click', function(e) {
    if (node._tlDragJustEnded) {
      node._tlDragJustEnded = false;
      return;
    }
    if (_tlLinkMode) {
      _tlOnLinkModeClick(e);
    }
    // Single click without link mode does nothing (use double-click or context menu)
  });

  // Double-click to open editor
  node.addEventListener('dblclick', function(e) {
    e.preventDefault();
    window.location.href = '/editor?id=' + chit.id;
  });

  // Attach hover/focus highlighting listeners (Req 12.1–12.5)
  _tlAttachHoverListeners(node);

  // Attach drag-to-link listeners (Req 5.1–5.5)
  _tlAttachDragToLinkListeners(node);

  // Attach context menu listeners (Req 6.1 — right-click + long-press)
  _tlAttachContextMenuListeners(node);

  return node;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Dependency Line Rendering ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create SVG <path> elements for dependency lines.
 * Uses getBoundingClientRect() on actual rendered nodes to get correct positions.
 * Lines connect from the right-center of source to left-center of target.
 */
function _tlRenderLines(graph, positions) {
  var svg = document.getElementById('tl-svg');
  if (!svg) return;

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  var svgRect = svg.getBoundingClientRect();

  // Collect all node rects for collision avoidance
  var allNodeRects = [];
  if (_tlContainer) {
    var allNodes = _tlContainer.querySelectorAll('.timeline-node');
    for (var n = 0; n < allNodes.length; n++) {
      var r = allNodes[n].getBoundingClientRect();
      allNodeRects.push({
        left: r.left - svgRect.left,
        right: r.right - svgRect.left,
        top: r.top - svgRect.top,
        bottom: r.bottom - svgRect.top,
        id: allNodes[n].dataset.chitId
      });
    }
  }

  // First pass: collect all line endpoints
  var lineData = [];
  graph.forward.forEach(function(dependents, prereqId) {
    var fromNode = _tlContainer ? _tlContainer.querySelector('.timeline-node[data-chit-id="' + prereqId + '"]') : null;
    if (!fromNode) return;
    var fromRect = fromNode.getBoundingClientRect();

    for (var i = 0; i < dependents.length; i++) {
      var depId = dependents[i];
      var toNode = _tlContainer ? _tlContainer.querySelector('.timeline-node[data-chit-id="' + depId + '"]') : null;
      if (!toNode) continue;
      var toRect = toNode.getBoundingClientRect();

      lineData.push({
        prereqId: prereqId,
        depId: depId,
        startX: fromRect.right - svgRect.left + 4,
        startY: fromRect.top + fromRect.height / 2 - svgRect.top,
        endX: toRect.left - svgRect.left - 4,
        endY: toRect.top + toRect.height / 2 - svgRect.top
      });
    }
  });

  // Group lines by approximate vertical channel (startX rounded to nearest 30px)
  // Lines sharing the same vertical channel get spread offsets
  var channelGroups = {};
  for (var li = 0; li < lineData.length; li++) {
    var ld = lineData[li];
    // The vertical channel is roughly at startX + 30 (centered in gap)
    var channelKey = Math.round((ld.startX + 30) / 30) * 30;
    if (!channelGroups[channelKey]) channelGroups[channelKey] = [];
    channelGroups[channelKey].push(li);
  }

  // Assign offsets within each channel group
  var lineOffsets = new Array(lineData.length);
  for (var key in channelGroups) {
    var group = channelGroups[key];
    for (var gi = 0; gi < group.length; gi++) {
      lineOffsets[group[gi]] = (gi - (group.length - 1) / 2) * 10;
    }
  }

  // Second pass: render lines with offsets
  for (var li = 0; li < lineData.length; li++) {
    var ld = lineData[li];
    var lineOffset = lineOffsets[li] || 0;

    var d = _tlRouteAroundNodes(ld.startX, ld.startY, ld.endX, ld.endY, ld.prereqId, ld.depId, allNodeRects, lineOffset);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('data-from', ld.prereqId);
      path.setAttribute('data-to', ld.depId);

      var fromChit = _tlFindChitById(ld.prereqId);
      var toChit = _tlFindChitById(ld.depId);
      var bothComplete = fromChit && toChit &&
        (fromChit.status === 'Complete' || fromChit.status === 'Rejected') &&
        (toChit.status === 'Complete' || toChit.status === 'Rejected');
      if (bothComplete) path.classList.add('tl-line-complete');
      if (_tlCriticalPathActive && _tlCriticalPathNodes.has(ld.prereqId) && _tlCriticalPathNodes.has(ld.depId)) {
        path.classList.add('tl-critical-path-line');
      }

      svg.appendChild(path);
  }
}

/**
 * Route a line from start to end, using ONLY the gaps between nodes.
 * Vertical travel happens in the horizontal gap between columns.
 * Horizontal travel happens in the vertical gap between rows.
 * Lines NEVER cross through any node.
 */
function _tlRouteAroundNodes(startX, startY, endX, endY, fromId, toId, nodeRects, lineOffset) {
  // lineOffset spreads parallel vertical lines so they don't stack
  var vOffset = lineOffset || 0;
  // Check if a straight horizontal line is possible (same Y, nothing in the way)
  if (Math.abs(startY - endY) < 2) {
    var hBlocked = false;
    var lineY = startY;
    for (var i = 0; i < nodeRects.length; i++) {
      var nr = nodeRects[i];
      if (nr.id === fromId || nr.id === toId) continue;
      // Node blocks if it overlaps the line's Y AND is horizontally between start and end
      if (lineY >= (nr.top - 2) && lineY <= (nr.bottom + 2) && nr.left < endX && nr.right > startX) {
        hBlocked = true;
        break;
      }
    }
    if (!hBlocked) {
      return 'M ' + startX + ',' + startY + ' L ' + endX + ',' + endY;
    }
  }

  // For non-straight lines, route through the gap between columns.
  // Strategy: go right from source into the gap, then vertical, then right to target.
  // The gap is the space between node right edges and the next node's left edge.

  // Find a clear vertical channel X (in the gap between columns)
  var vertX = startX + 30; // Default: centered in the 60px gap between columns
  var minY = Math.min(startY, endY) - 5;
  var maxY = Math.max(startY, endY) + 5;

  // Try multiple X positions to find a clear vertical channel
  var candidates = [
    startX + 30,
    Math.round((startX + endX) / 2),
    endX - 30
  ];

  var vertClear = false;
  for (var c = 0; c < candidates.length; c++) {
    vertX = candidates[c];
    vertClear = true;
    for (var i = 0; i < nodeRects.length; i++) {
      var nr = nodeRects[i];
      if (nr.id === fromId || nr.id === toId) continue;
      if (vertX >= nr.left && vertX <= nr.right && nr.top < maxY && nr.bottom > minY) {
        vertClear = false;
        break;
      }
    }
    if (vertClear) break;
  }

  // If no candidate works, search more aggressively in 10px steps
  if (!vertClear) {
    for (var offset = 20; offset < 200; offset += 10) {
      vertX = startX + offset;
      if (vertX >= endX) break;
      vertClear = true;
      for (var i = 0; i < nodeRects.length; i++) {
        var nr = nodeRects[i];
        if (nr.id === fromId || nr.id === toId) continue;
        if (vertX >= nr.left && vertX <= nr.right && nr.top < maxY && nr.bottom > minY) {
          vertClear = false;
          break;
        }
      }
      if (vertClear) break;
    }
  }

  // Check if the horizontal segment at startY from startX to vertX is clear
  var hStartBlocked = false;
  for (var i = 0; i < nodeRects.length; i++) {
    var nr = nodeRects[i];
    if (nr.id === fromId || nr.id === toId) continue;
    if (startY >= (nr.top - 2) && startY <= (nr.bottom + 2) && nr.left < vertX && nr.right > startX) {
      hStartBlocked = true;
      break;
    }
  }

  // Check if the horizontal segment at endY from vertX to endX is clear
  var hEndBlocked = false;
  for (var i = 0; i < nodeRects.length; i++) {
    var nr = nodeRects[i];
    if (nr.id === fromId || nr.id === toId) continue;
    if (endY >= (nr.top - 2) && endY <= (nr.bottom + 2) && nr.left < endX && nr.right > vertX) {
      hEndBlocked = true;
      break;
    }
  }

  // If horizontal segments are blocked, use a Z-route through the nearest gap
  if (hStartBlocked || hEndBlocked) {
    // Find the nearest clear horizontal Y between startY and endY first,
    // then expand outward. Prefer gaps between adjacent nodes.
    var horizY = Math.round((startY + endY) / 2);
    var found = false;

    // Collect all node edges (tops and bottoms) in the horizontal span
    var edges = [];
    for (var i = 0; i < nodeRects.length; i++) {
      var nr = nodeRects[i];
      if (nr.id === fromId || nr.id === toId) continue;
      if (nr.left < endX && nr.right > startX) {
        edges.push(nr.top);
        edges.push(nr.bottom);
      }
    }
    edges.sort(function(a, b) { return a - b; });

    // Try gaps between consecutive edges (midpoints between bottom of one and top of next)
    var gapCandidates = [];
    for (var i = 0; i < edges.length - 1; i++) {
      var gapMid = (edges[i] + edges[i + 1]) / 2;
      // Check this Y is actually clear (not inside any node)
      var gapClear = true;
      for (var j = 0; j < nodeRects.length; j++) {
        var nr = nodeRects[j];
        if (nr.id === fromId || nr.id === toId) continue;
        if (nr.left < endX && nr.right > startX && gapMid >= nr.top && gapMid <= nr.bottom) {
          gapClear = false;
          break;
        }
      }
      if (gapClear && edges[i + 1] - edges[i] > 6) {
        gapCandidates.push(gapMid);
      }
    }

    // Also try above topmost and below bottommost
    if (edges.length > 0) {
      gapCandidates.push(edges[0] - 15);
      gapCandidates.push(edges[edges.length - 1] + 15);
    }

    // Pick the candidate closest to the midpoint of startY and endY
    var targetY = (startY + endY) / 2;
    gapCandidates.sort(function(a, b) {
      return Math.abs(a - targetY) - Math.abs(b - targetY);
    });

    if (gapCandidates.length > 0) {
      horizY = gapCandidates[0];
      found = true;
    }

    if (!found) {
      // Fallback: just go above or below everything
      var topMost = Infinity, bottomMost = -Infinity;
      for (var i = 0; i < nodeRects.length; i++) {
        var nr = nodeRects[i];
        if (nr.id === fromId || nr.id === toId) continue;
        if (nr.left < endX && nr.right > startX) {
          if (nr.top < topMost) topMost = nr.top;
          if (nr.bottom > bottomMost) bottomMost = nr.bottom;
        }
      }
      horizY = startY < (topMost + bottomMost) / 2 ? topMost - 15 : bottomMost + 15;
    }

    var vertX1 = startX + 30 + vOffset;
    var vertX2 = endX - 30 + vOffset;
    var r = 10;
    var dy1 = horizY > startY ? 1 : -1;
    var dy2 = endY > horizY ? 1 : -1;
    var vd1 = Math.abs(horizY - startY);
    var vd2 = Math.abs(endY - horizY);
    var r1 = Math.min(r, vd1 / 2, 14);
    var r2 = Math.min(r, vd2 / 2, 14);
    if (r1 < 1) r1 = 1;
    if (r2 < 1) r2 = 1;

    return 'M ' + startX + ',' + startY +
      ' H ' + (vertX1 - r1) +
      ' Q ' + vertX1 + ',' + startY + ' ' + vertX1 + ',' + (startY + r1 * dy1) +
      ' V ' + (horizY - r1 * dy1) +
      ' Q ' + vertX1 + ',' + horizY + ' ' + (vertX1 + r1) + ',' + horizY +
      ' H ' + (vertX2 - r2) +
      ' Q ' + vertX2 + ',' + horizY + ' ' + vertX2 + ',' + (horizY + r2 * dy2) +
      ' V ' + (endY - r2 * dy2) +
      ' Q ' + vertX2 + ',' + endY + ' ' + (vertX2 + r2) + ',' + endY +
      ' H ' + endX;
  }

  // Simple L-route with rounded corners
  vertX = vertX + vOffset;
  var r = 12;
  var dy = endY > startY ? 1 : -1;
  var vertDist = Math.abs(endY - startY);
  var hr = Math.min(r, vertDist / 2, Math.abs(vertX - startX) - 1, Math.abs(endX - vertX) - 1);
  if (hr < 2) hr = 2;

  return 'M ' + startX + ',' + startY +
    ' H ' + (vertX - hr) +
    ' Q ' + vertX + ',' + startY + ' ' + vertX + ',' + (startY + hr * dy) +
    ' V ' + (endY - hr * dy) +
    ' Q ' + vertX + ',' + endY + ' ' + (vertX + hr) + ',' + endY +
    ' H ' + endX;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Date Marker Rendering ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Render vertical date lines with labels at equal spacing.
 * Only renders markers for dates that have at least one chit.
 *
 * @param {Array} chits - Filtered chit array
 * @param {object} opts - Layout options (markerSpacing)
 */
function _tlRenderDateMarkers(chits, opts) {
  var datedLane = document.getElementById('tl-dated-lane');
  if (!datedLane) return;

  // Remove existing markers
  var existing = datedLane.querySelectorAll('.tl-date-marker');
  for (var i = 0; i < existing.length; i++) existing[i].remove();

  // Collect unique dates from dated chits
  var dateSet = new Map();
  for (var i = 0; i < chits.length; i++) {
    if (_tlChitHasDate(chits[i])) {
      var dateStr = _tlGetEffectiveDate(chits[i]);
      if (dateStr) dateSet.set(dateStr, true);
    }
  }

  // Sort dates chronologically
  var sortedDates = Array.from(dateSet.keys()).sort();

  // Use same column positions as the layout: leftPadding + colIdx * colWidth + nodeWidth/2
  var nodeWidth = opts.nodeWidth || 180;
  var hGap = 60;
  var colWidth = nodeWidth + hGap;
  var leftPadding = 12;

  // Render markers centered above each date column
  for (var idx = 0; idx < sortedDates.length; idx++) {
    var date = sortedDates[idx];
    var x = leftPadding + idx * colWidth + nodeWidth / 2; // Center of column

    var marker = document.createElement('div');
    marker.className = 'tl-date-marker';
    marker.style.left = x + 'px';

    var label = document.createElement('div');
    label.className = 'tl-date-marker-label';
    label.textContent = _tlFormatDateLabel(date);
    marker.appendChild(label);

    datedLane.appendChild(marker);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Zoom Class Management ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Apply the appropriate zoom class to the canvas based on current _tlZoom.
 * Classes: tl-zoom-far (25%-60%), tl-zoom-medium (61%-150%), tl-zoom-close (151%-300%)
 */
function _tlApplyZoomClass() {
  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Remove existing zoom classes
  canvas.classList.remove('tl-zoom-far', 'tl-zoom-medium', 'tl-zoom-close');

  // Apply appropriate class based on zoom percentage
  var zoomPct = _tlZoom * 100;
  if (zoomPct <= 60) {
    canvas.classList.add('tl-zoom-far');
  } else if (zoomPct <= 150) {
    canvas.classList.add('tl-zoom-medium');
  } else {
    canvas.classList.add('tl-zoom-close');
  }

  // Apply transform scale
  canvas.style.transform = 'scale(' + _tlZoom + ')';
  canvas.style.transformOrigin = '0 0';
}

/**
 * Get the current zoom level name.
 * @returns {string} 'far', 'medium', or 'close'
 */
function _tlGetZoomLevel() {
  var zoomPct = _tlZoom * 100;
  if (zoomPct <= 60) return 'far';
  if (zoomPct <= 150) return 'medium';
  return 'close';
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Empty State ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Render the empty state message when no chits are visible.
 * Uses the .cwoc-empty class for consistent styling.
 */
function _tlRenderEmptyState() {
  if (!_tlContainer) return;

  // Hide viewport, show empty state
  var viewport = _tlContainer.querySelector('.timeline-viewport');
  if (viewport) viewport.style.display = 'none';

  // Remove existing empty state if any
  var existing = _tlContainer.querySelector('.cwoc-empty');
  if (existing) existing.remove();

  var emptyDiv = document.createElement('div');
  emptyDiv.className = 'cwoc-empty';
  emptyDiv.textContent = 'Drag a task onto another to create a dependency, or add dates to see them on the timeline.';
  _tlContainer.appendChild(emptyDiv);
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Canvas Sizing ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Size the canvas to fit all positioned nodes with padding.
 * Ensures the SVG overlay covers the full canvas area.
 */
function _tlSizeCanvas() {
  var canvas = document.getElementById('tl-canvas');
  var svg = document.getElementById('tl-svg');
  var datedLane = document.getElementById('tl-dated-lane');
  var undatedLane = document.getElementById('tl-undated-lane');
  if (!canvas) return;

  var maxX = 0;
  var nodeWidth = 180;
  var nodeHeight = 52;
  var padding = 60;

  // Compute max extents for dated and undated lanes separately
  var maxDatedBottom = 0;
  var maxUndatedBottom = 0;
  var undatedMinY = Infinity;

  _tlPositions.forEach(function(pos) {
    var right = pos.x + nodeWidth + padding;
    if (right > maxX) maxX = right;

    if (pos.lane === 'dated') {
      var bottom = pos.y + nodeHeight + 20;
      if (bottom > maxDatedBottom) maxDatedBottom = bottom;
    } else {
      if (pos.y < undatedMinY) undatedMinY = pos.y;
      var bottom = pos.y + nodeHeight + 20;
      if (bottom > maxUndatedBottom) maxUndatedBottom = bottom;
    }
  });
  if (undatedMinY === Infinity) undatedMinY = 0;

  var totalWidth = maxX + padding;

  // Size the dated lane to fit its content (minimum 80px)
  var datedHeight = Math.max(80, maxDatedBottom + 10);
  // Size the undated lane to fit its content relative to its start (minimum 80px)
  var undatedContentHeight = maxUndatedBottom > 0 ? (maxUndatedBottom - undatedMinY + 40) : 0;
  var undatedHeight = Math.max(80, undatedContentHeight);

  if (datedLane) {
    datedLane.style.height = datedHeight + 'px';
    datedLane.style.minHeight = datedHeight + 'px';
  }
  if (undatedLane) {
    undatedLane.style.height = (undatedHeight + 60) + 'px';
    undatedLane.style.minHeight = (undatedHeight + 60) + 'px';
  }

  var totalHeight = datedHeight + undatedHeight + 100; // 20 divider + 80 bottom margin

  canvas.style.width = totalWidth + 'px';
  canvas.style.minHeight = totalHeight + 'px';

  if (svg) {
    svg.setAttribute('width', totalWidth);
    svg.setAttribute('height', totalHeight);
    svg.style.width = totalWidth + 'px';
    svg.style.height = totalHeight + 'px';
  }
}


/**
 * Update the lane divider to have gaps where dependency lines cross it.
 * Uses a CSS gradient with transparent sections at line X positions.
 */
function _tlUpdateDividerGaps() {
  var divider = document.getElementById('tl-lane-divider');
  if (!divider) return;

  var svg = document.getElementById('tl-svg');
  if (!svg) return;

  var dividerRect = divider.getBoundingClientRect();
  var svgRect = svg.getBoundingClientRect();
  var dividerY = dividerRect.top + dividerRect.height / 2 - svgRect.top;

  // Find all line X positions that cross the divider Y
  var lineXPositions = [];
  var paths = svg.querySelectorAll('path');
  for (var i = 0; i < paths.length; i++) {
    var pathEl = paths[i];
    // Sample the path at the divider Y to find where it crosses
    var pathLen = pathEl.getTotalLength();
    for (var t = 0; t < pathLen; t += 5) {
      var pt = pathEl.getPointAtLength(t);
      if (Math.abs(pt.y - dividerY) < 8) {
        lineXPositions.push(pt.x - (dividerRect.left - svgRect.left));
        break;
      }
    }
  }

  if (lineXPositions.length === 0) {
    divider.style.background = '';
    return;
  }

  // Sort and build gradient with gaps
  lineXPositions.sort(function(a, b) { return a - b; });
  var gapWidth = 12;
  var color = 'var(--aged-brown-medium, #8b4513)';
  var stops = [];
  var lastEnd = 0;

  for (var i = 0; i < lineXPositions.length; i++) {
    var gapStart = lineXPositions[i] - gapWidth / 2;
    var gapEnd = lineXPositions[i] + gapWidth / 2;
    if (gapStart > lastEnd) {
      stops.push(color + ' ' + lastEnd + 'px');
      stops.push(color + ' ' + gapStart + 'px');
    }
    stops.push('transparent ' + gapStart + 'px');
    stops.push('transparent ' + gapEnd + 'px');
    lastEnd = gapEnd;
  }
  stops.push(color + ' ' + lastEnd + 'px');
  stops.push(color + ' 100%');

  divider.style.background = 'linear-gradient(90deg, ' + stops.join(', ') + ')';
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Resize Handler ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Attach a debounced resize listener that re-renders the timeline.
 * Debounce interval: 200ms (Requirement 1.5).
 */
function _tlAttachResizeListener() {
  window.addEventListener('resize', _tlOnResize);
}

/**
 * Debounced resize handler — re-renders after 200ms of no resize events.
 */
function _tlOnResize() {
  if (_tlResizeTimer) clearTimeout(_tlResizeTimer);
  _tlResizeTimer = setTimeout(function() {
    if (_tlContainer && _tlCurrentChits.length > 0) {
      _tlRender(_tlCurrentChits);
    }
  }, 200);
}

/**
 * Clean up resize listener (called when leaving timeline mode).
 */
function _tlDetachResizeListener() {
  window.removeEventListener('resize', _tlOnResize);
  if (_tlResizeTimer) {
    clearTimeout(_tlResizeTimer);
    _tlResizeTimer = null;
  }
  // Also detach zoom/pan listeners
  _tlDetachZoomPanListeners();
  // Also detach Link Mode listeners
  _tlDetachLinkModeListeners();
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Helper Functions ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Format a date string (YYYY-MM-DD) for display as a marker label.
 * Uses the global formatDate if available, otherwise a compact format.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date label
 */
function _tlFormatDateLabel(dateStr) {
  if (!dateStr) return '';
  try {
    // Parse as local date (avoid timezone offset issues with date-only strings)
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      // Format: "Mon Jan 5" style — day-of-week + month + day
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return days[d.getDay()] + ' ' + months[d.getMonth()] + ' ' + d.getDate();
    }
  } catch (e) { /* fallback */ }
  return dateStr;
}

/**
 * Find a chit by ID in the current cached chits array.
 * @param {string} id - Chit ID
 * @returns {object|null} The chit object or null
 */
function _tlFindChitById(id) {
  for (var i = 0; i < _tlCurrentChits.length; i++) {
    if (_tlCurrentChits[i].id === id) return _tlCurrentChits[i];
  }
  return null;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Zoom and Pan Interactions (Task 2.2) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Zoom step per scroll tick (10% = 0.1).
 * @type {number}
 */
var _TL_ZOOM_STEP = 0.1;

/** @type {number} Minimum zoom level (25%) */
var _TL_ZOOM_MIN = 0.25;

/** @type {number} Maximum zoom level (300%) */
var _TL_ZOOM_MAX = 3.0;

/** @type {number} Drag threshold in pixels to distinguish click from drag */
var _TL_DRAG_THRESHOLD = 5;

/** @type {{active: boolean, startX: number, startY: number, scrollLeft: number, scrollTop: number}} Viewport drag state */
var _tlDragState = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };

/** @type {{active: boolean, startDist: number, startZoom: number}} Pinch zoom state */
var _tlPinchState = { active: false, startDist: 0, startZoom: 1.0 };


/**
 * Handle Ctrl+scroll (desktop) zoom on the timeline viewport.
 * Zooms in/out by 10% per scroll tick, clamped to 25%–300%.
 *
 * @param {WheelEvent} e - The wheel event
 */
function _tlOnZoom(e) {
  // Only zoom on Ctrl+scroll (or Meta+scroll on Mac)
  if (!e.ctrlKey && !e.metaKey) return;

  e.preventDefault();

  // Determine zoom direction: scroll up = zoom in, scroll down = zoom out
  var delta = e.deltaY < 0 ? _TL_ZOOM_STEP : -_TL_ZOOM_STEP;
  _tlSetZoom(_tlZoom + delta);
}

/**
 * Set the zoom level, clamped to boundaries.
 * Min zoom is dynamically computed so nodes remain at least a few pixels tall.
 * @param {number} newZoom - Desired zoom level
 */
function _tlSetZoom(newZoom) {
  // Compute dynamic minimum: nodes should be at least 12px tall at min zoom
  // nodeHeight is 60px, so minZoom = 12/60 = 0.2
  var dynamicMin = Math.max(_TL_ZOOM_MIN, 0.2);

  if (newZoom < dynamicMin) newZoom = dynamicMin;
  if (newZoom > _TL_ZOOM_MAX) newZoom = _TL_ZOOM_MAX;

  // If already at boundary, do nothing
  newZoom = Math.round(newZoom * 100) / 100;
  if (newZoom === _tlZoom) return;

  _tlZoom = newZoom;
  _tlApplyZoomClass();
}

/**
 * Recenter the timeline: reset zoom to 1.0 and scroll to top-left (default position).
 */
function _tlRecenter() {
  _tlZoom = 1.0;
  _tlApplyZoomClass();

  var viewport = document.getElementById('tl-viewport');
  if (viewport) {
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }
}


/**
 * Handle mousedown on the viewport to initiate drag-to-pan.
 * Only activates on empty space (not on nodes or SVG paths).
 *
 * @param {MouseEvent} e - The mousedown event
 */
function _tlOnViewportDragStart(e) {
  // Only left mouse button
  if (e.button !== 0) return;

  // Don't pan if clicking on a node or interactive element
  var target = e.target;
  if (target.closest('.timeline-node') || target.closest('.timeline-toolbar') ||
      target.tagName === 'path' || target.tagName === 'BUTTON') {
    return;
  }

  // Shift+drag → rect-select instead of pan (Req 9.1)
  if (e.shiftKey) {
    _tlOnRectSelectStart(e);
    return;
  }

  var viewport = document.getElementById('tl-viewport');
  if (!viewport) return;

  _tlDragState.active = false; // Will become true after threshold
  _tlDragState.startX = e.clientX;
  _tlDragState.startY = e.clientY;
  _tlDragState.scrollLeft = viewport.scrollLeft;
  _tlDragState.scrollTop = viewport.scrollTop;
  _tlDragState.moved = false;

  // Attach move/up listeners to document for reliable tracking
  document.addEventListener('mousemove', _tlOnViewportDragMove);
  document.addEventListener('mouseup', _tlOnViewportDragEnd);
}


/**
 * Handle mousemove during viewport drag-to-pan.
 * Pans with 1:1 pixel correspondence to pointer movement.
 *
 * @param {MouseEvent} e - The mousemove event
 */
function _tlOnViewportDragMove(e) {
  var dx = e.clientX - _tlDragState.startX;
  var dy = e.clientY - _tlDragState.startY;

  // Check if we've exceeded the drag threshold
  if (!_tlDragState.active) {
    if (Math.abs(dx) > _TL_DRAG_THRESHOLD || Math.abs(dy) > _TL_DRAG_THRESHOLD) {
      _tlDragState.active = true;
      // Set grabbing cursor
      var viewport = document.getElementById('tl-viewport');
      if (viewport) viewport.style.cursor = 'grabbing';
    } else {
      return; // Haven't exceeded threshold yet
    }
  }

  // Pan: move scroll position opposite to pointer movement (1:1 correspondence)
  var viewport = document.getElementById('tl-viewport');
  if (!viewport) return;

  viewport.scrollLeft = _tlDragState.scrollLeft - dx;
  viewport.scrollTop = _tlDragState.scrollTop - dy;
}


/**
 * Handle mouseup to end viewport drag-to-pan.
 * If the drag threshold was NOT exceeded (≤5px movement), treat as a click
 * and delegate to _tlOnCanvasClick for task creation.
 *
 * @param {MouseEvent} e - The mouseup event
 */
function _tlOnViewportDragEnd(e) {
  document.removeEventListener('mousemove', _tlOnViewportDragMove);
  document.removeEventListener('mouseup', _tlOnViewportDragEnd);

  // Restore cursor
  var viewport = document.getElementById('tl-viewport');
  if (viewport) viewport.style.cursor = '';

  var wasDrag = _tlDragState.active;
  _tlDragState.active = false;

  // If threshold was NOT exceeded, this was a click — delegate to canvas click handler
  if (!wasDrag) {
    // Clear any multi-selection on click on empty space
    if (_tlSelectedNodes && _tlSelectedNodes.size > 0) {
      _tlClearSelection();
    }
    _tlOnCanvasClick(e);
  }
}


/**
 * Handle touch pinch-to-zoom on the timeline viewport.
 * Detects two-finger pinch gestures and adjusts zoom accordingly.
 *
 * @param {TouchEvent} e - The touchstart event
 */
function _tlOnPinchStart(e) {
  if (e.touches.length !== 2) return;

  var dist = _tlPinchDistance(e.touches[0], e.touches[1]);
  _tlPinchState.active = true;
  _tlPinchState.startDist = dist;
  _tlPinchState.startZoom = _tlZoom;
}


/**
 * Handle touchmove during pinch-to-zoom.
 * Adjusts zoom proportionally to finger distance change.
 *
 * @param {TouchEvent} e - The touchmove event
 */
function _tlOnPinchMove(e) {
  if (!_tlPinchState.active || e.touches.length !== 2) return;

  e.preventDefault();

  var dist = _tlPinchDistance(e.touches[0], e.touches[1]);
  var scale = dist / _tlPinchState.startDist;
  var newZoom = _tlPinchState.startZoom * scale;

  // Clamp at boundaries
  if (newZoom < _TL_ZOOM_MIN) newZoom = _TL_ZOOM_MIN;
  if (newZoom > _TL_ZOOM_MAX) newZoom = _TL_ZOOM_MAX;

  // Round to avoid floating point drift
  newZoom = Math.round(newZoom * 100) / 100;

  if (newZoom !== _tlZoom) {
    _tlZoom = newZoom;
    _tlApplyZoomClass();
  }
}


/**
 * Handle touchend to finalize pinch-to-zoom.
 *
 * @param {TouchEvent} e - The touchend event
 */
function _tlOnPinchEnd(e) {
  if (_tlPinchState.active && e.touches.length < 2) {
    _tlPinchState.active = false;
  }
}


/**
 * Compute the distance between two touch points.
 *
 * @param {Touch} t1 - First touch point
 * @param {Touch} t2 - Second touch point
 * @returns {number} Distance in pixels
 */
function _tlPinchDistance(t1, t2) {
  var dx = t1.clientX - t2.clientX;
  var dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Attach all zoom and pan event listeners to the timeline viewport.
 * Called from _tlBuildContainer() or displayTimelineView() after container is built.
 */
function _tlAttachZoomPanListeners() {
  var viewport = document.getElementById('tl-viewport');
  if (!viewport) return;

  // Desktop: Ctrl+scroll to zoom (wheel event on viewport)
  viewport.addEventListener('wheel', _tlOnZoom, { passive: false });

  // Desktop: click-drag on empty space to pan
  viewport.addEventListener('mousedown', _tlOnViewportDragStart);

  // Touch: pinch-to-zoom
  viewport.addEventListener('touchstart', _tlOnPinchStart, { passive: true });
  viewport.addEventListener('touchmove', _tlOnPinchMove, { passive: false });
  viewport.addEventListener('touchend', _tlOnPinchEnd, { passive: true });
  viewport.addEventListener('touchcancel', _tlOnPinchEnd, { passive: true });

  // Set grab cursor to indicate pan capability
  viewport.style.cursor = 'grab';

  // Wire zoom control buttons
  var zoomInBtn = document.getElementById('tl-zoom-in-btn');
  var zoomOutBtn = document.getElementById('tl-zoom-out-btn');
  var recenterBtn = document.getElementById('tl-recenter-btn');

  if (zoomInBtn) zoomInBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlSetZoom(_tlZoom + _TL_ZOOM_STEP);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlSetZoom(_tlZoom - _TL_ZOOM_STEP);
  });
  if (recenterBtn) recenterBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlRecenter();
  });
}


/**
 * Detach all zoom and pan event listeners from the timeline viewport.
 * Called when leaving timeline mode.
 */
function _tlDetachZoomPanListeners() {
  var viewport = document.getElementById('tl-viewport');
  if (!viewport) return;

  viewport.removeEventListener('wheel', _tlOnZoom);
  viewport.removeEventListener('mousedown', _tlOnViewportDragStart);
  viewport.removeEventListener('touchstart', _tlOnPinchStart);
  viewport.removeEventListener('touchmove', _tlOnPinchMove);
  viewport.removeEventListener('touchend', _tlOnPinchEnd);
  viewport.removeEventListener('touchcancel', _tlOnPinchEnd);

  // Clean up any lingering document-level listeners
  document.removeEventListener('mousemove', _tlOnViewportDragMove);
  document.removeEventListener('mouseup', _tlOnViewportDragEnd);

  viewport.style.cursor = '';
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Lane Divider Drag-to-Resize ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Attach drag-to-resize handler on the lane divider.
 * Dragging the divider up/down resizes the dated and undated lanes.
 */
function _tlAttachDividerDrag() {
  if (!_tlContainer) return;
  var divider = _tlContainer.querySelector('.timeline-lane-divider');
  if (!divider) return;

  divider.addEventListener('mousedown', function(e) {
    e.preventDefault();
    var datedLane = document.getElementById('tl-dated-lane');
    var undatedLane = document.getElementById('tl-undated-lane');
    var canvas = document.getElementById('tl-canvas');
    if (!datedLane || !undatedLane || !canvas) return;

    var startY = e.clientY;
    var startDatedHeight = datedLane.offsetHeight;
    var startUndatedHeight = undatedLane.offsetHeight;

    function onMove(ev) {
      var dy = ev.clientY - startY;
      var newDated = Math.max(80, startDatedHeight + dy);
      var newUndated = Math.max(80, startUndatedHeight - dy);
      datedLane.style.flex = 'none';
      undatedLane.style.flex = 'none';
      datedLane.style.height = newDated + 'px';
      undatedLane.style.height = newUndated + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Hover/Focus Highlighting (Req 12.1–12.5) ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/** @type {string|null} Currently highlighted node ID (for touch and re-hover logic) */
var _tlHighlightedNodeId = null;

/**
 * Handle node hover (desktop) or tap (touch) — highlight the node and all
 * directly connected incoming/outgoing dependency lines at full opacity and
 * 2x line width. Dim everything else to 0.3 opacity.
 *
 * Req 12.1: Highlight node + direct connections at full opacity + 2x line width
 * Req 12.2: Dim all other nodes/lines to 0.3 opacity
 * Req 12.4: If node has zero connections, highlight only that node, dim everything else
 * Req 12.5: If a second node is hovered while first is highlighted, remove first and apply to second
 *
 * @param {Event} e - mouseenter or touchend event
 */
function _tlOnNodeHover(e) {
  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  // Clear any previous highlight
  if (_tlHighlightedNodeId && _tlHighlightedNodeId !== chitId) {
    _tlClearHighlight();
  }

  _tlHighlightedNodeId = chitId;

  // Find directly connected node IDs using the graph
  var connectedIds = new Set();
  connectedIds.add(chitId);

  var outgoing = _tlGraph.forward.get(chitId) || [];
  for (var i = 0; i < outgoing.length; i++) connectedIds.add(outgoing[i]);

  var incoming = _tlGraph.reverse.get(chitId) || [];
  for (var i = 0; i < incoming.length; i++) connectedIds.add(incoming[i]);

  // Highlight connected nodes (no dimming of others)
  var allNodes = _tlContainer.querySelectorAll('.timeline-node');
  for (var i = 0; i < allNodes.length; i++) {
    var n = allNodes[i];
    var nId = n.dataset.chitId;
    n.classList.remove('tl-node-highlighted');
    if (connectedIds.has(nId)) {
      n.classList.add('tl-node-highlighted');
    }
  }

  // Highlight connected lines only (no dimming of others)
  var svg = document.getElementById('tl-svg');
  if (svg) {
    var paths = svg.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      var path = paths[i];
      var fromId = path.getAttribute('data-from');
      var toId = path.getAttribute('data-to');
      path.classList.remove('tl-line-highlighted');
      if (fromId === chitId || toId === chitId) {
        path.classList.add('tl-line-highlighted');
      }
    }
  }
}

/**
 * Handle node hover end (desktop mouseleave) — restore all elements to default
 * opacity and line width within 150ms.
 *
 * Req 12.3: Restore all elements within 150ms on hover-end
 *
 * @param {Event} e - mouseleave event
 */
function _tlOnNodeHoverEnd(e) {
  // On desktop, clear highlight when mouse leaves the node
  // The 150ms transition is handled by CSS (transition: opacity 0.15s ease on .tl-node-dimmed)
  _tlClearHighlight();
}

/**
 * Clear all hover highlighting — remove highlighted/dimmed classes from all
 * nodes and lines, restoring default appearance.
 */
function _tlClearHighlight() {
  _tlHighlightedNodeId = null;

  if (!_tlContainer) return;

  // Remove highlight/dim from all nodes
  var allNodes = _tlContainer.querySelectorAll('.timeline-node');
  for (var i = 0; i < allNodes.length; i++) {
    allNodes[i].classList.remove('tl-node-highlighted', 'tl-node-dimmed');
  }

  // Remove highlight/dim from all SVG lines
  var svg = document.getElementById('tl-svg');
  if (svg) {
    var paths = svg.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      paths[i].classList.remove('tl-line-highlighted', 'tl-line-dimmed');
    }
  }
}

/**
 * Handle touch tap on a node — toggle highlight on/off.
 * Tap a node to highlight it; tap the same node again to clear.
 *
 * @param {Event} e - touchend event on a node
 */
function _tlOnNodeTouchHighlight(e) {
  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  // If this node is already highlighted, clear it
  if (_tlHighlightedNodeId === chitId) {
    _tlClearHighlight();
    return;
  }

  // Otherwise, highlight this node (reuse the hover logic)
  _tlOnNodeHover(e);
}

/**
 * Handle tap on empty canvas space (touch) — clear any active highlight.
 * Attached to the viewport/canvas so tapping outside nodes clears highlighting.
 *
 * @param {Event} e - touchend event on canvas/viewport
 */
function _tlOnCanvasTouchClear(e) {
  // Only clear if the tap target is NOT a timeline node (or inside one)
  if (e.target.closest && e.target.closest('.timeline-node')) return;

  if (_tlHighlightedNodeId) {
    _tlClearHighlight();
  }
}

/**
 * Attach hover/focus event listeners to a timeline node element.
 * Called during node creation in _tlBuildNodeHTML or after nodes are rendered.
 *
 * Desktop: mouseenter → highlight, mouseleave → clear
 * Touch: tap (touchend) → toggle highlight
 *
 * @param {HTMLElement} node - The timeline node DOM element
 */
function _tlAttachHoverListeners(node) {
  // Desktop hover
  node.addEventListener('mouseenter', _tlOnNodeHover);
  node.addEventListener('mouseleave', _tlOnNodeHoverEnd);

  // Touch: use touchend for tap-to-highlight
  node.addEventListener('touchend', function(e) {
    // Prevent the mouseenter from also firing on touch devices
    e.preventDefault();
    _tlOnNodeTouchHighlight(e);
  });
}

/**
 * Attach the canvas-level touch listener for clearing highlights on tap-elsewhere.
 * Called once when the timeline container is built.
 */
function _tlAttachCanvasTouchClearListener() {
  var viewport = document.getElementById('tl-viewport');
  if (viewport) {
    viewport.addEventListener('touchend', _tlOnCanvasTouchClear);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Order Toggle (By Date / By Dependency) — Req 10.1–10.6 ──────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the Order Toggle (By Date / By Dependency) click handler.
 * Uses the standard CWOC 2-value pill toggle pattern.
 *
 * On toggle change:
 *   1. Update _tlOrderMode global
 *   2. Update hidden input value
 *   3. Update active class on spans
 *   4. Add CSS transition to .timeline-node for 300ms animated position change
 *   5. Re-render with new layout via _tlRender(_tlCurrentChits)
 *   6. Remove transition after animation completes
 *
 * Session persistence: _tlOrderMode variable persists for session duration
 * (no localStorage needed — the variable survives as long as the page is open).
 *
 * Called from displayTimelineView() after the container is built.
 */
function _tlInitOrderToggle() {
  var pill = document.getElementById('tl-order-toggle');
  if (!pill) return;

  // Sync visual state with current _tlOrderMode (sidebar persists across renders)
  var hidden = document.getElementById('tl-order-val');
  if (hidden) hidden.value = _tlOrderMode;
  var spans = pill.querySelectorAll('span[data-val]');
  spans.forEach(function(s) { s.classList.toggle('active', s.dataset.val === _tlOrderMode); });

  // Only attach listener once (check for flag to avoid duplicate listeners)
  if (pill._tlListenerAttached) return;
  pill._tlListenerAttached = true;

  pill.addEventListener('click', function() {
    var hidden = document.getElementById('tl-order-val');
    var spans = pill.querySelectorAll('span[data-val]');
    var current = hidden.value;
    var next = (spans[0].dataset.val === current) ? spans[1].dataset.val : spans[0].dataset.val;

    // Update hidden input value
    hidden.value = next;

    // Update active class on spans
    spans.forEach(function(s) { s.classList.toggle('active', s.dataset.val === next); });

    // Update the global order mode
    _tlOrderMode = next;

    // Add 300ms CSS transition to all existing .timeline-node elements for animated position change
    var nodes = _tlContainer ? _tlContainer.querySelectorAll('.timeline-node') : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.transition = 'left 0.3s ease, top 0.3s ease';
    }

    // Re-render with new layout
    _tlRender(_tlCurrentChits);

    // Remove transition after animation completes (300ms + small buffer)
    setTimeout(function() {
      var updatedNodes = _tlContainer ? _tlContainer.querySelectorAll('.timeline-node') : [];
      for (var i = 0; i < updatedNodes.length; i++) {
        updatedNodes[i].style.transition = '';
      }
    }, 350);
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Critical Path Toggle (Req 13.1–13.6) ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the Critical Path toggle button click handler.
 * Wires the "⚡ Critical Path" button to compute and highlight the longest
 * dependency chain(s) in the graph.
 *
 * Req 13.1: Provide a "Show critical path" toggle in the toolbar
 * Req 13.2: Highlight longest chain at 2× thickness + distinct color
 * Req 13.3: If multiple paths tie, highlight all
 * Req 13.4: Dim non-critical nodes/lines to ≤50% opacity
 * Req 13.5: Deactivate restores all within 300ms
 * Req 13.6: If no dependency lines exist, keep toggle inactive + show message
 */
function _tlInitCriticalPathToggle() {
  var btn = document.getElementById('tl-critical-path-btn');
  if (!btn) return;

  // Sync visual state
  if (_tlCriticalPathActive) btn.classList.add('active');
  else btn.classList.remove('active');

  // Only attach listener once (sidebar persists)
  if (btn._tlListenerAttached) return;
  btn._tlListenerAttached = true;

  btn.addEventListener('click', function() {
    if (_tlCriticalPathActive) {
      // Deactivate critical path highlighting
      _tlDeactivateCriticalPath();
    } else {
      // Activate critical path highlighting
      _tlActivateCriticalPath();
    }
  });
}

/**
 * Activate critical path highlighting.
 * Computes the critical path via _tlCriticalPath, applies CSS classes to
 * highlight critical nodes/lines and dim non-critical elements.
 *
 * If no dependency lines exist (graph.forward.size === 0), shows a toast
 * and does not activate.
 */
function _tlActivateCriticalPath() {
  // Req 13.6: If no dependency lines exist, show message and don't activate
  if (!_tlGraph.forward || _tlGraph.forward.size === 0) {
    cwocToast('No dependency chain available to highlight.', 'info');
    return;
  }

  // Compute critical path using the algo module
  var criticalNodes = _tlCriticalPath(_tlCurrentChits);

  // If the critical path is empty (no meaningful path), show message
  if (!criticalNodes || criticalNodes.size === 0) {
    cwocToast('No dependency chain available to highlight.', 'info');
    return;
  }

  // Store state
  _tlCriticalPathActive = true;
  _tlCriticalPathNodes = criticalNodes;

  // Update button state
  var btn = document.getElementById('tl-critical-path-btn');
  if (btn) btn.classList.add('active');

  // Add container-level class for dimming non-critical elements (CSS handles opacity)
  if (_tlContainer) {
    _tlContainer.classList.add('tl-critical-path-active');
  }

  // Apply .tl-critical-path-node to nodes on the critical path
  var allNodes = _tlContainer ? _tlContainer.querySelectorAll('.timeline-node') : [];
  for (var i = 0; i < allNodes.length; i++) {
    var node = allNodes[i];
    var chitId = node.dataset.chitId;
    if (chitId && _tlCriticalPathNodes.has(chitId)) {
      node.classList.add('tl-critical-path-node');
    }
  }

  // Apply .tl-critical-path-line to SVG paths where both endpoints are on the critical path
  var svg = document.getElementById('tl-svg');
  if (svg) {
    var paths = svg.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      var path = paths[i];
      var fromId = path.getAttribute('data-from');
      var toId = path.getAttribute('data-to');
      if (fromId && toId && _tlCriticalPathNodes.has(fromId) && _tlCriticalPathNodes.has(toId)) {
        path.classList.add('tl-critical-path-line');
      }
    }
  }
}

/**
 * Deactivate critical path highlighting.
 * Removes all critical path CSS classes and restores normal appearance.
 * The 300ms restore transition is handled by CSS transitions on the affected elements.
 *
 * Req 13.5: Restore all to normal within 300ms on deactivate
 */
function _tlDeactivateCriticalPath() {
  // Clear state
  _tlCriticalPathActive = false;
  _tlCriticalPathNodes = new Set();

  // Update button state
  var btn = document.getElementById('tl-critical-path-btn');
  if (btn) btn.classList.remove('active');

  // Remove container-level class (CSS transitions handle the 300ms restore)
  if (_tlContainer) {
    _tlContainer.classList.remove('tl-critical-path-active');
  }

  // Remove .tl-critical-path-node from all nodes
  var allNodes = _tlContainer ? _tlContainer.querySelectorAll('.tl-critical-path-node') : [];
  for (var i = 0; i < allNodes.length; i++) {
    allNodes[i].classList.remove('tl-critical-path-node');
  }

  // Remove .tl-critical-path-line from all SVG paths
  var svg = document.getElementById('tl-svg');
  if (svg) {
    var paths = svg.querySelectorAll('.tl-critical-path-line');
    for (var i = 0; i < paths.length; i++) {
      paths[i].classList.remove('tl-critical-path-line');
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Link Mode (Req 7.1–7.7) ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Toggle Link Mode on/off.
 * When activated: sets crosshair cursor, updates button state.
 * When deactivated: restores cursor, clears any partial source selection.
 *
 * Req 7.1: Toggle button in toolbar
 * Req 7.4: Distinct cursor style while active
 * Req 7.5: Toggle-off cancels partial selection
 */
function _tlToggleLinkMode() {
  _tlLinkMode = !_tlLinkMode;

  var btn = document.getElementById('tl-link-mode-btn');
  var container = _tlContainer;

  if (_tlLinkMode) {
    // Activate Link Mode
    if (btn) btn.classList.add('active');
    if (container) container.classList.add('tl-link-mode-active');
  } else {
    // Deactivate Link Mode — cancel any partial selection
    if (btn) btn.classList.remove('active');
    if (container) container.classList.remove('tl-link-mode-active');
    _tlClearLinkSource();
  }
}

/**
 * Handle a node click while Link Mode is active.
 * First click: select source node (highlight with gold outline).
 * Second click: create dependency (source → target), clear selection.
 *
 * Req 7.2: First click highlights source, awaits second click
 * Req 7.3: Second click creates dependency (first = prerequisite of second)
 * Req 7.6: Block cycles, self-links, duplicates with toast
 * Req 7.7: Run cycle detection before persisting
 *
 * @param {Event} e - Click event on a timeline node
 */
function _tlOnLinkModeClick(e) {
  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  // Prevent event from bubbling to canvas click handlers
  e.stopPropagation();

  if (!_tlLinkSource) {
    // First click — select source
    _tlLinkSource = chitId;
    node.classList.add('tl-link-source');
  } else {
    // Second click — attempt to create dependency
    var sourceId = _tlLinkSource;
    var targetId = chitId;

    // Block self-link
    if (sourceId === targetId) {
      cwocToast('Cannot link a task to itself.', 'error');
      _tlClearLinkSource();
      return;
    }

    // Block duplicate — check if sourceId is already a prerequisite of targetId
    var targetChit = _tlFindChitById(targetId);
    if (targetChit) {
      var existingPrereqs = targetChit.prerequisites || [];
      if (typeof existingPrereqs === 'string') {
        try { existingPrereqs = JSON.parse(existingPrereqs); } catch (ex) { existingPrereqs = []; }
      }
      if (!Array.isArray(existingPrereqs)) existingPrereqs = [];
      if (existingPrereqs.indexOf(sourceId) !== -1) {
        cwocToast('This dependency already exists.', 'info');
        _tlClearLinkSource();
        return;
      }
    }

    // Block cycle — use client-side BFS cycle detection
    if (_tlWouldCycle(sourceId, targetId, _tlGraph.forward)) {
      cwocToast('Cannot link: would create a circular dependency.', 'error');
      _tlClearLinkSource();
      return;
    }

    // All checks passed — persist the dependency
    _tlCreateLinkModeDependency(sourceId, targetId);
  }
}

/**
 * Create a dependency via Link Mode: source becomes a prerequisite of target.
 * Persists via PUT /api/chits/{targetId} updating the prerequisites array.
 * On success: re-renders the timeline. On failure: shows error toast.
 *
 * @param {string} sourceId - The prerequisite chit ID
 * @param {string} targetId - The dependent chit ID
 */
async function _tlCreateLinkModeDependency(sourceId, targetId) {
  var targetChit = _tlFindChitById(targetId);
  if (!targetChit) {
    cwocToast('Target task not found.', 'error');
    _tlClearLinkSource();
    return;
  }

  // Build updated prerequisites array
  var prereqs = targetChit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (ex) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];
  prereqs.push(sourceId);

  // Clear source selection immediately for responsive UX
  _tlClearLinkSource();

  try {
    var response = await fetch('/api/chits/' + targetId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: prereqs })
    });

    if (!response.ok) {
      throw new Error('API returned ' + response.status);
    }

    // Update the local chit data
    targetChit.prerequisites = prereqs;

    // Re-render the timeline to show the new dependency line
    _tlRender(_tlCurrentChits);

    cwocToast('Dependency created.', 'success');
  } catch (err) {
    console.error('[Timeline] Failed to create dependency via Link Mode:', err);
    cwocToast('Failed to save dependency. Please try again.', 'error');
  }
}

/**
 * Clear the Link Mode source selection — remove highlight from the source node
 * and reset the _tlLinkSource variable.
 */
function _tlClearLinkSource() {
  if (_tlLinkSource && _tlContainer) {
    var sourceNode = _tlContainer.querySelector('.timeline-node[data-chit-id="' + _tlLinkSource + '"]');
    if (sourceNode) {
      sourceNode.classList.remove('tl-link-source');
    }
  }
  _tlLinkSource = null;
}

/**
 * Handle ESC key press — cancel partial Link Mode selection.
 * If Link Mode is active and a source is selected, clear the source.
 * If Link Mode is active with no source, deactivate Link Mode entirely.
 *
 * Req 7.5: ESC cancels partial selection without creating a dependency
 *
 * @param {KeyboardEvent} e - The keydown event
 */
function _tlOnLinkModeEsc(e) {
  if (e.key !== 'Escape') return;
  if (!_tlLinkMode) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (_tlLinkSource) {
    // Cancel partial selection
    _tlClearLinkSource();
  } else {
    // Deactivate Link Mode entirely
    _tlToggleLinkMode();
  }
}

/**
 * Attach Link Mode event listeners:
 * - Click handler on the Link Mode toggle button
 * - ESC key listener on document for cancellation
 *
 * Called from displayTimelineView() after container is built.
 */
function _tlAttachLinkModeListeners() {
  // Wire the toggle button (only once — sidebar persists)
  var btn = document.getElementById('tl-link-mode-btn');
  if (btn && !btn._tlListenerAttached) {
    btn._tlListenerAttached = true;
    btn.addEventListener('click', _tlToggleLinkMode);
  }
  // Sync visual state
  if (btn) {
    if (_tlLinkMode) btn.classList.add('active');
    else btn.classList.remove('active');
  }

  // Wire ESC key for cancellation (capture phase so it fires before other ESC handlers)
  document.addEventListener('keydown', _tlOnLinkModeEsc, true);

  // Wire Cmd+Z / Cmd+Shift+Z for undo/redo
  document.addEventListener('keydown', _tlOnUndoRedo, true);
}

/**
 * Detach Link Mode event listeners.
 * Called when leaving timeline mode to clean up.
 */
function _tlDetachLinkModeListeners() {
  var btn = document.getElementById('tl-link-mode-btn');
  if (btn) {
    btn.removeEventListener('click', _tlToggleLinkMode);
  }

  document.removeEventListener('keydown', _tlOnLinkModeEsc, true);
  document.removeEventListener('keydown', _tlOnUndoRedo, true);

  // Reset Link Mode state
  _tlLinkMode = false;
  _tlLinkSource = null;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Undo/Redo (Cmd+Z / Cmd+Shift+Z) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Push an action onto the undo stack. Clears redo stack.
 */
function _tlPushUndo(action) {
  _tlUndoStack.push(action);
  _tlRedoStack = [];
}

/**
 * Handle Cmd+Z (undo) and Cmd+Shift+Z (redo) keyboard shortcuts.
 */
function _tlOnUndoRedo(e) {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.key !== 'z' && e.key !== 'Z') return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.shiftKey) {
    _tlRedo();
  } else {
    _tlUndo();
  }
}

/**
 * Undo the last dependency action.
 */
async function _tlUndo() {
  if (_tlUndoStack.length === 0) {
    cwocToast('Nothing to undo.', 'info');
    return;
  }
  var action = _tlUndoStack.pop();
  _tlRedoStack.push(action);

  // Restore old prerequisites
  var chit = _tlFindChitById(action.chitId);
  if (!chit) return;
  chit.prerequisites = action.oldPrereqs.slice();

  // Persist — only update prerequisites
  try {
    await fetch('/api/chits/' + action.chitId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: action.oldPrereqs })
    });
  } catch (e) { console.error('[Timeline] Undo failed:', e); }

  _tlRender(_tlCurrentChits);
  cwocToast('Undone.', 'success');
}

/**
 * Redo the last undone dependency action.
 */
async function _tlRedo() {
  if (_tlRedoStack.length === 0) {
    cwocToast('Nothing to redo.', 'info');
    return;
  }
  var action = _tlRedoStack.pop();
  _tlUndoStack.push(action);

  // Apply new prerequisites
  var chit = _tlFindChitById(action.chitId);
  if (!chit) return;
  chit.prerequisites = action.newPrereqs.slice();

  // Persist — only update prerequisites
  try {
    await fetch('/api/chits/' + action.chitId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: action.newPrereqs })
    });
  } catch (e) { console.error('[Timeline] Redo failed:', e); }

  _tlRender(_tlCurrentChits);
  cwocToast('Redone.', 'success');
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Dependency Line Click-to-Remove (Req 8.1, 8.3–8.5) ──────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Attach event delegation listener on the SVG element for line clicks.
 * Uses event delegation on #tl-svg since paths are re-created on each render.
 * Called after the SVG element is created (in displayTimelineView or _tlRender).
 */
function _tlAttachLineClickListener() {
  // Attach click directly to each path (not delegation on SVG,
  // because SVG has pointer-events:none for pass-through)
  var svg = document.getElementById('tl-svg');
  if (!svg) return;
  var paths = svg.querySelectorAll('path');
  for (var i = 0; i < paths.length; i++) {
    paths[i].addEventListener('click', _tlOnLineClick);
  }
}

/**
 * Handle click/tap on an SVG dependency line path.
 * Removes the dependency (prereq from dependent's prerequisites array),
 * shows an undo toast with 5-second countdown, and persists via API.
 *
 * Req 8.1: Click/tap on line removes dependency + shows undo toast
 * Req 8.3: Update visual within 200ms and persist via API
 * Req 8.4: Undo restores dependency, re-renders, persists restoration via API
 * Req 8.5: Revert visual on API failure
 *
 * @param {Event} e - Click event (delegated from #tl-svg)
 */
function _tlOnLineClick(e) {
  var target = e.currentTarget; // The path element this listener is on

  var prereqId = target.getAttribute('data-from');
  var dependentId = target.getAttribute('data-to');
  if (!prereqId || !dependentId) return;

  // Find the dependent chit in the cached chits array
  var dependentChit = _tlFindChitById(dependentId);
  var prereqChit = _tlFindChitById(prereqId);
  if (!dependentChit) return;

  // Get the current prerequisites array for the dependent chit
  var prereqs = dependentChit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (ex) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];

  // Check that the prereq actually exists in the array
  var prereqIndex = prereqs.indexOf(prereqId);
  if (prereqIndex === -1) return;

  // Remove the prerequisite from the array (optimistic update)
  var updatedPrereqs = prereqs.filter(function(id) { return id !== prereqId; });
  dependentChit.prerequisites = updatedPrereqs;

  // Re-render immediately (visual update within 200ms per Req 8.3)
  _tlRender(_tlCurrentChits);

  // Build display names for the toast message
  var prereqName = (prereqChit && prereqChit.title) ? prereqChit.title : 'prerequisite';
  var depName = (dependentChit.title) ? dependentChit.title : 'task';
  var toastMsg = '🔗 Removed dependency: ' + prereqName + ' → ' + depName;

  // Show undo toast with 5-second countdown
  // Persist immediately (don't wait for countdown — prevents data loss on refresh)
  _tlPersistPrereqRemoval(dependentChit, updatedPrereqs, prereqId, prereqs);

  cwocUndoToast(toastMsg, {
    duration: 5000,
    id: 'tl-dep-remove-undo',
    onExpire: function() {
      // Countdown expired without undo — already persisted, nothing to do
    },
    onUndo: function() {
      // User clicked Undo — restore the dependency
      _tlUndoPrereqRemoval(dependentChit, prereqId);
    }
  });
}

/**
 * Persist the prerequisite removal via PUT /api/chits/{dependentId}.
 * If the API call fails, revert the visual (restore the prereq and re-render).
 *
 * @param {object} dependentChit - The dependent chit object
 * @param {Array} updatedPrereqs - The new prerequisites array (without the removed prereq)
 * @param {string} removedPrereqId - The ID of the removed prerequisite
 * @param {Array} originalPrereqs - The original prerequisites array (for revert)
 */
async function _tlPersistPrereqRemoval(dependentChit, updatedPrereqs, removedPrereqId, originalPrereqs) {
  try {
    console.log('[Timeline] Persisting prereq removal for', dependentChit.id, 'new prereqs:', updatedPrereqs);
    var resp = await fetch('/api/chits/' + encodeURIComponent(dependentChit.id) + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: updatedPrereqs })
    });

    if (!resp.ok) {
      var errText = await resp.text().catch(function() { return ''; });
      console.error('[Timeline] Failed to persist dependency removal:', resp.status, errText);
      // Revert visual — restore the original prerequisites
      dependentChit.prerequisites = originalPrereqs;
      _tlRender(_tlCurrentChits);
      cwocToast('Failed to remove dependency.', 'error');
    } else {
      console.log('[Timeline] Prereq removal persisted successfully');
    }
  } catch (err) {
    console.error('[Timeline] Exception persisting dependency removal:', err);
    // Revert visual — restore the original prerequisites
    dependentChit.prerequisites = originalPrereqs;
    _tlRender(_tlCurrentChits);
    cwocToast('Failed to remove dependency.', 'error');
  }
}

/**
 * Undo a prerequisite removal — restore the dependency, re-render, and persist via API.
 * If the API call to restore fails, remove the line again and show an error toast.
 *
 * Req 8.4: Undo restores dependency, re-renders, persists restoration via API
 * Req 8.5: If API fails on undo-restore, remove the line again + show error toast
 *
 * @param {object} dependentChit - The dependent chit object
 * @param {string} restoredPrereqId - The prerequisite ID to restore
 */
async function _tlUndoPrereqRemoval(dependentChit, restoredPrereqId) {
  // Restore the prerequisite in the local data
  var currentPrereqs = dependentChit.prerequisites || [];
  if (typeof currentPrereqs === 'string') {
    try { currentPrereqs = JSON.parse(currentPrereqs); } catch (ex) { currentPrereqs = []; }
  }
  if (!Array.isArray(currentPrereqs)) currentPrereqs = [];

  // Add back the removed prereq (avoid duplicates)
  if (currentPrereqs.indexOf(restoredPrereqId) === -1) {
    currentPrereqs.push(restoredPrereqId);
  }
  dependentChit.prerequisites = currentPrereqs;

  // Re-render immediately to show the restored line
  _tlRender(_tlCurrentChits);

  // Persist the restoration via API
  try {
    var resp = await fetch('/api/chits/' + encodeURIComponent(dependentChit.id) + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: currentPrereqs })
    });

    if (!resp.ok) {
      console.error('[Timeline] Failed to persist dependency restoration:', resp.status);
      // Revert: remove the line again
      var revertPrereqs = currentPrereqs.filter(function(id) { return id !== restoredPrereqId; });
      dependentChit.prerequisites = revertPrereqs;
      _tlRender(_tlCurrentChits);
      cwocToast('Failed to restore dependency.', 'error');
    }
  } catch (err) {
    console.error('[Timeline] Exception persisting dependency restoration:', err);
    // Revert: remove the line again
    var revertPrereqs = currentPrereqs.filter(function(id) { return id !== restoredPrereqId; });
    dependentChit.prerequisites = revertPrereqs;
    _tlRender(_tlCurrentChits);
    cwocToast('Failed to restore dependency.', 'error');
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Drag-to-Link Dependency Creation (Req 5.1–5.5, 17.4) ────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Drag-to-link state.
 * @type {{active: boolean, sourceId: string|null, sourceNode: HTMLElement|null, startX: number, startY: number, thresholdMet: boolean, connectorSvg: SVGElement|null}}
 */
var _tlLinkDragState = {
  active: false,
  sourceId: null,
  sourceNode: null,
  startX: 0,
  startY: 0,
  thresholdMet: false,
  connectorSvg: null
};

/**
 * Attach drag-to-link event listeners to a timeline node.
 * Uses mousedown/touchstart to initiate, with document-level move/end handlers.
 *
 * @param {HTMLElement} node - The timeline node DOM element
 */
function _tlAttachDragToLinkListeners(node) {
  node.addEventListener('mousedown', _tlOnNodeDragStart);
  node.addEventListener('touchstart', _tlOnNodeDragStartTouch, { passive: false });
}

/**
 * Begin drag-to-link on mousedown on a node.
 * Records the start position; the actual drag visual only appears after 5px threshold.
 *
 * @param {MouseEvent} e - The mousedown event
 */
function _tlOnNodeDragStart(e) {
  // Only left mouse button
  if (e.button !== 0) return;

  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  // Don't start drag if in link mode (link mode uses click, not drag)
  if (_tlLinkMode) return;

  _tlLinkDragState.active = true;
  _tlLinkDragState.sourceId = chitId;
  _tlLinkDragState.sourceNode = node;
  _tlLinkDragState.startX = e.clientX;
  _tlLinkDragState.startY = e.clientY;
  _tlLinkDragState.thresholdMet = false;
  _tlLinkDragState.connectorSvg = null;

  // Attach document-level listeners for move/end
  document.addEventListener('mousemove', _tlOnNodeDragMove);
  document.addEventListener('mouseup', _tlOnNodeDragEnd);

  // Prevent text selection during drag
  e.preventDefault();
}

/**
 * Begin drag-to-link on touchstart on a node.
 * Touch equivalent of _tlOnNodeDragStart.
 *
 * @param {TouchEvent} e - The touchstart event
 */
function _tlOnNodeDragStartTouch(e) {
  if (e.touches.length !== 1) return;

  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  if (_tlLinkMode) return;

  var touch = e.touches[0];

  _tlLinkDragState.active = true;
  _tlLinkDragState.sourceId = chitId;
  _tlLinkDragState.sourceNode = node;
  _tlLinkDragState.startX = touch.clientX;
  _tlLinkDragState.startY = touch.clientY;
  _tlLinkDragState.thresholdMet = false;
  _tlLinkDragState.connectorSvg = null;

  document.addEventListener('touchmove', _tlOnNodeDragMoveTouch, { passive: false });
  document.addEventListener('touchend', _tlOnNodeDragEndTouch);
  document.addEventListener('touchcancel', _tlOnNodeDragEndTouch);
}

/**
 * Update connector line position during drag-to-link (mousemove).
 * Shows a dashed SVG line from the source node center to the current pointer position.
 * Only activates after the 5px drag threshold is exceeded (Req 17.4).
 *
 * @param {MouseEvent} e - The mousemove event
 */
function _tlOnNodeDragMove(e) {
  if (!_tlLinkDragState.active) return;

  var dx = e.clientX - _tlLinkDragState.startX;
  var dy = e.clientY - _tlLinkDragState.startY;

  // Check 5px threshold (Req 17.4: distinguish click from drag)
  if (!_tlLinkDragState.thresholdMet) {
    if (Math.abs(dx) <= _TL_DRAG_THRESHOLD && Math.abs(dy) <= _TL_DRAG_THRESHOLD) {
      return; // Haven't exceeded threshold yet
    }
    _tlLinkDragState.thresholdMet = true;
    // Create the visual connector SVG
    _tlCreateDragConnector();
  }

  // Update connector line endpoint to current pointer position
  _tlUpdateDragConnector(e.clientX, e.clientY);
}

/**
 * Update connector line position during drag-to-link (touchmove).
 *
 * @param {TouchEvent} e - The touchmove event
 */
function _tlOnNodeDragMoveTouch(e) {
  if (!_tlLinkDragState.active || e.touches.length !== 1) return;

  var touch = e.touches[0];
  var dx = touch.clientX - _tlLinkDragState.startX;
  var dy = touch.clientY - _tlLinkDragState.startY;

  if (!_tlLinkDragState.thresholdMet) {
    if (Math.abs(dx) <= _TL_DRAG_THRESHOLD && Math.abs(dy) <= _TL_DRAG_THRESHOLD) {
      return;
    }
    _tlLinkDragState.thresholdMet = true;
    _tlCreateDragConnector();
  }

  e.preventDefault(); // Prevent scrolling while dragging
  _tlUpdateDragConnector(touch.clientX, touch.clientY);
}

/**
 * End drag-to-link on mouseup.
 * If dropped on another node: validate and create dependency.
 * If dropped on empty space: cancel (it was a pan or click).
 *
 * @param {MouseEvent} e - The mouseup event
 */
function _tlOnNodeDragEnd(e) {
  document.removeEventListener('mousemove', _tlOnNodeDragMove);
  document.removeEventListener('mouseup', _tlOnNodeDragEnd);

  if (!_tlLinkDragState.active) return;

  var thresholdWasMet = _tlLinkDragState.thresholdMet;

  // Remove the visual connector
  _tlRemoveDragConnector();

  // If threshold wasn't met, this was a click — let the click handler fire
  if (!thresholdWasMet) {
    _tlLinkDragState.active = false;
    return;
  }

  // Mark that a drag just ended so the click handler doesn't fire
  if (_tlLinkDragState.sourceNode) {
    _tlLinkDragState.sourceNode._tlDragJustEnded = true;
  }

  // Find the target node under the pointer
  var targetNode = _tlFindNodeAtPoint(e.clientX, e.clientY);
  var sourceId = _tlLinkDragState.sourceId;

  _tlLinkDragState.active = false;

  if (targetNode && targetNode.dataset.chitId) {
    var targetId = targetNode.dataset.chitId;
    _tlAttemptCreateDependency(sourceId, targetId);
  }
}

/**
 * End drag-to-link on touchend.
 *
 * @param {TouchEvent} e - The touchend event
 */
function _tlOnNodeDragEndTouch(e) {
  document.removeEventListener('touchmove', _tlOnNodeDragMoveTouch);
  document.removeEventListener('touchend', _tlOnNodeDragEndTouch);
  document.removeEventListener('touchcancel', _tlOnNodeDragEndTouch);

  if (!_tlLinkDragState.active) return;

  var thresholdWasMet = _tlLinkDragState.thresholdMet;

  _tlRemoveDragConnector();

  if (!thresholdWasMet) {
    _tlLinkDragState.active = false;
    return;
  }

  if (_tlLinkDragState.sourceNode) {
    _tlLinkDragState.sourceNode._tlDragJustEnded = true;
  }

  // Use the last known touch position (changedTouches has the final position)
  var touch = e.changedTouches && e.changedTouches[0];
  var targetNode = touch ? _tlFindNodeAtPoint(touch.clientX, touch.clientY) : null;
  var sourceId = _tlLinkDragState.sourceId;

  _tlLinkDragState.active = false;

  if (targetNode && targetNode.dataset.chitId) {
    var targetId = targetNode.dataset.chitId;
    _tlAttemptCreateDependency(sourceId, targetId);
  }
}

/**
 * Create the visual drag connector SVG element.
 * Positioned absolutely over the canvas, shows a dashed line from source node
 * center to the current pointer position.
 */
function _tlCreateDragConnector() {
  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Highlight source node as the prerequisite
  var sourceNode = _tlLinkDragState.sourceNode;
  if (sourceNode) {
    sourceNode.classList.add('tl-drag-source');
    sourceNode.style.outline = '3px solid #d4af37';
    sourceNode.style.outlineOffset = '2px';
  }

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tl-drag-connector');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.overflow = 'visible';

  // Arrow marker for direction indication
  var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  var marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'tl-drag-arrow');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '4');
  marker.setAttribute('orient', 'auto');
  var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', 'M 0 0 L 8 4 L 0 8 Z');
  arrow.setAttribute('fill', '#4a2c2a');
  marker.appendChild(arrow);
  defs.appendChild(marker);
  svg.appendChild(defs);

  var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0');
  line.setAttribute('y2', '0');
  line.setAttribute('marker-end', 'url(#tl-drag-arrow)');
  svg.appendChild(line);

  canvas.appendChild(svg);
  _tlLinkDragState.connectorSvg = svg;
}

/**
 * Update the drag connector line endpoint to follow the pointer.
 * Converts client coordinates to canvas-relative coordinates accounting for
 * scroll position and zoom transform.
 *
 * @param {number} clientX - Pointer X in viewport coordinates
 * @param {number} clientY - Pointer Y in viewport coordinates
 */
function _tlUpdateDragConnector(clientX, clientY) {
  var svg = _tlLinkDragState.connectorSvg;
  if (!svg) return;

  var line = svg.querySelector('line');
  if (!line) return;

  var canvas = document.getElementById('tl-canvas');
  var viewport = document.getElementById('tl-viewport');
  if (!canvas || !viewport) return;

  // Get the source node center in canvas coordinates
  var sourceNode = _tlLinkDragState.sourceNode;
  if (!sourceNode) return;

  var nodeWidth = 180;
  var nodeHeight = 52;

  // Get source node position relative to canvas (using getBoundingClientRect for accuracy)
  var canvasRect = canvas.getBoundingClientRect();
  var sourceRect = sourceNode.getBoundingClientRect();
  var sourceX = (sourceRect.right - canvasRect.left) / _tlZoom;
  var sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / _tlZoom;

  // Convert pointer position from client to canvas coordinates
  var pointerX = (clientX - canvasRect.left) / _tlZoom;
  var pointerY = (clientY - canvasRect.top) / _tlZoom;

  line.setAttribute('x1', sourceX);
  line.setAttribute('y1', sourceY);
  line.setAttribute('x2', pointerX);
  line.setAttribute('y2', pointerY);
}

/**
 * Remove the drag connector SVG from the DOM.
 */
function _tlRemoveDragConnector() {
  if (_tlLinkDragState.connectorSvg) {
    _tlLinkDragState.connectorSvg.remove();
    _tlLinkDragState.connectorSvg = null;
  }
  // Remove source highlight
  var sourceNode = _tlLinkDragState.sourceNode;
  if (sourceNode) {
    sourceNode.classList.remove('tl-drag-source');
    sourceNode.style.outline = '';
    sourceNode.style.outlineOffset = '';
  }
}

/**
 * Find the timeline node element at a given client coordinate.
 * Uses document.elementsFromPoint to find nodes under the pointer.
 *
 * @param {number} clientX - X coordinate in viewport
 * @param {number} clientY - Y coordinate in viewport
 * @returns {HTMLElement|null} The timeline node element, or null
 */
function _tlFindNodeAtPoint(clientX, clientY) {
  var elements = document.elementsFromPoint(clientX, clientY);
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    // Check if this element is a timeline node or inside one
    var node = el.closest ? el.closest('.timeline-node') : null;
    if (node && node.dataset.chitId) {
      return node;
    }
  }
  return null;
}

/**
 * Attempt to create a dependency: source becomes a prerequisite of target.
 * Validates: no self-link, no duplicate, no cycle.
 * On success: persists via PUT /api/chits/{targetId} and re-renders.
 * On failure: shows appropriate toast message.
 *
 * @param {string} sourceId - The prerequisite chit ID (dragged from)
 * @param {string} targetId - The dependent chit ID (dropped onto)
 */
async function _tlAttemptCreateDependency(sourceId, targetId) {
  // Block self-links (Req 5.2)
  if (sourceId === targetId) {
    cwocToast('Cannot link a task to itself.', 'error');
    return;
  }

  // Block duplicates (Req 5.3)
  var existingPrereqs = _tlGraph.reverse.get(targetId) || [];
  for (var i = 0; i < existingPrereqs.length; i++) {
    if (existingPrereqs[i] === sourceId) {
      cwocToast('This dependency already exists.', 'info');
      return;
    }
  }

  // Block cycles (Req 5.2) — check if adding sourceId→targetId would create a cycle
  if (_tlWouldCycle(sourceId, targetId, _tlGraph.forward)) {
    cwocToast('Cannot link: would create a circular dependency.', 'error');
    return;
  }

  // Persist via API: add sourceId to target's prerequisites array
  try {
    // Use the local cached chit data (already have it in _tlCurrentChits)
    var targetChit = _tlFindChitById(targetId);
    if (!targetChit) {
      cwocToast('Failed to save dependency. Please try again.', 'error');
      return;
    }

    // Build updated prerequisites array
    var prereqs = targetChit.prerequisites || [];
    if (typeof prereqs === 'string') {
      try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
    }
    if (!Array.isArray(prereqs)) prereqs = [];
    var oldPrereqs = prereqs.slice(); // Save for undo

    // Double-check duplicate (in case of race condition)
    if (prereqs.indexOf(sourceId) !== -1) {
      cwocToast('This dependency already exists.', 'info');
      return;
    }

    prereqs.push(sourceId);

    // Fetch fresh chit from API to avoid overwriting other fields with stale data
    var freshResp = await fetch('/api/chit/' + targetId);
    if (!freshResp.ok) {
      var freshErr = await freshResp.text().catch(function() { return '(no body)'; });
      console.error('[Timeline] GET /api/chits/' + targetId + ' failed:', freshResp.status, freshErr);
      cwocToast('Failed to save dependency: could not fetch chit (' + freshResp.status + ')', 'error');
      return;
    }
    var freshChit = await freshResp.json();

    console.log('[Timeline] Saving dependency: source=' + sourceId + ' target=' + targetId + ' prereqs=', prereqs);

    var putResp = await fetch('/api/chits/' + targetId + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: prereqs })
    });

    if (!putResp.ok) {
      var putErr = await putResp.text().catch(function() { return '(no body)'; });
      console.error('[Timeline] PUT /api/chits/' + targetId + ' failed:', putResp.status, putErr);
      cwocToast('Failed to save dependency (' + putResp.status + '): ' + putErr.substring(0, 100), 'error');
      return;
    }

    // Success — update local state and re-render (Req 5.4)
    // Update the cached chit in _tlCurrentChits
    targetChit.prerequisites = prereqs;

    // Push to undo stack
    _tlPushUndo({ chitId: targetId, oldPrereqs: oldPrereqs, newPrereqs: prereqs.slice() });

    // Re-render to show the new dependency line
    _tlRender(_tlCurrentChits);

  } catch (e) {
    // API failure — log full details
    console.error('[Timeline] Failed to create dependency:', e);
    console.error('[Timeline] Details: sourceId=' + sourceId + ' targetId=' + targetId);
    console.error('[Timeline] Stack:', e.stack || '(no stack)');
    cwocToast('Failed to save dependency: ' + (e.message || e), 'error');
    _tlRender(_tlCurrentChits);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Canvas Click-to-Create (Req 17.1–17.4, 20.1–20.4) ───────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Handle a click on empty canvas space to create a new chit.
 * Called from _tlOnViewportDragEnd when the pointer did NOT exceed the 5px
 * drag threshold (i.e., it was a click, not a pan gesture).
 *
 * Behavior:
 *   - Click on empty space in the dated lane near a date marker →
 *     navigate to /editor?date=YYYY-MM-DD (start_datetime pre-filled)
 *   - Click on empty space in the undated lane →
 *     navigate to /editor (no date pre-filled)
 *   - Does NOT fire if clicking on a node (nodes have their own click handler)
 *   - Does NOT fire if clicking on a toolbar element or SVG path
 *   - Does NOT fire if Link Mode is active (Link Mode uses clicks for linking)
 *
 * Req 17.1: Click in dated lane → editor with date pre-filled
 * Req 17.2: Click in undated lane → editor with no date
 * Req 17.3: On return, re-render shows new chit (handled by page reload → displayChits)
 * Req 17.4: Distinguish click (≤5px) from drag (handled by caller)
 *
 * @param {MouseEvent} e - The mouseup event that was determined to be a click
 */
function _tlOnCanvasClick(e) {
  // Don't create chits while Link Mode is active
  if (_tlLinkMode) return;

  // Don't fire if clicking on a node, toolbar, button, or SVG path
  var target = e.target;
  if (target.closest && (
    target.closest('.timeline-node') ||
    target.closest('.timeline-toolbar') ||
    target.tagName === 'path' ||
    target.tagName === 'BUTTON'
  )) {
    return;
  }

  // Determine which lane was clicked
  var datedLane = document.getElementById('tl-dated-lane');
  var undatedLane = document.getElementById('tl-undated-lane');

  if (!datedLane && !undatedLane) return;

  // Check if the click target is within the dated lane or undated lane
  var inDatedLane = datedLane && (target === datedLane || datedLane.contains(target));
  var inUndatedLane = undatedLane && (target === undatedLane || undatedLane.contains(target));

  // If not in either lane (e.g., clicked on the divider or canvas padding), check by Y position
  if (!inDatedLane && !inUndatedLane) {
    var canvas = document.getElementById('tl-canvas');
    if (!canvas) return;

    var canvasRect = canvas.getBoundingClientRect();
    var clickY = (e.clientY - canvasRect.top) / _tlZoom;

    // Determine lane by comparing click Y to lane boundaries
    if (datedLane) {
      var datedRect = datedLane.getBoundingClientRect();
      var datedTop = (datedRect.top - canvasRect.top) / _tlZoom;
      var datedBottom = (datedRect.bottom - canvasRect.top) / _tlZoom;
      if (clickY >= datedTop && clickY <= datedBottom) {
        inDatedLane = true;
      }
    }
    if (!inDatedLane && undatedLane) {
      var undatedRect = undatedLane.getBoundingClientRect();
      var undatedTop = (undatedRect.top - canvasRect.top) / _tlZoom;
      var undatedBottom = (undatedRect.bottom - canvasRect.top) / _tlZoom;
      if (clickY >= undatedTop && clickY <= undatedBottom) {
        inUndatedLane = true;
      }
    }
  }

  if (inDatedLane) {
    // Find the nearest date marker to the click X position
    var nearestDate = _tlFindNearestDateAtClick(e);
    if (nearestDate) {
      // Navigate to editor with start date pre-filled (Req 17.1)
      // The editor uses ?start= param to pre-populate start_datetime
      window.location.href = '/editor?start=' + encodeURIComponent(nearestDate + 'T00:00:00') + '&allday=1&from=' + encodeURIComponent(window.location.pathname + window.location.hash);
    } else {
      // Clicked in dated lane but no date markers exist — navigate without date
      window.location.href = '/editor?from=' + encodeURIComponent(window.location.pathname + window.location.hash);
    }
  } else if (inUndatedLane) {
    // Navigate to editor with no date pre-filled (Req 17.2)
    window.location.href = '/editor?from=' + encodeURIComponent(window.location.pathname + window.location.hash);
  }
  // If neither lane was identified, do nothing (clicked on divider or outside lanes)
}

/**
 * Find the nearest date marker to the click position within the dated lane.
 * Compares the click's X coordinate (in canvas space) to the X positions of
 * all rendered date markers and returns the date string of the closest one.
 *
 * @param {MouseEvent} e - The click event
 * @returns {string|null} The date string (YYYY-MM-DD) of the nearest marker, or null if none exist
 */
function _tlFindNearestDateAtClick(e) {
  var datedLane = document.getElementById('tl-dated-lane');
  if (!datedLane) return null;

  var markers = datedLane.querySelectorAll('.tl-date-marker');
  if (!markers || markers.length === 0) return null;

  // Get click X in canvas coordinates
  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return null;

  var canvasRect = canvas.getBoundingClientRect();
  var clickX = (e.clientX - canvasRect.left) / _tlZoom;

  // Collect sorted dates from the layout (same logic as _tlRenderDateMarkers)
  var dateSet = new Map();
  for (var i = 0; i < _tlCurrentChits.length; i++) {
    if (_tlChitHasDate(_tlCurrentChits[i])) {
      var dateStr = _tlGetEffectiveDate(_tlCurrentChits[i]);
      if (dateStr) dateSet.set(dateStr, true);
    }
  }
  var sortedDates = Array.from(dateSet.keys()).sort();

  if (sortedDates.length === 0) return null;

  // Date markers are positioned at markerSpacing * (idx + 1)
  // Use the same spacing as the layout
  var viewport = document.getElementById('tl-viewport');
  var markerSpacing = 200; // default from _tlRender opts

  // Find the nearest marker by X distance
  var nearestDate = null;
  var nearestDist = Infinity;

  for (var idx = 0; idx < sortedDates.length; idx++) {
    var markerX = markerSpacing * (idx + 1);
    var dist = Math.abs(clickX - markerX);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestDate = sortedDates[idx];
    }
  }

  return nearestDate;
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Multi-Select and Bulk Linking (Req 9.1–9.4) ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/** @type {Set<string>} Currently selected node IDs */
var _tlSelectedNodes = new Set();

/** @type {{active: boolean, startX: number, startY: number, rectEl: HTMLElement|null}} Rect-select state */
var _tlRectSelectState = { active: false, startX: 0, startY: 0, rectEl: null };

/** @type {HTMLElement|null} Floating "Link as chain" action button */
var _tlChainActionBtn = null;


/**
 * Begin rectangle selection on Shift+mousedown on empty space.
 * Creates a selection rectangle element and attaches move/end listeners.
 *
 * Req 9.1: Drag-select on empty space draws selection rectangle
 *
 * @param {MouseEvent} e - The mousedown event (with shiftKey === true)
 */
function _tlOnRectSelectStart(e) {
  e.preventDefault();

  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Convert client coordinates to canvas-relative coordinates (accounting for zoom + scroll)
  var canvasRect = canvas.getBoundingClientRect();
  var startX = (e.clientX - canvasRect.left) / _tlZoom;
  var startY = (e.clientY - canvasRect.top) / _tlZoom;

  _tlRectSelectState.active = true;
  _tlRectSelectState.startX = startX;
  _tlRectSelectState.startY = startY;

  // Create the selection rectangle element
  var rect = document.createElement('div');
  rect.className = 'tl-selection-rect';
  rect.style.left = startX + 'px';
  rect.style.top = startY + 'px';
  rect.style.width = '0px';
  rect.style.height = '0px';
  canvas.appendChild(rect);
  _tlRectSelectState.rectEl = rect;

  // Clear previous selection
  _tlClearSelection();

  // Attach document-level move/end listeners
  document.addEventListener('mousemove', _tlOnRectSelectMove);
  document.addEventListener('mouseup', _tlOnRectSelectEnd);
}


/**
 * Update the selection rectangle dimensions during Shift+drag.
 * The rectangle grows/shrinks to follow the pointer.
 *
 * @param {MouseEvent} e - The mousemove event
 */
function _tlOnRectSelectMove(e) {
  if (!_tlRectSelectState.active || !_tlRectSelectState.rectEl) return;

  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Convert current pointer to canvas-relative coordinates
  var canvasRect = canvas.getBoundingClientRect();
  var currentX = (e.clientX - canvasRect.left) / _tlZoom;
  var currentY = (e.clientY - canvasRect.top) / _tlZoom;

  // Compute rectangle bounds (handle dragging in any direction)
  var x = Math.min(_tlRectSelectState.startX, currentX);
  var y = Math.min(_tlRectSelectState.startY, currentY);
  var w = Math.abs(currentX - _tlRectSelectState.startX);
  var h = Math.abs(currentY - _tlRectSelectState.startY);

  var rect = _tlRectSelectState.rectEl;
  rect.style.left = x + 'px';
  rect.style.top = y + 'px';
  rect.style.width = w + 'px';
  rect.style.height = h + 'px';
}


/**
 * End rectangle selection on mouseup.
 * Determines which nodes fall within the rectangle, selects them,
 * and shows the "Link as chain" action if 2+ nodes are selected.
 *
 * Req 9.1: Select all nodes whose center falls within rectangle boundary
 *
 * @param {MouseEvent} e - The mouseup event
 */
function _tlOnRectSelectEnd(e) {
  document.removeEventListener('mousemove', _tlOnRectSelectMove);
  document.removeEventListener('mouseup', _tlOnRectSelectEnd);

  if (!_tlRectSelectState.active || !_tlRectSelectState.rectEl) {
    _tlRectSelectState.active = false;
    return;
  }

  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Get the final rectangle bounds
  var rect = _tlRectSelectState.rectEl;
  var rectLeft = parseFloat(rect.style.left);
  var rectTop = parseFloat(rect.style.top);
  var rectWidth = parseFloat(rect.style.width);
  var rectHeight = parseFloat(rect.style.height);
  var rectRight = rectLeft + rectWidth;
  var rectBottom = rectTop + rectHeight;

  // Remove the selection rectangle element
  rect.remove();
  _tlRectSelectState.rectEl = null;
  _tlRectSelectState.active = false;

  // If the rectangle is too small (less than 5px in either dimension), treat as a click
  if (rectWidth < 5 && rectHeight < 5) return;

  // Find all nodes whose center falls within the rectangle
  var nodeWidth = 180;
  var nodeHeight = 52;

  _tlPositions.forEach(function(pos, chitId) {
    var centerX = pos.x + nodeWidth / 2;
    var centerY = pos.y + nodeHeight / 2;

    if (centerX >= rectLeft && centerX <= rectRight &&
        centerY >= rectTop && centerY <= rectBottom) {
      _tlSelectedNodes.add(chitId);
    }
  });

  // Apply .selected class to selected nodes
  _tlApplySelectionClasses();

  // Show "Link as chain" action if 2+ nodes selected
  if (_tlSelectedNodes.size >= 2) {
    _tlShowChainAction();
  }
}


/**
 * Apply the .selected CSS class to all currently selected nodes.
 * Removes .selected from any previously selected nodes that are no longer in the set.
 */
function _tlApplySelectionClasses() {
  if (!_tlContainer) return;

  var allNodes = _tlContainer.querySelectorAll('.timeline-node');
  for (var i = 0; i < allNodes.length; i++) {
    var node = allNodes[i];
    var chitId = node.dataset.chitId;
    if (chitId && _tlSelectedNodes.has(chitId)) {
      node.classList.add('selected');
    } else {
      node.classList.remove('selected');
    }
  }
}


/**
 * Clear the current multi-selection — remove .selected class from all nodes,
 * clear the selected set, and remove the chain action button.
 */
function _tlClearSelection() {
  _tlSelectedNodes.clear();

  if (_tlContainer) {
    var selectedNodes = _tlContainer.querySelectorAll('.timeline-node.selected');
    for (var i = 0; i < selectedNodes.length; i++) {
      selectedNodes[i].classList.remove('selected');
    }
  }

  _tlHideChainAction();
}


/**
 * Show the floating "Link as chain" action button near the selection.
 * Positioned at the average center of selected nodes.
 */
function _tlShowChainAction() {
  _tlHideChainAction(); // Remove any existing button

  var canvas = document.getElementById('tl-canvas');
  if (!canvas) return;

  // Compute average position of selected nodes for button placement
  var sumX = 0;
  var sumY = 0;
  var count = 0;
  var minY = Infinity;

  _tlSelectedNodes.forEach(function(chitId) {
    var pos = _tlPositions.get(chitId);
    if (pos) {
      sumX += pos.x;
      sumY += pos.y;
      if (pos.y < minY) minY = pos.y;
      count++;
    }
  });

  if (count === 0) return;

  var avgX = sumX / count;

  // Position the button above the topmost selected node
  var btnX = avgX;
  var btnY = minY - 40;
  if (btnY < 5) btnY = 5;

  var btn = document.createElement('button');
  btn.className = 'action-button tl-chain-action-btn';
  btn.textContent = '🔗 Link as chain';
  btn.style.position = 'absolute';
  btn.style.left = btnX + 'px';
  btn.style.top = btnY + 'px';
  btn.style.zIndex = '100';
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlLinkAsChain();
  });

  canvas.appendChild(btn);
  _tlChainActionBtn = btn;
}


/**
 * Hide/remove the floating "Link as chain" action button.
 */
function _tlHideChainAction() {
  if (_tlChainActionBtn) {
    _tlChainActionBtn.remove();
    _tlChainActionBtn = null;
  }
}


/**
 * "Link as chain" action — creates sequential dependencies among 2+ selected nodes.
 *
 * Req 9.2: Order by ascending horizontal position (vertical as tiebreaker via _tlChainOrder)
 * Req 9.3: Block entire operation if it would create a cycle, toast with cycle info
 * Req 9.4: Preserve existing non-conflicting edges, add only missing sequential links
 *
 * Steps:
 *   1. Gather selected nodes with their positions
 *   2. Sort via _tlChainOrder (ascending x, then y as tiebreaker)
 *   3. For each sequential pair (A→B): check if link already exists (skip if so)
 *   4. Before adding any links: check if ANY new link would create a cycle (block entire op)
 *   5. Persist all new links via API, then re-render
 *   6. Clear selection after completion
 */
async function _tlLinkAsChain() {
  if (_tlSelectedNodes.size < 2) {
    cwocToast('Select at least 2 nodes to link as a chain.', 'info');
    return;
  }

  // 1. Gather selected nodes with their positions
  var nodesWithPos = [];
  _tlSelectedNodes.forEach(function(chitId) {
    var pos = _tlPositions.get(chitId);
    if (pos) {
      nodesWithPos.push({ id: chitId, x: pos.x, y: pos.y });
    }
  });

  if (nodesWithPos.length < 2) {
    cwocToast('Select at least 2 nodes to link as a chain.', 'info');
    return;
  }

  // 2. Sort via _tlChainOrder (ascending x, then y as tiebreaker)
  var ordered = _tlChainOrder(nodesWithPos);

  // 3. Determine which sequential links are missing
  var newLinks = []; // Array of { fromId, toId }

  for (var i = 0; i < ordered.length - 1; i++) {
    var fromId = ordered[i].id;
    var toId = ordered[i + 1].id;

    // Check if this link already exists (fromId is already a prerequisite of toId)
    var toChit = _tlFindChitById(toId);
    if (toChit) {
      var existingPrereqs = toChit.prerequisites || [];
      if (typeof existingPrereqs === 'string') {
        try { existingPrereqs = JSON.parse(existingPrereqs); } catch (ex) { existingPrereqs = []; }
      }
      if (!Array.isArray(existingPrereqs)) existingPrereqs = [];

      if (existingPrereqs.indexOf(fromId) !== -1) {
        // Link already exists — skip (Req 9.4: preserve existing)
        continue;
      }
    }

    newLinks.push({ fromId: fromId, toId: toId });
  }

  // If no new links needed, we're done
  if (newLinks.length === 0) {
    cwocToast('All chain links already exist.', 'info');
    _tlClearSelection();
    return;
  }

  // 4. Check if ANY new link would create a cycle (block entire operation)
  // Build a temporary forward adjacency list with all proposed new links added
  var tempForward = new Map();
  _tlGraph.forward.forEach(function(deps, key) {
    tempForward.set(key, deps.slice());
  });

  for (var i = 0; i < newLinks.length; i++) {
    var link = newLinks[i];

    // Check cycle using the progressively-updated temp graph
    if (_tlWouldCycle(link.fromId, link.toId, tempForward)) {
      // Req 9.3: Block entire operation, toast with cycle info
      var fromChit = _tlFindChitById(link.fromId);
      var toChit2 = _tlFindChitById(link.toId);
      var fromName = (fromChit && fromChit.title) ? fromChit.title : link.fromId;
      var toName = (toChit2 && toChit2.title) ? toChit2.title : link.toId;
      cwocToast('Cannot link as chain: linking "' + fromName + '" → "' + toName + '" would create a circular dependency.', 'error');
      _tlClearSelection();
      return;
    }

    // Add this link to the temp graph for subsequent cycle checks
    if (!tempForward.has(link.fromId)) tempForward.set(link.fromId, []);
    tempForward.get(link.fromId).push(link.toId);
  }

  // 5. Persist all new links via API
  var allSucceeded = true;

  for (var i = 0; i < newLinks.length; i++) {
    var link = newLinks[i];
    var targetChit = _tlFindChitById(link.toId);
    if (!targetChit) continue;

    // Build updated prerequisites array
    var prereqs = targetChit.prerequisites || [];
    if (typeof prereqs === 'string') {
      try { prereqs = JSON.parse(prereqs); } catch (ex) { prereqs = []; }
    }
    if (!Array.isArray(prereqs)) prereqs = [];
    prereqs.push(link.fromId);

    // Update local state immediately
    targetChit.prerequisites = prereqs;

    // Persist via API
    try {
      var resp = await fetch('/api/chits/' + encodeURIComponent(link.toId) + '/fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prerequisites: prereqs })
      });

      if (!resp.ok) {
        console.error('[Timeline] Failed to persist chain link:', link.fromId, '→', link.toId, resp.status);
        allSucceeded = false;
      }
    } catch (err) {
      console.error('[Timeline] Exception persisting chain link:', err);
      allSucceeded = false;
    }
  }

  // 6. Re-render and clear selection
  _tlRender(_tlCurrentChits);
  _tlClearSelection();

  if (allSucceeded) {
    cwocToast('Chain linked ' + (newLinks.length) + ' new ' + (newLinks.length === 1 ? 'dependency' : 'dependencies') + '.', 'success');
  } else {
    cwocToast('Some chain links failed to save. Please check and retry.', 'error');
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Context Menu & Chit Picker (Req 6.1–6.5, 8.2–8.3, 8.5–8.6) ─────────────
// ══════════════════════════════════════════════════════════════════════════════

/** @type {HTMLElement|null} Currently visible context menu element */
var _tlContextMenu = null;

/** @type {number|null} Long-press timer ID for touch context menu */
var _tlLongPressTimer = null;

/** @type {string|null} Chit ID that the context menu was opened for */
var _tlContextTargetId = null;

/**
 * Show the context menu for a node at the given position.
 * Context menu options:
 *   - "Add prerequisite..." (always shown)
 *   - "Remove prerequisite" (only if node has prerequisites)
 *
 * Req 6.1: Right-click (desktop) / 500ms long-press (touch) shows context menu
 * Req 6.1: Dismisses when user clicks/taps outside
 *
 * @param {string} chitId - The chit ID to show the menu for
 * @param {number} x - Client X position for the menu
 * @param {number} y - Client Y position for the menu
 */
function _tlShowContextMenu(chitId, x, y) {
  // Dismiss any existing context menu first
  _tlDismissContextMenu();

  _tlContextTargetId = chitId;

  var chit = _tlFindChitById(chitId);
  if (!chit) return;

  // Determine if chit has prerequisites
  var prereqs = chit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];
  // Filter to only prereqs that are in the visible set
  var visibleIds = new Set();
  for (var i = 0; i < _tlCurrentChits.length; i++) {
    visibleIds.add(_tlCurrentChits[i].id);
  }
  var visiblePrereqs = prereqs.filter(function(id) { return visibleIds.has(id); });

  // Build context menu DOM
  var menu = document.createElement('div');
  menu.className = 'tl-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // "Add prerequisite..." option
  var addItem = document.createElement('div');
  addItem.className = 'tl-context-menu-item';
  addItem.textContent = 'Add prerequisite…';
  addItem.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlDismissContextMenu();
    _tlShowChitPicker(chitId);
  });
  menu.appendChild(addItem);

  // "Remove prerequisite" option (only if has prereqs)
  if (visiblePrereqs.length > 0) {
    var divider = document.createElement('div');
    divider.className = 'tl-context-menu-divider';
    menu.appendChild(divider);

    var removeItem = document.createElement('div');
    removeItem.className = 'tl-context-menu-item';
    removeItem.textContent = 'Remove prerequisite';
    removeItem.addEventListener('click', function(e) {
      e.stopPropagation();
      _tlDismissContextMenu();
      // If only one prereq, remove it directly without showing picker
      if (visiblePrereqs.length === 1) {
        var removeSet = new Set();
        removeSet.add(visiblePrereqs[0]);
        _tlConfirmRemovePrereqs(chitId, removeSet);
      } else {
        _tlShowRemovePrereqPicker(chitId);
      }
    });
    menu.appendChild(removeItem);
  }

  // Divider before edit options
  var editDivider = document.createElement('div');
  editDivider.className = 'tl-context-menu-divider';
  menu.appendChild(editDivider);

  // "Quick Edit" option
  var quickEditItem = document.createElement('div');
  quickEditItem.className = 'tl-context-menu-item';
  quickEditItem.textContent = '✏️ Quick Edit';
  quickEditItem.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlDismissContextMenu();
    if (typeof openQuickEdit === 'function') {
      openQuickEdit(chitId);
    }
  });
  menu.appendChild(quickEditItem);

  // "Edit Chit" option (full editor)
  var editItem = document.createElement('div');
  editItem.className = 'tl-context-menu-item';
  editItem.textContent = '📝 Edit Chit';
  editItem.addEventListener('click', function(e) {
    e.stopPropagation();
    _tlDismissContextMenu();
    window.location.href = '/editor?id=' + chitId;
  });
  menu.appendChild(editItem);

  document.body.appendChild(menu);
  _tlContextMenu = menu;

  // Ensure menu stays within viewport bounds
  var menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = (window.innerHeight - menuRect.height - 8) + 'px';
  }

  // Dismiss on click/tap outside (next tick to avoid immediate dismiss)
  setTimeout(function() {
    document.addEventListener('click', _tlOnDismissContextMenu);
    document.addEventListener('touchstart', _tlOnDismissContextMenu);
  }, 0);
}


/**
 * Dismiss the context menu and clean up listeners.
 */
function _tlDismissContextMenu() {
  if (_tlContextMenu) {
    _tlContextMenu.remove();
    _tlContextMenu = null;
  }
  _tlContextTargetId = null;
  document.removeEventListener('click', _tlOnDismissContextMenu);
  document.removeEventListener('touchstart', _tlOnDismissContextMenu);
}

/**
 * Handler for click/tap outside the context menu — dismisses it.
 * @param {Event} e - Click or touchstart event
 */
function _tlOnDismissContextMenu(e) {
  if (_tlContextMenu && !_tlContextMenu.contains(e.target)) {
    _tlDismissContextMenu();
  }
}

/**
 * Handle right-click (contextmenu event) on a timeline node.
 * Shows the context menu at the pointer position.
 *
 * @param {MouseEvent} e - The contextmenu event
 */
function _tlOnNodeContext(e) {
  e.preventDefault();
  e.stopPropagation();

  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  _tlShowContextMenu(chitId, e.clientX, e.clientY);
}

/**
 * Handle touchstart on a node — start a 500ms long-press timer.
 * If the touch is held for 500ms without moving, show the context menu.
 *
 * @param {TouchEvent} e - The touchstart event
 */
function _tlOnNodeLongPressStart(e) {
  if (e.touches.length !== 1) return;

  var node = e.currentTarget;
  var chitId = node.dataset.chitId;
  if (!chitId) return;

  var touch = e.touches[0];
  var startX = touch.clientX;
  var startY = touch.clientY;

  // Clear any existing timer
  _tlClearLongPressTimer();

  _tlLongPressTimer = setTimeout(function() {
    _tlLongPressTimer = null;
    // Show context menu at the touch position
    _tlShowContextMenu(chitId, startX, startY);
  }, 500);

  // Cancel on move (if finger moves more than 10px, it's not a long-press)
  var moveHandler = function(ev) {
    if (ev.touches.length !== 1) {
      _tlClearLongPressTimer();
      node.removeEventListener('touchmove', moveHandler);
      return;
    }
    var t = ev.touches[0];
    var dx = Math.abs(t.clientX - startX);
    var dy = Math.abs(t.clientY - startY);
    if (dx > 10 || dy > 10) {
      _tlClearLongPressTimer();
      node.removeEventListener('touchmove', moveHandler);
    }
  };

  node.addEventListener('touchmove', moveHandler, { passive: true });

  // Cancel on touchend (finger lifted before 500ms)
  var endHandler = function() {
    _tlClearLongPressTimer();
    node.removeEventListener('touchmove', moveHandler);
    node.removeEventListener('touchend', endHandler);
    node.removeEventListener('touchcancel', endHandler);
  };
  node.addEventListener('touchend', endHandler, { passive: true });
  node.addEventListener('touchcancel', endHandler, { passive: true });
}

/**
 * Clear the long-press timer if active.
 */
function _tlClearLongPressTimer() {
  if (_tlLongPressTimer) {
    clearTimeout(_tlLongPressTimer);
    _tlLongPressTimer = null;
  }
}


/**
 * Attach context menu listeners (right-click + long-press) to a timeline node.
 * Called during node creation in _tlBuildNodeHTML.
 *
 * @param {HTMLElement} node - The timeline node DOM element
 */
function _tlAttachContextMenuListeners(node) {
  // Desktop: right-click (contextmenu event)
  node.addEventListener('contextmenu', _tlOnNodeContext);

  // Touch: long-press (500ms touchstart timer)
  node.addEventListener('touchstart', _tlOnNodeLongPressStart, { passive: true });
}


// ── Chit Picker Modal (Req 6.2–6.5) ─────────────────────────────────────────

/**
 * Show the chit picker modal for adding prerequisites to a target chit.
 * Lists all chits except the target and its existing direct prerequisites.
 * Filterable by title via a search input at the top.
 *
 * Req 6.2: Searchable chit picker listing eligible chits, filterable by title
 * Req 6.3: On confirm, run cycle detection for each proposed link
 * Req 6.4: Skip blocked links, toast for 5s identifying source/target names
 * Req 6.5: Empty-state message if no eligible chits
 *
 * @param {string} targetChitId - The chit ID to add prerequisites to
 */
function _tlShowChitPicker(targetChitId) {
  var targetChit = _tlFindChitById(targetChitId);
  if (!targetChit) return;

  // Get existing prerequisites for the target
  var existingPrereqs = targetChit.prerequisites || [];
  if (typeof existingPrereqs === 'string') {
    try { existingPrereqs = JSON.parse(existingPrereqs); } catch (e) { existingPrereqs = []; }
  }
  if (!Array.isArray(existingPrereqs)) existingPrereqs = [];
  var existingSet = new Set(existingPrereqs);

  // Build list of eligible chits (all except target and its direct prereqs)
  var eligible = [];
  for (var i = 0; i < _tlCurrentChits.length; i++) {
    var c = _tlCurrentChits[i];
    if (c.id === targetChitId) continue;
    if (existingSet.has(c.id)) continue;
    eligible.push(c);
  }

  // Build modal overlay
  var overlay = document.createElement('div');
  overlay.className = 'cwoc-overlay';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  var modal = document.createElement('div');
  modal.className = 'tl-chit-picker-modal';
  modal.style.background = '#fffaf0';
  modal.style.border = '2px solid #6b4e31';
  modal.style.borderRadius = '8px';
  modal.style.padding = '20px';
  modal.style.width = '90%';
  modal.style.maxWidth = '420px';
  modal.style.maxHeight = '70vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.fontFamily = 'Lora, serif';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';

  // Title
  var title = document.createElement('h3');
  title.style.margin = '0 0 12px 0';
  title.style.color = '#3b1f0a';
  title.style.fontSize = '1.1rem';
  title.textContent = 'Add prerequisite to: ' + (targetChit.title || '(Untitled)');
  modal.appendChild(title);

  // Search input
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Filter by title…';
  searchInput.style.width = '100%';
  searchInput.style.padding = '8px 12px';
  searchInput.style.border = '1px solid #6b4e31';
  searchInput.style.borderRadius = '4px';
  searchInput.style.marginBottom = '12px';
  searchInput.style.fontFamily = 'Lora, serif';
  searchInput.style.fontSize = '0.95rem';
  searchInput.style.boxSizing = 'border-box';
  searchInput.style.background = '#fff';
  modal.appendChild(searchInput);

  // Chit list container (scrollable)
  var listContainer = document.createElement('div');
  listContainer.style.flex = '1';
  listContainer.style.overflowY = 'auto';
  listContainer.style.minHeight = '100px';
  listContainer.style.maxHeight = '40vh';
  listContainer.style.border = '1px solid rgba(107,78,49,0.2)';
  listContainer.style.borderRadius = '4px';
  listContainer.style.marginBottom = '12px';

  // Track selected chit IDs
  var selectedIds = new Set();

  // Render the chit list items
  function renderChitList(filterText) {
    listContainer.innerHTML = '';
    var filtered = eligible;
    if (filterText) {
      var lower = filterText.toLowerCase();
      filtered = eligible.filter(function(c) {
        return (c.title || '').toLowerCase().indexOf(lower) !== -1;
      });
    }

    // Req 6.5: Empty state if no eligible chits
    if (filtered.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '16px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = '#6b4e31';
      emptyMsg.style.fontStyle = 'italic';
      if (eligible.length === 0) {
        emptyMsg.textContent = 'No available prerequisites exist.';
      } else {
        emptyMsg.textContent = 'No chits match your filter.';
      }
      listContainer.appendChild(emptyMsg);
      return;
    }

    for (var i = 0; i < filtered.length; i++) {
      (function(chit) {
        var item = document.createElement('div');
        item.style.padding = '10px 12px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid rgba(107,78,49,0.1)';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '8px';

        if (selectedIds.has(chit.id)) {
          item.style.background = 'rgba(139, 90, 43, 0.12)';
        }

        var checkbox = document.createElement('span');
        checkbox.textContent = selectedIds.has(chit.id) ? '☑' : '☐';
        checkbox.style.fontSize = '1.1rem';
        item.appendChild(checkbox);

        var label = document.createElement('span');
        label.textContent = chit.title || '(Untitled)';
        label.style.color = '#3b1f0a';
        item.appendChild(label);

        item.addEventListener('click', function() {
          if (selectedIds.has(chit.id)) {
            selectedIds.delete(chit.id);
          } else {
            selectedIds.add(chit.id);
          }
          renderChitList(searchInput.value);
        });

        listContainer.appendChild(item);
      })(filtered[i]);
    }
  }

  renderChitList('');
  modal.appendChild(listContainer);

  // Filter on input
  searchInput.addEventListener('input', function() {
    renderChitList(searchInput.value);
  });

  // Button row
  var btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.gap = '10px';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', function() {
    overlay.remove();
  });
  btnRow.appendChild(cancelBtn);

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'action-button';
  confirmBtn.style.background = '#6b4e31';
  confirmBtn.style.color = '#fffaf0';
  confirmBtn.textContent = 'Add Selected';
  confirmBtn.addEventListener('click', function() {
    overlay.remove();
    _tlConfirmChitPickerSelections(targetChitId, selectedIds);
  });
  btnRow.appendChild(confirmBtn);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  // Dismiss on overlay click (outside modal)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // ESC to dismiss
  var escHandler = function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      overlay.remove();
      document.removeEventListener('keydown', escHandler, true);
    }
  };
  document.addEventListener('keydown', escHandler, true);

  document.body.appendChild(overlay);

  // Focus the search input
  setTimeout(function() { searchInput.focus(); }, 50);
}


/**
 * Process confirmed chit picker selections — run cycle detection for each
 * proposed link and add only valid ones. Toast for blocked ones (5s).
 *
 * Req 6.3: Run cycle detection for each proposed link, add only non-circular ones
 * Req 6.4: Toast for 5s identifying blocked link source/target names
 *
 * @param {string} targetChitId - The chit to add prerequisites to
 * @param {Set<string>} selectedIds - Set of selected prerequisite chit IDs
 */
async function _tlConfirmChitPickerSelections(targetChitId, selectedIds) {
  if (!selectedIds || selectedIds.size === 0) return;

  var targetChit = _tlFindChitById(targetChitId);
  if (!targetChit) return;

  // Get current prerequisites
  var prereqs = targetChit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];

  var validIds = [];
  var blockedLinks = [];

  // Check each selected ID for cycles
  selectedIds.forEach(function(selectedId) {
    // Skip if already a prerequisite (shouldn't happen but safety check)
    if (prereqs.indexOf(selectedId) !== -1) return;

    // Build a temporary forward adjacency that includes previously validated links
    var tempForward = new Map();
    _tlGraph.forward.forEach(function(deps, key) {
      tempForward.set(key, deps.slice());
    });
    // Add already-validated links to temp graph for accurate cycle detection
    for (var v = 0; v < validIds.length; v++) {
      if (!tempForward.has(validIds[v])) tempForward.set(validIds[v], []);
      tempForward.get(validIds[v]).push(targetChitId);
    }

    if (_tlWouldCycle(selectedId, targetChitId, tempForward)) {
      var sourceChit = _tlFindChitById(selectedId);
      blockedLinks.push({
        sourceName: (sourceChit && sourceChit.title) ? sourceChit.title : selectedId,
        targetName: (targetChit.title) ? targetChit.title : targetChitId
      });
    } else {
      validIds.push(selectedId);
    }
  });

  // Show toast for each blocked link (5 seconds per Req 6.4)
  for (var b = 0; b < blockedLinks.length; b++) {
    cwocToast('Cannot add "' + blockedLinks[b].sourceName + '" as prerequisite of "' + blockedLinks[b].targetName + '": would create a circular dependency.', 'error', 5000);
  }

  // If no valid links, we're done
  if (validIds.length === 0) return;

  // Add valid prerequisites
  for (var v = 0; v < validIds.length; v++) {
    prereqs.push(validIds[v]);
  }
  targetChit.prerequisites = prereqs;

  // Persist via API
  try {
    var resp = await fetch('/api/chits/' + encodeURIComponent(targetChitId) + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: prereqs })
    });

    if (!resp.ok) {
      throw new Error('API returned ' + resp.status);
    }

    // Re-render to show new dependency lines
    _tlRender(_tlCurrentChits);
    cwocToast('Added ' + validIds.length + ' prerequisite' + (validIds.length > 1 ? 's' : '') + '.', 'success');
  } catch (err) {
    console.error('[Timeline] Failed to persist prerequisites from chit picker:', err);
    // Revert local changes
    for (var v = 0; v < validIds.length; v++) {
      var idx = prereqs.indexOf(validIds[v]);
      if (idx !== -1) prereqs.splice(idx, 1);
    }
    targetChit.prerequisites = prereqs;
    _tlRender(_tlCurrentChits);
    cwocToast('Failed to save prerequisites. Please try again.', 'error');
  }
}


// ── Remove Prerequisite Picker (Req 8.2, 8.3, 8.5–8.6) ─────────────────────

/**
 * Show a modal listing the target chit's current prerequisites, allowing
 * the user to select which to remove.
 *
 * Req 8.2: Display list of current prereqs, allow selection for removal
 * Req 8.6: If no prerequisites exist, display message indicating none exist
 *
 * @param {string} targetChitId - The chit whose prerequisites to manage
 */
function _tlShowRemovePrereqPicker(targetChitId) {
  var targetChit = _tlFindChitById(targetChitId);
  if (!targetChit) return;

  // Get current prerequisites
  var prereqs = targetChit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];

  // Filter to visible chits only
  var visibleIds = new Set();
  for (var i = 0; i < _tlCurrentChits.length; i++) {
    visibleIds.add(_tlCurrentChits[i].id);
  }
  var visiblePrereqs = prereqs.filter(function(id) { return visibleIds.has(id); });

  // Req 8.6: If no prerequisites, show message
  if (visiblePrereqs.length === 0) {
    cwocToast('This task has no prerequisites to remove.', 'info');
    return;
  }

  // Build modal overlay
  var overlay = document.createElement('div');
  overlay.className = 'cwoc-overlay';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  var modal = document.createElement('div');
  modal.style.background = '#fffaf0';
  modal.style.border = '2px solid #6b4e31';
  modal.style.borderRadius = '8px';
  modal.style.padding = '20px';
  modal.style.width = '90%';
  modal.style.maxWidth = '380px';
  modal.style.maxHeight = '60vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.fontFamily = 'Lora, serif';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';

  // Title
  var title = document.createElement('h3');
  title.style.margin = '0 0 12px 0';
  title.style.color = '#3b1f0a';
  title.style.fontSize = '1.1rem';
  title.textContent = 'Remove prerequisites from: ' + (targetChit.title || '(Untitled)');
  modal.appendChild(title);

  // Prereq list
  var listContainer = document.createElement('div');
  listContainer.style.flex = '1';
  listContainer.style.overflowY = 'auto';
  listContainer.style.minHeight = '60px';
  listContainer.style.maxHeight = '35vh';
  listContainer.style.border = '1px solid rgba(107,78,49,0.2)';
  listContainer.style.borderRadius = '4px';
  listContainer.style.marginBottom = '12px';

  var selectedForRemoval = new Set();

  for (var i = 0; i < visiblePrereqs.length; i++) {
    (function(prereqId) {
      var prereqChit = _tlFindChitById(prereqId);
      var item = document.createElement('div');
      item.style.padding = '10px 12px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid rgba(107,78,49,0.1)';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';

      var checkbox = document.createElement('span');
      checkbox.textContent = '☐';
      checkbox.style.fontSize = '1.1rem';
      item.appendChild(checkbox);

      var label = document.createElement('span');
      label.textContent = (prereqChit && prereqChit.title) ? prereqChit.title : prereqId;
      label.style.color = '#3b1f0a';
      item.appendChild(label);

      item.addEventListener('click', function() {
        if (selectedForRemoval.has(prereqId)) {
          selectedForRemoval.delete(prereqId);
          checkbox.textContent = '☐';
          item.style.background = '';
        } else {
          selectedForRemoval.add(prereqId);
          checkbox.textContent = '☑';
          item.style.background = 'rgba(180, 60, 60, 0.1)';
        }
      });

      listContainer.appendChild(item);
    })(visiblePrereqs[i]);
  }

  modal.appendChild(listContainer);

  // Button row
  var btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.gap = '10px';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', function() {
    overlay.remove();
  });
  btnRow.appendChild(cancelBtn);

  var removeBtn = document.createElement('button');
  removeBtn.className = 'action-button';
  removeBtn.style.background = '#8b3a3a';
  removeBtn.style.color = '#fffaf0';
  removeBtn.textContent = 'Remove Selected';
  removeBtn.addEventListener('click', function() {
    overlay.remove();
    _tlConfirmRemovePrereqs(targetChitId, selectedForRemoval);
  });
  btnRow.appendChild(removeBtn);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  // Dismiss on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // ESC to dismiss
  var escHandler = function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      overlay.remove();
      document.removeEventListener('keydown', escHandler, true);
    }
  };
  document.addEventListener('keydown', escHandler, true);

  document.body.appendChild(overlay);
}

/**
 * Confirm removal of selected prerequisites — remove them from the chit's
 * prerequisites array, re-render, and show undo toast.
 *
 * Uses cwocUndoToast for removal (same pattern as line click-to-remove).
 *
 * @param {string} targetChitId - The chit to remove prerequisites from
 * @param {Set<string>} idsToRemove - Set of prerequisite IDs to remove
 */
function _tlConfirmRemovePrereqs(targetChitId, idsToRemove) {
  if (!idsToRemove || idsToRemove.size === 0) return;

  var targetChit = _tlFindChitById(targetChitId);
  if (!targetChit) return;

  // Get current prerequisites
  var prereqs = targetChit.prerequisites || [];
  if (typeof prereqs === 'string') {
    try { prereqs = JSON.parse(prereqs); } catch (e) { prereqs = []; }
  }
  if (!Array.isArray(prereqs)) prereqs = [];

  // Save original for undo
  var originalPrereqs = prereqs.slice();

  // Remove selected prerequisites
  var updatedPrereqs = prereqs.filter(function(id) { return !idsToRemove.has(id); });
  targetChit.prerequisites = updatedPrereqs;

  // Re-render immediately
  _tlRender(_tlCurrentChits);

  // Build names for toast message
  var removedNames = [];
  idsToRemove.forEach(function(id) {
    var c = _tlFindChitById(id);
    removedNames.push((c && c.title) ? c.title : id);
  });
  var toastMsg = '🔗 Removed ' + removedNames.length + ' prerequisite' + (removedNames.length > 1 ? 's' : '') + ' from "' + (targetChit.title || '(Untitled)') + '"';

  // Show undo toast with 5-second countdown
  cwocUndoToast(toastMsg, {
    duration: 5000,
    id: 'tl-prereq-remove-undo',
    onExpire: function() {
      // Persist the removal via API
      _tlPersistPrereqUpdate(targetChit, updatedPrereqs, originalPrereqs);
    },
    onUndo: function() {
      // Restore original prerequisites
      targetChit.prerequisites = originalPrereqs;
      _tlRender(_tlCurrentChits);
      // Persist the restoration
      _tlPersistPrereqUpdate(targetChit, originalPrereqs, updatedPrereqs);
    }
  });
}

/**
 * Persist a prerequisite array update via PUT /api/chits/{id}.
 * On failure, reverts to the fallback array and re-renders.
 *
 * @param {object} chit - The chit object to update
 * @param {Array} newPrereqs - The new prerequisites array to persist
 * @param {Array} fallbackPrereqs - The array to revert to on failure
 */
async function _tlPersistPrereqUpdate(chit, newPrereqs, fallbackPrereqs) {
  try {
    var resp = await fetch('/api/chits/' + encodeURIComponent(chit.id) + '/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: newPrereqs })
    });

    if (!resp.ok) {
      throw new Error('API returned ' + resp.status);
    }
  } catch (err) {
    console.error('[Timeline] Failed to persist prerequisite update:', err);
    chit.prerequisites = fallbackPrereqs;
    _tlRender(_tlCurrentChits);
    cwocToast('Failed to save changes. Please try again.', 'error');
  }
}
