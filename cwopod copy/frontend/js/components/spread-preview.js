/**
 * Spread Preview Component — Canvas-based double-page spread renderer.
 * Displays the current spread (left + right page) with placed images,
 * selection highlighting, and bleed zone overlays.
 *
 * Exports: SpreadPreview class
 *
 * Requirements: 5.1, 5.2, 5.3, 5.8
 */

/**
 * SpreadPreview renders a double-page spread onto an HTML5 Canvas element.
 * It shows text placeholders, placed images, selection highlights, and bleed zones.
 */
export class SpreadPreview {
    /**
     * @param {HTMLElement} containerEl - The DOM element to render the canvas into
     * @param {object} options - Configuration options
     * @param {number} [options.pageWidthInches=5.5] - Page width in inches
     * @param {number} [options.pageHeightInches=8.5] - Page height in inches
     * @param {number} [options.bleedInches=0.125] - Bleed zone width in inches
     * @param {number} [options.marginInches=0.75] - Margin width in inches
     * @param {number} [options.lineHeightPt=14] - Line height in points for text placeholders
     * @param {function} [options.onImageSelect] - Callback when an image is clicked on the spread
     */
    constructor(containerEl, options = {}) {
        console.log('[SpreadPreview] constructor called, containerEl:', containerEl, 'options:', options);

        this.container = containerEl;
        this.pageWidthInches = options.pageWidthInches || 5.5;
        this.pageHeightInches = options.pageHeightInches || 8.5;
        this.bleedInches = options.bleedInches || 0.125;
        this.marginInches = options.marginInches || 0.75;
        this.lineHeightPt = options.lineHeightPt || 14;
        this.onImageSelect = options.onImageSelect || null;

        // State
        this.currentSpreadStart = 1; // Left page number (odd = left in a spread)
        this.illustrations = [];
        this.selectedImageUuid = null;
        this.totalPages = 0;

        // Canvas setup
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spread-preview-canvas';
        this.canvas.style.width = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.cursor = 'pointer';
        this.ctx = this.canvas.getContext('2d');

        // Rendering scale (pixels per inch at current canvas size)
        this.scale = 1;

        // Image cache for loaded image elements
        this.imageCache = {};

        // Clear container and insert canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        // Responsive resize
        this._resizeObserver = new ResizeObserver(() => {
            console.log('[SpreadPreview] Container resized, re-rendering');
            this._updateCanvasSize();
            this.render();
        });
        this._resizeObserver.observe(this.container);

        // Click handler for image selection
        this.canvas.addEventListener('click', (e) => this._handleClick(e));

        // Initial sizing
        this._updateCanvasSize();

        console.log('[SpreadPreview] Initialized — pageSize:', this.pageWidthInches, 'x', this.pageHeightInches,
            'bleed:', this.bleedInches, 'margin:', this.marginInches);
    }

    /**
     * Update the canvas dimensions to fit the container while maintaining aspect ratio.
     */
    _updateCanvasSize() {
        const containerWidth = this.container.clientWidth || 600;
        // Spread = two pages side by side
        const spreadWidthInches = this.pageWidthInches * 2;
        const spreadHeightInches = this.pageHeightInches;
        const aspectRatio = spreadWidthInches / spreadHeightInches;

        // Canvas width fills container, height derived from aspect ratio
        const canvasWidth = containerWidth;
        const canvasHeight = canvasWidth / aspectRatio;

        // Use device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        this.canvas.style.height = canvasHeight + 'px';

        // Scale factor: pixels per inch
        this.scale = (canvasWidth * dpr) / spreadWidthInches;
        this.dpr = dpr;

        console.log('[SpreadPreview] _updateCanvasSize — canvasWidth:', canvasWidth,
            'canvasHeight:', canvasHeight, 'dpr:', dpr, 'scale (px/inch):', this.scale);
    }

    /**
     * Set the illustrations data and re-render.
     * @param {Array} illustrations - Array of IllustrationDTO objects
     * @param {number} totalPages - Total page count of the book
     */
    setData(illustrations, totalPages) {
        console.log('[SpreadPreview] setData — illustrations:', illustrations.length, 'totalPages:', totalPages);
        this.illustrations = illustrations || [];
        this.totalPages = totalPages || 0;
        this.render();
    }

    /**
     * Set the currently selected image UUID and re-render.
     * @param {string|null} imageUuid - The UUID of the selected image, or null to deselect
     */
    setSelectedImage(imageUuid) {
        const prev = this.selectedImageUuid;
        this.selectedImageUuid = imageUuid;
        console.log('[SpreadPreview] setSelectedImage — previous:', prev, 'new:', imageUuid);
        this.render();
    }

