
function closeTimerModal(saveChanges) {
  timerModal.style.display = "none";
  if (!saveChanges) {
    // Potentially reset form if cancelled without saving
    // This is handled by openTimerModal
  }
}

function addTimer() {
  const name = document.getElementById("timerNameModal").value.trim();
  const hours = parseInt(document.getElementById("timerHoursModal").value) || 0;
  const minutes =
    parseInt(document.getElementById("timerMinutesModal").value) || 0;
  const seconds =
    parseInt(document.getElementById("timerSecondsModal").value) || 0;
  const loop = document.getElementById("timerLoopModal").checked;
  const sound = document.getElementById("timerSoundSelect").value;

  const totalTime = (hours * 3600 + minutes * 60 + seconds) * 1000; // in milliseconds

  if (totalTime <= 0) {
    showCustomAlert("Please set a duration for the timer.");
    return;
  }

  let newTimer = {
    id: generateUniqueTimerId(),
    name,
    time: totalTime, // remaining time
    initialTime: totalTime, // original duration
    running: true,
    loop,
    sound,
    startTime: new Date().toISOString(), // ISO string for persistence
    interval: null, // Placeholder for setInterval ID
  };

  if (editingTimerIndex !== null) {
    // Update existing timer
    const oldTimer = timers[editingTimerIndex];
    clearInterval(oldTimer.interval); // Clear old interval if running

    newTimer.id = oldTimer.id; // Keep original ID
    newTimer.running = oldTimer.running; // Keep running state unless explicitly changed
    newTimer.startTime = oldTimer.startTime; // Keep original start time if not starting fresh

    timers[editingTimerIndex] = newTimer;

    // If it was running, restart it with new duration
    if (newTimer.running) {
      newTimer.interval = setInterval(() => updateTimer(newTimer.id), 1000);
    }

    editingTimerIndex = null;
  } else {
    // Add new timer
    newTimer.interval = setInterval(() => updateTimer(newTimer.id), 1000);
    timers.unshift(newTimer); // Add to the beginning of the array
  }

  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );

  renderAlertItems();
  closeTimerModal(true);
}

function editTimer(event, id) {
  if (event) event.stopPropagation();
  const timerToEdit = timers.find((timer) => timer.id === id);
  if (!timerToEdit) return;

  timerModal.style.display = "flex";
  document.getElementById("timerNameModal").value = timerToEdit.name;
  const hours = Math.floor(timerToEdit.initialTime / 3600000);
  const minutes = Math.floor((timerToEdit.initialTime % 3600000) / 60000);
  const seconds = Math.floor((timerToEdit.initialTime % 60000) / 1000);
  document.getElementById("timerHoursModal").value = hours;
  document.getElementById("timerMinutesModal").value = minutes;
  document.getElementById("timerSecondsModal").value = seconds;
  document.getElementById("timerLoopModal").checked = timerToEdit.loop;
  document.getElementById("timerSoundSelect").value = timerToEdit.sound;

  const submitButton = document.getElementById("modalTimerSubmit");
  submitButton.textContent = "Update Timer";
  submitButton.onclick = () => updateExistingTimer(id); // Set to update existing timer

  editingTimerIndex = timers.findIndex((timer) => timer.id === id); // Set editing index
}

function updateExistingTimer(id) {
  const name = document.getElementById("timerNameModal").value.trim();
  const hours = parseInt(document.getElementById("timerHoursModal").value) || 0;
  const minutes =
    parseInt(document.getElementById("timerMinutesModal").value) || 0;
  const seconds =
    parseInt(document.getElementById("timerSecondsModal").value) || 0;
  const loop = document.getElementById("timerLoopModal").checked;
  const sound = document.getElementById("timerSoundSelect").value;

  const totalTime = (hours * 3600 + minutes * 60 + seconds) * 1000;

  if (totalTime <= 0) {
    showCustomAlert("Please set a duration for the timer.");
    return;
  }

  const timerIndex = timers.findIndex((t) => t.id === id);
  if (timerIndex === -1) return;

  const oldTimer = timers[timerIndex];
  clearInterval(oldTimer.interval); // Clear old interval

  oldTimer.name = name;
  oldTimer.initialTime = totalTime;
  oldTimer.time = totalTime; // Reset current time to new initial time
  oldTimer.loop = loop;
  oldTimer.sound = sound;
  oldTimer.running = false; // Reset to paused after editing, user can restart
  oldTimer.startTime = null; // Clear start time

  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );

  renderAlertItems();
  closeTimerModal(true);
}

