function updateChecklistCount() {
  console.log(
    document.currentScript && document.currentScript.src,
    ": First function in file",
  );
  const uncheckedItems = checklistItemsData.filter((item) => !item.checked);
  const countSpan = document.getElementById("checklistCount");
  countSpan.textContent = uncheckedItems.length;
}

function updateCompletedSectionVisibility() {
  const completedItems = checklistItemsData.filter((item) => item.checked);
  const completedContainer = document.getElementById(
    "completed-checklist-container",
  );
  const hrElement = document.getElementById("completed-section-hr");
  const hasContent =
    completedItems.length > 0 ||
    checklistItemsData.some(
      (item) => !item.checked && hasCheckedChildren(item.id),
    );
  if (hasContent) {
    completedContainer.classList.remove("completed-section-hidden");
    hrElement.classList.remove("completed-section-hidden");
  } else {
    completedContainer.classList.add("completed-section-hidden");
    hrElement.classList.add("completed-section-hidden");
  }
}

function hasCheckedChildren(parentId) {
  const parentIndex = checklistItemsData.findIndex(
    (item) => item.id === parentId,
  );
  if (parentIndex === -1) return false;

  const parentIndent = checklistItemsData[parentIndex].indentLevel;
  for (let i = parentIndex + 1; i < checklistItemsData.length; i++) {
    const child = checklistItemsData[i];
    if (child.indentLevel > parentIndent) {
      if (child.checked) {
        return true;
      }
    } else if (child.indentLevel <= parentIndent) {
      break;
    }
  }
  return false;
}

function updateChecklistItemButtons(itemDiv) {
  const indentButton = itemDiv.querySelector(".indent-item");
  const outdentButton = itemDiv.querySelector(".outdent-item");
  const currentIndent = parseInt(itemDiv.dataset.indentLevel || 0);
  const itemIndex = checklistItemsData.findIndex(
    (item) => item.id === itemDiv.dataset.id,
  );
  if (itemIndex === -1) return;

  const previousItemData =
    itemIndex > 0 ? checklistItemsData[itemIndex - 1] : null;
  const previousIndent = previousItemData ? previousItemData.indentLevel : -1;

  if (indentButton) {
    if (
      currentIndent < MAX_INDENT_LEVEL &&
      previousItemData &&
      currentIndent < previousIndent + 1
    ) {
      indentButton.style.display = "flex";
    } else {
      indentButton.style.display = "none";
    }
  }

  if (outdentButton) {
    if (currentIndent <= 0) {
      outdentButton.style.display = "none";
    } else {
      outdentButton.style.display = "flex";
    }
  }
}

function addChecklistItem() {
  const newItemInput = document.getElementById("new-checklist-item");
  const itemText = newItemInput.value.trim();
  if (itemText) {
    const newItem = {
      id: generateUniqueId("checklist"),
      text: itemText,
      checked: false,
      indentLevel: 0,
    };
    checklistItemsData.push(newItem);
    newItemInput.value = "";
    manageGhostsAndSortLists();
  }
}

function saveChecklistItemText(editableDiv) {
  const itemId = editableDiv.parentNode.dataset.id;
  const itemToUpdate = checklistItemsData.find((item) => item.id === itemId);
  if (itemToUpdate) {
    itemToUpdate.text = editableDiv.textContent.trim();
    manageGhostsAndSortLists();
  }
}

function toggleChecklistItem(checkbox) {
  const itemId = checkbox.parentNode.dataset.id;
  const itemToToggle = checklistItemsData.find((item) => item.id === itemId);
  if (itemToToggle) {
    itemToToggle.checked = checkbox.checked;
    const itemIndex = checklistItemsData.indexOf(itemToToggle);
    const currentIndent = itemToToggle.indentLevel;
    for (let i = itemIndex + 1; i < checklistItemsData.length; i++) {
      const child = checklistItemsData[i];
      if (child.indentLevel > currentIndent) {
        child.checked = checkbox.checked;
      } else if (child.indentLevel <= currentIndent) {
        break;
      }
    }
    manageGhostsAndSortLists();
  }
}

function deleteChecklistItem(button) {
  const itemDiv = button.parentNode;
  const itemId = itemDiv.dataset.id;
  const itemIndex = checklistItemsData.findIndex((item) => item.id === itemId);
  if (itemIndex !== -1) {
    const itemIndent = checklistItemsData[itemIndex].indentLevel;
    let itemsToDeleteCount = 1;
    for (let i = itemIndex + 1; i < checklistItemsData.length; i++) {
      if (checklistItemsData[i].indentLevel > itemIndent) {
        itemsToDeleteCount++;
      } else {
        break;
      }
    }
    checklistItemsData.splice(itemIndex, itemsToDeleteCount);
  }
  manageGhostsAndSortLists();
}

