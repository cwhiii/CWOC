/**
 * main-sidebar.js — Dashboard sidebar wrapper (thin layer over shared-sidebar.js).
 *
 * Contains:
 *   - _initDashboardSidebar() — Registers dashboard Page_Context with shared sidebar
 *   - Tag filter panel (_buildTagFilterPanel, _syncSidebarTagCheckboxes)
 *   - People filter panel (_buildPeopleFilterPanel, _renderPeopleFilterPanel, _renderPeopleChipFilter)
 *   - Filter toggle/clear functions (onFilterChange, onFilterAnyToggle, onFilterSpecificToggle, etc.)
 *   - Archive/pinned/unmarked toggles
 *   - Sort UI helpers (_updateSortUI, onSortSelectChange, toggleSortDir)
 *   - Label/tag filter loading (_loadLabelFilters)
 *
 * Shared sidebar functions (toggleSidebar, restoreSidebarState, toggleSidebarSection,
 *   expandSidebarSection, _toggleFiltersSection, _expandFiltersSection, toggleFilterGroup,
 *   expandFilterGroup, _toggleNotifInbox, _fetchNotifications, _updateNotifBadge,
 *   _renderNotifInbox, _respondNotification, _toggleTopbar, _restoreTopbarState) are now
 *   in shared-sidebar.js.
 *
 * Depends on globals from main.js: currentTab, currentSortField, currentSortDir,
 *   _cachedTagObjects, _chitOptions, _defaultFilters, _weekStartDay, _enabledPeriods, etc.
 * Depends on shared.js: getPastelColor, isSystemTag, buildTagTree, renderTagTree,
 *   matchesTagFilter, isLightColor, getCachedSettings
 * Depends on shared-sidebar.js: _cwocInitSidebar, toggleSidebar, restoreSidebarState,
 *   toggleSidebarSection, expandSidebarSection, _toggleFiltersSection, _expandFiltersSection,
 *   toggleFilterGroup, expandFilterGroup
 */

/* ── Dashboard Sidebar Initialization ────────────────────────────────────── */

/**
 * _initDashboardSidebar() — Registers dashboard-specific callbacks with the
 * shared sidebar. Called from main-init.js during dashboard initialization.
 */
function _initDashboardSidebar() {
  _cwocInitSidebar({
    page: 'dashboard',
    currentPage: 'home',
    onCreateChit: function() {
      storePreviousState();
      // If on the Email tab, auto-open the email zone for the new chit
      if (typeof currentTab !== 'undefined' && currentTab === 'Email') {
        window.location.href = '/frontend/html/editor.html?new=email';
      } else {
        window.location.href = '/frontend/html/editor.html';
      }
    },
    onToday: function() { goToToday(); },
    onPeriodChange: function() { changePeriod(); },
    onPreviousPeriod: function() { previousPeriod(); },
    onNextPeriod: function() { nextPeriod(); },
    onFilterChange: function() { displayChits(); _updateClearFiltersButton(); },
    onClearFilters: function() { _clearAllFilters(); },
    onSortChange: function() { onSortSelectChange(); },
    onSortDirToggle: function() { toggleSortDir(); },
    onContactsClick: function() {
      window.location.href = '/frontend/html/people.html';
    },
    onClockClick: function() { _openClockModal(); },
    onWeatherClick: function(e) {
      if (e && e.shiftKey) {
        _openWeatherModal();
      } else {
        storePreviousState();
        window.location.href = '/frontend/html/weather.html';
      }
    },
    onCalculatorClick: function() { cwocToggleCalculator(); },
    onReferenceClick: function() { _toggleReference(); },
    onHelpClick: function() { openHelpPage(); },
    periodOptions: [
      { value: 'Itinerary', label: 'Itinerary' },
      { value: 'Day', label: 'Day' },
      { value: 'Work', label: 'Work Hours' },
      { value: 'Week', label: 'Week', selected: true },
      { value: 'SevenDay', label: 'X Days' },
      { value: 'Month', label: 'Month' },
      { value: 'Year', label: 'Year' }
    ],
    loadTagFilters: function() { _loadLabelFilters(); },
    loadPeopleFilters: function() { _buildPeopleFilterPanel(); }
  });

  // Restore topbar (header) visibility from localStorage — dashboard-specific
  _restoreTopbarState();
}

/* ── Sort UI ─────────────────────────────────────────────────────────────── */

