/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Shared Sidebar — shared-sidebar.js
   Builds and injects the sidebar DOM, then wires behavior via Page_Context.

   Auto-injection: The IIFE at the bottom runs at parse time and injects the
   sidebar HTML if <body data-sidebar> is present. This mirrors the
   shared-page.js auto-injection pattern.

   Initialization: Each page calls _cwocInitSidebar(context) with a
   Page_Context object containing page-specific callbacks. Missing callbacks
   fall through to sensible defaults.

   Contains:
     - _cwocInjectSidebar()  — IIFE sidebar HTML builder/injector
     - _cwocInitSidebar(ctx) — Wires button handlers, toggle, filters, notifs
     - toggleSidebar()       — Sidebar open/close toggle
     - restoreSidebarState() — Restore from localStorage
     - toggleSidebarSection(), expandSidebarSection()
     - _toggleFiltersSection(), _expandFiltersSection()
     - toggleFilterGroup(), expandFilterGroup()
     - _toggleNotifInbox(), _fetchNotifications(), _updateNotifBadge()
     - _renderNotifInbox(), _respondNotification()

   Depends on:
     - shared.js: _isMobileOverlay, _showSidebarBackdrop, _hideSidebarBackdrop
     - shared-sidebar-filter.js: CwocSidebarFilter (optional)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Module state ────────────────────────────────────────────────────────── */

var _cwocSidebarContext = null;
var _notifInboxItems = [];

/* ── Sidebar HTML Injection (IIFE) ───────────────────────────────────────── */

/**
 * _cwocInjectSidebar() — Builds and injects the shared sidebar HTML.
 * Called automatically at parse time if body has data-sidebar attribute.
 * Produces the same DOM structure, IDs, and classes as the current
 * inline sidebar in index.html.
 */
