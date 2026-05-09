/* ── main-email-bundles.js — Email Bundles toolbar and tab logic ───────────
 * Renders the permanent two-row bundle toolbar (Row 1: bulk actions,
 * Row 2: bundle tabs) and handles bundle filtering.
 * Loaded by index.html AFTER main-email.js.
 *
 * Depends on: main-email.js (_emailSelectedIds, _emailBulkSelectAll,
 *             _emailBulkArchive, _emailBulkTag, _emailBulkToggleRead,
 *             _emailSubFilter, _setEmailSubFilter, _emailUpdateBulkBar)
 * ────────────────────────────────────────────────────────────────────────── */

/* ── State ────────────────────────────────────────────────────────────────── */

/** Active bundle name (null = no bundle filter, show all) */
var _emailActiveBundle = null;

/** Cached bundles data from GET /api/bundles */
var _emailBundlesData = null;

/* Restore active bundle from localStorage */
(function() {
    try {
        var stored = localStorage.getItem('cwoc_email_active_bundle');
        if (stored) _emailActiveBundle = stored;
    } catch (e) {}
})();

/* Trigger reclassification if returning from rule editor */
(function() {
    try {
        var needsReclass = localStorage.getItem('cwoc_bundle_needs_reclassify');
        if (needsReclass) {
            localStorage.removeItem('cwoc_bundle_needs_reclassify');
            // Fire reclassify after a short delay (let auth settle)
            setTimeout(function() {
                fetch('/api/bundles/reclassify', { method: 'POST' })
                    .then(function(r) {
                        if (r.ok) {
                            console.log('[Bundles] Reclassification triggered on return');
                            // Invalidate settings cache and re-render
                            if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
                            _emailBundlesData = null;
                            if (typeof fetchChits === 'function') fetchChits();
                        }
                    })
                    .catch(function(err) { console.error('[Bundles] Reclassify failed:', err); });
            }, 2000);
        }
    } catch (e) {}
})();

/* ── API ──────────────────────────────────────────────────────────────────── */

/** Whether a bundle fetch is currently in flight */
var _bundleFetchInFlight = false;

/**
 * Fetch bundles from the API and store in _emailBundlesData.
 * Now reads from cached settings (bundles are included in the settings response).
 * Falls back to direct API call if settings don't have bundles.
 * @param {Function} [callback] — optional callback after data is loaded
 */
function _fetchBundles(callback) {
    if (_bundleFetchInFlight) {
        if (typeof callback === 'function') {
            var _waitInterval = setInterval(function() {
                if (!_bundleFetchInFlight) {
                    clearInterval(_waitInterval);
                    callback();
                }
            }, 50);
        }
        return;
    }

    // Try to get bundles from cached settings first (already authenticated)
    if (window._cwocSettings && window._cwocSettings.bundles) {
        _emailBundlesData = window._cwocSettings.bundles;
        console.log('[Bundles] Loaded ' + _emailBundlesData.length + ' bundles from settings');
        if (typeof callback === 'function') callback();
        _refreshBundleTabsInPlace();
        return;
    }

    // If settings aren't loaded yet, wait for them
    if (typeof getCachedSettings === 'function') {
        _bundleFetchInFlight = true;
        getCachedSettings().then(function(s) {
            if (s && s.bundles) {
                _emailBundlesData = s.bundles;
                console.log('[Bundles] Loaded ' + _emailBundlesData.length + ' bundles from settings');
            } else {
                _emailBundlesData = [];
                console.log('[Bundles] No bundles in settings');
            }
            _bundleFetchInFlight = false;
            if (typeof callback === 'function') callback();
            _refreshBundleTabsInPlace();
        }).catch(function(err) {
            console.error('[Bundles] Failed to load settings for bundles:', err);
            _emailBundlesData = [];
            _bundleFetchInFlight = false;
            if (typeof callback === 'function') callback();
        });
    } else {
        _emailBundlesData = [];
        if (typeof callback === 'function') callback();
    }
}

/**
 * Re-render just the bundle tabs row in place (after async fetch completes).
 * Triggers a full re-render of the email view so tabs and filtering are correct.
 */
var _bundleRefreshInProgress = false;
function _refreshBundleTabsInPlace() {
    var row2 = document.getElementById('bundleTabsRow');
    if (!row2) return;
    if (_bundleRefreshInProgress) return;
    _bundleRefreshInProgress = true;
    // Trigger a full re-render via filterChits so tabs render with data
    if (typeof filterChits === 'function') {
        filterChits('Email');
    }
    _bundleRefreshInProgress = false;
}

/* ── Filtering ────────────────────────────────────────────────────────────── */

/**
 * Filter email chits by the active bundle.
 * @param {Array} chits — already sub-filtered email chits (inbox only)
 * @param {string|null} activeBundle — bundle name or null for "all"
 * @returns {Array} filtered chits
 */
function _filterByBundle(chits, activeBundle) {
    if (!activeBundle) return chits;

    // "Everything Else" is the catch-all — returns emails with NO bundle tag
    // Match by name OR by checking if it's the non-removable bundle
    var isEverythingElse = (activeBundle === 'Everything Else');
    if (!isEverythingElse && _emailBundlesData) {
        var matchedBundle = _emailBundlesData.find(function(b) { return b.name === activeBundle; });
        if (matchedBundle && (matchedBundle.removable === 0 || matchedBundle.removable === false || matchedBundle.removable === '0')) {
            isEverythingElse = true;
        }
    }

    if (isEverythingElse) {
        return chits.filter(function(c) {
            var tags = c.tags || [];
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = []; }
            }
            return !tags.some(function(t) {
                var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
                return name.indexOf('CWOC_System/Bundle/') === 0;
            });
        });
    }

    var bundleTag = 'CWOC_System/Bundle/' + activeBundle;
    return chits.filter(function(c) {
        var tags = c.tags || [];
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch (e) { tags = []; }
        }
        return tags.some(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return name === bundleTag;
        });
    });
}

