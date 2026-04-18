/* Main application functionality */
let currentTab = "Calendar";
let chits = [];
let currentWeekStart = null;
let currentView = "Week";
let previousState = { tab: "Calendar", view: "Week" };

function storePreviousState() {
  previousState = { tab: currentTab, view: currentView };
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("active");
  if (sidebar.classList.contains("active")) {
    localStorage.setItem("sidebarState", "open");
  } else {
    localStorage.setItem("sidebarState", "closed");
  }
  window.dispatchEvent(new Event("resize"));
}

function restoreSidebarState() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("Sidebar element not found");
    return;
  }
  const savedState = localStorage.getItem("sidebarState");
  if (savedState === "open") {
    sidebar.classList.add("active");
  } else {
    sidebar.classList.remove("active");
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getYearStart(date) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
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
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${monthNames[date.getMonth()]}\n${String(date.getDate()).padStart(2, "0")}\n${dayNames[date.getDay()]}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWeekRange(start, end) {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  return `<span>${startStr}</span><span>${endStr}</span>`;
}

function getPastelColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const r = ((hash & 0xff) % 128) + 127;
  const g = (((hash >> 8) & 0xff) % 128) + 127;
  const b = (((hash >> 16) & 0xff) % 128) + 127;
  return `rgb(${r}, ${g}, ${b})`;
}

function previousPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
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

function fetchChits() {
  console.log("Fetching chits...");
  fetch("/api/chits")
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      chits = Array.isArray(data) ? data : [];
      chits.forEach((chit) => {
        if (chit.start_datetime)
          chit.start_datetime_obj = new Date(chit.start_datetime);
        if (chit.end_datetime)
          chit.end_datetime_obj = new Date(chit.end_datetime);
      });
      console.log("Fetched chits:", chits);
      if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
      updateDateRange();
      displayChits();
      restoreSidebarState();
    })
    .catch((err) => {
      console.error("Error fetching chits:", err);
      document.getElementById("chit-list").innerHTML = `
      <div class="error-message">
      <h3>Error loading chits</h3>
      <p>${err.message}</p>
      <button onclick="fetchChits()">Try Again</button>
      </div>
      `;
      restoreSidebarState();
    });
}

function updateDateRange() {
  const rangeElement = document.getElementById("week-range");
  const yearElement = document.getElementById("year-display");
  if (!rangeElement || !yearElement) {
    console.error("Week range or year display element not found");
    return;
  }
  if (!currentWeekStart) {
    currentWeekStart = getWeekStart(new Date());
  }
  if (currentView === "Day") {
    yearElement.textContent = currentWeekStart.getFullYear();
    rangeElement.textContent = formatDate(currentWeekStart);
  } else if (currentView === "Week") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = start.getFullYear();
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "SevenDay") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = start.getFullYear();
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "Month") {
    const monthStart = getMonthStart(currentWeekStart);
    yearElement.textContent = monthStart.getFullYear();
    rangeElement.textContent = `${monthStart.toLocaleString("default", { month: "long" })}`;
  } else if (currentView === "Year") {
    const yearStart = getYearStart(currentWeekStart);
    yearElement.textContent = yearStart.getFullYear();
    rangeElement.textContent = "";
  } else {
    yearElement.textContent = "";
    rangeElement.textContent = "";
  }
}

function updateStatusFilterOptions() {
  const statusFilter = document.getElementById("status-filter");
  if (!statusFilter) return;

  // Clear existing options
  statusFilter.innerHTML = "";

  // Always add the null option "-" for Calendar and Notes views
  if (currentTab === "Calendar" || currentTab === "Notes") {
    const nullOption = document.createElement("option");
    nullOption.value = "";
    nullOption.textContent = "-";
    statusFilter.appendChild(nullOption);
  }

  // Add other status options
  const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  });

  // Reset filter to default (null)
  statusFilter.value = "";
}

