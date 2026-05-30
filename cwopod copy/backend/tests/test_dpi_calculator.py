"""Unit tests for DPI calculation and resolution warning logic (task 2.4).

Tests the three functions in dpi_calculator.py:
- calculate_effective_dpi
- has_resolution_warning
- compute_display_inches
"""

import pytest

from app.services.illustrations.dpi_calculator import (
    DPI_THRESHOLD,
    POINTS_PER_INCH,
    calculate_effective_dpi,
    compute_display_inches,
    has_resolution_warning,
)


class TestCalculateEffectiveDpi:
    """Test effective DPI calculation."""

    def test_square_image_at_one_inch(self):
        """300x300 image at 1x1 inch = 300 DPI."""
        result = calculate_effective_dpi(300, 300, 1.0, 1.0)
        assert result == 300.0

    def test_high_res_image(self):
        """3000x2000 image at 5x3.33 inches = 600 DPI."""
        result = calculate_effective_dpi(3000, 2000, 5.0, 10.0 / 3.0)
        assert result == pytest.approx(600.0)

    def test_low_res_image(self):
        """150x150 image at 1x1 inch = 150 DPI (below threshold)."""
        result = calculate_effective_dpi(150, 150, 1.0, 1.0)
        assert result == 150.0

    def test_asymmetric_dpi_takes_minimum(self):
        """600x300 image at 1x1 inch — horizontal=600, vertical=300, min=300."""
        result = calculate_effective_dpi(600, 300, 1.0, 1.0)
        assert result == 300.0

    def test_asymmetric_dpi_vertical_lower(self):
        """300x600 image at 1x1 inch — horizontal=300, vertical=600, min=300."""
        result = calculate_effective_dpi(300, 600, 1.0, 1.0)
        assert result == 300.0

    def test_zero_display_width_returns_zero(self):
        """Zero display width returns 0.0 (guard against division by zero)."""
        result = calculate_effective_dpi(300, 300, 0.0, 1.0)
        assert result == 0.0

    def test_zero_display_height_returns_zero(self):
        """Zero display height returns 0.0."""
        result = calculate_effective_dpi(300, 300, 1.0, 0.0)
        assert result == 0.0

    def test_negative_display_returns_zero(self):
        """Negative display dimensions return 0.0."""
        result = calculate_effective_dpi(300, 300, -1.0, 1.0)
        assert result == 0.0

    def test_typical_book_image(self):
        """2400x3600 image at 5x7.5 inches = 480 DPI (both axes)."""
        result = calculate_effective_dpi(2400, 3600, 5.0, 7.5)
        assert result == 480.0


class TestHasResolutionWarning:
    """Test resolution warning threshold logic."""

    def test_exactly_300_dpi_no_warning(self):
        """At exactly 300 DPI, no warning (not strictly less than)."""
        result = has_resolution_warning(300, 300, 1.0, 1.0)
        assert result is False

    def test_above_300_dpi_no_warning(self):
        """Above 300 DPI, no warning."""
        result = has_resolution_warning(600, 600, 1.0, 1.0)
        assert result is False

    def test_below_300_dpi_warning(self):
        """Below 300 DPI, warning is active."""
        result = has_resolution_warning(200, 200, 1.0, 1.0)
        assert result is True

    def test_just_below_300_dpi_warning(self):
        """299 pixels at 1 inch = 299 DPI, warning active."""
        result = has_resolution_warning(299, 299, 1.0, 1.0)
        assert result is True

    def test_large_display_triggers_warning(self):
        """600x600 image at 3x3 inches = 200 DPI, warning active."""
        result = has_resolution_warning(600, 600, 3.0, 3.0)
        assert result is True

    def test_small_display_no_warning(self):
        """600x600 image at 0.5x0.5 inches = 1200 DPI, no warning."""
        result = has_resolution_warning(600, 600, 0.5, 0.5)
        assert result is False

    def test_zero_dimensions_warning(self):
        """Zero display dimensions → 0 DPI → warning active (edge case)."""
        # calculate_effective_dpi returns 0.0 for zero dimensions, which is < 300
        result = has_resolution_warning(300, 300, 0.0, 0.0)
        assert result is True


