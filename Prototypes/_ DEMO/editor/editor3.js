/* --- Tags Functions --- */

function getFullTagPath(tagId) {
  let path = [];
  let currentTag = tagsData.find((t) => t.id === tagId);
  while (currentTag) {
    path.unshift(currentTag.name);
    currentTag = tagsData.find((t) => t.id === currentTag.parentId);
  }
  return path.join("/");
}

function toggleAllTags(event, expand) {
  if (event) event.stopPropagation();
  tagsData.forEach((tag) => (tag.isExpanded = expand));
  renderTagTree(document.getElementById("tagSearchInput").value);
}

function createTag(event) {
  if (event) event.stopPropagation();
  showCustomAlert("Create New Tag functionality is not yet implemented.");
}

function updateActiveTagsCount() {
  document.getElementById("activeTagsCount").textContent = activeTags.length;
}

function createTagItemElement(tag) {
  const tagEl = document.createElement("span");
  tagEl.className = "tag-item";
  tagEl.textContent = tag.name;
  tagEl.title = `ID: ${tag.id}`;
  if (activeTags.includes(tag.id)) {
    tagEl.classList.add("active-in-tree");
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-tag-from-tree";
    removeBtn.innerHTML = "×";
    removeBtn.onclick = (event) => {
      event.stopPropagation();
      removeTagFromActiveList(tag.id);
    };
    tagEl.appendChild(removeBtn);
  } else {
    tagEl.onclick = () => addTagToActiveList(tag.id);
  }
  return tagEl;
}

function renderTagGrid() {
  const mostUsedContainer = document.getElementById("mostUsedTags");
  const mostRecentContainer = document.getElementById("mostRecentTags");
  const favTagsContainer = document.getElementById("favTags");
  if (mostUsedContainer) mostUsedContainer.innerHTML = "";
  if (mostRecentContainer) mostRecentContainer.innerHTML = "";
  if (favTagsContainer) favTagsContainer.innerHTML = "";
  const sortedByUsage = [...tagsData]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 3);
  sortedByUsage.forEach((tag) => {
    const tagEl = createTagItemElement(tag);
    if (mostUsedContainer) mostUsedContainer.appendChild(tagEl);
  });
  const sortedByRecent = [...tagsData]
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
    .slice(0, 3);
  sortedByRecent.forEach((tag) => {
    const tagEl = createTagItemElement(tag);
    if (mostRecentContainer) mostRecentContainer.appendChild(tagEl);
  });
  const favoriteTags = tagsData.filter((tag) => tag.isFavorite).slice(0, 3);
  favoriteTags.forEach((tag) => {
    const tagEl = createTagItemElement(tag);
    if (favTagsContainer) favTagsContainer.appendChild(tagEl);
  });
}

