// editor_projects.js
// Manages the Projects Zone UI inside #projectsContent for project master chits.

// Local state for project and child chit data
const projectState = {
  projectChit: null, // Current project chit object
  childChits: {}, // Map child chit ID -> chit object
  projectMasters: [], // List of all project master chits for move dropdown
};

// Single document-level listener to close move-project dropdowns (avoids per-card duplication)
document.addEventListener("click", () => {
  document.querySelectorAll(".move-project-dropdown").forEach((dd) => {
    dd.style.display = "none";
  });
});

/**
 * Mark the editor as having unsaved changes.
 * Delegates to setSaveButtonUnsaved() defined in shared.js.
 */
function saveCurrentChit() {
  if (typeof setSaveButtonUnsaved === "function") {
    setSaveButtonUnsaved();
  }
}

async function initializeProjectZone(projectChitId) {
  if (!projectChitId) {
    console.warn("initializeProjectZone called without projectChitId");
    clearProjectsContent();
    return;
  }

  try {
    // Fetch all project masters for move dropdowns
    projectState.projectMasters = await fetchProjectMasters();

    // Load the project chit and its child chits
    await loadProjectData(projectChitId);

    // Render child chits grouped by status inside the Projects Zone
    renderChildChitsByStatus();

    // Update header buttons visibility
    updateHeaderButtonsVisibility();
  } catch (error) {
    console.error("Error initializing Projects Zone:", error);
    clearProjectsContent();
  }
}

function clearProjectsContent() {
  const container = document.getElementById("projectsContent");
  if (container) container.innerHTML = "<p>No project data to display.</p>";
  projectState.projectChit = null;
  projectState.childChits = {};
  updateHeaderButtonsVisibility();
}

// Update header buttons visibility based on project master status
function updateHeaderButtonsVisibility() {
  const isMaster = projectState.projectChit?.is_project_master === true;
  const addButton = document.getElementById("addNewChitButton");
  const filterButton = document.getElementById("filterProjectItemsBtn");

  if (addButton) addButton.style.display = isMaster ? "inline-flex" : "none";
  if (filterButton)
    filterButton.style.display = isMaster ? "inline-flex" : "none";
}