/**
 * Get the unread count for a bundle.
 * @param {string} bundleName — bundle name
 * @param {Array} emailChits — all inbox email chits
 * @returns {number}
 */
function _getBundleUnreadCount(bundleName, emailChits) {
    // Check if this is the catch-all bundle (by name or by removable flag)
    var isEverythingElse = (bundleName === 'Everything Else');
    if (!isEverythingElse && _emailBundlesData) {
        var matchedBundle = _emailBundlesData.find(function(b) { return b.name === bundleName; });
        if (matchedBundle && (matchedBundle.removable === 0 || matchedBundle.removable === false || matchedBundle.removable === '0')) {
            isEverythingElse = true;
        }
    }

    if (isEverythingElse) {
        return emailChits.filter(function(c) {
            var tags = c.tags || [];
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = []; }
            }
            var hasBundleTag = tags.some(function(t) {
                var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
                return name.indexOf('CWOC_System/Bundle/') === 0;
            });
            return !hasBundleTag && !c.email_read;
        }).length;
    }

    var bundleTag = 'CWOC_System/Bundle/' + bundleName;
    return emailChits.filter(function(c) {
        var tags = c.tags || [];
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch (e) { tags = []; }
        }
        var hasTag = tags.some(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return name === bundleTag;
        });
        return hasTag && !c.email_read;
    }).length;
}

/**
 * Get all inbox email chits from the global chits array.
 * This is the single source of truth — no parameter passing needed.
 */
function _getAllInboxEmailChits() {
    var allChits;
    try { allChits = chits; } catch(e) { allChits = null; }
    if (!allChits || !Array.isArray(allChits)) {
        console.warn('[Bundles] _getAllInboxEmailChits: chits not available, type=' + typeof allChits);
        return [];
    }
    console.log('[Bundles] _getAllInboxEmailChits: global chits.length=' + allChits.length);
    var emailChits = allChits.filter(function(c) {
        return (c.email_message_id || c.email_status);
    });
    console.log('[Bundles] _getAllInboxEmailChits: email chits=' + emailChits.length);
    var inboxChits = emailChits.filter(function(c) {
        if (c.deleted || c.archived) return false;
        var tags = c.tags || [];
        if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch(e) { tags = []; } }
        var isInbox = tags.some(function(t) {
            var name = (typeof t === 'string') ? t : (t && t.name ? t.name : '');
            return name === 'CWOC_System/Email/Inbox';
        });
        if (!isInbox && c.email_folder === 'inbox') isInbox = true;
        return isInbox;
    });
    console.log('[Bundles] _getAllInboxEmailChits: inbox chits=' + inboxChits.length);
    return inboxChits;
}

/* ── Toolbar Rendering ────────────────────────────────────────────────────── */

/**
 * Build and return the permanent two-row bundle toolbar DOM element.
 * Row 1: Select All checkbox, Archive, Tag, Mark Read/Unread, selected count
 * Row 2: Bundle tabs + "+" button
 * @param {Array} emailChits — all inbox email chits (for unread counts)
 * @returns {HTMLElement}
 */
function _renderBundleToolbar(emailChits) {
    // If bundles are disabled in settings, return an empty div
    var settings = window._cwocSettings || {};
    console.log('[Bundles] _renderBundleToolbar called, bundles_enabled=' + settings.bundles_enabled + ', bundlesData=' + (_emailBundlesData ? _emailBundlesData.length : 'null'));
    if (settings.bundles_enabled === '0' || settings.bundles_enabled === 0 || settings.bundles_enabled === false) {
        console.log('[Bundles] Bundles disabled, returning empty div');
        var emptyDiv = document.createElement('div');
        return emptyDiv;
    }

    // If bundles haven't been fetched yet, kick off a fetch (auth is guaranteed
    // at this point since displayEmailView is only called after fetchChits succeeds)
    if (_emailBundlesData === null && !_bundleFetchInFlight) {
        _fetchBundles();
    }

    var toolbar = document.createElement('div');
    toolbar.className = 'bundle-toolbar';
    toolbar.id = 'bundleToolbar';

    // ── Row 1: Bulk Action Controls (select all, archive, tag, read/unread) ──
    var row1 = document.createElement('div');
    row1.className = 'bundle-toolbar-actions';

    var selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.className = 'bundle-select-all';
    selectAllCb.id = 'bundleSelectAllCb';
    selectAllCb.title = 'Select All';
    selectAllCb.addEventListener('change', function() {
        _emailBundleSelectAll(this.checked);
    });
    row1.appendChild(selectAllCb);

    var archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.className = 'bundle-action-btn inactive';
    archiveBtn.id = 'bundleArchiveBtn';
    archiveBtn.innerHTML = '<i class="fas fa-archive"></i> Archive';
    archiveBtn.addEventListener('click', function() {
        if (typeof _emailBulkArchive === 'function') _emailBulkArchive();
    });
    row1.appendChild(archiveBtn);

    var tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'bundle-action-btn inactive';
    tagBtn.id = 'bundleTagBtn';
    tagBtn.innerHTML = '<i class="fas fa-tag"></i> Tag';
    tagBtn.addEventListener('click', function() {
        if (typeof _emailBulkTag === 'function') _emailBulkTag();
    });
    row1.appendChild(tagBtn);

    var readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'bundle-action-btn inactive';
    readBtn.id = 'bundleReadBtn';
    readBtn.innerHTML = '<i class="fas fa-envelope-open"></i> Read/Unread';
    readBtn.addEventListener('click', function() {
        if (typeof _emailBulkToggleRead === 'function') _emailBulkToggleRead();
    });
    row1.appendChild(readBtn);

    var countSpan = document.createElement('span');
    countSpan.className = 'bundle-selected-count';
    countSpan.id = 'bundleSelectedCount';
    countSpan.textContent = '';
    row1.appendChild(countSpan);

    toolbar.appendChild(row1);

    // ── Row 2: Bundle Tabs ──
    var row2 = document.createElement('div');
    row2.className = 'bundle-tabs-row';
    row2.id = 'bundleTabsRow';

    // Dim tabs when sub-filter is not inbox
    if (_emailSubFilter !== 'inbox') {
        row2.classList.add('dimmed');
    }

    // Render tabs from bundles data
    console.log('[Bundles] _renderBundleTabs called with ' + (emailChits ? emailChits.length : 0) + ' emailChits, ' + ((_emailBundlesData || []).length) + ' bundles');
    _renderBundleTabs(row2, _emailBundlesData || [], emailChits || []);

    toolbar.appendChild(row2);

    return toolbar;
}

