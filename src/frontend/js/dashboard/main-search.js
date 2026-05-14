/**
 * main-search.js — Global search overlay for the dashboard.
 *
 * Contains:
 *   - Search view (displaySearchView)
 *   - Search results rendering (_renderSearchResults)
 *   - Field value extraction (_getChitFieldValue)
 *   - Highlight helpers (delegates to cwocExtractSearchTerms/cwocHighlightTerms in shared-utils.js)
 *   - Saved searches (_saveSearch, _loadSavedSearch, _deleteSavedSearch, _renderSavedSearches)
 *
 * Depends on globals from main.js: _globalSearchResults, _globalSearchQuery
 * Depends on shared-utils.js: cwocExtractSearchTerms, cwocHighlightTerms
 * Depends on main-views.js: _buildChitHeader, chitColor, _applyMultiSelectFilters,
 *   _applyArchiveFilter, applyChitColors, storePreviousState
 */

// ── Highlight Helpers (thin wrappers around shared-utils.js) ─────────────────

function _extractHighlightTerms(query) {
  return cwocExtractSearchTerms(query);
}

function _highlightMultiTerms(text, terms) {
  return cwocHighlightTerms(text, terms);
}

/**
 * Extract a snippet around the first match term found in the text.
 * Shows ~50 chars total centered on the match.
 */
function _getSearchSnippet(text, terms) {
  if (!text || !terms || terms.length === 0) {
    return text.length > 50 ? text.substring(0, 50) + '\u2026' : text;
  }
  var lower = text.toLowerCase();
  var firstIdx = -1;
  for (var i = 0; i < terms.length; i++) {
    var idx = lower.indexOf(terms[i].toLowerCase());
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }
  if (firstIdx === -1) {
    return text.length > 50 ? text.substring(0, 50) + '\u2026' : text;
  }
  var start = Math.max(0, firstIdx - 15);
  var end = Math.min(text.length, firstIdx + 35);
  var snippet = '';
  if (start > 0) snippet += '\u2026';
  snippet += text.substring(start, end);
  if (end < text.length) snippet += '\u2026';
  return snippet;
}