function _cwocInjectSidebar() {
  if (!document.body || !document.body.dataset.sidebar) return;

  var sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  var html = '';

  /* ── Scrollable area ─────────────────────────────────────────────────── */
  html += '<div class="sidebar-scroll">';

  /* 1. Create Chit */
  html += '<div class="sidebar-section" id="section-create" style="margin-top:0;">';
  html += '  <button class="create-chit action-button" id="sidebar-create-btn">';
  html += '    <img src="/static/create_new.png" alt="" />';
  html += '    Create Chit';
  html += '  </button>';
  html += '</div>';

  /* Email controls — only visible on Email tab */
  html += '<div class="sidebar-section" id="section-email-controls" style="display:none;">';
  html += '  <button class="action-button sidebar-compact-btn" id="sidebar-check-mail-btn" style="margin-bottom:6px;">';
  html += '    <i class="fas fa-sync"></i> Check Mail';
  html += '  </button>';
  html += '  <div id="email-account-filter-wrap" style="margin-bottom:8px;"></div>';
  html += '  <div class="filter-group">';
  html += '    <label class="filter-group-label" onclick="var b=this.nextElementSibling;b.style.display=b.style.display===\'none\'?\'\':\'none\';this.querySelector(\'.filter-arrow\').textContent=b.style.display===\'none\'?\'▶\':\'▼\';">';
  html += '      <span class="filter-arrow">▼</span> Folder';
  html += '    </label>';
  html += '    <div class="filter-group-body">';
  html += '      <div class="multi-select" id="email-folder-select" style="max-height:none;">';
  html += '        <label class="email-folder-opt"><input type="radio" name="emailFolder" value="inbox" checked onchange="_setEmailSubFilter(\'inbox\')"> <i class="fas fa-inbox"></i> Inbox</label>';
  html += '        <label class="email-folder-opt"><input type="radio" name="emailFolder" value="sent" onchange="_setEmailSubFilter(\'sent\')"> <i class="fas fa-paper-plane"></i> Sent</label>';
  html += '        <label class="email-folder-opt"><input type="radio" name="emailFolder" value="drafts" onchange="_setEmailSubFilter(\'drafts\')"> <i class="fas fa-file-alt"></i> Drafts</label>';
  html += '      </div>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  /* Date nav */
  html += '<div id="year-week-container">';
  html += '  <button class="action-button today-btn" id="sidebar-today-btn"><i class="fas fa-calendar-days" style="margin-right:6px;"></i>Today</button>';
  html += '  <div class="week-nav" id="week-nav">';
  html += '    <button class="action-button" id="sidebar-prev-btn">◄</button>';
  html += '    <div class="week-nav-center">';
  html += '      <div id="year-display"></div>';
  html += '      <span class="week-range" id="week-range"></span>';
  html += '    </div>';
  html += '    <button class="action-button" id="sidebar-next-btn">►</button>';
  html += '  </div>';
  html += '</div>';

  /* 2. Order (always visible) */
  html += '<div class="sidebar-section" id="section-order">';
  html += '  <label class="sidebar-section-label">Order</label>';
  html += '  <div id="order-controls">';
  html += '    <select id="sort-select">';
  html += '      <option value="">— None —</option>';
  html += '      <option value="title">Title</option>';
  html += '      <option value="start">Start Date</option>';
  html += '      <option value="due">Due Date</option>';
  html += '      <option value="updated">Updated</option>';
  html += '      <option value="created">Created</option>';
  html += '      <option value="status">Status</option>';
  html += '      <option value="manual">Manual</option>';
  html += '      <option value="random">Random / Shuffle</option>';
  html += '      <option value="upcoming">Upcoming (Due Soon)</option>';
  html += '    </select>';
  html += '    <button id="sort-dir-btn" title="Toggle sort direction" style="display:none;">▲</button>';
  html += '  </div>';
  html += '</div>';

  /* 3. Time Period (always visible) */
  html += '<div class="sidebar-section" id="section-period">';
  html += '  <label class="sidebar-section-label">Time Period</label>';
  html += '  <select id="period-select">';
  html += '    <option value="Itinerary">Itinerary</option>';
  html += '    <option value="Day">Day</option>';
  html += '    <option value="Work">Work Hours</option>';
  html += '    <option value="Week" selected>Week</option>';
  html += '    <option value="SevenDay">X Days</option>';
  html += '    <option value="Month">Month</option>';
  html += '    <option value="Year">Year</option>';
  html += '  </select>';
  html += '</div>';

  /* 3b. Kanban toggle (only visible on Projects tab) */
  html += '<div class="sidebar-section" id="section-kanban" style="display:none;">';
  html += '  <label class="sidebar-section-label">View Mode</label>';
  html += '  <div style="display:flex;gap:4px;">';
  html += '    <button class="action-button" id="projects-mode-list" onclick="_setProjectsMode(\'list\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;">📋 List</button>';
  html += '    <button class="action-button" id="projects-mode-kanban" onclick="_setProjectsMode(\'kanban\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;background:ivory;">📊 Kanban</button>';
  html += '  </div>';
  html += '</div>';

  /* 3c. Alarms view mode toggle (only visible on Alarms tab) */
  html += '<div class="sidebar-section" id="section-alarms-mode" style="display:none;">';
  html += '  <label class="sidebar-section-label">View Mode</label>';
  html += '  <div style="display:flex;gap:4px;">';
  html += '    <button class="action-button" id="alarms-mode-list" onclick="_setAlarmsMode(\'list\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;background:ivory;">📋 Chits</button>';
  html += '    <button class="action-button" id="alarms-mode-independent" onclick="_setAlarmsMode(\'independent\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;">🛎️ Independent</button>';
  html += '  </div>';
  html += '</div>';

  /* 3e. Tasks view mode toggle (only visible on Tasks tab) */
  html += '<div class="sidebar-section" id="section-tasks-mode" style="display:none;">';
  html += '  <label class="sidebar-section-label">View Mode</label>';
  html += '  <div style="display:flex;gap:4px;">';
  html += '    <button class="action-button" id="tasks-mode-tasks" onclick="_setTasksMode(\'tasks\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;background:ivory;">📋 Tasks</button>';
  html += '    <button class="action-button" id="tasks-mode-habits" onclick="_setTasksMode(\'habits\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;">🎯 Habits</button>';
  html += '    <button class="action-button" id="tasks-mode-assigned" onclick="_setTasksMode(\'assigned\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:6px;">📌 Assigned</button>';
  html += '  </div>';
  html += '  <!-- Habits success window (only visible in habits mode) -->';
  html += '  <div id="habits-window-wrap" style="display:none;margin-top:8px;">';
  html += '    <label class="sidebar-section-label">Success Window</label>';
  html += '    <select id="habits-success-window-sidebar" onchange="_onHabitsWindowChange(this.value)" style="width:100%;padding:4px 6px;font-family:inherit;font-size:0.85em;border:1px solid #8b5a2b;border-radius:4px;background:#f5e6cc;">';
  html += '      <option value="7">Last 7 days</option>';
  html += '      <option value="30" selected>Last 30 days</option>';
  html += '      <option value="90">Last 90 days</option>';
  html += '      <option value="all">All time</option>';
  html += '    </select>';
  html += '  </div>';
  html += '</div>';

  /* 3d. Indicators time range (only visible on Indicators tab) */
  html += '<div class="sidebar-section" id="section-indicators" style="display:none;">';
  html += '  <label class="sidebar-section-label">Time Range</label>';
  html += '  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
  html += '    <button class="action-button _ind-btn _ind-active" onclick="_indicatorsSetRange(\'day\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:5px;">Day</button>';
  html += '    <button class="action-button _ind-btn" onclick="_indicatorsSetRange(\'week\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:5px;">Week</button>';
  html += '    <button class="action-button _ind-btn" onclick="_indicatorsSetRange(\'month\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:5px;">Month</button>';
  html += '    <button class="action-button _ind-btn" onclick="_indicatorsSetRange(\'year\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:5px;">Year</button>';
  html += '    <button class="action-button _ind-btn" onclick="_indicatorsSetRange(\'all\')" style="flex:1;margin-bottom:0;font-size:0.8em;padding:5px;">All</button>';
  html += '  </div>';
  html += '  <label class="sidebar-section-label">Custom Range</label>';
  html += '  <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">';
  html += '    <input type="date" id="ind-start" style="width:100%;padding:4px;font-family:inherit;font-size:0.8em;border:1px solid #6b4e31;border-radius:3px;box-sizing:border-box;background:#f5e6cc;" />';
  html += '    <input type="date" id="ind-end" style="width:100%;padding:4px;font-family:inherit;font-size:0.8em;border:1px solid #6b4e31;border-radius:3px;box-sizing:border-box;background:#f5e6cc;" />';
  html += '    <button class="action-button" onclick="_indicatorsLoadCustomRange()" style="margin-bottom:0;font-size:0.8em;padding:5px;">Go</button>';
  html += '  </div>';
  html += '  <label class="sidebar-section-label">Show Indicators</label>';
  html += '  <div class="multi-select" id="ind-select" style="max-height:200px;">';
  html += '    <label><input type="checkbox" data-ind="heart_rate" onchange="_indSaveSelection();_indicatorsLoad()" checked /> ❤️ Heart Rate</label>';
  html += '    <label><input type="checkbox" data-ind="bp_systolic" onchange="_indSaveSelection();_indicatorsLoad()" checked /> 🩸 Blood Pressure</label>';
  html += '    <label><input type="checkbox" data-ind="spo2" onchange="_indSaveSelection();_indicatorsLoad()" checked /> 🫁 Oxygen Sat.</label>';
  html += '    <label><input type="checkbox" data-ind="temperature" onchange="_indSaveSelection();_indicatorsLoad()" checked /> 🌡️ Temperature</label>';
  html += '    <label><input type="checkbox" data-ind="weight" onchange="_indSaveSelection();_indicatorsLoad()" checked /> ⚖️ Weight</label>';
  html += '    <label><input type="checkbox" data-ind="height" onchange="_indSaveSelection();_indicatorsLoad()" /> 📐 Height</label>';
  html += '    <label><input type="checkbox" data-ind="glucose" onchange="_indSaveSelection();_indicatorsLoad()" checked /> 🍬 Glucose</label>';
  html += '    <label><input type="checkbox" data-ind="distance" onchange="_indSaveSelection();_indicatorsLoad()" /> 🏃 Distance</label>';
  html += '  </div>';
  html += '</div>';

  /* 4. Filters — collapsible section */
  html += '<div class="sidebar-section" id="section-filters">';
  html += '  <div style="display:flex;gap:6px;align-items:center;">';
  html += '    <label class="filter-group-label" id="filters-toggle-btn" style="flex:1;margin:0;" onclick="var b=document.getElementById(\'filters-body\');b.style.display=b.style.display===\'none\'?\'\':\'none\';this.querySelector(\'.filter-arrow\').textContent=b.style.display===\'none\'?\'▶\':\'▼\';">';
  html += '      <span class="filter-arrow">▶</span> <i class="fas fa-filter" style="font-size:0.85em;"></i> Filters';
  html += '    </label>';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-clear-all-btn" title="Clear all filters, search, and sort" style="margin-bottom:0;display:none;flex-shrink:0;font-size:0.75em;padding:4px 8px;">';
  html += '      <i class="fas fa-times-circle"></i>&nbsp;Clear';
  html += '    </button>';
  html += '    <button class="action-button sidebar-compact-btn" id="reset-defaults-btn" title="Reset search to this tab\'s default filter" style="margin-bottom:0;display:none;flex-shrink:0;font-size:0.75em;padding:4px 8px;">';
  html += '      <i class="fas fa-undo"></i>&nbsp;Defaults';
  html += '    </button>';
  html += '  </div>';
  html += '  <div id="filters-body" style="display:none;">';

  /* Words */
  html += '  <div class="filter-group" id="filter-words">';
  html += '    <label class="filter-label">Filter Text</label>';
  html += '    <input type="text" id="search" placeholder="Filter Chits..." />';
  html += '    <div id="saved-searches" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;"></div>';
  html += '  </div>';

  /* Status */
  html += '  <div class="filter-group" id="filter-status">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-status\')">';
  html += '      <span class="section-toggle">▶</span> Status';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <div class="multi-select" id="status-multi">';
  html += '        <label><input type="checkbox" value="" data-filter="status" data-any="true" checked /> — Any</label>';
  html += '        <label><input type="checkbox" value="ToDo" data-filter="status" /> ToDo</label>';
  html += '        <label><input type="checkbox" value="In Progress" data-filter="status" /> In Progress</label>';
  html += '        <label><input type="checkbox" value="Blocked" data-filter="status" /> Blocked</label>';
  html += '        <label><input type="checkbox" value="Complete" data-filter="status" /> Complete</label>';
  html += '      </div>';
  html += '      <button class="filter-clear-btn" onclick="clearFilterGroup(\'status-multi\')">Clear</button>';
  html += '    </div>';
  html += '  </div>';

  /* Priority */
  html += '  <div class="filter-group" id="filter-priority">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-priority\')">';
  html += '      <span class="section-toggle">▶</span> Priority';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <div class="multi-select" id="priority-multi">';
  html += '        <label><input type="checkbox" value="" data-filter="priority" data-any="true" checked /> — Any</label>';
  html += '        <label><input type="checkbox" value="Low" data-filter="priority" /> Low</label>';
  html += '        <label><input type="checkbox" value="Medium" data-filter="priority" /> Medium</label>';
  html += '        <label><input type="checkbox" value="High" data-filter="priority" /> High</label>';
  html += '      </div>';
  html += '      <button class="filter-clear-btn" onclick="clearFilterGroup(\'priority-multi\')">Clear</button>';
  html += '    </div>';
  html += '  </div>';

  /* Tags */
  html += '  <div class="filter-group" id="filter-label">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-label\')">';
  html += '      <span class="section-toggle">▶</span> Tags';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <input type="text" id="tag-filter-search" placeholder="Search tags..." oninput="_filterTagCheckboxes()" style="width:100%;padding:3px 6px;font-size:0.8em;margin-bottom:3px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;" />';
  html += '      <div class="multi-select" id="label-multi"></div>';
  html += '      <button class="filter-clear-btn" onclick="clearFilterGroup(\'label-multi\')">Clear</button>';
  html += '    </div>';
  html += '  </div>';

  /* People */
  html += '  <div class="filter-group" id="filter-people">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-people\')">';
  html += '      <span class="section-toggle">▶</span> People';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <div id="people-multi"></div>';
  html += '      <button class="filter-clear-btn" onclick="clearPeopleFilter()">Clear</button>';
  html += '    </div>';
  html += '  </div>';

  /* Project */
  html += '  <div class="filter-group" id="filter-project">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-project\')">';
  html += '      <span class="section-toggle">▶</span> Project';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <select id="project-filter-select" class="cwoc-project-filter-select" onchange="_onProjectFilterChange()">';
  html += '        <option value="" class="project-filter-meta">—</option>';
  html += '        <option value="__any__" class="project-filter-meta">Any (has a project)</option>';
  html += '        <option value="__none__" class="project-filter-meta">None (no project)</option>';
  html += '      </select>';
  html += '      <button class="filter-clear-btn" onclick="_clearProjectFilter()">Clear</button>';
  html += '    </div>';
  html += '  </div>';

  /* Show (Archive/Pinned) */
  html += '  <div class="filter-group" id="filter-archive">';
  html += '    <label class="filter-label" onclick="toggleFilterGroup(\'filter-archive\')">';
  html += '      <span class="section-toggle">▶</span> Display';
  html += '    </label>';
  html += '    <div class="filter-group-body" style="display:none;">';
  html += '      <div class="multi-select">';
  html += '        <label><input type="checkbox" id="show-pinned" checked /> <i class="fas fa-bookmark" style="color:#8b5a2b;"></i> Pinned</label>';
  html += '        <label><input type="checkbox" id="show-archived" /> 📦 Archived</label>';
  html += '        <label><input type="checkbox" id="show-unmarked" checked /> 📄 Unmarked</label>';
  html += '        <hr style="border:0;border-top:1px dashed #c4a882;margin:4px 0;" />';
  html += '        <label><input type="checkbox" id="hide-past-due" /> 🚫 Hide Past-Due</label>';
  html += '        <label><input type="checkbox" id="hide-complete" /> ✅ Hide Complete</label>';
  html += '        <label><input type="checkbox" id="hide-declined" /> 🚫 Hide Declined</label>';
  html += '        <label><input type="checkbox" id="hide-habits" /> 🎯 Hide Habits</label>';
  html += '        <label><input type="checkbox" id="hide-email-received" checked /> 📨 Hide Email (Received)</label>';
  html += '        <label><input type="checkbox" id="hide-email-sent" checked /> 📤 Hide Email (Sent)</label>';
  html += '        <hr style="border:0;border-top:1px dashed #c4a882;margin:4px 0;" />';
  html += '        <label><input type="checkbox" id="filter-shared-with-me" /> 🔗 Shared with me</label>';
  html += '        <label><input type="checkbox" id="filter-shared-by-me" /> 📤 Shared by me</label>';
  html += '      </div>';
  html += '    </div>';
  html += '  </div>';

  html += '  </div>'; /* /filters-body */
  html += '</div>'; /* /section-filters */

  /* People, Maps, Weather, Clock, Kiosk, Calculator */
  html += '<div class="sidebar-section" id="section-settings">';
  html += '  <button class="action-button" id="sidebar-contacts-btn" style="margin-bottom:6px;">';
  html += '    <i class="fas fa-address-book" style="font-size:1.1em;vertical-align:middle;margin-right:4px;"></i>';
  html += '    People';
  html += '  </button>';
  html += '  <div style="display:flex;gap:6px;">';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-maps-btn" title="Maps View">';
  html += '      🗺️ Maps';
  html += '    </button>';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-weather-btn" title="Weather (click: full page, Shift+click: modal)">';
  html += '      🌤️ Weather';
  html += '    </button>';
  html += '  </div>';
  html += '  <div style="display:flex;gap:6px;margin-top:6px;">';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-clock-btn" title="Live clocks (L)">';
  html += '      🕐 Clock';
  html += '    </button>';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-kiosk-btn" title="Kiosk View">';
  html += '      📺 Kiosk';
  html += '    </button>';
  html += '  </div>';
  html += '  <div style="display:flex;gap:6px;margin-top:6px;">';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-calculator-btn" title="Calculator (F4)">';
  html += '      🧮 Calculator';
  html += '    </button>';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-rules-btn" title="Rules Engine (F10)">';
  html += '      🤖 Rules';
  html += '    </button>';
  html += '  </div>';
  html += '</div>';

  /* Notification Inbox */
  html += '<div class="sidebar-section" id="section-notif-inbox">';
  html += '  <button class="action-button cwoc-notif-inbox-btn" id="notif-inbox-btn" title="Sharing notifications">';
  html += '    🔔 Notifications <span class="cwoc-notif-badge" id="notif-badge" style="display:none;">0</span>';
  html += '  </button>';
  html += '  <div class="cwoc-notif-inbox-list" id="notif-inbox-list" style="display:none;"></div>';
  html += '</div>';

  html += '</div>'; /* /sidebar-scroll */

  /* Bottom pinned: Settings, Reference, Help */
  html += '<div class="sidebar-bottom">';
  html += '  <button class="action-button" id="sidebar-settings-btn" style="margin-bottom:6px;">';
  html += '    <img src="/static/settings.png" alt="Settings" />';
  html += '    Settings';
  html += '  </button>';
  html += '  <div style="display:flex;gap:6px;">';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-reference-btn" title="Keyboard shortcuts reference (R)">';
  html += '      📖 Reference';
  html += '    </button>';
  html += '    <button class="action-button sidebar-compact-btn" id="sidebar-help-btn" title="Feature guide & documentation (Shift+R)">';
  html += '      📘 Help';
  html += '    </button>';
  html += '  </div>';
  html += '  <div id="sidebar-version-footer" style="text-align:center;padding:6px 0 2px;font-size:0.65em;opacity:0.45;">';
  html += '    <a href="https://www.cwholemaniii.com/pages/home.shtml" target="_blank" id="sidebar-version-link" title="" style="color:inherit;text-decoration:none;">C.W.\'s Omni Chits</a>';
  html += '  </div>';
  html += '</div>';

  sidebar.innerHTML = html;

  /* Insert as first child of body */
  document.body.insertBefore(sidebar, document.body.firstChild);
}

