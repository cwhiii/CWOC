/**
 * main-views-indicators.js — Health Indicators trend charts view.
 *
 * Contains:
 *   - displayIndicatorsView (SVG line charts for health data)
 *   - _indInitViewMode, _indBuildModeToggleHtml, _indAttachModeToggleListener (mode toggle)
 *   - _indicatorsLoad (fetch + render charts)
 *   - _indicatorsSetRange, _indicatorsHighlightBtn, _indicatorsLoadCustomRange
 *   - _indToggleExpand (expand/collapse single chart)
 *   - _enableIndicatorsDragReorder, _restoreIndicatorsOrder
 *   - _indSaveSelection, _indRestoreSelection, _indFmtDate
 *   - _indPopulateGraphFilter, _indRestoreOneOffGraphs, _indShowAddGraphPicker, _indAddOneOffGraph
 *   - _indicatorsRenderCalendar (year-view calendar grid)
 *   - _classifyDayColor (day color classification for calendar)
 *   - _indicatorsRenderLog (reverse-chronological log list)
 *   - _buildLogSummary (UUID-to-name resolution for log entries)
 *
 * Depends on: main-views.js (shared helpers), shared.js, main.js globals
 */

// ── Mode Toggle — Calendar / Log / Charts ────────────────────────────────────

var _IND_VIEW_MODE_KEY = 'cwoc_ind_view_mode';

/**
 * Initialize _indViewMode from localStorage (called once at load).
 */
function _indInitViewMode() {
  if (window._indViewMode) return;
  try {
    var saved = localStorage.getItem(_IND_VIEW_MODE_KEY);
    if (saved === 'calendar' || saved === 'log' || saved === 'charts') {
      window._indViewMode = saved;
    } else {
      window._indViewMode = 'charts';
    }
  } catch (e) {
    window._indViewMode = 'charts';
  }
}

/**
 * Render the 3-value pill toggle (Calendar | Log | Charts) and return its HTML.
 */
function _indBuildModeToggleHtml(activeMode) {
  var html = '<div style="text-align:center;padding:8px 0 4px;display:flex;align-items:center;justify-content:center;gap:12px;">';
  html += '<div class="cwoc-2val-toggle" id="ind-mode-pill">';
  html += '<input type="hidden" id="ind-mode-toggle" value="' + activeMode + '" />';
  html += '<span data-val="calendar"' + (activeMode === 'calendar' ? ' class="active"' : '') + '>Calendar</span>';
  html += '<span data-val="log"' + (activeMode === 'log' ? ' class="active"' : '') + '>Log</span>';
  html += '<span data-val="charts"' + (activeMode === 'charts' ? ' class="active"' : '') + '>Charts</span>';
  html += '</div>';
  html += '<a href="/frontend/html/custom-objects-editor.html" style="font-size:0.8em;color:#6b4e31;text-decoration:none;opacity:0.7;" title="Manage Custom Objects" onclick="storePreviousState()">⚙️ Objects</a>';
  html += '</div>';
  return html;
}

/**
 * Attach click listener to the mode pill toggle.
 * Called after the toggle is rendered into the DOM.
 */
function _indAttachModeToggleListener() {
  var pill = document.getElementById('ind-mode-pill');
  if (!pill) return;
  pill.addEventListener('click', function(e) {
    var span = e.target.closest('span[data-val]');
    if (!span) return;
    var newMode = span.dataset.val;
    var hidden = document.getElementById('ind-mode-toggle');
    if (hidden && hidden.value === newMode) return; // already active

    // Update hidden input and active class
    if (hidden) hidden.value = newMode;
    pill.querySelectorAll('span[data-val]').forEach(function(s) {
      s.classList.toggle('active', s.dataset.val === newMode);
    });

    // Persist and re-render
    window._indViewMode = newMode;
    try { localStorage.setItem(_IND_VIEW_MODE_KEY, newMode); } catch (ex) {}
    displayIndicatorsView();
  });
}

async function displayIndicatorsView() {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;

  // Initialize view mode from localStorage on first call
  _indInitViewMode();
  var mode = window._indViewMode || 'charts';

  if (mode === 'calendar' || mode === 'log') {
    chitList.innerHTML = _indBuildModeToggleHtml(mode) +
      '<div id="ind-mode-content" style="padding:0 1em;"><div style="text-align:center;opacity:0.5;">⏳ Loading…</div></div>';
    _indAttachModeToggleListener();
    try {
      // Fetch health data
      var now = new Date();
      var yearStart = now.getFullYear() + '-01-01';
      var yearEnd = now.getFullYear() + '-12-31T23:59:59';
      var url = '/api/health-data?since=' + encodeURIComponent(yearStart) + '&until=' + encodeURIComponent(yearEnd);
      var resp = await fetch(url);
      if (!resp.ok) throw new Error('API error');
      var data = await resp.json();

      // Fetch indicator objects for range classification / name resolution
      var objects = window._indicatorObjects || [];
      if (objects.length === 0) {
        try {
          var objResp = await fetch('/api/custom-objects/zone/indicators_zone');
          if (objResp.ok) {
            objects = await objResp.json();
            window._indicatorObjects = objects;
          }
        } catch (e) { /* use empty objects */ }
      }

      if (mode === 'calendar') {
        _indicatorsRenderCalendar(data, objects);
      } else {
        _indicatorsRenderLog(data, objects);
      }
    } catch (e) {
      console.error('[Indicators] ' + mode + ' load error:', e);
      var content = document.getElementById('ind-mode-content');
      if (content) {
        content.innerHTML = '<div style="text-align:center;padding:2em;color:#b22222;">Failed to load data.</div>';
      }
    }
    return;
  }

  // Default: charts mode (existing behavior)

  chitList.innerHTML = _indBuildModeToggleHtml(mode) +
    '<div style="padding:1em;overflow-y:auto;height:100%;box-sizing:border-box;">' +
    '<div id="indicators-latest"></div>' +
    '<div id="indicators-charts"></div>' +
  '</div>';
  _indAttachModeToggleListener();

  var now = new Date();
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput && !startInput.value) {
    var monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    startInput.value = _indFmtDate(monthAgo);
  }
  if (endInput && !endInput.value) {
    endInput.value = _indFmtDate(now);
  }
  if (!window._indRange) window._indRange = 'month';
  _indicatorsHighlightBtn(window._indRange);
  // Populate graph filter from graphs zone, then load charts
  _indPopulateGraphFilter().then(function() {
    _indicatorsLoad();
  });
}

