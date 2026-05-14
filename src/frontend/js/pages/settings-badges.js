/**
 * settings-badges.js — Badges (Smart Actions) settings section.
 *
 * Manages the enable/disable toggles for built-in detectors,
 * custom detector CRUD, and max results configuration.
 *
 * Depends on: shared-smart-links.js (_smartLinkDetectors),
 *             shared-utils.js (cwocConfirm, cwocToast),
 *             settings.js (setSaveButtonUnsaved, window.settingsManager)
 * ────────────────────────────────────────────────────────────────────────── */

// ── Module state ─────────────────────────────────────────────────────────────

var _badgesConfig = {
    disabled: {},
    disabledCategories: [],
    maxResults: 3,
    customDetectors: []
};

var _badgesEditingId = null; // ID of custom detector being edited (null = new)

// ── Initialization ───────────────────────────────────────────────────────────

function _initBadgesSettings() {
    // Load config from settings
    var raw = window.settingsManager && window.settingsManager.settings
        ? window.settingsManager.settings.smart_actions_config : null;
    if (raw) {
        try {
            var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            _badgesConfig.disabled = parsed.disabled || {};
            _badgesConfig.disabledCategories = parsed.disabledCategories || [];
            _badgesConfig.maxResults = parsed.maxResults || 3;
            _badgesConfig.customDetectors = parsed.customDetectors || [];
        } catch (e) {
            console.error('[Badges] Failed to parse smart_actions_config:', e);
        }
    }

    // Set max results dropdown
    var maxSel = document.getElementById('smart-actions-max');
    if (maxSel) maxSel.value = String(_badgesConfig.maxResults);

    // Render category groups
    _renderBadgeCategories();

    // Render custom detectors list
    _renderBadgeCustomList();

    // Wire events
    if (maxSel) {
        maxSel.addEventListener('change', function() {
            _badgesConfig.maxResults = parseInt(this.value) || 3;
            setSaveButtonUnsaved();
        });
    }

    var addBtn = document.getElementById('smart-actions-add-custom');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            _badgesEditingId = null;
            _openBadgeCustomModal();
        });
    }

    // Modal buttons
    var cancelBtn = document.getElementById('badge-custom-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', _closeBadgeCustomModal);
    var saveBtn = document.getElementById('badge-custom-save');
    if (saveBtn) saveBtn.addEventListener('click', _saveBadgeCustomDetector);

    // ESC to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var overlay = document.getElementById('badge-custom-modal-overlay');
            if (overlay && overlay.style.display !== 'none') {
                e.stopImmediatePropagation();
                e.preventDefault();
                _closeBadgeCustomModal();
            }
        }
    }, true);
}

// ── Render category groups ───────────────────────────────────────────────────

function _renderBadgeCategories() {
    var container = document.getElementById('smart-actions-categories');
    if (!container) return;
    container.innerHTML = '';

    // Group built-in detectors by category
    var categories = {};
    if (typeof _smartLinkDetectors !== 'undefined') {
        for (var i = 0; i < _smartLinkDetectors.length; i++) {
            var det = _smartLinkDetectors[i];
            if (!categories[det.category]) categories[det.category] = [];
            categories[det.category].push(det);
        }
    }

    var catNames = Object.keys(categories).sort();
    for (var c = 0; c < catNames.length; c++) {
        var catName = catNames[c];
        var detectors = categories[catName];
        var catDisabled = _badgesConfig.disabledCategories.indexOf(catName) !== -1;

        var group = document.createElement('div');
        group.className = 'badge-category-group';
        group.style.marginBottom = '10px';

        // Category header with toggle
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;cursor:pointer;';
        header.innerHTML = '<span style="font-weight:600;font-size:0.9em;">' + catName + '</span>';

        var catCb = document.createElement('input');
        catCb.type = 'checkbox';
        catCb.checked = !catDisabled;
        catCb.dataset.category = catName;
        catCb.addEventListener('change', _onBadgeCategoryToggle);
        header.appendChild(catCb);
        group.appendChild(header);

        // Individual detectors (collapsible)
        var detList = document.createElement('div');
        detList.style.cssText = 'padding-left:16px;font-size:0.85em;';
        if (catDisabled) detList.style.opacity = '0.5';
        detList.dataset.catList = catName;

        for (var d = 0; d < detectors.length; d++) {
            var det2 = detectors[d];
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:2px 0;';
            row.innerHTML = '<span>' + det2.name + '</span>';

            var detCb = document.createElement('input');
            detCb.type = 'checkbox';
            detCb.checked = !_badgesConfig.disabled[det2.name];
            detCb.dataset.detectorName = det2.name;
            detCb.addEventListener('change', _onBadgeDetectorToggle);
            row.appendChild(detCb);
            detList.appendChild(row);
        }
        group.appendChild(detList);
        container.appendChild(group);
    }
}