    /**
     * Navigate to a specific spread (by left page number).
     * @param {number} leftPageNumber - The left page number of the spread to display
     */
    goToSpread(leftPageNumber) {
        // Ensure left page is odd (left pages are odd in a book spread)
        let page = Math.max(1, Math.min(leftPageNumber, this.totalPages));
        if (page % 2 === 0) page = Math.max(1, page - 1);
        console.log('[SpreadPreview] goToSpread — requested:', leftPageNumber, 'resolved:', page);
        this.currentSpreadStart = page;
        this.render();
    }

    /**
     * Get the current spread's left page number.
     * @returns {number}
     */
    getCurrentSpreadStart() {
        return this.currentSpreadStart;
    }

    /**
     * Main render method — draws the full double-page spread.
     */
    render() {
        const ctx = this.ctx;
        const scale = this.scale;
        const pageW = this.pageWidthInches * scale;
        const pageH = this.pageHeightInches * scale;
        const spreadW = pageW * 2;
        const marginPx = this.marginInches * scale;
        const bleedPx = this.bleedInches * scale;

        console.log('[SpreadPreview] render() — spread pages:', this.currentSpreadStart, '&', this.currentSpreadStart + 1,
            'selectedImage:', this.selectedImageUuid);

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background (desk/table color)
        ctx.fillStyle = '#d2b48c';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw left page
        this._drawPage(ctx, 0, 0, pageW, pageH, this.currentSpreadStart, 'left');

        // Draw right page
        this._drawPage(ctx, pageW, 0, pageW, pageH, this.currentSpreadStart + 1, 'right');

        // Draw spine/gutter line
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(pageW, 0);
        ctx.lineTo(pageW, pageH);
        ctx.stroke();

        // Draw placed images on this spread
        this._drawImages(ctx, pageW, pageH);

        console.log('[SpreadPreview] render() complete');
    }

    /**
     * Draw a single page (white rectangle with margin guides and text placeholders).
     */
    _drawPage(ctx, x, y, width, height, pageNumber, side) {
        const marginPx = this.marginInches * this.scale;

        // Page background (white/cream)
        ctx.fillStyle = '#fffef9';
        ctx.fillRect(x, y, width, height);

        // Page border
        ctx.strokeStyle = '#c8b896';
        ctx.lineWidth = 1 * this.dpr;
        ctx.strokeRect(x, y, width, height);

        // Margin guides (light dashed lines)
        ctx.save();
        ctx.setLineDash([4 * this.dpr, 4 * this.dpr]);
        ctx.strokeStyle = '#e0d4c0';
        ctx.lineWidth = 1 * this.dpr;
        ctx.strokeRect(x + marginPx, y + marginPx, width - marginPx * 2, height - marginPx * 2);
        ctx.restore();

        // Text placeholder lines (grey lines within margins)
        const textAreaX = x + marginPx;
        const textAreaY = y + marginPx;
        const textAreaW = width - marginPx * 2;
        const textAreaH = height - marginPx * 2;
        const lineHeightPx = (this.lineHeightPt / 72) * this.scale; // Convert pt to inches to px

        ctx.fillStyle = '#e8e0d8';
        const lineCount = Math.floor(textAreaH / lineHeightPx);
        for (let i = 0; i < lineCount; i++) {
            const lineY = textAreaY + i * lineHeightPx + lineHeightPx * 0.7;
            // Vary line widths deterministically to simulate text (avoids flicker on re-render)
            const seed = (pageNumber * 31 + i * 7) % 100;
            const lineWidth = textAreaW * (0.6 + (seed / 100) * 0.4);
            ctx.fillRect(textAreaX, lineY, lineWidth, 2 * this.dpr);
        }

        // Page number at bottom center
        if (pageNumber > 0 && pageNumber <= this.totalPages) {
            ctx.fillStyle = '#8b5a2b';
            ctx.font = `${11 * this.dpr}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.fillText(String(pageNumber), x + width / 2, y + height - marginPx / 2);
        } else if (pageNumber > this.totalPages) {
            // Beyond book — show empty page indicator
            ctx.fillStyle = '#ccc';
            ctx.font = `${11 * this.dpr}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.fillText('—', x + width / 2, y + height / 2);
        }
    }

