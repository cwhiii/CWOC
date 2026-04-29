function changeAlertItemType(event, itemId) {
  event.stopPropagation();
  const newType = event.target.value;
  // Find the item in any of the alert arrays
  let itemToChange = alertsItemsData.find((item) => item.id === itemId);
  let sourceArray = alertsItemsData;
  if (!itemToChange) {
    itemToChange = alarms.find((item) => item.id === itemId);
    if (itemToChange) sourceArray = alarms;
  }
  if (!itemToChange) {
    itemToChange = timers.find((item) => item.id === itemId);
    if (itemToChange) sourceArray = timers;
  }
  if (!itemToChange) {
    itemToChange = stopwatches.find((item) => item.id === itemId);
    if (itemToChange) sourceArray = stopwatches;
  }
  if (!itemToChange) {
    itemToChange = notifications.find((item) => item.id === itemId);
    if (itemToChange) sourceArray = notifications;
  }

  if (!itemToChange) return;

  const oldType = itemToChange.type;
  if (newType !== oldType) {
    // Remove from old array
    if (sourceArray === alarms) {
      alarms = alarms.filter((item) => item.id !== itemId);
      // No localStorage.setItem("alarms", JSON.stringify(alarms));
    } else if (sourceArray === timers) {
      clearInterval(itemToChange.interval); // Clear interval for timers
      timers = timers.filter((item) => item.id !== itemId);
      // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
    } else if (sourceArray === stopwatches) {
      clearInterval(itemToChange.interval); // Clear interval for stopwatches
      stopwatches = stopwatches.filter((item) => item.id !== itemId);
      // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
    } else if (sourceArray === notifications) {
      notifications = notifications.filter((item) => item.id !== itemId);
      // No localStorage.setItem("notifications", JSON.stringify(notifications));
    } else {
      // Generic alertsItemsData
      alertsItemsData = alertsItemsData.filter((item) => item.id !== itemId);
      // No localStorage.setItem("alertsItemsData", JSON.stringify(alertsItemsData));
    }

    // Create a new item with default properties for the new type
    let newItem;
    if (newType === "Alarms") {
      newItem = {
        id: generateUniqueAlarmId(),
        name: itemToChange.name || itemToChange.text || "Unnamed Alarm",
        time: "00:00",
        recurrence: "none",
        sound: "chime",
        days: [],
        enabled: true,
        triggeredAtMinute: false,
      };
      alarms.push(newItem);
      // No localStorage.setItem("alarms", JSON.stringify(alarms));
    } else if (newType === "Timers") {
      newItem = {
        id: generateUniqueTimerId(),
        name: itemToChange.name || itemToChange.text || "Unnamed Timer",
        time: 0,
        initialTime: 0,
        running: false,
        loop: false,
        sound: "timer",
        startTime: null,
        interval: null,
      };
      timers.push(newItem);
      // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
    } else if (newType === "Stopwatches") {
      newItem = {
        id: generateUniqueStopwatchId(),
        name: itemToChange.name || itemToChange.text || "Unnamed Stopwatch",
        time: 0,
        running: false,
        laps: [],
        startTime: null,
        interval: null,
      };
      stopwatches.push(newItem);
      // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
    } else if (newType === "Notifications") {
      newItem = {
        id: generateUniqueNotificationId(), // Use new notification ID generator
        name: itemToChange.name || itemToChange.text || "Unnamed Notification",
        value: 5, // Default value
        unit: "minutes", // Default unit
        relativeTo: "due_date", // Default to due date
        enabled: true,
        triggeredAtMinute: false,
      };
      notifications.push(newItem);
      // No localStorage.setItem("notifications", JSON.stringify(notifications));
    } else {
      // For other generic types, just update the type
      newItem = {
        ...itemToChange,
        type: newType,
      };
      alertsItemsData.push(newItem);
      // No localStorage.setItem("alertsItemsData", JSON.stringify(alertsItemsData));
    }

    renderAlertItems();
  }
}