function _onBadgeCategoryToggle(e) {
    var catName = e.target.dataset.category;
    var enabled = e.target.checked;
    var idx = _badgesConfig.disabledCategories.indexOf(catName);

    if (enabled && idx !== -1) {
        _badgesConfig.disabledCategories.splice(idx, 1);
    } else if (!enabled && idx === -1) {
        _badgesConfig.disabledCategories.push(catName);
    }

    // Update visual opacity of the detector list
    var detList = document.querySelector('[data-cat-list="' + catName + '"]');
    if (detList) detList.style.opacity = enabled ? '1' : '0.5';

    setSaveButtonUnsaved();
}

function _onBadgeDetectorToggle(e) {
    var name = e.target.dataset.detectorName;
    if (e.target.checked) {
        delete _badgesConfig.disabled[name];
    } else {
        _badgesConfig.disabled[name] = true;
    }
    setSaveButtonUnsaved();
}

// ── Custom detectors list ────────────────────────────────────────────────────

function _renderBadgeCustomList() {
    var container = document.getElementById('smart-actions-custom-list');
    if (!container) return;
    container.innerHTML = '';

    if (_badgesConfig.customDetectors.length === 0) {
        container.innerHTML = '<p class="setting-hint" style="margin:4px 0;">No custom detectors defined.</p>';
        return;
    }

    for (var i = 0; i < _badgesConfig.customDetectors.length; i++) {
        var cd = _badgesConfig.customDetectors[i];
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(139,90,43,0.1);';

        var left = document.createElement('span');
        left.style.cssText = 'font-size:0.9em;';
        left.textContent = cd.name + ' (' + cd.category + ')';

        var right = document.createElement('span');
        right.style.cssText = 'display:flex;gap:6px;align-items:center;';

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'standard-button';
        editBtn.style.cssText = 'font-size:0.75em;padding:2px 6px;';
        editBtn.textContent = '✎';
        editBtn.dataset.idx = String(i);
        editBtn.addEventListener('click', function() {
            _badgesEditingId = _badgesConfig.customDetectors[parseInt(this.dataset.idx)].id;
            _openBadgeCustomModal(_badgesConfig.customDetectors[parseInt(this.dataset.idx)]);
        });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'standard-button';
        delBtn.style.cssText = 'font-size:0.75em;padding:2px 6px;color:#b22222;';
        delBtn.textContent = '🗑';
        delBtn.dataset.idx = String(i);
        delBtn.addEventListener('click', function() {
            var idx2 = parseInt(this.dataset.idx);
            cwocConfirm('Delete "' + _badgesConfig.customDetectors[idx2].name + '"?', function() {
                _badgesConfig.customDetectors.splice(idx2, 1);
                _renderBadgeCustomList();
                setSaveButtonUnsaved();
            });
        });

        right.appendChild(editBtn);
        right.appendChild(delBtn);
        row.appendChild(left);
        row.appendChild(right);
        container.appendChild(row);
    }
}

// ── Custom detector modal ────────────────────────────────────────────────────