// Persist/restore indicator checkbox selection (UUID-based)
function _indSaveSelection() {
  var sel = [];
  document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
    if (cb.checked) sel.push(cb.dataset.ind);
  });
  try { localStorage.setItem('cwoc_ind_selection', JSON.stringify(sel)); } catch(e) {}
}
function _indRestoreSelection() {
  try {
    var raw = localStorage.getItem('cwoc_ind_selection');
    if (!raw) return;
    var sel = JSON.parse(raw);
    if (!Array.isArray(sel)) return;
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      cb.checked = sel.indexOf(cb.dataset.ind) !== -1;
    });
  } catch(e) {}
}

// ── Graph Filter — Dynamic population from graphs zone ───────────────────────

/**
 * Cached graph zone objects (from GET /api/custom-objects/zone/graphs).
 */
window._graphZoneObjects = null;

/**
 * Fetch objects assigned to the "graphs" zone and populate the sidebar checkboxes.
 * Called when the charts mode is displayed.
 */
async function _indPopulateGraphFilter() {
  var container = document.getElementById('ind-select');
  if (!container) return;

  try {
    var resp = await fetch('/api/custom-objects/zone/graphs');
    if (!resp.ok) throw new Error('API error');
    var objects = await resp.json();
    window._graphZoneObjects = objects;
  } catch (e) {
    console.error('[Indicators] Failed to load graphs zone objects:', e);
    window._graphZoneObjects = [];
  }

  // Build checkboxes from graph zone objects
  var html = '';
  if (window._graphZoneObjects.length === 0) {
    html = '<div style="text-align:center;opacity:0.5;font-size:0.8em;padding:6px;">No objects assigned to graphs zone.</div>';
  } else {
    for (var i = 0; i < window._graphZoneObjects.length; i++) {
      var obj = window._graphZoneObjects[i];
      html += '<label><input type="checkbox" data-ind="' + obj.id + '" onchange="_indSaveSelection();_indicatorsLoad()" /> ' + _escHtml(obj.name) + '</label>';
    }
  }
  container.innerHTML = html;

  // Also add any "one-off" graphs from localStorage that aren't in the zone
  _indRestoreOneOffGraphs();

  // Restore saved selections
  _indRestoreSelection();

  // If nothing is selected after restore, select all by default
  var anyChecked = false;
  container.querySelectorAll('input[data-ind]').forEach(function(cb) {
    if (cb.checked) anyChecked = true;
  });
  if (!anyChecked) {
    container.querySelectorAll('input[data-ind]').forEach(function(cb) {
      cb.checked = true;
    });
    _indSaveSelection();
  }
}

/**
 * Restore one-off graph entries (objects added via "Add Graph" that aren't in the graphs zone).
 * These are stored in localStorage alongside the selection UUIDs.
 */
function _indRestoreOneOffGraphs() {
  var container = document.getElementById('ind-select');
  if (!container) return;

  try {
    var raw = localStorage.getItem('cwoc_ind_selection');
    if (!raw) return;
    var sel = JSON.parse(raw);
    if (!Array.isArray(sel)) return;

    // Find UUIDs in selection that aren't in the graph zone objects
    var zoneIds = (window._graphZoneObjects || []).map(function(o) { return o.id; });
    var oneOffIds = sel.filter(function(id) { return zoneIds.indexOf(id) === -1; });

    if (oneOffIds.length === 0) return;

    // We need to look up names for these one-off objects
    // Check if we have them cached in _allCustomObjects
    var allObjs = window._allCustomObjects || [];
    for (var i = 0; i < oneOffIds.length; i++) {
      var id = oneOffIds[i];
      // Skip if already in the container
      if (container.querySelector('input[data-ind="' + id + '"]')) continue;

      var name = id; // fallback to UUID
      for (var j = 0; j < allObjs.length; j++) {
        if (allObjs[j].id === id) { name = allObjs[j].name; break; }
      }

      var label = document.createElement('label');
      label.innerHTML = '<input type="checkbox" data-ind="' + id + '" onchange="_indSaveSelection();_indicatorsLoad()" /> ' + _escHtml(name) + ' <span style="font-size:0.7em;opacity:0.6;">(one-off)</span>';
      container.appendChild(label);
    }
  } catch (e) {}
}

/**
 * Show the "Add Graph" picker modal — lists all Custom Objects not currently in the filter.
 */
/**
 * Toggle the "Add Graph" collapsible section in the sidebar.
 * On first expand, fetches all custom objects and populates grouped by category.
 */
function _indToggleAddGraphSection() {
  var section = document.getElementById('ind-add-graph-section');
  var arrow = document.getElementById('ind-add-graph-arrow');
  if (!section) return;

  var isHidden = section.style.display === 'none';
  section.style.display = isHidden ? '' : 'none';
  if (arrow) arrow.textContent = isHidden ? '▼' : '▶';

  // Populate on first expand
  if (isHidden && !section.dataset.populated) {
    _indPopulateAddGraphSection();
  }
}

/**
 * Populate the "Add Graph" collapsible section with objects grouped by category.
 * Excludes objects already in the graph filter checkboxes.
 */
async function _indPopulateAddGraphSection() {
  var section = document.getElementById('ind-add-graph-section');
  if (!section) return;

  // Fetch all custom objects if not cached
  if (!window._allCustomObjects) {
    try {
      var resp = await fetch('/api/custom-objects');
      if (resp.ok) {
        window._allCustomObjects = await resp.json();
      } else {
        window._allCustomObjects = [];
      }
    } catch (e) {
      window._allCustomObjects = [];
    }
  }

  section.dataset.populated = '1';
  _indRenderAddGraphSection();
}