// Render child chits grouped by status with drag-drop between sections
function renderChildChitsByStatus() {
  const container = document.getElementById("projectsContent");
  if (!container) {
    console.warn("#projectsContent element not found");
    return;
  }
  container.innerHTML = ""; // Clear existing content

  if (!projectState.projectChit) {
    container.innerHTML = "<p>No project loaded.</p>";
    return;
  }

  const projectContainer = document.createElement("div");
  projectContainer.className = "project-container";

  const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];
  const statusMapLower = { "todo": "ToDo", "in progress": "In Progress", "blocked": "Blocked", "complete": "Complete" };
  const grouped = {};
  statuses.forEach((status) => (grouped[status] = []));
  Object.values(projectState.childChits).forEach((chit) => {
    var status = chit.status || "ToDo";
    var normalized = statusMapLower[status.toLowerCase()] || "ToDo";
    grouped[normalized].push(chit);
  });

  statuses.forEach((status) => {
    const section = document.createElement("section");
    section.className = "project-status-section";
    section.dataset.status = status;

    var count = grouped[status].length;

    // Collapsible header
    const header = document.createElement("div");
    header.className = "project-status-header";
    header.style.cssText = "display:flex;align-items:center;gap:0.5em;cursor:pointer;user-select:none;padding:4px 0;";

    var headerTitle = document.createElement("h3");
    headerTitle.style.cssText = "margin:0;font-size:1em;";
    headerTitle.textContent = status;
    header.appendChild(headerTitle);

    var countSpan = document.createElement("span");
    countSpan.style.cssText = "font-size:0.8em;opacity:0.6;font-weight:normal;";
    countSpan.textContent = "(" + count + ")";
    header.appendChild(countSpan);

    var spacer = document.createElement("span");
    spacer.style.cssText = "flex:1;";
    header.appendChild(spacer);

    var toggleIcon = document.createElement("span");
    toggleIcon.className = "project-status-toggle";
    toggleIcon.textContent = "▼";
    toggleIcon.style.cssText = "font-size:0.7em;margin-left:1em;";
    header.appendChild(toggleIcon);

    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "project-chit-list";

    // Collapse "Complete" by default if it has items, expand others
    var isCollapsed = (status === "Complete" && count > 0);
    if (isCollapsed) {
      list.style.display = "none";
      toggleIcon.textContent = "▶";
    }

    header.addEventListener("click", function() {
      var hidden = list.style.display === "none";
      list.style.display = hidden ? "" : "none";
      toggleIcon.textContent = hidden ? "▼" : "▶";
    });

    // Drag and drop on entire section
    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      section.classList.add("drag-over");
    });
    section.addEventListener("dragleave", () => {
      section.classList.remove("drag-over");
    });
    section.addEventListener("drop", (e) => {
      e.preventDefault();
      section.classList.remove("drag-over");
      const chitId = e.dataTransfer.getData("text/plain");
      if (chitId && projectState.childChits[chitId]) {
        updateChitStatus(chitId, status);
      }
    });

    grouped[status].forEach((chit) => {
      const chitCard = createChildChitCard(chit);
      list.appendChild(chitCard);
    });

    section.appendChild(list);
    projectContainer.appendChild(section);
  });

  container.appendChild(projectContainer);

  // Touch drag support for project cards between status columns
  if (typeof enableTouchGesture === 'function') {
    projectContainer.querySelectorAll('.project-item[data-chit-id]').forEach(function (card) {
      var chitId = card.dataset.chitId;
      enableTouchGesture(card, {
        onDragStart: function () {
          card.classList.add('dragging');
          card.style.opacity = '0.4';
        },
        onDragMove: function (data) {
          // Highlight the section under the finger
          projectContainer.querySelectorAll('.project-status-section').forEach(function (s) {
            s.classList.remove('drag-over');
          });
          var target = document.elementFromPoint(data.clientX, data.clientY);
          if (target) {
            var targetSection = target.closest('.project-status-section');
            if (targetSection) targetSection.classList.add('drag-over');
          }
        },
        onDragEnd: function (data) {
          card.classList.remove('dragging');
          card.style.opacity = '';
          projectContainer.querySelectorAll('.project-status-section').forEach(function (s) {
            s.classList.remove('drag-over');
          });
          var target = document.elementFromPoint(data.clientX, data.clientY);
          if (!target) return;
          var targetSection = target.closest('.project-status-section');
          if (!targetSection) return;
          var newStatus = targetSection.dataset.status;
          if (chitId && projectState.childChits[chitId]) {
            updateChitStatus(chitId, newStatus);
          }
        },
      });
    });
  }
}

function updateChitStatus(chitId, newStatus) {
  if (projectState.childChits[chitId]) {
    projectState.childChits[chitId].status = newStatus;
    renderChildChitsByStatus();
    saveCurrentChit();
  }
}

