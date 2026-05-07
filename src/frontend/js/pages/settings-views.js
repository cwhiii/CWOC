// ── Settings: Arrange Views Modal ────────────────────────────────────────────
// Drag-and-drop reordering of dashboard tab views.
// Extracted from settings.js for modularity.

/** Default view order — matches the HTML tab order in index.html */
var _defaultViewOrder = ['Calendar', 'Checklists', 'Tasks', 'Projects', 'Notes', 'Email', 'Indicators', 'Alarms'];

/** Current view order state for the modal (visible tabs) */
var _currentViewOrder = null;

/** Current hidden views state for the modal */
var _hiddenViews = [];

/** View metadata for rendering tab buttons */
var _viewMeta = {
  Calendar:    { icon: 'img', src: '/static/calendar.png', label: '<u>C</u>alendar' },
  Checklists:  { icon: 'img', src: '/static/checklists.png', label: '<u>C</u>hecklists' },
  Tasks:       { icon: 'img', src: '/static/tasks.png', label: '<u>T</u>asks' },
  Projects:    { icon: 'img', src: '/static/projects.png', label: '<u>P</u>rojects' },
  Notes:       { icon: 'img', src: '/static/notes.png', label: '<u>N</u>otes' },
  Email:       { icon: 'fa', cls: 'fas fa-envelope', label: '<u>E</u>mail' },
  Indicators:  { icon: 'fa', cls: 'fas fa-heartbeat', label: '<u>I</u>ndicators' },
  Alarms:      { icon: 'img', src: '/static/alerts.png', label: '<u>A</u>lerts' },
};

/** Open the Arrange Views modal */
function _openArrangeViewsModal() {
  var modal = document.getElementById('arrange-views-modal');
  if (!modal) return;

  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.view_order) {
    var saved = window.settingsManager.settings.view_order;
    if (typeof saved === 'string') {
      try { saved = JSON.parse(saved); } catch (e) { saved = null; }
    }
    if (Array.isArray(saved) && saved.length > 0) {
      _currentViewOrder = saved.slice();
    } else {
      _currentViewOrder = _defaultViewOrder.slice();
    }
  } else {
    _currentViewOrder = _defaultViewOrder.slice();
  }

  _hiddenViews = _defaultViewOrder.filter(function(v) {
    return _currentViewOrder.indexOf(v) === -1;
  });

  _renderArrangeViewsGrid();
  modal.style.display = 'flex';
}

/** Close the Arrange Views modal */
function _closeArrangeViewsModal() {
  var modal = document.getElementById('arrange-views-modal');
  if (modal) modal.style.display = 'none';
}

/** Cancel arrange views — revert to the state before opening and close */
function _cancelArrangeViews() {
  if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.view_order) {
    var saved = window.settingsManager.settings.view_order;
    if (typeof saved === 'string') {
      try { saved = JSON.parse(saved); } catch (e) { saved = null; }
    }
    if (Array.isArray(saved) && saved.length > 0) {
      _currentViewOrder = saved.slice();
    } else {
      _currentViewOrder = _defaultViewOrder.slice();
    }
  } else {
    _currentViewOrder = _defaultViewOrder.slice();
  }
  _hiddenViews = _defaultViewOrder.filter(function(v) {
    return _currentViewOrder.indexOf(v) === -1;
  });
  _closeArrangeViewsModal();
}

/** Reset view order to default */
function _resetViewOrder() {
  _currentViewOrder = _defaultViewOrder.slice();
  _hiddenViews = [];
  _renderArrangeViewsGrid();
  setSaveButtonUnsaved();
}

/** Render the draggable tab buttons in both zones */
function _renderArrangeViewsGrid() {
  var grid = document.getElementById('arrange-views-grid');
  var hidden = document.getElementById('arrange-views-hidden');
  if (!grid || !hidden) return;
  grid.innerHTML = '';
  hidden.innerHTML = '';

  _currentViewOrder.forEach(function(viewName) {
    grid.appendChild(_createViewTabItem(viewName));
  });

  _hiddenViews.forEach(function(viewName) {
    hidden.appendChild(_createViewTabItem(viewName));
  });

  _setupArrangeViewsDrag();
}

/** Create a single view tab item element */
function _createViewTabItem(viewName) {
  var meta = _viewMeta[viewName];
  if (!meta) return document.createElement('div');

  var item = document.createElement('div');
  item.className = 'view-tab-item';
  item.draggable = true;
  item.dataset.view = viewName;

  if (meta.icon === 'img') {
    var img = document.createElement('img');
    img.src = meta.src;
    img.alt = viewName;
    item.appendChild(img);
  } else if (meta.icon === 'fa') {
    var icon = document.createElement('i');
    icon.className = meta.cls;
    item.appendChild(icon);
  }

  var label = document.createElement('span');
  label.innerHTML = meta.label;
  item.appendChild(label);

  return item;
}