function indentChecklistItem(button) {
  const itemDiv = button.parentNode;
  const itemId = itemDiv.dataset.id;
  const itemToIndent = checklistItemsData.find((item) => item.id === itemId);
  if (itemToIndent) {
    const itemIndex = checklistItemsData.indexOf(itemToIndent);
    const previousItemData =
      itemIndex > 0 ? checklistItemsData[itemIndex - 1] : null;
    const previousIndent = previousItemData ? previousItemData.indentLevel : -1;

    if (
      itemToIndent.indentLevel < MAX_INDENT_LEVEL &&
      previousItemData &&
      itemToIndent.indentLevel < previousIndent + 1
    ) {
      itemToIndent.indentLevel++;
      manageGhostsAndSortLists();
    }
  }
}

function outdentChecklistItem(button) {
  const itemDiv = button.parentNode;
  const itemId = itemDiv.dataset.id;
  const itemToOutdent = checklistItemsData.find((item) => item.id === itemId);

  if (itemToOutdent && itemToOutdent.indentLevel > 0) {
    itemToOutdent.indentLevel--;
    manageGhostsAndSortLists();
  }
}

function handleChecklistInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addChecklistItem();
  }
}

// Drag and Drop for Checklist
function addDragAndDropListeners(itemDiv) {
  itemDiv.addEventListener("dragstart", (e) => {
    draggedItemData = checklistItemsData.find(
      (item) => item.id === itemDiv.dataset.id,
    );
    if (!draggedItemData) return;

    draggedGroupData = [draggedItemData];
    const initialIndent = draggedItemData.indentLevel;
    const startIndex = checklistItemsData.indexOf(draggedItemData);

    for (let i = startIndex + 1; i < checklistItemsData.length; i++) {
      const currentItem = checklistItemsData[i];
      if (currentItem.indentLevel > initialIndent) {
        draggedGroupData.push(currentItem);
      } else {
        break;
      }
    }

    draggedGroupData.forEach((item) => {
      const el = document.querySelector(`[data-id="${item.id}"]`);
      if (el) el.style.display = "none";
    });

    e.dataTransfer.effectAllowed = "move";
  });
  itemDiv.addEventListener("dragend", () => {
    draggedGroupData.forEach((item) => {
      const el = document.querySelector(`[data-id="${item.id}"]`);
      if (el) el.style.display = "flex";
    });

    draggedItemData = null;
    draggedGroupData = [];
    manageGhostsAndSortLists();
  });
  itemDiv.addEventListener("dragover", (e) => {
    e.preventDefault();
    const bounding = itemDiv.getBoundingClientRect();
    const offset = e.clientY - bounding.top;
    if (offset > bounding.height / 2) {
      itemDiv.style.borderBottom = "2px solid #007bff";
      itemDiv.style.borderTop = "";
    } else {
      itemDiv.style.borderTop = "2px solid #007bff";
      itemDiv.style.borderBottom = "";
    }
  });
  itemDiv.addEventListener("dragleave", () => {
    itemDiv.style.borderBottom = "";
    itemDiv.style.borderTop = "";
  });
  itemDiv.addEventListener("drop", (e) => {
    e.preventDefault();
    itemDiv.style.borderBottom = "";
    itemDiv.style.borderTop = "";

    if (!draggedItemData) return;

    const targetItemId = itemDiv.dataset.id;
    const targetItemData = checklistItemsData.find(
      (item) => item.id === targetItemId,
    );
    if (!targetItemData || draggedGroupData.includes(targetItemData)) return;

    const targetIndex = checklistItemsData.indexOf(targetItemData);
    const draggedStartIndex = checklistItemsData.indexOf(draggedItemData);

    if (draggedStartIndex === -1 || targetIndex === -1) return;

    const bounding = itemDiv.getBoundingClientRect();
    const offset = e.clientY - bounding.top;

    let newIndex;
    if (offset > bounding.height / 2) {
      newIndex = targetIndex + 1;
    } else {
      newIndex = targetIndex;
    }

    let tempChecklistItemsData = [...checklistItemsData];
    const itemsToRemove = draggedGroupData.map((item) => item.id);
    tempChecklistItemsData = tempChecklistItemsData.filter(
      (item) => !itemsToRemove.includes(item.id),
    );
    if (draggedStartIndex < newIndex) {
      newIndex -= draggedGroupData.length;
    }
    if (newIndex < 0) newIndex = 0;

    tempChecklistItemsData.splice(newIndex, 0, ...draggedGroupData);
    const newPreviousItem =
      newIndex > 0 ? tempChecklistItemsData[newIndex - 1] : null;
    const newPreviousIndent = newPreviousItem
      ? newPreviousItem.indentLevel
      : -1;
    const originalDraggedBaseIndent = draggedItemData.indentLevel;
    const indentDifference = newPreviousIndent + 1 - originalDraggedBaseIndent;
    draggedGroupData.forEach((item) => {
      item.indentLevel = Math.max(0, item.indentLevel + indentDifference);
      if (item.indentLevel > MAX_INDENT_LEVEL)
        item.indentLevel = MAX_INDENT_LEVEL;
    });
    checklistItemsData = tempChecklistItemsData;
    manageGhostsAndSortLists();
  });
}

