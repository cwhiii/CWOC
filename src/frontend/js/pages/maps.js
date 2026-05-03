/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Maps Page — maps.js
   Displays chits with location data as interactive markers on a Leaflet map.
   Color-coded by status, clustered, with date range filtering.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Module-level state ───────────────────────────────────────────────────────

var _mapsLeafletMap = null;
var _mapsClusterGroup = null;
var _mapsAllChits = [];
var _mapsGeocodeCache = {};

// ── People Mode state ────────────────────────────────────────────────────────

var MAPS_MODE_KEY = 'cwoc_maps_mode';
var _mapsCurrentMode = 'chits';
var _mapsAllContacts = [];
var _mapsPeopleClusterGroup = null;
var _mapsContactGeocodeCache = {};

// Focus mode flag — when true, skip fitBounds on marker placement
var _mapsFocusMode = false;

// Chits filter state
var _mapsChitsFilterStatus = [];
var _mapsChitsFilterTags = [];
var _mapsChitsFilterPriority = [];
var _mapsChitsFilterPeople = [];
var _mapsChitsFilterText = '';

// People filter state
var _mapsPeopleFilterText = '';
var _mapsPeopleFilterFavoritesOnly = false;
var _mapsPeopleFilterTags = [];

// ── Status → Color mapping ───────────────────────────────────────────────────

var _mapsStatusColors = {
  'ToDo':        '#2196F3',
  'In Progress': '#FF9800',
  'Blocked':     '#F44336',
  'Complete':    '#4CAF50'
};
var _mapsNoStatusColor = '#9E9E9E';

// ── Loading Indicator ────────────────────────────────────────────────────────

var _mapsLoadingInterval = null;
var _mapsLoadingDotCount = 1;

/**
 * _mapsShowLoading() — Shows the animated "Loading." indicator in the status bar.
 * Cycles through "Loading.", "Loading..", "Loading..." on a 400ms interval.
 */
function _mapsShowLoading() {
  var el = document.getElementById('maps-loading-indicator');
  var textEl = document.getElementById('maps-loading-text');
  if (!el || !textEl) return;
  el.style.display = '';
  _mapsLoadingDotCount = 1;
  textEl.textContent = 'Loading.';
  if (_mapsLoadingInterval) clearInterval(_mapsLoadingInterval);
  _mapsLoadingInterval = setInterval(function() {
    _mapsLoadingDotCount = (_mapsLoadingDotCount % 3) + 1;
    var dots = '';
    for (var i = 0; i < _mapsLoadingDotCount; i++) dots += '.';
    textEl.textContent = 'Loading' + dots;
  }, 400);
}

/**
 * _mapsHideLoading() — Hides the loading indicator in the status bar.
 */
function _mapsHideLoading() {
  var el = document.getElementById('maps-loading-indicator');
  if (el) el.style.display = 'none';
  if (_mapsLoadingInterval) {
    clearInterval(_mapsLoadingInterval);
    _mapsLoadingInterval = null;
  }
}

// ── Mode Management ──────────────────────────────────────────────────────────

/**
 * _injectModeToggle() — Creates the Chits/Both/People mode toggle and injects
 * it into the shared header (.header-and-buttons) created by shared-page.js.
 * Also injects a sidebar toggle button that calls the shared sidebar's
 * toggleSidebar() function.
 */
function _injectModeToggle() {
  var header = document.querySelector('.header-and-buttons');
  if (!header) return;

  // Inject sidebar toggle button AFTER the h2 — uses shared sidebar's toggleSidebar()
  var h2 = header.querySelector('h2');
  if (h2) {
    var sidebarBtn = document.createElement('button');
    sidebarBtn.id = 'maps-sidebar-toggle';
    sidebarBtn.className = 'maps-sidebar-toggle-btn';
    sidebarBtn.title = 'Toggle sidebar';
    sidebarBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    sidebarBtn.addEventListener('click', function() {
      if (typeof toggleSidebar === 'function') toggleSidebar();
    });
    h2.insertAdjacentElement('afterend', sidebarBtn);
  }

  // Create mode toggle wrapper (centered in header via CSS)
  var toggleWrap = document.createElement('div');
  toggleWrap.className = 'maps-mode-toggle-header';
  toggleWrap.id = 'maps-mode-toggle';

  var toggleInner = document.createElement('div');
  toggleInner.className = 'maps-mode-toggle';

  var modes = [
    { mode: 'chits', label: 'Chits' },
    { mode: 'both', label: 'Both' },
    { mode: 'people', label: 'People' }
  ];

  modes.forEach(function(m) {
    var btn = document.createElement('button');
    btn.className = 'maps-mode-btn' + (m.mode === 'chits' ? ' active' : '');
    btn.setAttribute('data-mode', m.mode);
    btn.textContent = m.label;
    toggleInner.appendChild(btn);
  });

  toggleWrap.appendChild(toggleInner);

  // Insert after h2, before the nav buttons div
  var navButtons = header.querySelector('.header-buttons');
  if (navButtons) {
    header.insertBefore(toggleWrap, navButtons);
  } else {
    header.appendChild(toggleWrap);
  }
}

/* ── Period Date Range Helper ─────────────────────────────────────────────── */

/**
 * _getPeriodDateRange(period) — Returns {start, end} Date objects for the
 * given period string. Used by the period dropdown filter.
 * @param {string} period — "week", "month", "quarter", "year", or "all"
 * @returns {{start: Date|null, end: Date|null}}
 */
function _getPeriodDateRange(period) {
  var now = new Date();
  var start, end;

  switch (period) {
    case 'week':
      // Start of current week (Sunday) to end of current week (Saturday)
      var dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case 'quarter':
      var qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
      end = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case 'all':
    default:
      return { start: null, end: null };
  }

  return { start: start, end: end };
}

/* ── Chit Overdue Helper ──────────────────────────────────────────────────── */

/**
 * _isChitOverdue(chit) — Returns true if the chit has a due_datetime in the
 * past and its status is not 'Complete'.
 */
function _isChitOverdue(chit) {
  if (!chit.due_datetime) return false;
  if (chit.status === 'Complete') return false;
  var due = new Date(chit.due_datetime);
  if (isNaN(due.getTime())) return false;
  return due < new Date();
}

/**
 * _mapsGetMode() — Returns the current mode ("chits" or "people").
 */
function _mapsGetMode() {
  return _mapsCurrentMode;
}

/**
 * _mapsSetMode(mode) — Sets the current mode, persists to localStorage,
 * updates toggle button active states, and triggers the appropriate mode switch.
 */
function _mapsSetMode(mode) {
  _mapsCurrentMode = mode;

  // Persist to localStorage (may be unavailable)
  try {
    localStorage.setItem(MAPS_MODE_KEY, mode);
  } catch (e) {
    console.warn('Could not persist maps mode to localStorage:', e.message);
  }

  // Update toggle button active states
  var buttons = document.querySelectorAll('.maps-mode-btn');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].getAttribute('data-mode') === mode) {
      buttons[i].classList.add('active');
    } else {
      buttons[i].classList.remove('active');
    }
  }

  // Trigger the appropriate mode switch
  if (mode === 'people') {
    _switchToPeopleMode();
  } else if (mode === 'both') {
    _switchToBothMode();
  } else {
    _switchToChitsMode();
  }
}

/**
 * _mapsRestoreMode() — Reads the persisted mode from localStorage.
 * Validates it's "chits" or "people", defaults to "chits" if invalid/missing.
 * Sets _mapsCurrentMode but does NOT trigger a mode switch.
 */
function _mapsRestoreMode() {
  var stored = null;
  try {
    stored = localStorage.getItem(MAPS_MODE_KEY);
  } catch (e) {
    console.warn('Could not read maps mode from localStorage:', e.message);
  }

  if (stored === 'chits' || stored === 'people' || stored === 'both') {
    _mapsCurrentMode = stored;
  } else {
    _mapsCurrentMode = 'chits';
  }
}