/**
 * Re-render the "Add Graph" section contents (called after populating or after adding a graph).
 */
function _indRenderAddGraphSection() {
  var section = document.getElementById('ind-add-graph-section');
  if (!section) return;

  // Get currently selected/available UUIDs in the filter
  var currentIds = [];
  document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
    currentIds.push(cb.dataset.ind);
  });

  // Filter to objects not already in the filter list, and only numeric types
  var available = (window._allCustomObjects || []).filter(function(obj) {
    return currentIds.indexOf(obj.id) === -1 && obj.value_type !== 'boolean' && obj.value_type !== 'string';
  });

  if (available.length === 0) {
    section.innerHTML = '<div style="text-align:center;opacity:0.5;font-size:0.8em;padding:8px;">No additional objects available.</div>';
    return;
  }

  // Group by category (use "Uncategorized" for objects without a category)
  var groups = {};
  for (var i = 0; i < available.length; i++) {
    var obj = available[i];
    var cat = obj.sub_type || obj.type || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(obj);
  }

  // Sort category names alphabetically, but put "Uncategorized" last
  var catNames = Object.keys(groups).sort(function(a, b) {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  var html = '';
  for (var c = 0; c < catNames.length; c++) {
    var catName = catNames[c];
    var catId = 'ind-add-cat-' + c;
    var items = groups[catName];

    // Category header (collapsible)
    html += '<div class="ind-add-cat-header" data-cat-id="' + catId + '" style="padding:5px 10px;cursor:pointer;font-size:0.8em;font-weight:bold;color:#4a2c2a;background:#f0e6d3;border-bottom:1px solid #e8dcc8;user-select:none;">';
    html += '<span class="filter-arrow" id="' + catId + '-arrow">▶</span> ' + _escHtml(catName) + ' <span style="opacity:0.5;font-weight:normal;">(' + items.length + ')</span>';
    html += '</div>';
    html += '<div id="' + catId + '-body" style="display:none;">';

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      html += '<div class="ind-add-item" data-obj-id="' + item.id + '" style="padding:6px 10px 6px 20px;cursor:pointer;font-size:0.8em;color:#1a1208;border-bottom:1px solid #f0e6d3;">';
      html += _escHtml(item.name);
      if (item.units) html += ' <span style="opacity:0.5;">(' + _escHtml(item.units) + ')</span>';
      html += '</div>';
    }

    html += '</div>';
  }

  section.innerHTML = html;

  // Attach click listeners for category headers (toggle collapse)
  section.querySelectorAll('.ind-add-cat-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var catId = header.dataset.catId;
      var body = document.getElementById(catId + '-body');
      var arrow = document.getElementById(catId + '-arrow');
      if (!body) return;
      var isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
    });
  });

  // Attach click listeners for items (add graph)
  section.querySelectorAll('.ind-add-item').forEach(function(itemEl) {
    itemEl.addEventListener('mouseenter', function() { itemEl.style.background = '#f0e6d3'; });
    itemEl.addEventListener('mouseleave', function() { itemEl.style.background = 'transparent'; });
    itemEl.addEventListener('click', function() {
      var objId = itemEl.dataset.objId;
      var obj = (window._allCustomObjects || []).find(function(o) { return o.id === objId; });
      if (obj) {
        _indAddOneOffGraph(obj);
        // Re-render the section to remove the just-added item
        _indRenderAddGraphSection();
      }
    });
  });
}

/**
 * Legacy modal function — now redirects to the collapsible section.
 * Kept for backward compatibility in case anything still calls it.
 */
async function _indShowAddGraphPicker() {
  // Open the collapsible section instead
  var section = document.getElementById('ind-add-graph-section');
  if (section && section.style.display === 'none') {
    _indToggleAddGraphSection();
  }
}

/**
 * Add a one-off graph for a Custom Object not in the graphs zone.
 * Adds a checkbox to the sidebar, checks it, saves selection, and reloads charts.
 */
function _indAddOneOffGraph(obj) {
  // Cache the object for name resolution
  if (!window._allCustomObjects) window._allCustomObjects = [];
  if (!window._allCustomObjects.find(function(o) { return o.id === obj.id; })) {
    window._allCustomObjects.push(obj);
  }

  var container = document.getElementById('ind-select');
  if (!container) return;

  // Add checkbox if not already present
  if (!container.querySelector('input[data-ind="' + obj.id + '"]')) {
    var label = document.createElement('label');
    label.innerHTML = '<input type="checkbox" data-ind="' + obj.id + '" onchange="_indSaveSelection();_indicatorsLoad()" checked /> ' + _escHtml(obj.name) + ' <span style="font-size:0.7em;opacity:0.6;">(one-off)</span>';
    container.appendChild(label);
  } else {
    // Already exists — just check it
    container.querySelector('input[data-ind="' + obj.id + '"]').checked = true;
  }

  _indSaveSelection();
  _indicatorsLoad();
}

function _indFmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _indicatorsSetRange(range) {
  var now = new Date();
  var start = new Date(now);
  if (range === 'day') start.setDate(start.getDate() - 1);
  else if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setMonth(start.getMonth() - 1);
  else if (range === 'year') start.setFullYear(start.getFullYear() - 1);
  else if (range === 'all') start = new Date(2020, 0, 1);

  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput) startInput.value = _indFmtDate(start);
  if (endInput) endInput.value = _indFmtDate(now);
  window._indRange = range;
  _indicatorsHighlightBtn(range);
  _indicatorsLoad();
}

function _indicatorsHighlightBtn(range) {
  document.querySelectorAll('._ind-btn').forEach(function(b) {
    var isActive = b.textContent.trim().toLowerCase() === range;
    b.style.background = isActive ? 'ivory' : '';
    b.style.color = isActive ? '#3b1f0a' : '';
  });
}

function _indicatorsLoadCustomRange() {
  window._indRange = 'custom';
  document.querySelectorAll('._ind-btn').forEach(function(b) { b.style.background = ''; });
  _indicatorsLoad();
}

