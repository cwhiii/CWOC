/* ── main-email.js — Email tab view ─────────────────────────────────────────
 * Renders the Email dashboard tab with inbox-style list view.
 * Loaded by index.html before main.js.
 *
 * Depends on: main-views.js (_buildChitHeader, chitColor, applyChitColors,
 *             storePreviousState), shared-utils.js (getCachedSettings)
 * ────────────────────────────────────────────────────────────────────────── */

/* Email sub-filter state: 'inbox' (default), 'bytag', 'drafts', 'trash' */
var _emailSubFilter = 'inbox';

/* Multi-select state */
var _emailSelectedIds = [];

/* Last checked checkbox index for shift+click range selection */
var _emailLastCheckedIndex = null;

/* Auto-check mail interval timer */
var _emailAutoCheckTimer = null;

/* Account filter state: array of selected account nicknames (empty = show all) */
var _emailAccountFilter = [];

/**
 * Toggle the email sidebar section body visibility.
 */
function _toggleEmailSidebarSection() {
    var body = document.getElementById('sidebar-email-body');
    var arrow = document.getElementById('sidebar-email-toggle-arrow');
    if (!body) return;
    var isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : '';
    if (arrow) arrow.textContent = isVisible ? '▶' : '▼';
}

/**
 * Show or hide the email sidebar section based on the current tab.
 * Called by filterChits when the tab changes.
 */
function _updateEmailSidebarVisibility(tab) {
    var section = document.getElementById('section-email-controls');
    if (!section) return;
    section.style.display = (tab === 'Email') ? '' : 'none';
    // Sync the radio button to the current sub-filter
    if (tab === 'Email') {
        var radios = document.querySelectorAll('#email-folder-select input[name="emailFolder"]');
        radios.forEach(function(r) { r.checked = (r.value === _emailSubFilter); });
        // Populate account filter buttons (ensure settings are loaded first)
        if (window._cwocSettings) {
            _emailRenderAccountFilterButtons();
        } else if (typeof getCachedSettings === 'function') {
            getCachedSettings().then(function() { _emailRenderAccountFilterButtons(); });
        }
    }
}

/**
 * Render account filter pill buttons in the sidebar.
 * Multi-select: clicking toggles that account on/off. Empty selection = show all.
 */
function _emailRenderAccountFilterButtons() {
    var wrap = document.getElementById('email-account-filter-wrap');
    if (!wrap) return;

    var accounts = (window._cwocSettings || {}).email_accounts;
    if (!Array.isArray(accounts) || accounts.length === 0) {
        // Fall back to legacy single account
        var legacy = (window._cwocSettings || {}).email_account;
        if (legacy && typeof legacy === 'object' && legacy.nickname) {
            accounts = [legacy];
        } else {
            wrap.style.display = 'none';
            return;
        }
    }

    // Only show if at least one account has a nickname
    var namedAccounts = accounts.filter(function(a) { return a && a.nickname; });
    if (namedAccounts.length === 0) {
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = '';
    wrap.innerHTML = '';

    namedAccounts.forEach(function(acct) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'email-account-pill';
        var isActive = _emailAccountFilter.indexOf(acct.nickname) !== -1;
        if (isActive) btn.classList.add('active');
        btn.textContent = acct.nickname;
        btn.title = acct.email || acct.nickname;
        btn.addEventListener('click', function() {
            _emailToggleAccountFilter(acct.nickname);
        });
        wrap.appendChild(btn);
    });
}

/**
 * Toggle an account nickname in the filter. Re-renders the email view.
 */
function _emailToggleAccountFilter(nickname) {
    var idx = _emailAccountFilter.indexOf(nickname);
    if (idx === -1) {
        _emailAccountFilter.push(nickname);
    } else {
        _emailAccountFilter.splice(idx, 1);
    }
    _emailRenderAccountFilterButtons();
    // Re-trigger the email view render with the current tab
    if (typeof filterChits === 'function') filterChits('Email');
}

/**
 * Start or restart the auto-check mail timer based on settings.
 * Called after settings are loaded and after each manual check.
 */
function _emailStartAutoCheck() {
    // Clear any existing timer
    if (_emailAutoCheckTimer) {
        clearInterval(_emailAutoCheckTimer);
        _emailAutoCheckTimer = null;
    }

    // Load interval from cached settings
    if (typeof getCachedSettings !== 'function') return;
    getCachedSettings().then(function(settings) {
        // Check email_accounts (multi-account) first, fall back to legacy
        var interval = 'manual';
        var accounts = settings.email_accounts;
        if (Array.isArray(accounts) && accounts.length > 0) {
            interval = accounts[0].check_interval || 'manual';
        } else {
            var acct = settings.email_account;
            if (acct && typeof acct === 'object') interval = acct.check_interval || 'manual';
        }
        if (!interval || interval === 'manual') return;

        var ms = parseInt(interval, 10) * 60 * 1000;
        if (isNaN(ms) || ms < 60000) return;

        _emailAutoCheckTimer = setInterval(function() {
            console.log('[Email] Auto-check mail (interval: ' + interval + 'm)');
            _checkMail();
        }, ms);
        console.log('[Email] Auto-check scheduled every ' + interval + ' min');
    });
}

// Start auto-check when the page loads (after a short delay for settings to load)
setTimeout(_emailStartAutoCheck, 3000);

