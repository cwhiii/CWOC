/**
 * Drag & Drop Handler Component — manages all drag-and-drop interactions
 * for the Illustrations step.
 *
 * Handles:
 * - Pool-to-spread: place image at drop position, auto-resize, infer full_page mode
 * - Pool-to-in_book (not spread): show warning border + tooltip
 * - Shared↔Available: copy (shared→available) or move semantics
 * - On-spread repositioning: reposition image + local reflow
 * - On-spread edge-drag: resize with aspect ratio locked + local reflow
 * - Snap back to original position on invalid drop target
 * - Logs all drag start/end/drop events with source/target
 *
 * Uses HTML5 Drag and Drop API (dragstart, dragover, drop events).
 *
 * Exports: DragDropHandler class
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

/* global $ */

/**
 * DragDropHandler orchestrates all drag-and-drop interactions for the
 * Illustrations step. It attaches event listeners to pool thumbnails
 * (drag sources) and drop targets (spread canvas, in-book pool, pools).
 */
export class DragDropHandler {
    /**
     * @param {object} options
     * @param {jQuery} options.$container - The root illustrations page container
     * @param {string} options.projectId - Current project ID
     * @param {Function} options.getIllustrations - Returns the full illustrations array
     * @param {Function} options.getPoolImages - Returns images for a given pool name
     * @param {object} options.spreadPreview - SpreadPreview instance
     * @param {Function} options.onImagePlaced - Callback(imageUuid, placement) when image placed on spread
     * @param {Function} options.onImageMovedOnSpread - Callback(imageUuid, newPosX, newPosY) for repositioning
     * @param {Function} options.onImageResizedOnSpread - Callback(imageUuid, newHeight) for edge-drag resize
     * @param {Function} options.onImageDroppedInBook - Callback(imageUuid) for pool-to-in_book without spread
     * @param {Function} options.onSharedToAvailable - Callback(imageUuid) for shared→available copy
     * @param {Function} options.onAvailableToShared - Callback(imageUuid) for available→shared move
     * @param {Function} options.onStateChanged - Callback() after any drag operation changes state
     * @param {object} options.pageConfig - { pageWidthInches, pageHeightInches, marginInches }
     */
    constructor(options) {
        console.log('[DragDropHandler] constructor called, projectId:', options.projectId);

        this.$container = options.$container;
        this.projectId = options.projectId;
        this.getIllustrations = options.getIllustrations;
        this.getPoolImages = options.getPoolImages;
        this.spreadPreview = options.spreadPreview;
        this.onImagePlaced = options.onImagePlaced || (() => {});
        this.onImageMovedOnSpread = options.onImageMovedOnSpread || (() => {});
        this.onImageResizedOnSpread = options.onImageResizedOnSpread || (() => {});
        this.onImageDroppedInBook = options.onImageDroppedInBook || (() => {});
        this.onSharedToAvailable = options.onSharedToAvailable || (() => {});
        this.onAvailableToShared = options.onAvailableToShared || (() => {});
        this.onStateChanged = options.onStateChanged || (() => {});
        this.pageConfig = options.pageConfig || {
            pageWidthInches: 5.5,
            pageHeightInches: 8.5,
            marginInches: 0.75
        };

        // Internal drag state
        this._dragData = null; // { imageUuid, sourcePool, sourceElement, originRect }
        this._resizeDragData = null; // { imageUuid, startX, startY, startHeight, aspectRatio }
        this._boundHandlers = []; // Track bound handlers for cleanup

        console.log('[DragDropHandler] Initialized with pageConfig:', this.pageConfig);
    }

    /**
     * Initialize drag-and-drop by attaching event listeners to all relevant elements.
     * Call this after the DOM is rendered (pools, spread canvas, etc.).
     */
    init() {
        console.log('[DragDropHandler] init() — attaching drag-and-drop event listeners');
        this._attachPoolDragSources();
        this._attachSpreadDropTarget();
        this._attachInBookDropTarget();
        this._attachPoolDropTargets();
        this._attachSpreadDragInteractions();
        console.log('[DragDropHandler] init() complete — all listeners attached');
    }

    /**
     * Re-attach drag sources after pool re-renders (thumbnails are recreated).
     * Call this whenever pool components re-render their thumbnails.
     */
    refreshDragSources() {
        console.log('[DragDropHandler] refreshDragSources() — re-attaching drag sources to pool thumbnails');
        this._attachPoolDragSources();
    }

    /**
     * Clean up all event listeners.
     */
    destroy() {
        console.log('[DragDropHandler] destroy() — removing all drag-and-drop listeners');
        for (const { element, event, handler } of this._boundHandlers) {
            element.removeEventListener(event, handler);
        }
        this._boundHandlers = [];
        this._dragData = null;
        this._resizeDragData = null;
        console.log('[DragDropHandler] destroy() complete');
    }

    // =========================================================================
    // Pool Drag Sources — make pool thumbnails draggable
    // =========================================================================

    /**
     * Attach draggable="true" and dragstart/dragend handlers to all pool thumbnails.
     */
    _attachPoolDragSources() {
        const self = this;
        const $thumbnails = this.$container.find(
            '.shared-pool-thumbnails .pool-thumbnail, ' +
            '.available-pool-thumbnails .pool-thumbnail, ' +
            '#in-book-thumbnails .in-book-thumbnail'
        );

        $thumbnails.each(function () {
            const el = this;
            const uuid = $(el).data('uuid');
            const pool = $(el).data('pool') || self._inferPool(el);

            // Set draggable attribute
            el.setAttribute('draggable', 'true');

            // dragstart
            const onDragStart = (e) => {
                self._handlePoolDragStart(e, uuid, pool, el);
            };
            el.addEventListener('dragstart', onDragStart);
            self._boundHandlers.push({ element: el, event: 'dragstart', handler: onDragStart });

            // dragend (snap back on invalid drop)
            const onDragEnd = (e) => {
                self._handlePoolDragEnd(e, uuid, pool);
            };
            el.addEventListener('dragend', onDragEnd);
            self._boundHandlers.push({ element: el, event: 'dragend', handler: onDragEnd });
        });

        console.log('[DragDropHandler] _attachPoolDragSources — attached to', $thumbnails.length, 'thumbnails');
    }