/**
 * Render bundle tabs into the given container element.
 * @param {HTMLElement} container — the row2 element to populate
 * @param {Array} bundles — array of bundle objects from API
 * @param {Array} emailChits — all inbox email chits (for unread counts)
 */
function _renderBundleTabs(container, bundles, emailChits) {
    container.innerHTML = '';

    // Validate active bundle still exists
    if (_emailActiveBundle && bundles && bundles.length > 0) {
        var exists = bundles.some(function(b) { return b.name === _emailActiveBundle; });
        if (!exists) {
            _emailActiveBundle = null;
            try { localStorage.removeItem('cwoc_email_active_bundle'); } catch(e) {}
        }
    }

    if (bundles && bundles.length > 0) {
        // In single-placement mode, "Everything Else" is always last (catch-all)
        // In multi-placement mode, it can be reordered freely
        var isMultiPlacementSort = (window._cwocSettings || {}).bundles_multi_placement === '1';
        var sortedBundles = bundles.slice().sort(function(a, b) {
            if (!isMultiPlacementSort) {
                if (a.name === 'Everything Else') return 1;
                if (b.name === 'Everything Else') return -1;
            }
            return (a.display_order || 0) - (b.display_order || 0);
        });
        sortedBundles.forEach(function(bundle) {
            var tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'bundle-tab';
            tab.dataset.bundleName = bundle.name;
            tab.dataset.bundleId = bundle.id || '';

            if (_emailActiveBundle === bundle.name) {
                tab.classList.add('active');
            }

            // Apply bundle color as tab background
            if (bundle.color) {
                tab.style.backgroundColor = bundle.color;
                // Auto-contrast text
                if (typeof isLightColor === 'function' && !isLightColor(bundle.color)) {
                    tab.style.color = '#fdf5e6';
                }
                if (!tab.classList.contains('active')) {
                    tab.style.opacity = '0.6';
                }
            }

            // Tooltip with description
            if (bundle.description) {
                tab.title = bundle.description;
            }

            // Tab label
            var labelSpan = document.createElement('span');
            labelSpan.textContent = bundle.name;
            tab.appendChild(labelSpan);

            // Count badge (unread, total, both, or none — based on setting)
            var countMode = (window._cwocSettings || {}).bundles_show_count || 'both';
            var allInbox = _getAllInboxEmailChits();
            console.log('[Bundles] COUNT for "' + bundle.name + '": countMode=' + countMode + ', allInbox.length=' + allInbox.length + ', removable=' + bundle.removable);
            var badgeText = '';
            if (countMode !== 'none') {
                var unreadCount = _getBundleUnreadCount(bundle.name, allInbox);
                var totalCount = _filterByBundle(allInbox, bundle.name).length;
                console.log('[Bundles]   unread=' + unreadCount + ', total=' + totalCount);

                if (countMode === 'both') {
                    badgeText = unreadCount + '/' + totalCount;
                } else if (countMode === 'total') {
                    badgeText = '' + totalCount;
                } else if (countMode === 'unread') {
                    badgeText = '' + unreadCount;
                }
                console.log('[Bundles]   badgeText="' + badgeText + '"');
            } else {
                console.log('[Bundles]   countMode is none, skipping badge');
            }

            if (badgeText) {
                var badge = document.createElement('span');
                badge.className = 'bundle-unread-badge';
                badge.textContent = badgeText;
                tab.appendChild(badge);
            }

            // Click handler — set active bundle; shift+click opens edit modal
            tab.addEventListener('click', function(e) {
                if (e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    _openBundleModal(bundle);
                    return;
                }
                _setActiveBundle(bundle.name);
            });

            // Always-on drag-and-drop
            // "Everything Else" is only draggable when multi-placement is enabled
            var isMultiPlacementDrag = (window._cwocSettings || {}).bundles_multi_placement === '1';
            if (bundle.name !== 'Everything Else' || isMultiPlacementDrag) {
                tab.setAttribute('draggable', 'true');
                tab.addEventListener('dragstart', _bundleReorderDragStart);
                tab.addEventListener('dragend', _bundleReorderDragEnd);
            }
            tab.addEventListener('dragover', _bundleReorderDragOver);
            tab.addEventListener('drop', _bundleReorderDrop);

            // Attach context menu (right-click / long-press)
            _attachBundleTabContextMenu(tab, bundle);

            container.appendChild(tab);

            // Add → separator between tabs when single-placement (shows priority order)
            var isMultiPlacement = (window._cwocSettings || {}).bundles_multi_placement === '1';
            if (!isMultiPlacement && bundle.name !== 'Everything Else') {
                var arrow = document.createElement('span');
                arrow.className = 'bundle-tab-arrow';
                arrow.textContent = '\u203A';
                container.appendChild(arrow);
            }
        });
    }

    // "+" button for creating new bundles — always shown
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'bundle-add-btn';
    addBtn.title = 'Create new bundle';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', function() {
        if (typeof _openBundleModal === 'function') {
            _openBundleModal(null);
        }
    });
    container.appendChild(addBtn);
}

