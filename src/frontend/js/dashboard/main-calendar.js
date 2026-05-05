/**
 * main-calendar.js — All calendar period views and date navigation helpers.
 *
 * Contains:
 *   - Calendar views: Week, Day, SevenDay, Work, Month, Itinerary, Year
 *   - Date navigation: getWeekStart, getMonthStart, getYearStart, previousPeriod, nextPeriod, etc.
 *   - Time bar rendering (renderTimeBar, scrollToSixAM)
 *   - All-day event height cap (_addAllDayHeightCap)
 *   - Calendar event interaction (attachCalendarChitEvents, attachEmptySlotCreate, openChitForEdit)
 *   - Weather nav intent (_checkWeatherNavIntent, _executeWeatherFlash)
 *
 * Depends on globals from main.js: currentTab, chits, currentWeekStart, currentView,
 *   currentSortField, currentSortDir, _weekViewDayOffset, previousState
 * Depends on shared.js: formatTime, applyChitColors, contrastColorForBg, getCalendarDateInfo,
 *   chitMatchesDay, calendarEventTitle, calendarEventTooltip, enableCalendarDrag, enableMonthDrag,
 *   enableAllDayDrag, renderAllDayEventsInCells, enableCalendarPinchZoom, expandRecurrence,
 *   _loadCalSnapSetting, showQuickEditModal
 */

/* ── Calendar settings (loaded from settings API) ────────────────────────── */
let _workStartHour = 8;
let _workEndHour = 17;
let _workDays = [1, 2, 3, 4, 5];
let _enabledPeriods = ['Itinerary', 'Day', 'Week', 'Work', 'SevenDay', 'Month', 'Year'];
let _customDaysCount = 7;
let _allViewStartHour = 0;
let _allViewEndHour = 24;
let _dayScrollToHour = 5;
let _timeBarInterval = null;

/* ── Weather nav intent state ────────────────────────────────────────────── */
var _wxNavPending = null;

/* ── Date helpers ────────────────────────────────────────────────────────── */

function getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = (day - _weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date) {
  var d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getYearStart(date) {
  var d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dashboard-specific formatDate — includes day-of-week for calendar headers. */
function formatDate(date) {
  var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return dayNames[date.getDay()] + ' ' + date.getDate();
}

function formatWeekRange(start, end) {
  var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var startStr = monthNames[start.getMonth()] + ' ' + formatDate(start);
  var endStr = monthNames[end.getMonth()] + ' ' + formatDate(end);
  return '<span>' + startStr + '</span><span>' + endStr + '</span>';
}

/** Returns the display color for a chit. Transparent/null → pale cream. */
function chitColor(chit) {
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
}

/* ── Period navigation ───────────────────────────────────────────────────── */

function changePeriod() {
  var sel = document.getElementById('period-select');
  if (!sel) return;
  _weekViewDayOffset = 0;
  currentView = sel.value;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function goToToday() {
  var now = new Date();
  _weekViewDayOffset = 0;
  if (currentView === 'Week') currentWeekStart = getWeekStart(now);
  else if (currentView === 'Month') currentWeekStart = getMonthStart(now);
  else if (currentView === 'Year') currentWeekStart = getYearStart(now);
  else currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  updateDateRange();
  displayChits();
}

function previousPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
  _weekViewDayOffset = 0;
  if (currentView === "Day") {
    currentWeekStart.setDate(currentWeekStart.getDate() - 1);
  } else if (currentView === "Week") {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  } else if (currentView === "Month") {
    currentWeekStart.setMonth(currentWeekStart.getMonth() - 1);
  } else if (currentView === "Year") {
    currentWeekStart.setFullYear(currentWeekStart.getFullYear() - 1);
  }
  updateDateRange();
  displayChits();
}

function nextPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
  _weekViewDayOffset = 0;
  if (currentView === "Day") {
    currentWeekStart.setDate(currentWeekStart.getDate() + 1);
  } else if (currentView === "Week") {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  } else if (currentView === "Month") {
    currentWeekStart.setMonth(currentWeekStart.getMonth() + 1);
  } else if (currentView === "Year") {
    currentWeekStart.setFullYear(currentWeekStart.getFullYear() + 1);
  }
  updateDateRange();
  displayChits();
}

function updateDateRange() {
  var rangeElement = document.getElementById("week-range");
  var yearElement = document.getElementById("year-display");
  if (!rangeElement || !yearElement) {
    console.error("Week range or year display element not found");
    return;
  }
  if (!currentWeekStart) {
    currentWeekStart = getWeekStart(new Date());
  }
  var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  if (currentView === "Day") {
    yearElement.textContent = currentWeekStart.getFullYear() + ' · ' + monthNames[currentWeekStart.getMonth()];
    rangeElement.textContent = formatDate(currentWeekStart);
  } else if (currentView === "Week") {
    var start = new Date(currentWeekStart);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = start.getFullYear() + ' · ' + monthNames[start.getMonth()];
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "SevenDay") {
    var start = new Date(currentWeekStart);
    var end = new Date(start);
    end.setDate(start.getDate() + (_customDaysCount - 1));
    yearElement.textContent = start.getFullYear() + ' · ' + monthNames[start.getMonth()];
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "Month") {
    var monthStart = getMonthStart(currentWeekStart);
    yearElement.textContent = monthStart.getFullYear() + ' · ' + monthNames[monthStart.getMonth()];
    rangeElement.textContent = '';
  } else if (currentView === "Year") {
    var yearStart = getYearStart(currentWeekStart);
    yearElement.textContent = yearStart.getFullYear();
    rangeElement.textContent = "";
  } else {
    yearElement.textContent = "";
    rangeElement.textContent = "";
  }
}

/* ── Calendar event interaction helpers ──────────────────────────────────── */

/**
 * Open a chit in the editor. For recurring virtual instances, opens the parent.
 */
function openChitForEdit(chit) {
  // Birthday/anniversary entries open the contact editor instead
  if (chit._isBirthday && chit._contact_id) {
    storePreviousState();
    window.location.href = '/frontend/html/contact-editor.html?id=' + chit._contact_id;
    return;
  }
  storePreviousState();
  var id = chit._isVirtual && chit._parentId ? chit._parentId : chit.id;
  window.location.href = '/editor?id=' + id;
}

/**
 * Attach dblclick (edit) and shift+click (quick edit modal) to a calendar event element.
 * Long-press for quick-edit on mobile is coordinated through enableCalendarDrag()
 * via the longPressMap parameter, preventing race conditions with the drag system.
 * Viewer-role shared chits open in read-only mode (editor handles this via effective_role).
 * Quick-edit modal is disabled for viewer-role chits.
 */
function attachCalendarChitEvents(el, chit) {
  el.addEventListener("dblclick", function(e) {
    if (window._dragJustEnded) return;
    e.preventDefault();
    e.stopPropagation();
    openChitForEdit(chit);
  });
  el.addEventListener("click", function(e) {
    if (window._dragJustEnded) return;
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      // Prevent quick-edit for viewer-role shared chits
      if (typeof _isViewerRole === 'function' && _isViewerRole(chit)) return;
      showQuickEditModal(chit, function() { displayChits(); });
    }
  });
}