    /**
     * Draw all placed images that appear on the current spread.
     */
    _drawImages(ctx, pageW, pageH) {
        const leftPage = this.currentSpreadStart;
        const rightPage = this.currentSpreadStart + 1;
        const marginPx = this.marginInches * this.scale;
        const bleedPx = this.bleedInches * this.scale;

        // Filter images on this spread
        const spreadImages = this.illustrations.filter(img => {
            if (img.pool !== 'in_book') return false;
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            return pageNum === leftPage || pageNum === rightPage;
        });

        console.log('[SpreadPreview] _drawImages — found', spreadImages.length, 'images on spread',
            leftPage, '-', rightPage);

        for (const img of spreadImages) {
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            const mode = placement.mode || img.placement_mode || 'inline';
            const layout = placement.layout || img.layout || 'margins';
            const posX = placement.position_x || img.position_x || 0.5;
            const posY = placement.position_y || img.position_y || 0.5;
            const height = placement.height || img.height || (mode === 'inline' ? 8 : 100);
            const side = placement.side || img.side || 'right';

            // Determine which side of the spread this image is on
            const isLeftPage = (pageNum === leftPage);
            const pageOffsetX = isLeftPage ? 0 : pageW;

            // For plate mode: draw blank page indicator on the opposite side
            if (mode === 'plate') {
                this._drawPlateBlankPage(ctx, side, pageOffsetX, pageW, pageH, marginPx);
            }

            // Calculate image dimensions in canvas pixels
            const imgRect = this._calculateImageRect(img, mode, layout, height, posX, posY, pageOffsetX, pageW, pageH, marginPx);

            // Draw bleed zone overlay if "Push to edges" layout
            if ((mode === 'full_page' || mode === 'plate') && layout === 'edges') {
                this._drawBleedZone(ctx, pageOffsetX, pageW, pageH, bleedPx, marginPx);
            }

            // Draw the image rectangle (placeholder if image not loaded)
            this._drawImageRect(ctx, img, imgRect);

            // Highlight if selected
            if (img.image_uuid === this.selectedImageUuid) {
                this._drawSelectionHighlight(ctx, imgRect);
            }
        }
    }

    /**
     * Calculate the bounding rectangle for an image on the canvas.
     * @returns {{ x: number, y: number, w: number, h: number, imageUuid: string }}
     */
    _calculateImageRect(img, mode, layout, height, posX, posY, pageOffsetX, pageW, pageH, marginPx) {
        const aspectRatio = (img.original_width_px || 1) / (img.original_height_px || 1);
        let imgW, imgH, imgX, imgY;

        if (mode === 'full_page' || mode === 'plate') {
            // Height is percentage of page height
            const pct = Math.min(height, 100) / 100;
            if (layout === 'edges') {
                // Push to edges — fill the page
                imgH = pageH * pct;
                imgW = imgH * aspectRatio;
                // Center on page
                imgX = pageOffsetX + (pageW - imgW) / 2;
                imgY = (pageH - imgH) / 2;
            } else {
                // Stay in margins — fit within text area
                const textAreaW = pageW - marginPx * 2;
                const textAreaH = pageH - marginPx * 2;
                imgH = textAreaH * pct;
                imgW = imgH * aspectRatio;
                // Clamp width to text area
                if (imgW > textAreaW) {
                    imgW = textAreaW;
                    imgH = imgW / aspectRatio;
                }
                // Center within text area
                imgX = pageOffsetX + marginPx + (textAreaW - imgW) / 2;
                imgY = marginPx + (textAreaH - imgH) / 2;
            }
        } else {
            // Inline mode — height is in lines
            const lineHeightPx = (this.lineHeightPt / 72) * this.scale;
            imgH = height * lineHeightPx;
            imgW = imgH * aspectRatio;
            // Clamp to text area width
            const textAreaW = pageW - marginPx * 2;
            if (imgW > textAreaW) {
                imgW = textAreaW;
                imgH = imgW / aspectRatio;
            }
            // Position within text area using posX/posY as percentage
            const textAreaX = pageOffsetX + marginPx;
            const textAreaY = marginPx;
            const textAreaH = pageH - marginPx * 2;
            imgX = textAreaX + (textAreaW - imgW) * posX;
            imgY = textAreaY + (textAreaH - imgH) * posY;
        }

        return { x: imgX, y: imgY, w: imgW, h: imgH, imageUuid: img.image_uuid };
    }

