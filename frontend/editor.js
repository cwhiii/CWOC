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

const defaultAddress = "";

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
  compactWeatherSection.classList.remove('weather-placeholder');

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
  const params = new URLSearchParams(window.location.search);
  chitId = params.get("id");
  window._editingInstance = params.get("instance") || null; // YYYY-MM-DD for recurrence instance editing
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
  // Delegate to shared editor framework
  cwocToggleZone(event, sectionId, contentId);
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

function togglePinned() {
  const input = document.getElementById("pinned");
  const btn = document.getElementById("pinnedButton");
  if (!input) return;
  const isNowPinned = input.value !== "true";
  input.value = isNowPinned ? "true" : "false";
  if (btn) {
    const icon = btn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fas", isNowPinned);
      icon.classList.toggle("far", !isNowPinned);
    }
    btn.title = isNowPinned ? "Pinned (click to unpin)" : "Not pinned (click to pin)";
  }
  setSaveButtonUnsaved();
}

function toggleArchived() {
  const input = document.getElementById("archived");
  const btn = document.getElementById("archivedButton");
  if (!input) return;
  const isNowArchived = input.value !== "true";
  input.value = isNowArchived ? "true" : "false";
  if (btn) {
    btn.textContent = isNowArchived ? "📦 Archived" : "📦 Archive";
    btn.classList.toggle("archived-active", isNowArchived);
    btn.title = isNowArchived ? "Archived (click to unarchive)" : "Not archived (click to archive)";
  }
  setSaveButtonUnsaved();
}

