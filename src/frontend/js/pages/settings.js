// ── Settings: Core ────────────────────────────────────────────────────────────
// Locations, clocks, colors, tags, SettingsService, SettingsManager,
// save/cancel, monitorChanges, pill toggles, work config, map settings.
// Other settings modules are loaded before this file via separate script tags.

const timeFormatGrid = document.getElementById("time-format-grid");
const inactiveZone = document.getElementById("inactive-zone");
const clocksContainer = document.getElementById("clocks-container");
const formats = [
  { value: "24hour", label: "24 Hour" },
  { value: "hst", label: "HST" },
  { value: "12hour", label: "12 Hour" },
  { value: "12houranalog", label: "12 Hour Analog" },
];

// Track item pending deletion
var itemToDelete = null;

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

function _collectMapSettings() {
  var cb = document.getElementById('map-auto-zoom');
  var latInput = document.getElementById('map-default-lat');
  var lonInput = document.getElementById('map-default-lon');
  var zoomInput = document.getElementById('map-default-zoom');

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

// ── Work Config & Calendar ───────────────────────────────────────────────────

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

function _initHourDropdownPair(startId, endId, defaultStart, defaultEnd) {
  var startSel = document.getElementById(startId);
  var endSel = document.getElementById(endId);
  if (!startSel || !endSel) return;

  function _pad(n) { return String(n).padStart(2, '0'); }

  startSel.innerHTML = '';
  for (var h = 0; h <= 23; h++) {
    var opt = document.createElement('option');
    opt.value = h;
    opt.textContent = _pad(h) + ':00';
    if (h === defaultStart) opt.selected = true;
    startSel.appendChild(opt);
  }

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

function _syncHourDropdowns(startId, endId) {
  var startSel = document.getElementById(startId);
  var endSel = document.getElementById(endId);
  if (!startSel || !endSel) return;

  var startVal = parseInt(startSel.value);
  var endVal = parseInt(endSel.value);

  Array.from(endSel.options).forEach(function (opt) {
    var v = parseInt(opt.value);
    opt.disabled = v <= startVal;
    opt.style.display = v <= startVal ? 'none' : '';
  });

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

// ── Colors ───────────────────────────────────────────────────────────────────

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
    const colors = (data.custom_colors || []).map((c) =>
      typeof c === "string" ? { hex: c, name: colorMap[c] || "Custom" } : c,
    );
    renderColors(colors);
    return colors;
  } catch (error) {
    console.error("Error loading colors:", error);
    cwocToast("Error loading colors", "error");
    return [];
  }
}

function openColorPicker() {
  const colorInput = document.getElementById("color-picker");
  colorInput.value = "#000000";
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

    _invalidateSettingsCache();
  } catch (error) {
    console.error("Failed to save colors:", error);
    cwocToast("Failed to save colors", "error");
    throw error;
  }
}

async function addColor(newColor) {
  try {
    const colors = await loadColors();
    colors.push(newColor);
    await saveColors(colors);
    renderColors(colors);
  } catch (error) {
    console.error("Add color error:", error);
    cwocToast("Failed to add color", "error");
  }
}

async function deleteColor(hex, name) {
  var modal = document.getElementById('delete-modal');
  if (!modal) { if (!(await cwocConfirm('Delete color (' + name + ' - ' + hex + ')?', { title: 'Delete Color', confirmLabel: '🗑️ Delete', danger: true }))) return; }
  else {
    var msg = modal.querySelector('p');
    if (msg) msg.textContent = 'Delete color ' + (name || 'Custom') + ' (' + hex + ')?';
    modal.style.display = 'flex';
    var confirmed = await new Promise(function (resolve) {
      var confirmBtn = modal.querySelector('button[onclick="confirmDelete()"]');
      var cancelBtn = modal.querySelector('button[onclick="closeDeleteModal()"]');
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
    cwocToast("Failed to delete color", "error");
  }
}

function renderColors(colors) {
  var defaultColorList = document.getElementById("default-color-list");
  if (defaultColorList) {
    defaultColorList.innerHTML = "";
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
      colorItem.addEventListener("click", function(e) { _openBorderAssignPopup(e, c.hex); });
      defaultColorList.appendChild(colorItem);
    });
  }

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

      var deleteBtn = document.createElement("button");
      deleteBtn.textContent = "✕";
      deleteBtn.onclick = function(e) {
        e.stopPropagation();
        deleteColor(hex, name);
      };
      colorItem.appendChild(deleteBtn);
      colorItem.addEventListener("click", function(e) { _openBorderAssignPopup(e, hex); });
      colorList.appendChild(colorItem);
    });
  }

  _applyBorderColorRings();
}

