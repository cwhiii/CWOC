const timeFormatGrid = document.getElementById("time-format-grid");
const inactiveZone = document.getElementById("inactive-zone");
const clocksContainer = document.getElementById("clocks-container");
const formats = [
  { value: "24hour", label: "24 Hour" },
  { value: "hst", label: "HST" },
  { value: "12hour", label: "12 Hour" },
  { value: "12houranalog", label: "12 Hour Analog" },
];

// Color mapping from main.js
const colorMap = {
  "#C66B6B": "Dusty Rose",
  "#D68A59": "Burnt Sienna",
  "#E3B23C": "Golden Ochre",
  "#8A9A5B": "Mossy Sage",
  "#6B8299": "Slate Teal",
  "#A8A2C6": "Muted Lilac",
};

// ── Saved Locations ──────────────────────────────────────────────────────────

/**
 * Render saved location rows into #locations-list from data array.
 * @param {Array<{label:string, address:string, is_default:boolean}>} locations
 */
function renderLocationsSection(locations) {
  const container = document.getElementById("locations-list");
  if (!container) return;
  container.innerHTML = "";
  if (!locations || locations.length === 0) {
    locations = [{ label: "", address: "", is_default: false }];
  }
  locations.forEach((loc, idx) => {
    _appendLocationRow(container, loc.label || "", loc.address || "", loc.is_default);
  });
}

/**
 * Append a single location row to the container.
 */
