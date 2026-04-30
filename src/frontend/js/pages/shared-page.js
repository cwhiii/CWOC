/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Shared Page Components
   
   1. CwocSaveSystem — shared save/cancel button logic for any page
   2. Auto-header/footer injection (only runs if body has data-page-title)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Shared save/cancel button system.
 * Manages the "Saved / Save & Stay / Save & Exit / Cancel|Exit" pattern
 * used by both the chit editor and settings page.
 *
 * Usage:
 *   const save = new CwocSaveSystem({
 *     singleBtnId:   'save-single-btn',   // the greyed-out "Saved" button
 *     stayBtnId:     'save-stay-btn',      // "Save & Stay" button
 *     exitBtnId:     'save-exit-btn',      // "Save & Exit" button
 *     cancelSelector: '.cancel-settings',  // CSS selector for cancel/exit button
 *     getReturnUrl:   () => localStorage.getItem('cwoc_settings_return') || '/',
 *   });
 *
 *   save.markSaved();    // after successful save
 *   save.markUnsaved();  // when any field changes
 *   save.hasChanges();   // returns boolean
 *   save.cancelOrExit(); // handles exit with unsaved-changes prompt
 */
class CwocSaveSystem {
  constructor(opts) {
    this._hasUnsaved = false;
    this._singleBtnId = opts.singleBtnId;
    this._stayBtnId = opts.stayBtnId;
    this._exitBtnId = opts.exitBtnId;
    this._cancelSelector = opts.cancelSelector;
    this._getReturnUrl = opts.getReturnUrl || (() => '/');
  }

  hasChanges() { return this._hasUnsaved; }

  markSaved() {
    this._hasUnsaved = false;
    const single = document.getElementById(this._singleBtnId);
    const stay = document.getElementById(this._stayBtnId);
    const exit = document.getElementById(this._exitBtnId);
    const cancel = document.querySelector(this._cancelSelector);

    if (single) { single.style.display = ''; single.disabled = true; single.style.opacity = '0.6'; single.style.pointerEvents = 'none'; single.innerHTML = '✅ Saved'; }
    if (stay) stay.style.display = 'none';
    if (exit) exit.style.display = 'none';
    if (cancel) cancel.textContent = 'Exit';
  }

  markUnsaved() {
    this._hasUnsaved = true;
    const single = document.getElementById(this._singleBtnId);
    const stay = document.getElementById(this._stayBtnId);
    const exit = document.getElementById(this._exitBtnId);
    const cancel = document.querySelector(this._cancelSelector);

    if (single) single.style.display = 'none';
    if (stay) { stay.style.display = ''; stay.disabled = false; stay.style.opacity = '1'; stay.style.pointerEvents = 'auto'; }
    if (exit) { exit.style.display = ''; exit.disabled = false; exit.style.opacity = '1'; exit.style.pointerEvents = 'auto'; }
    if (cancel) cancel.textContent = '❌ Cancel';
  }