/** Track current border color values (loaded from settings) */
var _borderColorOverdue = '#b22222';
var _borderColorBlocked = '#DAA520';

function _applyBorderColorRings() {
  var overdueEnabled = document.getElementById('highlight-overdue')?.checked ?? true;
  var blockedEnabled = document.getElementById('highlight-blocked')?.checked ?? true;
  var overdueHex = (_borderColorOverdue || '#b22222').toLowerCase();
  var blockedHex = (_borderColorBlocked || '#DAA520').toLowerCase();

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

  document.querySelectorAll('#default-color-list .color-item, #color-list .color-item').forEach(function(el) {
    el.classList.remove('ring-overdue', 'ring-blocked', 'ring-both');
    var lbl = el.querySelector('.ring-label');
    if (lbl) lbl.remove();
  });

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

  var overdueBtn = document.getElementById('assign-overdue-btn');
  var blockedBtn = document.getElementById('assign-blocked-btn');
  if (overdueBtn) overdueBtn.style.display = overdueEnabled ? '' : 'none';
  if (blockedBtn) blockedBtn.style.display = blockedEnabled ? '' : 'none';
}

function _onHighlightToggle() {
  _applyBorderColorRings();
  if (typeof setSaveButtonUnsaved === 'function') setSaveButtonUnsaved();
}

function _openBorderAssignPopup(e, hex) {
  e.stopPropagation();
  var popup = document.getElementById('border-assign-popup');
  if (!popup) return;

  var rect = e.currentTarget.getBoundingClientRect();
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.display = 'block';

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

// ── Tags ─────────────────────────────────────────────────────────────────────

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
      if (isReservedTagPrefix(tagText)) {
        const modal = document.getElementById("reserved-tag-modal");
        if (modal) { modal.style.display = "flex"; setTimeout(() => { modal.style.display = "none"; }, 2000); }
        return;
      }
      input.value = "";
      cwocTagModal.open(null, {
        prefillName: tagText,
        onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
      });
    }
  } else if (event.key === "Enter") {
    addTag();
  }
}

function handleInfoClick(event) {
  const input = document.getElementById("new-tag");
  const tagText = input.value.trim();
  if (event.shiftKey && tagText) {
    if (isReservedTagPrefix(tagText)) {
      const modal = document.getElementById("reserved-tag-modal");
      if (modal) { modal.style.display = "flex"; setTimeout(() => { modal.style.display = "none"; }, 2000); }
      return;
    }
    input.value = "";
    cwocTagModal.open(null, {
      prefillName: tagText,
      onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
    });
  }
}

function addTag() {
  const input = document.getElementById("new-tag");
  const tagText = input.value.trim();
  if (!tagText) return;
  if (isReservedTagPrefix(tagText)) {
    const modal = document.getElementById("reserved-tag-modal");
    if (modal) { modal.style.display = "flex"; setTimeout(() => { modal.style.display = "none"; }, 2000); }
    return;
  }
  input.value = "";
  cwocTagModal.open(null, {
    prefillName: tagText,
    onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
  });
}

let currentTag = null;

function openTagModal(tag) {
  var tagName = (tag && tag.childNodes && tag.childNodes[0]) ? tag.childNodes[0].textContent.trim() : '';
  if (tagName) {
    cwocTagModal.open(tagName, {
      onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
      onDelete: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
    });
  }
}

