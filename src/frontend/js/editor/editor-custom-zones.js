/**
 * editor-custom-zones.js — Dynamic custom zone rendering in the chit editor
 *
 * On chit load, discovers user's custom zones via GET /api/custom-zones,
 * fetches assigned objects for each zone, evaluates conditional_display rules,
 * and renders collapsible Zone_Panels in the .main-zones-grid.
 *
 * Reuses pure functions from editor-health.js:
 *   _evaluateConditionalDisplay, _getUnitLabel, _getRangeHighlightClass, _renderIndicatorField
 *
 * Exposes:
 *   _loadCustomZones(chit)       — entry point called during editor init
 *   _gatherCustomZoneData()      — returns UUID-keyed object of all custom zone field values
 *
 * Depends on: shared-utils.js (getCachedSettings, setSaveButtonUnsaved, cwocToast),
 *             editor-health.js (_evaluateConditionalDisplay, _getUnitLabel,
 *                               _getRangeHighlightClass, _renderIndicatorField)
 * Loaded after: editor-health.js
 * Loaded before: editor-save.js, editor-init.js
 */

// ── State ────────────────────────────────────────────────────────────────────
window._customZoneData = {};          // UUID-keyed values for custom zone fields
window._customZonePanels = [];        // Track rendered zone panel element IDs

// ── Data Fetching ────────────────────────────────────────────────────────────

/**
 * Fetch all custom zones for the current user.
 * @returns {Promise<Array>} array of zone objects sorted by sort_order
 */
async function _fetchCustomZones() {
  try {
    var resp = await fetch('/api/custom-zones');
    if (!resp.ok) throw new Error('Failed to fetch custom zones: ' + resp.status);
    return await resp.json();
  } catch (err) {
    console.error('[editor-custom-zones] _fetchCustomZones error:', err);
    return [];
  }
}

/**
 * Fetch objects assigned to a specific zone.
 * @param {string} zoneId - the zone_id to query
 * @returns {Promise<Array>} array of custom objects for that zone
 */
