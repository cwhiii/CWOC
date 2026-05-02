/**
 * main-views.js — List-based views for the dashboard (non-calendar tabs).
 *
 * Contains:
 *   - Checklists view (displayChecklistView)
 *   - Tasks view (displayTasksView)
 *   - Notes view (displayNotesView)
 *   - Projects view (displayProjectsView, _displayProjectsKanban)
 *   - Alarms view (displayAlarmsView, _displayIndependentAlertsBoard)
 *   - Indicators view (displayIndicatorsView)
 *   - Chit header builder (_buildChitHeader, _renderChitMeta)
 *   - Tab filtering (filterChits, searchChits)
 *   - View mode toggles (_setProjectsMode, _setAlarmsMode)
 *   - Independent alerts CRUD (_fetchIndependentAlerts, _createIndependentAlert, etc.)
 *   - Independent alert card builders (_buildSaAlarmCard, _buildSaTimerCard, _buildSaStopwatchCard)
 *
 * Depends on globals from main.js: currentTab, chits, currentSortField, currentSortDir,
 *   _cachedTagObjects, _chitOptions, _defaultFilters, _snoozeRegistry
 * Depends on shared.js: applyChitColors, contrastColorForBg, isSystemTag, getPastelColor,
 *   formatDate, formatTime, renderInlineChecklist, enableDragToReorder, getManualOrder,
 *   applyManualOrder, resolveChitLinks, enableLongPress, showQuickEditModal,
 *   _getAllIndicators, _shouldShow, _STATUS_ICONS, enableNotesDragReorder, applyNotesLayout
 */

/* ── Shared chit helpers ──────────────────────────────────────────────────── */

/** Check if a chit is shared with viewer-only access (no inline edits allowed). */
function _isViewerRole(chit) {
  return chit._shared && chit.effective_role === 'viewer';
}

/**
 * Build an expandable note preview element.
 * On mobile, shows a "show more / show less" toggle when content overflows.
 * On desktop, behaves as before (truncated with overflow hidden).
 *
 * @param {object} chit - The chit object
 * @param {string} [extraStyle] - Additional inline CSS (e.g. margin-top)
 * @returns {HTMLElement} - A wrapper div containing the note preview and toggle
 */
function _buildNotePreview(chit, extraStyle) {
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'flex:1;min-width:0;' + (extraStyle || '');

  var notePreview = document.createElement('div');
  notePreview.className = 'note-preview';
  if (typeof marked !== 'undefined') {
    notePreview.innerHTML = resolveChitLinks(marked.parse(chit.note.slice(0, 500)), chits);
  } else {
    notePreview.textContent = chit.note.slice(0, 300) + (chit.note.length > 300 ? '…' : '');
  }
  wrapper.appendChild(notePreview);

  // Toggle button (visible only on mobile via CSS)
  var toggle = document.createElement('div');
  toggle.className = 'note-preview-toggle';
  toggle.textContent = 'show more…';
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    var expanded = notePreview.classList.toggle('note-preview-expanded');
    toggle.textContent = expanded ? 'show less' : 'show more…';
  });
  wrapper.appendChild(toggle);

  return wrapper;
}

/** Check if a chit is shared (has an effective_role from the sharing system). */
function _isSharedChit(chit) {
  return !!chit._shared;
}

/* ── RSVP helpers ────────────────────────────────────────────────────────── */

/**
 * Returns the current user's rsvp_status from a chit's shares array,
 * or null if the user is not a shared user (e.g. owner or not in shares).
 */
function _getUserRsvpStatus(chit) {
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return null;
  var shares = Array.isArray(chit.shares) ? chit.shares : [];
  for (var i = 0; i < shares.length; i++) {
    if (shares[i].user_id === user.user_id) {
      return shares[i].rsvp_status || 'invited';
    }
  }
  return null;
}

/**
 * Returns true if the current user has declined this shared chit.
 * Returns false for owned chits (owners don't have RSVP status).
 */
function _isDeclinedByCurrentUser(chit) {
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return false;
  // Owners don't have RSVP status
  if (chit.owner_id === user.user_id) return false;
  return _getUserRsvpStatus(chit) === 'declined';
}

/* ── Helper: empty state message ─────────────────────────────────────────── */

/** Build a styled empty-state message with an optional Create Chit button. */
function _emptyState(message) {
  return '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;">' +
    '<p style="font-size:1.1em;margin-bottom:0.8em;">' + message + '</p>' +
    '<button class="standard-button" onclick="storePreviousState(); window.location.href=\'/editor\';" style="font-family:inherit;">+ Create Chit</button>' +
  '</div>';
}

/* ── Tag color helpers ───────────────────────────────────────────────────── */

/** Get tag color from cached settings tags, fallback to pastel */
function _getTagColor(tagName) {
  var tag = _cachedTagObjects.find(function(t) { return t.name === tagName; });
  return (tag && tag.color) ? tag.color : getPastelColor(tagName);
}

/** Get tag font color from cached settings tags, fallback to dark brown */
function _getTagFontColor(tagName) {
  var tag = _cachedTagObjects.find(function(t) { return t.name === tagName; });
  return (tag && tag.fontColor) ? tag.fontColor : '#2b1e0f';
}

/* ── Chit header builder ─────────────────────────────────────────────────── */
function _buildChitHeader(chit, titleHtml, settings, opts) {
  var _opts = opts || {};
  const row = document.createElement('div');
  row.className = 'chit-header-row';

  const left = document.createElement('div');
  left.className = 'chit-header-left';

  if (chit.pinned) {
    const icon = document.createElement('i');
    icon.className = 'fas fa-bookmark';
    icon.title = 'Pinned';
    icon.style.fontSize = '0.85em';
    left.appendChild(icon);
  }
  if (chit.archived) {
    const icon = document.createElement('span');
    icon.textContent = '📦';
    icon.title = 'Archived';
    left.appendChild(icon);
  }

  // Stealth indicator — visible only to the owner (Requirement 6.5)
  if (chit.stealth) {
    var _stealthUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    var _isStealthOwner = _stealthUser && chit.owner_id === _stealthUser.user_id;
    if (_isStealthOwner) {
      var stealthIcon = document.createElement('span');
      stealthIcon.textContent = '🥷';
      stealthIcon.title = 'Stealth — hidden from other users';
      stealthIcon.className = 'cwoc-stealth-indicator';
      left.appendChild(stealthIcon);
    }
  }

  // Sub-chit indicator (child of a project)
  if (!chit.is_project_master) {
    var isSubChit = chits.some(function(c) {
      return c.is_project_master && Array.isArray(c.child_chits) && c.child_chits.includes(chit.id);
    });
    if (isSubChit) {
      var subIcon = document.createElement('i');
      subIcon.className = 'fas fa-project-diagram';
      subIcon.title = 'Sub-chit (part of a project)';
      subIcon.style.cssText = 'font-size:0.75em;opacity:0.6;';
      left.appendChild(subIcon);
    }
  }

  // Visual indicators (alerts, weather, people, recurrence)
  if (settings && typeof _getAllIndicators === 'function') {
    const indicators = _getAllIndicators(chit, settings, 'card');
    if (indicators) {
      const alertSpan = document.createElement('span');
      alertSpan.className = 'alert-indicators';
      alertSpan.textContent = indicators;
      left.appendChild(alertSpan);
    }
  }

  // Weather indicator — icon only, details in tooltip
  if (chit.location && chit.location.trim()) {
    var weatherMode = (settings || {}).weather || 'always';
    if (typeof _shouldShow === 'function' && _shouldShow(weatherMode, 'card')) {
      const wxSpan = document.createElement('span');
      wxSpan.className = 'chit-weather-indicator';
      wxSpan.dataset.chitLocation = chit.location;

      // Prefer stored weather_data from backend
      var wd = chit.weather_data;
      if (typeof wd === 'string') { try { wd = JSON.parse(wd); } catch (e) { wd = null; } }
      if (wd && wd.weather_code !== undefined && wd.high !== undefined && wd.low !== undefined) {
        var wdIcon = _getWeatherIcon(wd.weather_code);
        var wdHighF = _celsiusToFahrenheit(wd.high);
        var wdLowF = _celsiusToFahrenheit(wd.low);
        var wdStale = _isWeatherStale(wd.updated_time) ? '⏳' : '';
        var wdTooltip = wdHighF + '°/' + wdLowF + '°';
        var wdPrecipText = _formatPrecip(wd.precipitation, wd.weather_code);
        if (wdPrecipText) wdTooltip += ' · ' + wdPrecipText;
        if (wdStale) wdTooltip += ' (stale)';
        wxSpan.textContent = wdStale + wdIcon;
        wxSpan.title = wdTooltip;
      } else {
        // Fallback: live-fetch weather indicator
        var wxCacheKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
        var wxCached = null;
        try { wxCached = JSON.parse(localStorage.getItem(wxCacheKey)); } catch (e) {}
        if (wxCached && wxCached.icon && (Date.now() - wxCached.ts < 3600000)) {
          wxSpan.textContent = wxCached.icon;
          wxSpan.title = wxCached.tooltip;
        } else {
          wxSpan.textContent = '⏳';
          wxSpan.title = 'Loading weather…';
          _queueChitWeatherFetch(chit.location, wxSpan);
        }
      }
      left.appendChild(wxSpan);
    }
  }

  const title = document.createElement('span');
  title.className = 'chit-header-title';
  if (titleHtml) {
    title.innerHTML = titleHtml;
  } else {
    title.textContent = chit.title || '(Untitled)';
  }
  left.appendChild(title);

  // Checklist count inline with title (for Checklists view)
  if (_opts.checklistCount && Array.isArray(chit.checklist) && chit.checklist.length > 0) {
    var _clItems = chit.checklist;
    var _clChecked = _clItems.filter(function(i) { return i.checked || i.done; }).length;
    var countSpan = document.createElement('span');
    countSpan.className = 'checklist-progress-count';
    countSpan.dataset.chitId = chit.id;
    countSpan.style.cssText = 'font-size:0.8em;opacity:0.7;margin-left:0.5em;font-weight:normal;white-space:nowrap;';
    countSpan.textContent = '(' + _clChecked + '/' + _clItems.length + ' ✓)';
    left.appendChild(countSpan);
  }

  row.appendChild(left);

  // Meta values in a single row on the right
  const right = document.createElement('div');
  right.className = 'chit-header-meta';

  const sortIndicator = currentSortDir === 'asc' ? ' ▲' : ' ▼';

  function addMeta(text, fieldName) {
    const s = document.createElement('span');
    s.textContent = text;
    if (currentSortField === fieldName) {
      s.style.fontWeight = 'bold';
      s.textContent = text + sortIndicator;
    }
    right.appendChild(s);
  }

  if (chit.status && !_opts.hideStatus) {
    const statusSpan = document.createElement('span');
    statusSpan.textContent = chit.status;
    if (chit.status === 'Blocked') {
      var blockedCol = (window._cwocSettings && window._cwocSettings.blocked_border_color) || '#DAA520';
      var blockedTextCol = contrastColorForBg(blockedCol);
      statusSpan.style.cssText = 'background:' + blockedCol + ';color:' + blockedTextCol + ';font-weight:bold;padding:1px 6px;border-radius:3px;';
    }
    if (currentSortField === 'status') {
      statusSpan.style.fontWeight = 'bold';
      statusSpan.textContent = chit.status + sortIndicator;
    }
    right.appendChild(statusSpan);
  }
  if (chit.priority) addMeta(chit.priority, null);

  // Due date — colored + bold if overdue, using configurable color with contrast background
  if (chit.due_datetime) {
    const dueDate = new Date(chit.due_datetime);
    const isOverdue = dueDate < new Date() && chit.status !== 'Complete';
    const s = document.createElement('span');
    if (isOverdue) {
      // Format as YYYY-MMM-DD for past-due items
      var _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var _pdYear = dueDate.getFullYear();
      var _pdMon = _months[dueDate.getMonth()];
      var _pdDay = String(dueDate.getDate()).padStart(2, '0');
      s.textContent = 'Past Due: ' + _pdYear + '-' + _pdMon + '-' + _pdDay;
      var overdueCol = (window._cwocSettings && window._cwocSettings.overdue_border_color) || '#b22222';
      var overdueTextCol = contrastColorForBg(overdueCol);
      s.style.cssText = 'background:' + overdueCol + ';color:' + overdueTextCol + ';font-weight:bold;padding:1px 6px;border-radius:3px;';
    } else {
      s.textContent = `Due: ${formatDate(dueDate)}`;
    }
    if (currentSortField === 'due') { s.style.fontWeight = 'bold'; s.textContent += (currentSortDir === 'asc' ? ' ▲' : ' ▼'); }
    right.appendChild(s);
  }

  if (chit.start_datetime) addMeta(`Start: ${formatDate(new Date(chit.start_datetime))}`, 'start');
  if (chit.modified_datetime) addMeta(`Updated: ${formatDate(new Date(chit.modified_datetime))}`, 'updated');
  if (chit.created_datetime) addMeta(`Created: ${formatDate(new Date(chit.created_datetime))}`, 'created');
  const tags = (chit.tags || []).filter(t => !isSystemTag(t));
  if (tags.length > 0) {
    tags.forEach(tagName => {
      const tagColor = _getTagColor(tagName);
      const tagFontColor = _getTagFontColor(tagName);
      const chip = document.createElement('span');
      chip.style.cssText = `display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.75em;margin-left:4px;background:${tagColor};color:${tagFontColor};`;
      chip.textContent = tagName.split('/').pop();
      right.appendChild(chip);
    });
  }

  // RSVP status indicators — show each shared user's RSVP status (Requirements 3.1–3.5)
  var _rsvpShares = Array.isArray(chit.shares) ? chit.shares : [];
  if (_rsvpShares.length > 0) {
    var _rsvpWrap = document.createElement('span');
    _rsvpWrap.className = 'cwoc-rsvp-indicators';
    _rsvpShares.forEach(function(entry) {
      var indicator = document.createElement('span');
      indicator.className = 'cwoc-rsvp-indicator';
      var status = entry.rsvp_status || 'invited';
      var displayName = entry.display_name || entry.user_id || 'Unknown';
      if (status === 'accepted') {
        indicator.textContent = '✓';
        indicator.classList.add('cwoc-rsvp-accepted');
      } else if (status === 'declined') {
        indicator.textContent = '✗';
        indicator.classList.add('cwoc-rsvp-declined');
      } else {
        indicator.textContent = '⏳';
        indicator.classList.add('cwoc-rsvp-invited');
      }
      indicator.title = displayName + ' — ' + status;
      _rsvpWrap.appendChild(indicator);
    });
    right.appendChild(_rsvpWrap);
  }

  // RSVP action controls — accept/decline buttons for shared users (Requirements 2.1–2.4)
  var _rsvpUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (_rsvpUser && chit._shared && chit.owner_id !== _rsvpUser.user_id) {
    var _userShare = _rsvpShares.find(function(s) { return s.user_id === _rsvpUser.user_id; });
    if (_userShare) {
      var _rsvpCurrentStatus = _userShare.rsvp_status || 'invited';
      var _rsvpBtnWrap = document.createElement('span');
      _rsvpBtnWrap.className = 'cwoc-rsvp-actions';

      var _acceptBtn = document.createElement('button');
      _acceptBtn.className = 'cwoc-rsvp-btn cwoc-rsvp-accept-btn';
      _acceptBtn.textContent = '✓';
      _acceptBtn.title = 'Accept invitation';
      if (_rsvpCurrentStatus === 'accepted') _acceptBtn.classList.add('cwoc-rsvp-btn-active');

      var _declineBtn = document.createElement('button');
      _declineBtn.className = 'cwoc-rsvp-btn cwoc-rsvp-decline-btn';
      _declineBtn.textContent = '✗';
      _declineBtn.title = 'Decline invitation';
      if (_rsvpCurrentStatus === 'declined') _declineBtn.classList.add('cwoc-rsvp-btn-active');

      _acceptBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var prevStatus = _acceptBtn.classList.contains('cwoc-rsvp-btn-active') ? 'accepted' : _rsvpCurrentStatus;
        _acceptBtn.classList.add('cwoc-rsvp-btn-active');
        _declineBtn.classList.remove('cwoc-rsvp-btn-active');
        fetch('/api/chits/' + chit.id + '/rsvp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp_status: 'accepted' })
        }).then(function(r) {
          if (r.ok) { fetchChits(); }
          else {
            console.error('RSVP accept failed:', r.status);
            // Revert button state
            if (prevStatus === 'accepted') _acceptBtn.classList.add('cwoc-rsvp-btn-active');
            else _acceptBtn.classList.remove('cwoc-rsvp-btn-active');
            if (prevStatus === 'declined') _declineBtn.classList.add('cwoc-rsvp-btn-active');
          }
        }).catch(function(err) {
          console.error('RSVP accept error:', err);
          if (prevStatus === 'accepted') _acceptBtn.classList.add('cwoc-rsvp-btn-active');
          else _acceptBtn.classList.remove('cwoc-rsvp-btn-active');
          if (prevStatus === 'declined') _declineBtn.classList.add('cwoc-rsvp-btn-active');
        });
      });

      _declineBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var prevStatus = _declineBtn.classList.contains('cwoc-rsvp-btn-active') ? 'declined' : _rsvpCurrentStatus;
        _declineBtn.classList.add('cwoc-rsvp-btn-active');
        _acceptBtn.classList.remove('cwoc-rsvp-btn-active');
        fetch('/api/chits/' + chit.id + '/rsvp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp_status: 'declined' })
        }).then(function(r) {
          if (r.ok) { fetchChits(); }
          else {
            console.error('RSVP decline failed:', r.status);
            if (prevStatus === 'declined') _declineBtn.classList.add('cwoc-rsvp-btn-active');
            else _declineBtn.classList.remove('cwoc-rsvp-btn-active');
            if (prevStatus === 'accepted') _acceptBtn.classList.add('cwoc-rsvp-btn-active');
          }
        }).catch(function(err) {
          console.error('RSVP decline error:', err);
          if (prevStatus === 'declined') _declineBtn.classList.add('cwoc-rsvp-btn-active');
          else _declineBtn.classList.remove('cwoc-rsvp-btn-active');
          if (prevStatus === 'accepted') _acceptBtn.classList.add('cwoc-rsvp-btn-active');
        });
      });

      _rsvpBtnWrap.appendChild(_acceptBtn);
      _rsvpBtnWrap.appendChild(_declineBtn);
      right.appendChild(_rsvpBtnWrap);
    }
  }

  // Shared icon with tooltip (Requirements 4.1, 4.2, 4.3, 4.4)
  if (chit._shared && chit.effective_role) {
    var sharedIcon = document.createElement('span');
    sharedIcon.className = 'cwoc-shared-icon';
    sharedIcon.textContent = '🔗';

    // Build tooltip: owner, shared users with roles, current user's role
    var tooltipLines = [];
    tooltipLines.push('Owner: ' + (chit.owner_display_name || 'Unknown'));
    var shares = Array.isArray(chit.shares) ? chit.shares : [];
    if (shares.length > 0) {
      tooltipLines.push('Shared with:');
      shares.forEach(function(entry) {
        var name = entry.display_name || entry.user_id || 'Unknown';
        var role = (entry.role || 'viewer').charAt(0).toUpperCase() + (entry.role || 'viewer').slice(1);
        tooltipLines.push('  ' + name + ' (' + role + ')');
      });
    }
    tooltipLines.push('Your role: ' + chit.effective_role.charAt(0).toUpperCase() + chit.effective_role.slice(1));
    sharedIcon.title = tooltipLines.join('\n');

    right.appendChild(sharedIcon);
  }

  // Assignee display name (Requirement 7.4)
  if (chit.assigned_to_display_name) {
    var assigneeBadge = document.createElement('span');
    assigneeBadge.className = 'cwoc-assignee-badge';
    assigneeBadge.textContent = '📌 ' + chit.assigned_to_display_name;
    assigneeBadge.title = 'Assigned to: ' + chit.assigned_to_display_name;
    right.appendChild(assigneeBadge);
  }

  row.appendChild(right);
  return row;
}

// Compact meta for Notes view (just icons before title, no meta row)
function _renderChitMeta(chit, mode) {
  // Legacy — kept for any remaining callers but views should use _buildChitHeader
  const meta = document.createElement('div');
  meta.className = 'chit-meta';
  return meta;
}