  cancelOrExit() {
    const url = this._getReturnUrl();
    if (this._hasUnsaved) {
      // Show confirm modal (parchment-styled)
      const existing = document.getElementById('cwoc-unsaved-modal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'cwoc-unsaved-modal';
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Unsaved Changes</h3>
          <p>You have unsaved changes. Are you sure you want to leave?</p>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="standard-button" id="cwoc-stay-here">Stay Here</button>
            <button class="standard-button" id="cwoc-confirm-exit">Exit Without Saving</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('cwoc-confirm-exit').onclick = () => { window.location.href = url; };
      document.getElementById('cwoc-stay-here').onclick = () => { modal.remove(); };
      // ESC closes the modal
      const onKey = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
      document.addEventListener('keydown', onKey);
    } else {
      window.location.href = url;
    }
  }
}

// Export globally
window.CwocSaveSystem = CwocSaveSystem;


/* ═══════════════════════════════════════════════════════════════════════════
   Auto-header/footer injection — only runs if body has data-page-title

   Generates the SAME structure as the original manual headers:
     .settings-panel > .header-and-buttons > h2 (logo + title) + .header-buttons (nav)
   and appends .author-info footer after .settings-panel.
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {
  var body = document.body;
  if (!body.dataset.pageTitle) return;

  var pageTitle = body.dataset.pageTitle;
  var pageIcon = body.dataset.pageIcon || '';
  var hideNav = (body.dataset.hideNav || '').split(',').map(function(s) { return s.trim(); });
  var showNav = (body.dataset.showNav || '').split(',').map(function(s) { return s.trim(); });

  // Find .settings-panel — the header goes INSIDE it as the first child
  var panel = document.querySelector('.settings-panel');
  if (!panel) return;

  // ── Build header (matches original .header-and-buttons structure) ──
  var header = document.createElement('div');
  header.className = 'header-and-buttons';

  var h2 = document.createElement('h2');
  var logo = document.createElement('img');
  logo.src = '/static/cwod_logo.png';
  logo.alt = 'Logo';
  h2.appendChild(logo);
  h2.appendChild(document.createTextNode(' ' + (pageIcon ? pageIcon + ' ' : '') + pageTitle));
  header.appendChild(h2);

  var navDiv = document.createElement('div');
  navDiv.className = 'header-buttons';

  var buttons = [
    { id: 'home', label: '🏠 Chits', href: '/' },
    { id: 'help', label: '❓ Help', href: '/frontend/html/help.html' },
  ];

  buttons.forEach(function(b) {
    // Don't show button for the current page
    if (b.href !== '/' && window.location.pathname.indexOf(b.href.split('/').pop()) !== -1) return;
    var btn = document.createElement('button');
    btn.className = 'standard-button';
    btn.textContent = b.label;
    btn.onclick = function() {
      if (b.id === 'home') {
        window.location.href = localStorage.getItem('cwoc_settings_return') || '/';
      } else {
        window.location.href = b.href;
      }
    };
    navDiv.appendChild(btn);
  });

  // ── Profile Menu (rightmost element — profile image with dropdown) ──
  var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

  var profileMenuWrap = document.createElement('div');
  profileMenuWrap.className = 'cwoc-profile-menu';
  profileMenuWrap.id = 'cwoc-profile-menu';

  var profileBtn = document.createElement('button');
  profileBtn.className = 'cwoc-profile-btn';
  profileBtn.id = 'cwoc-profile-btn';
  profileBtn.title = currentUser ? currentUser.username : 'User';
  profileBtn.onclick = function(e) {
    e.stopPropagation();
    _cwocToggleProfileMenu();
  };

  var profileImg = document.createElement('img');
  profileImg.src = '/static/default-avatar.svg';
  profileImg.alt = 'Profile';
  profileImg.className = 'cwoc-profile-img';
  profileBtn.appendChild(profileImg);
  profileMenuWrap.appendChild(profileBtn);

  navDiv.appendChild(profileMenuWrap);

  header.appendChild(navDiv);
  panel.insertBefore(header, panel.firstChild);

  // If auth wasn't ready yet, update the profile button tooltip once it is
  if (!currentUser && typeof waitForAuth === 'function') {
    waitForAuth().then(function(user) {
      if (user) {
        var btn = document.getElementById('cwoc-profile-btn');
        if (btn) btn.title = user.username;
      }
    });
  }

  // ── Build footer (matches original .author-info structure) ──
  var footer = document.createElement('div');
  footer.className = 'author-info';
  footer.innerHTML = '&copy; 2026 <a href="https://www.cwholemaniii.com/pages/home.shtml" target="_blank">C.W.\'s Omni Chits</a> &middot; <span id="cwoc-footer-version"></span>';
  panel.parentNode.insertBefore(footer, panel.nextSibling);

  // Fetch version for footer
  fetch('/api/version').then(function(r) { return r.ok ? r.json() : {}; }).then(function(d) {
    var el = document.getElementById('cwoc-footer-version');
    if (el && d.version) el.textContent = 'v' + d.version;
  }).catch(function() {});

  // ── ESC to go back (all secondary pages) ──────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // Don't navigate if a modal or nav panel is open
    if (document.querySelector('.modal[style*="flex"], .qr-modal[style*="flex"], .image-modal[style*="flex"], .import-modal[style*="flex"]')) return;
    if (document.getElementById('cwoc-nav-overlay')) return;
    if (document.getElementById('cwoc-confirm-modal')) return;
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      active.blur();
      return;
    }
    // Navigate back
    var returnUrl = localStorage.getItem('cwoc_settings_return') || '/';
    window.location.href = returnUrl;
  });
})();


/* ═══════════════════════════════════════════════════════════════════════════
   Profile Menu — profile image dropdown with Switch User, View Profile, Logout

   Used by the auto-header injection above and the dashboard top bar.
   The profile image sits in the top-right corner of every page. Clicking it
   opens a dropdown with three options. "Switch User" opens a user list modal
   with password prompt. Available on all pages via shared-page.js and on the
   dashboard via inline HTML.
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {

  /**
   * Toggle the profile dropdown menu.
   */
  function _toggleProfileMenu() {
    var existing = document.getElementById('cwoc-profile-dropdown');
    if (existing) {
      existing.remove();
      return;
    }

    var menuWrap = document.getElementById('cwoc-profile-menu');
    if (!menuWrap) return;

    var dropdown = document.createElement('div');
    dropdown.id = 'cwoc-profile-dropdown';
    dropdown.className = 'cwoc-profile-dropdown';

    var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    var displayName = currentUser ? currentUser.display_name : 'User';
    var username = currentUser ? currentUser.username : '';

    // Header with user info — show display name and username
    var header = document.createElement('div');
    header.className = 'cwoc-profile-dropdown-header';
    header.innerHTML = '<strong>' + _escHtml(displayName) + '</strong>';
    if (username && username !== displayName) {
      header.innerHTML += '<br><span style="font-size:0.85em;opacity:0.7;">@' + _escHtml(username) + '</span>';
    }
    dropdown.appendChild(header);

    // Menu items
    var items = [
      { icon: '🔄', label: 'Switch User', action: function() { dropdown.remove(); _showSwitchUserModal(); } },
      { icon: '👤', label: 'View Profile', action: function() { dropdown.remove(); window.location.href = '/profile'; } },
      { icon: '🚪', label: 'Logout', action: function() { dropdown.remove(); _logout(); } }
    ];

    items.forEach(function(item) {
      var el = document.createElement('div');
      el.className = 'cwoc-profile-dropdown-item';
      el.textContent = item.icon + ' ' + item.label;
      el.onclick = function(e) {
        e.stopPropagation();
        item.action();
      };
      dropdown.appendChild(el);
    });

    menuWrap.appendChild(dropdown);

    // Close dropdown when clicking outside
    function _onDocClick(e) {
      if (!menuWrap.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', _onDocClick, true);
      }
    }
    setTimeout(function() {
      document.addEventListener('click', _onDocClick, true);
    }, 0);
  }

