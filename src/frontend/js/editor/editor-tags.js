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
    chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;background:${tag.color || getPastelColor(tag.name)};color:${chipFg};padding:2px 8px;border-radius:4px;font-size:0.9em;margin:2px;`;
    chip.textContent = tag.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = "background:none;border:none;cursor:pointer;font-size:0.8em;padding:0 0 0 4px;line-height:1;";
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

/** Create a new tag — navigate to settings tag editor */
function createTag(event) {
  if (event) event.stopPropagation();
  navigateToSettings();
}

/** Clear the tag search input */
function clearTagSearch(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('labels');
  if (input) { input.value = ''; _filterTagTree(''); input.focus(); }
}

/** Filter the tag tree by search text — hides non-matching items */
function _filterTagTree(query) {
  const container = document.getElementById('tagTreeContainer');
  if (!container) return;
  const q = (query || '').toLowerCase();
  // Find all label elements (each tag row is a label with a checkbox)
  const labels = container.querySelectorAll('label');
  labels.forEach(function (lbl) {
    var text = (lbl.textContent || '').toLowerCase();
    lbl.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
  // Show/hide group headers (divs that contain the group name)
  const groups = container.querySelectorAll('.tag-group-header, [data-tag-group]');
  groups.forEach(function (g) {
    // Show group if any child label is visible
    var parent = g.closest('.tag-group') || g.parentElement;
    if (parent) {
      var visibleLabels = parent.querySelectorAll('label:not([style*="display: none"])');
      if (g.classList.contains('tag-group-header') || g.hasAttribute('data-tag-group')) {
        g.style.display = visibleLabels.length > 0 ? '' : 'none';
      }
    }
  });
}

/** Add a tag by name from the search input */
function addSearchedTag(event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('labels');
  if (!input) return;
  const tagName = input.value.trim();
  if (!tagName) return;

  // Block reserved CWOC_System/ prefix
  if (typeof isReservedTagPrefix === 'function' && isReservedTagPrefix(tagName)) {
    input.style.borderColor = '#b22222';
    var errEl = document.getElementById('tag-reserved-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'tag-reserved-error';
      errEl.style.cssText = 'color:#b22222;font-size:0.85em;margin-top:4px;';
      input.parentNode.insertBefore(errEl, input.nextSibling);
    }
    errEl.textContent = RESERVED_TAG_ERROR;
    setTimeout(function() {
      input.style.borderColor = '';
      if (errEl) errEl.textContent = '';
    }, 3000);
    return;
  }

  // Add to current selection
  if (!window._currentTagSelection) window._currentTagSelection = [];
  if (!window._currentTagSelection.includes(tagName)) {
    window._currentTagSelection.push(tagName);
    if (typeof trackRecentTag === 'function') trackRecentTag(tagName);
  }
  input.value = '';

  // Persist the tag to settings if it's new
  if (typeof createTagInline === 'function') {
    createTagInline(tagName);
  }

  // Re-render tags
  _loadTags().then(tags => _renderTags(tags, window._currentTagSelection));
  setSaveButtonUnsaved();
}

function navigateToSettings() {
  localStorage.setItem('cwoc_settings_return', window.location.href);
  if (window._cwocSave && window._cwocSave.hasChanges()) {
    cwocConfirm("You have unsaved changes. Leave without saving?", { title: 'Unsaved Changes', confirmLabel: 'Leave', danger: true }).then(function(ok) {
      if (ok) window.location.href = "/frontend/html/settings.html";
    });
  } else {
    window.location.href = "/frontend/html/settings.html";
  }
}
