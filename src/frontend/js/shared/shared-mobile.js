/**
 * shared-mobile.js — Mobile UI behavior.
 *
 * Handles mobile-specific interactions:
 *   - Sidebar overlay (backdrop, swipe open/close)
 *   - Mobile actions modal (editor header buttons)
 *   - Long-press handler (mobile quick edit)
 *   - Mobile views button (replaces tab bar on mobile)
 *   - Mobile reference close button
 *
 * Loaded BEFORE shared.js.
 */

// ── Mobile Sidebar Overlay Behavior ──────────────────────────────────────────

/** @type {HTMLElement|null} Cached reference to the sidebar backdrop element */
var _sidebarBackdropEl = null;

/**
 * Ensure the .sidebar-backdrop element exists in the DOM.
 * Reuses an existing one if present; otherwise creates and appends it to <body>.
 * @returns {HTMLElement} The backdrop element
 */
function _ensureSidebarBackdrop() {
  if (_sidebarBackdropEl && document.body.contains(_sidebarBackdropEl)) {
    return _sidebarBackdropEl;
  }
  _sidebarBackdropEl = document.querySelector('.sidebar-backdrop');
  if (!_sidebarBackdropEl) {
    _sidebarBackdropEl = document.createElement('div');
    _sidebarBackdropEl.className = 'sidebar-backdrop';
    document.body.appendChild(_sidebarBackdropEl);
  }
  // Attach click handler (idempotent — remove first to avoid duplicates)
  _sidebarBackdropEl.removeEventListener('click', _onSidebarBackdropClick);
  _sidebarBackdropEl.addEventListener('click', _onSidebarBackdropClick);
  return _sidebarBackdropEl;
}

/**
 * Handle click on the sidebar backdrop — close sidebar and hide backdrop.
 */
function _onSidebarBackdropClick() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
  }
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Show the sidebar backdrop (only meaningful at ≤768px where CSS makes it visible).
 */
function _showSidebarBackdrop() {
  const backdrop = _ensureSidebarBackdrop();
  backdrop.classList.add('active');
}

/**
 * Hide the sidebar backdrop.
 */
function _hideSidebarBackdrop() {
  if (_sidebarBackdropEl) {
    _sidebarBackdropEl.classList.remove('active');
  }
}

/**
 * Check if the current viewport is in mobile/tablet overlay mode (≤768px).
 * @returns {boolean}
 */
function _isMobileOverlay() {
  return window.innerWidth <= 768;
}

/**
 * Initialize mobile sidebar overlay behavior.
 * - On ≤768px: sidebar defaults to closed on page load
 * - Creates/manages the .sidebar-backdrop element
 * - Adds a visible close button inside the sidebar for mobile
 * - Listens for resize events to handle crossing the 768px boundary
 *
 * Call this once from DOMContentLoaded (e.g., in main.js).
 * Does NOT call toggleSidebar — it only sets up the overlay infrastructure.
 */