function onSortSelectChange() {
  var sel = document.getElementById('sort-select');
  currentSortField = sel ? sel.value || null : null;
  currentSortDir = 'asc';
  _updateSortUI();
  displayChits();
  if (typeof _updateClearAllButton === 'function') _updateClearAllButton();
}

function toggleSortDir() {
  currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  _updateSortUI();
  displayChits();
  if (typeof _updateClearAllButton === 'function') _updateClearAllButton();
}

function _updateSortUI() {
  var dirBtn = document.getElementById('sort-dir-btn');
  if (!dirBtn) return;
  if (currentSortField && currentSortField !== 'manual' && currentSortField !== 'random' && currentSortField !== 'upcoming') {
    dirBtn.style.display = '';
    dirBtn.textContent = currentSortDir === 'asc' ? '▲' : '▼';
    dirBtn.title = currentSortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse';
  } else {
    dirBtn.style.display = 'none';
  }
}

/* ── Filter change handlers ──────────────────────────────────────────────── */

function onFilterChange() {
  displayChits();
  _updateClearFiltersButton();
}

/** When "Any" is checked, uncheck all specific options. */
function onFilterAnyToggle(anyCb) {
  if (anyCb.checked) {
    var filterType = anyCb.dataset.filter;
    var container = anyCb.closest('.multi-select');
    if (container) {
      container.querySelectorAll('input[data-filter="' + filterType + '"]').forEach(function(cb) {
        if (cb !== anyCb) cb.checked = false;
      });
    }
  }
}

/** When a specific filter option is checked, uncheck "Any". If all unchecked, re-check "Any". */
function onFilterSpecificToggle(filterType) {
  var containerId = filterType === 'status' ? 'status-multi' : 'priority-multi';
  var container = document.getElementById(containerId);
  if (!container) return;
  var anyCb = container.querySelector('input[data-any="true"]');
  var specificCbs = container.querySelectorAll('input[data-filter="' + filterType + '"]:not([data-any])');
  var anySpecificChecked = Array.from(specificCbs).some(function(cb) { return cb.checked; });
  if (anyCb) {
    if (anySpecificChecked) {
      anyCb.checked = false;
    } else {
      anyCb.checked = true;
    }
  }
}

/** Clear all checkboxes in a filter group */
function clearFilterGroup(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  var anyCb = container.querySelector('input[data-any="true"]');
  if (anyCb) anyCb.checked = true;
  onFilterChange();
}

function _filterTagCheckboxes() {
  var query = (document.getElementById('tag-filter-search')?.value || '').toLowerCase();
  var container = document.getElementById('label-multi');
  if (!container) return;
  container.querySelectorAll('div').forEach(function(row) {
    var spans = row.querySelectorAll('span');
    if (spans.length === 0) return;
    var text = Array.from(spans).map(function(s) { return s.textContent; }).join(' ').toLowerCase();
    if (row.parentElement === container || row.parentElement?.parentElement === container) {
      row.style.display = (!query || text.includes(query)) ? '' : 'none';
    }
  });
}

function _clearAllFilters() {
  document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  var sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
  var sa = document.getElementById('show-archived'); if (sa) sa.checked = false;
  var su = document.getElementById('show-unmarked'); if (su) su.checked = true;
  var hpd = document.getElementById('hide-past-due'); if (hpd) hpd.checked = false;
  var hc = document.getElementById('hide-complete'); if (hc) hc.checked = false;
  var hd = document.getElementById('hide-declined'); if (hd) hd.checked = false;
  var hlO = document.getElementById('highlight-overdue'); if (hlO) hlO.checked = true;
  var hlB = document.getElementById('highlight-blocked'); if (hlB) hlB.checked = true;
  var search = document.getElementById('search'); if (search) search.value = '';
  document.querySelectorAll('input[data-any="true"]').forEach(function(cb) { cb.checked = true; });
  if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
  if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
  // Clear sharing filters (Requirement 7.5)
  var swm = document.getElementById('filter-shared-with-me'); if (swm) swm.checked = false;
  var sbm = document.getElementById('filter-shared-by-me'); if (sbm) sbm.checked = false;
  currentSortField = null;
  var sortSel = document.getElementById('sort-select'); if (sortSel) sortSel.value = '';
  _updateSortUI();
  onFilterChange();
}

/** Reset search to the default filter for the current tab */
function _resetDefaultFilters() {
  var search = document.getElementById('search');
  var tabKey = currentTab.toLowerCase();
  if (search && _defaultFilters && _defaultFilters[tabKey]) {
    search.value = _defaultFilters[tabKey];
  } else if (search) {
    search.value = '';
  }
  displayChits();
  _updateClearFiltersButton();
}

