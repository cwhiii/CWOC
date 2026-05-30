/**
 * Cover Builder page — 3-step cover design studio.
 * Uses real backend polling for AI tasks. No fake progress bars.
 */

import { api } from '../api.js';
import { showError, showErrorWithAction, showSuccess, clearMessages, setLoading, escapeHtml } from '../dom.js';
import { navigate } from '../router.js';
import { isAdmin } from '../auth.js';
import { createProgressTracker, buildProgressHtml, updateProgressDisplay, showProgressError, getStageInfo, formatDuration, TASK_ESTIMATES } from '../progress.js';

const COVER_STEPS = [
    { id: 'prompts', label: 'Prompts', number: 6 },
    { id: 'images', label: 'Images', number: 7 },
    { id: 'builder', label: 'Builder', number: 8 },
];

// Default prefix prepopulated into the image prompt textarea.
// Users can edit or remove it — it's just a starting point.
const IMAGE_PROMPT_PREFIX = 'Book cover artwork, artistic, painterly, high-quality illustration. NO text, NO words, NO letters, NO numbers, NO watermarks. Pure visual art only. ';

// Full wizard steps matching project.js — cover page shows the same stepper
const ALL_STEPS = [
    { id: 'source', label: 'Source', number: 1 },
    { id: 'print_size', label: 'Print Size', number: 2 },
    { id: 'typos', label: 'Typo Check', number: 3, optional: true },
    { id: 'illustrations', label: 'Illustrations', number: 4, optional: true },
    { id: 'typeset', label: 'Typeset', number: 5 },
    { id: 'cover_prompts', label: 'Prompts', number: 6, group: 'Cover' },
    { id: 'cover_images', label: 'Images', number: 7, group: 'Cover' },
    { id: 'cover_builder', label: 'Builder', number: 8, group: 'Cover' },
    { id: 'print', label: 'Print', number: 9 },
];