// Create a card element for a child chit with controls and drag-drop support
function createChildChitCard(chit) {
  const card = document.createElement("div");
  card.className = "project-item";
  card.style.width = "100%";

  if (chit.checked || chit.status === "Complete") {
    card.classList.add("checked");
  }
  card.dataset.chitId = chit.id;

  card.draggable = true;
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", chit.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  // Main content wrapper
  const contentWrapper = document.createElement("div");
  contentWrapper.style.display = "flex";
  contentWrapper.style.alignItems = "center";
  contentWrapper.style.width = "100%";
  contentWrapper.style.minWidth = "0";

  // Drag handle on far left
  const dragHandle = document.createElement("div");
  dragHandle.className = "project-drag-handle";
  dragHandle.title = "Drag to reorder";
  dragHandle.innerHTML = "≡";
  contentWrapper.appendChild(dragHandle);

  // Left container: status dropdown and title
  const leftContainer = document.createElement("div");
  leftContainer.className = "left-container";
  leftContainer.style.display = "flex";
  leftContainer.style.alignItems = "center";
  leftContainer.style.flexGrow = "1";
  leftContainer.style.gap = "0.5em";
  leftContainer.style.minWidth = "0";

  // Status dropdown (fixed width for consistency)
  const statusSelect = document.createElement("select");
  statusSelect.className = "status-dropdown project-dropdown-fixed";
  ["ToDo", "In Progress", "Blocked", "Complete"].forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    if (chit.status === status || (chit.status && chit.status.toLowerCase() === status.toLowerCase())) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusSelect.addEventListener("change", () => {
    updateChitStatus(chit.id, statusSelect.value);
    saveCurrentChit();
  });
  leftContainer.appendChild(statusSelect);

  // Title editable div
  const titleDiv = document.createElement("div");
  titleDiv.contentEditable = "true";
  titleDiv.textContent = chit.title || "(No Title)";
  titleDiv.className = "project-item-title";
  titleDiv.style.flexGrow = "1";
  titleDiv.style.minWidth = "0";
  titleDiv.style.overflow = "hidden";
  titleDiv.style.textOverflow = "ellipsis";
  titleDiv.style.whiteSpace = "nowrap";
  titleDiv.addEventListener("input", () => {
    saveCurrentChit();
  });
  leftContainer.appendChild(titleDiv);

  contentWrapper.appendChild(leftContainer);

  // Right container: date, open, remove, delete
  const rightContainer = document.createElement("div");
  rightContainer.className = "right-container";
  rightContainer.style.display = "flex";
  rightContainer.style.alignItems = "center";
  rightContainer.style.gap = "0.4em";
  rightContainer.style.flexShrink = "0";

  // Due date input
  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  if (chit.due_datetime) {
    const date = new Date(chit.due_datetime);
    dueDateInput.value = date.toISOString().slice(0, 10);
  }
  dueDateInput.title = "Due date";
  dueDateInput.addEventListener("change", () => {
    handleDueDateChange(chit.id, dueDateInput.value);
    saveCurrentChit();
  });
  rightContainer.appendChild(dueDateInput);

  // Open chit button
  const openBtn = document.createElement("button");
  openBtn.className = "status-icon-button open-chit-btn";
  openBtn.title = "Open chit in new tab";
  openBtn.innerHTML = '<i class="fas fa-external-link-alt" aria-hidden="true"></i>';
  openBtn.addEventListener("click", () => {
    window.open('/editor?id=' + chit.id, "_blank");
  });
  rightContainer.appendChild(openBtn);

  // Move to another project button
  if (projectState.projectMasters && projectState.projectMasters.length > 1) {
    const moveBtn = document.createElement("button");
    moveBtn.className = "status-icon-button move-project-btn";
    moveBtn.title = "Move to another project";
    moveBtn.innerHTML = '<i class="fas fa-folder-open" aria-hidden="true"></i>';
    moveBtn.style.position = "relative";

    const dropdown = document.createElement("div");
    dropdown.className = "move-project-dropdown";

    projectState.projectMasters.forEach((proj) => {
      if (proj.id !== projectState.projectChit.id) {
        const option = document.createElement("div");
        option.textContent = proj.title || "(Untitled Project)";
        option.style.cursor = "pointer";
        option.addEventListener("click", () => {
          moveChildChitToProject(chit.id, proj.id);
          dropdown.style.display = "none";
          saveCurrentChit();
        });
        dropdown.appendChild(option);
      }
    });

    moveBtn.appendChild(dropdown);
    moveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === "block";
      document.querySelectorAll(".move-project-dropdown").forEach((dd) => { dd.style.display = "none"; });
      dropdown.style.display = isVisible ? "none" : "block";
    });
    rightContainer.appendChild(moveBtn);
  }

  // Remove from project button (✕)
  const removeBtn = document.createElement("button");
  removeBtn.className = "status-icon-button project-remove-child-btn";
  removeBtn.title = "Remove from project";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", async () => {
    var confirmed = await cwocConfirm(
      'Remove "' + (chit.title || 'Untitled') + '" from this project?\n\nThe chit will not be deleted — just unlinked.',
      { title: 'Remove from Project', confirmLabel: '✕ Remove', danger: false }
    );
    if (!confirmed) return;
    // Remove from parent's child_chits list
    if (projectState.projectChit && Array.isArray(projectState.projectChit.child_chits)) {
      projectState.projectChit.child_chits = projectState.projectChit.child_chits.filter(function(id) { return id !== chit.id; });
    }
    delete projectState.childChits[chit.id];
    renderChildChitsByStatus();
    saveCurrentChit();
  });
  rightContainer.appendChild(removeBtn);

  // Delete button (permanently deletes the chit)
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "project-delete-item";
  deleteBtn.title = "Permanently delete this chit";
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i>';
  deleteBtn.addEventListener("click", async () => {
    var confirmed = await cwocConfirm(
      'Permanently delete the <span style="color:#b22222;font-weight:900;text-decoration:underline;">child</span> chit "' + (chit.title || 'Untitled') + '"?\n\nThis cannot be undone.',
      { title: 'Delete Child Chit', confirmLabel: '🗑️ Delete', danger: true, html: true }
    );
    if (!confirmed) return;
    try {
      var resp = await fetch('/api/chits/' + encodeURIComponent(chit.id), { method: 'DELETE' });
      if (!resp.ok) throw new Error('Delete failed');
      if (projectState.projectChit && Array.isArray(projectState.projectChit.child_chits)) {
        projectState.projectChit.child_chits = projectState.projectChit.child_chits.filter(function(id) { return id !== chit.id; });
      }
      delete projectState.childChits[chit.id];
      renderChildChitsByStatus();
      saveCurrentChit();
    } catch (e) {
      console.error('Failed to delete child chit:', e);
      cwocToast('Failed to delete chit.', 'error');
    }
  });
  rightContainer.appendChild(deleteBtn);

  contentWrapper.appendChild(rightContainer);
  card.appendChild(contentWrapper);

  return card;
}

