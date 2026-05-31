/**
 * In Book Pool UI Component — renders the in_book pool section with enhanced
 * thumbnail display, lock management, and resolution warnings.
 *
 * Exports: InBookPool class
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3
 */

import { escapeHtml } from '../dom.js';

/**
 * InBookPool manages the rendering and interaction of the In Book pool section.
 * Each thumbnail shows: label, page number, placement mode badge, lock icon (🔒/🔓).
 * Resolution warning (⚠️) appears when resolution_warning is true in the DTO.
 * "Lock All" button locks all unlocked images with a confirmation dialog.
 * Images without placement_mode show a warning border (pending state).
 */
export class InBookPool {
    /**
     * @param {object} options
     * @param {jQuery} options.$container - The jQuery container element to render into
     * @param {string} options.projectId - The current project ID
     * @param {function} options.getImages - Returns array of in_book illustration DTOs
     * @param {function} options.onImageSelect - Callback when an image thumbnail is clicked (uuid)
     * @param {function} options.onLockAll - Callback when Lock All is confirmed (returns promise)
     * @param {function} options.onImageClick - Callback for clicking a pending image to configure placement (uuid)
     * @param {string|null} options.selectedImageUuid - Currently selected image UUID
     */
    constructor(options) {
        console.log('[InBookPool] constructor called, projectId:', options.projectId);
        this.$container = options.$container;
        this.projectId = options.projectId;
        this.getImages = options.getImages;
        this.onImageSelect = options.onImageSelect;
        this.onLockAll = options.onLockAll;
        this.onImageClick = options.onImageClick || null;
        this.selectedImageUuid = options.selectedImageUuid || null;
        console.log('[InBookPool] Initialized with options — selectedImageUuid:', this.selectedImageUuid);
    }

    /**
     * Update the selected image UUID and re-render.
     * @param {string|null} uuid
     */
    setSelectedImage(uuid) {
        console.log('[InBookPool] setSelectedImage:', uuid);
        this.selectedImageUuid = uuid;
        this.render();
    }

    /**
     * Render the full In Book pool section into the container.
     */
    render() {
        const images = this.getImages();
        console.log('[InBookPool] render() — images count:', images.length);

        const unlockedCount = images.filter(img => !img.lock_state).length;
        console.log('[InBookPool] Unlocked images count:', unlockedCount);

        let html = `
            <div class="pool-section pool-in-book" id="pool-in-book">
                <div class="pool-header">
                    <h3>In Book</h3>
                    <button class="btn btn-sm secondary" id="in-book-lock-all" 
                            ${unlockedCount === 0 ? 'disabled' : ''}
                            title="Lock all unlocked images">
                        🔒 Lock All
                    </button>
                </div>
                <p class="pool-hint">Images placed in the book</p>
                <div class="pool-thumbnails" id="in-book-thumbnails">
                    ${this._renderThumbnails(images)}
                </div>
            </div>
        `;

        this.$container.html(html);
        this._bindEvents(images, unlockedCount);
        console.log('[InBookPool] render() complete — bound events');
    }