class TestComputeDisplayInches:
    """Test height-to-inches conversion for different placement modes."""

    def test_inline_basic(self):
        """Inline: 8 lines at default line height (14.3pt) → known inches."""
        # 8 lines × 14.3pt = 114.4pt / 72 = 1.5889 inches height
        # With aspect ratio 1.5: width = 1.5889 * 1.5 = 2.3833 inches
        width, height = compute_display_inches(
            height=8.0,
            placement_mode="inline",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=1.5,
        )
        expected_height = (8.0 * 14.3) / 72.0
        expected_width = expected_height * 1.5
        assert height == pytest.approx(expected_height, rel=1e-4)
        assert width == pytest.approx(expected_width, rel=1e-4)

    def test_inline_square_aspect(self):
        """Inline: square image (aspect_ratio=1.0), 4 lines."""
        width, height = compute_display_inches(
            height=4.0,
            placement_mode="inline",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=1.0,
        )
        expected_height = (4.0 * 14.3) / 72.0
        assert height == pytest.approx(expected_height, rel=1e-4)
        assert width == pytest.approx(expected_height, rel=1e-4)  # square

    def test_inline_custom_line_height(self):
        """Inline with custom line height."""
        width, height = compute_display_inches(
            height=10.0,
            placement_mode="inline",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=2.0,
            line_height_points=12.0,
        )
        expected_height = (10.0 * 12.0) / 72.0
        expected_width = expected_height * 2.0
        assert height == pytest.approx(expected_height, rel=1e-4)
        assert width == pytest.approx(expected_width, rel=1e-4)

    def test_full_page_100_percent(self):
        """Full page at 100% height uses full page height."""
        width, height = compute_display_inches(
            height=100.0,
            placement_mode="full_page",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=0.5,
        )
        # 100% of 8.5 = 8.5 inches height
        # width = 8.5 * 0.5 = 4.25 (within 5.5 page width)
        assert height == pytest.approx(8.5, rel=1e-4)
        assert width == pytest.approx(4.25, rel=1e-4)

    def test_full_page_50_percent(self):
        """Full page at 50% height."""
        width, height = compute_display_inches(
            height=50.0,
            placement_mode="full_page",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=1.0,
        )
        # 50% of 8.5 = 4.25 inches height
        # width = 4.25 * 1.0 = 4.25 (within 5.5 page width)
        assert height == pytest.approx(4.25, rel=1e-4)
        assert width == pytest.approx(4.25, rel=1e-4)

    def test_full_page_width_capped(self):
        """Full page where width would exceed page width — gets capped."""
        width, height = compute_display_inches(
            height=100.0,
            placement_mode="full_page",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=2.0,  # very wide image
        )
        # 100% of 8.5 = 8.5 height → width = 8.5 * 2.0 = 17.0 > 5.5
        # Capped: width = 5.5, height = 5.5 / 2.0 = 2.75
        assert width == pytest.approx(5.5, rel=1e-4)
        assert height == pytest.approx(2.75, rel=1e-4)

    def test_plate_same_as_full_page(self):
        """Plate mode uses same percentage logic as full_page."""
        width, height = compute_display_inches(
            height=75.0,
            placement_mode="plate",
            page_width_inches=5.5,
            page_height_inches=8.5,
            aspect_ratio=0.8,
        )
        # 75% of 8.5 = 6.375 inches height
        # width = 6.375 * 0.8 = 5.1 (within 5.5 page width)
        assert height == pytest.approx(6.375, rel=1e-4)
        assert width == pytest.approx(5.1, rel=1e-4)

    def test_plate_width_capped(self):
        """Plate mode with width capping."""
        width, height = compute_display_inches(
            height=80.0,
            placement_mode="plate",
            page_width_inches=4.0,
            page_height_inches=6.0,
            aspect_ratio=3.0,
        )
        # 80% of 6.0 = 4.8 height → width = 4.8 * 3.0 = 14.4 > 4.0
        # Capped: width = 4.0, height = 4.0 / 3.0 = 1.333
        assert width == pytest.approx(4.0, rel=1e-4)
        assert height == pytest.approx(4.0 / 3.0, rel=1e-4)

    def test_invalid_placement_mode_raises(self):
        """Invalid placement mode raises ValueError."""
        with pytest.raises(ValueError, match="Unrecognized placement_mode"):
            compute_display_inches(
                height=50.0,
                placement_mode="invalid",
                page_width_inches=5.5,
                page_height_inches=8.5,
                aspect_ratio=1.0,
            )