// ── Search View ──────────────────────────────────────────────────────────────

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
  input.placeholder = 'Search all chits\u2026';
  input.value = _globalSearchQuery || '';

  var goBtn = document.createElement('button');
  goBtn.className = 'action-button';
  goBtn.textContent = 'Go';
  goBtn.style.cssText = 'flex-shrink:0;';

  searchBar.appendChild(input);
  searchBar.appendChild(goBtn);
  chitList.appendChild(searchBar);

  // Email filter toggle (3-value pill: No Email | All | Only Emails)
  var emailFilterRow = document.createElement('div');
  emailFilterRow.className = 'global-search-email-filter';
  emailFilterRow.innerHTML = '<label>Emails:</label>' +
    '<div class="cwoc-2val-toggle cwoc-3val-toggle" id="search-email-pill">' +
      '<input type="hidden" id="search-email-toggle" value="no_email" />' +
      '<span data-val="no_email" class="active">Exclude</span>' +
      '<span data-val="all">All</span>' +
      '<span data-val="only_email">Only</span>' +
    '</div>';
  chitList.appendChild(emailFilterRow);

  // Wire email pill toggle
  var emailPill = emailFilterRow.querySelector('#search-email-pill');
  emailPill.addEventListener('click', function(e) {
    var span = e.target.closest('span[data-val]');
    if (!span) return;
    var hidden = document.getElementById('search-email-toggle');
    hidden.value = span.dataset.val;
    emailPill.querySelectorAll('span[data-val]').forEach(function(s) {
      s.classList.toggle('active', s.dataset.val === span.dataset.val);
    });
    // Re-render results with new filter
    if (_globalSearchResults.length > 0) {
      _renderSearchResults(resultsContainer, _viSettings);
    }
  });

  // ── Dropdown Filters Row ───────────────────────────────────────────────────
  var filtersRow = document.createElement('div');
  filtersRow.className = 'global-search-filters-row';

  // Status dropdown
  var statusSelect = document.createElement('select');
  statusSelect.id = 'search-filter-status';
  statusSelect.innerHTML = '<option value="">Status: Any</option>' +
    '<option value="ToDo">ToDo</option>' +
    '<option value="In Progress">In Progress</option>' +
    '<option value="Blocked">Blocked</option>' +
    '<option value="Complete">Complete</option>';
  statusSelect.addEventListener('change', function() {
    if (_globalSearchResults.length > 0) _renderSearchResults(resultsContainer, _viSettings);
  });
  filtersRow.appendChild(statusSelect);

  // Priority dropdown
  var prioritySelect = document.createElement('select');
  prioritySelect.id = 'search-filter-priority';
  prioritySelect.innerHTML = '<option value="">Priority: Any</option>' +
    '<option value="Critical">Critical</option>' +
    '<option value="High">High</option>' +
    '<option value="Medium">Medium</option>' +
    '<option value="Low">Low</option>';
  prioritySelect.addEventListener('change', function() {
    if (_globalSearchResults.length > 0) _renderSearchResults(resultsContainer, _viSettings);
  });
  filtersRow.appendChild(prioritySelect);

  // Tag filter button + dropdown
  var tagFilterWrap = document.createElement('div');
  tagFilterWrap.className = 'search-tag-filter-wrap';

  var tagBtn = document.createElement('button');
  tagBtn.className = 'action-button search-tag-filter-btn';
  tagBtn.id = 'search-tag-filter-btn';
  tagBtn.innerHTML = '<i class="fas fa-tag"></i> Tags';
  tagFilterWrap.appendChild(tagBtn);

  var tagDropdown = document.createElement('div');
  tagDropdown.className = 'search-tag-filter-dropdown';
  tagDropdown.id = 'search-tag-filter-dropdown';
  tagDropdown.style.display = 'none';
  tagFilterWrap.appendChild(tagDropdown);

  filtersRow.appendChild(tagFilterWrap);
  chitList.appendChild(filtersRow);

  // Tag filter state
  var _searchFilterTags = [];

  // Wire tag filter button
  tagBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = tagDropdown.style.display !== 'none';
    if (isOpen) {
      tagDropdown.style.display = 'none';
    } else {
      tagDropdown.style.display = 'block';
      buildTagPicker(tagDropdown, _searchFilterTags, {
        compact: true,
        onChange: function(tags) {
          _searchFilterTags = tags;
          _updateTagBtnLabel();
          if (_globalSearchResults.length > 0) _renderSearchResults(resultsContainer, _viSettings);
        }
      });
    }
  });

  // Close tag dropdown on outside click
  document.addEventListener('click', function _closeTagDrop(e) {
    if (!tagFilterWrap.contains(e.target)) {
      tagDropdown.style.display = 'none';
    }
  });

  function _updateTagBtnLabel() {
    if (_searchFilterTags.length > 0) {
      tagBtn.innerHTML = '<i class="fas fa-tag"></i> Tags (' + _searchFilterTags.length + ')';
    } else {
      tagBtn.innerHTML = '<i class="fas fa-tag"></i> Tags';
    }
  }

  // Store tag filter reference on the container for _renderSearchResults to access
  chitList._searchFilterTags = _searchFilterTags;
  chitList._getSearchFilterTags = function() { return _searchFilterTags; };

  // Search tips hint
  var hintDiv = document.createElement('div');
  hintDiv.className = 'global-search-hint';
  hintDiv.innerHTML = 'Operators: <strong>&&</strong> (AND, default) \u00b7 <strong>||</strong> (OR) \u00b7 <strong>!</strong> (NOT) \u00b7 <strong>()</strong> (group) \u00b7 <strong>#tag</strong> (filter by tag) \u00b7 <strong>field::value</strong> or <strong>field::(multi word)</strong><br>Fields: <code>title</code>, <code>note</code>, <code>location</code>, <code>status</code>, <code>priority</code>, <code>people</code>, <code>checklist</code>, <code>subject</code>, <code>sender</code>, <code>from</code>, <code>to</code>, <code>cc</code>, <code>bcc</code>, <code>body</code>, <code>child</code>, <code>due</code>, <code>start</code>, <code>end</code>, <code>assigned</code><br>e.g. <code>title::(email stuff) && #work</code> \u00b7 <code>location::park || people::john</code> \u00b7 <code>child::deploy && !#done</code>';
  chitList.appendChild(hintDiv);

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
      resultsContainer.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.8;color:#b22222;"><p>\u26a0 ' + (err.message || 'Search failed') + '</p></div>';
      return;
    }
    _renderSearchResults(resultsContainer, _viSettings);
  }

  // Wire up Go button, Enter key, and search-as-you-type with debounce
  goBtn.addEventListener('click', executeSearch);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); executeSearch(); }
  });
  var _searchDebounce = null;
  input.addEventListener('input', function() {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(executeSearch, 300);
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

// ── Search Results Rendering ─────────────────────────────────────────────────

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
    c._titleMatch = r.title_match || false;
    c._score = r.score || 0;
    return c;
  });
  resultChits = _applyMultiSelectFilters(resultChits);
  resultChits = _applyArchiveFilter(resultChits);

  // Apply email filter from search toggle (No Email / All / Only Emails)
  var emailToggle = document.getElementById('search-email-toggle');
  var emailMode = emailToggle ? emailToggle.value : 'no_email';
  if (emailMode !== 'all') {
    resultChits = resultChits.filter(function(c) {
      var isEmail = !!(c.email_message_id || c.email_status);
      if (emailMode === 'no_email') return !isEmail;
      if (emailMode === 'only_email') return isEmail;
      return true;
    });
  }

  // Apply status dropdown filter
  var statusFilter = document.getElementById('search-filter-status');
  var statusVal = statusFilter ? statusFilter.value : '';
  if (statusVal) {
    resultChits = resultChits.filter(function(c) { return c.status === statusVal; });
  }

  // Apply priority dropdown filter
  var priorityFilter = document.getElementById('search-filter-priority');
  var priorityVal = priorityFilter ? priorityFilter.value : '';
  if (priorityVal) {
    resultChits = resultChits.filter(function(c) { return c.priority === priorityVal; });
  }

  // Apply tag picker filter
  var chitList = document.getElementById('chit-list');
  var filterTags = (chitList && chitList._getSearchFilterTags) ? chitList._getSearchFilterTags() : [];
  if (filterTags.length > 0) {
    resultChits = resultChits.filter(function(c) {
      var chitTags = c.tags || [];
      if (!Array.isArray(chitTags)) return false;
      return filterTags.every(function(ft) {
        return typeof matchesTagFilter === 'function' ? matchesTagFilter(chitTags, ft) : chitTags.indexOf(ft) !== -1;
      });
    });
  }

  // Apply sidebar text filter
  var sidebarText = (document.getElementById('search') ? document.getElementById('search').value : '').toLowerCase();
  if (sidebarText) {
    resultChits = resultChits.filter(function(c) {
      if (c.title && c.title.toLowerCase().indexOf(sidebarText) !== -1) return true;
      if (c.note && c.note.toLowerCase().indexOf(sidebarText) !== -1) return true;
      if (Array.isArray(c.tags) && c.tags.some(function(t) { return t.toLowerCase().indexOf(sidebarText) !== -1; })) return true;
      if (c.status && c.status.toLowerCase().indexOf(sidebarText) !== -1) return true;
      if (Array.isArray(c.people) && c.people.some(function(p) { return p.toLowerCase().indexOf(sidebarText) !== -1; })) return true;
      if (c.location && c.location.toLowerCase().indexOf(sidebarText) !== -1) return true;
      if (c.priority && c.priority.toLowerCase().indexOf(sidebarText) !== -1) return true;
      return false;
    });
  }

  if (resultChits.length === 0) {
    container.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;"><p style="font-size:1.1em;">No results found.</p></div>';
    return;
  }

  // Sort: by relevance score (higher = better match, full-word > partial)
  resultChits.sort(function(a, b) {
    return (b._score || 0) - (a._score || 0);
  });

  // Extract highlight terms once for all cards
  var highlightTerms = _extractHighlightTerms(q);

  resultChits.forEach(function(chit) {
    var card = document.createElement('div');
    card.className = 'chit-card global-search-result-card';
    card.dataset.chitId = chit.id;
    applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.archived) card.classList.add('archived-chit');
    card.style.cursor = 'pointer';

    // Title row via _buildChitHeader
    var titleHtml = _highlightMultiTerms(chit.title || '(Untitled)', highlightTerms);
    card.appendChild(_buildChitHeader(chit, titleHtml, viSettings));

    // Show snippets for ALL matched fields
    var matchedFields = chit._matchedFields || [];
    if (matchedFields.length > 0) {
      var fieldsDiv = document.createElement('div');
      fieldsDiv.className = 'global-search-matched-fields';

      matchedFields.forEach(function(fieldName) {
        if (fieldName === 'full_text') return;
        var value = _getChitFieldValue(chit, fieldName);
        if (!value) return;

        var fieldRow = document.createElement('div');

        var label = document.createElement('span');
        label.textContent = fieldName + ':';
        fieldRow.appendChild(label);

        var excerpt = document.createElement('span');
        var displayVal = _getSearchSnippet(value, highlightTerms);
        excerpt.innerHTML = _highlightMultiTerms(displayVal, highlightTerms);
        fieldRow.appendChild(excerpt);

        fieldsDiv.appendChild(fieldRow);
      });
      if (fieldsDiv.children.length > 0) {
        card.appendChild(fieldsDiv);
      }
    }

    // Click handler: navigate to editor
    card.addEventListener('click', function() {
      storePreviousState();
      window.location.href = '/frontend/html/editor.html?id=' + chit.id;
    });

    container.appendChild(card);
  });
}

