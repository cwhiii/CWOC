/* Main application functionality */
let currentTab = "Calendar";
let chits = [];
let currentWeekStart = null;
let currentView = "Week";
let previousState = { tab: "Calendar", view: "Week" };

// ── Responsive week view paging state ────────────────────────────────────────
let _weekViewDayOffset = 0; // which day index to start from when showing < 7 days

// ── Sort & filter state ──────────────────────────────────────────────────────
let currentSortField = null;   // null | 'title' | 'start' | 'due' | 'updated' | 'created'
let currentSortDir = 'asc';    // 'asc' | 'desc'

// ── Hotkey submenu state ─────────────────────────────────────────────────────
let _hotkeyMode = null;  // null | 'PERIOD' | 'FILTER' | 'ORDER' | 'FILTER_STATUS' | 'FILTER_LABEL' | 'FILTER_PRIORITY' | 'FILTER_PEOPLE'

// Global tag objects cache for color lookups
let _cachedTagObjects = [];

// Chit display options (loaded from settings)
let _chitOptions = { fade_past_chits: true, highlight_overdue_chits: true, delete_past_alarm_chits: false, show_tab_counts: false };

// Snooze registry: { chitId-alertIdx: expiresAtMs }
let _snoozeRegistry = {};

// Default search filters per tab (loaded from settings)
let _defaultFilters = {};

// ── Global Search state ──────────────────────────────────────────────────────
let _globalSearchResults = [];
let _globalSearchQuery = '';

/** Build a styled empty-state message with an optional Create Chit button. */
function _emptyState(message) {
  return `<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;">
    <p style="font-size:1.1em;margin-bottom:0.8em;">${message}</p>
    <button class="standard-button" onclick="storePreviousState(); window.location.href='/editor';" style="font-family:inherit;">+ Create Chit</button>
  </div>`;
}

/** Get tag color from cached settings tags, fallback to pastel */
function _getTagColor(tagName) {
  const tag = _cachedTagObjects.find(t => t.name === tagName);
  return (tag && tag.color) ? tag.color : getPastelColor(tagName);
}

/** Get tag font color from cached settings tags, fallback to dark brown */
function _getTagFontColor(tagName) {
  const tag = _cachedTagObjects.find(t => t.name === tagName);
  return (tag && tag.fontColor) ? tag.fontColor : '#2b1e0f';
}

function onSortSelectChange() {
  const sel = document.getElementById('sort-select');
  currentSortField = sel ? sel.value || null : null;
  currentSortDir = 'asc';
  _updateSortUI();
  displayChits();
}

function toggleSortDir() {
  currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  _updateSortUI();
  displayChits();
}

function _updateSortUI() {
  const dirBtn = document.getElementById('sort-dir-btn');
  if (!dirBtn) return;
  if (currentSortField && currentSortField !== 'manual' && currentSortField !== 'random' && currentSortField !== 'upcoming') {
    dirBtn.style.display = '';
    dirBtn.textContent = currentSortDir === 'asc' ? '▲' : '▼';
    dirBtn.title = currentSortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse';
  } else {
    dirBtn.style.display = 'none';
  }
}

function onFilterChange() {
  displayChits();
  _updateClearFiltersButton();
}

/** When "Any" is checked, uncheck all specific options. When unchecked, do nothing special. */
function onFilterAnyToggle(anyCb) {
  if (anyCb.checked) {
    const filterType = anyCb.dataset.filter;
    const container = anyCb.closest('.multi-select');
    if (container) {
      container.querySelectorAll(`input[data-filter="${filterType}"]`).forEach(cb => {
        if (cb !== anyCb) cb.checked = false;
      });
    }
  }
}

/** When a specific filter option is checked, uncheck "Any". If all unchecked, re-check "Any". */
function onFilterSpecificToggle(filterType) {
  const containerId = filterType === 'status' ? 'status-multi' : 'priority-multi';
  const container = document.getElementById(containerId);
  if (!container) return;
  const anyCb = container.querySelector('input[data-any="true"]');
  const specificCbs = container.querySelectorAll(`input[data-filter="${filterType}"]:not([data-any])`);
  const anySpecificChecked = Array.from(specificCbs).some(cb => cb.checked);
  if (anyCb) {
    if (anySpecificChecked) {
      anyCb.checked = false;
    } else {
      anyCb.checked = true;
    }
  }
}

/** Clear all checkboxes in a filter group (same as Backspace hotkey) */
function clearFilterGroup(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  // Re-check "Any" if it exists
  const anyCb = container.querySelector('input[data-any="true"]');
  if (anyCb) anyCb.checked = true;
  onFilterChange();
}

function _filterTagCheckboxes() {
  const query = (document.getElementById('tag-filter-search')?.value || '').toLowerCase();
  // Filter tree nodes in the sidebar tag panel
  const container = document.getElementById('label-multi');
  if (!container) return;
  container.querySelectorAll('div').forEach(row => {
    // Only filter visible rows that have tag text
    const spans = row.querySelectorAll('span');
    if (spans.length === 0) return;
    const text = Array.from(spans).map(s => s.textContent).join(' ').toLowerCase();
    if (row.parentElement === container || row.parentElement?.parentElement === container) {
      row.style.display = (!query || text.includes(query)) ? '' : 'none';
    }
  });
}

function _clearAllFilters() {
  document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  const sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
  const sa = document.getElementById('show-archived'); if (sa) sa.checked = false;
  const su = document.getElementById('show-unmarked'); if (su) su.checked = true;
  const hpd = document.getElementById('hide-past-due'); if (hpd) hpd.checked = false;
  const search = document.getElementById('search'); if (search) search.value = '';
  // Re-check "Any" checkboxes
  document.querySelectorAll('input[data-any="true"]').forEach(cb => { cb.checked = true; });
  // Clear people filter selection
  if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
  if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
  currentSortField = null;
  const sortSel = document.getElementById('sort-select'); if (sortSel) sortSel.value = '';
  _updateSortUI();
  onFilterChange();
}

/** Reset search to the default filter for the current tab */
function _resetDefaultFilters() {
  const search = document.getElementById('search');
  const tabKey = currentTab.toLowerCase();
  if (search && _defaultFilters && _defaultFilters[tabKey]) {
    search.value = _defaultFilters[tabKey];
  } else if (search) {
    search.value = '';
  }
  displayChits();
  _updateClearFiltersButton();
}

function _updateClearFiltersButton() {
  const section = document.getElementById('section-clear-filters');
  if (!section) return;
  const hasStatusFilter = _getSelectedStatuses().length > 0;
  const hasLabelFilter = _getSelectedLabels().length > 0;
  const hasPriorityFilter = _getSelectedPriorities().length > 0;
  const hasPeopleFilter = (window._sidebarPeopleSelection || []).length > 0;
  const searchText = document.getElementById('search')?.value || '';
  const showPinned = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? false;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;
  const hidePastDue = document.getElementById('hide-past-due')?.checked ?? false;
  const isDefault = !hasStatusFilter && !hasLabelFilter && !hasPriorityFilter && !hasPeopleFilter
    && !searchText && showPinned && !showArchived && showUnmarked && !hidePastDue && !currentSortField;
  section.style.display = isDefault ? 'none' : '';

  // Show "Reset Default Filters" button if the current tab has a default filter
  const resetBtn = document.getElementById('reset-defaults-btn');
  if (resetBtn) {
    const tabKey = currentTab.toLowerCase();
    const hasDefault = _defaultFilters && _defaultFilters[tabKey];
    resetBtn.style.display = hasDefault ? '' : 'none';
  }
}

function _applyArchiveFilter(chitList) {
  const showPinned   = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? true;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;

  if (showPinned && showArchived && showUnmarked) return chitList;
  if (!showPinned && !showArchived && !showUnmarked) return chitList;

  return chitList.filter((c) => {
    const isPinned   = !!c.pinned;
    const isArchived = !!c.archived;
    const isUnmarked = !isPinned && !isArchived;
    return (isPinned && showPinned) || (isArchived && showArchived) || (isUnmarked && showUnmarked);
  });
}

function _getSelectedFilterValues(containerId, filterType) {
  const boxes = document.querySelectorAll(`#${containerId} input[data-filter="${filterType}"]:checked`);
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals; // empty = "Any" checked or nothing specific = show all
}

function _getSelectedStatuses() { return _getSelectedFilterValues('status-multi', 'status'); }
function _getSelectedLabels() { return _getSelectedFilterValues('label-multi', 'label'); }
function _getSelectedPriorities() { return _getSelectedFilterValues('priority-multi', 'priority'); }

function _applyMultiSelectFilters(chitList) {
  let result = chitList;

  const statuses = _getSelectedStatuses();
  if (statuses.length > 0) {
    result = result.filter(c => c.status && statuses.includes(c.status));
  }

  const labels = _getSelectedLabels();
  if (labels.length > 0) {
    result = result.filter(c => {
      const tags = c.tags || [];
      return labels.some(l => matchesTagFilter(tags, l));
    });
  }

  const priorities = _getSelectedPriorities();
  if (priorities.length > 0) {
    result = result.filter(c => c.priority && priorities.includes(c.priority));
  }

  // People filter
  const selectedPeople = window._sidebarPeopleSelection || [];
  if (selectedPeople.length > 0) {
    result = result.filter(c => {
      const people = c.people || [];
      return selectedPeople.some(name => people.includes(name));
    });
  }

  return result;
}