/**
 * Attach dblclick on empty space in a day column to create a new chit at that time.
 */
function attachEmptySlotCreate(col, day, defaultDurationMin) {
  defaultDurationMin = defaultDurationMin || 60;
  col.addEventListener("dblclick", function(e) {
    if (e.target !== col) return;
    var rect = col.getBoundingClientRect();
    var yInCol = e.clientY - rect.top;
    var totalMin = Math.max(0, Math.min(1439, Math.round(yInCol)));
    var snap = (typeof _calSnapMinutes !== 'undefined' ? _calSnapMinutes : 15) || 15;
    var snappedMin = Math.round(totalMin / snap) * snap;
    var startH = Math.floor(snappedMin / 60);
    var startM = snappedMin % 60;
    var endMin = snappedMin + defaultDurationMin;
    var endH = Math.floor(endMin / 60);
    var endM = endMin % 60;
    var pad = function(n) { return String(n).padStart(2, '0'); };
    var yyyy = day.getFullYear();
    var mm = pad(day.getMonth() + 1);
    var dd = pad(day.getDate());
    var startISO = yyyy + '-' + mm + '-' + dd + 'T' + pad(startH) + ':' + pad(startM) + ':00';
    var endISO = yyyy + '-' + mm + '-' + dd + 'T' + pad(endH) + ':' + pad(endM) + ':00';
    storePreviousState();
    window.location.href = '/editor?start=' + encodeURIComponent(startISO) + '&end=' + encodeURIComponent(endISO);
  });
}

/* ── Responsive day count ────────────────────────────────────────────────── */

/** Return the number of days to show in week view. Always returns 7. */
function _getResponsiveDayCount() {
  return 7;
}