/* ── List-based views ────────────────────────────────────────────────────── */
function displayChecklistView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const checklistView = document.createElement("div");
  checklistView.className = "checklist-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Only show chits that have checklist items
  const checklistChits = chitsToDisplay.filter(c =>
    Array.isArray(c.checklist) && c.checklist.length > 0
  );

  // Only apply default sort if no global sort is active
  const sortedChits = currentSortField ? checklistChits : [...checklistChits].sort((a, b) => {
    const dateA = new Date(
      a.last_edited || a.created_datetime || a.start_datetime || 0,
    );
    const dateB = new Date(
      b.last_edited || b.created_datetime || b.start_datetime || 0,
    );
    return dateB - dateA;
  });

  if (sortedChits.length === 0)
    checklistView.innerHTML = _emptyState("No checklists found.");
  else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.draggable = true;
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.status === "Complete") chitElement.classList.add("completed-task");
      if (chit.archived) chitElement.classList.add("archived-chit");
      if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

      chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings, { checklistCount: true }));

      // Strike out the title when every checklist item is checked
      const _clItems = chit.checklist || [];
      const _clAllChecked = _clItems.length > 0 && _clItems.every(i => i.checked || i.done);
      if (_clAllChecked) chitElement.classList.add('checklist-all-done');
      // Interactive checklist from shared.js (disabled for viewer-role shared chits)
      if (!_isViewerRole(chit)) {
        renderInlineChecklist(chitElement, chit, () => fetchChits());
      } else {
        // Read-only checklist display for viewers — only show unchecked items
        var roList = document.createElement('div');
        roList.style.cssText = 'opacity:0.8;font-size:0.9em;';
        (chit.checklist || []).forEach(function(item) {
          if (item.checked || item.done) return;
          var row = document.createElement('div');
          row.style.cssText = 'padding:2px 0;';
          row.textContent = '☐ ' + (item.text || item.label || '');
          roList.appendChild(row);
        });
        chitElement.appendChild(roList);
      }

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);

  // Build long-press map for unified touch gesture (drag + quick-edit)
  var _clLongPressMap = {};
  sortedChits.forEach(function (chit) {
    if (!_isViewerRole(chit)) {
      _clLongPressMap[chit.id] = function () { showQuickEditModal(chit, function () { displayChits(); }); };
    }
  });
  enableDragToReorder(checklistView, 'Checklists', () => displayChits(), _clLongPressMap);
}

