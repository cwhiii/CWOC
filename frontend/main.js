/* Main application functionality */
let currentTab = "Calendar";
let chits = [];
let currentWeekStart = null;
let currentView = "Week";
let previousState = { tab: "Calendar", view: "Week" };

// ── Sort & filter state ──────────────────────────────────────────────────────
let currentSortField = null;   // null | 'title' | 'start' | 'due' | 'updated' | 'created'
let currentSortDir = 'asc';    // 'asc' | 'desc'

// ── Hotkey submenu state ─────────────────────────────────────────────────────
let _hotkeyMode = null;  // null | 'PERIOD' | 'FILTER' | 'ORDER' | 'FILTER_STATUS' | 'FILTER_LABEL' | 'FILTER_PRIORITY'

// Global tag objects cache for color lookups
let _cachedTagObjects = [];

// Chit display options (loaded from settings)
let _chitOptions = { fade_past_chits: true, highlight_overdue_chits: true, delete_past_alarm_chits: false };

// Default search filters per tab (loaded from settings)
let _defaultFilters = {};

/** Get tag color from cached settings tags, fallback to pastel */
function _getTagColor(tagName) {
  const tag = _cachedTagObjects.find(t => t.name === tagName);
  return (tag && tag.color) ? tag.color : getPastelColor(tagName);
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
  if (currentSortField && currentSortField !== 'manual') {
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
  const search = document.getElementById('search'); if (search) search.value = '';
  // Re-check "Any" checkboxes
  document.querySelectorAll('input[data-any="true"]').forEach(cb => { cb.checked = true; });
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
  const searchText = document.getElementById('search')?.value || '';
  const showPinned = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? false;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;
  const isDefault = !hasStatusFilter && !hasLabelFilter && !hasPriorityFilter
    && !searchText && showPinned && !showArchived && showUnmarked && !currentSortField;
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

function _getSelectedStatuses() {
  const boxes = document.querySelectorAll('#status-multi input[data-filter="status"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals; // empty = "Any" checked or nothing specific = show all
}

function _getSelectedLabels() {
  const boxes = document.querySelectorAll('#label-multi input[data-filter="label"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals;
}

function _getSelectedPriorities() {
  const boxes = document.querySelectorAll('#priority-multi input[data-filter="priority"]:checked');
  const vals = [];
  boxes.forEach(b => { if (b.value) vals.push(b.value); });
  return vals;
}

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

  return result;
}

function _applySort(chitList) {
  if (!currentSortField) return chitList;
  if (currentSortField === 'manual') {
    return applyManualOrder(currentTab, chitList);
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
// Returns a div with: [pinned icon][archived icon] Title ... meta values
function _buildChitHeader(chit, titleHtml) {
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
      const chip = document.createElement('span');
      chip.style.cssText = `display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.75em;margin-left:4px;background:${tagColor};color:#000;`;
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
  currentView = period;
  const sel = document.getElementById('period-select');
  if (sel) sel.value = currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
  _exitHotkeyMode();
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

/** Build the tag filter panel with search box, favorites first, colored tags */
function _buildTagFilterPanel() {
  const container = document.getElementById('panel-label-options');
  if (!container) return;
  container.innerHTML = '';

  // Search box
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tags...';
  searchInput.style.cssText = 'width:100%;padding:4px 8px;font-size:0.9em;margin-bottom:8px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  searchInput.id = 'tag-panel-search';
  container.appendChild(searchInput);

  const listDiv = document.createElement('div');
  listDiv.id = 'tag-panel-list';
  container.appendChild(listDiv);

  // Get all non-system tags, sorted: favorites first, then alphabetical
  const allTags = (_cachedTagObjects || []).filter(t => t.name && !isSystemTag(t.name));
  const sorted = [...allTags].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const selectedTags = window._sidebarTagSelection || [];

  function renderTagList(query) {
    listDiv.innerHTML = '';
    let shown = 0;
    sorted.forEach(tag => {
      if (shown >= 9) return;
      if (query && !tag.name.toLowerCase().includes(query)) return;

      shown++;
      const isSelected = selectedTags.includes(tag.name);
      const tagColor = tag.color || getPastelColor(tag.name);

      const div = document.createElement('div');
      div.className = 'hotkey-panel-option' + (isSelected ? ' selected' : '');
      div.style.cssText = 'display:flex;align-items:center;gap:6px;';

      const keySpan = document.createElement('span');
      keySpan.className = 'panel-key';
      keySpan.textContent = shown;
      div.appendChild(keySpan);

      if (tag.favorite) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.9em;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        div.appendChild(star);
      }

      const badge = document.createElement('span');
      badge.className = 'panel-label';
      badge.textContent = tag.name;
      badge.style.cssText = `background:${tagColor};padding:1px 6px;border-radius:4px;color:#3c2f2f;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      div.appendChild(badge);

      div.addEventListener('click', () => {
        const idx = selectedTags.indexOf(tag.name);
        if (idx === -1) {
          selectedTags.push(tag.name);
        } else {
          selectedTags.splice(idx, 1);
        }
        // Sync sidebar checkboxes
        _syncSidebarTagCheckboxes(document.getElementById('label-multi'), _cachedTagObjects);
        onFilterChange();
        // Re-render to update visual state
        renderTagList(searchInput.value.trim().toLowerCase());
      });

      listDiv.appendChild(div);
    });
    if (shown === 0) {
      listDiv.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:4px;">No matching tags</div>';
    }
  }

  renderTagList('');

  searchInput.addEventListener('input', () => {
    renderTagList(searchInput.value.trim().toLowerCase());
  });

  setTimeout(() => searchInput.focus(), 50);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      searchInput.blur();
      _exitHotkeyMode();
    }
    // Number keys: toggle the corresponding tag instead of typing
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const items = listDiv.querySelectorAll('.hotkey-panel-option');
        if (num <= items.length) {
          items[num - 1].click();
        }
      }
    }
  });
}

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
  window.open('/frontend/help.html', '_blank');
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

// ── Load label/tag filters from settings ─────────────────────────────────────
async function _loadLabelFilters() {
  try {
    const container = document.getElementById('label-multi');
    if (!container) return;

    // Collect tags from settings API
    let tagObjects = [];
    try {
      const resp = await fetch('/api/settings/default_user');
      if (resp.ok) {
        const settings = await resp.json();
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
      }
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
    console.log('Could not load label filters:', e);
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
  currentView = sel.value;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
}

function goToToday() {
  const now = new Date();
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
  // Resume AudioContext if suspended (browser autoplay policy)
  _globalAlarmAudio.currentTime = 0;
  const playPromise = _globalAlarmAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — queue it to play on next user interaction
      const unlock = () => {
        _globalAlarmAudio.play().catch(() => {});
        document.removeEventListener("click", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    });
  }
}

function _globalStopAlarm() {
  if (_globalAlarmAudio) { _globalAlarmAudio.pause(); _globalAlarmAudio.currentTime = 0; }
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
      _globalTriggeredAlarms.add(key);

      const label = `${_globalFmtTime(alert.time)}${alert.name ? " — " + alert.name : ""}`;
      _globalPlayAlarm();
      const toast = _showGlobalToast("🔔", label, chit.title, chit.id, _globalStopAlarm);

      // Snooze: update the alert time +5 min in the chit (requires re-save — just update display for now)
      const snoozeBtn = toast.querySelector("button:last-child");
      if (snoozeBtn) {
        snoozeBtn.onclick = () => {
          toast.remove();
          _globalStopAlarm();
          // Re-trigger in 5 minutes by removing the key after 5 min
          setTimeout(() => _globalTriggeredAlarms.delete(key), 5 * 60 * 1000);
        };
      }

      _sendBrowserNotification(`🔔 Alarm: ${chit.title}`, label, chit.id);
    });
  });

  // Clean up old keys
  _globalTriggeredAlarms.forEach((key) => {
    if (!key.endsWith(now.toDateString())) _globalTriggeredAlarms.delete(key);
  });
}

function _globalCheckNotifications() {
  const now = new Date();

  chits.forEach((chit) => {
    if (!Array.isArray(chit.alerts)) return;
    chit.alerts.forEach((alert, alertIdx) => {
      if (alert._type !== "notification" || !alert.value || !alert.unit) return;

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
      _showGlobalToast("📢", label, chit.title, chit.id, null);
      _sendBrowserNotification(`📢 Reminder: ${chit.title}`, label, chit.id);
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

function _startGlobalAlertSystem() {
  // Request notification permission
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }

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
  fetch("/api/settings/default_user")
    .then((r) => r.json())
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
    if (state.showArchived || !state.showPinned || !state.showUnmarked) {
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
  const savedState = localStorage.getItem("sidebarState");
  if (savedState === "open") {
    sidebar.classList.add("active");
  } else {
    sidebar.classList.remove("active");
  }
}

// Global week start day (0=Sun, 1=Mon, etc.) — loaded from settings
let _weekStartDay = 0;

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

function formatDate(date) {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${monthNames[date.getMonth()]}-${String(date.getDate()).padStart(2,'0')} ${dayNames[date.getDay()]}`;
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

function getChitDisplayColor(chit) {
  // Return pale cream for no color or transparent — never show transparent in views
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
}

/**
 * Returns the display color for a chit. Transparent/null → pale cream.
 */
function chitColor(chit) {
  if (!chit.color || chit.color === "transparent") return "#fdf6e3";
  return chit.color;
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
      // Re-check notifications immediately after chits refresh
      if (typeof _globalCheckNotifications === "function") _globalCheckNotifications();
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
    return false;
  });

  // Apply multi-select filters (status, label, priority)
  filteredChits = _applyMultiSelectFilters(filteredChits);

  // Apply archive/pinned filter
  filteredChits = _applyArchiveFilter(filteredChits);

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
      displayAlarmsView(filteredChits);
      break;
    case "Projects":
      displayProjectsView(filteredChits);
      break;
    default:
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
  }

  // Post-render: apply chit display options (fade past, highlight overdue)
  _applyChitDisplayOptions();
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

function displayWeekView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  // Wrapper: flex column — headers, all-day, then scrollable time grid
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;";

  const weekStart = new Date(currentWeekStart);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  // Collect chits per day
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

  // Row 1: Day headers
  const headerRow = document.createElement("div");
  headerRow.style.cssText = "display:flex;flex-shrink:0;border-bottom:1px solid #6b4e31;";
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

    renderAllDayEventsInCells(dayData, allDayEventsRow);

















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
  hourColumn.style.cssText = "width:60px;flex-shrink:0;position:relative;height:1440px;";
  for (let hour = 0; hour < 24; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${hour * 60}px`;
    hb.textContent = `${hour}:00`;
    hourColumn.appendChild(hb);
  }
  scrollGrid.appendChild(hourColumn);

  // Day columns with timed events only
  const weekDayColumns = [];
  const weekChitsMap = [];
  dayData.forEach((dd, dayIdx) => {
    const col = document.createElement("div");
    col.className = "day-column";
    if (dd.day.toDateString() === new Date().toDateString()) col.classList.add("today");
    col.style.cssText = "flex:1;min-width:0;position:relative;min-height:1440px;border-left:1px solid #d3d3d3;";

    // Calculate overlaps for this day's timed events
    const _timeSlots = {};
    const _evData = [];
    dd.timed.forEach(({ chit, info }) => {
      const _dayStart = new Date(dd.day.getFullYear(), dd.day.getMonth(), dd.day.getDate());
      const _dayEnd = new Date(_dayStart.getTime() + 86400000);
      const _cs = info.start < _dayStart ? _dayStart : info.start;
      const _ce = info.end > _dayEnd ? _dayEnd : info.end;
      const _top = _cs.getHours() * 60 + _cs.getMinutes();
      let _height = (_ce.getTime() === _dayEnd.getTime()) ? 1440 - _top : (_ce.getHours() * 60 + _ce.getMinutes()) - _top;
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
      ev.style.backgroundColor = chitColor(chit);
      ev.style.left = `${pos * _wPct}%`;
      ev.style.width = `${_wPct - 1}%`;
      ev.style.boxSizing = "border-box";
      ev.title = calendarEventTooltip(chit, info);
      const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
      ev.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info)}<br>${timeLabel}`;
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

  scrollToSixAM();
  renderTimeBar("Week");

  // Enable drag
  _loadCalSnapSetting().then(() => {
    enableCalendarDrag(scrollGrid, weekDayColumns, days, weekChitsMap);
  });
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
  const firstDay = (monthStart.getDay() - _weekStartDay + 7) % 7;
  const daysInMonth = monthEnd.getDate();

  // Month/year now shown in sidebar — no header bar needed

  const dayHeaders = document.createElement("div");
  dayHeaders.className = "day-headers";
  const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) daysOfWeek.push(allDays[(_weekStartDay + i) % 7]);
  daysOfWeek.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";
    dayHeader.textContent = day;
    dayHeaders.appendChild(dayHeader);
  });
  monthView.appendChild(dayHeaders);

  const monthGrid = document.createElement("div");
  monthGrid.className = "month-grid";

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
        chitElement.style.backgroundColor = chitColor(chit);
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info);
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }
    monthGrid.appendChild(monthDay);
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
        chitElement.style.backgroundColor = chitColor(chit);
        chitElement.style.cursor = "pointer";
        if (chit.status === "Complete") chitElement.classList.add("completed-task");
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info);
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }

    monthGrid.appendChild(monthDay);
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
        chitElement.style.backgroundColor = chitColor(chit);
        chitElement.title = calendarEventTooltip(chit, info);
        chitElement.innerHTML = calendarEventTitle(chit, info.isDueOnly, info);
        attachCalendarChitEvents(chitElement, chit);
        eventsContainer.appendChild(chitElement);
      });
      monthDay.appendChild(eventsContainer);
    }
    monthGrid.appendChild(monthDay);
  }

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
        if (chitDate.toDateString() === new Date().toDateString()) daySeparator.classList.add("today");
        daySeparator.innerHTML = `<hr><h3>${formatDate(chitDate)}</h3>`;
        itineraryView.appendChild(daySeparator);
      }

      const chitElement = document.createElement("div");
      chitElement.className = "itinerary-event";
      chitElement.style.display = "flex";
      chitElement.style.justifyContent = "flex-start";
      chitElement.style.padding = "10px";
      chitElement.style.backgroundColor = chitColor(chit);
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

function displayDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

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
      ev.style.backgroundColor = chitColor(chit);
      if (chit.status === "Complete") ev.classList.add("completed-task");
      ev.title = calendarEventTooltip(chit, info);
      ev.innerHTML = calendarEventTitle(chit, info.isDueOnly, info);
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
  hourColumn.style.cssText = "width:80px;flex-shrink:0;position:relative;height:1440px;background:#fff5e6;";
  for (let hour = 0; hour < 24; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${hour * 60}px`;
    hb.textContent = `${hour}:00`;
    hourColumn.appendChild(hb);
  }
  dayView.appendChild(hourColumn);

  const eventsContainer = document.createElement("div");
  eventsContainer.style.cssText = "position:relative;flex:1;margin-left:15px;min-height:1440px;";

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
    const startTime = _cs.getHours() * 60 + _cs.getMinutes();
    let endTime = (_ce.getTime() === _dayEnd.getTime()) ? 1440 : _ce.getHours() * 60 + _ce.getMinutes();
    if (endTime <= startTime) endTime = startTime + 30;

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
    el.style.backgroundColor = chitColor(chit);
    el.title = calendarEventTooltip(chit, info);
    if (chit.status === "Complete") el.classList.add("completed-task");
    const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
    el.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info)}<br>${timeLabel}`;
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
        document.getElementById("period-select").value = "Day";
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
    checklistView.innerHTML = "<p>No chits found.</p>";
  else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.draggable = true;
      chitElement.dataset.chitId = chit.id;
      chitElement.style.backgroundColor = chitColor(chit);
      if (chit.status === "Complete") chitElement.classList.add("completed-task");
      if (chit.archived) chitElement.classList.add("archived-chit");

      chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

      // Interactive checklist from shared.js
      renderInlineChecklist(chitElement, chit, () => fetchChits());

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);
  enableDragToReorder(checklistView, 'Checklists', () => displayChits());
}