function _showQRCode(e) {
  if (!chitId) { alert('Save the chit first to generate a QR code.'); return; }
  const existing = document.getElementById('qr-modal-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'qr-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:24px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:300px;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:bold;margin-bottom:12px;color:#4a2c2a;';
  modal.appendChild(titleEl);

  const qrDiv = document.createElement('div');
  qrDiv.id = 'qr-render-area';
  modal.appendChild(qrDiv);

  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'font-size:0.75em;opacity:0.6;margin-top:8px;word-break:break-all;max-width:320px;';
  modal.appendChild(infoDiv);

  // Toggle buttons
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'display:flex;gap:6px;margin-top:12px;justify-content:center;';
  const btnStyle = 'padding:6px 12px;border:1px solid #6b4e31;border-radius:4px;cursor:pointer;font-family:inherit;font-size:0.85em;';
  const dataBtn = document.createElement('button');
  dataBtn.style.cssText = btnStyle + 'background:#d4c5a9;font-weight:bold;';
  dataBtn.textContent = '📦 Data QR';
  dataBtn.title = 'QR contains chit data for import on another instance';
  const linkBtn = document.createElement('button');
  linkBtn.style.cssText = btnStyle + 'background:#fdf5e6;';
  linkBtn.textContent = '🔗 Link QR';
  linkBtn.title = 'QR contains a URL link to this chit';
  toggleRow.appendChild(dataBtn);
  toggleRow.appendChild(linkBtn);
  modal.appendChild(toggleRow);

  const closeHint = document.createElement('div');
  closeHint.style.cssText = 'font-size:0.7em;opacity:0.35;margin-top:8px;';
  closeHint.textContent = 'Click outside to close';
  modal.appendChild(closeHint);

  function renderQR(mode) {
    dataBtn.style.background = mode === 'data' ? '#d4c5a9' : '#fdf5e6';
    dataBtn.style.fontWeight = mode === 'data' ? 'bold' : 'normal';
    linkBtn.style.background = mode === 'link' ? '#d4c5a9' : '#fdf5e6';
    linkBtn.style.fontWeight = mode === 'link' ? 'bold' : 'normal';

    if (mode === 'link') {
      const url = `${window.location.origin}/frontend/editor.html?id=${chitId}`;
      titleEl.textContent = '🔗 Link QR Code';
      infoDiv.textContent = url;
      if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
        qrDiv.innerHTML = qr.createImgTag(5, 8);
      } else { qrDiv.innerHTML = '<div style="padding:12px;opacity:0.6;">QR library not loaded.</div>'; }
    } else {
      titleEl.textContent = '📦 Data QR Code';
      // Build compact chit data payload with instance ID
      const chitData = {
        _cwoc: window._instanceId || 'unknown',
        id: chitId,
        title: document.getElementById('title')?.value || '',
        note: document.getElementById('note')?.value || '',
        status: document.getElementById('status')?.value || '',
        priority: document.getElementById('priority')?.value || '',
        tags: (window._currentTagSelection || []).join(';'),
        due: document.getElementById('due_datetime')?.value || '',
        start: document.getElementById('start_datetime')?.value || '',
        end: document.getElementById('end_datetime')?.value || '',
      };
      const json = JSON.stringify(chitData);
      infoDiv.textContent = `${json.length} chars encoded (instance: ${chitData._cwoc.slice(0,8)}…)`;
      if (typeof qrcode !== 'undefined') {
        // Use higher error correction for larger data
        const ecl = json.length > 500 ? 'L' : 'M';
        try {
          const qr = qrcode(0, ecl); qr.addData(json); qr.make();
          qrDiv.innerHTML = qr.createImgTag(4, 6);
        } catch (err) {
          qrDiv.innerHTML = '<div style="padding:12px;color:#a33;font-size:0.85em;">Chit data too large for QR code. Try reducing the note length.</div>';
        }
      } else { qrDiv.innerHTML = '<div style="padding:12px;opacity:0.6;">QR library not loaded.</div>'; }
    }
  }

  dataBtn.addEventListener('click', () => renderQR('data'));
  linkBtn.addEventListener('click', () => renderQR('link'));

  // Default: data QR. Shift+click on the button = link QR.
  renderQR(e && e.shiftKey ? 'link' : 'data');

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Load instance ID if not cached
  if (!window._instanceId) {
    fetch('/api/instance-id').then(r => r.ok ? r.json() : {}).then(d => {
      window._instanceId = d.instance_id || 'unknown';
      if (dataBtn.style.fontWeight === 'bold') renderQR('data'); // re-render with real ID
    }).catch(() => {});
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

function toggleAllDay() {
  const allDayCheckbox = document.getElementById("allDay");
  if (!allDayCheckbox) return;
  const allDay = allDayCheckbox.checked;

  // Hide/show time inputs for ALL date modes (All Day is global)
  const startEndTimes = document.querySelectorAll('#startEndFields .time-input');
  startEndTimes.forEach(input => { input.style.display = allDay ? 'none' : ''; });
  // Keep the "to" separator visible between date fields
  const sep = document.querySelector('#startEndFields .date-mode-separator');
  if (sep) sep.style.display = '';

  const dueTime = document.getElementById('due_time');
  if (dueTime) dueTime.style.display = allDay ? 'none' : '';

  if (!_dateModeSuppressUnsaved) setSaveButtonUnsaved();
}

// ── Date mode radio buttons ──────────────────────────────────────────────────
let _dateModeSuppressUnsaved = false; // suppress during init

function onDateModeChange() {
  const mode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';
  const startEndFields = document.getElementById('startEndFields');
  const dueFields = document.getElementById('dueFields');
  const recurrenceFields = document.getElementById('recurrenceFields');
  const alldayRow = document.getElementById('alldayRepeatRow');

  if (startEndFields) {
    startEndFields.classList.toggle('greyed-out', mode !== 'startend');
  }
  if (dueFields) {
    dueFields.classList.toggle('greyed-out', mode !== 'due');
  }
  if (recurrenceFields) {
    recurrenceFields.classList.toggle('greyed-out', mode === 'none');
  }
  if (alldayRow) {
    alldayRow.style.display = (mode === 'none') ? 'none' : '';
  }

  // Hide repeat row unless a date mode is active
  const repeatRow = document.getElementById('repeatCheckboxRow');
  const repeatOptions = document.getElementById('repeatOptionsBlock');
  if (repeatRow) repeatRow.style.display = (mode === 'none') ? 'none' : '';
  if (mode === 'none' && repeatOptions) repeatOptions.style.display = 'none';

  // Show Complete checkbox only when Due mode is active
  const dueCompleteLabel = document.getElementById('dueCompleteLabel');
  if (dueCompleteLabel) {
    dueCompleteLabel.style.display = (mode === 'due') ? 'inline-flex' : 'none';
  }

  // Re-apply all-day visibility for the active mode
  const allDayCheckbox = document.getElementById("allDay");
  if (allDayCheckbox && allDayCheckbox.checked) {
    toggleAllDay();
  } else {
    // Show all time inputs when not all-day
    document.querySelectorAll('#startEndFields .time-input').forEach(i => { i.style.display = ''; });
    const sep = document.querySelector('#startEndFields .date-mode-separator');
    if (sep) sep.style.display = '';
    const dueTime = document.getElementById('due_time');
    if (dueTime) dueTime.style.display = '';
  }

  // Show/hide notify checkboxes based on date mode
  const notifyStartLabel = document.getElementById('notifyAtStart')?.parentElement;
  const notifyDueLabel = document.getElementById('notifyAtDue')?.parentElement;
  if (notifyStartLabel) notifyStartLabel.style.display = (mode === 'startend') ? '' : 'none';
  if (notifyDueLabel) notifyDueLabel.style.display = (mode === 'due') ? '' : 'none';

  if (!_dateModeSuppressUnsaved) setSaveButtonUnsaved();
}

/** Toggle status to Complete when the Due date Complete checkbox is checked */
function onDueCompleteToggle() {
  const cb = document.getElementById('dueComplete');
  const statusSel = document.getElementById('status');
  if (!cb || !statusSel) return;
  if (cb.checked) {
    statusSel.value = 'Complete';
  } else {
    if (statusSel.value === 'Complete') statusSel.value = '';
  }
  setSaveButtonUnsaved();
}

/** Sync the Due Complete checkbox when status dropdown changes */
function onStatusChange() {
  const statusSel = document.getElementById('status');
  const cb = document.getElementById('dueComplete');
  if (cb) cb.checked = (statusSel && statusSel.value === 'Complete');
  setSaveButtonUnsaved();
}

// Determine date mode from chit data
function _detectDateMode(chit) {
  const hasDue = !!(chit.due_datetime);
  const hasStart = !!(chit.start_datetime);
  if (hasDue) return 'due';
  if (hasStart) return 'startend';
  return 'none';
}

// Set the radio button and apply greying
function _setDateMode(mode) {
  const radio = document.getElementById(
    mode === 'due' ? 'dateModeDue' : mode === 'startend' ? 'dateModeStartEnd' : 'dateModeNone'
  );
  if (radio) radio.checked = true;
  onDateModeChange();
}

// ── Time picker dropdown ─────────────────────────────────────────────────────
let _snapMinutes = 15; // default, loaded from settings

// ── Recurrence picker ─────────────────────────────────────────────────────────
function onRecurrenceChange() {
  const sel = document.getElementById('recurrence');
  const customRow = document.getElementById('recurrenceCustomRow');
  const icon = document.getElementById('recurrenceIcon');

  const isCustom = sel && sel.value === 'CUSTOM';
  if (customRow) customRow.style.display = isCustom ? '' : 'none';
  const intervalEl = document.getElementById('recurrenceInterval');
  const freqEl = document.getElementById('recurrenceFreq');
  if (intervalEl) intervalEl.style.display = isCustom ? '' : 'none';
  if (freqEl) freqEl.style.display = isCustom ? '' : 'none';

  if (icon) icon.style.display = (document.getElementById('repeatEnabled')?.checked) ? '' : 'none';

  onRecurrenceFreqChange();
  setSaveButtonUnsaved();
}

/** Toggle repeat options visibility */
function onRepeatToggle() {
  const cb = document.getElementById('repeatEnabled');
  const block = document.getElementById('repeatOptionsBlock');
  const icon = document.getElementById('recurrenceIcon');
  if (block) block.style.display = cb && cb.checked ? 'table-row-group' : 'none';
  if (icon) icon.style.display = cb && cb.checked ? '' : 'none';
  setSaveButtonUnsaved();
}

function onRecurrenceFreqChange() {
  const byDayDiv = document.getElementById('recurrenceByDay');
  const sel = document.getElementById('recurrence');
  const freq = document.getElementById('recurrenceFreq')?.value;
  const isCustomWeekly = sel?.value === 'CUSTOM' && freq === 'WEEKLY';
  if (byDayDiv) byDayDiv.style.display = isCustomWeekly ? 'flex' : 'none';
  setSaveButtonUnsaved();
}

function onRecurrenceEndsToggle() {
  const neverCb = document.getElementById('recurrenceEndsNever');
  const dateWrap = document.getElementById('recurrenceEndsDateWrap');
  if (dateWrap) dateWrap.style.display = neverCb && neverCb.checked ? 'none' : '';
  if (neverCb && neverCb.checked) {
    const untilEl = document.getElementById('recurrenceUntil');
    if (untilEl) untilEl.value = '';
  }
  setSaveButtonUnsaved();
}

function _onRecurrenceFreqChange() { onRecurrenceFreqChange(); }
function _updateByDayVisibility() { onRecurrenceFreqChange(); }
function onRecurrenceToggle() { onRecurrenceChange(); }

function _buildRecurrenceRule() {
  const enabled = document.getElementById('repeatEnabled')?.checked;
  if (!enabled) return null;

  const sel = document.getElementById('recurrence');
  const freq = sel ? sel.value : 'DAILY';
  const until = document.getElementById('recurrenceUntil')?.value || null;
  const endsNever = document.getElementById('recurrenceEndsNever')?.checked;

  if (freq === 'CUSTOM') {
    const customFreq = document.getElementById('recurrenceFreq')?.value || 'WEEKLY';
    const interval = parseInt(document.getElementById('recurrenceInterval')?.value) || 1;
    const byDay = [];
    if (customFreq === 'WEEKLY') {
      document.querySelectorAll('#recurrenceByDay input:checked').forEach(cb => byDay.push(cb.value));
    }
    const rule = { freq: customFreq, interval };
    if (byDay.length > 0) rule.byDay = byDay;
    if (!endsNever && until) rule.until = until;
    return rule;
  }

  const rule = { freq, interval: 1 };
  if (!endsNever && until) rule.until = until;
  return rule;
}

function _loadRecurrenceRule(rule) {
  const repeatCb = document.getElementById('repeatEnabled');
  const sel = document.getElementById('recurrence');
  if (!repeatCb || !sel) return;

  if (!rule || !rule.freq) {
    repeatCb.checked = false;
    onRepeatToggle();
    return;
  }

  // Enable repeat
  repeatCb.checked = true;
  onRepeatToggle();

  // Load until
  const neverCb = document.getElementById('recurrenceEndsNever');
  const dateWrap = document.getElementById('recurrenceEndsDateWrap');
  if (rule.until) {
    const untilEl = document.getElementById('recurrenceUntil');
    if (untilEl) untilEl.value = rule.until;
    if (neverCb) neverCb.checked = false;
    if (dateWrap) dateWrap.style.display = '';
  } else {
    if (neverCb) neverCb.checked = true;
    if (dateWrap) dateWrap.style.display = 'none';
  }

  // Simple preset?
  const isSimple = (rule.interval || 1) === 1 && (!rule.byDay || rule.byDay.length === 0);
  if (isSimple && ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) {
    sel.value = rule.freq;
  } else {
    sel.value = 'CUSTOM';
    const freqEl = document.getElementById('recurrenceFreq');
    const intervalEl = document.getElementById('recurrenceInterval');
    if (freqEl) freqEl.value = rule.freq;
    if (intervalEl) intervalEl.value = rule.interval || 1;
    if (rule.byDay) {
      rule.byDay.forEach(d => {
        const cb = document.querySelector(`#recurrenceByDay input[value="${d}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  onRecurrenceChange();
}

async function _loadSnapSetting() {
  try {
    const resp = await fetch('/api/settings/default_user');
    if (!resp.ok) return;
    const settings = await resp.json();
    if (settings.calendar_snap && parseInt(settings.calendar_snap) > 0) {
      _snapMinutes = parseInt(settings.calendar_snap);
    }
  } catch (e) { /* use default */ }
}

function _showTimeDropdown(inputEl) {
  document.querySelectorAll('.time-dropdown').forEach(d => d.remove());

  const currentVal = inputEl.value || '12:00';
  const parts = currentVal.split(':');
  const h = parseInt(parts[0]) || 12;
  const m = parseInt(parts[1]) || 0;
  const baseMinutes = h * 60 + m;

  const dropdown = document.createElement('div');
  dropdown.className = 'time-dropdown';

  const snap = _snapMinutes || 15;
  for (let i = 0; i < 5; i++) {
    const totalMin = baseMinutes + i * snap;
    const hr = Math.floor(totalMin / 60) % 24;
    const mn = totalMin % 60;
    const timeStr = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;

    const opt = document.createElement('div');
    opt.className = 'time-dropdown-option';
    opt.textContent = timeStr;
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      inputEl.value = timeStr;
      dropdown.remove();
      setSaveButtonUnsaved();
    });
    dropdown.appendChild(opt);
  }

  const rect = inputEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 2) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.minWidth = rect.width + 'px';
  document.body.appendChild(dropdown);

  inputEl.addEventListener('blur', () => {
    setTimeout(() => dropdown.remove(), 150);
  }, { once: true });
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

    // Normalize colors: preserve name if present, fall back to hex
    const normalizedColors = settings.custom_colors.map((c) =>
      typeof c === "string"
        ? { hex: c, name: c }
        : { hex: c.hex, name: c.name || c.hex },
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

  // Clear existing custom swatches before re-rendering
  customColorsContainer.innerHTML = "";

  if (!customColors || customColors.length === 0) return;

  customColors.forEach(({ hex, name }) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.dataset.color = hex;
    swatch.style.backgroundColor = hex;
    swatch.title = name || hex;

    swatch.addEventListener("click", () => {
      setColor(hex, name || "Custom");
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
    const tags = settings.tags || [];
    // Normalize: tags may be strings (legacy) or {name, color} objects
    return tags.map((t) =>
      typeof t === "string" ? { name: t, color: null } : t
    ).filter((t) => t.name);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
}

/**
 * Render tags from settings into the editor tag zone.
 * Populates the tag tree container and marks active tags.
 * @param {Array} tags - Array of {name, color} from settings
 * @param {Array} selectedTags - Array of tag name strings currently on the chit
 */
function renderTags(tags, selectedTags = []) {
  const treeContainer = document.getElementById("tagTreeContainer");
  const activeContainer = document.getElementById("activeTagsListContainer");
  const activeCount = document.getElementById("activeTagsCount");
  const favContainer = document.getElementById("favTags");
  const recentContainer = document.getElementById("mostRecentTags");

  if (!treeContainer || !activeContainer) {
    console.warn("Tag zone containers not found");
    return;
  }

  if (!tags || tags.length === 0) {
    treeContainer.innerHTML = '<p style="font-size:0.85em;opacity:0.6;">No tags defined. Create tags in Settings.</p>';
    if (activeCount) activeCount.textContent = "0";
    if (favContainer) favContainer.innerHTML = "";
    if (recentContainer) recentContainer.innerHTML = "";
    return;
  }

  // Build nested tree and render
  const tree = buildTagTree(tags);
  renderTagTree(treeContainer, tree, selectedTags, (fullPath, isNowSelected) => {
    const idx = selectedTags.indexOf(fullPath);
    if (isNowSelected && idx === -1) {
      selectedTags.push(fullPath);
      trackRecentTag(fullPath);
      // Auto-color: if chit color is transparent and this is the first non-system tag, apply tag color
      const colorInput = document.getElementById('color');
      if (colorInput && (!colorInput.value || colorInput.value === 'transparent')) {
        const tagObj = tags.find(t => t.name === fullPath);
        if (tagObj && tagObj.color && !isSystemTag(fullPath)) {
          setColor(tagObj.color, fullPath.split('/').pop());
        }
      }
    } else if (!isNowSelected && idx !== -1) {
      selectedTags.splice(idx, 1);
    }
    renderTags(tags, selectedTags);
    setSaveButtonUnsaved();
  });

  // Favorites row
  if (favContainer) {
    favContainer.innerHTML = "";
    tags.filter(t => t.favorite).forEach(tag => {
      const chip = document.createElement("span");
      chip.style.cssText = `display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:${tag.color || getPastelColor(tag.name)};color:#000;${selectedTags.includes(tag.name) ? 'outline:2px solid #8b5a2b;' : ''}`;
      chip.textContent = "";
      const star = document.createElement('span');
      star.textContent = '★';
      star.style.cssText = 'color:#DAA520;text-shadow:0 0 1px #000;margin-right:2px;';
      chip.appendChild(star);
      chip.appendChild(document.createTextNode(tag.name.split('/').pop()));
      chip.title = tag.name;
      chip.addEventListener("click", () => {
        const idx = selectedTags.indexOf(tag.name);
        if (idx === -1) { selectedTags.push(tag.name); trackRecentTag(tag.name); }
        else selectedTags.splice(idx, 1);
        renderTags(tags, selectedTags);
        setSaveButtonUnsaved();
      });
      favContainer.appendChild(chip);
    });
  }

  // Recent row
  if (recentContainer) {
    recentContainer.innerHTML = "";
    const recents = getRecentTags();
    recents.forEach(path => {
      const tag = tags.find(t => t.name === path);
      if (!tag) return;
      const chip = document.createElement("span");
      chip.style.cssText = `display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:${tag.color || getPastelColor(tag.name)};color:#000;${selectedTags.includes(tag.name) ? 'outline:2px solid #8b5a2b;' : ''}`;
      chip.textContent = tag.name.split('/').pop();
      chip.title = tag.name;
      chip.addEventListener("click", () => {
        const idx = selectedTags.indexOf(tag.name);
        if (idx === -1) { selectedTags.push(tag.name); trackRecentTag(tag.name); }
        else selectedTags.splice(idx, 1);
        renderTags(tags, selectedTags);
        setSaveButtonUnsaved();
      });
      recentContainer.appendChild(chip);
    });
  }

  // Render active tags panel (exclude system tags)
  activeContainer.innerHTML = "";
  selectedTags.filter(t => !isSystemTag(t)).forEach(tagName => {
    const tag = tags.find(t => t.name === tagName) || { name: tagName, color: null };
    const chip = document.createElement("span");
    chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;background:${tag.color || getPastelColor(tag.name)};color:#000;padding:2px 8px;border-radius:4px;font-size:0.9em;margin:2px;`;
    chip.textContent = tag.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "background:none;border:none;cursor:pointer;font-size:0.8em;padding:0 0 0 4px;line-height:1;";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = selectedTags.indexOf(tagName);
      if (idx !== -1) selectedTags.splice(idx, 1);
      renderTags(tags, selectedTags);
      setSaveButtonUnsaved();
    });

    chip.appendChild(removeBtn);
    activeContainer.appendChild(chip);
  });

  if (activeCount) activeCount.textContent = selectedTags.filter(t => !isSystemTag(t)).length;
  window._currentTagSelection = selectedTags;
}

function resetEditorForNewChit() {
  console.log("Resetting editor for new chit...");

  const elementsToReset = [
    { id: "title", defaultValue: "" },
    { id: "note", defaultValue: "" },
    { id: "location", defaultValue: "" },
    { id: "people", defaultValue: "" },
    { id: "status", defaultValue: "" },
    { id: "priority", defaultValue: "" },
    { id: "recurrence", defaultValue: "" },
    { id: "color", defaultValue: "transparent" },
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
    allDayInput.checked = false;
  }

  // Reset date mode to None
  _dateModeSuppressUnsaved = true;
  _setDateMode('none');
  _dateModeSuppressUnsaved = false;

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
    selectedColorElement.style.backgroundColor = "transparent";
  }

  const selectedColorName = document.getElementById("selected-color-name");
  if (selectedColorName) {
    selectedColorName.textContent = "Transparent";
  }

  setColor("transparent", "Transparent");

  // Checklist reset removed

  window._currentTagSelection = [];
  window._loadedChildChits = [];
  loadTags().then((tags) => renderTags(tags, []));

  // Reset alerts
  window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
  renderAllAlerts();

  // Show weather placeholder for new chits (no location/date yet)
  const cws = document.getElementById("compactWeatherSection");
  if (cws) cws.classList.add('weather-placeholder'); cws.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`;

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
/**
 * Collect all form values into a chit object.
 * Returns null if validation fails (and shows alert).
 */
async function buildChitObject() {
  const chit = {};
  chit.id = window.currentChitId || generateUniqueId();

  const titleInput = document.getElementById("title");
  chit.title = titleInput ? titleInput.value.trim() : "";

  const noteTextarea = document.getElementById("note");
  chit.note = noteTextarea ? noteTextarea.value.trim() : "";

  const locationInput = document.getElementById("location");
  chit.location = locationInput ? locationInput.value.trim() : "";

  // Collect people from chips
  chit.people = (typeof _peopleChipData !== 'undefined' && _peopleChipData.length > 0)
    ? _peopleChipData.map(c => c.display_name)
    : [];

  const statusSelect = document.getElementById("status");
  chit.status = statusSelect ? statusSelect.value || null : null;

  const prioritySelect = document.getElementById("priority");
  chit.priority = prioritySelect ? prioritySelect.value || null : null;

  const severitySelect = document.getElementById("severity");
  chit.severity = severitySelect ? severitySelect.value || null : null;

  const repeatEnabled = document.getElementById("repeatEnabled");
  chit.recurrence = repeatEnabled && repeatEnabled.checked ? (document.getElementById('recurrence')?.value || 'DAILY') : null;
  chit.recurrence_rule = _buildRecurrenceRule();
  chit.recurrence_exceptions = window._loadedRecurrenceExceptions || null;

  const colorInput = document.getElementById("color");
  chit.color = colorInput ? colorInput.value || null : null;

  const alarmCheckbox = document.getElementById("alarm");
  chit.alarm = alarmCheckbox ? alarmCheckbox.checked : false;

  const notificationCheckbox = document.getElementById("notification");
  chit.notification = notificationCheckbox ? notificationCheckbox.checked : false;

  const pinnedCheckbox = document.getElementById("pinned");
  chit.pinned = pinnedCheckbox ? pinnedCheckbox.value === "true" : false;

  const archivedCheckbox = document.getElementById("archived");
  chit.archived = archivedCheckbox ? archivedCheckbox.value === "true" : false;

  const allDayCheckbox = document.getElementById("allDay");
  const isAllDay = allDayCheckbox ? allDayCheckbox.checked : false;
  chit.all_day = isAllDay;

  // Respect date mode radio — only include active date fields
  const dateMode = document.querySelector('input[name="dateMode"]:checked')?.value || 'none';

  const startDateInput = document.getElementById("start_datetime");
  const startTimeInput = document.getElementById("start_time");
  const endDateInput = document.getElementById("end_datetime");
  const endTimeInput = document.getElementById("end_time");
  const dueDateInput = document.getElementById("due_datetime");
  const dueTimeInput = document.getElementById("due_time");

  if (dateMode === 'startend') {
    chit.start_datetime = createISODateTimeString(
      startDateInput ? startDateInput.value : "",
      startTimeInput ? startTimeInput.value : "",
      isAllDay, false,
    );
    chit.end_datetime = createISODateTimeString(
      endDateInput ? endDateInput.value : "",
      endTimeInput ? endTimeInput.value : "",
      isAllDay, true,
    );
    chit.due_datetime = null;
  } else if (dateMode === 'due') {
    chit.due_datetime = createISODateTimeString(
      dueDateInput ? dueDateInput.value : "",
      dueTimeInput ? dueTimeInput.value : "",
      isAllDay, false,
    );
    chit.start_datetime = null;
    chit.end_datetime = null;
  } else {
    chit.start_datetime = null;
    chit.end_datetime = null;
    chit.due_datetime = null;
  }

  // Read tags from the live selection state maintained by renderTags
  chit.tags = Array.isArray(window._currentTagSelection)
    ? [...window._currentTagSelection]
    : [];

  chit.checklist = window.checklist ? window.checklist.getChecklistData() : [];

  // Collect alerts from the live alerts state
  chit.alerts = _alertsToArray();
  // Set alarm/notification flags based on whether any exist
  chit.alarm = window._alertsData.alarms.length > 0;
  chit.notification = window._alertsData.notifications.length > 0;

  const projectMasterInput = document.getElementById("isProjectMaster");
  chit.is_project_master = projectMasterInput
    ? projectMasterInput.value === "true"
    : false;

  if (chit.is_project_master && typeof projectState === "object" && projectState.projectChit) {
    // Project master: use the live projectState child_chits
    chit.child_chits = projectState.projectChit.child_chits || [];
  } else {
    // Non-project-master: preserve whatever child_chits were loaded from the DB
    // Never overwrite with [] — that would delete project membership
    chit.child_chits = window._loadedChildChits || [];
  }

  // Validate: if a date mode is active, require a date + time (or all-day)
  if (dateMode === 'startend') {
    const startDate = startDateInput ? startDateInput.value.trim() : '';
    const startTime = startTimeInput ? startTimeInput.value.trim() : '';
    if (!startDate) {
      alert('Start date is required when Start & End is selected.');
      return null;
    }
    if (!isAllDay && !startTime) {
      alert('Start time is required (or check All Day).');
      return null;
    }
    // Validate end is not before start
    if (chit.start_datetime && chit.end_datetime) {
      if (new Date(chit.end_datetime) < new Date(chit.start_datetime)) {
        alert('End time cannot be before start time.');
        return null;
      }
    }
  } else if (dateMode === 'due') {
    const dueDate = dueDateInput ? dueDateInput.value.trim() : '';
    const dueTime = dueTimeInput ? dueTimeInput.value.trim() : '';
    if (!dueDate) {
      alert('Due date is required when Due is selected.');
      return null;
    }
    if (!isAllDay && !dueTime) {
      alert('Due time is required (or check All Day).');
      return null;
    }
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
    alert("Please provide at least a title, note, date, tag, checklist item, or child chit before saving.");
    return null;
  }

  return chit;
}

/**
 * Show a banner at the top of the editor indicating we're editing a single
 * recurrence instance, not the whole series.
 */
function _showInstanceBanner(dateStr) {
  const existing = document.getElementById('instance-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'instance-banner';
  banner.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:8px 14px;margin:8px 0;font-family:"Courier New",monospace;font-size:0.9em;display:flex;align-items:center;gap:8px;';
  banner.innerHTML = `<span style="font-size:1.2em;">✏️🔁</span> <span>Editing instance for <strong>${dateStr}</strong>. Changes will only apply to this date.</span>`;

  // Insert at the top of the editor form
  const form = document.querySelector('.editor-form') || document.querySelector('.editor-content') || document.body;
  form.insertBefore(banner, form.firstChild);
}

/**
 * Save changes as a recurrence exception for a single instance.
 * Only saves the fields that differ from the parent chit.
 */
async function _saveInstanceException(dateStr) {
  try {
    const chit = await buildChitObject();
    if (!chit) return;

    // Build exception object with the modified fields
    const exception = { date: dateStr };

    // Always save title (user may have changed it)
    if (chit.title) exception.title = chit.title;

    // Save date/time changes
    if (chit.start_datetime) exception.start_datetime = chit.start_datetime;
    if (chit.end_datetime) exception.end_datetime = chit.end_datetime;
    if (chit.due_datetime) exception.due_datetime = chit.due_datetime;

    // Save note changes
    if (chit.note) exception.note = chit.note;

    // Save location changes
    if (chit.location) exception.location = chit.location;

    const resp = await fetch(`/api/chits/${chit.id}/recurrence-exceptions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exception })
    });

    if (!resp.ok) throw new Error(await resp.text());

    markEditorSaved();
    window.location.href = '/';
  } catch (error) {
    console.error('[_saveInstanceException] Error:', error);
    alert('Failed to save instance changes.');
  }
}