function displayTasksView(chitsToDisplay) {
  if (_tasksViewMode === 'habits') {
    return displayHabitsView(chitsToDisplay);
  }
  if (_tasksViewMode === 'assigned') {
    return displayAssignedToMeView(chitsToDisplay);
  }

  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  let taskChits = chitsToDisplay.filter(
    (chit) => chit.status || chit.due_datetime,
  );

  // Default sort: by status (ToDo → In Progress → Blocked → Complete at bottom)
  if (!currentSortField) {
    const statusOrder = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, '': 4, 'Complete': 5 };
    taskChits.sort((a, b) => (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4));
  }

  if (taskChits.length === 0) {
    chitList.innerHTML = _emptyState("No tasks found.");
    return;
  }

  const tasksContainer = document.createElement("div");
  tasksContainer.className = "checklist-view"; // reuse consistent spacing

  taskChits.forEach((chit) => {
    const chitElement = document.createElement("div");
    chitElement.className = "chit-card";
    chitElement.draggable = true;
    chitElement.dataset.chitId = chit.id;
    if (chit.archived) chitElement.classList.add("archived-chit");
    applyChitColors(chitElement, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.status === "Complete") chitElement.classList.add("completed-task");
    if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

    chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings, { hideStatus: true }));

    // Status + note preview in a row
    const controls = document.createElement("div");
    controls.style.cssText = "margin-top:0.3em;display:flex;align-items:flex-start;gap:0.8em;";

    // Status icon + dropdown (left)
    const statusWrap = document.createElement("div");
    statusWrap.style.cssText = "display:flex;align-items:center;gap:0.5em;flex-shrink:0;";
    // Status icon
    if (chit.status && typeof _STATUS_ICONS !== 'undefined' && _STATUS_ICONS[chit.status]) {
      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = _STATUS_ICONS[chit.status];
      statusWrap.appendChild(iconSpan);
    }
    const label = document.createElement("span");
    label.textContent = "Status:";
    statusWrap.appendChild(label);

    const statusDropdown = document.createElement("select");
    statusDropdown.style.cssText = "font-family:inherit;font-size:inherit;";
    ["ToDo", "In Progress", "Blocked", "Complete"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      if (chit.status === status) option.selected = true;
      statusDropdown.appendChild(option);
    });
    if (!chit.status) statusDropdown.value = "";

    // Style dropdown based on current status
    function _styleStatusDropdown() {
      var val = statusDropdown.value;
      var blockedCol = (window._cwocSettings && window._cwocSettings.blocked_border_color) || '#DAA520';
      var overdueCol = (window._cwocSettings && window._cwocSettings.overdue_border_color) || '#b22222';
      if (val === 'Blocked') {
        statusDropdown.style.backgroundColor = blockedCol;
        statusDropdown.style.color = contrastColorForBg(blockedCol);
        statusDropdown.style.border = '2px solid ' + blockedCol;
        statusDropdown.style.fontWeight = 'bold';
      } else if (val === 'Complete') {
        statusDropdown.style.backgroundColor = '';
        statusDropdown.style.color = '';
        statusDropdown.style.border = '';
        statusDropdown.style.fontWeight = '';
        statusDropdown.style.opacity = '0.6';
      } else {
        statusDropdown.style.backgroundColor = '';
        statusDropdown.style.color = '';
        statusDropdown.style.border = '';
        statusDropdown.style.fontWeight = '';
        statusDropdown.style.opacity = '';
      }
    }
    _styleStatusDropdown();

    // Disable status dropdown for viewer-role shared chits
    if (_isViewerRole(chit)) {
      statusDropdown.disabled = true;
      statusDropdown.title = 'Read-only — shared chit';
    }

    statusDropdown.addEventListener("change", () => {
      _styleStatusDropdown();
      fetch(`/api/chits/${chit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chit, status: statusDropdown.value || null }),
      }).then(r => { if (r.ok) fetchChits(); });
    });
    statusWrap.appendChild(statusDropdown);
    controls.appendChild(statusWrap);

    // Note preview (right, rendered markdown — expandable on mobile)
    if (chit.note && chit.note.trim()) {
      controls.appendChild(_buildNotePreview(chit));
    }

    chitElement.appendChild(controls);

    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    tasksContainer.appendChild(chitElement);
  });
  chitList.appendChild(tasksContainer);

  // Build long-press map for unified touch gesture (drag + quick-edit)
  var _tkLongPressMap = {};
  taskChits.forEach(function (chit) {
    if (!_isViewerRole(chit)) {
      _tkLongPressMap[chit.id] = function () { showQuickEditModal(chit, function () { displayChits(); }); };
    }
  });
  enableDragToReorder(tasksContainer, 'Tasks', () => displayChits(), _tkLongPressMap);
}

/* ── Habits View ─────────────────────────────────────────────────────────── */

/**
 * Check if a habit's reset period is currently active (user acted within the period).
 * @param {object} chit - The chit object
 * @returns {boolean} true if the reset period is active and the user should wait
 */
function _isResetPeriodActive(chit) {
  if (!chit.habit_reset_period || !chit.habit_last_action_date) return false;
  var lastAction = new Date(chit.habit_last_action_date + 'T00:00:00');
  if (isNaN(lastAction.getTime())) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse "N:UNIT" format (e.g., "3:DAILY") or legacy "DAILY"
  var resetStr = chit.habit_reset_period;
  var resetNum = 1;
  var resetUnit = resetStr;
  if (resetStr.indexOf(':') !== -1) {
    var parts = resetStr.split(':');
    resetNum = parseInt(parts[0]) || 1;
    resetUnit = parts[1];
  }

  // Calculate the reset end date: lastAction + N units
  var resetEnd = new Date(lastAction);
  if (resetUnit === 'DAILY') {
    resetEnd.setDate(resetEnd.getDate() + resetNum);
  } else if (resetUnit === 'WEEKLY') {
    resetEnd.setDate(resetEnd.getDate() + resetNum * 7);
  } else if (resetUnit === 'MONTHLY') {
    resetEnd.setMonth(resetEnd.getMonth() + resetNum);
  } else {
    return false;
  }

  // Reset is active if today is before the reset end date
  return today < resetEnd;
}

/**
 * Get the date when the reset period expires as a formatted string.
 * Returns null if no reset period or no last action date.
 */
function _getResetEndDate(chit) {
  if (!chit.habit_reset_period || !chit.habit_last_action_date) return null;
  var lastAction = new Date(chit.habit_last_action_date + 'T00:00:00');
  if (isNaN(lastAction.getTime())) return null;

  var resetStr = chit.habit_reset_period;
  var resetNum = 1;
  var resetUnit = resetStr;
  if (resetStr.indexOf(':') !== -1) {
    var parts = resetStr.split(':');
    resetNum = parseInt(parts[0]) || 1;
    resetUnit = parts[1];
  }

  var resetEnd = new Date(lastAction);
  if (resetUnit === 'DAILY') resetEnd.setDate(resetEnd.getDate() + resetNum);
  else if (resetUnit === 'WEEKLY') resetEnd.setDate(resetEnd.getDate() + resetNum * 7);
  else if (resetUnit === 'MONTHLY') resetEnd.setMonth(resetEnd.getMonth() + resetNum);
  else return null;

  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[resetEnd.getMonth()] + ' ' + resetEnd.getDate();
}

/**
 * Calculate urgency score for a habit — lower = more urgent (needs action sooner).
 * Returns the number of days until the next action is needed.
 *
 * Logic:
 * - If the habit has remaining completions and a reset period:
 *   days until cycle ends / remaining completions (spread evenly)
 * - If no reset period: days until cycle ends / remaining completions
 * - Daily habits with work to do: 0 (most urgent)
 *
 * @param {object} h — habit data object with chit, goal, success
 * @returns {number} days until next action needed (lower = more urgent)
 */
function _habitUrgencyScore(h) {
  var chit = h.chit;
  var remaining = h.goal - h.success;
  if (remaining <= 0) return 9999; // complete — least urgent

  var rule = chit.recurrence_rule;
  var freq = (rule && rule.freq) ? rule.freq : 'DAILY';

  // Calculate days left in the current cycle
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var currentPeriod = (typeof getCurrentPeriodDate === 'function') ? getCurrentPeriodDate(chit) : null;
  var daysInCycle = 1;
  if (freq === 'DAILY') daysInCycle = 1;
  else if (freq === 'WEEKLY') daysInCycle = 7;
  else if (freq === 'MONTHLY') daysInCycle = 30;
  else if (freq === 'YEARLY') daysInCycle = 365;

  var daysLeft = daysInCycle;
  if (currentPeriod) {
    var periodStart = new Date(currentPeriod + 'T00:00:00');
    var elapsed = Math.floor((today - periodStart) / 86400000);
    daysLeft = Math.max(1, daysInCycle - elapsed);
  }

  // Days per remaining completion — how often you need to act
  var daysPerAction = daysLeft / remaining;

  return daysPerAction;
}

/**
 * Get today's date as an ISO string (YYYY-MM-DD).
 */
function _getTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Render the Habits view — one card per chit with habit=true.
 * Cards show progress (X/Y), frequency, streak 🔥, success rate %, status badge.
 * Goal=1 habits get a checkbox; goal>1 habits get +/− counter buttons.
 */
function displayHabitsView(chitsToDisplay) {
  var chitList = document.getElementById('chit-list');
  chitList.innerHTML = '';

  // 6.1 — Filter by explicit habit flag, not recurrence_rule presence
  var habitChits = chitsToDisplay.filter(function(chit) {
    return chit.habit === true;
  });

  if (habitChits.length === 0) {
    chitList.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;">' +
      '<p style="font-size:1.1em;margin-bottom:0.8em;">No habits yet. Mark a recurring chit as a habit in the editor to start tracking.</p>' +
      '</div>';
    return;
  }

  // Read success window setting
  var settings = window._cwocSettings || {};
  var windowDays = settings.habits_success_window || '30';

  // Build habit data: evaluate rollover, compute metrics
  var habitData = habitChits.map(function(chit) {
    // Lazy rollover before rendering
    var rolledOver = _evaluateHabitRollover(chit);
    if (rolledOver) {
      _persistHabitRollover(chit);
    }
    var goal = chit.habit_goal || 1;
    var success = chit.habit_success || 0;
    var isCompleted = success >= goal;

    // Calculate success rate from habit rollover snapshots + current period.
    var exceptions = chit.recurrence_exceptions || [];
    var periodEntries = [];
    for (var ei = 0; ei < exceptions.length; ei++) {
      var ex = exceptions[ei];
      if (!ex.date || ex.broken_off) continue;
      // Only count entries with habit-specific fields (from period rollover snapshots)
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        periodEntries.push(ex);
      }
    }
    // Add current period only if goal is met (in-progress periods don't count against you)
    if (isCompleted) {
      periodEntries.push({ habit_success: success, habit_goal: goal, _current: true });
    }

    // Apply window filter (window is number of entries, not days, for this simple calc)
    var windowCount = (windowDays === 'all') ? periodEntries.length : parseInt(windowDays, 10) || 30;
    var windowEntries = periodEntries.slice(-windowCount);

    var metCount = 0;
    for (var wi = 0; wi < windowEntries.length; wi++) {
      if (windowEntries[wi].habit_success >= windowEntries[wi].habit_goal) metCount++;
    }
    var successRate = windowEntries.length > 0 ? Math.round((metCount / windowEntries.length) * 100) : 0;

    // Streak: count consecutive met periods walking backward from past snapshots
    var streak = 0;
    // Walk backward through past snapshots only (not current in-progress)
    for (var si = periodEntries.length - 1; si >= 0; si--) {
      if (periodEntries[si].habit_success >= periodEntries[si].habit_goal) {
        streak++;
      } else {
        break;
      }
    }

    // Detailed logging for debugging
    var exDetails = [];
    for (var di = 0; di < periodEntries.length; di++) {
      var pe = periodEntries[di];
      exDetails.push((pe._current ? '*' : '') + (pe.date || 'now') + ':' + pe.habit_success + '/' + pe.habit_goal);
    }
    console.log('[Habit] ' + (chit.title || chit.id) +
      ': current=' + success + '/' + goal + (isCompleted ? ' ✓' : '') +
      ', periods=[' + exDetails.join(', ') + ']' +
      ', rate=' + metCount + '/' + windowEntries.length + '=' + successRate + '%' +
      ', streak=' + streak);

    return {
      chit: chit,
      goal: goal,
      success: success,
      isCompleted: isCompleted,
      successRate: successRate,
      metCount: metCount,
      totalPeriods: windowEntries.length,
      streak: streak
    };
  });

  var habitsContainer = document.createElement('div');
  habitsContainer.className = 'checklist-view';

  // 6.8 — Sort: incomplete first, completed last
  _renderHabitCards(habitsContainer, habitData, windowDays);

  chitList.appendChild(habitsContainer);
}

/**
 * Render habit cards into the container. Sorts incomplete first, completed last.
 */
function _renderHabitCards(container, habitData, windowDays) {
  container.innerHTML = '';

  // Split into 3 groups: On Deck, Out of Mind, Accomplished
  var onDeck = [];
  var outOfMind = [];
  var completed = [];

  habitData.forEach(function(h) {
    if (h.isCompleted) {
      completed.push(h);
    } else if (h.chit.habit_reset_period && _isResetPeriodActive(h.chit) && h.success > 0 && h.success < h.goal) {
      outOfMind.push(h);
    } else {
      onDeck.push(h);
    }
  });

  // Sort on-deck: most time-urgent first.
  // "When do I need to do this next?" — soonest deadline at the top.
  // For habits with a reset: next action = when reset expires
  // For habits without reset: next action = time left in cycle / remaining completions
  onDeck.sort(function(a, b) {
    return _habitUrgencyScore(a) - _habitUrgencyScore(b);
  });

  var sorted = onDeck.concat(outOfMind).concat(completed);

  if (sorted.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'cwoc-empty';
    emptyMsg.style.cssText = 'text-align:center;padding:2em 1em;opacity:0.7;';
    emptyMsg.innerHTML = '<p>All habits completed! ✨</p>';
    container.appendChild(emptyMsg);
    return;
  }

  // Section header: On Deck
  if (onDeck.length > 0) {
    var onDeckHeader = document.createElement('div');
    onDeckHeader.className = 'habit-section-header';
    onDeckHeader.innerHTML = '<span class="habit-section-icon">🔜</span> On Deck';
    container.appendChild(onDeckHeader);
  }

  var outOfMindHeaderAdded = false;
  var completedHeaderAdded = false;

  sorted.forEach(function(h) {
    // Insert "Out of Mind" header before the first out-of-mind habit
    if (!outOfMindHeaderAdded && outOfMind.indexOf(h) !== -1) {
      outOfMindHeaderAdded = true;
      var restingHeader = document.createElement('div');
      restingHeader.className = 'habit-section-header habit-section-resting';
      restingHeader.innerHTML = '😌 Out of Mind';
      container.appendChild(restingHeader);
    }

    // Insert "Accomplished" header before the first completed habit
    if (h.isCompleted && !completedHeaderAdded) {
      completedHeaderAdded = true;
      var doneHeader = document.createElement('div');
      doneHeader.className = 'habit-section-header habit-section-done';
      doneHeader.innerHTML = '✅ Accomplished';
      container.appendChild(doneHeader);
    }

    var chit = h.chit;
    var isResting = outOfMind.indexOf(h) !== -1;
    var card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.chitId = chit.id;
    if (h.isCompleted) card.classList.add('habit-done');
    if (isResting) card.classList.add('habit-resting');
    if (typeof applyChitColors === 'function') {
      applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    }

    // ── Header row: interaction control + title + frequency ──
    var header = document.createElement('div');
    header.className = 'habit-header';

    if (h.goal === 1) {
      // 6.4 — Checkbox interaction for goal=1 habits
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = h.isCompleted;
      // Disable if reset period is active
      var _resetActive = (h.success > 0) && _isResetPeriodActive(chit);
      if (_resetActive && !h.isCompleted) {
        checkbox.disabled = true;
        checkbox.title = 'Reset period active — wait for cooldown';
        checkbox.style.opacity = '0.4';
      } else {
        checkbox.title = h.isCompleted ? 'Mark as not done' : 'Mark as done for this period';
      }
      checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        var newSuccess = checkbox.checked ? 1 : 0;
        // 6.7 — Cap at goal
        if (newSuccess > h.goal) newSuccess = h.goal;
        // Update local chit object for accumulation
        chit.habit_success = newSuccess;
        if (newSuccess >= h.goal) {
          chit.status = 'Complete';
        } else if (chit.status === 'Complete') {
          chit.status = '';
        }
        // Set last action date when incrementing
        if (newSuccess > 0) {
          chit.habit_last_action_date = _getTodayISO();
        }
        // Optimistic UI update
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      header.appendChild(checkbox);
    }

    // Title as clickable link
    var titleLink = document.createElement('a');
    titleLink.href = '/editor?id=' + chit.id;
    titleLink.textContent = chit.title || '(Untitled)';
    titleLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    header.appendChild(titleLink);

    // Period label (e.g., "Week of Apr 28" or "May 2026")
    var periodLabel = (typeof _formatCurrentPeriodLabel === 'function') ? _formatCurrentPeriodLabel(chit) : '';
    if (periodLabel) {
      var sep = document.createElement('span');
      sep.className = 'habit-separator';
      sep.textContent = ' · ';
      header.appendChild(sep);
      var periodSpan = document.createElement('span');
      periodSpan.className = 'habit-frequency';
      periodSpan.textContent = periodLabel;
      header.appendChild(periodSpan);
    }

    // Status badge — show inline with title for habits
    if (h.isCompleted) {
      // Compute next cycle start date
      var _nextPeriod = '';
      var _rule = chit.recurrence_rule;
      if (_rule && _rule.freq && typeof getCurrentPeriodDate === 'function') {
        var _curPeriod = getCurrentPeriodDate(chit);
        if (_curPeriod && typeof _getPreviousPeriodDate === 'function') {
          // _getPreviousPeriodDate goes backward; we need forward — reverse the logic
          var _freq = _rule.freq;
          var _interval = _rule.interval || 1;
          var _cp = new Date(_curPeriod + 'T00:00:00');
          if (_freq === 'DAILY') _cp.setDate(_cp.getDate() + _interval);
          else if (_freq === 'WEEKLY') _cp.setDate(_cp.getDate() + _interval * 7);
          else if (_freq === 'MONTHLY') _cp.setMonth(_cp.getMonth() + _interval);
          else if (_freq === 'YEARLY') _cp.setFullYear(_cp.getFullYear() + _interval);
          var _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          _nextPeriod = _months[_cp.getMonth()] + ' ' + _cp.getDate();
        }
      }
      var completeLine = document.createElement('span');
      completeLine.className = 'habit-complete-line';
      completeLine.textContent = '✅ Complete for this cycle.' + (_nextPeriod ? ' (Next cycle starts ' + _nextPeriod + '.)' : '');
      header.appendChild(completeLine);
    }

    // Resting label for Out of Mind habits (reset period active, not yet complete)
    if (isResting) {
      var resetEndDate = _getResetEndDate(chit);
      var restingLine = document.createElement('span');
      restingLine.className = 'habit-resting-line';
      restingLine.textContent = '☐ Too soon to complete again. Resets on ' + (resetEndDate || '—') + '.';
      header.appendChild(restingLine);
    }

    card.appendChild(header);

    // ── Metrics row: labeled boxes for each metric ──
    var metrics = document.createElement('div');
    metrics.className = 'habit-metrics';

    // Progress box: "X / Y" with counter buttons
    var progressBox = document.createElement('div');
    progressBox.className = 'habit-metric-box';
    var progressLabel = document.createElement('span');
    progressLabel.className = 'habit-metric-label';
    progressLabel.textContent = '📊 Progress';
    progressBox.appendChild(progressLabel);
    var progressRow = document.createElement('div');
    progressRow.className = 'habit-metric-value';
    var progressSpan = document.createElement('span');
    progressSpan.className = 'habit-progress';
    var _freqLabel = '';
    var _rule = chit.recurrence_rule;
    if (_rule && _rule.freq) {
      if (_rule.freq === 'DAILY') _freqLabel = ' each Day';
      else if (_rule.freq === 'WEEKLY') _freqLabel = ' each Week';
      else if (_rule.freq === 'MONTHLY') _freqLabel = ' each Month';
      else if (_rule.freq === 'YEARLY') _freqLabel = ' each Year';
    }
    progressSpan.textContent = h.success + ' / ' + h.goal + _freqLabel;
    progressSpan.title = 'Progress: ' + h.success + ' of ' + h.goal + ' this period';

    // Counter buttons: [−] progress [+]
    if (h.goal > 1) {
      var _resetActiveCounter = (h.success > 0) && _isResetPeriodActive(chit);

      var minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'habit-counter-btn';
      minusBtn.textContent = '−';
      minusBtn.title = 'Decrement';
      minusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var curSuccess = chit.habit_success || 0;
        if (curSuccess <= 0) return;
        var newSuccess = curSuccess - 1;
        chit.habit_success = newSuccess;
        if (newSuccess < (chit.habit_goal || 1) && chit.status === 'Complete') {
          chit.status = '';
        }
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      progressRow.appendChild(minusBtn);
      progressRow.appendChild(progressSpan);

      var plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'habit-counter-btn';
      plusBtn.textContent = '+';
      plusBtn.title = _resetActiveCounter ? 'Reset period active — wait for cooldown' : 'Increment';
      if (_resetActiveCounter) {
        plusBtn.disabled = true;
        plusBtn.style.opacity = '0.4';
        plusBtn.style.cursor = 'not-allowed';
      }
      plusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        if ((chit.habit_success || 0) > 0 && _isResetPeriodActive(chit)) return;
        var curSuccess = chit.habit_success || 0;
        var goal = chit.habit_goal || 1;
        if (curSuccess >= goal) return;
        var newSuccess = curSuccess + 1;
        chit.habit_success = newSuccess;
        if (newSuccess >= goal) {
          chit.status = 'Complete';
        }
        chit.habit_last_action_date = _getTodayISO();
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      progressRow.appendChild(plusBtn);
    } else {
      progressRow.appendChild(progressSpan);
    }
    progressBox.appendChild(progressRow);
    metrics.appendChild(progressBox);

    // Cycle progress box
    var cyclePct = Math.round((h.success / h.goal) * 100);
    var cycleBox = document.createElement('div');
    cycleBox.className = 'habit-metric-box';
    var cycleLabel = document.createElement('span');
    cycleLabel.className = 'habit-metric-label';
    cycleLabel.textContent = '🎯 Cycle';
    cycleBox.appendChild(cycleLabel);
    var cycleVal = document.createElement('div');
    cycleVal.className = 'habit-metric-value';
    var cycleSpan = document.createElement('span');
    cycleSpan.className = 'habit-cycle-badge';
    cycleSpan.textContent = cyclePct + '%';
    cycleSpan.title = 'This period, ' + h.success + ' of ' + h.goal + ' tasks completed';
    cycleVal.appendChild(cycleSpan);
    cycleBox.appendChild(cycleVal);
    metrics.appendChild(cycleBox);

    // Overall success rate box (hidden if habit_hide_overall is set)
    if (!chit.habit_hide_overall) {
      var overallBox = document.createElement('div');
      overallBox.className = 'habit-metric-box';
      var overallLabel = document.createElement('span');
      overallLabel.className = 'habit-metric-label';
      overallLabel.textContent = '📈 Overall';
      overallBox.appendChild(overallLabel);
      var overallVal = document.createElement('div');
      overallVal.className = 'habit-metric-value';
      var overallSpan = document.createElement('span');
      overallSpan.className = 'habit-success-badge';
      overallSpan.textContent = h.successRate + '%';
      overallSpan.title = 'Completed ' + h.metCount + ' of ' + h.totalPeriods + ' cycles successfully';
      overallVal.appendChild(overallSpan);
      overallBox.appendChild(overallVal);
      metrics.appendChild(overallBox);
    }

    // Streak box (only if streak > 0)
    if (h.streak > 0) {
      var streakBox = document.createElement('div');
      streakBox.className = 'habit-metric-box';
      var streakLabel = document.createElement('span');
      streakLabel.className = 'habit-metric-label';
      streakLabel.textContent = '🔥 Streak';
      streakBox.appendChild(streakLabel);
      var streakVal = document.createElement('div');
      streakVal.className = 'habit-metric-value';
      streakVal.textContent = h.streak;
      streakBox.appendChild(streakVal);
      metrics.appendChild(streakBox);
    }

    // Build card content — if there's a note, use a two-column grid layout
    var hasNote = chit.note && chit.note.trim();
    if (hasNote) {
      var cardGrid = document.createElement('div');
      cardGrid.className = 'habit-card-grid';

      var leftCol = document.createElement('div');
      leftCol.className = 'habit-card-left';
      leftCol.appendChild(header);
      leftCol.appendChild(metrics);
      cardGrid.appendChild(leftCol);

      var notePreview = document.createElement('div');
      notePreview.className = 'habit-note-preview';
      var noteHtml = chit.note
        .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong> ')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^[\-\*]\s+/gm, '• ')
        .replace(/^\d+\.\s+/gm, function(m) { return m.trim() + ' '; })
        .replace(/\n+/g, '  ');
      notePreview.innerHTML = noteHtml.trim();
      cardGrid.appendChild(notePreview);

      card.appendChild(cardGrid);
    } else {
      card.appendChild(header);
      card.appendChild(metrics);
    }

    // ── Interaction: double-click to editor, long-press for quick edit ──
    card.addEventListener('dblclick', function(e) {
      // Don't navigate if the user double-clicked a button or checkbox
      if (e.target.closest('button, input[type="checkbox"]')) return;
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    if (typeof enableTouchGesture === 'function') {
      enableTouchGesture(card, {
        onLongPress: function () {
          showQuickEditModal(chit, function () { displayChits(); });
        },
      });
    }

    container.appendChild(card);
  });
}

/**
 * Debounced habit update — delays 1 second, resets on each click.
 * Stores pending updates per chit ID so rapid clicks accumulate.
 */
var _habitUpdateTimers = {};
var _habitPendingChits = {};

function _persistHabitUpdate(chit) {
  var id = chit.id;
  _habitPendingChits[id] = chit;

  // Clear existing timer for this chit (reset the delay)
  if (_habitUpdateTimers[id]) {
    clearTimeout(_habitUpdateTimers[id]);
  }

  // Set a new 1-second timer
  _habitUpdateTimers[id] = setTimeout(function() {
    delete _habitUpdateTimers[id];
    var pendingChit = _habitPendingChits[id];
    delete _habitPendingChits[id];
    if (!pendingChit) return;

    fetch('/api/chits/' + pendingChit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingChit)
    }).then(function(resp) {
      if (resp.ok && typeof fetchChits === 'function') {
        fetchChits();
      } else if (!resp.ok) {
        console.error('[_persistHabitUpdate] Failed:', resp.status);
      }
    }).catch(function(err) {
      console.error('[_persistHabitUpdate] Error:', err);
    });
  }, 1000);
}

/**
 * Optimistically update a habit card's UI without waiting for server round-trip.
 * Moves the card between On Deck / Accomplished sections with animation.
 */
function _optimisticHabitCardUpdate(card, chit, newSuccess, goal) {
  // Update progress text
  var progressSpan = card.querySelector('.habit-progress');
  if (progressSpan) {
    var _oFreqLabel = '';
    var _oRule = chit.recurrence_rule;
    if (_oRule && _oRule.freq) {
      if (_oRule.freq === 'DAILY') _oFreqLabel = ' each Day';
      else if (_oRule.freq === 'WEEKLY') _oFreqLabel = ' each Week';
      else if (_oRule.freq === 'MONTHLY') _oFreqLabel = ' each Month';
      else if (_oRule.freq === 'YEARLY') _oFreqLabel = ' each Year';
    }
    progressSpan.textContent = newSuccess + ' / ' + goal + _oFreqLabel;
    progressSpan.title = 'Progress: ' + newSuccess + ' of ' + goal + ' this period';
  }

  // Update cycle progress badge
  var cycleBadge = card.querySelector('.habit-cycle-badge');
  if (cycleBadge) {
    var pct = Math.round((newSuccess / goal) * 100);
    cycleBadge.textContent = pct + '%';
    cycleBadge.title = 'This period, ' + newSuccess + ' of ' + goal + ' tasks completed';
  }

  // Update checkbox for goal=1
  var checkbox = card.querySelector('.habit-header input[type="checkbox"]');
  if (checkbox) {
    checkbox.checked = newSuccess >= goal;
  }

  // Check if completion status changed
  var wasCompleted = card.classList.contains('habit-done');
  var isNowCompleted = newSuccess >= goal;

  if (wasCompleted !== isNowCompleted) {
    // Phase 1: fade out the card (400ms)
    card.style.transition = 'opacity 0.4s ease';
    card.style.opacity = '0';

    setTimeout(function() {
      var container = card.closest('.checklist-view');
      if (!container) return;

      // Update card state
      if (isNowCompleted) {
        card.classList.add('habit-done');
        var titleLink = card.querySelector('.habit-header a');
        if (titleLink) titleLink.style.textDecoration = 'line-through';
        _updateStatusBadge(card, 'Complete');
      } else {
        card.classList.remove('habit-done');
        var titleLink = card.querySelector('.habit-header a');
        if (titleLink) titleLink.style.textDecoration = '';
        _updateStatusBadge(card, '');
      }

      // Find or create section headers
      var doneHeader = container.querySelector('.habit-section-done');
      var onDeckHeader = container.querySelector('.habit-section-header:not(.habit-section-done):not(.habit-section-resting)');
      var restingHeader = container.querySelector('.habit-section-resting');

      // Move the card to the correct section
      if (isNowCompleted) {
        card.classList.remove('habit-resting');
        if (!doneHeader) {
          doneHeader = document.createElement('div');
          doneHeader.className = 'habit-section-header habit-section-done';
          doneHeader.innerHTML = '✅ Accomplished';
          container.appendChild(doneHeader);
        }
        doneHeader.insertAdjacentElement('afterend', card);
      } else if (chit.habit_reset_period && _isResetPeriodActive(chit)) {
        // Move to Out of Mind
        card.classList.add('habit-resting');
        if (!restingHeader) {
          restingHeader = document.createElement('div');
          restingHeader.className = 'habit-section-header habit-section-resting';
          restingHeader.innerHTML = '😌 Out of Mind';
          // Insert before Accomplished header or at end
          if (doneHeader) {
            container.insertBefore(restingHeader, doneHeader);
          } else {
            container.appendChild(restingHeader);
          }
        }
        restingHeader.insertAdjacentElement('afterend', card);
      } else {
        if (onDeckHeader) {
          var nextSibling = onDeckHeader.nextElementSibling;
          while (nextSibling && nextSibling.classList.contains('habit-card') && !nextSibling.classList.contains('habit-done')) {
            nextSibling = nextSibling.nextElementSibling;
          }
          container.insertBefore(card, nextSibling);
        } else {
          container.insertBefore(card, container.firstChild);
        }
      }

      // Remove empty On Deck header if no incomplete cards remain
      if (onDeckHeader && !container.querySelector('.habit-card:not(.habit-done)')) {
        onDeckHeader.remove();
      }

      // Phase 2: fade back in (400ms)
      card.style.opacity = '0';
      card.style.transition = 'opacity 0.4s ease';
      // Force reflow so the browser sees opacity:0 before transitioning
      void card.offsetWidth;
      card.style.opacity = isNowCompleted ? '0.6' : '1';

      // Clean up
      setTimeout(function() {
        card.style.transition = '';
      }, 450);
    }, 420);
  }
}

/** Update or remove the status badge on a habit card */
function _updateStatusBadge(card, status) {
  var header = card.querySelector('.habit-header');
  if (!header) return;
  var existing = header.querySelector('.habit-complete-line');
  if (status === 'Complete') {
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'habit-complete-line';
      header.appendChild(existing);
    }
    existing.textContent = '✅ Complete for this cycle.';
  } else if (existing) {
    existing.remove();
  }
}

/* ── Assigned to Me View (Requirement 7.3) ───────────────────────────────── */

/**
 * Render the "Assigned to Me" view — shows only chits where assigned_to
 * matches the current user's ID.
 */
function displayAssignedToMeView(chitsToDisplay) {
  var chitList = document.getElementById('chit-list');
  chitList.innerHTML = '';
  var _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Get current user ID
  var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var currentUserId = currentUser ? currentUser.user_id : null;

  if (!currentUserId) {
    chitList.innerHTML = _emptyState('Unable to determine current user.');
    return;
  }

  // Filter to only chits assigned to the current user
  var assignedChits = chitsToDisplay.filter(function(chit) {
    return chit.assigned_to === currentUserId;
  });

  // Default sort: by status (ToDo → In Progress → Blocked → Complete at bottom)
  if (!currentSortField) {
    var statusOrder = { 'ToDo': 1, 'In Progress': 2, 'Blocked': 3, '': 4, 'Complete': 5 };
    assignedChits.sort(function(a, b) {
      return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
    });
  }

  if (assignedChits.length === 0) {
    chitList.innerHTML = _emptyState('No chits assigned to you.');
    return;
  }

  var container = document.createElement('div');
  container.className = 'checklist-view';

  assignedChits.forEach(function(chit) {
    var chitElement = document.createElement('div');
    chitElement.className = 'chit-card';
    chitElement.draggable = true;
    chitElement.dataset.chitId = chit.id;
    if (chit.archived) chitElement.classList.add('archived-chit');
    applyChitColors(chitElement, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    if (chit.status === 'Complete') chitElement.classList.add('completed-task');
    if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add('declined-chit');

    chitElement.appendChild(_buildChitHeader(chit, '<a href="/editor?id=' + chit.id + '">' + (chit.title || '(Untitled)') + '</a>', _viSettings, { hideStatus: true }));

    // Status + note preview in a row
    var controls = document.createElement('div');
    controls.style.cssText = 'margin-top:0.3em;display:flex;align-items:flex-start;gap:0.8em;';

    // Status icon + dropdown (left)
    var statusWrap = document.createElement('div');
    statusWrap.style.cssText = 'display:flex;align-items:center;gap:0.5em;flex-shrink:0;';
    if (chit.status && typeof _STATUS_ICONS !== 'undefined' && _STATUS_ICONS[chit.status]) {
      var iconSpan = document.createElement('span');
      iconSpan.innerHTML = _STATUS_ICONS[chit.status];
      statusWrap.appendChild(iconSpan);
    }
    var label = document.createElement('span');
    label.textContent = 'Status:';
    statusWrap.appendChild(label);

    var statusDropdown = document.createElement('select');
    statusDropdown.style.cssText = 'font-family:inherit;font-size:inherit;';
    ['ToDo', 'In Progress', 'Blocked', 'Complete'].forEach(function(status) {
      var option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (chit.status === status) option.selected = true;
      statusDropdown.appendChild(option);
    });
    if (!chit.status) statusDropdown.value = '';

    // Disable status dropdown for viewer-role shared chits
    if (_isViewerRole(chit)) {
      statusDropdown.disabled = true;
      statusDropdown.title = 'Read-only — shared chit';
    }

    statusDropdown.addEventListener('change', function() {
      fetch('/api/chits/' + chit.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, chit, { status: statusDropdown.value || null })),
      }).then(function(r) { if (r.ok) fetchChits(); });
    });
    statusWrap.appendChild(statusDropdown);
    controls.appendChild(statusWrap);

    // Note preview (right, rendered markdown — expandable on mobile)
    if (chit.note && chit.note.trim()) {
      controls.appendChild(_buildNotePreview(chit));
    }

    chitElement.appendChild(controls);

    chitElement.addEventListener('dblclick', function() {
      storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    container.appendChild(chitElement);
  });

  chitList.appendChild(container);

  // Build long-press map for unified touch gesture (drag + quick-edit)
  var _amLongPressMap = {};
  assignedChits.forEach(function (chit) {
    if (!_isViewerRole(chit)) {
      _amLongPressMap[chit.id] = function () { showQuickEditModal(chit, function () { displayChits(); }); };
    }
  });
  enableDragToReorder(container, 'AssignedToMe', function() { displayChits(); }, _amLongPressMap);
}

function displayNotesView(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const notesView = document.createElement("div");
  notesView.className = "notes-view";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  const filteredNotes = [...chitsToDisplay].filter((chit) => chit.note && chit.note.trim() !== "");
  const sortedChits = currentSortField ? filteredNotes : filteredNotes.sort((a, b) => {
      const dateA = new Date(
        a.last_edited || a.created_datetime || a.start_datetime || 0,
      );
      const dateB = new Date(
        b.last_edited || b.created_datetime || b.start_datetime || 0,
      );
      return dateB - dateA;
    });

  if (sortedChits.length === 0) {
    notesView.innerHTML = _emptyState("No notes found.");
  } else {
    sortedChits.forEach((chit) => {
      const chitElement = document.createElement("div");
      chitElement.className = "chit-card";
      chitElement.dataset.chitId = chit.id;
      applyChitColors(chitElement, chitColor(chit));
      if (chit.archived) chitElement.classList.add("archived-chit");
      if (_isDeclinedByCurrentUser(chit)) chitElement.classList.add("declined-chit");

      // Simple title with icons
      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:0.3em;font-weight:bold;margin-bottom:0.2em;";
      if (chit.pinned) { const i = document.createElement('i'); i.className = 'fas fa-bookmark'; i.title = 'Pinned'; i.style.fontSize = '0.85em'; titleRow.appendChild(i); }
      if (chit.archived) { const i = document.createElement('span'); i.textContent = '📦'; i.title = 'Archived'; titleRow.appendChild(i); }
      // Stealth indicator — visible only to the owner (Requirement 6.5)
      if (chit.stealth) {
        var _notesStealth = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (_notesStealth && chit.owner_id === _notesStealth.user_id) {
          var _nsi = document.createElement('span'); _nsi.textContent = '🥷'; _nsi.title = 'Stealth — hidden from other users'; _nsi.className = 'cwoc-stealth-indicator'; titleRow.appendChild(_nsi);
        }
      }
      // Alert indicators
      if (typeof _getAllIndicators === 'function') {
        const indicators = _getAllIndicators(chit, _viSettings, 'card');
        if (indicators) { const s = document.createElement('span'); s.className = 'alert-indicators'; s.textContent = indicators; titleRow.appendChild(s); }
      }
      // Weather indicator
      if (chit.location && chit.location.trim()) {
        var _nwMode = (_viSettings || {}).weather || 'always';
        if (typeof _shouldShow === 'function' && _shouldShow(_nwMode, 'card')) {
          const wxSpan = document.createElement('span');
          wxSpan.className = 'chit-weather-indicator';

          // Prefer stored weather_data from backend
          var _nwWd = chit.weather_data;
          if (typeof _nwWd === 'string') { try { _nwWd = JSON.parse(_nwWd); } catch (e) { _nwWd = null; } }
          if (_nwWd && _nwWd.weather_code !== undefined && _nwWd.high !== undefined && _nwWd.low !== undefined) {
            var _nwIcon = _getWeatherIcon(_nwWd.weather_code);
            var _nwHighF = _celsiusToFahrenheit(_nwWd.high);
            var _nwLowF = _celsiusToFahrenheit(_nwWd.low);
            var _nwStale = _isWeatherStale(_nwWd.updated_time) ? '⏳' : '';
            var _nwTooltip = _nwHighF + '°/' + _nwLowF + '°';
            var _nwPrecipText = _formatPrecip(_nwWd.precipitation, _nwWd.weather_code);
            if (_nwPrecipText) _nwTooltip += ' · ' + _nwPrecipText;
            if (_nwStale) _nwTooltip += ' (stale)';
            wxSpan.textContent = _nwStale + _nwIcon;
            wxSpan.title = _nwTooltip;
          } else {
            var _nwKey = 'cwoc_wx_' + chit.location.toLowerCase().trim();
            var _nwCached = null;
            try { _nwCached = JSON.parse(localStorage.getItem(_nwKey)); } catch (e) {}
            if (_nwCached && _nwCached.icon && (Date.now() - _nwCached.ts < 3600000)) {
              wxSpan.textContent = _nwCached.icon;
              wxSpan.title = _nwCached.tooltip;
            } else {
              wxSpan.textContent = '⏳';
              wxSpan.title = 'Loading weather…';
              _queueChitWeatherFetch(chit.location, wxSpan);
            }
          }
          titleRow.appendChild(wxSpan);
        }
      }
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chit.title || '(Untitled)';
      titleRow.appendChild(titleSpan);

      // Owner badge — show only when owner differs from current user
      if (chit.owner_display_name) {
        var _notesUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!_notesUser || chit.owner_display_name !== _notesUser.display_name) {
          var _notesOwner = document.createElement('span');
          _notesOwner.className = 'cwoc-owner-badge';
          _notesOwner.textContent = '👤 ' + chit.owner_display_name;
          _notesOwner.title = 'Owner: ' + chit.owner_display_name;
          titleRow.appendChild(_notesOwner);
        }
      }

      // Assignee display name (Requirement 7.4)
      if (chit.assigned_to_display_name) {
        var _notesAssignee = document.createElement('span');
        _notesAssignee.className = 'cwoc-assignee-badge';
        _notesAssignee.textContent = '📌 ' + chit.assigned_to_display_name;
        _notesAssignee.title = 'Assigned to: ' + chit.assigned_to_display_name;
        titleRow.appendChild(_notesAssignee);
      }

      chitElement.appendChild(titleRow);

      const noteEl = document.createElement("div");
      noteEl.className = "note-content";
      noteEl.style.cssText = "overflow-y:auto;";
      if (typeof marked !== "undefined" && chit.note) {
        noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
      } else {
        noteEl.style.whiteSpace = "pre-wrap";
        noteEl.textContent = chit.note;
      }
      chitElement.appendChild(noteEl);

      // Double-click: open in editor. Shift+click: edit in place.
      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      chitElement.addEventListener("click", (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        // Prevent inline editing for viewer-role shared chits
        if (_isViewerRole(chit)) return;
        // Toggle in-place editing
        if (noteEl.contentEditable === 'true') return;
        noteEl.contentEditable = 'true';
        noteEl.style.outline = '2px solid #8b4513';
        noteEl.style.borderRadius = '4px';
        noteEl.style.padding = '6px';
        noteEl.style.whiteSpace = 'pre-wrap';
        chitElement.style.cursor = 'auto';
        chitElement.setAttribute('draggable', 'false');
        noteEl.textContent = chit.note || '';
        noteEl.focus();
        const saveEdit = () => {
          noteEl.contentEditable = 'false';
          noteEl.style.outline = '';
          noteEl.style.padding = '';
          chitElement.style.cursor = 'grab';
          chitElement.removeAttribute('draggable');
          const newNote = noteEl.textContent;
          if (newNote !== chit.note) {
            fetch(`/api/chits/${chit.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...chit, note: newNote })
            }).then(r => { if (r.ok) { chit.note = newNote; fetchChits(); } });
          } else {
            if (typeof marked !== 'undefined' && chit.note) {
              noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
            }
          }
        };
        noteEl.addEventListener('blur', saveEdit, { once: true });
        noteEl.addEventListener('keydown', (ke) => {
          if (ke.key === 'Escape') { ke.preventDefault(); noteEl.blur(); }
        });
      });
      // Long-press on mobile: toggle in-place editing (same as shift-click)
      // Uses unified touch gesture: drag to reorder, very long press to edit
      // (enableTouchGesture is attached after all cards are added, via enableNotesDragReorder)
      notesView.appendChild(chitElement);
    });
  }
  chitList.appendChild(notesView);

  // Restore saved column assignments from localStorage
  const savedOrder = getManualOrder('Notes');
  if (Array.isArray(savedOrder) && savedOrder.length > 0 && typeof savedOrder[0] === 'object') {
    // New format: [{id, col}, ...]
    // Check if all are in col 0 (buggy save) — if so, ignore and let auto-distribute
    const allCol0 = savedOrder.every(e => e.col === 0);
    if (!allCol0) {
      const colMap = {};
      savedOrder.forEach(entry => { if (entry.id && entry.col !== undefined) colMap[entry.id] = entry.col; });
      notesView.querySelectorAll('.chit-card').forEach(card => {
        const id = card.dataset.chitId;
        if (id in colMap) card.dataset.col = colMap[id];
      });
    }
  }

  // Apply column-persistent layout — delay to ensure markdown is rendered
  setTimeout(() => {
    applyNotesLayout(notesView);
    // Re-measure after images/markdown finish rendering
    setTimeout(() => applyNotesLayout(notesView), 200);
    // Final safety re-layout in case container width wasn't ready
    setTimeout(() => applyNotesLayout(notesView), 500);
  }, 50);

  // Re-layout on window resize
  const resizeHandler = () => {
    if (currentTab === 'Notes') {
      var nv = document.querySelector('.notes-view');
      if (nv) applyNotesLayout(nv);
    }
  };
  window.removeEventListener('resize', window._notesResizeHandler);
  window._notesResizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  // On mobile (single column), use the same drag system as Tasks/Checklists
  // which floats the card under the finger with a placeholder.
  // On desktop, use the masonry-aware notes drag.
  var _notesMobileMode = (window.innerWidth <= 480);
  if (_notesMobileMode) {
    // Build long-press map: inline note editing (same as shift-click)
    var _notesLpMap = {};
    sortedChits.forEach(function (chit) {
      if (_isViewerRole(chit)) return;
      _notesLpMap[chit.id] = function () {
        var card = notesView.querySelector('[data-chit-id="' + chit.id + '"]');
        if (!card) return;
        var noteEl = card.querySelector('.note-content');
        if (!noteEl || noteEl.contentEditable === 'true') return;
        noteEl.contentEditable = 'true';
        noteEl.style.outline = '2px solid #8b4513';
        noteEl.style.borderRadius = '4px';
        noteEl.style.padding = '6px';
        noteEl.style.whiteSpace = 'pre-wrap';
        card.style.cursor = 'auto';
        card.setAttribute('draggable', 'false');
        noteEl.textContent = chit.note || '';
        noteEl.focus();
        var _saveEdit = function () {
          noteEl.contentEditable = 'false';
          noteEl.style.outline = '';
          noteEl.style.padding = '';
          card.style.cursor = '';
          card.removeAttribute('draggable');
          var newNote = noteEl.textContent;
          if (newNote !== chit.note) {
            fetch('/api/chits/' + chit.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
            }).then(function (r) { if (r.ok) { chit.note = newNote; if (typeof fetchChits === 'function') fetchChits(); } });
          } else {
            if (typeof marked !== 'undefined' && chit.note) {
              noteEl.innerHTML = (typeof resolveChitLinks === 'function') ? resolveChitLinks(marked.parse(chit.note), chits) : marked.parse(chit.note);
            }
          }
        };
        noteEl.addEventListener('blur', _saveEdit, { once: true });
      };
    });
    enableDragToReorder(notesView, 'Notes', function () { displayChits(); }, _notesLpMap);
  } else {
    enableNotesDragReorder(notesView, 'Notes', () => displayChits());
  }
}

