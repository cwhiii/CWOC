/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Custom Objects Editor  (custom-objects-editor.js)

   Page logic for custom-objects-editor.html — browse, create, edit, toggle,
   soft-delete, restore, and manage zone assignments for Custom Objects.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── State ───────────────────────────────────────────────────────────
    var _coAllObjects = [];       // Full list from API
    var _coFilteredObjects = [];  // After type/search filter
    var _coEditingId = null;      // null = create mode, string = edit mode
    var _coDeleteTargetId = null; // Object pending deletion
    var _coAllZones = [];         // Custom zones from API

    // ── DOM References ──────────────────────────────────────────────────
    var _coListContainer = null;
    var _coTypeFilter = null;
    var _coSearchInput = null;
    var _coCreateBtn = null;
    var _coZonesList = null;
    var _coZonesCreateBtn = null;

    // ── Initialization ──────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        // Clone templates and append to body
        _coCloneTemplates();

        // Cache DOM references
        _coListContainer = document.getElementById('coListContainer');
        _coTypeFilter = document.getElementById('coTypeFilter');
        _coSearchInput = document.getElementById('coSearchInput');
        _coCreateBtn = document.getElementById('coCreateBtn');
        _coZonesList = document.getElementById('coZonesList');
        _coZonesCreateBtn = document.getElementById('coZonesCreateBtn');

        // Wire up filter controls
        if (_coTypeFilter) _coTypeFilter.addEventListener('change', _coApplyFilters);
        if (_coSearchInput) _coSearchInput.addEventListener('input', _coApplyFilters);

        // Wire up create button
        if (_coCreateBtn) _coCreateBtn.addEventListener('click', function () {
            _coOpenEditModal(null);
        });

        // Wire up zones create button
        if (_coZonesCreateBtn) _coZonesCreateBtn.addEventListener('click', function () {
            _coOpenCreateZoneModal();
        });

        // Wire up create zone modal controls
        _coInitCreateZoneModal();

        // Wire up zone editor modal controls
        _coInitZoneEditorModal();

        // Wire up edit modal controls
        _coInitEditModal();

        // Wire up delete modal controls
        _coInitDeleteModal();

        // Wire up ESC key
        document.addEventListener('keydown', _coHandleEsc, true);

        // Wire up value_type change to show/hide numeric fields
        var valueTypeSelect = document.getElementById('coEditValueType');
        if (valueTypeSelect) {
            valueTypeSelect.addEventListener('change', _coToggleNumericFields);
        }

        // Wire up advanced toggle
        var advToggle = document.getElementById('coAdvancedToggle');
        if (advToggle) {
            advToggle.addEventListener('click', function () {
                var body = document.getElementById('coAdvancedBody');
                if (body) {
                    body.classList.toggle('visible');
                    var icon = advToggle.querySelector('i');
                    if (icon) {
                        icon.className = body.classList.contains('visible')
                            ? 'fas fa-caret-down'
                            : 'fas fa-caret-right';
                    }
                }
            });
        }

        // Load data
        _coFetchAll();
        _coFetchZones();
        _coFetchIndicators();
    });


    // ── Template Cloning ────────────────────────────────────────────────

    function _coCloneTemplates() {
        var templates = ['tmpl-co-edit-modal', 'tmpl-co-zone-modal', 'tmpl-co-delete-modal', 'tmpl-co-create-zone-modal', 'tmpl-co-zone-editor-modal'];
        templates.forEach(function (id) {
            var tmpl = document.getElementById(id);
            if (tmpl) {
                var clone = tmpl.content.cloneNode(true);
                document.body.appendChild(clone);
            }
        });
    }

    // ── Data Fetching ───────────────────────────────────────────────────

    async function _coFetchAll() {
        try {
            var response = await fetch('/api/custom-objects');
            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to load custom objects');
            }
            _coAllObjects = await response.json();
            _coPopulateTypeFilter();
            _coApplyFilters();
        } catch (e) {
            console.error('[CustomObjects] Fetch error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to load custom objects', 'error');
            if (_coListContainer) {
                _coListContainer.innerHTML = '<div class="co-empty-state">Failed to load custom objects.</div>';
            }
        }
    }

    // ── Type Filter Dropdown ────────────────────────────────────────────

    function _coPopulateTypeFilter() {
        if (!_coTypeFilter) return;
        var currentVal = _coTypeFilter.value;
        // Gather unique types
        var types = [];
        _coAllObjects.forEach(function (obj) {
            if (obj.type && types.indexOf(obj.type) === -1) {
                types.push(obj.type);
            }
        });
        types.sort();

        // Rebuild options
        _coTypeFilter.innerHTML = '<option value="">All Types</option>';
        types.forEach(function (t) {
            var opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            _coTypeFilter.appendChild(opt);
        });

        // Restore selection if still valid
        if (currentVal && types.indexOf(currentVal) !== -1) {
            _coTypeFilter.value = currentVal;
        }
    }

    // ── Filtering ───────────────────────────────────────────────────────

    function _coApplyFilters() {
        var typeVal = _coTypeFilter ? _coTypeFilter.value : '';
        var searchVal = _coSearchInput ? _coSearchInput.value.trim().toLowerCase() : '';

        _coFilteredObjects = _coAllObjects.filter(function (obj) {
            if (typeVal && obj.type !== typeVal) return false;
            if (searchVal && obj.name.toLowerCase().indexOf(searchVal) === -1) return false;
            return true;
        });

        _coRenderList();
    }


    // ── List Rendering ──────────────────────────────────────────────────

    function _coRenderList() {
        if (!_coListContainer) return;

        if (_coFilteredObjects.length === 0) {
            _coListContainer.innerHTML = '<div class="co-empty-state">No custom objects found.</div>';
            return;
        }

        // Group by type → sub_type (two levels)
        var typeGroups = {};
        _coFilteredObjects.forEach(function (obj) {
            var type = obj.type || 'Uncategorized';
            var subType = obj.sub_type || '';
            if (!typeGroups[type]) typeGroups[type] = {};
            if (!typeGroups[type][subType]) typeGroups[type][subType] = [];
            typeGroups[type][subType].push(obj);
        });

        // Sort types alphabetically
        var sortedTypes = Object.keys(typeGroups).sort();

        _coListContainer.innerHTML = '';
        sortedTypes.forEach(function (type) {
            var groupEl = document.createElement('div');
            groupEl.className = 'co-type-group';

            // Type header
            var typeCount = 0;
            Object.keys(typeGroups[type]).forEach(function(st) { typeCount += typeGroups[type][st].length; });
            var header = document.createElement('div');
            header.className = 'co-type-group-header';
            header.innerHTML = '<span>' + _coEscape(type) + '</span>'
                + '<span class="co-type-count">(' + typeCount + ')</span>';
            groupEl.appendChild(header);

            // Sort sub-types alphabetically (empty string first for items with no sub_type)
            var sortedSubTypes = Object.keys(typeGroups[type]).sort(function(a, b) {
                if (a === '') return -1;
                if (b === '') return 1;
                return a.localeCompare(b);
            });

            sortedSubTypes.forEach(function (subType) {
                var items = typeGroups[type][subType];

                // Sub-type sub-header (only if there's a sub_type value)
                if (subType) {
                    var subHeader = document.createElement('div');
                    subHeader.style.cssText = 'padding:6px 14px 4px 24px;font-size:0.85em;font-weight:600;color:#6b4e31;border-bottom:1px solid #e8dcc8;background:rgba(212,196,160,0.15);';
                    subHeader.innerHTML = _coEscape(subType) + ' <span style="opacity:0.5;font-weight:400;">(' + items.length + ')</span>';
                    groupEl.appendChild(subHeader);
                }

                // Sort items alphabetically by name
                items.sort(function(a, b) { return a.name.localeCompare(b.name); });

                items.forEach(function (obj) {
                    groupEl.appendChild(_coCreateRow(obj));
                });
            });

            _coListContainer.appendChild(groupEl);
        });
    }

    function _coCreateRow(obj) {
        var row = document.createElement('div');
        row.className = 'co-object-row';
        row.dataset.objectId = obj.id;

        // Name
        var nameEl = document.createElement('span');
        nameEl.className = 'co-object-name' + (!obj.active ? ' inactive' : '');
        nameEl.textContent = obj.name;
        row.appendChild(nameEl);

        // Zone badges
        var badgesEl = document.createElement('div');
        badgesEl.className = 'co-zone-badges';
        if (obj.zone_assignments && obj.zone_assignments.length > 0) {
            obj.zone_assignments.forEach(function (za) {
                var badge = document.createElement('span');
                badge.className = 'co-zone-badge';
                badge.textContent = za.zone_id;
                badgesEl.appendChild(badge);
            });
        }
        row.appendChild(badgesEl);

        // Actions area
        var actionsEl = document.createElement('div');
        actionsEl.className = 'co-row-actions';

        if (obj.deleted) {
            // Deleted objects: show Restore button for standard objects
            if (obj.is_standard) {
                var restoreBtn = document.createElement('button');
                restoreBtn.type = 'button';
                restoreBtn.innerHTML = '<i class="fas fa-undo"></i> Restore';
                restoreBtn.title = 'Restore this standard object';
                restoreBtn.addEventListener('click', function () {
                    _coRestoreObject(obj.id);
                });
                actionsEl.appendChild(restoreBtn);
            }
        } else {
            // Active toggle
            var toggleLabel = document.createElement('label');
            toggleLabel.className = 'co-active-toggle';
            toggleLabel.title = obj.active ? 'Active — click to deactivate' : 'Inactive — click to activate';
            var toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = !!obj.active;
            toggleInput.addEventListener('change', function () {
                _coToggleActive(obj.id, toggleInput.checked);
            });
            var slider = document.createElement('span');
            slider.className = 'slider';
            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(slider);
            actionsEl.appendChild(toggleLabel);

            // Edit button
            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';
            editBtn.title = 'Edit';
            editBtn.addEventListener('click', function () {
                _coOpenEditModal(obj);
            });
            actionsEl.appendChild(editBtn);

            // Zone management button
            var zoneBtn = document.createElement('button');
            zoneBtn.type = 'button';
            zoneBtn.innerHTML = '<i class="fas fa-layer-group"></i>';
            zoneBtn.title = 'Manage zones';
            zoneBtn.addEventListener('click', function () {
                _coOpenZoneModal(obj);
            });
            actionsEl.appendChild(zoneBtn);

            // Delete button
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'co-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', function () {
                _coOpenDeleteModal(obj);
            });
            actionsEl.appendChild(deleteBtn);
        }

        row.appendChild(actionsEl);
        return row;
    }


    // ── Edit Modal ──────────────────────────────────────────────────────

    function _coInitEditModal() {
        var cancelBtn = document.getElementById('coEditCancelBtn');
        var saveBtn = document.getElementById('coEditSaveBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', _coCloseEditModal);
        if (saveBtn) saveBtn.addEventListener('click', _coSaveObject);
    }

    function _coOpenEditModal(obj) {
        _coEditingId = obj ? obj.id : null;
        var overlay = document.getElementById('coEditModalOverlay');
        var title = document.getElementById('coEditModalTitle');
        var saveBtn = document.getElementById('coEditSaveBtn');

        // Set title and button text
        if (title) title.textContent = obj ? 'Edit Custom Object' : 'Create Custom Object';
        if (saveBtn) saveBtn.textContent = obj ? 'Save' : 'Create';

        // Populate datalists for type and sub_type autocomplete
        _coPopulateDatalist('coTypeDatalist', 'type');
        _coPopulateDatalist('coCategoryDatalist', 'sub_type');

        // Populate fields
        var nameInput = document.getElementById('coEditName');
        var typeInput = document.getElementById('coEditType');
        var categoryInput = document.getElementById('coEditCategory');
        var valueTypeSelect = document.getElementById('coEditValueType');
        var unitsInput = document.getElementById('coEditUnits');
        var metricUnitsInput = document.getElementById('coEditMetricUnits');
        var rangeMinInput = document.getElementById('coEditRangeMin');
        var rangeMaxInput = document.getElementById('coEditRangeMax');
        var conditionalInput = document.getElementById('coEditConditionalDisplay');

        if (obj) {
            if (nameInput) nameInput.value = obj.name || '';
            if (typeInput) typeInput.value = obj.type || '';
            if (categoryInput) categoryInput.value = obj.sub_type || '';
            if (valueTypeSelect) valueTypeSelect.value = obj.value_type || 'boolean';
            if (unitsInput) unitsInput.value = obj.units || '';
            if (metricUnitsInput) metricUnitsInput.value = obj.metric_units || '';
            if (rangeMinInput) rangeMinInput.value = (obj.range_min != null) ? obj.range_min : '';
            if (rangeMaxInput) rangeMaxInput.value = (obj.range_max != null) ? obj.range_max : '';
            if (conditionalInput) {
                conditionalInput.value = obj.conditional_display
                    ? JSON.stringify(obj.conditional_display, null, 2)
                    : '';
            }
        } else {
            // Clear all fields for create
            if (nameInput) nameInput.value = '';
            if (typeInput) typeInput.value = '';
            if (categoryInput) categoryInput.value = '';
            if (valueTypeSelect) valueTypeSelect.value = 'boolean';
            if (unitsInput) unitsInput.value = '';
            if (metricUnitsInput) metricUnitsInput.value = '';
            if (rangeMinInput) rangeMinInput.value = '';
            if (rangeMaxInput) rangeMaxInput.value = '';
            if (conditionalInput) conditionalInput.value = '';
        }

        // Reset advanced section
        var advBody = document.getElementById('coAdvancedBody');
        if (advBody) advBody.classList.remove('visible');
        var advIcon = document.querySelector('#coAdvancedToggle i');
        if (advIcon) advIcon.className = 'fas fa-caret-right';

        // Show/hide numeric fields based on value_type
        _coToggleNumericFields();

        // Show modal
        if (overlay) overlay.classList.add('active');
    }

    function _coCloseEditModal() {
        var overlay = document.getElementById('coEditModalOverlay');
        if (overlay) overlay.classList.remove('active');
        _coEditingId = null;
    }

    function _coToggleNumericFields() {
        var valueTypeSelect = document.getElementById('coEditValueType');
        var numericFields = document.getElementById('coEditNumericFields');
        if (!valueTypeSelect || !numericFields) return;

        var val = valueTypeSelect.value;
        if (val === 'integer' || val === 'decimal') {
            numericFields.style.display = '';
        } else {
            numericFields.style.display = 'none';
        }
    }

    function _coPopulateDatalist(datalistId, field) {
        var dl = document.getElementById(datalistId);
        if (!dl) return;
        dl.innerHTML = '';
        var values = [];
        _coAllObjects.forEach(function (obj) {
            var v = obj[field];
            if (v && values.indexOf(v) === -1) values.push(v);
        });
        values.sort();
        values.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = v;
            dl.appendChild(opt);
        });
    }


    // ── Save (Create / Update) ──────────────────────────────────────────

    async function _coSaveObject() {
        var nameInput = document.getElementById('coEditName');
        var typeInput = document.getElementById('coEditType');
        var categoryInput = document.getElementById('coEditCategory');
        var valueTypeSelect = document.getElementById('coEditValueType');
        var unitsInput = document.getElementById('coEditUnits');
        var metricUnitsInput = document.getElementById('coEditMetricUnits');
        var rangeMinInput = document.getElementById('coEditRangeMin');
        var rangeMaxInput = document.getElementById('coEditRangeMax');
        var conditionalInput = document.getElementById('coEditConditionalDisplay');

        // Validate required fields
        var name = nameInput ? nameInput.value.trim() : '';
        var type = typeInput ? typeInput.value.trim() : '';
        var valueType = valueTypeSelect ? valueTypeSelect.value : 'boolean';

        if (!name) {
            if (typeof cwocToast === 'function') cwocToast('Name is required', 'error');
            if (nameInput) nameInput.focus();
            return;
        }
        if (!type) {
            if (typeof cwocToast === 'function') cwocToast('Type is required', 'error');
            if (typeInput) typeInput.focus();
            return;
        }

        // Build payload
        var payload = {
            name: name,
            type: type,
            value_type: valueType
        };

        var subType = categoryInput ? categoryInput.value.trim() : '';
        if (subType) payload.sub_type = subType;

        // Numeric fields only for integer/decimal
        if (valueType === 'integer' || valueType === 'decimal') {
            var units = unitsInput ? unitsInput.value.trim() : '';
            var metricUnits = metricUnitsInput ? metricUnitsInput.value.trim() : '';
            var rangeMin = rangeMinInput ? rangeMinInput.value.trim() : '';
            var rangeMax = rangeMaxInput ? rangeMaxInput.value.trim() : '';

            if (units) payload.units = units;
            if (metricUnits) payload.metric_units = metricUnits;
            if (rangeMin !== '') payload.range_min = parseFloat(rangeMin);
            if (rangeMax !== '') payload.range_max = parseFloat(rangeMax);
        }

        // Conditional display
        var condStr = conditionalInput ? conditionalInput.value.trim() : '';
        if (condStr) {
            try {
                payload.conditional_display = JSON.parse(condStr);
            } catch (e) {
                if (typeof cwocToast === 'function') cwocToast('Invalid JSON in conditional display', 'error');
                if (conditionalInput) conditionalInput.focus();
                return;
            }
        }

        try {
            var url, method;
            if (_coEditingId) {
                // Update
                url = '/api/custom-objects/' + encodeURIComponent(_coEditingId);
                method = 'PUT';
            } else {
                // Create
                url = '/api/custom-objects';
                method = 'POST';
            }

            var response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to save custom object');
            }

            _coCloseEditModal();
            if (typeof cwocToast === 'function') {
                cwocToast(_coEditingId ? 'Object updated' : 'Object created', 'success');
            }
            await _coFetchAll();
        } catch (e) {
            console.error('[CustomObjects] Save error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Save failed', 'error');
        }
    }

    // ── Active Toggle ───────────────────────────────────────────────────

    async function _coToggleActive(objectId, newActive) {
        try {
            var response = await fetch('/api/custom-objects/' + encodeURIComponent(objectId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: newActive })
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to update status');
            }

            // Update local state
            _coAllObjects.forEach(function (obj) {
                if (obj.id === objectId) obj.active = newActive;
            });
            _coApplyFilters();
        } catch (e) {
            console.error('[CustomObjects] Toggle error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to update status', 'error');
            // Re-render to reset the toggle
            _coApplyFilters();
        }
    }


    // ── Delete Modal ────────────────────────────────────────────────────

    function _coInitDeleteModal() {
        var cancelBtn = document.getElementById('coDeleteCancelBtn');
        var confirmBtn = document.getElementById('coDeleteConfirmBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', _coCloseDeleteModal);
        if (confirmBtn) confirmBtn.addEventListener('click', _coConfirmDelete);
    }

    function _coOpenDeleteModal(obj) {
        _coDeleteTargetId = obj.id;
        var overlay = document.getElementById('coDeleteModalOverlay');
        var message = document.getElementById('coDeleteMessage');
        if (message) {
            message.textContent = 'Are you sure you want to remove "' + obj.name + '"?';
        }
        if (overlay) overlay.classList.add('active');
    }

    function _coCloseDeleteModal() {
        var overlay = document.getElementById('coDeleteModalOverlay');
        if (overlay) overlay.classList.remove('active');
        _coDeleteTargetId = null;
    }

    async function _coConfirmDelete() {
        if (!_coDeleteTargetId) return;

        try {
            var response = await fetch('/api/custom-objects/' + encodeURIComponent(_coDeleteTargetId), {
                method: 'DELETE'
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to delete object');
            }

            _coCloseDeleteModal();
            if (typeof cwocToast === 'function') cwocToast('Object deleted', 'success');
            await _coFetchAll();
        } catch (e) {
            console.error('[CustomObjects] Delete error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Delete failed', 'error');
        }
    }

    // ── Restore ─────────────────────────────────────────────────────────

    async function _coRestoreObject(objectId) {
        try {
            var response = await fetch('/api/custom-objects/' + encodeURIComponent(objectId) + '/restore', {
                method: 'POST'
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to restore object');
            }

            if (typeof cwocToast === 'function') cwocToast('Object restored', 'success');
            await _coFetchAll();
        } catch (e) {
            console.error('[CustomObjects] Restore error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Restore failed', 'error');
        }
    }

    // ── Zone Modal ─────────────────────────────────────────────────────

    var _coZoneModalObjectId = null; // Object currently being managed in zone modal

    function _coOpenZoneModal(obj) {
        _coZoneModalObjectId = obj.id;
        var overlay = document.getElementById('coZoneModalOverlay');
        var title = document.getElementById('coZoneModalTitle');
        if (title) title.textContent = 'Zone Assignments — ' + obj.name;

        // Render zone list
        _coRenderZoneList(obj);

        // Wire close button
        var closeBtn = document.getElementById('coZoneCloseBtn');
        if (closeBtn) {
            closeBtn.onclick = function () {
                if (overlay) overlay.classList.remove('active');
                _coZoneModalObjectId = null;
            };
        }

        // Wire "Add to Zone" button
        var addBtn = document.getElementById('coZoneAddBtn');
        var newIdInput = document.getElementById('coZoneNewId');
        if (addBtn) {
            addBtn.onclick = async function () {
                var zoneId = newIdInput ? newIdInput.value.trim() : '';
                if (!zoneId) {
                    if (typeof cwocToast === 'function') cwocToast('Enter a zone identifier', 'error');
                    if (newIdInput) newIdInput.focus();
                    return;
                }
                await _coAssignZone(obj.id, zoneId);
                if (newIdInput) newIdInput.value = '';
            };
        }

        if (overlay) overlay.classList.add('active');
    }

    /**
     * Gather all known zone identifiers from ALL objects' zone_assignments.
     */
    function _coGetAllKnownZones() {
        var zones = [];
        _coAllObjects.forEach(function (obj) {
            if (obj.zone_assignments && obj.zone_assignments.length > 0) {
                obj.zone_assignments.forEach(function (za) {
                    if (za.zone_id && zones.indexOf(za.zone_id) === -1) {
                        zones.push(za.zone_id);
                    }
                });
            }
        });
        zones.sort();
        return zones;
    }

    /**
     * Render the zone list inside the zone modal for the given object.
     */
    function _coRenderZoneList(obj) {
        var zoneList = document.getElementById('coZoneList');
        if (!zoneList) return;

        var allZones = _coGetAllKnownZones();
        // Build a map of this object's current assignments by zone_id
        var assignedMap = {};
        if (obj.zone_assignments) {
            obj.zone_assignments.forEach(function (za) {
                assignedMap[za.zone_id] = za;
            });
        }

        if (allZones.length === 0 && Object.keys(assignedMap).length === 0) {
            zoneList.innerHTML = '<div class="co-empty-state" style="padding:20px;">No zones found. Use "Add to Zone" below to create the first assignment.</div>';
            return;
        }

        zoneList.innerHTML = '';

        allZones.forEach(function (zoneId) {
            var isAssigned = !!assignedMap[zoneId];
            var za = assignedMap[zoneId] || null;
            var item = _coCreateZoneItem(obj.id, zoneId, isAssigned, za);
            zoneList.appendChild(item);
        });
    }

    /**
     * Create a single zone item element with toggle, sort_order, and config editor.
     */
    function _coCreateZoneItem(objectId, zoneId, isAssigned, za) {
        var wrapper = document.createElement('div');
        wrapper.className = 'co-zone-item';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'stretch';

        // Top row: toggle + name + sort order
        var topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.gap = '10px';

        // Toggle checkbox
        var toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = isAssigned;
        toggle.title = isAssigned ? 'Unassign from ' + zoneId : 'Assign to ' + zoneId;
        toggle.style.cursor = 'pointer';
        toggle.style.width = '18px';
        toggle.style.height = '18px';
        toggle.style.flexShrink = '0';
        toggle.addEventListener('change', async function () {
            if (toggle.checked) {
                await _coAssignZone(objectId, zoneId);
            } else {
                await _coUnassignZone(objectId, zoneId);
            }
        });
        topRow.appendChild(toggle);

        // Zone name
        var nameEl = document.createElement('span');
        nameEl.className = 'co-zone-item-name';
        nameEl.textContent = zoneId;
        topRow.appendChild(nameEl);

        // Sort order input (only if assigned)
        if (isAssigned) {
            var sortInput = document.createElement('input');
            sortInput.type = 'number';
            sortInput.className = 'co-zone-sort';
            sortInput.value = (za && za.sort_order != null) ? za.sort_order : 0;
            sortInput.title = 'Sort order within this zone';
            sortInput.addEventListener('change', async function () {
                var newSort = parseInt(sortInput.value, 10) || 0;
                await _coUpdateZoneAssignment(objectId, zoneId, null, newSort);
            });
            topRow.appendChild(sortInput);
        }

        wrapper.appendChild(topRow);

        // Config section (only if assigned)
        if (isAssigned) {
            var configSection = document.createElement('div');
            configSection.className = 'co-zone-config-section';

            var configLabel = document.createElement('label');
            configLabel.textContent = 'Config (JSON)';
            configSection.appendChild(configLabel);

            var configTextarea = document.createElement('textarea');
            configTextarea.value = (za && za.config) ? JSON.stringify(za.config, null, 2) : '{}';
            configTextarea.title = 'Zone-specific configuration (JSON)';
            configTextarea.addEventListener('change', async function () {
                var raw = configTextarea.value.trim();
                var parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch (e) {
                    if (typeof cwocToast === 'function') cwocToast('Invalid JSON in config for zone "' + zoneId + '"', 'error');
                    return;
                }
                await _coUpdateZoneAssignment(objectId, zoneId, parsed, null);
            });
            configSection.appendChild(configTextarea);

            wrapper.appendChild(configSection);
        }

        return wrapper;
    }

    /**
     * Assign object to a zone via POST /api/custom-objects/{id}/assign
     */
    async function _coAssignZone(objectId, zoneId) {
        try {
            var response = await fetch('/api/custom-objects/' + encodeURIComponent(objectId) + '/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zone_id: zoneId, config: {}, sort_order: 0 })
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to assign zone');
            }

            if (typeof cwocToast === 'function') cwocToast('Assigned to "' + zoneId + '"', 'success');
            await _coRefreshAfterZoneChange(objectId);
        } catch (e) {
            console.error('[CustomObjects] Assign zone error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to assign zone', 'error');
        }
    }

    /**
     * Unassign object from a zone via DELETE /api/custom-objects/{id}/assign/{zone_id}
     */
    async function _coUnassignZone(objectId, zoneId) {
        try {
            var response = await fetch('/api/custom-objects/' + encodeURIComponent(objectId) + '/assign/' + encodeURIComponent(zoneId), {
                method: 'DELETE'
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to unassign zone');
            }

            if (typeof cwocToast === 'function') cwocToast('Removed from "' + zoneId + '"', 'success');
            await _coRefreshAfterZoneChange(objectId);
        } catch (e) {
            console.error('[CustomObjects] Unassign zone error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to unassign zone', 'error');
        }
    }

    /**
     * Update zone assignment config/sort_order via PUT /api/custom-objects/{id}/assign/{zone_id}
     */
    async function _coUpdateZoneAssignment(objectId, zoneId, config, sortOrder) {
        try {
            var payload = {};
            if (config !== null) payload.config = config;
            if (sortOrder !== null) payload.sort_order = sortOrder;

            var response = await fetch('/api/custom-objects/' + encodeURIComponent(objectId) + '/assign/' + encodeURIComponent(zoneId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to update zone assignment');
            }

            if (typeof cwocToast === 'function') cwocToast('Zone "' + zoneId + '" updated', 'success');
            await _coRefreshAfterZoneChange(objectId);
        } catch (e) {
            console.error('[CustomObjects] Update zone assignment error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to update zone', 'error');
        }
    }

    /**
     * After any zone change, refresh data and re-render the zone modal if still open.
     */
    async function _coRefreshAfterZoneChange(objectId) {
        await _coFetchAll();
        // If zone modal is still open for this object, re-render it
        var overlay = document.getElementById('coZoneModalOverlay');
        if (overlay && overlay.classList.contains('active') && _coZoneModalObjectId === objectId) {
            var obj = _coAllObjects.find(function (o) { return o.id === objectId; });
            if (obj) {
                _coRenderZoneList(obj);
            }
        }
    }

    // ── Create Zone Modal ───────────────────────────────────────────────

    function _coInitCreateZoneModal() {
        var cancelBtn = document.getElementById('coCreateZoneCancelBtn');
        var submitBtn = document.getElementById('coCreateZoneSubmitBtn');
        var nameInput = document.getElementById('coCreateZoneName');
        if (cancelBtn) cancelBtn.addEventListener('click', _coCloseCreateZoneModal);
        if (submitBtn) submitBtn.addEventListener('click', _coSubmitCreateZone);
        // Allow Enter key to submit
        if (nameInput) nameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                _coSubmitCreateZone();
            }
        });
    }

    function _coOpenCreateZoneModal() {
        var overlay = document.getElementById('coCreateZoneModalOverlay');
        var nameInput = document.getElementById('coCreateZoneName');
        var errorEl = document.getElementById('coCreateZoneError');
        // Reset state
        if (nameInput) nameInput.value = '';
        if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
        if (overlay) overlay.classList.add('active');
        // Focus the input after a tick (allows overlay transition)
        setTimeout(function () { if (nameInput) nameInput.focus(); }, 50);
    }

    function _coCloseCreateZoneModal() {
        var overlay = document.getElementById('coCreateZoneModalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    async function _coSubmitCreateZone() {
        var nameInput = document.getElementById('coCreateZoneName');
        var errorEl = document.getElementById('coCreateZoneError');
        var name = nameInput ? nameInput.value.trim() : '';

        // Clear previous error
        if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

        // Validate non-empty
        if (!name) {
            if (errorEl) {
                errorEl.textContent = 'Zone name is required';
                errorEl.style.display = 'block';
            }
            if (nameInput) nameInput.focus();
            return;
        }

        try {
            var response = await fetch('/api/custom-zones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });

            if (response.status === 409) {
                // Duplicate zone name/id
                var errData = await response.json().catch(function () { return {}; });
                if (errorEl) {
                    errorEl.textContent = errData.detail || 'A zone with this name already exists';
                    errorEl.style.display = 'block';
                }
                if (nameInput) nameInput.focus();
                return;
            }

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to create zone');
            }

            // Success — close modal, refresh list, open zone editor, show toast
            var createdZone = await response.json();
            _coCloseCreateZoneModal();
            if (typeof cwocToast === 'function') cwocToast('Zone "' + name + '" created', 'success');
            await _coFetchZones();
            // Open the zone editor for the newly created zone (Requirement 2.6)
            _coOpenZoneEditor(createdZone);
        } catch (e) {
            console.error('[CustomObjects] Create zone error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to create zone', 'error');
        }
    }

    // ── ESC Key Handler ─────────────────────────────────────────────────

    function _coHandleEsc(e) {
        if (e.key !== 'Escape') return;

        // Check modals from innermost to outermost

        // Multi-select picker (dynamically created overlay)
        var pickerOverlay = document.querySelector('.co-add-objects-picker-overlay');
        if (pickerOverlay) {
            // Let the picker's own ESC handler deal with it
            return;
        }

        var deleteOverlay = document.getElementById('coDeleteModalOverlay');
        if (deleteOverlay && deleteOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            _coCloseDeleteModal();
            return;
        }

        var createZoneOverlay = document.getElementById('coCreateZoneModalOverlay');
        if (createZoneOverlay && createZoneOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            _coCloseCreateZoneModal();
            return;
        }

        var zoneEditorOverlay = document.getElementById('coZoneEditorOverlay');
        if (zoneEditorOverlay && zoneEditorOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            _coCloseZoneEditor();
            return;
        }

        var zoneOverlay = document.getElementById('coZoneModalOverlay');
        if (zoneOverlay && zoneOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            zoneOverlay.classList.remove('active');
            _coZoneModalObjectId = null;
            return;
        }

        var editOverlay = document.getElementById('coEditModalOverlay');
        if (editOverlay && editOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            _coCloseEditModal();
            return;
        }
    }

    // ── Custom Zones Listing ────────────────────────────────────────────

    /**
     * Fetch all custom zones from the API and render the listing.
     */
    async function _coFetchZones() {
        try {
            var response = await fetch('/api/custom-zones');
            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to load custom zones');
            }
            _coAllZones = await response.json();
            _coRenderZonesList();
        } catch (e) {
            console.error('[CustomObjects] Fetch zones error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to load custom zones', 'error');
            if (_coZonesList) {
                _coZonesList.innerHTML = '<div class="co-zones-empty">Failed to load zones.</div>';
            }
        }
    }

    /**
     * Render the custom zones list in the Custom Zones section.
     * Zones are displayed in sort_order (already sorted by API).
     */
    function _coRenderZonesList() {
        if (!_coZonesList) return;

        if (!_coAllZones || _coAllZones.length === 0) {
            _coZonesList.innerHTML = '<div class="co-zones-empty">No custom zones yet — create one to get started.</div>';
            return;
        }

        _coZonesList.innerHTML = '';

        _coAllZones.forEach(function (zone) {
            var row = document.createElement('div');
            row.className = 'co-zone-row';
            row.dataset.zoneId = zone.zone_id;
            row.draggable = true;

            // Drag handle
            var handleEl = document.createElement('span');
            handleEl.className = 'co-zone-drag-handle';
            handleEl.innerHTML = '<i class="fas fa-grip-vertical"></i>';
            handleEl.title = 'Drag to reorder';
            row.appendChild(handleEl);

            // Zone name
            var nameEl = document.createElement('span');
            nameEl.className = 'co-zone-row-name';
            nameEl.textContent = zone.name;
            row.appendChild(nameEl);

            // Object count badge
            var countEl = document.createElement('span');
            countEl.className = 'co-zone-row-count';
            var count = zone.object_count || 0;
            countEl.textContent = count + ' object' + (count !== 1 ? 's' : '');
            row.appendChild(countEl);

            // Action buttons
            var actionsEl = document.createElement('div');
            actionsEl.className = 'co-zone-row-actions';

            // Edit button
            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';
            editBtn.title = 'Edit zone';
            editBtn.addEventListener('click', (function (z) {
                return function () { _coOpenZoneEditor(z); };
            })(zone));
            actionsEl.appendChild(editBtn);

            // Delete button
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'co-zone-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Delete zone';
            deleteBtn.addEventListener('click', (function (z) {
                return function () { _coDeleteZone(z); };
            })(zone));
            actionsEl.appendChild(deleteBtn);

            row.appendChild(actionsEl);
            _coZonesList.appendChild(row);
        });

        // Enable drag-to-reorder (desktop + mobile)
        _coInitZoneDragReorder();
    }

    // ── Zone Drag-to-Reorder ────────────────────────────────────────────

    var _coZoneDraggedEl = null; // Tracks the currently dragged zone row (HTML5)
    var _coZoneTouchState = null; // Tracks touch drag state

    /**
     * Initialize drag-to-reorder for zone rows in the listing.
     * Supports HTML5 drag (desktop) and touch hold + move (mobile via shared-touch.js).
     */
    function _coInitZoneDragReorder() {
        if (!_coZonesList) return;

        // Remove previous HTML5 drag listeners (idempotent re-init)
        if (_coZonesList._zoneDragCleanup) {
            _coZonesList._zoneDragCleanup();
        }

        // ── HTML5 Drag (Desktop) ──
        _coZonesList.addEventListener('dragstart', _coZoneOnDragStart);
        _coZonesList.addEventListener('dragover', _coZoneOnDragOver);
        _coZonesList.addEventListener('dragend', _coZoneOnDragEnd);
        _coZonesList.addEventListener('drop', _coZoneOnDrop);

        _coZonesList._zoneDragCleanup = function () {
            _coZonesList.removeEventListener('dragstart', _coZoneOnDragStart);
            _coZonesList.removeEventListener('dragover', _coZoneOnDragOver);
            _coZonesList.removeEventListener('dragend', _coZoneOnDragEnd);
            _coZonesList.removeEventListener('drop', _coZoneOnDrop);
        };

        // ── Touch Drag (Mobile) ──
        var rows = _coZonesList.querySelectorAll('.co-zone-row[data-zone-id]');
        rows.forEach(function (row) {
            if (typeof enableTouchDrag === 'function') {
                enableTouchDrag(row, {
                    onStart: function (data) { _coZoneOnTouchStart(row, data); },
                    onMove: function (data) { _coZoneOnTouchMove(row, data); },
                    onEnd: function (data) { _coZoneOnTouchEnd(row, data); }
                });
            }
        });
    }

    // ── HTML5 Drag Handlers ──

    function _coZoneOnDragStart(e) {
        var row = e.target.closest('.co-zone-row[data-zone-id]');
        if (!row) return;
        _coZoneDraggedEl = row;
        e.dataTransfer.setData('text/plain', row.dataset.zoneId);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('cwoc-dragging');
    }

    function _coZoneOnDragOver(e) {
        if (!_coZoneDraggedEl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        var row = e.target.closest('.co-zone-row[data-zone-id]');
        // Clear all indicators
        _coZonesList.querySelectorAll('.co-zone-row').forEach(function (r) {
            r.style.borderTop = '';
            r.style.borderBottom = '';
        });
        if (row && row !== _coZoneDraggedEl) {
            var rect = row.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                row.style.borderTop = '3px solid #8b5a2b';
            } else {
                row.style.borderBottom = '3px solid #8b5a2b';
            }
        }
    }

    function _coZoneOnDragEnd() {
        if (_coZoneDraggedEl) {
            _coZoneDraggedEl.classList.remove('cwoc-dragging');
            _coZoneDraggedEl = null;
        }
        _coZonesList.querySelectorAll('.co-zone-row').forEach(function (r) {
            r.style.borderTop = '';
            r.style.borderBottom = '';
        });
    }

    function _coZoneOnDrop(e) {
        if (!_coZoneDraggedEl) return;
        e.preventDefault();

        var targetRow = e.target.closest('.co-zone-row[data-zone-id]');
        if (!targetRow || targetRow === _coZoneDraggedEl) {
            _coZoneOnDragEnd();
            return;
        }

        // Determine new order from DOM
        var rows = Array.from(_coZonesList.querySelectorAll('.co-zone-row[data-zone-id]'));
        var ids = rows.map(function (r) { return r.dataset.zoneId; });

        var fromId = _coZoneDraggedEl.dataset.zoneId;
        var toId = targetRow.dataset.zoneId;
        var fromIdx = ids.indexOf(fromId);
        var toIdx = ids.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) { _coZoneOnDragEnd(); return; }

        // Determine if dropping above or below
        var rect = targetRow.getBoundingClientRect();
        if (e.clientY > rect.top + rect.height / 2) toIdx++;

        ids.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx--;
        ids.splice(toIdx, 0, fromId);

        _coZoneOnDragEnd();
        _coZonePersistOrder(ids);
    }

    // ── Touch Drag Handlers ──

    function _coZoneOnTouchStart(row, data) {
        row.classList.remove('cwoc-touch-dragging');

        var rect = row.getBoundingClientRect();

        // Create placeholder to hold the row's space
        var placeholder = document.createElement('div');
        placeholder.className = 'co-zone-drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        row.parentNode.insertBefore(placeholder, row);

        // Float the row under the finger
        row.style.position = 'fixed';
        row.style.left = rect.left + 'px';
        row.style.top = rect.top + 'px';
        row.style.width = rect.width + 'px';
        row.style.zIndex = '10000';
        row.style.opacity = '0.9';
        row.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        row.style.transition = 'none';
        row.style.pointerEvents = 'none';

        document.body.style.overscrollBehavior = 'contain';

        _coZoneTouchState = {
            row: row,
            placeholder: placeholder,
            offsetX: data.clientX - rect.left,
            offsetY: data.clientY - rect.top,
            lastInsertIdx: -1
        };
    }

    function _coZoneOnTouchMove(row, data) {
        if (!_coZoneTouchState || !_coZoneTouchState.placeholder) return;
        var s = _coZoneTouchState;

        // Move floating row to follow finger
        s.row.style.left = (data.clientX - s.offsetX) + 'px';
        s.row.style.top = (data.clientY - s.offsetY) + 'px';

        // Find insert position among other rows
        var allRows = Array.from(_coZonesList.querySelectorAll('.co-zone-row[data-zone-id]'));
        var otherRows = allRows.filter(function (r) { return r !== s.row; });

        var insertIdx = otherRows.length;
        for (var i = 0; i < otherRows.length; i++) {
            var r = otherRows[i].getBoundingClientRect();
            if (data.clientY < r.top + r.height / 2) {
                insertIdx = i;
                break;
            }
        }

        if (insertIdx !== s.lastInsertIdx) {
            s.lastInsertIdx = insertIdx;
            if (insertIdx >= otherRows.length) {
                _coZonesList.appendChild(s.placeholder);
            } else {
                _coZonesList.insertBefore(s.placeholder, otherRows[insertIdx]);
            }
        }
    }

    function _coZoneOnTouchEnd(row, data) {
        if (!_coZoneTouchState || !_coZoneTouchState.placeholder) return;
        var s = _coZoneTouchState;

        document.body.style.overscrollBehavior = '';

        // Restore row styles
        s.row.classList.remove('cwoc-touch-dragging');
        s.row.style.position = '';
        s.row.style.left = '';
        s.row.style.top = '';
        s.row.style.width = '';
        s.row.style.zIndex = '';
        s.row.style.opacity = '';
        s.row.style.boxShadow = '';
        s.row.style.transition = '';
        s.row.style.pointerEvents = '';

        // Insert row where placeholder is
        s.placeholder.parentNode.insertBefore(s.row, s.placeholder);
        s.placeholder.remove();

        // Read new order from DOM
        var rows = Array.from(_coZonesList.querySelectorAll('.co-zone-row[data-zone-id]'));
        var ids = rows.map(function (r) { return r.dataset.zoneId; });

        _coZoneTouchState = null;
        _coZonePersistOrder(ids);
    }

    // ── Persist Zone Order ──

    /**
     * Persist the new zone order by PUTting sort_order to each zone.
     * @param {string[]} orderedZoneIds - Zone IDs in desired order
     */
    async function _coZonePersistOrder(orderedZoneIds) {
        try {
            // Update local state
            var zoneMap = {};
            _coAllZones.forEach(function (z) { zoneMap[z.zone_id] = z; });

            var promises = [];
            orderedZoneIds.forEach(function (zoneId, idx) {
                var newSortOrder = idx + 1;
                if (zoneMap[zoneId]) {
                    zoneMap[zoneId].sort_order = newSortOrder;
                }
                promises.push(
                    fetch('/api/custom-zones/' + encodeURIComponent(zoneId), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sort_order: newSortOrder })
                    })
                );
            });

            // Re-sort local array
            _coAllZones.sort(function (a, b) { return a.sort_order - b.sort_order; });

            // Wait for all updates
            var results = await Promise.all(promises);
            var allOk = results.every(function (r) { return r.ok; });
            if (!allOk) {
                throw new Error('Some zone order updates failed');
            }
        } catch (e) {
            console.error('[CustomObjects] Zone reorder error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to save zone order', 'error');
            // Re-fetch to restore correct state
            _coFetchZones();
        }
    }

    // ── Zone Deletion ──────────────────────────────────────────────────

    /**
     * Show a confirmation dialog and delete a custom zone on confirm.
     * Uses cwocConfirm for the parchment-styled modal.
     * On confirm: DELETE /api/custom-zones/{zone_id}, then refresh zone list.
     */
    async function _coDeleteZone(zone) {
        var confirmed = await cwocConfirm(
            'Are you sure you want to delete the zone "' + zone.name + '"?\n\nAll object assignments for this zone will be removed. Data already saved on chits will not be affected.',
            {
                title: 'Delete Zone',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                danger: true
            }
        );
        if (!confirmed) return;

        try {
            var response = await fetch('/api/custom-zones/' + encodeURIComponent(zone.zone_id), {
                method: 'DELETE'
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to delete zone');
            }

            cwocToast('Zone "' + zone.name + '" deleted', 'success');
            await _coFetchZones();
        } catch (e) {
            console.error('[CustomObjects] Zone delete error:', e);
            cwocToast(e.message || 'Failed to delete zone', 'error');
        }
    }

    // ── Zone Editor Modal ──────────────────────────────────────────────

    var _coZoneEditorZone = null; // The zone currently being edited
    var _coZoneEditorObjects = []; // Assigned objects for the current zone

    /**
     * Initialize zone editor modal controls (close button, name blur, add button).
     */
    function _coInitZoneEditorModal() {
        var closeBtn = document.getElementById('coZoneEditorCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', _coCloseZoneEditor);

        var nameInput = document.getElementById('coZoneEditorName');
        if (nameInput) {
            nameInput.addEventListener('blur', _coZoneEditorSaveName);
            nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    nameInput.blur();
                }
            });
        }

        var addBtn = document.getElementById('coZoneEditorAddBtn');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                _coShowAddObjectsPicker();
            });
        }

        var previewBtn = document.getElementById('coZoneEditorPreviewBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', function () {
                _coToggleZonePreview();
            });
        }
    }

    /**
     * Open the zone editor modal for a given zone.
     * @param {object} zone - Zone object with zone_id, name, etc.
     */
    async function _coOpenZoneEditor(zone) {
        _coZoneEditorZone = zone;

        var overlay = document.getElementById('coZoneEditorOverlay');
        var nameInput = document.getElementById('coZoneEditorName');

        // Set zone name
        if (nameInput) nameInput.value = zone.name || '';

        // Show modal
        if (overlay) overlay.classList.add('active');

        // Fetch and render assigned objects
        await _coZoneEditorFetchObjects();
    }

    /**
     * Close the zone editor modal and refresh the zones list.
     */
    function _coCloseZoneEditor() {
        var overlay = document.getElementById('coZoneEditorOverlay');
        if (overlay) overlay.classList.remove('active');
        _coZoneEditorZone = null;
        _coZoneEditorObjects = [];
        // Hide and clear preview panel
        var previewContainer = document.getElementById('coZonePreviewContainer');
        if (previewContainer) {
            previewContainer.style.display = 'none';
            previewContainer.innerHTML = '';
        }
        // Refresh zones list to reflect any changes
        _coFetchZones();
    }

    /**
     * Save the zone name on blur or Enter.
     * PUT /api/custom-zones/{zone_id} with the new name.
     */
    async function _coZoneEditorSaveName() {
        if (!_coZoneEditorZone) return;

        var nameInput = document.getElementById('coZoneEditorName');
        var newName = nameInput ? nameInput.value.trim() : '';

        if (!newName) {
            // Revert to original name if empty
            if (nameInput) nameInput.value = _coZoneEditorZone.name || '';
            return;
        }

        // Only save if name actually changed
        if (newName === _coZoneEditorZone.name) return;

        try {
            var response = await fetch('/api/custom-zones/' + encodeURIComponent(_coZoneEditorZone.zone_id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to rename zone');
            }

            // Update local state
            _coZoneEditorZone.name = newName;
            if (typeof cwocToast === 'function') cwocToast('Zone renamed', 'success');
        } catch (e) {
            console.error('[CustomObjects] Zone rename error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to rename zone', 'error');
            // Revert input
            if (nameInput) nameInput.value = _coZoneEditorZone.name || '';
        }
    }

    /**
     * Fetch assigned objects for the current zone and render them.
     * GET /api/custom-objects/zone/{zone_id}
     */
    async function _coZoneEditorFetchObjects() {
        if (!_coZoneEditorZone) return;

        var container = document.getElementById('coZoneEditorObjects');
        if (!container) return;

        try {
            var response = await fetch('/api/custom-objects/zone/' + encodeURIComponent(_coZoneEditorZone.zone_id));
            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to load zone objects');
            }
            _coZoneEditorObjects = await response.json();
            _coZoneEditorRenderObjects();
        } catch (e) {
            console.error('[CustomObjects] Zone editor fetch error:', e);
            if (container) {
                container.innerHTML = '<div class="co-zone-editor-empty">Failed to load assigned objects.</div>';
            }
        }
    }

    /**
     * Render assigned objects in the zone editor, grouped by sub_type, sorted by zone_sort_order.
     */
    function _coZoneEditorRenderObjects() {
        var container = document.getElementById('coZoneEditorObjects');
        if (!container) return;

        if (!_coZoneEditorObjects || _coZoneEditorObjects.length === 0) {
            container.innerHTML = '<div class="co-zone-editor-empty">No objects assigned to this zone yet. Click "Add Objects" to get started.</div>';
            return;
        }

        // Sort by zone_sort_order (from zone_assignments)
        var sorted = _coZoneEditorObjects.slice().sort(function (a, b) {
            var aSort = (a.zone_sort_order != null) ? a.zone_sort_order : 9999;
            var bSort = (b.zone_sort_order != null) ? b.zone_sort_order : 9999;
            return aSort - bSort;
        });

        // Group by sub_type (alphabetical group headers)
        var groups = {};
        sorted.forEach(function (obj) {
            var subType = obj.sub_type || 'Uncategorized';
            if (!groups[subType]) groups[subType] = [];
            groups[subType].push(obj);
        });

        var sortedGroupKeys = Object.keys(groups).sort(function (a, b) {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });

        container.innerHTML = '';

        sortedGroupKeys.forEach(function (groupName) {
            var groupSection = document.createElement('div');
            groupSection.className = 'co-zone-editor-group';

            // Group header
            var header = document.createElement('div');
            header.className = 'co-zone-editor-group-header';
            header.textContent = groupName + ' (' + groups[groupName].length + ')';
            groupSection.appendChild(header);

            // Grid of cards
            var grid = document.createElement('div');
            grid.className = 'co-zone-editor-grid';

            groups[groupName].forEach(function (obj) {
                var card = document.createElement('div');
                card.className = 'co-zone-editor-card';
                card.dataset.objectId = obj.id;
                card.draggable = true;

                // Drag handle
                var handleEl = document.createElement('span');
                handleEl.className = 'co-zone-editor-card-drag-handle';
                handleEl.innerHTML = '<i class="fas fa-grip-vertical"></i>';
                handleEl.title = 'Drag to reorder';
                card.appendChild(handleEl);

                // Object name
                var nameEl = document.createElement('span');
                nameEl.className = 'co-zone-editor-card-name';
                nameEl.textContent = obj.name;
                nameEl.title = obj.name;
                card.appendChild(nameEl);

                // Type badge
                var badge = document.createElement('span');
                badge.className = 'co-zone-editor-card-badge';
                badge.textContent = obj.type || 'Unknown';
                card.appendChild(badge);

                // Remove button (×)
                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'co-zone-editor-card-remove';
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Remove from zone';
                removeBtn.addEventListener('click', (function (o) {
                    return function () { _coZoneEditorRemoveObject(o); };
                })(obj));
                card.appendChild(removeBtn);

                grid.appendChild(card);
            });

            groupSection.appendChild(grid);
            container.appendChild(groupSection);
        });

        // Enable drag-to-reorder within each group (desktop + mobile)
        _coInitZoneEditorDragReorder();
    }

    /**
     * Remove an object from the current zone.
     * DELETE /api/custom-objects/{id}/assign/{zone_id}, then refresh.
     */
    async function _coZoneEditorRemoveObject(obj) {
        if (!_coZoneEditorZone) return;

        try {
            var response = await fetch(
                '/api/custom-objects/' + encodeURIComponent(obj.id) + '/assign/' + encodeURIComponent(_coZoneEditorZone.zone_id),
                { method: 'DELETE' }
            );

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to remove object from zone');
            }

            if (typeof cwocToast === 'function') cwocToast('"' + obj.name + '" removed from zone', 'success');
            await _coZoneEditorFetchObjects();
        } catch (e) {
            console.error('[CustomObjects] Zone editor remove error:', e);
            if (typeof cwocToast === 'function') cwocToast(e.message || 'Failed to remove object', 'error');
        }
    }

    // ── Multi-Select Picker (Add Objects to Zone) ────────────────────

    /**
     * Show the multi-select picker modal for adding objects to the current zone.
     * Reuses the grouped/searchable pattern from _showAddIndicatorPicker in editor-health.js.
     * Filters out objects already assigned to this zone.
     */
    function _coShowAddObjectsPicker() {
        if (!_coZoneEditorZone) return;

        // Remove any existing picker overlay
        document.querySelectorAll('.co-add-objects-picker-overlay').forEach(function (el) { el.remove(); });

        // Build overlay
        var overlay = document.createElement('div');
        overlay.className = 'co-add-objects-picker-overlay';

        var modal = document.createElement('div');
        modal.className = 'co-add-objects-picker-modal';
        modal.innerHTML = '<div style="text-align:center;padding:1em;opacity:0.5;">Loading…</div>';
        overlay.appendChild(modal);

        // Close on overlay click
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.body.appendChild(overlay);

        function close() {
            document.removeEventListener('keydown', onEsc, true);
            overlay.remove();
        }
        function onEsc(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                close();
            }
        }
        document.addEventListener('keydown', onEsc, true);

        // Fetch all custom objects
        fetch('/api/custom-objects').then(function (resp) {
            if (!resp.ok) throw new Error('API error');
            return resp.json();
        }).then(function (allObjects) {
            // Build set of IDs already assigned to this zone
            var assignedIds = {};
            _coZoneEditorObjects.forEach(function (obj) {
                assignedIds[obj.id] = true;
            });

            // Filter: exclude already-assigned, inactive, and deleted objects
            var available = allObjects.filter(function (obj) {
                if (assignedIds[obj.id]) return false;
                if (!obj.active) return false;
                if (obj.deleted) return false;
                return true;
            });

            _coRenderAddObjectsModal(modal, available, close);
        }).catch(function (err) {
            console.error('[CustomObjects] Failed to fetch objects for picker:', err);
            modal.innerHTML = '';
            var errTitle = document.createElement('h3');
            errTitle.className = 'co-picker-title';
            errTitle.textContent = 'Add Objects to Zone';
            modal.appendChild(errTitle);
            var errMsg = document.createElement('p');
            errMsg.style.cssText = 'color:#b22222;margin:8px 0;';
            errMsg.textContent = 'Failed to load objects.';
            modal.appendChild(errMsg);
            var errBtnRow = document.createElement('div');
            errBtnRow.className = 'co-picker-btn-row';
            var errCloseBtn = document.createElement('button');
            errCloseBtn.className = 'co-btn-cancel';
            errCloseBtn.textContent = 'Close';
            errCloseBtn.addEventListener('click', close);
            errBtnRow.appendChild(errCloseBtn);
            modal.appendChild(errBtnRow);
        });
    }

    /**
     * Render the Add Objects picker modal content with grouped/searchable list.
     * @param {HTMLElement} modal - The modal container element
     * @param {Array} available - Available objects to show
     * @param {Function} closeFn - Function to close the picker
     */
    function _coRenderAddObjectsModal(modal, available, closeFn) {
        modal.innerHTML = '';
        var selected = {}; // id → obj

        // Title
        var titleEl = document.createElement('h3');
        titleEl.className = 'co-picker-title';
        titleEl.textContent = 'Add Objects to Zone';
        modal.appendChild(titleEl);

        if (available.length === 0) {
            var emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color:#6b4e31;font-size:0.95em;margin:8px 0;';
            emptyMsg.textContent = 'No additional custom objects available.';
            modal.appendChild(emptyMsg);
        } else {
            // Search input
            var searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search by name, type, or category...';
            searchInput.className = 'co-picker-search';
            modal.appendChild(searchInput);

            // Scrollable list container
            var list = document.createElement('div');
            list.className = 'co-picker-list';

            function renderList(filter) {
                list.innerHTML = '';
                var lowerFilter = (filter || '').toLowerCase();
                var isSearching = lowerFilter.length > 0;

                // Group by type → sub_type
                var typeGroups = {};
                var typeOrder = [];
                for (var i = 0; i < available.length; i++) {
                    var obj = available[i];
                    if (lowerFilter) {
                        var nameMatch = obj.name.toLowerCase().indexOf(lowerFilter) !== -1;
                        var typeMatch = (obj.type || '').toLowerCase().indexOf(lowerFilter) !== -1;
                        var subTypeMatch = (obj.sub_type || '').toLowerCase().indexOf(lowerFilter) !== -1;
                        if (!nameMatch && !typeMatch && !subTypeMatch) continue;
                    }
                    var type = obj.type || 'Other';
                    var subType = obj.sub_type || '';
                    if (!typeGroups[type]) { typeGroups[type] = {}; typeOrder.push(type); }
                    if (!typeGroups[type][subType]) typeGroups[type][subType] = [];
                    typeGroups[type][subType].push(obj);
                }

                if (typeOrder.length === 0) {
                    list.innerHTML = '<div class="co-picker-no-matches">No matches.</div>';
                    return;
                }

                typeOrder.sort(function (a, b) { return a.localeCompare(b); });

                for (var t = 0; t < typeOrder.length; t++) {
                    var typeName = typeOrder[t];
                    var subTypes = typeGroups[typeName];
                    var typeCount = 0;
                    Object.keys(subTypes).forEach(function (st) { typeCount += subTypes[st].length; });

                    // Type header (collapsible)
                    var typeHeader = document.createElement('div');
                    typeHeader.className = 'co-picker-type-header';
                    typeHeader.innerHTML = '<span class="co-picker-arrow">▼</span> ' + _coEscape(typeName) + ' <span class="co-picker-count">(' + typeCount + ')</span>';
                    list.appendChild(typeHeader);

                    var typeBody = document.createElement('div');
                    list.appendChild(typeBody);

                    (function (header, body) {
                        header.addEventListener('click', function () {
                            var arrow = header.querySelector('.co-picker-arrow');
                            if (body.style.display === 'none') { body.style.display = ''; arrow.textContent = '▼'; }
                            else { body.style.display = 'none'; arrow.textContent = '▶'; }
                        });
                    })(typeHeader, typeBody);

                    // Sort sub_types alphabetically (empty string first)
                    var sortedSubTypes = Object.keys(subTypes).sort(function (a, b) {
                        if (a === '') return -1; if (b === '') return 1; return a.localeCompare(b);
                    });

                    for (var s = 0; s < sortedSubTypes.length; s++) {
                        var stName = sortedSubTypes[s];
                        var stItems = subTypes[stName];
                        var targetContainer = typeBody;

                        if (stName) {
                            var stHeader = document.createElement('div');
                            stHeader.className = 'co-picker-subtype-header';
                            stHeader.innerHTML = '<span class="co-picker-arrow">' + (isSearching ? '▼' : '▶') + '</span> ' + _coEscape(stName) + ' <span class="co-picker-count">(' + stItems.length + ')</span>';
                            typeBody.appendChild(stHeader);

                            var stBody = document.createElement('div');
                            if (!isSearching) stBody.style.display = 'none';
                            typeBody.appendChild(stBody);

                            (function (header, body) {
                                header.addEventListener('click', function () {
                                    var arrow = header.querySelector('.co-picker-arrow');
                                    if (body.style.display === 'none') { body.style.display = ''; arrow.textContent = '▼'; }
                                    else { body.style.display = 'none'; arrow.textContent = '▶'; }
                                });
                            })(stHeader, stBody);
                            targetContainer = stBody;
                        }

                        // Sort items alphabetically by name
                        stItems.sort(function (a, b) { return a.name.localeCompare(b.name); });

                        for (var j = 0; j < stItems.length; j++) {
                            (function (obj) {
                                var item = document.createElement('label');
                                item.className = 'co-picker-item' + (stName ? ' co-picker-item-indented' : '');

                                var cb = document.createElement('input');
                                cb.type = 'checkbox';
                                cb.className = 'co-picker-checkbox';
                                cb.checked = !!selected[obj.id];
                                cb.addEventListener('change', function () {
                                    if (cb.checked) { selected[obj.id] = obj; } else { delete selected[obj.id]; }
                                    updateAddBtn();
                                });
                                item.appendChild(cb);

                                var nameSpan = document.createElement('span');
                                nameSpan.className = 'co-picker-item-name';
                                nameSpan.textContent = obj.name;
                                item.appendChild(nameSpan);

                                targetContainer.appendChild(item);
                            })(stItems[j]);
                        }
                    }
                }
            }

            renderList('');

            searchInput.addEventListener('input', function () {
                renderList(searchInput.value);
            });

            modal.appendChild(list);
            setTimeout(function () { searchInput.focus(); }, 50);
        }

        // Button row: Add Selected + Cancel
        var btnRow = document.createElement('div');
        btnRow.className = 'co-picker-btn-row';

        var addBtn = document.createElement('button');
        addBtn.className = 'co-btn-save co-picker-add-btn';
        addBtn.textContent = 'Add Selected';
        addBtn.disabled = true;
        addBtn.addEventListener('click', async function () {
            var ids = Object.keys(selected);
            if (ids.length === 0) return;

            addBtn.disabled = true;
            addBtn.textContent = 'Adding...';

            // Determine starting sort_order (max existing + 1)
            var maxSort = 0;
            _coZoneEditorObjects.forEach(function (obj) {
                var s = obj.zone_sort_order || 0;
                if (s > maxSort) maxSort = s;
            });

            var successCount = 0;
            var errors = [];

            for (var k = 0; k < ids.length; k++) {
                var objId = ids[k];
                var sortOrder = maxSort + k + 1;
                try {
                    var response = await fetch('/api/custom-objects/' + encodeURIComponent(objId) + '/assign', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            zone_id: _coZoneEditorZone.zone_id,
                            sort_order: sortOrder
                        })
                    });
                    if (!response.ok) {
                        var err = await response.json().catch(function () { return {}; });
                        errors.push(err.detail || 'Failed to assign object');
                    } else {
                        successCount++;
                    }
                } catch (e) {
                    errors.push(e.message || 'Network error');
                }
            }

            if (successCount > 0) {
                if (typeof cwocToast === 'function') {
                    cwocToast(successCount + ' object' + (successCount > 1 ? 's' : '') + ' added to zone', 'success');
                }
            }
            if (errors.length > 0) {
                if (typeof cwocToast === 'function') {
                    cwocToast(errors.length + ' assignment' + (errors.length > 1 ? 's' : '') + ' failed', 'error');
                }
            }

            closeFn();
            // Refresh the zone editor's assigned objects list
            await _coZoneEditorFetchObjects();
        });
        btnRow.appendChild(addBtn);

        function updateAddBtn() {
            var count = Object.keys(selected).length;
            if (count > 0) {
                addBtn.disabled = false;
                addBtn.textContent = 'Add Selected (' + count + ')';
            } else {
                addBtn.disabled = true;
                addBtn.textContent = 'Add Selected';
            }
        }

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'co-btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () { closeFn(); });
        btnRow.appendChild(cancelBtn);
        modal.appendChild(btnRow);
    }

    // ── Zone Editor Drag-to-Reorder ────────────────────────────────────

    var _coZoneEditorDraggedEl = null; // Tracks the currently dragged card (HTML5)
    var _coZoneEditorDragGrid = null;  // The grid container the dragged card belongs to
    var _coZoneEditorTouchState = null; // Tracks touch drag state

    /**
     * Initialize drag-to-reorder for cards within each sub_type group grid.
     * Items reorder within their group only (not across groups).
     * Supports HTML5 drag (desktop) and touch hold + move (mobile via shared-touch.js).
     */
    function _coInitZoneEditorDragReorder() {
        var container = document.getElementById('coZoneEditorObjects');
        if (!container) return;

        // Remove previous HTML5 drag listeners (idempotent re-init)
        if (container._zoneEditorDragCleanup) {
            container._zoneEditorDragCleanup();
        }

        // ── HTML5 Drag (Desktop) ──
        container.addEventListener('dragstart', _coZoneEditorOnDragStart);
        container.addEventListener('dragover', _coZoneEditorOnDragOver);
        container.addEventListener('dragend', _coZoneEditorOnDragEnd);
        container.addEventListener('drop', _coZoneEditorOnDrop);

        container._zoneEditorDragCleanup = function () {
            container.removeEventListener('dragstart', _coZoneEditorOnDragStart);
            container.removeEventListener('dragover', _coZoneEditorOnDragOver);
            container.removeEventListener('dragend', _coZoneEditorOnDragEnd);
            container.removeEventListener('drop', _coZoneEditorOnDrop);
        };

        // ── Touch Drag (Mobile) ──
        var cards = container.querySelectorAll('.co-zone-editor-card[data-object-id]');
        cards.forEach(function (card) {
            if (typeof enableTouchDrag === 'function') {
                enableTouchDrag(card, {
                    onStart: function (data) { _coZoneEditorOnTouchStart(card, data); },
                    onMove: function (data) { _coZoneEditorOnTouchMove(card, data); },
                    onEnd: function (data) { _coZoneEditorOnTouchEnd(card, data); }
                });
            }
        });
    }

    // ── HTML5 Drag Handlers (Zone Editor Cards) ──

    function _coZoneEditorOnDragStart(e) {
        var card = e.target.closest('.co-zone-editor-card[data-object-id]');
        if (!card) return;
        _coZoneEditorDraggedEl = card;
        _coZoneEditorDragGrid = card.closest('.co-zone-editor-grid');
        e.dataTransfer.setData('text/plain', card.dataset.objectId);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('cwoc-dragging');
    }

    function _coZoneEditorOnDragOver(e) {
        if (!_coZoneEditorDraggedEl || !_coZoneEditorDragGrid) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        var card = e.target.closest('.co-zone-editor-card[data-object-id]');
        // Clear all border indicators within the same grid
        _coZoneEditorDragGrid.querySelectorAll('.co-zone-editor-card').forEach(function (c) {
            c.style.borderLeft = '';
            c.style.borderRight = '';
        });
        // Only show indicator if target is in the same grid (same sub_type group)
        if (card && card !== _coZoneEditorDraggedEl && card.closest('.co-zone-editor-grid') === _coZoneEditorDragGrid) {
            var rect = card.getBoundingClientRect();
            var midX = rect.left + rect.width / 2;
            if (e.clientX < midX) {
                card.style.borderLeft = '3px solid #8b5a2b';
            } else {
                card.style.borderRight = '3px solid #8b5a2b';
            }
        }
    }

    function _coZoneEditorOnDragEnd() {
        if (_coZoneEditorDraggedEl) {
            _coZoneEditorDraggedEl.classList.remove('cwoc-dragging');
        }
        if (_coZoneEditorDragGrid) {
            _coZoneEditorDragGrid.querySelectorAll('.co-zone-editor-card').forEach(function (c) {
                c.style.borderLeft = '';
                c.style.borderRight = '';
            });
        }
        _coZoneEditorDraggedEl = null;
        _coZoneEditorDragGrid = null;
    }

    function _coZoneEditorOnDrop(e) {
        if (!_coZoneEditorDraggedEl || !_coZoneEditorDragGrid) return;
        e.preventDefault();

        var targetCard = e.target.closest('.co-zone-editor-card[data-object-id]');
        // Only allow drop within the same grid (same sub_type group)
        if (!targetCard || targetCard === _coZoneEditorDraggedEl || targetCard.closest('.co-zone-editor-grid') !== _coZoneEditorDragGrid) {
            _coZoneEditorOnDragEnd();
            return;
        }

        // Determine new order within this grid
        var cards = Array.from(_coZoneEditorDragGrid.querySelectorAll('.co-zone-editor-card[data-object-id]'));
        var ids = cards.map(function (c) { return c.dataset.objectId; });

        var fromId = _coZoneEditorDraggedEl.dataset.objectId;
        var toId = targetCard.dataset.objectId;
        var fromIdx = ids.indexOf(fromId);
        var toIdx = ids.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) { _coZoneEditorOnDragEnd(); return; }

        // Determine if dropping before or after target
        var rect = targetCard.getBoundingClientRect();
        if (e.clientX > rect.left + rect.width / 2) toIdx++;

        ids.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx--;
        ids.splice(toIdx, 0, fromId);

        // Reorder DOM within the grid
        ids.forEach(function (id) {
            var el = _coZoneEditorDragGrid.querySelector('.co-zone-editor-card[data-object-id="' + id + '"]');
            if (el) _coZoneEditorDragGrid.appendChild(el);
        });

        _coZoneEditorOnDragEnd();
        _coZoneEditorPersistOrder();
    }

    // ── Touch Drag Handlers (Zone Editor Cards) ──

    function _coZoneEditorOnTouchStart(card, data) {
        card.classList.remove('cwoc-touch-dragging');

        var grid = card.closest('.co-zone-editor-grid');
        if (!grid) return;

        var rect = card.getBoundingClientRect();

        // Create placeholder to hold the card's space
        var placeholder = document.createElement('div');
        placeholder.className = 'co-zone-editor-card-placeholder';
        placeholder.style.height = rect.height + 'px';
        card.parentNode.insertBefore(placeholder, card);

        // Float the card under the finger
        card.style.position = 'fixed';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.width = rect.width + 'px';
        card.style.zIndex = '10000';
        card.style.opacity = '0.9';
        card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        card.style.transition = 'none';
        card.style.pointerEvents = 'none';

        document.body.style.overscrollBehavior = 'contain';

        _coZoneEditorTouchState = {
            card: card,
            grid: grid,
            placeholder: placeholder,
            offsetX: data.clientX - rect.left,
            offsetY: data.clientY - rect.top,
            lastInsertIdx: -1
        };
    }

    function _coZoneEditorOnTouchMove(card, data) {
        if (!_coZoneEditorTouchState || !_coZoneEditorTouchState.placeholder) return;
        var s = _coZoneEditorTouchState;

        // Move floating card to follow finger
        s.card.style.left = (data.clientX - s.offsetX) + 'px';
        s.card.style.top = (data.clientY - s.offsetY) + 'px';

        // Find insert position among other cards in the same grid
        var allCards = Array.from(s.grid.querySelectorAll('.co-zone-editor-card[data-object-id]'));
        var otherCards = allCards.filter(function (c) { return c !== s.card; });

        var insertIdx = otherCards.length;
        for (var i = 0; i < otherCards.length; i++) {
            var r = otherCards[i].getBoundingClientRect();
            var midY = r.top + r.height / 2;
            if (data.clientY < midY) {
                insertIdx = i;
                break;
            }
        }

        if (insertIdx !== s.lastInsertIdx) {
            s.lastInsertIdx = insertIdx;
            if (insertIdx >= otherCards.length) {
                s.grid.appendChild(s.placeholder);
            } else {
                s.grid.insertBefore(s.placeholder, otherCards[insertIdx]);
            }
        }
    }

    function _coZoneEditorOnTouchEnd(card, data) {
        if (!_coZoneEditorTouchState || !_coZoneEditorTouchState.placeholder) return;
        var s = _coZoneEditorTouchState;

        document.body.style.overscrollBehavior = '';

        // Restore card styles
        s.card.classList.remove('cwoc-touch-dragging');
        s.card.style.position = '';
        s.card.style.left = '';
        s.card.style.top = '';
        s.card.style.width = '';
        s.card.style.zIndex = '';
        s.card.style.opacity = '';
        s.card.style.boxShadow = '';
        s.card.style.transition = '';
        s.card.style.pointerEvents = '';

        // Insert card where placeholder is
        s.placeholder.parentNode.insertBefore(s.card, s.placeholder);
        s.placeholder.remove();

        _coZoneEditorTouchState = null;
        _coZoneEditorPersistOrder();
    }

    // ── Persist Zone Editor Object Order ──

    /**
     * Persist the new object order within the zone editor.
     * Reads ALL object IDs from all grids in DOM order and sends them to
     * PUT /api/custom-objects/zone/{zone_id}/reorder.
     * This maintains sub_type grouping since we read groups in DOM order.
     */
    async function _coZoneEditorPersistOrder() {
        if (!_coZoneEditorZone) return;

        var container = document.getElementById('coZoneEditorObjects');
        if (!container) return;

        // Gather all object IDs from all grids in DOM order (preserves group ordering)
        var allCards = container.querySelectorAll('.co-zone-editor-card[data-object-id]');
        var orderedIds = Array.from(allCards).map(function (c) { return c.dataset.objectId; });

        if (orderedIds.length === 0) return;

        try {
            var response = await fetch('/api/custom-objects/zone/' + encodeURIComponent(_coZoneEditorZone.zone_id) + '/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ object_ids: orderedIds })
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to save object order');
            }

            // Update local state to match new order
            var objMap = {};
            _coZoneEditorObjects.forEach(function (o) { objMap[o.id] = o; });
            _coZoneEditorObjects = orderedIds
                .map(function (id) { return objMap[id]; })
                .filter(function (o) { return !!o; });

            // Update zone_sort_order in local state
            _coZoneEditorObjects.forEach(function (o, idx) {
                o.zone_sort_order = idx + 1;
            });

        } catch (e) {
            console.error('[CustomObjects] Zone editor reorder error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to save object order', 'error');
            // Re-fetch to restore correct state
            _coZoneEditorFetchObjects();
        }
    }

    // ── Indicators Zone Section ────────────────────────────────────────

    var _coIndicatorsList = null;
    var _coIndicatorObjects = []; // Objects assigned to indicators_zone
    var _coIndicatorDraggedEl = null; // Tracks the currently dragged indicator row (HTML5)
    var _coIndicatorTouchState = null; // Tracks touch drag state

    /**
     * Fetch objects assigned to indicators_zone and render the listing.
     */
    async function _coFetchIndicators() {
        _coIndicatorsList = document.getElementById('coIndicatorsList');
        if (!_coIndicatorsList) return;

        try {
            var response = await fetch('/api/custom-objects/zone/indicators_zone');
            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to load indicators');
            }
            _coIndicatorObjects = await response.json();
            _coRenderIndicatorsList();
        } catch (e) {
            console.error('[CustomObjects] Fetch indicators error:', e);
            if (_coIndicatorsList) {
                _coIndicatorsList.innerHTML = '<div class="co-zones-empty">Failed to load indicators.</div>';
            }
        }
    }

    /**
     * Render the indicators zone objects list with drag handles.
     * Objects are displayed in sort_order (already sorted by API).
     */
    function _coRenderIndicatorsList() {
        if (!_coIndicatorsList) return;

        if (!_coIndicatorObjects || _coIndicatorObjects.length === 0) {
            _coIndicatorsList.innerHTML = '<div class="co-zones-empty">No objects assigned to indicators zone.</div>';
            return;
        }

        _coIndicatorsList.innerHTML = '';

        _coIndicatorObjects.forEach(function (obj) {
            var row = document.createElement('div');
            row.className = 'co-indicator-row';
            row.dataset.objectId = obj.id;
            row.draggable = true;

            // Drag handle
            var handleEl = document.createElement('span');
            handleEl.className = 'co-indicator-drag-handle';
            handleEl.innerHTML = '<i class="fas fa-grip-vertical"></i>';
            handleEl.title = 'Drag to reorder';
            row.appendChild(handleEl);

            // Object name
            var nameEl = document.createElement('span');
            nameEl.className = 'co-indicator-row-name';
            nameEl.textContent = obj.name;
            row.appendChild(nameEl);

            // Sub-type badge (if present)
            if (obj.sub_type) {
                var badgeEl = document.createElement('span');
                badgeEl.className = 'co-indicator-row-badge';
                badgeEl.textContent = obj.sub_type;
                row.appendChild(badgeEl);
            }

            _coIndicatorsList.appendChild(row);
        });

        // Enable drag-to-reorder (desktop + mobile)
        _coInitIndicatorDragReorder();
    }

    /**
     * Initialize drag-to-reorder for indicator rows.
     * Supports HTML5 drag (desktop) and touch hold + move (mobile via shared-touch.js).
     */
    function _coInitIndicatorDragReorder() {
        if (!_coIndicatorsList) return;

        // Remove previous HTML5 drag listeners (idempotent re-init)
        if (_coIndicatorsList._indicatorDragCleanup) {
            _coIndicatorsList._indicatorDragCleanup();
        }

        // ── HTML5 Drag (Desktop) ──
        _coIndicatorsList.addEventListener('dragstart', _coIndicatorOnDragStart);
        _coIndicatorsList.addEventListener('dragover', _coIndicatorOnDragOver);
        _coIndicatorsList.addEventListener('dragend', _coIndicatorOnDragEnd);
        _coIndicatorsList.addEventListener('drop', _coIndicatorOnDrop);

        _coIndicatorsList._indicatorDragCleanup = function () {
            _coIndicatorsList.removeEventListener('dragstart', _coIndicatorOnDragStart);
            _coIndicatorsList.removeEventListener('dragover', _coIndicatorOnDragOver);
            _coIndicatorsList.removeEventListener('dragend', _coIndicatorOnDragEnd);
            _coIndicatorsList.removeEventListener('drop', _coIndicatorOnDrop);
        };

        // ── Touch Drag (Mobile) ──
        var rows = _coIndicatorsList.querySelectorAll('.co-indicator-row[data-object-id]');
        rows.forEach(function (row) {
            if (typeof enableTouchDrag === 'function') {
                enableTouchDrag(row, {
                    onStart: function (data) { _coIndicatorOnTouchStart(row, data); },
                    onMove: function (data) { _coIndicatorOnTouchMove(row, data); },
                    onEnd: function (data) { _coIndicatorOnTouchEnd(row, data); }
                });
            }
        });
    }

    // ── HTML5 Drag Handlers (Indicators) ──

    function _coIndicatorOnDragStart(e) {
        var row = e.target.closest('.co-indicator-row[data-object-id]');
        if (!row) return;
        _coIndicatorDraggedEl = row;
        e.dataTransfer.setData('text/plain', row.dataset.objectId);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('cwoc-dragging');
    }

    function _coIndicatorOnDragOver(e) {
        if (!_coIndicatorDraggedEl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        var row = e.target.closest('.co-indicator-row[data-object-id]');
        // Clear all indicators
        _coIndicatorsList.querySelectorAll('.co-indicator-row').forEach(function (r) {
            r.style.borderTop = '';
            r.style.borderBottom = '';
        });
        if (row && row !== _coIndicatorDraggedEl) {
            var rect = row.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                row.style.borderTop = '3px solid #8b5a2b';
            } else {
                row.style.borderBottom = '3px solid #8b5a2b';
            }
        }
    }

    function _coIndicatorOnDragEnd() {
        if (_coIndicatorDraggedEl) {
            _coIndicatorDraggedEl.classList.remove('cwoc-dragging');
            _coIndicatorDraggedEl = null;
        }
        _coIndicatorsList.querySelectorAll('.co-indicator-row').forEach(function (r) {
            r.style.borderTop = '';
            r.style.borderBottom = '';
        });
    }

    function _coIndicatorOnDrop(e) {
        if (!_coIndicatorDraggedEl) return;
        e.preventDefault();

        var targetRow = e.target.closest('.co-indicator-row[data-object-id]');
        if (!targetRow || targetRow === _coIndicatorDraggedEl) {
            _coIndicatorOnDragEnd();
            return;
        }

        // Determine new order from DOM
        var rows = Array.from(_coIndicatorsList.querySelectorAll('.co-indicator-row[data-object-id]'));
        var ids = rows.map(function (r) { return r.dataset.objectId; });

        var fromId = _coIndicatorDraggedEl.dataset.objectId;
        var toId = targetRow.dataset.objectId;
        var fromIdx = ids.indexOf(fromId);
        var toIdx = ids.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) { _coIndicatorOnDragEnd(); return; }

        // Determine if dropping above or below
        var rect = targetRow.getBoundingClientRect();
        if (e.clientY > rect.top + rect.height / 2) toIdx++;

        ids.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx--;
        ids.splice(toIdx, 0, fromId);

        _coIndicatorOnDragEnd();
        _coIndicatorPersistOrder(ids);
    }

    // ── Touch Drag Handlers (Indicators) ──

    function _coIndicatorOnTouchStart(row, data) {
        row.classList.remove('cwoc-touch-dragging');

        var rect = row.getBoundingClientRect();

        // Create placeholder to hold the row's space
        var placeholder = document.createElement('div');
        placeholder.className = 'co-indicator-drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        row.parentNode.insertBefore(placeholder, row);

        // Float the row under the finger
        row.style.position = 'fixed';
        row.style.left = rect.left + 'px';
        row.style.top = rect.top + 'px';
        row.style.width = rect.width + 'px';
        row.style.zIndex = '10000';
        row.style.opacity = '0.9';
        row.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        row.style.transition = 'none';
        row.style.pointerEvents = 'none';

        document.body.style.overscrollBehavior = 'contain';

        _coIndicatorTouchState = {
            row: row,
            placeholder: placeholder,
            offsetX: data.clientX - rect.left,
            offsetY: data.clientY - rect.top,
            lastInsertIdx: -1
        };
    }

    function _coIndicatorOnTouchMove(row, data) {
        if (!_coIndicatorTouchState || !_coIndicatorTouchState.placeholder) return;
        var s = _coIndicatorTouchState;

        // Move floating row to follow finger
        s.row.style.left = (data.clientX - s.offsetX) + 'px';
        s.row.style.top = (data.clientY - s.offsetY) + 'px';

        // Find insert position among other rows
        var allRows = Array.from(_coIndicatorsList.querySelectorAll('.co-indicator-row[data-object-id]'));
        var otherRows = allRows.filter(function (r) { return r !== s.row; });

        var insertIdx = otherRows.length;
        for (var i = 0; i < otherRows.length; i++) {
            var r = otherRows[i].getBoundingClientRect();
            if (data.clientY < r.top + r.height / 2) {
                insertIdx = i;
                break;
            }
        }

        if (insertIdx !== s.lastInsertIdx) {
            s.lastInsertIdx = insertIdx;
            if (insertIdx >= otherRows.length) {
                _coIndicatorsList.appendChild(s.placeholder);
            } else {
                _coIndicatorsList.insertBefore(s.placeholder, otherRows[insertIdx]);
            }
        }
    }

    function _coIndicatorOnTouchEnd(row, data) {
        if (!_coIndicatorTouchState || !_coIndicatorTouchState.placeholder) return;
        var s = _coIndicatorTouchState;

        document.body.style.overscrollBehavior = '';

        // Restore row styles
        s.row.classList.remove('cwoc-touch-dragging');
        s.row.style.position = '';
        s.row.style.left = '';
        s.row.style.top = '';
        s.row.style.width = '';
        s.row.style.zIndex = '';
        s.row.style.opacity = '';
        s.row.style.boxShadow = '';
        s.row.style.transition = '';
        s.row.style.pointerEvents = '';

        // Insert row where placeholder is
        s.placeholder.parentNode.insertBefore(s.row, s.placeholder);
        s.placeholder.remove();

        // Read new order from DOM
        var rows = Array.from(_coIndicatorsList.querySelectorAll('.co-indicator-row[data-object-id]'));
        var ids = rows.map(function (r) { return r.dataset.objectId; });

        _coIndicatorTouchState = null;
        _coIndicatorPersistOrder(ids);
    }

    // ── Persist Indicator Order ──

    /**
     * Persist the new indicator order via PUT /api/custom-objects/zone/indicators_zone/reorder.
     * @param {string[]} orderedObjectIds - Object IDs in desired order
     */
    async function _coIndicatorPersistOrder(orderedObjectIds) {
        try {
            var response = await fetch('/api/custom-objects/zone/indicators_zone/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ object_ids: orderedObjectIds })
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to save indicator order');
            }

            // Update local state to match new order
            var objMap = {};
            _coIndicatorObjects.forEach(function (o) { objMap[o.id] = o; });
            _coIndicatorObjects = orderedObjectIds
                .map(function (id) { return objMap[id]; })
                .filter(function (o) { return !!o; });

        } catch (e) {
            console.error('[CustomObjects] Indicator reorder error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to save indicator order', 'error');
            // Re-fetch to restore correct state
            _coFetchIndicators();
        }
    }

    // ── Zone Preview ───────────────────────────────────────────────────

    /**
     * Toggle the zone preview panel visibility.
     * If hidden, renders the preview; if visible, hides it.
     */
    async function _coToggleZonePreview() {
        var container = document.getElementById('coZonePreviewContainer');
        if (!container) return;

        if (container.style.display !== 'none') {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        container.innerHTML = '<div class="co-zones-empty">Loading preview...</div>';

        await _coRenderZonePreview();
    }

    /**
     * Render the zone preview panel using the same layout as the chit editor.
     * Fetches user settings for unit_system, then renders a collapsible Zone_Panel
     * with fields grouped by sub_type, appropriate input types, range highlighting,
     * and unit labels.
     */
    async function _coRenderZonePreview() {
        var container = document.getElementById('coZonePreviewContainer');
        if (!container || !_coZoneEditorZone) return;

        // Fetch user settings for unit_system
        var settings = {};
        try {
            settings = await getCachedSettings();
        } catch (e) {
            settings = {};
        }
        var unitSystem = settings.unit_system || 'imperial';

        // Use the already-fetched objects from the zone editor
        var objects = _coZoneEditorObjects || [];

        container.innerHTML = '';

        // Label
        var label = document.createElement('div');
        label.className = 'co-zone-preview-label';
        label.textContent = 'Preview — how this zone appears in the chit editor:';
        container.appendChild(label);

        // Build the zone panel (mimics the chit editor Zone_Panel)
        var panel = document.createElement('div');
        panel.className = 'co-zone-preview-panel';

        // Zone header (collapsible)
        var header = document.createElement('div');
        header.className = 'zone-header';
        var titleEl = document.createElement('h2');
        titleEl.textContent = '📋 ' + (_coZoneEditorZone.name || 'Untitled Zone');
        header.appendChild(titleEl);
        var toggleIcon = document.createElement('span');
        toggleIcon.className = 'zone-toggle-icon';
        toggleIcon.textContent = '🔽';
        header.appendChild(toggleIcon);
        panel.appendChild(header);

        // Zone body
        var body = document.createElement('div');
        body.className = 'zone-body';
        body.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:10px 14px;';
        panel.appendChild(body);

        // Wire collapse toggle
        header.addEventListener('click', function () {
            if (body.style.display === 'none') {
                body.style.display = 'flex';
                toggleIcon.style.transform = 'rotate(0deg)';
            } else {
                body.style.display = 'none';
                toggleIcon.style.transform = 'rotate(-90deg)';
            }
        });

        // Filter objects by conditional_display
        var visibleObjects = objects.filter(function (obj) {
            return _coPreviewEvaluateConditionalDisplay(obj.conditional_display, settings);
        });

        if (visibleObjects.length === 0) {
            var emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'font-size:0.9em;color:#6b4e31;font-style:italic;padding:8px 0;';
            emptyMsg.textContent = 'No visible fields (all hidden by conditional display rules).';
            body.appendChild(emptyMsg);
            container.appendChild(panel);
            return;
        }

        // Sort by zone_sort_order
        var sorted = visibleObjects.slice().sort(function (a, b) {
            var aSort = (a.zone_sort_order != null) ? a.zone_sort_order : 9999;
            var bSort = (b.zone_sort_order != null) ? b.zone_sort_order : 9999;
            return aSort - bSort;
        });

        // Group by sub_type (alphabetical)
        var groups = {};
        var groupOrder = [];
        sorted.forEach(function (obj) {
            var groupKey = obj.sub_type || 'Other';
            if (!groups[groupKey]) {
                groups[groupKey] = [];
                groupOrder.push(groupKey);
            }
            groups[groupKey].push(obj);
        });
        groupOrder.sort(function (a, b) { return a.localeCompare(b); });

        // Render each group as a collapsible section with 3-column grid
        groupOrder.forEach(function (groupName) {
            var groupItems = groups[groupName];

            // Section header
            var sectionHeader = document.createElement('div');
            sectionHeader.className = 'indicator-section-header';
            sectionHeader.innerHTML = '<span class="indicator-section-arrow">▼</span> ' + _coEscape(groupName);
            body.appendChild(sectionHeader);

            // Section body (3-column grid)
            var sectionBody = document.createElement('div');
            sectionBody.className = 'indicator-section-body';
            body.appendChild(sectionBody);

            // Wire collapse toggle for section
            (function (hdr, bdy) {
                hdr.addEventListener('click', function () {
                    var arrow = hdr.querySelector('.indicator-section-arrow');
                    if (bdy.style.display === 'none') {
                        bdy.style.display = '';
                        if (arrow) arrow.textContent = '▼';
                    } else {
                        bdy.style.display = 'none';
                        if (arrow) arrow.textContent = '▶';
                    }
                });
            })(sectionHeader, sectionBody);

            // Render fields
            groupItems.forEach(function (obj) {
                var fieldEl = _coPreviewRenderField(obj, unitSystem);
                sectionBody.appendChild(fieldEl);
            });
        });

        container.appendChild(panel);
    }

    /**
     * Render a single preview field (mirrors _renderIndicatorField from editor-health.js).
     * @param {object} obj - Custom Object
     * @param {string} unitSystem - 'imperial' or 'metric'
     * @returns {HTMLElement}
     */
    function _coPreviewRenderField(obj, unitSystem) {
        var row = document.createElement('div');
        row.className = 'indicator-field';

        // Label
        var label = document.createElement('label');
        label.className = 'indicator-label';
        label.textContent = obj.name;
        row.appendChild(label);

        var unitLabel = _coPreviewGetUnitLabel(obj, unitSystem);

        if (obj.value_type === 'boolean') {
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'indicator-checkbox';
            row.appendChild(cb);
        } else if (obj.value_type === 'string') {
            var textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'indicator-input indicator-text';
            textInput.placeholder = '—';
            row.appendChild(textInput);
        } else {
            // Numeric (integer or decimal)
            var numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.className = 'indicator-input indicator-numeric';
            numInput.step = (obj.value_type === 'integer') ? '1' : 'any';
            numInput.placeholder = '—';

            // Wire real-time range highlighting
            (function (input, rangeMin, rangeMax) {
                input.addEventListener('input', function () {
                    input.classList.remove('indicator-range-high', 'indicator-range-low');
                    var cls = _coPreviewGetRangeHighlightClass(input.value, rangeMin, rangeMax);
                    if (cls) input.classList.add(cls);
                });
            })(numInput, obj.range_min, obj.range_max);

            row.appendChild(numInput);
        }

        // Unit label (if any, and not boolean)
        if (unitLabel && obj.value_type !== 'boolean') {
            var unitSpan = document.createElement('span');
            unitSpan.className = 'indicator-unit';
            unitSpan.textContent = unitLabel;
            row.appendChild(unitSpan);
        }

        return row;
    }

    /**
     * Evaluate a conditional_display rule against user settings.
     * Pure function — mirrors _evaluateConditionalDisplay from editor-health.js.
     * @param {object|null} rule - e.g. {"setting": "sex", "equals": "Woman"}
     * @param {object} settings - user settings object
     * @returns {boolean}
     */
    function _coPreviewEvaluateConditionalDisplay(rule, settings) {
        if (!rule) return true;
        return settings[rule.setting] === rule.equals;
    }

    /**
     * Get the appropriate unit label based on the user's unit system.
     * Pure function — mirrors _getUnitLabel from editor-health.js.
     * @param {object} obj - Custom Object with units and metric_units fields
     * @param {string} unitSystem - 'imperial' or 'metric'
     * @returns {string}
     */
    function _coPreviewGetUnitLabel(obj, unitSystem) {
        if (unitSystem === 'metric' && obj.metric_units) return obj.metric_units;
        return obj.units || '';
    }

    /**
     * Determine the CSS class for range highlighting.
     * Pure function — mirrors _getRangeHighlightClass from editor-health.js.
     * @param {*} value - current input value
     * @param {number|null} rangeMin - acceptable range minimum
     * @param {number|null} rangeMax - acceptable range maximum
     * @returns {string} CSS class name or empty string
     */
    function _coPreviewGetRangeHighlightClass(value, rangeMin, rangeMax) {
        if (rangeMin == null && rangeMax == null) return '';
        if (value == null || value === '') return '';
        var numVal = parseFloat(value);
        if (isNaN(numVal)) return '';
        if (rangeMax != null && numVal > rangeMax) return 'indicator-range-high';
        if (rangeMin != null && numVal < rangeMin) return 'indicator-range-low';
        return '';
    }

    // ── Utilities ───────────────────────────────────────────────────────

    function _coEscape(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
