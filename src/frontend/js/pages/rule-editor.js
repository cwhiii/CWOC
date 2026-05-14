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
// _escHtml — now in shared-utils.js (single source of truth)

function _nextNodeId() {
    return 'node-' + (++_nodeIdCounter);
}

// ── Tag Picker Cache ──
var _cachedTagList = null;
var _cachedPeopleList = null;
var _cachedLocationsList = null;

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

async function _loadPeopleList() {
    if (_cachedPeopleList !== null) return;
    try {
        var resp = await fetch('/api/contacts');
        if (!resp.ok) { _cachedPeopleList = []; return; }
        var contacts = await resp.json();
        var names = [];
        contacts.forEach(function(c) {
            var name = c.display_name || ((c.given_name || '') + ' ' + (c.surname || '')).trim();
            if (name) names.push(name);
        });
        _cachedPeopleList = names.sort(function(a, b) {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });
    } catch (e) {
        console.error('_loadPeopleList error:', e);
        _cachedPeopleList = [];
    }
}

async function _loadLocationsList() {
    if (_cachedLocationsList !== null) return;
    try {
        var settings = await getCachedSettings();
        var locations = settings.saved_locations || [];
        _cachedLocationsList = locations
            .filter(function(l) { return l && l.name; })
            .map(function(l) { return l.name; })
            .sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    } catch (e) {
        console.error('_loadLocationsList error:', e);
        _cachedLocationsList = [];
    }
}

function _renderSearchableInput(currentValue, options, placeholder, onChange) {
    // Creates a wrapper with a text input and a dropdown list
    var wrapper = document.createElement('div');
    wrapper.className = 'smart-input-wrapper';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder || 'Type or select…';
    input.value = currentValue || '';
    input.className = 'smart-input-field';

    var dropdown = document.createElement('div');
    dropdown.className = 'smart-input-dropdown';
    dropdown.style.display = 'none';

    function buildList(filter) {
        dropdown.innerHTML = '';
        var q = (filter || '').toLowerCase();
        var filtered = options.filter(function(opt) {
            return !q || opt.toLowerCase().indexOf(q) !== -1;
        });
        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        filtered.slice(0, 15).forEach(function(opt) {
            var item = document.createElement('div');
            item.className = 'smart-input-option';
            item.textContent = opt;
            item.onmousedown = function(e) {
                e.preventDefault(); // prevent blur
                input.value = opt;
                dropdown.style.display = 'none';
                onChange(opt);
            };
            dropdown.appendChild(item);
        });
        dropdown.style.display = '';
    }

    input.onfocus = function() { buildList(this.value); };
    input.oninput = function() {
        buildList(this.value);
        onChange(this.value);
    };
    input.onblur = function() {
        setTimeout(function() { dropdown.style.display = 'none'; }, 150);
    };

    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    return wrapper;
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
    { value: 'habit', label: 'Habit' },
    { value: 'created_datetime', label: 'Created Date' },
    { value: 'modified_datetime', label: 'Modified Date' },
    { value: 'start_datetime', label: 'Start Date' },
    { value: 'due_datetime', label: 'Due Date' },
    { value: 'point_in_time', label: 'Point in Time' },
    { value: 'completed_datetime', label: 'Completed Date' },
    { value: '_weather', label: '🌤️ Weather' }
];

var EMAIL_FIELDS = [
    { value: 'title', label: 'Title / Subject' },
    { value: 'note', label: 'Note / Body' },
    { value: 'email_from', label: 'Email From' },
    { value: 'email_to', label: 'Email To' },
    { value: 'email_cc', label: 'Email CC' },
    { value: 'email_bcc', label: 'Email BCC' },
    { value: 'email_account_id', label: 'Email Account' },
    { value: 'email_subject', label: 'Email Subject' },
    { value: 'email_body_text', label: 'Email Body' },
    { value: 'email_folder', label: 'Email Folder' },
    { value: 'email_read', label: 'Email Read' },
    { value: 'email_date', label: 'Email Date' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'tags', label: 'Tags' },
    { value: 'people', label: 'People' },
    { value: 'location', label: 'Location' },
    { value: 'created_datetime', label: 'Created Date' },
    { value: 'modified_datetime', label: 'Modified Date' },
    { value: 'start_datetime', label: 'Start Date' },
    { value: 'due_datetime', label: 'Due Date' },
    { value: 'point_in_time', label: 'Point in Time' },
    { value: 'completed_datetime', label: 'Completed Date' }
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

var HABIT_TRIGGER_FIELDS = [
    { value: 'source_rule_name', label: 'Habit Rule Name' },
    { value: 'source_chit_title', label: 'Habit Chit Title' },
    { value: 'habit_event', label: 'Event (achieved/missed/due)' },
    { value: 'streak', label: 'Streak Count' },
    { value: 'habit_goal', label: 'Habit Goal' },
    { value: 'habit_success', label: 'Habit Progress' },
    { value: 'offset_minutes', label: 'Offset Minutes' },
    { value: 'timestamp', label: 'Timestamp' },
    { value: 'title', label: 'Chit Title' },
    { value: 'note', label: 'Note' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'severity', label: 'Severity' },
    { value: 'location', label: 'Location' },
    { value: 'color', label: 'Color' },
    { value: 'tags', label: 'Tags' },
    { value: 'people', label: 'People' },
    { value: 'start_datetime', label: 'Start Date' },
    { value: 'due_datetime', label: 'Due Date' },
    { value: '_weather', label: '🌤️ Weather' }
];

var OPERATOR_GROUPS = [
    { label: 'Comparison', operators: [
        { value: 'equals', label: 'equals' },
        { value: 'not_equals', label: 'not equals' },
        { value: 'greater_than', label: 'greater than' },
        { value: 'less_than', label: 'less than' }
    ]},
    { label: 'Text', operators: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'not contains' },
        { value: 'starts_with', label: 'starts with' },
        { value: 'ends_with', label: 'ends with' },
        { value: 'regex_match', label: 'regex match' }
    ]},
    { label: 'Presence', operators: [
        { value: 'is_empty', label: 'is empty' },
        { value: 'is_not_empty', label: 'is not empty' }
    ]},
    { label: 'Tags & People', operators: [
        { value: 'tag_present', label: 'tag is present' },
        { value: 'tag_not_present', label: 'tag is not present' },
        { value: 'person_on_chit', label: 'person is on chit' },
        { value: 'person_not_on_chit', label: 'person is not on chit' }
    ]},
    { label: 'Date Age', operators: [
        { value: 'days_ago_greater_than', label: 'days ago >' },
        { value: 'days_ago_less_than', label: 'days ago <' }
    ]},
    { label: 'Weather — Current', operators: [
        { value: 'weather_temp_low_below', label: 'low temp below (°C)' },
        { value: 'weather_temp_high_above', label: 'high temp above (°C)' },
        { value: 'weather_temp_low_above', label: 'low temp above (°C)' },
        { value: 'weather_temp_high_below', label: 'high temp below (°C)' },
        { value: 'weather_precipitation_above', label: 'precipitation above (mm)' },
        { value: 'weather_precipitation_below', label: 'precipitation below (mm)' },
        { value: 'weather_wind_speed_above', label: 'wind speed above (km/h)' },
        { value: 'weather_wind_speed_below', label: 'wind speed below (km/h)' },
        { value: 'weather_wind_gusts_above', label: 'wind gusts above (km/h)' },
        { value: 'weather_wind_gusts_below', label: 'wind gusts below (km/h)' }
    ]},
    { label: 'Weather — Forecast Window', operators: [
        { value: 'weather_forecast_contains_temp_low_below', label: 'next N days: low temp below' },
        { value: 'weather_forecast_contains_temp_high_above', label: 'next N days: high temp above' },
        { value: 'weather_forecast_contains_precipitation_above', label: 'next N days: precipitation above' },
        { value: 'weather_forecast_contains_wind_speed_above', label: 'next N days: wind speed above' },
        { value: 'weather_forecast_contains_wind_gusts_above', label: 'next N days: wind gusts above' }
    ]}
];

// Flat list for lookups
var OPERATORS = [];
OPERATOR_GROUPS.forEach(function(g) {
    g.operators.forEach(function(op) { OPERATORS.push(op); });
});

// Operators that don't need a value input
var NO_VALUE_OPERATORS = ['is_empty', 'is_not_empty'];

// Weather operators that need special value format (threshold|days for forecast)
var WEATHER_FORECAST_OPERATORS = [
    'weather_forecast_contains_temp_low_below',
    'weather_forecast_contains_temp_high_above', 
    'weather_forecast_contains_precipitation_above',
    'weather_forecast_contains_wind_speed_above',
    'weather_forecast_contains_wind_gusts_above'
];

