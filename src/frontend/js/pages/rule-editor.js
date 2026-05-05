/* ═══════════════════════════════════════════════════════════════════════════
   Rule Editor Page — rule-editor.js

   Handles creating and editing rules with condition tree builder, action
   configuration, trigger selection, and save/cancel via CwocSaveSystem.
   Loaded by rule-editor.html.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── State ──
var _ruleId = null;       // null = new rule, string = editing existing
var _conditionTree = null; // root group node
var _actions = [];         // array of action objects
var _saveSystem = null;
var _nodeIdCounter = 0;

// ── Helpers ──
function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function _nextNodeId() {
    return 'node-' + (++_nodeIdCounter);
}

// ── Tag Picker Cache ──
var _cachedTagList = null;

async function _loadTagList() {
    try {
        var settings = await getCachedSettings();
        var tags = settings.tags || [];
        _cachedTagList = tags
            .map(function(t) { return typeof t === 'string' ? { name: t, color: null, fontColor: null, favorite: false } : t; })
            .filter(function(t) { return t.name && !isSystemTag(t.name); });
        // Sort: favorites first, then alphabetical
        _cachedTagList.sort(function(a, b) {
            if (a.favorite && !b.favorite) return -1;
            if (!a.favorite && b.favorite) return 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    } catch (e) {
        console.error('_loadTagList error:', e);
        _cachedTagList = [];
    }
}

// ── Field Definitions by Trigger Type ──
var CHIT_FIELDS = [
    { value: 'title', label: 'Title' },
    { value: 'note', label: 'Note' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'severity', label: 'Severity' },
    { value: 'location', label: 'Location' },
    { value: 'color', label: 'Color' },
    { value: 'tags', label: 'Tags' },
    { value: 'people', label: 'People' },
    { value: 'archived', label: 'Archived' },
    { value: 'pinned', label: 'Pinned' },
    { value: 'all_day', label: 'All Day' },
    { value: 'habit', label: 'Habit' }
];

var EMAIL_FIELDS = [
    { value: 'title', label: 'Title / Subject' },
    { value: 'note', label: 'Note / Body' },
    { value: 'email_from', label: 'Email From' },
    { value: 'email_subject', label: 'Email Subject' },
    { value: 'email_body_text', label: 'Email Body' },
    { value: 'email_folder', label: 'Email Folder' },
    { value: 'email_read', label: 'Email Read' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'tags', label: 'Tags' },
    { value: 'people', label: 'People' },
    { value: 'location', label: 'Location' }
];

var CONTACT_FIELDS = [
    { value: 'given_name', label: 'First Name' },
    { value: 'surname', label: 'Last Name' },
    { value: 'organization', label: 'Organization' },
    { value: 'tags', label: 'Tags' },
    { value: 'emails', label: 'Emails' },
    { value: 'phones', label: 'Phones' },
    { value: 'addresses', label: 'Addresses' }
];

var HA_STATE_CHANGE_FIELDS = [
    { value: 'ha_entity_id', label: 'Entity ID' },
    { value: 'old_state', label: 'Old State' },
    { value: 'new_state', label: 'New State' },
    { value: 'attributes', label: 'Attributes' }
];

var OPERATORS = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'regex_match', label: 'regex match' },
    { value: 'tag_present', label: 'tag is present' },
    { value: 'tag_not_present', label: 'tag is not present' },
    { value: 'person_on_chit', label: 'person is on chit' },
    { value: 'person_not_on_chit', label: 'person is not on chit' }
];

// Operators that don't need a value input
var NO_VALUE_OPERATORS = ['is_empty', 'is_not_empty'];

// ── Action Type Definitions ──
var CHIT_ACTION_TYPES = [
    { value: 'add_tag', label: 'Add Tag', params: [{ key: 'tag', label: 'Tag', type: 'tag' }] },
    { value: 'remove_tag', label: 'Remove Tag', params: [{ key: 'tag', label: 'Tag', type: 'tag' }] },
    { value: 'set_status', label: 'Set Status', params: [{ key: 'status', label: 'Status', type: 'select', options: ['ToDo', 'In Progress', 'Blocked', 'Complete'] }] },
    { value: 'set_priority', label: 'Set Priority', params: [{ key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }] },
    { value: 'set_severity', label: 'Set Severity', params: [{ key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }] },
    { value: 'set_color', label: 'Set Color', params: [{ key: 'color', label: 'Color', type: 'color' }] },
    { value: 'set_location', label: 'Set Location', params: [{ key: 'location', label: 'Location', type: 'text' }] },
    { value: 'add_person', label: 'Add Person', params: [{ key: 'person', label: 'Person Name', type: 'text' }] },
    { value: 'archive', label: 'Archive', params: [] },
    { value: 'move_to_trash', label: 'Move to Trash', params: [] },
    { value: 'send_notification', label: 'Send Notification', params: [{ key: 'message', label: 'Message', type: 'text' }] },
    { value: 'mark_email_read', label: 'Mark Email Read', params: [] },
    { value: 'mark_email_unread', label: 'Mark Email Unread', params: [] },
    { value: 'move_email_to_folder', label: 'Move Email to Folder', params: [{ key: 'folder', label: 'Folder', type: 'text' }] },
    { value: 'add_matching_contacts_as_people', label: 'Add Matching Contacts as People', params: [{ key: 'match_field', label: 'Match Field', type: 'select', options: ['city', 'state', 'country'] }] },
    { value: 'call_ha_service', label: '🏠 Call HA Service', params: null },
    { value: 'fire_ha_event', label: '🏠 Fire HA Event', params: null }
];

// ── HA Action Helpers ──
var _haConfigured = null; // null = unknown, true/false after check
var _haEntitiesCache = null;
var _haServicesCache = null;

var HA_EVENT_TYPE_SUGGESTIONS = [
    'cwoc_chit_created',
    'cwoc_chit_updated',
    'cwoc_email_received',
    'cwoc_status_changed',
    'cwoc_tag_added'
];

async function _checkHaConfigured() {
    if (_haConfigured !== null) return _haConfigured;
    try {
        var resp = await fetch('/api/ha/config');
        if (!resp.ok) { _haConfigured = false; return false; }
        var data = await resp.json();
        _haConfigured = !!(data.ha_base_url);
    } catch (e) {
        _haConfigured = false;
    }
    return _haConfigured;
}

async function _fetchHaEntities() {
    try {
        var resp = await fetch('/api/ha/entities');
        if (resp.status === 400) { _haConfigured = false; return null; }
        if (!resp.ok) return null;
        var data = await resp.json();
        _haEntitiesCache = data;
        return data;
    } catch (e) {
        return null;
    }
}

async function _fetchHaServices() {
    try {
        var resp = await fetch('/api/ha/services');
        if (resp.status === 400) { _haConfigured = false; return null; }
        if (!resp.ok) return null;
        var data = await resp.json();
        _haServicesCache = data;
        return data;
    } catch (e) {
        return null;
    }
}

function _renderHaKeyValueEditor(pairs, onChange) {
    var wrapper = document.createElement('div');
    wrapper.className = 'ha-kv-editor';

    function rebuild() {
        wrapper.innerHTML = '';
        pairs.forEach(function(pair, i) {
            var row = document.createElement('div');
            row.className = 'ha-kv-row';

            var keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.placeholder = 'Key';
            keyInput.value = pair.key || '';
            keyInput.className = 'ha-kv-key';
            keyInput.oninput = function() {
                pair.key = this.value;
                onChange();
            };

            var valInput = document.createElement('input');
            valInput.type = 'text';
            valInput.placeholder = 'Value (supports {chit_title}, etc.)';
            valInput.value = pair.value || '';
            valInput.className = 'ha-kv-value';
            valInput.oninput = function() {
                pair.value = this.value;
                onChange();
            };

            var removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'ha-kv-remove';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove';
            removeBtn.onclick = function() {
                pairs.splice(i, 1);
                onChange();
                rebuild();
            };

            row.appendChild(keyInput);
            row.appendChild(valInput);
            row.appendChild(removeBtn);
            wrapper.appendChild(row);
        });

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ha-kv-add';
        addBtn.textContent = '+ Add Field';
        addBtn.onclick = function() {
            pairs.push({ key: '', value: '' });
            onChange();
            rebuild();
        };
        wrapper.appendChild(addBtn);
    }

    rebuild();
    return wrapper;
}

function _buildHaJsonPreview(action) {
    var pre = document.createElement('pre');
    pre.className = 'ha-json-preview';
    _updateHaJsonPreview(pre, action);
    return pre;
}

function _updateHaJsonPreview(pre, action) {
    var payload = {};
    if (action.type === 'call_ha_service') {
        payload.domain = action.params.domain || '';
        payload.service = action.params.service || '';
        if (action.params.entity_id) payload.entity_id = action.params.entity_id;
        if (action.params.service_data && action.params.service_data.length > 0) {
            var sd = {};
            action.params.service_data.forEach(function(p) {
                if (p.key) sd[p.key] = p.value || '';
            });
            if (Object.keys(sd).length > 0) payload.service_data = sd;
        }
    } else if (action.type === 'fire_ha_event') {
        payload.event_type = action.params.event_type || '';
        if (action.params.event_data && action.params.event_data.length > 0) {
            var ed = {};
            action.params.event_data.forEach(function(p) {
                if (p.key) ed[p.key] = p.value || '';
            });
            if (Object.keys(ed).length > 0) payload.event_data = ed;
        }
    }
    pre.textContent = JSON.stringify(payload, null, 2);
}

function _renderHaServiceAction(action, container) {
    // Ensure params structure
    if (!action.params) action.params = {};
    if (!action.params.domain) action.params.domain = '';
    if (!action.params.service) action.params.service = '';
    if (!action.params.entity_id) action.params.entity_id = '';
    if (!action.params.service_data) action.params.service_data = [];

    var panel = document.createElement('div');
    panel.className = 'ha-action-panel';

    // HA not configured warning
    _checkHaConfigured().then(function(configured) {
        if (!configured) {
            var warn = panel.querySelector('.ha-not-configured');
            if (warn) warn.style.display = '';
        }
    });

    var warnDiv = document.createElement('div');
    warnDiv.className = 'ha-not-configured';
    warnDiv.style.display = 'none';
    warnDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Home Assistant is not configured. <a href="/frontend/html/settings.html">Configure it in Settings → Home Assistant.</a>';
    panel.appendChild(warnDiv);

    // Domain input
    var domainLabel = document.createElement('label');
    domainLabel.textContent = 'Domain';
    domainLabel.className = 'ha-field-label';
    panel.appendChild(domainLabel);

    var domainInput = document.createElement('input');
    domainInput.type = 'text';
    domainInput.placeholder = 'e.g. light, switch, notify';
    domainInput.value = action.params.domain;
    domainInput.className = 'ha-field-input';
    domainInput.oninput = function() {
        action.params.domain = this.value;
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    };
    panel.appendChild(domainInput);

    // Service input + Fetch Services button
    var serviceLabel = document.createElement('label');
    serviceLabel.textContent = 'Service';
    serviceLabel.className = 'ha-field-label';
    panel.appendChild(serviceLabel);

    var serviceRow = document.createElement('div');
    serviceRow.className = 'ha-field-row';

    var serviceInput = document.createElement('input');
    serviceInput.type = 'text';
    serviceInput.placeholder = 'e.g. turn_on, turn_off, send_message';
    serviceInput.value = action.params.service;
    serviceInput.className = 'ha-field-input';
    serviceInput.oninput = function() {
        action.params.service = this.value;
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    };
    serviceRow.appendChild(serviceInput);

    var fetchSvcBtn = document.createElement('button');
    fetchSvcBtn.type = 'button';
    fetchSvcBtn.className = 'ha-fetch-btn';
    fetchSvcBtn.textContent = 'Fetch Services';
    fetchSvcBtn.onclick = async function() {
        fetchSvcBtn.disabled = true;
        fetchSvcBtn.textContent = 'Loading…';
        var services = await _fetchHaServices();
        fetchSvcBtn.disabled = false;
        fetchSvcBtn.textContent = 'Fetch Services';
        if (!services) {
            cwocToast('Could not fetch HA services. Is HA configured?', 'error');
            return;
        }
        _showHaServicePicker(services, domainInput, serviceInput, action, jsonPreview);
    };
    serviceRow.appendChild(fetchSvcBtn);
    panel.appendChild(serviceRow);

    // Entity ID input + Fetch Entities button
    var entityLabel = document.createElement('label');
    entityLabel.textContent = 'Entity ID';
    entityLabel.className = 'ha-field-label';
    panel.appendChild(entityLabel);

    var entityRow = document.createElement('div');
    entityRow.className = 'ha-field-row';

    var entityInput = document.createElement('input');
    entityInput.type = 'text';
    entityInput.placeholder = 'e.g. light.living_room';
    entityInput.value = action.params.entity_id;
    entityInput.className = 'ha-field-input';
    entityInput.oninput = function() {
        action.params.entity_id = this.value;
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    };
    entityRow.appendChild(entityInput);

    var fetchEntBtn = document.createElement('button');
    fetchEntBtn.type = 'button';
    fetchEntBtn.className = 'ha-fetch-btn';
    fetchEntBtn.textContent = 'Fetch Entities';
    fetchEntBtn.onclick = async function() {
        fetchEntBtn.disabled = true;
        fetchEntBtn.textContent = 'Loading…';
        var entities = await _fetchHaEntities();
        fetchEntBtn.disabled = false;
        fetchEntBtn.textContent = 'Fetch Entities';
        if (!entities) {
            cwocToast('Could not fetch HA entities. Is HA configured?', 'error');
            return;
        }
        _showHaEntityPicker(entities, entityInput, action, jsonPreview);
    };
    entityRow.appendChild(fetchEntBtn);
    panel.appendChild(entityRow);

    // Service Data key-value editor
    var sdLabel = document.createElement('label');
    sdLabel.textContent = 'Service Data';
    sdLabel.className = 'ha-field-label';
    panel.appendChild(sdLabel);

    var kvEditor = _renderHaKeyValueEditor(action.params.service_data, function() {
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    });
    panel.appendChild(kvEditor);

    // JSON Preview
    var previewLabel = document.createElement('label');
    previewLabel.textContent = 'JSON Preview';
    previewLabel.className = 'ha-field-label ha-preview-label';
    panel.appendChild(previewLabel);

    var jsonPreview = _buildHaJsonPreview(action);
    panel.appendChild(jsonPreview);

    container.appendChild(panel);
}

function _renderHaEventAction(action, container) {
    // Ensure params structure
    if (!action.params) action.params = {};
    if (!action.params.event_type) action.params.event_type = '';
    if (!action.params.event_data) action.params.event_data = [];

    var panel = document.createElement('div');
    panel.className = 'ha-action-panel';

    // HA not configured warning
    _checkHaConfigured().then(function(configured) {
        if (!configured) {
            var warn = panel.querySelector('.ha-not-configured');
            if (warn) warn.style.display = '';
        }
    });

    var warnDiv = document.createElement('div');
    warnDiv.className = 'ha-not-configured';
    warnDiv.style.display = 'none';
    warnDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Home Assistant is not configured. <a href="/frontend/html/settings.html">Configure it in Settings → Home Assistant.</a>';
    panel.appendChild(warnDiv);

    // Event Type input with datalist autocomplete
    var etLabel = document.createElement('label');
    etLabel.textContent = 'Event Type';
    etLabel.className = 'ha-field-label';
    panel.appendChild(etLabel);

    var etInput = document.createElement('input');
    etInput.type = 'text';
    etInput.placeholder = 'e.g. cwoc_chit_created';
    etInput.value = action.params.event_type;
    etInput.className = 'ha-field-input';
    etInput.setAttribute('list', 'ha-event-type-suggestions');
    etInput.oninput = function() {
        action.params.event_type = this.value;
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    };
    panel.appendChild(etInput);

    // Datalist for event type suggestions
    if (!document.getElementById('ha-event-type-suggestions')) {
        var datalist = document.createElement('datalist');
        datalist.id = 'ha-event-type-suggestions';
        HA_EVENT_TYPE_SUGGESTIONS.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s;
            datalist.appendChild(opt);
        });
        document.body.appendChild(datalist);
    }

    // Event Data key-value editor
    var edLabel = document.createElement('label');
    edLabel.textContent = 'Event Data';
    edLabel.className = 'ha-field-label';
    panel.appendChild(edLabel);

    var kvEditor = _renderHaKeyValueEditor(action.params.event_data, function() {
        _markDirty();
        _updateHaJsonPreview(jsonPreview, action);
    });
    panel.appendChild(kvEditor);

    // JSON Preview
    var previewLabel = document.createElement('label');
    previewLabel.textContent = 'JSON Preview';
    previewLabel.className = 'ha-field-label ha-preview-label';
    panel.appendChild(previewLabel);

    var jsonPreview = _buildHaJsonPreview(action);
    panel.appendChild(jsonPreview);

    container.appendChild(panel);
}

function _showHaEntityPicker(entities, targetInput, action, jsonPreview) {
    // Remove any existing picker
    var existing = document.querySelector('.ha-picker-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'ha-picker-overlay';

    var modal = document.createElement('div');
    modal.className = 'ha-picker-modal';

    var header = document.createElement('div');
    header.className = 'ha-picker-header';
    header.innerHTML = '<span>Select Entity</span>';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.className = 'ha-picker-close';
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search entities…';
    searchInput.className = 'ha-picker-search';
    modal.appendChild(searchInput);

    var list = document.createElement('div');
    list.className = 'ha-picker-list';

    function renderList(filter) {
        list.innerHTML = '';
        var q = (filter || '').toLowerCase();
        var filtered = entities.filter(function(e) {
            var eid = (e.entity_id || '').toLowerCase();
            var fname = (e.friendly_name || '').toLowerCase();
            return !q || eid.indexOf(q) !== -1 || fname.indexOf(q) !== -1;
        });
        if (filtered.length === 0) {
            list.innerHTML = '<div class="ha-picker-empty">No matching entities</div>';
            return;
        }
        filtered.slice(0, 100).forEach(function(ent) {
            var item = document.createElement('div');
            item.className = 'ha-picker-item';
            item.innerHTML = '<strong>' + _escHtml(ent.entity_id) + '</strong><span class="ha-picker-detail">' + _escHtml(ent.friendly_name || '') + ' — ' + _escHtml(ent.state || '') + '</span>';
            item.onclick = function() {
                targetInput.value = ent.entity_id;
                action.params.entity_id = ent.entity_id;
                _markDirty();
                _updateHaJsonPreview(jsonPreview, action);
                overlay.remove();
            };
            list.appendChild(item);
        });
    }

    searchInput.oninput = function() { renderList(this.value); };
    renderList('');

    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    searchInput.focus();

    overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
    };
}

function _showHaServicePicker(services, domainInput, serviceInput, action, jsonPreview) {
    // Remove any existing picker
    var existing = document.querySelector('.ha-picker-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'ha-picker-overlay';

    var modal = document.createElement('div');
    modal.className = 'ha-picker-modal';

    var header = document.createElement('div');
    header.className = 'ha-picker-header';
    header.innerHTML = '<span>Select Service</span>';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.className = 'ha-picker-close';
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search services…';
    searchInput.className = 'ha-picker-search';
    modal.appendChild(searchInput);

    var list = document.createElement('div');
    list.className = 'ha-picker-list';

    // Flatten services into domain.service pairs
    var flatServices = [];
    (services || []).forEach(function(domainObj) {
        var domain = domainObj.domain || '';
        (domainObj.services || []).forEach(function(svc) {
            flatServices.push({
                domain: domain,
                service: svc.service || svc,
                description: svc.description || ''
            });
        });
    });

    function renderList(filter) {
        list.innerHTML = '';
        var q = (filter || '').toLowerCase();
        var filtered = flatServices.filter(function(s) {
            var full = (s.domain + '.' + s.service).toLowerCase();
            var desc = (s.description || '').toLowerCase();
            return !q || full.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
        });
        if (filtered.length === 0) {
            list.innerHTML = '<div class="ha-picker-empty">No matching services</div>';
            return;
        }
        filtered.slice(0, 100).forEach(function(svc) {
            var item = document.createElement('div');
            item.className = 'ha-picker-item';
            item.innerHTML = '<strong>' + _escHtml(svc.domain + '.' + svc.service) + '</strong>' +
                (svc.description ? '<span class="ha-picker-detail">' + _escHtml(svc.description) + '</span>' : '');
            item.onclick = function() {
                domainInput.value = svc.domain;
                serviceInput.value = svc.service;
                action.params.domain = svc.domain;
                action.params.service = svc.service;
                _markDirty();
                _updateHaJsonPreview(jsonPreview, action);
                overlay.remove();
            };
            list.appendChild(item);
        });
    }

    searchInput.oninput = function() { renderList(this.value); };
    renderList('');

    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    searchInput.focus();

    overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
    };
}

// ── HA Trigger Entity Picker (for ha_state_change trigger) ──
function _showHaTriggerEntityPicker(entities) {
    // Remove any existing picker
    var existing = document.querySelector('.ha-picker-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'ha-picker-overlay';

    var modal = document.createElement('div');
    modal.className = 'ha-picker-modal';

    var header = document.createElement('div');
    header.className = 'ha-picker-header';
    header.innerHTML = '<span>Select Entity to Monitor</span>';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.className = 'ha-picker-close';
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search entities…';
    searchInput.className = 'ha-picker-search';
    modal.appendChild(searchInput);

    var list = document.createElement('div');
    list.className = 'ha-picker-list';

    function renderList(filter) {
        list.innerHTML = '';
        var q = (filter || '').toLowerCase();
        var filtered = entities.filter(function(e) {
            var eid = (e.entity_id || '').toLowerCase();
            var fname = (e.friendly_name || '').toLowerCase();
            return !q || eid.indexOf(q) !== -1 || fname.indexOf(q) !== -1;
        });
        if (filtered.length === 0) {
            list.innerHTML = '<div class="ha-picker-empty">No matching entities</div>';
            return;
        }
        filtered.slice(0, 100).forEach(function(ent) {
            var item = document.createElement('div');
            item.className = 'ha-picker-item';
            item.innerHTML = '<strong>' + _escHtml(ent.entity_id) + '</strong><span class="ha-picker-detail">' + _escHtml(ent.friendly_name || '') + ' — ' + _escHtml(ent.state || '') + '</span>';
            item.onclick = function() {
                document.getElementById('ha-entity-id-input').value = ent.entity_id;
                _markDirty();
                overlay.remove();
            };
            list.appendChild(item);
        });
    }

    searchInput.oninput = function() { renderList(this.value); };
    renderList('');

    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    searchInput.focus();

    overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
    };
}

// ── Deserialize HA action from stored format to editor format ──
function _deserializeHaAction(action) {
    if (action.type === 'call_ha_service' && action.params) {
        // Convert service_data object to key-value array for editor
        var sdArr = [];
        var sd = action.params.service_data;
        if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
            Object.keys(sd).forEach(function(k) {
                sdArr.push({ key: k, value: sd[k] || '' });
            });
        } else if (Array.isArray(sd)) {
            sdArr = sd;
        }
        return {
            type: action.type,
            params: {
                domain: action.params.domain || '',
                service: action.params.service || '',
                entity_id: action.params.entity_id || '',
                service_data: sdArr
            }
        };
    }
    if (action.type === 'fire_ha_event' && action.params) {
        // Convert event_data object to key-value array for editor
        var edArr = [];
        var ed = action.params.event_data;
        if (ed && typeof ed === 'object' && !Array.isArray(ed)) {
            Object.keys(ed).forEach(function(k) {
                edArr.push({ key: k, value: ed[k] || '' });
            });
        } else if (Array.isArray(ed)) {
            edArr = ed;
        }
        return {
            type: action.type,
            params: {
                event_type: action.params.event_type || '',
                event_data: edArr
            }
        };
    }
    return action;
}

// ── Get Fields for Current Trigger ──
function _getFieldsForTrigger() {
    var trigger = document.getElementById('rule-trigger').value;
    if (trigger === 'email_received') return EMAIL_FIELDS;
    if (trigger === 'contact_created' || trigger === 'contact_updated') return CONTACT_FIELDS;
    if (trigger === 'ha_state_change') return HA_STATE_CHANGE_FIELDS;
    return CHIT_FIELDS; // default for chit_created, chit_updated, scheduled, ha_webhook
}

// ── Condition Tree Builder ──

function _createDefaultTree() {
    return {
        _id: _nextNodeId(),
        type: 'group',
        operator: 'AND',
        children: []
    };
}

function _createLeaf() {
    var fields = _getFieldsForTrigger();
    return {
        _id: _nextNodeId(),
        type: 'leaf',
        field: fields.length > 0 ? fields[0].value : '',
        operator: 'equals',
        value: ''
    };
}

function _createGroup() {
    return {
        _id: _nextNodeId(),
        type: 'group',
        operator: 'AND',
        children: []
    };
}

function renderConditionTree() {
    var container = document.getElementById('condition-tree');
    if (!container) return;
    if (!_conditionTree) {
        _conditionTree = _createDefaultTree();
    }
    container.innerHTML = '';
    container.appendChild(_renderNode(_conditionTree, true));
}

function _renderNode(node, isRoot) {
    if (node.type === 'group') {
        return _renderGroup(node, isRoot);
    } else {
        return _renderLeaf(node);
    }
}

function _renderGroup(group, isRoot) {
    var div = document.createElement('div');
    div.className = 'condition-group' + (isRoot ? ' root-group' : '');
    div.dataset.nodeId = group._id;

    // Header: operator toggle + remove button
    var header = document.createElement('div');
    header.className = 'condition-group-header';

    var toggle = document.createElement('div');
    toggle.className = 'condition-operator-toggle';

    var andBtn = document.createElement('button');
    andBtn.type = 'button';
    andBtn.textContent = 'AND';
    andBtn.className = group.operator === 'AND' ? 'active' : '';
    andBtn.onclick = function() {
        group.operator = 'AND';
        _markDirty();
        renderConditionTree();
    };

    var orBtn = document.createElement('button');
    orBtn.type = 'button';
    orBtn.textContent = 'OR';
    orBtn.className = group.operator === 'OR' ? 'active' : '';
    orBtn.onclick = function() {
        group.operator = 'OR';
        _markDirty();
        renderConditionTree();
    };

    toggle.appendChild(andBtn);
    toggle.appendChild(orBtn);
    header.appendChild(toggle);

    if (!isRoot) {
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'condition-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove group';
        removeBtn.onclick = function() {
            _removeNode(group._id);
        };
        header.appendChild(removeBtn);
    }

    div.appendChild(header);

    // Children
    group.children.forEach(function(child) {
        div.appendChild(_renderNode(child, false));
    });

    // Action buttons: Add Condition, Add Group
    var actions = document.createElement('div');
    actions.className = 'condition-group-actions';

    var addLeafBtn = document.createElement('button');
    addLeafBtn.type = 'button';
    addLeafBtn.textContent = '+ Condition';
    addLeafBtn.onclick = function() {
        group.children.push(_createLeaf());
        _markDirty();
        renderConditionTree();
    };

    var addGroupBtn = document.createElement('button');
    addGroupBtn.type = 'button';
    addGroupBtn.textContent = '+ Group';
    addGroupBtn.onclick = function() {
        group.children.push(_createGroup());
        _markDirty();
        renderConditionTree();
    };

    actions.appendChild(addLeafBtn);
    actions.appendChild(addGroupBtn);
    div.appendChild(actions);

    return div;
}

function _renderLeaf(leaf) {
    var div = document.createElement('div');
    div.className = 'condition-leaf';
    div.dataset.nodeId = leaf._id;

    var fields = _getFieldsForTrigger();

    // Field dropdown
    var fieldSelect = document.createElement('select');
    fieldSelect.title = 'Field';
    fields.forEach(function(f) {
        var opt = document.createElement('option');
        opt.value = f.value;
        opt.textContent = f.label;
        if (f.value === leaf.field) opt.selected = true;
        fieldSelect.appendChild(opt);
    });
    fieldSelect.onchange = function() {
        leaf.field = this.value;
        _markDirty();
    };

    // Operator dropdown
    var opSelect = document.createElement('select');
    opSelect.title = 'Operator';
    OPERATORS.forEach(function(op) {
        var opt = document.createElement('option');
        opt.value = op.value;
        opt.textContent = op.label;
        if (op.value === leaf.operator) opt.selected = true;
        opSelect.appendChild(opt);
    });
    opSelect.onchange = function() {
        leaf.operator = this.value;
        _markDirty();
        renderConditionTree(); // re-render to show/hide value input
    };

    div.appendChild(fieldSelect);
    div.appendChild(opSelect);

    // Value input (hidden for is_empty / is_not_empty)
    if (NO_VALUE_OPERATORS.indexOf(leaf.operator) === -1) {
        var valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.placeholder = 'Value';
        valueInput.value = leaf.value || '';
        valueInput.oninput = function() {
            leaf.value = this.value;
            _markDirty();
        };
        div.appendChild(valueInput);
    }

    // Remove button
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'condition-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove condition';
    removeBtn.onclick = function() {
        _removeNode(leaf._id);
    };
    div.appendChild(removeBtn);

    return div;
}

function _removeNode(nodeId) {
    _removeNodeFromTree(_conditionTree, nodeId);
    _markDirty();
    renderConditionTree();
}

function _removeNodeFromTree(parent, nodeId) {
    if (parent.type !== 'group') return false;
    for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i]._id === nodeId) {
            parent.children.splice(i, 1);
            return true;
        }
        if (_removeNodeFromTree(parent.children[i], nodeId)) return true;
    }
    return false;
}

// ── Serialize Condition Tree (strip internal _id fields) ──
function _serializeTree(node) {
    if (!node) return null;
    if (node.type === 'group') {
        return {
            type: 'group',
            operator: node.operator,
            children: (node.children || []).map(_serializeTree)
        };
    }
    return {
        type: 'leaf',
        field: node.field,
        operator: node.operator,
        value: node.value
    };
}

// ── Deserialize Condition Tree (add internal _id fields) ──
function _deserializeTree(node) {
    if (!node) return _createDefaultTree();
    if (node.type === 'group') {
        return {
            _id: _nextNodeId(),
            type: 'group',
            operator: node.operator || 'AND',
            children: (node.children || []).map(_deserializeTree)
        };
    }
    return {
        _id: _nextNodeId(),
        type: 'leaf',
        field: node.field || '',
        operator: node.operator || 'equals',
        value: node.value || ''
    };
}

// ── Count Leaf Conditions ──
function _countLeaves(node) {
    if (!node) return 0;
    if (node.type === 'leaf') return 1;
    var count = 0;
    (node.children || []).forEach(function(c) { count += _countLeaves(c); });
    return count;
}

// ── Actions Section ──

function addActionRow(actionData) {
    var action = actionData || { type: '', params: {} };
    _actions.push(action);
    _markDirty();
    renderActions();
}

function removeAction(index) {
    _actions.splice(index, 1);
    _markDirty();
    renderActions();
}

function renderActions() {
    var container = document.getElementById('action-rows');
    if (!container) return;

    if (_actions.length === 0) {
        container.innerHTML = '<div class="cwoc-empty" style="padding:1em;">No actions yet. Click "+ Add Action" below.</div>';
        return;
    }

    container.innerHTML = '';
    _actions.forEach(function(action, idx) {
        var row = document.createElement('div');
        row.className = 'action-row';

        // Action type dropdown
        var typeSelect = document.createElement('select');
        typeSelect.title = 'Action type';
        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '— Select action —';
        typeSelect.appendChild(defaultOpt);

        CHIT_ACTION_TYPES.forEach(function(at) {
            var opt = document.createElement('option');
            opt.value = at.value;
            opt.textContent = at.label;
            if (at.value === action.type) opt.selected = true;
            typeSelect.appendChild(opt);
        });

        typeSelect.onchange = function() {
            action.type = this.value;
            action.params = {};
            _markDirty();
            renderActions();
        };
        row.appendChild(typeSelect);

        // Remove button (created early so HA action types can use it)
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'action-row-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove action';
        removeBtn.onclick = function() { removeAction(idx); };

        // Parameter inputs (dynamic based on action type)
        var actionDef = CHIT_ACTION_TYPES.find(function(at) { return at.value === action.type; });

        // HA action types get custom rendering
        if (action.type === 'call_ha_service') {
            row.appendChild(removeBtn);
            container.appendChild(row);
            _renderHaServiceAction(action, container);
            return; // skip normal param rendering
        }
        if (action.type === 'fire_ha_event') {
            row.appendChild(removeBtn);
            container.appendChild(row);
            _renderHaEventAction(action, container);
            return; // skip normal param rendering
        }

        if (actionDef && actionDef.params) {
            actionDef.params.forEach(function(param) {
                if (param.type === 'select') {
                    var sel = document.createElement('select');
                    sel.title = param.label;
                    var emptyOpt = document.createElement('option');
                    emptyOpt.value = '';
                    emptyOpt.textContent = '— ' + param.label + ' —';
                    sel.appendChild(emptyOpt);
                    param.options.forEach(function(optVal) {
                        var opt = document.createElement('option');
                        opt.value = optVal;
                        opt.textContent = optVal;
                        if (action.params[param.key] === optVal) opt.selected = true;
                        sel.appendChild(opt);
                    });
                    sel.onchange = function() {
                        action.params[param.key] = this.value;
                        _markDirty();
                    };
                    row.appendChild(sel);
                } else if (param.type === 'color') {
                    var colorInput = document.createElement('input');
                    colorInput.type = 'color';
                    colorInput.title = param.label;
                    colorInput.value = action.params[param.key] || '#8b4513';
                    colorInput.oninput = function() {
                        action.params[param.key] = this.value;
                        _markDirty();
                    };
                    row.appendChild(colorInput);
                } else if (param.type === 'tag') {
                    // Tag picker widget
                    var tagWrapper = document.createElement('div');
                    tagWrapper.className = 'rule-tag-picker';

                    var tagInput = document.createElement('input');
                    tagInput.type = 'text';
                    tagInput.placeholder = param.label;
                    tagInput.title = param.label;
                    tagInput.value = action.params[param.key] || '';
                    tagInput.autocomplete = 'off';

                    var tagDropdown = document.createElement('div');
                    tagDropdown.className = 'rule-tag-picker-dropdown';
                    tagDropdown.style.display = 'none';

                    // Closure to capture action + param.key
                    (function(act, pKey, input, dropdown) {
                        function populateDropdown(filter) {
                            dropdown.innerHTML = '';
                            var tags = _cachedTagList || [];
                            var q = (filter || '').toLowerCase();
                            var filtered = tags.filter(function(t) {
                                return !q || t.name.toLowerCase().indexOf(q) !== -1;
                            });
                            if (filtered.length === 0) {
                                var empty = document.createElement('div');
                                empty.className = 'rule-tag-picker-empty';
                                empty.textContent = q ? 'No matching tags' : 'No tags available';
                                dropdown.appendChild(empty);
                                return;
                            }
                            filtered.forEach(function(tag) {
                                var item = document.createElement('div');
                                item.className = 'rule-tag-picker-item';

                                var dot = document.createElement('span');
                                dot.className = 'rule-tag-picker-dot';
                                var tagColor = tag.color || (typeof getPastelColor === 'function' ? getPastelColor(tag.name) : '#d4c4b0');
                                dot.style.background = tagColor;
                                item.appendChild(dot);

                                if (tag.favorite) {
                                    var star = document.createElement('span');
                                    star.className = 'rule-tag-picker-star';
                                    star.textContent = '★';
                                    item.appendChild(star);
                                }

                                var label = document.createElement('span');
                                label.textContent = tag.name;
                                item.appendChild(label);

                                item.addEventListener('mousedown', function(e) {
                                    e.preventDefault(); // prevent blur before click registers
                                    input.value = tag.name;
                                    act.params[pKey] = tag.name;
                                    _markDirty();
                                    dropdown.style.display = 'none';
                                });
                                dropdown.appendChild(item);
                            });
                        }

                        input.addEventListener('focus', function() {
                            populateDropdown(input.value);
                            dropdown.style.display = '';
                        });

                        input.addEventListener('input', function() {
                            act.params[pKey] = input.value;
                            _markDirty();
                            populateDropdown(input.value);
                            dropdown.style.display = '';
                        });

                        input.addEventListener('blur', function() {
                            // Small delay so mousedown on dropdown items registers
                            setTimeout(function() { dropdown.style.display = 'none'; }, 150);
                        });
                    })(action, param.key, tagInput, tagDropdown);

                    tagWrapper.appendChild(tagInput);
                    tagWrapper.appendChild(tagDropdown);
                    row.appendChild(tagWrapper);
                } else {
                    var textInput = document.createElement('input');
                    textInput.type = 'text';
                    textInput.placeholder = param.label;
                    textInput.title = param.label;
                    textInput.value = action.params[param.key] || '';
                    textInput.oninput = function() {
                        action.params[param.key] = this.value;
                        _markDirty();
                    };
                    row.appendChild(textInput);
                }
            });
        }

        // Append remove button at end of row (for non-HA action types)
        row.appendChild(removeBtn);

        container.appendChild(row);
    });
}

// ── Trigger Change Handler ──
function _onTriggerChange() {
    var trigger = document.getElementById('rule-trigger').value;
    var scheduleConfig = document.getElementById('schedule-config');
    var haStateChangeConfig = document.getElementById('ha-state-change-config');
    var haWebhookConfig = document.getElementById('ha-webhook-config');

    // Show/hide schedule config
    if (trigger === 'scheduled') {
        scheduleConfig.classList.add('visible');
    } else {
        scheduleConfig.classList.remove('visible');
    }

    // Show/hide HA state change config
    if (trigger === 'ha_state_change') {
        haStateChangeConfig.classList.add('visible');
    } else {
        haStateChangeConfig.classList.remove('visible');
    }

    // Show/hide HA webhook config
    if (trigger === 'ha_webhook') {
        haWebhookConfig.classList.add('visible');
    } else {
        haWebhookConfig.classList.remove('visible');
    }

    // Re-render condition tree with new field options
    renderConditionTree();
    _markDirty();
}

function _onScheduleFrequencyChange() {
    var freq = document.getElementById('schedule-frequency').value;
    var intervalWrap = document.getElementById('schedule-interval-wrap');
    if (freq === 'hourly') {
        intervalWrap.style.display = '';
    } else {
        intervalWrap.style.display = 'none';
    }
    _markDirty();
}

// ── Dirty State ──
function _markDirty() {
    if (_saveSystem) _saveSystem.markUnsaved();
}

// ── Validation ──
function _validate() {
    var errors = [];
    var name = document.getElementById('rule-name').value.trim();
    if (!name) errors.push('Rule name is required.');

    var trigger = document.getElementById('rule-trigger').value;
    if (!trigger) errors.push('Trigger type is required.');

    if (_countLeaves(_conditionTree) === 0) {
        errors.push('At least one condition is required.');
    }

    if (_actions.length === 0) {
        errors.push('At least one action is required.');
    } else {
        var hasValidAction = _actions.some(function(a) { return a.type; });
        if (!hasValidAction) errors.push('At least one action must have a type selected.');
    }

    return errors;
}

// ── Save Rule ──
async function saveRule(andExit) {
    var errors = _validate();
    if (errors.length > 0) {
        cwocToast(errors[0], 'error');
        return;
    }

    var payload = {
        name: document.getElementById('rule-name').value.trim(),
        description: document.getElementById('rule-description').value.trim() || null,
        trigger_type: document.getElementById('rule-trigger').value,
        conditions: _serializeTree(_conditionTree),
        actions: _actions.filter(function(a) { return a.type; }).map(function(a) {
            // Serialize HA action key-value arrays to objects for storage
            if (a.type === 'call_ha_service') {
                var sd = {};
                (a.params.service_data || []).forEach(function(p) {
                    if (p.key) sd[p.key] = p.value || '';
                });
                return {
                    type: a.type,
                    params: {
                        domain: a.params.domain || '',
                        service: a.params.service || '',
                        entity_id: a.params.entity_id || '',
                        service_data: sd
                    }
                };
            }
            if (a.type === 'fire_ha_event') {
                var ed = {};
                (a.params.event_data || []).forEach(function(p) {
                    if (p.key) ed[p.key] = p.value || '';
                });
                return {
                    type: a.type,
                    params: {
                        event_type: a.params.event_type || '',
                        event_data: ed
                    }
                };
            }
            return a;
        }),
        confirm_before_apply: document.getElementById('rule-confirm').checked
    };

    // Schedule config
    if (payload.trigger_type === 'scheduled') {
        payload.schedule_config = {
            frequency: document.getElementById('schedule-frequency').value,
            interval: parseInt(document.getElementById('schedule-interval').value, 10) || 1,
            time_of_day: document.getElementById('schedule-time').value || '09:00'
        };
    }

    // HA state change config
    if (payload.trigger_type === 'ha_state_change') {
        payload.schedule_config = {
            ha_entity_id: document.getElementById('ha-entity-id-input').value.trim()
        };
    }

    try {
        var url, method;
        if (_ruleId) {
            url = '/api/rules/' + encodeURIComponent(_ruleId);
            method = 'PUT';
        } else {
            url = '/api/rules';
            method = 'POST';
        }

        var resp = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            var errData = await resp.json().catch(function() { return {}; });
            throw new Error(errData.detail || 'Save failed');
        }

        var saved = await resp.json();
        _ruleId = saved.id;
        _saveSystem.markSaved();
        cwocToast('Rule saved');

        // Update URL to include id for new rules
        if (!window.location.search.includes('id=')) {
            var newUrl = window.location.pathname + '?id=' + encodeURIComponent(_ruleId);
            window.history.replaceState(null, '', newUrl);
        }

        if (andExit) {
            window.location.href = '/frontend/html/rules-manager.html';
        }
    } catch (e) {
        console.error('Error saving rule:', e);
        cwocToast('Failed to save: ' + e.message, 'error');
    }
}

// ── Cancel / Exit ──
function cancelOrExit() {
    if (_saveSystem) {
        _saveSystem.cancelOrExit();
    } else {
        window.location.href = '/frontend/html/rules-manager.html';
    }
}

// ── Load Existing Rule ──
async function _loadRule(ruleId) {
    try {
        var resp = await fetch('/api/rules/' + encodeURIComponent(ruleId));
        if (!resp.ok) {
            cwocToast('Rule not found', 'error');
            return;
        }
        var rule = await resp.json();
        _ruleId = rule.id;

        // Populate fields
        document.getElementById('rule-name').value = rule.name || '';
        document.getElementById('rule-description').value = rule.description || '';
        document.getElementById('rule-trigger').value = rule.trigger_type || '';
        document.getElementById('rule-confirm').checked = rule.confirm_before_apply !== false;

        // Trigger change to show/hide schedule config
        _onTriggerChange();

        // Schedule config
        if (rule.schedule_config) {
            var sc = typeof rule.schedule_config === 'string' ? JSON.parse(rule.schedule_config) : rule.schedule_config;
            document.getElementById('schedule-frequency').value = sc.frequency || 'daily';
            document.getElementById('schedule-interval').value = sc.interval || 1;
            document.getElementById('schedule-time').value = sc.time_of_day || '09:00';
            _onScheduleFrequencyChange();

            // HA state change entity_id
            if (sc.ha_entity_id) {
                document.getElementById('ha-entity-id-input').value = sc.ha_entity_id;
            }
        }

        // Conditions
        var conditions = rule.conditions;
        if (typeof conditions === 'string') {
            try { conditions = JSON.parse(conditions); } catch (e) { conditions = null; }
        }
        _conditionTree = conditions ? _deserializeTree(conditions) : _createDefaultTree();
        renderConditionTree();

        // Actions
        var actions = rule.actions;
        if (typeof actions === 'string') {
            try { actions = JSON.parse(actions); } catch (e) { actions = []; }
        }
        _actions = Array.isArray(actions) ? actions.map(_deserializeHaAction) : [];
        renderActions();

        // Mark as saved (no changes yet)
        _saveSystem.markSaved();
    } catch (e) {
        console.error('Error loading rule:', e);
        cwocToast('Failed to load rule', 'error');
    }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', function() {
    // ── Inject save buttons into the shared-page header ──
    var headerRow = document.querySelector('.header-and-buttons');
    if (headerRow) {
        var buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'buttons';
        buttonsDiv.innerHTML =
            '<div class="left-buttons">' +
                '<button id="save-stay-btn" style="display:none;" onclick="saveRule(false)">📌 Save &amp; Stay</button>' +
                '<button id="save-exit-btn" style="display:none;" onclick="saveRule(true)">🚪 Save &amp; Exit</button>' +
                '<button id="save-single-btn" disabled>Save</button>' +
                '<button onclick="cancelOrExit()" class="cancel-rule cancel">Exit</button>' +
            '</div>';
        headerRow.appendChild(buttonsDiv);
    }

    // Initialize save system
    _saveSystem = new CwocSaveSystem({
        singleBtnId: 'save-single-btn',
        stayBtnId: 'save-stay-btn',
        exitBtnId: 'save-exit-btn',
        cancelSelector: '.cancel-rule',
        getReturnUrl: function() {
            return '/frontend/html/rules-manager.html';
        }
    });

    // Bind trigger change
    document.getElementById('rule-trigger').addEventListener('change', _onTriggerChange);
    document.getElementById('schedule-frequency').addEventListener('change', _onScheduleFrequencyChange);

    // Bind HA trigger entity_id dirty tracking
    document.getElementById('ha-entity-id-input').addEventListener('input', _markDirty);

    // Bind HA trigger Fetch Entities button
    document.getElementById('ha-trigger-fetch-entities').addEventListener('click', async function() {
        var btn = this;
        btn.disabled = true;
        btn.textContent = 'Loading…';
        var entities = await _fetchHaEntities();
        btn.disabled = false;
        btn.textContent = 'Fetch Entities';
        if (!entities) {
            cwocToast('Could not fetch HA entities. Is HA configured?', 'error');
            return;
        }
        _showHaTriggerEntityPicker(entities);
    });

    // Bind dirty tracking on text inputs
    document.getElementById('rule-name').addEventListener('input', _markDirty);
    document.getElementById('rule-description').addEventListener('input', _markDirty);
    document.getElementById('rule-confirm').addEventListener('change', _markDirty);

    // Initialize condition tree
    _conditionTree = _createDefaultTree();
    renderConditionTree();

    // Load tag list for tag picker
    _loadTagList();

    // Initialize actions
    _actions = [];
    renderActions();

    // Check for existing rule ID in URL
    var params = new URLSearchParams(window.location.search);
    var ruleId = params.get('id');
    if (ruleId) {
        _loadRule(ruleId);
    }
});