function handleStatusChange(childChitId, newStatus) {
  if (projectState.childChits[childChitId]) {
    projectState.childChits[childChitId].status = newStatus;
  }
}

function handleDueDateChange(childChitId, newDueDate) {
  if (projectState.childChits[childChitId]) {
    if (newDueDate) {
      projectState.childChits[childChitId].due_datetime = new Date(
        newDueDate,
      ).toISOString();
    } else {
      projectState.childChits[childChitId].due_datetime = null;
    }
  }
}

function moveChildChitToProject(childChitId, targetProjectId) {
  if (!projectState.childChits[childChitId]) {
    console.warn(`Child chit ${childChitId} not found`);
    return;
  }
  if (!targetProjectId) {
    console.warn("No target project ID provided for move");
    return;
  }

  // Remove from current project's child_chits list
  const currentChildren = projectState.projectChit.child_chits || [];
  projectState.projectChit.child_chits = currentChildren.filter(
    (id) => id !== childChitId,
  );

  // Add to target project chit in projectMasters list
  const targetProject = projectState.projectMasters.find(
    (p) => p.id === targetProjectId,
  );
  if (!targetProject) {
    console.warn(`Target project ${targetProjectId} not found`);
    return;
  }
  targetProject.child_chits = targetProject.child_chits || [];
  if (!targetProject.child_chits.includes(childChitId)) {
    targetProject.child_chits.push(childChitId);
  }

  // Remove child chit from local childChits map (since it no longer belongs here)
  delete projectState.childChits[childChitId];

  // Re-render UI to reflect changes
  renderChildChitsByStatus();
  saveCurrentChit();
}

async function fetchProjectMasters() {
  try {
    const response = await fetch("/api/chits");
    if (!response.ok) throw new Error("Failed to fetch chits");
    const allChits = await response.json();
    return allChits.filter((chit) => chit.is_project_master === true);
  } catch (error) {
    console.error("Error fetching project masters:", error);
    return [];
  }
}