/* ── Calendar Views ──────────────────────────────────────────────────────── */
function displayWeekView(chitsToDisplay, opts) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Options for Work Hours variant
  const hourStart = opts?.hourStart ?? 0;
  const hourEnd = opts?.hourEnd ?? 24;
  const filterDayNums = opts?.filterDays ?? null; // null = all 7 days
  const totalMinutes = (hourEnd - hourStart) * 60;

  // Wrapper: flex column — headers, all-day, then scrollable time grid
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;";

  const weekStart = new Date(currentWeekStart);
  let allWeekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    allWeekDays.push(d);
  }
  if (filterDayNums) {
    allWeekDays = allWeekDays.filter(d => filterDayNums.includes(d.getDay()));
  }
  if (allWeekDays.length === 0) {
    chitList.innerHTML = '<p style="padding:2em;opacity:0.5;">No working days this week. Check Period Options in Settings.</p>';
    return;
  }

  // Responsive day slicing: show fewer days on narrow viewports
  const responsiveDayCount = _getResponsiveDayCount();
  const totalDays = allWeekDays.length;
  let days;
  if (responsiveDayCount < totalDays) {
    // Clamp offset to valid range
    if (_weekViewDayOffset < 0) _weekViewDayOffset = 0;
    if (_weekViewDayOffset > totalDays - responsiveDayCount) _weekViewDayOffset = totalDays - responsiveDayCount;
    days = allWeekDays.slice(_weekViewDayOffset, _weekViewDayOffset + responsiveDayCount);
  } else {
    _weekViewDayOffset = 0;
    days = allWeekDays;
  }

  // Collect chits per day (for visible days only)
  const dayData = days.map(day => {
    const dayChits = chitsToDisplay.filter(c => chitMatchesDay(c, day));
    const allDay = [], timed = [];
    dayChits.forEach(c => {
      const info = getCalendarDateInfo(c);
      if (!info.hasDate) return;
      if (info.isAllDay) allDay.push({ chit: c, info });
      else timed.push({ chit: c, info });
    });
    return { day, allDay, timed };
  });

  // Row 1: Day headers (with prev/next nav when showing fewer days)
  const headerRow = document.createElement("div");
  headerRow.style.cssText = "display:flex;flex-shrink:0;border-bottom:1px solid #6b4e31;align-items:stretch;";

  // Prev button (when paging through days)
  if (responsiveDayCount < totalDays) {
    const prevBtn = document.createElement("button");
    prevBtn.className = "cal-day-nav-btn";
    prevBtn.textContent = "◀";
    prevBtn.title = "Previous day(s)";
    prevBtn.disabled = _weekViewDayOffset <= 0;
    prevBtn.addEventListener("click", () => {
      _weekViewDayOffset = Math.max(0, _weekViewDayOffset - responsiveDayCount);
      displayChits();
    });
    headerRow.appendChild(prevBtn);
  }

  // Spacer for hour column (contains all-day toggle if needed)
  const headerSpacer = document.createElement("div");
  headerSpacer.style.cssText = "width:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;";
  headerRow.appendChild(headerSpacer);
  days.forEach(day => {
    const hdr = document.createElement("div");
    hdr.className = "day-header";
    if (day.toDateString() === new Date().toDateString()) hdr.classList.add("today");
    hdr.style.cssText = "flex:1;min-width:0;text-align:center;padding:6px 2px;";
    hdr.textContent = formatDate(day);
    headerRow.appendChild(hdr);
  });

  // Next button (when paging through days)
  if (responsiveDayCount < totalDays) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "cal-day-nav-btn";
    nextBtn.textContent = "▶";
    nextBtn.title = "Next day(s)";
    nextBtn.disabled = _weekViewDayOffset >= totalDays - responsiveDayCount;
    nextBtn.addEventListener("click", () => {
      _weekViewDayOffset = Math.min(totalDays - responsiveDayCount, _weekViewDayOffset + responsiveDayCount);
      displayChits();
    });
    headerRow.appendChild(nextBtn);
  }

  wrapper.appendChild(headerRow);

  // Row 2: All-day events (with collapse toggle and day dividers)
  const hasAnyAllDay = dayData.some(d => d.allDay.length > 0);
  if (hasAnyAllDay) {
    const allDayContainer = document.createElement("div");
    allDayContainer.style.cssText = "flex-shrink:0;border-bottom:1px solid #6b4e31;";

    const allDayEventsRow = document.createElement("div");
    allDayEventsRow.className = "allday-events-area";
    allDayEventsRow.style.cssText = "display:flex;background:#e8dcc8;min-height:24px;";

    // Toggle button in the header spacer — hides/shows entire all-day section
    var _adBtnStyle = 'cursor:pointer;font-size:0.75em;font-weight:bold;user-select:none;display:block;text-align:center;padding:3px 4px;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:3px;font-family:inherit;line-height:1.2;';
    const toggleBtn = document.createElement("span");
    toggleBtn.style.cssText = _adBtnStyle;
    toggleBtn.textContent = "\u2600 Hide";
    toggleBtn.title = "Collapse all-day events";
    toggleBtn.addEventListener("click", () => {
      const isHidden = allDayContainer.style.display === "none";
      allDayContainer.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "\u2600 Hide" : "\u25B2 Show";
      toggleBtn.title = isHidden ? "Collapse all-day events" : "Expand all-day events";
    });
    headerSpacer.appendChild(toggleBtn);

    // Spacer in events row — more/less button goes at bottom
    const rowSpacer = document.createElement("div");
    rowSpacer.style.cssText = "width:60px;flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-end;padding:2px;box-sizing:border-box;";
    allDayEventsRow.appendChild(rowSpacer);

    renderAllDayEventsInCells(dayData, allDayEventsRow, _viSettings, 'calendar-slot');

    allDayContainer.appendChild(allDayEventsRow);
    _addAllDayHeightCap(allDayEventsRow, allDayContainer);
    wrapper.appendChild(allDayContainer);
    enableAllDayDrag(allDayEventsRow, days);
  }

  // Row 3: Scrollable time grid
  const scrollGrid = document.createElement("div");
  scrollGrid.className = "week-view";
  scrollGrid.style.cssText = "display:flex;flex:1;overflow-y:auto;width:100%;";

  // Hour column
  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.cssText = `width:60px;flex-shrink:0;position:relative;height:${totalMinutes}px;`;
  const weekHourFrag = document.createDocumentFragment();
  for (let hour = hourStart; hour < hourEnd; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${(hour - hourStart) * 60}px`;
    hb.textContent = `${hour}:00`;
    weekHourFrag.appendChild(hb);
  }
  hourColumn.appendChild(weekHourFrag);
  scrollGrid.appendChild(hourColumn);

  // Day columns with timed events only
  const weekDayColumns = [];
  const weekChitsMap = [];
  dayData.forEach((dd, dayIdx) => {
    const col = document.createElement("div");
    col.className = "day-column";
    if (dd.day.toDateString() === new Date().toDateString()) col.classList.add("today");
    col.style.cssText = `flex:1;min-width:0;position:relative;min-height:${totalMinutes}px;border-left:1px solid #d3d3d3;`;

    // Calculate overlaps for this day's timed events
    const _timeSlots = {};
    const _evData = [];
    const _rangeStartMin = hourStart * 60;
    const _rangeEndMin = hourEnd * 60;
    dd.timed.forEach(({ chit, info }) => {
      const _dayStart = new Date(dd.day.getFullYear(), dd.day.getMonth(), dd.day.getDate());
      const _dayEnd = new Date(_dayStart.getTime() + 86400000);
      const _cs = info.start < _dayStart ? _dayStart : info.start;
      const _ce = info.end > _dayEnd ? _dayEnd : info.end;
      let _absTop = _cs.getHours() * 60 + _cs.getMinutes();
      let _absBottom = (_ce.getTime() === _dayEnd.getTime()) ? 1440 : (_ce.getHours() * 60 + _ce.getMinutes());
      // Clamp to visible hour range
      if (_absBottom <= _rangeStartMin || _absTop >= _rangeEndMin) return;
      _absTop = Math.max(_absTop, _rangeStartMin);
      _absBottom = Math.min(_absBottom, _rangeEndMin);
      const _top = _absTop - _rangeStartMin;
      let _height = _absBottom - _absTop;
      if (_height < 30) _height = 30;
      const _startMin = _top, _endMin = _top + _height;
      for (let t = _startMin; t < _endMin; t++) { if (!_timeSlots[t]) _timeSlots[t] = []; }
      let _pos = 0;
      while (true) { let c = false; for (let t = _startMin; t < _endMin; t++) { if (_timeSlots[t].includes(_pos)) { c = true; break; } } if (!c) break; _pos++; }
      for (let t = _startMin; t < _endMin; t++) { _timeSlots[t].push(_pos); }
      _evData.push({ chit, info, top: _top, height: _height, pos: _pos, startMin: _startMin, endMin: _endMin });
    });

    _evData.forEach(({ chit, info, top, height, pos, startMin, endMin }) => {
      // Calculate max overlap only for the time slots THIS event occupies
      let _localMax = 1;
      for (let t = startMin; t < endMin; t++) {
        if (_timeSlots[t] && _timeSlots[t].length > _localMax) _localMax = _timeSlots[t].length;
      }
      const ev = document.createElement("div");
      ev.className = "timed-event";
      ev.dataset.chitId = chit.id;
      if (chit.status === "Complete") ev.classList.add("completed-task");
      if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) ev.classList.add("declined-chit");
      const _wPct = 95 / _localMax;
      ev.style.top = `${top}px`;
      ev.style.height = `${height}px`;
      applyChitColors(ev, chitColor(chit));
      ev.style.left = `${pos * _wPct}%`;
      ev.style.width = `${_wPct - 1}%`;
      ev.style.boxSizing = "border-box";
      ev.title = calendarEventTooltip(chit, info);
      const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
      ev.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-slot')}<br>${timeLabel}`;
      attachCalendarChitEvents(ev, chit);
      col.appendChild(ev);
      weekChitsMap.push({ el: ev, chit, info });
    });

    weekDayColumns.push(col);
    attachEmptySlotCreate(col, dd.day);
    scrollGrid.appendChild(col);
  });

  wrapper.appendChild(scrollGrid);
  chitList.appendChild(wrapper);

  if (!opts?.isWorkView) scrollToSixAM(); // Work view starts at work hour, others scroll to day-start time
  renderTimeBar("Week");

  // Enable drag
  _loadCalSnapSetting().then(() => {
    // Build longPressMap: element → quick-edit callback for unified gesture coordination
    var longPressMap = new Map();
    weekChitsMap.forEach(function(entry) {
      var _chit = entry.chit;
      if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
      longPressMap.set(entry.el, function() {
        if (window._dragJustEnded) return;
        if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
        showQuickEditModal(_chit, function() { displayChits(); });
      });
    });
    enableCalendarDrag(scrollGrid, weekDayColumns, days, weekChitsMap, longPressMap);
  });

  // Enable pinch-to-zoom on mobile (vertical axis only)
  enableCalendarPinchZoom(scrollGrid);
}

