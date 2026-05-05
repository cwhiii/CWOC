/**
 * main-init.js — Application initialization and core orchestration for the dashboard.
 *
 * Contains:
 *   - DOMContentLoaded handler (app startup)
 *   - displayChits orchestrator (main render dispatcher)
 *   - fetchChits (API data loading)
 *   - Filter application (_applySort, _applyMultiSelectFilters, _applyArchiveFilter)
 *   - Chit display options (_applyChitDisplayOptions, _updateTabCounts)
 *   - UI state persistence (storePreviousState, _restoreUIState)
 *   - Resize handling (_onDebouncedResize, _getBreakpointCategory, _checkTabOverflow)
 *   - Weather refresh scheduling (_scheduleWeatherRefresh)
 *   - Keyboard event dispatcher (hotkey state machine)
 *   - Mobile swipe navigation
 *
 * Depends on globals from main.js: currentTab, chits, currentWeekStart, currentView,
 *   currentSortField, currentSortDir, _hotkeyMode, _cachedTagObjects, _chitOptions,
 *   _snoozeRegistry, _defaultFilters, _weekViewDayOffset, previousState,
 *   _globalSearchResults, _globalSearchQuery
 * Depends on all other main-*.js sub-scripts for view rendering and sidebar/hotkey functions.
 */

/* ── Breakpoint state ────────────────────────────────────────────────────── */
let _lastBreakpointCategory = null;
let _resizeDebounceTimer = null;

/** Return the current breakpoint category based on viewport width. */
function _getBreakpointCategory() {
  var w = window.innerWidth;
  if (w <= 480) return 'mobile';
  if (w <= 768) return 'tablet';
  return 'desktop';
}

/** Debounced resize handler — only re-renders when viewport crosses a breakpoint boundary. */
function _onDebouncedResize() {
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(function() {
    _checkTabOverflow();
    var category = _getBreakpointCategory();
    if (category !== _lastBreakpointCategory) {
      _lastBreakpointCategory = category;
      _weekViewDayOffset = 0;
      displayChits();
    }
  }, 200);
}

/* ── Tab overflow detection ──────────────────────────────────────────────── */

/** Reorder the tab bar based on the user's saved view_order setting and hide excluded tabs. */
function _applyViewOrder(viewOrder) {
  if (!viewOrder) return;
  var order = viewOrder;
  if (typeof order === 'string') {
    try { order = JSON.parse(order); } catch (e) { return; }
  }
  if (!Array.isArray(order)) return;

  var tabsContainer = document.getElementById('cwoc-tabs');
  if (!tabsContainer) return;

  var allTabs = Array.from(tabsContainer.querySelectorAll('.tab'));
  // Build a map from tab name to DOM element (using the onclick attribute)
  var tabMap = {};
  allTabs.forEach(function(tab) {
    var onclick = tab.getAttribute('onclick') || '';
    var match = onclick.match(/filterChits\('([^']+)'\)/);
    if (match) tabMap[match[1]] = tab;
  });

  // Reorder: place tabs in the specified order
  order.forEach(function(viewName) {
    if (tabMap[viewName]) {
      tabMap[viewName].style.display = '';
      tabsContainer.appendChild(tabMap[viewName]);
      delete tabMap[viewName];
    }
  });

  // Hide tabs not in the order (but keep Search always visible at the end)
  Object.keys(tabMap).forEach(function(key) {
    if (key === 'Search') {
      tabMap[key].style.display = '';
      tabsContainer.appendChild(tabMap[key]);
    } else {
      tabMap[key].style.display = 'none';
      tabsContainer.appendChild(tabMap[key]);
    }
  });
}

function _checkTabOverflow() {
  var tabs = document.getElementById('cwoc-tabs');
  if (!tabs) return;
  var allTabs = Array.from(tabs.querySelectorAll('.tab'));
  if (allTabs.length === 0) return;

  // Reset to full labels
  tabs.classList.remove('icon-only');
  allTabs.forEach(function(t) { t.style.paddingLeft = ''; t.style.paddingRight = ''; });
  void tabs.offsetWidth; // force reflow

  // Check if all tabs fit with full labels
  if (tabs.scrollWidth <= tabs.clientWidth + 2) return;

  // Try reducing padding gradually (keeps labels visible, just tighter)
  for (var pad = 18; pad >= 8; pad -= 2) {
    allTabs.forEach(function(t) { t.style.paddingLeft = pad + 'px'; t.style.paddingRight = pad + 'px'; });
    void tabs.offsetWidth;
    if (tabs.scrollWidth <= tabs.clientWidth + 2) return;
  }

  // Still doesn't fit — hide labels entirely (icon-only)
  tabs.classList.add('icon-only');
  allTabs.forEach(function(t) { t.style.paddingLeft = ''; t.style.paddingRight = ''; });
}

/* ── Filter application ──────────────────────────────────────────────────── */
function _applyArchiveFilter(chitList) {
  const showPinned   = document.getElementById('show-pinned')?.checked ?? true;
  const showArchived = document.getElementById('show-archived')?.checked ?? true;
  const showUnmarked = document.getElementById('show-unmarked')?.checked ?? true;

  if (showPinned && showArchived && showUnmarked) return chitList;
  if (!showPinned && !showArchived && !showUnmarked) return chitList;

  return chitList.filter((c) => {
    const isPinned   = !!c.pinned;
    const isArchived = !!c.archived;
    const isUnmarked = !isPinned && !isArchived;
    return (isPinned && showPinned) || (isArchived && showArchived) || (isUnmarked && showUnmarked);
  });
}

/* ── Filter value getters are in main-sidebar.js ─────────────────────────── */

function _applyMultiSelectFilters(chitList) {
  let result = chitList;

  const statuses = _getSelectedStatuses();
  if (statuses.length > 0) {
    result = result.filter(c => c.status && statuses.includes(c.status));
  }

  const labels = _getSelectedLabels();
  if (labels.length > 0) {
    result = result.filter(c => {
      const tags = c.tags || [];
      return labels.some(l => matchesTagFilter(tags, l));
    });
  }

  const priorities = _getSelectedPriorities();
  if (priorities.length > 0) {
    result = result.filter(c => c.priority && priorities.includes(c.priority));
  }

  // People filter
  const selectedPeople = window._sidebarPeopleSelection || [];
  if (selectedPeople.length > 0) {
    result = result.filter(c => {
      const people = c.people || [];
      return selectedPeople.some(name => people.includes(name));
    });
  }

  // Sharing filters (Requirement 7.2, 7.3, 7.4)
  var sharedWithMe = document.getElementById('filter-shared-with-me');
  var sharedByMe = document.getElementById('filter-shared-by-me');
  var sharedWithMeActive = sharedWithMe && sharedWithMe.checked;
  var sharedByMeActive = sharedByMe && sharedByMe.checked;

  if (sharedWithMeActive || sharedByMeActive) {
    var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    var currentUserId = currentUser ? currentUser.user_id : null;

    result = result.filter(function(c) {
      var matchesWithMe = false;
      var matchesByMe = false;

      if (sharedWithMeActive && currentUserId) {
        // Shared with me: _shared is true and user is not the owner
        matchesWithMe = c._shared === true && c.owner_id !== currentUserId;
      }

      if (sharedByMeActive && currentUserId) {
        // Shared by me: owned by current user with at least one share entry
        var shares = Array.isArray(c.shares) ? c.shares : [];
        matchesByMe = c.owner_id === currentUserId && shares.length > 0;
      }

      // If both filters are active, show chits matching either condition (union)
      if (sharedWithMeActive && sharedByMeActive) return matchesWithMe || matchesByMe;
      if (sharedWithMeActive) return matchesWithMe;
      if (sharedByMeActive) return matchesByMe;
      return true;
    });
  }

  // Project filter — only show children of the selected project (+ the project itself)
  var selectedProjectId = typeof _getSelectedProjectId === 'function' ? _getSelectedProjectId() : '';
  if (selectedProjectId) {
    var allChits = typeof chits !== 'undefined' ? chits : [];

    if (selectedProjectId === '__any__') {
      // Show only chits that belong to ANY project (are in some project's child_chits)
      var allChildIds = new Set();
      allChits.forEach(function(c) {
        if (c.is_project_master && Array.isArray(c.child_chits)) {
          c.child_chits.forEach(function(id) { allChildIds.add(id); });
        }
      });
      result = result.filter(function(c) { return allChildIds.has(c.id) || c.is_project_master; });
    } else if (selectedProjectId === '__none__') {
      // Show only chits that do NOT belong to any project
      var allChildIds2 = new Set();
      allChits.forEach(function(c) {
        if (c.is_project_master && Array.isArray(c.child_chits)) {
          c.child_chits.forEach(function(id) { allChildIds2.add(id); });
        }
      });
      result = result.filter(function(c) { return !allChildIds2.has(c.id) && !c.is_project_master; });
    } else {
      // Specific project — show its children + the project master itself
      var projectMaster = allChits.find(function(c) { return c.id === selectedProjectId; });
      if (projectMaster) {
        var childIds = Array.isArray(projectMaster.child_chits) ? projectMaster.child_chits : [];
        var allowedIds = new Set(childIds);
        allowedIds.add(selectedProjectId);
        result = result.filter(function(c) { return allowedIds.has(c.id); });
      }
    }
  }

  return result;
}

