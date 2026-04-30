/**
 * main-hotkeys.js — Hotkey mode state machine, overlay panels, and keyboard event dispatcher.
 *
 * Contains:
 *   - Panel show/hide helpers (_showPanel, _hideAllPanels, _dimSidebar, _undimSidebar)
 *   - Hotkey mode exit (_exitHotkeyMode)
 *   - Navigate panel handler (_pickNav, _navTargets)
 *   - Period panel handler (_pickPeriod)
 *   - Enabled periods logic (_applyEnabledPeriods)
 *   - Filter sub-panel entry (_enterFilterSub, _buildFilterSubPanel)
 *   - Reference overlay toggle (_toggleReference, _closeReference, openHelpPage)
 *   - Keyboard event dispatcher (document keydown listener in main-init.js)
 *
 * Depends on globals from main.js: _hotkeyMode, currentTab, currentView, currentWeekStart,
 *   currentSortField, currentSortDir, _enabledPeriods, _customDaysCount, _weekViewDayOffset
 * Depends on main-sidebar.js: expandSidebarSection, expandFilterGroup, _buildTagFilterPanel,
 *   _renderPeopleFilterPanel, onFilterAnyToggle, onFilterSpecificToggle, onFilterChange
 */

/* ── Panel show/hide ─────────────────────────────────────────────────────── */

function _showPanel(panelId) {
  document.getElementById('hotkey-overlay')?.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
}

function _hideAllPanels() {
  document.getElementById('hotkey-overlay')?.classList.remove('active');
  document.querySelectorAll('.hotkey-panel').forEach(function(p) { p.classList.remove('active'); });
}

function _dimSidebar(activeId, activeFilterGroupId) {
  // Now uses full-screen overlay + floating panels instead of sidebar dimming
}

function _undimSidebar() {
  _hideAllPanels();
}

function _exitHotkeyMode() {
  _hotkeyMode = null;
  _hideAllPanels();
}

/* ── Navigate panel handler ──────────────────────────────────────────────── */

var _navTargets = ['/', '/frontend/html/weather.html', '/frontend/html/people.html', '/frontend/html/help.html', '/frontend/html/settings.html', '/frontend/html/audit-log.html', '/frontend/html/trash.html', '/profile', '/user-admin'];

function _pickNav(href) {
  _exitHotkeyMode();
  if (href === '/') {
    return;
  }
  storePreviousState();
  window.location.href = href;
}

/* ── Period panel handler ────────────────────────────────────────────────── */

function _pickPeriod(period) {
  if (!_enabledPeriods.includes(period)) return;
  _weekViewDayOffset = 0;
  currentView = period;
  var sel = document.getElementById('period-select');
  if (sel) sel.value = currentView;
  if (currentView === 'SevenDay') currentWeekStart = new Date();
  updateDateRange();
  displayChits();
  _exitHotkeyMode();
}

