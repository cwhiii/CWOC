/**
 * shared-tags.js — Tag tree utilities, filtering, and inline tag creation.
 *
 * Provides nested tag tree building, flattening, rendering as expandable
 * HTML trees, tag filter matching, recent tag tracking, inline tag creation,
 * system tag detection, and chit link resolution.
 *
 * Depends on: shared-utils.js (for getCachedSettings, _invalidateSettingsCache, getPastelColor)
 */

/**
 * Build a nested tag tree from a flat array of tag objects.
 * @param {Array} flatTags - Array of { name, color, favorite } objects
 * @returns {Array} Tree nodes: { name, fullPath, color, favorite, children: [] }
 */
function buildTagTree(flatTags) {
  const root = [];
  const nodeMap = {};

  flatTags.forEach(tag => {
    const parts = tag.name.split('/');
    let currentLevel = root;
    let pathSoFar = '';

    parts.forEach((part, i) => {
      pathSoFar = pathSoFar ? pathSoFar + '/' + part : part;
      if (!nodeMap[pathSoFar]) {
        const isLeaf = i === parts.length - 1;
        const node = {
          name: part,
          fullPath: pathSoFar,
          color: isLeaf ? tag.color : null,
          fontColor: isLeaf ? (tag.fontColor || null) : null,
          favorite: isLeaf ? !!tag.favorite : false,
          children: [],
        };
        nodeMap[pathSoFar] = node;
        currentLevel.push(node);
      }
      currentLevel = nodeMap[pathSoFar].children;
    });
  });

  // Color inheritance: children with no color inherit from parent
  function inheritColors(nodes, parentColor) {
    nodes.forEach(n => {
      if (!n.color && parentColor) n.color = parentColor;
      if (n.children.length > 0) inheritColors(n.children, n.color || parentColor);
    });
  }
  inheritColors(root, null);

  // Sort alphabetically at every level
  function sortLevel(nodes) {
    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    nodes.forEach(n => { if (n.children.length > 0) sortLevel(n.children); });
  }
  sortLevel(root);

  return root;
}

/**
 * Flatten a tag tree back to a flat list of { name, color, favorite }.
 * Only includes leaf nodes (or nodes that were originally defined).
 * @param {Array} tree
 * @param {Array} originalNames - original flat tag names for reference
 * @returns {Array}
 */
function flattenTagTree(tree, originalNames) {
  const result = [];
  function walk(nodes) {
    nodes.forEach(node => {
      if (node.children.length === 0 || originalNames.includes(node.fullPath)) {
        result.push({ name: node.fullPath, color: node.color, favorite: node.favorite });
      }
      walk(node.children);
    });
  }
  walk(tree);
  return result;
}

/**
 * Check if a chit's tags match a filter tag (including descendants).
 * E.g., filter "Work" matches chit tag "Work/Projects/CWOC".
 * @param {string[]} chitTags - tags on the chit
 * @param {string} filterTag - the filter tag path
 * @returns {boolean}
 */
function matchesTagFilter(chitTags, filterTag) {
  if (!Array.isArray(chitTags) || !filterTag) return false;
  return chitTags.some(t => t === filterTag || t.startsWith(filterTag + '/'));
}

/**
 * Render a tag tree as an expandable/collapsible HTML tree.
 * @param {HTMLElement} container - element to render into
 * @param {Array} tree - from buildTagTree()
 * @param {string[]} selectedTags - currently selected full paths
 * @param {function} onToggle - callback(fullPath, isNowSelected) when a tag is toggled
 * @param {object} [opts] - { showFavorites: bool }
 */