function addAlertDragAndDropListeners(itemDiv) {
  itemDiv.addEventListener("dragstart", (e) => {
    const itemId = itemDiv.dataset.id;
    const itemType = itemDiv.dataset.type;

    if (itemType === "Alarms") {
      draggedAlertItemData = alarms.find((item) => item.id === itemId);
    } else if (itemType === "Timers") {
      draggedAlertItemData = timers.find((item) => item.id === itemId);
    } else if (itemType === "Stopwatches") {
      draggedAlertItemData = stopwatches.find((item) => item.id === itemId);
    } else if (itemType === "Notifications") {
      draggedAlertItemData = notifications.find((item) => item.id === itemId);
    } else {
      draggedAlertItemData = alertsItemsData.find((item) => item.id === itemId);
    }

    if (!draggedAlertItemData) return;

    setTimeout(() => itemDiv.classList.add("dragging"), 0);
    e.dataTransfer.effectAllowed = "move";
  });
  itemDiv.addEventListener("dragend", () => {
    const el = document.querySelector(`[data-id="${draggedAlertItemData.id}"]`);
    if (el) el.classList.remove("dragging");

    draggedAlertItemData = null;
    renderAlertItems();
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

    if (!draggedAlertItemData) return;

    const targetItemId = itemDiv.dataset.id;
    // Find target item across all alert data arrays
    const targetItemIsAlarm = alarms.find((item) => item.id === targetItemId);
    const targetItemIsTimer = timers.find((item) => item.id === targetItemId);
    const targetItemIsStopwatch = stopwatches.find(
      (item) => item.id === targetItemId,
    );
    const targetItemIsNotification = notifications.find(
      (item) => item.id === targetItemId,
    );
    const targetItemIsAlert = alertsItemsData.find(
      (item) => item.id === targetItemId,
    );
    let targetData =
      targetItemIsAlarm ||
      targetItemIsTimer ||
      targetItemIsStopwatch ||
      targetItemIsNotification ||
      targetItemIsAlert;

    if (!targetData || draggedAlertItemData.id === targetItemId) {
      return;
    }

    handleAlertItemDrop(e, targetData.type, targetItemId);
  });
}