function _appendLocationRow(container, label, address, isDefault) {
  const row = document.createElement("div");
  row.className = "location-row";

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "default-location";
  radio.checked = !!isDefault;
  radio.title = "Set as default location";
  radio.addEventListener("change", () => setSaveButtonUnsaved());

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "location-label-input";
  labelInput.placeholder = "Label";
  labelInput.value = label;
  labelInput.addEventListener("input", () => {
    setSaveButtonUnsaved();
    _autoSelectSingleLocation();
  });

  const addressInput = document.createElement("input");
  addressInput.type = "text";
  addressInput.className = "location-address-input";
  addressInput.placeholder = "Address";
  addressInput.value = address;
  addressInput.autocomplete = "street-address";
  addressInput.name = "street-address";
  addressInput.addEventListener("input", () => {
    setSaveButtonUnsaved();
    _autoSelectSingleLocation();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-location-btn";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove location";
  removeBtn.addEventListener("click", () => {
    const allRows = container.querySelectorAll(".location-row");
    if (allRows.length <= 1) {
      // Don't remove the last row — just clear it
      labelInput.value = "";
      addressInput.value = "";
      radio.checked = false;
    } else {
      row.remove();
      _autoSelectSingleLocation();
    }
    setSaveButtonUnsaved();
  });

  row.appendChild(radio);
  row.appendChild(labelInput);
  row.appendChild(addressInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

/**
 * Global function called by the "+" button — adds an empty location row.
 */
function addLocationRow() {
  const container = document.getElementById("locations-list");
  if (!container) return;
  _appendLocationRow(container, "", "", false);
  setSaveButtonUnsaved();
}

/**
 * Auto-select logic: if exactly one row has a non-empty address, auto-check its radio.
 */
function _autoSelectSingleLocation() {
  const container = document.getElementById("locations-list");
  if (!container) return;
  const rows = container.querySelectorAll(".location-row");
  const nonEmptyRows = [];
  rows.forEach(row => {
    const addr = row.querySelector(".location-address-input");
    if (addr && addr.value.trim()) nonEmptyRows.push(row);
  });
  if (nonEmptyRows.length === 1) {
    const radio = nonEmptyRows[0].querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }
}

/**
 * Read all location rows from the DOM and return the array for saving.
 * Filters out empty-address rows (keeps at least one).
 * @returns {Array<{label:string, address:string, is_default:boolean}>}
 */
function collectLocationsData() {
  const container = document.getElementById("locations-list");
  if (!container) return [];
  const rows = container.querySelectorAll(".location-row");
  const all = [];
  rows.forEach(row => {
    const label = row.querySelector(".location-label-input")?.value?.trim() || "";
    const address = row.querySelector(".location-address-input")?.value?.trim() || "";
    const isDefault = row.querySelector('input[type="radio"]')?.checked || false;
    all.push({ label, address, is_default: isDefault });
  });
  // Filter out empty-address rows, but keep at least one
  const nonEmpty = all.filter(loc => loc.address !== "");
  if (nonEmpty.length === 0) {
    return [{ label: "", address: "", is_default: false }];
  }
  return nonEmpty;
}

function updateGrid(preserveOrder = false) {
  const activeFormats = Array.from(
    timeFormatGrid.querySelectorAll(".format-item"),
  ).map((item) => item.dataset.value);
  if (!preserveOrder) {
    timeFormatGrid.innerHTML = "";
    const filteredFormats = formats.filter(
      (f) =>
        !inactiveZone.querySelector(`.inactive-item[data-value="${f.value}"]`),
    );
    if (filteredFormats.length === 0) {
      timeFormatGrid.classList.add("empty");
      const addButton = document.createElement("button");
      addButton.className = "add-clock-button";
      addButton.textContent = "➕ Add Clock";
      addButton.onclick = addFirstClock;
      timeFormatGrid.appendChild(addButton);
      return;
    }
    timeFormatGrid.classList.remove("empty");
    filteredFormats.forEach((_, index) => {
      const slot = document.createElement("div");
      slot.className = "grid-slot";
      slot.dataset.index = index;
      timeFormatGrid.appendChild(slot);
    });
    filteredFormats.forEach((format, index) => {
      const slot = timeFormatGrid.querySelector(
        `.grid-slot[data-index="${index}"]`,
      );
      slot.innerHTML = `<div class="format-item" draggable="true" data-value="${format.value}">${format.label}</div>`;
    });
  }
  updateInactiveZone();
  setupDragListeners();
}

document.querySelectorAll(".filter-input").forEach((input) => {
  input.addEventListener("input", function () {
    processTagsInInput(this);
  });

  input.addEventListener("blur", function () {
    processTagsInInput(this);
  });
});

function processTagsInInput(input) {
  const value = input.value;
  const tagPattern = /#[a-zA-Z0-9_]+/g;
  let match;

  if (
    !input.nextElementSibling ||
    !input.nextElementSibling.classList.contains("filter-display")
  ) {
    const displayDiv = document.createElement("div");
    displayDiv.className = "filter-display";
    input.parentNode.insertBefore(displayDiv, input.nextSibling);
  }

  const displayDiv = input.nextElementSibling;

  const hasTags = tagPattern.test(value);
  tagPattern.lastIndex = 0;

  if (hasTags) {
    let lastIndex = 0;
    let processed = "";

    while ((match = tagPattern.exec(value)) !== null) {
      const tag = match[0];
      const startIndex = match.index;

      processed += value.substring(lastIndex, startIndex);

      processed += `<span class="tag-in-input">${tag}</span>`;

      lastIndex = startIndex + tag.length;
    }

    processed += value.substring(lastIndex);

    displayDiv.innerHTML = processed;
    displayDiv.style.display = "block";

    input.style.color = "transparent";
    input.style.caretColor = "#2b1e0f";
  } else {
    displayDiv.style.display = "none";
    input.style.color = "#2b1e0f";
  }
}

function updateInactiveZone() {
  inactiveZone.innerHTML = "";
  const activeFormats = Array.from(
    timeFormatGrid.querySelectorAll(".format-item"),
  ).map((item) => item.dataset.value);
  formats.forEach((format) => {
    if (!activeFormats.includes(format.value)) {
      const item = document.createElement("div");
      item.className = "inactive-item";
      item.draggable = true;
      item.dataset.value = format.value;
      item.textContent = format.label;
      inactiveZone.appendChild(item);
    }
  });
  inactiveZone.classList.toggle("empty", inactiveZone.children.length === 0);
}

function setupDragListeners() {
  document.querySelectorAll(".format-item").forEach((item) => {
    item.ondragstart = handleDragStart;
    item.ondragend = handleDragEnd;
  });
  document.querySelectorAll(".grid-slot").forEach((slot) => {
    slot.ondragover = handleDragOver;
    slot.ondrop = handleDropOnGrid;
  });
  document.querySelectorAll(".inactive-item").forEach((item) => {
    item.ondragstart = handleDragStart;
    item.ondragend = handleDragEnd;
  });
  timeFormatGrid.ondragover = handleDragOver;
  timeFormatGrid.ondrop = handleDropOnGrid;
  inactiveZone.ondragover = handleDragOver;
  inactiveZone.ondrop = handleDropOnInactive;
}

function handleDragStart(e) {
  e.dataTransfer.setData("text/plain", e.target.dataset.value);
  e.target.style.opacity = "0.5";
}

function handleDragEnd(e) {
  e.target.style.opacity = "1";
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDropOnGrid(e) {
  e.preventDefault();
  const draggedValue = e.dataTransfer.getData("text/plain");
  const dropTarget = e.target.closest(".grid-slot") || timeFormatGrid;
  const draggedItem =
    document.querySelector(`.format-item[data-value="${draggedValue}"]`) ||
    document.querySelector(`.inactive-item[data-value="${draggedValue}"]`);
  if (!draggedItem) return;
  if (draggedItem.classList.contains("inactive-item")) {
    const format = formats.find((f) => f.value === draggedValue);
    if (!format) return;
    const newFormatItem = document.createElement("div");
    newFormatItem.className = "format-item";
    newFormatItem.draggable = true;
    newFormatItem.dataset.value = format.value;
    newFormatItem.textContent = format.label;
    const newSlot = document.createElement("div");
    newSlot.className = "grid-slot";
    newSlot.dataset.index = timeFormatGrid.children.length;
    newSlot.appendChild(newFormatItem);
    timeFormatGrid.appendChild(newSlot);
    draggedItem.remove();
    updateGrid(true);
  } else if (
    dropTarget.classList.contains("grid-slot") &&
    dropTarget.querySelector(".format-item") &&
    dropTarget.querySelector(".format-item") !== draggedItem
  ) {
    const targetItem = dropTarget.querySelector(".format-item");
    const tempValue = targetItem.dataset.value;
    const tempText = targetItem.textContent;
    targetItem.dataset.value = draggedValue;
    targetItem.textContent = draggedItem.textContent;
    draggedItem.dataset.value = tempValue;
    draggedItem.textContent = tempText;
    setupDragListeners();
  }
  setSaveButtonUnsaved();
}

function handleDropOnInactive(e) {
  e.preventDefault();
  const draggedValue = e.dataTransfer.getData("text/plain");
  const draggedItem = timeFormatGrid.querySelector(
    `.format-item[data-value="${draggedValue}"]`,
  );
  if (draggedItem) {
    const item = document.createElement("div");
    item.className = "inactive-item";
    item.draggable = true;
    item.dataset.value = draggedValue;
    item.textContent = draggedItem.textContent;
    inactiveZone.appendChild(item);
    draggedItem.parentElement.remove();
    updateGrid(true);
  }
  setSaveButtonUnsaved();
}

/** Toggle visibility of combined vs individual alert rows based on Combine Alerts checkbox */
function _toggleCombineAlerts() {
  var cb = document.getElementById('combine-alerts-toggle');
  var individual = document.getElementById('individual-alert-rows');
  var combined = document.getElementById('combined-alert-row');
  if (individual) individual.style.display = (cb && cb.checked) ? 'none' : '';
  if (combined) combined.style.display = (cb && cb.checked) ? '' : 'none';
  setSaveButtonUnsaved();
}

/** Toggle disabled state of audit prune inputs based on Enable Pruning checkbox */
function toggleAuditPruneInputs() {
  var cb = document.getElementById('audit-prune-enabled');
  var daysInput = document.getElementById('audit-max-days');
  var mbInput = document.getElementById('audit-max-mb');
  var disabled = !(cb && cb.checked);
  if (daysInput) { daysInput.disabled = disabled; daysInput.style.opacity = disabled ? '0.5' : '1'; }
  if (mbInput) { mbInput.disabled = disabled; mbInput.style.opacity = disabled ? '0.5' : '1'; }
}

// ── Map Settings ──────────────────────────────────────────────────────────────

/** Toggle disabled/dimmed state of lat/lon/zoom inputs based on auto-zoom checkbox */
function _toggleMapAutoZoom() {
  var cb = document.getElementById('map-auto-zoom');
  var container = document.getElementById('map-custom-view-settings');
  if (!container) return;
  var disabled = (cb && cb.checked);
  var inputs = container.querySelectorAll('input[type="number"]');
  inputs.forEach(function(inp) {
    inp.disabled = disabled;
    inp.style.opacity = disabled ? '0.5' : '1';
  });
}

/** Populate map settings UI from the settings object on page load */
function _loadMapSettings(settings) {
  var cb = document.getElementById('map-auto-zoom');
  if (cb) cb.checked = (settings.map_auto_zoom !== '0');

  var latInput = document.getElementById('map-default-lat');
  if (latInput) latInput.value = (settings.map_default_lat != null && settings.map_default_lat !== '') ? settings.map_default_lat : '';

  var lonInput = document.getElementById('map-default-lon');
  if (lonInput) lonInput.value = (settings.map_default_lon != null && settings.map_default_lon !== '') ? settings.map_default_lon : '';

  var zoomInput = document.getElementById('map-default-zoom');
  if (zoomInput) zoomInput.value = (settings.map_default_zoom != null && settings.map_default_zoom !== '') ? settings.map_default_zoom : '';

  _toggleMapAutoZoom();
}

/** Read map settings UI values for inclusion in the save payload */
function _collectMapSettings() {
  var cb = document.getElementById('map-auto-zoom');
  var latInput = document.getElementById('map-default-lat');
  var lonInput = document.getElementById('map-default-lon');
  var zoomInput = document.getElementById('map-default-zoom');

  // Validate lat/lon/zoom ranges
  var lat = latInput ? latInput.value.trim() : '';
  var lon = lonInput ? lonInput.value.trim() : '';
  var zoom = zoomInput ? zoomInput.value.trim() : '';

  if (lat !== '') {
    var latNum = parseFloat(lat);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      lat = '';
      if (latInput) latInput.value = '';
    }
  }
  if (lon !== '') {
    var lonNum = parseFloat(lon);
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      lon = '';
      if (lonInput) lonInput.value = '';
    }
  }
  if (zoom !== '') {
    var zoomNum = parseInt(zoom, 10);
    if (isNaN(zoomNum) || zoomNum < 1 || zoomNum > 18) {
      zoom = '';
      if (zoomInput) zoomInput.value = '';
    }
  }

  return {
    map_auto_zoom: (cb && cb.checked) ? '1' : '0',
    map_default_lat: lat || null,
    map_default_lon: lon || null,
    map_default_zoom: zoom || null,
  };
}

/** Toggle visibility of Work Week config based on Work Hours period checkbox */
function _toggleWorkConfig() {
  var workCb = document.querySelector('.period-cb[value="Work"]');
  var config = document.getElementById('work-config');
  if (config) config.style.display = (workCb && workCb.checked) ? '' : 'none';
}

/** Toggle visibility of X Days config based on SevenDay period checkbox */
function _toggleXDaysConfig() {
  var xdCb = document.querySelector('.period-cb[value="SevenDay"]');
  var config = document.getElementById('xdays-config');
  if (config) config.style.display = (xdCb && xdCb.checked) ? '' : 'none';
}

/**
 * Populate a pair of hour dropdowns (start/end) with all hours 0–24,
 * then constrain each based on the other's selection.
 * Start shows hours 0–23, End shows hours 1–24.
 * When start is picked, end only shows hours > start.
 * When end is picked, start only shows hours < end.
 */
function _initHourDropdownPair(startId, endId, defaultStart, defaultEnd) {
  var startSel = document.getElementById(startId);
  var endSel = document.getElementById(endId);
  if (!startSel || !endSel) return;

  function _pad(n) { return String(n).padStart(2, '0'); }

  // Populate start with 0–23
  startSel.innerHTML = '';
  for (var h = 0; h <= 23; h++) {
    var opt = document.createElement('option');
    opt.value = h;
    opt.textContent = _pad(h) + ':00';
    if (h === defaultStart) opt.selected = true;
    startSel.appendChild(opt);
  }

  // Populate end with 1–24
  endSel.innerHTML = '';
  for (var h = 1; h <= 24; h++) {
    var opt = document.createElement('option');
    opt.value = h;
    opt.textContent = _pad(h === 24 ? 0 : h) + ':00' + (h === 24 ? ' (end)' : '');
    if (h === defaultEnd) opt.selected = true;
    endSel.appendChild(opt);
  }

  _syncHourDropdowns(startId, endId);
}

/**
 * After one dropdown changes, disable/hide options in the other that would
 * create an invalid range (end <= start).
 */
function _syncHourDropdowns(startId, endId) {
  var startSel = document.getElementById(startId);
  var endSel = document.getElementById(endId);
  if (!startSel || !endSel) return;

  var startVal = parseInt(startSel.value);
  var endVal = parseInt(endSel.value);

  // Hide end options <= start
  Array.from(endSel.options).forEach(function (opt) {
    var v = parseInt(opt.value);
    opt.disabled = v <= startVal;
    opt.style.display = v <= startVal ? 'none' : '';
  });

  // Hide start options >= end
  Array.from(startSel.options).forEach(function (opt) {
    var v = parseInt(opt.value);
    opt.disabled = v >= endVal;
    opt.style.display = v >= endVal ? 'none' : '';
  });

  setSaveButtonUnsaved();
}

function addFirstClock() {
  const firstInactive = inactiveZone.querySelector(".inactive-item");
  if (firstInactive) {
    firstInactive.remove();
    updateGrid();
  }
  setSaveButtonUnsaved();
}

function toggleOrientation() {
  clocksContainer.classList.toggle("vertical");
  timeFormatGrid.classList.toggle("vertical");
  if (clocksContainer.classList.contains("vertical")) {
    timeFormatGrid.style.order = "1";
    inactiveZone.style.order = "2";
  } else {
    timeFormatGrid.style.order = "1";
    inactiveZone.style.order = "2";
  }
  updateGrid(true);
  setSaveButtonUnsaved();
}

function _isColorLight(hexColor) {
  const c = hexColor.charAt(0) === "#" ? hexColor.substring(1) : hexColor;
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186;
}

async function loadColors() {
  try {
    const data = await getCachedSettings();

    // Normalize colors: convert strings to objects { hex, name }
    const colors = (data.custom_colors || []).map((c) =>
      typeof c === "string" ? { hex: c, name: colorMap[c] || "Custom" } : c,
    );

    renderColors(colors);

    return colors;
  } catch (error) {
    console.error("Error loading colors:", error);
    alert("Error loading colors");
    return [];
  }
}

function openColorPicker() {
  const colorInput = document.getElementById("color-picker");
  colorInput.value = "#000000"; // default color or last used
  colorInput.click();
  colorInput.onchange = () => {
    const newColor = { hex: colorInput.value, name: "Custom" };
    addColor(newColor);
  };
}

async function saveColors(colors) {
  try {
    const colorsToSave = colors
      .filter((color) => color && typeof color.hex === "string")
      .map((color) => color.hex);

    // Prepare the settings object with user_id and custom_colors
    const settingsToSave = {
      user_id: (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().user_id : 'default_user',
      custom_colors: colorsToSave,
    };

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsToSave),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Save failed: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }

    _invalidateSettingsCache(); // saved data changed
  } catch (error) {
    console.error("Failed to save colors:", error);
    alert("Failed to save colors");
    throw error;
  }
}

async function addColor(newColor) {
  try {
    // Load current colors (array of objects)
    const colors = await loadColors();

    // Add new color object { hex, name }
    colors.push(newColor);

    // Save updated colors (only hex strings will be sent)
    await saveColors(colors);

    // Render updated colors
    renderColors(colors);
  } catch (error) {
    console.error("Add color error:", error);
    alert("Failed to add color");
  }
}

async function deleteColor(hex, name) {
  // Use the existing delete-modal instead of confirm()
  var modal = document.getElementById('delete-modal');
  if (!modal) { if (!(await cwocConfirm('Delete color (' + name + ' - ' + hex + ')?', { title: 'Delete Color', confirmLabel: '🗑️ Delete', danger: true }))) return; }
  else {
    var msg = modal.querySelector('p');
    if (msg) msg.textContent = 'Delete color ' + (name || 'Custom') + ' (' + hex + ')?';
    modal.style.display = 'flex';
    // Wait for user to confirm or cancel
    var confirmed = await new Promise(function (resolve) {
      var confirmBtn = modal.querySelector('button[onclick="confirmDelete()"]');
      var cancelBtn = modal.querySelector('button[onclick="closeDeleteModal()"]');
      // Temporarily override handlers
      var onConfirm = function () { cleanup(); resolve(true); };
      var onCancel = function () { cleanup(); resolve(false); };
      function cleanup() {
        if (confirmBtn) { confirmBtn.removeEventListener('click', onConfirm); confirmBtn.onclick = function () { confirmDelete(); }; }
        if (cancelBtn) { cancelBtn.removeEventListener('click', onCancel); cancelBtn.onclick = function () { closeDeleteModal(); }; }
        modal.style.display = 'none';
      }
      if (confirmBtn) { confirmBtn.onclick = null; confirmBtn.addEventListener('click', onConfirm); }
      if (cancelBtn) { cancelBtn.onclick = null; cancelBtn.addEventListener('click', onCancel); }
    });
    if (!confirmed) return;
  }
  try {
    _invalidateSettingsCache();
    const settings = await getCachedSettings();
    settings.custom_colors = (settings.custom_colors || []).filter(
      (color) => !(color.hex === hex && color.name === name),
    );
    const saveResponse = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!saveResponse.ok) throw new Error("Failed to save settings");
    _invalidateSettingsCache();
    await loadColors();
    setSaveButtonUnsaved();
  } catch (e) {
    alert("Failed to delete color");
  }
}

function renderColors(colors) {
  // ── Default Colors section ──
  var defaultColorList = document.getElementById("default-color-list");
  if (defaultColorList) {
    defaultColorList.innerHTML = "";
    // Fixed default palette — these never change color
    var defaultPalette = [
      { hex: "transparent", name: "Transparent" },
      { hex: "#C66B6B", name: "Dusty Rose" },
      { hex: "#D68A59", name: "Burnt Sienna" },
      { hex: "#E3B23C", name: "Golden Ochre" },
      { hex: "#8A9A5B", name: "Mossy Sage" },
      { hex: "#6B8299", name: "Slate Teal" },
      { hex: "#8B6B99", name: "Muted Lilac" },
      { hex: "#b22222", name: "Firebrick" },
      { hex: "#DAA520", name: "Goldenrod" },
    ];
    defaultPalette.forEach(function(c) {
      var colorItem = document.createElement("div");
      colorItem.className = "color-item";
      colorItem.dataset.color = c.hex;
      colorItem.dataset.name = c.name;
      if (c.hex === "transparent") {
        colorItem.style.background = "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px";
      } else {
        colorItem.style.backgroundColor = c.hex;
      }
      colorItem.title = c.name + " (" + c.hex + ")";
      // No delete button for defaults
      // Click handler for border assignment
      colorItem.addEventListener("click", function(e) { _openBorderAssignPopup(e, c.hex); });
      defaultColorList.appendChild(colorItem);
    });
  }

  // ── Custom Colors section ──
  var colorList = document.getElementById("color-list");
  if (!colorList) return;
  colorList.innerHTML = "";
  if (colors && colors.length > 0) {
    colors.forEach(function(c) {
      var hex = c.hex || c;
      var name = c.name || colorMap[hex] || "Custom";
      var colorItem = document.createElement("div");
      colorItem.className = "color-item";
      colorItem.dataset.color = hex;
      colorItem.dataset.name = name;
      colorItem.style.backgroundColor = hex;
      colorItem.title = name + " (" + hex + ")";

      // Delete button for custom colors
      var deleteBtn = document.createElement("button");
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = function(e) {
        e.stopPropagation();
        deleteColor(hex, name);
      };
      colorItem.appendChild(deleteBtn);

      // Click handler for border assignment
      colorItem.addEventListener("click", function(e) { _openBorderAssignPopup(e, hex); });

      colorList.appendChild(colorItem);
    });
  }

  // Apply ring indicators to all swatches
  _applyBorderColorRings();
}

/** Track current border color values (loaded from settings) */
var _borderColorOverdue = '#b22222';
var _borderColorBlocked = '#DAA520';

/** Apply ring indicator CSS classes to color swatches matching border colors.
 *  Rings are hidden when the corresponding highlight toggle is unchecked. */
function _applyBorderColorRings() {
  var overdueEnabled = document.getElementById('highlight-overdue')?.checked ?? true;
  var blockedEnabled = document.getElementById('highlight-blocked')?.checked ?? true;
  var overdueHex = (_borderColorOverdue || '#b22222').toLowerCase();
  var blockedHex = (_borderColorBlocked || '#DAA520').toLowerCase();

  // Update ring CSS custom values for dynamic colors
  var styleEl = document.getElementById('border-ring-dynamic-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'border-ring-dynamic-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent =
    '.color-item.ring-overdue { box-shadow: 0 0 0 2px #fff8e1, 0 0 0 4px ' + overdueHex + '; margin: 4px; }' +
    '.color-item.ring-blocked { box-shadow: 0 0 0 2px #fff8e1, 0 0 0 4px ' + blockedHex + '; margin: 4px; }' +
    '.color-item.ring-both { box-shadow: 0 0 0 2px #fff8e1, 0 0 0 4px ' + overdueHex + ', 0 0 0 6px #fff8e1, 0 0 0 8px ' + blockedHex + '; margin: 6px; }';

  // Clear all rings first
  document.querySelectorAll('#default-color-list .color-item, #color-list .color-item').forEach(function(el) {
    el.classList.remove('ring-overdue', 'ring-blocked', 'ring-both');
    var lbl = el.querySelector('.ring-label');
    if (lbl) lbl.remove();
  });

  // Apply rings only for enabled highlights
  document.querySelectorAll('#default-color-list .color-item, #color-list .color-item').forEach(function(el) {
    var hex = (el.dataset.color || '').toLowerCase();
    var isOverdue = overdueEnabled && hex === overdueHex;
    var isBlocked = blockedEnabled && hex === blockedHex;
    if (isOverdue && isBlocked) {
      el.classList.add('ring-both');
      var lbl = document.createElement('span');
      lbl.className = 'ring-label';
      lbl.innerHTML = 'Overdue<br>Blocked';
      el.appendChild(lbl);
    } else if (isOverdue) {
      el.classList.add('ring-overdue');
      var lbl = document.createElement('span');
      lbl.className = 'ring-label';
      lbl.textContent = 'Overdue';
      el.appendChild(lbl);
    } else if (isBlocked) {
      el.classList.add('ring-blocked');
      var lbl = document.createElement('span');
      lbl.className = 'ring-label';
      lbl.textContent = 'Blocked';
      el.appendChild(lbl);
    }
  });

  // Show/hide the border assignment buttons based on toggles
  var overdueBtn = document.getElementById('assign-overdue-btn');
  var blockedBtn = document.getElementById('assign-blocked-btn');
  if (overdueBtn) overdueBtn.style.display = overdueEnabled ? '' : 'none';
  if (blockedBtn) blockedBtn.style.display = blockedEnabled ? '' : 'none';
}

/** Called when highlight-overdue or highlight-blocked toggles change */
function _onHighlightToggle() {
  _applyBorderColorRings();
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

/** Open the border color assignment popup near the clicked swatch */
function _openBorderAssignPopup(e, hex) {
  e.stopPropagation();
  var popup = document.getElementById('border-assign-popup');
  if (!popup) return;

  // Position near the click
  var rect = e.currentTarget.getBoundingClientRect();
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.display = 'block';

  // Wire up buttons
  var overdueBtn = document.getElementById('assign-overdue-btn');
  var blockedBtn = document.getElementById('assign-blocked-btn');
  var cancelBtn = document.getElementById('assign-cancel-btn');

  function cleanup() {
    popup.style.display = 'none';
    document.removeEventListener('click', outsideClick);
  }
  function outsideClick(ev) {
    if (!popup.contains(ev.target)) cleanup();
  }
  // Delay adding outside-click listener so the current click doesn't close it
  setTimeout(function() { document.addEventListener('click', outsideClick); }, 0);

  overdueBtn.onclick = function() {
    _borderColorOverdue = hex;
    cleanup();
    var customColors = Array.from(document.querySelectorAll('#color-list .color-item')).map(function(el) {
      return { hex: el.dataset.color, name: el.dataset.name };
    });
    renderColors(customColors);
    setSaveButtonUnsaved();
  };
  blockedBtn.onclick = function() {
    _borderColorBlocked = hex;
    cleanup();
    var customColors = Array.from(document.querySelectorAll('#color-list .color-item')).map(function(el) {
      return { hex: el.dataset.color, name: el.dataset.name };
    });
    renderColors(customColors);
    setSaveButtonUnsaved();
  };
  cancelBtn.onclick = function() { cleanup(); };
}

function confirmDelete() {
  if (itemToDelete) {
    if (itemToDelete.classList.contains("color-item")) {
      const hex = itemToDelete.dataset.color;
      const name = itemToDelete.dataset.name;
      deleteColor(hex, name);
    } else {
      itemToDelete.remove();
    }
    closeDeleteModal();
    setSaveButtonUnsaved();
    _renderSettingsTagTree();
  }
}

function handleTagInput(event) {
  if (event.key === "Enter" && event.shiftKey) {
    const input = document.getElementById("new-tag");
    const tagText = input.value.trim();
    if (tagText) {
      const tagDiv = document.createElement("div");
      tagDiv.className = "tag";
      tagDiv.dataset.color = "#d4c4b0";
      tagDiv.style.backgroundColor = "#d4c4b0";
      tagDiv.innerHTML = `${tagText} <button onclick="openDeleteModal(event, this.parentElement)">✕</button>`;
      openTagModal(tagDiv);
      input.value = "";
      setSaveButtonUnsaved();
    }
  } else if (event.key === "Enter") {
    addTag();
  }
}

function handleInfoClick(event) {
  const input = document.getElementById("new-tag");
  const tagText = input.value.trim();
  if (event.shiftKey && tagText) {
    const tagDiv = document.createElement("div");
    tagDiv.className = "tag";
    tagDiv.dataset.color = "#d4c4b0";
    tagDiv.style.backgroundColor = "#d4c4b0";
    tagDiv.innerHTML = `${tagText} <button onclick="openDeleteModal(event, this.parentElement)">✕</button>`;
    openTagModal(tagDiv);
    input.value = "";
    setSaveButtonUnsaved();
  }
}

function addTag() {
  const input = document.getElementById("new-tag");
  const tagText = input.value.trim();
  if (tagText) {
    const existingTags = Array.from(document.querySelectorAll("#tag-editor-hidden .tag")).map(
      (tag) =>
        tag.textContent
          .substring(0, tag.textContent.lastIndexOf("✕"))
          .trim()
          .toLowerCase(),
    );
    if (existingTags.includes(tagText.toLowerCase())) {
      const modal = document.getElementById("duplicate-tag-modal");
      modal.style.display = "flex";
      setTimeout(() => {
        modal.style.display = "none";
        input.value = tagText;
      }, 2000);
      return;
    }
    const tagDiv = document.createElement("div");
    tagDiv.className = "tag";
    tagDiv.dataset.color = "#d4c4b0";
    tagDiv.style.backgroundColor = "#d4c4b0";
    tagDiv.innerHTML = `${tagText} <button onclick="openDeleteModal(event, this.parentElement)">✕</button>`;
    tagDiv.onclick = function (e) {
      if (e.target !== this && e.target.tagName === "BUTTON") return;
      openTagModal(this);
    };
    const tagEditor = document.getElementById("tag-editor-hidden");
    tagEditor.appendChild(tagDiv);
    input.value = "";
    setSaveButtonUnsaved();
    _renderSettingsTagTree();

    // Inherit parent tag sharing if the new tag is a sub-tag (Req 6.2)
    _inheritParentTagSharing(tagText);
  }
}

let currentTag = null;

// Default tag color palette — warm parchment-themed, high contrast
var _tagColorPalette = [
  { bg: '#8b5a2b', fg: '#fff8e1' },  // Dark brown / cream
  { bg: '#a0522d', fg: '#fff8e1' },  // Sienna / cream
  { bg: '#4a2c2a', fg: '#fdf5e6' },  // Deep brown / parchment
  { bg: '#6b4e31', fg: '#fff8e1' },  // Medium brown / cream
  { bg: '#b22222', fg: '#fff8e1' },  // Firebrick / cream
  { bg: '#8b0000', fg: '#fdf5e6' },  // Dark red / parchment
  { bg: '#2e4057', fg: '#fdf5e6' },  // Navy / parchment
  { bg: '#1b4332', fg: '#e8dcc8' },  // Forest green / tan
  { bg: '#5c4033', fg: '#faebd7' },  // Coffee / antique white
  { bg: '#d4af37', fg: '#2b1e0f' },  // Gold / dark brown
  { bg: '#c4a484', fg: '#2b1e0f' },  // Tan / dark brown
  { bg: '#e8dcc8', fg: '#4a2c2a' },  // Light parchment / dark brown
  { bg: '#d2b48c', fg: '#2b1e0f' },  // Burlywood / dark brown
  { bg: '#f5e6cc', fg: '#4a2c2a' },  // Cream / dark brown
  { bg: '#fff8e1', fg: '#4a2c2a' },  // Light cream / dark brown
];

function openTagModal(tag) {
  currentTag = tag;
  const modal = document.getElementById("tag-modal");
  const tagNameInput = document.getElementById("tag-name");
  const colorInput = document.getElementById("tag-color");
  const fontColorInput = document.getElementById("tag-font-color");
  const preview = document.getElementById("tag-preview");

  // Show the tag's actual name (text content minus the ✕ button)
  const rawText = tag.childNodes[0]?.textContent?.trim() || tag.dataset.color || "";
  tagNameInput.value = rawText;
  tagNameInput.disabled = false;

  colorInput.value = tag.dataset.color || "#d4c4b0";
  fontColorInput.value = tag.dataset.fontColor || "#5c3317";

  // Live preview updater
  function _updateTagPreview() {
    if (preview) {
      preview.style.backgroundColor = colorInput.value;
      preview.style.color = fontColorInput.value;
      preview.textContent = tagNameInput.value || 'Preview';
    }
  }

  // Build background color swatches: palette + all existing tag colors
  var bgSwatches = document.getElementById('tag-color-swatches');
  if (bgSwatches) {
    bgSwatches.innerHTML = '';
    var seenBg = new Set();
    // Palette colors
    _tagColorPalette.forEach(function (c) {
      if (seenBg.has(c.bg)) return;
      seenBg.add(c.bg);
      var s = document.createElement('span');
      s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;';
      s.style.backgroundColor = c.bg;
      s.title = c.bg;
      if (c.bg === colorInput.value) s.style.borderColor = '#4a2c2a';
      s.addEventListener('click', function () {
        colorInput.value = c.bg;
        fontColorInput.value = c.fg;
        _updateTagPreview();
        _highlightSwatches();
        setSaveButtonUnsaved();
      });
      bgSwatches.appendChild(s);
    });
    // Existing tag colors
    document.querySelectorAll('#tag-editor-hidden .tag').forEach(function (t) {
      var c = t.dataset.color;
      if (c && !seenBg.has(c)) {
        seenBg.add(c);
        var s = document.createElement('span');
        s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:inline-block;';
        s.style.backgroundColor = c;
        s.title = c;
        if (c === colorInput.value) s.style.borderColor = '#4a2c2a';
        s.addEventListener('click', function () {
          colorInput.value = c;
          _updateTagPreview();
          _highlightSwatches();
          setSaveButtonUnsaved();
        });
        bgSwatches.appendChild(s);
      }
    });
  }

  // Build font color swatches
  var fgSwatches = document.getElementById('tag-font-color-swatches');
  if (fgSwatches) {
    fgSwatches.innerHTML = '';
    var fgColors = ['#2b1e0f', '#4a2c2a', '#fff8e1', '#fdf5e6', '#faebd7', '#e8dcc8', '#000000', '#ffffff'];
    fgColors.forEach(function (c) {
      var s = document.createElement('span');
      s.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid ' + (c === '#ffffff' || c === '#fff8e1' || c === '#fdf5e6' || c === '#faebd7' || c === '#e8dcc8' ? '#8b5a2b' : 'transparent') + ';display:inline-block;';
      s.style.backgroundColor = c;
      s.title = c;
      if (c === fontColorInput.value) s.style.borderColor = '#4a2c2a';
      s.addEventListener('click', function () {
        fontColorInput.value = c;
        _updateTagPreview();
        _highlightFgSwatches();
        setSaveButtonUnsaved();
      });
      fgSwatches.appendChild(s);
    });
  }

  function _highlightSwatches() {
    if (bgSwatches) bgSwatches.querySelectorAll('span').forEach(function (s) {
      s.style.borderColor = s.title === colorInput.value ? '#4a2c2a' : 'transparent';
    });
  }
  function _highlightFgSwatches() {
    if (fgSwatches) fgSwatches.querySelectorAll('span').forEach(function (s) {
      s.style.borderColor = s.title === fontColorInput.value ? '#4a2c2a' : (
        ['#ffffff','#fff8e1','#fdf5e6','#faebd7','#e8dcc8'].includes(s.title) ? '#8b5a2b' : 'transparent'
      );
    });
  }

  // Live preview on color picker change
  colorInput.onchange = function () { _updateTagPreview(); _highlightSwatches(); setSaveButtonUnsaved(); };
  colorInput.oninput = function () { _updateTagPreview(); };
  fontColorInput.onchange = function () { _updateTagPreview(); _highlightFgSwatches(); setSaveButtonUnsaved(); };
  fontColorInput.oninput = function () { _updateTagPreview(); };
  tagNameInput.oninput = function () { _updateTagPreview(); };

  const favStar = document.getElementById('tag-favorite-star');
  if (favStar) {
    const isFav = tag.dataset.favorite === 'true';
    favStar.textContent = isFav ? '★' : '☆';
    favStar.style.color = isFav ? '#DAA520' : '#999';
    favStar.title = isFav ? 'Unfavorite this Tag' : 'Favorite this Tag';
  }

  _updateTagPreview();
  modal.style.display = "flex";

  // Initialize tag sharing section
  _initTagSharingSection(rawText);

  // Enforce tag permission (Req 6.6, 6.7): check if current user has view-only access
  _enforceTagPermission(rawText);
}

function saveTag() {
  const tagEditor = document.getElementById("tag-editor-hidden");
  if (!tagEditor) return;

  if (!currentTag) {
    currentTag = document.createElement("div");
    currentTag.className = "tag";
    currentTag.onclick = function (e) {
      if (e.target !== this && e.target.tagName === "BUTTON") return;
      openTagModal(this);
    };
  }

  const tagNameInput = document.getElementById("tag-name");
  const colorInput = document.getElementById("tag-color");
  const fontColorInput = document.getElementById("tag-font-color");
  const newName = tagNameInput.value.trim();
  const newColor = colorInput.value;
  const newFontColor = fontColorInput ? fontColorInput.value : '#2b1e0f';

  if (!newName) {
    alert("Tag name cannot be empty.");
    return;
  }

  // Check for duplicate names (excluding the tag being edited)
  const existingNames = Array.from(
    document.querySelectorAll(".tag:not(.tag-input-container .tag)")
  )
    .filter((t) => t !== currentTag)
    .map((t) => {
      const txt = t.childNodes[0]?.textContent?.trim() || "";
      return txt.toLowerCase();
    });

  if (existingNames.includes(newName.toLowerCase())) {
    const dupModal = document.getElementById("duplicate-tag-modal");
    if (dupModal) {
      dupModal.style.display = "flex";
      setTimeout(() => { dupModal.style.display = "none"; }, 2000);
    }
    return;
  }

  currentTag.dataset.color = newColor;
  currentTag.dataset.fontColor = newFontColor;
  currentTag.style.backgroundColor = newColor;
  currentTag.style.color = newFontColor;
  const favStar = document.getElementById('tag-favorite-star');
  currentTag.dataset.favorite = favStar && favStar.textContent === '★' ? 'true' : 'false';

  // Check if tag was renamed — update sharing config if so
  const oldName = (currentTag.childNodes[0]?.textContent || '').trim();
  if (oldName && oldName !== newName && _tagSharingConfig) {
    for (var si = 0; si < _tagSharingConfig.length; si++) {
      if (_tagSharingConfig[si].tag === oldName) {
        _tagSharingConfig[si].tag = newName;
        break;
      }
    }
  }

  // Always save the current tag's sharing config when closing the modal
  // (handles new shares, role changes, and renames)
  _saveTagSharingConfig(newName);

  // Rebuild inner HTML safely
  currentTag.innerHTML = "";
  const nameNode = document.createTextNode(newName + " ");
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "✕";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    openDeleteModal(e, currentTag);
  };
  currentTag.appendChild(nameNode);
  currentTag.appendChild(deleteBtn);

  // Ensure click handler is set
  currentTag.onclick = function (e) {
    if (e.target !== this && e.target.tagName === "BUTTON") return;
    openTagModal(this);
  };

  if (!tagEditor.contains(currentTag)) {
    tagEditor.appendChild(currentTag);
  }

  closeTagModal();
  setSaveButtonUnsaved();
  _renderSettingsTagTree();
}

function deleteTag() {
  if (currentTag) {
    // Remove sharing config for this tag and all its sub-tags (Req 6.3)
    var deletedName = (currentTag.childNodes[0]?.textContent || '').trim();
    if (deletedName && _tagSharingConfig) {
      var hadSharing = false;
      var prefix = deletedName + '/';
      _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
        if (entry.tag === deletedName || entry.tag.startsWith(prefix)) {
          hadSharing = true;
          return false;
        }
        return true;
      });
      if (hadSharing) _saveTagSharingConfig(null);
    }

    currentTag.remove();
    closeTagModal();
    setSaveButtonUnsaved();
    _renderSettingsTagTree();
  }
}

