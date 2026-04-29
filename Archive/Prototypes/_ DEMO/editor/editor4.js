function toggleStatusFilterDropdown(event) {
  if (event) event.stopPropagation();
  const dropdownContainer = document.getElementById(
    "statusFilterDropdownContainer",
  );
  let dropdown = dropdownContainer.querySelector(".status-filter-dropdown");
  const filterButton = document.getElementById("statusFilterButton");
  let closeDropdownOutside = (e) => {
    if (!dropdown.contains(e.target) && e.target !== filterButton) {
      dropdown.remove();
      document.removeEventListener("click", closeDropdownOutside);
    }
  };

  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", closeDropdownOutside);
    return;
  }

  dropdown = document.createElement("div");
  dropdown.className = "status-filter-dropdown";

  availableStatuses.forEach((statusObj) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = statusObj.name;
    checkbox.checked = activeStatusesFilter.includes(statusObj.name);

    checkbox.onchange = (e) => {
      e.stopPropagation();
      const statusName = e.target.value;
      if (e.target.checked) {
        if (!activeStatusesFilter.includes(statusName)) {
          activeStatusesFilter.push(statusName);
        }
      } else {
        activeStatusesFilter = activeStatusesFilter.filter(
          (s) => s !== statusName,
        );
      }
      renderProjectItems();
    };

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(statusObj.name));
    dropdown.appendChild(label);
  });
  dropdownContainer.appendChild(dropdown);

  const buttonRect = filterButton.getBoundingClientRect();
  dropdown.style.left = `${buttonRect.left}px`;
  dropdown.style.top = `${buttonRect.bottom + 5}px`;
  dropdown.style.display = "block";
  document.addEventListener("click", closeDropdownOutside);
}

/* --- People Functions --- */

