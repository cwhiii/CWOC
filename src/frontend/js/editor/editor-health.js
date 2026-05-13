/**
 * editor-health.js — Health indicators zone (data-driven)
 *
 * Dynamically renders health indicator input fields by querying the Custom Objects
 * registry (GET /api/custom-objects/zone/indicators_zone). Replaces the old hardcoded
 * _healthFields array with a fully data-driven approach.
 *
 * Each Custom Object's value_type determines the input type:
 *   - "integer" / "decimal" → numeric input
 *   - "boolean" → checkbox
 *   - "string" → text input
 *
 * Supports conditional_display rules, imperial/metric unit switching, range
 * highlighting, default vs per-chit indicator separation, and the "Add Indicator"
 * picker for adding non-default indicators to specific chits.
 *
 * Depends on: shared-utils.js (getCachedSettings, setSaveButtonUnsaved, cwocToast)
 * Loaded before: editor-init.js, editor.js
 */

// ── State ────────────────────────────────────────────────────────────────────
window._healthData = {};              // UUID-keyed readings for current chit
window._indicatorObjects = [];        // Cached zone query result
window._perChitIndicators = [];       // UUIDs of per-chit indicators on current chit
window._healthUnitSystem = 'imperial';

// ── Pure Logic Functions ─────────────────────────────────────────────────────

/**
 * Evaluate a conditional_display rule against user settings.
 * Returns true if the field should be shown.
 * @param {object|null} rule - e.g. {"setting": "sex", "equals": "Woman"}
 * @param {object} settings - cached user settings object
 * @returns {boolean}
 */
function _evaluateConditionalDisplay(rule, settings) {
  if (!rule) return true;
  return settings[rule.setting] === rule.equals;
}

/**
 * Get the appropriate unit label based on the user's unit system.
 * @param {object} obj - Custom Object with units and metric_units fields
 * @param {string} unitSystem - 'imperial' or 'metric'
 * @returns {string}
 */
function _getUnitLabel(obj, unitSystem) {
  if (unitSystem === 'metric' && obj.metric_units) return obj.metric_units;
  return obj.units || '';
}

/**
 * Determine the CSS class for range highlighting.
 * @param {*} value - current input value
 * @param {number|null} rangeMin - acceptable range minimum
 * @param {number|null} rangeMax - acceptable range maximum
 * @returns {string} CSS class name or empty string
 */
function _getRangeHighlightClass(value, rangeMin, rangeMax) {
  if (rangeMin == null && rangeMax == null) return '';
  if (value == null || value === '') return '';
  var numVal = parseFloat(value);
  if (isNaN(numVal)) return '';
  if (rangeMax != null && numVal > rangeMax) return 'indicator-range-high';
  if (rangeMin != null && numVal < rangeMin) return 'indicator-range-low';
  return '';
}

// ── Data Fetching ────────────────────────────────────────────────────────────

/**
 * Fetch indicator objects assigned to the indicators_zone.
 * Caches result in window._indicatorObjects to avoid repeated network calls.
 * @returns {Promise<Array>} array of indicator objects
 */
