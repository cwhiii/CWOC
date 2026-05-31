/**
 * Local Reflow Engine — Client-side text displacement calculator.
 * Provides instant visual feedback during placement/resize operations.
 * Operates on the current spread only (not the full book).
 *
 * After 500ms of no changes, requests an authoritative backend Typst render.
 * When the backend response arrives, replaces the client approximation.
 *
 * Exports: LocalReflowEngine class
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.1, 13.3, 13.4
 */

import { api } from '../api.js';

/**
 * LocalReflowEngine calculates approximate text displacement for images
 * placed on the current spread, providing instant visual feedback.
 *
 * Key behaviors:
 * - Inline images: calculates how many lines of text are displaced
 * - Full_page: entire page consumed, text pushed to next page
 * - Plate: new sheet inserted (2 pages), no text displacement on existing pages
 * - Height snapping: inline heights snap to nearest positive integer multiple of line height
 * - Width calculation: height_in_points × (original_width_px / original_height_px)
 * - Debounce: 500ms after last change, requests authoritative backend render
 */
export class LocalReflowEngine {
    /**
     * @param {object} options - Configuration options
     * @param {string} options.projectId - The project UUID
     * @param {number} [options.lineHeightPt=14] - Line height in points
     * @param {number} [options.pageWidthInches=5.5] - Page width in inches
     * @param {number} [options.pageHeightInches=8.5] - Page height in inches
     * @param {number} [options.marginInches=0.75] - Margin width in inches
     * @param {number} [options.debounceMs=500] - Debounce delay in milliseconds
     * @param {function} [options.onReflowComplete] - Callback when client-side reflow completes
     * @param {function} [options.onBackendRenderComplete] - Callback when backend render arrives
     */
    constructor(options = {}) {
        console.log('[LocalReflow] constructor called, options:', JSON.stringify({
            projectId: options.projectId,
            lineHeightPt: options.lineHeightPt,
            pageWidthInches: options.pageWidthInches,
            pageHeightInches: options.pageHeightInches,
            marginInches: options.marginInches,
            debounceMs: options.debounceMs
        }));

        this.projectId = options.projectId;
        this.lineHeightPt = options.lineHeightPt || 14;
        this.pageWidthInches = options.pageWidthInches || 5.5;
        this.pageHeightInches = options.pageHeightInches || 8.5;
        this.marginInches = options.marginInches || 0.75;
        this.debounceMs = options.debounceMs || 500;
        this.onReflowComplete = options.onReflowComplete || null;
        this.onBackendRenderComplete = options.onBackendRenderComplete || null;

        // Derived constants
        this.textAreaWidthInches = this.pageWidthInches - (this.marginInches * 2);
        this.textAreaHeightInches = this.pageHeightInches - (this.marginInches * 2);
        this.textAreaWidthPt = this.textAreaWidthInches * 72;
        this.textAreaHeightPt = this.textAreaHeightInches * 72;
        this.linesPerPage = Math.floor(this.textAreaHeightPt / this.lineHeightPt);

        // Debounce state
        this._debounceTimer = null;
        this._pendingRenderRequest = null;

        // Last reflow result (client-side approximation)
        this._lastReflowResult = null;

        // Whether we're waiting for a backend render
        this._awaitingBackendRender = false;

        console.log('[LocalReflow] Initialized — lineHeightPt:', this.lineHeightPt,
            '| textAreaWidthPt:', this.textAreaWidthPt.toFixed(2),
            '| textAreaHeightPt:', this.textAreaHeightPt.toFixed(2),
            '| linesPerPage:', this.linesPerPage,
            '| debounceMs:', this.debounceMs);
    }

    /**
     * Snap an arbitrary height value to the nearest positive integer multiple of line height.
     * The result is always >= 1 line.
     *
     * @param {number} heightValue - The raw height value (in lines, possibly fractional)
     * @returns {number} The snapped height as a positive integer (number of lines)
     */
    snapToLineHeight(heightValue) {
        console.log('[LocalReflow] snapToLineHeight — input:', heightValue);

        if (heightValue <= 0 || !isFinite(heightValue)) {
            console.log('[LocalReflow] snapToLineHeight — invalid input, snapping to 1 line');
            return 1;
        }

        // Round to nearest positive integer multiple of line height
        const snapped = Math.max(1, Math.round(heightValue));

        console.log('[LocalReflow] snapToLineHeight — input:', heightValue, '| snapped:', snapped, 'lines');
        return snapped;
    }