function generateUniquePersonId() {
  return "person-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

function renderPeopleItems() {
  const peopleContent = document.getElementById("peopleContent");
  if (!peopleContent) return;
  peopleContent.innerHTML = "";

  peopleContent.classList.add("people-list-active");

  const sortedPeopleItems = [...peopleItemsData].sort((a, b) => {
    const roleAIndex = availableRoles.findIndex((r) => r.name === a.role);
    const roleBIndex = availableRoles.findIndex((r) => r.name === b.role);
    if (roleAIndex !== roleBIndex) {
      return roleAIndex - roleBIndex;
    }
    return 0;
  });
  availableRoles.forEach((roleObj) => {
    const roleName = roleObj.name;
    const roleIconClass = roleObj.icon;
    const itemsInThisRole = sortedPeopleItems.filter(
      (item) => item.role === roleName,
    );

    if (activeRolesFilter.includes(roleName)) {
      if (itemsInThisRole.length === 0) {
        // Do not render header if no items in role and not configured for empty header
        // No empty role icon header logic here, as per user's request to remove emptyAlertIconsContainer
      } else if (itemsInThisRole.length > 0) {
        const roleHeaderDiv = document.createElement("div");
        roleHeaderDiv.className = "status-group-header";
        roleHeaderDiv.dataset.role = roleName;
        roleHeaderDiv.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (draggedPeopleItemData) {
            roleHeaderDiv.classList.add("drag-over");
          }
        });
        roleHeaderDiv.addEventListener("dragleave", () => {
          roleHeaderDiv.classList.remove("drag-over");
        });
        roleHeaderDiv.addEventListener("drop", (e) => {
          e.preventDefault();
          roleHeaderDiv.classList.remove("drag-over");
          if (draggedPeopleItemData) {
            handlePeopleItemDrop(e, roleHeaderDiv.dataset.role, null);
          }
        });
        roleHeaderDiv.innerHTML = `
                            <span class="status-title">
                                <i class="${roleIconClass} status-icon"></i>
                                ${roleName}
                            </span>
                            `;
        peopleContent.appendChild(roleHeaderDiv);

        const roleItemsContainer = document.createElement("div");
        roleItemsContainer.className = "status-items-container";
        roleItemsContainer.dataset.role = roleName;
        roleItemsContainer.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (draggedPeopleItemData) {
            roleItemsContainer.classList.add("drag-over");
          }
        });
        roleItemsContainer.addEventListener("dragleave", () => {
          roleItemsContainer.classList.remove("drag-over");
        });
        roleItemsContainer.addEventListener("drop", (e) => {
          e.preventDefault();
          roleItemsContainer.classList.remove("drag-over");
          if (draggedPeopleItemData) {
            handlePeopleItemDrop(e, roleItemsContainer.dataset.role, null);
          }
        });
        peopleContent.appendChild(roleItemsContainer);

        itemsInThisRole.forEach((itemData) => {
          const itemDiv = document.createElement("div");
          itemDiv.className = "project-item";
          itemDiv.draggable = true;
          itemDiv.dataset.id = itemData.id;
          itemDiv.dataset.role = itemData.role;

          itemDiv.addEventListener("dblclick", () => {
            console.log(`Double-clicked person: ${itemData.text}`);
          });

          const dragHandleSpan = document.createElement("span");
          dragHandleSpan.className = "drag-handle-item";
          dragHandleSpan.innerHTML = '<i class="fas fa-grip-lines"></i>';

          const textSpan = document.createElement("span");
          textSpan.className = "project-item-text";
          if (itemData.text === "") {
            textSpan.textContent = "New Person";
            textSpan.classList.add("ghost-text");
          } else {
            textSpan.textContent = itemData.text;
          }
          textSpan.title = itemData.text;
          textSpan.onclick = (e) => editPersonItemName(e, itemData.id);
          const roleDropdown = document.createElement("select");
          roleDropdown.className = "person-item-role-dropdown";
          roleDropdown.onchange = (e) => changePersonItemRole(e, itemData.id);

          const c3xxxOption = document.createElement("option");
          c3xxxOption.value = "";
          c3xxxOption.textContent = "👨 → Role";
          c3xxxOption.selected = true;
          c3xxxOption.disabled = true;
          c3xxxOption.hidden = false;
          roleDropdown.appendChild(c3xxxOption);
          availableRoles.forEach((r) => {
            const option = document.createElement("option");
            option.value = r.name;
            option.textContent = r.name;
            roleDropdown.appendChild(option);
          });
          roleDropdown.addEventListener("focus", () => {
            c3xxxOption.hidden = true;
          });
          roleDropdown.addEventListener("blur", () => {
            c3xxxOption.hidden = false;
          });
          const itemActionsDiv = document.createElement("div");
          itemActionsDiv.className = "item-actions";

          const deleteButton = document.createElement("button");
          deleteButton.className = "delete-item-btn";
          deleteButton.onclick = (e) => deletePersonItem(e, itemData.id);
          deleteButton.title = "Delete";
          deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';

          itemActionsDiv.appendChild(deleteButton);

          itemDiv.appendChild(dragHandleSpan);
          itemDiv.appendChild(textSpan);
          itemDiv.appendChild(roleDropdown);
          itemDiv.appendChild(itemActionsDiv);

          roleItemsContainer.appendChild(itemDiv);
          addPeopleDragAndDropListeners(itemDiv);
        });
      }
    }
  });

  const peopleSection = document.getElementById("peopleSection");
  if (peopleSection && peopleSection.classList.contains("expanded")) {
    peopleSection.style.height =
      peopleContent.scrollHeight +
      peopleSection.querySelector(".zone-header").offsetHeight +
      "px";
  }
}

function addPeopleDragAndDropListeners(itemDiv) {
  itemDiv.addEventListener("dragstart", (e) => {
    draggedPeopleItemData = peopleItemsData.find(
      (item) => item.id === itemDiv.dataset.id,
    );
    if (!draggedPeopleItemData) return;
    setTimeout(() => itemDiv.classList.add("dragging"), 0);
    e.dataTransfer.effectAllowed = "move";
  });
  itemDiv.addEventListener("dragend", () => {
    const el = document.querySelector(
      `[data-id="${draggedPeopleItemData.id}"]`,
    );
    if (el) el.classList.remove("dragging");
    draggedPeopleItemData = null;
    renderPeopleItems();
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

    if (!draggedPeopleItemData) return;

    const targetItemId = itemDiv.dataset.id;
    const targetItemData = peopleItemsData.find(
      (item) => item.id === targetItemId,
    );
    if (!targetItemData || draggedPeopleItemData.id === targetItemId) {
      return;
    }

    handlePeopleItemDrop(e, targetItemData.role, targetItemId);
  });
}