/**
 * _onModeToggleChange(e) — Click handler for mode toggle buttons.
 * Gets the data-mode attribute from the clicked button and calls _mapsSetMode().
 */
function _onModeToggleChange(e) {
  var btn = e.currentTarget;
  var mode = btn.getAttribute('data-mode');
  if (mode) {
    _mapsSetMode(mode);
  }
}

/* ── Shared Sidebar Initialization ─────────────────────────────────────────── */

/**
 * _initMapsSidebarShared() — Initializes the shared sidebar for the maps page.
 * Calls _cwocInitSidebar() with maps-specific Page_Context callbacks and config.
 * Hides the Author_Info_Footer since the sidebar footer already displays branding.
 * Also wires the shared sidebar's transitionend to invalidate the Leaflet map.
 */
function _initMapsSidebarShared() {
  _cwocInitSidebar({
    page: 'maps',
    currentPage: 'maps',
    onCreateChit: function() {
      window.location.href = '/frontend/html/editor.html';
    },
    onToday: function() {
      var periodSelect = document.getElementById('period-select');
      if (periodSelect) periodSelect.value = 'week';
      _onChitsFilterChange();
    },
    onPeriodChange: function() { _onChitsFilterChange(); },
    onFilterChange: function() { _onChitsFilterChange(); },
    onClearFilters: function() { _clearChitsFilters(); },
    onMapsClick: function() { /* no-op, already on maps */ },
    periodOptions: [
      { value: 'week', label: 'This Week', selected: true },
      { value: 'month', label: 'This Month' },
      { value: 'quarter', label: 'This Quarter' },
      { value: 'year', label: 'This Year' },
      { value: 'all', label: 'All Time' }
    ],
    loadTagFilters: function() { _loadChitsFilterData(); },
    loadPeopleFilters: function() { /* handled by _loadChitsFilterData */ }
  });

  // Hide the author-info footer (sidebar has its own branding)
  var authorInfo = document.querySelector('.author-info');
  if (authorInfo) authorInfo.style.display = 'none';

  // After shared sidebar CSS transition ends, invalidate the Leaflet map size
  var sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('transitionend', function(e) {
      if ((e.propertyName === 'width' || e.propertyName === 'transform') && _mapsLeafletMap) {
        _mapsLeafletMap.invalidateSize();
      }
    });
  }
}

/* ── Legend Management ─────────────────────────────────────────────────────── */

/**
 * _showChitsLegend() — Shows the status-color legend (#maps-legend)
 * and hides the people legend (#maps-people-legend).
 */
function _showChitsLegend() {
  document.getElementById('maps-legend').style.display = '';
  document.getElementById('maps-people-legend').style.display = 'none';
}

/**
 * _showPeopleLegend() — Shows the people legend (#maps-people-legend)
 * and hides the chits legend (#maps-legend).
 */
function _showPeopleLegend() {
  document.getElementById('maps-people-legend').style.display = '';
  document.getElementById('maps-legend').style.display = 'none';
}

/**
 * _showBothLegends() — Shows both the chits and people legends.
 */
function _showBothLegends() {
  document.getElementById('maps-legend').style.display = '';
  document.getElementById('maps-people-legend').style.display = '';
}

/* ── Mode Switching ───────────────────────────────────────────────────────── */

/**
 * _switchToChitsMode() — Transitions the map view to Chits mode.
 * Clears people markers, shows chits legend, hides people legend,
 * and loads chit markers. Reloads chit filter data into the shared sidebar.
 */
function _switchToChitsMode() {
  // Clear people markers
  if (_mapsPeopleClusterGroup) _mapsPeopleClusterGroup.clearLayers();

  // Switch legends
  _showChitsLegend();

  // Hide any lingering info message
  _hideInfoMessage();

  // Reload chit filter data into shared sidebar panels
  _loadChitsFilterData();

  // Load chit markers
  _fetchAndDisplayChits();
}

/**
 * _switchToPeopleMode() — Transitions the map view to People mode.
 * Clears chit markers, shows people legend, hides chits legend,
 * and loads contact markers.
 */
function _switchToPeopleMode() {
  // Clear chit markers
  if (_mapsClusterGroup) _mapsClusterGroup.clearLayers();

  // Switch legends
  _showPeopleLegend();

  // Hide any lingering info message
  _hideInfoMessage();

  // Load contact markers
  _fetchAndDisplayContacts();
}

/**
 * _switchToBothMode() — Transitions the map view to Both mode.
 * Shows both chit and contact markers simultaneously.
 * Shows both legends.
 */
function _switchToBothMode() {
  // Show both legends
  _showBothLegends();

  // Hide any lingering info message
  _hideInfoMessage();

  // Load both chit and contact markers
  _fetchAndDisplayChits();
  _fetchAndDisplayContacts();
}

/* ── Chits Filter Panel ───────────────────────────────────────────────────── */

var _mapsChitsFilterDebounceTimer = null;

/**
 * _initChitsFilters() — Called once during init to set up the chits filter panel.
 * Uses the shared sidebar's filter containers (status-multi, priority-multi,
 * label-multi, people-multi, period-select, search) instead of old maps-specific IDs.
 * Loads dynamic filter data (tags, people) via _loadChitsFilterData().
 */
function _initChitsFilters() {
  // Period dropdown is wired by _cwocInitSidebar via onPeriodChange callback.
  // Status and priority checkboxes are wired by _wireFilterCheckboxes in shared-sidebar.js.
  // Text search is wired by _cwocInitSidebar via the search input onkeyup.
  // Clear filters is wired by _cwocInitSidebar via onClearFilters callback.

  // Load dynamic filter data (tags, people) — populates label-multi and people-multi
  _loadChitsFilterData();
}

/**
 * _loadChitsFilterData() — Fetches data needed for dynamic filter options:
 * tags from user settings, contacts and system users for people.
 * Uses CwocSidebarFilter for tags (#label-multi) and people (#people-multi)
 * panels — the shared sidebar's standard container IDs.
 */
async function _loadChitsFilterData() {
  // ── Load tags from settings via CwocSidebarFilter ──
  try {
    var settings = await getCachedSettings();
    var rawTags = settings.tags ? (typeof settings.tags === 'string' ? JSON.parse(settings.tags) : settings.tags) : [];
    var tagObjects = rawTags.map(function(t) {
      return typeof t === 'string' ? { name: t, color: null, favorite: false } : t;
    }).filter(function(t) {
      return t.name && !isSystemTag(t.name);
    });

    if (typeof CwocSidebarFilter === 'function') {
      CwocSidebarFilter({
        containerId: 'label-multi',
        items: tagObjects.map(function(t) { return { name: t.name, favorite: !!t.favorite, color: t.color }; }),
        selection: _mapsChitsFilterTags,
        onChange: function() { _onChitsFilterChange(); },
        searchPlaceholder: 'Search tags…',
        showColorBadge: true
      });
    }
  } catch (e) {
    console.warn('Could not load tags for chits filter:', e);
  }

  // ── Load people (contacts + system users) via CwocSidebarFilter ──
  try {
    var contacts = [];
    var users = [];

    try {
      var contactResp = await fetch('/api/contacts');
      contacts = contactResp.ok ? await contactResp.json() : [];
    } catch (e) {
      console.warn('Could not fetch contacts for people filter:', e);
    }

    try {
      var usersResp = await fetch('/api/auth/switchable-users');
      users = usersResp.ok ? await usersResp.json() : [];
    } catch (e) {
      console.warn('Could not fetch users for people filter:', e);
    }

    // Build merged list for CwocSidebarFilter
    var merged = [];
    var contactNames = {};

    var sortedContacts = contacts.slice().sort(function(a, b) {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (a.display_name || '').localeCompare(b.display_name || '');
    });
    for (var ci = 0; ci < sortedContacts.length; ci++) {
      var c = sortedContacts[ci];
      var cName = c.display_name || c.given_name || '(Unknown)';
      merged.push({ name: cName, color: c.color, favorite: c.favorite });
      contactNames[cName.toLowerCase()] = true;
    }

    var sortedUsers = users.slice().sort(function(a, b) {
      return (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '');
    });
    for (var ui = 0; ui < sortedUsers.length; ui++) {
      var u = sortedUsers[ui];
      var uName = u.display_name || u.username || '(Unknown)';
      if (!contactNames[uName.toLowerCase()]) {
        merged.push({ name: uName, color: u.color, favorite: false });
      }
    }

    if (typeof CwocSidebarFilter === 'function') {
      CwocSidebarFilter({
        containerId: 'people-multi',
        items: merged,
        selection: _mapsChitsFilterPeople,
        onChange: function() { _onChitsFilterChange(); },
        searchPlaceholder: 'Search people…',
        showColorBadge: false
      });
    }
  } catch (e) {
    console.warn('Could not load people for chits filter:', e);
  }
}

