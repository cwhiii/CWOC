// ── Settings: Custom Filters & Sorting ────────────────────────────────────────
// Per-view custom filter/sort defaults. Each view can have saved filter state
// that auto-applies when the user switches to that view on the dashboard.
//
// Data structure (stored as JSON in settings.custom_view_filters):
// {
//   "Calendar": { statuses: [], tags: [], priorities: [], people: [], text: "",
//                 display: { pinned: true, archived: false, ... }, sort: { field: "", dir: "asc" }, project: "" },
//   "Tasks": { ... },
//   ...
// }

/** View definitions in display order (Omni first, then tab order) */
var _customFilterViews = [
  { key: 'Omni', iconType: 'img', src: '/static/cwod_logo.png', label: 'Omni' },
  { key: 'Calendar', iconType: 'img', src: '/static/calendar.png', label: 'Calendar' },
  { key: 'Checklists', iconType: 'img', src: '/static/checklists.png', label: 'Checklists' },
  { key: 'Tasks', iconType: 'img', src: '/static/tasks.png', label: 'Tasks' },
  { key: 'Projects', iconType: 'img', src: '/static/projects.png', label: 'Projects' },
  { key: 'Notes', iconType: 'img', src: '/static/notes.png', label: 'Notes' },
  { key: 'Email', iconType: 'fa', cls: 'fas fa-envelope', label: 'Email' },
  { key: 'Indicators', iconType: 'img', src: '/static/Indicators.png', label: 'Indicators' },
  { key: 'Alarms', iconType: 'img', src: '/static/alerts.png', label: 'Alarms' }
];

/** In-memory state of custom view filters (loaded from settings) */
var _customViewFilters = {};

/** System defaults for the display toggles */
var _systemDisplayDefaults = {
  pinned: true,
  archived: false,
  snoozed: false,
  unmarked: true,
  pastDue: true,
  complete: true,
  declined: true,
  habits: true,
  emailReceived: false,
  emailSent: false,
  sharedWithMe: false,
  sharedByMe: false
};

/**
 * Render the custom filter buttons list in the settings page.
 * Called from loadSettings().
 */
function _renderCustomFilterButtons() {
  var container = document.getElementById('custom-filters-buttons');
  if (!container) return;
  container.innerHTML = '';

  _customFilterViews.forEach(function(view) {
    var hasCustom = _customViewFilters[view.key] && Object.keys(_customViewFilters[view.key]).length > 0;
    var row = document.createElement('div');
    row.className = 'custom-filter-row';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-button custom-filter-btn' + (hasCustom ? ' custom-filter-active' : '');

    // Build icon element based on type
    var iconHtml = '';
    if (view.iconType === 'img') {
      iconHtml = '<img src="' + view.src + '" alt="' + view.label + '" class="custom-filter-icon-img" />';
    } else if (view.iconType === 'fa') {
      iconHtml = '<i class="' + view.cls + ' custom-filter-icon-fa"></i>';
    }
    btn.innerHTML = iconHtml + ' ' + view.label;
    btn.onclick = function() { _openCustomFilterModal(view.key); };

    var status = document.createElement('span');
    status.className = 'custom-filter-status';
    status.id = 'custom-filter-status-' + view.key;
    if (hasCustom) {
      status.innerHTML = '<i class="fas fa-check-circle" style="color:#4a7c3f;"></i> Custom';
    } else {
      status.innerHTML = '<i class="fas fa-minus-circle" style="color:#999;"></i> Default';
    }

    row.appendChild(btn);
    row.appendChild(status);
    container.appendChild(row);
  });
}

/**
 * Load custom view filters from settings object.
 * For Omni, reads from omni_locked_filters for backward compatibility.
 */