function handlePeopleItemDrop(e, targetRole, targetItemId) {
  if (!draggedPeopleItemData) return;

  let tempPeopleItemsData = peopleItemsData.filter(
    (item) => item.id !== draggedPeopleItemData.id,
  );
  let newIndex;

  if (targetItemId) {
    const targetItemData = peopleItemsData.find(
      (item) => item.id === targetItemId,
    );
    if (!targetItemData) return;

    const actualTargetIndexInTemp = tempPeopleItemsData.findIndex(
      (item) => item.id === targetItemId,
    );
    if (actualTargetIndexInTemp !== -1) {
      const bounding = e.currentTarget.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset < bounding.height / 2) {
        newIndex = actualTargetIndexInTemp;
      } else {
        newIndex = actualTargetIndexInTemp + 1;
      }
    } else {
      const itemsInTargetRole = tempPeopleItemsData.filter(
        (item) => item.role === targetRole,
      );
      if (itemsInTargetRole.length > 0) {
        const lastItemInTargetRole =
          itemsInTargetRole[itemsInTargetRole.length - 1];
        newIndex = tempPeopleItemsData.indexOf(lastItemInTargetRole) + 1;
      } else {
        const roleIndex = availableRoles.findIndex(
          (r) => r.name === targetRole,
        );
        let calculatedIndex = 0;
        for (let i = 0; i < roleIndex; i++) {
          calculatedIndex += tempPeopleItemsData.filter(
            (item) => item.role === availableRoles[i].name,
          ).length;
        }
        newIndex = calculatedIndex;
      }
    }
  } else {
    const itemsInTargetRole = tempPeopleItemsData.filter(
      (item) => item.role === targetRole,
    );
    if (itemsInTargetRole.length > 0) {
      const lastItemInTargetRole =
        itemsInTargetRole[itemsInTargetRole.length - 1]; // Corrected from itemsInTargetData
      newIndex = tempPeopleItemsData.indexOf(lastItemInTargetRole) + 1;
    } else {
      const roleIndex = availableRoles.findIndex((r) => r.name === targetRole);
      let calculatedIndex = 0;
      for (let i = 0; i < roleIndex; i++) {
        calculatedIndex += tempPeopleItemsData.filter(
          (item) => item.role === availableRoles[i].name,
        ).length;
      }
      newIndex = calculatedIndex;
    }
  }

  if (newIndex < 0) newIndex = 0;
  if (newIndex > tempPeopleItemsData.length)
    newIndex = tempPeopleItemsData.length;

  draggedPeopleItemData.role = targetRole;
  tempPeopleItemsData.splice(newIndex, 0, draggedPeopleItemData);

  peopleItemsData = tempPeopleItemsData;
  renderPeopleItems();
}

function addPersonItem(event, roleName = "Guests") {
  if (event) event.stopPropagation();
  const newItem = {
    id: generateUniquePersonId(),
    text: "",
    role: roleName,
  };
  peopleItemsData.unshift(newItem);
  if (!activeRolesFilter.includes(roleName)) {
    activeRolesFilter.push(roleName);
  }
  renderPeopleItems();
  const newTextSpan = document.querySelector(
    `.project-item[data-id="${newItem.id}"] .project-item-text`,
  );
  if (newTextSpan) {
    editPersonItemName(
      {
        target: newTextSpan,
        stopPropagation: () => {},
      },
      newItem.id,
    );
  }
}

function addPersonItemWithRole(roleName) {
  addPersonItem(null, roleName);
}

function deletePersonItem(event, itemId) {
  if (event) {
    event.stopPropagation();
  }
  peopleItemsData = peopleItemsData.filter((item) => item.id !== itemId);
  renderPeopleItems();
}

function changePersonItemRole(event, itemId) {
  event.stopPropagation();
  const newRole = event.target.value;
  const itemIndex = peopleItemsData.findIndex((item) => item.id === itemId);
  if (itemIndex !== -1) {
    const itemToChange = peopleItemsData[itemIndex];
    const oldRole = itemToChange.role;
    if (newRole !== oldRole) {
      let tempPeopleItemsData = peopleItemsData.filter(
        (item) => item.id !== itemId,
      );
      itemToChange.role = newRole;

      let insertIndex = tempPeopleItemsData.length;
      for (let i = 0; i < tempPeopleItemsData.length; i++) {
        if (
          availableRoles.findIndex(
            (r) => r.name === tempPeopleItemsData[i].role,
          ) > availableRoles.findIndex((r) => r.name === newRole)
        ) {
          insertIndex = i;
          break;
        }
      }

      tempPeopleItemsData.splice(insertIndex, 0, itemToChange);
      peopleItemsData = tempPeopleItemsData;
      renderPeopleItems();
    }
  }
}