function _applySort(chitList) {
  if (!currentSortField) return chitList;
  if (currentSortField === 'manual') {
    return applyManualOrder(currentTab, chitList);
  }
  if (currentSortField === 'random') {
    const arr = [...chitList];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  if (currentSortField === 'upcoming') {
    return [...chitList].sort((a, b) => {
      // Completed always at bottom
      if (a.status === 'Complete' && b.status !== 'Complete') return 1;
      if (b.status === 'Complete' && a.status !== 'Complete') return -1;
      const aDate = a.due_datetime ? new Date(a.due_datetime).getTime() : (a.start_datetime ? new Date(a.start_datetime).getTime() : Infinity);
      const bDate = b.due_datetime ? new Date(b.due_datetime).getTime() : (b.start_datetime ? new Date(b.start_datetime).getTime() : Infinity);
      return aDate - bDate;
    });
  }
  const nullLast = currentSortDir === 'asc' ? Infinity : -Infinity;
  return [...chitList].sort((a, b) => {
    let valA, valB;
    if (currentSortField === 'title') {
      valA = a.title ? a.title.toLowerCase() : null;
      valB = b.title ? b.title.toLowerCase() : null;
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
    } else if (currentSortField === 'start') {
      valA = a.start_datetime ? new Date(a.start_datetime).getTime() : nullLast;
      valB = b.start_datetime ? new Date(b.start_datetime).getTime() : nullLast;
    } else if (currentSortField === 'due') {
      valA = a.due_datetime ? new Date(a.due_datetime).getTime() : nullLast;
      valB = b.due_datetime ? new Date(b.due_datetime).getTime() : nullLast;
    } else if (currentSortField === 'updated') {
      valA = a.modified_datetime ? new Date(a.modified_datetime).getTime() : nullLast;
      valB = b.modified_datetime ? new Date(b.modified_datetime).getTime() : nullLast;
    } else if (currentSortField === 'created') {
      valA = a.created_datetime ? new Date(a.created_datetime).getTime() : nullLast;
      valB = b.created_datetime ? new Date(b.created_datetime).getTime() : nullLast;
    } else if (currentSortField === 'status') {
      const order = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, 'Complete': 4 };
      valA = order[a.status] || 99;
      valB = order[b.status] || 99;
    }
    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Sidebar dimming → Full-screen overlay + floating panels ──────────────────

// Helper: build a chit card header row with icons, title, and orderable meta
// Returns a div with: [pinned icon][archived icon][alert indicators] Title ... meta values
function _buildChitHeader(chit, titleHtml, settings) {
  const row = document.createElement('div');
  row.className = 'chit-header-row';

  const left = document.createElement('div');
  left.className = 'chit-header-left';

  if (chit.pinned) {
    const icon = document.createElement('i');
    icon.className = 'fas fa-bookmark';
    icon.title = 'Pinned';
    icon.style.fontSize = '0.85em';
    left.appendChild(icon);
  }
  if (chit.archived) {
    const icon = document.createElement('span');
    icon.textContent = '📦';
    icon.title = 'Archived';
    left.appendChild(icon);
  }

  // Visual indicators (alerts, weather, people, recurrence)
  if (settings && typeof _getAllIndicators === 'function') {
    const indicators = _getAllIndicators(chit, settings, 'card');
    if (indicators) {
      const alertSpan = document.createElement('span');
      alertSpan.className = 'alert-indicators';
      alertSpan.textContent = indicators;
      left.appendChild(alertSpan);
    }
  }

  // Weather indicator — async-populated with actual forecast
  if (chit.location && chit.location.trim()) {
    var weatherMode = (settings || {}).weather || 'always';
    if (typeof _shouldShow === 'function' && _shouldShow(weatherMode, 'card')) {
      const wxSpan = document.createElement('span');
      wxSpan.className = 'chit-weather-indicator';
      wxSpan.dataset.chitLocation = chit.location;
      // Check cache first for instant display
      var wxCacheKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
      var wxCached = null;
      try { wxCached = JSON.parse(localStorage.getItem(wxCacheKey)); } catch (e) {}
      if (wxCached && wxCached.icon && (Date.now() - wxCached.ts < 3600000)) {
        wxSpan.innerHTML = wxCached.icon + ' <span class="chit-wx-detail">' + _escHtml(wxCached.tooltip) + '</span> ';
        wxSpan.title = wxCached.tooltip;
      } else {
        wxSpan.textContent = '⏳ ';
        wxSpan.title = 'Loading weather…';
        _queueChitWeatherFetch(chit.location, wxSpan);
      }
      left.appendChild(wxSpan);
    }
  }

  const title = document.createElement('span');
  title.className = 'chit-header-title';
  if (titleHtml) {
    title.innerHTML = titleHtml;
  } else {
    title.textContent = chit.title || '(Untitled)';
  }
  left.appendChild(title);

  row.appendChild(left);

  // Meta values in a single row on the right
  const right = document.createElement('div');
  right.className = 'chit-header-meta';

  const sortIndicator = currentSortDir === 'asc' ? ' ▲' : ' ▼';

  function addMeta(text, fieldName) {
    const s = document.createElement('span');
    s.textContent = text;
    if (currentSortField === fieldName) {
      s.style.fontWeight = 'bold';
      s.textContent = text + sortIndicator;
    }
    right.appendChild(s);
  }

  if (chit.status) addMeta(chit.status, 'status');
  if (chit.priority) addMeta(chit.priority, null);

  // Due date — red + bold if overdue
  if (chit.due_datetime) {
    const dueDate = new Date(chit.due_datetime);
    const isOverdue = dueDate < new Date() && chit.status !== 'Complete';
    const s = document.createElement('span');
    s.textContent = `Due: ${formatDate(dueDate)}`;
    if (isOverdue) { s.style.color = '#b22222'; s.style.fontWeight = 'bold'; }
    if (currentSortField === 'due') { s.style.fontWeight = 'bold'; s.textContent += (currentSortDir === 'asc' ? ' ▲' : ' ▼'); }
    right.appendChild(s);
  }

  if (chit.start_datetime) addMeta(`Start: ${formatDate(new Date(chit.start_datetime))}`, 'start');
  if (chit.modified_datetime) addMeta(`Updated: ${formatDate(new Date(chit.modified_datetime))}`, 'updated');
  if (chit.created_datetime) addMeta(`Created: ${formatDate(new Date(chit.created_datetime))}`, 'created');
  const tags = (chit.tags || []).filter(t => !isSystemTag(t));
  if (tags.length > 0) {
    tags.forEach(tagName => {
      const tagColor = _getTagColor(tagName);
      const tagFontColor = _getTagFontColor(tagName);
      const chip = document.createElement('span');
      chip.style.cssText = `display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.75em;margin-left:4px;background:${tagColor};color:${tagFontColor};`;
      chip.textContent = tagName.split('/').pop();
      right.appendChild(chip);
    });
  }

  row.appendChild(right);
  return row;
}

// Compact meta for Notes view (just icons before title, no meta row)
function _renderChitMeta(chit, mode) {
  // Legacy — kept for any remaining callers but views should use _buildChitHeader
  const meta = document.createElement('div');
  meta.className = 'chit-meta';
  return meta;
}

function _showPanel(panelId) {
  document.getElementById('hotkey-overlay')?.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
}

function _hideAllPanels() {
  document.getElementById('hotkey-overlay')?.classList.remove('active');
  document.querySelectorAll('.hotkey-panel').forEach(p => p.classList.remove('active'));
}

function _dimSidebar(activeId, activeFilterGroupId) {
  // Now uses full-screen overlay + floating panels instead of sidebar dimming
}

function _undimSidebar() {
  _hideAllPanels();
}

function _exitHotkeyMode() {
  _hotkeyMode = null;
  _hideAllPanels();
}

// ── Panel click handlers ─────────────────────────────────────────────────────
function _pickPeriod(period) {
  if (!_enabledPeriods.includes(period)) return; // disabled in settings
  _weekViewDayOffset = 0; // reset day paging when switching periods
  currentView = period;
  const sel = document.getElementById('period-select');
  if (sel) sel.value = currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
  _exitHotkeyMode();
}

/** Apply enabled periods: hide disabled options in dropdown, grey out in panels/reference */
function _applyEnabledPeriods() {
  // Update X Days labels with actual count
  const xLabel = `${_customDaysCount} Days`;
  const sel = document.getElementById('period-select');
  if (sel) {
    Array.from(sel.options).forEach(opt => {
      if (opt.value === 'SevenDay') opt.textContent = xLabel;
      opt.disabled = !_enabledPeriods.includes(opt.value);
      opt.style.display = _enabledPeriods.includes(opt.value) ? '' : 'none';
    });
  }

  // Period hotkey panel — grey out disabled, update X Days label
  const panel = document.getElementById('panel-period');
  if (panel) {
    panel.querySelectorAll('.hotkey-panel-option').forEach(opt => {
      const onclick = opt.getAttribute('onclick') || '';
      const match = onclick.match(/_pickPeriod\('(\w+)'\)/);
      if (match) {
        const period = match[1];
        // Update X Days label
        if (period === 'SevenDay') {
          const labelEl = opt.querySelector('.panel-label');
          if (labelEl) labelEl.textContent = xLabel;
        }
        if (_enabledPeriods.includes(period)) {
          opt.style.opacity = '';
          opt.style.cursor = '';
          opt.title = '';
        } else {
          opt.style.opacity = '0.35';
          opt.style.cursor = 'not-allowed';
          opt.title = 'This period is disabled in Settings';
        }
      }
    });
  }

  // Reference overlay — grey out disabled periods
  const refOverlay = document.getElementById('reference-overlay');
  if (refOverlay) {
    const periodMap = { 'I': 'Itinerary', 'D': 'Day', 'W': 'Week', 'K': 'Work', 'S': 'SevenDay', 'M': 'Month', 'Y': 'Year' };
    refOverlay.querySelectorAll('.ref-col div').forEach(div => {
      const keyEl = div.querySelector('.ref-key');
      if (!keyEl) return;
      const key = keyEl.textContent.trim();
      const period = periodMap[key];
      if (period !== undefined) {
        if (_enabledPeriods.includes(period)) {
          div.style.opacity = '';
          div.style.cursor = '';
          div.title = '';
        } else {
          div.style.opacity = '0.35';
          div.style.cursor = 'not-allowed';
          div.title = 'This period is disabled in Settings';
        }
      }
    });
  }
}

function _enterFilterSub(type) {
  _hideAllPanels();
  if (type === 'status') {
    _hotkeyMode = 'FILTER_STATUS';
    expandFilterGroup('filter-status');
    _buildFilterSubPanel('panel-status-options', '#status-multi input[data-filter="status"]');
    _showPanel('panel-filter-status');
  } else if (type === 'label') {
    _hotkeyMode = 'FILTER_LABEL';
    expandFilterGroup('filter-label');
    _buildTagFilterPanel();
    _showPanel('panel-filter-label');
  } else if (type === 'priority') {
    _hotkeyMode = 'FILTER_PRIORITY';
    expandFilterGroup('filter-priority');
    _buildFilterSubPanel('panel-priority-options', '#priority-multi input[data-filter="priority"]');
    _showPanel('panel-filter-priority');
  } else if (type === 'people') {
    _hotkeyMode = 'FILTER_PEOPLE';
    expandFilterGroup('filter-people');
    if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
    _showPanel('panel-filter-people');
  }
}

function _buildFilterSubPanel(containerId, checkboxSelector) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const boxes = document.querySelectorAll(checkboxSelector);
  // Cap at 9 items (keys 1-9)
  const maxItems = Math.min(boxes.length, 9);
  for (let i = 0; i < maxItems; i++) {
    const cb = boxes[i];
    const label = cb.value || (cb.dataset.any ? '— Any' : '—');
    const div = document.createElement('div');
    div.className = 'hotkey-panel-option' + (cb.checked ? ' selected' : '');
    div.innerHTML = `<span class="panel-key">${i + 1}</span><span class="panel-label">${label}</span>`;
    div.onclick = () => {
      cb.checked = !cb.checked;
      div.classList.toggle('selected', cb.checked);
      // Handle Any toggle
      if (cb.dataset.any) {
        onFilterAnyToggle(cb);
      } else {
        const filterType = cb.dataset.filter;
        if (filterType) onFilterSpecificToggle(filterType);
      }
      onFilterChange();
    };
    container.appendChild(div);
  }
}

/**
 * CwocSidebarFilter — reusable filter panel for sidebar.
 * @param {Object} config
 * @param {string} config.containerId — DOM element ID for the panel
 * @param {Array}  config.items — [{name, favorite, color?}]
 * @param {Array}  config.selection — current selected names (mutated in place)
 * @param {Function} config.onChange — called when selection changes
 * @param {string} [config.searchPlaceholder] — e.g. "Search tags..."
 * @param {boolean} [config.showColorBadge] — show colored badge (tags) vs plain text (people)
 */
function CwocSidebarFilter(config) {
  const container = document.getElementById(config.containerId);
  if (!container) return;
  container.innerHTML = '';

  const items = config.items || [];
  const selection = config.selection || [];
  const onChange = config.onChange || function() {};
  const placeholder = config.searchPlaceholder || 'Search...';
  const showColorBadge = !!config.showColorBadge;

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = placeholder;
  searchInput.style.cssText = 'width:100%;padding:4px 8px;font-size:0.9em;margin-bottom:8px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  container.appendChild(searchInput);

  const listDiv = document.createElement('div');
  listDiv.className = 'cwoc-sidebar-filter-list';
  container.appendChild(listDiv);

  // Sort: favorites first, then alphabetical
  const sorted = [...items].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });

  function renderList(query) {
    listDiv.innerHTML = '';
    let shown = 0;
    sorted.forEach(item => {
      if (shown >= 9) return;
      if (query && !(item.name || '').toLowerCase().includes(query)) return;

      shown++;
      const isSelected = selection.includes(item.name);

      const div = document.createElement('div');
      div.className = 'hotkey-panel-option' + (isSelected ? ' selected' : '');
      div.style.cssText = 'display:flex;align-items:center;gap:6px;';

      // Hotkey number badge
      const keySpan = document.createElement('span');
      keySpan.className = 'panel-key';
      keySpan.textContent = shown;
      div.appendChild(keySpan);

      // Favorite star
      if (item.favorite) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.9em;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        div.appendChild(star);
      }

      // Label — colored badge or plain text
      const label = document.createElement('span');
      label.className = 'panel-label';
      label.textContent = item.name;
      if (showColorBadge) {
        const color = item.color || getPastelColor(item.name);
        label.style.cssText = `background:${color};padding:1px 6px;border-radius:4px;color:#3c2f2f;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      } else {
        label.style.cssText = `padding:1px 6px;border-radius:4px;color:#3c2f2f;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      }
      div.appendChild(label);

      // Color dot badge (when showColorBadge is false but item has a color)
      if (!showColorBadge && item.color) {
        const dot = document.createElement('span');
        dot.className = 'cwoc-sidebar-filter-dot';
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};flex-shrink:0;`;
        div.insertBefore(dot, label);
      }

      div.addEventListener('click', () => {
        const idx = selection.indexOf(item.name);
        if (idx === -1) {
          selection.push(item.name);
        } else {
          selection.splice(idx, 1);
        }
        onChange(selection);
        renderList(searchInput.value.trim().toLowerCase());
      });

      listDiv.appendChild(div);
    });
    if (shown === 0) {
      listDiv.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">No matching items</div>';
    }
  }

  renderList('');

  searchInput.addEventListener('input', () => {
    renderList(searchInput.value.trim().toLowerCase());
  });

  setTimeout(() => searchInput.focus(), 50);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      searchInput.blur();
      _exitHotkeyMode();
    }
    // Number keys 1-9: toggle the corresponding visible item
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      const num = parseInt(e.key);
      const visibleItems = listDiv.querySelectorAll('.hotkey-panel-option');
      if (num <= visibleItems.length) {
        visibleItems[num - 1].click();
      }
    }
  });
}

/** Build the tag filter panel with search box, favorites first, colored tags.
 *  Delegates to CwocSidebarFilter with showColorBadge: true. */
function _buildTagFilterPanel() {
  const allTags = (_cachedTagObjects || []).filter(t => t.name && !isSystemTag(t.name));
  if (!window._sidebarTagSelection) window._sidebarTagSelection = [];

  CwocSidebarFilter({
    containerId: 'panel-label-options',
    items: allTags.map(t => ({ name: t.name, favorite: !!t.favorite, color: t.color })),
    selection: window._sidebarTagSelection,
    onChange: function() {
      _syncSidebarTagCheckboxes(document.getElementById('label-multi'), _cachedTagObjects);
      onFilterChange();
    },
    searchPlaceholder: 'Search tags...',
    showColorBadge: true
  });
}

/** Build the people filter panel — fetches contacts and renders chip-based filter. */
async function _buildPeopleFilterPanel() {
  if (!window._sidebarPeopleSelection) window._sidebarPeopleSelection = [];
  try {
    const resp = await fetch('/api/contacts');
    if (!resp.ok) return;
    const contacts = await resp.json();
    window._cachedPeopleContacts = contacts;
    _renderPeopleFilterPanel(contacts);
  } catch (e) {
    console.error('Could not load contacts for people filter:', e);
  }
}

/** Render the people filter panel as chips (like tags) into both sidebar and hotkey panel. */
function _renderPeopleFilterPanel(contacts) {
  if (!window._sidebarPeopleSelection) window._sidebarPeopleSelection = [];
  var selection = window._sidebarPeopleSelection;

  // Render into sidebar container
  _renderPeopleChipFilter('people-multi', contacts, selection);
  // Render into hotkey panel container
  _renderPeopleChipFilter('panel-people-options', contacts, selection);
}

function _renderPeopleChipFilter(containerId, contacts, selection) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<span style="font-size:0.8em;opacity:0.5;">No contacts</span>';
    return;
  }

  // Search input
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search people...';
  searchInput.style.cssText = 'width:100%;padding:3px 6px;font-size:0.8em;margin-bottom:6px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  container.appendChild(searchInput);

  var chipsDiv = document.createElement('div');
  chipsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;max-height:200px;overflow-y:auto;';
  container.appendChild(chipsDiv);

  // Sort: favorites first, then alphabetical
  var sorted = contacts.slice().sort(function (a, b) {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  function renderChips(query) {
    chipsDiv.innerHTML = '';
    sorted.forEach(function (c) {
      var name = c.display_name || c.given_name || '(Unknown)';
      if (query && !name.toLowerCase().includes(query)) return;

      var isSelected = selection.includes(name);
      var chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 2px;border-radius:12px;font-size:0.8em;cursor:pointer;border:1px solid;user-select:none;transition:transform 0.1s;';

      var bgColor = c.color || '#d2b48c';
      chip.style.backgroundColor = bgColor;
      chip.style.borderColor = bgColor;
      chip.style.color = _isPeopleColorLight(bgColor) ? '#2b1e0f' : '#fff';
      if (isSelected) {
        chip.style.outline = '2px solid #4a2c2a';
        chip.style.fontWeight = 'bold';
      } else {
        chip.style.opacity = '0.7';
      }

      // Thumbnail
      var thumb = document.createElement('span');
      thumb.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;';
      if (c.image_url) {
        thumb.innerHTML = '<img src="' + c.image_url + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />';
      } else {
        thumb.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.1);text-align:center;line-height:18px;font-size:9px;">?</span>';
      }
      chip.appendChild(thumb);

      // Star + name (without prefix)
      var nameSpan = document.createElement('span');
      var chipDisplayName = name;
      if (c.prefix && chipDisplayName.startsWith(c.prefix)) {
        chipDisplayName = chipDisplayName.substring(c.prefix.length).trim();
      }
      nameSpan.textContent = (c.favorite ? '★ ' : '') + chipDisplayName;
      chip.appendChild(nameSpan);

      chip.addEventListener('click', function () {
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
  searchInput.addEventListener('input', function () {
    renderChips(searchInput.value.trim().toLowerCase());
  });
}

// _isPeopleColorLight moved to shared.js as isLightColor()
function _isPeopleColorLight(hex) { return isLightColor(hex); }

/** Clear the people filter selection. */
function clearPeopleFilter() {
  if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
  if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
  onFilterChange();
}

/** Refresh people filter when returning from another page (e.g. contact editor). */
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) {
    _buildPeopleFilterPanel();
  }
});

function _toggleFilterArchived() {
  const cb = document.getElementById('show-archived');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _toggleFilterPinned() {
  const cb = document.getElementById('show-pinned');
  if (cb) cb.checked = !cb.checked;
  onFilterChange();
  _exitHotkeyMode();
}

function _filterFocusSearch() {
  _exitHotkeyMode();
  const searchInput = document.getElementById('search');
  if (searchInput) searchInput.focus();
}

function _pickSort(field) {
  currentSortField = field;
  currentSortDir = 'asc';
  const sel = document.getElementById('sort-select');
  if (sel) sel.value = currentSortField;
  _updateSortUI();
  displayChits();
  _exitHotkeyMode();
}

// ── Reference overlay ────────────────────────────────────────────────────────
function openHelpPage() {
  storePreviousState();
  window.location.href = '/frontend/help.html';
}

function _toggleReference() {
  const overlay = document.getElementById('reference-overlay');
  if (!overlay) return;
  overlay.classList.toggle('active');
}

function _closeReference() {
  const overlay = document.getElementById('reference-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── Clock Modal ──────────────────────────────────────────────────────────────
let _clockModalInterval = null;

async function _openClockModal() {
  // Remove existing
  const existing = document.getElementById('clock-modal-overlay');
  if (existing) { _closeClockModal(); return; }

  // Load clock settings
  let activeClocks = ['24hour', '12hour', 'hst']; // defaults
  let orientation = 'Horizontal';
  try {
    const s = await getCachedSettings();
    if (s.active_clocks) {
      const parsed = typeof s.active_clocks === 'string' ? JSON.parse(s.active_clocks) : s.active_clocks;
      if (Array.isArray(parsed) && parsed.length > 0) activeClocks = parsed;
    }
    if (s.alarm_orientation) orientation = s.alarm_orientation;
  } catch (e) { console.error('Failed to load clock settings', e); }

  const overlay = document.createElement('div');
  overlay.id = 'clock-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeClockModal(); });

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff8e1;border:2px solid #8b4513;border-radius:10px;padding:24px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:"Courier New",monospace;min-width:280px;text-align:center;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:1.1em;font-weight:bold;color:#4a2c2a;margin-bottom:16px;';
  title.textContent = '🕐 Clocks';
  modal.appendChild(title);

  const isVertical = orientation === 'Vertical';
  const clocksDiv = document.createElement('div');
  clocksDiv.id = 'clock-modal-clocks';
  clocksDiv.style.cssText = `display:flex;flex-direction:${isVertical ? 'column' : 'row'};gap:12px;align-items:center;${isVertical ? '' : 'justify-content:center;flex-wrap:wrap;'}`;
  modal.appendChild(clocksDiv);

  const closeBtn = document.createElement('div');
  closeBtn.style.cssText = 'margin-top:16px;font-size:0.8em;opacity:0.5;cursor:pointer;';
  closeBtn.textContent = 'ESC or click outside to close';
  closeBtn.onclick = _closeClockModal;
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _renderClocks(clocksDiv, activeClocks, isVertical);
  _clockModalInterval = setInterval(() => _renderClocks(clocksDiv, activeClocks, isVertical), 1000);
}

function _renderClocks(container, activeClocks, isVertical) {
  const now = new Date();
  const h24 = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';

  // HST (Holeman Simplified Time): day fraction in sub-days (sd)
  const dayFraction = (h24 * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  const hstVal = (dayFraction * 100).toFixed(3);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateStr = `${now.getFullYear()}-${months[now.getMonth()]}-${String(now.getDate()).padStart(2,'0')} ${days[now.getDay()]}`;

  let html = `<div style="font-size:1.4em;font-weight:300;color:#6b4e31;letter-spacing:3px;margin-bottom:6px;opacity:0.8;">${dateStr}</div>`;

  const bgColors = ['rgba(139,69,19,0.06)', 'rgba(139,69,19,0.18)'];
  activeClocks.forEach((clock, idx) => {
    const isHST = clock === 'hst' || clock === 'metric' || clock === 'hstbar' || clock === 'metricbar';
    const bg = (!isVertical && !isHST) ? `background:${bgColors[idx % 2]};border-radius:8px;padding:6px 14px;` : '';
    let inner = '';
    switch (clock) {
      case '24hour':
        inner = `<div style="font-size:2em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;">${String(h24).padStart(2,'0')}:${m}:${s} <span style="font-size:0.65em;">Hours</span></div>`;
        break;
      case '12hour':
        inner = `<div style="font-size:2em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;">${h12}:${m}:${s} <span style="font-size:0.65em;">${ampm}</span></div>`;
        break;
      case '12houranalog':
        inner = _renderAnalogClock(h24, now.getMinutes(), now.getSeconds());
        break;
      case 'metric':
      case 'hst':
      case 'metricbar':
      case 'hstbar':
        inner = _renderHSTClock(dayFraction, hstVal);
        break;
    }
    if (inner) html += `<div style="${bg}">${inner}</div>`;
  });

  container.innerHTML = html;
}

function _renderHSTClock(dayFraction, hstVal) {
  const pct = (dayFraction * 100).toFixed(1);
  return `<div style="position:relative;width:300px;margin:2px auto;" title="Holeman Simplified Time — ${hstVal} sd">
    <div style="width:100%;height:2.4em;background:#f5e6cc;border:2px solid #8b4513;border-radius:6px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);display:flex;align-items:center;">
      <div style="position:absolute;top:2px;left:2px;bottom:2px;width:calc(${pct}% - 4px);background:linear-gradient(90deg,#d4af37 0%,#c8965a 60%,#8b4513 100%);transition:width 1s linear;border-radius:4px;"></div>
      <div style="position:relative;width:100%;text-align:center;font-size:1.5em;font-weight:bold;color:#4a2c2a;letter-spacing:2px;line-height:2.4em;text-shadow:0 0 4px #fff8e1,0 0 8px #fff8e1,0 0 2px #fff8e1;z-index:1;">${hstVal} sd</div>
    </div>
  </div>`;
}

function _renderAnalogClock(h24, min, sec) {
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const r = cx - 4;

  // Angles (0° = 12 o'clock, clockwise)
  const hDeg = ((h24 % 12) + min / 60) * 30;
  const mDeg = (min + sec / 60) * 6;
  const sDeg = sec * 6;

  const hand = (deg, len) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + len * Math.cos(rad), y: cy + len * Math.sin(rad) };
  };
  const hTip = hand(hDeg, r * 0.48);
  const mTip = hand(mDeg, r * 0.70);
  const sTip = hand(sDeg, r * 0.78);
  const sTail = hand(sDeg + 180, r * 0.18);

  // Hour markers & minute ticks
  let markers = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    const isQ = i % 3 === 0;
    const o = r - 2, inner = isQ ? r - 16 : r - 9;
    markers += `<line x1="${cx + o * Math.cos(a)}" y1="${cy + o * Math.sin(a)}" x2="${cx + inner * Math.cos(a)}" y2="${cy + inner * Math.sin(a)}" stroke="#4a2c2a" stroke-width="${isQ ? 4 : 1.5}" stroke-linecap="round"/>`;
  }
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i * 6 - 90) * Math.PI / 180;
    ticks += `<line x1="${cx + (r - 2) * Math.cos(a)}" y1="${cy + (r - 2) * Math.sin(a)}" x2="${cx + (r - 5.5) * Math.cos(a)}" y2="${cy + (r - 5.5) * Math.sin(a)}" stroke="#8b4513" stroke-width="0.8" opacity="0.4"/>`;
  }

  // Hour numerals
  let numerals = '';
  const nums = [12,1,2,3,4,5,6,7,8,9,10,11];
  nums.forEach((n, i) => {
    const a = (i * 30 - 90) * Math.PI / 180;
    const nr = r - 30;
    numerals += `<text x="${cx + nr * Math.cos(a)}" y="${cy + nr * Math.sin(a)}" text-anchor="middle" dominant-baseline="central" fill="#4a2c2a" font-size="20" font-family="'Courier New',monospace" font-weight="bold">${n}</text>`;
  });

  return `<div style="display:inline-block;margin:2px auto;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="_cg" cx="45%" cy="40%">
          <stop offset="0%" stop-color="#fff8e1"/>
          <stop offset="80%" stop-color="#f5e6cc"/>
          <stop offset="100%" stop-color="#e8d5b0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#5c3a1e"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="#8b4513"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#_cg)"/>
      ${ticks}
      ${markers}
      ${numerals}
      <line x1="${cx}" y1="${cy}" x2="${hTip.x}" y2="${hTip.y}" stroke="#4a2c2a" stroke-width="6" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${mTip.x}" y2="${mTip.y}" stroke="#4a2c2a" stroke-width="4" stroke-linecap="round"/>
      <line x1="${sTail.x}" y1="${sTail.y}" x2="${sTip.x}" y2="${sTip.y}" stroke="#a0522d" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#d4af37" stroke="#4a2c2a" stroke-width="1.5"/>
    </svg>
  </div>`;
}

function _closeClockModal() {
  const overlay = document.getElementById('clock-modal-overlay');
  if (overlay) overlay.remove();
  if (_clockModalInterval) { clearInterval(_clockModalInterval); _clockModalInterval = null; }
}

// ── Weather Modal (W hotkey) ─────────────────────────────────────────────────

const _weatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌦️', 57: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function _getWeatherIcon(code) {
  return _weatherIcons[code] || '❓';
}

function _escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _getPrecipLabel(code) {
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunder';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  return '';
}

// ── Chit Weather Indicators (async fetch for card views) ─────────────────────

var _chitWxQueue = [];       // [{location, span}] — pending fetches
var _chitWxFetching = false; // true while processing queue
var _chitWxGeoCache = {};    // location → {lat, lon} (in-memory for session)

/** Queue a weather fetch for a chit indicator span. Batched to avoid flooding APIs. */
function _queueChitWeatherFetch(location, span) {
  _chitWxQueue.push({ location: location, span: span });
  if (!_chitWxFetching) _processChitWxQueue();
}

async function _processChitWxQueue() {
  if (_chitWxFetching || _chitWxQueue.length === 0) return;
  _chitWxFetching = true;

  // Group by location to avoid duplicate fetches
  var byLoc = {};
  while (_chitWxQueue.length > 0) {
    var item = _chitWxQueue.shift();
    var key = item.location.toLowerCase().trim();
    if (!byLoc[key]) byLoc[key] = { location: item.location, spans: [] };
    byLoc[key].spans.push(item.span);
  }

  var keys = Object.keys(byLoc);
  for (var i = 0; i < keys.length; i++) {
    var entry = byLoc[keys[i]];
    try {
      await _fetchAndApplyChitWeather(entry.location, entry.spans);
    } catch (e) { /* silently fail */ }
    // Rate-limit: small delay between locations to respect Nominatim policy
    if (i < keys.length - 1) await new Promise(function(r) { setTimeout(r, 300); });
  }

  _chitWxFetching = false;
  // Process any items queued while we were fetching
  if (_chitWxQueue.length > 0) _processChitWxQueue();
}

async function _fetchAndApplyChitWeather(address, spans) {
  var cacheKey = 'cwoc_wx_' + address.toLowerCase().trim();

  // Check localStorage cache (1 hour TTL)
  try {
    var cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.icon && (Date.now() - cached.ts < 3600000)) {
      spans.forEach(function(s) {
        s.innerHTML = cached.icon + ' <span class="chit-wx-detail">' + _escHtml(cached.tooltip) + '</span> ';
        s.title = cached.tooltip;
      });
      return;
    }
  } catch (e) {}

  // Geocode using shared progressive fallback
  var lat, lon;
  var geoKey = address.toLowerCase().trim();
  if (_chitWxGeoCache[geoKey]) {
    lat = _chitWxGeoCache[geoKey].lat;
    lon = _chitWxGeoCache[geoKey].lon;
  } else {
    try {
      var coords = await _geocodeAddress(address);
      lat = coords.lat;
      lon = coords.lon;
      _chitWxGeoCache[geoKey] = { lat: lat, lon: lon };
    } catch (e) { return; }
  }

  // Fetch weather
  var wxResp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1');
  if (!wxResp.ok) return;
  var wxData = await wxResp.json();
  if (!wxData || !wxData.daily) return;

  var today = wxData.daily;
  var weatherCode = today.weathercode[0];
  var minC = today.temperature_2m_min[0], maxC = today.temperature_2m_max[0], precipMm = today.precipitation_sum[0];
  var minF = Math.round((minC * 9) / 5 + 32), maxF = Math.round((maxC * 9) / 5 + 32);
  var precipInches = Math.ceil(precipMm * 0.0393701 * 10) / 10;
  var icon = _getWeatherIcon(weatherCode);
  var precipType = _getPrecipLabel(weatherCode);
  var precipText = precipType ? precipInches + '" ' + precipType : 'No precip';
  var tooltip = maxF + '°F / ' + minF + '°F · ' + precipText;

  // Update all spans for this location
  spans.forEach(function(s) {
    s.innerHTML = icon + ' <span class="chit-wx-detail">' + _escHtml(tooltip) + '</span> ';
    s.title = tooltip;
  });

  // Cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ icon: icon, tooltip: tooltip, ts: Date.now() }));
  } catch (e) { /* ignore */ }
}

function _buildWeatherModalHTML(content) {
  return `<div class="weather-modal">${content}<div class="weather-modal-close" onclick="_closeWeatherModal()">ESC or click outside to close</div></div>`;
}

function _buildLocationSelectorHTML(locations, selectedAddress) {
  var opts = '';
  if (locations && locations.length > 0) {
    locations.forEach(function (loc) {
      var sel = (loc.address === selectedAddress) ? ' selected' : '';
      opts += `<option value="${(loc.address || '').replace(/"/g, '&quot;')}"${sel}>${loc.label || loc.address || '(unnamed)'}</option>`;
    });
  }
  return '<div class="weather-modal-location-selector">' +
    '<select id="weather-modal-loc-dropdown" onchange="_onWeatherModalLocChange()">' +
      '<option value="">— Saved Locations —</option>' +
      opts +
      '<option value="__manual__">✏️ Type a location…</option>' +
    '</select>' +
    '<div id="weather-modal-manual-row" style="display:none;gap:4px;margin-bottom:6px;">' +
      '<input id="weather-modal-manual-input" type="text" placeholder="Enter address…" />' +
      '<button onclick="_onWeatherModalManualGo()">Go</button>' +
    '</div>' +
  '</div>';
}