function handleAlertItemDrop(e, targetType, targetItemId) {
  if (!draggedAlertItemData) return;

  // Determine which array the dragged item belongs to
  let sourceArray = null;
  if (draggedAlertItemData.type === "Alarms") {
    sourceArray = alarms;
  } else if (draggedAlertItemData.type === "Timers") {
    sourceArray = timers;
  } else if (draggedAlertItemData.type === "Stopwatches") {
    sourceArray = stopwatches;
  } else if (draggedAlertItemData.type === "Notifications") {
    sourceArray = notifications;
  } else {
    sourceArray = alertsItemsData; // This now covers Reminders and other generic types
  }

  // Create temporary copies of all arrays to modify
  let tempAlertsItemsData = [...alertsItemsData];
  let tempAlarmsData = [...alarms];
  let tempTimersData = [...timers];
  let tempStopwatchesData = [...stopwatches];
  let tempNotificationsData = [...notifications]; // NEW

  // Remove item from its original array
  if (draggedAlertItemData.type === "Alarms") {
    tempAlarmsData = tempAlarmsData.filter(
      (item) => item.id !== draggedAlertItemData.id,
    );
  } else if (draggedAlertItemData.type === "Timers") {
    tempTimersData = tempTimersData.filter(
      (item) => item.id !== draggedAlertItemData.id,
    );
  } else if (draggedAlertItemData.type === "Stopwatches") {
    tempStopwatchesData = tempStopwatchesData.filter(
      (item) => item.id !== draggedAlertItemData.id,
    );
  } else if (draggedAlertItemData.type === "Notifications") {
    tempNotificationsData = tempNotificationsData.filter(
      (item) => item.id !== draggedAlertItemData.id,
    );
  } else {
    // Corrected this line to filter out the dragged item from alertsItemsData
    tempAlertsItemsData = tempAlertsItemsData.filter(
      (item) => item.id !== draggedAlertItemData.id,
    );
  }

  let newIndex;

  // Combine all items to find the correct insertion index based on overall order
  const allItemsCombined = [
    ...tempAlarmsData,
    ...tempTimersData,
    ...tempStopwatchesData,
    ...tempNotificationsData, // NEW
    ...tempAlertsItemsData,
  ];

  if (targetItemId) {
    const targetItem = allItemsCombined.find(
      (item) => item.id === targetItemId,
    );
    if (!targetItem) return;

    const actualTargetIndexInCombined = allItemsCombined.indexOf(targetItem);

    const bounding = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - bounding.top;
    if (offset < bounding.height / 2) {
      newIndex = actualTargetIndexInCombined;
    } else {
      newIndex = actualTargetIndexInCombined + 1;
    }
  } else {
    // Dropping onto a type header (empty container)
    const itemsInTargetType = allItemsCombined.filter(
      (item) => item.type === targetType,
    );
    if (itemsInTargetType.length > 0) {
      const lastItemInTargetType =
        itemsInTargetType[itemsInTargetType.length - 1];
      newIndex = allItemsCombined.indexOf(lastItemInTargetType) + 1;
    } else {
      const typeIndex = availableAlertTypes.findIndex(
        (t) => t.name === targetType,
      );
      let calculatedIndex = 0;
      for (let i = 0; i < typeIndex; i++) {
        calculatedIndex += allItemsCombined.filter(
          (item) => item.type === availableAlertTypes[i].name,
        ).length;
      }
      newIndex = calculatedIndex;
    }
  }

  if (newIndex < 0) newIndex = 0;
  if (newIndex > allItemsCombined.length) newIndex = allItemsCombined.length;

  // Update the type of the dragged item
  draggedAlertItemData.type = targetType;

  // Re-add the dragged item to the correct temporary array based on its new type
  if (draggedAlertItemData.type === "Alarms") {
    tempAlarmsData.splice(newIndex, 0, draggedAlertItemData);
  } else if (draggedAlertItemData.type === "Timers") {
    tempTimersData.splice(newIndex, 0, draggedAlertItemData);
  } else if (draggedAlertItemData.type === "Stopwatches") {
    tempStopwatchesData.splice(newIndex, 0, draggedAlertItemData);
  } else if (draggedAlertItemData.type === "Notifications") {
    tempNotificationsData.splice(newIndex, 0, draggedAlertItemData);
  } else {
    tempAlertsItemsData.splice(newIndex, 0, draggedAlertItemData);
  }

  // Update global arrays
  alertsItemsData = tempAlertsItemsData;
  alarms = tempAlarmsData;
  timers = tempTimersData;
  stopwatches = tempStopwatchesData;
  notifications = tempNotificationsData; // NEW

  // No localStorage.setItem calls here, as entire chit is saved
  renderAlertItems();
}

function toggleAlertFilterDropdown(event) {
  if (event) event.stopPropagation();
  const dropdownContainer = document.getElementById(
    "alertFilterDropdownContainer",
  );
  let dropdown = dropdownContainer.querySelector(".alert-filter-dropdown");
  const filterButton = document.getElementById("alertFilterButton");

  let closeAlertDropdownOutside = (e) => {
    if (!dropdown.contains(e.target) && e.target !== filterButton) {
      dropdown.remove();
      document.removeEventListener("click", closeAlertDropdownOutside);
    }
  };

  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", closeAlertDropdownOutside);
    return;
  }

  dropdown = document.createElement("div");
  dropdown.className = "alert-filter-dropdown status-filter-dropdown";

  availableAlertTypes.forEach((typeObj) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = typeObj.name;
    checkbox.checked = activeAlertTypesFilter.includes(typeObj.name);

    checkbox.onchange = (e) => {
      e.stopPropagation();
      const typeName = e.target.value;
      if (e.target.checked) {
        if (!activeAlertTypesFilter.includes(typeName)) {
          activeAlertTypesFilter.push(typeName);
        }
      } else {
        activeAlertTypesFilter = activeAlertTypesFilter.filter(
          (t) => t !== typeName,
        );
      }
      renderAlertItems();
    };

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(typeObj.name));
    dropdown.appendChild(label);
  });
  dropdownContainer.appendChild(dropdown);

  const buttonRect = filterButton.getBoundingClientRect();
  dropdown.style.left = `${buttonRect.left}px`;
  dropdown.style.top = `${buttonRect.bottom + 5}px`;
  dropdown.style.display = "block";
  document.addEventListener("click", closeAlertDropdownOutside);
}

