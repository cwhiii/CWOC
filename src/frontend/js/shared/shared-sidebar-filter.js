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