// ── Field Value Extraction ───────────────────────────────────────────────────

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
    case 'child_chits':
      var children = chit.child_chits || [];
      return Array.isArray(children) ? '(child chits)' : '';
    case 'start_datetime': return chit.start_datetime || '';
    case 'end_datetime': return chit.end_datetime || '';
    case 'due_datetime': return chit.due_datetime || '';
    case 'created_datetime': return chit.created_datetime || '';
    case 'modified_datetime': return chit.modified_datetime || '';
    case 'alerts':
      var alerts = chit.alerts || [];
      if (Array.isArray(alerts)) return alerts.map(function(a) { return typeof a === 'object' ? (a.description || a.label || JSON.stringify(a)) : String(a); }).join(', ');
      return String(alerts);
    case 'email_from': return chit.email_from || '';
    case 'email_subject': return chit.email_subject || '';
    case 'email_body_text': return chit.email_body_text ? (chit.email_body_text.length > 200 ? chit.email_body_text.substring(0, 200) + '\u2026' : chit.email_body_text) : '';
    case 'email_to':
      var emailTo = chit.email_to || [];
      return Array.isArray(emailTo) ? emailTo.join(', ') : String(emailTo || '');
    case 'email_cc':
      var emailCc = chit.email_cc || [];
      return Array.isArray(emailCc) ? emailCc.join(', ') : String(emailCc || '');
    case 'email_bcc':
      var emailBcc = chit.email_bcc || [];
      return Array.isArray(emailBcc) ? emailBcc.join(', ') : String(emailBcc || '');
    case 'assigned_to': return chit.assigned_to || '';
    default: return chit[fieldName] != null ? String(chit[fieldName]) : '';
  }
}