function displayWorkView(chitsToDisplay) {
  displayWeekView(chitsToDisplay, {
    hourStart: _workStartHour,
    hourEnd: _workEndHour,
    filterDays: _workDays,
    isWorkView: true
  });
}
function displayMonthView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const monthView = document.createElement("div");
  monthView.className = "month-view";

  const currentMonth = getMonthStart(new Date(currentWeekStart));
  const monthStart = new Date(currentMonth);
  const monthEnd = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  );
  const firstDay = (monthStart.getDay() - _weekStartDay + 7) % 7;
  const daysInMonth = monthEnd.getDate();

  // Month/year now shown in sidebar — no header bar needed

  const dayHeaders = document.createElement("div");
  dayHeaders.className = "day-headers";
  const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) daysOfWeek.push(allDays[(_weekStartDay + i) % 7]);
  const dayHeaderFrag = document.createDocumentFragment();
  daysOfWeek.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = day;
    dayHeaderFrag.appendChild(dayHeader);
  });
  dayHeaders.appendChild(dayHeaderFrag);
  monthView.appendChild(dayHeaders);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";

  // Batch all month-day cells into a fragment before appending to monthGrid
  const monthGridFrag = document.createDocumentFragment();

  // Previous month's trailing days (faded)
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0); // last day of prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate() - i);
    const monthDay = document.createElement("div");
    monthDay.className = "month-day other-month prev-month";
    monthDay.dataset.date = prevDay.toISOString().slice(0, 10);
    monthDay.innerHTML = `<div class="day-number">${prevDay.getDate()}</div>`;
    const dayChits = chitsToDisplay.filter((chit) => chitMatchesDay(chit, prevDay));
    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const info = getCalendarDateInfo(chit);
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.dataset.chitId = chit.id;
        applyChitColors(chitElement, chitColor(chit));
        if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-month');
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }
    monthGridFrag.appendChild(monthDay);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const monthDay = document.createElement("div");
    monthDay.className = "month-day";
    if (dayDate.toDateString() === new Date().toDateString()) monthDay.classList.add("today");
    monthDay.dataset.date = dayDate.toISOString().slice(0, 10);
    monthDay.innerHTML = `<div class="day-number">${day}</div>`;

    const dayChits = chitsToDisplay.filter((chit) => chitMatchesDay(chit, dayDate));

    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const info = getCalendarDateInfo(chit);
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.draggable = true;
        chitElement.dataset.chitId = chit.id;
        applyChitColors(chitElement, chitColor(chit));
        chitElement.style.cursor = "pointer";
        if (chit.status === "Complete") chitElement.classList.add("completed-task");
        if (chit._isBirthday) { chitElement.classList.add("birthday-event"); chitElement.draggable = false; }
        if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-month');
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }

    monthGridFrag.appendChild(monthDay);
  }

  // Next month's leading days (whitewashed) — fill to complete the grid row
  const totalCells = firstDay + daysInMonth;
  const trailingDays = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailingDays; i++) {
    const nextDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
    const monthDay = document.createElement("div");
    monthDay.className = "month-day other-month next-month";
    monthDay.dataset.date = nextDay.toISOString().slice(0, 10);
    monthDay.innerHTML = `<div class="day-number">${nextDay.getDate()}</div>`;
    const dayChits = chitsToDisplay.filter((chit) => chitMatchesDay(chit, nextDay));
    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const info = getCalendarDateInfo(chit);
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.dataset.chitId = chit.id;
        applyChitColors(chitElement, chitColor(chit));
        if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-month');
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }
    monthGridFrag.appendChild(monthDay);
  }

  monthGrid.appendChild(monthGridFrag);
  monthView.appendChild(monthGrid);
  chitList.appendChild(monthView);

  enableMonthDrag(monthGrid);

  // Double-click on empty day cell creates a new all-day chit for that date
  monthGrid.addEventListener('dblclick', (e) => {
    // Only fire if clicking on the day cell itself or the day-number, not on an event
    if (e.target.closest('.month-event')) return;
    const dayCell = e.target.closest('.month-day');
    if (!dayCell || !dayCell.dataset.date) return;
    const dateStr = dayCell.dataset.date;
    storePreviousState();
    window.location.href = `/editor?start=${encodeURIComponent(dateStr + 'T00:00:00')}&end=${encodeURIComponent(dateStr + 'T23:59:59')}&allday=1`;
  });
}

function displayItineraryView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const itineraryView = document.createElement("div");
  itineraryView.className = "itinerary-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureChits = chitsToDisplay
    .filter(
      (chit) => {
        // Include chits with start_datetime or due_datetime in the future
        if (chit.start_datetime_obj && chit.start_datetime_obj >= today) return true;
        if (chit.due_datetime) {
          const due = new Date(chit.due_datetime);
          if (due >= today) return true;
        }
        return false;
      },
    )
    .sort((a, b) => {
      const aDate = a.start_datetime_obj || new Date(a.due_datetime);
      const bDate = b.start_datetime_obj || new Date(b.due_datetime);
      return aDate - bDate;
    });

  if (futureChits.length === 0) {
    itineraryView.innerHTML = _emptyState("No upcoming events found.");
  } else {
    let currentDay = null;
    futureChits.forEach((chit) => {
      const chitDateRaw = chit.start_datetime_obj || new Date(chit.due_datetime);
      const chitDate = new Date(chitDateRaw);
      chitDate.setHours(0, 0, 0, 0);

      if (!currentDay || chitDate.getTime() !== currentDay.getTime()) {
        currentDay = chitDate;
        const daySeparator = document.createElement("div");
        daySeparator.className = "day-separator";
        if (chitDate.toDateString() === new Date().toDateString()) daySeparator.classList.add("today");
        daySeparator.innerHTML = `<hr><h3>${formatDate(chitDate)}</h3>`;
        itineraryView.appendChild(daySeparator);
      }

      const chitElement = document.createElement("div");
      chitElement.className = "itinerary-event";
      chitElement.style.display = "flex";
      chitElement.style.justifyContent = "flex-start";
      chitElement.style.padding = "10px";
      applyChitColors(chitElement, chitColor(chit));
      chitElement.style.marginBottom = "5px";
      chitElement.style.borderRadius = "5px";
      chitElement.style.marginLeft = "100px";

      // Fade completed tasks
      if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
        chitElement.classList.add("completed-task");
      }
      if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

      const timeColumn = document.createElement("div");
      timeColumn.className = "time-column";
      timeColumn.style.width = "100px";
      timeColumn.style.marginRight = "15px";

      if (chit.start_datetime_obj) {
        const chitStart = chit.start_datetime_obj;
        const chitEnd =
          chit.end_datetime_obj || new Date(chitStart.getTime() + 60 * 60 * 1000);
        timeColumn.innerHTML = `${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
      } else {
        // Due-date-only chit
        const dueDate = new Date(chit.due_datetime);
        timeColumn.innerHTML = chit.all_day ? '⌚ All Day' : `⌚ ${formatTime(dueDate)}`;
      }

      const detailsColumn = document.createElement("div");
      detailsColumn.className = "details-column";
      detailsColumn.style.textAlign = "center";
      detailsColumn.style.flex = "1";

      // Visual indicators before title
      const indicators = typeof _getAllIndicators === 'function' ? _getAllIndicators(chit, _viSettings, 'card') : '';
      const pinnedIcon = chit.pinned ? '<i class="fas fa-bookmark" style="font-size:0.85em;"></i> ' : '';
      detailsColumn.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${indicators}${pinnedIcon}${chit.title || '(Untitled)'}</span>`;

      chitElement.appendChild(timeColumn);
      chitElement.appendChild(detailsColumn);
      attachCalendarChitEvents(chitElement, chit);
      itineraryView.appendChild(chitElement);
    });
  }

  chitList.appendChild(itineraryView);

  renderTimeBar("Itinerary");
}

