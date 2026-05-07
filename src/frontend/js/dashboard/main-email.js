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

/* Account error state: { nickname: errorMessage } — set by sync, cleared on success */
var _emailAccountErrors = {};

/* Account success state: { nickname: true } — set on successful sync */
var _emailAccountSuccess = {};

/* Last sync attempt time per account: { nickname: ISO string } */
var _emailAccountLastSync = {};

// Load persisted sync status from localStorage
(function() {
    try {
        var stored = localStorage.getItem('cwoc_email_account_status');
        if (stored) {
            var parsed = JSON.parse(stored);
            _emailAccountErrors = parsed.errors || {};
            _emailAccountSuccess = parsed.success || {};
            _emailAccountLastSync = parsed.lastSync || {};
        }
    } catch(e) {}
})();

/** Persist account sync status to localStorage */
function _emailPersistAccountStatus() {
    try {
        localStorage.setItem('cwoc_email_account_status', JSON.stringify({
            errors: _emailAccountErrors,
            success: _emailAccountSuccess,
            lastSync: _emailAccountLastSync
        }));
    } catch(e) {}
}

/* Whether account filter has been initialized with all accounts */
var _emailAccountFilterInitialized = false;

/* Cached contacts for sender image lookup */
var _emailDashContactsCache = null;

/* Cached users for sender image lookup */
var _emailDashUsersCache = null;

/**
 * Load contacts for sender image lookup (cached after first call).
 * Called once when the email view first renders.
 */
function _emailLoadDashContacts() {
    if (_emailDashContactsCache) return;
    fetch('/api/contacts')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(data) { _emailDashContactsCache = data; })
        .catch(function() { _emailDashContactsCache = []; });
}

/**
 * Load users for sender image lookup (cached after first call).
 */
function _emailLoadDashUsers() {
    if (_emailDashUsersCache) return;
    fetch('/api/auth/switchable-users')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(data) { _emailDashUsersCache = data; })
        .catch(function() { _emailDashUsersCache = []; });
}

// Kick off contact and user loading early
setTimeout(_emailLoadDashContacts, 500);
setTimeout(_emailLoadDashUsers, 600);

/**
 * Look up a contact's or user's image_url by matching the sender email address.
 * Checks contacts first, then users.
 * @param {string} senderRaw — raw "Name <email>" or "email" string
 * @returns {string|null} — image URL or null
 */
function _emailGetContactImage(senderRaw) {
    if (!senderRaw) return null;
    // Extract email from "Name <email>" format
    var emailAddr = senderRaw;
    var match = senderRaw.match(/<([^>]+)>/);
    if (match) emailAddr = match[1];
    emailAddr = emailAddr.toLowerCase().trim();

    // Check contacts
    if (_emailDashContactsCache) {
        for (var i = 0; i < _emailDashContactsCache.length; i++) {
            var c = _emailDashContactsCache[i];
            if (!c.image_url) continue;
            var emails = c.emails || [];
            for (var j = 0; j < emails.length; j++) {
                if ((emails[j].value || '').toLowerCase().trim() === emailAddr) {
                    return c.image_url;
                }
            }
        }
    }

    // Check users
    if (_emailDashUsersCache) {
        for (var i = 0; i < _emailDashUsersCache.length; i++) {
            var u = _emailDashUsersCache[i];
            if (!u.profile_image_url) continue;
            // Check primary email
            if (u.email && u.email.toLowerCase().trim() === emailAddr) {
                return u.profile_image_url;
            }
            // Check multi-value emails
            var uEmails = u.emails_json || [];
            for (var j = 0; j < uEmails.length; j++) {
                if ((uEmails[j].value || '').toLowerCase().trim() === emailAddr) {
                    return u.profile_image_url;
                }
            }
        }
    }

    return null;
}

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
        // Sync unread-at-top toggle checkbox
        var unreadTopCb = document.getElementById('email-unread-top-toggle');
        if (unreadTopCb) unreadTopCb.checked = _emailUnreadTop;
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
 * All accounts start selected (dark). Clicking deselects that one account.
 * When all are selected, show all emails. When some are deselected, only show selected.
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

    // Initialize filter to all accounts selected if not yet set
    if (_emailAccountFilter.length === 0 && !_emailAccountFilterInitialized) {
        _emailAccountFilterInitialized = true;
        namedAccounts.forEach(function(a) {
            _emailAccountFilter.push(a.nickname);
        });
    }

    wrap.style.display = '';
    wrap.innerHTML = '';

    namedAccounts.forEach(function(acct) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'email-account-pill';
        var isActive = _emailAccountFilter.indexOf(acct.nickname) !== -1;
        if (isActive) btn.classList.add('active');

        // Error state — red pill with warning icon
        var hasError = _emailAccountErrors[acct.nickname];
        var hasSuccess = _emailAccountSuccess[acct.nickname];
        var lastSync = _emailAccountLastSync[acct.nickname];
        var lastSyncStr = '';
        if (lastSync) {
            try {
                var d = new Date(lastSync);
                lastSyncStr = 'Last check: ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            } catch(e) {}
        }

        if (hasError) {
            btn.classList.add('email-account-pill-error');
            btn.textContent = '⚠️ ' + acct.nickname;
            btn.title = 'Error: ' + hasError + (lastSyncStr ? '\n' + lastSyncStr : '') + '\n(click for details)';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                _showAccountErrorDetails(acct.nickname, hasError);
            });
        } else {
            if (hasSuccess) btn.classList.add('email-account-pill-ok');
            btn.textContent = acct.nickname;
            btn.title = (acct.email || acct.nickname) + (lastSyncStr ? '\n' + lastSyncStr : '');
            btn.addEventListener('click', function() {
                _emailToggleAccountFilter(acct.nickname);
            });
        }
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
 * Show a persistent toast with full error details for a failed account.
 * Includes a "Copy Error" button and a "Go to Settings" button.
 */