function displayChits() {
  const listContainer = document.getElementById("chit-list");
  if (!listContainer) {
    console.error("Chit list container not found");
    return;
  }
  const searchText = document.getElementById("search").value.toLowerCase();
  const statusFilter = document.getElementById("status-filter").value;

  let filteredChits = chits.filter((chit) => {
    const matchesSearch =
      !searchText ||
      (chit.title && chit.title.toLowerCase().includes(searchText)) ||
      (chit.description && chit.description.toLowerCase().includes(searchText));
    const matchesStatus =
      !statusFilter || statusFilter === "" || chit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  switch (currentTab) {
    case "Calendar":
      if (currentView === "Week") displayWeekView(filteredChits);
      else if (currentView === "Month") displayMonthView(filteredChits);
      else if (currentView === "Itinerary") displayItineraryView(filteredChits);
      else if (currentView === "Day") displayDayView(filteredChits);
      else if (currentView === "Year") displayYearView(filteredChits);
      else if (currentView === "SevenDay") displaySevenDayView(filteredChits);
      else
        listContainer.innerHTML = `<p>${currentView} view not implemented yet.</p>`;
      break;
    case "Checklists":
      displayChecklistView(filteredChits);
      break;
    case "Tasks":
      displayTasksView(filteredChits);
      break;
    case "Notes":
      displayNotesView(filteredChits);
      break;
    case "Alarms":
      listContainer.innerHTML = `<p>Alarms view not implemented yet.</p>`;
      break;
    case "Projects":
      listContainer.innerHTML = `<p>Projects view not implemented yet.</p>`;
      break;
    default:
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
  }
}

function displayWeekView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const weekView = document.createElement("div");
  weekView.className = "week-view";
  weekView.style.display = "flex";
  weekView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.width = "60px";
  hourColumn.style.flexShrink = "0";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  weekView.appendChild(hourColumn);

  const dayColumnsContainer = document.createElement("div");
  dayColumnsContainer.style.display = "flex";
  dayColumnsContainer.style.order = "2";
  dayColumnsContainer.style.flex = "1";
  dayColumnsContainer.style.width = "calc(100% - 60px)";

  const weekStart = new Date(currentWeekStart);
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.flex = "1";
    dayColumn.style.minWidth = "0";
    dayColumn.style.position = "relative";

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = formatDate(day);
    dayColumn.appendChild(dayHeader);

    const allDaySection = document.createElement("div");
    allDaySection.className = "all-day-section";
    dayColumn.appendChild(allDaySection);

    // Include chits with start_datetime or due_datetime on this day
    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch =
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === day.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch =
        dueDateObj && dueDateObj.toDateString() === day.toDateString();
      return startDateMatch || dueDateMatch;
    });

    dayChits.forEach((chit) => {
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          allDayEvent.classList.add("completed-task");
        }

        const titlePrefix = chit.due_datetime ? "✅ " : "";
        allDayEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${titlePrefix}${chit.title}</span>`;
        allDayEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          timedEvent.classList.add("completed-task");
        }

        let chitStart = chit.start_datetime_obj;
        let chitEnd = chit.end_datetime_obj;

        // If no start_datetime but has due_datetime, treat due_datetime as start and end +30 mins
        if (!chitStart && chit.due_datetime) {
          chitStart = new Date(chit.due_datetime);
          chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000);
        }

        const startHour = chitStart.getHours();
        const startMinute = chitStart.getMinutes();
        const endHour = chitEnd.getHours();
        const endMinute = chitEnd.getMinutes();
        const top = startHour * 60 + startMinute;
        const height = endHour * 60 + endMinute - top;

        timedEvent.style.top = `${top}px`;
        timedEvent.style.height = `${height}px`;
        timedEvent.style.backgroundColor = chit.color || "#C66B6B";
        timedEvent.style.width = "calc(100% - 4px)";
        timedEvent.style.boxSizing = "border-box";

        const titlePrefix = chit.due_datetime ? "✅ " : "";
        timedEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${titlePrefix}${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
        timedEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        dayColumn.appendChild(timedEvent);
      }
    });

    dayColumnsContainer.appendChild(dayColumn);
  }

  weekView.appendChild(dayColumnsContainer);
  chitList.appendChild(weekView);

  scrollToSixAM();
  renderTimeBar("Week");
}

function displayMonthView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const monthView = document.createElement("div");
  monthView.className = "month-view";

  const currentMonth = getMonthStart(new Date(currentWeekStart));
  const monthStart = new Date(currentMonth);
  const monthEnd = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  );
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const monthHeader = document.createElement("div");
  monthHeader.className = "month-header";
  monthHeader.textContent = `${currentMonth.toLocaleString("default", { month: "long" })} ${currentMonth.getFullYear()}`;
  monthView.appendChild(monthHeader);

  const dayHeaders = document.createElement("div");
  dayHeaders.className = "day-headers";
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  daysOfWeek.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = day;
    dayHeaders.appendChild(dayHeader);
  });
  monthView.appendChild(dayHeaders);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "month-day empty";
    monthGrid.appendChild(emptyDay);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const monthDay = document.createElement("div");
    monthDay.className = "month-day";
    monthDay.innerHTML = `<div class="day-number">${day}</div>`;

    // Include chits with start_datetime or due_datetime on this day
    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch =
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === dayDate.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch =
        dueDateObj && dueDateObj.toDateString() === dayDate.toDateString();
      return startDateMatch || dueDateMatch;
    });

    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.style.backgroundColor = chit.color || "#C66B6B";
        chitElement.style.cursor = "pointer";

        // Fade completed tasks
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          chitElement.classList.add("completed-task");
        }

        const titlePrefix = chit.due_datetime ? "✅ " : "";
        chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em; text-decoration: none; color: inherit;">${titlePrefix}${chit.title}</span>`;
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }

    monthGrid.appendChild(monthDay);
  }

  monthView.appendChild(monthGrid);
  chitList.appendChild(monthView);
}