function renderTagTree(filterText = "") {
  const tagTreeContainer = document.getElementById("tagTreeContainer");
  if (!tagTreeContainer) return;
  tagTreeContainer.innerHTML = "";
  const matchedTagIds = new Set();
  if (filterText) {
    tagsData.forEach((tag) => {
      if (tag.name.toLowerCase().includes(filterText.toLowerCase())) {
        matchedTagIds.add(tag.id);
      }
    });
  }

  const allRelevantTagIds = new Set(matchedTagIds);
  matchedTagIds.forEach((id) => {
    let currentTag = tagsData.find((t) => t.id === id);
    while (currentTag) {
      const tagInState = tagsData.find((t) => t.id === currentTag.id);
      if (tagInState) {
        tagInState.isExpanded = true;
      }
      if (currentTag.parentId) {
        currentTag = tagsData.find((t) => t.id === currentTag.parentId);
        if (currentTag) {
          allRelevantTagIds.add(currentTag.id);
        }
      } else {
        currentTag = null;
      }
    }
  });
  const relevantTagsMap = new Map();
  tagsData.forEach((tag) => {
    if (allRelevantTagIds.has(tag.id) || !filterText) {
      relevantTagsMap.set(tag.id, {
        ...tag,
        children: [],
        isGreyedOutParent: false,
        isExpanded: tag.isExpanded,
      });
    }
  });
  if (filterText) {
    relevantTagsMap.forEach((tag) => {
      if (!matchedTagIds.has(tag.id)) {
        tag.isGreyedOutParent = true;
      }
    });
  }

  relevantTagsMap.forEach((tag) => {
    if (tag.parentId && relevantTagsMap.has(tag.parentId)) {
      relevantTagsMap.get(tag.parentId).children.push(tag);
    }
  });
  const rootTags = Array.from(relevantTagsMap.values())
    .filter((tag) => !tag.parentId || !relevantTagsMap.has(tag.parentId))
    .sort((a, b) => a.name.localeCompare(b.name));
  function buildTreeHtml(tags, level = 0) {
    let html = "";
    tags.forEach((tag) => {
      const hasChildren = tag.children.length > 0;
      const isExpanded = tag.isExpanded;
      const isActive = activeTags.includes(tag.id);
      const greyedOutClass = tag.isGreyedOutParent ? "greyed-out-parent" : "";
      const activeInTreeClass = isActive ? "active-in-tree" : "";

      html += `
                                <div class="tag-tree-node ${hasChildren ? "" : "no-children"} ${isExpanded ? "expanded" : "collapsed"} ${greyedOutClass} ${activeInTreeClass}" data-tag-id="${tag.id}" style="padding-left: ${level * 15}px;">
                                                <span class="tag-tree-toggle" onclick="toggleTagTreeNode(event, '${tag.id}')">${hasChildren ? (isExpanded ? "▼" : "▶") : ""}</span>
                                        <span class="tag-name" title="ID: ${tag.id}" ${
                                          tag.isGreyedOutParent
                                            ? ""
                                            : `onclick="addTagToActiveList('${tag.id}')"`
                                        }>${tag.name}</span>
                                        ${
                                          isActive
                                            ? `<button type="button" class="remove-tag-from-tree" onclick="event.stopPropagation(); removeTagFromActiveList('${tag.id}')">×</button>`
                                            : ""
                                        }
                                    </div>
                                        `;
      if (hasChildren && isExpanded) {
        html += `<div class="tag-tree-children">`;
        tag.children.sort((a, b) => a.name.localeCompare(b.name));
        html += buildTreeHtml(tag.children, level + 1);
        html += `</div>`;
      }
    });
    return html;
  }

  tagTreeContainer.innerHTML = buildTreeHtml(rootTags);
}

function toggleTagTreeNode(event, tagId) {
  event.stopPropagation();
  const tagNode = document.querySelector(
    `.tag-tree-node[data-tag-id="${tagId}"]`,
  );
  if (tagNode) {
    const tagInState = tagsData.find((t) => t.id === tagId);
    if (tagInState) {
      tagInState.isExpanded = !tagInState.isExpanded;
    }
    renderTagTree(document.getElementById("tagSearchInput").value);
  }
}

function filterTagTree() {
  const searchInput = document.getElementById("tagSearchInput");
  renderTagTree(searchInput.value.trim());
}

function renderActiveTags() {
  const activeTagsListContainer = document.getElementById(
    "activeTagsListContainer",
  );
  if (!activeTagsListContainer) return;
  activeTagsListContainer.innerHTML = "";

  activeTags.forEach((tagId) => {
    const tag = tagsData.find((t) => t.id === tagId);
    if (tag) {
      const tagEl = document.createElement("span");
      tagEl.className = "active-tag-item";
      tagEl.title = `ID: ${tag.id}`;
      tagEl.innerHTML = `
                                            ${getFullTagPath(tag.id)}
                                            <button type="button" class="remove-tag" onclick="removeTagFromActiveList('${tag.id}')">×</button>
                                        `;
      activeTagsListContainer.appendChild(tagEl);
    }
  });
  updateActiveTagsCount();
  renderTagGrid();
  renderTagTree(document.getElementById("tagSearchInput").value);
}

function addTagToActiveList(tagId) {
  if (activeTags.includes(tagId)) {
    const existingTagElement = document.querySelector(
      `#activeTagsListContainer .active-tag-item[title*="${tagId}"]`,
    );
    if (existingTagElement) {
      existingTagElement.classList.remove("highlight");
      void existingTagElement.offsetWidth;
      existingTagElement.classList.add("highlight");
      setTimeout(() => {
        existingTagElement.classList.remove("highlight");
      }, 600);
    }
    return;
  }

  activeTags.push(tagId);
  renderActiveTags();
  const tag = tagsData.find((t) => t.id === tagId);
  if (tag) {
    tag.usageCount = (tag.usageCount || 0) + 1;
    tag.lastUsed = new Date().toISOString().split("T")[0];
    renderTagGrid();
  }
}

function removeTagFromActiveList(tagId) {
  activeTags = activeTags.filter((id) => id !== tagId);
  renderActiveTags();
}