/* --- Alarm Functions --- */

function openAlarmModal(event) {
  if (event) event.stopPropagation();
  alarmModal.style.display = "flex";
  document.getElementById("alarmName").value = "";
  alarmTimeInput.value = "";
  alarmRecurrenceSelect.value = "none";
  alarmSoundSelect.value = "chime";
  document
    .querySelectorAll(".alarm-day")
    .forEach((checkbox) => (checkbox.checked = false));
  document.getElementById("alarmDaysGroup").style.display = "none";

  const submitButton = document.getElementById("modalAlarmSubmit");
  submitButton.textContent = "Add Alarm";
  submitButton.onclick = addAlarm;
  const cancelButton = document.querySelector(
    "#alarmModal .modal-buttons .modal-discard-button",
  );
  if (cancelButton) {
    cancelButton.style.display = "inline-block";
  }

  alarmTimeInput.focus();
}

function closeAlarmModal(saveChanges) {
  alarmModal.style.display = "none";
}

function addAlarm() {
  console.log("addAlarm called");
  const name = document.getElementById("alarmName").value.trim();
  const time = document.getElementById("alarmTime").value;
  const recurrence = document.getElementById("alarmRecurrence").value;
  const sound = document.getElementById("alarmSoundSelect").value;
  const days = Array.from(document.querySelectorAll(".alarm-day:checked")).map(
    (checkbox) => checkbox.value,
  );
  if (!time) {
    console.warn("No time selected");
    showCustomAlert("Please select a time for the alarm.");
    return;
  }

  const newAlarm = {
    id: generateUniqueAlarmId(), // Generate ID here
    name,
    time,
    recurrence,
    sound,
    days,
    enabled: true, // New alarms are enabled by default
    triggeredAtMinute: false,
  };
  alarms.push(newAlarm);
  // No localStorage.setItem("alarms", JSON.stringify(alarms));
  console.log("Alarms array updated:", alarms);

  renderAlertItems(); // Re-render the entire alerts section to include the new alarm
  toggleZone(null, "alertsSection", "alertsContent", true); // Ensure alerts section is expanded
  closeAlarmModal(true);
}

function editAlarm(event, id) {
  if (event) event.stopPropagation();
  const alarmToEdit = alarms.find((alarm) => alarm.id === id);
  if (!alarmToEdit) return;

  alarmModal.style.display = "flex";
  document.getElementById("alarmName").value = alarmToEdit.name;
  alarmTimeInput.value = alarmToEdit.time;
  alarmRecurrenceSelect.value = alarmToEdit.recurrence;
  alarmSoundSelect.value = alarmToEdit.sound;

  document.querySelectorAll(".alarm-day").forEach((checkbox) => {
    checkbox.checked = alarmToEdit.days.includes(checkbox.value);
  });
  const alarmDaysGroup = document.getElementById("alarmDaysGroup");
  if (
    alarmToEdit.recurrence === "weekly" ||
    alarmToEdit.recurrence === "weekdays" ||
    alarmToEdit.recurrence === "weekends"
  ) {
    alarmDaysGroup.style.display = "flex";
  } else {
    alarmDaysGroup.style.display = "none";
    document
      .querySelectorAll(".alarm-day")
      .forEach((checkbox) => (checkbox.checked = false));
  }

  const submitButton = document.getElementById("modalAlarmSubmit");
  submitButton.textContent = "Update Alarm";
  submitButton.onclick = () => updateAlarm(id);
  const cancelButton = document.querySelector(
    "#alarmModal .modal-buttons .modal-discard-button",
  );
  if (cancelButton) {
    cancelButton.style.display = "inline-block";
  }

  alarmTimeInput.focus();
}

