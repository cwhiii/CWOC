// ── Settings: Core ────────────────────────────────────────────────────────────
// Locations, clocks, colors, tags, SettingsService, SettingsManager,
// save/cancel, monitorChanges, pill toggles, work config, map settings.
// Other settings modules are loaded before this file via separate script tags.

// ── Settings Tab Switching ───────────────────────────────────────────────────

var _settingsActiveTab = 'general';
var _SETTINGS_TAB_KEY = 'cwoc_settings_active_tab';

function _switchSettingsTab(tabId) {
  // Update active tab button
  var buttons = document.querySelectorAll('.settings-tab-bar button');
  buttons.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Show/hide tab content
  var tabs = document.querySelectorAll('.settings-tab-content');
  tabs.forEach(function(tab) {
    tab.classList.toggle('active', tab.id === 'tab-' + tabId);
  });

  _settingsActiveTab = tabId;
  try { localStorage.setItem(_SETTINGS_TAB_KEY, tabId); } catch (e) { /* ignore */ }
}

// Restore last active tab on load
(function() {
  try {
    var saved = localStorage.getItem(_SETTINGS_TAB_KEY);
    if (saved && document.getElementById('tab-' + saved)) {
      // Don't restore admin tab if button is hidden (non-admin user)
      if (saved === 'admin') {
        // Will be restored after auth check if user is admin
        return;
      }
      _switchSettingsTab(saved);
    }
  } catch (e) { /* ignore */ }
})();

// ──────────────────────────────────────────────────────────────────────────────

const timeFormatGrid = document.getElementById("time-format-grid");
const inactiveZone = document.getElementById("inactive-zone");
const clocksContainer = document.getElementById("clocks-container");
const formats = [
  { value: "24hour", label: "24 Hour" },
  { value: "hst", label: "HST" },
  { value: "12hour", label: "12 Hour" },
  { value: "12houranalog", label: "12 Hour Analog" },
];