function displayTasksView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  let taskChits = chitsToDisplay.filter(
    (chit) => chit.status || chit.due_datetime,
  );

  // Default sort: by status (ToDo → In Progress → Blocked → Complete at bottom)
  if (!currentSortField) {
    const statusOrder = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, '': 4, 'Complete': 5 };
    taskChits.sort((a, b) => (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4));
  }

  if (taskChits.length === 0) {
    chitList.innerHTML = "<p>No tasks found.</p>";
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
    chitElement.style.backgroundColor = typeof chitColor === 'function' ? chitColor(chit) : '';
    if (chit.status === "Complete") chitElement.classList.add("completed-task");

    chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

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
        notePreview.innerHTML = marked.parse(chit.note.slice(0, 500));
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
    notesView.innerHTML = "<p>No notes found.</p>";
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.dataset.chitId = chit.id;
      chitElement.style.backgroundColor = chitColor(chit);
      if (chit.archived) chitElement.classList.add("archived-chit");

      // Simple title with icons
      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { const i = document.createElement('i'); i.className = 'fas fa-bookmark'; i.title = 'Pinned'; i.style.fontSize = '0.85em'; titleRow.appendChild(i); }
      if (chit.archived) { const i = document.createElement('span'); i.textContent = '📦'; i.title = 'Archived'; titleRow.appendChild(i); }
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);
      chitElement.appendChild(titleRow);

      const noteEl = document.createElement("div");
      noteEl.className = "note-content";
      noteEl.style.cssText = "overflow:hidden;font-size:0.9em;";
      if (typeof marked !== "undefined" && chit.note) {
        noteEl.innerHTML = marked.parse(chit.note);
      } else {
        noteEl.style.whiteSpace = "pre-wrap";
        noteEl.textContent = chit.note;
      }
      chitElement.appendChild(noteEl);

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
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
    if (currentTab === 'Notes') applyNotesLayout(notesView);
  };
  window.removeEventListener('resize', window._notesResizeHandler);
  window._notesResizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  enableNotesDragReorder(notesView, 'Notes', () => displayChits());
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
function displaySevenDayView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
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

  // Row 1: Day headers
  const headerRow = document.createElement("div");
  headerRow.style.cssText = "display:flex;flex-shrink:0;border-bottom:1px solid #6b4e31;";
  const headerSpacer = document.createElement("div");
  headerSpacer.style.cssText = "width:60px;flex-shrink:0;";
  headerRow.appendChild(headerSpacer);
  days.forEach(day => {
    const hdr = document.createElement("div");
    hdr.className = "day-header";
    if (day.toDateString() === new Date().toDateString()) hdr.classList.add("today");
    hdr.style.cssText = "flex:1;min-width:0;text-align:center;padding:6px 2px;";
    hdr.textContent = formatDate(day);
    headerRow.appendChild(hdr);
  });
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

    renderAllDayEventsInCells(dayData, allDayEventsRow);

















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
  hourColumn.style.cssText = "width:60px;flex-shrink:0;position:relative;height:1440px;";
  for (let hour = 0; hour < 24; hour++) {
    const hb = document.createElement("div");
    hb.className = "hour-block";
    hb.style.top = `${hour * 60}px`;
    hb.textContent = `${hour}:00`;
    hourColumn.appendChild(hb);
  }
  scrollGrid.appendChild(hourColumn);

  const sdDayColumns = [];
  const sdChitsMap = [];
  dayData.forEach(dd => {
    const col = document.createElement("div");
    col.className = "day-column";
    if (dd.day.toDateString() === new Date().toDateString()) col.classList.add("today");
    col.style.cssText = "flex:1;min-width:0;position:relative;min-height:1440px;border-left:1px solid #d3d3d3;";

    // Calculate overlaps for 7-day view
    const _ts7 = {};
    const _ed7 = [];
    dd.timed.forEach(({ chit, info }) => {
      const _dayStart = new Date(dd.day.getFullYear(), dd.day.getMonth(), dd.day.getDate());
      const _dayEnd = new Date(_dayStart.getTime() + 86400000);
      const _cs = info.start < _dayStart ? _dayStart : info.start;
      const _ce = info.end > _dayEnd ? _dayEnd : info.end;
      const _top = _cs.getHours() * 60 + _cs.getMinutes();
      let _height = (_ce.getTime() === _dayEnd.getTime()) ? 1440 - _top : (_ce.getHours() * 60 + _ce.getMinutes()) - _top;
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
      ev.style.backgroundColor = chitColor(chit);
      ev.style.left = `${pos * _w}%`;
      ev.style.width = `${_w - 1}%`;
      ev.style.boxSizing = "border-box";
      ev.title = calendarEventTooltip(chit, info);
      const timeLabel = info.isDueOnly ? `Due: ${formatTime(info.start)}` : `${formatTime(info.start)} - ${formatTime(info.end)}`;
      ev.innerHTML = `${calendarEventTitle(chit, info.isDueOnly, info)}<br>${timeLabel}`;
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
}

/**
 * Projects tab: tree view — each project master with its child chits nested.
 */
function displayProjectsView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  // Use all chits (not filtered) to find project masters — filters shouldn't hide projects
  const projects = chits.filter((c) => c.is_project_master && !c.deleted && !c.archived);

  if (projects.length === 0) {
    chitList.innerHTML = "<p>No projects found. Create a chit and enable Project Master in the Projects zone.</p>";
    return;
  }

  // Build a lookup map of all chits by ID
  const chitMap = {};
  chits.forEach((c) => { chitMap[c.id] = c; });

  const view = document.createElement("div");
  view.className = "projects-view";

  projects.forEach((project) => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);

    // Outer box colored with project color
    const box = document.createElement("div");
    box.style.cssText = `border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};`;

    // Project header row — use standard header builder
    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};cursor:pointer;`;
    header.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)"));

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
        const li = document.createElement("li");
        li.style.cssText = `display:flex;align-items:center;gap:0.5em;padding:0.35em 0.8em 0.35em 1.5em;border-bottom:1px solid rgba(139,90,43,0.1);background:${child ? chitColor(child) : "#fdf6e3"};cursor:pointer;`;

        const bullet = document.createElement("span");
        bullet.style.cssText = "opacity:0.4;font-size:0.8em;flex-shrink:0;";
        bullet.textContent = "▸";
        li.appendChild(bullet);

        const childTitle = document.createElement("span");
        childTitle.style.cssText = "flex:1;font-size:0.95em;";
        childTitle.textContent = child ? (child.title || "(Untitled)") : `[${childId.slice(0,8)}…]`;
        li.appendChild(childTitle);

        if (child) {
          if (child.status) {
            const status = document.createElement("span");
            status.style.cssText = "font-size:0.75em;opacity:0.7;white-space:nowrap;";
            status.textContent = child.status;
            li.appendChild(status);
          }
          if (child.due_datetime) {
            const due = document.createElement("span");
            due.style.cssText = "font-size:0.75em;opacity:0.6;white-space:nowrap;";
            due.textContent = formatDate(new Date(child.due_datetime));
            li.appendChild(due);
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
 * Alarms tab: list all chits that have any alert (alarm, notification, timer, stopwatch).
 */
function displayAlarmsView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  // Include chits with any alert type: alarm flag, notification flag, or alerts array entries
  const alertChits = chitsToDisplay.filter((c) =>
    c.alarm || c.notification ||
    (Array.isArray(c.alerts) && c.alerts.length > 0)
  );

  if (alertChits.length === 0) {
    chitList.innerHTML = "<p>No chits with alerts found.</p>";
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
    card.style.backgroundColor = chitColor(chit);

    card.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`));

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

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded, initializing...");

  // Default: hide archived chits, show pinned
  const saInit = document.getElementById('show-archived');
  if (saInit) saInit.checked = false;

  // Try to restore previous UI state (from editor return)
  const restored = _restoreUIState();
  if (!restored) {
    currentTab = "Calendar";
  }

  // Hide Order on Calendar, show date nav + period
  const orderSection = document.getElementById('section-order');
  if (orderSection) orderSection.style.display = (currentTab === 'Calendar') ? 'none' : '';
  const periodSection = document.getElementById('section-period');
  if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const yearWeekContainer = document.getElementById('year-week-container');
  if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';

  _loadLabelFilters();
  _updateSortUI();

  // ESC in sidebar tag search box blurs it and clears search
  const tagSearchInput = document.getElementById('tag-filter-search');
  if (tagSearchInput) {
    tagSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); tagSearchInput.blur(); tagSearchInput.value = ''; _filterTagCheckboxes(); }
    });
  }

  // Pre-load week start day setting before rendering calendar
  fetch('/api/settings/default_user').then(r => r.ok ? r.json() : {}).then(s => {
    if (s.week_start_day !== undefined) _weekStartDay = parseInt(s.week_start_day) || 0;
    if (s.chit_options) _chitOptions = { ..._chitOptions, ...s.chit_options };
    // Load default filters per tab
    const df = s.default_filters;
    if (df && typeof df === 'object' && !Array.isArray(df)) {
      _defaultFilters = df;
    }
    // Now fetch chits and render with correct settings
    fetchChits();
    updateDateRange();
  }).catch(() => {
    fetchChits();
    updateDateRange();
  });
  restoreSidebarState();
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

  window.addEventListener("resize", () => {
    if (currentTab === "Notes") {
      displayChits();
    }
  });

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
      if (e.shiftKey && (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY')) {
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
      const periodMap = { i: 'Itinerary', d: 'Day', w: 'Week', s: 'SevenDay', m: 'Month', y: 'Year' };
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
      } else if (keyLower === 'w') {
        _filterFocusSearch();
      }
      return;
    }

    // ── Inside a multi-select filter (number keys toggle, Enter/letter confirms) ──
    if (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY') {
      // Skip if tag search box is focused (let user type)
      if (_hotkeyMode === 'FILTER_LABEL' && document.activeElement?.id === 'tag-panel-search') return;

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
          const panelItems = document.querySelectorAll('#tag-panel-list .hotkey-panel-option');
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

    // ── ORDER submenu (after 'O') ──
    if (_hotkeyMode === 'ORDER') {
      e.preventDefault();
      const orderMap = { t: 'title', s: 'start', d: 'due', u: 'updated', c: 'created', x: 'status', m: 'manual' };
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
    const tabMap = { c: 'Calendar', h: 'Checklists', a: 'Alarms', p: 'Projects', t: 'Tasks', n: 'Notes' };
    if (tabMap[keyLower]) {
      e.preventDefault();
      filterChits(tabMap[keyLower]);
      return;
    }

    if (keyLower === 'k') {
      e.preventDefault();
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
  });
});
