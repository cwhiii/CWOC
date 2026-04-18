const checklistContainer = document.getElementById("checklist-container");

function onChecklistChange() {
  setSaveButtonUnsaved();
}

let dragIndicator = null;
let chitId = null;
let healthIndicatorWarningsShown = new Set();
let notificationCheckCount = 0;

let currentWeatherLat = null;
let currentWeatherLon = null;
let currentWeatherData = null;

const defaultAddress = "Billings, MT";

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

const defaultColors = [
  { hex: "transparent", name: "Transparent" },
  { hex: "#C66B6B", name: "Dusty Rose" },
  { hex: "#D68A59", name: "Burnt Sienna" },
  { hex: "#E3B23C", name: "Golden Ochre" },
  { hex: "#8A9A5B", name: "Mossy Sage" },
  { hex: "#6B8299", name: "Slate Teal" },
  { hex: "#8B6B99", name: "Muted Lilac" },
];

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function getCoordinates(address) {
  if (!address) {
    throw new Error("No address provided.");
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log("Geocoding API response:", data);
  if (!data || data.length === 0) {
    throw new Error("Location not found.");
  }
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function fetchWeatherData(address) {
  try {
    console.log("Fetching weather for address:", address);
    const coords = await getCoordinates(address);
    console.log("Coordinates:", coords);
    const weather = await getWeather(coords.lat, coords.lon);
    console.log("Weather data:", weather);

    currentWeatherLat = coords.lat;
    currentWeatherLon = coords.lon;
    currentWeatherData = weather;

    displayWeatherInCompactSection(weather, address);

    return weather;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
}

function getPrecipType(code) {
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "";
}

function displayWeatherInCompactSection(weatherData, address) {
  const compactWeatherSection = document.getElementById(
    "compactWeatherSection",
  );
  if (!compactWeatherSection) {
    console.warn("compactWeatherSection not found");
    return;
  }

  if (weatherData && weatherData.daily) {
    const today = weatherData.daily;
    const weatherCode = today.weathercode[0];
    const minC = today.temperature_2m_min[0];
    const maxC = today.temperature_2m_max[0];
    const precipMm = Math.ceil(today.precipitation_sum[0]);

    const min = Math.round((minC * 9) / 5 + 32);
    const max = Math.round((maxC * 9) / 5 + 32);
    const precipInches = Math.ceil(precipMm * 0.0393701 * 10) / 10;

    const icon = weatherIcons[weatherCode] || "❓";
    const precipType = getPrecipType(weatherCode);
    const precip = precipType ? `${precipInches} inch ${precipType}` : "";

    const d = new Date();
    const formattedDate = `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getFullYear()}-${d.toLocaleDateString("en-US", { month: "short" })}-${String(d.getDate()).padStart(2, "0")}`;

    const barMin = -14;
    const barMax = 104;
    const range = barMax - barMin;
    const startPct = ((min - barMin) / range) * 100;
    const endPct = ((max - barMin) / range) * 100;

    compactWeatherSection.innerHTML = `
    <div class="compact-day-header">
    <span class="compact-icon">${icon}</span>
    <span class="compact-date">${formattedDate}</span>
    <div class="compact-temperatures">
    <div class="compact-high">${max}º</div>
    <div class="compact-low">${min}º</div>
    </div>
    <div class="compact-precip">${precip}</div>
    <div class="compact-temperature-track">
    <div class="compact-temperature-mask" style="left:0%; width:${startPct}%;"></div>
    <div class="compact-temperature-fill" style="left:${startPct}%; width:${endPct - startPct}%;"></div>
    <div class="compact-temperature-mask" style="right:0%; width:${100 - endPct}%;"></div>
    ${[...Array(Math.floor((barMax - barMin) / 10) + 1)]
      .map((_, index) => {
        const temp = barMin + index * 10;
        const position = ((temp - barMin) / range) * 100;
        return `<div class="compact-temperature-line" style="left: ${position}%;"></div><div class="compact-temperature-label" style="left: ${position}%">${temp}º</div>`;
      })
      .join("")}
    </div>
    </div>
    `;
  } else {
    compactWeatherSection.innerHTML = `
    <div style="padding: 10px; font-family: 'Courier New', Courier, monospace; color: #3e2b2b;">
    <strong>Weather data unavailable for ${address}</strong>
    </div>
    `;
  }
}

function displayMapInUI(lat, lon, address) {
  const locationSection = document.getElementById("locationSection");
  if (!locationSection) return;

  let mapDisplay = document.getElementById("map-display");
  if (!mapDisplay) {
    mapDisplay = document.createElement("div");
    mapDisplay.id = "map-display";
    mapDisplay.style.cssText =
      "margin-top: 10px; width: 100%; height: 200px; border: 1px solid #ccc; border-radius: 5px;";
    const locationInput = document.getElementById("location");
    if (locationInput && locationInput.parentNode) {
      locationInput.parentNode.insertBefore(
        mapDisplay,
        locationInput.nextSibling,
      );
    } else {
      locationSection.appendChild(mapDisplay);
    }
  }

  mapDisplay.innerHTML = `
    <iframe
    width="100%"
    height="200"
    frameborder="0"
    scrolling="no"
    marginheight="0"
    marginwidth="0"
    src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}"
    style="border: 1px solid black; border-radius: 5px;">
    </iframe>
    <br/>
    <small>
    <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}" target="_blank">
    View Larger Map
    </a>
    </small>
  `;
}

function initializeChitId() {
  chitId = new URLSearchParams(window.location.search).get("id");
  if (!chitId) {
    chitId = generateUniqueId(); // Fallback to a new ID
    window.currentChitId = chitId;
    window.isNewChit = true;
    console.log("Generated new chitId:", chitId);
  } else {
    window.currentChitId = chitId;
    window.isNewChit = false;
  }
}

function toggleZone(event, sectionId, contentId) {
  const section = document.getElementById(sectionId);
  const content = document.getElementById(contentId);
  if (!section || !content) return;

  const isCollapsing = !content.classList.contains("collapsed");
  content.classList.toggle("collapsed");
  section.classList.toggle("collapsed");

  const zoneButtons = section.querySelectorAll(".zone-button");
  zoneButtons.forEach((button) => {
    if (isCollapsing) {
      button.style.display = "none";
    } else {
      button.style.display = "";
    }
  });
}

function toggleSection(contentId, button) {
  const content = document.getElementById(contentId);
  if (!content) return;

  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    content.classList.add("visible");
    if (button) button.textContent = "Hide";
  } else {
    content.classList.remove("visible");
    content.classList.add("hidden");
    if (button) button.textContent = "Show";
  }
}

function addChecklistItem(isSubItem) {
  const textInput = document.getElementById("new-item-text");
  if (!textInput) return;

  const text = textInput.value.trim();
  if (!text) return;
  // Checklist logic removed
  textInput.value = "";
}

function toggleChecklistItem(index) {
  // Checklist logic removed
}

function dragStart(e) {
  // Checklist logic removed
}

function dragEnter(e) {
  // Checklist logic removed
}

function dragLeave(e) {
  // Checklist logic removed
}

function dragOver(e) {
  // Checklist logic removed
}

function drop(e) {
  // Checklist logic removed
}

function dragEnd(e) {
  // Checklist logic removed
}

function formatDate(date) {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getFullYear()}-${monthNames[date.getMonth()]}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const userTimezoneOffset = new Date().getTimezoneOffset();
console.log(`User timezone offset: ${userTimezoneOffset} minutes`);

function toggleAllDay(event) {
  const allDayInput = document.getElementById("allDay");
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  const dueTimeInput = document.getElementById("due_time");

  if (!allDayInput) {
    console.warn("allDay input not found");
    return;
  }

  const currentValue = allDayInput.value;
  const newValue = currentValue === "true" ? "false" : "true";
  allDayInput.value = newValue;
  const allDay = newValue === "true";

  console.log(`All-day toggled: ${currentValue} -> ${newValue}`);

  if (startTime) {
    if (allDay) {
      startTime.dataset.previousValue = startTime.value;
      startTime.style.display = "none";
      startTime.value = "";
    } else {
      startTime.style.display = "";
      if (startTime.dataset.previousValue) {
        startTime.value = startTime.dataset.previousValue;
      } else if (
        chit &&
        chit.start_datetime &&
        chit.start_datetime.includes("T")
      ) {
        startTime.value = parseISOTime(chit.start_datetime);
      }
    }
  }

  if (endTime) {
    if (allDay) {
      endTime.dataset.previousValue = endTime.value;
      endTime.style.display = "none";
      endTime.value = "";
    } else {
      endTime.style.display = "";
      if (endTime.dataset.previousValue) {
        endTime.value = endTime.dataset.previousValue;
      } else if (chit && chit.end_datetime && chit.end_datetime.includes("T")) {
        endTime.value = parseISOTime(chit.end_datetime);
      }
    }
  }

  if (dueTimeInput) {
    if (allDay) {
      dueTimeInput.style.display = "none";
    } else {
      dueTimeInput.style.display = "";
      if (
        !dueTimeInput.value &&
        chit &&
        chit.due_datetime &&
        chit.due_datetime.includes("T")
      ) {
        dueTimeInput.value = parseISOTime(chit.due_datetime);
      }
    }
  }
}

async function fetchCustomColors() {
  try {
    const response = await fetch("/api/settings/default_user");
    if (!response.ok) {
      console.error(`Failed to fetch custom colors: HTTP ${response.status}`);
      return [];
    }
    const settings = await response.json();
    if (!settings.custom_colors) {
      console.warn("No custom_colors array found in API response");
      return [];
    }
    if (!Array.isArray(settings.custom_colors)) {
      console.warn("custom_colors is not an array:", settings.custom_colors);
      return [];
    }

    // Normalize colors: convert strings to objects { hex, name: "Custom Color" }
    const normalizedColors = settings.custom_colors.map((c) =>
      typeof c === "string"
        ? { hex: c, name: "Custom Color" }
        : { hex: c.hex, name: "Custom Color" },
    );

    return normalizedColors;
  } catch (error) {
    console.error("Error fetching custom colors:", error);
    return [];
  }
}

function setColor(hex, name = "Custom") {
  const colorInput = document.getElementById("color");
  const colorPreview = document.getElementById("selected-color");
  const colorNameLabel = document.getElementById("selected-color-name");
  const mainEditor = document.getElementById("mainEditor");
  // NOTE: header-row intentionally NOT colored — design spec says header stays fixed color

  if (colorInput) colorInput.value = hex;
  if (colorPreview) colorPreview.style.backgroundColor = hex;
  if (mainEditor) mainEditor.style.backgroundColor = hex;
  if (colorNameLabel) colorNameLabel.textContent = name;

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    const match = swatch.dataset.color?.toLowerCase() === hex.toLowerCase();
    swatch.classList.toggle("selected", match);
  });

  updateColorPreview(); // Sync preview and selection

  // Enable save button because color changed
  setSaveButtonUnsaved();
}

