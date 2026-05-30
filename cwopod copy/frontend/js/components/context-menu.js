/**
 * Context Menu Component — provides right-click context menus for image thumbnails
 * in the Illustrations step.
 *
 * - Unplaced images (Available/Shared): "Insert as Full Page (Left/Right)",
 *   "Insert as Plate (Left/Right)", "Insert Inline (Left/Right)", "Delete"
 * - Placed images (In Book): "Move to page...", "Lock"/"Unlock", "Delete", "Remove from book"
 * - "Move to page..." shows page number input dialog
 * - "Delete" on extracted images shows confirmation dialog
 * - Logs all context menu selections
 *
 * Exports: ContextMenu class
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { escapeHtml } from '../dom.js';

/**
 * ContextMenu manages the display and interaction of right-click context menus
 * on image thumbnails in the Illustrations step.
 *
 * Usage:
 *   const contextMenu = new ContextMenu({ onAction: (action, imageUuid, detail) => { ... } });
 *   contextMenu.show(event, imageData);
 *   contextMenu.destroy(); // cleanup
 */
export class ContextMenu {
    /**
     * @param {object} options
     * @param {Function} options.onAction - Callback when a menu action is selected.
     *   Signature: (action, imageUuid, detail) => void
     *   Actions for unplaced: 'insert_full_page_left', 'insert_full_page_right',
     *     'insert_plate_left', 'insert_plate_right', 'insert_inline_left',
     *     'insert_inline_right', 'delete'
     *   Actions for placed: 'move_to_page', 'lock', 'unlock', 'delete', 'remove_from_book'
     */
    constructor(options) {
        this.onAction = options.onAction || (() => {});
        this._menuEl = null;
        this._boundCloseHandler = this._handleCloseEvent.bind(this);
        this._boundKeyHandler = this._handleKeyEvent.bind(this);
        console.log('[ContextMenu] Constructed');
    }

    /**
     * Show the context menu at the cursor position for the given image.
     * @param {MouseEvent} event - The contextmenu event
     * @param {object} imageData - The illustration DTO for the right-clicked image
     */
    show(event, imageData) {
        event.preventDefault();
        event.stopPropagation();

        console.log('[ContextMenu] show() called — image_uuid:', imageData.image_uuid,
            'label:', imageData.label, 'pool:', imageData.pool,
            'lock_state:', imageData.lock_state, 'source:', imageData.source,
            'placement:', imageData.placement || imageData.placement_mode || 'none');

        // Close any existing menu first
        this.close();

        // Determine which menu items to show based on pool
        const isPlaced = imageData.pool === 'in_book';
        const menuItems = isPlaced
            ? this._getPlacedMenuItems(imageData)
            : this._getUnplacedMenuItems(imageData);

        console.log('[ContextMenu] Menu items:', menuItems.map(i => i.label).join(', '));

        // Build the menu DOM
        this._menuEl = this._buildMenuElement(menuItems, imageData);

        // Position at cursor
        this._menuEl.style.left = event.clientX + 'px';
        this._menuEl.style.top = event.clientY + 'px';

        document.body.appendChild(this._menuEl);

        // Adjust position if menu overflows viewport
        this._adjustPosition();

        // Bind close handlers (click outside, Escape key)
        setTimeout(() => {
            document.addEventListener('click', this._boundCloseHandler, true);
            document.addEventListener('contextmenu', this._boundCloseHandler, true);
            document.addEventListener('keydown', this._boundKeyHandler, true);
        }, 0);

        console.log('[ContextMenu] Menu displayed at x:', event.clientX, 'y:', event.clientY);
    }

    /**
     * Close and remove the context menu from the DOM.
     */
    close() {
        if (this._menuEl) {
            console.log('[ContextMenu] close() — removing menu from DOM');
            this._menuEl.remove();
            this._menuEl = null;
        }
        document.removeEventListener('click', this._boundCloseHandler, true);
        document.removeEventListener('contextmenu', this._boundCloseHandler, true);
        document.removeEventListener('keydown', this._boundKeyHandler, true);
    }

    /**
     * Destroy the context menu instance and clean up all listeners.
     */
    destroy() {
        console.log('[ContextMenu] destroy() — cleaning up');
        this.close();
    }

    // --- Private methods ---

    /**
     * Get menu items for unplaced images (Available/Shared pools).
     * @param {object} imageData
     * @returns {Array} Array of { action, label, separator? }
     */
    _getUnplacedMenuItems(imageData) {
        console.log('[ContextMenu] _getUnplacedMenuItems for:', imageData.image_uuid);
        return [
            { action: 'insert_full_page_left', label: 'Insert as Full Page (Left)' },
            { action: 'insert_full_page_right', label: 'Insert as Full Page (Right)' },
            { separator: true },
            { action: 'insert_plate_left', label: 'Insert as Plate (Left)' },
            { action: 'insert_plate_right', label: 'Insert as Plate (Right)' },
            { separator: true },
            { action: 'insert_inline_left', label: 'Insert Inline (Left)' },
            { action: 'insert_inline_right', label: 'Insert Inline (Right)' },
            { separator: true },
            { action: 'delete', label: 'Delete' }
        ];
    }