/* ── Active Bundle Management ─────────────────────────────────────────────── */

/**
 * Set the active bundle and re-render the email view.
 * @param {string|null} bundleName — bundle name or null to clear
 */
function _setActiveBundle(bundleName) {
    // Toggle off if clicking the already-active tab
    if (_emailActiveBundle === bundleName) {
        _emailActiveBundle = null;
    } else {
        _emailActiveBundle = bundleName;
    }

    // Persist to localStorage
    _persistActiveBundle();

    // Update tab active states
    _updateBundleTabActiveStates();

    // Re-render the email list
    if (typeof displayChits === 'function') displayChits();
}

/**
 * Persist the active bundle to localStorage.
 */
function _persistActiveBundle() {
    try {
        if (_emailActiveBundle) {
            localStorage.setItem('cwoc_email_active_bundle', _emailActiveBundle);
        } else {
            localStorage.removeItem('cwoc_email_active_bundle');
        }
    } catch (e) {}
}

/**
 * Update the visual active state on bundle tabs without full re-render.
 */
function _updateBundleTabActiveStates() {
    var tabs = document.querySelectorAll('.bundle-tab');
    tabs.forEach(function(tab) {
        if (tab.dataset.bundleName === _emailActiveBundle) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

/**
 * Reset active bundle when sub-filter changes away from "inbox".
 * Called by the patched _setEmailSubFilter.
 */
function _bundleOnSubFilterChange(newFilter) {
    if (newFilter !== 'inbox') {
        _emailActiveBundle = null;
        _persistActiveBundle();
    }

    // Update dimmed state on tabs row
    var row2 = document.getElementById('bundleTabsRow');
    if (row2) {
        if (newFilter !== 'inbox') {
            row2.classList.add('dimmed');
        } else {
            row2.classList.remove('dimmed');
        }
    }
}

/* ── Bulk Action State Updates ────────────────────────────────────────────── */

/**
 * Select all / deselect all visible email cards via the bundle toolbar checkbox.
 * @param {boolean} checked — whether the checkbox is now checked
 */
function _emailBundleSelectAll(checked) {
    var allCbs = document.querySelectorAll('.email-scroll-wrap .email-select-cb');

    if (checked) {
        // Select all
        _emailSelectedIds = [];
        allCbs.forEach(function(cb) {
            cb.checked = true;
            var wrap = cb.closest('.email-cb-wrap');
            if (wrap) wrap.classList.add('email-cb-checked');
            if (cb.dataset.chitId) _emailSelectedIds.push(cb.dataset.chitId);
        });
    } else {
        // Deselect all
        _emailSelectedIds = [];
        allCbs.forEach(function(cb) {
            cb.checked = false;
            var wrap = cb.closest('.email-cb-wrap');
            if (wrap) wrap.classList.remove('email-cb-checked');
        });
    }

    _bundleUpdateActionStates();
    // Also update the old bulk bar if it exists
    if (typeof _emailUpdateBulkBar === 'function') _emailUpdateBulkBar();
}

/**
 * Update the bundle toolbar action button states based on selection count.
 * Called whenever selection changes.
 */
function _bundleUpdateActionStates() {
    var count = _emailSelectedIds.length;
    var hasSelection = count > 0;

    var archiveBtn = document.getElementById('bundleArchiveBtn');
    var tagBtn = document.getElementById('bundleTagBtn');
    var readBtn = document.getElementById('bundleReadBtn');
    var countEl = document.getElementById('bundleSelectedCount');
    var selectAllCb = document.getElementById('bundleSelectAllCb');

    // Toggle active/inactive class on action buttons
    var btns = [archiveBtn, tagBtn, readBtn];
    btns.forEach(function(btn) {
        if (!btn) return;
        if (hasSelection) {
            btn.classList.remove('inactive');
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
            btn.classList.add('inactive');
        }
    });

    // Update count text
    if (countEl) {
        countEl.textContent = hasSelection ? count + ' selected' : '';
    }

    // Update select-all checkbox state
    if (selectAllCb) {
        var allCbs = document.querySelectorAll('.email-scroll-wrap .email-select-cb');
        selectAllCb.checked = hasSelection && count === allCbs.length;
    }
}

/* ── Patch: Hook into existing selection updates ──────────────────────────── */

// Override _emailUpdateBulkBar to also update bundle toolbar states
(function() {
    var _origUpdateBulkBar = (typeof _emailUpdateBulkBar === 'function') ? _emailUpdateBulkBar : null;

    _emailUpdateBulkBar = function() {
        // Call original if it exists
        if (_origUpdateBulkBar) _origUpdateBulkBar();
        // Also update bundle toolbar action states
        _bundleUpdateActionStates();
    };
})();

// Patch _setEmailSubFilter to reset bundle on sub-filter change
(function() {
    var _origSetEmailSubFilter = (typeof _setEmailSubFilter === 'function') ? _setEmailSubFilter : null;

    _setEmailSubFilter = function(filter) {
        _bundleOnSubFilterChange(filter);
        if (_origSetEmailSubFilter) _origSetEmailSubFilter(filter);
    };
})();


/* ── Bundle Modal ─────────────────────────────────────────────────────────── */

/** Whether the bundle modal is currently open */
var _bundleModalOpen = false;

/** The bundle being edited (null = creating new) */
var _bundleModalEditBundle = null;

/**
 * Open the bundle creation/edit modal.
 * @param {object|null} editBundle — if non-null, pre-populate for editing
 */
function _openBundleModal(editBundle) {
    _bundleModalEditBundle = editBundle || null;

    // Clone the template
    var tmpl = document.getElementById('tmpl-bundle-modal');
    if (!tmpl) {
        console.error('[Bundles] Bundle modal template not found');
        return;
    }

    // Remove any existing modal overlay
    var existing = document.getElementById('bundleModalOverlay');
    if (existing) existing.remove();

    var clone = tmpl.content.cloneNode(true);
    document.body.appendChild(clone);

    var overlay = document.getElementById('bundleModalOverlay');
    var titleEl = overlay.querySelector('.bundle-modal-title');
    var nameInput = document.getElementById('bundleNameInput');
    var descInput = document.getElementById('bundleDescInput');
    var cancelBtn = document.getElementById('bundleCancelBtn');
    var defineBtn = document.getElementById('bundleDefineRuleBtn');
    var hintEl = document.getElementById('bundleModalHint');

    // Configure for edit vs create
    if (_bundleModalEditBundle) {
        titleEl.textContent = 'Edit Bundle';
        nameInput.value = _bundleModalEditBundle.name || '';
        descInput.value = _bundleModalEditBundle.description || '';
        defineBtn.textContent = 'Save';

        // Add "Change Rules" button for editing
        var actionsDiv = overlay.querySelector('.bundle-modal-actions');
        if (actionsDiv) {
            var rulesBtn = document.createElement('button');
            rulesBtn.type = 'button';
            rulesBtn.className = 'zone-button';
            rulesBtn.textContent = 'Change Rules';
            rulesBtn.style.marginLeft = 'auto';
            rulesBtn.addEventListener('click', function() {
                var bundleId = _bundleModalEditBundle.id;
                var ruleIds = _bundleModalEditBundle.rule_ids || [];
                _closeBundleModal();
                try { localStorage.setItem('cwoc_bundle_needs_reclassify', '1'); } catch(e) {}
                var ruleEditorUrl;
                if (ruleIds.length > 0) {
                    // Bundle has a rule — open the rule editor for that rule
                    ruleEditorUrl = '/frontend/html/rule-editor.html'
                        + '?id=' + encodeURIComponent(ruleIds[0])
                        + '&return=' + encodeURIComponent('/frontend/html/index.html#Email');
                } else {
                    // Bundle has no rule — open rule editor in create mode
                    ruleEditorUrl = '/frontend/html/rule-editor.html'
                        + '?new=1'
                        + '&trigger=email_received'
                        + '&bundle_id=' + encodeURIComponent(bundleId)
                        + '&return=' + encodeURIComponent('/frontend/html/index.html#Email');
                }
                window.location.href = ruleEditorUrl;
            });
            actionsDiv.insertBefore(rulesBtn, defineBtn);

            // Add "Delete" button for editing (only if removable)
            if (_bundleModalEditBundle.removable !== 0 && _bundleModalEditBundle.removable !== false) {
                var deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'zone-button';
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.color = '#8b1a1a';
                deleteBtn.style.borderColor = '#8b1a1a';
                deleteBtn.addEventListener('click', function() {
                    var bundleToDelete = _bundleModalEditBundle;
                    _closeBundleModal();
                    _deleteBundleConfirm(bundleToDelete);
                });
                actionsDiv.appendChild(deleteBtn);
            }
        }
    } else {
        titleEl.textContent = 'Create Bundle';
        nameInput.value = '';
        descInput.value = '';
        defineBtn.textContent = 'Define Rule';
    }

    // Clear hint
    hintEl.textContent = '';
    hintEl.style.display = 'none';

    // Show the modal
    overlay.style.display = 'flex';
    _bundleModalOpen = true;

    // Focus the name input
    setTimeout(function() { nameInput.focus(); }, 50);

    // Cancel button
    cancelBtn.addEventListener('click', function() {
        _closeBundleModal();
    });

    // Overlay click to close
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            _closeBundleModal();
        }
    });

    // Define Rule / Save button
    defineBtn.addEventListener('click', function() {
        _bundleModalSubmit();
    });

    // Enter key in name input submits
    nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            _bundleModalSubmit();
        }
    });

    // Register ESC handler (capture phase for priority)
    document.addEventListener('keydown', _bundleModalEscHandler, true);

    // ── Color Picker (uses shared cwocRenderColorPicker) ──
    var colorPicker = document.getElementById('bundleColorPicker');
    var colorInput = document.getElementById('bundleColorInput');
    if (colorPicker && colorInput && typeof cwocRenderColorPicker === 'function') {
        var currentColor = (_bundleModalEditBundle && _bundleModalEditBundle.color) || '';
        colorInput.value = currentColor;
        cwocRenderColorPicker(colorPicker, currentColor, function(hex) {
            colorInput.value = hex;
        }, { showNone: true });
    }
}