function updateColorPreview() {
  const colorInput = document.getElementById("color");
  const preview = document.getElementById("selected-color");
  const color = colorInput.value;
  const allColors = [...defaultColors, ...(window.customColors || [])];
  const colorObj = allColors.find(
    (c) => c.hex.toLowerCase() === color.toLowerCase(),
  );
  const label = colorObj ? colorObj.name : "Custom";

  if (preview) preview.style.backgroundColor = color;
  const mainEditor = document.getElementById("mainEditor");
  if (mainEditor) mainEditor.style.backgroundColor = color;
  const colorNameLabel = document.getElementById("selected-color-name");
  if (colorNameLabel) colorNameLabel.textContent = label;

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle(
      "selected",
      swatch.dataset.color?.toLowerCase() === color.toLowerCase(),
    );
  });
}

function renderCustomColors(customColors) {
  const customColorsContainer = document.getElementById("custom-colors");
  if (!customColorsContainer) {
    console.warn("#custom-colors container not found");
    return;
  }

  console.log("Rendering custom colors:", customColors);

  customColors.forEach(({ hex, name }) => {
    console.log(`Adding color swatch: ${name} (${hex})`);
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.dataset.color = hex;
    swatch.style.backgroundColor = hex;
    swatch.title = name || "Custom";

    swatch.addEventListener("click", () => {
      setColor(hex, name);
    });

    customColorsContainer.appendChild(swatch);
  });
}