async function _renderSettingsTagTree() {
  const treeContainer = document.getElementById('settings-tag-tree');
  if (!treeContainer) return;

  _invalidateSettingsCache();
  var tags = [];
  try { tags = await loadAllTags(); } catch (e) { tags = []; }

  _syncHiddenTagEditor(tags);

  if (tags.length === 0) {
    treeContainer.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">No tags. Use Add Tag above.</div>';
    return;
  }

  const tree = buildTagTree(tags);
  renderTagTree(treeContainer, tree, [], (fullPath, isNowSelected) => {
    cwocTagModal.open(fullPath, {
      onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
      onDelete: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
    });
  });

  treeContainer.querySelectorAll('[data-tag-row]').forEach(row => {
    var fullPath = row.dataset.tagRow;
    if (!fullPath) return;

    if (_tagHasSharing(fullPath)) {
      var linkIcon = document.createElement('span');
      linkIcon.className = 'tag-sharing-link-icon';
      linkIcon.textContent = '🔗';
      var sharedUsers = _getTagShares(fullPath);
      var userNames = sharedUsers.map(function(s) { return _getTagSharingUserName(s.user_id); });
      linkIcon.title = 'Shared with: ' + userNames.join(', ');
      row.appendChild(linkIcon);
    }

    const addBtn = document.createElement('span');
    addBtn.textContent = '+';
    addBtn.title = 'Create child tag under "' + fullPath + '"';
    addBtn.style.cssText = 'font-size:0.75em;cursor:pointer;padding:0 4px;border-radius:3px;background:#8b5a2b;color:#fdf5e6;margin-left:4px;flex-shrink:0;line-height:1.4;';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.getElementById('new-tag');
      if (input) { input.value = fullPath + '/'; input.focus(); }
    });
    row.appendChild(addBtn);
  });
}

function _syncHiddenTagEditor(tags) {
  const tagEditor = document.getElementById("tag-editor-hidden");
  if (!tagEditor) return;
  tagEditor.querySelectorAll('.tag:not(.tag-input-container .tag)').forEach(function(t) { t.remove(); });
  (tags || []).forEach(function(tag) {
    var tagDiv = document.createElement("div");
    tagDiv.className = "tag";
    tagDiv.dataset.color = tag.color || "#d4c4b0";
    tagDiv.dataset.fontColor = tag.fontColor || "#5c3317";
    tagDiv.dataset.favorite = tag.favorite ? 'true' : 'false';
    tagDiv.style.backgroundColor = tag.color || "#d4c4b0";
    tagDiv.style.color = tag.fontColor || "#5c3317";
    tagDiv.innerHTML = tag.name + ' <button onclick="openDeleteModal(event, this.parentElement)">✕</button>';
    tagDiv.onclick = function(e) {
      if (e.target !== this && e.target.tagName === 'BUTTON') return;
      openTagModal(this);
    };
    tagEditor.appendChild(tagDiv);
  });
}

function closeTagModal() {
  if (typeof cwocTagModal !== 'undefined' && cwocTagModal.isOpen()) {
    cwocTagModal.close();
  }
  var oldModal = document.getElementById("tag-modal");
  if (oldModal) oldModal.style.display = "none";
}

function toggleTagFavorite() {}
function saveTag() { if (typeof cwocTagModal !== 'undefined' && cwocTagModal.isOpen()) cwocTagModal.close(); }
function deleteTag() { if (typeof cwocTagModal !== 'undefined' && cwocTagModal.isOpen()) cwocTagModal.close(); }

function openDeleteModal(event, item) {
  event.stopPropagation();
  itemToDelete = item;
  document.getElementById("delete-modal").style.display = "flex";
}

function closeDuplicateTagModal() {
  const modal = document.getElementById("duplicate-tag-modal");
  modal.style.display = "none";
}