// All weather operators
var WEATHER_OPERATORS = [
    'weather_temp_low_below', 'weather_temp_high_above', 'weather_temp_low_above', 'weather_temp_high_below',
    'weather_precipitation_above', 'weather_precipitation_below',
    'weather_wind_speed_above', 'weather_wind_speed_below',
    'weather_wind_gusts_above', 'weather_wind_gusts_below'
].concat(WEATHER_FORECAST_OPERATORS);

// Date-type fields — operators like days_ago only apply to these
var DATE_TYPE_FIELDS = [
    'email_date', 'created_datetime', 'start_datetime',
    'due_datetime', 'modified_datetime', 'point_in_time', 'completed_datetime'
];

// Operators that should only appear for date-type fields
var DATE_ONLY_OPERATORS = ['days_ago_greater_than', 'days_ago_less_than'];

// ── Field-specific operator allowlists ──
// Fields with known fixed values only get equals/not_equals/is_empty/is_not_empty
var ENUM_OPERATORS = ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
var TEXT_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'regex_match'];
var NUMERIC_OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];
var BOOLEAN_OPERATORS = ['equals', 'not_equals'];
var TAG_OPERATORS = ['tag_present', 'tag_not_present', 'is_empty', 'is_not_empty'];
var PEOPLE_OPERATORS = ['person_on_chit', 'person_not_on_chit', 'is_empty', 'is_not_empty'];
var DATE_OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty', 'days_ago_greater_than', 'days_ago_less_than'];

// Map each field to its allowed operator set
var FIELD_OPERATOR_MAP = {
    // Enum fields (fixed known values)
    'status': ENUM_OPERATORS,
    'priority': ENUM_OPERATORS,
    'severity': ENUM_OPERATORS,
    'color': ENUM_OPERATORS,
    'email_folder': ENUM_OPERATORS,
    // Boolean fields
    'archived': BOOLEAN_OPERATORS,
    'pinned': BOOLEAN_OPERATORS,
    'all_day': BOOLEAN_OPERATORS,
    'habit': BOOLEAN_OPERATORS,
    'email_read': BOOLEAN_OPERATORS,
    // Text fields
    'title': TEXT_OPERATORS,
    'note': TEXT_OPERATORS,
    'location': TEXT_OPERATORS,
    'email_from': TEXT_OPERATORS,
    'email_to': TEXT_OPERATORS,
    'email_cc': TEXT_OPERATORS,
    'email_bcc': TEXT_OPERATORS,
    'email_account_id': ENUM_OPERATORS,
    'email_subject': TEXT_OPERATORS,
    'email_body_text': TEXT_OPERATORS,
    'given_name': TEXT_OPERATORS,
    'surname': TEXT_OPERATORS,
    'organization': TEXT_OPERATORS,
    'emails': TEXT_OPERATORS,
    'phones': TEXT_OPERATORS,
    'addresses': TEXT_OPERATORS,
    'ha_entity_id': TEXT_OPERATORS,
    'old_state': TEXT_OPERATORS,
    'new_state': TEXT_OPERATORS,
    'attributes': TEXT_OPERATORS,
    'source_rule_name': TEXT_OPERATORS,
    'source_chit_title': TEXT_OPERATORS,
    'habit_event': ENUM_OPERATORS,
    'timestamp': TEXT_OPERATORS,
    // Numeric fields
    'streak': NUMERIC_OPERATORS,
    'habit_goal': NUMERIC_OPERATORS,
    'habit_success': NUMERIC_OPERATORS,
    'offset_minutes': NUMERIC_OPERATORS,
    // Tag/People fields
    'tags': TAG_OPERATORS,
    'people': PEOPLE_OPERATORS,
    // Date fields
    'created_datetime': DATE_OPERATORS,
    'modified_datetime': DATE_OPERATORS,
    'start_datetime': DATE_OPERATORS,
    'due_datetime': DATE_OPERATORS,
    'point_in_time': DATE_OPERATORS,
    'completed_datetime': DATE_OPERATORS,
    'email_date': DATE_OPERATORS
};

function _getAllowedOperators(field) {
    // Weather field handled separately
    if (field === '_weather') return null; // signals weather UI
    return FIELD_OPERATOR_MAP[field] || TEXT_OPERATORS; // default to text operators
}

// ── Action Type Definitions (grouped) ──
var ACTION_GROUPS = [
    { label: 'Tags & People', actions: [
        { value: 'add_tag', label: 'Add Tag', params: [{ key: 'tag', label: 'Tag', type: 'tag' }] },
        { value: 'remove_tag', label: 'Remove Tag', params: [{ key: 'tag', label: 'Tag', type: 'tag' }] },
        { value: 'add_person', label: 'Add Person', params: [{ key: 'person', label: 'Person Name', type: 'person' }] },
        { value: 'add_matching_contacts_as_people', label: 'Add Matching Contacts', params: [{ key: 'match_field', label: 'Match Field', type: 'select', options: ['city', 'state', 'country'] }] }
    ]},
    { label: 'Status & Priority', actions: [
        { value: 'set_status', label: 'Set Status', params: [{ key: 'status', label: 'Status', type: 'select', options: ['ToDo', 'In Progress', 'Blocked', 'Complete', 'Rejected'] }] },
        { value: 'set_priority', label: 'Set Priority', params: [{ key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }] },
        { value: 'set_severity', label: 'Set Severity', params: [{ key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }] }
    ]},
    { label: 'Appearance & Location', actions: [
        { value: 'set_color', label: 'Set Color', params: [{ key: 'color', label: 'Color', type: 'color' }] },
        { value: 'set_location', label: 'Set Location', params: [{ key: 'location', label: 'Location', type: 'location' }] },
        { value: 'set_show_on_calendar', label: 'Show on Calendar', params: [{ key: 'show', label: 'Show on Calendar', type: 'select', options: ['true', 'false'] }] }
    ]},
    { label: 'Lifecycle', actions: [
        { value: 'archive', label: 'Archive', params: [] },
        { value: 'move_to_trash', label: 'Move to Trash', params: [] }
    ]},
    { label: 'Create & Notify', actions: [
        { value: 'create_chit', label: 'Create Chit', params: null },
        { value: 'create_reminder', label: 'Create Reminder Chit', params: null },
        { value: 'send_notification', label: 'Send Notification', params: [{ key: 'message', label: 'Message', type: 'text' }] }
    ]},
    { label: 'Email', actions: [
        { value: 'mark_email_read', label: 'Mark Email Read', params: [] },
        { value: 'mark_email_unread', label: 'Mark Email Unread', params: [] },
        { value: 'move_email_to_folder', label: 'Move to Folder', params: [{ key: 'folder', label: 'Folder', type: 'text' }] }
    ]},
    { label: 'Home Assistant', actions: [
        { value: 'call_ha_service', label: '🏠 Call HA Service', params: null },
        { value: 'fire_ha_event', label: '🏠 Fire HA Event', params: null }
    ]}
];

// Flat list for lookups
var CHIT_ACTION_TYPES = [];
ACTION_GROUPS.forEach(function(g) {
    g.actions.forEach(function(a) { CHIT_ACTION_TYPES.push(a); });
});

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

