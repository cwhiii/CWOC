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