async function _indicatorsLoad() {
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  var container = document.getElementById('indicators-charts');
  if (!container) return;

  var since = startInput ? startInput.value : '';
  var until = endInput ? endInput.value + 'T23:59:59' : '';
  container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">⏳ Loading…</div>';

  try {
    var url = '/api/health-data';
    var params = [];
    if (since) params.push('since=' + encodeURIComponent(since));
    if (until) params.push('until=' + encodeURIComponent(until));
    if (params.length) url += '?' + params.join('&');

    var resp = await fetch(url);
    if (!resp.ok) throw new Error('API error');
    var data = await resp.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">No health data in this time range.<br>Add health indicators to chits in the editor.</div>';
      return;
    }

    var settings = await getCachedSettings();
    var isMetric = (settings.unit_system === 'metric');

    // Build charts array from graph zone objects (UUID-based) with legacy fallback
    var charts = [];
    var graphObjs = window._graphZoneObjects || [];
    var _chartColors = ['#b22222', '#4682b4', '#d4a017', '#6b8e23', '#8b5a2b', '#d2691e', '#2e8b57', '#c44', '#9370db', '#20b2aa'];

    if (graphObjs.length > 0) {
      for (var gi = 0; gi < graphObjs.length; gi++) {
        var gObj = graphObjs[gi];
        // Skip non-numeric types (can't graph booleans/strings)
        if (gObj.value_type === 'boolean' || gObj.value_type === 'string') continue;
        var unitLabel = (isMetric && gObj.metric_units) ? gObj.metric_units : (gObj.units || '');
        charts.push({
          key: gObj.id,
          label: gObj.name,
          unit: unitLabel,
          color: _chartColors[gi % _chartColors.length],
          isUuid: true
        });
      }
    }

    // Also include one-off graphs from localStorage that aren't in the zone
    var allObjs = window._allCustomObjects || [];
    var zoneIds = graphObjs.map(function(o) { return o.id; });
    try {
      var rawSel = localStorage.getItem('cwoc_ind_selection');
      if (rawSel) {
        var selArr = JSON.parse(rawSel);
        if (Array.isArray(selArr)) {
          for (var si = 0; si < selArr.length; si++) {
            var selId = selArr[si];
            if (zoneIds.indexOf(selId) !== -1) continue; // already in zone
            if (charts.some(function(c) { return c.key === selId; })) continue; // already added
            // Find the object info
            var oneOffObj = null;
            for (var oi = 0; oi < allObjs.length; oi++) {
              if (allObjs[oi].id === selId) { oneOffObj = allObjs[oi]; break; }
            }
            if (oneOffObj && oneOffObj.value_type !== 'boolean' && oneOffObj.value_type !== 'string') {
              var oUnitLabel = (isMetric && oneOffObj.metric_units) ? oneOffObj.metric_units : (oneOffObj.units || '');
              charts.push({
                key: oneOffObj.id,
                label: oneOffObj.name,
                unit: oUnitLabel,
                color: _chartColors[(charts.length) % _chartColors.length],
                isUuid: true
              });
            }
          }
        }
      }
    } catch (e) {}

    // Fallback: if no graph zone objects loaded, use legacy hardcoded charts
    if (charts.length === 0) {
      charts = [
        { key: 'heart_rate', label: '❤️ Heart Rate', unit: 'bpm', color: '#b22222' },
        { key: 'bp_systolic', label: '🩸 Blood Pressure', unit: 'mmHg', color: '#c44', paired: 'bp_diastolic', pairedLabel: 'Diastolic', pairedColor: '#4682b4' },
        { key: 'spo2', label: '🫁 Oxygen Saturation', unit: '%', color: '#4682b4' },
        { key: 'temperature', label: '🌡️ Temperature', unit: isMetric ? '°C' : '°F', color: '#d4a017' },
        { key: 'weight', label: '⚖️ Weight', unit: isMetric ? 'kg' : 'lbs', color: '#6b8e23' },
        { key: 'height', label: '📐 Height', unit: isMetric ? 'cm' : 'in', color: '#8b5a2b' },
        { key: 'glucose', label: '🍬 Glucose', unit: isMetric ? 'mmol/L' : 'mg/dL', color: '#d2691e' },
        { key: 'distance', label: '🏃 Distance', unit: isMetric ? 'km' : 'mi', color: '#2e8b57' },
      ];
    }

    // Get selected indicators from sidebar checkboxes + persist
    var selectedKeys = [];
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      if (cb.checked) selectedKeys.push(cb.dataset.ind);
    });
    _indSaveSelection();

    // Build latest values header — cards fill the row evenly
    var latestDiv = document.getElementById('indicators-latest');
    if (latestDiv) {
      latestDiv.innerHTML = '';
      charts.forEach(function(ch) {
        var latest = null;
        if (data && data.length > 0) {
          for (var di = data.length - 1; di >= 0; di--) {
            if (data[di][ch.key] != null) { latest = data[di]; break; }
          }
        }
        var val = latest ? latest[ch.key] : '—';
        var card = document.createElement('div');
        var isClickable = latest && latest.chit_id;
        card.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:5px;padding:6px 10px;text-align:center;' + (isClickable ? 'cursor:pointer;' : '');
        card.title = latest ? (latest.chit_title || '') + ' — ' + (latest.date || '') : '';
        if (isClickable) {
          (function(chitId) {
            card.addEventListener('click', function() {
              storePreviousState();
              window.location.href = '/editor?id=' + chitId;
            });
          })(latest.chit_id);
        }
        var labelText = ch.isUuid ? ch.label : ch.label.split(' ').slice(1).join(' ');
        card.innerHTML = '<div style="font-size:0.7em;color:#6b4e31;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + labelText + '</div>' +
          '<div style="font-size:1.2em;font-weight:bold;color:' + ch.color + ';">' + (val !== '—' ? (Math.round(val * 10) / 10) : '—') + '</div>' +
          '<div style="font-size:0.65em;color:#8b7355;">' + ch.unit + '</div>';
        latestDiv.appendChild(card);
      });
    }

    container.innerHTML = '';

    charts.forEach(function(chart) {
      if (selectedKeys.indexOf(chart.key) === -1) return;

      var points = [];
      if (data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.key] != null) points.push({ date: d.date, datetime: d.datetime, value: d[chart.key], title: d.chit_title, chitId: d.chit_id });
        });
      }
      var pairedPoints = [];
      if (chart.paired && data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.paired] != null) pairedPoints.push({ date: d.date, datetime: d.datetime, value: d[chart.paired] });
        });
      }

      var chartDiv = document.createElement('div');
      chartDiv.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:6px;padding:8px 10px;';
      chartDiv.dataset.indKey = chart.key;

      // Header with expand button
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
      var title = document.createElement('span');
      title.style.cssText = 'font-weight:bold;font-size:0.9em;color:#2b1e0f;';
      title.textContent = chart.label + ' (' + chart.unit + ')' + (chart.paired ? ' / ' + chart.pairedLabel : '');
      header.appendChild(title);
      var expandBtn = document.createElement('button');
      expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
      expandBtn.title = 'Expand / collapse this chart';
      expandBtn.style.cssText = 'background:none;border:1px solid #8b5a2b;border-radius:3px;cursor:pointer;font-size:0.85em;padding:2px 7px;color:#6b4e31;';
      (function(chartKey) {
        expandBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _indToggleExpand(chartKey);
        });
      })(chart.key);
      header.appendChild(expandBtn);
      chartDiv.appendChild(header);

      if (points.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:20px 0;opacity:0.4;font-size:0.85em;';
        empty.textContent = 'No data';
        chartDiv.appendChild(empty);
        container.appendChild(chartDiv);
        return;
      }

      var svgWidth = 500, svgHeight = 180, padL = 45, padR = 10, padT = 8, padB = 22;
      var plotW = svgWidth - padL - padR, plotH = svgHeight - padT - padB;

      var allVals = points.map(function(p) { return p.value; });
      if (pairedPoints.length) pairedPoints.forEach(function(p) { allVals.push(p.value); });
      var minVal = Math.min.apply(null, allVals), maxVal = Math.max.apply(null, allVals);
      var valPad = (maxVal - minVal) * 0.1 || 1;
      minVal -= valPad; maxVal += valPad;
      var valRange = maxVal - minVal;

      var allDates = points.map(function(p) { return new Date(p.datetime || p.date).getTime(); });
      var minDate = Math.min.apply(null, allDates), maxDate = Math.max.apply(null, allDates);
      if (minDate === maxDate) { minDate -= 86400000; maxDate += 86400000; }
      var dateRange = maxDate - minDate;

      function xPos(ts) { return padL + ((ts - minDate) / dateRange) * plotW; }
      function yPos(v) { return padT + plotH - ((v - minVal) / valRange) * plotH; }

      var svg = '<svg viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">';
      for (var gi = 0; gi <= 3; gi++) {
        var gy = padT + (plotH / 3) * gi, gv = maxVal - (valRange / 3) * gi;
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (svgWidth - padR) + '" y2="' + gy + '" stroke="#e0d4b5" stroke-width="0.5"/>';
        svg += '<text x="' + (padL - 3) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#6b4e31">' + (Math.round(gv * 10) / 10) + '</text>';
      }
      var xSteps = Math.min(points.length, 6);
      // Smart date labels: use shorter format when dates are close together
      var _dateSpanDays = (maxDate - minDate) / 86400000;
      for (var xi = 0; xi < xSteps; xi++) {
        var idx = Math.round(xi * (points.length - 1) / Math.max(xSteps - 1, 1));
        var pt = points[idx], tx = xPos(new Date(pt.datetime || pt.date).getTime());
        var _labelDate = new Date(pt.datetime || pt.date);
        var _dateLabel;
        if (_dateSpanDays <= 2) {
          // Very short range: show time
          _dateLabel = String(_labelDate.getHours()).padStart(2, '0') + ':' + String(_labelDate.getMinutes()).padStart(2, '0');
        } else if (_dateSpanDays <= 14) {
          // Short range: day of month only
          _dateLabel = String(_labelDate.getDate());
        } else if (_dateSpanDays <= 90) {
          // Medium range: M/D
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate();
        } else {
          // Long range: M/D/YY
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate() + '/' + String(_labelDate.getFullYear()).slice(2);
        }
        svg += '<text x="' + tx + '" y="' + (svgHeight - 3) + '" text-anchor="middle" font-size="8" fill="#6b4e31">' + _dateLabel + '</text>';
      }
      if (pairedPoints.length > 1) {
        var pp = 'M';
        pairedPoints.forEach(function(p, i) { pp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + pp + '" fill="none" stroke="' + chart.pairedColor + '" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>';
      }
      if (points.length > 1) {
        var lp = 'M';
        points.forEach(function(p, i) { lp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + lp + '" fill="none" stroke="' + chart.color + '" stroke-width="2"/>';
      }
      points.forEach(function(p) {
        var cx = xPos(new Date(p.datetime || p.date).getTime()), cy = yPos(p.value);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.5" fill="' + chart.color + '" stroke="#fff8e1" stroke-width="1" style="cursor:pointer" onclick="storePreviousState();window.location.href=\'/editor?id=' + p.chitId + '\'">' +
          '<title>' + p.date + ': ' + p.value + ' ' + chart.unit + '\n' + p.title + '</title></circle>';
      });
      svg += '</svg>';
      var svgWrap = document.createElement('div');
      svgWrap.className = 'ind-chart-svg-wrap';
      svgWrap.style.cssText = 'width:100%;aspect-ratio:500/180;min-height:120px;';
      svgWrap.innerHTML = svg;
      chartDiv.appendChild(svgWrap);
      container.appendChild(chartDiv);
    });

    if (container.children.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">Select indicators in the sidebar.</div>';
    } else {
      // Enable drag-to-reorder on indicator charts (HTML5 desktop + touch mobile)
      _enableIndicatorsDragReorder(container);
      // Restore saved chart order
      _restoreIndicatorsOrder(container);

      // ── Touch gesture for indicator chart reorder (mobile) ─────────────
      if (typeof enableTouchGesture === 'function') {
        var _indDraggedChart = null;
        container.querySelectorAll('[data-ind-key]').forEach(function (chartEl) {
          enableTouchGesture(chartEl, {
            onDragStart: function () {
              _indDraggedChart = chartEl;
              chartEl.classList.add('cwoc-dragging');
            },
            onDragMove: function (data) {
              if (!_indDraggedChart) return;
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Temporarily hide dragged chart from hit testing
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) return;
              var targetChart = target.closest('[data-ind-key]');
              if (targetChart && targetChart !== _indDraggedChart) {
                var rect = targetChart.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (data.clientY < midY) {
                  targetChart.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetChart.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_indDraggedChart) return;
              _indDraggedChart.classList.remove('cwoc-dragging');
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Find drop target
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) { _indDraggedChart = null; return; }
              var targetChart = target.closest('[data-ind-key]');
              if (!targetChart || targetChart === _indDraggedChart) { _indDraggedChart = null; return; }

              // Reorder in DOM
              var rect = targetChart.getBoundingClientRect();
              if (data.clientY < rect.top + rect.height / 2) {
                container.insertBefore(_indDraggedChart, targetChart);
              } else {
                container.insertBefore(_indDraggedChart, targetChart.nextSibling);
              }

              // Save new order to localStorage
              var order = [];
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                order.push(c.dataset.indKey);
              });
              try { localStorage.setItem('cwoc_ind_chart_order', JSON.stringify(order)); } catch (ex) {}
              if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
              _indDraggedChart = null;
            },
            onLongPress: function () {
              // Long-press: open quick-edit modal for the indicator's chit if applicable
              var indKey = chartEl.dataset.indKey;
              // Find the most recent chit that has this indicator
              var matchChit = null;
              if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                for (var ci = chits.length - 1; ci >= 0; ci--) {
                  var c = chits[ci];
                  if (c.health_indicators && c.health_indicators[indKey] != null) {
                    matchChit = c;
                    break;
                  }
                }
              }
              if (matchChit && typeof showQuickEditModal === 'function') {
                showQuickEditModal(matchChit, function () { displayChits(); });
              }
            },
          });
        });
      }
    }
  } catch (e) {
    console.error('Indicators load error:', e);
    container.innerHTML = '<div style="text-align:center;padding:2em;color:#b22222;">Failed to load health data.</div>';
  }
}