// ═══════════════ END GLOBAL SEARCH ═══════════════

// ── Saved Searches ───────────────────────────────────────────────────────────
function _saveSearch() {
  var search = document.getElementById('search');
  var val = search ? search.value.trim() : '';
  if (!val) return;
  var saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  if (saved.indexOf(val) !== -1) return;
  saved.push(val);
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _loadSavedSearch(text) {
  var input = document.getElementById('search');
  if (input) { input.value = text; searchChits(); }
}

function _deleteSavedSearch(text) {
  var saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  saved = saved.filter(function(s) { return s !== text; });
  localStorage.setItem('cwoc_saved_searches', JSON.stringify(saved));
  _renderSavedSearches();
}

function _renderSavedSearches() {
  var container = document.getElementById('saved-searches');
  if (!container) return;
  var saved = JSON.parse(localStorage.getItem('cwoc_saved_searches') || '[]');
  container.innerHTML = '';
  saved.forEach(function(s) {
    var chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:3px;background:rgba(139,90,43,0.15);font-size:0.75em;cursor:pointer;';
    chip.title = 'Click to search: ' + s;
    var label = document.createElement('span');
    label.textContent = s.length > 15 ? s.slice(0, 15) + '\u2026' : s;
    label.onclick = function() { _loadSavedSearch(s); };
    var del = document.createElement('span');
    del.textContent = '\u2715';
    del.style.cssText = 'cursor:pointer;opacity:0.5;font-size:0.9em;margin-left:2px;';
    del.title = 'Remove saved search';
    del.onclick = function(e) { e.stopPropagation(); _deleteSavedSearch(s); };
    chip.appendChild(label);
    chip.appendChild(del);
    container.appendChild(chip);
  });
}
