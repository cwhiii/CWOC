/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Shared Sidebar Filter — CwocSidebarFilter class
   Extracted from main-sidebar.js for reuse across dashboard and maps pages.

   A reusable filter panel component with search, hotkey numbers, favorites,
   and colored badges. Used for tag and people filters in sidebars.
   ═══════════════════════════════════════════════════════════════════════════ */

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

      div.addEventListener('click', function(e) {
        if (e.shiftKey) {
          // Shift+Click: select ONLY this item, deselect all others
          selection.length = 0;
          selection.push(item.name);
        } else {
          var idx = selection.indexOf(item.name);
          if (idx === -1) {
            selection.push(item.name);
          } else {
            selection.splice(idx, 1);
          }
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
      // _exitHotkeyMode is dashboard-only; call it only if available
      if (typeof _exitHotkeyMode === 'function') _exitHotkeyMode();
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

/* ═══════════════════════════════════════════════════════════════════════════
   cwocLoadTagFilter — Shared tag filter with "Any Tag" / "Tagless" virtual
   options. Called by every page that has a sidebar tag filter.

   Loads tags from settings, renders virtual options + CwocSidebarFilter into
   #label-multi, and stores selection in window._sidebarTagSelection.

   @param {Object} config
   @param {Function} config.onChange — called when selection changes
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load and render the tag filter into #label-multi with "Any Tag" / "Tagless"
 * virtual options at the top, plus the standard CwocSidebarFilter tag list.
 * Selection is stored in window._sidebarTagSelection (the single source of truth).
 *
 * @param {Object} config
 * @param {Function} config.onChange — called whenever tag selection changes
 */
async function cwocLoadTagFilter(config) {
  config = config || {};
  var onChange = config.onChange || function() {};

  var container = document.getElementById('label-multi');
  if (!container) return;

  // Initialize selection if not already set — empty = default (show all)
  if (!window._sidebarTagSelection) {
    window._sidebarTagSelection = [];
  }

  // Load tags from settings
  var tagObjects = [];
  try {
    tagObjects = await loadAllTags();
  } catch (e) {
    console.warn('[cwocLoadTagFilter] Could not load tags:', e);
  }
  // Cache for other consumers (dashboard hotkey panel, etc.)
  window._cwocTagFilterObjects = tagObjects;

  container.innerHTML = '';

  var allTags = tagObjects.filter(function(t) { return t.name && !isSystemTag(t.name); });

  // ── "Select All / None" button ──
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(107,78,49,0.2);';

  var toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = 'tag-filter-toggle-all';
  toggleBtn.className = 'tag-virtual-btn';
  toggleBtn.style.cssText = 'width:100%;';
  toggleBtn.addEventListener('click', function() {
    var s = window._sidebarTagSelection;
    var allNames = allTags.map(function(t) { return t.name; });
    // If all are selected, deselect all. Otherwise select all.
    var allSelected = allNames.length > 0 && allNames.every(function(n) { return s.includes(n); });
    s.length = 0;
    if (!allSelected) {
      allNames.forEach(function(n) { s.push(n); });
    }
    _cwocUpdateTagToggleBtn(allTags);
    _cwocRerenderTagList(container, tagObjects, onChange);
    onChange();
  });
  btnRow.appendChild(toggleBtn);
  container.appendChild(btnRow);

  _cwocUpdateTagToggleBtn(allTags);

  // ── Tag list ──
  if (allTags.length === 0) {
    container.insertAdjacentHTML('beforeend', '<span style="font-size:0.8em;opacity:0.5;">No tags defined</span>');
    return;
  }

  _cwocRenderTagList(container, tagObjects, onChange);
}

/**
 * Render the tag tree into the container, below the virtual row.
 * Uses renderTagTree (tree with colors, expand/collapse) instead of CwocSidebarFilter.
 * Includes a search input to filter visible tags.
 * @private
 */
function _cwocRenderTagList(container, tagObjects, onChange) {
  // Remove old list container if present
  var oldList = container.querySelector('#tag-filter-list');
  if (oldList) oldList.remove();

  var listContainer = document.createElement('div');
  listContainer.id = 'tag-filter-list';
  container.appendChild(listContainer);

  var allTags = tagObjects.filter(function(t) { return t.name && !isSystemTag(t.name); });
  if (allTags.length === 0) return;

  // Search input for filtering displayed tags
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tags...';
  searchInput.style.cssText = 'width:100%;padding:3px 6px;font-size:0.8em;margin-bottom:4px;box-sizing:border-box;border:1px solid #6b4e31;border-radius:3px;font-family:inherit;background:#fffaf0;color:#4a2c2a;';
  listContainer.appendChild(searchInput);

  // Tree container
  var treeContainer = document.createElement('div');
  treeContainer.id = 'tag-filter-tree';
  listContainer.appendChild(treeContainer);

  var tree = buildTagTree(allTags);

  function onToggle(fullPath, isNowSelected) {
    var s = window._sidebarTagSelection;
    var idx = s.indexOf(fullPath);
    if (isNowSelected && idx === -1) s.push(fullPath);
    else if (!isNowSelected && idx !== -1) s.splice(idx, 1);
    _cwocUpdateTagVirtualOptions();
    onChange();
  }

  function onSelectOnly(fullPath) {
    // Shift+Click: select only this tag
    var s = window._sidebarTagSelection;
    s.length = 0;
    s.push(fullPath);
    _cwocUpdateTagVirtualOptions();
    // Re-render tree to update checkbox visuals
    renderTagTree(treeContainer, tree, s, onToggle, { onSelectOnly: onSelectOnly });
    onChange();
  }

  renderTagTree(treeContainer, tree, window._sidebarTagSelection, onToggle, { onSelectOnly: onSelectOnly });

  // Search: filter visible tag rows in realtime
  searchInput.addEventListener('input', function() {
    var query = searchInput.value.trim().toLowerCase();
    treeContainer.querySelectorAll('[data-tag-row]').forEach(function(row) {
      var tagPath = (row.dataset.tagRow || '').toLowerCase();
      // Show row if query matches any part of the tag path
      row.style.display = (!query || tagPath.includes(query)) ? '' : 'none';
    });
    // Also show/hide child containers based on whether any children are visible
    treeContainer.querySelectorAll('[data-tag-children]').forEach(function(childDiv) {
      var hasVisible = childDiv.querySelector('[data-tag-row]:not([style*="display: none"])') ||
                       childDiv.querySelector('[data-tag-row]:not([style*="display:none"])');
      childDiv.style.display = hasVisible ? '' : 'none';
    });
  });

  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.blur();
    }
  });
}