function renderTagTree(container, tree, selectedTags, onToggle, opts) {
  container.innerHTML = '';

  function renderLevel(nodes, parentEl, depth) {
    nodes.forEach(node => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;justify-content:flex-start;gap:4px;padding:1px 0;padding-left:${depth * 16}px;cursor:pointer;`;

      // Create child container first so toggle can reference it
      let childContainer = null;
      if (node.children.length > 0) {
        childContainer = document.createElement('div');
      }

      // Expand/collapse toggle for nodes with children
      if (childContainer) {
        const toggle = document.createElement('span');
        toggle.style.cssText = 'font-size:0.7em;width:14px;text-align:center;cursor:pointer;user-select:none;flex-shrink:0;';
        toggle.textContent = '▼';
        toggle.dataset.tagToggle = 'true';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = childContainer.style.display === 'none';
          childContainer.style.display = isHidden ? '' : 'none';
          toggle.textContent = isHidden ? '▼' : '▶';
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.style.cssText = 'width:14px;flex-shrink:0;';
        row.appendChild(spacer);
      }

      // Checkbox
      const isSelected = selectedTags.includes(node.fullPath);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isSelected;
      cb.style.cssText = 'margin:0;cursor:pointer;flex-shrink:0;';
      cb.addEventListener('click', (e) => { e.stopPropagation(); });
      cb.addEventListener('change', () => {
        if (onToggle) onToggle(node.fullPath, cb.checked);
      });
      row.appendChild(cb);

      // Favorite star (inline before name)
      if (node.favorite) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.85em;flex-shrink:0;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        row.appendChild(star);
      }

      // Tag name with color background — always shows tag color
      const tagColor = node.color || (typeof getPastelColor === 'function' ? getPastelColor(node.fullPath) : 'rgba(139,90,43,0.15)');
      const tagFontColor = node.fontColor || '#3c2f2f';
      const badge = document.createElement('span');
      badge.textContent = node.name;
      badge.style.cssText = `font-size:0.85em;padding:1px 6px;border-radius:4px;background:${tagColor};color:${tagFontColor};white-space:nowrap;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      row.appendChild(badge);

      // Click row to toggle selection
      row.addEventListener('click', () => {
        if (onToggle) onToggle(node.fullPath, !isSelected);
      });

      parentEl.appendChild(row);

      // Render children
      if (childContainer) {
        childContainer.dataset.tagChildren = 'true';
        renderLevel(node.children, childContainer, depth + 1);
        parentEl.appendChild(childContainer);
      }
    });
  }

  renderLevel(tree, container, 0);
}

// Session-level recent tags tracking
let _recentTags = [];

function trackRecentTag(tagPath) {
  _recentTags = _recentTags.filter(t => t !== tagPath);
  _recentTags.unshift(tagPath);
  if (_recentTags.length > 3) _recentTags = _recentTags.slice(0, 3);
}

function getRecentTags() {
  return _recentTags.slice(0, 3);
}

/**
 * Create a tag inline — adds it to the settings tag list if it doesn't already exist.
 * Works from any page (editor, settings, dashboard).
 * @param {string} name - Full tag path (e.g. "Work/Projects/NewTag")
 * @param {object} [opts] - { color, fontColor, favorite }
 * @returns {Promise<boolean>} true if created, false if already exists or failed
 */
async function createTagInline(name, opts) {
  if (!name || !name.trim()) return false;
  name = name.trim();
  if (isReservedTagPrefix(name)) {
    console.warn('createTagInline blocked: reserved prefix', name);
    return false;
  }
  opts = opts || {};
  try {
    _invalidateSettingsCache();
    var settings = await getCachedSettings();
    var tags = Array.isArray(settings.tags) ? settings.tags : [];
    // Check if tag already exists (case-insensitive)
    var exists = tags.some(function (t) {
      return (t.name || '').toLowerCase() === name.toLowerCase();
    });
    if (exists) return false;
    tags.push({
      name: name,
      color: opts.color || '#d4c4b0',
      fontColor: opts.fontColor || '#5c3317',
      favorite: !!opts.favorite,
    });
    settings.tags = tags;
    var resp = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!resp.ok) return false;
    _invalidateSettingsCache();
    return true;
  } catch (e) {
    console.error('createTagInline failed:', e);
    return false;
  }
}


// ── Reserved tag prefix ──────────────────────────────────────────────────────

const RESERVED_TAG_PREFIX = 'cwoc_system/';
const RESERVED_TAG_ERROR = "Tags starting with 'CWOC_System/' are reserved for system use.";

/**
 * Check if a tag name uses the reserved CWOC_System/ prefix (case-insensitive).
 * @param {string} name - Tag name to check
 * @returns {boolean} true if the name starts with the reserved prefix
 */
function isReservedTagPrefix(name) {
  if (!name) return false;
  return name.toLowerCase().startsWith(RESERVED_TAG_PREFIX);
}

// ── System tags (auto-generated by backend, should not appear in user-facing tag lists) ──
const SYSTEM_TAGS = ['Calendar', 'Checklists', 'Alarms', 'Projects', 'Tasks', 'Notes'];

function isSystemTag(tagName) {
  if (!tagName) return false;
  // Match both old flat format and new CWOC_System/ prefix
  if (SYSTEM_TAGS.includes(tagName)) return true;
  if (tagName.startsWith('CWOC_System/')) return true;
  return false;
}

/**
 * Replace [[title]] patterns in text/HTML with links to matching chits.
 * Call AFTER marked.parse() so we operate on rendered HTML.
 * @param {string} html - rendered HTML string
 * @param {Array} allChits - array of chit objects with id and title
 * @returns {string} HTML with [[title]] replaced by <a> links
 */
function resolveChitLinks(html, allChits) {
  if (!html || !allChits) return html;
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    const lower = title.toLowerCase().trim();
    const found = allChits.find(c => c.title && c.title.toLowerCase().trim() === lower);
    if (found) {
      return `<a href="/frontend/html/editor.html?id=${found.id}" title="Open chit: ${found.title}" style="color:#4682b4;text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();">${found.title}</a>`;
    }
    return match; // leave as-is if no match
  });
}