/* ── Projects View Mode (List vs Kanban) ──────────────────────────────────── */
// ── Projects View Mode (List vs Kanban) ──────────────────────────────────────
let _projectsViewMode = localStorage.getItem('cwoc_projectsViewMode') || 'kanban'; // 'list' | 'kanban'

function _setProjectsMode(mode) {
  _projectsViewMode = mode;
  localStorage.setItem('cwoc_projectsViewMode', mode);
  // Update button styles
  const listBtn = document.getElementById('projects-mode-list');
  const kanbanBtn = document.getElementById('projects-mode-kanban');
  if (listBtn) listBtn.style.background = mode === 'list' ? 'ivory' : '';
  if (kanbanBtn) kanbanBtn.style.background = mode === 'kanban' ? 'ivory' : '';
  displayChits();
}

// ── Alarms View Mode (Chits list vs Independent board) ───────────────────────
let _alarmsViewMode = localStorage.getItem('cwoc_alarmsViewMode') || 'list'; // 'list' | 'independent'

// ── Tasks View Mode (Tasks list vs Habits view) ─────────────────────────────
let _tasksViewMode = localStorage.getItem('cwoc_tasksViewMode') || 'tasks'; // 'tasks' | 'habits'

function _setTasksMode(mode) {
  _tasksViewMode = mode;
  localStorage.setItem('cwoc_tasksViewMode', mode);
  var tasksBtn = document.getElementById('tasks-mode-tasks');
  var habitsBtn = document.getElementById('tasks-mode-habits');
  var assignedBtn = document.getElementById('tasks-mode-assigned');
  var habitsWindowWrap = document.getElementById('habits-window-wrap');
  if (tasksBtn) tasksBtn.style.background = mode === 'tasks' ? 'ivory' : '';
  if (habitsBtn) habitsBtn.style.background = mode === 'habits' ? 'ivory' : '';
  if (assignedBtn) assignedBtn.style.background = mode === 'assigned' ? 'ivory' : '';
  if (habitsWindowWrap) habitsWindowWrap.style.display = mode === 'habits' ? '' : 'none';
  displayChits();
}

/**
 * Called when the sidebar habits success window dropdown changes.
 * Saves the value to settings and re-renders the habits view.
 */
function _onHabitsWindowChange(newVal) {
  // Update settings cache
  if (window._cwocSettings) window._cwocSettings.habits_success_window = newVal;
  // Persist to backend
  var currentUserId = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().user_id : null;
  if (currentUserId) {
    var s = Object.assign({}, window._cwocSettings || {}, { user_id: currentUserId, habits_success_window: newVal });
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(function(e) { console.error('Failed to save habits window:', e); });
  }
  // Re-render if currently in habits mode
  if (_tasksViewMode === 'habits') displayChits();
}

/**
 * Initialize the sidebar habits success window dropdown from cached settings.
 */
function _initHabitsWindowDropdown() {
  var sel = document.getElementById('habits-success-window-sidebar');
  if (!sel) return;
  var settings = window._cwocSettings || {};
  var val = settings.habits_success_window || '30';
  sel.value = val;
  // Also show/hide based on current mode
  var wrap = document.getElementById('habits-window-wrap');
  if (wrap) wrap.style.display = _tasksViewMode === 'habits' ? '' : 'none';
}

// Run init after settings are loaded
if (typeof getCachedSettings === 'function') {
  getCachedSettings().then(_initHabitsWindowDropdown);
}

function _restoreViewModeButtons() {
  // Projects
  const pListBtn = document.getElementById('projects-mode-list');
  const pKanbanBtn = document.getElementById('projects-mode-kanban');
  if (pListBtn) pListBtn.style.background = _projectsViewMode === 'list' ? 'ivory' : '';
  if (pKanbanBtn) pKanbanBtn.style.background = _projectsViewMode === 'kanban' ? 'ivory' : '';
  // Alarms
  const aListBtn = document.getElementById('alarms-mode-list');
  const aIndBtn = document.getElementById('alarms-mode-independent');
  if (aListBtn) aListBtn.style.background = _alarmsViewMode === 'list' ? 'ivory' : '';
  if (aIndBtn) aIndBtn.style.background = _alarmsViewMode === 'independent' ? 'ivory' : '';
  // Tasks
  const tTasksBtn = document.getElementById('tasks-mode-tasks');
  const tHabitsBtn = document.getElementById('tasks-mode-habits');
  const tAssignedBtn = document.getElementById('tasks-mode-assigned');
  if (tTasksBtn) tTasksBtn.style.background = _tasksViewMode === 'tasks' ? 'ivory' : '';
  if (tHabitsBtn) tHabitsBtn.style.background = _tasksViewMode === 'habits' ? 'ivory' : '';
  if (tAssignedBtn) tAssignedBtn.style.background = _tasksViewMode === 'assigned' ? 'ivory' : '';
}
let _independentAlerts = []; // cached independent alerts from API
let _saTimerRuntime = {}; // independent timer runtime state
let _saSwRuntime = {}; // independent stopwatch runtime state

function _setAlarmsMode(mode) {
  _alarmsViewMode = mode;
  localStorage.setItem('cwoc_alarmsViewMode', mode);
  const listBtn = document.getElementById('alarms-mode-list');
  const indBtn = document.getElementById('alarms-mode-independent');
  if (listBtn) listBtn.style.background = mode === 'list' ? 'ivory' : '';
  if (indBtn) indBtn.style.background = mode === 'independent' ? 'ivory' : '';
  if (mode === 'independent') {
    _fetchIndependentAlerts().then(() => displayChits());
  } else {
    displayChits();
  }
}

async function _fetchIndependentAlerts() {
  try {
    const resp = await fetch('/api/standalone-alerts');
    if (!resp.ok) throw new Error('Failed to fetch independent alerts');
    _independentAlerts = await resp.json();
  } catch (e) {
    console.error('Error fetching independent alerts:', e);
    _independentAlerts = [];
  }
}

async function _createIndependentAlert(alertData) {
  try {
    const resp = await fetch('/api/standalone-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData),
    });
    if (!resp.ok) throw new Error('Failed to create independent alert');
    const created = await resp.json();
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
    return created;
  } catch (e) {
    console.error('Error creating independent alert:', e);
  }
}