function _showAccountErrorDetails(nickname, errorMsg) {
    var fullMsg = nickname + ': ' + errorMsg;

    // Remove existing toast
    var existing = document.getElementById('cwoc-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'cwoc-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'
        + 'background:#8b1a1a;color:#fdf5e6;border:2px solid #5c1010;'
        + 'border-radius:8px;padding:12px 20px;font-family:Lora,Georgia,serif;font-size:0.95em;'
        + 'box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:10000;'
        + 'max-width:90%;text-align:left;opacity:0;transition:opacity 0.3s ease;display:flex;flex-direction:column;gap:8px;';

    var msgEl = document.createElement('div');
    msgEl.textContent = '⚠️ ' + fullMsg;
    toast.appendChild(msgEl);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;';

    var settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️ Email Settings';
    settingsBtn.style.cssText = 'background:#5c1010;color:#fdf5e6;border:1px solid #3a0a0a;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.85em;';
    settingsBtn.onclick = function(e) {
        e.stopPropagation();
        window.location.href = '/frontend/html/settings.html#email';
    };
    btnRow.appendChild(settingsBtn);

    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy Error';
    copyBtn.style.cssText = 'background:#5c1010;color:#fdf5e6;border:1px solid #3a0a0a;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.85em;';
    copyBtn.onclick = function(e) {
        e.stopPropagation();
        navigator.clipboard.writeText(fullMsg).then(function() {
            copyBtn.textContent = '✓ Copied';
            setTimeout(function() { copyBtn.textContent = '📋 Copy Error'; }, 2000);
        });
    };
    btnRow.appendChild(copyBtn);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Dismiss';
    closeBtn.style.cssText = 'background:#5c1010;color:#fdf5e6;border:1px solid #3a0a0a;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.85em;';
    closeBtn.onclick = function(e) {
        e.stopPropagation();
        toast.style.opacity = '0';
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    };
    btnRow.appendChild(closeBtn);

    toast.appendChild(btnRow);
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
}

/**
 * Show an error toast with a "Go to Settings" button for email configuration issues.
 * @param {string} errorMsg — the error message to display
 * @param {string} hint — additional hint text
 */
function _emailShowErrorWithSettingsLink(errorMsg, hint) {
    // Remove existing toast
    var existing = document.getElementById('cwoc-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'cwoc-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'
        + 'background:#8b1a1a;color:#fdf5e6;border:2px solid #5c1010;'
        + 'border-radius:8px;padding:12px 20px;font-family:Lora,Georgia,serif;font-size:0.95em;'
        + 'box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:10000;'
        + 'max-width:90%;text-align:left;opacity:0;transition:opacity 0.3s ease;display:flex;flex-direction:column;gap:8px;';

    var msgEl = document.createElement('div');
    msgEl.textContent = '⚠️ ' + errorMsg;
    toast.appendChild(msgEl);

    if (hint) {
        var hintEl = document.createElement('div');
        hintEl.style.cssText = 'font-size:0.85em;opacity:0.85;';
        hintEl.textContent = hint;
        toast.appendChild(hintEl);
    }

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;';

    var settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️ Email Settings';
    settingsBtn.style.cssText = 'background:#5c1010;color:#fdf5e6;border:1px solid #3a0a0a;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.85em;';
    settingsBtn.onclick = function(e) {
        e.stopPropagation();
        window.location.href = '/frontend/html/settings.html#email';
    };
    btnRow.appendChild(settingsBtn);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Dismiss';
    closeBtn.style.cssText = 'background:#5c1010;color:#fdf5e6;border:1px solid #3a0a0a;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.85em;';
    closeBtn.onclick = function(e) {
        e.stopPropagation();
        toast.style.opacity = '0';
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    };
    btnRow.appendChild(closeBtn);

    toast.appendChild(btnRow);
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
}

/**
 * Show or hide spinning indicators on all account pills.
 * @param {boolean} spinning — true to show spinners, false to remove them
 */
function _emailSetPillSpinners(spinning) {
    var pills = document.querySelectorAll('.email-account-pill');
    pills.forEach(function(pill) {
        var existing = pill.querySelector('.email-pill-spinner');
        if (spinning) {
            if (!existing) {
                var spinner = document.createElement('i');
                spinner.className = 'fas fa-circle-notch fa-spin email-pill-spinner';
                spinner.style.marginLeft = '5px';
                spinner.style.fontSize = '0.8em';
                pill.appendChild(spinner);
            }
        } else {
            if (existing) existing.remove();
        }
    });
    // Also spin the Check Mail button icon
    var checkBtn = document.getElementById('sidebar-check-mail-btn');
    if (checkBtn) {
        var icon = checkBtn.querySelector('.fas');
        if (icon) {
            if (spinning) {
                icon.classList.add('fa-spin');
            } else {
                icon.classList.remove('fa-spin');
            }
        }
    }
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

// Check for pending email send (from editor undo-send flow)
setTimeout(_emailCheckPendingSend, 500);

/**
 * Check localStorage for a pending email send and show the undo countdown.
 * Called on dashboard load after navigating from the editor's send action.
 */
function _emailCheckPendingSend() {
    var raw = localStorage.getItem('cwoc_email_pending_send');
    if (!raw) return;
    localStorage.removeItem('cwoc_email_pending_send');

    try {
        var pending = JSON.parse(raw);
        // Only process if it's recent (within 30 seconds)
        if (Date.now() - pending.timestamp > 30000) return;

        _emailShowUndoSendBar(pending.chitId, pending.archiveOriginal, pending.inReplyTo);
    } catch (e) {
        console.error('[Email] Failed to parse pending send:', e);
    }
}

/**
 * Show the undo-send countdown bar on the dashboard.
 * @param {string} chitId
 * @param {boolean} archiveOriginal
 * @param {string|null} inReplyTo
 */
function _emailShowUndoSendBar(chitId, archiveOriginal, inReplyTo) {
    var DURATION = 7000;

    // Remove any existing
    var existing = document.getElementById('emailUndoSendToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'emailUndoSendToast';
    toast.className = 'email-undo-toast';

    var msgRow = document.createElement('div');
    msgRow.className = 'email-undo-msg-row';
    var msg = document.createElement('span');
    msg.className = 'email-undo-msg';
    msg.textContent = '✉️ Sending email...';
    var undoBtn = document.createElement('button');
    undoBtn.className = 'email-undo-btn';
    undoBtn.textContent = 'Undo';
    msgRow.appendChild(msg);
    msgRow.appendChild(undoBtn);
    toast.appendChild(msgRow);

    var barOuter = document.createElement('div');
    barOuter.className = 'email-undo-bar-outer';
    var barInner = document.createElement('div');
    barInner.className = 'email-undo-bar-inner';
    barOuter.appendChild(barInner);
    toast.appendChild(barOuter);

    document.body.appendChild(toast);

    var start = Date.now();
    var dismissed = false;

    var interval = setInterval(function() {
        var elapsed = Date.now() - start;
        var pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
        barInner.style.width = pct + '%';
        if (elapsed >= DURATION) {
            clearInterval(interval);
            if (!dismissed) {
                dismissed = true;
                toast.remove();
                _emailDoActualSendFromDash(chitId, archiveOriginal, inReplyTo);
            }
        }
    }, 50);

    undoBtn.onclick = function() {
        if (dismissed) return;
        dismissed = true;
        clearInterval(interval);
        toast.remove();
        _showToast('Send cancelled.', 'info');
    };
}

/**
 * Actually send the email from the dashboard after undo countdown expires.
 */
async function _emailDoActualSendFromDash(chitId, archiveOriginal, inReplyTo) {
    try {
        var response = await fetch('/api/email/send/' + encodeURIComponent(chitId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            var errData;
            try { errData = await response.json(); } catch(e) { errData = { detail: 'Send failed.' }; }
            _showToast(errData.detail || 'Send failed.', 'error');
            return;
        }

        _showToast('Email sent successfully.', 'success');

        // Archive original if requested
        if (archiveOriginal && inReplyTo) {
            try {
                await fetch('/api/email/archive-original', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message_id: inReplyTo })
                });
            } catch(e) { console.error('[Email] Failed to archive original:', e); }
        }

        // Refresh the email list
        if (typeof fetchChits === 'function') fetchChits();
    } catch(err) {
        console.error('[Email] Send from dashboard failed:', err);
        _showToast('Failed to send email.', 'error');
    }
}

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

    // ALL email chits (unfiltered) — needed for cross-folder thread grouping
    var allEmailChits = chitsToDisplay.filter(function(c) {
        return c.email_message_id || c.email_status;
    });

    // Filter to email chits only (will be narrowed by sub-filter)
    var emailChits = allEmailChits.slice();

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
    // Only filter if some accounts are deselected (not all active)
    var allAccounts = ((window._cwocSettings || {}).email_accounts || []).filter(function(a) { return a && a.nickname; });
    var allSelected = _emailAccountFilter.length >= allAccounts.length;
    if (_emailAccountFilter.length > 0 && !allSelected) {
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

    // Sort by email_date descending (newest first), with pinned at top and optional unread-at-top
    emailChits.sort(function(a, b) {
        // Pinned always at top
        var aPinned = a.pinned ? 1 : 0;
        var bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        // Unread at top: unread emails first, then read, each group by newest
        if (_emailUnreadTop) {
            var aUnread = !a.email_read ? 1 : 0;
            var bUnread = !b.email_read ? 1 : 0;
            if (aUnread !== bUnread) return bUnread - aUnread;
        }
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

    // Render email cards — always threaded
    // Build thread map from ALL emails (cross-folder), then filter to visible
    var allThreads = _emailGroupByThread(allEmailChits);
    var visibleIds = new Set(emailChits.map(function(c) { return c.id; }));

    // Filter threads to only those with at least one visible message
    var visibleThreads = [];
    allThreads.forEach(function(thread) {
        var visibleMessages = thread.messages.filter(function(m) { return visibleIds.has(m.id); });
        if (visibleMessages.length > 0) {
            visibleThreads.push({
                messages: thread.messages, // full thread for expansion
                latest: visibleMessages[0], // newest visible message as the top card
                visibleCount: visibleMessages.length,
                totalCount: thread.messages.length
            });
        }
    });

    // Apply pinned-at-top and unread-at-top sorting to threads
    visibleThreads.sort(function(a, b) {
        // Pinned always at top
        var aPinned = a.latest.pinned ? 1 : 0;
        var bPinned = b.latest.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        // Thread is "unread" if its latest visible message is unread
        if (_emailUnreadTop) {
            var aUnread = !a.latest.email_read ? 1 : 0;
            var bUnread = !b.latest.email_read ? 1 : 0;
            if (aUnread !== bUnread) return bUnread - aUnread;
        }
        // Within same group, sort by newest
        var da = a.latest.email_date || a.latest.start_datetime || '';
        var db = b.latest.email_date || b.latest.start_datetime || '';
        return db.localeCompare(da);
    });

    console.log('[Email Threading] Grouped ' + allEmailChits.length + ' emails into ' + allThreads.length + ' threads, ' +
        visibleThreads.filter(function(t) { return t.totalCount > 1; }).length + ' multi-message threads visible');

    // Pagination: if enabled, only render first PAGE_SIZE threads
    var paginateEnabled = (window._cwocSettings || {}).paginate_email === '1';
    var PAGE_SIZE = 50;
    var totalThreads = visibleThreads.length;
    var threadsToRender = paginateEnabled ? visibleThreads.slice(0, PAGE_SIZE) : visibleThreads;

    threadsToRender.forEach(function(thread) {
        if (thread.totalCount <= 1) {
            // Single message — render as normal card
            scrollWrap.appendChild(_buildEmailCard(thread.latest, viSettings));
        } else {
            // Multi-message thread — render stacked parchment card
            scrollWrap.appendChild(_buildThreadedEmailCard(thread, viSettings));
        }
    });

    // "Load More" button if paginated and there are more threads
    if (paginateEnabled && totalThreads > PAGE_SIZE) {
        var loadMoreWrap = document.createElement('div');
        loadMoreWrap.className = 'email-load-more-wrap';
        var loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'cwoc-btn email-load-more-btn';
        var remaining = totalThreads - PAGE_SIZE;
        loadMoreBtn.textContent = 'Load More (' + remaining + ' remaining)';
        loadMoreBtn.addEventListener('click', function() {
            _emailLoadMoreThreads(scrollWrap, visibleThreads, PAGE_SIZE, viSettings, loadMoreWrap);
        });
        loadMoreWrap.appendChild(loadMoreBtn);
        scrollWrap.appendChild(loadMoreWrap);
    }

    container.appendChild(scrollWrap);
}

/** Current pagination offset — tracks how many threads have been rendered */
var _emailPaginationOffset = 0;

/**
 * Load more threads into the email scroll wrapper (pagination).
 * @param {HTMLElement} scrollWrap — the scroll container
 * @param {Array} allThreads — full array of visible threads
 * @param {number} currentOffset — how many have been rendered so far
 * @param {Object} viSettings — visual indicator settings
 * @param {HTMLElement} loadMoreWrap — the load-more button container to update/remove
 */
function _emailLoadMoreThreads(scrollWrap, allThreads, currentOffset, viSettings, loadMoreWrap) {
    var PAGE_SIZE = 50;
    var nextBatch = allThreads.slice(currentOffset, currentOffset + PAGE_SIZE);

    // Remove the load-more button temporarily
    if (loadMoreWrap.parentNode) loadMoreWrap.remove();

    // Render next batch
    nextBatch.forEach(function(thread) {
        if (thread.totalCount <= 1) {
            scrollWrap.appendChild(_buildEmailCard(thread.latest, viSettings));
        } else {
            scrollWrap.appendChild(_buildThreadedEmailCard(thread, viSettings));
        }
    });

    var newOffset = currentOffset + PAGE_SIZE;
    var remaining = allThreads.length - newOffset;

    // Re-add load-more button if there are still more
    if (remaining > 0) {
        var btn = loadMoreWrap.querySelector('.email-load-more-btn');
        if (btn) btn.textContent = 'Load More (' + remaining + ' remaining)';
        // Update the click handler with new offset
        var newWrap = loadMoreWrap.cloneNode(true);
        newWrap.querySelector('.email-load-more-btn').addEventListener('click', function() {
            _emailLoadMoreThreads(scrollWrap, allThreads, newOffset, viSettings, newWrap);
        });
        scrollWrap.appendChild(newWrap);
    }
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
    // Shows contact image by default, checkbox on hover
    var cbWrap = document.createElement('div');
    cbWrap.className = 'email-cb-wrap';

    // Parse sender early for contact image
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

    // Contact image (shown by default, hidden on hover)
    var contactImg = document.createElement('div');
    contactImg.className = 'email-contact-img';
    var imgUrl = _emailGetContactImage(senderRaw);
    if (imgUrl) {
        contactImg.innerHTML = '<img src="' + imgUrl + '" alt="" class="email-contact-avatar">';
    } else {
        // Fallback: first letter of sender name
        var initial = (senderName || '?').charAt(0).toUpperCase();
        contactImg.innerHTML = '<span class="email-contact-initial">' + initial + '</span>';
    }
    cbWrap.appendChild(contactImg);

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
        // Toggle class for checked state (shows checkbox, hides image)
        cbWrap.classList.toggle('email-cb-checked', cb.checked);
        // Track this checkbox as the last clicked
        var allCbs = Array.from(document.querySelectorAll('.email-select-cb'));
        _emailLastCheckedIndex = allCbs.indexOf(cb);
    };
    cbWrap.appendChild(cb);
    card.appendChild(cbWrap);

    // Pin icon — clickable toggle, right after the face/checkbox
    var pinBtn = document.createElement('button');
    pinBtn.className = 'email-pin-btn';
    pinBtn.title = chit.pinned ? 'Unpin' : 'Pin';
    pinBtn.innerHTML = chit.pinned
        ? '<i class="fas fa-bookmark"></i>'
        : '<i class="far fa-bookmark"></i>';
    if (chit.pinned) pinBtn.classList.add('email-pin-active');
    pinBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Toggle pin
        fetch('/api/chit/' + encodeURIComponent(chit.id))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fullChit) {
                if (!fullChit) return;
                fullChit.pinned = !fullChit.pinned;
                return fetch('/api/chits/' + encodeURIComponent(chit.id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullChit)
                });
            })
            .then(function(r) {
                if (r && r.ok) {
                    chit.pinned = !chit.pinned;
                    pinBtn.innerHTML = chit.pinned
                        ? '<i class="fas fa-bookmark"></i>'
                        : '<i class="far fa-bookmark"></i>';
                    pinBtn.classList.toggle('email-pin-active', chit.pinned);
                    pinBtn.title = chit.pinned ? 'Unpin' : 'Pin';
                    // Re-render to re-sort
                    if (typeof fetchChits === 'function') fetchChits();
                }
            })
            .catch(function(err) { console.error('Pin toggle failed:', err); });
    });
    card.appendChild(pinBtn);

    // Content area — single-row layout:
    // [sender] [subject] [attachments] [preview ............] [tags] [hover actions] [date]
    var content = document.createElement('div');
    content.className = 'email-card-content';

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
        // Collapse all whitespace (tabs, newlines, multiple spaces) to single spaces
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        previewEl.textContent = cleanText.substring(0, 250);
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

    // Attachment icons — inline before preview, max 3 with overflow indicator
    var attachments = chit.attachments;
    if (typeof attachments === 'string') {
        try { attachments = JSON.parse(attachments); } catch(e) { attachments = []; }
    }
    var attInlineEl = null;
    if (Array.isArray(attachments) && attachments.length > 0) {
        attInlineEl = document.createElement('span');
        attInlineEl.className = 'email-inline-attachments';
        var maxAtt = Math.min(attachments.length, 2);
        for (var ai = 0; ai < maxAtt; ai++) {
            var att = attachments[ai];
            var attChip = document.createElement('a');
            attChip.className = 'email-inline-att-chip';
            attChip.href = '/api/chits/' + encodeURIComponent(chit.id) + '/attachments/' + encodeURIComponent(att.id);
            attChip.target = '_blank';
            attChip.title = att.filename || 'Attachment';
            attChip.addEventListener('click', function(e) { e.stopPropagation(); });
            attChip.addEventListener('dblclick', function(e) { e.stopPropagation(); });
            var attIcon = document.createElement('span');
            attIcon.textContent = _emailGetFileIcon(att.mime_type);
            attChip.appendChild(attIcon);
            var attName = document.createElement('span');
            attName.textContent = att.filename || 'file';
            attChip.appendChild(attName);
            attInlineEl.appendChild(attChip);
        }
        if (attachments.length > 2) {
            var moreAtt = document.createElement('span');
            moreAtt.className = 'email-inline-att-more';
            moreAtt.textContent = '+' + (attachments.length - 2);
            moreAtt.title = attachments.length + ' attachments';
            attInlineEl.appendChild(moreAtt);
        }
    }

    // Tag chips — up to 3 non-system tags, shown after preview
    var chitTags = chit.tags;
    if (typeof chitTags === 'string') {
        try { chitTags = JSON.parse(chitTags); } catch(e) { chitTags = []; }
    }
    if (!Array.isArray(chitTags)) chitTags = [];
    var userTags = chitTags.map(function(t) {
        return (typeof t === 'string') ? t : (t && t.name ? t.name : '');
    }).filter(function(name) {
        return name && !isSystemTag(name);
    });
    var tagChipsEl = null;
    if (userTags.length > 0) {
        tagChipsEl = document.createElement('span');
        tagChipsEl.className = 'email-inline-tags';
        var maxTags = Math.min(userTags.length, 3);
        for (var ti = 0; ti < maxTags; ti++) {
            var tagChip = document.createElement('span');
            tagChip.className = 'email-inline-tag-chip';
            var tagColor = typeof _getTagColor === 'function' ? _getTagColor(userTags[ti]) : '#e8dcc8';
            var tagFont = typeof contrastColorForBg === 'function' ? contrastColorForBg(tagColor) : '#1a1208';
            tagChip.style.cssText = 'background:' + tagColor + ';color:' + tagFont + ';';
            tagChip.textContent = userTags[ti];
            tagChip.title = userTags[ti];
            tagChipsEl.appendChild(tagChip);
        }
        if (userTags.length > 3) {
            var moreTag = document.createElement('span');
            moreTag.className = 'email-inline-tag-more';
            moreTag.textContent = '+' + (userTags.length - 3);
            moreTag.title = userTags.slice(3).join(', ');
            tagChipsEl.appendChild(moreTag);
        }
    }

    // Assemble: badges + sender + reply-slot + subject + tags + attachments + preview + actions + date
    if (badgesHtml) {
        var badgeSpan = document.createElement('span');
        badgeSpan.className = 'email-card-badges-inline';
        badgeSpan.innerHTML = badgesHtml;
        content.appendChild(badgeSpan);
    }
    content.appendChild(senderEl);
    content.appendChild(replyEl);
    content.appendChild(subjectEl);
    if (tagChipsEl) content.appendChild(tagChipsEl);
    if (attInlineEl) content.appendChild(attInlineEl);
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

    // Attachment thumbnails row — full display below the content row
    if (Array.isArray(attachments) && attachments.length > 0) {
        var attRow = document.createElement('div');
        attRow.className = 'email-attachment-row';
        attachments.forEach(function(att) {
            var attEl = document.createElement('a');
            attEl.className = 'email-attachment-thumb';
            attEl.href = '/api/chits/' + encodeURIComponent(chit.id) + '/attachments/' + encodeURIComponent(att.id);
            attEl.target = '_blank';
            attEl.title = att.filename || 'Attachment';
            attEl.addEventListener('click', function(e) { e.stopPropagation(); });
            attEl.addEventListener('dblclick', function(e) { e.stopPropagation(); });

            if (att.mime_type && att.mime_type.startsWith('image/')) {
                var img = document.createElement('img');
                img.src = '/api/chits/' + encodeURIComponent(chit.id) + '/attachments/' + encodeURIComponent(att.id);
                img.alt = att.filename || '';
                img.loading = 'lazy';
                img.onerror = function() { this.style.display = 'none'; attEl.textContent = '🖼️'; };
                attEl.appendChild(img);
            } else {
                var iconSpan = document.createElement('span');
                iconSpan.className = 'email-attachment-icon';
                iconSpan.textContent = _emailGetFileIcon(att.mime_type);
                attEl.appendChild(iconSpan);
                var nameSpan = document.createElement('span');
                nameSpan.className = 'email-attachment-name';
                nameSpan.textContent = (att.filename || 'file').length > 12
                    ? (att.filename || 'file').substring(0, 10) + '\u2026'
                    : (att.filename || 'file');
                attEl.appendChild(nameSpan);
            }
            attRow.appendChild(attEl);
        });
        card.appendChild(attRow);
    }

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
        allCbs.forEach(function(cb) {
            cb.checked = false;
            var wrap = cb.closest('.email-cb-wrap');
            if (wrap) wrap.classList.remove('email-cb-checked');
        });
    } else {
        // Select all
        _emailSelectedIds = [];
        allCbs.forEach(function(cb) {
            cb.checked = true;
            var wrap = cb.closest('.email-cb-wrap');
            if (wrap) wrap.classList.add('email-cb-checked');
            if (cb.dataset.chitId) _emailSelectedIds.push(cb.dataset.chitId);
        });
    }
    _emailUpdateBulkBar();
}

