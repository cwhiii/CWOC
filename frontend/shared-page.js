/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Shared Page Components
   Auto-injects header (matching main views page) and footer.
   
   Usage: Add these attributes to your <body> tag:
     data-page-title="Page Title"     (required — shown after "Omni Chits ·")
     data-page-icon="🗑️"              (optional emoji before subtitle)
     data-hide-nav="settings"         (optional, comma-separated nav buttons to hide)
   
   Include at end of <body>:
     <script src="/frontend/shared-page.js"></script>
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  const body = document.body;
  const pageTitle = body.dataset.pageTitle || document.title;
  const pageIcon = body.dataset.pageIcon || '';
  const hideNav = (body.dataset.hideNav || '').split(',').map(s => s.trim());

  // ── Build Header (matches main page .header) ──
  const header = document.createElement('div');
  header.className = 'cwoc-page-header';

  // Logo — same as main page: 80px circle with brown border
  const logo = document.createElement('img');
  logo.src = '/static/cwod_logo.png';
  logo.alt = "C.W.'s Omni Chits";
  logo.title = "Back to Chits";
  logo.className = 'cwoc-logo';
  logo.onclick = () => { window.location.href = '/'; };
  header.appendChild(logo);

  // Title — "Omni Chits" main + subtitle
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

  // Nav buttons
  const nav = document.createElement('div');
  nav.className = 'cwoc-nav-buttons';
  const buttons = [
    { id: 'home', label: 'Chits', icon: 'fas fa-home', href: '/' },
    { id: 'settings', label: 'Settings', icon: 'fas fa-cog', href: '/frontend/settings.html' },
    { id: 'help', label: 'Help', icon: 'fas fa-question-circle', href: '/frontend/help.html' },
    { id: 'trash', label: 'Trash', icon: 'fas fa-trash', href: '/frontend/trash.html', hidden: true },
  ];
  // Show trash button only if data-show-nav includes "trash"
  const showNav = (body.dataset.showNav || '').split(',').map(s => s.trim());
  buttons.forEach(b => {
    if (b.hidden && !showNav.includes(b.id)) return;
    if (hideNav.includes(b.id)) return;
    // Don't show link to current page
    if (b.href !== '/' && window.location.pathname.endsWith(b.href.split('/').pop())) return;
    const a = document.createElement('a');
    a.className = 'cwoc-btn';
    a.href = b.href;
    if (b.id === 'home') {
      a.onclick = (e) => {
        e.preventDefault();
        const returnUrl = localStorage.getItem('cwoc_settings_return');
        window.location.href = returnUrl || '/';
      };
    }
    a.innerHTML = `<i class="${b.icon}"></i> ${b.label}`;
    nav.appendChild(a);
  });
  header.appendChild(nav);

  // Insert header as first child of body
  body.insertBefore(header, body.firstChild);

  // ── Build Footer ──
  const footer = document.createElement('div');
  footer.className = 'cwoc-page-footer';
  footer.innerHTML = "C.W.'s Omni Chits &mdash; Built with ☕ and 🎵";
  body.appendChild(footer);
})();