async function _updateIndependentAlert(id, alertData) {
  try {
    const resp = await fetch(`/api/standalone-alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData),
    });
    if (!resp.ok) throw new Error('Failed to update independent alert');
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
  } catch (e) {
    console.error('Error updating independent alert:', e);
  }
}

async function _deleteIndependentAlert(id) {
  // Clean up runtime state
  const idx = _independentAlerts.findIndex(a => a.id === id);
  if (idx !== -1) {
    const a = _independentAlerts[idx];
    if (a._type === 'timer' && _saTimerRuntime[id]) {
      clearInterval(_saTimerRuntime[id].intervalId);
      delete _saTimerRuntime[id];
    }
    if (a._type === 'stopwatch' && _saSwRuntime[id]) {
      clearInterval(_saSwRuntime[id].intervalId);
      delete _saSwRuntime[id];
    }
  }
  try {
    const resp = await fetch(`/api/standalone-alerts/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to delete independent alert');
    await _fetchIndependentAlerts();
    displayChits();
    syncSend('alerts_changed', {});
  } catch (e) {
    console.error('Error deleting independent alert:', e);
  }
}

/**
 * Projects tab: tree view — each project master with its child chits nested.
 */
function displayProjectsView(chitsToDisplay) {
  if (_projectsViewMode === 'kanban') {
    return _displayProjectsKanban(chitsToDisplay);
  }

  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Use all chits (not filtered) to find project masters — filters shouldn't hide projects
  // Deduplicate by ID to prevent showing the same project twice
  const seenIds = new Set();
  var projects = chits.filter((c) => {
    if (!c.is_project_master || c.deleted || c.archived) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  // Apply manual sort order for projects (shared with kanban view)
  projects = applyManualOrder('Projects', projects);

  if (projects.length === 0) {
    chitList.innerHTML = _emptyState("No projects found. Create a chit and enable Project Master in the Projects zone.");
    return;
  }

  const chitMap = {};
  chits.forEach((c) => { chitMap[c.id] = c; });

  const view = document.createElement("div");
  view.className = "projects-view";

  projects.forEach((project) => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);
    const projectFontColor = contrastColorForBg(projectColor);

    // Outer box colored with project color
    const box = document.createElement("div");
    box.dataset.chitId = project.id;
    box.draggable = true;
    box.style.cssText = `border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};color:${projectFontColor};`;

    // Project header row — use standard header builder
    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};color:${projectFontColor};cursor:pointer;display:flex;align-items:center;gap:0.5em;`;

    // Drag grip handle for project reorder
    var _listProjGrip = document.createElement("span");
    _listProjGrip.style.cssText = "opacity:0.5;font-size:0.9em;cursor:grab;flex-shrink:0;";
    _listProjGrip.textContent = "≡";
    _listProjGrip.title = "Drag to reorder project";
    header.appendChild(_listProjGrip);

    var _listProjHeaderContent = document.createElement("div");
    _listProjHeaderContent.style.cssText = "flex:1;min-width:0;";
    _listProjHeaderContent.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)", _viSettings));

    if (project.note) {
      const note = document.createElement("div");
      note.style.cssText = "font-size:0.8em;opacity:0.65;margin-top:2px;";
      note.textContent = project.note.slice(0, 100) + (project.note.length > 100 ? "…" : "");
      _listProjHeaderContent.appendChild(note);
    }
    header.appendChild(_listProjHeaderContent);

    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });

    // HTML5 drag for project-level reorder (desktop parity)
    box.addEventListener("dragstart", function (e) {
      if (!e.target.closest('div[style*="cursor:pointer"]') && e.target !== box) return;
      e.dataTransfer.setData("application/x-list-project-reorder", project.id);
      e.dataTransfer.effectAllowed = "move";
      box.classList.add('cwoc-dragging');
    });
    box.addEventListener("dragend", function () {
      box.classList.remove('cwoc-dragging');
      _removeListProjectPlaceholder();
      if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
    });

    box.appendChild(header);

    // Child chits tree
    if (childIds.length > 0) {
      const tree = document.createElement("ul");
      tree.className = "projects-child-list";
      tree.dataset.projectId = project.id;
      tree.style.cssText = "list-style:none;margin:0;padding:0 0 0.5em 0;border-top:1px solid rgba(139,90,43,0.2);";

      childIds.forEach((childId) => {
        const child = chitMap[childId];
        const childBg = child ? chitColor(child) : "#fdf6e3";
        const childFont = contrastColorForBg(childBg);
        const li = document.createElement("li");
        li.className = "chit-card projects-child-item";
        li.draggable = true;
        li.dataset.chitId = child ? child.id : childId;
        li.dataset.projectId = project.id;
        li.style.cssText = `display:flex;flex-direction:column;gap:0.2em;padding:0.5em 0.8em 0.5em 1.5em;border-bottom:1px solid rgba(139,90,43,0.1);background:${childBg};color:${childFont};cursor:grab;min-height:2.2em;`;

        const titleRow = document.createElement("div");
        titleRow.style.cssText = "display:flex;align-items:center;gap:0.5em;";

        // Drag grip handle
        const grip = document.createElement("span");
        grip.style.cssText = "opacity:0.4;flex-shrink:0;cursor:grab;font-size:0.9em;";
        grip.textContent = "≡";
        grip.title = "Drag to reorder";
        titleRow.appendChild(grip);

        const bullet = document.createElement("span");
        bullet.style.cssText = "opacity:0.4;flex-shrink:0;";
        bullet.textContent = "▸";
        titleRow.appendChild(bullet);

        const childTitle = document.createElement("span");
        childTitle.style.cssText = "font-weight:bold;";
        childTitle.textContent = child ? (child.title || "(Untitled)") : `[${childId.slice(0,8)}…]`;
        titleRow.appendChild(childTitle);

        // Visual indicators on child items
        if (child && typeof _getAllIndicators === 'function') {
          const ind = _getAllIndicators(child, _viSettings, 'card');
          if (ind) {
            const indSpan = document.createElement('span');
            indSpan.className = 'alert-indicators';
            indSpan.textContent = ind;
            titleRow.appendChild(indSpan);
          }
        }

        li.appendChild(titleRow);

        if (child) {
          // Meta: Status · Priority · Severity · Due
          const metaParts = [];
          if (child.status) metaParts.push(child.status);
          if (child.priority) metaParts.push(child.priority);
          if (child.severity) metaParts.push(child.severity);
          if (child.due_datetime) metaParts.push("Due: " + formatDate(new Date(child.due_datetime)));
          if (metaParts.length > 0) {
            const meta = document.createElement("div");
            meta.style.cssText = "font-size:0.9em;opacity:0.75;margin-top:2px;";
            meta.textContent = metaParts.join(" · ");
            li.appendChild(meta);
          }

          // Note preview (rendered markdown, same as Tasks view — expandable on mobile)
          if (child.note && child.note.trim()) {
            li.appendChild(_buildNotePreview(child, 'margin-top:3px;'));
          }

          li.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${child.id}`;
          });
        }

        // HTML5 drag for reordering child chits within this project
        li.addEventListener("dragstart", e => {
          e.dataTransfer.setData("application/x-project-child-reorder", JSON.stringify({ chitId: child ? child.id : childId, projectId: project.id }));
          e.dataTransfer.effectAllowed = "move";
          li.classList.add('cwoc-dragging');
        });
        li.addEventListener("dragend", () => {
          li.classList.remove('cwoc-dragging');
          if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
        });

        tree.appendChild(li);
      });

      // Drag-over / drop handlers for reordering children within this project
      tree.addEventListener("dragover", e => {
        if (!e.dataTransfer.types.includes("application/x-project-child-reorder")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const targetLi = e.target.closest('.projects-child-item');
        tree.querySelectorAll('.projects-child-item').forEach(item => {
          item.style.borderTop = '';
          item.style.borderBottom = '';
        });
        if (targetLi) {
          const rect = targetLi.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            targetLi.style.borderTop = '3px solid #8b5a2b';
          } else {
            targetLi.style.borderBottom = '3px solid #8b5a2b';
          }
        }
      });

      tree.addEventListener("dragleave", e => {
        if (!e.relatedTarget || !tree.contains(e.relatedTarget)) {
          tree.querySelectorAll('.projects-child-item').forEach(item => {
            item.style.borderTop = '';
            item.style.borderBottom = '';
          });
        }
      });

      tree.addEventListener("drop", async e => {
        const rawData = e.dataTransfer.getData("application/x-project-child-reorder");
        if (!rawData) return;
        e.preventDefault();
        tree.querySelectorAll('.projects-child-item').forEach(item => {
          item.style.borderTop = '';
          item.style.borderBottom = '';
        });

        try {
          const data = JSON.parse(rawData);
          if (data.projectId !== project.id) return; // Only reorder within same project

          const targetLi = e.target.closest('.projects-child-item');
          if (!targetLi || targetLi.dataset.chitId === data.chitId) return;

          // Build new child_chits order from DOM
          const items = Array.from(tree.querySelectorAll('.projects-child-item[data-chit-id]'));
          const ids = items.map(item => item.dataset.chitId);
          const fromIdx = ids.indexOf(data.chitId);
          let toIdx = ids.indexOf(targetLi.dataset.chitId);
          if (fromIdx < 0 || toIdx < 0) return;

          const rect = targetLi.getBoundingClientRect();
          if (e.clientY > rect.top + rect.height / 2) toIdx++;
          ids.splice(fromIdx, 1);
          if (fromIdx < toIdx) toIdx--;
          ids.splice(toIdx, 0, data.chitId);

          // Save new child_chits order to backend
          const resp = await fetch('/api/chit/' + project.id);
          if (!resp.ok) return;
          const projData = await resp.json();
          projData.child_chits = ids;
          await fetch('/api/chits/' + project.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projData)
          });
          _kanbanFetchAndPreserveScroll();
        } catch (err) { console.error('Project child reorder error:', err); }
      });

      // Touch drag support for reordering children on mobile
      if (typeof enableTouchGesture === 'function') {
        tree.querySelectorAll('.projects-child-item[data-chit-id]').forEach(function (li) {
          var _childChit = chitMap[li.dataset.chitId];
          var _touchDragLi = null;

          enableTouchGesture(li, {
            onDragStart: function () {
              _touchDragLi = li;
            },
            onDragMove: function (data) {
              if (!_touchDragLi) return;
              tree.querySelectorAll('.projects-child-item').forEach(function (item) {
                item.style.borderTop = '';
                item.style.borderBottom = '';
              });
              var target = document.elementFromPoint(data.clientX, data.clientY);
              if (!target) return;
              var targetItem = target.closest('.projects-child-item');
              if (targetItem && targetItem !== _touchDragLi) {
                var rect = targetItem.getBoundingClientRect();
                if (data.clientY < rect.top + rect.height / 2) {
                  targetItem.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetItem.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_touchDragLi) return;
              tree.querySelectorAll('.projects-child-item').forEach(function (item) {
                item.style.borderTop = '';
                item.style.borderBottom = '';
              });

              var target = document.elementFromPoint(data.clientX, data.clientY);
              if (!target) { _touchDragLi = null; return; }
              var targetItem = target.closest('.projects-child-item');
              if (!targetItem || targetItem === _touchDragLi) { _touchDragLi = null; return; }

              var items = Array.from(tree.querySelectorAll('.projects-child-item[data-chit-id]'));
              var ids = items.map(function (item) { return item.dataset.chitId; });
              var fromId = _touchDragLi.dataset.chitId;
              var toId = targetItem.dataset.chitId;
              var fromIdx = ids.indexOf(fromId);
              var toIdx = ids.indexOf(toId);
              if (fromIdx < 0 || toIdx < 0) { _touchDragLi = null; return; }

              var rect = targetItem.getBoundingClientRect();
              if (data.clientY > rect.top + rect.height / 2) toIdx++;
              ids.splice(fromIdx, 1);
              if (fromIdx < toIdx) toIdx--;
              ids.splice(toIdx, 0, fromId);

              // Save new child_chits order to backend
              (async function () {
                try {
                  var resp = await fetch('/api/chit/' + project.id);
                  if (!resp.ok) return;
                  var projData = await resp.json();
                  projData.child_chits = ids;
                  await fetch('/api/chits/' + project.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(projData)
                  });
                  _kanbanFetchAndPreserveScroll();
                } catch (err) { console.error('Project child touch reorder error:', err); }
              })();

              _touchDragLi = null;
            },
            onLongPress: function () {
              if (_childChit && typeof showQuickEditModal === 'function' && !(typeof _isViewerRole === 'function' && _isViewerRole(_childChit))) {
                showQuickEditModal(_childChit, function () { displayChits(); });
              }
            },
          });
        });
      }

      box.appendChild(tree);
    }

    view.appendChild(box);
  });

  // ── Shared placeholder for list-view project reorder ─────────────────────
  var _listProjectPlaceholder = null;
  function _ensureListProjectPlaceholder() {
    if (!_listProjectPlaceholder) {
      _listProjectPlaceholder = document.createElement('div');
      _listProjectPlaceholder.className = 'cwoc-project-drop-placeholder';
      _listProjectPlaceholder.style.cssText = 'height:24px;border:2px dashed #8b5a2b;border-radius:6px;background:rgba(139,90,43,0.08);box-sizing:border-box;margin-bottom:0.5em;transition:height 0.15s ease;';
    }
    return _listProjectPlaceholder;
  }
  function _removeListProjectPlaceholder() {
    if (_listProjectPlaceholder && _listProjectPlaceholder.parentNode) {
      _listProjectPlaceholder.remove();
    }
  }
  function _positionListProjectPlaceholder(containerEl, draggedBox, clientY) {
    var ph = _ensureListProjectPlaceholder();
    var boxes = Array.from(containerEl.querySelectorAll(':scope > div[data-chit-id]'));
    var others = boxes.filter(function (b) { return b !== draggedBox; });
    var insertIdx = others.length;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        insertIdx = i;
        break;
      }
    }
    if (insertIdx >= others.length) {
      containerEl.appendChild(ph);
    } else {
      containerEl.insertBefore(ph, others[insertIdx]);
    }
    return insertIdx;
  }

  // ── Project-level drag-to-reorder (HTML5 desktop) ────────────────────────
  view.addEventListener("dragover", function (e) {
    if (!e.dataTransfer.types.includes("application/x-list-project-reorder")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    var draggedBox = view.querySelector(':scope > div[data-chit-id].cwoc-dragging');
    _positionListProjectPlaceholder(view, draggedBox, e.clientY);
  });

  view.addEventListener("dragleave", function (e) {
    if (!e.dataTransfer.types.includes("application/x-list-project-reorder")) return;
    if (!view.contains(e.relatedTarget)) {
      _removeListProjectPlaceholder();
    }
  });

  view.addEventListener("drop", function (e) {
    var draggedId = e.dataTransfer.getData("application/x-list-project-reorder");
    if (!draggedId) return;
    e.preventDefault();
    _removeListProjectPlaceholder();

    var boxes = Array.from(view.querySelectorAll(':scope > div[data-chit-id]'));
    var ids = boxes.map(function (b) { return b.dataset.chitId; });
    var fromIdx = ids.indexOf(draggedId);
    if (fromIdx < 0) return;

    var others = boxes.filter(function (b) { return b.dataset.chitId !== draggedId; });
    var toIdx = others.length;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        toIdx = i;
        break;
      }
    }

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    saveManualOrder('Projects', ids);
    currentSortField = 'manual';
    var sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    _updateSortUI();

    // Preserve scroll position across the full re-render
    var scrollEl = document.querySelector('.projects-view');
    var savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    displayChits();
    if (savedScroll > 0) {
      var el = document.querySelector('.projects-view');
      if (el) {
        el.scrollTop = savedScroll;
        requestAnimationFrame(function () { if (el) el.scrollTop = savedScroll; });
      }
    }
  });

  // ── Touch gesture for project header reorder (mobile) ──────────────────
  if (typeof enableTouchGesture === 'function') {
    var _listHeaderDraggedBox = null;
    var _listHeaderLastInsertIdx = -1;
    view.querySelectorAll(':scope > div[data-chit-id]').forEach(function (box) {
      var headerEl = box.querySelector('div[style*="cursor:pointer"]');
      if (!headerEl || !box.dataset.chitId) return;
      var _projectChit = chitMap[box.dataset.chitId];

      enableTouchGesture(box, {
        onDragStart: function () {
          _listHeaderDraggedBox = box;
          _listHeaderLastInsertIdx = -1;
          box.classList.add('cwoc-dragging');
          box.style.opacity = '0.5';
        },
        onDragMove: function (data) {
          if (!_listHeaderDraggedBox) return;
          var idx = _positionListProjectPlaceholder(view, _listHeaderDraggedBox, data.clientY);
          _listHeaderLastInsertIdx = idx;

          // Auto-scroll when near edges
          var scrollEl = document.querySelector('.projects-view');
          if (scrollEl) {
            var containerRect = scrollEl.getBoundingClientRect();
            var edgeZone = 50;
            var scrollSpeed = 8;
            if (data.clientY < containerRect.top + edgeZone) {
              scrollEl.scrollTop -= scrollSpeed;
            } else if (data.clientY > containerRect.bottom - edgeZone) {
              scrollEl.scrollTop += scrollSpeed;
            }
          }
        },
        onDragEnd: function (data) {
          if (!_listHeaderDraggedBox) return;
          _listHeaderDraggedBox.classList.remove('cwoc-dragging');
          _listHeaderDraggedBox.style.opacity = '';
          _removeListProjectPlaceholder();

          var boxes = Array.from(view.querySelectorAll(':scope > div[data-chit-id]'));
          var ids = boxes.map(function (b) { return b.dataset.chitId; });
          var fromId = _listHeaderDraggedBox.dataset.chitId;
          var fromIdx = ids.indexOf(fromId);
          if (fromIdx < 0) { _listHeaderDraggedBox = null; return; }

          var toIdx = _listHeaderLastInsertIdx;
          if (toIdx < 0) { _listHeaderDraggedBox = null; return; }

          ids.splice(fromIdx, 1);
          ids.splice(toIdx, 0, fromId);

          saveManualOrder('Projects', ids);
          currentSortField = 'manual';
          var sel = document.getElementById('sort-select');
          if (sel) sel.value = 'manual';
          _updateSortUI();
          _listHeaderDraggedBox = null;

          // Preserve scroll position across the full re-render
          var scrollEl = document.querySelector('.projects-view');
          var savedScroll = scrollEl ? scrollEl.scrollTop : 0;
          displayChits();
          if (savedScroll > 0) {
            var el = document.querySelector('.projects-view');
            if (el) {
              el.scrollTop = savedScroll;
              requestAnimationFrame(function () { if (el) el.scrollTop = savedScroll; });
            }
          }
        },
        onLongPress: function () {
          if (_projectChit && typeof showQuickEditModal === 'function') {
            showQuickEditModal(_projectChit, function () { displayChits(); });
          }
        },
      });
    });
  }

  chitList.appendChild(view);
}

/**
 * Projects Kanban view: each project master is a row of status columns.
 * Projects Kanban view: each project master is a row of status columns.
 * Child chits of each project are cards in the appropriate column.
 * Grandchildren (children of children) appear as sub-items within cards.
 * Supports drag & drop between columns and between projects.
 */

/**
 * Fetch chits and re-render, preserving the projects-view scroll position.
 * Wraps the displayChits call to restore scroll after the DOM is rebuilt.
 */
function _kanbanFetchAndPreserveScroll() {
  var scrollEl = document.querySelector('.projects-view');
  var savedScroll = scrollEl ? scrollEl.scrollTop : 0;
  if (savedScroll === 0) {
    // No scroll to preserve, just fetch normally
    fetchChits();
    return;
  }

  // Temporarily wrap displayChits to restore scroll after re-render
  var _origDisplayChits = window.displayChits;
  window.displayChits = function () {
    // Restore original immediately so this only fires once
    window.displayChits = _origDisplayChits;
    _origDisplayChits();
    // Restore scroll on the new .projects-view element
    var el = document.querySelector('.projects-view');
    if (el) {
      el.scrollTop = savedScroll;
      requestAnimationFrame(function () { if (el) el.scrollTop = savedScroll; });
    }
  };
  fetchChits();
}

