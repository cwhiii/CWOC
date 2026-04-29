/**
 * editor-people.js — People zone: contact search, chips, and grouped tree
 *
 * Loads all contacts from the API, renders them in a grouped alphabetical tree,
 * manages people chips (add/remove), syncs the hidden people field for save,
 * and provides search/filter within the people tree.
 *
 * Depends on: shared.js (setSaveButtonUnsaved, isLightColor)
 * Loaded before: editor-init.js, editor.js
 */

var _peopleDropdown = null;
var _peopleDebounceTimer = null;
var _peopleApiAvailable = true;
var _peopleChipData = []; // Array of {display_name, id, color, image_url}
var _allContactsCache = []; // Full contacts list for the tree
var _peopleGroupsExpanded = {}; // Track which letter groups are expanded

function _focusPeopleSearch() {
  var input = document.getElementById('peopleSearchInput');
  if (input) input.focus();
}

function _initPeopleAutocomplete() {
  _loadAllContactsForTree();

  const input = document.getElementById('peopleSearchInput');
  if (!input) return;

  input.addEventListener('input', function () {
    _filterPeopleTree(input.value.trim().toLowerCase());
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      _filterPeopleTree('');
      input.blur();
    }
  });
}

function _clearPeopleSearch(event) {
  if (event) event.stopPropagation();
  var input = document.getElementById('peopleSearchInput');
  if (input) { input.value = ''; _filterPeopleTree(''); }
}

async function _loadAllContactsForTree() {
  try {
    var resp = await fetch('/api/contacts');
    if (!resp.ok) return;
    _allContactsCache = await resp.json();
    _renderPeopleTree();
    // Re-render chips to pick up colors/images if chips were loaded before cache
    if (_peopleChipData.length > 0) {
      var contactMap = {};
      _allContactsCache.forEach(function (c) {
        contactMap[(c.display_name || '').toLowerCase()] = c;
      });
      _peopleChipData.forEach(function (chip) {
        var match = contactMap[(chip.display_name || '').toLowerCase()];
        if (match) {
          chip.color = match.color || chip.color;
          chip.image_url = match.image_url || chip.image_url;
          chip.id = match.id || chip.id;
        }
      });
      _renderPeopleChips();
    }
  } catch (e) {
    console.error('[People] Failed to load contacts for tree:', e);
  }
}

function _renderPeopleTree(filter) {
  var container = document.getElementById('peopleTreeContainer');
  if (!container) return;
  container.innerHTML = '';

  var contacts = _allContactsCache;
  if (filter) {
    contacts = contacts.filter(function (c) {
      return (c.display_name || '').toLowerCase().includes(filter);
    });
  }

  // Group by first letter of given_name
  var groups = {};
  contacts.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });

  var letters = Object.keys(groups).sort();
  // Sort each group: favorites first, then alphabetical
  letters.forEach(function (letter) {
    groups[letter].sort(function (a, b) {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (a.display_name || '').localeCompare(b.display_name || '');
    });
  });
  letters.forEach(function (letter) {
    var isExpanded = _peopleGroupsExpanded[letter] !== false; // default expanded

    var groupDiv = document.createElement('div');
    groupDiv.className = 'people-tree-group';
    groupDiv.dataset.letter = letter;

    var header = document.createElement('div');
    header.className = 'people-tree-group-header';
    header.style.cssText = 'cursor:pointer;font-weight:bold;font-size:0.85em;color:#6b4e31;padding:2px 0;user-select:none;display:flex;align-items:center;gap:4px;';
    header.innerHTML = '<span class="people-tree-arrow">' + (isExpanded ? '▼' : '▶') + '</span> ' + letter + ' <span style="opacity:0.5;font-weight:normal;">(' + groups[letter].length + ')</span>';
    header.addEventListener('click', function () {
      _peopleGroupsExpanded[letter] = !isExpanded;
      _renderPeopleTree(filter);
    });
    groupDiv.appendChild(header);

    if (isExpanded) {
      groups[letter].forEach(function (c) {
        var isActive = _peopleChipData.some(function (p) {
          return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase();
        });

        var chip = document.createElement('span');
        chip.className = 'people-chip' + (isActive ? ' people-chip-active' : '');
        chip.style.margin = '2px 0 2px 12px';
        if (c.color) {
          chip.style.backgroundColor = c.color;
          chip.style.color = _isLightColor(c.color) ? '#2b1e0f' : '#fff';
          chip.style.borderColor = c.color;
        }
        if (isActive) {
          chip.style.opacity = '0.5';
        }

        // Thumbnail on left edge
        var thumbEl = document.createElement('span');
        thumbEl.className = 'chip-thumb';
        if (c.image_url) {
          thumbEl.innerHTML = '<img src="' + c.image_url + '" />';
        } else {
          thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
        }
        chip.appendChild(thumbEl);

        var nameSpan = document.createElement('span');
        var starPrefix = c.favorite ? '★ ' : '';
        nameSpan.textContent = starPrefix + (c.display_name || c.given_name || '(unnamed)');
        chip.appendChild(nameSpan);

        chip.addEventListener('click', function () {
          if (isActive) {
            var idx = _peopleChipData.findIndex(function (p) { return p.display_name.toLowerCase() === (c.display_name || '').toLowerCase(); });
            if (idx >= 0) _removePeopleChip(idx);
          } else {
            _addPeopleChip({ display_name: c.display_name, id: c.id, color: c.color || null, image_url: c.image_url || null });
          }
        });

        groupDiv.appendChild(chip);
      });
    }

    container.appendChild(groupDiv);
  });

  if (letters.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.85em;padding:8px;">No contacts found.</div>';
  }
}