function editPersonItemName(event, itemId) {
  if (event) {
    event.stopPropagation();
  }

  const itemTextSpan = event.target;
  const originalText =
    itemTextSpan.textContent === "New Person" ? "" : itemTextSpan.textContent;
  const itemDiv = itemTextSpan.closest(".project-item");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "project-item-text-input";
  input.value = originalText;
  input.placeholder = "Person Name";

  const saveButton = document.createElement("button");
  saveButton.className = "save-edit-btn";
  saveButton.innerHTML = '<i class="fas fa-save"></i>';
  saveButton.title = "Save";
  const saveAndRevert = () => {
    const newText = input.value.trim();
    if (newText === "") {
      deletePersonItem(null, itemId);
    } else {
      const itemIndex = peopleItemsData.findIndex((item) => item.id === itemId);
      if (itemIndex !== -1) {
        peopleItemsData[itemIndex].text = newText;
      }
      renderPeopleItems();
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

function toggleRoleFilterDropdown(event) {
  if (event) event.stopPropagation();
  const dropdownContainer = document.getElementById(
    "roleFilterDropdownContainer",
  );
  let dropdown = dropdownContainer.querySelector(".role-filter-dropdown");
  const filterButton = document.getElementById("roleFilterButton");

  let closeRoleDropdownOutside = (e) => {
    if (!dropdown.contains(e.target) && e.target !== filterButton) {
      dropdown.remove();
      document.removeEventListener("click", closeRoleDropdownOutside);
    }
  };

  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", closeRoleDropdownOutside);
    return;
  }

  dropdown = document.createElement("div");
  dropdown.className = "role-filter-dropdown status-filter-dropdown";

  availableRoles.forEach((roleObj) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = roleObj.name;
    checkbox.checked = activeRolesFilter.includes(roleObj.name);

    checkbox.onchange = (e) => {
      e.stopPropagation();
      const roleName = e.target.value;
      if (e.target.checked) {
        if (!activeRolesFilter.includes(roleName)) {
          activeRolesFilter.push(roleName);
        }
      } else {
        activeRolesFilter = activeRolesFilter.filter((r) => r !== roleName);
      }
      renderPeopleItems();
    };

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(roleObj.name));
    dropdown.appendChild(label);
  });
  dropdownContainer.appendChild(dropdown);

  const buttonRect = filterButton.getBoundingClientRect();
  dropdown.style.left = `${buttonRect.left}px`;
  dropdown.style.top = `${buttonRect.bottom + 5}px`;
  dropdown.style.display = "block";
  document.addEventListener("click", closeRoleDropdownOutside);
}

/* --- Alerts Functions --- */

