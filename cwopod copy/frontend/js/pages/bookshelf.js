/**
 * Bookshelf page — paginated project list with filtering, drag-drop, batch ordering.
 */

import { api } from '../api.js';
import { showError, showSuccess, clearMessages, setLoading, renderStatusBadge, escapeHtml } from '../dom.js';
import { navigate } from '../router.js';
import { addressPickerHtml, initAddressPicker, getSelectedShippingAddress, saveCustomAddressIfRequested } from '../address-picker.js';

export async function render($container, params) {
    console.log('[Bookshelf] Rendering bookshelf page');

    let currentPage = 1;
    let currentFilter = '';
    let batchMode = false;
    let selectedIds = new Set();

    $container.html(`
        <h1>Bookshelf</h1>
        <div class="actions" style="margin-bottom:1rem;">
            <select id="status-filter" style="width:auto;">
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="typeset">Typeset</option>
                <option value="cover_ready">Cover Ready</option>
                <option value="print_ready">Print Ready</option>
                <option value="ordered">Ordered</option>
                <option value="shipped">Shipped</option>
            </select>
            <button class="btn btn-sm secondary" id="batch-toggle">Batch Order</button>
        </div>
        <div id="bookshelf-list"></div>
        <div id="pagination" style="margin-top:1rem;"></div>
        <div id="batch-panel" style="display:none; margin-top:1.5rem;"></div>
    `);

    // Filter change — delegated
    $(document).off('change.bookshelffilter');
    $(document).on('change.bookshelffilter', '#status-filter', function () {
        currentFilter = $(this).val();
        currentPage = 1;
        console.log('[Bookshelf] Filter changed to:', currentFilter || 'all');
        loadProjects();
    });

    // Batch toggle — delegated
    $(document).off('click.bookshelftoggle');
    $(document).on('click.bookshelftoggle', '#batch-toggle', function () {
        batchMode = !batchMode;
        selectedIds.clear();
        console.log('[Bookshelf] Batch mode:', batchMode);
        $(this).text(batchMode ? 'Cancel Batch' : 'Batch Order');
        $container.find('#batch-panel').toggle(batchMode);
        if (batchMode) renderBatchPanel();
        loadProjects();
    });

    await loadProjects();

    async function loadProjects() {
        const $list = $container.find('#bookshelf-list');
        $list.html('<p class="loading">Loading...</p>');

        let url = `/bookshelf?page=${currentPage}&per_page=50`;
        if (currentFilter) url += `&status=${currentFilter}`;
        console.log('[Bookshelf] Fetching:', url);

        try {
            const data = await api.get(url);
            console.log('[Bookshelf] Loaded:', data.items?.length, 'items, page', data.page, 'of', data.total_pages);
            renderList($list, data);
            renderPagination(data);
        } catch (err) {
            console.error('[Bookshelf] Load failed:', err.message);
            $list.empty();
            showError($list, 'Failed to load bookshelf: ' + err.message);
        }
    }

    function renderFileLinks(p) {
        const links = [];

        // Link to original source (external URL)
        if (p.source_url) {
            links.push(`<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener" class="btn btn-xs file-link" title="Original source text">📄 Source</a>`);
        }

        // Download original text file
        if (p.has_original_text) {
            links.push(`<a href="/api/projects/${escapeHtml(p.id)}/source-file" target="_blank" class="btn btn-xs file-link" title="Download original text file">📥 Text</a>`);
        }

        // Download interior PDF
        if (p.has_interior_pdf) {
            links.push(`<a href="/api/projects/${escapeHtml(p.id)}/interior-pdf" target="_blank" class="btn btn-xs file-link" title="Download interior PDF">📖 Interior</a>`);
        }

        // Download cover PDF
        if (p.has_cover_pdf) {
            links.push(`<a href="/api/projects/${escapeHtml(p.id)}/cover/pdf" target="_blank" class="btn btn-xs file-link" title="Download cover PDF">🎨 Cover</a>`);
        }

        if (links.length === 0) return '';
        return `<div class="project-file-links" style="display:flex; gap:0.25rem; flex-wrap:wrap;">${links.join('')}</div>`;
    }

    function renderList($list, data) {
        const items = data.items || [];
        if (items.length === 0) {
            $list.html('<p>No projects found.</p>');
            return;
        }

        let html = '<ul class="project-list">';
        for (const p of items) {
            const checkbox = batchMode ? `<input type="checkbox" class="batch-check" data-id="${escapeHtml(p.id)}" ${selectedIds.has(p.id) ? 'checked' : ''}>` : '';
            const fileLinks = renderFileLinks(p);
            html += `
                <li class="project-item" data-id="${escapeHtml(p.id)}" draggable="true">
                    ${checkbox}
                    <div style="flex:1;">
                        <span class="project-item-title">${escapeHtml(p.title)}</span>
                        <span class="project-item-author">by ${escapeHtml(p.author || 'Unknown Author')}</span>
                        ${fileLinks}
                    </div>
                    ${renderStatusBadge(p.status)}
                    <div class="project-actions" style="margin-left:0.5rem; display:flex; gap:0.25rem;">
                        <button class="btn btn-sm secondary btn-duplicate" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}" title="Duplicate project">⧉</button>
                        <button class="btn btn-sm btn-danger btn-delete" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}" title="Delete project">✕</button>
                    </div>
                </li>
            `;
        }
        html += '</ul>';
        $list.html(html);

        // Click to navigate (if not batch mode)
        if (!batchMode) {
            $list.find('.project-item').on('click', function (e) {
                // Don't navigate if clicking a file link or action button
                if ($(e.target).closest('.file-link, .project-actions, .batch-check').length) return;
                navigate(`/projects/${$(this).data('id')}`);
            });
        }

        // Batch checkboxes
        $list.find('.batch-check').on('change', function (e) {
            e.stopPropagation();
            const id = $(this).data('id');
            if ($(this).is(':checked')) { selectedIds.add(id); } else { selectedIds.delete(id); }
            console.log('[Bookshelf] Selection changed, count:', selectedIds.size);
            updateBatchPanel();
        });

        // Duplicate button
        $list.find('.btn-duplicate').on('click', async function (e) {
            e.stopPropagation();
            const id = $(this).data('id');
            const title = $(this).data('title');
            console.log('[Bookshelf] Duplicate clicked for project:', id, title);

            const $btn = $(this);
            $btn.prop('disabled', true).text('…');

            try {
                const result = await api.post(`/projects/${id}/duplicate`);
                console.log('[Bookshelf] Duplicate created:', result);
                showSuccess($container, `Duplicated "${title}" → "${result.title}"`);
                await loadProjects();
            } catch (err) {
                console.error('[Bookshelf] Duplicate failed:', err.message);
                showError($container, 'Failed to duplicate: ' + err.message);
                $btn.prop('disabled', false).text('⧉');
            }
        });

        // Delete button
        $list.find('.btn-delete').on('click', async function (e) {
            e.stopPropagation();
            const id = $(this).data('id');
            const title = $(this).data('title');
            console.log('[Bookshelf] Delete clicked for project:', id, title);

            if (!confirm(`Delete "${title}"? This cannot be undone.`)) {
                console.log('[Bookshelf] Delete cancelled by user');
                return;
            }

            const $btn = $(this);
            $btn.prop('disabled', true).text('…');

            try {
                await api.delete(`/projects/${id}`);
                console.log('[Bookshelf] Project deleted:', id);
                showSuccess($container, `Deleted "${title}"`);
                await loadProjects();
            } catch (err) {
                console.error('[Bookshelf] Delete failed:', err.message);
                showError($container, 'Failed to delete: ' + err.message);
                $btn.prop('disabled', false).text('✕');
            }
        });

        // Drag and drop
        setupDragDrop($list);
    }

    function renderPagination(data) {
        const $pag = $container.find('#pagination');
        if (!data.total_pages || data.total_pages <= 1) { $pag.empty(); return; }

        $pag.html(`
            <div class="actions" style="justify-content:center;">
                <button class="btn btn-sm secondary" id="prev-page" ${currentPage <= 1 ? 'disabled' : ''}>← Previous</button>
                <span style="padding:0.5rem;">Page ${data.page} of ${data.total_pages}</span>
                <button class="btn btn-sm secondary" id="next-page" ${currentPage >= data.total_pages ? 'disabled' : ''}>Next →</button>
            </div>
        `);

        $pag.find('#prev-page').on('click', () => { currentPage--; loadProjects(); });
        $pag.find('#next-page').on('click', () => { currentPage++; loadProjects(); });
    }

    function renderBatchPanel() {
        $container.find('#batch-panel').html(`
            <div class="panel">
                <h3>Batch Order</h3>
                <p id="batch-count" class="hint">Select at least 2 projects</p>
                <div class="form-group">
                    <label>Provider</label>
                    <select id="batch-provider"><option value="lulu">Lulu xPress</option><option value="bookvault">BookVault</option><option value="kdp">KDP</option></select>
                </div>
                <div id="batch-address-picker">
                    ${addressPickerHtml()}
                </div>
                <div class="actions">
                    <button class="btn secondary" id="batch-estimate" disabled>Get Pricing Estimate</button>
                    <button class="btn primary" id="batch-submit" disabled>Submit Order</button>
                </div>
                <div id="batch-pricing" style="margin-top:1rem;"></div>
            </div>
        `);

        // Initialize the shared address picker (fetches saved addresses, wires events)
        initAddressPicker($container.find('#batch-address-picker'));

        $container.find('#batch-estimate').on('click', getBatchEstimate);
        $container.find('#batch-submit').on('click', submitBatchOrder);
    }

    function updateBatchPanel() {
        const enabled = selectedIds.size >= 2;
        $container.find('#batch-count').text(`${selectedIds.size} projects selected`);
        $container.find('#batch-estimate, #batch-submit').prop('disabled', !enabled);
    }

    async function getBatchEstimate() {
        const $btn = $container.find('#batch-estimate');
        const $pricing = $container.find('#batch-pricing');
        const $addrPicker = $container.find('#batch-address-picker');
        setLoading($btn, true, 'Getting estimate...');
        clearMessages($pricing);

        try {
            const shippingAddr = getSelectedShippingAddress($addrPicker);
            console.log('[Bookshelf] Batch estimate with address:', shippingAddr);
            if (!shippingAddr.city) {
                throw new Error('Please select or enter a shipping address with at least a city.');
            }
            const data = await api.post('/bookshelf/batch-order', {
                action: 'estimate',
                project_ids: Array.from(selectedIds),
                provider: $container.find('#batch-provider').val(),
                shipping_address: shippingAddr
            });
            console.log('[Bookshelf] Batch estimate:', data);
            $pricing.html(`
                <div class="pricing-box">
                    <h4>Pricing Estimate</h4>
                    <div class="pricing-row"><span>Subtotal:</span><span>${data.currency || 'USD'} ${(data.subtotal || 0).toFixed(2)}</span></div>
                    <div class="pricing-row"><span>Shipping:</span><span>${data.currency || 'USD'} ${(data.shipping || 0).toFixed(2)}</span></div>
                    <div class="pricing-row total"><span>Total:</span><span>${data.currency || 'USD'} ${(data.total || 0).toFixed(2)}</span></div>
                </div>
            `);
        } catch (err) {
            console.error('[Bookshelf] Estimate failed:', err.message);
            showError($pricing, err.message);
        } finally {
            setLoading($btn, false);
        }
    }

    async function submitBatchOrder() {
        const $btn = $container.find('#batch-submit');
        const $pricing = $container.find('#batch-pricing');
        const $addrPicker = $container.find('#batch-address-picker');
        setLoading($btn, true, 'Submitting...');
        clearMessages($pricing);

        try {
            const shippingAddr = getSelectedShippingAddress($addrPicker);
            console.log('[Bookshelf] Batch order with address:', shippingAddr);
            if (!shippingAddr.city) {
                throw new Error('Please select or enter a shipping address with at least a city.');
            }

            // Save custom address if user requested it
            await saveCustomAddressIfRequested($addrPicker);

            const shippingStr = `${shippingAddr.name}\n${shippingAddr.street1}${shippingAddr.street2 ? '\n' + shippingAddr.street2 : ''}\n${shippingAddr.city}${shippingAddr.state ? ', ' + shippingAddr.state : ''} ${shippingAddr.postal_code}\n${shippingAddr.country}`;
            const data = await api.post('/bookshelf/batch-order', {
                action: 'submit',
                project_ids: Array.from(selectedIds),
                provider: $container.find('#batch-provider').val(),
                shipping_address: shippingStr
            });
            console.log('[Bookshelf] Batch order submitted:', data);
            showSuccess($pricing, `Order submitted for ${selectedIds.size} books!`);
            setLoading($btn, false);
            $container.find('#batch-estimate, #batch-submit').prop('disabled', true);
        } catch (err) {
            console.error('[Bookshelf] Batch order failed:', err.message);
            showError($pricing, err.message);
            setLoading($btn, false);
        }
    }

    function setupDragDrop($list) {
        let draggedId = null;

        $list.find('.project-item').on('dragstart', function (e) {
            draggedId = $(this).data('id');
            $(this).addClass('dragging');
            console.log('[Bookshelf] Drag start:', draggedId);
        });

        $list.find('.project-item').on('dragend', function () {
            $(this).removeClass('dragging');
            $list.find('.drag-over').removeClass('drag-over');
        });

        $list.find('.project-item').on('dragover', function (e) {
            e.preventDefault();
            $(this).addClass('drag-over');
        });

        $list.find('.project-item').on('dragleave', function () {
            $(this).removeClass('drag-over');
        });

        $list.find('.project-item').on('drop', async function (e) {
            e.preventDefault();
            $(this).removeClass('drag-over');
            const targetId = $(this).data('id');
            if (draggedId === targetId) return;

            console.log('[Bookshelf] Drop:', draggedId, 'onto', targetId);

            // Reorder in DOM
            const $dragged = $list.find(`[data-id="${draggedId}"]`);
            $dragged.insertBefore($(this));

            // Persist order
            const newOrder = [];
            $list.find('.project-item').each(function () { newOrder.push($(this).data('id')); });

            try {
                await api.patch('/bookshelf/order', { project_ids: newOrder });
                console.log('[Bookshelf] Order persisted');
            } catch (err) {
                console.error('[Bookshelf] Reorder failed:', err.message);
                showError($list, 'Failed to save new order: ' + err.message);
            }
        });
    }
}