function toggleTimer(event, id) {
  if (event) event.stopPropagation();
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;

  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    timer.startTime = null; // Clear start time on pause
  } else {
    if (timer.time <= 0 && !timer.loop) {
      timer.time = timer.initialTime; // If finished and not looping, reset to initial
    }
    timer.running = true;
    timer.startTime = new Date().toISOString();
    timer.interval = setInterval(() => updateTimer(timer.id), 1000);
  }
  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
  renderAlertItems();
}

function resetTimer(event, id) {
  if (event) event.stopPropagation();
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;

  clearInterval(timer.interval);
  timer.running = false;
  timer.time = timer.initialTime;
  timer.startTime = null;
  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
  renderAlertItems();
}

function deleteTimer(event, id) {
  if (event) event.stopPropagation();
  const timerIndex = timers.findIndex((t) => t.id === id);
  if (timerIndex === -1) return;

  clearInterval(timers[timerIndex].interval);
  timers.splice(timerIndex, 1);
  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
  renderAlertItems();
}

function updateTimer(id) {
  const timer = timers.find((t) => t.id === id);
  if (!timer || !timer.running) return;

  timer.time -= 1000; // Decrement by 1 second

  if (timer.time <= 0) {
    showNotification("Timer", timer.name || "Unnamed Timer", false, timer); // No snooze for timers
    const timerSound = new Audio(`sounds/${timer.sound}.mp3`);
    timerSound
      .play()
      .catch((e) => console.error("Error playing timer sound:", e));

    if (timer.loop) {
      timer.time = timer.initialTime; // Reset for next loop
      timer.startTime = new Date().toISOString(); // Update start time for loop
    } else {
      clearInterval(timer.interval);
      timer.running = false;
      timer.startTime = null; // Timer finished
    }
  }
  // No localStorage.setItem("timers", JSON.stringify(timers.map((t) => { const { interval, ...rest } = t; return rest; })), );
  renderAlertItems(); // Re-render to update displayed time
}

/* --- Stopwatch Functions --- */

function addStopwatch() {
  const newStopwatch = {
    id: generateUniqueStopwatchId(),
    name: "New Stopwatch",
    time: 0, // in milliseconds
    running: true,
    laps: [],
    startTime: new Date().toISOString(), // For tracking when it started
    interval: null, // Placeholder for setInterval ID
  };

  newStopwatch.interval = setInterval(
    () => updateStopwatch(newStopwatch.id),
    10,
  ); // Update every 10ms for centiseconds
  stopwatches.unshift(newStopwatch); // Add to the beginning of the array

  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );

  renderAlertItems();
  toggleZone(null, "alertsSection", "alertsContent", true); // Ensure alerts section is expanded
}

function toggleStopwatch(event, id) {
  if (event) event.stopPropagation();
  const stopwatch = stopwatches.find((s) => s.id === id);
  if (!stopwatch) return;

  if (stopwatch.running) {
    clearInterval(stopwatch.interval);
    stopwatch.running = false;
  } else {
    stopwatch.running = true;
    stopwatch.interval = setInterval(() => updateStopwatch(stopwatch.id), 10);
  }
  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
  renderAlertItems(); // Re-render to update the display
}

function lapStopwatch(event, id) {
  if (event) event.stopPropagation();
  const stopwatch = stopwatches.find((s) => s.id === id);
  if (!stopwatch || !stopwatch.running) return;

  const hours = Math.floor(stopwatch.time / 3600000);
  const minutes = Math.floor((stopwatch.time % 3600000) / 60000);
  const seconds = Math.floor((stopwatch.time % 60000) / 1000);
  const centis = Math.floor((stopwatch.time % 1000) / 10);
  const lapTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;

  stopwatch.laps.push(lapTime);
  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
  renderAlertItems(); // Re-render to show new lap
}

function resetStopwatch(event, id) {
  if (event) event.stopPropagation();
  const stopwatch = stopwatches.find((s) => s.id === id);
  if (!stopwatch) return;

  clearInterval(stopwatch.interval);
  stopwatch.running = false;
  stopwatch.time = 0;
  stopwatch.laps = [];
  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
  renderAlertItems(); // Re-render to reset display
}

function deleteStopwatch(event, id) {
  if (event) event.stopPropagation();
  const stopwatchIndex = stopwatches.findIndex((s) => s.id === id);
  if (stopwatchIndex === -1) return;

  clearInterval(stopwatches[stopwatchIndex].interval);
  stopwatches.splice(stopwatchIndex, 1);
  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
  renderAlertItems();
}

