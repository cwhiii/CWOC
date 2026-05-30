/**
 * Client-side DPI calculator for resolution warning recalculation.
 * Mirrors the backend logic in backend/app/services/illustrations/dpi_calculator.py.
 *
 * DPI formula: min(original_width_px / display_width_inches, original_height_px / display_height_inches) < 300
 *
 * Requirements: 17.1, 17.2
 */

const DPI_THRESHOLD = 300;
const POINTS_PER_INCH = 72.0;

/**
 * Calculate the effective print DPI for an image at a given display size.
 * Returns the minimum of horizontal and vertical DPI.
 *
 * @param {number} originalWidthPx - Original image width in pixels
 * @param {number} originalHeightPx - Original image height in pixels
 * @param {number} displayWidthInches - Physical display width in inches
 * @param {number} displayHeightInches - Physical display height in inches
 * @returns {number} Effective DPI (minimum of horizontal and vertical)
 */
export function calculateEffectiveDpi(originalWidthPx, originalHeightPx, displayWidthInches, displayHeightInches) {
    console.log('[DPI] calculateEffectiveDpi: entry —',
        'originalWidthPx:', originalWidthPx,
        'originalHeightPx:', originalHeightPx,
        'displayWidthInches:', displayWidthInches.toFixed(4),
        'displayHeightInches:', displayHeightInches.toFixed(4));

    if (displayWidthInches <= 0 || displayHeightInches <= 0) {
        console.log('[DPI] calculateEffectiveDpi: display dimensions non-positive, returning 0');
        return 0;
    }

    const horizontalDpi = originalWidthPx / displayWidthInches;
    const verticalDpi = originalHeightPx / displayHeightInches;
    const effectiveDpi = Math.min(horizontalDpi, verticalDpi);

    console.log('[DPI] calculateEffectiveDpi: horizontalDpi:', horizontalDpi.toFixed(2),
        'verticalDpi:', verticalDpi.toFixed(2),
        'effectiveDpi:', effectiveDpi.toFixed(2));

    return effectiveDpi;
}

/**
 * Determine whether a resolution warning should be displayed.
 * Warning is active when effective DPI < 300.
 *
 * @param {number} originalWidthPx - Original image width in pixels
 * @param {number} originalHeightPx - Original image height in pixels
 * @param {number} displayWidthInches - Physical display width in inches
 * @param {number} displayHeightInches - Physical display height in inches
 * @returns {boolean} True if DPI < 300 (image will appear fuzzy in print)
 */
export function hasResolutionWarning(originalWidthPx, originalHeightPx, displayWidthInches, displayHeightInches) {
    const effectiveDpi = calculateEffectiveDpi(originalWidthPx, originalHeightPx, displayWidthInches, displayHeightInches);
    const warningActive = effectiveDpi < DPI_THRESHOLD;

    console.log('[DPI] hasResolutionWarning: effectiveDpi:', effectiveDpi.toFixed(2),
        'threshold:', DPI_THRESHOLD,
        'warningActive:', warningActive);

    return warningActive;
}

/**
 * Convert a height setting to physical display dimensions in inches.
 * Mirrors backend compute_display_inches().
 *
 * For inline mode: display_height_inches = (height_in_lines × line_height_pt) / 72
 *                  display_width_inches = display_height_inches × (W/H)
 *
 * For full_page/plate: display_height_inches = (height_pct / 100) × page_height_inches
 *                      display_width_inches = display_height_inches × (W/H)
 *
 * @param {number} height - Height value (lines for inline, percentage for full_page/plate)
 * @param {string} placementMode - 'inline', 'full_page', or 'plate'
 * @param {number} pageWidthInches - Available page width in inches (within margins)
 * @param {number} pageHeightInches - Available page height in inches (within margins)
 * @param {number} aspectRatio - Image width-to-height ratio (original_width / original_height)
 * @param {number} [lineHeightPt=14.3] - Line height in points (default: 11pt × 1.3 leading)
 * @returns {{ displayWidthInches: number, displayHeightInches: number }}
 */
