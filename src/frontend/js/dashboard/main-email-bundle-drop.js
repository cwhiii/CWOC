/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Dashboard — Email Bundle Drag-Drop
   
   Enables dragging email cards onto bundle tabs to move/classify emails.
   Shows a modal with options: Move once, Always by sender, Always by subject,
   Always by recipient. Supports wildcard (*) in match values.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── State ────────────────────────────────────────────────────────────────── */
var _bundleDropDragChit = null; // The chit being dragged

/* ── Initialize drag-drop on email cards ──────────────────────────────────── */

/**
 * Make an email card draggable for bundle drop.
 * Called from _buildEmailCard after the card is created.
 * Only enables native drag on pointer devices (desktop/laptop).
 * @param {HTMLElement} card — the email card element
 * @param {Object} chit — the chit data object
 */
function _initBundleDragOnCard(card, chit) {
    // Only enable native drag on non-touch (pointer) devices
    if (window.matchMedia('(pointer: fine)').matches) {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', function(e) {
            _bundleDropDragChit = chit;
            e.dataTransfer.setData('text/plain', chit.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('bundle-dragging');
            // Highlight all bundle tabs as drop targets
            document.querySelectorAll('.bundle-tab').forEach(function(tab) {
                if (tab.dataset.catchAll !== '1') tab.classList.add('bundle-drop-target');
            });
        });
        card.addEventListener('dragend', function() {
            card.classList.remove('bundle-dragging');
            _bundleDropDragChit = null;
            document.querySelectorAll('.bundle-tab').forEach(function(tab) {
                tab.classList.remove('bundle-drop-target');
                tab.classList.remove('bundle-drop-hover');
            });
        });
    }
}

/**
 * Initialize drop targets on bundle tabs.
 * Called after bundle tabs are rendered (from _renderBundleTabs).
 */
function _initBundleDropTargets() {
    document.querySelectorAll('.bundle-tab').forEach(function(tab) {
        // Skip catch-all bundles
        if (tab.dataset.catchAll === '1') return;

        tab.addEventListener('dragover', function(e) {
            if (!_bundleDropDragChit) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            tab.classList.add('bundle-drop-hover');
        });
        tab.addEventListener('dragleave', function() {
            tab.classList.remove('bundle-drop-hover');
        });
        tab.addEventListener('drop', function(e) {
            e.preventDefault();
            tab.classList.remove('bundle-drop-hover');
            if (!_bundleDropDragChit) return;
            // Ignore drops from bundle tab reorder (those have bundleName in dataTransfer)
            if (e.dataTransfer.types.indexOf('text/plain') === -1) return;

            var bundleId = tab.dataset.bundleId;
            var bundleName = tab.dataset.bundleName;
            if (!bundleId || !bundleName) return;

            var chitCopy = _bundleDropDragChit;
            _bundleDropDragChit = null;
            _showBundleDropModal(chitCopy, bundleId, bundleName);
        });
    });
}

/* ── Bundle Drop Modal ────────────────────────────────────────────────────── */

/**
 * Show the modal with move options after dropping an email on a bundle tab.
 * @param {Object} chit — the email chit that was dropped
 * @param {string} bundleId — target bundle ID
 * @param {string} bundleName — target bundle display name
 */