function displayDayView(chitsToDisplay, opts) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const hourStart = opts?.hourStart ?? 0;
  const hourEnd = opts?.hourEnd ?? 24;
  const totalMinutes = (hourEnd - hourStart) * 60;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;";

  const day = new Date(currentWeekStart);
  const dayChits = chitsToDisplay.filter(c => chitMatchesDay(c, day));
  const allDayChits = [], timedChits = [];
  dayChits.forEach(c => {
    const info = getCalendarDateInfo(c);
    if (!info.hasDate) return;
    if (info.isAllDay) allDayChits.push({ chit: c, info });
    else timedChits.push({ chit: c, info });
  });

  // Row 1: Day header
  const headerRow = document.createElement("div");
  headerRow.className = "day-header";
  if (day.toDateString() === new Date().toDateString()) headerRow.classList.add("today");
  headerRow.style.cssText = "flex-shrink:0;text-align:center;padding:8px;border-bottom:1px solid #6b4e31;";
  headerRow.textContent = formatDate(day);
  wrapper.appendChild(headerRow);

  // Row 2: All-day events
  if (allDayChits.length > 0) {
    const allDayRow = document.createElement("div");
    allDayRow.className = "allday-events-area";
    allDayRow.style.cssText = "flex-shrink:0;background:#e8dcc8;border-bottom:1px solid #6b4e31;padding:4px 8px;";
    allDayChits.forEach(({ chit, info }) => {
      const ev = document.createElement("div");
      ev.className = "all-day-event";
      if (chit._isBirthday) ev.classList.add("birthday-event");
      ev.dataset.chitId = chit.id;
      applyChitColors(ev, chitColor(chit));
      if (chit.status === "Complete") ev.classList.add("completed-task");
      if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) ev.classList.add("declined-chit");
      ev.title = calendarEventTooltip(chit, info);
      ev.innerHTML = calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-slot');
      attachCalendarChitEvents(ev, chit);
      allDayRow.appendChild(ev);
    });
    wrapper.appendChild(allDayRow);
  }

  // Row 3: Scrollable time grid
  const dayView = document.createElement("div");
  dayView.className = "day-view";
  dayView.style.cssText = "display:flex;flex:1;overflow-y:auto;position:relative;width:100%;";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.cssText = `width:80px;flex-shrink:0;position:relative;height:${totalMinutes}px;background:#fff5e6;`;
  const dayHourFrag = document.createDocumentFragment();
  for (let hour = hourStart; hour < hourEnd; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${(hour - hourStart) * 60}px`;
    hb.textContent = `${hour}:00`;
    dayHourFrag.appendChild(hb);
  }
  hourColumn.appendChild(dayHourFrag);
  dayView.appendChild(hourColumn);

  const eventsContainer = document.createElement("div");
  eventsContainer.style.cssText = `position:relative;flex:1;margin-left:15px;min-height:${totalMinutes}px;`;

  const dayChitsMap = [];
  const dayViewColumns = [eventsContainer]; // single column for day view
  const dayViewDays = [day];

  const timeSlots = {};
  timedChits.forEach(({ chit, info }) => {
    // Clamp to this day for multi-day events
    const _dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const _dayEnd = new Date(_dayStart.getTime() + 86400000);
    const _cs = info.start < _dayStart ? _dayStart : info.start;
    const _ce = info.end > _dayEnd ? _dayEnd : info.end;
    const _rangeStartMin = hourStart * 60;
    const _rangeEndMin = hourEnd * 60;
    let _absStart = _cs.getHours() * 60 + _cs.getMinutes();
    let _absEnd = (_ce.getTime() === _dayEnd.getTime()) ? 1440 : _ce.getHours() * 60 + _ce.getMinutes();
    if (_absEnd <= _absStart) _absEnd = _absStart + 30;
    // Clamp to visible range
    if (_absEnd <= _rangeStartMin || _absStart >= _rangeEndMin) return;
    _absStart = Math.max(_absStart, _rangeStartMin);
    _absEnd = Math.min(_absEnd, _rangeEndMin);
    const startTime = _absStart - _rangeStartMin;
    const endTime = _absEnd - _rangeStartMin;

    for (let t = startTime; t < endTime; t++) { if (!timeSlots[t]) timeSlots[t] = []; }
    let position = 0;
    while (true) {
      let collision = false;
      for (let t = startTime; t < endTime; t++) { if (timeSlots[t].includes(position)) { collision = true; break; } }
      if (!collision) break;
      position++;
    }
    for (let t = startTime; t < endTime; t++) { timeSlots[t].push(position); }

    dayChitsMap.push({ chit, info, startTime, endTime, position, height: Math.max(endTime - startTime, 30) });
  });

  // Second pass: render events with per-event local overlap width
  const dayChitsMapFinal = [];
  dayChitsMap.forEach(({ chit, info, startTime, endTime, position, height }) => {
    // Calculate max overlap only for the time slots THIS event occupies
    let localMax = 1;
    for (let t = startTime; t < endTime; t++) {
      if (timeSlots[t] && timeSlots[t].length > localMax) localMax = timeSlots[t].length;
    }
    const el = document.createElement("div");
    el.className = "day-event";
    el.dataset.chitId = chit.id;
    const widthPct = 95 / localMax;
    el.style.cssText = `top:${startTime}px;height:${height}px;left:${position * widthPct}%;width:${widthPct - 1}%;position:absolute;box-sizing:border-box;`;
    applyChitColors(el, chitColor(chit));
    el.title = calendarEventTooltip(chit, info);
    if (chit.status === "Complete") el.classList.add("completed-task");
    if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) el.classList.add("declined-chit");
    const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
    el.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-slot')}<br>${timeLabel}`;
    attachCalendarChitEvents(el, chit);
    eventsContainer.appendChild(el);
    dayChitsMapFinal.push({ el, chit, info });
  });

  dayView.appendChild(eventsContainer);
  attachEmptySlotCreate(eventsContainer, day);
  wrapper.appendChild(dayView);
  chitList.appendChild(wrapper);

  scrollToSixAM();
  renderTimeBar("Day");

  _loadCalSnapSetting().then(() => {
    // Build longPressMap: element → quick-edit callback for unified gesture coordination
    var longPressMap = new Map();
    dayChitsMapFinal.forEach(function(entry) {
      var _chit = entry.chit;
      if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
      longPressMap.set(entry.el, function() {
        if (window._dragJustEnded) return;
        if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
        showQuickEditModal(_chit, function() { displayChits(); });
      });
    });
    enableCalendarDrag(dayView, dayViewColumns, dayViewDays, dayChitsMapFinal, longPressMap);
  });

  // Enable pinch-to-zoom on mobile (vertical axis only)
  enableCalendarPinchZoom(dayView);
}

