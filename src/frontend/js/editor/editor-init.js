/**
 * editor-init.js — Editor initialization, zone management, and DOMContentLoaded
 *
 * Handles chit ID initialization, resetting the editor for new chits, collapsing
 * zones based on source view, loading chit data from the API, applying zone
 * expand/collapse states, Flatpickr initialization, and the main DOMContentLoaded
 * handler that wires up all event listeners.
 *
 * IMPORTANT: Functions called from HTML onclick handlers or other files are at
 * global scope — NOT inside DOMContentLoaded.
 *
 * Depends on: All other editor-*.js sub-scripts, shared.js, shared-page.js,
 *             shared-editor.js, editor_checklists.js, editor_projects.js
 * Loaded before: editor.js (coordinator)
 */

function _initializeChitId() {
  const params = new URLSearchParams(window.location.search);
  chitId = params.get("id");
  window._editingInstance = params.get("instance") || null;
  if (!chitId) {
    chitId = generateUniqueId();
    window.currentChitId = chitId;
    window.isNewChit = true;
  } else {
    window.currentChitId = chitId;
    window.isNewChit = false;
  }
}

function toggleZone(event, sectionId, contentId) {
  cwocToggleZone(event, sectionId, contentId);
}

function _toggleSection(contentId, button) {
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

function resetEditorForNewChit() {
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

  _setColor("transparent", "Transparent");

  window._currentTagSelection = [];
  window._loadedChildChits = [];
  _loadTags().then((tags) => _renderTags(tags, []));

  // Reset alerts
  window._alertsData = { alarms: [], timers: [], stopwatches: [], notifications: [] };
  renderAllAlerts();

  // Show weather placeholder for new chits
  const cws = document.getElementById("compactWeatherSection");
  if (cws) { cws.classList.add('weather-placeholder'); cws.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`; }

  // Auto-apply default saved location to new chits
  loadSavedLocations().then(function () {
    var defLoc = getDefaultLocation();
    if (defLoc && defLoc.address) {
      var locInput = document.getElementById("location");
      if (locInput && !locInput.value) {
        locInput.value = defLoc.address;
        if (typeof _fetchWeatherData === 'function') _fetchWeatherData(defLoc.address);
      }
    }
  });

  _collapseAllZonesForNewChit();
}

/**
 * For new chits: collapse all zones, then expand only the zone relevant
 * to the view the user came from (stored in cwoc_ui_state).
 */
function _collapseAllZonesForNewChit() {
  const allZones = [
    ['datesSection', 'datesContent'],
    ['taskSection', 'taskContent'],
    ['locationSection', 'locationContent'],
    ['tagsSection', 'tagsContent'],
    ['peopleSection', 'peopleContent'],
    ['notesSection', 'notesContent'],
    ['checklistSection', 'checklistContent'],
    ['alertsSection', 'alertsContent'],
    ['healthIndicatorsSection', 'healthIndicatorsContent'],
    ['colorSection', 'colorContent'],
    ['projectsSection', 'projectsContent'],
  ];

  allZones.forEach(([sectionId, contentId]) => {
    const section = document.getElementById(sectionId);
    const content = document.getElementById(contentId);
    if (!section || !content) return;
    content.style.display = 'none';
    section.classList.add('collapsed');
    const icon = section.querySelector('.zone-toggle-icon');
    if (icon) icon.textContent = '🔽';
    section.querySelectorAll('.zone-button').forEach(btn => { btn.style.display = 'none'; });
  });

  let sourceTab = 'Calendar';
  try {
    const saved = localStorage.getItem('cwoc_source_tab');
    if (saved) sourceTab = saved;
  } catch (e) { /* ignore */ }

  const tabZoneMap = {
    'Calendar':   [['datesSection', 'datesContent']],
    'Checklists': [['checklistSection', 'checklistContent']],
    'Alarms':     [['alertsSection', 'alertsContent']],
    'Projects':   [['projectsSection', 'projectsContent']],
    'Tasks':      [['taskSection', 'taskContent']],
    'Notes':      [['notesSection', 'notesContent']],
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get('start') || params.get('end')) {
    sourceTab = 'Calendar';
  }

  const zonesToExpand = tabZoneMap[sourceTab] || [['datesSection', 'datesContent']];
  zonesToExpand.forEach(([sectionId, contentId]) => {
    const section = document.getElementById(sectionId);
    const content = document.getElementById(contentId);
    if (!section || !content) return;
    content.style.display = '';
    section.classList.remove('collapsed');
    const icon = section.querySelector('.zone-toggle-icon');
    if (icon) icon.textContent = '🔼';
    section.querySelectorAll('.zone-button').forEach(btn => { btn.style.display = ''; });
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
    selectElement.value = "";
  }
}

function initializeFlatpickr(selector, options) {
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
}

async function loadChitData(chitId) {
  if (!chitId || window.isNewChit) {
    return;
  }

  try {
    const response = await fetch(`/api/chit/${chitId}`);
    if (!response.ok) {
      if (response.status === 404) {
        resetEditorForNewChit();
        return;
      }
      throw new Error("Failed to load chit data");
    }

    const chit = await response.json();

    const titleInput = document.getElementById("title");
    if (titleInput) {
      titleInput.value = chit.title || "";
    }

    const noteTextarea = document.getElementById("note");
    if (noteTextarea) {
      noteTextarea.value = chit.note || "";
      setTimeout(() => autoGrowNote(noteTextarea), 0);
      if (chit.note && chit.note.trim()) {
        setTimeout(() => toggleNotesViewMode(null), 50);
      }
    }

    // Load recurrence rule
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
        const auditContent = document.getElementById('auditLogContent');
        if (auditContent) auditContent.style.display = 'none';
        const auditToggle = auditSection.querySelector('.zone-toggle-icon');
        if (auditToggle) auditToggle.textContent = '🔽';
        if (typeof _renderSeriesSummary === 'function') {
          _renderSeriesSummary(auditContainer, chit, chit.id);
        }
      } else {
        auditSection.style.display = 'none';
      }
    }

    const prioritySelect = document.getElementById("priority");
    setSelectValue(prioritySelect, chit.priority);

    const severitySelect = document.getElementById("severity");
    setSelectValue(severitySelect, chit.severity);

    const statusSelect = document.getElementById("status");
    setSelectValue(statusSelect, chit.status);
    const dueCompleteCb = document.getElementById('dueComplete');
    if (dueCompleteCb) dueCompleteCb.checked = (chit.status === 'Complete');

    function splitISODateTime(isoString) {
      if (!isoString) return { date: "", time: "" };
      const dateObj = new Date(isoString);
      if (isNaN(dateObj.getTime())) return { date: "", time: "" };
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
    if (startDateInput) startDateInput.value = startParts.date;
    if (startTimeInput) startTimeInput.value = (chit.all_day || chit.allDay) ? "" : startParts.time;

    const endDateInput = document.getElementById("end_datetime");
    const endTimeInput = document.getElementById("end_time");
    const endParts = splitISODateTime(chit.end_datetime);
    if (endDateInput) endDateInput.value = endParts.date;
    if (endTimeInput) endTimeInput.value = (chit.all_day || chit.allDay) ? "" : endParts.time;

    const dueDateInput = document.getElementById("due_datetime");
    const dueTimeInput = document.getElementById("due_time");
    const dueParts = splitISODateTime(chit.due_datetime);
    if (dueDateInput) dueDateInput.value = dueParts.date;
    if (dueTimeInput) dueTimeInput.value = (chit.all_day || chit.allDay) ? "" : dueParts.time;

    // Set date mode radio based on chit data
    _dateModeSuppressUnsaved = true;
    const dateMode = _detectDateMode(chit);
    _setDateMode(dateMode);

    const allDayCheckbox = document.getElementById("allDay");
    if (allDayCheckbox) {
      allDayCheckbox.checked = !!(chit.all_day || chit.allDay);
      if (allDayCheckbox.checked) toggleAllDay();
    }
    _dateModeSuppressUnsaved = false;

    const _allDayCb = document.getElementById("allDay");
    if (_allDayCb && _allDayCb.checked) toggleAllDay();

    if (window.checklist) {
      if (Array.isArray(chit.checklist)) {
        window.checklist.loadItems(chit.checklist);
      } else {
        window.checklist.loadItems([]);
      }
    }

    _alertsFromChit(chit);
    _loadHealthData(chit);

    const locationInput = document.getElementById("location");
    if (locationInput) {
      locationInput.value = chit.location || "";
    }

    const peopleArray = Array.isArray(chit.people)
      ? chit.people
      : (chit.people ? chit.people.split(',').map(p => p.trim()).filter(Boolean) : []);
    if (typeof _setPeopleFromArray === 'function') {
      _setPeopleFromArray(peopleArray);
    }

    if (chit.color) {
      const allColors = [...defaultColors, ...(window.customColors || [])];
      const colorObj = allColors.find(
        (c) => c.hex.toLowerCase() === chit.color.toLowerCase(),
      );
      _setColor(chit.color, colorObj ? colorObj.name : "Custom");
    }

    const pinnedInput = document.getElementById("pinned");
    const pinnedButton = document.getElementById("pinnedButton");
    if (pinnedInput) {
      pinnedInput.value = chit.pinned ? "true" : "false";
      if (pinnedButton) {
        pinnedButton.querySelector("i")?.classList.toggle("fas", !!chit.pinned);
        pinnedButton.querySelector("i")?.classList.toggle("far", !chit.pinned);
      }
    }

    const archivedInput = document.getElementById("archived");
    const archivedButton = document.getElementById("archivedButton");
    if (archivedInput) {
      archivedInput.value = chit.archived ? "true" : "false";
      if (archivedButton) {
        archivedButton.textContent = chit.archived ? "📦 Archived" : "📦 Archive";
        archivedButton.classList.toggle("archived-active", !!chit.archived);
      }
    }

    _loadTags().then((tags) => {
      _renderTags(tags, chit.tags || []);
    });

    // Display stored weather_data immediately
    if (chit.weather_data) {
      try {
        const wd = typeof chit.weather_data === 'string' ? JSON.parse(chit.weather_data) : chit.weather_data;
        if (wd && wd.weather_code !== undefined) {
          const apiShaped = {
            daily: {
              weathercode: [wd.weather_code],
              temperature_2m_max: [wd.high],
              temperature_2m_min: [wd.low],
              precipitation_sum: [wd.precipitation]
            }
          };
          _displayWeatherInCompactSection(apiShaped, chit.location || '');
          window._currentChitWeatherData = wd;
        }
      } catch (e) { /* stored weather_data malformed, skip */ }
    }

    // Fetch weather for the chit's location
    const hasDate = !!(chit.start_datetime || chit.due_datetime);
    const compactWeatherSection = document.getElementById("compactWeatherSection");
    if (chit.location && hasDate) {
      _fetchWeatherData(chit.location).catch(() => {});
    } else if (compactWeatherSection) {
      compactWeatherSection.classList.add('weather-placeholder');
      if (chit.location && !hasDate) {
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📅 Add a date for weather</div>`;
      } else if (!chit.location && hasDate) {
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Add a location for weather</div>`;
      } else {
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:'Courier New',monospace;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`;
      }
    }

    window.currentChitId = chit.id || chitId;
    window._loadedChildChits = Array.isArray(chit.child_chits) ? chit.child_chits : [];

    applyZoneStates(chit);

    if (chit.is_project_master) {
      const pmInput = document.getElementById("isProjectMaster");
      if (pmInput) pmInput.value = "true";
      if (typeof initializeProjectZone === "function") {
        await initializeProjectZone(chit.id);
      }
    }

    markEditorSaved();
    setTimeout(() => markEditorSaved(), 200);
    setTimeout(() => markEditorSaved(), 500);

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
  const zones = [
    ["datesSection", "datesContent", () => !!(chit.start_datetime || chit.end_datetime || chit.due_datetime || chit.recurrence)],
    ["taskSection", "taskContent", () => !!(chit.priority || chit.severity || chit.status)],
    ["locationSection", "locationContent", () => !!(chit.location && chit.location.trim())],
    ["tagsSection", "tagsContent", () => Array.isArray(chit.tags) && chit.tags.length > 0],
    ["peopleSection", "peopleContent", () => Array.isArray(chit.people) ? chit.people.length > 0 : !!(chit.people && chit.people.trim())],
    ["notesSection", "notesContent", () => !!(chit.note && chit.note.trim())],
    ["checklistSection", "checklistContent", () => Array.isArray(chit.checklist) && chit.checklist.length > 0],
    ["alertsSection", "alertsContent", () => !!(chit.alarm || chit.notification || (Array.isArray(chit.alerts) && chit.alerts.length > 0))],
    ["healthIndicatorsSection", "healthIndicatorsContent", () => false],
    ["colorSection", "colorContent", () => !!(chit.color && chit.color !== "#C66B6B")],
    ["projectsSection", "projectsContent", () => !!(chit.is_project_master || (Array.isArray(chit.child_chits) && chit.child_chits.length > 0))],
  ];

  zones.forEach(([sectionId, contentId, hasData]) => {
    const section = document.getElementById(sectionId);
    const content = document.getElementById(contentId);
    if (!section || !content) return;

    const shouldExpand = hasData();

    if (shouldExpand) {
      content.style.display = '';
      section.classList.remove("collapsed");
      const icon = section.querySelector('.zone-toggle-icon');
      if (icon) icon.textContent = '🔼';
      section.querySelectorAll(".zone-button").forEach((btn) => { btn.style.display = ""; });
    } else {
      content.style.display = 'none';
      section.classList.add("collapsed");
      const icon = section.querySelector('.zone-toggle-icon');
      if (icon) icon.textContent = '🔽';
      section.querySelectorAll(".zone-button").forEach((btn) => { btn.style.display = "none"; });
    }
  });
}

