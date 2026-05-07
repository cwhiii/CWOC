/**
 * main-views-projects.js — Projects view (list + Kanban modes).
 *
 * Contains:
 *   - displayProjectsView (tree list of project masters + children)
 *   - _displayProjectsKanban (Kanban board with status columns)
 *   - _renderKanbanBoard (inner render with drag-drop between columns/projects)
 *   - _kanbanFetchAndPreserveScroll (scroll-preserving refresh)
 *   - _setProjectsMode (list/kanban toggle)
 *   - _showProjectQuickMenu, _projectQuickCreateChild
 *
 * Depends on: main-views.js (shared helpers), shared.js, main.js globals
 */

// ── Projects View Mode (List vs Kanban) ──────────────────────────────────────
let _projectsViewMode = localStorage.getItem('cwoc_projectsViewMode') || 'kanban'; // 'list' | 'kanban'


function _setProjectsMode(mode) {
  _projectsViewMode = mode;
  localStorage.setItem('cwoc_projectsViewMode', mode);
  // Update button styles
  const listBtn = document.getElementById('projects-mode-list');
  const kanbanBtn = document.getElementById('projects-mode-kanban');
  if (listBtn) { listBtn.style.background = mode === 'list' ? 'ivory' : ''; listBtn.style.color = mode === 'list' ? '#3b1f0a' : ''; }
  if (kanbanBtn) { kanbanBtn.style.background = mode === 'kanban' ? 'ivory' : ''; kanbanBtn.style.color = mode === 'kanban' ? '#3b1f0a' : ''; }
  displayChits();
}

/**
 * Show a quick-action menu for a project (triggered by Shift+click on project header).
 * Provides "Create New Child Chit" and other quick actions.
 */
function _showProjectQuickMenu(e, project) {
  // Remove any existing quick menu
  document.querySelectorAll('.cwoc-project-quick-menu-overlay').forEach(function(el) { el.remove(); });

  var overlay = document.createElement('div');
  overlay.className = 'cwoc-project-quick-menu-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;';

  var menu = document.createElement('div');
  menu.className = 'cwoc-project-quick-menu';
  menu.style.cssText = 'position:fixed;background:#fffaf0;border:2px solid #6b4e31;border-radius:8px;padding:8px 0;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Lora,Georgia,serif;';

  // Position near the click
  var menuX = Math.min(e.clientX, window.innerWidth - 220);
  var menuY = Math.min(e.clientY, window.innerHeight - 150);
  menu.style.left = menuX + 'px';
  menu.style.top = menuY + 'px';

  // Menu title
  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'padding:4px 14px 8px;font-weight:bold;color:#4a2c2a;font-size:0.95em;border-bottom:1px solid rgba(139,90,43,0.2);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px;';
  titleEl.textContent = project.title || '(Untitled Project)';
  titleEl.title = project.title || '';
  menu.appendChild(titleEl);

  // "Create New Child Chit" option
  var createItem = document.createElement('div');
  createItem.style.cssText = 'padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.95em;color:#1a1208;';
  createItem.innerHTML = '<i class="fas fa-file-circle-plus" style="color:#6b4e31;width:16px;text-align:center;"></i> Create New Child Chit';
  createItem.addEventListener('mouseenter', function() { this.style.background = '#f0e6d0'; });
  createItem.addEventListener('mouseleave', function() { this.style.background = ''; });
  createItem.addEventListener('click', function() {
    overlay.remove();
    _projectQuickCreateChild(project);
  });
  menu.appendChild(createItem);

  // "Open in Editor" option
  var openItem = document.createElement('div');
  openItem.style.cssText = 'padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.95em;color:#1a1208;';
  openItem.innerHTML = '<i class="fas fa-pen-to-square" style="color:#6b4e31;width:16px;text-align:center;"></i> Open Project in Editor';
  openItem.addEventListener('mouseenter', function() { this.style.background = '#f0e6d0'; });
  openItem.addEventListener('mouseleave', function() { this.style.background = ''; });
  openItem.addEventListener('click', function() {
    overlay.remove();
    storePreviousState();
    window.location.href = '/editor?id=' + project.id;
  });
  menu.appendChild(openItem);

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  // Click overlay to close
  overlay.addEventListener('click', function(ev) {
    if (ev.target === overlay) overlay.remove();
  });

  // ESC to close
  function _escHandler(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      overlay.remove();
      document.removeEventListener('keydown', _escHandler, true);
    }
  }
  document.addEventListener('keydown', _escHandler, true);
}