/* Run injection immediately at parse time */
(function() {
  _cwocInjectSidebar();
})();


/* ── Sidebar Behavior Initialization ─────────────────────────────────────── */

/**
 * _cwocInitSidebar(context) — Initializes sidebar behavior.
 * @param {Object} context — Page_Context with callbacks and config.
 */
function _cwocInitSidebar(context) {
  context = context || {};
  _cwocSidebarContext = context;

  var sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    console.warn('[shared-sidebar] #sidebar not found — was _cwocInjectSidebar() called?');
    return;
  }

  /* ── Default callbacks ───────────────────────────────────────────────── */
  var defaults = {
    onCreateChit: function() { window.location.href = '/frontend/html/editor.html'; },
    onToday: function() {},
    onPeriodChange: function() {},
    onPreviousPeriod: function() {},
    onNextPeriod: function() {},
    onFilterChange: function() {},
    onClearFilters: function() {
      /* Default: reset all checkbox/select elements in filters section */
      var filtersBody = document.getElementById('filters-body');
      if (filtersBody) {
        filtersBody.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
        filtersBody.querySelectorAll('input[data-any="true"]').forEach(function(cb) { cb.checked = true; });
        filtersBody.querySelectorAll('input[type="text"]').forEach(function(inp) { inp.value = ''; });
        filtersBody.querySelectorAll('select').forEach(function(sel) { sel.selectedIndex = 0; });
      }
    },
    onContactsClick: function() { window.location.href = '/frontend/html/people.html'; },
    onClockClick: function() {},
    onWeatherClick: function() { window.location.href = '/frontend/html/weather.html'; },
    onMapsClick: function() { window.location.href = '/maps'; },
    onKioskClick: function() { window.location.href = '/kiosk'; },
    onCalculatorClick: function() { if (typeof cwocToggleCalculator === 'function') cwocToggleCalculator(); },
    onRulesClick: function() { window.location.href = '/frontend/html/rules-manager.html'; },
    onSettingsClick: function() {
      if (typeof storePreviousState === 'function') storePreviousState();
      localStorage.setItem('cwoc_settings_return', '/');
      window.location.href = '/frontend/html/settings.html';
    },
    onReferenceClick: function() {},
    onHelpClick: function() { window.location.href = '/frontend/html/help.html'; },
    onNotificationToggle: function() { _toggleNotifInbox(); },
    onSortChange: function() {},
    onSortDirToggle: function() {}
  };

  function _cb(name) {
    return context[name] || defaults[name] || function() {};
  }

  /* ── Wire button onclick handlers ────────────────────────────────────── */

  var createBtn = document.getElementById('sidebar-create-btn');
  if (createBtn) {
    createBtn.onclick = function() { _cb('onCreateChit')(); };
    createBtn.onauxclick = function() { window.open('/frontend/html/editor.html', '_blank'); };
  }

  /* Wire email sidebar Check Mail button */
  var checkMailBtn = document.getElementById('sidebar-check-mail-btn');
  if (checkMailBtn) {
    checkMailBtn.onclick = function() {
      if (typeof _checkMail === 'function') _checkMail();
    };
  }

  var todayBtn = document.getElementById('sidebar-today-btn');
  if (todayBtn) todayBtn.onclick = function() { _cb('onToday')(); };

  var prevBtn = document.getElementById('sidebar-prev-btn');
  if (prevBtn) prevBtn.onclick = function() { _cb('onPreviousPeriod')(); };

  var nextBtn = document.getElementById('sidebar-next-btn');
  if (nextBtn) nextBtn.onclick = function() { _cb('onNextPeriod')(); };

  var sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.onchange = function() { _cb('onSortChange')(); };

  var sortDirBtn = document.getElementById('sort-dir-btn');
  if (sortDirBtn) sortDirBtn.onclick = function() { _cb('onSortDirToggle')(); };

  var periodSelect = document.getElementById('period-select');
  if (periodSelect) periodSelect.onchange = function() { _cb('onPeriodChange')(); };

  /* Contacts */
  var contactsBtn = document.getElementById('sidebar-contacts-btn');
  if (contactsBtn) contactsBtn.onclick = function() { _cb('onContactsClick')(); };

  /* Clock */
  var clockBtn = document.getElementById('sidebar-clock-btn');
  if (clockBtn) clockBtn.onclick = function() { _cb('onClockClick')(); };

  /* Weather */
  var weatherBtn = document.getElementById('sidebar-weather-btn');
  if (weatherBtn) {
    weatherBtn.id = 'cal-weather-btn'; /* preserve ID for existing CSS/hotkey references */
    weatherBtn.onclick = function(e) { _cb('onWeatherClick')(e); };
  }

  /* Maps */
  var mapsBtn = document.getElementById('sidebar-maps-btn');
  if (mapsBtn) mapsBtn.onclick = function() {
    if (typeof storePreviousState === 'function') storePreviousState();
    _cb('onMapsClick')();
  };

  /* Kiosk */
  var kioskBtn = document.getElementById('sidebar-kiosk-btn');
  if (kioskBtn) kioskBtn.onclick = function() {
    if (typeof storePreviousState === 'function') storePreviousState();
    _cb('onKioskClick')();
  };

  /* Calculator */
  var calcBtn = document.getElementById('sidebar-calculator-btn');
  if (calcBtn) calcBtn.onclick = function() { _cb('onCalculatorClick')(); };

  /* Rules */
  var rulesBtn = document.getElementById('sidebar-rules-btn');
  if (rulesBtn) rulesBtn.onclick = function() { _cb('onRulesClick')(); };

  /* Settings */
  var settingsBtn = document.getElementById('sidebar-settings-btn');
  if (settingsBtn) settingsBtn.onclick = function() { _cb('onSettingsClick')(); };

  /* Reference */
  var refBtn = document.getElementById('sidebar-reference-btn');
  if (refBtn) refBtn.onclick = function() { _cb('onReferenceClick')(); };

  /* Help */
  var helpBtn = document.getElementById('sidebar-help-btn');
  if (helpBtn) helpBtn.onclick = function() { _cb('onHelpClick')(); };

  /* Notifications */
  var notifBtn = document.getElementById('notif-inbox-btn');
  if (notifBtn) notifBtn.onclick = function() { _cb('onNotificationToggle')(); };

  /* Filters toggle is now handled by inline onclick on the label */

  /* Search input — wire onkeyup to filter change if page provides searchChits */
  var searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.onkeyup = function() {
      if (typeof searchChits === 'function') searchChits();
      else _cb('onFilterChange')();
    };
  }

  /* Wire filter checkbox onchange events to page callback */
  _wireFilterCheckboxes(context);

  /* ── Clear Filters + Show/Hide ───────────────────────────────────────── */
  var clearAllBtn = document.getElementById('sidebar-clear-all-btn');
  if (clearAllBtn) clearAllBtn.onclick = function() {
    _cb('onClearFilters')();
    _updateClearAllButton();
  };

  /* ── Populate period dropdown from context ───────────────────────────── */
  if (context.periodOptions && periodSelect) {
    periodSelect.innerHTML = '';
    context.periodOptions.forEach(function(opt) {
      var option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.selected) option.selected = true;
      periodSelect.appendChild(option);
    });
  }

  /* ── Current page highlighting ───────────────────────────────────────── */
  if (context.currentPage) {
    var navMap = {
      'home': null,
      'maps': document.getElementById('sidebar-maps-btn'),
      'contacts': contactsBtn,
      'settings': settingsBtn
    };
    var highlightBtn = navMap[context.currentPage];
    if (highlightBtn) {
      highlightBtn.style.opacity = '0.6';
      highlightBtn.style.pointerEvents = 'none';
      highlightBtn.title = 'You are here';
    }
  }

  /* ── Sidebar toggle + localStorage persistence ───────────────────────── */
  restoreSidebarState();

  /* ── Mobile backdrop ─────────────────────────────────────────────────── */
  if (typeof initMobileSidebar === 'function') {
    initMobileSidebar();
  }

  /* ── Load tag and people filters ─────────────────────────────────────── */
  if (context.loadTagFilters) {
    try { context.loadTagFilters(); } catch (e) { console.warn('[shared-sidebar] loadTagFilters error:', e); }
  }
  if (context.loadPeopleFilters) {
    try { context.loadPeopleFilters(); } catch (e) { console.warn('[shared-sidebar] loadPeopleFilters error:', e); }
  }

  /* ── Fetch and render notifications ──────────────────────────────────── */
  _fetchNotifications();

  /* ── Fetch version for sidebar footer ────────────────────────────────── */
  _fetchSidebarVersion();
}