/**
 * ESC key handler for the bundle modal.
 * Uses capture phase to take priority over page-level ESC handlers.
 */
function _bundleModalEscHandler(e) {
    if (e.key === 'Escape' && _bundleModalOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _closeBundleModal();
    }
}

/**
 * Close the bundle modal and clean up.
 */
function _closeBundleModal() {
    var overlay = document.getElementById('bundleModalOverlay');
    if (overlay) overlay.remove();
    _bundleModalOpen = false;
    _bundleModalEditBundle = null;
    document.removeEventListener('keydown', _bundleModalEscHandler, true);
}

/**
 * Validate and submit the bundle modal form.
 * Creates a new bundle (POST) or updates an existing one (PUT).
 */
function _bundleModalSubmit() {
    var nameInput = document.getElementById('bundleNameInput');
    var descInput = document.getElementById('bundleDescInput');
    var colorInput = document.getElementById('bundleColorInput');
    var hintEl = document.getElementById('bundleModalHint');

    var name = (nameInput.value || '').trim();
    var description = (descInput.value || '').trim() || null;
    var color = (colorInput && colorInput.value) || null;

    // Validate: name is non-empty
    if (!name) {
        _showBundleModalHint('Bundle name cannot be empty.');
        nameInput.focus();
        return;
    }

    // Validate: name is not a duplicate (case-insensitive)
    var nameLower = name.toLowerCase();
    var bundles = _emailBundlesData || [];
    var isDuplicate = bundles.some(function(b) {
        // When editing, allow the same name as the current bundle
        if (_bundleModalEditBundle && b.id === _bundleModalEditBundle.id) return false;
        return (b.name || '').toLowerCase() === nameLower;
    });

    if (isDuplicate) {
        _showBundleModalHint('A bundle with this name already exists.');
        nameInput.focus();
        return;
    }

    // Disable the button to prevent double-submit
    var defineBtn = document.getElementById('bundleDefineRuleBtn');
    if (defineBtn) {
        defineBtn.disabled = true;
        defineBtn.textContent = _bundleModalEditBundle ? 'Saving...' : 'Creating...';
    }

    if (_bundleModalEditBundle) {
        // Edit mode: PUT /api/bundles/{id}
        _bundleModalUpdate(name, description, color);
    } else {
        // Create mode: POST /api/bundles
        _bundleModalCreate(name, description, color);
    }
}