// Expand/collapse a single indicator chart to fill the view
function _indToggleExpand(key) {
  var container = document.getElementById('indicators-charts');
  if (!container) return;
  var expanded = container.dataset.expanded;
  if (expanded === key) {
    // Collapse — show all again
    delete container.dataset.expanded;
    container.style.gridTemplateColumns = '';
    Array.from(container.children).forEach(function(c) {
      c.style.display = '';
      // Reset SVG wrapper to normal size
      var wrap = c.querySelector('.ind-chart-svg-wrap');
      if (wrap) {
        wrap.style.aspectRatio = '500/180';
        wrap.style.minHeight = '120px';
        wrap.style.maxHeight = '';
        wrap.style.height = '';
      }
      // Reset expand button icon
      var btn = c.querySelector('button i.fas');
      if (btn) btn.className = 'fas fa-expand';
    });
  } else {
    // Expand — hide all except this one, make it fill available space
    container.dataset.expanded = key;
    container.style.gridTemplateColumns = '1fr';
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        c.style.display = '';
        // Make SVG wrapper fill available height
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          wrap.style.aspectRatio = 'auto';
          wrap.style.minHeight = '300px';
          // Calculate available height: viewport minus header, latest cards, chart header, padding
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
          wrap.style.height = Math.max(300, availH) + 'px';
        }
        // Update expand button icon to compress
        var btn = c.querySelector('button i.fas');
        if (btn) btn.className = 'fas fa-compress';
      } else {
        c.style.display = 'none';
      }
    });
  }
}

