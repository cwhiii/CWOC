/**
 * editor-tags.js — Tag tree rendering, search, and selection in the editor
 *
 * Handles loading tags from settings, rendering the tag tree with favorites
 * and recents, filtering by search, creating new tags inline, and navigating
 * to the settings page for tag management.
 *
 * Depends on: shared.js (getCachedSettings, setSaveButtonUnsaved, getPastelColor),
 *             shared-tags.js (buildTagTree, renderTagTree, trackRecentTag,
 *                             getRecentTags, createTagInline, isSystemTag)
 * Loaded before: editor-init.js, editor.js
 */

async function _loadTags() {
  try {
    return await loadAllTags();
  } catch (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
}

/**
 * Render tags from settings into the editor tag zone.
 * Populates the tag tree container and marks active tags.
 * @param {Array} tags - Array of {name, color} from settings
 * @param {Array} selectedTags - Array of tag name strings currently on the chit
 */
function _renderTags(tags, selectedTags = []) {
  const treeContainer = document.getElementById("tagTreeContainer");
  const activeContainer = document.getElementById("activeTagsListContainer");
  const activeCount = document.getElementById("activeTagsCount");
  const favContainer = document.getElementById("favTags");
  const recentContainer = document.getElementById("mostRecentTags");

  if (!treeContainer || !activeContainer) {
    console.warn("Tag zone containers not found");
    return;
  }

  if (!tags || tags.length === 0) {
    treeContainer.innerHTML = '<p style="font-size:0.85em;opacity:0.6;">No tags defined. Create tags in Settings.</p>';
    if (activeCount) activeCount.textContent = "0";
    if (favContainer) favContainer.innerHTML = "";
    if (recentContainer) recentContainer.innerHTML = "";
    return;
  }

  // Build nested tree and render
  const tree = buildTagTree(tags);
  renderTagTree(treeContainer, tree, selectedTags, (fullPath, isNowSelected) => {
    const idx = selectedTags.indexOf(fullPath);
    if (isNowSelected && idx === -1) {
      selectedTags.push(fullPath);
      trackRecentTag(fullPath);
      // Auto-color: if chit color is transparent and this is the first non-system tag, apply tag color
      const colorInput = document.getElementById('color');
      if (colorInput && (!colorInput.value || colorInput.value === 'transparent')) {
        const tagObj = tags.find(t => t.name === fullPath);
        if (tagObj && tagObj.color && !isSystemTag(fullPath)) {
          _setColor(tagObj.color, fullPath.split('/').pop());
        }
      }
    } else if (!isNowSelected && idx !== -1) {
      selectedTags.splice(idx, 1);
    }
    _renderTags(tags, selectedTags);
    setSaveButtonUnsaved();
  });

  // Favorites row
  if (favContainer) {
    favContainer.innerHTML = "";
    tags.filter(t => t.favorite).forEach(tag => {
      const chip = document.createElement("span");
      chip.style.cssText = `display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:${tag.color || getPastelColor(tag.name)};color:${tag.fontColor || '#2b1e0f'};${selectedTags.includes(tag.name) ? 'outline:2px solid #8b5a2b;' : ''}`;
      chip.textContent = "";
      const star = document.createElement('span');
      star.textContent = '★';
      star.style.cssText = 'color:#DAA520;text-shadow:0 0 1px #000;margin-right:2px;';
      chip.appendChild(star);
      chip.appendChild(document.createTextNode(tag.name.split('/').pop()));
      chip.title = tag.name;
      chip.addEventListener("click", () => {
        const idx = selectedTags.indexOf(tag.name);
        if (idx === -1) { selectedTags.push(tag.name); trackRecentTag(tag.name); }
        else selectedTags.splice(idx, 1);
        _renderTags(tags, selectedTags);
        setSaveButtonUnsaved();
      });
      favContainer.appendChild(chip);
    });
  }

  // Recent row
  if (recentContainer) {
    recentContainer.innerHTML = "";
    const recents = getRecentTags();
    recents.forEach(path => {
      const tag = tags.find(t => t.name === path);
      if (!tag) return;
      const chip = document.createElement("span");
      chip.style.cssText = `display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;cursor:pointer;margin:1px;background:${tag.color || getPastelColor(tag.name)};color:${tag.fontColor || '#2b1e0f'};${selectedTags.includes(tag.name) ? 'outline:2px solid #8b5a2b;' : ''}`;
      chip.textContent = tag.name.split('/').pop();
      chip.title = tag.name;
      chip.addEventListener("click", () => {
        const idx = selectedTags.indexOf(tag.name);
        if (idx === -1) { selectedTags.push(tag.name); trackRecentTag(tag.name); }
        else selectedTags.splice(idx, 1);
        _renderTags(tags, selectedTags);
        setSaveButtonUnsaved();
      });
      recentContainer.appendChild(chip);
    });
  }

  // Render active tags panel (exclude system tags)
  activeContainer.innerHTML = "";
  selectedTags.filter(t => !isSystemTag(t)).forEach(tagName => {
    const tag = tags.find(t => t.name === tagName) || { name: tagName, color: null };
    const chip = document.createElement("span");
    const chipFg = tag.fontColor || '#2b1e0f';
    chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;background:${tag.color || getPastelColor(tag.name)};color:${chipFg};padding:2px 8px;border-radius:4px;font-size:0.9em;margin:2px;cursor:pointer;`;
    chip.textContent = tag.name;
    chip.title = 'Click to edit tag';

    chip.addEventListener("click", (e) => {
      if (e.target.tagName === 'BUTTON') return;
      editTag(e, tagName);
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "background:none;border:none;cursor:pointer;font-size:0.8em;padding:0 0 0 4px;line-height:1;";
    removeBtn.title = 'Remove from chit';
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = selectedTags.indexOf(tagName);
      if (idx !== -1) selectedTags.splice(idx, 1);
      _renderTags(tags, selectedTags);
      setSaveButtonUnsaved();
    });

    chip.appendChild(removeBtn);
    activeContainer.appendChild(chip);
  });

  if (activeCount) activeCount.textContent = selectedTags.filter(t => !isSystemTag(t)).length;
  window._currentTagSelection = selectedTags;
}

/** Expand or collapse all tag tree nodes */
function toggleAllTags(event, expand) {
  if (event) event.stopPropagation();
  const container = document.getElementById('tagTreeContainer');
  if (!container) return;
  // Toggle all child containers
  container.querySelectorAll('[data-tag-children]').forEach(el => {
    el.style.display = expand ? '' : 'none';
  });
  // Update all toggle arrows
  container.querySelectorAll('[data-tag-toggle]').forEach(el => {
    el.textContent = expand ? '▼' : '▶';
  });
}

var _tagsAllExpanded = true;

function _toggleTagsExpandCollapse(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _tagsAllExpanded = !_tagsAllExpanded;
  toggleAllTags(null, _tagsAllExpanded);
  _updateTagsExpandCollapseBtn();
}

function _updateTagsExpandCollapseBtn() {
  var btn = document.getElementById('tags-expand-collapse-btn');
  if (!btn) return;
  if (_tagsAllExpanded) {
    btn.innerHTML = '<i class="fas fa-compress-alt"></i><span class="hideWhenNarrow">Collapse</span>';
    btn.title = 'Collapse all tag groups';
  } else {
    btn.innerHTML = '<i class="fas fa-expand-alt"></i><span class="hideWhenNarrow">Expand</span>';
    btn.title = 'Expand all tag groups';
  }
}

/** Create a new tag — open the shared tag modal */
function createTag(event) {
  if (event) event.stopPropagation();
  cwocTagModal.open(null, {
    onSave: function(tagData) {
      // Add the new tag to the current selection
      if (!window._currentTagSelection) window._currentTagSelection = [];
      if (window._currentTagSelection.indexOf(tagData.name) === -1) {
        window._currentTagSelection.push(tagData.name);
        if (typeof trackRecentTag === 'function') trackRecentTag(tagData.name);
      }
      // Refresh the tag tree
      _invalidateSettingsCache();
      _loadTags().then(function(tags) { _renderTags(tags, window._currentTagSelection); });
      setSaveButtonUnsaved();
    },
  });
}

/** Edit an existing tag — open the shared tag modal for editing */
function editTag(event, tagName) {
  if (event) event.stopPropagation();
  cwocTagModal.open(tagName, {
    onSave: function(tagData, oldName) {
      // If renamed, update the selection
      if (oldName && oldName !== tagData.name && window._currentTagSelection) {
        var idx = window._currentTagSelection.indexOf(oldName);
        if (idx !== -1) window._currentTagSelection[idx] = tagData.name;
      }
      _invalidateSettingsCache();
      _loadTags().then(function(tags) { _renderTags(tags, window._currentTagSelection); });
      setSaveButtonUnsaved();
    },
    onDelete: function(tagName) {
      // Remove from selection if present
      if (window._currentTagSelection) {
        var idx = window._currentTagSelection.indexOf(tagName);
        if (idx !== -1) window._currentTagSelection.splice(idx, 1);
      }
      _invalidateSettingsCache();
      _loadTags().then(function(tags) { _renderTags(tags, window._currentTagSelection); });
      setSaveButtonUnsaved();
    },
  });
}

/** Clear the tag search input */
function clearTagSearch(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('labels');
  if (input) { input.value = ''; _filterTagTree(''); input.focus(); }
}

/** Filter the tag tree in realtime — hides non-matching rows and their parent groups */
function _filterTagTree(query) {
  const container = document.getElementById('tagTreeContainer');
  if (!container) return;
  const q = (query || '').trim().toLowerCase();

  // Each tag row has data-tag-row="fullPath". Child containers have data-tag-children.
  const allRows = container.querySelectorAll('[data-tag-row]');
  const childContainers = container.querySelectorAll('[data-tag-children]');

  if (!q) {
    // No filter — show everything
    allRows.forEach(function(row) { row.style.display = ''; });
    childContainers.forEach(function(cc) { cc.style.display = ''; });
    return;
  }

  // Hide all rows first, then show matches
  allRows.forEach(function(row) { row.style.display = 'none'; });
  childContainers.forEach(function(cc) { cc.style.display = 'none'; });

  // Show rows whose full path matches the query
  allRows.forEach(function(row) {
    var path = (row.dataset.tagRow || '').toLowerCase();
    if (path.includes(q)) {
      row.style.display = '';
      // Also show all ancestor containers so the row is visible
      var parent = row.parentElement;
      while (parent && parent !== container) {
        if (parent.dataset && parent.dataset.tagChildren !== undefined) {
          parent.style.display = '';
        }
        // Show the parent group's header row too
        if (parent.previousElementSibling && parent.previousElementSibling.dataset && parent.previousElementSibling.dataset.tagRow !== undefined) {
          parent.previousElementSibling.style.display = '';
        }
        parent = parent.parentElement;
      }
    }
  });
}

function navigateToSettings() {
  localStorage.setItem('cwoc_settings_return', window.location.href);
  window.location.href = "/frontend/html/settings.html";
}