function attachColorSwatchListeners() {
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const hex = swatch.dataset.color;
      const allColors = [...defaultColors, ...(window.customColors || [])];
      const colorObj = allColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
      );
      const name = colorObj ? colorObj.name : "Custom";
      setColor(hex, name);
    });
  });
}

function utcToLocalDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date;
}

function parseISOTime(isoString) {
  if (!isoString) return "";
  const date = utcToLocalDate(isoString);
  if (isNaN(date.getTime())) return "";
  return formatTime(date);
}

function convertDBDateToDisplayDate(dateString) {
  if (!dateString) return "";
  const date = utcToLocalDate(dateString);
  if (isNaN(date.getTime())) return "";
  return formatDate(date);
}

function checkNotifications() {
  notificationCheckCount++;
  const notificationElement = document.getElementById("notification");
  if (
    notificationElement &&
    notificationElement.value !== undefined &&
    notificationElement.value !== null
  ) {
    console.log(`Checking notifications... (${notificationCheckCount})`);
  }
}

function getPastelColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const r = ((hash & 0xff) % 128) + 127;
  const g = (((hash >> 8) & 0xff) % 128) + 127;
  const b = (((hash >> 16) & 0xff) % 128) + 127;
  return `rgb(${r}, ${g}, ${b})`;
}