function renderAlertItems() {
  const alertsContent = document.getElementById("alertsContent");
  if (!alertsContent) {
    console.error("alertsContent element not found.");
    return;
  }

  // Clear existing content within containers for each type
  alertsContent.innerHTML = ""; // Clear all content, will re-add headers and items

  const alarmsContainer = document.createElement("div");
  alarmsContainer.className = "alert-type-container";
  alarmsContainer.id = "alarms-container";
  alertsContent.appendChild(alarmsContainer);

  const timersContainer = document.createElement("div");
  timersContainer.className = "alert-type-container";
  timersContainer.id = "timers-container";
  alertsContent.appendChild(timersContainer);

  const stopwatchesContainer = document.createElement("div");
  stopwatchesContainer.className = "alert-type-container";
  stopwatchesContainer.id = "stopwatches-container";
  alertsContent.appendChild(stopwatchesContainer);

  const notificationsContainer = document.createElement("div");
  notificationsContainer.className = "alert-type-container";
  notificationsContainer.id = "notifications-container";
  alertsContent.appendChild(notificationsContainer);

  const eventsContainer = document.createElement("div");
  eventsContainer.className = "alert-type-container";
  eventsContainer.id = "events-container";
  alertsContent.appendChild(eventsContainer);

  // Combine all alert data for sorting and rendering
  const allAlertsData = [
    ...alertsItemsData, // Generic alerts and reminders
    ...alarms.map((alarm) => ({ ...alarm, type: "Alarms" })),
    ...timers.map((timer) => ({ ...timer, type: "Timers" })),
    ...stopwatches.map((stopwatch) => ({
      ...stopwatch,
      type: "Stopwatches",
    })),
    ...notifications.map((notification) => ({
      ...notification,
      type: "Notifications",
    })), // Include notifications
  ];

  const sortedAlertItems = [...allAlertsData].sort((a, b) => {
    const typeAIndex = availableAlertTypes.findIndex((t) => t.name === a.type);
    const typeBIndex = availableAlertTypes.findIndex((t) => t.name === b.type);
    if (typeAIndex !== typeBIndex) return typeAIndex - typeBIndex;
    return 0;
  });

  availableAlertTypes.forEach((typeObj) => {
    const typeName = typeObj.name;
    const typeIconClass = typeObj.icon;
    const itemsInThisType = sortedAlertItems.filter(
      (item) => item.type === typeName,
    );

    let targetContainer;
    switch (typeName) {
      case "Alarms":
        targetContainer = alarmsContainer;
        break;
      case "Timers":
        targetContainer = timersContainer;
        break;
      case "Stopwatches":
        targetContainer = stopwatchesContainer;
        break;
      case "Notifications":
        targetContainer = notificationsContainer;
        break;
      case "Events":
        targetContainer = eventsContainer;
        break;
      default:
        return; // Should not happen
    }

    if (activeAlertTypesFilter.includes(typeName)) {
      if (itemsInThisType.length > 0) {
        const typeHeaderDiv = document.createElement("div");
        typeHeaderDiv.className = "status-group-header";
        typeHeaderDiv.dataset.type = typeName;
        typeHeaderDiv.innerHTML = `
                                    <span class="status-title">
                                        <i class="${typeIconClass} status-icon"></i>
                                        ${typeName}
                                    </span>
                            `;
        targetContainer.appendChild(typeHeaderDiv);

        const typeItemsSubContainer = document.createElement("div"); // Use a sub-container for items within each type
        typeItemsSubContainer.className = "status-items-container";
        typeItemsSubContainer.dataset.type = typeName;
        targetContainer.appendChild(typeItemsSubContainer);

        itemsInThisType.forEach((itemData) => {
          if (itemData.type === "Alarms") {
            addAlarmItemToDOM(itemData, typeItemsSubContainer);
          } else if (itemData.type === "Timers") {
            addTimerItemToDOM(itemData, typeItemsSubContainer);
          } else if (itemData.type === "Stopwatches") {
            addStopwatchItemToDOM(itemData, typeItemsSubContainer);
          } else if (itemData.type === "Notifications") {
            addNotificationItemToDOM(itemData, typeItemsSubContainer);
          } else {
            addGenericAlertItemToDOM(itemData, typeItemsSubContainer);
          }
        });
      }
    }
  });

  const alertsSection = document.getElementById("alertsSection");
  if (alertsSection && alertsSection.classList.contains("expanded")) {
    alertsSection.style.height =
      alertsContent.scrollHeight +
      alertsSection.querySelector(".zone-header").offsetHeight +
      "px";
  }
}

// Function to render checklist items (used by loadChitData and resetEditorForNewChit)
function renderChecklist() {
  manageGhostsAndSortLists();
}

// Function to render alarms (used by loadChitData and resetEditorForNewChit)
function renderAlarms() {
  const alarmsContainer = document.getElementById("alarms-container");
  if (alarmsContainer) {
    // Clear only alarm-specific items, not the header if it exists
    Array.from(alarmsContainer.children).forEach((child) => {
      if (!child.classList.contains("status-group-header")) {
        child.remove();
      }
    });
    alarms.forEach((alarm) => addAlarmItemToDOM(alarm, alarmsContainer));
  }
}

// Function to render timers (used by loadChitData and resetEditorForNewChit)
function renderTimers() {
  const timersContainer = document.getElementById("timers-container");
  if (timersContainer) {
    // Clear only timer-specific items, not the header if it exists
    Array.from(timersContainer.children).forEach((child) => {
      if (!child.classList.contains("status-group-header")) {
        child.remove();
      }
    });
    timers.forEach((timer) => addTimerItemToDOM(timer, timersContainer));
  }
}

