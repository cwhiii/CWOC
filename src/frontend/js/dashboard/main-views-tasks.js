/**
 * main-views-tasks.js — Tasks view and Assigned-to-Me view.
 *
 * Contains:
 *   - displayTasksView (task list with status dropdowns)
 *   - displayAssignedToMeView (chits assigned to current user)
 *   - _setTasksMode (tasks/habits/assigned toggle)
 *
 * Depends on: main-views.js (shared helpers), shared.js, main.js globals
 */

// ── Tasks View Mode (Tasks list vs Habits view) ─────────────────────────────
let _tasksViewMode = localStorage.getItem('cwoc_tasksViewMode') || 'tasks'; // 'tasks' | 'habits'


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


function _setTasksMode(mode) {
  _tasksViewMode = mode;
  localStorage.setItem('cwoc_tasksViewMode', mode);
  var tasksBtn = document.getElementById('tasks-mode-tasks');
  var habitsBtn = document.getElementById('tasks-mode-habits');
  var assignedBtn = document.getElementById('tasks-mode-assigned');
  var habitsWindowWrap = document.getElementById('habits-window-wrap');
  if (tasksBtn) { tasksBtn.style.background = mode === 'tasks' ? 'ivory' : ''; tasksBtn.style.color = mode === 'tasks' ? '#3b1f0a' : ''; }
  if (habitsBtn) { habitsBtn.style.background = mode === 'habits' ? 'ivory' : ''; habitsBtn.style.color = mode === 'habits' ? '#3b1f0a' : ''; }
  if (assignedBtn) { assignedBtn.style.background = mode === 'assigned' ? 'ivory' : ''; assignedBtn.style.color = mode === 'assigned' ? '#3b1f0a' : ''; }
  if (habitsWindowWrap) habitsWindowWrap.style.display = mode === 'habits' ? '' : 'none';
  displayChits();
}