async function loadTags() {
  try {
    const response = await fetch("/api/settings/default_user");
    const settings = await response.json();
    return settings.tags || [];
  } catch (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
}

function renderTags(tags, selectedTags = []) {
  const tagsContainer = document.getElementById("tags-container");
  if (!tagsContainer) {
    console.warn("tags-container not found");
    return;
  }
  tagsContainer.innerHTML = "<label>Tags:</label>";
  tags.forEach((tag) => {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.margin = "5px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = tag.name;
    checkbox.checked = selectedTags.includes(tag.name);
    checkbox.style.marginRight = "5px";

    const badge = document.createElement("span");
    badge.textContent = tag.name;
    badge.style.backgroundColor = tag.color || getPastelColor(tag.name);
    badge.style.color = "#000";
    badge.style.padding = "2px 8px";
    badge.style.borderRadius = "12px";
    badge.style.fontSize = "0.9em";
    badge.style.cursor = "pointer";

    label.appendChild(checkbox);
    label.appendChild(badge);
    tagsContainer.appendChild(label);
  });
}

function resetEditorForNewChit() {
  console.log("Resetting editor for new chit...");

  const elementsToReset = [
    { id: "title", defaultValue: "" },
    { id: "note", defaultValue: "" },
    { id: "location", defaultValue: defaultAddress },
    { id: "people", defaultValue: "" },
    { id: "status", defaultValue: "" },
    { id: "priority", defaultValue: "" },
    { id: "recurrence", defaultValue: "" },
    { id: "color", defaultValue: "#C66B6B" },
  ];

  const checkboxesToReset = [
    { id: "alarm", defaultValue: false },
    { id: "notification", defaultValue: false },
    { id: "pinned", defaultValue: false },
    { id: "archived", defaultValue: false },
  ];

  elementsToReset.forEach((item) => {
    const element = document.getElementById(item.id);
    if (element) {
      element.value = item.defaultValue;
    }
  });

  checkboxesToReset.forEach((item) => {
    const element = document.getElementById(item.id);
    if (element) {
      element.checked = item.defaultValue;
    }
  });

  const allDayInput = document.getElementById("allDay");
  if (allDayInput) {
    allDayInput.value = "false";
  }

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const dateTimeElements = [
    { id: "start_datetime", value: formatDate(now) },
    { id: "start_time", value: formatTime(now) },
    { id: "end_datetime", value: formatDate(now) },
    { id: "end_time", value: formatTime(oneHourLater) },
    { id: "due_datetime", value: "" },
    { id: "due_time", value: "" },
  ];

  dateTimeElements.forEach((item) => {
    const element = document.getElementById(item.id);
    if (element) {
      element.value = item.value;
    }
  });

  const selectedColorElement = document.getElementById("selected-color");
  if (selectedColorElement) {
    selectedColorElement.style.backgroundColor = "#C66B6B";
  }

  const selectedColorName = document.getElementById("selected-color-name");
  if (selectedColorName) {
    selectedColorName.textContent = "Dusty Rose";
  }

  setColor("#C66B6B", "Dusty Rose");

  // Checklist reset removed

  loadTags().then((tags) => renderTags(tags));

  if (defaultAddress) {
    fetchWeatherData(defaultAddress).catch((error) => {
      console.log("Could not fetch weather for default location:", error);
    });
  }

  console.log("Editor reset completed.");
}

function createISODateTimeString(dateStr, timeStr, isAllDay, isEnd = false) {
  if (!dateStr) return null;
  const formattedDate = convertMonthFormat(dateStr);
  if (!formattedDate || formattedDate === dateStr) {
    console.error("Invalid or missing date string:", dateStr);
    return null;
  }
  let dateTimeStr = `${formattedDate}T00:00:00`;
  if (isAllDay) {
    dateTimeStr = isEnd
      ? `${formattedDate}T23:59:59`
      : `${formattedDate}T00:00:00`;
  } else if (timeStr) {
    dateTimeStr = `${formattedDate}T${timeStr}:00`;
  }
  const localDate = new Date(dateTimeStr);
  if (isNaN(localDate.getTime())) {
    console.error("Invalid date:", dateTimeStr);
    return null;
  }
  return localDate.toISOString();
}

function convertMonthFormat(dateStr) {
  if (!dateStr) return null;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  return dateStr.replace(
    /(\d{4})-([A-Za-z]{3})-(\d{2})/,
    (match, year, month, day) => `${year}-${months[month]}-${day}`,
  );
}

function setMediaSource(elementId, src) {
  console.log(
    `setMediaSource called with elementId: ${elementId}, src: ${src}`,
  );
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID ${elementId} not found`);
    return;
  }
  if (isValidMediaSource(src)) {
    console.log(`Setting src for ${elementId} to ${src}`);
    element.src = src;
  } else {
    console.warn(`Invalid media source for ${elementId}: ${src}`);
    element.removeAttribute("src");
  }
}

function isValidMediaSource(src) {
  if (!src || src.trim() === "" || src === "editor") return false;
  try {
    new URL(src, window.location.origin);
    return true;
  } catch (e) {
    console.error("Invalid media URL:", src, e);
    return false;
  }
}

// Updated saveChitData function in editor.js
async function saveChitData() {
  try {
    const chit = {};
    chit.id = window.currentChitId || generateUniqueId();

    const titleInput = document.getElementById("title");
    chit.title = titleInput ? titleInput.value.trim() : "";

    const noteTextarea = document.getElementById("note");
    chit.note = noteTextarea ? noteTextarea.value.trim() : "";

    const locationInput = document.getElementById("location");
    chit.location = locationInput ? locationInput.value.trim() : "";

    const peopleInput = document.getElementById("people");
    chit.people = peopleInput
      ? peopleInput.value
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p)
      : [];

    const statusSelect = document.getElementById("status");
    chit.status = statusSelect ? statusSelect.value || null : null;

    const prioritySelect = document.getElementById("priority");
    chit.priority = prioritySelect ? prioritySelect.value || null : null;

    const severitySelect = document.getElementById("severity");
    chit.severity = severitySelect ? severitySelect.value || null : null;

    const recurrenceSelect = document.getElementById("recurrence");
    chit.recurrence = recurrenceSelect ? recurrenceSelect.value || null : null;

    const colorInput = document.getElementById("color");
    chit.color = colorInput ? colorInput.value || null : null;

    const alarmCheckbox = document.getElementById("alarm");
    chit.alarm = alarmCheckbox ? alarmCheckbox.checked : false;

    const notificationCheckbox = document.getElementById("notification");
    chit.notification = notificationCheckbox
      ? notificationCheckbox.checked
      : false;

    const pinnedCheckbox = document.getElementById("pinned");
    chit.pinned = pinnedCheckbox ? pinnedCheckbox.checked : false;

    const archivedCheckbox = document.getElementById("archived");
    chit.archived = archivedCheckbox ? archivedCheckbox.checked : false;

    const allDayInput = document.getElementById("allDay");
    const isAllDay = allDayInput ? allDayInput.value === "true" : false;
    chit.all_day = isAllDay;

    const startDateInput = document.getElementById("start_datetime");
    const startTimeInput = document.getElementById("start_time");
    chit.start_datetime = createISODateTimeString(
      startDateInput ? startDateInput.value : "",
      startTimeInput ? startTimeInput.value : "",
      isAllDay,
      false,
    );

    const endDateInput = document.getElementById("end_datetime");
    const endTimeInput = document.getElementById("end_time");
    chit.end_datetime = createISODateTimeString(
      endDateInput ? endDateInput.value : "",
      endTimeInput ? endTimeInput.value : "",
      isAllDay,
      true,
    );

    const dueDateInput = document.getElementById("due_datetime");
    const dueTimeInput = document.getElementById("due_time");
    chit.due_datetime = createISODateTimeString(
      dueDateInput ? dueDateInput.value : "",
      dueTimeInput ? dueTimeInput.value : "",
      isAllDay,
      false,
    );

    const tagsContainer = document.getElementById("tags-container");
    if (tagsContainer) {
      const tagCheckboxes = tagsContainer.querySelectorAll(
        "input[type='checkbox']:checked",
      );
      chit.tags = Array.from(tagCheckboxes).map((cb) => cb.value);
    } else {
      chit.tags = [];
    }

    chit.checklist = window.checklist
      ? window.checklist.getChecklistData()
      : [];

    // Read isProjectMaster hidden input value (string "true" or "false")
    const projectMasterInput = document.getElementById("isProjectMaster");
    chit.is_project_master = projectMasterInput
      ? projectMasterInput.value === "true"
      : false;

    // Include child_chits from projectState if project master
    if (
      chit.is_project_master &&
      typeof projectState === "object" &&
      projectState.projectChit
    ) {
      chit.child_chits = projectState.projectChit.child_chits || [];
      console.log(`Saving chit ${chit.id} with child_chits:`, chit.child_chits);
    } else {
      chit.child_chits = [];
    }

    // Validate minimum required fields
    if (
      !chit.title &&
      !chit.note &&
      !chit.start_datetime &&
      !chit.due_datetime &&
      chit.tags.length === 0 &&
      chit.checklist.length === 0 &&
      chit.child_chits.length === 0
    ) {
      alert(
        "Please provide at least a title, note, date, tag, checklist item, or child chit before saving.",
      );
      return;
    }

    const isNewChit = !(await chitExists(chit.id));
    const method = isNewChit ? "POST" : "PUT";
    const url = isNewChit ? "/api/chits" : `/api/chits/${chit.id}`;

    console.log(`Saving chit ${chit.id} with method ${method}:`, chit);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chit),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save chit: ${response.status} - ${errorText}`);
    }

    const updatedChit = await response.json();
    console.log("Saved chit response:", updatedChit);

    // If project master, save project child chit changes as well
    if (
      updatedChit.is_project_master &&
      typeof saveProjectChanges === "function"
    ) {
      console.log("Calling saveProjectChanges for project master");
      await saveProjectChanges();
    }

    window.currentChitId = updatedChit.id;
    markEditorSaved();
    window.location.href = "/";
  } catch (error) {
    console.error("[saveChitData] Error saving chit:", error);
    alert("Failed to save chit. Check console for details.");
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

function saveChit() {
  console.log("Saving chit...");
  saveChitData();
}

function deleteChit() {
  if (!chitId) {
    alert("No chit to delete.");
    return;
  }
  const modal = document.getElementById("deleteChitModal");
  if (modal) {
    modal.style.display = "block";

    const confirmBtn = document.getElementById("confirmDeleteChitBtn");
    const cancelBtn = document.getElementById("cancelDeleteChitBtn");

    confirmBtn.onclick = null;
    cancelBtn.onclick = null;

    confirmBtn.onclick = () => {
      modal.style.display = "none";
      performDeleteChit();
    };

    cancelBtn.onclick = () => {
      modal.style.display = "none";
    };
  }
}

function performDeleteChit() {
  fetch(`/api/chits/${chitId}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(() => {
      window.location.href = "/";
    })
    .catch((err) => {
      console.error("Error deleting chit:", err);
      alert("Failed to delete chit. Check console for details.");
    });
}

function renderHealthIndicator(indicatorId) {
  const element = document.getElementById(indicatorId);
  if (!element) {
    if (!healthIndicatorWarningsShown.has(indicatorId)) {
      console.warn(
        `Element with ID '${indicatorId}' not found. Skipping rendering for this health indicator.`,
      );
      healthIndicatorWarningsShown.add(indicatorId);
    }
    return;
  }
}

// Updated loadChitData function in editor.js
async function loadChitData(chitId) {
  console.log(`[loadChitData] Called with chitId: ${chitId}`);

  if (!chitId || window.isNewChit) {
    console.log("[loadChitData] Skipping load: new chit");
    return;
  }

  try {
    const response = await fetch(`/api/chit/${chitId}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          `[loadChitData] Chit ${chitId} not found, initializing new chit`,
        );
        resetEditorForNewChit();
        return;
      }
      throw new Error("Failed to load chit data");
    }

    const chit = await response.json();
    console.log("[loadChitData] Loaded chit data:", chit);

    // If project master, initialize Projects Zone inside existing container
    if (chit.is_project_master) {
      // Initialize Projects Zone with this chit ID
      if (typeof initializeProjectZone === "function") {
        await initializeProjectZone(chit.id);
      }
      // Do NOT populate default chit editor fields for project master chit
      return;
    }

    // Populate editor fields for non-project chit as usual

    const titleInput = document.getElementById("title");
    if (titleInput) {
      titleInput.value = chit.title || "";
      console.log(`[loadChitData] Set title-input to: "${titleInput.value}"`);
    }

    const noteTextarea = document.getElementById("note");
    if (noteTextarea) {
      noteTextarea.value = chit.note || "";
      console.log(
        `[loadChitData] Set note-textarea to: "${noteTextarea.value}"`,
      );
    }

    const recurrenceSelect = document.getElementById("recurrence");
    if (recurrenceSelect) {
      recurrenceSelect.value = chit.recurrence || "";
      console.log(
        `[loadChitData] Set recurrence to: "${recurrenceSelect.value}"`,
      );
    }

    const allDayInput = document.getElementById("allDay");
    if (allDayInput) {
      // Field is stored as all_day in DB; guard against legacy allDay key
      const isAllDay = !!(chit.all_day || chit.allDay);
      allDayInput.value = isAllDay ? "true" : "false";
      console.log(`[loadChitData] Set allDay to: "${allDayInput.value}"`);

      // Apply UI state: hide/show time inputs to match the stored all-day flag
      const startTime = document.getElementById("start_time");
      const endTime = document.getElementById("end_time");
      const dueTime = document.getElementById("due_time");
      const allDayBtn = document.getElementById("allDayToggleButton");

      if (isAllDay) {
        if (startTime) startTime.style.display = "none";
        if (endTime) endTime.style.display = "none";
        if (dueTime) dueTime.style.display = "none";
        if (allDayBtn) allDayBtn.classList.add("active");
      } else {
        if (startTime) startTime.style.display = "";
        if (endTime) endTime.style.display = "";
        if (dueTime) dueTime.style.display = "";
        if (allDayBtn) allDayBtn.classList.remove("active");
      }
    }

    const prioritySelect = document.getElementById("priority");
    setSelectValue(prioritySelect, chit.priority);
    console.log(
      `[loadChitData] Set priority to: "${prioritySelect ? prioritySelect.value : "N/A"}"`,
    );

    const severitySelect = document.getElementById("severity");
    setSelectValue(severitySelect, chit.severity);
    console.log(
      `[loadChitData] Set severity to: "${severitySelect ? severitySelect.value : "N/A"}"`,
    );

    const statusSelect = document.getElementById("status");
    setSelectValue(statusSelect, chit.status);
    console.log(
      `[loadChitData] Set status to: "${statusSelect ? statusSelect.value : "N/A"}"`,
    );

    // Helper to split ISO datetime into date and time parts
    function splitISODateTime(isoString) {
      if (!isoString) return { date: "", time: "" };
      const dateObj = new Date(isoString);
      if (isNaN(dateObj.getTime())) return { date: "", time: "" };
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const year = dateObj.getFullYear();
      const month = months[dateObj.getMonth()];
      const day = String(dateObj.getDate()).padStart(2, "0");
      const date = `${year}-${month}-${day}`;
      const time = dateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return { date, time };
    }

    const startDateInput = document.getElementById("start_datetime");
    const startTimeInput = document.getElementById("start_time");
    const startParts = splitISODateTime(chit.start_datetime);
    if (startDateInput) {
      startDateInput.value = startParts.date;
      console.log(
        `[loadChitData] Set start_datetime to: "${startDateInput.value}"`,
      );
    }
    if (startTimeInput) {
      startTimeInput.value = (chit.all_day || chit.allDay) ? "" : startParts.time;
      console.log(
        `[loadChitData] Set start_time to: "${startTimeInput.value}"`,
      );
    }

    const endDateInput = document.getElementById("end_datetime");
    const endTimeInput = document.getElementById("end_time");
    const endParts = splitISODateTime(chit.end_datetime);
    if (endDateInput) {
      endDateInput.value = endParts.date;
      console.log(
        `[loadChitData] Set end_datetime to: "${endDateInput.value}"`,
      );
    }
    if (endTimeInput) {
      endTimeInput.value = (chit.all_day || chit.allDay) ? "" : endParts.time;
      console.log(`[loadChitData] Set end_time to: "${endTimeInput.value}"`);
    }

    const dueDateInput = document.getElementById("due_datetime");
    const dueTimeInput = document.getElementById("due_time");
    const dueParts = splitISODateTime(chit.due_datetime);
    if (dueDateInput) {
      dueDateInput.value = dueParts.date;
      console.log(
        `[loadChitData] Set due_datetime to: "${dueDateInput.value}"`,
      );
    }
    if (dueTimeInput) {
      dueTimeInput.value = (chit.all_day || chit.allDay) ? "" : dueParts.time;
      console.log(`[loadChitData] Set due_time to: "${dueTimeInput.value}"`);
    }

    if (window.checklist) {
      if (Array.isArray(chit.checklist)) {
        window.checklist.loadItems(chit.checklist);
        console.log(`[loadChitData] Loaded checklist items:`, chit.checklist);
      } else {
        window.checklist.loadItems([]);
        console.log("[loadChitData] Loaded empty checklist");
      }
    }

    // Restore location
    const locationInput = document.getElementById("location");
    if (locationInput) {
      locationInput.value = chit.location || "";
      console.log(`[loadChitData] Set location to: "${locationInput.value}"`);
    }

    // Restore people (stored as array, display as comma-separated)
    const peopleInput = document.getElementById("people");
    if (peopleInput) {
      peopleInput.value = Array.isArray(chit.people)
        ? chit.people.join(", ")
        : chit.people || "";
      console.log(`[loadChitData] Set people to: "${peopleInput.value}"`);
    }

    // Restore color
    if (chit.color) {
      const allColors = [...defaultColors, ...(window.customColors || [])];
      const colorObj = allColors.find(
        (c) => c.hex.toLowerCase() === chit.color.toLowerCase(),
      );
      setColor(chit.color, colorObj ? colorObj.name : "Custom");
      console.log(`[loadChitData] Set color to: "${chit.color}"`);
    }

    // Restore pinned state
    const pinnedInput = document.getElementById("pinned");
    const pinnedButton = document.getElementById("pinnedButton");
    if (pinnedInput) {
      pinnedInput.value = chit.pinned ? "true" : "false";
      if (pinnedButton) {
        pinnedButton.querySelector("i")?.classList.toggle("fas", !!chit.pinned);
        pinnedButton.querySelector("i")?.classList.toggle("far", !chit.pinned);
      }
      console.log(`[loadChitData] Set pinned to: ${chit.pinned}`);
    }

    // Restore archived state
    const archivedInput = document.getElementById("archived");
    const archivedButton = document.getElementById("archivedButton");
    if (archivedInput) {
      archivedInput.value = chit.archived ? "true" : "false";
      if (archivedButton) {
        archivedButton.querySelector("i")?.classList.toggle("fas", !!chit.archived);
        archivedButton.querySelector("i")?.classList.toggle("far", !chit.archived);
      }
      console.log(`[loadChitData] Set archived to: ${chit.archived}`);
    }

    // Restore tags — load all tags then pre-check the ones on this chit
    loadTags().then((tags) => {
      renderTags(tags, chit.tags || []);
      console.log(`[loadChitData] Restored tags:`, chit.tags);
    });

    // Fetch weather for the chit's location (or default)
    const locationForWeather = chit.location || defaultAddress;
    if (locationForWeather) {
      fetchWeatherData(locationForWeather).catch((err) => {
        console.log("Could not fetch weather on load:", err);
      });
    }

    window.currentChitId = chit.id || chitId;
    console.log(
      `[loadChitData] Set currentChitId to: "${window.currentChitId}"`,
    );

    markEditorSaved();
  } catch (error) {
    console.error("[loadChitData] Error loading chit:", error);
  }
}

