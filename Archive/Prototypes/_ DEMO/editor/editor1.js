// Global Variable Declarations (Declared Once at the Top)

// Current Chit ID - Null if new chit, otherwise the ID of the existing chit
let currentChitId = null;

// Notes Modals
let notesMarkdownInput;
let notesRenderedOutput;
let notesMarkdownInputModal;
let notesRenderedOutputModal;
let notesModal;

// Utility for generating unique IDs for nested items
function generateUniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Alarm Modals and Data
let alarmModal;
let alarmTimeInput;
let alarmRecurrenceSelect;
let alarmSoundSelect;
let alarms = []; // Array to hold alarm objects, will be populated from backend

// Timer Modals and Data
let timerModal;
let timers = []; // Array to hold timer objects, will be populated from backend
let editingTimerIndex = null;

// Stopwatch Modals and Data
let stopwatchModal;
let stopwatches = []; // Array to hold stopwatch objects, will be populated from backend
let editingStopwatchId = null; // To keep track of the stopwatch being edited

// Notification Modals and Data (NEW)
let notificationModal;
let notificationValueInput;
let notificationUnitSelect;
let notificationRelativeToToggle;
let notifications = []; // Array to hold notification objects, will be populated from backend

// Checklist Data
const MAX_INDENT_LEVEL = 3;
let checklistItemsData = []; // Will be populated from backend
let draggedItemData = null; // Store the data object of the dragged item
let draggedGroupData = []; // Store data objects of the dragged item and its children

// Tags Data
let tagsData = []; // Will be populated from backend, removed hardcoded data
let activeTags = []; // Stores IDs of active tags

// Project Data
let projectItemsData = [
  {
    id: "proj-1",
    text: "Define project scope",
    status: "ToDo",
    dueDate: "2025-06-15",
  },
  {
    id: "proj-2",
    text: "Gather requirements",
    status: "ToDo",
    dueDate: "2025-06-20",
  },
  {
    id: "proj-3",
    text: "Design architecture",
    status: "In Progress",
    dueDate: "2025-06-25",
  },
  {
    id: "proj-4",
    text: "Develop core features",
    status: "In Progress",
    dueDate: "2025-07-05",
  },
  {
    id: "proj-5",
    text: "Conduct testing",
    status: "Blocked",
    dueDate: "2025-07-10",
  },
  {
    id: "proj-6",
    text: "Fix critical bugs",
    status: "Blocked",
    dueDate: "2025-07-12",
  },
  {
    id: "proj-7",
    text: "Deploy to production",
    status: "Complete",
    dueDate: "2025-07-15",
  },
  {
    id: "proj-8",
    text: "Monitor performance",
    status: "Complete",
    dueDate: "2025-07-20",
  },
];
const availableStatuses = [
  { name: "ToDo", icon: "fas fa-clipboard-list" },
  { name: "In Progress", icon: "fas fa-tasks" },
  { name: "Blocked", icon: "fas fa-ban" },
  { name: "Backlog", icon: "fas fa-hourglass-start" },
  { name: "Complete", icon: "fas fa-check-circle" },
];
let draggedProjectItemData = null;
let activeStatusesFilter = [];

// People Data
let peopleItemsData = [
  { id: "person-1", text: "John Doe", role: "Owners" },
  { id: "person-2", text: "Jane Smith", role: "Stakeholders" },
  { id: "person-3", text: "Bob Johnson", role: "Editors" },
  { id: "person-4", text: "Alice Williams", role: "Assignees" },
  { id: "person-5", text: "Chris Brown", role: "Guests" },
  { id: "person-6", text: "Sarah Davis", role: "Followers" },
  { id: "person-7", text: "Michael Lee", role: "Owners" },
];
const availableRoles = [
  { name: "Owners", icon: "fas fa-crown" },
  { name: "Stakeholders", icon: "fas fa-handshake" },
  { name: "Editors", icon: "fas fa-edit" },
  { name: "Assignees", icon: "fas fa-user-check" },
  { name: "Guests", icon: "fas fa-user-tag" },
  { name: "Followers", icon: "fas fa-star" },
];
let draggedPeopleItemData = null;
let activeRolesFilter = availableRoles.map((r) => r.name);