function updateStopwatch(id) {
  const stopwatch = stopwatches.find((s) => s.id === id);
  if (!stopwatch || !stopwatch.running) return;

  stopwatch.time += 10; // Increment by 10ms
  // No need to re-render the entire list every 10ms, only when state changes (toggle, lap, reset)
  // The display will be updated by the addStopwatchItemToDOM function on renderAlertItems call
  // However, for real-time update, we would need a more granular update for the specific stopwatch item.
  // For now, we'll rely on the re-renderAlertItems for simplicity, which might be slightly less smooth.
  // A better approach would be to update the specific span for the time directly.
  const stopwatchTimeDisplay = document.querySelector(
    `.stopwatch-item[data-id="${id}"] .stopwatch-time-display`,
  );
  if (stopwatchTimeDisplay) {
    const hours = Math.floor(stopwatch.time / 3600000);
    const minutes = Math.floor((stopwatch.time % 3600000) / 60000);
    const seconds = Math.floor((stopwatch.time % 60000) / 1000);
    const centis = Math.floor((stopwatch.time % 1000) / 10);
    stopwatchTimeDisplay.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  }
}

function openStopwatchModal(event, id) {
  if (event) event.stopPropagation();
  editingStopwatchId = id;
  const stopwatch = stopwatches.find((s) => s.id === id);
  if (!stopwatch) return;

  stopwatchModal.style.display = "flex";
  document.getElementById("stopwatchNameModal").value = stopwatch.name;

  // Update current time display in modal
  const hours = Math.floor(stopwatch.time / 3600000);
  const minutes = Math.floor((stopwatch.time % 3600000) / 60000);
  const seconds = Math.floor((stopwatch.time % 60000) / 1000);
  const centis = Math.floor((stopwatch.time % 1000) / 10);
  document.getElementById("stopwatchCurrentTimeDisplay").textContent =
    `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;

  // Render laps in modal
  const lapsList = document.getElementById("stopwatchLapsList");
  lapsList.innerHTML = "";
  stopwatch.laps.forEach((lap, index) => {
    const lapItem = document.createElement("div");
    lapItem.className = "stopwatch-lap-item";
    lapItem.textContent = `Lap ${index + 1}: ${lap}`;
    lapsList.appendChild(lapItem);
  });
}

function closeStopwatchModal() {
  stopwatchModal.style.display = "none";
  editingStopwatchId = null;
}

function saveStopwatchDetails() {
  const stopwatch = stopwatches.find((s) => s.id === editingStopwatchId);
  if (!stopwatch) return;

  stopwatch.name = document.getElementById("stopwatchNameModal").value.trim();
  // No localStorage.setItem("stopwatches", JSON.stringify(stopwatches.map((s) => { const { interval, ...rest } = s; return rest; })), );
  renderAlertItems();
  closeStopwatchModal();
}

// Color picker functions (ensure these are globally accessible)

function updateColorPreview() {
  console.log("updateColorPreview() start");
  const colorInput = document.getElementById("color");
  const selectedColorSwatch = document.getElementById("selected-color");
  const color = colorInput.value;
  selectedColorSwatch.style.backgroundColor = color;
  selectColor(color);

  document.querySelectorAll(".color-swatch").forEach((s) => {
    if (
      s.dataset.color &&
      s.dataset.color.toLowerCase() === color.toLowerCase()
    ) {
      s.classList.add("selected");
    } else {
      s.classList.remove("selected");
    }
  });
}

// This function will now be called by your HTML onclick, receiving the color string.
function selectColor(color) {
  console.log("selectColor() start");
  // Optional: Log to console to confirm it's working and the color is correct
  console.log("Color selected:", color);

  // Set the background color of the .editor div
  document.querySelector(".editor").style.backgroundColor = color;
  document.querySelector(".header-row").style.backgroundColor = color;

  // Optional: Update the text input field with the selected color
  const colorInputField = document.getElementById("color");
  if (colorInputField) {
    colorInputField.value = color;
  }

  // Optional: Update the small color preview circle next to the input
  const selectedColorPreview = document.getElementById("selected-color");
  if (selectedColorPreview) {
    selectedColorPreview.style.backgroundColor = color;
  }

  // Optional: Add/remove 'selected' class to color swatches to indicate the active one
  // (Your HTML uses class="color-swatch")
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    // Find the color value from the swatch's data-color attribute
    const swatchColorValue = swatch.dataset.color;
    if (swatchColorValue === color) {
      swatch.classList.add("selected"); // Add 'selected' to the clicked swatch
    } else {
      swatch.classList.remove("selected"); // Remove 'selected' from others
    }
  });

  // Removed: localStorage.setItem("selectedBackgroundColor", color);
}

// This function was originally at the top of the file, moved here for context
// and modified to be part of the main data flow.
async function loadChitData() {
  console.log("loadChitData() started");
  const urlParams = new URLSearchParams(window.location.search);
  const chitId = urlParams.get("chitId"); // Get chitId from URL parameter

  if (chitId) {
    try {
      const response = await fetch(`/api/chits/${chitId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Chit not found. Creating a new one.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const chit = await response.json();
      console.log("Fetched chit:", chit);

      // Populate basic editor fields
      document.getElementById("title").value = chit.title || "";
      document.getElementById("description").value = chit.description || "";
      document.getElementById("status").value = chit.status || "todo";
      document.getElementById("dueDate").value = chit.dueDate
        ? new Date(chit.dueDate).toISOString().split("T")[0]
        : "";
      document.getElementById("dueTime").value = chit.dueTime || "";
      document.getElementById("allDay").checked = chit.allDay || false;
      selectColor(chit.color || "#ffffff"); // Assuming selectColor exists and handles UI update
      document.getElementById("isPinned").checked = chit.isPinned || false;
      document.getElementById("isArchived").checked = chit.isArchived || false;

      // Populate nested data arrays
      alarms = chit.alarms || [];
      timers = chit.timers || [];
      stopwatches = chit.stopwatches || [];
      notifications = chit.notifications || [];
      checklistItemsData = chit.checklist_items || [];

      // Render nested UI elements
      renderAlarms();
      renderTimers();
      renderStopwatches();
      renderNotifications();
      renderChecklist();

      // Store the current chit ID for saving operations
      currentChitId = chit.id;

      // After loading chit data, ensure tags are loaded and selections are updated
      await loadTags(); // Load all available tags
      updateSelectedTagsUI(chit.tags); // Function to mark selected tags in the UI

      console.log("Chit data loaded and UI populated.");
    } catch (error) {
      console.error("Failed to load chit data:", error);
      showCustomAlert(
        `Error loading chit: ${error.message}. Preparing for a new chit.`,
      ); // Replaced alert
      currentChitId = null; // Ensure it's treated as a new chit
      resetEditorForNewChit(); // Reset fields for a new chit
      await loadTags(); // Load tags even for a new chit
    }
  } else {
    console.log("No chitId found in URL, preparing for a new chit.");
    currentChitId = null;
    resetEditorForNewChit(); // Reset fields for a new chit
    await loadTags(); // Load tags for a new chit
  }
}