/** Clear all selections */
function _emailBulkClear() {
    _emailSelectedIds = [];
    document.querySelectorAll('.email-scroll-wrap .email-select-cb').forEach(function(cb) {
        cb.checked = false;
        var wrap = cb.closest('.email-cb-wrap');
        if (wrap) wrap.classList.remove('email-cb-checked');
    });
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
    document.querySelectorAll('.email-scroll-wrap .email-select-cb').forEach(function(cb) {
        cb.checked = false;
        var wrap = cb.closest('.email-cb-wrap');
        if (wrap) wrap.classList.remove('email-cb-checked');
    });
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
    _emailSetPillSpinners(true);
    fetch('/api/email/sync', { method: 'POST' })
        .then(function(r) {
            console.log('[Email Check Mail] Response status:', r.status);
            return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; });
        })
        .then(function(result) {
            _emailSetPillSpinners(false);
            console.log('[Email Check Mail] Result:', JSON.stringify(result.data));
            if (result.ok && result.data.new_count !== undefined) {
                // Build detailed message with per-account info
                var details = result.data.details || [];
                var detailParts = details.map(function(d) {
                    return d.account + ': ' + d.new + ' new' + (d.skipped_dupes ? ', ' + d.skipped_dupes + ' skipped' : '') + ' (checked ' + d.imap_found + ' since ' + d.since + ')';
                });
                if (detailParts.length) {
                    console.log('[Email Check Mail] ' + detailParts.join(' | '));
                }

                if (result.data.new_count > 0) {
                    var noun = result.data.new_count === 1 ? 'email' : 'emails';
                    var acctNames = details.filter(function(d) { return d.new > 0; }).map(function(d) { return d.account + ' (' + d.new + ')'; });
                    var toastMsg = '📬 ' + result.data.new_count + ' new ' + noun;
                    if (acctNames.length) toastMsg += ' — ' + acctNames.join(', ');
                    cwocToast(toastMsg, 'success', 5000);
                } else {
                    var acctSummary = details.map(function(d) { return d.account + ': checked ' + d.imap_found; }).join(', ');
                    _showToast('No new emails' + (acctSummary ? ' (' + acctSummary + ')' : ''), 'success');
                }

                // Store errors on account pills instead of generic toasts
                if (result.data.errors && result.data.errors.length) {
                    var accounts = (window._cwocSettings || {}).email_accounts || [];
                    result.data.errors.forEach(function(e) {
                        // Parse "email_or_nickname: error message" format
                        var colonIdx = e.indexOf(':');
                        if (colonIdx > 0) {
                            var errAcct = e.substring(0, colonIdx).trim();
                            var errMsg = e.substring(colonIdx + 1).trim();
                            // Find the matching account nickname
                            var matchedNickname = errAcct; // default to what we got
                            accounts.forEach(function(a) {
                                if (a && (a.email === errAcct || a.nickname === errAcct)) {
                                    matchedNickname = a.nickname || a.email;
                                }
                            });
                            _emailAccountErrors[matchedNickname] = errMsg;
                            _emailAccountLastSync[matchedNickname] = new Date().toISOString();
                        }
                    });
                    _emailPersistAccountStatus();
                    _emailRenderAccountFilterButtons();
                }

                // Clear errors for accounts that synced successfully
                var successDetails = result.data.details || [];
                var syncTime = new Date().toISOString();
                successDetails.forEach(function(d) {
                    if (_emailAccountErrors[d.account]) {
                        delete _emailAccountErrors[d.account];
                    }
                    _emailAccountSuccess[d.account] = true;
                    _emailAccountLastSync[d.account] = syncTime;
                });
                _emailPersistAccountStatus();
                _emailRenderAccountFilterButtons();

                if (typeof fetchChits === 'function') fetchChits();
            } else if (result.status === 400 && result.data.detail && result.data.detail.indexOf('No email account') !== -1) {
                console.warn('[Email Check Mail] No email account configured.');
                _emailShowErrorWithSettingsLink('No email account configured.', 'Set up an email account in Settings to start syncing.');
            } else if (result.data.detail) {
                console.error('[Email Check Mail] Error:', result.data.detail);
                _emailShowErrorWithSettingsLink(result.data.detail, 'Check your email account settings.');
            } else {
                console.error('[Email Check Mail] Unexpected response:', result.data);
                _showToast('Unexpected response from server', 'error');
            }
        })
        .catch(function(err) {
            _emailSetPillSpinners(false);
            console.error('[Email Check Mail] Fetch error:', err);
            _emailShowErrorWithSettingsLink('Failed to check mail: ' + err.message, 'Verify your email server settings are correct.');
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
    var folderName = _emailSubFilter || 'inbox';
    // If filtering by specific accounts, show their names
    var allAccounts = ((window._cwocSettings || {}).email_accounts || []).filter(function(a) { return a && a.nickname; });
    var allSelected = _emailAccountFilter.length >= allAccounts.length;
    var acctLabel = '';
    if (!allSelected && _emailAccountFilter.length > 0) {
        acctLabel = _emailAccountFilter.join(', ') + ' ';
    }
    var div = document.createElement('div');
    div.className = 'cwoc-empty';
    div.innerHTML = '<p>No emails in ' + acctLabel + folderName + '.</p>';
    container.appendChild(div);
}

function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/** Get a file type emoji icon for attachment display in email cards */
function _emailGetFileIcon(mimeType) {
    if (!mimeType) return '📎';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.indexOf('pdf') !== -1) return '📄';
    if (mimeType.indexOf('zip') !== -1 || mimeType.indexOf('archive') !== -1 || mimeType.indexOf('compressed') !== -1) return '📦';
    if (mimeType.indexOf('spreadsheet') !== -1 || mimeType.indexOf('excel') !== -1) return '📊';
    if (mimeType.indexOf('presentation') !== -1 || mimeType.indexOf('powerpoint') !== -1) return '📽️';
    if (mimeType.indexOf('word') !== -1 || mimeType.indexOf('document') !== -1) return '📝';
    if (mimeType.startsWith('text/')) return '📃';
    return '📎';
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
    // Strip zero-width / invisible named entities before DOM decode
    text = text.replace(/&zwnj;/gi, '');
    text = text.replace(/&zwj;/gi, '');
    text = text.replace(/&lrm;/gi, '');
    text = text.replace(/&rlm;/gi, '');
    text = text.replace(/&shy;/gi, '');
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
    // Decode any remaining named HTML entities via DOM
    if (text.indexOf('&') !== -1) {
        var entityEl = document.createElement('textarea');
        entityEl.innerHTML = text;
        text = entityEl.value;
    }
    // Strip any zero-width / invisible Unicode characters that survived decoding
    text = text.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u034F]/g, '');
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
        var wrap = allCbs[i].closest('.email-cb-wrap');
        if (wrap) wrap.classList.toggle('email-cb-checked', newState);
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