// (itemToDelete removed — delete-modal migrated to cwocConfirm)

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
  if (!container) return undefined; // Container missing — don't overwrite
  const rows = container.querySelectorAll(".location-row");
  if (rows.length === 0) {
    // No rows rendered at all — DOM wasn't populated, preserve server data
    if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.saved_locations) {
      var orig = window.settingsManager.settings.saved_locations;
      if (Array.isArray(orig) && orig.length > 0) {
        return orig;
      }
    }
    return undefined; // Signal to skip this field
  }
  const all = [];
  rows.forEach(row => {
    const label = row.querySelector(".location-label-input")?.value?.trim() || "";
    const address = row.querySelector(".location-address-input")?.value?.trim() || "";
    const isDefault = row.querySelector('input[type="radio"]')?.checked || false;
    all.push({ label, address, is_default: isDefault });
  });
  const nonEmpty = all.filter(loc => loc.address !== "");
  if (nonEmpty.length === 0) {
    // All rows are empty — user intentionally cleared them
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

/* ═══════════════════════════════════════════════════════════════════════════
   Omni View Layout Configurator
   ═══════════════════════════════════════════════════════════════════════════ */

var _omniLayoutAreas = [
  { id: 'hst', label: '📊 HST Bar', width: 'full', visible: true, column: null, hideWhenEmpty: true },
  { id: 'weather', label: '🌤️ Weather Bar', width: 'full', visible: true, column: null, hideWhenEmpty: true },
  { id: 'hst_weather', label: '📊🌤️ HST + Weather', width: 'full', visible: false, column: null, hideWhenEmpty: true },
  { id: 'hst_temp_strip', label: '📊🌡️ HST Weather Strip', width: 'full', visible: false, column: null, hideWhenEmpty: true },
  { id: 'chrono', label: '⏰ Chrono Anchored', width: 'half', visible: true, column: 'left', hideWhenEmpty: true },
  { id: 'reminders', label: '📢 Reminders', width: 'half', visible: true, column: 'left', hideWhenEmpty: true },
  { id: 'ondeck', label: '🔜 On Deck', width: 'half', visible: true, column: 'left', hideWhenEmpty: true },
  { id: 'soon', label: '🗓️ Soon', width: 'half', visible: true, column: 'left', hideWhenEmpty: true },
  { id: 'email', label: '📧 Email', width: 'half', visible: true, column: 'left', hideWhenEmpty: true },
  { id: 'pinned_notes', label: '📝 Pinned Notes', width: 'half', visible: true, column: 'right', hideWhenEmpty: true },
  { id: 'pinned_checklists', label: '☑️ Pinned Checklists', width: 'half', visible: true, column: 'right', hideWhenEmpty: true },
  { id: 'pinned_all', label: '📌 Pinned (Notes + Checklists)', width: 'half', visible: false, column: 'right', hideWhenEmpty: true }
];

var _omniLayoutState = null;

function _getDefaultOmniLayout() {
  return _omniLayoutAreas.map(function(area, i) {
    return { id: area.id, label: area.label, width: area.width, visible: area.visible, position: i, column: area.column, hideWhenEmpty: area.hideWhenEmpty !== false };
  });
}

function _openOmniLayoutModal() {
  var modal = document.getElementById('omni-layout-modal');
  if (modal) {
    modal.style.display = 'flex';
    _renderOmniLayoutGrid();
  }
}

function _closeOmniLayoutModal() {
  var modal = document.getElementById('omni-layout-modal');
  if (modal) modal.style.display = 'none';
}

function _renderOmniLayoutGrid() {
  var container = document.getElementById('omni-layout-grid');
  if (!container) return;
  container.innerHTML = '';

  if (!_omniLayoutState) {
    _omniLayoutState = _getDefaultOmniLayout();
  }

  var sorted = _omniLayoutState.slice().sort(function(a, b) { return a.position - b.position; });
  var activeAreas = sorted.filter(function(a) { return a.visible !== false; });
  var inactiveAreas = sorted.filter(function(a) { return a.visible === false; });

  // Split active into full-width (top), left column, right column
  var fullAreas = activeAreas.filter(function(a) { return a.width === 'full'; });
  var leftAreas = activeAreas.filter(function(a) { return a.width === 'half' && a.column === 'left'; });
  var rightAreas = activeAreas.filter(function(a) { return a.width === 'half' && a.column === 'right'; });

  // ── Full Width zone (top) ─────────────────────────────────────────────────
  var fullLabel = document.createElement('div');
  fullLabel.className = 'omni-layout-col-label';
  fullLabel.textContent = 'Full Width (top)';
  container.appendChild(fullLabel);

  var fullList = document.createElement('div');
  fullList.className = 'omni-layout-col-list';
  fullList.dataset.zone = 'full';
  if (fullAreas.length === 0) {
    fullList.innerHTML = '<span class="omni-layout-empty-hint">Drop sections here for full width</span>';
  } else {
    fullAreas.forEach(function(area) { fullList.appendChild(_buildOmniLayoutCard(area)); });
  }
  container.appendChild(fullList);

  // ── Two-column row (Left + Right) ─────────────────────────────────────────
  var columnsRow = document.createElement('div');
  columnsRow.className = 'omni-layout-columns-row';

  // Left column
  var leftWrapper = document.createElement('div');
  leftWrapper.className = 'omni-layout-column-wrapper';
  var leftLabel = document.createElement('div');
  leftLabel.className = 'omni-layout-col-label';
  leftLabel.textContent = 'Left Column';
  leftWrapper.appendChild(leftLabel);
  var leftList = document.createElement('div');
  leftList.className = 'omni-layout-col-list';
  leftList.dataset.zone = 'left';
  if (leftAreas.length === 0) {
    leftList.innerHTML = '<span class="omni-layout-empty-hint">Drop here</span>';
  } else {
    leftAreas.forEach(function(area) { leftList.appendChild(_buildOmniLayoutCard(area)); });
  }
  leftWrapper.appendChild(leftList);
  columnsRow.appendChild(leftWrapper);

  // Right column
  var rightWrapper = document.createElement('div');
  rightWrapper.className = 'omni-layout-column-wrapper';
  var rightLabel = document.createElement('div');
  rightLabel.className = 'omni-layout-col-label';
  rightLabel.textContent = 'Right Column';
  rightWrapper.appendChild(rightLabel);
  var rightList = document.createElement('div');
  rightList.className = 'omni-layout-col-list';
  rightList.dataset.zone = 'right';
  if (rightAreas.length === 0) {
    rightList.innerHTML = '<span class="omni-layout-empty-hint">Drop here</span>';
  } else {
    rightAreas.forEach(function(area) { rightList.appendChild(_buildOmniLayoutCard(area)); });
  }
  rightWrapper.appendChild(rightList);
  columnsRow.appendChild(rightWrapper);

  container.appendChild(columnsRow);

  // ── Unused zone ───────────────────────────────────────────────────────────
  var unusedLabel = document.createElement('div');
  unusedLabel.className = 'omni-layout-unused-label';
  unusedLabel.textContent = 'Unused';
  container.appendChild(unusedLabel);

  var unusedZone = document.createElement('div');
  unusedZone.className = 'omni-layout-unused-zone';
  unusedZone.dataset.zone = 'unused';
  if (inactiveAreas.length === 0) {
    unusedZone.innerHTML = '<span class="omni-layout-empty-hint">Drag sections here to hide them</span>';
  } else {
    inactiveAreas.forEach(function(area) { unusedZone.appendChild(_buildOmniLayoutCard(area)); });
  }
  container.appendChild(unusedZone);

  _setupOmniDragListeners();
}

function _buildOmniLayoutCard(area) {
  var card = document.createElement('div');
  card.className = 'omni-layout-card' + (area.visible ? '' : ' hidden-area');
  card.draggable = true;
  card.dataset.areaId = area.id;

  var handle = document.createElement('span');
  handle.className = 'omni-drag-handle';
  handle.textContent = '☰';

  var label = document.createElement('span');
  label.className = 'omni-card-label';
  label.textContent = area.label;

  var controls = document.createElement('span');
  controls.className = 'omni-card-controls';

  // Hide-when-empty toggle (eye icon)
  var hideBtn = document.createElement('button');
  hideBtn.className = 'omni-hide-toggle' + (area.hideWhenEmpty !== false ? ' hide-active' : '');
  hideBtn.title = area.hideWhenEmpty !== false ? 'Hidden when empty (click to always show)' : 'Always visible (click to hide when empty)';
  hideBtn.innerHTML = area.hideWhenEmpty !== false ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  hideBtn.onclick = function(e) {
    e.stopPropagation();
    area.hideWhenEmpty = !area.hideWhenEmpty;
    _renderOmniLayoutGrid();
    setSaveButtonUnsaved();
  };
  controls.appendChild(hideBtn);

  card.appendChild(handle);
  card.appendChild(label);
  card.appendChild(controls);
  return card;
}

function _setupOmniDragListeners() {
  var container = document.getElementById('omni-layout-grid');
  if (!container) return;

  var allLists = container.querySelectorAll('.omni-layout-col-list, .omni-layout-unused-zone');
  var cards = container.querySelectorAll('.omni-layout-card');
  var draggedCard = null;
  var draggedAreaId = null;

  cards.forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      draggedCard = card;
      draggedAreaId = card.dataset.areaId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.areaId);
    });

    card.addEventListener('dragend', function() {
      card.classList.remove('dragging');
      draggedCard = null;
      draggedAreaId = null;
      container.querySelectorAll('.omni-layout-card').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      allLists.forEach(function(l) { l.classList.remove('omni-drop-highlight'); });
    });
  });

  allLists.forEach(function(list) {
    list.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedCard) return;

      // Highlight the target zone
      allLists.forEach(function(l) { l.classList.remove('omni-drop-highlight'); });
      list.classList.add('omni-drop-highlight');

      // Show insertion indicator
      container.querySelectorAll('.omni-layout-card').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });

      var cardsInList = Array.from(list.querySelectorAll('.omni-layout-card:not(.dragging)'));
      for (var i = 0; i < cardsInList.length; i++) {
        var rect = cardsInList[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          cardsInList[i].style.borderTop = '3px solid #8b5a2b';
          return;
        } else if (i === cardsInList.length - 1) {
          cardsInList[i].style.borderBottom = '3px solid #8b5a2b';
          return;
        }
      }
    });

    list.addEventListener('dragleave', function(e) {
      if (!list.contains(e.relatedTarget)) {
        list.classList.remove('omni-drop-highlight');
        list.querySelectorAll('.omni-layout-card').forEach(function(c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
      }
    });

    list.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!draggedCard) return;

      var zone = list.dataset.zone;
      var area = _omniLayoutState.find(function(a) { return a.id === draggedAreaId; });
      if (!area) return;

      // Determine insert position within this zone's cards
      var cardsInList = Array.from(list.querySelectorAll('.omni-layout-card:not(.dragging)'));
      var insertIdx = cardsInList.length;
      for (var i = 0; i < cardsInList.length; i++) {
        var rect = cardsInList[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          insertIdx = i;
          break;
        }
      }

      // Set width/column/visibility based on target zone
      if (zone === 'full') {
        area.visible = true;
        area.width = 'full';
        area.column = null;
      } else if (zone === 'left') {
        area.visible = true;
        area.width = 'half';
        area.column = 'left';
      } else if (zone === 'right') {
        area.visible = true;
        area.width = 'half';
        area.column = 'right';
      } else {
        // unused
        area.visible = false;
      }

      // Recalculate positions
      _recalcOmniPositions(insertIdx, zone, area);

      _renderOmniLayoutGrid();
      setSaveButtonUnsaved();
    });
  });
}