/**
 * _matchesChitTextSearch(chit, query) — Returns true if the chit matches
 * the text search query. Case-insensitive match across title, note, location,
 * and tags (joined into a string). Returns true if query is empty/null/undefined.
 */
function _matchesChitTextSearch(chit, query) {
  if (!query) return true;
  var q = query.toLowerCase();

  // Search title
  if (chit.title && chit.title.toLowerCase().indexOf(q) !== -1) return true;

  // Search note
  if (chit.note && chit.note.toLowerCase().indexOf(q) !== -1) return true;

  // Search location
  if (chit.location && chit.location.toLowerCase().indexOf(q) !== -1) return true;

  // Search tags (may be array or JSON string)
  var tags = chit.tags;
  if (tags) {
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch (e) { tags = [tags]; }
    }
    if (Array.isArray(tags)) {
      var joined = tags.join(' ').toLowerCase();
      if (joined.indexOf(q) !== -1) return true;
    }
  }

  return false;
}

/**
 * _applyChitsFilters(chits) — Takes an array of chits, returns a filtered array.
 * All filters are AND-combined: a chit must pass ALL active filters to be included.
 * Filters: status, tags, priority, people, text search, date range.
 */
function _applyChitsFilters(chits) {
  if (!chits || !chits.length) return [];

  var result = [];

  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];

    // ── Status filter ──
    if (_mapsChitsFilterStatus.length > 0) {
      if (_mapsChitsFilterStatus.indexOf(chit.status) === -1) continue;
    }

    // ── Tag filter ──
    if (_mapsChitsFilterTags.length > 0) {
      var chitTags = chit.tags;
      if (chitTags) {
        if (typeof chitTags === 'string') {
          try { chitTags = JSON.parse(chitTags); } catch (e) { chitTags = [chitTags]; }
        }
      }
      if (!Array.isArray(chitTags)) chitTags = [];

      var hasMatchingTag = false;
      for (var ti = 0; ti < _mapsChitsFilterTags.length; ti++) {
        for (var tj = 0; tj < chitTags.length; tj++) {
          if (chitTags[tj] === _mapsChitsFilterTags[ti]) {
            hasMatchingTag = true;
            break;
          }
        }
        if (hasMatchingTag) break;
      }
      if (!hasMatchingTag) continue;
    }

    // ── Priority filter ──
    if (_mapsChitsFilterPriority.length > 0) {
      if (_mapsChitsFilterPriority.indexOf(chit.priority) === -1) continue;
    }

    // ── People filter ──
    if (_mapsChitsFilterPeople.length > 0) {
      var chitPeople = chit.people;
      if (chitPeople) {
        if (typeof chitPeople === 'string') {
          try { chitPeople = JSON.parse(chitPeople); } catch (e) { chitPeople = [chitPeople]; }
        }
      }
      if (!Array.isArray(chitPeople)) chitPeople = [];

      var hasMatchingPerson = false;
      for (var pi = 0; pi < _mapsChitsFilterPeople.length; pi++) {
        for (var pj = 0; pj < chitPeople.length; pj++) {
          if (chitPeople[pj] === _mapsChitsFilterPeople[pi]) {
            hasMatchingPerson = true;
            break;
          }
        }
        if (hasMatchingPerson) break;
      }
      if (!hasMatchingPerson) continue;
    }

    // ── Text search filter ──
    if (_mapsChitsFilterText && !_matchesChitTextSearch(chit, _mapsChitsFilterText)) {
      continue;
    }

    result.push(chit);
  }

  // ── Date range filter (period dropdown — shared sidebar's period-select) ──
  var periodSelect = document.getElementById('period-select');
  var period = periodSelect ? periodSelect.value : 'week';
  var range = _getPeriodDateRange(period);
  if (range.start || range.end) {
    var startStr = range.start ? _mapsToDateString(range.start) : '';
    var endStr = range.end ? _mapsToDateString(range.end) : '';
    result = _filterChitsByDateRange(result, startStr, endStr);
  } else {
    // "all" — still filter out chits without locations and deleted chits
    result = result.filter(function(chit) {
      if (!chit.location || !chit.location.trim()) return false;
      if (chit.deleted) return false;
      return true;
    });
  }

  return result;
}

/**
 * _onChitsFilterChange() — Handler for any chit filter change.
 * Reads filter state from the shared sidebar's standard containers
 * (status-multi, priority-multi, period-select, search) and re-renders.
 */
function _onChitsFilterChange() {
  // Read current status selections from shared sidebar's status-multi
  _mapsChitsFilterStatus = [];
  var statusCbs = document.querySelectorAll('#status-multi input[type="checkbox"][data-filter="status"]:checked');
  for (var i = 0; i < statusCbs.length; i++) {
    if (statusCbs[i].value) _mapsChitsFilterStatus.push(statusCbs[i].value);
  }

  // Read current priority selections from shared sidebar's priority-multi
  _mapsChitsFilterPriority = [];
  var priorityCbs = document.querySelectorAll('#priority-multi input[type="checkbox"][data-filter="priority"]:checked');
  for (var j = 0; j < priorityCbs.length; j++) {
    if (priorityCbs[j].value) _mapsChitsFilterPriority.push(priorityCbs[j].value);
  }

  // Read text search from shared sidebar's search input
  var searchInput = document.getElementById('search');
  if (searchInput) _mapsChitsFilterText = searchInput.value;

  // Tags and people are already updated via CwocSidebarFilter chip click handlers

  // Re-filter and re-render (only if we have chits loaded and are in chits or both mode)
  if ((_mapsCurrentMode === 'chits' || _mapsCurrentMode === 'both') && _mapsAllChits.length > 0) {
    _filterAndRender();
  }
}

/**
 * _clearChitsFilters() — Resets all chit filters to defaults and updates UI.
 * Uses the shared sidebar's standard container IDs.
 */