function _filterPeopleTree(query) {
  _renderPeopleTree(query || undefined);
}

function _toggleAllPeopleGroups(event, expand) {
  if (event) event.stopPropagation();
  var letters = Object.keys(_peopleGroupsExpanded);
  // Also include all letters from current cache
  _allContactsCache.forEach(function (c) {
    var letter = ((c.given_name || c.display_name || '?')[0] || '?').toUpperCase();
    if (!_peopleGroupsExpanded.hasOwnProperty(letter)) _peopleGroupsExpanded[letter] = true;
  });
  Object.keys(_peopleGroupsExpanded).forEach(function (k) {
    _peopleGroupsExpanded[k] = expand;
  });
  _renderPeopleTree();
}

function _addPeopleChip(data) {
  if (_peopleChipData.some(function (c) { return c.display_name.toLowerCase() === data.display_name.toLowerCase(); })) return;
  _peopleChipData.push(data);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  _renderPeopleTree(); // update checkboxes
  setSaveButtonUnsaved();
}

function _removePeopleChip(index) {
  _peopleChipData.splice(index, 1);
  _renderPeopleChips();
  _syncPeopleHiddenField();
  _updateActivePeopleCount();
  _renderPeopleTree(); // update checkboxes
  setSaveButtonUnsaved();
}

function _renderPeopleChips() {
  var container = document.getElementById('peopleChips');
  if (!container) return;
  container.innerHTML = '';
  _peopleChipData.forEach(function (data, idx) {
    var chip = document.createElement('span');
    chip.className = 'people-chip';
    if (data.color) {
      chip.style.backgroundColor = data.color;
      chip.style.color = _isLightColor(data.color) ? '#2b1e0f' : '#fff';
      chip.style.borderColor = data.color;
    }

    // Thumbnail on left edge
    var thumbEl = document.createElement('span');
    thumbEl.className = 'chip-thumb';
    if (data.image_url) {
      thumbEl.innerHTML = '<img src="' + data.image_url + '" />';
    } else {
      thumbEl.innerHTML = '<span class="chip-thumb-placeholder">?</span>';
    }
    chip.appendChild(thumbEl);

    var nameSpan = document.createElement('span');
    nameSpan.textContent = data.display_name;
    chip.appendChild(nameSpan);

    // Double-click opens contact editor
    if (data.id) {
      chip.title = 'Double-click to edit contact';
      chip.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        window.open('/frontend/html/contact-editor.html?id=' + encodeURIComponent(data.id), '_blank');
      });
    }

    var removeX = document.createElement('span');
    removeX.className = 'chip-remove';
    removeX.textContent = '✕';
    removeX.title = 'Remove';
    removeX.addEventListener('click', function (e) {
      e.stopPropagation();
      _removePeopleChip(idx);
    });
    chip.appendChild(removeX);
    container.appendChild(chip);
  });
}

function _syncPeopleHiddenField() {
  var hidden = document.getElementById('people');
  if (hidden) {
    hidden.value = _peopleChipData.map(function (c) { return c.display_name; }).join(', ');
  }
}

function _updateActivePeopleCount() {
  var el = document.getElementById('activePeopleCount');
  if (el) el.textContent = _peopleChipData.length;
}

// _isLightColor moved to shared.js as isLightColor()
function _isLightColor(hex) { return isLightColor(hex); }

// Populate chips from a chit's people array (called from loadChitData)
function _setPeopleFromArray(peopleArray) {
  _peopleChipData = [];
  if (!peopleArray || !peopleArray.length) {
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
    return;
  }

  function _buildChips() {
    var contactMap = {};
    (_allContactsCache || []).forEach(function (c) {
      contactMap[(c.display_name || '').toLowerCase()] = c;
    });
    _peopleChipData = [];
    peopleArray.forEach(function (name) {
      var match = contactMap[name.toLowerCase()];
      _peopleChipData.push({
        display_name: name,
        id: match ? match.id : null,
        color: match ? (match.color || null) : null,
        image_url: match ? (match.image_url || null) : null
      });
    });
    _renderPeopleChips();
    _updateActivePeopleCount();
    _renderPeopleTree();
  }

  // If cache is empty, fetch first then build
  if (!_allContactsCache || _allContactsCache.length === 0) {
    fetch('/api/contacts').then(function (r) { return r.ok ? r.json() : []; }).then(function (contacts) {
      _allContactsCache = contacts;
      _buildChips();
    }).catch(function () { _buildChips(); });
  } else {
    _buildChips();
  }
}

document.addEventListener('DOMContentLoaded', _initPeopleAutocomplete);