/** Render the tag tree in the settings page using the shared renderTagTree */
function _renderSettingsTagTree() {
  const treeContainer = document.getElementById('settings-tag-tree');
  if (!treeContainer) return;

  // Build tag objects from the hidden tag divs
  const tagDivs = document.querySelectorAll('#tag-editor-hidden .tag:not(.tag-input-container .tag)');
  const tags = Array.from(tagDivs).map(div => ({
    name: (div.childNodes[0]?.textContent || '').trim(),
    color: div.dataset.color || '#d4c4b0',
    favorite: div.dataset.favorite === 'true',
  })).filter(t => t.name);

  if (tags.length === 0) {
    treeContainer.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">No tags. Use Add Tag above.</div>';
    return;
  }

  // Use shared buildTagTree + renderTagTree
  const tree = buildTagTree(tags);
  // Render with no selection (settings doesn't have selected tags), click opens edit modal
  renderTagTree(treeContainer, tree, [], (fullPath, isNowSelected) => {
    // Find the hidden tag div for this tag and open its modal
    const tagDiv = Array.from(tagDivs).find(div => (div.childNodes[0]?.textContent || '').trim() === fullPath);
    if (tagDiv) openTagModal(tagDiv);
  });

  // Add "+" child-create buttons and 🔗 sharing indicators next to each tag row
  treeContainer.querySelectorAll('[style*="display:flex"]').forEach(row => {
    const badge = row.querySelector('span[style*="border-radius"]');
    if (!badge) return;
    const tagPath = badge.textContent;
    // Find the full path by looking at the tag tree
    const fullPath = _findFullPathForBadge(tree, badge, row);
    if (!fullPath) return;

    // Task 12.5: Add 🔗 sharing indicator with user list tooltip (Req 6.8)
    if (_tagHasSharing(fullPath)) {
      var linkIcon = document.createElement('span');
      linkIcon.className = 'tag-sharing-link-icon';
      linkIcon.textContent = '🔗';
      // Build tooltip listing shared users
      var sharedUsers = _getTagShares(fullPath);
      var userNames = sharedUsers.map(function(s) {
        return _getTagSharingUserName(s.user_id);
      });
      linkIcon.title = 'Shared with: ' + userNames.join(', ');
      // Insert after the badge
      badge.parentNode.insertBefore(linkIcon, badge.nextSibling);
    }

    const addBtn = document.createElement('span');
    addBtn.textContent = '+';
    addBtn.title = `Create child tag under "${fullPath}"`;
    addBtn.style.cssText = 'font-size:0.75em;cursor:pointer;padding:0 4px;border-radius:3px;background:#8b5a2b;color:#fdf5e6;margin-left:4px;flex-shrink:0;line-height:1.4;';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.getElementById('new-tag');
      if (input) {
        input.value = fullPath + '/';
        input.focus();
      }
    });
    row.appendChild(addBtn);
  });
}

/** Helper: find the full path for a badge element in the tag tree */
function _findFullPathForBadge(tree, badge, row) {
  // Walk the tree to find a node whose name matches the badge text
  // Use depth from padding-left to disambiguate
  const paddingMatch = row.style.paddingLeft?.match(/(\d+)px/);
  const depth = paddingMatch ? parseInt(paddingMatch[1]) / 16 : 0;
  let found = null;
  function walk(nodes, d) {
    for (const n of nodes) {
      if (d === depth && n.name === badge.textContent) { found = n.fullPath; return; }
      walk(n.children, d + 1);
      if (found) return;
    }
  }
  walk(tree, 0);
  return found;
}

function closeTagModal() {
  document.getElementById("tag-modal").style.display = "none";
  itemToDelete = null;
}

function toggleTagFavorite() {
  const star = document.getElementById('tag-favorite-star');
  if (!star) return;
  const isFav = star.textContent === '★';
  star.textContent = isFav ? '☆' : '★';
  star.style.color = isFav ? '#999' : '#DAA520';
  star.title = isFav ? 'Favorite this Tag' : 'Unfavorite this Tag';
  setSaveButtonUnsaved();
}

function openDeleteModal(event, item) {
  event.stopPropagation();
  itemToDelete = item;
  document.getElementById("delete-modal").style.display = "flex";
}

function closeDuplicateTagModal() {
  const modal = document.getElementById("duplicate-tag-modal");
  modal.style.display = "none";
}

function saveSettings() {
  // Save & Exit — save then navigate back
  if (window.settingsManager) {
    window.settingsManager.save().then(ok => {
      if (ok) {
        const returnUrl = localStorage.getItem('cwoc_settings_return');
        localStorage.removeItem('cwoc_settings_return');
        window.location.href = returnUrl || "/";
      }
    });
  }
}

function saveSettingsAndStay() {
  // Save & Stay — save without navigating
  if (window.settingsManager) {
    window.settingsManager.save();
  }
}

function cancelSettings() {
  if (window._cwocSave) window._cwocSave.cancelOrExit();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    // Layered ESC: close innermost modal first, never exit while a modal is open

    // 1. Update/upgrade modal
    var updateModal = document.getElementById("update-modal");
    if (updateModal && updateModal.style.display === "flex") {
      event.preventDefault();
      event.stopPropagation();
      if (typeof _closeUpdateModal === 'function') _closeUpdateModal();
      return;
    }

    // 1b. Release notes modal
    var releaseNotesModal = document.getElementById("release-notes-modal");
    if (releaseNotesModal && releaseNotesModal.style.display === "flex") {
      event.preventDefault();
      event.stopPropagation();
      closeReleaseNotesModal();
      return;
    }

    // 2. QR overlay (shared)
    var qrOverlay = document.getElementById("cwoc-qr-overlay");
    if (qrOverlay) { qrOverlay.remove(); return; }

    // 3. Tag modal
    if (document.getElementById("tag-modal").style.display === "flex") {
      closeTagModal();
      return;
    }

    // 4. Delete confirm modal
    if (document.getElementById("delete-modal").style.display === "flex") {
      closeDeleteModal();
      return;
    }

    // 5. Duplicate tag modal
    if (document.getElementById("duplicate-tag-modal").style.display === "flex") {
      closeDuplicateTagModal();
      return;
    }

    // 6. Unsaved changes modal
    var unsavedModal = document.getElementById("cwoc-unsaved-modal");
    if (unsavedModal) {
      unsavedModal.remove();
      return;
    }

    // 7. Blur focused input first
    if (document.activeElement && document.activeElement.tagName &&
        ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) {
      document.activeElement.blur();
      return;
    }

    // 8. Exit page (with save check)
    cancelSettings();
  } else if (event.key === "Enter") {
    if (document.getElementById("tag-modal").style.display === "flex") {
      saveTag();
    } else if (
      document.getElementById("delete-modal").style.display === "flex"
    ) {
      confirmDelete();
    } else if (
      document.getElementById("duplicate-tag-modal").style.display === "flex"
    ) {
      closeDuplicateTagModal();
    }
  }
});

document
  .getElementById("duplicate-tag-modal")
  .addEventListener("click", closeDuplicateTagModal);

updateGrid();

// ── Pill toggle helper ────────────────────────────────────────────────────────
function _initPillToggle(pillId, hiddenInputId) {
  var pill = document.getElementById(pillId);
  if (!pill) return;
  pill.addEventListener('click', function() {
    var hidden = document.getElementById(hiddenInputId);
    var spans = pill.querySelectorAll('span[data-val]');
    if (!hidden || spans.length < 2) return;
    // Toggle to the other value
    var current = hidden.value;
    var next = (spans[0].dataset.val === current) ? spans[1].dataset.val : spans[0].dataset.val;
    hidden.value = next;
    _updatePillToggle(pillId, next);
    setSaveButtonUnsaved();
  });
}

function _updatePillToggle(pillId, activeVal) {
  var pill = document.getElementById(pillId);
  if (!pill) return;
  var activeStyle = 'padding:4px 8px;background:#8b5a2b;color:#fff8e1;font-weight:bold;';
  var inactiveStyle = 'padding:4px 8px;background:#f5e6cc;color:#bbb;';
  pill.querySelectorAll('span[data-val]').forEach(function(span) {
    span.style.cssText = (span.dataset.val === activeVal) ? activeStyle : inactiveStyle;
  });
}

_initPillToggle('sex-pill', 'gender-toggle');
_initPillToggle('unit-pill', 'unit-system-toggle');

class SettingsService {
  static async loadAll() {
    try {
      const data = await getCachedSettings();
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Empty settings response');
      }
      return data;
    } catch (error) {
      console.error("Settings load failed:", error);
      throw error;
    }
  }

  static async saveAll(settings) {
    try {
      // When saving, convert custom_colors to array of hex strings only
      const settingsToSave = {
        ...settings,
        custom_colors: (settings.custom_colors || []).map((c) =>
          typeof c === "string" ? c : c.hex,
        ),
      };

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      _invalidateSettingsCache(); // force fresh data on next load
      return await response.json();
    } catch (error) {
      console.error("Settings save failed:", error);
      throw error;
    }
  }
}

class SettingsManager {
  constructor() {
    this.settings = {};
    this.initialize();
  }

  async initialize() {
    try {
      this.settings = await SettingsService.loadAll();

      // Ensure custom_colors is array of objects { hex, name }
      if (Array.isArray(this.settings.custom_colors)) {
        this.settings.custom_colors = this.settings.custom_colors.map((c) =>
          typeof c === "string" ? { hex: c, name: colorMap[c] || "Custom" } : c,
        );
      } else {
        this.settings.custom_colors = [];
      }

      this.updateForm();
      setSaveButtonSaved();
      monitorChanges();
      this.setupEventListeners();
    } catch (error) {
      alert(`Failed to load settings: ${error.message}`);
    }
  }