function _clearChitsFilters() {
  // Reset filter state
  _mapsChitsFilterStatus = [];
  _mapsChitsFilterTags = [];
  _mapsChitsFilterPriority = [];
  _mapsChitsFilterPeople = [];
  _mapsChitsFilterText = '';

  // Reset period dropdown to "week" (shared sidebar's period-select)
  var periodSelect = document.getElementById('period-select');
  if (periodSelect) periodSelect.value = 'week';

  // Reset status checkboxes in shared sidebar's status-multi
  var statusMulti = document.getElementById('status-multi');
  if (statusMulti) {
    statusMulti.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
      if (cb.dataset.any === 'true') {
        cb.checked = true;
      } else {
        cb.checked = false;
      }
    });
  }

  // Reset priority checkboxes in shared sidebar's priority-multi
  var priorityMulti = document.getElementById('priority-multi');
  if (priorityMulti) {
    priorityMulti.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
      if (cb.dataset.any === 'true') {
        cb.checked = true;
      } else {
        cb.checked = false;
      }
    });
  }

  // Clear text search (shared sidebar's search input)
  var searchInput = document.getElementById('search');
  if (searchInput) searchInput.value = '';

  // Re-render CwocSidebarFilter panels to clear selections
  _loadChitsFilterData();

  // Re-filter and re-render
  if (_mapsCurrentMode === 'chits' || _mapsCurrentMode === 'both') {
    _filterAndRender();
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * _mapsInit() — Main entry point for the Maps page.
 * Checks the Google Maps preference and either shows the warning or
 * initializes the Leaflet map.
 */
async function _mapsInit() {
  try {
    // Inject mode toggle into the shared header (must be early, before mode restore)
    _injectModeToggle();

    var settings = await getCachedSettings();
    var co = (settings && settings.chit_options) || {};

    if (co.prefer_google_maps) {
      // Show Google Maps warning, hide map-related elements
      var warning = document.getElementById('maps-google-warning');
      if (warning) warning.style.display = 'block';

      // Hide the maps layout
      var mapsLayout = document.getElementById('maps-page-layout');
      if (mapsLayout) mapsLayout.style.display = 'none';

      return;
    }

    _initLeafletMap();

    // Read map settings for initial view (Requirements 7.3, 7.4, 7.5)
    var autoZoom = settings.map_auto_zoom;
    var autoZoomEnabled = (autoZoom === '1' || autoZoom === undefined || autoZoom === null || autoZoom === '');

    if (!autoZoomEnabled) {
      // Auto-zoom disabled: check for custom center/zoom
      var lat = parseFloat(settings.map_default_lat);
      var lon = parseFloat(settings.map_default_lon);
      var zoom = parseInt(settings.map_default_zoom, 10);

      if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom) &&
          lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
          zoom >= 1 && zoom <= 18) {
        _mapsLeafletMap.setView([lat, lon], zoom);
      } else {
        // No valid custom settings, default to US view
        _mapsLeafletMap.setView([39.8283, -98.5795], 4);
      }
    }
    // If auto-zoom enabled, fitBounds will happen naturally when markers are placed

    // Restore persisted mode from localStorage
    _mapsRestoreMode();

    // Initialize people cluster group with teal styling (circle icons)
    _mapsPeopleClusterGroup = L.markerClusterGroup({
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        var size = count < 10 ? 'small' : (count < 100 ? 'medium' : 'large');
        return L.divIcon({
          html: '<div><span>' + count + '</span></div>',
          className: 'maps-people-cluster maps-people-cluster-' + size,
          iconSize: L.point(40, 40)
        });
      }
    });
    _mapsLeafletMap.addLayer(_mapsPeopleClusterGroup);

    // Wire up mode toggle button click handlers
    var modeButtons = document.querySelectorAll('.maps-mode-btn');
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].addEventListener('click', _onModeToggleChange);
    }

    // Update toggle button active states to match the restored mode
    for (var j = 0; j < modeButtons.length; j++) {
      if (modeButtons[j].getAttribute('data-mode') === _mapsCurrentMode) {
        modeButtons[j].classList.add('active');
      } else {
        modeButtons[j].classList.remove('active');
      }
    }

    _initMapsSidebarShared();
    _initChitsFilters();
    _initPeopleFilters();

    // Check for focus query parameter (from "View in Context" buttons)
    var urlParams = new URLSearchParams(window.location.search);
    var focusType = urlParams.get('focus');
    var focusAddress = urlParams.get('address');

    if (focusAddress && focusAddress.trim()) {
      // Focus mode: geocode the address and center the map on it
      _handleFocusAddress(focusType, focusAddress.trim());
    } else {
      // Normal mode: trigger the appropriate mode
      _mapsSetMode(_mapsCurrentMode);
    }

  } catch (e) {
    console.error('Maps init error:', e);
  }
}

// ── Leaflet map initialization ───────────────────────────────────────────────

/**
 * _initLeafletMap() — Creates the Leaflet map instance with OpenStreetMap tiles.
 */
function _initLeafletMap() {
  var container = document.getElementById('maps-container');
  if (!container) return;

  _mapsLeafletMap = L.map('maps-container').setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(_mapsLeafletMap);

  _mapsClusterGroup = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      var count = cluster.getChildCount();
      var size = count < 10 ? 'small' : (count < 100 ? 'medium' : 'large');

      // Detect mixed composition by checking child marker types
      var childMarkers = cluster.getAllChildMarkers();
      var hasChit = false;
      var hasContact = false;
      var hasBlocked = false;
      var hasOverdue = false;
      for (var i = 0; i < childMarkers.length; i++) {
        if (childMarkers[i]._cwocMarkerType === 'contact') {
          hasContact = true;
        } else {
          hasChit = true;
          // Check for blocked/overdue status on chit markers
          var chit = childMarkers[i]._cwocChit;
          if (chit) {
            if (chit.status === 'Blocked') hasBlocked = true;
            if (_isChitOverdue(chit)) hasOverdue = true;
          }
        }
        if (hasChit && hasContact && hasBlocked) break;
      }

      // Determine cluster border color: blocked (red) > overdue (orange) > default
      var clusterBorderStyle = '';
      if (hasBlocked) {
        clusterBorderStyle = 'border:2px solid #F44336;';
      } else if (hasOverdue) {
        clusterBorderStyle = 'border:2px solid #FF9800;';
      }

      var className, html;
      if (hasChit && hasContact) {
        // Mixed cluster: circle stacked on top of square — show dual count (chits/contacts)
        var chitCount = 0;
        var contactCount = 0;
        for (var j = 0; j < childMarkers.length; j++) {
          if (childMarkers[j]._cwocMarkerType === 'contact') contactCount++;
          else chitCount++;
        }
        className = 'maps-mixed-cluster maps-mixed-cluster-' + size;
        html = '<div class="maps-mixed-cluster-square"' + (clusterBorderStyle ? ' style="' + clusterBorderStyle + '"' : '') + '><span>' + chitCount + '</span></div>' +
               '<div class="maps-mixed-cluster-circle"><span>' + contactCount + '</span></div>';
      } else {
        // Chit-only cluster: square icon with amber/brown scheme
        className = 'maps-chit-cluster maps-chit-cluster-' + size;
        html = '<div><span>' + count + '</span></div>';
        // Apply blocked/overdue border to the cluster itself
        if (clusterBorderStyle) {
          className += ' maps-chit-cluster-alert';
        }
      }

      var iconOpts = {
        html: html,
        className: className,
        iconSize: L.point(40, 40)
      };

      // For non-mixed clusters, apply border via inline style on the icon
      var icon = L.divIcon(iconOpts);
      if (!hasContact && clusterBorderStyle) {
        // We'll use a wrapper approach: add style to the html
        icon = L.divIcon({
          html: '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;' + clusterBorderStyle + 'border-radius:6px;"><span>' + count + '</span></div>',
          className: className,
          iconSize: L.point(40, 40)
        });
      }

      return icon;
    }
  });
  _mapsLeafletMap.addLayer(_mapsClusterGroup);

  // Add Fullscreen control (added first so it appears on top)
  _mapsLeafletMap.addControl(new L.Control.Fullscreen());

  // Add Default View control (below fullscreen)
  _mapsLeafletMap.addControl(new L.Control.DefaultView());
}

/* ── Fullscreen Leaflet Control ────────────────────────────────────────────── */