/* ── Filter checkbox wiring ──────────────────────────────────────────────── */

/**
 * Wire onchange events on filter checkboxes to invoke the page's onFilterChange.
 * This replaces the inline onchange="onFilterChange()" from the old HTML.
 */
function _wireFilterCheckboxes(context) {
  var cb = function() {
    if (context && context.onFilterChange) context.onFilterChange();
    _updateClearAllButton();
  };

  /* Status checkboxes */
  var statusMulti = document.getElementById('status-multi');
  if (statusMulti) {
    statusMulti.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
      input.onchange = function() {
        if (input.dataset.any === 'true') {
          if (typeof onFilterAnyToggle === 'function') onFilterAnyToggle(input);
        } else {
          if (typeof onFilterSpecificToggle === 'function') onFilterSpecificToggle('status');
        }
        cb();
      };
    });
  }

  /* Priority checkboxes */
  var priorityMulti = document.getElementById('priority-multi');
  if (priorityMulti) {
    priorityMulti.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
      input.onchange = function() {
        if (input.dataset.any === 'true') {
          if (typeof onFilterAnyToggle === 'function') onFilterAnyToggle(input);
        } else {
          if (typeof onFilterSpecificToggle === 'function') onFilterSpecificToggle('priority');
        }
        cb();
      };
    });
  }

  /* Display checkboxes (show-pinned, show-archived, etc.) */
  var displayIds = ['show-pinned', 'show-archived', 'show-unmarked', 'hide-past-due', 'hide-complete', 'hide-declined', 'hide-habits', 'hide-email-received', 'hide-email-sent', 'filter-shared-with-me', 'filter-shared-by-me'];
  displayIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.onchange = function() { cb(); };
  });
}