function updateAlarm(id) {
  const alarmIndex = alarms.findIndex((alarm) => alarm.id === id);
  if (alarmIndex === -1) return;
  const name = document.getElementById("alarmName").value.trim();
  const time = document.getElementById("alarmTime").value;
  const recurrence = document.getElementById("alarmRecurrence").value;
  const sound = document.getElementById("alarmSoundSelect").value;
  const days = Array.from(document.querySelectorAll(".alarm-day:checked")).map(
    (checkbox) => checkbox.value,
  );
  if (!time) {
    showCustomAlert("Please select a time for the alarm.");
    return;
  }

  alarms[alarmIndex] = {
    ...alarms[alarmIndex],
    name: name,
    time: time,
    recurrence: recurrence,
    sound: sound,
    days:
      recurrence === "weekly" ||
      recurrence === "weekdays" ||
      recurrence === "weekends"
        ? days
        : [],
    triggeredAtMinute: false, // Reset triggered status on update
  };
  // No localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlertItems(); // Re-render the entire alerts section
  closeAlarmModal(true);
}

function toggleAlarm(event, id) {
  if (event) event.stopPropagation();
  const alarmIndex = alarms.findIndex((alarm) => alarm.id === id);
  if (alarmIndex !== -1) {
    alarms[alarmIndex].enabled = !alarms[alarmIndex].enabled;
    // No localStorage.setItem("alarms", JSON.stringify(alarms));
    renderAlertItems(); // Re-render the entire alerts section
  }
}

function deleteAlarm(event, id) {
  if (event) event.stopPropagation();
  alarms = alarms.filter((alarm) => alarm.id !== id);
  // No localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlertItems(); // Re-render the entire alerts section
}

function setupAlarmRecurrenceListener() {
  const alarmRecurrenceSelect = document.getElementById("alarmRecurrence");
  const alarmDaysGroup = document.getElementById("alarmDaysGroup");
  if (alarmRecurrenceSelect && alarmDaysGroup) {
    alarmRecurrenceSelect.addEventListener("change", function () {
      if (
        this.value === "weekly" ||
        this.value === "weekdays" ||
        this.value === "weekends"
      ) {
        alarmDaysGroup.style.display = "flex";
      } else {
        alarmDaysGroup.style.display = "none";
        document
          .querySelectorAll(".alarm-day")
          .forEach((checkbox) => (checkbox.checked = false));
      }
    });
  }
}

function checkAlarms() {
  const now = new Date();
  const currentTimeString = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayOfWeek = now.toLocaleDateString("en-US", {
    weekday: "short",
  });

  let alarmsChanged = false; // Flag to track if any alarm state changed

  alarms.forEach((alarm) => {
    if (!alarm.enabled) return;

    if (alarm.time === currentTimeString) {
      let shouldTrigger = false;

      if (alarm.recurrence === "none") {
        if (!alarm.triggeredForDay) {
          shouldTrigger = true;
          alarm.enabled = false; // Disable after single trigger
          alarm.triggeredForDay = true; // Mark as triggered for the current day
          alarmsChanged = true;
        }
      } else if (alarm.recurrence === "daily") {
        shouldTrigger = true;
      } else if (
        alarm.recurrence === "weekly" &&
        alarm.days.includes(dayOfWeek)
      ) {
        shouldTrigger = true;
      } else if (
        alarm.recurrence === "weekdays" &&
        ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(dayOfWeek)
      ) {
        shouldTrigger = true;
      } else if (
        alarm.recurrence === "weekends" &&
        ["Sat", "Sun"].includes(dayOfWeek)
      ) {
        shouldTrigger = true;
      }

      if (shouldTrigger && !alarm.triggeredAtMinute) {
        triggerAlarmNotification(alarm);
        alarm.triggeredAtMinute = true;
        alarmsChanged = true; // Mark as changed for rendering
      }
    } else {
      alarm.triggeredAtMinute = false;
    }
    // Reset triggeredForDay at the start of a new day for 'none' recurrence
    const todayDateString = now.toISOString().split("T")[0];
    if (
      alarm.recurrence === "none" &&
      alarm.lastTriggerDate !== todayDateString
    ) {
      if (alarm.triggeredForDay) {
        alarm.triggeredForDay = false;
        alarmsChanged = true;
      }
      alarm.lastTriggerDate = todayDateString;
      alarmsChanged = true;
    }
  });

  if (alarmsChanged) {
    // No localStorage here, handled by overall chit save
    renderAlertItems(); // Re-render the entire alerts section if any alarm state changed
  }
}

