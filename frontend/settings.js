const timeFormatGrid = document.getElementById("time-format-grid");
const inactiveZone = document.getElementById("inactive-zone");
const clocksContainer = document.getElementById("clocks-container");
const formats = [
  { value: "24hour", text: "24 Hour" },
  { value: "metric", text: "Metric Time" },
  { value: "metricbar", text: "Metric Bar" },
  { value: "12hour", text: "12 Hour" },
  { value: "12houranalog", text: "12 Hour Analog" },
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
      slot.innerHTML = `<div class="format-item" draggable="true" data-value="${format.value}">${format.text}</div>`;
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
      item.textContent = format.text;
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
    newFormatItem.textContent = format.text;
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

function isColorLight(hexColor) {
  const c = hexColor.charAt(0) === "#" ? hexColor.substring(1) : hexColor;
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186;
}

async function loadColors() {
  try {
    const response = await fetch("/api/settings/default_user");
    if (!response.ok) throw new Error("Failed to load colors");
    const data = await response.json();

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

    console.log("Colors saved successfully");
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
  if (!confirm(`Delete color (${name} - ${hex})?`)) return;
  try {
    const response = await fetch("/api/settings/default_user");
    if (!response.ok) throw new Error("Failed to load settings");
    const settings = await response.json();
    settings.custom_colors = (settings.custom_colors || []).filter(
      (color) => !(color.hex === hex && color.name === name),
    );
    const saveResponse = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!saveResponse.ok) throw new Error("Failed to save settings");
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
    colorItem.style.color = isColorLight(hex) ? "#000" : "#fff";
    colorItem.textContent = colorItem.dataset.name;
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
      tagDiv.dataset.color = "#8b5a2b";
      tagDiv.style.backgroundColor = "#8b5a2b";
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
    tagDiv.dataset.color = "#8b5a2b";
    tagDiv.style.backgroundColor = "#8b5a2b";
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
    tagDiv.dataset.color = "#8b5a2b";
    tagDiv.style.backgroundColor = "#8b5a2b";
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

function openTagModal(tag) {
  currentTag = tag;
  const modal = document.getElementById("tag-modal");
  const tagNameInput = document.getElementById("tag-name");
  const colorInput = document.getElementById("tag-color");
  const colorOptions = document.getElementById("tag-color-options");

  // Show the tag's actual name (text content minus the ✕ button)
  const rawText = tag.childNodes[0]?.textContent?.trim() || tag.dataset.color || "";
  tagNameInput.value = rawText;
  tagNameInput.disabled = false;

  // Set color picker to current tag color
  colorInput.value = tag.dataset.color || "#8b5a2b";

  if (colorOptions) colorOptions.innerHTML = "";

  // Live preview: when color changes, update the tag swatch immediately
  colorInput.onchange = function () {
    currentTag.dataset.color = this.value;
    currentTag.style.backgroundColor = this.value;
    setSaveButtonUnsaved();
  };

  colorInput.onclick = function () {
    this.showPicker();
  };

  const favStar = document.getElementById('tag-favorite-star');
  if (favStar) {
    const isFav = tag.dataset.favorite === 'true';
    favStar.textContent = isFav ? '★' : '☆';
    favStar.style.color = isFav ? '#DAA520' : '#999';
    favStar.title = isFav ? 'Unfavorite this Tag' : 'Favorite this Tag';
  }

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
  const newName = tagNameInput.value.trim();
  const newColor = colorInput.value;

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

  // Update the tag element
  currentTag.dataset.color = newColor;
  currentTag.style.backgroundColor = newColor;
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
    color: div.dataset.color || '#8b5a2b',
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
  const saveBtn = document.getElementById("save-exit-btn");
  const isUnsaved = saveBtn && !saveBtn.disabled;

  if (isUnsaved) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "cancel-confirm-modal";
    modal.style.display = "flex";
    modal.innerHTML = `
    <div class="modal-content">
    <h3>Unsaved Changes</h3>
    <p>You have unsaved changes. Are you sure you want to leave?</p>
    <button class="standard-button" id="confirm-exit">Exit Without Saving</button>
    <button class="standard-button" id="stay-here">Oops! Stay Here</button>
    </div>`;
    document.body.appendChild(modal);

    document.getElementById("confirm-exit").onclick = () => {
      const returnUrl = localStorage.getItem('cwoc_settings_return');
      localStorage.removeItem('cwoc_settings_return');
      window.location.href = returnUrl || "/";
    };

    document.getElementById("stay-here").onclick = () => {
      modal.remove();
    };
  } else {
    const returnUrl = localStorage.getItem('cwoc_settings_return');
    localStorage.removeItem('cwoc_settings_return');
    window.location.href = returnUrl || "/";
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (document.getElementById("tag-modal").style.display === "flex") {
      closeTagModal();
    } else if (
      document.getElementById("delete-modal").style.display === "flex"
    ) {
      closeDeleteModal();
    } else if (
      document.getElementById("duplicate-tag-modal").style.display === "flex"
    ) {
      closeDuplicateTagModal();
    } else if (document.getElementById("cancel-confirm-modal")) {
      // ESC on the unsaved-changes confirm modal = "Oops, stay here"
      document.getElementById("cancel-confirm-modal").remove();
    } else {
      // No modal open — same as clicking Cancel
      cancelSettings();
    }
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

document
  .getElementById("gender-toggle")
  .addEventListener("change", function () {
    const genderLabel = document.getElementById("gender-label");
    const toggleLabel = this.nextElementSibling;
    const toggleIcon = toggleLabel.querySelector("span");

    if (this.checked) {
      genderLabel.textContent = "Woman";
      toggleIcon.style.transform = "translateX(30px)";
      toggleIcon.innerHTML = "♀️";
    } else {
      genderLabel.textContent = "Man";
      toggleIcon.style.transform = "translateX(0)";
      toggleIcon.innerHTML = "♂️";
    }
    setSaveButtonUnsaved();
  });

class SettingsService {
  static async loadAll() {
    try {
      const response = await fetch("/api/settings/default_user");
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
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

    const genderToggle = document.getElementById("gender-toggle");
    const genderLabel = document.getElementById("gender-label");
    genderToggle.checked = this.settings.sex === "Woman";
    genderLabel.textContent = this.settings.sex || "Man";
    const toggleIcon = genderToggle.nextElementSibling.querySelector("span");
    toggleIcon.innerHTML = this.settings.sex === "Woman" ? "♀️" : "♂️";
    toggleIcon.style.transform =
      this.settings.sex === "Woman" ? "translateX(30px)" : "translateX(0)";

    document.getElementById("snooze-length").value =
      this.settings.snooze_length || "5 minutes";

    document.getElementById("calendar-snap").value =
      this.settings.calendar_snap || "15";

    const weekStartSel = document.getElementById("week-start-day");
    if (weekStartSel) weekStartSel.value = this.settings.week_start_day || "0";

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

    const tagEditor = document.getElementById("tag-editor-hidden");
    tagEditor
      .querySelectorAll(".tag:not(.tag-input-container .tag)")
      .forEach((tag) => tag.remove());
    this.settings.tags?.forEach((tag) => {
      const tagDiv = document.createElement("div");
      tagDiv.className = "tag";
      tagDiv.dataset.color = tag.color || "#8b5a2b";
      tagDiv.dataset.favorite = tag.favorite ? 'true' : 'false';
      tagDiv.style.backgroundColor = tag.color || "#8b5a2b";
      tagDiv.innerHTML = `${tag.name} <button onclick="openDeleteModal(event, this.parentElement)">✕</button>`;
      tagDiv.onclick = function (e) {
        if (e.target !== this && e.target.tagName === "BUTTON") return;
        openTagModal(this);
      };
      tagEditor.appendChild(tagDiv);
    });

    // Render tag tree view
    _renderSettingsTagTree();

    renderColors(this.settings.custom_colors);
  }

  gatherSettings() {
    return {
      user_id: "default_user",
      time_format: document.getElementById("time-format").value,
      sex: document.getElementById("gender-toggle").checked ? "Woman" : "Man",
      snooze_length: document.getElementById("snooze-length").value,
      calendar_snap: document.getElementById("calendar-snap").value,
      week_start_day: document.getElementById("week-start-day")?.value || "0",
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
      tags: Array.from(
        document.querySelectorAll("#tag-editor-hidden .tag:not(.tag-input-container .tag)"),
      ).map((tag) => ({
        name: (tag.childNodes[0]?.textContent || "").trim(),
        color: tag.dataset.color || "#8b5a2b",
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
        weather: document.querySelector("select[name='weather_indicator']")
          .value,
        people: document.querySelector("select[name='people_indicator']").value,
        indicators: document.querySelector(
          "select[name='indicators_indicator']",
        ).value,
      },
      chit_options: {
        fade_past_chits: document.getElementById("fade-past").checked,
        highlight_overdue_chits:
          document.getElementById("highlight-overdue").checked,
        delete_past_alarm_chits: document.getElementById("delete-past").checked,
      },
    };
  }

  async save() {
    document.getElementById("loader").style.display = "block";
    try {
      const settingsToSave = this.gatherSettings();
      console.log("Saving settings with tags:", JSON.stringify(settingsToSave.tags));
      await SettingsService.saveAll(settingsToSave);
      // Reload from API to get canonical saved state (avoids Pydantic serialization quirks)
      this.settings = await SettingsService.loadAll();
      if (Array.isArray(this.settings.custom_colors)) {
        this.settings.custom_colors = this.settings.custom_colors.map((c) =>
          typeof c === "string" ? { hex: c, name: colorMap[c] || "Custom" } : c,
        );
      }
      console.log("✅ Settings saved. Reloaded tags:", JSON.stringify(this.settings.tags));
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
    document
      .querySelector(".save-settings")
      .addEventListener("click", () => this.save());
  }
}

function setSaveButtonSaved() {
  document.querySelectorAll(".save-settings").forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = 0.6;
    btn.style.pointerEvents = "none";
  });
  const stayBtn = document.getElementById('save-stay-btn');
  if (stayBtn) stayBtn.innerHTML = "✅ Saved";
  const exitBtn = document.getElementById('save-exit-btn');
  if (exitBtn) exitBtn.innerHTML = "✅ Saved";
  const cancelBtn = document.querySelector(".cancel-settings");
  if (cancelBtn) cancelBtn.textContent = "Done";
}

function setSaveButtonUnsaved() {
  document.querySelectorAll(".save-settings").forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = 1;
    btn.style.pointerEvents = "auto";
  });
  const stayBtn = document.getElementById('save-stay-btn');
  if (stayBtn) stayBtn.innerHTML = "💾 Save & Stay";
  const exitBtn = document.getElementById('save-exit-btn');
  if (exitBtn) exitBtn.innerHTML = "💾 Save & Exit";
  const cancelBtn = document.querySelector(".cancel-settings");
  if (cancelBtn) cancelBtn.textContent = "❌ Cancel";
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

document.addEventListener("DOMContentLoaded", () => {
  window.settingsManager = new SettingsManager();
});


// Trash view moved to /frontend/trash.html