/* ── Clear All button visibility ─────────────────────────────────────────── */

/**
 * _updateClearAllButton() — Show the Clear All button next to the Filters
 * toggle if any filter is in a non-default state. Called after filter changes.
 * Pages can also call their own _updateClearFiltersButton() for additional logic.
 */
function _updateClearAllButton() {
  var btn = document.getElementById('sidebar-clear-all-btn');
  if (!btn) return;

  /* Check all possible non-default filter states */
  var hasStatusFilter = false;
  var statusCbs = document.querySelectorAll('#status-multi input[data-filter="status"]:checked');
  for (var i = 0; i < statusCbs.length; i++) {
    if (statusCbs[i].value) { hasStatusFilter = true; break; }
  }

  var hasPriorityFilter = false;
  var priorityCbs = document.querySelectorAll('#priority-multi input[data-filter="priority"]:checked');
  for (var j = 0; j < priorityCbs.length; j++) {
    if (priorityCbs[j].value) { hasPriorityFilter = true; break; }
  }

  var searchText = '';
  var searchEl = document.getElementById('search');
  if (searchEl) searchText = searchEl.value || '';

  var hasTagFilter = (window._sidebarTagSelection && window._sidebarTagSelection.length > 0)
    || (window._mapsChitsFilterTags && window._mapsChitsFilterTags.length > 0);
  var hasPeopleFilter = (window._sidebarPeopleSelection && window._sidebarPeopleSelection.length > 0)
    || (window._mapsChitsFilterPeople && window._mapsChitsFilterPeople.length > 0);

  /* Display toggles — non-default states */
  var showPinned = document.getElementById('show-pinned');
  var showArchived = document.getElementById('show-archived');
  var showUnmarked = document.getElementById('show-unmarked');
  var hidePastDue = document.getElementById('hide-past-due');
  var hideComplete = document.getElementById('hide-complete');
  var hideDeclined = document.getElementById('hide-declined');
  var hideHabits = document.getElementById('hide-habits');
  var hideEmailReceived = document.getElementById('hide-email-received');
  var hideEmailSent = document.getElementById('hide-email-sent');
  var hasDisplayFilter = (showPinned && !showPinned.checked)
    || (showArchived && showArchived.checked)
    || (showUnmarked && !showUnmarked.checked)
    || (hidePastDue && hidePastDue.checked)
    || (hideComplete && hideComplete.checked)
    || (hideDeclined && hideDeclined.checked)
    || (hideHabits && hideHabits.checked)
    || (hideEmailReceived && !hideEmailReceived.checked)
    || (hideEmailSent && !hideEmailSent.checked);

  /* Sharing filters (now part of Display group) */
  var hasSharingFilter = (document.getElementById('filter-shared-with-me') || {}).checked
    || (document.getElementById('filter-shared-by-me') || {}).checked;

  /* Sort */
  var hasSort = !!(typeof currentSortField !== 'undefined' && currentSortField);

  /* Project filter */
  var projectSel = document.getElementById('project-filter-select');
  var hasProjectFilter = projectSel && projectSel.value;

  var hasAnyFilter = hasStatusFilter || hasPriorityFilter || searchText || hasTagFilter
    || hasPeopleFilter || hasDisplayFilter || hasSharingFilter || hasSort || hasProjectFilter;

  btn.style.display = hasAnyFilter ? '' : 'none';
}