function _renderCreateChitAction(action, container) {
    // Ensure params structure
    if (!action.params) action.params = {};

    var panel = document.createElement('div');
    panel.className = 'create-chit-action-panel';

    // Title field
    var titleLabel = document.createElement('label');
    titleLabel.textContent = 'Title';
    titleLabel.className = 'create-chit-field-label';
    panel.appendChild(titleLabel);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'e.g. Cold weather alert - {{title}}';
    titleInput.value = action.params.title || '';
    titleInput.className = 'create-chit-field-input';
    titleInput.oninput = function() {
        action.params.title = this.value;
        _markDirty();
    };
    panel.appendChild(titleInput);

    // Note field
    var noteLabel = document.createElement('label');
    noteLabel.textContent = 'Note';
    noteLabel.className = 'create-chit-field-label';
    panel.appendChild(noteLabel);

    var noteInput = document.createElement('textarea');
    noteInput.placeholder = 'e.g. Temperature will be {{weather_low}}°C today. Bundle up!';
    noteInput.value = action.params.note || '';
    noteInput.className = 'create-chit-field-input';
    noteInput.rows = 3;
    noteInput.oninput = function() {
        action.params.note = this.value;
        _markDirty();
    };
    panel.appendChild(noteInput);

    // Status field
    var statusLabel = document.createElement('label');
    statusLabel.textContent = 'Status';
    statusLabel.className = 'create-chit-field-label';
    panel.appendChild(statusLabel);

    var statusSelect = document.createElement('select');
    statusSelect.className = 'create-chit-field-input';
    var statusOptions = ['ToDo', 'In Progress', 'Blocked', 'Complete'];
    statusOptions.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (action.params.status === opt) option.selected = true;
        statusSelect.appendChild(option);
    });
    statusSelect.onchange = function() {
        action.params.status = this.value;
        _markDirty();
    };
    panel.appendChild(statusSelect);

    // Priority field
    var priorityLabel = document.createElement('label');
    priorityLabel.textContent = 'Priority';
    priorityLabel.className = 'create-chit-field-label';
    panel.appendChild(priorityLabel);

    var prioritySelect = document.createElement('select');
    prioritySelect.className = 'create-chit-field-input';
    var priorityOptions = ['Low', 'Medium', 'High', 'Critical'];
    priorityOptions.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (action.params.priority === opt) option.selected = true;
        prioritySelect.appendChild(option);
    });
    prioritySelect.onchange = function() {
        action.params.priority = this.value;
        _markDirty();
    };
    panel.appendChild(prioritySelect);

    // Due datetime field
    var dueDateLabel = document.createElement('label');
    dueDateLabel.textContent = 'Due Date/Time';
    dueDateLabel.className = 'create-chit-field-label';
    panel.appendChild(dueDateLabel);

    var dueDateInput = document.createElement('input');
    dueDateInput.type = 'text';
    dueDateInput.placeholder = 'e.g. {{today}} 08:00 or 2026-05-15T08:00:00';
    dueDateInput.value = action.params.due_datetime || '';
    dueDateInput.className = 'create-chit-field-input';
    dueDateInput.oninput = function() {
        action.params.due_datetime = this.value;
        _markDirty();
    };
    panel.appendChild(dueDateInput);

    // Alert time field
    var alertLabel = document.createElement('label');
    alertLabel.textContent = 'Alert/Notification Time';
    alertLabel.className = 'create-chit-field-label';
    panel.appendChild(alertLabel);

    var alertInput = document.createElement('input');
    alertInput.type = 'text';
    alertInput.placeholder = 'e.g. {{today}}T08:00:00 (leave empty for no alert)';
    alertInput.value = (action.params.alerts && action.params.alerts.length > 0) ? action.params.alerts[0].datetime || '' : '';
    alertInput.className = 'create-chit-field-input';
    alertInput.oninput = function() {
        var val = this.value.trim();
        if (val) {
            action.params.alerts = [{ datetime: val, type: 'notification' }];
        } else {
            action.params.alerts = [];
        }
        _markDirty();
    };
    panel.appendChild(alertInput);

    // Location field
    var locationLabel = document.createElement('label');
    locationLabel.textContent = 'Location';
    locationLabel.className = 'create-chit-field-label';
    panel.appendChild(locationLabel);

    var locationInput = document.createElement('input');
    locationInput.type = 'text';
    locationInput.placeholder = 'e.g. {{location}} or Default Location';
    locationInput.value = action.params.location || '';
    locationInput.className = 'create-chit-field-input';
    locationInput.oninput = function() {
        action.params.location = this.value;
        _markDirty();
    };
    panel.appendChild(locationInput);

    // Template help
    var helpDiv = document.createElement('div');
    helpDiv.className = 'create-chit-help';
    helpDiv.innerHTML = '<strong>Template Variables:</strong> {{title}}, {{note}}, {{status}}, {{location}}, {{today}}, {{now}}, {{owner_id}}, {{weather_low}}, {{weather_high}}, {{weather_precipitation}}, {{weather_wind_speed}}, {{weather_wind_gusts}}';
    panel.appendChild(helpDiv);

    container.appendChild(panel);
}

function _renderCreateReminderAction(action, container) {
    // Ensure params structure — same fields as Quick Reminder (!R)
    if (!action.params) action.params = {};

    var panel = document.createElement('div');
    panel.className = 'create-chit-action-panel';

    // Title field (same as Quick Reminder)
    var titleLabel = document.createElement('label');
    titleLabel.textContent = 'Reminder Title';
    titleLabel.className = 'create-chit-field-label';
    panel.appendChild(titleLabel);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Reminder title';
    titleInput.value = action.params.title || '';
    titleInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    titleInput.oninput = function() {
        action.params.title = this.value;
        _markDirty();
    };
    panel.appendChild(titleInput);

    // Date field (same as Quick Reminder)
    var dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date';
    dateLabel.className = 'create-chit-field-label';
    panel.appendChild(dateLabel);

    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = action.params.date || '';
    dateInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:0.95em;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;';
    dateInput.onchange = function() {
        action.params.date = this.value;
        _updateReminderTime(action);
        _markDirty();
    };
    panel.appendChild(dateInput);

    // "Use {{today}}" toggle
    var todayRow = document.createElement('div');
    todayRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin:4px 0;';
    var todayCb = document.createElement('input');
    todayCb.type = 'checkbox';
    todayCb.id = 'reminder-use-today-' + Math.random().toString(36).substr(2, 5);
    todayCb.checked = !action.params.date || action.params.date === '{{today}}';
    var todayLbl = document.createElement('label');
    todayLbl.htmlFor = todayCb.id;
    todayLbl.textContent = 'Use {{today}} (day the rule fires)';
    todayLbl.style.cssText = 'font-size:0.85em;cursor:pointer;color:#6b4e31;';
    todayCb.onchange = function() {
        if (this.checked) {
            action.params.date = '{{today}}';
            dateInput.value = '';
            dateInput.disabled = true;
        } else {
            action.params.date = '';
            dateInput.disabled = false;
        }
        _updateReminderTime(action);
        _markDirty();
    };
    if (todayCb.checked) dateInput.disabled = true;
    todayRow.appendChild(todayCb);
    todayRow.appendChild(todayLbl);
    panel.appendChild(todayRow);

    // Time field (same drum roller style as Quick Reminder)
    var timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time';
    timeLabel.className = 'create-chit-field-label';
    panel.appendChild(timeLabel);

    var timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.value = action.params.time || '08:00';
    timeInput.readOnly = true;
    timeInput.style.cssText = 'width:100%;padding:6px 8px;font-family:inherit;font-size:1.1em;font-weight:bold;border:1px solid #8b5a2b;border-radius:4px;box-sizing:border-box;background:#f5e6cc;cursor:pointer;text-align:center;';
    timeInput.addEventListener('mousedown', function(e) { e.preventDefault(); });
    timeInput.addEventListener('click', function() {
        if (typeof cwocTimePicker !== 'undefined') cwocTimePicker.open(timeInput);
    });
    // Update on time change (cwocTimePicker sets .value directly)
    var timeObserver = new MutationObserver(function() {
        action.params.time = timeInput.value;
        _updateReminderTime(action);
        _markDirty();
    });
    timeObserver.observe(timeInput, { attributes: true, attributeFilter: ['value'] });
    // Also listen for input event (some pickers fire this)
    timeInput.addEventListener('input', function() {
        action.params.time = this.value;
        _updateReminderTime(action);
        _markDirty();
    });
    // Fallback: poll for value changes (drum roller may set value without events)
    var lastTimeVal = timeInput.value;
    var timePoll = setInterval(function() {
        if (!document.contains(timeInput)) { clearInterval(timePoll); return; }
        if (timeInput.value !== lastTimeVal) {
            lastTimeVal = timeInput.value;
            action.params.time = timeInput.value;
            _updateReminderTime(action);
            _markDirty();
        }
    }, 500);
    panel.appendChild(timeInput);

    // Note field (optional, not in Quick Reminder but useful for rules)
    var noteLabel = document.createElement('label');
    noteLabel.textContent = 'Note (optional)';
    noteLabel.className = 'create-chit-field-label';
    noteLabel.style.marginTop = '8px';
    panel.appendChild(noteLabel);

    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = 'e.g. Low of {{weather_low}}°C expected';
    noteInput.value = action.params.note || '';
    noteInput.className = 'create-chit-field-input';
    noteInput.oninput = function() {
        action.params.note = this.value;
        _markDirty();
    };
    panel.appendChild(noteInput);

    // Template help
    var helpDiv = document.createElement('div');
    helpDiv.className = 'create-chit-help';
    helpDiv.innerHTML = '<strong>Templates:</strong> {{today}}, {{now}}, {{weather_low}}, {{weather_high}}, {{weather_wind_speed}}, {{title}}';
    panel.appendChild(helpDiv);

    // Initialize reminder_time from date + time
    _updateReminderTime(action);

    container.appendChild(panel);
}