function _loadCustomViewFilters(settings) {
  _customViewFilters = {};
  if (settings.custom_view_filters) {
    try {
      var parsed = typeof settings.custom_view_filters === 'string'
        ? JSON.parse(settings.custom_view_filters)
        : settings.custom_view_filters;
      if (parsed && typeof parsed === 'object') {
        _customViewFilters = parsed;
      }
    } catch (e) {
      console.error('[CustomFilters] Failed to parse custom_view_filters:', e);
    }
  }
  // Merge Omni locked filters into the unified structure (backward compat)
  if (settings.omni_locked_filters && !_customViewFilters['Omni']) {
    try {
      var omniFilters = typeof settings.omni_locked_filters === 'string'
        ? JSON.parse(settings.omni_locked_filters)
        : settings.omni_locked_filters;
      if (omniFilters && typeof omniFilters === 'object' && Object.keys(omniFilters).length > 0) {
        // Convert omni_locked_filters format to custom_view_filters format
        _customViewFilters['Omni'] = {
          statuses: omniFilters.statuses || [],
          priorities: omniFilters.priorities || [],
          tags: omniFilters.tags || [],
          people: omniFilters.people || [],
          text: omniFilters.text || '',
          display: _systemDisplayDefaults,
          sort: { field: '', dir: 'asc' }
        };
      }
    } catch (e) { /* ignore */ }
  }
  _renderCustomFilterButtons();
}

/**
 * Gather custom view filters for saving.
 * Returns the JSON string or null if empty.
 */
