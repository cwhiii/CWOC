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
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {
  const body = document.body;
  if (!body.dataset.pageTitle) return; // Skip if no data-page-title

  const pageTitle = body.dataset.pageTitle;
  const pageIcon = body.dataset.pageIcon || '';
  const hideNav = (body.dataset.hideNav || '').split(',').map(s => s.trim());

  const header = document.createElement('div');
  header.className = 'cwoc-page-header';

  const logo = document.createElement('img');
  logo.src = '/static/cwod_logo.png';
  logo.alt = "C.W.'s Omni Chits";
  logo.title = "Back to Chits";
  logo.className = 'cwoc-logo';
  logo.onclick = () => { window.location.href = '/'; };
  header.appendChild(logo);

  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex:1;';
  const mainTitle = document.createElement('h1');
  mainTitle.className = 'cwoc-page-title';
  mainTitle.textContent = 'Omni Chits';
  const subtitle = document.createElement('div');
  subtitle.style.cssText = 'font-size:0.45em;opacity:0.7;margin-top:2px;';
  subtitle.textContent = `${pageIcon ? pageIcon + ' ' : ''}${pageTitle}`;
  mainTitle.appendChild(subtitle);
  titleWrap.appendChild(mainTitle);
  header.appendChild(titleWrap);

  const nav = document.createElement('div');
  nav.className = 'cwoc-nav-buttons';
  const buttons = [
    { id: 'home', label: 'Chits', icon: 'fas fa-home', href: '/' },
    { id: 'settings', label: 'Settings', icon: 'fas fa-cog', href: '/frontend/settings.html' },
    { id: 'help', label: 'Help', icon: 'fas fa-question-circle', href: '/frontend/help.html' },
    { id: 'audit-log', label: 'Audit Log', icon: 'fas fa-clipboard-list', href: '/frontend/audit-log.html' },
    { id: 'trash', label: 'Trash', icon: 'fas fa-trash', href: '/frontend/trash.html', hidden: true },
  ];
  const showNav = (body.dataset.showNav || '').split(',').map(s => s.trim());
  buttons.forEach(b => {
    if (b.hidden && !showNav.includes(b.id)) return;
    if (hideNav.includes(b.id)) return;
    if (b.href !== '/' && window.location.pathname.endsWith(b.href.split('/').pop())) return;
    const a = document.createElement('a');
    a.className = 'cwoc-btn';
    a.href = b.href;
    if (b.id === 'home') {
      a.onclick = (e) => { e.preventDefault(); window.location.href = localStorage.getItem('cwoc_settings_return') || '/'; };
    }
    a.innerHTML = `<i class="${b.icon}"></i> ${b.label}`;
    nav.appendChild(a);
  });
  header.appendChild(nav);
  body.insertBefore(header, body.firstChild);

  const footer = document.createElement('div');
  footer.className = 'cwoc-page-footer';
  footer.innerHTML = '<a href="https://www.cwholemaniii.com/pages/home.shtml" target="_blank" style="color:#5c4033;text-decoration:none;">C.W.</a>\'s Omni Chits';
  body.appendChild(footer);

  // ── ESC to go back (all secondary pages) ──────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // Don't navigate if a modal is open or an input is focused
    if (document.querySelector('.modal[style*="flex"], .qr-modal[style*="flex"], .image-modal[style*="flex"], .import-modal[style*="flex"]')) return;
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