function setSelectValue(selectElement, value) {
  if (!selectElement) return;
  const options = Array.from(selectElement.options);
  const match = options.find(
    (opt) => opt.value.toLowerCase() === (value || "").toLowerCase(),
  );
  if (match) {
    selectElement.value = match.value;
  } else {
    selectElement.value = ""; // fallback to first option or empty
  }
}

function markEditorUnsaved() {
  setSaveButtonUnsaved();
}

function markEditorSaved() {
  setSaveButtonSaved();
}

function searchLocationMap(event) {
  const locationInput = document.getElementById("location");
  if (!locationInput || !locationInput.value.trim()) {
    alert("Please enter a location first.");
    return;
  }

  const address = locationInput.value.trim();
  console.log("Searching location:", address);

  fetchWeatherData(address)
    .then((weatherData) => {
      console.log("Weather data fetched successfully:", weatherData);
      if (currentWeatherLat && currentWeatherLon) {
        displayMapInUI(currentWeatherLat, currentWeatherLon, address);
      }
    })
    .catch((error) => {
      console.error("Error fetching location data:", error);
      alert(`Error fetching location data: ${error.message}`);
    });
}

function openLocationInNewTab(event) {
  const loc = document.getElementById("location");
  if (loc && loc.value) {
    window.open(
      `https://www.openstreetmap.org/search?query=${encodeURIComponent(loc.value)}`,
      "_blank",
    );
  }
}