/**
 * Display email chits in the Email tab list view.
 * @param {Array} chitsToDisplay - Array of chit objects to render
 */
function displayEmailView(chitsToDisplay) {
    var container = document.getElementById('chit-list');
    if (!container) return;
    container.innerHTML = '';
    _emailSelectedIds = [];
    _emailLastCheckedIndex = null;
    _emailRepliedToCache = null; // Rebuild replied cache on each render

    // Filter to email chits only
    var emailChits = chitsToDisplay.filter(function(c) {
        return c.email_message_id || c.email_status;
    });

    // Apply sub-filter
    function _chitHasTag(c, tagSuffix) {
        // Parse tags if they're a JSON string
        var tags = c.tags;
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch(e) { tags = []; }
        }
        if (!tags || !Array.isArray(tags)) tags = [];

        var target = 'CWOC_System/Email/' + tagSuffix;
        var found = tags.some(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return name === target;
        });
        if (found) return true;

        // Fallback: check email_folder field directly
        var folderMap = { 'Inbox': 'inbox', 'Sent': 'sent', 'Drafts': 'drafts', 'Trash': 'trash' };
        if (c.email_folder && c.email_folder === folderMap[tagSuffix]) return true;
        // Also check email_status for drafts
        if (tagSuffix === 'Drafts' && c.email_status === 'draft') return true;

        return false;
    }

    if (_emailSubFilter === 'inbox') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Inbox') && !c.archived; });
    } else if (_emailSubFilter === 'sent') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Sent') && !c.archived; });
    } else if (_emailSubFilter === 'drafts') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Drafts') && c.email_status === 'draft' && !c.archived; });
    } else if (_emailSubFilter === 'trash') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Trash'); });
    } else if (_emailSubFilter === 'archived') {
        emailChits = emailChits.filter(function(c) { return !!c.archived; });
    }

    // Apply account filter (multi-select by nickname system tag)
    if (_emailAccountFilter.length > 0) {
        emailChits = emailChits.filter(function(c) {
            var tags = c.tags;
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch(e) { tags = []; }
            }
            if (!tags || !Array.isArray(tags)) tags = [];
            // Check if any selected account nickname matches a tag on this chit
            return _emailAccountFilter.some(function(nickname) {
                var target = 'CWOC_System/Email/Account/' + nickname;
                return tags.some(function(t) {
                    var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
                    return name === target;
                });
            });
        });
    }

    // Sort by email_date descending (newest first)
    emailChits.sort(function(a, b) {
        var da = a.email_date || a.start_datetime || '';
        var db = b.email_date || b.start_datetime || '';
        return db.localeCompare(da);
    });

    if (emailChits.length === 0) {
        _emailEmptyState(container);
        return;
    }

    // Bulk actions bar (hidden until items selected)
    var bulkBar = document.createElement('div');
    bulkBar.id = 'emailBulkBar';
    bulkBar.className = 'email-bulk-bar';
    bulkBar.style.display = 'none';
    bulkBar.innerHTML =
        '<label class="email-bulk-select-all-label"><input type="checkbox" id="emailBulkSelectAllCb" class="email-select-cb" onclick="_emailBulkSelectAll()"> <span id="emailBulkSelectAllLabel">Select All</span></label>' +
        '<span id="emailBulkCount">0 selected</span>' +
        '<button class="cwoc-btn" onclick="_emailBulkArchive()"><i class="fas fa-archive"></i> Archive</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkTag()"><i class="fas fa-tag"></i> Tag</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkToggleRead()"><i class="fas fa-envelope-open"></i> Mark Read/Unread</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkClear()">Clear</button>';
    container.appendChild(bulkBar);

    // Get visual indicator settings
    var viSettings = (window._cwocSettings || {}).visual_indicators || {};

    // Scrollable wrapper for email cards
    var scrollWrap = document.createElement('div');
    scrollWrap.className = 'email-scroll-wrap';

    // Render email cards
    emailChits.forEach(function(chit) {
        scrollWrap.appendChild(_buildEmailCard(chit, viSettings));
    });

    container.appendChild(scrollWrap);
}

/**
 * Build a single email card element (richer, like global search results).
 * @param {Object} chit - The email chit object
 * @param {Object} viSettings - Visual indicator settings
 * @returns {HTMLElement} The email card element
 */
