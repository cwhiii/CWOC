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
  const grouped = {};
  statuses.forEach((status) => (grouped[status] = []));
  Object.values(projectState.childChits).forEach((chit) => {
    const status = chit.status || "ToDo";
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(chit);
  });

  statuses.forEach((status) => {
    const section = document.createElement("section");
    section.className = "project-status-section";
    section.dataset.status = status;

    const header = document.createElement("h3");
    header.textContent = status;
    section.appendChild(header);

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

    const list = document.createElement("div");
    list.className = "project-chit-list";

    grouped[status].forEach((chit) => {
      const chitCard = createChildChitCard(chit);
      list.appendChild(chitCard);
    });

    section.appendChild(list);
    projectContainer.appendChild(section);
  });

  container.appendChild(projectContainer);
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

  // Drag handle on far left
  const dragHandle = document.createElement("div");
  dragHandle.className = "project-drag-handle";
  dragHandle.title = "Drag to reorder";
  dragHandle.innerHTML = "≡"; // simple drag icon, can be replaced with SVG or icon font
  contentWrapper.appendChild(dragHandle);

  // Left container: status dropdown and title
  const leftContainer = document.createElement("div");
  leftContainer.className = "left-container";
  leftContainer.style.display = "flex";
  leftContainer.style.alignItems = "center";
  leftContainer.style.flexGrow = "1";
  leftContainer.style.gap = "1em";
  leftContainer.style.minWidth = "0";

  // Status dropdown
  const statusSelect = document.createElement("select");
  statusSelect.className = "status-dropdown";
  ["ToDo", "In Progress", "Blocked", "Complete"].forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    if (chit.status === status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusSelect.addEventListener("change", () => {
    updateChitStatus(chit.id, statusSelect.value);
    // Trigger save chit on change
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
    // Trigger save chit on title change
    saveCurrentChit();
  });
  leftContainer.appendChild(titleDiv);

  contentWrapper.appendChild(leftContainer);

  // Right container: date, open, move, delete
  const rightContainer = document.createElement("div");
  rightContainer.className = "right-container";
  rightContainer.style.display = "flex";
  rightContainer.style.alignItems = "center";
  rightContainer.style.gap = "1em";
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
    // Trigger save chit on date change
    saveCurrentChit();
  });
  rightContainer.appendChild(dueDateInput);

  // Open chit button
  const openBtn = document.createElement("button");
  openBtn.className = "status-icon-button open-chit-btn";
  openBtn.title = "Open chit in new tab";
  openBtn.innerHTML =
    '<i class="fas fa-external-link-alt" aria-hidden="true"></i>';
  openBtn.addEventListener("click", () => {
    window.open(`/editor?id=${chit.id}`, "_blank");
  });
  rightContainer.appendChild(openBtn);

  // Move to project button (only if current chit is NOT a master)
  if (!projectState.projectChit.is_project_master) {
    const moveBtn = document.createElement("button");
    moveBtn.className = "status-icon-button move-project-btn";
    moveBtn.title = "Move to project";
    moveBtn.innerHTML = '<i class="fas fa-folder-open" aria-hidden="true"></i>';
    moveBtn.style.position = "relative";

    const dropdown = document.createElement("div");
    dropdown.className = "move-project-dropdown";

    projectState.projectMasters.forEach((proj) => {
      if (proj.id !== projectState.projectChit.id) {
        const option = document.createElement("div");
        option.textContent = proj.title || "(Untitled Project)";
        option.style.padding = "6px 10px";
        option.style.cursor = "pointer";
        option.style.whiteSpace = "normal";
        option.addEventListener("click", () => {
          moveChildChitToProject(chit.id, proj.id);
          dropdown.style.display = "none";
          // Trigger save chit on move
          saveCurrentChit();
        });
        option.addEventListener("mouseenter", () => {
          option.style.backgroundColor = "#eee";
        });
        option.addEventListener("mouseleave", () => {
          option.style.backgroundColor = "";
        });
        dropdown.appendChild(option);
      }
    });

    moveBtn.appendChild(dropdown);

    moveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === "block";
      document.querySelectorAll(".move-project-dropdown").forEach((dd) => {
        dd.style.display = "none";
      });
      dropdown.style.display = isVisible ? "none" : "block";
    });

    rightContainer.appendChild(moveBtn);
  }

  // Delete button (furthest right)
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "project-delete-item";
  deleteBtn.title = "Delete this chit";
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i>';
  deleteBtn.addEventListener("click", () => {
    alert(`Delete action for chit ${chit.id} not implemented.`);
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

    // Save updated project chit (child_chits list)
    const projectUpdate = {
      ...projectState.projectChit,
      child_chits: projectState.projectChit.child_chits || [],
      tags: projectState.projectChit.tags || [],
      checklist: projectState.projectChit.checklist || [],
      is_project_master: true, // Ensure project chit is marked as master
    };
    const isNewProject = !(await chitExists(projectState.projectChit.id));
    const projectMethod = isNewProject ? "POST" : "PUT";
    const projectUrl = isNewProject
      ? "/api/chits"
      : `/api/chits/${projectState.projectChit.id}`;
    const projectSavePromise = fetch(projectUrl, {
      method: projectMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectUpdate),
    });

    const results = await Promise.all([
      ...childSavePromises,
      projectSavePromise,
    ]);
    if (results.some((res) => res && !res.ok)) {
      console.warn("Some save operations failed:", results);
    }
  } catch (error) {
    console.error("Error saving project changes:", error);
    alert("Failed to save project changes. See console for details.");
  }
}