    /**
     * Infer the pool from the thumbnail's DOM position.
     * @param {HTMLElement} el
     * @returns {string} 'shared' | 'available' | 'in_book'
     */
    _inferPool(el) {
        if ($(el).closest('.shared-pool-thumbnails').length) return 'shared';
        if ($(el).closest('.available-pool-thumbnails').length) return 'available';
        if ($(el).closest('#in-book-thumbnails').length) return 'in_book';
        return 'unknown';
    }

    /**
     * Handle dragstart on a pool thumbnail.
     */
    _handlePoolDragStart(e, imageUuid, sourcePool, sourceElement) {
        console.log('='.repeat(80));
        console.log('[DragDropHandler] DRAG START — ENTRY');
        console.log('[DragDropHandler] DRAG START — imageUuid:', imageUuid);
        console.log('[DragDropHandler] DRAG START — sourcePool:', sourcePool);
        console.log('[DragDropHandler] DRAG START — sourceElement tagName:', sourceElement.tagName);
        console.log('[DragDropHandler] DRAG START — sourceElement classList:', sourceElement.className);
        console.log('[DragDropHandler] DRAG START — sourceElement data-uuid:', sourceElement.getAttribute('data-uuid'));
        console.log('[DragDropHandler] DRAG START — sourceElement data-pool:', sourceElement.getAttribute('data-pool'));
        console.log('[DragDropHandler] DRAG START — e.type:', e.type);
        console.log('[DragDropHandler] DRAG START — e.target:', e.target ? e.target.tagName : 'null');
        console.log('[DragDropHandler] DRAG START — e.currentTarget:', e.currentTarget ? e.currentTarget.tagName : 'null');
        console.log('[DragDropHandler] DRAG START — e.dataTransfer exists:', !!e.dataTransfer);

        if (e.dataTransfer) {
            console.log('[DragDropHandler] DRAG START — e.dataTransfer.types BEFORE clearData:', Array.from(e.dataTransfer.types || []));
        }

        // Prevent Firefox from treating this as a native image drag.
        // Firefox pre-populates dataTransfer with text/x-moz-url, application/x-moz-nativeimage etc.
        // for <img> elements, which causes the browser to intercept the drop.
        // clearData() removes those pre-populated types so our setData() takes over.
        e.dataTransfer.clearData();
        console.log('[DragDropHandler] DRAG START — clearData() called, types after:', Array.from(e.dataTransfer.types || []));

        this._dragData = {
            imageUuid,
            sourcePool,
            sourceElement,
            originRect: sourceElement.getBoundingClientRect()
        };
        console.log('[DragDropHandler] DRAG START — _dragData set:', JSON.stringify({ imageUuid, sourcePool }));

        const dragPayloadStr = JSON.stringify({ imageUuid, sourcePool });
        console.log('[DragDropHandler] DRAG START — dragPayloadStr:', dragPayloadStr);

        try {
            e.dataTransfer.setData('text/plain', dragPayloadStr);
            console.log('[DragDropHandler] DRAG START — setData("text/plain") succeeded');
        } catch (err) {
            console.error('[DragDropHandler] DRAG START — setData("text/plain") FAILED:', err.message);
        }

        console.log('[DragDropHandler] DRAG START — e.dataTransfer.types AFTER setData:', Array.from(e.dataTransfer.types || []));

        // Verify
        try {
            const verify = e.dataTransfer.getData('text/plain');
            console.log('[DragDropHandler] DRAG START — VERIFY getData("text/plain"):', verify);
            if (verify === dragPayloadStr) {
                console.log('[DragDropHandler] DRAG START — VERIFY: getData matches setData ✓');
            } else {
                console.warn('[DragDropHandler] DRAG START — VERIFY MISMATCH — expected:', dragPayloadStr, 'got:', verify);
            }
        } catch (err) {
            console.log('[DragDropHandler] DRAG START — VERIFY threw (may be normal in some browsers):', err.message);
        }

        e.dataTransfer.effectAllowed = sourcePool === 'shared' ? 'copy' : 'move';
        console.log('[DragDropHandler] DRAG START — set effectAllowed to:', e.dataTransfer.effectAllowed);

        sourceElement.classList.add('dragging');
        console.log('[DragDropHandler] DRAG START — EXIT');
        console.log('='.repeat(80));
    }

    /**
     * Handle dragend on a pool thumbnail — snap back if drop was invalid.
     */
    _handlePoolDragEnd(e, imageUuid, sourcePool) {
        console.log('[DragDropHandler] DRAG END — imageUuid:', imageUuid, 'sourcePool:', sourcePool,
            'dropEffect:', e.dataTransfer.dropEffect);

        // Remove dragging visual feedback
        if (this._dragData && this._dragData.sourceElement) {
            this._dragData.sourceElement.classList.remove('dragging');
        }

        // Clean up drop-target highlight in case dragleave didn't fire
        const canvasArea = this.$container.find('#spread-canvas-area')[0];
        if (canvasArea) canvasArea.classList.remove('drop-target-active');

        // If dropEffect is 'none', the drop was invalid — snap back
        if (e.dataTransfer.dropEffect === 'none') {
            console.log('[DragDropHandler] DRAG END — invalid drop target, snapping back to original position');
        }

        this._dragData = null;
    }