function triggerAlarmNotification(alarm) {
  showNotification("Alarm", alarm.name || "Unnamed Alarm", true);
  const alarmSound = new Audio(`sounds/${alarm.sound}.mp3`);
  alarmSound
    .play()
    .catch((error) => console.error("Error playing alarm sound:", error));
}

function showNotification(type, title, showSnooze = false, timerData = null) {
  const modal = document.getElementById("alertModal") || createAlertModal();
  modal.style.display = "flex";

  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalTime").textContent =
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }); // Ensure 24-hour time for display
  document.getElementById("snoozeButton").style.display = showSnooze
    ? "block"
    : "none";

  startFaviconFlash();
  startTitleFlash(type, title);
  if (Notification.permission === "granted") {
    new Notification(`CWOC ${type}: ${title}`, {
      body: `Time: ${new Date().toLocaleTimeString()}`,
      icon: "logo.png",
    });
  }
}

function createAlertModal() {
  const modal = document.createElement("div");
  modal.id = "alertModal";
  modal.className = "alert-modal";
  modal.innerHTML = `
                    <div class="modal-content">
                    <h2 id="modalTitle"></h2>
                    <p>Time: <span id="modalTime"></span></p>
                    <div class="modal-buttons">
                        <button onclick="dismissAlert()">Dismiss</button>
                        <button
                            id="snoozeButton"
                            onclick="snoozeAlarm()"
                            style="display: none"
                        >
                            Snooze
                        </button>
                    </div>
                    </div>
                `;
  document.body.appendChild(modal);
  return modal;
}

function dismissAlert() {
  const modal = document.getElementById("alertModal");
  if (modal) modal.style.display = "none";

  const alarmSound = document.getElementById("alarmSound");
  if (alarmSound) {
    alarmSound.pause();
    alarmSound.currentTime = 0;
  }
  const timerSound = document.getElementById("timerSound");
  if (timerSound) {
    timerSound.pause();
    timerSound.currentTime = 0;
  }

  stopFaviconFlash();
  stopTitleFlash();
}

function snoozeAlarm() {
  dismissAlert();
  setTimeout(
    () => {
      triggerAlarmNotification({ name: "Snoozed Alarm" });
    },
    5 * 60 * 1000,
  );
}

function startFaviconFlash() {
  if (!faviconInterval) {
    faviconInterval = setInterval(() => {
      const favicon = document.getElementById("favicon");
      if (favicon) {
        // Check if favicon element exists
        favicon.href = favicon.href.includes(originalFavicon)
          ? alertFavicon
          : originalFavicon;
      }
    }, 500);
  }
}

function stopFaviconFlash() {
  if (faviconInterval) {
    clearInterval(faviconInterval);
    faviconInterval = null;
    const favicon = document.getElementById("favicon");
    if (favicon) {
      favicon.href = originalFavicon;
    }
  }
}

function startTitleFlash(type, title) {
  if (!titleInterval) {
    let showFullTitle = true;
    titleInterval = setInterval(() => {
      document.title = showFullTitle ? `[${type}] ${title}` : originalTitle;
      showFullTitle = !showFullTitle;
    }, 1000);
  }
}