/** Whether to sort unread emails to the top */
var _emailUnreadTop = false;

/**
 * Toggle unread-at-top sorting.
 * When enabled, unread threads sort to the top (still by newest within each group).
 */
function _toggleEmailUnreadTop() {
    var cb = document.getElementById('email-unread-top-toggle');
    _emailUnreadTop = cb ? cb.checked : !_emailUnreadTop;
    // Update label active states
    var newestLabel = document.getElementById('email-sort-label-newest');
    var unreadLabel = document.getElementById('email-sort-label-unread');
    if (newestLabel) newestLabel.classList.toggle('active', !_emailUnreadTop);
    if (unreadLabel) unreadLabel.classList.toggle('active', _emailUnreadTop);
    if (typeof filterChits === 'function') filterChits('Email');
}

// ═══════════════════════════════════════════════════════════════════════════
// Thread grouping for dashboard display
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Strip Re:/Fwd:/Fw: prefixes from a subject for thread matching.
 * @param {string} subject
 * @returns {string} normalized subject
 */
function _emailNormalizeSubject(subject) {
    if (!subject) return '';
    return subject.replace(/^(re|fwd|fw)\s*:\s*/gi, '').trim().toLowerCase();
}

/**
 * Group an array of email chits into threads.
 * Uses Message-ID / In-Reply-To / References for linking, with normalized
 * subject as a fallback for messages that lack proper headers.
 *
 * @param {Array} emailChits — sorted array of email chits (newest first)
 * @returns {Array} array of thread objects: { messages: [...], latest: chit }
 */
