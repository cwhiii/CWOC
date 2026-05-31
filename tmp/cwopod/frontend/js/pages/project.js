/**
 * Project Wizard page — 5-step workflow (Source → Typo Check → Typeset → Cover → Print).
 */

import { api } from '../api.js';
import { showError, showErrorWithAction, showSuccess, clearMessages, setLoading, renderStatusBadge, escapeHtml } from '../dom.js';
import { navigate } from '../router.js';
import { createProgressTracker, buildProgressHtml, updateProgressDisplay, showProgressError, getStageInfo, TASK_ESTIMATES } from '../progress.js';
import { addressPickerHtml, initAddressPicker, getSelectedShippingAddress, saveCustomAddressIfRequested } from '../address-picker.js';

const STEPS = [
    { id: 'source', label: 'Source', description: 'Find a book' },
    { id: 'import', label: 'Import', description: 'Download & create project' },
    { id: 'print_size', label: 'Print Size', description: 'Choose trim size' },
    { id: 'profanity', label: 'Profanity Filter', description: 'Filter sensitive words', optional: true },
    { id: 'typos', label: 'Typo Check', description: 'Review corrections', optional: true },
    { id: 'illustrations', label: 'Illustrations', description: 'Place images', optional: true },
    { id: 'typeset', label: 'Typeset', description: 'Generate interior PDF' },
    { id: 'cover_prompts', label: 'Prompts', description: 'Generate cover ideas', group: 'Cover' },
    { id: 'cover_images', label: 'Images', description: 'Generate & choose art', group: 'Cover' },
    { id: 'cover_builder', label: 'Builder', description: 'Assemble your cover', group: 'Cover' },
    { id: 'print', label: 'Print', description: 'Order your book' },
];