function _openBadgeCustomModal(existing) {
    var overlay = document.getElementById('badge-custom-modal-overlay');
    if (!overlay) return;

    var title = document.getElementById('badge-custom-modal-title');
    if (title) title.textContent = existing ? 'Edit Custom Detector' : 'Add Custom Detector';

    document.getElementById('badge-custom-name').value = existing ? existing.name : '';
    document.getElementById('badge-custom-category').value = existing ? existing.category : 'Custom';
    document.getElementById('badge-custom-keywords').value = existing ? (existing.keywords || []).join(', ') : '';
    document.getElementById('badge-custom-regex').value = existing ? existing.regex : '';
    document.getElementById('badge-custom-url').value = existing ? existing.url : '';
    document.getElementById('badge-custom-label').value = existing ? existing.label : 'View';

    // Clear errors
    document.getElementById('badge-custom-regex-error').style.display = 'none';
    document.getElementById('badge-custom-url-error').style.display = 'none';

    overlay.style.display = 'flex';
}

function _closeBadgeCustomModal() {
    var overlay = document.getElementById('badge-custom-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    _badgesEditingId = null;
}

function _saveBadgeCustomDetector() {
    var name = document.getElementById('badge-custom-name').value.trim();
    var category = document.getElementById('badge-custom-category').value;
    var keywordsRaw = document.getElementById('badge-custom-keywords').value.trim();
    var regexStr = document.getElementById('badge-custom-regex').value.trim();
    var urlTemplate = document.getElementById('badge-custom-url').value.trim();
    var label = document.getElementById('badge-custom-label').value;

    // Validate name
    if (!name) {
        cwocToast('Name is required', 'error');
        return;
    }

    // Validate regex
    var regexErr = document.getElementById('badge-custom-regex-error');
    if (!regexStr) {
        regexErr.textContent = 'Regex is required';
        regexErr.style.display = 'block';
        return;
    }
    try {
        new RegExp(regexStr);
        regexErr.style.display = 'none';
    } catch (e) {
        regexErr.textContent = 'Invalid regex: ' + e.message;
        regexErr.style.display = 'block';
        return;
    }

    // Validate URL template
    var urlErr = document.getElementById('badge-custom-url-error');
    if (!urlTemplate) {
        urlErr.textContent = 'URL template is required';
        urlErr.style.display = 'block';
        return;
    }
    if (urlTemplate.indexOf('{code}') === -1) {
        urlErr.textContent = 'URL must contain {code} placeholder';
        urlErr.style.display = 'block';
        return;
    }
    urlErr.style.display = 'none';

    // Parse keywords
    var keywords = keywordsRaw ? keywordsRaw.split(',').map(function(k) { return k.trim(); }).filter(Boolean) : [];

    // Build detector object
    var detector = {
        id: _badgesEditingId || ('custom-' + Date.now()),
        name: name,
        category: category,
        keywords: keywords,
        regex: regexStr,
        url: urlTemplate,
        label: label,
        icon: '/static/tracking/order.svg',
        priority: 50,
        enabled: true
    };

    // Save (edit or add)
    if (_badgesEditingId) {
        for (var i = 0; i < _badgesConfig.customDetectors.length; i++) {
            if (_badgesConfig.customDetectors[i].id === _badgesEditingId) {
                _badgesConfig.customDetectors[i] = detector;
                break;
            }
        }
    } else {
        _badgesConfig.customDetectors.push(detector);
    }

    _closeBadgeCustomModal();
    _renderBadgeCustomList();
    setSaveButtonUnsaved();
    cwocToast('Custom detector saved', 'success');
}

// ── Gather config for save ───────────────────────────────────────────────────

function _gatherBadgesConfig() {
    return JSON.stringify({
        disabled: _badgesConfig.disabled,
        disabledCategories: _badgesConfig.disabledCategories,
        maxResults: _badgesConfig.maxResults,
        customDetectors: _badgesConfig.customDetectors
    });
}