  /**
   * Show the switch user modal — lists all active users, prompts for password.
   */
  function _showSwitchUserModal() {
    // Remove any existing modal
    var existingModal = document.getElementById('cwoc-switch-modal');
    if (existingModal) existingModal.remove();

    var overlay = document.createElement('div');
    overlay.id = 'cwoc-switch-modal';
    overlay.className = 'modal';
    overlay.style.display = 'flex';

    var content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = '<h3>🔄 Switch User</h3><div id="cwoc-switch-user-list" class="cwoc-switch-user-list"><div class="cwoc-user-dropdown-loading">Loading users…</div></div>';

    // Cancel button
    var cancelRow = document.createElement('div');
    cancelRow.className = 'modal-buttons';
    cancelRow.innerHTML = '<button class="standard-button" id="cwoc-switch-modal-cancel">Cancel</button>';
    content.appendChild(cancelRow);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    document.getElementById('cwoc-switch-modal-cancel').onclick = function() { overlay.remove(); };

    // ESC closes the modal
    function _onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        overlay.remove();
        document.removeEventListener('keydown', _onKey, true);
      }
    }
    document.addEventListener('keydown', _onKey, true);

    // Fetch users
    var listDiv = document.getElementById('cwoc-switch-user-list');
    fetch('/api/auth/switchable-users').then(function(r) {
      if (!r.ok) {
        listDiv.innerHTML = '<div class="cwoc-user-dropdown-empty">Unable to load users</div>';
        return null;
      }
      return r.json();
    }).then(function(users) {
      if (!users) return;

      var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      var currentId = currentUser ? currentUser.user_id : null;

      // Filter to active users, exclude current user
      var activeOthers = users.filter(function(u) {
        return u.id !== currentId;
      });

      listDiv.innerHTML = '';

      if (activeOthers.length === 0) {
        listDiv.innerHTML = '<div class="cwoc-user-dropdown-empty">No other users available</div>';
        return;
      }

      activeOthers.forEach(function(u) {
        var item = document.createElement('div');
        item.className = 'cwoc-switch-user-item';
        item.innerHTML = '<img src="' + (u.profile_image_url ? _escHtml(u.profile_image_url) : '/static/default-avatar.svg') + '" class="cwoc-switch-user-avatar" alt="" />' +
          '<span class="cwoc-switch-user-name">' + _escHtml(u.display_name) + '</span>' +
          '<span class="cwoc-switch-user-username">(' + _escHtml(u.username) + ')</span>';
        item.onclick = function(e) {
          e.stopPropagation();
          // Replace the user list with a password prompt for this user
          _showPasswordPromptInModal(overlay, content, u);
        };
        listDiv.appendChild(item);
      });
    }).catch(function() {
      listDiv.innerHTML = '<div class="cwoc-user-dropdown-empty">Unable to load users</div>';
    });
  }

  /**
   * Replace the modal content with a password prompt for the selected user.
   */
  function _showPasswordPromptInModal(overlay, content, targetUser) {
    content.innerHTML =
      '<h3>🔐 Switch to ' + _escHtml(targetUser.display_name) + '</h3>' +
      '<p>Enter the password for <strong>' + _escHtml(targetUser.username) + '</strong>:</p>' +
      '<input type="password" id="cwoc-switch-password" class="cwoc-switch-password-input" placeholder="Password" autocomplete="off" />' +
      '<div id="cwoc-switch-error" class="cwoc-switch-error"></div>' +
      '<div class="modal-buttons">' +
        '<button class="standard-button" id="cwoc-switch-back">← Back</button>' +
        '<button class="standard-button" id="cwoc-switch-confirm">Switch</button>' +
      '</div>';

    var passwordInput = document.getElementById('cwoc-switch-password');
    var errorDiv = document.getElementById('cwoc-switch-error');
    var confirmBtn = document.getElementById('cwoc-switch-confirm');
    var backBtn = document.getElementById('cwoc-switch-back');

    setTimeout(function() { passwordInput.focus(); }, 50);

    backBtn.onclick = function() {
      overlay.remove();
      _showSwitchUserModal();
    };

    passwordInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        _doSwitch();
      }
    });

    confirmBtn.onclick = function() { _doSwitch(); };

    function _doSwitch() {
      var password = passwordInput.value.trim();
      if (!password) {
        errorDiv.textContent = 'Please enter a password.';
        return;
      }

      errorDiv.textContent = '';
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Switching…';

      fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUser.username, password: password })
      }).then(function(r) {
        if (r.ok) {
          window.location.reload();
          return;
        }
        return r.json().then(function(data) {
          if (r.status === 429) {
            errorDiv.textContent = data.detail || 'Too many attempts. Please wait.';
          } else {
            errorDiv.textContent = data.detail || 'Invalid password.';
          }
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Switch';
        });
      }).catch(function() {
        errorDiv.textContent = 'Network error. Please try again.';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Switch';
      });
    }
  }

  /**
   * Simple HTML escaping for user-provided strings.
   */
  function _escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Logout: POST /api/auth/logout, then redirect to /login.
   */
  function _logout() {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function() {
        window.location.href = '/login';
      })
      .catch(function() {
        window.location.href = '/login';
      });
  }

  // Export globally
  window._cwocToggleProfileMenu = _toggleProfileMenu;
  window._cwocLogout = _logout;

  // Auto-initialize profile button tooltip and image on any page
  function _initProfileTooltip() {
    var btn = document.getElementById('cwoc-profile-btn');
    var img = document.getElementById('cwoc-profile-img');
    if (!btn) return;
    var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (user) {
      btn.title = user.username;
      if (user.profile_image_url && img) img.src = user.profile_image_url;
    } else if (typeof waitForAuth === 'function') {
      waitForAuth().then(function(u) {
        if (u && btn) btn.title = u.username;
        if (u && u.profile_image_url && img) img.src = u.profile_image_url;
      });
    }
  }
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initProfileTooltip);
  } else {
    _initProfileTooltip();
  }

})();


