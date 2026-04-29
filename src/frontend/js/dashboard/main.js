/**
 * main.js — Dashboard coordinator (shared state only).
 *
 * This file declares all shared state variables that multiple dashboard sub-scripts
 * reference. It loads LAST, after all sub-scripts, so that any late-binding
 * initialization can reference functions defined in the sub-scripts.
 *
 * Sub-script load order (defined in index.html):
 *   1. main-sidebar.js   — Sidebar rendering, filter panels, toggle logic
 *   2. main-hotkeys.js   — Hotkey mode state machine, overlay panels
 *   3. main-calendar.js  — Calendar period views, date navigation helpers
 *   4. main-views.js     — List-based views (Checklists, Tasks, Notes, Projects, Alarms, Indicators)
 *   5. main-alerts.js    — Global alert system (alarms, notifications, timers)
 *   6. main-search.js    — Global search overlay
 *   7. main-modals.js    — Clock, weather, and quick-edit modals
 *   8. main-init.js      — DOMContentLoaded handler, displayChits orchestrator, keyboard dispatcher
 *   9. main.js           — This file (shared state coordinator)
 *
 * All functions are in global scope — no ES modules.
 */

/* ── Core tab/view state ─────────────────────────────────────────────────── */
let currentTab = "Calendar";
let chits = [];
let currentWeekStart = null;
let currentView = "Week";
let previousState = { tab: "Calendar", view: "Week" };

/* ── Responsive week view paging state ───────────────────────────────────── */
let _weekViewDayOffset = 0;

/* ── Sort & filter state ─────────────────────────────────────────────────── */
let currentSortField = null;
let currentSortDir = 'asc';

/* ── Hotkey submenu state ────────────────────────────────────────────────── */
let _hotkeyMode = null;

/* ── Global tag objects cache for color lookups ──────────────────────────── */
let _cachedTagObjects = [];

/* ── Chit display options (loaded from settings) ─────────────────────────── */
let _chitOptions = { fade_past_chits: true, highlight_overdue_chits: true, delete_past_alarm_chits: false, show_tab_counts: false };

/* ── Snooze registry: { chitId-alertIdx: expiresAtMs } ───────────────────── */
let _snoozeRegistry = {};

/* ── Default search filters per tab (loaded from settings) ───────────────── */
let _defaultFilters = {};

/* ── Global Search state ─────────────────────────────────────────────────── */
let _globalSearchResults = [];
let _globalSearchQuery = '';

/* ── Global week start day (0=Sun, 1=Mon, etc.) ─────────────────────────── */
let _weekStartDay = 0;

/* ── Timezone offset (for debug logging) ─────────────────────────────────── */
const userTimezoneOffset = new Date().getTimezoneOffset();
console.debug("User timezone offset: " + userTimezoneOffset + " minutes");

/* ── Legacy editor form population (kept for backward compat) ────────────── */
const chitId = new URLSearchParams(window.location.search).get("id");
if (chitId) {
  fetch("/api/chits/" + chitId)
    .then(function(response) { return response.json(); })
    .then(function(chit) {
      var el;
      el = document.getElementById("pinned"); if (el) el.checked = chit.pinned || false;
      el = document.getElementById("title"); if (el) el.value = chit.title || "";
      el = document.getElementById("note"); if (el) el.value = chit.note || "";
      el = document.getElementById("labels"); if (el) el.value = (chit.labels || []).join(", ");
      el = document.getElementById("all_day"); if (el) el.checked = chit.all_day || false;

      if (chit.start_datetime) {
        el = document.getElementById("start_datetime"); if (el) el.value = _convertDBDateToDisplayDate(chit.start_datetime);
        if (!chit.all_day) { el = document.getElementById("start_time"); if (el) el.value = _parseISOTime(chit.start_datetime); }
      }
      if (chit.end_datetime) {
        el = document.getElementById("end_datetime"); if (el) el.value = _convertDBDateToDisplayDate(chit.end_datetime);
        if (!chit.all_day) { el = document.getElementById("end_time"); if (el) el.value = _parseISOTime(chit.end_datetime); }
      }
      if (chit.due_datetime) {
        el = document.getElementById("due_datetime"); if (el) el.value = _convertDBDateToDisplayDate(chit.due_datetime);
        el = document.getElementById("due_time"); if (el) el.value = _parseISOTime(chit.due_datetime);
      }

      if (typeof toggleAllDay === 'function') toggleAllDay();

      el = document.getElementById("status"); if (el) el.value = chit.status || "";
      el = document.getElementById("priority"); if (el) el.value = chit.priority || "Medium";
      el = document.getElementById("checklist"); if (el) el.value = chit.checklist ? JSON.stringify(chit.checklist) : "";
      el = document.getElementById("alarm"); if (el) el.checked = chit.alarm || false;
      el = document.getElementById("notification"); if (el) el.checked = chit.notification || false;
      el = document.getElementById("recurrence"); if (el) el.value = chit.recurrence || "";
      el = document.getElementById("location"); if (el) el.value = chit.location || "";
      el = document.getElementById("color"); if (el) el.value = chitColor(chit);
      el = document.getElementById("people"); if (el) el.value = (chit.people || []).join(", ");
      el = document.getElementById("archived"); if (el) el.checked = chit.archived || false;
    })
    .catch(function(err) {
      console.error("Error loading chit:", err);
    });
}