function _updateReminderTime(action) {
    // Build the reminder_time from date + time params
    var date = action.params.date || '{{today}}';
    var time = action.params.time || '08:00';
    if (date === '{{today}}') {
        action.params.reminder_time = '{{today}}T' + time + ':00';
    } else if (date) {
        action.params.reminder_time = date + 'T' + time + ':00';
    } else {
        action.params.reminder_time = time;
    }
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
    if (trigger === 'habit_achieved' || trigger === 'habit_missed' || trigger === 'habit_due') return HABIT_TRIGGER_FIELDS;
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

function _getFieldGroups() {
    var trigger = document.getElementById('rule-trigger').value;
    var fields = _getFieldsForTrigger();
    
    // Group fields by category
    var groups = [];
    var standardFields = [];
    var dateFields = [];
    var listFields = [];
    var weatherFields = [];
    var habitFields = [];
    
    fields.forEach(function(f) {
        if (f.value === '_weather') {
            weatherFields.push(f);
        } else if (DATE_TYPE_FIELDS.indexOf(f.value) !== -1) {
            dateFields.push(f);
        } else if (['tags', 'people'].indexOf(f.value) !== -1) {
            listFields.push(f);
        } else if (['source_rule_name', 'source_chit_title', 'habit_event', 'streak', 'habit_goal', 'habit_success', 'offset_minutes'].indexOf(f.value) !== -1) {
            habitFields.push(f);
        } else {
            standardFields.push(f);
        }
    });
    
    if (standardFields.length > 0) groups.push({ label: 'Properties', fields: standardFields });
    if (listFields.length > 0) groups.push({ label: 'Tags & People', fields: listFields });
    if (dateFields.length > 0) groups.push({ label: 'Dates', fields: dateFields });
    if (habitFields.length > 0) groups.push({ label: 'Habit', fields: habitFields });
    if (weatherFields.length > 0) groups.push({ label: 'Weather', fields: weatherFields });
    
    return groups;
}

// ── Weather Condition Builder ──

var _cachedSavedLocations = null;

function _loadSavedLocations() {
    if (_cachedSavedLocations !== null) return;
    // Try to get from already-loaded settings
    if (window._cwocSettings && window._cwocSettings.saved_locations) {
        _cachedSavedLocations = window._cwocSettings.saved_locations;
        return;
    }
    // Async load and re-render when done
    _cachedSavedLocations = []; // prevent re-entry
    getCachedSettings().then(function(settings) {
        var locs = settings.saved_locations || [];
        if (locs.length > 0) {
            _cachedSavedLocations = locs;
            renderConditionTree();
        }
    }).catch(function() {});
}

function _parseWeatherValue(leaf) {
    // Weather value format: "threshold|days|location"
    // e.g. "0|1|_default" or "13|3|Home" or "5|1|42.3,-71.1"
    var val = leaf.value || '';
    var parts = val.split('|');
    return {
        threshold: parts[0] || '0',
        days: parts[1] || '1',
        location: parts[2] || '_default'
    };
}

function _buildWeatherValue(threshold, days, location) {
    return threshold + '|' + days + '|' + location;
}

function _parseWeatherOperator(operator) {
    // Map operator to metric + comparison
    // e.g. "weather_temp_low_below" → { metric: "temp_low", comparison: "below" }
    // e.g. "weather_forecast_contains_wind_speed_above" → { metric: "wind_speed", comparison: "above", forecast: true }
    var forecast = operator.indexOf('forecast_contains_') !== -1;
    var op = operator.replace('weather_', '').replace('forecast_contains_', '');
    
    // Split on last _above or _below
    var comparison = 'below';
    var metric = op;
    if (op.indexOf('_above') !== -1) {
        comparison = 'above';
        metric = op.replace('_above', '');
    } else if (op.indexOf('_below') !== -1) {
        comparison = 'below';
        metric = op.replace('_below', '');
    }
    
    return { metric: metric, comparison: comparison, forecast: forecast };
}

function _buildWeatherOperator(metric, comparison, forecast) {
    if (forecast) {
        return 'weather_forecast_contains_' + metric + '_' + comparison;
    }
    return 'weather_' + metric + '_' + comparison;
}

function _renderWeatherConditionInputs(div, leaf) {
    var parsed = _parseWeatherValue(leaf);
    var opParsed = _parseWeatherOperator(leaf.operator);
    
    // Ensure saved locations are loaded
    _loadSavedLocations();
    
    // Determine if in manual coordinate mode
    // Manual mode: location is "_manual" or "_manual:lat,lon" or unknown non-saved value
    var isManualMode = parsed.location === '_manual' || 
                       parsed.location.indexOf('_manual:') === 0 ||
                       (parsed.location !== '_default' && parsed.location !== '' && !_isKnownLocation(parsed.location));
    
    // Extract actual coordinates from manual mode
    var manualCoords = '';
    if (parsed.location.indexOf('_manual:') === 0) {
        manualCoords = parsed.location.substring(8); // strip "_manual:"
    } else if (isManualMode && parsed.location !== '_manual') {
        manualCoords = parsed.location; // legacy format: raw coords
    }
    
    // Find default location name
    var defaultLocName = 'Default';
    if (_cachedSavedLocations && _cachedSavedLocations.length > 0) {
        for (var i = 0; i < _cachedSavedLocations.length; i++) {
            if (_cachedSavedLocations[i] && _cachedSavedLocations[i].is_default) {
                defaultLocName = _cachedSavedLocations[i].label || 'Default';
                break;
            }
        }
    }
    
    // 1. Location picker
    var locSelect = document.createElement('select');
    locSelect.title = 'Location';
    var defaultOpt = document.createElement('option');
    defaultOpt.value = '_default';
    defaultOpt.textContent = '📍 ' + defaultLocName;
    if (parsed.location === '_default') defaultOpt.selected = true;
    locSelect.appendChild(defaultOpt);
    
    // Add saved locations (skip the default one since it's already shown)
    if (_cachedSavedLocations && _cachedSavedLocations.length > 0) {
        _cachedSavedLocations.forEach(function(loc) {
            if (!loc || !loc.label) return;
            if (loc.is_default) return; // already shown as "📍 Name"
            var opt = document.createElement('option');
            opt.value = loc.label;
            opt.textContent = loc.label;
            if (parsed.location === loc.label) opt.selected = true;
            locSelect.appendChild(opt);
        });
    }
    
    var manualOpt = document.createElement('option');
    manualOpt.value = '_manual';
    manualOpt.textContent = '✏️ Manual coordinates…';
    if (isManualMode) manualOpt.selected = true;
    locSelect.appendChild(manualOpt);
    
    locSelect.onchange = function() {
        var loc = this.value;
        if (loc === '_manual') {
            parsed.location = '_manual';
        } else {
            parsed.location = loc;
        }
        leaf.value = _buildWeatherValue(parsed.threshold, parsed.days, parsed.location);
        _markDirty();
        renderConditionTree();
    };
    div.appendChild(_wrapWithLabel('Location', locSelect));
    
    // Manual coordinate input (shown when manual mode is active)
    if (isManualMode) {
        var manualInput = document.createElement('input');
        manualInput.type = 'text';
        manualInput.placeholder = 'City, address, or lat,lon';
        manualInput.value = manualCoords;
        manualInput.style.minWidth = '140px';
        manualInput.oninput = function() {
            var coords = this.value.trim();
            parsed.location = coords ? '_manual:' + coords : '_manual';
            leaf.value = _buildWeatherValue(parsed.threshold, parsed.days, parsed.location);
            _markDirty();
        };
        div.appendChild(_wrapWithLabel('Address / Coords', manualInput));
    }
    
    // 2. Metric dropdown (grouped)
    var metricSelect = document.createElement('select');
    metricSelect.title = 'Metric';
    var metricGroups = [
        { label: 'Temperature', metrics: [
            { value: 'temp_low', label: 'Low' },
            { value: 'temp_high', label: 'High' }
        ]},
        { label: 'Wind', metrics: [
            { value: 'wind_speed', label: 'Speed (max)' },
            { value: 'wind_gusts', label: 'Gusts (max)' }
        ]},
        { label: 'Precipitation', metrics: [
            { value: 'precipitation', label: 'Total (all types)' },
            { value: 'rain', label: 'Rain' },
            { value: 'snowfall', label: 'Snow' },
            { value: 'showers', label: 'Showers / Hail' }
        ]}
    ];
    metricGroups.forEach(function(group) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = group.label;
        group.metrics.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            if (opParsed.metric === m.value) opt.selected = true;
            optgroup.appendChild(opt);
        });
        metricSelect.appendChild(optgroup);
    });
    metricSelect.onchange = function() {
        leaf.operator = _buildWeatherOperator(this.value, opParsed.comparison, opParsed.forecast);
        opParsed = _parseWeatherOperator(leaf.operator);
        _markDirty();
        renderConditionTree(); // re-render to update unit label
    };
    div.appendChild(_wrapWithLabel('Metric', metricSelect));
    
    // 3. Comparison dropdown (above / below)
    var compSelect = document.createElement('select');
    compSelect.title = 'Comparison';
    var comps = [
        { value: 'above', label: 'Above' },
        { value: 'below', label: 'Below' }
    ];
    comps.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.label;
        if (opParsed.comparison === c.value) opt.selected = true;
        compSelect.appendChild(opt);
    });
    compSelect.onchange = function() {
        leaf.operator = _buildWeatherOperator(opParsed.metric, this.value, opParsed.forecast);
        opParsed = _parseWeatherOperator(leaf.operator);
        _markDirty();
    };
    div.appendChild(_wrapWithLabel('Comparison', compSelect));
    
    // 4. Threshold input with dynamic unit
    var unitText = _getWeatherUnit(opParsed.metric);
    
    var threshInput = document.createElement('input');
    threshInput.type = 'number';
    threshInput.step = 'any';
    threshInput.placeholder = '0';
    threshInput.value = parsed.threshold;
    threshInput.style.width = '70px';
    threshInput.oninput = function() {
        parsed.threshold = this.value;
        leaf.value = _buildWeatherValue(parsed.threshold, parsed.days, parsed.location);
        _markDirty();
    };
    
    var threshWrapper = document.createElement('div');
    threshWrapper.style.display = 'flex';
    threshWrapper.style.alignItems = 'center';
    threshWrapper.style.gap = '4px';
    threshWrapper.appendChild(threshInput);
    var unitSpan = document.createElement('span');
    unitSpan.style.fontSize = '0.85em';
    unitSpan.style.color = 'var(--aged-brown-light, #8b7355)';
    unitSpan.textContent = unitText;
    threshWrapper.appendChild(unitSpan);
    
    div.appendChild(_wrapWithLabel('Threshold', threshWrapper));
    
    // 5. Window (today / next N days)
    var windowSelect = document.createElement('select');
    windowSelect.title = 'Window';
    var windows = [
        { value: '1', label: 'Today' },
        { value: '2', label: 'Next 2 days' },
        { value: '3', label: 'Next 3 days' },
        { value: '5', label: 'Next 5 days' },
        { value: '7', label: 'Next 7 days' },
        { value: '14', label: 'Next 14 days' }
    ];
    windows.forEach(function(w) {
        var opt = document.createElement('option');
        opt.value = w.value;
        opt.textContent = w.label;
        if (parsed.days === w.value) opt.selected = true;
        windowSelect.appendChild(opt);
    });
    windowSelect.onchange = function() {
        parsed.days = this.value;
        var isForecast = parseInt(this.value) > 1;
        leaf.operator = _buildWeatherOperator(opParsed.metric, opParsed.comparison, isForecast);
        leaf.value = _buildWeatherValue(parsed.threshold, parsed.days, parsed.location);
        _markDirty();
    };
    div.appendChild(_wrapWithLabel('Window', windowSelect));
}