/* ═══════════════════════════════════════════════════════════════════════════
   Navigate Panel (V hotkey) — available on all pages that load shared-page.js
   On the dashboard, main.js uses the native hotkey-panel system instead.
   On special pages, this creates a matching overlay + panel.
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {
  var _navPages = [
    { key: '1', icon: '🏠', label: 'Chits',       href: '/' },
    { key: '2', icon: '🌤️', label: 'Weather',     href: '/frontend/html/weather.html' },
    { key: '3', icon: '👥', label: 'Contacts',    href: '/frontend/html/people.html' },
    { key: '4', icon: '❓', label: 'Help',        href: '/frontend/html/help.html' },
    { key: '5', icon: '⚙️', label: 'Settings',    href: '/frontend/html/settings.html' },
    { key: '6', icon: '📋', label: 'Audit Log',   href: '/frontend/html/audit-log.html' },
    { key: '7', icon: '🗑️', label: 'Trash',       href: '/frontend/html/trash.html' },
    { key: '8', icon: '👤', label: 'Profile',     href: '/profile' },
  ];

  // Conditionally add User Admin for admin users
  if (typeof isAdmin === 'function' && isAdmin()) {
    _navPages.push({ key: '9', icon: '👥', label: 'User Admin', href: '/user-admin' });
  } else if (typeof waitForAuth === 'function') {
    // Auth may not be ready yet — add it once we know
    waitForAuth().then(function(user) {
      if (user && user.is_admin) {
        _navPages.push({ key: '9', icon: '👥', label: 'User Admin', href: '/user-admin' });
      }
    });
  }

  // Skip on dashboard — main.js handles V with the native panel system
  var _isDashboard = (window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname.endsWith('/index.html'));

  function _isNavPanelOpen() {
    return !!document.getElementById('cwoc-nav-overlay');
  }

  function _closeNavPanel() {
    var overlay = document.getElementById('cwoc-nav-overlay');
    if (overlay) overlay.remove();
    var panel = document.getElementById('cwoc-nav-panel');
    if (panel) panel.remove();
  }

  function _navigateTo(href) {
    _closeNavPanel();
    window.location.href = href;
  }

  function _openNavPanel() {
    if (_isNavPanelOpen()) { _closeNavPanel(); return; }

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'cwoc-nav-overlay';
    overlay.onclick = _closeNavPanel;
    document.body.appendChild(overlay);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'cwoc-nav-panel';

    var h3 = document.createElement('h3');
    h3.textContent = '🧭 Navigate';
    panel.appendChild(h3);

    _navPages.forEach(function(p) {
      var isCurrent = false;
      if (p.href === '/' && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
        isCurrent = true;
      } else if (p.href !== '/' && window.location.pathname.indexOf(p.href.split('/').pop()) !== -1) {
        isCurrent = true;
      }

      var row = document.createElement('div');
      row.className = 'cwoc-nav-option' + (isCurrent ? ' current' : '');

      var keySpan = document.createElement('span');
      keySpan.className = 'cwoc-nav-key';
      keySpan.textContent = p.key;
      row.appendChild(keySpan);

      var labelSpan = document.createElement('span');
      labelSpan.className = 'cwoc-nav-label';
      labelSpan.textContent = p.icon + '  ' + p.label;
      row.appendChild(labelSpan);

      if (!isCurrent) {
        row.onclick = function() { _navigateTo(p.href); };
      }
      panel.appendChild(row);
    });

    var footer = document.createElement('div');
    footer.className = 'cwoc-nav-footer';
    footer.textContent = 'Number keys to jump · ESC to cancel';
    panel.appendChild(footer);

    document.body.appendChild(panel);
  }

  // Export globally
  window.cwocOpenNavModal = _openNavPanel;
  window.cwocCloseNavModal = _closeNavPanel;
  window.cwocIsNavModalOpen = _isNavPanelOpen;

  // Keydown handler (special pages only — dashboard uses main.js)
  document.addEventListener('keydown', function(e) {
    var key = e.key;
    var keyLower = key.toLowerCase();
    var active = document.activeElement;
    var inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);

    // ESC closes the nav panel
    if (key === 'Escape' && _isNavPanelOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      _closeNavPanel();
      return;
    }

    // Number keys navigate when panel is open
    if (_isNavPanelOpen() && key >= '1' && key <= '9') {
      e.preventDefault();
      for (var i = 0; i < _navPages.length; i++) {
        if (_navPages[i].key === key) {
          _navigateTo(_navPages[i].href);
          return;
        }
      }
      return;
    }

    // V to open (not when typing, not on dashboard, not with modifier keys)
    if (keyLower === 'v' && !inInput && !_isDashboard && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!_isNavPanelOpen() && document.querySelector('.modal[style*="flex"]')) return;
      e.preventDefault();
      _openNavPanel();
    }
  });
})();