// Save all project-related changes to backend on main save
async function saveProjectChanges() {
  if (!projectState.projectChit) {
    console.warn("No project chit loaded for saving");
    return;
  }

  try {
    // Save updated child chits (status, due date)
    const childSavePromises = Object.values(projectState.childChits).map(
      async (child) => {
        const chitUpdate = {
          ...child,
          tags: child.tags || [],
          checklist: child.checklist || [],
          is_project_master: false, // Ensure child chits are not project masters
        };
        const isNewChild = !(await chitExists(child.id));
        const method = isNewChild ? "POST" : "PUT";
        const url = isNewChild ? "/api/chits" : `/api/chits/${child.id}`;
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chitUpdate),
        });
        if (!res.ok) {
          console.warn(`Failed to save child chit ${child.id}: ${res.status}`);
        }
      },
    );

    // NOTE: The project chit itself is saved by the editor's main save flow
    // (saveChitData / saveChitAndStay). We only save child chits here to avoid
    // overwriting the project with stale projectState data (which caused ghost
    // duplicates with title "New Project" and no color).

    const results = await Promise.all(childSavePromises);
    if (results.some((res) => res && !res.ok)) {
      console.warn("Some child chit save operations failed:", results);
    }
  } catch (error) {
    console.error("Error saving project changes:", error);
    cwocToast("Failed to save project changes.", "error");
  }
}