// ═══════════════════════════════════════════════════════════════════════════
// Shared Tag Picker — reusable tag selection UI for editor zone & modals
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a full tag picker UI into a container element.
 * Matches the editor's tag zone: search row, favs/recents, tree, active tags.
 *
 * @param {HTMLElement} container — the DOM element to render into
 * @param {Array} selectedTags — array of selected tag name strings (mutated in place)
 * @param {Object} [opts] — options:
 *   onChange(selectedTags) — called when selection changes
 *   showHeader: bool (default false) — show Expand All / Collapse All / Create New buttons
 *   compact: bool (default false) — smaller font for modal use
 * @returns {Object} — { refresh(), getSelected() }
 */
function buildTagPicker(container, selectedTags, opts) {
  opts = opts || {};
  var onChange = opts.onChange || function() {};
  var allTags = [];
  var tree = [];

  container.innerHTML = '';

  // Search row
  var searchRow = document.createElement('div');
  searchRow.className = 'tags-search-row';
  searchRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;align-items:center;';

  var clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'clear-search-button';
  clearBtn.innerHTML = '<i class="fas fa-times"></i>';
  clearBtn.style.cssText = 'flex-shrink:0;padding:4px 8px;';
  clearBtn.onclick = function() { searchInput.value = ''; filterTree(''); searchInput.focus(); };
  searchRow.appendChild(clearBtn);

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search or type tag name...';
  searchInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid #8b5a2b;border-radius:4px;font-family:Lora,Georgia,serif;font-size:' + (opts.compact ? '0.85em' : '14px') + ';box-sizing:border-box;';
  searchInput.addEventListener('input', function() { filterTree(searchInput.value.trim().toLowerCase()); });
  searchRow.appendChild(searchInput);

  var addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
  addBtn.style.cssText = 'flex-shrink:0;padding:4px 10px;font-family:Lora,Georgia,serif;font-size:0.85em;background:#8b5a2b;color:#fff8e1;border:1px outset #6b4e31;border-radius:4px;cursor:pointer;';
  addBtn.onclick = function() {
    var name = searchInput.value.trim();
    if (!name) return;
    if (typeof isReservedTagPrefix === 'function' && isReservedTagPrefix(name)) {
      searchInput.style.borderColor = '#b22222';
      setTimeout(function() { searchInput.style.borderColor = ''; }, 2000);
      return;
    }
    if (selectedTags.indexOf(name) === -1) {
      selectedTags.push(name);
      if (typeof trackRecentTag === 'function') trackRecentTag(name);
    }
    if (typeof createTagInline === 'function') createTagInline(name);
    searchInput.value = '';
    loadAndRender();
    onChange(selectedTags);
  };
  searchRow.appendChild(addBtn);
  container.appendChild(searchRow);

  // Favs / Recents row
  var favRecentRow = document.createElement('div');
  favRecentRow.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px;align-items:center;';
  container.appendChild(favRecentRow);

  // Main layout: tree + active tags side by side
  var mainLayout = document.createElement('div');
  mainLayout.style.cssText = 'display:flex;gap:8px;';

  var treeWrap = document.createElement('div');
  treeWrap.style.cssText = 'flex:1;max-height:300px;overflow-y:auto;border:1px solid #c4a882;border-radius:4px;padding:4px;background:#fdf6e3;';
  mainLayout.appendChild(treeWrap);

  var activeWrap = document.createElement('div');
  activeWrap.style.cssText = 'min-width:120px;max-width:200px;border:1px solid #c4a882;border-radius:4px;padding:6px;background:#e8dcc8;';
  activeWrap.innerHTML = '<h3 style="margin:0 0 4px 0;font-size:0.85em;font-family:Lora,Georgia,serif;">Active Tags</h3>';
  var activeList = document.createElement('div');
  activeList.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';
  activeWrap.appendChild(activeList);
  mainLayout.appendChild(activeWrap);

  container.appendChild(mainLayout);

  function filterTree(q) {
    var labels = treeWrap.querySelectorAll('label');
    labels.forEach(function(lbl) {
      var text = (lbl.textContent || '').toLowerCase();
      lbl.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  }

  function renderFavsRecents() {
    favRecentRow.innerHTML = '';
    var favs = allTags.filter(function(t) { return t.favorite; });
    if (favs.length > 0) {
      var favLabel = document.createElement('span');
      favLabel.style.cssText = 'font-size:0.8em;font-weight:bold;color:#6b4e31;';
      favLabel.textContent = 'Favs:';
      favRecentRow.appendChild(favLabel);
      favs.forEach(function(tag) {
        var chip = document.createElement('span');
        var isSelected = selectedTags.indexOf(tag.name) !== -1;
        chip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:' + (tag.color || getPastelColor(tag.name)) + ';color:' + (tag.fontColor || '#2b1e0f') + ';' + (isSelected ? 'outline:2px solid #8b5a2b;' : '');
        chip.innerHTML = '<span style="color:#DAA520;text-shadow:0 0 1px #000;margin-right:2px;">★</span>' + _tagPickerEsc(tag.name.split('/').pop());
        chip.title = tag.name;
        chip.onclick = function() {
          var idx = selectedTags.indexOf(tag.name);
          if (idx === -1) { selectedTags.push(tag.name); if (typeof trackRecentTag === 'function') trackRecentTag(tag.name); }
          else selectedTags.splice(idx, 1);
          render();
          onChange(selectedTags);
        };
        favRecentRow.appendChild(chip);
      });
    }
    var recents = typeof getRecentTags === 'function' ? getRecentTags() : [];
    if (recents.length > 0) {
      var recLabel = document.createElement('span');
      recLabel.style.cssText = 'font-size:0.8em;font-weight:bold;color:#6b4e31;margin-left:8px;';
      recLabel.textContent = 'Recent:';
      favRecentRow.appendChild(recLabel);
      recents.forEach(function(path) {
        var tag = allTags.find(function(t) { return t.name === path; });
        if (!tag) return;
        var chip = document.createElement('span');
        var isSelected = selectedTags.indexOf(tag.name) !== -1;
        chip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:' + (tag.color || getPastelColor(tag.name)) + ';color:' + (tag.fontColor || '#2b1e0f') + ';' + (isSelected ? 'outline:2px solid #8b5a2b;' : '');
        chip.textContent = tag.name.split('/').pop();
        chip.title = tag.name;
        chip.onclick = function() {
          var idx = selectedTags.indexOf(tag.name);
          if (idx === -1) { selectedTags.push(tag.name); if (typeof trackRecentTag === 'function') trackRecentTag(tag.name); }
          else selectedTags.splice(idx, 1);
          render();
          onChange(selectedTags);
        };
        favRecentRow.appendChild(chip);
      });
    }
  }

  function renderActivePanel() {
    activeList.innerHTML = '';
    selectedTags.filter(function(t) { return !isSystemTag(t); }).forEach(function(tagName) {
      var tag = allTags.find(function(t) { return t.name === tagName; }) || { name: tagName, color: null };
      var chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:' + (tag.color || getPastelColor(tag.name)) + ';color:' + (tag.fontColor || '#2b1e0f') + ';padding:2px 8px;border-radius:4px;font-size:0.85em;margin:2px;';
      chip.textContent = tag.name;
      var removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.8em;padding:0 0 0 4px;line-height:1;';
      removeBtn.onclick = function(e) {
        e.stopPropagation();
        var idx = selectedTags.indexOf(tagName);
        if (idx !== -1) selectedTags.splice(idx, 1);
        render();
        onChange(selectedTags);
      };
      chip.appendChild(removeBtn);
      activeList.appendChild(chip);
    });
  }

  function render() {
    renderTagTree(treeWrap, tree, selectedTags, function(fullPath, isNowSelected) {
      var idx = selectedTags.indexOf(fullPath);
      if (isNowSelected && idx === -1) { selectedTags.push(fullPath); if (typeof trackRecentTag === 'function') trackRecentTag(fullPath); }
      else if (!isNowSelected && idx !== -1) selectedTags.splice(idx, 1);
      render();
      onChange(selectedTags);
    });
    renderFavsRecents();
    renderActivePanel();
  }

  function loadAndRender() {
    // getCachedSettings returns a Promise — use window._cwocSettings if already loaded
    var settings = window._cwocSettings;
    if (settings && settings.tags) {
      allTags = (settings.tags || []).map(function(t) { return typeof t === 'string' ? { name: t, color: null } : t; }).filter(function(t) { return t.name; });
      tree = buildTagTree(allTags);
      render();
    } else if (typeof getCachedSettings === 'function') {
      // Settings not loaded yet — fetch async then render
      var result = getCachedSettings();
      if (result && typeof result.then === 'function') {
        result.then(function(s) {
          allTags = ((s && s.tags) || []).map(function(t) { return typeof t === 'string' ? { name: t, color: null } : t; }).filter(function(t) { return t.name; });
          tree = buildTagTree(allTags);
          render();
        });
      }
    }
  }

  // Initial load
  loadAndRender();

  return {
    refresh: loadAndRender,
    getSelected: function() { return selectedTags.slice(); }
  };
}

/** Simple HTML escape for tag picker */
function _tagPickerEsc(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