function _buildEmailCard(chit, viSettings) {
    var card = document.createElement('div');
    card.className = 'chit-card email-card' + (chit.email_read ? '' : ' email-unread');
    card.dataset.chitId = chit.id;
    if (typeof applyChitColors === 'function') {
        var bg = typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3';
        applyChitColors(card, bg);
        // Store the computed text color for child elements that need contrast
        card._contrastColor = typeof contrastColorForBg === 'function' ? contrastColorForBg(bg) : null;
    }

    // Checkbox for multi-select (supports shift+click range selection)
    var cbWrap = document.createElement('div');
    cbWrap.className = 'email-cb-wrap';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'email-select-cb';
    cb.dataset.chitId = chit.id;
    cb.onclick = function(e) {
        e.stopPropagation();
        if (e.shiftKey && _emailLastCheckedIndex !== null) {
            _emailShiftSelect(cb);
        } else {
            _emailToggleSelect(chit.id, cb.checked);
        }
        // Track this checkbox as the last clicked
        var allCbs = Array.from(document.querySelectorAll('.email-select-cb'));
        _emailLastCheckedIndex = allCbs.indexOf(cb);
    };
    cbWrap.appendChild(cb);
    card.appendChild(cbWrap);

    // Content area — single-row layout:
    // [sender] [subject] [preview ............] [hover actions] [date]
    var content = document.createElement('div');
    content.className = 'email-card-content';

    // Parse sender
    var senderRaw = chit.email_from || '';
    var senderName = senderRaw;
    var senderEmail = senderRaw;
    var nameMatch = senderRaw.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
    if (nameMatch) {
        senderName = nameMatch[1].trim();
        senderEmail = nameMatch[2].trim();
    } else if (senderRaw.indexOf('@') !== -1) {
        senderName = senderRaw.split('@')[0];
        senderEmail = senderRaw;
    }

    var subject = chit.title || chit.email_subject || '(No Subject)';
    var cleanSubject = _emailStripMarkdown(subject);
    var dateStr = _emailFormatDateSmart(chit.email_date);

    // Status badges (inline, before sender) — draft/sent only
    var badgesHtml = '';
    if (chit.email_status === 'draft') badgesHtml += '<span class="email-draft-badge">Draft</span> ';
    if (chit.email_status === 'sent') badgesHtml += '<span class="email-sent-badge">Sent</span> ';

    // Reply indicator — fixed-width slot between sender and subject
    var hasReply = chit.email_message_id && _emailHasReply(chit.email_message_id);
    var replyEl = document.createElement('span');
    replyEl.className = 'email-reply-slot';
    if (hasReply) {
        replyEl.innerHTML = '<i class="fas fa-reply"></i>';
        replyEl.title = 'Replied';
    }

    // Sender name — prominent
    var senderEl = document.createElement('span');
    senderEl.className = 'email-card-sender';
    senderEl.textContent = senderName;
    senderEl.title = senderEmail;

    // Subject — slightly smaller, truncated with tooltip
    var subjectEl = document.createElement('span');
    subjectEl.className = 'email-card-subject';
    subjectEl.textContent = cleanSubject;
    subjectEl.title = cleanSubject;

    // Body preview — fills remaining space
    var bodyText = chit.email_body_text || '';
    var previewEl = document.createElement('span');
    previewEl.className = 'email-card-preview';
    if (bodyText) {
        var cleanText = _emailStripMarkdown(_emailStripHtml(bodyText));
        var lines = cleanText.split('\n').filter(function(l) { return l.trim(); });
        previewEl.textContent = lines.slice(0, 2).join(' ').substring(0, 250);
    }

    // Hover action buttons — appear to the left of the date on hover
    var actions = document.createElement('div');
    actions.className = 'email-hover-actions';
    actions.innerHTML =
        '<button class="email-hover-btn" data-action="archive" title="Archive"><i class="fas fa-archive"></i></button>' +
        '<button class="email-hover-btn" data-action="delete" title="Delete"><i class="fas fa-trash"></i></button>' +
        '<button class="email-hover-btn" data-action="unread" title="Mark Unread"><i class="fas fa-envelope"></i></button>';
    actions.addEventListener('click', function(e) {
        var btn = e.target.closest('.email-hover-btn');
        if (!btn) return;
        e.stopPropagation();
        var action = btn.dataset.action;
        if (action === 'archive') _emailQuickArchive(chit, card);
        else if (action === 'delete') _emailQuickDelete(chit, card);
        else if (action === 'unread') _toggleEmailReadStatus(chit, card);
    });

    // Date — small, fixed right
    var dateEl = document.createElement('span');
    dateEl.className = 'email-meta-date';
    dateEl.textContent = dateStr;

    // Assemble: badges + sender + reply-slot + subject + preview + actions + date
    if (badgesHtml) {
        var badgeSpan = document.createElement('span');
        badgeSpan.className = 'email-card-badges-inline';
        badgeSpan.innerHTML = badgesHtml;
        content.appendChild(badgeSpan);
    }
    content.appendChild(senderEl);
    content.appendChild(replyEl);
    content.appendChild(subjectEl);
    content.appendChild(previewEl);
    content.appendChild(actions);
    content.appendChild(dateEl);

    // Apply contrast-safe text colors when a custom chit color is set
    if (card._contrastColor) {
        senderEl.style.color = card._contrastColor;
        subjectEl.style.color = card._contrastColor;
        previewEl.style.color = card._contrastColor;
        dateEl.style.color = card._contrastColor;
    }

    card.appendChild(content);

    // Double-click handler: navigate to editor (consistent with all other views)
    card.addEventListener('dblclick', function(e) {
        if (e.target.classList.contains('email-select-cb')) return;
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/frontend/html/editor.html?id=' + chit.id + '&expand=email';
    });

    return card;
}