function _showBundleDropModal(chit, bundleId, bundleName) {
    if (!chit || !chit.id) return; // Safety: ignore invalid calls
    
    // Extract email metadata for pre-population
    var senderRaw = chit.email_from || '';
    var senderEmail = senderRaw;
    var emailMatch = senderRaw.match(/<([^>]+)>/);
    if (emailMatch) senderEmail = emailMatch[1];
    else if (senderRaw.indexOf('@') > -1) senderEmail = senderRaw.trim();

    var subject = chit.title || chit.email_subject || '';
    
    var recipientRaw = chit.email_to || '';
    var recipientEmail = '';
    // email_to might be a JSON array, an actual array, or a string
    if (Array.isArray(recipientRaw)) {
        recipientEmail = recipientRaw[0] || '';
    } else if (typeof recipientRaw === 'string' && recipientRaw.startsWith('[')) {
        try {
            var arr = JSON.parse(recipientRaw);
            recipientEmail = arr[0] || '';
        } catch(e) { recipientEmail = recipientRaw; }
    } else {
        recipientEmail = String(recipientRaw);
    }
    var recipientMatch = recipientEmail.match(/<([^>]+)>/);
    if (recipientMatch) recipientEmail = recipientMatch[1];
    else if (recipientEmail.indexOf('@') > -1) recipientEmail = recipientEmail.trim();

    // Build modal
    var overlay = document.createElement('div');
    overlay.className = 'cwoc-overlay';
    overlay.id = 'bundle-drop-overlay';

    var modal = document.createElement('div');
    modal.className = 'cwoc-modal bundle-drop-modal';

    var title = document.createElement('h3');
    title.textContent = 'Always move to ' + bundleName;
    modal.appendChild(title);

    // Radio options
    var options = [
        { value: 'move_once', label: 'Just this once', labelHtml: 'Just this <b>once</b>', matchField: null },
        { value: 'always_sender', label: 'From this sender', labelHtml: '<b>from</b> this sender', matchField: senderEmail },
        { value: 'always_subject', label: 'With this subject', labelHtml: '<b>with</b> this subject', matchField: subject },
        { value: 'always_recipient', label: 'To this recipient', labelHtml: '<b>to</b> this recipient', matchField: recipientEmail }
    ];

    var radioGroup = document.createElement('div');
    radioGroup.className = 'bundle-drop-options';

    var matchInput = null;

    options.forEach(function(opt, idx) {
        var row = document.createElement('label');
        row.className = 'bundle-drop-option';

        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'bundle-drop-mode';
        radio.value = opt.value;
        if (idx === 0) radio.checked = true;
        row.appendChild(radio);

        var labelText = document.createElement('span');
        labelText.innerHTML = opt.labelHtml;
        row.appendChild(labelText);

        radioGroup.appendChild(row);
    });
    modal.appendChild(radioGroup);

    // Match value input (shown for "always" options)
    var matchSection = document.createElement('div');
    matchSection.className = 'bundle-drop-match-section';
    matchSection.style.display = 'none';

    var matchLabel = document.createElement('label');
    matchLabel.textContent = 'Match value (use * as wildcard):';
    matchSection.appendChild(matchLabel);

    matchInput = document.createElement('input');
    matchInput.type = 'text';
    matchInput.className = 'bundle-drop-match-input';
    matchInput.value = senderEmail;
    matchSection.appendChild(matchInput);

    modal.appendChild(matchSection);

    // Retroactive checkbox (always visible, checked by default)
    var retroSection = document.createElement('div');
    retroSection.className = 'bundle-drop-retro-section';

    var retroLabel = document.createElement('label');
    retroLabel.className = 'bundle-drop-retro-label';

    var retroCb = document.createElement('input');
    retroCb.type = 'checkbox';
    retroCb.id = 'bundle-drop-retro';
    retroCb.checked = true;
    retroLabel.appendChild(retroCb);

    var retroText = document.createElement('span');
    retroText.textContent = ' Apply retroactively to existing emails';
    retroLabel.appendChild(retroText);

    retroSection.appendChild(retroLabel);
    modal.appendChild(retroSection);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.className = 'bundle-drop-buttons';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'zone-button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', _closeBundleDropModal);
    btnRow.appendChild(cancelBtn);

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'zone-button zone-button-primary';
    confirmBtn.textContent = 'Move';
    confirmBtn.addEventListener('click', function() {
        var mode = modal.querySelector('input[name="bundle-drop-mode"]:checked').value;
        var matchValue = matchInput.value.trim();
        var retroactive = retroCb.checked;
        _executeBundleDrop(chit.id, bundleId, mode, matchValue, retroactive);
    });
    btnRow.appendChild(confirmBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Show/hide match input based on radio selection
    radioGroup.addEventListener('change', function() {
        var selected = modal.querySelector('input[name="bundle-drop-mode"]:checked').value;
        if (selected === 'move_once') {
            matchSection.style.display = 'none';
            retroCb.checked = false;
        } else {
            matchSection.style.display = '';
            // Default retroactive to checked for sender and subject
            retroCb.checked = (selected === 'always_sender' || selected === 'always_subject');
            // Pre-populate match value based on selection
            if (selected === 'always_sender') matchInput.value = senderEmail;
            else if (selected === 'always_subject') matchInput.value = subject;
            else if (selected === 'always_recipient') matchInput.value = recipientEmail;
        }
    });

    // ESC to close
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) _closeBundleDropModal();
    });
    document.addEventListener('keydown', _bundleDropEscHandler, true);
}