async function saveChitData() {
  // If editing a single recurrence instance, save as exception instead
  if (window._editingInstance) {
    return _saveInstanceException(window._editingInstance);
  }

  try {
    const chit = await buildChitObject();
    if (!chit) return;

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

// ── Alerts zone — full implementation ───────────────────────────────────────
// Alert data is stored in window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] }
// Each type has its own array. Saved to chit.alerts as a flat array with _type field.

window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
let _stopwatchIntervals = {}; // id -> intervalId

// ── Time format helper ───────────────────────────────────────────────────────
// Loaded from settings on init; used for alarm time display
window._editorTimeFormat = "24hour"; // default until settings load

async function loadEditorTimeFormat() {
  try {
    const res = await fetch("/api/settings/default_user");
    if (!res.ok) return;
    const s = await res.json();
    window._editorTimeFormat = s.time_format || "24hour";
  } catch (e) { /* keep default */ }
}

function _fmtAlarmTime(time24) {
  // time24 is "HH:MM"
  if (!time24) return "";
  if (window._editorTimeFormat === "12hour" || window._editorTimeFormat === "12houranalog") {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  }
  return time24;
}

// ── Sound helpers ────────────────────────────────────────────────────────────
let _alarmAudio = null;
let _timerAudio = null;

function _playAlarmSound() {
  if (!_alarmAudio) {
    _alarmAudio = new Audio("/static/alarm.mp3");
    _alarmAudio.loop = true;
  }
  _alarmAudio.currentTime = 0;
  _alarmAudio.play().catch(() => {});
}

function _stopAlarmSound() {
  if (_alarmAudio) { _alarmAudio.pause(); _alarmAudio.currentTime = 0; }
}

function _playTimerSound() {
  if (!_timerAudio) {
    _timerAudio = new Audio("/static/timer.mp3");
  }
  _timerAudio.currentTime = 0;
  _timerAudio.play().catch(() => {});
}

// ── Alarm checker — runs every second ───────────────────────────────────────
let _alarmCheckerInterval = null;
const _triggeredAlarms = new Set(); // "idx-HH:MM-dayAbbr"

function _startAlarmChecker() {
  if (_alarmCheckerInterval) return;
  _alarmCheckerInterval = setInterval(_checkAlarms, 1000);
}

function _stopAlarmChecker() {
  if (_alarmCheckerInterval) { clearInterval(_alarmCheckerInterval); _alarmCheckerInterval = null; }
}

function _dayAbbr(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

function _checkAlarms() {
  const now = new Date();
  const currentHH = String(now.getHours()).padStart(2,"0");
  const currentMM = String(now.getMinutes()).padStart(2,"0");
  const currentTime = `${currentHH}:${currentMM}`;
  const currentDay = _dayAbbr(now);

  window._alertsData.alarms.forEach((alarm, idx) => {
    if (!alarm.enabled || !alarm.time) return;
    const days = alarm.days && alarm.days.length > 0 ? alarm.days : [currentDay];
    if (!days.includes(currentDay)) return;
    if (alarm.time !== currentTime) return;

    const key = `${idx}-${alarm.time}-${currentDay}-${now.toDateString()}`;
    if (_triggeredAlarms.has(key)) return;
    _triggeredAlarms.add(key);

    // Fire alarm
    _playAlarmSound();
    _showAlarmAlert(alarm, () => _stopAlarmSound());

    // Request browser notification
    if (Notification.permission === "granted") {
      new Notification(`🔔 Alarm: ${alarm.name || "Alarm"}`, { body: `Time: ${_fmtAlarmTime(alarm.time)}` });
    }
  });

  // Clean up old keys (keep only today's)
  _triggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _triggeredAlarms.delete(key);
  });
}

function _showAlarmAlert(alarm, onDismiss) {
  // Create a non-blocking overlay alert
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:1em 1.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);min-width:220px;";
  overlay.innerHTML = `
    <div style="font-weight:bold;font-size:1.1em;margin-bottom:0.4em;">🔔 ${alarm.name || "Alarm"}</div>
    <div style="font-size:0.9em;margin-bottom:0.6em;">${_fmtAlarmTime(alarm.time)}</div>
    <button id="_alarm-dismiss-btn" style="padding:4px 14px;margin-right:6px;">Dismiss</button>
    <button id="_alarm-snooze-btn" style="padding:4px 14px;">Snooze 5m</button>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#_alarm-dismiss-btn").onclick = () => {
    overlay.remove();
    if (onDismiss) onDismiss();
  };
  overlay.querySelector("#_alarm-snooze-btn").onclick = () => {
    overlay.remove();
    if (onDismiss) onDismiss();
    // Snooze: add 5 minutes
    const [h, m] = alarm.time.split(":").map(Number);
    const snoozeDate = new Date();
    snoozeDate.setHours(h, m + 5, 0, 0);
    alarm.time = `${String(snoozeDate.getHours()).padStart(2,"0")}:${String(snoozeDate.getMinutes()).padStart(2,"0")}`;
  };
}

// ── Notification checker ─────────────────────────────────────────────────────
let _notifCheckerInterval = null;
const _firedNotifications = new Set();

function _startNotificationChecker() {
  if (_notifCheckerInterval) return;
  _notifCheckerInterval = setInterval(_checkNotificationAlerts, 30000); // check every 30s
  _checkNotificationAlerts(); // check immediately
}

function _stopNotificationChecker() {
  if (_notifCheckerInterval) { clearInterval(_notifCheckerInterval); _notifCheckerInterval = null; }
}

function _checkNotificationAlerts() {
  const startVal = document.getElementById("start_datetime")?.value;
  const dueVal = document.getElementById("due_datetime")?.value;
  const title = document.getElementById("title")?.value || "Chit";

  window._alertsData.notifications.forEach((n, idx) => {
    if (!n.value || !n.unit) return;

    // Convert to milliseconds
    const unitMs = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
    const offsetMs = n.value * (unitMs[n.unit] || 60000);

    // Determine target datetime
    const targetStr = n.relativeTo ? (dueVal || startVal) : startVal;
    if (!targetStr) return;

    const targetDate = new Date(targetStr);
    if (isNaN(targetDate.getTime())) return;

    const fireAt = new Date(targetDate.getTime() - offsetMs);
    const now = new Date();

    // Fire if we're within 30 seconds past the fire time
    const diff = now - fireAt;
    if (diff >= 0 && diff < 30000) {
      const key = `notif-${idx}-${fireAt.toISOString()}`;
      if (_firedNotifications.has(key)) return;
      _firedNotifications.add(key);

      const msg = `${n.value} ${n.unit} before ${n.relativeTo ? "due/start" : "start"}: "${title}"`;
      if (Notification.permission === "granted") {
        new Notification("📢 Reminder", { body: msg });
      } else {
        // Fallback: show inline toast
        const toast = document.createElement("div");
        toast.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:0.75em 1.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);";
        toast.textContent = `📢 ${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);
      }
    }
  });
}

