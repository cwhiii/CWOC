/**
 * Search page — multi-provider book search + file upload + URL paste.
 * INSANE LOGGING — every DOM operation, every event, every state change.
 */

import { api } from '../api.js';
import { showError, showSuccess, clearMessages, setLoading, escapeHtml } from '../dom.js';
import { navigate } from '../router.js';

// Module-level AbortController for the current search SSE stream.
// Aborted whenever a new search starts or the page navigates away.
let currentSearchAbort = null;

/**
 * Abort any in-flight search stream. Safe to call even if nothing is running.
 */
function abortCurrentSearch() {
    if (currentSearchAbort) {
        console.log('[Search] Aborting previous search stream');
        currentSearchAbort.abort();
        currentSearchAbort = null;
    }
}

/**
 * Parse a pasted URL and extract { provider_id, source_id } if it matches
 * a supported source site. Returns null if the URL is not recognized.
 *
 * Supported patterns:
 *   - Project Gutenberg: https://www.gutenberg.org/ebooks/12345
 *   - Standard Ebooks:   https://standardebooks.org/ebooks/author/title
 */
function parseSourceUrl(url) {
    console.log('[Search] parseSourceUrl: input=', url);
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^www\./, '');
        const path = parsed.pathname;

        // Project Gutenberg: /ebooks/{numeric_id}
        if (host === 'gutenberg.org') {
            const match = path.match(/^\/ebooks\/(\d+)/);
            if (match) {
                console.log('[Search] parseSourceUrl: matched Gutenberg, id=', match[1]);
                return { provider_id: 'gutenberg', source_id: match[1] };
            }
        }

        // Standard Ebooks: /ebooks/{author}/{title}[/...]
        if (host === 'standardebooks.org') {
            const match = path.match(/^\/ebooks\/(.+)/);
            if (match) {
                // source_id is the path after /ebooks/ (e.g., "jane-austen/pride-and-prejudice")
                const sourceId = match[1].replace(/\/$/, ''); // strip trailing slash
                console.log('[Search] parseSourceUrl: matched Standard Ebooks, id=', sourceId);
                return { provider_id: 'standard_ebooks', source_id: sourceId };
            }
        }

        console.log('[Search] parseSourceUrl: URL not recognized as a supported source');
        return null;
    } catch (e) {
        console.log('[Search] parseSourceUrl: invalid URL, error=', e.message);
        return null;
    }
}

