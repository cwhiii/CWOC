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

    // ── DOM References ──────────────────────────────────────────────────
    var _coListContainer = null;
    var _coTypeFilter = null;
    var _coSearchInput = null;
    var _coCreateBtn = null;

    // ── Initialization ──────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        // Clone templates and append to body
        _coCloneTemplates();

        // Cache DOM references
        _coListContainer = document.getElementById('coListContainer');
        _coTypeFilter = document.getElementById('coTypeFilter');
        _coSearchInput = document.getElementById('coSearchInput');
        _coCreateBtn = document.getElementById('coCreateBtn');

        // Wire up filter controls
        if (_coTypeFilter) _coTypeFilter.addEventListener('change', _coApplyFilters);
        if (_coSearchInput) _coSearchInput.addEventListener('input', _coApplyFilters);

        // Wire up create button
        if (_coCreateBtn) _coCreateBtn.addEventListener('click', function () {
            _coOpenEditModal(null);
        });

        // Wire up Quick Log button
        var quickLogBtn = document.getElementById('coQuickLogBtn');
        if (quickLogBtn) quickLogBtn.addEventListener('click', _coQuickLog);

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
    });


    // ── Template Cloning ────────────────────────────────────────────────

    function _coCloneTemplates() {
        var templates = ['tmpl-co-edit-modal', 'tmpl-co-zone-modal', 'tmpl-co-delete-modal'];
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

        // Group by type
        var groups = {};
        _coFilteredObjects.forEach(function (obj) {
            var type = obj.type || 'Uncategorized';
            if (!groups[type]) groups[type] = [];
            groups[type].push(obj);
        });

        // Sort types alphabetically
        var sortedTypes = Object.keys(groups).sort();

        _coListContainer.innerHTML = '';
        sortedTypes.forEach(function (type) {
            var groupEl = document.createElement('div');
            groupEl.className = 'co-type-group';

            // Header
            var header = document.createElement('div');
            header.className = 'co-type-group-header';
            header.innerHTML = '<span>' + _coEscape(type) + '</span>'
                + '<span class="co-type-count">(' + groups[type].length + ')</span>';
            groupEl.appendChild(header);

            // Rows
            groups[type].forEach(function (obj) {
                groupEl.appendChild(_coCreateRow(obj));
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
        var nameText = _coEscape(obj.name);
        if (obj.category) {
            nameText += '<span class="co-object-category">(' + _coEscape(obj.category) + ')</span>';
        }
        nameEl.innerHTML = nameText;
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

        // Populate datalists for type and category autocomplete
        _coPopulateDatalist('coTypeDatalist', 'type');
        _coPopulateDatalist('coCategoryDatalist', 'category');

        // Populate fields
        var nameInput = document.getElementById('coEditName');
        var typeInput = document.getElementById('coEditType');
        var subTypeInput = document.getElementById('coEditSubType');
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
            if (subTypeInput) subTypeInput.value = obj.sub_type || '';
            if (categoryInput) categoryInput.value = obj.category || '';
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
            if (subTypeInput) subTypeInput.value = '';
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
        var subTypeInput = document.getElementById('coEditSubType');
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

        var subType = subTypeInput ? subTypeInput.value.trim() : '';
        if (subType) payload.sub_type = subType;

        var category = categoryInput ? categoryInput.value.trim() : '';
        if (category) payload.category = category;

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

    // ── Quick Log ──────────────────────────────────────────────────────

    /**
     * Create a Quick Log chit (point_in_time = now, status = "Complete")
     * and navigate to the editor to fill in health indicators.
     */
    async function _coQuickLog() {
        try {
            var now = new Date().toISOString();
            var payload = {
                point_in_time: now,
                status: 'Complete'
            };

            var response = await fetch('/api/chits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                var err = await response.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Failed to create Quick Log chit');
            }

            var data = await response.json();
            var newChitId = data.id;
            window.location.href = '/editor?id=' + encodeURIComponent(newChitId);
        } catch (e) {
            console.error('[CustomObjects] Quick Log error:', e);
            if (typeof cwocToast === 'function') cwocToast('Failed to create Quick Log chit', 'error');
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

    // ── ESC Key Handler ─────────────────────────────────────────────────

    function _coHandleEsc(e) {
        if (e.key !== 'Escape') return;

        // Check modals from innermost to outermost
        var deleteOverlay = document.getElementById('coDeleteModalOverlay');
        if (deleteOverlay && deleteOverlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            _coCloseDeleteModal();
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

    // ── Utilities ───────────────────────────────────────────────────────

    function _coEscape(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