// ── Save/Cancel/ESC ──────────────────────────────────────────────────────────

function saveSettings() {
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
  if (window.settingsManager) {
    window.settingsManager.save();
  }
}

function cancelSettings() {
  if (window._cwocSave) window._cwocSave.cancelOrExit();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    var arrangeViewsModal = document.getElementById("arrange-views-modal");
    if (arrangeViewsModal && arrangeViewsModal.style.display === "flex") {
      event.preventDefault(); event.stopPropagation(); _cancelArrangeViews(); return;
    }
    var updateModal = document.getElementById("update-modal");
    if (updateModal && updateModal.style.display === "flex") {
      event.preventDefault(); event.stopPropagation(); if (typeof _closeUpdateModal === 'function') _closeUpdateModal(); return;
    }
    var releaseNotesModal = document.getElementById("release-notes-modal");
    if (releaseNotesModal && releaseNotesModal.style.display === "flex") {
      event.preventDefault(); event.stopPropagation(); closeReleaseNotesModal(); return;
    }
    var emailAccountsModal = document.getElementById("email-accounts-modal");
    if (emailAccountsModal && emailAccountsModal.style.display === "flex") {
      event.preventDefault(); event.stopPropagation();
      var deleteEmailModal = document.getElementById("deleteEmailAccountModal");
      if (deleteEmailModal && deleteEmailModal.style.display === "flex") { deleteEmailModal.style.display = "none"; return; }
      var editView = document.getElementById("emailModalEditView");
      if (editView && editView.style.display !== "none") { _emailModalBackToList(); } else { closeEmailAccountsModal(); }
      return;
    }
    var qrOverlay = document.getElementById("cwoc-qr-overlay");
    if (qrOverlay) { qrOverlay.remove(); return; }
    if (cwocTagModal.isOpen()) { cwocTagModal.close(); return; }
    if (document.getElementById("tag-modal") && document.getElementById("tag-modal").style.display === "flex") { closeTagModal(); return; }
    if (document.getElementById("delete-modal").style.display === "flex") { closeDeleteModal(); return; }
    if (document.getElementById("duplicate-tag-modal").style.display === "flex") { closeDuplicateTagModal(); return; }
    var unsavedModal = document.getElementById("cwoc-unsaved-modal");
    if (unsavedModal) { unsavedModal.remove(); return; }
    if (document.activeElement && document.activeElement.tagName && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) { document.activeElement.blur(); return; }
    cancelSettings();
  } else if (event.key === "Enter") {
    if (cwocTagModal.isOpen()) {
    } else if (document.getElementById("delete-modal").style.display === "flex") {
      confirmDelete();
    } else if (document.getElementById("duplicate-tag-modal").style.display === "flex") {
      closeDuplicateTagModal();
    }
  }
});

document.getElementById("duplicate-tag-modal").addEventListener("click", closeDuplicateTagModal);

updateGrid();