/* --- Health Indicators Functions --- */

function convertToImperial(indicator, value) {
  switch (indicator) {
    case "glucose":
      return value * 18.0156;
    case "distance":
      return value * 0.621371;
    case "water":
      return value * 0.033814;
    case "weight":
      return value * 2.20462;
    case "temperature":
      return (value * 9) / 5 + 32;
    case "waist":
      return value * 0.393701;
    default:
      return value;
  }
}

function convertToMetric(indicator, value) {
  switch (indicator) {
    case "glucose":
      return value / 18.0156;
    case "distance":
      return value / 0.621371;
    case "water":
      return value / 0.033814;
    case "weight":
      return value / 2.20462;
    case "temperature":
      return ((value - 32) * 5) / 9;
    case "waist":
      return value / 0.393701;
    default:
      return value;
  }
}

function renderHealthIndicator(indicator) {
  const entry = document.getElementById(`${indicator}Entry`);
  // Add a null check for 'entry' to prevent "innerHTML of null" errors
  if (!entry) {
    console.warn(
      `Element with ID '${indicator}Entry' not found. Skipping rendering for this indicator.`,
    );
    return; // Exit the function if the element doesn't exist
  }

  const config = healthIndicatorConfigs[indicator];
  const isCurrentlyImperial = unitToggle.checked;

  if (indicator === "cycle") {
    entry.innerHTML = `
      <form class="cycle-tracking-form" onsubmit="event.preventDefault();">
        <label for="cycleStart">Cycle Start Date:</label>
        <input type="date" id="cycleStart" value="${healthData.cycle?.value?.startDate || ""}">
        <label for="cycleLength">Average Cycle Length (days):</label>
        <input type="number" id="cycleLength" value="${healthData.cycle?.value?.cycleLength || ""}" min="20" max="35">
        <button type="button" onclick="calculateCycle(event)" style="display: inline-flex; white-space: nowrap;">
          Calculate
        </button>
      </form>
      <div class="cycle-results hidden" id="cycleResults"></div>
    `;
    const cycleStartInput = document.getElementById("cycleStart");
    if (cycleStartInput && !cycleStartInput._flatpickr) {
      flatpickr("#cycleStart", { dateFormat: "Y-m-d" });
    }
    return;
  }

  if (healthData[indicator]) {
    const data = healthData[indicator];
    let displayValue;
    let displayUnit;

    if (indicator === "bp") {
      displayValue = `${data.value.systolic}/${data.value.diastolic}`;
      displayUnit = data.unit;
    } else {
      const storedValue = parseFloat(data.value);
      const storedUnit = data.unit;

      if (storedUnit === config.unit.metric && isCurrentlyImperial) {
        displayValue = convertToImperial(indicator, storedValue);
      } else if (storedUnit === config.unit.imperial && !isCurrentlyImperial) {
        displayValue = convertToMetric(indicator, storedValue);
      } else {
        displayValue = storedValue;
      }
      const decimalPlaces = config.step
        ? (config.step.toString().split(".")[1] || "").length
        : 0;
      displayValue = parseFloat(displayValue).toFixed(decimalPlaces);
      displayUnit = isCurrentlyImperial
        ? config.unit.imperial
        : config.unit.metric;
    }
    entry.innerHTML = `
      <button type="button" onclick="showInputs(event, '${indicator}')" class="display-button">
        ${config.icon} ${config.label} ${displayValue} ${displayUnit}
      </button>
    `;
  } else {
    // MODIFIED: Ensure the icon is always present, even for the "Add" button
    entry.innerHTML = `
      <button  type="button" onclick="showInputs(event, '${indicator}')" class="add-button healthButton">
        ${config.icon} + ${config.label}
      </button>
    `;
  }
}

