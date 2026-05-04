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
    { value: 'add_matching_contacts_as_people', label: 'Add Matching Contacts as People', params: [{ key: 'match_field', label: 'Match Field', type: 'select', options: ['city', 'state', 'country'] }] }
];

// ── Get Fields for Current Trigger ──
function _getFieldsForTrigger() {
    var trigger = document.getElementById('rule-trigger').value;
    if (trigger === 'email_received') return EMAIL_FIELDS;
    if (trigger === 'contact_created' || trigger === 'contact_updated') return CONTACT_FIELDS;
    return CHIT_FIELDS; // default for chit_created, chit_updated, scheduled
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

        // Parameter inputs (dynamic based on action type)
        var actionDef = CHIT_ACTION_TYPES.find(function(at) { return at.value === action.type; });
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

        // Remove button
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'action-row-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove action';
        removeBtn.onclick = function() { removeAction(idx); };
        row.appendChild(removeBtn);

        container.appendChild(row);
    });
}

// ── Trigger Change Handler ──
function _onTriggerChange() {
    var trigger = document.getElementById('rule-trigger').value;
    var scheduleConfig = document.getElementById('schedule-config');

    // Show/hide schedule config
    if (trigger === 'scheduled') {
        scheduleConfig.classList.add('visible');
    } else {
        scheduleConfig.classList.remove('visible');
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
        actions: _actions.filter(function(a) { return a.type; }),
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
        _actions = Array.isArray(actions) ? actions : [];
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