function _onWeatherModalLocChange() {
  var dd = document.getElementById('weather-modal-loc-dropdown');
  var manualRow = document.getElementById('weather-modal-manual-row');
  if (!dd) return;
  if (dd.value === '__manual__') {
    if (manualRow) manualRow.style.display = 'flex';
    var inp = document.getElementById('weather-modal-manual-input');
    if (inp) inp.focus();
    return;
  }
  if (manualRow) manualRow.style.display = 'none';
  if (dd.value) {
    // Find the label for this address
    var locs = window._savedLocations || [];
    var loc = locs.find(function (l) { return l.address === dd.value; });
    _fetchWeatherForModal(dd.value, loc ? loc.label : 'Custom');
  }
}

function _onWeatherModalManualGo() {
  var inp = document.getElementById('weather-modal-manual-input');
  if (!inp || !inp.value.trim()) return;
  _fetchWeatherForModal(inp.value.trim(), 'Custom');
}

async function _openWeatherModal() {
  // Toggle off if already open
  var existing = document.getElementById('weather-modal-overlay');
  if (existing) { _closeWeatherModal(); return; }

  // Ensure saved locations are loaded
  await loadSavedLocations();
  var locations = window._savedLocations || [];
  var defaultLoc = getDefaultLocation();

  var overlay = document.createElement('div');
  overlay.id = 'weather-modal-overlay';
  overlay.setAttribute('tabindex', '-1');
  overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeWeatherModal(); });
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      var dd = document.getElementById('weather-modal-loc-dropdown');
      var inp = document.getElementById('weather-modal-manual-input');
      // If dropdown or input is focused, just blur it (first Escape)
      if (dd && document.activeElement === dd) { dd.blur(); overlay.focus(); return; }
      if (inp && document.activeElement === inp) { inp.blur(); overlay.focus(); return; }
      // Otherwise close the modal (second Escape)
      _closeWeatherModal();
    }
  });

  if (!defaultLoc && locations.length === 0) {
    overlay.innerHTML = _buildWeatherModalHTML(
      '<div class="weather-modal-error">No saved locations configured. Add one in Settings.</div>'
    );
    document.body.appendChild(overlay);
    overlay.focus();
    return;
  }

  var startLoc = defaultLoc || locations[0];
  var label = startLoc.label || 'Default';
  var address = startLoc.address || '';

  // Show modal with location selector + loading state
  overlay.innerHTML = _buildWeatherModalHTML(
    _buildLocationSelectorHTML(locations, address) +
    '<div class="weather-modal-body" id="weather-modal-body"><div style="opacity:0.6;">Loading weather…</div></div>'
  );
  document.body.appendChild(overlay);
  overlay.focus();

  // Fetch weather for the default/first location
  _fetchWeatherForModal(address, label);
}

async function _fetchWeatherForModal(address, label) {
  console.log('[block removal] _fetchWeatherForModal called with:', address, label);
  var overlay = document.getElementById('weather-modal-overlay');
  if (!overlay) return;

  // Show loading in body — but if we have cached data, show it with stale indicator
  var bodyEl = document.getElementById('weather-modal-body');
  var cacheKey = 'cwoc_weather_cache_' + address.toLowerCase().trim();
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { /* ignore */ }

  if (cached && cached.html && bodyEl) {
    // Show cached data with hourglass stale indicator
    bodyEl.innerHTML = '<div style="text-align:right;font-size:0.75em;opacity:0.5;margin-bottom:4px;">⏳ Refreshing…</div>' + cached.html;
  } else if (bodyEl) {
    bodyEl.innerHTML = '<div style="opacity:0.6;">Loading weather…</div>';
  }

  try {
    // Geocode with shared progressive fallback
    var coords = await _geocodeAddress(address);
    var lat = coords.lat, lon = coords.lon;

    // Fetch weather
    var wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1';
    var wxResp = await fetch(wxUrl);
    if (!wxResp.ok) throw new Error('weather_network');
    var wxData = await wxResp.json();
    if (!wxData || !wxData.daily) throw new Error('weather_empty');

    var today = wxData.daily;
    var weatherCode = today.weathercode[0];
    var minC = today.temperature_2m_min[0];
    var maxC = today.temperature_2m_max[0];
    var precipMm = today.precipitation_sum[0];

    var minF = Math.round((minC * 9) / 5 + 32);
    var maxF = Math.round((maxC * 9) / 5 + 32);
    var precipInches = Math.ceil(precipMm * 0.0393701 * 10) / 10;

    var icon = _getWeatherIcon(weatherCode);
    var precipType = _getPrecipLabel(weatherCode);
    var precipText = precipType ? precipInches + '" ' + precipType : 'No precipitation';

    var barMin = -14, barMax = 104, barRange = barMax - barMin;
    var lowPct = Math.max(0, Math.min(100, ((minF - barMin) / barRange) * 100));
    var highPct = Math.max(0, Math.min(100, ((maxF - barMin) / barRange) * 100));

    if (bodyEl) {
      var weatherHtml =
        '<div class="weather-modal-icon">' + icon + '</div>' +
        '<div class="weather-modal-temps"><span class="temp-high">' + maxF + '°F</span> / <span class="temp-low">' + minF + '°F</span></div>' +
        '<div class="weather-modal-precip">' + precipText + '</div>' +
        '<div class="weather-modal-temp-bar"><div class="temp-bar-marker" style="left:' + lowPct + '%" title="Low ' + minF + '°F"></div><div class="temp-bar-marker" style="left:' + highPct + '%" title="High ' + maxF + '°F"></div></div>';
      bodyEl.innerHTML = weatherHtml;
      // Cache the result
      try { localStorage.setItem(cacheKey, JSON.stringify({ html: weatherHtml, ts: Date.now() })); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('Weather modal error:', err);
    var msg = 'Weather unavailable — try again later';
    if (err.message === 'Location not found.' || err.message === 'geocode_empty') msg = 'Could not find location: ' + address;
    else if (err.message === 'No address provided.') msg = 'No address provided';
    else if (err.message === 'geocode_network') msg = 'Could not reach location service';
    else if (err.message === 'weather_network') msg = 'Could not reach weather service';
    else if (err.message === 'weather_empty') msg = 'Weather data unavailable for ' + address;

    if (bodyEl) bodyEl.innerHTML = '<div class="weather-modal-error">' + msg + '</div>';
  }
}

function _closeWeatherModal() {
  const overlay = document.getElementById('weather-modal-overlay');
  if (overlay) overlay.remove();
}

/** Pre-fetch weather for a location and store in localStorage cache (background, no UI). */
async function _fetchWeatherForCache(address, cacheKey) {
  try {
    var coords = await _geocodeAddress(address);
    var lat = coords.lat, lon = coords.lon;
    var wxResp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1');
    if (!wxResp.ok) return;
    var wxData = await wxResp.json();
    if (!wxData || !wxData.daily) return;
    var today = wxData.daily;
    var weatherCode = today.weathercode[0];
    var minC = today.temperature_2m_min[0], maxC = today.temperature_2m_max[0], precipMm = today.precipitation_sum[0];
    var minF = Math.round((minC * 9) / 5 + 32), maxF = Math.round((maxC * 9) / 5 + 32);
    var precipInches = Math.ceil(precipMm * 0.0393701 * 10) / 10;
    var icon = _getWeatherIcon(weatherCode);
    var precipType = _getPrecipLabel(weatherCode);
    var precipText = precipType ? precipInches + '" ' + precipType : 'No precipitation';
    var barMin = -14, barMax = 104, barRange = barMax - barMin;
    var lowPct = Math.max(0, Math.min(100, ((minF - barMin) / barRange) * 100));
    var highPct = Math.max(0, Math.min(100, ((maxF - barMin) / barRange) * 100));
    var html = '<div class="weather-modal-icon">' + icon + '</div><div class="weather-modal-temps"><span class="temp-high">' + maxF + '°F</span> / <span class="temp-low">' + minF + '°F</span></div><div class="weather-modal-precip">' + precipText + '</div><div class="weather-modal-temp-bar"><div class="temp-bar-marker" style="left:' + lowPct + '%" title="Low ' + minF + '°F"></div><div class="temp-bar-marker" style="left:' + highPct + '%" title="High ' + maxF + '°F"></div></div>';
    try { localStorage.setItem(cacheKey, JSON.stringify({ html: html, ts: Date.now() })); } catch (e) { /* ignore */ }
  } catch (e) { /* background fetch — silently fail */ }
}

/** Pre-fetch weather for all chits that have locations. Deduplicates by location. */
function _prefetchChitWeather(chitList) {
  if (!chitList || !chitList.length) return;
  var seen = {};
  chitList.forEach(function(chit) {
    if (!chit.location || !chit.location.trim()) return;
    var key = chit.location.toLowerCase().trim();
    if (seen[key]) return;
    seen[key] = true;
    var cacheKey = 'cwoc_wx_' + key;
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.icon && (Date.now() - cached.ts < 3600000)) return; // already cached
    } catch (e) {}
    // Queue a fetch with a dummy span (just to populate the cache)
    var dummy = document.createElement('span');
    _queueChitWeatherFetch(chit.location, dummy);
  });
}

// ── Load label/tag filters from settings ─────────────────────────────────────
async function _loadLabelFilters() {
  try {
    const container = document.getElementById('label-multi');
    if (!container) return;

    // Collect tags from settings API
    let tagObjects = [];
    try {
      const settings = await getCachedSettings();
      const tags = settings.tags ? (typeof settings.tags === 'string' ? JSON.parse(settings.tags) : settings.tags) : [];
      tagObjects = tags.map(t => typeof t === 'string' ? { name: t, color: null, favorite: false } : t).filter(t => t.name);
      _cachedTagObjects = tagObjects;
      // Load chit display options
      if (settings.chit_options) {
        _chitOptions = { ..._chitOptions, ...settings.chit_options };
      }
      // Load week start day
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

    // Also collect tags from loaded chits as fallback
    if (tagObjects.length === 0 && chits.length > 0) {
      const seen = new Set();
      chits.forEach(c => {
        (c.tags || []).forEach(t => {
          if (t && !seen.has(t)) { seen.add(t); tagObjects.push({ name: t, color: null, favorite: false }); }
        });
      });
      tagObjects.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Filter out system tags
    tagObjects = tagObjects.filter(t => !isSystemTag(t.name));

    // Preserve current selections (or restore pending from state)
    const prevSelected = [];
    container.querySelectorAll('input:checked').forEach(cb => prevSelected.push(cb.value));
    if (window._pendingLabelFilters) {
      window._pendingLabelFilters.forEach(v => { if (!prevSelected.includes(v)) prevSelected.push(v); });
      delete window._pendingLabelFilters;
    }

    // Store selected state for _getSelectedLabels to read
    window._sidebarTagSelection = [...prevSelected];

    container.innerHTML = '';
    if (tagObjects.length === 0) {
      container.innerHTML = '<span style="font-size:0.8em;opacity:0.5;">No tags defined</span>';
      return;
    }

    // Build tree and render
    const tree = buildTagTree(tagObjects);
    renderTagTree(container, tree, window._sidebarTagSelection, (fullPath, isNowSelected) => {
      const idx = window._sidebarTagSelection.indexOf(fullPath);
      if (isNowSelected && idx === -1) window._sidebarTagSelection.push(fullPath);
      else if (!isNowSelected && idx !== -1) window._sidebarTagSelection.splice(idx, 1);
      // Sync hidden checkboxes for _getSelectedLabels
      _syncSidebarTagCheckboxes(container, tagObjects);
      onFilterChange();
    });

    // Also create hidden checkboxes so _getSelectedLabels still works
    _syncSidebarTagCheckboxes(container, tagObjects);
  } catch (e) {
    console.warn('Could not load label filters:', e);
  }
}

function _syncSidebarTagCheckboxes(container, tagObjects) {
  // Remove old hidden checkboxes
  container.querySelectorAll('input[data-filter="label"]').forEach(cb => cb.remove());
  // Create hidden checkboxes for each selected tag
  const sel = window._sidebarTagSelection || [];
  tagObjects.forEach(t => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = t.name;
    cb.dataset.filter = 'label';
    cb.checked = sel.includes(t.name);
    cb.style.display = 'none';
    container.appendChild(cb);
  });
}

// ── Period (was "View") ──────────────────────────────────────────────────────
function changePeriod() {
  const sel = document.getElementById('period-select');
  if (!sel) return;
  _weekViewDayOffset = 0; // reset day paging when switching periods
  currentView = sel.value;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function goToToday() {
  const now = new Date();
  _weekViewDayOffset = 0; // reset day paging
  if (currentView === 'Week') currentWeekStart = getWeekStart(now);
  else if (currentView === 'Month') currentWeekStart = getMonthStart(now);
  else if (currentView === 'Year') currentWeekStart = getYearStart(now);
  else currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  updateDateRange();
  displayChits();
}

// ── Global Alert System ──────────────────────────────────────────────────────

const _globalTriggeredAlarms = new Set(); // "chitId-alarmIdx-HH:MM-dateStr"
const _globalFiredNotifications = new Set(); // "chitId-notifIdx-fireISOStr"
let _globalAlarmInterval = null;
let _globalNotifInterval = null;
let _globalAlarmAudio = null;
let _globalTimerAudio = null;
let _globalTimeFormat = "24hour";

function _globalFmtTime(time24) {
  if (!time24) return "";
  if (_globalTimeFormat === "12hour" || _globalTimeFormat === "12houranalog") {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
  }
  return time24;
}

function _globalPlayAlarm() {
  if (!_globalAlarmAudio) {
    _globalAlarmAudio = new Audio("/static/alarm.mp3");
    _globalAlarmAudio.loop = true;
  }
  _globalAlarmAudio.currentTime = 0;
  const playPromise = _globalAlarmAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      const unlock = () => {
        _globalAlarmAudio.play().catch(() => {});
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    });
  }
  // Auto-stop after 5 minutes
  if (_globalAlarmTimeout) clearTimeout(_globalAlarmTimeout);
  _globalAlarmTimeout = setTimeout(() => _globalStopAlarm(), 5 * 60 * 1000);
}