function renderAllHealthIndicators() {
  for (const indicator in healthIndicatorConfigs) {
    renderHealthIndicator(indicator);
  }
}
function showInputs(event, indicator) {
  if (event) event.stopPropagation();

  const entry = document.getElementById(`${indicator}Entry`);
  const config = healthIndicatorConfigs[indicator];
  const isImperial = unitToggle.checked;
  const currentUnit = isImperial ? config.unit.imperial : config.unit.metric;
  entry.innerHTML = "";
  let inputHTML = "";
  switch (indicator) {
    case "heartRate":
      inputHTML = `<input type="number" placeholder="BPM" id="hrValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    // case "hrv": // Commented out
    //   inputHTML = `<input type="number" placeholder="ms" id="hrvValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    case "bp":
      inputHTML = `<div class="bp-inputs"><input type="number" placeholder="Systolic" id="bpSys" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> / <input type="number" placeholder="Diastolic" id="bpDia" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"></div> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    case "glucose":
      inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="glucoseValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    case "spo2":
      inputHTML = `<input type="number" step="${config.step}" placeholder="%" id="spo2Value" min="0" max="100" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    // case "respiratory": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="breaths/min" id="respiratoryValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    case "temperature":
      inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="temperatureValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    // case "steps": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="steps" id="stepsValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    case "distance":
      inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="distanceValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    // case "exercise": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="minutes" id="exerciseValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    // case "caloriesBurned": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="kcal" id="caloriesBurnedValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    // case "calories": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="kcal" id="caloriesValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    // case "water": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="waterValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    case "weight":
      inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="weightValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
    // case "bodyFat": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="%" id="bodyFatValue" min="0" max="100" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    // case "waist": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="${currentUnit}" id="waistValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    // case "sleepHours": // Commented out
    //   inputHTML = `<input type="number" step="${config.step}" placeholder="hours" id="sleepHoursValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
    //   break;
    case "intercourse":
      inputHTML = `<input type="number" step="${config.step}" placeholder="times" id="intercourseValue" onkeydown="if(event.key === 'Enter') saveHealthData(event, '${indicator}')"> <button type="button" onclick="saveHealthData(event, '${indicator}')">+Add</button>`;
      break;
  }

  entry.insertAdjacentHTML("beforeend", inputHTML);
  if (healthData[indicator]) {
    if (indicator === "bp") {
      document.getElementById("bpSys").value =
        healthData[indicator].value.systolic || "";
      document.getElementById("bpDia").value =
        healthData[indicator].value.diastolic || "";
    } else {
      // Begin commented out section for specific indicators
      /*
      if (
        indicator === "hrv" ||
        indicator === "respiratory" ||
        indicator === "exercise" ||
        indicator === "steps" ||
        indicator === "caloriesBurned" ||
        indicator === "calories" ||
        indicator === "water" ||
        indicator === "bodyFat" ||
        indicator === "waist" ||
        indicator === "sleepHours"
      ) {
        // Do nothing for these indicators if they are commented out in the switch
      } else {
      */
      const storedValue = parseFloat(healthData[indicator].value);
      const storedUnit = healthData[indicator].unit;
      let valueToDisplay = storedValue;
      if (storedUnit === config.unit.metric && isImperial) {
        valueToDisplay = convertToImperial(indicator, storedValue);
      } else if (storedUnit === config.unit.imperial && !isImperial) {
        valueToDisplay = convertToMetric(indicator, storedValue);
      }
      document.getElementById(`${indicator}Value`).value = valueToDisplay;
      /*
      }
      */
      // End commented out section for specific indicators
    }
  }
}
function saveHealthData(event, indicator) {
  if (event) event.stopPropagation();
  const isImperial = unitToggle.checked;
  const config = healthIndicatorConfigs[indicator];
  const unitForStorage = config.unit.metric;
  let valueToStore;
  switch (indicator) {
    case "bp":
      const bpSys = document.getElementById("bpSys").value;
      const bpDia = document.getElementById("bpDia").value;
      if (!bpSys || !bpDia) {
        showCustomAlert(
          "Please enter both systolic and diastolic blood pressure.",
        );
        return;
      }
      valueToStore = {
        systolic: parseFloat(bpSys),
        diastolic: parseFloat(bpDia),
      };
      break;
    default:
      const input = document.getElementById(`${indicator}Value`);
      if (!input.value) {
        showCustomAlert("Please enter a value.");
        return;
      }
      const enteredValue = parseFloat(input.value);
      if (isImperial) {
        valueToStore = convertToMetric(indicator, enteredValue);
      } else {
        valueToStore = enteredValue;
      }
  }

  healthData[indicator] = {
    value: valueToStore,
    unit: unitForStorage,
    timestamp: new Date().toISOString(),
  };
  console.log(`${indicator} saved:`, healthData[indicator]);
  renderHealthIndicator(indicator);
}

function toggleCycleForm(event) {
  if (event) event.stopPropagation();

  const form = document.getElementById("cycleForm");
  const results = document.getElementById("cycleResults");
  const button = document.querySelector("#cycleEntry button");
  if (form.classList.contains("hidden")) {
    form.classList.remove("hidden");
    form.style.display = "inline-flex";
    results.classList.add("hidden");
    results.style.display = "none";
    button.textContent = "🌸 Cycle Tracking";
  } else {
    form.classList.add("hidden");
    form.style.display = "none";
  }
}