function displayYearView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const yearView = document.createElement("div");
  yearView.className = "year-view";
  yearView.style.backgroundColor = "#fff5e6";
  yearView.style.display = "flex";
  yearView.style.flexWrap = "wrap";
  yearView.style.width = "100%";

  const currentYear = new Date(currentWeekStart).getFullYear();
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

  months.forEach((month, idx) => {
    const monthBlock = document.createElement("div");
    monthBlock.className = "year-month";
    monthBlock.style.padding = "10px";
    monthBlock.style.boxSizing = "border-box";

    const monthHeader = document.createElement("div");
    monthHeader.className = "month-header";
    monthHeader.textContent = `${month} ${currentYear}`;
    monthHeader.style.fontWeight = "bold";
    monthBlock.appendChild(monthHeader);

    const daysInMonth = new Date(currentYear, idx + 1, 0).getDate();
    const firstDay = new Date(currentYear, idx, 1).getDay();
    const monthGrid = document.createElement("div");
    monthGrid.className = "month-grid";
    monthGrid.style.display = "grid";
    monthGrid.style.gridTemplateColumns = "repeat(7, 1fr)";
    monthGrid.style.gap = "2px";

    const yearGridFrag = document.createDocumentFragment();
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "day empty";
      yearGridFrag.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(currentYear, idx, day);
      const dayElement = document.createElement("div");
      dayElement.className = "day";
      if (dayDate.toDateString() === new Date().toDateString()) dayElement.classList.add("today");
      dayElement.textContent = day;
      dayElement.style.padding = "5px";
      dayElement.style.textAlign = "center";
      dayElement.style.cursor = "pointer";

      // Include chits with start_datetime or due_datetime on this day
      const dayChits = chitsToDisplay.filter((chit) => {
        const startDateMatch =
          chit.start_datetime_obj &&
          chit.start_datetime_obj.toDateString() === dayDate.toDateString();
        const dueDateObj = chit.due_datetime
          ? new Date(chit.due_datetime)
          : null;
        const dueDateMatch =
          dueDateObj && dueDateObj.toDateString() === dayDate.toDateString();
        return startDateMatch || dueDateMatch;
      });

      const chitCount = dayChits.length;
      dayElement.style.backgroundColor =
        chitCount === 0 ? "#fff5e6" : chitCount === 1 ? "#e6d5b8" : "#D68A59";

      dayElement.addEventListener("click", () => {
        currentView = "Day";
        currentWeekStart = dayDate;
        document.getElementById("period-select").value = "Day";
        updateDateRange();
        displayChits();
      });
      yearGridFrag.appendChild(dayElement);
    }

    monthGrid.appendChild(yearGridFrag);
    monthBlock.appendChild(monthGrid);
    yearView.appendChild(monthBlock);
  });

  chitList.appendChild(yearView);
}

function _addAllDayHeightCap(eventsRow, container) {
  var MAX_HEIGHT_PX = 80;
  requestAnimationFrame(function() {
    var actualHeight = eventsRow.scrollHeight;
    if (actualHeight <= MAX_HEIGHT_PX) return;

    eventsRow.style.maxHeight = MAX_HEIGHT_PX + 'px';
    eventsRow.style.overflow = 'hidden';

    var expanded = false;

    // Find the 60px spacer div inside the events row (first child)
    var spacer = eventsRow.querySelector('div');
    if (!spacer || spacer.offsetWidth > 70) spacer = null;

    var toggleBtn = document.createElement('div');
    var btnStyle = 'cursor:pointer;font-size:0.75em;font-weight:bold;user-select:none;display:block;text-align:center;padding:3px 4px;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:3px;font-family:inherit;line-height:1.2;';
    toggleBtn.style.cssText = btnStyle;
    toggleBtn.textContent = '\u25BC all';
    toggleBtn.title = 'Show all all-day events';
    toggleBtn.addEventListener('click', function() {
      expanded = !expanded;
      if (expanded) {
        eventsRow.style.maxHeight = 'none';
        eventsRow.style.overflow = '';
        toggleBtn.textContent = '\u25B2 less';
        toggleBtn.title = 'Collapse all-day events';
      } else {
        eventsRow.style.maxHeight = MAX_HEIGHT_PX + 'px';
        eventsRow.style.overflow = 'hidden';
        toggleBtn.textContent = '\u25BC all';
        toggleBtn.title = 'Show all all-day events';
      }
    });

    if (spacer) {
      spacer.appendChild(toggleBtn);
    } else {
      // Fallback: bar below
      toggleBtn.style.cssText = btnStyle + 'width:60px;margin:2px;';
      if (eventsRow.nextSibling) {
        container.insertBefore(toggleBtn, eventsRow.nextSibling);
      } else {
        container.appendChild(toggleBtn);
      }
    }
  });
}

/**
 * Scroll the time-based view to the configured "scroll to" hour (default 5am).
 * If that hour is outside the visible range, scrolls to the top.
 */
function scrollToSixAM() {
  setTimeout(() => {
    const scrollable =
      document.querySelector(".week-view") ||
      document.querySelector(".day-view");
    if (scrollable) {
      var targetMin = _dayScrollToHour * 60;
      var viewStartMin = _allViewStartHour * 60;
      var scrollPx = Math.max(0, targetMin - viewStartMin);
      scrollable.scrollTop = scrollPx;
    }
  }, 50);
}

/**
 * Render and maintain a "current time" bar in time-based views.
 * Only shows in today's column. Updates every minute.
 */
function renderTimeBar(viewType) {
  // Clear any existing interval
  if (_timeBarInterval) {
    clearInterval(_timeBarInterval);
    _timeBarInterval = null;
  }

  function placeBar() {
    // Remove any existing bars
    document.querySelectorAll(".time-now-bar, .current-time-bar").forEach((el) => el.remove());

    const now = new Date();
    const todayStr = now.toDateString();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();

    if (viewType === "Day") {
      // Day view: find the events container inside the day-view
      const dayView = document.querySelector(".day-view");
      if (!dayView) return;
      // Events container is the second child (after hour column)
      const eventsContainer = dayView.children[1];
      if (!eventsContainer) return;
      const bar = document.createElement("div");
      bar.className = "time-now-bar";
      bar.style.top = `${minuteOfDay}px`;
      eventsContainer.appendChild(bar);
    } else if (viewType === "Week" || viewType === "SevenDay") {
      // Find today's column using the .today class
      const todayCol = document.querySelector(".day-column.today");
      if (todayCol) {
        const bar = document.createElement("div");
        bar.className = "time-now-bar";
        bar.style.top = `${minuteOfDay}px`;
        todayCol.appendChild(bar);
      }
    } else if (viewType === "Itinerary") {
      // In itinerary, show a horizontal rule at "now" between past and future events
      const itineraryView = document.querySelector(".itinerary-view");
      if (!itineraryView) return;
      const bar = document.createElement("div");
      bar.className = "current-time-bar";
      bar.style.cssText = `width:100%;height:2px;background:#4a2c2a;margin:4px 0;position:relative;`;
      const label = document.createElement("span");
      label.style.cssText = `position:absolute;left:0;top:-10px;font-size:0.75em;color:#4a2c2a;font-weight:bold;`;
      label.textContent = `▶ Now (${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false})})`;
      bar.appendChild(label);
      // Insert before the first future event separator
      const separators = itineraryView.querySelectorAll(".day-separator");
      let inserted = false;
      separators.forEach((sep) => {
        if (!inserted) {
          const h3 = sep.querySelector("h3");
          if (h3) {
            // Try to parse the date from the separator
            const parts = h3.textContent.trim().split(/\s+/);
            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const monthIdx = monthNames.indexOf(parts[0]);
            const day = parseInt(parts[1]);
            const year = new Date().getFullYear();
            if (monthIdx !== -1 && !isNaN(day)) {
              const sepDate = new Date(year, monthIdx, day);
              if (sepDate >= now) {
                itineraryView.insertBefore(bar, sep);
                inserted = true;
              }
            }
          }
        }
      });
      if (!inserted) itineraryView.appendChild(bar);
    }
  }

  // Use setTimeout so layout is fully computed before measuring offsetHeight
  setTimeout(() => {
    placeBar();
  }, 60);
  // Update at the start of each minute
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => {
    placeBar();
    _timeBarInterval = setInterval(placeBar, 60000);
  }, msUntilNextMinute);
}