// Resize handler — update expanded chart height on window resize/zoom
var _indResizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_indResizeTimer);
  _indResizeTimer = setTimeout(function() {
    var container = document.getElementById('indicators-charts');
    if (!container || !container.dataset.expanded) return;
    var key = container.dataset.expanded;
    // Recalculate the expanded chart height
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.height = Math.max(300, availH) + 'px';
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
        }
      }
    });
  }, 150);
});

// ── Indicators drag-to-reorder ───────────────────────────────────────────────

var _IND_ORDER_KEY = 'cwoc_indicators_chart_order';

function _enableIndicatorsDragReorder(container) {
  var draggedEl = null;

  Array.from(container.children).forEach(function(chartDiv) {
    if (!chartDiv.dataset.indKey) return;
    chartDiv.draggable = true;
    chartDiv.style.cursor = 'grab';

    chartDiv.addEventListener('dragstart', function(e) {
      draggedEl = chartDiv;
      e.dataTransfer.setData('text/plain', chartDiv.dataset.indKey);
      e.dataTransfer.effectAllowed = 'move';
      chartDiv.style.opacity = '0.4';
    });

    chartDiv.addEventListener('dragend', function() {
      chartDiv.style.opacity = '';
      draggedEl = null;
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
    });

    chartDiv.addEventListener('dragover', function(e) {
      if (!draggedEl || draggedEl === chartDiv) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var rect = chartDiv.getBoundingClientRect();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (e.clientY < rect.top + rect.height / 2) {
        chartDiv.style.borderTop = '3px solid #8b5a2b';
      } else {
        chartDiv.style.borderBottom = '3px solid #8b5a2b';
      }
    });

    chartDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (!draggedEl || draggedEl === chartDiv) return;

      var rect = chartDiv.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        container.insertBefore(draggedEl, chartDiv);
      } else {
        container.insertBefore(draggedEl, chartDiv.nextSibling);
      }

      // Save order
      var order = [];
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        order.push(c.dataset.indKey);
      });
      try { localStorage.setItem(_IND_ORDER_KEY, JSON.stringify(order)); } catch(ex) {}
    });
  });
}

