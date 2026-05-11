/**
 * editor-mobile-zones.js — Mobile swipe-based zone navigation for the chit editor.
 *
 * On mobile (≤768px), transforms the editor into a single-zone-at-a-time view
 * with swipe navigation:
 *   - Swipe left/right on zone header → next/previous zone
 *   - Swipe left on zone body → exit controls (actions modal)
 *   - Swipe right on zone body → zone list overlay
 *   - Zone header is sticky at top of viewport
 *   - Zone list shows all zones, greyed out if empty, still clickable
 *
 * Zone order (user-specified start, then logical remainder):
 *   Date, Task, Note, Checklist, Tags, People, Location, Alerts, Projects, Color, Health, Attachments
 *
 * Starts on the zone matching the source tab (same logic as _collapseAllZonesForNewChit).
 *
 * Desktop is completely unaffected — this only activates at ≤768px.
 *
 * Depends on: editor-init.js (toggleZone, _collapseAllZonesForNewChit),
 *             shared-mobile.js (_isMobileOverlay, _openMobileActionsModal)
 * Loaded after: editor-init.js, before editor.js
 */

/* ── Zone Registry ────────────────────────────────────────────────────────── */

/**
 * Ordered list of zones for mobile navigation.
 * User-specified order: Date, Task, Note, Checklist first, then logical remainder.
 * Each entry: { id: sectionId, contentId: bodyId, label: display name, icon: emoji }
 */
var _mobileZoneOrder = [
  { id: 'titleZone',              contentId: 'titleWeatherContainer', label: 'Title',             icon: '✏️',  isTitle: true },
  { id: 'datesSection',            contentId: 'datesContent',            label: 'Dates & Times',     icon: '🗓️' },
  { id: 'taskSection',             contentId: 'taskContent',             label: 'Task',              icon: '📋' },
  { id: 'notesSection',            contentId: 'notesContent',            label: 'Notes',             icon: '📝' },
  { id: 'checklistSection',        contentId: 'checklistContent',        label: 'Checklist',         icon: '☑️' },
  { id: 'tagsSection',             contentId: 'tagsContent',             label: 'Tags',              icon: '🏷️' },
  { id: 'peopleSection',           contentId: 'peopleContent',           label: 'People',            icon: '👥' },
  { id: 'locationSection',         contentId: 'locationContent',         label: 'Location',          icon: '📍' },
  { id: 'alertsSection',           contentId: 'alertsContent',           label: 'Alerts',            icon: '🔔' },
  { id: 'projectsSection',        contentId: 'projectsContent',         label: 'Projects',          icon: '📂' },
  { id: 'colorSection',            contentId: 'colorContent',            label: 'Color',             icon: '🎨' },
  { id: 'healthIndicatorsSection', contentId: 'healthIndicatorsContent', label: 'Indicators',        icon: '❤️' },
  { id: 'attachmentsSection',      contentId: 'attachmentsContent',      label: 'Attachments',       icon: '📎' },
  { id: 'emailSection',            contentId: 'emailContent',            label: 'Email',             icon: '✉️' },
  { id: 'habitLogSection',         contentId: 'habitLogContent',         label: 'Habits',            icon: '🎯' },
];

/** Current zone index in mobile view */
var _mobileCurrentZoneIdx = 0;

/** Whether mobile zone mode is active */
var _mobileZoneModeActive = false;

/** The sticky zone header element */
var _mobileZoneHeaderEl = null;

/** The zone list overlay element */
var _mobileZoneListEl = null;

/** The zone list backdrop */
var _mobileZoneListBackdrop = null;

/* ── Tab → Zone Mapping (same as _collapseAllZonesForNewChit) ─────────────── */