function _applySort(chitList) {
  if (!currentSortField) return chitList;
  if (currentSortField === 'manual') {
    return applyManualOrder(currentTab, chitList);
  }
  if (currentSortField === 'random') {
    const arr = [...chitList];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  if (currentSortField === 'upcoming') {
    return [...chitList].sort((a, b) => {
      // Completed always at bottom
      if (a.status === 'Complete' && b.status !== 'Complete') return 1;
      if (b.status === 'Complete' && a.status !== 'Complete') return -1;
      const aDate = a.due_datetime ? new Date(a.due_datetime).getTime() : (a.start_datetime ? new Date(a.start_datetime).getTime() : Infinity);
      const bDate = b.due_datetime ? new Date(b.due_datetime).getTime() : (b.start_datetime ? new Date(b.start_datetime).getTime() : Infinity);
      return aDate - bDate;
    });
  }
  const nullLast = currentSortDir === 'asc' ? Infinity : -Infinity;
  return [...chitList].sort((a, b) => {
    let valA, valB;
    if (currentSortField === 'title') {
      valA = a.title ? a.title.toLowerCase() : null;
      valB = b.title ? b.title.toLowerCase() : null;
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
    } else if (currentSortField === 'start') {
      valA = a.start_datetime ? new Date(a.start_datetime).getTime() : nullLast;
      valB = b.start_datetime ? new Date(b.start_datetime).getTime() : nullLast;
    } else if (currentSortField === 'due') {
      valA = a.due_datetime ? new Date(a.due_datetime).getTime() : nullLast;
      valB = b.due_datetime ? new Date(b.due_datetime).getTime() : nullLast;
    } else if (currentSortField === 'updated') {
      valA = a.modified_datetime ? new Date(a.modified_datetime).getTime() : nullLast;
      valB = b.modified_datetime ? new Date(b.modified_datetime).getTime() : nullLast;
    } else if (currentSortField === 'created') {
      valA = a.created_datetime ? new Date(a.created_datetime).getTime() : nullLast;
      valB = b.created_datetime ? new Date(b.created_datetime).getTime() : nullLast;
    } else if (currentSortField === 'status') {
      const order = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, 'Complete': 4 };
      valA = order[a.status] || 99;
      valB = order[b.status] || 99;
    }
    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}


/* ── UI state persistence ────────────────────────────────────────────────── */
function storePreviousState() {
  previousState = { tab: currentTab, view: currentView };
  // Save the current tab separately so the editor knows which view we came from
  localStorage.setItem('cwoc_source_tab', currentTab);
  // Also save the tasks view mode so the editor can auto-enable habit mode
  if (typeof _tasksViewMode !== 'undefined') {
    localStorage.setItem('cwoc_source_tasks_mode', _tasksViewMode);
  }
  // Save full UI state to localStorage for restoration after editor
  const state = {
    tab: currentTab,
    view: currentView,
    weekStart: currentWeekStart ? currentWeekStart.toISOString() : null,
    sortField: currentSortField,
    sortDir: currentSortDir,
    search: document.getElementById('search')?.value || '',
    statusFilters: Array.from(document.querySelectorAll('#status-multi input:checked')).map(cb => cb.value),
    labelFilters: Array.from(document.querySelectorAll('#label-multi input:checked')).map(cb => cb.value),
    priorityFilters: Array.from(document.querySelectorAll('#priority-multi input:checked')).map(cb => cb.value),
    showPinned: document.getElementById('show-pinned')?.checked ?? true,
    showArchived: document.getElementById('show-archived')?.checked ?? false,
    showUnmarked: document.getElementById('show-unmarked')?.checked ?? true,
    hidePastDue: document.getElementById('hide-past-due')?.checked ?? false,
    hideComplete: document.getElementById('hide-complete')?.checked ?? false,
    hideDeclined: document.getElementById('hide-declined')?.checked ?? false,
    hideEmailReceived: document.getElementById('hide-email-received')?.checked ?? true,
    hideEmailSent: document.getElementById('hide-email-sent')?.checked ?? true,
    highlightOverdue: document.getElementById('highlight-overdue')?.checked ?? true,
    highlightBlocked: document.getElementById('highlight-blocked')?.checked ?? true,
  };
  localStorage.setItem('cwoc_ui_state', JSON.stringify(state));
}

/* ── Calendar event helpers are in main-calendar.js ──────────────────────── */

function _restoreUIState() {
  try {
    // sessionStorage refresh state is always the most recent (saved on every displayChits call)
    var refreshRaw = null;
    try { refreshRaw = sessionStorage.getItem('cwoc_refresh_state'); } catch (e) { /* ignore */ }
    var rs = refreshRaw ? JSON.parse(refreshRaw) : null;

    // localStorage ui state is saved before navigating away (editor, settings, etc.)
    // It contains richer data (filters, search, toggles) but may be stale for tab/view/period
    const raw = localStorage.getItem('cwoc_ui_state');
    var state = null;
    if (raw) {
      state = JSON.parse(raw);
      localStorage.removeItem('cwoc_ui_state'); // one-time restore
    }

    // Nothing to restore at all
    if (!rs && !state) return false;

    // Restore tab/view/period from sessionStorage first (most recent), fall back to localStorage
    if (rs) {
      if (rs.tab) currentTab = rs.tab;
      if (rs.view) currentView = rs.view;
      if (rs.weekStart) currentWeekStart = new Date(rs.weekStart);
      if (rs.sortField !== undefined) currentSortField = rs.sortField || null;
      if (rs.sortDir) currentSortDir = rs.sortDir;
    } else if (state) {
      if (state.tab) currentTab = state.tab;
      if (state.view) currentView = state.view;
      if (state.weekStart) currentWeekStart = new Date(state.weekStart);
      if (state.sortField !== undefined) currentSortField = state.sortField;
      if (state.sortDir) currentSortDir = state.sortDir;
    }

    // Update tab highlight
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.querySelector(".tab[onclick=\"filterChits('" + currentTab + "')\"]");
    if (activeTab) activeTab.classList.add('active');

    // Restore period select
    var periodSel = document.getElementById('period-select');
    if (periodSel) periodSel.value = currentView;

    // Restore sort UI
    var sortSel = document.getElementById('sort-select');
    if (sortSel && currentSortField) sortSel.value = currentSortField;
    _updateSortUI();

    // If we have full state from editor return, also restore filters/search/toggles
    if (state) {
      // Restore search
      const search = document.getElementById('search');
      if (search && state.search) search.value = state.search;

      // Restore status checkboxes
      if (state.statusFilters) {
        document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => {
          cb.checked = state.statusFilters.includes(cb.value);
        });
      }

      // Restore priority checkboxes
      if (state.priorityFilters) {
        document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => {
          cb.checked = state.priorityFilters.includes(cb.value);
        });
      }

      // Restore archive/pinned toggles
      const sp = document.getElementById('show-pinned');
      const sa = document.getElementById('show-archived');
      const su = document.getElementById('show-unmarked');
      if (sp) sp.checked = state.showPinned ?? true;
      if (sa) sa.checked = state.showArchived ?? false;
      if (su) su.checked = state.showUnmarked ?? true;
      const hpd = document.getElementById('hide-past-due');
      if (hpd) hpd.checked = state.hidePastDue ?? false;
      const hc = document.getElementById('hide-complete');
      if (hc) hc.checked = state.hideComplete ?? false;
      const hd = document.getElementById('hide-declined');
      if (hd) hd.checked = state.hideDeclined ?? false;
      const her = document.getElementById('hide-email-received');
      if (her) her.checked = state.hideEmailReceived ?? true;
      const hes = document.getElementById('hide-email-sent');
      if (hes) hes.checked = state.hideEmailSent ?? true;
      const hlO = document.getElementById('highlight-overdue');
      if (hlO && state.highlightOverdue !== undefined) hlO.checked = state.highlightOverdue;
      const hlB = document.getElementById('highlight-blocked');
      if (hlB && state.highlightBlocked !== undefined) hlB.checked = state.highlightBlocked;

      // Restore label filters after they load
      if (state.labelFilters && state.labelFilters.length > 0) {
        window._pendingLabelFilters = state.labelFilters;
      }

      // Auto-expand sidebar filter groups that have active filters
      if (state.statusFilters && state.statusFilters.some(v => v !== '')) {
        expandFilterGroup('filter-status');
      }
      if (state.priorityFilters && state.priorityFilters.some(v => v !== '')) {
        expandFilterGroup('filter-priority');
      }
      if (state.labelFilters && state.labelFilters.length > 0) {
        expandFilterGroup('filter-label');
      }
      if (state.showArchived || !state.showPinned || !state.showUnmarked || state.hidePastDue || state.hideComplete || state.hideDeclined || state.hideEmailReceived === false || state.hideEmailSent === false || state.highlightOverdue === false || state.highlightBlocked === false) {
        expandFilterGroup('filter-archive');
      }
    }

    // Show/hide sections based on tab
    const periodSection = document.getElementById('section-period');
    const yearWeekContainer = document.getElementById('year-week-container');
    const orderSection = document.getElementById('section-order');
    if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';
    if (orderSection) orderSection.style.display = (currentTab === 'Calendar' || currentTab === 'Indicators' || currentTab === 'Email') ? 'none' : '';
    const kanbanSectionRestore = document.getElementById('section-kanban');
    if (kanbanSectionRestore) kanbanSectionRestore.style.display = (currentTab === 'Projects') ? '' : 'none';
    const indSectionRestore = document.getElementById('section-indicators');
    if (indSectionRestore) indSectionRestore.style.display = (currentTab === 'Indicators') ? '' : 'none';
    const filtersSectionRestore = document.getElementById('section-filters');
    if (filtersSectionRestore && currentTab === 'Indicators') filtersSectionRestore.style.display = 'none';
    const alarmsSectionRestore = document.getElementById('section-alarms-mode');
    if (alarmsSectionRestore) alarmsSectionRestore.style.display = (currentTab === 'Alarms') ? '' : 'none';
    const tasksSectionRestore = document.getElementById('section-tasks-mode');
    if (tasksSectionRestore) tasksSectionRestore.style.display = (currentTab === 'Tasks') ? '' : 'none';
    // Restore email sidebar visibility
    if (typeof _updateEmailSidebarVisibility === 'function') _updateEmailSidebarVisibility(currentTab);

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check for a pending delete-undo from the editor.
 * If the editor deleted a chit and stored undo info in sessionStorage,
 * show the undo toast on the dashboard so the user can restore it.
 */
function _checkPendingDeleteUndo() {
  try {
    var raw = sessionStorage.getItem('cwoc_pending_undo');
    if (!raw) return;
    sessionStorage.removeItem('cwoc_pending_undo');
    var info = JSON.parse(raw);
    if (!info || !info.id) return;
    // Only honour if the delete happened within the last 15 seconds
    if (Date.now() - (info.time || 0) > 15000) return;
    _showDeleteUndoToast(info.id, info.title, null, function () {
      fetch('/api/trash/' + info.id + '/restore', { method: 'POST' })
        .then(function () { fetchChits(); })
        .catch(function (err) { console.error('Undo restore failed:', err); });
    });
  } catch (e) { /* ignore */ }
}

/* ── Data loading and display orchestration ──────────────────────────────── */
function fetchChits() {
  console.debug("Fetching chits...");
  // Show loading spinner on first load (when chit-list is empty)
  const listEl = document.getElementById("chit-list");
  if (listEl && chits.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:3em;opacity:0.5;font-size:1.2em;">⏳ Loading chits…</div>';
  }

  // Fetch owned chits and shared chits in parallel
  Promise.all([
    fetch("/api/chits").then(function(r) {
      if (!r.ok) throw new Error('HTTP error! Status: ' + r.status);
      return r.json();
    }),
    fetch("/api/shared-chits").then(function(r) {
      if (!r.ok) {
        console.error('[fetchChits] /api/shared-chits returned', r.status);
        return r.text().then(function(t) { console.error('[fetchChits] shared-chits error:', t); return []; });
      }
      return r.json();
    }).catch(function(err) { console.error('[fetchChits] shared-chits fetch error:', err); return []; }),
    fetch("/api/contacts/birthdays").then(function(r) {
      if (!r.ok) return [];
      return r.json();
    }).catch(function(err) { console.error('[fetchChits] birthdays fetch error:', err); return []; })
  ])
    .then(function(results) {
      var ownedChits = Array.isArray(results[0]) ? results[0] : [];
      var sharedChits = Array.isArray(results[1]) ? results[1] : [];
      var birthdayChits = Array.isArray(results[2]) ? results[2] : [];

      // Mark shared chits with _shared flag and merge into the chits array
      var ownedIds = new Set();
      ownedChits.forEach(function(c) { ownedIds.add(c.id); });

      sharedChits.forEach(function(sc) {
        // Skip duplicates (chit already in owned list)
        if (ownedIds.has(sc.id)) return;
        sc._shared = true; // flag for shared chit identification
        ownedChits.push(sc);
      });

      // Merge birthday/anniversary entries (virtual all-day events)
      birthdayChits.forEach(function(bc) {
        bc._isBirthday = true;
        ownedChits.push(bc);
      });

      chits = ownedChits;
      window._projectChildNotFound = null; // Reset missing-child cache on fresh fetch
      chits.forEach(function(chit) {
        if (chit.start_datetime)
          chit.start_datetime_obj = new Date(chit.start_datetime);
        if (chit.end_datetime)
          chit.end_datetime_obj = new Date(chit.end_datetime);
      });
      console.debug("Fetched chits:", chits.length, "(including", sharedChits.length, "shared)");
      if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());
      updateDateRange();
      _populateProjectFilter();
      displayChits();
      restoreSidebarState();
      // Re-check notifications immediately after chits refresh
      if (typeof _globalCheckNotifications === "function") _globalCheckNotifications();
      // Pre-fetch weather for chits with locations (populates cache for all views)
      _prefetchChitWeather(chits);
      // Update email unread badge
      if (typeof _updateEmailBadge === 'function') _updateEmailBadge();
      // Execute weather flash if navigating from weather page
      _executeWeatherFlash();
    })
    .catch(function(err) {
      console.error("Error fetching chits:", err);
      document.getElementById("chit-list").innerHTML =
        '<div class="error-message">' +
        '<h3>Error loading chits</h3>' +
        '<p>' + err.message + '</p>' +
        '<button onclick="fetchChits()">Try Again</button>' +
        '</div>';
      restoreSidebarState();
    });
}

/* ── updateDateRange is in main-calendar.js ──────────────────────────────── */

function displayChits() {
  const listContainer = document.getElementById("chit-list");
  if (!listContainer) {
    console.error("Chit list container not found");
    return;
  }

  // Persist current view state to sessionStorage for refresh recovery
  try {
    sessionStorage.setItem('cwoc_refresh_state', JSON.stringify({
      tab: currentTab,
      view: currentView,
      weekStart: currentWeekStart ? currentWeekStart.toISOString() : null,
      sortField: currentSortField,
      sortDir: currentSortDir,
    }));
  } catch (e) { /* ignore */ }

  const searchText = document.getElementById("search")?.value?.toLowerCase() || "";

  let filteredChits = chits.filter((chit) => {
    return chitMatchesSearch(chit, searchText);
  });

  // Apply multi-select filters (status, label, priority)
  filteredChits = _applyMultiSelectFilters(filteredChits);

  // Apply archive/pinned filter
  filteredChits = _applyArchiveFilter(filteredChits);

  // Apply hide-past-due filter
  const hidePastDue = document.getElementById('hide-past-due')?.checked ?? false;
  if (hidePastDue) {
    const now = new Date();
    filteredChits = filteredChits.filter(c => {
      if (!c.due_datetime || c.status === 'Complete') return true;
      return new Date(c.due_datetime) >= now;
    });
  }

  // Apply hide-complete filter
  const hideComplete = document.getElementById('hide-complete')?.checked ?? false;
  if (hideComplete) {
    filteredChits = filteredChits.filter(c => c.status !== 'Complete');
  }

  // Apply hide-declined filter
  var _hideDeclinedCb = document.getElementById('hide-declined');
  if (_hideDeclinedCb && _hideDeclinedCb.checked && typeof _isDeclinedByCurrentUser === 'function') {
    filteredChits = filteredChits.filter(function(c) { return !_isDeclinedByCurrentUser(c); });
  }

  // Apply hide-habits filter
  var _hideHabitsCb = document.getElementById('hide-habits');
  if (_hideHabitsCb && _hideHabitsCb.checked) {
    filteredChits = filteredChits.filter(function(c) { return !c.habit; });
  }

  // Apply hide-email filters (hide email chits from non-Email views)
  if (currentTab !== 'Email') {
    var _hideEmailRecvCb = document.getElementById('hide-email-received');
    var _hideEmailSentCb = document.getElementById('hide-email-sent');
    var hideRecv = _hideEmailRecvCb && _hideEmailRecvCb.checked;
    var hideSent = _hideEmailSentCb && _hideEmailSentCb.checked;
    if (hideRecv || hideSent) {
      filteredChits = filteredChits.filter(function(c) {
        if (!(c.email_message_id || c.email_status)) return true;
        var folder = c.email_folder || '';
        var isSent = (folder === 'sent' || c.email_status === 'sent' || c.email_status === 'draft');
        var isReceived = !isSent;
        if (hideRecv && isReceived) return false;
        if (hideSent && isSent) return false;
        return true;
      });
    }
  }

  // Apply sort
  filteredChits = _applySort(filteredChits);

  // Expand recurring chits for Calendar tab
  if (currentTab === "Calendar") {
    // Exclude habits hidden from calendar (habit=true && show_on_calendar=false)
    filteredChits = filteredChits.filter(function(c) {
      return !(c.habit === true && c.show_on_calendar === false);
    });

    const rangeStart = new Date(currentWeekStart || new Date());
    rangeStart.setDate(rangeStart.getDate() - 7); // buffer
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 60); // ~2 months ahead
    let expanded = [];
    filteredChits.forEach(chit => {
      if (chit.recurrence_rule && chit.recurrence_rule.freq) {
        expanded = expanded.concat(expandRecurrence(chit, rangeStart, rangeEnd));
      } else {
        expanded.push(chit);
      }
    });
    filteredChits = expanded;
  }

  switch (currentTab) {
    case "Calendar":
      if (currentView === "Week") displayWeekView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
      else if (currentView === "Work") displayWorkView(filteredChits);
      else if (currentView === "Month") displayMonthView(filteredChits);
      else if (currentView === "Itinerary") displayItineraryView(filteredChits);
      else if (currentView === "Day") displayDayView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
      else if (currentView === "Year") displayYearView(filteredChits);
      else if (currentView === "SevenDay") displaySevenDayView(filteredChits, { hourStart: _allViewStartHour, hourEnd: _allViewEndHour });
      else
        listContainer.innerHTML = `<p>${currentView} view not implemented yet.</p>`;
      break;
    case "Checklists":
      displayChecklistView(filteredChits);
      break;
    case "Tasks":
      displayTasksView(filteredChits);
      break;
    case "Notes":
      displayNotesView(filteredChits);
      break;
    case "Alarms":
      displayAlarmsView(filteredChits);
      break;
    case "Projects":
      displayProjectsView(filteredChits);
      break;
    case "Indicators":
      displayIndicatorsView();
      return; // Indicators view manages its own rendering
    case "Email":
      displayEmailView(filteredChits);
      break;
    case "Search":
      displaySearchView();
      return; // Search view manages its own rendering; skip post-render steps
    default:
      listContainer.innerHTML = `<p>${currentTab} tab not implemented yet.</p>`;
  }

  // Post-render: apply chit display options (fade past, highlight overdue)
  _applyChitDisplayOptions();

  // Update tab counts based on currently filtered chits (after search, filters, archive)
  _updateTabCounts(filteredChits);
}

