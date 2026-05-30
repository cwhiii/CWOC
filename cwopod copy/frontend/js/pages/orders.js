/**
 * Order History page — displays all past print orders with full details.
 * Shows what was ordered, when, from which provider, shipping address, and cost.
 */

import { api } from '../api.js';
import { showError, escapeHtml } from '../dom.js';

export async function render($container) {
    console.log('[Orders] Rendering order history page');
    $container.html(`
        <div class="panel">
            <h1>Order History</h1>
            <p class="hint">All your print orders, including cost, provider, and shipping details.</p>
            <div id="orders-list"><p class="loading">Loading orders...</p></div>
        </div>
    `);

    try {
        const data = await api.get('/print/orders');
        console.log('[Orders] Loaded orders:', data.orders.length);
        renderOrderList($container.find('#orders-list'), data.orders);
    } catch (err) {
        console.error('[Orders] Failed to load orders:', err.message);
        showError($container.find('#orders-list'), 'Failed to load order history: ' + err.message);
    }
}

function renderOrderList($el, orders) {
    if (!orders || orders.length === 0) {
        $el.html('<p class="hint">No orders yet. Once you place a print order, it will appear here.</p>');
        return;
    }

    let html = '';
    for (const order of orders) {
        html += renderOrderCard(order);
    }
    $el.html(html);
    console.log('[Orders] Rendered', orders.length, 'order cards');
}

function renderOrderCard(order) {
    const date = order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Unknown date';

    const providerLabel = {
        lulu: 'Lulu xPress',
        bookvault: 'BookVault',
        kdp: 'KDP Print',
    }[order.provider] || order.provider;

    const statusClass = {
        pending: 'badge-pending',
        submitted: 'badge-progress',
        printing: 'badge-progress',
        shipped: 'badge-done',
        delivered: 'badge-done',
        failed: 'badge-failed',
    }[order.status] || 'badge-pending';

    const statusLabel = order.status ? order.status.replace(/_/g, ' ') : 'unknown';

    // Format cost
    let costHtml = '<span class="hint">Cost not recorded</span>';
    if (order.total_price != null) {
        const currency = order.currency || 'USD';
        const shippingCost = order.shipping_cost != null ? order.shipping_cost.toFixed(2) : '—';
        costHtml = `
            <span class="order-cost">${escapeHtml(currency)} ${order.total_price.toFixed(2)}</span>
            <span class="hint" style="margin-left:0.5rem;">(shipping: ${escapeHtml(currency)} ${shippingCost})</span>
        `;
    }

    // Format shipping address
    let addressHtml = '';
    if (order.shipping_address && typeof order.shipping_address === 'object') {
        const addr = order.shipping_address;
        const parts = [addr.name, addr.street1, addr.street2, `${addr.city || ''}${addr.state ? ', ' + addr.state : ''} ${addr.postal_code || ''}`, addr.country].filter(Boolean);
        addressHtml = parts.map(p => escapeHtml(p)).join('<br>');
    } else if (order.shipping_address && typeof order.shipping_address === 'string') {
        addressHtml = escapeHtml(order.shipping_address).replace(/\n/g, '<br>');
    }

    // Format items
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        itemsHtml = '<ul class="order-items-list">';
        for (const item of order.items) {
            const title = item.title || 'Untitled';
            const author = item.author || '';
            const qty = item.quantity || 1;
            const unitPrice = item.unit_price != null ? ` — ${order.currency || 'USD'} ${item.unit_price.toFixed(2)} each` : '';
            const link = item.project_id ? `<a href="/projects/${escapeHtml(item.project_id)}">${escapeHtml(title)}</a>` : escapeHtml(title);
            itemsHtml += `<li><strong>${link}</strong>${author ? ' by ' + escapeHtml(author) : ''} (×${qty}${unitPrice})</li>`;
        }
        itemsHtml += '</ul>';
    }

    return `
        <div class="order-card" style="border:1px solid var(--tan, #e0d5c8); border-radius:8px; padding:1rem; margin-bottom:1rem; background:#faf7f4;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <div>
                    <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
                    <strong style="margin-left:0.5rem;">${escapeHtml(providerLabel)}</strong>
                </div>
                <div style="font-size:0.9em; color:#666;">${escapeHtml(date)}</div>
            </div>
            <div style="margin-top:0.75rem;">
                ${itemsHtml}
            </div>
            <div style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="font-size:0.85em; color:#888; margin-bottom:0.25rem;">Cost</div>
                    ${costHtml}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.85em; color:#888; margin-bottom:0.25rem;">Shipped to</div>
                    <div style="font-size:0.9em;">${addressHtml || '<span class="hint">No address recorded</span>'}</div>
                </div>
            </div>
            ${order.provider_order_id ? `<div style="margin-top:0.5rem; font-size:0.8em; color:#999;">Provider Order ID: ${escapeHtml(order.provider_order_id)}</div>` : ''}
        </div>
    `;
}