/**
 * Create a new bundle via POST /api/bundles, then navigate to Rule Editor.
 */
function _bundleModalCreate(name, description, color) {
    var payload = { name: name };
    if (description) payload.description = description;
    if (color) payload.color = color;

    fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) {
        if (!r.ok) {
            return r.json().then(function(data) {
                throw new Error(data.detail || 'Failed to create bundle');
            });
        }
        return r.json();
    })
    .then(function(data) {
        var bundleId = data.id;
        _closeBundleModal();

        // Set flag so reclassification runs when we return from rule editor
        try { localStorage.setItem('cwoc_bundle_needs_reclassify', '1'); } catch(e) {}

        // Navigate to Rule Editor with pre-selected trigger and bundle
        var ruleEditorUrl = '/frontend/html/rule-editor.html'
            + '?new=1'
            + '&trigger=email_received'
            + '&bundle_id=' + encodeURIComponent(bundleId)
            + '&return=' + encodeURIComponent('/frontend/html/index.html#Email');
        window.location.href = ruleEditorUrl;
    })
    .catch(function(err) {
        console.error('[Bundles] Create failed:', err);
        _showBundleModalHint(err.message || 'Failed to create bundle.');
        var defineBtn = document.getElementById('bundleDefineRuleBtn');
        if (defineBtn) {
            defineBtn.disabled = false;
            defineBtn.textContent = 'Define Rule';
        }
    });
}

/**
 * Update an existing bundle via PUT /api/bundles/{id}.
 */
function _bundleModalUpdate(name, description, color) {
    var bundleId = _bundleModalEditBundle.id;
    var payload = { name: name };
    if (description !== null) payload.description = description;
    else payload.description = '';
    payload.color = color || '';

    fetch('/api/bundles/' + encodeURIComponent(bundleId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) {
        if (!r.ok) {
            return r.json().then(function(data) {
                throw new Error(data.detail || 'Failed to update bundle');
            });
        }
        return r.json();
    })
    .then(function() {
        _closeBundleModal();
        // Invalidate settings cache so bundles are re-fetched fresh
        if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
        _emailBundlesData = null; // Force re-fetch
        // Refresh bundles and re-render
        _fetchBundles(function() {
            if (typeof displayChits === 'function') displayChits();
        });
    })
    .catch(function(err) {
        console.error('[Bundles] Update failed:', err);
        _showBundleModalHint(err.message || 'Failed to update bundle.');
        var defineBtn = document.getElementById('bundleDefineRuleBtn');
        if (defineBtn) {
            defineBtn.disabled = false;
            defineBtn.textContent = 'Save';
        }
    });
}

/**
 * Show a hint/error message in the bundle modal.
 * @param {string} msg — message to display
 */
function _showBundleModalHint(msg) {
    var hintEl = document.getElementById('bundleModalHint');
    if (hintEl) {
        hintEl.textContent = msg;
        hintEl.style.display = 'block';
    }
}


/* ── Bundle Context Menu ──────────────────────────────────────────────────── */

/** Long-press timer ID for mobile context menu */
var _bundleLongPressTimer = null;

/** Currently open context menu element (or null) */
var _bundleContextMenuEl = null;

/**
 * Show the bundle context menu at the given position.
 * @param {object} bundle — the bundle object (from _emailBundlesData)
 * @param {number} x — clientX position
 * @param {number} y — clientY position
 */