  updateForm() {
    const timeFormat = document.getElementById("time-format");
    timeFormat.value = this.settings.time_format || "24hour";

    // Audit log limits
    const auditMaxDaysInput = document.getElementById("audit-max-days");
    if (auditMaxDaysInput) auditMaxDaysInput.value = (this.settings.audit_log_max_days != null && this.settings.audit_log_max_days !== '') ? this.settings.audit_log_max_days : '';
    const auditMaxMbInput = document.getElementById("audit-max-mb");
    if (auditMaxMbInput) auditMaxMbInput.value = (this.settings.audit_log_max_mb != null && this.settings.audit_log_max_mb !== '') ? this.settings.audit_log_max_mb : '';

    // Audit prune checkbox: unchecked if both limits are null
    const auditPruneCb = document.getElementById("audit-prune-enabled");
    if (auditPruneCb) {
      const bothNull = (this.settings.audit_log_max_days == null || this.settings.audit_log_max_days === '') &&
                        (this.settings.audit_log_max_mb == null || this.settings.audit_log_max_mb === '');
      auditPruneCb.checked = !bothNull;
      toggleAuditPruneInputs();
    }

    // Chit options checkboxes
    const co = this.settings.chit_options || {};
    document.getElementById("fade-past").checked = co.fade_past_chits !== false;
    document.getElementById("highlight-overdue").checked = co.highlight_overdue_chits !== false;
    document.getElementById("highlight-blocked").checked = co.highlight_blocked_chits !== false;
    document.getElementById("delete-past").checked = !!co.delete_past_alarm_chits;
    document.getElementById("show-tab-counts").checked = !!co.show_tab_counts;
    document.getElementById("prefer-google-maps").checked = !!co.prefer_google_maps;

    const genderToggle = document.getElementById("gender-toggle");
    if (genderToggle) genderToggle.value = this.settings.sex || "Man";
    _updatePillToggle('sex-pill', this.settings.sex || 'Man');

    const unitToggle = document.getElementById("unit-system-toggle");
    if (unitToggle) unitToggle.value = this.settings.unit_system || "imperial";
    _updatePillToggle('unit-pill', this.settings.unit_system || 'imperial');

    document.getElementById("snooze-length").value =
      this.settings.snooze_length || "5 minutes";

    document.getElementById("calendar-snap").value =
      this.settings.calendar_snap || "15";

    // Hide declined chits toggle
    var hideDeclinedCb = document.getElementById("hide-declined-toggle");
    if (hideDeclinedCb) hideDeclinedCb.checked = (this.settings.hide_declined === "1");

    const weekStartSel = document.getElementById("week-start-day");
    if (weekStartSel) weekStartSel.value = this.settings.week_start_day || "0";

    // Work hours are now initialized by _initHourDropdownPair in the block below

    // Working days checkboxes
    const workDays = (this.settings.work_days || "1,2,3,4,5").split(',');
    document.querySelectorAll('.work-day-cb').forEach(cb => {
      cb.checked = workDays.includes(cb.value);
    });

    // Enabled periods checkboxes
    const enabledPeriods = (this.settings.enabled_periods || "Itinerary,Day,Week,Work,SevenDay,Month,Year").split(',');
    document.querySelectorAll('.period-cb').forEach(cb => {
      cb.checked = enabledPeriods.includes(cb.value);
    });

    // Custom days count
    const customDaysInput = document.getElementById("custom-days-count");
    if (customDaysInput) customDaysInput.value = this.settings.custom_days_count || "7";

    // All-view hours
    var avStart = parseInt(this.settings.all_view_start_hour) || 0;
    var avEnd = parseInt(this.settings.all_view_end_hour) || 24;
    _initHourDropdownPair('all-view-start-hour', 'all-view-end-hour', avStart, avEnd);

    // Day scroll-to hour
    var scrollToSel = document.getElementById("day-scroll-to-hour");
    if (scrollToSel) scrollToSel.value = this.settings.day_scroll_to_hour || "5";

    // Work hours
    var wStart = parseInt(this.settings.work_start_hour) || 8;
    var wEnd = parseInt(this.settings.work_end_hour) || 17;
    _initHourDropdownPair('work-start-hour', 'work-end-hour', wStart, wEnd);

    // Toggle conditional config sections
    _toggleWorkConfig();
    _toggleXDaysConfig();

    const filterInputs = [
      "calendar",
      "checklists",
      "alarms",
      "projects",
      "tasks",
      "indicators",
      "notes",
    ];
    filterInputs.forEach((key) => {
      const input = document.getElementById(`filter-${key}`);
      const filters = this.settings.default_filters || {};
      // Support both old array format and new object format
      if (Array.isArray(filters)) {
        input.value = filters.includes(key.charAt(0).toUpperCase() + key.slice(1)) ? `#${key}` : "";
      } else {
        input.value = filters[key] || "";
      }
      processTagsInInput(input);
    });

    if (this.settings.alarm_orientation) {
      clocksContainer.classList.toggle(
        "vertical",
        this.settings.alarm_orientation === "Vertical",
      );
      timeFormatGrid.classList.toggle(
        "vertical",
        this.settings.alarm_orientation === "Vertical",
      );
    }

    // Restore active clocks from saved settings
    if (this.settings.active_clocks) {
      let savedClocks = typeof this.settings.active_clocks === 'string'
        ? JSON.parse(this.settings.active_clocks)
        : this.settings.active_clocks;
      if (Array.isArray(savedClocks)) {
        // Migrate old format values to current names
        const migrateMap = { metric: 'hst', metricbar: 'hst', hstbar: 'hst' };
        savedClocks = savedClocks.map(v => migrateMap[v] || v);
        // Deduplicate (in case metric + metricbar both mapped to hst)
        savedClocks = [...new Set(savedClocks)];

        // Clear grid and inactive zone, then rebuild based on saved config
        timeFormatGrid.innerHTML = "";
        inactiveZone.innerHTML = "";
        timeFormatGrid.classList.remove("empty");
        if (savedClocks.length === 0) {
          timeFormatGrid.classList.add("empty");
          const addButton = document.createElement("button");
          addButton.className = "add-clock-button";
          addButton.textContent = "➕ Add Clock";
          addButton.onclick = addFirstClock;
          timeFormatGrid.appendChild(addButton);
        } else {
          savedClocks.forEach((val, index) => {
            const fmt = formats.find(f => f.value === val);
            if (!fmt) return;
            const slot = document.createElement("div");
            slot.className = "grid-slot";
            slot.dataset.index = index;
            slot.innerHTML = `<div class="format-item" draggable="true" data-value="${fmt.value}">${fmt.label}</div>`;
            timeFormatGrid.appendChild(slot);
          });
        }
        // Put remaining formats in inactive zone
        formats.forEach(fmt => {
          if (!savedClocks.includes(fmt.value)) {
            const item = document.createElement("div");
            item.className = "inactive-item";
            item.draggable = true;
            item.dataset.value = fmt.value;
            item.textContent = fmt.label;
            inactiveZone.appendChild(item);
          }
        });
        inactiveZone.classList.toggle("empty", inactiveZone.children.length === 0);
        setupDragListeners();
      }
    }

    const tagEditor = document.getElementById("tag-editor-hidden");
    tagEditor
      .querySelectorAll(".tag:not(.tag-input-container .tag)")
      .forEach((tag) => tag.remove());
    this.settings.tags?.forEach((tag) => {
      const tagDiv = document.createElement("div");
      tagDiv.className = "tag";
      tagDiv.dataset.color = tag.color || "#8b5a2b";
      tagDiv.dataset.fontColor = tag.fontColor || "#2b1e0f";
      tagDiv.dataset.favorite = tag.favorite ? 'true' : 'false';
      tagDiv.style.backgroundColor = tag.color || "#8b5a2b";
      tagDiv.style.color = tag.fontColor || "#2b1e0f";
      tagDiv.innerHTML = `${tag.name} <button onclick="openDeleteModal(event, this.parentElement)">✕</button>`;
      tagDiv.onclick = function (e) {
        if (e.target !== this && e.target.tagName === "BUTTON") return;
        openTagModal(this);
      };
      tagEditor.appendChild(tagDiv);
    });

    // Render tag tree view
    _renderSettingsTagTree();

    // Render saved locations
    const savedLocations = Array.isArray(this.settings.saved_locations)
      ? this.settings.saved_locations
      : [];
    renderLocationsSection(savedLocations);

    // Load border color settings BEFORE rendering colors (renderColors uses these for default swatches)
    _borderColorOverdue = this.settings.overdue_border_color || '#b22222';
    _borderColorBlocked = this.settings.blocked_border_color || '#DAA520';

    renderColors(this.settings.custom_colors);

    // Apply ring indicators to the rendered swatches
    _applyBorderColorRings();

    // Visual indicators — load saved values into dropdowns
    const vi = this.settings.visual_indicators || {};
    document.querySelector("select[name='alarm_indicator']").value = vi.alarm || "always";
    document.querySelector("select[name='notification_indicator']").value = vi.notification || "always";
    document.querySelector("select[name='weather_indicator']").value = vi.weather || "always";
    document.querySelector("select[name='people_indicator']").value = vi.people || "always";
    document.querySelector("select[name='indicators_indicator']").value = vi.indicators || "always";
    document.querySelector("select[name='timer_indicator']").value = vi.timer || "always";
    document.querySelector("select[name='stopwatch_indicator']").value = vi.stopwatch || "always";
    document.querySelector("select[name='combined_alert_indicator']").value = vi.combined_alert || "always";

    // Combine Alerts toggle
    var combineAlertsCb = document.getElementById('combine-alerts-toggle');
    if (combineAlertsCb) {
      combineAlertsCb.checked = !!vi.combine_alerts;
      var individualRows = document.getElementById('individual-alert-rows');
      var combinedRow = document.getElementById('combined-alert-row');
      if (individualRows) individualRows.style.display = vi.combine_alerts ? 'none' : '';
      if (combinedRow) combinedRow.style.display = vi.combine_alerts ? '' : 'none';
    }

    // Default notifications
    var dn = this.settings.default_notifications || {};
    _renderDefaultNotifList('start', dn.start || []);
    _renderDefaultNotifList('due', dn.due || []);

    // Habits settings
    var habitsWindowSel = document.getElementById('habits-success-window');
    if (habitsWindowSel) habitsWindowSel.value = this.settings.habits_success_window || '30';
    var defaultShowHabitsCb = document.getElementById('default-show-habits-on-calendar');
    if (defaultShowHabitsCb) defaultShowHabitsCb.checked = (this.settings.default_show_habits_on_calendar !== '0');

    // Map settings
    _loadMapSettings(this.settings);
  }

  gatherSettings() {
    var currentUserId = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().user_id : 'default_user';
    return {
      user_id: currentUserId,
      time_format: document.getElementById("time-format").value,
      sex: document.getElementById("gender-toggle").value || "Man",
      unit_system: document.getElementById("unit-system-toggle").value || "imperial",
      snooze_length: document.getElementById("snooze-length").value,
      calendar_snap: document.getElementById("calendar-snap").value,
      hide_declined: document.getElementById("hide-declined-toggle").checked ? "1" : "0",
      week_start_day: document.getElementById("week-start-day")?.value || "0",
      work_start_hour: document.getElementById("work-start-hour")?.value || "8",
      work_end_hour: document.getElementById("work-end-hour")?.value || "17",
      work_days: Array.from(document.querySelectorAll('.work-day-cb:checked')).map(cb => cb.value).join(',') || "1,2,3,4,5",
      enabled_periods: Array.from(document.querySelectorAll('.period-cb:checked')).map(cb => cb.value).join(',') || "Itinerary,Day,Week,Work,SevenDay,Month,Year",
      custom_days_count: document.getElementById("custom-days-count")?.value || "7",
      all_view_start_hour: document.getElementById("all-view-start-hour")?.value || "0",
      all_view_end_hour: document.getElementById("all-view-end-hour")?.value || "24",
      day_scroll_to_hour: document.getElementById("day-scroll-to-hour")?.value || "5",
      default_filters: (() => {
        const filters = {};
        document.querySelectorAll(".filter-input").forEach(input => {
          if (input.value.trim()) {
            const tab = input.id.replace("filter-", "");
            filters[tab] = input.value.trim();
          }
        });
        return filters;
      })(),
      alarm_orientation: clocksContainer.classList.contains("vertical")
        ? "Vertical"
        : "Horizontal",
      active_clocks: JSON.stringify(
        Array.from(timeFormatGrid.querySelectorAll(".format-item")).map(item => item.dataset.value)
      ),
      tags: Array.from(
        document.querySelectorAll("#tag-editor-hidden .tag:not(.tag-input-container .tag)"),
      ).map((tag) => ({
        name: (tag.childNodes[0]?.textContent || "").trim(),
        color: tag.dataset.color || "#d4c4b0",
        fontColor: tag.dataset.fontColor || "#5c3317",
        favorite: tag.dataset.favorite === 'true',
      })).filter((t) => t.name),
      custom_colors: Array.from(document.querySelectorAll("#color-list .color-item")).map(
        (item) => ({
          hex: item.dataset.color,
          name: item.dataset.name || colorMap[item.dataset.color] || "Custom",
        }),
      ),
      visual_indicators: {
        alarm: document.querySelector("select[name='alarm_indicator']").value,
        notification: document.querySelector(
          "select[name='notification_indicator']",
        ).value,
        timer: document.querySelector("select[name='timer_indicator']").value,
        stopwatch: document.querySelector("select[name='stopwatch_indicator']").value,
        weather: document.querySelector("select[name='weather_indicator']")
          .value,
        people: document.querySelector("select[name='people_indicator']").value,
        indicators: document.querySelector(
          "select[name='indicators_indicator']",
        ).value,
        combine_alerts: document.getElementById("combine-alerts-toggle").checked,
        combined_alert: document.querySelector("select[name='combined_alert_indicator']").value,
      },
      chit_options: {
        fade_past_chits: document.getElementById("fade-past").checked,
        highlight_overdue_chits:
          document.getElementById("highlight-overdue").checked,
        highlight_blocked_chits:
          document.getElementById("highlight-blocked").checked,
        delete_past_alarm_chits: document.getElementById("delete-past").checked,
        show_tab_counts: document.getElementById("show-tab-counts").checked,
        prefer_google_maps: document.getElementById("prefer-google-maps").checked,
      },
      saved_locations: JSON.stringify(collectLocationsData()),
      audit_log_max_days: (() => { const cb = document.getElementById("audit-prune-enabled"); if (cb && !cb.checked) return null; const v = (document.getElementById("audit-max-days") || {}).value; return v === '' ? null : parseInt(v, 10); })(),
      audit_log_max_mb: (() => { const cb = document.getElementById("audit-prune-enabled"); if (cb && !cb.checked) return null; const v = (document.getElementById("audit-max-mb") || {}).value; return v === '' ? null : parseInt(v, 10); })(),
      default_notifications: {
        start: _gatherDefaultNotifList('start'),
        due: _gatherDefaultNotifList('due'),
      },
      habits_success_window: (document.getElementById('habits-success-window') || {}).value || '30',
      default_show_habits_on_calendar: (document.getElementById('default-show-habits-on-calendar') && document.getElementById('default-show-habits-on-calendar').checked) ? '1' : '0',
      overdue_border_color: _borderColorOverdue || '#b22222',
      blocked_border_color: _borderColorBlocked || '#DAA520',
      kiosk_users: _gatherKioskTags(),
      ..._collectMapSettings(),
    };
  }

  async save() {
    document.getElementById("loader").style.display = "block";
    try {
      const settingsToSave = this.gatherSettings();
      await SettingsService.saveAll(settingsToSave);

      // Also save login message and instance name if admin
      var loginMsgInput = document.getElementById('login-message-input');
      var instanceNameInput = document.getElementById('instance-name-input');
      if (loginMsgInput && typeof isAdmin === 'function' && isAdmin()) {
        try {
          await fetch('/api/auth/login-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: loginMsgInput.value,
              instance_name: instanceNameInput ? instanceNameInput.value : ''
            })
          });
        } catch (e) {
          console.error('Failed to save login message:', e);
        }
      }

      // Reload from API to get canonical saved state (avoids Pydantic serialization quirks)
      this.settings = await SettingsService.loadAll();
      if (Array.isArray(this.settings.custom_colors)) {
        this.settings.custom_colors = this.settings.custom_colors.map((c) =>
          typeof c === "string" ? { hex: c, name: colorMap[c] || "Custom" } : c,
        );
      }
      setSaveButtonSaved();
      document.getElementById("loader").style.display = "none";
      return true;
    } catch (error) {
      alert(`Failed to save settings: ${error.message}`);
      document.getElementById("loader").style.display = "none";
      return false;
    }
  }

  setupEventListeners() {
    // Save buttons are wired via onclick in HTML (saveSettingsAndStay / saveSettings)
    // No additional wiring needed here
  }
}

function setSaveButtonSaved() {
  if (window._cwocSave) window._cwocSave.markSaved();
}

function closeDeleteModal() {
  document.getElementById("delete-modal").style.display = "none";
  itemToDelete = null;
}

function monitorChanges() {
  const formElements = document.querySelectorAll("input, select, textarea");

  formElements.forEach((el) => {
    el.addEventListener("change", setSaveButtonUnsaved);
    el.addEventListener("input", setSaveButtonUnsaved);
  });

  const observerTargets = [
    document.getElementById("tag-editor-hidden"),
    document.getElementById("color-list"),
    document.getElementById("inactive-zone"),
    document.getElementById("time-format-grid"),
    document.getElementById("locations-list"),
  ];

  const observer = new MutationObserver(setSaveButtonUnsaved);

  observerTargets.forEach((el) => {
    if (el) {
      observer.observe(el, {
        childList: true,
        subtree: true,
      });
    }
  });
}

// ── Data Management Export/Import ─────────────────────────────────────────────

/**
 * Create a Blob from a data string and trigger a browser download.
 * @param {string} data - The JSON string to download
 * @param {string} filename - The filename for the download
 */