let _globalAlarmTimeout = null;

function _globalStopAlarm() {
  if (_globalAlarmAudio) { _globalAlarmAudio.pause(); _globalAlarmAudio.currentTime = 0; }
  if (_globalAlarmTimeout) { clearTimeout(_globalAlarmTimeout); _globalAlarmTimeout = null; }
}

function _globalPlayTimer() {
  if (!_globalTimerAudio) _globalTimerAudio = new Audio("/static/timer.mp3");
  _globalTimerAudio.currentTime = 0;
  _globalTimerAudio.play().catch(() => {});
}

function _globalDayAbbr(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

/**
 * Show a persistent toast notification with chit title and Open button.
 * Clicking Open navigates to the chit editor.
 */
function _showGlobalToast(emoji, label, chitTitle, chitId, onDismiss) {
  const toast = document.createElement("div");
  toast.style.cssText = [
    "position:fixed",
    "top:16px",
    "right:16px",
    "z-index:99999",
    "background:#fff5e6",
    "border:2px solid #8b5a2b",
    "border-radius:8px",
    "padding:0.75em 1em",
    "box-shadow:0 4px 20px rgba(0,0,0,0.35)",
    "min-width:240px",
    "max-width:320px",
    "font-family:'Courier New',monospace",
    "display:flex",
    "flex-direction:column",
    "gap:0.4em",
  ].join(";");

  const titleRow = document.createElement("div");
  titleRow.style.cssText = "font-weight:bold;font-size:1em;";
  titleRow.textContent = `${emoji} ${chitTitle || "Alert"}`;

  const labelRow = document.createElement("div");
  labelRow.style.cssText = "font-size:0.85em;opacity:0.8;";
  labelRow.textContent = label;

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:0.5em;margin-top:0.2em;";

  const openBtn = document.createElement("button");
  openBtn.textContent = chitTitle || "Open Chit";
  openBtn.style.cssText = "flex:1;padding:3px 8px;cursor:pointer;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;";
  openBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
    window.location.href = `/editor?id=${chitId}`;
  };

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.cssText = "padding:3px 8px;cursor:pointer;";
  dismissBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
  };

  const snoozeBtn = document.createElement("button");
  snoozeBtn.textContent = "Snooze 5m";
  snoozeBtn.style.cssText = "padding:3px 8px;cursor:pointer;";
  snoozeBtn.onclick = () => {
    toast.remove();
    if (onDismiss) onDismiss();
    // Snooze handled by caller if needed
  };

  btnRow.appendChild(openBtn);
  btnRow.appendChild(dismissBtn);
  if (emoji === "🔔") btnRow.appendChild(snoozeBtn);

  toast.appendChild(titleRow);
  toast.appendChild(labelRow);
  toast.appendChild(btnRow);
  document.body.appendChild(toast);

  // Auto-dismiss after 60 seconds
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 60000);

  return toast;
}

function _sendBrowserNotification(title, body, chitId) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/static/cwod_logo-favicon.png" });
  n.onclick = () => {
    window.focus();
    window.location.href = `/editor?id=${chitId}`;
  };
}

function _globalCheckAlarms() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const currentTime = `${hh}:${mm}`;
  const currentDay = _globalDayAbbr(now);
  const dateStr = now.toDateString();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "alarm" || !alert.enabled || !alert.time) return;
      const days = alert.days && alert.days.length > 0 ? alert.days : [currentDay];
      if (!days.includes(currentDay)) return;
      if (alert.time !== currentTime) return;

      const key = `${chit.id}-${alertIdx}-${alert.time}-${dateStr}`;
      if (_globalTriggeredAlarms.has(key)) return;
      // Check snooze registry
      const snoozeKey = `${chit.id}-${alertIdx}`;
      if (_snoozeRegistry[snoozeKey] && Date.now() < _snoozeRegistry[snoozeKey]) return;
      _globalTriggeredAlarms.add(key);

      const label = `${_globalFmtTime(alert.time)}${alert.name ? " — " + alert.name : ""}`;
      _globalPlayAlarm();
      const toast = _showGlobalToast("🔔", label, chit.title, chit.id, _globalStopAlarm);

      // Delete after dismissal: override dismiss button if flag is set
      if (alert.delete_after_dismiss) {
        const dismissBtn = toast.querySelectorAll("button")[1]; // Open, Dismiss, Snooze
        if (dismissBtn) {
          const origClick = dismissBtn.onclick;
          dismissBtn.onclick = () => {
            if (origClick) origClick();
            fetch(`/api/chits/${chit.id}`, { method: 'DELETE' })
              .then(() => fetchChits())
              .catch(err => console.error('Delete after dismiss failed:', err));
          };
        }
      }

      // Snooze: add to registry for snooze_length from settings
      const snoozeBtn = toast.querySelector("button:last-child");
      if (snoozeBtn) {
        snoozeBtn.onclick = () => {
          toast.remove();
          _globalStopAlarm();
          // Snooze for configured duration (default 5 min)
          const snoozeMs = _getSnoozeMs();
          _snoozeRegistry[snoozeKey] = Date.now() + snoozeMs;
          _globalTriggeredAlarms.delete(key);
        };
      }

      _sendBrowserNotification(`🔔 Alarm: ${chit.title}`, label, chit.id);
    });
  });

  // Clean up old keys
  _globalTriggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _globalTriggeredAlarms.delete(key);
  });

  // Delete Past Alarm Chits: auto-archive alarm-only chits whose time has passed
  if (_chitOptions.delete_past_alarm_chits) {
    chits.forEach((chit) => {
      if (!Array.isArray(chit.alerts) || chit.alerts.length === 0) return;
      if (chit.archived || chit.deleted) return;
      // Only affect chits that are alarm-only (no dates, no notes, no checklist)
      if (chit.start_datetime || chit.due_datetime || chit.note) return;
      const hasActiveAlarm = chit.alerts.some(a => a._type === 'alarm' && a.enabled);
      if (!hasActiveAlarm) return;
      // Check if all alarm times for today have passed
      const allPast = chit.alerts.filter(a => a._type === 'alarm' && a.enabled && a.time).every(a => a.time < currentTime);
      if (allPast) {
        fetch(`/api/chits/${chit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...chit, archived: true }) }).catch(() => {});
      }
    });
  }
}

function _globalCheckNotifications() {
  const now = new Date();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "notification" || !alert.value || !alert.unit) return;

      // "Only if undone" — skip if chit is complete (default: true)
      const onlyIfUndone = alert.only_if_undone !== false; // default true
      if (onlyIfUndone && chit.status === 'Complete') return;

      const unitMs = { minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const offsetMs = alert.value * (unitMs[alert.unit] || 60000);

      const targetStr = alert.relativeTo
        ? (chit.due_datetime || chit.start_datetime)
        : chit.start_datetime;
      if (!targetStr) return;

      const targetDate = new Date(targetStr);
      if (isNaN(targetDate.getTime())) return;

      const fireAt = new Date(targetDate.getTime() - offsetMs);
      const diff = now - fireAt;

      // Fire if within 60 seconds past the fire time (check runs every 30s)
      if (diff < 0 || diff > 60000) return;

      const key = `${chit.id}-notif-${alertIdx}-${fireAt.toISOString()}`;
      if (_globalFiredNotifications.has(key)) return;
      _globalFiredNotifications.add(key);

      const label = `${alert.value} ${alert.unit} before ${alert.relativeTo ? "due/start" : "start"}`;
      const toastTitle = alert.message ? `${chit.title} — ${alert.message}` : chit.title;
      _showGlobalToast("📢", label, toastTitle, chit.id, null);
      _sendBrowserNotification(`📢 Reminder: ${toastTitle}`, label, chit.id);
    });
  });

  // Check for "notify at start" and "notify at due" (per-chit flags in alerts)
  const nowMs = now.getTime();
  chits.forEach((chit) => {
    // Read notify flags from alerts array
    const flags = (chit.alerts || []).find(a => a._type === '_notify_flags');
    const notifyStart = flags ? !!flags.at_start : true; // default true
    const notifyDue = flags ? !!flags.at_due : true;

    if (notifyStart && chit.start_datetime) {
      const startMs = new Date(chit.start_datetime).getTime();
      const diff = nowMs - startMs;
      if (diff >= 0 && diff < 60000) {
        const key = `${chit.id}-start-notify`;
        if (!_globalFiredNotifications.has(key)) {
          _globalFiredNotifications.add(key);
          _showGlobalToast("🔔", "Starting now", chit.title, chit.id, null);
          _sendBrowserNotification(`🔔 Starting: ${chit.title}`, "Event starting now", chit.id);
        }
      }
    }
    if (notifyDue && chit.due_datetime && chit.status !== 'Complete') {
      const dueMs = new Date(chit.due_datetime).getTime();
      const diff = nowMs - dueMs;
      if (diff >= 0 && diff < 60000) {
        const key = `${chit.id}-due-notify`;
        if (!_globalFiredNotifications.has(key)) {
          _globalFiredNotifications.add(key);
          _showGlobalToast("⏰", "Due now", chit.title, chit.id, null);
          _sendBrowserNotification(`⏰ Due: ${chit.title}`, "This chit is due now", chit.id);
        }
      }
    }
  });
}

function _getSnoozeMs() {
  const s = window._snoozeLength || '5 minutes';
  const match = s.match(/(\d+)/);
  return (match ? parseInt(match[1]) : 5) * 60 * 1000;
}

function _startGlobalAlertSystem() {
  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Parse snooze length from settings
  window._snoozeLength = '5 minutes'; // default
  getCachedSettings().then(s => {
    if (s.snooze_length) window._snoozeLength = s.snooze_length;
  }).catch(() => {});

  // Pre-unlock audio on first user interaction so alarms can play immediately
  const unlockAudio = () => {
    if (!_globalAlarmAudio) _globalAlarmAudio = new Audio("/static/alarm.mp3");
    if (!_globalTimerAudio) _globalTimerAudio = new Audio("/static/timer.mp3");
    // Play and immediately pause to unlock the audio context
    _globalAlarmAudio.play().then(() => _globalAlarmAudio.pause()).catch(() => {});
    _globalTimerAudio.play().then(() => _globalTimerAudio.pause()).catch(() => {});
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
  };
  document.addEventListener("click", unlockAudio, { once: true });
  document.addEventListener("keydown", unlockAudio, { once: true });

  // Load time format
  getCachedSettings()
    .then((s) => { _globalTimeFormat = s.time_format || "24hour"; })
    .catch(() => {});

  // Start alarm checker (every second)
  if (!_globalAlarmInterval) {
    _globalAlarmInterval = setInterval(_globalCheckAlarms, 1000);
  }

  // Start notification checker (every 30 seconds)
  if (!_globalNotifInterval) {
    _globalNotifInterval = setInterval(_globalCheckNotifications, 30000);
    _globalCheckNotifications(); // check immediately on start
  }
}

// ── End Global Alert System ──────────────────────────────────────────────────

function storePreviousState() {
  previousState = { tab: currentTab, view: currentView };
  // Save the current tab separately so the editor knows which view we came from
  localStorage.setItem('cwoc_source_tab', currentTab);
  // Save full UI state to localStorage for restoration after editor
  const state = {
    tab: currentTab,
    view: currentView,
    weekStart: currentWeekStart ? currentWeekStart.toISOString() : null,
    sortField: currentSortField,
    sortDir: currentSortDir,
    search: document.getElementById('search')?.value || '',
    statusFilters: Array.from(document.querySelectorAll('#status-multi input:checked')).map(cb => cb.value),
    labelFilters: Array.from(document.querySelectorAll('#label-multi input:checked')).map(cb => cb.value),
    priorityFilters: Array.from(document.querySelectorAll('#priority-multi input:checked')).map(cb => cb.value),
    showPinned: document.getElementById('show-pinned')?.checked ?? true,
    showArchived: document.getElementById('show-archived')?.checked ?? false,
    showUnmarked: document.getElementById('show-unmarked')?.checked ?? true,
    hidePastDue: document.getElementById('hide-past-due')?.checked ?? false,
  };
  localStorage.setItem('cwoc_ui_state', JSON.stringify(state));
}

/**
 * Open a chit in the editor. For recurring virtual instances, opens the parent (edit all).
 */
function openChitForEdit(chit) {
  storePreviousState();
  const id = chit._isVirtual && chit._parentId ? chit._parentId : chit.id;
  window.location.href = `/editor?id=${id}`;
}

/**
 * Attach dblclick (edit) and shift+click (quick edit modal) to a calendar event element.
 * Works for ALL chits. Recurring chits get extra recurrence options in the modal.
 */
function attachCalendarChitEvents(el, chit) {
  el.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openChitForEdit(chit);
  });
  el.addEventListener("click", (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      showQuickEditModal(chit, () => displayChits());
    }
  });
  // Long-press on mobile = shift-click (quick edit)
  if (typeof enableLongPress === 'function') {
    enableLongPress(el, function () {
      showQuickEditModal(chit, () => displayChits());
    });
  }
}

/**
 * Attach dblclick on empty space in a day column to create a new chit at that time.
 * @param {HTMLElement} col - the day column element (position:relative, 1px = 1min)
 * @param {Date} day - the date this column represents
 * @param {number} defaultDurationMin - default event duration in minutes
 */
function attachEmptySlotCreate(col, day, defaultDurationMin) {
  defaultDurationMin = defaultDurationMin || 60;
  col.addEventListener("dblclick", (e) => {
    // Only fire if clicking directly on the column, not on a child event
    if (e.target !== col) return;

    const rect = col.getBoundingClientRect();
    // clientY - rect.top gives position within the column (1px = 1min)
    const yInCol = e.clientY - rect.top;
    const totalMin = Math.max(0, Math.min(1439, Math.round(yInCol)));

    // Snap to nearest interval
    const snap = (typeof _calSnapMinutes !== 'undefined' ? _calSnapMinutes : 15) || 15;
    const snappedMin = Math.round(totalMin / snap) * snap;

    const startH = Math.floor(snappedMin / 60);
    const startM = snappedMin % 60;
    const endMin = snappedMin + defaultDurationMin;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;

    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = day.getFullYear();
    const mm = pad(day.getMonth() + 1);
    const dd = pad(day.getDate());
    const startISO = `${yyyy}-${mm}-${dd}T${pad(startH)}:${pad(startM)}:00`;
    const endISO = `${yyyy}-${mm}-${dd}T${pad(endH)}:${pad(endM)}:00`;

    storePreviousState();
    window.location.href = `/editor?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  });
}

function _restoreUIState() {
  try {
    const raw = localStorage.getItem('cwoc_ui_state');
    if (!raw) return false;
    const state = JSON.parse(raw);
    localStorage.removeItem('cwoc_ui_state'); // one-time restore

    if (state.tab) currentTab = state.tab;
    if (state.view) currentView = state.view;
    if (state.weekStart) currentWeekStart = new Date(state.weekStart);
    if (state.sortField !== undefined) currentSortField = state.sortField;
    if (state.sortDir) currentSortDir = state.sortDir;

    // Restore search
    const search = document.getElementById('search');
    if (search && state.search) search.value = state.search;

    // Restore sort UI
    const sortSel = document.getElementById('sort-select');
    if (sortSel && state.sortField) sortSel.value = state.sortField;
    _updateSortUI();

    // Restore status checkboxes
    if (state.statusFilters) {
      document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => {
        cb.checked = state.statusFilters.includes(cb.value);
      });
    }

    // Restore priority checkboxes
    if (state.priorityFilters) {
      document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => {
        cb.checked = state.priorityFilters.includes(cb.value);
      });
    }

    // Restore archive/pinned toggles
    const sp = document.getElementById('show-pinned');
    const sa = document.getElementById('show-archived');
    const su = document.getElementById('show-unmarked');
    if (sp) sp.checked = state.showPinned ?? true;
    if (sa) sa.checked = state.showArchived ?? false;
    if (su) su.checked = state.showUnmarked ?? true;
    const hpd = document.getElementById('hide-past-due');
    if (hpd) hpd.checked = state.hidePastDue ?? false;

    // Restore tab highlight
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick="filterChits('${currentTab}')"]`)?.classList.add('active');

    // Restore period select
    const periodSel = document.getElementById('period-select');
    if (periodSel) periodSel.value = currentView;

    // Show/hide sections based on tab
    const periodSection = document.getElementById('section-period');
    const yearWeekContainer = document.getElementById('year-week-container');
    const orderSection = document.getElementById('section-order');
    if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (orderSection) orderSection.style.display = (currentTab === 'Calendar') ? 'none' : '';
    const kanbanSectionRestore = document.getElementById('section-kanban');
    if (kanbanSectionRestore) kanbanSectionRestore.style.display = (currentTab === 'Projects') ? '' : 'none';

    // Restore label filters after they load
    if (state.labelFilters && state.labelFilters.length > 0) {
      window._pendingLabelFilters = state.labelFilters;
    }

    // Auto-expand sidebar filter groups that have active filters
    if (state.statusFilters && state.statusFilters.some(v => v !== '')) {
      expandFilterGroup('filter-status');
    }
    if (state.priorityFilters && state.priorityFilters.some(v => v !== '')) {
      expandFilterGroup('filter-priority');
    }
    if (state.labelFilters && state.labelFilters.length > 0) {
      expandFilterGroup('filter-label');
    }
    if (state.showArchived || !state.showPinned || !state.showUnmarked || state.hidePastDue) {
      expandFilterGroup('filter-archive');
    }

    return true;
  } catch (e) {
    return false;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("active");
  if (sidebar.classList.contains("active")) {
    localStorage.setItem("sidebarState", "open");
  } else {
    localStorage.setItem("sidebarState", "closed");
  }

  // Mobile overlay: show/hide backdrop when sidebar is toggled at ≤768px
  if (_isMobileOverlay()) {
    if (sidebar.classList.contains("active")) {
      _showSidebarBackdrop();
    } else {
      _hideSidebarBackdrop();
    }
  }

  window.dispatchEvent(new Event("resize"));
  // Fire again after CSS transition completes (margin-left 0.3s)
  setTimeout(() => window.dispatchEvent(new Event("resize")), 350);
}

/** Toggle a sidebar section's body visibility */
function toggleSidebarSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const body = section.querySelector('.sidebar-section-body');
  const toggle = section.querySelector('.section-toggle');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

/** Expand a sidebar section (used by hotkeys) */
function expandSidebarSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const body = section.querySelector('.sidebar-section-body');
  const toggle = section.querySelector('.section-toggle');
  if (body) body.style.display = '';
  if (toggle) toggle.textContent = '▼';
}

/** Toggle a filter sub-group's body */
function toggleFilterGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const body = group.querySelector('.filter-group-body');
  const toggle = group.querySelector('.section-toggle');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

/** Expand a filter sub-group (used by hotkeys) */
function expandFilterGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const body = group.querySelector('.filter-group-body');
  const toggle = group.querySelector('.section-toggle');
  if (body) body.style.display = '';
  if (toggle) toggle.textContent = '▼';
}

function restoreSidebarState() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("Sidebar element not found");
    return;
  }
  // On mobile/tablet, always start with sidebar closed (initMobileSidebar handles this)
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
    localStorage.setItem("sidebarState", "closed");
    return;
  }
  const savedState = localStorage.getItem("sidebarState");
  if (savedState === "closed") {
    sidebar.classList.remove("active");
  } else {
    // Default to open on desktop
    sidebar.classList.add("active");
  }
}

// Global week start day (0=Sun, 1=Mon, etc.) — loaded from settings
let _weekStartDay = 0;

// ── Debounced breakpoint-crossing resize state ───────────────────────────────
let _lastBreakpointCategory = null; // 'mobile' | 'tablet' | 'desktop'
let _resizeDebounceTimer = null;

/** Return the current breakpoint category based on viewport width.
 *  ≤480px → "mobile", 481–768px → "tablet", >768px → "desktop". */
function _getBreakpointCategory() {
  const w = window.innerWidth;
  if (w <= 480) return 'mobile';
  if (w <= 768) return 'tablet';
  return 'desktop';
}

/** Debounced resize handler — only re-renders when viewport crosses a
 *  breakpoint boundary (480px or 768px). Debounced at 200ms. */
function _onDebouncedResize() {
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(function () {
    _checkTabOverflow();
    var category = _getBreakpointCategory();
    if (category !== _lastBreakpointCategory) {
      _lastBreakpointCategory = category;
      _weekViewDayOffset = 0;
      displayChits();
    }
  }, 200);
}

/** Return the number of days to show in week view based on viewport width.
 *  Always returns 7 — the full week is shown at all viewport sizes.
 *  Result is clamped to 1–7. */
function _getResponsiveDayCount() {
  return 7;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - _weekStartDay + 7) % 7;
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

// Dashboard-specific formatDate variant — includes day-of-week for calendar headers.
// The shared formatDate() in shared.js uses YYYY-Mon-DD format; this one uses DD Day.
function formatDate(date) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${String(date.getDate()).padStart(2,'0')} ${dayNames[date.getDay()]}`;
}