// Function to render stopwatches (used by loadChitData and resetEditorForNewChit)
function renderStopwatches() {
  const stopwatchesContainer = document.getElementById("stopwatches-container");
  if (stopwatchesContainer) {
    // Clear only stopwatch-specific items, not the header if it exists
    Array.from(stopwatchesContainer.children).forEach((child) => {
      if (!child.classList.contains("status-group-header")) {
        child.remove();
      }
    });
    stopwatches.forEach((stopwatch) =>
      addStopwatchItemToDOM(stopwatch, stopwatchesContainer),
    );
  }
}

// Function to render notifications (used by loadChitData and resetEditorForNewChit)
function renderNotifications() {
  const notificationsContainer = document.getElementById(
    "notifications-container",
  );
  if (notificationsContainer) {
    // Clear only notification-specific items, not the header if it exists
    Array.from(notificationsContainer.children).forEach((child) => {
      if (!child.classList.contains("status-group-header")) {
        child.remove();
      }
    });
    notifications.forEach((notification) =>
      addNotificationItemToDOM(notification, notificationsContainer),
    );
  }
}

function addGenericAlertItemToDOM(itemData, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "project-item"; // Reusing project-item class for styling consistency
  itemDiv.draggable = true;
  itemDiv.dataset.id = itemData.id;
  itemDiv.dataset.type = itemData.type;

  const dragHandleSpan = document.createElement("span");
  dragHandleSpan.className = "drag-handle-item";
  dragHandleSpan.innerHTML = '<i class="fas fa-grip-lines"></i>';

  const textSpan = document.createElement("span");
  textSpan.className = "project-item-text";
  if (itemData.text === "") {
    textSpan.textContent = "New Alert";
    textSpan.classList.add("ghost-text");
  } else {
    textSpan.textContent = itemData.text;
  }
  textSpan.title = itemData.text;
  textSpan.onclick = (e) => editAlertItemName(e, itemData.id);

  const typeDropdown = document.createElement("select");
  typeDropdown.className = "alert-item-type-dropdown";
  typeDropdown.onchange = (e) => changeAlertItemType(e, itemData.id);

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "🔔 → Type";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  defaultOption.hidden = false;
  typeDropdown.appendChild(defaultOption);
  availableAlertTypes.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.name;
    option.textContent = t.name;
    if (t.name === itemData.type) {
      option.selected = true;
      defaultOption.hidden = true; // Hide "🔔 → Type" if a type is already selected
    }
    typeDropdown.appendChild(option);
  });
  typeDropdown.addEventListener("focus", () => {
    defaultOption.hidden = true;
  });
  typeDropdown.addEventListener("blur", () => {
    if (!typeDropdown.value) {
      // If no option is selected after blur, show default
      defaultOption.hidden = false;
    }
  });

  const itemActionsDiv = document.createElement("div");
  itemActionsDiv.className = "item-actions";

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-item-btn";
  deleteButton.onclick = (e) => deleteAlertItem(e, itemData.id);
  deleteButton.title = "Delete";
  deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';

  itemActionsDiv.appendChild(deleteButton);

  itemDiv.appendChild(dragHandleSpan);
  itemDiv.appendChild(textSpan);
  itemDiv.appendChild(typeDropdown);
  itemDiv.appendChild(itemActionsDiv);

  container.appendChild(itemDiv);
  addAlertDragAndDropListeners(itemDiv);
}