// ── Pill toggle helper ────────────────────────────────────────────────────────
function _initPillToggle(pillId, hiddenInputId) {
  var pill = document.getElementById(pillId);
  if (!pill) return;
  pill.addEventListener('click', function() {
    var hidden = document.getElementById(hiddenInputId);
    var spans = pill.querySelectorAll('span[data-val]');
    if (!hidden || spans.length < 2) return;
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
  pill.querySelectorAll('span[data-val]').forEach(function(span) {
    span.classList.toggle('active', span.dataset.val === activeVal);
  });
}

_initPillToggle('sex-pill', 'gender-toggle');
_initPillToggle('unit-pill', 'unit-system-toggle');

// ── SettingsService & SettingsManager ─────────────────────────────────────────

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
      _invalidateSettingsCache();
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
      cwocToast('Failed to load settings: ' + error.message, 'error');
    }
  }

  updateForm() {
    const timeFormat = document.getElementById("time-format");
    timeFormat.value = this.settings.time_format || "24hour";

    const auditMaxDaysInput = document.getElementById("audit-max-days");
    if (auditMaxDaysInput) auditMaxDaysInput.value = (this.settings.audit_log_max_days != null && this.settings.audit_log_max_days !== '') ? this.settings.audit_log_max_days : '';
    const auditMaxMbInput = document.getElementById("audit-max-mb");
    if (auditMaxMbInput) auditMaxMbInput.value = (this.settings.audit_log_max_mb != null && this.settings.audit_log_max_mb !== '') ? this.settings.audit_log_max_mb : '';

    const auditPruneCb = document.getElementById("audit-prune-enabled");
    if (auditPruneCb) {
      const explicitlyDisabled = this.settings.hasOwnProperty('audit_log_max_days') &&
                                  this.settings.hasOwnProperty('audit_log_max_mb') &&
                                  (this.settings.audit_log_max_days == null || this.settings.audit_log_max_days === '') &&
                                  (this.settings.audit_log_max_mb == null || this.settings.audit_log_max_mb === '');
      auditPruneCb.checked = !explicitlyDisabled;
      if (auditPruneCb.checked) {
        if (auditMaxDaysInput && !auditMaxDaysInput.value) auditMaxDaysInput.value = '1096';
        if (auditMaxMbInput && !auditMaxMbInput.value) auditMaxMbInput.value = '1';
      }
      toggleAuditPruneInputs();
    }

    const co = this.settings.chit_options || {};
    document.getElementById("fade-past").checked = co.fade_past_chits !== false;
    document.getElementById("highlight-overdue").checked = co.highlight_overdue_chits !== false;
    document.getElementById("highlight-blocked").checked = co.highlight_blocked_chits !== false;
    document.getElementById("delete-past").checked = !!co.delete_past_alarm_chits;
    document.getElementById("show-tab-counts").checked = !!co.show_tab_counts;
    document.getElementById("prefer-google-maps").checked = !!co.prefer_google_maps;

    var clAutoEl = document.getElementById("checklist-autosave-toggle");
    if (clAutoEl) clAutoEl.checked = this.settings.checklist_autosave !== '0';

    var emailPaginateEl = document.getElementById("emailPaginate");
    if (emailPaginateEl) emailPaginateEl.checked = this.settings.paginate_email === '1';

    const genderToggle = document.getElementById("gender-toggle");
    if (genderToggle) genderToggle.value = this.settings.sex || "Man";
    _updatePillToggle('sex-pill', this.settings.sex || 'Man');

    const unitToggle = document.getElementById("unit-system-toggle");
    if (unitToggle) unitToggle.value = this.settings.unit_system || "imperial";
    _updatePillToggle('unit-pill', this.settings.unit_system || 'imperial');

    document.getElementById("snooze-length").value = this.settings.snooze_length || "5 minutes";
    document.getElementById("calendar-snap").value = this.settings.calendar_snap || "15";

    var hideDeclinedCb = document.getElementById("hide-declined-toggle");
    if (hideDeclinedCb) hideDeclinedCb.checked = (this.settings.hide_declined === "1");

    const weekStartSel = document.getElementById("week-start-day");
    if (weekStartSel) weekStartSel.value = this.settings.week_start_day || "0";

    const workDays = (this.settings.work_days || "1,2,3,4,5").split(',');
    document.querySelectorAll('.work-day-cb').forEach(cb => { cb.checked = workDays.includes(cb.value); });

    const enabledPeriods = (this.settings.enabled_periods || "Itinerary,Day,Week,Work,SevenDay,Month,Year").split(',');
    document.querySelectorAll('.period-cb').forEach(cb => { cb.checked = enabledPeriods.includes(cb.value); });

    const customDaysInput = document.getElementById("custom-days-count");
    if (customDaysInput) customDaysInput.value = this.settings.custom_days_count || "7";

    var avStart = parseInt(this.settings.all_view_start_hour) || 0;
    var avEnd = parseInt(this.settings.all_view_end_hour) || 24;
    _initHourDropdownPair('all-view-start-hour', 'all-view-end-hour', avStart, avEnd);

    var scrollToSel = document.getElementById("day-scroll-to-hour");
    if (scrollToSel) scrollToSel.value = this.settings.day_scroll_to_hour || "5";

    var wStart = parseInt(this.settings.work_start_hour) || 8;
    var wEnd = parseInt(this.settings.work_end_hour) || 17;
    _initHourDropdownPair('work-start-hour', 'work-end-hour', wStart, wEnd);

    _toggleWorkConfig();
    _toggleXDaysConfig();

    const filterInputs = ["calendar", "checklists", "alarms", "projects", "tasks", "indicators", "notes"];
    filterInputs.forEach((key) => {
      const input = document.getElementById(`filter-${key}`);
      const filters = this.settings.default_filters || {};
      if (Array.isArray(filters)) {
        input.value = filters.includes(key.charAt(0).toUpperCase() + key.slice(1)) ? `#${key}` : "";
      } else {
        input.value = filters[key] || "";
      }
      processTagsInInput(input);
    });

    if (this.settings.alarm_orientation) {
      clocksContainer.classList.toggle("vertical", this.settings.alarm_orientation === "Vertical");
      timeFormatGrid.classList.toggle("vertical", this.settings.alarm_orientation === "Vertical");
    }

    if (this.settings.active_clocks) {
      let savedClocks = typeof this.settings.active_clocks === 'string'
        ? JSON.parse(this.settings.active_clocks)
        : this.settings.active_clocks;
      if (Array.isArray(savedClocks)) {
        const migrateMap = { metric: 'hst', metricbar: 'hst', hstbar: 'hst' };
        savedClocks = savedClocks.map(v => migrateMap[v] || v);
        savedClocks = [...new Set(savedClocks)];

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
    tagEditor.querySelectorAll(".tag:not(.tag-input-container .tag)").forEach((tag) => tag.remove());
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

    _renderSettingsTagTree();

    const savedLocations = Array.isArray(this.settings.saved_locations) ? this.settings.saved_locations : [];
    renderLocationsSection(savedLocations);

    _borderColorOverdue = this.settings.overdue_border_color || '#b22222';
    _borderColorBlocked = this.settings.blocked_border_color || '#DAA520';

    renderColors(this.settings.custom_colors);
    _applyBorderColorRings();

    const vi = this.settings.visual_indicators || {};
    document.querySelector("select[name='alarm_indicator']").value = vi.alarm || "always";
    document.querySelector("select[name='notification_indicator']").value = vi.notification || "always";
    document.querySelector("select[name='weather_indicator']").value = vi.weather || "always";
    document.querySelector("select[name='people_indicator']").value = vi.people || "always";
    document.querySelector("select[name='indicators_indicator']").value = vi.indicators || "always";
    document.querySelector("select[name='timer_indicator']").value = vi.timer || "always";
    document.querySelector("select[name='stopwatch_indicator']").value = vi.stopwatch || "always";
    document.querySelector("select[name='combined_alert_indicator']").value = vi.combined_alert || "always";

    var combineAlertsCb = document.getElementById('combine-alerts-toggle');
    if (combineAlertsCb) {
      combineAlertsCb.checked = !!vi.combine_alerts;
      var individualRows = document.getElementById('individual-alert-rows');
      var combinedRow = document.getElementById('combined-alert-row');
      if (individualRows) individualRows.style.display = vi.combine_alerts ? 'none' : '';
      if (combinedRow) combinedRow.style.display = vi.combine_alerts ? '' : 'none';
    }

    var dn = this.settings.default_notifications || {};
    _renderDefaultNotifList('start', dn.start || []);
    _renderDefaultNotifList('due', dn.due || []);

    var habitsWindowSel = document.getElementById('habits-success-window');
    if (habitsWindowSel) habitsWindowSel.value = this.settings.habits_success_window || '30';
    var defaultShowHabitsCb = document.getElementById('default-show-habits-on-calendar');
    if (defaultShowHabitsCb) defaultShowHabitsCb.checked = (this.settings.default_show_habits_on_calendar !== '0');

    // Projects settings
    var projChildCountCb = document.getElementById('projects-show-child-count');
    if (projChildCountCb) projChildCountCb.checked = (this.settings.projects_show_child_count === '1');
    var projChecklistCountCb = document.getElementById('projects-show-checklist-count');
    if (projChecklistCountCb) projChecklistCountCb.checked = (this.settings.projects_show_checklist_count === '1');

    _loadMapSettings(this.settings);
    _loadEmailAccountSettings(this.settings);
    _updateSignatureInlinePreview();

    var defaultShareContactsCb = document.getElementById('default-share-contacts');
    if (defaultShareContactsCb) defaultShareContactsCb.checked = (this.settings.default_share_contacts === '1');

    var attachSizeEl = document.getElementById('attachmentMaxSizeMb');
    if (attachSizeEl && this.settings.attachment_max_size_mb) attachSizeEl.value = this.settings.attachment_max_size_mb;
    var attachStorageEl = document.getElementById('attachmentMaxStorageMb');
    if (attachStorageEl && this.settings.attachment_max_storage_mb) attachStorageEl.value = this.settings.attachment_max_storage_mb;

    if (this.settings.view_order) {
      var savedOrder = this.settings.view_order;
      if (typeof savedOrder === 'string') {
        try { savedOrder = JSON.parse(savedOrder); } catch (e) { savedOrder = null; }
      }
      if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        _currentViewOrder = savedOrder.slice();
        _hiddenViews = _defaultViewOrder.filter(function(v) {
          return savedOrder.indexOf(v) === -1;
        });
      }
    }
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
      alarm_orientation: clocksContainer.classList.contains("vertical") ? "Vertical" : "Horizontal",
      active_clocks: JSON.stringify(Array.from(timeFormatGrid.querySelectorAll(".format-item")).map(item => item.dataset.value)),
      tags: Array.from(document.querySelectorAll("#tag-editor-hidden .tag:not(.tag-input-container .tag)")).map((tag) => ({
        name: (tag.childNodes[0]?.textContent || "").trim(),
        color: tag.dataset.color || "#d4c4b0",
        fontColor: tag.dataset.fontColor || "#5c3317",
        favorite: tag.dataset.favorite === 'true',
      })).filter((t) => t.name),
      custom_colors: Array.from(document.querySelectorAll("#color-list .color-item")).map((item) => ({
        hex: item.dataset.color,
        name: item.dataset.name || colorMap[item.dataset.color] || "Custom",
      })),
      visual_indicators: {
        alarm: document.querySelector("select[name='alarm_indicator']").value,
        notification: document.querySelector("select[name='notification_indicator']").value,
        timer: document.querySelector("select[name='timer_indicator']").value,
        stopwatch: document.querySelector("select[name='stopwatch_indicator']").value,
        weather: document.querySelector("select[name='weather_indicator']").value,
        people: document.querySelector("select[name='people_indicator']").value,
        indicators: document.querySelector("select[name='indicators_indicator']").value,
        combine_alerts: document.getElementById("combine-alerts-toggle").checked,
        combined_alert: document.querySelector("select[name='combined_alert_indicator']").value,
      },
      chit_options: {
        fade_past_chits: document.getElementById("fade-past").checked,
        highlight_overdue_chits: document.getElementById("highlight-overdue").checked,
        highlight_blocked_chits: document.getElementById("highlight-blocked").checked,
        delete_past_alarm_chits: document.getElementById("delete-past").checked,
        show_tab_counts: document.getElementById("show-tab-counts").checked,
        prefer_google_maps: document.getElementById("prefer-google-maps").checked,
      },
      checklist_autosave: document.getElementById("checklist-autosave-toggle")?.checked ? '1' : '0',
      paginate_email: document.getElementById("emailPaginate")?.checked ? '1' : '0',
      saved_locations: JSON.stringify(collectLocationsData()),
      audit_log_max_days: (() => { const cb = document.getElementById("audit-prune-enabled"); if (cb && !cb.checked) return null; const v = (document.getElementById("audit-max-days") || {}).value; return v === '' ? null : parseInt(v, 10); })(),
      audit_log_max_mb: (() => { const cb = document.getElementById("audit-prune-enabled"); if (cb && !cb.checked) return null; const v = (document.getElementById("audit-max-mb") || {}).value; return v === '' ? null : parseInt(v, 10); })(),
      default_notifications: {
        start: _gatherDefaultNotifList('start'),
        due: _gatherDefaultNotifList('due'),
      },
      habits_success_window: (document.getElementById('habits-success-window') || {}).value || '30',
      default_show_habits_on_calendar: (document.getElementById('default-show-habits-on-calendar') && document.getElementById('default-show-habits-on-calendar').checked) ? '1' : '0',
      projects_show_child_count: (document.getElementById('projects-show-child-count') && document.getElementById('projects-show-child-count').checked) ? '1' : '0',
      projects_show_checklist_count: (document.getElementById('projects-show-checklist-count') && document.getElementById('projects-show-checklist-count').checked) ? '1' : '0',
      overdue_border_color: _borderColorOverdue || '#b22222',
      blocked_border_color: _borderColorBlocked || '#DAA520',
      kiosk_users: _gatherKioskTags(),
      ..._collectMapSettings(),
      email_account: (function() { var a = _collectEmailAccountSettings(); return a ? JSON.stringify(a) : null; })(),
      email_accounts: (function() { var a = _collectEmailAccountsSettings(); return a.length > 0 ? JSON.stringify(a) : null; })(),
      attachment_max_size_mb: ((document.getElementById('attachmentMaxSizeMb') || {}).value || '10'),
      attachment_max_storage_mb: ((document.getElementById('attachmentMaxStorageMb') || {}).value || '500'),
      default_share_contacts: (document.getElementById('default-share-contacts') && document.getElementById('default-share-contacts').checked) ? '1' : '0',
      view_order: _collectViewOrder(),
    };
  }

  async save() {
    document.getElementById("loader").style.display = "block";
    try {
      const settingsToSave = this.gatherSettings();
      await SettingsService.saveAll(settingsToSave);

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
      cwocToast('Failed to save settings: ' + error.message, 'error');
      document.getElementById("loader").style.display = "none";
      return false;
    }
  }

  setupEventListeners() {}
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
      observer.observe(el, { childList: true, subtree: true });
    }
  });
}