function _displayProjectsKanban(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};
  var _kanbanProjectDragActive = false; // true during project-level reorder drag

  const seenIds = new Set();
  let projects = chits.filter(c => {
    if (!c.is_project_master || c.deleted || c.archived) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  if (projects.length === 0) {
    chitList.innerHTML = "<p>No projects found.</p>";
    return;
  }

  // Apply manual sort order for projects
  projects = applyManualOrder('Projects', projects);

  const chitMap = {};
  chits.forEach(c => { chitMap[c.id] = c; });

  const statuses = ["ToDo", "In Progress", "Blocked", "Complete"];

  const wrapper = document.createElement("div");
  wrapper.className = "projects-view";

  projects.forEach(project => {
    const childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    const projectColor = chitColor(project);
    const projectFont = contrastColorForBg(projectColor);

    // Project header
    const projectBox = document.createElement("div");
    projectBox.className = "kanban-project-box";
    projectBox.dataset.chitId = project.id;
    projectBox.draggable = true;
    projectBox.style.cssText = `margin-bottom:1.5em;border:2px solid #8b5a2b;border-radius:6px;background:${projectColor};color:${projectFont};`;

    const header = document.createElement("div");
    header.className = "kanban-project-header";
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};color:${projectFont};cursor:grab;font-weight:bold;font-size:1.05em;border-bottom:1px solid rgba(139,90,43,0.2);display:flex;align-items:center;gap:0.5em;`;

    const dragGrip = document.createElement("span");
    dragGrip.style.cssText = "opacity:0.5;font-size:0.9em;cursor:grab;flex-shrink:0;";
    dragGrip.textContent = "≡";
    dragGrip.title = "Drag to reorder project";
    header.appendChild(dragGrip);

    const headerTitle = document.createElement("span");
    headerTitle.style.cssText = "flex:1;";
    headerTitle.textContent = project.title || "(Untitled Project)";
    header.appendChild(headerTitle);

    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });

    // Track where mousedown originated for dragstart filtering
    var _projectDragOrigin = null;
    projectBox.addEventListener("mousedown", function(e) {
      _projectDragOrigin = e.target;
    });

    // Project-level drag for reorder
    projectBox.addEventListener("dragstart", e => {
      // Only start project reorder drag from the header grip area
      var origin = _projectDragOrigin || e.target;
      if (!origin.closest('.kanban-project-header')) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("application/x-project-reorder", project.id);
      e.dataTransfer.effectAllowed = "move";
      projectBox.classList.add('cwoc-dragging');
      _kanbanProjectDragActive = true;
    });
    projectBox.addEventListener("dragend", () => {
      projectBox.classList.remove('cwoc-dragging');
      _kanbanProjectDragActive = false;
      _removeProjectPlaceholder();
      if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
    });

    // Accept project reorder drags on the projectBox itself (ensures preventDefault
    // fires even when the cursor is over child columns/cards inside the box)
    projectBox.addEventListener("dragover", e => {
      if (!_kanbanProjectDragActive) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    projectBox.appendChild(header);

    // Kanban columns row
    const columnsRow = document.createElement("div");
    columnsRow.style.cssText = "display:flex;gap:0;min-height:80px;";

    // Group children by status
    const grouped = {};
    statuses.forEach(s => { grouped[s] = []; });
    childIds.forEach(cid => {
      const child = chitMap[cid];
      if (!child || child.deleted) return;
      const st = child.status || "ToDo";
      if (!grouped[st]) grouped[st] = [];
      grouped[st].push(child);
    });

    statuses.forEach(status => {
      const col = document.createElement("div");
      col.style.cssText = "flex:1;min-width:0;border-right:2px solid rgba(139,90,43,0.35);padding:0.5em;display:flex;flex-direction:column;gap:0.3em;background:rgba(255,255,255,0.15);";
      col.dataset.status = status;
      col.dataset.projectId = project.id;

      // Column header
      const colHeader = document.createElement("div");
      colHeader.style.cssText = "font-weight:bold;opacity:0.85;text-align:center;padding:5px 0 8px;border-bottom:2px solid rgba(139,90,43,0.3);margin-bottom:8px;white-space:nowrap;";
      colHeader.textContent = status;
      col.appendChild(colHeader);

      // Cards
      grouped[status].forEach(child => {
        const card = document.createElement("div");
        card.className = "chit-card";
        card.draggable = true;
        card.dataset.chitId = child.id;
        card.dataset.projectId = project.id;
        const childBg = chitColor(child);
        const childFont = contrastColorForBg(childBg);
        card.style.cssText = `padding:0.5em 0.6em;font-size:1em;background:${childBg};color:${childFont};cursor:grab;margin-bottom:0.3em;border-width:1px;line-height:1.4;`;
        if (child.status === "Complete") card.classList.add("completed-task");
        if (_isDeclinedByCurrentUser(child)) card.classList.add("declined-chit");

        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-weight:bold;margin-bottom:3px;";
        titleEl.textContent = child.title || "(Untitled)";
        // Visual indicators inline with title
        if (typeof _getAllIndicators === 'function') {
          const ind = _getAllIndicators(child, _viSettings, 'card');
          if (ind) titleEl.textContent += ' ' + ind;
        }
        // Stealth indicator — visible only to the owner (Requirement 6.5)
        if (child.stealth) {
          var _kanbanStealthUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (_kanbanStealthUser && child.owner_id === _kanbanStealthUser.user_id) {
            titleEl.textContent += ' 🥷';
          }
        }
        card.appendChild(titleEl);

        // Status / Priority / Severity meta row
        const metaParts = [];
        if (child.priority) metaParts.push(child.priority);
        if (child.severity) metaParts.push(child.severity);
        if (metaParts.length > 0) {
          const metaEl = document.createElement("div");
          metaEl.style.cssText = "font-size:0.9em;opacity:0.75;margin-bottom:3px;";
          metaEl.textContent = metaParts.join(" · ");
          card.appendChild(metaEl);
        }

        // Show due date if present
        if (child.due_datetime) {
          const due = document.createElement("div");
          due.style.cssText = "font-size:0.9em;opacity:0.75;margin-bottom:3px;";
          due.textContent = "Due: " + formatDate(new Date(child.due_datetime));
          card.appendChild(due);
        }

        // Note preview (rendered markdown, same as Tasks view — expandable on mobile)
        if (child.note && child.note.trim()) {
          card.appendChild(_buildNotePreview(child, 'font-size:0.9em;margin-top:2px;'));
        }

        // Owner badge — show only when owner differs from current user
        if (child.owner_display_name) {
          var _kanbanUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (!_kanbanUser || child.owner_display_name !== _kanbanUser.display_name) {
            var _kanbanOwner = document.createElement('div');
            _kanbanOwner.className = 'cwoc-owner-badge';
            _kanbanOwner.textContent = '👤 ' + child.owner_display_name;
            _kanbanOwner.title = 'Owner: ' + child.owner_display_name;
            card.appendChild(_kanbanOwner);
          }
        }

        // Assignee display name (Requirement 7.4)
        if (child.assigned_to_display_name) {
          var _kanbanAssignee = document.createElement('div');
          _kanbanAssignee.className = 'cwoc-assignee-badge';
          _kanbanAssignee.textContent = '📌 ' + child.assigned_to_display_name;
          _kanbanAssignee.title = 'Assigned to: ' + child.assigned_to_display_name;
          card.appendChild(_kanbanAssignee);
        }

        // Grandchildren (children of this child) as sub-items
        const grandchildIds = Array.isArray(child.child_chits) ? child.child_chits : [];
        if (grandchildIds.length > 0) {
          const subList = document.createElement("ul");
          subList.style.cssText = "margin:4px 0 0 0;padding:0 0 0 12px;list-style:none;font-size:0.95em;";
          grandchildIds.forEach(gcId => {
            const gc = chitMap[gcId];
            if (!gc || gc.deleted) return;
            const li = document.createElement("li");
            li.draggable = true;
            li.dataset.chitId = gc.id;
            li.dataset.parentChitId = child.id;
            li.style.cssText = `padding:2px 4px;margin:1px 0;border-radius:3px;cursor:grab;background:rgba(255,255,255,0.4);border:1px solid rgba(139,90,43,0.1);display:flex;align-items:center;gap:4px;`;
            if (gc.status === "Complete") li.style.opacity = "0.5";

            const bullet = document.createElement("span");
            bullet.style.cssText = "opacity:0.4;font-size:0.8em;flex-shrink:0;";
            bullet.textContent = gc.status === "Complete" ? "✓" : "▸";
            li.appendChild(bullet);

            const gcTitle = document.createElement("span");
            gcTitle.style.flex = "1";
            gcTitle.textContent = gc.title || "(Untitled)";
            li.appendChild(gcTitle);

            // Grandchild drag
            li.addEventListener("dragstart", e => {
              e.stopPropagation();
              e.dataTransfer.setData("application/x-kanban-grandchild", JSON.stringify({ chitId: gc.id, parentChitId: child.id, projectId: project.id }));
              e.dataTransfer.effectAllowed = "move";
              li.classList.add('cwoc-dragging');
            });
            li.addEventListener("dragend", () => { li.classList.remove('cwoc-dragging'); if (gc.status === "Complete") li.style.opacity = "0.5"; if (typeof _markDragJustEnded === 'function') _markDragJustEnded(); });

            li.addEventListener("dblclick", e => {
              e.stopPropagation();
              storePreviousState();
              window.location.href = `/editor?id=${gc.id}`;
            });

            subList.appendChild(li);
          });
          card.appendChild(subList);
        }

        // Card drag (child chit between status columns)
        card.addEventListener("dragstart", e => {
          e.stopPropagation();
          e.dataTransfer.setData("application/x-kanban-card", JSON.stringify({ chitId: child.id, projectId: project.id, fromStatus: status }));
          e.dataTransfer.effectAllowed = "move";
          card.classList.add('cwoc-dragging');
        });
        card.addEventListener("dragend", () => { card.classList.remove('cwoc-dragging'); if (typeof _markDragJustEnded === 'function') _markDragJustEnded(); });

        card.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${child.id}`;
        });

        // Touch gesture: drag between columns + long-press for quick edit
        if (typeof enableTouchGesture === 'function') {
          (function (_card, _child, _status, _project) {
            var _kanbanTouchDragCard = null;
            enableTouchGesture(_card, {
              onDragStart: function () {
                _kanbanTouchDragCard = _card;
                // Hide from hit testing so elementFromPoint finds the column behind
                _card.style.pointerEvents = 'none';
                _card.style.opacity = '0.7';
                _card.style.zIndex = '100';
              },
              onDragMove: function (data) {
                if (!_kanbanTouchDragCard) return;
                // Highlight the column under the finger
                wrapper.querySelectorAll('[data-status]').forEach(function (c) {
                  c.style.background = '';
                });
                var target = document.elementFromPoint(data.clientX, data.clientY);
                if (target) {
                  var targetCol = target.closest('[data-status]');
                  if (targetCol) {
                    targetCol.style.background = 'rgba(139,90,43,0.08)';
                  }
                }
              },
              onDragEnd: function (data) {
                if (!_kanbanTouchDragCard) return;

                wrapper.querySelectorAll('[data-status]').forEach(function (c) {
                  c.style.background = '';
                });

                // Find target BEFORE restoring pointer-events (card is still hidden from hit testing)
                var target = document.elementFromPoint(data.clientX, data.clientY);

                // Now restore card styles
                _card.style.pointerEvents = '';
                _card.style.opacity = '';
                _card.style.zIndex = '';
                if (!target) { _kanbanTouchDragCard = null; return; }
                var targetCol = target.closest('[data-status]');
                if (!targetCol) { _kanbanTouchDragCard = null; return; }

                var newStatus = targetCol.dataset.status;
                var targetProjectId = targetCol.dataset.projectId;
                var isCrossProject = _project.id !== targetProjectId;

                if (!isCrossProject && _status === newStatus) { _kanbanTouchDragCard = null; return; }

                // Perform the move (same logic as HTML5 drop handler)
                (async function () {
                  try {
                    if (isCrossProject) {
                      var oldProjResp = await fetch('/api/chit/' + _project.id);
                      if (!oldProjResp.ok) return;
                      var oldProj = await oldProjResp.json();
                      oldProj.child_chits = (oldProj.child_chits || []).filter(function (id) { return id !== _child.id; });
                      await fetch('/api/chits/' + _project.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oldProj) });

                      var newProjResp = await fetch('/api/chit/' + targetProjectId);
                      if (!newProjResp.ok) return;
                      var newProj = await newProjResp.json();
                      if (!Array.isArray(newProj.child_chits)) newProj.child_chits = [];
                      if (!newProj.child_chits.includes(_child.id)) newProj.child_chits.push(_child.id);
                      await fetch('/api/chits/' + targetProjectId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProj) });
                    }

                    if (_status !== newStatus || isCrossProject) {
                      var resp = await fetch('/api/chit/' + _child.id);
                      if (!resp.ok) return;
                      var fullChit = await resp.json();
                      fullChit.status = newStatus;
                      if (newStatus === 'Complete' && !fullChit.completed_datetime) {
                        fullChit.completed_datetime = new Date().toISOString();
                      }
                      await fetch('/api/chits/' + _child.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullChit) });
                    }
                    _kanbanFetchAndPreserveScroll();
                  } catch (err) { console.error('Kanban touch drag error:', err); }
                })();

                _kanbanTouchDragCard = null;
              },
              onLongPress: function () {
                if (typeof _isViewerRole === 'function' && _isViewerRole(_child)) return;
                showQuickEditModal(_child, function () { displayChits(); });
              },
            });
          })(card, child, status, project);
        }

        col.appendChild(card);
      });

      // Drop zone for cards
      col.addEventListener("dragover", e => {
        // Let project-reorder drags pass through to the wrapper
        if (_kanbanProjectDragActive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        col.style.background = "rgba(139,90,43,0.08)";
      });
      col.addEventListener("dragleave", () => {
        col.style.background = "";
      });
      col.addEventListener("drop", async e => {
        e.preventDefault();
        col.style.background = "";

        // Handle card drops (child chit status change or cross-project move)
        const cardData = e.dataTransfer.getData("application/x-kanban-card");
        if (cardData) {
          try {
            const data = JSON.parse(cardData);
            const newStatus = col.dataset.status;
            const targetProjectId = col.dataset.projectId;
            const isCrossProject = data.projectId !== targetProjectId;

            if (!isCrossProject && data.fromStatus === newStatus) return;

            // Cross-project move: remove from old project, add to new project
            if (isCrossProject) {
              // Remove from old project's child_chits
              const oldProjResp = await fetch(`/api/chit/${data.projectId}`);
              if (!oldProjResp.ok) return;
              const oldProj = await oldProjResp.json();
              oldProj.child_chits = (oldProj.child_chits || []).filter(id => id !== data.chitId);
              await fetch(`/api/chits/${data.projectId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oldProj),
              });

              // Add to new project's child_chits
              const newProjResp = await fetch(`/api/chit/${targetProjectId}`);
              if (!newProjResp.ok) return;
              const newProj = await newProjResp.json();
              if (!Array.isArray(newProj.child_chits)) newProj.child_chits = [];
              if (!newProj.child_chits.includes(data.chitId)) {
                newProj.child_chits.push(data.chitId);
              }
              await fetch(`/api/chits/${targetProjectId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newProj),
              });
            }

            // Update the chit's status
            if (data.fromStatus !== newStatus || isCrossProject) {
              const resp = await fetch(`/api/chit/${data.chitId}`);
              if (!resp.ok) return;
              const fullChit = await resp.json();
              fullChit.status = newStatus;
              if (newStatus === "Complete" && !fullChit.completed_datetime) {
                fullChit.completed_datetime = new Date().toISOString();
              }
              await fetch(`/api/chits/${data.chitId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullChit),
              });
            }

            _kanbanFetchAndPreserveScroll();
          } catch (err) { console.error("Kanban card drop error:", err); }
          return;
        }

        // Handle grandchild drops (move between parent cards)
        const gcData = e.dataTransfer.getData("application/x-kanban-grandchild");
        if (gcData) {
          try {
            const data = JSON.parse(gcData);
            // Find the target card (closest .chit-card under the drop point)
            const targetCard = e.target.closest(".chit-card");
            if (!targetCard || !targetCard.dataset.chitId) return;
            const targetParentId = targetCard.dataset.chitId;
            if (targetParentId === data.parentChitId) return; // same parent, no-op

            // Remove from old parent's child_chits
            const oldParentResp = await fetch(`/api/chit/${data.parentChitId}`);
            if (!oldParentResp.ok) return;
            const oldParent = await oldParentResp.json();
            oldParent.child_chits = (oldParent.child_chits || []).filter(id => id !== data.chitId);
            await fetch(`/api/chits/${data.parentChitId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(oldParent) });

            // Add to new parent's child_chits
            const newParentResp = await fetch(`/api/chit/${targetParentId}`);
            if (!newParentResp.ok) return;
            const newParent = await newParentResp.json();
            if (!Array.isArray(newParent.child_chits)) newParent.child_chits = [];
            if (!newParent.child_chits.includes(data.chitId)) newParent.child_chits.push(data.chitId);
            await fetch(`/api/chits/${targetParentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newParent) });

            _kanbanFetchAndPreserveScroll();
          } catch (err) { console.error("Kanban grandchild drop error:", err); }
        }
      });

      columnsRow.appendChild(col);
    });

    projectBox.appendChild(columnsRow);
    wrapper.appendChild(projectBox);
  });

  // ── Project-level drag-to-reorder ──────────────────────────────────────
  // ── Shared placeholder for project-level reorder (desktop & mobile) ─────
  var _projectReorderPlaceholder = null;
  function _ensureProjectPlaceholder() {
    if (!_projectReorderPlaceholder) {
      _projectReorderPlaceholder = document.createElement('div');
      _projectReorderPlaceholder.className = 'cwoc-project-drop-placeholder';
      _projectReorderPlaceholder.style.cssText = 'height:24px;border:2px dashed #8b5a2b;border-radius:6px;background:rgba(139,90,43,0.08);box-sizing:border-box;margin-bottom:1.5em;transition:height 0.15s ease;';
    }
    return _projectReorderPlaceholder;
  }
  function _removeProjectPlaceholder() {
    if (_projectReorderPlaceholder && _projectReorderPlaceholder.parentNode) {
      _projectReorderPlaceholder.remove();
    }
  }
  function _positionProjectPlaceholder(containerEl, draggedBox, clientY) {
    var ph = _ensureProjectPlaceholder();
    var boxes = Array.from(containerEl.querySelectorAll('.kanban-project-box[data-chit-id]'));
    var others = boxes.filter(function (b) { return b !== draggedBox; });
    var insertIdx = others.length;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        insertIdx = i;
        break;
      }
    }
    if (insertIdx >= others.length) {
      containerEl.appendChild(ph);
    } else {
      containerEl.insertBefore(ph, others[insertIdx]);
    }
    return insertIdx;
  }

  wrapper.addEventListener("dragover", e => {
    // Only handle project reorder drags
    if (!_kanbanProjectDragActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Find the dragged box
    var draggedBox = wrapper.querySelector('.kanban-project-box.cwoc-dragging');
    _positionProjectPlaceholder(wrapper, draggedBox, e.clientY);
  });

  wrapper.addEventListener("dragleave", e => {
    if (!_kanbanProjectDragActive) return;
    // Only remove if leaving the wrapper entirely
    if (!wrapper.contains(e.relatedTarget)) {
      _removeProjectPlaceholder();
    }
  });

  wrapper.addEventListener("drop", e => {
    const draggedId = e.dataTransfer.getData("application/x-project-reorder");
    if (!draggedId) return;
    e.preventDefault();
    _removeProjectPlaceholder();

    // Read order from DOM (dragged box is still in its original position)
    const boxes = Array.from(wrapper.querySelectorAll('.kanban-project-box[data-chit-id]'));
    const ids = boxes.map(b => b.dataset.chitId);
    const fromIdx = ids.indexOf(draggedId);

    // Determine insert position from cursor
    var others = boxes.filter(b => b.dataset.chitId !== draggedId);
    var toIdx = others.length;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        toIdx = i;
        break;
      }
    }
    if (fromIdx < 0) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    saveManualOrder('Projects', ids);
    currentSortField = 'manual';
    const sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    _updateSortUI();

    // Preserve scroll position across the full re-render
    var scrollEl = document.querySelector('.projects-view');
    var savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    displayChits();
    if (savedScroll > 0) {
      var el = document.querySelector('.projects-view');
      if (el) {
        el.scrollTop = savedScroll;
        requestAnimationFrame(function () { if (el) el.scrollTop = savedScroll; });
      }
    }
  });

  // ── Touch gesture for project header reorder (mobile) ──────────────────
  if (typeof enableTouchGesture === 'function') {
    var _kanbanHeaderDraggedBox = null;
    var _kanbanHeaderLastInsertIdx = -1;
    wrapper.querySelectorAll('.kanban-project-header').forEach(function (headerEl) {
      var projectBox = headerEl.closest('.kanban-project-box');
      if (!projectBox || !projectBox.dataset.chitId) return;
      var projectId = projectBox.dataset.chitId;

      enableTouchGesture(headerEl, {
        onDragStart: function () {
          _kanbanHeaderDraggedBox = projectBox;
          _kanbanHeaderLastInsertIdx = -1;
          projectBox.classList.add('cwoc-dragging');
          projectBox.style.opacity = '0.5';
        },
        onDragMove: function (data) {
          if (!_kanbanHeaderDraggedBox) return;
          var idx = _positionProjectPlaceholder(wrapper, _kanbanHeaderDraggedBox, data.clientY);
          _kanbanHeaderLastInsertIdx = idx;

          // Auto-scroll when near edges of the scroll container
          var scrollEl = document.querySelector('.projects-view');
          if (scrollEl) {
            var containerRect = scrollEl.getBoundingClientRect();
            var edgeZone = 50;
            var scrollSpeed = 8;
            if (data.clientY < containerRect.top + edgeZone) {
              scrollEl.scrollTop -= scrollSpeed;
            } else if (data.clientY > containerRect.bottom - edgeZone) {
              scrollEl.scrollTop += scrollSpeed;
            }
          }
        },
        onDragEnd: function (data) {
          if (!_kanbanHeaderDraggedBox) return;
          _kanbanHeaderDraggedBox.classList.remove('cwoc-dragging');
          _kanbanHeaderDraggedBox.style.opacity = '';
          _removeProjectPlaceholder();

          // Read order from DOM and compute new position
          var boxes = Array.from(wrapper.querySelectorAll('.kanban-project-box[data-chit-id]'));
          var ids = boxes.map(function (b) { return b.dataset.chitId; });
          var fromId = _kanbanHeaderDraggedBox.dataset.chitId;
          var fromIdx = ids.indexOf(fromId);
          if (fromIdx < 0) { _kanbanHeaderDraggedBox = null; return; }

          // Use the last tracked insert index from onDragMove
          var toIdx = _kanbanHeaderLastInsertIdx;
          if (toIdx < 0) { _kanbanHeaderDraggedBox = null; return; }

          ids.splice(fromIdx, 1);
          ids.splice(toIdx, 0, fromId);

          saveManualOrder('Projects', ids);
          currentSortField = 'manual';
          var sel = document.getElementById('sort-select');
          if (sel) sel.value = 'manual';
          _updateSortUI();
          _kanbanHeaderDraggedBox = null;

          // Preserve scroll position across the full re-render
          var scrollEl = document.querySelector('.projects-view');
          var savedScroll = scrollEl ? scrollEl.scrollTop : 0;
          displayChits();
          if (savedScroll > 0) {
            var el = document.querySelector('.projects-view');
            if (el) {
              el.scrollTop = savedScroll;
              requestAnimationFrame(function () { if (el) el.scrollTop = savedScroll; });
            }
          }
        },
        onLongPress: function () {
          storePreviousState();
          window.location.href = '/editor?id=' + projectId;
        },
      });
    });
  }

  chitList.appendChild(wrapper);
}

/**
 * Alarms tab: list all chits that have any alert (alarm, notification, timer, stopwatch).
 */
function displayAlarmsView(chitsToDisplay) {
  if (_alarmsViewMode === 'independent') {
    return _displayIndependentAlertsBoard();
  }

  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

  // Include chits with any alert type: alarm flag, notification flag, or alerts array entries
  // But don't count notify-at-start/due flags as alerts for this view
  const alertChits = chitsToDisplay.filter((c) => {
    if (!Array.isArray(c.alerts) || c.alerts.length === 0) {
      return c.alarm || c.notification;
    }
    return c.alerts.length > 0;
  });

  if (alertChits.length === 0) {
    chitList.innerHTML = _emptyState("No chits with alerts found.");
    return;
  }

  const view = document.createElement("div");
  view.className = "alarms-view";

  alertChits.forEach((chit) => {
    const card = document.createElement("div");
    card.className = "chit-card";
    card.draggable = true;
    card.dataset.chitId = chit.id;
    if (chit.archived) card.classList.add("archived-chit");
    if (_isDeclinedByCurrentUser(chit)) card.classList.add("declined-chit");
    applyChitColors(card, chitColor(chit));

    card.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

    // Alert summary
    const alerts = Array.isArray(chit.alerts) ? chit.alerts : [];
    const alarmCount = alerts.filter((a) => a._type === "alarm").length;
    const timerCount = alerts.filter((a) => a._type === "timer").length;
    const swCount = alerts.filter((a) => a._type === "stopwatch").length;
    const notifCount = alerts.filter((a) => a._type === "notification").length;

    const summaryRow = document.createElement("div");
    summaryRow.style.cssText = "margin-top:0.3em;display:flex;align-items:center;gap:0.5em;font-size:0.9em;";
    if (notifCount > 0 || chit.notification) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `📢 ${notifCount || 1}` }));
    if (alarmCount > 0 || chit.alarm) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `🔔 ${alarmCount || 1}` }));
    if (timerCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏱️ ${timerCount}` }));
    if (swCount > 0) summaryRow.appendChild(Object.assign(document.createElement("span"), { textContent: `⏲️ ${swCount}` }));
    if (summaryRow.children.length > 0) card.appendChild(summaryRow);

    card.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });

    view.appendChild(card);
  });

  chitList.appendChild(view);

  // Build long-press map for unified touch gesture (drag + quick-edit)
  var _alLongPressMap = {};
  alertChits.forEach(function (chit) {
    _alLongPressMap[chit.id] = function () { showQuickEditModal(chit, function () { displayChits(); }); };
  });
  enableDragToReorder(view, 'Alarms', () => displayChits(), _alLongPressMap);
}

// ── Independent Alerts Board ─────────────────────────────────────────────────

function _displayIndependentAlertsBoard() {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";

  const types = [
    { key: 'alarm', icon: '🔔', label: 'Alarms' },
    { key: 'timer', icon: '⏱️', label: 'Timers' },
    { key: 'stopwatch', icon: '⏲️', label: 'Stopwatches' },
  ];

  const wrapper = document.createElement("div");
  wrapper.className = "independent-alerts-board";


  types.forEach(typeInfo => {
    const col = document.createElement("div");
    col.className = "sa-column";
    col.dataset.saType = typeInfo.key;

    // Column header with add button
    const colHeader = document.createElement("div");
    colHeader.className = "sa-column-header";
    colHeader.innerHTML = `<span>${typeInfo.icon} ${typeInfo.label}</span>`;
    const addBtn = document.createElement("button");
    addBtn.className = "sa-add-btn";
    addBtn.textContent = "+";
    addBtn.title = `Add ${typeInfo.label.slice(0, -1)}`;
    addBtn.onclick = () => _addIndependentAlert(typeInfo.key);
    colHeader.appendChild(addBtn);
    col.appendChild(colHeader);

    // Cards for this type — apply saved order from localStorage
    var items = _independentAlerts.filter(a => a._type === typeInfo.key);
    var savedOrderKey = 'cwoc_sa_order_' + typeInfo.key;
    try {
      var savedOrder = JSON.parse(localStorage.getItem(savedOrderKey));
      if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        items.sort(function (a, b) {
          var ai = savedOrder.indexOf(String(a.id));
          var bi = savedOrder.indexOf(String(b.id));
          if (ai === -1) ai = savedOrder.length;
          if (bi === -1) bi = savedOrder.length;
          return ai - bi;
        });
      }
    } catch (e) { /* ignore bad localStorage data */ }

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sa-empty";
      empty.textContent = `No independent ${typeInfo.label.toLowerCase()} yet.`;
      col.appendChild(empty);
    } else {
      items.forEach(alert => {
        const data = alert.data || alert;
        var card = _buildIndependentCard(alert.id, typeInfo.key, data);
        card.draggable = true;
        col.appendChild(card);
      });

      // ── HTML5 drag events for desktop parity ─────────────────────────
      var _html5DraggedCard = null;
      col.addEventListener('dragstart', function (e) {
        var card = e.target.closest('.sa-card');
        if (!card) return;
        _html5DraggedCard = card;
        card.classList.add('cwoc-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.alertId || '');
      });
      col.addEventListener('dragend', function (e) {
        if (_html5DraggedCard) {
          _html5DraggedCard.classList.remove('cwoc-dragging');
          _html5DraggedCard = null;
        }
        col.querySelectorAll('.sa-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
      });
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.querySelectorAll('.sa-card').forEach(function (c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
        var target = e.target.closest('.sa-card');
        if (target && target !== _html5DraggedCard) {
          var rect = target.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            target.style.borderTop = '3px solid #8b5a2b';
          } else {
            target.style.borderBottom = '3px solid #8b5a2b';
          }
        }
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!_html5DraggedCard) return;
        var target = e.target.closest('.sa-card');
        if (!target || target === _html5DraggedCard) return;
        var rect = target.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          col.insertBefore(_html5DraggedCard, target);
        } else {
          col.insertBefore(_html5DraggedCard, target.nextSibling);
        }
        // Save new order to localStorage
        var ids = Array.from(col.querySelectorAll('.sa-card[data-alert-id]')).map(function (c) { return c.dataset.alertId; });
        try { localStorage.setItem(savedOrderKey, JSON.stringify(ids)); } catch (e) {}
        _html5DraggedCard.classList.remove('cwoc-dragging');
        _html5DraggedCard = null;
      });

      // ── Touch drag-to-reorder within column (mobile) ─────────────────
      if (typeof enableTouchGesture === 'function') {
        var _saDraggedCard = null;
        col.querySelectorAll('.sa-card').forEach(function (cardEl) {
          enableTouchGesture(cardEl, {
            onDragStart: function () {
              _saDraggedCard = cardEl;
              cardEl.classList.add('cwoc-dragging');
            },
            onDragMove: function (data) {
              if (!_saDraggedCard) return;
              // Clear all drop indicators in this column
              col.querySelectorAll('.sa-card').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Temporarily hide dragged card from hit testing
              _saDraggedCard.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _saDraggedCard.style.pointerEvents = '';
              if (!target) return;
              var targetCard = target.closest('.sa-card');
              if (targetCard && targetCard !== _saDraggedCard) {
                var rect = targetCard.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (data.clientY < midY) {
                  targetCard.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetCard.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_saDraggedCard) return;
              _saDraggedCard.classList.remove('cwoc-dragging');
              // Clear all drop indicators
              col.querySelectorAll('.sa-card').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Find drop target
              _saDraggedCard.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _saDraggedCard.style.pointerEvents = '';
              if (!target) { _saDraggedCard = null; return; }
              var targetCard = target.closest('.sa-card');
              if (!targetCard || targetCard === _saDraggedCard) { _saDraggedCard = null; return; }

              // Reorder in DOM
              var rect = targetCard.getBoundingClientRect();
              if (data.clientY < rect.top + rect.height / 2) {
                col.insertBefore(_saDraggedCard, targetCard);
              } else {
                col.insertBefore(_saDraggedCard, targetCard.nextSibling);
              }

              // Save new order to localStorage
              var ids = Array.from(col.querySelectorAll('.sa-card[data-alert-id]')).map(function (c) { return c.dataset.alertId; });
              try { localStorage.setItem(savedOrderKey, JSON.stringify(ids)); } catch (e) {}
              _saDraggedCard = null;
            },
          });
        });
      }
    }

    wrapper.appendChild(col);
  });

  chitList.appendChild(wrapper);
}

