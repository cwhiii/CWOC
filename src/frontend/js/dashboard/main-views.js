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

      chitElement.appendChild(_buildChitHeader(chit, `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`, _viSettings));

      // Checklist progress count
      const items = chit.checklist || [];
      const checked = items.filter(i => i.checked || i.done).length;
      const progressEl = document.createElement("div");
      progressEl.style.cssText = "font-size:0.8em;opacity:0.7;margin-bottom:0.3em;";
      progressEl.textContent = `${checked}/${items.length} ✓`;
      chitElement.appendChild(progressEl);

      // Interactive checklist from shared.js (disabled for viewer-role shared chits)
      if (!_isViewerRole(chit)) {
        renderInlineChecklist(chitElement, chit, () => fetchChits());
      } else {
        // Read-only checklist display for viewers
        var roList = document.createElement('div');
        roList.style.cssText = 'opacity:0.8;font-size:0.9em;';
        (chit.checklist || []).forEach(function(item) {
          var row = document.createElement('div');
          row.style.cssText = 'padding:2px 0;';
          row.textContent = (item.checked || item.done ? '☑ ' : '☐ ') + (item.text || item.label || '');
          roList.appendChild(row);
        });
        chitElement.appendChild(roList);
      }

      chitElement.addEventListener("dblclick", () => {
        storePreviousState();
        window.location.href = `/editor?id=${chit.id}`;
      });
      if (typeof enableLongPress === 'function') {
        enableLongPress(chitElement, function () {
          if (!_isViewerRole(chit)) showQuickEditModal(chit, () => displayChits());
        });
      }
      checklistView.appendChild(chitElement);
    });
  }

  chitList.appendChild(checklistView);
  enableDragToReorder(checklistView, 'Checklists', () => displayChits());
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

    // Note preview (right, rendered markdown)
    if (chit.note && chit.note.trim()) {
      const notePreview = document.createElement("div");
      notePreview.style.cssText = "flex:1;min-width:0;opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;";
      if (typeof marked !== 'undefined') {
        notePreview.innerHTML = resolveChitLinks(marked.parse(chit.note.slice(0, 500)), chits);
      } else {
        notePreview.textContent = chit.note.slice(0, 300) + (chit.note.length > 300 ? '…' : '');
      }
      controls.appendChild(notePreview);
    }

    chitElement.appendChild(controls);

    chitElement.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${chit.id}`;
    });
    if (typeof enableLongPress === 'function') {
      enableLongPress(chitElement, function () {
        if (!_isViewerRole(chit)) showQuickEditModal(chit, () => displayChits());
      });
    }
    tasksContainer.appendChild(chitElement);
  });
  chitList.appendChild(tasksContainer);
  enableDragToReorder(tasksContainer, 'Tasks', () => displayChits());
}

/* ── Habits View ─────────────────────────────────────────────────────────── */

/**
 * Render the Habits view — one card per recurring chit with completion toggle,
 * success rate badge, and streak indicator.
 */
function displayHabitsView(chitsToDisplay) {
  var chitList = document.getElementById('chit-list');
  chitList.innerHTML = '';

  // Filter to only recurring chits with a valid frequency
  var habitChits = chitsToDisplay.filter(function(chit) {
    return chit.recurrence_rule && chit.recurrence_rule.freq;
  });

  if (habitChits.length === 0) {
    chitList.innerHTML = _emptyState('No habits found. Create a recurring chit to see it here.');
    return;
  }

  // Read success window setting
  var settings = window._cwocSettings || {};
  var windowDays = settings.habits_success_window || '30';

  // Build habit data: compute period date, completion state, metrics
  var habitData = habitChits.map(function(chit) {
    var periodDate = getCurrentPeriodDate(chit);
    var exceptions = chit.recurrence_exceptions || [];
    var isCompleted = exceptions.some(function(ex) {
      return ex.date === periodDate && ex.completed === true;
    });
    var successRate = getHabitSuccessRate(chit, windowDays === 'all' ? 'all' : parseInt(windowDays, 10));
    var streak = getHabitStreak(chit);
    return {
      chit: chit,
      periodDate: periodDate,
      isCompleted: isCompleted,
      successRate: successRate,
      streak: streak,
      hideWhenDone: !!chit.hide_when_instance_done
    };
  });

  // Determine which habits should be hidden (hide_when_instance_done + completed)
  var showCompleted = false;
  var showCompletedCheckbox = null;
  var hiddenCount = habitData.filter(function(h) {
    return h.hideWhenDone && h.isCompleted;
  }).length;

  var habitsContainer = document.createElement('div');
  habitsContainer.className = 'checklist-view'; // reuse consistent spacing

  // Render "Show completed" toggle if any habits are hidden
  if (hiddenCount > 0) {
    var toggleRow = document.createElement('div');
    toggleRow.className = 'habit-show-completed';
    var toggleLabel = document.createElement('label');
    toggleLabel.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9em;';
    showCompletedCheckbox = document.createElement('input');
    showCompletedCheckbox.type = 'checkbox';
    showCompletedCheckbox.checked = false;
    showCompletedCheckbox.addEventListener('change', function() {
      showCompleted = showCompletedCheckbox.checked;
      _renderHabitCards(habitsContainer, habitData, showCompleted, windowDays);
    });
    toggleLabel.appendChild(showCompletedCheckbox);
    toggleLabel.appendChild(document.createTextNode('Show completed (' + hiddenCount + ' hidden)'));
    toggleRow.appendChild(toggleLabel);
    habitsContainer.appendChild(toggleRow);
  }

  // Render the habit cards
  _renderHabitCards(habitsContainer, habitData, showCompleted, windowDays);

  chitList.appendChild(habitsContainer);
}

/**
 * Render habit cards into the container. Handles sorting and hide-when-done filtering.
 */
function _renderHabitCards(container, habitData, showCompleted, windowDays) {
  // Remove existing cards (keep the show-completed toggle if present)
  var toggleRow = container.querySelector('.habit-show-completed');
  container.innerHTML = '';
  if (toggleRow) container.appendChild(toggleRow);

  // Filter out hidden habits unless showCompleted is checked
  var visible = habitData.filter(function(h) {
    if (h.hideWhenDone && h.isCompleted && !showCompleted) return false;
    return true;
  });

  // Stable sort: incomplete first, completed last
  var incomplete = visible.filter(function(h) { return !h.isCompleted; });
  var completed = visible.filter(function(h) { return h.isCompleted; });
  var sorted = incomplete.concat(completed);

  if (sorted.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'cwoc-empty';
    emptyMsg.style.cssText = 'text-align:center;padding:2em 1em;opacity:0.7;';
    emptyMsg.innerHTML = '<p>All habits completed! ✨</p>';
    container.appendChild(emptyMsg);
    return;
  }

  sorted.forEach(function(h) {
    var chit = h.chit;
    var card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.chitId = chit.id;
    if (h.isCompleted) card.classList.add('habit-done');
    // Apply chit color
    if (typeof applyChitColors === 'function') {
      applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    }

    // ── Header row: checkbox + title + frequency ──
    var header = document.createElement('div');
    header.className = 'habit-header';

    // Completion checkbox
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = h.isCompleted;
    checkbox.title = h.isCompleted ? 'Mark as not done' : 'Mark as done';
    checkbox.addEventListener('change', function(e) {
      e.stopPropagation();
      var newCompleted = checkbox.checked;
      var exception = { date: h.periodDate, completed: newCompleted };
      fetch('/api/chits/' + chit.id + '/recurrence-exceptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exception: exception })
      }).then(function(resp) {
        if (resp.ok && typeof fetchChits === 'function') fetchChits();
      }).catch(function(err) {
        console.error('Failed to toggle habit completion:', err);
      });
    });
    header.appendChild(checkbox);

    // Title as clickable link
    var titleLink = document.createElement('a');
    titleLink.href = '/editor?id=' + chit.id;
    titleLink.textContent = chit.title || '(Untitled)';
    titleLink.className = 'habit-title';
    titleLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    header.appendChild(titleLink);

    // Middle dot separator + frequency label
    var freqLabel = formatRecurrenceRule(chit.recurrence_rule);
    if (freqLabel) {
      var sep = document.createElement('span');
      sep.className = 'habit-separator';
      sep.textContent = ' · ';
      header.appendChild(sep);

      var freq = document.createElement('span');
      freq.className = 'habit-frequency';
      freq.textContent = freqLabel;
      header.appendChild(freq);
    }

    card.appendChild(header);

    // ── Metrics row: success rate badge + streak indicator ──
    var metrics = document.createElement('div');
    metrics.className = 'habit-metrics';

    var badge = document.createElement('span');
    badge.className = 'habit-success-badge';
    badge.textContent = h.successRate + '%';
    badge.title = 'Success rate (' + (windowDays === 'all' ? 'all time' : 'last ' + windowDays + ' days') + ')';
    metrics.appendChild(badge);

    if (h.streak > 0) {
      var streakEl = document.createElement('span');
      streakEl.className = 'habit-streak';
      streakEl.textContent = '🔥 ' + h.streak;
      streakEl.title = h.streak + ' consecutive period' + (h.streak !== 1 ? 's' : '') + ' completed';
      metrics.appendChild(streakEl);
    }

    card.appendChild(metrics);

    // ── Interaction: double-click to editor, long-press for quick edit ──
    card.addEventListener('dblclick', function() {
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    if (typeof enableLongPress === 'function') {
      enableLongPress(card, function() {
        showQuickEditModal(chit, function() { displayChits(); });
      });
    }

    container.appendChild(card);
  });
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

    // Note preview (right, rendered markdown)
    if (chit.note && chit.note.trim()) {
      var notePreview = document.createElement('div');
      notePreview.style.cssText = 'flex:1;min-width:0;opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;';
      if (typeof marked !== 'undefined') {
        notePreview.innerHTML = resolveChitLinks(marked.parse(chit.note.slice(0, 500)), chits);
      } else {
        notePreview.textContent = chit.note.slice(0, 300) + (chit.note.length > 300 ? '…' : '');
      }
      controls.appendChild(notePreview);
    }

    chitElement.appendChild(controls);

    chitElement.addEventListener('dblclick', function() {
      storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    if (typeof enableLongPress === 'function') {
      enableLongPress(chitElement, function() {
        if (!_isViewerRole(chit)) showQuickEditModal(chit, function() { displayChits(); });
      });
    }
    container.appendChild(chitElement);
  });

  chitList.appendChild(container);
  enableDragToReorder(container, 'AssignedToMe', function() { displayChits(); });
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
      if (typeof enableLongPress === 'function') {
        enableLongPress(chitElement, function () {
          // Prevent inline editing for viewer-role shared chits
          if (_isViewerRole(chit)) return;
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
          var _lpSaveEdit = function () {
            noteEl.contentEditable = 'false';
            noteEl.style.outline = '';
            noteEl.style.padding = '';
            chitElement.style.cursor = 'grab';
            chitElement.removeAttribute('draggable');
            var newNote = noteEl.textContent;
            if (newNote !== chit.note) {
              fetch('/api/chits/' + chit.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, chit, { note: newNote }))
              }).then(function (r) { if (r.ok) { chit.note = newNote; fetchChits(); } });
            } else {
              if (typeof marked !== 'undefined' && chit.note) {
                noteEl.innerHTML = resolveChitLinks(marked.parse(chit.note), chits);
              }
            }
          };
          noteEl.addEventListener('blur', _lpSaveEdit, { once: true });
        });
      }
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

  enableNotesDragReorder(notesView, 'Notes', () => displayChits());
}

/**
 * Cap the all-day events area height and add a Show More / Show Less toggle.
 * Places the toggle in the 60px hour-label spacer on the left side.
 */

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
  const projects = chits.filter((c) => {
    if (!c.is_project_master || c.deleted || c.archived) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

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
    box.style.cssText = `border:2px solid #8b5a2b;border-radius:6px;overflow:hidden;background:${projectColor};color:${projectFontColor};`;

    // Project header row — use standard header builder
    const header = document.createElement("div");
    header.style.cssText = `padding:0.5em 0.7em;background:${projectColor};color:${projectFontColor};cursor:pointer;`;
    header.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)", _viSettings));

    if (project.note) {
      const note = document.createElement("div");
      note.style.cssText = "font-size:0.8em;opacity:0.65;margin-top:2px;padding:0 0.7em;";
      note.textContent = project.note.slice(0, 100) + (project.note.length > 100 ? "…" : "");
      header.appendChild(note);
    }
    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });
    box.appendChild(header);

    // Child chits tree
    if (childIds.length > 0) {
      const tree = document.createElement("ul");
      tree.style.cssText = "list-style:none;margin:0;padding:0 0 0.5em 0;border-top:1px solid rgba(139,90,43,0.2);";

      childIds.forEach((childId) => {
        const child = chitMap[childId];
        const childBg = child ? chitColor(child) : "#fdf6e3";
        const childFont = contrastColorForBg(childBg);
        const li = document.createElement("li");
        li.style.cssText = `display:flex;flex-direction:column;gap:0.2em;padding:0.5em 0.8em 0.5em 1.5em;border-bottom:1px solid rgba(139,90,43,0.1);background:${childBg};color:${childFont};cursor:pointer;min-height:2.2em;`;

        const titleRow = document.createElement("div");
        titleRow.style.cssText = "display:flex;align-items:center;gap:0.5em;";

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

          // Note preview (rendered markdown, same as Tasks view)
          if (child.note && child.note.trim()) {
            const notePreview = document.createElement("div");
            notePreview.style.cssText = "opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;margin-top:3px;";
            if (typeof marked !== 'undefined') {
              notePreview.innerHTML = resolveChitLinks(marked.parse(child.note.slice(0, 500)), chits);
            } else {
              notePreview.textContent = child.note.slice(0, 300) + (child.note.length > 300 ? '…' : '');
            }
            li.appendChild(notePreview);
          }

          li.addEventListener("dblclick", () => {
            storePreviousState();
            window.location.href = `/editor?id=${child.id}`;
          });
        }

        tree.appendChild(li);
      });

      box.appendChild(tree);
    }

    view.appendChild(box);
  });

  chitList.appendChild(view);
}