function _updateClearFiltersButton() {
  // Reset Defaults button visibility (now inside the filters section)
  var resetBtn = document.getElementById('reset-defaults-btn');
  if (resetBtn) {
    var tabKey = currentTab.toLowerCase();
    var hasDefault = _defaultFilters && _defaultFilters[tabKey];
    resetBtn.style.display = hasDefault ? '' : 'none';
  }
}

/* ── Filter value getters ────────────────────────────────────────────────── */

function _getSelectedFilterValues(containerId, filterType) {
  var boxes = document.querySelectorAll('#' + containerId + ' input[data-filter="' + filterType + '"]:checked');
  var vals = [];
  boxes.forEach(function(b) { if (b.value) vals.push(b.value); });
  return vals;
}

function _getSelectedStatuses() { return _getSelectedFilterValues('status-multi', 'status'); }
function _getSelectedLabels() { return _getSelectedFilterValues('label-multi', 'label'); }
function _getSelectedPriorities() { return _getSelectedFilterValues('priority-multi', 'priority'); }

/* ── Archive/pinned toggles (hotkey helpers) ─────────────────────────────── */

function _toggleFilterArchived() {
  var cb = document.getElementById('show-archived');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _toggleFilterPinned() {
  var cb = document.getElementById('show-pinned');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _filterFocusSearch() {
  _exitHotkeyMode();
  _expandFiltersSection();
  var searchInput = document.getElementById('search');
  if (searchInput) searchInput.focus();
}

function _pickSort(field) {
  currentSortField = field;
  currentSortDir = 'asc';
  var sel = document.getElementById('sort-select');
  if (sel) sel.value = currentSortField;
  _updateSortUI();
  displayChits();
  _exitHotkeyMode();
}

/* ── CwocSidebarFilter class ─────────────────────────────────────────────── */
/* Extracted to shared/shared-sidebar-filter.js for reuse across pages.
   The CwocSidebarFilter function is loaded from that shared file. */

/* ── Tag filter panel ────────────────────────────────────────────────────── */

/** Build the tag filter panel with search box, favorites first, colored tags. */
function _buildTagFilterPanel() {
  var allTags = (_cachedTagObjects || []).filter(function(t) { return t.name && !isSystemTag(t.name); });
  if (!window._sidebarTagSelection) window._sidebarTagSelection = [];

  CwocSidebarFilter({
    containerId: 'panel-label-options',
    items: allTags.map(function(t) { return { name: t.name, favorite: !!t.favorite, color: t.color }; }),
    selection: window._sidebarTagSelection,
    onChange: function() {
      _syncSidebarTagCheckboxes(document.getElementById('label-multi'), _cachedTagObjects);
      onFilterChange();
    },
    searchPlaceholder: 'Search tags...',
    showColorBadge: true
  });
}

function _syncSidebarTagCheckboxes(container, tagObjects) {
  container.querySelectorAll('input[data-filter="label"]').forEach(function(cb) { cb.remove(); });
  var sel = window._sidebarTagSelection || [];
  tagObjects.forEach(function(t) {
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = t.name;
    cb.dataset.filter = 'label';
    cb.checked = sel.includes(t.name);
    cb.style.display = 'none';
    container.appendChild(cb);
  });
}

/* ── People filter panel ─────────────────────────────────────────────────── */

/** Build the people filter panel — fetches contacts and renders chip-based filter. */
async function _buildPeopleFilterPanel() {
  if (!window._sidebarPeopleSelection) window._sidebarPeopleSelection = [];
  try {
    var contactResp = await fetch('/api/contacts');
    var contacts = contactResp.ok ? await contactResp.json() : [];
    window._cachedPeopleContacts = contacts;

    // Also fetch system users for the people filter
    var usersResp = await fetch('/api/auth/switchable-users');
    var users = usersResp.ok ? await usersResp.json() : [];
    window._cachedPeopleUsers = users;

    _renderPeopleFilterPanel(contacts);
  } catch (e) {
    console.error('Could not load contacts/users for people filter:', e);
  }
}

/** Render the people filter panel as chips into both sidebar and hotkey panel. */
function _renderPeopleFilterPanel(contacts) {
  if (!window._sidebarPeopleSelection) window._sidebarPeopleSelection = [];
  var selection = window._sidebarPeopleSelection;
  var users = window._cachedPeopleUsers || [];
  _renderPeopleChipFilter('people-multi', contacts, users, selection);
  _renderPeopleChipFilter('panel-people-options', contacts, users, selection);
}

function _renderPeopleChipFilter(containerId, contacts, users, selection) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if ((!contacts || contacts.length === 0) && (!users || users.length === 0)) {
    container.innerHTML = '<span style="font-size:0.8em;opacity:0.5;">No contacts or users</span>';
    return;
  }

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search people...';
  searchInput.style.cssText = 'width:100%;padding:3px 6px;font-size:0.8em;margin-bottom:6px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  container.appendChild(searchInput);

  var chipsDiv = document.createElement('div');
  chipsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;max-height:200px;overflow-y:auto;';
  container.appendChild(chipsDiv);

  // Build a merged list: contacts + users (users marked with _isUser flag)
  var merged = [];
  var sortedContacts = (contacts || []).slice().sort(function(a, b) {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.display_name || '').localeCompare(b.display_name || '');
  });
  sortedContacts.forEach(function(c) {
    merged.push({ name: c.display_name || c.given_name || '(Unknown)', color: c.color, image_url: c.image_url, favorite: c.favorite, prefix: c.prefix, _isUser: false });
  });

  // Add system users (skip duplicates by display_name)
  var contactNames = new Set(merged.map(function(m) { return m.name.toLowerCase(); }));
  var sortedUsers = (users || []).slice().sort(function(a, b) {
    return (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '');
  });
  sortedUsers.forEach(function(u) {
    var uName = u.display_name || u.username || '(Unknown)';
    if (!contactNames.has(uName.toLowerCase())) {
      merged.push({ name: uName, color: u.color, image_url: u.profile_image_url, favorite: false, prefix: null, _isUser: true, username: u.username });
    }
  });

  function renderChips(query) {
    chipsDiv.innerHTML = '';
    merged.forEach(function(item) {
      var name = item.name;
      if (query && !name.toLowerCase().includes(query)) return;

      var isSelected = selection.includes(name);
      var chip = document.createElement('span');
      chip.className = 'cwoc-sidebar-people-chip' + (item._isUser ? ' cwoc-sidebar-user-chip' : '');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 2px;border-radius:12px;font-size:0.8em;cursor:pointer;user-select:none;transition:transform 0.1s;';

      var bgColor = item.color || '#d2b48c';
      chip.style.backgroundColor = bgColor;
      chip.style.color = _isPeopleColorLight(bgColor) ? '#2b1e0f' : '#fff';

      if (item._isUser) {
        // User chips: thicker, very dark brown border
        chip.style.border = '2px solid #1a1208';
      } else {
        // Contact chips: standard border matching color
        chip.style.border = '1px solid ' + bgColor;
      }

      if (isSelected) {
        chip.style.outline = '2px solid #4a2c2a';
        chip.style.fontWeight = 'bold';
      } else {
        chip.style.opacity = '0.7';
      }

      var thumb = document.createElement('span');
      thumb.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;';
      if (item.image_url) {
        thumb.innerHTML = '<img src="' + item.image_url + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />';
      } else if (item._isUser) {
        // User icon placeholder
        thumb.innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(139,90,43,0.15);color:#8b5a2b;font-size:9px;"><i class="fas fa-user"></i></span>';
      } else {
        thumb.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.1);text-align:center;line-height:18px;font-size:9px;">?</span>';
      }
      chip.appendChild(thumb);

      var nameSpan = document.createElement('span');
      var chipDisplayName = name;
      if (item.prefix && chipDisplayName.startsWith(item.prefix)) {
        chipDisplayName = chipDisplayName.substring(item.prefix.length).trim();
      }
      nameSpan.textContent = (item.favorite ? '★ ' : '') + chipDisplayName;
      chip.appendChild(nameSpan);

      if (item._isUser && item.username) {
        chip.title = item.username;
      }

      chip.addEventListener('click', function() {
        var idx = selection.indexOf(name);
        if (idx === -1) {
          selection.push(name);
        } else {
          selection.splice(idx, 1);
        }
        onFilterChange();
        _renderPeopleFilterPanel(window._cachedPeopleContacts);
      });

      chipsDiv.appendChild(chip);
    });

    if (chipsDiv.children.length === 0) {
      chipsDiv.innerHTML = '<span style="opacity:0.5;font-size:0.8em;">No matches</span>';
    }
  }

  renderChips('');
  searchInput.addEventListener('input', function() {
    renderChips(searchInput.value.trim().toLowerCase());
  });
}