function addSearchedTag(event) {
  if (event) event.stopPropagation();
  const searchInput = document.getElementById("tagSearchInput");
  const searchTerm = searchInput.value.trim().toLowerCase();

  if (!searchTerm) {
    showCustomAlert("Please enter a tag name to add.");
    return;
  }

  const matchingTags = tagsData.filter((tag) =>
    tag.name.toLowerCase().includes(searchTerm),
  );
  if (matchingTags.length === 0) {
    showCustomAlert(`No tag matching "${searchTerm}" found.`);
    return;
  }

  if (event && event.shiftKey) {
    matchingTags.forEach((tag) => addTagToActiveList(tag.id));
    searchInput.value = "";
    filterTagTree();
  } else if (matchingTags.length === 1) {
    addTagToActiveList(matchingTags[0].id);
    searchInput.value = "";
    filterTagTree();
  } else {
    showCustomAlert(
      "Multiple tags found. Use Shift+Add to add all, or select from the tree.",
    );
  }
}

function handleTagSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addSearchedTag(event);
  } else if (event.key === "Escape") {
    event.preventDefault();
    clearTagSearch(event);
  }
}

function clearTagSearch(event) {
  if (event) event.stopPropagation();
  document.getElementById("tagSearchInput").value = "";
  filterTagTree();
}

/* --- Project List Functions --- */

const statusEmojis = {
  ToDo: "📋",
  "In Progress": "⏳",
  Blocked: "🚫",
  Backlog: "📝",
  Complete: "✅",
};
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  if (isNaN(date.getTime())) return "";
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options).replace(/,/g, "");
}

