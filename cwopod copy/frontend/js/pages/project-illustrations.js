/**
 * Illustrations Step page module — manages image pools, spread preview, and placement toolbar.
 * Loaded by the project wizard when the Illustrations step is active.
 * 
 * Exports: render($container, params)
 * 
 * Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.6, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { api } from '../api.js';
import { showError, showSuccess, clearMessages, setLoading, escapeHtml } from '../dom.js';
import { SpreadPreview } from '../components/spread-preview.js';
import { AvailablePool } from '../components/available-pool.js';
import { SharedPool } from '../components/shared-pool.js';
import { InBookPool } from '../components/in-book-pool.js';
import { DragDropHandler } from '../components/drag-drop-handler.js';
import { ContextMenu } from '../components/context-menu.js';
import { LocalReflowEngine } from '../components/local-reflow.js';
import { recalculateResolutionWarning, recalculateAllResolutionWarnings } from '../utils/dpi-calculator.js';

/**
 * Undo/Redo action stack — in-memory only, cleared on page reload.
 * Each action: { type: string, before: object, after: object, description: string }
 */
class ActionStack {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        console.log('[Illustrations][ActionStack] Initialized (empty, in-memory only)');
    }

    push(action) {
        this.undoStack.push(action);
        this.redoStack = []; // Clear redo on new action
        console.log('[Illustrations][ActionStack] Pushed action:', action.type, action.description,
            '| undoStack size:', this.undoStack.length, '| redoStack cleared');
    }

    undo() {
        if (this.undoStack.length === 0) {
            console.log('[Illustrations][ActionStack] Undo called but stack is empty');
            return null;
        }
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        console.log('[Illustrations][ActionStack] Undo:', action.type, action.description,
            '| undoStack size:', this.undoStack.length, '| redoStack size:', this.redoStack.length);
        return action;
    }

    redo() {
        if (this.redoStack.length === 0) {
            console.log('[Illustrations][ActionStack] Redo called but stack is empty');
            return null;
        }
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        console.log('[Illustrations][ActionStack] Redo:', action.type, action.description,
            '| undoStack size:', this.undoStack.length, '| redoStack size:', this.redoStack.length);
        return action;
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
}


/**
 * Main render function — called by the project wizard when the Illustrations step is active.
 * @param {jQuery} $container - The container element to render into
 * @param {object} params - Parameters from the wizard, includes projectId
 */