async function _fetchZoneObjects(zoneId) {
  try {
    var resp = await fetch('/api/custom-objects/zone/' + encodeURIComponent(zoneId));
    if (!resp.ok) throw new Error('Zone query failed: ' + resp.status);
    return await resp.json();
  } catch (err) {
    console.error('[editor-custom-zones] _fetchZoneObjects error for ' + zoneId + ':', err);
    return [];
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Render a single custom zone as a collapsible Zone_Panel.
 * Groups fields by sub_type (alphabetically), uses the same 3-column grid.
 * @param {object} zone - zone metadata (id, zone_id, name, sort_order)
 * @param {Array} objects - custom objects assigned to this zone
 * @param {object} settings - user settings for conditional display and units
 * @param {object} healthData - existing health_data from chit (UUID-keyed)
 * @returns {HTMLElement|null} the zone panel element, or null if no visible fields
 */
function _renderCustomZonePanel(zone, objects, settings, healthData) {
  var unitSystem = settings.unit_system || 'imperial';

  // Filter objects by conditional_display
  var visibleObjects = objects.filter(function(obj) {
    return _evaluateConditionalDisplay(obj.conditional_display, settings);
  });

  // If no visible objects, skip this zone
  if (visibleObjects.length === 0) return null;

  // Group by sub_type, sorted alphabetically
  var groups = {};
  var groupOrder = [];
  for (var i = 0; i < visibleObjects.length; i++) {
    var obj = visibleObjects[i];
    var groupKey = obj.sub_type || obj.type || 'Other';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
      groupOrder.push(groupKey);
    }
    groups[groupKey].push(obj);
  }
  groupOrder.sort(function(a, b) { return a.localeCompare(b); });

  // Build the zone container
  var sectionId = 'customZone_' + zone.zone_id;
  var contentId = 'customZoneContent_' + zone.zone_id;

  // Determine if any field has a stored value (to decide collapsed state)
  var hasAnyValue = visibleObjects.some(function(obj) {
    var val = healthData[obj.id];
    return val != null && val !== '' && val !== false;
  });

  var section = document.createElement('div');
  section.id = sectionId;
  section.className = 'zone-container' + (hasAnyValue ? '' : ' collapsed');
  section.dataset.customZone = zone.zone_id;

  // Zone header (collapsible)
  var header = document.createElement('div');
  header.className = 'zone-header';
  header.addEventListener('click', function(e) {
    toggleZone(e, sectionId, contentId);
  });

  var title = document.createElement('h2');
  title.className = 'zone-title';
  title.textContent = '📦 ' + zone.name;
  header.appendChild(title);

  var toggleIcon = document.createElement('span');
  toggleIcon.className = 'zone-toggle-icon';
  toggleIcon.textContent = hasAnyValue ? '🔽' : '🔼';
  header.appendChild(toggleIcon);

  section.appendChild(header);

  // Zone body — hidden if collapsed
  var body = document.createElement('div');
  body.id = contentId;
  body.className = 'zone-body';
  body.style.cssText = (hasAnyValue ? 'display:flex;' : 'display:none;') + 'flex-direction:column;gap:4px;padding:10px 14px;';
  section.appendChild(body);

  // Render each group as a collapsible section (same pattern as indicators)
  for (var g = 0; g < groupOrder.length; g++) {
    var groupName = groupOrder[g];
    var groupItems = groups[groupName];

    // Section header
    var sectionHeader = document.createElement('div');
    sectionHeader.className = 'indicator-section-header';
    sectionHeader.innerHTML = '<span class="indicator-section-arrow">▼</span> ' + groupName;
    sectionHeader.style.cssText = 'cursor:pointer;user-select:none;padding:6px 0 4px 0;font-size:0.85em;font-weight:bold;color:#4a2c2a;border-bottom:1px solid #e8dcc8;margin-bottom:4px;';
    body.appendChild(sectionHeader);

    // Section body (3-column grid)
    var sectionBody = document.createElement('div');
    sectionBody.className = 'indicator-section-body';
    body.appendChild(sectionBody);

    // Wire collapse toggle
    (function(hdr, bdy) {
      hdr.addEventListener('click', function() {
        var arrow = hdr.querySelector('.indicator-section-arrow');
        if (bdy.style.display === 'none') {
          bdy.style.display = '';
          if (arrow) arrow.textContent = '▼';
        } else {
          bdy.style.display = 'none';
          if (arrow) arrow.textContent = '▶';
        }
      });
    })(sectionHeader, sectionBody);

    // Sort items within group by zone_sort_order
    groupItems.sort(function(a, b) {
      return (a.zone_sort_order || 0) - (b.zone_sort_order || 0);
    });

    // Render fields
    for (var fi = 0; fi < groupItems.length; fi++) {
      var fieldObj = groupItems[fi];
      var value = healthData[fieldObj.id];
      if (value === undefined) value = null;

      // Store initial value in custom zone data
      if (value != null) {
        window._customZoneData[fieldObj.id] = value;
      }

      var fieldEl = _renderCustomZoneField(fieldObj, value, unitSystem);
      sectionBody.appendChild(fieldEl);
    }
  }

  return section;
}

/**
 * Render a single custom zone field. Similar to _renderIndicatorField but
 * stores values in window._customZoneData instead of window._healthData.
 * @param {object} obj - Custom Object
 * @param {*} value - current value from health_data
 * @param {string} unitSystem - 'imperial' or 'metric'
 * @returns {HTMLElement}
 */
function _renderCustomZoneField(obj, value, unitSystem) {
  var row = document.createElement('div');
  row.className = 'indicator-field';
  row.dataset.objectId = obj.id;

  // Label
  var label = document.createElement('label');
  label.className = 'indicator-label';
  label.textContent = obj.name;
  row.appendChild(label);

  var unitLabel = _getUnitLabel(obj, unitSystem);

  if (obj.value_type === 'boolean') {
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'indicator-checkbox';
    cb.checked = !!value;
    cb.dataset.objectId = obj.id;
    cb.addEventListener('change', function() {
      window._customZoneData[obj.id] = cb.checked;
      setSaveButtonUnsaved();
    });
    row.appendChild(cb);
  } else if (obj.value_type === 'string') {
    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'indicator-input indicator-text';
    textInput.placeholder = '—';
    textInput.value = (value != null) ? value : '';
    textInput.dataset.objectId = obj.id;
    textInput.addEventListener('input', function() {
      window._customZoneData[obj.id] = textInput.value || null;
      setSaveButtonUnsaved();
    });
    row.appendChild(textInput);
  } else {
    // Numeric (integer or decimal)
    var numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'indicator-input indicator-numeric';
    numInput.step = (obj.value_type === 'integer') ? '1' : 'any';
    numInput.placeholder = '—';
    numInput.value = (value != null) ? value : '';
    numInput.dataset.objectId = obj.id;

    // Apply initial range highlight
    var rangeClass = _getRangeHighlightClass(value, obj.range_min, obj.range_max);
    if (rangeClass) numInput.classList.add(rangeClass);

    numInput.addEventListener('input', function() {
      var val = numInput.value;
      if (val === '' || val == null) {
        window._customZoneData[obj.id] = null;
      } else {
        window._customZoneData[obj.id] = (obj.value_type === 'integer')
          ? parseInt(val) : parseFloat(val);
      }
      // Update range highlight in real time
      numInput.classList.remove('indicator-range-high', 'indicator-range-low');
      var cls = _getRangeHighlightClass(val, obj.range_min, obj.range_max);
      if (cls) numInput.classList.add(cls);
      setSaveButtonUnsaved();
    });
    row.appendChild(numInput);
  }

  // Unit label (if any, and not boolean)
  if (unitLabel && obj.value_type !== 'boolean') {
    var unitSpan = document.createElement('span');
    unitSpan.className = 'indicator-unit';
    unitSpan.textContent = unitLabel;
    row.appendChild(unitSpan);
  }

  return row;
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Load and render custom zones for the current chit.
 * Entry point called during editor initialization.
 * @param {object} chit - the chit object (may have health_data)
 */
async function _loadCustomZones(chit) {
  // Reset state
  window._customZoneData = {};
  window._customZonePanels = [];

  // Remove any previously rendered custom zone panels
  var grid = document.querySelector('.main-zones-grid');
  if (!grid) return;
  var existing = grid.querySelectorAll('[data-custom-zone]');
  for (var i = 0; i < existing.length; i++) {
    existing[i].remove();
  }

  // Parse health_data from chit
  var healthData = {};
  if (chit && chit.health_data) {
    try {
      healthData = (typeof chit.health_data === 'string')
        ? JSON.parse(chit.health_data) : chit.health_data;
      if (!healthData) healthData = {};
    } catch (e) {
      console.warn('[editor-custom-zones] Failed to parse health_data:', e);
      healthData = {};
    }
  }

  // Get user settings
  var settings = {};
  try {
    settings = await getCachedSettings();
  } catch (e) {
    settings = {};
  }

  // Fetch custom zones
  var zones = await _fetchCustomZones();
  if (!zones || zones.length === 0) return;

  // Find the two column containers for alternating placement
  var colOne = grid.querySelector('.column-one');
  var colTwo = grid.querySelector('.column-two');

  // Zones are already sorted by sort_order from the API
  // Fetch objects for each zone and render, alternating between columns
  var panelIdx = 0;
  for (var z = 0; z < zones.length; z++) {
    var zone = zones[z];
    var objects = await _fetchZoneObjects(zone.zone_id);

    var panel = _renderCustomZonePanel(zone, objects, settings, healthData);
    if (panel) {
      // Alternate between columns (first to col-one, second to col-two, etc.)
      var targetCol = (panelIdx % 2 === 0) ? colOne : colTwo;
      if (targetCol) {
        targetCol.appendChild(panel);
      } else {
        grid.appendChild(panel);
      }
      panelIdx++;
      window._customZonePanels.push(panel.id);
    }
  }

  // Register custom zone panels with the mobile zone navigation system
  _registerCustomZonesInMobileNav();
}

/**
 * Gather all custom zone field values into a UUID-keyed object for saving.
 * Called by editor-save.js to merge with health_data.
 * @returns {object} UUID-keyed values (may be empty object)
 */
function _gatherCustomZoneData() {
  var result = {};
  for (var key in window._customZoneData) {
    if (window._customZoneData.hasOwnProperty(key)) {
      var val = window._customZoneData[key];
      if (val != null && val !== '') {
        result[key] = val;
      }
    }
  }
  return result;
}

// ── Mobile Zone Navigation Integration ───────────────────────────────────────

/**
 * Register rendered custom zone panels with the mobile zone navigation system.
 * Adds entries to _mobileZoneOrder so custom zones appear in the zone list,
 * are hidden/shown correctly, and are reachable via swipe navigation.
 *
 * Must be called AFTER panels are rendered and appended to the grid.
 * Only adds zones that aren't already registered (idempotent).
 */
function _registerCustomZonesInMobileNav() {
  // Guard: _mobileZoneOrder must exist (editor-mobile-zones.js loaded)
  if (typeof _mobileZoneOrder === 'undefined') return;

  // Remove any previously registered custom zones (for re-load scenarios)
  _mobileZoneOrder = _mobileZoneOrder.filter(function(z) {
    return !z.isCustomZone;
  });

  // Register each rendered custom zone panel
  for (var i = 0; i < window._customZonePanels.length; i++) {
    var sectionId = window._customZonePanels[i];
    var section = document.getElementById(sectionId);
    if (!section) continue;

    var zoneId = section.dataset.customZone;
    var contentId = 'customZoneContent_' + zoneId;

    // Extract the zone name from the panel's title element
    var titleEl = section.querySelector('.zone-title');
    var label = titleEl ? titleEl.textContent.replace(/^📦\s*/, '') : zoneId;

    _mobileZoneOrder.push({
      id: sectionId,
      contentId: contentId,
      label: label,
      icon: '📦',
      isCustomZone: true
    });
  }

  // If mobile zone mode is already active, refresh the current view
  // so the new zones are properly hidden
  if (typeof _mobileZoneModeActive !== 'undefined' && _mobileZoneModeActive) {
    _mobileShowZone(_mobileCurrentZoneIdx);
  }
}