    // =========================================================================
    // Spread Drop Target — handle drops onto the spread canvas
    // =========================================================================

    /**
     * Attach dragover and drop handlers to the spread canvas area.
     * Handlers are attached to BOTH the container div AND the canvas element.
     * The drop event only fires on an element if that exact element called
     * preventDefault() on dragover — the canvas is topmost under the cursor,
     * so it must handle dragover itself or the browser rejects the drop.
     */
    _attachSpreadDropTarget() {
        const canvasArea = this.$container.find('#spread-canvas-area')[0];
        if (!canvasArea) {
            console.warn('[DragDropHandler] _attachSpreadDropTarget — #spread-canvas-area not found');
            return;
        }

        const self = this;

        const onDragEnter = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasArea.classList.add('drop-target-active');
            console.log('[DragDropHandler] dragenter on spread canvas area');
        };

        const onDragOver = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasArea.classList.add('drop-target-active');
            console.log('[DragDropHandler] dragover on spread canvas area');
        };

        const onDragLeave = (e) => {
            if (!canvasArea.contains(e.relatedTarget)) {
                canvasArea.classList.remove('drop-target-active');
                console.log('[DragDropHandler] dragleave from spread canvas area');
            }
        };

        const onDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvasArea.classList.remove('drop-target-active');
            console.log('[DragDropHandler] DROP fired on', e.currentTarget.tagName, e.currentTarget.className || e.currentTarget.id);
            self._handleSpreadDrop(e);
        };

        // Attach to the container
        canvasArea.addEventListener('dragenter', onDragEnter);
        canvasArea.addEventListener('dragover', onDragOver);
        canvasArea.addEventListener('dragleave', onDragLeave);
        canvasArea.addEventListener('drop', onDrop);

        this._boundHandlers.push({ element: canvasArea, event: 'dragenter', handler: onDragEnter });
        this._boundHandlers.push({ element: canvasArea, event: 'dragover', handler: onDragOver });
        this._boundHandlers.push({ element: canvasArea, event: 'dragleave', handler: onDragLeave });
        this._boundHandlers.push({ element: canvasArea, event: 'drop', handler: onDrop });

        // Also attach directly to the canvas element — it's the topmost element
        // under the cursor and must call preventDefault() on dragover for drop to fire.
        const canvas = canvasArea.querySelector('.spread-preview-canvas');
        if (canvas) {
            canvas.addEventListener('dragenter', onDragEnter);
            canvas.addEventListener('dragover', onDragOver);
            canvas.addEventListener('dragleave', onDragLeave);
            canvas.addEventListener('drop', onDrop);
            this._boundHandlers.push({ element: canvas, event: 'dragenter', handler: onDragEnter });
            this._boundHandlers.push({ element: canvas, event: 'dragover', handler: onDragOver });
            this._boundHandlers.push({ element: canvas, event: 'dragleave', handler: onDragLeave });
            this._boundHandlers.push({ element: canvas, event: 'drop', handler: onDrop });
            console.log('[DragDropHandler] _attachSpreadDropTarget — also attached to canvas element');
        }

        console.log('[DragDropHandler] _attachSpreadDropTarget — spread canvas is now a drop target');
    }

    /**
     * Re-attach drop handlers to the canvas after it's created/recreated.
     */
    refreshSpreadDropTarget() {
        console.log('[DragDropHandler] refreshSpreadDropTarget — re-attaching drop handlers to canvas');
        const canvasArea = this.$container.find('#spread-canvas-area')[0];
        if (!canvasArea) return;

        const canvas = canvasArea.querySelector('.spread-preview-canvas');
        if (!canvas) {
            console.log('[DragDropHandler] refreshSpreadDropTarget — canvas not found yet');
            return;
        }

        if (canvas._dropHandlersAttached) {
            console.log('[DragDropHandler] refreshSpreadDropTarget — canvas already has handlers');
            return;
        }

        const self = this;

        const onDragEnter = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasArea.classList.add('drop-target-active');
        };

        const onDragOver = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvasArea.classList.add('drop-target-active');
        };

        const onDragLeave = (e) => {
            if (!canvasArea.contains(e.relatedTarget)) {
                canvasArea.classList.remove('drop-target-active');
            }
        };

        const onDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvasArea.classList.remove('drop-target-active');
            console.log('[DragDropHandler] refreshSpreadDropTarget DROP fired on canvas');
            self._handleSpreadDrop(e);
        };

        canvas.addEventListener('dragenter', onDragEnter);
        canvas.addEventListener('dragover', onDragOver);
        canvas.addEventListener('dragleave', onDragLeave);
        canvas.addEventListener('drop', onDrop);
        canvas._dropHandlersAttached = true;

        this._boundHandlers.push({ element: canvas, event: 'dragenter', handler: onDragEnter });
        this._boundHandlers.push({ element: canvas, event: 'dragover', handler: onDragOver });
        this._boundHandlers.push({ element: canvas, event: 'dragleave', handler: onDragLeave });
        this._boundHandlers.push({ element: canvas, event: 'drop', handler: onDrop });
        console.log('[DragDropHandler] refreshSpreadDropTarget — attached drop handlers to canvas');
    }

    /**
     * Handle a drop event on the spread canvas.
     * Pool-to-spread: place image at drop position, auto-resize to fit margins,
     * infer full_page mode on the drop side.
     */
    _handleSpreadDrop(e) {
        console.log('='.repeat(80));
        console.log('[DragDropHandler] _handleSpreadDrop — ENTRY');
        console.log('[DragDropHandler] _handleSpreadDrop — e.type:', e.type);
        console.log('[DragDropHandler] _handleSpreadDrop — e.target:', e.target ? e.target.tagName : 'null');
        console.log('[DragDropHandler] _handleSpreadDrop — e.target.className:', e.target ? e.target.className : 'null');
        console.log('[DragDropHandler] _handleSpreadDrop — e.currentTarget:', e.currentTarget ? e.currentTarget.tagName : 'null');
        console.log('[DragDropHandler] _handleSpreadDrop — e.clientX:', e.clientX, 'e.clientY:', e.clientY);
        console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer exists:', !!e.dataTransfer);
        
        if (e.dataTransfer) {
            console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer.constructor:', e.dataTransfer.constructor.name);
            console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer.types:', Array.from(e.dataTransfer.types || []));
            console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer.types.length:', e.dataTransfer.types ? e.dataTransfer.types.length : 0);
            console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer.dropEffect:', e.dataTransfer.dropEffect);
            console.log('[DragDropHandler] _handleSpreadDrop — e.dataTransfer.effectAllowed:', e.dataTransfer.effectAllowed);
            
            // Log all available types
            if (e.dataTransfer.types && e.dataTransfer.types.length > 0) {
                console.log('[DragDropHandler] _handleSpreadDrop — iterating through all dataTransfer.types:');
                for (let i = 0; i < e.dataTransfer.types.length; i++) {
                    const type = e.dataTransfer.types[i];
                    try {
                        const data = e.dataTransfer.getData(type);
                        console.log(`[DragDropHandler] _handleSpreadDrop — type[${i}] "${type}":`, data);
                    } catch (err) {
                        console.log(`[DragDropHandler] _handleSpreadDrop — type[${i}] "${type}" getData threw:`, err.message);
                    }
                }
            } else {
                console.log('[DragDropHandler] _handleSpreadDrop — dataTransfer.types is EMPTY or null');
            }
        }
        
        console.log('[DragDropHandler] _handleSpreadDrop — this._dragData exists:', !!this._dragData);
        if (this._dragData) {
            console.log('[DragDropHandler] _handleSpreadDrop — this._dragData.imageUuid:', this._dragData.imageUuid);
            console.log('[DragDropHandler] _handleSpreadDrop — this._dragData.sourcePool:', this._dragData.sourcePool);
            console.log('[DragDropHandler] _handleSpreadDrop — this._dragData.sourceElement:', this._dragData.sourceElement ? this._dragData.sourceElement.tagName : 'null');
        } else {
            console.log('[DragDropHandler] _handleSpreadDrop — this._dragData is NULL — internal state was lost!');
        }
        
        // Try to get the raw data first using multiple methods
        let rawData = null;
        
        // Method 1: text/plain
        console.log('[DragDropHandler] _handleSpreadDrop — METHOD 1: trying getData("text/plain")');
        try {
            rawData = e.dataTransfer.getData('text/plain');
            console.log('[DragDropHandler] _handleSpreadDrop — getData("text/plain") returned:', rawData);
            console.log('[DragDropHandler] _handleSpreadDrop — getData("text/plain") typeof:', typeof rawData);
            console.log('[DragDropHandler] _handleSpreadDrop — getData("text/plain") length:', rawData ? rawData.length : 0);
            if (rawData && rawData.length > 0) {
                console.log('[DragDropHandler] _handleSpreadDrop — getData("text/plain") first 100 chars:', rawData.substring(0, 100));
                console.log('[DragDropHandler] _handleSpreadDrop — getData("text/plain") charCodes (first 20):', 
                    rawData.substring(0, 20).split('').map(c => c.charCodeAt(0)).join(','));
            }
        } catch (err) {
            console.error('[DragDropHandler] _handleSpreadDrop — getData("text/plain") THREW:', err.name, err.message);
        }
        
        // Method 2: text
        if (!rawData || rawData.trim() === '') {
            console.log('[DragDropHandler] _handleSpreadDrop — METHOD 2: trying getData("text")');
            try {
                const textData = e.dataTransfer.getData('text');
                console.log('[DragDropHandler] _handleSpreadDrop — getData("text") returned:', textData);
                console.log('[DragDropHandler] _handleSpreadDrop — getData("text") length:', textData ? textData.length : 0);
                if (textData && textData.trim() !== '') {
                    rawData = textData;
                    console.log('[DragDropHandler] _handleSpreadDrop — using getData("text") as rawData');
                }
            } catch (err) {
                console.log('[DragDropHandler] _handleSpreadDrop — getData("text") THREW:', err.message);
            }
        }
        
        // Method 3: application/json
        if (!rawData || rawData.trim() === '') {
            console.log('[DragDropHandler] _handleSpreadDrop — METHOD 3: trying getData("application/json")');
            try {
                const jsonData = e.dataTransfer.getData('application/json');
                console.log('[DragDropHandler] _handleSpreadDrop — getData("application/json") returned:', jsonData);
                if (jsonData && jsonData.trim() !== '') {
                    rawData = jsonData;
                    console.log('[DragDropHandler] _handleSpreadDrop — using getData("application/json") as rawData');
                }
            } catch (err) {
                console.log('[DragDropHandler] _handleSpreadDrop — getData("application/json") THREW:', err.message);
            }
        }
        
        // Method 4: Fallback to internal _dragData state
        if ((!rawData || rawData.trim() === '') && this._dragData) {
            console.log('[DragDropHandler] _handleSpreadDrop — METHOD 4: FALLBACK to internal _dragData');
            console.log('[DragDropHandler] _handleSpreadDrop — dataTransfer was empty/null, using _dragData');
            rawData = JSON.stringify({
                imageUuid: this._dragData.imageUuid,
                sourcePool: this._dragData.sourcePool
            });
            console.log('[DragDropHandler] _handleSpreadDrop — constructed fallback rawData:', rawData);
        }
        
        // Final check
        if (!rawData || rawData.trim() === '') {
            console.error('[DragDropHandler] _handleSpreadDrop — FATAL: No drag data available from ANY source!');
            console.error('[DragDropHandler] _handleSpreadDrop — dataTransfer.types was:', e.dataTransfer ? Array.from(e.dataTransfer.types || []) : 'N/A');
            console.error('[DragDropHandler] _handleSpreadDrop — _dragData was:', this._dragData);
            console.log('='.repeat(80));
            return;
        }
        
        console.log('[DragDropHandler] _handleSpreadDrop — FINAL rawData to parse:', rawData);
        
        let dragPayload;
        try {
            console.log('[DragDropHandler] _handleSpreadDrop — attempting JSON.parse...');
            dragPayload = JSON.parse(rawData);
            console.log('[DragDropHandler] _handleSpreadDrop — JSON.parse SUCCEEDED');
            console.log('[DragDropHandler] _handleSpreadDrop — dragPayload:', JSON.stringify(dragPayload));
            console.log('[DragDropHandler] _handleSpreadDrop — dragPayload.imageUuid:', dragPayload.imageUuid);
            console.log('[DragDropHandler] _handleSpreadDrop — dragPayload.sourcePool:', dragPayload.sourcePool);
        } catch (err) {
            console.error('[DragDropHandler] _handleSpreadDrop — JSON.parse FAILED:', err.name, err.message);
            console.error('[DragDropHandler] _handleSpreadDrop — rawData that failed to parse:', rawData);
            console.error('[DragDropHandler] _handleSpreadDrop — rawData typeof:', typeof rawData);
            console.error('[DragDropHandler] _handleSpreadDrop — rawData length:', rawData ? rawData.length : 'null');
            if (rawData) {
                console.error('[DragDropHandler] _handleSpreadDrop — rawData charCodes:', 
                    rawData.split('').map(c => c.charCodeAt(0)).join(','));
            }
            console.log('='.repeat(80));
            return;
        }

        const { imageUuid, sourcePool } = dragPayload;
        console.log('[DragDropHandler] DROP on spread — imageUuid:', imageUuid, 'sourcePool:', sourcePool);

        // Find the image in our data
        const illustrations = this.getIllustrations();
        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.warn('[DragDropHandler] _handleSpreadDrop — image not found in illustrations:', imageUuid);
            return;
        }

        // Calculate drop position relative to the canvas
        const canvasArea = this.$container.find('#spread-canvas-area')[0];
        const canvasRect = canvasArea.getBoundingClientRect();
        const dropX = e.clientX - canvasRect.left;
        const dropY = e.clientY - canvasRect.top;
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        console.log('[DragDropHandler] DROP position — dropX:', dropX, 'dropY:', dropY,
            'canvasWidth:', canvasWidth, 'canvasHeight:', canvasHeight);

        // Determine which side of the spread was dropped on (left or right page)
        const isRightSide = dropX > (canvasWidth / 2);
        const side = isRightSide ? 'right' : 'left';
        console.log('[DragDropHandler] DROP side inferred:', side);

        // Calculate position as percentage of page dimensions
        const pageWidth = canvasWidth / 2;
        const localX = isRightSide ? (dropX - pageWidth) : dropX;
        const posX = Math.max(0, Math.min(1, localX / pageWidth));
        const posY = Math.max(0, Math.min(1, dropY / canvasHeight));

        // Determine page number based on current spread and side
        const currentSpreadStart = this.spreadPreview
            ? this.spreadPreview.getCurrentSpreadStart()
            : 1;
        const pageNumber = isRightSide ? currentSpreadStart + 1 : currentSpreadStart;

        console.log('[DragDropHandler] DROP computed — pageNumber:', pageNumber,
            'posX:', posX.toFixed(3), 'posY:', posY.toFixed(3));

        // Drag-drop always places as full_page — inline placement requires precise
        // text-position targeting that isn't possible from a canvas drop coordinate.
        // Use the context menu (right-click) to insert as inline.
        const mode = 'full_page';
        const height = 100; // full page height
        console.log('[DragDropHandler] DROP mode: full_page (drag-drop always places full page)');

        // Build placement config
        const placement = {
            mode: mode,
            page_number: pageNumber,
            position_x: posX,
            position_y: posY,
            height: height,
            layout: 'margins',
            side: side
        };

        console.log('[DragDropHandler] DROP — placing image with placement:', JSON.stringify(placement));

        // If the image came from a pool (shared or available), it needs to transition to in_book
        if (sourcePool === 'shared' || sourcePool === 'available') {
            this.onImagePlaced(imageUuid, placement);
        } else if (sourcePool === 'in_book') {
            // On-spread repositioning (image already in book, just moved)
            console.log('[DragDropHandler] DROP — on-spread repositioning for:', imageUuid);
            this.onImageMovedOnSpread(imageUuid, posX, posY);
        }

        this.onStateChanged();
        console.log('[DragDropHandler] DROP on spread complete — imageUuid:', imageUuid, 'placement:', placement.mode, 'page:', placement.page_number);
    }

    // =========================================================================
    // In-Book Pool Drop Target — handle drops into the in-book pool section
    // =========================================================================

    /**
     * Attach dragover and drop handlers to the in-book pool section.
     * Pool-to-in_book (not spread): show warning border + tooltip.
     */
    _attachInBookDropTarget() {
        const inBookSection = this.$container.find('#pool-in-book')[0] ||
                              this.$container.find('#in-book-pool-container')[0];
        if (!inBookSection) {
            console.warn('[DragDropHandler] _attachInBookDropTarget — in-book pool section not found');
            return;
        }

        const self = this;

        const onDragOver = (e) => {
            // Only accept drops from available or shared pools
            if (self._dragData && (self._dragData.sourcePool === 'available' || self._dragData.sourcePool === 'shared')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                inBookSection.classList.add('drop-target-active');
            }
        };

        const onDragLeave = (e) => {
            inBookSection.classList.remove('drop-target-active');
        };

        const onDrop = (e) => {
            e.preventDefault();
            inBookSection.classList.remove('drop-target-active');
            self._handleInBookDrop(e);
        };

        inBookSection.addEventListener('dragover', onDragOver);
        inBookSection.addEventListener('dragleave', onDragLeave);
        inBookSection.addEventListener('drop', onDrop);

        this._boundHandlers.push({ element: inBookSection, event: 'dragover', handler: onDragOver });
        this._boundHandlers.push({ element: inBookSection, event: 'dragleave', handler: onDragLeave });
        this._boundHandlers.push({ element: inBookSection, event: 'drop', handler: onDrop });

        console.log('[DragDropHandler] _attachInBookDropTarget — in-book pool is now a drop target');
    }

    /**
     * Handle a drop into the in-book pool (not onto the spread).
     * Shows warning border + "Click to configure placement" tooltip on the dropped image.
     */
    _handleInBookDrop(e) {
        let dragPayload;
        try {
            dragPayload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch (err) {
            console.warn('[DragDropHandler] _handleInBookDrop — could not parse drag data:', err.message);
            return;
        }

        const { imageUuid, sourcePool } = dragPayload;
        console.log('[DragDropHandler] DROP on in-book pool — imageUuid:', imageUuid, 'sourcePool:', sourcePool);

        if (sourcePool !== 'available' && sourcePool !== 'shared') {
            console.log('[DragDropHandler] _handleInBookDrop — ignoring drop from pool:', sourcePool);
            return;
        }

        // Move image to in_book without placement (pending state)
        this.onImageDroppedInBook(imageUuid);
        this.onStateChanged();

        console.log('[DragDropHandler] DROP on in-book pool complete — image now in pending state with warning border');
    }

    // =========================================================================
    // Pool-to-Pool Drop Targets — Shared↔Available transfers
    // =========================================================================

    /**
     * Attach dragover and drop handlers to the shared and available pool sections
     * for cross-pool transfers.
     */
    _attachPoolDropTargets() {
        this._attachAvailablePoolDropTarget();
        this._attachSharedPoolDropTarget();
    }

    /**
     * Attach drop target to the available pool section.
     * Accepts drops from shared pool (copy semantics).
     */
    _attachAvailablePoolDropTarget() {
        const availableSection = this.$container.find('.available-pool-section')[0] ||
                                 this.$container.find('#pool-available-container')[0];
        if (!availableSection) {
            console.warn('[DragDropHandler] _attachAvailablePoolDropTarget — available pool section not found');
            return;
        }

        const self = this;

        const onDragOver = (e) => {
            if (self._dragData && self._dragData.sourcePool === 'shared') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                availableSection.classList.add('drop-target-active');
            }
        };

        const onDragLeave = (e) => {
            availableSection.classList.remove('drop-target-active');
        };

        const onDrop = (e) => {
            e.preventDefault();
            availableSection.classList.remove('drop-target-active');
            self._handleAvailablePoolDrop(e);
        };

        availableSection.addEventListener('dragover', onDragOver);
        availableSection.addEventListener('dragleave', onDragLeave);
        availableSection.addEventListener('drop', onDrop);

        this._boundHandlers.push({ element: availableSection, event: 'dragover', handler: onDragOver });
        this._boundHandlers.push({ element: availableSection, event: 'dragleave', handler: onDragLeave });
        this._boundHandlers.push({ element: availableSection, event: 'drop', handler: onDrop });

        console.log('[DragDropHandler] _attachAvailablePoolDropTarget — available pool is now a drop target for shared images');
    }

    /**
     * Handle a drop onto the available pool section (shared→available copy).
     */
    _handleAvailablePoolDrop(e) {
        let dragPayload;
        try {
            dragPayload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch (err) {
            console.warn('[DragDropHandler] _handleAvailablePoolDrop — could not parse drag data:', err.message);
            return;
        }

        const { imageUuid, sourcePool } = dragPayload;
        console.log('[DragDropHandler] DROP on available pool — imageUuid:', imageUuid, 'sourcePool:', sourcePool);

        if (sourcePool !== 'shared') {
            console.log('[DragDropHandler] _handleAvailablePoolDrop — ignoring drop from pool:', sourcePool);
            return;
        }

        // Copy shared image to available pool (copy semantics — original stays in shared)
        console.log('[DragDropHandler] DROP — copying shared image to available pool (copy semantics)');
        this.onSharedToAvailable(imageUuid);
        this.onStateChanged();

        console.log('[DragDropHandler] DROP on available pool complete — shared→available copy for:', imageUuid);
    }

    /**
     * Attach drop target to the shared pool section.
     * Accepts drops from available pool (move semantics).
     */
    _attachSharedPoolDropTarget() {
        const sharedSection = this.$container.find('.shared-pool-section')[0] ||
                              this.$container.find('#pool-shared')[0];
        if (!sharedSection) {
            console.warn('[DragDropHandler] _attachSharedPoolDropTarget — shared pool section not found');
            return;
        }

        const self = this;

        const onDragOver = (e) => {
            if (self._dragData && self._dragData.sourcePool === 'available') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                sharedSection.classList.add('drop-target-active');
            }
        };

        const onDragLeave = (e) => {
            sharedSection.classList.remove('drop-target-active');
        };

        const onDrop = (e) => {
            e.preventDefault();
            sharedSection.classList.remove('drop-target-active');
            self._handleSharedPoolDrop(e);
        };

        sharedSection.addEventListener('dragover', onDragOver);
        sharedSection.addEventListener('dragleave', onDragLeave);
        sharedSection.addEventListener('drop', onDrop);

        this._boundHandlers.push({ element: sharedSection, event: 'dragover', handler: onDragOver });
        this._boundHandlers.push({ element: sharedSection, event: 'dragleave', handler: onDragLeave });
        this._boundHandlers.push({ element: sharedSection, event: 'drop', handler: onDrop });

        console.log('[DragDropHandler] _attachSharedPoolDropTarget — shared pool is now a drop target for available images');
    }

    /**
     * Handle a drop onto the shared pool section (available→shared move).
     */
    _handleSharedPoolDrop(e) {
        let dragPayload;
        try {
            dragPayload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch (err) {
            console.warn('[DragDropHandler] _handleSharedPoolDrop — could not parse drag data:', err.message);
            return;
        }

        const { imageUuid, sourcePool } = dragPayload;
        console.log('[DragDropHandler] DROP on shared pool — imageUuid:', imageUuid, 'sourcePool:', sourcePool);

        if (sourcePool !== 'available') {
            console.log('[DragDropHandler] _handleSharedPoolDrop — ignoring drop from pool:', sourcePool);
            return;
        }

        // Move available image to shared pool (move semantics)
        console.log('[DragDropHandler] DROP — moving available image to shared pool (move semantics)');
        this.onAvailableToShared(imageUuid);
        this.onStateChanged();

        console.log('[DragDropHandler] DROP on shared pool complete — available→shared move for:', imageUuid);
    }

    // =========================================================================
    // On-Spread Drag Interactions — repositioning and edge-drag resize
    // =========================================================================

    /**
     * Attach mousedown/mousemove/mouseup handlers to the spread canvas for
     * on-spread repositioning and edge-drag resizing of placed images.
     */
    _attachSpreadDragInteractions() {
        const canvas = this.$container.find('.spread-preview-canvas')[0];
        if (!canvas) {
            console.warn('[DragDropHandler] _attachSpreadDragInteractions — canvas not found');
            return;
        }

        const self = this;
        let isDragging = false;
        let isResizing = false;
        let dragImageUuid = null;
        let startMouseX = 0;
        let startMouseY = 0;
        let startPosX = 0;
        let startPosY = 0;
        let startHeight = 0;
        let aspectRatio = 1;

        const onMouseDown = (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;

            const hitResult = self._hitTestSpreadImage(e);
            if (!hitResult) return;

            const { imageUuid: hitUuid, isEdge, imgRect } = hitResult;
            dragImageUuid = hitUuid;

            const illustrations = self.getIllustrations();
            const img = illustrations.find(i => i.image_uuid === hitUuid);
            if (!img || img.pool !== 'in_book') return;

            // Locked images cannot be moved or resized
            if (img.lock_state) {
                console.log('[DragDropHandler] onMouseDown — image is LOCKED, ignoring drag/resize:', hitUuid);
                dragImageUuid = null;
                return;
            }

            const placement = img.placement || {};
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startPosX = placement.position_x || 0.5;
            startPosY = placement.position_y || 0.5;
            startHeight = placement.height || 8;
            aspectRatio = (img.original_width_px || 1) / (img.original_height_px || 1);

            if (isEdge) {
                isResizing = true;
                isDragging = false;
                console.log('[DragDropHandler] On-spread RESIZE START — imageUuid:', hitUuid,
                    'startHeight:', startHeight, 'aspectRatio:', aspectRatio.toFixed(3));
            } else {
                isDragging = true;
                isResizing = false;
                console.log('[DragDropHandler] On-spread REPOSITION START — imageUuid:', hitUuid,
                    'startPosX:', startPosX.toFixed(3), 'startPosY:', startPosY.toFixed(3));
            }

            e.preventDefault();
        };

        const onMouseMove = (e) => {
            // Update cursor based on what's under the mouse (even when not dragging)
            if (!isDragging && !isResizing) {
                const hitResult = self._hitTestSpreadImage(e);
                if (hitResult) {
                    const illustrations = self.getIllustrations();
                    const hovered = illustrations.find(i => i.image_uuid === hitResult.imageUuid);
                    if (hovered && hovered.lock_state) {
                        canvas.style.cursor = 'not-allowed';
                    } else if (hitResult.isEdge) {
                        canvas.style.cursor = 'nwse-resize';
                    } else {
                        canvas.style.cursor = 'grab';
                    }
                } else {
                    canvas.style.cursor = '';
                }
                return;
            }

            const illustrations = self.getIllustrations();
            const img = illustrations.find(i => i.image_uuid === dragImageUuid);
            if (!img) return;

            const canvasRect = canvas.getBoundingClientRect();
            const canvasWidth = canvasRect.width;
            const canvasHeight = canvasRect.height;
            const pageWidth = canvasWidth / 2;

            if (isDragging) {
                // Reposition: calculate new position as percentage
                const deltaX = (e.clientX - startMouseX) / pageWidth;
                const deltaY = (e.clientY - startMouseY) / canvasHeight;
                const newPosX = Math.max(0, Math.min(1, startPosX + deltaX));
                const newPosY = Math.max(0, Math.min(1, startPosY + deltaY));

                if (!img.placement) img.placement = {};
                img.placement.position_x = newPosX;
                img.placement.position_y = newPosY;

                // Trigger local reflow (update spread preview)
                self.onImageMovedOnSpread(dragImageUuid, newPosX, newPosY);
            } else if (isResizing) {
                // Edge-drag resize: calculate new height with aspect ratio locked
                const deltaY = e.clientY - startMouseY;
                const heightDelta = (deltaY / canvasHeight) * 100; // percentage change
                const placement = img.placement || {};
                const mode = placement.mode || 'inline';

                let newHeight;
                if (mode === 'inline') {
                    // For inline, height is in lines — use the spread preview scale to get
                    // accurate pixels-per-line, then snap to nearest integer line count.
                    const lineHeightPt = (self.spreadPreview && self.spreadPreview.lineHeightPt) || 14;
                    const scale = (self.spreadPreview && self.spreadPreview.scale) || 1;
                    const lineHeightPx = lineHeightPt * (scale / 72);
                    const lineDelta = deltaY / lineHeightPx;
                    newHeight = Math.max(1, Math.min(40, Math.round(startHeight + lineDelta)));
                } else {
                    // For full_page/plate, height is percentage
                    newHeight = Math.max(10, Math.min(100, startHeight + heightDelta));
                }

                if (!img.placement) img.placement = {};
                img.placement.height = newHeight;

                // Trigger local reflow
                self.onImageResizedOnSpread(dragImageUuid, newHeight);
            }
        };

        const onMouseUp = (e) => {
            if (!isDragging && !isResizing) return;

            if (isDragging) {
                console.log('[DragDropHandler] On-spread REPOSITION END — imageUuid:', dragImageUuid);
                self.onStateChanged();
            } else if (isResizing) {
                console.log('[DragDropHandler] On-spread RESIZE END — imageUuid:', dragImageUuid);
                self.onStateChanged();
            }

            isDragging = false;
            isResizing = false;
            dragImageUuid = null;
            canvas.style.cursor = '';
        };

        canvas.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        this._boundHandlers.push({ element: canvas, event: 'mousedown', handler: onMouseDown });
        this._boundHandlers.push({ element: document, event: 'mousemove', handler: onMouseMove });
        this._boundHandlers.push({ element: document, event: 'mouseup', handler: onMouseUp });

        console.log('[DragDropHandler] _attachSpreadDragInteractions — mouse handlers attached for reposition/resize');
    }

    // =========================================================================
    // Hit Testing — determine if a mouse event hits an image or its edge handles
    // =========================================================================

    /**
     * Perform hit testing on the spread canvas to determine if the mouse is over
     * a placed image or its edge handles (for resize).
     * @param {MouseEvent} e
     * @returns {{ imageUuid: string, isEdge: boolean, imgRect: object } | null}
     */
    _hitTestSpreadImage(e) {
        const canvas = this.$container.find('.spread-preview-canvas')[0];
        if (!canvas || !this.spreadPreview) return null;

        const canvasRect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const clickX = (e.clientX - canvasRect.left) * dpr;
        const clickY = (e.clientY - canvasRect.top) * dpr;

        const scale = this.spreadPreview.scale;
        const pageW = this.pageConfig.pageWidthInches * scale;
        const pageH = this.pageConfig.pageHeightInches * scale;
        const marginPx = this.pageConfig.marginInches * scale;

        const leftPage = this.spreadPreview.getCurrentSpreadStart();
        const rightPage = leftPage + 1;

        const illustrations = this.getIllustrations();
        const spreadImages = illustrations.filter(img => {
            if (img.pool !== 'in_book') return false;
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            return pageNum === leftPage || pageNum === rightPage;
        });

        // Check in reverse order (top-most first)
        for (let i = spreadImages.length - 1; i >= 0; i--) {
            const img = spreadImages[i];
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number;
            const isLeftPage = (pageNum === leftPage);
            const pageOffsetX = isLeftPage ? 0 : pageW;

            const imgRect = this.spreadPreview._calculateImageRect(
                img,
                placement.mode || img.placement_mode || 'inline',
                placement.layout || img.layout || 'margins',
                placement.height || img.height || 8,
                placement.position_x || img.position_x || 0.5,
                placement.position_y || img.position_y || 0.5,
                pageOffsetX, pageW, pageH, marginPx
            );

            // Check if click is within the image bounds
            if (clickX >= imgRect.x && clickX <= imgRect.x + imgRect.w &&
                clickY >= imgRect.y && clickY <= imgRect.y + imgRect.h) {

                // Check if click is near the edges (within 8px for resize handles)
                const edgeThreshold = 8 * dpr;
                const nearRight = Math.abs(clickX - (imgRect.x + imgRect.w)) < edgeThreshold;
                const nearBottom = Math.abs(clickY - (imgRect.y + imgRect.h)) < edgeThreshold;
                const nearLeft = Math.abs(clickX - imgRect.x) < edgeThreshold;
                const nearTop = Math.abs(clickY - imgRect.y) < edgeThreshold;
                const isEdge = nearRight || nearBottom || nearLeft || nearTop;

                return {
                    imageUuid: img.image_uuid,
                    isEdge,
                    imgRect
                };
            }
        }

        return null;
    }
}