/**
 * Re-render the tag list (called after virtual option click to update selected state).
 * @private
 */
function _cwocRerenderTagList(container, tagObjects, onChange) {
  _cwocRenderTagList(container, tagObjects, onChange);
}

/**
 * Update the "Select All / None" button text based on current selection.
 */
function _cwocUpdateTagToggleBtn(allTags) {
  var btn = document.getElementById('tag-filter-toggle-all');
  if (!btn) return;
  var allNames = (allTags || []).map(function(t) { return t.name; });
  var sel = window._sidebarTagSelection || [];
  var allSelected = allNames.length > 0 && allNames.every(function(n) { return sel.includes(n); });
  btn.textContent = allSelected ? 'Select None' : 'Select All';
  btn.classList.toggle('active', allSelected);
}

/**
 * Legacy wrapper — called from dashboard code that still references this name.
 */
function _cwocUpdateTagVirtualOptions() {
  var allTags = (window._cwocTagFilterObjects || []).filter(function(t) { return t.name && !isSystemTag(t.name); });
  _cwocUpdateTagToggleBtn(allTags);
}

/**
 * Reset the tag filter to default state (no tags selected = show all chits).
 * Call this from any page's "clear filters" logic.
 */
function cwocClearTagFilter() {
  if (window._sidebarTagSelection) {
    window._sidebarTagSelection.length = 0;
  }
  _cwocUpdateTagVirtualOptions();
}

/**
 * Apply the current tag filter to a chit's tags. Returns true if the chit passes.
 * Empty selection = no filtering (all chits pass).
 * When tags are selected, only chits matching those tags pass.
 *
 * @param {string[]|string|null} chitTags — the chit's tags (array, JSON string, or null)
 * @returns {boolean} — true if the chit passes the tag filter
 */
function cwocChitPassesTagFilter(chitTags) {
  var sel = window._sidebarTagSelection || [];

  // No tags selected = default state = show everything
  if (sel.length === 0) return true;

  // Parse tags if needed
  if (chitTags && typeof chitTags === 'string') {
    try { chitTags = JSON.parse(chitTags); } catch (e) { chitTags = [chitTags]; }
  }
  if (!Array.isArray(chitTags)) chitTags = [];

  // Must match at least one selected tag (including descendants)
  return sel.some(function(filterTag) {
    return chitTags.some(function(t) {
      return t === filterTag || t.indexOf(filterTag + '/') === 0;
    });
  });
}