function _emailGroupByThread(emailChits) {
    // Map: message_id -> thread index
    var idToThread = {};
    // Map: normalized subject -> thread index (subject fallback, like backend)
    var subjectToThread = {};
    var threads = []; // Each entry: { messages: [] }

    // Process oldest first so parent messages create threads before replies find them
    var reversed = emailChits.slice().reverse();

    reversed.forEach(function(chit) {
        var msgId = (chit.email_message_id || '').trim();
        var inReplyTo = (chit.email_in_reply_to || '').trim();
        var refs = (chit.email_references || '').trim();
        var rawSubject = (chit.title || chit.email_subject || '');
        var normSubject = _emailNormalizeSubject(rawSubject);
        var hasReplyPrefix = /^(re|fwd|fw)\s*:/i.test(rawSubject.trim());

        var threadIdx = -1;

        // Try to find existing thread by In-Reply-To
        if (inReplyTo && idToThread[inReplyTo] !== undefined) {
            threadIdx = idToThread[inReplyTo];
        }

        // Try References (space-separated list of message IDs)
        if (threadIdx === -1 && refs) {
            var refList = refs.split(/\s+/);
            for (var i = 0; i < refList.length; i++) {
                var r = refList[i].trim();
                if (r && idToThread[r] !== undefined) {
                    threadIdx = idToThread[r];
                    break;
                }
            }
        }

        // Try own message_id (in case already registered by a child)
        if (threadIdx === -1 && msgId && idToThread[msgId] !== undefined) {
            threadIdx = idToThread[msgId];
        }

        // Subject fallback — match by normalized subject (same as backend thread endpoint)
        if (threadIdx === -1 && normSubject && normSubject.length > 3 && subjectToThread[normSubject] !== undefined) {
            threadIdx = subjectToThread[normSubject];
        }

        if (threadIdx === -1) {
            // New thread
            threadIdx = threads.length;
            threads.push({ messages: [chit] });
        } else {
            threads[threadIdx].messages.push(chit);
        }

        // Register this message's ID in the lookup
        if (msgId) idToThread[msgId] = threadIdx;
        // Register subject for fallback (any message can start a subject group)
        if (normSubject && normSubject.length > 3) {
            if (subjectToThread[normSubject] === undefined) {
                subjectToThread[normSubject] = threadIdx;
            }
        }
    });

    // For each thread, sort messages newest-first and pick latest
    threads.forEach(function(t) {
        t.messages.sort(function(a, b) {
            var da = a.email_date || a.start_datetime || '';
            var db = b.email_date || b.start_datetime || '';
            return db.localeCompare(da);
        });
        t.latest = t.messages[0];
    });

    // Sort threads by their latest message date (newest thread first)
    threads.sort(function(a, b) {
        var da = a.latest.email_date || a.latest.start_datetime || '';
        var db = b.latest.email_date || b.latest.start_datetime || '';
        return db.localeCompare(da);
    });

    return threads;
}

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
// Threaded email card (stacked parchment visual)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a stacked parchment card for a multi-message thread.
 * Shows the latest message as the visible card with stacked layers behind it
 * and a thread count badge. Clicking the badge expands inline to show all messages.
 *
 * @param {Object} thread — { messages: [...], latest: chit }
 * @param {Object} viSettings — visual indicator settings
 * @returns {HTMLElement}
 */