    /**
     * Compute the inline width from the aspect ratio and height.
     * Formula: height_in_points × (original_width_px / original_height_px)
     *
     * @param {number} heightInLines - The height in lines (positive integer)
     * @param {number} originalWidthPx - Original image width in pixels
     * @param {number} originalHeightPx - Original image height in pixels
     * @returns {number} The computed width in points
     */
    computeInlineWidth(heightInLines, originalWidthPx, originalHeightPx) {
        console.log('[LocalReflow] computeInlineWidth — heightInLines:', heightInLines,
            '| originalWidthPx:', originalWidthPx, '| originalHeightPx:', originalHeightPx);

        if (!originalHeightPx || originalHeightPx <= 0) {
            console.warn('[LocalReflow] computeInlineWidth — invalid originalHeightPx, returning 0');
            return 0;
        }

        const heightInPoints = heightInLines * this.lineHeightPt;
        const aspectRatio = originalWidthPx / originalHeightPx;
        const widthInPoints = heightInPoints * aspectRatio;

        console.log('[LocalReflow] computeInlineWidth — heightInPoints:', heightInPoints,
            '| aspectRatio:', aspectRatio.toFixed(4), '| widthInPoints:', widthInPoints.toFixed(2));

        return widthInPoints;
    }

    /**
     * Calculate text displacement for an inline image on the current spread.
     * Returns the number of text lines displaced by the image.
     *
     * @param {number} heightInLines - The snapped height in lines
     * @param {number} originalWidthPx - Original image width in pixels
     * @param {number} originalHeightPx - Original image height in pixels
     * @returns {{ linesDisplaced: number, widthPt: number, heightPt: number, fitsInTextArea: boolean }}
     */
    calculateInlineDisplacement(heightInLines, originalWidthPx, originalHeightPx) {
        console.log('[LocalReflow] calculateInlineDisplacement — heightInLines:', heightInLines,
            '| originalWidthPx:', originalWidthPx, '| originalHeightPx:', originalHeightPx);

        const snappedHeight = this.snapToLineHeight(heightInLines);
        const widthPt = this.computeInlineWidth(snappedHeight, originalWidthPx, originalHeightPx);
        const heightPt = snappedHeight * this.lineHeightPt;

        // Check if the image fits within the text area width
        const fitsInTextArea = widthPt <= this.textAreaWidthPt;

        // Lines displaced = the snapped height (since the image occupies that many lines vertically)
        // Text above and below the image continues normally; the image displaces lines at its position
        const linesDisplaced = snappedHeight;

        const result = {
            linesDisplaced,
            widthPt,
            heightPt,
            fitsInTextArea,
            snappedHeightLines: snappedHeight
        };

        console.log('[LocalReflow] calculateInlineDisplacement — result:', JSON.stringify(result));
        return result;
    }

    /**
     * Calculate page displacement for a full_page insertion.
     * A full-page image consumes the entire page, pushing all text to the next page.
     *
     * @param {number} pageNumber - The page where the full-page image is placed
     * @returns {{ pagesDisplaced: number, textPushedToNextPage: boolean }}
     */
    calculateFullPageDisplacement(pageNumber) {
        console.log('[LocalReflow] calculateFullPageDisplacement — pageNumber:', pageNumber);

        // Full page: the entire page is consumed by the image
        // All text that was on this page is pushed to the next page
        const result = {
            pagesDisplaced: 1,
            textPushedToNextPage: true,
            linesDisplaced: this.linesPerPage,
            affectedPage: pageNumber
        };

        console.log('[LocalReflow] calculateFullPageDisplacement — result:', JSON.stringify(result));
        return result;
    }