function _addIndependentAlert(type) {
  if (type === 'alarm') {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const defaultTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const dayAbbrs = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    _createIndependentAlert({ _type: 'alarm', name: '', time: defaultTime, days: [dayAbbrs[now.getDay()]], enabled: true });
  } else if (type === 'timer') {
    _createIndependentAlert({ _type: 'timer', name: '', totalSeconds: 0, loop: false });
  } else if (type === 'stopwatch') {
    _createIndependentAlert({ _type: 'stopwatch', name: '' }).then(created => {
      // Auto-start the stopwatch immediately
      if (created && created.id) {
        const id = created.id;
        if (!_saSwRuntime[id]) {
          _saSwRuntime[id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
        }
        const rt = _saSwRuntime[id];
        const startMs = Date.now();
        rt.intervalId = setInterval(() => {
          rt.elapsed = Date.now() - startMs;
          const d = document.getElementById(`sa-sw-display-${id}`);
          if (d) d.textContent = _saSwFmt(rt.elapsed);
        }, 50);
        rt.running = true;
        const btn = document.getElementById(`sa-sw-startstop-${id}`);
        if (btn) btn.textContent = "⏸ Pause";
      }
    });
  }
}

function _buildIndependentCard(id, type, data) {
  const card = document.createElement("div");
  card.className = "sa-card";
  card.dataset.alertId = id;

  if (type === 'alarm') _buildSaAlarmCard(card, id, data);
  else if (type === 'timer') _buildSaTimerCard(card, id, data);
  else if (type === 'stopwatch') _buildSaStopwatchCard(card, id, data);

  return card;
}

// ── Independent Alarm Card ───────────────────────────────────────────────────

function _parseTimeInput(str) {
  // Parse "HH:MM", "H:MM", "HH:MM AM/PM", "H:MM PM" etc. into "HH:MM" 24h format
  if (!str) return null;
  str = str.trim().toUpperCase();
  var match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  var h = parseInt(match[1]), m = parseInt(match[2]), ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function _buildSaAlarmCard(card, id, data) {
  // Name row
  const row1 = document.createElement("div");
  row1.className = "sa-card-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Alarm name";
  nameInput.className = "sa-input sa-name-input";
  if (!data.enabled) nameInput.style.opacity = "0.45";

  // Text input for time — displays in CWOC format, stores as 24h HH:MM
  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.value = _globalFmtTime(data.time || "") || "";
  timeInput.placeholder = _globalTimeFormat === '24hour' ? "HH:MM" : "H:MM AM";
  timeInput.className = "sa-time-input";
  timeInput.inputMode = "numeric";
  if (!data.enabled) timeInput.style.opacity = "0.45";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sa-btn";
  toggleBtn.textContent = data.enabled ? "On" : "Off";
  toggleBtn.onclick = () => {
    data.enabled = !data.enabled;
    // If turning off while snoozed, cancel the snooze
    if (!data.enabled) {
      var _snzKey = 'ia-' + id;
      if (_snoozeRegistry[_snzKey]) {
        delete _snoozeRegistry[_snzKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[_snzKey];
        _persistDismiss(_snzKey);
        syncSend('alert_dismissed', { snoozeKey: _snzKey });
      }
    }
    _updateIndependentAlert(id, data);
  };

  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);

  row1.appendChild(nameInput);
  row1.appendChild(timeInput);
  row1.appendChild(toggleBtn);
  row1.appendChild(delBtn);
  card.appendChild(row1);

  // Days row
  const daysRow = document.createElement("div");
  daysRow.className = "sa-days-row";
  if (!data.enabled) daysRow.style.opacity = "0.45";
  const allDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const wsd = (window._cwocSettings && window._cwocSettings.week_start_day !== undefined) ? parseInt(window._cwocSettings.week_start_day) || 0 : 0;
  for (let d = 0; d < 7; d++) {
    const day = allDays[(wsd + d) % 7];
    const lbl = document.createElement("label");
    lbl.className = "sa-day-label";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = (data.days || []).includes(day);
    cb.addEventListener("change", () => {
      const days = data.days || [];
      if (cb.checked) { if (!days.includes(day)) days.push(day); }
      else { const i = days.indexOf(day); if (i !== -1) days.splice(i, 1); }
      data.days = days;
      _updateIndependentAlert(id, data);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(day));
    daysRow.appendChild(lbl);
  }
  card.appendChild(daysRow);

  // Save name/time on blur
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });
  timeInput.addEventListener("change", () => {
    const parsed = _parseTimeInput(timeInput.value);
    if (parsed) {
      data.time = parsed;
      timeInput.value = _globalFmtTime(parsed);
      if (!data.days || data.days.length === 0) {
        data.days = [allDays[new Date().getDay()]];
      }
      _updateIndependentAlert(id, data);
    } else {
      // Revert to current value
      timeInput.value = _globalFmtTime(data.time || "") || "";
    }
  });

  // Snooze countdown bar — show if this alarm is currently snoozed
  const snoozeKey = `ia-${id}`;
  const snoozeEnd = _snoozeRegistry[snoozeKey];
  if (snoozeEnd && Date.now() < snoozeEnd) {
    const snoozeBar = document.createElement("div");
    snoozeBar.className = "sa-timer-bar";
    snoozeBar.style.marginTop = "0.3em";
    snoozeBar.style.cursor = "pointer";
    snoozeBar.title = "Click to restart snooze · Shift+click to cancel";
    const snoozeFill = document.createElement("div");
    snoozeFill.className = "sa-timer-bar-fill";
    snoozeFill.style.transition = 'none';
    const snoozeText = document.createElement("div");
    snoozeText.className = "sa-timer-bar-text";
    snoozeText.style.fontSize = "1em";
    snoozeBar.appendChild(snoozeFill);
    snoozeBar.appendChild(snoozeText);
    card.appendChild(snoozeBar);

    let _snoozeEndLocal = snoozeEnd;
    const _snoozeInterval = setInterval(() => {
      const remain = Math.max(0, _snoozeEndLocal - Date.now());
      const secs = Math.ceil(remain / 1000);
      const pct = Math.max(0, (remain / _getSnoozeMs()) * 100);
      snoozeFill.style.width = pct + '%';
      const m = Math.floor(secs / 60), s = secs % 60;
      snoozeText.textContent = `💤 ${m}:${String(s).padStart(2,'0')}`;
      if (remain <= 0) { clearInterval(_snoozeInterval); snoozeBar.remove(); }
    }, 200);

    // Click = restart snooze, Shift+click = cancel snooze
    snoozeBar.addEventListener("click", (e) => {
      if (e.shiftKey) {
        // Cancel snooze — dismiss the alarm
        clearInterval(_snoozeInterval);
        delete _snoozeRegistry[snoozeKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[snoozeKey];
        _persistDismiss(snoozeKey);
        syncSend('alert_dismissed', { snoozeKey: snoozeKey });
        snoozeBar.remove();
      } else {
        // Restart snooze
        const newEnd = Date.now() + _getSnoozeMs();
        _snoozeEndLocal = newEnd;
        _snoozeRegistry[snoozeKey] = newEnd;
        if (window._sharedSnoozeRegistry) window._sharedSnoozeRegistry[snoozeKey] = newEnd;
        _persistSnooze(snoozeKey, newEnd);
        syncSend('alert_snoozed', { snoozeKey: snoozeKey, snoozeUntil: newEnd });
      }
    });

    // Long press on mobile = cancel snooze
    let _lpTimer = null;
    snoozeBar.addEventListener("touchstart", () => {
      _lpTimer = setTimeout(() => {
        clearInterval(_snoozeInterval);
        delete _snoozeRegistry[snoozeKey];
        if (window._sharedSnoozeRegistry) delete window._sharedSnoozeRegistry[snoozeKey];
        _persistDismiss(snoozeKey);
        syncSend('alert_dismissed', { snoozeKey: snoozeKey });
        snoozeBar.remove();
      }, 600);
    }, { passive: true });
    snoozeBar.addEventListener("touchend", () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
    snoozeBar.addEventListener("touchmove", () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
  }
}

// ── Independent Timer Card ───────────────────────────────────────────────────

function _saFmtTimer(s, tenths) {
  if (s === undefined || s === null) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  let str = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  if (tenths !== undefined) str += `.${tenths}`;
  return str;
}

function _buildSaTimerCard(card, id, data) {
  if (!_saTimerRuntime[id]) {
    _saTimerRuntime[id] = { remaining: data.totalSeconds || 0, intervalId: null, running: false };
  }
  const rt = _saTimerRuntime[id];

  // Name row (always visible)
  const nameRow = document.createElement("div");
  nameRow.className = "sa-card-row";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Timer name";
  nameInput.className = "sa-input sa-name-input";
  const loopLbl = document.createElement("label");
  loopLbl.className = "sa-day-label";
  const loopCb = document.createElement("input");
  loopCb.type = "checkbox";
  loopCb.checked = !!data.loop;
  loopCb.addEventListener("change", () => { data.loop = loopCb.checked; _updateIndependentAlert(id, data); });
  loopLbl.appendChild(loopCb);
  loopLbl.appendChild(document.createTextNode("🔁"));
  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);
  nameRow.appendChild(nameInput);
  nameRow.appendChild(loopLbl);
  nameRow.appendChild(delBtn);
  card.appendChild(nameRow);
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });

  // Shared display area
  const displayArea = document.createElement("div");
  displayArea.className = "sa-timer-area";

  // Input mode: HH:MM:SS inputs
  const inputRow = document.createElement("div");
  inputRow.className = "sa-timer-input-row";
  const hInput = document.createElement("input");
  hInput.type = "number"; hInput.min = "0"; hInput.placeholder = "HH";
  hInput.value = Math.floor((data.totalSeconds || 0) / 3600) || "";
  hInput.className = "sa-dur-input";
  const mInput = document.createElement("input");
  mInput.type = "number"; mInput.min = "0"; mInput.max = "59"; mInput.placeholder = "MM";
  mInput.value = Math.floor(((data.totalSeconds || 0) % 3600) / 60) || "";
  mInput.className = "sa-dur-input";
  const sInput = document.createElement("input");
  sInput.type = "number"; sInput.min = "0"; sInput.max = "59"; sInput.placeholder = "SS";
  sInput.value = (data.totalSeconds || 0) % 60 || "";
  sInput.className = "sa-dur-input";
  inputRow.appendChild(hInput);
  inputRow.appendChild(document.createTextNode(":"));
  inputRow.appendChild(mInput);
  inputRow.appendChild(document.createTextNode(":"));
  inputRow.appendChild(sInput);

  // Countdown mode: progress bar (HST-style, no CSS transition — instant updates)
  const countdownBar = document.createElement("div");
  countdownBar.className = "sa-timer-bar";
  const barFill = document.createElement("div");
  barFill.className = "sa-timer-bar-fill";
  barFill.style.transition = 'none';
  const barText = document.createElement("div");
  barText.className = "sa-timer-bar-text";
  barText.textContent = _saFmtTimer(rt.remaining);
  countdownBar.appendChild(barFill);
  countdownBar.appendChild(barText);

  displayArea.appendChild(inputRow);
  displayArea.appendChild(countdownBar);
  card.appendChild(displayArea);

  function _showInputMode() { inputRow.style.display = ''; countdownBar.style.display = 'none'; }
  function _showBarMode() { inputRow.style.display = 'none'; countdownBar.style.display = ''; }
  function _updateBar(remainSec, tenths) {
    const total = data.totalSeconds || 1;
    const effective = tenths !== undefined ? remainSec + tenths / 10 : remainSec;
    const pct = Math.max(0, Math.min(100, (effective / total) * 100));
    barFill.style.width = pct + '%';
    barFill.style.background = '';
    barText.textContent = (remainSec < 10 && tenths !== undefined) ? _saFmtTimer(remainSec, tenths) : _saFmtTimer(remainSec);
  }

  // Click countdown bar to pause (keep bar visible, frozen)
  countdownBar.addEventListener("click", () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      if (startStopBtn) startStopBtn.textContent = "▶ Start";
    } else {
      _showInputMode();
    }
  });

  // Controls (declared early so auto-start can reference startStopBtn)
  const controls = document.createElement("div");
  controls.className = "sa-controls";

  const startStopBtn = document.createElement("button");
  startStopBtn.className = "sa-btn";
  startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";

  const resetBtn = document.createElement("button");
  resetBtn.className = "sa-btn";
  resetBtn.textContent = "🔄 Reset";

  // Set initial mode — if running (from sync), auto-start the local countdown
  if (rt.running) {
    _showBarMode();
    _updateBar(rt.remaining);
    if (!rt.intervalId) {
      var _fracRemainInit = rt.remaining * 10;
      rt.intervalId = setInterval(function() {
        _fracRemainInit = Math.max(0, _fracRemainInit - 1);
        rt.remaining = _fracRemainInit / 10;
        var wholeSec = Math.floor(rt.remaining);
        var tenths = Math.floor(_fracRemainInit % 10);
        if (wholeSec < 10) { _updateBar(wholeSec, tenths); } else { _updateBar(Math.ceil(rt.remaining)); }
        if (_fracRemainInit <= 0) {
          clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
          startStopBtn.textContent = "▶ Start";
          rt.remaining = 0;
          _globalPlayTimer();
          barFill.style.width = '100%'; barFill.style.background = ''; barText.textContent = '✓ DONE';
          _showTimerDoneModal(data.name, function() { _globalStopTimer(); });
          if (data.loop) { setTimeout(function() { rt.remaining = data.totalSeconds || 0; startStopBtn.click(); }, 1500); }
          else { setTimeout(function() { _showInputMode(); }, 2500); }
        }
      }, 100);
      startStopBtn.textContent = "⏸ Pause";
    }
  } else if (rt.remaining > 0 && rt.remaining < (data.totalSeconds || 0)) {
    _showBarMode(); _updateBar(rt.remaining);
  } else {
    _showInputMode();
  }

  const updateDuration = () => {
    const total = (parseInt(hInput.value) || 0) * 3600 + (parseInt(mInput.value) || 0) * 60 + (parseInt(sInput.value) || 0);
    data.totalSeconds = total;
    if (!rt.running) { rt.remaining = total; }
    _updateIndependentAlert(id, data);
  };
  [hInput, mInput, sInput].forEach(inp => inp.addEventListener("change", updateDuration));

  // Wire up button handlers
  startStopBtn.onclick = () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      startStopBtn.textContent = "▶ Start";
      syncSend('timer_paused', { alertId: id, remaining: rt.remaining });
    } else {
      if (rt.remaining <= 0) rt.remaining = data.totalSeconds || 0;
      _showBarMode();
      _updateBar(rt.remaining);
      var endTs = Date.now() + rt.remaining * 1000;
      rt._endTs = endTs;
      syncSend('timer_started', { alertId: id, totalSeconds: data.totalSeconds, endTs: endTs, name: data.name });
      // Use 100ms ticks for precision; decrement by 0.1s internally
      let _fracRemain = rt.remaining * 10; // tenths of a second
      rt.intervalId = setInterval(() => {
        _fracRemain = Math.max(0, _fracRemain - 1);
        rt.remaining = _fracRemain / 10;
        const wholeSec = Math.floor(rt.remaining);
        const tenths = Math.floor(_fracRemain % 10);
        if (wholeSec < 10) {
          _updateBar(wholeSec, tenths);
        } else {
          _updateBar(Math.ceil(rt.remaining));
        }
        if (_fracRemain <= 0) {
          clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
          startStopBtn.textContent = "▶ Start";
          rt.remaining = 0;
          _globalPlayTimer();
          barFill.style.width = '100%';
          barFill.style.background = '';
          barText.textContent = '✓ DONE';
          _showTimerDoneModal(data.name, () => { _globalStopTimer(); });
          syncSend('timer_fired', { timerName: data.name, alertId: id });
          if (data.loop) {
            setTimeout(() => {
              rt.remaining = data.totalSeconds || 0;
              startStopBtn.click();
            }, 1500);
          } else {
            setTimeout(() => { _showInputMode(); }, 2500);
          }
        }
      }, 100);
      rt.running = true;
      startStopBtn.textContent = "⏸ Pause";
    }
  };

  resetBtn.onclick = () => {
    clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
    rt.remaining = data.totalSeconds || 0;
    startStopBtn.textContent = "▶ Start";
    _showInputMode();
    syncSend('timer_reset', { alertId: id });
  };

  controls.appendChild(startStopBtn);
  controls.appendChild(resetBtn);
  card.appendChild(controls);
}

// ── Independent Stopwatch Card ───────────────────────────────────────────────