function _triggerJsonDownload(data, filename) {
  var blob = new Blob([data], { type: 'application/json' });
  var a = document.createElement('a');
  var url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export all chit data as a JSON file download.
 */
async function exportChitData() {
  try {
    var response = await fetch('/api/export/chits');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-chits-' + date + '.json');
  } catch (error) {
    console.error('Export chit data failed:', error);
    alert('Export failed: ' + error.message);
  }
}

/**
 * Export all user data (settings + contacts) as a JSON file download.
 */
async function exportUserData() {
  try {
    var response = await fetch('/api/export/userdata');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-userdata-' + date + '.json');
  } catch (error) {
    console.error('Export user data failed:', error);
    alert('Export failed: ' + error.message);
  }
}

/**
 * Show the import mode dialog (Add / Replace choice).
 * @param {string} type - "chits" or "userdata"
 * @param {object} fileData - The parsed JSON envelope from the file
 */
function _showImportModeDialog(type, fileData) {
  var modal = document.getElementById('import-mode-modal');
  var addBtn = document.getElementById('import-mode-add-btn');
  var replaceBtn = document.getElementById('import-mode-replace-btn');
  var cancelBtn = document.getElementById('import-mode-cancel-btn');

  function cleanup() {
    modal.style.display = 'none';
    addBtn.removeEventListener('click', onAdd);
    replaceBtn.removeEventListener('click', onReplace);
    cancelBtn.removeEventListener('click', onCancel);
  }

  function onAdd() {
    cleanup();
    _doImport(type, 'add', fileData);
  }

  function onReplace() {
    cleanup();
    _showReplaceConfirmDialog(type, function() {
      _doImport(type, 'replace', fileData);
    });
  }

  function onCancel() {
    cleanup();
  }

  addBtn.addEventListener('click', onAdd);
  replaceBtn.addEventListener('click', onReplace);
  cancelBtn.addEventListener('click', onCancel);
  modal.style.display = 'flex';
}

/**
 * Show the replace confirmation dialog with type-specific warning text.
 * @param {string} type - "chits" or "userdata"
 * @param {function} onConfirm - Callback to execute if user confirms
 */
function _showReplaceConfirmDialog(type, onConfirm) {
  var typeLabels = { chits: 'CHIT', userdata: 'USER', all: 'ALL' };
  var typeLabel = typeLabels[type] || type.toUpperCase();

  // First confirm
  cwocConfirm('This will permanently replace all ' + typeLabel + ' data with the imported file. This cannot be undone.', {
    title: '⚠️ Replace ' + typeLabel + ' Data?',
    confirmLabel: '🔄 Replace',
    cancelLabel: 'Cancel',
    danger: true,
  }).then(function(first) {
    if (!first) return;
    // Second confirm — make them really sure
    cwocConfirm('Are you REALLY sure you want to nuke ALL ' + typeLabel + ' data and replace it?', {
      title: '🚨 Final Confirmation',
      confirmLabel: '🗑️ Yes, Replace Everything',
      cancelLabel: 'No, Cancel',
      danger: true,
    }).then(function(second) {
      if (second) onConfirm();
    });
  });
}

/**
 * Perform the actual import POST request.
 * @param {string} type - "chits" or "userdata"
 * @param {string} mode - "add" or "replace"
 * @param {object} fileData - The parsed JSON envelope
 */
async function _doImport(type, mode, fileData) {
  var endpoint = '/api/import/' + (type === 'chits' ? 'chits' : type === 'userdata' ? 'userdata' : 'all');
  try {
    var response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, data: fileData })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var result = await response.json();
    var summary = result.summary || {};

    // Build a user-friendly summary message
    var msg;
    if (type === 'chits') {
      msg = 'Imported ' + (summary.imported || 0) + ' chits';
    } else if (type === 'all') {
      msg = 'Imported ' + (summary.chits_imported || 0) + ' chits, ' +
            (summary.settings_imported || 0) + ' settings, ' +
            (summary.contacts_imported || 0) + ' contacts, ' +
            (summary.alerts_imported || 0) + ' alerts';
    } else {
      if (mode === 'add') {
        msg = 'Added ' + (summary.contacts_added || 0) + ' contacts, merged ' + (summary.settings_merged || 0) + ' settings';
      } else {
        msg = 'Replaced ' + (summary.settings_replaced || 0) + ' settings, ' + (summary.contacts_replaced || 0) + ' contacts';
      }
    }
    alert(msg);

    // Reload settings after replace import
    if ((type === 'userdata' || type === 'all') && mode === 'replace') {
      _invalidateSettingsCache();
      if (window.settingsManager) {
        window.settingsManager.initialize();
      }
    }
  } catch (error) {
    console.error('Import failed:', error);
    alert('Import failed: ' + error.message);
  }
}

/**
 * Import chit data: open file picker, read JSON, validate, show mode dialog.
 */