function displayItineraryView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const itineraryView = document.createElement("div");
  itineraryView.className = "itinerary-view";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureChits = chitsToDisplay
    .filter(
      (chit) => chit.start_datetime_obj && chit.start_datetime_obj >= today,
    )
    .sort((a, b) => a.start_datetime_obj - b.start_datetime_obj);

  if (futureChits.length === 0) {
    itineraryView.innerHTML = "<p>No upcoming events found.</p>";
  } else {
    let currentDay = null;
    futureChits.forEach((chit) => {
      const chitDate = new Date(chit.start_datetime_obj);
      chitDate.setHours(0, 0, 0, 0);

      if (!currentDay || chitDate.getTime() !== currentDay.getTime()) {
        currentDay = chitDate;
        const daySeparator = document.createElement("div");
        daySeparator.className = "day-separator";
        daySeparator.innerHTML = `<hr><h3>${formatDate(chitDate)}</h3>`;
        itineraryView.appendChild(daySeparator);
      }

      const chitElement = document.createElement("div");
      chitElement.className = "itinerary-event";
      chitElement.style.display = "flex";
      chitElement.style.justifyContent = "flex-start";
      chitElement.style.padding = "10px";
      chitElement.style.backgroundColor = chit.color || "#C66B6B";
      chitElement.style.marginBottom = "5px";
      chitElement.style.borderRadius = "5px";
      chitElement.style.marginLeft = "100px";

      // Fade completed tasks
      if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
        chitElement.classList.add("completed-task");
      }

      const timeColumn = document.createElement("div");
      timeColumn.className = "time-column";
      timeColumn.style.width = "100px";
      timeColumn.style.marginRight = "15px";
      const chitStart = chit.start_datetime_obj;
      const chitEnd =
        chit.end_datetime_obj || new Date(chitStart.getTime() + 60 * 60 * 1000);
      timeColumn.innerHTML = `${formatTime(chitStart)} - ${formatTime(chitEnd)}`;

      const detailsColumn = document.createElement("div");
      detailsColumn.className = "details-column";
      detailsColumn.style.textAlign = "center";
      detailsColumn.style.flex = "1";

      const titlePrefix = chit.due_datetime ? "✅ " : "";
      detailsColumn.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${titlePrefix}${chit.title}</span>`;

      chitElement.appendChild(timeColumn);
      chitElement.appendChild(detailsColumn);
      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      itineraryView.appendChild(chitElement);
    });
  }

  chitList.appendChild(itineraryView);

  renderTimeBar("Itinerary");
}

function displayDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-header";
  dayHeader.style.textAlign = "center";
  dayHeader.style.marginBottom = "10px";
  dayHeader.textContent = formatDate(currentWeekStart);
  chitList.appendChild(dayHeader);

  const dayView = document.createElement("div");
  dayView.className = "day-view";
  dayView.style.display = "flex";
  dayView.style.position = "relative";
  dayView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.position = "sticky";
  hourColumn.style.left = "0";
  hourColumn.style.zIndex = "1";
  hourColumn.style.backgroundColor = "#fff5e6";
  hourColumn.style.width = "80px";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  dayView.appendChild(hourColumn);

  const eventsContainer = document.createElement("div");
  eventsContainer.style.order = "2";
  eventsContainer.style.position = "relative";
  eventsContainer.style.flex = "1";
  eventsContainer.style.marginLeft = "15px";
  eventsContainer.style.width = "calc(100% - 95px)";

  // Include chits with start_datetime or due_datetime on this day
  const dayChits = chitsToDisplay.filter((chit) => {
    const startDateMatch =
      chit.start_datetime_obj &&
      chit.start_datetime_obj.toDateString() ===
        currentWeekStart.toDateString();
    const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
    const dueDateMatch =
      dueDateObj &&
      dueDateObj.toDateString() === currentWeekStart.toDateString();
    return startDateMatch || dueDateMatch;
  });

  const timeSlots = {};

  dayChits.forEach((chit) => {
    let chitStart = chit.start_datetime_obj;
    let chitEnd = chit.end_datetime_obj;

    // If no start_datetime but has due_datetime, treat due_datetime as start and end with +30 mins
    if (!chitStart && chit.due_datetime) {
      chitStart = new Date(chit.due_datetime);
      chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000); // 30 minutes later
    }

    const startHour = chitStart.getHours();
    const startMinute = chitStart.getMinutes();
    const startTime = startHour * 60 + startMinute;
    const endHour = chitEnd.getHours();
    const endMinute = chitEnd.getMinutes();
    const endTime = endHour * 60 + endMinute;

    for (let t = startTime; t < endTime; t++) {
      if (!timeSlots[t]) timeSlots[t] = [];
    }

    let position = 0;
    while (true) {
      let collision = false;
      for (let t = startTime; t < endTime; t++) {
        if (timeSlots[t].includes(position)) {
          collision = true;
          break;
        }
      }
      if (!collision) break;
      position++;
    }

    for (let t = startTime; t < endTime; t++) {
      timeSlots[t].push(position);
    }

    const chitElement = document.createElement("div");
    chitElement.className = "day-event";
    const height = endTime - startTime;
    const maxOverlap = Math.max(
      ...Object.values(timeSlots).map((slot) => slot.length),
    );
    const widthPercentage = 95 / maxOverlap;

    chitElement.style.top = `${startTime}px`;
    chitElement.style.height = `${height}px`;
    chitElement.style.left = `${position * widthPercentage}%`;
    chitElement.style.width = `${widthPercentage - 1}%`;
    chitElement.style.position = "absolute";
    chitElement.style.backgroundColor = chit.color || "#C66B6B";
    chitElement.style.boxSizing = "border-box";

    // Fade completed tasks
    if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
      chitElement.classList.add("completed-task");
    }

    const titlePrefix = chit.due_datetime ? "✅ " : "";

    chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${titlePrefix}${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    eventsContainer.appendChild(chitElement);
  });

  dayView.appendChild(eventsContainer);
  chitList.appendChild(dayView);

  scrollToSixAM();
  renderTimeBar("Day");
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
    monthBlock.style.flex = "1 0 25%";
    monthBlock.style.padding = "10px";
    monthBlock.style.boxSizing = "border-box";
    monthBlock.style.minWidth = "200px";

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

    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "day empty";
      monthGrid.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(currentYear, idx, day);
      const dayElement = document.createElement("div");
      dayElement.className = "day";
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
        document.getElementById("view-select").value = "Day";
        updateDateRange();
        displayChits();
      });
      monthGrid.appendChild(dayElement);
    }

    monthBlock.appendChild(monthGrid);
    yearView.appendChild(monthBlock);
  });

  chitList.appendChild(yearView);
}

function displayChecklistView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const checklistView = document.createElement("div");
  checklistView.className = "checklist-view";

  const sortedChits = [...chitsToDisplay].sort((a, b) => {
    const dateA = new Date(
      a.last_edited || a.created_datetime || a.start_datetime || 0,
    );
    const dateB = new Date(
      b.last_edited || b.created_datetime || b.start_datetime || 0,
    );
    return dateB - dateA;
  });

  if (sortedChits.length === 0)
    checklistView.innerHTML = "<p>No chits found.</p>";
  else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit";

      const titlePrefix = chit.due_datetime ? "✅ " : "";
      chitElement.innerHTML = `<h3><a href="/editor?id=${chit.id}">${titlePrefix}${chit.title}</a></h3>`;

      if (
        chit.checklist &&
        Array.isArray(chit.checklist) &&
        chit.checklist.length > 0
      ) {
        const checklist = document.createElement("ul");
        chit.checklist.forEach((item) => {
          if (item && typeof item === "object" && item.text) {
            const listItem = document.createElement("li");
            listItem.textContent = item.text;
            // Schema uses 'checked'; guard against legacy 'done' field
            if (item.checked === true || item.done === true)
              listItem.style.textDecoration = "line-through";
            checklist.appendChild(listItem);
          }
        });
        chitElement.appendChild(checklist);
      }
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);
}

function displayTasksView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  // Replace week-nav with sorting dropdown only if in Tasks tab
  const weekNav = document.getElementById("week-nav");
  if (weekNav) {
    // Save original week-nav HTML if not already saved
    if (!weekNav.dataset.originalHtml) {
      weekNav.dataset.originalHtml = weekNav.innerHTML;
    }
    weekNav.innerHTML = ""; // Clear existing content

    const sortLabel = document.createElement("label");
    sortLabel.htmlFor = "task-sort";
    sortLabel.textContent = "Sort by: ";
    sortLabel.style.marginRight = "8px";

    const sortSelect = document.createElement("select");
    sortSelect.id = "task-sort";

    const sortOptions = [
      { value: "dueNext", text: "Due next" },
      { value: "dueLast", text: "Due last" },
      { value: "alphaAsc", text: "Alphabetical (asc)" },
      { value: "alphaDesc", text: "Alphabetical (desc)" },
      { value: "status", text: "Status" },
    ];

    sortOptions.forEach(({ value, text }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      sortSelect.appendChild(option);
    });

    weekNav.appendChild(sortLabel);
    weekNav.appendChild(sortSelect);

    // Filter tasks that have status or due date
    let taskChits = chitsToDisplay.filter(
      (chit) => chit.status || chit.due_datetime,
    );

    // Sorting function
    function sortTasks(tasks, criterion) {
      const sorted = [...tasks];
      switch (criterion) {
        case "dueNext":
          sorted.sort((a, b) => {
            if (!a.due_datetime) return 1;
            if (!b.due_datetime) return -1;
            return new Date(a.due_datetime) - new Date(b.due_datetime);
          });
          break;
        case "dueLast":
          sorted.sort((a, b) => {
            if (!a.due_datetime) return 1;
            if (!b.due_datetime) return -1;
            return new Date(b.due_datetime) - new Date(a.due_datetime);
          });
          break;
        case "alphaAsc":
          sorted.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "alphaDesc":
          sorted.sort((a, b) => b.title.localeCompare(a.title));
          break;
        case "status":
          const statusOrder = {
            ToDo: 1,
            "In Progress": 2,
            Blocked: 3,
            Complete: 4,
            null: 5,
            undefined: 5,
            "": 5,
          };
          sorted.sort((a, b) => {
            return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
          });
          break;
      }
      return sorted;
    }

    // Initial sort by dueNext
    let sortedTasks = sortTasks(taskChits, "dueNext");

    // Render tasks function
    function renderTasks(tasks) {
      chitList.innerHTML = ""; // Clear before rendering
      if (tasks.length === 0) {
        chitList.innerHTML = "<p>No tasks found.</p>";
        return;
      }
      tasks.forEach((chit) => {
        const chitElement = document.createElement("div");
        chitElement.className = "chit";
        chitElement.style.display = "flex";
        chitElement.style.alignItems = "center";

        // Add faded style if completed task
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          chitElement.classList.add("completed-task");
        }

        const statusDropdown = document.createElement("select");
        statusDropdown.style.marginRight = "10px";

        // No null status option here (per requirement)
        const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];
        statuses.forEach((status) => {
          const option = document.createElement("option");
          option.value = status;
          option.textContent = status;
          if (chit.status === status) option.selected = true;
          statusDropdown.appendChild(option);
        });

        if (!chit.status) {
          statusDropdown.value = "";
        }

        statusDropdown.addEventListener("change", () => {
          const updatedChit = { ...chit, status: statusDropdown.value || null };
          fetch(`/api/chits/${chit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedChit),
          })
            .then((response) => {
              if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
              fetchChits();
            })
            .catch((err) => {
              console.error("Error updating status:", err);
              alert("Failed to update status.");
            });
        });

        const chitDetails = document.createElement("div");
        chitDetails.innerHTML = `<h3><a href="/editor?id=${chit.id}">${chit.title}</a></h3>`;
        chitDetails.innerHTML += `<p>Status: ${chit.status || "-"}</p>`;
        if (chit.due_datetime) {
          chitDetails.innerHTML += `<p>Due: ${formatDate(new Date(chit.due_datetime))}</p>`;
        }

        chitElement.appendChild(statusDropdown);
        chitElement.appendChild(chitDetails);

        // Enable double-click to open chit editor even if completed
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });

        chitList.appendChild(chitElement);
      });
    }

    // Initial render
    renderTasks(sortedTasks);

    // On sort change, re-sort and re-render
    sortSelect.addEventListener("change", () => {
      sortedTasks = sortTasks(taskChits, sortSelect.value);
      renderTasks(sortedTasks);
    });
  } else {
    // Fallback if weekNav not found, just render tasks normally

    const tasksView = document.createElement("div");
    tasksView.className = "checklist-view";

    const taskChits = chitsToDisplay.filter(
      (chit) => chit.status || chit.due_datetime,
    );

    if (taskChits.length === 0) {
      tasksView.innerHTML = "<p>No tasks found.</p>";
    } else {
      taskChits.forEach((chit) => {
        const chitElement = document.createElement("div");
        chitElement.className = "chit";
        chitElement.style.display = "flex";
        chitElement.style.alignItems = "center";

        // Add faded style if completed task
        if ((chit.due_datetime || chit.status) && chit.status === "Complete") {
          chitElement.classList.add("completed-task");
        }

        const statusDropdown = document.createElement("select");
        statusDropdown.style.marginRight = "10px";

        const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];
        statuses.forEach((status) => {
          const option = document.createElement("option");
          option.value = status;
          option.textContent = status;
          if (chit.status === status) option.selected = true;
          statusDropdown.appendChild(option);
        });

        if (!chit.status) {
          statusDropdown.value = "";
        }

        statusDropdown.addEventListener("change", () => {
          const updatedChit = { ...chit, status: statusDropdown.value || null };
          fetch(`/api/chits/${chit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedChit),
          })
            .then((response) => {
              if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
              fetchChits();
            })
            .catch((err) => {
              console.error("Error updating status:", err);
              alert("Failed to update status.");
            });
        });

        const chitDetails = document.createElement("div");
        chitDetails.innerHTML = `<h3><a href="/editor?id=${chit.id}">${chit.title}</a></h3>`;
        chitDetails.innerHTML += `<p>Status: ${chit.status || "-"}</p>`;
        if (chit.due_datetime) {
          chitDetails.innerHTML += `<p>Due: ${formatDate(new Date(chit.due_datetime))}</p>`;
        }

        chitElement.appendChild(statusDropdown);
        chitElement.appendChild(chitDetails);

        // Enable double-click to open chit editor even if completed
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });

        tasksView.appendChild(chitElement);
      });
    }
    chitList.appendChild(tasksView);
  }
}

function displayNotesView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const notesView = document.createElement("div");
  notesView.className = "notes-view";
  notesView.style.padding = "0.5em";
  notesView.style.overflowY = "auto";

  const sortedChits = [...chitsToDisplay]
    .filter((chit) => chit.note && chit.note.trim() !== "")
    .sort((a, b) => {
      const dateA = new Date(
        a.last_edited || a.created_datetime || a.start_datetime || 0,
      );
      const dateB = new Date(
        b.last_edited || b.created_datetime || b.start_datetime || 0,
      );
      return dateB - dateA;
    });

  if (sortedChits.length === 0) {
    notesView.innerHTML = "<p>No notes found.</p>";
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "note-chit";
      chitElement.style.margin = "0";
      chitElement.style.padding = "0.5em";
      chitElement.style.backgroundColor = chit.color || "#fffaf0";

      const titlePrefix = chit.due_datetime ? "✅ " : "";

      const titleEl = document.createElement("h3");
      titleEl.textContent = `${titlePrefix}${chit.title}`;
      chitElement.appendChild(titleEl);

      // Use a <pre> so newlines and whitespace are preserved exactly as stored
      const noteEl = document.createElement("pre");
      noteEl.style.whiteSpace = "pre-wrap";
      noteEl.style.fontFamily = "inherit";
      noteEl.style.margin = "0.25em 0";
      noteEl.textContent = chit.note;
      chitElement.appendChild(noteEl);

      const labelsContainer = document.createElement("div");
      labelsContainer.className = "labels";
      // Use chit.tags (canonical field name; guard against legacy chit.labels)
      const tagList = chit.tags || chit.labels || [];
      if (Array.isArray(tagList) && tagList.length > 0) {
        tagList.forEach((tag) => {
          const labelElement = document.createElement("span");
          labelElement.className = "label";
          labelElement.style.backgroundColor = getPastelColor(tag);
          labelElement.textContent = tag;
          labelsContainer.appendChild(labelElement);
        });
      }
      chitElement.appendChild(labelsContainer);

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      notesView.appendChild(chitElement);
    });
  }
  chitList.appendChild(notesView);
}

/**
 * Scroll the time-based view so 6:00am is the first visible slot.
 * Uses setTimeout(0) to ensure the DOM is fully painted before scrolling.
 */
function scrollToSixAM() {
  setTimeout(() => {
    const scrollable =
      document.querySelector(".week-view") ||
      document.querySelector(".day-view");
    if (scrollable) {
      scrollable.scrollTop = 360;
    }
  }, 50);
}

/**
 * Render and maintain a "current time" bar in time-based views.
 * Only shows in today's column. Updates every minute.
 */
let _timeBarInterval = null;

function renderTimeBar(viewType) {
  // Clear any existing interval
  if (_timeBarInterval) {
    clearInterval(_timeBarInterval);
    _timeBarInterval = null;
  }

  function placeBar() {
    // Remove any existing bars
    document.querySelectorAll(".current-time-bar").forEach((el) => el.remove());

    const now = new Date();
    const todayStr = now.toDateString();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();

    if (viewType === "Day") {
      // Day view: events container is position:relative, events use top = minuteOfDay
      const eventsContainer = document.querySelector(".day-view > div:last-child");
      if (!eventsContainer) return;
      const bar = document.createElement("div");
      bar.className = "current-time-bar";
      bar.style.cssText = `position:absolute;left:0;right:0;top:${minuteOfDay}px;height:2px;background:#e63946;z-index:10;pointer-events:none;`;
      const dot = document.createElement("div");
      dot.style.cssText = `position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:#e63946;`;
      bar.appendChild(dot);
      eventsContainer.appendChild(bar);
    } else if (viewType === "Week" || viewType === "SevenDay") {
      // Find today's column and measure actual header + all-day section height
      const dayColumns = document.querySelectorAll(".day-column");
      dayColumns.forEach((col) => {
        const headerEl = col.querySelector(".day-header");
        const headerText = headerEl?.textContent || "";
        const parts = headerText.trim().split(/\s+/);
        if (parts.length >= 3) {
          const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const monthIdx = monthNames.indexOf(parts[0]);
          const day = parseInt(parts[1]);
          const year = new Date().getFullYear();
          if (monthIdx !== -1 && !isNaN(day)) {
            const colDate = new Date(year, monthIdx, day);
            if (colDate.toDateString() === todayStr) {
              // Measure actual offset at runtime
              const headerH = headerEl ? headerEl.offsetHeight : 0;
              const allDayEl = col.querySelector(".all-day-section");
              const allDayH = allDayEl ? allDayEl.offsetHeight : 0;
              const offset = headerH + allDayH;

              col.style.position = "relative";
              const bar = document.createElement("div");
              bar.className = "current-time-bar";
              bar.style.cssText = `position:absolute;left:0;right:0;top:${minuteOfDay + offset}px;height:2px;background:#e63946;z-index:10;pointer-events:none;`;
              const dot = document.createElement("div");
              dot.style.cssText = `position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:#e63946;`;
              bar.appendChild(dot);
              col.appendChild(bar);
            }
          }
        }
      });
    } else if (viewType === "Itinerary") {
      // In itinerary, show a horizontal rule at "now" between past and future events
      const itineraryView = document.querySelector(".itinerary-view");
      if (!itineraryView) return;
      const bar = document.createElement("div");
      bar.className = "current-time-bar";
      bar.style.cssText = `width:100%;height:2px;background:#e63946;margin:4px 0;position:relative;`;
      const label = document.createElement("span");
      label.style.cssText = `position:absolute;left:0;top:-10px;font-size:0.75em;color:#e63946;font-weight:bold;`;
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
function displaySevenDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const weekView = document.createElement("div");
  weekView.className = "week-view";
  weekView.style.display = "flex";
  weekView.style.width = "100%";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.order = "1";
  hourColumn.style.width = "60px";
  hourColumn.style.flexShrink = "0";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  weekView.appendChild(hourColumn);

  const dayColumnsContainer = document.createElement("div");
  dayColumnsContainer.style.display = "flex";
  dayColumnsContainer.style.order = "2";
  dayColumnsContainer.style.flex = "1";
  dayColumnsContainer.style.width = "calc(100% - 60px)";

  // Always start from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.flex = "1";
    dayColumn.style.minWidth = "0";
    dayColumn.style.position = "relative";

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = formatDate(day);
    dayColumn.appendChild(dayHeader);

    const allDaySection = document.createElement("div");
    allDaySection.className = "all-day-section";
    dayColumn.appendChild(allDaySection);

    const dayChits = chitsToDisplay.filter((chit) => {
      const startDateMatch = chit.start_datetime_obj && chit.start_datetime_obj.toDateString() === day.toDateString();
      const dueDateObj = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const dueDateMatch = dueDateObj && dueDateObj.toDateString() === day.toDateString();
      return startDateMatch || dueDateMatch;
    });

    dayChits.forEach((chit) => {
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event";
        if (chit.status === "Complete") allDayEvent.classList.add("completed-task");
        const titlePrefix = chit.due_datetime ? "✅ " : "";
        allDayEvent.innerHTML = `<span style="font-weight:bold;font-size:1.1em;">${titlePrefix}${chit.title}</span>`;
        allDayEvent.addEventListener("dblclick", () => { storePreviousState(); window.location.href = `/editor?id=${chit.id}`; });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event";
        if (chit.status === "Complete") timedEvent.classList.add("completed-task");

        let chitStart = chit.start_datetime_obj;
        let chitEnd = chit.end_datetime_obj;
        if (!chitStart && chit.due_datetime) {
          chitStart = new Date(chit.due_datetime);
          chitEnd = new Date(chitStart.getTime() + 30 * 60 * 1000);
        }

        const top = chitStart.getHours() * 60 + chitStart.getMinutes();
        const height = (chitEnd.getHours() * 60 + chitEnd.getMinutes()) - top;
        timedEvent.style.top = `${top}px`;
        timedEvent.style.height = `${height}px`;
        timedEvent.style.backgroundColor = chit.color || "#C66B6B";
        timedEvent.style.width = "calc(100% - 4px)";
        timedEvent.style.boxSizing = "border-box";

        const titlePrefix = chit.due_datetime ? "✅ " : "";
        timedEvent.innerHTML = `<span style="font-weight:bold;font-size:1.1em;">${titlePrefix}${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
        timedEvent.addEventListener("dblclick", () => { storePreviousState(); window.location.href = `/editor?id=${chit.id}`; });
        dayColumn.appendChild(timedEvent);
      }
    });

    dayColumnsContainer.appendChild(dayColumn);
  }

  weekView.appendChild(dayColumnsContainer);
  chitList.appendChild(weekView);

  scrollToSixAM();
  renderTimeBar("SevenDay");
}

function filterChits(tab) {
  storePreviousState();

  // Restore week-nav if switching away from Tasks
  if (currentTab === "Tasks" && tab !== "Tasks") {
    const weekNav = document.getElementById("week-nav");
    if (weekNav && weekNav.dataset.originalHtml) {
      weekNav.innerHTML = weekNav.dataset.originalHtml;
      delete weekNav.dataset.originalHtml;
    }
  }

  currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="filterChits('${tab}')"]`)
    .classList.add("active");

  updateStatusFilterOptions();

  updateDateRange();
  displayChits();
}

function searchChits() {
  const query = document.getElementById("search").value.toLowerCase();
  const filteredChits = chits.filter(
    (chit) =>
      chit.title.toLowerCase().includes(query) ||
      (chit.note && chit.note.toLowerCase().includes(query)) ||
      (chit.labels &&
        chit.labels.some((label) => label.toLowerCase().includes(query))),
  );
  displayChits(filteredChits);
}

function filterByStatus() {
  const status = document.getElementById("status-filter").value;
  const filteredChits =
    status === "" ? chits : chits.filter((chit) => chit.status === status);
  displayChits(filteredChits);
}

function changeView() {
  storePreviousState();
  currentView = document.getElementById("view-select").value;
  updateDateRange();
  displayChits();
}

function toggleAllDay() {
  const allDay = document.getElementById("all_day").checked;
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  if (allDay) {
    startTime.dataset.previousValue = startTime.value;
    endTime.dataset.previousValue = endTime.value;
    startTime.style.display = "none";
    endTime.style.display = "none";
    startTime.value = "";
    endTime.value = "";
  } else {
    startTime.style.display = "";
    endTime.style.display = "";
    if (startTime.dataset.previousValue)
      startTime.value = startTime.dataset.previousValue;
    if (endTime.dataset.previousValue)
      endTime.value = endTime.dataset.previousValue;
  }
}

function setColor(color, name) {
  document.getElementById("color").value = color;
  document.getElementById("selected-color").textContent = name;
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

const userTimezoneOffset = new Date().getTimezoneOffset();
console.log(`User timezone offset: ${userTimezoneOffset} minutes`);

const chitId = new URLSearchParams(window.location.search).get("id");
if (chitId) {
  fetch(`/api/chits/${chitId}`)
    .then((response) => response.json())
    .then((chit) => {
      document.getElementById("pinned").checked = chit.pinned || false;
      document.getElementById("title").value = chit.title || "";
      document.getElementById("note").value = chit.note || "";
      document.getElementById("labels").value = (chit.labels || []).join(", ");
      document.getElementById("all_day").checked = chit.all_day || false;

      if (chit.start_datetime) {
        document.getElementById("start_datetime").value =
          convertDBDateToDisplayDate(chit.start_datetime);
        if (!chit.all_day)
          document.getElementById("start_time").value = parseISOTime(
            chit.start_datetime,
          );
      }
      if (chit.end_datetime) {
        document.getElementById("end_datetime").value =
          convertDBDateToDisplayDate(chit.end_datetime);
        if (!chit.all_day)
          document.getElementById("end_time").value = parseISOTime(
            chit.end_datetime,
          );
      }
      if (chit.due_datetime) {
        document.getElementById("due_datetime").value =
          convertDBDateToDisplayDate(chit.due_datetime);
        document.getElementById("due_time").value = parseISOTime(
          chit.due_datetime,
        );
      }

      toggleAllDay();

      document.getElementById("status").value = chit.status || "";
      document.getElementById("priority").value = chit.priority || "Medium";
      document.getElementById("checklist").value = chit.checklist
        ? JSON.stringify(chit.checklist)
        : "";
      document.getElementById("alarm").checked = chit.alarm || false;
      document.getElementById("notification").checked =
        chit.notification || false;
      document.getElementById("recurrence").value = chit.recurrence || "";
      document.getElementById("location").value = chit.location || "";
      document.getElementById("color").value = chit.color || "#C66B6B";
      document.getElementById("selected-color").textContent = chit.color
        ? chit.color === "#C66B6B"
          ? "Dusty Rose"
          : chit.color === "#D68A59"
            ? "Burnt Sienna"
            : chit.color === "#E3B23C"
              ? "Golden Ochre"
              : chit.color === "#8A9A5B"
                ? "Mossy Sage"
                : chit.color === "#6B8299"
                  ? "Slate Teal"
                  : "Muted Lilac"
        : "Dusty Rose";
      document.getElementById("people").value = (chit.people || []).join(", ");
      document.getElementById("archived").checked = chit.archived || false;
    })
    .catch((err) => {
      console.error("Error loading chit:", err);
      alert("Failed to load chit. Check console for details.");
    });
}

function deleteChit() {
  if (!chitId) {
    alert("No chit to delete.");
    return;
  }
  if (!confirm("Are you sure you want to delete this chit?")) return;
  fetch(`/api/chits/${chitId}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(() => {
      currentTab = previousState.tab;
      currentView = previousState.view;
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelector(
          `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
        )
        .classList.add("active");
      document.getElementById("view-select").value = currentView;
      fetchChits();
    })
    .catch((err) => {
      console.error("Error deleting chit:", err);
      alert("Failed to delete chit. Check console for details.");
    });
}

function cancelEdit() {
  currentTab = previousState.tab;
  currentView = previousState.view;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(
      `.tab:nth-child(${["Calendar", "Checklists", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
    )
    .classList.add("active");
  document.getElementById("view-select").value = currentView;
  fetchChits();
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded, initializing...");
  currentTab = "Calendar"; // default tab
  updateStatusFilterOptions();
  fetchChits();
  updateDateRange();
  restoreSidebarState();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const startDateTime = document.getElementById("start_datetime");
  const startTime = document.getElementById("start_time");
  const endDateTime = document.getElementById("end_datetime");
  const endTime = document.getElementById("end_time");

  if (startDateTime) startDateTime.value = formatDate(now);
  if (startTime) startTime.value = formatTime(now);
  if (endDateTime) endDateTime.value = formatDate(now);
  if (endTime) endTime.value = formatTime(oneHourLater);

  flatpickr("#start_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#start_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
    onChange: function (selectedDates, dateStr, instance) {
      const startTime = new Date(`1970-01-01T${dateStr}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const endTimeInput = document.getElementById("end_time");
      if (
        !endTimeInput._flatpickr.selectedDates.length &&
        !document.getElementById("all_day").checked
      ) {
        endTimeInput._flatpickr.setDate(formatTime(endTime));
      }
    },
  });
  flatpickr("#end_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#end_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });
  flatpickr("#due_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#due_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });

  window.addEventListener("resize", () => {
    if (currentTab === "Notes") {
      displayChits();
    }
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  // Don't fire when user is typing in any input/textarea/select/contenteditable
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || tag === "select"
      || document.activeElement?.isContentEditable;
    if (isTyping) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const tabOrder = ["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"];
    const viewMap = {
      i: "Itinerary",
      d: "Day",
      w: "Week",
      m: "Month",
      y: "Year",
      s: "SevenDay",
    };

    const key = e.key.toLowerCase();

    // 1-6: switch tabs
    if (key >= "1" && key <= "6") {
      const idx = parseInt(key) - 1;
      if (idx < tabOrder.length) filterChits(tabOrder[idx]);
      return;
    }

    // I/D/W/M/Y/S: switch calendar views (only meaningful in Calendar tab)
    if (viewMap[key] && currentTab === "Calendar") {
      const newView = viewMap[key];
      currentView = newView;
      const viewSelect = document.getElementById("view-select");
      if (viewSelect) viewSelect.value = newView;
      // SevenDay always starts from today
      if (newView === "SevenDay") currentWeekStart = new Date();
      updateDateRange();
      displayChits();
    }
  });
});