/**
 * Recalculate all positions after a drag-drop.
 * Full-width items get lowest positions, then left/right items, then unused.
 * Within each zone, order is determined by the drop position.
 */
function _recalcOmniPositions(insertIdx, targetZone, droppedArea) {
  // Gather items by zone (excluding the dropped one)
  var fullItems = _omniLayoutState.filter(function(a) {
    return a.id !== droppedArea.id && a.visible && a.width === 'full';
  }).sort(function(a, b) { return a.position - b.position; });

  var leftItems = _omniLayoutState.filter(function(a) {
    return a.id !== droppedArea.id && a.visible && a.width === 'half' && a.column === 'left';
  }).sort(function(a, b) { return a.position - b.position; });

  var rightItems = _omniLayoutState.filter(function(a) {
    return a.id !== droppedArea.id && a.visible && a.width === 'half' && a.column === 'right';
  }).sort(function(a, b) { return a.position - b.position; });

  var unusedItems = _omniLayoutState.filter(function(a) {
    return a.id !== droppedArea.id && !a.visible;
  }).sort(function(a, b) { return a.position - b.position; });

  // Insert the dropped item at the correct position in its target zone
  if (targetZone === 'full') {
    fullItems.splice(Math.min(insertIdx, fullItems.length), 0, droppedArea);
  } else if (targetZone === 'left') {
    leftItems.splice(Math.min(insertIdx, leftItems.length), 0, droppedArea);
  } else if (targetZone === 'right') {
    rightItems.splice(Math.min(insertIdx, rightItems.length), 0, droppedArea);
  } else {
    unusedItems.splice(Math.min(insertIdx, unusedItems.length), 0, droppedArea);
  }

  // Assign positions: full first, then left/right interleaved, then unused
  var pos = 0;
  fullItems.forEach(function(a) { a.position = pos++; });
  var maxHalf = Math.max(leftItems.length, rightItems.length);
  for (var i = 0; i < maxHalf; i++) {
    if (i < leftItems.length) leftItems[i].position = pos++;
    if (i < rightItems.length) rightItems[i].position = pos++;
  }
  unusedItems.forEach(function(a) { a.position = pos++; });
}