function calculateCycle(event) {
  if (event) event.stopPropagation();

  const cycleStartInput = document.getElementById("cycleStart");
  const cycleLengthInput = document.getElementById("cycleLength");
  const resultsDiv = document.getElementById("cycleResults");

  cycleStartInput.classList.remove("error");
  cycleLengthInput.classList.remove("error");
  resultsDiv.classList.add("hidden");
  resultsDiv.style.display = "none";
  resultsDiv.innerHTML = "";

  const cycleStartDate = new Date(cycleStartInput.value);
  const cycleLength = parseInt(cycleLengthInput.value);
  if (isNaN(cycleStartDate.getTime()) || !cycleStartInput.value) {
    cycleStartInput.classList.add("error");
    showCustomAlert("Please enter a valid start date.");
    return;
  }

  if (isNaN(cycleLength) || cycleLength < 21 || cycleLength > 35) {
    cycleLengthInput.classList.add("error");
    showCustomAlert("Please enter a cycle length between 21 and 35 days.");
    return;
  }

  const nextPeriodStart = new Date(cycleStartDate);
  nextPeriodStart.setDate(cycleStartDate.getDate() + cycleLength);
  const ovulationDay = new Date(cycleStartDate);
  ovulationDay.setDate(cycleStartDate.getDate() + (cycleLength - 14));

  const fertileWindowStart = new Date(ovulationDay);
  fertileWindowStart.setDate(ovulationDay.getDate() - 5);
  const fertileWindowEnd = new Date(ovulationDay);
  fertileWindowEnd.setDate(ovulationDay.getDate() + 1);
  resultsDiv.innerHTML = `
                                    Next Period: ${nextPeriodStart.toLocaleDateString()}<br>
                                    Ovulation: ${ovulationDay.toLocaleDateString()}<br>
                                    Fertile Window: ${fertileWindowStart.toLocaleDateString()} - ${fertileWindowEnd.toLocaleDateString()}
                                `;
  resultsDiv.classList.remove("hidden");
  resultsDiv.style.display = "inline-flex";

  healthData["cycle"] = {
    cycleStart: cycleStartInput.value,
    cycleLength: cycleLength,
    nextPeriod: nextPeriodStart.toISOString().split("T")[0],
    ovulation: ovulationDay.toISOString().split("T")[0],
    fertileWindowStart: fertileWindowStart.toISOString().split("T")[0],
    fertileWindowEnd: fertileWindowEnd.toISOString().split("T")[0],
    timestamp: new Date().toISOString(),
  };
  console.log("Cycle data saved:", healthData["cycle"]);

  const form = document.getElementById("cycleForm");
  const button = document.querySelector("#cycleEntry button");
  form.classList.add("hidden");
  form.style.display = "none";
  button.textContent = "🌸 Cycle Tracking (Calculated)";
}

// New function to check and trigger notifications
function checkNotifications() {
  const now = new Date();
  const startDatetimeInput = document.getElementById("start_datetime").value;
  const startTimeInput = document.getElementById("start_time").value;
  const dueDatetimeInput = document.getElementById("dueDate").value; // Corrected ID here
  const dueTimeInput = document.getElementById("dueTime").value;

  let notificationsChanged = false;

  notifications.forEach((notification) => {
    if (!notification.enabled) return;

    let targetDateStr;
    let targetTimeStr;

    if (notification.relativeTo === "due_date") {
      targetDateStr = dueDatetimeInput;
      targetTimeStr = dueTimeInput;
    } else {
      // Defaults to start_date if due_date is not chosen or available
      targetDateStr = startDatetimeInput;
      targetTimeStr = startTimeInput;
    }

    // Check if target date is available, if not, disable notification and add tooltip
    const notificationElement = document.querySelector(
      `.notification-item[data-id="${notification.id}"]`,
    );

    if (!targetDateStr) {
      if (notificationElement) {
        notificationElement.classList.add("disabled");
        notificationElement.title = `Notification disabled: No ${notification.relativeTo.replace("_", " ")} set for this Chit.`;
      }
      if (notification.enabled) {
        notification.enabled = false;
        notificationsChanged = true;
      }
      return; // Skip checking this notification if no target date
    } else {
      if (notificationElement) {
        notificationElement.classList.remove("disabled");
        notificationElement.title = ""; // Clear tooltip
      }
      if (!notification.enabled && notification.wasDisabledByDate === true) {
        // Re-enable if it was disabled by missing date and date is now present
        notification.enabled = true;
        notificationsChanged = true;
        notification.wasDisabledByDate = false;
      }
    }

    const targetDateTime = new Date(
      `${targetDateStr}T${targetTimeStr || "00:00"}:00`,
    );
    if (isNaN(targetDateTime.getTime())) {
      if (notificationElement) {
        notificationElement.classList.add("disabled");
        notificationElement.title = `Notification disabled: Invalid ${notification.relativeTo.replace("_", " ")} format.`;
      }
      if (notification.enabled) {
        notification.enabled = false;
        notificationsChanged = true;
      }
      return;
    }

    let triggerTime = new Date(targetDateTime);

    switch (notification.unit) {
      case "minutes":
        triggerTime.setMinutes(triggerTime.getMinutes() - notification.value);
        break;
      case "hours":
        triggerTime.setHours(triggerTime.getHours() - notification.value);
        break;
      case "days":
        triggerTime.setDate(triggerTime.getDate() - notification.value);
        break;
      case "weeks":
        triggerTime.setDate(triggerTime.getDate() - notification.value * 7);
        break;
    }

    // Only trigger if the current time is at or after the trigger time, and it hasn't been triggered for this specific time yet
    // And ensure it hasn't been triggered today if it's a 'none' recurrence (though notifications usually don't have recurrence in this sense)
    if (now >= triggerTime && !notification.triggeredAtMinute) {
      // For notifications, we typically want a single trigger when the time is met
      // unless a recurrence is explicitly set (which isn't part of this spec for notifications)
      // So, we'll use a simple `triggeredAtMinute` flag for now.
      showNotification(
        "Notification",
        notification.name || "Unnamed Notification",
        false,
      ); // No snooze for generic notifications
      notification.triggeredAtMinute = true;
      notificationsChanged = true;
    } else if (now < triggerTime) {
      notification.triggeredAtMinute = false; // Reset if time has passed and now it's before the trigger again
    }
  });

  if (notificationsChanged) {
    // No localStorage here, handled by overall chit save
    renderAlertItems(); // Re-render the alerts section if any notification state changed
  }
}