/** Set up drag-and-drop for the arrange views grid and hidden zone */
function _setupArrangeViewsDrag() {
  var grid = document.getElementById('arrange-views-grid');
  var hiddenZone = document.getElementById('arrange-views-hidden');
  if (!grid || !hiddenZone) return;

  var draggedItem = null;

  function attachItemListeners(item) {
    item.addEventListener('dragstart', function(e) {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.view);
    });

    item.addEventListener('dragend', function() {
      item.classList.remove('dragging');
      draggedItem = null;
      grid.querySelectorAll('.view-tab-item').forEach(function(el) {
        el.style.borderLeft = '';
        el.style.borderRight = '';
      });
      hiddenZone.querySelectorAll('.view-tab-item').forEach(function(el) {
        el.style.borderLeft = '';
        el.style.borderRight = '';
      });
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedItem || draggedItem === item) return;

      var rect = item.getBoundingClientRect();
      var midX = rect.left + rect.width / 2;
      grid.querySelectorAll('.view-tab-item').forEach(function(el) {
        el.style.borderLeft = '';
        el.style.borderRight = '';
      });
      hiddenZone.querySelectorAll('.view-tab-item').forEach(function(el) {
        el.style.borderLeft = '';
        el.style.borderRight = '';
      });
      if (e.clientX < midX) {
        item.style.borderLeft = '3px solid #8b5a2b';
      } else {
        item.style.borderRight = '3px solid #8b5a2b';
      }
    });

    item.addEventListener('dragleave', function() {
      item.style.borderLeft = '';
      item.style.borderRight = '';
    });

    item.addEventListener('drop', function(e) {
      e.preventDefault();
      item.style.borderLeft = '';
      item.style.borderRight = '';
      if (!draggedItem || draggedItem === item) return;

      var draggedView = draggedItem.dataset.view;
      var targetView = item.dataset.view;
      var rect = item.getBoundingClientRect();
      var midX = rect.left + rect.width / 2;
      var insertBefore = e.clientX < midX;

      var targetInGrid = grid.contains(item);

      _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
      _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });

      if (targetInGrid) {
        var targetIdx = _currentViewOrder.indexOf(targetView);
        if (!insertBefore) targetIdx++;
        _currentViewOrder.splice(targetIdx, 0, draggedView);
      } else {
        var targetIdx = _hiddenViews.indexOf(targetView);
        if (!insertBefore) targetIdx++;
        _hiddenViews.splice(targetIdx, 0, draggedView);
      }

      _renderArrangeViewsGrid();
      setSaveButtonUnsaved();
    });
  }

  grid.querySelectorAll('.view-tab-item').forEach(attachItemListeners);
  hiddenZone.querySelectorAll('.view-tab-item').forEach(attachItemListeners);

  grid.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  grid.addEventListener('drop', function(e) {
    e.preventDefault();
    if (!draggedItem) return;
    if (e.target !== grid) return;
    var draggedView = draggedItem.dataset.view;
    _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
    _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });
    _currentViewOrder.push(draggedView);
    _renderArrangeViewsGrid();
    setSaveButtonUnsaved();
  });

  hiddenZone.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  hiddenZone.addEventListener('drop', function(e) {
    e.preventDefault();
    if (!draggedItem) return;
    if (e.target !== hiddenZone) return;
    var draggedView = draggedItem.dataset.view;
    _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
    _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });
    _hiddenViews.push(draggedView);
    _renderArrangeViewsGrid();
    setSaveButtonUnsaved();
  });

  _setupArrangeViewsTouch(grid, hiddenZone);
}