// Opens a modal to select an existing chit to add as a child
async function openAddChitModal() {
  if (!projectState.projectChit) {
    cwocToast("No project loaded to add a child chit.", "error");
    return;
  }

  // Create modal once; attach listeners once via delegation to avoid duplication
  let modal = document.getElementById("addChitModalNew");
  let isNewModal = false;
  if (!modal) {
    isNewModal = true;
    modal = document.createElement("div");
    modal.id = "addChitModalNew";
    modal.className = "modal-overlay-new";
    document.body.appendChild(modal);

    modal.innerHTML = `
      <div class="modal-content-new">
        <div class="modal-header-new">
          <h2>Add Child Chits</h2>
          <div class="modal-buttons"></div>
        </div>
        <div class="modal-body-new">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
            <select id="chitFilterStatus" style="padding:4px 8px;border:1px solid #a0522d;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#fff8f0;">
              <option value="">All Statuses</option>
              <option value="ToDo">ToDo</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Complete">Complete</option>
            </select>
            <select id="chitFilterPriority" style="padding:4px 8px;border:1px solid #a0522d;border-radius:4px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#fff8f0;">
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
            <input type="text" id="chitSearchNew" class="chit-search-input-new" placeholder="Search chits..." autofocus style="flex:1;">
          </div>
          <table class="chit-table-new">
            <thead>
              <tr>
                <th style="width:30px;"></th>
                <th>Title</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="chitListNew"></tbody>
          </table>
        </div>
        <div class="modal-footer-new">
          <span id="chitSelectionCount" style="font-size:0.85em;opacity:0.7;"></span>
          <button class="modal-button-new cancel" id="cancelChitBtnNew">Cancel</button>
          <button class="modal-button-new" id="addChitBtnNew" disabled>Add Selected</button>
        </div>
      </div>
    `;
  }

  modal.style.display = "flex";
  window._addChitModalOpen = true;

  // Fetch all chits
  try {
    const response = await fetch("/api/chits");
    if (!response.ok) throw new Error("Failed to fetch chits");
    const allChits = await response.json();
    const currentChildIds = new Set(projectState.projectChit.child_chits || []);

    // All non-project-master chits (excluding self), sorted alphabetically
    const availableChits = allChits
      .filter(function(chit) {
        return !chit.is_project_master && chit.id !== (projectState.projectChit?.id);
      })
      .sort(function(a, b) { return (a.title || "").localeCompare(b.title || ""); });

    console.debug('[AddChitModal] Total from API:', allChits.length, '| Available (non-master):', availableChits.length, '| Already children:', currentChildIds.size, '| Masters filtered:', allChits.filter(function(c){return c.is_project_master;}).map(function(c){return c.title;}));

    modal._availableChits = availableChits;
    modal._currentChildIds = currentChildIds;
    modal._selectedIds = new Set();

    var chitList = document.getElementById("chitListNew");
    var addBtn = document.getElementById("addChitBtnNew");
    var countSpan = document.getElementById("chitSelectionCount");

    function _updateAddBtn() {
      var count = modal._selectedIds.size;
      addBtn.disabled = count === 0;
      countSpan.textContent = count > 0 ? count + " selected" : "";
    }

    function _highlightText(text, term) {
      if (!text) return '';
      var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!term) return escaped;
      var safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escaped.replace(new RegExp('(' + safeTerm + ')', 'gi'), '<mark>$1</mark>');
    }

    function renderChits(chitsToRender) {
      var searchTerm = (document.getElementById("chitSearchNew")?.value || "").toLowerCase().trim();
      var highlightTerm = searchTerm.startsWith('#') ? '' : searchTerm; // Don't highlight in title for tag-only searches
      var tagHighlight = searchTerm.startsWith('#') ? searchTerm.slice(1) : searchTerm;

      chitList.innerHTML = "";
      chitsToRender.forEach(function(chit) {
        var isChild = modal._currentChildIds.has(chit.id);
        var row = document.createElement("tr");
        row.dataset.chitId = chit.id;
        if (isChild) {
          row.style.cssText = "opacity:0.6;background:#e8dcc8;";
          row.title = "Already in this project";
        }

        // Checkbox cell
        var cbCell = document.createElement("td");
        cbCell.style.textAlign = "center";
        if (isChild) {
          var icon = document.createElement("span");
          icon.textContent = "✓";
          icon.style.cssText = "color:#4a7c59;font-weight:bold;";
          cbCell.appendChild(icon);
        } else {
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = modal._selectedIds.has(chit.id);
          cb.dataset.chitId = chit.id;
          cb.addEventListener("change", function() {
            if (this.checked) { modal._selectedIds.add(chit.id); }
            else { modal._selectedIds.delete(chit.id); }
            _updateAddBtn();
          });
          cbCell.appendChild(cb);
        }
        row.appendChild(cbCell);

        // Title + Tags cell
        var titleCell = document.createElement("td");
        var titleSpan = document.createElement("span");
        titleSpan.innerHTML = highlightTerm ? _highlightText(chit.title || "(No Title)", highlightTerm) : (chit.title || "(No Title)").replace(/&/g, '&amp;').replace(/</g, '&lt;');
        if (isChild) titleSpan.style.fontStyle = "italic";
        titleCell.appendChild(titleSpan);

        // Tags (non-system, shown as small badges)
        var userTags = (chit.tags || []).filter(function(t) { return !t.startsWith('CWOC_System/'); });
        if (userTags.length > 0) {
          var tagsSpan = document.createElement("span");
          tagsSpan.style.cssText = "margin-left:6px;font-size:0.8em;opacity:0.7;";
          tagsSpan.innerHTML = userTags.map(function(t) {
            var tagHtml = tagHighlight ? _highlightText(t, tagHighlight) : t.replace(/&/g, '&amp;');
            return '<span style="background:#f0e6d0;padding:1px 5px;border-radius:3px;margin-right:3px;white-space:nowrap;">' + tagHtml + '</span>';
          }).join('');
          titleCell.appendChild(tagsSpan);
        }
        row.appendChild(titleCell);

        // Due date cell
        var dueCell = document.createElement("td");
        dueCell.textContent = chit.due_datetime ? new Date(chit.due_datetime).toISOString().slice(0, 10) : "";
        row.appendChild(dueCell);

        // Status cell
        var statusCell = document.createElement("td");
        statusCell.innerHTML = highlightTerm ? _highlightText(chit.status || "", highlightTerm) : (chit.status || "");
        row.appendChild(statusCell);

        // Click row to toggle checkbox (unless already a child)
        if (!isChild) {
          row.style.cursor = "pointer";
          row.addEventListener("click", function(e) {
            if (e.target.tagName === "INPUT") return;
            var checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event("change"));
            }
          });
          // Double-click to add immediately
          row.addEventListener("dblclick", function() {
            addChildChit(chit);
            modal._currentChildIds.add(chit.id);
            modal._selectedIds.delete(chit.id);
            renderChits(modal._filteredChits || modal._availableChits);
            _updateAddBtn();
          });
        }

        chitList.appendChild(row);
      });
    }

    modal._filteredChits = availableChits;
    renderChits(availableChits);

    // Update header with count
    var headerH2 = modal.querySelector('.modal-header-new h2');
    if (headerH2) headerH2.textContent = 'Add Child Chits (' + availableChits.length + ' available)';

    // Shared filter function — applies text search + status + priority dropdowns
    function _applyModalFilters() {
      var searchTerm = (document.getElementById("chitSearchNew")?.value || "").toLowerCase().trim();
      var statusFilter = (document.getElementById("chitFilterStatus")?.value || "").toLowerCase();
      var priorityFilter = (document.getElementById("chitFilterPriority")?.value || "").toLowerCase();

      modal._filteredChits = (modal._availableChits || []).filter(function(chit) {
        // Status dropdown filter (case-insensitive)
        if (statusFilter && (chit.status || "").toLowerCase() !== statusFilter) return false;
        // Priority dropdown filter (case-insensitive)
        if (priorityFilter && (chit.priority || "").toLowerCase() !== priorityFilter) return false;
        // Text search
        if (searchTerm && !chitMatchesSearch(chit, searchTerm)) return false;
        return true;
      });

      renderChits(modal._filteredChits);
      var headerH2 = modal.querySelector('.modal-header-new h2');
      if (headerH2) headerH2.textContent = 'Add Child Chits (' + modal._filteredChits.length + ' shown)';
    }

    // Only attach listeners once when the modal is first created
    if (isNewModal) {
      document.getElementById("chitSearchNew").addEventListener("input", _applyModalFilters);
      document.getElementById("chitFilterStatus").addEventListener("change", _applyModalFilters);
      document.getElementById("chitFilterPriority").addEventListener("change", _applyModalFilters);

      addBtn.addEventListener("click", function() {
        if (modal._selectedIds.size === 0) return;
        modal._selectedIds.forEach(function(id) {
          var chit = (modal._availableChits || []).find(function(c) { return c.id === id; });
          if (chit) addChildChit(chit);
        });
        modal._selectedIds.clear();
        modal.style.display = "none";
        window._addChitModalOpen = false;
      });

      document.getElementById("cancelChitBtnNew").addEventListener("click", function() {
        modal.style.display = "none";
        window._addChitModalOpen = false;
      });

      // Click overlay to close
      modal.addEventListener("click", function(e) {
        if (e.target === modal) {
          modal.style.display = "none";
          window._addChitModalOpen = false;
        }
      });

      // ESC key closes modal (layered: clear search → close modal)
      modal._escHandler = function(e) {
        if (e.key === "Escape" && modal.style.display === "flex") {
          e.preventDefault();
          e.stopPropagation();
          var searchInput = document.getElementById("chitSearchNew");
          if (searchInput && searchInput.value.trim()) {
            // First ESC: clear search text and reset list
            searchInput.value = "";
            searchInput.dispatchEvent(new Event("input"));
            searchInput.focus();
          } else {
            // Second ESC: close modal
            modal.style.display = "none";
            window._addChitModalOpen = false;
          }
        }
      };
      document.addEventListener("keydown", modal._escHandler, true);
    }

    // Reset state each time modal opens
    document.getElementById("chitSearchNew").value = "";
    modal._selectedIds.clear();
    _updateAddBtn();
    setTimeout(function() { document.getElementById("chitSearchNew").focus(); }, 50);
  } catch (error) {
    console.error("Error fetching chits for modal:", error);
    cwocToast("Failed to load chits. Please try again.", "error");
    modal.style.display = "none";
    window._addChitModalOpen = false;
  }
}