function openLocationDirections(event) {
  const loc = document.getElementById("location");
  if (!loc || !loc.value) {
    alert("Please enter a destination first.");
    return;
  }

  if (!window.isSecureContext) {
    console.warn(
      "Geolocation requires HTTPS. Opening directions without starting location.",
    );
    window.open(
      `https://www.openstreetmap.org/directions?to=${encodeURIComponent(loc.value)}`,
      "_blank",
    );
    return;
  }

  if (!navigator.geolocation) {
    console.warn("Geolocation is not supported by this browser.");
    window.open(
      `https://www.openstreetmap.org/directions?to=${encodeURIComponent(loc.value)}`,
      "_blank",
    );
    return;
  }

  const destination = encodeURIComponent(loc.value);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;
      window.open(
        `https://www.openstreetmap.org/directions?from=${userLat},${userLon}&to=${destination}`,
        "_blank",
      );
    },
    (error) => {
      console.log(
        "Could not get location, opening directions without starting point",
      );
      window.open(
        `https://www.openstreetmap.org/directions?to=${destination}`,
        "_blank",
      );
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
  );
}

function openNotesModal(event) {
  const modal = document.getElementById("notesModal");
  if (modal) modal.style.display = "block";
}

function closeNotesModal(save) {
  const modal = document.getElementById("notesModal");
  if (modal) modal.style.display = "none";
  if (save) {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    const mainNote = document.getElementById("note");
    if (modalInput && mainNote) mainNote.value = modalInput.innerText;
  }
}