function importChitData() {
  var fileInput = document.getElementById('importChitFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        alert('Invalid file: could not parse JSON');
        return;
      }
      if (!parsed || parsed.type !== 'chits') {
        alert('Invalid file: expected a CWOC chit data export');
        return;
      }
      _showImportModeDialog('chits', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import user data: open file picker, read JSON, validate, show mode dialog.
 */
function importUserData() {
  var fileInput = document.getElementById('importUserFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        alert('Invalid file: could not parse JSON');
        return;
      }
      if (!parsed || parsed.type !== 'userdata') {
        alert('Invalid file: expected a CWOC user data export');
        return;
      }
      _showImportModeDialog('userdata', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Import Calendar (.ics): open file picker, read ICS text, POST to /api/import/ics.
 */
function triggerIcsImport() {
  var fileInput = document.getElementById('icsImportFile');
  var btn = document.getElementById('icsImportBtn');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function(e) {
      var icsContent = e.target.result;
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Importing…';

      try {
        var response = await fetch('/api/import/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ics_content: icsContent }),
        });

        if (!response.ok) {
          var errData = await response.json().catch(function() { return {}; });
          throw new Error(errData.detail || response.statusText);
        }

        var result = await response.json();
        var msg = 'Imported ' + result.imported + ' events';
        if (result.skipped > 0) msg += ', skipped ' + result.skipped + ' duplicates';
        if (result.errors && result.errors.length > 0) msg += ', ' + result.errors.length + ' errors';
        alert(msg);
      } catch (error) {
        console.error('ICS import failed:', error);
        alert('Import failed: ' + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

/**
 * Export ALL data (chits + settings + contacts + alerts) as a single JSON file.
 */
async function exportAllData() {
  try {
    var response = await fetch('/api/export/all');
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    var text = await response.text();
    var date = new Date().toISOString().slice(0, 10);
    _triggerJsonDownload(text, 'cwoc-all-' + date + '.json');
  } catch (error) {
    console.error('Export all data failed:', error);
    alert('Export failed: ' + error.message);
  }
}

/**
 * Import ALL data: open file picker, read JSON, validate, show mode dialog.
 */
function importAllData() {
  var fileInput = document.getElementById('importAllFile');
  fileInput.value = '';

  function onChange() {
    fileInput.removeEventListener('change', onChange);
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        alert('Invalid file: could not parse JSON');
        return;
      }
      if (!parsed || parsed.type !== 'all') {
        alert('Invalid file: expected a CWOC combined data export (type "all"). For chit-only or user-only exports, use the specific import buttons.');
        return;
      }
      _showImportModeDialog('all', parsed);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  fileInput.addEventListener('change', onChange);
  fileInput.click();
}

// ── Login Welcome Message (admin) ────────────────────────────────────────────

/**
 * Save the login welcome message to the server.
 */
async function _saveLoginMessage() {
  var ta = document.getElementById('login-message-input');
  if (!ta) return;
  try {
    var response = await fetch('/api/auth/login-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ta.value })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || response.statusText);
    }
    alert('Login message saved.');
  } catch (error) {
    console.error('Save login message failed:', error);
    alert('Failed to save login message: ' + error.message);
  }
}

/**
 * Load the login welcome message from the server into the textarea and preview.
 */
async function _loadLoginMessage() {
  var ta = document.getElementById('login-message-input');
  var preview = document.getElementById('login-message-preview');
  if (!ta) return;
  try {
    var response = await fetch('/api/auth/login-message');
    if (!response.ok) return;
    var data = await response.json();
    ta.value = data.message || '';
    if (preview && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(ta.value || '');
    }
  } catch (error) {
    console.error('Load login message failed:', error);
  }
}

// ── Tag Sharing Configuration ────────────────────────────────────────────────
// Manages tag-level sharing: load/save shared_tags config, user picker,
// role selector, add/remove shares per tag.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

/** Cached shared_tags config from the server: [{tag, shares: [{user_id, role, display_name}]}] */
var _tagSharingConfig = [];

/** Cached user list for the tag sharing user picker */
var _tagSharingUserList = null;

/** Current tag's shares being edited in the tag modal */
var _currentTagShares = [];

/**
 * Load shared_tags config from GET /api/settings/shared-tags.
 * Called on page init after auth is ready.
 */
async function _loadTagSharingData() {
  if (typeof waitForAuth === 'function') {
    await waitForAuth();
  }
  try {
    var response = await fetch('/api/settings/shared-tags');
    if (!response.ok) {
      console.error('[TagSharing] Failed to load shared tags:', response.status);
      _tagSharingConfig = [];
      return;
    }
    var data = await response.json();
    _tagSharingConfig = Array.isArray(data.shared_tags) ? data.shared_tags : [];
  } catch (err) {
    console.error('[TagSharing] Error loading shared tags:', err);
    _tagSharingConfig = [];
  }

  // Re-render the tag tree to show sharing indicators
  _renderSettingsTagTree();
}

/**
 * Fetch the switchable user list for the tag sharing picker (cached).
 */
async function _loadTagSharingUserList() {
  if (_tagSharingUserList !== null) return;
  try {
    var response = await fetch('/api/auth/switchable-users');
    if (!response.ok) {
      console.error('[TagSharing] Failed to load user list:', response.status);
      _tagSharingUserList = [];
      return;
    }
    _tagSharingUserList = await response.json();
  } catch (err) {
    console.error('[TagSharing] Error loading user list:', err);
    _tagSharingUserList = [];
  }
}

/**
 * Get the shares array for a given tag name from the cached config.
 * @param {string} tagName
 * @returns {Array} shares array or empty array
 */
function _getTagShares(tagName) {
  if (!tagName || !_tagSharingConfig) return [];
  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === tagName) {
      return _tagSharingConfig[i].shares || [];
    }
  }
  return [];
}

/**
 * Check if a tag has any active sharing configuration.
 * @param {string} tagName
 * @returns {boolean}
 */
function _tagHasSharing(tagName) {
  return _getTagShares(tagName).length > 0;
}

/**
 * Populate the tag sharing user picker dropdown, excluding the current user
 * and users already shared with this tag.
 */
function _populateTagSharingUserPicker() {
  var picker = document.getElementById('tag-sharing-user-picker');
  if (!picker || !_tagSharingUserList) return;

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? currentUser.user_id : null;

  // Build set of already-shared user IDs
  var sharedIds = new Set();
  _currentTagShares.forEach(function(s) {
    sharedIds.add(s.user_id);
  });

  picker.innerHTML = '<option value="">— Select User —</option>';

  _tagSharingUserList.forEach(function(user) {
    if (user.id === currentUserId) return;
    if (sharedIds.has(user.id)) return;

    var opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.display_name || user.username;
    picker.appendChild(opt);
  });
}

/**
 * Render the current tag's shares list in the tag modal.
 */
function _renderTagSharesList() {
  var container = document.getElementById('tag-sharing-list');
  if (!container) return;

  if (_currentTagShares.length === 0) {
    container.innerHTML = '<div class="tag-sharing-empty">Not shared with anyone</div>';
    return;
  }

  container.innerHTML = '';

  _currentTagShares.forEach(function(share) {
    var row = document.createElement('div');
    row.className = 'tag-sharing-item';

    // User display name
    var nameSpan = document.createElement('span');
    nameSpan.className = 'tag-share-name';
    nameSpan.textContent = _getTagSharingUserName(share.user_id);
    row.appendChild(nameSpan);

    // Role badge
    var badge = document.createElement('span');
    badge.className = 'tag-share-role tag-share-role-' + share.role;
    badge.textContent = share.role === 'manager' ? '✏️ Manager' : '👁️ Viewer';
    row.appendChild(badge);

    // Tag permission toggle (view/manage) — Req 6.5
    var permToggle = document.createElement('button');
    permToggle.type = 'button';
    permToggle.className = 'tag-share-perm-toggle';
    var perm = share.tag_permission || 'view';
    permToggle.textContent = perm === 'manage' ? '🔧 Manage' : '👁️ View';
    permToggle.title = perm === 'manage' ? 'Tag permission: can rename, recolor, delete' : 'Tag permission: read-only tag access';
    permToggle.dataset.perm = perm;
    permToggle.addEventListener('click', (function(uid) {
      return function() {
        // Toggle between view and manage
        for (var i = 0; i < _currentTagShares.length; i++) {
          if (_currentTagShares[i].user_id === uid) {
            var cur = _currentTagShares[i].tag_permission || 'view';
            _currentTagShares[i].tag_permission = cur === 'view' ? 'manage' : 'view';
            break;
          }
        }
        _renderTagSharesList();
        _saveTagSharingConfig();
      };
    })(share.user_id));
    row.appendChild(permToggle);

    // Remove button
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tag-share-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove share';
    removeBtn.addEventListener('click', (function(uid) {
      return function() { _removeTagShare(uid); };
    })(share.user_id));
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

/**
 * Look up a user's display name from the cached user list or share data.
 * @param {string} userId
 * @returns {string}
 */
function _getTagSharingUserName(userId) {
  if (_tagSharingUserList) {
    for (var i = 0; i < _tagSharingUserList.length; i++) {
      if (_tagSharingUserList[i].id === userId) {
        return _tagSharingUserList[i].display_name || _tagSharingUserList[i].username;
      }
    }
  }
  // Check display_name from enriched API response
  for (var j = 0; j < _currentTagShares.length; j++) {
    if (_currentTagShares[j].user_id === userId && _currentTagShares[j].display_name) {
      return _currentTagShares[j].display_name;
    }
  }
  return userId;
}

/**
 * Add a user share to the current tag. Called by the "Share" button.
 */
function _addTagShare() {
  var picker = document.getElementById('tag-sharing-user-picker');
  var roleSelect = document.getElementById('tag-sharing-role-select');
  if (!picker || !roleSelect) return;

  var userId = picker.value;
  var role = roleSelect.value;

  if (!userId) {
    alert('Please select a user to share with.');
    return;
  }

  // Check if already shared
  for (var i = 0; i < _currentTagShares.length; i++) {
    if (_currentTagShares[i].user_id === userId) {
      alert('This user already has access to this tag.');
      return;
    }
  }

  _currentTagShares.push({ user_id: userId, role: role, tag_permission: 'view' });
  _renderTagSharesList();
  _populateTagSharingUserPicker();
  _saveTagSharingConfig();
}

/**
 * Remove a user from the current tag's shares.
 * @param {string} userId
 */
function _removeTagShare(userId) {
  _currentTagShares = _currentTagShares.filter(function(s) {
    return s.user_id !== userId;
  });
  _renderTagSharesList();
  _populateTagSharingUserPicker();
  _saveTagSharingConfig();
}

/**
 * Save the full shared_tags config to the server via PUT /api/settings/shared-tags.
 * Updates the cached config and re-renders the tag tree.
 * If tagName is provided, updates that tag's shares from _currentTagShares.
 * If tagName is null, saves the config as-is (used for rename/delete).
 * @param {string|null} [tagName] — tag name to update, or null to save as-is
 */
async function _saveTagSharingConfig(tagName) {
  // If tagName provided, update the config from _currentTagShares
  if (tagName === undefined) {
    // Called from add/remove share — get tag name from modal
    var tagNameInput = document.getElementById('tag-name');
    if (!tagNameInput) return;
    tagName = tagNameInput.value.trim();
    if (!tagName) return;
  }

  if (tagName) {
    // Update the cached config: find or create the entry for this tag
    var found = false;
    for (var i = 0; i < _tagSharingConfig.length; i++) {
      if (_tagSharingConfig[i].tag === tagName) {
        if (_currentTagShares.length === 0) {
          // Remove the entry entirely if no shares
          _tagSharingConfig.splice(i, 1);
        } else {
          _tagSharingConfig[i].shares = _currentTagShares.map(function(s) {
            return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
          });
        }
        found = true;
        break;
      }
    }
    if (!found && _currentTagShares.length > 0) {
      _tagSharingConfig.push({
        tag: tagName,
        shares: _currentTagShares.map(function(s) {
          return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
        }),
      });
    }

    // Sub-tag propagation (Req 6.1): propagate parent's sharing config to all sub-tags
    _propagateTagSharingToSubTags(tagName);
  }
  // else: tagName is null — save config as-is (rename/delete already modified it)

  // Save to server
  try {
    var response = await fetch('/api/settings/shared-tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shared_tags: _tagSharingConfig }),
    });
    if (!response.ok) {
      var errText = await response.text();
      console.error('[TagSharing] Failed to save shared tags:', response.status, errText);
      alert('Failed to save tag sharing: ' + errText);
      return;
    }
    var data = await response.json();
    _tagSharingConfig = Array.isArray(data.shared_tags) ? data.shared_tags : _tagSharingConfig;
  } catch (err) {
    console.error('[TagSharing] Error saving shared tags:', err);
    alert('Failed to save tag sharing configuration.');
  }

  // Re-render the tag tree to update sharing indicators
  _renderSettingsTagTree();
}

/**
 * Propagate a parent tag's sharing config to all its sub-tags (Req 6.1).
 * Iterates all known tags and applies the parent's shares to any tag
 * whose fullPath starts with parentTag + '/'.
 * @param {string} parentTag — the parent tag name
 */
function _propagateTagSharingToSubTags(parentTag) {
  if (!parentTag) return;

  // Get the parent's current shares from the config
  var parentShares = null;
  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === parentTag) {
      parentShares = _tagSharingConfig[i].shares;
      break;
    }
  }

  // Get all known tag names from the hidden tag editor
  var tagDivs = document.querySelectorAll('#tag-editor-hidden .tag:not(.tag-input-container .tag)');
  var allTagNames = Array.from(tagDivs).map(function(div) {
    return (div.childNodes[0]?.textContent || '').trim();
  }).filter(function(n) { return n; });

  var prefix = parentTag + '/';

  allTagNames.forEach(function(tagName) {
    if (!tagName.startsWith(prefix)) return;

    if (parentShares && parentShares.length > 0) {
      // Copy parent's shares to sub-tag
      var subShares = parentShares.map(function(s) {
        return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
      });

      // Find or create entry for this sub-tag
      var found = false;
      for (var j = 0; j < _tagSharingConfig.length; j++) {
        if (_tagSharingConfig[j].tag === tagName) {
          _tagSharingConfig[j].shares = subShares;
          found = true;
          break;
        }
      }
      if (!found) {
        _tagSharingConfig.push({ tag: tagName, shares: subShares });
      }
    } else {
      // Parent has no shares — remove sub-tag sharing config (Req 6.3)
      _tagSharingConfig = _tagSharingConfig.filter(function(entry) {
        return entry.tag !== tagName;
      });
    }
  });
}

/**
 * When a sub-tag is added to a shared parent, copy the parent's sharing config (Req 6.2).
 * Called after a new tag is created.
 * @param {string} newTagName — the newly created tag's full path
 */
function _inheritParentTagSharing(newTagName) {
  if (!newTagName || !newTagName.includes('/')) return;

  // Walk up the path to find the nearest parent with sharing config
  var parts = newTagName.split('/');
  for (var depth = parts.length - 1; depth >= 1; depth--) {
    var parentPath = parts.slice(0, depth).join('/');
    var parentShares = _getTagShares(parentPath);
    if (parentShares.length > 0) {
      // Copy parent's shares to the new sub-tag
      var subShares = parentShares.map(function(s) {
        return { user_id: s.user_id, role: s.role, tag_permission: s.tag_permission || 'view' };
      });
      _tagSharingConfig.push({ tag: newTagName, shares: subShares });
      _saveTagSharingConfig(null); // Save as-is
      return;
    }
  }
}

/**
 * Initialize the tag sharing section when the tag modal opens.
 * Called from openTagModal.
 * @param {string} tagName — the tag name being edited
 */
async function _initTagSharingSection(tagName) {
  await _loadTagSharingUserList();

  // Load current shares for this tag, including tag_permission (default "view")
  _currentTagShares = _getTagShares(tagName).map(function(s) {
    return {
      user_id: s.user_id,
      role: s.role,
      tag_permission: s.tag_permission || 'view',
      display_name: s.display_name || '',
    };
  });

  _populateTagSharingUserPicker();
  _renderTagSharesList();
}

/**
 * Enforce tag permission on the tag edit modal (Req 6.6, 6.7).
 * If the current user is a shared recipient of this tag with "view" permission,
 * disable rename, recolor, and delete controls.
 * If "manage" permission, allow full access.
 * Only applies to tags shared WITH the current user (not tags the current user owns/created).
 * @param {string} tagName — the tag being edited
 */
function _enforceTagPermission(tagName) {
  var tagNameInput = document.getElementById('tag-name');
  var colorInput = document.getElementById('tag-color');
  var fontColorInput = document.getElementById('tag-font-color');
  var bgSwatches = document.getElementById('tag-color-swatches');
  var fgSwatches = document.getElementById('tag-font-color-swatches');

  // Find all delete buttons in the modal
  var deleteBtn = document.querySelector('#tag-modal button[onclick="deleteTag()"]');

  // Reset all controls to enabled by default
  if (tagNameInput) tagNameInput.disabled = false;
  if (colorInput) colorInput.disabled = false;
  if (fontColorInput) fontColorInput.disabled = false;
  if (bgSwatches) bgSwatches.style.pointerEvents = '';
  if (fgSwatches) fgSwatches.style.pointerEvents = '';
  if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.style.opacity = ''; }

  // Check if this tag is shared with the current user by another user
  var perm = _getTagPermissionForCurrentUser(tagName);
  if (!perm) return; // Not a shared tag for this user — full access

  if (perm === 'view') {
    // View-only: disable rename, recolor, delete (Req 6.6)
    if (tagNameInput) tagNameInput.disabled = true;
    if (colorInput) colorInput.disabled = true;
    if (fontColorInput) fontColorInput.disabled = true;
    if (bgSwatches) bgSwatches.style.pointerEvents = 'none';
    if (fgSwatches) fgSwatches.style.pointerEvents = 'none';
    if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.style.opacity = '0.4'; }
  }
  // "manage" permission: full access (Req 6.7) — no restrictions needed
}

/**
 * Check if the current user has a tag_permission on a tag shared by another user.
 * Looks through all users' shared_tags configs that include the current user.
 * For now, checks the local _tagSharingConfig (which is the current user's own config).
 * Returns null if the tag is not shared with the current user, or the permission level.
 * @param {string} tagName
 * @returns {string|null} "view", "manage", or null
 */
function _getTagPermissionForCurrentUser(tagName) {
  // The _tagSharingConfig is the current user's OWN sharing config (tags they share with others).
  // Tags shared WITH the current user would come from other users' configs.
  // Since we don't have cross-user config access on the frontend, we check if the tag
  // appears in the shared_tags_received data (if available).
  // For now, this is a placeholder that returns null (no restriction) for the tag creator's own tags.
  // The actual enforcement would need a backend endpoint that returns tags shared with the current user.
  // However, we can check _tagSharingConfig for tags where the current user appears as a share recipient.

  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  var currentUserId = currentUser ? currentUser.user_id : null;
  if (!currentUserId || !tagName) return null;

  // Check if the current user is a recipient in any tag sharing config
  // This would be populated from tags shared BY other users WITH the current user
  // For the tag creator's own tags, they always have full access
  for (var i = 0; i < _tagSharingConfig.length; i++) {
    if (_tagSharingConfig[i].tag === tagName) {
      // This is the current user's own sharing config — they are the creator, full access
      return null;
    }
  }

  // Check received shared tags (if loaded)
  if (window._receivedSharedTags) {
    for (var j = 0; j < window._receivedSharedTags.length; j++) {
      var entry = window._receivedSharedTags[j];
      if (entry.tag === tagName) {
        // Find the current user's permission in this entry
        var shares = entry.shares || [];
        for (var k = 0; k < shares.length; k++) {
          if (shares[k].user_id === currentUserId) {
            return shares[k].tag_permission || 'view';
          }
        }
      }
    }
  }

  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize mobile actions modal (shared header button pattern)
  if (typeof initMobileActionsModal === 'function') initMobileActionsModal();

  window._cwocSave = new CwocSaveSystem({
    singleBtnId: 'save-single-btn',
    stayBtnId: 'save-stay-btn',
    exitBtnId: 'save-exit-btn',
    cancelSelector: '.cancel-settings',
    getReturnUrl: () => {
      const url = localStorage.getItem('cwoc_settings_return');
      localStorage.removeItem('cwoc_settings_return');
      return url || '/';
    },
  });
  window.settingsManager = new SettingsManager();
  loadVersionInfo();

  // Load tag sharing data on page init
  _loadTagSharingData();

  // Load login message for admins after auth resolves
  if (typeof waitForAuth === 'function') {
    waitForAuth().then(function() {
      var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      if (user && user.is_admin) {
        _loadLoginMessage();
        // Live preview on textarea input
        var ta = document.getElementById('login-message-input');
        if (ta) {
          ta.addEventListener('input', function() {
            var preview = document.getElementById('login-message-preview');
            if (preview && typeof marked !== 'undefined') {
              preview.innerHTML = marked.parse(ta.value || '');
            }
          });
        }
      }
    });
  }

  // Wire upgrade button and close button for update modal
  document.getElementById('upgrade-btn').addEventListener('click', startUpgrade);
  document.getElementById('upgrade-reopen-btn').addEventListener('click', function() {
    document.getElementById('update-modal').style.display = 'flex';
    document.getElementById('upgrade-reopen-btn').style.display = 'none';
    document.getElementById('upgrade-btn').style.display = '';
  });
});


// Trash view moved to /frontend/html/trash.html



// ── Phone Notification Testing (via Ntfy) ────────────────────────────────────

/**
 * Send a test notification to the user's phone via the Ntfy server.
 * Called from the "Install as App" section. Tapping the notification
 * on the phone opens the CWOC settings page.
 */
async function _testNtfyFromInstallSection() {
  var statusEl = document.getElementById('pwa-notif-status');
  if (statusEl) statusEl.textContent = '⏳ Sending test notification...';

  try {
    var res = await fetch('/api/network-access/ntfy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var result = await res.json();

    if (result.success) {
      if (statusEl) statusEl.textContent = '✅ Notification sent to topic "' + result.topic + '". Check your Ntfy app!';
    } else {
      if (statusEl) statusEl.textContent = '❌ ' + (result.error || 'Could not send. Check that Ntfy is enabled in Network Access.');
    }
  } catch (e) {
    console.error('[Settings] Ntfy test failed:', e);
    if (statusEl) statusEl.textContent = '❌ Error: ' + e.message;
  }
}


// ── SSL Certificate Download ─────────────────────────────────────────────────

/**
 * Open the current CWOC URL in Chrome via an Android intent URL.
 * Works from Firefox (or any browser) on Android — launches Chrome
 * directly to this server so the user can install the PWA from there.
 */
function _openInChromeForInstall() {
  // Build the intent URL using the current origin
  var url = window.location.origin + '/';
  // intent:// scheme requires the URL without the protocol prefix
  var stripped = url.replace(/^https?:\/\//, '');
  var scheme = window.location.protocol === 'https:' ? 'https' : 'http';
  var intentUrl = 'intent://' + stripped + '#Intent;scheme=' + scheme +
    ';package=com.android.chrome;end';
  window.location.href = intentUrl;
}

/**
 * Show the "Open in Chrome" button on Firefox Android (where standalone
 * PWA install isn't supported). Called on DOMContentLoaded from settings init.
 */
function _initPwaInstallSection() {
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isFirefox = /Firefox/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  // Hide everything if already installed as standalone
  if (isStandalone) {
    var section = document.getElementById('pwa-cert-section');
    if (section) {
      var h3 = section.querySelector('h3');
      if (h3) h3.insertAdjacentHTML('afterend',
        '<p class="setting-hint" style="color:#2d6a2e;font-weight:bold;">✅ CWOC is installed as an app.</p>');
    }
    return;
  }

  // On Firefox Android, show the "Open in Chrome" button
  if (isAndroid && isFirefox) {
    var chromeBtn = document.getElementById('pwa-open-in-chrome');
    if (chromeBtn) chromeBtn.style.display = '';
    var chromeHint = document.getElementById('pwa-chrome-hint');
    if (chromeHint) chromeHint.style.display = '';
  }
}

// Run on DOMContentLoaded (settings.js is loaded after shared scripts)
document.addEventListener('DOMContentLoaded', function() {
  _initPwaInstallSection();
});


async function _downloadSslCert() {
  try {
    const res = await fetch('/api/ssl-cert');
    if (res.status === 404) {
      alert('No SSL certificate found on this server. The server may not be using HTTPS.');
      return;
    }
    if (!res.ok) {
      alert('Failed to download certificate: ' + res.status);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cwoc-server.crt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[Settings] SSL cert download failed:', e);
    alert('Failed to download certificate. Check the console for details.');
  }
}


// ── Version Info ─────────────────────────────────────────────────────────────

let _updateEventSource = null;

async function loadVersionInfo() {
  const versionEl = document.getElementById('version-display');
  const dateEl = document.getElementById('version-date');
  try {
    const res = await fetch('/api/version');
    if (!res.ok) throw new Error('Failed to fetch version');
    const data = await res.json();
    if (data.version === 'unknown' || !data.installed_datetime) {
      versionEl.textContent = 'No version info available';
      dateEl.textContent = '';
      return;
    }
    versionEl.textContent = data.version;
    const dt = new Date(data.installed_datetime);
    const timeFormat = typeof _globalTimeFormat !== 'undefined' ? _globalTimeFormat : '24hour';
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    if (timeFormat === '12hour') {
      opts.hour12 = true;
    } else {
      opts.hour12 = false;
    }
    dateEl.textContent = dt.toLocaleString(undefined, opts);
  } catch (e) {
    console.error('Error loading version info:', e);
    versionEl.textContent = 'Unable to load version info';
    dateEl.innerHTML = '<a href="#" onclick="loadVersionInfo(); return false;" style="color:#8b5a2b;">Retry</a>';
  }
}

function _closeUpdateModal() {
  document.getElementById('update-modal').style.display = 'none';
  // If upgrade is still running, show the reopen button
  if (_updateEventSource) {
    document.getElementById('upgrade-btn').style.display = 'none';
    document.getElementById('upgrade-reopen-btn').style.display = '';
  }
}

function startUpgrade() {
  var modal = document.getElementById('update-modal');
  var log = document.getElementById('update-log');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');
  var title = document.getElementById('update-modal-title');

  // Upgrade mode: show Start, disable Close until done, set title
  if (startBtn) startBtn.style.display = '';
  if (title) title.textContent = '⬆️ Upgrading Omni Chits';

  log.innerHTML = '';
  closeBtn.disabled = true;
  startBtn.disabled = false;
  modal.style.display = 'flex';
}

function runUpgrade() {
  var btn = document.getElementById('upgrade-btn');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');

  btn.disabled = true;
  startBtn.disabled = true;
  closeBtn.disabled = true;

  _updateEventSource = new EventSource('/api/update/run');

  _updateEventSource.onmessage = function(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'log') {
        appendLogLine(data.line);
      } else if (data.type === 'done') {
        onUpgradeComplete(data);
        _updateEventSource.close();
        _updateEventSource = null;
      } else if (data.type === 'error') {
        appendLogLine('[ERROR] ' + data.message);
        closeBtn.disabled = false;
        startBtn.disabled = false;
        btn.disabled = false;
        _updateEventSource.close();
        _updateEventSource = null;
      }
    } catch (e) {
      appendLogLine(event.data);
    }
  };

  _updateEventSource.onerror = function() {
    appendLogLine('[ERROR] Connection lost');
    closeBtn.disabled = false;
    startBtn.disabled = false;
    btn.disabled = false;
    if (_updateEventSource) {
      _updateEventSource.close();
      _updateEventSource = null;
    }
  };
}

function appendLogLine(line, bold) {
  const log = document.getElementById('update-log');
  const span = document.createElement('span');
  span.style.display = 'block';

  // Center header lines (=== banners and banner text that starts with a space)
  if (line.indexOf('===') !== -1 || (line.startsWith(' ') && line.trim().length > 0 && !line.trim().startsWith('['))) {
    span.style.textAlign = 'center';
  } else {
    span.style.textAlign = 'left';
  }

  if (line.startsWith('[OK]')) {
    span.className = 'log-ok';
  } else if (line.startsWith('[WARN]')) {
    span.className = 'log-warn';
  } else if (line.startsWith('[ERROR]')) {
    span.className = 'log-error';
  } else if (line.startsWith('[STEP]')) {
    span.className = 'log-step';
  } else if (line.startsWith('[HINT]')) {
    span.className = 'log-hint';
  }

  // Only auto-scroll if user is already near the bottom
  const isNearBottom = (log.scrollHeight - log.scrollTop - log.clientHeight) < 40;

  span.textContent = line;
  if (bold) span.style.fontWeight = 'bold';
  log.appendChild(span);

  if (isNearBottom) {
    log.scrollTop = log.scrollHeight;
  }
}

function onUpgradeComplete(data) {
  const btn = document.getElementById('upgrade-btn');
  const closeBtn = document.getElementById('update-close-btn');
  const startBtn = document.getElementById('update-start-btn');

  if (data.exit_code === 0) {
    appendLogLine('[OK] Update complete! Version: ' + (data.version || 'unknown'), true);
  } else {
    appendLogLine('[ERROR] Update failed (exit code ' + data.exit_code + ')', true);
  }

  closeBtn.disabled = false;
  startBtn.disabled = false;
  btn.disabled = false;
  document.getElementById('upgrade-reopen-btn').style.display = 'none';
  btn.style.display = '';
  loadVersionInfo();
}

function copyUpdateLog() {
  const log = document.getElementById('update-log');
  const text = log.innerText;
  navigator.clipboard.writeText(text).then(function() {
    const btn = document.getElementById('update-copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(function() { btn.textContent = '📋 Copy Log'; }, 2000);
  }).catch(function() {
    // Fallback for non-HTTPS contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = document.getElementById('update-copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(function() { btn.textContent = '📋 Copy Log'; }, 2000);
  });
}

async function loadLastLog() {
  var log = document.getElementById('update-log');
  var modal = document.getElementById('update-modal');
  var closeBtn = document.getElementById('update-close-btn');
  var startBtn = document.getElementById('update-start-btn');
  var title = document.getElementById('update-modal-title');

  // Log-only mode: hide Start, show Close, change title
  if (startBtn) startBtn.style.display = 'none';
  if (title) title.textContent = '📄 Upgrade Log';

  try {
    var res = await fetch('/api/update/log');
    var data = await res.json();
    if (!data.log) {
      log.innerHTML = '';
      appendLogLine('No previous upgrade log found.');
    } else {
      log.innerHTML = '';
      data.log.split('\n').forEach(function(line) {
        appendLogLine(line);
      });
    }
  } catch (e) {
    log.innerHTML = '';
    appendLogLine('[ERROR] Failed to load log: ' + e.message);
  }
  closeBtn.disabled = false;
  modal.style.display = 'flex';
}


// ── Release Notes Modal ──────────────────────────────────────────────────────

var _releaseNotes = [];      // Array of {version, content} — newest first
var _releaseNotesIndex = 0;  // Current index being displayed

async function showReleaseNotes() {
  var modal = document.getElementById('release-notes-modal');
  var content = document.getElementById('release-notes-content');
  var header = document.getElementById('release-notes-version');
  content.innerHTML = '<em>Loading...</em>';
  if (header) header.textContent = '';
  modal.style.display = 'flex';

  try {
    var res = await fetch('/api/release-notes');
    var data = await res.json();
    _releaseNotes = data.notes || [];
    if (_releaseNotes.length === 0) {
      content.innerHTML = '<p style="opacity:0.6;">No release notes available.</p>';
      if (header) header.textContent = '';
      _updateReleaseNotesNav();
      return;
    }
    _releaseNotesIndex = 0;
    _renderCurrentReleaseNote();
  } catch (e) {
    content.innerHTML = '<p style="color:#b22222;">Failed to load release notes.</p>';
    if (header) header.textContent = '';
  }
}

function _renderCurrentReleaseNote() {
  var content = document.getElementById('release-notes-content');
  var header = document.getElementById('release-notes-version');
  if (!content) return;

  var note = _releaseNotes[_releaseNotesIndex];
  if (!note) {
    content.innerHTML = '<p style="opacity:0.6;">No release notes available.</p>';
    if (header) header.textContent = '';
    _updateReleaseNotesNav();
    return;
  }

  if (header) header.textContent = 'v' + note.version;

  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(note.content);
  } else {
    content.textContent = note.content;
  }

  _updateReleaseNotesNav();
}

function _updateReleaseNotesNav() {
  var prevBtn = document.getElementById('release-notes-prev');
  var nextBtn = document.getElementById('release-notes-next');
  var counter = document.getElementById('release-notes-counter');

  if (prevBtn) {
    // "Previous" goes to older (higher index)
    prevBtn.disabled = _releaseNotesIndex >= _releaseNotes.length - 1;
    prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
  }
  if (nextBtn) {
    // "Next" goes to newer (lower index)
    nextBtn.disabled = _releaseNotesIndex <= 0;
    nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
  }
  if (counter) {
    if (_releaseNotes.length > 0) {
      counter.textContent = (_releaseNotesIndex + 1) + ' / ' + _releaseNotes.length;
    } else {
      counter.textContent = '';
    }
  }
}

function releaseNotesPrev() {
  if (_releaseNotesIndex < _releaseNotes.length - 1) {
    _releaseNotesIndex++;
    _renderCurrentReleaseNote();
  }
}

function releaseNotesNext() {
  if (_releaseNotesIndex > 0) {
    _releaseNotesIndex--;
    _renderCurrentReleaseNote();
  }
}

function closeReleaseNotesModal() {
  document.getElementById('release-notes-modal').style.display = 'none';
}


// ── Default Notifications (settings UI) ──────────────────────────────────────

/**
 * Render the list of default notification rows for a given type ('start' or 'due').
 * @param {string} type - 'start' or 'due'
 * @param {Array} items - [{value, unit, afterTarget}]
 */
function _renderDefaultNotifList(type, items) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">None configured.</div>';
    return;
  }
  items.forEach(function(item, idx) {
    var row = document.createElement('div');
    row.className = 'default-notif-row';
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:5px;';

    // Number input
    var valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.min = '1';
    valInput.value = item.value || 15;
    valInput.style.cssText = 'width:40px !important;min-width:40px !important;max-width:40px !important;flex:0 0 40px !important;padding:3px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.85em;box-sizing:border-box;text-align:center;';
    valInput.addEventListener('input', function() { setSaveButtonUnsaved(); });
    row.appendChild(valInput);

    // Unit dropdown (compact)
    var unitSel = document.createElement('select');
    [{v:'minutes',t:'min'},{v:'hours',t:'hr'},{v:'days',t:'day'}].forEach(function(u) {
      var opt = document.createElement('option');
      opt.value = u.v;
      opt.textContent = u.t;
      if (u.v === (item.unit || 'minutes')) opt.selected = true;
      unitSel.appendChild(opt);
    });
    unitSel.style.cssText = 'width:auto !important;min-width:auto !important;max-width:none !important;flex:0 0 auto !important;padding:3px 2px;border:1px solid #8b5a2b;border-radius:4px;font-family:inherit;font-size:0.8em;';
    unitSel.addEventListener('change', function() { setSaveButtonUnsaved(); });
    row.appendChild(unitSel);

    // Before/After toggle pill
    var isAfter = !!item.afterTarget;
    var toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex;border:1px solid #8b5a2b;border-radius:4px;overflow:hidden;flex-shrink:0;cursor:pointer;font-size:0.75em;line-height:1;';
    var hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.value = isAfter ? 'true' : 'false';
    toggleWrap.appendChild(hiddenInput);

    var beforeSide = document.createElement('span');
    var afterSide = document.createElement('span');
    var activeStyle = 'padding:3px 5px;background:#8b5a2b;color:#fff8e1;font-weight:bold;';
    var inactiveStyle = 'padding:3px 5px;background:#f5e6cc;color:#bbb;';

    beforeSide.textContent = 'before';
    afterSide.textContent = 'after';

    function _updateToggle() {
      var after = hiddenInput.value === 'true';
      beforeSide.style.cssText = after ? inactiveStyle : activeStyle;
      afterSide.style.cssText = after ? activeStyle : inactiveStyle;
    }
    _updateToggle();

    toggleWrap.addEventListener('click', function() {
      hiddenInput.value = hiddenInput.value === 'true' ? 'false' : 'true';
      _updateToggle();
      setSaveButtonUnsaved();
    });
    toggleWrap.appendChild(beforeSide);
    toggleWrap.appendChild(afterSide);
    row.appendChild(toggleWrap);

    // Type label
    var label = document.createElement('span');
    label.textContent = type === 'start' ? 'start' : 'due';
    label.style.cssText = 'font-size:0.85em;color:#1a1208;flex-shrink:0;';
    row.appendChild(label);

    // Remove button
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove';
    removeBtn.style.cssText = 'background:#a0522d;color:#fdf5e6;border:1px solid #5c4033;border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;font-family:inherit;flex-shrink:0;margin-left:auto;';
    removeBtn.addEventListener('click', function() {
      row.remove();
      setSaveButtonUnsaved();
      if (container.children.length === 0) {
        container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">None configured.</div>';
      }
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

/**
 * Add a new default notification row for a given type.
 */
function _addDefaultNotifRow(type) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return;
  _renderDefaultNotifList(type, _gatherDefaultNotifList(type).concat([{ value: 15, unit: 'minutes', afterTarget: false }]));
  setSaveButtonUnsaved();
}

/**
 * Gather default notification rows from the DOM for a given type.
 * @param {string} type - 'start' or 'due'
 * @returns {Array} [{value, unit, afterTarget}]
 */
function _gatherDefaultNotifList(type) {
  var container = document.getElementById('default-notif-' + type + '-list');
  if (!container) return [];
  // Try class-based selector first, fall back to any div with an input
  var rows = container.querySelectorAll('.default-notif-row');
  if (rows.length === 0) {
    rows = container.querySelectorAll('div');
  }
  var result = [];
  rows.forEach(function(row) {
    var valInput = row.querySelector('input[type="number"]');
    var unitSel = row.querySelector('select');
    var hiddenInput = row.querySelector('input[type="hidden"]');
    if (!valInput || !unitSel) return;
    var val = parseInt(valInput.value);
    if (!val || val <= 0) return;
    result.push({
      value: val,
      unit: unitSel.value || 'minutes',
      afterTarget: hiddenInput ? hiddenInput.value === 'true' : false,
    });
  });
  console.debug('_gatherDefaultNotifList(' + type + '): found ' + rows.length + ' rows, gathered ' + result.length + ' items', result);
  return result;
}


/* ═══════════════════════════════════════════════════════════════════════════
   Login Message — load, preview, dirty tracking (admin only)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load the current login message and instance name into the form fields.
 * Called after auth resolves, only for admin users.
 */
function _loadLoginMessage() {
  var textarea = document.getElementById('login-message-input');
  var preview = document.getElementById('login-message-preview');
  var instanceInput = document.getElementById('instance-name-input');
  if (!textarea) return;

  fetch('/api/auth/login-message')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.message) {
        textarea.value = data.message;
        if (preview && typeof marked !== 'undefined') {
          preview.innerHTML = marked.parse(data.message);
        }
      }
      if (data && data.instance_name && instanceInput) {
        instanceInput.value = data.instance_name;
      }
    })
    .catch(function(e) { console.error('Failed to load login message:', e); });

  // Live preview + dirty tracking on textarea input
  textarea.addEventListener('input', function() {
    if (preview && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(textarea.value);
    }
    setSaveButtonUnsaved();
  });

  // Dirty tracking on instance name input
  if (instanceInput) {
    instanceInput.addEventListener('input', function() {
      setSaveButtonUnsaved();
    });
  }
}

// Initialize login message after auth resolves (admin only)
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function(user) {
    if (user && user.is_admin) {
      _loadLoginMessage();
    }
  });
}