function _loadOmniLayout(settings) {
  if (settings.omni_layout) {
    try {
      var saved = typeof settings.omni_layout === 'string' ? JSON.parse(settings.omni_layout) : settings.omni_layout;
      if (Array.isArray(saved) && saved.length > 0) {
        // Merge saved state with defaults (in case new areas were added)
        var defaults = _getDefaultOmniLayout();
        _omniLayoutState = defaults.map(function(def) {
          var found = saved.find(function(s) { return s.id === def.id; });
          if (found) {
            return { id: def.id, label: def.label, width: found.width || def.width, visible: found.visible !== false, position: found.position != null ? found.position : def.position, column: found.column !== undefined ? found.column : def.column, hideWhenEmpty: found.hideWhenEmpty !== undefined ? found.hideWhenEmpty : def.hideWhenEmpty };
          }
          return def;
        });
        return;
      }
    } catch (e) { /* use defaults */ }
  }
  _omniLayoutState = _getDefaultOmniLayout();
}

function _collectOmniLayout() {
  if (!_omniLayoutState) return JSON.stringify(_getDefaultOmniLayout());
  return JSON.stringify(_omniLayoutState.map(function(area) {
    var entry = { id: area.id, width: area.width, visible: area.visible, position: area.position, column: area.column || null, hideWhenEmpty: area.hideWhenEmpty !== false };
    return entry;
  }));
}

/* ── Bundle Omni View Toggles ── */

var _omniBundles = [];

async function _loadOmniBundleToggles() {
  var container = document.getElementById('omni-bundle-toggles');
  if (!container) return;

  // Bundles are already piggybacked on the settings response — no separate API call needed
  var bundles = null;
  if (window.settingsManager && window.settingsManager.settings) {
    bundles = window.settingsManager.settings.bundles;
  }

  if (!bundles || !Array.isArray(bundles) || bundles.length === 0) {
    container.innerHTML = '<p class="setting-hint" style="font-style:italic;">No email bundles configured.</p>';
    return;
  }

  _omniBundles = bundles;
  container.innerHTML = '';
  bundles.forEach(function(bundle) {
    var label = document.createElement('label');
    label.className = 'cwoc-checkbox-label';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'omni-bundle-cb';
    cb.dataset.bundleId = bundle.id;
    cb.checked = !!bundle.omni_view;
    cb.onchange = function() { setSaveButtonUnsaved(); };
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + (bundle.name || 'Unnamed Bundle')));
    container.appendChild(label);
  });
}