// formatTime() is in shared.js

function formatWeekRange(start, end) {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const startStr = `${monthNames[start.getMonth()]} ${formatDate(start)}`;
  const endStr = `${monthNames[end.getMonth()]} ${formatDate(end)}`;
  return `<span>${startStr}</span><span>${endStr}</span>`;
}

// getPastelColor moved to shared.js

/**
 * Returns the display color for a chit. Transparent/null → pale cream.
 */
function chitColor(chit) {
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
}

function previousPeriod() {
  if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
  _weekViewDayOffset = 0; // reset day paging when navigating periods
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
  _weekViewDayOffset = 0; // reset day paging when navigating periods
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
  console.debug("Fetching chits...");
  // Show loading spinner on first load (when chit-list is empty)
  const listEl = document.getElementById("chit-list");
  if (listEl && chits.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:3em;opacity:0.5;font-size:1.2em;">⏳ Loading chits…</div>';
  }
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
      console.debug("Fetched chits:", chits);
      if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
      updateDateRange();
      displayChits();
      restoreSidebarState();
      // Re-check notifications immediately after chits refresh
      if (typeof _globalCheckNotifications === "function") _globalCheckNotifications();
      // Pre-fetch weather for chits with locations (populates cache for all views)
      _prefetchChitWeather(chits);
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
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  if (currentView === "Day") {
    yearElement.textContent = `${currentWeekStart.getFullYear()} · ${monthNames[currentWeekStart.getMonth()]}`;
    rangeElement.textContent = formatDate(currentWeekStart);
  } else if (currentView === "Week") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = `${start.getFullYear()} · ${monthNames[start.getMonth()]}`;
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "SevenDay") {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    yearElement.textContent = `${start.getFullYear()} · ${monthNames[start.getMonth()]}`;
    rangeElement.innerHTML = formatWeekRange(start, end);
  } else if (currentView === "Month") {
    const monthStart = getMonthStart(currentWeekStart);
    yearElement.textContent = `${monthStart.getFullYear()} · ${monthNames[monthStart.getMonth()]}`;
    rangeElement.textContent = '';
  } else if (currentView === "Year") {
    const yearStart = getYearStart(currentWeekStart);
    yearElement.textContent = yearStart.getFullYear();
    rangeElement.textContent = "";
  } else {
    yearElement.textContent = "";
    rangeElement.textContent = "";
  }
}

function displayChits() {
  const listContainer = document.getElementById("chit-list");
  if (!listContainer) {
    console.error("Chit list container not found");
    return;
  }
  const searchText = document.getElementById("search")?.value?.toLowerCase() || "";

  let filteredChits = chits.filter((chit) => {
    if (!searchText) return true;
    // Always search title
    if (chit.title && chit.title.toLowerCase().includes(searchText)) return true;
    // Search note content (visible in Notes, Checklists, Projects)
    if (chit.note && chit.note.toLowerCase().includes(searchText)) return true;
    // Search tags
    if (Array.isArray(chit.tags) && chit.tags.some(t => t.toLowerCase().includes(searchText))) return true;
    // Search status (visible in Tasks)
    if (chit.status && chit.status.toLowerCase().includes(searchText)) return true;
    // Search people
    if (Array.isArray(chit.people) && chit.people.some(p => p.toLowerCase().includes(searchText))) return true;
    // Search location
    if (chit.location && chit.location.toLowerCase().includes(searchText)) return true;
    // Search priority & severity
    if (chit.priority && chit.priority.toLowerCase().includes(searchText)) return true;
    if (chit.severity && chit.severity.toLowerCase().includes(searchText)) return true;
    return false;
  });

  // Apply multi-select filters (status, label, priority)
  filteredChits = _applyMultiSelectFilters(filteredChits);

  // Apply archive/pinned filter
  filteredChits = _applyArchiveFilter(filteredChits);

  // Apply hide-past-due filter
  const hidePastDue = document.getElementById('hide-past-due')?.checked ?? false;
  if (hidePastDue) {
    const now = new Date();
    filteredChits = filteredChits.filter(c => {
      if (!c.due_datetime || c.status === 'Complete') return true;
      return new Date(c.due_datetime) >= now;
    });
  }

  // Apply sort
  filteredChits = _applySort(filteredChits);

  // Expand recurring chits for Calendar tab
  if (currentTab === "Calendar") {
    const rangeStart = new Date(currentWeekStart || new Date());
    rangeStart.setDate(rangeStart.getDate() - 7); // buffer
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 60); // ~2 months ahead
    let expanded = [];
    filteredChits.forEach(chit => {
      if (chit.recurrence_rule && chit.recurrence_rule.freq) {
        expanded = expanded.concat(expandRecurrence(chit, rangeStart, rangeEnd));
      } else {
        expanded.push(chit);
      }
    });
    filteredChits = expanded;
  }

  switch (currentTab) {
    case "Calendar":
      if (currentView === "Week") displayWeekView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
      else if (currentView === "Work") displayWorkView(filteredChits);
      else if (currentView === "Month") displayMonthView(filteredChits);
      else if (currentView === "Itinerary") displayItineraryView(filteredChits);
      else if (currentView === "Day") displayDayView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
      else if (currentView === "Year") displayYearView(filteredChits);
      else if (currentView === "SevenDay") displaySevenDayView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
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
      displayAlarmsView(filteredChits);
      break;
    case "Projects":
      displayProjectsView(filteredChits);
      break;
    case "Search":
      displaySearchView();
      return; // Search view manages its own rendering; skip post-render steps
    default:
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
  }

  // Post-render: apply chit display options (fade past, highlight overdue)
  _applyChitDisplayOptions();

  // Update tab counts based on currently filtered chits (after search, filters, archive)
  _updateTabCounts(filteredChits);
}

/** Update tab labels with counts of displayed chits per tab. */
function _updateTabCounts(filteredChits) {
  // Remove existing counts if setting is off
  if (!_chitOptions.show_tab_counts) {
    document.querySelectorAll('.tab-count').forEach(el => el.remove());
    return;
  }

  // Deduplicate: only count original chits (skip virtual recurrence instances)
  const unique = filteredChits.filter(c => !c._virtual);

  const counts = {
    Checklists: unique.filter(c => Array.isArray(c.checklist) && c.checklist.length > 0).length,
    Alarms: unique.filter(c => {
      if (!Array.isArray(c.alerts) || c.alerts.length === 0) return c.alarm || c.notification;
      return c.alerts.filter(a => a._type !== '_notify_flags').length > 0;
    }).length,
    Projects: chits.filter(c => c.is_project_master && !c.deleted && !c.archived).length,
    Tasks: unique.filter(c => c.status || c.due_datetime).length,
    Notes: unique.filter(c => c.note && c.note.trim() !== '').length,
  };
  document.querySelectorAll('.tab').forEach(tab => {
    const onclick = tab.getAttribute('onclick') || '';
    const match = onclick.match(/filterChits\('(\w+)'\)/);
    if (!match) return;
    const name = match[1];
    // Never show count for Calendar
    if (name === 'Calendar') {
      const existing = tab.querySelector('.tab-count');
      if (existing) existing.remove();
      return;
    }
    const count = counts[name];
    if (count === undefined) return;
    let countSpan = tab.querySelector('.tab-count');
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'tab-count';
      countSpan.style.cssText = 'font-size:0.75em;opacity:0.6;margin-left:0.2em;';
      tab.appendChild(countSpan);
    }
    countSpan.textContent = `(${count})`;
  });
}

function _applyChitDisplayOptions() {
  if (!_chitOptions.fade_past_chits && !_chitOptions.highlight_overdue_chits) return;
  const now = new Date();

  // Fade past timed events in calendar
  if (_chitOptions.fade_past_chits && currentTab === 'Calendar') {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    document.querySelectorAll('.timed-event, .day-event').forEach(el => {
      const col = el.closest('.day-column') || el.closest('[style*="position:relative"]');
      if (!col) return;
      const isToday = col.classList.contains('today');

      // Determine if this column is a past day by finding its .today sibling
      let isPastDay = false;
      if (!isToday && col.parentElement) {
        const siblings = Array.from(col.parentElement.querySelectorAll('.day-column'));
        const todayIdx = siblings.findIndex(s => s.classList.contains('today'));
        const thisIdx = siblings.indexOf(col);
        if (todayIdx >= 0 && thisIdx >= 0 && thisIdx < todayIdx) isPastDay = true;
        // If no today column visible, check by date data attribute or skip
        if (todayIdx < 0) isPastDay = false; // can't determine, don't fade
      }

      const top = parseInt(el.style.top) || 0;
      const height = parseInt(el.style.height) || 0;
      const endMin = top + height;

      // Only fade if: past day, OR today and event has ended
      if (isPastDay || (isToday && endMin < nowMin)) {
        el.style.opacity = '0.45';
      }
    });

    // Fade past all-day events
    document.querySelectorAll('.all-day-event').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (chit) {
        const info = getCalendarDateInfo(chit);
        if (info.hasDate && info.end < now) el.style.opacity = '0.45';
      }
    });

    // Fade past month events
    document.querySelectorAll('.month-event').forEach(el => {
      const dayCell = el.closest('.month-day');
      if (!dayCell || !dayCell.dataset.date) return;
      const cellDate = new Date(dayCell.dataset.date + 'T23:59:59');
      if (cellDate < todayStart) el.style.opacity = '0.45';
    });
  }

  // Fade past chits in non-calendar views (only chits that have ENDED, not overdue ones)
  if (_chitOptions.fade_past_chits && currentTab !== 'Calendar') {
    document.querySelectorAll('.chit-card[data-chit-id]').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (!chit) return;
      // Only fade if the event has an end_datetime that's passed (not due_datetime — that's overdue)
      const endTime = chit.end_datetime ? new Date(chit.end_datetime) : null;
      if (endTime && endTime < now && chit.status !== 'Complete') {
        el.style.opacity = '0.5';
      }
    });
  }

  // Highlight overdue chits — due date passed, not complete (all views including calendar)
  if (_chitOptions.highlight_overdue_chits) {
    document.querySelectorAll('.chit-card[data-chit-id], .timed-event[data-chit-id], .all-day-event[data-chit-id], .month-event[data-chit-id]').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (!chit) return;
      const dueTime = chit.due_datetime ? new Date(chit.due_datetime) : null;
      if (dueTime && dueTime < now && chit.status !== 'Complete') {
        el.style.border = '3px solid #b22222';
        el.style.borderRadius = '4px';
        // Don't fade overdue chits — they should stand out
        el.style.opacity = '';
      }
    });
  }
}

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
    allDayEventsRow.style.cssText = "display:flex;background:#e8dcc8;min-height:24px;";

    // Toggle button in the header spacer
    const toggleBtn = document.createElement("span");
    toggleBtn.style.cssText = "cursor:pointer;font-size:1.4em;line-height:1;user-select:none;";
    toggleBtn.textContent = "\u2600"; // sun = all-day visible
    toggleBtn.title = "Collapse all-day events";
    toggleBtn.addEventListener("click", () => {
      const isHidden = allDayContainer.style.display === "none";
      allDayContainer.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "\u2600" : "\u25B2"; // sun vs up triangle
      toggleBtn.title = isHidden ? "Collapse all-day events" : "Expand all-day events";
    });
    headerSpacer.appendChild(toggleBtn);

    // Spacer in events row to align with hour column
    const rowSpacer = document.createElement("div");
    rowSpacer.style.cssText = "width:60px;flex-shrink:0;";
    allDayEventsRow.appendChild(rowSpacer);

    renderAllDayEventsInCells(dayData, allDayEventsRow, _viSettings, 'calendar-slot');

















    allDayContainer.appendChild(allDayEventsRow);
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
      _evData.push({ chit, info, top: _top, height: _height, pos: _pos });
    });
    const _maxOvlp = Math.max(1, ...Object.values(_timeSlots).map(s => s.length));

    _evData.forEach(({ chit, info, top, height, pos }) => {
      const ev = document.createElement("div");
      ev.className = "timed-event";
      ev.dataset.chitId = chit.id;
      if (chit.status === "Complete") ev.classList.add("completed-task");
      const _wPct = 95 / _maxOvlp;
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
    enableCalendarDrag(scrollGrid, weekDayColumns, days, weekChitsMap);
  });

  // Enable pinch-to-zoom on mobile (vertical axis only)
  enableCalendarPinchZoom(scrollGrid);
}