export async function render($container, params) {
    const projectId = params.projectId;
    console.log('[Illustrations] render() called, projectId:', projectId);

    // State
    let illustrations = []; // All illustration DTOs
    let selectedImageUuid = null;
    const actionStack = new ActionStack();
    let inBookPool = null;
    let sharedPoolComponent = null;
    let availablePoolComponent = null;
    let spreadPreview = null;
    let dragDropHandler = null;
    let localReflowEngine = null;

    // Page configuration for DPI calculations (Requirements: 17.1, 17.2)
    const pageConfig = {
        pageWidthInches: 5.5,
        pageHeightInches: 8.5,
        lineHeightPt: 14.3
    };

    // --- Context Menu instance (Requirements: 11.1, 11.2, 11.3, 11.4) ---
    const contextMenu = new ContextMenu({
        onAction: handleContextMenuAction
    });
    console.log('[Illustrations] ContextMenu instance created');

    $container.html('<p class="loading">Loading illustrations...</p>');

    // --- Load illustration data ---
    try {
        console.log('[Illustrations] Loading illustration data via GET /api/projects/' + projectId + '/illustrations');
        const data = await api.get(`/projects/${projectId}/illustrations`);
        illustrations = data.illustrations || data || [];
        console.log('[Illustrations] Loaded', illustrations.length, 'illustrations');
    } catch (err) {
        console.error('[Illustrations] Failed to load illustrations:', err.message, err);
        $container.html(`<div class="panel"><p class="error">Failed to load illustrations: ${escapeHtml(err.message)}</p></div>`);
        return;
    }

    // --- Auto-populate available pool on first visit ---
    const hasAvailable = illustrations.some(img => img.pool === 'available');
    if (!hasAvailable) {
        console.log('[Illustrations] No available pool images found — auto-populating from extracted images');
        try {
            const populated = await api.post(`/projects/${projectId}/illustrations/auto-populate`);
            const newImages = populated.illustrations || populated || [];
            console.log('[Illustrations] Auto-populated', newImages.length, 'images into available pool');
            if (newImages.length > 0) {
                illustrations = illustrations.concat(newImages);
            }
        } catch (err) {
            console.warn('[Illustrations] Auto-populate failed (non-fatal):', err.message);
        }
    }

    // --- Render the two-column layout ---
    renderLayout();

    // --- Initial DPI recalculation for all in_book images (Requirements: 17.1, 17.2) ---
    console.log('[Illustrations] Performing initial DPI recalculation for all in_book images');
    recalculateAllResolutionWarnings(illustrations, pageConfig);

    function getPoolImages(pool) {
        return illustrations.filter(img => img.pool === pool);
    }

    function renderLayout() {
        console.log('[Illustrations] renderLayout() — building two-column layout');

        const html = `
            <div class="illustrations-page">
                <div class="illustrations-toolbar-top">
                    <h2>Illustrations</h2>
                    <div class="illustrations-actions">
                        <button class="btn btn-sm secondary" id="ill-undo" title="Undo" ${!actionStack.canUndo() ? 'disabled' : ''}>&#8617; Undo</button>
                        <button class="btn btn-sm secondary" id="ill-redo" title="Redo" ${!actionStack.canRedo() ? 'disabled' : ''}>&#8618; Redo</button>
                        <button class="btn btn-sm primary" id="ill-save">&#128190; Save</button>
                    </div>
                </div>
                <div class="illustrations-columns">
                    <div class="illustrations-left-column">
                        <div id="shared-pool-container"></div>
                        <div id="pool-available-container"></div>
                        <div id="in-book-pool-container"></div>
                    </div>
                    <div class="illustrations-right-column">
                        <div class="spread-preview-container" id="spread-preview">
                            <div class="spread-canvas-area" id="spread-canvas-area"></div>
                        </div>
                        <div class="spread-navigation" id="spread-navigation">
                            <div class="spread-nav-row">
                                <button class="btn btn-sm secondary" id="nav-prev-chapter" title="Previous chapter">&#9664;&#9664; Ch</button>
                                <button class="btn btn-sm secondary" id="nav-prev-spread" title="Previous spread">&#9664; Prev</button>
                                <span class="nav-page-display" id="nav-page-display">Pages 1–2</span>
                                <button class="btn btn-sm secondary" id="nav-next-spread" title="Next spread">Next &#9654;</button>
                                <button class="btn btn-sm secondary" id="nav-next-chapter" title="Next chapter">Ch &#9654;&#9654;</button>
                            </div>
                            <div class="spread-nav-row spread-nav-inputs">
                                <label class="nav-input-label">Go to page:
                                    <input type="number" id="nav-page-input" class="nav-input" min="1" placeholder="Page #" />
                                </label>
                                <label class="nav-input-label">Go to chapter:
                                    <input type="text" id="nav-chapter-input" class="nav-input" placeholder="Ch # or name" />
                                </label>
                            </div>
                        </div>
                        <div class="spread-toolbar" id="spread-toolbar">
                            <span class="toolbar-hint">Select an image to see placement controls</span>
                        </div>
                    </div>
                </div>
                <div id="illustrations-status"></div>
            </div>
        `;

        $container.html(html);
        console.log('[Illustrations] Layout rendered, binding events');

        // --- Instantiate SharedPool component ---
        sharedPoolComponent = new SharedPool({
            $container: $container.find('#shared-pool-container'),
            getImages: () => getPoolImages('shared'),
            onImageSelect: (uuid) => {
                console.log('[Illustrations] SharedPool onImageSelect:', uuid);
                selectedImageUuid = uuid;
                sharedPoolComponent.setSelectedUuid(uuid);
                if (availablePoolComponent) availablePoolComponent.setSelectedImage(null);
                if (inBookPool) inBookPool.setSelectedImage(null);
                renderToolbar();
                updateSpreadPreview();
            },
            onLabelRename: handleSharedPoolLabelRename,
            onImageUploaded: handleSharedPoolImageUploaded,
            selectedUuid: selectedImageUuid,
            projectId: projectId
        });
        sharedPoolComponent.render();
        console.log('[Illustrations] SharedPool component initialized and rendered');

        // --- Instantiate AvailablePool component ---
        availablePoolComponent = new AvailablePool({
            projectId,
            $container: $container.find('#pool-available-container'),
            getImages: () => getPoolImages('available'),
            selectedImageUuid,
            onImageSelect: (uuid) => {
                console.log('[Illustrations] AvailablePool onImageSelect:', uuid);
                selectedImageUuid = uuid;
                if (sharedPoolComponent) sharedPoolComponent.setSelectedUuid(null);
                availablePoolComponent.setSelectedImage(uuid);
                if (inBookPool) inBookPool.setSelectedImage(null);
                renderToolbar();
                updateSpreadPreview();
            },
            onImageDelete: async (uuid) => {
                console.log('[Illustrations] AvailablePool onImageDelete:', uuid);
                const img = illustrations.find(i => i.image_uuid === uuid);
                if (!img) {
                    console.warn('[Illustrations] onImageDelete — image not found:', uuid);
                    return;
                }
                actionStack.push({
                    type: 'delete',
                    before: { image_uuid: uuid, pool: img.pool, label: img.label },
                    after: { image_uuid: uuid, pool: '__deleted__' },
                    description: `Delete ${img.label} from available pool`
                });
                illustrations = illustrations.filter(i => i.image_uuid !== uuid);
                if (selectedImageUuid === uuid) {
                    selectedImageUuid = null;
                }
                updateUndoRedoButtons();
                availablePoolComponent.render();
                renderToolbar();
                try {
                    await api.delete(`/projects/${projectId}/illustrations/${uuid}`);
                    console.log('[Illustrations] Backend delete successful for:', uuid);
                } catch (err) {
                    console.error('[Illustrations] Backend delete failed for:', uuid, err.message, err);
                }
            },
            onImageUploaded: (imageDTO) => {
                console.log('[Illustrations] AvailablePool onImageUploaded:', imageDTO.image_uuid, imageDTO.label);
                const newImage = {
                    image_uuid: imageDTO.image_uuid,
                    label: imageDTO.label || imageDTO.filename || 'Untitled',
                    pool: 'available',
                    source: 'uploaded',
                    placement: null,
                    lock_state: false,
                    resolution_warning: false,
                    file_ext: imageDTO.file_ext,
                    original_width_px: imageDTO.original_width_px,
                    original_height_px: imageDTO.original_height_px
                };
                illustrations.push(newImage);
                actionStack.push({
                    type: 'upload',
                    before: { image_uuid: newImage.image_uuid, pool: '__none__' },
                    after: { image_uuid: newImage.image_uuid, pool: 'available', label: newImage.label },
                    description: `Upload ${newImage.label} to available pool`
                });
                updateUndoRedoButtons();
                availablePoolComponent.render();
                console.log('[Illustrations] New image added to available pool — total:', illustrations.length);
            },
            onLabelRenamed: async (uuid, newLabel) => {
                console.log('[Illustrations] AvailablePool onLabelRenamed:', uuid, 'newLabel:', newLabel);
                const img = illustrations.find(i => i.image_uuid === uuid);
                if (!img) {
                    console.warn('[Illustrations] onLabelRenamed — image not found:', uuid);
                    return;
                }
                const oldLabel = img.label;
                img.label = newLabel;
                actionStack.push({
                    type: 'rename',
                    before: { image_uuid: uuid, label: oldLabel },
                    after: { image_uuid: uuid, label: newLabel },
                    description: `Rename "${oldLabel}" to "${newLabel}"`
                });
                updateUndoRedoButtons();
                try {
                    await api.patch(`/projects/${projectId}/illustrations/${uuid}`, { label: newLabel });
                    console.log('[Illustrations] Backend label rename successful for:', uuid);
                } catch (err) {
                    console.error('[Illustrations] Backend label rename failed for:', uuid, err.message, err);
                }
            }
        });
        availablePoolComponent.render();

        // --- Instantiate InBookPool component ---
        inBookPool = new InBookPool({
            $container: $container.find('#in-book-pool-container'),
            projectId: projectId,
            getImages: () => getPoolImages('in_book'),
            onImageSelect: (uuid) => {
                console.log('[Illustrations] InBookPool onImageSelect:', uuid);
                selectedImageUuid = uuid;
                if (sharedPoolComponent) sharedPoolComponent.setSelectedUuid(null);
                if (availablePoolComponent) availablePoolComponent.setSelectedImage(null);
                inBookPool.setSelectedImage(uuid);
                renderToolbar();
                updateSpreadPreview();
            },
            onLockAll: handleLockAll,
            onImageClick: (uuid) => {
                console.log('[Illustrations] InBookPool onImageClick (pending image):', uuid);
                selectedImageUuid = uuid;
                if (sharedPoolComponent) sharedPoolComponent.setSelectedUuid(null);
                if (availablePoolComponent) availablePoolComponent.setSelectedImage(null);
                inBookPool.setSelectedImage(uuid);
                renderToolbar();
                updateSpreadPreview();
            },
            selectedImageUuid: selectedImageUuid
        });
        inBookPool.render();

        // Initialize spread preview component
        initSpreadPreview();

        // Initialize local reflow engine (Requirements: 7.1, 7.5, 9.1, 13.1)
        initLocalReflowEngine();

        // Bind spread navigation controls
        bindSpreadNavigation();

        // Bind top toolbar buttons
        $container.find('#ill-undo').on('click', handleUndo);
        $container.find('#ill-redo').on('click', handleRedo);
        $container.find('#ill-save').on('click', handleSave);

        // Bind context menus on pool thumbnails (Requirements: 11.1, 11.2, 11.3, 11.4)
        bindContextMenus();

        updateUndoRedoButtons();

        // Initialize drag-and-drop handler (Requirements: 10.1, 10.2, 10.3, 10.4, 10.5)
        initDragDropHandler();

        console.log('[Illustrations] renderLayout() complete — all components initialized');
    }

    // --- Context Menu Binding (Requirements: 11.1, 11.2, 11.3, 11.4) ---

    /**
     * Bind contextmenu (right-click) events on all pool thumbnail containers.
     * Uses event delegation so newly rendered thumbnails are automatically covered.
     */
    function bindContextMenus() {
        console.log('[Illustrations] bindContextMenus() — binding contextmenu events on pool containers');

        // Delegate contextmenu on the entire illustrations columns area
        $container.find('.illustrations-left-column').on('contextmenu', '.pool-thumbnail', function (e) {
            const uuid = $(this).data('uuid');
            const pool = $(this).data('pool') || null;
            console.log('[Illustrations][ContextMenu] Right-click on thumbnail — uuid:', uuid, 'pool attr:', pool);

            const img = illustrations.find(i => i.image_uuid === uuid);
            if (!img) {
                console.warn('[Illustrations][ContextMenu] Image not found for uuid:', uuid);
                return;
            }

            console.log('[Illustrations][ContextMenu] Showing context menu for:', img.image_uuid,
                'label:', img.label, 'pool:', img.pool);
            contextMenu.show(e.originalEvent, img);
        });

        console.log('[Illustrations] bindContextMenus() — context menu events bound via delegation');
    }

    // --- Shared Pool event handlers ---

    function handleSharedPoolLabelRename(uuid, newLabel) {
        console.log('[Illustrations] handleSharedPoolLabelRename, uuid:', uuid, 'newLabel:', newLabel);
        const img = illustrations.find(i => i.image_uuid === uuid);
        if (!img) {
            console.warn('[Illustrations] handleSharedPoolLabelRename — image not found:', uuid);
            return;
        }

        const oldLabel = img.label;
        img.label = newLabel;

        actionStack.push({
            type: 'rename',
            before: { image_uuid: uuid, label: oldLabel },
            after: { image_uuid: uuid, label: newLabel },
            description: `Rename "${oldLabel}" to "${newLabel}"`
        });
        updateUndoRedoButtons();

        // Persist the rename to the backend
        api.patch(`/user/shared-images/${uuid}`, { label: newLabel })
            .then(() => {
                console.log('[Illustrations] Shared pool label rename persisted, uuid:', uuid, 'newLabel:', newLabel);
            })
            .catch(err => {
                console.error('[Illustrations] Shared pool label rename failed:', err.message, err);
                // Revert on failure
                img.label = oldLabel;
                if (sharedPoolComponent) sharedPoolComponent.render();
            });

        console.log('[Illustrations] Label renamed in local state:', uuid, oldLabel, '->', newLabel);
    }

    function handleSharedPoolImageUploaded(newImageDTO) {
        console.log('[Illustrations] handleSharedPoolImageUploaded, new image:', newImageDTO);
        const newImage = {
            image_uuid: newImageDTO.image_uuid,
            label: newImageDTO.label || newImageDTO.filename || 'Untitled',
            pool: 'shared',
            source: 'uploaded',
            placement: null,
            lock_state: false,
            resolution_warning: false,
            file_ext: newImageDTO.file_ext || '',
            original_width_px: newImageDTO.original_width_px || 0,
            original_height_px: newImageDTO.original_height_px || 0
        };
        illustrations.push(newImage);
        console.log('[Illustrations] New shared image added to state, total illustrations:', illustrations.length);

        if (sharedPoolComponent) {
            sharedPoolComponent.render();
        }
    }

    // --- Spread Preview ---

    /**
     * Initialize the SpreadPreview canvas component in the right column.
     */
    function initSpreadPreview() {
        const canvasArea = $container.find('#spread-canvas-area')[0];
        if (!canvasArea) {
            console.error('[Illustrations] initSpreadPreview — #spread-canvas-area not found in DOM');
            return;
        }

        console.log('[Illustrations] initSpreadPreview — creating SpreadPreview instance');

        spreadPreview = new SpreadPreview(canvasArea, {
            pageWidthInches: 5.5,
            pageHeightInches: 8.5,
            bleedInches: 0.125,
            marginInches: 0.75,
            lineHeightPt: 14,
            onImageSelect: (uuid) => {
                console.log('[Illustrations] SpreadPreview onImageSelect callback:', uuid);
                selectedImageUuid = uuid;
                if (sharedPoolComponent) sharedPoolComponent.setSelectedUuid(null);
                if (availablePoolComponent) availablePoolComponent.setSelectedImage(null);
                if (inBookPool) inBookPool.setSelectedImage(uuid);
                renderToolbar();
            }
        });

        // Set initial data
        const inBookImages = getPoolImages('in_book');
        const maxPage = inBookImages.reduce((max, img) => {
            const p = (img.placement && img.placement.page_number) || img.page_number || 0;
            return Math.max(max, p);
        }, 0);
        const estimatedTotalPages = Math.max(maxPage, 100);
        spreadPreview.setData(illustrations, estimatedTotalPages);

        if (selectedImageUuid) {
            spreadPreview.setSelectedImage(selectedImageUuid);
        }

        console.log('[Illustrations] initSpreadPreview — complete, estimatedTotalPages:', estimatedTotalPages);
    }

    /**
     * Initialize the LocalReflowEngine for client-side text displacement feedback.
     * Integrates calculateFullPageDisplacement() for full_page mode.
     * Requirements: 7.1, 7.5, 9.1, 13.1, 13.3, 13.4
     */
    function initLocalReflowEngine() {
        console.log('[Illustrations] initLocalReflowEngine — creating LocalReflowEngine instance');

        localReflowEngine = new LocalReflowEngine({
            projectId,
            lineHeightPt: 14,
            pageWidthInches: 5.5,
            pageHeightInches: 8.5,
            marginInches: 0.75,
            debounceMs: 500,
            onReflowComplete: (result) => {
                console.log('[Illustrations] LocalReflow onReflowComplete — type:', result.type,
                    'linesDisplaced:', result.linesDisplaced || 0,
                    'textPushedToNextPage:', result.textPushedToNextPage || false);
                // Update spread preview with reflow result
                if (spreadPreview) {
                    spreadPreview.render();
                }
            },
            onBackendRenderComplete: (result) => {
                console.log('[Illustrations] LocalReflow onBackendRenderComplete — authoritative render received');
                // Replace client approximation with backend render
                if (spreadPreview) {
                    spreadPreview.render();
                }
            }
        });

        console.log('[Illustrations] initLocalReflowEngine — complete');
    }

    /**
     * Trigger local reflow for the current spread.
     * Called on place, move, resize operations for full_page mode.
     * Integrates calculateFullPageDisplacement() for text displacement.
     * Requirements: 7.1, 7.5, 13.1
     *
     * @param {string} operation - 'place', 'move', or 'resize'
     * @param {object} image - The illustration DTO being operated on
     */
    function triggerLocalReflow(operation, image) {
        if (!localReflowEngine) {
            console.warn('[Illustrations] triggerLocalReflow — localReflowEngine not initialized');
            return;
        }
        if (!image) {
            console.warn('[Illustrations] triggerLocalReflow — no image provided');
            return;
        }

        const spreadStartPage = spreadPreview ? spreadPreview.getCurrentSpreadStart() : 1;
        const spreadImages = getPoolImages('in_book').filter(img => {
            const placement = img.placement || {};
            const pageNum = placement.page_number || img.page_number || 0;
            return pageNum === spreadStartPage || pageNum === spreadStartPage + 1;
        });

        console.log('[Illustrations] triggerLocalReflow — operation:', operation,
            '| image:', image.image_uuid,
            '| mode:', (image.placement && image.placement.mode) || 'unknown',
            '| spreadStartPage:', spreadStartPage,
            '| spreadImages:', spreadImages.length);

        const result = localReflowEngine.performReflow({
            operation,
            image,
            spreadStartPage,
            spreadImages
        });

        if (result && result.type === 'full_page') {
            console.log('[Illustrations] triggerLocalReflow — full_page displacement:',
                'pagesDisplaced:', result.pagesDisplaced,
                '| textPushedToNextPage:', result.textPushedToNextPage,
                '| linesDisplaced:', result.linesDisplaced);
        }

        if (result && result.type === 'plate') {
            console.log('[Illustrations] triggerLocalReflow — plate insertion:',
                'pagesInserted:', result.pagesInserted,
                '| textDisplaced:', result.textDisplaced,
                '| imageSide:', result.imageSide,
                '| pageNumber:', result.pageNumber);
            // Plate inserts a new sheet (image page + blank page) — no text displacement
            // The spread preview needs to account for the inserted pages
            if (spreadPreview) {
                const totalPages = spreadPreview.totalPages + result.pagesInserted;
                console.log('[Illustrations] triggerLocalReflow — plate: updating totalPages from',
                    spreadPreview.totalPages, 'to', totalPages);
                spreadPreview.totalPages = totalPages;
                spreadPreview.render();
            }
        }

        return result;
    }

    /**
     * Initialize the DragDropHandler — manages all drag-and-drop interactions.
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    function initDragDropHandler() {
        console.log('[Illustrations] initDragDropHandler — creating DragDropHandler instance');

        dragDropHandler = new DragDropHandler({
            $container,
            projectId,
            getIllustrations: () => illustrations,
            getPoolImages,
            spreadPreview,
            pageConfig: {
                pageWidthInches: 5.5,
                pageHeightInches: 8.5,
                marginInches: 0.75
            },
            onImagePlaced: handleDragImagePlaced,
            onImageMovedOnSpread: handleDragImageMoved,
            onImageResizedOnSpread: handleDragImageResized,
            onImageDroppedInBook: handleDragImageDroppedInBook,
            onSharedToAvailable: handleDragSharedToAvailable,
            onAvailableToShared: handleDragAvailableToShared,
            onStateChanged: () => {
                console.log('[Illustrations] DragDropHandler onStateChanged — refreshing all components');
                if (sharedPoolComponent) sharedPoolComponent.render();
                if (availablePoolComponent) availablePoolComponent.render();
                if (inBookPool) inBookPool.render();
                renderToolbar();
                updateSpreadPreview();
                // Re-attach drag sources after pool re-renders
                if (dragDropHandler) dragDropHandler.refreshDragSources();
            }
        });

        dragDropHandler.init();
        console.log('[Illustrations] initDragDropHandler — complete');
    }

    /**
     * Handle image placed on spread via drag-and-drop (pool-to-spread).
     * Places image at drop position, auto-resizes to fit margins, infers full_page mode.
     * @param {string} imageUuid
     * @param {object} placement - { mode, page_number, position_x, position_y, height, layout, side }
     */
    function handleDragImagePlaced(imageUuid, placement) {
        console.log('[Illustrations] handleDragImagePlaced — imageUuid:', imageUuid, 'placement:', JSON.stringify(placement));

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.warn('[Illustrations] handleDragImagePlaced — image not found:', imageUuid);
            return;
        }

        const beforeState = { image_uuid: imageUuid, pool: img.pool, placement: img.placement ? { ...img.placement } : null };

        // Transition image to in_book pool with the given placement
        img.pool = 'in_book';
        img.placement = placement;
        img.placement_mode = placement.mode;
        img.page_number = placement.page_number;
        img.position_x = placement.position_x;
        img.position_y = placement.position_y;
        img.height = placement.height;
        img.layout = placement.layout;
        img.side = placement.side;

        actionStack.push({
            type: 'place',
            before: beforeState,
            after: { image_uuid: imageUuid, pool: 'in_book', placement: { ...placement } },
            description: `Place ${img.label} on page ${placement.page_number} (${placement.mode})`
        });
        updateUndoRedoButtons();

        // Trigger local reflow on placement — text pushed to next page for full_page mode
        // Requirements: 7.1, 7.5, 8.1, 8.2
        if (placement.mode === 'full_page' || placement.mode === 'plate') {
            console.log('[Illustrations] handleDragImagePlaced — triggering local reflow for', placement.mode, 'placement');
            if (placement.mode === 'plate') {
                console.log('[Illustrations] handleDragImagePlaced — PLATE PLACEMENT:',
                    'image:', img.label,
                    '| side:', placement.side || 'right',
                    '| page:', placement.page_number,
                    '| inserts new sheet (image page + blank page)');
            }
            triggerLocalReflow('place', img);
        }

        // Recalculate DPI warning after placement (Requirements: 17.1, 17.2)
        recalculateResolutionWarningForImage(img);

        console.log('[Illustrations] handleDragImagePlaced — image moved to in_book pool with placement');
    }

    /**
     * Handle image repositioned on spread via drag.
     * @param {string} imageUuid
     * @param {number} newPosX - New X position (0-1)
     * @param {number} newPosY - New Y position (0-1)
     */
    function handleDragImageMoved(imageUuid, newPosX, newPosY) {
        console.log('[Illustrations] handleDragImageMoved — imageUuid:', imageUuid,
            'newPosX:', newPosX.toFixed(3), 'newPosY:', newPosY.toFixed(3));

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) return;

        if (!img.placement) img.placement = {};
        img.placement.position_x = newPosX;
        img.placement.position_y = newPosY;
        img.position_x = newPosX;
        img.position_y = newPosY;

        // Trigger local reflow for repositioning (Requirements: 7.6, 10.4)
        const mode = (img.placement && img.placement.mode) || img.placement_mode || 'inline';
        if (mode === 'full_page' || mode === 'plate') {
            console.log('[Illustrations] handleDragImageMoved — triggering local reflow for', mode, 'reposition');
            triggerLocalReflow('move', img);
        }

        // Local reflow — update spread preview immediately
        updateSpreadPreview();
    }

    /**
     * Handle image resized on spread via edge-drag (aspect ratio locked).
     * @param {string} imageUuid
     * @param {number} newHeight - New height value
     */
    function handleDragImageResized(imageUuid, newHeight) {
        console.log('[Illustrations] handleDragImageResized — imageUuid:', imageUuid, 'newHeight:', newHeight);

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) return;

        if (!img.placement) img.placement = {};
        img.placement.height = newHeight;
        img.height = newHeight;

        // Recalculate DPI warning after resize (Requirements: 17.1, 17.2)
        recalculateResolutionWarningForImage(img);

        // Trigger local reflow for resize (Requirements: 7.4, 7.7, 10.5)
        const mode = (img.placement && img.placement.mode) || img.placement_mode || 'inline';
        if (mode === 'full_page' || mode === 'plate') {
            console.log('[Illustrations] handleDragImageResized — triggering local reflow for', mode, 'resize');
            triggerLocalReflow('resize', img);
        }

        // Local reflow — update spread preview immediately
        updateSpreadPreview();
    }

    /**
     * Handle image dropped into in-book pool without placement (pending state).
     * Shows warning border + "Click to configure placement" tooltip.
     * @param {string} imageUuid
     */
    function handleDragImageDroppedInBook(imageUuid) {
        console.log('[Illustrations] handleDragImageDroppedInBook — imageUuid:', imageUuid);

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.warn('[Illustrations] handleDragImageDroppedInBook — image not found:', imageUuid);
            return;
        }

        const beforeState = { image_uuid: imageUuid, pool: img.pool };

        // Move to in_book without placement (pending state)
        img.pool = 'in_book';
        // No placement set — this triggers the warning border in InBookPool rendering

        actionStack.push({
            type: 'move_to_in_book',
            before: beforeState,
            after: { image_uuid: imageUuid, pool: 'in_book' },
            description: `Move ${img.label} to In Book (pending placement)`
        });
        updateUndoRedoButtons();

        console.log('[Illustrations] handleDragImageDroppedInBook — image in pending state with warning border');
    }

    /**
     * Handle shared→available copy via drag-and-drop.
     * Copies the image reference into the project's available pool (original stays in shared).
     * @param {string} imageUuid
     */
    async function handleDragSharedToAvailable(imageUuid) {
        console.log('[Illustrations] handleDragSharedToAvailable — imageUuid:', imageUuid);

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.warn('[Illustrations] handleDragSharedToAvailable — image not found:', imageUuid);
            return;
        }

        // Call backend copy endpoint to create a new record in available pool
        try {
            console.log('[Illustrations] handleDragSharedToAvailable — calling backend copy endpoint');
            const result = await api.post(`/projects/${projectId}/illustrations/copy-from-shared`, {
                image_uuid: imageUuid
            });

            const newImage = {
                image_uuid: result.image_uuid || imageUuid + '_copy',
                label: result.label || img.label,
                pool: 'available',
                source: 'uploaded',
                placement: null,
                lock_state: false,
                resolution_warning: false,
                file_ext: result.file_ext || img.file_ext,
                original_width_px: result.original_width_px || img.original_width_px,
                original_height_px: result.original_height_px || img.original_height_px
            };

            illustrations.push(newImage);

            actionStack.push({
                type: 'copy_shared_to_available',
                before: { image_uuid: newImage.image_uuid, pool: '__none__' },
                after: { image_uuid: newImage.image_uuid, pool: 'available', label: newImage.label },
                description: `Copy "${img.label}" from shared to available pool`
            });
            updateUndoRedoButtons();

            console.log('[Illustrations] handleDragSharedToAvailable — copy complete, new UUID:', newImage.image_uuid);
        } catch (err) {
            console.error('[Illustrations] handleDragSharedToAvailable — backend copy failed:', err.message, err);
            // Fallback: create a local copy reference
            const fallbackImage = {
                image_uuid: imageUuid + '_local_' + Date.now(),
                label: img.label + ' (copy)',
                pool: 'available',
                source: 'uploaded',
                placement: null,
                lock_state: false,
                resolution_warning: false,
                file_ext: img.file_ext,
                original_width_px: img.original_width_px,
                original_height_px: img.original_height_px
            };
            illustrations.push(fallbackImage);
            console.warn('[Illustrations] handleDragSharedToAvailable — using local fallback copy');
        }
    }

    /**
     * Handle available→shared move via drag-and-drop.
     * Moves the image from available pool to shared pool.
     * @param {string} imageUuid
     */
    async function handleDragAvailableToShared(imageUuid) {
        console.log('[Illustrations] handleDragAvailableToShared — imageUuid:', imageUuid);

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.warn('[Illustrations] handleDragAvailableToShared — image not found:', imageUuid);
            return;
        }

        const beforeState = { image_uuid: imageUuid, pool: img.pool };

        // Move to shared pool (move semantics)
        img.pool = 'shared';

        actionStack.push({
            type: 'move_available_to_shared',
            before: beforeState,
            after: { image_uuid: imageUuid, pool: 'shared' },
            description: `Move "${img.label}" from available to shared pool`
        });
        updateUndoRedoButtons();

        // Persist to backend
        try {
            await api.post(`/user/shared-images/move-from-project`, {
                image_uuid: imageUuid,
                project_id: projectId
            });
            console.log('[Illustrations] handleDragAvailableToShared — backend move successful');
        } catch (err) {
            console.error('[Illustrations] handleDragAvailableToShared — backend move failed:', err.message, err);
        }
    }

    /**
     * Update the spread preview with current state (call after any illustration data change).
     */
    function updateSpreadPreview() {
        if (!spreadPreview) return;
        console.log('[Illustrations] updateSpreadPreview — refreshing spread data');
        const inBookImages = getPoolImages('in_book');
        const maxPage = inBookImages.reduce((max, img) => {
            const p = (img.placement && img.placement.page_number) || img.page_number || 0;
            return Math.max(max, p);
        }, 0);
        const estimatedTotalPages = Math.max(maxPage, 100);
        spreadPreview.setData(illustrations, estimatedTotalPages);
        spreadPreview.setSelectedImage(selectedImageUuid);
    }

    /**
     * Recalculate the resolution warning for a single image and update the InBookPool UI.
     * Called on every height/size change to update the ⚠️ indicator in real-time.
     * Requirements: 17.1, 17.2
     *
     * @param {object} img - The illustration DTO to recalculate
     */
    function recalculateResolutionWarningForImage(img) {
        if (!img || img.pool !== 'in_book') {
            console.log('[Illustrations][DPI] recalculateResolutionWarningForImage: skipping — not in_book pool');
            return;
        }

        const oldWarning = img.resolution_warning;
        const newWarning = recalculateResolutionWarning(img, pageConfig);

        console.log('[Illustrations][DPI] recalculateResolutionWarningForImage:',
            'image_uuid:', img.image_uuid,
            '| label:', img.label,
            '| oldWarning:', oldWarning,
            '| newWarning:', newWarning);

        // If warning state changed, re-render the InBookPool to update ⚠️ indicator
        if (oldWarning !== newWarning) {
            console.log('[Illustrations][DPI] Warning state changed for:', img.image_uuid,
                '— re-rendering InBookPool thumbnails');
            if (inBookPool) inBookPool.render();
        }
    }

    /**
     * Recalculate resolution warnings for ALL in_book images and refresh the pool UI.
     * Called after operations that may affect multiple images (e.g., mode changes).
     * Requirements: 17.1, 17.2
     */
    function recalculateAllWarnings() {
        console.log('[Illustrations][DPI] recalculateAllWarnings: recalculating for all in_book images');
        const warningCount = recalculateAllResolutionWarnings(illustrations, pageConfig);
        console.log('[Illustrations][DPI] recalculateAllWarnings: complete — warningCount:', warningCount);
        if (inBookPool) inBookPool.render();
        return warningCount;
    }

    // --- Spread Navigation ---

    /**
     * Chapter data for navigation. Chapters are loaded from the project if available,
     * otherwise we use a simple page-based approach (every 20 pages = 1 chapter).
     */
    let chapters = []; // Array of { number: int, name: string, startPage: int }

    /**
     * Load chapter data from the project (if available).
     * Falls back to a simple page-based approach if no chapter data exists.
     */
    async function loadChapterData() {
        console.log('[Illustrations] loadChapterData — attempting to load chapter info for project:', projectId);
        try {
            const data = await api.get(`/projects/${projectId}/chapters`);
            if (data && data.chapters && data.chapters.length > 0) {
                chapters = data.chapters.map((ch, idx) => ({
                    number: ch.number || (idx + 1),
                    name: ch.name || ch.title || `Chapter ${idx + 1}`,
                    startPage: ch.start_page || ch.startPage || 1
                }));
                console.log('[Illustrations] loadChapterData — loaded', chapters.length, 'chapters from backend');
            } else {
                console.log('[Illustrations] loadChapterData — no chapter data from backend, using page-based fallback');
                chapters = generateFallbackChapters();
            }
        } catch (err) {
            console.warn('[Illustrations] loadChapterData — failed to load chapters (non-fatal):', err.message);
            chapters = generateFallbackChapters();
        }
        console.log('[Illustrations] chapters:', JSON.stringify(chapters));
    }

    /**
     * Generate fallback chapter data (every 20 pages = 1 chapter).
     * @returns {Array} Array of chapter objects
     */
    function generateFallbackChapters() {
        const totalPages = spreadPreview ? spreadPreview.totalPages : 100;
        const chapterSize = 20;
        const result = [];
        for (let i = 0; i * chapterSize < totalPages; i++) {
            result.push({
                number: i + 1,
                name: `Chapter ${i + 1}`,
                startPage: i * chapterSize + 1
            });
        }
        console.log('[Illustrations] generateFallbackChapters — generated', result.length, 'fallback chapters (every', chapterSize, 'pages)');
        return result;
    }

    /**
     * Get the chapter containing a given page number.
     * @param {number} pageNumber
     * @returns {{ chapter: object, index: number } | null}
     */
    function getChapterForPage(pageNumber) {
        if (!chapters.length) return null;
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (pageNumber >= chapters[i].startPage) {
                return { chapter: chapters[i], index: i };
            }
        }
        return { chapter: chapters[0], index: 0 };
    }

    /**
     * Find a chapter by number or name (case-insensitive partial match).
     * @param {string} input - Chapter number or name
     * @returns {object|null} The matching chapter or null
     */
    function findChapter(input) {
        if (!input || !chapters.length) return null;
        const trimmed = input.trim();
        console.log('[Illustrations] findChapter — searching for:', trimmed);

        // Try numeric match first
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
            const byNumber = chapters.find(ch => ch.number === num);
            if (byNumber) {
                console.log('[Illustrations] findChapter — matched by number:', byNumber.number, byNumber.name);
                return byNumber;
            }
        }

        // Try name match (case-insensitive, partial)
        const lower = trimmed.toLowerCase();
        const byName = chapters.find(ch => ch.name.toLowerCase().includes(lower));
        if (byName) {
            console.log('[Illustrations] findChapter — matched by name:', byName.number, byName.name);
            return byName;
        }

        console.log('[Illustrations] findChapter — no match found for:', trimmed);
        return null;
    }

    /**
     * Navigate to a spread and update the navigation display.
     * @param {number} leftPageNumber - The left page number to navigate to
     * @param {string} source - Description of what triggered the navigation (for logging)
     */
    function navigateToSpread(leftPageNumber, source) {
        if (!spreadPreview) {
            console.warn('[Illustrations] navigateToSpread — spreadPreview not initialized');
            return;
        }
        const prevStart = spreadPreview.getCurrentSpreadStart();
        spreadPreview.goToSpread(leftPageNumber);
        const newStart = spreadPreview.getCurrentSpreadStart();
        console.log('[Illustrations][Navigation] navigateToSpread — source:', source,
            '| requested:', leftPageNumber, '| from:', prevStart, '| to:', newStart,
            '| pages:', newStart, '&', newStart + 1);
        updateNavigationDisplay();
    }

    /**
     * Update the page display label in the navigation bar.
     */
    function updateNavigationDisplay() {
        if (!spreadPreview) return;
        const start = spreadPreview.getCurrentSpreadStart();
        const totalPages = spreadPreview.totalPages;
        const rightPage = Math.min(start + 1, totalPages);
        const displayText = `Pages ${start}–${rightPage}` + (totalPages > 0 ? ` of ${totalPages}` : '');
        $container.find('#nav-page-display').text(displayText);
        console.log('[Illustrations][Navigation] updateNavigationDisplay:', displayText);
    }

    /**
     * Bind all spread navigation control events.
     */
    function bindSpreadNavigation() {
        console.log('[Illustrations] bindSpreadNavigation — binding navigation controls');

        // Load chapter data (async, non-blocking)
        loadChapterData();

        // Previous spread button (go back 2 pages)
        $container.find('#nav-prev-spread').on('click', function () {
            const current = spreadPreview.getCurrentSpreadStart();
            const target = Math.max(1, current - 2);
            console.log('[Illustrations][Navigation] Prev spread clicked — current:', current, 'target:', target);
            navigateToSpread(target, 'prev-spread-button');
        });

        // Next spread button (advance 2 pages)
        $container.find('#nav-next-spread').on('click', function () {
            const current = spreadPreview.getCurrentSpreadStart();
            const totalPages = spreadPreview.totalPages;
            const target = Math.min(current + 2, totalPages);
            console.log('[Illustrations][Navigation] Next spread clicked — current:', current, 'target:', target);
            navigateToSpread(target, 'next-spread-button');
        });

        // Previous chapter button
        $container.find('#nav-prev-chapter').on('click', function () {
            const current = spreadPreview.getCurrentSpreadStart();
            const chapterInfo = getChapterForPage(current);
            console.log('[Illustrations][Navigation] Prev chapter clicked — current page:', current, 'current chapter:', chapterInfo);

            if (!chapterInfo || chapterInfo.index <= 0) {
                console.log('[Illustrations][Navigation] Already at first chapter or no chapters — navigating to page 1');
                navigateToSpread(1, 'prev-chapter-button (at start)');
                return;
            }

            // If we're at the start of the current chapter, go to the previous one
            const currentChapter = chapters[chapterInfo.index];
            let targetIndex;
            if (current <= currentChapter.startPage + 1) {
                // Already at or near start of this chapter — go to previous chapter
                targetIndex = chapterInfo.index - 1;
            } else {
                // Go to start of current chapter
                targetIndex = chapterInfo.index;
            }

            const targetChapter = chapters[targetIndex];
            console.log('[Illustrations][Navigation] Navigating to chapter:', targetChapter.number, targetChapter.name, 'startPage:', targetChapter.startPage);
            navigateToSpread(targetChapter.startPage, `prev-chapter-button (ch ${targetChapter.number})`);
        });

        // Next chapter button
        $container.find('#nav-next-chapter').on('click', function () {
            const current = spreadPreview.getCurrentSpreadStart();
            const chapterInfo = getChapterForPage(current);
            console.log('[Illustrations][Navigation] Next chapter clicked — current page:', current, 'current chapter:', chapterInfo);

            if (!chapterInfo || chapterInfo.index >= chapters.length - 1) {
                console.log('[Illustrations][Navigation] Already at last chapter or no chapters');
                // Navigate to last chapter start if available
                if (chapters.length > 0) {
                    const lastChapter = chapters[chapters.length - 1];
                    navigateToSpread(lastChapter.startPage, 'next-chapter-button (at end)');
                }
                return;
            }

            const nextChapter = chapters[chapterInfo.index + 1];
            console.log('[Illustrations][Navigation] Navigating to chapter:', nextChapter.number, nextChapter.name, 'startPage:', nextChapter.startPage);
            navigateToSpread(nextChapter.startPage, `next-chapter-button (ch ${nextChapter.number})`);
        });

        // Page number input — navigate on Enter or blur
        $container.find('#nav-page-input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const pageNum = parseInt($(this).val(), 10);
                console.log('[Illustrations][Navigation] Page input Enter — value:', $(this).val(), 'parsed:', pageNum);
                if (!isNaN(pageNum) && pageNum >= 1) {
                    navigateToSpread(pageNum, `page-input (${pageNum})`);
                    $(this).val('');
                } else {
                    console.warn('[Illustrations][Navigation] Page input — invalid value:', $(this).val());
                }
            }
        }).on('blur', function () {
            const val = $(this).val();
            if (!val) return; // Don't navigate on blur if empty
            const pageNum = parseInt(val, 10);
            console.log('[Illustrations][Navigation] Page input blur — value:', val, 'parsed:', pageNum);
            if (!isNaN(pageNum) && pageNum >= 1) {
                navigateToSpread(pageNum, `page-input-blur (${pageNum})`);
                $(this).val('');
            }
        });

        // Chapter name/number input — navigate on Enter or blur
        $container.find('#nav-chapter-input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const input = $(this).val();
                console.log('[Illustrations][Navigation] Chapter input Enter — value:', input);
                const chapter = findChapter(input);
                if (chapter) {
                    navigateToSpread(chapter.startPage, `chapter-input (${chapter.name})`);
                    $(this).val('');
                } else {
                    console.warn('[Illustrations][Navigation] Chapter input — no match for:', input);
                }
            }
        }).on('blur', function () {
            const input = $(this).val();
            if (!input) return; // Don't navigate on blur if empty
            console.log('[Illustrations][Navigation] Chapter input blur — value:', input);
            const chapter = findChapter(input);
            if (chapter) {
                navigateToSpread(chapter.startPage, `chapter-input-blur (${chapter.name})`);
                $(this).val('');
            }
        });

        // Set initial display
        updateNavigationDisplay();
        console.log('[Illustrations] bindSpreadNavigation — all navigation controls bound');
    }

    // --- Toolbar ---

    /** Track whether a full reflow is currently in progress */
    let reflowInProgress = false;

    /**
     * Show spinner overlay on the spread preview and disable toolbar controls.
     * Called when a full reflow is triggered (lock action).
     */
    function showReflowSpinner() {
        console.log('[Illustrations] showReflowSpinner — showing spinner overlay, disabling controls');
        reflowInProgress = true;

        // Add spinner overlay to spread preview
        const $spreadContainer = $container.find('.spread-preview-container');
        if ($spreadContainer.find('.reflow-spinner-overlay').length === 0) {
            $spreadContainer.css('position', 'relative');
            $spreadContainer.append(`
                <div class="reflow-spinner-overlay" style="
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(253, 245, 230, 0.85);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    z-index: 10; border-radius: 6px;
                ">
                    <div class="spinner"></div>
                    <span style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--saddle-brown); font-style: italic;">
                        Full reflow in progress...
                    </span>
                </div>
            `);
        }

        // Disable all toolbar controls
        const $toolbar = $container.find('#spread-toolbar');
        $toolbar.find('input, select, button').prop('disabled', true);
        console.log('[Illustrations] showReflowSpinner — controls disabled');
    }

    /**
     * Hide spinner overlay and re-enable toolbar controls.
     * Called when reflow completes or fails.
     */
    function hideReflowSpinner() {
        console.log('[Illustrations] hideReflowSpinner — removing spinner overlay, re-enabling controls');
        reflowInProgress = false;

        $container.find('.reflow-spinner-overlay').remove();

        // Re-render toolbar to restore enabled state
        renderToolbar();
        console.log('[Illustrations] hideReflowSpinner — controls re-enabled');
    }

    /**
     * Poll reflow task status until complete or failed.
     * @param {string} taskId - The Celery task ID to poll
     */
    async function pollReflowStatus(taskId) {
        console.log('[Illustrations] pollReflowStatus — polling task:', taskId);
        const maxAttempts = 120; // 2 minutes at 1s intervals
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const status = await api.get(`/tasks/${taskId}/status`);
                console.log('[Illustrations] pollReflowStatus — attempt:', attempts, 'status:', status.status, 'stage:', status.stage, 'percent:', status.percent);

                if (status.status === 'complete') {
                    console.log('[Illustrations] pollReflowStatus — reflow complete, refreshing data from backend');
                    hideReflowSpinner();
                    // Refresh illustration data from backend to get updated page numbers
                    await refreshIllustrationsFromBackend();
                    return;
                }

                if (status.status === 'failed') {
                    console.error('[Illustrations] pollReflowStatus — reflow FAILED:', status);
                    hideReflowSpinner();
                    const $status = $container.find('#illustrations-status');
                    showError($status, 'Full reflow failed: ' + (status.label || 'Unknown error'));
                    return;
                }
            } catch (err) {
                console.error('[Illustrations] pollReflowStatus — poll request failed:', err.message, err);
            }

            // Wait 1 second before next poll
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Timeout
        console.warn('[Illustrations] pollReflowStatus — timed out after', maxAttempts, 'attempts');
        hideReflowSpinner();
        const $status = $container.find('#illustrations-status');
        showError($status, 'Reflow timed out. You may retry by locking the image again.');
    }

    /**
     * Refresh illustration data from the backend after reflow completes.
     * Fetches fresh data with updated page numbers and re-renders all components.
     * Called after reflow complete to ensure spread preview shows new page numbers.
     */
    async function refreshIllustrationsFromBackend() {
        console.log('[Illustrations] refreshIllustrationsFromBackend — fetching fresh data from backend');
        try {
            const data = await api.get(`/projects/${projectId}/illustrations`);
            const freshIllustrations = data.illustrations || data || [];
            console.log('[Illustrations] refreshIllustrationsFromBackend — received', freshIllustrations.length, 'illustrations from backend');

            // Update local state with fresh data from backend (preserves page numbers from reflow)
            for (const fresh of freshIllustrations) {
                const existing = illustrations.find(i => i.image_uuid === fresh.image_uuid);
                if (existing) {
                    // Update fields that may have changed during reflow
                    existing.page_number = fresh.page_number;
                    existing.lock_state = fresh.lock_state;
                    existing.pool = fresh.pool;
                    if (fresh.placement) {
                        existing.placement = fresh.placement;
                    }
                    if (fresh.placement_mode) {
                        existing.placement_mode = fresh.placement_mode;
                    }
                    if (fresh.position_x !== undefined) existing.position_x = fresh.position_x;
                    if (fresh.position_y !== undefined) existing.position_y = fresh.position_y;
                    if (fresh.height !== undefined) existing.height = fresh.height;
                    console.log('[Illustrations] refreshIllustrationsFromBackend — updated:', existing.image_uuid,
                        'page:', existing.page_number, 'locked:', existing.lock_state);
                } else {
                    // New image from backend (shouldn't normally happen, but handle gracefully)
                    illustrations.push(fresh);
                    console.log('[Illustrations] refreshIllustrationsFromBackend — added new image:', fresh.image_uuid);
                }
            }

            // Re-render all components with fresh data
            if (sharedPoolComponent) sharedPoolComponent.render();
            if (availablePoolComponent) availablePoolComponent.render();
            if (inBookPool) inBookPool.render();
            renderToolbar();
            updateSpreadPreview();
            console.log('[Illustrations] refreshIllustrationsFromBackend — all components refreshed with new page numbers');
        } catch (err) {
            console.error('[Illustrations] refreshIllustrationsFromBackend — failed to refresh:', err.message, err);
            // Fall back to local state render
            updateSpreadPreview();
            if (inBookPool) inBookPool.render();
        }
    }

    /**
     * Open the "Replace with..." picker modal showing Available + Shared pool images.
     * @param {object} img - The currently selected illustration to replace
     */
    function openReplacePickerModal(img) {
        console.log('[Illustrations] openReplacePickerModal — opening picker for:', img.image_uuid, img.label);

        // Gather available + shared images (excluding the current image itself)
        const availableImages = getPoolImages('available');
        const sharedImages = getPoolImages('shared');
        const allCandidates = [...availableImages, ...sharedImages].filter(i => i.image_uuid !== img.image_uuid);

        console.log('[Illustrations] openReplacePickerModal — candidates: available=', availableImages.length, 'shared=', sharedImages.length, 'total=', allCandidates.length);

        // Build modal HTML
        const candidateItems = allCandidates.map(candidate => `
            <div class="replace-picker-item" data-uuid="${candidate.image_uuid}" style="
                display: inline-flex; flex-direction: column; align-items: center;
                border: 2px solid var(--medium-brown); border-radius: 6px; padding: 0.4rem;
                cursor: pointer; background: var(--cream); width: 100px; transition: border-color 0.15s;
            ">
                <div style="width: 80px; height: 80px; background: var(--header-bg); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="/api/illustrations/${candidate.image_uuid}/image" style="max-width: 100%; max-height: 100%; object-fit: cover;" onerror="this.style.display='none'" />
                </div>
                <span style="font-size: 0.7rem; font-weight: 600; margin-top: 0.25rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">
                    ${escapeHtml(candidate.label)}
                </span>
                <span style="font-size: 0.6rem; color: var(--saddle-brown);">${candidate.pool === 'shared' ? 'Shared' : 'Available'}</span>
            </div>
        `).join('');

        const modalHtml = `
            <div class="replace-picker-modal" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.5); z-index: 1000;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    background: linear-gradient(to bottom, var(--parchment-start), var(--parchment-end));
                    border: 2px solid var(--saddle-brown); border-radius: 10px;
                    padding: 1.5rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                ">
                    <h3 style="margin-bottom: 0.75rem;">Replace "${escapeHtml(img.label)}" with...</h3>
                    <p style="font-size: 0.85rem; color: var(--saddle-brown); margin-bottom: 1rem;">
                        Select an image from Available or Shared pools. Position, size, and lock state will be preserved.
                    </p>
                    ${allCandidates.length === 0
                        ? '<p style="font-style: italic; color: var(--saddle-brown);">No other images available.</p>'
                        : `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${candidateItems}</div>`
                    }
                    <div style="margin-top: 1rem; text-align: right;">
                        <button class="btn btn-sm secondary replace-picker-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        $('body').append(modalHtml);
        console.log('[Illustrations] openReplacePickerModal — modal appended to DOM');

        // Bind events
        $('.replace-picker-modal').on('click', '.replace-picker-cancel', function () {
            console.log('[Illustrations] openReplacePickerModal — cancel clicked');
            $('.replace-picker-modal').remove();
        });

        // Click outside modal content to close
        $('.replace-picker-modal').on('click', function (e) {
            if ($(e.target).hasClass('replace-picker-modal')) {
                console.log('[Illustrations] openReplacePickerModal — clicked outside, closing');
                $('.replace-picker-modal').remove();
            }
        });

        // Select a replacement image
        $('.replace-picker-modal').on('click', '.replace-picker-item', function () {
            const replacementUuid = $(this).data('uuid');
            console.log('[Illustrations] openReplacePickerModal — selected replacement:', replacementUuid);
            handleReplaceImage(img, replacementUuid);
            $('.replace-picker-modal').remove();
        });

        // Hover effect
        $('.replace-picker-modal').on('mouseenter', '.replace-picker-item', function () {
            $(this).css('border-color', 'var(--teal)');
        }).on('mouseleave', '.replace-picker-item', function () {
            $(this).css('border-color', 'var(--medium-brown)');
        });
    }

    /**
     * Handle replacing an image — retains position, size, lock state; swaps image content.
     * @param {object} originalImg - The image being replaced
     * @param {string} replacementUuid - UUID of the replacement image
     */
    function handleReplaceImage(originalImg, replacementUuid) {
        const replacement = illustrations.find(i => i.image_uuid === replacementUuid);
        if (!replacement) {
            console.error('[Illustrations] handleReplaceImage — replacement not found:', replacementUuid);
            return;
        }

        console.log('[Illustrations] handleReplaceImage — replacing', originalImg.image_uuid, 'with', replacementUuid);
        console.log('[Illustrations] handleReplaceImage — preserving placement:', originalImg.placement, 'lock_state:', originalImg.lock_state);

        const beforeState = {
            image_uuid: originalImg.image_uuid,
            label: originalImg.label,
            file_ext: originalImg.file_ext,
            original_width_px: originalImg.original_width_px,
            original_height_px: originalImg.original_height_px
        };

        // Swap image content but preserve placement metadata
        originalImg.image_uuid = replacement.image_uuid;
        originalImg.label = replacement.label;
        originalImg.file_ext = replacement.file_ext;
        originalImg.original_width_px = replacement.original_width_px;
        originalImg.original_height_px = replacement.original_height_px;
        // placement, lock_state, mode, position, height, layout, side all preserved

        actionStack.push({
            type: 'replace',
            before: beforeState,
            after: {
                image_uuid: originalImg.image_uuid,
                label: originalImg.label,
                file_ext: originalImg.file_ext,
                original_width_px: originalImg.original_width_px,
                original_height_px: originalImg.original_height_px
            },
            description: `Replace image with "${replacement.label}"`
        });

        updateUndoRedoButtons();
        selectedImageUuid = originalImg.image_uuid;
        if (inBookPool) inBookPool.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (sharedPoolComponent) sharedPoolComponent.render();
        renderToolbar();
        updateSpreadPreview();

        console.log('[Illustrations] handleReplaceImage — replacement complete');
    }

    function renderToolbar() {
        const $toolbar = $container.find('#spread-toolbar');
        if (!selectedImageUuid) {
            $toolbar.html('<span class="toolbar-hint">Select an image to see placement controls</span>');
            return;
        }

        const img = illustrations.find(i => i.image_uuid === selectedImageUuid);
        if (!img) {
            $toolbar.html('<span class="toolbar-hint">Select an image to see placement controls</span>');
            return;
        }

        console.log('[Illustrations] renderToolbar for:', img.image_uuid, 'label:', img.label, 'pool:', img.pool, 'reflowInProgress:', reflowInProgress);

        const placement = img.placement || {};
        const mode = placement.mode || 'inline';
        const height = placement.height || (mode === 'inline' ? 8 : 100);
        const heightUnit = mode === 'inline' ? 'lines' : '%';
        const locked = img.lock_state;
        const layout = placement.layout || 'margins';
        const side = placement.side || 'left';
        const isFullPageOrPlate = (mode === 'full_page' || mode === 'plate');
        const isPlate = (mode === 'plate');
        const disabledAttr = reflowInProgress ? 'disabled' : '';

        // Build layout mode selector (only for full_page/plate)
        const layoutSelectorHtml = isFullPageOrPlate ? `
            <div class="toolbar-group">
                <label>Layout:</label>
                <select id="toolbar-layout" class="toolbar-select" ${disabledAttr}>
                    <option value="margins" ${layout === 'margins' ? 'selected' : ''}>Stay in margins</option>
                    <option value="edges" ${layout === 'edges' ? 'selected' : ''}>Push to edges</option>
                </select>
            </div>
        ` : '';

        // Build "Push to edges" warning note (Requirements: 7.3)
        const edgesWarningHtml = (isFullPageOrPlate && layout === 'edges') ? `
            <div class="toolbar-edges-warning" style="
                display: flex; align-items: center; gap: 0.4rem;
                background: rgba(178, 34, 34, 0.08); border: 1px solid rgba(178, 34, 34, 0.3);
                border-radius: 4px; padding: 0.3rem 0.6rem; margin-top: 0.4rem;
                font-size: 0.75rem; color: #8b2020;
            ">
                <span style="font-size: 1rem;">&#9986;</span>
                <span>Content beyond the trim line will be cut off during printing. Edges of this image may be trimmed.</span>
            </div>
        ` : '';

        // Build side selector (only for plate mode)
        const sideSelectorHtml = isPlate ? `
            <div class="toolbar-group">
                <label>Side:</label>
                <select id="toolbar-side" class="toolbar-select" ${disabledAttr}>
                    <option value="left" ${side === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${side === 'right' ? 'selected' : ''}>Right</option>
                </select>
                <span class="toolbar-plate-info" style="font-size: 0.7rem; color: var(--saddle-brown); margin-left: 0.4rem; font-style: italic;">
                    New sheet: image ${side}, blank ${side === 'left' ? 'right' : 'left'}
                </span>
            </div>
        ` : '';

        // Build AI Upscale button (only shown when resolution_warning is active) (Requirements: 17.3, 17.4)
        const hasWarning = img.resolution_warning === true;
        const upscaleButtonHtml = hasWarning ? `
            <button class="btn btn-sm secondary" id="toolbar-upscale" ${disabledAttr}
                    title="AI Upscale — increase image resolution to eliminate DPI warning"
                    style="background: rgba(178, 34, 34, 0.08); border-color: rgba(178, 34, 34, 0.4); color: #8b2020;">
                &#x1F4A1; AI Upscale
            </button>
        ` : '';

        // Build resolution warning indicator for toolbar
        const resolutionWarningHtml = hasWarning ? `
            <span class="toolbar-dpi-warning" style="
                display: inline-flex; align-items: center; gap: 0.3rem;
                font-size: 0.75rem; color: #b22222; margin-left: 0.4rem;
            ">
                ⚠️ Low DPI for print
            </span>
        ` : '';

        $toolbar.html(`
            <div class="toolbar-controls">
                <label class="toolbar-label">Selected: <strong>${escapeHtml(img.label)}</strong>${resolutionWarningHtml}</label>
                <div class="toolbar-group">
                    <label>Height:</label>
                    <input type="number" id="toolbar-height" value="${height}" min="1" max="${mode === 'inline' ? 40 : 100}" step="1" class="toolbar-input" ${disabledAttr} />
                    <span class="toolbar-unit">${heightUnit}</span>
                </div>
                <div class="toolbar-group">
                    <label>Mode:</label>
                    <select id="toolbar-mode" class="toolbar-select" ${disabledAttr}>
                        <option value="inline" ${mode === 'inline' ? 'selected' : ''}>Inline</option>
                        <option value="full_page" ${mode === 'full_page' ? 'selected' : ''}>Full Page</option>
                        <option value="plate" ${mode === 'plate' ? 'selected' : ''}>Plate</option>
                    </select>
                </div>
                ${layoutSelectorHtml}
                ${sideSelectorHtml}
                <button class="btn btn-sm ${locked ? 'secondary' : 'primary'}" id="toolbar-lock" ${disabledAttr}>
                    ${locked ? '&#128275; Unlock' : '&#128274; Lock'}
                </button>
                <button class="btn btn-sm secondary" id="toolbar-replace" ${disabledAttr}>
                    Replace with...
                </button>
                ${upscaleButtonHtml}
            </div>
            ${edgesWarningHtml}
        `);

        // --- Bind toolbar events ---

        // Height input: real-time update on 'input' event (type/arrow keys) with local reflow
        // Requirements: 7.4, 7.7, 17.1, 17.2
        $toolbar.find('#toolbar-height').on('input', function () {
            const newHeight = parseFloat($(this).val());
            if (isNaN(newHeight) || newHeight < 1) return;
            console.log('[Illustrations][FullPage] Height input (real-time) to:', newHeight, heightUnit, 'for:', img.image_uuid);
            if (!img.placement) img.placement = {};
            img.placement.height = newHeight;

            // Recalculate DPI / resolution warning on every height change (Requirements: 17.1, 17.2)
            recalculateResolutionWarningForImage(img);

            // Trigger local reflow for full_page/plate scaling (aspect ratio locked)
            if (mode === 'full_page' || mode === 'plate') {
                triggerLocalReflow('resize', img);
            }

            // Perform local reflow (update spread preview immediately)
            updateSpreadPreview();
        });

        // Height input: push to undo stack on 'change' (blur/enter — final value)
        $toolbar.find('#toolbar-height').on('change', function () {
            const newHeight = parseFloat($(this).val());
            if (isNaN(newHeight) || newHeight < 1) return;
            console.log('[Illustrations] Height change (committed) to:', newHeight, 'for:', img.image_uuid);
            const before = img.placement ? { ...img.placement } : {};
            if (!img.placement) img.placement = {};
            img.placement.height = newHeight;

            // Recalculate DPI / resolution warning on committed height change (Requirements: 17.1, 17.2)
            recalculateResolutionWarningForImage(img);
            actionStack.push({
                type: 'resize',
                before: { image_uuid: img.image_uuid, placement: before },
                after: { image_uuid: img.image_uuid, placement: { ...img.placement } },
                description: `Resize ${img.label} height to ${newHeight}`
            });
            updateUndoRedoButtons();
            console.log('[Illustrations] State change: resize', img.image_uuid, 'height:', newHeight);
            updateSpreadPreview();
        });

        // Mode selector
        // Requirements: 7.1, 7.2
        $toolbar.find('#toolbar-mode').on('change', function () {
            const newMode = $(this).val();
            console.log('[Illustrations][FullPage] Mode changed to:', newMode, 'for:', img.image_uuid, img.label);
            console.log('[Illustrations][FullPage] Mode change — previous mode:', mode, '| new mode:', newMode);
            const before = img.placement ? { ...img.placement } : {};
            if (!img.placement) img.placement = {};
            img.placement.mode = newMode;
            // Reset layout/side defaults when switching modes
            if (newMode === 'full_page' || newMode === 'plate') {
                if (!img.placement.layout) img.placement.layout = 'margins';
                console.log('[Illustrations][FullPage] Entering full_page/plate mode — layout defaults to "margins" (Stay in margins)');
            }
            if (newMode === 'plate') {
                if (!img.placement.side) img.placement.side = 'left';
                console.log('[Illustrations][FullPage] Entering plate mode — side defaults to "left"');
            }
            actionStack.push({
                type: 'mode_change',
                before: { image_uuid: img.image_uuid, placement: before },
                after: { image_uuid: img.image_uuid, placement: { ...img.placement } },
                description: `Change ${img.label} mode to ${newMode}`
            });
            updateUndoRedoButtons();

            // Trigger local reflow when entering full_page/plate mode (text displacement)
            if (newMode === 'full_page' || newMode === 'plate') {
                console.log('[Illustrations][FullPage] Triggering local reflow for mode change to', newMode);
                triggerLocalReflow('place', img);
            }

            // Recalculate DPI after mode change (display size changes with mode) (Requirements: 17.1, 17.2)
            recalculateResolutionWarningForImage(img);

            renderToolbar(); // Re-render to show/hide layout and side selectors
            console.log('[Illustrations][FullPage] Mode change complete — toolbar re-rendered');
            updateSpreadPreview();
        });

        // Layout mode selector (Stay in margins / Push to edges)
        // Requirements: 7.2, 7.3
        $toolbar.find('#toolbar-layout').on('change', function () {
            const newLayout = $(this).val();
            const layoutLabel = newLayout === 'margins' ? 'Stay in margins' : 'Push to edges';
            console.log('[Illustrations][FullPage] Layout option selected:', layoutLabel, '(value:', newLayout, ') for:', img.image_uuid, img.label);
            console.log('[Illustrations][FullPage] Layout change — mode:', mode, '| previous layout:', layout, '| new layout:', newLayout);
            const before = img.placement ? { ...img.placement } : {};
            if (!img.placement) img.placement = {};
            img.placement.layout = newLayout;
            img.layout = newLayout;
            actionStack.push({
                type: 'layout_change',
                before: { image_uuid: img.image_uuid, placement: before },
                after: { image_uuid: img.image_uuid, placement: { ...img.placement } },
                description: `Change ${img.label} layout to "${layoutLabel}"`
            });
            updateUndoRedoButtons();

            // Log the bleed zone behavior change
            if (newLayout === 'edges') {
                console.log('[Illustrations][FullPage] "Push to edges" selected — image will bleed to trim line, grey overlay shows bleed zone');
                console.log('[Illustrations][FullPage] Note: edges of image will be cut off during printing');
            } else {
                console.log('[Illustrations][FullPage] "Stay in margins" selected — image centered within text area, no bleed');
            }

            // Trigger local reflow for full_page/plate modes
            if (mode === 'full_page' || mode === 'plate') {
                console.log('[Illustrations][FullPage] Triggering local reflow after layout change');
                triggerLocalReflow('resize', img);
            }

            // Re-render toolbar to show/hide the edges warning note (Requirement 7.3)
            renderToolbar();
            updateSpreadPreview();
        });

        // Side selector (Left / Right) for plate mode
        $toolbar.find('#toolbar-side').on('change', function () {
            const newSide = $(this).val();
            console.log('[Illustrations] Side changed to:', newSide, 'for:', img.image_uuid);
            console.log('[Illustrations] Plate side selection — image:', img.label,
                '| side:', newSide, '| page:', (img.placement && img.placement.page_number) || 'unset');
            const before = img.placement ? { ...img.placement } : {};
            if (!img.placement) img.placement = {};
            img.placement.side = newSide;
            img.side = newSide;
            actionStack.push({
                type: 'side_change',
                before: { image_uuid: img.image_uuid, placement: before },
                after: { image_uuid: img.image_uuid, placement: { ...img.placement } },
                description: `Change ${img.label} plate side to ${newSide}`
            });
            updateUndoRedoButtons();
            console.log('[Illustrations] State change: side_change', img.image_uuid, 'side:', newSide,
                '— image page will be on', newSide, 'side, blank page on', newSide === 'left' ? 'right' : 'left');
            // Trigger local reflow to recalculate plate displacement with new side
            triggerLocalReflow('resize', img);
            updateSpreadPreview();
        });

        // Lock/Unlock button
        $toolbar.find('#toolbar-lock').on('click', async function () {
            const newLockState = !img.lock_state;
            console.log('[Illustrations] Lock toggled for:', img.image_uuid, 'new state:', newLockState);

            if (!newLockState) {
                // Unlocking — handle cascade unlock warning
                const inBookImages = getPoolImages('in_book');
                const currentPage = (img.placement && img.placement.page_number) || img.page_number || 0;
                const laterLocked = inBookImages.filter(i => {
                    const p = (i.placement && i.placement.page_number) || i.page_number || 0;
                    return i.lock_state && p > currentPage && i.image_uuid !== img.image_uuid;
                });

                if (laterLocked.length > 0) {
                    const proceed = confirm(`This will unlock ${laterLocked.length} image(s) on later pages. Proceed?`);
                    if (!proceed) {
                        console.log('[Illustrations] Unlock cancelled by user (cascade warning)');
                        return;
                    }
                }

                // Call backend cascade unlock endpoint
                console.log('[Illustrations] Calling backend cascade unlock for:', img.image_uuid);
                try {
                    const unlockResult = await api.post(`/projects/${projectId}/illustrations/${img.image_uuid}/unlock`);
                    console.log('[Illustrations] Backend cascade unlock result:', unlockResult);
                    const unlockCount = unlockResult.unlocked_count || 1;
                    console.log('[Illustrations] Backend cascade unlock complete — unlocked_count:', unlockCount);

                    // Update local state to match backend
                    img.lock_state = false;
                    if (laterLocked && laterLocked.length > 0) {
                        for (const laterImg of laterLocked) {
                            laterImg.lock_state = false;
                            console.log('[Illustrations] Cascade unlock (local):', laterImg.image_uuid, laterImg.label);
                        }
                    }
                } catch (err) {
                    console.error('[Illustrations] Backend cascade unlock failed:', err.message, err);
                    const $status = $container.find('#illustrations-status');
                    showError($status, 'Unlock failed: ' + err.message);
                    return;
                }
            }

            if (newLockState) {
                // Locking — call backend lock endpoint (PATCH lock_state=true + trigger reflow)
                console.log('[Illustrations] Calling backend lock endpoint for:', img.image_uuid);
                showReflowSpinner();
                try {
                    const lockResult = await api.post(`/projects/${projectId}/illustrations/${img.image_uuid}/lock`);
                    console.log('[Illustrations] Backend lock result:', lockResult);
                    const taskId = lockResult.task_id || lockResult.taskId;

                    // Update local state to match backend
                    img.lock_state = true;

                    const before = { image_uuid: img.image_uuid, lock_state: false };
                    actionStack.push({
                        type: 'lock_toggle',
                        before,
                        after: { image_uuid: img.image_uuid, lock_state: true },
                        description: `Lock ${img.label}`
                    });
                    updateUndoRedoButtons();
                    if (inBookPool) inBookPool.render();
                    renderToolbar();

                    console.log('[Illustrations] Lock persisted, task_id:', taskId);
                    if (taskId) {
                        await pollReflowStatus(taskId);
                    } else {
                        // No task_id returned — assume immediate completion or no reflow needed
                        console.log('[Illustrations] No task_id returned — assuming immediate completion');
                        hideReflowSpinner();
                        await refreshIllustrationsFromBackend();
                    }
                } catch (err) {
                    console.error('[Illustrations] Backend lock failed:', err.message, err);
                    hideReflowSpinner();
                    const $status = $container.find('#illustrations-status');
                    showError($status, 'Lock failed: ' + err.message);
                }
            } else {
                // Unlock path — local state already updated above after backend call
                const before = { image_uuid: img.image_uuid, lock_state: true };
                actionStack.push({
                    type: 'lock_toggle',
                    before,
                    after: { image_uuid: img.image_uuid, lock_state: false },
                    description: `Unlock ${img.label}`
                });
                updateUndoRedoButtons();
                if (inBookPool) inBookPool.render();
                renderToolbar();
                console.log('[Illustrations] State change: unlock', img.image_uuid, 'locked: false');
                updateSpreadPreview();
            }
        });

        // Replace with... button
        $toolbar.find('#toolbar-replace').on('click', function () {
            console.log('[Illustrations] "Replace with..." button clicked for:', img.image_uuid, img.label);
            openReplacePickerModal(img);
        });

        // AI Upscale button (Requirements: 17.3, 17.4)
        $toolbar.find('#toolbar-upscale').on('click', async function () {
            console.log('[Illustrations][Upscale] "AI Upscale" button clicked for:', img.image_uuid, img.label);
            console.log('[Illustrations][Upscale] Current dimensions:', img.original_width_px, 'x', img.original_height_px);

            const $btn = $(this);
            $btn.prop('disabled', true).html('&#x23F3; Upscaling...');
            console.log('[Illustrations][Upscale] Calling backend upscale endpoint for:', img.image_uuid);

            try {
                const result = await api.post(`/projects/${projectId}/illustrations/${img.image_uuid}/upscale`);
                console.log('[Illustrations][Upscale] Backend response:', JSON.stringify(result));

                // Update local state with new dimensions from backend
                img.original_width_px = result.original_width_px;
                img.original_height_px = result.original_height_px;
                console.log('[Illustrations][Upscale] Updated local dimensions:',
                    img.original_width_px, 'x', img.original_height_px,
                    '| upscale_factor:', result.upscale_factor);

                // Recalculate resolution warning after upscale (Requirements: 17.4)
                recalculateResolutionWarningForImage(img);
                console.log('[Illustrations][Upscale] Resolution warning after upscale:', img.resolution_warning);

                // Re-render toolbar and in-book pool to reflect updated state
                if (inBookPool) inBookPool.render();
                renderToolbar();

                console.log('[Illustrations][Upscale] Upscale complete for:', img.image_uuid,
                    '| new dimensions:', img.original_width_px, 'x', img.original_height_px,
                    '| resolution_warning:', img.resolution_warning);
            } catch (err) {
                console.error('[Illustrations][Upscale] Upscale failed for:', img.image_uuid, err.message, err);
                $btn.prop('disabled', false).html('&#x1F4A1; AI Upscale');
                const $status = $container.find('#illustrations-status');
                showError($status, 'AI Upscale failed: ' + err.message);
            }
        });
    }

    // --- Undo handler ---
    function handleUndo() {
        console.log('[Illustrations] handleUndo() called');
        const action = actionStack.undo();
        if (!action) return;

        applyState(action.before);
        updateUndoRedoButtons();
        if (sharedPoolComponent) sharedPoolComponent.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (inBookPool) inBookPool.render();
        renderToolbar();
        updateSpreadPreview();
        console.log('[Illustrations] Undo applied:', action.type, action.description);
    }

    // --- Redo handler ---
    function handleRedo() {
        console.log('[Illustrations] handleRedo() called');
        const action = actionStack.redo();
        if (!action) return;

        applyState(action.after);
        updateUndoRedoButtons();
        if (sharedPoolComponent) sharedPoolComponent.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (inBookPool) inBookPool.render();
        renderToolbar();
        updateSpreadPreview();
        console.log('[Illustrations] Redo applied:', action.type, action.description);
    }

    /**
     * Apply a state snapshot to the illustrations array.
     * Used by undo/redo to restore previous/next state.
     */
    function applyState(state) {
        if (!state || !state.image_uuid) {
            console.warn('[Illustrations] applyState called with invalid state:', state);
            return;
        }
        const img = illustrations.find(i => i.image_uuid === state.image_uuid);
        if (!img) {
            console.warn('[Illustrations] applyState — image not found:', state.image_uuid);
            return;
        }

        console.log('[Illustrations] applyState for:', state.image_uuid, 'state:', state);

        if (state.placement !== undefined) {
            img.placement = state.placement ? { ...state.placement } : null;
        }
        if (state.lock_state !== undefined) {
            img.lock_state = state.lock_state;
        }
        if (state.pool !== undefined) {
            img.pool = state.pool;
        }
        if (state.label !== undefined) {
            img.label = state.label;
        }
    }

    // --- Lock All handler (called by InBookPool component after user confirms) ---
    async function handleLockAll() {
        console.log('[Illustrations] handleLockAll() called — locking all unlocked in_book images');
        const inBookImages = getPoolImages('in_book');
        const unlocked = inBookImages.filter(img => !img.lock_state);
        console.log('[Illustrations] handleLockAll — unlocked count:', unlocked.length);

        if (unlocked.length === 0) {
            console.log('[Illustrations] handleLockAll — no unlocked images, nothing to do');
            return;
        }

        // Call backend lock-all endpoint (persists lock states + triggers single reflow)
        showReflowSpinner();
        const $status = $container.find('#illustrations-status');
        try {
            console.log('[Illustrations] handleLockAll — calling POST /illustrations/lock-all');
            const response = await api.post(`/projects/${projectId}/illustrations/lock-all`);
            const taskId = response.task_id || response.taskId;
            const lockedCount = response.locked_count || unlocked.length;
            console.log('[Illustrations] handleLockAll — backend lock-all complete, locked_count:', lockedCount, 'task_id:', taskId);

            // Update local state to match backend
            for (const img of unlocked) {
                const before = { image_uuid: img.image_uuid, lock_state: img.lock_state };
                img.lock_state = true;
                actionStack.push({
                    type: 'lock_all',
                    before,
                    after: { image_uuid: img.image_uuid, lock_state: true },
                    description: `Lock All — locked ${img.label}`
                });
                console.log('[Illustrations] State change: lock_all — locked:', img.image_uuid, img.label);
            }

            updateUndoRedoButtons();
            if (inBookPool) inBookPool.render();
            renderToolbar();
            updateSpreadPreview();

            if (taskId) {
                await pollReflowStatus(taskId);
            } else {
                console.log('[Illustrations] handleLockAll — no task_id returned, assuming immediate completion');
                hideReflowSpinner();
                await refreshIllustrationsFromBackend();
            }
        } catch (err) {
            console.error('[Illustrations] handleLockAll — backend lock-all failed:', err.message, err);
            hideReflowSpinner();
            showError($status, 'Lock All failed: ' + err.message);
        }
    }

    // --- Context Menu Action Handler (Requirements: 11.1, 11.2, 11.3, 11.4) ---

    /**
     * Handle context menu actions for image thumbnails.
     * @param {string} action - The action identifier
     * @param {string} imageUuid - The image UUID
     * @param {object} detail - Additional detail (e.g., pageNumber, imageData)
     */
    async function handleContextMenuAction(action, imageUuid, detail) {
        console.log('[Illustrations][ContextMenu] handleContextMenuAction — action:', action,
            'imageUuid:', imageUuid, 'detail:', detail);

        const img = illustrations.find(i => i.image_uuid === imageUuid);
        if (!img) {
            console.error('[Illustrations][ContextMenu] Image not found for uuid:', imageUuid);
            return;
        }

        switch (action) {
            case 'insert_full_page_left':
                insertImageIntoBook(img, 'full_page', 'left');
                break;
            case 'insert_full_page_right':
                insertImageIntoBook(img, 'full_page', 'right');
                break;
            case 'insert_plate_left':
                insertImageIntoBook(img, 'plate', 'left');
                break;
            case 'insert_plate_right':
                insertImageIntoBook(img, 'plate', 'right');
                break;
            case 'insert_inline_left':
                insertImageIntoBook(img, 'inline', 'left');
                break;
            case 'insert_inline_right':
                insertImageIntoBook(img, 'inline', 'right');
                break;
            case 'move_to_page':
                handleMoveToPage(img, detail.pageNumber);
                break;
            case 'lock':
                handleContextLock(img);
                break;
            case 'unlock':
                handleContextUnlock(img);
                break;
            case 'delete':
                handleContextDelete(img);
                break;
            case 'remove_from_book':
                handleRemoveFromBook(img);
                break;
            default:
                console.warn('[Illustrations][ContextMenu] Unknown action:', action);
        }
    }

    /**
     * Insert an image into the In Book pool with specified placement mode and side.
     * Used by context menu "Insert as..." actions.
     * @param {object} img - The illustration DTO
     * @param {string} mode - 'full_page', 'plate', or 'inline'
     * @param {string} side - 'left' or 'right'
     */
    function insertImageIntoBook(img, mode, side) {
        console.log('[Illustrations][ContextMenu] insertImageIntoBook — uuid:', img.image_uuid,
            'label:', img.label, 'mode:', mode, 'side:', side, 'from pool:', img.pool);

        const beforeState = { image_uuid: img.image_uuid, pool: img.pool, placement: img.placement ? { ...img.placement } : null };

        // Move to in_book pool
        img.pool = 'in_book';

        // Set placement configuration
        const currentPage = spreadPreview ? spreadPreview.getCurrentSpreadStart() : 1;
        const targetPage = side === 'right' ? currentPage + 1 : currentPage;

        img.placement = {
            mode: mode,
            page_number: targetPage,
            position_x: 0,
            position_y: 0,
            height: mode === 'inline' ? 8 : 100,
            layout: (mode === 'full_page' || mode === 'plate') ? 'margins' : undefined,
            side: mode === 'plate' ? side : undefined
        };

        // Sync top-level fields for compatibility
        img.placement_mode = mode;
        img.page_number = targetPage;
        img.position_x = 0;
        img.position_y = 0;
        img.height = img.placement.height;
        if (mode === 'full_page' || mode === 'plate') img.layout = 'margins';
        if (mode === 'plate') img.side = side;

        actionStack.push({
            type: 'insert',
            before: beforeState,
            after: { image_uuid: img.image_uuid, pool: 'in_book', placement: { ...img.placement } },
            description: `Insert ${img.label} as ${mode} (${side})`
        });

        // Log plate-specific insertion details
        if (mode === 'plate') {
            console.log('[Illustrations][ContextMenu] PLATE INSERTION — image:', img.label,
                '| side:', side,
                '| page:', targetPage,
                '| new sheet: image on', side, ', blank on', side === 'left' ? 'right' : 'left');
        }

        console.log('[Illustrations][ContextMenu] Image inserted into book — page:', targetPage, 'placement:', img.placement);

        updateUndoRedoButtons();
        if (sharedPoolComponent) sharedPoolComponent.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (inBookPool) inBookPool.render();
        selectedImageUuid = img.image_uuid;
        renderToolbar();

        // Trigger local reflow for full_page/plate modes
        if (mode === 'full_page' || mode === 'plate') {
            console.log('[Illustrations][ContextMenu] Triggering local reflow for', mode, 'insertion');
            triggerLocalReflow('place', img);
        }

        updateSpreadPreview();
    }

    /**
     * Handle "Move to page..." context menu action.
     * @param {object} img - The illustration DTO
     * @param {number} pageNumber - The target page number
     */
    function handleMoveToPage(img, pageNumber) {
        console.log('[Illustrations][ContextMenu] handleMoveToPage — uuid:', img.image_uuid,
            'label:', img.label, 'to page:', pageNumber);

        const beforePlacement = img.placement ? { ...img.placement } : {};

        if (!img.placement) img.placement = {};
        const oldPage = img.placement.page_number;
        img.placement.page_number = pageNumber;

        actionStack.push({
            type: 'move_to_page',
            before: { image_uuid: img.image_uuid, placement: beforePlacement },
            after: { image_uuid: img.image_uuid, placement: { ...img.placement } },
            description: `Move ${img.label} from page ${oldPage || '?'} to page ${pageNumber}`
        });

        console.log('[Illustrations][ContextMenu] Image moved to page:', pageNumber);

        updateUndoRedoButtons();
        if (inBookPool) inBookPool.render();
        renderToolbar();
        updateSpreadPreview();
    }

    /**
     * Handle "Lock" context menu action.
     * @param {object} img - The illustration DTO
     */
    async function handleContextLock(img) {
        console.log('[Illustrations][ContextMenu] handleContextLock — uuid:', img.image_uuid, 'label:', img.label);

        // Call backend lock endpoint (persists lock_state + triggers reflow)
        showReflowSpinner();
        try {
            console.log('[Illustrations][ContextMenu] Calling backend lock endpoint for:', img.image_uuid);
            const lockResult = await api.post(`/projects/${projectId}/illustrations/${img.image_uuid}/lock`);
            console.log('[Illustrations][ContextMenu] Backend lock result:', lockResult);
            const taskId = lockResult.task_id || lockResult.taskId;

            // Update local state to match backend
            const before = { image_uuid: img.image_uuid, lock_state: img.lock_state };
            img.lock_state = true;

            actionStack.push({
                type: 'lock_toggle',
                before,
                after: { image_uuid: img.image_uuid, lock_state: true },
                description: `Lock ${img.label} (via context menu)`
            });

            updateUndoRedoButtons();
            if (inBookPool) inBookPool.render();
            renderToolbar();
            updateSpreadPreview();

            console.log('[Illustrations][ContextMenu] Lock persisted, task_id:', taskId);
            if (taskId) {
                await pollReflowStatus(taskId);
            } else {
                console.log('[Illustrations][ContextMenu] No task_id returned — assuming immediate completion');
                hideReflowSpinner();
                await refreshIllustrationsFromBackend();
            }
        } catch (err) {
            console.error('[Illustrations][ContextMenu] Backend lock failed:', err.message, err);
            hideReflowSpinner();
            const $status = $container.find('#illustrations-status');
            showError($status, 'Lock failed: ' + err.message);
        }
    }

    /**
     * Handle "Unlock" context menu action with cascade warning.
     * @param {object} img - The illustration DTO
     */
    async function handleContextUnlock(img) {
        console.log('[Illustrations][ContextMenu] handleContextUnlock — uuid:', img.image_uuid, 'label:', img.label);

        const inBookImages = getPoolImages('in_book');
        const currentPage = (img.placement && img.placement.page_number) || img.page_number || 0;
        const laterLocked = inBookImages.filter(i => {
            const p = (i.placement && i.placement.page_number) || i.page_number || 0;
            return i.lock_state && p > currentPage && i.image_uuid !== img.image_uuid;
        });

        if (laterLocked.length > 0) {
            const proceed = confirm(`This will unlock ${laterLocked.length} image(s) on later pages. Proceed?`);
            if (!proceed) {
                console.log('[Illustrations][ContextMenu] Unlock cancelled by user (cascade warning)');
                return;
            }
        }

        // Call backend cascade unlock endpoint
        console.log('[Illustrations][ContextMenu] Calling backend cascade unlock for:', img.image_uuid);
        try {
            const unlockResult = await api.post(`/projects/${projectId}/illustrations/${img.image_uuid}/unlock`);
            console.log('[Illustrations][ContextMenu] Backend cascade unlock result:', unlockResult);
            const unlockCount = unlockResult.unlocked_count || 1;
            console.log('[Illustrations][ContextMenu] Backend cascade unlock complete — unlocked_count:', unlockCount);

            // Update local state to match backend
            const before = { image_uuid: img.image_uuid, lock_state: img.lock_state };
            img.lock_state = false;

            // Cascade unlock local state
            for (const laterImg of laterLocked) {
                laterImg.lock_state = false;
                console.log('[Illustrations][ContextMenu] Cascade unlock (local):', laterImg.image_uuid, laterImg.label);
            }

            actionStack.push({
                type: 'lock_toggle',
                before,
                after: { image_uuid: img.image_uuid, lock_state: false },
                description: `Unlock ${img.label} (via context menu)`
            });

            updateUndoRedoButtons();
            if (inBookPool) inBookPool.render();
            renderToolbar();
            updateSpreadPreview();
        } catch (err) {
            console.error('[Illustrations][ContextMenu] Backend cascade unlock failed:', err.message, err);
            const $status = $container.find('#illustrations-status');
            showError($status, 'Unlock failed: ' + err.message);
        }
    }

    /**
     * Handle "Delete" context menu action.
     * Removes image from project entirely (from any pool).
     * @param {object} img - The illustration DTO
     */
    async function handleContextDelete(img) {
        console.log('[Illustrations][ContextMenu] handleContextDelete — uuid:', img.image_uuid,
            'label:', img.label, 'pool:', img.pool, 'source:', img.source);

        // Note: confirmation for extracted images is already handled in ContextMenu._handleAction
        actionStack.push({
            type: 'delete',
            before: { image_uuid: img.image_uuid, pool: img.pool, label: img.label, placement: img.placement ? { ...img.placement } : null },
            after: { image_uuid: img.image_uuid, pool: '__deleted__' },
            description: `Delete ${img.label} (via context menu)`
        });

        illustrations = illustrations.filter(i => i.image_uuid !== img.image_uuid);
        if (selectedImageUuid === img.image_uuid) {
            selectedImageUuid = null;
        }

        updateUndoRedoButtons();
        if (sharedPoolComponent) sharedPoolComponent.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (inBookPool) inBookPool.render();
        renderToolbar();
        updateSpreadPreview();

        // Persist deletion to backend
        try {
            await api.delete(`/projects/${projectId}/illustrations/${img.image_uuid}`);
            console.log('[Illustrations][ContextMenu] Backend delete successful for:', img.image_uuid);
        } catch (err) {
            console.error('[Illustrations][ContextMenu] Backend delete failed for:', img.image_uuid, err.message, err);
        }
    }

    /**
     * Handle "Remove from book" context menu action.
     * Moves image back to available pool, clears placement.
     * @param {object} img - The illustration DTO
     */
    function handleRemoveFromBook(img) {
        console.log('[Illustrations][ContextMenu] handleRemoveFromBook — uuid:', img.image_uuid,
            'label:', img.label);

        const beforeState = {
            image_uuid: img.image_uuid,
            pool: img.pool,
            placement: img.placement ? { ...img.placement } : null,
            lock_state: img.lock_state
        };

        img.pool = 'available';
        img.placement = null;
        img.lock_state = false;

        actionStack.push({
            type: 'remove_from_book',
            before: beforeState,
            after: { image_uuid: img.image_uuid, pool: 'available', placement: null, lock_state: false },
            description: `Remove ${img.label} from book (return to available)`
        });

        console.log('[Illustrations][ContextMenu] Image returned to available pool:', img.image_uuid);

        if (selectedImageUuid === img.image_uuid) {
            selectedImageUuid = null;
        }

        updateUndoRedoButtons();
        if (sharedPoolComponent) sharedPoolComponent.render();
        if (availablePoolComponent) availablePoolComponent.render();
        if (inBookPool) inBookPool.render();
        renderToolbar();
        updateSpreadPreview();
    }

    // --- Save handler ---
    async function handleSave() {
        console.log('[Illustrations] handleSave() called — saving all illustration state');
        const $btn = $container.find('#ill-save');
        const $status = $container.find('#illustrations-status');
        setLoading($btn, true, 'Saving...');
        clearMessages($status);

        const payload = {
            illustrations: illustrations.map(img => ({
                image_uuid: img.image_uuid,
                label: img.label,
                pool: img.pool,
                source: img.source,
                placement: img.placement || null,
                lock_state: img.lock_state || false,
                file_ext: img.file_ext,
                original_width_px: img.original_width_px,
                original_height_px: img.original_height_px
            }))
        };

        console.log('[Illustrations] Save payload:', JSON.stringify(payload).substring(0, 500), '...');

        try {
            await api.post(`/projects/${projectId}/illustrations/save`, payload);
            console.log('[Illustrations] Save successful');
            showSuccess($status, 'Illustrations saved successfully.');
        } catch (err) {
            console.error('[Illustrations] Save failed:', err.message, err);
            showError($status, 'Failed to save: ' + err.message);
        } finally {
            setLoading($btn, false);
        }
    }

    // --- Update undo/redo button states ---
    function updateUndoRedoButtons() {
        const $undo = $container.find('#ill-undo');
        const $redo = $container.find('#ill-redo');
        $undo.prop('disabled', !actionStack.canUndo());
        $redo.prop('disabled', !actionStack.canRedo());
        console.log('[Illustrations] updateUndoRedoButtons — canUndo:', actionStack.canUndo(), 'canRedo:', actionStack.canRedo());
    }
}