export async function render($container, params) {
    const projectId = params.id;
    console.log('[Project] Rendering project wizard, id:', projectId);

    $container.html('<p class="loading">Loading project...</p>');

    let project = null;
    let currentStep = 0;
    let illustrationsStepVisited = false;

    try {
        project = await api.get(`/projects/${projectId}`);
        console.log('[Project] Loaded:', { title: project.title, status: project.status });
        currentStep = statusToStep(project.status);
    } catch (err) {
        console.error('[Project] Load failed:', err.message);
        $container.html(`<div class="panel"><p class="error">Failed to load project: ${escapeHtml(err.message)}</p></div>`);
        return;
    }

    renderWizard();

    function statusToStep(status) {
        if (status === 'print_ready' || status === 'ordered' || status === 'shipped') return 10;
        if (status === 'cover_ready') return 7;
        if (status === 'typeset') return 6;
        return 2;
    }

    function renderWizard() {
        let html = `<h1>${escapeHtml(project.title)}</h1>`;
        if (project.author) html += `<p style="color:#8b4513; font-style:italic; margin-bottom:1.5rem;">by ${escapeHtml(project.author)}</p>`;

        // Step indicators
        html += '<nav class="steps">';
        let i = 0;
        while (i < STEPS.length) {
            const step = STEPS[i];
            if (step.group) {
                // Render a group cluster
                const groupName = step.group;
                const groupStart = i;
                const groupSteps = [];
                while (i < STEPS.length && STEPS[i].group === groupName) {
                    groupSteps.push({ step: STEPS[i], index: i });
                    i++;
                }
                // Connector before group
                if (groupStart > 0) {
                    html += `<div class="step-connector ${groupStart - 1 < currentStep ? 'done' : ''}"></div>`;
                }
                html += '<div class="step-group">';
                html += '<div class="step-group-items">';
                groupSteps.forEach((gs, gi) => {
                    const cls = gs.index === currentStep ? 'active' : (gs.index < currentStep ? 'done' : '');
                    const disabled = gs.index > currentStep ? 'disabled' : '';
                    html += `<button class="step ${cls}" data-step="${gs.index}" ${disabled}><span class="step-number">${gs.index + 1}</span><span class="step-label">${gs.step.label}</span>${gs.step.optional ? '<span class="step-optional">optional</span>' : ''}</button>`;
                    if (gi < groupSteps.length - 1) {
                        html += `<div class="step-connector ${gs.index < currentStep ? 'done' : ''}"></div>`;
                    }
                });
                html += '</div>';
                html += `<span class="step-group-label">${groupName}</span>`;
                html += '</div>';
            } else {
                // Connector before this step (if not first)
                if (i > 0 && !STEPS[i - 1].group) {
                    html += `<div class="step-connector ${i - 1 < currentStep ? 'done' : ''}"></div>`;
                } else if (i > 0 && STEPS[i - 1].group) {
                    html += `<div class="step-connector ${i - 1 < currentStep ? 'done' : ''}"></div>`;
                }
                const cls = i === currentStep ? 'active' : (i < currentStep ? 'done' : '');
                const disabled = i > currentStep ? 'disabled' : '';
                html += `<button class="step ${cls}" data-step="${i}" ${disabled}><span class="step-number">${i + 1}</span><span class="step-label">${step.label}</span>${step.optional ? '<span class="step-optional">optional</span>' : ''}</button>`;
                i++;
            }
        }
        html += '</nav>';
        html += '<div id="step-content" class="panel"></div>';
        $container.html(html);

        // Step click handlers
        $container.find('.step').on('click', async function () {
            const step = parseInt($(this).data('step'));
            // Steps 0 (Source) and 1 (Import) are always done on the project page — not navigable
            if (step <= 1) {
                console.log('[Project] Step', step, 'is pre-project (Source/Import), not navigable');
                return;
            }
            if (step <= currentStep) {
                console.log('[Project] Step clicked:', step, STEPS[step].id);

                // Typeset gate: if navigating to typeset step (index 5), evaluate gate
                if (step === 5) {
                    // Allow if illustrations step was never visited
                    if (!illustrationsStepVisited) {
                        console.log('[Project] Typeset gate: illustrations step never visited, allowing navigation');
                    } else {
                        const gateResult = await evaluateTypesetGate();
                        if (!gateResult.allowed) {
                            console.log('[Project] Typeset gate blocked navigation:', gateResult.blocking_count, 'images need placement/locking');
                            const $content = $container.find('#step-content');
                            showError($content,
                                `${gateResult.blocking_count} illustration${gateResult.blocking_count !== 1 ? 's' : ''} need placement/locking before typesetting`);
                            return;
                        }
                        console.log('[Project] Typeset gate passed, allowing navigation');
                    }
                }

                currentStep = step;
                renderStepContent();
                // Update step indicators
                $container.find('.step').each(function () {
                    const idx = parseInt($(this).data('step'));
                    $(this).removeClass('active done');
                    if (idx === currentStep) $(this).addClass('active');
                    else if (idx < currentStep) $(this).addClass('done');
                });
            }
        });

        renderStepContent();
    }

    function renderStepContent() {
        const $content = $container.find('#step-content');
        console.log('[Project] Rendering step:', currentStep, STEPS[currentStep].id);

        switch (currentStep) {
            case 2: renderPrintSizeStep($content); break;
            case 3: renderProfanityFilterStep($content); break;
            case 4: renderTypoStep($content); break;
            case 5: renderIllustrationsStep($content); break;
            case 6: renderTypesetStep($content); break;
            case 7: renderCoverStep($content, 'prompts'); break;
            case 8: renderCoverStep($content, 'images'); break;
            case 9: renderCoverStep($content, 'builder'); break;
            case 10: renderPrintStep($content); break;
        }
    }

    function renderSourceStep($el) {
        console.log('[Project] Rendering source step, source_type:', project.source_type);
        $el.html(`
            <h2>Source Imported</h2>
            <p>Your book has been imported and is ready for processing.</p>
            <div class="meta">
                <span>Source: ${escapeHtml(project.source_type || 'file')}</span>
                ${project.source_url ? `<a href="${escapeHtml(project.source_url)}" target="_blank">View original</a>` : ''}
                <a href="/api/projects/${projectId}/source-file" class="btn secondary" id="download-source" download>Download Source File</a>
            </div>
            <div class="step-nav">
                <button class="btn primary" id="continue-typo">Continue to Print Size →</button>
            </div>

        `);
        $el.find('#download-source').on('click', function() {
            console.log('[Project] Download source file clicked, project_id:', projectId);
        });
        $el.find('#continue-typo').on('click', () => { currentStep = 2; renderWizard(); });
    }

    function renderPrintSizeStep($el) {
        const currentTrim = project.trim_size || '5.5x8.5';
        console.log('[Project] Rendering print size step, current trim_size:', currentTrim);

        $el.html(`
            <h2>Print Size</h2>
            <p>Choose the trim size for your printed book. This determines the dimensions of both the interior pages and the cover.</p>
            <div class="form-group">
                <label>Trim Size</label>
                <select id="select-trim-size">
                    <option value="5x8" ${currentTrim === '5x8' ? 'selected' : ''}>5" × 8" (Small Digest)</option>
                    <option value="5.06x7.81" ${currentTrim === '5.06x7.81' ? 'selected' : ''}>5.06" × 7.81" (BookVault B-format)</option>
                    <option value="5.25x8" ${currentTrim === '5.25x8' ? 'selected' : ''}>5.25" × 8" (Large Digest)</option>
                    <option value="5.5x8.5" ${currentTrim === '5.5x8.5' ? 'selected' : ''}>5.5" × 8.5" (Trade Paperback) — most common</option>
                    <option value="6x9" ${currentTrim === '6x9' ? 'selected' : ''}>6" × 9" (Large Trade)</option>
                    <option value="8.5x11" ${currentTrim === '8.5x11' ? 'selected' : ''}>8.5" × 11" (Letter)</option>
                </select>
                <p class="hint">This size will be used for typesetting, cover generation, and printing. You can change it later, but the interior PDF and cover will need to be regenerated.</p>
            </div>
            <div id="trim-size-status"></div>
            <div class="step-nav">
                <button class="btn primary" id="save-trim-continue">Continue to Profanity Filter →</button>
            </div>
        `);

        $el.find('#save-trim-continue').on('click', async function () {
            const $btn = $(this);
            const $status = $el.find('#trim-size-status');
            const selectedTrim = $el.find('#select-trim-size').val();
            console.log('[Project] Saving trim size:', selectedTrim);
            setLoading($btn, true, 'Saving...');
            clearMessages($status);

            try {
                await api.patch(`/projects/${projectId}/print-options`, { trim_size: selectedTrim });
                project.trim_size = selectedTrim;
                console.log('[Project] Trim size saved:', selectedTrim);

                // If the interior PDF was already generated with a different size, warn
                if (project.interior_pdf_path && currentTrim !== selectedTrim) {
                    console.log('[Project] Trim size changed from', currentTrim, 'to', selectedTrim, '— interior PDF will need regeneration');
                    showSuccess($status, 'Trim size updated. Your interior PDF and cover will be regenerated with the new size.');
                }

                currentStep = 3;
                renderWizard();
            } catch (err) {
                console.error('[Project] Failed to save trim size:', err.message);
                showError($status, 'Failed to save: ' + err.message);
                setLoading($btn, false);
            }
        });
    }

    async function renderProfanityFilterStep($el) {
        console.log('[Project] Rendering profanity filter step');
        
        // Fetch current user preference for profanity filter
        let profanityEnabled = false;
        try {
            const prefs = await api.get('/user/preferences');
            profanityEnabled = prefs.profanity_filter_enabled === true;
            console.log('[Project] Current profanity_filter_enabled:', profanityEnabled);
        } catch (err) {
            console.error('[Project] Failed to load user preferences:', err.message);
        }

        $el.html(`
            <h2>Profanity Filter</h2>
            <p>Optionally filter sensitive words from your book. Filtered words will be replaced with █ blocks in the printed text.</p>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="profanity-filter-enabled" ${profanityEnabled ? 'checked' : ''}>
                    <span>Enable profanity filter</span>
                </label>
                <p class="hint">When enabled, matched words will be replaced with █ blocks in the final printed book.</p>
            </div>
            <div id="profanity-status"></div>
            <div class="step-nav">
                <button class="btn secondary" id="back-to-print-size-profane">← Back to Print Size</button>
                <button class="btn primary" id="save-profanity-continue">Continue to Typo Check →</button>
            </div>
        `);

        $el.find('#back-to-print-size-profane').on('click', () => { currentStep = 2; renderWizard(); });
        
        $el.find('#save-profanity-continue').on('click', async function () {
            const $btn = $(this);
            const $status = $el.find('#profanity-status');
            const enabled = $el.find('#profanity-filter-enabled').is(':checked');
            
            console.log('[Project] Saving profanity filter:', enabled);
            setLoading($btn, true, 'Saving...');
            clearMessages($status);

            try {
                await api.patch('/user/preferences', { profanity_filter_enabled: enabled });
                console.log('[Project] Profanity filter saved:', enabled);
                showSuccess($status, 'Profanity filter ' + (enabled ? 'enabled' : 'disabled') + '.');
                
                currentStep = 4;
                renderWizard();
            } catch (err) {
                console.error('[Project] Failed to save profanity filter:', err.message);
                showError($status, 'Failed to save: ' + err.message);
                setLoading($btn, false);
            }
        });
    }

    function renderTypoStep($el) {
        $el.html(`
            <h2>Typo Correction</h2>
            <p>Optionally scan for typos before typesetting. This uses AI to find misspellings.</p>
            <div class="actions">
                <button class="btn primary" id="scan-typos">Scan for Typos</button>
            </div>
            <div id="corrections-area"></div>
            <div class="step-nav">
                <button class="btn secondary" id="back-to-profanity">← Back to Profanity Filter</button>
                <button class="btn secondary" id="skip-typo">Continue to Illustrations →</button>
            </div>
        `);
        $el.find('#back-to-profanity').on('click', () => { currentStep = 3; renderWizard(); });
        $el.find('#skip-typo').on('click', () => { currentStep = 5; renderWizard(); });
        $el.find('#scan-typos').on('click', startTypoScan);
    }

    async function startTypoScan() {
        const $btn = $container.find('#scan-typos');
        const $area = $container.find('#corrections-area');
        setLoading($btn, true, 'Starting scan...');
        clearMessages($area);

        try {
            const resp = await api.post(`/projects/${projectId}/scan-typos`);
            const taskId = resp.task_id;
            console.log('[Typos] Scan started, task_id:', taskId);
            $area.html(buildProgressHtml({ color: '#8b4513', colorEnd: '#d2691e', showChapterFeed: true, feedLabel: 'Corrections found:' }));
            _killAborted = false;
            bindForceKill($area, taskId, () => {
                showProgressError($area.find('.task-progress'), 'Typo scan killed by user.');
                setLoading($container.find('#scan-typos'), false);
            });
            const tracker = createProgressTracker({ estimatedTotalSeconds: TASK_ESTIMATES.typo_scan });
            pollTypoTask($area, taskId, 0, null, 0, tracker, []);
        } catch (err) {
            console.error('[Typos] Failed to start scan:', err);
            if (err.message && (err.message.includes('not available') || err.message.includes('not reachable') || err.message.includes('Ensure the service'))) {
                showErrorWithAction(
                    $area,
                    'Scan failed: ' + err.message + ' — Download the required model from Settings.',
                    { text: 'Go to Settings →', href: '/settings' }
                );
            } else {
                showError($area, 'Scan failed: ' + err.message);
            }
            setLoading($btn, false);
        }
    }

    // --- Force Kill helper ---
    let _killAborted = false;

    function bindForceKill($progressArea, taskId, onKilled) {
        $progressArea.find('.force-kill-task').off('click').on('click', async function () {
            const confirmed = confirm(
                'Are you sure you want to force kill this task?\n\n' +
                'This will terminate the task on the server. You cannot undo this.'
            );
            if (!confirmed) {
                console.log('[Project] Force kill cancelled by user');
                return;
            }
            console.log('[Project] Force killing task:', taskId);
            const $btn = $(this);
            $btn.prop('disabled', true).text('Killing...');
            try {
                await api.post(`/projects/${projectId}/cancel-task`, { task_id: taskId });
                console.log('[Project] Task killed successfully');
                _killAborted = true;
                if (onKilled) onKilled();
            } catch (err) {
                console.error('[Project] Force kill failed:', err.message);
                alert('Failed to kill task: ' + err.message);
                $btn.prop('disabled', false).text('⛔ Force Kill');
            }
        });
    }

    function pollTypoTask($area, taskId, attempts, lastStage, staleCount, tracker, seenCorrections) {
        // No hard timeout — as long as the backend says the task is running, we keep polling.
        // Typo scan on CPU can take 20-40+ minutes for a full novel.
        if (attempts > 0 && attempts % 300 === 0) {
            console.log('[Typos] Still polling after', attempts, 'attempts — task is still running, continuing to wait');
        }
        setTimeout(async () => {
            if (_killAborted) { console.log('[Typos] Poll aborted (task killed)'); return; }
            try {
                const data = await api.get(`/projects/${projectId}/scan-typos/status/${taskId}`);
                const pct = data.percent;
                const hasPct = pct != null;
                console.log('[Typos] Poll attempt', attempts + 1, ':', data.status, hasPct ? pct + '%' : 'no %', data.label,
                    'corrections_so_far:', data.corrections_so_far || 0);

                // Track for stale detection — include tokens_generated so active inference resets the counter
                const tokensGen = data.tokens_generated || 0;
                const currentStage = data.status + ':' + (pct || 0) + ':' + (data.current_chunk || 0) + ':' + tokensGen;
                let newStaleCount = (currentStage === (lastStage || '')) ? (staleCount || 0) + 1 : 0;

                // Update tracker only when we have real percent
                if (hasPct && pct > 0) {
                    tracker.update(pct);
                }

                // Determine stage info
                const stageInfo = getStageInfo(data.stage || 'scanning', {
                    current: data.current_chunk,
                    total: data.total_chunks
                });

                // Build label with chapter and total info
                let displayLabel = data.label || 'Starting...';
                if (hasPct && data.total_chunks > 0) {
                    const corrCount = data.corrections_so_far || 0;
                    displayLabel += ` — ${corrCount} correction${corrCount !== 1 ? 's' : ''} found`;
                    if (tokensGen > 0 && data.inference_active) {
                        displayLabel += ` (generating: ${tokensGen} tokens)`;
                    }
                }

                // Update progress display
                if (hasPct) {
                    updateProgressDisplay($area.find('.task-progress'), {
                        percent: pct,
                        label: displayLabel,
                        stageText: stageInfo.text,
                        stageIcon: stageInfo.icon,
                        elapsed: tracker.getElapsed(),
                        eta: pct > 0 ? tracker.getETA(pct) : '',
                        color: '#8b4513',
                        colorEnd: '#d2691e'
                    });
                } else {
                    // No real percent yet — show indeterminate/shimmer
                    updateProgressDisplay($area.find('.task-progress'), {
                        percent: 0,
                        label: displayLabel,
                        stageText: stageInfo.text,
                        stageIcon: stageInfo.icon,
                        elapsed: tracker.getElapsed(),
                        eta: '',
                        shimmer: true,
                        color: '#8b4513',
                        colorEnd: '#d2691e'
                    });
                }

                // Show recent corrections in the live feed
                if (data.recent_corrections && data.recent_corrections.length > 0) {
                    const $feed = $area.find('.chapter-notes-feed');
                    // Clear placeholder on first real correction
                    if (seenCorrections.length === 0) {
                        $feed.empty();
                    }
                    for (const c of data.recent_corrections) {
                        const key = c.original + '→' + c.suggested;
                        if (!seenCorrections.includes(key)) {
                            seenCorrections.push(key);
                            const $entry = $(`<div class="correction-feed-item" style="padding:4px 0; border-bottom:1px solid #e8e0d8;"><span style="text-decoration:line-through; color:#c0392b;">${escapeHtml(c.original)}</span> <span style="color:#666;">→</span> <span style="color:#27ae60; font-weight:500;">${escapeHtml(c.suggested)}</span></div>`);
                            $feed.append($entry);
                            $feed.scrollTop($feed[0].scrollHeight);
                        }
                    }
                }

                if (data.status === 'complete') {
                    updateProgressDisplay($area.find('.task-progress'), {
                        percent: 100,
                        label: 'Scan complete',
                        stageText: 'All text chunks analyzed',
                        stageIcon: '✅',
                        elapsed: tracker.getElapsed(),
                        eta: 'Done!',
                        color: '#8b4513',
                        colorEnd: '#d2691e'
                    });
                    console.log('[Typos] Complete:', data.result);
                    // Now load the corrections
                    const corrections = await api.get(`/projects/${projectId}/corrections`);
                    if (corrections.length > 0) {
                        renderCorrections($area, corrections);
                    } else {
                        $area.html('<p>No typos found! Your text looks clean.</p><div class="step-nav"><button class="btn secondary" id="back-to-profanity-2">← Back to Profanity Filter</button><button class="btn primary" id="advance-illustrations">Continue to Illustrations →</button></div>');
                        $area.find('#back-to-profanity-2').on('click', () => { currentStep = 3; renderWizard(); });
                        $area.find('#advance-illustrations').on('click', () => { currentStep = 5; renderWizard(); });
                    }
                } else if (data.status === 'failed') {
                    console.error('[Typos] Failed:', data.label);
                    if (data.label && (data.label.includes('not available') || data.label.includes('not reachable'))) {
                        $area.find('.task-progress').html(`<p class="error">Error: ${escapeHtml(data.label)} — Download the required model from <a href="/settings" class="error-action-link">Settings →</a></p>`);
                    } else {
                        showProgressError($area.find('.task-progress'), 'Error: ' + data.label);
                    }
                    setLoading($container.find('#scan-typos'), false);
                } else if (newStaleCount >= 90 && newStaleCount % 90 === 0) {
                    console.log('[Typos] No state change for', newStaleCount, 'polls — task still running, continuing to wait');
                    pollTypoTask($area, taskId, attempts + 1, currentStage, newStaleCount, tracker, seenCorrections);
                } else {
                    pollTypoTask($area, taskId, attempts + 1, currentStage, newStaleCount, tracker, seenCorrections);
                }
            } catch (err) {
                console.warn('[Typos] Poll error, retrying:', err);
                pollTypoTask($area, taskId, attempts + 1, lastStage, (staleCount || 0) + 1, tracker, seenCorrections);
            }
        }, 2000);
    }

    function renderCorrections($area, corrections) {
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin:1rem 0;"><span>${corrections.length} potential typos found</span><div class="actions"><button class="btn btn-sm secondary" id="accept-all">Accept All</button><button class="btn btn-sm secondary" id="reject-all">Reject All</button></div></div>`;
        html += '<ul class="corrections-list">';
        for (const c of corrections) {
            html += `<li class="correction-item ${c.status !== 'pending' ? c.status : ''}" data-id="${escapeHtml(c.id)}"><div class="correction-text"><span class="correction-original">${escapeHtml(c.original_text)}</span><span class="correction-arrow">→</span><span class="correction-suggested">${escapeHtml(c.suggested_text)}</span></div><p class="correction-context">${escapeHtml(c.context_sentence)}</p>${c.status === 'pending' ? '<div class="correction-actions"><button class="btn-accept" data-action="accepted">✓ Accept</button><button class="btn-reject" data-action="rejected">✗ Reject</button></div>' : `<span class="hint">${c.status}</span>`}</li>`;
        }
        html += '</ul><div class="step-nav"><button class="btn secondary" id="back-to-profanity-3">← Back to Profanity Filter</button><button class="btn primary" id="apply-corrections">Continue to Illustrations →</button></div>';
        $area.html(html);

        $area.find('.btn-accept, .btn-reject').on('click', async function () {
            const $item = $(this).closest('.correction-item');
            const id = $item.data('id');
            const status = $(this).data('action');
            try {
                await api.patch(`/projects/${projectId}/corrections`, { corrections: [{ id, status }] });
                $item.addClass(status).find('.correction-actions').html(`<span class="hint">${status}</span>`);
            } catch (err) { console.error('[Project] Update correction failed:', err.message); }
        });

        $area.find('#accept-all').on('click', async () => {
            try { 
                await api.patch(`/projects/${projectId}/corrections`, { bulk_action: 'accept_all' }); 
                // Reload corrections to show updated state
                const corrections = await api.get(`/projects/${projectId}/corrections`);
                renderCorrections($area, corrections);
            } catch (err) { showError($area, err.message); }
        });
        $area.find('#reject-all').on('click', async () => {
            try { 
                await api.patch(`/projects/${projectId}/corrections`, { bulk_action: 'reject_all' }); 
                const corrections = await api.get(`/projects/${projectId}/corrections`);
                renderCorrections($area, corrections);
            } catch (err) { showError($area, err.message); }
        });
        $area.find('#back-to-profanity-3').on('click', () => { currentStep = 3; renderWizard(); });
        $area.find('#apply-corrections').on('click', async function () {
            setLoading($(this), true, 'Applying...');
            try {
                await api.post(`/projects/${projectId}/corrections/apply`);
                currentStep = 5; renderWizard();
            } catch (err) { showError($area, err.message); setLoading($(this), false); }
        });
    }

    async function renderIllustrationsStep($el) {
        console.log('[Project] Rendering illustrations step');
        illustrationsStepVisited = true;

        $el.html(`
            <h2>Illustrations</h2>
            <p>Place and size images within your book before typesetting.</p>
            <div id="illustrations-container" class="loading">Loading illustrations module...</div>
            <div class="step-nav">
                <button class="btn secondary" id="back-to-typos">← Back to Typo Check</button>
                <button class="btn primary" id="skip-illustrations">Continue to Typeset →</button>
            </div>
        `);

        // Back button
        $el.find('#back-to-typos').on('click', () => { currentStep = 4; renderWizard(); });

        // Skip button — evaluate typeset gate before allowing skip
        $el.find('#skip-illustrations').on('click', async () => {
            console.log('[Project] Skip illustrations clicked, evaluating typeset gate');
            const gateResult = await evaluateTypesetGate();
            if (gateResult.allowed) {
                console.log('[Project] Typeset gate passed, advancing to typeset step');
                currentStep = 6;
                renderWizard();
            } else {
                console.log('[Project] Typeset gate blocked:', gateResult.blocking_count, 'images need placement/locking');
                showError($el.find('#illustrations-container'),
                    `${gateResult.blocking_count} illustration${gateResult.blocking_count !== 1 ? 's' : ''} need placement/locking before typesetting`);
            }
        });

        // Dynamically load the illustrations step module
        try {
            const module = await import('./project-illustrations.js');
            console.log('[Project] Illustrations module loaded');
            const $container = $el.find('#illustrations-container');
            $container.removeClass('loading').empty();
            module.render($container, { projectId });
        } catch (err) {
            console.error('[Project] Failed to load illustrations module:', err);
            $el.find('#illustrations-container')
                .removeClass('loading')
                .html(`<p class="error">Failed to load illustrations module: ${escapeHtml(err.message)}</p>`);
        }
    }

    /**
     * Evaluates the typeset gate: checks if any in_book images lack placement or lock.
     * Returns { allowed: bool, blocking_count: int }
     */
    async function evaluateTypesetGate() {
        console.log('[Project] Evaluating typeset gate for project:', projectId);
        try {
            const data = await api.get(`/projects/${projectId}/illustrations`);
            const inBookImages = (data.illustrations || data || []).filter(img => img.pool === 'in_book');
            console.log('[Project] Typeset gate: in_book images count:', inBookImages.length);

            // If no images in book, gate is open
            if (inBookImages.length === 0) {
                console.log('[Project] Typeset gate: no in_book images, allowing');
                return { allowed: true, blocking_count: 0 };
            }

            // Check for images lacking placement or lock
            const blocking = inBookImages.filter(img => {
                const hasPlacement = img.placement_mode || (img.placement && img.placement.mode);
                const isLocked = img.lock_state;
                return !hasPlacement || !isLocked;
            });

            console.log('[Project] Typeset gate: blocking images:', blocking.length);
            return { allowed: blocking.length === 0, blocking_count: blocking.length };
        } catch (err) {
            console.error('[Project] Typeset gate evaluation failed:', err.message);
            // If we can't reach the API, allow proceeding (don't block on network errors)
            return { allowed: true, blocking_count: 0 };
        }
    }

    function renderTypesetStep($el) {
        console.log('[Project] Rendering typeset step, has_pdf:', !!project.interior_pdf_path);
        let html = '<h2>Typesetting</h2>';

        // Presentation inscription page editor section
        html += `
            <div class="presentation-inscription-editor" style="margin-bottom:1.5rem; padding:1rem; border:1px solid var(--tan); border-radius:8px; background:var(--cream);">
                <h3 style="margin-bottom:0.5rem;">📖 Presentation Inscription <span style="font-weight:normal; font-size:0.85rem; color:var(--medium-brown);">(optional)</span></h3>
                <p style="font-size:0.9rem; color:var(--medium-brown); margin-bottom:0.75rem;">Add a personal message for the recipient — perfect for gifts. Appears after the title page.</p>

                <div class="presentation-inscription-mode-tabs" style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                    <button class="btn btn-sm" id="pres-mode-none" data-mode="none" style="font-size:0.8rem;">None</button>
                    <button class="btn btn-sm" id="pres-mode-text" data-mode="text" style="font-size:0.8rem;">✍️ Text</button>
                    <button class="btn btn-sm" id="pres-mode-image" data-mode="image" style="font-size:0.8rem;">🖼️ Image</button>
                </div>

                <div id="presentation-inscription-content"></div>
                <div id="presentation-inscription-status" style="margin-top:0.5rem;"></div>
            </div>
        `;

        if (project.interior_pdf_path) {
            html += `<p style="color:#008080; font-weight:600;">✓ Interior PDF already generated.</p><div class="actions"><a href="/api/projects/${projectId}/interior-pdf" class="btn secondary" download>Download PDF</a><button class="btn secondary" id="regenerate-typeset">Re-generate PDF</button></div><div id="typeset-status"></div><div class="step-nav"><button class="btn secondary" id="back-to-illustrations">← Back to Illustrations</button><a href="/projects/${projectId}/cover" class="btn primary">Continue to Cover →</a></div>`;
        } else {
            html += `<p>Generate a professionally formatted interior PDF ready for print.</p><button class="btn primary" id="start-typeset">Generate Interior PDF</button><div id="typeset-status"></div><div class="step-nav"><button class="btn secondary" id="back-to-illustrations">← Back to Illustrations</button></div>`;
        }

        $el.html(html);

        if (project.interior_pdf_path) {
            $el.find('#regenerate-typeset').on('click', startTypeset);
        } else {
            $el.find('#start-typeset').on('click', startTypeset);
        }

        $el.find('#back-to-illustrations').on('click', () => { currentStep = 5; renderWizard(); });

        // Initialize presentation inscription editor
        initPresentationInscriptionEditor($el);
    }

    async function initPresentationInscriptionEditor($el) {
        console.log('[PresentationInscription] Initializing presentation inscription editor');
        const $content = $el.find('#presentation-inscription-content');
        const $status = $el.find('#presentation-inscription-status');
        let currentMode = 'none';

        // Load existing presentation inscription data
        try {
            const data = await api.get(`/projects/${projectId}/dedication`);
            console.log('[PresentationInscription] Loaded existing presentation inscription:', data);
            currentMode = data.mode || 'none';
        } catch (err) {
            console.warn('[PresentationInscription] Failed to load presentation inscription:', err.message);
        }

        // Tab click handlers
        $el.find('.presentation-inscription-mode-tabs button').on('click', function () {
            const mode = $(this).data('mode');
            console.log('[PresentationInscription] Mode switched to:', mode);
            currentMode = mode;
            updateModeTabs();
            renderPresentationInscriptionContent();
        });

        function updateModeTabs() {
            $el.find('.presentation-inscription-mode-tabs button').removeClass('primary secondary').addClass('secondary');
            $el.find(`#pres-mode-${currentMode}`).removeClass('secondary').addClass('primary');
        }

        async function renderPresentationInscriptionContent() {
            $status.empty();
            if (currentMode === 'none') {
                $content.html('<p style="font-size:0.85rem; color:#999; font-style:italic;">No presentation inscription page will be included.</p>');
                // Clear presentation inscription on server
                try {
                    await api.delete(`/projects/${projectId}/dedication`);
                    console.log('[PresentationInscription] Cleared presentation inscription');
                } catch (err) {
                    console.warn('[PresentationInscription] Failed to clear:', err.message);
                }
            } else if (currentMode === 'text') {
                renderTextEditor();
            } else if (currentMode === 'image') {
                renderImageUploader();
            }
        }

        async function renderTextEditor() {
            // Load existing text
            let existingText = '';
            try {
                const data = await api.get(`/projects/${projectId}/dedication`);
                existingText = data.text || '';
            } catch (err) {
                console.warn('[PresentationInscription] Could not load text:', err.message);
            }

            $content.html(`
                <div class="presentation-inscription-text-editor">
                    <div class="presentation-inscription-toolbar" style="display:flex; gap:0.25rem; margin-bottom:0.5rem; padding:0.25rem; background:#f5f0e8; border-radius:4px;">
                        <button class="btn-toolbar" data-action="bold" title="Bold" style="padding:0.25rem 0.5rem; border:1px solid var(--tan); border-radius:3px; background:white; cursor:pointer; font-weight:bold;">B</button>
                        <button class="btn-toolbar" data-action="italic" title="Italic" style="padding:0.25rem 0.5rem; border:1px solid var(--tan); border-radius:3px; background:white; cursor:pointer; font-style:italic;">I</button>
                        <span style="border-left:1px solid var(--tan); margin:0 0.25rem;"></span>
                        <button class="btn-toolbar" data-action="center" title="The text is always centered on the page" style="padding:0.25rem 0.5rem; border:1px solid var(--tan); border-radius:3px; background:#e8e0d8; cursor:default; font-size:0.75rem;" disabled>Centered</button>
                    </div>
                    <textarea id="presentation-inscription-textarea" rows="6" style="width:100%; padding:0.75rem; border:1px solid var(--tan); border-radius:6px; font-family:var(--font-main); font-size:0.95rem; resize:vertical; text-align:center; line-height:1.8;" placeholder="For Grandma,\n\nWith all my love.\n\n— Joe">${escapeHtml(existingText)}</textarea>
                    <p style="font-size:0.75rem; color:#999; margin-top:0.25rem;">Use **bold** and _italic_ for formatting. Each line is centered on the page.</p>
                    <button class="btn primary btn-sm" id="save-presentation-inscription-text" style="margin-top:0.5rem;">Save Presentation Inscription</button>
                </div>
            `);

            // Toolbar button handlers
            $content.find('.btn-toolbar[data-action="bold"]').on('click', function () {
                console.log('[PresentationInscription] Bold button clicked');
                wrapSelection('**', '**');
            });
            $content.find('.btn-toolbar[data-action="italic"]').on('click', function () {
                console.log('[PresentationInscription] Italic button clicked');
                wrapSelection('_', '_');
            });

            // Save handler
            $content.find('#save-presentation-inscription-text').on('click', async function () {
                const text = $content.find('#presentation-inscription-textarea').val();
                console.log('[PresentationInscription] Saving text, length:', text.length);
                setLoading($(this), true, 'Saving...');
                try {
                    await api.put(`/projects/${projectId}/dedication/text`, { text });
                    $status.html('<span style="color:#008080; font-size:0.85rem;">✓ Presentation inscription saved</span>');
                    console.log('[PresentationInscription] Text saved successfully');
                } catch (err) {
                    console.error('[PresentationInscription] Save failed:', err.message);
                    $status.html(`<span style="color:var(--error-red); font-size:0.85rem;">Error: ${escapeHtml(err.message)}</span>`);
                }
                setLoading($(this), false);
            });
        }

        function wrapSelection(before, after) {
            const textarea = $content.find('#presentation-inscription-textarea')[0];
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end);
            const replacement = before + (selected || 'text') + after;
            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            // Position cursor
            const newPos = start + before.length + (selected ? selected.length : 4) + after.length;
            textarea.setSelectionRange(start + before.length, start + before.length + (selected ? selected.length : 4));
            textarea.focus();
            console.log('[PresentationInscription] Wrapped selection with', before, after);
        }

        function renderImageUploader() {
            $content.html(`
                <div class="presentation-inscription-image-upload">
                    <div id="presentation-inscription-image-preview" style="margin-bottom:0.75rem; text-align:center;"></div>
                    <label style="display:inline-block; padding:0.5rem 1rem; background:var(--btn-primary-bg); color:white; border-radius:6px; cursor:pointer; font-size:0.9rem;">
                        📁 Choose Image
                        <input type="file" id="presentation-inscription-image-input" accept="image/png,image/jpeg,image/webp" style="display:none;">
                    </label>
                    <p style="font-size:0.75rem; color:#999; margin-top:0.5rem;">PNG, JPG, or WebP. Max 10 MB. The image will be centered on the page.</p>
                </div>
            `);

            // Show existing image if any
            loadImagePreview();

            $content.find('#presentation-inscription-image-input').on('change', async function () {
                const file = this.files[0];
                if (!file) return;
                console.log('[PresentationInscription] Image selected:', file.name, file.size, 'bytes');

                if (file.size > 10 * 1024 * 1024) {
                    $status.html('<span style="color:var(--error-red); font-size:0.85rem;">Image must be under 10 MB</span>');
                    return;
                }

                // Upload
                $status.html('<span style="font-size:0.85rem; color:var(--medium-brown);">Uploading...</span>');
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch(`/api/projects/${projectId}/dedication/image`, {
                        method: 'PUT',
                        body: formData,
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        },
                    });
                    if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        throw new Error(errData.detail || `Upload failed (${resp.status})`);
                    }
                    console.log('[PresentationInscription] Image uploaded successfully');
                    $status.html('<span style="color:#008080; font-size:0.85rem;">✓ Presentation inscription image saved</span>');
                    // Show preview
                    showLocalPreview(file);
                } catch (err) {
                    console.error('[PresentationInscription] Image upload failed:', err.message);
                    $status.html(`<span style="color:var(--error-red); font-size:0.85rem;">Error: ${escapeHtml(err.message)}</span>`);
                }
            });
        }

        function loadImagePreview() {
            // If we know there's an image, show a placeholder
            if (currentMode === 'image') {
                api.get(`/projects/${projectId}/dedication`).then(data => {
                    if (data.has_image) {
                        $content.find('#presentation-inscription-image-preview').html(
                            '<p style="font-size:0.85rem; color:#008080;">✓ Presentation inscription image already uploaded. Choose a new file to replace it.</p>'
                        );
                    }
                }).catch(() => {});
            }
        }

        function showLocalPreview(file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $content.find('#presentation-inscription-image-preview').html(
                    `<img src="${e.target.result}" style="max-width:200px; max-height:200px; border:1px solid var(--tan); border-radius:4px;" alt="Presentation inscription image preview">`
                );
            };
            reader.readAsDataURL(file);
        }

        // Set initial state
        updateModeTabs();
        renderPresentationInscriptionContent();
    }

    async function startTypeset() {
        const $btn = $container.find('#start-typeset, #regenerate-typeset');
        const $status = $container.find('#typeset-status');
        console.log('[Typeset] startTypeset called, regenerate=%s', $container.find('#regenerate-typeset').length > 0);
        setLoading($btn, true, 'Generating...');

        try {
            // Determine provider from the project's trim size selection.
            // BookVault uses 5.06x7.81; everything else uses Lulu/KDP (same specs).
            let provider = 'lulu';
            const trimSize = project.trim_size || '5.5x8.5';
            if (trimSize === '5.06x7.81') {
                provider = 'bookvault';
            } else {
                // Check user preferences for lulu vs kdp (same trim but different submission)
                try {
                    const prefs = await api.get('/user/preferences');
                    provider = prefs.default_print_provider || 'lulu';
                    // BookVault provider with non-BookVault trim → fall back to lulu
                    if (provider === 'bookvault' && trimSize !== '5.06x7.81') {
                        provider = 'lulu';
                    }
                    console.log('[Typeset] Using provider:', provider, 'for trim:', trimSize);
                } catch (e) {
                    console.log('[Typeset] Could not load preferences, defaulting to lulu');
                }
            }
            console.log('[Typeset] Provider resolved:', provider, 'trim_size:', trimSize);

            const resp = await api.post(`/projects/${projectId}/typeset`, { provider });
            const taskId = resp.task_id;
            console.log('[Typeset] Task started, task_id:', taskId);
            $status.html(buildProgressHtml({ color: '#008080', colorEnd: '#00b3b3', showChapterFeed: false }));
            _killAborted = false;
            bindForceKill($status, taskId, () => {
                showProgressError($status.find('.task-progress'), 'PDF generation killed by user.');
                setLoading($container.find('#start-typeset'), false);
            });
            const tracker = createProgressTracker({ estimatedTotalSeconds: TASK_ESTIMATES.typeset });
            pollTypesetTask($status, taskId, 0, null, 0, 0, tracker);
        } catch (err) {
            console.error('[Typeset] Failed to start:', err);
            showError($status, err.message);
            setLoading($btn, false);
        }
    }

    function pollTypesetTask($status, taskId, attempts, lastStage, staleCount, networkErrors, tracker) {
        // No stale timeout — as long as the backend says the task is running, we keep polling.
        // Only give up after 60 consecutive network errors (2 minutes of total connection loss).
        const MAX_NETWORK_ERRORS = 60;
        staleCount = staleCount || 0;
        networkErrors = networkErrors || 0;
        lastStage = lastStage || '';

        setTimeout(async () => {
            if (_killAborted) { console.log('[Typeset] Poll aborted (task killed)'); return; }
            try {
                const data = await api.get(`/projects/${projectId}/typeset/status/${taskId}`);
                console.log('[Typeset] Poll attempt', attempts + 1, ':', data.status, data.stage, data.percent + '%');

                // Track whether progress is being made
                const currentStage = data.stage + ':' + data.percent;
                let newStaleCount = (currentStage === lastStage) ? staleCount + 1 : 0;

                // Update tracker
                const pct = data.percent || 0;
                tracker.update(pct);

                // Determine stage info
                const stageInfo = getStageInfo(data.stage || 'unknown');

                // Update progress display
                updateProgressDisplay($status.find('.task-progress'), {
                    percent: pct,
                    label: data.label,
                    stageText: stageInfo.text,
                    stageIcon: stageInfo.icon,
                    elapsed: tracker.getElapsed(),
                    eta: tracker.getETA(pct),
                    color: '#008080',
                    colorEnd: '#00b3b3'
                });

                if (data.status === 'complete') {
                    updateProgressDisplay($status.find('.task-progress'), {
                        percent: 100,
                        label: 'PDF generated successfully',
                        stageText: 'Interior PDF ready for print',
                        stageIcon: '✅',
                        elapsed: tracker.getElapsed(),
                        eta: 'Done!',
                        color: '#008080',
                        colorEnd: '#00b3b3'
                    });
                    console.log('[Typeset] Complete:', data.result);
                    // Refresh project and advance
                    project = await api.get(`/projects/${projectId}`);
                    const pageCount = data.result?.page_count || '?';
                    const chaptersDetected = data.result?.chapters_detected || '?';
                    showSuccess($status, `Interior PDF generated! (${pageCount} pages, ${chaptersDetected} chapters)`);
                    currentStep = 6; renderWizard();
                } else if (data.status === 'failed') {
                    console.error('[Typeset] Failed:', data.label);
                    showProgressError($status.find('.task-progress'), 'Error: ' + data.label);
                    setLoading($container.find('#start-typeset'), false);
                } else if (newStaleCount >= 60 && newStaleCount % 60 === 0) {
                    console.log('[Typeset] No progress for', newStaleCount, 'polls — task still running, continuing to wait');
                    pollTypesetTask($status, taskId, attempts + 1, currentStage, newStaleCount, 0, tracker);
                } else {
                    // Still in progress — keep polling (reset network error counter on success)
                    pollTypesetTask($status, taskId, attempts + 1, currentStage, newStaleCount, 0, tracker);
                }
            } catch (err) {
                console.warn('[Typeset] Poll error (attempt', attempts + 1, '):', err.message);
                const newNetworkErrors = networkErrors + 1;
                if (newNetworkErrors >= MAX_NETWORK_ERRORS) {
                    console.error('[Typeset] Too many consecutive network errors (60), giving up');
                    showProgressError($status.find('.task-progress'), 'Lost connection to server after 60 retries. Please check your connection and refresh.');
                    setLoading($container.find('#start-typeset'), false);
                } else {
                    pollTypesetTask($status, taskId, attempts + 1, lastStage, staleCount, newNetworkErrors, tracker);
                }
            }
        }, 2000);
    }

    function renderCoverStep($el, subStep) {
        // If cover is already done, show the "done" state with edit option
        if (project.cover_pdf_path) {
            $el.html(`<h2>Cover Design</h2><p style="color:#008080; font-weight:600;">✓ Cover PDF already generated.</p><div class="actions"><a href="/projects/${projectId}/cover" class="btn secondary">Edit Cover</a></div><div class="step-nav"><button class="btn secondary" id="back-to-typeset">← Back to Typeset</button><button class="btn primary" id="continue-print">Continue to Print →</button></div>`);
            $el.find('#back-to-typeset').on('click', () => { currentStep = 6; renderWizard(); });
            $el.find('#continue-print').on('click', () => { currentStep = 10; renderWizard(); });
            return;
        }
        // No intermediate page — navigate directly into the Cover Studio
        navigate(`/projects/${projectId}/cover`);
    }

    function renderPrintStep($el) {
        // Load user's preferred provider and print defaults
        let prefs = { default_print_provider: 'lulu', default_trim_size: '5.5x8.5', default_paper_type: 'white', default_color_interior: false, default_cover_finish: 'glossy', default_binding_type: 'paperback', default_font_size: '11pt' };

        api.get('/user/preferences').catch(err => {
            console.warn('[Project] Could not load preferences, using defaults:', err.message);
            return prefs;
        }).then(prefData => {
            prefs = prefData;
            console.log('[Project] Print step loaded: prefs=', prefs);

            const $select = $el.find('#print-provider');
            if ($select.length) {
                $select.val(prefs.default_print_provider || 'lulu');
                $select.trigger('change');
            }
            // Set print options from per-book values or fall back to user defaults
            $el.find('#book-paper-type').val(project.paper_type || prefs.default_paper_type || 'white');
            $el.find('#book-color-interior').val(project.color_interior != null ? String(project.color_interior) : String(prefs.default_color_interior || false));
            $el.find('#book-cover-finish').val(project.cover_finish || prefs.default_cover_finish || 'glossy');
            $el.find('#book-binding-type').val(project.binding_type || prefs.default_binding_type || 'paperback');
            $el.find('#book-font-size').val(project.font_size || prefs.default_font_size || '11pt');
            // Set the new-trim-size dropdown to current value
            $el.find('#new-trim-size').val(project.trim_size || prefs.default_trim_size || '5.5x8.5');
        });

        $el.html(`
            <h2>Print & Ship</h2>
            <p>Your book is ready to print! Choose a provider and submit your order.</p>
            <p style="font-size:0.9rem; color:#555; margin-bottom:1rem;">Current trim size: <strong>${escapeHtml(project.trim_size || '5.5x8.5')}</strong>${project.page_count ? ` · <strong>${project.page_count}</strong> pages` : ''}</p>
            <div id="page-count-warning" style="display:none;"></div>
            <div class="form-group"><label>Print Provider</label><select id="print-provider"><option value="lulu">Lulu xPress</option><option value="bookvault">BookVault</option><option value="kdp">KDP Print (manual upload)</option></select></div>
            <details id="print-options-details" style="margin:1rem 0; border:1px solid var(--tan); border-radius:6px; padding:0.75rem;">
                <summary style="cursor:pointer; font-weight:600;">Print Options <span class="hint" style="font-weight:normal;">(paper, color, finish, binding, font size)</span></summary>
                <div style="margin-top:0.75rem;">
                    <div class="form-group">
                        <label>Paper Type</label>
                        <select id="book-paper-type">
                            <option value="white">White (60# uncoated)</option>
                            <option value="cream">Cream (60# uncoated)</option>
                        </select>
                        <p class="hint">Same price — cream is traditional for fiction.</p>
                    </div>
                    <div class="form-group">
                        <label>Interior Color</label>
                        <select id="book-color-interior">
                            <option value="false">Black & White</option>
                            <option value="true">Full Color — significantly more expensive</option>
                        </select>
                        <p class="hint">Color interiors can cost 2–3× more per page.</p>
                    </div>
                    <div class="form-group">
                        <label>Cover Finish</label>
                        <select id="book-cover-finish">
                            <option value="glossy">Glossy</option>
                            <option value="matte">Matte</option>
                        </select>
                        <p class="hint">Same price — glossy is vibrant; matte feels more premium.</p>
                    </div>
                    <div class="form-group">
                        <label>Binding Type</label>
                        <select id="book-binding-type">
                            <option value="paperback">Paperback</option>
                            <option value="hardback">Hardback</option>
                            <option value="micro">Micro Hardback (4.25" × 6.87")</option>
                        </select>
                        <p class="hint">Hardback and micro hardback cost more. Micro uses a smaller fixed trim size.</p>
                    </div>
                    <div class="form-group">
                        <label>Font Size</label>
                        <select id="book-font-size">
                            <option value="9pt">9pt — compact</option>
                            <option value="10pt">10pt — small</option>
                            <option value="11pt">11pt — standard</option>
                            <option value="12pt">12pt — large</option>
                            <option value="13pt">13pt — extra large</option>
                            <option value="14pt">14pt — very large</option>
                        </select>
                        <p class="hint">Larger fonts are easier to read but increase page count and cost. Changing font size requires re-typesetting.</p>
                    </div>
                    <button class="btn btn-sm secondary" id="save-book-print-options">Save Options for This Book</button>
                    <p class="hint" style="margin-top:0.5rem;">These override your <a href="/settings">global defaults</a>. See <a href="https://www.lulu.com/sell/sell-on-your-site/print-api" target="_blank" rel="noopener">Lulu's print specs</a> for details.</p>
                </div>
            </details>
            <details id="change-trim-details" style="margin:1rem 0; border:1px solid #f9a825; border-radius:6px; padding:0.75rem;">
                <summary style="cursor:pointer; font-weight:600;">⚠️ Change Print Size <span class="hint" style="font-weight:normal;">(will regenerate interior PDF and cover)</span></summary>
                <div style="margin-top:0.75rem;">
                    <p style="color:#c0392b; font-size:0.9rem; margin-bottom:0.75rem;">Changing the trim size requires regenerating both the interior PDF and the cover PDF to match the new dimensions.</p>
                    <div class="form-group">
                        <label>New Trim Size</label>
                        <select id="new-trim-size">
                            <option value="5x8">5" × 8" (Small Digest)</option>
                            <option value="5.06x7.81">5.06" × 7.81" (BookVault B-format)</option>
                            <option value="5.25x8">5.25" × 8" (Large Digest)</option>
                            <option value="5.5x8.5">5.5" × 8.5" (Trade Paperback) — most common</option>
                            <option value="6x9">6" × 9" (Large Trade)</option>
                            <option value="8.5x11">8.5" × 11" (Letter)</option>
                        </select>
                    </div>
                    <button class="btn secondary" id="change-trim-size" style="margin-top:0.5rem;">Change Size & Regenerate</button>
                    <div id="change-trim-status"></div>
                </div>
            </details>
            <div id="shipping-fields">
                ${addressPickerHtml()}
                <button class="btn secondary" id="get-pricing">Get Price Estimate</button>
            </div>
            <div id="pricing-result"></div>
            <div id="order-confirmation" style="display:none;"></div>
            <button class="btn primary" id="submit-order" style="margin-top:1rem; display:none;">Submit Print Order</button>
            <div class="step-nav">
                <button class="btn secondary" id="back-to-cover">← Back to Cover</button>
            </div>
        `);

        // Initialize the shared address picker (fetches saved addresses, wires dropdown events)
        initAddressPicker($el);

        $el.find('#back-to-cover').on('click', () => { currentStep = 9; renderWizard(); });

        // Page count validation helper — checks against provider+binding limits
        async function checkPageCountLimits() {
            const $warning = $el.find('#page-count-warning');
            const provider = $el.find('#print-provider').val();
            const bindingType = project.binding_type || $el.find('#book-binding-type').val() || 'paperback';
            if (!project.page_count || provider === 'kdp') {
                $warning.empty().hide();
                return;
            }
            try {
                const validation = await api.post('/print/validate-page-count', {
                    project_id: projectId,
                    provider: provider,
                    binding_type: bindingType,
                });
                if (!validation.allowed) {
                    $warning.html(`
                        <div style="background:#ffebee; border:1px solid #c62828; border-radius:6px; padding:0.75rem; margin-bottom:1rem;">
                            <strong style="color:#c62828;">⛔ Cannot Print with Current Settings</strong>
                            <p style="margin:0.5rem 0 0; color:#b71c1c; font-size:0.9rem;">${escapeHtml(validation.message)}</p>
                        </div>
                    `).show();
                } else if (validation.warning) {
                    $warning.html(`
                        <div style="background:#fff8e1; border:1px solid #f9a825; border-radius:6px; padding:0.75rem; margin-bottom:1rem;">
                            <strong style="color:#e65100;">⚠️ Near Page Limit</strong>
                            <p style="margin:0.25rem 0 0; font-size:0.9rem;">${escapeHtml(validation.warning)}</p>
                        </div>
                    `).show();
                } else {
                    $warning.empty().hide();
                }
            } catch (err) {
                console.warn('[Project] Page count validation check failed:', err.message);
                $warning.empty().hide();
            }
        }

        // Run page count check on initial load
        checkPageCountLimits();

        $el.find('#print-provider').on('change', function () {
            const isKdp = $(this).val() === 'kdp';
            $el.find('#shipping-fields').toggle(!isKdp);
            $el.find('#pricing-result').empty();
            $el.find('#order-confirmation').empty().hide();
            $el.find('#submit-order').hide();
            if (isKdp) {
                // KDP doesn't need pricing or confirmation — just show the button directly
                $el.find('#submit-order').text('Prepare KDP Files').show();
            }
            // Re-check page count limits for new provider
            checkPageCountLimits();
        });

        $el.find('#save-book-print-options').on('click', async function () {
            const $btn = $(this);
            setLoading($btn, true, 'Saving...');
            clearMessages($el);
            try {
                const opts = {
                    paper_type: $el.find('#book-paper-type').val(),
                    color_interior: $el.find('#book-color-interior').val() === 'true',
                    cover_finish: $el.find('#book-cover-finish').val(),
                    binding_type: $el.find('#book-binding-type').val(),
                    font_size: $el.find('#book-font-size').val(),
                };
                await api.patch(`/projects/${projectId}/print-options`, opts);
                console.log('[Project] Print options saved:', opts);
                // Update local project state
                project.paper_type = opts.paper_type;
                project.color_interior = opts.color_interior;
                project.cover_finish = opts.cover_finish;
                project.binding_type = opts.binding_type;
                project.font_size = opts.font_size;
                showSuccess($el, 'Print options saved for this book.');
                setTimeout(() => clearMessages($el), 3000);
                // Re-check page count limits with new binding type
                checkPageCountLimits();
            } catch (err) {
                console.error('[Project] Save print options failed:', err.message);
                showError($el, err.message);
            } finally { setLoading($btn, false); }
        });

        $el.find('#change-trim-size').on('click', async function () {
            const $btn = $(this);
            const $status = $el.find('#change-trim-status');
            const newTrim = $el.find('#new-trim-size').val();
            const currentTrim = project.trim_size || '5.5x8.5';

            if (newTrim === currentTrim) {
                showError($status, 'That is already the current trim size.');
                return;
            }

            const confirmed = confirm(
                `Change trim size from ${currentTrim} to ${newTrim}?\n\n` +
                'This will:\n' +
                '• Regenerate the interior PDF\n' +
                '• Invalidate the current cover PDF (you\'ll need to reassemble it)\n\n' +
                'Your cover images and text settings will be preserved — only the PDF dimensions change.'
            );
            if (!confirmed) {
                console.log('[Project] Trim size change cancelled by user');
                return;
            }

            console.log('[Project] Changing trim size from', currentTrim, 'to', newTrim);
            setLoading($btn, true, 'Saving...');
            clearMessages($status);

            try {
                // 1. Save the new trim size
                await api.patch(`/projects/${projectId}/print-options`, { trim_size: newTrim });
                project.trim_size = newTrim;
                console.log('[Project] New trim size saved:', newTrim);

                // 2. Clear the cover PDF (it's now wrong dimensions)
                project.cover_pdf_path = null;

                // 3. Kick off re-typeset with the new size
                showSuccess($status, 'Trim size updated. Regenerating interior PDF...');

                // Navigate back to the typeset step which will trigger regeneration
                currentStep = 6;
                renderWizard();
            } catch (err) {
                console.error('[Project] Failed to change trim size:', err.message);
                showError($status, 'Failed: ' + err.message);
                setLoading($btn, false);
            }
        });

        $el.find('#get-pricing').on('click', async function () {
            const $btn = $(this);
            const $result = $el.find('#pricing-result');
            const $confirm = $el.find('#order-confirmation');
            const $submitBtn = $el.find('#submit-order');
            setLoading($btn, true, 'Getting price...');
            clearMessages($result);
            $confirm.empty().hide();
            $submitBtn.hide();
            try {
                const shippingAddr = getSelectedShippingAddress($el);
                console.log('[Project] Getting pricing with address:', shippingAddr);
                if (!shippingAddr.city) {
                    throw new Error('Please select or enter a shipping address with at least a city.');
                }
                const provider = $el.find('#print-provider').val();
                const bindingType = project.binding_type || 'paperback';

                // Validate page count against provider+binding limits before pricing
                if (project.page_count) {
                    console.log('[Project] Validating page count:', project.page_count, 'provider:', provider, 'binding:', bindingType);
                    const validation = await api.post('/print/validate-page-count', {
                        project_id: projectId,
                        provider: provider,
                        binding_type: bindingType,
                    });
                    if (!validation.allowed) {
                        console.warn('[Project] Page count validation BLOCKED:', validation.message);
                        $result.html(`
                            <div style="background:#ffebee; border:1px solid #c62828; border-radius:6px; padding:1rem; margin-top:0.75rem;">
                                <strong style="color:#c62828;">⛔ Cannot Print</strong>
                                <p style="margin:0.5rem 0; color:#b71c1c;">${escapeHtml(validation.message)}</p>
                                <p style="margin:0; font-size:0.85rem; color:#555;">This book has <strong>${validation.page_count}</strong> pages. ${escapeHtml(provider === 'lulu' ? 'Lulu' : provider === 'bookvault' ? 'BookVault' : 'KDP')} allows ${validation.min_pages}–${validation.max_pages} pages for ${escapeHtml(bindingType)} binding.</p>
                            </div>
                        `);
                        setLoading($btn, false);
                        return;
                    }
                    if (validation.warning) {
                        console.warn('[Project] Page count warning:', validation.warning);
                        $result.html(`
                            <div style="background:#fff8e1; border:1px solid #f9a825; border-radius:6px; padding:0.75rem; margin-bottom:0.75rem;">
                                <strong style="color:#e65100;">⚠️ Near Page Limit</strong>
                                <p style="margin:0.25rem 0 0; font-size:0.9rem;">${escapeHtml(validation.warning)}</p>
                            </div>
                        `);
                    }
                }

                const data = await api.post('/print/pricing', { project_id: projectId, provider: provider, shipping_address: shippingAddr });
                const unitCost = (data.unit_cost || 0).toFixed(2);
                const shipCost = (data.shipping_cost || 0).toFixed(2);
                const totalCost = (data.total_cost || 0).toFixed(2);
                const currency = data.currency || 'USD';
                $result.html(`<div class="pricing-box"><h4>Price Estimate</h4><div class="pricing-row"><span>Print cost:</span><span>${currency} ${unitCost}</span></div><div class="pricing-row"><span>Shipping:</span><span>${currency} ${shipCost}</span></div><div class="pricing-row total"><span>Total:</span><span>${currency} ${totalCost}</span></div></div>`);

                // Show confirmation panel
                const providerLabel = provider === 'lulu' ? 'Lulu' : provider === 'bookvault' ? 'BookVault' : provider;
                $confirm.html(`
                    <div style="background:#fff8e1; border:1px solid #f9a825; border-radius:6px; padding:0.75rem; margin-top:0.75rem;">
                        <strong>\u26a0\ufe0f Confirm Order</strong>
                        <p style="margin:0.5rem 0;">Clicking "Place Order" will submit a real print job to <strong>${escapeHtml(providerLabel)}</strong> and charge <strong>${currency} ${totalCost}</strong> to your ${escapeHtml(providerLabel)} account.</p>
                        <p style="margin:0; font-size:0.9em; color:#555;">Ship to: ${escapeHtml(shippingAddr.name)}, ${escapeHtml(shippingAddr.street1)}, ${escapeHtml(shippingAddr.city)} ${escapeHtml(shippingAddr.state || '')} ${escapeHtml(shippingAddr.postal_code)}</p>
                    </div>
                `).show();
                $submitBtn.text(`Place Order \u2014 ${currency} ${totalCost}`).show();
            } catch (err) {
                $result.empty();
                showError($result, err.message);
            }
            finally { setLoading($btn, false); }
        });

        $el.find('#submit-order').on('click', async function () {
            const $btn = $(this);
            const provider = $el.find('#print-provider').val();

            // For non-KDP providers, require pricing confirmation first
            if (provider !== 'kdp' && !$el.find('#order-confirmation').is(':visible')) {
                showError($el, 'Please get a price estimate first before placing an order.');
                return;
            }

            setLoading($btn, true, 'Submitting...');
            clearMessages($el);

            // If user chose "Other" and wants to save, save the address first
            await saveCustomAddressIfRequested($el);

            try {
                const shippingAddr = getSelectedShippingAddress($el);
                const shippingStr = `${shippingAddr.name}\n${shippingAddr.street1}${shippingAddr.street2 ? '\n' + shippingAddr.street2 : ''}\n${shippingAddr.city}${shippingAddr.state ? ', ' + shippingAddr.state : ''} ${shippingAddr.postal_code}\n${shippingAddr.country}`;
                console.log('[Project] Submitting order with address:', shippingStr);
                const result = await api.post('/print/orders', { project_ids: [projectId], provider: provider, shipping_address: shippingStr, quantity: 1 });
                console.log('[Project] Order submitted:', result);

                if (provider === 'kdp') {
                    // KDP: show clear download instructions
                    const successHtml = `
                        <div style="background:#e8f5e9; border:1px solid #4caf50; border-radius:6px; padding:1rem; margin-top:0.75rem;">
                            <strong>\u2705 KDP Files Ready</strong>
                            <p style="margin:0.5rem 0;">Your files are packaged for manual upload to Amazon KDP.</p>
                            <div style="margin-top:0.75rem;">
                                <a href="/api/projects/${projectId}/interior-pdf" download class="btn secondary" style="margin-right:0.5rem;">Download Interior PDF</a>
                                <a href="/api/projects/${projectId}/cover/pdf" download class="btn secondary">Download Cover PDF</a>
                            </div>
                            <p style="margin:0.75rem 0 0; font-size:0.9em; color:#555;">Upload these files at <a href="https://kdp.amazon.com" target="_blank" rel="noopener">kdp.amazon.com</a></p>
                        </div>
                    `;
                    $el.find('#order-confirmation').html(successHtml).show();
                } else {
                    showSuccess($el, result.message || `Order placed! Order ID: ${result.provider_order_id || result.id}`);
                }
                setLoading($btn, false);
                $btn.text(provider === 'kdp' ? 'Files Prepared' : 'Order Submitted').prop('disabled', true);
            } catch (err) {
                showError($el, err.message);
                setLoading($btn, false);
            }
        });
    }

}
