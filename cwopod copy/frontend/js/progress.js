/**
 * Shared progress tracking utilities for AI task polling.
 * Provides time estimation, stage indicators, and elapsed time display.
 * All time estimates are guesstimates based on observed task durations.
 */

/**
 * Create a new progress tracker for an AI task.
 * Tracks elapsed time and estimates remaining time based on percent progress.
 *
 * @param {object} opts
 * @param {number} opts.estimatedTotalSeconds - Guesstimate of total task duration in seconds
 * @returns {object} tracker with update() and getDisplay() methods
 */
export function createProgressTracker(opts = {}) {
    const startTime = Date.now();
    const estimatedTotal = (opts.estimatedTotalSeconds || 60) * 1000; // ms
    let lastPercent = 0;
    let lastUpdateTime = startTime;
    let rateHistory = []; // rolling window of {time, percent} for ETA smoothing

    console.log('[ProgressTracker] Created, estimatedTotal:', opts.estimatedTotalSeconds, 's');

    return {
        /**
         * Update tracker with latest progress data from server.
         * @param {number} percent - Current percent (0-100)
         */
        update(percent) {
            const now = Date.now();
            if (percent > lastPercent) {
                rateHistory.push({ time: now, percent });
                // Keep last 10 data points for smoothing
                if (rateHistory.length > 10) rateHistory.shift();
                lastPercent = percent;
                lastUpdateTime = now;
            }
        },

        /**
         * Get formatted elapsed time string.
         * @returns {string} e.g. "0:45" or "2:15"
         */
        getElapsed() {
            const elapsed = Date.now() - startTime;
            return formatDuration(elapsed);
        },

        /**
         * Get estimated time remaining string.
         * Uses actual progress rate when available. Does NOT fall back to guesses.
         * @param {number} currentPercent - Current percent (0-100)
         * @returns {string} e.g. "~1:30 remaining" or ""
         */
        getETA(currentPercent) {
            // Only show ETA when we have enough real data points
            if (rateHistory.length >= 2 && currentPercent > 0) {
                const first = rateHistory[0];
                const last = rateHistory[rateHistory.length - 1];
                const percentDelta = last.percent - first.percent;
                const timeDelta = last.time - first.time;

                if (percentDelta > 0 && timeDelta > 0) {
                    const msPerPercent = timeDelta / percentDelta;
                    const remainingPercent = 100 - currentPercent;
                    const remainingMs = msPerPercent * remainingPercent;
                    return '~' + formatDuration(remainingMs) + ' remaining';
                }
            }

            // No real data yet — don't guess
            return '';
        },

        /**
         * Get the start timestamp (for computing elapsed externally).
         * @returns {number} Unix timestamp in ms
         */
        getStartTime() {
            return startTime;
        }
    };
}

/**
 * Format milliseconds into a human-readable duration string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} e.g. "0:45", "2:15", "12:03"
 */
export function formatDuration(ms) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Build the HTML for a detailed progress status area with stage indicators.
 * @param {object} opts
 * @param {string} opts.color - Primary color for the progress bar gradient (e.g. '#8b4513')
 * @param {string} opts.colorEnd - End color for gradient (e.g. '#d2691e')
 * @param {boolean} opts.showChapterFeed - Whether to include the chapter notes feed area
 * @param {string} opts.feedLabel - Label for the chapter notes feed (default: 'Live feed:')
 * @returns {string} HTML string
 */
