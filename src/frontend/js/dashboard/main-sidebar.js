/**
 * main-sidebar.js — Dashboard sidebar rendering, filter panels, and toggle logic.
 *
 * Contains:
 *   - CwocSidebarFilter class (reusable filter panel)
 *   - Tag filter panel (_buildTagFilterPanel, _syncSidebarTagCheckboxes)
 *   - People filter panel (_buildPeopleFilterPanel, _renderPeopleFilterPanel, _renderPeopleChipFilter)
 *   - Sidebar toggle/section expand/collapse (toggleSidebar, toggleSidebarSection, restoreSidebarState)
 *   - Topbar toggle (_toggleTopbar, _restoreTopbarState)
 *   - Filter toggle/clear functions (onFilterChange, onFilterAnyToggle, onFilterSpecificToggle, etc.)
 *   - Archive/pinned/unmarked toggles
 *   - Sort UI helpers (_updateSortUI, onSortSelectChange, toggleSortDir)
 *   - Saved searches (_saveSearch, _loadSavedSearch, _deleteSavedSearch, _renderSavedSearches)
 *   - Label/tag filter loading (_loadLabelFilters)
 *
 * Depends on globals from main.js: currentTab, currentSortField, currentSortDir,
 *   _cachedTagObjects, _chitOptions, _defaultFilters, _weekStartDay, _enabledPeriods, etc.
 * Depends on shared.js: getPastelColor, isSystemTag, buildTagTree, renderTagTree,
 *   matchesTagFilter, isLightColor, getCachedSettings
 */

/* ── Sort UI ─────────────────────────────────────────────────────────────── */

function onSortSelectChange() {
  var sel = document.getElementById('sort-select');
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
  var section = document.getElementById('section-clear-filters');
  if (!section) return;
  var hasStatusFilter = _getSelectedStatuses().length > 0;
  var hasLabelFilter = _getSelectedLabels().length > 0;
  var hasPriorityFilter = _getSelectedPriorities().length > 0;
  var hasPeopleFilter = (window._sidebarPeopleSelection || []).length > 0;
  var searchText = document.getElementById('search')?.value || '';
  var showPinned = document.getElementById('show-pinned')?.checked ?? true;
  var showArchived = document.getElementById('show-archived')?.checked ?? false;
  var showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;
  var hidePastDue = document.getElementById('hide-past-due')?.checked ?? false;
  var hideComplete = document.getElementById('hide-complete')?.checked ?? false;
  var hideDeclined = document.getElementById('hide-declined')?.checked ?? false;
  var highlightOverdue = document.getElementById('highlight-overdue')?.checked ?? true;
  var highlightBlocked = document.getElementById('highlight-blocked')?.checked ?? true;
  var hasSharingFilter = (document.getElementById('filter-shared-with-me')?.checked ?? false)
    || (document.getElementById('filter-shared-by-me')?.checked ?? false);
  var isDefault = !hasStatusFilter && !hasLabelFilter && !hasPriorityFilter && !hasPeopleFilter
    && !searchText && showPinned && !showArchived && showUnmarked && !hidePastDue && !hideComplete && !hideDeclined
    && highlightOverdue && highlightBlocked && !currentSortField && !hasSharingFilter;
  section.style.display = isDefault ? 'none' : '';

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
  var container = document.getElementById(config.containerId);
  if (!container) return;
  container.innerHTML = '';

  var items = config.items || [];
  var selection = config.selection || [];
  var onChange = config.onChange || function() {};
  var placeholder = config.searchPlaceholder || 'Search...';
  var showColorBadge = !!config.showColorBadge;

  // Search input
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = placeholder;
  searchInput.style.cssText = 'width:100%;padding:4px 8px;font-size:0.9em;margin-bottom:8px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  container.appendChild(searchInput);

  var listDiv = document.createElement('div');
  listDiv.className = 'cwoc-sidebar-filter-list';
  container.appendChild(listDiv);

  // Sort: favorites first, then alphabetical
  var sorted = items.slice().sort(function(a, b) {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });

  function renderList(query) {
    listDiv.innerHTML = '';
    var shown = 0;
    sorted.forEach(function(item) {
      if (shown >= 9) return;
      if (query && !(item.name || '').toLowerCase().includes(query)) return;

      shown++;
      var isSelected = selection.includes(item.name);

      var div = document.createElement('div');
      div.className = 'hotkey-panel-option' + (isSelected ? ' selected' : '');
      div.style.cssText = 'display:flex;align-items:center;gap:6px;';

      // Hotkey number badge
      var keySpan = document.createElement('span');
      keySpan.className = 'panel-key';
      keySpan.textContent = shown;
      div.appendChild(keySpan);

      // Favorite star
      if (item.favorite) {
        var star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.9em;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        div.appendChild(star);
      }

      // Label — colored badge or plain text
      var label = document.createElement('span');
      label.className = 'panel-label';
      label.textContent = item.name;
      if (showColorBadge) {
        var color = item.color || getPastelColor(item.name);
        label.style.cssText = 'background:' + color + ';padding:1px 6px;border-radius:4px;color:#3c2f2f;' + (isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : '');
      } else {
        label.style.cssText = 'padding:1px 6px;border-radius:4px;color:#3c2f2f;' + (isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : '');
      }
      div.appendChild(label);

      // Color dot badge (when showColorBadge is false but item has a color)
      if (!showColorBadge && item.color) {
        var dot = document.createElement('span');
        dot.className = 'cwoc-sidebar-filter-dot';
        dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + item.color + ';flex-shrink:0;';
        div.insertBefore(dot, label);
      }

      div.addEventListener('click', function() {
        var idx = selection.indexOf(item.name);
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

  searchInput.addEventListener('input', function() {
    renderList(searchInput.value.trim().toLowerCase());
  });

  setTimeout(function() { searchInput.focus(); }, 50);

  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      searchInput.blur();
      _exitHotkeyMode();
    }
    // Number keys 1-9: toggle the corresponding visible item
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      var num = parseInt(e.key);
      var visibleItems = listDiv.querySelectorAll('.hotkey-panel-option');
      if (num <= visibleItems.length) {
        visibleItems[num - 1].click();
      }
    }
  });
}

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
    var resp = await fetch('/api/contacts');
    if (!resp.ok) return;
    var contacts = await resp.json();
    window._cachedPeopleContacts = contacts;
    _renderPeopleFilterPanel(contacts);
  } catch (e) {
    console.error('Could not load contacts for people filter:', e);
  }
}