function _alertsFromChit(chit) {
  if (!Array.isArray(chit.alerts)) chit.alerts = [];
  window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
  let notifyFlags = null;
  chit.alerts.forEach((a) => {
    if (a._type === "alarm") window._alertsData.alarms.push(a);
    else if (a._type === "timer") window._alertsData.timers.push(a);
    else if (a._type === "stopwatch") window._alertsData.stopwatches.push(a);
    else if (a._type === "notification") window._alertsData.notifications.push(a);
    else if (a._type === "_notify_flags") notifyFlags = a;
  });
  // Restore notify checkboxes
  const startCb = document.getElementById('notifyAtStart');
  const dueCb = document.getElementById('notifyAtDue');
  if (startCb) startCb.checked = notifyFlags ? !!notifyFlags.at_start : true;
  if (dueCb) dueCb.checked = notifyFlags ? !!notifyFlags.at_due : true;

  renderAllAlerts();
  if (window._alertsData.alarms.length > 0) _startAlarmChecker();
  if (window._alertsData.notifications.length > 0) _startNotificationChecker();
}

function _alertsToArray() {
  const arr = [
    ...window._alertsData.alarms,
    ...window._alertsData.timers,
    ...window._alertsData.stopwatches,
    ...window._alertsData.notifications,
  ];
  // Save notify flags
  const startCb = document.getElementById('notifyAtStart');
  const dueCb = document.getElementById('notifyAtDue');
  arr.push({
    _type: '_notify_flags',
    at_start: startCb ? startCb.checked : true,
    at_due: dueCb ? dueCb.checked : true,
  });
  return arr;
}

// ── Render all alert containers ──────────────────────────────────────────────

function renderAllAlerts() {
  renderAlarmsContainer();
  renderTimersContainer();
  renderStopwatchesContainer();
  renderNotificationsContainer();
}

function renderAlarmsContainer() {
  const c = document.getElementById("alarms-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.alarms.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "🔔 Alarms";
  c.appendChild(header);

  window._alertsData.alarms.forEach((alarm, idx) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = `border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;${!alarm.enabled ? "opacity:0.5;" : ""}`;

    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = alarm.name || "";
    nameInput.placeholder = "Alarm name";
    nameInput.style.cssText = "flex:1;font-size:0.9em;padding:2px 4px;";
    nameInput.addEventListener("input", () => { window._alertsData.alarms[idx].name = nameInput.value; setSaveButtonUnsaved(); });

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = alarm.time || "";
    timeInput.style.cssText = "font-size:1.1em;padding:3px 6px;font-weight:bold;";
    timeInput.addEventListener("change", () => {
      window._alertsData.alarms[idx].time = timeInput.value;
      // If no days set, default to today
      if (!window._alertsData.alarms[idx].days || window._alertsData.alarms[idx].days.length === 0) {
        window._alertsData.alarms[idx].days = [_dayAbbr(new Date())];
        renderAlarmsContainer(); // re-render to show checked day
      }
      setSaveButtonUnsaved();
    });

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.textContent = alarm.enabled ? "On" : "Off";
    toggleBtn.style.cssText = "padding:1px 6px;";
    toggleBtn.onclick = () => toggleAlarmEnabled(idx);

    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteAlarmItem(idx);

    row1.appendChild(nameInput);
    row1.appendChild(timeInput);
    row1.appendChild(toggleBtn);
    row1.appendChild(delBtn);
    wrap.appendChild(row1);

    // Days row
    const daysRow = document.createElement("div");
    daysRow.style.cssText = "display:flex;gap:0.3em;flex-wrap:wrap;font-size:0.8em;";
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach((day) => {
      const lbl = document.createElement("label");
      lbl.style.cssText = "display:flex;align-items:center;gap:2px;cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (alarm.days || []).includes(day);
      cb.addEventListener("change", () => {
        const days = window._alertsData.alarms[idx].days || [];
        if (cb.checked) { if (!days.includes(day)) days.push(day); }
        else { const i = days.indexOf(day); if (i !== -1) days.splice(i, 1); }
        window._alertsData.alarms[idx].days = days;
        setSaveButtonUnsaved();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(day));
      daysRow.appendChild(lbl);
    });
    wrap.appendChild(daysRow);
    c.appendChild(wrap);
  });
}

function renderNotificationsContainer() {
  const c = document.getElementById("notifications-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.notifications.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "📢 Notifications";
  c.appendChild(header);

  window._alertsData.notifications.forEach((n, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:0.4em;padding:4px 0;border-bottom:1px solid #e0d4b5;flex-wrap:wrap;";

    const valInput = document.createElement("input");
    valInput.type = "number"; valInput.min = "1"; valInput.value = n.value || 15;
    valInput.style.cssText = "width:55px;font-size:0.9em;padding:2px 4px;";
    valInput.addEventListener("change", () => { window._alertsData.notifications[idx].value = parseInt(valInput.value) || 1; setSaveButtonUnsaved(); });

    const unitSel = document.createElement("select");
    unitSel.style.cssText = "font-size:0.9em;padding:2px 4px;";
    ["minutes","hours","days","weeks"].forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u; opt.textContent = u;
      if (n.unit === u) opt.selected = true;
      unitSel.appendChild(opt);
    });
    unitSel.addEventListener("change", () => { window._alertsData.notifications[idx].unit = unitSel.value; setSaveButtonUnsaved(); });

    const relLbl = document.createElement("label");
    relLbl.style.cssText = "display:flex;align-items:center;gap:2px;font-size:0.85em;cursor:pointer;white-space:nowrap;";
    const relCb = document.createElement("input");
    relCb.type = "checkbox"; relCb.checked = !!n.relativeTo;
    relCb.addEventListener("change", () => { window._alertsData.notifications[idx].relativeTo = relCb.checked; setSaveButtonUnsaved(); });
    relLbl.appendChild(relCb);
    relLbl.appendChild(document.createTextNode("before due/start"));

    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteNotificationItem(idx);

    row.appendChild(document.createTextNode("Notify "));
    row.appendChild(valInput);
    row.appendChild(unitSel);
    row.appendChild(relLbl);
    row.appendChild(delBtn);
    c.appendChild(row);
  });
}

// ── Alarm CRUD ───────────────────────────────────────────────────────────────

let _editingAlarmIdx = null;

