"""DPI calculation and resolution warning logic for illustrations.

Computes effective print DPI based on original image pixel dimensions and
physical display size, and determines whether a resolution warning should
be shown (DPI < 300 threshold).
"""

import logging

logger = logging.getLogger(__name__)

# Standard print DPI threshold — images below this will appear fuzzy in print.
DPI_THRESHOLD = 300

# Points per inch (standard typographic conversion).
POINTS_PER_INCH = 72.0


def calculate_effective_dpi(
    original_width_px: int,
    original_height_px: int,
    display_width_inches: float,
    display_height_inches: float,
) -> float:
    """Calculate the effective print DPI for an image at a given display size.

    The effective DPI is the minimum of the horizontal and vertical DPI,
    since the limiting axis determines perceived sharpness.

    Args:
        original_width_px: Original image width in pixels.
        original_height_px: Original image height in pixels.
        display_width_inches: Physical display width in inches on the printed page.
        display_height_inches: Physical display height in inches on the printed page.

    Returns:
        The effective DPI (minimum of horizontal and vertical DPI).
        Returns 0.0 if display dimensions are zero or negative.
    """
    logger.debug(
        "calculate_effective_dpi: entry — original_width_px=%d, original_height_px=%d, "
        "display_width_inches=%.4f, display_height_inches=%.4f",
        original_width_px,
        original_height_px,
        display_width_inches,
        display_height_inches,
    )

    if display_width_inches <= 0 or display_height_inches <= 0:
        logger.debug(
            "calculate_effective_dpi: display dimensions non-positive, returning 0.0"
        )
        return 0.0

    horizontal_dpi = original_width_px / display_width_inches
    vertical_dpi = original_height_px / display_height_inches
    effective_dpi = min(horizontal_dpi, vertical_dpi)

    logger.debug(
        "calculate_effective_dpi: horizontal_dpi=%.2f, vertical_dpi=%.2f, effective_dpi=%.2f",
        horizontal_dpi,
        vertical_dpi,
        effective_dpi,
    )
    return effective_dpi


def has_resolution_warning(
    original_width_px: int,
    original_height_px: int,
    display_width_inches: float,
    display_height_inches: float,
) -> bool:
    """Determine whether a resolution warning should be displayed.

    A warning is active when the effective DPI falls below the 300 DPI
    print threshold.

    Args:
        original_width_px: Original image width in pixels.
        original_height_px: Original image height in pixels.
        display_width_inches: Physical display width in inches on the printed page.
        display_height_inches: Physical display height in inches on the printed page.

    Returns:
        True if the effective DPI is below 300 (image will appear fuzzy in print),
        False otherwise.
    """
    logger.debug(
        "has_resolution_warning: entry — original_width_px=%d, original_height_px=%d, "
        "display_width_inches=%.4f, display_height_inches=%.4f",
        original_width_px,
        original_height_px,
        display_width_inches,
        display_height_inches,
    )

    effective_dpi = calculate_effective_dpi(
        original_width_px, original_height_px, display_width_inches, display_height_inches
    )
    warning_active = effective_dpi < DPI_THRESHOLD

    logger.debug(
        "has_resolution_warning: effective_dpi=%.2f, threshold=%d, warning_active=%s",
        effective_dpi,
        DPI_THRESHOLD,
        warning_active,
    )
    return warning_active


def compute_display_inches(
    height: float,
    placement_mode: str,
    page_width_inches: float,
    page_height_inches: float,
    aspect_ratio: float,
    line_height_points: float = 11.0 * 1.3,
) -> tuple[float, float]:
    """Convert a height setting to physical display dimensions in inches.

    The interpretation of the height parameter depends on the placement mode:
    - inline: height is in lines (multiply by line_height_points to get points,
      then convert to inches). Width is derived from aspect ratio.
    - full_page / plate: height is a percentage of page height (0-100).
      Width is derived from aspect ratio, capped at page width.

    Args:
        height: The height value — lines (inline) or percentage (full_page/plate).
        placement_mode: One of "inline", "full_page", or "plate".
        page_width_inches: The available page width in inches (within margins).
        page_height_inches: The available page height in inches (within margins).
        aspect_ratio: The image's width-to-height ratio (original_width / original_height).
        line_height_points: The line height in points. Defaults to 11pt × 1.3 leading = 14.3pt.

    Returns:
        A tuple of (display_width_inches, display_height_inches).

    Raises:
        ValueError: If placement_mode is not one of the recognized values.
    """
    logger.debug(
        "compute_display_inches: entry — height=%.4f, placement_mode=%s, "
        "page_width_inches=%.4f, page_height_inches=%.4f, aspect_ratio=%.4f, "
        "line_height_points=%.4f",
        height,
        placement_mode,
        page_width_inches,
        page_height_inches,
        aspect_ratio,
        line_height_points,
    )

    if placement_mode == "inline":
        # Height is in lines — convert to points, then to inches.
        height_points = height * line_height_points
        display_height_inches = height_points / POINTS_PER_INCH
        # Width derived from aspect ratio.
        display_width_inches = display_height_inches * aspect_ratio

        logger.debug(
            "compute_display_inches: inline — height_points=%.4f, "
            "display_height_inches=%.4f, display_width_inches=%.4f",
            height_points,
            display_height_inches,
            display_width_inches,
        )

    elif placement_mode in ("full_page", "plate"):
        # Height is a percentage of page height.
        display_height_inches = (height / 100.0) * page_height_inches
        # Width derived from aspect ratio, capped at page width.
        display_width_inches = display_height_inches * aspect_ratio
        if display_width_inches > page_width_inches:
            display_width_inches = page_width_inches
            # Recalculate height to maintain aspect ratio when width-capped.
            display_height_inches = display_width_inches / aspect_ratio

            logger.debug(
                "compute_display_inches: width capped at page_width — "
                "recalculated display_height_inches=%.4f",
                display_height_inches,
            )

        logger.debug(
            "compute_display_inches: %s — percentage=%.2f%%, "
            "display_height_inches=%.4f, display_width_inches=%.4f",
            placement_mode,
            height,
            display_height_inches,
            display_width_inches,
        )

    else:
        logger.error(
            "compute_display_inches: unrecognized placement_mode=%s", placement_mode
        )
        raise ValueError(
            f"Unrecognized placement_mode '{placement_mode}'. "
            f"Expected 'inline', 'full_page', or 'plate'."
        )

    logger.debug(
        "compute_display_inches: exit — display_width_inches=%.4f, display_height_inches=%.4f",
        display_width_inches,
        display_height_inches,
    )
    return (display_width_inches, display_height_inches)
