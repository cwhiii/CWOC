/**
 * Settings page — AI config, print credentials, source credentials, profile.
 */

import { api } from '../api.js';
import { showError, showSuccess, clearMessages, setLoading, escapeHtml } from '../dom.js';
import { logout } from '../auth.js';

export async function render($container, params) {
    console.log('[Settings] Rendering settings page');

    $container.html(`
        <h1>Settings</h1>
        <div id="section-ai" class="settings-section"><h3>AI Configuration</h3><p class="loading">Loading...</p></div>
        <div id="section-sources" class="settings-section"><h3>Book Sources</h3><p class="loading">Loading...</p></div>
        <div id="section-catalog" class="settings-section"><h3>Book Catalog Cache</h3><p class="loading">Loading...</p></div>
        <div id="section-shared-images" class="settings-section"><h3>Shared Images</h3><p class="loading">Loading...</p></div>
        <div id="section-print-provider" class="settings-section"><h3>Default Print Provider</h3><p class="loading">Loading...</p></div>
        <div id="section-shipping" class="settings-section"><h3>Shipping Addresses</h3><p class="loading">Loading...</p></div>
        <div id="section-print-creds" class="settings-section"><h3>Print Provider Credentials</h3><p class="loading">Loading...</p></div>
        <div id="section-account" class="settings-section"><h3>Account</h3><p class="loading">Loading...</p></div>
    `);

    // Parallel fetches
    loadAIConfig();
    loadProfile();
    loadPrintCredentials();
    loadPreferences();
    loadSourceCredentials();
    loadShippingAddresses();
    loadSharedImages();
    loadCatalogStatus();

    async function loadAIConfig() {
        const $s = $container.find('#section-ai');
        try {
            const data = await api.get('/user/ai-config');
            console.log('[Settings] AI config loaded:', data);
            renderAIConfig($s, data);
        } catch (err) {
            console.error('[Settings] AI config load failed:', err.message);
            $s.find('.loading').replaceWith(`<p class="error">Failed to load AI config: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderAIConfig($s, data) {
        const textProviderHelp = {
            local: '<p class="hint">Ollama runs locally on your server. No API key needed. Use the model name exactly as you would with <code>ollama pull</code> (e.g. <code>llama3.2:1b</code>, <code>mistral:7b</code>).</p>',
            openai: '<p class="hint">Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a> → Create new secret key. Recommended model: <code>gpt-4o</code>.</p>',
            anthropic: '<p class="hint">Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a> → Create Key. Recommended model: <code>claude-sonnet-4-20250514</code>.</p>',
        };
        const imageProviderHelp = {
            local: '<p class="hint">ComfyUI runs locally on your server. No API key needed — requires a GPU for image generation.</p>',
            openai: '<p class="hint">Uses the same OpenAI API key as text (or a separate one). Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>. Recommended model: <code>dall-e-3</code>.</p>',
            replicate: '<p class="hint">Go to <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener">replicate.com/account/api-tokens</a> → Create token. Recommended model: <code>black-forest-labs/flux-schnell</code>.</p>',
        };

        $s.html(`
            <h3>AI Configuration</h3>
            <div class="form-group">
                <label>Text Provider</label>
                <select id="ai-text-provider">
                    <option value="local" ${data.text_provider === 'local' ? 'selected' : ''}>Local (Ollama)</option>
                    <option value="openai" ${data.text_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="anthropic" ${data.text_provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                </select>
                <div id="ai-text-help">${textProviderHelp[data.text_provider] || ''}</div>
            </div>
            <div id="ai-text-local-fields" style="display:${data.text_provider === 'local' ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Ollama Model</label>
                    <div class="input-with-action">
                        <input type="text" id="ai-text-model-local" value="${escapeHtml(data.text_model || '')}" placeholder="llama3.2:1b" maxlength="200">
                        <button class="btn btn-sm" id="pull-text-model" title="Pull this model from Ollama registry">Pull</button>
                    </div>
                    <p class="hint hint-sub">Leave blank for default (<code>llama3.2:1b</code>). Used for spellcheck and cover prompt generation. Enter the name exactly as you'd type <code>ollama pull &lt;name&gt;</code>. Larger models (e.g. <code>llama3.2:3b</code>, <code>mistral:7b</code>) give better results but need more RAM. <a href="https://ollama.com/library" target="_blank" rel="noopener">Browse models ↗</a></p>
                </div>
                <div id="ollama-models-list"></div>
            </div>
            <div id="ai-text-fields" style="display:${data.text_provider !== 'local' ? 'block' : 'none'};">
                <div class="form-group"><label>Model Name</label><input type="text" id="ai-text-model" value="${escapeHtml(data.text_model || '')}" maxlength="100"></div>
                <div class="form-group"><label>API Key</label><input type="password" id="ai-text-key" placeholder="${data.text_api_key_set ? '••••••••' : 'Enter API key'}"></div>
            </div>
            <div class="form-group">
                <label>Image Provider</label>
                <select id="ai-image-provider">
                    <option value="local" ${data.image_provider === 'local' ? 'selected' : ''}>Local (ComfyUI)</option>
                    <option value="openai" ${data.image_provider === 'openai' ? 'selected' : ''}>OpenAI DALL-E</option>
                    <option value="replicate" ${data.image_provider === 'replicate' ? 'selected' : ''}>Replicate</option>
                </select>
                <div id="ai-image-help">${imageProviderHelp[data.image_provider] || ''}</div>
            </div>
            <div id="ai-image-fields" style="display:${data.image_provider !== 'local' ? 'block' : 'none'};">
                <div class="form-group"><label>Model Name</label><input type="text" id="ai-image-model" value="${escapeHtml(data.image_model || '')}" maxlength="100"></div>
                <div class="form-group"><label>API Key</label><input type="password" id="ai-image-key" placeholder="${data.image_api_key_set ? '••••••••' : 'Enter API key'}"></div>
            </div>
            <div id="ai-image-local-fields" style="display:${data.image_provider === 'local' ? 'block' : 'none'};">
                <div class="form-group">
                    <label>ComfyUI Checkpoint Model</label>
                    <input type="text" id="ai-image-model-local" value="${escapeHtml(data.image_model || '')}" placeholder="v1-5-pruned-emaonly.safetensors" maxlength="200">
                    <p class="hint hint-sub">The checkpoint file used for image generation. Select from installed models below, or enter a filename manually.</p>
                </div>
                <div id="comfyui-models-list"></div>
            </div>
            <button class="btn primary" id="save-ai">Save AI Settings</button>
        `);

        // Load installed Ollama models list
        if (data.text_provider === 'local') {
            loadOllamaModels($s);
        }
        // Load installed ComfyUI models list
        if (data.image_provider === 'local') {
            loadComfyUIModels($s);
        }

        $s.find('#ai-text-provider').on('change', function () {
            const val = $(this).val();
            $s.find('#ai-text-fields').toggle(val !== 'local');
            $s.find('#ai-text-local-fields').toggle(val === 'local');
            $s.find('#ai-text-help').html(textProviderHelp[val] || '');
            if (val === 'local') {
                loadOllamaModels($s);
            }
        });
        $s.find('#ai-image-provider').on('change', function () {
            const val = $(this).val();
            $s.find('#ai-image-fields').toggle(val !== 'local');
            $s.find('#ai-image-local-fields').toggle(val === 'local');
            $s.find('#ai-image-help').html(imageProviderHelp[val] || '');
            if (val === 'local') {
                loadComfyUIModels($s);
            }
        });

        // Pull model button
        $s.find('#pull-text-model').on('click', async function () {
            const $btn = $(this);
            const modelName = $s.find('#ai-text-model-local').val().trim();
            if (!modelName) {
                showError($s, 'Enter a model name to pull (e.g. llama3.2:3b, mistral:7b)');
                return;
            }
            console.log('[Settings] Pulling Ollama model:', modelName);
            setLoading($btn, true, 'Starting...');
            clearMessages($s);
            try {
                const result = await api.post('/ollama/pull', { model: modelName });
                console.log('[Settings] Ollama pull response:', result);

                if (result.status === 'started' && result.task_id) {
                    // Show progress bar and start polling
                    $btn.hide();
                    const $progress = $(`
                        <div id="ollama-pull-progress" style="margin-top:0.5rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                                <span id="ollama-pull-label">Starting pull...</span>
                            </div>
                            <div style="background:#e8d5b7; border-radius:4px; height:20px; overflow:hidden; border:1px solid var(--tan, #d2b48c);">
                                <div id="ollama-pull-bar" style="background:var(--saddle-brown, #8b4513); height:100%; width:0%; transition:width 0.3s;"></div>
                            </div>
                            <span id="ollama-pull-detail" class="hint" style="font-size:0.75rem;"></span>
                        </div>
                    `);
                    $btn.after($progress);

                    pollOllamaPull(result.task_id, modelName, $s);
                }
            } catch (err) {
                console.error('[Settings] Model pull failed:', err.message, err);
                showError($s, `Failed to pull model: ${err.message}`);
                setLoading($btn, false);
            }
        });

        function pollOllamaPull(taskId, modelName, $s) {
            const pollInterval = 2000;
            const poll = async () => {
                try {
                    const status = await api.get(`/ollama/pull/status/${taskId}`);
                    console.log('[Settings] Ollama pull poll:', status.status, status.percent + '%');

                    const $bar = $s.find('#ollama-pull-bar');
                    const $label = $s.find('#ollama-pull-label');
                    const $detail = $s.find('#ollama-pull-detail');

                    if (status.status === 'pulling' || status.status === 'pending') {
                        $bar.css('width', status.percent + '%');
                        $label.text(status.label || 'Pulling...');
                        if (status.total_mb > 0) {
                            $detail.text(`${status.downloaded_mb || 0} / ${status.total_mb} MB (${status.percent}%)`);
                        }
                        setTimeout(poll, pollInterval);
                    } else if (status.status === 'success') {
                        $bar.css('width', '100%');
                        $label.text(status.message || 'Pull complete!');
                        $detail.text('');
                        showSuccess($s, status.message || `Model '${modelName}' pulled successfully.`);
                        setTimeout(() => {
                            $s.find('#ollama-pull-progress').remove();
                            $s.find('#pull-text-model').show();
                            setLoading($s.find('#pull-text-model'), false);
                            clearMessages($s);
                            loadOllamaModels($s);
                        }, 2000);
                    } else if (status.status === 'failed') {
                        $s.find('#ollama-pull-progress').remove();
                        $s.find('#pull-text-model').show();
                        setLoading($s.find('#pull-text-model'), false);
                        showError($s, status.message || 'Pull failed.');
                    } else {
                        setTimeout(poll, pollInterval);
                    }
                } catch (err) {
                    console.error('[Settings] Ollama pull poll error:', err.message);
                    $s.find('#ollama-pull-progress').remove();
                    $s.find('#pull-text-model').show();
                    setLoading($s.find('#pull-text-model'), false);
                    showError($s, `Lost connection to pull task: ${err.message}`);
                }
            };
            setTimeout(poll, pollInterval);
        }

        $s.find('#save-ai').on('click', async function () {
            const $btn = $(this);
            setLoading($btn, true, 'Saving...');
            clearMessages($s);
            const textProvider = $s.find('#ai-text-provider').val();
            const imageProvider = $s.find('#ai-image-provider').val();
            const payload = {
                text_provider: textProvider,
                image_provider: imageProvider,
            };
            // Model name: use local field when local, external field otherwise
            if (textProvider === 'local') {
                payload.text_model = $s.find('#ai-text-model-local').val().trim() || null;
            } else {
                payload.text_model = $s.find('#ai-text-model').val() || null;
            }
            if (imageProvider !== 'local') {
                payload.image_model = $s.find('#ai-image-model').val() || null;
            } else {
                payload.image_model = $s.find('#ai-image-model-local').val().trim() || null;
            }
            // Only include API keys if the user actually typed something new
            const textKey = $s.find('#ai-text-key').val();
            if (textKey) payload.text_api_key = textKey;
            const imageKey = $s.find('#ai-image-key').val();
            if (imageKey) payload.image_api_key = imageKey;
            try {
                await api.patch('/user/ai-config', payload);
                console.log('[Settings] AI config saved');
                showSuccess($s, 'AI settings saved.');
                setTimeout(() => clearMessages($s), 3000);
            } catch (err) {
                console.error('[Settings] AI config save failed:', err.message);
                showError($s, err.message);
            } finally { setLoading($btn, false); }
        });
    }

    async function loadOllamaModels($s) {
        const $list = $s.find('#ollama-models-list');
        console.log('[Settings] Loading installed Ollama models');
        try {
            const data = await api.get('/ollama/models');
            console.log('[Settings] Ollama models loaded:', data);
            if (data.error) {
                $list.html(`<p class="hint hint-warn">Ollama not reachable — cannot list models.</p>`);
                return;
            }
            if (!data.models || data.models.length === 0) {
                $list.html(`
                    <p class="hint">No models installed yet. Enter a model name above and click Pull.</p>
                    <p class="hint" style="margin-top:0.5rem;">Browse available models: <a href="https://ollama.com/library" target="_blank" rel="noopener">Ollama Model Library ↗</a></p>
                `);
                return;
            }
            const rows = data.models.map(m => {
                const sizeGB = m.size ? (m.size / 1073741824).toFixed(1) + ' GB' : '?';
                return `<tr>
                    <td><code>${escapeHtml(m.name)}</code></td>
                    <td>${sizeGB}</td>
                    <td>
                        <button class="btn btn-xs btn-link use-model" data-model="${escapeHtml(m.name)}">Use</button>
                        <button class="btn btn-xs btn-danger delete-ollama-model" data-model="${escapeHtml(m.name)}" title="Delete this model to free disk space">Delete</button>
                    </td>
                </tr>`;
            }).join('');
            $list.html(`
                <details class="ollama-models-details" open>
                    <summary>Installed models (${data.models.length})</summary>
                    <table class="table-compact">
                        <thead><tr><th>Model</th><th>Size</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <p class="hint" style="margin-top:0.75rem;">Browse more models: <a href="https://ollama.com/library" target="_blank" rel="noopener">Ollama Model Library ↗</a></p>
                </details>
            `);
            // Click "Use" to populate the model field
            $list.find('.use-model').on('click', function () {
                const modelName = $(this).data('model');
                console.log('[Settings] User selected model:', modelName);
                $s.find('#ai-text-model-local').val(modelName);
            });
            // Click "Delete" to remove a model
            $list.find('.delete-ollama-model').on('click', async function () {
                const modelName = $(this).data('model');
                if (!confirm(`Delete model '${modelName}'? This will free disk space but you'll need to pull it again if you want to use it.`)) return;
                console.log('[Settings] Deleting Ollama model:', modelName);
                const $btn = $(this);
                setLoading($btn, true, 'Deleting...');
                clearMessages($s);
                try {
                    await api.delete(`/ollama/models/${encodeURIComponent(modelName)}`);
                    console.log('[Settings] Ollama model deleted:', modelName);
                    showSuccess($s, `Model '${modelName}' deleted.`);
                    loadOllamaModels($s);
                    setTimeout(() => clearMessages($s), 3000);
                } catch (err) {
                    console.error('[Settings] Ollama model delete failed:', err.message);
                    showError($s, `Failed to delete model: ${err.message}`);
                    setLoading($btn, false);
                }
            });
        } catch (err) {
            console.error('[Settings] Failed to load Ollama models:', err.message);
            $list.html(`<p class="hint hint-warn">Could not load model list.</p>`);
        }
    }

    async function loadComfyUIModels($s) {
        const $list = $s.find('#comfyui-models-list');
        console.log('[Settings] Loading installed ComfyUI models');
        try {
            const data = await api.get('/comfyui/status');
            console.log('[Settings] ComfyUI status loaded:', data);

            if (!data.reachable) {
                // Show models on disk if ComfyUI isn't running
                const diskModels = data.models_on_disk || [];
                if (diskModels.length > 0) {
                    const rows = diskModels.map(name =>
                        `<tr><td><code>${escapeHtml(name)}</code></td><td><button class="btn btn-xs btn-link use-comfyui-model" data-model="${escapeHtml(name)}">Use</button></td></tr>`
                    ).join('');
                    $list.html(`
                        <p class="hint hint-warn">ComfyUI is not running, but these models are on disk:</p>
                        <table class="table-compact"><thead><tr><th>Model</th><th></th></tr></thead><tbody>${rows}</tbody></table>
                    `);
                } else {
                    $list.html(`<p class="hint hint-warn">ComfyUI is not reachable and no models found on disk.</p>`);
                }
                $list.find('.use-comfyui-model').on('click', function () {
                    const modelName = $(this).data('model');
                    console.log('[Settings] User selected ComfyUI model:', modelName);
                    $s.find('#ai-image-model-local').val(modelName);
                });
                return;
            }

            const checkpoints = data.checkpoints || [];
            const knownModels = data.known_models || {};

            if (checkpoints.length === 0) {
                $list.html(`
                    <p class="hint">No checkpoint models installed. Download one from the list below:</p>
                    ${_renderKnownModelsDownload(knownModels)}
                `);
                _bindModelDownload($list, $s);
                return;
            }

            const rows = checkpoints.map(name => {
                const known = knownModels[name];
                const label = known ? `${escapeHtml(name)} <span class="hint">(${escapeHtml(known.name)})</span>` : escapeHtml(name);
                return `<tr>
                    <td><code>${label}</code></td>
                    <td><button class="btn btn-xs btn-link use-comfyui-model" data-model="${escapeHtml(name)}">Use</button></td>
                </tr>`;
            }).join('');

            $list.html(`
                <details class="comfyui-models-details" open>
                    <summary>Installed checkpoints (${checkpoints.length})</summary>
                    <table class="table-compact">
                        <thead><tr><th>Checkpoint</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    ${_renderKnownModelsDownload(knownModels, checkpoints)}
                </details>
            `);

            $list.find('.use-comfyui-model').on('click', function () {
                const modelName = $(this).data('model');
                console.log('[Settings] User selected ComfyUI model:', modelName);
                $s.find('#ai-image-model-local').val(modelName);
            });
            _bindModelDownload($list, $s);

        } catch (err) {
            console.error('[Settings] Failed to load ComfyUI models:', err.message);
            $list.html(`<p class="hint hint-warn">Could not load ComfyUI model list: ${escapeHtml(err.message)}</p>`);
        }
    }

    function _renderKnownModelsDownload(knownModels, installedCheckpoints = []) {
        const available = Object.entries(knownModels).filter(([name]) => !installedCheckpoints.includes(name));
        if (available.length === 0) return '';
        const rows = available.map(([filename, info]) =>
            `<tr>
                <td><code>${escapeHtml(filename)}</code><br><span class="hint">${escapeHtml(info.name)} (${info.size_gb} GB)</span></td>
                <td><button class="btn btn-xs primary download-comfyui-model" data-model="${escapeHtml(filename)}" data-url="${escapeHtml(info.url)}">Download</button></td>
            </tr>`
        ).join('');
        return `
            <p class="hint" style="margin-top:0.75rem;">Available models to download:</p>
            <table class="table-compact"><thead><tr><th>Model</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        `;
    }

    function _bindModelDownload($list, $s) {
        $list.find('.download-comfyui-model').on('click', async function () {
            const $btn = $(this);
            const modelName = $btn.data('model');
            const url = $btn.data('url');
            console.log('[Settings] Downloading ComfyUI model:', modelName, 'from:', url);
            $btn.prop('disabled', true).text('Starting...');
            clearMessages($s);
            try {
                const result = await api.post('/comfyui/models/download', { model_name: modelName, url: url });
                console.log('[Settings] ComfyUI model download response:', result);
                if (result.status === 'exists') {
                    showSuccess($s, result.message);
                    $btn.prop('disabled', false).text('Download');
                } else if (result.status === 'started' && result.task_id) {
                    $btn.text('Downloading...');
                    pollComfyUIDownload(result.task_id, modelName, $s, $btn);
                }
            } catch (err) {
                console.error('[Settings] ComfyUI model download failed:', err.message);
                showError($s, 'Download failed: ' + err.message);
                $btn.prop('disabled', false).text('Download');
            }
        });
    }

    function pollComfyUIDownload(taskId, modelName, $s, $btn) {
        const poll = async () => {
            try {
                const status = await api.get(`/comfyui/models/download/status/${taskId}`);
                console.log('[Settings] ComfyUI download poll:', status.status, status.percent + '%');
                if (status.status === 'downloading' || status.status === 'pending') {
                    $btn.text(`${status.percent || 0}%`);
                    setTimeout(poll, 3000);
                } else if (status.status === 'success') {
                    showSuccess($s, status.message || `Model '${modelName}' downloaded.`);
                    setTimeout(() => { clearMessages($s); loadComfyUIModels($s); }, 2000);
                } else if (status.status === 'failed') {
                    showError($s, status.message || 'Download failed.');
                    $btn.prop('disabled', false).text('Download');
                } else {
                    setTimeout(poll, 3000);
                }
            } catch (err) {
                console.error('[Settings] ComfyUI download poll error:', err.message);
                showError($s, 'Lost connection to download task.');
                $btn.prop('disabled', false).text('Download');
            }
        };
        setTimeout(poll, 3000);
    }

    async function loadCatalogStatus() {
        const $s = $container.find('#section-catalog');
        console.log('[Settings] Loading catalog status');
        try {
            const data = await api.get('/search/catalog/status');
            console.log('[Settings] Catalog status loaded:', data);
            renderCatalogSection($s, data);
        } catch (err) {
            console.error('[Settings] Catalog status load failed:', err.message);
            $s.find('.loading').replaceWith(`<p class="error">Failed to load catalog status: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderCatalogSection($s, data) {
        const totalBooks = data.total_books || 0;
        const lastSynced = data.last_synced ? new Date(data.last_synced).toLocaleString() : 'Never';
        const isHealthy = totalBooks >= 10000;
        const statusIcon = isHealthy ? '✅' : '⚠️';
        const statusText = isHealthy
            ? `${totalBooks.toLocaleString()} books cached — search uses local cache (instant)`
            : `${totalBooks.toLocaleString()} books cached — cache incomplete, search falls back to live API (slower)`;

        $s.html(`
            <h3>Book Catalog Cache</h3>
            <p class="hint">The local Gutenberg catalog enables instant fuzzy search. A full sync downloads ~75,000 book records from Gutendex (takes 1–2 hours). You can export the cache and bundle it with the project for instant setup on new installs.</p>
            <p style="margin:0.75rem 0;"><strong>${statusIcon} Status:</strong> ${statusText}</p>
            <p style="margin:0.25rem 0; font-size:0.85rem; color:#666;">Last synced: ${escapeHtml(lastSynced)}</p>
            <div class="actions" style="margin-top:1rem; flex-wrap:wrap; gap:0.5rem;">
                <button class="btn primary" id="catalog-export-btn" ${totalBooks === 0 ? 'disabled' : ''} title="Download the catalog cache as a CSV file">📥 Export Cache (CSV)</button>
                <label class="btn secondary" style="cursor:pointer;" title="Upload a previously exported CSV to seed the cache instantly">
                    📤 Import Cache
                    <input type="file" id="catalog-import-file" accept=".csv" style="display:none" />
                </label>
                <button class="btn" id="catalog-sync-btn" title="Trigger a full re-sync from Gutendex (takes 1–2 hours in background)">🔄 Sync from Gutendex</button>
            </div>
            <div id="catalog-action-status" style="margin-top:0.75rem;"></div>
        `);

        // Export button
        $s.find('#catalog-export-btn').on('click', function () {
            console.log('[Settings] Catalog export clicked');
            const $btn = $(this);
            $btn.prop('disabled', true).text('📥 Exporting...');
            // Trigger download via a hidden link
            const link = document.createElement('a');
            link.href = '/api/search/catalog/export';
            link.download = 'gutenberg_catalog.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log('[Settings] Catalog export download triggered');
            setTimeout(() => {
                $btn.prop('disabled', false).text('📥 Export Cache (CSV)');
            }, 2000);
        });

        // Import file input
        $s.find('#catalog-import-file').on('change', async function () {
            const file = this.files[0];
            if (!file) return;
            console.log('[Settings] Catalog import file selected:', file.name, 'size:', file.size);

            const $status = $s.find('#catalog-action-status');
            clearMessages($status);

            if (!file.name.endsWith('.csv')) {
                showError($status, 'Please select a .csv file.');
                $(this).val('');
                return;
            }

            const sizeMB = (file.size / 1048576).toFixed(1);
            $status.html(`<p>Uploading ${escapeHtml(file.name)} (${sizeMB} MB)...</p>`);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/search/catalog/import', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
                const result = await response.json();
                console.log('[Settings] Catalog import response:', response.status, result);

                if (!response.ok) {
                    const errMsg = result.detail || 'Import failed';
                    console.error('[Settings] Catalog import failed:', errMsg);
                    showError($status, errMsg);
                } else {
                    console.log('[Settings] Catalog import success:', result);
                    showSuccess($status, `Imported ${(result.books_imported || 0).toLocaleString()} books. Cache now has ${(result.final_count || 0).toLocaleString()} entries.`);
                    // Refresh the section after a moment
                    setTimeout(() => loadCatalogStatus(), 2000);
                }
            } catch (err) {
                console.error('[Settings] Catalog import error:', err.message, err);
                showError($status, 'Import failed: ' + err.message);
            }

            $(this).val('');
        });

        // Sync button
        $s.find('#catalog-sync-btn').on('click', async function () {
            const $btn = $(this);
            const $status = $s.find('#catalog-action-status');
            console.log('[Settings] Catalog sync clicked');
            clearMessages($status);
            $btn.prop('disabled', true).text('🔄 Starting...');

            try {
                const result = await api.post('/search/catalog/sync');
                console.log('[Settings] Catalog sync queued:', result);
                showSuccess($status, `Sync task queued (task ID: ${result.task_id}). This runs in the background and takes 1–2 hours. Refresh this page later to see progress.`);
            } catch (err) {
                console.error('[Settings] Catalog sync failed:', err.message);
                showError($status, 'Failed to start sync: ' + err.message);
            } finally {
                $btn.prop('disabled', false).text('🔄 Sync from Gutendex');
            }
        });
    }

    async function loadProfile() {
        const $s = $container.find('#section-account');
        try {
            const data = await api.get('/user/profile');
            console.log('[Settings] Profile loaded:', data.email);
            $s.html(`
                <h3>Account</h3>
                <div class="form-group"><label>Username</label><input type="text" value="${escapeHtml(data.email)}" disabled></div>
                <div class="form-group"><label>Display Name</label><input type="text" id="display-name" value="${escapeHtml(data.display_name || '')}" maxlength="100"></div>
                <div class="actions">
                    <button class="btn primary" id="save-profile">Save Profile</button>
                    <button class="btn btn-danger" id="settings-logout">Logout</button>
                </div>
                <hr style="margin:1.5rem 0;">
                <h4>Change Password</h4>
                <div class="form-group"><label>Current Password</label><input type="password" id="current-password" maxlength="128" autocomplete="current-password"></div>
                <div class="form-group"><label>New Password</label><input type="password" id="new-password" maxlength="128" autocomplete="new-password"></div>
                <div class="form-group"><label>Confirm New Password</label><input type="password" id="confirm-password" maxlength="128" autocomplete="new-password"></div>
                <button class="btn primary" id="change-password-btn">Change Password</button>
            `);
            $s.find('#save-profile').on('click', async function () {
                const $btn = $(this);
                setLoading($btn, true, 'Saving...');
                clearMessages($s);
                try {
                    await api.patch('/user/profile', { display_name: $s.find('#display-name').val() });
                    showSuccess($s, 'Profile saved.');
                    setTimeout(() => clearMessages($s), 3000);
                } catch (err) { showError($s, err.message); }
                finally { setLoading($btn, false); }
            });
            $s.find('#change-password-btn').on('click', async function () {
                const $btn = $(this);
                const currentPw = $s.find('#current-password').val();
                const newPw = $s.find('#new-password').val();
                const confirmPw = $s.find('#confirm-password').val();
                clearMessages($s);

                if (!currentPw || !newPw) {
                    showError($s, 'Please fill in both current and new password.');
                    return;
                }
                if (newPw.length < 8) {
                    showError($s, 'New password must be at least 8 characters.');
                    return;
                }
                if (newPw !== confirmPw) {
                    showError($s, 'New passwords do not match.');
                    return;
                }

                console.log('[Settings] Changing password');
                setLoading($btn, true, 'Changing...');
                try {
                    await api.post('/user/change-password', {
                        current_password: currentPw,
                        new_password: newPw,
                    });
                    console.log('[Settings] Password changed successfully');
                    showSuccess($s, 'Password changed successfully.');
                    $s.find('#current-password').val('');
                    $s.find('#new-password').val('');
                    $s.find('#confirm-password').val('');
                    setTimeout(() => clearMessages($s), 3000);
                } catch (err) {
                    console.error('[Settings] Password change failed:', err.message);
                    showError($s, err.message);
                } finally { setLoading($btn, false); }
            });
            $s.find('#settings-logout').on('click', () => logout());
        } catch (err) {
            $s.find('.loading').replaceWith(`<p class="error">Failed to load profile: ${escapeHtml(err.message)}</p>`);
        }
    }

    async function loadPrintCredentials() {
        const $s = $container.find('#section-print-creds');
        try {
            const data = await api.get('/print/credentials');
            console.log('[Settings] Print credentials loaded:', data);
            renderPrintCreds($s, data.providers || []);
        } catch (err) {
            $s.find('.loading').replaceWith(`<p class="error">Failed to load credentials: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderPrintCreds($s, providers) {
        let html = '<h3>Print Provider Credentials</h3>';
        for (const p of providers) {
            if (p.provider === 'kdp') continue;
            if (p.configured) {
                html += `<div style="margin-bottom:1rem;"><span class="credential-status">✓ ${escapeHtml(p.provider)} configured</span> <button class="btn btn-sm btn-danger remove-cred" data-provider="${escapeHtml(p.provider)}">Remove</button></div>`;
            } else {
                if (p.provider === 'lulu') {
                    html += `<div class="cred-form" data-provider="lulu" style="margin-bottom:1rem;"><strong>Lulu xPress</strong><p class="hint">Log in at <a href="https://developers.lulu.com" target="_blank" rel="noopener">developers.lulu.com</a> → My Apps → Create a new app (or use an existing one) → copy the <em>API Key</em> (Client ID) and <em>API Secret</em> (Client Secret). Use the Sandbox keys for testing or Production keys for real orders.</p><div class="form-group"><label>Client ID</label><input type="text" class="cred-field" data-field="client_id"></div><div class="form-group"><label>Client Secret</label><input type="password" class="cred-field" data-field="client_secret"></div><button class="btn btn-sm primary save-cred" data-provider="lulu">Save</button></div>`;
                } else if (p.provider === 'bookvault') {
                    html += `<div class="cred-form" data-provider="bookvault" style="margin-bottom:1rem;"><strong>BookVault</strong><p class="hint">Log in to your BookVault dashboard → Account Settings → API Access → generate or copy your API key. Contact BookVault support if you don't see the API section.</p><div class="form-group"><label>API Key</label><input type="password" class="cred-field" data-field="api_key"></div><button class="btn btn-sm primary save-cred" data-provider="bookvault">Save</button></div>`;
                }
            }
        }
        $s.html(html);

        $s.find('.save-cred').on('click', async function () {
            const provider = $(this).data('provider');
            const $form = $s.find(`.cred-form[data-provider="${provider}"]`);
            const credentials = {};
            $form.find('.cred-field').each(function () { credentials[$(this).data('field')] = $(this).val(); });
            clearMessages($s);
            try {
                await api.post('/print/credentials', { provider, credentials });
                showSuccess($s, `${provider} credentials saved.`);
                setTimeout(() => loadPrintCredentials(), 1500);
            } catch (err) { showError($s, err.message); }
        });

        $s.find('.remove-cred').on('click', async function () {
            const provider = $(this).data('provider');
            clearMessages($s);
            try {
                await api.delete(`/print/credentials/${provider}`);
                showSuccess($s, `${provider} credentials removed.`);
                setTimeout(() => loadPrintCredentials(), 1500);
            } catch (err) { showError($s, err.message); }
        });
    }

    async function loadPreferences() {
        const $s = $container.find('#section-print-provider');
        try {
            const data = await api.get('/user/preferences');
            console.log('[Settings] Preferences loaded:', data);
            $s.html(`
                <h3>Default Print Provider</h3>
                <p class="hint">Choose which print-on-demand service to use by default when creating print orders. You can override this per-project.</p>
                <div class="form-group">
                    <select id="default-provider">
                        <option value="lulu" ${data.default_print_provider === 'lulu' ? 'selected' : ''}>Lulu xPress</option>
                        <option value="bookvault" ${data.default_print_provider === 'bookvault' ? 'selected' : ''}>BookVault</option>
                        <option value="kdp" ${data.default_print_provider === 'kdp' ? 'selected' : ''}>KDP</option>
                    </select>
                </div>
                <h3 style="margin-top:1.5rem;">Print Defaults</h3>
                <p class="hint">These defaults apply to all new books. You can override them per-book on the Print step. See <a href="https://www.lulu.com/sell/sell-on-your-site/print-api" target="_blank" rel="noopener">Lulu's print options</a> for details on available configurations.</p>
                <div class="form-group">
                    <label>Trim Size</label>
                    <select id="default-trim-size">
                        <option value="5x8" ${data.default_trim_size === '5x8' ? 'selected' : ''}>5" × 8" (Small Digest)</option>
                        <option value="5.25x8" ${data.default_trim_size === '5.25x8' ? 'selected' : ''}>5.25" × 8" (Large Digest)</option>
                        <option value="5.5x8.5" ${data.default_trim_size === '5.5x8.5' ? 'selected' : ''}>5.5" × 8.5" (Small Trade)</option>
                        <option value="6x9" ${data.default_trim_size === '6x9' ? 'selected' : ''}>6" × 9" (Large Trade) — slightly more expensive</option>
                        <option value="8.5x11" ${data.default_trim_size === '8.5x11' ? 'selected' : ''}>8.5" × 11" (Letter) — most expensive</option>
                    </select>
                    <p class="hint">Larger trim sizes cost more to print. 5" × 8" and 5.5" × 8.5" are the most economical.</p>
                </div>
                <div class="form-group">
                    <label>Paper Type</label>
                    <select id="default-paper-type">
                        <option value="white" ${data.default_paper_type === 'white' ? 'selected' : ''}>White (60# uncoated)</option>
                        <option value="cream" ${data.default_paper_type === 'cream' ? 'selected' : ''}>Cream (60# uncoated)</option>
                    </select>
                    <p class="hint">Same price — cream is traditional for fiction; white is better for non-fiction or books with images.</p>
                </div>
                <div class="form-group">
                    <label>Interior Color</label>
                    <select id="default-color-interior">
                        <option value="false" ${!data.default_color_interior ? 'selected' : ''}>Black & White</option>
                        <option value="true" ${data.default_color_interior ? 'selected' : ''}>Full Color — significantly more expensive</option>
                    </select>
                    <p class="hint">Color interiors can cost 2–3× more per page. Use B&W for text-only books.</p>
                </div>
                <div class="form-group">
                    <label>Cover Finish</label>
                    <select id="default-cover-finish">
                        <option value="glossy" ${data.default_cover_finish === 'glossy' ? 'selected' : ''}>Glossy</option>
                        <option value="matte" ${data.default_cover_finish === 'matte' ? 'selected' : ''}>Matte</option>
                    </select>
                    <p class="hint">Same price — glossy is vibrant and eye-catching; matte has a softer, more premium feel.</p>
                </div>
                <div class="form-group">
                    <label>Binding Type</label>
                    <select id="default-binding-type">
                        <option value="paperback" ${data.default_binding_type === 'paperback' ? 'selected' : ''}>Paperback</option>
                        <option value="hardback" ${data.default_binding_type === 'hardback' ? 'selected' : ''}>Hardback</option>
                        <option value="micro" ${data.default_binding_type === 'micro' ? 'selected' : ''}>Micro Hardback (4.25" × 6.87")</option>
                    </select>
                    <p class="hint">Hardback and micro hardback cost more. Micro uses a smaller fixed trim size.</p>
                </div>
                <div class="form-group">
                    <label>Font Size</label>
                    <select id="default-font-size">
                        <option value="9pt" ${data.default_font_size === '9pt' ? 'selected' : ''}>9pt — compact</option>
                        <option value="10pt" ${data.default_font_size === '10pt' ? 'selected' : ''}>10pt — small</option>
                        <option value="11pt" ${data.default_font_size === '11pt' ? 'selected' : ''}>11pt — standard</option>
                        <option value="12pt" ${data.default_font_size === '12pt' ? 'selected' : ''}>12pt — large</option>
                        <option value="13pt" ${data.default_font_size === '13pt' ? 'selected' : ''}>13pt — extra large</option>
                        <option value="14pt" ${data.default_font_size === '14pt' ? 'selected' : ''}>14pt — very large</option>
                    </select>
                    <p class="hint">Larger fonts are easier to read but increase page count and cost.</p>
                </div>
                <hr style="border-color: var(--tan, #d2b48c); margin: 1.5rem 0;">
                <h3>Content Filter</h3>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="profanity-filter-enabled" ${data.profanity_filter_enabled ? 'checked' : ''}>
                        Enable profanity filter
                    </label>
                    <p class="hint">When enabled, words on the profanity list are replaced with █ blocks in printed text, and silently stripped from AI prompts. The word list is managed by the admin.</p>
                </div>
                <button class="btn primary" id="save-print-defaults">Save Print Defaults</button>
            `);
            $s.find('#default-provider').on('change', async function () {
                clearMessages($s);
                try {
                    await api.patch('/user/preferences', { default_print_provider: $(this).val() });
                    showSuccess($s, 'Default provider saved.');
                    setTimeout(() => clearMessages($s), 3000);
                } catch (err) { showError($s, err.message); }
            });
            $s.find('#save-print-defaults').on('click', async function () {
                const $btn = $(this);
                setLoading($btn, true, 'Saving...');
                clearMessages($s);
                try {
                    await api.patch('/user/preferences', {
                        default_trim_size: $s.find('#default-trim-size').val(),
                        default_paper_type: $s.find('#default-paper-type').val(),
                        default_color_interior: $s.find('#default-color-interior').val() === 'true',
                        default_cover_finish: $s.find('#default-cover-finish').val(),
                        default_binding_type: $s.find('#default-binding-type').val(),
                        default_font_size: $s.find('#default-font-size').val(),
                        profanity_filter_enabled: $s.find('#profanity-filter-enabled').is(':checked'),
                    });
                    console.log('[Settings] Print defaults saved');
                    showSuccess($s, 'Print defaults saved.');
                    setTimeout(() => clearMessages($s), 3000);
                } catch (err) {
                    console.error('[Settings] Print defaults save failed:', err.message);
                    showError($s, err.message);
                } finally { setLoading($btn, false); }
            });
        } catch (err) {
            $s.find('.loading').replaceWith(`<p class="error">Failed to load preferences: ${escapeHtml(err.message)}</p>`);
        }
    }

    async function loadShippingAddresses() {
        const $s = $container.find('#section-shipping');
        try {
            const data = await api.get('/user/shipping-addresses');
            console.log('[Settings] Shipping addresses loaded:', data);
            renderShippingAddresses($s, data.addresses || []);
        } catch (err) {
            console.error('[Settings] Shipping addresses load failed:', err.message);
            $s.find('.loading').replaceWith(`<p class="error">Failed to load shipping addresses: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderShippingAddresses($s, addresses) {
        let html = '<h3>Shipping Addresses</h3>';
        html += '<p class="hint">Manage your saved shipping addresses. The default address will be pre-selected when placing print orders.</p>';

        if (addresses.length > 0) {
            html += '<div class="shipping-address-list">';
            for (const addr of addresses) {
                const defaultBadge = addr.is_default ? '<span class="credential-status" style="margin-left:0.5rem;">★ Default</span>' : '';
                html += `
                    <div class="shipping-address-card" data-id="${escapeHtml(addr.id)}" style="border:1px solid var(--tan, #d2b48c); border-radius:6px; padding:0.75rem; margin-bottom:0.75rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong>${escapeHtml(addr.label)}</strong>${defaultBadge}
                        </div>
                        <p style="margin:0.25rem 0 0;">${escapeHtml(addr.name)}<br>${escapeHtml(addr.street1)}${addr.street2 ? '<br>' + escapeHtml(addr.street2) : ''}<br>${escapeHtml(addr.city)}${addr.state ? ', ' + escapeHtml(addr.state) : ''} ${escapeHtml(addr.postal_code)}<br>${escapeHtml(addr.country)}${addr.phone_number ? '<br>Phone: ' + escapeHtml(addr.phone_number) : ''}</p>
                        <div class="actions" style="margin-top:0.5rem;">
                            ${!addr.is_default ? `<button class="btn btn-sm secondary set-default-addr" data-id="${escapeHtml(addr.id)}">Set Default</button>` : ''}
                            <button class="btn btn-sm secondary edit-addr" data-id="${escapeHtml(addr.id)}">Edit</button>
                            <button class="btn btn-sm btn-danger delete-addr" data-id="${escapeHtml(addr.id)}">Delete</button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        } else {
            html += '<p style="color:#666;">No saved addresses yet. Add one below.</p>';
        }

        html += `
            <details id="add-address-form" style="margin-top:1rem; border:1px solid var(--tan, #d2b48c); border-radius:6px; padding:0.75rem;">
                <summary style="cursor:pointer; font-weight:600;">Add New Address</summary>
                <div style="margin-top:0.75rem;">
                    <div class="form-group"><label>Label</label><input type="text" id="addr-label" placeholder="e.g. Home, Office, Mom's House" maxlength="100" value="Home"></div>
                    <div class="form-group"><label>Full Name</label><input type="text" id="addr-name" placeholder="John Smith" maxlength="200"></div>
                    <div class="form-group"><label>Street Address</label><input type="text" id="addr-street1" placeholder="123 Main St" maxlength="300"></div>
                    <div class="form-group"><label>Street Address 2 (optional)</label><input type="text" id="addr-street2" placeholder="Apt 4B" maxlength="300"></div>
                    <div class="form-group"><label>City</label><input type="text" id="addr-city" placeholder="Springfield" maxlength="100"></div>
                    <div class="form-group"><label>State/Province</label><input type="text" id="addr-state" placeholder="IL" maxlength="100"></div>
                    <div class="form-group"><label>Postal Code</label><input type="text" id="addr-postal" placeholder="62701" maxlength="20"></div>
                    <div class="form-group"><label>Country (2-letter code)</label><input type="text" id="addr-country" value="US" maxlength="2"></div>
                    <div class="form-group"><label>Phone Number</label><input type="tel" id="addr-phone" placeholder="e.g. 555-123-4567" maxlength="30"></div>
                    <div class="form-group"><label><input type="checkbox" id="addr-default"> Set as default</label></div>
                    <button class="btn primary" id="save-new-addr">Save Address</button>
                </div>
            </details>
        `;

        $s.html(html);

        // Save new address
        $s.find('#save-new-addr').on('click', async function () {
            const $btn = $(this);
            setLoading($btn, true, 'Saving...');
            clearMessages($s);
            const payload = {
                label: $s.find('#addr-label').val().trim() || 'Home',
                name: $s.find('#addr-name').val().trim(),
                street1: $s.find('#addr-street1').val().trim(),
                street2: $s.find('#addr-street2').val().trim() || null,
                city: $s.find('#addr-city').val().trim(),
                state: $s.find('#addr-state').val().trim() || null,
                postal_code: $s.find('#addr-postal').val().trim(),
                country: $s.find('#addr-country').val().trim().toUpperCase() || 'US',
                phone_number: $s.find('#addr-phone').val().trim() || null,
                is_default: $s.find('#addr-default').is(':checked'),
            };
            console.log('[Settings] Creating shipping address:', payload);
            if (!payload.name || !payload.street1 || !payload.city || !payload.postal_code) {
                showError($s, 'Please fill in name, street, city, and postal code.');
                setLoading($btn, false);
                return;
            }
            try {
                await api.post('/user/shipping-addresses', payload);
                console.log('[Settings] Shipping address created');
                showSuccess($s, 'Address saved.');
                setTimeout(() => { clearMessages($s); loadShippingAddresses(); }, 1000);
            } catch (err) {
                console.error('[Settings] Create address failed:', err.message);
                showError($s, err.message);
            } finally { setLoading($btn, false); }
        });

        // Set default
        $s.find('.set-default-addr').on('click', async function () {
            const id = $(this).data('id');
            console.log('[Settings] Setting default address:', id);
            clearMessages($s);
            try {
                await api.post(`/user/shipping-addresses/${id}/set-default`);
                showSuccess($s, 'Default address updated.');
                setTimeout(() => { clearMessages($s); loadShippingAddresses(); }, 1000);
            } catch (err) {
                console.error('[Settings] Set default failed:', err.message);
                showError($s, err.message);
            }
        });

        // Delete
        $s.find('.delete-addr').on('click', async function () {
            const id = $(this).data('id');
            console.log('[Settings] Deleting address:', id);
            clearMessages($s);
            try {
                await api.delete(`/user/shipping-addresses/${id}`);
                showSuccess($s, 'Address deleted.');
                setTimeout(() => { clearMessages($s); loadShippingAddresses(); }, 1000);
            } catch (err) {
                console.error('[Settings] Delete address failed:', err.message);
                showError($s, err.message);
            }
        });

        // Edit (inline)
        $s.find('.edit-addr').on('click', function () {
            const id = $(this).data('id');
            const addr = addresses.find(a => a.id === id);
            if (!addr) return;
            console.log('[Settings] Editing address:', id);
            const $card = $s.find(`.shipping-address-card[data-id="${id}"]`);
            $card.html(`
                <div class="form-group"><label>Label</label><input type="text" class="edit-label" value="${escapeHtml(addr.label)}" maxlength="100"></div>
                <div class="form-group"><label>Full Name</label><input type="text" class="edit-name" value="${escapeHtml(addr.name)}" maxlength="200"></div>
                <div class="form-group"><label>Street</label><input type="text" class="edit-street1" value="${escapeHtml(addr.street1)}" maxlength="300"></div>
                <div class="form-group"><label>Street 2</label><input type="text" class="edit-street2" value="${escapeHtml(addr.street2 || '')}" maxlength="300"></div>
                <div class="form-group"><label>City</label><input type="text" class="edit-city" value="${escapeHtml(addr.city)}" maxlength="100"></div>
                <div class="form-group"><label>State</label><input type="text" class="edit-state" value="${escapeHtml(addr.state || '')}" maxlength="100"></div>
                <div class="form-group"><label>Postal Code</label><input type="text" class="edit-postal" value="${escapeHtml(addr.postal_code)}" maxlength="20"></div>
                <div class="form-group"><label>Country</label><input type="text" class="edit-country" value="${escapeHtml(addr.country)}" maxlength="2"></div>
                <div class="form-group"><label>Phone</label><input type="tel" class="edit-phone" value="${escapeHtml(addr.phone_number || '')}" maxlength="30"></div>
                <div class="actions"><button class="btn btn-sm primary save-edit-addr" data-id="${escapeHtml(id)}">Save</button><button class="btn btn-sm secondary cancel-edit-addr">Cancel</button></div>
            `);
            $card.find('.cancel-edit-addr').on('click', () => loadShippingAddresses());
            $card.find('.save-edit-addr').on('click', async function () {
                const $saveBtn = $(this);
                setLoading($saveBtn, true, 'Saving...');
                const payload = {
                    label: $card.find('.edit-label').val().trim(),
                    name: $card.find('.edit-name').val().trim(),
                    street1: $card.find('.edit-street1').val().trim(),
                    street2: $card.find('.edit-street2').val().trim() || null,
                    city: $card.find('.edit-city').val().trim(),
                    state: $card.find('.edit-state').val().trim() || null,
                    postal_code: $card.find('.edit-postal').val().trim(),
                    country: $card.find('.edit-country').val().trim().toUpperCase(),
                    phone_number: $card.find('.edit-phone').val().trim() || null,
                };
                console.log('[Settings] Updating address:', id, payload);
                try {
                    await api.patch(`/user/shipping-addresses/${id}`, payload);
                    console.log('[Settings] Address updated');
                    showSuccess($s, 'Address updated.');
                    setTimeout(() => { clearMessages($s); loadShippingAddresses(); }, 1000);
                } catch (err) {
                    console.error('[Settings] Update address failed:', err.message);
                    showError($s, err.message);
                    setLoading($saveBtn, false);
                }
            });
        });
    }

    async function loadSourceCredentials() {
        const $s = $container.find('#section-sources');
        try {
            const data = await api.get('/search/credentials');
            console.log('[Settings] Source credentials loaded:', data);
            const se = (data.providers || []).find(p => p.provider === 'standard_ebooks');
            const seConfigured = se && se.configured;
            let html = `
                <h3>Book Sources</h3>
                <p class="hint" style="margin-bottom:0.75rem;">Configure where to search for public domain books to import into your projects.</p>
                <p><strong>Project Gutenberg</strong> — No credentials needed. Over 70,000 free ebooks available.</p>
                <div style="margin-top:0.75rem;">
                    <p><strong>Standard Ebooks</strong> — ${seConfigured ? '<span class="credential-status">✓ Configured</span>' : '<span class="credential-status not-configured">Not configured</span>'}</p>
                    <p class="hint" style="margin:0.25rem 0 0.5rem;">Requires Patrons Circle membership ($10+/month at <a href="https://standardebooks.org/donate#patrons-circle" target="_blank" rel="noopener">standardebooks.org</a>). Enter the email associated with your membership to access the OPDS catalog.</p>
            `;
            if (seConfigured) {
                html += `<button class="btn btn-sm btn-danger" id="remove-se-cred">Remove</button>`;
            } else {
                html += `
                    <div class="form-group" style="margin-top:0.5rem;">
                        <label>Patron Email</label>
                        <input type="email" id="se-email" placeholder="your-email@example.com" maxlength="254">
                    </div>
                    <button class="btn btn-sm primary" id="save-se-cred">Save</button>
                `;
            }
            html += `</div>`;
            $s.html(html);

            $s.find('#save-se-cred').on('click', async function () {
                const email = $s.find('#se-email').val().trim();
                if (!email) {
                    showError($s, 'Please enter your Patrons Circle email.');
                    return;
                }
                clearMessages($s);
                const $btn = $(this);
                setLoading($btn, true, 'Saving...');
                try {
                    await api.post('/search/credentials', { provider: 'standard_ebooks', credentials: { email } });
                    console.log('[Settings] Standard Ebooks credentials saved');
                    showSuccess($s, 'Standard Ebooks credentials saved.');
                    setTimeout(() => loadSourceCredentials(), 1500);
                } catch (err) {
                    console.error('[Settings] Save SE credentials failed:', err.message);
                    showError($s, err.message);
                } finally {
                    setLoading($btn, false);
                }
            });

            $s.find('#remove-se-cred').on('click', async function () {
                clearMessages($s);
                try {
                    await api.delete('/search/credentials/standard_ebooks');
                    console.log('[Settings] Standard Ebooks credentials removed');
                    showSuccess($s, 'Standard Ebooks credentials removed.');
                    setTimeout(() => loadSourceCredentials(), 1500);
                } catch (err) {
                    console.error('[Settings] Remove SE credentials failed:', err.message);
                    showError($s, err.message);
                }
            });
        } catch (err) {
            $s.find('.loading').replaceWith(`<p class="error">Failed to load source credentials: ${escapeHtml(err.message)}</p>`);
        }
    }

    async function loadSharedImages() {
        const $s = $container.find('#section-shared-images');
        console.log('[Settings] Loading shared images');
        try {
            const data = await api.get('/user/shared-images');
            console.log('[Settings] Shared images loaded, count:', (data.images || []).length);
            renderSharedImages($s, data.images || []);
        } catch (err) {
            console.error('[Settings] Shared images load failed:', err.message);
            $s.find('.loading').replaceWith(`<p class="error">Failed to load shared images: ${escapeHtml(err.message)}</p>`);
        }
    }

    function renderSharedImages($s, images) {
        console.log('[Settings] renderSharedImages, count:', images.length);

        let thumbnailsHtml = '';
        if (images.length === 0) {
            thumbnailsHtml = '<p style="color:#666;">No shared images yet. Upload images to reuse across all your books.</p>';
        } else {
            thumbnailsHtml = '<div class="shared-images-grid">';
            for (const img of images) {
                const thumbUrl = `/api/user/shared-images/${img.image_uuid}/thumb`;
                thumbnailsHtml += `
                    <div class="shared-image-card" data-uuid="${escapeHtml(img.image_uuid)}" style="display:inline-block; text-align:center; margin:0.5rem; vertical-align:top; width:120px;">
                        <div style="width:100px; height:100px; margin:0 auto; border:1px solid var(--tan, #d2b48c); border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#f9f5ef;">
                            <img src="${thumbUrl}" alt="${escapeHtml(img.label)}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display='none'" />
                        </div>
                        <p style="margin:0.25rem 0 0; font-size:0.8rem; word-break:break-word;">${escapeHtml(img.label)}</p>
                        <button class="btn btn-xs btn-danger delete-shared-img" data-uuid="${escapeHtml(img.image_uuid)}" data-label="${escapeHtml(img.label)}" style="margin-top:0.25rem;" title="Delete this shared image">Delete</button>
                    </div>
                `;
            }
            thumbnailsHtml += '</div>';
        }

        $s.html(`
            <h3>Shared Images</h3>
            <p class="hint">Images in your shared pool are available across all your book projects. Upload logos, decorative elements, or any image you want to reuse.</p>
            ${thumbnailsHtml}
            <div style="margin-top:1rem;">
                <label class="btn btn-sm primary" style="cursor:pointer;">
                    📤 Upload Image
                    <input type="file" id="shared-images-upload" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" style="display:none" />
                </label>
                <div id="shared-images-upload-progress" style="display:none; margin-top:0.5rem;">
                    <div style="background:#e8d5b7; border-radius:4px; height:20px; overflow:hidden; border:1px solid var(--tan, #d2b48c);">
                        <div id="shared-images-upload-bar" style="background:var(--saddle-brown, #8b4513); height:100%; width:0%; transition:width 0.3s;"></div>
                    </div>
                    <span id="shared-images-upload-text" class="hint" style="font-size:0.75rem;">0%</span>
                </div>
            </div>
        `);

        // Bind upload
        $s.find('#shared-images-upload').on('change', function () {
            const file = this.files[0];
            if (file) {
                console.log('[Settings] Shared image file selected:', file.name, 'type:', file.type, 'size:', file.size);
                handleSharedImageUpload($s, file);
            }
            $(this).val('');
        });

        // Bind delete buttons
        $s.find('.delete-shared-img').on('click', async function () {
            const uuid = $(this).data('uuid');
            const label = $(this).data('label');
            console.log('[Settings] Delete shared image clicked, uuid:', uuid, 'label:', label);
            if (!confirm(`Delete shared image "${label}"? This cannot be undone.`)) {
                console.log('[Settings] Delete shared image cancelled by user');
                return;
            }
            console.log('[Settings] Delete shared image confirmed, uuid:', uuid);
            clearMessages($s);
            try {
                await api.delete(`/user/shared-images/${uuid}`);
                console.log('[Settings] Shared image deleted successfully, uuid:', uuid);
                showSuccess($s, `Image "${label}" deleted.`);
                setTimeout(() => { clearMessages($s); loadSharedImages(); }, 1000);
            } catch (err) {
                console.error('[Settings] Delete shared image failed:', err.message, err);
                showError($s, `Failed to delete image: ${err.message}`);
            }
        });

        console.log('[Settings] renderSharedImages complete, events bound');
    }

    function handleSharedImageUpload($s, file) {
        console.log('[Settings] handleSharedImageUpload starting, file:', file.name, 'type:', file.type, 'size:', file.size);

        // Validate file type client-side
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            console.error('[Settings] Shared image upload rejected — invalid file type:', file.type);
            showError($s, 'Only PNG, JPG, and WEBP files are accepted.');
            return;
        }

        // Show progress bar
        const $progress = $s.find('#shared-images-upload-progress');
        const $bar = $s.find('#shared-images-upload-bar');
        const $text = $s.find('#shared-images-upload-text');
        $progress.show();
        $bar.css('width', '0%');
        $text.text('0%');

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        // Real upload progress via XHR progress events
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log('[Settings] Shared image upload progress:', percent, '% (loaded:', e.loaded, '/ total:', e.total, ')');
                $bar.css('width', percent + '%');
                $text.text(percent + '%');
            }
        };

        xhr.onload = function () {
            console.log('[Settings] Shared image upload XHR onload, status:', xhr.status, 'response:', xhr.responseText.substring(0, 300));
            $progress.hide();

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    console.log('[Settings] Shared image upload successful:', result);
                    showSuccess($s, `Image "${result.label || file.name}" uploaded.`);
                    setTimeout(() => { clearMessages($s); loadSharedImages(); }, 1000);
                } catch (parseErr) {
                    console.error('[Settings] Shared image upload response parse error:', parseErr.message, 'raw:', xhr.responseText);
                    showSuccess($s, 'Image uploaded.');
                    setTimeout(() => { clearMessages($s); loadSharedImages(); }, 1000);
                }
            } else {
                console.error('[Settings] Shared image upload failed, status:', xhr.status, 'response:', xhr.responseText);
                let errorMsg = 'Upload failed';
                try {
                    const errData = JSON.parse(xhr.responseText);
                    errorMsg = errData.detail || errData.message || errorMsg;
                    if (errData.traceback) {
                        console.error('[Settings] Server traceback:', errData.traceback);
                    }
                } catch (e) {
                    errorMsg = xhr.responseText || errorMsg;
                }
                showError($s, 'Upload failed: ' + errorMsg);
            }
        };

        xhr.onerror = function () {
            console.error('[Settings] Shared image upload XHR network error');
            $progress.hide();
            showError($s, 'Upload failed — network error. Please try again.');
        };

        xhr.onabort = function () {
            console.warn('[Settings] Shared image upload XHR aborted');
            $progress.hide();
        };

        const uploadUrl = '/api/user/shared-images/upload';
        console.log('[Settings] Opening XHR POST to:', uploadUrl);
        xhr.open('POST', uploadUrl, true);
        xhr.withCredentials = true;
        xhr.send(formData);
        console.log('[Settings] XHR send() called for shared image upload');
    }
}