function stopTitleFlash() {
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
    document.title = originalTitle;
  }
}

function deleteAlertItem(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  // Check if the item is a generic alert or a notification
  const itemIndex = alertsItemsData.findIndex((item) => item.id === id);
  if (itemIndex !== -1) {
    alertsItemsData.splice(itemIndex, 1);
    // No localStorage.setItem("alertsItemsData", JSON.stringify(alertsItemsData));
  }
  renderAlertItems();
}

/* --- Notification Functions (NEW) --- */

function openNotificationModal(event, id = null) {
  if (event) event.stopPropagation();
  notificationModal.style.display = "flex";

  const submitButton = document.getElementById("modalNotificationSubmit");
  const currentChitStartDateSpan = document.getElementById(
    "currentChitStartDate",
  );
  const currentChitDueDateSpan = document.getElementById("currentChitDueDate");

  const startDatetime = document.getElementById("start_datetime").value;
  const dueDatetime = document.getElementById("dueDate").value; // Changed to dueDate

  currentChitStartDateSpan.textContent = startDatetime || "N/A";
  currentChitDueDateSpan.textContent = dueDatetime || "N/A";

  if (id) {
    // Editing existing notification
    const notificationToEdit = notifications.find((n) => n.id === id);
    if (!notificationToEdit) return;

    document.getElementById("notificationName").value =
      notificationToEdit.name || ""; // Added name field
    notificationValueInput.value = notificationToEdit.value;
    notificationUnitSelect.value = notificationToEdit.unit;
    notificationRelativeToToggle.checked =
      notificationToEdit.relativeTo === "start_date";

    submitButton.textContent = "Update Notification";
    submitButton.onclick = () => updateNotification(id);
  } else {
    // Adding new notification
    document.getElementById("notificationName").value = ""; // Clear name field
    notificationValueInput.value = "";
    notificationUnitSelect.value = "minutes";
    notificationRelativeToToggle.checked = false; // Default to due date

    submitButton.textContent = "Add Notification";
    submitButton.onclick = addNotification;
  }

  validateNotificationInputs(); // Validate on open
  notificationValueInput.focus();
}

function closeNotificationModal(saveChanges) {
  notificationModal.style.display = "none";
  // No specific reset needed if saveChanges is false, as openNotificationModal handles initial state
}

function validateNotificationInputs() {
  const value = parseInt(notificationValueInput.value);
  const unit = notificationUnitSelect.value;
  const relativeTo = notificationRelativeToToggle.checked
    ? "start_date"
    : "due_date";
  const submitButton = document.getElementById("modalNotificationSubmit");

  const startDatetime = document.getElementById("start_datetime").value;
  const dueDatetime = document.getElementById("dueDate").value; // Changed to dueDate

  let isValid = true;
  let tooltipText = "";

  if (isNaN(value) || value <= 0) {
    isValid = false;
    tooltipText = "Enter a positive number for the notification time.";
  } else if (relativeTo === "due_date" && !dueDatetime) {
    isValid = false;
    tooltipText =
      "No Due Date set for this Chit. Cannot set notification relative to it.";
  } else if (relativeTo === "start_date" && !startDatetime) {
    isValid = false;
    tooltipText =
      "No Start Date set for this Chit. Cannot set notification relative to it.";
  } else if (!startDatetime && !dueDatetime) {
    isValid = false;
    tooltipText =
      "No Start or Due Date set for this Chit. Please set at least one date.";
  }

  submitButton.disabled = !isValid;
  submitButton.title = isValid ? "" : tooltipText;
}

function addNotification() {
  const name = document.getElementById("notificationName").value.trim(); // Get name
  const value = parseInt(notificationValueInput.value);
  const unit = notificationUnitSelect.value;
  const relativeTo = notificationRelativeToToggle.checked
    ? "start_date"
    : "due_date";

  if (isNaN(value) || value <= 0) {
    showCustomAlert(
      "Please enter a valid positive number for the notification time.",
    );
    return;
  }

  const newNotification = {
    id: generateUniqueNotificationId(),
    name: name, // Use the collected name
    value,
    unit,
    relativeTo,
    enabled: true,
    triggeredAtMinute: false, // Flag to prevent multiple triggers within the same minute
  };

  notifications.push(newNotification);
  // No localStorage.setItem("notifications", JSON.stringify(notifications));
  renderAlertItems();
  toggleZone(null, "alertsSection", "alertsContent", true); // Ensure alerts section is expanded
  closeNotificationModal(true);
}