function _showBundleContextMenu(bundle, x, y) {
    // Close any existing context menu
    _closeBundleContextMenu();

    var menu = document.createElement('div');
    menu.className = 'bundle-context-menu';

    var isEverythingElse = (bundle.name === 'Everything Else');

    // Edit option (always shown)
    var editItem = document.createElement('button');
    editItem.type = 'button';
    editItem.className = 'bundle-context-menu-item';
    editItem.textContent = 'Edit';
    editItem.addEventListener('click', function() {
        _closeBundleContextMenu();
        _openBundleModal(bundle);
    });
    menu.appendChild(editItem);

    // Delete option (not shown for "Everything Else")
    if (!isEverythingElse && bundle.removable !== false) {
        var deleteItem = document.createElement('button');
        deleteItem.type = 'button';
        deleteItem.className = 'bundle-context-menu-item danger';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', function() {
            _closeBundleContextMenu();
            _deleteBundleConfirm(bundle);
        });
        menu.appendChild(deleteItem);
    }

    document.body.appendChild(menu);
    _bundleContextMenuEl = menu;

    // Position the menu, ensuring it stays within viewport
    var menuRect = menu.getBoundingClientRect();
    var viewW = window.innerWidth;
    var viewH = window.innerHeight;

    var posX = x;
    var posY = y;

    if (posX + menuRect.width > viewW) {
        posX = viewW - menuRect.width - 8;
    }
    if (posY + menuRect.height > viewH) {
        posY = viewH - menuRect.height - 8;
    }
    if (posX < 4) posX = 4;
    if (posY < 4) posY = 4;

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    // Close on click outside or ESC
    setTimeout(function() {
        document.addEventListener('click', _bundleContextMenuOutsideClick, true);
        document.addEventListener('keydown', _bundleContextMenuEscHandler, true);
    }, 0);
}

/**
 * Close the bundle context menu if open.
 */
function _closeBundleContextMenu() {
    if (_bundleContextMenuEl) {
        _bundleContextMenuEl.remove();
        _bundleContextMenuEl = null;
    }
    document.removeEventListener('click', _bundleContextMenuOutsideClick, true);
    document.removeEventListener('keydown', _bundleContextMenuEscHandler, true);
}

/**
 * Click-outside handler for the context menu.
 */
function _bundleContextMenuOutsideClick(e) {
    if (_bundleContextMenuEl && !_bundleContextMenuEl.contains(e.target)) {
        _closeBundleContextMenu();
    }
}

/**
 * ESC handler for the context menu.
 */
function _bundleContextMenuEscHandler(e) {
    if (e.key === 'Escape' && _bundleContextMenuEl) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _closeBundleContextMenu();
    }
}

/**
 * Attach context menu event listeners to a bundle tab element.
 * Called during _renderBundleTabs for each tab.
 * @param {HTMLElement} tab — the tab button element
 * @param {object} bundle — the bundle object
 */
