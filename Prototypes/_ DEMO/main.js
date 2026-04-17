// Main application functionality
let currentTab = "Calendar"; // Default tab
let chits = [];
let currentWeekStart = null;
let currentView = "Week"; // Default view
let previousState = { tab: "Calendar", view: "Week" }; // To store state before editing

// --- Utility Functions ---

function storePreviousState() {
  previousState = { tab: currentTab, view: currentView };
  console.log("Previous state stored:", previousState);
}

// Adjusted to use class selector and only manage sidebar class, as HTML handles onclick
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar"); // Still uses ID for the sidebar div
  if (!sidebar) {
    console.error("toggleSidebar: Sidebar element not found.");
    return;
  }
  sidebar.classList.toggle("active");
  if (sidebar.classList.contains("active")) {
    localStorage.setItem("sidebarState", "open");
    console.log("Sidebar state saved: open");
  } else {
    localStorage.setItem("sidebarState", "closed");
    console.log("Sidebar state saved: closed");
  }
}

function restoreSidebarState() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("restoreSidebarState: Sidebar element not found.");
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
  // Adjust to ensure Monday is the start of the week (getDay returns 0 for Sunday)
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // If Sunday (0), diff is 6 to go to last Monday. Otherwise, day-1 for current day.
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  console.log("Calculated week start:", d.toLocaleDateString());
  return d;
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  console.log("Calculated month start:", d.toLocaleDateString());
  return d;
}

function getYearStart(date) {
  const d = new Date(date);
  d.setMonth(0); // January
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  console.log("Calculated year start:", d.toLocaleDateString());
  return d;
}