export async function render($container, params) {
    console.log('[Search] ========================================');
    console.log('[Search] render() called');
    console.log('[Search] $container exists:', !!$container, '$container.length:', $container.length);
    console.log('[Search] params:', JSON.stringify(params));
    console.log('[Search] ========================================');

    // Abort any leftover search from a previous render of this page
    abortCurrentSearch();

    // Listen for navigation-away cleanup event from the router
    const cleanupHandler = () => {
        console.log('[Search] Received search-page-cleanup event, aborting in-flight search');
        abortCurrentSearch();
        window.removeEventListener('search-page-cleanup', cleanupHandler);
    };
    window.addEventListener('search-page-cleanup', cleanupHandler);

    console.log('[Search] Building HTML template...');
    const html = `
        <h1>Create New Project</h1>
        <nav class="steps">
            <button class="step active" data-step="0"><span class="step-number">1</span><span class="step-label">Source</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="1" disabled><span class="step-number">2</span><span class="step-label">Import</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="2" disabled><span class="step-number">3</span><span class="step-label">Print Size</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="3" disabled><span class="step-number">4</span><span class="step-label">Profanity Filter</span><span class="step-optional">optional</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="4" disabled><span class="step-number">5</span><span class="step-label">Typo Check</span><span class="step-optional">optional</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="5" disabled><span class="step-number">6</span><span class="step-label">Illustrations</span><span class="step-optional">optional</span></button>
            <div class="step-connector"></div>
            <button class="step" data-step="6" disabled><span class="step-number">7</span><span class="step-label">Typeset</span></button>
            <div class="step-connector"></div>
            <div class="step-group">
                <div class="step-group-items">
                    <button class="step" data-step="7" disabled><span class="step-number">8</span><span class="step-label">Prompts</span></button>
                    <div class="step-connector"></div>
                    <button class="step" data-step="8" disabled><span class="step-number">9</span><span class="step-label">Images</span></button>
                    <div class="step-connector"></div>
                    <button class="step" data-step="9" disabled><span class="step-number">10</span><span class="step-label">Builder</span></button>
                </div>
                <span class="step-group-label">Cover</span>
            </div>
            <div class="step-connector"></div>
            <button class="step" data-step="10" disabled><span class="step-number">11</span><span class="step-label">Print</span></button>
        </nav>
        <div class="panel">
            <h2>Search for Books</h2>
            <form id="search-form" class="actions" style="margin-bottom:1rem;">
                <input type="text" id="search-input" placeholder="Search by title or author..." style="flex:1;">
                <button type="submit" class="btn primary">Search</button>
                <button type="button" id="random-book-btn" class="btn" title="Find a random book">🎲 Random</button>
                <button type="button" id="search-mode-toggle" class="btn" title="Toggle between live Gutendex API and local cache" style="font-size:0.8rem; min-width:5rem;">🌐 Live</button>
            </form>
            <div id="search-results"></div>
        </div>
        <div class="panel" style="margin-top:1.5rem;">
            <h2>Import from URL</h2>
            <p class="hint" style="margin-bottom:0.75rem;">Paste a link from a supported site to import directly.</p>
            <p class="hint" style="margin-bottom:0.75rem; font-size:0.8rem; color:#666;">
                Supported: <strong>Project Gutenberg</strong> (gutenberg.org/ebooks/…) &nbsp;|&nbsp;
                <strong>Standard Ebooks</strong> (standardebooks.org/ebooks/…)
            </p>
            <form id="url-import-form" class="actions" style="margin-bottom:0;">
                <input type="url" id="url-import-input" placeholder="https://www.gutenberg.org/ebooks/1342" style="flex:1;">
                <button type="submit" class="btn primary">Import</button>
            </form>
            <div id="url-import-status" style="margin-top:0.75rem;"></div>
        </div>
        <div class="panel" style="margin-top:1.5rem;">
            <h2>Upload Your Own File</h2>
            <p class="hint" style="margin-bottom:0.75rem;">Accepted formats: EPUB, DOCX, TXT, HTML, PDF (max 200 MB)</p>
            <input type="file" id="file-upload" accept=".epub,.docx,.txt,.html,.htm,.pdf">
            <div id="upload-status" style="margin-top:0.75rem;"></div>
        </div>
    `;
    console.log('[Search] HTML template built, length:', html.length, 'chars');

    console.log('[Search] Injecting HTML into $container...');
    console.log('[Search] $container[0].id:', $container[0] ? $container[0].id : 'NO ELEMENT');
    console.log('[Search] $container[0].tagName:', $container[0] ? $container[0].tagName : 'NO ELEMENT');
    $container.html(html);
    console.log('[Search] HTML injected successfully');
    console.log('[Search] $container.html() length:', $container.html().length);
    console.log('[Search] Verifying DOM elements exist AFTER injection...');
    console.log('[Search]   #search-form via $container.find():', $container.find('#search-form').length);
    console.log('[Search]   #search-form via document.getElementById():', !!document.getElementById('search-form'));
    console.log('[Search]   #search-input via $container.find():', $container.find('#search-input').length);
    console.log('[Search]   #search-results via $container.find():', $container.find('#search-results').length);
    console.log('[Search]   #file-upload via $container.find():', $container.find('#file-upload').length);
    console.log('[Search]   #upload-status via $container.find():', $container.find('#upload-status').length);

    // Connectivity check (non-blocking, just for diagnostics)
    console.log('[Search] Starting connectivity check (non-blocking)...');
    api.get('/health/connectivity').then(health => {
        console.log('[Search] Connectivity check SUCCESS:', JSON.stringify(health));
    }).catch(err => {
        console.warn('[Search] Connectivity check FAILED (non-critical):', err.message);
        console.warn('[Search] This is expected if /api/health/connectivity endpoint does not exist');
    });

    // Bind search form submit — using delegated event on document for maximum reliability
    console.log('[Search] Binding search form submit handler via document delegation...');
    
    // Search mode state: 'live' = hit Gutendex API directly, 'cache' = use local DB
    let searchMode = 'live';

    // Remove any previous handlers (in case page is re-rendered)
    $(document).off('submit.searchpage');
    $(document).on('submit.searchpage', '#search-form', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[Search] ---- SEARCH FORM SUBMITTED (delegated handler) ----');

        // Cancel any in-flight search before starting a new one
        abortCurrentSearch();

        const query = $container.find('#search-input').val().trim();
        console.log('[Search] Query value:', JSON.stringify(query));
        console.log('[Search] Query length:', query.length);

        const $results = $container.find('#search-results');
        console.log('[Search] $results element found:', $results.length > 0);
        clearMessages($results);

        if (query.length < 2) {
            console.log('[Search] Query too short (< 2 chars), showing validation error');
            showError($results, 'Please enter at least 2 characters to search.');
            return;
        }

        console.log('[Search] Query valid, showing initial loading state...');
        $results.html(`
            <div id="search-provider-status" style="margin-bottom:1rem;"></div>
            <div id="search-results-list"></div>
            <div id="search-pending" style="text-align:center; padding:1.5rem 0;">
                <div class="spinner"></div>
                <p id="search-pending-label" style="margin-top:0.75rem; font-weight:500;">Connecting...</p>
            </div>
            <div id="search-provider-failures" style="margin-top:1rem;"></div>
        `);

        const sseUrl = `/api/search/stream?q=${encodeURIComponent(query)}&mode=${searchMode}`;
        console.log('[Search] Opening SSE stream:', sseUrl, '(mode=' + searchMode + ')');

        // Create a new AbortController for this search
        const abortController = new AbortController();
        currentSearchAbort = abortController;

        try {
            const response = await fetch(sseUrl, { credentials: 'include', signal: abortController.signal });
            console.log('[Search] SSE response status:', response.status);

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Search] SSE connection failed:', response.status, errText);
                let errData;
                try { errData = JSON.parse(errText); } catch { errData = { detail: errText || 'Search failed' }; }
                $results.empty();
                showError($results, 'Search failed: ' + (errData.detail || `HTTP ${response.status}`));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let allResults = [];
            let pendingProviders = [];
            let completedProviders = [];
            let failedProviders = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[Search] SSE stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);
                    let event;
                    try {
                        event = JSON.parse(jsonStr);
                    } catch (e) {
                        console.warn('[Search] Failed to parse SSE event:', jsonStr);
                        continue;
                    }

                    console.log('[Search] SSE event:', event.event, event.provider_id || '');

                    if (event.event === 'search_start') {
                        pendingProviders = event.providers.map(p => p.provider_name);
                        console.log('[Search] Providers to search:', pendingProviders);
                        const $pending = $results.find('#search-pending-label');
                        $pending.text('Searching ' + pendingProviders.join(', ') + '...');
                        // Show per-provider status badges
                        const statusHtml = event.providers.map(p =>
                            `<span class="provider-badge" id="prov-status-${escapeHtml(p.provider_id)}" style="opacity:0.6;">⏳ ${escapeHtml(p.provider_name)}</span> `
                        ).join('');
                        $results.find('#search-provider-status').html(statusHtml);
                    }

                    if (event.event === 'provider_done') {
                        console.log('[Search] Provider done:', event.provider_name, 'results:', event.result_count);
                        completedProviders.push(event.provider_name);
                        pendingProviders = pendingProviders.filter(n => n !== event.provider_name);

                        // Update status badge
                        const $badge = $results.find(`#prov-status-${event.provider_id}`);
                        $badge.css('opacity', '1').html(`✅ ${escapeHtml(event.provider_name)}: ${event.result_count} results`);

                        // Append results to the list
                        if (event.results && event.results.length > 0) {
                            allResults = allResults.concat(event.results);
                            const $list = $results.find('#search-results-list');
                            for (const r of event.results) {
                                const sourceLink = r.source_url
                                    ? `<a href="${escapeHtml(r.source_url)}" target="_blank" class="search-result-title">${escapeHtml(r.title)}</a>`
                                    : `<span class="search-result-title">${escapeHtml(r.title)}</span>`;
                                const yearStr = r.publication_year ? ` (${escapeHtml(String(r.publication_year))})` : '';
                                // Build media type badge (e.g., "Text", "Sound" for audiobooks)
                                let mediaTypeBadge = '';
                                if (r.media_type) {
                                    const mediaLabel = r.media_type === 'Sound' ? '🔊 Audiobook' : `📖 ${escapeHtml(r.media_type)}`;
                                    mediaTypeBadge = `<span class="badge badge-media">${mediaLabel}</span>`;
                                }
                                // Show download count as popularity indicator
                                const downloadsStr = r.download_count ? `<span class="search-result-downloads" title="Downloads on Project Gutenberg">${r.download_count.toLocaleString()} downloads</span>` : '';
                                $list.append(`
                                    <div class="search-result">
                                        <div class="search-result-info">
                                            ${sourceLink}
                                            <span class="search-result-author">by ${escapeHtml(r.author || 'Unknown')}${yearStr}</span>
                                            ${mediaTypeBadge}
                                            <span class="provider-badge">${escapeHtml(r.provider_name || r.provider || '')}</span>
                                            <span class="search-result-id">${escapeHtml(r.source_id || '')}</span>
                                            ${r.quality_label ? `<span class="badge badge-done">${escapeHtml(r.quality_label)}</span>` : ''}
                                            ${downloadsStr}
                                        </div>
                                        <button class="btn btn-sm primary import-btn" data-provider="${escapeHtml(r.provider_id || r.provider || '')}" data-source="${escapeHtml(r.source_id || r.id || '')}">Start Project</button>
                                    </div>
                                `);
                            }
                        }

                        // Show audiobook entries as informational note (not importable)
                        if (event.audiobooks && event.audiobooks.length > 0) {
                            console.log('[Search] Audiobooks found:', event.audiobooks.length);
                            const $list = $results.find('#search-results-list');
                            for (const ab of event.audiobooks) {
                                const abLink = ab.source_url
                                    ? `<a href="${escapeHtml(ab.source_url)}" target="_blank">${escapeHtml(ab.title)}</a>`
                                    : escapeHtml(ab.title);
                                $list.append(`
                                    <div class="search-result search-result-audiobook">
                                        <div class="search-result-info">
                                            <span class="badge badge-media">🔊 Audiobook</span>
                                            <span class="search-result-audiobook-note">Also available as a free audiobook: ${abLink} by ${escapeHtml(ab.author || 'Unknown')}</span>
                                        </div>
                                    </div>
                                `);
                            }
                        }

                        // Update pending label
                        if (pendingProviders.length > 0) {
                            $results.find('#search-pending-label').text('Searching ' + pendingProviders.join(', ') + '...');
                        }
                    }

                    if (event.event === 'provider_error') {
                        console.error('[Search] Provider error:', event.provider_name, event.error);
                        failedProviders.push({ name: event.provider_name, error: event.error });
                        pendingProviders = pendingProviders.filter(n => n !== event.provider_name);

                        // Remove the pending badge from the top status area
                        const $badge = $results.find(`#prov-status-${event.provider_id}`);
                        $badge.remove();

                        // Append failure to the bottom failures section
                        // Linkify "Settings > Book Sources" so users can navigate directly
                        let errorMsg = escapeHtml(event.error);
                        errorMsg = errorMsg.replace(
                            /Settings &gt; Book Sources/g,
                            '<a href="/settings" class="error-nav-link" data-scroll="section-sources">Settings</a> &gt; <a href="/settings" class="error-nav-link" data-scroll="section-sources">Book Sources</a>'
                        );
                        $results.find('#search-provider-failures').append(
                            `<span class="badge badge-failed">❌ ${escapeHtml(event.provider_name)}: ${errorMsg}</span> `
                        );

                        // Update pending label
                        if (pendingProviders.length > 0) {
                            $results.find('#search-pending-label').text('Searching ' + pendingProviders.join(', ') + '...');
                        }
                    }

                    if (event.event === 'complete') {
                        console.log('[Search] All providers complete. Total results:', allResults.length);
                        // Remove the pending spinner
                        $results.find('#search-pending').remove();

                        // If no results at all, show message
                        if (allResults.length === 0 && failedProviders.length === 0) {
                            $results.find('#search-results-list').html('<p>No books found for your query.</p>');
                        } else if (allResults.length === 0 && failedProviders.length > 0) {
                            $results.find('#search-results-list').html('<p>No results — all providers failed. Check the status above for details.</p>');
                        }

                        // Bind import buttons for all results
                        bindImportButtons($results);
                        return;
                    }
                }
            }

            // If stream ended without 'complete' event
            $results.find('#search-pending').remove();
            if (allResults.length === 0) {
                $results.find('#search-results-list').html('<p>No books found for your query.</p>');
            }
            bindImportButtons($results);

        } catch (err) {
            // If this search was aborted (user started a new search), don't show an error
            if (err.name === 'AbortError') {
                console.log('[Search] Search stream aborted (new search started or page navigated away)');
                return;
            }
            console.error('[Search] Search stream FAILED');
            console.error('[Search] Error message:', err.message);
            console.error('[Search] Full error:', err);
            $results.empty();
            showError($results, 'Search failed: ' + err.message);
        }
    });
    console.log('[Search] Search form handler bound');

    // Bind random book button
    console.log('[Search] Binding random book button handler...');
    $(document).off('click.randombook');
    $(document).on('click.randombook', '#random-book-btn', async function(e) {
        e.preventDefault();
        console.log('[Search] ---- RANDOM BOOK BUTTON CLICKED ----');

        const $btn = $(this);
        const $results = $container.find('#search-results');
        clearMessages($results);

        // Disable button and show loading state
        $btn.prop('disabled', true).text('🎲 ...');
        console.log('[Search] Fetching random book from /api/search/random');

        try {
            const book = await api.get('/search/random');
            console.log('[Search] Random book received:', JSON.stringify(book));

            // Display the random book as a single search result
            const yearStr = book.publication_year ? ` (${escapeHtml(String(book.publication_year))})` : '';
            const sourceLink = book.source_url
                ? `<a href="${escapeHtml(book.source_url)}" target="_blank" class="search-result-title">${escapeHtml(book.title)}</a>`
                : `<span class="search-result-title">${escapeHtml(book.title)}</span>`;
            const downloadsStr = book.download_count ? `<span class="search-result-downloads" title="Downloads on Project Gutenberg">${book.download_count.toLocaleString()} downloads</span>` : '';

            $results.html(`
                <p style="margin-bottom:0.75rem; font-style:italic; color:#666;">🎲 Here's a random book for you:</p>
                <div class="search-result">
                    <div class="search-result-info">
                        ${sourceLink}
                        <span class="search-result-author">by ${escapeHtml(book.author || 'Unknown')}${yearStr}</span>
                        <span class="provider-badge">${escapeHtml(book.provider_name || '')}</span>
                        ${book.quality_label ? `<span class="badge badge-done">${escapeHtml(book.quality_label)}</span>` : ''}
                        ${downloadsStr}
                    </div>
                    <button class="btn btn-sm primary import-btn" data-provider="${escapeHtml(book.provider_id || '')}" data-source="${escapeHtml(book.source_id || '')}">Start Project</button>
                </div>
            `);

            // Bind the import button
            bindImportButtons($results);

        } catch (err) {
            console.error('[Search] Random book FAILED:', err.message);
            console.error('[Search] Full error:', err);
            if (err.message && err.message.includes('503')) {
                showError($results, 'The book catalog is still being loaded. Try again in a few minutes.');
            } else {
                showError($results, 'Failed to get random book: ' + err.message);
            }
        } finally {
            $btn.prop('disabled', false).text('🎲 Random');
        }
    });
    console.log('[Search] Random book button handler bound');

    // Search mode toggle: Live (hits Gutendex API directly) vs Cache (uses local DB)
    console.log('[Search] Binding search mode toggle handler...');
    $(document).off('click.searchmodetoggle');
    $(document).on('click.searchmodetoggle', '#search-mode-toggle', function(e) {
        e.preventDefault();
        const $btn = $(this);
        if (searchMode === 'live') {
            searchMode = 'cache';
            $btn.html('💾 Cache');
            $btn.attr('title', 'Using local cache (fast, fuzzy). Click to switch to live API.');
            console.log('[Search] Mode toggled to: cache');
        } else {
            searchMode = 'live';
            $btn.html('🌐 Live');
            $btn.attr('title', 'Using live Gutendex API (slower, complete). Click to switch to local cache.');
            console.log('[Search] Mode toggled to: live');
        }
    });
    console.log('[Search] Search mode toggle handler bound');

    // Handle clicks on error navigation links (e.g., "Settings > Book Sources")
    $(document).off('click.searcherrorlinks');
    $(document).on('click.searcherrorlinks', '.error-nav-link', function (e) {
        e.preventDefault();
        const scrollTarget = $(this).data('scroll');
        console.log('[Search] Error nav link clicked, navigating to /settings, scroll target:', scrollTarget);
        navigate('/settings');
        // Scroll to the target section after a short delay to allow page render
        if (scrollTarget) {
            setTimeout(() => {
                const el = document.getElementById(scrollTarget);
                if (el) {
                    console.log('[Search] Scrolling to #' + scrollTarget);
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        }
    });
    console.log('[Search] Error nav link handler bound');

    // Bind URL import form submit
    console.log('[Search] Binding URL import form handler via document delegation...');
    $(document).off('submit.searchurlimport');
    $(document).on('submit.searchurlimport', '#url-import-form', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[Search] ---- URL IMPORT FORM SUBMITTED ----');

        const url = $container.find('#url-import-input').val().trim();
        const $status = $container.find('#url-import-status');
        console.log('[Search] URL value:', JSON.stringify(url));
        clearMessages($status);

        if (!url) {
            console.log('[Search] Empty URL, showing validation error');
            showError($status, 'Please paste a URL.');
            return;
        }

        const parsed = parseSourceUrl(url);
        if (!parsed) {
            console.log('[Search] URL not recognized as a supported source');
            showError($status, 'URL not recognized. Supported sites: gutenberg.org/ebooks/… and standardebooks.org/ebooks/…');
            return;
        }

        console.log('[Search] URL parsed successfully:', JSON.stringify(parsed));
        console.log('[Search] Starting import from URL: provider=', parsed.provider_id, 'source_id=', parsed.source_id);

        // Cancel any in-flight search (not strictly necessary but keeps things clean)
        abortCurrentSearch();

        // Update step bubbles: Source done, Import active
        $container.find('.step[data-step="0"]').removeClass('active').addClass('done');
        $container.find('.step[data-step="1"]').addClass('active');
        $container.find('.steps .step-connector').first().addClass('done');

        // Show import progress in the search results area (reuse the same import UI)
        const $results = $container.find('#search-results');
        $results.html(`
            <div class="import-progress" style="padding:1.5rem 0; max-width:600px; margin:0 auto;">
                <h3 style="margin:0 0 1.5rem; text-align:center; font-size:1.1rem;">Importing from URL</h3>

                <!-- Step 1: Download -->
                <div class="import-step" id="step-downloading" style="margin-bottom:1.25rem; opacity:0.4;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                        <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                        <span class="step-label" style="font-weight:500;">Downloading</span>
                        <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                    </div>
                    <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                        <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#2563eb,#3b82f6); transition:width 0.3s ease; border-radius:4px;"></div>
                    </div>
                    <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                </div>

                <!-- Step 2: Normalize -->
                <div class="import-step" id="step-normalizing" style="margin-bottom:1.25rem; opacity:0.4;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                        <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                        <span class="step-label" style="font-weight:500;">Normalizing</span>
                        <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                    </div>
                    <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                        <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#8b5cf6,#a78bfa); transition:width 0.3s ease; border-radius:4px;"></div>
                    </div>
                    <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                </div>

                <!-- Step 3: Create Project -->
                <div class="import-step" id="step-creating" style="margin-bottom:1.25rem; opacity:0.4;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                        <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                        <span class="step-label" style="font-weight:500;">Creating Project</span>
                        <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                    </div>
                    <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                        <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#059669,#34d399); transition:width 0.3s ease; border-radius:4px;"></div>
                    </div>
                    <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                </div>

                <p class="import-elapsed" style="text-align:center; font-size:0.8rem; color:#999; margin-top:1rem;"></p>
            </div>
        `);

        const importStart = performance.now();
        const elapsedInterval = setInterval(() => {
            const elapsed = Math.round((performance.now() - importStart) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            $results.find('.import-elapsed').text(`Elapsed: ${mins}:${secs.toString().padStart(2, '0')}`);
        }, 1000);

        // Connect to the import SSE stream
        const sseUrl = `/api/projects/import/stream?provider_id=${encodeURIComponent(parsed.provider_id)}&source_id=${encodeURIComponent(parsed.source_id)}`;
        console.log('[Search] Opening import SSE connection:', sseUrl);

        try {
            const response = await fetch(sseUrl, { credentials: 'include' });
            console.log('[Search] Import SSE response status:', response.status);

            if (!response.ok) {
                clearInterval(elapsedInterval);
                const errText = await response.text();
                console.error('[Search] Import SSE connection failed:', response.status, errText);
                $results.empty();
                showError($results, 'Import failed: HTTP ' + response.status);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let lastStep = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[Search] Import SSE stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);
                    let event;
                    try {
                        event = JSON.parse(jsonStr);
                    } catch (parseErr) {
                        console.warn('[Search] Failed to parse import SSE event:', jsonStr);
                        continue;
                    }

                    console.log('[Search] Import SSE event:', event.step, event.percent, event.label);

                    const step = event.step;
                    const percent = event.percent || 0;
                    const label = event.label || '';
                    const detail = event.detail || {};

                    if (step === 'error') {
                        clearInterval(elapsedInterval);
                        console.error('[Search] Import error from server:', label);
                        $results.empty();
                        showError($results, 'Import failed: ' + label);
                        return;
                    }

                    if (step === 'complete') {
                        clearInterval(elapsedInterval);
                        console.log('[Search] Import COMPLETE:', detail);
                        $results.find('.import-step').css('opacity', '1');
                        $results.find('.step-icon').text('✅');
                        showSuccess($results.find('.import-elapsed'), 'Project created! Redirecting...');
                        const projectId = detail.project_id;
                        console.log('[Search] Redirecting to /projects/' + projectId);
                        setTimeout(() => navigate(`/projects/${projectId}`), 1000);
                        return;
                    }

                    // Update the active step
                    const $step = $results.find(`#step-${step}`);
                    if ($step.length) {
                        $step.css('opacity', '1');
                        $step.find('.step-icon').text(percent >= 100 ? '✅' : '⏳');
                        $step.find('.step-percent').text(percent + '%');
                        $step.find('.step-bar-fill').css('width', percent + '%');
                        $step.find('.step-detail').text(label);

                        if (lastStep && lastStep !== step) {
                            const $prev = $results.find(`#step-${lastStep}`);
                            $prev.find('.step-icon').text('✅');
                            $prev.find('.step-percent').text('100%');
                            $prev.find('.step-bar-fill').css('width', '100%');
                        }
                        lastStep = step;
                    }
                }
            }

            // If we get here without a 'complete' event, something went wrong
            clearInterval(elapsedInterval);
            if (!$results.find('.alert-success').length) {
                console.warn('[Search] Import SSE stream ended without complete event');
                $results.empty();
                showError($results, 'Import ended unexpectedly. Please try again.');
            }

        } catch (err) {
            clearInterval(elapsedInterval);
            console.error('[Search] URL import FAILED');
            console.error('[Search] Error message:', err.message);
            console.error('[Search] Full error:', err);
            $results.empty();
            showError($results, 'Import failed: ' + err.message);
        }
    });
    console.log('[Search] URL import form handler bound');

    // Bind file upload change via document delegation
    console.log('[Search] Binding file upload change handler via document delegation...');
    $(document).off('change.searchupload');
    $(document).on('change.searchupload', '#file-upload', async function () {
        console.log('[Search] ---- FILE INPUT CHANGED (delegated handler) ----');
        const file = this.files[0];
        console.log('[Search] files array length:', this.files.length);
        if (!file) {
            console.log('[Search] No file selected, returning');
            return;
        }

        console.log('[Search] File details:');
        console.log('[Search]   name:', file.name);
        console.log('[Search]   size:', file.size, 'bytes (', (file.size / 1024 / 1024).toFixed(2), 'MB)');
        console.log('[Search]   type:', file.type);
        console.log('[Search]   lastModified:', new Date(file.lastModified).toISOString());

        const $status = $container.find('#upload-status');
        clearMessages($status);

        // Validate extension
        const ext = file.name.split('.').pop().toLowerCase();
        console.log('[Search] File extension:', ext);
        if (!['epub', 'docx', 'txt', 'html', 'htm', 'pdf'].includes(ext)) {
            console.log('[Search] INVALID extension, rejecting');
            showError($status, 'Unsupported file format. Please use EPUB, DOCX, TXT, HTML, or PDF.');
            return;
        }
        console.log('[Search] Extension valid');

        // Validate size (200 MB)
        if (file.size > 200 * 1024 * 1024) {
            console.log('[Search] File TOO LARGE, rejecting');
            showError($status, 'File exceeds 200 MB maximum size.');
            return;
        }
        console.log('[Search] File size valid');

        // Update step bubbles: Source done, Import active
        $container.find('.step[data-step="0"]').removeClass('active').addClass('done');
        $container.find('.step[data-step="1"]').addClass('active');
        $container.find('.steps .step-connector').first().addClass('done');

        console.log('[Search] Showing upload loading state...');
        $status.html(`
            <div class="upload-loading" style="text-align:center; padding:1.5rem 0;">
                <div class="spinner"></div>
                <p style="margin-top:0.75rem; font-weight:500;">Uploading and processing file...</p>
                <p style="font-size:0.85rem; color:#666;">This may take a moment for large files.</p>
            </div>
        `);

        console.log('[Search] Building FormData...');
        const formData = new FormData();
        formData.append('file', file);
        console.log('[Search] FormData built, calling fetch POST /api/projects/upload...');

        try {
            const startTime = performance.now();
            const response = await fetch('/api/projects/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const elapsed = Math.round(performance.now() - startTime);
            console.log('[Search] Upload fetch completed in', elapsed, 'ms');
            console.log('[Search] Response status:', response.status);
            console.log('[Search] Response ok:', response.ok);

            if (!response.ok) {
                console.error('[Search] Upload response NOT OK, parsing error body...');
                const errText = await response.text();
                console.error('[Search] Error response body:', errText);
                let errData;
                try { errData = JSON.parse(errText); } catch { errData = { detail: errText || 'Upload failed' }; }
                throw new Error(errData.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[Search] Upload SUCCESS, response data:', JSON.stringify(data));
            showSuccess($status, 'File uploaded successfully! Redirecting...');
            const projectId = data.id || data.project_id;
            console.log('[Search] Redirecting to /projects/' + projectId + ' in 1 second...');
            setTimeout(() => navigate(`/projects/${projectId}`), 1000);
        } catch (err) {
            console.error('[Search] Upload FAILED');
            console.error('[Search] Error message:', err.message);
            console.error('[Search] Full error:', err);
            $status.empty();
            showError($status, 'Upload failed: ' + err.message);
        }
    });
    console.log('[Search] File upload handler bound');

    console.log('[Search] ========================================');
    console.log('[Search] Page render COMPLETE — all handlers bound, page is interactive');
    console.log('[Search] ========================================');

    function bindImportButtons($results) {
        console.log('[Search] bindImportButtons() called');
        const $importBtns = $results.find('.import-btn');
        console.log('[Search] Binding', $importBtns.length, 'import buttons...');
        $importBtns.off('click').on('click', async function () {
            const $btn = $(this);
            const providerId = $btn.attr('data-provider');
            const sourceId = $btn.attr('data-source');
            console.log('[Search] ---- IMPORT BUTTON CLICKED ----');
            console.log('[Search] providerId:', providerId, typeof providerId);
            console.log('[Search] sourceId:', sourceId, typeof sourceId);

            // Show multi-step progress UI
            console.log('[Search] Showing import progress UI...');

            // Update step bubbles: Source done, Import active
            $container.find('.step[data-step="0"]').removeClass('active').addClass('done');
            $container.find('.step[data-step="1"]').addClass('active');
            $container.find('.steps .step-connector').first().addClass('done');
            $results.html(`
                <div class="import-progress" style="padding:1.5rem 0; max-width:600px; margin:0 auto;">
                    <h3 style="margin:0 0 1.5rem; text-align:center; font-size:1.1rem;">Importing Book</h3>

                    <!-- Step 1: Download -->
                    <div class="import-step" id="step-downloading" style="margin-bottom:1.25rem; opacity:0.4;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                            <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                            <span class="step-label" style="font-weight:500;">Downloading</span>
                            <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                        </div>
                        <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                            <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#2563eb,#3b82f6); transition:width 0.3s ease; border-radius:4px;"></div>
                        </div>
                        <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                    </div>

                    <!-- Step 2: Normalize -->
                    <div class="import-step" id="step-normalizing" style="margin-bottom:1.25rem; opacity:0.4;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                            <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                            <span class="step-label" style="font-weight:500;">Normalizing</span>
                            <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                        </div>
                        <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                            <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#8b5cf6,#a78bfa); transition:width 0.3s ease; border-radius:4px;"></div>
                        </div>
                        <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                    </div>

                    <!-- Step 3: Create Project -->
                    <div class="import-step" id="step-creating" style="margin-bottom:1.25rem; opacity:0.4;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                            <span class="step-icon" style="font-size:1.1rem;">⏳</span>
                            <span class="step-label" style="font-weight:500;">Creating Project</span>
                            <span class="step-percent" style="margin-left:auto; font-size:0.85rem; color:#666;"></span>
                        </div>
                        <div class="step-bar-bg" style="background:#e0e0e0; border-radius:4px; height:8px; overflow:hidden;">
                            <div class="step-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#059669,#34d399); transition:width 0.3s ease; border-radius:4px;"></div>
                        </div>
                        <p class="step-detail" style="margin:0.3rem 0 0; font-size:0.8rem; color:#666;"></p>
                    </div>

                    <p class="import-elapsed" style="text-align:center; font-size:0.8rem; color:#999; margin-top:1rem;"></p>
                </div>
            `);

            const importStart = performance.now();
            const elapsedInterval = setInterval(() => {
                const elapsed = Math.round((performance.now() - importStart) / 1000);
                const mins = Math.floor(elapsed / 60);
                const secs = elapsed % 60;
                $results.find('.import-elapsed').text(`Elapsed: ${mins}:${secs.toString().padStart(2, '0')}`);
            }, 1000);

            // Connect to SSE stream
            const sseUrl = `/api/projects/import/stream?provider_id=${encodeURIComponent(providerId)}&source_id=${encodeURIComponent(sourceId)}`;
            console.log('[Search] Opening SSE connection:', sseUrl);

            try {
                const response = await fetch(sseUrl, { credentials: 'include' });
                console.log('[Search] SSE response status:', response.status);

                if (!response.ok) {
                    clearInterval(elapsedInterval);
                    const errText = await response.text();
                    console.error('[Search] SSE connection failed:', response.status, errText);
                    $results.empty();
                    showError($results, 'Import failed: HTTP ' + response.status);
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let lastStep = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        console.log('[Search] SSE stream ended');
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE events from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const jsonStr = line.slice(6);
                        let event;
                        try {
                            event = JSON.parse(jsonStr);
                        } catch (e) {
                            console.warn('[Search] Failed to parse SSE event:', jsonStr);
                            continue;
                        }

                        console.log('[Search] SSE event:', event.step, event.percent, event.label);

                        const step = event.step;
                        const percent = event.percent || 0;
                        const label = event.label || '';
                        const detail = event.detail || {};

                        if (step === 'error') {
                            clearInterval(elapsedInterval);
                            console.error('[Search] Import error from server:', label);
                            $results.empty();
                            showError($results, 'Import failed: ' + label);
                            return;
                        }

                        if (step === 'complete') {
                            clearInterval(elapsedInterval);
                            console.log('[Search] Import COMPLETE:', detail);
                            // Mark all steps as done
                            $results.find('.import-step').css('opacity', '1');
                            $results.find('.step-icon').text('✅');
                            showSuccess($results.find('.import-elapsed'), 'Project created! Redirecting...');
                            const projectId = detail.project_id;
                            console.log('[Search] Redirecting to /projects/' + projectId);
                            setTimeout(() => navigate(`/projects/${projectId}`), 1000);
                            return;
                        }

                        // Update the active step
                        const $step = $results.find(`#step-${step}`);
                        if ($step.length) {
                            // Activate this step
                            $step.css('opacity', '1');
                            $step.find('.step-icon').text(percent >= 100 ? '✅' : '⏳');
                            $step.find('.step-percent').text(percent + '%');
                            $step.find('.step-bar-fill').css('width', percent + '%');
                            $step.find('.step-detail').text(label);

                            // If step changed, mark previous as complete
                            if (lastStep && lastStep !== step) {
                                const $prev = $results.find(`#step-${lastStep}`);
                                $prev.find('.step-icon').text('✅');
                                $prev.find('.step-percent').text('100%');
                                $prev.find('.step-bar-fill').css('width', '100%');
                            }
                            lastStep = step;
                        }
                    }
                }

                // If we get here without a 'complete' event, something went wrong
                clearInterval(elapsedInterval);
                if (!$results.find('.alert-success').length) {
                    console.warn('[Search] SSE stream ended without complete event');
                    $results.empty();
                    showError($results, 'Import ended unexpectedly. Please try again.');
                }

            } catch (err) {
                clearInterval(elapsedInterval);
                console.error('[Search] Import SSE FAILED');
                console.error('[Search] Error message:', err.message);
                console.error('[Search] Full error:', err);
                $results.empty();
                showError($results, 'Import failed: ' + err.message);
            }
        });
        console.log('[Search] Import buttons bound');
    }
}
