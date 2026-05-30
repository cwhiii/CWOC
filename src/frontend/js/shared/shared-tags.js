/**
 * shared-tags.js — Tag tree utilities, filtering, and inline tag creation.
 *
 * Provides nested tag tree building, flattening, rendering as expandable
 * HTML trees, tag filter matching, recent tag tracking, inline tag creation,
 * system tag detection, and chit link resolution.
 *
 * Depends on: shared-utils.js (for getCachedSettings, _invalidateSettingsCache, getPastelColor)
 */

// ── Tag ID Registry Maps ─────────────────────────────────────────────────────
// Rebuilt on every settings load (page load + after any tag create/rename/delete).
// Used for all display resolution — users never see UUIDs.
var _tagIdToObj = {};   // "uuid" → {id, name, color, fontColor, favorite}
var _tagNameToId = {};  // "work/projects" (lowercase) → "uuid"

/**
 * Rebuild both tag lookup maps from the tags array.
 * Called after every settings load to keep maps in sync with the registry.
 * @param {Array} tags - Array of {id, name, color, fontColor, favorite} objects
 */
function _rebuildTagMaps(tags) {
  _tagIdToObj = {};
  _tagNameToId = {};
  if (!tags || !Array.isArray(tags)) return;
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    if (!tag) continue;
    // Map by ID if available
    if (tag.id) {
      _tagIdToObj[tag.id] = tag;
    }
    // Also map by name (as fallback key when tags don't have IDs)
    if (tag.name) {
      _tagNameToId[tag.name.toLowerCase()] = tag.id || tag.name;
      // Allow lookup by name as key too (for backward compat)
      if (!tag.id) {
        _tagIdToObj[tag.name] = tag;
      }
    }
  }
}

/**
 * Get the full tag object for a given Tag_ID.
 * @param {string} id - UUID of the tag
 * @returns {object|null} Tag object {id, name, color, fontColor, favorite} or null
 */
function getTagById(id) {
  if (!id) return null;
  return _tagIdToObj[id] || null;
}

/**
 * Get the Tag_ID for a given tag name (case-insensitive lookup).
 * Returns the UUID if available, or the tag name itself as a fallback key.
 * @param {string} name - Tag name (e.g. "Work/Projects")
 * @returns {string|null} UUID, tag name (fallback), or null if not found
 */
function getTagIdByName(name) {
  if (!name) return null;
  return _tagNameToId[name.toLowerCase()] || null;
}

/**
 * Resolve a Tag_ID to its display name.
 * Returns "[unknown tag]" if the ID is not found in the registry.
 * Handles both UUID-based IDs and name-based fallback keys.
 * @param {string} id - UUID of the tag or tag name (fallback)
 * @returns {string} Display name or "[unknown tag]"
 */
function resolveTagId(id) {
  if (!id) return '[unknown tag]';
  var tag = _tagIdToObj[id];
  if (tag && tag.name) return tag.name;
  // If the id itself looks like a tag name (not a UUID), return it directly
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return id; // It's a name string used as a key
  }
  // Unknown UUID tag — log warning
  console.warn('[Tags] Unknown tag ID: ' + id);
  return '[unknown tag]';
}

/**
 * POST to /api/settings with 401 retry. If the first attempt gets 401,
 * checks auth status and retries once. Redirects to login if truly expired.
 * @param {object} body - JSON body to send
 * @returns {Promise<Response>} the fetch response
 */