function openAlarmModal(event) {
  if (event) event.stopPropagation();
  // Add a new alarm inline — no modal needed, default time to now+1min, days to today
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  const defaultTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  window._alertsData.alarms.push({ _type: "alarm", name: "", time: defaultTime, recurrence: "none", days: [_dayAbbr(new Date())], enabled: true });
  const cb = document.getElementById("alarm");
  if (cb) cb.checked = true;
  _startAlarmChecker();
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function editAlarmItem(idx) {
  _editingAlarmIdx = idx;
  const alarm = window._alertsData.alarms[idx];
  const modal = document.getElementById("alarmModal");
  if (!modal) return;
  document.getElementById("alarmName").value = alarm.name || "";
  document.getElementById("alarmTime").value = alarm.time || "";
  document.getElementById("alarmRecurrence").value = alarm.recurrence || "none";
  document.querySelectorAll(".alarm-day").forEach((cb) => {
    cb.checked = (alarm.days || []).includes(cb.value);
  });
  document.getElementById("modalAlarmSubmit").textContent = "Update Alarm";
  modal.style.display = "flex";
}

function addAlarm() {
  const name = document.getElementById("alarmName")?.value.trim() || "";
  const time = document.getElementById("alarmTime")?.value.trim() || "";
  const recurrence = document.getElementById("alarmRecurrence")?.value || "none";
  const days = Array.from(document.querySelectorAll(".alarm-day:checked")).map((cb) => cb.value);
  if (!time) { alert("Please enter a time for the alarm."); return; }
  const alarm = { _type: "alarm", name, time, recurrence, days, enabled: true };
  if (_editingAlarmIdx !== null) {
    window._alertsData.alarms[_editingAlarmIdx] = alarm;
    _editingAlarmIdx = null;
  } else {
    window._alertsData.alarms.push(alarm);
  }
  // Set alarm checkbox
  const cb = document.getElementById("alarm");
  if (cb) cb.checked = true;
  closeAlarmModal(true);
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function toggleAlarmEnabled(idx) {
  window._alertsData.alarms[idx].enabled = !window._alertsData.alarms[idx].enabled;
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function deleteAlarmItem(idx) {
  window._alertsData.alarms.splice(idx, 1);
  if (window._alertsData.alarms.length === 0) {
    const cb = document.getElementById("alarm");
    if (cb) cb.checked = false;
  }
  renderAlarmsContainer();
  setSaveButtonUnsaved();
}

function closeAlarmModal(save) {
  const modal = document.getElementById("alarmModal");
  if (modal) modal.style.display = "none";
}

// ── Timer CRUD ───────────────────────────────────────────────────────────────

let _editingTimerIdx = null;

function openTimerModal(event) {
  if (event) event.stopPropagation();
  // Add a new timer inline — no modal needed
  window._alertsData.timers.push({ _type: "timer", name: "", totalSeconds: 0, loop: false });
  const idx = window._alertsData.timers.length - 1;
  window._timerRuntime[idx] = { remaining: 0, intervalId: null, running: false };
  renderTimersContainer();
  setSaveButtonUnsaved();
}

function editTimerItem(idx) {
  _editingTimerIdx = idx;
  const timer = window._alertsData.timers[idx];
  const modal = document.getElementById("timerModal");
  if (!modal) return;
  document.getElementById("timerNameModal").value = timer.name || "";
  document.getElementById("timerHoursModal").value = Math.floor(timer.totalSeconds / 3600);
  document.getElementById("timerMinutesModal").value = Math.floor((timer.totalSeconds % 3600) / 60);
  document.getElementById("timerSecondsModal").value = timer.totalSeconds % 60;
  document.getElementById("timerLoopModal").checked = !!timer.loop;
  document.getElementById("modalTimerSubmit").textContent = "Update Timer";
  modal.style.display = "flex";
}

function addTimer() {
  const name = document.getElementById("timerNameModal")?.value.trim() || "";
  const h = parseInt(document.getElementById("timerHoursModal")?.value) || 0;
  const m = parseInt(document.getElementById("timerMinutesModal")?.value) || 0;
  const s = parseInt(document.getElementById("timerSecondsModal")?.value) || 0;
  const loop = document.getElementById("timerLoopModal")?.checked || false;
  const totalSeconds = h * 3600 + m * 60 + s;
  if (totalSeconds <= 0) { alert("Please enter a duration greater than 0."); return; }
  const timer = { _type: "timer", name, totalSeconds, loop };
  if (_editingTimerIdx !== null) {
    window._alertsData.timers[_editingTimerIdx] = timer;
    _editingTimerIdx = null;
  } else {
    window._alertsData.timers.push(timer);
  }
  closeTimerModal(true);
  renderTimersContainer();
  setSaveButtonUnsaved();
}

function closeTimerModal(save) {
  const modal = document.getElementById("timerModal");
  if (modal) modal.style.display = "none";
}

// ── Stopwatch CRUD — with live running clock ─────────────────────────────────

// Runtime state for running stopwatches (not persisted)
window._swRuntime = {}; // idx -> { running, elapsed, intervalId, laps }

function addStopwatch(event) {
  if (event) event.stopPropagation();
  const idx = window._alertsData.stopwatches.length;
  window._alertsData.stopwatches.push({ _type: "stopwatch", name: "" });
  window._swRuntime[idx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
  renderStopwatchesContainer();
  setSaveButtonUnsaved();
}

function deleteStopwatchItem(idx) {
  // Stop interval if running
  const rt = window._swRuntime[idx];
  if (rt && rt.intervalId) clearInterval(rt.intervalId);
  window._alertsData.stopwatches.splice(idx, 1);
  // Rebuild runtime map
  const newRuntime = {};
  Object.keys(window._swRuntime).forEach((k) => {
    const ki = parseInt(k);
    if (ki < idx) newRuntime[ki] = window._swRuntime[ki];
    else if (ki > idx) newRuntime[ki - 1] = window._swRuntime[ki];
  });
  window._swRuntime = newRuntime;
  renderStopwatchesContainer();
  setSaveButtonUnsaved();
}

function _swFmt(ms) {
  const cs = Math.floor((ms % 1000) / 10);
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}

function renderStopwatchesContainer() {
  const c = document.getElementById("stopwatches-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.stopwatches.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "⏲️ Stopwatches";
  c.appendChild(header);

  window._alertsData.stopwatches.forEach((sw, idx) => {
    if (!window._swRuntime[idx]) {
      window._swRuntime[idx] = { running: false, elapsed: 0, intervalId: null, laps: [] };
    }
    const rt = window._swRuntime[idx];

    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;";
    wrap.id = `sw-wrap-${idx}`;

    // Name row
    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = sw.name || "";
    nameInput.placeholder = "Stopwatch name";
    nameInput.style.cssText = "flex:1;font-size:0.9em;padding:2px 4px;";
    nameInput.addEventListener("input", () => {
      window._alertsData.stopwatches[idx].name = nameInput.value;
      setSaveButtonUnsaved();
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "❌";
    delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteStopwatchItem(idx);
    nameRow.appendChild(nameInput);
    nameRow.appendChild(delBtn);
    wrap.appendChild(nameRow);

    // Display
    const display = document.createElement("div");
    display.id = `sw-display-${idx}`;
    display.style.cssText = "font-family:monospace;font-size:1.4em;text-align:center;padding:0.2em 0;letter-spacing:0.05em;";
    display.textContent = _swFmt(rt.elapsed);
    wrap.appendChild(display);

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:0.4em;justify-content:center;margin-top:0.3em;";

    const startStopBtn = document.createElement("button");
    startStopBtn.type = "button";
    startStopBtn.id = `sw-startstop-${idx}`;
    startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
    startStopBtn.style.cssText = "padding:2px 10px;";
    startStopBtn.onclick = () => {
      if (rt.running) {
        clearInterval(rt.intervalId);
        rt.intervalId = null;
        rt.running = false;
        startStopBtn.textContent = "▶ Start";
      } else {
        const startMs = Date.now() - rt.elapsed;
        rt.intervalId = setInterval(() => {
          rt.elapsed = Date.now() - startMs;
          const d = document.getElementById(`sw-display-${idx}`);
          if (d) d.textContent = _swFmt(rt.elapsed);
        }, 50);
        rt.running = true;
        startStopBtn.textContent = "⏸ Pause";
      }
    };

    const lapBtn = document.createElement("button");
    lapBtn.type = "button";
    lapBtn.textContent = "🏁 Lap";
    lapBtn.style.cssText = "padding:2px 10px;";
    lapBtn.onclick = () => {
      if (rt.running) {
        rt.laps.push(_swFmt(rt.elapsed));
        renderLaps(idx, lapsDiv);
      }
    };

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "🔄 Reset";
    resetBtn.style.cssText = "padding:2px 10px;";
    resetBtn.onclick = () => {
      clearInterval(rt.intervalId);
      rt.intervalId = null;
      rt.running = false;
      rt.elapsed = 0;
      rt.laps = [];
      display.textContent = _swFmt(0);
      startStopBtn.textContent = "▶ Start";
      renderLaps(idx, lapsDiv);
    };

    controls.appendChild(startStopBtn);
    controls.appendChild(lapBtn);
    controls.appendChild(resetBtn);
    wrap.appendChild(controls);

    // Laps
    const lapsDiv = document.createElement("div");
    lapsDiv.id = `sw-laps-${idx}`;
    lapsDiv.style.cssText = "font-size:0.8em;margin-top:0.3em;max-height:80px;overflow-y:auto;";
    renderLaps(idx, lapsDiv);
    wrap.appendChild(lapsDiv);

    c.appendChild(wrap);
  });
}

function renderLaps(idx, container) {
  const rt = window._swRuntime[idx];
  if (!rt || !container) return;
  container.innerHTML = "";
  rt.laps.forEach((lap, i) => {
    const d = document.createElement("div");
    d.style.cssText = "border-bottom:1px solid #e0d4b5;padding:1px 0;";
    d.textContent = `Lap ${i + 1}: ${lap}`;
    container.appendChild(d);
  });
}

function closeStopwatchModal() {}
function saveStopwatchDetails() {}

// ── Timer CRUD — with countdown display ──────────────────────────────────────

// Runtime state for running timers
window._timerRuntime = {}; // idx -> { remaining, intervalId, running }

function renderTimersContainer() {
  const c = document.getElementById("timers-container");
  if (!c) return;
  c.innerHTML = "";
  if (window._alertsData.timers.length === 0) return;

  const header = document.createElement("h4");
  header.style.cssText = "margin:0.5em 0 0.25em;font-size:0.9em;opacity:0.7;";
  header.textContent = "⏱️ Timers";
  c.appendChild(header);

  window._alertsData.timers.forEach((timer, idx) => {
    if (!window._timerRuntime[idx]) {
      window._timerRuntime[idx] = { remaining: timer.totalSeconds, intervalId: null, running: false };
    }
    const rt = window._timerRuntime[idx];

    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #e0d4b5;border-radius:4px;padding:0.4em 0.6em;margin-bottom:0.4em;";

    // Name + duration inputs row
    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;align-items:center;gap:0.4em;margin-bottom:0.3em;flex-wrap:wrap;";

    const nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.value = timer.name || ""; nameInput.placeholder = "Timer name";
    nameInput.style.cssText = "flex:1;min-width:80px;font-size:0.9em;padding:2px 4px;";
    nameInput.addEventListener("input", () => { window._alertsData.timers[idx].name = nameInput.value; setSaveButtonUnsaved(); });

    // HH:MM:SS inputs
    const hInput = document.createElement("input");
    hInput.type = "number"; hInput.min = "0"; hInput.placeholder = "HH";
    hInput.value = Math.floor(timer.totalSeconds / 3600) || "";
    hInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";

    const mInput = document.createElement("input");
    mInput.type = "number"; mInput.min = "0"; mInput.max = "59"; mInput.placeholder = "MM";
    mInput.value = Math.floor((timer.totalSeconds % 3600) / 60) || "";
    mInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";

    const sInput = document.createElement("input");
    sInput.type = "number"; sInput.min = "0"; sInput.max = "59"; sInput.placeholder = "SS";
    sInput.value = timer.totalSeconds % 60 || "";
    sInput.style.cssText = "width:42px;font-size:0.9em;padding:2px 4px;text-align:center;";

    const updateDuration = () => {
      const h = parseInt(hInput.value) || 0;
      const m = parseInt(mInput.value) || 0;
      const s = parseInt(sInput.value) || 0;
      const total = h * 3600 + m * 60 + s;
      window._alertsData.timers[idx].totalSeconds = total;
      if (!rt.running) {
        rt.remaining = total;
        const d = document.getElementById(`timer-display-${idx}`);
        if (d) d.textContent = fmtTimer(rt.remaining);
      }
      setSaveButtonUnsaved();
    };
    [hInput, mInput, sInput].forEach((inp) => inp.addEventListener("change", updateDuration));

    const loopLbl = document.createElement("label");
    loopLbl.style.cssText = "display:flex;align-items:center;gap:2px;font-size:0.85em;cursor:pointer;";
    const loopCb = document.createElement("input");
    loopCb.type = "checkbox"; loopCb.checked = !!timer.loop;
    loopCb.addEventListener("change", () => { window._alertsData.timers[idx].loop = loopCb.checked; setSaveButtonUnsaved(); });
    loopLbl.appendChild(loopCb);
    loopLbl.appendChild(document.createTextNode("🔁"));

    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.textContent = "❌"; delBtn.style.cssText = "padding:1px 5px;";
    delBtn.onclick = () => deleteTimerItem(idx);

    row1.appendChild(nameInput);
    row1.appendChild(hInput);
    row1.appendChild(document.createTextNode(":"));
    row1.appendChild(mInput);
    row1.appendChild(document.createTextNode(":"));
    row1.appendChild(sInput);
    row1.appendChild(loopLbl);
    row1.appendChild(delBtn);
    wrap.appendChild(row1);

    // Countdown display
    const fmtTimer = (s) => {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    };
    const display = document.createElement("div");
    display.id = `timer-display-${idx}`;
    display.style.cssText = "font-family:monospace;font-size:1.4em;text-align:center;padding:0.2em 0;";
    display.textContent = fmtTimer(rt.remaining);
    wrap.appendChild(display);

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;gap:0.4em;justify-content:center;margin-top:0.3em;";

    const startStopBtn = document.createElement("button");
    startStopBtn.type = "button";
    startStopBtn.id = `timer-startstop-${idx}`;
    startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
    startStopBtn.style.cssText = "padding:2px 10px;";
    startStopBtn.onclick = () => {
      if (rt.running) {
        clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
        startStopBtn.textContent = "▶ Start";
      } else {
        if (rt.remaining <= 0) rt.remaining = window._alertsData.timers[idx].totalSeconds;
        rt.intervalId = setInterval(() => {
          rt.remaining = Math.max(0, rt.remaining - 1);
          const d = document.getElementById(`timer-display-${idx}`);
          if (d) d.textContent = fmtTimer(rt.remaining);
          if (rt.remaining <= 0) {
            clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
            const btn = document.getElementById(`timer-startstop-${idx}`);
            if (btn) btn.textContent = "▶ Start";
            _playTimerSound();
            if (window._alertsData.timers[idx].loop) {
              rt.remaining = window._alertsData.timers[idx].totalSeconds;
            } else {
              // Show toast instead of blocking alert
              const toast = document.createElement("div");
              toast.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#fff5e6;border:2px solid #8b5a2b;border-radius:8px;padding:0.75em 1.5em;box-shadow:0 4px 16px rgba(0,0,0,0.3);";
              toast.innerHTML = `⏱️ Timer "${window._alertsData.timers[idx].name || "Timer"}" finished! <button onclick="this.parentElement.remove();_stopAlarmSound();" style="margin-left:8px;padding:2px 8px;">OK</button>`;
              document.body.appendChild(toast);
            }
          }
        }, 1000);
        rt.running = true; startStopBtn.textContent = "⏸ Pause";
      }
    };

    const resetBtn = document.createElement("button");
    resetBtn.type = "button"; resetBtn.textContent = "🔄 Reset"; resetBtn.style.cssText = "padding:2px 10px;";
    resetBtn.onclick = () => {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      rt.remaining = window._alertsData.timers[idx].totalSeconds;
      display.textContent = fmtTimer(rt.remaining);
      startStopBtn.textContent = "▶ Start";
    };

    controls.appendChild(startStopBtn);
    controls.appendChild(resetBtn);
    wrap.appendChild(controls);
    c.appendChild(wrap);
  });
}

function deleteTimerItem(idx) {
  const rt = window._timerRuntime[idx];
  if (rt && rt.intervalId) clearInterval(rt.intervalId);
  window._alertsData.timers.splice(idx, 1);
  const newRt = {};
  Object.keys(window._timerRuntime).forEach((k) => {
    const ki = parseInt(k);
    if (ki < idx) newRt[ki] = window._timerRuntime[ki];
    else if (ki > idx) newRt[ki - 1] = window._timerRuntime[ki];
  });
  window._timerRuntime = newRt;
  renderTimersContainer();
  setSaveButtonUnsaved();
}

// ── Notification CRUD ────────────────────────────────────────────────────────

function openNotificationModal(event) {
  if (event) event.stopPropagation();
  // Add a new notification inline
  window._alertsData.notifications.push({ _type: "notification", value: 15, unit: "minutes", relativeTo: false });
  const cb = document.getElementById("notification");
  if (cb) cb.checked = true;
  _startNotificationChecker();
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function addNotification() {
  const value = parseInt(document.getElementById("notificationValue")?.value);
  const unit = document.getElementById("notificationUnit")?.value || "minutes";
  const relativeTo = document.getElementById("notificationRelativeToToggle")?.checked || false;
  const onlyIfUndone = document.getElementById("notificationOnlyIfUndone")?.checked ?? true;
  const message = document.getElementById("notificationMessage")?.value?.trim() || '';
  if (!value || value <= 0) { alert("Please enter a valid number."); return; }
  window._alertsData.notifications.push({ _type: "notification", value, unit, relativeTo, only_if_undone: onlyIfUndone, message });
  closeNotificationModal(true);
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function deleteNotificationItem(idx) {
  window._alertsData.notifications.splice(idx, 1);
  if (window._alertsData.notifications.length === 0) {
    const cb = document.getElementById("notification");
    if (cb) cb.checked = false;
  }
  renderNotificationsContainer();
  setSaveButtonUnsaved();
}

function closeNotificationModal(save) {
  const modal = document.getElementById("notificationModal");
  if (modal) modal.style.display = "none";
}

function validateNotificationInputs() {
  const val = document.getElementById("notificationValue")?.value;
  const btn = document.getElementById("modalNotificationSubmit");
  if (btn) btn.disabled = !val || isNaN(val) || Number(val) <= 0;
}

function toggleAlertFilterDropdown(event) {
  if (event) event.stopPropagation();
  const containers = ["alarms-container", "timers-container", "stopwatches-container", "notifications-container"];
  const anyVisible = containers.some((id) => {
    const el = document.getElementById(id);
    return el && el.style.display !== "none" && el.innerHTML !== "";
  });
  containers.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = anyVisible ? "none" : "";
  });
}

// ── End alerts zone ──────────────────────────────────────────────────────────

// ── Notes zone functions ─────────────────────────────────────────────────────

function autoGrowNote(el) {
  el.style.height = "auto";
  const maxH = Math.floor(window.innerHeight * 0.6);
  el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  _checkChitLinkAutocomplete(el);
}

// ── [[ ]] Chit Link Autocomplete ──
let _chitLinkDropdown = null;
let _chitLinkStart = -1;

async function _checkChitLinkAutocomplete(textarea) {
  const pos = textarea.selectionStart;
  const text = textarea.value.substring(0, pos);
  const openIdx = text.lastIndexOf('[[');
  const closeIdx = text.lastIndexOf(']]');

  // If [[ is open and not yet closed
  if (openIdx >= 0 && openIdx > closeIdx) {
    const query = text.substring(openIdx + 2).toLowerCase();
    _chitLinkStart = openIdx;
    if (query.length < 1) { _removeChitLinkDropdown(); return; }

    // Fetch chits if not cached
    if (!window._allChitTitles) {
      try {
        const resp = await fetch('/api/chits');
        if (resp.ok) window._allChitTitles = await resp.json();
      } catch (e) { return; }
    }
    const matches = (window._allChitTitles || [])
      .filter(c => c.title && c.title.toLowerCase().includes(query) && c.id !== chitId)
      .slice(0, 8);

    if (matches.length === 0) { _removeChitLinkDropdown(); return; }
    _showChitLinkDropdown(textarea, matches);
  } else {
    _removeChitLinkDropdown();
  }
}

function _showChitLinkDropdown(textarea, matches) {
  _removeChitLinkDropdown();
  const dd = document.createElement('div');
  dd.id = 'chit-link-dropdown';
  dd.style.cssText = 'position:absolute;z-index:9999;background:#fff8e1;border:2px solid #8b4513;border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:0.9em;min-width:200px;';

  matches.forEach((chit, i) => {
    const opt = document.createElement('div');
    opt.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #e0d4b5;';
    opt.textContent = chit.title;
    opt.title = chit.id;
    if (i === 0) opt.style.background = '#f0e6d0';
    opt.addEventListener('mouseenter', () => {
      dd.querySelectorAll('div').forEach(d => d.style.background = '');
      opt.style.background = '#f0e6d0';
    });
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      _insertChitLink(textarea, chit.title);
    });
    dd.appendChild(opt);
  });

  // Position below cursor
  const rect = textarea.getBoundingClientRect();
  dd.style.left = (rect.left + 20) + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.position = 'fixed';
  document.body.appendChild(dd);
  _chitLinkDropdown = dd;
}

function _removeChitLinkDropdown() {
  if (_chitLinkDropdown) { _chitLinkDropdown.remove(); _chitLinkDropdown = null; }
}

function _insertChitLink(textarea, title) {
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, _chitLinkStart + 2);
  const after = textarea.value.substring(pos);
  textarea.value = before + title + ']]' + after;
  const newPos = _chitLinkStart + 2 + title.length + 2;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
  _removeChitLinkDropdown();
  if (typeof markEditorUnsaved === 'function') markEditorUnsaved();
}

// Close dropdown on blur or Escape
document.addEventListener('keydown', (e) => {
  if (!_chitLinkDropdown) return;
  if (e.key === 'Escape') { _removeChitLinkDropdown(); return; }
  if (e.key === 'Enter') {
    const highlighted = _chitLinkDropdown.querySelector('div[style*="f0e6d0"]');
    if (highlighted) {
      e.preventDefault();
      const textarea = document.getElementById('note');
      _insertChitLink(textarea, highlighted.textContent);
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = Array.from(_chitLinkDropdown.querySelectorAll('div'));
    const curIdx = items.findIndex(d => d.style.background.includes('f0e6d0'));
    items.forEach(d => d.style.background = '');
    const next = e.key === 'ArrowDown' ? Math.min(curIdx + 1, items.length - 1) : Math.max(curIdx - 1, 0);
    items[next].style.background = '#f0e6d0';
    items[next].scrollIntoView({ block: 'nearest' });
  }
});

function shrinkNoteToFourLines(event) {
  if (event) event.stopPropagation();
  const textarea = document.getElementById("note");
  const rendered = document.getElementById("notes-rendered-output");
  const lineH = textarea ? (parseInt(getComputedStyle(textarea).lineHeight) || 22) : 22;
  const targetH = lineH * 4 + 16;
  if (textarea) textarea.style.height = targetH + "px";
  if (rendered) rendered.style.minHeight = targetH + "px";
}

function _setNotesRenderToggleLabel(isRendered, source) {
  const btnId = source === "modal" ? "modal-render-toggle-btn" : "notes-render-toggle-btn";
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isRendered) {
    btn.innerHTML = '<i class="fas fa-edit"></i> Edit';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i> Render';
  }
}

function toggleNotesViewMode(event) {
  if (event) event.stopPropagation();
  const textarea = document.getElementById("note");
  const rendered = document.getElementById("notes-rendered-output");
  if (!textarea || !rendered) return;

  const isCurrentlyRendered = rendered.style.display !== "none";
  if (isCurrentlyRendered) {
    // Switch to edit — restore textarea at same visual height as rendered div
    const h = rendered.offsetHeight;
    rendered.style.display = "none";
    textarea.style.display = "";
    if (h > 0) textarea.style.height = h + "px";
    textarea.focus();
    _setNotesRenderToggleLabel(false, "main");
  } else {
    // Switch to rendered — capture textarea height first
    const h = textarea.offsetHeight || textarea.scrollHeight;
    if (typeof marked !== "undefined") {
      rendered.innerHTML = marked.parse(textarea.value || "");
    } else {
      rendered.innerHTML = `<pre style="white-space:pre-wrap;">${textarea.value}</pre>`;
    }
    rendered.style.minHeight = h + "px";
    rendered.style.display = "block";
    textarea.style.display = "none";
    _setNotesRenderToggleLabel(true, "main");
  }
}

function copyNotesToClipboard(event, source) {
  if (event) event.stopPropagation();
  let text = "";
  if (source === "modal") {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    const textarea = document.getElementById("note");
    text = textarea ? textarea.value : "";
  }
  const btn = event?.target?.closest("button");
  const origHTML = btn ? btn.innerHTML : null;
  navigator.clipboard.writeText(text).then(() => {
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(() => { btn.innerHTML = origHTML; }, 1200); }
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (btn && origHTML) { btn.innerHTML = "✅"; setTimeout(() => { btn.innerHTML = origHTML; }, 1200); }
  });
}

function downloadNotes(event, source) {
  if (event) event.stopPropagation();
  let text = "";
  if (source === "modal") {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    text = modalInput ? modalInput.innerText : "";
  } else {
    const textarea = document.getElementById("note");
    text = textarea ? textarea.value : "";
  }
  const title = document.getElementById("title")?.value.trim() || "note";
  const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".md";
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function openNotesModal(event) {
  if (event) event.stopPropagation();
  const modal = document.getElementById("notesModal");
  if (!modal) return;
  const textarea = document.getElementById("note");
  const modalInput = document.getElementById("notes-markdown-input-modal");
  const modalOutput = document.getElementById("notes-rendered-output-modal");
  if (textarea && modalInput) modalInput.innerText = textarea.value || "";
  if (modalOutput) modalOutput.style.display = "none";
  if (modalInput) modalInput.style.display = "";
  _setNotesRenderToggleLabel(false, "modal");
  modal.style.display = "flex";
  if (modalInput) setTimeout(() => modalInput.focus(), 50);
}

function closeNotesModal(save) {
  const modal = document.getElementById("notesModal");
  if (modal) modal.style.display = "none";
  if (save) {
    const modalInput = document.getElementById("notes-markdown-input-modal");
    const mainNote = document.getElementById("note");
    if (modalInput && mainNote) {
      mainNote.value = modalInput.innerText;
      autoGrowNote(mainNote);
      setSaveButtonUnsaved();
    }
  }
}

function toggleModalNotesRender() {
  const modalInput = document.getElementById("notes-markdown-input-modal");
  const modalOutput = document.getElementById("notes-rendered-output-modal");
  if (!modalInput || !modalOutput) return;
  const isRendered = modalOutput.style.display !== "none";
  if (isRendered) {
    modalOutput.style.display = "none";
    modalInput.style.display = "";
    modalInput.focus();
    _setNotesRenderToggleLabel(false, "modal");
  } else {
    if (typeof marked !== "undefined") {
      modalOutput.innerHTML = marked.parse(modalInput.innerText || "");
    } else {
      modalOutput.innerHTML = `<pre style="white-space:pre-wrap;">${modalInput.innerText}</pre>`;
    }
    modalOutput.style.display = "block";
    modalInput.style.display = "none";
    _setNotesRenderToggleLabel(true, "modal");
  }
}

// ── End notes zone functions ──────────────────────────────────────────────────
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

    // If project master, populate all standard fields AND initialize Projects Zone
    if (chit.is_project_master) {
      // Populate standard editor fields first (title, note, color, etc.)
      // Fall through to the normal field population below, then init project zone
    }

    // Populate editor fields for all chits (including project masters)

    const titleInput = document.getElementById("title");
    if (titleInput) {
      titleInput.value = chit.title || "";
      console.log(`[loadChitData] Set title-input to: "${titleInput.value}"`);
    }

    const noteTextarea = document.getElementById("note");
    if (noteTextarea) {
      noteTextarea.value = chit.note || "";
      // Auto-grow to fit content
      setTimeout(() => autoGrowNote(noteTextarea), 0);
      // Start in rendered mode if there's content
      if (chit.note && chit.note.trim()) {
        setTimeout(() => toggleNotesViewMode(null), 50);
      }
      console.log(`[loadChitData] Set note-textarea to: "${noteTextarea.value.slice(0,40)}..."`);
    }

    // Recurrence is now loaded via _loadRecurrenceRule below
    console.log(`[loadChitData] Recurrence rule:`, chit.recurrence_rule);

    // Load recurrence rule (new format)
    if (chit.recurrence_rule) {
      _loadRecurrenceRule(chit.recurrence_rule);
      const icon = document.getElementById('recurrenceIcon');
      if (icon) icon.style.display = '';
    }
    window._loadedRecurrenceExceptions = chit.recurrence_exceptions || null;

    // Populate Audit Log zone for recurring chits
    const auditSection = document.getElementById('auditLogSection');
    const auditContainer = document.getElementById('auditLogContainer');
    if (auditSection && auditContainer) {
      if (chit.recurrence_rule && chit.recurrence_rule.freq) {
        auditSection.style.display = '';
        // Always start collapsed
        const auditContent = document.getElementById('auditLogContent');
        if (auditContent) auditContent.style.display = 'none';
        const auditToggle = auditSection.querySelector('.zone-toggle-icon');
        if (auditToggle) auditToggle.textContent = '🔽';
        // Render series summary
        if (typeof _renderSeriesSummary === 'function') {
          _renderSeriesSummary(auditContainer, chit, chit.id);
        }
      } else {
        auditSection.style.display = 'none';
      }
    }

    const allDayInput = document.getElementById("allDay");
    if (allDayInput) {
      const isAllDay = !!(chit.all_day || chit.allDay);
      // This is now handled by the date mode section after date fields are set
      console.log(`[loadChitData] allDay: ${isAllDay}`);
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
    // Sync the Due Complete checkbox
    const dueCompleteCb = document.getElementById('dueComplete');
    if (dueCompleteCb) dueCompleteCb.checked = (chit.status === 'Complete');
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

    // Set date mode radio based on chit data
    _dateModeSuppressUnsaved = true;
    const dateMode = _detectDateMode(chit);
    _setDateMode(dateMode);

    // Set all-day checkbox
    const allDayCheckbox = document.getElementById("allDay");
    if (allDayCheckbox) {
      allDayCheckbox.checked = !!(chit.all_day || chit.allDay);
      if (allDayCheckbox.checked) toggleAllDay();
    }
    _dateModeSuppressUnsaved = false;

    // Re-apply All Day after all fields are fully set
    const _allDayCb = document.getElementById("allDay");
    if (_allDayCb && _allDayCb.checked) toggleAllDay();

    if (window.checklist) {
      if (Array.isArray(chit.checklist)) {
        window.checklist.loadItems(chit.checklist);
        console.log(`[loadChitData] Loaded checklist items:`, chit.checklist);
      } else {
        window.checklist.loadItems([]);
        console.log("[loadChitData] Loaded empty checklist");
      }
    }

    // Restore alerts
    _alertsFromChit(chit);

    // Restore location
    const locationInput = document.getElementById("location");
    if (locationInput) {
      locationInput.value = chit.location || "";
      console.log(`[loadChitData] Set location to: "${locationInput.value}"`);
    }

    // Restore people (stored as array, display as chips)
    const peopleArray = Array.isArray(chit.people)
      ? chit.people
      : (chit.people ? chit.people.split(',').map(p => p.trim()).filter(Boolean) : []);
    if (typeof _setPeopleFromArray === 'function') {
      _setPeopleFromArray(peopleArray);
    }
    console.log(`[loadChitData] Set people chips: ${peopleArray.length} people`);

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
        archivedButton.textContent = chit.archived ? "📦 Archived" : "📦 Archive";
        archivedButton.classList.toggle("archived-active", !!chit.archived);
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
    const hasDate = !!(chit.start_datetime || chit.due_datetime);
    const compactWeatherSection = document.getElementById("compactWeatherSection");
    if (locationForWeather && hasDate) {
      fetchWeatherData(locationForWeather).catch((err) => {
        console.log("Could not fetch weather on load:", err);
      });
    } else if (compactWeatherSection) {
      compactWeatherSection.classList.add('weather-placeholder'); compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`;
    }

    window.currentChitId = chit.id || chitId;
    // Preserve child_chits so buildChitObject doesn't wipe them on save
    window._loadedChildChits = Array.isArray(chit.child_chits) ? chit.child_chits : [];
    console.log(
      `[loadChitData] Set currentChitId to: "${window.currentChitId}"`,
    );

    // Collapse zones that have no data, expand zones that do
    applyZoneStates(chit);

    // If project master, initialize the Projects Zone after all fields are populated
    if (chit.is_project_master) {
      if (typeof initializeProjectZone === "function") {
        await initializeProjectZone(chit.id);
      }
    }

    markEditorSaved();

    // Show instance editing banner if editing a single recurrence instance
    if (window._editingInstance && chit.recurrence_rule) {
      _showInstanceBanner(window._editingInstance);
    }
  } catch (error) {
    console.error("[loadChitData] Error loading chit:", error);
  }
}

/**
 * After loading a chit, collapse zones whose fields are all empty,
 * expand zones that have at least one value.
 */
function applyZoneStates(chit) {
  // Map of [sectionId, contentId, hasDataFn]
  const zones = [
    [
      "datesSection", "datesContent",
      () => !!(chit.start_datetime || chit.end_datetime || chit.due_datetime || chit.recurrence),
    ],
    [
      "taskSection", "taskContent",
      () => !!(chit.priority || chit.severity || chit.status),
    ],
    [
      "locationSection", "locationContent",
      () => !!(chit.location && chit.location.trim()),
    ],
    [
      "tagsSection", "tagsContent",
      () => Array.isArray(chit.tags) && chit.tags.length > 0,
    ],
    [
      "peopleSection", "peopleContent",
      () => Array.isArray(chit.people) ? chit.people.length > 0 : !!(chit.people && chit.people.trim()),
    ],
    [
      "notesSection", "notesContent",
      () => !!(chit.note && chit.note.trim()),
    ],
    [
      "checklistSection", "checklistContent",
      () => Array.isArray(chit.checklist) && chit.checklist.length > 0,
    ],
    [
      "alertsSection", "alertsContent",
      () => !!(chit.alarm || chit.notification || (Array.isArray(chit.alerts) && chit.alerts.length > 0)),
    ],
    [
      "healthIndicatorsSection", "healthIndicatorsContent",
      () => false, // always collapsed — no chit-specific health data
    ],
    [
      "colorSection", "colorContent",
      () => !!(chit.color && chit.color !== "#C66B6B"),
    ],
    [
      "projectsSection", "projectsContent",
      () => !!(chit.is_project_master || (Array.isArray(chit.child_chits) && chit.child_chits.length > 0)),
    ],
  ];

  zones.forEach(([sectionId, contentId, hasData]) => {
    const section = document.getElementById(sectionId);
    const content = document.getElementById(contentId);
    if (!section || !content) return;

    const shouldExpand = hasData();

    if (shouldExpand) {
      // Expand: remove collapsed classes, show buttons
      content.classList.remove("collapsed");
      section.classList.remove("collapsed");
      section.querySelectorAll(".zone-button").forEach((btn) => {
        btn.style.display = "";
      });
    } else {
      // Collapse: add collapsed classes, hide buttons
      content.classList.add("collapsed");
      section.classList.add("collapsed");
      section.querySelectorAll(".zone-button").forEach((btn) => {
        btn.style.display = "none";
      });
    }
  });
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
  const hasDate = !!(document.getElementById("start_datetime")?.value || document.getElementById("due_datetime")?.value);

  if (!hasDate) {
    const cws = document.getElementById("compactWeatherSection");
    if (cws) cws.classList.add('weather-placeholder'); cws.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`;
    // Still show the map
    getCoordinates(address).then((coords) => {
      displayMapInUI(coords.lat, coords.lon, address);
    }).catch(() => {});
    return;
  }

  fetchWeatherData(address)
    .then((weatherData) => {
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

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM Content Loaded - Initializing editor...");

  // Initialize mobile actions modal (replaces header buttons on mobile)
  if (typeof initMobileActionsModal === 'function') initMobileActionsModal();

  // Tag search filter-as-you-type
  var labelsInput = document.getElementById('labels');
  if (labelsInput) {
    labelsInput.addEventListener('input', function () {
      _filterTagTree(labelsInput.value.trim());
    });
  }

  // Initialize shared save/cancel button system
  window._cwocSave = new CwocSaveSystem({
    singleBtnId: 'saveButton',
    stayBtnId: 'saveStayButton',
    exitBtnId: 'saveExitButton',
    cancelSelector: '.cancel',
    getReturnUrl: () => '/',
  });

  initializeChitId();

  // Populate "Move to Project" dropdown with actual project master chits
  fetch('/api/chits').then(r => r.ok ? r.json() : []).then(allChits => {
    const dd = document.getElementById('moveToProjectDropdown');
    if (!dd) return;
    allChits.filter(c => c.is_project_master && c.id !== chitId).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title || '(Untitled Project)';
      dd.appendChild(opt);
    });
  }).catch(() => {});

  // Load snap setting (for future calendar drag use)
  _loadSnapSetting();

  // Auto-colon mask for time inputs (HH:MM format) + snap dropdown
  document.querySelectorAll('.time-input').forEach(input => {
    input.addEventListener('input', () => {
      let v = input.value.replace(/[^0-9]/g, '');
      if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2, 4);
      if (v.length > 5) v = v.slice(0, 5);
      input.value = v;
    });
    input.addEventListener('focus', () => _showTimeDropdown(input));
  });

  // Set default date mode to None for new chits (suppress unsaved marking)
  _dateModeSuppressUnsaved = true;
  _setDateMode('none');
  _dateModeSuppressUnsaved = false;

  // Ensure recurrence UI is hidden on init
  const _repeatBlock = document.getElementById('repeatOptionsBlock');
  if (_repeatBlock) _repeatBlock.style.display = 'none';
  const _recIcon = document.getElementById('recurrenceIcon');
  if (_recIcon) _recIcon.style.display = 'none';

  // Load time format setting for alarm display
  loadEditorTimeFormat();

  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Load custom colors from settings and render into the color picker
  fetchCustomColors().then((colors) => {
    window.customColors = colors;
    renderCustomColors(colors);
  });

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
  initializeFlatpickr("#recurrenceUntil", { dateFormat: "Y-M-d" });

  // Recurrence freq change shows/hides day checkboxes
  const recFreq = document.getElementById('recurrenceFreq');
  if (recFreq) recFreq.addEventListener('change', _updateByDayVisibility);

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

    // Pre-populate start/end from URL params (e.g. from calendar empty slot dblclick)
    const params = new URLSearchParams(window.location.search);
    const preStart = params.get('start');
    const preEnd = params.get('end');
    if (preStart) {
      _dateModeSuppressUnsaved = true;
      _setDateMode('startend');
      _dateModeSuppressUnsaved = false;
      const s = new Date(preStart);
      const startDateInput = document.getElementById('start_datetime');
      const startTimeInput = document.getElementById('start_time');
      if (startDateInput) {
        const fp = startDateInput._flatpickr;
        if (fp) fp.setDate(s, true); else startDateInput.value = preStart.slice(0, 10);
      }
      if (startTimeInput) {
        const pad = (n) => String(n).padStart(2, '0');
        startTimeInput.value = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
      }
      if (preEnd) {
        const e = new Date(preEnd);
        const endDateInput = document.getElementById('end_datetime');
        const endTimeInput = document.getElementById('end_time');
        if (endDateInput) {
          const fp = endDateInput._flatpickr;
          if (fp) fp.setDate(e, true); else endDateInput.value = preEnd.slice(0, 10);
        }
        if (endTimeInput) {
          const pad = (n) => String(n).padStart(2, '0');
          endTimeInput.value = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
        }
      }
    }

    // Handle allday param from month view dblclick
    const preAllDay = params.get('allday');
    if (preAllDay === '1') {
      const allDayCb = document.getElementById('allDay');
      if (allDayCb) {
        allDayCb.checked = true;
        toggleAllDay();
      }
    }
  }

  setInterval(checkNotifications, 60000);

  const allDayBtn = document.getElementById("allDayToggleButton");
  if (allDayBtn) allDayBtn.onclick = toggleAllDay;

  const notesExpandBtn = document.getElementById("open-notes-modal-button");
  if (notesExpandBtn) notesExpandBtn.onclick = openNotesModal;

  // Auto-switch note to render mode on blur
  const noteTextarea = document.getElementById("note");
  if (noteTextarea) {
    noteTextarea.addEventListener("blur", () => {
      const rendered = document.getElementById("notes-rendered-output");
      if (rendered && rendered.style.display === "none" && noteTextarea.value.trim()) {
        toggleNotesViewMode();
      }
    });
  }

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

  // ESC key — same logic as clicking Exit/Cancel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close QR modal first if open
      const qrModal = document.getElementById('qr-modal-overlay');
      if (qrModal) { qrModal.remove(); return; }
      // Don't intercept if a modal is open
      const openModal = document.querySelector(
        '.modal-overlay[style*="block"], .modal[style*="block"], .flatpickr-calendar.open'
      );
      if (openModal) return;
      e.preventDefault();
      cancelOrExit();
    }

    // Alt+number hotkeys delegated to shared editor framework
  });

  cwocInitEditorHotkeys({
    '1': ['datesSection', 'datesContent'],
    '2': ['taskSection', 'taskContent'],
    '3': ['tagsSection', 'tagsContent'],
    '4': ['notesSection', 'notesContent'],
    '5': ['checklistSection', 'checklistContent'],
    '6': ['alertsSection', 'alertsContent'],
    '7': ['locationSection', 'locationContent'],
    '8': ['peopleSection', 'peopleContent'],
    '9': ['colorSection', 'colorContent'],
    '0': ['projectsSection', 'projectsContent'],
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
  if (window._cwocSave) window._cwocSave.markSaved();
}

function setSaveButtonUnsaved() {
  if (window._cwocSave) window._cwocSave.markUnsaved();
}

function cancelOrExit() {
  if (window._cwocSave) {
    window._cwocSave.cancelOrExit();
  } else {
    window.location.href = "/";
  }
}

// ── Tag zone button functions ─────────────────────────────────────────────────

/** Expand or collapse all tag tree nodes */
function toggleAllTags(event, expand) {
  if (event) event.stopPropagation();
  const container = document.getElementById('tagTreeContainer');
  if (!container) return;
  // Toggle all child containers
  container.querySelectorAll('[data-tag-children]').forEach(el => {
    el.style.display = expand ? '' : 'none';
  });
  // Update all toggle arrows
  container.querySelectorAll('[data-tag-toggle]').forEach(el => {
    el.textContent = expand ? '▼' : '▶';
  });
}

/** Create a new tag — navigate to settings tag editor */
function createTag(event) {
  if (event) event.stopPropagation();
  navigateToSettings();
}

/** Clear the tag search input */
function clearTagSearch(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('labels');
  if (input) { input.value = ''; _filterTagTree(''); input.focus(); }
}

/** Filter the tag tree by search text — hides non-matching items */
function _filterTagTree(query) {
  const container = document.getElementById('tagTreeContainer');
  if (!container) return;
  const q = (query || '').toLowerCase();
  // Find all label elements (each tag row is a label with a checkbox)
  const labels = container.querySelectorAll('label');
  labels.forEach(function (lbl) {
    var text = (lbl.textContent || '').toLowerCase();
    lbl.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
  // Show/hide group headers (divs that contain the group name)
  const groups = container.querySelectorAll('.tag-group-header, [data-tag-group]');
  groups.forEach(function (g) {
    // Show group if any child label is visible
    var parent = g.closest('.tag-group') || g.parentElement;
    if (parent) {
      var visibleLabels = parent.querySelectorAll('label:not([style*="display: none"])');
      if (g.classList.contains('tag-group-header') || g.hasAttribute('data-tag-group')) {
        g.style.display = visibleLabels.length > 0 ? '' : 'none';
      }
    }
  });
}

/** Add a tag by name from the search input */
function addSearchedTag(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('labels');
  if (!input) return;
  const tagName = input.value.trim();
  if (!tagName) return;

  // Add to current selection
  if (!window._currentTagSelection) window._currentTagSelection = [];
  if (!window._currentTagSelection.includes(tagName)) {
    window._currentTagSelection.push(tagName);
    if (typeof trackRecentTag === 'function') trackRecentTag(tagName);
  }
  input.value = '';

  // Re-render tags
  loadTags().then(tags => renderTags(tags, window._currentTagSelection));
  setSaveButtonUnsaved();
}

function navigateToSettings() {
  localStorage.setItem('cwoc_settings_return', window.location.href);
  if (window._cwocSave && window._cwocSave.hasChanges()) {
    if (confirm("You have unsaved changes. Leave without saving?")) {
      window.location.href = "/frontend/settings.html";
    }
  } else {
    window.location.href = "/frontend/settings.html";
  }
}

/**
 * Save the chit and stay on the editor page (don't navigate away).
 */
async function saveChitAndStay() {
  // If editing a single recurrence instance, save as exception
  if (window._editingInstance) {
    try {
      const chit = await buildChitObject();
      if (!chit) return;
      const exception = { date: window._editingInstance };
      if (chit.title) exception.title = chit.title;
      if (chit.start_datetime) exception.start_datetime = chit.start_datetime;
      if (chit.end_datetime) exception.end_datetime = chit.end_datetime;
      if (chit.due_datetime) exception.due_datetime = chit.due_datetime;
      if (chit.note) exception.note = chit.note;
      if (chit.location) exception.location = chit.location;
      const resp = await fetch(`/api/chits/${chit.id}/recurrence-exceptions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exception })
      });
      if (!resp.ok) throw new Error(await resp.text());
      setSaveButtonSaved();
      console.log("Saved instance exception & staying on editor.");
    } catch (error) {
      console.error("[saveChitAndStay] Instance error:", error);
      alert("Failed to save instance changes.");
    }
    return;
  }

  try {
    const chit = await buildChitObject();
    if (!chit) return; // validation failed inside buildChitObject

    const isNewChit = !(await chitExists(chit.id));
    const method = isNewChit ? "POST" : "PUT";
    const url = isNewChit ? "/api/chits" : `/api/chits/${chit.id}`;

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
    window.currentChitId = updatedChit.id;

    // Update URL so subsequent saves use PUT
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("id", updatedChit.id);
    window.history.replaceState({}, "", newUrl.toString());
    chitId = updatedChit.id;
    window.isNewChit = false;

    if (updatedChit.is_project_master && typeof saveProjectChanges === "function") {
      await saveProjectChanges();
    }

    setSaveButtonSaved();
    console.log("Saved & staying on editor.");
  } catch (error) {
    console.error("[saveChitAndStay] Error:", error);
    alert("Failed to save chit. Check console for details.");
  }
}

console.log("Editor script loaded successfully.");

// ── People Zone (tag-like grouped tree + chips) ─────────────────────────────
// Loads all contacts, groups by first letter of given_name, renders a scrollable
// tree with checkboxes. Active people shown as colored chips with thumbnails.

let _peopleDropdown = null;
let _peopleDebounceTimer = null;
let _peopleApiAvailable = true;
let _peopleChipData = []; // Array of {display_name, id, color, image_url}
let _allContactsCache = []; // Full contacts list for the tree
let _peopleGroupsExpanded = {}; // Track which letter groups are expanded

function _focusPeopleSearch() {
  var input = document.getElementById('peopleSearchInput');
  if (input) input.focus();
}

function _initPeopleAutocomplete() {
  _loadAllContactsForTree();

  const input = document.getElementById('peopleSearchInput');
  if (!input) return;

  input.addEventListener('input', function () {
    _filterPeopleTree(input.value.trim().toLowerCase());
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      _filterPeopleTree('');
      input.blur();
    }
  });
}

function _clearPeopleSearch(event) {
  if (event) event.stopPropagation();
  var input = document.getElementById('peopleSearchInput');
  if (input) { input.value = ''; _filterPeopleTree(''); }
}

async function _loadAllContactsForTree() {
  try {
    var resp = await fetch('/api/contacts');
    if (!resp.ok) return;
    _allContactsCache = await resp.json();
    _renderPeopleTree();
    // Re-render chips to pick up colors/images if chips were loaded before cache
    if (_peopleChipData.length > 0) {
      var contactMap = {};
      _allContactsCache.forEach(function (c) {
        contactMap[(c.display_name || '').toLowerCase()] = c;
      });
      _peopleChipData.forEach(function (chip) {
        var match = contactMap[(chip.display_name || '').toLowerCase()];
        if (match) {
          chip.color = match.color || chip.color;
          chip.image_url = match.image_url || chip.image_url;
          chip.id = match.id || chip.id;
        }
      });
      _renderPeopleChips();
    }
  } catch (e) {
    console.error('[People] Failed to load contacts for tree:', e);
  }
}

function _renderPeopleTree(filter) {
  var container = document.getElementById('peopleTreeContainer');
  if (!container) return;
  container.innerHTML = '';

  var contacts = _allContactsCache;
  if (filter) {
    contacts = contacts.filter(function (c) {
      return (c.display_name || '').toLowerCase().includes(filter);
    });
  }

  // Group by first letter of given_name
  var groups = {};
  contacts.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });

  var letters = Object.keys(groups).sort();
  // Sort each group: favorites first, then alphabetical
  letters.forEach(function (letter) {
    groups[letter].sort(function (a, b) {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (a.display_name || '').localeCompare(b.display_name || '');
    });
  });
  letters.forEach(function (letter) {
    var isExpanded = _peopleGroupsExpanded[letter] !== false; // default expanded

    var groupDiv = document.createElement('div');
    groupDiv.className = 'people-tree-group';
    groupDiv.dataset.letter = letter;

    var header = document.createElement('div');
    header.className = 'people-tree-group-header';
    header.style.cssText = 'cursor:pointer;font-weight:bold;font-size:0.85em;color:#6b4e31;padding:2px 0;user-select:none;display:flex;align-items:center;gap:4px;';
    header.innerHTML = '<span class="people-tree-arrow">' + (isExpanded ? '▼' : '▶') + '</span> ' + letter + ' <span style="opacity:0.5;font-weight:normal;">(' + groups[letter].length + ')</span>';
    header.addEventListener('click', function () {
      _peopleGroupsExpanded[letter] = !isExpanded;
      _renderPeopleTree(filter);
    });
    groupDiv.appendChild(header);

    if (isExpanded) {
      groups[letter].forEach(function (c) {
        var isActive = _peopleChipData.some(function (p) {
          return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase();
        });

        var chip = document.createElement('span');
        chip.className = 'people-chip' + (isActive ? ' people-chip-active' : '');
        chip.style.margin = '2px 0 2px 12px';
        if (c.color) {
          chip.style.backgroundColor = c.color;
          chip.style.color = _isLightColor(c.color) ? '#2b1e0f' : '#fff';
          chip.style.borderColor = c.color;
        }
        if (isActive) {
          chip.style.opacity = '0.5';
        }

        // Thumbnail on left edge
        var thumbEl = document.createElement('span');
        thumbEl.className = 'chip-thumb';
        if (c.image_url) {
          thumbEl.innerHTML = '<img src="' + c.image_url + '" />';
        } else {
          thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
        }
        chip.appendChild(thumbEl);

        var nameSpan = document.createElement('span');
        var starPrefix = c.favorite ? '★ ' : '';
        nameSpan.textContent = starPrefix + (c.display_name || c.given_name || '(unnamed)');
        chip.appendChild(nameSpan);

        chip.addEventListener('click', function () {
          if (isActive) {
            var idx = _peopleChipData.findIndex(function (p) { return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase(); });
            if (idx >= 0) _removePeopleChip(idx);
          } else {
            _addPeopleChip({ display_name: c.display_name, id: c.id, color: c.color || null, image_url: c.image_url || null });
          }
        });

        groupDiv.appendChild(chip);
      });
    }

    container.appendChild(groupDiv);
  });

  if (letters.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:8px;">No contacts found.</div>';
  }
}

function _filterPeopleTree(query) {
  _renderPeopleTree(query || undefined);
}

function _toggleAllPeopleGroups(event, expand) {
  if (event) event.stopPropagation();
  var letters = Object.keys(_peopleGroupsExpanded);
  // Also include all letters from current cache
  _allContactsCache.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!_peopleGroupsExpanded.hasOwnProperty(letter)) _peopleGroupsExpanded[letter] = true;
  });
  Object.keys(_peopleGroupsExpanded).forEach(function (k) {
    _peopleGroupsExpanded[k] = expand;
  });
  _renderPeopleTree();
}

function _addPeopleChip(data) {
  if (_peopleChipData.some(function (c) { return c.display_name.toLowerCase() === data.display_name.toLowerCase(); })) return;
  _peopleChipData.push(data);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  _renderPeopleTree(); // update checkboxes
  setSaveButtonUnsaved();
}

function _removePeopleChip(index) {
  _peopleChipData.splice(index, 1);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  _renderPeopleTree(); // update checkboxes
  setSaveButtonUnsaved();
}

function _renderPeopleChips() {
  var container = document.getElementById('peopleChips');
  if (!container) return;
  container.innerHTML = '';
  _peopleChipData.forEach(function (data, idx) {
    var chip = document.createElement('span');
    chip.className = 'people-chip';
    if (data.color) {
      chip.style.backgroundColor = data.color;
      chip.style.color = _isLightColor(data.color) ? '#2b1e0f' : '#fff';
      chip.style.borderColor = data.color;
    }

    // Thumbnail on left edge
    var thumbEl = document.createElement('span');
    thumbEl.className = 'chip-thumb';
    if (data.image_url) {
      thumbEl.innerHTML = '<img src="' + data.image_url + '" />';
    } else {
      thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
    }
    chip.appendChild(thumbEl);

    var nameSpan = document.createElement('span');
    nameSpan.textContent = data.display_name;
    chip.appendChild(nameSpan);

    // Double-click opens contact editor
    if (data.id) {
      chip.title = 'Double-click to edit contact';
      chip.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        window.open('/frontend/contact-editor.html?id=' + encodeURIComponent(data.id), '_blank');
      });
    }

    var removeX = document.createElement('span');
    removeX.className = 'chip-remove';
    removeX.textContent = '✕';
    removeX.title = 'Remove';
    removeX.addEventListener('click', function (e) {
      e.stopPropagation();
      _removePeopleChip(idx);
    });
    chip.appendChild(removeX);
    container.appendChild(chip);
  });
}

function _syncPeopleHiddenField() {
  var hidden = document.getElementById('people');
  if (hidden) {
    hidden.value = _peopleChipData.map(function (c) { return c.display_name; }).join(', ');
  }
}

function _updateActivePeopleCount() {
  var el = document.getElementById('activePeopleCount');
  if (el) el.textContent = _peopleChipData.length;
}

function _isLightColor(hex) {
  if (!hex) return true;
  hex = hex.replace('#', '');
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// Populate chips from a chit's people array (called from loadChitData)
function _setPeopleFromArray(peopleArray) {
  _peopleChipData = [];
  if (!peopleArray || !peopleArray.length) {
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
    return;
  }

  function _buildChips() {
    var contactMap = {};
    (_allContactsCache || []).forEach(function (c) {
      contactMap[(c.display_name || '').toLowerCase()] = c;
    });
    _peopleChipData = [];
    peopleArray.forEach(function (name) {
      var match = contactMap[name.toLowerCase()];
      _peopleChipData.push({
        display_name: name,
        id: match ? match.id : null,
        color: match ? (match.color || null) : null,
        image_url: match ? (match.image_url || null) : null
      });
    });
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
  }

  // If cache is empty, fetch first then build
  if (!_allContactsCache || _allContactsCache.length === 0) {
    fetch('/api/contacts').then(function (r) { return r.ok ? r.json() : []; }).then(function (contacts) {
      _allContactsCache = contacts;
      _buildChips();
    }).catch(function () { _buildChips(); });
  } else {
    _buildChips();
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', _initPeopleAutocomplete);