function _bundleDropEscHandler(e) {
    if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        _closeBundleDropModal();
    }
}

function _closeBundleDropModal() {
    var overlay = document.getElementById('bundle-drop-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _bundleDropEscHandler, true);
}

/* ── API Call ──────────────────────────────────────────────────────────────── */

async function _executeBundleDrop(chitId, bundleId, mode, matchValue, retroactive) {
    _closeBundleDropModal();

    try {
        var response = await fetch('/api/bundles/' + bundleId + '/drop-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chit_id: chitId,
                mode: mode,
                match_value: matchValue,
                apply_retroactively: retroactive
            })
        });

        if (!response.ok) {
            var err = await response.json().catch(function() { return {}; });
            cwocToast(err.detail || 'Failed to move email', 'error');
            return;
        }

        var data = await response.json();
        var msg = 'Moved to ' + data.bundle_name;
        if (data.rule_name) msg += ' (rule created)';
        if (data.reclassified_count > 0) msg += ' — ' + data.reclassified_count + ' emails reclassified';
        cwocToast(msg, 'success');

        // Refresh the email view
        if (typeof fetchChits === 'function') {
            await fetchChits();
            if (typeof displayChits === 'function') displayChits();
        }
    } catch (e) {
        console.error('[BundleDrop] Error:', e);
        cwocToast('Failed to move email', 'error');
    }
}


/* ── Mobile: Long-press to move to bundle ─────────────────────────────────── */

/**
 * On mobile/touch devices, add a long-press handler that shows a bundle picker.
 * This is an alternative to drag-drop for touch screens.
 * @param {HTMLElement} card — the email card element
 * @param {Object} chit — the chit data object
 */
function _initBundleLongPressOnCard(card, chit) {
    var _lpTimer = null;
    var _lpMoved = false;

    card.addEventListener('touchstart', function(e) {
        _lpMoved = false;
        _lpTimer = setTimeout(function() {
            if (!_lpMoved) {
                e.preventDefault();
                _showBundlePickerForMobile(chit);
            }
        }, 600);
    }, { passive: false });

    card.addEventListener('touchmove', function() {
        _lpMoved = true;
        if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
    });

    card.addEventListener('touchend', function() {
        if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
    });
}

/**
 * Show a bundle picker modal on mobile (lists all bundles to choose from).
 * After picking a bundle, shows the same drop modal.
 * @param {Object} chit — the email chit
 */
function _showBundlePickerForMobile(chit) {
    // Get bundle data
    var bundles = (typeof _emailBundlesData !== 'undefined' && _emailBundlesData) ? _emailBundlesData : [];
    if (!bundles.length) {
        cwocToast('No bundles available', 'info');
        return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'cwoc-overlay';
    overlay.id = 'bundle-picker-overlay';

    var modal = document.createElement('div');
    modal.className = 'cwoc-modal bundle-drop-modal';

    var title = document.createElement('h3');
    title.textContent = 'Move to bundle...';
    modal.appendChild(title);

    var list = document.createElement('div');
    list.className = 'bundle-picker-list';

    bundles.filter(function(b) { return !b.is_catch_all && b.display_order !== -1; }).forEach(function(bundle) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'bundle-picker-item';
        item.textContent = bundle.name;
        if (bundle.color) {
            item.style.borderLeft = '4px solid ' + bundle.color;
        }
        item.addEventListener('click', function() {
            // Close picker, open drop modal
            overlay.remove();
            _showBundleDropModal(chit, bundle.id, bundle.name);
        });
        list.appendChild(item);
    });

    modal.appendChild(list);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'zone-button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginTop = '1em';
    cancelBtn.addEventListener('click', function() { overlay.remove(); });
    modal.appendChild(cancelBtn);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}
