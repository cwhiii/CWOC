/* ═══════════════════════════════════════════════════════════════════════════
   Rules Manager Page — rules-manager.js

   Fetches and displays rules, handles toggle/reorder/delete, and manages
   pending confirmations. Loaded by rules-manager.html.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── State ──
var _rules = [];
var _confirmations = [];
var _dragRuleId = null;

// ── Helpers ──
function _escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function _formatTimestamp(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var yr = d.getFullYear();
    var mon = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hr = String(d.getHours()).padStart(2, '0');
    var mn = String(d.getMinutes()).padStart(2, '0');
    return yr + '-' + mon + '-' + day + ' ' + hr + ':' + mn;
}

function _triggerLabel(type) {
    var labels = {
        'chit_created': 'Chit Created',
        'chit_updated': 'Chit Updated',
        'email_received': 'Email Received',
        'contact_created': 'Contact Created',
        'contact_updated': 'Contact Updated',
        'scheduled': 'Scheduled'
    };
    return labels[type] || type || '—';
}

// ── Fetch Rules ──
async function loadRules() {
    try {
        var resp = await fetch('/api/rules');
        if (!resp.ok) throw new Error('Failed to fetch rules');
        _rules = await resp.json();
    } catch (e) {
        console.error('Error loading rules:', e);
        _rules = [];
    }
    renderRulesTable();
}

// ── Render Rules Table ──
function renderRulesTable() {
    var wrap = document.getElementById('rules-table-wrap');
    if (!wrap) return;

    if (_rules.length === 0) {
        wrap.innerHTML = '<div class="cwoc-empty">No rules yet. Click "New Rule" to create your first automation.</div>';
        return;
    }

    var html = '<table class="cwoc-table" id="rules-table">';
    html += '<thead><tr>';
    html += '<th style="width:30px;"></th>';  // drag handle
    html += '<th style="width:50px;">On</th>';
    html += '<th>Name</th>';
    html += '<th>Trigger</th>';
    html += '<th style="width:60px;">Priority</th>';
    html += '<th>Last Run</th>';
    html += '<th style="width:60px;">Runs</th>';
    html += '<th style="width:40px;"></th>';  // delete
    html += '</tr></thead><tbody>';

    _rules.forEach(function(rule) {
        html += '<tr draggable="true" data-rule-id="' + _escHtml(rule.id) + '">';
        html += '<td><span class="rule-drag-handle" title="Drag to reorder">☰</span></td>';
        html += '<td>';
        html += '  <label class="rule-enabled-toggle">';
        html += '    <input type="checkbox" ' + (rule.enabled ? 'checked' : '') + ' onchange="toggleRule(\'' + _escHtml(rule.id) + '\')" />';
        html += '    <span class="rule-enabled-slider"></span>';
        html += '  </label>';
        html += '</td>';
        html += '<td><a class="rule-name-link" href="/frontend/html/rule-editor.html?id=' + encodeURIComponent(rule.id) + '">' + _escHtml(rule.name) + '</a></td>';
        html += '<td><span class="trigger-badge ' + _escHtml(rule.trigger_type || '') + '">' + _escHtml(_triggerLabel(rule.trigger_type)) + '</span></td>';
        html += '<td style="text-align:center;">' + (rule.priority != null ? rule.priority : '—') + '</td>';
        html += '<td>' + _formatTimestamp(rule.last_run_datetime) + '</td>';
        html += '<td style="text-align:center;">' + (rule.run_count || 0) + '</td>';
        html += '<td><button class="rule-delete-btn" onclick="deleteRule(\'' + _escHtml(rule.id) + '\', \'' + _escHtml(rule.name).replace(/'/g, "\\'") + '\')" title="Delete rule">🗑️</button></td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Attach drag-and-drop for reorder
    _initDragReorder();
}

// ── Toggle Rule Enabled ──
async function toggleRule(ruleId) {
    try {
        var resp = await fetch('/api/rules/' + encodeURIComponent(ruleId) + '/toggle', {
            method: 'PATCH'
        });
        if (!resp.ok) throw new Error('Toggle failed');
        var updated = await resp.json();
        // Update local state
        var rule = _rules.find(function(r) { return r.id === ruleId; });
        if (rule) rule.enabled = updated.enabled;
    } catch (e) {
        console.error('Error toggling rule:', e);
        cwocToast('Failed to toggle rule', 'error');
        loadRules(); // reload to reset state
    }
}

// ── Delete Rule ──
async function deleteRule(ruleId, ruleName) {
    var confirmed = await cwocConfirm(
        'Delete rule "' + ruleName + '"? This cannot be undone.',
        { title: 'Delete Rule', confirmLabel: 'Delete', danger: true }
    );
    if (!confirmed) return;

    try {
        var resp = await fetch('/api/rules/' + encodeURIComponent(ruleId), {
            method: 'DELETE'
        });
        if (!resp.ok) throw new Error('Delete failed');
        cwocToast('Rule deleted');
        loadRules();
    } catch (e) {
        console.error('Error deleting rule:', e);
        cwocToast('Failed to delete rule', 'error');
    }
}

// ── Drag-and-Drop Reorder ──
function _initDragReorder() {
    var table = document.getElementById('rules-table');
    if (!table) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.addEventListener('dragstart', function(e) {
        var row = e.target.closest('tr[data-rule-id]');
        if (!row) return;
        _dragRuleId = row.dataset.ruleId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', _dragRuleId);
        row.classList.add('rule-dragging');
    });

    tbody.addEventListener('dragend', function(e) {
        var row = e.target.closest('tr[data-rule-id]');
        if (row) row.classList.remove('rule-dragging');
        tbody.querySelectorAll('tr').forEach(function(r) {
            r.classList.remove('rule-drag-over');
        });
        _dragRuleId = null;
    });

    tbody.addEventListener('dragover', function(e) {
        if (!_dragRuleId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var row = e.target.closest('tr[data-rule-id]');
        tbody.querySelectorAll('tr').forEach(function(r) {
            r.classList.remove('rule-drag-over');
        });
        if (row && row.dataset.ruleId !== _dragRuleId) {
            row.classList.add('rule-drag-over');
        }
    });

    tbody.addEventListener('drop', function(e) {
        if (!_dragRuleId) return;
        e.preventDefault();
        var targetRow = e.target.closest('tr[data-rule-id]');
        if (!targetRow || targetRow.dataset.ruleId === _dragRuleId) return;

        // Compute new order from DOM
        var rows = Array.from(tbody.querySelectorAll('tr[data-rule-id]'));
        var ids = rows.map(function(r) { return r.dataset.ruleId; });
        var fromIdx = ids.indexOf(_dragRuleId);
        var toIdx = ids.indexOf(targetRow.dataset.ruleId);
        if (fromIdx < 0 || toIdx < 0) return;

        // Move in array
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, _dragRuleId);

        _saveReorder(ids);
    });
}

async function _saveReorder(ruleIds) {
    try {
        var resp = await fetch('/api/rules/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_ids: ruleIds })
        });
        if (!resp.ok) throw new Error('Reorder failed');
        loadRules();
    } catch (e) {
        console.error('Error reordering rules:', e);
        cwocToast('Failed to reorder rules', 'error');
        loadRules();
    }
}

// ── Pending Confirmations ──
async function loadConfirmations() {
    try {
        var resp = await fetch('/api/rules/confirmations');
        if (!resp.ok) throw new Error('Failed to fetch confirmations');
        _confirmations = await resp.json();
    } catch (e) {
        console.error('Error loading confirmations:', e);
        _confirmations = [];
    }
    renderConfirmations();
}

function renderConfirmations() {
    var section = document.getElementById('confirmations-section');
    var countEl = document.getElementById('confirmations-count');
    var body = document.getElementById('confirmations-body');
    if (!section || !body) return;

    if (_confirmations.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    if (countEl) countEl.textContent = _confirmations.length;

    var html = '';
    _confirmations.forEach(function(c) {
        html += '<div class="confirmation-card" data-confirmation-id="' + _escHtml(c.id) + '">';
        html += '  <div class="confirmation-info">';
        html += '    <div class="confirmation-rule-name">🤖 ' + _escHtml(c.rule_name) + '</div>';
        html += '    <div class="confirmation-description">' + _escHtml(c.action_description) + '</div>';
        html += '    <div class="confirmation-time">' + _formatTimestamp(c.created_datetime) + '</div>';
        html += '  </div>';
        html += '  <div class="confirmation-actions">';
        html += '    <button class="cwoc-btn" onclick="acceptConfirmation(\'' + _escHtml(c.id) + '\')">✅ Accept</button>';
        html += '    <button class="cwoc-btn danger" onclick="dismissConfirmation(\'' + _escHtml(c.id) + '\')">❌ Dismiss</button>';
        html += '  </div>';
        html += '</div>';
    });
    body.innerHTML = html;
}

function toggleConfirmations() {
    var body = document.getElementById('confirmations-body');
    var toggle = document.getElementById('confirmations-toggle');
    if (!body || !toggle) return;
    body.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
}

async function acceptConfirmation(confirmationId) {
    try {
        var resp = await fetch('/api/rules/confirmations/' + encodeURIComponent(confirmationId) + '/accept', {
            method: 'POST'
        });
        if (!resp.ok) throw new Error('Accept failed');
        cwocToast('Action applied');
        loadConfirmations();
        loadRules();
    } catch (e) {
        console.error('Error accepting confirmation:', e);
        cwocToast('Failed to accept confirmation', 'error');
    }
}

async function dismissConfirmation(confirmationId) {
    try {
        var resp = await fetch('/api/rules/confirmations/' + encodeURIComponent(confirmationId) + '/dismiss', {
            method: 'POST'
        });
        if (!resp.ok) throw new Error('Dismiss failed');
        cwocToast('Action dismissed');
        loadConfirmations();
    } catch (e) {
        console.error('Error dismissing confirmation:', e);
        cwocToast('Failed to dismiss confirmation', 'error');
    }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', function() {
    loadRules();
    loadConfirmations();
});