async function _postSettingsWithRetry(body) {
  var resp = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (resp.status === 401) {
    console.warn('[Tags] POST /api/settings got 401, checking auth...');
    var authResp = await fetch('/api/auth/me');
    if (authResp.status === 401) {
      localStorage.setItem('cwoc_auth_return', window.location.href);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    // Auth valid — retry
    resp = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return resp;
}

/**
 * Load the complete tag list from settings. This is the single source of truth
 * for building tag lists across the editor and sidebar. All code paths that add
 * tags to chits must also register them in settings — there should never be
 * tags on chits that aren't in this list.
 * @returns {Promise<Array>} Array of { name, color, favorite, fontColor } objects
 */
async function loadAllTags() {
  var tagObjects = [];
  try {
    var settings = await getCachedSettings();
    console.log('[shared-tags] loadAllTags: settings.tags type=', typeof settings.tags, 'isArray=', Array.isArray(settings.tags), 'length=', settings.tags ? (Array.isArray(settings.tags) ? settings.tags.length : 'N/A') : 'null/undefined');
    var tags = settings.tags ? (typeof settings.tags === 'string' ? JSON.parse(settings.tags) : settings.tags) : [];
    tagObjects = tags.map(function(t) {
      return typeof t === 'string' ? { name: t, color: null, favorite: false } : t;
    }).filter(function(t) { return t.name; });
  } catch (e) {
    console.error('loadAllTags: failed to load settings tags:', e);
  }

  // Filter out system tags
  tagObjects = tagObjects.filter(function(t) { return !isSystemTag(t.name); });

  // Rebuild ID lookup maps from the full tag list (including system tags for ID resolution)
  _rebuildTagMaps(tagObjects);

  return tagObjects;
}

/**
 * Build a nested tag tree from a flat array of tag objects.
 * @param {Array} flatTags - Array of { id, name, color, favorite, fontColor } objects
 * @returns {Array} Tree nodes: { id, name, fullPath, color, favorite, children: [] }
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
          id: isLeaf ? (tag.id || pathSoFar) : null,
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

  // Sort: favorites first, then alphabetically at every level
  function sortLevel(nodes) {
    nodes.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
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
 * Check if a chit's tags match any of the given filter Tag_IDs (OR logic).
 * Supports both the new format (tag objects [{id, name}]) and legacy format (name strings).
 *
 * Primary match: chit tag's id matches a filter Tag_ID exactly.
 * Hierarchical fallback: if a filter Tag_ID resolves to name "Work", also match
 * chit tags whose name starts with "Work/" (case-insensitive).
 *
 * @param {Array} chitTags - tags on the chit: [{id: "uuid"|null, name: "string"}] or legacy string[]
 * @param {string|string[]} filterTags - Tag_ID(s) to filter by (single string or array)
 * @returns {boolean} true if the chit matches ANY of the filter tags
 */
function matchesTagFilter(chitTags, filterTags) {
  if (!Array.isArray(chitTags)) return false;
  // Normalize filterTags to an array
  var filters = Array.isArray(filterTags) ? filterTags : [filterTags];
  if (filters.length === 0) return false;

  for (var fi = 0; fi < filters.length; fi++) {
    var filterId = filters[fi];
    if (!filterId) continue;

    // Resolve the filter Tag_ID to a display name for hierarchical matching
    var filterName = (typeof resolveTagId === 'function') ? resolveTagId(filterId) : null;
    var filterNameLower = (filterName && filterName !== '[unknown tag]') ? filterName.toLowerCase() : null;

    for (var ci = 0; ci < chitTags.length; ci++) {
      var chitTag = chitTags[ci];

      // Handle new format: {id, name} objects
      if (chitTag && typeof chitTag === 'object') {
        // Primary match: exact ID match
        if (chitTag.id && chitTag.id === filterId) return true;
        // Hierarchical fallback: chit tag name starts with filterName + "/"
        if (filterNameLower && chitTag.name) {
          var chitNameLower = chitTag.name.toLowerCase();
          if (chitNameLower === filterNameLower || chitNameLower.startsWith(filterNameLower + '/')) return true;
        }
      } else if (typeof chitTag === 'string') {
        // Legacy format: plain name strings — fall back to name-based matching
        if (filterNameLower) {
          var tagLower = chitTag.toLowerCase();
          if (tagLower === filterNameLower || tagLower.startsWith(filterNameLower + '/')) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Render a tag tree as an expandable/collapsible HTML tree.
 * @param {HTMLElement} container - element to render into
 * @param {Array} tree - from buildTagTree()
 * @param {string[]} selectedTags - currently selected Tag_IDs (UUID strings)
 * @param {function} onToggle - callback(tagId, isNowSelected) when a tag is toggled (passes Tag_ID)
 * @param {object} [opts] - { showFavorites: bool, onSelectOnly: function(tagId) }
 */
function renderTagTree(container, tree, selectedTags, onToggle, opts) {
  container.innerHTML = '';
  var onSelectOnly = (opts && opts.onSelectOnly) ? opts.onSelectOnly : null;
  var hideCheckboxes = (opts && opts.hideCheckboxes) ? true : false;

  function renderLevel(nodes, parentEl, depth) {
    nodes.forEach(node => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;justify-content:flex-start;gap:4px;padding:1px 0;padding-left:${depth * 16}px;cursor:pointer;`;
      row.dataset.tagRow = node.fullPath;

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

      // Checkbox — selection is by Tag_ID; intermediate nodes (id=null) can't be selected
      const nodeId = node.id || null;
      const isSelected = nodeId ? selectedTags.includes(nodeId) : false;
      var cb = null;
      if (!hideCheckboxes) {
        cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isSelected;
        cb.disabled = !nodeId; // Intermediate nodes without an ID can't be toggled
        cb.style.cssText = 'margin:0;cursor:pointer;flex-shrink:0;' + (!nodeId ? 'opacity:0.4;cursor:default;' : '');
        cb.addEventListener('click', (e) => { e.stopPropagation(); });
        cb.addEventListener('change', () => {
          if (!nodeId) { cb.checked = false; return; }
          if (onToggle) onToggle(nodeId, cb.checked);
          // Update badge visual
          badge.style.fontWeight = cb.checked ? 'bold' : '';
          badge.style.outline = cb.checked ? '2px solid #4a2c2a' : '';
        });
        row.appendChild(cb);
      } else {
        // No checkbox — just track nodeId for click handler
      }

      // Favorite star (inline before name)
      if (node.favorite) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.cssText = 'font-size:0.85em;flex-shrink:0;color:#DAA520;text-shadow:0 0 1px #000;';
        star.title = 'Favorite';
        row.appendChild(star);
      }

      // Tag name with color background — always shows tag name, never UUID
      const tagColor = node.color || (typeof getPastelColor === 'function' ? getPastelColor(node.fullPath) : 'rgba(139,90,43,0.15)');
      const tagFontColor = node.fontColor || '#3c2f2f';
      const badge = document.createElement('span');
      badge.textContent = node.name;
      badge.style.cssText = `font-size:0.85em;padding:1px 6px;border-radius:4px;background:${tagColor};color:${tagFontColor};white-space:nowrap;${isSelected ? 'font-weight:bold;outline:2px solid #4a2c2a;' : ''}`;
      row.appendChild(badge);

      // Click row to toggle; Shift+Click to select ONLY this tag
      row.addEventListener('click', (e) => {
        if (!nodeId) return; // Intermediate nodes can't be selected
        if (e.shiftKey && onSelectOnly) {
          // Shift+Click: select only this tag, deselect all others
          onSelectOnly(nodeId);
        } else if (cb) {
          // Normal click: toggle this tag's checkbox
          cb.checked = !cb.checked;
          if (onToggle) onToggle(nodeId, cb.checked);
          // Update badge visual
          badge.style.fontWeight = cb.checked ? 'bold' : '';
          badge.style.outline = cb.checked ? '2px solid #4a2c2a' : '';
        } else {
          // No checkbox mode — just call onToggle directly
          if (onToggle) onToggle(node.fullPath, true, nodeId);
        }
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

// Persistent recent tags — stored in user settings, synced across devices
let _recentTags = [];
let _recentTagsLoaded = false;

async function _loadRecentTags() {
  if (_recentTagsLoaded) return;
  try {
    var settings = await getCachedSettings();
    _recentTags = Array.isArray(settings.recent_tags) ? settings.recent_tags.slice(0, 5) : [];
    _recentTagsLoaded = true;
  } catch (e) { /* keep empty */ }
}

/**
 * Track a recently used tag by its Tag_ID (UUID).
 * Stores Tag_IDs in the recent tags list (max 5).
 * Removes any existing duplicate before inserting at front.
 * Persists to settings (recent_tags field).
 * @param {string} tagId — Tag_ID (UUID) to track
 */
function trackRecentTag(tagId) {
  if (!tagId) return;
  _recentTags = _recentTags.filter(t => t !== tagId);
  _recentTags.unshift(tagId);
  if (_recentTags.length > 5) _recentTags = _recentTags.slice(0, 5);
  // Persist to server (fire-and-forget)
  _saveRecentTags();
}

/**
 * Get the list of recently used Tag_IDs (UUIDs).
 * Callers resolve IDs to display names via getTagById() or resolveTagId().
 * @returns {string[]} Array of Tag_IDs (max 5)
 */
function getRecentTags() {
  return _recentTags.slice(0, 5);
}

var _recentTagsSaveTimer = null;
function _saveRecentTags() {
  // Debounce saves to avoid hammering the server
  if (_recentTagsSaveTimer) clearTimeout(_recentTagsSaveTimer);
  _recentTagsSaveTimer = setTimeout(function() {
    _postSettingsWithRetry({ recent_tags: _recentTags }).catch(function() {});
  }, 1000);
}

// Load recents on first use
_loadRecentTags();

/**
 * Create a tag inline — adds it to the settings tag list if it doesn't already exist.
 * Works from any page (editor, settings, dashboard).
 * Sends the tag name to the backend; the backend assigns a UUID.
 * After creation, rebuilds tag maps so the new ID is immediately available.
 * @param {string} name - Full tag path (e.g. "Work/Projects/NewTag")
 * @param {object} [opts] - { color, fontColor, favorite }
 * @returns {Promise<string|false>} the new tag's ID (UUID) if created, false if already exists or failed
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
    // Check if tag already exists (case-insensitive) — if so, return its existing ID
    var existingTag = tags.find(function (t) {
      return (t.name || '').toLowerCase() === name.toLowerCase();
    });
    if (existingTag) return existingTag.id || false;
    tags.push({
      name: name,
      color: opts.color || '#d4c4b0',
      fontColor: opts.fontColor || '#5c3317',
      favorite: !!opts.favorite,
    });
    // Send only the tags field (partial update) — backend assigns UUID to the new entry
    var resp = await _postSettingsWithRetry({ tags: tags });
    if (!resp.ok) {
      console.error('createTagInline: POST failed with status', resp.status);
      return false;
    }
    // Reload settings to get the backend-assigned ID
    _invalidateSettingsCache();
    var updatedSettings = await getCachedSettings();
    var updatedTags = Array.isArray(updatedSettings.tags) ? updatedSettings.tags : [];
    // Rebuild tag maps with the updated registry
    _rebuildTagMaps(updatedTags.filter(function(t) { return t.name && !isSystemTag(t.name); }));
    // Find the newly created tag by name and return its ID
    var newTag = updatedTags.find(function(t) {
      return (t.name || '').toLowerCase() === name.toLowerCase();
    });
    return (newTag && newTag.id) ? newTag.id : false;
  } catch (e) {
    console.error('createTagInline failed:', e);
    return false;
  }
}

/**
 * Update an existing tag in settings (rename, recolor, favorite).
 * Identifies the tag by its Tag_ID (UUID), not by name.
 * Also renames sub-tags if the name changed.
 * @param {string} tagId — Tag_ID (UUID) of the tag to update
 * @param {object} tagData — { name, color, fontColor, favorite }
 * @returns {Promise<boolean>} true if updated successfully
 */
async function updateTagInline(tagId, tagData) {
  if (!tagId || !tagData || !tagData.name) return false;
  try {
    _invalidateSettingsCache();
    var settings = await getCachedSettings();
    var tags = Array.isArray(settings.tags) ? settings.tags : [];
    var found = false;
    var oldName = '';
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].id === tagId) {
        oldName = tags[i].name || '';
        tags[i] = { id: tagId, name: tagData.name, color: tagData.color, fontColor: tagData.fontColor, favorite: !!tagData.favorite };
        found = true;
        // Rename sub-tags if name changed
        if (oldName && oldName !== tagData.name) {
          var prefix = oldName + '/';
          for (var j = 0; j < tags.length; j++) {
            if (j === i) continue;
            var subName = (typeof tags[j] === 'string') ? tags[j] : (tags[j].name || '');
            if (subName.toLowerCase().startsWith(prefix.toLowerCase())) {
              var newSubName = tagData.name + '/' + subName.substring(prefix.length);
              if (typeof tags[j] === 'string') { tags[j] = newSubName; }
              else { tags[j].name = newSubName; }
            }
          }
        }
        break;
      }
    }
    if (!found) return false;
    // Send only the tags field (partial update)
    var resp = await _postSettingsWithRetry({ tags: tags });
    if (!resp.ok) {
      console.error('updateTagInline: POST failed with status', resp.status);
      return false;
    }
    _invalidateSettingsCache();
    // Rebuild tag maps with updated data
    var updatedSettings = await getCachedSettings();
    var updatedTags = Array.isArray(updatedSettings.tags) ? updatedSettings.tags : [];
    _rebuildTagMaps(updatedTags.filter(function(t) { return t.name && !isSystemTag(t.name); }));
    return true;
  } catch (e) {
    console.error('updateTagInline failed:', e);
    return false;
  }
}

/**
 * Delete a tag (and all its sub-tags) from settings.
 * Identifies the tag by its Tag_ID (UUID), not by name.
 * @param {string} tagId — Tag_ID (UUID) of the tag to delete
 * @returns {Promise<boolean>} true if deleted successfully
 */
async function deleteTagInline(tagId) {
  if (!tagId) return false;
  try {
    _invalidateSettingsCache();
    var settings = await getCachedSettings();
    var tags = Array.isArray(settings.tags) ? settings.tags : [];
    // Find the tag to delete by ID to get its name for sub-tag removal
    var targetTag = tags.find(function(t) { return t.id === tagId; });
    if (!targetTag) return false;
    var tagName = targetTag.name || '';
    var prefix = tagName ? tagName + '/' : '';
    // Remove the tag and all its sub-tags (by name prefix)
    var updatedTags = tags.filter(function(t) {
      if (t.id === tagId) return false;
      if (prefix) {
        var tName = (typeof t === 'string') ? t : (t.name || '');
        if (tName.toLowerCase().startsWith(prefix.toLowerCase())) return false;
      }
      return true;
    });
    // Send only the tags field (partial update)
    var resp = await _postSettingsWithRetry({ tags: updatedTags });
    if (!resp.ok) {
      console.error('deleteTagInline: POST failed with status', resp.status);
      return false;
    }
    _invalidateSettingsCache();
    // Rebuild tag maps after deletion
    _rebuildTagMaps(updatedTags.filter(function(t) { return t.name && !isSystemTag(t.name); }));
    return true;
  } catch (e) {
    console.error('deleteTagInline failed:', e);
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
 * @param {Array} selectedTags — array of selected Tag_IDs (UUID strings, mutated in place)
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
    // Check if this tag already exists in the registry by name — if so, use its ID
    var existingId = (typeof getTagIdByName === 'function') ? getTagIdByName(name) : null;
    if (existingId) {
      if (selectedTags.indexOf(existingId) === -1) {
        selectedTags.push(existingId);
        if (typeof trackRecentTag === 'function') trackRecentTag(existingId);
      }
    } else {
      // New tag — add by name for now (createTagInline will register it; ID will be assigned by server)
      // Store the name temporarily; callers should handle mixed ID/name arrays during transition
      if (selectedTags.indexOf(name) === -1) {
        selectedTags.push(name);
        if (typeof trackRecentTag === 'function') trackRecentTag(name);
      }
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
        var tagId = tag.id || null;
        var chip = document.createElement('span');
        var isSelected = tagId ? selectedTags.indexOf(tagId) !== -1 : false;
        chip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:' + (tag.color || getPastelColor(tag.name)) + ';color:' + (tag.fontColor || '#2b1e0f') + ';' + (isSelected ? 'outline:2px solid #8b5a2b;' : '');
        chip.innerHTML = '<span style="color:#DAA520;text-shadow:0 0 1px #000;margin-right:2px;">★</span>' + _tagPickerEsc(tag.name.split('/').pop());
        chip.title = tag.name;
        chip.onclick = function() {
          if (!tagId) return; // Can't select a tag without an ID
          var idx = selectedTags.indexOf(tagId);
          if (idx === -1) { selectedTags.push(tagId); if (typeof trackRecentTag === 'function') trackRecentTag(tagId); }
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
      recents.forEach(function(tagIdOrPath) {
        // Recents may store Tag_IDs or legacy name strings — resolve to tag object
        var tag = null;
        if (typeof getTagById === 'function') tag = getTagById(tagIdOrPath);
        if (!tag) tag = allTags.find(function(t) { return t.name === tagIdOrPath; });
        if (!tag) return;
        var tagId = tag.id || null;
        var chip = document.createElement('span');
        var isSelected = tagId ? selectedTags.indexOf(tagId) !== -1 : false;
        chip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:' + (tag.color || getPastelColor(tag.name)) + ';color:' + (tag.fontColor || '#2b1e0f') + ';' + (isSelected ? 'outline:2px solid #8b5a2b;' : '');
        chip.textContent = tag.name.split('/').pop();
        chip.title = tag.name;
        chip.onclick = function() {
          if (!tagId) return;
          var idx = selectedTags.indexOf(tagId);
          if (idx === -1) { selectedTags.push(tagId); if (typeof trackRecentTag === 'function') trackRecentTag(tagId); }
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
    selectedTags.forEach(function(tagId) {
      // Resolve Tag_ID to display info via registry or allTags
      var tag = null;
      if (typeof getTagById === 'function') tag = getTagById(tagId);
      if (!tag) tag = allTags.find(function(t) { return t.id === tagId; });
      // Fallback: tagId might be a legacy name string during transition
      if (!tag) tag = allTags.find(function(t) { return t.name === tagId; });
      var displayName = tag ? tag.name : (typeof resolveTagId === 'function' ? resolveTagId(tagId) : tagId);
      var tagColor = tag ? (tag.color || getPastelColor(tag.name)) : 'rgba(139,90,43,0.15)';
      var tagFontColor = tag ? (tag.fontColor || '#2b1e0f') : '#2b1e0f';
      // Skip system tags from display
      if (typeof isSystemTag === 'function' && isSystemTag(displayName)) return;
      var chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:' + tagColor + ';color:' + tagFontColor + ';padding:2px 8px;border-radius:4px;font-size:0.85em;margin:2px;';
      chip.textContent = displayName;
      var removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:0.8em;padding:0 0 0 4px;line-height:1;';
      removeBtn.onclick = function(e) {
        e.stopPropagation();
        var idx = selectedTags.indexOf(tagId);
        if (idx !== -1) selectedTags.splice(idx, 1);
        render();
        onChange(selectedTags);
      };
      chip.appendChild(removeBtn);
      activeList.appendChild(chip);
    });
  }

  function render() {
    renderTagTree(treeWrap, tree, selectedTags, function(tagId, isNowSelected) {
      var idx = selectedTags.indexOf(tagId);
      if (isNowSelected && idx === -1) { selectedTags.push(tagId); if (typeof trackRecentTag === 'function') trackRecentTag(tagId); }
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