/**
 * Seven-day view: same as week view but always starts from today.
 */
function displaySevenDayView(chitsToDisplay, opts) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const hourStart = opts?.hourStart ?? 0;
  const hourEnd = opts?.hourEnd ?? 24;
  const totalMinutes = (hourEnd - hourStart) * 60;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;";

  const numDays = _customDaysCount || 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allSevenDays = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    allSevenDays.push(d);
  }

  // Responsive day slicing
  const responsiveDayCount = _getResponsiveDayCount();
  const totalDays = allSevenDays.length;
  let days;
  if (responsiveDayCount < totalDays) {
    if (_weekViewDayOffset < 0) _weekViewDayOffset = 0;
    if (_weekViewDayOffset > totalDays - responsiveDayCount) _weekViewDayOffset = totalDays - responsiveDayCount;
    days = allSevenDays.slice(_weekViewDayOffset, _weekViewDayOffset + responsiveDayCount);
  } else {
    _weekViewDayOffset = 0;
    days = allSevenDays;
  }

  const dayData = days.map(day => {
    const dayChits = chitsToDisplay.filter(c => chitMatchesDay(c, day));
    const allDay = [], timed = [];
    dayChits.forEach(c => {
      const info = getCalendarDateInfo(c);
      if (!info.hasDate) return;
      if (info.isAllDay) allDay.push({ chit: c, info });
      else timed.push({ chit: c, info });
    });
    return { day, allDay, timed };
  });

  // Row 1: Day headers (with prev/next nav when showing fewer days)
  const headerRow = document.createElement("div");
  headerRow.style.cssText = "display:flex;flex-shrink:0;border-bottom:1px solid #6b4e31;align-items:stretch;";

  // Prev button (when paging through days)
  if (responsiveDayCount < totalDays) {
    const prevBtn = document.createElement("button");
    prevBtn.className = "cal-day-nav-btn";
    prevBtn.textContent = "◀";
    prevBtn.title = "Previous day(s)";
    prevBtn.disabled = _weekViewDayOffset <= 0;
    prevBtn.addEventListener("click", () => {
      _weekViewDayOffset = Math.max(0, _weekViewDayOffset - responsiveDayCount);
      displayChits();
    });
    headerRow.appendChild(prevBtn);
  }

  const headerSpacer = document.createElement("div");
  headerSpacer.style.cssText = "width:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;";
  headerRow.appendChild(headerSpacer);
  days.forEach(day => {
    const hdr = document.createElement("div");
    hdr.className = "day-header";
    if (day.toDateString() === new Date().toDateString()) hdr.classList.add("today");
    hdr.style.cssText = "flex:1;min-width:0;text-align:center;padding:6px 2px;";
    hdr.textContent = formatDate(day);
    headerRow.appendChild(hdr);
  });

  // Next button (when paging through days)
  if (responsiveDayCount < totalDays) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "cal-day-nav-btn";
    nextBtn.textContent = "▶";
    nextBtn.title = "Next day(s)";
    nextBtn.disabled = _weekViewDayOffset >= totalDays - responsiveDayCount;
    nextBtn.addEventListener("click", () => {
      _weekViewDayOffset = Math.min(totalDays - responsiveDayCount, _weekViewDayOffset + responsiveDayCount);
      displayChits();
    });
    headerRow.appendChild(nextBtn);
  }

  wrapper.appendChild(headerRow);

  // Row 2: All-day events (with collapse toggle and day dividers)
  const hasAnyAllDay = dayData.some(d => d.allDay.length > 0);
  if (hasAnyAllDay) {
    const allDayContainer = document.createElement("div");
    allDayContainer.style.cssText = "flex-shrink:0;border-bottom:1px solid #6b4e31;";

    const allDayEventsRow = document.createElement("div");
    allDayEventsRow.className = "allday-events-area";
    allDayEventsRow.style.cssText = "display:flex;background:#e8dcc8;min-height:24px;";

    // Toggle button in the header spacer — hides/shows entire all-day section
    var _adBtnStyle = 'cursor:pointer;font-size:0.75em;font-weight:bold;user-select:none;display:block;text-align:center;padding:3px 4px;background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:3px;font-family:inherit;line-height:1.2;';
    const toggleBtn = document.createElement("span");
    toggleBtn.style.cssText = _adBtnStyle;
    toggleBtn.textContent = "\u2600 Hide";
    toggleBtn.title = "Collapse all-day events";
    toggleBtn.addEventListener("click", () => {
      const isHidden = allDayContainer.style.display === "none";
      allDayContainer.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "\u2600 Hide" : "\u25B2 Show";
      toggleBtn.title = isHidden ? "Collapse all-day events" : "Expand all-day events";
    });
    headerSpacer.appendChild(toggleBtn);

    // Spacer in events row — more/less button goes at bottom
    const rowSpacer = document.createElement("div");
    rowSpacer.style.cssText = "width:60px;flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-end;padding:2px;box-sizing:border-box;";
    allDayEventsRow.appendChild(rowSpacer);

    renderAllDayEventsInCells(dayData, allDayEventsRow, _viSettings, 'calendar-slot');

    allDayContainer.appendChild(allDayEventsRow);
    _addAllDayHeightCap(allDayEventsRow, allDayContainer);
    wrapper.appendChild(allDayContainer);
    enableAllDayDrag(allDayEventsRow, days);
  }

  // Row 3: Scrollable time grid
  const scrollGrid = document.createElement("div");
  scrollGrid.className = "week-view";
  scrollGrid.style.cssText = "display:flex;flex:1;overflow-y:auto;width:100%;";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.cssText = `width:60px;flex-shrink:0;position:relative;height:${totalMinutes}px;`;
  const sdHourFrag = document.createDocumentFragment();
  for (let hour = hourStart; hour < hourEnd; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${(hour - hourStart) * 60}px`;
    hb.textContent = `${hour}:00`;
    sdHourFrag.appendChild(hb);
  }
  hourColumn.appendChild(sdHourFrag);
  scrollGrid.appendChild(hourColumn);

  const sdDayColumns = [];
  const sdChitsMap = [];
  dayData.forEach(dd => {
    const col = document.createElement("div");
    col.className = "day-column";
    if (dd.day.toDateString() === new Date().toDateString()) col.classList.add("today");
    col.style.cssText = `flex:1;min-width:0;position:relative;min-height:${totalMinutes}px;border-left:1px solid #d3d3d3;`;

    // Calculate overlaps for 7-day view
    const _ts7 = {};
    const _ed7 = [];
    const _rangeStartMin7 = hourStart * 60;
    const _rangeEndMin7 = hourEnd * 60;
    dd.timed.forEach(({ chit, info }) => {
      const _dayStart = new Date(dd.day.getFullYear(), dd.day.getMonth(), dd.day.getDate());
      const _dayEnd = new Date(_dayStart.getTime() + 86400000);
      const _cs = info.start < _dayStart ? _dayStart : info.start;
      const _ce = info.end > _dayEnd ? _dayEnd : info.end;
      let _absTop = _cs.getHours() * 60 + _cs.getMinutes();
      let _absBottom = (_ce.getTime() === _dayEnd.getTime()) ? 1440 : (_ce.getHours() * 60 + _ce.getMinutes());
      // Clamp to visible range
      if (_absBottom <= _rangeStartMin7 || _absTop >= _rangeEndMin7) return;
      _absTop = Math.max(_absTop, _rangeStartMin7);
      _absBottom = Math.min(_absBottom, _rangeEndMin7);
      const _top = _absTop - _rangeStartMin7;
      let _height = _absBottom - _absTop;
      if (_height < 30) _height = 30;
      const _s = _top, _e = _top + _height;
      for (let t = _s; t < _e; t++) { if (!_ts7[t]) _ts7[t] = []; }
      let _p = 0;
      while (true) { let c = false; for (let t = _s; t < _e; t++) { if (_ts7[t].includes(_p)) { c = true; break; } } if (!c) break; _p++; }
      for (let t = _s; t < _e; t++) { _ts7[t].push(_p); }
      _ed7.push({ chit, info, top: _top, height: _height, pos: _p, startMin: _s, endMin: _e });
    });

    _ed7.forEach(({ chit, info, top, height, pos, startMin, endMin }) => {
      // Calculate max overlap only for the time slots THIS event occupies
      let _localMax = 1;
      for (let t = startMin; t < endMin; t++) {
        if (_ts7[t] && _ts7[t].length > _localMax) _localMax = _ts7[t].length;
      }
      const ev = document.createElement("div");
      ev.className = "timed-event";
      ev.dataset.chitId = chit.id;
      if (chit.status === "Complete") ev.classList.add("completed-task");
      if (typeof _isDeclinedByCurrentUser === 'function' && _isDeclinedByCurrentUser(chit)) ev.classList.add("declined-chit");
      const _w = 95 / _localMax;
      ev.style.top = `${top}px`;
      ev.style.height = `${height}px`;
      applyChitColors(ev, chitColor(chit));
      ev.style.left = `${pos * _w}%`;
      ev.style.width = `${_w - 1}%`;
      ev.style.boxSizing = "border-box";
      ev.title = calendarEventTooltip(chit, info);
      const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
      ev.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-slot')}<br>${timeLabel}`;
      attachCalendarChitEvents(ev, chit);
      col.appendChild(ev);
      sdChitsMap.push({ el: ev, chit, info });
    });

    sdDayColumns.push(col);
    attachEmptySlotCreate(col, dd.day);
    scrollGrid.appendChild(col);
  });

  wrapper.appendChild(scrollGrid);
  chitList.appendChild(wrapper);

  scrollToSixAM();
  renderTimeBar("SevenDay");

  _loadCalSnapSetting().then(() => {
    // Build longPressMap: element → quick-edit callback for unified gesture coordination
    var longPressMap = new Map();
    sdChitsMap.forEach(function(entry) {
      var _chit = entry.chit;
      if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
      longPressMap.set(entry.el, function() {
        if (window._dragJustEnded) return;
        if (typeof _isViewerRole === 'function' && _isViewerRole(_chit)) return;
        showQuickEditModal(_chit, function() { displayChits(); });
      });
    });
    enableCalendarDrag(scrollGrid, sdDayColumns, days, sdChitsMap, longPressMap);
  });

  // Enable pinch-to-zoom on mobile (vertical axis only)
  enableCalendarPinchZoom(scrollGrid);
}