function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Ensure backdrop element exists
  _ensureSidebarBackdrop();

  // Add a close button inside the sidebar for mobile (only once)
  if (!sidebar.querySelector('.sidebar-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.innerHTML = '✕ Close';
    closeBtn.setAttribute('aria-label', 'Close sidebar');
    closeBtn.addEventListener('click', function () {
      _onSidebarBackdropClick();
    });
    sidebar.insertBefore(closeBtn, sidebar.firstChild);
  }

  // On page load at ≤768px: force sidebar closed
  if (_isMobileOverlay()) {
    sidebar.classList.remove('active');
    localStorage.setItem('sidebarState', 'closed');
    _hideSidebarBackdrop();
  }

  // ── Touch swipe to open/close sidebar ──────────────────────────────
  var _swipeStartX = 0;
  var _swipeStartY = 0;
  var _swipeTracking = false;
  var SWIPE_THRESHOLD = 50;
  var EDGE_ZONE = 30; // px from left edge to start swipe-open

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _swipeStartX = touch.clientX;
    _swipeStartY = touch.clientY;
    // Only track swipe-open if starting from left edge, or swipe-close if sidebar is open
    _swipeTracking = (touch.clientX < EDGE_ZONE) || sidebar.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_swipeTracking || !_isMobileOverlay()) { _swipeTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _swipeStartX;
    var dy = Math.abs(touch.clientY - _swipeStartY);
    _swipeTracking = false;

    // Only count horizontal swipes (dx > dy)
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx > 0 && !sidebar.classList.contains('active') && _swipeStartX < EDGE_ZONE) {
      // Swipe right from left edge → open sidebar (only if views panel is NOT open)
      var viewsPanel = document.querySelector('.mobile-views-panel');
      if (viewsPanel && viewsPanel.classList.contains('active')) return;
      sidebar.classList.add('active');
      localStorage.setItem('sidebarState', 'open');
      _showSidebarBackdrop();
    } else if (dx < 0 && sidebar.classList.contains('active')) {
      // Swipe left → close sidebar
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }
  }, { passive: true });

  // Listen for resize to handle crossing the 768px boundary
  let _prevWasMobile = _isMobileOverlay();
  window.addEventListener('resize', function _onMobileSidebarResize() {
    const isMobile = _isMobileOverlay();

    // Crossing from desktop → mobile: close sidebar, hide backdrop
    if (isMobile && !_prevWasMobile) {
      sidebar.classList.remove('active');
      localStorage.setItem('sidebarState', 'closed');
      _hideSidebarBackdrop();
    }

    // Crossing from mobile → desktop: hide backdrop (sidebar state stays as-is)
    if (!isMobile && _prevWasMobile) {
      _hideSidebarBackdrop();
    }

    // If still mobile and sidebar is open, ensure backdrop is shown
    if (isMobile && sidebar.classList.contains('active')) {
      _showSidebarBackdrop();
    }

    _prevWasMobile = isMobile;
  });
}


// ── Mobile Actions Modal (editor header buttons) ─────────────────────────────

/**
 * On mobile (≤768px), hide the .buttons container in .header-row and show
 * a single "☰ Actions" trigger button. Tapping it opens a full-screen modal
 * with all the original buttons cloned and stacked vertically.
 *
 * Call once from DOMContentLoaded on editor pages.
 */
function initMobileActionsModal() {
  var headerRow = document.querySelector('.header-row');
  var buttonsDiv = headerRow && headerRow.querySelector('.buttons');
  if (!headerRow || !buttonsDiv) return;

  // Create the trigger button (hidden at desktop via CSS)
  var trigger = document.createElement('button');
  trigger.className = 'mobile-actions-trigger';
  trigger.innerHTML = '☰ Actions';
  trigger.addEventListener('click', function () { _openMobileActionsModal(); });
  headerRow.appendChild(trigger);

  // Create the modal container (hidden by default)
  var modal = document.createElement('div');
  modal.id = 'mobile-actions-modal';
  modal.className = 'mobile-actions-modal';
  modal.innerHTML = '<div class="mobile-actions-modal-content">' +
    '<h3>Actions</h3>' +
    '<div class="mobile-actions-list"></div>' +
    '<button class="mobile-actions-close">✕ Close</button>' +
    '</div>';
  document.body.appendChild(modal);

  modal.querySelector('.mobile-actions-close').addEventListener('click', function () {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('active');
  });
}