function updateNotification(id) {
  const notificationIndex = notifications.findIndex((n) => n.id === id);
  if (notificationIndex === -1) return;

  const name = document.getElementById("notificationName").value.trim(); // Get name
  const value = parseInt(notificationValueInput.value);
  const unit = notificationUnitSelect.value;
  const relativeTo = notificationRelativeToToggle.checked
    ? "start_date"
    : "due_date";

  if (isNaN(value) || value <= 0) {
    showCustomAlert(
      "Please enter a valid positive number for the notification time.",
    );
    return;
  }

  notifications[notificationIndex] = {
    ...notifications[notificationIndex],
    name: name, // Update name
    value,
    unit,
    relativeTo,
    triggeredAtMinute: false, // Reset triggered status on update
  };

  // No localStorage.setItem("notifications", JSON.stringify(notifications));
  renderAlertItems();
  closeNotificationModal(true);
}

function toggleNotification(event, id) {
  if (event) event.stopPropagation();
  const notificationIndex = notifications.findIndex((n) => n.id === id);
  if (notificationIndex !== -1) {
    // Only allow toggling if the notification is not disabled by missing dates
    const startDatetime = document.getElementById("start_datetime").value;
    const dueDatetime = document.getElementById("dueDate").value; // Changed to dueDate
    let isDisabledByDate = false;
    if (
      notifications[notificationIndex].relativeTo === "due_date" &&
      !dueDatetime
    ) {
      isDisabledByDate = true;
    } else if (
      notifications[notificationIndex].relativeTo === "start_date" &&
      !startDatetime
    ) {
      isDisabledByDate = true;
    } else if (!startDatetime && !dueDatetime) {
      isDisabledByDate = true;
    }

    if (isDisabledByDate) {
      // If it's disabled by date, we don't allow manual toggling
      // The `checkNotifications` function will handle the `enabled` state based on date availability
      return;
    }

    notifications[notificationIndex].enabled =
      !notifications[notificationIndex].enabled;
    // No localStorage.setItem("notifications", JSON.stringify(notifications));
    renderAlertItems();
  }
}

function triggerNotificationManual(event, id) {
  if (event) event.stopPropagation();
  const notification = notifications.find((n) => n.id === id);
  if (notification) {
    showNotification(
      "Notification",
      notification.name || "Unnamed Notification",
      false,
    ); // Use notification's name
  }
}

function deleteNotification(event, id) {
  if (event) event.stopPropagation();
  notifications = notifications.filter((n) => n.id !== id);
  // No localStorage.setItem("notifications", JSON.stringify(notifications));
  renderAlertItems();
}

/* --- Timer Functions (Integrated from Alarms.html) --- */

function openTimerModal(event) {
  if (event) event.stopPropagation();
  timerModal.style.display = "flex";
  document.getElementById("timerNameModal").value = "";
  document.getElementById("timerHoursModal").value = "";
  document.getElementById("timerMinutesModal").value = "";
  document.getElementById("timerSecondsModal").value = "";
  document.getElementById("timerLoopModal").checked = false;
  document.getElementById("timerSoundSelect").value = "timer"; // Default sound

  const submitButton = document.getElementById("modalTimerSubmit");
  submitButton.textContent = "Add Timer";
  submitButton.onclick = addTimer; // Set to add new timer
  const cancelButton = document.querySelector(
    "#timerModal .modal-buttons .modal-discard-button",
  );
  if (cancelButton) {
    cancelButton.style.display = "inline-block";
  }

  editingTimerIndex = null; // Reset editing state
}