export function computeDisplayInches(height, placementMode, pageWidthInches, pageHeightInches, aspectRatio, lineHeightPt = 14.3) {
    console.log('[DPI] computeDisplayInches: entry —',
        'height:', height,
        'placementMode:', placementMode,
        'pageWidthInches:', pageWidthInches,
        'pageHeightInches:', pageHeightInches,
        'aspectRatio:', aspectRatio.toFixed(4),
        'lineHeightPt:', lineHeightPt);

    let displayWidthInches, displayHeightInches;

    if (placementMode === 'inline') {
        // Height is in lines — convert to points, then to inches
        const heightPoints = height * lineHeightPt;
        displayHeightInches = heightPoints / POINTS_PER_INCH;
        displayWidthInches = displayHeightInches * aspectRatio;

        console.log('[DPI] computeDisplayInches: inline —',
            'heightPoints:', heightPoints.toFixed(4),
            'displayHeightInches:', displayHeightInches.toFixed(4),
            'displayWidthInches:', displayWidthInches.toFixed(4));
    } else if (placementMode === 'full_page' || placementMode === 'plate') {
        // Height is a percentage of page height
        displayHeightInches = (height / 100.0) * pageHeightInches;
        displayWidthInches = displayHeightInches * aspectRatio;

        // Cap width at page width
        if (displayWidthInches > pageWidthInches) {
            displayWidthInches = pageWidthInches;
            displayHeightInches = displayWidthInches / aspectRatio;
            console.log('[DPI] computeDisplayInches: width capped at pageWidth —',
                'recalculated displayHeightInches:', displayHeightInches.toFixed(4));
        }

        console.log('[DPI] computeDisplayInches:', placementMode, '—',
            'percentage:', height + '%',
            'displayHeightInches:', displayHeightInches.toFixed(4),
            'displayWidthInches:', displayWidthInches.toFixed(4));
    } else {
        console.error('[DPI] computeDisplayInches: unrecognized placementMode:', placementMode);
        return { displayWidthInches: 0, displayHeightInches: 0 };
    }

    console.log('[DPI] computeDisplayInches: exit —',
        'displayWidthInches:', displayWidthInches.toFixed(4),
        'displayHeightInches:', displayHeightInches.toFixed(4));

    return { displayWidthInches, displayHeightInches };
}

/**
 * Recalculate the resolution_warning field for an illustration DTO based on its
 * current height/placement settings and page configuration.
 *
 * @param {object} img - The illustration DTO (must have original_width_px, original_height_px, placement)
 * @param {object} pageConfig - Page configuration
 * @param {number} pageConfig.pageWidthInches - Page width in inches (within margins)
 * @param {number} pageConfig.pageHeightInches - Page height in inches (within margins)
 * @param {number} [pageConfig.lineHeightPt=14.3] - Line height in points
 * @returns {boolean} The new resolution_warning value
 */
export function recalculateResolutionWarning(img, pageConfig) {
    console.log('[DPI] recalculateResolutionWarning: entry — image_uuid:', img.image_uuid,
        'label:', img.label);

    const originalWidthPx = img.original_width_px || 0;
    const originalHeightPx = img.original_height_px || 0;

    if (originalWidthPx <= 0 || originalHeightPx <= 0) {
        console.log('[DPI] recalculateResolutionWarning: no valid pixel dimensions, returning false');
        img.resolution_warning = false;
        return false;
    }

    const placement = img.placement || {};
    const mode = placement.mode || img.placement_mode || null;
    const height = placement.height || img.height || null;

    if (!mode || !height) {
        console.log('[DPI] recalculateResolutionWarning: no placement mode or height, returning false');
        img.resolution_warning = false;
        return false;
    }

    const aspectRatio = originalWidthPx / originalHeightPx;
    const pageWidthInches = pageConfig.pageWidthInches || 5.5;
    const pageHeightInches = pageConfig.pageHeightInches || 8.5;
    const lineHeightPt = pageConfig.lineHeightPt || 14.3;

    const { displayWidthInches, displayHeightInches } = computeDisplayInches(
        height, mode, pageWidthInches, pageHeightInches, aspectRatio, lineHeightPt
    );

    const warning = hasResolutionWarning(originalWidthPx, originalHeightPx, displayWidthInches, displayHeightInches);

    console.log('[DPI] recalculateResolutionWarning: result —',
        'image_uuid:', img.image_uuid,
        'mode:', mode,
        'height:', height,
        'effectiveDpi:', calculateEffectiveDpi(originalWidthPx, originalHeightPx, displayWidthInches, displayHeightInches).toFixed(2),
        'warning:', warning);

    img.resolution_warning = warning;
    return warning;
}

/**
 * Recalculate resolution warnings for all in_book images.
 * Call this after any height/size change to update all ⚠️ indicators.
 *
 * @param {Array} illustrations - Full array of illustration DTOs
 * @param {object} pageConfig - Page configuration
 * @returns {number} Count of images with active warnings
 */
export function recalculateAllResolutionWarnings(illustrations, pageConfig) {
    console.log('[DPI] recalculateAllResolutionWarnings: entry — total illustrations:', illustrations.length);

    const inBookImages = illustrations.filter(img => img.pool === 'in_book');
    let warningCount = 0;

    for (const img of inBookImages) {
        const warning = recalculateResolutionWarning(img, pageConfig);
        if (warning) warningCount++;
    }

    console.log('[DPI] recalculateAllResolutionWarnings: exit —',
        'inBookCount:', inBookImages.length,
        'warningCount:', warningCount);

    return warningCount;
}