/** Update tab labels with counts of displayed chits per tab. */
function _updateTabCounts(filteredChits) {
  // Remove existing counts if setting is off
  if (!_chitOptions.show_tab_counts) {
    document.querySelectorAll('.tab-count').forEach(el => el.remove());
    return;
  }

  // Deduplicate: only count original chits (skip virtual recurrence instances)
  const unique = filteredChits.filter(c => !c._virtual);

  const counts = {
    Checklists: unique.filter(c => Array.isArray(c.checklist) && c.checklist.length > 0).length,
    Alarms: unique.filter(c => {
      if (!Array.isArray(c.alerts) || c.alerts.length === 0) return c.alarm || c.notification;
      return c.alerts.length > 0;
    }).length,
    Projects: chits.filter(c => c.is_project_master && !c.deleted && !c.archived).length,
    Tasks: unique.filter(c => c.status || c.due_datetime).length,
    Notes: unique.filter(c => c.note && c.note.trim() !== '').length,
    Email: unique.filter(c => c.email_message_id || c.email_status).length,
  };
  document.querySelectorAll('.tab').forEach(tab => {
    const onclick = tab.getAttribute('onclick') || '';
    const match = onclick.match(/filterChits\('(\w+)'\)/);
    if (!match) return;
    const name = match[1];
    // Never show count for Calendar
    if (name === 'Calendar') {
      const existing = tab.querySelector('.tab-count');
      if (existing) existing.remove();
      return;
    }
    const count = counts[name];
    if (count === undefined) return;
    let countSpan = tab.querySelector('.tab-count');
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'tab-count';
      countSpan.style.cssText = 'font-size:0.75em;opacity:0.6;margin-left:0.2em;';
      tab.appendChild(countSpan);
    }
    countSpan.textContent = `(${count})`;
  });
}