function _isPeopleColorLight(hex) { return isLightColor(hex); }

/** Clear the people filter selection. */
function clearPeopleFilter() {
  if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
  if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
  onFilterChange();
}

/** Refresh people filter when returning from another page. */
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    _buildPeopleFilterPanel();
  }
});

/* ── Sidebar toggle / section expand / collapse ──────────────────────────── */
/* These functions are now in shared-sidebar.js:
 *   toggleSidebar, restoreSidebarState, toggleSidebarSection, expandSidebarSection,
 *   _toggleFiltersSection, _expandFiltersSection, toggleFilterGroup, expandFilterGroup,
 *   _toggleTopbar, _restoreTopbarState
 */

/* ── Label/tag filter loading from settings ──────────────────────────────── */

async function _loadLabelFilters() {
  try {
    var container = document.getElementById('label-multi');
    if (!container) return;

    var tagObjects = [];
    try {
      var settings = await getCachedSettings();
      var tags = settings.tags ? (typeof settings.tags === 'string' ? JSON.parse(settings.tags) : settings.tags) : [];
      tagObjects = tags.map(function(t) { return typeof t === 'string' ? { name: t, color: null, favorite: false } : t; }).filter(function(t) { return t.name; });
      _cachedTagObjects = tagObjects;
      if (settings.chit_options) {
        _chitOptions = Object.assign({}, _chitOptions, settings.chit_options);
      }
      if (settings.week_start_day !== undefined) {
        _weekStartDay = parseInt(settings.week_start_day) || 0;
      }
      if (settings.work_start_hour !== undefined) _workStartHour = parseInt(settings.work_start_hour) || 8;
      if (settings.work_end_hour !== undefined) _workEndHour = parseInt(settings.work_end_hour) || 17;
      if (settings.work_days) _workDays = settings.work_days.split(',').map(Number);
      if (settings.enabled_periods) _enabledPeriods = settings.enabled_periods.split(',');
      if (settings.custom_days_count) _customDaysCount = parseInt(settings.custom_days_count) || 7;
      if (settings.all_view_start_hour !== undefined) _allViewStartHour = parseInt(settings.all_view_start_hour) || 0;
      if (settings.all_view_end_hour !== undefined) _allViewEndHour = parseInt(settings.all_view_end_hour) || 24;
      if (settings.day_scroll_to_hour !== undefined) _dayScrollToHour = parseInt(settings.day_scroll_to_hour) || 5;
      _applyEnabledPeriods();
    } catch (e) { /* ignore */ }

    if (tagObjects.length === 0 && chits.length > 0) {
      var seen = new Set();
      chits.forEach(function(c) {
        (c.tags || []).forEach(function(t) {
          if (t && !seen.has(t)) { seen.add(t); tagObjects.push({ name: t, color: null, favorite: false }); }
        });
      });
      tagObjects.sort(function(a, b) { return a.name.localeCompare(b.name); });
    }

    tagObjects = tagObjects.filter(function(t) { return !isSystemTag(t.name); });

    var prevSelected = [];
    container.querySelectorAll('input:checked').forEach(function(cb) { prevSelected.push(cb.value); });
    if (window._pendingLabelFilters) {
      window._pendingLabelFilters.forEach(function(v) { if (!prevSelected.includes(v)) prevSelected.push(v); });
      delete window._pendingLabelFilters;
    }

    window._sidebarTagSelection = prevSelected.slice();

    container.innerHTML = '';
    if (tagObjects.length === 0) {
      container.innerHTML = '<span style="font-size:0.8em;opacity:0.5;">No tags defined</span>';
      return;
    }

    var tree = buildTagTree(tagObjects);
    renderTagTree(container, tree, window._sidebarTagSelection, function(fullPath, isNowSelected) {
      var idx = window._sidebarTagSelection.indexOf(fullPath);
      if (isNowSelected && idx === -1) window._sidebarTagSelection.push(fullPath);
      else if (!isNowSelected && idx !== -1) window._sidebarTagSelection.splice(idx, 1);
      _syncSidebarTagCheckboxes(container, tagObjects);
      onFilterChange();
    });

    _syncSidebarTagCheckboxes(container, tagObjects);
  } catch (e) {
    console.warn('Could not load label filters:', e);
  }
}

/* ── Saved Searches are in main-search.js ────────────────────────────────── */

/* ── Notification Inbox ──────────────────────────────────────────────────── */
/* These functions are now in shared-sidebar.js:
 *   _toggleNotifInbox, _fetchNotifications, _updateNotifBadge,
 *   _renderNotifInbox, _respondNotification
 */