function _gatherCustomViewFilters() {
  if (!_customViewFilters || Object.keys(_customViewFilters).length === 0) return '';
  return JSON.stringify(_customViewFilters);
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */

var _cfModalOverlay = null;
var _cfModalViewKey = null;

/**
 * Open the custom filter modal for a specific view.
 * Renders the sidebar filter UI inside a floating modal.
 */
function _openCustomFilterModal(viewKey) {
  _cfModalViewKey = viewKey;

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'custom-filter-modal-overlay';
  overlay.className = 'cwoc-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeCustomFilterModal(); };

  // Create modal
  var modal = document.createElement('div');
  modal.className = 'cwoc-modal custom-filter-modal';

  // Header
  var header = document.createElement('div');
  header.className = 'cwoc-modal-header';
  var viewDef = _customFilterViews.find(function(v) { return v.key === viewKey; });
  var headerIconHtml = '';
  if (viewDef) {
    if (viewDef.iconType === 'img') {
      headerIconHtml = '<img src="' + viewDef.src + '" alt="' + viewDef.label + '" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;" />';
    } else if (viewDef.iconType === 'fa') {
      headerIconHtml = '<i class="' + viewDef.cls + '" style="margin-right:6px;"></i>';
    }
  }
  header.innerHTML = '<h3>' + headerIconHtml + viewKey + ' — Custom Filters & Sort</h3>';

  // Body — contains the filter UI
  var body = document.createElement('div');
  body.className = 'cwoc-modal-body custom-filter-modal-body';
  body.id = 'cf-modal-body';

  // Build the filter UI (same structure as sidebar)
  body.innerHTML = _buildCustomFilterHTML(viewKey);

  // Footer with buttons
  var footer = document.createElement('div');
  footer.className = 'cwoc-modal-footer';
  footer.innerHTML = '<button type="button" class="action-button" id="cf-reset-btn">Reset to Defaults</button>'
    + '<div style="flex:1;"></div>'
    + '<button type="button" class="action-button" id="cf-cancel-btn">Cancel</button>'
    + '<button type="button" class="action-button cf-done-btn" id="cf-done-btn">Done</button>';

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _cfModalOverlay = overlay;

  // Wire up buttons
  document.getElementById('cf-cancel-btn').onclick = _closeCustomFilterModal;
  document.getElementById('cf-done-btn').onclick = _saveCustomFilterModal;
  document.getElementById('cf-reset-btn').onclick = _resetCustomFilterModal;

  // Populate with existing saved state (or system defaults)
  _populateCustomFilterModal(viewKey);

  // Wire up filter group toggles
  body.querySelectorAll('.cf-filter-label[data-group]').forEach(function(label) {
    label.onclick = function() {
      var groupId = label.dataset.group;
      var groupBody = document.getElementById(groupId);
      if (groupBody) {
        var isHidden = groupBody.style.display === 'none';
        groupBody.style.display = isHidden ? '' : 'none';
        var arrow = label.querySelector('.section-toggle');
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
    };
  });

  // ESC to close
  document.addEventListener('keydown', _cfModalEscHandler, true);
}

function _cfModalEscHandler(e) {
  if (e.key === 'Escape') {
    e.stopImmediatePropagation();
    e.preventDefault();
    _closeCustomFilterModal();
  }
}

function _closeCustomFilterModal() {
  document.removeEventListener('keydown', _cfModalEscHandler, true);
  if (_cfModalOverlay) {
    _cfModalOverlay.remove();
    _cfModalOverlay = null;
  }
  _cfModalViewKey = null;
}

/**
 * Build the filter HTML for the modal — mirrors the sidebar filter section.
 */
function _buildCustomFilterHTML(viewKey) {
  var html = '';

  /* Filter Text */
  html += '<div class="filter-group">';
  html += '  <label class="filter-label">Filter Text</label>';
  html += '  <input type="text" id="cf-search" placeholder="Filter Chits..." style="width:100%;padding:6px 8px;font-family:inherit;font-size:0.9em;border:1px solid #6b4e31;border-radius:3px;box-sizing:border-box;" />';
  html += '</div>';

  /* Sort */
  html += '<div class="filter-group">';
  html += '  <label class="filter-label">Sort</label>';
  html += '  <div style="display:flex;gap:8px;align-items:center;">';
  html += '    <select id="cf-sort-field" style="flex:1;padding:4px 6px;font-family:inherit;font-size:0.85em;border:1px solid #6b4e31;border-radius:3px;">';
  html += '      <option value="">— None —</option>';
  html += '      <option value="title">Title</option>';
  html += '      <option value="due">Due Date</option>';
  html += '      <option value="start">Start Date</option>';
  html += '      <option value="created">Created</option>';
  html += '      <option value="modified">Modified</option>';
  html += '      <option value="priority">Priority</option>';
  html += '      <option value="status">Status</option>';
  html += '      <option value="manual">Manual</option>';
  html += '      <option value="random">Random</option>';
  html += '      <option value="upcoming">Upcoming</option>';
  html += '    </select>';
  html += '    <select id="cf-sort-dir" style="padding:4px 6px;font-family:inherit;font-size:0.85em;border:1px solid #6b4e31;border-radius:3px;">';
  html += '      <option value="asc">▲ Asc</option>';
  html += '      <option value="desc">▼ Desc</option>';
  html += '    </select>';
  html += '  </div>';
  html += '</div>';

  /* Status */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-status-body">';
  html += '    <span class="section-toggle">▶</span> Status';
  html += '  </label>';
  html += '  <div id="cf-status-body" class="filter-group-body" style="display:none;">';
  html += '    <div class="multi-select" id="cf-status-multi">';
  html += '      <label><input type="checkbox" value="" data-filter="status" data-any="true" checked /> — Any</label>';
  html += '      <label><input type="checkbox" value="ToDo" data-filter="status" /> ToDo</label>';
  html += '      <label><input type="checkbox" value="In Progress" data-filter="status" /> In Progress</label>';
  html += '      <label><input type="checkbox" value="Blocked" data-filter="status" /> Blocked</label>';
  html += '      <label><input type="checkbox" value="Complete" data-filter="status" /> Complete</label>';
  html += '      <label><input type="checkbox" value="Rejected" data-filter="status" /> Rejected</label>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  /* Priority */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-priority-body">';
  html += '    <span class="section-toggle">▶</span> Priority';
  html += '  </label>';
  html += '  <div id="cf-priority-body" class="filter-group-body" style="display:none;">';
  html += '    <div class="multi-select" id="cf-priority-multi">';
  html += '      <label><input type="checkbox" value="" data-filter="priority" data-any="true" checked /> — Any</label>';
  html += '      <label><input type="checkbox" value="Low" data-filter="priority" /> Low</label>';
  html += '      <label><input type="checkbox" value="Medium" data-filter="priority" /> Medium</label>';
  html += '      <label><input type="checkbox" value="High" data-filter="priority" /> High</label>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  /* Tags */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-tags-body">';
  html += '    <span class="section-toggle">▶</span> Tags';
  html += '  </label>';
  html += '  <div id="cf-tags-body" class="filter-group-body" style="display:none;">';
  html += '    <div class="multi-select" id="cf-tags-multi" style="max-height:200px;overflow-y:auto;"></div>';
  html += '    <p style="font-size:0.75em;color:#8b6b4a;margin:4px 0 0 0;">Check tags to filter by. Only chits with at least one selected tag will show.</p>';
  html += '  </div>';
  html += '</div>';

  /* People */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-people-body">';
  html += '    <span class="section-toggle">▶</span> People';
  html += '  </label>';
  html += '  <div id="cf-people-body" class="filter-group-body" style="display:none;">';
  html += '    <div class="multi-select" id="cf-people-multi" style="max-height:200px;overflow-y:auto;"></div>';
  html += '    <p style="font-size:0.75em;color:#8b6b4a;margin:4px 0 0 0;">Check people to filter by. Only chits assigned to at least one selected person will show.</p>';
  html += '  </div>';
  html += '</div>';

  /* Project */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-project-body">';
  html += '    <span class="section-toggle">▶</span> Project';
  html += '  </label>';
  html += '  <div id="cf-project-body" class="filter-group-body" style="display:none;">';
  html += '    <select id="cf-project-select" style="width:100%;padding:4px 6px;font-family:inherit;font-size:0.85em;border:1px solid #6b4e31;border-radius:3px;">';
  html += '      <option value="">— None —</option>';
  html += '      <option value="__any__">Any (has a project)</option>';
  html += '      <option value="__none__">None (no project)</option>';
  html += '    </select>';
  html += '    <p style="font-size:0.75em;color:#8b6b4a;margin:4px 0 0 0;">Filter to chits within a specific project.</p>';
  html += '  </div>';
  html += '</div>';

  /* Display */
  html += '<div class="filter-group">';
  html += '  <label class="cf-filter-label" data-group="cf-display-body">';
  html += '    <span class="section-toggle">▶</span> Display';
  html += '  </label>';
  html += '  <div id="cf-display-body" class="filter-group-body" style="display:none;">';
  html += '    <div class="multi-select">';
  html += '      <label><input type="checkbox" id="cf-show-pinned" checked /> 📌 Pinned</label>';
  html += '      <label><input type="checkbox" id="cf-show-archived" /> 📦 Archived</label>';
  html += '      <label><input type="checkbox" id="cf-show-snoozed" /> 😴 Snoozed</label>';
  html += '      <label><input type="checkbox" id="cf-show-unmarked" checked /> 📄 Unmarked</label>';
  html += '      <hr style="border:0;border-top:1px dashed #c4a882;margin:4px 0;" />';
  html += '      <label><input type="checkbox" id="cf-show-past-due" checked /> ⏰ Past-Due</label>';
  html += '      <label><input type="checkbox" id="cf-show-complete" checked /> ✅ Complete</label>';
  html += '      <label><input type="checkbox" id="cf-show-declined" checked /> ✗ Declined</label>';
  html += '      <label><input type="checkbox" id="cf-show-habits" checked /> 🎯 Habits</label>';
  html += '      <label><input type="checkbox" id="cf-show-email-received" /> 📨 Email (Received)</label>';
  html += '      <label><input type="checkbox" id="cf-show-email-sent" /> 📤 Email (Sent)</label>';
  html += '      <hr style="border:0;border-top:1px dashed #c4a882;margin:4px 0;" />';
  html += '      <label><input type="checkbox" id="cf-filter-shared-with-me" /> 🔗 Shared with me</label>';
  html += '      <label><input type="checkbox" id="cf-filter-shared-by-me" /> 📤 Shared by me</label>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  return html;
}

/**
 * Populate the modal with existing saved filter state for the view,
 * or system defaults if none saved.
 */
function _populateCustomFilterModal(viewKey) {
  var saved = _customViewFilters[viewKey];
  if (!saved) saved = {};

  // Text
  var searchEl = document.getElementById('cf-search');
  if (searchEl) searchEl.value = saved.text || '';

  // Sort
  var sortField = document.getElementById('cf-sort-field');
  var sortDir = document.getElementById('cf-sort-dir');
  if (sortField) sortField.value = (saved.sort && saved.sort.field) ? saved.sort.field : '';
  if (sortDir) sortDir.value = (saved.sort && saved.sort.dir) ? saved.sort.dir : 'asc';

  // Statuses
  var statusContainer = document.getElementById('cf-status-multi');
  if (statusContainer) {
    statusContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    if (saved.statuses && saved.statuses.length > 0) {
      saved.statuses.forEach(function(val) {
        var cb = statusContainer.querySelector('input[data-filter="status"][value="' + val + '"]');
        if (cb) cb.checked = true;
      });
    } else {
      var anyCb = statusContainer.querySelector('input[data-any="true"]');
      if (anyCb) anyCb.checked = true;
    }
  }

  // Priorities
  var priorityContainer = document.getElementById('cf-priority-multi');
  if (priorityContainer) {
    priorityContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    if (saved.priorities && saved.priorities.length > 0) {
      saved.priorities.forEach(function(val) {
        var cb = priorityContainer.querySelector('input[data-filter="priority"][value="' + val + '"]');
        if (cb) cb.checked = true;
      });
    } else {
      var anyCb = priorityContainer.querySelector('input[data-any="true"]');
      if (anyCb) anyCb.checked = true;
    }
  }

  // Tags — render checkboxes from settings tags list
  _populateCfTags(saved.tags || []);

  // People — render checkboxes from contacts API
  _populateCfPeople(saved.people || []);

  // Project
  var projSel = document.getElementById('cf-project-select');
  if (projSel) projSel.value = saved.project || '';
  _populateCfProjects(saved.project || '');

  // Display toggles
  var display = saved.display || _systemDisplayDefaults;
  var setCheck = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  setCheck('cf-show-pinned', display.pinned !== undefined ? display.pinned : _systemDisplayDefaults.pinned);
  setCheck('cf-show-archived', display.archived !== undefined ? display.archived : _systemDisplayDefaults.archived);
  setCheck('cf-show-snoozed', display.snoozed !== undefined ? display.snoozed : _systemDisplayDefaults.snoozed);
  setCheck('cf-show-unmarked', display.unmarked !== undefined ? display.unmarked : _systemDisplayDefaults.unmarked);
  setCheck('cf-show-past-due', display.pastDue !== undefined ? display.pastDue : _systemDisplayDefaults.pastDue);
  setCheck('cf-show-complete', display.complete !== undefined ? display.complete : _systemDisplayDefaults.complete);
  setCheck('cf-show-declined', display.declined !== undefined ? display.declined : _systemDisplayDefaults.declined);
  setCheck('cf-show-habits', display.habits !== undefined ? display.habits : _systemDisplayDefaults.habits);
  setCheck('cf-show-email-received', display.emailReceived !== undefined ? display.emailReceived : _systemDisplayDefaults.emailReceived);
  setCheck('cf-show-email-sent', display.emailSent !== undefined ? display.emailSent : _systemDisplayDefaults.emailSent);
  setCheck('cf-filter-shared-with-me', display.sharedWithMe !== undefined ? display.sharedWithMe : _systemDisplayDefaults.sharedWithMe);
  setCheck('cf-filter-shared-by-me', display.sharedByMe !== undefined ? display.sharedByMe : _systemDisplayDefaults.sharedByMe);
}

/**
 * Populate the Tags section with checkboxes from the settings tag list.
 * @param {string[]} selectedTags - Currently selected tag names
 */
function _populateCfTags(selectedTags) {
  var container = document.getElementById('cf-tags-multi');
  if (!container) return;
  container.innerHTML = '';

  // Get tags from the settings manager
  var tags = [];
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.tags) {
    tags = window.settingsManager.settings.tags;
  }

  if (tags.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">No tags defined.</div>';
    return;
  }

  tags.forEach(function(tag) {
    var label = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = tag.name;
    cb.dataset.filter = 'tag';
    cb.checked = selectedTags.indexOf(tag.name) !== -1;
    label.appendChild(cb);
    var span = document.createElement('span');
    span.textContent = ' ' + tag.name;
    if (tag.color) {
      span.style.backgroundColor = tag.color;
      span.style.color = tag.fontColor || '#2b1e0f';
      span.style.padding = '1px 6px';
      span.style.borderRadius = '3px';
      span.style.fontSize = '0.85em';
    }
    label.appendChild(span);
    container.appendChild(label);
  });
}

/**
 * Populate the People section with checkboxes from the contacts API.
 * @param {string[]} selectedPeople - Currently selected people names
 */
function _populateCfPeople(selectedPeople) {
  var container = document.getElementById('cf-people-multi');
  if (!container) return;
  container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">Loading…</div>';

  fetch('/api/contacts', { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(contacts) {
      container.innerHTML = '';
      if (!contacts || contacts.length === 0) {
        container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">No contacts found.</div>';
        return;
      }
      // Sort by display name
      contacts.sort(function(a, b) {
        var nameA = (a.given_name || '') + ' ' + (a.surname || '');
        var nameB = (b.given_name || '') + ' ' + (b.surname || '');
        return nameA.localeCompare(nameB);
      });
      contacts.forEach(function(contact) {
        var displayName = ((contact.given_name || '') + ' ' + (contact.surname || '')).trim();
        if (!displayName) displayName = contact.email || contact.id;
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = displayName;
        cb.dataset.filter = 'people';
        cb.checked = selectedPeople.indexOf(displayName) !== -1;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + displayName));
        container.appendChild(label);
      });
    })
    .catch(function() {
      container.innerHTML = '<div style="opacity:0.5;font-size:0.8em;padding:4px;">Failed to load contacts.</div>';
    });
}