/**
 * L.Control.Fullscreen — A Leaflet control that toggles browser fullscreen mode.
 * Uses the Fullscreen API (document.documentElement.requestFullscreen / document.exitFullscreen).
 * Hides itself if the browser does not support the Fullscreen API.
 * Position: topright. Uses Font Awesome fa-expand / fa-compress icons.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
L.Control.Fullscreen = L.Control.extend({
  options: { position: 'topright' },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar maps-fullscreen-control');
    var button = L.DomUtil.create('a', 'maps-fullscreen-btn', container);
    button.href = '#';
    button.title = 'Toggle fullscreen';
    button.innerHTML = '<i class="fa-solid fa-expand"></i>';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Toggle fullscreen');

    // Hide control if Fullscreen API is not supported
    if (!document.fullscreenEnabled) {
      container.style.display = 'none';
      return container;
    }

    L.DomEvent.on(button, 'click', L.DomEvent.stop);
    L.DomEvent.on(button, 'click', this._toggleFullscreen, this);

    // Listen for fullscreenchange to update icon
    this._onFullscreenChangeBound = this._onFullscreenChange.bind(this);
    document.addEventListener('fullscreenchange', this._onFullscreenChangeBound);

    this._button = button;
    return container;
  },

  onRemove: function() {
    if (this._onFullscreenChangeBound) {
      document.removeEventListener('fullscreenchange', this._onFullscreenChangeBound);
    }
  },

  _toggleFullscreen: function() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function(err) {
        console.warn('Exit fullscreen failed:', err);
      });
    } else {
      document.documentElement.requestFullscreen().catch(function(err) {
        console.warn('Enter fullscreen failed:', err);
      });
    }
  },

  _onFullscreenChange: function() {
    if (!this._button) return;
    var icon = this._button.querySelector('i');
    if (!icon) return;
    if (document.fullscreenElement) {
      icon.className = 'fa-solid fa-compress';
      this._button.title = 'Exit fullscreen';
      this._button.setAttribute('aria-label', 'Exit fullscreen');
    } else {
      icon.className = 'fa-solid fa-expand';
      this._button.title = 'Toggle fullscreen';
      this._button.setAttribute('aria-label', 'Toggle fullscreen');
    }
  }
});

/* ── Default View Leaflet Control ─────────────────────────────────────────── */

/**
 * L.Control.DefaultView — A Leaflet control that resets the map to the user's
 * configured default view. Reads cached settings to determine behavior:
 *   - If auto-zoom enabled → fitBounds to visible markers
 *   - If auto-zoom disabled with custom center/zoom → setView to those coords
 *   - Otherwise → default US view (39.8283, -98.5795, zoom 4)
 * Position: topright. Uses Font Awesome fa-house icon.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
L.Control.DefaultView = L.Control.extend({
  options: { position: 'topright' },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar maps-default-view-control');
    var button = L.DomUtil.create('a', 'maps-default-view-btn', container);
    button.href = '#';
    button.title = 'Reset to default view';
    button.innerHTML = '<i class="fa-solid fa-house"></i>';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Reset to default view');

    L.DomEvent.on(button, 'click', L.DomEvent.stop);
    L.DomEvent.on(button, 'click', this._resetView, this);

    this._map = map;
    return container;
  },

  _resetView: function() {
    var map = this._map;
    if (!map) return;

    getCachedSettings().then(function(settings) {
      var autoZoom = settings.map_auto_zoom;

      if (autoZoom === '1' || autoZoom === undefined || autoZoom === null || autoZoom === '') {
        // Auto-zoom enabled: fitBounds to visible markers
        var bounds = [];

        // Collect bounds from chit cluster group
        if ((_mapsCurrentMode === 'chits' || _mapsCurrentMode === 'both') && _mapsClusterGroup) {
          _mapsClusterGroup.eachLayer(function(layer) {
            if (layer.getLatLng) bounds.push(layer.getLatLng());
          });
        }

        // Collect bounds from people cluster group
        if ((_mapsCurrentMode === 'people' || _mapsCurrentMode === 'both') && _mapsPeopleClusterGroup) {
          _mapsPeopleClusterGroup.eachLayer(function(layer) {
            if (layer.getLatLng) bounds.push(layer.getLatLng());
          });
        }

        if (bounds.length > 0) {
          map.fitBounds(bounds.map(function(ll) { return [ll.lat, ll.lng]; }), { padding: [40, 40], maxZoom: 14 });
        } else {
          // No markers visible, fall back to US default
          map.setView([39.8283, -98.5795], 4);
        }
      } else {
        // Auto-zoom disabled: check for custom center/zoom
        var lat = parseFloat(settings.map_default_lat);
        var lon = parseFloat(settings.map_default_lon);
        var zoom = parseInt(settings.map_default_zoom, 10);

        if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom) &&
            lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
            zoom >= 1 && zoom <= 18) {
          map.setView([lat, lon], zoom);
        } else {
          // No valid custom settings, default to US view
          map.setView([39.8283, -98.5795], 4);
        }
      }
    }).catch(function(err) {
      console.warn('Could not read settings for default view:', err);
      map.setView([39.8283, -98.5795], 4);
    });
  }
});

// ── Focus Address Handling (View in Context) ─────────────────────────────────

/**
 * _handleFocusAddress(focusType, address) — Geocodes the given address and
 * centers the map on it at zoom level 15. Shows a temporary highlight marker
 * at the focused location. Also loads the appropriate mode markers in the
 * background. Called when the maps page is opened with ?focus=...&address=...
 */
async function _handleFocusAddress(focusType, address) {
  // Set focus mode flag to prevent fitBounds from overriding our centered view
  _mapsFocusMode = true;

  // Set the mode based on focus type
  var mode = (focusType === 'contact') ? 'people' : 'chits';
  _mapsSetMode(mode);

  try {
    var coords = await _geocodeAddress(address);
    if (coords && coords.lat && coords.lon) {
      // Center the map on the address at zoom 15 (skip fitBounds)
      _mapsLeafletMap.setView([coords.lat, coords.lon], 15);

      // Add a temporary highlight marker (pulsing circle)
      var highlightMarker = L.circleMarker([coords.lat, coords.lon], {
        radius: 18,
        fillColor: '#d4af37',
        color: '#8b4513',
        weight: 3,
        opacity: 0.9,
        fillOpacity: 0.35
      });
      highlightMarker.addTo(_mapsLeafletMap);
      highlightMarker.bindPopup(
        '<div style="font-family:Lora,Georgia,serif;font-size:13px;">' +
        '<strong>📍 ' + _mapsEsc(address) + '</strong>' +
        '</div>'
      ).openPopup();

      // Remove the highlight marker after 8 seconds
      setTimeout(function() {
        if (_mapsLeafletMap && highlightMarker) {
          _mapsLeafletMap.removeLayer(highlightMarker);
        }
      }, 8000);
    }
  } catch (e) {
    console.warn('Could not geocode focus address:', address, e);
    // Fall back to normal mode behavior
  }
}

// ── Fetch and display chits ──────────────────────────────────────────────────

/**
 * _fetchAndDisplayChits() — Fetches all chits, filters by date range,
 * geocodes locations, and places markers on the map.
 */
async function _fetchAndDisplayChits() {
  _mapsShowLoading();
  try {
    var resp = await fetch('/api/chits');
    if (!resp.ok) {
      console.error('Failed to fetch chits:', resp.status);
      _showInfoMessage('Could not load chits. Please try again.');
      _mapsHideLoading();
      return;
    }
    _mapsAllChits = await resp.json();
  } catch (e) {
    console.error('Error fetching chits:', e);
    _showInfoMessage('Could not load chits. Please try again.');
    _mapsHideLoading();
    return;
  }

  await _filterAndRender();
  _mapsHideLoading();
}

// ── Fetch and display contacts ───────────────────────────────────────────────

/**
 * _fetchAndDisplayContacts() — Fetches all contacts from /api/contacts,
 * applies people filters, geocodes filtered contacts, and places contact
 * markers on the map. Shows appropriate empty state messages.
 */