function _restoreIndicatorsOrder(container) {
  try {
    var raw = localStorage.getItem(_IND_ORDER_KEY);
    if (!raw) return;
    var order = JSON.parse(raw);
    if (!Array.isArray(order)) return;

    // Reorder children to match saved order
    order.forEach(function(key) {
      var el = container.querySelector('[data-ind-key="' + key + '"]');
      if (el) container.appendChild(el);
    });
  } catch(ex) {}
}


// ══════════════════════════════════════════════════════════════════════════════
// Calendar Mode — Year-view grid (one cell per day, color-coded by range)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Classify a day's color based on its health readings and object ranges.
 * Returns "green" (all in range), "amber" (any out of range), or "none" (no data).
 *
 * @param {Array|null} dayReadings - Array of {objectId, value} for the day
 * @param {Array} objects - Custom Objects with id, value_type, range_min, range_max
 * @returns {string} "green", "amber", or "none"
 */
function _classifyDayColor(dayReadings, objects) {
  if (!dayReadings || dayReadings.length === 0) return 'none';
  var hasOutOfRange = false;
  for (var i = 0; i < dayReadings.length; i++) {
    var reading = dayReadings[i];
    var obj = objects.find(function(o) { return o.id === reading.objectId; });
    if (!obj || obj.value_type === 'boolean' || obj.value_type === 'string') continue;
    if (obj.range_min == null && obj.range_max == null) continue;
    var val = parseFloat(reading.value);
    if (isNaN(val)) continue;
    if ((obj.range_max != null && val > obj.range_max) ||
        (obj.range_min != null && val < obj.range_min)) {
      hasOutOfRange = true;
      break;
    }
  }
  return hasOutOfRange ? 'amber' : 'green';
}

/**
 * Render the Calendar Mode year-view grid.
 * Shows 12 rows (months) × up to 31 columns (days), color-coded by health data.
 *
 * @param {Array} data - Health data entries from /api/health-data (with date, chit_id, plus readings)
 * @param {Array} objects - Custom Objects from /api/custom-objects/zone/indicators_zone
 */
function _indicatorsRenderCalendar(data, objects) {
  var container = document.getElementById('ind-mode-content') || document.getElementById('chit-list');
  if (!container) return;

  var now = new Date();
  var year = now.getFullYear();

  // Build a map: "YYYY-MM-DD" → [{objectId, value}, ...] and chit IDs per day
  var dayMap = {};    // dateStr → [{objectId, value}]
  var chitMap = {};   // dateStr → [chit_id, ...]

  if (data && data.length > 0) {
    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      var dateStr = entry.date;
      if (!dateStr || dateStr.length < 10) continue;
      dateStr = dateStr.substring(0, 10);

      // Only include entries from the current year
      if (dateStr.substring(0, 4) !== String(year)) continue;

      if (!dayMap[dateStr]) dayMap[dateStr] = [];
      if (!chitMap[dateStr]) chitMap[dateStr] = [];

      // Track chit ID for this day
      if (entry.chit_id && chitMap[dateStr].indexOf(entry.chit_id) === -1) {
        chitMap[dateStr].push(entry.chit_id);
      }

      // Extract readings — match UUID keys against objects
      for (var j = 0; j < objects.length; j++) {
        var obj = objects[j];
        if (entry[obj.id] != null) {
          dayMap[dateStr].push({ objectId: obj.id, value: entry[obj.id] });
        }
      }

      // Also check legacy keys mapped to objects by name (fallback)
      var legacyKeys = ['heart_rate', 'bp_systolic', 'bp_diastolic', 'spo2', 'temperature', 'weight', 'height', 'glucose', 'distance', 'period_active'];
      for (var k = 0; k < legacyKeys.length; k++) {
        var lk = legacyKeys[k];
        if (entry[lk] != null) {
          // Find matching object by legacy key name mapping
          var matchObj = _findObjectByLegacyKey(lk, objects);
          if (matchObj && !dayMap[dateStr].some(function(r) { return r.objectId === matchObj.id && r.value === entry[lk]; })) {
            dayMap[dateStr].push({ objectId: matchObj.id, value: entry[lk] });
          }
        }
      }
    }
  }

  // Month names
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build the calendar HTML
  var html = '<div class="ind-cal-container">';
  html += '<div class="ind-cal-header">' + year + '</div>';
  html += '<div class="ind-cal-grid">';

  for (var m = 0; m < 12; m++) {
    var daysInMonth = new Date(year, m + 1, 0).getDate();

    html += '<div class="ind-cal-row">';
    html += '<div class="ind-cal-month">' + monthNames[m] + '</div>';
    html += '<div class="ind-cal-days">';

    for (var d = 1; d <= daysInMonth; d++) {
      var dayStr = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var readings = dayMap[dayStr] || [];
      var color = _classifyDayColor(readings, objects);
      var chits = chitMap[dayStr] || [];
      var hasData = chits.length > 0;

      var cellClass = 'ind-cal-cell ind-cal-' + color;
      if (hasData) cellClass += ' ind-cal-clickable';

      // Check if this day is today
      var isToday = (dayStr === _indFmtDate(now));
      if (isToday) cellClass += ' ind-cal-today';

      html += '<div class="' + cellClass + '"';
      if (hasData) {
        html += ' data-date="' + dayStr + '" data-chits="' + chits.join(',') + '"';
        html += ' title="' + dayStr + ' — ' + chits.length + ' chit' + (chits.length > 1 ? 's' : '') + '"';
      } else {
        html += ' title="' + dayStr + '"';
      }
      html += '></div>';
    }

    html += '</div>'; // .ind-cal-days
    html += '</div>'; // .ind-cal-row
  }

  html += '</div>'; // .ind-cal-grid

  // Legend
  html += '<div class="ind-cal-legend">';
  html += '<span class="ind-cal-legend-item"><span class="ind-cal-cell ind-cal-green ind-cal-legend-swatch"></span> All in range</span>';
  html += '<span class="ind-cal-legend-item"><span class="ind-cal-cell ind-cal-amber ind-cal-legend-swatch"></span> Out of range</span>';
  html += '<span class="ind-cal-legend-item"><span class="ind-cal-cell ind-cal-none ind-cal-legend-swatch"></span> No data</span>';
  html += '</div>';

  html += '</div>'; // .ind-cal-container

  container.innerHTML = html;

  // Attach click handlers to day cells with data
  container.querySelectorAll('.ind-cal-clickable').forEach(function(cell) {
    cell.addEventListener('click', function() {
      var chitsStr = cell.dataset.chits;
      if (!chitsStr) return;
      var chitIds = chitsStr.split(',');
      if (chitIds.length === 1) {
        // Single chit — navigate directly
        storePreviousState();
        window.location.href = '/editor?id=' + chitIds[0];
      } else {
        // Multiple chits — navigate to first one (most common case)
        storePreviousState();
        window.location.href = '/editor?id=' + chitIds[0];
      }
    });
  });
}