/* ── Weather page → Day view navigation intent ───────────────────────────── */
function _checkWeatherNavIntent() {
  var raw;
  try { raw = sessionStorage.getItem('cwoc_wx_nav'); } catch (e) { return; }
  if (!raw) return;
  sessionStorage.removeItem('cwoc_wx_nav');

  var nav;
  try { nav = JSON.parse(raw); } catch (e) { return; }
  if (!nav || !nav.date) return;

  console.debug('Weather nav: detected intent', nav);

  var parts = nav.date.split('-');
  var targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(targetDate.getTime())) return;

  // Override state BEFORE fetchChits runs — so displayChits renders Day view on this date
  currentTab = 'Calendar';
  currentView = 'Day';
  currentWeekStart = targetDate;
  _weekViewDayOffset = 0;

  // Store location for flashing after chits render
  _wxNavPending = nav.location || null;
}

/**
 * Called from fetchChits .then() — polls for rendered chit elements then flashes.
 */
function _executeWeatherFlash() {
  if (!_wxNavPending) return;
  var location = _wxNavPending;
  _wxNavPending = null;

  console.debug('Weather flash: starting poll for elements, location="' + location + '"');

  // Update sidebar UI to reflect Calendar/Day
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  var calTab = document.querySelector(".tab[onclick=\"filterChits('Calendar')\"]");
  if (calTab) calTab.classList.add('active');
  var sel = document.getElementById('period-select');
  if (sel) sel.value = 'Day';
  var orderSection = document.getElementById('section-order');
  if (orderSection) orderSection.style.display = 'none';
  var periodSection = document.getElementById('section-period');
  if (periodSection) periodSection.style.display = '';
  var yearWeekContainer = document.getElementById('year-week-container');
  if (yearWeekContainer) yearWeekContainer.style.display = '';

  // Poll until chit elements appear in the DOM
  var attempts = 0;
  var poller = setInterval(function() {
    attempts++;
    var els = document.querySelectorAll('[data-chit-id]');
    console.debug('Weather flash poll #' + attempts + ': found ' + els.length + ' elements');
    if (els.length > 0 || attempts > 30) {
      clearInterval(poller);
      if (els.length > 0) {
        _flashChitsAtLocation(location);
      } else {
        console.debug('Weather flash: no chit elements found after 30 polls — no events on this day?');
      }
    }
  }, 150);
}

function _flashChitsAtLocation(location) {
  var locLower = location.toLowerCase().trim();
  var els = document.querySelectorAll('[data-chit-id]');
  var matched = [];

  els.forEach(function(el) {
    var chitId = el.dataset.chitId;
    var chit = chits.find(function(c) { return c.id === chitId; });
    if (!chit) return;
    var chitLoc = (chit.location || '').toLowerCase().trim();
    if (chitLoc && locLower && (chitLoc.indexOf(locLower) >= 0 || locLower.indexOf(chitLoc) >= 0)) {
      matched.push(el);
    }
  });

  console.debug('Weather flash: location="' + locLower + '", matched=' + matched.length);

  matched.forEach(function(el) {
    // Store original background
    var origBg = el.style.backgroundColor || '';
    var count = 0;
    var flashInterval = setInterval(function() {
      count++;
      if (count > 6) {
        clearInterval(flashInterval);
        el.style.backgroundColor = origBg;
        el.style.outline = '';
        return;
      }
      if (count % 2 === 1) {
        // Dark beat
        el.style.backgroundColor = '#c8b830';
        el.style.outline = '3px solid rgba(200,190,60,0.7)';
      } else {
        // Light beat
        el.style.backgroundColor = origBg;
        el.style.outline = '';
      }
    }, 500);
  });

  if (matched.length > 0) {
    matched[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