/**
 * Create a new chit and add it as a child of the given project (from dashboard).
 */
async function _projectQuickCreateChild(project) {
  cwocPromptModal("Create New Child Chit", "Enter chit title…", async function(title) {
    try {
      // Create the new chit
      var resp = await fetch("/api/chits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, status: "ToDo" }),
      });
      if (!resp.ok) throw new Error("Failed to create chit");
      var created = await resp.json();

      // Add to project's child_chits
      var projResp = await fetch('/api/chit/' + project.id);
      if (!projResp.ok) throw new Error("Failed to fetch project");
      var projData = await projResp.json();
      if (!Array.isArray(projData.child_chits)) projData.child_chits = [];
      projData.child_chits.push(created.id);

      var saveResp = await fetch('/api/chits/' + project.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projData),
      });
      if (!saveResp.ok) throw new Error("Failed to update project");

      if (typeof cwocToast === 'function') cwocToast('Created "' + title + '" and added to project.', 'success');
      // Refresh the view
      if (typeof fetchChits === 'function') fetchChits();
    } catch (err) {
      console.error("Error creating new child chit from dashboard:", err);
      if (typeof cwocToast === 'function') cwocToast("Failed to create new child chit.", "error");
    }
  });
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

  // Collect all child IDs that are missing from chitMap
  var _listMissingIds = [];
  projects.forEach(function(project) {
    var childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    childIds.forEach(function(cid) {
      if (!chitMap[cid] && !(window._projectChildNotFound && window._projectChildNotFound.has(cid))) _listMissingIds.push(cid);
    });
  });

  // If there are missing children, fetch them and re-render
  if (_listMissingIds.length > 0) {
    chitList.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">⏳ Loading project children…</div>';
    Promise.all(_listMissingIds.map(function(cid) {
      return fetch('/api/chit/' + encodeURIComponent(cid))
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
    })).then(function(results) {
      if (!window._projectChildNotFound) window._projectChildNotFound = new Set();
      results.forEach(function(child, idx) {
        if (child && !child.deleted) {
          chitMap[child.id] = child;
          chits.push(child); // Add to global array so future renders don't re-fetch
        } else {
          // Mark as unfetchable to prevent infinite re-fetch loops
          window._projectChildNotFound.add(_listMissingIds[idx]);
        }
      });
      // Re-call displayProjectsView now that children are loaded
      displayProjectsView(chitsToDisplay);
    });
    return;
  }

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
    _listProjHeaderContent.appendChild(_buildChitHeader(project, project.title || "(Untitled Project)", _viSettings, { checklistCount: true }));

    // Child chit progress — shows completed/total chits + aggregate checklist progress
    if (childIds.length > 0) {
      var _projSettings = window._cwocSettings || {};
      var _projShowChildCount = _projSettings.projects_show_child_count === '1';
      var _projShowChecklistCount = _projSettings.projects_show_checklist_count === '1';
      if (_projShowChildCount || _projShowChecklistCount) {
        var _projCompleteCount = 0;
        var _projTotalChildren = 0;
        var _projClCheckedSum = 0;
        var _projClTotalSum = 0;
        childIds.forEach(function(cid) {
          var child = chitMap[cid];
          if (!child || child.deleted) return;
          _projTotalChildren++;
          if (child.status === 'Complete') _projCompleteCount++;
          if (_projShowChecklistCount && Array.isArray(child.checklist) && child.checklist.length > 0) {
            var _projClNonEmpty = child.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
            _projClTotalSum += _projClNonEmpty.length;
            _projClCheckedSum += _projClNonEmpty.filter(function(i) { return i.checked || i.done; }).length;
          }
        });
        if (_projTotalChildren > 0) {
          var _projProgressSpan = document.createElement('span');
          _projProgressSpan.style.cssText = 'font-size:0.8em;opacity:0.7;margin-left:0.5em;font-weight:normal;white-space:nowrap;';
          var _projProgressParts = [];
          if (_projShowChildCount) _projProgressParts.push(_projCompleteCount + '/' + _projTotalChildren + (_projCompleteCount === _projTotalChildren ? ' ✓' : ''));
          if (_projShowChecklistCount && _projClTotalSum > 0) _projProgressParts.push(_projClCheckedSum + '/' + _projClTotalSum + (_projClCheckedSum === _projClTotalSum ? ' ☑' : ''));
          if (_projProgressParts.length > 0) {
            _projProgressSpan.textContent = '(' + _projProgressParts.join(', ') + ')';
            _projProgressSpan.title = (_projShowChildCount ? _projCompleteCount + ' complete / ' + _projTotalChildren + ' child chits' : '') + (_projShowChildCount && _projShowChecklistCount && _projClTotalSum > 0 ? ', ' : '') + (_projShowChecklistCount && _projClTotalSum > 0 ? _projClCheckedSum + '/' + _projClTotalSum + ' checklist items' : '');
            var _projHeaderLeftForBadge = _listProjHeaderContent.querySelector('.chit-header-left');
            if (_projHeaderLeftForBadge) _projHeaderLeftForBadge.appendChild(_projProgressSpan);
          }
        }
      }
    }

    // Inline note snippet — first line only, truncated to fit
    if (project.note && project.note.trim()) {
      var _projNoteLine = project.note.trim().split('\n')[0];
      if (_projNoteLine.length > 80) _projNoteLine = _projNoteLine.slice(0, 80) + '…';
      var _projNoteSpan = document.createElement('span');
      _projNoteSpan.style.cssText = 'font-size:0.8em;opacity:0.55;margin-left:0.7em;font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      _projNoteSpan.textContent = '— ' + _projNoteLine;
      // Append to the header row's left side (after title/count)
      var _projHeaderLeft = _listProjHeaderContent.querySelector('.chit-header-left');
      if (_projHeaderLeft) _projHeaderLeft.appendChild(_projNoteSpan);
    }
    header.appendChild(_listProjHeaderContent);

    // "+" button to create a new child chit directly from the project header
    if (!(typeof _isViewerRole === 'function' && _isViewerRole(project))) {
      var _listAddChildBtn = document.createElement('button');
      _listAddChildBtn.className = 'cwoc-project-add-btn';
      _listAddChildBtn.title = 'Create new child chit';
      _listAddChildBtn.innerHTML = '<i class="fas fa-plus"></i>';
      _listAddChildBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _projectQuickCreateChild(project);
      });
      header.appendChild(_listAddChildBtn);
    }

    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });

    // Shift+click: show project quick menu (create new child, etc.)
    header.addEventListener("click", function(e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof _isViewerRole === 'function' && _isViewerRole(project)) return;
      _showProjectQuickMenu(e, project);
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

        // Checklist progress count on child chits
        if (child && Array.isArray(child.checklist) && child.checklist.length > 0) {
          var _pclItems = child.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
          var _pclChecked = _pclItems.filter(function(i) { return i.checked || i.done; }).length;
          var _pclSuffix = (_pclItems.length > 0 && _pclChecked === _pclItems.length) ? ' ✓' : '';
          var _pclSpan = document.createElement('span');
          _pclSpan.className = 'checklist-progress-count';
          _pclSpan.dataset.chitId = child.id;
          _pclSpan.style.cssText = 'font-size:0.8em;opacity:0.7;margin-left:0.5em;font-weight:normal;white-space:nowrap;';
          _pclSpan.textContent = '(' + _pclChecked + '/' + _pclItems.length + _pclSuffix + ')';
          titleRow.appendChild(_pclSpan);
        }

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

  // Collect all child IDs that are missing from chitMap
  var missingIds = [];
  projects.forEach(function(project) {
    var childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
    childIds.forEach(function(cid) {
      if (!chitMap[cid] && !(window._projectChildNotFound && window._projectChildNotFound.has(cid))) missingIds.push(cid);
    });
  });

  // If there are missing children, fetch them and re-render
  if (missingIds.length > 0) {
    chitList.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">⏳ Loading project children…</div>';
    Promise.all(missingIds.map(function(cid) {
      return fetch('/api/chit/' + encodeURIComponent(cid))
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
    })).then(function(results) {
      if (!window._projectChildNotFound) window._projectChildNotFound = new Set();
      var added = 0;
      results.forEach(function(child, idx) {
        if (child && !child.deleted) {
          chitMap[child.id] = child;
          chits.push(child);
          added++;
        } else {
          window._projectChildNotFound.add(missingIds[idx]);
        }
      });
      // Auto-prune stale child references from project masters
      if (window._projectChildNotFound.size > 0) {
        projects.forEach(function(project) {
          var childIds = Array.isArray(project.child_chits) ? project.child_chits : [];
          var cleaned = childIds.filter(function(cid) { return !window._projectChildNotFound.has(cid); });
          if (cleaned.length < childIds.length) {
            project.child_chits = cleaned;
            // Persist the cleanup to backend
            fetch('/api/chits/' + encodeURIComponent(project.id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(project),
            }).catch(function(e) { console.warn('[Kanban] Failed to prune stale children from project:', e); });
          }
        });
      }
      _renderKanbanBoard(chitList, projects, chitMap, _viSettings);
    });
  } else {
    _renderKanbanBoard(chitList, projects, chitMap, _viSettings);
  }
}