// ── DOMContentLoaded — main editor initialization ────────────────────────────

document.addEventListener("DOMContentLoaded", function () {

  // Initialize mobile actions modal (replaces header buttons on mobile)
  if (typeof initMobileActionsModal === 'function') initMobileActionsModal();

  // Tag search filter-as-you-type
  var labelsInput = document.getElementById('labels');
  if (labelsInput) {
    labelsInput.addEventListener('input', function () {
      _filterTagTree(labelsInput.value.trim());
    });
    labelsInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSearchedTag();
      }
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

  _initializeChitId();

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

  // Load snap setting
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

  // Set default date mode to None for new chits
  _dateModeSuppressUnsaved = true;
  _setDateMode('none');
  _dateModeSuppressUnsaved = false;

  // Ensure recurrence UI is hidden on init
  const _repeatBlock = document.getElementById('repeatOptionsBlock');
  if (_repeatBlock) _repeatBlock.style.display = 'none';
  const _recIcon = document.getElementById('recurrenceIcon');
  if (_recIcon) _recIcon.style.display = 'none';

  // Load time format setting for alarm display
  _loadEditorTimeFormat();

  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Load custom colors from settings and render into the color picker
  _fetchCustomColors().then((colors) => {
    window.customColors = colors;
    _renderCustomColors(colors);
  });

  // Populate saved locations dropdown
  loadSavedLocationsDropdown();
  loadCompactLocationDropdown();

  initializeFlatpickr("#start_datetime", { dateFormat: "Y-M-d", onChange: function() { _updateRecurrenceLabels(); } });
  initializeFlatpickr("#end_datetime", { dateFormat: "Y-M-d" });
  initializeFlatpickr("#due_datetime", { dateFormat: "Y-M-d", onChange: function() { _updateRecurrenceLabels(); } });
  initializeFlatpickr("#recurrenceUntil", { dateFormat: "Y-M-d" });

  // Recurrence freq change shows/hides day checkboxes
  const recFreq = document.getElementById('recurrenceFreq');
  if (recFreq) recFreq.addEventListener('change', _updateByDayVisibility);

  // Attach listeners to default colors
  _attachColorSwatchListeners();

  // Initialize checklist
  const checklistContainer = document.getElementById("checklist-container");
  if (checklistContainer && window.Checklist) {
    window.checklist = new Checklist(checklistContainer, [], _onChecklistChange);
  }

  // Conditionally load chit data or reset for new chit
  if (chitId && !window.isNewChit) {
    loadChitData(chitId).then(() => {
      setTimeout(() => { window._cwocEditorLoading = false; }, 600);
    }).catch(() => {
      window._cwocEditorLoading = false;
    });
  } else {
    resetEditorForNewChit();

    // Pre-populate start/end from URL params
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

    // Apply default notifications for calendar-created chits
    if (preStart && window.isNewChit) {
      _applyDefaultNotifications('startend');
    }

    // Clear loading guard for new chits
    setTimeout(() => { window._cwocEditorLoading = false; }, 300);

    // Auto-focus title field for new chits
    const titleInput = document.getElementById('title');
    if (titleInput) setTimeout(() => titleInput.focus(), 350);
  }

  const allDayBtn = document.getElementById("allDayToggleButton");
  if (allDayBtn) allDayBtn.onclick = toggleAllDay;

  const notesExpandBtn = document.getElementById("open-notes-modal-button");
  if (notesExpandBtn) notesExpandBtn.onclick = openNotesModal;

  // Auto-switch note to render mode on blur
  const noteTextarea = document.getElementById("note");
  if (noteTextarea) {
    noteTextarea.addEventListener("blur", (e) => {
      const renderBtn = document.getElementById("notes-render-toggle-btn");
      if (e.relatedTarget && e.relatedTarget === renderBtn) return;
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

  // Initialize health data for new chits
  _loadHealthData({});

  setSaveButtonSaved();

  // Attach input change listeners to mark editor unsaved on any change
  window._cwocEditorLoading = true;
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("input", () => {
      if (!window._cwocEditorLoading) setSaveButtonUnsaved();
    });
  });

  // ESC key — layered escape chain
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const quickAlertOverlay = document.getElementById('cwoc-quick-alert-overlay');
      if (quickAlertOverlay) { _closeQuickAlertModal(); return; }

      const qrModal = document.getElementById('cwoc-qr-overlay');
      if (qrModal) { qrModal.remove(); return; }

      const deleteModal = document.getElementById('deleteChitModal');
      if (deleteModal && deleteModal.style.display === 'block') {
        deleteModal.style.display = 'none';
        return;
      }

      const alertModals = ['alarmModal', 'timerModal', 'stopwatchModal', 'notificationModal', 'alertModal'];
      for (const mid of alertModals) {
        const m = document.getElementById(mid);
        if (m && (m.style.display === 'flex' || m.style.display === 'block')) {
          m.style.display = 'none';
          return;
        }
      }

      const fpOpen = document.querySelector('.flatpickr-calendar.open');
      if (fpOpen) { fpOpen._flatpickr?.close(); return; }

      const notesModalEl = document.getElementById('notesModal');
      if (notesModalEl && notesModalEl.style.display === 'flex') {
        e.preventDefault();
        closeNotesModal(true);
        return;
      }

      const noteTA = document.getElementById('note');
      const noteRendered = document.getElementById('notes-rendered-output');
      if (noteTA && noteRendered &&
          noteTA.style.display !== 'none' &&
          noteRendered.style.display === 'none' &&
          noteTA.value.trim()) {
        e.preventDefault();
        toggleNotesViewMode();
        return;
      }

      const active = document.activeElement;
      if (active && active.tagName && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) {
        active.blur();
        return;
      }

      e.preventDefault();
      cancelOrExit();
    }

    // Ctrl+Shift+S: Save & Stay
    if (e.key === 's' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      saveChitAndStay();
    }
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
});