/* ── Sidebar toggle / section expand / collapse ──────────────────────────── */

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('active');
  if (sidebar.classList.contains('active')) {
    localStorage.setItem('sidebarState', 'open');
  } else {
    localStorage.setItem('sidebarState', 'closed');
  }

  if (typeof _isMobileOverlay === 'function' && _isMobileOverlay()) {
    if (sidebar.classList.contains('active')) {
      if (typeof _showSidebarBackdrop === 'function') _showSidebarBackdrop();
    } else {
      if (typeof _hideSidebarBackdrop === 'function') _hideSidebarBackdrop();
    }
  }

  window.dispatchEvent(new Event('resize'));
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 350);
}

function restoreSidebarState() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    console.error('Sidebar element not found');
    return;
  }
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
    return;
  }
  var savedState = localStorage.getItem('sidebarState');
  if (savedState === 'closed') {
    sidebar.classList.remove('active');
  } else {
    sidebar.classList.add('active');
  }
}

/** Toggle a sidebar section's body visibility */
function toggleSidebarSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;
  var body = section.querySelector('.sidebar-section-body');
  var toggle = section.querySelector('.section-toggle');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

/** Expand a sidebar section (used by hotkeys) */
function expandSidebarSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;
  var body = section.querySelector('.sidebar-section-body');
  var toggle = section.querySelector('.section-toggle');
  if (body) body.style.display = '';
  if (toggle) toggle.textContent = '▼';
}