// ── Kiosk Tag Picker ─────────────────────────────────────────────────────────

/** Cached tree and selection state for the kiosk tag picker */
var _kioskTagTree = [];
var _kioskSelectedTags = [];

/**
 * Load all tags from settings and render the kiosk tag picker as a tree.
 * Uses the shared buildTagTree + renderTagTree pattern.
 * Selecting a parent tag automatically includes all children on the kiosk.
 */
function _loadKioskTagPicker() {
  var container = document.getElementById('kiosk-tag-list');
  if (!container) return;

  // Get tags from settings
  var tags = [];
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.tags) {
    tags = window.settingsManager.settings.tags;
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch (e) { tags = []; }
    }
  }
  if (!Array.isArray(tags)) tags = [];

  // Filter out system tags
  var userTags = tags.filter(function(t) {
    return t.name && typeof isSystemTag === 'function' && !isSystemTag(t.name);
  });

  if (userTags.length === 0) {
    container.innerHTML = '<span style="opacity:0.5;font-size:0.85em;">No tags found. Create tags in the Tag Editor above.</span>';
    return;
  }

  // Get saved kiosk tags (stored in kiosk_users field for backward compat)
  _kioskSelectedTags = [];
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.kiosk_users) {
    _kioskSelectedTags = window.settingsManager.settings.kiosk_users;
    if (typeof _kioskSelectedTags === 'string') {
      try { _kioskSelectedTags = JSON.parse(_kioskSelectedTags); } catch (e) { _kioskSelectedTags = []; }
    }
  }
  if (!Array.isArray(_kioskSelectedTags)) _kioskSelectedTags = [];

  // Build tree
  _kioskTagTree = buildTagTree(userTags);

  // Render
  _renderKioskTagTree();
}

/**
 * Re-render the kiosk tag tree with current selection state.
 */
function _renderKioskTagTree() {
  var container = document.getElementById('kiosk-tag-list');
  if (!container) return;

  renderTagTree(container, _kioskTagTree, _kioskSelectedTags, function(fullPath, isNowSelected) {
    if (isNowSelected) {
      if (_kioskSelectedTags.indexOf(fullPath) === -1) _kioskSelectedTags.push(fullPath);
    } else {
      _kioskSelectedTags = _kioskSelectedTags.filter(function(t) { return t !== fullPath; });
    }
    _renderKioskTagTree();
    setSaveButtonUnsaved();
  });
}

/**
 * Gather the selected kiosk tag names.
 * @returns {Array} Array of tag name strings
 */
function _gatherKioskTags() {
  return _kioskSelectedTags.slice();
}

/**
 * Open the kiosk with the selected tags.
 */
function _openKiosk() {
  var selected = _gatherKioskTags();
  if (selected.length === 0) {
    alert('Please select at least one tag for the kiosk view.');
    return;
  }
  window.location.href = '/kiosk?tags=' + encodeURIComponent(selected.join(','));
}

// Load kiosk tag picker after settings are loaded
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function(user) {
    // Wait a tick for settingsManager to finish loading
    setTimeout(_loadKioskTagPicker, 500);
  });
}

// ── Network Access ───────────────────────────────────────────────────────────

// Track the saved config so we can detect changes for the save button
var _tsSavedAuthKey = '';
var _tsSavedEnabled = false;

/**
 * Show an inline feedback message inside the Network Access block.
 * Stays visible until dismissed (click) or replaced by a new message.
 * Flashes briefly on each update.
 * @param {string} message - The message to display
 * @param {string} [type='success'] - 'success', 'error', or 'info'
 */
function _tsFeedback(message, type) {
  type = type || 'success';
  var el = document.getElementById('tailscale-feedback');
  if (!el) return;

  var colors = {
    success: { bg: 'rgba(45,90,30,0.12)', border: '#2d5a1e', text: '#1e3f14', icon: '✅' },
    error:   { bg: 'rgba(139,26,26,0.12)', border: '#8b1a1a', text: '#5c1010', icon: '❌' },
    warning: { bg: 'rgba(184,134,11,0.12)', border: '#b8860b', text: '#6b4f00', icon: '⚠️' },
    info:    { bg: 'rgba(74,44,42,0.10)', border: '#4a2c2a', text: '#2b1e0f', icon: 'ℹ️' }
  };
  var c = colors[type] || colors.info;

  el.style.display = '';
  el.style.background = c.bg;
  el.style.border = '1px solid ' + c.border;
  el.style.color = c.text;
  el.textContent = c.icon + '  ' + message;

  // Flash effect
  el.style.opacity = '0';
  requestAnimationFrame(function () {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

/**
 * Toggle Tailscale enabled state — shows/hides the config body,
 * updates the enable button label, and marks config dirty.
 */
function toggleTailscaleEnabled() {
  var body = document.getElementById('tailscale-config-body');
  if (!body) return;

  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : '';

  if (!isVisible) {
    // Expanding — refresh status
    refreshTailscaleStatus();
  }
}

/**
 * Update the Tailscale header icon based on connection status.
 * @param {string} status - 'not_installed', 'installed_inactive', 'active', 'error'
 */
function _tsUpdateHeaderIcon(status) {
  var icon = document.getElementById('tailscale-header-icon');
  if (!icon) return;

  switch (status) {
    case 'active':        icon.textContent = '🟢'; break;
    case 'installed_inactive': icon.textContent = '🟡'; break;
    case 'not_installed': icon.textContent = '⚪'; break;
    case 'error':         icon.textContent = '🔴'; break;
    default:              icon.textContent = '⚪'; break;
  }
}

/**
 * Quick status fetch that only updates the header icon — no feedback messages.
 * Used on page load to show connection state even when config is collapsed.
 */
async function _tsQuickStatusForIcon() {
  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (!response.ok) return;
    var data = await response.json();
    _tsUpdateHeaderIcon(data.status);
  } catch (e) {
    // Silently ignore — icon stays at default
  }
}

/**
 * Sync the enable button and config body visibility with the current checkbox state.
 * Called after loading config from the server.
 */
function _tsApplyEnabledState() {
  var checkbox = document.getElementById('tailscale-enabled');
  var body = document.getElementById('tailscale-config-body');
  if (!checkbox || !body) return;

  if (checkbox.checked) {
    body.style.display = '';
    refreshTailscaleStatus();
  } else {
    body.style.display = 'none';
  }
}

/**
 * Update the Save button enabled/disabled state based on whether
 * the auth key or enabled checkbox has changed from the saved values.
 */
function _tsUpdateSaveButton() {
  var authKeyInput = document.getElementById('tailscale-auth-key');
  var enabledCheckbox = document.getElementById('tailscale-enabled');
  var saveBtn = document.getElementById('tailscale-save-btn');
  if (!saveBtn) return;

  var currentKey = authKeyInput ? authKeyInput.value : '';
  var currentEnabled = enabledCheckbox ? enabledCheckbox.checked : false;
  var dirty = (currentKey !== _tsSavedAuthKey) || (currentEnabled !== _tsSavedEnabled);

  saveBtn.disabled = !dirty;
  saveBtn.style.opacity = dirty ? '1' : '0.5';
}

/**
 * Update Connect/Disconnect button states based on the current Tailscale status.
 * @param {string} status - 'not_installed', 'installed_inactive', 'active', 'error'
 */
function _tsUpdateConnectionButtons(status) {
  var upBtn = document.getElementById('tailscale-up-btn');
  var downBtn = document.getElementById('tailscale-down-btn');

  var canConnect = (status === 'installed_inactive');
  var canDisconnect = (status === 'active');

  if (upBtn) {
    upBtn.disabled = !canConnect;
    upBtn.style.opacity = canConnect ? '1' : '0.5';
  }
  if (downBtn) {
    downBtn.disabled = !canDisconnect;
    downBtn.style.opacity = canDisconnect ? '1' : '0.5';
  }
}

/**
 * Fetch the current Tailscale service status and update the UI badge,
 * IP/hostname row, error row, and button states accordingly.
 */
async function refreshTailscaleStatus() {
  var badge = document.getElementById('tailscale-status-badge');
  var infoRow = document.getElementById('tailscale-info-row');
  var errorRow = document.getElementById('tailscale-error-row');
  var errorMsg = document.getElementById('tailscale-error-msg');
  var ipSpan = document.getElementById('tailscale-ip');
  var hostnameSpan = document.getElementById('tailscale-hostname');
  var currentStatus = 'unknown';

  // Show checking state
  if (badge) badge.textContent = '⏳ Checking...';
  _tsFeedback('Checking Tailscale status...', 'info');
  var _tsCheckStart = Date.now();

  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (!response.ok) throw new Error('Status check failed');
    var data = await response.json();
    currentStatus = data.status;

    // Ensure "Checking..." shows for at least 1 second
    var elapsed = Date.now() - _tsCheckStart;
    if (elapsed < 1000) await new Promise(function (r) { setTimeout(r, 1000 - elapsed); });

    // Hide both optional rows by default
    if (infoRow) infoRow.style.display = 'none';
    if (errorRow) errorRow.style.display = 'none';

    switch (data.status) {
      case 'not_installed':
        if (badge) badge.textContent = '⚪ Not Installed';
        _tsFeedback('Tailscale is not installed on this server.', 'info');
        break;
      case 'installed_inactive':
        if (badge) badge.textContent = '🟡 Inactive';
        if (data.message) {
          if (errorRow) errorRow.style.display = '';
          if (errorMsg) errorMsg.textContent = data.message;
        }
        _tsFeedback('Tailscale installed but not connected.', 'info');
        break;
      case 'active':
        if (badge) badge.textContent = '🟢 Connected';
        if (infoRow) infoRow.style.display = '';
        if (ipSpan) ipSpan.textContent = data.ip || '—';
        if (hostnameSpan) hostnameSpan.textContent = data.hostname || '—';
        _tsFeedback('Connected — IP: ' + (data.ip || '—'), 'success');
        break;
      case 'error':
        if (badge) badge.textContent = '🔴 Error';
        if (errorRow) errorRow.style.display = '';
        if (errorMsg) errorMsg.textContent = data.message || 'Unknown error';
        _tsFeedback('Error: ' + (data.message || 'Unknown'), 'error');
        break;
      default:
        if (badge) badge.textContent = '⚪ Unknown';
        break;
    }
  } catch (error) {
    console.error('Failed to refresh Tailscale status:', error);
    if (badge) badge.textContent = '⚠️ Unable to check status';
    if (infoRow) infoRow.style.display = 'none';
    if (errorRow) errorRow.style.display = 'none';
    _tsFeedback('Unable to check status.', 'error');
  }

  _tsUpdateConnectionButtons(currentStatus);
  _tsUpdateHeaderIcon(currentStatus);
}

/**
 * Load the saved Tailscale configuration from the backend and populate
 * the auth key input and enabled checkbox.
 */
async function loadTailscaleConfig() {
  try {
    var response = await fetch('/api/network-access/tailscale');
    if (!response.ok) throw new Error('Failed to load Tailscale config');
    var data = await response.json();

    var authKeyInput = document.getElementById('tailscale-auth-key');
    var enabledCheckbox = document.getElementById('tailscale-enabled');

    var key = (data.config && data.config.auth_key) || '';
    var enabled = !!data.enabled;

    if (authKeyInput) authKeyInput.value = key;
    if (enabledCheckbox) enabledCheckbox.checked = enabled;

    // Store saved values for dirty tracking
    _tsSavedAuthKey = key;
    _tsSavedEnabled = enabled;
    _tsUpdateSaveButton();
    _tsApplyEnabledState();

    // Wire up change listeners (only once)
    if (authKeyInput && !authKeyInput._tsListenerAdded) {
      authKeyInput.addEventListener('input', _tsUpdateSaveButton);
      authKeyInput._tsListenerAdded = true;
    }
    if (enabledCheckbox && !enabledCheckbox._tsListenerAdded) {
      enabledCheckbox.addEventListener('change', _tsUpdateSaveButton);
      enabledCheckbox._tsListenerAdded = true;
    }
  } catch (error) {
    console.error('Failed to load Tailscale config:', error);
  }
}

/**
 * Save the current Tailscale auth key and enabled state to the backend.
 */
async function saveTailscaleConfig() {
  var authKeyInput = document.getElementById('tailscale-auth-key');
  var enabledCheckbox = document.getElementById('tailscale-enabled');

  var authKey = authKeyInput ? authKeyInput.value.trim() : '';
  var enabled = enabledCheckbox ? enabledCheckbox.checked : false;

  try {
    var response = await fetch('/api/network-access/tailscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled, config: { auth_key: authKey } })
    });
    if (!response.ok) {
      var err = await response.json();
      throw new Error(err.detail || 'Save failed');
    }
    var saveData = await response.json();
    // Update saved values so save button greys out again
    _tsSavedAuthKey = authKey;
    _tsSavedEnabled = enabled;
    _tsUpdateSaveButton();
    // If Tailscale was disconnected because key was removed, refresh status and notify
    if (saveData.tailscale_disconnected) {
      await refreshTailscaleStatus();
      if (!authKey) {
        _tsFeedback('Config saved. Tailscale disconnected (auth key removed).', 'warning');
      } else {
        _tsFeedback('Config saved. Tailscale disconnected (key changed — click Connect to re-authenticate).', 'warning');
      }
    } else {
      await refreshTailscaleStatus();
      _tsFeedback('Tailscale configuration saved.');
    }
  } catch (error) {
    console.error('Failed to save Tailscale config:', error);
    _tsFeedback('Failed to save config: ' + error.message, 'error');
  }
}