// ── Working Hours View ───────────────────────────────────────────────────────
let _workStartHour = 8;
let _workEndHour = 17;
let _workDays = [1, 2, 3, 4, 5]; // 0=Sun, 1=Mon, ...
let _enabledPeriods = ['Itinerary', 'Day', 'Week', 'Work', 'SevenDay', 'Month', 'Year'];
let _customDaysCount = 7;
let _allViewStartHour = 0;
let _allViewEndHour = 24;
let _dayScrollToHour = 5;

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

            detailsColumn.innerHTML = `<span style="font-weight: bold; font-size: 1.1em;">${chit.title}</span>`;

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
    allDayRow.style.cssText = "flex-shrink:0;background:#e8dcc8;border-bottom:1px solid #6b4e31;padding:4px 8px;";
    allDayChits.forEach(({ chit, info }) => {
      const ev = document.createElement("div");
      ev.className = "all-day-event";
      ev.dataset.chitId = chit.id;
      applyChitColors(ev, chitColor(chit));
      if (chit.status === "Complete") ev.classList.add("completed-task");
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

    const el = document.createElement("div");
    el.className = "day-event";
    let height = endTime - startTime;
    if (height < 30) height = 30;
    const maxOverlap = Math.max(...Object.values(timeSlots).map(s => s.length));
    const widthPct = 95 / maxOverlap;
    el.style.cssText = `top:${startTime}px;height:${height}px;left:${position * widthPct}%;width:${widthPct - 1}%;position:absolute;box-sizing:border-box;`;
    applyChitColors(el, chitColor(chit));
    el.title = calendarEventTooltip(chit, info);
    if (chit.status === "Complete") el.classList.add("completed-task");
    const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
    el.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info, _viSettings, 'calendar-slot')}<br>${timeLabel}`;
    attachCalendarChitEvents(el, chit);
    eventsContainer.appendChild(el);
    dayChitsMap.push({ el, chit, info });
  });

  dayView.appendChild(eventsContainer);
  attachEmptySlotCreate(eventsContainer, day);
  wrapper.appendChild(dayView);
  chitList.appendChild(wrapper);

  scrollToSixAM();
  renderTimeBar("Day");

  _loadCalSnapSetting().then(() => {
    enableCalendarDrag(dayView, dayViewColumns, dayViewDays, dayChitsMap);
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

function displayChecklistView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const checklistView = document.createElement("div");
  checklistView.className = "checklist-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Only show chits that have checklist items
  const checklistChits = chitsToDisplay.filter(c =>
    Array.isArray(c.checklist) && c.checklist.length > 0
  );

  // Only apply default sort if no global sort is active
  const sortedChits = currentSortField ? checklistChits : [...checklistChits].sort((a, b) => {
    const dateA = new Date(
      a.last_edited || a.created_datetime || a.start_datetime || 0,
    );
    const dateB = new Date(
      b.last_edited || b.created_datetime || b.start_datetime || 0,
    );
    return dateB - dateA;
  });

  if (sortedChits.length === 0)
    checklistView.innerHTML = _emptyState("No checklists found.");
  else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.draggable = true;
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.status === "Complete") chitElement.classList.add("completed-task");
      if (chit.archived) chitElement.classList.add("archived-chit");

      chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

      // Checklist progress count
      const items = chit.checklist || [];
      const checked = items.filter(i => i.checked || i.done).length;
      const progressEl = document.createElement("div");
      progressEl.style.cssText = "font-size:0.8em;opacity:0.7;margin-bottom:0.3em;";
      progressEl.textContent = `${checked}/${items.length} ✓`;
      chitElement.appendChild(progressEl);

      // Interactive checklist from shared.js
      renderInlineChecklist(chitElement, chit, () => fetchChits());

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      if (typeof enableLongPress === 'function') {
        enableLongPress(chitElement, function () {
          showQuickEditModal(chit, () => displayChits());
        });
      }
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);
  enableDragToReorder(checklistView, 'Checklists', () => displayChits());
}

function displayTasksView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  let taskChits = chitsToDisplay.filter(
    (chit) => chit.status || chit.due_datetime,
  );

  // Default sort: by status (ToDo → In Progress → Blocked → Complete at bottom)
  if (!currentSortField) {
    const statusOrder = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, '': 4, 'Complete': 5 };
    taskChits.sort((a, b) => (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4));
  }

  if (taskChits.length === 0) {
    chitList.innerHTML = _emptyState("No tasks found.");
    return;
  }

  const tasksContainer = document.createElement("div");
  tasksContainer.className = "checklist-view"; // reuse consistent spacing

  taskChits.forEach((chit) => {
    const chitElement = document.createElement("div");
    chitElement.className = "chit-card";
    chitElement.draggable = true;
    chitElement.dataset.chitId = chit.id;
    if (chit.archived) chitElement.classList.add("archived-chit");
    applyChitColors(chitElement, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.status === "Complete") chitElement.classList.add("completed-task");

    chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

    // Status + note preview in a row
    const controls = document.createElement("div");
    controls.style.cssText = "margin-top:0.3em;display:flex;align-items:flex-start;gap:0.8em;";

    // Status dropdown (left)
    const statusWrap = document.createElement("div");
    statusWrap.style.cssText = "display:flex;align-items:center;gap:0.5em;flex-shrink:0;";
    const label = document.createElement("span");
    label.textContent = "Status:";
    statusWrap.appendChild(label);

    const statusDropdown = document.createElement("select");
    statusDropdown.style.cssText = "font-family:inherit;font-size:inherit;";
    ["ToDo", "In Progress", "Blocked", "Complete"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      if (chit.status === status) option.selected = true;
      statusDropdown.appendChild(option);
    });
    if (!chit.status) statusDropdown.value = "";
    statusDropdown.addEventListener("change", () => {
      fetch(`/api/chits/${chit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chit, status: statusDropdown.value || null }),
      }).then(r => { if (r.ok) fetchChits(); });
    });
    statusWrap.appendChild(statusDropdown);
    controls.appendChild(statusWrap);

    // Note preview (right, rendered markdown)
    if (chit.note && chit.note.trim()) {
      const notePreview = document.createElement("div");
      notePreview.style.cssText = "flex:1;min-width:0;opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;";
      if (typeof marked !== 'undefined') {
        notePreview.innerHTML = resolveChitLinks(marked.parse(chit.note.slice(0, 500)), chits);
      } else {
        notePreview.textContent = chit.note.slice(0, 300) + (chit.note.length > 300 ? '…' : '');
      }
      controls.appendChild(notePreview);
    }

    chitElement.appendChild(controls);

    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    if (typeof enableLongPress === 'function') {
      enableLongPress(chitElement, function () {
        showQuickEditModal(chit, () => displayChits());
      });
    }
    tasksContainer.appendChild(chitElement);
  });
  chitList.appendChild(tasksContainer);
  enableDragToReorder(tasksContainer, 'Tasks', () => displayChits());
}

function displayNotesView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const notesView = document.createElement("div");
  notesView.className = "notes-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const filteredNotes = [...chitsToDisplay].filter((chit) => chit.note && chit.note.trim() !== "");
  const sortedChits = currentSortField ? filteredNotes : filteredNotes.sort((a, b) => {
      const dateA = new Date(
        a.last_edited || a.created_datetime || a.start_datetime || 0,
      );
      const dateB = new Date(
        b.last_edited || b.created_datetime || b.start_datetime || 0,
      );
      return dateB - dateA;
    });

  if (sortedChits.length === 0) {
    notesView.innerHTML = _emptyState("No notes found.");
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.archived) chitElement.classList.add("archived-chit");

      // Simple title with icons
      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { const i = document.createElement('i'); i.className = 'fas fa-bookmark'; i.title = 'Pinned'; i.style.fontSize = '0.85em'; titleRow.appendChild(i); }
      if (chit.archived) { const i = document.createElement('span'); i.textContent = '📦'; i.title = 'Archived'; titleRow.appendChild(i); }
      // Alert indicators
      if (typeof _getAllIndicators === 'function') {
        const indicators = _getAllIndicators(chit, _viSettings, 'card');
        if (indicators) { const s = document.createElement('span'); s.className = 'alert-indicators'; s.textContent = indicators; titleRow.appendChild(s); }
      }
      // Weather indicator
      if (chit.location && chit.location.trim()) {
        var _nwMode = (_viSettings || {}).weather || 'always';
        if (typeof _shouldShow === 'function' && _shouldShow(_nwMode, 'card')) {
          const wxSpan = document.createElement('span');
          wxSpan.className = 'chit-weather-indicator';
          var _nwKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
          var _nwCached = null;
          try { _nwCached = JSON.parse(localStorage.getItem(_nwKey)); } catch (e) {}
          if (_nwCached && _nwCached.icon && (Date.now() - _nwCached.ts < 3600000)) {
            wxSpan.innerHTML = _nwCached.icon + ' <span class="chit-wx-detail">' + _escHtml(_nwCached.tooltip) + '</span> ';
            wxSpan.title = _nwCached.tooltip;
          } else {
            wxSpan.textContent = '⏳ ';
            wxSpan.title = 'Loading weather…';
            _queueChitWeatherFetch(chit.location, wxSpan);
          }
          titleRow.appendChild(wxSpan);
        }
      }
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);
      chitElement.appendChild(titleRow);

      const noteEl = document.createElement("div");
      noteEl.className = "note-content";
      noteEl.style.cssText = "overflow-y:auto;";
      if (typeof marked !== "undefined" && chit.note) {
        noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
      } else {
        noteEl.style.whiteSpace = "pre-wrap";
        noteEl.textContent = chit.note;
      }
      chitElement.appendChild(noteEl);

      // Double-click: open in editor. Shift+click: edit in place.
      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      chitElement.addEventListener("click", (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        // Toggle in-place editing
        if (noteEl.contentEditable === 'true') return;
        noteEl.contentEditable = 'true';
        noteEl.style.outline = '2px solid #8b4513';
        noteEl.style.borderRadius = '4px';
        noteEl.style.padding = '6px';
        noteEl.style.whiteSpace = 'pre-wrap';
        chitElement.style.cursor = 'auto';
        chitElement.setAttribute('draggable', 'false');
        noteEl.textContent = chit.note || '';
        noteEl.focus();
        const saveEdit = () => {
          noteEl.contentEditable = 'false';
          noteEl.style.outline = '';
          noteEl.style.padding = '';
          chitElement.style.cursor = 'grab';
          chitElement.removeAttribute('draggable');
          const newNote = noteEl.textContent;
          if (newNote !== chit.note) {
            fetch(`/api/chits/${chit.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...chit, note: newNote })
            }).then(r => { if (r.ok) { chit.note = newNote; fetchChits(); } });
          } else {
            if (typeof marked !== 'undefined' && chit.note) {
              noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
            }
          }
        };
        noteEl.addEventListener('blur', saveEdit, { once: true });
        noteEl.addEventListener('keydown', (ke) => {
          if (ke.key === 'Escape') { ke.preventDefault(); noteEl.blur(); }
        });
      });
      // Long-press on mobile: toggle in-place editing (same as shift-click)
      if (typeof enableLongPress === 'function') {
        enableLongPress(chitElement, function () {
          if (noteEl.contentEditable === 'true') return;
          noteEl.contentEditable = 'true';
          noteEl.style.outline = '2px solid #8b4513';
          noteEl.style.borderRadius = '4px';
          noteEl.style.padding = '6px';
          noteEl.style.whiteSpace = 'pre-wrap';
          chitElement.style.cursor = 'auto';
          chitElement.setAttribute('draggable', 'false');
          noteEl.textContent = chit.note || '';
          noteEl.focus();
          var _lpSaveEdit = function () {
            noteEl.contentEditable = 'false';
            noteEl.style.outline = '';
            noteEl.style.padding = '';
            chitElement.style.cursor = 'grab';
            chitElement.removeAttribute('draggable');
            var newNote = noteEl.textContent;
            if (newNote !== chit.note) {
              fetch('/api/chits/' + chit.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
              }).then(function (r) { if (r.ok) { chit.note = newNote; fetchChits(); } });
            } else {
              if (typeof marked !== 'undefined' && chit.note) {
                noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
              }
            }
          };
          noteEl.addEventListener('blur', _lpSaveEdit, { once: true });
        });
      }
      notesView.appendChild(chitElement);
    });
  }
  chitList.appendChild(notesView);

  // Restore saved column assignments from localStorage
  const savedOrder = getManualOrder('Notes');
  if (Array.isArray(savedOrder) && savedOrder.length > 0 && typeof savedOrder[0] === 'object') {
    // New format: [{id, col}, ...]
    // Check if all are in col 0 (buggy save) — if so, ignore and let auto-distribute
    const allCol0 = savedOrder.every(e => e.col === 0);
    if (!allCol0) {
      const colMap = {};
      savedOrder.forEach(entry => { if (entry.id && entry.col !== undefined) colMap[entry.id] = entry.col; });
      notesView.querySelectorAll('.chit-card').forEach(card => {
        const id = card.dataset.chitId;
        if (id in colMap) card.dataset.col = colMap[id];
      });
    }
  }

  // Apply column-persistent layout — delay to ensure markdown is rendered
  setTimeout(() => {
    applyNotesLayout(notesView);
    // Re-measure after images/markdown finish rendering
    setTimeout(() => applyNotesLayout(notesView), 200);
    // Final safety re-layout in case container width wasn't ready
    setTimeout(() => applyNotesLayout(notesView), 500);
  }, 50);

  // Re-layout on window resize
  const resizeHandler = () => {
    if (currentTab === 'Notes') {
      var nv = document.querySelector('.notes-view');
      if (nv) applyNotesLayout(nv);
    }
  };
  window.removeEventListener('resize', window._notesResizeHandler);
  window._notesResizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  enableNotesDragReorder(notesView, 'Notes', () => displayChits());
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
let _timeBarInterval = null;

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
    allDayEventsRow.style.cssText = "display:flex;background:#e8dcc8;min-height:24px;";

    // Toggle button in the header spacer
    const toggleBtn = document.createElement("span");
    toggleBtn.style.cssText = "cursor:pointer;font-size:1.4em;line-height:1;user-select:none;";
    toggleBtn.textContent = "\u2600"; // sun = all-day visible
    toggleBtn.title = "Collapse all-day events";
    toggleBtn.addEventListener("click", () => {
      const isHidden = allDayContainer.style.display === "none";
      allDayContainer.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "\u2600" : "\u25B2"; // sun vs up triangle
      toggleBtn.title = isHidden ? "Collapse all-day events" : "Expand all-day events";
    });
    headerSpacer.appendChild(toggleBtn);

    // Spacer in events row to align with hour column
    const rowSpacer = document.createElement("div");
    rowSpacer.style.cssText = "width:60px;flex-shrink:0;";
    allDayEventsRow.appendChild(rowSpacer);

    renderAllDayEventsInCells(dayData, allDayEventsRow, _viSettings, 'calendar-slot');

















    allDayContainer.appendChild(allDayEventsRow);
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
      _ed7.push({ chit, info, top: _top, height: _height, pos: _p });
    });
    const _mo7 = Math.max(1, ...Object.values(_ts7).map(s => s.length));

    _ed7.forEach(({ chit, info, top, height, pos }) => {
      const ev = document.createElement("div");
      ev.className = "timed-event";
      ev.dataset.chitId = chit.id;
      if (chit.status === "Complete") ev.classList.add("completed-task");
      const _w = 95 / _mo7;
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
    enableCalendarDrag(scrollGrid, sdDayColumns, days, sdChitsMap);
  });

  // Enable pinch-to-zoom on mobile (vertical axis only)
  enableCalendarPinchZoom(scrollGrid);
}

// ── Projects View Mode (List vs Kanban) ──────────────────────────────────────
let _projectsViewMode = 'kanban'; // 'list' | 'kanban'

function _setProjectsMode(mode) {
  _projectsViewMode = mode;
  // Update button styles
  const listBtn = document.getElementById('projects-mode-list');
  const kanbanBtn = document.getElementById('projects-mode-kanban');
  if (listBtn) listBtn.style.background = mode === 'list' ? 'ivory' : '';
  if (kanbanBtn) kanbanBtn.style.background = mode === 'kanban' ? 'ivory' : '';
  displayChits();
}

/**
 * Projects tab: tree view — each project master with its child chits nested.
 */
function displayProjectsView(chitsToDisplay) {
  if (_projectsViewMode === 'kanban') {
    return _displayProjectsKanban(chitsToDisplay);
  }

  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Use all chits (not filtered) to find project masters — filters shouldn't hide projects
  // Deduplicate by ID to prevent showing the same project twice
  const seenIds = new Set();
  const projects = chits.filter((c) => {
    if (!c.is_project_master || c.deleted || c.archived) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  if (projects.length === 0) {
    chitList.innerHTML = _emptyState("No projects found. Create a chit and enable Project Master in the Projects zone.");
    return;
  }

  const chitMap = {};
  chits.forEach((c) => { chitMap[c.id] = c; });

  const view = document.createElement("div");
  view.className = "projects-view";

  projects.forEach((project) => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);
    const projectFontColor = contrastColorForBg(projectColor);

    // Outer box colored with project color
    const box = document.createElement("div");
    box.style.cssText = `border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};color:${projectFontColor};`;

    // Project header row — use standard header builder
    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};color:${projectFontColor};cursor:pointer;`;
    header.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)", _viSettings));

    if (project.note) {
      const note = document.createElement("div");
      note.style.cssText = "font-size:0.8em;opacity:0.65;margin-top:2px;padding:0 0.7em;";
      note.textContent = project.note.slice(0, 100) + (project.note.length > 100 ? "…" : "");
      header.appendChild(note);
    }
    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });
    box.appendChild(header);

    // Child chits tree
    if (childIds.length > 0) {
      const tree = document.createElement("ul");
      tree.style.cssText = "list-style:none;margin:0;padding:0 0 0.5em 0;border-top:1px solid rgba(139,90,43,0.2);";

      childIds.forEach((childId) => {
        const child = chitMap[childId];
        const childBg = child ? chitColor(child) : "#fdf6e3";
        const childFont = contrastColorForBg(childBg);
        const li = document.createElement("li");
        li.style.cssText = `display:flex;flex-direction:column;gap:0.2em;padding:0.5em 0.8em 0.5em 1.5em;border-bottom:1px solid rgba(139,90,43,0.1);background:${childBg};color:${childFont};cursor:pointer;min-height:2.2em;`;

        const titleRow = document.createElement("div");
        titleRow.style.cssText = "display:flex;align-items:center;gap:0.5em;";

        const bullet = document.createElement("span");
        bullet.style.cssText = "opacity:0.4;flex-shrink:0;";
        bullet.textContent = "▸";
        titleRow.appendChild(bullet);

        const childTitle = document.createElement("span");
        childTitle.style.cssText = "font-weight:bold;";
        childTitle.textContent = child ? (child.title || "(Untitled)") : `[${childId.slice(0,8)}…]`;
        titleRow.appendChild(childTitle);

        // Visual indicators on child items
        if (child && typeof _getAllIndicators === 'function') {
          const ind = _getAllIndicators(child, _viSettings, 'card');
          if (ind) {
            const indSpan = document.createElement('span');
            indSpan.className = 'alert-indicators';
            indSpan.textContent = ind;
            titleRow.appendChild(indSpan);
          }
        }

        li.appendChild(titleRow);

        if (child) {
          // Meta: Status · Priority · Severity · Due
          const metaParts = [];
          if (child.status) metaParts.push(child.status);
          if (child.priority) metaParts.push(child.priority);
          if (child.severity) metaParts.push(child.severity);
          if (child.due_datetime) metaParts.push("Due: " + formatDate(new Date(child.due_datetime)));
          if (metaParts.length > 0) {
            const meta = document.createElement("div");
            meta.style.cssText = "font-size:0.9em;opacity:0.75;margin-top:2px;";
            meta.textContent = metaParts.join(" · ");
            li.appendChild(meta);
          }

          // Note preview (rendered markdown, same as Tasks view)
          if (child.note && child.note.trim()) {
            const notePreview = document.createElement("div");
            notePreview.style.cssText = "opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;margin-top:3px;";
            if (typeof marked !== 'undefined') {
              notePreview.innerHTML = resolveChitLinks(marked.parse(child.note.slice(0, 500)), chits);
            } else {
              notePreview.textContent = child.note.slice(0, 300) + (child.note.length > 300 ? '…' : '');
            }
            li.appendChild(notePreview);
          }

          li.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${child.id}`;
          });
        }

        tree.appendChild(li);
      });

      box.appendChild(tree);
    }

    view.appendChild(box);
  });

  chitList.appendChild(view);
}

/**
 * Projects Kanban view: each project master is a row of status columns.
 * Child chits of each project are cards in the appropriate column.
 * Grandchildren (children of children) appear as sub-items within cards.
 * Supports drag & drop between columns and between projects.
 */
function _displayProjectsKanban(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const seenIds = new Set();
  const projects = chits.filter(c => {
    if (!c.is_project_master || c.deleted || c.archived) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  if (projects.length === 0) {
    chitList.innerHTML = "<p>No projects found.</p>";
    return;
  }

  const chitMap = {};
  chits.forEach(c => { chitMap[c.id] = c; });

  const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];

  const wrapper = document.createElement("div");
  wrapper.className = "projects-view";
  wrapper.style.cssText = "overflow-y:auto;flex:1 1 auto;min-height:0;padding:0.5em;";

  projects.forEach(project => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);
    const projectFont = contrastColorForBg(projectColor);

    // Project header
    const projectBox = document.createElement("div");
    projectBox.style.cssText = `margin-bottom:1.5em;border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};color:${projectFont};`;

    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};color:${projectFont};cursor:pointer;font-weight:bold;font-size:1.05em;border-bottom:1px solid rgba(139,90,43,0.2);`;
    header.textContent = project.title || "(Untitled Project)";
    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });
    projectBox.appendChild(header);

    // Kanban columns row
    const columnsRow = document.createElement("div");
    columnsRow.style.cssText = "display:flex;gap:0;min-height:120px;";

    // Group children by status
    const grouped = {};
    statuses.forEach(s => { grouped[s] = []; });
    childIds.forEach(cid => {
      const child = chitMap[cid];
      if (!child || child.deleted) return;
      const st = child.status || "ToDo";
      if (!grouped[st]) grouped[st] = [];
      grouped[st].push(child);
    });

    statuses.forEach(status => {
      const col = document.createElement("div");
      col.style.cssText = "flex:1;min-width:0;border-right:2px solid rgba(139,90,43,0.35);padding:0.5em;display:flex;flex-direction:column;gap:0.3em;background:rgba(255,255,255,0.15);";
      col.dataset.status = status;
      col.dataset.projectId = project.id;

      // Column header
      const colHeader = document.createElement("div");
      colHeader.style.cssText = "font-weight:bold;opacity:0.85;text-align:center;padding:5px 0 8px;border-bottom:2px solid rgba(139,90,43,0.3);margin-bottom:8px;white-space:nowrap;";
      colHeader.textContent = status;
      col.appendChild(colHeader);

      // Cards
      grouped[status].forEach(child => {
        const card = document.createElement("div");
        card.className = "chit-card";
        card.draggable = true;
        card.dataset.chitId = child.id;
        card.dataset.projectId = project.id;
        const childBg = chitColor(child);
        const childFont = contrastColorForBg(childBg);
        card.style.cssText = `padding:0.5em 0.6em;font-size:1em;background:${childBg};color:${childFont};cursor:grab;margin-bottom:0.3em;border-width:1px;line-height:1.4;`;
        if (child.status === "Complete") card.classList.add("completed-task");

        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-weight:bold;margin-bottom:3px;";
        titleEl.textContent = child.title || "(Untitled)";
        // Visual indicators inline with title
        if (typeof _getAllIndicators === 'function') {
          const ind = _getAllIndicators(child, _viSettings, 'card');
          if (ind) titleEl.textContent += ' ' + ind;
        }
        card.appendChild(titleEl);

        // Status / Priority / Severity meta row
        const metaParts = [];
        if (child.priority) metaParts.push(child.priority);
        if (child.severity) metaParts.push(child.severity);
        if (metaParts.length > 0) {
          const metaEl = document.createElement("div");
          metaEl.style.cssText = "font-size:0.9em;opacity:0.75;margin-bottom:3px;";
          metaEl.textContent = metaParts.join(" · ");
          card.appendChild(metaEl);
        }

        // Show due date if present
        if (child.due_datetime) {
          const due = document.createElement("div");
          due.style.cssText = "font-size:0.9em;opacity:0.75;margin-bottom:3px;";
          due.textContent = "Due: " + formatDate(new Date(child.due_datetime));
          card.appendChild(due);
        }

        // Note preview (rendered markdown, same as Tasks view)
        if (child.note && child.note.trim()) {
          const notePreview = document.createElement("div");
          notePreview.style.cssText = "font-size:0.9em;opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;margin-top:2px;";
          if (typeof marked !== 'undefined') {
            notePreview.innerHTML = resolveChitLinks(marked.parse(child.note.slice(0, 500)), chits);
          } else {
            notePreview.textContent = child.note.slice(0, 300) + (child.note.length > 300 ? '…' : '');
          }
          card.appendChild(notePreview);
        }

        // Grandchildren (children of this child) as sub-items
        const grandchildIds = Array.isArray(child.child_chits) ? child.child_chits : [];
        if (grandchildIds.length > 0) {
          const subList = document.createElement("ul");
          subList.style.cssText = "margin:4px 0 0 0;padding:0 0 0 12px;list-style:none;font-size:0.95em;";
          grandchildIds.forEach(gcId => {
            const gc = chitMap[gcId];
            if (!gc || gc.deleted) return;
            const li = document.createElement("li");
            li.draggable = true;
            li.dataset.chitId = gc.id;
            li.dataset.parentChitId = child.id;
            li.style.cssText = `padding:2px 4px;margin:1px 0;border-radius:3px;cursor:grab;background:rgba(255,255,255,0.4);border:1px solid rgba(139,90,43,0.1);display:flex;align-items:center;gap:4px;`;
            if (gc.status === "Complete") li.style.opacity = "0.5";

            const bullet = document.createElement("span");
            bullet.style.cssText = "opacity:0.4;font-size:0.8em;flex-shrink:0;";
            bullet.textContent = gc.status === "Complete" ? "✓" : "▸";
            li.appendChild(bullet);

            const gcTitle = document.createElement("span");
            gcTitle.style.flex = "1";
            gcTitle.textContent = gc.title || "(Untitled)";
            li.appendChild(gcTitle);

            // Grandchild drag
            li.addEventListener("dragstart", e => {
              e.stopPropagation();
              e.dataTransfer.setData("application/x-kanban-grandchild", JSON.stringify({ chitId: gc.id, parentChitId: child.id, projectId: project.id }));
              e.dataTransfer.effectAllowed = "move";
              li.style.opacity = "0.4";
            });
            li.addEventListener("dragend", () => { li.style.opacity = gc.status === "Complete" ? "0.5" : "1"; });

            li.addEventListener("dblclick", e => {
              e.stopPropagation();
              storePreviousState();
              window.location.href = `/editor?id=${gc.id}`;
            });

            subList.appendChild(li);
          });
          card.appendChild(subList);
        }

        // Card drag (child chit between status columns)
        card.addEventListener("dragstart", e => {
          e.dataTransfer.setData("application/x-kanban-card", JSON.stringify({ chitId: child.id, projectId: project.id, fromStatus: status }));
          e.dataTransfer.effectAllowed = "move";
          card.style.opacity = "0.4";
        });
        card.addEventListener("dragend", () => { card.style.opacity = ""; });

        card.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${child.id}`;
        });

        col.appendChild(card);
      });

      // Drop zone for cards
      col.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        col.style.background = "rgba(139,90,43,0.08)";
      });
      col.addEventListener("dragleave", () => {
        col.style.background = "";
      });
      col.addEventListener("drop", async e => {
        e.preventDefault();
        col.style.background = "";

        // Handle card drops (child chit status change)
        const cardData = e.dataTransfer.getData("application/x-kanban-card");
        if (cardData) {
          try {
            const data = JSON.parse(cardData);
            const newStatus = col.dataset.status;
            if (data.fromStatus === newStatus) return;
            // Update the chit's status via API
            const resp = await fetch(`/api/chit/${data.chitId}`);
            if (!resp.ok) return;
            const fullChit = await resp.json();
            fullChit.status = newStatus;
            if (newStatus === "Complete" && !fullChit.completed_datetime) {
              fullChit.completed_datetime = new Date().toISOString();
            }
            await fetch(`/api/chits/${data.chitId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fullChit),
            });
            fetchChits();
          } catch (err) { console.error("Kanban card drop error:", err); }
          return;
        }

        // Handle grandchild drops (move between parent cards)
        const gcData = e.dataTransfer.getData("application/x-kanban-grandchild");
        if (gcData) {
          try {
            const data = JSON.parse(gcData);
            // Find the target card (closest .chit-card under the drop point)
            const targetCard = e.target.closest(".chit-card");
            if (!targetCard || !targetCard.dataset.chitId) return;
            const targetParentId = targetCard.dataset.chitId;
            if (targetParentId === data.parentChitId) return; // same parent, no-op

            // Remove from old parent's child_chits
            const oldParentResp = await fetch(`/api/chit/${data.parentChitId}`);
            if (!oldParentResp.ok) return;
            const oldParent = await oldParentResp.json();
            oldParent.child_chits = (oldParent.child_chits || []).filter(id => id !== data.chitId);
            await fetch(`/api/chits/${data.parentChitId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(oldParent) });

            // Add to new parent's child_chits
            const newParentResp = await fetch(`/api/chit/${targetParentId}`);
            if (!newParentResp.ok) return;
            const newParent = await newParentResp.json();
            if (!Array.isArray(newParent.child_chits)) newParent.child_chits = [];
            if (!newParent.child_chits.includes(data.chitId)) newParent.child_chits.push(data.chitId);
            await fetch(`/api/chits/${targetParentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newParent) });

            fetchChits();
          } catch (err) { console.error("Kanban grandchild drop error:", err); }
        }
      });

      columnsRow.appendChild(col);
    });

    projectBox.appendChild(columnsRow);
    wrapper.appendChild(projectBox);
  });

  chitList.appendChild(wrapper);
}

