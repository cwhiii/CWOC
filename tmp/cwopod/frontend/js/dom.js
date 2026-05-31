/**
 * DOM helper utilities for consistent UI patterns.
 * Uses jQuery for all DOM manipulation.
 */

/**
 * Display an error message in a container.
 * @param {jQuery|string} container - Container element or selector
 * @param {string} msg - Error message text
 */
export function showError(container, msg) {
    console.log('[DOM] showError:', msg);
    clearMessages(container);
    $(container).prepend(`<p class="error">${escapeHtml(msg)}</p>`);
}

/**
 * Display an error message with an action link (e.g. link to settings).
 * The message is escaped, but the action link is rendered as safe HTML.
 * @param {jQuery|string} container - Container element or selector
 * @param {string} msg - Error message text (will be escaped)
 * @param {object} action - { text: 'link text', href: '/path' }
 */
export function showErrorWithAction(container, msg, action) {
    console.log('[DOM] showErrorWithAction:', msg, action);
    clearMessages(container);
    const linkHtml = action ? ` <a href="${escapeHtml(action.href)}" class="error-action-link">${escapeHtml(action.text)}</a>` : '';
    $(container).prepend(`<p class="error">${escapeHtml(msg)}${linkHtml}</p>`);
}

/**
 * Display a success message in a container.
 * @param {jQuery|string} container - Container element or selector
 * @param {string} msg - Success message text
 */
export function showSuccess(container, msg) {
    console.log('[DOM] showSuccess:', msg);
    clearMessages(container);
    $(container).prepend(`<p class="success">${escapeHtml(msg)}</p>`);
}

/**
 * Clear all error/success messages from a container.
 * @param {jQuery|string} container - Container element or selector
 */
export function clearMessages(container) {
    $(container).find('.error, .success').remove();
}

/**
 * Set loading state on a button.
 * @param {jQuery|string} button - Button element or selector
 * @param {boolean} isLoading - Whether to show loading state
 * @param {string} [loadingText='Loading...'] - Text to show while loading
 */
export function setLoading(button, isLoading, loadingText = 'Loading...') {
    const $btn = $(button);
    if (isLoading) {
        $btn.data('original-text', $btn.text());
        $btn.text(loadingText).prop('disabled', true);
    } else {
        const original = $btn.data('original-text');
        if (original) $btn.text(original);
        $btn.prop('disabled', false);
    }
}

/**
 * Render a status badge HTML string.
 * @param {string} status - Project status value
 * @returns {string} HTML string for the badge
 */
export function renderStatusBadge(status) {
    const statusClasses = {
        'draft': 'badge-pending',
        'typeset': 'badge-progress',
        'cover_ready': 'badge-progress',
        'print_ready': 'badge-done',
        'ordered': 'badge-done',
        'shipped': 'badge-done',
        'delivered': 'badge-done',
        'failed': 'badge-failed'
    };
    const cls = statusClasses[status] || 'badge-pending';
    const label = status ? status.replace(/_/g, ' ') : 'unknown';
    return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - Raw string
 * @returns {string} Escaped string safe for innerHTML
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
