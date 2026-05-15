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
    // Hide the general "Show Email" filters on the Email tab (redundant there)
    var showRecvLabel = document.getElementById('show-email-received');
    var showSentLabel = document.getElementById('show-email-sent');
    if (showRecvLabel) showRecvLabel.closest('label').style.display = (tab === 'Email') ? 'none' : '';
    if (showSentLabel) showSentLabel.closest('label').style.display = (tab === 'Email') ? 'none' : '';
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
        // Bundle fetch is now triggered by _renderBundleToolbar when the Email view renders
        // (after fetchChits succeeds, guaranteeing auth is valid)
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
            console.debug('[Email] Auto-check mail (interval: ' + interval + 'm)');
            _checkMail();
        }, ms);
        console.debug('[Email] Auto-check scheduled every ' + interval + ' min');
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

        // Read undo delay from settings (default 5 seconds)
        var delaySec = (window._cwocSettings && window._cwocSettings.email_undo_send_delay)
            ? parseInt(window._cwocSettings.email_undo_send_delay, 10) || 5 : 5;

        var chitId = pending.chitId;
        var archiveOriginal = pending.archiveOriginal;
        var inReplyTo = pending.inReplyTo;

        cwocUndoToast('✉️ Sending email...', {
            duration: delaySec * 1000,
            onExpire: function() { _emailDoActualSendFromDash(chitId, archiveOriginal, inReplyTo); },
            onUndo: function() { cwocToast('Send cancelled.', 'info'); },
            id: 'emailUndoSendToast'
        });
    } catch (e) {
        console.error('[Email] Failed to parse pending send:', e);
    }
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
            cwocToast(errData.detail || 'Send failed.', 'error');
            return;
        }

        cwocToast('Email sent successfully.', 'success');

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
        cwocToast('Failed to send email.', 'error');
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
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Drafts') && c.email_status === 'draft' && !c.archived && !c.email_send_at; });
    } else if (_emailSubFilter === 'scheduled') {
        emailChits = emailChits.filter(function(c) { return c.email_status === 'draft' && c.email_send_at && !c.archived; });
    } else if (_emailSubFilter === 'trash') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Trash'); });
    } else if (_emailSubFilter === 'archived') {
        emailChits = emailChits.filter(function(c) { return !!c.archived; });
    }

    // Apply account filter (multi-select by nickname system tag)
    // If no accounts are selected (all deselected), show no emails
    // If all accounts are selected, show all (skip filtering)
    var allAccounts = ((window._cwocSettings || {}).email_accounts || []).filter(function(a) { return a && a.nickname; });
    var allSelected = _emailAccountFilter.length >= allAccounts.length;
    if (_emailAccountFilter.length === 0 && _emailAccountFilterInitialized && allAccounts.length > 0) {
        // No accounts selected — show nothing
        emailChits = [];
    } else if (_emailAccountFilter.length > 0 && !allSelected) {
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

    // Apply bundle filter (only when sub-filter is "inbox" AND bundles data is loaded)
    var allInboxChits = emailChits.slice(); // Keep full list for bundle tab counts
    if (_emailSubFilter === 'inbox' && typeof _filterByBundle === 'function' && _emailActiveBundle && _emailBundlesData) {
        emailChits = _filterByBundle(emailChits, _emailActiveBundle);
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
        // Still show bundle toolbar even when no emails match — use FULL inbox for counts
        if (typeof _renderBundleToolbar === 'function') {
            var bundleToolbar = _renderBundleToolbar(allInboxChits);
            container.appendChild(bundleToolbar);
        }
        _emailEmptyState(container);
        return;
    }

    // Permanent bundle toolbar — pass FULL inbox list for accurate counts on all tabs
    if (typeof _renderBundleToolbar === 'function') {
        var bundleToolbar = _renderBundleToolbar(allInboxChits);
        container.appendChild(bundleToolbar);
    }

    // Get visual indicator settings
    var viSettings = (window._cwocSettings || {}).visual_indicators || {};

    // Scrollable wrapper for email cards
    var scrollWrap = document.createElement('div');
    scrollWrap.className = 'email-scroll-wrap';

    // Render email cards — always threaded
    // Build thread map from ALL emails (cross-folder), then filter to visible
    var allThreads = _emailGroupByThread(allEmailChits);

    // Inject nested chits (non-email chits with nest_thread_id) into threads
    _emailInjectNests(allThreads);

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

    console.debug('[Email Threading] Grouped ' + allEmailChits.length + ' emails into ' + allThreads.length + ' threads, ' +
        visibleThreads.filter(function(t) { return t.totalCount > 1; }).length + ' multi-message threads visible');

    // Pagination: if enabled, only render first PAGE_SIZE threads
    var paginateEnabled = (window._cwocSettings || {}).paginate_email === '1';
    var PAGE_SIZE = 50;
    var totalThreads = visibleThreads.length;
    var threadsToRender = paginateEnabled ? visibleThreads.slice(0, PAGE_SIZE) : visibleThreads;

    // Date grouping: insert headers between date boundaries
    var groupBy = (window._cwocSettings || {}).email_group_by || 'date';
    var lastGroup = null;

    threadsToRender.forEach(function(thread) {
        // Insert date group header if grouping is enabled
        if (groupBy === 'date') {
            var groupLabel = _emailGetDateGroup(thread.latest);
            if (groupLabel !== lastGroup) {
                lastGroup = groupLabel;
                var header = document.createElement('div');
                header.className = 'email-date-group-header';
                header.textContent = groupLabel;
                scrollWrap.appendChild(header);
            }
        }

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
        var img = document.createElement('img');
        img.src = imgUrl;
        img.alt = '';
        img.className = 'email-contact-avatar';
        img.onerror = function() {
            console.warn('[CWOC] Missing profile image for email contact "' + (senderName || senderRaw || 'unknown') + '": ' + imgUrl);
            var initial = (senderName || '?').charAt(0).toUpperCase();
            contactImg.innerHTML = '<span class="email-contact-initial">' + initial + '</span>';
        };
        contactImg.appendChild(img);
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
        if (cb.checked) {
            cbWrap.classList.add('email-cb-checked');
        } else {
            // Delay reverting to contact image so the uncheck is visible first
            setTimeout(function() {
                if (!cb.checked) cbWrap.classList.remove('email-cb-checked');
            }, 1000);
        }
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
        var newPinned = !chit.pinned;
        fetch('/api/chits/' + encodeURIComponent(chit.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: newPinned })
        })
            .then(function(r) {
                if (r && r.ok) {
                    chit.pinned = newPinned;
                    // Update global chits array
                    if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                        var found = chits.find(function(c) { return c.id === chit.id; });
                        if (found) found.pinned = newPinned;
                    }
                    pinBtn.innerHTML = newPinned
                        ? '<i class="fas fa-bookmark"></i>'
                        : '<i class="far fa-bookmark"></i>';
                    pinBtn.classList.toggle('email-pin-active', newPinned);
                    pinBtn.title = newPinned ? 'Unpin' : 'Pin';
                    // Re-render to re-sort (pinned goes to top)
                    if (typeof displayChits === 'function') displayChits();
                } else {
                    console.error('[Email] Pin toggle failed:', r.status);
                }
            })
            .catch(function(err) { console.error('[Email] Pin toggle failed:', err); });
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

    // Parse attachments for the thumbnail row below
    var attachments = chit.attachments;
    if (typeof attachments === 'string') {
        try { attachments = JSON.parse(attachments); } catch(e) { attachments = []; }
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
    content.appendChild(previewEl);

    // Attachment thumbnails — inline, between preview and hover actions
    if (Array.isArray(attachments) && attachments.length > 0) {
        var attRow = document.createElement('span');
        attRow.className = 'email-attachment-row';
        attachments.forEach(function(att) {
            var attUrl = '/api/chits/' + encodeURIComponent(chit.id) + '/attachments/' + encodeURIComponent(att.id);
            var attEl = document.createElement('a');
            attEl.className = 'email-attachment-thumb';
            attEl.href = attUrl;
            attEl.title = (att.filename || 'Attachment') + ' (click to preview, shift+click to download)';
            attEl.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+click: download directly
                    var dl = document.createElement('a');
                    dl.href = attUrl;
                    dl.download = att.filename || 'attachment';
                    document.body.appendChild(dl);
                    dl.click();
                    document.body.removeChild(dl);
                } else {
                    // Normal click: preview modal
                    if (typeof cwocAttachmentPreview === 'function') {
                        cwocAttachmentPreview(attUrl, att.filename || 'Attachment', att.mime_type || '');
                    } else {
                        window.open(attUrl, '_blank');
                    }
                }
            });
            // Right-click: show attachment-specific context menu (View / Download)
            attEl.addEventListener('contextmenu', function(e) {
                e.stopPropagation();
                e.preventDefault();
                _showAttachmentContextMenu(e, attUrl, att.filename || 'Attachment', att.mime_type || '');
            });
            attEl.addEventListener('dblclick', function(e) { e.stopPropagation(); });

            if (att.mime_type && att.mime_type.startsWith('image/')) {
                var img = document.createElement('img');
                img.src = attUrl;
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
                nameSpan.textContent = att.filename || 'file';
                attEl.appendChild(nameSpan);
            }
            attRow.appendChild(attEl);
        });
        content.appendChild(attRow);
    }

    // Smart link badges — detect tracking numbers, flights, hotels, etc.
    var smartLinks = (typeof detectSmartLinks === 'function') ? detectSmartLinks(chit) : [];
    if (smartLinks.length > 0) {
        var slWrap = document.createElement('div');
        slWrap.className = 'email-smart-links';
        smartLinks.forEach(function(link) {
            var btn = document.createElement('a');
            btn.className = 'email-track-btn';
            btn.href = link.url;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.title = link.name + (link.code ? ': ' + link.code : '');
            btn.addEventListener('click', function(e) { e.stopPropagation(); });
            btn.addEventListener('dblclick', function(e) { e.stopPropagation(); });
            var img = document.createElement('img');
            img.src = link.icon;
            img.alt = link.name;
            img.className = 'email-track-logo';
            img.onerror = function() { this.style.display = 'none'; };
            btn.appendChild(img);
            var lbl = document.createElement('span');
            lbl.className = 'email-track-label';
            lbl.textContent = link.label;
            btn.appendChild(lbl);
            slWrap.appendChild(btn);
        });
        content.appendChild(slWrap);
    }

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

    // Right-click: open context menu
    card.addEventListener('contextmenu', function(e) {
        if (e.target.classList.contains('email-select-cb')) return;
        e.preventDefault();
        if (typeof _showChitContextMenu === 'function') {
            _showChitContextMenu(e, chit, function() { if (typeof displayChits === 'function') displayChits(); });
        }
    });

    // ── Swipe gesture: right → archive, left → delete ────────────────────
    (function(_card, _chit) {
        var _swStartX = 0;
        var _swStartY = 0;
        var _swDragging = false;
        var _swIndicator = null;
        var _swThreshold = 0.4; // 40% of card width to trigger
        var _swDragOffset = 0; // offset at the moment dragging starts

        _card.addEventListener('touchstart', function(e) {
            if (e.target.closest('.email-select-cb, .email-hover-btn, .email-pin-btn, a')) return;
            var touch = e.touches[0];
            _swStartX = touch.clientX;
            _swStartY = touch.clientY;
            _swDragging = false;
            _swDragOffset = 0;
        }, { passive: true });

        _card.addEventListener('touchmove', function(e) {
            if (_swStartX === null) return;
            var touch = e.touches[0];
            var dx = touch.clientX - _swStartX;
            var dy = touch.clientY - _swStartY;

            // If vertical movement dominates, don't swipe
            if (!_swDragging && Math.abs(dy) > Math.abs(dx)) {
                _swStartX = null;
                return;
            }

            // Start swiping after 10px horizontal
            if (!_swDragging && Math.abs(dx) > 10) {
                _swDragging = true;
                _swDragOffset = dx; // remember the offset so card starts from 0
                window._emailSwipeActive = true;
                _card.style.transition = 'none';
                _card.style.zIndex = '10';
                _card.style.position = 'relative';

                // Create indicator as a sibling behind the card
                _swIndicator = document.createElement('div');
                _swIndicator.className = 'email-swipe-indicator';
                var rect = _card.getBoundingClientRect();
                _swIndicator.style.cssText = 'position:absolute;top:' + (_card.offsetTop) + 'px;left:0;right:0;height:' + rect.height + 'px;display:flex;align-items:center;padding:0 1.5em;font-family:Lora,Georgia,serif;font-size:0.95em;font-weight:bold;border-radius:4px;pointer-events:none;box-sizing:border-box;';
                _card.parentNode.style.position = 'relative';
                _card.parentNode.insertBefore(_swIndicator, _card);
            }

            if (_swDragging) {
                e.preventDefault();
                var visualDx = dx - _swDragOffset; // starts from 0
                _card.style.transform = 'translateX(' + visualDx + 'px)';

                // Update indicator based on direction
                if (visualDx > 0) {
                    _swIndicator.style.justifyContent = 'flex-start';
                    _swIndicator.style.background = '#d4edda';
                    _swIndicator.style.color = '#155724';
                    _swIndicator.innerHTML = '<i class="fas fa-archive" style="margin-right:8px;font-size:1.2em;"></i> Archive';
                    var pctR = Math.min(Math.abs(visualDx) / (_card.offsetWidth * _swThreshold), 1);
                    _swIndicator.style.opacity = String(0.4 + pctR * 0.6);
                } else {
                    _swIndicator.style.justifyContent = 'flex-end';
                    _swIndicator.style.background = '#f8d7da';
                    _swIndicator.style.color = '#721c24';
                    _swIndicator.innerHTML = 'Delete <i class="fas fa-trash" style="margin-left:8px;font-size:1.2em;"></i>';
                    var pctL = Math.min(Math.abs(visualDx) / (_card.offsetWidth * _swThreshold), 1);
                    _swIndicator.style.opacity = String(0.4 + pctL * 0.6);
                }
            }
        }, { passive: false });

        _card.addEventListener('touchend', function(e) {
            if (!_swDragging) { _swStartX = null; return; }
            _swDragging = false;
            window._emailSwipeActive = false;

            var touch = e.changedTouches[0];
            var dx = touch.clientX - _swStartX;
            var visualDx = dx - _swDragOffset;
            var cardWidth = _card.offsetWidth;
            var triggered = Math.abs(visualDx) > cardWidth * _swThreshold;

            if (triggered && visualDx > 0) {
                // Complete right swipe → archive
                _card.style.transition = 'transform 0.2s ease-out';
                _card.style.transform = 'translateX(' + cardWidth + 'px)';
                setTimeout(function() {
                    if (_swIndicator) { _swIndicator.remove(); _swIndicator = null; }
                    _card.style.transform = '';
                    _card.style.transition = '';
                    _card.style.position = '';
                    _card.style.zIndex = '';
                    _emailQuickArchive(_chit, _card);
                }, 200);
            } else if (triggered && visualDx < 0) {
                // Complete left swipe → delete
                _card.style.transition = 'transform 0.2s ease-out';
                _card.style.transform = 'translateX(-' + cardWidth + 'px)';
                setTimeout(function() {
                    if (_swIndicator) { _swIndicator.remove(); _swIndicator = null; }
                    _card.style.transform = '';
                    _card.style.transition = '';
                    _card.style.position = '';
                    _card.style.zIndex = '';
                    _emailQuickDelete(_chit, _card);
                }, 200);
            } else {
                // Snap back
                _card.style.transition = 'transform 0.25s ease-out';
                _card.style.transform = 'translateX(0)';
                setTimeout(function() {
                    if (_swIndicator) { _swIndicator.remove(); _swIndicator = null; }
                    _card.style.transition = '';
                    _card.style.position = '';
                    _card.style.zIndex = '';
                }, 250);
            }
            _swStartX = null;
        });

        _card.addEventListener('touchcancel', function() {
            if (_swDragging) {
                _swDragging = false;
                window._emailSwipeActive = false;
                _card.style.transition = 'transform 0.25s ease-out';
                _card.style.transform = 'translateX(0)';
                setTimeout(function() {
                    if (_swIndicator) { _swIndicator.remove(); _swIndicator = null; }
                    _card.style.transition = '';
                    _card.style.position = '';
                    _card.style.zIndex = '';
                }, 250);
            }
            _swStartX = null;
        });
    })(card, chit);

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
// Tracking number & flight detection (legacy — now in shared-smart-links.js)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Legacy wrapper — delegates to shared detectSmartLinkFirst().
 * Kept for backward compatibility with any code referencing this function.
 * @param {Object} chit - The email chit object
 * @returns {Object|null} { carrier, number, url, logo } or null
 */