/**
 * Alarms tab: list all chits that have any alert (alarm, notification, timer, stopwatch).
 */
function displayAlarmsView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Include chits with any alert type: alarm flag, notification flag, or alerts array entries
  // But don't count notify-at-start/due flags as alerts for this view
  const alertChits = chitsToDisplay.filter((c) => {
    if (!Array.isArray(c.alerts) || c.alerts.length === 0) {
      return c.alarm || c.notification;
    }
    // Filter out _notify_flags entries — they're not real alerts
    const realAlerts = c.alerts.filter(a => a._type !== '_notify_flags');
    return realAlerts.length > 0;
  });

  if (alertChits.length === 0) {
    chitList.innerHTML = _emptyState("No chits with alerts found.");
    return;
  }

  const view = document.createElement("div");
  view.className = "alarms-view";

  alertChits.forEach((chit) => {
    const card = document.createElement("div");
    card.className = "chit-card";
    card.draggable = true;
    card.dataset.chitId = chit.id;
    if (chit.archived) card.classList.add("archived-chit");
    applyChitColors(card, chitColor(chit));

    card.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

    // Alert summary
    const alerts = Array.isArray(chit.alerts) ? chit.alerts : [];
    const alarmCount = alerts.filter((a) => a._type === "alarm").length;
    const timerCount = alerts.filter((a) => a._type === "timer").length;
    const swCount = alerts.filter((a) => a._type === "stopwatch").length;
    const notifCount = alerts.filter((a) => a._type === "notification").length;

    const summaryRow = document.createElement("div");
    summaryRow.style.cssText = "margin-top:0.3em;display:flex;align-items:center;gap:0.5em;font-size:0.9em;";
    if (alarmCount > 0 || chit.alarm) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `🔔 ${alarmCount || 1}` }));
    if (timerCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏱️ ${timerCount}` }));
    if (swCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏲️ ${swCount}` }));
    if (notifCount > 0 || chit.notification) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `📢 ${notifCount || 1}` }));
    if (summaryRow.children.length > 0) card.appendChild(summaryRow);

    card.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });

    view.appendChild(card);
  });

  chitList.appendChild(view);
  enableDragToReorder(view, 'Alarms', () => displayChits());
}