/** Format an email date smartly: today → time (honoring 12/24 setting), otherwise → date */
function _emailFormatDateSmart(emailDate) {
    if (!emailDate) return '';
    try {
        var d = new Date(emailDate);
        var now = new Date();
        if (d.toDateString() === now.toDateString()) {
            // Today — show time, honor 12/24 setting
            if (typeof _sharedFmtTime === 'function') {
                var hh = String(d.getHours()).padStart(2, '0');
                var mm = String(d.getMinutes()).padStart(2, '0');
                return _sharedFmtTime(hh + ':' + mm);
            }
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        // Yesterday
        var yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        // This year — show Mon DD
        if (d.getFullYear() === now.getFullYear()) {
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        // Older — show Mon DD, YYYY
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return emailDate;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Multi-select and bulk actions
// ═══════════════════════════════════════════════════════════════════════════

/** Toggle a chit's selection state */
function _emailToggleSelect(chitId, checked) {
    console.log('[Email Select] Toggle:', chitId, 'checked:', checked);
    if (checked && _emailSelectedIds.indexOf(chitId) === -1) {
        _emailSelectedIds.push(chitId);
    } else if (!checked) {
        _emailSelectedIds = _emailSelectedIds.filter(function(id) { return id !== chitId; });
    }
    console.log('[Email Select] Selected IDs:', _emailSelectedIds);
    _emailUpdateBulkBar();
}

/** Update the bulk actions bar visibility and count */
function _emailUpdateBulkBar() {
    var bar = document.getElementById('emailBulkBar');
    var countEl = document.getElementById('emailBulkCount');
    var selectAllCb = document.getElementById('emailBulkSelectAllCb');
    var selectAllLabel = document.getElementById('emailBulkSelectAllLabel');
    if (!bar) return;
    if (_emailSelectedIds.length > 0) {
        bar.style.display = '';
        if (countEl) countEl.textContent = _emailSelectedIds.length + ' selected';
        // Update Select All checkbox and label
        if (selectAllCb) {
            var allCbs = document.querySelectorAll('.email-scroll-wrap .email-select-cb');
            var allSelected = _emailSelectedIds.length === allCbs.length;
            selectAllCb.checked = allSelected;
        }
        if (selectAllLabel) {
            var allCbs2 = document.querySelectorAll('.email-scroll-wrap .email-select-cb');
            selectAllLabel.textContent = (_emailSelectedIds.length === allCbs2.length) ? 'Deselect All' : 'Select All';
        }
    } else {
        bar.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = false;
    }
}

/** Select all / deselect all visible email cards (toggles) */
function _emailBulkSelectAll() {
    var allCbs = document.querySelectorAll('.email-scroll-wrap .email-select-cb');
    var allChecked = _emailSelectedIds.length > 0 && _emailSelectedIds.length === allCbs.length;

    if (allChecked) {
        // Deselect all
        _emailSelectedIds = [];
        allCbs.forEach(function(cb) { cb.checked = false; });
    } else {
        // Select all
        _emailSelectedIds = [];
        allCbs.forEach(function(cb) {
            cb.checked = true;
            if (cb.dataset.chitId) _emailSelectedIds.push(cb.dataset.chitId);
        });
    }
    _emailUpdateBulkBar();
}

/** Clear all selections */
function _emailBulkClear() {
    _emailSelectedIds = [];
    document.querySelectorAll('.email-scroll-wrap .email-select-cb').forEach(function(cb) { cb.checked = false; });
    _emailUpdateBulkBar();
}

/** Bulk archive selected emails */
async function _emailBulkArchive() {
    if (_emailSelectedIds.length === 0) {
        console.warn('[Email Bulk Archive] No items selected');
        return;
    }
    var count = _emailSelectedIds.length;
    console.log('[Email Bulk Archive] Archiving ' + count + ' items:', _emailSelectedIds);
    var successCount = 0;
    var failCount = 0;
    for (var i = 0; i < _emailSelectedIds.length; i++) {
        var chitId = _emailSelectedIds[i];
        try {
            console.log('[Email Bulk Archive] Fetching chit:', chitId);
            var resp = await fetch('/api/chit/' + encodeURIComponent(chitId));
            console.log('[Email Bulk Archive] GET /api/chit/' + chitId + ' status:', resp.status);
            if (!resp.ok) {
                var errText = await resp.text();
                console.error('[Email Bulk Archive] GET failed for ' + chitId + ':', resp.status, errText);
                failCount++;
                continue;
            }
            var chit = await resp.json();
            console.log('[Email Bulk Archive] Chit fetched, archived=' + chit.archived + ', title=' + chit.title);
            chit.archived = true;
            // The GET API may return JSON-array fields as strings (already serialized).
            // The PUT API (Pydantic) expects actual arrays. Parse string→array where needed.
            ['tags', 'checklist', 'people', 'child_chits', 'alerts',
             'recurrence_exceptions', 'shares'].forEach(function(f) {
                if (typeof chit[f] === 'string') {
                    try { chit[f] = JSON.parse(chit[f]); } catch(e) { /* leave as-is */ }
                }
            });
            // These fields are stored as JSON strings in the DB and the Pydantic model
            // expects them as Optional[str], so stringify arrays back to strings:
            ['email_to', 'email_cc', 'email_bcc'].forEach(function(f) {
                if (Array.isArray(chit[f])) chit[f] = JSON.stringify(chit[f]);
            });
            console.log('[Email Bulk Archive] PUTting chit with archived=true');
            var putResp = await fetch('/api/chits/' + encodeURIComponent(chitId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chit)
            });
            console.log('[Email Bulk Archive] PUT /api/chits/' + chitId + ' status:', putResp.status);
            if (!putResp.ok) {
                var putErr = await putResp.text();
                console.error('[Email Bulk Archive] PUT failed for ' + chitId + ':', putResp.status, putErr);
                failCount++;
            } else {
                successCount++;
                console.log('[Email Bulk Archive] Successfully archived ' + chitId);
            }
        } catch (e) {
            console.error('[Email Bulk Archive] Exception for ' + chitId + ':', e);
            failCount++;
        }
    }
    console.log('[Email Bulk Archive] Done. Success: ' + successCount + ', Failed: ' + failCount);
    if (failCount > 0) {
        _showToast(successCount + ' archived, ' + failCount + ' failed', failCount === count ? 'error' : 'info');
    } else {
        _showToast(count + ' email(s) archived', 'success');
    }
    _emailSelectedIds = [];
    if (typeof fetchChits === 'function') fetchChits();
}

/** Bulk toggle read/unread for all selected emails */
async function _emailBulkToggleRead() {
    if (_emailSelectedIds.length === 0) {
        console.warn('[Email Bulk Read] No items selected');
        return;
    }
    var count = _emailSelectedIds.length;
    console.log('[Email Bulk Read] Toggling ' + count + ' items:', _emailSelectedIds);
    var successCount = 0;
    var failCount = 0;
    for (var i = 0; i < _emailSelectedIds.length; i++) {
        var chitId = _emailSelectedIds[i];
        try {
            var resp = await fetch('/api/email/' + encodeURIComponent(chitId) + '/read', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!resp.ok) {
                failCount++;
                continue;
            }
            var data = await resp.json();
            // Update the global chits array
            if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                var found = chits.find(function(c) { return c.id === chitId; });
                if (found) found.email_read = data.email_read;
            }
            // Update card visual state
            var card = document.querySelector('.email-card[data-chit-id="' + chitId + '"]');
            if (card) {
                if (data.email_read) card.classList.remove('email-unread');
                else card.classList.add('email-unread');
            }
            successCount++;
        } catch (e) {
            console.error('[Email Bulk Read] Exception for ' + chitId + ':', e);
            failCount++;
        }
    }
    if (typeof _updateEmailBadge === 'function') _updateEmailBadge();
    if (failCount > 0) {
        _showToast(successCount + ' toggled, ' + failCount + ' failed', failCount === count ? 'error' : 'info');
    } else {
        _showToast(count + ' email(s) read status toggled', 'success');
    }
    _emailSelectedIds = [];
    document.querySelectorAll('.email-scroll-wrap .email-select-cb').forEach(function(cb) { cb.checked = false; });
    _emailUpdateBulkBar();
}

/** Bulk tag selected emails — show a prompt for the tag name */
async function _emailBulkTag() {
    if (_emailSelectedIds.length === 0) return;

    var existing = document.getElementById('emailTagModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'emailTagModal';
    overlay.className = 'modal';
    overlay.style.display = 'flex';

    var content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = 'max-width:600px;width:90vw;max-height:80vh;display:flex;flex-direction:column;padding:20px;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
    header.innerHTML = '<h3 style="margin:0;font-family:Lora,Georgia,serif;">🏷️ Tag ' + _emailSelectedIds.length + ' email(s)</h3>' +
        '<button class="zone-button" onclick="document.getElementById(\'emailTagModal\').remove()"><i class="fas fa-times"></i> Close</button>';
    content.appendChild(header);

    // Tag picker container — uses the shared buildTagPicker from shared-tags.js
    var pickerContainer = document.createElement('div');
    pickerContainer.style.cssText = 'flex:1;overflow-y:auto;';
    content.appendChild(pickerContainer);

    var selectedTags = [];
    var picker = null;
    if (typeof buildTagPicker === 'function') {
        picker = buildTagPicker(pickerContainer, selectedTags, { compact: true, onChange: function() {} });
    } else {
        pickerContainer.innerHTML = '<p>Tag picker not available.</p>';
    }

    // Apply button
    var applyRow = document.createElement('div');
    applyRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';
    var applyBtn = document.createElement('button');
    applyBtn.className = 'zone-button';
    applyBtn.innerHTML = '<i class="fas fa-check"></i> Apply';
    applyRow.appendChild(applyBtn);
    content.appendChild(applyRow);

    overlay.appendChild(content);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    applyBtn.onclick = async function() {
        var tagsToApply = picker ? picker.getSelected() : selectedTags;
        console.log('[Email Bulk Tag] Tags to apply:', tagsToApply, 'to', _emailSelectedIds.length, 'chits');
        if (tagsToApply.length === 0) {
            _showToast('No tags selected', 'info');
            return;
        }
        var count = _emailSelectedIds.length;
        var successCount = 0;
        for (var i = 0; i < _emailSelectedIds.length; i++) {
            try {
                var resp = await fetch('/api/chit/' + encodeURIComponent(_emailSelectedIds[i]));
                if (!resp.ok) { console.error('[Email Bulk Tag] GET failed:', resp.status); continue; }
                var chit = await resp.json();
                var tags = chit.tags || [];
                if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch(e) { tags = []; } }
                if (!Array.isArray(tags)) tags = [];
                var changed = false;
                tagsToApply.forEach(function(tagName) {
                    var hasTag = tags.some(function(t) {
                        return (typeof t === 'string' ? t : (t && t.name ? t.name : '')) === tagName;
                    });
                    if (!hasTag) { tags.push(tagName); changed = true; }
                });
                if (changed) {
                    // Parse string fields to arrays for PUT (Pydantic expects lists)
                    ['tags', 'checklist', 'people', 'child_chits', 'alerts',
                     'recurrence_exceptions', 'shares'].forEach(function(f) {
                        if (typeof chit[f] === 'string') {
                            try { chit[f] = JSON.parse(chit[f]); } catch(e) {}
                        }
                    });
                    // email_to/cc/bcc are Optional[str] in Pydantic — must stay as strings
                    ['email_to', 'email_cc', 'email_bcc'].forEach(function(f) {
                        if (Array.isArray(chit[f])) chit[f] = JSON.stringify(chit[f]);
                    });
                    chit.tags = tags;
                    var putResp = await fetch('/api/chits/' + encodeURIComponent(_emailSelectedIds[i]), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chit)
                    });
                    if (putResp.ok) { successCount++; }
                    else { console.error('[Email Bulk Tag] PUT failed:', putResp.status, await putResp.text()); }
                }
            } catch (e) {
                console.error('Bulk tag error for ' + _emailSelectedIds[i], e);
            }
        }
        overlay.remove();
        _showToast(successCount + '/' + count + ' email(s) tagged', successCount > 0 ? 'success' : 'error');
        _emailSelectedIds = [];
        if (typeof fetchChits === 'function') fetchChits();
    };

    function _tagModalEsc(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _tagModalEsc, true); }
    }
    document.addEventListener('keydown', _tagModalEsc, true);

    document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-filter, sync, compose, badge, empty state, helpers