function formatDate(date) {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function formatTime(date) {
  return date.toTimeString().slice(0, 5); // HH:MM
}

function formatWeekRange(startOfWeek) {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
}

function parseISOTime(timeString) {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function utcToLocalDate(isoString) {
  if (!isoString) return null;
  // Convert ISO string to Date object, which is usually parsed as UTC
  const date = new Date(isoString);
  // Get the local offset in minutes and apply it
  const offset = date.getTimezoneOffset(); // returns difference in minutes between UTC and local time
  const localDate = new Date(date.getTime() - offset * 60 * 60 * 1000); // Corrected to hours * minutes * 1000 for milliseconds
  return localDate;
}

function convertDBDateToDisplayDate(dbDateStr) {
  if (!dbDateStr) return null;
  try {
    const date = new Date(dbDateStr);
    // Adjust for UTC if needed, assuming DB dates are ISO strings that parse as UTC
    // and we want them displayed in local time.
    return date.toLocaleString(); // Uses user's locale for display
  } catch (e) {
    console.error("Error converting DB date to display date:", dbDateStr, e);
    return dbDateStr; // Return original string on error
  }
}

// --- Data Fetching and Management ---

function fetchChits() {
  console.log("fetchChits: Starting fetch operation...");
  fetch("/api/chits")
    .then((response) => {
      console.log("fetchChits: Received response, status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      chits = Array.isArray(data) ? data : [];
      console.log("fetchChits: Raw fetched data:", data);

      chits.forEach((chit, index) => {
        try {
          if (chit.start_datetime) {
            chit.start_datetime_obj = new Date(chit.start_datetime);
          } else {
            chit.start_datetime_obj = null;
            console.warn(
              `fetchChits: Chit ${chit.id || index} missing start_datetime.`,
            );
          }

          if (chit.end_datetime) {
            chit.end_datetime_obj = new Date(chit.end_datetime);
          } else {
            chit.end_datetime_obj = null;
            console.warn(
              `fetchChits: Chit ${chit.id || index} missing end_datetime.`,
            );
          }
        } catch (e) {
          console.error(
            `fetchChits: Error parsing date/time for chit ID ${chit.id || index}:`,
            chit,
            e,
          );
          // Set to null to prevent further errors during rendering if parsing failed
          chit.start_datetime_obj = null;
          chit.end_datetime_obj = null;
        }
      });
      console.log("fetchChits: Processed chits with date objects:", chits);

      // Initialize currentWeekStart if it's null (first load) - this should be handled by DOMContentLoaded now, but good fallback
      if (!currentWeekStart) {
        currentWeekStart = getWeekStart(new Date());
        console.log(
          "fetchChits: Initializing currentWeekStart to (fallback):",
          currentWeekStart.toLocaleDateString(),
        );
      } else {
        console.log(
          "fetchChits: currentWeekStart already set to:",
          currentWeekStart.toLocaleDateString(),
        );
      }

      updateDateRange();
      displayChits();
    })
    .catch((err) => {
      console.error("fetchChits: Error fetching chits data:", err);
      const chitList = document.getElementById("chit-list");
      if (chitList) {
        chitList.innerHTML = `
          <div class="error-message">
            <h3>Error loading chits</h3>
            <p>${err.message}</p>
            <button onclick="fetchChits()">Try Again</button>
          </div>
        `;
      } else {
        console.error(
          "fetchChits: Could not find 'chit-list' to display error message.",
        );
      }
    });
}

function updateDateRange() {
  // HTML provided does not have id="date-range-display" for now, so target the span under week-nav
  const dateRangeDisplay = document.getElementById("week-range");
  if (!dateRangeDisplay) {
    console.warn(
      "updateDateRange: 'week-range' element not found. Date range will not be displayed.",
    );
    return;
  }
  let displayString = "";
  if (currentTab === "Calendar") {
    if (currentView === "Week") {
      displayString = formatWeekRange(currentWeekStart);
    } else if (currentView === "Month") {
      displayString = currentWeekStart.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
    } else if (currentView === "Day") {
      displayString = currentWeekStart.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else if (currentView === "Year") {
      displayString = currentWeekStart.getFullYear().toString();
    } else if (currentView === "Itinerary") {
      // Itinerary view might not have a simple single date range,
      // it displays a list of chits sorted by date, so this might remain blank or show "All Dates"
      displayString = "All Dates";
    }
  }
  dateRangeDisplay.textContent = displayString;
  console.log("updateDateRange: Date range display updated to:", displayString);
}

// --- Display Functions (Core Rendering Logic) ---

function displayChits() {
  const listContainer = document.getElementById("chit-list");
  if (!listContainer) {
    console.error(
      "displayChits: Chit list container (id='chit-list') not found. Cannot display chits.",
    );
    return;
  }
  // Clear previous content to ensure a fresh render
  listContainer.innerHTML = "";
  console.log("displayChits: Cleared chit-list content.");

  const searchInput = document.getElementById("search");
  const searchText = searchInput ? searchInput.value.toLowerCase() : "";
  const statusFilterInput = document.getElementById("status-filter");
  const statusFilter = statusFilterInput ? statusFilterInput.value : "";

  let filteredChits = chits.filter((chit) => {
    const title = chit.title ? String(chit.title).toLowerCase() : "";
    const description = chit.description
      ? String(chit.description).toLowerCase()
      : "";
    const status = chit.status ? String(chit.status) : "";
    const labels = Array.isArray(chit.labels)
      ? chit.labels.map((label) => String(label).toLowerCase())
      : [];

    const matchesSearch =
      !searchText ||
      title.includes(searchText) ||
      description.includes(searchText) ||
      labels.some((label) => label.includes(searchText));

    const matchesStatus =
      !statusFilter || statusFilter === "" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  console.log(
    `displayChits: Filtered chits count: ${filteredChits.length} (Search: "${searchText}", Status: "${statusFilter}")`,
  );

  try {
    if (currentTab === "Calendar") {
      if (currentView === "Week") {
        displayWeekView(filteredChits);
      } else if (currentView === "Month") {
        displayMonthView(filteredChits);
      } else if (currentView === "Itinerary") {
        displayItineraryView(filteredChits);
      } else if (currentView === "Day") {
        displayDayView(filteredChits);
      } else if (currentView === "Year") {
        displayYearView(filteredChits);
      } else {
        listContainer.innerHTML = `<p>Calendar: ${currentView} view not implemented yet. Please select another view.</p>`;
        console.warn(
          `displayChits: Calendar: ${currentView} view not implemented.`,
        );
      }
    } else if (currentTab === "Checklists") {
      displayChecklistView(filteredChits);
    } else if (currentTab === "Tasks") {
      displayTasksView(filteredChits);
    } else if (
      currentTab === "Alarms" ||
      currentTab === "Projects" ||
      currentTab === "Notes"
    ) {
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet. Please select another tab.</p>`;
      console.warn(`displayChits: ${currentTab} tab not implemented.`);
    } else {
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet. Please select another tab.</p>`;
      console.warn(`displayChits: Unknown tab "${currentTab}".`);
    }
  } catch (e) {
    console.error(
      "displayChits: Error encountered while routing to or executing view function:",
      e,
    );
    listContainer.innerHTML = `
      <div class="error-message">
        <h3>A Rendering Error Occurred</h3>
        <p>There was a problem displaying the chits. Please check the browser console for details.</p>
        <p>Error: ${e.message}</p>
      </div>
    `;
  }
}

function displayWeekView(chitsToDisplay) {
  console.log("displayWeekView: Rendering week view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayWeekView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = ""; // Clear existing content

  const weekView = document.createElement("div");
  weekView.className = "week-view";
  weekView.style.display = "flex";
  weekView.style.width = "100%";
  weekView.style.height = "100%"; // Ensure it takes full height of parent
  weekView.style.overflowY = "auto"; // Allow scrolling if content overflows

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.flexShrink = "0"; // Prevent shrinking
  hourColumn.style.width = "60px"; // Fixed width for hour column
  hourColumn.style.position = "sticky"; // Sticky for scrolling with content
  hourColumn.style.left = "0";
  hourColumn.style.zIndex = "10"; // Ensure it's on top
  hourColumn.style.backgroundColor = "var(--bg-color)"; // Match background

  // Add a top-left corner space for the hour column header
  const cornerHeader = document.createElement("div");
  cornerHeader.className = "corner-header";
  cornerHeader.style.height = "30px"; // Space for day header
  hourColumn.appendChild(cornerHeader);

  for (let i = 0; i < 24; i++) {
    const hourSlot = document.createElement("div");
    hourSlot.className = "hour-slot";
    hourSlot.textContent = `${i.toString().padStart(2, "0")}:00`;
    hourSlot.style.height = "60px"; // 60px per hour for 1 min = 1px scale
    hourSlot.style.borderBottom = "1px solid var(--border-color-light)";
    hourColumn.appendChild(hourSlot);
  }
  weekView.appendChild(hourColumn);

  const dayColumnsContainer = document.createElement("div");
  dayColumnsContainer.className = "day-columns-container";
  dayColumnsContainer.style.flex = "1";
  dayColumnsContainer.style.display = "flex";
  dayColumnsContainer.style.overflowX = "auto"; // Allow horizontal scrolling if many days/events
  dayColumnsContainer.style.position = "relative"; // For positioning events

  const weekStart = new Date(currentWeekStart);
  console.log(
    "displayWeekView: Week starts on:",
    weekStart.toLocaleDateString(),
  );

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.flex = "1";
    dayColumn.style.minWidth = "120px"; // Minimum width for day column
    dayColumn.style.position = "relative";
    dayColumn.style.borderLeft = "1px solid var(--border-color-light)"; // Separator

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = day.toLocaleDateString("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    dayColumn.appendChild(dayHeader);

    const allDaySection = document.createElement("div");
    allDaySection.className = "all-day-section";
    allDaySection.style.minHeight = "30px"; // Ensure some space for all-day events
    allDaySection.style.borderBottom = "1px solid var(--border-color-light)";
    dayColumn.appendChild(allDaySection);

    const timeGrid = document.createElement("div");
    timeGrid.className = "time-grid";
    timeGrid.style.position = "relative";
    timeGrid.style.height = "1440px"; // 24 hours * 60 minutes = 1440px (1px per minute)
    dayColumn.appendChild(timeGrid);

    const dayChits = chitsToDisplay.filter(
      (chit) =>
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === day.toDateString(),
    );
    console.log(
      `displayWeekView: Found ${dayChits.length} chits for ${day.toLocaleDateString()}`,
    );

    dayChits.forEach((chit) => {
      try {
        if (!chit.title) {
          console.warn(
            `displayWeekView: Chit ID ${chit.id} has no title. Using default.`,
          );
        }
        const chitTitle = chit.title || "Untitled Chit";

        if (chit.all_day) {
          const allDayEvent = document.createElement("div");
          allDayEvent.className = "all-day-event chit-card"; // Added chit-card class
          allDayEvent.innerHTML = `
            <span style="font-weight: bold; font-size: 1.1em;">${chitTitle}</span>
            <div class="chit-labels">
              ${(Array.isArray(chit.labels) ? chit.labels : [])
                .map((label) => `<span class="chit-label">${label}</span>`)
                .join("")}
            </div>
          `;
          allDayEvent.style.backgroundColor = chit.color || "#C66B6B"; // Default color
          allDayEvent.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${chit.id}`;
          });
          allDaySection.appendChild(allDayEvent);
          console.log(`displayWeekView: Rendered all-day event: ${chitTitle}`);
        } else {
          const timedEvent = document.createElement("div");
          timedEvent.className = "timed-event chit-card"; // Added chit-card class

          const chitStart = chit.start_datetime_obj;
          const chitEnd = chit.end_datetime_obj;

          if (!chitStart) {
            console.warn(
              `displayWeekView: Skipping timed chit ${chit.id} due to missing start_datetime_obj.`,
            );
            return; // Skip this chit if start date is invalid
          }

          let effectiveEndTime = chitEnd;
          if (!effectiveEndTime || effectiveEndTime < chitStart) {
            effectiveEndTime = new Date(chitStart.getTime() + 60 * 60 * 1000); // Default to 1 hour if end_datetime is missing or before start
            console.warn(
              `displayWeekView: Chit ID ${chit.id} has invalid/missing end_datetime. Defaulting to 1 hour duration.`,
            );
          }

          const startMinutes =
            chitStart.getHours() * 60 + chitStart.getMinutes();
          const endMinutes =
            effectiveEndTime.getHours() * 60 + effectiveEndTime.getMinutes();
          let height = endMinutes - startMinutes;

          if (height < 0) {
            // This case should be largely handled by effectiveEndTime logic, but as a final safeguard
            console.warn(
              `displayWeekView: Negative height calculated for chit ID ${chit.id}. Adjusting to min height.`,
              chit,
            );
            height = 30; // Minimum height for visibility
          } else if (height === 0) {
            height = 30; // Give a minimum height for zero-duration events
          }

          timedEvent.style.top = `${startMinutes}px`;
          timedEvent.style.height = `${height}px`;
          timedEvent.style.backgroundColor = chit.color || "#4CAF50"; // Default color
          timedEvent.style.width = "calc(100% - 4px)"; // Adjusted for padding/border
          timedEvent.style.boxSizing = "border-box";
          timedEvent.style.position = "absolute"; // Critical for positioning within time-grid
          timedEvent.style.left = "2px"; // Small offset from left edge

          timedEvent.innerHTML = `
            <span style="font-weight: bold; font-size: 1.1em;">${chitTitle}</span><br>
            <span class="time-display">${formatTime(chitStart)} - ${formatTime(effectiveEndTime)}</span>
            <div class="chit-labels">
              ${(Array.isArray(chit.labels) ? chit.labels : [])
                .map((label) => `<span class="chit-label">${label}</span>`)
                .join("")}
            </div>
          `;
          timedEvent.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${chit.id}`;
          });
          timeGrid.appendChild(timedEvent);
          console.log(
            `displayWeekView: Rendered timed event: ${chitTitle} at top ${startMinutes}px, height ${height}px`,
          );
        }
      } catch (chitRenderError) {
        console.error(
          `displayWeekView: Error rendering individual chit ID ${chit.id || "N/A"} (index ${chitsToDisplay.indexOf(chit)}):`,
          chit,
          chitRenderError,
        );
        const errorChitElement = document.createElement("div");
        errorChitElement.className = "error-chit-placeholder";
        errorChitElement.style.cssText = `
          background-color: #ffcccc; border: 1px solid red; padding: 5px; margin-bottom: 5px;
          font-size: 0.9em; color: #333;
        `;
        errorChitElement.textContent = `Error displaying chit: ${chit.title || chit.id || "Unknown Chit"}. See console.`;
        // Append to the correct section based on all_day property for better visual debugging
        if (chit.all_day) {
          allDaySection.appendChild(errorChitElement);
        } else {
          timeGrid.appendChild(errorChitElement);
        }
      }
    });

    dayColumnsContainer.appendChild(dayColumn);
  }

  weekView.appendChild(dayColumnsContainer);
  chitList.appendChild(weekView);
  console.log("displayWeekView: Week view rendering complete.");
}

function displayMonthView(chitsToDisplay) {
  console.log("displayMonthView: Rendering month view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayMonthView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const monthView = document.createElement("div");
  monthView.className = "month-view";

  const monthHeader = document.createElement("div");
  monthHeader.className = "month-header";
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Assuming Monday start
  daysOfWeek.forEach((dayName) => {
    const dayHeader = document.createElement("div");
    dayHeader.textContent = dayName;
    monthHeader.appendChild(dayHeader);
  });
  monthView.appendChild(monthHeader);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";
  monthView.appendChild(monthGrid);

  const firstDayOfMonth = getMonthStart(currentWeekStart);
  let startDay = getWeekStart(firstDayOfMonth); // Start grid from the first Monday of the month's week

  for (let i = 0; i < 42; i++) {
    // Render 6 weeks (6 * 7 = 42 days)
    const day = new Date(startDay);
    day.setDate(startDay.getDate() + i);

    const monthDay = document.createElement("div");
    monthDay.className = "month-day";
    if (day.getMonth() !== firstDayOfMonth.getMonth()) {
      monthDay.classList.add("other-month");
    }

    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = day.getDate();
    monthDay.appendChild(dayNumber);

    const dayChits = chitsToDisplay.filter(
      (chit) =>
        chit.start_datetime_obj &&
        chit.start_datetime_obj.toDateString() === day.toDateString(),
    );

    dayChits.forEach((chit) => {
      try {
        const chitElement = document.createElement("div");
        chitElement.className = `month-chit chit-card ${chit.all_day ? "all-day-event" : "timed-event"}`;
        chitElement.style.backgroundColor = chit.color || "#FFD700"; // Default color
        chitElement.innerHTML = `
          <span>${chit.title || "Untitled Chit"}</span>
          ${!chit.all_day && chit.start_datetime_obj ? `<span class="time-display">${formatTime(chit.start_datetime_obj)}</span>` : ""}
        `;
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        monthDay.appendChild(chitElement);
      } catch (chitRenderError) {
        console.error(
          `displayMonthView: Error rendering individual chit ID ${chit.id || "N/A"}:`,
          chit,
          chitRenderError,
        );
        const errorChitElement = document.createElement("div");
        errorChitElement.className = "error-chit-placeholder";
        errorChitElement.textContent = `Error: ${chit.title || chit.id || "Unknown Chit"}`;
        monthDay.appendChild(errorChitElement);
      }
    });

    monthGrid.appendChild(monthDay);
  }

  chitList.appendChild(monthView);
  console.log("displayMonthView: Month view rendering complete.");
}

function displayItineraryView(chitsToDisplay) {
  console.log("displayItineraryView: Rendering itinerary view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayItineraryView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const itineraryView = document.createElement("div");
  itineraryView.className = "itinerary-view";

  if (chitsToDisplay.length === 0) {
    itineraryView.innerHTML = "<p>No chits found for this itinerary.</p>";
  } else {
    // Sort chits by start_datetime
    chitsToDisplay.sort((a, b) => {
      if (!a.start_datetime_obj && !b.start_datetime_obj) return 0;
      if (!a.start_datetime_obj) return 1;
      if (!b.start_datetime_obj) return -1;
      return a.start_datetime_obj.getTime() - b.start_datetime_obj.getTime();
    });

    let lastDate = null;
    chitsToDisplay.forEach((chit) => {
      try {
        const chitDate = chit.start_datetime_obj;
        if (!chitDate) {
          console.warn(
            `displayItineraryView: Skipping chit ${chit.id} due to missing start_datetime_obj.`,
          );
          return; // Skip if date is invalid
        }

        if (!lastDate || chitDate.toDateString() !== lastDate.toDateString()) {
          const dateHeader = document.createElement("h3");
          dateHeader.className = "itinerary-date-header";
          dateHeader.textContent = chitDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          itineraryView.appendChild(dateHeader);
          lastDate = chitDate;
        }

        const chitElement = document.createElement("div");
        chitElement.className = "itinerary-event chit-card";
        chitElement.style.backgroundColor = chit.color || "#88B04B"; // Default color

        const timeDisplay = chit.all_day
          ? "All Day"
          : chit.start_datetime_obj && chit.end_datetime_obj
            ? `${formatTime(chit.start_datetime_obj)} - ${formatTime(chit.end_datetime_obj)}`
            : chit.start_datetime_obj
              ? formatTime(chit.start_datetime_obj)
              : "Time not specified";

        chitElement.innerHTML = `
          <h4>${chit.title || "Untitled Chit"}</h4>
          <p class="itinerary-time">${timeDisplay}</p>
          ${chit.description ? `<p>${chit.description}</p>` : ""}
          <div class="chit-labels">
            ${(Array.isArray(chit.labels) ? chit.labels : [])
              .map((label) => `<span class="chit-label">${label}</span>`)
              .join("")}
          </div>
          <p class="chit-status">Status: ${chit.status || "N/A"}</p>
        `;
        chitElement.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        itineraryView.appendChild(chitElement);
      } catch (chitRenderError) {
        console.error(
          `displayItineraryView: Error rendering individual chit ID ${chit.id || "N/A"}:`,
          chit,
          chitRenderError,
        );
        const errorChitElement = document.createElement("div");
        errorChitElement.className = "error-chit-placeholder";
        errorChitElement.textContent = `Error: ${chit.title || chit.id || "Unknown Chit"}`;
        itineraryView.appendChild(errorChitElement);
      }
    });
  }
  chitList.appendChild(itineraryView);
  console.log("displayItineraryView: Itinerary view rendering complete.");
}

function displayDayView(chitsToDisplay) {
  console.log("displayDayView: Rendering day view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayDayView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const dayView = document.createElement("div");
  dayView.className = "day-view";
  dayView.style.display = "flex";
  dayView.style.width = "100%";
  dayView.style.height = "100%";
  dayView.style.overflowY = "auto";

  const hourColumn = document.createElement("div");
  hourColumn.className = "hour-column";
  hourColumn.style.flexShrink = "0";
  hourColumn.style.width = "60px";
  hourColumn.style.position = "sticky";
  hourColumn.style.left = "0";
  hourColumn.style.zIndex = "10";
  hourColumn.style.backgroundColor = "var(--bg-color)";

  const cornerHeader = document.createElement("div");
  cornerHeader.className = "corner-header";
  cornerHeader.style.height = "30px";
  hourColumn.appendChild(cornerHeader);

  for (let i = 0; i < 24; i++) {
    const hourSlot = document.createElement("div");
    hourSlot.className = "hour-slot";
    hourSlot.textContent = `${i.toString().padStart(2, "0")}:00`;
    hourSlot.style.height = "60px";
    hourSlot.style.borderBottom = "1px solid var(--border-color-light)";
    hourColumn.appendChild(hourSlot);
  }
  dayView.appendChild(hourColumn);

  const dayColumn = document.createElement("div");
  dayColumn.className = "day-column";
  dayColumn.style.flex = "1";
  dayColumn.style.minWidth = "200px"; // Wider for single day
  dayColumn.style.position = "relative";
  dayColumn.style.borderLeft = "1px solid var(--border-color-light)";

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-header";
  dayHeader.textContent = currentWeekStart.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  dayColumn.appendChild(dayHeader);

  const allDaySection = document.createElement("div");
  allDaySection.className = "all-day-section";
  allDaySection.style.minHeight = "30px";
  allDaySection.style.borderBottom = "1px solid var(--border-color-light)";
  dayColumn.appendChild(allDaySection);

  const timeGrid = document.createElement("div");
  timeGrid.className = "time-grid";
  timeGrid.style.position = "relative";
  timeGrid.style.height = "1440px";
  dayColumn.appendChild(timeGrid);

  const targetDay = currentWeekStart; // In day view, currentWeekStart holds the single day
  const dayChits = chitsToDisplay.filter(
    (chit) =>
      chit.start_datetime_obj &&
      chit.start_datetime_obj.toDateString() === targetDay.toDateString(),
  );
  console.log(
    `displayDayView: Found ${dayChits.length} chits for ${targetDay.toLocaleDateString()}`,
  );

  dayChits.forEach((chit) => {
    try {
      const chitTitle = chit.title || "Untitled Chit";
      if (chit.all_day) {
        const allDayEvent = document.createElement("div");
        allDayEvent.className = "all-day-event chit-card";
        allDayEvent.innerHTML = `
          <span style="font-weight: bold; font-size: 1.1em;">${chitTitle}</span>
          <div class="chit-labels">
            ${(Array.isArray(chit.labels) ? chit.labels : [])
              .map((label) => `<span class="chit-label">${label}</span>`)
              .join("")}
          </div>
        `;
        allDayEvent.style.backgroundColor = chit.color || "#C66B6B";
        allDayEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        allDaySection.appendChild(allDayEvent);
      } else {
        const timedEvent = document.createElement("div");
        timedEvent.className = "timed-event chit-card";

        const chitStart = chit.start_datetime_obj;
        const chitEnd = chit.end_datetime_obj;

        if (!chitStart) {
          console.warn(
            `displayDayView: Skipping timed chit ${chit.id} due to missing start_datetime_obj.`,
          );
          return;
        }

        let effectiveEndTime = chitEnd;
        if (!effectiveEndTime || effectiveEndTime < chitStart) {
          effectiveEndTime = new Date(chitStart.getTime() + 60 * 60 * 1000);
          console.warn(
            `displayDayView: Chit ID ${chit.id} has invalid/missing end_datetime. Defaulting to 1 hour duration.`,
          );
        }

        const startMinutes = chitStart.getHours() * 60 + chitStart.getMinutes();
        const endMinutes =
          effectiveEndTime.getHours() * 60 + effectiveEndTime.getMinutes();
        let height = endMinutes - startMinutes;

        if (height < 0) {
          console.warn(
            `displayDayView: Negative height calculated for chit ID ${chit.id}. Adjusting to min height.`,
            chit,
          );
          height = 30;
        } else if (height === 0) {
          height = 30;
        }

        timedEvent.style.top = `${startMinutes}px`;
        timedEvent.style.height = `${height}px`;
        timedEvent.style.backgroundColor = chit.color || "#4CAF50";
        timedEvent.style.width = "calc(100% - 4px)";
        timedEvent.style.boxSizing = "border-box";
        timedEvent.style.position = "absolute";
        timedEvent.style.left = "2px";

        timedEvent.innerHTML = `
          <span style="font-weight: bold; font-size: 1.1em;">${chitTitle}</span><br>
          <span class="time-display">${formatTime(chitStart)} - ${formatTime(effectiveEndTime)}</span>
          <div class="chit-labels">
            ${(Array.isArray(chit.labels) ? chit.labels : [])
              .map((label) => `<span class="chit-label">${label}</span>`)
              .join("")}
          </div>
        `;
        timedEvent.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${chit.id}`;
        });
        timeGrid.appendChild(timedEvent);
      }
    } catch (chitRenderError) {
      console.error(
        `displayDayView: Error rendering individual chit ID ${chit.id || "N/A"}:`,
        chit,
        chitRenderError,
      );
      const errorChitElement = document.createElement("div");
      errorChitElement.className = "error-chit-placeholder";
      errorChitElement.textContent = `Error: ${chit.title || chit.id || "Unknown Chit"}. See console.`;
      if (chit.all_day) {
        allDaySection.appendChild(errorChitElement);
      } else {
        timeGrid.appendChild(errorChitElement);
      }
    }
  });

  dayView.appendChild(dayColumn);
  chitList.appendChild(dayView);
  console.log("displayDayView: Day view rendering complete.");
}

function displayYearView(chitsToDisplay) {
  console.log("displayYearView: Rendering year view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayYearView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const yearView = document.createElement("div");
  yearView.className = "year-view";

  const currentYear = currentWeekStart.getFullYear();
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthContainer = document.createElement("div");
    monthContainer.className = "year-month-container";

    const monthHeader = document.createElement("h4");
    monthHeader.textContent = new Date(
      currentYear,
      monthIndex,
      1,
    ).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    monthContainer.appendChild(monthHeader);

    const monthGrid = document.createElement("div");
    monthGrid.className = "year-month-grid"; // Styling similar to month-grid but smaller

    const firstDayOfMonth = new Date(currentYear, monthIndex, 1);
    let startDay = getWeekStart(firstDayOfMonth); // Start grid from the first Monday of the month's week

    for (let i = 0; i < 42; i++) {
      // 6 weeks
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + i);

      const dayCell = document.createElement("div");
      dayCell.className = "year-day-cell";
      if (day.getMonth() !== monthIndex) {
        dayCell.classList.add("other-month");
      }

      const dayNumber = document.createElement("span");
      dayNumber.textContent = day.getDate();
      dayCell.appendChild(dayNumber);

      const dayChits = chitsToDisplay.filter(
        (chit) =>
          chit.start_datetime_obj &&
          chit.start_datetime_obj.toDateString() === day.toDateString(),
      );

      if (dayChits.length > 0) {
        const chitCount = document.createElement("span");
        chitCount.className = "chit-count";
        chitCount.textContent = dayChits.length;
        dayCell.appendChild(chitCount);
        // Optionally add a popover or detailed view on click/hover later
      }
      monthGrid.appendChild(dayCell);
    }
    monthContainer.appendChild(monthGrid);
    yearView.appendChild(monthContainer);
  }

  chitList.appendChild(yearView);
  console.log("displayYearView: Year view rendering complete.");
}

function displayChecklistView(chitsToDisplay) {
  console.log("displayChecklistView: Rendering checklist view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayChecklistView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const checklistView = document.createElement("div");
  checklistView.className = "checklist-view";

  if (chitsToDisplay.length === 0) {
    checklistView.innerHTML = "<p>No checklists found.</p>";
  } else {
    chitsToDisplay.forEach((chit) => {
      try {
        if (
          !chit.checklist ||
          !Array.isArray(chit.checklist) ||
          chit.checklist.length === 0
        ) {
          console.warn(
            `displayChecklistView: Chit ID ${chit.id} has no valid checklist items. Skipping.`,
          );
          return; // Skip chits without a valid checklist
        }

        const checklistCard = document.createElement("div");
        checklistCard.className = "chit-card checklist-card";
        checklistCard.style.backgroundColor = chit.color || "#FFD700"; // Default color

        const cardHeader = document.createElement("h3");
        cardHeader.textContent = chit.title || "Untitled Checklist";
        checklistCard.appendChild(cardHeader);

        const ul = document.createElement("ul");
        chit.checklist.forEach((item, itemIndex) => {
          if (typeof item !== "object" || item === null) {
            console.warn(
              `displayChecklistView: Checklist item for chit ${chit.id} at index ${itemIndex} is malformed. Skipping.`,
              item,
            );
            return;
          }
          const li = document.createElement("li");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = item.completed || false;
          checkbox.disabled = true; // Make checkboxes read-only for display view
          li.appendChild(checkbox);
          li.appendChild(
            document.createTextNode(` ${item.item || "Untitled Item"}`),
          );
          ul.appendChild(li);
        });
        checklistCard.appendChild(ul);

        const footer = document.createElement("div");
        footer.className = "chit-footer";
        footer.innerHTML = `
          <div class="chit-labels">
            ${(Array.isArray(chit.labels) ? chit.labels : [])
              .map((label) => `<span class="chit-label">${label}</span>`)
              .join("")}
          </div>
          <button onclick="storePreviousState(); window.location.href='/editor?id=${chit.id}'">Edit</button>
        `;
        checklistCard.appendChild(footer);

        checklistView.appendChild(checklistCard);
      } catch (chitRenderError) {
        console.error(
          `displayChecklistView: Error rendering individual checklist chit ID ${chit.id || "N/A"}:`,
          chit,
          chitRenderError,
        );
        const errorChitElement = document.createElement("div");
        errorChitElement.className = "error-chit-placeholder";
        errorChitElement.textContent = `Error: ${chit.title || chit.id || "Unknown Checklist"}. See console.`;
        checklistView.appendChild(errorChitElement);
      }
    });
  }
  chitList.appendChild(checklistView);
  console.log("displayChecklistView: Checklist view rendering complete.");
}

function displayTasksView(chitsToDisplay) {
  console.log("displayTasksView: Rendering tasks view...");
  const chitList = document.getElementById("chit-list");
  if (!chitList) {
    console.error("displayTasksView: Chit list container not found.");
    return;
  }
  chitList.innerHTML = "";

  const tasksView = document.createElement("div");
  tasksView.className = "tasks-view";

  if (chitsToDisplay.length === 0) {
    tasksView.innerHTML = "<p>No tasks found.</p>";
  } else {
    // Sort tasks by due date if available, then by title
    chitsToDisplay.sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date) : null;
      const dateB = b.due_date ? new Date(b.due_date) : null;

      if (dateA && dateB) return dateA.getTime() - dateB.getTime();
      if (!dateA && !dateB) return (a.title || "").localeCompare(b.title || "");
      return dateA ? -1 : 1; // Nulls last
    });

    chitsToDisplay.forEach((chit) => {
      try {
        const taskCard = document.createElement("div");
        taskCard.className = `chit-card task-card status-${(chit.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`;
        taskCard.style.backgroundColor = chit.color || "#6B8E23"; // Default color

        const cardHeader = document.createElement("h3");
        cardHeader.textContent = chit.title || "Untitled Task";
        taskCard.appendChild(cardHeader);

        if (chit.description) {
          const description = document.createElement("p");
          description.className = "task-description";
          description.textContent = chit.description;
          taskCard.appendChild(description);
        }

        if (chit.due_date) {
          const dueDate = document.createElement("p");
          dueDate.className = "task-due-date";
          dueDate.textContent = `Due: ${convertDBDateToDisplayDate(chit.due_date)}`;
          taskCard.appendChild(dueDate);
        }

        const footer = document.createElement("div");
        footer.className = "chit-footer";
        footer.innerHTML = `
          <div class="chit-labels">
            ${(Array.isArray(chit.labels) ? chit.labels : [])
              .map((label) => `<span class="chit-label">${label}</span>`)
              .join("")}
          </div>
          <p class="chit-status">Status: ${chit.status || "N/A"}</p>
          <button onclick="storePreviousState(); window.location.href='/editor?id=${chit.id}'">Edit</button>
        `;
        taskCard.appendChild(footer);

        tasksView.appendChild(taskCard);
      } catch (chitRenderError) {
        console.error(
          `displayTasksView: Error rendering individual task chit ID ${chit.id || "N/A"}:`,
          chit,
          chitRenderError,
        );
        const errorChitElement = document.createElement("div");
        errorChitElement.className = "error-chit-placeholder";
        errorChitElement.textContent = `Error: ${chit.title || chit.id || "Unknown Task"}. See console.`;
        tasksView.appendChild(errorChitElement);
      }
    });
  }
  chitList.appendChild(tasksView);
  console.log("displayTasksView: Tasks view rendering complete.");
}

// --- Navigation and UI Interaction (Adjusted for HTML's onclick calls) ---

function navigateWeek(direction) {
  if (!currentWeekStart) {
    console.error("navigateWeek: currentWeekStart is null. Cannot navigate.");
    return;
  }
  const newDate = new Date(currentWeekStart);
  newDate.setDate(newDate.getDate() + direction * 7);
  currentWeekStart = getWeekStart(newDate);
  console.log(
    "navigateWeek: Navigated to week starting:",
    currentWeekStart.toLocaleDateString(),
  );
  updateDateRange();
  displayChits();
}

function navigateMonth(direction) {
  if (!currentWeekStart) {
    console.error("navigateMonth: currentWeekStart is null. Cannot navigate.");
    return;
  }
  const newDate = new Date(currentWeekStart);
  newDate.setMonth(newDate.getMonth() + direction);
  currentWeekStart = getMonthStart(newDate);
  console.log(
    "navigateMonth: Navigated to month starting:",
    currentWeekStart.toLocaleDateString(),
  );
  updateDateRange();
  displayChits();
}

function navigateDay(direction) {
  if (!currentWeekStart) {
    console.error("navigateDay: currentWeekStart is null. Cannot navigate.");
    return;
  }
  const newDate = new Date(currentWeekStart);
  newDate.setDate(newDate.getDate() + direction);
  currentWeekStart = new Date(newDate.setHours(0, 0, 0, 0)); // Ensure it's start of the day
  console.log(
    "navigateDay: Navigated to day:",
    currentWeekStart.toLocaleDateString(),
  );
  updateDateRange();
  displayChits();
}

function navigateYear(direction) {
  if (!currentWeekStart) {
    console.error("navigateYear: currentWeekStart is null. Cannot navigate.");
    return;
  }
  const newDate = new Date(currentWeekStart);
  newDate.setFullYear(newDate.getFullYear() + direction);
  currentWeekStart = getYearStart(newDate);
  console.log(
    "navigateYear: Navigated to year starting:",
    currentWeekStart.toLocaleDateString(),
  );
  updateDateRange();
  displayChits();
}

// New functions to match HTML onclick/onchange calls
function previousPeriod() {
  if (currentTab === "Calendar") {
    if (currentView === "Week") navigateWeek(-1);
    else if (currentView === "Month") navigateMonth(-1);
    else if (currentView === "Day") navigateDay(-1);
    else if (currentView === "Year") navigateYear(-1);
    else if (currentView === "Itinerary") {
      // Itinerary view might not have a simple "previous period" concept
      console.warn(
        "previousPeriod: Itinerary view does not support period navigation.",
      );
    }
  }
}

function nextPeriod() {
  if (currentTab === "Calendar") {
    if (currentView === "Week") navigateWeek(1);
    else if (currentView === "Month") navigateMonth(1);
    else if (currentView === "Day") navigateDay(1);
    else if (currentView === "Year") navigateYear(1);
    else if (currentView === "Itinerary") {
      console.warn(
        "nextPeriod: Itinerary view does not support period navigation.",
      );
    }
  }
}

function changeView() {
  const viewSelector = document.getElementById("view-select"); // Using view-select as per HTML
  if (viewSelector) {
    switchView(viewSelector.value);
  } else {
    console.error("changeView: 'view-select' element not found.");
  }
}

function filterChits(tabName) {
  switchTab(tabName);
}

function today() {
  currentWeekStart = getWeekStart(new Date()); // Reset to today's week start
  if (currentView === "Month") {
    currentWeekStart = getMonthStart(new Date());
  } else if (currentView === "Day") {
    currentWeekStart = new Date(new Date().setHours(0, 0, 0, 0));
  } else if (currentView === "Year") {
    currentWeekStart = getYearStart(new Date());
  }
  console.log(
    "today: Resetting to today's date based on current view:",
    currentWeekStart.toLocaleDateString(),
  );
  updateDateRange();
  displayChits();
}

function switchTab(tabName) {
  console.log("switchTab: Switching to tab:", tabName);
  currentTab = tabName;

  // Update active tab buttons
  document.querySelectorAll(".tabs .tab").forEach((tabDiv) => {
    if (tabDiv.textContent === tabName) {
      tabDiv.classList.add("active");
    } else {
      tabDiv.classList.remove("active");
    }
  });

  // Show/hide navigation buttons based on tab
  const calendarNav = document.getElementById("week-nav"); // Changed to week-nav as per HTML
  const viewSelector = document.getElementById("view-select"); // Changed to view-select as per HTML
  // const createChitButton = document.querySelector(".create-chit"); // HTML handles onclick directly for this one
  const filterSection = document.getElementById("filter-section");

  if (tabName === "Calendar") {
    if (calendarNav) calendarNav.style.display = "flex";
    if (viewSelector) viewSelector.style.display = "block";
    // if (createChitButton) createChitButton.style.display = "block"; // Always visible as per HTML
    if (filterSection) filterSection.style.display = "block";
  } else if (tabName === "Checklists" || tabName === "Tasks") {
    if (calendarNav) calendarNav.style.display = "none";
    if (viewSelector) viewSelector.style.display = "none";
    // if (createChitButton) createChitButton.style.display = "block";
    if (filterSection) filterSection.style.display = "block";
  } else if (
    tabName === "Alarms" ||
    tabName === "Projects" ||
    tabName === "Notes"
  ) {
    // These tabs are present in HTML but not fully implemented in JS yet
    if (calendarNav) calendarNav.style.display = "none";
    if (viewSelector) viewSelector.style.display = "none";
    if (filterSection) filterSection.style.display = "none"; // Filters might not apply
  } else {
    // For any other future tabs
    if (calendarNav) calendarNav.style.display = "none";
    if (viewSelector) viewSelector.style.display = "none";
    // if (createChitButton) createChitButton.style.display = "block";
    if (filterSection) filterSection.style.display = "block";
  }

  // Set default view for new tabs if needed
  if (tabName === "Checklists" && currentView !== "Checklist") {
    currentView = "Checklist";
  } else if (tabName === "Tasks" && currentView !== "Tasks") {
    currentView = "Tasks";
  } else if (
    tabName === "Calendar" &&
    !["Week", "Month", "Day", "Itinerary", "Year"].includes(currentView)
  ) {
    currentView = "Week"; // Default calendar view
  } else if (["Alarms", "Projects", "Notes"].includes(tabName)) {
    currentView = tabName; // Set view to tab name for now, will show not implemented
  }
  console.log("switchTab: currentView set to:", currentView);

  updateViewSelector(); // Update the dropdown to reflect new currentView
  displayChits(); // Re-render chits for the new tab/view
}

function switchView(viewName) {
  console.log("switchView: Switching to view:", viewName);
  currentView = viewName;
  updateDateRange(); // Update date range display based on new view type
  displayChits(); // Re-render chits for the new view
}

function updateViewSelector() {
  const viewSelector = document.getElementById("view-select"); // Changed to view-select
  if (viewSelector) {
    viewSelector.value = currentView;
    console.log("updateViewSelector: Selector value set to:", currentView);
  } else {
    console.warn(
      "updateViewSelector: View selector element (id='view-select') not found.",
    );
  }
}

function searchChits() {
  console.log("searchChits: Search initiated.");
  displayChits(); // Re-display chits with current search filter
}

function filterByStatus() {
  console.log("filterByStatus: Status filter changed.");
  displayChits(); // Re-display chits with current status filter
}

// The createChit function is removed as HTML handles the redirect directly via onclick="window.location.href='/editor'"

// --- Editor Page Specific Functions ---
// These functions are primarily for the editor.html page, but included in main.js
// as per the provided context.

function loadChitForEdit() {
  console.log("loadChitForEdit: Attempting to load chit for editing...");
  const params = new URLSearchParams(window.location.search);
  const chitId = params.get("id");
  if (chitId) {
    console.log("loadChitForEdit: Chit ID found:", chitId);
    fetch(`/api/chits/${chitId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Chit not found or server error.");
        return response.json();
      })
      .then((chit) => {
        console.log("loadChitForEdit: Fetched chit data:", chit);
        document.getElementById("chit_id").value = chit.id || "";
        document.getElementById("title").value = chit.title || "";
        document.getElementById("description").value = chit.description || "";
        // Status values to align with new HTML options for status filter:
        const statusMapping = {
          Pending: "ToDo",
          "In Progress": "In Progress",
          Completed: "Complete",
          Cancelled: "Blocked", // Mapping 'Cancelled' to 'Blocked' as per HTML
        };
        document.getElementById("status").value =
          statusMapping[chit.status] || chit.status || "ToDo"; // Default to ToDo
        document.getElementById("color").value = chit.color || "#C66B6B"; // Default color

        // Date and Time Handling
        const startDateTimeInput = document.getElementById("start_datetime");
        const startTimeInput = document.getElementById("start_time");
        const endDateTimeInput = document.getElementById("end_datetime");
        const endTimeInput = document.getElementById("end_time");
        const allDayCheckbox = document.getElementById("all_day");

        if (chit.start_datetime) {
          const startDate = new Date(chit.start_datetime);
          if (startDateTimeInput)
            startDateTimeInput.value = formatDate(startDate);
          if (startTimeInput) startTimeInput.value = formatTime(startDate);
        } else {
          // Clear if no start_datetime
          if (startDateTimeInput) startDateTimeInput.value = "";
          if (startTimeInput) startTimeInput.value = "";
        }

        if (chit.end_datetime) {
          const endDate = new Date(chit.end_datetime);
          if (endDateTimeInput) endDateTimeInput.value = formatDate(endDate);
          if (endTimeInput) endTimeInput.value = formatTime(endDate);
        } else {
          // Clear if no end_datetime
          if (endDateTimeInput) endDateTimeInput.value = "";
          if (endTimeInput) endTimeInput.value = "";
        }

        if (allDayCheckbox) {
          allDayCheckbox.checked = chit.all_day || false;
          // Disable time inputs if all_day is checked
          if (startTimeInput) startTimeInput.disabled = allDayCheckbox.checked;
          if (endTimeInput) endTimeInput.disabled = allDayCheckbox.checked;
        }

        // Labels
        const labelsInput = document.getElementById("labels");
        if (labelsInput) {
          labelsInput.value = Array.isArray(chit.labels)
            ? chit.labels.join(", ")
            : "";
        }

        // Checklist items
        const checklistContainer = document.getElementById(
          "checklist-items-container",
        );
        if (checklistContainer) {
          checklistContainer.innerHTML = ""; // Clear existing
          if (Array.isArray(chit.checklist)) {
            chit.checklist.forEach((item) =>
              addChecklistItem(item.item, item.completed),
            );
          } else {
            addChecklistItem(); // Add one empty item if no checklist
          }
        } else {
          console.warn("loadChitForEdit: checklist-items-container not found.");
        }

        // Show/hide delete button
        const deleteButton = document.getElementById("delete-chit-button");
        if (deleteButton) {
          deleteButton.style.display = "block";
        }
      })
      .catch((err) => {
        console.error("loadChitForEdit: Error loading chit:", err);
        // Maybe redirect or show error message
        alert("Error loading chit: " + err.message);
        window.location.href = "/"; // Go back to main page on error
      });
  } else {
    console.log("loadChitForEdit: No chit ID found, preparing for new chit.");
    // Initialize for new chit
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

    // Initialize Flatpickr for date/time inputs
    // flatpickr instances are created inside initFlatpickrForEditor()
    // It's called once in DOMContentLoaded for editor page.
    const checklistContainer = document.getElementById(
      "checklist-items-container",
    );
    if (checklistContainer && checklistContainer.children.length === 0) {
      addChecklistItem(); // Add one empty item for new chit
    }

    const deleteButton = document.getElementById("delete-chit-button");
    if (deleteButton) {
      deleteButton.style.display = "none"; // Hide delete for new chit
    }
  }
}

function initFlatpickrForEditor() {
  console.log(
    "initFlatpickrForEditor: Initializing Flatpickr for editor fields.",
  );
  const startDateTime = document.getElementById("start_datetime");
  const startTime = document.getElementById("start_time");
  const endDateTime = document.getElementById("end_datetime");
  const endTime = document.getElementById("end_time");
  const allDayCheckbox = document.getElementById("all_day");

  if (startDateTime) {
    flatpickr(startDateTime, { dateFormat: "Y-m-d" });
  }
  if (startTime) {
    flatpickr(startTime, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      minuteIncrement: 1,
      onChange: function (selectedDates, dateStr, instance) {
        const startTimeVal = new Date(`1970-01-01T${dateStr}:00`);
        const oneHourLater = new Date(startTimeVal.getTime() + 60 * 60 * 1000);
        if (
          endTime &&
          endTime._flatpickr &&
          !endTime._flatpickr.selectedDates.length &&
          !allDayCheckbox?.checked
        ) {
          endTime._flatpickr.setDate(formatTime(oneHourLater));
        }
      },
    });
  }
  if (endDateTime) {
    flatpickr(endDateTime, { dateFormat: "Y-m-d" });
  }
  if (endTime) {
    flatpickr(endTime, {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      minuteIncrement: 1,
    });
  }

  if (allDayCheckbox) {
    allDayCheckbox.addEventListener("change", (e) => {
      if (startTime) startTime.disabled = e.target.checked;
      if (endTime) endTime.disabled = e.target.checked;
      console.log(
        "All Day checkbox changed. Time inputs disabled:",
        e.target.checked,
      );
    });
    // Initial state setup
    if (startTime) startTime.disabled = allDayCheckbox.checked;
    if (endTime) endTime.disabled = allDayCheckbox.checked;
  }
}

function addChecklistItem(itemText = "", isCompleted = false) {
  const container = document.getElementById("checklist-items-container");
  if (!container) {
    console.error("addChecklistItem: Checklist items container not found.");
    return;
  }
  const itemDiv = document.createElement("div");
  itemDiv.className = "checklist-item";
  itemDiv.innerHTML = `
    <input type="checkbox" ${isCompleted ? "checked" : ""} class="checklist-checkbox">
    <input type="text" value="${itemText}" placeholder="Checklist item" class="checklist-text-input">
    <button type="button" onclick="removeChecklistItem(this)">Remove</button>
  `;
  container.appendChild(itemDiv);
  console.log("addChecklistItem: Added checklist item.");
}

function removeChecklistItem(button) {
  button.parentElement.remove();
  console.log("removeChecklistItem: Removed checklist item.");
}

function saveChit() {
  console.log("saveChit: Initiating save operation...");
  const chitId = document.getElementById("chit_id")?.value;
  const title = document.getElementById("title")?.value;
  const description = document.getElementById("description")?.value;
  const status = document.getElementById("status")?.value; // Get status value from editor page
  const color = document.getElementById("color")?.value;
  const allDay = document.getElementById("all_day")?.checked || false;
  const labels = document
    .getElementById("labels")
    ?.value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Combine date and time inputs
  const startDateTime = document.getElementById("start_datetime")?.value;
  const startTime = document.getElementById("start_time")?.value;
  const endDateTime = document.getElementById("end_datetime")?.value;
  const endTime = document.getElementById("end_time")?.value;

  let fullStartDateTime = null;
  if (startDateTime) {
    try {
      if (allDay) {
        fullStartDateTime = new Date(startDateTime + "T00:00:00"); // Standard start of day for all day
      } else if (startTime) {
        fullStartDateTime = new Date(`${startDateTime}T${startTime}:00`);
      } else {
        fullStartDateTime = new Date(`${startDateTime}T00:00:00`); // If date but no time, default to start of day
      }
      if (isNaN(fullStartDateTime.getTime()))
        throw new Error("Invalid start date/time");
      fullStartDateTime = fullStartDateTime.toISOString();
    } catch (e) {
      console.error("saveChit: Error combining start date/time:", e);
      alert("Invalid Start Date/Time. Please check the format.");
      return;
    }
  }

  let fullEndDateTime = null;
  if (endDateTime) {
    try {
      if (allDay) {
        fullEndDateTime = new Date(endDateTime + "T23:59:59"); // Standard end of day for all day
      } else if (endTime) {
        fullEndDateTime = new Date(`${endDateTime}T${endTime}:00`);
      } else if (fullStartDateTime) {
        // If no end time, use start time as a fallback
        const start = new Date(fullStartDateTime);
        fullEndDateTime = new Date(start.getTime() + 60 * 60 * 1000); // Default to 1 hour after start
      } else {
        fullEndDateTime = new Date(`${endDateTime}T23:59:59`); // If date but no time/start time, default to end of day
      }

      if (isNaN(fullEndDateTime.getTime()))
        throw new Error("Invalid end date/time");
      fullEndDateTime = fullEndDateTime.toISOString();
    } catch (e) {
      console.error("saveChit: Error combining end date/time:", e);
      alert("Invalid End Date/Time. Please check the format.");
      return;
    }
  }

  // Handle checklist items
  const checklistItems = [];
  document
    .querySelectorAll("#checklist-items-container .checklist-item")
    .forEach((itemDiv) => {
      const checkbox = itemDiv.querySelector(".checklist-checkbox");
      const textInput = itemDiv.querySelector(".checklist-text-input");
      if (textInput && textInput.value.trim() !== "") {
        checklistItems.push({
          item: textInput.value.trim(),
          completed: checkbox ? checkbox.checked : false,
        });
      }
    });

  const chitData = {
    title: title,
    description: description,
    status: status,
    color: color,
    all_day: allDay,
    labels: labels,
    start_datetime: fullStartDateTime,
    end_datetime: fullEndDateTime,
    checklist: checklistItems,
  };
  console.log("saveChit: Prepared chit data for API:", chitData);

  const method = chitId ? "PUT" : "POST";
  const url = chitId ? `/api/chits/${chitId}` : "/api/chits";

  fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chitData),
  })
    .then((response) => {
      console.log("saveChit: Received API response, status:", response.status);
      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    })
    .then((data) => {
      console.log("saveChit: Chit saved successfully:", data);
      alert("Chit saved successfully!");
      // Restore previous state and redirect to main view
      restorePreviousStateAndRedirect();
    })
    .catch((error) => {
      console.error("saveChit: Error saving chit:", error);
      alert("Error saving chit: " + error.message);
    });
}

function deleteChit() {
  console.log("deleteChit: Initiating delete operation...");
  const chitId = document.getElementById("chit_id")?.value;
  if (!chitId) {
    alert("No Chit ID found to delete.");
    console.warn("deleteChit: No chit ID available for deletion.");
    return;
  }

  if (!confirm("Are you sure you want to delete this chit?")) {
    console.log("deleteChit: Deletion cancelled by user.");
    return;
  }

  fetch(`/api/chits/${chitId}`, {
    method: "DELETE",
  })
    .then((response) => {
      console.log(
        "deleteChit: Received API response, status:",
        response.status,
      );
      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    })
    .then((data) => {
      console.log("deleteChit: Chit deleted successfully:", data);
      alert("Chit deleted successfully!");
      restorePreviousStateAndRedirect();
    })
    .catch((error) => {
      console.error("deleteChit: Error deleting chit:", error);
      alert("Error deleting chit: " + error.message);
    });
}

function cancelEdit() {
  console.log("cancelEdit: Cancelling edit, redirecting...");
  restorePreviousStateAndRedirect();
}

function restorePreviousStateAndRedirect() {
  console.log(
    "restorePreviousStateAndRedirect: Restoring state and redirecting to main page.",
  );
  // Set global currentTab and currentView based on previous state
  currentTab = previousState.tab;
  currentView = previousState.view;
  // Use URLSearchParams to pass state back to index.html
  window.location.href = `/?tab=${currentTab}&view=${currentView}`;
}

// --- Event Listeners ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired.");

  // Restore sidebar state on load
  restoreSidebarState();

  // Determine if we are on the main page or editor page
  if (document.body.classList.contains("editor-page")) {
    console.log("DOMContentLoaded: On editor-page.");
    initFlatpickrForEditor(); // Initialize Flatpickr for date/time pickers
    loadChitForEdit(); // Load chit data or initialize for new chit
  } else {
    console.log("DOMContentLoaded: On main-page (inferred).");
    // Initialize currentWeekStart immediately for the main page
    currentWeekStart = getWeekStart(new Date());

    // Fetch chits and then proceed with rendering
    fetchChits();

    // Restore state from URL params if returning from editor, after initial fetch
    const params = new URLSearchParams(window.location.search);
    const savedTab = params.get("tab");
    const savedView = params.get("view");

    if (savedTab) {
      currentTab = savedTab;
      console.log("DOMContentLoaded: Restored tab from URL:", currentTab);
    }
    if (savedView) {
      currentView = savedView;
      console.log("DOMContentLoaded: Restored view from URL:", currentView);
    }

    // Initialize currentTab based on URL or default. This will trigger initial display.
    switchTab(currentTab);

    // Editor page specific listeners (still might be defined here if main.js is shared)
    const saveChitButton = document.getElementById("save-chit-button");
    if (saveChitButton) {
      saveChitButton.addEventListener("click", saveChit);
    }
    const deleteChitButton = document.getElementById("delete-chit-button");
    if (deleteChitButton) {
      deleteChitButton.addEventListener("click", deleteChit);
    }
    const cancelEditButton = document.getElementById("cancel-edit-button");
    if (cancelEditButton) {
      cancelEditButton.addEventListener("click", cancelEdit);
    }
    const addChecklistItemButton = document.getElementById(
      "add-checklist-item-button",
    );
    if (addChecklistItemButton) {
      addChecklistItemButton.addEventListener("click", () =>
        addChecklistItem(),
      );
    }
  }
});

// Handle browser's back/forward buttons to preserve state
window.addEventListener("popstate", (event) => {
  console.log("Popstate event fired. Location:", window.location.href);
  const params = new URLSearchParams(window.location.search);
  const savedTab = params.get("tab") || "Calendar"; // Default to Calendar
  const savedView = params.get("view") || "Week"; // Default to Week

  // Apply state if on what we infer is the main page
  if (!document.body.classList.contains("editor-page")) {
    currentTab = savedTab;
    currentView = savedView;
    console.log(
      `Popstate: Restoring state to tab: ${currentTab}, view: ${currentView}`,
    );

    // Manually update active tab buttons as switchTab isn't called directly from popstate
    document.querySelectorAll(".tabs .tab").forEach((tabDiv) => {
      if (tabDiv.textContent === currentTab) {
        tabDiv.classList.add("active");
      } else {
        tabDiv.classList.remove("active");
      }
    });

    // Also ensure correct visibility of nav/view elements
    const calendarNav = document.getElementById("week-nav"); // Changed to week-nav
    const viewSelector = document.getElementById("view-select"); // Changed to view-select
    const filterSection = document.getElementById("filter-section");

    if (currentTab === "Calendar") {
      if (calendarNav) calendarNav.style.display = "flex";
      if (viewSelector) viewSelector.style.display = "block";
      if (filterSection) filterSection.style.display = "block";
    } else if (currentTab === "Checklists" || currentTab === "Tasks") {
      if (calendarNav) calendarNav.style.display = "none";
      if (viewSelector) viewSelector.style.display = "none";
      if (filterSection) filterSection.style.display = "block";
    } else {
      // For Alarms, Projects, Notes or other future tabs
      if (calendarNav) calendarNav.style.display = "none";
      if (viewSelector) viewSelector.style.display = "none";
      if (filterSection) filterSection.style.display = "none";
    }

    updateViewSelector(); // Update the actual dropdown selection
    displayChits(); // Re-render content based on restored state
  }
});
