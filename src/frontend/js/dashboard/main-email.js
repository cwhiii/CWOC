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

/* Auto-check mail interval timer */
var _emailAutoCheckTimer = null;

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
        var acct = settings.email_account;
        if (!acct || typeof acct !== 'object') return;
        var interval = acct.check_interval;
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

    // Filter to email chits only
    var emailChits = chitsToDisplay.filter(function(c) {
        return c.email_message_id || c.email_status;
    });

    // Apply sub-filter (using CWOC_System/Email/* tags)
    var _showArchivedCb = document.getElementById('show-archived');
    var _showArchived = _showArchivedCb ? _showArchivedCb.checked : false;

    function _chitHasTag(c, tagSuffix) {
        var tags = c.tags;
        if (!tags || !Array.isArray(tags)) return false;
        var target = 'CWOC_System/Email/' + tagSuffix;
        var found = tags.some(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return name === target;
        });
        // Fallback: check email_folder field for chits that haven't been re-saved yet
        if (!found && c.email_folder) {
            var folderMap = { 'Inbox': 'inbox', 'Sent': 'sent', 'Drafts': 'drafts', 'Trash': 'trash' };
            if (c.email_folder === folderMap[tagSuffix]) return true;
            // Also check email_status for drafts
            if (tagSuffix === 'Drafts' && c.email_status === 'draft') return true;
        }
        return found;
    }

    if (_emailSubFilter === 'inbox') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Inbox') && (!c.archived || _showArchived); });
    } else if (_emailSubFilter === 'sent') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Sent') && (!c.archived || _showArchived); });
    } else if (_emailSubFilter === 'drafts') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Drafts') && (!c.archived || _showArchived); });
    } else if (_emailSubFilter === 'trash') {
        emailChits = emailChits.filter(function(c) { return _chitHasTag(c, 'Trash'); });
    } else if (_emailSubFilter === 'archived') {
        emailChits = emailChits.filter(function(c) { return !!c.archived; });
    } else if (_emailSubFilter === 'bytag') {
        // Show all non-archived email chits (sidebar tag filter narrows further)
        emailChits = emailChits.filter(function(c) { return !c.archived || _showArchived; });
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

    // Email action bar
    var actionBar = document.createElement('div');
    actionBar.className = 'email-action-bar';
    actionBar.innerHTML =
        '<button class="cwoc-btn" onclick="_checkMail()"><i class="fas fa-sync"></i> Check Mail</button>' +
        '<button class="cwoc-btn" onclick="_composeEmail()"><i class="fas fa-pen"></i> Compose</button>' +
        '<div class="email-sub-filters">' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'inbox' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'inbox\')">Inbox</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'sent' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'sent\')">Sent</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'drafts' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'drafts\')">Drafts</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'archived' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'archived\')">Archived</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'trash' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'trash\')">Trash</button>' +
            '<button class="email-sub-btn' + (_emailSubFilter === 'bytag' ? ' active' : '') + '" onclick="_setEmailSubFilter(\'bytag\')">By Tag</button>' +
        '</div>';
    container.appendChild(actionBar);

    // Bulk actions bar (hidden until items selected)
    var bulkBar = document.createElement('div');
    bulkBar.id = 'emailBulkBar';
    bulkBar.className = 'email-bulk-bar';
    bulkBar.style.display = 'none';
    bulkBar.innerHTML =
        '<span id="emailBulkCount">0 selected</span>' +
        '<button class="cwoc-btn" onclick="_emailBulkArchive()"><i class="fas fa-archive"></i> Archive</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkTag()"><i class="fas fa-tag"></i> Tag</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkSelectAll()" style="margin-left:auto;">Select All</button>' +
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
        applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    }

    // Checkbox for multi-select
    var cbWrap = document.createElement('div');
    cbWrap.className = 'email-cb-wrap';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'email-select-cb';
    cb.dataset.chitId = chit.id;
    cb.onclick = function(e) { e.stopPropagation(); _emailToggleSelect(chit.id, cb.checked); };
    cbWrap.appendChild(cb);
    card.appendChild(cbWrap);

    // Content area
    var content = document.createElement('div');
    content.className = 'email-card-content';

    // Header row using _buildChitHeader (like search results)
    var subject = chit.title || chit.email_subject || '(No Subject)';
    if (typeof _buildChitHeader === 'function') {
        content.appendChild(_buildChitHeader(chit, _escHtml(subject), viSettings));
    } else {
        var titleEl = document.createElement('div');
        titleEl.innerHTML = '<strong>' + _escHtml(subject) + '</strong>';
        content.appendChild(titleEl);
    }

    // Email meta row: sender, smart date, status badge
    var meta = document.createElement('div');
    meta.className = 'email-card-meta';

    var sender = chit.email_from || '';
    var dateStr = _emailFormatDateSmart(chit.email_date);
    var statusBadge = '';
    if (chit.email_status === 'draft') statusBadge = '<span class="email-draft-badge">Draft</span> ';
    if (chit.email_status === 'sent') statusBadge = '<span class="email-sent-badge">Sent</span> ';

    meta.innerHTML = statusBadge +
        '<span class="email-meta-sender">From: ' + _escHtml(sender) + '</span>' +
        '<span class="email-meta-date">' + _escHtml(dateStr) + '</span>';
    content.appendChild(meta);

    // Tags row (if any non-system tags)
    var tags = chit.tags;
    if (tags && Array.isArray(tags) && tags.length > 0) {
        var tagRow = document.createElement('div');
        tagRow.className = 'email-card-tags';
        tags.forEach(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            if (!name || name.indexOf('CWOC_System/') === 0) return;
            var chip = document.createElement('span');
            chip.className = 'email-tag-chip';
            var color = (typeof _getTagColor === 'function') ? _getTagColor(name) : '#d4c4b0';
            var fontColor = (typeof _getTagFontColor === 'function') ? _getTagFontColor(name) : '#5c3317';
            chip.style.backgroundColor = color;
            chip.style.color = fontColor;
            chip.textContent = name;
            tagRow.appendChild(chip);
        });
        if (tagRow.children.length > 0) content.appendChild(tagRow);
    }

    // Body preview (first 2 lines)
    var bodyText = chit.email_body_text || '';
    if (bodyText) {
        var preview = document.createElement('div');
        preview.className = 'email-card-preview';
        var lines = bodyText.split('\n').filter(function(l) { return l.trim(); });
        preview.textContent = lines.slice(0, 2).join(' ').substring(0, 200);
        content.appendChild(preview);
    }

    card.appendChild(content);

    // Click handler: navigate to editor
    card.addEventListener('click', function(e) {
        if (e.target.classList.contains('email-select-cb')) return;
        if (typeof storePreviousState === 'function') storePreviousState();
        window.location.href = '/frontend/html/editor.html?id=' + chit.id;
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
    if (!bar) return;
    if (_emailSelectedIds.length > 0) {
        bar.style.display = '';
        if (countEl) countEl.textContent = _emailSelectedIds.length + ' selected';
    } else {
        bar.style.display = 'none';
    }
}

/** Select all visible email cards */
function _emailBulkSelectAll() {
    _emailSelectedIds = [];
    document.querySelectorAll('.email-select-cb').forEach(function(cb) {
        cb.checked = true;
        if (cb.dataset.chitId) _emailSelectedIds.push(cb.dataset.chitId);
    });
    _emailUpdateBulkBar();
}

/** Clear all selections */
function _emailBulkClear() {
    _emailSelectedIds = [];
    document.querySelectorAll('.email-select-cb').forEach(function(cb) { cb.checked = false; });
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
            // expects them as Optional[str], so leave them as strings:
            // email_to, email_cc, email_bcc, recurrence_rule, weather_data, health_data
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

/** Bulk tag selected emails — show a prompt for the tag name */
async function _emailBulkTag() {
    if (_emailSelectedIds.length === 0) return;
    var tagName = prompt('Enter tag name to apply:');
    if (!tagName || !tagName.trim()) return;
    tagName = tagName.trim();

    if (typeof isReservedTagPrefix === 'function' && isReservedTagPrefix(tagName)) {
        _showToast("Tags starting with 'CWOC_System/' are reserved.", 'error');
        return;
    }

    var count = _emailSelectedIds.length;
    for (var i = 0; i < _emailSelectedIds.length; i++) {
        try {
            var resp = await fetch('/api/chit/' + encodeURIComponent(_emailSelectedIds[i]));
            if (!resp.ok) continue;
            var chit = await resp.json();
            var tags = chit.tags || [];
            var hasTag = tags.some(function(t) {
                if (typeof t === 'string') return t === tagName;
                if (typeof t === 'object' && t.name) return t.name === tagName;
                return false;
            });
            if (!hasTag) {
                tags.push(tagName);
                chit.tags = tags;
                // Re-serialize JSON array fields
                ['email_to', 'email_cc', 'email_bcc'].forEach(function(f) {
                    if (Array.isArray(chit[f])) chit[f] = JSON.stringify(chit[f]);
                });
                ['tags', 'checklist', 'people', 'child_chits', 'alerts',
                 'recurrence_rule', 'recurrence_exceptions', 'weather_data',
                 'health_data', 'shares'].forEach(function(f) {
                    if (chit[f] !== null && chit[f] !== undefined && typeof chit[f] !== 'string') {
                        chit[f] = JSON.stringify(chit[f]);
                    }
                });
                await fetch('/api/chits/' + encodeURIComponent(_emailSelectedIds[i]), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chit)
                });
            }
        } catch (e) {
            console.error('Bulk tag error for ' + _emailSelectedIds[i], e);
        }
    }
    _showToast(count + ' email(s) tagged with "' + tagName + '"', 'success');
    _emailSelectedIds = [];
    if (typeof fetchChits === 'function') fetchChits();
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-filter, sync, compose, badge, empty state, helpers
// ═══════════════════════════════════════════════════════════════════════════

function _setEmailSubFilter(filter) {
    _emailSubFilter = filter;
    if (typeof displayChits === 'function') displayChits();
}

function _checkMail() {
    fetch('/api/email/sync', { method: 'POST' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; }); })
        .then(function(result) {
            if (result.ok && result.data.new_count !== undefined) {
                _showToast(result.data.new_count + ' new email(s) fetched', 'success');
                if (typeof fetchChits === 'function') fetchChits();
            } else if (result.status === 400 && result.data.detail && result.data.detail.indexOf('No email account') !== -1) {
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

function _composeEmail() {
    if (typeof storePreviousState === 'function') storePreviousState();
    window.location.href = '/frontend/html/editor.html?new=email';
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
    div.innerHTML =
        '<p>No emails here yet.</p>' +
        '<button class="cwoc-btn" onclick="_composeEmail()"><i class="fas fa-pen"></i> Compose</button>' +
        '<button class="cwoc-btn" onclick="_checkMail()" style="margin-left:8px;"><i class="fas fa-sync"></i> Check Mail</button>';
    container.appendChild(div);
}

function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