async function _fetchAndDisplayContacts() {
  _mapsShowLoading();
  try {
    // Fetch all contacts from /api/contacts
    var resp = await fetch('/api/contacts');
    if (!resp.ok) throw new Error('Failed to fetch contacts: ' + resp.status);
    _mapsAllContacts = await resp.json();

    // Build tag chips from actual contact data
    _buildPeopleTagChips(_mapsAllContacts);

    // Apply people filters
    var filtered = _applyPeopleFilters(_mapsAllContacts);

    if (filtered.length === 0) {
      if (_mapsPeopleClusterGroup) _mapsPeopleClusterGroup.clearLayers();
      if (_mapsAllContacts.length === 0) {
        _showInfoMessage('No contacts found.');
      } else {
        _showInfoMessage('No contacts match the current filters.');
      }
      _mapsHideLoading();
      return;
    }

    // Geocode filtered contacts
    var geocoded = await _geocodeContacts(filtered);

    if (geocoded.length === 0) {
      if (_mapsPeopleClusterGroup) _mapsPeopleClusterGroup.clearLayers();
      _showInfoMessage('No contacts with addresses were found.');
      _mapsHideLoading();
      return;
    }

    _hideInfoMessage();

    // Place contact markers
    _placeContactMarkers(geocoded);
    _mapsHideLoading();

  } catch (e) {
    console.error('Error fetching/displaying contacts:', e);
    _showInfoMessage('Error loading contacts. Please try again.');
    _mapsHideLoading();
  }
}

/* ── People Filter Panel ───────────────────────────────────────────────────── */

var _mapsPeopleFilterDebounceTimer = null;

/**
 * _initPeopleFilters() — Called once during init to set up the people filter panel.
 * Wires up text search (debounced), favorites-only toggle, clear filters button.
 * Tag chips are built dynamically when contacts are loaded via _buildPeopleTagChips().
 */
function _initPeopleFilters() {
  // Wire up text search input with 300ms debounce
  var textSearch = document.getElementById('maps-people-text-search');
  if (textSearch) {
    textSearch.addEventListener('input', function() {
      _mapsPeopleFilterText = textSearch.value;
      if (_mapsPeopleFilterDebounceTimer) clearTimeout(_mapsPeopleFilterDebounceTimer);
      _mapsPeopleFilterDebounceTimer = setTimeout(function() {
        _onPeopleFilterChange();
      }, 300);
    });
  }

  // Wire up favorites-only toggle
  var favToggle = document.getElementById('maps-people-favorites-toggle');
  if (favToggle) {
    favToggle.addEventListener('click', function() {
      _mapsPeopleFilterFavoritesOnly = !_mapsPeopleFilterFavoritesOnly;
      if (_mapsPeopleFilterFavoritesOnly) {
        favToggle.classList.add('active');
      } else {
        favToggle.classList.remove('active');
      }
      _onPeopleFilterChange();
    });
  }

  // Wire up clear filters button
  var clearBtn = document.getElementById('maps-people-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', _clearPeopleFilters);
  }
}

/**
 * _buildPeopleTagChips(contacts) — Builds tag filter using CwocSidebarFilter
 * from contact tags. Collects unique tags across all contacts and renders
 * into #maps-people-tags-filter. Each selection toggles and calls
 * _onPeopleFilterChange().
 */
