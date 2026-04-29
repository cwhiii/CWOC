/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Contact Editor  (contact-editor.js)

   Page logic for contact-editor.html — 3-column zone layout, image upload,
   multi-value fields, color picker, prefix/suffix custom dropdowns,
   clickable website URLs, Signal username toggle, and CwocEditorSaveSystem.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── State ───────────────────────────────────────────────────────────
    var _contactId = null;
    var _isFavorite = false;
    var _saveSystem = null;
    var _currentImageUrl = null;

    // ── Contact Tags State ──────────────────────────────────────────────
    var _contactTags = [];

    function _renderContactTags() {
        var container = document.getElementById('contactTagsChips');
        if (!container) return;
        container.innerHTML = '';
        _contactTags.forEach(function (tag, idx) {
            var chip = document.createElement('span');
            chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:0.85em;background:rgba(139,90,43,0.15);color:#4a2c2a;';
            chip.textContent = tag;
            var removeBtn = document.createElement('span');
            removeBtn.textContent = '✕';
            removeBtn.style.cssText = 'cursor:pointer;opacity:0.6;font-size:0.8em;margin-left:2px;';
            removeBtn.addEventListener('click', function () {
                _contactTags.splice(idx, 1);
                _renderContactTags();
                if (_saveSystem) _saveSystem.markUnsaved();
            });
            chip.appendChild(removeBtn);
            container.appendChild(chip);
        });
    }

    function _initContactTags() {
        var input = document.getElementById('contactTagsInput');
        if (!input) return;
        // Pre-fill with "Contact/" prefix hint
        input.placeholder = 'Add tag (e.g. Contact/Family) and press Enter';
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var val = input.value.trim();
                if (!val) return;
                // Auto-prepend "Contact/" if not already prefixed
                if (!val.startsWith('Contact/') && !val.startsWith('contact/')) {
                    val = 'Contact/' + val;
                }
                if (!_contactTags.includes(val)) {
                    _contactTags.push(val);
                    _renderContactTags();
                    if (_saveSystem) _saveSystem.markUnsaved();
                }
                input.value = '';
            }
        });
    }

    var params = new URLSearchParams(window.location.search);
    _contactId = params.get('id') || null;

    // ── Color palette (matches chit editor) ─────────────────────────────
    var _colorPalette = [
        '#E3B23C', '#D4764E', '#D45B5B', '#C2185B', '#7B1FA2',
        '#512DA8', '#303F9F', '#1976D2', '#0097A7', '#00897B',
        '#388E3C', '#689F38', '#AFB42B', '#F9A825', '#FF8F00',
        '#D84315', '#795548', '#546E7A', '#8D6E63', '#E91E63'
    ];

    // ── Init on DOM ready ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        // Initialize mobile actions modal (shared header button pattern)
        if (typeof initMobileActionsModal === 'function') initMobileActionsModal();

        _initSaveSystem();
        _initHotkeys();
        _initColorPicker();
        _initImageUpload();
        _initSignalToggle();
        _initDisplayNameUpdater();
        _initContactTags();

        if (!_contactId) {
            document.getElementById('deleteButton').style.display = 'none';
            document.getElementById('qrButton').style.display = 'none';
        }

        if (_contactId) {
            _loadContact(_contactId);
        } else {
            // Auto-focus given name for new contacts
            var gn = document.getElementById('givenName');
            if (gn) setTimeout(function () { gn.focus(); }, 100);
        }
    });

    // ── Live display name header ────────────────────────────────────────
    function _initDisplayNameUpdater() {
        var fields = ['prefixSelect', 'prefixCustom', 'givenName', 'middleNames', 'surname', 'suffixSelect', 'suffixCustom'];
        fields.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', _updateDisplayNameHeader);
                el.addEventListener('change', _updateDisplayNameHeader);
            }
        });
    }

    function _updateDisplayNameHeader() {
        var prefix = _getDropdownCustomValue('prefixSelect', 'prefixCustom');
        var given = (document.getElementById('givenName').value || '').trim();
        var middle = (document.getElementById('middleNames').value || '').trim();
        var surname = (document.getElementById('surname').value || '').trim();
        var suffix = _getDropdownCustomValue('suffixSelect', 'suffixCustom');
        var parts = [prefix, given, middle, surname, suffix].filter(function (p) { return p; });
        var header = document.getElementById('displayNameHeader');
        if (header) {
            header.textContent = parts.length > 0 ? parts.join(' ') : 'New Contact';
        }
    }

    // ── ESC to exit ─────────────────────────────────────────────────────
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        // Close modals first
        var imgModal = document.getElementById('image-modal');
        if (imgModal && imgModal.style.display === 'flex') {
            imgModal.style.display = 'none';
            e.stopImmediatePropagation();
            return;
        }
        var qrOverlay = document.getElementById('cwoc-qr-overlay');
        if (qrOverlay) {
            qrOverlay.remove();
            e.stopImmediatePropagation();
            return;
        }
        var unsavedModal = document.getElementById('cwoc-unsaved-modal');
        if (unsavedModal) {
            unsavedModal.remove();
            e.stopImmediatePropagation();
            return;
        }
        // Navigate directly
        e.stopImmediatePropagation();
        window.location.href = '/frontend/people.html';
    }, true);

    // ── Load contact from API ───────────────────────────────────────────
    async function _loadContact(id) {
        try {
            var resp = await fetch('/api/contacts/' + encodeURIComponent(id));
            if (!resp.ok) {
                console.error('Failed to load contact:', resp.status);
                _showBriefMessage('Failed to load contact', true);
                return;
            }
            var contact = await resp.json();
            populateContactForm(contact);
            if (_saveSystem) _saveSystem.markSaved();
        } catch (err) {
            console.error('Error loading contact:', err);
            _showBriefMessage('Error loading contact', true);
        }
    }

    // ── Save System ─────────────────────────────────────────────────────
    function _initSaveSystem() {
        _saveSystem = new CwocEditorSaveSystem({
            singleBtnId: 'saveButton',
            stayBtnId: 'saveStayButton',
            exitBtnId: 'saveExitButton',
            cancelSelector: '.cancel',
            getReturnUrl: function () { return '/frontend/people.html'; },
            autoListenInputs: true
        });
    }

    // ── Hotkeys ─────────────────────────────────────────────────────────
    function _initHotkeys() {
        cwocInitEditorHotkeys({
            '1': ['nameSection', 'nameContent'],
            '2': ['phoneEmailSection', 'phoneEmailContent'],
            '3': ['socialSection', 'socialContent'],
            '4': ['securitySection', 'securityContent'],
            '5': ['contextSection', 'contextContent'],
            '6': ['colorSection', 'colorContent'],
            '7': ['notesSection', 'notesContent'],
            '8': ['tagsSection', 'tagsContent']
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ── Image Upload ────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    var _pendingImageFile = null; // File to upload on next save
    var _pendingImageRemove = false; // Flag to remove image on next save

    function _initImageUpload() {
        var fileInput = document.getElementById('imageFileInput');
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) _stageImage(fileInput.files[0]);
        });

        // Click on image opens full-size modal (if image exists)
        var imgEl = document.getElementById('profileImage');
        imgEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (imgEl.src && imgEl.style.display !== 'none') {
                var modal = document.getElementById('image-modal');
                document.getElementById('image-modal-img').src = imgEl.src;
                modal.style.display = 'flex';
            }
        });
    }

    window.triggerImageUpload = function () {
        document.getElementById('imageFileInput').click();
    };

    window.viewContactImage = function () {
        var imgEl = document.getElementById('profileImage');
        if (imgEl.style.display !== 'none' && imgEl.src) {
            var modal = document.getElementById('image-modal');
            document.getElementById('image-modal-img').src = imgEl.src;
            modal.style.display = 'flex';
        }
    };

    /** Stage an image locally (preview only) — actual upload happens on save */
    function _stageImage(file) {
        _pendingImageFile = file;
        _pendingImageRemove = false;
        // Show local preview via data URL
        var reader = new FileReader();
        reader.onload = function (e) {
            var imgEl = document.getElementById('profileImage');
            var placeholder = document.getElementById('profilePlaceholder');
            var removeBtn = document.getElementById('removeImageBtn');
            var viewBtn = document.getElementById('viewImageBtn');
            imgEl.src = e.target.result;
            imgEl.style.display = '';
            placeholder.style.display = 'none';
            removeBtn.style.display = '';
            if (viewBtn) viewBtn.style.display = '';
        };
        reader.readAsDataURL(file);
        if (_saveSystem) _saveSystem.markUnsaved();
    }

    /** Upload the pending image file to the server (called during save) */
    async function _uploadPendingImage() {
        if (!_pendingImageFile || !_contactId) return;
        try {
            var formData = new FormData();
            formData.append('file', _pendingImageFile);
            var resp = await fetch('/api/contacts/' + encodeURIComponent(_contactId) + '/image', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                var result = await resp.json();
                _currentImageUrl = result.image_url;
            }
        } catch (err) {
            console.error('Image upload error:', err);
        }
        _pendingImageFile = null;
    }

    /** Remove the pending image on save */
    async function _removePendingImage() {
        if (!_contactId) return;
        try {
            await fetch('/api/contacts/' + encodeURIComponent(_contactId) + '/image', { method: 'DELETE' });
            _currentImageUrl = null;
        } catch (err) {
            console.error('Error removing image:', err);
        }
        _pendingImageRemove = false;
    }

    function _setProfileImage(url) {
        _currentImageUrl = url || null;
        var imgEl = document.getElementById('profileImage');
        var placeholder = document.getElementById('profilePlaceholder');
        var removeBtn = document.getElementById('removeImageBtn');
        var viewBtn = document.getElementById('viewImageBtn');
        if (url) {
            imgEl.src = url + '?t=' + Date.now();
            imgEl.style.display = '';
            placeholder.style.display = 'none';
            removeBtn.style.display = '';
            if (viewBtn) viewBtn.style.display = '';
        } else {
            imgEl.style.display = 'none';
            imgEl.src = '';
            placeholder.style.display = '';
            removeBtn.style.display = 'none';
            if (viewBtn) viewBtn.style.display = 'none';
        }
    }

    window.removeContactImage = function () {
        _pendingImageFile = null;
        _pendingImageRemove = true;
        _setProfileImage(null);
        if (_saveSystem) _saveSystem.markUnsaved();
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── Signal Username Toggle ──────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    function _initSignalToggle() {
        var cb = document.getElementById('hasSignal');
        if (cb.checked) document.getElementById('signalUsername').style.display = '';
    }

    window.onSignalToggle = function () {
        var cb = document.getElementById('hasSignal');
        var input = document.getElementById('signalUsername');
        input.style.display = cb.checked ? '' : 'none';
        if (!cb.checked) input.value = '';
        if (_saveSystem) _saveSystem.markUnsaved();
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── Color Picker ────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    function _initColorPicker() {
        var container = document.getElementById('colorSwatches');
        if (!container) return;
        // Clear swatch
        var clearBtn = document.createElement('span');
        clearBtn.className = 'color-swatch';
        clearBtn.style.background = 'linear-gradient(135deg, #fff 45%, #f00 45%, #f00 55%, #fff 55%)';
        clearBtn.style.border = '1px solid #999';
        clearBtn.title = 'No color';
        clearBtn.addEventListener('click', function () { _selectColor(''); });
        container.appendChild(clearBtn);

        _colorPalette.forEach(function (hex) {
            var swatch = document.createElement('span');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = hex;
            swatch.title = hex;
            swatch.addEventListener('click', function () { _selectColor(hex); });
            container.appendChild(swatch);
        });

        var hexInput = document.getElementById('colorHex');
        hexInput.addEventListener('input', function () {
            var val = hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                _selectColor(val, true);
            }
        });
    }

    function _selectColor(hex, fromInput) {
        var preview = document.getElementById('colorPreview');
        var hexInput = document.getElementById('colorHex');
        var mainEditor = document.getElementById('mainEditor');
        preview.style.backgroundColor = hex || 'transparent';
        if (!fromInput) hexInput.value = hex;
        // Tint the editor background with the contact's color (like chit editor does)
        if (mainEditor) mainEditor.style.backgroundColor = hex || '';

        // Update swatch selection
        var swatches = document.querySelectorAll('#colorSwatches .color-swatch');
        swatches.forEach(function (s) {
            s.classList.toggle('selected', s.title === hex);
        });
        if (_saveSystem) _saveSystem.markUnsaved();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ── Prefix / Suffix Custom Dropdown Logic ───────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    window.onDropdownCustomChange = function (selectId, customInputId) {
        var sel = document.getElementById(selectId);
        var customEl = document.getElementById(customInputId);
        if (sel.value === '__custom__') {
            customEl.classList.add('visible');
            customEl.focus();
        } else {
            customEl.classList.remove('visible');
            customEl.value = '';
        }
        if (_saveSystem) _saveSystem.markUnsaved();
    };

    function _getDropdownCustomValue(selectId, customInputId) {
        var sel = document.getElementById(selectId);
        if (sel.value === '__custom__') {
            return (document.getElementById(customInputId).value || '').trim();
        }
        return sel.value;
    }

    function _setDropdownCustomValue(selectId, customInputId, value) {
        var sel = document.getElementById(selectId);
        var customEl = document.getElementById(customInputId);
        value = (value || '').trim();
        var found = false;
        for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === value && value !== '__custom__') {
                sel.value = value;
                customEl.classList.remove('visible');
                customEl.value = '';
                found = true;
                break;
            }
        }
        if (!found && value) {
            sel.value = '__custom__';
            customEl.classList.add('visible');
            customEl.value = value;
        } else if (!value) {
            sel.value = '';
            customEl.classList.remove('visible');
            customEl.value = '';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ── Multi-Value Field Management ────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    var _multiValueMap = {
        phones:    'phonesEntries',
        emails:    'emailsEntries',
        addresses: 'addressesEntries',
        callSigns: 'callSignsEntries',
        xHandles:  'xHandlesEntries',
        websites:  'websitesEntries'
    };

    var _valuePlaceholders = {
        phones:    '+1-555-0100',
        emails:    'user@example.com',
        addresses: '4 Rolling Mill Way, Canton, MA 02021',
        callSigns: 'KD2ABC',
        xHandles:  '@username',
        websites:  'https://example.com'
    };

    // Fields whose values should be clickable URLs when not focused
    var _urlFields = { websites: true };

    window.addMultiValueEntry = function (fieldName, defaultLabel, defaultValue) {
        var containerId = _multiValueMap[fieldName];
        if (!containerId) return;
        var container = document.getElementById(containerId);
        if (!container) return;

        var row = document.createElement('div');
        row.className = 'multi-value-row';

        var labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'mv-label';
        labelInput.placeholder = 'Label';
        labelInput.value = defaultLabel || '';

        var valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'mv-value';
        valueInput.placeholder = _valuePlaceholders[fieldName] || 'Value';
        valueInput.value = defaultValue || '';

        // Clickable link for URL fields
        var link = document.createElement('a');
        link.className = 'mv-link';
        link.target = '_blank';
        link.rel = 'noopener';
        link.innerHTML = '<i class="fas fa-external-link-alt"></i>';

        if (_urlFields[fieldName]) {
            _setupUrlToggle(valueInput, link);
        }

        // Map button for address fields — uses Google or OSM based on setting
        var mapBtn = null;
        if (fieldName === 'addresses') {
            mapBtn = document.createElement('button');
            mapBtn.type = 'button';
            mapBtn.className = 'zone-button';
            mapBtn.title = 'Open in Maps';
            mapBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
            mapBtn.disabled = !defaultValue;
            mapBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var addr = valueInput.value.trim();
                if (!addr) return;
                var co = (window._cwocSettings && window._cwocSettings.chit_options) || {};
                if (co.prefer_google_maps) {
                    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), '_blank', 'noopener');
                } else {
                    window.open('https://www.openstreetmap.org/search?query=' + encodeURIComponent(addr), '_blank');
                }
            });
            valueInput.addEventListener('input', function() {
                mapBtn.disabled = !valueInput.value.trim();
            });
        }

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-entry-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Remove entry';
        removeBtn.addEventListener('click', function () {
            row.remove();
            if (_saveSystem) _saveSystem.markUnsaved();
        });

        labelInput.addEventListener('input', function () { if (_saveSystem) _saveSystem.markUnsaved(); });
        valueInput.addEventListener('input', function () { if (_saveSystem) _saveSystem.markUnsaved(); });

        row.appendChild(labelInput);
        row.appendChild(valueInput);
        row.appendChild(link);
        if (mapBtn) row.appendChild(mapBtn);
        row.appendChild(removeBtn);
        container.appendChild(row);

        if (_saveSystem) _saveSystem.markUnsaved();
        valueInput.focus();
    };

    function _setupUrlToggle(input, link) {
        function updateLink() {
            var val = input.value.trim();
            if (val && !document.activeElement === input) {
                var href = val.startsWith('http') ? val : 'https://' + val;
                link.href = href;
                link.style.display = '';
            } else {
                link.style.display = 'none';
            }
        }
        input.addEventListener('focus', function () { link.style.display = 'none'; });
        input.addEventListener('blur', function () {
            var val = input.value.trim();
            if (val) {
                link.href = val.startsWith('http') ? val : 'https://' + val;
                link.style.display = '';
            }
        });
        // Initial state
        setTimeout(updateLink, 0);
    }

    function _getMultiValueEntries(fieldName) {
        var containerId = _multiValueMap[fieldName];
        if (!containerId) return [];
        var container = document.getElementById(containerId);
        if (!container) return [];
        var entries = [];
        var rows = container.querySelectorAll('.multi-value-row');
        for (var i = 0; i < rows.length; i++) {
            var label = rows[i].querySelector('.mv-label').value.trim();
            var value = rows[i].querySelector('.mv-value').value.trim();
            if (value) entries.push({ label: label, value: value });
        }
        return entries;
    }

    function _setMultiValueEntries(fieldName, entries) {
        var containerId = _multiValueMap[fieldName];
        if (!containerId) return;
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (!entries || !entries.length) return;
        for (var i = 0; i < entries.length; i++) {
            addMultiValueEntry(fieldName, entries[i].label || '', entries[i].value || '');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ── Favorite Toggle ─────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    function _updateFavoriteDisplay() {
        var btn = document.getElementById('favoriteBtn');
        btn.textContent = _isFavorite ? '★' : '☆';
        btn.title = _isFavorite ? 'Remove from favorites' : 'Add to favorites';
    }

    window.toggleFavorite = async function () {
        if (!_contactId) {
            _isFavorite = !_isFavorite;
            _updateFavoriteDisplay();
            if (_saveSystem) _saveSystem.markUnsaved();
            return;
        }
        try {
            var resp = await fetch('/api/contacts/' + encodeURIComponent(_contactId) + '/favorite', { method: 'PATCH' });
            if (!resp.ok) { _showBriefMessage('Failed to toggle favorite', true); return; }
            var updated = await resp.json();
            _isFavorite = !!updated.favorite;
            _updateFavoriteDisplay();
        } catch (err) {
            console.error('Error toggling favorite:', err);
            _showBriefMessage('Error toggling favorite', true);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── Collect / Populate Form Data ────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    window.collectContactData = function () {
        return {
            given_name:      document.getElementById('givenName').value.trim(),
            surname:         document.getElementById('surname').value.trim(),
            middle_names:    document.getElementById('middleNames').value.trim(),
            prefix:          _getDropdownCustomValue('prefixSelect', 'prefixCustom'),
            suffix:          _getDropdownCustomValue('suffixSelect', 'suffixCustom'),
            nickname:        document.getElementById('nickname').value.trim(),
            phones:          _getMultiValueEntries('phones'),
            emails:          _getMultiValueEntries('emails'),
            addresses:       _getMultiValueEntries('addresses'),
            call_signs:      _getMultiValueEntries('callSigns'),
            x_handles:       _getMultiValueEntries('xHandles'),
            websites:        _getMultiValueEntries('websites'),
            has_signal:      document.getElementById('hasSignal').checked,
            signal_username: document.getElementById('signalUsername').value.trim() || null,
            pgp_key:         document.getElementById('pgpKey').value.trim() || null,
            favorite:        _isFavorite,
            color:           document.getElementById('colorHex').value.trim() || null,
            organization:    document.getElementById('organization').value.trim() || null,
            social_context:  document.getElementById('socialContext').value.trim() || null,
            image_url:       _currentImageUrl,
            notes:           document.getElementById('contactNotes').value.trim() || null,
            tags:            _contactTags.length > 0 ? _contactTags.slice() : null,
        };
    };

    window.populateContactForm = function (contact) {
        if (!contact) return;

        _contactId = contact.id || null;
        _isFavorite = !!contact.favorite;
        _updateFavoriteDisplay();

        document.getElementById('givenName').value = contact.given_name || '';
        document.getElementById('surname').value = contact.surname || '';
        document.getElementById('middleNames').value = contact.middle_names || '';
        document.getElementById('nickname').value = contact.nickname || '';

        _setDropdownCustomValue('prefixSelect', 'prefixCustom', contact.prefix || '');
        _setDropdownCustomValue('suffixSelect', 'suffixCustom', contact.suffix || '');

        _setMultiValueEntries('phones', contact.phones);
        _setMultiValueEntries('emails', contact.emails);
        _setMultiValueEntries('addresses', contact.addresses);
        _setMultiValueEntries('callSigns', contact.call_signs);
        _setMultiValueEntries('xHandles', contact.x_handles);
        _setMultiValueEntries('websites', contact.websites);

        document.getElementById('hasSignal').checked = !!contact.has_signal;
        if (contact.has_signal) {
            document.getElementById('signalUsername').style.display = '';
        }
        document.getElementById('signalUsername').value = contact.signal_username || '';
        document.getElementById('pgpKey').value = contact.pgp_key || '';

        // Color
        if (contact.color) _selectColor(contact.color);

        // Context
        document.getElementById('organization').value = contact.organization || '';
        document.getElementById('socialContext').value = contact.social_context || '';

        // Notes
        document.getElementById('contactNotes').value = contact.notes || '';

        // Tags — prepopulate with "Contact/" prefix
        _contactTags = Array.isArray(contact.tags) ? contact.tags.slice() : [];
        if (_contactTags.length === 0 && !_contactId) {
            // New contact: default to having "Contact/" prefix tag
            // (don't add automatically — just pre-fill the input)
        }
        _renderContactTags();

        // Image
        _setProfileImage(contact.image_url || null);

        // Update display name header
        _updateDisplayNameHeader();

        // Show map for first address if available
        _showContactAddressMap(contact.addresses);

        // Show delete/QR buttons for existing contacts
        if (_contactId) {
            document.getElementById('deleteButton').style.display = '';
            document.getElementById('qrButton').style.display = '';
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── Save / Delete / Share Logic ─────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    function _showBriefMessage(msg, isError) {
        var el = document.getElementById('saveButton');
        if (!el) return;
        var origText = el.innerHTML;
        var origDisplay = el.style.display;
        el.style.display = '';
        el.disabled = false;
        el.style.opacity = '1';
        el.style.pointerEvents = 'none';
        el.innerHTML = (isError ? '❌ ' : '✅ ') + msg;
        if (isError) el.style.color = '#a01c1c';
        setTimeout(function () {
            el.innerHTML = origText;
            el.style.color = '';
            el.style.display = origDisplay;
            if (_saveSystem) _saveSystem.markSaved();
        }, 1500);
    }

    async function _saveContact() {
        var data = collectContactData();
        if (!data.given_name) {
            _showBriefMessage('Given name is required', true);
            return null;
        }

        var url, method;
        if (_contactId) {
            url = '/api/contacts/' + encodeURIComponent(_contactId);
            method = 'PUT';
        } else {
            url = '/api/contacts';
            method = 'POST';
        }

        try {
            var resp = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!resp.ok) {
                var errBody = null;
                try { errBody = await resp.json(); } catch (e) { /* ignore */ }
                var errMsg = (errBody && errBody.detail) ? errBody.detail : ('Save failed (' + resp.status + ')');
                _showBriefMessage(errMsg, true);
                return null;
            }
            var saved = await resp.json();

            if (!_contactId && saved.id) {
                _contactId = saved.id;
                var newUrl = window.location.pathname + '?id=' + encodeURIComponent(saved.id);
                window.history.replaceState(null, '', newUrl);
                document.getElementById('deleteButton').style.display = '';
                document.getElementById('qrButton').style.display = '';
            }

            _isFavorite = !!saved.favorite;
            _updateFavoriteDisplay();

            // Handle pending image upload or removal now that we have an ID
            if (_pendingImageFile) {
                await _uploadPendingImage();
            } else if (_pendingImageRemove) {
                await _removePendingImage();
            }

            _showBriefMessage('Saved');
            return saved;
        } catch (err) {
            console.error('Error saving contact:', err);
            _showBriefMessage('Connection error', true);
            return null;
        }
    }

    window.saveContactAndStay = async function () { await _saveContact(); };

    window.saveContactAndExit = async function () {
        var saved = await _saveContact();
        if (saved) window.location.href = '/frontend/people.html';
    };

    window.cancelOrExit = function () {
        if (_saveSystem) {
            _saveSystem.cancelOrExit();
        } else {
            window.location.href = '/frontend/people.html';
        }
    };

    window.deleteContact = async function () {
        if (!_contactId) return;
        if (!(await cwocConfirm('Are you sure you want to permanently delete this contact?', { title: 'Delete Contact', confirmLabel: '🗑️ Delete', danger: true }))) return;
        try {
            var resp = await fetch('/api/contacts/' + encodeURIComponent(_contactId), { method: 'DELETE' });
            if (!resp.ok) { _showBriefMessage('Delete failed', true); return; }
            window.location.href = '/frontend/people.html';
        } catch (err) {
            console.error('Error deleting contact:', err);
            _showBriefMessage('Connection error', true);
        }
    };

    window.shareContact = function () {
        if (!_contactId) return;
        var data = collectContactData();
        data.id = _contactId;
        data.display_name = [data.prefix, data.given_name, data.middle_names, data.surname, data.suffix]
            .filter(function (p) { return p; }).join(' ');
        showContactQrCode(data);
    };

    window.closeQrModal = function () {
        var modal = document.getElementById('cwoc-qr-overlay');
        if (modal) modal.remove();
    };

    // QR modal backdrop — handled by shared showQRModal()

    // ── Expose state getters ────────────────────────────────────────────
    window._contactEditorState = {
        getContactId: function () { return _contactId; },
        setContactId: function (id) { _contactId = id; },
        isFavorite: function () { return _isFavorite; },
        setFavorite: function (v) { _isFavorite = v; _updateFavoriteDisplay(); },
        getSaveSystem: function () { return _saveSystem; }
    };

    // ── Contact Address Map ─────────────────────────────────────────────
    async function _showContactAddressMap(addresses) {
        var mapEl = document.getElementById('contact-address-map');
        if (!mapEl) return;
        if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
            mapEl.style.display = 'none';
            return;
        }
        // Find first address with a non-empty value
        var addr = null;
        for (var i = 0; i < addresses.length; i++) {
            var val = (addresses[i].value || '').trim();
            if (val) { addr = val; break; }
        }
        if (!addr) { mapEl.style.display = 'none'; return; }

        // Geocode using shared function if available, otherwise use proxy
        var lat, lon, found = false;
        if (typeof _geocodeAddress === 'function') {
            try {
                var coords = await _geocodeAddress(addr);
                lat = coords.lat;
                lon = coords.lon;
                found = true;
            } catch (e) { /* not found */ }
        } else {
            // Fallback: use backend proxy directly
            var queries = [addr];
            var noZip = addr.replace(/\s*\d{5}(-\d{4})?\s*$/, '').trim();
            if (noZip && noZip !== addr) queries.push(noZip);
            var parts = addr.split(',');
            if (parts.length >= 2) queries.push(parts.slice(1).join(',').trim());
            if (parts.length >= 3) queries.push(parts.slice(-2).join(',').trim());
            for (var gi = 0; gi < queries.length; gi++) {
                var q = queries[gi];
                if (!q) continue;
                try {
                    var resp = await fetch('/api/geocode?q=' + encodeURIComponent(q));
                    var data = await resp.json();
                    if (data && data.results && data.results.length > 0) {
                        lat = data.results[0].lat;
                        lon = data.results[0].lon;
                        found = true;
                        break;
                    }
                } catch (e) { /* skip */ }
            }
        }
        if (!found) { mapEl.style.display = 'none'; return; }

        mapEl.style.display = '';
        mapEl.innerHTML = '<iframe width="100%" height="180" frameborder="0" scrolling="no" ' +
            'src="https://www.openstreetmap.org/export/embed.html?bbox=' +
            (lon - 0.01) + ',' + (lat - 0.007) + ',' + (lon + 0.01) + ',' + (lat + 0.007) +
            '&layer=mapnik&marker=' + lat + ',' + lon + '" style="border:0;border-radius:5px;"></iframe>';
    }
    window._showContactAddressMap = _showContactAddressMap;

})();