/* --- Save/Delete Chit Functions --- */

async function saveChitData() {
  console.log("saveChitData() started");

  // Data Collection
  const chit = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    status: document.getElementById("status").value,
    dueDate: document.getElementById("dueDate").value || null,
    dueTime: document.getElementById("dueTime").value || null,
    allDay: document.getElementById("allDay").checked,
    color: document.getElementById("color").value, // Assuming this input holds the selected color
    isPinned: document.getElementById("isPinned").checked,
    isArchived: document.getElementById("isArchived").checked,
    alarms: alarms, // Global array
    timers: timers.map((t) => {
      // Filter out non-serializable properties
      const { interval, ...rest } = t;
      return rest;
    }),
    stopwatches: stopwatches.map((s) => {
      // Filter out non-serializable properties
      const { interval, ...rest } = s;
      return rest;
    }),
    notifications: notifications, // Global array
    checklist_items: checklistItemsData, // Global array
    tags: getSelectedTagIds(), // Function to get IDs of selected tags from UI
  };

  let url = "/api/chits";
  let method = "POST";

  // Determine if it's a new chit or existing chit
  if (currentChitId) {
    url = `/api/chits/${currentChitId}`;
    method = "PUT";
  }

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chit),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const savedChit = await response.json();
    console.log("Chit saved successfully:", savedChit);
    showCustomAlert("Chit saved successfully!");

    // Post-Save Logic: If new chit, update URL and currentChitId
    if (method === "POST" && savedChit.id) {
      currentChitId = savedChit.id;
      // Update URL to reflect the new chit ID without full page reload
      history.replaceState(null, "", `editor.html?chitId=${savedChit.id}`);
      console.log(`New chit created with ID: ${currentChitId}. URL updated.`);
    }
    // Optionally, redirect to a main view or display a success message
    // window.location.href = '/dashboard.html';
  } catch (error) {
    console.error("Failed to save chit data:", error);
    showCustomAlert(`Error saving chit: ${error.message}`);
  }
}

// Helper function to collect selected tag IDs from the UI
function getSelectedTagIds() {
  const selectedIds = [];
  document.querySelectorAll(".tag-checkbox:checked").forEach((checkbox) => {
    selectedIds.push(checkbox.dataset.tagId);
  });
  return selectedIds;
}

function deleteChit() {
  showCustomConfirm(
    "Are you sure you want to delete this Chit? This action cannot be undone and will delete the Chit from the database.",
    async (confirmed) => {
      if (confirmed) {
        if (currentChitId) {
          try {
            const response = await fetch(`/api/chits/${currentChitId}`, {
              method: "DELETE",
            });
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            showCustomAlert("Chit deleted successfully!");
            // Redirect to a dashboard or new chit page after deletion
            window.location.href = "/dashboard.html"; // Or 'editor.html' for a new empty chit
          } catch (error) {
            console.error("Failed to delete chit:", error);
            showCustomAlert(`Error deleting chit: ${error.message}`);
          }
        } else {
          showCustomAlert("No chit to delete. This is a new unsaved chit.");
          resetEditorForNewChit(); // Just clear the form if it's a new chit
        }
      } else {
        console.log("Chit deletion cancelled.");
      }
    },
  );
}