function _buildPeopleTagChips(contacts) {
  var container = document.getElementById('maps-people-tags-filter');
  if (!container) return;

  // Collect unique tags across all contacts
  var tagSet = {};
  for (var i = 0; i < contacts.length; i++) {
    var contact = contacts[i];
    var tags = contact.tags;
    if (tags && Array.isArray(tags)) {
      for (var j = 0; j < tags.length; j++) {
        var tag = tags[j];
        if (tag && typeof tag === 'string') {
          tagSet[tag] = true;
        }
      }
    }
  }

  var sortedTags = Object.keys(tagSet).sort(function(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  if (sortedTags.length === 0) {
    container.innerHTML = '<span style="font-size:0.85em;opacity:0.6;">No tags found</span>';
    return;
  }

  if (typeof CwocSidebarFilter === 'function') {
    CwocSidebarFilter({
      containerId: 'maps-people-tags-filter',
      items: sortedTags.map(function(t) { return { name: t, favorite: false }; }),
      selection: _mapsPeopleFilterTags,
      onChange: function() { _onPeopleFilterChange(); },
      searchPlaceholder: 'Search tags…',
      showColorBadge: true
    });
  }
}

/**
 * _onPeopleFilterChange() — Re-filters and re-renders contact markers.
 * Called when any people filter changes (text search, favorites toggle, tag chips).
 */
function _onPeopleFilterChange() {
  if ((_mapsCurrentMode === 'people' || _mapsCurrentMode === 'both') && _mapsAllContacts.length > 0) {
    _fetchAndDisplayContacts();
  }
}

/**
 * _clearPeopleFilters() — Resets all people filter state to defaults and updates UI.
 */
function _clearPeopleFilters() {
  // Reset filter state
  _mapsPeopleFilterText = '';
  _mapsPeopleFilterFavoritesOnly = false;
  _mapsPeopleFilterTags = [];

  // Clear text search input value
  var textSearch = document.getElementById('maps-people-text-search');
  if (textSearch) textSearch.value = '';

  // Remove .active from favorites toggle
  var favToggle = document.getElementById('maps-people-favorites-toggle');
  if (favToggle) favToggle.classList.remove('active');

  // Re-render tag filter (CwocSidebarFilter will pick up empty selection)
  if (_mapsAllContacts.length > 0) {
    _buildPeopleTagChips(_mapsAllContacts);
  }

  // Re-filter and re-render
  _onPeopleFilterChange();
}

// ── People Filter Logic ──────────────────────────────────────────────────────

/**
 * _mapsContactMatchesFilter(contact, query) — Replicates the _contactMatchesFilter
 * logic from editor-people.js. Case-insensitive search across ALL contact fields:
 * display_name, given_name, surname, nickname, organization, social_context, notes,
 * emails, phones, addresses, call_signs, x_handles, websites, and tags.
 * Returns true if any field contains the query string.
 * Returns true if query is empty/null/undefined.
 */
function _mapsContactMatchesFilter(contact, query) {
  if (!query) return true;
  var q = query.toLowerCase();
  var fields = [
    contact.display_name || '',
    contact.given_name || '',
    contact.surname || '',
    contact.nickname || '',
    contact.organization || '',
    contact.social_context || '',
    contact.notes || '',
    (contact.emails || []).map(function (e) { return (e.value || '') + ' ' + (e.label || ''); }).join(' '),
    (contact.phones || []).map(function (p) { return (p.value || '') + ' ' + (p.label || ''); }).join(' '),
    (contact.addresses || []).map(function (a) { return (a.value || ''); }).join(' '),
    (contact.call_signs || []).map(function (cs) { return (cs.value || ''); }).join(' '),
    (contact.x_handles || []).map(function (x) { return (x.value || ''); }).join(' '),
    (contact.websites || []).map(function (w) { return (w.value || ''); }).join(' '),
    (contact.tags || []).join(' ')
  ];
  return fields.some(function (f) { return f.toLowerCase().indexOf(q) !== -1; });
}

/**
 * _applyPeopleFilters(contacts) — Takes an array of contacts, returns a filtered
 * array. All filters are AND-combined:
 *   - Favorites filter: if _mapsPeopleFilterFavoritesOnly is true, include only
 *     contacts with favorite === true
 *   - Tag filter: if _mapsPeopleFilterTags.length > 0, include only contacts that
 *     have at least one tag matching a selected tag
 *   - Text search: if _mapsPeopleFilterText is non-empty, include only contacts
 *     matching _mapsContactMatchesFilter()
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
function _applyPeopleFilters(contacts) {
  if (!contacts || !contacts.length) return [];

  var result = [];

  for (var i = 0; i < contacts.length; i++) {
    var contact = contacts[i];

    // ── Favorites filter ──
    if (_mapsPeopleFilterFavoritesOnly) {
      if (!contact.favorite) continue;
    }

    // ── Tag filter ──
    if (_mapsPeopleFilterTags.length > 0) {
      var contactTags = contact.tags;
      if (!Array.isArray(contactTags)) contactTags = [];

      var hasMatchingTag = false;
      for (var ti = 0; ti < _mapsPeopleFilterTags.length; ti++) {
        for (var tj = 0; tj < contactTags.length; tj++) {
          if (contactTags[tj] === _mapsPeopleFilterTags[ti]) {
            hasMatchingTag = true;
            break;
          }
        }
        if (hasMatchingTag) break;
      }
      if (!hasMatchingTag) continue;
    }

    // ── Text search filter ──
    if (_mapsPeopleFilterText && !_mapsContactMatchesFilter(contact, _mapsPeopleFilterText)) {
      continue;
    }

    result.push(contact);
  }

  return result;
}

/**
 * _geocodeContacts(contacts) — Geocodes each contact's addresses, returns
 * array of {contact, address, lat, lon}. Uses _mapsContactGeocodeCache for
 * deduplication (keyed by lowercase trimmed address string).
 */
async function _geocodeContacts(contacts) {
  var results = [];

  for (var i = 0; i < contacts.length; i++) {
    var contact = contacts[i];
    var addresses = contact.addresses;

    // Skip contacts with no addresses
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) continue;

    for (var j = 0; j < addresses.length; j++) {
      var addrObj = addresses[j];
      var addrStr = (typeof addrObj === 'string') ? addrObj : (addrObj.value || addrObj.address || '');
      addrStr = addrStr.trim();
      if (!addrStr) continue;

      var cacheKey = addrStr.toLowerCase();

      // Check deduplication cache first
      if (_mapsContactGeocodeCache[cacheKey]) {
        var cached = _mapsContactGeocodeCache[cacheKey];
        results.push({ contact: contact, address: addrStr, lat: cached.lat, lon: cached.lon });
        continue;
      }

      // Geocode the address using shared-geocoding.js
      try {
        var coords = await _geocodeAddress(addrStr);
        if (coords && coords.lat && coords.lon) {
          _mapsContactGeocodeCache[cacheKey] = { lat: coords.lat, lon: coords.lon };
          results.push({ contact: contact, address: addrStr, lat: coords.lat, lon: coords.lon });
        } else {
          console.warn('Geocoding returned no results for contact address:', addrStr);
        }
      } catch (e) {
        console.warn('Geocoding failed for contact address:', addrStr, e);
      }
    }
  }

  return results;
}

/**
 * _getContactMarkerColor(contact) — Returns the contact's color if non-null
 * and non-empty, otherwise returns default teal '#008080'.
 */
function _getContactMarkerColor(contact) {
  if (contact.color && contact.color.trim()) return contact.color.trim();
  return '#008080';
}

/**
 * _placeContactMarkers(geocodedContacts) — Creates contact markers as circle
 * markers (L.circleMarker) and adds them to the people cluster group.
 * Each marker uses the contact's color with semi-transparent fill.
 * Binds popup via _buildContactPopupContent() and fits map bounds to markers.
 */
function _placeContactMarkers(geocodedContacts) {
  if (_mapsPeopleClusterGroup) _mapsPeopleClusterGroup.clearLayers();

  var bounds = [];

  for (var i = 0; i < geocodedContacts.length; i++) {
    var item = geocodedContacts[i];
    var contact = item.contact;
    var color = _getContactMarkerColor(contact);

    // Circle marker for contacts
    var marker = L.circleMarker([item.lat, item.lon], {
      radius: 10,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 1,
      fillOpacity: 0.6
    });
    marker._cwocMarkerType = 'contact';

    // Bind popup
    var popupContent = _buildContactPopupContent(contact, item.address);
    marker.bindPopup(popupContent, { maxWidth: 280 });

    _mapsPeopleClusterGroup.addLayer(marker);
    bounds.push([item.lat, item.lon]);
  }

  // Fit map bounds to markers (only if auto-zoom is enabled and not in focus mode)
  if (bounds.length > 0 && _mapsLeafletMap && !_mapsFocusMode) {
    var settings = window._cwocSettings || {};
    var autoZoom = settings.map_auto_zoom;
    var autoZoomEnabled = (autoZoom === '1' || autoZoom === undefined || autoZoom === null || autoZoom === '');
    if (autoZoomEnabled) {
      _mapsLeafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }
}

/**
 * _buildContactPopupContent(contact, address) — Returns HTML string for a
 * contact marker popup. Includes display name, address, organization, primary
 * phone, primary email, profile image thumbnail, and editor link.
 */
function _buildContactPopupContent(contact, address) {
  var name = contact.display_name || contact.given_name || '(Unknown)';

  var html = '<div style="min-width:180px;font-family:Lora,Georgia,serif;color:#2b1e0f;">';

  // Profile image thumbnail (floated right)
  if (contact.image_url) {
    html += '<img src="' + _mapsEsc(contact.image_url) + '" alt="" style="float:right;width:40px;height:40px;border-radius:6px;object-fit:cover;margin:0 0 4px 8px;border:1px solid #d2b48c;" />';
  }

  // Contact display name (bold)
  html += '<strong style="font-size:14px;">' + _mapsEsc(name) + '</strong>';

  // Address
  if (address) {
    html += '<br><span style="font-size:12px;color:#5c4033;">📍 ' + _mapsEsc(address) + '</span>';
  }

  // Organization
  if (contact.organization) {
    html += '<br><span style="font-size:12px;">🏢 ' + _mapsEsc(contact.organization) + '</span>';
  }

  // Primary phone (first entry in phones array)
  if (contact.phones && contact.phones.length > 0 && contact.phones[0].value) {
    html += '<br><span style="font-size:12px;">📞 ' + _mapsEsc(contact.phones[0].value) + '</span>';
  }

  // Primary email (first entry in emails array)
  if (contact.emails && contact.emails.length > 0 && contact.emails[0].value) {
    html += '<br><span style="font-size:12px;">✉️ ' + _mapsEsc(contact.emails[0].value) + '</span>';
  }

  // Editor link
  html += '<br><a href="/frontend/html/contact-editor.html?id=' + encodeURIComponent(contact.id) + '" style="font-size:12px;color:#008080;">Open Contact →</a>';

  html += '</div>';
  return html;
}

// ── Filter and render chits ──────────────────────────────────────────────────

/**
 * _filterAndRender() — Applies all chit filters (including date range),
 * geocodes, and places markers. Called on initial load, when date filters
 * change, and when any chit filter changes.
 */
async function _filterAndRender() {
  var filtered = _applyChitsFilters(_mapsAllChits);

  if (filtered.length === 0) {
    // Clear existing markers and show empty state
    if (_mapsClusterGroup) _mapsClusterGroup.clearLayers();
    if (_mapsLeafletMap && !_mapsFocusMode) _mapsLeafletMap.setView([20, 0], 2);
    _showInfoMessage('No chits match the current filters.');
    return;
  }

  _hideInfoMessage();
  var geocoded = await _geocodeChits(filtered);
  _placeMarkers(geocoded);
}

// ── Date range filtering ─────────────────────────────────────────────────────

/**
 * _filterChitsByDateRange(chits, startDate, endDate) — Returns only chits
 * with a non-empty location and at least one date field within the range.
 * Date fields checked: start_datetime, due_datetime, created_datetime.
 */
function _filterChitsByDateRange(chits, startDate, endDate) {
  if (!chits || !chits.length) return [];

  var rangeStart = startDate ? new Date(startDate + 'T00:00:00') : null;
  var rangeEnd = endDate ? new Date(endDate + 'T23:59:59') : null;

  return chits.filter(function (chit) {
    // Must have a non-empty location
    if (!chit.location || !chit.location.trim()) return false;

    // Skip deleted chits
    if (chit.deleted) return false;

    // Check if at least one date field falls within the range
    var dateFields = ['start_datetime', 'due_datetime', 'created_datetime'];
    var hasDateInRange = false;

    for (var i = 0; i < dateFields.length; i++) {
      var val = chit[dateFields[i]];
      if (!val) continue;

      var d = new Date(val);
      if (isNaN(d.getTime())) continue;

      var inRange = true;
      if (rangeStart && d < rangeStart) inRange = false;
      if (rangeEnd && d > rangeEnd) inRange = false;

      if (inRange) {
        hasDateInRange = true;
        break;
      }
    }

    return hasDateInRange;
  });
}

// ── Geocoding with in-memory cache ───────────────────────────────────────────

/**
 * _geocodeChits(chits) — Geocodes each chit's location using _geocodeAddress()
 * from shared-geocoding.js. Uses _mapsGeocodeCache to avoid duplicate calls
 * for identical (case-insensitive, trimmed) addresses.
 * Returns an array of { chit, lat, lon } objects.
 */
async function _geocodeChits(chits) {
  var results = [];

  for (var i = 0; i < chits.length; i++) {
    var chit = chits[i];
    var address = (chit.location || '').trim();
    if (!address) continue;

    var cacheKey = address.toLowerCase();

    // Check cache first
    if (_mapsGeocodeCache[cacheKey]) {
      results.push({
        chit: chit,
        lat: _mapsGeocodeCache[cacheKey].lat,
        lon: _mapsGeocodeCache[cacheKey].lon
      });
      continue;
    }

    // Geocode and cache
    try {
      var coords = await _geocodeAddress(address);
      _mapsGeocodeCache[cacheKey] = { lat: coords.lat, lon: coords.lon };
      results.push({ chit: chit, lat: coords.lat, lon: coords.lon });
    } catch (e) {
      console.warn('Geocoding failed for "' + address + '":', e.message);
      // Skip this chit silently per spec
    }
  }

  return results;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

/**
 * _hexToRgba(hex, alpha) — Converts a hex color string (e.g., "#FF9800") to
 * an rgba() CSS string with the given alpha (0–1). Handles 3-digit and
 * 6-digit hex values. Returns a fallback if the input is invalid.
 */
function _hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return 'rgba(128,128,128,' + (alpha || 1) + ')';
  hex = hex.replace(/^#/, '');
  // Expand 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return 'rgba(128,128,128,' + (alpha || 1) + ')';
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(128,128,128,' + (alpha || 1) + ')';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha || 1) + ')';
}

// ── Marker color by status ───────────────────────────────────────────────────

/**
 * _getMarkerColor(status) — Returns the hex color for a given chit status.
 * ToDo=#2196F3, In Progress=#FF9800, Blocked=#F44336, Complete=#4CAF50, no-status=#9E9E9E
 */
function _getMarkerColor(status) {
  if (status && _mapsStatusColors[status]) {
    return _mapsStatusColors[status];
  }
  return _mapsNoStatusColor;
}

// ── Popup content ────────────────────────────────────────────────────────────

/**
 * _buildPopupContent(chit) — Returns HTML string for a marker popup.
 * Includes: title, relevant date, status, and link to editor.
 */
function _buildPopupContent(chit) {
  var title = chit.title || '(Untitled)';
  var status = chit.status || 'No Status';

  // Pick the most relevant date to display
  var dateStr = '';
  if (chit.start_datetime) {
    dateStr = _mapsFormatDate(chit.start_datetime);
  } else if (chit.due_datetime) {
    dateStr = _mapsFormatDate(chit.due_datetime);
  } else if (chit.created_datetime) {
    dateStr = _mapsFormatDate(chit.created_datetime);
  }

  var color = _getMarkerColor(chit.status);

  var html = '<div style="min-width:160px;font-family:Lora,Georgia,serif;">';
  html += '<strong style="font-size:14px;">' + _mapsEsc(title) + '</strong>';
  if (dateStr) {
    html += '<br><span style="font-size:12px;color:#666;">📅 ' + _mapsEsc(dateStr) + '</span>';
  }
  html += '<br><span style="font-size:12px;">';
  html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:4px;vertical-align:middle;"></span>';
  html += _mapsEsc(status);
  html += '</span>';
  html += '<br><a href="/editor?id=' + encodeURIComponent(chit.id) + '" style="font-size:12px;color:#2196F3;">Open in Editor →</a>';
  html += '</div>';

  return html;
}

/**
 * _mapsFormatDate(isoString) — Formats an ISO datetime string for display.
 */
function _mapsFormatDate(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/** Simple HTML escape for popup content. */
function _mapsEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Marker placement ─────────────────────────────────────────────────────────

/**
 * _placeMarkers(geocodedChits) — Creates colored rounded-square divIcon markers
 * using the chit's own color field (not status). Adds them to the
 * MarkerClusterGroup, binds popups, and fits map bounds.
 * Cluster borders: red if any child is Blocked, orange if any child is overdue.
 * Respects map_auto_zoom setting: only fitBounds when auto-zoom is enabled.
 */
function _placeMarkers(geocodedChits) {
  if (!_mapsLeafletMap || !_mapsClusterGroup) return;

  // Clear existing markers
  _mapsClusterGroup.clearLayers();

  if (!geocodedChits || geocodedChits.length === 0) {
    // Show default world view with info message
    _mapsLeafletMap.setView([20, 0], 2);
    _showInfoMessage('No chits with locations found for the selected period.');
    return;
  }

  // Hide info message
  _hideInfoMessage();

  var bounds = [];

  for (var i = 0; i < geocodedChits.length; i++) {
    var item = geocodedChits[i];
    // Use the chit's own color, fallback to neutral parchment tan
    var color = item.chit.color || '#d2b48c';

    // Rounded-square divIcon marker for chits
    var iconHtml = '<div class="maps-chit-marker" style="background-color:' + _hexToRgba(color, 0.85) + ';border-color:#fff;"></div>';
    var icon = L.divIcon({
      html: iconHtml,
      className: 'maps-chit-marker-wrapper',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    var marker = L.marker([item.lat, item.lon], { icon: icon });
    marker._cwocMarkerType = 'chit';
    marker._cwocChit = item.chit;

    marker.bindPopup(_buildPopupContent(item.chit));
    _mapsClusterGroup.addLayer(marker);
    bounds.push([item.lat, item.lon]);
  }

  // Fit map to marker bounds (only if auto-zoom is enabled and not in focus mode)
  if (bounds.length > 0 && !_mapsFocusMode) {
    var settings = window._cwocSettings || {};
    var autoZoom = settings.map_auto_zoom;
    var autoZoomEnabled = (autoZoom === '1' || autoZoom === undefined || autoZoom === null || autoZoom === '');
    if (autoZoomEnabled) {
      _mapsLeafletMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }
}

// ── Date filter initialization and handler ───────────────────────────────────

// _initDateFilters() — Removed: shared sidebar handles period dropdown wiring
// via onPeriodChange callback in _initMapsSidebarShared().

// _onDateFilterChange() — Removed: period changes are handled by
// _onChitsFilterChange() via the shared sidebar's onPeriodChange callback.

/**
 * _mapsToDateString(date) — Converts a Date to YYYY-MM-DD string.
 */
function _mapsToDateString(d) {
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// ── Legend display ────────────────────────────────────────────────────────────

/**
 * _showLegend() — Ensures the legend element is visible.
 * The legend HTML is already in maps.html; this just shows it.
 */
function _showLegend() {
  var legend = document.getElementById('maps-legend');
  if (legend) legend.style.display = '';
}

// ── Info message helpers ─────────────────────────────────────────────────────

function _showInfoMessage(msg) {
  var el = document.getElementById('maps-info-message');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function _hideInfoMessage() {
  var el = document.getElementById('maps-info-message');
  if (el) el.style.display = 'none';
}

// _initMobileFilterCollapse() — Removed: sidebar handles collapse now.

/* ── ESC key handler (maps page — shared-page.js handles basic ESC) ──────── */

/**
 * Maps page ESC handler. The maps page now uses .settings-panel so shared-page.js
 * injects its standard ESC handler. We add an additional handler to also check
 * for the profile dropdown before navigating.
 */
(function() {
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    // Close profile dropdown if open (before shared-page.js navigates away)
    if (document.getElementById('cwoc-profile-dropdown')) return;
  });
})();

// ── Page load ────────────────────────────────────────────────────────────────

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _mapsInit);
  } else {
    _mapsInit();
  }
})();