function _buildThreadedEmailCard(thread, viSettings) {
    var wrapper = document.createElement('div');
    wrapper.className = 'email-thread-group';

    // Determine stack depth visual (cap at 3 layers)
    var depth = Math.min(thread.totalCount - 1, 3);

    // Build the main (latest visible) card
    var mainCard = _buildEmailCard(thread.latest, viSettings);
    mainCard.classList.add('email-thread-top-card');

    // Thread ribbon — vertical bar on the left edge
    var ribbon = document.createElement('div');
    ribbon.className = 'email-thread-ribbon';
    ribbon.dataset.depth = depth;
    wrapper.appendChild(ribbon);

    // Insert thread count badge inline — after sender, before subject
    var content = mainCard.querySelector('.email-card-content');
    var senderEl = content && content.querySelector('.email-card-sender');
    if (senderEl) {
        var badge = document.createElement('span');
        badge.className = 'email-thread-badge';
        badge.textContent = thread.totalCount;
        badge.title = thread.totalCount + ' messages in this thread — click to expand';
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            _toggleThreadExpand(wrapper, thread, viSettings);
        });
        senderEl.after(badge);
    }

    wrapper.appendChild(mainCard);

    // Expanded thread container (hidden initially)
    var expandedList = document.createElement('div');
    expandedList.className = 'email-thread-expanded';
    expandedList.style.display = 'none';
    wrapper.appendChild(expandedList);

    return wrapper;
}