function _getWeatherUnit(metric) {
    if (metric === 'temp_low' || metric === 'temp_high') return '°C';
    if (metric === 'wind_speed' || metric === 'wind_gusts') return 'km/h';
    if (metric === 'snowfall') return 'cm';
    return 'mm'; // precipitation, rain, showers
}

function _isKnownLocation(loc) {
    if (!loc || loc === '_default' || loc === '_manual') return false;
    if (!_cachedSavedLocations) return false;
    return _cachedSavedLocations.some(function(l) { return l && l.label === loc; });
}

function _wrapWithLabel(labelText, element) {
    var wrapper = document.createElement('div');
    wrapper.className = 'condition-field-wrapper';
    var label = document.createElement('span');
    label.className = 'condition-field-label';
    label.textContent = labelText;
    wrapper.appendChild(label);
    wrapper.appendChild(element);
    return wrapper;
}

function _renderLeaf(leaf) {
    var div = document.createElement('div');
    div.className = 'condition-leaf';
    div.dataset.nodeId = leaf._id;

    var fields = _getFieldsForTrigger();
    var isDateField = DATE_TYPE_FIELDS.indexOf(leaf.field) !== -1;
    var isWeatherField = leaf.field === '_weather';

    // Field dropdown (grouped by category)
    var fieldSelect = document.createElement('select');
    fieldSelect.title = 'Field';
    var fieldGroups = _getFieldGroups();
    fieldGroups.forEach(function(group) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = group.label;
        group.fields.forEach(function(f) {
            var opt = document.createElement('option');
            opt.value = f.value;
            opt.textContent = f.label;
            if (f.value === leaf.field) opt.selected = true;
            optgroup.appendChild(opt);
        });
        fieldSelect.appendChild(optgroup);
    });
    fieldSelect.onchange = function() {
        leaf.field = this.value;
        var newIsWeather = leaf.field === '_weather';
        var currentIsWeather = WEATHER_OPERATORS.indexOf(leaf.operator) !== -1;
        
        if (newIsWeather && !currentIsWeather) {
            leaf.operator = 'weather_temp_low_below';
            leaf.value = '0|1|_default';
        } else if (!newIsWeather && currentIsWeather) {
            leaf.operator = 'equals';
            leaf.value = '';
        } else if (!newIsWeather) {
            // Reset operator to first valid one for the new field if current is invalid
            var allowed = _getAllowedOperators(leaf.field);
            if (allowed && allowed.indexOf(leaf.operator) === -1) {
                leaf.operator = allowed[0];
                leaf.value = '';
            }
        }
        _markDirty();
        renderConditionTree();
    };

    div.appendChild(_wrapWithLabel('Field', fieldSelect));

    // ── Weather-specific multi-input builder ──
    if (isWeatherField) {
        _renderWeatherConditionInputs(div, leaf);
    } else {
        // ── Standard operator + value ──
        var allowedOps = _getAllowedOperators(leaf.field);
        var opSelect = document.createElement('select');
        opSelect.title = 'Operator';
        
        // Build operator dropdown filtered to allowed operators for this field
        OPERATOR_GROUPS.forEach(function(group) {
            if (group.label.indexOf('Weather') !== -1) return; // never show weather ops in standard mode
            
            var filteredOps = group.operators.filter(function(op) {
                return allowedOps.indexOf(op.value) !== -1;
            });
            
            if (filteredOps.length === 0) return;
            
            var optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            filteredOps.forEach(function(op) {
                var opt = document.createElement('option');
                opt.value = op.value;
                opt.textContent = op.label;
                if (op.value === leaf.operator) opt.selected = true;
                optgroup.appendChild(opt);
            });
            opSelect.appendChild(optgroup);
        });
        opSelect.onchange = function() {
            leaf.operator = this.value;
            _markDirty();
            renderConditionTree();
        };

        div.appendChild(_wrapWithLabel('Operator', opSelect));

        // Value input (hidden for is_empty / is_not_empty)
        if (NO_VALUE_OPERATORS.indexOf(leaf.operator) === -1) {
            var useSmartTag = (leaf.operator === 'tag_present' || leaf.operator === 'tag_not_present');
            var useSmartPerson = (leaf.operator === 'person_on_chit' || leaf.operator === 'person_not_on_chit');
            var useSmartLocation = (leaf.field === 'location' && ['equals', 'not_equals', 'contains'].indexOf(leaf.operator) !== -1);
            
            if (useSmartTag && _cachedTagList) {
                var tagNames = _cachedTagList.map(function(t) { return t.name; });
                var smartInput = _renderSearchableInput(leaf.value, tagNames, 'Search tags…', function(val) {
                    leaf.value = val;
                    _markDirty();
                });
                div.appendChild(_wrapWithLabel('Tag', smartInput));
            } else if (useSmartPerson && _cachedPeopleList) {
                var smartInput = _renderSearchableInput(leaf.value, _cachedPeopleList, 'Search people…', function(val) {
                    leaf.value = val;
                    _markDirty();
                });
                div.appendChild(_wrapWithLabel('Person', smartInput));
            } else if (useSmartLocation && _cachedLocationsList && _cachedLocationsList.length > 0) {
                var smartInput = _renderSearchableInput(leaf.value, _cachedLocationsList, 'Search locations…', function(val) {
                    leaf.value = val;
                    _markDirty();
                });
                div.appendChild(_wrapWithLabel('Location', smartInput));
            } else {
                var valueInput = document.createElement('input');
                valueInput.type = 'text';
                valueInput.placeholder = 'Value';
                valueInput.value = leaf.value || '';
                valueInput.oninput = function() {
                    leaf.value = this.value;
                    _markDirty();
                };
                div.appendChild(_wrapWithLabel('Value', valueInput));
            }
        }
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

        // Action type dropdown (grouped)
        var typeSelect = document.createElement('select');
        typeSelect.title = 'Action type';
        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '— Select action —';
        typeSelect.appendChild(defaultOpt);

        ACTION_GROUPS.forEach(function(group) {
            var optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            group.actions.forEach(function(at) {
                var opt = document.createElement('option');
                opt.value = at.value;
                opt.textContent = at.label;
                if (at.value === action.type) opt.selected = true;
                optgroup.appendChild(opt);
            });
            typeSelect.appendChild(optgroup);
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
        if (action.type === 'create_chit') {
            row.appendChild(removeBtn);
            container.appendChild(row);
            _renderCreateChitAction(action, container);
            return; // skip normal param rendering
        }
        if (action.type === 'create_reminder') {
            row.appendChild(removeBtn);
            container.appendChild(row);
            _renderCreateReminderAction(action, container);
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
                } else if (param.type === 'person') {
                    // Person picker with searchable dropdown
                    var personWrapper = document.createElement('div');
                    personWrapper.className = 'smart-input-wrapper';
                    var personInput = document.createElement('input');
                    personInput.type = 'text';
                    personInput.placeholder = param.label;
                    personInput.title = param.label;
                    personInput.value = action.params[param.key] || '';
                    personInput.className = 'smart-input-field';
                    var personDropdown = document.createElement('div');
                    personDropdown.className = 'smart-input-dropdown';
                    personDropdown.style.display = 'none';

                    (function(act, pKey, input, dropdown) {
                        function populateDropdown(filter) {
                            dropdown.innerHTML = '';
                            var people = _cachedPeopleList || [];
                            var q = (filter || '').toLowerCase();
                            var filtered = people.filter(function(p) {
                                return !q || p.toLowerCase().indexOf(q) !== -1;
                            });
                            if (filtered.length === 0) {
                                dropdown.style.display = 'none';
                                return;
                            }
                            filtered.slice(0, 15).forEach(function(name) {
                                var item = document.createElement('div');
                                item.className = 'smart-input-option';
                                item.textContent = name;
                                item.onmousedown = function(e) {
                                    e.preventDefault();
                                    input.value = name;
                                    act.params[pKey] = name;
                                    _markDirty();
                                    dropdown.style.display = 'none';
                                };
                                dropdown.appendChild(item);
                            });
                            dropdown.style.display = '';
                        }
                        input.onfocus = function() { populateDropdown(this.value); };
                        input.oninput = function() {
                            act.params[pKey] = this.value;
                            _markDirty();
                            populateDropdown(this.value);
                        };
                        input.onblur = function() {
                            setTimeout(function() { dropdown.style.display = 'none'; }, 150);
                        };
                    })(action, param.key, personInput, personDropdown);

                    personWrapper.appendChild(personInput);
                    personWrapper.appendChild(personDropdown);
                    row.appendChild(personWrapper);
                } else if (param.type === 'location') {
                    // Location picker with searchable dropdown
                    var locWrapper = document.createElement('div');
                    locWrapper.className = 'smart-input-wrapper';
                    var locInput = document.createElement('input');
                    locInput.type = 'text';
                    locInput.placeholder = param.label;
                    locInput.title = param.label;
                    locInput.value = action.params[param.key] || '';
                    locInput.className = 'smart-input-field';
                    var locDropdown = document.createElement('div');
                    locDropdown.className = 'smart-input-dropdown';
                    locDropdown.style.display = 'none';

                    (function(act, pKey, input, dropdown) {
                        function populateDropdown(filter) {
                            dropdown.innerHTML = '';
                            var locations = _cachedLocationsList || [];
                            var q = (filter || '').toLowerCase();
                            var filtered = locations.filter(function(l) {
                                return !q || l.toLowerCase().indexOf(q) !== -1;
                            });
                            if (filtered.length === 0) {
                                dropdown.style.display = 'none';
                                return;
                            }
                            filtered.slice(0, 15).forEach(function(name) {
                                var item = document.createElement('div');
                                item.className = 'smart-input-option';
                                item.textContent = name;
                                item.onmousedown = function(e) {
                                    e.preventDefault();
                                    input.value = name;
                                    act.params[pKey] = name;
                                    _markDirty();
                                    dropdown.style.display = 'none';
                                };
                                dropdown.appendChild(item);
                            });
                            dropdown.style.display = '';
                        }
                        input.onfocus = function() { populateDropdown(this.value); };
                        input.oninput = function() {
                            act.params[pKey] = this.value;
                            _markDirty();
                            populateDropdown(this.value);
                        };
                        input.onblur = function() {
                            setTimeout(function() { dropdown.style.display = 'none'; }, 150);
                        };
                    })(action, param.key, locInput, locDropdown);

                    locWrapper.appendChild(locInput);
                    locWrapper.appendChild(locDropdown);
                    row.appendChild(locWrapper);
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
    var habitTriggerConfig = document.getElementById('habit-trigger-config');

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

    // Show/hide habit trigger config
    if (trigger === 'habit_achieved' || trigger === 'habit_missed' || trigger === 'habit_due') {
        habitTriggerConfig.classList.add('visible');
        _loadHabitSources();
        // Show offset row only for habit_due
        var offsetRow = document.getElementById('habit-offset-row');
        if (trigger === 'habit_due') {
            offsetRow.style.display = '';
        } else {
            offsetRow.style.display = 'none';
        }
    } else {
        habitTriggerConfig.classList.remove('visible');
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

// ── Habit Trigger Source Loading ──

var _habitSourcesLoaded = false;

async function _loadHabitSources() {
    if (_habitSourcesLoaded) return;
    _habitSourcesLoaded = true;

    // Load habit rules
    try {
        var resp = await fetch('/api/rules?habit=true');
        if (resp.ok) {
            var rules = await resp.json();
            var ruleSelect = document.getElementById('habit-source-rule');
            rules.forEach(function(r) {
                // Don't show the current rule being edited as a source
                if (r.id === _ruleId) return;
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                ruleSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('[RuleEditor] Failed to load habit rules:', e);
    }

    // Load habit chits
    try {
        var resp2 = await fetch('/api/chits?habit=true&limit=200');
        if (resp2.ok) {
            var data = await resp2.json();
            var chits = data.chits || data || [];
            var chitSelect = document.getElementById('habit-source-chit');
            chits.forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.title || '(untitled)';
                chitSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('[RuleEditor] Failed to load habit chits:', e);
    }
}

function _onHabitSourceTypeChange() {
    var sourceType = document.getElementById('habit-source-type').value;
    var ruleRow = document.getElementById('habit-source-rule-row');
    var chitRow = document.getElementById('habit-source-chit-row');

    if (sourceType === 'rule') {
        ruleRow.style.display = '';
        chitRow.style.display = 'none';
    } else if (sourceType === 'chit') {
        ruleRow.style.display = 'none';
        chitRow.style.display = '';
    } else {
        // "any" — hide both specific selectors
        ruleRow.style.display = 'none';
        chitRow.style.display = 'none';
    }
    _markDirty();
}

// ── Cron Builder Logic ──

function _describeCron(expr) {
    /**
     * Client-side human-readable cron description.
     * Mirrors the backend describe() function for common patterns.
     */
    if (!expr || typeof expr !== 'string') return 'Invalid cron expression';
    var fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) return 'Invalid cron expression';

    var minF = fields[0], hourF = fields[1], domF = fields[2], monF = fields[3], dowF = fields[4];

    // Helper: format time as 12-hour with AM/PM
    function fmtTime(h, m) {
        var period = h < 12 ? 'AM' : 'PM';
        var dh = h % 12;
        if (dh === 0) dh = 12;
        return dh + ':' + (m < 10 ? '0' : '') + m + ' ' + period;
    }

    // Helper: check if a field is a single value
    function isSingle(f) { return /^\d+$/.test(f); }

    // Helper: check if field is wildcard
    function isWild(f) { return f === '*'; }

    // Every minute
    if (isWild(minF) && isWild(hourF) && isWild(domF) && isWild(monF) && isWild(dowF)) {
        return 'Every minute';
    }

    // Step minutes: */N * * * *
    if (/^\*\/\d+$/.test(minF) && isWild(hourF) && isWild(domF) && isWild(monF) && isWild(dowF)) {
        var step = minF.split('/')[1];
        return 'Every ' + step + ' minutes';
    }

    // Every hour at minute 0: 0 * * * *
    if (minF === '0' && isWild(hourF) && isWild(domF) && isWild(monF) && isWild(dowF)) {
        return 'Every hour';
    }

    // Every hour at minute M: M * * * *
    if (isSingle(minF) && isWild(hourF) && isWild(domF) && isWild(monF) && isWild(dowF)) {
        return 'Every hour at minute ' + minF;
    }

    // Specific time patterns (single minute + single hour)
    if (isSingle(minF) && isSingle(hourF)) {
        var h = parseInt(hourF, 10);
        var m = parseInt(minF, 10);
        var timeStr = fmtTime(h, m);

        // Every day: M H * * *
        if (isWild(domF) && isWild(monF) && isWild(dowF)) {
            return 'Every day at ' + timeStr;
        }

        // Weekdays: M H * * 1-5 or MON-FRI
        var dowNorm = dowF.toUpperCase().replace(/MON/g,'1').replace(/TUE/g,'2').replace(/WED/g,'3').replace(/THU/g,'4').replace(/FRI/g,'5').replace(/SAT/g,'6').replace(/SUN/g,'0');
        if (isWild(domF) && isWild(monF) && (dowNorm === '1-5' || dowF.toUpperCase() === 'MON-FRI')) {
            return 'Every weekday at ' + timeStr;
        }

        // Weekends: M H * * 0,6
        if (isWild(domF) && isWild(monF) && (dowNorm === '0,6' || dowNorm === '6,0')) {
            return 'Every weekend at ' + timeStr;
        }

        // First of month: M H 1 * *
        if (domF === '1' && isWild(monF) && isWild(dowF)) {
            return 'First of each month at ' + timeStr;
        }

        // Specific day of week
        if (isWild(domF) && isWild(monF) && isSingle(dowNorm)) {
            var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            var dayIdx = parseInt(dowNorm, 10);
            if (dayIdx >= 0 && dayIdx <= 6) {
                return 'Every ' + dayNames[dayIdx] + ' at ' + timeStr;
            }
        }
    }

    // Fallback: show the raw expression
    return 'Cron: ' + expr;
}

function _updateCronPreview() {
    var minVal = (document.getElementById('cron-minute').value || '*').trim();
    var hourVal = (document.getElementById('cron-hour').value || '*').trim();
    var domVal = (document.getElementById('cron-dom').value || '*').trim();
    var monVal = (document.getElementById('cron-month').value || '*').trim();
    var dowVal = (document.getElementById('cron-dow').value || '*').trim();
    var expr = minVal + ' ' + hourVal + ' ' + domVal + ' ' + monVal + ' ' + dowVal;
    var previewEl = document.getElementById('cron-preview-text');
    if (previewEl) previewEl.textContent = _describeCron(expr);
}

function _assembleCronExpression() {
    var minVal = (document.getElementById('cron-minute').value || '*').trim();
    var hourVal = (document.getElementById('cron-hour').value || '*').trim();
    var domVal = (document.getElementById('cron-dom').value || '*').trim();
    var monVal = (document.getElementById('cron-month').value || '*').trim();
    var dowVal = (document.getElementById('cron-dow').value || '*').trim();
    return minVal + ' ' + hourVal + ' ' + domVal + ' ' + monVal + ' ' + dowVal;
}

function _validateCronExpression(expr) {
    /**
     * Basic client-side cron validation:
     * - Must be 5 space-separated fields
     * - Each field must contain only valid cron characters: digits, *, -, /, comma, and letters (for day/month names)
     */
    if (!expr || typeof expr !== 'string') return false;
    var fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    var validPattern = /^[0-9\*\-\/,A-Za-z]+$/;
    for (var i = 0; i < fields.length; i++) {
        if (!validPattern.test(fields[i])) return false;
    }
    return true;
}

function _setCronFields(expr) {
    var fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) return;
    document.getElementById('cron-minute').value = fields[0];
    document.getElementById('cron-hour').value = fields[1];
    document.getElementById('cron-dom').value = fields[2];
    document.getElementById('cron-month').value = fields[3];
    document.getElementById('cron-dow').value = fields[4];
    _updateCronPreview();
}

function _getScheduleMode() {
    var toggle = document.getElementById('schedule-mode-toggle');
    return toggle ? toggle.value : 'simple';
}

function _setScheduleMode(mode) {
    var toggle = document.getElementById('schedule-mode-toggle');
    var pill = document.getElementById('schedule-mode-pill');
    if (!toggle || !pill) return;

    toggle.value = mode;
    var spans = pill.querySelectorAll('span[data-val]');
    spans.forEach(function(s) { s.classList.toggle('active', s.dataset.val === mode); });

    // Show/hide sections
    var simpleConfig = document.getElementById('schedule-simple-config');
    var cronConfig = document.getElementById('schedule-cron-config');
    if (mode === 'cron') {
        simpleConfig.classList.add('hidden');
        cronConfig.classList.remove('hidden');
    } else {
        simpleConfig.classList.remove('hidden');
        cronConfig.classList.add('hidden');
    }
}

function _initCronBuilder() {
    // Wire schedule mode toggle (cwoc-2val-toggle click pattern)
    var pill = document.getElementById('schedule-mode-pill');
    if (pill) {
        pill.addEventListener('click', function() {
            var hidden = document.getElementById('schedule-mode-toggle');
            var spans = pill.querySelectorAll('span[data-val]');
            var current = hidden.value;
            var next = (spans[0].dataset.val === current) ? spans[1].dataset.val : spans[0].dataset.val;
            _setScheduleMode(next);
            _markDirty();
        });
    }

    // Wire cron field inputs to update preview on change
    var cronFieldIds = ['cron-minute', 'cron-hour', 'cron-dom', 'cron-month', 'cron-dow'];
    cronFieldIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                _updateCronPreview();
                _markDirty();
            });
        }
    });

    // Wire preset buttons
    var presetBtns = document.querySelectorAll('.cron-preset-buttons button[data-cron]');
    presetBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var cronExpr = btn.getAttribute('data-cron');
            if (cronExpr) {
                _setCronFields(cronExpr);
                _markDirty();
            }
        });
    });

    // Wire habit mode checkbox
    var habitCheckbox = document.getElementById('rule-habit-mode');
    if (habitCheckbox) {
        habitCheckbox.addEventListener('change', _markDirty);
    }

    // Initial preview
    _updateCronPreview();
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

    // Validate cron expression if in cron mode
    if (trigger === 'scheduled' && _getScheduleMode() === 'cron') {
        var cronExpr = _assembleCronExpression();
        if (!_validateCronExpression(cronExpr)) {
            errors.push('Invalid cron expression. Must be 5 space-separated fields with valid characters (digits, *, -, /, commas, day/month names).');
        }
    }

    // Bundle rules don't need user-defined actions (auto-added on save)
    if (!window._isBundleRule) {
        if (_actions.length === 0) {
            errors.push('At least one action is required.');
        } else {
            var hasValidAction = _actions.some(function(a) { return a.type; });
            if (!hasValidAction) errors.push('At least one action must have a type selected.');
        }
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

    // For bundle rules: auto-add the "add_tag" action with the bundle tag
    if (window._isBundleRule && window._ruleBundleId) {
        // Get bundle name from the rule name ("Bundle: X" → X)
        var ruleName = payload.name || '';
        var bundleName = ruleName.replace(/^Bundle:\s*/, '');
        if (bundleName) {
            payload.actions = [{ type: 'add_tag', params: { tag: 'CWOC_System/Bundle/' + bundleName } }];
        }
    }

    // Schedule config
    if (payload.trigger_type === 'scheduled') {
        if (_getScheduleMode() === 'cron') {
            payload.schedule_config = {
                cron: _assembleCronExpression()
            };
        } else {
            payload.schedule_config = {
                frequency: document.getElementById('schedule-frequency').value,
                interval: parseInt(document.getElementById('schedule-interval').value, 10) || 1,
                time_of_day: document.getElementById('schedule-time').value || '09:00'
            };
        }
    }

    // Habit mode
    var habitCheckbox = document.getElementById('rule-habit-mode');
    if (habitCheckbox && habitCheckbox.checked) {
        payload.habit_mode = true;
    } else {
        payload.habit_mode = false;
    }

    // HA state change config
    if (payload.trigger_type === 'ha_state_change') {
        payload.schedule_config = {
            ha_entity_id: document.getElementById('ha-entity-id-input').value.trim()
        };
    }

    // Habit trigger config
    if (payload.trigger_type === 'habit_achieved' || payload.trigger_type === 'habit_missed' || payload.trigger_type === 'habit_due') {
        var sourceType = document.getElementById('habit-source-type').value;
        var htConfig = { source_type: sourceType };

        if (sourceType === 'rule') {
            htConfig.source_rule_id = document.getElementById('habit-source-rule').value;
        } else if (sourceType === 'chit') {
            htConfig.source_chit_id = document.getElementById('habit-source-chit').value;
        } else {
            // "any" — wildcard
            htConfig.source_rule_id = '*';
            htConfig.source_chit_id = '*';
        }

        if (payload.trigger_type === 'habit_due') {
            htConfig.offset_minutes = parseInt(document.getElementById('habit-offset-minutes').value, 10) || 0;
        }

        payload.habit_trigger_config = htConfig;
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

        // Associate rule with bundle if this is a new bundle rule
        if (window._ruleBundleId && saved.id) {
            try {
                await fetch('/api/bundles/' + encodeURIComponent(window._ruleBundleId) + '/rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rule_id: saved.id })
                });
                window._ruleBundleId = null; // Only associate once
            } catch (assocErr) {
                console.error('Failed to associate rule with bundle:', assocErr);
            }
        }

        // Update URL to include id for new rules
        if (!window.location.search.includes('id=')) {
            var newUrl = window.location.pathname + '?id=' + encodeURIComponent(_ruleId);
            window.history.replaceState(null, '', newUrl);
        }

        if (andExit) {
            var exitUrl = window._ruleReturnUrl || '/frontend/html/rules-manager.html';
            window.location.href = exitUrl;
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
        var exitUrl = window._ruleReturnUrl || '/frontend/html/rules-manager.html';
        window.location.href = exitUrl;
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

            // Detect cron mode vs simple mode
            if (sc.cron) {
                _setScheduleMode('cron');
                _setCronFields(sc.cron);
            } else {
                _setScheduleMode('simple');
                document.getElementById('schedule-frequency').value = sc.frequency || 'daily';
                document.getElementById('schedule-interval').value = sc.interval || 1;
                document.getElementById('schedule-time').value = sc.time_of_day || '09:00';
                _onScheduleFrequencyChange();
            }

            // HA state change entity_id
            if (sc.ha_entity_id) {
                document.getElementById('ha-entity-id-input').value = sc.ha_entity_id;
            }
        }

        // Habit mode
        var habitCheckbox = document.getElementById('rule-habit-mode');
        if (habitCheckbox) {
            habitCheckbox.checked = !!rule.habit_mode;
        }

        // Habit trigger config
        if (rule.habit_trigger_config) {
            var htc = typeof rule.habit_trigger_config === 'string'
                ? JSON.parse(rule.habit_trigger_config)
                : rule.habit_trigger_config;
            if (htc) {
                document.getElementById('habit-source-type').value = htc.source_type || 'rule';
                _onHabitSourceTypeChange();
                // Wait for sources to load, then set values
                _loadHabitSources().then(function() {
                    if (htc.source_rule_id) {
                        document.getElementById('habit-source-rule').value = htc.source_rule_id;
                    }
                    if (htc.source_chit_id) {
                        document.getElementById('habit-source-chit').value = htc.source_chit_id;
                    }
                });
                if (htc.offset_minutes !== undefined) {
                    document.getElementById('habit-offset-minutes').value = htc.offset_minutes;
                }
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

    // Initialize cron builder
    _initCronBuilder();

    // Wire up schedule-time to open drum roller picker on click
    var schedTimeEl = document.getElementById('schedule-time');
    if (schedTimeEl) {
        schedTimeEl.addEventListener('click', function() { if (typeof cwocTimePicker !== 'undefined') cwocTimePicker.open(schedTimeEl); });
    }

    // Bind HA trigger entity_id dirty tracking
    document.getElementById('ha-entity-id-input').addEventListener('input', _markDirty);

    // Bind habit trigger config controls
    document.getElementById('habit-source-type').addEventListener('change', function() {
        _onHabitSourceTypeChange();
        _markDirty();
    });
    document.getElementById('habit-source-rule').addEventListener('change', _markDirty);
    document.getElementById('habit-source-chit').addEventListener('change', _markDirty);
    document.getElementById('habit-offset-minutes').addEventListener('input', _markDirty);

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
    // Load people and locations for smart inputs
    _loadPeopleList();
    _loadLocationsList();

    // Initialize actions
    _actions = [];
    renderActions();

    // Check for existing rule ID in URL
    var params = new URLSearchParams(window.location.search);
    var ruleId = params.get('id');
    var returnUrl = params.get('return');
    var bundleId = params.get('bundle_id');
    var presetTrigger = params.get('trigger');

    // Override return URL if provided
    if (returnUrl) {
        _saveSystem.getReturnUrl = function() { return returnUrl; };
    }

    // Store bundle_id for association after save
    window._ruleBundleId = bundleId || null;
    window._ruleReturnUrl = returnUrl || null;

    if (ruleId) {
        _loadRule(ruleId);
    }

    // For new bundle rules: pre-set trigger and lock it
    if (!ruleId && presetTrigger) {
        var triggerEl = document.getElementById('rule-trigger');
        if (triggerEl) {
            triggerEl.value = presetTrigger;
            _onTriggerChange();
            // Lock trigger for bundle rules
            if (bundleId) {
                triggerEl.disabled = true;
                triggerEl.title = 'Bundle rules always use "Email Received" trigger';
            }
        }
    }

    // Bundle mode: auto-set name, description, hide actions
    if (bundleId && !ruleId) {
        window._isBundleRule = true;
        // Fetch bundle info to get name and description
        getCachedSettings().then(function(s) {
            var bundles = s.bundles || [];
            var bundle = bundles.find(function(b) { return b.id === bundleId; });
            if (bundle) {
                var nameEl = document.getElementById('rule-name');
                if (nameEl) {
                    nameEl.value = 'Bundle: ' + bundle.name;
                    nameEl.readOnly = true;
                    nameEl.style.opacity = '0.7';
                    nameEl.title = 'Bundle rule names are set automatically';
                }
                var descEl = document.getElementById('rule-description');
                if (descEl && bundle.description) {
                    descEl.value = bundle.description;
                }
            }
        });
        // Collapse actions section with new label — bundle rules auto-add the tag action,
        // but user can optionally add more actions
        var actionsSection = document.querySelector('.rule-section:has(#actions-container)') ||
                             document.getElementById('actions-container');
        if (actionsSection) {
            var parent = actionsSection.closest('.rule-section') || actionsSection;
            // Find or create a header for the section
            var sectionHeader = parent.querySelector('h3, .rule-section-header, label');
            if (sectionHeader) {
                sectionHeader.textContent = '▶ Also apply additional actions (optional)';
                sectionHeader.style.cursor = 'pointer';
                sectionHeader.style.opacity = '0.7';
                var actionsBody = parent.querySelector('#actions-container') || parent.querySelector('.rule-section-body');
                if (actionsBody) {
                    actionsBody.style.display = 'none';
                    sectionHeader.addEventListener('click', function() {
                        var isHidden = actionsBody.style.display === 'none';
                        actionsBody.style.display = isHidden ? '' : 'none';
                        sectionHeader.textContent = (isHidden ? '▼' : '▶') + ' Also apply additional actions (optional)';
                    });
                }
            } else {
                // Fallback: just collapse the whole section
                parent.style.display = 'none';
            }
        }

        // Hide trigger section — always "Email Received" for bundles
        var triggerSection = document.getElementById('rule-trigger');
        if (triggerSection) {
            var triggerParent = triggerSection.closest('.rule-section') || triggerSection.parentElement;
            if (triggerParent) triggerParent.style.display = 'none';
        }

        // Default "Confirm before applying" to NO for bundle rules
        var confirmEl = document.getElementById('rule-confirm');
        if (confirmEl) {
            confirmEl.checked = false;
            // Hide the confirm toggle — not relevant for bundles
            var confirmRow = confirmEl.closest('.rule-toggle-row') || confirmEl.parentElement;
            if (confirmRow) confirmRow.style.display = 'none';
        }
    }
});