// Opens a modal to select an existing chit to add as a child
async function openAddChitModal() {
  if (!projectState.projectChit) {
    alert("No project loaded to add a child chit.");
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
          <h2>Add Child Chit</h2>
          <div class="modal-buttons"></div>
        </div>
        <div class="modal-body-new">
          <input type="text" id="chitSearchNew" class="chit-search-input-new" placeholder="Search chits...">
          <table class="chit-table-new">
            <thead>
              <tr>
                <th>Title</th>
                <th>Due</th>
                <th>Start</th>
              </tr>
            </thead>
            <tbody id="chitListNew"></tbody>
          </table>
        </div>
        <div class="modal-footer-new">
          <button class="modal-button-new cancel" id="cancelChitBtnNew">Cancel</button>
          <button class="modal-button-new" id="addChitBtnNew" disabled>Add Selected Chit</button>
        </div>
      </div>
    `;
  }

  modal.style.display = "flex";

  // Fetch all chits and filter out project masters and existing child chits
  try {
    const response = await fetch("/api/chits");
    if (!response.ok) throw new Error("Failed to fetch chits");
    const allChits = await response.json();
    const nonProjectChits = allChits
      .filter(
        (chit) =>
          !chit.is_project_master &&
          chit.id !== (projectState.projectChit?.id) &&
          !(projectState.projectChit.child_chits || []).includes(chit.id),
      )
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    // Store current chit list on modal so delegated handlers can access it
    modal._nonProjectChits = nonProjectChits;
    modal._selectedChitId = null;

    const chitList = document.getElementById("chitListNew");

    const renderChits = (chits) => {
      chitList.innerHTML = "";
      chits.forEach((chit) => {
        const row = document.createElement("tr");
        row.dataset.chitId = chit.id;
        row.innerHTML = `
          <td>${chit.title || "(No Title)"}</td>
          <td>${chit.due_datetime ? new Date(chit.due_datetime).toISOString().slice(0, 10) : ""}</td>
          <td>${chit.start_datetime ? new Date(chit.start_datetime).toISOString().slice(0, 10) : ""}</td>
        `;
        chitList.appendChild(row);
      });
    };

    renderChits(nonProjectChits);

    // Only attach listeners once when the modal is first created
    if (isNewModal) {
      // Delegate click/dblclick on table rows via the tbody
      chitList.addEventListener("click", (e) => {
        const row = e.target.closest("tr");
        if (!row || !row.dataset.chitId) return;
        modal._selectedChitId = row.dataset.chitId;
        chitList.querySelectorAll("tr").forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        document.getElementById("addChitBtnNew").disabled = false;
      });

      chitList.addEventListener("dblclick", (e) => {
        const row = e.target.closest("tr");
        if (!row || !row.dataset.chitId) return;
        const chit = (modal._nonProjectChits || []).find((c) => c.id === row.dataset.chitId);
        if (chit) {
          addChildChit(chit);
          modal.style.display = "none";
        }
      });

      document.getElementById("chitSearchNew").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = (modal._nonProjectChits || []).filter((chit) =>
          (chit.title || "").toLowerCase().includes(searchTerm),
        );
        renderChits(filtered);
      });

      document.getElementById("addChitBtnNew").addEventListener("click", () => {
        if (modal._selectedChitId) {
          const selectedChit = (modal._nonProjectChits || []).find(
            (chit) => chit.id === modal._selectedChitId,
          );
          if (selectedChit) {
            addChildChit(selectedChit);
            modal.style.display = "none";
          }
        }
      });

      document.getElementById("cancelChitBtnNew").addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    // Reset search and selection state each time modal opens
    document.getElementById("chitSearchNew").value = "";
    document.getElementById("addChitBtnNew").disabled = true;
    chitList.querySelectorAll("tr").forEach((r) => r.classList.remove("selected"));
  } catch (error) {
    console.error("Error fetching chits for modal:", error);
    alert("Failed to load chits. Please try again.");
    modal.style.display = "none";
  }
}

function addChildChit(chit) {
  if (!projectState.projectChit) {
    console.warn("No project loaded to add child chit.");
    return;
  }

  // Add chit to childChits map
  projectState.childChits[chit.id] = {
    ...chit,
    status: chit.status || "ToDo",
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
    alert("Project master input element not found.");
    return;
  }

  const chitId = window.currentChitId;
  if (!chitId) {
    alert("No chit ID available.");
    return;
  }

  try {
    const currentValue = projectMasterInput.value === "true";

    if (currentValue) {
      // currently master, about to remove
      if (projectState.projectChit?.child_chits?.length > 0) {
        const confirmed = confirm(
          "This project master has child chits. Removing master status will orphan these child chits. Are you sure?",
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
    alert("Failed to toggle project master status. Please try again.");
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
    const fetches = projectState.projectChit.child_chits.map(
      async (childId) => {
        const res = await fetch(`/api/chit/${childId}`);
        if (res.ok) {
          const chit = await res.json();
          projectState.childChits[childId] = chit;
        } else {
          console.warn(`Failed to load child chit ${childId}`);
        }
      },
    );
    await Promise.all(fetches);
  }
}