/**
 * Toggle inline expansion of a threaded email group.
 * @param {HTMLElement} wrapper — the .email-thread-group element
 * @param {Object} thread — { messages: [...], latest: chit, totalCount, visibleCount }
 * @param {Object} viSettings
 */
function _toggleThreadExpand(wrapper, thread, viSettings) {
    var expanded = wrapper.querySelector('.email-thread-expanded');
    if (!expanded) return;

    var isOpen = expanded.style.display !== 'none';
    if (isOpen) {
        // Collapse
        expanded.style.display = 'none';
        wrapper.classList.remove('email-thread-group-expanded');
    } else {
        // Expand — populate if empty
        if (expanded.children.length === 0) {
            // Show all messages in the thread (full cross-folder view)
            thread.messages.forEach(function(chit) {
                if (chit.id === thread.latest.id) return; // skip the top card
                var card = _buildEmailCard(chit, viSettings);
                card.classList.add('email-thread-child-card');
                // Add folder indicator for messages from other folders
                var folder = chit.email_folder || '';
                if (folder && folder !== _emailSubFilter) {
                    // Don't add folder tag if the status badge already shows the same info
                    var status = chit.email_status || '';
                    var redundant = (folder === 'sent' && status === 'sent') ||
                                    (folder === 'drafts' && status === 'draft');
                    if (!redundant) {
                        var folderTag = document.createElement('span');
                        folderTag.className = 'email-thread-folder-tag';
                        folderTag.textContent = folder;
                        card.querySelector('.email-card-content').prepend(folderTag);
                    }
                }
                expanded.appendChild(card);
            });
        }
        expanded.style.display = '';
        wrapper.classList.add('email-thread-group-expanded');
    }
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