// Alerts Data
let alertsItemsData = [
  {
    id: "alert-3",
    text: "Workout Tracking",
    type: "Stopwatches",
  },
];
const availableAlertTypes = [
  { name: "Alarms", icon: "fas fa-clock" },
  { name: "Timers", icon: "fas fa-stopwatch" },
  { name: "Stopwatches", icon: "fas fa-hourglass-half" }, // Added Stopwatches here
  { name: "Notifications", icon: "fas fa-bell" }, // Added Notifications
  { name: "Reminders", icon: "fas fa-clipboard-list" },
  { name: "Events", icon: "fas fa-calendar-day" },
];
let draggedAlertItemData = null; // Correctly declared once
let activeAlertTypesFilter = availableAlertTypes.map((t) => t.name);

// Weather Data
const weatherIcons = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};
let currentWeatherLat = 45.7876878; // Default to Lockwood, MT
let currentWeatherLon = -108.4557997;

// Location Data
let currentMapUrl = "";
// Health Indicators
const healthData = {};
// These elements are initialized in DOMContentLoaded
let unitToggle;
let sexToggle;
let reproductionSection;
const healthIndicatorConfigs = {
  heartRate: {
    icon: "💓",
    label: "Heart Rate",
    unit: { metric: "BPM", imperial: "BPM" },
  },
  hrv: {
    icon: "📈",
    label: "HR Variability",
    unit: { metric: "ms", imperial: "ms" },
  },
  bp: {
    icon: "🩺",
    label: "Blood Pressure",
    unit: { metric: "mmHg", imperial: "mmHg" },
  },
  glucose: {
    icon: "🩸",
    label: "Glucose",
    unit: { metric: "mmol/L", imperial: "mg/dL" },
    step: 0.1,
  },
  spo2: {
    icon: "🌬️",
    label: "Oxygen",
    unit: { metric: "%", imperial: "%" },
    step: 1,
  },
  respiratory: {
    icon: "🌬️",
    label: "Respiratory",
    unit: { metric: "breaths/min", imperial: "breaths/min" },
    step: 1,
  },
  temperature: {
    icon: "🌡️",
    label: "Temperature",
    unit: { metric: "°C", imperial: "°F" },
    step: 0.1,
  },
  steps: {
    icon: "👣",
    label: "Steps",
    unit: { metric: "steps", imperial: "steps" },
    step: 1,
  },
  distance: {
    icon: "📏",
    label: "Distance",
    unit: { metric: "km", imperial: "miles" },
    step: 0.1,
  },
  exercise: {
    icon: "🏋️",
    label: "Exercise",
    unit: { metric: "minutes", imperial: "minutes" },
    step: 1,
  },
  caloriesBurned: {
    icon: "🔥",
    label: "Calories Burned",
    unit: { metric: "kcal", imperial: "kcal" },
    step: 1,
  },
  calories: {
    icon: "🍽️",
    label: "Calories",
    unit: { metric: "kcal", imperial: "kcal" },
    step: 1,
  },
  water: {
    icon: "💧",
    label: "Water",
    unit: { metric: "ml", imperial: "oz" },
    step: 1,
  },
  weight: {
    icon: "⚖️",
    label: "Weight",
    unit: { metric: "kg", imperial: "lbs" },
    step: 0.1,
  },
  bodyFat: {
    icon: "📏",
    label: "Body Fat",
    unit: { metric: "%", imperial: "%" },
    step: 0.1,
  },
  waist: {
    icon: "📏",
    label: "Waist",
    unit: { metric: "cm", imperial: "inches" },
    step: 0.1,
  },
  sleepHours: {
    icon: "🛌",
    label: "Sleep",
    unit: { metric: "hours", imperial: "hours" },
    step: 0.1,
  },
  intercourse: {
    icon: "👩‍❤️‍👨",
    label: "Intercourse",
    unit: { metric: "count", imperial: "count" },
    step: 1,
  },
  cycle: { icon: "🌸", label: "Cycle Tracking" },
};
// Favicon and Title Flash
let faviconInterval = null;
let titleInterval = null;
const originalFavicon = "logo.png";
const alertFavicon = "alert_icon.png";
let originalTitle = document.title; // Initialized in DOMContentLoaded