// ═══════════════════════════════════════════════════════════════════════════

function _setEmailSubFilter(filter) {
    _emailSubFilter = filter;
    // Sync sidebar radio buttons
    var radios = document.querySelectorAll('#email-folder-select input[name="emailFolder"]');
    radios.forEach(function(r) { r.checked = (r.value === filter); });
    if (typeof displayChits === 'function') displayChits();
}

function _checkMail() {
    console.log('[Email Check Mail] Starting sync...');
    _showToast('Checking mail...', 'info');
    fetch('/api/email/sync', { method: 'POST' })
        .then(function(r) {
            console.log('[Email Check Mail] Response status:', r.status);
            return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; });
        })
        .then(function(result) {
            console.log('[Email Check Mail] Result:', JSON.stringify(result.data));
            if (result.ok && result.data.new_count !== undefined) {
                var parts = [];
                if (result.data.new_count > 0) parts.push(result.data.new_count + ' new');
                if (result.data.deleted_count > 0) parts.push(result.data.deleted_count + ' removed');
                if (result.data.new_count > 0) {
                    var noun = result.data.new_count === 1 ? 'email' : 'emails';
                    cwocToast('📬 ' + result.data.new_count + ' new ' + noun, 'success', 5000);
                } else {
                    var msg = parts.length ? parts.join(', ') : 'No new emails';
                    _showToast(msg, 'success');
                }
                if (typeof fetchChits === 'function') fetchChits();
            } else if (result.status === 400 && result.data.detail && result.data.detail.indexOf('No email account') !== -1) {
                console.warn('[Email Check Mail] No email account configured.');
                _showToast('No email account configured. Go to Settings → Email Account.', 'error');
            } else if (result.data.detail) {
                console.error('[Email Check Mail] Error:', result.data.detail);
                _showToast(result.data.detail, 'error');
            } else {
                console.error('[Email Check Mail] Unexpected response:', result.data);
                _showToast('Unexpected response from server', 'error');
            }
        })
        .catch(function(err) {
            console.error('[Email Check Mail] Fetch error:', err);
            _showToast('Failed to check mail: ' + err.message, 'error');
        });
}