/**
 * Projects Kanban view: each project master is a row of status columns.
 * Projects Kanban view: each project master is a row of status columns.
 * Child chits of each project are cards in the appropriate column.
 * Grandchildren (children of children) appear as sub-items within cards.
 * Supports drag & drop between columns and between projects.
 */
function _displayProjectsKanban(chitsToDisplay) {
  const chitList = document.getElementById("chit-list");
  chitList.innerHTML = "";
  const _viSettings = (window._cwocSettings || {}).visual_indicators || {};

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

    // Project-level drag for reorder
    projectBox.addEventListener("dragstart", e => {
      // Only start project reorder drag from the header grip area
      if (!e.target.closest('.kanban-project-header')) return;
      e.dataTransfer.setData("application/x-project-reorder", project.id);
      e.dataTransfer.effectAllowed = "move";
      projectBox.style.opacity = "0.4";
    });
    projectBox.addEventListener("dragend", () => {
      projectBox.style.opacity = "";
      wrapper.querySelectorAll('.kanban-project-box').forEach(b => {
        b.style.borderTop = '';
        b.style.borderBottom = '';
      });
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

        // Note preview (rendered markdown, same as Tasks view)
        if (child.note && child.note.trim()) {
          const notePreview = document.createElement("div");
          notePreview.style.cssText = "font-size:0.9em;opacity:0.75;overflow:hidden;max-height:4.5em;line-height:1.4em;margin-top:2px;";
          if (typeof marked !== 'undefined') {
            notePreview.innerHTML = resolveChitLinks(marked.parse(child.note.slice(0, 500)), chits);
          } else {
            notePreview.textContent = child.note.slice(0, 300) + (child.note.length > 300 ? '…' : '');
          }
          card.appendChild(notePreview);
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
              li.style.opacity = "0.4";
            });
            li.addEventListener("dragend", () => { li.style.opacity = gc.status === "Complete" ? "0.5" : "1"; });

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
          card.style.opacity = "0.4";
        });
        card.addEventListener("dragend", () => { card.style.opacity = ""; });

        card.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${child.id}`;
        });

        col.appendChild(card);
      });

      // Drop zone for cards
      col.addEventListener("dragover", e => {
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

            fetchChits();
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

            fetchChits();
          } catch (err) { console.error("Kanban grandchild drop error:", err); }
        }
      });

      columnsRow.appendChild(col);
    });

    projectBox.appendChild(columnsRow);
    wrapper.appendChild(projectBox);
  });

  // ── Project-level drag-to-reorder ──────────────────────────────────────
  wrapper.addEventListener("dragover", e => {
    // Only handle project reorder drags
    if (!e.dataTransfer.types.includes("application/x-project-reorder")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const box = e.target.closest('.kanban-project-box');
    wrapper.querySelectorAll('.kanban-project-box').forEach(b => {
      b.style.borderTop = '';
      b.style.borderBottom = '';
    });
    if (box) {
      const rect = box.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        box.style.borderTop = '3px solid #8b5a2b';
      } else {
        box.style.borderBottom = '3px solid #8b5a2b';
      }
    }
  });

  wrapper.addEventListener("drop", e => {
    const draggedId = e.dataTransfer.getData("application/x-project-reorder");
    if (!draggedId) return;
    e.preventDefault();
    wrapper.querySelectorAll('.kanban-project-box').forEach(b => {
      b.style.borderTop = '';
      b.style.borderBottom = '';
    });
    const targetBox = e.target.closest('.kanban-project-box');
    if (!targetBox || targetBox.dataset.chitId === draggedId) return;

    const boxes = Array.from(wrapper.querySelectorAll('.kanban-project-box[data-chit-id]'));
    const ids = boxes.map(b => b.dataset.chitId);
    const fromIdx = ids.indexOf(draggedId);
    let toIdx = ids.indexOf(targetBox.dataset.chitId);
    if (fromIdx < 0 || toIdx < 0) return;

    const rect = targetBox.getBoundingClientRect();
    if (e.clientY > rect.top + rect.height / 2) toIdx++;
    ids.splice(fromIdx, 1);
    if (fromIdx < toIdx) toIdx--;
    ids.splice(toIdx, 0, draggedId);

    saveManualOrder('Projects', ids);
    currentSortField = 'manual';
    const sel = document.getElementById('sort-select');
    if (sel) sel.value = 'manual';
    _updateSortUI();
    displayChits();
  });

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
  enableDragToReorder(view, 'Alarms', () => displayChits());
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

    // Cards for this type
    const items = _independentAlerts.filter(a => a._type === typeInfo.key);
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sa-empty";
      empty.textContent = `No independent ${typeInfo.label.toLowerCase()} yet.`;
      col.appendChild(empty);
    } else {
      items.forEach(alert => {
        const data = alert.data || alert;
        col.appendChild(_buildIndependentCard(alert.id, typeInfo.key, data));
      });
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
      // Enable drag-to-reorder on indicator charts
      _enableIndicatorsDragReorder(container);
      // Restore saved chart order
      _restoreIndicatorsOrder(container);
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