    /**
     * Calculate page displacement for a plate insertion.
     * A plate inserts a new sheet (2 pages: one image, one blank).
     * No text displacement on existing pages — the sheet is inserted between pages.
     *
     * @param {number} afterPage - The page after which the plate is inserted
     * @param {string} side - 'left' or 'right' — which side the image appears on
     * @returns {{ pagesInserted: number, textDisplaced: boolean }}
     */
    calculatePlateDisplacement(afterPage, side) {
        console.log('[LocalReflow] calculatePlateDisplacement — afterPage:', afterPage, '| side:', side);

        // Plate: a new sheet is inserted (2 pages)
        // No text displacement on existing pages — the sheet is added between them
        const result = {
            pagesInserted: 2,
            textDisplaced: false,
            linesDisplaced: 0,
            imageSide: side || 'right',
            insertedAfterPage: afterPage
        };

        console.log('[LocalReflow] calculatePlateDisplacement — result:', JSON.stringify(result));
        return result;
    }

    /**
     * Perform a local reflow calculation for the current spread.
     * This is the main entry point triggered on place, move, and resize operations.
     *
     * @param {object} params - Reflow parameters
     * @param {string} params.operation - 'place', 'move', or 'resize'
     * @param {object} params.image - The illustration DTO being operated on
     * @param {number} params.spreadStartPage - The left page number of the current spread
     * @param {Array} params.spreadImages - All images on the current spread
     * @returns {object} The reflow result with displacement calculations
     */
    performReflow(params) {
        const { operation, image, spreadStartPage, spreadImages } = params;

        console.log('[LocalReflow] performReflow — operation:', operation,
            '| image:', image ? image.image_uuid : 'null',
            '| spreadStartPage:', spreadStartPage,
            '| spreadImages count:', spreadImages ? spreadImages.length : 0);

        if (!image) {
            console.warn('[LocalReflow] performReflow — no image provided, skipping');
            return null;
        }

        const placement = image.placement || {};
        const mode = placement.mode || image.placement_mode || 'inline';
        const pageNumber = placement.page_number || image.page_number || spreadStartPage;

        console.log('[LocalReflow] performReflow — mode:', mode, '| pageNumber:', pageNumber);

        let reflowResult;

        switch (mode) {
            case 'inline': {
                const rawHeight = placement.height || image.height || 8;
                const snappedHeight = this.snapToLineHeight(rawHeight);
                const displacement = this.calculateInlineDisplacement(
                    snappedHeight,
                    image.original_width_px || 1,
                    image.original_height_px || 1
                );

                reflowResult = {
                    type: 'inline',
                    operation,
                    imageUuid: image.image_uuid,
                    pageNumber,
                    snappedHeightLines: displacement.snappedHeightLines,
                    widthPt: displacement.widthPt,
                    heightPt: displacement.heightPt,
                    linesDisplaced: displacement.linesDisplaced,
                    fitsInTextArea: displacement.fitsInTextArea,
                    totalLinesOnPage: this.linesPerPage,
                    remainingLines: this.linesPerPage - displacement.linesDisplaced
                };
                break;
            }

            case 'full_page': {
                const displacement = this.calculateFullPageDisplacement(pageNumber);

                reflowResult = {
                    type: 'full_page',
                    operation,
                    imageUuid: image.image_uuid,
                    pageNumber,
                    pagesDisplaced: displacement.pagesDisplaced,
                    textPushedToNextPage: displacement.textPushedToNextPage,
                    linesDisplaced: displacement.linesDisplaced
                };
                break;
            }

            case 'plate': {
                const side = placement.side || image.side || 'right';
                const displacement = this.calculatePlateDisplacement(pageNumber, side);

                reflowResult = {
                    type: 'plate',
                    operation,
                    imageUuid: image.image_uuid,
                    pageNumber,
                    pagesInserted: displacement.pagesInserted,
                    textDisplaced: displacement.textDisplaced,
                    imageSide: displacement.imageSide
                };
                break;
            }

            default:
                console.warn('[LocalReflow] performReflow — unknown mode:', mode, '— treating as inline');
                reflowResult = {
                    type: 'unknown',
                    operation,
                    imageUuid: image.image_uuid,
                    pageNumber,
                    linesDisplaced: 0
                };
        }

        // Aggregate displacement from all images on the spread
        const aggregateResult = this._aggregateSpreadDisplacement(spreadImages, spreadStartPage);
        reflowResult.aggregate = aggregateResult;

        this._lastReflowResult = reflowResult;

        console.log('[LocalReflow] performReflow — complete, result:', JSON.stringify(reflowResult));

        // Notify callback
        if (this.onReflowComplete) {
            console.log('[LocalReflow] performReflow — invoking onReflowComplete callback');
            this.onReflowComplete(reflowResult);
        }

        // Schedule debounced backend render request
        this._scheduleBackendRender(spreadStartPage, spreadImages);

        return reflowResult;
    }