function toggleModalNotesRender() {
  const modalInput = document.getElementById("notes-markdown-input-modal");
  const modalOutput = document.getElementById("notes-rendered-output-modal");
  if (!modalInput || !modalOutput) return;
  if (modalOutput.style.display === "none") {
    if (typeof marked !== "undefined") {
      modalOutput.innerHTML = marked.parse(modalInput.innerText);
    } else {
      modalOutput.innerHTML = modalInput.innerText;
    }
    modalOutput.style.display = "block";
    modalInput.style.display = "none";
  } else {
    modalOutput.style.display = "none";
    modalInput.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM Content Loaded - Initializing editor...");

  initializeChitId();

  const initializeFlatpickr = (selector, options) => {
    const element = document.querySelector(selector);
    if (element && typeof flatpickr !== "undefined") {
      try {
        flatpickr(selector, options);
      } catch (error) {
        console.warn(`Failed to initialize Flatpickr for ${selector}:`, error);
      }
    } else {
      console.warn(`Element ${selector} not found or Flatpickr not available.`);
    }
  };

  initializeFlatpickr("#start_datetime", { dateFormat: "Y-M-d" });
  initializeFlatpickr("#end_datetime", { dateFormat: "Y-M-d" });
  initializeFlatpickr("#due_datetime", { dateFormat: "Y-M-d" });

  initializeFlatpickr("#start_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
    onChange: function (selectedDates, dateStr, instance) {
      const startTime = new Date(`1970-01-01T${dateStr}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const endTimeInput = document.getElementById("end_time");
      const allDayInput = document.getElementById("allDay");
      if (
        endTimeInput &&
        endTimeInput._flatpickr &&
        !endTimeInput._flatpickr.selectedDates.length &&
        allDayInput &&
        allDayInput.value !== "true"
      ) {
        endTimeInput._flatpickr.setDate(formatTime(endTime));
      }
    },
  });

  initializeFlatpickr("#end_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });

  initializeFlatpickr("#due_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });

  // Attach listeners to default colors
  attachColorSwatchListeners();

  // Initialize checklist
  const checklistContainer = document.getElementById("checklist-container");
  if (checklistContainer && window.Checklist) {
    window.checklist = new Checklist(checklistContainer, [], onChecklistChange);
  }

  // Conditionally load chit data or reset for new chit
  if (chitId && !window.isNewChit) {
    loadChitData(chitId);
  } else {
    console.log("No valid chitId for loading, initializing new chit");
    resetEditorForNewChit();
  }

  setInterval(checkNotifications, 60000);

  const allDayBtn = document.getElementById("allDayToggleButton");
  if (allDayBtn) allDayBtn.onclick = toggleAllDay;

  const notesExpandBtn = document.getElementById("open-notes-modal-button");
  if (notesExpandBtn) notesExpandBtn.onclick = openNotesModal;

  const locationSection = document.getElementById("locationSection");
  if (locationSection) {
    const btns = locationSection.getElementsByClassName("zone-button");
    if (btns[0]) btns[0].onclick = searchLocationMap;
    if (btns[1]) btns[1].onclick = openLocationInNewTab;
    if (btns[2]) btns[2].onclick = openLocationDirections;
  }

  const notesModal = document.getElementById("notesModal");
  if (notesModal) {
    const closeBtns = notesModal.getElementsByClassName("modal-discard-button");
    for (let btn of closeBtns) btn.onclick = () => closeNotesModal(false);
    const saveBtn = notesModal.querySelector(
      "button[onclick*='closeNotesModal(true)']",
    );
    if (saveBtn) saveBtn.onclick = () => closeNotesModal(true);
  }

  const healthIndicators = [
    "weightEntry",
    "distanceEntry",
    "heartRateEntry",
    "bpEntry",
    "spo2Entry",
    "glucoseEntry",
    "temperatureEntry",
    "intercourseEntry",
    "cycleEntry",
  ];

  healthIndicators.forEach(renderHealthIndicator);

  setSaveButtonSaved();

  // Attach input change listeners to mark editor unsaved on any change
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("input", () => setSaveButtonUnsaved());
  });

  console.log("Editor initialization completed.");
});

function clearStartAndEndDates() {
  document.getElementById("start_datetime").value = "";
  document.getElementById("start_time").value = "";
  document.getElementById("end_datetime").value = "";
  document.getElementById("end_time").value = "";
}

function clearDueDate() {
  document.getElementById("due_datetime").value = "";
  document.getElementById("due_time").value = "";
}

function setSaveButtonSaved() {
  const saveBtn = document.getElementById("saveButton");
  const cancelBtn = document.querySelector(".cancel");
  if (!saveBtn || !cancelBtn) return;

  saveBtn.innerHTML = "✅ Saved";
  saveBtn.disabled = true;
  saveBtn.style.opacity = 0.6;
  saveBtn.style.pointerEvents = "none";

  cancelBtn.textContent = "Done";
}

function setSaveButtonUnsaved() {
  const saveBtn = document.getElementById("saveButton");
  const cancelBtn = document.querySelector(".cancel");
  if (!saveBtn || !cancelBtn) return;

  saveBtn.innerHTML = "💾 Save";
  saveBtn.disabled = false;
  saveBtn.style.opacity = 1;
  saveBtn.style.pointerEvents = "auto";

  cancelBtn.textContent = "❌ Cancel";
}

console.log("Editor script loaded successfully.");