function _emailDetectTracking(chit) {
    if (typeof detectSmartLinkFirst === 'function') {
        return detectSmartLinkFirst(chit);
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Multi-select and bulk actions
// ═══════════════════════════════════════════════════════════════════════════

/** Toggle a chit's selection state */
function _emailToggleSelect(chitId, checked) {
    if (checked && _emailSelectedIds.indexOf(chitId) === -1) {
        _emailSelectedIds.push(chitId);
    } else if (!checked) {
        _emailSelectedIds = _emailSelectedIds.filter(function(id) { return id !== chitId; });
    }
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
    if (_emailSelectedIds.length === 0) return;
    var count = _emailSelectedIds.length;
    console.debug('[Email Bulk Archive] Archiving ' + count + ' items');
    var successCount = 0;
    var failCount = 0;
    for (var i = 0; i < _emailSelectedIds.length; i++) {
        var chitId = _emailSelectedIds[i];
        try {
            var resp = await fetch('/api/chit/' + encodeURIComponent(chitId));
            if (!resp.ok) {
                console.error('[Email Bulk Archive] GET failed for ' + chitId + ':', resp.status);
                failCount++;
                continue;
            }
            var chit = await resp.json();
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
            var putResp = await fetch('/api/chits/' + encodeURIComponent(chitId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chit)
            });
            if (!putResp.ok) {
                console.error('[Email Bulk Archive] PUT failed for ' + chitId + ':', putResp.status);
                failCount++;
            } else {
                successCount++;
            }
        } catch (e) {
            console.error('[Email Bulk Archive] Exception for ' + chitId + ':', e);
            failCount++;
        }
    }
    console.debug('[Email Bulk Archive] Done. Success: ' + successCount + ', Failed: ' + failCount);
    if (failCount > 0) {
        cwocToast(successCount + ' archived, ' + failCount + ' failed', failCount === count ? 'error' : 'info');
    } else {
        cwocToast(count + ' email(s) archived', 'success');
    }
    _emailSelectedIds = [];
    if (typeof fetchChits === 'function') fetchChits();
}

/** Bulk toggle read/unread for all selected emails */
async function _emailBulkToggleRead() {
    if (_emailSelectedIds.length === 0) return;
    var count = _emailSelectedIds.length;
    console.debug('[Email Bulk Read] Toggling ' + count + ' items');
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
    if (typeof _refreshBundleTabCounts === 'function') _refreshBundleTabCounts();
    if (failCount > 0) {
        cwocToast(successCount + ' toggled, ' + failCount + ' failed', failCount === count ? 'error' : 'info');
    } else {
        cwocToast(count + ' email(s) read status toggled', 'success');
    }
    _emailSelectedIds = [];
    document.querySelectorAll('.email-scroll-wrap .email-select-cb').forEach(function(cb) {
        cb.checked = false;
        var wrap = cb.closest('.email-cb-wrap');
        if (wrap) wrap.classList.remove('email-cb-checked');
    });
    _emailUpdateBulkBar();
}

/** Bulk delete (soft-delete) selected emails */
async function _emailBulkDelete() {
    if (_emailSelectedIds.length === 0) return;
    var count = _emailSelectedIds.length;

    var confirmed = await cwocConfirm('Delete ' + count + ' email(s)? They will be moved to Trash.');
    if (!confirmed) return;

    console.debug('[Email Bulk Delete] Deleting ' + count + ' items');
    var successCount = 0;
    var failCount = 0;
    for (var i = 0; i < _emailSelectedIds.length; i++) {
        var chitId = _emailSelectedIds[i];
        try {
            var resp = await fetch('/api/chits/' + encodeURIComponent(chitId), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!resp.ok) {
                console.error('[Email Bulk Delete] DELETE failed for ' + chitId + ':', resp.status);
                failCount++;
            } else {
                successCount++;
            }
        } catch (e) {
            console.error('[Email Bulk Delete] Exception for ' + chitId + ':', e);
            failCount++;
        }
    }
    console.debug('[Email Bulk Delete] Done. Success: ' + successCount + ', Failed: ' + failCount);
    if (failCount > 0) {
        cwocToast(successCount + ' deleted, ' + failCount + ' failed', failCount === count ? 'error' : 'info');
    } else {
        cwocToast(count + ' email(s) moved to Trash', 'success');
    }
    _emailSelectedIds = [];
    if (typeof fetchChits === 'function') fetchChits();
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
        console.debug('[Email Bulk Tag] Tags to apply:', tagsToApply, 'to', _emailSelectedIds.length, 'chits');
        if (tagsToApply.length === 0) {
            cwocToast('No tags selected', 'info');
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
        cwocToast(successCount + '/' + count + ' email(s) tagged', successCount > 0 ? 'success' : 'error');
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
    console.debug('[Email] Syncing...');
    cwocToast('Checking mail...', 'info');
    _emailSetPillSpinners(true);
    fetch('/api/email/sync', { method: 'POST' })
        .then(function(r) {
            return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; });
        })
        .then(function(result) {
            _emailSetPillSpinners(false);
            if (result.ok && result.data.new_count !== undefined) {
                // Build detailed message with per-account info
                var details = result.data.details || [];
                var detailParts = details.map(function(d) {
                    return d.account + ': ' + d.new + ' new' + (d.skipped_dupes ? ', ' + d.skipped_dupes + ' skipped' : '') + ' (checked ' + d.imap_found + ' since ' + d.since + ')';
                });
                if (detailParts.length) {
                    console.debug('[Email Check Mail] ' + detailParts.join(' | '));
                }

                if (result.data.new_count > 0) {
                    var noun = result.data.new_count === 1 ? 'email' : 'emails';
                    var acctNames = details.filter(function(d) { return d.new > 0; }).map(function(d) { return d.account + ' (' + d.new + ')'; });
                    var toastMsg = '📬 ' + result.data.new_count + ' new ' + noun;
                    if (acctNames.length) toastMsg += ' — ' + acctNames.join(', ');
                    cwocToast(toastMsg, 'success', 5000);
                } else {
                    var acctSummary = details.map(function(d) { return d.account + ': checked ' + d.imap_found; }).join(', ');
                    cwocToast('No new emails' + (acctSummary ? ' (' + acctSummary + ')' : ''), 'success');
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
                cwocToast('Unexpected response from server', 'error');
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

/**
 * Show a small context menu for an attachment with View and Download options.
 * @param {MouseEvent} e — the contextmenu event
 * @param {string} url — attachment download URL
 * @param {string} filename — display name
 * @param {string} mimeType — MIME type
 */
function _showAttachmentContextMenu(e, url, filename, mimeType) {
    // Remove any existing
    var existing = document.querySelector('.cwoc-attachment-ctx-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'cwoc-attachment-ctx-menu';
    menu.style.cssText = 'position:fixed;z-index:10002;background:#fffaf0;border:1px solid #6b4e31;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);padding:4px 0;font-family:Lora,Georgia,serif;font-size:0.9em;min-width:140px;';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    function _item(icon, label, onClick) {
        var el = document.createElement('div');
        el.style.cssText = 'padding:6px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;color:#1a1208;';
        el.innerHTML = icon + ' ' + label;
        el.addEventListener('mouseenter', function() { el.style.background = 'rgba(139,90,43,0.1)'; });
        el.addEventListener('mouseleave', function() { el.style.background = ''; });
        el.addEventListener('click', function(ev) {
            ev.stopPropagation();
            menu.remove();
            onClick();
        });
        menu.appendChild(el);
    }

    _item('<i class="fas fa-eye"></i>', 'View', function() {
        if (typeof cwocAttachmentPreview === 'function') {
            cwocAttachmentPreview(url, filename, mimeType);
        } else {
            window.open(url, '_blank');
        }
    });

    _item('<i class="fas fa-download"></i>', 'Download', function() {
        var dl = document.createElement('a');
        dl.href = url;
        dl.download = filename;
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
    });

    document.body.appendChild(menu);

    // Close on click outside
    function _closeMenu(ev) {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', _closeMenu);
            document.removeEventListener('contextmenu', _closeMenu);
        }
    }
    setTimeout(function() {
        document.addEventListener('click', _closeMenu);
        document.addEventListener('contextmenu', _closeMenu);
    }, 10);
}

/**
 * Determine the date group label for an email chit.
 * Returns: "Today", "Yesterday", "Last Week", or "Older"
 * Based on the email's most recent date (email_date or start_datetime).
 */
function _emailGetDateGroup(chit) {
    var dateStr = chit.email_date || chit.start_datetime || chit.created_datetime || '';
    if (!dateStr) return 'Older';

    var emailDate = new Date(dateStr);
    if (isNaN(emailDate.getTime())) return 'Older';

    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    var lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    var emailDay = new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate());

    if (emailDay >= today) return 'Today';
    if (emailDay >= yesterday) return 'Yesterday';
    if (emailDay >= lastWeekStart) return 'Last Week';
    return 'Older';
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

// _escHtml — now in shared-utils.js (single source of truth)

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

// _showToast — removed, use cwocToast() from shared-utils.js directly


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
            cwocToast('Failed to toggle read status', 'error');
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

        // Refresh bundle tab counts
        if (typeof _refreshBundleTabCounts === 'function') _refreshBundleTabCounts();

        cwocToast(data.email_read ? 'Marked as read' : 'Marked as unread', 'success');
    } catch (err) {
        console.error('[Email] Toggle read error:', err);
        cwocToast('Failed to toggle read status', 'error');
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

// ═══════════════════════════════════════════════════════════════════════════
// Nest injection — inject non-email chits into their associated threads
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inject nested chits (non-email chits with nest_thread_id) into their
 * associated email threads. Called after _emailGroupByThread() completes.
 *
 * Nested chits are sorted within the thread:
 *   1. Chits with due_date — ascending by due_date
 *   2. Chits with only start_datetime — ascending by start_datetime
 *   3. Chits with neither date — placed after the top email
 *
 * Invariants:
 *   - Nested chits are marked with _isNest = true
 *   - Nested chits never appear as the topmost card (index 0 / latest)
 *   - Nested chits never appear independently in the email inbox list
 *
 * @param {Array} threads — array of thread objects from _emailGroupByThread
 *        Each thread: { messages: [...], latest: chit }
 * @returns {Array} the same threads array, mutated with injected nests
 */
function _emailInjectNests(threads) {
    // Get all loaded chits from the global array
    if (typeof chits === 'undefined' || !Array.isArray(chits)) return threads;

    // Find all non-email chits with a non-null nest_thread_id
    var nestedChits = chits.filter(function(c) {
        if (!c.nest_thread_id) return false;
        // Must not be an email chit itself
        if (c.email_message_id || c.email_status) return false;
        // Must not be deleted
        if (c.deleted) return false;
        return true;
    });

    if (nestedChits.length === 0) return threads;

    // Build a lookup: chit ID -> thread index, for all email chits in all threads
    var chitIdToThreadIdx = {};
    for (var i = 0; i < threads.length; i++) {
        var msgs = threads[i].messages;
        for (var j = 0; j < msgs.length; j++) {
            chitIdToThreadIdx[msgs[j].id] = i;
        }
    }

    // Inject each nested chit into its target thread
    nestedChits.forEach(function(nestChit) {
        var threadIdx = chitIdToThreadIdx[nestChit.nest_thread_id];
        if (threadIdx === undefined) return; // target thread not found

        // Mark as nest
        var injected = Object.assign({}, nestChit);
        injected._isNest = true;

        threads[threadIdx].messages.push(injected);
    });

    // Re-sort each thread's messages: emails first (newest-first), then nests sorted by date
    threads.forEach(function(thread) {
        var emailMsgs = [];
        var nestMsgs = [];

        thread.messages.forEach(function(m) {
            if (m._isNest) {
                nestMsgs.push(m);
            } else {
                emailMsgs.push(m);
            }
        });

        // Emails stay sorted newest-first (already sorted by _emailGroupByThread)
        // Sort nested chits: due_date ascending, then start_datetime ascending, then no-date
        nestMsgs.sort(function(a, b) {
            var aDue = a.due_date || a.due_datetime || '';
            var bDue = b.due_date || b.due_datetime || '';
            var aStart = a.start_datetime || '';
            var bStart = b.start_datetime || '';

            // Group: has due_date, has only start_datetime, has neither
            var aGroup = aDue ? 0 : (aStart ? 1 : 2);
            var bGroup = bDue ? 0 : (bStart ? 1 : 2);

            if (aGroup !== bGroup) return aGroup - bGroup;

            // Within same group, sort ascending by the relevant date
            if (aGroup === 0) return aDue.localeCompare(bDue);
            if (aGroup === 1) return aStart.localeCompare(bStart);
            // Group 2 (no dates) — stable order (preserve original array order)
            return 0;
        });

        // Rebuild messages: top email first, then nests, then remaining emails
        // This ensures the top card (index 0) is always an email
        var topEmail = emailMsgs[0]; // newest email = top card
        var restEmails = emailMsgs.slice(1);

        // Final order: [top email] + [sorted nests] + [remaining emails newest-first]
        thread.messages = [topEmail].concat(nestMsgs).concat(restEmails);

        // Ensure latest is always an email chit (never a nest)
        thread.latest = topEmail;
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
// Nested chit card (for chits injected into email threads)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a card for a nested (non-email) chit displayed within an email thread.
 * Uses the same card structure as email cards but with a nest icon (fa-dove)
 * replacing email-specific indicators (read/unread dot, reply arrow).
 *
 * @param {Object} chit — the nested chit object (has _isNest = true)
 * @returns {HTMLElement} The nested chit card element
 */
function _buildNestedChitCard(chit) {
    var card = document.createElement('div');
    card.className = 'chit-card email-card email-nest-card';
    card.dataset.chitId = chit.id;
    if (typeof applyChitColors === 'function') {
        var bg = typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3';
        applyChitColors(card, bg);
        card._contrastColor = typeof contrastColorForBg === 'function' ? contrastColorForBg(bg) : null;
    }

    // Nest icon (replaces the checkbox/contact image area)
    var nestIconWrap = document.createElement('div');
    nestIconWrap.className = 'email-cb-wrap email-nest-icon';
    nestIconWrap.innerHTML = '<img src="/static/nest-eggs.svg" style="height:1.2em;vertical-align:middle;" alt="" />';
    nestIconWrap.title = 'Nested chit';
    card.appendChild(nestIconWrap);

    // Content area — same structure as email cards
    var content = document.createElement('div');
    content.className = 'email-card-content';

    // Title (replaces sender in email cards)
    var titleEl = document.createElement('span');
    titleEl.className = 'email-card-sender';
    titleEl.textContent = chit.title || '(Untitled)';
    titleEl.title = chit.title || '';

    // Content preview — first line of note, or checklist summary, or status
    var previewEl = document.createElement('span');
    previewEl.className = 'email-card-preview';
    var previewText = _nestGetContentPreview(chit);
    if (previewText) {
        previewEl.textContent = previewText;
    }

    // Date — show due_date or start_datetime if available
    var dateEl = document.createElement('span');
    dateEl.className = 'email-meta-date';
    var nestDate = chit.due_date || chit.due_datetime || chit.start_datetime || '';
    if (nestDate) {
        dateEl.textContent = _emailFormatDateSmart(nestDate);
    }

    // Assemble content
    content.appendChild(titleEl);
    content.appendChild(previewEl);
    content.appendChild(dateEl);

    // Apply contrast-safe text colors when a custom chit color is set
    if (card._contrastColor) {
        titleEl.style.color = card._contrastColor;
        previewEl.style.color = card._contrastColor;
        dateEl.style.color = card._contrastColor;
    }

    card.appendChild(content);

    // Click navigates to editor
    card.addEventListener('dblclick', function(e) {
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(chit.id);
    });
    // Single click also navigates (nested chits don't need multi-select)
    card.addEventListener('click', function(e) {
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/frontend/html/editor.html?id=' + encodeURIComponent(chit.id);
    });

    return card;
}

/**
 * Get a content preview string for a nested chit.
 * Priority: first line of note → checklist summary → status.
 * @param {Object} chit
 * @returns {string}
 */
function _nestGetContentPreview(chit) {
    // First line of note
    if (chit.note) {
        var noteText = typeof _emailStripMarkdown === 'function'
            ? _emailStripMarkdown(chit.note)
            : chit.note;
        var firstLine = noteText.split('\n').filter(function(l) { return l.trim(); })[0];
        if (firstLine) return firstLine.trim().substring(0, 120);
    }

    // Checklist summary
    var checklist = chit.checklist;
    if (typeof checklist === 'string') {
        try { checklist = JSON.parse(checklist); } catch(e) { checklist = null; }
    }
    if (Array.isArray(checklist) && checklist.length > 0) {
        var done = checklist.filter(function(item) { return item.checked || item.done; }).length;
        return '☑ ' + done + '/' + checklist.length + ' items';
    }

    // Status
    if (chit.status) {
        return chit.status;
    }

    return '';
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

                // Use nested chit card for items with _isNest flag
                if (chit._isNest) {
                    var nestCard = _buildNestedChitCard(chit);
                    nestCard.classList.add('email-thread-child-card');
                    expanded.appendChild(nestCard);
                    return;
                }

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

    cwocUndoToast('📦 Archived: ' + title, {
        onExpire: async function() {
            try {
                var resp = await fetch('/api/chit/' + encodeURIComponent(chit.id));
                if (!resp.ok) { cwocToast('Failed to archive email', 'error'); _emailRestoreCard(card); return; }
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
                    cwocToast('Failed to archive email', 'error');
                    _emailRestoreCard(card);
                }
            } catch (e) {
                console.error('[Email Quick Archive]', e);
                cwocToast('Failed to archive email', 'error');
                _emailRestoreCard(card);
            }
        },
        onUndo: function() {
            _emailRestoreCard(card);
            cwocToast('Archive undone', 'success');
        },
        id: 'emailUndoToast'
    });
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

    cwocUndoToast('🗑️ Deleted: ' + title, {
        onExpire: async function() {
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
                    cwocToast('Failed to delete email', 'error');
                    _emailRestoreCard(card);
                }
            } catch (e) {
                console.error('[Email Quick Delete]', e);
                cwocToast('Failed to delete email', 'error');
                _emailRestoreCard(card);
            }
        },
        onUndo: function() {
            _emailRestoreCard(card);
            cwocToast('Delete undone', 'success');
        },
        id: 'emailUndoToast'
    });
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