function generateUniqueProjectId() {
  return "proj-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

function renderProjectItems() {
  const projectsContent = document.getElementById("projectsContent");
  if (!projectsContent) return;
  projectsContent.innerHTML = "";

  const isProjectMasterElement = document.getElementById("isProjectMaster");
  const isProjectMaster = isProjectMasterElement
    ? isProjectMasterElement.value === "true"
    : false;
  if (!isProjectMaster) {
    projectsContent.classList.remove("project-list-active");
    return;
  } else {
    projectsContent.classList.add("project-list-active");
  }

  const sortedProjectItems = [...projectItemsData].sort((a, b) => {
    const statusAIndex = availableStatuses.findIndex(
      (s) => s.name === a.status,
    );
    const statusBIndex = availableStatuses.findIndex(
      (s) => s.name === b.status,
    );
    if (statusAIndex !== statusBIndex) return statusAIndex - statusBIndex;
    return 0;
  });
  availableStatuses.forEach((statusObj) => {
    const statusName = statusObj.name;
    const statusIconClass = statusObj.icon;
    const itemsInThisStatus = sortedProjectItems.filter(
      (item) => item.status === statusName,
    );

    if (activeStatusesFilter.includes(statusName)) {
      const statusHeaderDiv = document.createElement("div");
      statusHeaderDiv.className = "status-group-header";
      statusHeaderDiv.dataset.status = statusName;

      statusHeaderDiv.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedProjectItemData) {
          statusHeaderDiv.classList.add("drag-over");
        }
      });
      statusHeaderDiv.addEventListener("dragleave", () => {
        statusHeaderDiv.classList.remove("drag-over");
      });
      statusHeaderDiv.addEventListener("drop", (e) => {
        e.preventDefault();
        statusHeaderDiv.classList.remove("drag-over");
        if (draggedProjectItemData) {
          handleProjectItemDrop(e, statusHeaderDiv.dataset.status, null);
        }
      });

      if (itemsInThisStatus.length === 0) {
        statusHeaderDiv.classList.add("empty-state-header");
      }

      statusHeaderDiv.innerHTML = `
                                <span class="status-title">
                                    <i class="${statusIconClass} status-icon"></i>
                                    ${statusName}
                                </span>
                                `;
      projectsContent.appendChild(statusHeaderDiv);

      const statusItemsContainer = document.createElement("div");
      statusItemsContainer.className = "status-items-container";
      statusItemsContainer.dataset.status = statusName;
      if (itemsInThisStatus.length === 0) {
        statusItemsContainer.classList.add("empty-state-drag-area");
      }

      projectsContent.appendChild(statusItemsContainer);
      statusItemsContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedProjectItemData) {
          statusItemsContainer.classList.add("drag-over");
        }
      });
      statusItemsContainer.addEventListener("dragleave", () => {
        statusItemsContainer.classList.remove("drag-over");
      });
      statusItemsContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        statusItemsContainer.classList.remove("drag-over");
        if (draggedProjectItemData) {
          handleProjectItemDrop(e, statusItemsContainer.dataset.status, null);
        }
      });
      itemsInThisStatus.forEach((itemData) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "project-item";
        itemDiv.draggable = true;
        itemDiv.dataset.id = itemData.id;
        itemDiv.dataset.status = itemData.status;

        itemDiv.addEventListener("dblclick", () => {
          window.location.href = "editor.html?id=" + itemData.id;
        });

        const dragHandleSpan = document.createElement("span");
        dragHandleSpan.className = "drag-handle-item";
        dragHandleSpan.innerHTML = '<i class="fas fa-grip-lines"></i>';

        const statusDropdown = document.createElement("select");
        statusDropdown.className = `project-item-status-dropdown status-${itemData.status.replace(/\s/g, "")}`;
        statusDropdown.onchange = (e) =>
          changeProjectItemStatus(e, itemData.id);
        const isNarrowScreen = window.innerWidth <= 600;
        const blankOption = document.createElement("option");
        blankOption.value = "";
        blankOption.textContent = "";
        blankOption.selected = true;
        blankOption.disabled = true;
        blankOption.hidden = true;
        statusDropdown.appendChild(blankOption);
        availableStatuses.forEach((s) => {
          const option = document.createElement("option");
          option.value = s.name;
          option.textContent =
            isNarrowScreen && statusEmojis[s.name]
              ? statusEmojis[s.name]
              : s.name;
          if (s.name === itemData.status) {
            option.selected = true;
          }
          statusDropdown.appendChild(option);
        });
        const textSpan = document.createElement("span");
        textSpan.className = "project-item-text";
        if (itemData.text === "") {
          textSpan.textContent = "Title";
          textSpan.classList.add("ghost-text");
        } else {
          textSpan.textContent = itemData.text;
        }
        textSpan.title = itemData.text;
        textSpan.onclick = (e) => editProjectItemTitle(e, itemData.id);
        const dueDateSpan = document.createElement("span");
        dueDateSpan.className = "project-item-due-date";
        if (itemData.dueDate) {
          const formattedDate = formatDate(itemData.dueDate);
          dueDateSpan.appendChild(document.createTextNode(formattedDate));
        } else {
          dueDateSpan.textContent = "No Due Date";
        }
        dueDateSpan.onclick = (e) => editProjectItemDueDate(e, itemData.id);

        const itemActionsDiv = document.createElement("div");
        itemActionsDiv.className = "item-actions";

        const openNewTabBtn = document.createElement("button");
        openNewTabBtn.className = "open-new-tab-btn";
        openNewTabBtn.title = "Open in new tab";
        openNewTabBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
        openNewTabBtn.onclick = (e) => {
          e.stopPropagation();
          window.open("editor.html?id=" + itemData.id, "_blank");
        };

        const moveProjectSelect = document.createElement("select");
        moveProjectSelect.className = "move-item-btn";
        moveProjectSelect.title = "Move to project →";
        moveProjectSelect.onchange = (e) => {
          const selectedProject = e.target.value;
          if (selectedProject) {
            console.log(
              `Item ${itemData.id} moved to project: ${selectedProject}`,
            );
            projectItemsData = projectItemsData.filter(
              (item) => item.id !== itemData.id,
            );
            renderProjectItems();
          }
          e.target.value = "";
        };
        moveProjectSelect.innerHTML =
          '<option value="">Chit → Project</option>';
        const sampleProjects = [
          "Project Alpha",
          "Project Beta",
          "Project Gamma",
        ];
        sampleProjects.forEach((project) => {
          const option = document.createElement("option");
          option.value = project.toLowerCase().replace(/\s/g, "-");
          option.textContent = project;
          moveProjectSelect.appendChild(option);
        });
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-item-btn";
        deleteButton.onclick = (e) => deleteProjectItem(e, itemData.id);
        deleteButton.title = "Delete";
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';

        itemActionsDiv.appendChild(openNewTabBtn);
        itemActionsDiv.appendChild(moveProjectSelect);
        itemActionsDiv.appendChild(deleteButton);

        itemDiv.appendChild(dragHandleSpan);
        itemDiv.appendChild(statusDropdown);
        itemDiv.appendChild(textSpan);
        itemDiv.appendChild(dueDateSpan);
        itemDiv.appendChild(itemActionsDiv);

        statusItemsContainer.appendChild(itemDiv);
        addProjectDragAndDropListeners(itemDiv);
      });
    }
  });
  const projectsSection = document.getElementById("projectsSection");
  if (projectsSection && projectsSection.classList.contains("expanded")) {
    projectsSection.style.height =
      projectsContent.scrollHeight +
      projectsSection.querySelector(".zone-header").offsetHeight +
      "px";
  }
}