// Helper function to reset editor fields for a new chit
function resetEditorForNewChit() {
  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  document.getElementById("status").value = "todo";
  document.getElementById("dueDate").value = "";
  document.getElementById("dueTime").value = "";
  document.getElementById("allDay").checked = false;
  selectColor("#ffffff");
  document.getElementById("isPinned").checked = false;
  document.getElementById("isArchived").checked = false;

  alarms = [];
  timers = [];
  stopwatches = [];
  notifications = [];
  checklistItemsData = [];
  activeTags = []; // Reset active tags for a new chit
  // tagsData will be reloaded by loadTags()

  renderAlarms();
  renderTimers();
  renderStopwatches();
  renderNotifications();
  renderChecklist();
  // Clear tag selections in UI
  document.querySelectorAll(".tag-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });
  console.log("Editor reset for new chit.");
}

// Function to update tag selections in UI after loading chit
function updateSelectedTagsUI(selectedTagIds) {
  // Clear existing activeTags before populating
  activeTags = [];
  document.querySelectorAll(".tag-checkbox").forEach((checkbox) => {
    if (selectedTagIds && selectedTagIds.includes(checkbox.dataset.tagId)) {
      checkbox.checked = true;
      activeTags.push(checkbox.dataset.tagId); // Add to activeTags array
    } else {
      checkbox.checked = false;
    }
  });
  renderActiveTags(); // Re-render the active tags section to reflect changes
  console.log("Selected tags UI updated based on chit data.");
}

async function loadTags() {
  console.log("loadTags() started");
  try {
    const response = await fetch("/api/tags");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const fetchedTags = await response.json();
    console.log("Fetched tags:", fetchedTags);
    tagsData = fetchedTags; // Update the global tagsData array
    renderTagTree(); // Call your existing function to render the tag tree/selector
    renderTagGrid(); // Also re-render tag grid for most used/recent/fav tags
    console.log("Tags loaded and tree rendered.");
  } catch (error) {
    console.error("Failed to load tags:", error);
    showCustomAlert(`Error loading tags: ${error.message}`); // Replaced alert
  }
}

// Placeholder for your tag rendering function. Update this to use `tagsData`.
function renderTagTree() {
  const tagContainer = document.getElementById("tag-selector-container"); // Example ID for a container div
  if (!tagContainer) return;
  tagContainer.innerHTML = ""; // Clear existing tags

  // Filter out soft-deleted tags for rendering
  const activeTagsFromBackend = tagsData.filter((tag) => !tag.isSoftDeleted);

  // Simple rendering of tags with checkboxes
  activeTagsFromBackend.forEach((tag) => {
    const tagElement = document.createElement("div");
    tagElement.className =
      "flex items-center space-x-2 p-1 text-gray-700 hover:bg-gray-100 rounded-md"; // Tailwind classes for styling

    tagElement.innerHTML = `
      <input type="checkbox" class="tag-checkbox form-checkbox h-4 w-4 text-indigo-600 rounded" data-tag-id="${tag.id}" id="tag-checkbox-${tag.id}">
      <label for="tag-checkbox-${tag.id}" class="text-sm cursor-pointer flex-grow">${tag.name}</label>
      <button onclick="updateTag('${tag.id}', {isFavorite: !${tag.isFavorite}})" class="text-gray-400 hover:text-yellow-500 text-lg" title="${tag.isFavorite ? "Remove from Favorites" : "Add to Favorites"}">
        <i class="${tag.isFavorite ? "fas fa-star" : "far fa-star"}"></i>
      </button>
      <button onclick="removeTag('${tag.id}')" class="text-gray-400 hover:text-red-500 text-lg" title="Delete Tag">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;
    tagContainer.appendChild(tagElement);

    // Add event listener for checkbox to handle selection changes
    const checkbox = tagElement.querySelector(".tag-checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", (event) => {
        const tagId = event.target.dataset.tagId;
        if (event.target.checked) {
          if (!activeTags.includes(tagId)) {
            activeTags.push(tagId);
          }
        } else {
          activeTags = activeTags.filter((id) => id !== tagId);
        }
        renderActiveTags(); // Re-render active tags section to update counts/display
        console.log(
          `Tag ${tag.name} (${tag.id}) selected: ${event.target.checked}`,
        );
      });
    }
  });
  console.log("Tag tree rendered.");
}

async function addTag(tagName, parentId = null) {
  console.log("addTag() started with name:", tagName, "parentId:", parentId);
  try {
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: tagName, parentId: parentId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const newTag = await response.json();
    console.log("Tag added successfully:", newTag);
    showCustomAlert(`Tag '${newTag.name}' added!`); // Replaced alert
    await loadTags(); // Re-fetch and re-render all tags to sync UI
  } catch (error) {
    console.error("Failed to add tag:", error);
    showCustomAlert(`Error adding tag: ${error.message}`); // Replaced alert
  }
}

async function updateTag(tagId, updatedFields) {
  console.log(
    "updateTag() started for tagId:",
    tagId,
    "fields:",
    updatedFields,
  );
  try {
    const response = await fetch(`/api/tags/${tagId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedFields), // e.g., { name: 'New Name', isFavorite: true, parentId: 'new-parent-id' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const updatedTag = await response.json();
    console.log("Tag updated successfully:", updatedTag);
    showCustomAlert(`Tag '${updatedTag.name}' updated!`); // Replaced alert
    await loadTags(); // Re-fetch and re-render all tags to sync UI
  } catch (error) {
    console.error("Failed to update tag:", error);
    showCustomAlert(`Error updating tag: ${error.message}`); // Replaced alert
  }
}

async function removeTag(tagId) {
  console.log("removeTag() started for tagId:", tagId);
  showCustomConfirm(
    "Are you sure you want to delete this tag? This action will mark it as soft-deleted and cannot be undone.", // Updated message
    async (confirmed) => {
      if (confirmed) {
        try {
          const response = await fetch(`/api/tags/${tagId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          console.log(
            `Tag ${tagId} deleted successfully (soft-deleted on backend).`,
          );
          showCustomAlert("Tag deleted successfully!"); // Replaced alert
          await loadTags(); // Re-fetch and re-render all tags to sync UI (soft-deleted tag should disappear)
        } catch (error) {
          console.error("Failed to remove tag:", error);
          showCustomAlert(`Error removing tag: ${error.message}`); // Replaced alert
        }
      } else {
        console.log("Tag deletion cancelled.");
      }
    },
  );
}