/* --- DOMContentLoaded and Initial Setup --- */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize elements that are used globally and in event listeners
  notesMarkdownInput = document.getElementById("notes-markdown-input");
  notesRenderedOutput = document.getElementById("notes-rendered-output");
  notesMarkdownInputModal = document.getElementById(
    "notes-markdown-input-modal",
  );
  notesRenderedOutputModal = document.getElementById(
    "notes-rendered-output-modal",
  );
  notesModal = document.getElementById("notesModal");

  alarmModal = document.getElementById("alarmModal");
  alarmTimeInput = document.getElementById("alarmTime");
  alarmRecurrenceSelect = document.getElementById("alarmRecurrence");
  alarmSoundSelect = document.getElementById("alarmSoundSelect");

  timerModal = document.getElementById("timerModal");
  stopwatchModal = document.getElementById("stopwatchModal"); // Initialize stopwatch modal

  // Initialize Notification Modal elements (NEW)
  notificationModal = document.getElementById("notificationModal");
  notificationValueInput = document.getElementById("notificationValue");
  notificationUnitSelect = document.getElementById("notificationUnit");
  notificationRelativeToToggle = document.getElementById(
    "notificationRelativeToToggle",
  );

  unitToggle = document.getElementById("unitToggle");
  sexToggle = document.getElementById("sexToggle");
  reproductionSection = document.getElementById("reproductionSection");
  originalTitle = document.title; //
  // Ensure original title is captured after HTML fully loads

  // Event Listeners for Notes
  if (notesMarkdownInput)
    notesMarkdownInput.addEventListener("input", updateNotesPreview);
  if (notesMarkdownInputModal)
    notesMarkdownInputModal.addEventListener("input", updateModalNotesPreview);

  // Initialize Flatpickr instances
  flatpickr("#cycleStart", { dateFormat: "Y-m-d" });
  flatpickr("#start_datetime", { dateFormat: "Y-m-d" });
  flatpickr("#start_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
  });
  flatpickr("#end_datetime", { dateFormat: "Y-m-d" });
  flatpickr("#end_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
  });
  flatpickr("#dueDate", { dateFormat: "Y-m-d" }); // Changed ID
  flatpickr("#dueTime", {
    // Changed ID
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
  });

  // Flatpickr for Alarm Time (24-hour with arrows and typing)
  flatpickr("#alarmTime", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i", // 24-hour format (e.g., 14:30)
    time_24hr: true, // Ensures 24-hour mode with up/down arrows
    // Typing "1445" into this input will be parsed by flatpickr as 14:45
  });

  // Initial Data Renders / State Setups - These will be called by loadChitData or loadTags
  // updateCompactWeather(); // Weather - will be called by loadChitData or manually
  // updateChecklistCount(); // Checklist - will be called by loadChitData
  // manageGhostsAndSortLists(); // Checklist render - will be called by loadChitData
  // renderTagGrid(); // Tags - will be called by loadTags
  // renderTagTree(); // Tags - will be called by loadTags
  // renderActiveTags(); // Tags - will be called by loadTags and updateSelectedTagsUI
  activeStatusesFilter = availableStatuses.map((s) => s.name); // Projects: Initialize filter
  renderProjectItems(); // Projects
  // updatePinnedIcon(document.getElementById("isPinned").checked); // Pinned state - will be called by loadChitData
  // updateArchivedIcon(document.getElementById("isArchived").checked); // Archived state - will be called by loadChitData
  renderPeopleItems(); // People
  setupAlarmRecurrenceListener(); // Alarms recurrence listener

  // renderAlertItems(); // This now renders all alert types - will be called by loadChitData

  // Set up an interval to check alarms every second
  setInterval(checkAlarms, 1000);
  // Set up an interval to check notifications every second (NEW)
  setInterval(checkNotifications, 1000);
  // Set up an interval to check timers every second
  // Timers are updated via their individual setIntervals, but this ensures they are always active

  // Set initial state for all zones (e.g., collapsed/expanded)
  const zonesConfig = [
    {
      id: "datesSection",
      contentId: "datesContent",
      expanded: true,
    },
    {
      id: "weightSection",
      contentId: "weightContent",
      expanded: false,
    },
    {
      id: "notesSection",
      contentId: "notesContent",
      expanded: true,
    },
    {
      id: "checklistSection",
      contentId: "checklistContent",
      expanded: false,
    },
    {
      id: "alertsSection",
      contentId: "alertsContent",
      expanded: false,
    },
    {
      id: "locationSection",
      contentId: "locationContent",
      expanded: false,
    },
    {
      id: "tagsSection",
      contentId: "tagsContent",
      expanded: false,
    },
    {
      id: "peopleSection",
      contentId: "peopleContent",
      expanded: false,
    },
    {
      id: "healthIndicatorsSection",
      contentId: "healthIndicatorsContent",
      expanded: false,
    },
    {
      id: "colorSection",
      contentId: "colorContent",
      expanded: false,
    },
    {
      id: "projectsSection",
      contentId: "projectsContent",
      expanded: false,
    },
  ];

  // Initialize zones and set up MutationObservers for dynamic content expansion
  zonesConfig.forEach((zone) => {
    const section = document.getElementById(zone.id);
    const content = document.getElementById(zone.contentId);
    const zoneHeader = section ? section.querySelector(".zone-header") : null;

    if (section && content && zoneHeader) {
      // Initial setup for zones (expand or collapse based on config)
      // The first parameter 'null' is used because there's no event object for initial load
      toggleZone(null, zone.id, zone.contentId, zone.expanded);

      // Generic solution for expanding zones to fit content using MutationObserver
      const observer = new MutationObserver((mutationsList, observer) => {
        // Only re-adjust height if the section is currently expanded
        if (section.classList.contains("expanded")) {
          // Re-calculate and set the height
          section.style.height =
            content.scrollHeight + zoneHeader.offsetHeight + "px";
        }
      });

      // Start observing the content element for changes
      // - childList: Detects when child nodes are added or removed.
      // - subtree: Extends observation to the entire subtree of the content element.
      // - attributes: Detects changes to attributes on the observed node (e.g., style changes).
      observer.observe(content, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }
  });

  // Specific Button Event Listeners (ensuring they are added after elements exist)
  const statusFilterButton = document.getElementById("statusFilterButton");
  if (statusFilterButton)
    statusFilterButton.addEventListener("click", toggleStatusFilterDropdown);

  const addNewChitButton = document.getElementById("addNewChitButton");
  if (addNewChitButton)
    addNewChitButton.addEventListener("click", addProjectItem);
  const addNewPersonButton = document.getElementById("addNewPersonButton");
  if (addNewPersonButton)
    addNewPersonButton.addEventListener("click", addPersonItem);

  const projectMasterToggleButton = document.getElementById(
    "projectMasterToggleButton",
  );
  if (projectMasterToggleButton) toggleProjectMaster(null, true); // Initialize the state of this button

  // Alarm permission and checking interval
  if (
    Notification.permission !== "granted" &&
    Notification.permission !== "denied"
  ) {
    Notification.requestPermission();
  }

  // Global event listeners
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      notesModal &&
      notesModal.style.display === "flex"
    ) {
      event.preventDefault();
      closeNotesModal(false);
    }
    if (
      event.key === "Escape" &&
      alarmModal &&
      alarmModal.style.display === "flex"
    ) {
      event.preventDefault();
      closeAlarmModal(false);
    }
    if (
      event.key === "Escape" &&
      timerModal &&
      timerModal.style.display === "flex"
    ) {
      event.preventDefault();
      closeTimerModal(false);
    }
    if (
      event.key === "Escape" &&
      stopwatchModal &&
      stopwatchModal.style.display === "flex"
    ) {
      event.preventDefault();
      closeStopwatchModal();
    }
    if (
      event.key === "Escape" &&
      notificationModal && // NEW: Notification modal escape
      notificationModal.style.display === "flex"
    ) {
      event.preventDefault();
      closeNotificationModal(false);
    }
    if (
      event.key === "Escape" &&
      document.getElementById("alertModal") &&
      document.getElementById("alertModal").style.display === "flex"
    ) {
      event.preventDefault();
      dismissAlert(); // Dismiss the alarm-has-gone-off modal
    }
  });
  // Re-render items on window resize
  window.onresize = function () {
    renderProjectItems();
    renderPeopleItems();
    renderAlertItems(); // This now renders both generic alerts and alarms
  };
  // Initial state for All Day button
  toggleAllDay(null, true);
  // Initial render of health indicators and their toggle
  renderAllHealthIndicators();
  if (unitToggle)
    unitToggle.addEventListener("change", renderAllHealthIndicators);
  // Initialize color swatches
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      document
        .querySelectorAll(".color-swatch")
        .forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
      const color = swatch.dataset.color;
      selectColor(color);
      document.getElementById("color").value = color;
      document.getElementById("selected-color").style.backgroundColor = color;
    });
  });
  // updateColorPreview(); // Set initial color preview

  // Call loadChitData to initialize the editor with existing data or prepare for new chit
  loadChitData();

  // Attach event listener for the save button (assuming an ID 'saveButton')
  const saveButton = document.getElementById("saveButton");
  if (saveButton) {
    saveButton.addEventListener("click", saveChitData);
  } else {
    console.warn(
      "Save button with ID 'saveButton' not found. Save functionality might be unavailable.",
    );
  }

  // Attach event listener for the delete button (assuming an ID 'deleteButton')
  const deleteButton = document.getElementById("deleteButton");
  if (deleteButton) {
    deleteButton.addEventListener("click", deleteChit);
  } else {
    console.warn("Delete button with ID 'deleteButton' not found.");
  }

  // Example: Event listener for add tag button (assuming an ID 'addTagButton')
  const addTagButton = document.getElementById("addTagButton");
  if (addTagButton) {
    addTagButton.addEventListener("click", () => {
      showCustomConfirm("Enter new tag name:", (response) => {
        // Replaced prompt with custom confirm
        if (response) {
          const tagName = response; // Assuming response from custom confirm is the text
          if (tagName) {
            addTag(tagName);
          }
        }
      });
    });
  }
});