function _openMobileActionsModal() {
  var modal = document.getElementById('mobile-actions-modal');
  if (!modal) return;
  var list = modal.querySelector('.mobile-actions-list');
  list.innerHTML = '';

  // Grab all buttons from the header .buttons container (works even when hidden by CSS)
  var buttonsDiv = document.querySelector('.header-row .buttons');
  if (!buttonsDiv) return;

  var buttons = buttonsDiv.querySelectorAll('button');
  buttons.forEach(function (btn) {
    // Skip disabled "Saved" indicator buttons (any page)
    if (btn.disabled && btn.style.pointerEvents === 'none') return;
    // Skip buttons hidden by save-state logic (display:none means not relevant right now)
    if (btn.style.display === 'none') return;
    var clone = document.createElement('button');
    clone.className = 'mobile-action-btn ' + (btn.className || '');
    clone.innerHTML = btn.innerHTML;
    clone.disabled = btn.disabled;

    // Extract the onclick handler — call it directly instead of btn.click()
    // (btn.click() can fail on elements inside display:none containers)
    var onclickAttr = btn.getAttribute('onclick');
    clone.addEventListener('click', function () {
      modal.classList.remove('active');
      if (onclickAttr) {
        // Execute the onclick attribute string
        new Function(onclickAttr).call(btn);
      } else {
        // Fallback: dispatch click on the original
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    list.appendChild(clone);
  });

  modal.classList.add('active');
}


// ── Long-press to simulate shift-click (mobile quick edit) ───────────────────

/**
 * Attach a long-press handler to an element. On mobile, a long press
 * triggers the callback (used to open quick edit modal, same as shift-click).
 * Cancels if the finger moves (drag) or lifts early (tap).
 *
 * DEPRECATED: Prefer enableTouchGesture() from shared-touch.js for new code.
 * This function remains for elements that only need long-press without drag
 * (e.g. calendar events which have their own drag system).
 *
 * Uses centralized timing from shared-touch.js (TOUCH_LONGPRESS_HOLD_MS).
 *
 * @param {HTMLElement} el - The element to attach to
 * @param {Function} callback - Called on successful long press, receives the element
 */
function enableLongPress(el, callback) {
  if (!el || !callback) return;
  var _lpTimer = null;
  var _lpFired = false;
  var _startX = 0;
  var _startY = 0;
  var HOLD_MS = (typeof TOUCH_LONGPRESS_HOLD_MS !== 'undefined') ? TOUCH_LONGPRESS_HOLD_MS : 800;
  var MOVE_THRESHOLD = (typeof TOUCH_DRAG_MOVE_THRESHOLD !== 'undefined') ? TOUCH_DRAG_MOVE_THRESHOLD : 10;

  el.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    // Don't start long-press if a drag operation is in progress
    if (window._touchDragActive) return;
    _lpFired = false;
    _startX = e.touches[0].clientX;
    _startY = e.touches[0].clientY;
    _lpTimer = setTimeout(function () {
      // Re-check drag state — a drag may have started during the hold period
      if (window._touchDragActive || window._dragJustEnded) { _lpTimer = null; return; }
      _lpFired = true;
      // Haptic feedback — use _cwocVibrate for Android compat
      if (typeof _cwocVibrate === 'function') {
        _cwocVibrate(200);
      } else if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      callback(el);
    }, HOLD_MS);
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    if (!_lpTimer) return;
    var dx = e.touches[0].clientX - _startX;
    var dy = e.touches[0].clientY - _startY;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearTimeout(_lpTimer);
      _lpTimer = null;
    }
  }, { passive: true });

  el.addEventListener('touchend', function (e) {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    // If long press fired, prevent the subsequent click/tap
    if (_lpFired) {
      e.preventDefault();
      _lpFired = false;
    }
  });

  el.addEventListener('touchcancel', function () {
    clearTimeout(_lpTimer);
    _lpTimer = null;
    _lpFired = false;
  });
}


// ── Mobile Views Button (replaces tab bar on mobile) ─────────────────────────

/**
 * On mobile (≤480px), add a "Views" button next to the header title.
 * Tapping it opens a full-screen dropdown with the 6 C CAPTN tabs.
 * The original .tabs row is hidden via CSS.
 *
 * Call once from DOMContentLoaded on the dashboard page.
 */
