/**
 * main-views.js — Shared helpers and utilities for dashboard views.
 *
 * Contains:
 *   - Shared chit helpers (_isViewerRole, _buildNotePreview, _isSharedChit, etc.)
 *   - Chit header builder (_buildChitHeader, _renderChitMeta)
 *   - Tag color helpers (_getTagColor, _getTagFontColor)
 *   - Empty state builder (_emptyState)
 *   - Checklists view (displayChecklistView)
 *   - Tab filtering (filterChits, searchChits, highlightMatch)
 *   - View mode button restore (_restoreViewModeButtons)
 *
 * Split files (loaded before this coordinator):
 *   - main-views-tasks.js (Tasks + Assigned-to-Me views)
 *   - main-views-habits.js (Habits view)
 *   - main-views-notes.js (Notes masonry view)
 *   - main-views-projects.js (Projects list + Kanban)
 *   - main-views-alarms.js (Alarms + Independent Alerts)
 *   - main-views-indicators.js (Health Indicators charts)
 *
 * Depends on globals from main.js: currentTab, chits, currentSortField, currentSortDir,
 *   _cachedTagObjects, _chitOptions, _defaultFilters, _snoozeRegistry
 * Depends on shared.js: applyChitColors, contrastColorForBg, isSystemTag, getPastelColor,
 *   formatDate, formatTime, renderInlineChecklist, enableDragToReorder, getManualOrder,
 *   applyManualOrder, resolveChitLinks, enableLongPress, showQuickEditModal,
 *   _getAllIndicators, _shouldShow, _STATUS_ICONS, enableNotesDragReorder, applyNotesLayout
 */

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

  // Attachment indicator — now handled by _getAllIndicators in shared-indicators.js

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
    var _clItems = chit.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
    var _clChecked = _clItems.filter(function(i) { return i.checked || i.done; }).length;
    var _clSuffix = (_clItems.length > 0 && _clChecked === _clItems.length) ? ' ✓' : '';
    var countSpan = document.createElement('span');
    countSpan.className = 'checklist-progress-count';
    countSpan.dataset.chitId = chit.id;
    countSpan.style.cssText = 'font-size:0.8em;opacity:0.7;margin-left:0.5em;font-weight:normal;white-space:nowrap;';
    countSpan.textContent = '(' + _clChecked + '/' + _clItems.length + _clSuffix + ')';
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

  if (chit.start_datetime && !chit.email_message_id && !chit.email_status) addMeta(`Start: ${formatDate(new Date(chit.start_datetime))}`, 'start');
  if (chit.modified_datetime && !chit.email_message_id && !chit.email_status) addMeta(`Updated: ${formatDate(new Date(chit.modified_datetime))}`, 'updated');
  if (chit.created_datetime && !chit.email_message_id && !chit.email_status) addMeta(`Created: ${formatDate(new Date(chit.created_datetime))}`, 'created');
  var _rawTags = chit.tags || [];
  if (typeof _rawTags === 'string') { try { _rawTags = JSON.parse(_rawTags); } catch(e) { _rawTags = []; } }
  if (!Array.isArray(_rawTags)) _rawTags = [];
  const tags = _rawTags.filter(t => !isSystemTag(t));
  if (tags.length > 0) {
    tags.forEach(tagName => {
      const tagColor = _getTagColor(tagName);
      const tagFontColor = _getTagFontColor(tagName);
      const chip = document.createElement('span');
      chip.style.cssText = `display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.75em;margin-left:4px;background:${tagColor};color:${tagFontColor};`;
      chip.textContent = tagName;
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

  // Only show chits that have checklist items (exclude empty items)
  const checklistChits = chitsToDisplay.filter(c =>
    Array.isArray(c.checklist) && c.checklist.some(i => i && i.text && i.text.trim())
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

      // Strike out the title when every non-empty checklist item is checked
      const _clNonEmpty = (chit.checklist || []).filter(i => i && i.text && i.text.trim());
      const _clAllChecked = _clNonEmpty.length > 0 && _clNonEmpty.every(i => i.checked || i.done);
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


function _restoreViewModeButtons() {
  // Projects
  const pListBtn = document.getElementById('projects-mode-list');
  const pKanbanBtn = document.getElementById('projects-mode-kanban');
  if (pListBtn) { pListBtn.style.background = _projectsViewMode === 'list' ? 'ivory' : ''; pListBtn.style.color = _projectsViewMode === 'list' ? '#3b1f0a' : ''; }
  if (pKanbanBtn) { pKanbanBtn.style.background = _projectsViewMode === 'kanban' ? 'ivory' : ''; pKanbanBtn.style.color = _projectsViewMode === 'kanban' ? '#3b1f0a' : ''; }
  // Alarms
  const aListBtn = document.getElementById('alarms-mode-list');
  const aIndBtn = document.getElementById('alarms-mode-independent');
  if (aListBtn) { aListBtn.style.background = _alarmsViewMode === 'list' ? 'ivory' : ''; aListBtn.style.color = _alarmsViewMode === 'list' ? '#3b1f0a' : ''; }
  if (aIndBtn) { aIndBtn.style.background = _alarmsViewMode === 'independent' ? 'ivory' : ''; aIndBtn.style.color = _alarmsViewMode === 'independent' ? '#3b1f0a' : ''; }
  // Tasks
  const tTasksBtn = document.getElementById('tasks-mode-tasks');
  const tHabitsBtn = document.getElementById('tasks-mode-habits');
  const tAssignedBtn = document.getElementById('tasks-mode-assigned');
  if (tTasksBtn) { tTasksBtn.style.background = _tasksViewMode === 'tasks' ? 'ivory' : ''; tTasksBtn.style.color = _tasksViewMode === 'tasks' ? '#3b1f0a' : ''; }
  if (tHabitsBtn) { tHabitsBtn.style.background = _tasksViewMode === 'habits' ? 'ivory' : ''; tHabitsBtn.style.color = _tasksViewMode === 'habits' ? '#3b1f0a' : ''; }
  if (tAssignedBtn) { tAssignedBtn.style.background = _tasksViewMode === 'assigned' ? 'ivory' : ''; tAssignedBtn.style.color = _tasksViewMode === 'assigned' ? '#3b1f0a' : ''; }
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
    orderSection.style.display = (tab === 'Calendar' || tab === 'Indicators' || tab === 'Email') ? 'none' : '';
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

  // Show/hide Indicators time range controls in sidebar
  const indControls = document.getElementById('section-indicators');
  if (indControls) {
    indControls.style.display = (tab === 'Indicators') ? '' : 'none';
  }

  // Show/hide Email controls in sidebar
  if (typeof _updateEmailSidebarVisibility === 'function') {
    _updateEmailSidebarVisibility(tab);
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