function _applyChitDisplayOptions() {
  const _hlOverdueCb = document.getElementById('highlight-overdue');
  const _hlBlockedCb = document.getElementById('highlight-blocked');
  const anyHighlight = (_hlOverdueCb ? _hlOverdueCb.checked : !!_chitOptions.highlight_overdue_chits)
    || (_hlBlockedCb ? _hlBlockedCb.checked : true);
  if (!_chitOptions.fade_past_chits && !anyHighlight) return;
  const now = new Date();

  // Fade past timed events in calendar
  if (_chitOptions.fade_past_chits && currentTab === 'Calendar') {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    document.querySelectorAll('.timed-event, .day-event').forEach(el => {
      const col = el.closest('.day-column') || el.closest('[style*="position:relative"]');
      if (!col) return;
      const isToday = col.classList.contains('today');

      // Determine if this column is a past day by finding its .today sibling
      let isPastDay = false;
      if (!isToday && col.parentElement) {
        const siblings = Array.from(col.parentElement.querySelectorAll('.day-column'));
        const todayIdx = siblings.findIndex(s => s.classList.contains('today'));
        const thisIdx = siblings.indexOf(col);
        if (todayIdx >= 0 && thisIdx >= 0 && thisIdx < todayIdx) isPastDay = true;
        // If no today column visible, check by date data attribute or skip
        if (todayIdx < 0) isPastDay = false; // can't determine, don't fade
      }

      const top = parseInt(el.style.top) || 0;
      const height = parseInt(el.style.height) || 0;
      const endMin = top + height;

      // Only fade if: past day, OR today and event has ended
      if (isPastDay || (isToday && endMin < nowMin)) {
        el.style.opacity = '0.45';
      }
    });

    // Fade past all-day events
    document.querySelectorAll('.all-day-event').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (chit) {
        const info = getCalendarDateInfo(chit);
        if (info.hasDate && info.end < now) el.style.opacity = '0.45';
      }
    });

    // Fade past month events
    document.querySelectorAll('.month-event').forEach(el => {
      const dayCell = el.closest('.month-day');
      if (!dayCell || !dayCell.dataset.date) return;
      const cellDate = new Date(dayCell.dataset.date + 'T23:59:59');
      if (cellDate < todayStart) el.style.opacity = '0.45';
    });
  }

  // Fade past chits in non-calendar views (only chits that have ENDED, not overdue ones)
  if (_chitOptions.fade_past_chits && currentTab !== 'Calendar') {
    document.querySelectorAll('.chit-card[data-chit-id]').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (!chit) return;
      // Only fade if the event has an end_datetime that's passed (not due_datetime — that's overdue)
      const endTime = chit.end_datetime ? new Date(chit.end_datetime) : null;
      if (endTime && endTime < now && chit.status !== 'Complete') {
        el.style.opacity = '0.5';
      }
    });
  }

  // Highlight overdue and/or blocked chits — single pass handles both + combo
  {
    const overdueColor = (window._cwocSettings && window._cwocSettings.overdue_border_color) || '#b22222';
    const blockedColor = (window._cwocSettings && window._cwocSettings.blocked_border_color) || '#DAA520';
    const highlightOverdue = document.getElementById('highlight-overdue')?.checked ?? !!_chitOptions.highlight_overdue_chits;
    const highlightBlocked = document.getElementById('highlight-blocked')?.checked ?? true;

    if (!highlightOverdue && !highlightBlocked) return;

    document.querySelectorAll('.chit-card[data-chit-id], .timed-event[data-chit-id], .all-day-event[data-chit-id], .month-event[data-chit-id]').forEach(el => {
      const chitId = el.dataset.chitId;
      const chit = chits.find(c => c.id === chitId);
      if (!chit) return;

      const dueTime = chit.due_datetime ? new Date(chit.due_datetime) : null;
      const isOverdue = highlightOverdue && dueTime && dueTime < now && chit.status !== 'Complete';
      const isBlocked = highlightBlocked && chit.status === 'Blocked';

      if (isOverdue && isBlocked) {
        // Both: alternating dashed border using background-image gradient trick (longer 16px dashes)
        el.style.border = 'none';
        el.style.borderRadius = '4px';
        el.style.outline = 'none';
        el.style.backgroundImage = 'repeating-linear-gradient(90deg, ' + overdueColor + ' 0, ' + overdueColor + ' 16px, ' + blockedColor + ' 16px, ' + blockedColor + ' 32px), ' +
          'repeating-linear-gradient(180deg, ' + overdueColor + ' 0, ' + overdueColor + ' 16px, ' + blockedColor + ' 16px, ' + blockedColor + ' 32px), ' +
          'repeating-linear-gradient(90deg, ' + overdueColor + ' 0, ' + overdueColor + ' 16px, ' + blockedColor + ' 16px, ' + blockedColor + ' 32px), ' +
          'repeating-linear-gradient(180deg, ' + overdueColor + ' 0, ' + overdueColor + ' 16px, ' + blockedColor + ' 16px, ' + blockedColor + ' 32px)';
        el.style.backgroundSize = '100% 3px, 3px 100%, 100% 3px, 3px 100%';
        el.style.backgroundPosition = '0 0, 100% 0, 0 100%, 0 0';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.padding = el.style.padding || '0.5em 0.7em';
        el.style.opacity = '';
      } else if (isOverdue) {
        el.style.border = '3px solid ' + overdueColor;
        el.style.borderRadius = '4px';
        el.style.opacity = '';
      } else if (isBlocked) {
        el.style.border = '3px solid ' + blockedColor;
        el.style.borderRadius = '4px';
      }
    });
  }
}