function toggleProjectMaster(event, initialLoad = false) {
  if (event) event.stopPropagation();

  const hiddenInput = document.getElementById("isProjectMaster");
  if (!hiddenInput) {
    console.error("isProjectMaster hidden input not found.");
    return;
  }

  const button = document.getElementById("projectMasterToggleButton");
  const icon = button.querySelector("i");
  const moveToProjectDropdown = document.getElementById(
    "moveToProjectDropdown",
  );
  const projectsContent = document.getElementById("projectsContent");
  if (!initialLoad) {
    hiddenInput.value = hiddenInput.value === "true" ? "false" : "true";
  }

  const isMaster = hiddenInput.value === "true";

  if (isMaster) {
    button.classList.add("active");
    icon.classList.remove("fas", "fa-hammer");
    icon.classList.add("fas", "fa-check-circle");
    button.title = "Project Master (Active)";
    button.innerHTML = '<i class="fas fa-check-circle"></i> Project Master';
    if (moveToProjectDropdown) {
      moveToProjectDropdown.style.display = "none";
    }
    projectsContent.classList.add("project-list-active");
  } else {
    button.classList.remove("active");
    icon.classList.remove("fas", "fa-check-circle");
    icon.classList.add("fas", "fa-hammer");
    button.title = "Make A Project Master (Inactive)";
    button.innerHTML = '<i class="fas fa-hammer"></i> Make A Project Master';
    const projectsSection = document.getElementById("projectsSection");
    if (projectsSection && projectsSection.classList.contains("expanded")) {
      if (moveToProjectDropdown) {
        moveToProjectDropdown.style.display = "inline-block";
      }
    } else {
      if (moveToProjectDropdown) {
        moveToProjectDropdown.style.display = "none";
      }
    }
    projectsContent.classList.remove("project-list-active");
  }
  renderProjectItems();
}

function addProjectDragAndDropListeners(itemDiv) {
  itemDiv.addEventListener("dragstart", (e) => {
    draggedProjectItemData = projectItemsData.find(
      (item) => item.id === itemDiv.dataset.id,
    );
    if (!draggedProjectItemData) return;
    setTimeout(() => itemDiv.classList.add("dragging"), 0);
    e.dataTransfer.effectAllowed = "move";
  });
  itemDiv.addEventListener("dragend", () => {
    const el = document.querySelector(
      `[data-id="${draggedProjectItemData.id}"]`,
    );
    if (el) el.classList.remove("dragging");
    draggedProjectItemData = null;
    renderProjectItems();
  });
  itemDiv.addEventListener("dragover", (e) => {
    e.preventDefault();
    const bounding = itemDiv.getBoundingClientRect();
    const offset = e.clientY - bounding.top;

    document.querySelectorAll(".project-item").forEach((el) => {
      el.classList.remove("drag-over-top", "drag-over-bottom");
    });
    document.querySelectorAll(".status-items-container").forEach((el) => {
      el.classList.remove("drag-over");
    });
    document.querySelectorAll(".status-group-header").forEach((el) => {
      el.classList.remove("drag-over");
    });

    if (offset < bounding.height / 2) {
      itemDiv.classList.add("drag-over-top");
    } else {
      itemDiv.classList.add("drag-over-bottom");
    }
  });
  itemDiv.addEventListener("dragleave", () => {
    itemDiv.classList.remove("drag-over-top", "drag-over-bottom");
  });
  itemDiv.addEventListener("drop", (e) => {
    e.preventDefault();
    itemDiv.classList.remove("drag-over-top", "drag-over-bottom");

    if (!draggedProjectItemData) return;

    const targetItemId = itemDiv.dataset.id;
    const targetItemData = projectItemsData.find(
      (item) => item.id === targetItemId,
    );
    if (!targetItemData || draggedProjectItemData.id === targetItemId) {
      return;
    }

    handleProjectItemDrop(e, targetItemData.status, targetItemId);
  });
}