    /**
     * Aggregate text displacement across all images on the current spread.
     *
     * @param {Array} spreadImages - All images on the current spread
     * @param {number} spreadStartPage - The left page number of the spread
     * @returns {object} Aggregate displacement data
     */
    _aggregateSpreadDisplacement(spreadImages, spreadStartPage) {
        console.log('[LocalReflow] _aggregateSpreadDisplacement — images:', spreadImages ? spreadImages.length : 0,
            '| spreadStartPage:', spreadStartPage);

        if (!spreadImages || spreadImages.length === 0) {
            return {
                leftPageLinesDisplaced: 0,
                rightPageLinesDisplaced: 0,
                leftPageRemainingLines: this.linesPerPage,
                rightPageRemainingLines: this.linesPerPage,
                totalPagesInserted: 0
            };
        }

        const leftPage = spreadStartPage;
        const rightPage = spreadStartPage + 1;
        let leftPageLinesDisplaced = 0;
        let rightPageLinesDisplaced = 0;
        let totalPagesInserted = 0;

        for (const img of spreadImages) {
            const placement = img.placement || {};
            const mode = placement.mode || img.placement_mode || 'inline';
            const pageNum = placement.page_number || img.page_number || leftPage;

            if (mode === 'inline') {
                const rawHeight = placement.height || img.height || 8;
                const snappedHeight = this.snapToLineHeight(rawHeight);
                if (pageNum === leftPage) {
                    leftPageLinesDisplaced += snappedHeight;
                } else if (pageNum === rightPage) {
                    rightPageLinesDisplaced += snappedHeight;
                }
            } else if (mode === 'full_page') {
                if (pageNum === leftPage) {
                    leftPageLinesDisplaced = this.linesPerPage;
                } else if (pageNum === rightPage) {
                    rightPageLinesDisplaced = this.linesPerPage;
                }
            } else if (mode === 'plate') {
                totalPagesInserted += 2;
            }
        }

        const result = {
            leftPageLinesDisplaced,
            rightPageLinesDisplaced,
            leftPageRemainingLines: Math.max(0, this.linesPerPage - leftPageLinesDisplaced),
            rightPageRemainingLines: Math.max(0, this.linesPerPage - rightPageLinesDisplaced),
            totalPagesInserted
        };

        console.log('[LocalReflow] _aggregateSpreadDisplacement — result:', JSON.stringify(result));
        return result;
    }

    /**
     * Schedule a debounced backend render request.
     * Cancels any pending request and waits 500ms before firing.
     *
     * @param {number} spreadStartPage - The left page of the current spread
     * @param {Array} spreadImages - All images on the current spread
     */
    _scheduleBackendRender(spreadStartPage, spreadImages) {
        console.log('[LocalReflow] _scheduleBackendRender — scheduling with', this.debounceMs, 'ms debounce');

        // Cancel any pending debounce timer
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
            console.log('[LocalReflow] _scheduleBackendRender — cancelled previous debounce timer');
        }

        // Cancel any pending fetch request (if using AbortController)
        if (this._pendingRenderRequest) {
            this._pendingRenderRequest.abort();
            this._pendingRenderRequest = null;
            console.log('[LocalReflow] _scheduleBackendRender — aborted previous pending request');
        }