/**
 * Helper: find a Custom Object by legacy key name.
 * Maps legacy keys to expected object names for fallback matching.
 */
var _LEGACY_KEY_TO_NAME = {
  'heart_rate': 'Heart Rate',
  'bp_systolic': 'Blood Pressure Systolic',
  'bp_diastolic': 'Blood Pressure Diastolic',
  'spo2': 'Oxygen Saturation',
  'temperature': 'Temperature',
  'weight': 'Weight',
  'height': 'Height',
  'glucose': 'Glucose',
  'distance': 'Distance',
  'period_active': 'Period Active'
};

function _findObjectByLegacyKey(legacyKey, objects) {
  var name = _LEGACY_KEY_TO_NAME[legacyKey];
  if (!name) return null;
  for (var i = 0; i < objects.length; i++) {
    if (objects[i].name === name) return objects[i];
  }
  return null;
}


// ══════════════════════════════════════════════════════════════════════════════
// Log Mode — Reverse-chronological list of chits with health readings
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a human-readable summary of health readings for a single chit entry.
 * Resolves UUID keys to Custom Object display names.
 *
 * @param {Object} healthData - The raw entry from /api/health-data (includes date, chit_id, plus readings)
 * @param {Array} objects - Custom Objects from /api/custom-objects/zone/indicators_zone
 * @returns {string} Summary like "Heart Rate: 72, Weight: 175, BP: 120/80"
 */
function _buildLogSummary(healthData, objects) {
  var parts = [];
  var skipKeys = { date: 1, datetime: 1, chit_id: 1, chit_title: 1 };

  // Build a lookup map: object ID → object name
  var idToName = {};
  for (var i = 0; i < objects.length; i++) {
    idToName[objects[i].id] = objects[i].name;
  }

  // Iterate over health data keys
  var keys = Object.keys(healthData);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (skipKeys[key]) continue;
    var val = healthData[key];
    if (val == null || val === '') continue;

    var displayName = null;

    // Try UUID match first
    if (idToName[key]) {
      displayName = idToName[key];
    } else {
      // Try legacy key match
      var legacyName = _LEGACY_KEY_TO_NAME[key];
      if (legacyName) {
        // Check if we already have a UUID entry for this same object (avoid duplicates)
        var matchObj = _findObjectByLegacyKey(key, objects);
        if (matchObj && healthData[matchObj.id] != null) {
          // UUID entry exists — skip the legacy key to avoid duplicate
          continue;
        }
        displayName = legacyName;
      }
    }

    if (!displayName) continue;

    // Format boolean values
    if (val === true) {
      parts.push(displayName + ': ✓');
    } else if (val === false) {
      parts.push(displayName + ': ✗');
    } else {
      parts.push(displayName + ': ' + val);
    }
  }

  return parts.join(', ') || 'No readings';
}

/**
 * Render the Log Mode reverse-chronological list.
 * Shows chits containing health_data sorted most-recent-first.
 *
 * @param {Array} data - Health data entries from /api/health-data
 * @param {Array} objects - Custom Objects from /api/custom-objects/zone/indicators_zone
 */
function _indicatorsRenderLog(data, objects) {
  var container = document.getElementById('ind-mode-content') || document.getElementById('chit-list');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="ind-log-container"><div class="ind-log-empty">No health data recorded yet.<br>Add health indicators to chits in the editor.</div></div>';
    return;
  }

  // Sort reverse-chronological (most recent first)
  var sorted = data.slice().sort(function(a, b) {
    var dateA = a.datetime || a.date || '';
    var dateB = b.datetime || b.date || '';
    if (dateA > dateB) return -1;
    if (dateA < dateB) return 1;
    return 0;
  });

  var html = '<div class="ind-log-container">';
  html += '<div class="ind-log-header">Health Log</div>';
  html += '<div class="ind-log-list">';

  for (var i = 0; i < sorted.length; i++) {
    var entry = sorted[i];
    var dateStr = entry.date || '';
    var chitId = entry.chit_id || '';
    var chitTitle = entry.chit_title || '(Untitled)';
    var summary = _buildLogSummary(entry, objects);

    // Format the date for display
    var displayDate = dateStr;
    if (dateStr && dateStr.length >= 10) {
      var parts = dateStr.substring(0, 10).split('-');
      if (parts.length === 3) {
        displayDate = parts[1] + '/' + parts[2] + '/' + parts[0];
      }
    }

    html += '<div class="ind-log-entry" data-chit-id="' + chitId + '">';
    html += '<div class="ind-log-entry-date">' + displayDate + '</div>';
    html += '<div class="ind-log-entry-body">';
    html += '<div class="ind-log-entry-title">' + _escHtml(chitTitle) + '</div>';
    html += '<div class="ind-log-entry-summary">' + _escHtml(summary) + '</div>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>'; // .ind-log-list
  html += '</div>'; // .ind-log-container

  container.innerHTML = html;

  // Attach click handlers to navigate to chit editor
  container.querySelectorAll('.ind-log-entry[data-chit-id]').forEach(function(el) {
    el.addEventListener('click', function() {
      var chitId = el.dataset.chitId;
      if (!chitId) return;
      storePreviousState();
      window.location.href = '/editor?id=' + chitId;
    });
  });
}

// _escapeHtml — now using shared _escHtml from shared-utils.js
