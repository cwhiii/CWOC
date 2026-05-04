/* ── main-email.js — Email tab view ─────────────────────────────────────────
 * Renders the Email dashboard tab with inbox-style list view.
 * Loaded by index.html before main.js.
 * ────────────────────────────────────────────────────────────────────────── */

/* Email sub-filter state: 'inbox' (default), 'bytag', 'drafts', 'trash' */
var _emailSubFilter = 'inbox';

/**
 * Display email chits in the Email tab list view.
 * Called from filterChits() dispatch in main-views.js.
 * @param {Array} chitsToDisplay - Array of chit objects to render
 */
function displayEmailView(chitsToDisplay) {
    var container = document.getElementById('chit-list');
    if (!container) return;
    container.innerHTML = '';

    // Filter to email chits only
    var emailChits = chitsToDisplay.filter(function(c) {
        return c.email_message_id || c.email_status;
    });

    // Apply sub-filter
    if (_emailSubFilter === 'inbox') {
        emailChits = emailChits.filter(function(c) { return c.email_folder === 'inbox'; });
    } else if (_emailSubFilter === 'drafts') {
        emailChits = emailChits.filter(function(c) { return c.email_folder === 'drafts' || c.email_status === 'draft'; });
    } else if (_emailSubFilter === 'trash') {
        emailChits = emailChits.filter(function(c) { return c.email_folder === 'trash'; });
    }
    // 'bytag' shows all email chits (user filters via sidebar tags)

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

    // Email action bar
    var actionBar = document.createElement('div');
    actionBar.className = 'email-action-bar';
    actionBar.innerHTML =
        '<button class="cwoc-btn" onclick="_checkMail()"><i class="fas fa-sync"></i> Check Mail</button>' +
        '<button class="cwoc-btn" onclick="_composeEmail()"><i class="fas fa-pen"></i> Compose</button>' +
        '<div class="email-sub-filters">' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'inbox' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'inbox\')">Inbox</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'bytag' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'bytag\')">By Tag</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'drafts' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'drafts\')">Drafts</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'trash' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'trash\')">Trash</button>' +
        '</div>';
    container.appendChild(actionBar);

    // Render email rows
    emailChits.forEach(function(chit) {
        container.appendChild(_buildEmailRow(chit));
    });
}

/**
 * Build a single email row element.
 * @param {Object} chit - The email chit object
 * @returns {HTMLElement} The email row element
 */
function _buildEmailRow(chit) {
    var row = document.createElement('div');
    row.className = 'chit-card email-row' + (chit.email_read ? '' : ' email-unread');
    row.dataset.chitId = chit.id;
    row.ondblclick = function() {
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/frontend/html/editor.html?id=' + chit.id;
    };

    var sender = chit.email_from || '';
    var subject = chit.title || chit.email_subject || '(No Subject)';
    var dateStr = '';
    if (chit.email_date) {
        try {
            var d = new Date(chit.email_date);
            var now = new Date();
            if (d.toDateString() === now.toDateString()) {
                dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        } catch (e) {
            dateStr = chit.email_date;
        }
    }

    var statusIcon = '';
    if (chit.email_status === 'draft') statusIcon = '<span class="email-draft-badge">Draft</span>';
    if (chit.email_status === 'sent') statusIcon = '<span class="email-sent-badge">Sent</span>';

    row.innerHTML =
        '<div class="email-row-sender">' + _escHtml(sender) + '</div>' +
        '<div class="email-row-subject">' + statusIcon + _escHtml(subject) + '</div>' +
        '<div class="email-row-date">' + _escHtml(dateStr) + '</div>';

    return row;
}

/**
 * Set the email sub-filter and refresh the view.
 * @param {string} filter - One of 'inbox', 'bytag', 'drafts', 'trash'
 */
function _setEmailSubFilter(filter) {
    _emailSubFilter = filter;
    if (typeof displayChits === 'function') displayChits();
}

/**
 * Trigger a manual email sync (Check Mail).
 */
function _checkMail() {
    fetch('/api/email/sync', { method: 'POST' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; }); })
        .then(function(result) {
            if (result.ok && result.data.new_count !== undefined) {
                _showToast(result.data.new_count + ' new email(s) fetched', 'success');
                if (typeof fetchChits === 'function') fetchChits();
            } else if (result.status === 400 && result.data.detail && result.data.detail.indexOf('No email account') !== -1) {
                // Not configured — don't show error toast, just log
                console.log('[Email] No email account configured yet.');
            } else if (result.data.detail) {
                _showToast(result.data.detail, 'error');
            }
        })
        .catch(function(err) {
            console.error('Email sync error:', err);
            _showToast('Failed to check mail', 'error');
        });
}

/**
 * Open the editor to compose a new email.
 */
function _composeEmail() {
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = '/frontend/html/editor.html?new=email';
}

/**
 * Get the count of unread inbox emails for the badge.
 * @returns {number} Count of unread inbox emails
 */
function _getUnreadCount() {
    if (typeof chits === 'undefined' || !Array.isArray(chits)) return 0;
    return chits.filter(function(c) {
        return (c.email_message_id || c.email_status) &&
               c.email_folder === 'inbox' &&
               !c.email_read;
    }).length;
}

/**
 * Update the unread count badge on the Email tab.
 */
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
 * Show empty state for the email tab.
 * @param {HTMLElement} container - The chit-list container
 */
function _emailEmptyState(container) {
    var div = document.createElement('div');
    div.className = 'cwoc-empty';
    div.innerHTML =
        '<p>No emails here yet.</p>' +
        '<button class="cwoc-btn" onclick="_composeEmail()"><i class="fas fa-pen"></i> Compose</button>' +
        '<button class="cwoc-btn" onclick="_checkMail()" style="margin-left:8px;"><i class="fas fa-sync"></i> Check Mail</button>';
    container.appendChild(div);
}

/**
 * Simple HTML escape helper (uses shared if available, otherwise local).
 */
function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Simple toast helper — delegates to shared showToast if available.
 */
function _showToast(msg, type) {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        console.log('[Toast]', type, msg);
    }
}