export function buildProgressHtml(opts = {}) {
    const color = opts.color || '#8b4513';
    const colorEnd = opts.colorEnd || '#d2691e';
    const showFeed = opts.showChapterFeed || false;
    const feedLabel = opts.feedLabel || 'Live feed:';

    let html = `
        <div class="task-progress" style="margin-top:1rem;">
            <div class="progress-bar-container" style="background:#e0e0e0; border-radius:6px; height:22px; overflow:hidden; margin:8px 0;">
                <div class="progress-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,${color},${colorEnd}); transition:width 0.4s ease; border-radius:6px;"></div>
            </div>
            <div class="progress-details" style="display:flex; justify-content:space-between; align-items:center; margin:4px 0;">
                <p class="progress-label" style="margin:0; font-weight:500; flex:1;">Starting...</p>
                <span class="progress-percent" style="font-weight:600; margin-left:1rem;"></span>
            </div>
            <div class="progress-meta" style="display:flex; justify-content:space-between; font-size:0.8rem; color:#666; margin-top:4px;">
                <span class="progress-elapsed">Elapsed: 0:00</span>
                <span class="progress-eta"></span>
            </div>
            <div class="progress-stage-indicator" style="margin-top:8px; padding:6px 10px; background:#f8f5f0; border-radius:4px; border-left:3px solid ${color}; font-size:0.82rem; color:#5a3e1b;">
                <span class="stage-icon">⏳</span> <span class="stage-text">Initializing task...</span>
            </div>
            <div class="progress-kill" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <span class="safe-to-leave" style="font-size:0.78rem; color:#5a8a5a; font-style:italic;">✓ Safe to leave — this runs on the server and will continue in the background.</span>
                <button class="btn btn-sm btn-danger force-kill-task" style="font-size:0.78rem; padding:4px 10px; background:#b22222; color:#fff; border:none; border-radius:4px; cursor:pointer;">⛔ Force Kill</button>
            </div>`;

    if (showFeed) {
        html += `
            <div style="margin-top:1rem;">
                <p style="margin:0 0 0.5rem 0; font-size:0.82rem; font-weight:600; color:#5a3e1b;">${feedLabel}</p>
                <div class="chapter-notes-feed" style="max-height:300px; overflow-y:auto; border:1px solid #e0d5c8; border-radius:6px; padding:0.75rem; background:#faf7f4; font-size:0.85rem;"><span style="color:#999; font-style:italic;">Waiting for results...</span></div>
            </div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * Update the progress display with current data.
 * @param {jQuery} $container - The .task-progress container
 * @param {object} opts
 * @param {number} opts.percent - Current percent (0-100)
 * @param {string} opts.label - Main progress label text
 * @param {string} opts.stageText - Detailed stage description
 * @param {string} opts.stageIcon - Emoji icon for current stage
 * @param {string} opts.elapsed - Formatted elapsed time
 * @param {string} opts.eta - Formatted ETA string
 * @param {boolean} opts.shimmer - Whether to show shimmer animation (model loading)
 * @param {string} opts.color - Bar color
 * @param {string} opts.colorEnd - Bar gradient end color
 */
export function updateProgressDisplay($container, opts) {
    const pct = opts.percent != null ? opts.percent : 0;
    const color = opts.color || '#8b4513';
    const colorEnd = opts.colorEnd || '#d2691e';

    if (opts.shimmer) {
        $container.find('.progress-bar-fill').css({
            'width': '100%',
            'background': `linear-gradient(90deg, ${color} 0%, ${colorEnd} 50%, ${color} 100%)`,
            'background-size': '200% 100%',
            'animation': 'shimmer 2s infinite linear'
        });
        $container.find('.progress-percent').text('');
        ensureShimmerStyle();
    } else {
        $container.find('.progress-bar-fill').css({
            'width': pct + '%',
            'background': `linear-gradient(90deg,${color},${colorEnd})`,
            'animation': 'none'
        });
        // Only show percentage text when we have real progress
        $container.find('.progress-percent').text(pct > 0 ? pct + '%' : '');
    }

    $container.find('.progress-label').text(opts.label || '');
    $container.find('.progress-elapsed').text('Elapsed: ' + (opts.elapsed || '0:00'));
    $container.find('.progress-eta').text(opts.eta || '');

    if (opts.stageText) {
        $container.find('.stage-icon').text(opts.stageIcon || '⏳');
        $container.find('.stage-text').text(opts.stageText);
    }
}

/**
 * Show error state on a progress display.
 * @param {jQuery} $container - The .task-progress container
 * @param {string} message - Error message
 */
export function showProgressError($container, message) {
    $container.find('.progress-bar-fill').css({ 'width': '100%', 'background': '#e74c3c' });
    $container.find('.progress-label').html(`<span style="color:#e74c3c;">${message}</span>`);
    $container.find('.progress-percent').text('');
    $container.find('.progress-eta').text('');
    $container.find('.stage-icon').text('❌');
    $container.find('.stage-text').text('Task failed');
}

/**
 * Map AI task stages to human-readable descriptions and icons.
 */
export const STAGE_INDICATORS = {
    // Cover prompt generation stages
    queued: { icon: '🔄', text: 'Task queued — waiting for worker to pick up' },
    starting: { icon: '🚀', text: 'Worker picked up task — initializing' },
    loading_text: { icon: '📖', text: 'Loading book text from storage' },
    detecting_chapters: { icon: '📑', text: 'Splitting text into chapters' },
    waiting_for_ai: { icon: '🧠', text: 'Waiting for AI model to load (CPU inference — this takes 1-3 min)' },
    analyzing_chapters: { icon: '🔍', text: 'Sending chapter text to AI for visual analysis' },
    synthesizing: { icon: '✨', text: 'AI is synthesizing final cover prompts from all themes' },
    model_loading: { icon: '⏳', text: 'Processing chapter — waiting for AI response' },

    // Typeset stages
    generating_qr_codes: { icon: '📱', text: 'Generating QR codes for chapter links' },
    rendering_template: { icon: '📄', text: 'Rendering page layouts with template engine' },
    compiling_pdf: { icon: '🖨️', text: 'Compiling final PDF (WeasyPrint)' },

    // Typo scan stages
    scanning: { icon: '🔍', text: 'Scanning text for potential typos' },
    analyzing_chunk: { icon: '📝', text: 'Sending text chunk to AI for analysis' },
    processing_results: { icon: '📋', text: 'Processing AI corrections' },

    // Blurb generation
    generating_blurb: { icon: '✍️', text: 'AI is writing a synopsis from your book text' },

    // Image generation
    sending_prompt: { icon: '📤', text: 'Sending image prompt to AI provider' },
    generating_image: { icon: '🎨', text: 'AI is rendering your cover image' },
    downloading: { icon: '📥', text: 'Downloading generated image' },
    saving: { icon: '💾', text: 'Saving image to project storage' },
    upscaling: { icon: '⬆️', text: 'Upscaling image to print resolution (1600×2400)' },

    // Generic
    unknown: { icon: '⏳', text: 'Processing...' },
    complete: { icon: '✅', text: 'Complete!' },
    failed: { icon: '❌', text: 'Task failed' },
};

/**
 * Get stage indicator info for a given stage name.
 * @param {string} stage - Stage identifier from backend
 * @param {object} extraContext - Additional context (e.g. {chapter: 3, total: 10})
 * @returns {{icon: string, text: string}}
 */
export function getStageInfo(stage, extraContext = {}) {
    const base = STAGE_INDICATORS[stage] || STAGE_INDICATORS.unknown;
    let text = base.text;

    // Enrich with context
    if (stage === 'analyzing_chapters' && extraContext.current && extraContext.total) {
        text = `Sending chapter ${extraContext.current}/${extraContext.total} to AI for visual analysis`;
    }
    if (stage === 'analyzing_chunk' && extraContext.current && extraContext.total) {
        text = `Sending text chunk ${extraContext.current}/${extraContext.total} to AI for typo analysis`;
    }

    return { icon: base.icon, text };
}

/**
 * Estimated durations for different AI tasks (in seconds).
 * These are guesstimates based on typical CPU inference times.
 */
export const TASK_ESTIMATES = {
    cover_prompts: 180,      // ~3 minutes (reads all chapters, multiple AI calls)
    cover_image: 30,         // ~30 seconds (single image generation call)
    blurb_generation: 90,    // ~1.5 minutes (reads text, generates synopsis)
    typo_scan: 240,          // ~4 minutes (scans all text in chunks)
    typeset: 45,             // ~45 seconds (template rendering + PDF compilation)
};

/**
 * Ensure the shimmer CSS keyframes are injected into the page.
 */
function ensureShimmerStyle() {
    if (!document.getElementById('shimmer-style')) {
        const style = document.createElement('style');
        style.id = 'shimmer-style';
        style.textContent = '@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
        document.head.appendChild(style);
    }
}