function _composeEmail() {
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = '/frontend/html/editor.html?new=email&expand=email';
}

function _getUnreadCount() {
    if (typeof chits === 'undefined' || !Array.isArray(chits)) return 0;
    return chits.filter(function(c) {
        return (c.email_message_id || c.email_status) &&
               c.email_folder === 'inbox' &&
               !c.email_read;
    }).length;
}

function _updateEmailBadge() {
    var badge = document.getElementById('email-unread-badge');
    if (!badge) return;
    var count = _getUnreadCount();
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

function _emailEmptyState(container) {
    var div = document.createElement('div');
    div.className = 'cwoc-empty';
    div.innerHTML = '<p>No emails in this folder.</p>';
    container.appendChild(div);
}

function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Strip HTML tags and decode entities from a string.
 * Used to clean email body text that may contain residual HTML.
 */
function _emailStripHtml(str) {
    if (!str) return '';
    // Remove style/script blocks (including any that leaked into plain text)
    var text = str.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Also strip CSS-like content that leaked into plain text (e.g. ".class { ... }")
    text = text.replace(/\.[a-zA-Z_][\w-]*\s*\{[^}]*\}/g, '');
    text = text.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
    // Replace <br> and </p> with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    // Strip all remaining tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode common named HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    // Decode ALL numeric HTML entities (&#NNN; and &#xHHH;)
    text = text.replace(/&#x([0-9a-fA-F]+);/g, function(m, hex) {
        var cp = parseInt(hex, 16);
        // Replace zero-width and invisible characters with empty string
        if (cp === 0x200C || cp === 0x200D || cp === 0x200B || cp === 0xFEFF || cp === 0x34F) return '';
        return String.fromCodePoint(cp);
    });
    text = text.replace(/&#(\d+);/g, function(m, dec) {
        var cp = parseInt(dec, 10);
        // Replace zero-width and invisible characters with empty string
        if (cp === 8204 || cp === 8205 || cp === 8203 || cp === 65279 || cp === 847) return '';
        return String.fromCodePoint(cp);
    });
    // Strip raw URLs (http/https links that clutter the preview)
    text = text.replace(/https?:\/\/[^\s)>\]]+/g, '');
    // Collapse excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');
    return text.trim();
}