/**
 * Populate the Project dropdown with project masters from the API.
 * @param {string} selectedProject - Currently selected project ID
 */
function _populateCfProjects(selectedProject) {
  var sel = document.getElementById('cf-project-select');
  if (!sel) return;

  fetch('/api/chits', { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(allChits) {
      // Keep the first 3 meta options, remove any extras
      while (sel.options.length > 3) sel.remove(3);
      var projects = (allChits || []).filter(function(c) {
        return c.is_project_master && !c.deleted;
      });
      projects.sort(function(a, b) {
        return (a.title || '').localeCompare(b.title || '');
      });
      projects.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.title || '(Untitled Project)';
        sel.appendChild(opt);
      });
      if (selectedProject) sel.value = selectedProject;
    })
    .catch(function() { /* ignore — just leave the 3 meta options */ });
}

/**
 * Gather the current modal state into a filter object.
 */
function _gatherCustomFilterModalState() {
  var state = {};

  // Text
  var searchEl = document.getElementById('cf-search');
  state.text = searchEl ? searchEl.value.trim() : '';

  // Sort
  var sortField = document.getElementById('cf-sort-field');
  var sortDir = document.getElementById('cf-sort-dir');
  state.sort = {
    field: sortField ? sortField.value : '',
    dir: sortDir ? sortDir.value : 'asc'
  };

  // Statuses
  state.statuses = [];
  var statusContainer = document.getElementById('cf-status-multi');
  if (statusContainer) {
    statusContainer.querySelectorAll('input[data-filter="status"]:checked').forEach(function(cb) {
      if (cb.value) state.statuses.push(cb.value);
    });
  }

  // Priorities
  state.priorities = [];
  var priorityContainer = document.getElementById('cf-priority-multi');
  if (priorityContainer) {
    priorityContainer.querySelectorAll('input[data-filter="priority"]:checked').forEach(function(cb) {
      if (cb.value) state.priorities.push(cb.value);
    });
  }

  // Tags
  state.tags = [];
  var tagsContainer = document.getElementById('cf-tags-multi');
  if (tagsContainer) {
    tagsContainer.querySelectorAll('input[data-filter="tag"]:checked').forEach(function(cb) {
      if (cb.value) state.tags.push(cb.value);
    });
  }

  // People
  state.people = [];
  var peopleContainer = document.getElementById('cf-people-multi');
  if (peopleContainer) {
    peopleContainer.querySelectorAll('input[data-filter="people"]:checked').forEach(function(cb) {
      if (cb.value) state.people.push(cb.value);
    });
  }

  // Project
  var projSel = document.getElementById('cf-project-select');
  state.project = projSel ? projSel.value : '';

  // Display
  state.display = {
    pinned: !!document.getElementById('cf-show-pinned')?.checked,
    archived: !!document.getElementById('cf-show-archived')?.checked,
    snoozed: !!document.getElementById('cf-show-snoozed')?.checked,
    unmarked: !!document.getElementById('cf-show-unmarked')?.checked,
    pastDue: !!document.getElementById('cf-show-past-due')?.checked,
    complete: !!document.getElementById('cf-show-complete')?.checked,
    declined: !!document.getElementById('cf-show-declined')?.checked,
    habits: !!document.getElementById('cf-show-habits')?.checked,
    emailReceived: !!document.getElementById('cf-show-email-received')?.checked,
    emailSent: !!document.getElementById('cf-show-email-sent')?.checked,
    sharedWithMe: !!document.getElementById('cf-filter-shared-with-me')?.checked,
    sharedByMe: !!document.getElementById('cf-filter-shared-by-me')?.checked
  };

  return state;
}

