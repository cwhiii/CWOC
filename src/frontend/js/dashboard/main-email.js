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
        '<span id="emailBulkCount">0 selected</span>' +
        '<button class="cwoc-btn" onclick="_emailBulkArchive()"><i class="fas fa-archive"></i> Archive</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkTag()"><i class="fas fa-tag"></i> Tag</button>' +
        '<button class="cwoc-btn" onclick="_emailBulkToggleRead()"><i class="fas fa-envelope-open"></i> Mark Read/Unread</button>' +
        '<button class="cwoc-btn" id="emailBulkSelectAllBtn" onclick="_emailBulkSelectAll()" style="margin-left:auto;">Select All</button>' +
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

    // Tags are already rendered by _buildChitHeader — no duplicate tag row needed

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

    // Shift+click to toggle read/unread; plain click does nothing (dblclick navigates)
    card.addEventListener('click', function(e) {
        if (e.target.classList.contains('email-select-cb')) return;
        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            _toggleEmailReadStatus(chit, card);
        }
    });

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
    var selectAllBtn = document.getElementById('emailBulkSelectAllBtn');
    if (!bar) return;
    if (_emailSelectedIds.length > 0) {
        bar.style.display = '';
        if (countEl) countEl.textContent = _emailSelectedIds.length + ' selected';
        // Update Select All button label
        if (selectAllBtn) {
            var allCbs = document.querySelectorAll('.email-select-cb');
            selectAllBtn.textContent = (_emailSelectedIds.length === allCbs.length) ? 'Deselect All' : 'Select All';
        }
    } else {
        bar.style.display = 'none';
    }
}

/** Select all / deselect all visible email cards (toggles) */
function _emailBulkSelectAll() {
    var allCbs = document.querySelectorAll('.email-select-cb');
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
    document.querySelectorAll('.email-select-cb').forEach(function(cb) { cb.checked = false; });
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
                _showToast(result.data.new_count + ' new email(s) fetched', 'success');
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