async function _saveOmniBundleToggles() {
  var checkboxes = document.querySelectorAll('.omni-bundle-cb');
  for (var i = 0; i < checkboxes.length; i++) {
    var cb = checkboxes[i];
    var bundleId = cb.dataset.bundleId;
    var omniView = cb.checked ? 1 : 0;

    // Find the bundle to check if value changed
    var bundle = _omniBundles.find(function(b) { return String(b.id) === String(bundleId); });
    if (bundle && (!!bundle.omni_view) !== (!!omniView)) {
      try {
        await fetch('/api/bundles/' + bundleId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ omni_view: omniView })
        });
        bundle.omni_view = omniView;
      } catch (e) {
        console.error('[OmniSettings] Failed to update bundle omni_view:', e);
      }
    }
  }
}

/* ── Locked Filter Defaults ── */

function _renderOmniLockedFilters(settings) {
  var display = document.getElementById('omni-locked-filters-display');
  if (!display) return;

  var filters = null;
  if (settings.omni_locked_filters) {
    try {
      filters = typeof settings.omni_locked_filters === 'string' ? JSON.parse(settings.omni_locked_filters) : settings.omni_locked_filters;
    } catch (e) { filters = null; }
  }

  if (!filters || Object.keys(filters).length === 0) {
    display.textContent = 'No locked filters set.';
    display.style.fontStyle = 'italic';
    return;
  }

  var parts = [];
  if (filters.statuses && filters.statuses.length) parts.push('Status: ' + filters.statuses.join(', '));
  if (filters.tags && filters.tags.length) parts.push('Tags: ' + filters.tags.join(', '));
  if (filters.priorities && filters.priorities.length) parts.push('Priority: ' + filters.priorities.join(', '));
  if (filters.people && filters.people.length) parts.push('People: ' + filters.people.join(', '));
  if (filters.text) parts.push('Text: "' + filters.text + '"');

  if (parts.length === 0) {
    display.textContent = 'No locked filters set.';
    display.style.fontStyle = 'italic';
  } else {
    display.textContent = parts.join('; ');
    display.style.fontStyle = 'normal';
  }
}

function _clearOmniLockedFilters() {
  var display = document.getElementById('omni-locked-filters-display');
  if (display) {
    display.textContent = 'No locked filters set.';
    display.style.fontStyle = 'italic';
  }
  // Mark as cleared — will be saved as empty on next save
  _omniLockedFiltersCleared = true;
  setSaveButtonUnsaved();
}

function _resetOmniViewDefaults() {
  // Reset layout to defaults
  _omniLayoutState = _getDefaultOmniLayout();
  _renderOmniLayoutGrid();
  // Reset clock mode
  var clockMode = document.getElementById('omni-hst-clock-mode');
  if (clockMode) clockMode.value = 'both';
  // Clear locked filters
  _clearOmniLockedFilters();
  setSaveButtonUnsaved();
  if (typeof cwocToast === 'function') cwocToast('Omni View reset to defaults', 'info');
}

var _omniLockedFiltersCleared = false;

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

// _isColorLight — removed, use isLightColor() from shared-utils.js directly

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
  if (!(await cwocConfirm('Delete color (' + name + ' - ' + hex + ')?', { title: 'Delete Color', confirmLabel: '🗑️ Delete', danger: true }))) return;
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

// confirmDelete removed — logic moved into openDeleteModal using cwocConfirm