    /**
     * Draw the bleed zone as a grey semi-transparent overlay around the page edges.
     * Shows the area that will be cut off during printing when "Push to edges" is selected.
     * Requirements: 7.3, 7.5
     */
    _drawBleedZone(ctx, pageOffsetX, pageW, pageH, bleedPx, marginPx) {
        console.log('[SpreadPreview] _drawBleedZone — pageOffsetX:', pageOffsetX, 'bleedPx:', bleedPx,
            '| showing grey overlay on bleed zone (content beyond trim line will be cut)');

        ctx.save();
        ctx.fillStyle = 'rgba(128, 128, 128, 0.25)';

        // Top bleed strip (area between page edge and margin — will be cut)
        ctx.fillRect(pageOffsetX, 0, pageW, marginPx);
        // Bottom bleed strip
        ctx.fillRect(pageOffsetX, pageH - marginPx, pageW, marginPx);
        // Left bleed strip
        ctx.fillRect(pageOffsetX, 0, marginPx, pageH);
        // Right bleed strip
        ctx.fillRect(pageOffsetX + pageW - marginPx, 0, marginPx, pageH);

        // Draw trim line indicator (dashed red line at margin boundary)
        ctx.setLineDash([6 * this.dpr, 4 * this.dpr]);
        ctx.strokeStyle = 'rgba(178, 34, 34, 0.5)';
        ctx.lineWidth = 1.5 * this.dpr;
        ctx.strokeRect(pageOffsetX + marginPx, marginPx, pageW - marginPx * 2, pageH - marginPx * 2);

        // Draw "trim" label in the bleed zone (top-right corner)
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(178, 34, 34, 0.6)';
        ctx.font = `${8 * this.dpr}px Georgia, serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('✂ trim zone', pageOffsetX + pageW - 4 * this.dpr, 4 * this.dpr);

        ctx.restore();
    }

    /**
     * Draw a blank page indicator for the opposite side of a plate insertion.
     * A plate inserts a new sheet: one image page and one blank page.
     * This draws a subtle "blank page" indicator on the opposite side.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} imageSide - 'left' or 'right' — which side the image is on
     * @param {number} imagePageOffsetX - The X offset of the image page
     * @param {number} pageW - Page width in pixels
     * @param {number} pageH - Page height in pixels
     * @param {number} marginPx - Margin in pixels
     */
    _drawPlateBlankPage(ctx, imageSide, imagePageOffsetX, pageW, pageH, marginPx) {
        // The blank page is on the opposite side of the image page within the same sheet
        // If image is on the left, blank is on the right (and vice versa)
        // However, in the spread view, both pages of the sheet may not be visible simultaneously
        // We show a subtle indicator on the image page to denote it's part of a plate (new sheet)
        console.log('[SpreadPreview] _drawPlateBlankPage — imageSide:', imageSide,
            'imagePageOffsetX:', imagePageOffsetX);

        ctx.save();

        // Draw a subtle "PLATE" badge in the top corner of the image page
        const badgeX = imagePageOffsetX + marginPx;
        const badgeY = marginPx * 0.3;
        const badgeText = `Plate (${imageSide} page)`;

        ctx.fillStyle = 'rgba(70, 130, 180, 0.15)';
        ctx.fillRect(badgeX, badgeY, pageW - marginPx * 2, marginPx * 0.6);

        ctx.fillStyle = 'rgba(70, 130, 180, 0.8)';
        ctx.font = `${9 * this.dpr}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, imagePageOffsetX + pageW / 2, badgeY + marginPx * 0.3);