        this._debounceTimer = setTimeout(() => {
            console.log('[LocalReflow] Debounce timer fired — requesting authoritative backend render');
            this._requestBackendRender(spreadStartPage, spreadImages);
        }, this.debounceMs);
    }

    /**
     * Request an authoritative render from the backend Typst compiler.
     * POST /api/projects/{id}/illustrations/render-preview
     *
     * @param {number} spreadStartPage - The left page of the spread to render
     * @param {Array} spreadImages - Images on the spread (for context)
     */
    async _requestBackendRender(spreadStartPage, spreadImages) {
        console.log('='.repeat(80));
        console.log('[LocalReflow] _requestBackendRender — ENTRY');
        console.log('[LocalReflow] _requestBackendRender — spreadStartPage:', spreadStartPage);
        console.log('[LocalReflow] _requestBackendRender — spreadStartPage typeof:', typeof spreadStartPage);
        console.log('[LocalReflow] _requestBackendRender — projectId:', this.projectId);
        console.log('[LocalReflow] _requestBackendRender — spreadImages:', spreadImages);
        console.log('[LocalReflow] _requestBackendRender — spreadImages is array:', Array.isArray(spreadImages));
        console.log('[LocalReflow] _requestBackendRender — spreadImages count:', spreadImages ? spreadImages.length : 'null/undefined');
        
        if (spreadImages && spreadImages.length > 0) {
            console.log('[LocalReflow] _requestBackendRender — spreadImages RAW dump:');
            spreadImages.forEach((img, idx) => {
                console.log(`[LocalReflow] _requestBackendRender — spreadImages[${idx}]:`, JSON.stringify(img, null, 2));
            });
        }

        if (!this.projectId) {
            console.warn('[LocalReflow] _requestBackendRender — no projectId set, skipping backend render');
            console.log('='.repeat(80));
            return;
        }

        this._awaitingBackendRender = true;

        // Build the images array with detailed logging
        console.log('[LocalReflow] _requestBackendRender — building imagesPayload...');
        const imagesPayload = (spreadImages || []).map((img, idx) => {
            console.log(`[LocalReflow] _requestBackendRender — processing image ${idx}:`);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].image_uuid:`, img.image_uuid);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].placement:`, JSON.stringify(img.placement));
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].placement_mode (direct):`, img.placement_mode);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].page_number (direct):`, img.page_number);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].position_x (direct):`, img.position_x);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].position_y (direct):`, img.position_y);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].height (direct):`, img.height);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].layout (direct):`, img.layout);
            console.log(`[LocalReflow] _requestBackendRender — img[${idx}].side (direct):`, img.side);
            
            const mappedImage = {
                image_uuid: img.image_uuid,
                placement_mode: (img.placement && img.placement.mode) || img.placement_mode,
                page_number: (img.placement && img.placement.page_number) || img.page_number,
                position_x: (img.placement && img.placement.position_x) || img.position_x,
                position_y: (img.placement && img.placement.position_y) || img.position_y,
                height: (img.placement && img.placement.height) || img.height,
                layout: (img.placement && img.placement.layout) || img.layout,
                side: (img.placement && img.placement.side) || img.side
            };
            
            console.log(`[LocalReflow] _requestBackendRender — mappedImage[${idx}]:`, JSON.stringify(mappedImage));
            console.log(`[LocalReflow] _requestBackendRender — mappedImage[${idx}].page_number:`, mappedImage.page_number, 'typeof:', typeof mappedImage.page_number);
            return mappedImage;
        });

        const payload = {
            page_number: spreadStartPage,  // Backend expects page_number, not spread_start_page
            images: imagesPayload
        };

        console.log('[LocalReflow] _requestBackendRender — FINAL PAYLOAD:');
        console.log('[LocalReflow] _requestBackendRender — payload:', JSON.stringify(payload, null, 2));
        console.log('[LocalReflow] _requestBackendRender — payload.page_number:', payload.page_number);
        console.log('[LocalReflow] _requestBackendRender — payload.page_number typeof:', typeof payload.page_number);
        console.log('[LocalReflow] _requestBackendRender — payload has "spread_start_page" key:', 'spread_start_page' in payload);
        console.log('[LocalReflow] _requestBackendRender — payload has "page_number" key:', 'page_number' in payload);
        console.log('[LocalReflow] _requestBackendRender — payload.images length:', payload.images.length);
        console.log('[LocalReflow] _requestBackendRender — payload keys:', Object.keys(payload));
        
        const endpoint = `/projects/${this.projectId}/illustrations/render-preview`;
        console.log('[LocalReflow] _requestBackendRender — endpoint:', endpoint);
        console.log('[LocalReflow] _requestBackendRender — full URL will be: /api' + endpoint);

        // Use AbortController for cancellation support
        const abortController = new AbortController();
        this._pendingRenderRequest = abortController;

        try {
            console.log('[LocalReflow] _requestBackendRender — calling api.postBackground() (no 401 redirect)...');
            const result = await api.postBackground(endpoint, payload);

            console.log('[LocalReflow] _requestBackendRender — api.post() returned successfully');
            console.log('[LocalReflow] _requestBackendRender — result:', JSON.stringify(result));
            console.log('[LocalReflow] _requestBackendRender — result keys:', result ? Object.keys(result) : 'null');

            this._awaitingBackendRender = false;
            this._pendingRenderRequest = null;

            // Replace client approximation with authoritative backend render
            if (this.onBackendRenderComplete) {
                console.log('[LocalReflow] _requestBackendRender — invoking onBackendRenderComplete callback');
                this.onBackendRenderComplete(result);
            }
            console.log('[LocalReflow] _requestBackendRender — EXIT success');
            console.log('='.repeat(80));
        } catch (err) {
            this._awaitingBackendRender = false;
            this._pendingRenderRequest = null;

            if (err.name === 'AbortError') {
                console.log('[LocalReflow] _requestBackendRender — request was aborted (superseded by newer request)');
            } else {
                console.error('[LocalReflow] _requestBackendRender — api.post() FAILED');
                console.error('[LocalReflow] _requestBackendRender — error name:', err.name);
                console.error('[LocalReflow] _requestBackendRender — error message:', err.message);
                console.error('[LocalReflow] _requestBackendRender — error:', err);
                console.error('[LocalReflow] _requestBackendRender — error JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                
                // Try to extract response body if available
                if (err.response) {
                    console.error('[LocalReflow] _requestBackendRender — err.response:', err.response);
                }
                if (err.body) {
                    console.error('[LocalReflow] _requestBackendRender — err.body:', err.body);
                }
                if (err.data) {
                    console.error('[LocalReflow] _requestBackendRender — err.data:', err.data);
                }
                if (err.detail) {
                    console.error('[LocalReflow] _requestBackendRender — err.detail:', err.detail);
                }
                
                console.error('[LocalReflow] _requestBackendRender — PAYLOAD THAT FAILED:', JSON.stringify(payload, null, 2));
                console.error('[LocalReflow] _requestBackendRender — client approximation remains in place');
            }
            console.log('[LocalReflow] _requestBackendRender — EXIT with error');
            console.log('='.repeat(80));
        }
    }

    /**
     * Cancel any pending debounce timer and abort any in-flight backend request.
     * Call this when the user navigates away from the spread or the component is destroyed.
     */
    cancel() {
        console.log('[LocalReflow] cancel() — clearing debounce timer and aborting pending requests');

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        if (this._pendingRenderRequest) {
            this._pendingRenderRequest.abort();
            this._pendingRenderRequest = null;
        }

        this._awaitingBackendRender = false;
    }

    /**
     * Check if the engine is currently waiting for a backend render.
     * @returns {boolean}
     */
    isAwaitingBackendRender() {
        return this._awaitingBackendRender;
    }

    /**
     * Get the last reflow result (client-side approximation).
     * @returns {object|null}
     */
    getLastReflowResult() {
        return this._lastReflowResult;
    }

    /**
     * Get the number of lines per page based on current configuration.
     * @returns {number}
     */
    getLinesPerPage() {
        return this.linesPerPage;
    }

    /**
     * Get the line height in points.
     * @returns {number}
     */
    getLineHeightPt() {
        return this.lineHeightPt;
    }

    /**
     * Get the text area width in points.
     * @returns {number}
     */
    getTextAreaWidthPt() {
        return this.textAreaWidthPt;
    }

    /**
     * Clean up resources. Call when the component is destroyed.
     */
    destroy() {
        console.log('[LocalReflow] destroy() — cleaning up');
        this.cancel();
        this.onReflowComplete = null;
        this.onBackendRenderComplete = null;
        this._lastReflowResult = null;
    }
}