async function _fetchIndicatorObjects() {
  if (window._indicatorObjects && window._indicatorObjects.length > 0) {
    return window._indicatorObjects;
  }
  try {
    var resp = await fetch('/api/custom-objects/zone/indicators_zone');
    if (!resp.ok) throw new Error('Zone query failed: ' + resp.status);
    var objects = await resp.json();
    window._indicatorObjects = objects;
    return objects;
  } catch (err) {
    console.error('[editor-health] _fetchIndicatorObjects error:', err);
    cwocToast('Failed to load indicators', 'error');
    window._indicatorObjects = [];
    return [];
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Render a single indicator field into the container.
 * Creates the appropriate input type based on value_type.
 * @param {object} obj - Custom Object from zone query
 * @param {*} value - current value from health_data (or null)
 * @returns {HTMLElement} the rendered field row element
 */
function _renderIndicatorField(obj, value) {
  var row = document.createElement('div');
  row.className = 'indicator-field';
  row.dataset.objectId = obj.id;

  // Label
  var label = document.createElement('label');
  label.className = 'indicator-label';
  label.textContent = obj.name;
  row.appendChild(label);

  var unitLabel = _getUnitLabel(obj, window._healthUnitSystem);

  if (obj.value_type === 'boolean') {
    // Checkbox input
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'indicator-checkbox';
    cb.checked = !!value;
    cb.dataset.objectId = obj.id;
    cb.addEventListener('change', function() {
      window._healthData[obj.id] = cb.checked;
      setSaveButtonUnsaved();
    });
    row.appendChild(cb);
  } else if (obj.value_type === 'string') {
    // Text input
    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'indicator-input indicator-text';
    textInput.placeholder = '—';
    textInput.value = (value != null) ? value : '';
    textInput.dataset.objectId = obj.id;
    textInput.addEventListener('input', function() {
      window._healthData[obj.id] = textInput.value || null;
      setSaveButtonUnsaved();
    });
    row.appendChild(textInput);
  } else {
    // Numeric input (integer or decimal)
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
      // Update health data
      if (val === '' || val == null) {
        window._healthData[obj.id] = null;
      } else {
        window._healthData[obj.id] = (obj.value_type === 'integer')
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

// ── Add Indicator Picker ──────────────────────────────────────────────────────

/**
 * Show the "Add Indicator" picker modal.
 * Lists all non-default Custom Objects assigned to indicators_zone,
 * excluding those already added as per-chit indicators on the current chit.
 */
function _showAddIndicatorPicker() {
  // Remove any existing picker modal
  document.querySelectorAll('.indicator-picker-overlay').forEach(function(el) { el.remove(); });

  // Show loading overlay immediately, then fetch all objects
  var overlay = document.createElement('div');
  overlay.className = 'indicator-picker-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:24px;min-width:280px;max-width:400px;width:90%;font-family:Lora,Georgia,serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-height:70vh;display:flex;flex-direction:column;';
  modal.innerHTML = '<div style="text-align:center;padding:1em;opacity:0.5;">Loading…</div>';
  overlay.appendChild(modal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);

  function close() {
    document.removeEventListener('keydown', onEsc, true);
    overlay.remove();
  }
  function onEsc(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }
  document.addEventListener('keydown', onEsc, true);

  // Fetch ALL custom objects (not just zone-assigned ones)
  fetch('/api/custom-objects').then(function(resp) {
    if (!resp.ok) throw new Error('API error');
    return resp.json();
  }).then(function(allObjects) {
    // Build set of IDs already shown as defaults in the zone
    var defaultIds = {};
    var zoneObjects = window._indicatorObjects || [];
    for (var z = 0; z < zoneObjects.length; z++) {
      var cfg = zoneObjects[z].zone_config || zoneObjects[z].config;
      if (cfg && cfg.is_default === true) {
        defaultIds[zoneObjects[z].id] = true;
      }
    }

    // Filter: exclude defaults, already-added per-chit indicators, and inactive/deleted
    var available = allObjects.filter(function(obj) {
      if (defaultIds[obj.id]) return false;
      if (window._perChitIndicators.indexOf(obj.id) !== -1) return false;
      if (!obj.active) return false;
      return true;
    });

    _renderAddIndicatorModal(modal, available, close);
  }).catch(function(err) {
    console.error('[editor-health] Failed to fetch objects for picker:', err);
    modal.innerHTML = '<h3 style="margin:0 0 12px 0;color:#4a2c2a;font-size:1.1em;">Add Custom Object</h3>' +
      '<p style="color:#b22222;">Failed to load objects.</p>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:16px;"><button onclick="this.closest(\'.indicator-picker-overlay\').remove()" style="padding:6px 14px;font-family:Lora,Georgia,serif;font-size:0.9em;background:#e8dcc8;color:#4a2c2a;border:1px solid #a0522d;border-radius:4px;cursor:pointer;">Close</button></div>';
  });
}

/**
 * Render the Add Indicator modal content with objects grouped by category.
 */
function _renderAddIndicatorModal(modal, available, closeFn) {
  modal.innerHTML = '';
  var selected = {}; // id → obj

  // Title
  var titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin:0 0 12px 0;color:#4a2c2a;font-size:1.1em;';
  titleEl.textContent = 'Add Custom Object';
  modal.appendChild(titleEl);

  if (available.length === 0) {
    var emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:#6b4e31;font-size:0.95em;margin:8px 0;';
    emptyMsg.textContent = 'No additional custom objects available.';
    modal.appendChild(emptyMsg);
  } else {
    // Search input
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search custom objects...';
    searchInput.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #8b5a2b;border-radius:5px;font-family:Lora,Georgia,serif;font-size:0.9em;background:#f5e6cc;color:#2b1e0f;box-sizing:border-box;margin-bottom:10px;';
    modal.appendChild(searchInput);

    var list = document.createElement('div');
    list.style.cssText = 'overflow-y:auto;flex:1;';

    function renderList(filter) {
      list.innerHTML = '';
      var lowerFilter = (filter || '').toLowerCase();
      var isSearching = lowerFilter.length > 0;

      var typeGroups = {};
      var typeOrder = [];
      for (var i = 0; i < available.length; i++) {
        var obj = available[i];
        if (lowerFilter) {
          var nameMatch = obj.name.toLowerCase().indexOf(lowerFilter) !== -1;
          var typeMatch = (obj.type || '').toLowerCase().indexOf(lowerFilter) !== -1;
          var subTypeMatch = (obj.sub_type || '').toLowerCase().indexOf(lowerFilter) !== -1;
          if (!nameMatch && !typeMatch && !subTypeMatch) continue;
        }
        var type = obj.type || 'Other';
        var subType = obj.sub_type || '';
        if (!typeGroups[type]) { typeGroups[type] = {}; typeOrder.push(type); }
        if (!typeGroups[type][subType]) typeGroups[type][subType] = [];
        typeGroups[type][subType].push(obj);
      }

      if (typeOrder.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:12px;color:#6b4e31;font-size:0.85em;opacity:0.7;">No matches.</div>';
        return;
      }

      typeOrder.sort(function(a, b) { return a.localeCompare(b); });

      for (var t = 0; t < typeOrder.length; t++) {
        var typeName = typeOrder[t];
        var subTypes = typeGroups[typeName];
        var typeCount = 0;
        Object.keys(subTypes).forEach(function(st) { typeCount += subTypes[st].length; });

        var typeHeader = document.createElement('div');
        typeHeader.style.cssText = 'padding:8px 12px 4px;font-size:0.8em;font-weight:bold;color:#4a2c2a;background:#f0e6d3;border-bottom:1px solid #e8dcc8;cursor:pointer;user-select:none;';
        typeHeader.innerHTML = '<span style="font-size:0.9em;">▼</span> ' + typeName + ' <span style="opacity:0.5;font-weight:normal;">(' + typeCount + ')</span>';
        list.appendChild(typeHeader);

        var typeBody = document.createElement('div');
        list.appendChild(typeBody);

        (function(header, body) {
          header.addEventListener('click', function() {
            var arrow = header.querySelector('span');
            if (body.style.display === 'none') { body.style.display = ''; arrow.textContent = '▼'; }
            else { body.style.display = 'none'; arrow.textContent = '▶'; }
          });
        })(typeHeader, typeBody);

        var sortedSubTypes = Object.keys(subTypes).sort(function(a, b) {
          if (a === '') return -1; if (b === '') return 1; return a.localeCompare(b);
        });

        for (var s = 0; s < sortedSubTypes.length; s++) {
          var stName = sortedSubTypes[s];
          var stItems = subTypes[stName];
          var targetContainer = typeBody;

          if (stName) {
            var stHeader = document.createElement('div');
            stHeader.style.cssText = 'padding:5px 12px 3px 20px;font-size:0.75em;font-weight:600;color:#6b4e31;border-bottom:1px solid #f0e6d3;cursor:pointer;user-select:none;';
            stHeader.innerHTML = '<span style="font-size:0.9em;">' + (isSearching ? '▼' : '▶') + '</span> ' + stName + ' <span style="opacity:0.5;font-weight:normal;">(' + stItems.length + ')</span>';
            typeBody.appendChild(stHeader);

            var stBody = document.createElement('div');
            if (!isSearching) stBody.style.display = 'none';
            typeBody.appendChild(stBody);

            (function(header, body) {
              header.addEventListener('click', function() {
                var arrow = header.querySelector('span');
                if (body.style.display === 'none') { body.style.display = ''; arrow.textContent = '▼'; }
                else { body.style.display = 'none'; arrow.textContent = '▶'; }
              });
            })(stHeader, stBody);
            targetContainer = stBody;
          }

          stItems.sort(function(a, b) { return a.name.localeCompare(b.name); });

          for (var j = 0; j < stItems.length; j++) {
            (function(obj) {
              var item = document.createElement('label');
              item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px 7px ' + (stName ? '36px' : '20px') + ';cursor:pointer;border-bottom:1px solid #e8dcc8;color:#1a1208;font-size:0.9em;';
              var cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = !!selected[obj.id];
              cb.style.cssText = 'width:16px;height:16px;accent-color:#8b5a2b;cursor:pointer;flex-shrink:0;';
              cb.addEventListener('change', function() {
                if (cb.checked) { selected[obj.id] = obj; } else { delete selected[obj.id]; }
                updateAddBtn();
              });
              item.appendChild(cb);
              var nameSpan = document.createElement('span');
              nameSpan.textContent = obj.name;
              item.appendChild(nameSpan);
              item.addEventListener('mouseenter', function() { item.style.background = '#f0e6d3'; });
              item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
              targetContainer.appendChild(item);
            })(stItems[j]);
          }
        }
      }
    }

    renderList('');

    searchInput.addEventListener('input', function() {
      renderList(searchInput.value);
    });

    modal.appendChild(list);
    setTimeout(function() { searchInput.focus(); }, 50);
  }

  // Button row: Add Selected + Cancel
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:16px;';

  var addBtn = document.createElement('button');
  addBtn.textContent = 'Add Selected';
  addBtn.style.cssText = 'padding:6px 14px;font-family:Lora,Georgia,serif;font-size:0.9em;background:linear-gradient(to bottom,#d4a373,#c8965a);color:#2b1e0f;border:1px solid #8b5a2b;border-radius:4px;cursor:pointer;opacity:0.5;pointer-events:none;';
  addBtn.addEventListener('click', function() {
    var ids = Object.keys(selected);
    for (var k = 0; k < ids.length; k++) {
      _addPerChitIndicator(selected[ids[k]]);
    }
    closeFn();
  });
  btnRow.appendChild(addBtn);

  function updateAddBtn() {
    var count = Object.keys(selected).length;
    if (count > 0) {
      addBtn.style.opacity = '1';
      addBtn.style.pointerEvents = '';
      addBtn.textContent = 'Add Selected (' + count + ')';
    } else {
      addBtn.style.opacity = '0.5';
      addBtn.style.pointerEvents = 'none';
      addBtn.textContent = 'Add Selected';
    }
  }

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:6px 14px;font-family:Lora,Georgia,serif;font-size:0.9em;background:#e8dcc8;color:#4a2c2a;border:1px solid #a0522d;border-radius:4px;cursor:pointer;';
  cancelBtn.addEventListener('mouseenter', function() { cancelBtn.style.background = '#d4c5a9'; });
  cancelBtn.addEventListener('mouseleave', function() { cancelBtn.style.background = '#e8dcc8'; });
  cancelBtn.addEventListener('click', function() { closeFn(); });
  btnRow.appendChild(cancelBtn);
  modal.appendChild(btnRow);
}

/**
 * Add a per-chit indicator to the current chit.
 * Renders the field into the appropriate category section, and marks dirty.
 * @param {object} obj - Custom Object to add
 */
function _addPerChitIndicator(obj) {
  window._perChitIndicators.push(obj.id);

  var container = document.getElementById('healthIndicatorsContent');
  if (!container) return;

  // Add divider if this is the first per-chit indicator
  if (!container.querySelector('.indicator-per-chit-divider')) {
    var divider = document.createElement('div');
    divider.className = 'indicator-per-chit-divider';
    var addBtn = container.querySelector('.indicator-add-btn');
    if (addBtn) {
      container.insertBefore(divider, addBtn);
    } else {
      container.appendChild(divider);
    }
  }

  // Find or create the category section for this per-chit indicator
  var catKey = obj.sub_type || obj.type || 'Other';
  var sectionId = 'indicator-pc-section-' + catKey.replace(/[^a-zA-Z0-9]/g, '_');
  var sectionBody = document.getElementById(sectionId);

  if (!sectionBody) {
    // Create a new section header + body for this category
    var sectionHeader = document.createElement('div');
    sectionHeader.className = 'indicator-section-header';
    sectionHeader.innerHTML = '<span class="indicator-section-arrow">▼</span> ' + catKey;
    sectionHeader.style.cssText = 'cursor:pointer;user-select:none;padding:6px 0 4px 0;font-size:0.85em;font-weight:bold;color:#4a2c2a;border-bottom:1px solid #e8dcc8;margin-bottom:4px;';

    sectionBody = document.createElement('div');
    sectionBody.className = 'indicator-section-body';
    sectionBody.id = sectionId;

    (function(header, body) {
      header.addEventListener('click', function() {
        var arrow = header.querySelector('.indicator-section-arrow');
        if (body.style.display === 'none') {
          body.style.display = '';
          if (arrow) arrow.textContent = '▼';
        } else {
          body.style.display = 'none';
          if (arrow) arrow.textContent = '▶';
        }
      });
    })(sectionHeader, sectionBody);

    // Insert before the Add button
    var addBtn = container.querySelector('.indicator-add-btn');
    if (addBtn) {
      container.insertBefore(sectionHeader, addBtn);
      container.insertBefore(sectionBody, addBtn);
    } else {
      container.appendChild(sectionHeader);
      container.appendChild(sectionBody);
    }
  }

  // Render the field into the section body
  var fieldEl = _renderIndicatorField(obj, null);
  sectionBody.appendChild(fieldEl);

  // Mark chit dirty
  setSaveButtonUnsaved();
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Get default indicators (zone_config.is_default === true).
 * @param {Array} objects - all indicator objects from zone query
 * @returns {Array}
 */
function _getDefaultIndicators(objects) {
  return objects.filter(function(obj) {
    var cfg = obj.zone_config || obj.config;
    return cfg && cfg.is_default === true;
  });
}

/**
 * Get non-default indicators (zone_config.is_default is false or absent).
 * @param {Array} objects - all indicator objects from zone query
 * @returns {Array}
 */
function _getNonDefaultIndicators(objects) {
  return objects.filter(function(obj) {
    var cfg = obj.zone_config || obj.config;
    return !cfg || cfg.is_default !== true;
  });
}

/**
 * Identify per-chit indicator UUIDs from health_data that are not in the default set.
 * These are non-default objects whose UUID appears as a key in health_data.
 * @param {object} healthData - UUID-keyed health data from chit
 * @param {Array} defaultObjects - default indicator objects
 * @param {Array} allObjects - all indicator objects from zone query
 * @returns {Array} UUIDs of per-chit indicators found in health_data
 */
function _identifyPerChitIndicators(healthData, defaultObjects, allObjects) {
  if (!healthData || typeof healthData !== 'object') return [];

  var defaultIds = {};
  for (var i = 0; i < defaultObjects.length; i++) {
    defaultIds[defaultObjects[i].id] = true;
  }

  // Build a lookup of all known object IDs in the zone
  var allObjectIds = {};
  for (var j = 0; j < allObjects.length; j++) {
    allObjectIds[allObjects[j].id] = true;
  }

  var perChitIds = [];
  var keys = Object.keys(healthData);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    // Only consider keys that are known object UUIDs and NOT in the default set
    if (allObjectIds[key] && !defaultIds[key]) {
      perChitIds.push(key);
    }
  }
  return perChitIds;
}

/**
 * Load health data for a chit. Orchestrates: parse health_data, fetch objects,
 * evaluate conditional display, render default indicators, then per-chit indicators
 * with a visual divider between them.
 * @param {object} chit - the chit object (may have health_data as string or object)
 */
async function _loadHealthData(chit) {
  // Parse health_data from chit
  window._healthData = {};
  if (chit.health_data) {
    try {
      var parsed = (typeof chit.health_data === 'string')
        ? JSON.parse(chit.health_data) : chit.health_data;
      window._healthData = parsed || {};
    } catch (e) {
      console.warn('[editor-health] Failed to parse health_data:', e);
      window._healthData = {};
    }
  }

  // Reset per-chit indicators
  window._perChitIndicators = [];

  // Get user settings for unit system and conditional display
  var settings = {};
  try {
    settings = await getCachedSettings();
  } catch (e) {
    settings = {};
  }
  window._healthUnitSystem = settings.unit_system || 'imperial';

  // Fetch indicator objects from zone
  var objects = await _fetchIndicatorObjects();

  // Get the container and clear it
  var container = document.getElementById('healthIndicatorsContent');
  if (!container) return;
  container.innerHTML = '';

  // If no objects, show a message
  if (!objects || objects.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'indicator-empty-msg';
    emptyMsg.textContent = 'No indicators configured — visit Custom Objects Editor to set up.';
    container.appendChild(emptyMsg);
    return;
  }

  // Sort by zone_sort_order (should already be sorted from API, but ensure)
  var sorted = objects.slice().sort(function(a, b) {
    return (a.zone_sort_order || 0) - (b.zone_sort_order || 0);
  });

  // Split into default and non-default sets
  var defaultObjects = _getDefaultIndicators(sorted);
  var nonDefaultObjects = _getNonDefaultIndicators(sorted);

  // Identify per-chit indicators from health_data (non-default UUIDs with values)
  var perChitIds = _identifyPerChitIndicators(window._healthData, defaultObjects, sorted);
  window._perChitIndicators = perChitIds.slice();

  // ── Render default indicators grouped by category ────────────────────────
  var renderedDefault = 0;

  // Group default objects by category (fallback to type if no category)
  var groups = {};
  var groupOrder = [];
  for (var i = 0; i < defaultObjects.length; i++) {
    var obj = defaultObjects[i];

    // Evaluate conditional display rule
    if (!_evaluateConditionalDisplay(obj.conditional_display, settings)) {
      continue;
    }

    var groupKey = obj.sub_type || obj.type || 'Other';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
      groupOrder.push(groupKey);
    }
    groups[groupKey].push(obj);
  }

  // Sort groups alphabetically
  groupOrder.sort(function(a, b) { return a.localeCompare(b); });

  // Render each group as a collapsible section
  for (var g = 0; g < groupOrder.length; g++) {
    var groupName = groupOrder[g];
    var groupItems = groups[groupName];

    // Section header (collapsible)
    var sectionHeader = document.createElement('div');
    sectionHeader.className = 'indicator-section-header';
    sectionHeader.innerHTML = '<span class="indicator-section-arrow">▼</span> ' + groupName;
    sectionHeader.style.cssText = 'cursor:pointer;user-select:none;padding:6px 0 4px 0;font-size:0.85em;font-weight:bold;color:#4a2c2a;border-bottom:1px solid #e8dcc8;margin-bottom:4px;';
    container.appendChild(sectionHeader);

    // Section body
    var sectionBody = document.createElement('div');
    sectionBody.className = 'indicator-section-body';
    container.appendChild(sectionBody);

    // Wire collapse toggle
    (function(header, body) {
      header.addEventListener('click', function() {
        var arrow = header.querySelector('.indicator-section-arrow');
        if (body.style.display === 'none') {
          body.style.display = '';
          if (arrow) arrow.textContent = '▼';
        } else {
          body.style.display = 'none';
          if (arrow) arrow.textContent = '▶';
        }
      });
    })(sectionHeader, sectionBody);

    // Render fields in this group
    for (var fi = 0; fi < groupItems.length; fi++) {
      var gObj = groupItems[fi];
      var value = window._healthData[gObj.id];
      if (value === undefined) value = null;
      var fieldEl = _renderIndicatorField(gObj, value);
      sectionBody.appendChild(fieldEl);
      renderedDefault++;
    }
  }

  // ── Render per-chit indicators (with divider), grouped by category ────────
  if (perChitIds.length > 0) {
    // Add visual divider between default and per-chit indicators
    var divider = document.createElement('div');
    divider.className = 'indicator-per-chit-divider';
    container.appendChild(divider);

    // Group per-chit indicators by category
    var pcGroups = {};
    var pcGroupOrder = [];
    for (var p = 0; p < perChitIds.length; p++) {
      var pcId = perChitIds[p];
      var pcObj = null;
      for (var n = 0; n < nonDefaultObjects.length; n++) {
        if (nonDefaultObjects[n].id === pcId) {
          pcObj = nonDefaultObjects[n];
          break;
        }
      }
      if (!pcObj) continue;
      if (!_evaluateConditionalDisplay(pcObj.conditional_display, settings)) continue;

      var pcGroupKey = pcObj.sub_type || pcObj.type || 'Other';
      if (!pcGroups[pcGroupKey]) {
        pcGroups[pcGroupKey] = [];
        pcGroupOrder.push(pcGroupKey);
      }
      pcGroups[pcGroupKey].push(pcObj);
    }

    // Sort per-chit groups alphabetically
    pcGroupOrder.sort(function(a, b) { return a.localeCompare(b); });

    for (var pg = 0; pg < pcGroupOrder.length; pg++) {
      var pcGroupName = pcGroupOrder[pg];
      var pcGroupItems = pcGroups[pcGroupName];

      // Section header
      var pcSectionHeader = document.createElement('div');
      pcSectionHeader.className = 'indicator-section-header';
      pcSectionHeader.innerHTML = '<span class="indicator-section-arrow">▼</span> ' + pcGroupName;
      pcSectionHeader.style.cssText = 'cursor:pointer;user-select:none;padding:6px 0 4px 0;font-size:0.85em;font-weight:bold;color:#4a2c2a;border-bottom:1px solid #e8dcc8;margin-bottom:4px;';
      container.appendChild(pcSectionHeader);

      var pcSectionBody = document.createElement('div');
      pcSectionBody.className = 'indicator-section-body';
      container.appendChild(pcSectionBody);

      (function(header, body) {
        header.addEventListener('click', function() {
          var arrow = header.querySelector('.indicator-section-arrow');
          if (body.style.display === 'none') {
            body.style.display = '';
            if (arrow) arrow.textContent = '▼';
          } else {
            body.style.display = 'none';
            if (arrow) arrow.textContent = '▶';
          }
        });
      })(pcSectionHeader, pcSectionBody);

      for (var pfi = 0; pfi < pcGroupItems.length; pfi++) {
        var pcFieldObj = pcGroupItems[pfi];
        var pcValue = window._healthData[pcFieldObj.id];
        if (pcValue === undefined) pcValue = null;
        var pcFieldEl = _renderIndicatorField(pcFieldObj, pcValue);
        pcSectionBody.appendChild(pcFieldEl);
      }
    }
  }

  if (renderedDefault === 0 && perChitIds.length === 0) {
    var noVisibleMsg = document.createElement('div');
    noVisibleMsg.className = 'indicator-empty-msg';
    noVisibleMsg.textContent = 'No indicators visible with current settings.';
    container.appendChild(noVisibleMsg);
  }

  // ── "+ Add Indicator" button ─────────────────────────────────────────────────
  var addBtn = document.createElement('button');
  addBtn.className = 'zone-button indicator-add-btn';
  addBtn.textContent = '+ Custom Object';
  addBtn.style.cssText = 'margin-top:10px;align-self:flex-start;';
  addBtn.addEventListener('click', function() {
    _showAddIndicatorPicker();
  });
  container.appendChild(addBtn);
}

/**
 * Gather current health data values into a UUID-keyed object for saving.
 * Includes both default and per-chit indicator values.
 * Per-chit indicator UUIDs are persisted in health_data so they reappear on reload.
 * Returns null if no readings have values.
 * @returns {object|null}
 */
function _gatherHealthData() {
  var result = {};

  // Collect all values from _healthData (includes both default and per-chit)
  for (var key in window._healthData) {
    if (window._healthData[key] != null && window._healthData[key] !== '') {
      result[key] = window._healthData[key];
    }
  }

  // Ensure per-chit indicator UUIDs are persisted even if their value is currently
  // null/empty — this preserves the "added" state so they reappear on reload.
  // We store them with their current value (which may be null if user cleared it).
  // If the value is null/empty, we still include the key so the per-chit indicator
  // reappears on next load. We use a sentinel: if value is truly empty, store null
  // to signal "this indicator was added but has no reading."
  for (var i = 0; i < window._perChitIndicators.length; i++) {
    var pcId = window._perChitIndicators[i];
    if (!(pcId in result)) {
      // Per-chit indicator was added but has no value — persist with null
      // so it reappears on reload
      result[pcId] = null;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