export async function render($container, params) {
    const projectId = params.id;
    console.log('[Cover] Rendering cover builder, id:', projectId);

    let step = 'prompts'; // 'prompts' | 'images' | 'builder'
    let prompts = [];
    let images = {};
    let upscaledImages = {}; // Track which prompt IDs have been upscaled to print resolution
    let selectedImage = null;
    let templates = [];
    let selectedTemplate = 'classic';
    let titleText = '', authorText = '', blurb = null;
    let titleFontSize = 48, titleColor = '#FFFFFF', titleFontFamily = 'serif';
    let titleX = 0.5, titleY = 0.15, titleAnchor = 'center';
    let authorFontSize = 24, authorColor = '#FFFFFF', authorFontFamily = 'serif';
    let authorX = 0.5, authorY = 0.85, authorAnchor = 'center';
    let spineWidth = 20, pageCount = 200;

    // Staleness tracking: each step records the generation it was last completed at.
    // When an upstream step is redone, downstream steps become stale.
    // promptsGen increments when prompts are regenerated.
    // imagesGen increments when a new image is selected/generated.
    let promptsGen = 0;       // bumped when prompts are (re)generated
    let imagesGenAt = 0;      // the promptsGen value when images step was last acted on
    let builderGenAt = 0;     // the imagesGen snapshot when builder was last used
    let imagesGen = 0;        // bumped when image selection changes
    let promptGenerationInProgress = false; // true while a prompt generation task is running

    function isImagesStale() {
        // Images step is stale if prompts were regenerated after images were last touched
        return imagesGenAt > 0 && imagesGenAt < promptsGen;
    }
    function isBuilderStale() {
        // Builder is stale if either prompts or images changed since builder was last used
        return (builderGenAt > 0 && builderGenAt < imagesGen) || isImagesStale();
    }
    function isSelectedImageUpscaled() {
        // Check if the currently selected image has been upscaled
        if (!selectedImage) return false;
        const selectedBase = selectedImage.split('?')[0];
        // Find which prompt ID owns this image (compare base URLs without query params)
        for (const [id, url] of Object.entries(images)) {
            if (url.split('?')[0] === selectedBase && upscaledImages[id]) return true;
        }
        return false;
    }
    function staleWarningHtml(staleSteps) {
        if (staleSteps.length === 0) return '';
        const stepNames = staleSteps.join(', ');
        return `<div class="stale-warning" style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:0.75rem 1rem; margin-bottom:1rem; color:#856404;"><strong>⚠ Upstream changed:</strong> ${escapeHtml(stepNames)} ${staleSteps.length === 1 ? 'has' : 'have'} been redone since this step was last completed. Results here may be out of date — consider re-running this step.</div>`;
    }

    // Persist the selected image to the backend so it survives page navigation
    function persistSelection(imageUrl) {
        const baseUrl = imageUrl ? imageUrl.split('?')[0] : '';
        console.log('[Cover] Persisting image selection:', baseUrl || '(cleared)');
        api.post(`/projects/${projectId}/cover/select-image`, { image_url: baseUrl })
            .then(() => console.log('[Cover] Selection persisted'))
            .catch(err => console.warn('[Cover] Failed to persist selection:', err.message));
    }

    // Load initial data
    let resumedTaskId = null;
    try {
        const [tmplData, projData, savedPromptsData] = await Promise.all([
            api.get('/projects/cover-templates').catch(() => ({ templates: [] })),
            api.get(`/projects/${projectId}`),
            api.get(`/projects/${projectId}/cover/prompts`).catch(() => ({ prompts: [] }))
        ]);
        templates = tmplData.templates || [];
        if (projData.page_count) pageCount = projData.page_count;
        if (projData.title) titleText = projData.title;
        if (projData.author) authorText = projData.author;
        // Restore previously saved prompts
        if (savedPromptsData.prompts && savedPromptsData.prompts.length > 0) {
            prompts = savedPromptsData.prompts;
            promptsGen = 1; // Mark that prompts exist
            console.log('[Cover] Restored', prompts.length, 'saved prompts from database');
        }
        console.log('[Cover] Data loaded, templates:', templates.length);
        try {
            const sw = await api.get(`/projects/${projectId}/cover/spine-width?page_count=${pageCount}`);
            spineWidth = sw.spine_width_mm;
        } catch (e) { /* use default */ }

        // Restore previously generated/uploaded images from disk
        try {
            const savedImages = await api.get(`/projects/${projectId}/cover/images`);
            if (savedImages.images && savedImages.images.length > 0) {
                for (const img of savedImages.images) {
                    images[img.prompt_id] = img.image_url;
                    if (img.is_upscaled) {
                        upscaledImages[img.prompt_id] = true;
                    }
                }
                console.log('[Cover] Restored', savedImages.images.length, 'saved images from disk');
                // Restore selected image
                if (savedImages.selected_image_url) {
                    selectedImage = savedImages.selected_image_url;
                    imagesGen = 1;
                    imagesGenAt = promptsGen;
                    // Check if the selected image file still exists in the list
                    const selectedBase = selectedImage.split('?')[0];
                    const found = savedImages.images.some(img => img.image_url === selectedBase);
                    if (found) {
                        console.log('[Cover] Restored selected image:', selectedImage);
                        step = 'images'; // Jump to images step since we have a selection
                    } else {
                        console.warn('[Cover] Selected image not found on disk, clearing selection');
                        selectedImage = null;
                    }
                }
            }
        } catch (e) {
            console.warn('[Cover] Failed to restore saved images:', e.message);
        }

        // Pre-flight: check ComfyUI status and log diagnostics to console
        try {
            const comfyStatus = await api.get('/comfyui/status');
            if (comfyStatus.reachable) {
                console.log('[Cover] ComfyUI pre-flight: REACHABLE, checkpoints:', comfyStatus.checkpoints);
            } else {
                console.error('[Cover] ComfyUI pre-flight: NOT REACHABLE');
                console.error('[Cover] ComfyUI URL attempted:', comfyStatus.comfyui_url || 'unknown');
                console.error('[Cover] ComfyUI error:', comfyStatus.error);
                console.error('[Cover] Models on disk (shared volume):', comfyStatus.models_on_disk || []);
                console.error('[Cover] This means the ComfyUI Docker container is not running or not reachable from the backend.');
                console.error('[Cover] The model file being downloaded does NOT mean ComfyUI is running — it just means the file exists on the shared volume.');
                console.error('[Cover] Fix: SSH into server and run: docker compose ps comfyui && docker compose logs comfyui --tail 20');
            }
        } catch (e) {
            console.warn('[Cover] ComfyUI pre-flight check failed:', e.message);
        }

        // Check if there's an active image generation task (e.g. user refreshed mid-generation).
        // If so, jump to the images step and resume polling.
        try {
            const activeTask = await api.get(`/projects/${projectId}/cover/generate-image/active`);
            if (activeTask.active && activeTask.task_id) {
                console.log('[Cover] Found active generation task:', activeTask.task_id, 'state:', activeTask.state);
                resumedTaskId = activeTask.task_id;
                step = 'images';
            }
        } catch (e) {
            console.warn('[Cover] Active task check failed:', e.message);
        }
    } catch (err) {
        $container.html(`<div class="panel"><p class="error">Failed to load project: ${escapeHtml(err.message)}</p></div>`);
        return;
    }

    renderCurrentStep();

    // If we found an active task, resume polling it after the step has rendered
    if (resumedTaskId) {
        resumeActiveTask(resumedTaskId);
    }

    function renderStepperNav() {
        // Map internal cover step to the global step index
        const coverStepMap = { prompts: 5, images: 6, builder: 7 };
        const currentGlobal = coverStepMap[step] || 5;

        let html = '<nav class="steps">';
        let i = 0;
        while (i < ALL_STEPS.length) {
            const s = ALL_STEPS[i];
            if (s.group) {
                // Render grouped steps (Cover cluster)
                const groupName = s.group;
                const groupStart = i;
                const groupSteps = [];
                while (i < ALL_STEPS.length && ALL_STEPS[i].group === groupName) {
                    groupSteps.push({ step: ALL_STEPS[i], index: i });
                    i++;
                }
                // Connector before group
                if (groupStart > 0) {
                    html += `<div class="step-connector ${groupStart - 1 < currentGlobal ? 'done' : ''}"></div>`;
                }
                html += '<div class="step-group">';
                html += '<div class="step-group-items">';
                groupSteps.forEach((gs, gi) => {
                    const cls = gs.index === currentGlobal ? 'active' : (gs.index < currentGlobal ? 'done' : '');
                    html += `<button class="step ${cls}" data-global-step="${gs.index}"><span class="step-number">${gs.step.number}</span><span class="step-label">${gs.step.label}</span></button>`;
                    if (gi < groupSteps.length - 1) {
                        html += `<div class="step-connector ${gs.index < currentGlobal ? 'done' : ''}"></div>`;
                    }
                });
                html += '</div>';
                html += `<span class="step-group-label">${groupName}</span>`;
                html += '</div>';
            } else {
                // Connector before this step
                if (i > 0 && !ALL_STEPS[i - 1].group) {
                    html += `<div class="step-connector ${i - 1 < currentGlobal ? 'done' : ''}"></div>`;
                } else if (i > 0 && ALL_STEPS[i - 1].group) {
                    html += `<div class="step-connector ${i - 1 < currentGlobal ? 'done' : ''}"></div>`;
                }
                const cls = i === currentGlobal ? 'active' : (i < currentGlobal ? 'done' : '');
                html += `<button class="step ${cls}" data-global-step="${i}"><span class="step-number">${s.number}</span><span class="step-label">${s.label}</span>${s.optional ? '<span class="step-optional">optional</span>' : ''}</button>`;
                i++;
            }
        }
        html += '</nav>';
        return html;
    }

    function canReachGlobalStep(globalIdx) {
        // Cover sub-steps: can go forward within cover if data exists
        if (globalIdx === 6) return prompts.length > 0; // images needs prompts
        if (globalIdx === 7) return !!selectedImage;     // builder needs image
        return globalIdx <= 5; // can always go back to earlier steps
    }

    function bindStepperClicks() {
        $container.find('.steps .step').on('click', function () {
            const globalIdx = parseInt($(this).data('global-step'));

            // Steps 0-4 (Source, Print Size, Typos, Illustrations, Typeset) → navigate back to project page
            if (globalIdx < 5) {
                console.log('[Cover] Stepper clicked non-cover step:', globalIdx, '— navigating to project');
                navigate(`/projects/${projectId}`);
                return;
            }
            // Step 8 (Print) → navigate to project page at print step
            if (globalIdx === 8) {
                console.log('[Cover] Stepper clicked Print step — navigating to project');
                navigate(`/projects/${projectId}`);
                return;
            }
            // Steps 5-7 are cover sub-steps
            const coverMap = { 5: 'prompts', 6: 'images', 7: 'builder' };
            const targetStep = coverMap[globalIdx];
            if (targetStep) {
                console.log('[Cover] Stepper clicked, navigating to cover step:', targetStep);
                step = targetStep;
                renderCurrentStep();
            }
        });
    }

    function renderCurrentStep() {
        console.log('[Cover] Rendering step:', step);
        if (step === 'prompts') renderStep1();
        else if (step === 'images') renderStep2();
        else renderStep3();
    }

    function renderStep1() {
        console.log('[Cover] renderStep1 entry, prompts.length:', prompts.length);
        $container.html(`
            <h1>${escapeHtml(titleText)}</h1>
            ${authorText ? `<p style="color:#8b4513; font-style:italic; margin-bottom:1.5rem;">by ${escapeHtml(authorText)}</p>` : ''}
            ${renderStepperNav()}
            <div class="zone-container" style="margin-top:1rem;">
                <div class="zone-header"><h2>Cover Prompts</h2></div>
                <div class="zone-body">
                    <p>Choose how you'd like to create your cover art prompts:</p>
                    <div class="step4-options" style="display:flex; gap:0.75rem; margin:1rem 0;">
                        <button class="btn primary" id="opt-generate" style="flex:1; padding:0.75rem 1rem;">🤖 Generate from Text</button>
                        <button class="btn secondary" id="opt-enter-own" style="flex:1; padding:0.75rem 1rem;">✍️ Enter Your Own</button>
                        <button class="btn secondary" id="opt-upload" style="flex:1; padding:0.75rem 1rem;">📁 Upload Your Own</button>
                    </div>
                    <div id="step4-panel"></div>
                    ${prompts.length > 0 ? `
                        <div style="border-top:1px solid #e8e0d8; margin-top:1.5rem; padding-top:1rem;">
                        <p style="color:#008080; font-weight:600;">✓ ${prompts.length} prompts generated.</p>
                        <p style="font-size:0.85rem; color:#666; margin:0.25rem 0 0.5rem;">Select a prompt to use for image generation, or continue to see all options.</p>
                        <button class="btn secondary btn-sm" id="toggle-prompt-list" style="margin-bottom:0.5rem;">Show Prompts</button>
                        <button class="btn btn-sm btn-danger" id="delete-all-prompts" style="margin-bottom:0.5rem; margin-left:0.5rem; display:none;">Delete All Prompts</button>
                        <ul class="prompt-list" style="list-style:none; padding:0; margin:0.5rem 0; display:none;">
                            ${prompts.map(p => `<li style="display:flex; align-items:flex-start; gap:0.5rem; padding:0.5rem 0.25rem; border-bottom:1px solid #e8e0d8;">
                                <span style="font-size:0.8rem; color:#666; min-width:1.5rem; padding-top:2px;">#${p.index}</span>
                                <span style="font-size:0.85rem; flex:1; line-height:1.4;">${escapeHtml(p.prompt_text.substring(0, 150))}${p.prompt_text.length > 150 ? '...' : ''}</span>
                                <button class="btn btn-xs primary use-prompt-step1" data-id="${escapeHtml(p.id)}" data-prompt="${escapeHtml(p.prompt_text)}" title="Use this prompt for image generation">Use</button>
                                <button class="btn btn-xs btn-danger delete-prompt-step1" data-id="${escapeHtml(p.id)}" title="Delete this prompt">✕</button>
                            </li>`).join('')}
                        </ul>
                        <button class="btn primary" id="continue-step2" style="margin-top:0.5rem;">Continue to Cover Images →</button>
                        <button class="btn secondary" id="restart-step1" title="Regenerate prompts from scratch" style="margin-top:0.5rem; margin-left:0.5rem;">↺ Start Over</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `);

        // --- Option panel rendering ---
        function showGeneratePanel() {
            console.log('[Cover] Showing "Generate from Text" panel');
            $container.find('.step4-options .btn').removeClass('active');
            $container.find('#opt-generate').addClass('active');
            $container.find('#step4-panel').html(`
                <div style="background:#faf7f4; border:1px solid #e8e0d8; border-radius:6px; padding:1rem; margin-top:0.5rem;">
                    <p style="margin-bottom:0.75rem;">The AI will analyze your book and suggest cover art concepts.</p>
                    <div class="actions">
                        <select id="num-prompts" style="padding:0.4rem 0.6rem; border-radius:4px; border:1px solid #ccc; font-size:0.9rem;">
                            <option value="3">3 prompts</option>
                            <option value="5" selected>5 prompts</option>
                            <option value="7">7 prompts</option>
                            <option value="11">11 prompts</option>
                        </select>
                        <button class="btn primary" id="gen-prompts">Generate Cover Prompts</button>
                        <button class="btn secondary" id="gen-prompts-lucky" title="Analyze 1 random section — much faster!">🍀 I'm Feeling Lucky</button>
                    </div>
                    <div id="prompt-status"></div>
                </div>
            `);
            $container.find('#gen-prompts').on('click', function () {
                startPromptGeneration($(this), 'standard');
            });
            $container.find('#gen-prompts-lucky').on('click', function () {
                startPromptGeneration($(this), 'lucky');
            });
        }

        function showEnterOwnPanel() {
            console.log('[Cover] Showing "Enter Your Own" panel');
            $container.find('.step4-options .btn').removeClass('active');
            $container.find('#opt-enter-own').addClass('active');
            $container.find('#step4-panel').html(`
                <div style="background:#faf7f4; border:1px solid #e8e0d8; border-radius:6px; padding:1rem; margin-top:0.5rem;">
                    <p style="margin-bottom:0.75rem;">Write your own image generation prompt describing the cover art you want.</p>
                    <div class="form-group" style="margin-bottom:0.75rem;">
                        <textarea id="manual-prompt-input" rows="4" maxlength="1000" placeholder="e.g. A dark forest at twilight with a glowing lantern on a mossy path, oil painting style, moody atmosphere..." style="width:100%; resize:vertical; font-size:0.9rem;"></textarea>
                    </div>
                    <button class="btn primary" id="save-manual-prompt">Save Prompt</button>
                    <div id="manual-prompt-status" style="margin-top:0.5rem;"></div>
                </div>
            `);
            $container.find('#save-manual-prompt').on('click', async function () {
                const $btn = $(this);
                const $status = $container.find('#manual-prompt-status');
                const text = $container.find('#manual-prompt-input').val().trim();
                if (!text) {
                    showError($status, 'Please enter a prompt.');
                    return;
                }
                console.log('[Cover] Saving manual prompt, length:', text.length);
                setLoading($btn, true, 'Saving...');
                clearMessages($status);
                try {
                    const resp = await api.post(`/projects/${projectId}/cover/prompts`, { prompt_text: text });
                    console.log('[Cover] Manual prompt saved:', resp.id);
                    prompts.push({ id: resp.id, index: prompts.length + 1, prompt_text: text });
                    promptsGen++;
                    showSuccess($status, 'Prompt saved!');
                    setLoading($btn, false);
                    // Re-render to show updated prompt list
                    setTimeout(() => renderCurrentStep(), 600);
                } catch (err) {
                    console.error('[Cover] Failed to save manual prompt:', err.message);
                    showError($status, 'Failed to save prompt: ' + err.message);
                    setLoading($btn, false);
                }
            });
        }

        function showUploadPanel() {
            console.log('[Cover] Showing "Upload Your Own" panel');
            $container.find('.step4-options .btn').removeClass('active');
            $container.find('#opt-upload').addClass('active');
            $container.find('#step4-panel').html(`
                <div style="background:#faf7f4; border:1px solid #e8e0d8; border-radius:6px; padding:1rem; margin-top:0.5rem;">
                    <h3 style="margin-top:0;">Upload Your Own Image</h3>
                    <p class="hint">PNG or JPEG, max 25 MB. This will be used directly as your cover art.</p>
                    <input type="file" id="cover-upload" accept=".png,.jpg,.jpeg">
                </div>
            `);
            $container.find('#cover-upload').on('change', handleUpload);
        }

        // Option button click handlers
        $container.find('#opt-generate').on('click', showGeneratePanel);
        $container.find('#opt-enter-own').on('click', showEnterOwnPanel);
        $container.find('#opt-upload').on('click', showUploadPanel);

        bindStepperClicks();

        // Shared handler for both "Generate" and "Lucky" buttons
        async function startPromptGeneration($btn, mode) {
            const $status = $container.find('#prompt-status');
            setLoading($btn, true, 'Starting...');
            clearMessages($status);
            promptGenerationInProgress = true;

            try {
                const numPrompts = mode === 'lucky' ? 3 : parseInt($container.find('#num-prompts').val()) || 5;
                console.log('[Cover] Starting prompt generation, mode:', mode, 'num_prompts:', numPrompts);
                const resp = await api.post(`/projects/${projectId}/cover/generate-prompts`, { mode, num_prompts: numPrompts });
                const taskId = resp.task_id;
                console.log('[Cover] Prompt generation task started, task_id:', taskId, 'mode:', mode);
                $status.html(buildProgressHtml({ color: '#8b4513', colorEnd: '#d2691e', showChapterFeed: true, feedLabel: 'Visual themes discovered:' }));
                _killAborted = false;
                bindForceKill($status, taskId, () => {
                    promptGenerationInProgress = false;
                    showProgressError($status.find('.task-progress'), 'Task killed by user.');
                    setLoading($container.find('#gen-prompts'), false);
                });
                const estimatedSeconds = mode === 'lucky' ? 90 : TASK_ESTIMATES.cover_prompts;
                const tracker = createProgressTracker({ estimatedTotalSeconds: estimatedSeconds });
                // Chapter timing: track when each chapter starts to compute real per-chapter ETA
                const chapterTiming = {
                    lastChapter: 0,           // last observed current_chapter value
                    chapterStartTime: null,    // when the current chapter started
                    firstChapterDuration: null, // ms it took to complete the first chapter
                    totalChapters: null        // total chapters (set on first poll with data)
                };
                pollPromptTask($status, taskId, 0, null, 0, tracker, chapterTiming);
            } catch (err) {
                console.error('[Cover] Failed to start prompt generation:', err);
                if (err.message && (err.message.includes('not available') || err.message.includes('not reachable') || err.message.includes('Ensure the service'))) {
                    const adminNote = isAdmin() ? '' : ' Only an admin can configure AI models.';
                    showErrorWithAction(
                        $status,
                        err.message + adminNote,
                        { text: 'Go to Settings →', href: '/settings' }
                    );
                } else {
                    showError($status, err.message);
                }
                setLoading($btn, false);
                promptGenerationInProgress = false;
            }
        }

        $container.find('#restart-step1').on('click', () => {
            console.log('[Cover] Restarting step 1: regenerating prompts (downstream steps marked stale)');
            prompts = [];
            promptsGen++;
            console.log('[Cover] promptsGen bumped to:', promptsGen);
            renderCurrentStep();
        });
        $container.find('#continue-step2').on('click', () => { step = 'images'; renderCurrentStep(); });

        // Toggle prompt list visibility
        $container.find('#toggle-prompt-list').on('click', function () {
            const $list = $container.find('.prompt-list');
            const $deleteAll = $container.find('#delete-all-prompts');
            const isVisible = $list.is(':visible');
            if (isVisible) {
                $list.slideUp(200);
                $deleteAll.hide();
                $(this).text('Show Prompts');
                console.log('[Cover] Prompt list collapsed');
            } else {
                $list.slideDown(200);
                $deleteAll.show();
                $(this).text('Hide Prompts');
                console.log('[Cover] Prompt list expanded');
            }
        });

        // Delete all prompts
        $container.find('#delete-all-prompts').on('click', async function () {
            if (!confirm(`Delete all ${prompts.length} prompts? This cannot be undone.`)) return;
            const $btn = $(this);
            $btn.prop('disabled', true).text('Deleting...');
            console.log('[Cover] Deleting all prompts for project:', projectId);
            try {
                await api.delete(`/projects/${projectId}/cover/prompts`);
                console.log('[Cover] All prompts deleted');
                prompts = [];
                promptsGen++;
                renderCurrentStep();
            } catch (err) {
                console.error('[Cover] Failed to delete all prompts:', err.message);
                showError($container.find('.zone-body'), 'Failed to delete prompts: ' + err.message);
                $btn.prop('disabled', false).text('Delete All Prompts');
            }
        });

        // "Use" button: select a prompt, hide the rest, and jump to Images step
        $container.find('.use-prompt-step1').on('click', function () {
            const promptText = $(this).data('prompt');
            const promptId = $(this).data('id');
            console.log('[Cover] Use prompt from step 1:', promptId, promptText.substring(0, 60));

            // Hide all other prompts, show only the selected one
            const $list = $container.find('.prompt-list');
            $list.find('li').each(function () {
                const $li = $(this);
                const $useBtn = $li.find('.use-prompt-step1');
                if ($useBtn.data('id') !== promptId) {
                    $li.slideUp(200);
                }
            });
            // Hide toggle and delete-all buttons since we're about to navigate
            $container.find('#toggle-prompt-list, #delete-all-prompts').hide();

            // Brief delay so the user sees the selection, then navigate
            setTimeout(() => {
                step = 'images';
                renderCurrentStep();
                // After rendering step 2, populate the custom prompt textarea with the prefix + selected prompt
                $container.find('#custom-prompt-input').val(IMAGE_PROMPT_PREFIX + promptText);
            }, 400);
        });

        // Delete individual prompt from step 1 list
        $container.find('.delete-prompt-step1').on('click', async function () {
            const $btn = $(this);
            const promptId = $btn.data('id');
            if (!confirm('Delete this prompt?')) return;
            console.log('[Cover] Deleting prompt from step 1:', promptId);
            $btn.prop('disabled', true);
            try {
                await api.delete(`/projects/${projectId}/cover/prompts/${promptId}`);
                console.log('[Cover] Prompt deleted:', promptId);
                prompts = prompts.filter(p => p.id !== promptId);
                // Re-index remaining prompts
                prompts.forEach((p, i) => { p.index = i + 1; });
                delete images[promptId];
                renderCurrentStep();
            } catch (err) {
                console.error('[Cover] Failed to delete prompt:', err.message);
                showError($container.find('.zone-body'), 'Failed to delete prompt: ' + err.message);
                $btn.prop('disabled', false);
            }
        });
    }

    // --- Force Kill helper ---
    // Binds the "Force Kill" button inside a progress area to cancel a Celery task.
    // The task keeps running on the server until we explicitly revoke it.
    let _killAborted = false; // flag to stop polling after kill

    function bindForceKill($progressArea, taskId, onKilled) {
        $progressArea.find('.force-kill-task').off('click').on('click', async function () {
            const confirmed = confirm(
                'Are you sure you want to force kill this generation?\n\n' +
                'This will terminate the task on the server. You cannot undo this.'
            );
            if (!confirmed) {
                console.log('[Cover] Force kill cancelled by user');
                return;
            }
            console.log('[Cover] Force killing task:', taskId);
            const $btn = $(this);
            $btn.prop('disabled', true).text('Killing...');
            try {
                // Try the image-specific cancel endpoint first (clears active_task_id)
                const resp = await api.post(`/projects/${projectId}/cover/generate-image/cancel`).catch(() => null);
                if (!resp || !resp.cancelled) {
                    // Fall back to generic cancel
                    await api.post(`/projects/${projectId}/cancel-task`, { task_id: taskId });
                }
                console.log('[Cover] Task killed successfully');
                _killAborted = true;
                if (onKilled) onKilled();
            } catch (err) {
                console.error('[Cover] Force kill failed:', err.message);
                alert('Failed to kill task: ' + err.message);
                $btn.prop('disabled', false).text('⛔ Force Kill');
            }
        });
    }

    function pollPromptTask($status, taskId, attempts, lastStage, staleCount, tracker, chapterTiming) {
        // No stale timeout — as long as the backend says the task is running, we keep polling.
        // CPU inference can take many minutes per chapter with no visible progress changes.
        const MAX_NETWORK_ERRORS = 60; // 2 minutes of consecutive network failures before giving up
        staleCount = staleCount || 0;
        lastStage = lastStage || '';

        setTimeout(async () => {
            if (_killAborted) { console.log('[Cover] Prompt poll aborted (task killed)'); return; }
            try {
                const data = await api.get(`/projects/${projectId}/cover/generate-prompts/status/${taskId}`);
                const pct = data.percent != null ? data.percent : 0;
                const tokens = data.tokens_generated || 0;
                console.log('[Cover] Prompt poll attempt', attempts + 1, ':', data.status, data.stage, pct + '%', 'tokens:', tokens);

                // Include tokens in stale detection — if tokens are increasing, it's not stuck
                const currentStage = data.stage + ':' + pct + ':' + (data.current_chapter || 0) + ':' + tokens;
                let newStaleCount = (currentStage === lastStage) ? staleCount + 1 : 0;

                // Update tracker with real percent
                tracker.update(pct);

                // --- Chapter timing: track per-chapter duration for real ETA ---
                const currentChapter = data.current_chapter || 0;
                const totalChapters = data.total_chapters || 0;
                if (totalChapters > 0 && !chapterTiming.totalChapters) {
                    chapterTiming.totalChapters = totalChapters;
                    console.log('[Cover] Chapter timing: total chapters =', totalChapters);
                }
                if (currentChapter > 0 && chapterTiming.chapterStartTime === null) {
                    // First time we see a chapter being processed — mark start
                    chapterTiming.chapterStartTime = Date.now();
                    chapterTiming.lastChapter = currentChapter;
                    console.log('[Cover] Chapter timing: first chapter started, chapter =', currentChapter);
                }
                if (currentChapter > chapterTiming.lastChapter && chapterTiming.chapterStartTime !== null) {
                    // Chapter advanced — record how long the previous one took
                    const chapterDuration = Date.now() - chapterTiming.chapterStartTime;
                    if (!chapterTiming.firstChapterDuration) {
                        chapterTiming.firstChapterDuration = chapterDuration;
                        console.log('[Cover] Chapter timing: first chapter completed in', Math.round(chapterDuration / 1000), 's');
                    }
                    // Reset start time for the new chapter
                    chapterTiming.chapterStartTime = Date.now();
                    chapterTiming.lastChapter = currentChapter;
                }

                // Determine stage info for detailed indicator
                const isModelLoading = data.model_loading || data.stage === 'waiting_for_ai';
                const stageInfo = getStageInfo(data.stage || 'unknown', {
                    current: data.current_chapter,
                    total: data.total_chapters
                });

                // Build enriched stage text with token count
                let stageText = stageInfo.text;
                if (tokens > 0 && data.stage === 'analyzing_chapters') {
                    stageText += ` (${tokens} tokens generated)`;
                }

                // --- Compute ETA: use chapter timing when available ---
                let etaText;
                if (isModelLoading && chapterTiming.firstChapterDuration && totalChapters > 0) {
                    // We know how long a chapter takes — extrapolate remaining time
                    const remainingChapters = totalChapters - currentChapter;
                    // Add time already spent on current chapter's model load
                    const currentChapterElapsed = Date.now() - chapterTiming.chapterStartTime;
                    const remainingMs = (remainingChapters * chapterTiming.firstChapterDuration)
                        + Math.max(0, chapterTiming.firstChapterDuration - currentChapterElapsed);
                    etaText = '~' + formatDuration(remainingMs) + ' remaining';
                } else if (isModelLoading) {
                    // First chapter still loading — no timing data yet
                    etaText = 'Model loading — estimating...';
                } else if (chapterTiming.firstChapterDuration && totalChapters > 0) {
                    // Not model loading, but we have chapter timing — use it for ETA
                    const remainingChapters = totalChapters - currentChapter;
                    const currentChapterElapsed = Date.now() - (chapterTiming.chapterStartTime || Date.now());
                    const remainingMs = (remainingChapters * chapterTiming.firstChapterDuration)
                        + Math.max(0, chapterTiming.firstChapterDuration - currentChapterElapsed);
                    etaText = '~' + formatDuration(remainingMs) + ' remaining';
                } else {
                    etaText = tracker.getETA(pct);
                }

                // Update the progress display
                updateProgressDisplay($status.find('.task-progress'), {
                    percent: pct,
                    label: data.label,
                    stageText: stageText,
                    stageIcon: stageInfo.icon,
                    elapsed: tracker.getElapsed(),
                    eta: etaText,
                    shimmer: isModelLoading,
                    color: '#8b4513',
                    colorEnd: '#d2691e'
                });

                // Render chapter visual notes as they come in
                if (data.chapter_notes && data.chapter_notes.length > 0) {
                    const $feed = $status.find('.chapter-notes-feed');
                    let feedHtml = '<p style="margin:0 0 0.5rem; font-weight:600; color:#8b4513; font-size:0.8rem;">Visual themes discovered:</p>';
                    for (const entry of data.chapter_notes) {
                        feedHtml += `<div style="margin-bottom:0.6rem; padding-bottom:0.5rem; border-bottom:1px solid #e8e0d8;">`;
                        feedHtml += `<strong style="font-size:0.8rem; color:#5a3e1b;">${escapeHtml(entry.chapter)}</strong>`;
                        feedHtml += `<ul style="margin:0.25rem 0 0 1rem; padding:0; list-style:disc;">`;
                        for (const note of entry.notes) {
                            feedHtml += `<li style="margin:2px 0; color:#4a4a4a; line-height:1.3;">${escapeHtml(note)}</li>`;
                        }
                        feedHtml += `</ul></div>`;
                    }
                    $feed.html(feedHtml);
                    // Auto-scroll to bottom to show latest
                    if ($feed[0]) $feed[0].scrollTop = $feed[0].scrollHeight;
                }

                if (data.status === 'complete') {
                    console.log('[Cover] Prompts generated:', data.result?.count);
                    promptGenerationInProgress = false;
                    prompts = data.result?.prompts || [];
                    promptsGen++;
                    console.log('[Cover] promptsGen bumped to:', promptsGen);
                    step = 'images';
                    renderCurrentStep();
                } else if (data.status === 'failed') {
                    console.error('[Cover] Prompt generation failed:', data.label);
                    promptGenerationInProgress = false;
                    if (data.label && (data.label.includes('not available') || data.label.includes('not reachable'))) {
                        const adminNote = isAdmin() ? '' : ' Only an admin can configure AI models.';
                        $status.find('.task-progress').html(`<p class="error">Error: ${escapeHtml(data.label)} — Download the required model from <a href="/settings" class="error-action-link">Settings →</a>${escapeHtml(adminNote)}</p>`);
                    } else {
                        showProgressError($status.find('.task-progress'), 'Error: ' + data.label);
                    }
                    setLoading($container.find('#gen-prompts'), false);
                } else if (newStaleCount >= 60 && newStaleCount % 60 === 0) {
                    console.log('[Cover] Prompt generation still working, no state change for', newStaleCount, 'polls — continuing to wait');
                    pollPromptTask($status, taskId, attempts + 1, currentStage, newStaleCount, tracker, chapterTiming);
                } else {
                    pollPromptTask($status, taskId, attempts + 1, currentStage, newStaleCount, tracker, chapterTiming);
                }
            } catch (err) {
                console.warn('[Cover] Prompt poll error (attempt', attempts + 1, '):', err.message);
                const newNetworkErrors = (staleCount || 0) + 1;
                if (newNetworkErrors >= MAX_NETWORK_ERRORS) {
                    promptGenerationInProgress = false;
                    showProgressError($status.find('.task-progress'), 'Lost connection to server after 60 retries. Please check your connection and refresh.');
                } else {
                    pollPromptTask($status, taskId, attempts + 1, lastStage, newNetworkErrors, tracker, chapterTiming);
                }
            }
        }, 2000);
    }

    function renderStep2() {
        // Check staleness
        const stale = isImagesStale();
        const staleSteps = stale ? ['Prompts'] : [];

        // --- Selected image status section ---
        const selectedImageHtml = selectedImage ? `
            <div class="cover-selection-status" style="text-align:center; padding:1.25rem; margin-bottom:1.5rem; background:#f0faf0; border:1px solid #c8e6c9; border-radius:8px;">
                <p style="color:#008080; font-weight:600; margin-bottom:0.75rem; font-size:1rem;">✓ Cover image selected</p>
                <img src="${escapeHtml(selectedImage)}" style="max-width:280px; max-height:380px; border-radius:6px; border:2px solid #e0d5c8; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div id="auto-upscale-status" style="margin-top:0.5rem;"></div>
                ${!isSelectedImageUpscaled() ? `
                    <p style="font-size:0.8rem; color:#b71c1c; margin:0.75rem 0 0.5rem; padding:0.5rem; background:#fff3e0; border-radius:4px; border-left:3px solid #e65100;">⚠ <strong>Selected image is 512×768.</strong> This will appear fuzzy when printed at cover size. Upscale to 1600×2400 for print-quality resolution.</p>
                    <button class="btn secondary btn-sm" id="upscale-selected">⬆ Upscale to Print Resolution</button>
                ` : `
                    <p style="font-size:0.8rem; color:#2e7d32; margin:0.75rem 0 0; padding:0.5rem; background:#e8f5e9; border-radius:4px; border-left:3px solid #2e7d32;">✓ Print-ready at 1600×2400</p>
                `}
            </div>
        ` : '';

        let html = `
            <h1>${escapeHtml(titleText)}</h1>
            ${authorText ? `<p style="color:#8b4513; font-style:italic; margin-bottom:1.5rem;">by ${escapeHtml(authorText)}</p>` : ''}
            ${renderStepperNav()}
            <div class="zone-container" style="margin-top:1rem;">
                <div class="zone-header"><h2>Cover Images</h2></div>
                <div class="zone-body">
                    ${staleWarningHtml(staleSteps)}

                    <!-- Current selection (shown at top when an image is chosen) -->
                    ${selectedImageHtml}

                    <!-- Progress area (hidden until generation starts) -->
                    <div id="img-gen-progress" style="display:none; margin:0 0 1.5rem; padding:1rem; background:#faf7f4; border:2px solid #8b4513; border-radius:8px;"></div>

                    <!-- Option A: Generate from a prompt -->
                    <div class="cover-option-section" style="padding:1rem; background:#faf7f4; border:1px solid #e8e0d8; border-radius:8px; margin-bottom:1rem;">
                        <h3 style="margin-top:0;">🤖 Generate from a Prompt</h3>
                        <p class="hint" style="margin-bottom:0.75rem;">Describe the cover image you want. Be specific about style, mood, and subject.</p>
                        <textarea id="custom-prompt-input" rows="4" maxlength="1000" placeholder="e.g. A dark forest at twilight with a glowing lantern on a mossy path, oil painting style, moody atmosphere..." style="width:100%; resize:vertical; font-size:0.9rem; border:1px solid #ccc; border-radius:4px; padding:0.5rem;"></textarea>
                        <button class="btn primary" id="gen-custom-img" style="margin-top:0.75rem;">Generate Image</button>
                    </div>

                    <!-- Option B: Upload your own -->
                    <div class="cover-option-section" style="padding:1rem; background:#faf7f4; border:1px solid #e8e0d8; border-radius:8px; margin-bottom:1.5rem;">
                        <h3 style="margin-top:0;">📁 Upload Your Own Image</h3>
                        <p class="hint" style="margin-bottom:0.75rem;">Use an image you already have. PNG or JPEG, ideally 1600×2400 or larger.</p>
                        <input type="file" id="cover-upload" accept=".png,.jpg,.jpeg">
                    </div>

                    <!-- Navigation -->
                    <div class="actions" style="border-top:1px solid #8b5a2b; padding-top:1rem;">
                        <button class="btn secondary" id="back-step1">← Back to Prompts</button>
                        <button class="btn secondary" id="restart-step2" title="Clear everything and start over from prompts">↺ Start Over</button>
                        <button class="btn primary" id="to-builder" ${!selectedImage ? 'disabled' : ''}>Continue to Cover Builder →</button>
                    </div>
                </div>
            </div>`;
        $container.html(html);

        // Prepopulate the prompt textarea with art direction prefix
        $container.find('#custom-prompt-input').val(IMAGE_PROMPT_PREFIX);

        bindStepperClicks();



        $container.find('#cover-upload').on('change', handleUpload);

        // Custom prompt image generation
        $container.find('#gen-custom-img').on('click', async function () {
            const $btn = $(this);
            const promptText = $container.find('#custom-prompt-input').val().trim();
            if (!promptText) {
                showError($container.find('.zone-body'), 'Enter a prompt describing the cover image you want.');
                return;
            }
            console.log('[Cover] Generating image from custom prompt:', promptText.substring(0, 80));

            // Check if there's an active generation task — ask user before cancelling
            try {
                const activeCheck = await api.get(`/projects/${projectId}/cover/generate-image/active`);
                if (activeCheck.active && activeCheck.task_id) {
                    console.log('[Cover] Active task detected:', activeCheck.task_id, '— asking user to confirm cancellation');
                    const confirmed = confirm(
                        'An image is currently being generated. Cancel it and start a new one with this prompt?'
                    );
                    if (!confirmed) {
                        console.log('[Cover] User chose not to cancel active generation');
                        return;
                    }
                    // Cancel the active task
                    console.log('[Cover] User confirmed — cancelling active task:', activeCheck.task_id);
                    const cancelResp = await api.post(`/projects/${projectId}/cover/generate-image/cancel`);
                    console.log('[Cover] Cancel response:', cancelResp);
                }
            } catch (e) {
                console.warn('[Cover] Active task check/cancel failed:', e.message, '— proceeding with generation');
            }

            // Disable all gen buttons during generation
            $container.find('.gen-img, #gen-custom-img').prop('disabled', true);
            setLoading($btn, true, 'Generating...');
            clearMessages($container.find('.zone-body'));

            const customId = 'custom_' + Date.now();

            // Show progress area with preview image placeholder
            const $progressArea = $container.find('#img-gen-progress');
            $progressArea.html(buildProgressHtml({ color: '#8b4513', colorEnd: '#d2691e' }) +
                '<div class="img-gen-preview" style="margin-top:1rem; text-align:center; display:none;">' +
                '<p style="font-size:0.82rem; color:#5a3e1b; margin-bottom:0.5rem;">Live preview (updates each step):</p>' +
                '<img class="preview-img" style="max-width:300px; max-height:400px; border-radius:6px; border:2px solid #e0d5c8; box-shadow:0 2px 8px rgba(0,0,0,0.1);" />' +
                '</div>');
            $progressArea.show();
            const tracker = createProgressTracker({ estimatedTotalSeconds: TASK_ESTIMATES.cover_image });

            // Show initial state
            updateProgressDisplay($progressArea.find('.task-progress'), {
                percent: 0,
                label: 'Generating cover image...',
                stageText: 'Sending prompt to image provider...',
                stageIcon: '📤',
                elapsed: tracker.getElapsed(),
                eta: '',
                shimmer: true,
                color: '#8b4513',
                colorEnd: '#d2691e'
            });

            // Update elapsed time every second
            const elapsedTimer = setInterval(() => {
                $progressArea.find('.progress-elapsed').text('Elapsed: ' + tracker.getElapsed());
            }, 1000);

            try {
                const resp = await api.post(`/projects/${projectId}/cover/generate-image`, { prompt_id: customId, prompt_text: promptText });
                const taskId = resp.task_id;
                console.log('[Cover] Custom image generation task started, task_id:', taskId);
                _killAborted = false;
                bindForceKill($progressArea, taskId, () => {
                    clearInterval(elapsedTimer);
                    $progressArea.hide();
                    $container.find('.gen-img, #gen-custom-img').prop('disabled', false);
                    showError($container.find('.zone-body'), 'Image generation killed by user.');
                });
                pollImageTask($progressArea, taskId, customId, tracker, elapsedTimer, true);
            } catch (err) {
                clearInterval(elapsedTimer);
                $progressArea.hide();
                $container.find('.gen-img, #gen-custom-img').prop('disabled', false);
                if (err.status === 429) {
                    showError($container.find('.zone-body'), 'Maximum regeneration limit reached. Please use an existing image or upload your own.');
                } else if (err.message && (err.message.includes('not available') || err.message.includes('not reachable') || err.message.includes('Ensure the service'))) {
                    const adminNote = isAdmin() ? '' : ' Only an admin can configure AI models.';
                    showErrorWithAction(
                        $container.find('.zone-body'),
                        err.message + adminNote,
                        { text: 'Go to Settings →', href: '/settings' }
                    );
                } else {
                    showError($container.find('.zone-body'), err.message);
                }
                setLoading($btn, false);
            }
        });

        $container.find('#back-step1').on('click', () => { step = 'prompts'; renderCurrentStep(); });
        $container.find('#restart-step2').on('click', () => {
            console.log('[Cover] Restarting step 2: full page reset — clearing all state and returning to prompts');
            images = {};
            upscaledImages = {};
            selectedImage = null;
            persistSelection(''); // Clear persisted selection
            prompts = [];
            promptsGen = 0;
            imagesGen = 0;
            imagesGenAt = 0;
            builderGenAt = 0;
            blurb = null;
            selectedTemplate = 'classic';
            titleFontSize = 48; titleColor = '#FFFFFF'; titleFontFamily = 'serif';
            authorFontSize = 24; authorColor = '#FFFFFF'; authorFontFamily = 'serif';
            step = 'prompts';
            renderCurrentStep();
        });
        $container.find('#to-builder').on('click', () => { builderGenAt = imagesGen; step = 'builder'; renderCurrentStep(); });

        // Upscale the currently selected image (for custom images or when card button isn't visible)
        $container.find('#upscale-selected').on('click', async function () {
            const $btn = $(this);
            if (!selectedImage) return;
            console.log('[Cover] Upscaling selected image:', selectedImage);
            $btn.prop('disabled', true).text('Upscaling...');

            // Find the prompt ID for the selected image (compare base URLs without query params)
            const selectedBase = selectedImage.split('?')[0];
            let selectedPromptId = null;
            for (const [id, url] of Object.entries(images)) {
                if (url.split('?')[0] === selectedBase) { selectedPromptId = id; break; }
            }
            if (!selectedPromptId) {
                showError($container.find('.zone-body'), 'Could not identify selected image for upscaling.');
                $btn.prop('disabled', false).text('⬆ Upscale to Print Resolution');
                return;
            }

            try {
                const resp = await api.post(`/projects/${projectId}/cover/upscale-image`, { image_url: selectedImage });
                const taskId = resp.task_id;
                console.log('[Cover] Upscale task started for selected image, task_id:', taskId);
                pollUpscaleTask($btn, taskId, selectedPromptId);
            } catch (err) {
                console.error('[Cover] Failed to start upscale:', err.message);
                showError($container.find('.zone-body'), 'Upscale failed: ' + err.message);
                $btn.prop('disabled', false).text('⬆ Upscale to Print Resolution');
            }
        });
    }

    /**
     * Resume polling an active task that was in progress before a page refresh.
     * Shows the progress UI and starts polling the existing task.
     */
    function resumeActiveTask(taskId) {
        console.log('[Cover] Resuming active task:', taskId);

        // Disable generate buttons while we're polling
        $container.find('.gen-img, #gen-custom-img').prop('disabled', true);

        // Show progress area
        const $progressArea = $container.find('#img-gen-progress');
        $progressArea.html(buildProgressHtml({ color: '#8b4513', colorEnd: '#d2691e' }) +
            '<div class="img-gen-preview" style="margin-top:1rem; text-align:center; display:none;">' +
            '<p style="font-size:0.82rem; color:#5a3e1b; margin-bottom:0.5rem;">Live preview (updates each step):</p>' +
            '<img class="preview-img" style="max-width:300px; max-height:400px; border-radius:6px; border:2px solid #e0d5c8; box-shadow:0 2px 8px rgba(0,0,0,0.1);" />' +
            '</div>');
        $progressArea.show();

        const tracker = createProgressTracker({ estimatedTotalSeconds: TASK_ESTIMATES.cover_image });

        updateProgressDisplay($progressArea.find('.task-progress'), {
            percent: 0,
            label: 'Image generation still running — picking up where you left off...',
            stageText: 'Reconnecting to in-progress task...',
            stageIcon: '🔄',
            elapsed: tracker.getElapsed(),
            eta: '',
            shimmer: true,
            color: '#8b4513',
            colorEnd: '#d2691e'
        });

        const elapsedTimer = setInterval(() => {
            $progressArea.find('.progress-elapsed').text('Elapsed: ' + tracker.getElapsed());
        }, 1000);

        // Bind force kill button for resumed task
        _killAborted = false;
        bindForceKill($progressArea, taskId, () => {
            clearInterval(elapsedTimer);
            $progressArea.hide();
            $container.find('.gen-img, #gen-custom-img').prop('disabled', false);
            showError($container.find('.zone-body'), 'Image generation killed by user.');
        });

        // Use 'resumed' as the promptId since we don't know the original
        pollImageTask($progressArea, taskId, 'resumed_' + Date.now(), tracker, elapsedTimer, true);
    }

    /**
     * Poll image generation task for real progress, preview images, and completion.
     * Shows step-by-step progress (step X/30) and live preview images as they emerge.
     */
    function pollImageTask($progressArea, taskId, promptId, tracker, elapsedTimer, isCustom) {
        const POLL_INTERVAL = 1000; // 1 second
        // No stale timeout — as long as the backend says the task is running, we keep polling.
        // Image generation (especially on CPU) can take a very long time with no visible progress changes.
        let lastState = '';
        let staleCount = 0;
        let networkErrors = 0;
        let lastPreviewUrl = null;
        let previewVersion = 0; // cache-bust for preview image updates

        function doPoll() {
            setTimeout(async () => {
                if (_killAborted) { console.log('[Cover] Image poll aborted (task killed)'); return; }
                try {
                    networkErrors = 0; // reset on successful poll
                    const data = await api.get(`/projects/${projectId}/cover/generate-image/status/${taskId}`);
                    console.log('[Cover] Image poll:', data.status, data.stage, data.percent + '%',
                        'step:', data.current_step + '/' + data.total_steps,
                        'preview:', data.preview_url ? 'yes' : 'no');

                    // Track state changes for logging (no timeout — we never kill a running task)
                    const currentState = `${data.status}:${data.stage}:${data.percent}:${data.current_step}`;
                    if (currentState === lastState) {
                        staleCount++;
                        if (staleCount % 60 === 0) {
                            console.log('[Cover] Image generation still working, no state change for', staleCount, 'polls — continuing to wait');
                        }
                    } else {
                        staleCount = 0;
                        lastState = currentState;
                    }

                    // Update progress display with real data
                    const pct = data.percent || 0;
                    tracker.update(pct);

                    const stageInfo = getStageInfo(data.stage || 'generating_image');

                    updateProgressDisplay($progressArea.find('.task-progress'), {
                        percent: pct,
                        label: data.label || 'Generating cover image...',
                        stageText: data.current_step > 0
                            ? `🎨 Rendering step ${data.current_step}/${data.total_steps}`
                            : stageInfo.text,
                        stageIcon: data.current_step > 0 ? '🎨' : stageInfo.icon,
                        elapsed: tracker.getElapsed(),
                        eta: tracker.getETA(pct),
                        shimmer: pct === 0,
                        color: '#8b4513',
                        colorEnd: '#d2691e'
                    });

                    // Show preview image if available
                    if (data.preview_url && data.preview_url !== lastPreviewUrl) {
                        lastPreviewUrl = data.preview_url;
                        previewVersion++;
                        const $preview = $progressArea.find('.img-gen-preview');
                        $preview.show();
                        // Add cache-bust param so browser fetches the updated preview
                        $preview.find('.preview-img').attr('src', data.preview_url + '?v=' + previewVersion);
                        console.log('[Cover] Preview image updated, version:', previewVersion);
                    } else if (data.preview_url && data.current_step > 0) {
                        // Same URL but step advanced — force refresh (file was overwritten)
                        previewVersion++;
                        const $preview = $progressArea.find('.img-gen-preview');
                        $preview.find('.preview-img').attr('src', data.preview_url + '?v=' + previewVersion);
                    }

                    // Handle terminal states
                    if (data.status === 'complete') {
                        clearInterval(elapsedTimer);
                        const result = data.result || {};
                        const imageUrl = result.image_url || result.image_path;
                        images[promptId] = imageUrl;
                        if (isCustom) {
                            selectedImage = imageUrl;
                            persistSelection(imageUrl);
                        }
                        imagesGenAt = promptsGen;
                        imagesGen++;
                        console.log('[Cover] Image generation complete, promptId:', promptId, 'imagesGen:', imagesGen);
                        if (isCustom) {
                            showSuccess($container.find('.zone-body'), 'Image generated from your custom prompt!');
                        }
                        // Auto-upscale the generated image to print resolution
                        console.log('[Cover] Auto-upscaling generated image to print resolution, promptId:', promptId);
                        autoUpscaleImage(imageUrl, promptId);
                        return;
                    }

                    if (data.status === 'failed') {
                        clearInterval(elapsedTimer);
                        showProgressError($progressArea.find('.task-progress'), data.label || 'Image generation failed.');
                        $container.find('.gen-img, #gen-custom-img').prop('disabled', false);
                        return;
                    }

                    // Continue polling
                    doPoll();

                } catch (err) {
                    console.error('[Cover] Image poll error:', err.message);
                    networkErrors++;
                    if (networkErrors >= 60) {
                        // 60 consecutive network failures (1 minute) — server is truly gone
                        clearInterval(elapsedTimer);
                        showProgressError($progressArea.find('.task-progress'), 'Lost connection to server after 60 retries. Please check your connection and refresh.');
                        $container.find('.gen-img, #gen-custom-img').prop('disabled', false);
                        return;
                    }
                    console.log('[Cover] Network error', networkErrors, '— retrying (will keep trying as long as task is running)');
                    // Retry on transient errors
                    doPoll();
                }
            }, POLL_INTERVAL);
        }

        doPoll();
    }

    /**
     * Poll upscale task for completion.
     */
    function pollUpscaleTask($btn, taskId, promptId) {
        setTimeout(async () => {
            try {
                const data = await api.get(`/projects/${projectId}/cover/upscale-image/status/${taskId}`);
                console.log('[Cover] Upscale poll:', data.status, data.percent + '%', data.label);

                if (data.status === 'complete') {
                    const result = data.result || {};
                    if (result.already_hires) {
                        console.log('[Cover] Image was already high-res, no upscale needed');
                    } else {
                        console.log('[Cover] Upscale complete:', result.width, 'x', result.height);
                    }
                    upscaledImages[promptId] = true;
                    // Force image refresh by appending cache-bust
                    if (images[promptId]) {
                        const base = images[promptId].split('?')[0];
                        const newUrl = base + '?upscaled=' + Date.now();
                        // Update selectedImage if it pointed to this image (with or without query params)
                        if (selectedImage && selectedImage.split('?')[0] === base) {
                            console.log('[Cover] Updating selectedImage to upscaled URL');
                            selectedImage = newUrl;
                            persistSelection(newUrl);
                        }
                        images[promptId] = newUrl;
                    }
                    renderCurrentStep();
                    return;
                }

                if (data.status === 'failed') {
                    console.error('[Cover] Upscale failed:', data.label);
                    showError($container.find('.zone-body'), 'Upscale failed: ' + data.label);
                    $btn.prop('disabled', false).text('⬆ Upscale');
                    return;
                }

                // Update button text with progress
                $btn.text(data.label || 'Upscaling...');

                // Continue polling
                pollUpscaleTask($btn, taskId, promptId);
            } catch (err) {
                console.error('[Cover] Upscale poll error:', err.message);
                showError($container.find('.zone-body'), 'Upscale failed: ' + err.message);
                $btn.prop('disabled', false).text('⬆ Upscale');
            }
        }, 1000);
    }

    /**
     * Automatically upscale a generated image to print resolution.
     * Called immediately after image generation completes.
     * Shows inline progress in the existing UI, then re-renders when done.
     */
    async function autoUpscaleImage(imageUrl, promptId) {
        console.log('[Cover] autoUpscaleImage entry, imageUrl:', imageUrl, 'promptId:', promptId);

        // Re-render the step first so the user sees their generated image
        renderCurrentStep();

        try {
            const resp = await api.post(`/projects/${projectId}/cover/upscale-image`, { image_url: imageUrl });
            const taskId = resp.task_id;
            console.log('[Cover] Auto-upscale task started, task_id:', taskId);

            // Show upscale progress inline — find or create a status element
            const $status = $container.find('#auto-upscale-status');
            if ($status.length) {
                $status.html('<span style="color:#8b4513;">⬆ Upscaling to print resolution...</span>');
            }

            pollAutoUpscale(taskId, promptId);
        } catch (err) {
            console.error('[Cover] Auto-upscale failed to start:', err.message);
            // Not fatal — user can still manually upscale later
            showError($container.find('.zone-body'), 'Auto-upscale failed: ' + err.message + '. You can try again manually.');
        }
    }

    /**
     * Poll the auto-upscale task. Similar to pollUpscaleTask but doesn't need a button reference.
     */
    function pollAutoUpscale(taskId, promptId) {
        setTimeout(async () => {
            try {
                const data = await api.get(`/projects/${projectId}/cover/upscale-image/status/${taskId}`);
                console.log('[Cover] Auto-upscale poll:', data.status, data.percent + '%', data.label);

                // Update inline status if still in DOM
                const $status = $container.find('#auto-upscale-status');
                if ($status.length && data.label) {
                    $status.html(`<span style="color:#8b4513;">⬆ ${escapeHtml(data.label)}</span>`);
                }

                if (data.status === 'complete') {
                    const result = data.result || {};
                    if (result.already_hires) {
                        console.log('[Cover] Auto-upscale: image was already high-res');
                    } else {
                        console.log('[Cover] Auto-upscale complete:', result.width, 'x', result.height);
                    }
                    upscaledImages[promptId] = true;
                    if (images[promptId]) {
                        const base = images[promptId].split('?')[0];
                        const newUrl = base + '?upscaled=' + Date.now();
                        if (selectedImage && selectedImage.split('?')[0] === base) {
                            selectedImage = newUrl;
                            persistSelection(newUrl);
                        }
                        images[promptId] = newUrl;
                    }
                    showSuccess($container.find('.zone-body'), 'Image upscaled to print resolution!');
                    renderCurrentStep();
                    return;
                }

                if (data.status === 'failed') {
                    console.error('[Cover] Auto-upscale failed:', data.label);
                    showError($container.find('.zone-body'), 'Upscale failed: ' + (data.label || 'Unknown error') + '. You can try again manually.');
                    renderCurrentStep();
                    return;
                }

                // Continue polling
                pollAutoUpscale(taskId, promptId);
            } catch (err) {
                console.error('[Cover] Auto-upscale poll error:', err.message);
                showError($container.find('.zone-body'), 'Upscale failed: ' + err.message);
                renderCurrentStep();
            }
        }, 1000);
    }

    function renderStep3() {
        // Check staleness from upstream steps
        const staleSteps = [];
        if (isImagesStale()) staleSteps.push('Prompts');
        if (isBuilderStale()) staleSteps.push('Image Selection');

        $container.html(`
            <h1>${escapeHtml(titleText)}</h1>
            ${authorText ? `<p style="color:#8b4513; font-style:italic; margin-bottom:1.5rem;">by ${escapeHtml(authorText)}</p>` : ''}
            ${renderStepperNav()}
            <div class="zone-container" style="margin-top:1rem;">
                <div class="zone-header"><h2>Cover Builder</h2></div>
                <div class="zone-body">
                    ${staleWarningHtml(staleSteps)}
                    <div class="builder-layout">
                        <div>
                            <h3>Live Preview</h3>
                            <div class="cover-preview" id="live-preview"></div>
                            <p class="hint" style="text-align:center; margin-top:0.5rem;">Spine: ${spineWidth.toFixed(1)}mm (${pageCount} pages)</p>
                        </div>
                        <div id="builder-controls"></div>
                    </div>
                    <div class="actions" style="margin-top:1rem; border-top:1px solid #8b5a2b; padding-top:1rem;">
                        <button class="btn secondary" id="back-step2">← Back to Cover Images</button>
                        <button class="btn secondary" id="restart-step3" title="Reset builder settings to defaults">↺ Start Over</button>
                    </div>
                </div>
            </div>
        `);

        bindStepperClicks();
        renderControls();
        updatePreview();

        $container.find('#back-step2').on('click', () => { step = 'images'; renderCurrentStep(); });
        $container.find('#restart-step3').on('click', () => {
            console.log('[Cover] Restarting step 3: resetting builder settings (image selection preserved)');
            selectedTemplate = 'classic';
            titleFontSize = 48; titleColor = '#FFFFFF'; titleFontFamily = 'serif';
            titleX = 0.5; titleY = 0.15; titleAnchor = 'center';
            authorFontSize = 24; authorColor = '#FFFFFF'; authorFontFamily = 'serif';
            authorX = 0.5; authorY = 0.85; authorAnchor = 'center';
            blurb = null;
            builderGenAt = imagesGen;
            renderCurrentStep();
        });
    }

    function renderControls() {
        const $ctrl = $container.find('#builder-controls');
        let tmplHtml = templates.map(t => `<button class="template-btn ${selectedTemplate === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`).join('');

        $ctrl.html(`
            <div class="control-section"><h4>Template</h4><div class="template-grid">${tmplHtml}</div></div>
            <div class="control-section"><h4>Title Text</h4><input type="text" id="title-input" value="${escapeHtml(titleText)}" maxlength="100"><span class="char-count">${titleText.length}/100</span><div class="style-row"><select id="title-font"><option value="serif" ${titleFontFamily === 'serif' ? 'selected' : ''}>Serif</option><option value="sans-serif" ${titleFontFamily === 'sans-serif' ? 'selected' : ''}>Sans-serif</option><option value="Garamond" ${titleFontFamily === 'Garamond' ? 'selected' : ''}>Garamond</option><option value="Helvetica" ${titleFontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option><option value="Palatino" ${titleFontFamily === 'Palatino' ? 'selected' : ''}>Palatino</option><option value="Impact" ${titleFontFamily === 'Impact' ? 'selected' : ''}>Impact</option><option value="Inter" ${titleFontFamily === 'Inter' ? 'selected' : ''}>Inter</option></select><input type="number" class="size-input" id="title-size" value="${titleFontSize}" min="8" max="200"><input type="color" class="color-input" id="title-color" value="${titleColor}"></div><div class="position-row" style="display:flex; gap:0.75rem; align-items:center; margin-top:0.5rem;"><label style="font-size:0.8rem; color:#666; min-width:1.5rem;">X</label><input type="range" id="title-x" min="0" max="100" value="${Math.round(titleX * 100)}" style="flex:1;"><span class="pos-val" id="title-x-val" style="font-size:0.75rem; color:#666; min-width:2.5rem;">${Math.round(titleX * 100)}%</span><label style="font-size:0.8rem; color:#666; min-width:1.5rem;">Y</label><input type="range" id="title-y" min="0" max="100" value="${Math.round(titleY * 100)}" style="flex:1;"><span class="pos-val" id="title-y-val" style="font-size:0.75rem; color:#666; min-width:2.5rem;">${Math.round(titleY * 100)}%</span></div></div>
            <div class="control-section"><h4>Author Text</h4><input type="text" id="author-input" value="${escapeHtml(authorText)}" maxlength="60"><span class="char-count">${authorText.length}/60</span><div class="style-row"><select id="author-font"><option value="serif" ${authorFontFamily === 'serif' ? 'selected' : ''}>Serif</option><option value="sans-serif" ${authorFontFamily === 'sans-serif' ? 'selected' : ''}>Sans-serif</option><option value="Garamond" ${authorFontFamily === 'Garamond' ? 'selected' : ''}>Garamond</option><option value="Helvetica" ${authorFontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option><option value="Palatino" ${authorFontFamily === 'Palatino' ? 'selected' : ''}>Palatino</option><option value="Impact" ${authorFontFamily === 'Impact' ? 'selected' : ''}>Impact</option><option value="Inter" ${authorFontFamily === 'Inter' ? 'selected' : ''}>Inter</option></select><input type="number" class="size-input" id="author-size" value="${authorFontSize}" min="8" max="200"><input type="color" class="color-input" id="author-color" value="${authorColor}"></div><div class="position-row" style="display:flex; gap:0.75rem; align-items:center; margin-top:0.5rem;"><label style="font-size:0.8rem; color:#666; min-width:1.5rem;">X</label><input type="range" id="author-x" min="0" max="100" value="${Math.round(authorX * 100)}" style="flex:1;"><span class="pos-val" id="author-x-val" style="font-size:0.75rem; color:#666; min-width:2.5rem;">${Math.round(authorX * 100)}%</span><label style="font-size:0.8rem; color:#666; min-width:1.5rem;">Y</label><input type="range" id="author-y" min="0" max="100" value="${Math.round(authorY * 100)}" style="flex:1;"><span class="pos-val" id="author-y-val" style="font-size:0.75rem; color:#666; min-width:2.5rem;">${Math.round(authorY * 100)}%</span></div></div>
            <div class="control-section"><h4>Back Cover Synopsis</h4>${blurb !== null ? `<textarea id="blurb-input" rows="5" maxlength="3000" placeholder="Type your back cover synopsis here...">${escapeHtml(blurb)}</textarea><p class="hint">${blurb.split(/\s+/).filter(Boolean).length} words</p><button class="btn secondary btn-sm" id="clear-blurb" style="margin-top:0.5rem;">Clear</button>` : `<button class="btn primary" id="lookup-blurb">Look Up Synopsis</button><p class="hint" style="margin:0.5rem 0 0.25rem;">Searches Open Library &amp; Google Books (free, instant)</p><div class="divider" style="margin:0.5rem 0;">or</div><button class="btn secondary" id="gen-blurb">Generate with AI</button><p class="hint" style="margin:0.25rem 0 0;">Uses your AI provider to write a synopsis from the book text</p><div class="divider" style="margin:0.5rem 0;">or</div><button class="btn secondary" id="write-own-blurb">Write Your Own</button><p class="hint" style="margin:0.25rem 0 0;">Type or paste your own synopsis</p><div id="blurb-status"></div>`}</div>
            <button class="btn primary" id="assemble-cover" style="width:100%; margin-top:1rem;">Generate Print-Ready Cover PDF</button>
        `);

        // Bind controls for real-time preview
        $ctrl.find('#title-input').on('input', function () { titleText = $(this).val(); $(this).next('.char-count').text(`${titleText.length}/100`); updatePreview(); });
        $ctrl.find('#author-input').on('input', function () { authorText = $(this).val(); $(this).next('.char-count').text(`${authorText.length}/60`); updatePreview(); });
        $ctrl.find('#title-font').on('change', function () { titleFontFamily = $(this).val(); updatePreview(); });
        $ctrl.find('#title-size').on('input', function () { titleFontSize = parseInt($(this).val()) || 48; updatePreview(); });
        $ctrl.find('#title-color').on('input', function () { titleColor = $(this).val(); updatePreview(); });
        $ctrl.find('#title-x').on('input', function () { titleX = parseInt($(this).val()) / 100; $ctrl.find('#title-x-val').text($(this).val() + '%'); updatePreview(); });
        $ctrl.find('#title-y').on('input', function () { titleY = parseInt($(this).val()) / 100; $ctrl.find('#title-y-val').text($(this).val() + '%'); updatePreview(); });
        $ctrl.find('#author-font').on('change', function () { authorFontFamily = $(this).val(); updatePreview(); });
        $ctrl.find('#author-size').on('input', function () { authorFontSize = parseInt($(this).val()) || 24; updatePreview(); });
        $ctrl.find('#author-color').on('input', function () { authorColor = $(this).val(); updatePreview(); });
        $ctrl.find('#author-x').on('input', function () { authorX = parseInt($(this).val()) / 100; $ctrl.find('#author-x-val').text($(this).val() + '%'); updatePreview(); });
        $ctrl.find('#author-y').on('input', function () { authorY = parseInt($(this).val()) / 100; $ctrl.find('#author-y-val').text($(this).val() + '%'); updatePreview(); });
        $ctrl.find('#blurb-input').on('input', function () { blurb = $(this).val(); updatePreview(); });

        // Template buttons
        $ctrl.find('.template-btn').on('click', function () {
            const id = $(this).data('id');
            selectedTemplate = id;
            const tmpl = templates.find(t => t.id === id);
            if (tmpl) {
                titleFontFamily = tmpl.title_style?.font_family || 'serif';
                titleFontSize = tmpl.title_style?.font_size || 48;
                titleColor = tmpl.title_style?.color || '#FFFFFF';
                titleX = tmpl.title_position?.x ?? 0.5;
                titleY = tmpl.title_position?.y ?? 0.15;
                titleAnchor = tmpl.title_position?.anchor || 'center';
                authorFontFamily = tmpl.author_style?.font_family || 'serif';
                authorFontSize = tmpl.author_style?.font_size || 24;
                authorColor = tmpl.author_style?.color || '#FFFFFF';
                authorX = tmpl.author_position?.x ?? 0.5;
                authorY = tmpl.author_position?.y ?? 0.85;
                authorAnchor = tmpl.author_position?.anchor || 'center';
                console.log('[Cover] Template applied:', id);
            }
            $ctrl.find('.template-btn').removeClass('active');
            $(this).addClass('active');
            renderControls();
            updatePreview();
        });

        // Look up blurb — primary option (free, instant from Open Library / Google Books)
        $ctrl.find('#lookup-blurb').on('click', async function () {
            const $btn = $(this);
            const $blurbStatus = $ctrl.find('#blurb-status');
            setLoading($btn, true, 'Looking up...');
            clearMessages($blurbStatus);
            console.log('[Cover] Looking up synopsis from Open Library / Google Books');

            try {
                const resp = await api.post(`/projects/${projectId}/cover/lookup-blurb`);
                console.log('[Cover] Lookup response:', resp);

                if (resp.found && resp.results && resp.results.length > 0) {
                    // Use the first result (Open Library preferred, then Google Books)
                    const best = resp.results[0];
                    console.log('[Cover] Synopsis found via', best.source, '- words:', best.word_count);
                    blurb = best.synopsis;

                    // If multiple results, show source info
                    if (resp.results.length > 1) {
                        const sources = resp.results.map(r => r.source.replace('_', ' ')).join(', ');
                        console.log('[Cover] Multiple sources found:', sources);
                    }

                    renderControls();
                    updatePreview();
                } else {
                    console.log('[Cover] No synopsis found from lookup sources');
                    $blurbStatus.html('<p class="hint" style="color:#8b4513; margin-top:0.5rem;">No synopsis found online. Try generating one with AI below.</p>');
                    setLoading($btn, false);
                }
            } catch (err) {
                console.error('[Cover] Synopsis lookup failed:', err);
                showError($blurbStatus, 'Lookup failed: ' + err.message);
                setLoading($btn, false);
            }
        });

        // Clear blurb and return to options
        $ctrl.find('#clear-blurb').on('click', function () {
            console.log('[Cover] Clearing blurb, returning to synopsis options');
            blurb = null;
            renderControls();
            updatePreview();
        });

        // Write your own — opens empty textarea for custom synopsis
        $ctrl.find('#write-own-blurb').on('click', function () {
            console.log('[Cover] User chose to write their own synopsis');
            blurb = '';
            renderControls();
            updatePreview();
        });

        // Generate blurb — uses real polling
        $ctrl.find('#gen-blurb').on('click', async function () {
            const $btn = $(this);
            const $blurbStatus = $ctrl.find('#blurb-status');
            setLoading($btn, true, 'Starting...');
            clearMessages($blurbStatus);

            try {
                const resp = await api.post(`/projects/${projectId}/cover/generate-blurb`);
                const taskId = resp.task_id;
                console.log('[Cover] Blurb generation task started, task_id:', taskId);
                $blurbStatus.html(`
                    <div class="task-progress" style="margin-top:0.5rem;">
                        <div class="progress-bar-container" style="background:#e0e0e0; border-radius:4px; height:16px; overflow:hidden; margin:4px 0;">
                            <div class="progress-bar-fill indeterminate" style="width:30%; height:100%; background:linear-gradient(90deg,#8b4513,#d2691e); border-radius:4px; animation: indeterminate 1.5s infinite ease-in-out;"></div>
                        </div>
                        <div class="progress-details" style="display:flex; justify-content:space-between; align-items:center; margin:4px 0;">
                            <p class="progress-label" style="margin:0; font-size:0.8rem; font-weight:500;">Writing synopsis...</p>
                        </div>
                        <div class="progress-meta" style="display:flex; justify-content:space-between; font-size:0.75rem; color:#666; margin-top:2px;">
                            <span class="progress-elapsed">Elapsed: 0:00</span>
                            <span class="progress-eta">~1:30 estimated</span>
                        </div>
                        <div class="progress-stage-indicator" style="margin-top:6px; padding:4px 8px; background:#f8f5f0; border-radius:4px; border-left:3px solid #8b4513; font-size:0.78rem; color:#5a3e1b;">
                            <span class="stage-icon">✍️</span> <span class="stage-text">Sending book text to AI for synopsis generation</span>
                        </div>
                    </div>
                    <style>
                        @keyframes indeterminate {
                            0% { transform: translateX(-100%); }
                            100% { transform: translateX(400%); }
                        }
                    </style>
                `);
                const tracker = createProgressTracker({ estimatedTotalSeconds: TASK_ESTIMATES.blurb_generation });
                _killAborted = false;
                // Add force kill button and safe-to-leave message to blurb progress
                $blurbStatus.find('.task-progress').append('<div class="progress-kill" style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size:0.78rem; color:#5a8a5a; font-style:italic;">✓ Safe to leave — this runs on the server.</span><button class="btn btn-sm btn-danger force-kill-task" style="font-size:0.78rem; padding:4px 10px; background:#b22222; color:#fff; border:none; border-radius:4px; cursor:pointer;">⛔ Force Kill</button></div>');
                bindForceKill($blurbStatus, taskId, () => {
                    $blurbStatus.html('<p style="color:#e74c3c; margin-top:0.5rem;">❌ Synopsis generation killed by user.</p>');
                });
                pollBlurbTask($blurbStatus, taskId, 0, null, 0, tracker);
            } catch (err) {
                console.error('[Cover] Failed to start blurb generation:', err);
                if (err.message && (err.message.includes('not available') || err.message.includes('not reachable') || err.message.includes('Ensure the service'))) {
                    const adminNote = isAdmin() ? '' : ' Only an admin can configure AI models.';
                    showErrorWithAction(
                        $blurbStatus,
                        err.message + adminNote,
                        { text: 'Go to Settings →', href: '/settings' }
                    );
                } else {
                    showError($blurbStatus, err.message);
                }
                setLoading($btn, false);
            }
        });

        // Assemble cover — quick operation, show stage indicators
        $ctrl.find('#assemble-cover').on('click', async function () {
            const $btn = $(this);
            setLoading($btn, true, 'Preparing layout...');
            clearMessages($container.find('.zone-body'));

            // Show inline stage indicator
            const $stageArea = $(`<div class="assemble-stage" style="margin-top:8px; padding:6px 10px; background:#f8f5f0; border-radius:4px; border-left:3px solid #8b4513; font-size:0.82rem; color:#5a3e1b;"><span>📐</span> Preparing cover layout and dimensions...</div>`);
            $btn.after($stageArea);

            const stageTimer = setTimeout(() => {
                $btn.text('Assembling PDF...');
                $stageArea.html('<span>🖨️</span> Assembling print-ready cover PDF...');
            }, 2000);

            const tmpl = templates.find(t => t.id === selectedTemplate);
            const layout = {
                front_image: selectedImage,
                front_cover: { image_path: selectedImage },
                title: { text: titleText, font_size: titleFontSize, font_family: titleFontFamily, color: titleColor, x: titleX, y: titleY, anchor: titleAnchor },
                author: { text: authorText, font_size: authorFontSize, font_family: authorFontFamily, color: authorColor, x: authorX, y: authorY, anchor: authorAnchor },
                blurb: blurb || ''
            };
            try {
                const result = await api.post(`/projects/${projectId}/cover/assemble`, { layout, paper_stock: 'standard_white' });
                clearTimeout(stageTimer);
                $stageArea.remove();
                console.log('[Cover] Cover assembled:', result);
                showSuccess($container.find('.zone-body'), `Cover PDF generated!${result.spine_width_mm ? ` Spine width: ${result.spine_width_mm}mm.` : ''}`);
                setTimeout(() => navigate(`/projects/${projectId}`), 2000);
            } catch (err) {
                clearTimeout(stageTimer);
                $stageArea.remove();
                if (err.status === 422 && (err.data?.detail?.missing || err.data?.missing)) {
                    const missing = err.data.detail?.missing || err.data.missing;
                    showError($container.find('.zone-body'), `Missing required elements: ${missing.join(', ')}`);
                } else {
                    showError($container.find('.zone-body'), err.message);
                }
                setLoading($btn, false);
            }
        });
    }

    function pollBlurbTask($status, taskId, attempts, lastStatus, staleCount, tracker) {
        // No stale timeout — as long as the backend says the task is running, we keep polling.
        const MAX_NETWORK_ERRORS = 60; // 2 minutes of consecutive network failures
        staleCount = staleCount || 0;
        lastStatus = lastStatus || '';

        setTimeout(async () => {
            if (_killAborted) { console.log('[Cover] Blurb poll aborted (task killed)'); return; }
            try {
                const data = await api.get(`/projects/${projectId}/cover/generate-blurb/status/${taskId}`);
                console.log('[Cover] Blurb poll attempt', attempts + 1, ':', data.status, data.stage);

                const currentStatus = data.status + ':' + data.stage;
                let newStaleCount = (currentStatus === lastStatus) ? staleCount + 1 : 0;

                // Update elapsed time and stage indicator
                $status.find('.progress-elapsed').text('Elapsed: ' + tracker.getElapsed());
                $status.find('.progress-eta').text(tracker.getETA(0)); // indeterminate, use time-based estimate
                $status.find('.progress-label').text(data.label || 'Writing synopsis...');

                // Update stage indicator based on elapsed time
                const elapsed = Date.now() - tracker.getStartTime();
                if (elapsed < 5000) {
                    $status.find('.stage-icon').text('📤');
                    $status.find('.stage-text').text('Sending book text to AI for synopsis generation');
                } else if (elapsed < 30000) {
                    $status.find('.stage-icon').text('✍️');
                    $status.find('.stage-text').text('AI is reading your book and composing a synopsis');
                } else if (elapsed < 60000) {
                    $status.find('.stage-icon').text('🧠');
                    $status.find('.stage-text').text('AI is crafting the synopsis — CPU inference takes time');
                } else {
                    $status.find('.stage-icon').text('⏳');
                    $status.find('.stage-text').text('Still working — long texts take longer to summarize');
                }

                if (data.status === 'complete') {
                    console.log('[Cover] Blurb generated, words:', data.result?.word_count);
                    blurb = data.result?.blurb || '';
                    renderControls();
                    updatePreview();
                } else if (data.status === 'failed') {
                    console.error('[Cover] Blurb generation failed:', data.label);
                    if (data.label && (data.label.includes('not available') || data.label.includes('not reachable'))) {
                        const adminNote = isAdmin() ? '' : ' Only an admin can configure AI models.';
                        $status.html(`<p style="color:#e74c3c; margin-top:0.5rem;">❌ Error: ${escapeHtml(data.label)} — Download the required model from <a href="/settings" style="color:#8b4513;">Settings →</a>${escapeHtml(adminNote)}</p>`);
                    } else {
                        $status.html(`<p style="color:#e74c3c; margin-top:0.5rem;">❌ Error: ${escapeHtml(data.label)}</p>`);
                    }
                } else if (newStaleCount >= 60 && newStaleCount % 60 === 0) {
                    console.log('[Cover] Blurb generation still working, no state change for', newStaleCount, 'polls — continuing to wait');
                    pollBlurbTask($status, taskId, attempts + 1, currentStatus, newStaleCount, tracker);
                } else {
                    pollBlurbTask($status, taskId, attempts + 1, currentStatus, newStaleCount, tracker);
                }
            } catch (err) {
                console.warn('[Cover] Blurb poll error (attempt', attempts + 1, '):', err.message);
                const newNetworkErrors = (staleCount || 0) + 1;
                if (newNetworkErrors >= MAX_NETWORK_ERRORS) {
                    $status.html('<p style="color:#e74c3c; margin-top:0.5rem;">❌ Lost connection to server after 60 retries. Please check your connection and refresh.</p>');
                } else {
                    pollBlurbTask($status, taskId, attempts + 1, lastStatus, newNetworkErrors, tracker);
                }
            }
        }, 2000);
    }

    function updatePreview() {
        const $preview = $container.find('#live-preview');
        if (!$preview.length) return;
        const sw = Math.max(8, spineWidth * 0.6);
        $preview.html(`
            <div class="cover-panel back"><span style="font-size:0.6rem; color:#8b4513; position:absolute; top:4px; left:4px;">Back</span>${blurb ? `<p style="font-size:0.6rem; text-align:left; margin-top:1.5rem; padding:0 0.25rem; line-height:1.3;">${escapeHtml(blurb.substring(0, 200))}...</p>` : ''}<div style="width:40px; height:40px; border:1px solid #8b5a2b; display:flex; align-items:center; justify-content:center; font-size:0.6rem; margin-top:auto; margin-bottom:0.5rem;">QR</div><p style="font-size:0.5rem; color:#666; text-align:center; margin:0 0.25rem 0.25rem; line-height:1.2;">Assembled by CWOPOD — C.W.\u2019s Open Print-On-Demand<br>www.cwholemaniii.com/cwopod</p></div>
            <div class="cover-panel spine" style="width:${sw}px;"><span style="font-size:0.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-height:200px;">${escapeHtml(titleText)}</span></div>
            <div class="cover-panel front" style="position:relative;"><span style="font-size:0.6rem; color:#8b4513; position:absolute; top:4px; left:4px; z-index:2;">Front</span>${selectedImage ? `<img src="${escapeHtml(selectedImage)}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity:0.85;">` : ''}<p style="position:absolute; z-index:1; font-weight:700; left:${titleX * 100}%; top:${titleY * 100}%; transform:translate(-50%, -50%); text-align:center; font-size:${Math.min(titleFontSize * 0.35, 22)}px; color:${titleColor}; font-family:${titleFontFamily}; text-shadow:1px 1px 3px rgba(0,0,0,0.8); word-break:break-word; margin:0; max-width:90%;">${escapeHtml(titleText)}</p><p style="position:absolute; z-index:1; left:${authorX * 100}%; top:${authorY * 100}%; transform:translate(-50%, -50%); text-align:center; font-size:${Math.min(authorFontSize * 0.35, 14)}px; color:${authorColor}; font-family:${authorFontFamily}; text-shadow:1px 1px 2px rgba(0,0,0,0.7); margin:0;">${escapeHtml(authorText)}</p></div>
        `);
    }

    async function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        console.log('[Cover] Upload initiated:', file.name, file.size);

        // If prompt generation is currently running, confirm the user wants to skip it
        if (promptGenerationInProgress) {
            const confirmed = confirm(
                'Cover prompt generation is still running. Uploading your own image will skip the AI-generated prompts.\n\nContinue with upload?'
            );
            if (!confirmed) {
                console.log('[Cover] Upload cancelled — user chose to wait for generation');
                e.target.value = ''; // reset file input
                return;
            }
            console.log('[Cover] User confirmed upload while generation in progress');
            // Note: the Celery task will continue in the background but its results
            // won't be used since the user is providing their own image.
            promptGenerationInProgress = false;
        }

        // If image generation is currently running, confirm and cancel it
        try {
            const activeCheck = await api.get(`/projects/${projectId}/cover/generate-image/active`);
            if (activeCheck.active && activeCheck.task_id) {
                console.log('[Cover] Active image task detected during upload:', activeCheck.task_id);
                const confirmed = confirm(
                    'An image is currently being generated. Cancel it and use your uploaded image instead?'
                );
                if (!confirmed) {
                    console.log('[Cover] Upload cancelled — user chose to wait for image generation');
                    e.target.value = '';
                    return;
                }
                console.log('[Cover] User confirmed upload — cancelling active image task:', activeCheck.task_id);
                const cancelResp = await api.post(`/projects/${projectId}/cover/generate-image/cancel`);
                console.log('[Cover] Cancel response:', cancelResp);
                // Hide the progress area since we're cancelling
                $container.find('#img-gen-progress').hide();
            }
        } catch (err) {
            console.warn('[Cover] Active image task check/cancel failed during upload:', err.message, '— proceeding');
        }

        if (file.size > 25 * 1024 * 1024) {
            showError($container.find('.zone-body'), 'Image exceeds 25 MB maximum.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`/api/projects/${projectId}/cover/upload-image`, { method: 'POST', credentials: 'include', body: formData });
            if (!response.ok) { const err = await response.json().catch(() => ({ detail: 'Upload failed' })); throw new Error(err.detail); }
            const data = await response.json();
            selectedImage = data.image_url || data.image_path;
            persistSelection(selectedImage);
            const uploadedPromptId = 'uploaded_' + Date.now();
            images[uploadedPromptId] = selectedImage;
            console.log('[Cover] Registered uploaded image in images map, promptId:', uploadedPromptId);
            imagesGenAt = promptsGen;
            imagesGen++;
            console.log('[Cover] Image uploaded:', selectedImage, 'imagesGen:', imagesGen);
            showSuccess($container.find('.zone-body'), 'Image uploaded!');
            // Auto-upscale the uploaded image to print resolution
            if (step === 'prompts') { step = 'images'; }
            console.log('[Cover] Auto-upscaling uploaded image to print resolution, promptId:', uploadedPromptId);
            autoUpscaleImage(selectedImage, uploadedPromptId);
        } catch (err) {
            showError($container.find('.zone-body'), err.message);
        }
    }
}