function filterChits(tab) {
  storePreviousState();

  currentTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="filterChits('${tab}')"]`)
    ?.classList.add("active");

  // Show/hide period selector and date nav based on Calendar tab
  const periodSection = document.getElementById('section-period');
  const yearWeekContainer = document.getElementById('year-week-container');
  const orderSection = document.getElementById('section-order');
  if (periodSection) {
    periodSection.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (yearWeekContainer) {
    yearWeekContainer.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (orderSection) {
    orderSection.style.display = (tab === 'Calendar') ? 'none' : '';
  }

  // Show/hide Kanban toggle for Projects tab
  const kanbanSection = document.getElementById('section-kanban');
  if (kanbanSection) {
    kanbanSection.style.display = (tab === 'Projects') ? '' : 'none';
  }

  _loadLabelFilters();

  // Apply default search filter for this tab (from settings)
  const search = document.getElementById('search');
  if (search && _defaultFilters) {
    const tabKey = tab.toLowerCase();
    if (_defaultFilters[tabKey] && !search.value) {
      search.value = _defaultFilters[tabKey];
    }
  }

  updateDateRange();
  displayChits();
  _updateClearFiltersButton();
}

function searchChits() {
  displayChits();
}

// ═══════════════ GLOBAL SEARCH ═══════════════

/**
 * HTML-escape text, then wrap all case-insensitive occurrences of `query` in <mark> tags.
 * Returns original text unchanged if query is empty.
 */
function highlightMatch(text, query) {
  if (!text) return '';
  if (!query) return text;
  // HTML-escape the text first
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  // Escape regex special chars in query using a loop to avoid replacement issues
  var specials = '.*+?^${}()|[]\\';
  var safeQuery = '';
  for (var i = 0; i < query.length; i++) {
    if (specials.indexOf(query[i]) !== -1) safeQuery += '\\';
    safeQuery += query[i];
  }
  var regex = new RegExp('(' + safeQuery + ')', 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

/** 
 * Render the Global Search view into #chit-list.
 * Shows a search bar + Go button, fetches results from the API, applies sidebar filters,
 * and renders Result_Cards with highlighted match excerpts.
 */
async function displaySearchView() {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;
  chitList.innerHTML = '';

  var _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Search bar area
  var searchBar = document.createElement('div');
  searchBar.className = 'global-search-bar';

  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'global-search-input';
  input.placeholder = 'Search all chits…';
  input.value = _globalSearchQuery || '';

  var goBtn = document.createElement('button');
  goBtn.className = 'action-button';
  goBtn.textContent = 'Go';
  goBtn.style.cssText = 'flex-shrink:0;';

  searchBar.appendChild(input);
  searchBar.appendChild(goBtn);
  chitList.appendChild(searchBar);

  // Results container
  var resultsContainer = document.createElement('div');
  resultsContainer.className = 'global-search-results';
  chitList.appendChild(resultsContainer);

  // Execute search function
  async function executeSearch() {
    var q = input.value.trim();
    _globalSearchQuery = q;
    if (!q) {
      _globalSearchResults = [];
      resultsContainer.innerHTML = '';
      return;
    }
    try {
      var resp = await fetch('/api/chits/search?q=' + encodeURIComponent(q));
      if (!resp.ok) throw new Error('Search failed (HTTP ' + resp.status + ')');
      var data = await resp.json();
      _globalSearchResults = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Global search error:', err);
      resultsContainer.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.8;color:#b22222;"><p>⚠ ' + (err.message || 'Search failed') + '</p></div>';
      return;
    }
    _renderSearchResults(resultsContainer, _viSettings);
  }

  // Wire up Go button and Enter key
  goBtn.addEventListener('click', executeSearch);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); executeSearch(); }
  });

  // If we already have results (re-rendering after filter change), show them
  if (_globalSearchResults.length > 0 && _globalSearchQuery) {
    _renderSearchResults(resultsContainer, _viSettings);
  }

  // Auto-focus the search input only if user isn't typing in the sidebar filter
  var activeEl = document.activeElement;
  var isSidebarFocused = activeEl && (activeEl.id === 'search' || activeEl.closest('.sidebar'));
  if (!isSidebarFocused) {
    setTimeout(function() { input.focus(); }, 50);
  }
}

/**
 * Render search result cards into the given container.
 * Applies sidebar filters before rendering.
 */
function _renderSearchResults(container, viSettings) {
  container.innerHTML = '';
  var q = _globalSearchQuery;

  // Extract chit objects and apply sidebar filters
  var resultChits = _globalSearchResults.map(function(r) {
    var c = r.chit;
    c._matchedFields = r.matched_fields || [];
    return c;
  });
  resultChits = _applyMultiSelectFilters(resultChits);
  resultChits = _applyArchiveFilter(resultChits);

  // Apply sidebar text filter
  var sidebarText = (document.getElementById('search')?.value || '').toLowerCase();
  if (sidebarText) {
    resultChits = resultChits.filter(function(c) {
      if (c.title && c.title.toLowerCase().includes(sidebarText)) return true;
      if (c.note && c.note.toLowerCase().includes(sidebarText)) return true;
      if (Array.isArray(c.tags) && c.tags.some(function(t) { return t.toLowerCase().includes(sidebarText); })) return true;
      if (c.status && c.status.toLowerCase().includes(sidebarText)) return true;
      if (Array.isArray(c.people) && c.people.some(function(p) { return p.toLowerCase().includes(sidebarText); })) return true;
      if (c.location && c.location.toLowerCase().includes(sidebarText)) return true;
      if (c.priority && c.priority.toLowerCase().includes(sidebarText)) return true;
      return false;
    });
  }

  if (resultChits.length === 0) {
    container.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;"><p style="font-size:1.1em;">No results found.</p></div>';
    return;
  }

  resultChits.forEach(function(chit) {
    var card = document.createElement('div');
    card.className = 'chit-card global-search-result-card';
    card.dataset.chitId = chit.id;
    applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.archived) card.classList.add('archived-chit');
    card.style.cursor = 'pointer';

    // Title row via _buildChitHeader
    var titleHtml = highlightMatch(chit.title || '(Untitled)', q);
    card.appendChild(_buildChitHeader(chit, titleHtml, viSettings));

    // Matched fields with highlighted excerpts
    var matchedFields = chit._matchedFields || [];
    if (matchedFields.length > 0) {
      var fieldsDiv = document.createElement('div');
      fieldsDiv.className = 'global-search-matched-fields';

      matchedFields.forEach(function(fieldName) {
        var value = _getChitFieldValue(chit, fieldName);
        if (!value) return;

        var fieldRow = document.createElement('div');

        var label = document.createElement('span');
        label.textContent = fieldName + ':';
        fieldRow.appendChild(label);

        var excerpt = document.createElement('span');
        // Truncate long values for display
        var displayVal = value.length > 200 ? value.substring(0, 200) + '…' : value;
        excerpt.innerHTML = highlightMatch(displayVal, q);
        fieldRow.appendChild(excerpt);

        fieldsDiv.appendChild(fieldRow);
      });
      card.appendChild(fieldsDiv);
    }

    // Click handler: navigate to editor
    card.addEventListener('click', function() {
      storePreviousState();
      window.location.href = '/frontend/editor.html?id=' + chit.id;
    });

    container.appendChild(card);
  });
}

/**
 * Extract a displayable string value for a chit field by name.
 */
function _getChitFieldValue(chit, fieldName) {
  switch (fieldName) {
    case 'title': return chit.title || '';
    case 'note': return chit.note || '';
    case 'tags':
      var tags = chit.tags || [];
      return Array.isArray(tags) ? tags.join(', ') : String(tags);
    case 'status': return chit.status || '';
    case 'priority': return chit.priority || '';
    case 'severity': return chit.severity || '';
    case 'location': return chit.location || '';
    case 'people':
      var people = chit.people || [];
      return Array.isArray(people) ? people.join(', ') : String(people);
    case 'checklist':
      var cl = chit.checklist || [];
      if (Array.isArray(cl)) return cl.map(function(item) { return typeof item === 'object' ? (item.text || '') : String(item); }).join(', ');
      return String(cl);
    case 'color': return chit.color || '';
    case 'start_datetime': return chit.start_datetime || '';
    case 'end_datetime': return chit.end_datetime || '';
    case 'due_datetime': return chit.due_datetime || '';
    case 'created_datetime': return chit.created_datetime || '';
    case 'modified_datetime': return chit.modified_datetime || '';
    case 'alerts':
      var alerts = chit.alerts || [];
      if (Array.isArray(alerts)) return alerts.map(function(a) { return typeof a === 'object' ? (a.description || a.label || JSON.stringify(a)) : String(a); }).join(', ');
      return String(alerts);
    default: return chit[fieldName] != null ? String(chit[fieldName]) : '';
  }
}

// ═══════════════ END GLOBAL SEARCH ═══════════════

// ── Saved Searches ───────────────────────────────────────────────────────────
function _saveSearch() {
  const search = document.getElementById('search')?.value?.trim();
  if (!search) return;
  const saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  if (saved.includes(search)) return;
  saved.push(search);
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _loadSavedSearch(text) {
  const input = document.getElementById('search');
  if (input) { input.value = text; searchChits(); }
}

function _deleteSavedSearch(text) {
  let saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  saved = saved.filter(s => s !== text);
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _renderSavedSearches() {
  const container = document.getElementById('saved-searches');
  if (!container) return;
  const saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  container.innerHTML = '';
  saved.forEach(s => {
    const chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:3px;background:rgba(139,90,43,0.15);font-size:0.75em;cursor:pointer;';
    chip.title = `Click to search: ${s}`;
    const label = document.createElement('span');
    label.textContent = s.length > 15 ? s.slice(0, 15) + '…' : s;
    label.onclick = () => _loadSavedSearch(s);
    const del = document.createElement('span');
    del.textContent = '✕';
    del.style.cssText = 'cursor:pointer;opacity:0.5;font-size:0.9em;margin-left:2px;';
    del.title = 'Remove saved search';
    del.onclick = (e) => { e.stopPropagation(); _deleteSavedSearch(s); };
    chip.appendChild(label);
    chip.appendChild(del);
    container.appendChild(chip);
  });
}

function changeView() {
  storePreviousState();
  currentView = document.getElementById("period-select")?.value || currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
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

// _utcToLocalDate, _parseISOTime moved to shared.js

function _convertDBDateToDisplayDate(dateString) {
  if (!dateString) return "";
  const date = _utcToLocalDate(dateString);
  if (isNaN(date.getTime())) return "";
  return formatDate(date);
}

const userTimezoneOffset = new Date().getTimezoneOffset();
console.debug(`User timezone offset: ${userTimezoneOffset} minutes`);

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
          _convertDBDateToDisplayDate(chit.start_datetime);
        if (!chit.all_day)
          document.getElementById("start_time").value = _parseISOTime(
            chit.start_datetime,
          );
      }
      if (chit.end_datetime) {
        document.getElementById("end_datetime").value =
          _convertDBDateToDisplayDate(chit.end_datetime);
        if (!chit.all_day)
          document.getElementById("end_time").value = _parseISOTime(
            chit.end_datetime,
          );
      }
      if (chit.due_datetime) {
        document.getElementById("due_datetime").value =
          _convertDBDateToDisplayDate(chit.due_datetime);
        document.getElementById("due_time").value = _parseISOTime(
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
      document.getElementById("color").value = chitColor(chit);
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
      document.getElementById("period-select").value = currentView;
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
  document.getElementById("period-select").value = currentView;
  fetchChits();
}

// ── Tab overflow detection: show full labels or icon-only, never partial text ─
function _checkTabOverflow() {
  var tabs = document.getElementById('cwoc-tabs');
  if (!tabs) return;
  var allTabs = Array.from(tabs.querySelectorAll('.tab'));
  if (allTabs.length === 0) return;

  // Reset to full labels
  tabs.classList.remove('icon-only');
  allTabs.forEach(function(t) { t.style.paddingLeft = ''; t.style.paddingRight = ''; });
  void tabs.offsetWidth; // force reflow

  // Check if all tabs fit with full labels
  if (tabs.scrollWidth <= tabs.clientWidth + 2) return;

  // Try reducing padding gradually (keeps labels visible, just tighter)
  for (var pad = 18; pad >= 8; pad -= 2) {
    allTabs.forEach(function(t) { t.style.paddingLeft = pad + 'px'; t.style.paddingRight = pad + 'px'; });
    void tabs.offsetWidth;
    if (tabs.scrollWidth <= tabs.clientWidth + 2) return;
  }

  // Still doesn't fit — hide labels entirely (icon-only)
  tabs.classList.add('icon-only');
  allTabs.forEach(function(t) { t.style.paddingLeft = ''; t.style.paddingRight = ''; });
}

document.addEventListener("DOMContentLoaded", function () {
  console.debug("DOM fully loaded, initializing...");

  // Initialize mobile sidebar overlay behavior (backdrop, resize handling)
  initMobileSidebar();

  // Initialize mobile Views button (replaces tab bar on mobile)
  if (typeof initMobileViewsButton === 'function') initMobileViewsButton();

  // Add close button to reference overlay for mobile
  if (typeof initMobileReferenceClose === 'function') initMobileReferenceClose();

  // Default: hide archived chits, show pinned
  const saInit = document.getElementById('show-archived');
  if (saInit) saInit.checked = false;

  // Try to restore previous UI state (from editor return)
  const restored = _restoreUIState();
  if (!restored) {
    currentTab = "Calendar";
  }
  // Ensure clear-filters button reflects restored filter state
  _updateClearFiltersButton();

  // Hide Order on Calendar, show date nav + period
  const orderSection = document.getElementById('section-order');
  if (orderSection) orderSection.style.display = (currentTab === 'Calendar') ? 'none' : '';
  const periodSection = document.getElementById('section-period');
  if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const yearWeekContainer = document.getElementById('year-week-container');
  if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const kanbanSection = document.getElementById('section-kanban');
  if (kanbanSection) kanbanSection.style.display = (currentTab === 'Projects') ? '' : 'none';

  _loadLabelFilters();
  _buildPeopleFilterPanel();
  _renderSavedSearches();
  _updateSortUI();
  loadSavedLocations().then(function () {
    // Pre-load weather for default location into cache
    var defaultLoc = getDefaultLocation();
    if (defaultLoc && defaultLoc.address) {
      var cacheKey = 'cwoc_weather_cache_' + defaultLoc.address.toLowerCase().trim();
      // Fetch in background — don't block UI
      _fetchWeatherForCache(defaultLoc.address, cacheKey);
    }
  });

  // ESC in sidebar tag search box blurs it and clears search
  const tagSearchInput = document.getElementById('tag-filter-search');
  if (tagSearchInput) {
    tagSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); tagSearchInput.blur(); tagSearchInput.value = ''; _filterTagCheckboxes(); }
    });
  }

  // Pre-load week start day setting before rendering calendar
  getCachedSettings().then(s => {
    if (s.week_start_day !== undefined) _weekStartDay = parseInt(s.week_start_day) || 0;
    if (s.work_start_hour !== undefined) _workStartHour = parseInt(s.work_start_hour) || 8;
    if (s.work_end_hour !== undefined) _workEndHour = parseInt(s.work_end_hour) || 17;
    if (s.work_days) _workDays = s.work_days.split(',').map(Number);
    if (s.enabled_periods) _enabledPeriods = s.enabled_periods.split(',');
    if (s.custom_days_count) _customDaysCount = parseInt(s.custom_days_count) || 7;
    if (s.all_view_start_hour !== undefined) _allViewStartHour = parseInt(s.all_view_start_hour) || 0;
    if (s.all_view_end_hour !== undefined) _allViewEndHour = parseInt(s.all_view_end_hour) || 24;
    if (s.day_scroll_to_hour !== undefined) _dayScrollToHour = parseInt(s.day_scroll_to_hour) || 5;
    if (s.chit_options) _chitOptions = { ..._chitOptions, ...s.chit_options };
    // Load default filters per tab
    const df = s.default_filters;
    if (df && typeof df === 'object' && !Array.isArray(df)) {
      _defaultFilters = df;
    }
    // Now fetch chits and render with correct settings
    _applyEnabledPeriods();
    fetchChits();
    updateDateRange();
  }).catch(() => {
    fetchChits();
    updateDateRange();
  });
  restoreSidebarState();
  _checkTabOverflow();
  _startGlobalAlertSystem();

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

  // ── Debounced resize listener for breakpoint-crossing re-renders ──────────
  _lastBreakpointCategory = _getBreakpointCategory();
  window.addEventListener("resize", _onDebouncedResize);

  // ── Keyboard shortcuts (hotkey state machine) ────────────────────────────
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const tag = el?.tagName?.toLowerCase();
    const inputType = el?.type?.toLowerCase();
    const isTextInput = (tag === "input" && inputType !== "checkbox" && inputType !== "radio")
      || tag === "textarea" || tag === "select"
      || el?.isContentEditable;
    if (isTextInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    const keyLower = key.toLowerCase();

    // ── ESC: exit any submenu or close reference ──
    // Shift+ESC: clear all values in the active filter panel
    if (key === "Escape") {
      if (e.shiftKey && (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY' || _hotkeyMode === 'FILTER_PEOPLE')) {
        if (_hotkeyMode === 'FILTER_PEOPLE') {
          if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
          if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
          onFilterChange();
          _exitHotkeyMode();
          return;
        }
        const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
          : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
        document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'FILTER') {
        // Clear ALL filters
        document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        const sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
        const sa = document.getElementById('show-archived'); if (sa) sa.checked = true;
        const su = document.getElementById('show-unmarked'); if (su) su.checked = true;
        const search = document.getElementById('search'); if (search) search.value = '';
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'ORDER') {
        currentSortField = null;
        const sel = document.getElementById('sort-select'); if (sel) sel.value = '';
        _updateSortUI();
        displayChits();
        _exitHotkeyMode();
        return;
      }
      if (document.getElementById('reference-overlay')?.classList.contains('active')) {
        _closeReference();
        return;
      }
      if (document.getElementById('clock-modal-overlay')) {
        _closeClockModal();
        return;
      }
      if (document.getElementById('weather-modal-overlay')) {
        // First Escape: blur the dropdown/input if focused; second Escape: close modal
        var weatherDropdown = document.getElementById('weather-modal-loc-dropdown');
        var weatherInput = document.getElementById('weather-modal-manual-input');
        if (weatherDropdown && document.activeElement === weatherDropdown) {
          weatherDropdown.blur();
          return;
        }
        if (weatherInput && document.activeElement === weatherInput) {
          weatherInput.blur();
          return;
        }
        _closeWeatherModal();
        return;
      }
      if (_hotkeyMode) {
        _exitHotkeyMode();
        return;
      }
      return;
    }

    // ── Reference overlay toggle (R) / Help page (Shift+R) ──
    if (keyLower === 'r' && !_hotkeyMode) {
      e.preventDefault();
      if (e.shiftKey) {
        openHelpPage();
      } else {
        _toggleReference();
      }
      return;
    }

    // Close reference if open and any other key pressed
    if (document.getElementById('reference-overlay')?.classList.contains('active')) {
      _closeReference();
    }

    // ── PERIOD submenu (after '.') ──
    if (_hotkeyMode === 'PERIOD') {
      const periodMap = { i: 'Itinerary', d: 'Day', w: 'Week', k: 'Work', s: 'SevenDay', m: 'Month', y: 'Year' };
      if (periodMap[keyLower]) {
        e.preventDefault();
        _pickPeriod(periodMap[keyLower]);
      }
      return;
    }

    // ── FILTER submenu (after 'F') ──
    if (_hotkeyMode === 'FILTER') {
      e.preventDefault();
      // Backspace/Delete: clear ALL filters
      if (key === 'Backspace' || key === 'Delete') {
        _clearAllFilters();
        _exitHotkeyMode();
        return;
      }
      if (keyLower === 's') {
        _enterFilterSub('status');
      } else if (keyLower === 't') {
        _enterFilterSub('label');
      } else if (keyLower === 'p') {
        _enterFilterSub('priority');
      } else if (keyLower === 'a') {
        _toggleFilterArchived();
      } else if (keyLower === 'i') {
        _toggleFilterPinned();
      } else if (keyLower === 'd') {
        _filterFocusSearch();
      } else if (keyLower === 'e') {
        _enterFilterSub('people');
      }
      return;
    }

    // ── Inside a multi-select filter (number keys toggle, Enter/letter confirms) ──
    if (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY') {
      // Skip if tag search box is focused (let user type)
      if (_hotkeyMode === 'FILTER_LABEL' && document.activeElement?.closest('#panel-label-options')) return;

      const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
        : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
      const panelId = _hotkeyMode === 'FILTER_STATUS' ? 'panel-status-options'
        : _hotkeyMode === 'FILTER_LABEL' ? 'panel-label-options' : 'panel-priority-options';
      const boxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);

      // Backspace/Delete: clear this filter
      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (_hotkeyMode === 'FILTER_LABEL') {
          // Clear tag selection
          if (window._sidebarTagSelection) window._sidebarTagSelection.length = 0;
          _syncSidebarTagCheckboxes(document.getElementById('label-multi'), _cachedTagObjects);
          onFilterChange();
          _buildTagFilterPanel();
        } else {
          boxes.forEach(cb => { cb.checked = false; });
          const anyCb = document.querySelector(`#${containerId} input[data-any="true"]`);
          if (anyCb) anyCb.checked = true;
          onFilterChange();
          const panelOptions = document.querySelectorAll(`#${panelId} .hotkey-panel-option`);
          panelOptions.forEach(opt => opt.classList.remove('selected'));
        }
        return;
      }

      if (key === 'Enter') {
        e.preventDefault();
        onFilterChange();
        _exitHotkeyMode();
        return;
      }

      // Number keys toggle (1-9)
      const num = parseInt(key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        if (_hotkeyMode === 'FILTER_LABEL') {
          // Use the visible tag panel list items
          const panelItems = document.querySelectorAll('#panel-label-options .cwoc-sidebar-filter-list .hotkey-panel-option');
          if (num <= panelItems.length) {
            panelItems[num - 1].click();
          }
        } else {
          if (num <= boxes.length) {
            const cb = boxes[num - 1];
            cb.checked = !cb.checked;
            // Handle Any toggle
            if (cb.dataset.any) {
              onFilterAnyToggle(cb);
            } else {
              const filterType = cb.dataset.filter;
              if (filterType) onFilterSpecificToggle(filterType);
            }
            onFilterChange();
            const panelOptions = document.querySelectorAll(`#${panelId} .hotkey-panel-option`);
            if (panelOptions[num - 1]) {
              panelOptions[num - 1].classList.toggle('selected', cb.checked);
            }
          }
        }
        return;
      }
      return;
    }

    // ── Inside people filter (number keys toggle, Enter confirms) ──
    if (_hotkeyMode === 'FILTER_PEOPLE') {
      if (document.activeElement?.closest('#panel-people-options')) return;
      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
        if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
        onFilterChange();
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      const num = parseInt(key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const panelItems = document.querySelectorAll('#panel-people-options .cwoc-sidebar-filter-list .hotkey-panel-option');
        if (num <= panelItems.length) {
          panelItems[num - 1].click();
        }
        return;
      }
      return;
    }

    // ── ORDER submenu (after 'O') ──
    if (_hotkeyMode === 'ORDER') {
      e.preventDefault();
      const orderMap = { t: 'title', s: 'start', d: 'due', u: 'updated', c: 'created', x: 'status', m: 'manual', r: 'random', g: 'upcoming' };
      if (orderMap[keyLower]) {
        _pickSort(orderMap[keyLower]);
        return;
      }
      if (key === 'ArrowUp') {
        currentSortDir = 'asc';
        _updateSortUI();
        displayChits();
        return;
      }
      if (key === 'ArrowDown') {
        currentSortDir = 'desc';
        _updateSortUI();
        displayChits();
        return;
      }
      return;
    }

    // ── Top-level hotkeys ──
    const tabMap = { c: 'Calendar', h: 'Checklists', a: 'Alarms', p: 'Projects', t: 'Tasks', n: 'Notes', g: 'Search' };
    if (tabMap[keyLower]) {
      e.preventDefault();
      filterChits(tabMap[keyLower]);
      return;
    }

    if (keyLower === 'k') {
      e.preventDefault();
      storePreviousState();
      window.location.href = '/frontend/editor.html';
      return;
    }

    if (keyLower === 's' && !_hotkeyMode) {
      e.preventDefault();
      storePreviousState();
      localStorage.setItem('cwoc_settings_return', '/');
      window.location.href = '/frontend/settings.html';
      return;
    }

    if (key === '.') {
      e.preventDefault();
      if (currentTab === 'Calendar') {
        _hotkeyMode = 'PERIOD';
        expandSidebarSection('section-period');
        _showPanel('panel-period');
      }
      return;
    }

    if (keyLower === 'f') {
      e.preventDefault();
      _hotkeyMode = 'FILTER';
      expandSidebarSection('section-filters');
      _showPanel('panel-filter');
      return;
    }

    if (keyLower === 'o') {
      e.preventDefault();
      _hotkeyMode = 'ORDER';
      expandSidebarSection('section-order');
      _showPanel('panel-order');
      return;
    }

    if (keyLower === 'l' && !_hotkeyMode) {
      e.preventDefault();
      _openClockModal();
      return;
    }

    if (keyLower === 'w' && !_hotkeyMode) {
      e.preventDefault();
      _openWeatherModal();
      return;
    }
  });
});