/** Inner render function for the Kanban board (extracted to allow async pre-fetch). */
function _renderKanbanBoard(chitList, projects, chitMap, _viSettings) {
  chitList.innerHTML = "";
  var _kanbanProjectDragActive = false;

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
    headerTitle.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:0.4em;";
    var _kanbanHeaderText = project.title || "(Untitled Project)";
    // Checklist progress count on project master
    if (Array.isArray(project.checklist) && project.checklist.length > 0) {
      var _kpClNonEmpty = project.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
      var _kpClChecked = _kpClNonEmpty.filter(function(i) { return i.checked || i.done; }).length;
      var _kpClSuffix = (_kpClNonEmpty.length > 0 && _kpClChecked === _kpClNonEmpty.length) ? ' ✓' : '';
      _kanbanHeaderText += ' (' + _kpClChecked + '/' + _kpClNonEmpty.length + _kpClSuffix + ')';
    }
    var _kanbanTitleSpan = document.createElement('span');
    _kanbanTitleSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    _kanbanTitleSpan.textContent = _kanbanHeaderText;
    headerTitle.appendChild(_kanbanTitleSpan);

    // Child chit progress — shows completed/total chits + aggregate checklist progress
    if (childIds.length > 0) {
      var _kanbanSettings = window._cwocSettings || {};
      var _kanbanShowChildCount = _kanbanSettings.projects_show_child_count === '1';
      var _kanbanShowChecklistCount = _kanbanSettings.projects_show_checklist_count === '1';
      if (_kanbanShowChildCount || _kanbanShowChecklistCount) {
        var _kanbanCompleteCount = 0;
        var _kanbanTotalChildren = 0;
        var _kanbanClCheckedSum = 0;
        var _kanbanClTotalSum = 0;
        childIds.forEach(function(cid) {
          var child = chitMap[cid];
          if (!child || child.deleted) return;
          _kanbanTotalChildren++;
          if (child.status === 'Complete') _kanbanCompleteCount++;
          if (_kanbanShowChecklistCount && Array.isArray(child.checklist) && child.checklist.length > 0) {
            var _kanbanClNonEmpty = child.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
            _kanbanClTotalSum += _kanbanClNonEmpty.length;
            _kanbanClCheckedSum += _kanbanClNonEmpty.filter(function(i) { return i.checked || i.done; }).length;
          }
        });
        if (_kanbanTotalChildren > 0) {
          var _kanbanProgressParts = [];
          if (_kanbanShowChildCount) _kanbanProgressParts.push(_kanbanCompleteCount + '/' + _kanbanTotalChildren + (_kanbanCompleteCount === _kanbanTotalChildren ? ' ✓' : ''));
          if (_kanbanShowChecklistCount && _kanbanClTotalSum > 0) _kanbanProgressParts.push(_kanbanClCheckedSum + '/' + _kanbanClTotalSum + (_kanbanClCheckedSum === _kanbanClTotalSum ? ' ☑' : ''));
          if (_kanbanProgressParts.length > 0) {
            var _kanbanProgressSpan = document.createElement('span');
            _kanbanProgressSpan.style.cssText = 'font-size:0.8em;opacity:0.7;font-weight:normal;white-space:nowrap;';
            _kanbanProgressSpan.textContent = '(' + _kanbanProgressParts.join(', ') + ')';
            _kanbanProgressSpan.title = (_kanbanShowChildCount ? _kanbanCompleteCount + ' complete / ' + _kanbanTotalChildren + ' child chits' : '') + (_kanbanShowChildCount && _kanbanShowChecklistCount && _kanbanClTotalSum > 0 ? ', ' : '') + (_kanbanShowChecklistCount && _kanbanClTotalSum > 0 ? _kanbanClCheckedSum + '/' + _kanbanClTotalSum + ' checklist items' : '');
            headerTitle.appendChild(_kanbanProgressSpan);
          }
        }
      }
    }

    // Inline note snippet — first line only, truncated
    if (project.note && project.note.trim()) {
      var _kpNoteLine = project.note.trim().split('\n')[0];
      if (_kpNoteLine.length > 60) _kpNoteLine = _kpNoteLine.slice(0, 60) + '…';
      var _kpNoteSpan = document.createElement('span');
      _kpNoteSpan.style.cssText = 'font-size:0.8em;opacity:0.55;font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      _kpNoteSpan.textContent = '— ' + _kpNoteLine;
      headerTitle.appendChild(_kpNoteSpan);
    }
    header.appendChild(headerTitle);

    // "+" button to create a new child chit directly from the project header
    if (!(typeof _isViewerRole === 'function' && _isViewerRole(project))) {
      var _kanbanAddChildBtn = document.createElement('button');
      _kanbanAddChildBtn.className = 'cwoc-project-add-btn';
      _kanbanAddChildBtn.title = 'Create new child chit';
      _kanbanAddChildBtn.innerHTML = '<i class="fas fa-plus"></i>';
      _kanbanAddChildBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _projectQuickCreateChild(project);
      });
      header.appendChild(_kanbanAddChildBtn);
    }

    header.addEventListener("dblclick", () => {
      storePreviousState();
      window.location.href = `/editor?id=${project.id}`;
    });

    // Shift+click: show project quick menu (create new child, etc.)
    header.addEventListener("click", function(e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof _isViewerRole === 'function' && _isViewerRole(project)) return;
      _showProjectQuickMenu(e, project);
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
    const _statusMapLower = { "todo": "ToDo", "in progress": "In Progress", "blocked": "Blocked", "complete": "Complete" };
    childIds.forEach(cid => {
      const child = chitMap[cid];
      if (!child || child.deleted) return;
      const rawSt = child.status || "ToDo";
      const st = _statusMapLower[rawSt.toLowerCase()] || "ToDo";
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
        if (_isDeclinedByCurrentUser(child)) {
          console.warn('[Kanban] declined-chit applied to:', child.title, '| owner_id:', child.owner_id, '| shares:', JSON.stringify(child.shares));
          card.classList.add("declined-chit");
        }

        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-weight:bold;margin-bottom:3px;";
        const titleTextSpan = document.createElement("span");
        titleTextSpan.textContent = child.title || "(Untitled)";
        if (child.status === "Complete") titleTextSpan.style.textDecoration = "line-through";
        titleEl.appendChild(titleTextSpan);
        // Checklist progress count on child chits
        if (Array.isArray(child.checklist) && child.checklist.length > 0) {
          var _kclItems = child.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
          var _kclChecked = _kclItems.filter(function(i) { return i.checked || i.done; }).length;
          var _kclSuffix = (_kclItems.length > 0 && _kclChecked === _kclItems.length) ? ' ✓' : '';
          var _kclCountSpan = document.createElement("span");
          _kclCountSpan.textContent = ' (' + _kclChecked + '/' + _kclItems.length + _kclSuffix + ')';
          titleEl.appendChild(_kclCountSpan);
        }
        // Visual indicators inline with title
        if (typeof _getAllIndicators === 'function') {
          const ind = _getAllIndicators(child, _viSettings, 'card');
          if (ind) {
            var _kIndSpan = document.createElement("span");
            _kIndSpan.textContent = ' ' + ind;
            titleEl.appendChild(_kIndSpan);
          }
        }
        // Stealth indicator — visible only to the owner (Requirement 6.5)
        if (child.stealth) {
          var _kanbanStealthUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (_kanbanStealthUser && child.owner_id === _kanbanStealthUser.user_id) {
            var _kStealthSpan = document.createElement("span");
            _kStealthSpan.textContent = ' 🥷';
            titleEl.appendChild(_kStealthSpan);
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
            if (gc.status === "Complete") gcTitle.style.textDecoration = "line-through";
            li.appendChild(gcTitle);

            // Checklist progress count on grandchild chits
            if (Array.isArray(gc.checklist) && gc.checklist.length > 0) {
              var _gcClNonEmpty = gc.checklist.filter(function(i) { return i && i.text && i.text.trim(); });
              var _gcClChecked = _gcClNonEmpty.filter(function(i) { return i.checked || i.done; }).length;
              var _gcClSuffix = (_gcClNonEmpty.length > 0 && _gcClChecked === _gcClNonEmpty.length) ? ' ✓' : '';
              var _gcClSpan = document.createElement('span');
              _gcClSpan.style.cssText = 'font-size:0.8em;opacity:0.7;margin-left:0.3em;white-space:nowrap;';
              _gcClSpan.textContent = '(' + _gcClChecked + '/' + _gcClNonEmpty.length + _gcClSuffix + ')';
              li.appendChild(_gcClSpan);
            }

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
          // Hide the card after browser captures drag image so only the placeholder shows
          requestAnimationFrame(function () { card.style.display = 'none'; });
        });
        card.addEventListener("dragend", () => { card.style.display = ''; card.classList.remove('cwoc-dragging'); if (typeof _markDragJustEnded === 'function') _markDragJustEnded(); });

        card.addEventListener("dblclick", () => {
          storePreviousState();
          window.location.href = `/editor?id=${child.id}`;
        });

        // Touch gesture: floating card + placeholder reorder (same style as Notes view)
        if (typeof enableTouchGesture === 'function') {
          (function (_card, _child, _status, _project) {
            var _kanbanTouchDragCard = null;
            var _kanbanTouchPlaceholder = null;
            var _kanbanTouchOffsetX = 0;
            var _kanbanTouchOffsetY = 0;
            enableTouchGesture(_card, {
              onDragStart: function (data) {
                _kanbanTouchDragCard = _card;
                var rect = _card.getBoundingClientRect();
                _kanbanTouchOffsetX = (data && data.clientX !== undefined) ? data.clientX - rect.left : rect.width / 2;
                _kanbanTouchOffsetY = (data && data.clientY !== undefined) ? data.clientY - rect.top : rect.height / 2;

                // Create placeholder in the card's position
                _kanbanTouchPlaceholder = document.createElement('div');
                _kanbanTouchPlaceholder.className = 'cwoc-kanban-drop-placeholder';
                _kanbanTouchPlaceholder.style.cssText = 'height:' + rect.height + 'px;border:2px dashed #8b5a2b;border-radius:6px;background:rgba(139,90,43,0.08);box-sizing:border-box;margin-bottom:0.3em;transition:height 0.15s ease;';
                _card.parentNode.insertBefore(_kanbanTouchPlaceholder, _card);

                // Float the card under the finger
                _card.style.position = 'fixed';
                _card.style.left = rect.left + 'px';
                _card.style.top = rect.top + 'px';
                _card.style.width = rect.width + 'px';
                _card.style.zIndex = '10000';
                _card.style.opacity = '0.9';
                _card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                _card.style.transition = 'none';
                _card.style.pointerEvents = 'none';
                document.body.style.overscrollBehavior = 'contain';
              },
              onDragMove: function (data) {
                if (!_kanbanTouchDragCard) return;

                // Move floating card to follow finger
                _card.style.left = (data.clientX - _kanbanTouchOffsetX) + 'px';
                _card.style.top = (data.clientY - _kanbanTouchOffsetY) + 'px';

                // Find which column the finger is over
                var target = document.elementFromPoint(data.clientX, data.clientY);
                if (!target) return;
                var targetCol = target.closest('[data-status][data-project-id]');

                // Highlight target column
                wrapper.querySelectorAll('[data-status]').forEach(function (c) {
                  c.style.background = '';
                });
                if (targetCol) {
                  targetCol.style.background = 'rgba(139,90,43,0.08)';

                  // Move placeholder within the target column to show insert position
                  var colCards = Array.from(targetCol.querySelectorAll('.chit-card[data-chit-id]'));
                  var otherCards = colCards.filter(function (c) { return c !== _card; });
                  var insertIdx = otherCards.length;
                  for (var i = 0; i < otherCards.length; i++) {
                    var r = otherCards[i].getBoundingClientRect();
                    if (data.clientY < r.top + r.height / 2) {
                      insertIdx = i;
                      break;
                    }
                  }
                  if (_kanbanTouchPlaceholder) {
                    if (insertIdx >= otherCards.length) {
                      targetCol.appendChild(_kanbanTouchPlaceholder);
                    } else {
                      targetCol.insertBefore(_kanbanTouchPlaceholder, otherCards[insertIdx]);
                    }
                  }
                }
              },
              onDragEnd: function (data) {
                if (!_kanbanTouchDragCard) return;

                document.body.style.overscrollBehavior = '';
                wrapper.querySelectorAll('[data-status]').forEach(function (c) {
                  c.style.background = '';
                });

                // Find target column from placeholder position
                var targetCol = _kanbanTouchPlaceholder ? _kanbanTouchPlaceholder.closest('[data-status][data-project-id]') : null;

                // Restore card styles
                _card.style.position = '';
                _card.style.left = '';
                _card.style.top = '';
                _card.style.width = '';
                _card.style.zIndex = '';
                _card.style.opacity = '';
                _card.style.boxShadow = '';
                _card.style.transition = '';
                _card.style.pointerEvents = '';

                // Remove placeholder
                if (_kanbanTouchPlaceholder && _kanbanTouchPlaceholder.parentNode) {
                  _kanbanTouchPlaceholder.remove();
                }
                _kanbanTouchPlaceholder = null;

                if (!targetCol) { _kanbanTouchDragCard = null; return; }

                var newStatus = targetCol.dataset.status;
                var targetProjectId = targetCol.dataset.projectId;
                var isCrossProject = _project.id !== targetProjectId;

                // Within-column reorder (same project, same status)
                if (!isCrossProject && _status === newStatus) {
                  var colCards = Array.from(targetCol.querySelectorAll('.chit-card[data-chit-id]'));
                  var otherCards = colCards.filter(function (c) { return c !== _card; });
                  var insertIdx = otherCards.length;
                  for (var i = 0; i < otherCards.length; i++) {
                    var r = otherCards[i].getBoundingClientRect();
                    if (data.clientY < r.top + r.height / 2) {
                      insertIdx = i;
                      break;
                    }
                  }
                  var cardIds = otherCards.map(function (c) { return c.dataset.chitId; });
                  cardIds.splice(insertIdx, 0, _child.id);

                  (async function () {
                    try {
                      var resp = await fetch('/api/chit/' + _project.id);
                      if (!resp.ok) return;
                      var projData = await resp.json();
                      var existingOrder = Array.isArray(projData.child_chits) ? projData.child_chits : [];
                      var colChildIds = new Set(cardIds);
                      var newOrder = [];
                      var colIdx = 0;
                      existingOrder.forEach(function (cid) {
                        if (colChildIds.has(cid)) {
                          newOrder.push(cardIds[colIdx++]);
                        } else {
                          newOrder.push(cid);
                        }
                      });
                      while (colIdx < cardIds.length) {
                        newOrder.push(cardIds[colIdx++]);
                      }
                      projData.child_chits = newOrder;
                      await fetch('/api/chits/' + _project.id, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(projData)
                      });
                      _kanbanFetchAndPreserveScroll();
                    } catch (err) { console.error('Kanban touch reorder error:', err); }
                  })();

                  _kanbanTouchDragCard = null;
                  return;
                }

                // Cross-column or cross-project move
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
                // Clean up floating card state if drag was active
                if (_kanbanTouchDragCard) {
                  document.body.style.overscrollBehavior = '';
                  _card.style.position = '';
                  _card.style.left = '';
                  _card.style.top = '';
                  _card.style.width = '';
                  _card.style.zIndex = '';
                  _card.style.opacity = '';
                  _card.style.boxShadow = '';
                  _card.style.transition = '';
                  _card.style.pointerEvents = '';
                  if (_kanbanTouchPlaceholder && _kanbanTouchPlaceholder.parentNode) {
                    _kanbanTouchPlaceholder.parentNode.insertBefore(_card, _kanbanTouchPlaceholder);
                    _kanbanTouchPlaceholder.remove();
                  }
                  _kanbanTouchPlaceholder = null;
                  _kanbanTouchDragCard = null;
                }
                if (typeof _isViewerRole === 'function' && _isViewerRole(_child)) return;
                showQuickEditModal(_child, function () { displayChits(); });
              },
            });
          })(card, child, status, project);
        }

        col.appendChild(card);
      });

      // ── Within-column reorder: placeholder that shifts cards out of the way ──
      var _colPlaceholder = null;
      var _colDraggedCard = null;
      var _colDraggedCardHeight = 40;

      col.addEventListener("dragover", e => {
        // Let project-reorder drags pass through to the wrapper
        if (_kanbanProjectDragActive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Only show placeholder for same-column reorder
        if (!_colDraggedCard || !col.contains(_colDraggedCard)) {
          // Cross-column: just highlight the column
          col.style.background = "rgba(139,90,43,0.08)";
          return;
        }

        // Position placeholder among sibling cards
        var cards = Array.from(col.querySelectorAll('.chit-card[data-chit-id]'));
        var others = cards.filter(function (c) { return c !== _colDraggedCard; });
        var insertIdx = others.length;
        for (var i = 0; i < others.length; i++) {
          var r = others[i].getBoundingClientRect();
          if (e.clientY < r.top + r.height / 2) {
            insertIdx = i;
            break;
          }
        }
        if (!_colPlaceholder) {
          _colPlaceholder = document.createElement('div');
          _colPlaceholder.className = 'cwoc-kanban-drop-placeholder';
          _colPlaceholder.style.cssText = 'height:' + _colDraggedCardHeight + 'px;border:2px dashed #8b5a2b;border-radius:6px;background:rgba(139,90,43,0.08);box-sizing:border-box;margin-bottom:0.3em;transition:height 0.15s ease;';
        }
        if (insertIdx >= others.length) {
          col.appendChild(_colPlaceholder);
        } else {
          col.insertBefore(_colPlaceholder, others[insertIdx]);
        }
      });
      col.addEventListener("dragleave", e => {
        if (!col.contains(e.relatedTarget)) {
          col.style.background = "";
          if (_colPlaceholder && _colPlaceholder.parentNode) _colPlaceholder.remove();
        }
      });

      // Track which card is being dragged within this column
      col.addEventListener("dragstart", function (e) {
        var card = e.target.closest('.chit-card');
        if (card && col.contains(card)) {
          _colDraggedCard = card;
          _colDraggedCardHeight = card.offsetHeight || 40;
        }
      }, true);
      col.addEventListener("dragend", function () {
        _colDraggedCard = null;
        col.style.background = "";
        if (_colPlaceholder && _colPlaceholder.parentNode) _colPlaceholder.remove();
        _colPlaceholder = null;
      });

      col.addEventListener("drop", async e => {
        e.preventDefault();
        col.style.background = "";
        if (_colPlaceholder && _colPlaceholder.parentNode) _colPlaceholder.remove();
        _colPlaceholder = null;

        // Handle card drops (child chit status change, cross-project move, or within-column reorder)
        const cardData = e.dataTransfer.getData("application/x-kanban-card");
        if (cardData) {
          try {
            const data = JSON.parse(cardData);
            const newStatus = col.dataset.status;
            const targetProjectId = col.dataset.projectId;
            const isCrossProject = data.projectId !== targetProjectId;

            // Within-column reorder (same project, same status)
            if (!isCrossProject && data.fromStatus === newStatus) {
              // Determine new order from placeholder position
              var cards = Array.from(col.querySelectorAll('.chit-card[data-chit-id]'));
              var otherCards = cards.filter(function (c) { return c.dataset.chitId !== data.chitId; });
              // Find insert position based on cursor Y among remaining cards
              var insertIdx = otherCards.length;
              for (var i = 0; i < otherCards.length; i++) {
                var r = otherCards[i].getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) {
                  insertIdx = i;
                  break;
                }
              }
              var cardIds = otherCards.map(function (c) { return c.dataset.chitId; });
              cardIds.splice(insertIdx, 0, data.chitId);

              // Rebuild the full child_chits order
              var resp = await fetch('/api/chit/' + targetProjectId);
              if (!resp.ok) return;
              var projData = await resp.json();
              var existingOrder = Array.isArray(projData.child_chits) ? projData.child_chits : [];

              var colChildIds = new Set(cardIds);
              var newOrder = [];
              var colIdx = 0;
              existingOrder.forEach(function (cid) {
                if (colChildIds.has(cid)) {
                  newOrder.push(cardIds[colIdx++]);
                } else {
                  newOrder.push(cid);
                }
              });
              while (colIdx < cardIds.length) {
                newOrder.push(cardIds[colIdx++]);
              }

              projData.child_chits = newOrder;
              await fetch('/api/chits/' + targetProjectId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projData)
              });
              _kanbanFetchAndPreserveScroll();
              return;
            }

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
