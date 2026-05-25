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
            _showAddToBundleModal(chitCopy, bundleId, bundleName);
        });
    });
}

/* ── Bundle Drop Modal (unified — see shared.js _showAddToBundleModal) ──── */
// The modal is now handled by the unified _showAddToBundleModal in shared.js.
// Drag-drop and long-press both call it with (chit, bundleId, bundleName).


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
            // Close picker, open unified add-to-bundle modal
            overlay.remove();
            _showAddToBundleModal(chit, bundle.id, bundle.name);
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