var _mobileTabZoneMap = {
  'Calendar':   'datesSection',
  'Checklists': 'checklistSection',
  'Alarms':     'alertsSection',
  'Projects':   'checklistSection',
  'Tasks':      'taskSection',
  'Notes':      'notesSection',
  'Email':      'emailSection',
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Get the list of currently visible zones (filters out hidden ones like
 * habitLogSection when not a habit, emailSection when not email, etc.)
 */
function _getMobileVisibleZones() {
  return _mobileZoneOrder.filter(function(z) {
    // Title zone is always visible
    if (z.isTitle) return true;
    var el = document.getElementById(z.id);
    if (!el) return false;
    // Check if the zone is hidden by app logic (not by our mobile zone system).
    // Zones hidden by app logic have style.display='none' WITHOUT our data attribute.
    // Also check computed style for zones hidden via initial HTML style attribute.
    if (el.style.display === 'none' && !el.hasAttribute('data-mobile-zone-hidden')) return false;
    // For zones that start hidden in HTML (e.g. habitLogSection, emailSection),
    // check if they were never made visible by app logic
    if (!el.hasAttribute('data-mobile-zone-hidden')) {
      var computed = window.getComputedStyle(el);
      if (computed.display === 'none') return false;
    }
    return true;
  });
}

/**
 * Check if a zone has meaningful content (for greying out in zone list).
 */
function _isZoneEmpty(zoneInfo) {
  var id = zoneInfo.id;

  // Title: check if title field is empty
  if (id === 'titleZone') {
    var title = document.getElementById('title');
    return !title || !title.value.trim();
  }

  // Dates: check if date mode is "none"
  if (id === 'datesSection') {
    var noneRadio = document.getElementById('dateModeNone');
    return noneRadio && noneRadio.checked;
  }

  // Task: check if status is empty
  if (id === 'taskSection') {
    var status = document.getElementById('status');
    return !status || !status.value;
  }

  // Notes: check if note textarea is empty
  if (id === 'notesSection') {
    var note = document.getElementById('note');
    return !note || !note.value.trim();
  }

  // Checklist: check if there are any checklist items
  if (id === 'checklistSection') {
    var container = document.getElementById('checklist-container');
    if (!container) return true;
    var items = container.querySelectorAll('.checklist-item');
    return items.length === 0;
  }

  // Tags: check if any tags selected
  if (id === 'tagsSection') {
    return !window._currentTagSelection || window._currentTagSelection.length === 0;
  }

  // People: check if people field has content
  if (id === 'peopleSection') {
    var people = document.getElementById('people');
    var chips = document.querySelectorAll('#peopleContent .people-chip');
    return (!people || !people.value.trim()) && chips.length === 0;
  }

  // Location: check if location field has content
  if (id === 'locationSection') {
    var loc = document.getElementById('location');
    return !loc || !loc.value.trim();
  }

  // Alerts: check if any alerts exist
  if (id === 'alertsSection') {
    var alertsData = window._alertsData;
    if (!alertsData) return true;
    return (!alertsData.alarms || alertsData.alarms.length === 0) &&
           (!alertsData.timers || alertsData.timers.length === 0) &&
           (!alertsData.stopwatches || alertsData.stopwatches.length === 0) &&
           (!alertsData.notifications || alertsData.notifications.length === 0);
  }

  // Projects: check if child chits exist
  if (id === 'projectsSection') {
    return !window._loadedChildChits || window._loadedChildChits.length === 0;
  }

  // Color: check if color is not transparent
  if (id === 'colorSection') {
    var colorInput = document.getElementById('color');
    return !colorInput || !colorInput.value || colorInput.value === 'transparent';
  }

  // Health: check if any indicators
  if (id === 'healthIndicatorsSection') {
    var healthContent = document.getElementById('healthIndicatorsContent');
    if (!healthContent) return true;
    var entries = healthContent.querySelectorAll('.entry');
    return entries.length === 0;
  }

  // Attachments: check count
  if (id === 'attachmentsSection') {
    var countEl = document.getElementById('attachmentCount');
    return !countEl || countEl.textContent === '0';
  }

  // Email: check if email fields have content
  if (id === 'emailSection') {
    var emailTo = document.getElementById('emailTo');
    return !emailTo || !emailTo.value.trim();
  }

  // Habits: check if habit is enabled
  if (id === 'habitLogSection') {
    var habitCb = document.getElementById('habitEnabled');
    return !habitCb || !habitCb.checked;
  }

  return false;
}

/**
 * Get the starting zone index based on the source tab.
 */
function _getMobileStartZoneIdx() {
  // On refresh, restore the zone the user was viewing (existing chits only)
  var params = new URLSearchParams(window.location.search);
  if (params.get('id')) {
    try {
      var savedZoneId = sessionStorage.getItem('cwoc_mobile_zone_' + params.get('id'));
      if (savedZoneId) {
        var visibleZones = _getMobileVisibleZones();
        for (var i = 0; i < visibleZones.length; i++) {
          if (visibleZones[i].id === savedZoneId) return i;
        }
      }
    } catch (e) { /* ignore */ }
  }

  var sourceTab = 'Calendar';
  try {
    var saved = localStorage.getItem('cwoc_source_tab');
    if (saved) sourceTab = saved;
  } catch (e) { /* ignore */ }

  // If URL has start/end params, force Calendar
  if (params.get('start') || params.get('end')) {
    sourceTab = 'Calendar';
  }

  // For Email tab: find the email zone if visible, otherwise return -1
  // to signal that we should wait for it.
  if (sourceTab === 'Email') {
    var visibleZones = _getMobileVisibleZones();
    for (var i = 0; i < visibleZones.length; i++) {
      if (visibleZones[i].id === 'emailSection') return i;
    }
    return -1; // signal: wait for email zone
  }

  var targetZoneId = _mobileTabZoneMap[sourceTab] || 'datesSection';
  var visibleZones = _getMobileVisibleZones();

  for (var i = 0; i < visibleZones.length; i++) {
    if (visibleZones[i].id === targetZoneId) return i;
  }
  return 0;
}

/* ── Core Navigation ──────────────────────────────────────────────────────── */

/**
 * Show a specific zone by index, hiding all others.
 */
function _mobileShowZone(idx) {
  var visibleZones = _getMobileVisibleZones();
  if (idx < 0) idx = visibleZones.length - 1;
  if (idx >= visibleZones.length) idx = 0;
  _mobileCurrentZoneIdx = idx;

  // Persist current zone so refresh restores it
  var activeZoneEntry = visibleZones[idx];
  if (activeZoneEntry) {
    try {
      var chitIdParam = new URLSearchParams(window.location.search).get('id');
      if (chitIdParam) {
        sessionStorage.setItem('cwoc_mobile_zone_' + chitIdParam, activeZoneEntry.id);
      }
    } catch (e) { /* ignore */ }
  }

  var grid = document.querySelector('.main-zones-grid');
  if (!grid) return;

  // Hide the title container
  var titleContainer = document.getElementById('titleWeatherContainer');
  if (titleContainer) titleContainer.classList.remove('mobile-zone-active');

  // Hide all zone containers in both columns
  var allContainers = grid.querySelectorAll('.zone-container');
  allContainers.forEach(function(el) {
    el.style.display = 'none';
    el.setAttribute('data-mobile-zone-hidden', '1');
  });

  // Show the active zone
  var activeZone = visibleZones[idx];
  if (!activeZone) return;

  if (activeZone.isTitle) {
    // Show the title container as the active zone
    if (titleContainer) {
      titleContainer.classList.add('mobile-zone-active');
      // Inject header controls into title zone if not already there
      _injectTitleZoneControls(titleContainer);
    }
    // Hide both columns
    var colOne = grid.querySelector('.column-one');
    var colTwo = grid.querySelector('.column-two');
    if (colOne) colOne.style.display = 'none';
    if (colTwo) colTwo.style.display = 'none';
  } else {
    // Show a regular zone — expand it
    var section = document.getElementById(activeZone.id);
    var content = document.getElementById(activeZone.contentId);
    if (section) {
      section.style.display = '';
      section.removeAttribute('data-mobile-zone-hidden');
      section.classList.remove('collapsed');
      var icon = section.querySelector('.zone-toggle-icon');
      if (icon) icon.textContent = '🔼';
      section.querySelectorAll('.zone-button:not(.zone-button-persist)').forEach(function(btn) {
        btn.style.display = '';
      });

      // Make sure the parent column is visible, hide the other
      var parentCol = section.closest('.column-one, .column-two');
      if (parentCol) parentCol.style.display = 'block';
      var colOne = grid.querySelector('.column-one');
      var colTwo = grid.querySelector('.column-two');
      if (parentCol === colOne && colTwo) colTwo.style.display = 'none';
      if (parentCol === colTwo && colOne) colOne.style.display = 'none';
    }
    if (content) {
      content.style.display = '';
    }
  }

  // Update sticky header
  _updateMobileZoneHeader(activeZone, idx, visibleZones.length);

  // Update zone list active state
  _updateMobileZoneListActive(activeZone.id);

  // Scroll editor to top
  var editorEl = document.getElementById('mainEditor');
  if (editorEl) editorEl.scrollTop = 0;
}

/**
 * Navigate to next zone.
 */
function _mobileNextZone() {
  var visibleZones = _getMobileVisibleZones();
  var next = _mobileCurrentZoneIdx + 1;
  if (next >= visibleZones.length) next = 0;
  _mobileShowZone(next);
}

/**
 * Navigate to previous zone.
 */
function _mobilePrevZone() {
  var visibleZones = _getMobileVisibleZones();
  var prev = _mobileCurrentZoneIdx - 1;
  if (prev < 0) prev = visibleZones.length - 1;
  _mobileShowZone(prev);
}

/* ── Sticky Zone Header ───────────────────────────────────────────────────── */

/**
 * Create the sticky mobile zone header element.
 */
function _createMobileZoneHeader() {
  if (_mobileZoneHeaderEl) return _mobileZoneHeaderEl;

  var header = document.createElement('div');
  header.id = 'mobile-zone-nav-header';
  header.className = 'mobile-zone-nav-header';
  header.innerHTML =
    '<button class="mobile-zone-nav-prev" aria-label="Actions menu">☰</button>' +
    '<span class="mobile-zone-nav-title"></span>' +
    '<span class="mobile-zone-nav-counter"></span>' +
    '<button class="mobile-zone-nav-next" aria-label="Zones menu">☰</button>';

  header.querySelector('.mobile-zone-nav-prev').addEventListener('click', function(e) {
    e.stopPropagation();
    _openMobileActionsSidebar();
  });
  header.querySelector('.mobile-zone-nav-next').addEventListener('click', function(e) {
    e.stopPropagation();
    _openMobileZoneList();
  });

  // Insert at the top of body (before the editor, after any hidden header)
  var editor = document.getElementById('mainEditor');
  if (editor) {
    editor.parentNode.insertBefore(header, editor);
  } else {
    document.body.insertBefore(header, document.body.firstChild);
  }

  _mobileZoneHeaderEl = header;
  return header;
}

/**
 * Update the sticky header content.
 */
function _updateMobileZoneHeader(zoneInfo, idx, total) {
  if (!_mobileZoneHeaderEl) return;
  var title = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-title');
  var counter = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-counter');
  var nextBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-next');
  var prevBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-prev');

  // Show chit title (truncated) in center
  var chitTitle = '';
  var titleInput = document.getElementById('title');
  if (titleInput && titleInput.value.trim()) {
    chitTitle = titleInput.value.trim();
  }

  if (title) {
    title.innerHTML = '<span class="mobile-zone-nav-chit-title">' +
      (chitTitle ? chitTitle : 'New Chit') + '</span>';
  }
  if (counter) counter.textContent = (idx + 1) + '/' + total;

  // Put zone name in the right hamburger button (like dashboard Views button)
  if (nextBtn) {
    nextBtn.textContent = '☰ ' + zoneInfo.label;
  }

  // Apply chit color as nav bar background with contrasting text
  _applyMobileNavBarColor();
}

/**
 * Apply the chit's color to the mobile nav bar background.
 * Uses contrastColorForBg for readable text/button colors.
 */
function _applyMobileNavBarColor() {
  if (!_mobileZoneHeaderEl) return;
  var colorInput = document.getElementById('color');
  var bgColor = (colorInput && colorInput.value && colorInput.value !== 'transparent')
    ? colorInput.value : '';

  if (bgColor) {
    var textColor = contrastColorForBg(bgColor);
    _mobileZoneHeaderEl.style.backgroundColor = bgColor;
    _mobileZoneHeaderEl.style.backgroundImage = 'none';
    _mobileZoneHeaderEl.style.color = textColor;

    // Style the title and counter
    var titleEl = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-title');
    var counterEl = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-counter');
    if (titleEl) titleEl.style.color = textColor;
    if (counterEl) counterEl.style.color = textColor;

    // Style the buttons with a slightly darker/lighter variant
    var prevBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-prev');
    var nextBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-next');
    [prevBtn, nextBtn].forEach(function(btn) {
      if (!btn) return;
      btn.style.backgroundColor = textColor;
      btn.style.color = bgColor;
      btn.style.borderColor = textColor;
    });
  } else {
    // Reset to default parchment theme
    _mobileZoneHeaderEl.style.backgroundColor = '';
    _mobileZoneHeaderEl.style.backgroundImage = '';
    _mobileZoneHeaderEl.style.color = '';

    var titleEl = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-title');
    var counterEl = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-counter');
    if (titleEl) titleEl.style.color = '';
    if (counterEl) counterEl.style.color = '';

    var prevBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-prev');
    var nextBtn = _mobileZoneHeaderEl.querySelector('.mobile-zone-nav-next');
    [prevBtn, nextBtn].forEach(function(btn) {
      if (!btn) return;
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    });
  }
}

/**
 * Inject header action controls into the title zone on mobile.
 * Only shows: QR, Log, Nest.
 * Save/Exit/Delete/Archive/Snooze buttons are in the side menu only.
 * Only creates them once; subsequent calls just ensure they're visible.
 */
function _injectTitleZoneControls(titleContainer) {
  if (titleContainer.querySelector('.mobile-title-zone-controls')) return;

  var controlsDiv = document.createElement('div');
  controlsDiv.className = 'mobile-title-zone-controls';

  // Add nest button if it's visible
  var nestBtn = document.getElementById('nestButton');
  if (nestBtn && nestBtn.style.display !== 'none') {
    var nestClone = document.createElement('button');
    nestClone.className = 'mobile-title-zone-btn';
    nestClone.innerHTML = '<img src="/static/nest.svg" style="height:1.2em;vertical-align:middle;" alt="" /> Nest';
    nestClone.addEventListener('click', function() {
      if (typeof _nestButtonClick === 'function') _nestButtonClick();
    });
    controlsDiv.appendChild(nestClone);
  }

  // Grab buttons from the header .buttons container — only show QR and Log
  // (Save, Save & Stay, Save & Exit, Cancel/Exit, Delete, Archive, Snooze go in the side menu only)
  var buttonsDiv = document.querySelector('.header-row .buttons');
  if (!buttonsDiv) return;

  // IDs/identifiers for buttons that belong in the title zone (QR and Log only)
  var titleZoneIds = ['qrButton', 'headerAuditBtn'];

  var buttons = buttonsDiv.querySelectorAll('button');
  buttons.forEach(function(btn) {
    if (btn.disabled && btn.style.pointerEvents === 'none') return;
    if (btn.style.display === 'none') return;

    // Only include buttons that belong in the title zone
    if (titleZoneIds.indexOf(btn.id) === -1) return;

    var clone = document.createElement('button');
    clone.className = 'mobile-title-zone-btn';
    clone.innerHTML = btn.innerHTML;
    clone.disabled = btn.disabled;
    if (btn.classList.contains('delete')) clone.classList.add('danger');
    if (btn.classList.contains('cancel')) clone.classList.add('cancel');

    var onclickAttr = btn.getAttribute('onclick');
    clone.addEventListener('click', function() {
      if (onclickAttr) {
        new Function(onclickAttr).call(btn);
      } else {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    controlsDiv.appendChild(clone);
  });

  titleContainer.appendChild(controlsDiv);
}

/* ── Zone List Overlay ────────────────────────────────────────────────────── */

/**
 * Create the zone list overlay (slide-in panel from right).
 */
function _createMobileZoneList() {
  if (_mobileZoneListEl) return;

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-zone-list-backdrop';
  backdrop.addEventListener('click', _closeMobileZoneList);
  document.body.appendChild(backdrop);
  _mobileZoneListBackdrop = backdrop;

  // Panel
  var panel = document.createElement('div');
  panel.className = 'mobile-zone-list-panel';
  panel.innerHTML = '<h3 class="mobile-zone-list-title">Zones</h3>' +
    '<div class="mobile-zone-list-items"></div>' +
    '<button class="mobile-zone-list-close"><span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;overflow:hidden;">⇤</span> Hide Sidebar</button>';

  panel.querySelector('.mobile-zone-list-close').addEventListener('click', _closeMobileZoneList);
  document.body.appendChild(panel);
  _mobileZoneListEl = panel;
}

/**
 * Open the zone list, refreshing items.
 */
function _openMobileZoneList() {
  if (!_mobileZoneListEl) _createMobileZoneList();

  var list = _mobileZoneListEl.querySelector('.mobile-zone-list-items');
  list.innerHTML = '';

  var visibleZones = _getMobileVisibleZones();
  visibleZones.forEach(function(zone, idx) {
    var item = document.createElement('div');
    item.className = 'mobile-zone-list-item';
    if (idx === _mobileCurrentZoneIdx) item.classList.add('active');
    if (_isZoneEmpty(zone)) item.classList.add('empty');

    item.innerHTML = '<span class="mobile-zone-list-icon">' + zone.icon + '</span>' +
      '<span class="mobile-zone-list-label">' + zone.label + '</span>';

    item.addEventListener('click', function() {
      _closeMobileZoneList();
      _mobileShowZone(idx);
    });
    list.appendChild(item);
  });

  _mobileZoneListBackdrop.classList.add('active');
  _mobileZoneListEl.classList.add('active');
}

/**
 * Close the zone list overlay.
 */
function _closeMobileZoneList() {
  if (_mobileZoneListEl) _mobileZoneListEl.classList.remove('active');
  if (_mobileZoneListBackdrop) _mobileZoneListBackdrop.classList.remove('active');
}

/**
 * Update active state in zone list without rebuilding.
 */
function _updateMobileZoneListActive(activeId) {
  if (!_mobileZoneListEl) return;
  var items = _mobileZoneListEl.querySelectorAll('.mobile-zone-list-item');
  var visibleZones = _getMobileVisibleZones();
  items.forEach(function(item, idx) {
    item.classList.toggle('active', visibleZones[idx] && visibleZones[idx].id === activeId);
  });
}

/* ── Left Actions Sidebar ─────────────────────────────────────────────────── */

/** The left actions sidebar element */
var _mobileActionsSidebarEl = null;

/** The left actions sidebar backdrop */
var _mobileActionsSidebarBackdrop = null;

/**
 * Create the left actions sidebar (slides in from left, like dashboard sidebar).
 */
function _createMobileActionsSidebar() {
  if (_mobileActionsSidebarEl) return;

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-actions-sidebar-backdrop';
  backdrop.addEventListener('click', _closeMobileActionsSidebar);
  document.body.appendChild(backdrop);
  _mobileActionsSidebarBackdrop = backdrop;

  // Panel
  var panel = document.createElement('div');
  panel.className = 'mobile-actions-sidebar';
  panel.innerHTML = '<button class="mobile-actions-sidebar-close"><span style="font-size:2.2em;font-weight:900;line-height:0;vertical-align:middle;overflow:hidden;">⇤</span> Hide Sidebar</button>' +
    '<div class="mobile-actions-sidebar-spacer"></div>' +
    '<div class="mobile-actions-sidebar-items"></div>';

  panel.querySelector('.mobile-actions-sidebar-close').addEventListener('click', _closeMobileActionsSidebar);
  document.body.appendChild(panel);
  _mobileActionsSidebarEl = panel;
}

/**
 * Open the left actions sidebar, populating with current header buttons.
 * Excludes QR and Log buttons (those are in the title zone only).
 * Layout: Save/Exit section at top | Snooze in its own section | Archive + Delete at bottom.
 */
function _openMobileActionsSidebar() {
  if (!_mobileActionsSidebarEl) _createMobileActionsSidebar();

  var list = _mobileActionsSidebarEl.querySelector('.mobile-actions-sidebar-items');
  list.innerHTML = '';

  // Grab all buttons from the header .buttons container
  var buttonsDiv = document.querySelector('.header-row .buttons');
  if (!buttonsDiv) return;

  // IDs for buttons excluded from the side menu (they live in the title zone)
  var excludeFromSidebar = ['qrButton', 'headerAuditBtn'];
  // IDs for buttons that go at the very bottom
  var bottomIds = ['archivedButton', 'deleteButton'];
  // Snooze gets its own section
  var snoozeId = 'snoozeButton';

  var normalBtns = [];
  var snoozeBtn = null;
  var bottomBtns = [];

  var buttons = buttonsDiv.querySelectorAll('button');
  buttons.forEach(function(btn) {
    // Skip disabled "Saved" indicator buttons
    if (btn.disabled && btn.style.pointerEvents === 'none') return;
    // Skip buttons hidden by save-state logic
    if (btn.style.display === 'none') return;
    // Skip buttons that belong in the title zone only
    if (excludeFromSidebar.indexOf(btn.id) !== -1) return;

    if (bottomIds.indexOf(btn.id) !== -1) {
      bottomBtns.push(btn);
    } else if (btn.id === snoozeId) {
      snoozeBtn = btn;
    } else {
      normalBtns.push(btn);
    }
  });

  // Helper to create a sidebar button from an original button
  function _makeSidebarBtn(btn) {
    var item = document.createElement('button');
    item.className = 'mobile-actions-sidebar-btn';
    item.innerHTML = btn.innerHTML;
    item.disabled = btn.disabled;

    var onclickAttr = btn.getAttribute('onclick');
    item.addEventListener('click', function() {
      _closeMobileActionsSidebar();
      if (onclickAttr) {
        new Function(onclickAttr).call(btn);
      } else {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    return item;
  }

  // Section 1: Save & Exit buttons at the top
  normalBtns.forEach(function(btn) { list.appendChild(_makeSidebarBtn(btn)); });

  // Spacer between save/exit and snooze
  if (snoozeBtn) {
    var spacer1 = document.createElement('div');
    spacer1.className = 'mobile-actions-sidebar-spacer';
    list.appendChild(spacer1);
  }

  // Section 2: Snooze in its own section
  if (snoozeBtn) list.appendChild(_makeSidebarBtn(snoozeBtn));

  // Spacer between snooze and archive/delete
  if (bottomBtns.length > 0) {
    var spacer2 = document.createElement('div');
    spacer2.className = 'mobile-actions-sidebar-spacer';
    list.appendChild(spacer2);
  }

  // Section 3: Archive and Delete at the bottom
  bottomBtns.forEach(function(btn) { list.appendChild(_makeSidebarBtn(btn)); });

  _mobileActionsSidebarBackdrop.classList.add('active');
  _mobileActionsSidebarEl.classList.add('active');
}

/**
 * Close the left actions sidebar.
 */
function _closeMobileActionsSidebar() {
  if (_mobileActionsSidebarEl) _mobileActionsSidebarEl.classList.remove('active');
  if (_mobileActionsSidebarBackdrop) _mobileActionsSidebarBackdrop.classList.remove('active');
}

/* ── Swipe Handling ───────────────────────────────────────────────────────── */

/**
 * Initialize swipe gestures for mobile zone navigation.
 */
function _initMobileZoneSwipe() {
  var _swStartX = 0;
  var _swStartY = 0;
  var _swStartTime = 0;
  var SWIPE_MIN = 50;
  var SWIPE_MAX_TIME = 500; // ms

  // Swipe on zone header → prev/next zone
  var headerEl = _mobileZoneHeaderEl;
  if (headerEl) {
    headerEl.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      _swStartX = t.clientX;
      _swStartY = t.clientY;
      _swStartTime = Date.now();
    }, { passive: true });

    headerEl.addEventListener('touchend', function(e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - _swStartX;
      var dy = Math.abs(t.clientY - _swStartY);
      var elapsed = Date.now() - _swStartTime;
      if (elapsed > SWIPE_MAX_TIME) return;
      if (Math.abs(dx) < SWIPE_MIN || dy > Math.abs(dx)) return;

      if (dx < 0) {
        _mobileNextZone();
      } else {
        _mobilePrevZone();
      }
    }, { passive: true });
  }

  // Swipe on zone body area → left=zone list, right=actions sidebar
  // Use document-level listener to catch swipes regardless of element boundaries
  var _swFromInput = false;

  document.addEventListener('touchstart', function(e) {
    if (!_mobileZoneModeActive) return;
    if (window._touchDragActive) return;
    // Don't track if overlays are open
    if (_mobileZoneListEl && _mobileZoneListEl.classList.contains('active')) return;
    if (_mobileActionsSidebarEl && _mobileActionsSidebarEl.classList.contains('active')) return;

    var t = e.touches[0];
    _swStartX = t.clientX;
    _swStartY = t.clientY;
    _swStartTime = Date.now();

    // Track if swipe started from an input (to dismiss keyboard on swipe)
    var tag = e.target.tagName;
    _swFromInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!_mobileZoneModeActive) return;
    if (window._touchDragActive) return;
    // Don't act if overlays are open
    if (_mobileZoneListEl && _mobileZoneListEl.classList.contains('active')) return;
    if (_mobileActionsSidebarEl && _mobileActionsSidebarEl.classList.contains('active')) return;

    var t = e.changedTouches[0];
    var dx = t.clientX - _swStartX;
    var dy = Math.abs(t.clientY - _swStartY);
    var elapsed = Date.now() - _swStartTime;
    if (elapsed > SWIPE_MAX_TIME) return;
    if (Math.abs(dx) < SWIPE_MIN || dy > Math.abs(dx)) return;

    // Don't trigger if target is inside the zone nav header (handled separately)
    if (_mobileZoneHeaderEl && _mobileZoneHeaderEl.contains(e.target)) return;

    // Dismiss keyboard if swipe started from an input field
    if (_swFromInput && document.activeElement) {
      document.activeElement.blur();
    }

    if (dx < 0) {
      // Swipe left → open zone list (from right)
      _openMobileZoneList();
    } else {
      // Swipe right → open actions sidebar (from left)
      _openMobileActionsSidebar();
    }
  }, { passive: true });
}

/* ── Activation / Deactivation ────────────────────────────────────────────── */

/**
 * Activate mobile zone mode. Called on page load if mobile, or on resize crossing.
 */
function _activateMobileZoneMode() {
  if (_mobileZoneModeActive) return;
  _mobileZoneModeActive = true;

  // Add class to body for CSS targeting
  document.body.classList.add('mobile-zone-mode');

  // Create UI elements
  _createMobileZoneHeader();
  _createMobileZoneList();
  _createMobileActionsSidebar();

  // Clear any inline display:none left from deactivation so CSS rules take over
  if (_mobileZoneHeaderEl) _mobileZoneHeaderEl.style.display = '';

  // Determine starting zone
  _mobileCurrentZoneIdx = _getMobileStartZoneIdx();

  if (_mobileCurrentZoneIdx === -1) {
    // Target zone not available yet (e.g. email zone loading async).
    // Poll until it becomes available, then show it.
    _waitForTargetZone();
  } else {
    // Show the starting zone immediately
    _mobileShowZone(_mobileCurrentZoneIdx);
  }

  // Initialize swipe
  _initMobileZoneSwipe();

  // Set up menu backdrop for zone-more-menus
  _initMobileMenuBackdrop();
}

/**
 * Poll until the target zone becomes available, then navigate to it.
 * Used when coming from Email tab and the email zone hasn't loaded yet.
 */
function _waitForTargetZone() {
  var attempts = 0;
  var maxAttempts = 50; // 50 * 100ms = 5 seconds max wait
  var interval = setInterval(function() {
    attempts++;
    var idx = _getMobileStartZoneIdx();
    if (idx >= 0) {
      clearInterval(interval);
      _mobileShowZone(idx);
    } else if (attempts >= maxAttempts) {
      // Give up waiting, show title zone
      clearInterval(interval);
      _mobileShowZone(0);
    }
  }, 100);
}

/* ── Mobile Menu Backdrop (blocks interaction when a menu is open) ─────── */

var _mobileMenuBackdropEl = null;

/**
 * Create and manage a backdrop that appears when any .zone-more-menu is open.
 * Blocks all interaction behind the menu and dismisses on tap.
 */
function _initMobileMenuBackdrop() {
  if (_mobileMenuBackdropEl) return;

  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-menu-backdrop';
  backdrop.addEventListener('click', function() {
    _closeMobileMenuBackdrop();
  });
  backdrop.addEventListener('touchend', function(e) {
    e.preventDefault();
    _closeMobileMenuBackdrop();
  });
  document.body.appendChild(backdrop);
  _mobileMenuBackdropEl = backdrop;

  // Observe DOM for zone-more-menu visibility changes
  var observer = new MutationObserver(function() {
    if (!_mobileZoneModeActive) return;
    var openMenu = document.querySelector('.zone-more-menu[style*="display: flex"], .zone-more-menu[style*="display:flex"]');
    if (openMenu) {
      _mobileMenuBackdropEl.classList.add('active');
    } else {
      _mobileMenuBackdropEl.classList.remove('active');
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style'],
    subtree: true
  });
}

function _closeMobileMenuBackdrop() {
  // Close all open zone-more-menus
  var menus = document.querySelectorAll('.zone-more-menu');
  menus.forEach(function(m) { m.style.display = 'none'; });
  if (_mobileMenuBackdropEl) _mobileMenuBackdropEl.classList.remove('active');
}

/**
 * Deactivate mobile zone mode (when resizing to desktop).
 */
function _deactivateMobileZoneMode() {
  if (!_mobileZoneModeActive) return;
  _mobileZoneModeActive = false;

  document.body.classList.remove('mobile-zone-mode');

  // Show title/weather container again
  var titleContainer = document.getElementById('titleWeatherContainer');
  if (titleContainer) {
    titleContainer.classList.remove('mobile-zone-active');
    titleContainer.style.display = '';
  }

  // Hide mobile zone header
  if (_mobileZoneHeaderEl) _mobileZoneHeaderEl.style.display = 'none';

  // Close zone list if open
  _closeMobileZoneList();
  _closeMobileActionsSidebar();

  // Restore all zones to their normal state (show all, respect collapse state)
  var grid = document.querySelector('.main-zones-grid');
  if (grid) {
    // Restore column visibility
    var colOne = grid.querySelector('.column-one');
    var colTwo = grid.querySelector('.column-two');
    if (colOne) colOne.style.display = '';
    if (colTwo) colTwo.style.display = '';

    var allContainers = grid.querySelectorAll('.zone-container');
    allContainers.forEach(function(el) {
      el.removeAttribute('data-mobile-zone-hidden');
      // Restore display based on whether it was hidden by app logic
      var zoneId = el.id;
      if (zoneId === 'habitLogSection') {
        var habitCb = document.getElementById('habitEnabled');
        el.style.display = (habitCb && habitCb.checked) ? '' : 'none';
      } else if (zoneId === 'emailSection') {
        // Email section visibility is managed by email activation logic
        if (!el.classList.contains('email-active')) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
      } else if (zoneId === 'auditLogSection') {
        // Series log — only for recurring chits, managed elsewhere
      } else {
        el.style.display = '';
      }
    });
  }
}

/* ── Initialization ───────────────────────────────────────────────────────── */

/**
 * Initialize mobile zone navigation. Called from DOMContentLoaded.
 * Sets up resize listener to activate/deactivate based on viewport.
 */
function initMobileZoneNav() {
  // Only activate if on mobile
  if (window.innerWidth <= 768) {
    // Delay to let other init code run first (zone collapse, scroll, etc.)
    setTimeout(function() {
      _activateMobileZoneMode();
    }, 200);
  }

  // Listen for resize to toggle mode
  var _prevWasMobileZone = window.innerWidth <= 768;
  window.addEventListener('resize', function() {
    var isMobile = window.innerWidth <= 768;
    if (isMobile && !_prevWasMobileZone) {
      _activateMobileZoneMode();
    } else if (!isMobile && _prevWasMobileZone) {
      _deactivateMobileZoneMode();
    }
    _prevWasMobileZone = isMobile;
  });
}
