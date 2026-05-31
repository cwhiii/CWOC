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
 * It shows rendered page images (from Typst), placed images, selection highlights, and bleed zones.
 * Falls back to placeholder lines if page images are not yet available.
 */
export class SpreadPreview {
    /**
     * @param {HTMLElement} containerEl - The DOM element to render the canvas into
     * @param {object} options - Configuration options
     * @param {string} options.projectId - The project UUID (required for fetching page images)
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
        this.projectId = options.projectId || null;
        this.pageWidthInches = options.pageWidthInches || 5.5;
        this.pageHeightInches = options.pageHeightInches || 8.5;
        this.bleedInches = options.bleedInches || 0.125;
        this.marginInches = options.marginInches || 0.75;
        this.lineHeightPt = options.lineHeightPt || 14;
        this.onImageSelect = options.onImageSelect || null;

        // State
        this.currentSpreadStart = 1; // Left page number (even = left in a spread)
        this.illustrations = [];
        this.selectedImageUuid = null;
        this.totalPages = 0;

        // Page image cache: { pageNumber: HTMLImageElement }
        this.pageImageCache = {};
        // Track which pages are currently being fetched
        this._pageImageLoading = {};
        // Track which spreads have been requested from the render-preview endpoint
        this._renderedSpreads = {};

        // Canvas setup
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spread-preview-canvas';
        this.canvas.style.width = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.cursor = 'pointer';
        this.ctx = this.canvas.getContext('2d');

        // Rendering scale (pixels per inch at current canvas size)
        this.scale = 1;

        // Image cache for loaded image elements (illustration images)
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
            'bleed:', this.bleedInches, 'margin:', this.marginInches, 'projectId:', this.projectId);
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
     * Navigate to a specific spread containing the given page.
     * @param {number} pageNumber - Any page number in the spread to display
     */
    goToSpread(pageNumber) {
        // Determine which spread contains this page.
        // Internal convention: even pages are left (verso), odd pages are right (recto).
        // currentSpreadStart is always even (the left page), except page 1 which is a special case.
        let targetPage = Math.max(1, Math.min(pageNumber, this.totalPages));

        // Determine the left page of the spread containing targetPage.
        let leftPage;
        if (targetPage % 2 === 0) {
            // targetPage is even → it IS the left page of its spread
            leftPage = targetPage;
        } else {
            // targetPage is odd → the spread started on the previous even page
            // Special case: page 1 has no even left page, so use page 1 as currentSpreadStart
            leftPage = Math.max(1, targetPage - 1);
        }

        this.currentSpreadStart = leftPage;

        console.log('[SpreadPreview] goToSpread — requested page:', pageNumber, 'left page:', leftPage, 'currentSpreadStart:', this.currentSpreadStart);
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

        // Determine left and right pages based on currentSpreadStart
        let leftPage, rightPage;
        if (this.currentSpreadStart % 2 === 0) {
            // currentSpreadStart is even (left page)
            leftPage = this.currentSpreadStart;
            rightPage = this.currentSpreadStart + 1;
        } else {
            // currentSpreadStart is odd (right page)
            // This happens for page 1 (first page of book)
            // Show page 1 on the right, blank on left
            leftPage = this.currentSpreadStart - 1;
            rightPage = this.currentSpreadStart;
        }
        
        console.log('[SpreadPreview] render() — spread pages:', leftPage, '&', rightPage,
            'selectedImage:', this.selectedImageUuid);

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw left page (if it exists)
        if (leftPage >= 1) {
            this._drawPage(ctx, 0, 0, pageW, pageH, leftPage, 'left');
        } else {
            // Draw blank/placeholder for non-existent left page
            this._drawBlankPage(ctx, 0, 0, pageW, pageH, 'left');
        }
        
        // Draw right page
        this._drawPage(ctx, pageW, 0, pageW, pageH, rightPage, 'right');

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
     * Draw a single page — uses rendered page image if available, otherwise falls back to placeholders.
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

        // Try to draw the rendered page image
        const pageImg = this.pageImageCache[pageNumber];
        if (pageImg && pageImg.complete && pageImg.naturalWidth > 0) {
            // Draw the rendered page image filling the page area
            ctx.drawImage(pageImg, x, y, width, height);
            console.log('[SpreadPreview] _drawPage — drew rendered image for page', pageNumber);
        } else {
            // Fallback: draw placeholder lines and trigger image fetch
            this._drawPagePlaceholder(ctx, x, y, width, height, pageNumber);

            // Request the page image if we haven't already
            if (pageNumber > 0 && pageNumber <= this.totalPages) {
                this._fetchPageImage(pageNumber);
            }
        }

        // Page number at bottom center (always draw on top)
        if (pageNumber > 0 && pageNumber <= this.totalPages) {
            // Draw a small background behind the page number for readability
            ctx.fillStyle = 'rgba(255, 254, 249, 0.8)';
            ctx.fillRect(x + width / 2 - 20 * this.dpr, y + height - marginPx / 2 - 8 * this.dpr, 40 * this.dpr, 16 * this.dpr);
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
     * Draw placeholder lines (fallback when rendered page image is not available).
     */
    _drawPagePlaceholder(ctx, x, y, width, height, pageNumber) {
        const marginPx = this.marginInches * this.scale;

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
        const lineHeightPx = (this.lineHeightPt / 72) * this.scale;

        ctx.fillStyle = '#e8e0d8';
        const lineCount = Math.floor(textAreaH / lineHeightPx);
        for (let i = 0; i < lineCount; i++) {
            const lineY = textAreaY + i * lineHeightPx + lineHeightPx * 0.7;
            const seed = (pageNumber * 31 + i * 7) % 100;
            const lineWidth = textAreaW * (0.6 + (seed / 100) * 0.4);
            ctx.fillRect(textAreaX, lineY, lineWidth, 2 * this.dpr);
        }

        // Show "Loading..." indicator if page is within book range
        if (pageNumber > 0 && pageNumber <= this.totalPages) {
            ctx.fillStyle = 'rgba(139, 90, 43, 0.5)';
            ctx.font = `${10 * this.dpr}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading page...', x + width / 2, y + height / 2);
        }
    }

    /**
     * Draw a blank page (for non-existent left page when viewing page 1).
     */
    _drawBlankPage(ctx, x, y, width, height, side) {
        const marginPx = this.marginInches * this.scale;
        
        // Page border
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 1 * this.dpr;
        ctx.strokeRect(x, y, width, height);
        
        // Grey background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(x, y, width, height);
        
        // "Blank page" text
        ctx.fillStyle = '#999';
        ctx.font = `${12 * this.dpr}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Blank page', x + width / 2, y + height / 2);
        
        console.log('[SpreadPreview] _drawBlankPage — drew blank page on', side);
    }

    /**
     * Fetch a rendered page image from the backend.
     * Triggers a render-preview request if the spread hasn't been rendered yet.
     */
    _fetchPageImage(pageNumber) {
        if (!this.projectId) {
            console.log('[SpreadPreview] _fetchPageImage — no projectId, skipping');
            return;
        }
        if (this._pageImageLoading[pageNumber]) {
            return; // Already loading
        }

        // First, try to load the image directly (it may already be cached on server)
        this._pageImageLoading[pageNumber] = true;
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            console.log('[SpreadPreview] Page image loaded for page', pageNumber);
            this.pageImageCache[pageNumber] = img;
            this._pageImageLoading[pageNumber] = false;
            this.render();
        };

        img.onerror = () => {
            console.log('[SpreadPreview] Page image not available for page', pageNumber, '— requesting render');
            this._pageImageLoading[pageNumber] = false;
            // Image doesn't exist yet — request the backend to render this spread
            this._requestSpreadRender(pageNumber);
        };

        img.src = `/api/projects/${this.projectId}/illustrations/page-image/${pageNumber}`;
    }

    /**
     * Request the backend to render a spread containing the given page number.
     * After rendering, fetches the resulting page images.
     */
    async _requestSpreadRender(pageNumber) {
        // Determine the spread (left page is odd)
        const spreadLeft = pageNumber % 2 === 1 ? pageNumber : pageNumber - 1;
        const spreadKey = `${spreadLeft}`;

        if (this._renderedSpreads[spreadKey]) {
            return; // Already requested
        }
        this._renderedSpreads[spreadKey] = true;

        console.log('[SpreadPreview] _requestSpreadRender — requesting spread starting at page', spreadLeft);

        try {
            const response = await fetch(`/api/projects/${this.projectId}/illustrations/render-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_number: spreadLeft }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[SpreadPreview] render-preview failed:', response.status, errorData);
                return;
            }

            const data = await response.json();
            console.log('[SpreadPreview] render-preview response:', data);

            if (data.status === 'complete' && data.rendered_pages) {
                // Update total pages if the backend reports it
                if (data.page_count && data.page_count > 0) {
                    this.totalPages = data.page_count;
                }
                // Now fetch the rendered page images
                for (const renderedPage of data.rendered_pages) {
                    this._loadRenderedPageImage(renderedPage);
                }
            }
        } catch (err) {
            console.error('[SpreadPreview] _requestSpreadRender error:', err);
            // Allow retry on next navigation
            this._renderedSpreads[spreadKey] = false;
        }
    }

    /**
     * Load a rendered page image after the backend has confirmed it exists.
     * Forces a fresh fetch by appending a cache-busting timestamp so stale
     * browser-cached or in-memory-cached images are not reused.
     */
    _loadRenderedPageImage(pageNumber) {
        // Do NOT skip if already cached — the backend just re-rendered, so we
        // need the fresh file. The caller (onBackendRenderComplete) already
        // deleted the cache entry before calling render(), which triggers this.
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            console.log('[SpreadPreview] Rendered page image loaded:', pageNumber);
            this.pageImageCache[pageNumber] = img;
            this._pageImageLoading[pageNumber] = false;
            this.render();
        };

        img.onerror = () => {
            console.warn('[SpreadPreview] Failed to load rendered page image:', pageNumber);
            this._pageImageLoading[pageNumber] = false;
        };

        // Add cache-buster to avoid stale images
        img.src = `/api/projects/${this.projectId}/illustrations/page-image/${pageNumber}?t=${Date.now()}`;
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

        // Construct thumbnail URL — use the project-scoped thumb endpoint
        imageEl.src = `/api/projects/${this.projectId}/illustrations/${img.image_uuid}/thumb`;
        console.log('[SpreadPreview] _loadImage — fetching thumbnail from:', imageEl.src);
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
     * Invalidate the page image cache for all pages >= startPage.
     * Call this after a full reflow so the spread preview re-fetches
     * the freshly compiled pages from the backend.
     *
     * @param {number} startPage - First page to invalidate (inclusive)
     */
    invalidatePagesFrom(startPage) {
        console.log('[SpreadPreview] invalidatePagesFrom — startPage:', startPage,
            '| totalPages:', this.totalPages);

        let invalidated = 0;

        // Clear page image cache for all pages >= startPage
        for (const key of Object.keys(this.pageImageCache)) {
            if (Number(key) >= startPage) {
                delete this.pageImageCache[key];
                invalidated++;
            }
        }

        // Clear loading flags for those pages
        for (const key of Object.keys(this._pageImageLoading)) {
            if (Number(key) >= startPage) {
                delete this._pageImageLoading[key];
            }
        }

        // Clear rendered-spread tracking for all spreads that include or follow startPage
        // Spread keys are the left page number of each spread
        for (const key of Object.keys(this._renderedSpreads)) {
            const spreadLeft = Number(key);
            // A spread covers spreadLeft and spreadLeft+1; invalidate if it overlaps startPage
            if (spreadLeft + 1 >= startPage) {
                delete this._renderedSpreads[key];
            }
        }

        console.log('[SpreadPreview] invalidatePagesFrom — invalidated', invalidated,
            'cached pages, cleared spread render tracking from page', startPage, 'onward');
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
        this.pageImageCache = {};
        this._pageImageLoading = {};
        this._renderedSpreads = {};
        this.container.innerHTML = '';
    }
}