/**
 * Check if a filter state is equivalent to system defaults (i.e., "no custom filter").
 */
function _isSystemDefault(state) {
  if (!state) return true;
  // Check text
  if (state.text) return false;
  // Check sort
  if (state.sort && state.sort.field) return false;
  // Check statuses
  if (state.statuses && state.statuses.length > 0) return false;
  // Check priorities
  if (state.priorities && state.priorities.length > 0) return false;
  // Check tags
  if (state.tags && state.tags.length > 0) return false;
  // Check people
  if (state.people && state.people.length > 0) return false;
  // Check project
  if (state.project) return false;
  // Check display toggles against system defaults
  if (state.display) {
    var d = state.display;
    var sd = _systemDisplayDefaults;
    if (d.pinned !== sd.pinned) return false;
    if (d.archived !== sd.archived) return false;
    if (d.snoozed !== sd.snoozed) return false;
    if (d.unmarked !== sd.unmarked) return false;
    if (d.pastDue !== sd.pastDue) return false;
    if (d.complete !== sd.complete) return false;
    if (d.declined !== sd.declined) return false;
    if (d.habits !== sd.habits) return false;
    if (d.emailReceived !== sd.emailReceived) return false;
    if (d.emailSent !== sd.emailSent) return false;
    if (d.sharedWithMe !== sd.sharedWithMe) return false;
    if (d.sharedByMe !== sd.sharedByMe) return false;
  }
  return true;
}

/**
 * Save the modal state and close.
 */
function _saveCustomFilterModal() {
  var state = _gatherCustomFilterModalState();
  var viewKey = _cfModalViewKey;

  if (_isSystemDefault(state)) {
    // Remove custom filter for this view (it's just system defaults)
    delete _customViewFilters[viewKey];
  } else {
    _customViewFilters[viewKey] = state;
  }

  _renderCustomFilterButtons();
  _closeCustomFilterModal();
  setSaveButtonUnsaved();
}

/**
 * Reset the modal to system defaults (clears the custom filter for this view).
 */
function _resetCustomFilterModal() {
  var viewKey = _cfModalViewKey;
  delete _customViewFilters[viewKey];
  // Re-populate modal with system defaults
  _populateCustomFilterModal(viewKey);
  if (typeof cwocToast === 'function') cwocToast(viewKey + ' reset to system defaults', 'info');
}