/**
 * Strip markdown formatting from a string, returning plain text.
 * Extracts link text from [text](url), removes bold/italic markers, etc.
 */
function _emailStripMarkdown(str) {
    if (!str) return '';
    // Extract link text from [text](url) — keep only the text part
    var text = str.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // Remove image syntax ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    // Remove bold **text** or __text__
    text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
    text = text.replace(/__([^_]*)__/g, '$1');
    // Remove italic *text* or _text_
    text = text.replace(/\*([^*]*)\*/g, '$1');
    text = text.replace(/_([^_]*)_/g, '$1');
    // Remove inline code `text`
    text = text.replace(/`([^`]*)`/g, '$1');
    // Remove heading markers
    text = text.replace(/^#{1,6}\s+/gm, '');
    // Strip any residual HTML tags too
    text = text.replace(/<[^>]+>/g, '');
    return text.trim();
}

/**
 * Shift+click range selection for email checkboxes.
 * Selects (checks) all checkboxes between the last clicked and the current one.
 */
function _emailShiftSelect(currentCb) {
    var allCbs = Array.from(document.querySelectorAll('.email-select-cb'));
    var currentIndex = allCbs.indexOf(currentCb);
    if (_emailLastCheckedIndex === null || currentIndex === -1) return;

    var start = Math.min(_emailLastCheckedIndex, currentIndex);
    var end = Math.max(_emailLastCheckedIndex, currentIndex);
    var newState = currentCb.checked;

    for (var i = start; i <= end; i++) {
        allCbs[i].checked = newState;
        var chitId = allCbs[i].dataset.chitId;
        if (newState && _emailSelectedIds.indexOf(chitId) === -1) {
            _emailSelectedIds.push(chitId);
        } else if (!newState) {
            _emailSelectedIds = _emailSelectedIds.filter(function(id) { return id !== chitId; });
        }
    }
    _emailUpdateBulkBar();
}

function _showToast(msg, type) {
    if (typeof cwocToast === 'function') {
        cwocToast(msg, type);
    } else if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        console.log('[Toast]', type, msg);
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// Read/unread toggle
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toggle read/unread status via PATCH and update the card visually.
 */
async function _toggleEmailReadStatus(chit, card) {
    try {
        var resp = await fetch('/api/email/' + encodeURIComponent(chit.id) + '/read', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!resp.ok) {
            _showToast('Failed to toggle read status', 'error');
            return;
        }
        var data = await resp.json();
        chit.email_read = data.email_read;

        // Update card visual state
        if (data.email_read) {
            card.classList.remove('email-unread');
        } else {
            card.classList.add('email-unread');
        }

        // Update the global chits array so badge count stays in sync
        if (typeof chits !== 'undefined' && Array.isArray(chits)) {
            var found = chits.find(function(c) { return c.id === chit.id; });
            if (found) found.email_read = data.email_read;
        }

        // Update unread badge
        if (typeof _updateEmailBadge === 'function') _updateEmailBadge();

        _showToast(data.email_read ? 'Marked as read' : 'Marked as unread', 'success');
    } catch (err) {
        console.error('[Email] Toggle read error:', err);
        _showToast('Failed to toggle read status', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Replied-to detection
// ═══════════════════════════════════════════════════════════════════════════

/** Cache of message IDs that have been replied to (built once per render) */
var _emailRepliedToCache = null;

/**
 * Build a Set of message IDs that have been replied to.
 * Only counts replies/forwards that the user actually sent or drafted —
 * incoming emails with In-Reply-To headers are NOT counted.
 */
function _emailBuildRepliedCache() {
    _emailRepliedToCache = new Set();
    if (typeof chits === 'undefined' || !Array.isArray(chits)) return;
    chits.forEach(function(c) {
        if (c.email_in_reply_to &&
            (c.email_status === 'sent' || c.email_status === 'draft')) {
            _emailRepliedToCache.add(c.email_in_reply_to.trim());
        }
    });
}

/**
 * Check if a given message ID has been replied to.
 * @param {string} messageId - The email_message_id to check
 * @returns {boolean}
 */
function _emailHasReply(messageId) {
    if (!messageId) return false;
    if (!_emailRepliedToCache) _emailBuildRepliedCache();
    return _emailRepliedToCache.has(messageId.trim());
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick actions (single-email archive, delete)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick-archive a single email with undo countdown.
 * Hides the card immediately, then archives after the countdown expires.
 * If the user clicks Undo, the card reappears and nothing is changed.
 */
function _emailQuickArchive(chit, card) {
    // Immediately hide the card
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(function() { card.style.display = 'none'; }, 300);

    var title = chit.title || chit.email_subject || '(No Subject)';

    _emailUndoToast(
        '📦 Archived: ' + title,
        // onExpire — actually archive
        async function() {
            try {
                var resp = await fetch('/api/chit/' + encodeURIComponent(chit.id));
                if (!resp.ok) { _showToast('Failed to archive email', 'error'); _emailRestoreCard(card); return; }
                var fullChit = await resp.json();
                fullChit.archived = true;
                ['tags', 'checklist', 'people', 'child_chits', 'alerts',
                 'recurrence_exceptions', 'shares'].forEach(function(f) {
                    if (typeof fullChit[f] === 'string') {
                        try { fullChit[f] = JSON.parse(fullChit[f]); } catch(e) {}
                    }
                });
                ['email_to', 'email_cc', 'email_bcc'].forEach(function(f) {
                    if (Array.isArray(fullChit[f])) fullChit[f] = JSON.stringify(fullChit[f]);
                });
                var putResp = await fetch('/api/chits/' + encodeURIComponent(chit.id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullChit)
                });
                if (putResp.ok) {
                    card.remove();
                    if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                        var found = chits.find(function(c) { return c.id === chit.id; });
                        if (found) found.archived = true;
                    }
                } else {
                    _showToast('Failed to archive email', 'error');
                    _emailRestoreCard(card);
                }
            } catch (e) {
                console.error('[Email Quick Archive]', e);
                _showToast('Failed to archive email', 'error');
                _emailRestoreCard(card);
            }
        },
        // onUndo — restore the card
        function() {
            _emailRestoreCard(card);
            _showToast('Archive undone', 'success');
        }
    );
}

/**
 * Quick-delete (soft delete) a single email with undo countdown.
 * Hides the card immediately, then deletes after the countdown expires.
 */
function _emailQuickDelete(chit, card) {
    // Immediately hide the card
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(function() { card.style.display = 'none'; }, 300);

    var title = chit.title || chit.email_subject || '(No Subject)';

    _emailUndoToast(
        '🗑️ Deleted: ' + title,
        // onExpire — actually delete
        async function() {
            try {
                var resp = await fetch('/api/chits/' + encodeURIComponent(chit.id), {
                    method: 'DELETE'
                });
                if (resp.ok) {
                    card.remove();
                    if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                        var idx = chits.findIndex(function(c) { return c.id === chit.id; });
                        if (idx !== -1) chits[idx].deleted = true;
                    }
                    if (typeof _updateEmailBadge === 'function') _updateEmailBadge();
                } else {
                    _showToast('Failed to delete email', 'error');
                    _emailRestoreCard(card);
                }
            } catch (e) {
                console.error('[Email Quick Delete]', e);
                _showToast('Failed to delete email', 'error');
                _emailRestoreCard(card);
            }
        },
        // onUndo — restore the card
        function() {
            _emailRestoreCard(card);
            _showToast('Delete undone', 'success');
        }
    );
}

/**
 * Restore a hidden email card back to visible state (used by undo).
 * Plays a brief flash animation so the restored card is obvious.
 */
function _emailRestoreCard(card) {
    card.style.display = '';
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '1';
    card.style.transform = 'none';
    // Flash highlight so the user can see which card came back
    card.classList.add('email-card-flash');
    setTimeout(function() { card.classList.remove('email-card-flash'); }, 1500);
}

/**
 * Show an undo toast with a countdown timer bar for email actions.
 * Reuses the same visual style as _showDeleteUndoToast but with a custom message.
 * @param {string} message - The message to display (e.g. "📦 Archived: Subject")
 * @param {function} onExpire - Called when countdown expires (perform the action)
 * @param {function} onUndo - Called when user clicks Undo
 */
function _emailUndoToast(message, onExpire, onUndo) {
    var DURATION = 10000;

    // Remove any existing email undo toast
    var existing = document.getElementById('emailUndoToast');
    if (existing) {
        if (existing._undoDismissed === false && existing._onExpire) existing._onExpire();
        existing.remove();
    }

    var toast = document.createElement('div');
    toast.id = 'emailUndoToast';
    toast.className = 'email-undo-toast';

    var msgRow = document.createElement('div');
    msgRow.className = 'email-undo-msg-row';
    var msg = document.createElement('span');
    msg.className = 'email-undo-msg';
    msg.textContent = message;
    var undoBtn = document.createElement('button');
    undoBtn.className = 'email-undo-btn';
    undoBtn.textContent = 'Undo';
    msgRow.appendChild(msg);
    msgRow.appendChild(undoBtn);
    toast.appendChild(msgRow);

    // Timer bar
    var barOuter = document.createElement('div');
    barOuter.className = 'email-undo-bar-outer';
    var barInner = document.createElement('div');
    barInner.className = 'email-undo-bar-inner';
    barOuter.appendChild(barInner);
    toast.appendChild(barOuter);

    document.body.appendChild(toast);

    var start = Date.now();
    var dismissed = false;
    toast._undoDismissed = false;
    toast._onExpire = onExpire;

    var interval = setInterval(function() {
        var elapsed = Date.now() - start;
        var pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
        barInner.style.width = pct + '%';
        if (elapsed >= DURATION) {
            clearInterval(interval);
            if (!dismissed) {
                dismissed = true;
                toast._undoDismissed = true;
                toast.remove();
                if (onExpire) onExpire();
            }
        }
    }, 50);

    undoBtn.onclick = function() {
        if (dismissed) return;
        dismissed = true;
        toast._undoDismissed = true;
        clearInterval(interval);
        toast.remove();
        if (onUndo) onUndo();
    };
}