function _attachBundleTabContextMenu(tab, bundle) {
    // Desktop: right-click
    tab.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        _showBundleContextMenu(bundle, e.clientX, e.clientY);
    });

    // Mobile: long-press (500ms hold)
    var longPressTimer = null;
    var touchMoved = false;

    tab.addEventListener('touchstart', function(e) {
        touchMoved = false;
        longPressTimer = setTimeout(function() {
            if (!touchMoved) {
                e.preventDefault();
                var touch = e.changedTouches[0] || e.touches[0];
                var rect = tab.getBoundingClientRect();
                _showBundleContextMenu(bundle, touch.clientX, rect.bottom + 4);
            }
        }, 500);
    }, { passive: false });

    tab.addEventListener('touchmove', function() {
        touchMoved = true;
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    tab.addEventListener('touchend', function() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    tab.addEventListener('touchcancel', function() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}


/* ── Bundle Delete ────────────────────────────────────────────────────────── */

/**
 * Show delete confirmation for a bundle, then call DELETE API.
 * @param {object} bundle — the bundle to delete
 */
async function _deleteBundleConfirm(bundle) {
    var confirmed = await cwocConfirm(
        'Delete the bundle "' + bundle.name + '"?\n\nThis will remove the bundle and its classification rules. Emails will move to "Everything Else".',
        { title: 'Delete Bundle', confirmLabel: 'Delete', danger: true }
    );

    if (!confirmed) return;

    try {
        var resp = await fetch('/api/bundles/' + encodeURIComponent(bundle.id), {
            method: 'DELETE'
        });

        if (!resp.ok) {
            var data = await resp.json().catch(function() { return {}; });
            console.error('[Bundles] Delete failed:', data.detail || resp.status);
            return;
        }

        // If the deleted bundle was active, clear the filter
        if (_emailActiveBundle === bundle.name) {
            _emailActiveBundle = null;
            _persistActiveBundle();
        }

        // Invalidate settings cache so bundles are re-fetched fresh
        if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
        _emailBundlesData = null; // Force re-fetch

        // Refresh bundles and re-render
        _fetchBundles(function() {
            if (typeof displayChits === 'function') displayChits();
        });
    } catch (err) {
        console.error('[Bundles] Delete error:', err);
    }
}


/* ── Bundle Reorder (Drag-and-Drop) ──────────────────────────────────────── */

/** Whether reorder mode is currently active */
var _bundleReorderActive = false;

/**
 * Enable drag-and-drop reorder mode on bundle tabs.
 * Adds draggable attributes and visual indicators.
 */
function _enableBundleReorder() {
    var row = document.getElementById('bundleTabsRow');
    if (!row) return;

    _bundleReorderActive = true;
    row.classList.add('reorder-active');

    var tabs = row.querySelectorAll('.bundle-tab');
    var draggedTab = null;

    tabs.forEach(function(tab) {
        // Don't allow dragging "Everything Else" (always last)
        if (tab.dataset.bundleName === 'Everything Else') return;

        tab.setAttribute('draggable', 'true');

        tab.addEventListener('dragstart', _bundleReorderDragStart);
        tab.addEventListener('dragend', _bundleReorderDragEnd);
        tab.addEventListener('dragover', _bundleReorderDragOver);
        tab.addEventListener('drop', _bundleReorderDrop);
    });

    // Also allow dropping on "Everything Else" tab (to place before it)
    tabs.forEach(function(tab) {
        if (tab.dataset.bundleName === 'Everything Else') {
            tab.addEventListener('dragover', _bundleReorderDragOver);
            tab.addEventListener('drop', _bundleReorderDrop);
        }
    });

    // Click anywhere outside tabs to finish reorder
    setTimeout(function() {
        document.addEventListener('click', _bundleReorderFinishOnClick, true);
    }, 100);
}

/** @type {HTMLElement|null} */
var _bundleReorderDraggedTab = null;

function _bundleReorderDragStart(e) {
    _bundleReorderDraggedTab = e.target.closest('.bundle-tab');
    if (!_bundleReorderDraggedTab) return;
    e.dataTransfer.setData('text/plain', _bundleReorderDraggedTab.dataset.bundleName);
    e.dataTransfer.effectAllowed = 'move';
    _bundleReorderDraggedTab.classList.add('dragging');
}

function _bundleReorderDragEnd(e) {
    if (_bundleReorderDraggedTab) {
        _bundleReorderDraggedTab.classList.remove('dragging');
        _bundleReorderDraggedTab = null;
    }
    // Clear all drag-over indicators
    var row = document.getElementById('bundleTabsRow');
    if (row) {
        row.querySelectorAll('.bundle-tab').forEach(function(t) {
            t.classList.remove('drag-over-left', 'drag-over-right');
        });
    }
}

function _bundleReorderDragOver(e) {
    if (!_bundleReorderDraggedTab) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    var tab = e.target.closest('.bundle-tab');
    if (!tab || tab === _bundleReorderDraggedTab) return;

    // Clear previous indicators
    var row = document.getElementById('bundleTabsRow');
    if (row) {
        row.querySelectorAll('.bundle-tab').forEach(function(t) {
            t.classList.remove('drag-over-left', 'drag-over-right');
        });
    }

    // Show indicator on left or right side
    var rect = tab.getBoundingClientRect();
    var midX = rect.left + rect.width / 2;
    if (e.clientX < midX) {
        tab.classList.add('drag-over-left');
    } else {
        tab.classList.add('drag-over-right');
    }
}

function _bundleReorderDrop(e) {
    if (!_bundleReorderDraggedTab) return;
    e.preventDefault();

    var targetTab = e.target.closest('.bundle-tab');
    if (!targetTab || targetTab === _bundleReorderDraggedTab) return;

    var row = document.getElementById('bundleTabsRow');
    if (!row) return;

    // Collect current tab order (excluding "Everything Else" and "+" button)
    var allTabs = Array.from(row.querySelectorAll('.bundle-tab'));
    var bundleNames = allTabs.map(function(t) { return t.dataset.bundleName; });

    var draggedName = _bundleReorderDraggedTab.dataset.bundleName;
    var targetName = targetTab.dataset.bundleName;

    // Remove dragged from current position
    var fromIdx = bundleNames.indexOf(draggedName);
    if (fromIdx < 0) return;
    bundleNames.splice(fromIdx, 1);

    // Determine insert position
    var toIdx = bundleNames.indexOf(targetName);
    if (toIdx < 0) return;

    var rect = targetTab.getBoundingClientRect();
    var midX = rect.left + rect.width / 2;
    if (e.clientX > midX) toIdx++;

    bundleNames.splice(toIdx, 0, draggedName);

    // Clear indicators
    allTabs.forEach(function(t) {
        t.classList.remove('drag-over-left', 'drag-over-right');
    });

    // Build ordered list of bundle IDs from names
    var bundles = _emailBundlesData || [];
    var orderedIds = [];
    bundleNames.forEach(function(name) {
        var b = bundles.find(function(bun) { return bun.name === name; });
        if (b) orderedIds.push(b.id);
    });

    // Persist reorder via API
    _persistBundleReorder(orderedIds);
}

/**
 * Persist the new bundle order via PUT /api/bundles/reorder.
 * @param {string[]} orderedIds — bundle IDs in new order
 */
function _persistBundleReorder(orderedIds) {
    fetch('/api/bundles/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_ids: orderedIds })
    })
    .then(function(r) {
        if (!r.ok) {
            console.error('[Bundles] Reorder failed:', r.status);
            return;
        }
        // Invalidate settings cache so bundles are re-fetched fresh
        if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
        _emailBundlesData = null; // Force re-fetch
        // Refresh bundles and re-render tabs
        _fetchBundles(function() {
            if (typeof displayChits === 'function') displayChits();
        });
    })
    .catch(function(err) {
        console.error('[Bundles] Reorder error:', err);
    });
}

/**
 * Finish reorder mode when clicking outside the tab row.
 */
function _bundleReorderFinishOnClick(e) {
    var row = document.getElementById('bundleTabsRow');
    if (row && !row.contains(e.target)) {
        _disableBundleReorder();
    }
}

/**
 * Disable reorder mode and clean up.
 */
function _disableBundleReorder() {
    _bundleReorderActive = false;
    var row = document.getElementById('bundleTabsRow');
    if (row) {
        row.classList.remove('reorder-active');
        row.querySelectorAll('.bundle-tab').forEach(function(tab) {
            tab.removeAttribute('draggable');
            tab.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
        });
    }
    document.removeEventListener('click', _bundleReorderFinishOnClick, true);
}