function addChildChit(chit) {
  if (!projectState.projectChit) {
    console.warn("No project loaded to add child chit.");
    return;
  }

  // Normalize status to match expected values (case-insensitive)
  var normalizedStatus = chit.status || "ToDo";
  var statusMap = { "todo": "ToDo", "in progress": "In Progress", "blocked": "Blocked", "complete": "Complete" };
  var lower = normalizedStatus.toLowerCase();
  if (statusMap[lower]) normalizedStatus = statusMap[lower];

  // Add chit to childChits map
  projectState.childChits[chit.id] = {
    ...chit,
    status: normalizedStatus,
    due_datetime: chit.due_datetime || null,
    tags: chit.tags || [],
    checklist: chit.checklist || [],
  };

  // Add chit ID to project's child_chits list
  if (!Array.isArray(projectState.projectChit.child_chits)) {
    projectState.projectChit.child_chits = [];
  }
  if (!projectState.projectChit.child_chits.includes(chit.id)) {
    projectState.projectChit.child_chits.push(chit.id);
  }

  // Re-render the Projects Zone UI
  renderChildChitsByStatus();
  saveCurrentChit();
}

// Modified addProjectItem to open the modal
function addProjectItem() {
  openAddChitModal();
}

// Toggles project master status, with confirmation if children exist
async function toggleProjectMaster() {
  const projectMasterInput = document.getElementById("isProjectMaster");
  if (!projectMasterInput) {
    cwocToast("Project master input element not found.", "error");
    return;
  }

  const chitId = window.currentChitId;
  if (!chitId) {
    cwocToast("No chit ID available.", "error");
    return;
  }

  try {
    const currentValue = projectMasterInput.value === "true";

    if (currentValue) {
      // currently master, about to remove
      if (projectState.projectChit?.child_chits?.length > 0) {
        const confirmed = await cwocConfirm(
          "This project master has child chits. Removing master status will orphan these child chits. Are you sure?",
          { title: 'Remove Project Master', confirmLabel: 'Remove', danger: true }
        );
        if (!confirmed) return; // abort toggle
      }
    }

    projectMasterInput.value = currentValue ? "false" : "true";

    if (projectMasterInput.value === "true") {
      await initializeProjectZone(chitId);
    } else {
      clearProjectsContent();
    }
    saveCurrentChit();
  } catch (error) {
    console.error("Error in toggleProjectMaster:", error);
    cwocToast("Failed to toggle project master status.", "error");
    projectMasterInput.value = "false"; // revert on failure
  }
}

