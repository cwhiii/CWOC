// Main application functionality
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
  const year = start.getFullYear();
  return `${startStr} - ${endStr}, ${year}`;
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
  if (!rangeElement) {
    console.error("Week range element not found");
    return;
  }
  if (!currentWeekStart) {
    currentWeekStart = getWeekStart(new Date());
  }
  if (currentView === "Day") {
    rangeElement.textContent = formatDate(currentWeekStart);
  } else if (currentView === "Week") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    rangeElement.textContent = formatWeekRange(start, end);
  } else if (currentView === "Month") {
    const monthStart = getMonthStart(currentWeekStart);
    rangeElement.textContent = `${monthStart.toLocaleString("default", { month: "long" })} ${monthStart.getFullYear()}`;
  } else if (currentView === "Year") {
    const yearStart = getYearStart(currentWeekStart);
    rangeElement.textContent = `${yearStart.getFullYear()}`;
  } else {
    rangeElement.textContent = "";
  }
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

  if (currentTab === "Calendar") {
    if (currentView === "Week") displayWeekView(filteredChits);
    else if (currentView === "Month") displayMonthView(filteredChits);
    else if (currentView === "Itinerary") displayItineraryView(filteredChits);
    else if (currentView === "Day") displayDayView(filteredChits);
    else if (currentView === "Year") displayYearView(filteredChits);
    else
      listContainer.innerHTML = `<p>${currentView} view not implemented yet.</p>`;
  } else if (currentTab === "Checklists") displayChecklistView(filteredChits);
  else if (currentTab === "Tasks") displayTasksView(filteredChits);
  else
    listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
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

    const dayChits = chitsToDisplay.filter(
      (chit) =>
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === day.toDateString(),
    );

    dayChits.forEach((chit) => {
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event";
        allDayEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span>`;
        allDayEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event";
        const chitStart = chit.start_datetime_obj;
        const chitEnd =
          chit.end_datetime_obj ||
          new Date(chitStart.getTime() + 60 * 60 * 1000);
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
        timedEvent.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
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

    const dayChits = chitsToDisplay.filter((chit) => {
      if (!chit.start_datetime_obj) return false;
      const chitDate = new Date(chit.start_datetime_obj);
      return (
        chitDate.getDate() === day &&
        chitDate.getMonth() === currentMonth.getMonth() &&
        chitDate.getFullYear() === currentMonth.getFullYear()
      );
    });

    if (dayChits.length > 0) {
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";
      dayChits.forEach((chit) => {
        const chitElement = document.createElement("div");
        chitElement.className = "month-event";
        chitElement.style.backgroundColor = chit.color || "#C66B6B";
        chitElement.style.cursor = "pointer";
        chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em; text-decoration: none; color: inherit;">${chit.title}</span>`;
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
      detailsColumn.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span>`;

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
  hourColumn.style.backgroundColor = "#fff";
  hourColumn.style.width = "80px";
  for (let hour = 0; hour < 24; hour++) {
    const hourBlock = document.createElement("div");
    hourBlock.className = "hour-block";
    hourBlock.style.top = `${hour * 60}px`;
    hourBlock.textContent = `${hour}:00`;
    hourColumn.appendChild(hourBlock);
  }
  dayView.appendChild(hourColumn);

  const dayChits = chitsToDisplay.filter(
    (chit) =>
      chit.start_datetime_obj &&
      chit.start_datetime_obj.toDateString() ===
        currentWeekStart.toDateString(),
  );

  const eventsContainer = document.createElement("div");
  eventsContainer.style.order = "2";
  eventsContainer.style.position = "relative";
  eventsContainer.style.flex = "1";
  eventsContainer.style.marginLeft = "15px";
  eventsContainer.style.width = "calc(100% - 95px)";

  const timeSlots = {};

  dayChits.forEach((chit) => {
    const chitStart = chit.start_datetime_obj;
    const chitEnd =
      chit.end_datetime_obj || new Date(chitStart.getTime() + 60 * 60 * 1000);
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
    chitElement.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span><br>${formatTime(chitStart)} - ${formatTime(chitEnd)}`;
    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    eventsContainer.appendChild(chitElement);
  });

  dayView.appendChild(eventsContainer);
  chitList.appendChild(dayView);
}

function displayYearView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const yearView = document.createElement("div");
  yearView.className = "year-view";
  yearView.style.backgroundColor = "#fff";
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

      const dayChits = chitsToDisplay.filter((chit) => {
        if (!chit.start_datetime_obj) return false;
        const chitDate = new Date(chit.start_datetime_obj);
        return (
          chitDate.getDate() === day &&
          chitDate.getMonth() === idx &&
          chitDate.getFullYear() === currentYear
        );
      });
      const chitCount = dayChits.length;
      dayElement.style.backgroundColor =
        chitCount === 0 ? "#fff" : chitCount === 1 ? "#fff5e6" : "#D68A59";

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
      chitElement.innerHTML = `<h3><a href="/editor?id=${chit.id}">${chit.title}</a></h3>`;
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
            if (item.done === true)
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
      statusDropdown.addEventListener("change", () => {
        const updatedChit = { ...chit, status: statusDropdown.value };
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
      if (chit.status) {
        chitDetails.innerHTML += `<p>Status: ${chit.status}</p>`;
      }
      if (chit.due_datetime) {
        chitDetails.innerHTML += `<p>Due: ${formatDate(new Date(chit.due_datetime))}</p>`;
      }

      chitElement.appendChild(statusDropdown);
      chitElement.appendChild(chitDetails);
      tasksView.appendChild(chitElement);
    });
  }
  chitList.appendChild(tasksView);
}