// ── DOMContentLoaded Init ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
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

  _loadTagSharingData();

  if (typeof waitForAuth === 'function') {
    waitForAuth().then(function() {
      var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      if (user && user.is_admin) {
        _loadLoginMessage();
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

  document.getElementById('upgrade-btn').addEventListener('click', startUpgrade);
  document.getElementById('upgrade-reopen-btn').addEventListener('click', function() {
    document.getElementById('update-modal').style.display = 'flex';
    document.getElementById('upgrade-reopen-btn').style.display = 'none';
    document.getElementById('upgrade-btn').style.display = '';
  });

  // Handle hash-based deep linking (e.g. #email scrolls to email section)
  if (window.location.hash) {
    setTimeout(function() {
      var hash = window.location.hash.substring(1).toLowerCase();
      // Map common hash names to heading text
      var headingMap = { 'email': '✉️ Email', 'notifications': '🔔 Notifications', 'calendar': '📅 Calendar' };
      var target = headingMap[hash];
      if (target) {
        var headings = document.querySelectorAll('h3');
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].textContent.trim() === target) {
            headings[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Flash highlight
            headings[i].style.transition = 'background 0.3s';
            headings[i].style.background = 'rgba(212, 175, 55, 0.3)';
            setTimeout(function() { headings[i].style.background = ''; }, 2000);
            break;
          }
        }
      }
    }, 500);
  }
});