        ctx.restore();
    }

    /**
     * Draw an image rectangle (uses loaded image or a colored placeholder).
     */
    _drawImageRect(ctx, img, rect) {
        const { x, y, w, h } = rect;

        // Try to draw the actual image if cached
        const cachedImg = this.imageCache[img.image_uuid];
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            ctx.drawImage(cachedImg, x, y, w, h);
        } else {
            // Draw placeholder rectangle
            ctx.fillStyle = '#d4e6f1';
            ctx.fillRect(x, y, w, h);

            // Draw diagonal lines to indicate image placeholder
            ctx.strokeStyle = '#85c1e9';
            ctx.lineWidth = 1 * this.dpr;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y + h);
            ctx.moveTo(x + w, y);
            ctx.lineTo(x, y + h);
            ctx.stroke();

            // Draw label text centered
            const label = img.label || 'Image';
            ctx.fillStyle = '#2c3e50';
            ctx.font = `${10 * this.dpr}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const maxLabelWidth = w - 8 * this.dpr;
            if (maxLabelWidth > 20) {
                ctx.fillText(label, x + w / 2, y + h / 2, maxLabelWidth);
            }

            // Attempt to load the image for future renders
            if (!this.imageCache[img.image_uuid]) {
                this._loadImage(img);
            }
        }

        // Draw border
        ctx.strokeStyle = '#85929e';
        ctx.lineWidth = 1 * this.dpr;
        ctx.strokeRect(x, y, w, h);
    }

    /**
     * Draw a selection highlight around the given rectangle.
     */
    _drawSelectionHighlight(ctx, rect) {
        const { x, y, w, h } = rect;
        const pad = 4 * this.dpr;

        console.log('[SpreadPreview] _drawSelectionHighlight — imageUuid:', rect.imageUuid);

        ctx.save();

        // Blue glow effect
        ctx.shadowColor = 'rgba(52, 152, 219, 0.6)';
        ctx.shadowBlur = 8 * this.dpr;
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3 * this.dpr;
        ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);

        ctx.restore();

        // Draw corner handles
        const handleSize = 6 * this.dpr;
        ctx.fillStyle = '#2980b9';
        // Top-left
        ctx.fillRect(x - pad - handleSize / 2, y - pad - handleSize / 2, handleSize, handleSize);
        // Top-right
        ctx.fillRect(x + w + pad - handleSize / 2, y - pad - handleSize / 2, handleSize, handleSize);
        // Bottom-left
        ctx.fillRect(x - pad - handleSize / 2, y + h + pad - handleSize / 2, handleSize, handleSize);
        // Bottom-right
        ctx.fillRect(x + w + pad - handleSize / 2, y + h + pad - handleSize / 2, handleSize, handleSize);
    }

    /**
     * Load an image element asynchronously and re-render when loaded.
     */
    _loadImage(img) {
        const imageEl = new Image();
        imageEl.crossOrigin = 'anonymous';
        this.imageCache[img.image_uuid] = imageEl;

        imageEl.onload = () => {
            console.log('[SpreadPreview] Image loaded:', img.image_uuid, img.label);
            this.render();
        };
        imageEl.onerror = () => {
            console.warn('[SpreadPreview] Image failed to load:', img.image_uuid, img.label);
            // Keep placeholder — don't retry
        };

        // Construct thumbnail URL
        imageEl.src = `/api/illustrations/${img.image_uuid}/image`;
    }

    /**
     * Handle click events on the canvas to detect image selection.
     */
    _handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = (event.clientX - rect.left) * this.dpr;
        const clickY = (event.clientY - rect.top) * this.dpr;

        console.log('[SpreadPreview] _handleClick — clickX:', clickX, 'clickY:', clickY);

        const pageW = this.pageWidthInches * this.scale;
        const pageH = this.pageHeightInches * this.scale;
        const marginPx = this.marginInches * this.scale;

        // Check all images on this spread for hit detection
        const leftPage = this.currentSpreadStart;
        const rightPage = this.currentSpreadStart + 1;

        const spreadImages = this.illustrations.filter(img => {
            if (img.pool !== 'in_book') return false;
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            return pageNum === leftPage || pageNum === rightPage;
        });

        let hitImage = null;

        // Check in reverse order (top-most image first)
        for (let i = spreadImages.length - 1; i >= 0; i--) {
            const img = spreadImages[i];
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            const mode = placement.mode || img.placement_mode || 'inline';
            const layout = placement.layout || img.layout || 'margins';
            const posX = placement.position_x || img.position_x || 0.5;
            const posY = placement.position_y || img.position_y || 0.5;
            const height = placement.height || img.height || (mode === 'inline' ? 8 : 100);
            const isLeftPage = (pageNum === leftPage);
            const pageOffsetX = isLeftPage ? 0 : pageW;

            const imgRect = this._calculateImageRect(img, mode, layout, height, posX, posY, pageOffsetX, pageW, pageH, marginPx);

            if (clickX >= imgRect.x && clickX <= imgRect.x + imgRect.w &&
                clickY >= imgRect.y && clickY <= imgRect.y + imgRect.h) {
                hitImage = img;
                break;
            }
        }

        if (hitImage) {
            console.log('[SpreadPreview] Image clicked:', hitImage.image_uuid, hitImage.label);
            this.selectedImageUuid = hitImage.image_uuid;
            this.render();
            if (this.onImageSelect) {
                this.onImageSelect(hitImage.image_uuid);
            }
        } else {
            // Clicked empty area — deselect
            if (this.selectedImageUuid) {
                console.log('[SpreadPreview] Deselected image (clicked empty area)');
                this.selectedImageUuid = null;
                this.render();
                if (this.onImageSelect) {
                    this.onImageSelect(null);
                }
            }
        }
    }

    /**
     * Clean up resources (ResizeObserver, event listeners).
     */
    destroy() {
        console.log('[SpreadPreview] destroy() called — cleaning up');
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        this.canvas.removeEventListener('click', this._handleClick);
        this.imageCache = {};
        this.container.innerHTML = '';
    }
}