function filterChits(tab) {
  storePreviousState();
  currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(
      `.tab:nth-child(${["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"].indexOf(tab) + 1})`,
    )
    .classList.add("active");
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

function saveChit() {
  console.log("Saving chit...");
  const startDate = document.getElementById("start_datetime").value;
  const startTime = document.getElementById("start_time").value;
  const endDate = document.getElementById("end_datetime").value;
  const endTime = document.getElementById("end_time").value;
  const dueDate = document.getElementById("due_datetime").value;
  const dueTime = document.getElementById("due_time").value;
  const allDay = document.getElementById("all_day").checked;

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

  function createISODateTimeString(dateStr, timeStr, isAllDay, isEnd = false) {
    if (!dateStr) return null;
    const formattedDate = convertMonthFormat(dateStr);
    let dateTimeStr = `${formattedDate}T00:00:00`;
    if (isAllDay)
      dateTimeStr = isEnd
        ? `${formattedDate}T23:59:59`
        : `${formattedDate}T00:00:00`;
    else if (timeStr) dateTimeStr = `${formattedDate}T${timeStr}:00`;
    const localDate = new Date(dateTimeStr);
    return localDate.toISOString();
  }

  const chit = {
    title: document.getElementById("title").value,
    note: document.getElementById("note").value,
    labels: document
      .getElementById("labels")
      .value.split(",")
      .map((label) => label.trim())
      .filter((label) => label),
    all_day: allDay,
    start_datetime: createISODateTimeString(
      startDate,
      allDay ? null : startTime,
      allDay,
    ),
    end_datetime: createISODateTimeString(
      endDate,
      allDay ? null : endTime,
      allDay,
      true,
    ),
    due_datetime: dueDate
      ? createISODateTimeString(dueDate, dueTime, false)
      : null,
    completed_datetime:
      document.getElementById("status").value === "Complete"
        ? new Date().toISOString()
        : null,
    status: document.getElementById("status").value || null,
    priority: document.getElementById("priority").value,
    checklist: document.getElementById("checklist").value
      ? JSON.parse(document.getElementById("checklist").value)
      : null,
    alarm: document.getElementById("alarm").checked,
    notification: document.getElementById("notification").checked,
    recurrence: document.getElementById("recurrence").value || null,
    recurrence_id: chitId
      ? document.getElementById("recurrence").value
        ? chitId
        : null
      : document.getElementById("recurrence").value
        ? crypto.randomUUID()
        : null,
    location: document.getElementById("location").value || null,
    color: document.getElementById("color").value || "#C66B6B",
    people: document
      .getElementById("people")
      .value.split(",")
      .map((person) => person.trim())
      .filter((person) => person),
    pinned: document.getElementById("pinned").checked,
    archived: document.getElementById("archived").checked,
    deleted: false,
  };

  console.log("Chit data:", chit);
  const method = chitId ? "PUT" : "POST";
  const url = chitId ? `/api/chits/${chitId}` : "/api/chits";

  fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chit),
  })
    .then((response) => {
      console.log("Response status:", response.status);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      console.log("Save successful:", data);
      currentTab = previousState.tab;
      currentView = previousState.view;
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelector(
          `.tab:nth-child(${["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
        )
        .classList.add("active");
      document.getElementById("view-select").value = currentView;
      fetchChits();
    })
    .catch((err) => {
      console.error("Error saving chit:", err);
      alert("Failed to save chit. Check console for details.");
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
          `.tab:nth-child(${["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
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
      `.tab:nth-child(${["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"].indexOf(currentTab) + 1})`,
    )
    .classList.add("active");
  document.getElementById("view-select").value = currentView;
  fetchChits();
}

function setupCloudflareScripts() {
  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93cd50711d49b0a0',t:'MTc0Njc1Mjk5Ni4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93cd60d13bf9b0d5',t:'MTc0Njc1MzY2Ni4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93cd5b8c3ce412d5',t:'MTc0Njc1MzQ1MC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93d193294c87b05f',t:'MTc0Njc9NzY3Mi4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93d1c312bfe6678c',t:'MTc0Njc9OTYzNC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93d1f0177d35bfe0',t:'MTc0NjgwMTQ3OC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();

  (function () {
    function c() {
      var b = a.contentDocument || a.contentWindow.document;
      if (b) {
        var d = b.createElement("script");
        d.innerHTML =
          "window.__CF$cv$params={r:'93d1f017ba584527',t:'MTc0NjgwMTQ3OC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
        b.getElementsByTagName("head")[0].appendChild(d);
      }
    }
    if (document.body) {
      var a = document.createElement("iframe");
      a.height = 1;
      a.width = 1;
      a.style.position = "absolute";
      a.style.top = 0;
      a.style.left = 0;
      a.style.border = "none";
      a.style.visibility = "hidden";
      document.body.appendChild(a);
      if ("loading" !== document.readyState) c();
      else if (window.addEventListener)
        document.addEventListener("DOMContentLoaded", c);
      else {
        var e = document.onreadystatechange || function () {};
        document.onreadystatechange = function (b) {
          e(b);
          "loading" !== document.readyState &&
            ((document.onreadystatechange = e), c());
        };
      }
    }
  })();
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded, initializing...");
  fetchChits();
  setupCloudflareScripts();
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
});