/** Render the people filter panel as chips into both sidebar and hotkey panel. */
function _renderPeopleFilterPanel(contacts) {
  if (!window._sidebarPeopleSelection) window._sidebarPeopleSelection = [];
  var selection = window._sidebarPeopleSelection;
  _renderPeopleChipFilter('people-multi', contacts, selection);
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

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search people...';
  searchInput.style.cssText = 'width:100%;padding:3px 6px;font-size:0.8em;margin-bottom:6px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  container.appendChild(searchInput);

  var chipsDiv = document.createElement('div');
  chipsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;max-height:200px;overflow-y:auto;';
  container.appendChild(chipsDiv);

  var sorted = contacts.slice().sort(function(a, b) {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  function renderChips(query) {
    chipsDiv.innerHTML = '';
    sorted.forEach(function(c) {
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

      var thumb = document.createElement('span');
      thumb.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;';
      if (c.image_url) {
        thumb.innerHTML = '<img src="' + c.image_url + '" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />';
      } else {
        thumb.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.1);text-align:center;line-height:18px;font-size:9px;">?</span>';
      }
      chip.appendChild(thumb);

      var nameSpan = document.createElement('span');
      var chipDisplayName = name;
      if (c.prefix && chipDisplayName.startsWith(c.prefix)) {
        chipDisplayName = chipDisplayName.substring(c.prefix.length).trim();
      }
      nameSpan.textContent = (c.favorite ? '★ ' : '') + chipDisplayName;
      chip.appendChild(nameSpan);

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

function toggleSidebar() {
  var sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("active");
  if (sidebar.classList.contains("active")) {
    localStorage.setItem("sidebarState", "open");
  } else {
    localStorage.setItem("sidebarState", "closed");
  }

  if (_isMobileOverlay()) {
    if (sidebar.classList.contains("active")) {
      _showSidebarBackdrop();
    } else {
      _hideSidebarBackdrop();
    }
  }

  window.dispatchEvent(new Event("resize"));
  setTimeout(function() { window.dispatchEvent(new Event("resize")); }, 350);
}

/** Toggle the topbar (header) visibility. Persists to localStorage. */
function _toggleTopbar() {
  var header = document.querySelector('.main-content > .header');
  if (!header) return;
  var isHidden = header.style.display === 'none';
  header.style.display = isHidden ? '' : 'none';
  localStorage.setItem('cwoc_topbar_hidden', isHidden ? 'false' : 'true');
  // Adjust chit-list to fill the space freed by hiding the header
  var chitList = document.getElementById('chit-list');
  if (chitList) {
    if (!isHidden) {
      // Hiding header — expand chit-list to fill
      chitList.style.marginTop = '0';
      chitList.style.height = '100vh';
    } else {
      // Showing header — restore original offset
      chitList.style.marginTop = '';
      chitList.style.height = '';
    }
  }
  window.dispatchEvent(new Event("resize"));
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
  var btn = document.getElementById('filters-toggle-btn');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (btn) btn.classList.toggle('expanded', isHidden);
}

/** Ensure filters section is expanded (used by hotkeys) */
function _expandFiltersSection() {
  var body = document.getElementById('filters-body');
  var btn = document.getElementById('filters-toggle-btn');
  if (body) body.style.display = '';
  if (btn) btn.classList.add('expanded');
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

function restoreSidebarState() {
  var sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("Sidebar element not found");
    return;
  }
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
    localStorage.setItem("sidebarState", "closed");
    return;
  }
  var savedState = localStorage.getItem("sidebarState");
  if (savedState === "closed") {
    sidebar.classList.remove("active");
  } else {
    sidebar.classList.add("active");
  }
}

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

/** Cached notification list for the inbox. */
var _notifInboxItems = [];

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
    // If inbox is currently expanded, re-render
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
      storePreviousState();
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
    // Remove from cached list
    _notifInboxItems = _notifInboxItems.filter(function(n) { return n.id !== notifId; });
    _updateNotifBadge();
    _renderNotifInbox();
    // Refresh chits to reflect RSVP changes
    if (typeof fetchChits === 'function') fetchChits();
  } catch (e) {
    console.error('Failed to ' + status + ' notification ' + notifId + ':', e);
  }
}