/* ── DOMContentLoaded — initialization and keyboard event dispatcher ─────── */
document.addEventListener("DOMContentLoaded", function () {
  console.debug("DOM fully loaded, initializing...");

  // Initialize the shared sidebar with dashboard-specific callbacks
  // (handles: mobile sidebar, topbar restore, version fetch, tag/people filters, notifications)
  _initDashboardSidebar();

  // Initialize mobile Views button (replaces tab bar on mobile)
  if (typeof initMobileViewsButton === 'function') initMobileViewsButton();

  // Add close button to reference overlay for mobile
  if (typeof initMobileReferenceClose === 'function') initMobileReferenceClose();

  // Restore persisted view mode button highlights
  _restoreViewModeButtons();

  // Always fetch independent alerts — needed for the alarm checker regardless of view mode
  _fetchIndependentAlerts();

  // Default: hide archived chits, show pinned
  const saInit = document.getElementById('show-archived');
  if (saInit) saInit.checked = false;

  // Try to restore previous UI state (from editor return)
  const restored = _restoreUIState();
  if (!restored) {
    currentTab = "Calendar";
  }
  // Update mobile Views button to reflect restored tab
  if (typeof _updateMobileViewsLabel === 'function') _updateMobileViewsLabel();
  // Ensure clear-filters button reflects restored filter state
  _updateClearFiltersButton();

  // Hide Order on Calendar, show date nav + period
  const orderSection = document.getElementById('section-order');
  if (orderSection) orderSection.style.display = (currentTab === 'Calendar' || currentTab === 'Indicators' || currentTab === 'Email') ? 'none' : '';
  const periodSection = document.getElementById('section-period');
  if (periodSection) periodSection.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const yearWeekContainer = document.getElementById('year-week-container');
  if (yearWeekContainer) yearWeekContainer.style.display = (currentTab === 'Calendar') ? '' : 'none';
  const kanbanSection = document.getElementById('section-kanban');
  if (kanbanSection) kanbanSection.style.display = (currentTab === 'Projects') ? '' : 'none';
  const alarmsSection = document.getElementById('section-alarms-mode');
  if (alarmsSection) alarmsSection.style.display = (currentTab === 'Alarms') ? '' : 'none';
  const tasksSection = document.getElementById('section-tasks-mode');
  if (tasksSection) tasksSection.style.display = (currentTab === 'Tasks') ? '' : 'none';
  const indSection = document.getElementById('section-indicators');
  if (indSection) indSection.style.display = (currentTab === 'Indicators') ? '' : 'none';
  if (currentTab === 'Indicators') {
    var filtersInit = document.getElementById('section-filters');
    if (filtersInit) filtersInit.style.display = 'none';
  }
  // Show email sidebar controls if restored tab is Email
  if (typeof _updateEmailSidebarVisibility === 'function') {
    _updateEmailSidebarVisibility(currentTab);
  }

  _renderSavedSearches();
  _updateSortUI();
  loadSavedLocations().then(function () {
    // Pre-load weather for default location into cache
    var defaultLoc = getDefaultLocation();
    if (defaultLoc && defaultLoc.address) {
      var cacheKey = 'cwoc_weather_cache_' + defaultLoc.address.toLowerCase().trim();
      // Fetch in background — don't block UI
      _fetchWeatherForCache(defaultLoc.address, cacheKey);
    }
  });

  // ESC in sidebar tag search box blurs it and clears search
  const tagSearchInput = document.getElementById('tag-filter-search');
  if (tagSearchInput) {
    tagSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); tagSearchInput.blur(); tagSearchInput.value = ''; _filterTagCheckboxes(); }
    });
  }

  // Pre-load week start day setting before rendering calendar
  getCachedSettings().then(s => {
    if (s.week_start_day !== undefined) _weekStartDay = parseInt(s.week_start_day) || 0;
    if (s.work_start_hour !== undefined) _workStartHour = parseInt(s.work_start_hour) || 8;
    if (s.work_end_hour !== undefined) _workEndHour = parseInt(s.work_end_hour) || 17;
    if (s.work_days) _workDays = s.work_days.split(',').map(Number);
    if (s.enabled_periods) _enabledPeriods = s.enabled_periods.split(',');
    if (s.custom_days_count) _customDaysCount = parseInt(s.custom_days_count) || 7;
    if (s.all_view_start_hour !== undefined) _allViewStartHour = parseInt(s.all_view_start_hour) || 0;
    if (s.all_view_end_hour !== undefined) _allViewEndHour = parseInt(s.all_view_end_hour) || 24;
    if (s.day_scroll_to_hour !== undefined) _dayScrollToHour = parseInt(s.day_scroll_to_hour) || 5;
    if (s.chit_options) _chitOptions = { ..._chitOptions, ...s.chit_options };
    // Load border color settings for overdue/blocked highlighting
    window._cwocSettings = window._cwocSettings || {};
    if (s.overdue_border_color) window._cwocSettings.overdue_border_color = s.overdue_border_color;
    if (s.blocked_border_color) window._cwocSettings.blocked_border_color = s.blocked_border_color;
    // Initialize hide-declined checkbox from saved setting
    var _hdCb = document.getElementById('hide-declined');
    if (_hdCb && s.hide_declined === '1') _hdCb.checked = true;
    // Initialize highlight checkboxes from chit_options
    var _hlOverdue = document.getElementById('highlight-overdue');
    if (_hlOverdue) _hlOverdue.checked = !!_chitOptions.highlight_overdue_chits;
    var _hlBlocked = document.getElementById('highlight-blocked');
    if (_hlBlocked) _hlBlocked.checked = (_chitOptions.highlight_blocked_chits !== false);
    // Load default filters per tab
    const df = s.default_filters;
    if (df && typeof df === 'object' && !Array.isArray(df)) {
      _defaultFilters = df;
    }
    // Apply custom view/tab order
    _applyViewOrder(s.view_order);
    // Now fetch chits and render with correct settings
    _applyEnabledPeriods();

    // Re-align currentWeekStart to the correct week start day now that settings are loaded
    if (currentWeekStart && (currentView === 'Week' || currentView === 'Work')) {
      currentWeekStart = getWeekStart(currentWeekStart);
    }
    // Check for weather page nav intent BEFORE fetching — overrides view/date state
    _checkWeatherNavIntent();
    // Check for jump-tab intent (from quick alert "Create & View" on other pages)
    try {
      var jumpTab = localStorage.getItem('cwoc_jump_tab');
      if (jumpTab) {
        localStorage.removeItem('cwoc_jump_tab');
        currentTab = jumpTab;
        if (jumpTab === 'Alarms') {
          var jumpMode = localStorage.getItem('cwoc_jump_alarms_mode');
          localStorage.removeItem('cwoc_jump_alarms_mode');
          if (jumpMode === 'independent' && typeof _alarmsViewMode !== 'undefined') {
            _alarmsViewMode = 'independent';
            var toggle = document.getElementById('alerts-view-toggle');
            if (toggle) toggle.value = 'independent';
          }
        }
      }
    } catch(e) {}

    // Check for ?tab= URL parameter (used by ntfy click URLs and deep links)
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var urlTab = urlParams.get('tab');
      if (urlTab) {
        currentTab = urlTab;
        if (urlTab === 'Alarms') {
          var urlView = urlParams.get('view');
          if (urlView === 'independent' && typeof _alarmsViewMode !== 'undefined') {
            _alarmsViewMode = 'independent';
            var toggle = document.getElementById('alerts-view-toggle');
            if (toggle) toggle.value = 'independent';
          }
        }
        // Update tab highlight
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        var activeTab = document.querySelector(".tab[onclick=\"filterChits('" + currentTab + "')\"]");
        if (activeTab) activeTab.classList.add('active');
        // Clean URL without reloading
        history.replaceState(null, '', '/');
      }
    } catch(e) {}

    fetchChits();
    updateDateRange();
    // Check for pending delete-undo from editor
    _checkPendingDeleteUndo();
    // Prefetch weather for all saved locations (async, non-blocking)
    if (typeof prefetchSavedLocationWeather === 'function') prefetchSavedLocationWeather();

    // Schedule weather refresh every 4 hours on the hour (midnight, 4am, 8am, noon, 4pm, 8pm)
    (function _scheduleWeatherRefresh() {
      var now = new Date();
      var nextHour = Math.ceil(now.getHours() / 4) * 4;
      if (nextHour === now.getHours() && now.getMinutes() === 0) nextHour += 4;
      if (nextHour >= 24) nextHour = 0;
      var next = new Date(now);
      next.setHours(nextHour, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      var msUntilNext = next.getTime() - now.getTime();
      console.debug('Weather refresh scheduled in ' + Math.round(msUntilNext / 60000) + ' min');
      setTimeout(function _doWeatherRefresh() {
        console.debug('Weather refresh triggered');
        _invalidateSettingsCache();
        window._weatherForecastCache = {};
        try { localStorage.removeItem('cwoc_weather_forecast_cache'); } catch(e) {}
        if (typeof prefetchSavedLocationWeather === 'function') prefetchSavedLocationWeather();
        if (typeof _prefetchChitWeather === 'function') _prefetchChitWeather(chits);
        // Schedule next in 4 hours
        setTimeout(_doWeatherRefresh, 4 * 60 * 60 * 1000);
      }, msUntilNext);
    })();
  }).catch(() => {
    fetchChits();
    updateDateRange();
  });
  restoreSidebarState();
  _checkTabOverflow();
  _startGlobalAlertSystem();

  // ── Delegated click handler for chit title links ──────────────────────
  // Ensures storePreviousState() is called before navigating to the editor
  // via any <a> link inside a chit card header (single-click on title).
  // Cmd/Ctrl+click opens in a new tab.
  (function() {
    var chitList = document.getElementById('chit-list');
    if (!chitList) return;
    chitList.addEventListener('click', function(e) {
      var link = e.target.closest('a[href*="/editor"]');
      if (!link) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        window.open(link.getAttribute('href'), '_blank');
      } else {
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = link.getAttribute('href');
      }
    });

    // Cmd/Ctrl+dblclick on any chit card → open in new tab
    chitList.addEventListener('dblclick', function(e) {
      if (!e.metaKey && !e.ctrlKey) return;
      var card = e.target.closest('[data-chit-id]');
      if (!card) return;
      var chitId = card.dataset.chitId;
      if (!chitId) return;
      e.preventDefault();
      e.stopPropagation();
      window.open('/editor?id=' + chitId, '_blank');
    }, true); // capture phase to intercept before individual handlers
  })();

  // ── Mobile swipe on calendar to navigate periods ──────────────────────
  (function() {
    var chitList = document.getElementById('chit-list');
    if (!chitList) return;
    var _swStartX = 0, _swStartY = 0;
    var SWIPE_MIN = 60;
    var EDGE_ZONE = 30;
    var _swiping = false;

    chitList.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      _swStartX = t.clientX;
      _swStartY = t.clientY;
    }, { passive: true });

    chitList.addEventListener('touchend', function(e) {
      if (_swiping) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - _swStartX;
      var dy = Math.abs(t.clientY - _swStartY);
      if (Math.abs(dx) < SWIPE_MIN || dy > Math.abs(dx)) return;
      if (_swStartX < EDGE_ZONE) return;
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) return;
      if (currentTab !== 'Calendar') return;

      _swiping = true;
      var goNext = dx < 0;

      // Find the inner scrollable content (not the headers/time labels)
      var inner = chitList.querySelector('.week-view') || chitList.querySelector('.day-view') || chitList.querySelector('.month-view') || chitList.firstElementChild;
      if (!inner) { _swiping = false; if (goNext) nextPeriod(); else previousPeriod(); return; }

      // Save current scroll position
      var savedScroll = inner.scrollTop || 0;

      // Slide-out animation on the inner content only
      var slideDir = goNext ? '-100%' : '100%';
      inner.style.transition = 'transform 0.2s ease-out';
      inner.style.transform = 'translateX(' + slideDir + ')';

      setTimeout(function() {
        inner.style.transition = 'none';
        inner.style.transform = '';

        if (goNext) { nextPeriod(); } else { previousPeriod(); }

        // Restore scroll and slide-in after render
        requestAnimationFrame(function() {
          var newInner = chitList.querySelector('.week-view') || chitList.querySelector('.day-view') || chitList.querySelector('.month-view') || chitList.firstElementChild;
          if (newInner) {
            newInner.scrollTop = savedScroll;
            newInner.style.transition = 'none';
            newInner.style.transform = 'translateX(' + (goNext ? '100%' : '-100%') + ')';
            requestAnimationFrame(function() {
              newInner.style.transition = 'transform 0.25s ease-out';
              newInner.style.transform = 'translateX(0)';
              setTimeout(function() {
                newInner.style.transition = '';
                newInner.style.transform = '';
                _swiping = false;
              }, 260);
            });
          } else {
            _swiping = false;
          }
        });
      }, 200);
    }, { passive: true });
  })();

  // ── Mobile swipe on header bar to cycle through views ──────────────────
  (function() {
    var headerEl = document.querySelector('.header');
    if (!headerEl) return;
    var _tbSwStartX = 0, _tbSwStartY = 0;
    var _tbSwiping = false;
    var SWIPE_MIN = 60;

    var _tabOrder = ['Calendar', 'Checklists', 'Alarms', 'Projects', 'Tasks', 'Notes', 'Email', 'Indicators', 'Search'];

    headerEl.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      _tbSwStartX = t.clientX;
      _tbSwStartY = t.clientY;
    }, { passive: true });

    headerEl.addEventListener('touchend', function(e) {
      if (_tbSwiping) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - _tbSwStartX;
      var dy = Math.abs(t.clientY - _tbSwStartY);
      if (Math.abs(dx) < SWIPE_MIN || dy > Math.abs(dx)) return;

      // Don't swipe if sidebar is open
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) return;

      _tbSwiping = true;
      var goNext = dx < 0;
      var curIdx = _tabOrder.indexOf(currentTab);
      if (curIdx < 0) curIdx = 0;
      var newIdx = goNext ? curIdx + 1 : curIdx - 1;
      if (newIdx < 0) newIdx = _tabOrder.length - 1;
      if (newIdx >= _tabOrder.length) newIdx = 0;

      filterChits(_tabOrder[newIdx]);
      setTimeout(function() { _tbSwiping = false; }, 300);
    }, { passive: true });
  })();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const startDateTime = document.getElementById("start_datetime");
  const startTime = document.getElementById("start_time");
  const endDateTime = document.getElementById("end_datetime");
  const endTime = document.getElementById("end_time");

  if (startDateTime) startDateTime.value = formatDate(now);
  if (startTime) startTime.value = formatTime(now);
  if (endDateTime) endDateTime.value = formatDate(now);
  if (endTime) endTime.value = formatTime(oneHourLater);

  flatpickr("#start_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#start_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
    onChange: function (selectedDates, dateStr, instance) {
      const startTime = new Date(`1970-01-01T${dateStr}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const endTimeInput = document.getElementById("end_time");
      if (
        !endTimeInput._flatpickr.selectedDates.length &&
        !document.getElementById("all_day").checked
      ) {
        endTimeInput._flatpickr.setDate(formatTime(endTime));
      }
    },
  });
  flatpickr("#end_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#end_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });
  flatpickr("#due_datetime", { dateFormat: "Y-M-d" });
  flatpickr("#due_time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
  });

  // ── Debounced resize listener for breakpoint-crossing re-renders ──────────
  _lastBreakpointCategory = _getBreakpointCategory();
  window.addEventListener("resize", _onDebouncedResize);

  // ── Keyboard shortcuts (hotkey state machine) ────────────────────────────
  document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const tag = el?.tagName?.toLowerCase();
    const inputType = el?.type?.toLowerCase();
    const isTextInput = (tag === "input" && inputType !== "checkbox" && inputType !== "radio")
      || tag === "textarea" || tag === "select"
      || el?.isContentEditable;
    if (isTextInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    const keyLower = key.toLowerCase();

    // ── ESC: exit any submenu or close reference ──
    // Shift+ESC: clear all values in the active filter panel
    if (key === "Escape") {
      // Calculator popover — close before any other ESC action
      if (typeof cwocIsCalculatorOpen === 'function' && cwocIsCalculatorOpen()) {
        cwocCloseCalculator();
        return;
      }

      if (e.shiftKey && (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY' || _hotkeyMode === 'FILTER_PEOPLE')) {
        if (_hotkeyMode === 'FILTER_PEOPLE') {
          if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
          if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
          onFilterChange();
          _exitHotkeyMode();
          return;
        }
        const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
          : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
        document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'FILTER') {
        // Clear ALL filters
        document.querySelectorAll('#status-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#label-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#priority-multi input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        const sp = document.getElementById('show-pinned'); if (sp) sp.checked = true;
        const sa = document.getElementById('show-archived'); if (sa) sa.checked = true;
        const su = document.getElementById('show-unmarked'); if (su) su.checked = true;
        const search = document.getElementById('search'); if (search) search.value = '';
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      if (e.shiftKey && _hotkeyMode === 'ORDER') {
        currentSortField = null;
        const sel = document.getElementById('sort-select'); if (sel) sel.value = '';
        _updateSortUI();
        displayChits();
        _exitHotkeyMode();
        return;
      }
      if (document.getElementById('reference-overlay')?.classList.contains('active')) {
        _closeReference();
        return;
      }
      if (document.getElementById('clock-modal-overlay')) {
        _closeClockModal();
        return;
      }
      if (document.getElementById('weather-modal-overlay')) {
        // First Escape: blur the dropdown/input if focused; second Escape: close modal
        var weatherDropdown = document.getElementById('weather-modal-loc-dropdown');
        var weatherInput = document.getElementById('weather-modal-manual-input');
        if (weatherDropdown && document.activeElement === weatherDropdown) {
          weatherDropdown.blur();
          return;
        }
        if (weatherInput && document.activeElement === weatherInput) {
          weatherInput.blur();
          return;
        }
        _closeWeatherModal();
        return;
      }
      if (document.getElementById('cwoc-quick-alert-overlay')) {
        _closeQuickAlertModal();
        return;
      }
      if (_hotkeyMode) {
        _exitHotkeyMode();
        return;
      }
      return;
    }

    // ── Reference overlay toggle (R) / Help page (Shift+R) ──
    if (keyLower === 'r' && !_hotkeyMode) {
      e.preventDefault();
      if (e.shiftKey) {
        openHelpPage();
      } else {
        _toggleReference();
      }
      return;
    }

    // Close reference if open and any other key pressed
    if (document.getElementById('reference-overlay')?.classList.contains('active')) {
      _closeReference();
    }

    // ── NAVIGATE submenu (after 'V') ──
    if (_hotkeyMode === 'NAVIGATE') {
      e.preventDefault();
      var num = parseInt(key);
      if (num >= 1 && num <= _navTargets.length) {
        _pickNav(_navTargets[num - 1]);
      } else if (key === '0' && _navTargets.length >= 10) {
        _pickNav(_navTargets[9]);
      }
      return;
    }

    // ── PERIOD submenu (after '.') ──
    if (_hotkeyMode === 'PERIOD') {
      const periodMap = { i: 'Itinerary', d: 'Day', w: 'Week', k: 'Work', x: 'SevenDay', m: 'Month', y: 'Year' };
      if (periodMap[keyLower]) {
        e.preventDefault();
        _pickPeriod(periodMap[keyLower]);
      }
      return;
    }

    // ── MODE submenu (after 'M') ──
    if (_hotkeyMode === 'MODE') {
      e.preventDefault();
      if (window._modeKeyMap && window._modeKeyMap[keyLower]) {
        window._modeKeyMap[keyLower]();
      }
      return;
    }

    // ── FILTER submenu (after 'F') ──
    if (_hotkeyMode === 'FILTER') {
      e.preventDefault();
      // Backspace/Delete: clear ALL filters
      if (key === 'Backspace' || key === 'Delete') {
        _clearAllFilters();
        _exitHotkeyMode();
        return;
      }
      if (keyLower === 's') {
        _enterFilterSub('status');
      } else if (keyLower === 't') {
        _enterFilterSub('label');
      } else if (keyLower === 'p') {
        _enterFilterSub('priority');
      } else if (keyLower === 'a') {
        _toggleFilterArchived();
      } else if (keyLower === 'i') {
        _toggleFilterPinned();
      } else if (keyLower === 'd') {
        _filterFocusSearch();
      } else if (keyLower === 'e') {
        _enterFilterSub('people');
      }
      return;
    }

    // ── Inside a multi-select filter (number keys toggle, Enter/letter confirms) ──
    if (_hotkeyMode === 'FILTER_STATUS' || _hotkeyMode === 'FILTER_LABEL' || _hotkeyMode === 'FILTER_PRIORITY') {
      // Skip if tag search box is focused (let user type)
      if (_hotkeyMode === 'FILTER_LABEL' && document.activeElement?.closest('#panel-label-options')) return;

      const containerId = _hotkeyMode === 'FILTER_STATUS' ? 'status-multi'
        : _hotkeyMode === 'FILTER_LABEL' ? 'label-multi' : 'priority-multi';
      const panelId = _hotkeyMode === 'FILTER_STATUS' ? 'panel-status-options'
        : _hotkeyMode === 'FILTER_LABEL' ? 'panel-label-options' : 'panel-priority-options';
      const boxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);

      // Backspace/Delete: clear this filter
      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (_hotkeyMode === 'FILTER_LABEL') {
          // Clear tag selection
          if (window._sidebarTagSelection) window._sidebarTagSelection.length = 0;
          _syncSidebarTagCheckboxes(document.getElementById('label-multi'), _cachedTagObjects);
          onFilterChange();
          _buildTagFilterPanel();
        } else {
          boxes.forEach(cb => { cb.checked = false; });
          const anyCb = document.querySelector(`#${containerId} input[data-any="true"]`);
          if (anyCb) anyCb.checked = true;
          onFilterChange();
          const panelOptions = document.querySelectorAll(`#${panelId} .hotkey-panel-option`);
          panelOptions.forEach(opt => opt.classList.remove('selected'));
        }
        return;
      }

      if (key === 'Enter') {
        e.preventDefault();
        onFilterChange();
        _exitHotkeyMode();
        return;
      }

      // Number keys toggle (1-9)
      const num = parseInt(key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        if (_hotkeyMode === 'FILTER_LABEL') {
          // Use the visible tag panel list items
          const panelItems = document.querySelectorAll('#panel-label-options .cwoc-sidebar-filter-list .hotkey-panel-option');
          if (num <= panelItems.length) {
            panelItems[num - 1].click();
          }
        } else {
          if (num <= boxes.length) {
            const cb = boxes[num - 1];
            cb.checked = !cb.checked;
            // Handle Any toggle
            if (cb.dataset.any) {
              onFilterAnyToggle(cb);
            } else {
              const filterType = cb.dataset.filter;
              if (filterType) onFilterSpecificToggle(filterType);
            }
            onFilterChange();
            const panelOptions = document.querySelectorAll(`#${panelId} .hotkey-panel-option`);
            if (panelOptions[num - 1]) {
              panelOptions[num - 1].classList.toggle('selected', cb.checked);
            }
          }
        }
        return;
      }
      return;
    }

    // ── Inside people filter (number keys toggle, Enter confirms) ──
    if (_hotkeyMode === 'FILTER_PEOPLE') {
      if (document.activeElement?.closest('#panel-people-options')) return;
      if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (window._sidebarPeopleSelection) window._sidebarPeopleSelection.length = 0;
        if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
        onFilterChange();
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        onFilterChange();
        _exitHotkeyMode();
        return;
      }
      const num = parseInt(key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const panelItems = document.querySelectorAll('#panel-people-options .cwoc-sidebar-filter-list .hotkey-panel-option');
        if (num <= panelItems.length) {
          panelItems[num - 1].click();
        }
        return;
      }
      return;
    }

    // ── ORDER submenu (after 'O') ──
    if (_hotkeyMode === 'ORDER') {
      e.preventDefault();
      const orderMap = { t: 'title', s: 'start', d: 'due', u: 'updated', c: 'created', x: 'status', m: 'manual', r: 'random', g: 'upcoming' };
      if (orderMap[keyLower]) {
        _pickSort(orderMap[keyLower]);
        return;
      }
      if (key === 'ArrowUp') {
        currentSortDir = 'asc';
        _updateSortUI();
        displayChits();
        return;
      }
      if (key === 'ArrowDown') {
        currentSortDir = 'desc';
        _updateSortUI();
        displayChits();
        return;
      }
      return;
    }

    // ── Top-level hotkeys (shared dispatch) ──
    // Tab switching + action keys (K, S, W, L, R) are handled by shared-hotkeys.js
    if (typeof _cwocDispatchHotkey === 'function' && _cwocDispatchHotkey(e)) {
      return;
    }

    if (keyLower === 'm' && !_hotkeyMode) {
      e.preventDefault();
      if (e.shiftKey) {
        _openModePanel();
      } else {
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/maps';
      }
      return;
    }

    if (key === '.') {
      e.preventDefault();
      if (currentTab === 'Calendar') {
        _hotkeyMode = 'PERIOD';
        expandSidebarSection('section-period');
        _showPanel('panel-period');
      }
      return;
    }

    if (keyLower === 'f') {
      e.preventDefault();
      _hotkeyMode = 'FILTER';
      _expandFiltersSection();
      expandSidebarSection('section-filters');
      _showPanel('panel-filter');
      return;
    }

    if (keyLower === 'o') {
      e.preventDefault();
      _hotkeyMode = 'ORDER';
      expandSidebarSection('section-order');
      _showPanel('panel-order');
      return;
    }

    if (keyLower === 'v' && !_hotkeyMode) {
      e.preventDefault();
      _hotkeyMode = 'NAVIGATE';
      _showPanel('panel-navigate');
      return;
    }
  });

  // Fetch version for footer copyright tooltip
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : {}; }).then(function(d) {
    var el = document.getElementById('cwoc-footer-copyright');
    if (el && d.version) el.title = 'Version ' + d.version;
  }).catch(function() {});
});