async function chitExists(chitId) {
  try {
    const response = await fetch(`/api/chit/${chitId}`);
    return response.ok;
  } catch {
    return false;
  }
}

// Fetch the project chit and its child chits from backend or use local data for new chits
async function loadProjectData(projectChitId) {
  // For new chits, create a local project chit if none exists
  const isNewChit = !(await chitExists(projectChitId));
  if (isNewChit) {
    projectState.projectChit = {
      id: projectChitId,
      title: "New Project",
      is_project_master: true,
      child_chits: [],
      tags: [],
      checklist: [],
    };
  } else {
    // Fetch existing project chit
    const projectResponse = await fetch(`/api/chit/${projectChitId}`);
    if (!projectResponse.ok) {
      throw new Error(`Failed to load project chit ${projectChitId}`);
    }
    projectState.projectChit = await projectResponse.json();
  }

  projectState.childChits = {};

  // Fetch each child chit by ID (for existing chits)
  if (
    Array.isArray(projectState.projectChit.child_chits) &&
    projectState.projectChit.child_chits.length > 0
  ) {
    const staleIds = [];
    const fetches = projectState.projectChit.child_chits.map(
      async (childId) => {
        const res = await fetch(`/api/chit/${childId}`);
        if (res.ok) {
          const chit = await res.json();
          // Skip soft-deleted children — they shouldn't appear in the project
          if (chit.deleted) {
            console.debug(`Skipping deleted child chit ${childId}`);
            staleIds.push(childId);
            return;
          }
          projectState.childChits[childId] = chit;
        } else {
          console.warn(`Failed to load child chit ${childId} (${res.status})`);
          staleIds.push(childId);
        }
      },
    );
    await Promise.all(fetches);

    // Auto-prune stale/inaccessible child references
    if (staleIds.length > 0) {
      projectState.projectChit.child_chits = projectState.projectChit.child_chits.filter(
        id => !staleIds.includes(id)
      );
    }
  }
}