/** Touch-based drag support for mobile devices */
function _setupArrangeViewsTouch(grid, hiddenZone) {
  var touchItem = null;
  var touchClone = null;
  var startX = 0;
  var startY = 0;
  var allContainers = [grid, hiddenZone];

  function attachTouchToItem(item) {
    item.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      touchItem = item;

      setTimeout(function() {
        if (!touchItem) return;
        touchClone = item.cloneNode(true);
        touchClone.style.position = 'fixed';
        touchClone.style.zIndex = '99999';
        touchClone.style.opacity = '0.8';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.width = item.offsetWidth + 'px';
        touchClone.style.left = (startX - item.offsetWidth / 2) + 'px';
        touchClone.style.top = (startY - item.offsetHeight / 2) + 'px';
        document.body.appendChild(touchClone);
        item.classList.add('dragging');
      }, 150);
    }, { passive: true });

    item.addEventListener('touchmove', function(e) {
      if (!touchItem || !touchClone) return;
      e.preventDefault();
      var touch = e.touches[0];
      touchClone.style.left = (touch.clientX - touchItem.offsetWidth / 2) + 'px';
      touchClone.style.top = (touch.clientY - touchItem.offsetHeight / 2) + 'px';

      var target = _getViewItemAtPointAll(allContainers, touch.clientX, touch.clientY, touchItem);
      grid.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
      hiddenZone.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
      if (target) {
        var rect = target.getBoundingClientRect();
        var midX = rect.left + rect.width / 2;
        if (touch.clientX < midX) {
          target.style.borderLeft = '3px solid #8b5a2b';
        } else {
          target.style.borderRight = '3px solid #8b5a2b';
        }
      }
    }, { passive: false });

    item.addEventListener('touchend', function(e) {
      if (!touchItem) return;
      item.classList.remove('dragging');

      if (touchClone) {
        var touch = e.changedTouches[0];
        var target = _getViewItemAtPointAll(allContainers, touch.clientX, touch.clientY, touchItem);
        var draggedView = touchItem.dataset.view;

        if (target && target !== touchItem) {
          var targetView = target.dataset.view;
          var targetInGrid = grid.contains(target);
          var rect = target.getBoundingClientRect();
          var midX = rect.left + rect.width / 2;
          var insertBefore = touch.clientX < midX;

          _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
          _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });

          if (targetInGrid) {
            var targetIdx = _currentViewOrder.indexOf(targetView);
            if (!insertBefore) targetIdx++;
            _currentViewOrder.splice(targetIdx, 0, draggedView);
          } else {
            var targetIdx = _hiddenViews.indexOf(targetView);
            if (!insertBefore) targetIdx++;
            _hiddenViews.splice(targetIdx, 0, draggedView);
          }

          _renderArrangeViewsGrid();
          setSaveButtonUnsaved();
        } else {
          var gridRect = grid.getBoundingClientRect();
          var hiddenRect = hiddenZone.getBoundingClientRect();
          if (touch.clientX >= hiddenRect.left && touch.clientX <= hiddenRect.right &&
              touch.clientY >= hiddenRect.top && touch.clientY <= hiddenRect.bottom) {
            _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
            _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });
            _hiddenViews.push(draggedView);
            _renderArrangeViewsGrid();
            setSaveButtonUnsaved();
          } else if (touch.clientX >= gridRect.left && touch.clientX <= gridRect.right &&
                     touch.clientY >= gridRect.top && touch.clientY <= gridRect.bottom) {
            _currentViewOrder = _currentViewOrder.filter(function(v) { return v !== draggedView; });
            _hiddenViews = _hiddenViews.filter(function(v) { return v !== draggedView; });
            _currentViewOrder.push(draggedView);
            _renderArrangeViewsGrid();
            setSaveButtonUnsaved();
          }
        }

        document.body.removeChild(touchClone);
        touchClone = null;
      }

      grid.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
      hiddenZone.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
      touchItem = null;
    });

    item.addEventListener('touchcancel', function() {
      if (touchClone) {
        document.body.removeChild(touchClone);
        touchClone = null;
      }
      if (touchItem) {
        touchItem.classList.remove('dragging');
        touchItem = null;
      }
      grid.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
      hiddenZone.querySelectorAll('.view-tab-item').forEach(function(el) { el.style.borderLeft = ''; el.style.borderRight = ''; });
    });
  }

  grid.querySelectorAll('.view-tab-item').forEach(attachTouchToItem);
  hiddenZone.querySelectorAll('.view-tab-item').forEach(attachTouchToItem);
}

/** Find the view-tab-item element at a given point across multiple containers */
function _getViewItemAtPointAll(containers, x, y, exclude) {
  for (var c = 0; c < containers.length; c++) {
    var items = containers[c].querySelectorAll('.view-tab-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i] === exclude) continue;
      var rect = items[i].getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return items[i];
      }
    }
  }
  return null;
}

/** Collect the current view order for saving — only includes visible tabs */
function _collectViewOrder() {
  if (!_currentViewOrder || _currentViewOrder.length === 0) {
    if (_hiddenViews && _hiddenViews.length > 0) return JSON.stringify([]);
    return null;
  }
  if (_hiddenViews.length === 0 && JSON.stringify(_currentViewOrder) === JSON.stringify(_defaultViewOrder)) return null;
  return JSON.stringify(_currentViewOrder);
}