/**
 * Start the Tailscale service using the saved auth key.
 * Refreshes the status badge on success.
 */
async function tailscaleUp() {
  try {
    var response = await fetch('/api/network-access/tailscale/up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();
    if (!response.ok) {
      _tsFeedback('Connect failed: ' + (data.detail || data.output || 'Unknown error'), 'error');
      return;
    }
    await refreshTailscaleStatus();
    _tsFeedback(data.message || 'Tailscale connected.');
  } catch (error) {
    console.error('Tailscale up failed:', error);
    _tsFeedback('Connect failed: ' + error.message, 'error');
  }
}

/**
 * Stop the Tailscale service.
 * Refreshes the status badge on success.
 */
async function tailscaleDown() {
  try {
    var response = await fetch('/api/network-access/tailscale/down', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();
    if (!response.ok) {
      _tsFeedback('Disconnect failed: ' + (data.detail || data.output || 'Unknown error'), 'error');
      return;
    }
    await refreshTailscaleStatus();
    _tsFeedback(data.message || 'Tailscale disconnected.', 'warning');
  } catch (error) {
    console.error('Tailscale down failed:', error);
    _tsFeedback('Disconnect failed: ' + error.message, 'error');
  }
}

/**
 * Toggle the auth key input between password (masked) and text (visible),
 * and update the toggle button label accordingly.
 */
function toggleAuthKeyVisibility() {
  var input = document.getElementById('tailscale-auth-key');
  var toggleBtn = document.getElementById('tailscale-key-toggle');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (toggleBtn) toggleBtn.textContent = '🔒';
  } else {
    input.type = 'password';
    if (toggleBtn) toggleBtn.textContent = '👁️';
  }
}

// Load Network Access config and status after auth resolves (admin only)
if (typeof waitForAuth === 'function') {
  waitForAuth().then(function(user) {
    if (user && user.is_admin) {
      loadTailscaleConfig();
      // Always update header icon regardless of expanded/collapsed state
      _tsQuickStatusForIcon();
      // Load Ntfy config and display topic
      loadNtfyConfig();
      _ntfyQuickStatusForIcon();
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// Ntfy Push Notifications
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show an inline feedback message inside the Ntfy config block.
 * Stays visible until dismissed (click) or replaced by a new message.
 * @param {string} message - The message to display
 * @param {string} [type='success'] - 'success', 'error', or 'info'
 */
function _ntfyFeedback(message, type) {
  type = type || 'success';
  var el = document.getElementById('ntfy-feedback');
  if (!el) return;

  var colors = {
    success: { bg: 'rgba(45,90,30,0.12)', border: '#2d5a1e', text: '#1e3f14', icon: '✅' },
    error:   { bg: 'rgba(139,26,26,0.12)', border: '#8b1a1a', text: '#5c1010', icon: '❌' },
    warning: { bg: 'rgba(184,134,11,0.12)', border: '#b8860b', text: '#6b4f00', icon: '⚠️' },
    info:    { bg: 'rgba(74,44,42,0.10)', border: '#4a2c2a', text: '#2b1e0f', icon: 'ℹ️' }
  };
  var c = colors[type] || colors.info;

  el.style.display = '';
  el.style.background = c.bg;
  el.style.border = '1px solid ' + c.border;
  el.style.color = c.text;
  el.textContent = c.icon + '  ' + message;

  // Flash effect
  el.style.opacity = '0';
  requestAnimationFrame(function () {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

/**
 * Toggle Ntfy section — expand/collapse the ntfy config body.
 */
function toggleNtfySection() {
  var body = document.getElementById('ntfy-config-body');
  if (!body) return;

  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : '';

  if (!isVisible) {
    // Expanding — refresh status, server URL, and topic
    checkNtfyStatus();
    displayNtfyTopic();
    displayNtfyServerUrl();
  }
}

/**
 * Update the Ntfy header icon based on service status.
 * @param {string} status - 'active', 'unreachable', 'not_configured', 'disabled'
 */
function _ntfyUpdateHeaderIcon(status) {
  var icon = document.getElementById('ntfy-header-icon');
  if (!icon) return;

  switch (status) {
    case 'active':         icon.textContent = '🟢'; break;
    case 'unreachable':    icon.textContent = '🔴'; break;
    case 'disabled':       icon.textContent = '⚫'; break;
    case 'not_configured': icon.textContent = '⚪'; break;
    default:               icon.textContent = '⚪'; break;
  }
}

/**
 * Quick status fetch that only updates the header icon — no feedback messages.
 * Used on page load to show service state even when config is collapsed.
 * Also sets the disable/enable button label based on enabled state.
 */
async function _ntfyQuickStatusForIcon() {
  try {
    var response = await fetch('/api/network-access/ntfy/status');
    if (!response.ok) return;
    var data = await response.json();
    _ntfyUpdateHeaderIcon(data.status);
    // Set disable/enable button state
    _ntfyUpdateDisableButton(data.enabled !== false && data.status !== 'not_configured');
  } catch (e) {
    // Silently ignore — icon stays at default
  }
}

/**
 * Update the disable/enable button label based on current ntfy enabled state.
 * @param {boolean} isEnabled - Whether ntfy is currently enabled
 */
function _ntfyUpdateDisableButton(isEnabled) {
  var btn = document.getElementById('ntfy-disable-btn') || document.getElementById('ntfy-enable-service-btn');
  if (!btn) return;
  if (isEnabled) {
    btn.textContent = '⏹️ Disable';
    btn.setAttribute('onclick', 'disableNtfyService()');
    btn.id = 'ntfy-disable-btn';
  } else {
    btn.textContent = '▶️ Enable';
    btn.setAttribute('onclick', 'enableNtfyService()');
    btn.id = 'ntfy-enable-service-btn';
  }
}

/**
 * Fetch the current Ntfy service status and update the UI badge
 * and header icon accordingly.
 * GET /api/network-access/ntfy/status
 */
async function checkNtfyStatus() {
  var badge = document.getElementById('ntfy-status-badge');
  var currentStatus = 'unknown';

  if (badge) badge.textContent = '⏳ Checking...';
  _ntfyFeedback('Checking Ntfy status...', 'info');
  var checkStart = Date.now();

  try {
    var response = await fetch('/api/network-access/ntfy/status');
    if (!response.ok) throw new Error('Status check failed');
    var data = await response.json();
    currentStatus = data.status;

    // Ensure "Checking..." shows for at least 1 second
    var elapsed = Date.now() - checkStart;
    if (elapsed < 1000) await new Promise(function (r) { setTimeout(r, 1000 - elapsed); });

    switch (data.status) {
      case 'active':
        if (badge) badge.textContent = '🟢 Active';
        _ntfyFeedback('Ntfy service is running.', 'success');
        break;
      case 'disabled':
        if (badge) badge.textContent = '⚫ Disabled';
        _ntfyFeedback('Ntfy notifications are disabled.', 'info');
        break;
      case 'unreachable':
        if (badge) badge.textContent = '🔴 Unreachable';
        _ntfyFeedback('Ntfy service unreachable: ' + (data.message || 'Connection failed'), 'error');
        break;
      case 'not_configured':
        if (badge) badge.textContent = '⚪ Not Configured';
        _ntfyFeedback('Ntfy is not configured yet.', 'info');
        break;
      default:
        if (badge) badge.textContent = '⚪ Unknown';
        break;
    }
  } catch (error) {
    console.error('Failed to check Ntfy status:', error);
    if (badge) badge.textContent = '⚠️ Unable to check status';
    _ntfyFeedback('Unable to check status.', 'error');
  }

  _ntfyUpdateHeaderIcon(currentStatus);
  _ntfyUpdateDisableButton(currentStatus === 'active');
}

/**
 * Send a test notification to the current user's Ntfy topic.
 * POST /api/network-access/ntfy/test
 */
async function testNtfyNotification() {
  var testBtn = document.getElementById('ntfy-test-btn');
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.style.opacity = '0.5';
  }

  _ntfyFeedback('Sending test notification...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Test notification sent to topic: ' + data.topic, 'success');
    } else {
      _ntfyFeedback('Test failed: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Ntfy test failed:', error);
    _ntfyFeedback('Test failed: ' + error.message, 'error');
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.style.opacity = '1';
    }
  }
}


/**
 * Disable the Ntfy service — sets enabled=0 in the backend.
 * Preserves config so re-enabling is seamless.
 */
async function disableNtfyService() {
  var disableBtn = document.getElementById('ntfy-disable-btn');
  if (disableBtn) { disableBtn.disabled = true; disableBtn.style.opacity = '0.5'; }

  _ntfyFeedback('Disabling Ntfy...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Ntfy notifications disabled.', 'success');
      _ntfyUpdateHeaderIcon('not_configured');
      var badge = document.getElementById('ntfy-status-badge');
      if (badge) badge.textContent = '⚪ Disabled';
      // Swap button to Enable
      if (disableBtn) {
        disableBtn.textContent = '▶️ Enable';
        disableBtn.setAttribute('onclick', 'enableNtfyService()');
        disableBtn.id = 'ntfy-enable-service-btn';
        disableBtn.disabled = false;
        disableBtn.style.opacity = '1';
      }
    } else {
      _ntfyFeedback('Failed to disable: ' + (data.detail || 'Unknown error'), 'error');
      if (disableBtn) { disableBtn.disabled = false; disableBtn.style.opacity = '1'; }
    }
  } catch (error) {
    console.error('Failed to disable Ntfy:', error);
    _ntfyFeedback('Failed to disable: ' + error.message, 'error');
    if (disableBtn) { disableBtn.disabled = false; disableBtn.style.opacity = '1'; }
  }
}


/**
 * Re-enable the Ntfy service — sets enabled=1 in the backend.
 */
async function enableNtfyService() {
  var enableBtn = document.getElementById('ntfy-enable-service-btn');
  if (enableBtn) { enableBtn.disabled = true; enableBtn.style.opacity = '0.5'; }

  _ntfyFeedback('Enabling Ntfy...', 'info');

  try {
    var response = await fetch('/api/network-access/ntfy/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    var data = await response.json();

    if (data.success) {
      _ntfyFeedback('Ntfy notifications enabled.', 'success');
      // Refresh status to get actual service state
      checkNtfyStatus();
      // Swap button back to Disable
      if (enableBtn) {
        enableBtn.textContent = '⏹️ Disable';
        enableBtn.setAttribute('onclick', 'disableNtfyService()');
        enableBtn.id = 'ntfy-disable-btn';
        enableBtn.disabled = false;
        enableBtn.style.opacity = '1';
      }
    } else {
      _ntfyFeedback('Failed to enable: ' + (data.detail || 'Unknown error'), 'error');
      if (enableBtn) { enableBtn.disabled = false; enableBtn.style.opacity = '1'; }
    }
  } catch (error) {
    console.error('Failed to enable Ntfy:', error);
    _ntfyFeedback('Failed to enable: ' + error.message, 'error');
    if (enableBtn) { enableBtn.disabled = false; enableBtn.style.opacity = '1'; }
  }
}

/**
 * Open the Ntfy app on the phone via deep link.
 * Uses the ntfy:// URL scheme which the Ntfy Android/iOS app registers.
 */
function openNtfyApp() {
  window.location.href = 'ntfy://';
}

/**
 * Open the Tailscale app on the phone via deep link.
 * Tailscale doesn't register a custom URL scheme on Android, so we use
 * an intent URI to launch the app's main activity by package name.
 * Falls back to the Play Store listing if the app isn't installed.
 * On non-Android platforms, tries tailscale:// then falls back to the
 * Tailscale admin console.
 */
function openTailscaleApp() {
  var ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    // Use intent URI to launch the app's main activity directly.
    // S.browser_fallback_url sends user to Play Store if app not installed.
    window.open('intent://open#Intent;package=com.tailscale.ipn;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.tailscale.ipn;end', '_blank');
  } else {
    window.open('tailscale://', '_blank');
  }
}

/**
 * Compute and display the user's auto-generated Ntfy topic from their UUID.
 * Topic = "cwoc-" + first 12 alphanumeric chars of user_id.
 */
function displayNtfyTopic() {
  var topicSpan = document.getElementById('ntfy-topic-display');
  if (!topicSpan) return;

  var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user || !user.user_id) {
    topicSpan.textContent = '—';
    return;
  }

  var alphanumeric = user.user_id.replace(/[^a-zA-Z0-9]/g, '');
  var topic = 'cwoc-' + alphanumeric.substring(0, 12);
  topicSpan.textContent = topic;
}

/**
 * Display the Ntfy server URLs for the phone app.
 * Always shows the local URL (browser's current hostname).
 * Also shows the Tailscale URL if Tailscale is active, with a hint
 * to subscribe to both for seamless local + remote coverage.
 */
async function displayNtfyServerUrl() {
  var localSpan = document.getElementById('ntfy-server-url-local');
  var tsSpan = document.getElementById('ntfy-server-url-ts');
  var tsRow = document.getElementById('ntfy-tailscale-row');
  var hint = document.getElementById('ntfy-both-hint');

  // Local URL — use the hostname the browser is currently connected to
  var localHost = window.location.hostname || 'localhost';
  if (localSpan) localSpan.textContent = 'http://' + localHost + ':2586';

  // Hide Tailscale row and hint by default
  if (tsRow) tsRow.style.display = 'none';
  if (hint) hint.style.display = 'none';

  // Check if Tailscale is active — show its URL too
  try {
    var response = await fetch('/api/network-access/tailscale/status');
    if (response.ok) {
      var data = await response.json();
      if (data.status === 'active' && data.ip) {
        if (tsSpan) tsSpan.textContent = 'http://' + data.ip + ':2586';
        if (tsRow) tsRow.style.display = '';
        if (hint) hint.style.display = '';
      }
    }
  } catch (e) {
    // Tailscale not available — just show local URL
  }
}

/**
 * Copy the text content of an Ntfy display field to the clipboard.
 * Shows a brief ✅ on the button, then restores the 📋 icon.
 * @param {string} elementId - ID of the span to copy from
 * @param {HTMLElement} btn - The button element that was clicked
 */
function copyNtfyField(elementId, btn) {
  var el = document.getElementById(elementId);
  if (!el) return;

  var text = el.textContent;
  if (!text || text === '—') return;

  navigator.clipboard.writeText(text).then(function() {
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = '✅';
      setTimeout(function() { btn.textContent = orig; }, 1200);
    }
  }).catch(function() {
    _ntfyFeedback('Failed to copy to clipboard.', 'error');
  });
}

/**
 * Load the saved Ntfy configuration from the backend and populate
 * the server URL input. Also display the user's topic.
 * GET /api/network-access/ntfy (generic provider endpoint)
 */
async function loadNtfyConfig() {
  displayNtfyTopic();
  await displayNtfyServerUrl();
}