// New function to add a notification item to the DOM
function addNotificationItemToDOM(notificationData, container) {
  const itemDiv = document.createElement("div");
  // Check if the notification should be disabled due to missing dates
  const startDatetime = document.getElementById("start_datetime").value;
  const dueDatetime = document.getElementById("dueDate").value; // Changed to dueDate
  let isDisabled = false;
  let disableReason = "";

  if (notificationData.relativeTo === "due_date" && !dueDatetime) {
    isDisabled = true;
    disableReason = "No Due Date set for this Chit.";
  } else if (notificationData.relativeTo === "start_date" && !startDatetime) {
    isDisabled = true;
    disableReason = "No Start Date set for this Chit.";
  } else if (!startDatetime && !dueDatetime) {
    // If neither date is set, disable regardless of relativeTo setting
    isDisabled = true;
    disableReason = "No Start or Due Date set for this Chit.";
  }

  itemDiv.className = `project-item notification-item ${isDisabled ? "disabled" : ""}`;
  itemDiv.draggable = true;
  itemDiv.dataset.id = notificationData.id;
  itemDiv.dataset.type = "Notifications";
  if (isDisabled) {
    itemDiv.title = `Notification disabled: ${disableReason}`;
  }

  const relativeToText =
    notificationData.relativeTo === "due_date" ? "Due Date" : "Start Date";

  itemDiv.innerHTML = `
                    <span class="drag-handle-item"><i class="fas fa-grip-lines"></i></span>
                    <div class="notification-info-left">
                        <span class="notification-time-display">${notificationData.value} ${notificationData.unit} before ${relativeToText}</span>
                        <span class="notification-name-display">${notificationData.name || "Unnamed Notification"}</span>
                    </div>
                    <div class="item-actions">
                        <button class="edit-item-btn" onclick="openNotificationModal(event, '${notificationData.id}')" title="Edit Notification">✏️</button>
                        <button class="toggle-notification-btn" onclick="toggleNotification(event, '${notificationData.id}')" title="${notificationData.enabled && !isDisabled ? "Disable Notification" : "Enable Notification"}">
                            ${notificationData.enabled && !isDisabled ? "Disable" : "Enable"}
                        </button>
                        <button class="trigger-notification-btn" onclick="triggerNotificationManual(event, '${notificationData.id}')" title="Trigger Now">
                            ⚡
                        </button>
                        <button class="delete-item-btn" onclick="deleteNotification(event, '${notificationData.id}')" title="Delete Notification">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

  container.appendChild(itemDiv);
  addAlertDragAndDropListeners(itemDiv);
}

function addAlarmItemToDOM(alarmData, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = `project-item alarm-item ${alarmData.enabled ? "" : "disabled"}`;
  itemDiv.draggable = true;
  itemDiv.dataset.id = alarmData.id;
  itemDiv.dataset.type = "Alarms";

  itemDiv.innerHTML = `
                    <span class="drag-handle-item"><i class="fas fa-grip-lines"></i></span>
                    <div class="alarm-info-left">
                        <span class="alarm-time-display">${alarmData.time}</span>
                        <span class="alarm-name-display">${alarmData.name || "Unnamed Alarm"}</span>
                    </div>
                    <span class="alarm-recurrence-display">${alarmData.recurrence !== "none" ? alarmData.recurrence : ""}</span>
                    <div class="item-actions">
                        <button class="edit-item-btn" onclick="editAlarm(event, '${alarmData.id}')" title="Edit Alarm">✏️</button>
                        <button class="toggle-alarm-btn" onclick="toggleAlarm(event, '${alarmData.id}')" title="${alarmData.enabled ? "Disable Alarm" : "Enable Alarm"}">
                            ${alarmData.enabled ? "Disable" : "Enable"}
                        </button>
                        <button class="delete-item-btn" onclick="deleteAlarm(event, '${alarmData.id}')" title="Delete Alarm">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

  container.appendChild(itemDiv);
  addAlertDragAndDropListeners(itemDiv);
}

