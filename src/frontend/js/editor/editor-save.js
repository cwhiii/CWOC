/**
 * editor-save.js — Save system: build chit object, save, delete, pin, archive, QR
 *
 * Handles building the chit object from form fields, saving (create/update),
 * save-and-stay, delete with undo toast, pin/archive toggles, QR code display,
 * instance banner for recurrence editing, and save button state management.
 *
 * Depends on: shared.js (generateUniqueId, setSaveButtonUnsaved, setSaveButtonSaved,
 *             showQRModal, syncSend, cwocConfirm, _showDeleteUndoToast),
 *             editor-dates.js (_buildRecurrenceRule, convertMonthFormat, createISODateTimeString),
 *             editor-alerts.js (_alertsToArray, _gatherHealthData)
 * Loaded before: editor-init.js, editor.js
 */

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
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID ${elementId} not found`);
    return;
  }
  if (isValidMediaSource(src)) {
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
    chit.child_chits = projectState.projectChit.child_chits || [];
  } else {
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

  // Include weather_data in save payload
  chit.weather_data = window._currentChitWeatherData
    ? JSON.stringify(window._currentChitWeatherData)
    : null;

  // Include health_data in save payload (JSON string like weather_data)
  const healthObj = _gatherHealthData();
  chit.health_data = healthObj ? JSON.stringify(healthObj) : null;

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

  const form = document.querySelector('.editor-form') || document.querySelector('.editor-content') || document.body;
  form.insertBefore(banner, form.firstChild);
}

/**
 * Save changes as a recurrence exception for a single instance.
 */
async function _saveInstanceException(dateStr) {
  try {
    const chit = await buildChitObject();
    if (!chit) return;

    const exception = { date: dateStr };
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

    markEditorSaved();
    window.location.href = '/';
  } catch (error) {
    console.error('[_saveInstanceException] Error:', error);
    alert('Failed to save instance changes.');
  }
}

let _isSaving = false;

async function saveChitData() {
  if (_isSaving) return;
  _isSaving = true;

  if (window._editingInstance) {
    try { return await _saveInstanceException(window._editingInstance); }
    finally { _isSaving = false; }
  }

  try {
    const chit = await buildChitObject();
    if (!chit) return;

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

    if (
      updatedChit.is_project_master &&
      typeof saveProjectChanges === "function"
    ) {
      await saveProjectChanges();
    }

    window.currentChitId = updatedChit.id;
    markEditorSaved();
    if (typeof syncSend === 'function') syncSend('chits_changed', {});
    window.location.href = "/";
  } catch (error) {
    console.error("[saveChitData] Error saving chit:", error);
    alert("Failed to save chit. Check console for details.");
  } finally {
    _isSaving = false;
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
  saveChitData();
}

/**
 * Save the chit and stay on the editor page (don't navigate away).
 */
async function saveChitAndStay() {
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
    } catch (error) {
      console.error("[saveChitAndStay] Instance error:", error);
      alert("Failed to save instance changes.");
    }
    return;
  }

  try {
    const chit = await buildChitObject();
    if (!chit) return;

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

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("id", updatedChit.id);
    window.history.replaceState({}, "", newUrl.toString());
    chitId = updatedChit.id;
    window.isNewChit = false;

    if (updatedChit.is_project_master && typeof saveProjectChanges === "function") {
      await saveProjectChanges();
    }

    setSaveButtonSaved();
  } catch (error) {
    console.error("[saveChitAndStay] Error:", error);
    alert("Failed to save chit. Check console for details.");
  }
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
  var title = document.getElementById("title")?.value || "(Untitled)";
  var deletedId = chitId;
  fetch("/api/chits/" + deletedId, { method: "DELETE" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP error! status: " + response.status);
      return response.json();
    })
    .then(function () {
      _showDeleteUndoToast(deletedId, title, function () {
        window.location.href = "/";
      }, function () {
        fetch("/api/trash/" + deletedId + "/restore", { method: "POST" })
          .then(function () { window.location.reload(); })
          .catch(function (err) { console.error("Undo restore failed:", err); });
      });
    })
    .catch(function (err) {
      console.error("Error deleting chit:", err);
      alert("Failed to delete chit. Check console for details.");
    });
}

function setSaveButtonSaved() {
  if (window._cwocSave) window._cwocSave.markSaved();
}

function cancelOrExit() {
  if (window._cwocSave) {
    window._cwocSave.cancelOrExit();
  } else {
    window.location.href = "/";
  }
}

function markEditorUnsaved() {
  setSaveButtonUnsaved();
}

function markEditorSaved() {
  setSaveButtonSaved();
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
  var existing = document.getElementById('cwoc-qr-overlay');
  if (existing) { existing.remove(); return; }

  var isLink = e && e.shiftKey;

  function _showMode(mode) {
    var existing2 = document.getElementById('cwoc-qr-overlay');
    if (existing2) existing2.remove();

    if (mode === 'link') {
      var url = window.location.origin + '/frontend/html/editor.html?id=' + chitId;
      var overlay = showQRModal({ title: '🔗 Link QR Code', data: url, info: url });
      _addModeToggle(overlay, 'link');
    } else {
      var chitData = {
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
      var json = JSON.stringify(chitData);
      var overlay = showQRModal({
        title: '📦 Data QR Code',
        data: json,
        ecl: json.length > 500 ? 'L' : 'M',
        info: json.length + ' chars encoded',
      });
      _addModeToggle(overlay, 'data');
    }
  }

  function _addModeToggle(overlay, activeMode) {
    var modal = overlay.querySelector('div > div');
    if (!modal) return;
    var closeBtn = modal.querySelector('button');
    var toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;justify-content:center;';
    var btnStyle = 'padding:6px 12px;border:1px solid #6b4e31;border-radius:4px;cursor:pointer;font-family:inherit;font-size:0.85em;flex:1;';
    var dataBtn = document.createElement('button');
    dataBtn.style.cssText = btnStyle + (activeMode === 'data' ? 'background:#d4c5a9;font-weight:bold;' : 'background:#fdf5e6;');
    dataBtn.textContent = '📦 Data';
    dataBtn.addEventListener('click', function () { _showMode('data'); });
    var linkBtn = document.createElement('button');
    linkBtn.style.cssText = btnStyle + (activeMode === 'link' ? 'background:#d4c5a9;font-weight:bold;' : 'background:#fdf5e6;');
    linkBtn.textContent = '🔗 Link';
    linkBtn.addEventListener('click', function () { _showMode('link'); });
    toggleRow.appendChild(dataBtn);
    toggleRow.appendChild(linkBtn);
    if (closeBtn) modal.insertBefore(toggleRow, closeBtn);
    else modal.appendChild(toggleRow);
  }

  _showMode(isLink ? 'link' : 'data');

  if (!window._instanceId) {
    fetch('/api/instance-id').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
      window._instanceId = d.instance_id || 'unknown';
    }).catch(function () {});
  }
}