function handleTagInput(event) {
  if (event.key === "Enter" && event.shiftKey) {
    const input = document.getElementById("new-tag");
    const tagText = input.value.trim();
    if (tagText) {
      if (isReservedTagPrefix(tagText)) {
        cwocToast('Tags starting with "CWOC_System/" are reserved.', 'error');
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
  if (!tagText) return;
  if (isReservedTagPrefix(tagText)) {
    cwocToast('Tags starting with "CWOC_System/" are reserved.', 'error');
    return;
  }
  if (event.shiftKey) {
    // Shift+click: open modal for more options
    input.value = "";
    cwocTagModal.open(null, {
      prefillName: tagText,
      onSave: function() { _renderSettingsTagTree(); setSaveButtonUnsaved(); },
    });
  } else {
    // Plain click: quick-create with defaults
    input.value = "";
    createTagInline(tagText).then(function(created) {
      if (created) {
        _renderSettingsTagTree();
        setSaveButtonUnsaved();
      } else {
        if (typeof cwocToast === 'function') cwocToast('Tag already exists or could not be created.', 'info');
      }
    });
  }
}

function addTag() {
  const input = document.getElementById("new-tag");
  const tagText = input.value.trim();
  if (!tagText) return;
  if (isReservedTagPrefix(tagText)) {
    cwocToast('Tags starting with "CWOC_System/" are reserved.', 'error');
    return;
  }
  input.value = "";
  // Quick-create: just add the tag with default color, no modal
  createTagInline(tagText).then(function(created) {
    if (created) {
      _renderSettingsTagTree();
      setSaveButtonUnsaved();
    } else {
      // Tag already exists or failed — show a toast if available
      if (typeof cwocToast === 'function') cwocToast('Tag already exists or could not be created.', 'info');
    }
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

async function openDeleteModal(event, item) {
  event.stopPropagation();
  var isColor = item.classList.contains("color-item");
  var label = isColor ? (item.dataset.name || 'Custom') + ' (' + item.dataset.color + ')' : (item.textContent || '').replace(/✕$/, '').trim();
  var title = isColor ? 'Delete Color' : 'Delete Tag';
  var message = 'Are you sure you want to delete "' + label + '"?';
  var confirmed = await cwocConfirm(message, { title: title, confirmLabel: '🗑️ Delete', danger: true });
  if (!confirmed) return;
  if (isColor) {
    deleteColor(item.dataset.color, item.dataset.name);
  } else {
    item.remove();
    setSaveButtonUnsaved();
    _renderSettingsTagTree();
  }
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
    var omniLayoutModal = document.getElementById("omni-layout-modal");
    if (omniLayoutModal && omniLayoutModal.style.display === "flex") {
      event.preventDefault(); event.stopPropagation(); _closeOmniLayoutModal(); return;
    }
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
      var editView = document.getElementById("emailModalEditView");
      if (editView && editView.style.display !== "none") { _emailModalBackToList(); } else { closeEmailAccountsModal(); }
      return;
    }
    var qrOverlay = document.getElementById("cwoc-qr-overlay");
    if (qrOverlay) { qrOverlay.remove(); return; }
    if (cwocTagModal.isOpen()) { cwocTagModal.close(); return; }
    if (document.getElementById("tag-modal") && document.getElementById("tag-modal").style.display === "flex") { closeTagModal(); return; }
    var unsavedModal = document.getElementById("cwoc-unsaved-modal");
    if (unsavedModal) { unsavedModal.remove(); return; }
    if (document.activeElement && document.activeElement.tagName && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) { document.activeElement.blur(); return; }
    cancelSettings();
  } else if (event.key === "Enter") {
    if (cwocTagModal.isOpen()) {
    }
  }
});


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
      if (response.status === 401) {
        // Session may have expired — check auth and retry once
        console.warn('Settings save got 401, checking auth...');
        var authResp = await fetch('/api/auth/me');
        if (authResp.status === 401) {
          // Truly unauthenticated — redirect to login
          localStorage.setItem('cwoc_auth_return', window.location.href);
          window.location.href = '/login';
          throw new Error('Session expired — redirecting to login');
        }
        // Auth is still valid — retry the save
        var retryResp = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsToSave),
        });
        if (!retryResp.ok)
          throw new Error(`HTTP error on retry! status: ${retryResp.status}`);
        _invalidateSettingsCache();
        return await retryResp.json();
      }
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
      if (typeof _initBadgesSettings === 'function') _initBadgesSettings();
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

    var asDesktopEl = document.getElementById("autosave-desktop-toggle");
    if (asDesktopEl) asDesktopEl.checked = this.settings.autosave_desktop === '1';
    var asMobileEl = document.getElementById("autosave-mobile-toggle");
    if (asMobileEl) asMobileEl.checked = this.settings.autosave_mobile === '1';

    var emailPaginateEl = document.getElementById("emailPaginate");
    if (emailPaginateEl) emailPaginateEl.checked = this.settings.paginate_email === '1';

    var bundlesMultiEl = document.getElementById("bundlesMultiPlacement");
    if (bundlesMultiEl) bundlesMultiEl.checked = this.settings.bundles_multi_placement === '1';

    var bundlesEnabledEl = document.getElementById("bundlesEnabled");
    if (bundlesEnabledEl) bundlesEnabledEl.checked = (this.settings.bundles_enabled !== '0');

    var bundlesShowCountEl = document.getElementById("bundlesShowCount");
    if (bundlesShowCountEl) bundlesShowCountEl.value = this.settings.bundles_show_count || 'unread';

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
      if (!input) return;
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
    _loadEmailPrivacySettings(this.settings);
    _renderAutoBundleToggles(this.settings);
    _updateSignatureInlinePreview();

    var defaultShareContactsCb = document.getElementById('default-share-contacts');
    if (defaultShareContactsCb) defaultShareContactsCb.checked = (this.settings.default_share_contacts === '1');

    var showMapThumbsCb = document.getElementById('show-map-thumbnails');
    if (showMapThumbsCb) showMapThumbsCb.checked = (this.settings.show_map_thumbnails !== '0');

    var attachSizeEl = document.getElementById('attachmentMaxSizeMb');
    if (attachSizeEl && this.settings.attachment_max_size_mb) attachSizeEl.value = this.settings.attachment_max_size_mb;
    var attachStorageEl = document.getElementById('attachmentMaxStorageMb');
    if (attachStorageEl && this.settings.attachment_max_storage_mb) attachStorageEl.value = this.settings.attachment_max_storage_mb;

    var sessionLifetimeEl = document.getElementById('session-lifetime-select');
    if (sessionLifetimeEl) sessionLifetimeEl.value = this.settings.session_lifetime || '24';

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

    // ── Omni View settings ──
    // Omni HST clock mode
    var hstClockMode = document.getElementById('omni-hst-clock-mode');
    if (hstClockMode) hstClockMode.value = this.settings.omni_hst_clock_mode || 'both';

    var omniEmailCount = document.getElementById('omni-email-count');
    if (omniEmailCount) omniEmailCount.value = this.settings.omni_email_count || '3';

    var omniNormColors = document.getElementById('omni-normalize-colors');
    if (omniNormColors) omniNormColors.checked = (this.settings.omni_normalize_colors === '1');

    _loadOmniLayout(this.settings);
    _renderOmniLayoutGrid();
    _loadOmniBundleToggles();
    _renderOmniLockedFilters(this.settings);
    _omniLockedFiltersCleared = false;

    // Load custom view filters
    _loadCustomViewFilters(this.settings);
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
        // Legacy: gather from custom_view_filters text fields for backward compat
        var cvf = _customViewFilters || {};
        var filters = {};
        Object.keys(cvf).forEach(function(key) {
          if (cvf[key] && cvf[key].text) {
            filters[key.toLowerCase()] = cvf[key].text;
          }
        });
        return Object.keys(filters).length > 0 ? filters : {};
      })(),
      custom_view_filters: _gatherCustomViewFilters(),
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
      autosave_desktop: document.getElementById("autosave-desktop-toggle")?.checked ? '1' : '0',
      autosave_mobile: document.getElementById("autosave-mobile-toggle")?.checked ? '1' : '0',
      paginate_email: document.getElementById("emailPaginate")?.checked ? '1' : '0',
      bundles_multi_placement: document.getElementById("bundlesMultiPlacement")?.checked ? '1' : '0',
      bundles_enabled: document.getElementById("bundlesEnabled")?.checked ? '1' : '0',
      bundles_show_count: document.getElementById("bundlesShowCount")?.value || 'unread',
      saved_locations: (() => {
        var locData = collectLocationsData();
        if (locData === undefined) {
          // DOM not populated — preserve existing server value
          var orig = (window.settingsManager && window.settingsManager.settings) ? window.settingsManager.settings.saved_locations : null;
          return orig ? JSON.stringify(orig) : null;
        }
        return JSON.stringify(locData);
      })(),
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
      ..._collectEmailPrivacySettings(),
      attachment_max_size_mb: ((document.getElementById('attachmentMaxSizeMb') || {}).value || '10'),
      attachment_max_storage_mb: ((document.getElementById('attachmentMaxStorageMb') || {}).value || '500'),
      default_share_contacts: (document.getElementById('default-share-contacts') && document.getElementById('default-share-contacts').checked) ? '1' : '0',
      show_map_thumbnails: (document.getElementById('show-map-thumbnails') && document.getElementById('show-map-thumbnails').checked) ? '1' : '0',
      view_order: _collectViewOrder(),
      session_lifetime: (document.getElementById('session-lifetime-select') || {}).value || '24',
      omni_hst_clock_mode: (document.getElementById('omni-hst-clock-mode') || {}).value || 'both',
      omni_email_count: (document.getElementById('omni-email-count') || {}).value || '3',
      omni_normalize_colors: document.getElementById('omni-normalize-colors')?.checked ? '1' : '0',
      omni_layout: _collectOmniLayout(),
      omni_locked_filters: (function() {
        // Sync omni_locked_filters from custom_view_filters for backward compat
        if (_omniLockedFiltersCleared) return '';
        var cvf = _customViewFilters || {};
        if (cvf['Omni'] && Object.keys(cvf['Omni']).length > 0) {
          return JSON.stringify({
            statuses: cvf['Omni'].statuses || [],
            tags: cvf['Omni'].tags || [],
            priorities: cvf['Omni'].priorities || [],
            people: cvf['Omni'].people || [],
            text: cvf['Omni'].text || ''
          });
        }
        return undefined;
      })(),
      smart_actions_config: (typeof _gatherBadgesConfig === 'function') ? _gatherBadgesConfig() : undefined,
    };
  }

  async save() {
    document.getElementById("loader").style.display = "block";
    try {
      const settingsToSave = this.gatherSettings();
      // Remove undefined values (e.g., omni_locked_filters when not cleared)
      Object.keys(settingsToSave).forEach(function(k) {
        if (settingsToSave[k] === undefined) delete settingsToSave[k];
      });
      await SettingsService.saveAll(settingsToSave);

      // Save bundle omni_view flags
      await _saveOmniBundleToggles();

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
      if (typeof syncSend === 'function') syncSend('settings_changed', {});
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

// closeDeleteModal removed — #delete-modal migrated to cwocConfirm

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

// ── Reset Sort Orders ────────────────────────────────────────────────────────

async function _resetSortOrders() {
  var confirmed = await cwocConfirm('This will clear all saved sort preferences and manual item ordering for every view. Are you sure?', {
    title: 'Reset All Sort Orders',
    confirmLabel: 'Reset',
    danger: true
  });
  if (!confirmed) return;

  if (typeof resetAllSortOrders === 'function') {
    resetAllSortOrders().then(function() {
      cwocToast('All sort orders reset');
    }).catch(function(err) {
      console.error('[Settings] Failed to reset sort orders:', err);
      cwocToast('Failed to reset sort orders', 'error');
    });
  } else {
    // Fallback: call the API directly
    fetch('/api/sort-orders', { method: 'DELETE', credentials: 'same-origin' })
      .then(function(res) {
        if (res.ok) {
          localStorage.removeItem('cwoc_manual_order');
          localStorage.removeItem('cwoc_sort_preferences');
          cwocToast('All sort orders reset');
        } else {
          cwocToast('Failed to reset sort orders', 'error');
        }
      })
      .catch(function() { cwocToast('Failed to reset sort orders', 'error'); });
  }
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
  refreshDiskUsage();
  loadImportBatches();
  loadIcsImportOwnerPicker();

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
              preview.innerHTML = marked.parse(ta.value || '', { breaks: true });
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

  // Handle hash-based deep linking (e.g. #email switches to email tab)
  if (window.location.hash) {
    setTimeout(function() {
      var hash = window.location.hash.substring(1).toLowerCase();
      // Map hash names to tabs
      var tabMap = {
        'general': 'general',
        'email': 'email', 'accounts': 'email', 'signature': 'email', 'syncing': 'email', 'badges': 'email',
        'admin': 'admin', 'administration': 'admin',
        'data': 'admin', 'data-management': 'admin', 'dependent-apps': 'admin', 'network-access': 'admin',
        'home-assistant': 'admin', 'kiosk': 'admin', 'version': 'admin', 'updates': 'admin',
        'views': 'views', 'omni-view': 'views', 'omni': 'views', 'map-settings': 'views', 'habits': 'views', 'periods': 'views',
        'collections': 'collections', 'tags': 'collections', 'colors': 'collections', 'saved-locations': 'collections',
        'calendar': 'views',
        'clocks': 'general', 'visual-indicators': 'general', 'indicators': 'general',
        'custom-filters': 'general', 'install-app': 'general', 'pwa': 'general',
        'unit-system': 'general', 'units': 'general'
      };
      if (tabMap[hash]) {
        _switchSettingsTab(tabMap[hash]);
      }
      // Also scroll to specific sections/headings within the active tab
      var headingMap = {
        'notifications': '🔔 Default Notifications',
        'calendar': '📅 Time Periods',
        'periods': '📅 Time Periods',
        'data-management': '📦 Data Management',
        'data': '📦 Data Management',
        'dependent-apps': '📱 Dependent Apps',
        'network-access': '📱 Dependent Apps',
        'home-assistant': '🏠 Home Assistant',
        'kiosk': '📺 Kiosk',
        'version': '🔄 Version & Updates',
        'updates': '🔄 Version & Updates',
        'omni-view': '🔮 Omni View',
        'omni': '🔮 Omni View',
        'map-settings': '🗺️ Map Settings',
        'habits': '🎯 Habits',
        'install-app': '📱 Install as App',
        'pwa': '📱 Install as App',
        'badges': '🏷️ Badges',
        'visual-indicators': 'Visual Indicators',
        'indicators': 'Visual Indicators',
        'clocks': '🕰️ Time Format',
        'custom-filters': 'Custom Filters & Sorting'
      };
      var target = headingMap[hash];
      if (target) {
        var headings = document.querySelectorAll('.settings-tab-content.active h3, .settings-tab-content.active label.setting-subheader');
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].textContent.trim().indexOf(target) !== -1 || headings[i].textContent.trim() === target) {
            headings[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
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