function _saSwFmt(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function _buildSaStopwatchCard(card, id, data) {
  if (!_saSwRuntime[id]) {
    _saSwRuntime[id] = { running: false, elapsed: 0, intervalId: null, laps: [] };
  }
  const rt = _saSwRuntime[id];

  // Name row
  const row1 = document.createElement("div");
  row1.className = "sa-card-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = data.name || "";
  nameInput.placeholder = "Stopwatch name";
  nameInput.className = "sa-input sa-name-input";
  nameInput.addEventListener("change", () => { data.name = nameInput.value; _updateIndependentAlert(id, data); });

  const delBtn = document.createElement("button");
  delBtn.className = "sa-btn sa-del-btn";
  delBtn.textContent = "❌";
  delBtn.onclick = () => _deleteIndependentAlert(id);

  row1.appendChild(nameInput);
  row1.appendChild(delBtn);
  card.appendChild(row1);

  // Display
  const display = document.createElement("div");
  display.className = "sa-timer-display";
  display.id = `sa-sw-display-${id}`;
  display.textContent = _saSwFmt(rt.elapsed);
  card.appendChild(display);

  // Controls
  const controls = document.createElement("div");
  controls.className = "sa-controls";

  const startStopBtn = document.createElement("button");
  startStopBtn.className = "sa-btn";
  startStopBtn.id = `sa-sw-startstop-${id}`;
  startStopBtn.textContent = rt.running ? "⏸ Pause" : "▶ Start";
  startStopBtn.onclick = () => {
    if (rt.running) {
      clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
      startStopBtn.textContent = "▶ Start";
    } else {
      const startMs = Date.now() - rt.elapsed;
      rt.intervalId = setInterval(() => {
        rt.elapsed = Date.now() - startMs;
        display.textContent = _saSwFmt(rt.elapsed);
      }, 50);
      rt.running = true;
      startStopBtn.textContent = "⏸ Pause";
    }
  };

  const lapBtn = document.createElement("button");
  lapBtn.className = "sa-btn";
  lapBtn.textContent = "🏁 Lap";
  lapBtn.onclick = () => {
    if (rt.running) {
      rt.laps.push(_saSwFmt(rt.elapsed));
      _renderSaLaps(lapsDiv, rt.laps);
    }
  };

  const resetBtn = document.createElement("button");
  resetBtn.className = "sa-btn";
  resetBtn.textContent = "🔄 Reset";
  resetBtn.onclick = () => {
    clearInterval(rt.intervalId); rt.intervalId = null; rt.running = false;
    rt.elapsed = 0; rt.laps = [];
    display.textContent = _saSwFmt(0);
    startStopBtn.textContent = "▶ Start";
    _renderSaLaps(lapsDiv, rt.laps);
  };

  controls.appendChild(startStopBtn);
  controls.appendChild(lapBtn);
  controls.appendChild(resetBtn);
  card.appendChild(controls);

  // Laps
  const lapsDiv = document.createElement("div");
  lapsDiv.className = "sa-laps";
  _renderSaLaps(lapsDiv, rt.laps);
  card.appendChild(lapsDiv);
}

function _renderSaLaps(container, laps) {
  container.innerHTML = "";
  if (!laps || laps.length === 0) return;
  laps.forEach((lap, i) => {
    const el = document.createElement("div");
    el.style.cssText = "font-size:0.8em;opacity:0.7;font-family:monospace;";
    el.textContent = `Lap ${i + 1}: ${lap}`;
    container.appendChild(el);
    container.appendChild(el);
  });
}

function filterChits(tab) {
  storePreviousState();

  currentTab = tab;

  // Update mobile Views button to show current tab name
  if (typeof _updateMobileViewsLabel === 'function') _updateMobileViewsLabel();

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[onclick="filterChits('${tab}')"]`)
    ?.classList.add("active");

  // Show/hide period selector and date nav based on Calendar tab
  const periodSection = document.getElementById('section-period');
  const yearWeekContainer = document.getElementById('year-week-container');
  const orderSection = document.getElementById('section-order');
  if (periodSection) {
    periodSection.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (yearWeekContainer) {
    yearWeekContainer.style.display = (tab === 'Calendar') ? '' : 'none';
  }
  if (orderSection) {
    orderSection.style.display = (tab === 'Calendar' || tab === 'Indicators') ? 'none' : '';
  }

  // Show/hide Kanban toggle for Projects tab
  const kanbanSection = document.getElementById('section-kanban');
  if (kanbanSection) {
    kanbanSection.style.display = (tab === 'Projects') ? '' : 'none';
  }

  // Show/hide Alarms view mode toggle
  const alarmsSection = document.getElementById('section-alarms-mode');
  if (alarmsSection) {
    alarmsSection.style.display = (tab === 'Alarms') ? '' : 'none';
  }

  // Show/hide Tasks view mode toggle (Tasks vs Habits)
  const tasksSection = document.getElementById('section-tasks-mode');
  if (tasksSection) {
    tasksSection.style.display = (tab === 'Tasks') ? '' : 'none';
  }

  // Show/hide Filters for Indicators tab (hide them)
  const filtersSection = document.getElementById('section-filters');
  if (filtersSection) {
    filtersSection.style.display = (tab === 'Indicators') ? 'none' : '';
  }
  const clearFiltersSection = document.getElementById('section-clear-filters');
  if (clearFiltersSection && tab === 'Indicators') {
    clearFiltersSection.style.display = 'none';
  }

  // Show/hide Indicators time range controls in sidebar
  const indControls = document.getElementById('section-indicators');
  if (indControls) {
    indControls.style.display = (tab === 'Indicators') ? '' : 'none';
  }

  // Pre-fetch independent alerts when switching to Alarms tab in independent mode
  if (tab === 'Alarms' && _alarmsViewMode === 'independent') {
    _fetchIndependentAlerts();
  }

  _loadLabelFilters();

  // Apply default search filter for this tab (from settings)
  const search = document.getElementById('search');
  if (search && _defaultFilters) {
    const tabKey = tab.toLowerCase();
    if (_defaultFilters[tabKey] && !search.value) {
      search.value = _defaultFilters[tabKey];
    }
  }

  updateDateRange();
  displayChits();
  _updateClearFiltersButton();
}

function searchChits() {
  displayChits();
}

// ═══════════════ GLOBAL SEARCH ═══════════════

/**
 * HTML-escape text, then wrap all case-insensitive occurrences of `query` in <mark> tags.
 * Returns original text unchanged if query is empty.
 */
function highlightMatch(text, query) {
  if (!text) return '';
  if (!query) return text;
  // HTML-escape the text first
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  // Escape regex special chars in query using a loop to avoid replacement issues
  var specials = '.*+?^${}()|[]\\';
  var safeQuery = '';
  for (var i = 0; i < query.length; i++) {
    if (specials.indexOf(query[i]) !== -1) safeQuery += '\\';
    safeQuery += query[i];
  }
  var regex = new RegExp('(' + safeQuery + ')', 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

// ── Indicators View — Health trend charts ─────────────────────────────────────

async function displayIndicatorsView() {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;

  chitList.innerHTML = '<div style="padding:1em;overflow-y:auto;height:100%;box-sizing:border-box;">' +
    '<div id="indicators-latest"></div>' +
    '<div id="indicators-charts"></div>' +
  '</div>';

  var now = new Date();
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput && !startInput.value) {
    var monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    startInput.value = _indFmtDate(monthAgo);
  }
  if (endInput && !endInput.value) {
    endInput.value = _indFmtDate(now);
  }
  if (!window._indRange) window._indRange = 'month';
  _indicatorsHighlightBtn(window._indRange);
  _indRestoreSelection();
  _indicatorsLoad();
}

// Persist/restore indicator checkbox selection
function _indSaveSelection() {
  var sel = [];
  document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
    if (cb.checked) sel.push(cb.dataset.ind);
  });
  try { localStorage.setItem('cwoc_ind_selection', JSON.stringify(sel)); } catch(e) {}
}
function _indRestoreSelection() {
  try {
    var raw = localStorage.getItem('cwoc_ind_selection');
    if (!raw) return;
    var sel = JSON.parse(raw);
    if (!Array.isArray(sel)) return;
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      cb.checked = sel.indexOf(cb.dataset.ind) !== -1;
    });
  } catch(e) {}
}

function _indFmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _indicatorsSetRange(range) {
  var now = new Date();
  var start = new Date(now);
  if (range === 'day') start.setDate(start.getDate() - 1);
  else if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setMonth(start.getMonth() - 1);
  else if (range === 'year') start.setFullYear(start.getFullYear() - 1);
  else if (range === 'all') start = new Date(2020, 0, 1);

  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput) startInput.value = _indFmtDate(start);
  if (endInput) endInput.value = _indFmtDate(now);
  window._indRange = range;
  _indicatorsHighlightBtn(range);
  _indicatorsLoad();
}

function _indicatorsHighlightBtn(range) {
  document.querySelectorAll('._ind-btn').forEach(function(b) {
    var isActive = b.textContent.trim().toLowerCase() === range;
    b.style.background = isActive ? 'ivory' : '';
  });
}

function _indicatorsLoadCustomRange() {
  window._indRange = 'custom';
  document.querySelectorAll('._ind-btn').forEach(function(b) { b.style.background = ''; });
  _indicatorsLoad();
}

async function _indicatorsLoad() {
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  var container = document.getElementById('indicators-charts');
  if (!container) return;

  var since = startInput ? startInput.value : '';
  var until = endInput ? endInput.value + 'T23:59:59' : '';
  container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">⏳ Loading…</div>';

  try {
    var url = '/api/health-data';
    var params = [];
    if (since) params.push('since=' + encodeURIComponent(since));
    if (until) params.push('until=' + encodeURIComponent(until));
    if (params.length) url += '?' + params.join('&');

    var resp = await fetch(url);
    if (!resp.ok) throw new Error('API error');
    var data = await resp.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">No health data in this time range.<br>Add health indicators to chits in the editor.</div>';
      return;
    }

    var settings = await getCachedSettings();
    var isMetric = (settings.unit_system === 'metric');

    var charts = [
      { key: 'heart_rate', label: '❤️ Heart Rate', unit: 'bpm', color: '#b22222' },
      { key: 'bp_systolic', label: '🩸 Blood Pressure', unit: 'mmHg', color: '#c44', paired: 'bp_diastolic', pairedLabel: 'Diastolic', pairedColor: '#4682b4' },
      { key: 'spo2', label: '🫁 Oxygen Saturation', unit: '%', color: '#4682b4' },
      { key: 'temperature', label: '🌡️ Temperature', unit: isMetric ? '°C' : '°F', color: '#d4a017' },
      { key: 'weight', label: '⚖️ Weight', unit: isMetric ? 'kg' : 'lbs', color: '#6b8e23' },
      { key: 'height', label: '📐 Height', unit: isMetric ? 'cm' : 'in', color: '#8b5a2b' },
      { key: 'glucose', label: '🍬 Glucose', unit: isMetric ? 'mmol/L' : 'mg/dL', color: '#d2691e' },
      { key: 'distance', label: '🏃 Distance', unit: isMetric ? 'km' : 'mi', color: '#2e8b57' },
    ];

    // Get selected indicators from sidebar checkboxes + persist
    var selectedKeys = [];
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      if (cb.checked) selectedKeys.push(cb.dataset.ind);
    });
    _indSaveSelection();

    // Build latest values header — cards fill the row evenly
    var latestDiv = document.getElementById('indicators-latest');
    if (latestDiv) {
      latestDiv.innerHTML = '';
      charts.forEach(function(ch) {
        var latest = null;
        if (data && data.length > 0) {
          for (var di = data.length - 1; di >= 0; di--) {
            if (data[di][ch.key] != null) { latest = data[di]; break; }
          }
        }
        var val = latest ? latest[ch.key] : '—';
        var card = document.createElement('div');
        var isClickable = latest && latest.chit_id;
        card.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:5px;padding:6px 10px;text-align:center;' + (isClickable ? 'cursor:pointer;' : '');
        card.title = latest ? (latest.chit_title || '') + ' — ' + (latest.date || '') : '';
        if (isClickable) {
          (function(chitId) {
            card.addEventListener('click', function() {
              storePreviousState();
              window.location.href = '/editor?id=' + chitId;
            });
          })(latest.chit_id);
        }
        var labelText = ch.label.split(' ').slice(1).join(' ');
        card.innerHTML = '<div style="font-size:0.7em;color:#6b4e31;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + labelText + '</div>' +
          '<div style="font-size:1.2em;font-weight:bold;color:' + ch.color + ';">' + (val !== '—' ? (Math.round(val * 10) / 10) : '—') + '</div>' +
          '<div style="font-size:0.65em;color:#8b7355;">' + ch.unit + '</div>';
        latestDiv.appendChild(card);
      });
    }

    container.innerHTML = '';

    charts.forEach(function(chart) {
      if (selectedKeys.indexOf(chart.key) === -1) return;

      var points = [];
      if (data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.key] != null) points.push({ date: d.date, datetime: d.datetime, value: d[chart.key], title: d.chit_title, chitId: d.chit_id });
        });
      }
      var pairedPoints = [];
      if (chart.paired && data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.paired] != null) pairedPoints.push({ date: d.date, datetime: d.datetime, value: d[chart.paired] });
        });
      }

      var chartDiv = document.createElement('div');
      chartDiv.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:6px;padding:8px 10px;';
      chartDiv.dataset.indKey = chart.key;

      // Header with expand button
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
      var title = document.createElement('span');
      title.style.cssText = 'font-weight:bold;font-size:0.9em;color:#2b1e0f;';
      title.textContent = chart.label + ' (' + chart.unit + ')' + (chart.paired ? ' / ' + chart.pairedLabel : '');
      header.appendChild(title);
      var expandBtn = document.createElement('button');
      expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
      expandBtn.title = 'Expand / collapse this chart';
      expandBtn.style.cssText = 'background:none;border:1px solid #8b5a2b;border-radius:3px;cursor:pointer;font-size:0.85em;padding:2px 7px;color:#6b4e31;';
      (function(chartKey) {
        expandBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _indToggleExpand(chartKey);
        });
      })(chart.key);
      header.appendChild(expandBtn);
      chartDiv.appendChild(header);

      if (points.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:20px 0;opacity:0.4;font-size:0.85em;';
        empty.textContent = 'No data';
        chartDiv.appendChild(empty);
        container.appendChild(chartDiv);
        return;
      }

      var svgWidth = 500, svgHeight = 180, padL = 45, padR = 10, padT = 8, padB = 22;
      var plotW = svgWidth - padL - padR, plotH = svgHeight - padT - padB;

      var allVals = points.map(function(p) { return p.value; });
      if (pairedPoints.length) pairedPoints.forEach(function(p) { allVals.push(p.value); });
      var minVal = Math.min.apply(null, allVals), maxVal = Math.max.apply(null, allVals);
      var valPad = (maxVal - minVal) * 0.1 || 1;
      minVal -= valPad; maxVal += valPad;
      var valRange = maxVal - minVal;

      var allDates = points.map(function(p) { return new Date(p.datetime || p.date).getTime(); });
      var minDate = Math.min.apply(null, allDates), maxDate = Math.max.apply(null, allDates);
      if (minDate === maxDate) { minDate -= 86400000; maxDate += 86400000; }
      var dateRange = maxDate - minDate;

      function xPos(ts) { return padL + ((ts - minDate) / dateRange) * plotW; }
      function yPos(v) { return padT + plotH - ((v - minVal) / valRange) * plotH; }

      var svg = '<svg viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">';
      for (var gi = 0; gi <= 3; gi++) {
        var gy = padT + (plotH / 3) * gi, gv = maxVal - (valRange / 3) * gi;
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (svgWidth - padR) + '" y2="' + gy + '" stroke="#e0d4b5" stroke-width="0.5"/>';
        svg += '<text x="' + (padL - 3) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#6b4e31">' + (Math.round(gv * 10) / 10) + '</text>';
      }
      var xSteps = Math.min(points.length, 6);
      // Smart date labels: use shorter format when dates are close together
      var _dateSpanDays = (maxDate - minDate) / 86400000;
      for (var xi = 0; xi < xSteps; xi++) {
        var idx = Math.round(xi * (points.length - 1) / Math.max(xSteps - 1, 1));
        var pt = points[idx], tx = xPos(new Date(pt.datetime || pt.date).getTime());
        var _labelDate = new Date(pt.datetime || pt.date);
        var _dateLabel;
        if (_dateSpanDays <= 2) {
          // Very short range: show time
          _dateLabel = String(_labelDate.getHours()).padStart(2, '0') + ':' + String(_labelDate.getMinutes()).padStart(2, '0');
        } else if (_dateSpanDays <= 14) {
          // Short range: day of month only
          _dateLabel = String(_labelDate.getDate());
        } else if (_dateSpanDays <= 90) {
          // Medium range: M/D
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate();
        } else {
          // Long range: M/D/YY
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate() + '/' + String(_labelDate.getFullYear()).slice(2);
        }
        svg += '<text x="' + tx + '" y="' + (svgHeight - 3) + '" text-anchor="middle" font-size="8" fill="#6b4e31">' + _dateLabel + '</text>';
      }
      if (pairedPoints.length > 1) {
        var pp = 'M';
        pairedPoints.forEach(function(p, i) { pp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + pp + '" fill="none" stroke="' + chart.pairedColor + '" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>';
      }
      if (points.length > 1) {
        var lp = 'M';
        points.forEach(function(p, i) { lp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + lp + '" fill="none" stroke="' + chart.color + '" stroke-width="2"/>';
      }
      points.forEach(function(p) {
        var cx = xPos(new Date(p.datetime || p.date).getTime()), cy = yPos(p.value);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.5" fill="' + chart.color + '" stroke="#fff8e1" stroke-width="1" style="cursor:pointer" onclick="storePreviousState();window.location.href=\'/editor?id=' + p.chitId + '\'">' +
          '<title>' + p.date + ': ' + p.value + ' ' + chart.unit + '\n' + p.title + '</title></circle>';
      });
      svg += '</svg>';
      var svgWrap = document.createElement('div');
      svgWrap.className = 'ind-chart-svg-wrap';
      svgWrap.style.cssText = 'width:100%;aspect-ratio:500/180;min-height:120px;';
      svgWrap.innerHTML = svg;
      chartDiv.appendChild(svgWrap);
      container.appendChild(chartDiv);
    });

    if (container.children.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">Select indicators in the sidebar.</div>';
    } else {
      // Enable drag-to-reorder on indicator charts (HTML5 desktop + touch mobile)
      _enableIndicatorsDragReorder(container);
      // Restore saved chart order
      _restoreIndicatorsOrder(container);

      // ── Touch gesture for indicator chart reorder (mobile) ─────────────
      if (typeof enableTouchGesture === 'function') {
        var _indDraggedChart = null;
        container.querySelectorAll('[data-ind-key]').forEach(function (chartEl) {
          enableTouchGesture(chartEl, {
            onDragStart: function () {
              _indDraggedChart = chartEl;
              chartEl.classList.add('cwoc-dragging');
            },
            onDragMove: function (data) {
              if (!_indDraggedChart) return;
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Temporarily hide dragged chart from hit testing
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) return;
              var targetChart = target.closest('[data-ind-key]');
              if (targetChart && targetChart !== _indDraggedChart) {
                var rect = targetChart.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (data.clientY < midY) {
                  targetChart.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetChart.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_indDraggedChart) return;
              _indDraggedChart.classList.remove('cwoc-dragging');
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Find drop target
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) { _indDraggedChart = null; return; }
              var targetChart = target.closest('[data-ind-key]');
              if (!targetChart || targetChart === _indDraggedChart) { _indDraggedChart = null; return; }

              // Reorder in DOM
              var rect = targetChart.getBoundingClientRect();
              if (data.clientY < rect.top + rect.height / 2) {
                container.insertBefore(_indDraggedChart, targetChart);
              } else {
                container.insertBefore(_indDraggedChart, targetChart.nextSibling);
              }

              // Save new order to localStorage
              var order = [];
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                order.push(c.dataset.indKey);
              });
              try { localStorage.setItem('cwoc_ind_chart_order', JSON.stringify(order)); } catch (ex) {}
              if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
              _indDraggedChart = null;
            },
            onLongPress: function () {
              // Long-press: open quick-edit modal for the indicator's chit if applicable
              var indKey = chartEl.dataset.indKey;
              // Find the most recent chit that has this indicator
              var matchChit = null;
              if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                for (var ci = chits.length - 1; ci >= 0; ci--) {
                  var c = chits[ci];
                  if (c.health_indicators && c.health_indicators[indKey] != null) {
                    matchChit = c;
                    break;
                  }
                }
              }
              if (matchChit && typeof showQuickEditModal === 'function') {
                showQuickEditModal(matchChit, function () { displayChits(); });
              }
            },
          });
        });
      }
    }
  } catch (e) {
    console.error('Indicators load error:', e);
    container.innerHTML = '<div style="text-align:center;padding:2em;color:#b22222;">Failed to load health data.</div>';
  }
}

// Expand/collapse a single indicator chart to fill the view
function _indToggleExpand(key) {
  var container = document.getElementById('indicators-charts');
  if (!container) return;
  var expanded = container.dataset.expanded;
  if (expanded === key) {
    // Collapse — show all again
    delete container.dataset.expanded;
    container.style.gridTemplateColumns = '';
    Array.from(container.children).forEach(function(c) {
      c.style.display = '';
      // Reset SVG wrapper to normal size
      var wrap = c.querySelector('.ind-chart-svg-wrap');
      if (wrap) {
        wrap.style.aspectRatio = '500/180';
        wrap.style.minHeight = '120px';
        wrap.style.maxHeight = '';
        wrap.style.height = '';
      }
      // Reset expand button icon
      var btn = c.querySelector('button i.fas');
      if (btn) btn.className = 'fas fa-expand';
    });
  } else {
    // Expand — hide all except this one, make it fill available space
    container.dataset.expanded = key;
    container.style.gridTemplateColumns = '1fr';
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        c.style.display = '';
        // Make SVG wrapper fill available height
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          wrap.style.aspectRatio = 'auto';
          wrap.style.minHeight = '300px';
          // Calculate available height: viewport minus header, latest cards, chart header, padding
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
          wrap.style.height = Math.max(300, availH) + 'px';
        }
        // Update expand button icon to compress
        var btn = c.querySelector('button i.fas');
        if (btn) btn.className = 'fas fa-compress';
      } else {
        c.style.display = 'none';
      }
    });
  }
}

// Resize handler — update expanded chart height on window resize/zoom
var _indResizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_indResizeTimer);
  _indResizeTimer = setTimeout(function() {
    var container = document.getElementById('indicators-charts');
    if (!container || !container.dataset.expanded) return;
    var key = container.dataset.expanded;
    // Recalculate the expanded chart height
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.height = Math.max(300, availH) + 'px';
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
        }
      }
    });
  }, 150);
});

// ── Indicators drag-to-reorder ───────────────────────────────────────────────

var _IND_ORDER_KEY = 'cwoc_indicators_chart_order';

function _enableIndicatorsDragReorder(container) {
  var draggedEl = null;

  Array.from(container.children).forEach(function(chartDiv) {
    if (!chartDiv.dataset.indKey) return;
    chartDiv.draggable = true;
    chartDiv.style.cursor = 'grab';

    chartDiv.addEventListener('dragstart', function(e) {
      draggedEl = chartDiv;
      e.dataTransfer.setData('text/plain', chartDiv.dataset.indKey);
      e.dataTransfer.effectAllowed = 'move';
      chartDiv.style.opacity = '0.4';
    });

    chartDiv.addEventListener('dragend', function() {
      chartDiv.style.opacity = '';
      draggedEl = null;
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
    });

    chartDiv.addEventListener('dragover', function(e) {
      if (!draggedEl || draggedEl === chartDiv) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var rect = chartDiv.getBoundingClientRect();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (e.clientY < rect.top + rect.height / 2) {
        chartDiv.style.borderTop = '3px solid #8b5a2b';
      } else {
        chartDiv.style.borderBottom = '3px solid #8b5a2b';
      }
    });

    chartDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (!draggedEl || draggedEl === chartDiv) return;

      var rect = chartDiv.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        container.insertBefore(draggedEl, chartDiv);
      } else {
        container.insertBefore(draggedEl, chartDiv.nextSibling);
      }

      // Save order
      var order = [];
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        order.push(c.dataset.indKey);
      });
      try { localStorage.setItem(_IND_ORDER_KEY, JSON.stringify(order)); } catch(ex) {}
    });
  });
}

function _restoreIndicatorsOrder(container) {
  try {
    var raw = localStorage.getItem(_IND_ORDER_KEY);
    if (!raw) return;
    var order = JSON.parse(raw);
    if (!Array.isArray(order)) return;

    // Reorder children to match saved order
    order.forEach(function(key) {
      var el = container.querySelector('[data-ind-key="' + key + '"]');
      if (el) container.appendChild(el);
    });
  } catch(ex) {}
}


