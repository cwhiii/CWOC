/**
 * main-search.js — Global search overlay for the dashboard.
 *
 * Contains:
 *   - Search view (displaySearchView)
 *   - Search results rendering (_renderSearchResults)
 *   - Field value extraction (_getChitFieldValue)
 *   - Saved searches (_saveSearch, _loadSavedSearch, _deleteSavedSearch, _renderSavedSearches)
 *   - Text highlighting (highlightMatch)
 *
 * Depends on globals from main.js: _globalSearchResults, _globalSearchQuery
 * Depends on main-views.js: _buildChitHeader, chitColor, _applyMultiSelectFilters,
 *   _applyArchiveFilter, applyChitColors, storePreviousState
 */
async function displaySearchView() {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;
  chitList.innerHTML = '';

  var _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Search bar area
  var searchBar = document.createElement('div');
  searchBar.className = 'global-search-bar';

  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'global-search-input';
  input.placeholder = 'Search all chits…';
  input.value = _globalSearchQuery || '';

  var goBtn = document.createElement('button');
  goBtn.className = 'action-button';
  goBtn.textContent = 'Go';
  goBtn.style.cssText = 'flex-shrink:0;';

  searchBar.appendChild(input);
  searchBar.appendChild(goBtn);
  chitList.appendChild(searchBar);

  // Results container
  var resultsContainer = document.createElement('div');
  resultsContainer.className = 'global-search-results';
  chitList.appendChild(resultsContainer);

  // Execute search function
  async function executeSearch() {
    var q = input.value.trim();
    _globalSearchQuery = q;
    if (!q) {
      _globalSearchResults = [];
      resultsContainer.innerHTML = '';
      return;
    }
    try {
      var resp = await fetch('/api/chits/search?q=' + encodeURIComponent(q));
      if (!resp.ok) throw new Error('Search failed (HTTP ' + resp.status + ')');
      var data = await resp.json();
      _globalSearchResults = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Global search error:', err);
      resultsContainer.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.8;color:#b22222;"><p>⚠ ' + (err.message || 'Search failed') + '</p></div>';
      return;
    }
    _renderSearchResults(resultsContainer, _viSettings);
  }

  // Wire up Go button and Enter key
  goBtn.addEventListener('click', executeSearch);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); executeSearch(); }
  });

  // If we already have results (re-rendering after filter change), show them
  if (_globalSearchResults.length > 0 && _globalSearchQuery) {
    _renderSearchResults(resultsContainer, _viSettings);
  }

  // Auto-focus the search input only if user isn't typing in the sidebar filter
  var activeEl = document.activeElement;
  var isSidebarFocused = activeEl && (activeEl.id === 'search' || activeEl.closest('.sidebar'));
  if (!isSidebarFocused) {
    setTimeout(function() { input.focus(); }, 50);
  }
}

/**
 * Render search result cards into the given container.
 * Applies sidebar filters before rendering.
 */
function _renderSearchResults(container, viSettings) {
  container.innerHTML = '';
  var q = _globalSearchQuery;

  // Extract chit objects and apply sidebar filters
  var resultChits = _globalSearchResults.map(function(r) {
    var c = r.chit;
    c._matchedFields = r.matched_fields || [];
    return c;
  });
  resultChits = _applyMultiSelectFilters(resultChits);
  resultChits = _applyArchiveFilter(resultChits);

  // Apply sidebar text filter
  var sidebarText = (document.getElementById('search')?.value || '').toLowerCase();
  if (sidebarText) {
    resultChits = resultChits.filter(function(c) {
      if (c.title && c.title.toLowerCase().includes(sidebarText)) return true;
      if (c.note && c.note.toLowerCase().includes(sidebarText)) return true;
      if (Array.isArray(c.tags) && c.tags.some(function(t) { return t.toLowerCase().includes(sidebarText); })) return true;
      if (c.status && c.status.toLowerCase().includes(sidebarText)) return true;
      if (Array.isArray(c.people) && c.people.some(function(p) { return p.toLowerCase().includes(sidebarText); })) return true;
      if (c.location && c.location.toLowerCase().includes(sidebarText)) return true;
      if (c.priority && c.priority.toLowerCase().includes(sidebarText)) return true;
      return false;
    });
  }

  if (resultChits.length === 0) {
    container.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;"><p style="font-size:1.1em;">No results found.</p></div>';
    return;
  }

  resultChits.forEach(function(chit) {
    var card = document.createElement('div');
    card.className = 'chit-card global-search-result-card';
    card.dataset.chitId = chit.id;
    applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.archived) card.classList.add('archived-chit');
    card.style.cursor = 'pointer';

    // Title row via _buildChitHeader
    var titleHtml = highlightMatch(chit.title || '(Untitled)', q);
    card.appendChild(_buildChitHeader(chit, titleHtml, viSettings));

    // Matched fields with highlighted excerpts
    var matchedFields = chit._matchedFields || [];
    if (matchedFields.length > 0) {
      var fieldsDiv = document.createElement('div');
      fieldsDiv.className = 'global-search-matched-fields';

      matchedFields.forEach(function(fieldName) {
        var value = _getChitFieldValue(chit, fieldName);
        if (!value) return;

        var fieldRow = document.createElement('div');

        var label = document.createElement('span');
        label.textContent = fieldName + ':';
        fieldRow.appendChild(label);

        var excerpt = document.createElement('span');
        // Truncate long values for display
        var displayVal = value.length > 200 ? value.substring(0, 200) + '…' : value;
        excerpt.innerHTML = highlightMatch(displayVal, q);
        fieldRow.appendChild(excerpt);

        fieldsDiv.appendChild(fieldRow);
      });
      card.appendChild(fieldsDiv);
    }

    // Click handler: navigate to editor
    card.addEventListener('click', function() {
      storePreviousState();
      window.location.href = '/frontend/editor.html?id=' + chit.id;
    });

    container.appendChild(card);
  });
}