    /**
     * Get menu items for placed images (In Book pool).
     * @param {object} imageData
     * @returns {Array} Array of { action, label, separator? }
     */
    _getPlacedMenuItems(imageData) {
        const isLocked = imageData.lock_state;
        console.log('[ContextMenu] _getPlacedMenuItems for:', imageData.image_uuid, 'locked:', isLocked);
        return [
            { action: 'move_to_page', label: 'Move to page...' },
            { separator: true },
            { action: isLocked ? 'unlock' : 'lock', label: isLocked ? 'Unlock' : 'Lock' },
            { separator: true },
            { action: 'delete', label: 'Delete' },
            { action: 'remove_from_book', label: 'Remove from book' }
        ];
    }

    /**
     * Build the menu DOM element.
     * @param {Array} items - Menu items
     * @param {object} imageData - The image DTO
     * @returns {HTMLElement}
     */
    _buildMenuElement(items, imageData) {
        const menu = document.createElement('div');
        menu.className = 'ill-context-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', `Context menu for ${imageData.label}`);

        for (const item of items) {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'ill-context-menu-separator';
                menu.appendChild(sep);
                continue;
            }

            const menuItem = document.createElement('div');
            menuItem.className = 'ill-context-menu-item';
            menuItem.setAttribute('role', 'menuitem');
            menuItem.setAttribute('data-action', item.action);
            menuItem.textContent = item.label;

            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('[ContextMenu] Item clicked — action:', item.action,
                    'image_uuid:', imageData.image_uuid, 'label:', imageData.label);
                this.close();
                this._handleAction(item.action, imageData);
            });

            menu.appendChild(menuItem);
        }

        return menu;
    }

    /**
     * Adjust menu position to keep it within the viewport.
     */
    _adjustPosition() {
        if (!this._menuEl) return;

        const rect = this._menuEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            const newLeft = viewportWidth - rect.width - 8;
            this._menuEl.style.left = Math.max(0, newLeft) + 'px';
            console.log('[ContextMenu] Adjusted X position to prevent overflow:', newLeft);
        }

        if (rect.bottom > viewportHeight) {
            const newTop = viewportHeight - rect.height - 8;
            this._menuEl.style.top = Math.max(0, newTop) + 'px';
            console.log('[ContextMenu] Adjusted Y position to prevent overflow:', newTop);
        }
    }

    /**
     * Handle a menu action selection.
     * @param {string} action
     * @param {object} imageData
     */
    _handleAction(action, imageData) {
        console.log('[ContextMenu] _handleAction — action:', action, 'image_uuid:', imageData.image_uuid);

        if (action === 'move_to_page') {
            this._handleMoveToPage(imageData);
            return;
        }

        if (action === 'delete' && imageData.source === 'extracted') {
            // Show confirmation dialog for extracted images
            console.log('[ContextMenu] Delete action on extracted image — showing confirmation');
            const confirmed = window.confirm(
                `"${imageData.label}" was extracted from the source. Delete permanently?`
            );
            if (!confirmed) {
                console.log('[ContextMenu] Delete cancelled by user for extracted image:', imageData.image_uuid);
                return;
            }
            console.log('[ContextMenu] User confirmed deletion of extracted image:', imageData.image_uuid);
        }

        // Invoke the callback with the action
        this.onAction(action, imageData.image_uuid, { imageData });
    }

    /**
     * Handle "Move to page..." action — shows a page number input dialog.
     * @param {object} imageData
     */
    _handleMoveToPage(imageData) {
        console.log('[ContextMenu] _handleMoveToPage — showing page number input for:', imageData.image_uuid);

        const currentPage = (imageData.placement && imageData.placement.page_number)
            || imageData.page_number || '';

        const input = window.prompt(
            `Move "${imageData.label}" to page number:`,
            currentPage ? String(currentPage) : ''
        );

        console.log('[ContextMenu] _handleMoveToPage — user input:', input);

        if (input === null) {
            console.log('[ContextMenu] _handleMoveToPage — cancelled by user');
            return;
        }

        const pageNumber = parseInt(input, 10);
        if (isNaN(pageNumber) || pageNumber < 1) {
            console.warn('[ContextMenu] _handleMoveToPage — invalid page number:', input);
            window.alert('Please enter a valid page number (1 or greater).');
            return;
        }

        console.log('[ContextMenu] _handleMoveToPage — moving to page:', pageNumber);
        this.onAction('move_to_page', imageData.image_uuid, { pageNumber, imageData });
    }

    /**
     * Handle click-outside to close the menu.
     * @param {Event} e
     */
    _handleCloseEvent(e) {
        if (this._menuEl && !this._menuEl.contains(e.target)) {
            console.log('[ContextMenu] Click outside detected — closing menu');
            this.close();
        }
    }

    /**
     * Handle Escape key to close the menu.
     * @param {KeyboardEvent} e
     */
    _handleKeyEvent(e) {
        if (e.key === 'Escape') {
            console.log('[ContextMenu] Escape key pressed — closing menu');
            this.close();
        }
    }
}