function addProjectItem(event) {
  if (event) event.stopPropagation();
  const newItem = {
    id: generateUniqueProjectId(),
    text: "",
    status: "ToDo",
    dueDate: "",
  };
  projectItemsData.unshift(newItem);
  if (!activeStatusesFilter.includes("ToDo")) {
    activeStatusesFilter.push("ToDo");
  }
  renderProjectItems();
  const newTextSpan = document.querySelector(
    `.project-item[data-id="${newItem.id}"] .project-item-text`,
  );
  if (newTextSpan) {
    editProjectItemTitle(
      {
        target: newTextSpan,
        stopPropagation: () => {},
      },
      newItem.id,
    );
  }
}

function deleteProjectItem(event, itemId) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  projectItemsData = projectItemsData.filter((item) => item.id !== itemId);
  renderProjectItems();
}

function changeProjectItemStatus(event, itemId) {
  event.stopPropagation();
  const newStatus = event.target.value;
  const itemIndex = projectItemsData.findIndex((item) => item.id === itemId);
  if (itemIndex !== -1) {
    const itemToChange = projectItemsData[itemIndex];
    const oldStatus = itemToChange.status;
    if (newStatus !== oldStatus) {
      let tempProjectItemsData = projectItemsData.filter(
        (item) => item.id !== itemId,
      );
      itemToChange.status = newStatus;
      let insertIndex = tempProjectItemsData.length;
      for (let i = 0; i < tempProjectItemsData.length; i++) {
        if (
          availableStatuses.findIndex(
            (s) => s.name === tempProjectItemsData[i].status,
          ) > availableStatuses.findIndex((s) => s.name === newStatus)
        ) {
          insertIndex = i;
          break;
        }
      }

      tempProjectItemsData.splice(insertIndex, 0, itemToChange);
      projectItemsData = tempProjectItemsData;
      renderProjectItems();
    }
  }
}

function editProjectItemTitle(event, itemId) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }

  const itemTextSpan = event.target;
  const originalText =
    itemTextSpan.textContent === "Title" ? "" : itemTextSpan.textContent;
  const itemDiv = itemTextSpan.closest(".project-item");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "project-item-text-input";
  input.value = originalText;
  input.placeholder = "Title";
  const saveButton = document.createElement("button");
  saveButton.className = "save-edit-btn";
  saveButton.innerHTML = '<i class="fas fa-save"></i>';
  saveButton.title = "Save";
  const saveAndRevert = () => {
    const newText = input.value.trim();
    if (newText === "") {
      deleteProjectItem(null, itemId);
    } else {
      const itemIndex = projectItemsData.findIndex(
        (item) => item.id === itemId,
      );
      if (itemIndex !== -1) {
        projectItemsData[itemIndex].text = newText;
      }
      renderProjectItems();
    }
  };

  input.addEventListener("blur", saveAndRevert);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      input.blur();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      saveAndRevert();
      const dueDateSpan = itemDiv.querySelector(".project-item-due-date");
      if (dueDateSpan) {
        editProjectItemDueDate(
          {
            target: dueDateSpan,
            stopPropagation: () => {},
          },
          itemId,
        );
      }
    }
  });
  saveButton.addEventListener("click", (e) => {
    e.stopPropagation();
    saveAndRevert();
  });

  itemDiv.replaceChild(input, itemTextSpan);
  itemDiv.insertBefore(saveButton, input.nextSibling);
  input.focus();
}

function editProjectItemDueDate(event, itemId) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }

  const dueDateSpan = event.target;
  const itemData = projectItemsData.find((item) => item.id === itemId);
  if (!itemData) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "project-item-due-date-input";
  input.value = itemData.dueDate;

  dueDateSpan.parentNode.replaceChild(input, dueDateSpan);
  const fp = flatpickr(input, {
    dateFormat: "Y-m-d",
    defaultDate: itemData.dueDate,
    onClose: function (selectedDates, dateStr, instance) {
      const newDueDate = dateStr;
      if (newDueDate !== itemData.dueDate) {
        itemData.dueDate = newDueDate;
        renderProjectItems();
      } else {
        renderProjectItems();
      }
    },
  });
  fp.open();
}

function moveToProject(event) {
  const selectedProject = event.target.value;
  const itemDiv = event.target.closest(".project-item");
  if (!itemDiv) {
    console.error(
      "moveToProject called from an element not inside a project item.",
    );
    event.target.value = "";
    return;
  }
  const itemId = itemDiv.dataset.id;
  if (selectedProject) {
    console.log(`Item ${itemId} moved to project: ${selectedProject}`);
    projectItemsData = projectItemsData.filter((item) => item.id !== itemId);
    renderProjectItems();
  }
  event.target.value = "";
}