/** Toggle the entire Filters section open/closed */
function _toggleFiltersSection() {
  var body = document.getElementById('filters-body');
  var label = document.getElementById('filters-toggle-btn');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (label) {
    var arrow = label.querySelector('.filter-arrow');
    if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
  }
}

/** Ensure filters section is expanded (used by hotkeys) */
function _expandFiltersSection() {
  var body = document.getElementById('filters-body');
  var label = document.getElementById('filters-toggle-btn');
  if (body) body.style.display = '';
  if (label) {
    var arrow = label.querySelector('.filter-arrow');
    if (arrow) arrow.textContent = '▼';
  }
}

/** Toggle a filter sub-group's body */
function toggleFilterGroup(groupId) {
  var group = document.getElementById(groupId);
  if (!group) return;
  var body = group.querySelector('.filter-group-body');
  var toggle = group.querySelector('.section-toggle');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

/** Expand a filter sub-group (used by hotkeys) */
function expandFilterGroup(groupId) {
  var group = document.getElementById(groupId);
  if (!group) return;
  var body = group.querySelector('.filter-group-body');
  var toggle = group.querySelector('.section-toggle');
  if (body) body.style.display = '';
  if (toggle) toggle.textContent = '▼';
}

/* ── Topbar toggle (dashboard-specific but kept here for shared access) ─── */

/** Toggle the topbar (header) visibility. Persists to localStorage. */
function _toggleTopbar() {
  var header = document.querySelector('.main-content > .header');
  if (!header) return;
  var isHidden = header.style.display === 'none';
  header.style.display = isHidden ? '' : 'none';
  localStorage.setItem('cwoc_topbar_hidden', isHidden ? 'false' : 'true');
  var chitList = document.getElementById('chit-list');
  if (chitList) {
    if (!isHidden) {
      chitList.style.marginTop = '0';
      chitList.style.height = '100vh';
    } else {
      chitList.style.marginTop = '';
      chitList.style.height = '';
    }
  }
  window.dispatchEvent(new Event('resize'));
}

/** Restore topbar visibility from localStorage on load. */
function _restoreTopbarState() {
  var hidden = localStorage.getItem('cwoc_topbar_hidden') === 'true';
  if (hidden) {
    var header = document.querySelector('.main-content > .header');
    if (header) header.style.display = 'none';
    var chitList = document.getElementById('chit-list');
    if (chitList) {
      chitList.style.marginTop = '0';
      chitList.style.height = '100vh';
    }
  }
}

/* ── Notification Inbox ──────────────────────────────────────────────────── */

/** Toggle the notification inbox expanded/collapsed. */
function _toggleNotifInbox() {
  var list = document.getElementById('notif-inbox-list');
  if (!list) return;
  var isHidden = list.style.display === 'none';
  list.style.display = isHidden ? '' : 'none';
  if (isHidden) _renderNotifInbox();
}

/** Fetch notifications from the API and update the badge + cached list. */
async function _fetchNotifications() {
  try {
    var resp = await fetch('/api/notifications');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var all = await resp.json();
    _notifInboxItems = Array.isArray(all) ? all.filter(function(n) { return n.status === 'pending'; }) : [];
    _updateNotifBadge();
    var list = document.getElementById('notif-inbox-list');
    if (list && list.style.display !== 'none') _renderNotifInbox();
  } catch (e) {
    console.error('Failed to fetch notifications:', e);
    _notifInboxItems = [];
    _updateNotifBadge();
  }
}

/** Update the badge count on the inbox button. */
function _updateNotifBadge() {
  var badge = document.getElementById('notif-badge');
  if (!badge) return;
  var count = _notifInboxItems.length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

/** Render the expanded notification list. */
function _renderNotifInbox() {
  var list = document.getElementById('notif-inbox-list');
  if (!list) return;
  list.innerHTML = '';

  if (_notifInboxItems.length === 0) {
    list.innerHTML = '<div class="cwoc-notif-empty">No pending notifications</div>';
    return;
  }

  _notifInboxItems.forEach(function(notif) {
    var card = document.createElement('div');
    card.className = 'cwoc-notif-card';
    card.dataset.notifId = notif.id;

    var titleLink = document.createElement('a');
    titleLink.className = 'cwoc-notif-title';
    titleLink.textContent = notif.chit_title || '(Untitled chit)';
    titleLink.href = '/frontend/html/editor.html?id=' + encodeURIComponent(notif.chit_id);
    titleLink.title = 'Open chit in editor';
    titleLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = this.href;
    });
    card.appendChild(titleLink);

    var ownerLine = document.createElement('div');
    ownerLine.className = 'cwoc-notif-owner';
    var typeLabel = notif.notification_type === 'assigned' ? 'assigned by' : 'from';
    ownerLine.textContent = typeLabel + ' ' + (notif.owner_display_name || 'Unknown');
    card.appendChild(ownerLine);

    var actions = document.createElement('div');
    actions.className = 'cwoc-notif-actions';

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'cwoc-notif-accept-btn';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', function() { _respondNotification(notif.id, 'accepted'); });
    actions.appendChild(acceptBtn);

    var declineBtn = document.createElement('button');
    declineBtn.className = 'cwoc-notif-decline-btn';
    declineBtn.textContent = 'Decline';
    declineBtn.addEventListener('click', function() { _respondNotification(notif.id, 'declined'); });
    actions.appendChild(declineBtn);

    card.appendChild(actions);
    list.appendChild(card);
  });
}

/** Accept or decline a notification via PATCH, then remove from list. */
async function _respondNotification(notifId, status) {
  try {
    var resp = await fetch('/api/notifications/' + encodeURIComponent(notifId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _notifInboxItems = _notifInboxItems.filter(function(n) { return n.id !== notifId; });
    _updateNotifBadge();
    _renderNotifInbox();
    if (typeof fetchChits === 'function') fetchChits();
  } catch (e) {
    console.error('Failed to ' + status + ' notification ' + notifId + ':', e);
  }
}

/* ── Version footer ──────────────────────────────────────────────────────── */

/** Fetch version from /api/version and populate the sidebar footer. */
function _fetchSidebarVersion() {
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : {}; }).then(function(d) {
    var link = document.getElementById('sidebar-version-link');
    if (link && d.version) {
      link.title = '\u00A9 2026 C.W.\'s Omni Chits \u00B7 v' + d.version + ' \u00B7 www.cwholemaniii.com';
    }
  }).catch(function(e) {
    console.error('Failed to fetch version:', e);
  });
}