/** Apply enabled periods: hide disabled options in dropdown, grey out in panels/reference */
function _applyEnabledPeriods() {
  var xLabel = _customDaysCount + ' Days';
  var sel = document.getElementById('period-select');
  if (sel) {
    Array.from(sel.options).forEach(function(opt) {
      if (opt.value === 'SevenDay') opt.textContent = xLabel;
      opt.disabled = !_enabledPeriods.includes(opt.value);
      opt.style.display = _enabledPeriods.includes(opt.value) ? '' : 'none';
    });
  }

  var panel = document.getElementById('panel-period');
  if (panel) {
    panel.querySelectorAll('.hotkey-panel-option').forEach(function(opt) {
      var onclick = opt.getAttribute('onclick') || '';
      var match = onclick.match(/_pickPeriod\('(\w+)'\)/);
      if (match) {
        var period = match[1];
        if (period === 'SevenDay') {
          var labelEl = opt.querySelector('.panel-label');
          if (labelEl) labelEl.textContent = xLabel;
        }
        if (_enabledPeriods.includes(period)) {
          opt.style.opacity = '';
          opt.style.cursor = '';
          opt.title = '';
        } else {
          opt.style.opacity = '0.35';
          opt.style.cursor = 'not-allowed';
          opt.title = 'This period is disabled in Settings';
        }
      }
    });
  }

  var refOverlay = document.getElementById('reference-overlay');
  if (refOverlay) {
    var periodMap = { 'I': 'Itinerary', 'D': 'Day', 'W': 'Week', 'K': 'Work', 'S': 'SevenDay', 'M': 'Month', 'Y': 'Year' };
    // Search both old (.ref-col div) and new (.ref-item) structures
    refOverlay.querySelectorAll('.ref-item, .ref-col div').forEach(function(div) {
      var keyEl = div.querySelector('.ref-key');
      if (!keyEl) return;
      var key = keyEl.textContent.trim();
      var period = periodMap[key];
      if (period !== undefined) {
        if (_enabledPeriods.includes(period)) {
          div.style.opacity = '';
          div.style.cursor = '';
          div.title = '';
        } else {
          div.style.opacity = '0.35';
          div.style.cursor = 'not-allowed';
          div.title = 'This period is disabled in Settings';
        }
      }
    });
  }
}

/* ── Filter sub-panel entry ──────────────────────────────────────────────── */

function _enterFilterSub(type) {
  _hideAllPanels();
  if (type === 'status') {
    _hotkeyMode = 'FILTER_STATUS';
    expandFilterGroup('filter-status');
    _buildFilterSubPanel('panel-status-options', '#status-multi input[data-filter="status"]');
    _showPanel('panel-filter-status');
  } else if (type === 'label') {
    _hotkeyMode = 'FILTER_LABEL';
    expandFilterGroup('filter-label');
    _buildTagFilterPanel();
    _showPanel('panel-filter-label');
  } else if (type === 'priority') {
    _hotkeyMode = 'FILTER_PRIORITY';
    expandFilterGroup('filter-priority');
    _buildFilterSubPanel('panel-priority-options', '#priority-multi input[data-filter="priority"]');
    _showPanel('panel-filter-priority');
  } else if (type === 'people') {
    _hotkeyMode = 'FILTER_PEOPLE';
    expandFilterGroup('filter-people');
    if (window._cachedPeopleContacts) _renderPeopleFilterPanel(window._cachedPeopleContacts);
    _showPanel('panel-filter-people');
  }
}

function _buildFilterSubPanel(containerId, checkboxSelector) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  var boxes = document.querySelectorAll(checkboxSelector);
  var maxItems = Math.min(boxes.length, 9);
  for (var i = 0; i < maxItems; i++) {
    var cb = boxes[i];
    var label = cb.value || (cb.dataset.any ? '— Any' : '—');
    var div = document.createElement('div');
    div.className = 'hotkey-panel-option' + (cb.checked ? ' selected' : '');
    div.innerHTML = '<span class="panel-key">' + (i + 1) + '</span><span class="panel-label">' + label + '</span>';
    (function(cbRef, divRef) {
      divRef.onclick = function() {
        cbRef.checked = !cbRef.checked;
        divRef.classList.toggle('selected', cbRef.checked);
        if (cbRef.dataset.any) {
          onFilterAnyToggle(cbRef);
        } else {
          var filterType = cbRef.dataset.filter;
          if (filterType) onFilterSpecificToggle(filterType);
        }
        onFilterChange();
      };
    })(cb, div);
    container.appendChild(div);
  }
}

/* ── Reference overlay ───────────────────────────────────────────────────── */

function openHelpPage() {
  storePreviousState();
  window.location.href = '/frontend/html/help.html';
}

function _toggleReference() {
  var overlay = document.getElementById('reference-overlay');
  if (!overlay) return;
  overlay.classList.toggle('active');
}

function _closeReference() {
  var overlay = document.getElementById('reference-overlay');
  if (overlay) overlay.classList.remove('active');
}
