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

    // ── Mode detection: contact vs profile ──────────────────────────────
    var _isProfileMode = false;
    var _profileUserId = null;       // user_id when viewing another user's profile
    var _viewingOtherUser = false;   // true = read-only view of another user

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

    // ── Default vault setting for new contacts ──────────────────────────
    async function _applyDefaultVaultSetting() {
        try {
            var settings = typeof getCachedSettings === 'function' ? await getCachedSettings() : null;
            if (settings && settings.default_share_contacts === '1') {
                var hidden = document.getElementById('vault-toggle');
                if (hidden) {
                    hidden.value = '1';
                    _updatePillToggle('vault-pill', '1');
                }
            }
        } catch (e) {
            console.error('Error loading default vault setting:', e);
        }
    }

    // ── Pill toggle helper (same pattern as settings page) ──────────────
    function _initPillToggle(pillId, hiddenInputId) {
        var pill = document.getElementById(pillId);
        if (!pill) return;
        pill.addEventListener('click', function() {
            var hidden = document.getElementById(hiddenInputId);
            var spans = pill.querySelectorAll('span[data-val]');
            if (!hidden || spans.length < 2) return;
            var current = hidden.value;
            var next = (spans[0].dataset.val === current) ? spans[1].dataset.val : spans[0].dataset.val;
            hidden.value = next;
            _updatePillToggle(pillId, next);
            if (_saveSystem) _saveSystem.markUnsaved();
        });
    }

    function _updatePillToggle(pillId, activeVal) {
        var pill = document.getElementById(pillId);
        if (!pill) return;
        pill.querySelectorAll('span[data-val]').forEach(function(span) {
            span.classList.toggle('active', span.dataset.val === activeVal);
        });
    }

    var params = new URLSearchParams(window.location.search);
    _contactId = params.get('id') || null;
    _isProfileMode = params.get('mode') === 'profile';
    _profileUserId = params.get('user_id') || null;

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

        // Warn on refresh/close if there are unsaved changes
        window.addEventListener('beforeunload', function(e) {
            if (window._cwocSkipBeforeUnload) return;
            if (_saveSystem && _saveSystem.hasChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        _initColorPicker();
        _initImageUpload();
        _initSignalToggle();
        _initDisplayNameUpdater();
        _initPillToggle('vault-pill', 'vault-toggle');

        if (_isProfileMode) {
            _initProfileMode();
        } else {
            _initContactTags();
            if (!_contactId) {
                document.getElementById('deleteButton').style.display = 'none';
                document.getElementById('qrButton').style.display = 'none';
            }
            if (_contactId) {
                _loadContact(_contactId);
            } else {
                var gn = document.getElementById('givenName');
                if (gn) setTimeout(function () { gn.focus(); }, 100);
                // Apply default vault setting for new contacts
                _applyDefaultVaultSetting();

                // Prefill from URL params (e.g. from email "add sender as contact")
                var prefillEmail = params.get('prefill_email');
                var prefillName = params.get('prefill_name');
                if (prefillEmail) {
                    // Add the email to the emails multi-value field
                    _setMultiValueEntries('emails', [{ label: 'Email', value: prefillEmail }]);
                }
                if (prefillName) {
                    // Try to split into given/surname
                    var nameParts = prefillName.trim().split(/\s+/);
                    var gnEl = document.getElementById('givenName');
                    var snEl = document.getElementById('surname');
                    if (gnEl && nameParts.length > 0) {
                        gnEl.value = nameParts[0];
                        if (snEl && nameParts.length > 1) {
                            snEl.value = nameParts.slice(1).join(' ');
                        }
                        _updateDisplayNameHeader();
                    }
                }
                if (prefillEmail || prefillName) {
                    if (_saveSystem) _saveSystem.markUnsaved();
                }
            }
        }
    });

    // ── Live display name header ────────────────────────────────────────
    function _initDisplayNameUpdater() {
        var fields = ['prefixSelect', 'prefixCustom', 'givenName', 'middleNames', 'surname', 'suffixSelect', 'suffixCustom', 'accountDisplayName'];
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
            header.textContent = parts.length > 0 ? parts.join(' ') : (_isProfileMode ? 'Profile' : 'New Contact');
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
        window.location.href = _isProfileMode ? '/' : '/frontend/html/people.html';
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
            getReturnUrl: function () {
                if (_isProfileMode) {
                    var url = localStorage.getItem('cwoc_settings_return');
                    localStorage.removeItem('cwoc_settings_return');
                    return url || '/';
                }
                return '/frontend/html/people.html';
            },
            autoListenInputs: true
        });

        // Intercept Cmd+R / Ctrl+R / F5 to show CWOC modal instead of browser dialog
        cwocInterceptRefresh({
            hasChanges: function() { return _saveSystem && _saveSystem.hasChanges(); },
            onSave: function() { return _saveContact(); },
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

    /** Stage an image locally (preview only) — actual upload happens on save.
     *  Resizes large images to max 512px on the longest side. */
    var MAX_IMAGE_SIZE = 512;
    function _stageImage(file) {
        _pendingImageRemove = false;
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var w = img.width, h = img.height;
                // Resize if larger than MAX_IMAGE_SIZE
                if (w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) {
                    if (w > h) { h = Math.round(h * MAX_IMAGE_SIZE / w); w = MAX_IMAGE_SIZE; }
                    else { w = Math.round(w * MAX_IMAGE_SIZE / h); h = MAX_IMAGE_SIZE; }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                // Convert to blob for upload
                canvas.toBlob(function (blob) {
                    if (!blob) { console.error('Image resize failed'); return; }
                    _pendingImageFile = new File([blob], file.name || 'image.jpg', { type: blob.type });
                    // Show preview
                    var imgEl = document.getElementById('profileImage');
                    var placeholder = document.getElementById('profilePlaceholder');
                    var removeBtn = document.getElementById('removeImageBtn');
                    var viewBtn = document.getElementById('viewImageBtn');
                    imgEl.src = canvas.toDataURL();
                    imgEl.style.display = '';
                    placeholder.style.display = 'none';
                    removeBtn.style.display = '';
                    if (viewBtn) viewBtn.style.display = '';
                }, file.type || 'image/jpeg', 0.85);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        if (_saveSystem) _saveSystem.markUnsaved();
    }

    /** Upload the pending image file to the server (called during save) */
    async function _uploadPendingImage() {
        if (!_pendingImageFile) return;
        try {
            var formData = new FormData();
            formData.append('file', _pendingImageFile);
            var url;
            if (_isProfileMode) {
                url = '/api/auth/profile-image';
            } else {
                if (!_contactId) return;
                url = '/api/contacts/' + encodeURIComponent(_contactId) + '/image';
            }
            var resp = await fetch(url, { method: 'POST', body: formData });
            if (resp.ok) {
                var result = await resp.json();
                _currentImageUrl = result.image_url || result.profile_image_url;
            }
        } catch (err) {
            console.error('Image upload error:', err);
        }
        _pendingImageFile = null;
    }

    /** Remove the pending image on save */
    async function _removePendingImage() {
        try {
            var url;
            if (_isProfileMode) {
                url = '/api/auth/profile-image';
            } else {
                if (!_contactId) return;
                url = '/api/contacts/' + encodeURIComponent(_contactId) + '/image';
            }
            await fetch(url, { method: 'DELETE' });
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
        // Tint the editor background with the contact's color and auto-contrast text
        if (mainEditor) {
            if (hex) {
                applyChitColors(mainEditor, hex);
            } else {
                mainEditor.style.backgroundColor = '';
                mainEditor.style.color = '';
            }
        }

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
        websites:  'websitesEntries',
        dates:     'datesEntries'
    };

    var _valuePlaceholders = {
        phones:    '+1-555-0100',
        emails:    'user@example.com',
        addresses: '4 Rolling Mill Way, Canton, MA 02021',
        callSigns: 'KD2ABC',
        xHandles:  '@username',
        websites:  'https://example.com',
        dates:     'YYYY-MM-DD'
    };

    // Fields whose values should be clickable URLs when not focused
    var _urlFields = { websites: true };

    window.addMultiValueEntry = function (fieldName, defaultLabel, defaultValue, inputType, extraOpts) {
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
        valueInput.type = inputType || 'text';
        valueInput.className = 'mv-value';
        valueInput.placeholder = _valuePlaceholders[fieldName] || 'Value';
        valueInput.value = defaultValue || '';

        // Initialize Flatpickr for date fields (same format as chit editor: YYYY-Mon-DD)
        if (fieldName === 'dates' && typeof flatpickr !== 'undefined') {
            valueInput.type = 'text';
            valueInput.placeholder = 'YYYY-Mon-DD';
            setTimeout(function() {
                flatpickr(valueInput, { dateFormat: 'Y-M-d', defaultDate: defaultValue || null });
            }, 0);
        }

        // Clickable link for URL fields
        var link = document.createElement('a');
        link.className = 'mv-link';
        link.target = '_blank';
        link.rel = 'noopener';
        link.innerHTML = '<i class="fas fa-external-link-alt"></i>';

        if (_urlFields[fieldName]) {
            _setupUrlToggle(valueInput, link);
        }

        // "Show on Calendar" checkbox for date fields
        var calCheckbox = null;
        if (fieldName === 'dates') {
            var calLabel = document.createElement('label');
            calLabel.className = 'mv-cal-toggle';
            calLabel.title = 'Show on calendar annually';
            calCheckbox = document.createElement('input');
            calCheckbox.type = 'checkbox';
            calCheckbox.className = 'mv-show-on-calendar';
            calCheckbox.checked = (extraOpts && extraOpts.show_on_calendar === false) ? false : true;
            calCheckbox.addEventListener('change', function () { if (_saveSystem) _saveSystem.markUnsaved(); });
            var calIcon = document.createElement('i');
            calIcon.className = 'fas fa-calendar-day';
            calLabel.appendChild(calCheckbox);
            calLabel.appendChild(calIcon);
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

        // "View in Context" button for address fields — opens maps page focused on address
        var contextBtn = null;
        if (fieldName === 'addresses') {
            contextBtn = document.createElement('button');
            contextBtn.type = 'button';
            contextBtn.className = 'zone-button';
            contextBtn.title = 'View in Context';
            contextBtn.innerHTML = '<i class="fa-solid fa-circle-nodes"></i>';
            contextBtn.disabled = !defaultValue;
            contextBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                _viewAddressInContext(valueInput.value.trim(), 'contact');
            });
            valueInput.addEventListener('input', function() {
                contextBtn.disabled = !valueInput.value.trim();
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
        if (calCheckbox) row.appendChild(calLabel);
        if (mapBtn) row.appendChild(mapBtn);
        if (contextBtn) row.appendChild(contextBtn);
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
            if (value) {
                var entry = { label: label, value: value };
                // Convert Flatpickr format (YYYY-Mon-DD) back to ISO (YYYY-MM-DD) for dates
                if (fieldName === 'dates') {
                    entry.value = _convertMonthToISO(value);
                    var calCb = rows[i].querySelector('.mv-show-on-calendar');
                    entry.show_on_calendar = calCb ? calCb.checked : true;
                }
                entries.push(entry);
            }
        }
        return entries;
    }

    /** Convert YYYY-Mon-DD (e.g. 2026-May-04) to YYYY-MM-DD */
    function _convertMonthToISO(dateStr) {
        if (!dateStr) return dateStr;
        var months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
                       Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
        return dateStr.replace(/(\d{4})-([A-Za-z]{3})-(\d{2})/, function(m, y, mon, d) {
            return y + '-' + (months[mon] || mon) + '-' + d;
        });
    }

    function _setMultiValueEntries(fieldName, entries) {
        var containerId = _multiValueMap[fieldName];
        if (!containerId) return;
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (!entries || !entries.length) return;
        var inputType = (fieldName === 'dates') ? 'date' : undefined;
        for (var i = 0; i < entries.length; i++) {
            var extraOpts = (fieldName === 'dates') ? { show_on_calendar: entries[i].show_on_calendar } : undefined;
            addMultiValueEntry(fieldName, entries[i].label || '', entries[i].value || '', inputType, extraOpts);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ── View in Context (Maps) ──────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * _viewAddressInContext(address, focusType) — Navigates to the maps page
     * with focus and address query parameters so the map centers on the address.
     */
    function _viewAddressInContext(address, focusType) {
        if (!address) return;
        var url = '/frontend/html/maps.html?focus=' + encodeURIComponent(focusType || 'contact') + '&address=' + encodeURIComponent(address);
        window.location.href = url;
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
            dates:           _getMultiValueEntries('dates'),
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
            shared_to_vault: document.getElementById('vault-toggle').value === '1',
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

        // Dates
        _setMultiValueEntries('dates', contact.dates || [{ label: 'Birthday', value: '' }]);

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

        // Shared to vault (pill toggle in header)
        var vaultHidden = document.getElementById('vault-toggle');
        if (vaultHidden) {
            vaultHidden.value = contact.shared_to_vault ? '1' : '0';
            _updatePillToggle('vault-pill', vaultHidden.value);
        }

        // If this is a vault contact from another user, show read-only info
        var vaultPill = document.getElementById('vault-pill');
        var vaultOwnerInfo = document.getElementById('vaultOwnerInfo');
        var vaultOwnerText = document.getElementById('vaultOwnerText');
        if (contact.is_vault_contact) {
            // Read-only: vault contact from another user
            if (vaultPill) { vaultPill.style.pointerEvents = 'none'; vaultPill.style.opacity = '0.6'; }
            if (vaultOwnerInfo) vaultOwnerInfo.style.display = '';
            if (vaultOwnerText) vaultOwnerText.textContent = 'Shared by another user (read-only)';
            // Disable all form inputs for vault contacts
            document.querySelectorAll('#mainEditor input, #mainEditor textarea, #mainEditor select').forEach(function(el) {
                el.disabled = true;
                el.style.opacity = '0.7';
            });
            // Hide save/delete buttons
            var saveBtn = document.getElementById('saveButton');
            var saveStayBtn = document.getElementById('saveStayButton');
            var saveExitBtn = document.getElementById('saveExitButton');
            var deleteBtn = document.getElementById('deleteButton');
            if (saveBtn) saveBtn.style.display = 'none';
            if (saveStayBtn) saveStayBtn.style.display = 'none';
            if (saveExitBtn) saveExitBtn.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
        }

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
        // ── Profile mode save ──
        if (_isProfileMode) {
            return await _saveProfile();
        }

        // ── Contact mode save ──
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

            if (_saveSystem) _saveSystem.markSaved();
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
        if (saved) {
            if (_isProfileMode) {
                var url = localStorage.getItem('cwoc_settings_return');
                localStorage.removeItem('cwoc_settings_return');
                window.location.href = url || '/';
            } else {
                window.location.href = '/frontend/html/people.html';
            }
        }
    };

    window.cancelOrExit = function () {
        if (_saveSystem) {
            _saveSystem.cancelOrExit();
        } else {
            window.location.href = _isProfileMode ? '/' : '/frontend/html/people.html';
        }
    };

    window.deleteContact = async function () {
        if (!_contactId) return;
        if (!(await cwocConfirm('Are you sure you want to permanently delete this contact?', { title: 'Delete Contact', confirmLabel: '🗑️ Delete', danger: true }))) return;
        try {
            var resp = await fetch('/api/contacts/' + encodeURIComponent(_contactId), { method: 'DELETE' });
            if (!resp.ok) { _showBriefMessage('Delete failed', true); return; }
            window.location.href = '/frontend/html/people.html';
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

    // ═══════════════════════════════════════════════════════════════════════
    // ── Profile Mode ────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialize profile mode: swap UI elements, show/hide zones, load profile data.
     */
    function _initProfileMode() {
        // Update page title and header
        document.title = 'CWOC Profile';
        var h1 = document.querySelector('.header-row h1');
        if (h1) h1.textContent = 'Profile';

        // Hide contact-only elements
        var favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) favoriteBtn.style.display = 'none';
        var deleteBtn = document.getElementById('deleteButton');
        if (deleteBtn) deleteBtn.style.display = 'none';
        var qrBtn = document.getElementById('qrButton');
        if (qrBtn) qrBtn.style.display = 'none';
        var auditBtn = document.getElementById('headerAuditBtn');
        if (auditBtn) auditBtn.style.display = 'none';
        var tagsSection = document.getElementById('tagsSection');
        if (tagsSection) tagsSection.style.display = 'none';
        var vaultPill = document.getElementById('vault-pill');
        if (vaultPill) vaultPill.style.display = 'none';

        // Show profile-only zones
        var accountSection = document.getElementById('accountSection');
        if (accountSection) accountSection.style.display = '';
        var passwordSection = document.getElementById('passwordSection');
        if (passwordSection) passwordSection.style.display = '';

        // Update the type badge
        var badge = document.querySelector('.profile-image-area span:last-child');
        if (badge) {
            badge.style.background = 'rgba(200,150,90,0.3)';
            badge.style.color = '#3c2210';
            badge.style.borderColor = 'rgba(200,150,90,0.6)';
            badge.innerHTML = '<i class="fas fa-users"></i> User';
        }

        // Remove "required" indicator from given name in profile mode
        var givenLabel = document.querySelector('label[for="givenName"]');
        if (givenLabel) {
            var reqSpan = givenLabel.querySelector('span');
            if (reqSpan) reqSpan.remove();
            givenLabel.textContent = 'Given';
        }

        // Load profile data
        if (typeof waitForAuth === 'function') {
            waitForAuth().then(function () { _loadProfile(); });
        } else {
            _loadProfile();
        }
    }

    /**
     * Load profile data from the API.
     */
    async function _loadProfile() {
        var currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        var currentUserId = currentUser ? (currentUser.user_id || currentUser.id) : null;

        // Check if viewing another user
        if (_profileUserId && _profileUserId !== currentUserId) {
            _viewingOtherUser = true;
            try {
                var resp = await fetch('/api/auth/user-profile/' + encodeURIComponent(_profileUserId));
                if (!resp.ok) { console.error('[Profile] Failed to load user profile:', resp.status); return; }
                var user = await resp.json();
                if (user.is_self) { _viewingOtherUser = false; }
                _populateProfileForm(user);
                if (_viewingOtherUser) _applyReadOnlyMode(user.display_name || user.username);
            } catch (err) { console.error('[Profile] Error loading user profile:', err); }
        } else {
            // Load own profile
            try {
                var resp = await fetch('/api/auth/me');
                if (!resp.ok) { console.error('[Profile] Failed to load profile:', resp.status); return; }
                var user = await resp.json();
                _populateProfileForm(user);
            } catch (err) { console.error('[Profile] Error loading profile:', err); }
        }
        if (_saveSystem) _saveSystem.markSaved();
    }

    /**
     * Populate the shared form fields from a user profile object.
     * Maps user API field names to the shared contact-editor element IDs.
     */
    function _populateProfileForm(user) {
        // Account fields
        var usernameEl = document.getElementById('accountUsername');
        if (usernameEl) usernameEl.value = user.username || '';
        var displayNameEl = document.getElementById('accountDisplayName');
        if (displayNameEl) displayNameEl.value = user.display_name || '';
        var emailEl = document.getElementById('accountEmail');
        if (emailEl) emailEl.value = user.email || '';

        // Name fields (shared IDs with contact editor)
        document.getElementById('givenName').value = user.given_name || '';
        document.getElementById('surname').value = user.surname || '';
        document.getElementById('middleNames').value = user.middle_names || '';
        document.getElementById('nickname').value = user.nickname || '';

        // Prefix/suffix — profile uses simple selects (no custom option)
        var prefixSel = document.getElementById('prefixSelect');
        if (prefixSel) prefixSel.value = user.prefix || '';
        var suffixSel = document.getElementById('suffixSelect');
        if (suffixSel) suffixSel.value = user.suffix || '';

        // Multi-value fields
        _setMultiValueEntries('phones', user.phones);
        _setMultiValueEntries('emails', user.emails_json);
        _setMultiValueEntries('addresses', user.addresses);
        _setMultiValueEntries('callSigns', user.call_signs);
        _setMultiValueEntries('xHandles', user.x_handles);
        _setMultiValueEntries('websites', user.websites);

        // Security
        var signalCb = document.getElementById('hasSignal');
        if (signalCb) signalCb.checked = !!user.has_signal;
        var signalInput = document.getElementById('signalUsername');
        if (signalInput) {
            signalInput.value = user.signal_username || '';
            signalInput.style.display = user.has_signal ? '' : 'none';
        }
        var pgpEl = document.getElementById('pgpKey');
        if (pgpEl) pgpEl.value = user.pgp_key || '';

        // Context
        document.getElementById('organization').value = user.organization || '';
        document.getElementById('socialContext').value = user.social_context || '';

        // Notes
        document.getElementById('contactNotes').value = user.notes || '';

        // Color
        if (user.color) _selectColor(user.color);

        // Image
        _setProfileImage(user.profile_image_url || null);

        // Display name header
        var header = document.getElementById('displayNameHeader');
        if (header) header.textContent = user.display_name || user.username || 'Profile';

        _updateDisplayNameHeader();
    }

    /**
     * Save profile data via PUT /api/auth/profile.
     */
    async function _saveProfile() {
        var payload = {};

        // Account fields
        var displayNameEl = document.getElementById('accountDisplayName');
        if (displayNameEl) payload.display_name = displayNameEl.value.trim();
        var emailEl = document.getElementById('accountEmail');
        if (emailEl) payload.email = emailEl.value.trim();

        // Name fields
        payload.given_name = document.getElementById('givenName').value.trim();
        payload.surname = document.getElementById('surname').value.trim();
        payload.middle_names = document.getElementById('middleNames').value.trim();
        payload.nickname = document.getElementById('nickname').value.trim();
        payload.prefix = document.getElementById('prefixSelect').value;
        payload.suffix = document.getElementById('suffixSelect').value;

        // Multi-value fields
        payload.phones = _getMultiValueEntries('phones');
        payload.emails_json = _getMultiValueEntries('emails');
        payload.addresses = _getMultiValueEntries('addresses');
        payload.call_signs = _getMultiValueEntries('callSigns');
        payload.x_handles = _getMultiValueEntries('xHandles');
        payload.websites = _getMultiValueEntries('websites');

        // Security
        payload.has_signal = document.getElementById('hasSignal').checked;
        payload.signal_username = document.getElementById('signalUsername').value.trim();
        payload.pgp_key = document.getElementById('pgpKey').value.trim();

        // Context
        payload.organization = document.getElementById('organization').value.trim();
        payload.social_context = document.getElementById('socialContext').value.trim();
        payload.notes = document.getElementById('contactNotes').value.trim();

        // Color
        payload.color = document.getElementById('colorHex').value.trim();

        try {
            var resp = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                var errBody = null;
                try { errBody = await resp.json(); } catch (e) { /* ignore */ }
                _showBriefMessage((errBody && errBody.detail) || 'Save failed', true);
                return null;
            }
            var saved = await resp.json();

            // Handle pending image
            if (_pendingImageFile) {
                await _uploadPendingImage();
            } else if (_pendingImageRemove) {
                await _removePendingImage();
            }

            if (_saveSystem) _saveSystem.markSaved();
            _showBriefMessage('Saved');
            return saved;
        } catch (err) {
            console.error('[Profile] Save error:', err);
            _showBriefMessage('Connection error', true);
            return null;
        }
    }

    /**
     * Apply read-only mode for viewing another user's profile.
     */
    function _applyReadOnlyMode(displayName) {
        // Update header
        var h1 = document.querySelector('.header-row h1');
        if (h1) h1.textContent = (displayName || 'User') + "'s Profile";
        var header = document.getElementById('displayNameHeader');
        if (header) header.textContent = displayName || 'User';

        // Disable all inputs, selects, textareas
        var editor = document.getElementById('mainEditor');
        if (editor) {
            editor.querySelectorAll('input, select, textarea').forEach(function (el) {
                el.readOnly = true;
                el.disabled = true;
                el.style.opacity = '0.6';
                el.style.cursor = 'not-allowed';
            });
        }

        // Hide all add-entry and remove buttons
        editor.querySelectorAll('.add-entry-btn, .remove-entry-btn').forEach(function (btn) { btn.style.display = 'none'; });

        // Hide save buttons and password section
        var buttons = document.querySelector('.header-row .buttons');
        if (buttons) buttons.style.display = 'none';
        var passwordSection = document.getElementById('passwordSection');
        if (passwordSection) passwordSection.style.display = 'none';

        // Show read-only banner
        var banner = document.createElement('div');
        banner.className = 'cwoc-readonly-banner';
        banner.textContent = '👁️ Viewing ' + (displayName || 'user') + "'s profile (read-only)";
        var editorEl = document.getElementById('mainEditor');
        if (editorEl) editorEl.insertBefore(banner, editorEl.firstChild);
    }

    /**
     * Change password (profile mode only).
     */
    window.changeProfilePassword = async function () {
        var msgEl = document.getElementById('passwordMessage');
        if (msgEl) { msgEl.style.display = 'none'; msgEl.className = ''; msgEl.textContent = ''; }

        var currentPw = document.getElementById('currentPassword').value;
        var newPw = document.getElementById('newPassword').value;
        var confirmPw = document.getElementById('confirmPassword').value;

        if (!currentPw || !newPw || !confirmPw) {
            if (msgEl) { msgEl.textContent = 'Please fill in all password fields.'; msgEl.className = 'pw-msg-error'; msgEl.style.display = ''; }
            return;
        }
        if (newPw !== confirmPw) {
            if (msgEl) { msgEl.textContent = 'New passwords do not match.'; msgEl.className = 'pw-msg-error'; msgEl.style.display = ''; }
            return;
        }

        try {
            var resp = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPw, new_password: newPw })
            });
            if (resp.status === 403) {
                if (msgEl) { msgEl.textContent = 'Current password is incorrect.'; msgEl.className = 'pw-msg-error'; msgEl.style.display = ''; }
                return;
            }
            if (!resp.ok) {
                var errData = await resp.json().catch(function () { return {}; });
                if (msgEl) { msgEl.textContent = errData.detail || 'Failed to change password.'; msgEl.className = 'pw-msg-error'; msgEl.style.display = ''; }
                return;
            }
            if (msgEl) { msgEl.textContent = 'Password changed successfully.'; msgEl.className = 'pw-msg-success'; msgEl.style.display = ''; }
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (err) {
            console.error('[Profile] Password change error:', err);
            if (msgEl) { msgEl.textContent = 'Failed to change password.'; msgEl.className = 'pw-msg-error'; msgEl.style.display = ''; }
        }
    };

})();
