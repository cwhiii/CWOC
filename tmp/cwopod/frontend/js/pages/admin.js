/**
 * Admin page — system settings, user management, resource usage & cost estimator.
 * Only accessible to admin users.
 */

import { api } from '../api.js';
import { showError, showSuccess, clearMessages, setLoading, escapeHtml } from '../dom.js';
import { isAdmin } from '../auth.js';
import { navigate } from '../router.js';

export async function render($container, params) {
    console.log('[Admin] Rendering admin page');

    if (!isAdmin()) {
        console.warn('[Admin] Non-admin user attempted to access admin page');
        navigate('/settings');
        return;
    }

    $container.html(`
        <h1>Admin</h1>
        <nav class="admin-tabs">
            <button class="admin-tab active" data-tab="resources">Resource Usage</button>
            <button class="admin-tab" data-tab="settings">System Settings</button>
            <button class="admin-tab" data-tab="users">User Management</button>
        </nav>
        <div id="admin-tab-content"></div>
    `);

    // Tab switching
    $container.find('.admin-tab').on('click', function () {
        const tab = $(this).data('tab');
        console.log('[Admin] Switching to tab:', tab);
        $container.find('.admin-tab').removeClass('active');
        $(this).addClass('active');
        renderTab(tab);
    });

    // Load default tab
    renderTab('resources');

    function renderTab(tab) {
        const $content = $container.find('#admin-tab-content');
        $content.html('<p class="loading">Loading...</p>');
        if (tab === 'resources') loadResources($content);
        else if (tab === 'settings') loadSettings($content);
        else if (tab === 'users') loadUsers($content);
    }

    // --- Resource Usage Tab ---
    async function loadResources($content) {
        console.log('[Admin] Loading resource usage data');
        try {
            const [live, history, projects, estimate] = await Promise.all([
                api.get('/admin/resources/live'),
                api.get('/admin/resources/history?days=30'),
                api.get('/admin/resources/projects?limit=20'),
                api.get('/admin/resources/estimate'),
            ]);
            console.log('[Admin] Resource data loaded:', { live, history, projects, estimate });
            renderResources($content, live, history, projects, estimate);
        } catch (err) {
            console.error('[Admin] Resource load failed:', err.message);
            $content.html(`<p class="error">Failed to load resource data: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderResources($content, live, history, projects, estimate) {
        let html = '<div class="admin-resources">';

        // Live system stats
        html += '<div class="settings-section">';
        html += '<h3>Live System Status</h3>';
        html += '<div class="resource-grid">';
        html += `<div class="resource-card">
            <span class="resource-label">CPU</span>
            <span class="resource-value">${live.cpu_percent}%</span>
            <span class="resource-detail">${live.cpu_count} cores, load ${live.load_avg_1m || '?'}</span>
        </div>`;
        html += `<div class="resource-card">
            <span class="resource-label">RAM</span>
            <span class="resource-value">${live.ram_percent}%</span>
            <span class="resource-detail">${Math.round(live.ram_used_mb)} / ${Math.round(live.ram_total_mb)} MB</span>
        </div>`;
        html += `<div class="resource-card">
            <span class="resource-label">Disk</span>
            <span class="resource-value">${live.disk_total_gb ? Math.round((live.disk_used_gb / live.disk_total_gb) * 100) : 0}%</span>
            <span class="resource-detail">${live.disk_used_gb} / ${live.disk_total_gb} GB</span>
        </div>`;
        if (live.gpu) {
            html += `<div class="resource-card">
                <span class="resource-label">GPU (${escapeHtml(live.gpu.name)})</span>
                <span class="resource-value">${live.gpu.utilization_pct}%</span>
                <span class="resource-detail">${Math.round(live.gpu.memory_used_mb)} / ${Math.round(live.gpu.memory_total_mb)} MB VRAM, ${live.gpu.temperature_c}°C</span>
            </div>`;
        } else {
            html += `<div class="resource-card">
                <span class="resource-label">GPU</span>
                <span class="resource-value">N/A</span>
                <span class="resource-detail">No GPU detected (nvidia-smi not found)</span>
            </div>`;
        }
        html += '</div>';
        html += '<button class="btn btn-sm secondary" id="refresh-live">Refresh</button>';
        html += '</div>';

        // Cost Estimate
        html += '<div class="settings-section">';
        html += '<h3>Cloud Cost Estimate (Last 30 Days)</h3>';
        if (estimate.usage_summary.total_operations === 0) {
            html += '<p class="hint">No resource usage recorded yet. Process some books and the estimator will calculate costs based on actual usage.</p>';
        } else {
            html += `<p class="hint">Based on <strong>${estimate.usage_summary.total_operations}</strong> operations over the last 30 days. `;
            html += `Total compute: ${estimate.usage_summary.total_wall_hours}h wall, ${estimate.usage_summary.total_cpu_hours}h CPU`;
            if (estimate.usage_summary.total_gpu_hours > 0) html += `, ${estimate.usage_summary.total_gpu_hours}h GPU`;
            html += `. Peak RAM: ${estimate.usage_summary.peak_ram_gb} GB.`;
            if (estimate.usage_summary.needs_gpu) html += ' <strong>GPU required.</strong>';
            html += '</p>';

            // Per-book cost comparison across providers
            if (estimate.per_book_estimate && Object.keys(estimate.per_book_estimate).length > 0) {
                html += '<h4 style="margin-top:1rem;">Estimated Cost Per Book</h4>';
                html += '<table class="table-compact"><thead><tr><th>Provider</th><th>Instance</th><th>Cost/Book</th></tr></thead><tbody>';
                for (const [provKey, costs] of Object.entries(estimate.per_book_estimate)) {
                    const provName = estimate.providers[provKey]?.name || provKey;
                    for (const pb of costs) {
                        html += `<tr><td>${escapeHtml(provName)}</td><td><code>${escapeHtml(pb.instance)}</code></td><td>$${pb.cost_per_book.toFixed(4)}</td></tr>`;
                    }
                }
                html += '</tbody></table>';
            }

            // Per-provider detailed projections
            for (const [provKey, provData] of Object.entries(estimate.providers)) {
                html += `<h4 style="margin-top:1.5rem;"><a href="${escapeHtml(provData.url)}" target="_blank" rel="noopener">${escapeHtml(provData.name)} ↗</a></h4>`;
                html += `<p class="hint">Recommended: <code>${escapeHtml(provData.recommended)}</code></p>`;
                html += '<table class="table-compact"><thead><tr><th>Instance</th><th>Description</th><th>On-Demand</th><th>Always-On</th></tr></thead><tbody>';
                for (const p of provData.projections) {
                    const onDemand = p.monthly_cost_on_demand !== null ? `$${p.monthly_cost_on_demand.toFixed(2)}` : '<span class="hint">—</span>';
                    html += `<tr><td><code>${escapeHtml(p.instance)}</code></td><td>${escapeHtml(p.description)}</td><td>${onDemand}</td><td>$${p.monthly_cost_always_on.toFixed(2)}</td></tr>`;
                    if (p.note) html += `<tr><td colspan="4" class="hint" style="padding-left:1rem;">${escapeHtml(p.note)}</td></tr>`;
                }
                html += '</tbody></table>';
            }
            html += '<p class="hint" style="margin-top:0.75rem;">On-demand = pay only for hours of active compute. Always-on = server running 24/7 (730 hrs/month). Prices are approximate on-demand rates as of mid-2026. Hetzner dedicated GPU servers are monthly flat-rate.</p>';
        }
        html += '</div>';

        // Historical usage by operation
        html += '<div class="settings-section">';
        html += '<h3>Usage by Operation (Last 30 Days)</h3>';
        if (history.by_operation.length === 0) {
            html += '<p class="hint">No operations recorded yet.</p>';
        } else {
            html += '<table class="table-compact"><thead><tr><th>Operation</th><th>Count</th><th>Total Time</th><th>Avg Time</th><th>Avg RAM</th></tr></thead><tbody>';
            for (const op of history.by_operation) {
                const gpuCol = op.total_gpu_time_min > 0 ? ` (${op.total_gpu_time_min}m GPU)` : '';
                html += `<tr>
                    <td>${escapeHtml(op.operation)}</td>
                    <td>${op.count}</td>
                    <td>${op.total_wall_time_min} min${gpuCol}</td>
                    <td>${op.avg_wall_time_sec}s</td>
                    <td>${op.avg_ram_mb} MB</td>
                </tr>`;
            }
            html += '</tbody></table>';
        }
        html += '</div>';

        // Daily history
        html += '<div class="settings-section">';
        html += '<h3>Daily History</h3>';
        if (history.daily.length === 0) {
            html += '<p class="hint">No daily data yet.</p>';
        } else {
            html += '<table class="table-compact"><thead><tr><th>Date</th><th>Ops</th><th>Wall Time</th><th>CPU Time</th><th>GPU Time</th><th>Peak RAM</th></tr></thead><tbody>';
            for (const day of history.daily.slice(-14)) {
                html += `<tr>
                    <td>${escapeHtml(day.date)}</td>
                    <td>${day.operations}</td>
                    <td>${day.wall_time_min} min</td>
                    <td>${day.cpu_time_min} min</td>
                    <td>${day.gpu_time_min} min</td>
                    <td>${day.peak_ram_mb} MB</td>
                </tr>`;
            }
            html += '</tbody></table>';
        }
        html += '</div>';

        // Per-project usage
        html += '<div class="settings-section">';
        html += '<h3>Per-Project Resource Usage</h3>';
        if (projects.projects.length === 0) {
            html += '<p class="hint">No per-project data yet. Resource tracking starts recording as you process books.</p>';
        } else {
            html += '<table class="table-compact"><thead><tr><th>Project</th><th>Ops</th><th>Wall Time</th><th>CPU</th><th>GPU</th><th>Peak RAM</th></tr></thead><tbody>';
            for (const p of projects.projects) {
                const title = p.title.length > 40 ? p.title.substring(0, 37) + '...' : p.title;
                html += `<tr>
                    <td><a href="/projects/${escapeHtml(p.project_id)}">${escapeHtml(title)}</a></td>
                    <td>${p.operation_count}</td>
                    <td>${p.total_wall_time_min} min</td>
                    <td>${p.total_cpu_time_min} min</td>
                    <td>${p.total_gpu_time_min} min</td>
                    <td>${p.peak_ram_mb} MB</td>
                </tr>`;
            }
            html += '</tbody></table>';
        }
        html += '</div>';

        html += '</div>'; // close .admin-resources
        $content.html(html);

        // Refresh button
        $content.find('#refresh-live').on('click', () => loadResources($content));
    }

    // --- System Settings Tab ---
    async function loadSettings($content) {
        console.log('[Admin] Loading system settings');
        try {
            const [data, profanityData] = await Promise.all([
                api.get('/admin/settings'),
                api.get('/admin/profanity-word-list'),
            ]);
            console.log('[Admin] System settings loaded:', data);
            console.log('[Admin] Profanity word list loaded: word_count=', profanityData.word_count);
            $content.html(`
                <div class="settings-section">
                    <h3>System Settings</h3>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="allow-registration" ${data.allow_public_registration ? 'checked' : ''}>
                            Allow public registration
                        </label>
                        <p class="hint">When disabled, only admins can create new user accounts.</p>
                    </div>
                    <hr style="border-color: var(--tan, #d2b48c); margin: 1.5rem 0;">
                    <h4>Default Local AI Models</h4>
                    <p class="hint">System-wide defaults for users who haven't configured their own.</p>
                    <div class="form-group">
                        <label>Text Model (Ollama)</label>
                        <input type="text" id="default-text-model" value="${escapeHtml(data.default_text_model || '')}" maxlength="200" placeholder="llama3.2:1b">
                        <p class="hint">Used for spellcheck and cover prompt generation.</p>
                    </div>
                    <div class="form-group">
                        <label>Image Model (ComfyUI)</label>
                        <input type="text" id="default-image-model" value="${escapeHtml(data.default_image_model || '')}" maxlength="200" placeholder="v1-5-pruned-emaonly.safetensors">
                        <p class="hint">Checkpoint filename for cover image generation.</p>
                    </div>
                    <button class="btn primary" id="save-admin-settings">Save</button>
                </div>
                <div class="settings-section">
                    <h3>Profanity Filter Word List</h3>
                    <p class="hint">One word or phrase per line. This list is used system-wide when users enable the profanity filter. Matched words are replaced with █ blocks in printed text, or silently stripped from AI prompts. Currently <strong>${profanityData.word_count}</strong> entries.</p>
                    <details id="profanity-list-details" style="border:1px solid var(--tan, #d2b48c); border-radius:6px; padding:0.75rem; margin-top:0.75rem;">
                        <summary style="cursor:pointer; font-weight:600;">Edit Word List (${profanityData.word_count} words)</summary>
                        <div style="margin-top:0.75rem;">
                            <textarea id="profanity-word-list" rows="20" style="width:100%; font-family:monospace; font-size:0.8rem; resize:vertical;">${escapeHtml(profanityData.word_list)}</textarea>
                            <div class="actions" style="margin-top:0.75rem; gap:0.5rem;">
                                <button class="btn primary" id="save-profanity-list">Save Word List</button>
                                <button class="btn secondary" id="reset-profanity-list">Reset to Default</button>
                            </div>
                        </div>
                    </details>
                </div>
            `);

            $content.find('#save-admin-settings').on('click', async function () {
                const $btn = $(this);
                setLoading($btn, true, 'Saving...');
                clearMessages($content);
                try {
                    await api.patch('/admin/settings', {
                        allow_public_registration: $content.find('#allow-registration').is(':checked'),
                        default_text_model: $content.find('#default-text-model').val().trim() || null,
                        default_image_model: $content.find('#default-image-model').val().trim() || null,
                    });
                    console.log('[Admin] Settings saved');
                    showSuccess($content, 'System settings saved.');
                    setTimeout(() => clearMessages($content), 3000);
                } catch (err) {
                    console.error('[Admin] Settings save failed:', err.message);
                    showError($content, err.message);
                } finally { setLoading($btn, false); }
            });

            // Save profanity word list
            $content.find('#save-profanity-list').on('click', async function () {
                const $btn = $(this);
                setLoading($btn, true, 'Saving...');
                clearMessages($content);
                const wordList = $content.find('#profanity-word-list').val();
                console.log('[Admin] Saving profanity word list');
                try {
                    const result = await api.put('/admin/profanity-word-list', { word_list: wordList });
                    console.log('[Admin] Profanity word list saved:', result.word_count, 'words');
                    showSuccess($content, `Word list saved (${result.word_count} entries).`);
                    $content.find('#profanity-list-details summary').text(`Edit Word List (${result.word_count} words)`);
                    setTimeout(() => clearMessages($content), 3000);
                } catch (err) {
                    console.error('[Admin] Profanity word list save failed:', err.message);
                    showError($content, err.message);
                } finally { setLoading($btn, false); }
            });

            // Reset profanity word list to default
            $content.find('#reset-profanity-list').on('click', async function () {
                if (!confirm('Reset the word list to the shipped default? Your customizations will be lost.')) return;
                const $btn = $(this);
                setLoading($btn, true, 'Resetting...');
                clearMessages($content);
                console.log('[Admin] Resetting profanity word list to default');
                try {
                    const result = await api.post('/admin/profanity-word-list/reset');
                    console.log('[Admin] Profanity word list reset:', result.word_count, 'words');
                    $content.find('#profanity-word-list').val(result.word_list);
                    $content.find('#profanity-list-details summary').text(`Edit Word List (${result.word_count} words)`);
                    showSuccess($content, `Word list reset to default (${result.word_count} entries).`);
                    setTimeout(() => clearMessages($content), 3000);
                } catch (err) {
                    console.error('[Admin] Profanity word list reset failed:', err.message);
                    showError($content, err.message);
                } finally { setLoading($btn, false); }
            });
        } catch (err) {
            console.error('[Admin] Settings load failed:', err.message);
            $content.html(`<p class="error">Failed to load settings: ${escapeHtml(err.message)}</p>`);
        }
    }

    // --- User Management Tab ---
    async function loadUsers($content) {
        console.log('[Admin] Loading user management');
        try {
            const data = await api.get('/admin/users');
            console.log('[Admin] Users loaded:', data.users.length);
            let html = '<div class="settings-section">';
            html += '<h3>User Management</h3>';
            html += `<table class="table-compact" style="width:100%;"><thead><tr>
                <th>Email</th><th>Name</th><th style="text-align:center;">Admin</th><th style="text-align:right;">Actions</th>
            </tr></thead><tbody>`;
            for (const u of data.users) {
                html += `<tr>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${escapeHtml(u.display_name || '—')}</td>
                    <td style="text-align:center;">${u.is_admin ? '✓' : ''}</td>
                    <td style="text-align:right;">
                        <button class="btn btn-sm secondary toggle-admin" data-id="${u.id}" data-admin="${u.is_admin}">${u.is_admin ? 'Revoke Admin' : 'Make Admin'}</button>
                        <button class="btn btn-sm btn-danger delete-user" data-id="${u.id}" data-email="${escapeHtml(u.email)}">Delete</button>
                    </td>
                </tr>`;
            }
            html += '</tbody></table>';

            html += `<details style="margin-top:1rem; border:1px solid var(--tan, #d2b48c); border-radius:6px; padding:0.75rem;">
                <summary style="cursor:pointer; font-weight:600;">Create New User</summary>
                <div style="margin-top:0.75rem;">
                    <div class="form-group"><label>Email</label><input type="email" id="new-user-email" maxlength="254"></div>
                    <div class="form-group"><label>Password (min 8 chars)</label><input type="password" id="new-user-password" maxlength="128"></div>
                    <div class="form-group"><label>Display Name</label><input type="text" id="new-user-name" maxlength="100"></div>
                    <div class="form-group"><label><input type="checkbox" id="new-user-admin"> Admin</label></div>
                    <button class="btn primary" id="create-user-btn">Create User</button>
                </div>
            </details>`;
            html += '</div>';
            $content.html(html);

            // Create user
            $content.find('#create-user-btn').on('click', async function () {
                const $btn = $(this);
                setLoading($btn, true, 'Creating...');
                clearMessages($content);
                const email = $content.find('#new-user-email').val().trim();
                const password = $content.find('#new-user-password').val();
                const display_name = $content.find('#new-user-name').val().trim() || null;
                const is_admin = $content.find('#new-user-admin').is(':checked');
                if (!email || !password || password.length < 8) {
                    showError($content, 'Email and password (min 8 chars) required.');
                    setLoading($btn, false);
                    return;
                }
                try {
                    await api.post('/admin/users', { email, password, display_name, is_admin });
                    console.log('[Admin] User created:', email);
                    showSuccess($content, `User ${email} created.`);
                    setTimeout(() => loadUsers($content), 1500);
                } catch (err) {
                    console.error('[Admin] Create user failed:', err.message);
                    showError($content, err.message);
                } finally { setLoading($btn, false); }
            });

            // Toggle admin
            $content.find('.toggle-admin').on('click', async function () {
                const id = $(this).data('id');
                const currentlyAdmin = String($(this).data('admin')) === 'true';
                clearMessages($content);
                try {
                    await api.patch(`/admin/users/${id}`, { is_admin: !currentlyAdmin });
                    console.log('[Admin] Toggled admin for:', id);
                    loadUsers($content);
                } catch (err) {
                    console.error('[Admin] Toggle admin failed:', err.message);
                    showError($content, err.message);
                }
            });

            // Delete user
            $content.find('.delete-user').on('click', async function () {
                const id = $(this).data('id');
                const email = $(this).data('email');
                if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
                clearMessages($content);
                try {
                    await api.delete(`/admin/users/${id}`);
                    console.log('[Admin] Deleted user:', id);
                    showSuccess($content, `User ${email} deleted.`);
                    setTimeout(() => loadUsers($content), 1500);
                } catch (err) {
                    console.error('[Admin] Delete user failed:', err.message);
                    showError($content, err.message);
                }
            });
        } catch (err) {
            console.error('[Admin] Users load failed:', err.message);
            $content.html(`<p class="error">Failed to load users: ${escapeHtml(err.message)}</p>`);
        }
    }
}