    /**
     * Render thumbnail HTML for all in-book images.
     * @param {Array} images - Array of illustration DTOs in the in_book pool
     * @returns {string} HTML string
     */
    _renderThumbnails(images) {
        if (images.length === 0) {
            console.log('[InBookPool] _renderThumbnails — no images, showing empty state');
            return '<p class="pool-empty">No images placed in book</p>';
        }

        let html = '';
        for (const img of images) {
            const isSelected = img.image_uuid === this.selectedImageUuid;
            const isPending = !img.placement_mode && !(img.placement && img.placement.mode);
            const lockIcon = img.lock_state ? '🔒' : '🔓';
            const hasResolutionWarning = img.resolution_warning === true;

            // Determine placement mode label
            const placementMode = img.placement_mode || (img.placement && img.placement.mode) || null;
            const modeLabel = this._getModeBadgeLabel(placementMode);
            const modeBadgeClass = this._getModeBadgeClass(placementMode);

            // Determine page number
            const pageNumber = img.page_number || (img.placement && img.placement.page_number) || null;

            console.log('[InBookPool] _renderThumbnails — image:', img.image_uuid,
                'label:', img.label, 'locked:', img.lock_state,
                'mode:', placementMode, 'page:', pageNumber,
                'pending:', isPending, 'resWarning:', hasResolutionWarning);

            html += `
                <div class="pool-thumbnail in-book-thumbnail ${isSelected ? 'selected' : ''} ${isPending ? 'pending-placement' : ''}"
                     data-uuid="${escapeHtml(img.image_uuid)}"
                     data-pool="in_book"
                     ${isPending ? 'title="Click to configure placement"' : ''}>
                    <div class="thumb-image-wrap">
                        <img src="/api/projects/${this.projectId}/illustrations/${img.image_uuid}/thumb"
                             alt="${escapeHtml(img.label)}"
                             draggable="false"
                             onerror="this.onerror=null; this.style.display='none'; this.parentElement.classList.add('thumb-error');" />
                        <span class="thumb-placeholder" title="Image preview">🖼️</span>
                        <span class="thumb-lock" title="${img.lock_state ? 'Locked' : 'Unlocked'}">${lockIcon}</span>
                        ${hasResolutionWarning ? '<span class="thumb-dpi-warning" title="Low resolution for print (DPI &lt; 300)">⚠️</span>' : ''}
                    </div>
                    <div class="thumb-meta">
                        <span class="thumb-label" title="${escapeHtml(img.label)}">${escapeHtml(img.label)}</span>
                        <div class="thumb-info-row">
                            ${pageNumber ? `<span class="thumb-page">p.${escapeHtml(String(pageNumber))}</span>` : ''}
                            ${modeLabel ? `<span class="thumb-mode-badge ${modeBadgeClass}">${escapeHtml(modeLabel)}</span>` : ''}
                            ${isPending ? '<span class="thumb-mode-badge badge-pending">pending</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    /**
     * Get a human-readable label for the placement mode.
     * @param {string|null} mode
     * @returns {string}
     */
    _getModeBadgeLabel(mode) {
        if (!mode) return '';
        const labels = {
            'full_page': 'Full Page',
            'plate': 'Plate',
            'inline': 'Inline'
        };
        return labels[mode] || mode.replace(/_/g, ' ');
    }

    /**
     * Get a CSS class for the placement mode badge.
     * @param {string|null} mode
     * @returns {string}
     */
    _getModeBadgeClass(mode) {
        if (!mode) return '';
        const classes = {
            'full_page': 'badge-full-page',
            'plate': 'badge-plate',
            'inline': 'badge-inline'
        };
        return classes[mode] || '';
    }

    /**
     * Bind click events for thumbnails and the Lock All button.
     * @param {Array} images
     * @param {number} unlockedCount
     */
    _bindEvents(images, unlockedCount) {
        const self = this;

        // Thumbnail click — select image
        this.$container.find('.in-book-thumbnail').on('click', function () {
            const uuid = $(this).data('uuid');
            const img = images.find(i => i.image_uuid === uuid);
            const isPending = img && !img.placement_mode && !(img.placement && img.placement.mode);

            console.log('[InBookPool] Thumbnail clicked:', uuid, 'isPending:', isPending);

            // If pending and we have a configure callback, invoke it
            if (isPending && self.onImageClick) {
                console.log('[InBookPool] Pending image clicked — invoking onImageClick callback for:', uuid);
                self.onImageClick(uuid);
            }

            // Always select the image
            if (self.onImageSelect) {
                self.onImageSelect(uuid);
            }
        });

        // Lock All button
        this.$container.find('#in-book-lock-all').on('click', function () {
            console.log('[InBookPool] "Lock All" button clicked — unlockedCount:', unlockedCount);
            self._handleLockAll(unlockedCount);
        });

        console.log('[InBookPool] _bindEvents complete — thumbnails:', images.length, 'lockAll enabled:', unlockedCount > 0);
    }

    /**
     * Handle the Lock All button click — show confirmation dialog, then invoke callback.
     * @param {number} unlockedCount - Number of currently unlocked images
     */
    _handleLockAll(unlockedCount) {
        if (unlockedCount === 0) {
            console.log('[InBookPool] _handleLockAll — no unlocked images, ignoring');
            return;
        }

        const message = `You have ${unlockedCount} image${unlockedCount !== 1 ? 's' : ''} you haven't manually locked. This will lock them all and trigger a full reflow. Proceed?`;
        console.log('[InBookPool] _handleLockAll — showing confirmation:', message);

        const confirmed = window.confirm(message);
        console.log('[InBookPool] _handleLockAll — user confirmed:', confirmed);

        if (confirmed) {
            console.log('[InBookPool] _handleLockAll — user confirmed Lock All, invoking onLockAll callback');
            if (this.onLockAll) {
                this.onLockAll();
            }
        } else {
            console.log('[InBookPool] _handleLockAll — user cancelled Lock All');
        }
    }
}
