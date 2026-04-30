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
      user_id: "default_user",
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
  const colorList = document.getElementById("color-list");
  if (!colorList) return;
  colorList.innerHTML = "";
  colors.forEach(({ hex, name }) => {
    const colorItem = document.createElement("div");
    colorItem.className = "color-item";
    colorItem.dataset.color = hex;
    colorItem.dataset.name = name || colorMap[hex] || "Custom";
    colorItem.style.backgroundColor = hex;
    colorItem.title = `${colorItem.dataset.name} (${hex})`;

    // Add delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteColor(hex, name);
    };
    colorItem.appendChild(deleteBtn);

    colorList.appendChild(colorItem);
  });
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

  // Add "+" child-create buttons next to each tag row
  treeContainer.querySelectorAll('[style*="display:flex"]').forEach(row => {
    const badge = row.querySelector('span[style*="border-radius"]');
    if (!badge) return;
    const tagPath = badge.textContent;
    // Find the full path by looking at the tag tree
    const fullPath = _findFullPathForBadge(tree, badge, row);
    if (!fullPath) return;
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

    // Username
    const usernameInput = document.getElementById("username-input");
    if (usernameInput) usernameInput.value = this.settings.username || "";

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

    renderColors(this.settings.custom_colors);

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

    // Habits — success rate window
    var habitsWindowSel = document.getElementById('habits-success-window');
    if (habitsWindowSel) habitsWindowSel.value = this.settings.habits_success_window || '30';
  }

  gatherSettings() {
    return {
      user_id: "default_user",
      username: (document.getElementById("username-input") || {}).value || null,
      time_format: document.getElementById("time-format").value,
      sex: document.getElementById("gender-toggle").value || "Man",
      unit_system: document.getElementById("unit-system-toggle").value || "imperial",
      snooze_length: document.getElementById("snooze-length").value,
      calendar_snap: document.getElementById("calendar-snap").value,
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
      custom_colors: Array.from(document.querySelectorAll(".color-item")).map(
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
      habits_success_window: document.getElementById('habits-success-window')?.value || '30',
    };
  }

  async save() {
    document.getElementById("loader").style.display = "block";
    try {
      const settingsToSave = this.gatherSettings();
      await SettingsService.saveAll(settingsToSave);
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

  // Wire upgrade button and close button for update modal
  document.getElementById('upgrade-btn').addEventListener('click', startUpgrade);
  document.getElementById('upgrade-reopen-btn').addEventListener('click', function() {
    document.getElementById('update-modal').style.display = 'flex';
    document.getElementById('upgrade-reopen-btn').style.display = 'none';
    document.getElementById('upgrade-btn').style.display = '';
  });
});


// Trash view moved to /frontend/html/trash.html



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