/**
 * Extract a displayable string value for a chit field by name.
 */
function _getChitFieldValue(chit, fieldName) {
  switch (fieldName) {
    case 'title': return chit.title || '';
    case 'note': return chit.note || '';
    case 'tags':
      var tags = chit.tags || [];
      return Array.isArray(tags) ? tags.join(', ') : String(tags);
    case 'status': return chit.status || '';
    case 'priority': return chit.priority || '';
    case 'severity': return chit.severity || '';
    case 'location': return chit.location || '';
    case 'people':
      var people = chit.people || [];
      return Array.isArray(people) ? people.join(', ') : String(people);
    case 'checklist':
      var cl = chit.checklist || [];
      if (Array.isArray(cl)) return cl.map(function(item) { return typeof item === 'object' ? (item.text || '') : String(item); }).join(', ');
      return String(cl);
    case 'color': return chit.color || '';
    case 'start_datetime': return chit.start_datetime || '';
    case 'end_datetime': return chit.end_datetime || '';
    case 'due_datetime': return chit.due_datetime || '';
    case 'created_datetime': return chit.created_datetime || '';
    case 'modified_datetime': return chit.modified_datetime || '';
    case 'alerts':
      var alerts = chit.alerts || [];
      if (Array.isArray(alerts)) return alerts.map(function(a) { return typeof a === 'object' ? (a.description || a.label || JSON.stringify(a)) : String(a); }).join(', ');
      return String(alerts);
    default: return chit[fieldName] != null ? String(chit[fieldName]) : '';
  }
}

// ═══════════════ END GLOBAL SEARCH ═══════════════

// ── Saved Searches ───────────────────────────────────────────────────────────
function _saveSearch() {
  const search = document.getElementById('search')?.value?.trim();
  if (!search) return;
  const saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  if (saved.includes(search)) return;
  saved.push(search);
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _loadSavedSearch(text) {
  const input = document.getElementById('search');
  if (input) { input.value = text; searchChits(); }
}

function _deleteSavedSearch(text) {
  let saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  saved = saved.filter(s => s !== text);
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _renderSavedSearches() {
  const container = document.getElementById('saved-searches');
  if (!container) return;
  const saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  container.innerHTML = '';
  saved.forEach(s => {
    const chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:3px;background:rgba(139,90,43,0.15);font-size:0.75em;cursor:pointer;';
    chip.title = `Click to search: ${s}`;
    const label = document.createElement('span');
    label.textContent = s.length > 15 ? s.slice(0, 15) + '…' : s;
    label.onclick = () => _loadSavedSearch(s);
    const del = document.createElement('span');
    del.textContent = '✕';
    del.style.cssText = 'cursor:pointer;opacity:0.5;font-size:0.9em;margin-left:2px;';
    del.title = 'Remove saved search';
    del.onclick = (e) => { e.stopPropagation(); _deleteSavedSearch(s); };
    chip.appendChild(label);
    chip.appendChild(del);
    container.appendChild(chip);
  });
}
