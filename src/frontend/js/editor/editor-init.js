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

  // Reset habit state
  var habitCb = document.getElementById('habitEnabled');
  if (habitCb) habitCb.checked = false;
  var habitControlsRow = document.getElementById('habitControlsRow');
  if (habitControlsRow) habitControlsRow.style.display = 'none';
  var habitCalendarRow = document.getElementById('habitCalendarRow');
  if (habitCalendarRow) habitCalendarRow.style.display = 'none';
  var habitToggleBtn = document.getElementById('habitToggleBtn');
  if (habitToggleBtn) {
    habitToggleBtn.style.background = '';
    habitToggleBtn.style.color = '';
    habitToggleBtn.style.borderColor = '';
    habitToggleBtn.textContent = '🎯 Habit';
  }
  // Hide perpetual row
  var perpetualRow = document.getElementById('perpetualRow');
  if (perpetualRow) perpetualRow.style.display = 'none';
  // Reset All Day button state
  if (typeof _updateAllDayBtnState === 'function') _updateAllDayBtnState();
  // Reset recurrence icon
  var recIcon = document.getElementById('recurrenceIcon');
  if (recIcon) {
    recIcon.textContent = '🔁';
    recIcon.title = 'Recurring chit';
    recIcon.style.display = 'none';
  }
  window._currentHabitSuccess = 0;
  window._currentHabitLastActionDate = null;
  var habitGoalEl = document.getElementById('habitGoal');
  if (habitGoalEl) habitGoalEl.value = 1;
  var showOnCalCb = document.getElementById('showOnCalendar');
  if (showOnCalCb) showOnCalCb.checked = true;
  // Reset habit reset period
  var resetValEl = document.getElementById('habitResetValue');
  if (resetValEl) resetValEl.value = 1;
  var resetUnitEl = document.getElementById('habitResetUnit');
  if (resetUnitEl) resetUnitEl.value = '';
  var resetEnabledCb = document.getElementById('habitResetEnabled');
  if (resetEnabledCb) resetEnabledCb.checked = false;
  if (typeof onHabitResetToggle === 'function') onHabitResetToggle();
  // Reset habit hide overall (default: show = checked)
  var hideOverallCb = document.getElementById('habitHideOverall');
  if (hideOverallCb) hideOverallCb.checked = true;
  // Re-enable end date inputs
  var endDateInput = document.getElementById('end_datetime');
  if (endDateInput) { endDateInput.disabled = false; endDateInput.title = ''; endDateInput.style.opacity = ''; }
  var endTimeInput = document.getElementById('end_time');
  if (endTimeInput) { endTimeInput.disabled = false; endTimeInput.style.opacity = ''; }
  if (typeof _toggleHabitLogZone === 'function') _toggleHabitLogZone(false);

  // Show weather placeholder for new chits
  const cws = document.getElementById("compactWeatherSection");
  if (cws) { cws.classList.add('weather-placeholder'); cws.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`; }

  // Load saved locations for the dropdown (but do NOT auto-populate)
  loadSavedLocations();

  _collapseAllZonesForNewChit();

  // Initialize sharing controls in People zone for new chit
  if (typeof initPeopleSharingForNewChit === 'function') {
    initPeopleSharingForNewChit();
  }

  // Owner chip for new chit — show current user's chip (Requirement 5.6)
  _renderOwnerChipForCurrentUser();
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
    section.querySelectorAll('.zone-button:not(.zone-button-persist)').forEach(btn => { btn.style.display = 'none'; });
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
    section.querySelectorAll('.zone-button:not(.zone-button-persist)').forEach(btn => { btn.style.display = ''; });
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

// ── Owner Chip Rendering (Requirements 5.1–5.6) ─────────────────────────────

/**
 * Render the owner chip inside #cwoc-owner-chip-container for an existing chit.
 * Uses chit.owner_display_name for the label. Resolves the owner's profile image
 * from getCurrentUser() (if owner is current user) or from _allUsersCache.
 *
 * @param {Object} chit — the chit object with owner_id, owner_display_name
 */
function _renderOwnerChip(chit) {
  var container = document.getElementById('cwoc-owner-chip-container');
  if (!container) return;
  container.innerHTML = '';

  var displayName = chit.owner_display_name || '(Unknown)';
  var profileImageUrl = null;

  // Try to resolve the owner's profile image
  var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (currentUser && chit.owner_id && currentUser.user_id === chit.owner_id) {
    profileImageUrl = currentUser.profile_image_url || null;
  } else if (typeof _allUsersCache !== 'undefined' && Array.isArray(_allUsersCache)) {
    var ownerUser = _allUsersCache.find(function (u) {
      return (u.id || u.user_id) === chit.owner_id;
    });
    if (ownerUser) {
      profileImageUrl = ownerUser.profile_image_url || null;
    }
  }

  container.appendChild(_buildOwnerChipElement(displayName, profileImageUrl));
}

/**
 * Render the owner chip for a new chit — shows the current user's own chip.
 */
function _renderOwnerChipForCurrentUser() {
  var container = document.getElementById('cwoc-owner-chip-container');
  if (!container) return;
  container.innerHTML = '';

  var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var displayName = (currentUser && currentUser.display_name) ? currentUser.display_name : '(Unknown)';
  var profileImageUrl = (currentUser && currentUser.profile_image_url) ? currentUser.profile_image_url : null;

  container.appendChild(_buildOwnerChipElement(displayName, profileImageUrl));
}

/**
 * Build an owner chip DOM element matching the people chip visual style.
 *
 * @param {string} displayName — the owner's display name
 * @param {string|null} profileImageUrl — the owner's profile image URL, or null
 * @returns {HTMLElement} the chip span element
 */
function _buildOwnerChipElement(displayName, profileImageUrl) {
  var chip = document.createElement('span');
  chip.className = 'people-chip cwoc-owner-chip';

  var thumbEl = document.createElement('span');
  thumbEl.className = 'chip-thumb';
  if (profileImageUrl) {
    var img = document.createElement('img');
    img.src = profileImageUrl;
    img.alt = displayName;
    thumbEl.appendChild(img);
  } else {
    var placeholder = document.createElement('span');
    placeholder.className = 'chip-thumb-placeholder';
    placeholder.textContent = '?';
    thumbEl.appendChild(placeholder);
  }
  chip.appendChild(thumbEl);

  var nameSpan = document.createElement('span');
  nameSpan.textContent = displayName;
  chip.appendChild(nameSpan);

  return chip;
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

    // Owner chip in title zone (Requirement 5.1–5.6)
    _renderOwnerChip(chit);

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
      if (icon) {
        icon.style.display = '';
        // Show habit icon instead of repeat icon for habit chits
        if (chit.habit) {
          icon.textContent = '🎯';
          icon.title = 'Habit';
        } else {
          icon.textContent = '🔁';
          icon.title = 'Recurring chit';
        }
      }
    }
    window._loadedRecurrenceExceptions = chit.recurrence_exceptions || null;

    // Load habit fields
    var habitCb = document.getElementById('habitEnabled');
    if (habitCb) {
      habitCb.checked = !!chit.habit;
    }
    window._currentHabitSuccess = chit.habit_success || 0;
    var habitGoalEl = document.getElementById('habitGoal');
    if (habitGoalEl) {
      habitGoalEl.value = chit.habit_goal || 1;
    }
    var showOnCalCb = document.getElementById('showOnCalendar');
    if (showOnCalCb) {
      showOnCalCb.checked = chit.show_on_calendar !== false;
    }

    // Load habit reset period — format "N:UNIT" (e.g., "3:DAILY")
    var resetValEl = document.getElementById('habitResetValue');
    var resetUnitEl = document.getElementById('habitResetUnit');
    var resetEnabledCb = document.getElementById('habitResetEnabled');
    if (chit.habit_reset_period && chit.habit_reset_period.indexOf(':') !== -1) {
      var parts = chit.habit_reset_period.split(':');
      if (resetValEl) resetValEl.value = parseInt(parts[0]) || 1;
      if (resetUnitEl) resetUnitEl.value = parts[1] || '';
      if (resetEnabledCb) resetEnabledCb.checked = true;
    } else if (chit.habit_reset_period) {
      // Legacy format: just "DAILY"/"WEEKLY"/"MONTHLY"
      if (resetValEl) resetValEl.value = 1;
      if (resetUnitEl) resetUnitEl.value = chit.habit_reset_period;
      if (resetEnabledCb) resetEnabledCb.checked = true;
    } else {
      if (resetValEl) resetValEl.value = 1;
      if (resetUnitEl) resetUnitEl.value = '';
      if (resetEnabledCb) resetEnabledCb.checked = false;
    }
    // Apply reset toggle visibility
    if (typeof onHabitResetToggle === 'function') onHabitResetToggle();
    window._currentHabitLastActionDate = chit.habit_last_action_date || null;

    // Load habit hide overall (reversed: hide=true means unchecked for "Show")
    var hideOverallCb = document.getElementById('habitHideOverall');
    if (hideOverallCb) {
      hideOverallCb.checked = !chit.habit_hide_overall;
    }

    // Load perpetual — now a radio option in dateMode
    // If chit.perpetual is true, override the date mode to 'perpetual'
    // (this happens BEFORE _setDateMode below, so we store it and apply after)
    window._chitIsPerpetual = !!chit.perpetual;

    // Sync habit frequency dropdown from the chit's recurrence rule
    var habitFreqSel = document.getElementById('habitFrequency');
    if (habitFreqSel && chit.recurrence_rule && chit.recurrence_rule.freq) {
      var freq = chit.recurrence_rule.freq;
      if (['DAILY','WEEKLY','MONTHLY','YEARLY'].indexOf(freq) !== -1) {
        habitFreqSel.value = freq;
      }
    }
    // Apply habit toggle state (reveal/hide controls, hide repeat row)
    // onHabitToggle() toggles the hidden checkbox, so set it to the opposite first
    // NOTE: This must run AFTER _setDateMode and allDay setup (which happen later in loadChitData)
    // so we defer it with a flag and call it at the end of date setup.

    // Evaluate period rollover for habit chits (lazy rollover — Task 5.3)
    if (chit.habit && typeof _evaluateHabitRollover === 'function') {
      var rolledOver = _evaluateHabitRollover(chit);
      if (rolledOver) {
        // Update the UI fields to reflect the reset
        window._currentHabitSuccess = chit.habit_success || 0;
        if (habitGoalEl) {
          habitGoalEl.value = chit.habit_goal || 1;
        }
        // Persist the updated chit in the background (Task 5.4)
        if (typeof _persistHabitRollover === 'function') {
          _persistHabitRollover(chit);
        }
      }
    }

    if (typeof _updateHabitProgressDisplay === 'function') {
      _updateHabitProgressDisplay();
    }

    // Load Habit Log zone (period history + charts) for habit chits
    if (chit.habit && typeof _loadHabitLog === 'function') {
      _loadHabitLog(chit);
      // Expand the Habit Log zone if it has data
      var habitLogSection = document.getElementById('habitLogSection');
      var habitLogContent = document.getElementById('habitLogContent');
      var exceptions = chit.recurrence_exceptions || [];
      if (habitLogSection && habitLogContent && exceptions.length > 0) {
        habitLogContent.style.display = '';
        habitLogSection.classList.remove('collapsed');
        var hlIcon = habitLogSection.querySelector('.zone-toggle-icon');
        if (hlIcon) hlIcon.textContent = '🔼';
      }
    }

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
    var dateMode = window._chitIsPerpetual ? 'perpetual' : _detectDateMode(chit);
    _setDateMode(dateMode);

    const allDayCheckbox = document.getElementById("allDay");
    if (allDayCheckbox) {
      allDayCheckbox.checked = !!(chit.all_day || chit.allDay);
      if (allDayCheckbox.checked) toggleAllDay();
    }
    _dateModeSuppressUnsaved = false;

    const _allDayCb = document.getElementById("allDay");
    if (_allDayCb && _allDayCb.checked) toggleAllDay();

    // Sync All Day button appearance from checkbox state
    if (typeof _updateAllDayBtnState === 'function') _updateAllDayBtnState();

    // Now apply habit toggle (must be after _setDateMode and allDay setup)
    if (chit.habit) {
      var _hCb = document.getElementById('habitEnabled');
      if (_hCb) {
        _hCb.checked = false; // onHabitToggle will flip to true
        onHabitToggle();
      }
    }

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
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📅 Add a date for weather</div>`;
      } else if (!chit.location && hasDate) {
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Add a location for weather</div>`;
      } else {
        compactWeatherSection.innerHTML = `<div style="padding:8px;font-family:Lora, Georgia, serif;color:#8b5a2b;font-size:0.85em;opacity:0.7;">📍 Date &amp; location needed for weather</div>`;
      }
    }

    window.currentChitId = chit.id || chitId;
    window._loadedChildChits = Array.isArray(chit.child_chits) ? chit.child_chits : [];

    applyZoneStates(chit);

    // Initialize sharing controls in the merged People zone
    if (typeof initPeopleSharingControls === 'function') {
      await initPeopleSharingControls(chit);
    }

    // Read-only mode for viewer-role chits (Requirement 4.3)
    if (chit.effective_role === 'viewer') {
      _applyViewerReadOnlyMode(chit);
    }

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
 * Apply read-only mode when the current user has viewer role on a shared chit.
 * Disables all form fields, hides save/delete buttons, hides sharing zone,
 * and shows a read-only banner at the top of the editor.
 *
 * @param {Object} chit — the chit object with effective_role and owner_display_name
 * Requirements: 4.3
 */
function _applyViewerReadOnlyMode(chit) {
  // Add read-only banner at the top of the editor
  var editor = document.getElementById('mainEditor');
  if (editor) {
    var banner = document.createElement('div');
    banner.id = 'cwoc-readonly-banner';
    banner.className = 'cwoc-readonly-banner';
    var ownerName = chit.owner_display_name || 'another user';
    banner.textContent = 'Read-only — shared by ' + ownerName;
    editor.insertBefore(banner, editor.firstChild);
  }

  // Disable all form inputs, selects, textareas, and buttons inside the editor
  var mainEditor = document.querySelector('.editor');
  if (mainEditor) {
    mainEditor.querySelectorAll('input, select, textarea').forEach(function (el) {
      el.disabled = true;
    });
    // Disable contenteditable divs
    mainEditor.querySelectorAll('[contenteditable="true"]').forEach(function (el) {
      el.setAttribute('contenteditable', 'false');
    });
  }

  // Hide save buttons (Save, Save & Stay, Save & Exit)
  var saveBtn = document.getElementById('saveButton');
  var saveStayBtn = document.getElementById('saveStayButton');
  var saveExitBtn = document.getElementById('saveExitButton');
  if (saveBtn) saveBtn.style.display = 'none';
  if (saveStayBtn) saveStayBtn.style.display = 'none';
  if (saveExitBtn) saveExitBtn.style.display = 'none';

  // Hide delete button
  var deleteBtn = document.getElementById('deleteButton');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // Hide archive button (viewers can't change archive state)
  var archiveBtn = document.getElementById('archivedButton');
  if (archiveBtn) archiveBtn.style.display = 'none';
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
    ["peopleSection", "peopleContent", () => (Array.isArray(chit.people) ? chit.people.length > 0 : !!(chit.people && chit.people.trim())) || (typeof hasSharingData === 'function' && hasSharingData(chit))],
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
      section.querySelectorAll(".zone-button:not(.zone-button-persist)").forEach((btn) => { btn.style.display = ""; });
    } else {
      content.style.display = 'none';
      section.classList.add("collapsed");
      const icon = section.querySelector('.zone-toggle-icon');
      if (icon) icon.textContent = '🔽';
      section.querySelectorAll(".zone-button:not(.zone-button-persist)").forEach((btn) => { btn.style.display = "none"; });
    }
  });

  // Habit-specific zone overrides: expand Dates + Habit Log, collapse Task
  if (chit.habit) {
    var datesSection = document.getElementById('datesSection');
    var datesContent = document.getElementById('datesContent');
    if (datesSection && datesContent) {
      datesContent.style.display = '';
      datesSection.classList.remove('collapsed');
      var dIcon = datesSection.querySelector('.zone-toggle-icon');
      if (dIcon) dIcon.textContent = '🔼';
    }
    var taskSection = document.getElementById('taskSection');
    var taskContent = document.getElementById('taskContent');
    if (taskSection && taskContent) {
      taskContent.style.display = 'none';
      taskSection.classList.add('collapsed');
      var tIcon = taskSection.querySelector('.zone-toggle-icon');
      if (tIcon) tIcon.textContent = '🔽';
    }
  }
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
  // Detect if we came from the kiosk (or another page) via the 'from' query param
  var _editorReturnUrl = '/';
  try {
    var _editorParams = new URLSearchParams(window.location.search);
    var _fromParam = _editorParams.get('from');
    if (_fromParam) {
      _editorReturnUrl = _fromParam;
      // Update logo link title to reflect the return destination
      var _logoLink = document.getElementById('editor-logo-link');
      if (_logoLink && _fromParam.indexOf('/kiosk') === 0) {
        _logoLink.title = 'Back to Kiosk';
      }
    }
  } catch (e) { /* fallback to '/' */ }

  window._cwocSave = new CwocSaveSystem({
    singleBtnId: 'saveButton',
    stayBtnId: 'saveStayButton',
    exitBtnId: 'saveExitButton',
    cancelSelector: '.cancel',
    getReturnUrl: () => _editorReturnUrl,
  });

  _initializeChitId();

  // Populate "Add to Project" custom dropdown with actual project master chits
  fetch('/api/chits').then(r => r.ok ? r.json() : []).then(allChits => {
    const wrapper = document.getElementById('moveToProjectWrapper');
    const triggerBtn = document.getElementById('moveToProjectBtn');
    const menu = document.getElementById('moveToProjectMenu');
    const label = document.getElementById('moveToProjectLabel');
    const removeBtn = document.getElementById('removeFromProjectBtn');
    if (!wrapper || !triggerBtn || !menu) return;

    const masters = allChits.filter(c => c.is_project_master && c.id !== chitId);

    // Track currently selected project ID
    let _selectedProjectId = '';

    // Build menu items
    if (masters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'project-dropdown-empty';
      empty.textContent = 'No projects available';
      menu.appendChild(empty);
    } else {
      masters.forEach(c => {
        const item = document.createElement('div');
        item.className = 'project-dropdown-item';
        item.dataset.projectId = c.id;
        item.textContent = c.title || '(Untitled Project)';
        item.addEventListener('click', () => _selectProject(c.id, c.title || '(Untitled)'));
        menu.appendChild(item);
      });
    }

    // Check if this chit already belongs to a project
    const parentProject = masters.find(c =>
      Array.isArray(c.child_chits) && c.child_chits.includes(chitId)
    );

    // Show dropdown for non-master chits when projects exist
    const isMaster = document.getElementById('isProjectMaster');
    if (masters.length > 0 && (!isMaster || isMaster.value !== 'true')) {
      wrapper.style.display = '';
      if (parentProject) {
        _selectedProjectId = parentProject.id;
        label.textContent = parentProject.title || '(Untitled Project)';
        _highlightSelected();
        if (removeBtn) removeBtn.style.display = '';
      }
    }

    // Move menu to body so it's not clipped by zone-container overflow:hidden
    document.body.appendChild(menu);

    function _positionMenu() {
      const rect = triggerBtn.getBoundingClientRect();
      menu.style.top = (rect.bottom + window.scrollY) + 'px';
      menu.style.left = '';
      menu.style.right = '';
      // Align right edge of menu with right edge of button
      const menuWidth = menu.offsetWidth || 200;
      let leftPos = rect.right + window.scrollX - menuWidth;
      if (leftPos < 4) leftPos = 4;
      menu.style.left = leftPos + 'px';
    }

    // Toggle menu open/close
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      if (isOpen) _positionMenu();
    });

    // Close menu on outside click
    document.addEventListener('click', () => {
      menu.classList.remove('open');
    });
    menu.addEventListener('click', (e) => e.stopPropagation());

    // Reposition on scroll/resize while open
    window.addEventListener('scroll', () => { if (menu.classList.contains('open')) _positionMenu(); }, true);
    window.addEventListener('resize', () => { if (menu.classList.contains('open')) _positionMenu(); });

    function _highlightSelected() {
      menu.querySelectorAll('.project-dropdown-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.projectId === _selectedProjectId);
      });
    }

    // Handle selection — add current chit to chosen project
    async function _selectProject(targetId, targetTitle) {
      menu.classList.remove('open');
      if (!targetId || !chitId) {
        if (removeBtn) removeBtn.style.display = 'none';
        return;
      }
      try {
        const projRes = await fetch('/api/chit/' + encodeURIComponent(targetId));
        if (!projRes.ok) throw new Error('Failed to load target project');
        const proj = await projRes.json();
        const children = Array.isArray(proj.child_chits) ? proj.child_chits : [];
        if (!children.includes(chitId)) children.push(chitId);
        proj.child_chits = children;
        const saveRes = await fetch('/api/chits/' + encodeURIComponent(targetId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proj),
        });
        if (!saveRes.ok) throw new Error('Failed to save project');
        _selectedProjectId = targetId;
        label.textContent = targetTitle;
        _highlightSelected();
        if (removeBtn) removeBtn.style.display = '';
        cwocToast('Added to project: ' + targetTitle, 'success');
      } catch (e) {
        console.error('Error adding chit to project:', e);
        cwocToast('Failed to add to project.', 'error');
      }
    }

    // Handle remove — pull this chit out of its parent project
    if (removeBtn) {
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!_selectedProjectId || !chitId) return;
        const parentMaster = masters.find(c => c.id === _selectedProjectId);
        const parentTitle = parentMaster ? (parentMaster.title || '(Untitled)') : 'this project';
        if (typeof cwocConfirm === 'function') {
          const ok = await cwocConfirm('Remove this chit from "' + parentTitle + '"?', {
            title: 'Remove from Project', confirmLabel: '✕ Remove', danger: true
          });
          if (!ok) return;
        }
        try {
          const projRes = await fetch('/api/chit/' + encodeURIComponent(_selectedProjectId));
          if (!projRes.ok) throw new Error('Failed to load project');
          const proj = await projRes.json();
          proj.child_chits = (Array.isArray(proj.child_chits) ? proj.child_chits : [])
            .filter(id => id !== chitId);
          const saveRes = await fetch('/api/chits/' + encodeURIComponent(_selectedProjectId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proj),
          });
          if (!saveRes.ok) throw new Error('Failed to save project');
          _selectedProjectId = '';
          label.textContent = 'Add to Project…';
          _highlightSelected();
          removeBtn.style.display = 'none';
          cwocToast('Removed from project.', 'info');
        } catch (e) {
          console.error('Error removing chit from project:', e);
          cwocToast('Failed to remove from project.', 'error');
        }
      });
    }
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

    // Auto-enable habit mode if coming from Tasks tab in Habits view mode
    try {
      var _srcTab = localStorage.getItem('cwoc_source_tab');
      var _srcMode = localStorage.getItem('cwoc_source_tasks_mode');
      if (_srcTab === 'Tasks' && _srcMode === 'habits') {
        var _hCb = document.getElementById('habitEnabled');
        if (_hCb && !_hCb.checked) {
          onHabitToggle(); // toggles to true, expands everything
        }
      }
    } catch (e) { /* ignore */ }

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
      // Calculator popover — close before any other ESC action
      if (typeof cwocIsCalculatorOpen === 'function' && cwocIsCalculatorOpen()) {
        cwocCloseCalculator();
        return;
      }

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

      const peopleExpandModalEl = document.getElementById('peopleExpandModal');
      if (peopleExpandModalEl && peopleExpandModalEl.style.display === 'flex') {
        e.preventDefault();
        closePeopleExpandModal();
        return;
      }

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

  // Fetch version for footer copyright tooltip
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : {}; }).then(function(d) {
    var el = document.getElementById('cwoc-footer-copyright');
    if (el && d.version) el.title = 'Version ' + d.version;
  }).catch(function() {});
});