/* --- Utility Functions --- */

// Function to generate a unique ID
function generateUniqueAlarmId() {
  return "alarm-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}
function generateUniqueTimerId() {
  return "timer-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}
function generateUniqueStopwatchId() {
  return (
    "stopwatch-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
  );
}
function generateUniqueNotificationId() {
  return (
    "notification-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
  );
}

// Custom Alert Modal (replacement for window.alert)
function showCustomAlert(message) {
  const modalHtml = `
                                <div id="customAlertModal" class="modal-overlay">
                                    <div class="modal-content" style="max-width: 400px; height: auto;">
                                        <div class="modal-header">
                                        <h2>Notification</h2>
                                        </div>
                                        <div class="modal-body" style="text-align: center;">
                                            <p>${message}</p>
                                        </div>
                                        <div class="modal-buttons">
                                            <button type="button" onclick="document.getElementById('customAlertModal').remove()">OK</button>
                                        </div>
                                    </div>
                                </div>
                            `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// Custom Confirm Modal (replacement for window.confirm)
function showCustomConfirm(message, callback) {
  const modalHtml = `
                                <div id="customConfirmModal" class="modal-overlay">
                                    <div class="modal-content" style="max-width: 400px; height: auto;">
                                        <div class="modal-header">
                                            <h2>Confirmation</h2>
                                        </div>
                                        <div class="modal-body" style="text-align: center;">
                                            <p>${message}</p>
                                        </div>
                                        <div class="modal-buttons">
                                            <button type="button" onclick="document.getElementById('customConfirmModal').remove(); ${callback}(true);">Yes</button>
                                            <button type="button" onclick="document.getElementById('customConfirmModal').remove(); ${callback}(false);">No</button>
                                        </div>
                                    </div>
                                </div>
                            `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// Standardized Zone Toggle Function
function toggleZone(event, sectionId, contentId, forceExpand = null) {
  if (event) {
    // Check if the clicked element or its closest parent is a button within zone-actions
    const isActionButton = event.target.closest(".zone-actions button");
    if (isActionButton) {
      event.stopPropagation(); // Prevent the zone header from toggling
      return; // Exit the function to let the button's own onclick handle the event
    }
    // If the click is on the header itself, but not directly on an action button, allow toggle
    if (event.currentTarget.classList.contains("zone-header")) {
      // No need to stopPropagation here if it's the intended toggle target
    }
  }
  const section = document.getElementById(sectionId);
  const content = document.getElementById(contentId);
  const toggleIcon = section.querySelector(".zone-toggle-icon");
  const zoneActions = section.querySelector(".zone-actions");
  let shouldExpand;
  if (forceExpand !== null) {
    shouldExpand = forceExpand;
  } else {
    shouldExpand = section.classList.contains("collapsed");
  }

  if (shouldExpand) {
    section.classList.remove("collapsed");
    section.classList.add("expanded");
    content.style.display = "block";
    section.style.height =
      content.scrollHeight +
      section.querySelector(".zone-header").offsetHeight +
      "px";
    toggleIcon.textContent = "🔼";
    if (zoneActions) {
      zoneActions.style.display = "flex";
    }
  } else {
    section.classList.remove("expanded");
    section.classList.add("collapsed");
    content.style.display = "none";
    section.style.height = "48px";
    if (zoneActions) {
      zoneActions.style.display = "none";
    }
    toggleIcon.textContent = "🔽";
  }

  // Special handling for Tags section buttons
  const expandAllBtn = document.getElementById("expand-all-tags-button");
  const collapseAllBtn = document.getElementById("collapse-all-tags-button");
  const createNewBtn = document.getElementById("create-new-tag-button");
  if (
    sectionId === "tagsSection" &&
    expandAllBtn &&
    collapseAllBtn &&
    createNewBtn
  ) {
    if (section.classList.contains("expanded")) {
      expandAllBtn.style.display = "inline-flex";
      collapseAllBtn.style.display = "inline-flex";
      createNewBtn.style.display = "inline-flex";
    } else {
      expandAllBtn.style.display = "none";
      collapseAllBtn.style.display = "none";
      createNewBtn.style.display = "none";
    }
  }
  // Special handling for Dates section All Day button
  const allDayButton = document.getElementById("allDayToggleButton");
  if (sectionId === "datesSection" && allDayButton) {
    if (section.classList.contains("expanded")) {
      allDayButton.style.display = "inline-flex";
    } else {
      allDayButton.style.display = "none";
    }
  }
}

/* --- Weather Functions --- */

function getPrecipType(code) {
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "";
}

async function getCoordinates(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length === 0) throw new Error("Location not found.");
  return {
    lat: data[0].lat,
    lon: data[0].lon,
    display_name: data[0].display_name,
  };
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  return await res.json();
}

async function updateCompactWeather(
  lat = currentWeatherLat,
  lon = currentWeatherLon,
) {
  const weatherSection = document.getElementById("compactWeatherSection");
  weatherSection.innerHTML = "Weather Loading...";

  try {
    const weatherData = await getWeather(lat, lon);
    if (
      !weatherData.daily ||
      !weatherData.daily.time ||
      weatherData.daily.time.length === 0
    ) {
      weatherSection.innerHTML = "No weather data available.";
      return;
    }

    const today = {
      date: weatherData.daily.time[0],
      weathercode: weatherData.daily.weathercode[0],
      minC: weatherData.daily.temperature_2m_min[0],
      maxC: weatherData.daily.temperature_2m_max[0],
      precipitation_sum: weatherData.daily.precipitation_sum[0],
    };
    const icon = weatherIcons[today.weathercode] || "❓";
    const minF = Math.round((today.minC * 9) / 5 + 32);
    const maxF = Math.round((today.maxC * 9) / 5 + 32);
    const mm = Math.ceil(today.precipitation_sum);
    const inches = Math.ceil(mm * 0.0393701 * 10) / 10;
    const precipAmt = `${inches} inch`;
    const precipType = getPrecipType(today.weathercode);
    const precip = precipType
      ? `<div class="precip">${precipAmt} ${precipType}</div>`
      : "";
    const barMin = -14; // Imperial min
    const barMax = 104;
    // Imperial max
    const range = barMax - barMin;
    const startPct = ((minF - barMin) / range) * 100;
    const endPct = ((maxF - barMin) / range) * 100;
    let tempMarks = "";

    for (let temp = Math.ceil(barMin / 10) * 10; temp <= barMax; temp += 10) {
      const position = ((temp - barMin) / range) * 100;
      let labelStyle = `left: ${position}%; transform: translateX(-50%);`;

      if (temp === Math.ceil(barMin / 10) * 10) {
        labelStyle = `left: 0%;
            transform: translateX(0%);`;
      } else if (temp === Math.floor(barMax / 10) * 10) {
        labelStyle = `right: 0%;
            transform: translateX(0%);`;
      }

      tempMarks += `<div class="temperature-line" style="left: ${position}%;"></div>`;
      if (position >= 0 && position <= 100) {
        tempMarks += `<div class="temperature-label" style="${labelStyle}">${temp}º</div>`;
      }
    }

    const compactWeatherSection = document.getElementById(
      "compactWeatherSection",
    );
    const compactWeatherBackgroundColor = getComputedStyle(
      compactWeatherSection,
    ).backgroundColor;
    const tempMaskStyle = `background-color: ${compactWeatherBackgroundColor};`;
    weatherSection.innerHTML = `
                                            <div class="weather-display">
                                                <div class="weather-info-and-precip">
                                                    <div><span class="icon">${icon}</span> ${maxF}º / ${minF}º</div>
                                                    ${precip}
                                                </div>
                                                <div class="temperature-track">
                                                    <div class="temperature-mask" style="left:0%; width:${startPct}%; ${tempMaskStyle}"></div>
                                                    <div class="temperature-fill" style="left:${startPct}%; width:${endPct - startPct}%;"></div>
                                                    <div class="temperature-mask" style="right:0%; width:${100 - endPct}%; ${tempMaskStyle}"></div>
                                                    ${tempMarks}
                                                </div>
                                            </div>
                                    `;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    weatherSection.innerHTML = "Weather Not Available";
  }
}

/* --- Location Functions --- */

function searchLocationMap(event) {
  if (event) event.stopPropagation();
  const locationInput = document.getElementById("locationInput");
  const locationErrorDiv = document.getElementById("location-error");
  const locationLoadingDiv = document.getElementById("location-loading");
  const locationMapDiv = document.getElementById("location-map");
  const hiddenLocationInput = document.getElementById("location");

  const address = locationInput.value.trim();
  if (!address) {
    locationErrorDiv.textContent = "Please enter a location.";
    locationErrorDiv.style.display = "block";
    locationMapDiv.style.display = "none";
    return;
  }

  locationLoadingDiv.style.display = "block";
  locationErrorDiv.style.display = "none";
  locationMapDiv.style.display = "none";
  try {
    getCoordinates(address)
      .then((coords) => {
        const lat = coords.lat;
        const lon = coords.lon;
        const displayName = coords.display_name;

        hiddenLocationInput.value = displayName;
        locationInput.value = displayName;

        currentMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon) - 0.05}%2C${parseFloat(lat) - 0.02}%2C${parseFloat(lon) + 0.05}%2C${parseFloat(lat) + 0.02}&layer=mapnik&marker=${lat}%2C${lon}`;
        locationMapDiv.innerHTML = `<iframe src="${currentMapUrl}" allowfullscreen></iframe>`;
        locationMapDiv.style.display = "block";
        locationLoadingDiv.style.display = "none";
        currentWeatherLat = lat;
        currentWeatherLon = lon;
        updateCompactWeather();
      })
      .catch((error) => {
        console.error("Error fetching location data:", error);
        locationErrorDiv.textContent =
          "Error fetching location data. Please try again.";
        locationErrorDiv.style.display = "block";
        locationLoadingDiv.style.display = "none";
      });
  } catch (error) {
    console.error("Error fetching location data:", error);
    locationErrorDiv.textContent =
      "Error fetching location data. Please try again.";
    locationErrorDiv.style.display = "block";
    locationLoadingDiv.style.display = "none";
  }
}

function handleLocationInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    searchLocationMap(event);
  }
}

function openLocationInNewTab(event) {
  if (event) event.stopPropagation();
  if (currentMapUrl) {
    window.open(currentMapUrl.replace("/embed.html", "/?"), "_blank");
  } else {
    showCustomAlert("Please search for a location first.");
  }
}

function openLocationDirections(event) {
  if (event) event.stopPropagation();
  const locationInput = document.getElementById("locationInput");
  const address = locationInput.value.trim();
  if (address) {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=$${encodeURIComponent(address)}`;
    window.open(googleMapsUrl, "_blank");
  } else {
    showCustomAlert("Please enter a location to get directions.");
  }
}

/* --- Dates & Times Functions --- */

function toggleAllDay(event, initialLoad = false) {
  if (event) event.stopPropagation();
  const allDayCheckbox = document.getElementById("allDay"); // Get the checkbox element
  const allDayToggleButton = document.getElementById("allDayToggleButton");
  const startTimeInput = document.getElementById("start_time");
  const endTimeInput = document.getElementById("end_time");
  const dueTimeInput = document.getElementById("dueTime");
  const allDayIcon = allDayToggleButton
    ? allDayToggleButton.querySelector("i")
    : null;

  // Add null check for allDayCheckbox
  if (!allDayCheckbox) {
    console.error("Element with ID 'allDay' not found.");
    return;
  }

  if (!initialLoad) {
    // Toggle the checkbox state
    allDayCheckbox.checked = !allDayCheckbox.checked;
  }

  const isAllDay = allDayCheckbox.checked;

  if (isAllDay) {
    startTimeInput.value = "";
    endTimeInput.value = "";
    dueTimeInput.value = "";

    startTimeInput.style.display = "none";
    endTimeInput.style.display = "none";
    dueTimeInput.style.display = "none";
    if (allDayToggleButton) allDayToggleButton.classList.add("active");
    if (allDayIcon) {
      allDayIcon.classList.remove("far", "fa-sun");
      allDayIcon.classList.add("fas", "fa-sun");
    }
    if (allDayToggleButton) allDayToggleButton.title = "All Day (Active)";
  } else {
    startTimeInput.style.display = "block";
    endTimeInput.style.display = "block";
    dueTimeInput.style.display = "block";
    if (allDayToggleButton) allDayToggleButton.classList.remove("active");
    if (allDayIcon) {
      allDayIcon.classList.remove("fas", "fa-sun");
      allDayIcon.classList.add("far", "fa-sun");
    }
    if (allDayToggleButton) allDayToggleButton.title = "All Day (Inactive)";
  }
}

/* --- Pinned & Archived Functions --- */

function updatePinnedIcon(isPinned) {
  const pinnedButton = document.getElementById("pinnedButton");
  const pinnedIcon = pinnedButton.querySelector("i");
  const isPinnedCheckbox = document.getElementById("isPinned"); // Changed to match data flow

  if (isPinned) {
    pinnedIcon.classList.remove("far", "fa-bookmark");
    pinnedIcon.classList.add("fas", "fa-bookmark");
    pinnedButton.classList.add("active");
    isPinnedCheckbox.checked = true;
  } else {
    pinnedIcon.classList.remove("fas", "fa-bookmark");
    pinnedIcon.classList.add("far", "fa-bookmark");
    pinnedButton.classList.remove("active");
    isPinnedCheckbox.checked = false;
  }
}

function togglePinned() {
  const isPinnedCheckbox = document.getElementById("isPinned"); // Changed to match data flow
  updatePinnedIcon(!isPinnedCheckbox.checked);
}

function updateArchivedIcon(isArchived) {
  const archivedButton = document.getElementById("archivedButton");
  const archivedIcon = archivedButton.querySelector("i");
  const isArchivedCheckbox = document.getElementById("isArchived"); // Changed to match data flow
  if (isArchived) {
    archivedIcon.classList.remove("far", "fa-box-open");
    archivedIcon.classList.add("fas", "fa-box-archive");
    archivedButton.classList.add("archived-active");
    isArchivedCheckbox.checked = true;
  } else {
    archivedIcon.classList.remove("fas", "fa-box-archive");
    archivedIcon.classList.add("far", "fa-box-open");
    archivedButton.classList.remove("archived-active");
    isArchivedCheckbox.checked = false;
  }
  applyArchivedState();
}

function toggleArchived() {
  const isArchivedCheckbox = document.getElementById("isArchived"); // Changed to match data flow
  updateArchivedIcon(!isArchivedCheckbox.checked);
}

function applyArchivedState() {
  const isArchivedCheckbox = document.getElementById("isArchived"); // Changed to match data flow
  const mainEditor = document.getElementById("mainEditor");
  const isArchived = isArchivedCheckbox.checked;
  if (isArchived) {
    mainEditor.classList.add("archived");
    const formElements = mainEditor.querySelectorAll(
      "input, select, textarea, button:not(.status-icon-button)",
    );
    formElements.forEach((element) => {
      if (element.id !== "pinnedButton" && element.id !== "archivedButton") {
        element.disabled = true;
      }
    });
    const contentEditableDivs = mainEditor.querySelectorAll(
      '[contenteditable="true"]',
    );
    contentEditableDivs.forEach((div) => {
      div.contentEditable = "false";
      div.style.cursor = "not-allowed";
    });
  } else {
    mainEditor.classList.remove("archived");
    const formElements = mainEditor.querySelectorAll(
      "input, select, textarea, button:not(.status-icon-button)",
    );
    formElements.forEach((element) => {
      element.disabled = false;
    });
    const contentEditableDivs = mainEditor.querySelectorAll(
      '[contenteditable="false"]',
    );
    contentEditableDivs.forEach((div) => {
      div.contentEditable = "true";
      div.style.cursor = "text";
    });
  }
}

/* --- Notes Functions --- */

function getMarkdownFromContentEditable(element) {
  let markdown = element.innerText || "";
  markdown = markdown.replace(/\r\n/g, "\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();
  return markdown;
}

function setMarkdownToContentEditable(element, markdown) {
  element.innerHTML = markdown.replace(/\n/g, "<br>");
}

function updateNotesPreview() {
  const markdown = getMarkdownFromContentEditable(notesMarkdownInput);
  notesRenderedOutput.innerHTML = marked.parse(markdown);
  document.getElementById("description").value = markdown;
}

function updateModalNotesPreview() {
  const markdown = getMarkdownFromContentEditable(notesMarkdownInputModal);
  notesRenderedOutputModal.innerHTML = marked.parse(markdown);
}

function switchToRenderedView() {
  notesMarkdownInput.style.display = "none";
  notesRenderedOutput.style.display = "block";
  updateNotesPreview();
}

function switchToEditorView() {
  notesMarkdownInput.style.display = "block";
  notesRenderedOutput.style.display = "none";
  notesMarkdownInput.focus();
}

function toggleNotesViewMode(event) {
  if (event) event.stopPropagation();
  if (notesMarkdownInput.style.display === "none") {
    // If currently showing rendered, switch to editor
    switchToEditorView();
  } else {
    // If currently showing editor, switch to rendered
    switchToRenderedView();
  }
}

function openNotesModal(event) {
  if (event) event.stopPropagation();
  const markdownContent = document.getElementById("description").value; // Get description from main input
  setMarkdownToContentEditable(notesMarkdownInputModal, markdownContent);
  notesModal.style.display = "flex";
  notesMarkdownInputModal.focus();
  notesMarkdownInputModal.style.display = "block"; // Ensure input is visible on open
  notesRenderedOutputModal.style.display = "none"; // Ensure rendered is hidden on open
  updateModalNotesPreview();

  // Ensure the main notes section is expanded when the modal is opened
  const notesSection = document.getElementById("notesSection");
  const notesContent = document.getElementById("notesContent");
  notesSection.classList.remove("collapsed");
  notesSection.classList.add("expanded");
  notesContent.style.display = "block";
  // Recalculate and set the height to ensure it fits content
  notesSection.style.height =
    notesContent.scrollHeight +
    notesSection.querySelector(".zone-header").offsetHeight +
    "px";
}

function closeNotesModal(saveChanges) {
  if (saveChanges) {
    const markdownContent = getMarkdownFromContentEditable(
      notesMarkdownInputModal,
    );
    document.getElementById("description").value = markdownContent; // Update main description input
    updateNotesPreview(); // This also updates the main notes input
  }
  notesModal.style.display = "none";
  // After closing modal, ensure the main notes section is expanded
  const notesSection = document.getElementById("notesSection");
  const notesContent = document.getElementById("notesContent");
  notesSection.classList.remove("collapsed");
  notesSection.classList.add("expanded");
  notesContent.style.display = "block";
  // Recalculate and set the height to ensure it fits content
  notesSection.style.height =
    notesContent.scrollHeight +
    notesSection.querySelector(".zone-header").offsetHeight +
    "px";
}

function toggleModalNotesRender() {
  if (notesMarkdownInputModal.style.display === "none") {
    // If currently showing rendered, switch to editor
    notesMarkdownInputModal.style.display = "block";
    notesRenderedOutputModal.style.display = "none";
    notesMarkdownInputModal.focus();
  } else {
    // If currently showing editor, switch to rendered
    updateModalNotesPreview();
    notesMarkdownInputModal.style.display = "none";
    notesRenderedOutputModal.style.display = "block";
    notesMarkdownInputModal.blur(); // Remove focus when switching to rendered view
  }
}

function copyNotesToClipboard(event, type) {
  if (event) event.stopPropagation();
  const sourceElement =
    type === "main" ? notesMarkdownInput : notesMarkdownInputModal;
  const textToCopy = getMarkdownFromContentEditable(sourceElement);
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = textToCopy;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Failed to copy text: ", err);
    showCustomAlert("Failed to copy notes. Please copy manually.");
  } finally {
    document.body.removeChild(tempTextArea);
  }
}

function downloadNotes(event, type) {
  if (event) event.stopPropagation();
  const sourceElement =
    type === "main" ? notesMarkdownInput : notesMarkdownInputModal;
  const notesContent = getMarkdownFromContentEditable(sourceElement);
  const title =
    document.getElementById("title").value.trim() || "Untitled Chit";
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const formattedDate = `${year}-${month}-${day} ${hours}${minutes}`;
  const filename = `${title} Note ${formattedDate}.md`;
  const blob = new Blob([notesContent], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* --- Checklist Functions --- */

// Moved manageGhostsAndSortLists to before its first call
function manageGhostsAndSortLists() {
  const checklistContainer = document.getElementById("checklist-container");
  const completedChecklistContainer = document.getElementById(
    "completed-checklist-container",
  );
  Array.from(checklistContainer.children).forEach((item) => item.remove());
  Array.from(completedChecklistContainer.children).forEach((item) => {
    if (item.tagName !== "H2") {
      item.remove();
    }
  });
  let activeItems = [];
  let completedItems = [];
  checklistItemsData.forEach((item) => {
    if (item.checked) {
      completedItems.push(item);
    } else {
      activeItems.push(item);
    }
  });
  let finalCompletedList = [];
  checklistItemsData.forEach((item) => {
    if (item.checked) {
      finalCompletedList.push(item);
    } else {
      if (hasCheckedChildren(item.id)) {
        const ghostData = {
          id: `ghost-${item.id}`,
          text: item.text,
          checked: item.checked,
          indentLevel: item.indentLevel,
          isGhost: true,
          originalId: item.id,
        };
        finalCompletedList.push(ghostData);
      }
    }
  });
  finalCompletedList.sort((a, b) => {
    const indexA = checklistItemsData.findIndex(
      (item) => item.id === (a.isGhost ? a.originalId : a.id),
    );
    const indexB = checklistItemsData.findIndex(
      (item) => item.id === (b.isGhost ? b.isOriginalId : b.id),
    );
    return indexA - indexB;
  });
  activeItems.forEach((itemData) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "checklist-item";
    itemDiv.draggable = true;
    itemDiv.dataset.id = itemData.id;
    itemDiv.dataset.indentLevel = itemData.indentLevel;
    itemDiv.style.paddingLeft = itemData.indentLevel * 30 + "px";
    if (itemData.indentLevel > 0) itemDiv.classList.add("sub-item");

    itemDiv.innerHTML = `
                                            <span class="drag-indicator">☰</span>
                                            <input type="checkbox" onchange="toggleChecklistItem(this)" ${itemData.checked ? "checked" : ""}>
                                            <div contenteditable="true" onblur="saveChecklistItemText(this)">${itemData.text}</div>
                                            <button class="delete-item" onclick="deleteChecklistItem(this)"><i class="fas fa-trash-alt"></i></button>
                                            <button class="outdent-item" onclick="outdentChecklistItem(this)">←</button>
                                            <button class="indent-item" onclick="indentChecklistItem(this)">→</button>
                                        `;
    checklistContainer.appendChild(itemDiv);
    addDragAndDropListeners(itemDiv);
    updateChecklistItemButtons(itemDiv);
  });
  finalCompletedList.forEach((itemData) => {
    const itemDiv = document.createElement("div");
    itemDiv.dataset.id = itemData.id;
    itemDiv.dataset.indentLevel = itemData.indentLevel;
    itemDiv.style.paddingLeft = itemData.indentLevel * 30 + "px";
    if (itemData.indentLevel > 0) itemDiv.classList.add("sub-item");

    if (itemData.isGhost) {
      itemDiv.className = `checklist-item completed-context-item ${checklistItemsData.find((o) => o.id === itemData.originalId)?.checked ? "checked" : ""}`;
      itemDiv.innerHTML = `<div contenteditable="false">${itemData.text}</div>`;
    } else {
      itemDiv.className = "checklist-item checked";
      itemDiv.innerHTML = `
                                                <span class="drag-indicator">☰</span>
                                                <input type="checkbox" onchange="toggleChecklistItem(this)" checked>
                                                <div contenteditable="false">${itemData.text}</div>
                                        `;
    }
    completedChecklistContainer.appendChild(itemDiv);
  });

  updateChecklistCount();
  updateCompletedSectionVisibility();
}
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