function addTimerItemToDOM(timerData, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = `project-item timer-item ${timerData.running ? "" : "paused"}`;
  itemDiv.draggable = true;
  itemDiv.dataset.id = timerData.id;
  itemDiv.dataset.type = "Timers";

  const hours = Math.floor(timerData.time / 3600000);
  const minutes = Math.floor((timerData.time % 3600000) / 60000);
  const seconds = Math.floor((timerData.time % 60000) / 1000);

  itemDiv.innerHTML = `
                    <span class="drag-handle-item"><i class="fas fa-grip-lines"></i></span>
                    <div class="timer-info-left">
                        <span class="timer-time-display">${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}</span>
                        <span class="timer-name-display">${timerData.name || "Unnamed Timer"}</span>
                    </div>
                    <span class="timer-loop-display">${timerData.loop ? "Loop" : ""}</span>
                    <div class="item-actions">
                        <button class="edit-item-btn" onclick="editTimer(event, '${timerData.id}')" title="Edit Timer">✏️</button>
                        <button class="toggle-timer-btn" onclick="toggleTimer(event, '${timerData.id}')" title="${timerData.running ? "Pause Timer" : "Start Timer"}">
                            ${timerData.running ? "⏸️" : "▶️"}
                        </button>
                        <button class="reset-timer-btn" onclick="resetTimer(event, '${timerData.id}')" title="Reset Timer">🔄</button>
                        <button class="delete-item-btn" onclick="deleteTimer(event, '${timerData.id}')" title="Delete Timer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

  container.appendChild(itemDiv);
  addAlertDragAndDropListeners(itemDiv);
}

function addStopwatchItemToDOM(stopwatchData, container) {
  const itemDiv = document.createElement("div");
  itemDiv.className = `project-item stopwatch-item ${stopwatchData.running ? "" : "paused"}`;
  itemDiv.draggable = true;
  itemDiv.dataset.id = stopwatchData.id;
  itemDiv.dataset.type = "Stopwatches";

  const hours = Math.floor(stopwatchData.time / 3600000);
  const minutes = Math.floor((stopwatchData.time % 3600000) / 60000);
  const seconds = Math.floor((stopwatchData.time % 60000) / 1000);
  const centis = Math.floor((stopwatchData.time % 1000) / 10);

  itemDiv.innerHTML = `
                    <span class="drag-handle-item"><i class="fas fa-grip-lines"></i></span>
                    <div class="stopwatch-info-left">
                        <span class="stopwatch-time-display">${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}</span>
                        <span class="stopwatch-name-display">${stopwatchData.name || "Unnamed Stopwatch"}</span>
                    </div>
                    <div class="item-actions">
                        <button class="edit-item-btn" onclick="openStopwatchModal(event, '${stopwatchData.id}')" title="Edit Stopwatch">✏️</button>
                        <button class="toggle-stopwatch-btn" onclick="toggleStopwatch(event, '${stopwatchData.id}')" title="${stopwatchData.running ? "Pause Stopwatch" : "Start Stopwatch"}">
                            ${stopwatchData.running ? "⏸️" : "▶️"}
                        </button>
                        <button class="lap-stopwatch-btn" onclick="lapStopwatch(event, '${stopwatchData.id}')" title="Lap Stopwatch">🏁</button>
                        <button class="reset-stopwatch-btn" onclick="resetStopwatch(event, '${stopwatchData.id}')" title="Reset Stopwatch">🔄</button>
                        <button class="delete-item-btn" onclick="deleteStopwatch(event, '${stopwatchData.id}')" title="Delete Stopwatch">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;

  container.appendChild(itemDiv);
  addAlertDragAndDropListeners(itemDiv);
}

function generateUniqueAlertId() {
  return "alert-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

function editAlertItemName(event, itemId) {
  if (event) {
    event.stopPropagation();
  }

  const itemTextSpan = event.target;
  const originalText =
    itemTextSpan.textContent === "New Alert" ? "" : itemTextSpan.textContent;
  const itemDiv = itemTextSpan.closest(".project-item");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "project-item-text-input";
  input.value = originalText;
  input.placeholder = "Alert Name";

  const saveButton = document.createElement("button");
  saveButton.className = "save-edit-btn";
  saveButton.innerHTML = '<i class="fas fa-save"></i>';
  saveButton.title = "Save";
  const saveAndRevert = () => {
    const newText = input.value.trim();
    if (newText === "") {
      // If the text is empty, delete the alert item
      // This applies to generic alerts, not time-based notifications/alarms/timers
      const item = alertsItemsData.find((item) => item.id === itemId);
      if (
        item &&
        item.type !== "Notifications" &&
        item.type !== "Alarms" &&
        item.type !== "Timers" &&
        item.type !== "Stopwatches"
      ) {
        deleteAlertItem(null, itemId);
      } else {
        // For notifications, alarms, timers, stopwatches, just reset to original text if empty
        // Or handle an empty name as "Unnamed [Type]"
        if (item) item.text = newText; // Update the text
        renderAlertItems();
      }
    } else {
      const itemIndex = alertsItemsData.findIndex((item) => item.id === itemId);
      if (itemIndex !== -1) {
        alertsItemsData[itemIndex].text = newText;
      }
      renderAlertItems();
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