function initMobileViewsButton() {
  var header = document.querySelector('.header');
  if (!header) return;

  // Tab button in header, pushed to right edge via margin-left:auto
  var btn = document.createElement('button');
  btn.className = 'mobile-views-btn';
  btn.id = 'mobile-views-btn';
  // Show current view name instead of generic "Views"
  btn.textContent = '☰ ' + (typeof currentTab !== 'undefined' && currentTab ? currentTab : 'Views');
  header.appendChild(btn);

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'mobile-views-backdrop';
  document.body.appendChild(backdrop);

  // Slide-in panel
  var panel = document.createElement('div');
  panel.className = 'mobile-views-panel';
  panel.innerHTML = '<h3>Views</h3>';

  // Build options from the existing tabs
  var tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(function (tab) {
    var opt = document.createElement('div');
    opt.className = 'mobile-view-option';
    if (tab.classList.contains('active')) opt.classList.add('active');
    opt.innerHTML = tab.innerHTML;
    opt.addEventListener('click', function () {
      _closeViewsPanel();
      tab.click();
      panel.querySelectorAll('.mobile-view-option').forEach(function (o) { o.classList.remove('active'); });
      opt.classList.add('active');
    });
    panel.appendChild(opt);
  });

  var closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-views-close';
  closeBtn.textContent = '✕ Close';
  closeBtn.addEventListener('click', function () { _closeViewsPanel(); });
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);

  function _openViewsPanel() {
    // Refresh active state
    var currentTabs = document.querySelectorAll('.tabs .tab');
    var opts = panel.querySelectorAll('.mobile-view-option');
    currentTabs.forEach(function (t, i) {
      if (opts[i]) {
        opts[i].classList.toggle('active', t.classList.contains('active'));
      }
    });
    backdrop.classList.add('active');
    panel.classList.add('active');
  }

  function _closeViewsPanel() {
    panel.classList.remove('active');
    backdrop.classList.remove('active');
  }

  btn.addEventListener('click', _openViewsPanel);
  backdrop.addEventListener('click', _closeViewsPanel);

  // ── Swipe from right edge to open, swipe right to close ────────────
  var _vsStartX = 0, _vsStartY = 0, _vsTracking = false;
  var EDGE_ZONE = 25; // px from right edge
  var SWIPE_THRESHOLD = 40;

  document.addEventListener('touchstart', function (e) {
    if (!_isMobileOverlay()) return;
    var touch = e.touches[0];
    _vsStartX = touch.clientX;
    _vsStartY = touch.clientY;
    var fromRightEdge = window.innerWidth - touch.clientX < EDGE_ZONE;
    _vsTracking = fromRightEdge || panel.classList.contains('active');
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_vsTracking || !_isMobileOverlay()) { _vsTracking = false; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _vsStartX;
    var dy = Math.abs(touch.clientY - _vsStartY);
    _vsTracking = false;
    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) return;

    if (dx < 0 && !panel.classList.contains('active') && (window.innerWidth - _vsStartX) < EDGE_ZONE) {
      // Swipe left from right edge → open (only if sidebar is NOT open)
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) return;
      _openViewsPanel();
    } else if (dx > 0 && panel.classList.contains('active')) {
      // Swipe right → close
      _closeViewsPanel();
    }
  }, { passive: true });
}

/**
 * Update the mobile Views button label to show the current tab name.
 * Called from filterChits() and on initial load after state restore.
 */
function _updateMobileViewsLabel() {
  var btn = document.getElementById('mobile-views-btn');
  if (!btn) return;
  var label = (typeof currentTab !== 'undefined' && currentTab) ? currentTab : 'Views';
  btn.textContent = '☰ ' + label;
}


// ── Mobile Reference Close Button ────────────────────────────────────────────

/**
 * Add a close button inside the reference overlay content for mobile.
 * On desktop, clicking outside the content closes it. On mobile the content
 * fills the screen so there's no outside area to tap.
 */
function initMobileReferenceClose() {
  var content = document.querySelector('.reference-content');
  if (!content) return;
  if (content.querySelector('.ref-close-btn')) return; // already added

  var btn = document.createElement('button');
  btn.className = 'ref-close-btn';
  btn.textContent = '✕ Close';
  btn.style.cssText = 'display:block;width:100%;margin-top:12px;padding:10px;' +
    'font-size:1em;font-weight:bold;font-family:Lora, Georgia, serif;' +
    'background:#8b5a2b;color:#fff8e1;border:1px solid #5a3f2a;border-radius:4px;' +
    'cursor:pointer;min-height:44px;';
  btn.addEventListener('click', function () {
    if (typeof _closeReference === 'function') _closeReference();
  });
  content.appendChild(btn);
}
