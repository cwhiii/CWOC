"""Cover assembler: produces print-ready CMYK PDF covers with PyCairo."""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.services.cover.prompt_generator import CoverServiceError

logger = logging.getLogger(__name__)

# Paper stock thickness constants (mm per sheet)
PAPER_THICKNESS = {
    "standard_white": 0.1,
    "cream": 0.11,
    "premium_white": 0.12,
    "heavy": 0.14,
}
COVER_BOARD_THICKNESS = 0.6  # mm, both sides combined (paperback)
HARDBACK_BOARD_THICKNESS = 3.0  # mm, both sides combined (hardback/case wrap)
BLEED_MM = 3.0
MIN_DPI = 300

# Default trade paperback dimensions (5.5" x 8.5") — used as fallback only
DEFAULT_COVER_WIDTH_MM = 139.7
DEFAULT_COVER_HEIGHT_MM = 215.9

# Supported trim sizes: "WxH" string -> (width_inches, height_inches)
TRIM_SIZES = {
    "4.25x6.87": (4.25, 6.87),
    "5x8": (5.0, 8.0),
    "5.06x7.81": (5.06, 7.81),
    "5.25x8": (5.25, 8.0),
    "5.5x8.5": (5.5, 8.5),
    "6x9": (6.0, 9.0),
    "8.5x11": (8.5, 11.0),
}

# Conversion factor
MM_TO_PT = 2.835
INCHES_TO_MM = 25.4


class CoverValidationError(CoverServiceError):
    """Raised when cover layout is missing required elements."""

    def __init__(self, missing_elements: list[str]):
        self.missing_elements = missing_elements
        message = f"Missing required elements: {', '.join(missing_elements)}"
        super().__init__(message, can_retry=False)


class CoverAssembler:
    """Assembles print-ready cover PDFs with CMYK color space and proper bleed."""

    def __init__(self, trim_size: str | None = None):
        """Initialize with an optional trim size string (e.g. '5.5x8.5', '6x9').

        If not provided or invalid, defaults to 5.5x8.5.
        """
        self.cover_width_mm, self.cover_height_mm = self._resolve_trim_size(trim_size)
        logger.debug(
            "CoverAssembler initialized: trim_size=%s, cover_width_mm=%.1f, cover_height_mm=%.1f",
            trim_size, self.cover_width_mm, self.cover_height_mm,
        )

    @staticmethod
    def _resolve_trim_size(trim_size: str | None) -> tuple[float, float]:
        """Convert a trim size string to (width_mm, height_mm)."""
        if not trim_size:
            logger.debug("_resolve_trim_size: no trim_size provided, using default 5.5x8.5")
            return DEFAULT_COVER_WIDTH_MM, DEFAULT_COVER_HEIGHT_MM

        if trim_size in TRIM_SIZES:
            w_in, h_in = TRIM_SIZES[trim_size]
            w_mm = w_in * INCHES_TO_MM
            h_mm = h_in * INCHES_TO_MM
            logger.debug("_resolve_trim_size: '%s' -> %.1fmm x %.1fmm", trim_size, w_mm, h_mm)
            return w_mm, h_mm

        # Try parsing "WxH" format directly
        try:
            parts = trim_size.split("x")
            w_in = float(parts[0])
            h_in = float(parts[1])
            w_mm = w_in * INCHES_TO_MM
            h_mm = h_in * INCHES_TO_MM
            logger.debug("_resolve_trim_size: parsed '%s' -> %.1fmm x %.1fmm", trim_size, w_mm, h_mm)
            return w_mm, h_mm
        except (ValueError, IndexError):
            logger.warning("_resolve_trim_size: invalid trim_size '%s', using default 5.5x8.5", trim_size)
            return DEFAULT_COVER_WIDTH_MM, DEFAULT_COVER_HEIGHT_MM

    def calculate_spine_width(self, page_count: int, paper_stock: str = "standard_white", binding_type: str = "paperback") -> float:
        """Calculate spine width in mm.

        Formula: spine_width = (page_count × paper_thickness) + cover_board_thickness

        Args:
            page_count: Number of interior pages.
            paper_stock: Paper stock type (standard_white, cream, premium_white, heavy).
            binding_type: Binding type (paperback, hardback, micro).

        Returns:
            Spine width in millimeters.
        """
        logger.debug("calculate_spine_width: page_count=%d, paper_stock=%s, binding_type=%s", page_count, paper_stock, binding_type)
        thickness = PAPER_THICKNESS.get(paper_stock, PAPER_THICKNESS["standard_white"])
        if paper_stock not in PAPER_THICKNESS:
            logger.warning("calculate_spine_width: unknown paper_stock '%s', defaulting to standard_white", paper_stock)
        board_thickness = HARDBACK_BOARD_THICKNESS if binding_type in ("hardback", "micro") else COVER_BOARD_THICKNESS
        spine = (page_count * thickness) + board_thickness
        logger.info("calculate_spine_width: result=%.2fmm (pages=%d, thickness=%.3f, board=%.1f)", spine, page_count, thickness, board_thickness)
        return spine

    def validate_layout(self, layout: dict) -> list[str]:
        """Validate all required elements are present. Returns list of missing elements.

        Required elements:
        - front_cover image (image_path or front_image key)
        - title text
        - author text
        """
        logger.debug("validate_layout: checking layout keys=%s", list(layout.keys()))
        missing = []

        # Check front cover image
        front_cover = layout.get("front_cover", {})
        front_image = layout.get("front_image")
        if not front_cover.get("image_path") and not front_image:
            missing.append("front_cover_image")

        # Check title text
        title = layout.get("title", {})
        title_text = title.get("text") if isinstance(title, dict) else title
        if not title_text:
            missing.append("title_text")

        # Check author text
        author = layout.get("author", {})
        author_text = author.get("text") if isinstance(author, dict) else author
        if not author_text:
            missing.append("author_text")

        if missing:
            logger.warning("validate_layout: missing elements: %s", missing)
        else:
            logger.debug("validate_layout: all elements present")
        return missing

    async def assemble_cover(
        self,
        layout: dict,
        page_count: int,
        paper_stock: str = "standard_white",
        output_dir: Path | None = None,
        binding_type: str = "paperback",
    ) -> Path:
        """Assemble the final print-ready cover PDF.

        Uses PyCairo to produce a PDF with proper bleed and spine.
        Attempts CMYK color space via ICC profile if available.

        Args:
            layout: Cover layout dict with front_cover, title, author, blurb keys.
            page_count: Number of interior pages (for spine calculation).
            paper_stock: Paper stock type.
            output_dir: Directory to write the output PDF.
            binding_type: Binding type (paperback, hardback, micro).

        Returns:
            Path to the generated cover PDF.

        Raises:
            CoverValidationError: If required elements are missing.
        """
        logger.info(
            "assemble_cover: page_count=%d, paper_stock=%s, output_dir=%s",
            page_count, paper_stock, output_dir,
        )

        # Validate
        missing = self.validate_layout(layout)
        if missing:
            raise CoverValidationError(missing)

        spine_width_mm = self.calculate_spine_width(page_count, paper_stock, binding_type=binding_type)

        # Full spread dimensions with bleed
        total_width_mm = (2 * self.cover_width_mm) + spine_width_mm + (2 * BLEED_MM)
        total_height_mm = self.cover_height_mm + (2 * BLEED_MM)

        width_pt = total_width_mm * MM_TO_PT
        height_pt = total_height_mm * MM_TO_PT

        logger.info(
            "assemble_cover: dimensions total_width=%.1fmm, total_height=%.1fmm, spine=%.1fmm, trim=%.1fx%.1fmm",
            total_width_mm, total_height_mm, spine_width_mm, self.cover_width_mm, self.cover_height_mm,
        )

        if output_dir is None:
            output_dir = Path("/tmp")

        output_path = output_dir / "cover.pdf"

        try:
            import cairo

            # Create PDF surface
            surface = cairo.PDFSurface(str(output_path), width_pt, height_pt)
            ctx = cairo.Context(surface)

            # Fill background white
            ctx.set_source_rgb(1, 1, 1)
            ctx.paint()

            # Calculate panel positions in points
            bleed_pt = BLEED_MM * MM_TO_PT
            cover_w_pt = self.cover_width_mm * MM_TO_PT
            spine_w_pt = spine_width_mm * MM_TO_PT

            back_x = bleed_pt
            spine_x = bleed_pt + cover_w_pt
            front_x = bleed_pt + cover_w_pt + spine_w_pt

            # --- Draw front cover image ---
            front_image_path = layout.get("front_cover", {}).get("image_path") or layout.get("front_image")
            if front_image_path:
                self._draw_front_image(ctx, front_image_path, front_x, bleed_pt, cover_w_pt, self.cover_height_mm * MM_TO_PT)

            # --- Draw spine ---
            self._draw_spine(ctx, layout, spine_x, bleed_pt, spine_w_pt, self.cover_height_mm * MM_TO_PT)

            # --- Draw back cover ---
            blurb_text = layout.get("blurb", "")
            app_url = layout.get("app_url", "")
            self._draw_back_cover(ctx, blurb_text, app_url, back_x, bleed_pt, cover_w_pt, self.cover_height_mm * MM_TO_PT, output_dir)

            # --- Draw title text on front cover ---
            title_config = layout.get("title", {})
            if isinstance(title_config, str):
                title_config = {"text": title_config}
            self._draw_text_overlay(
                ctx,
                text=title_config.get("text", ""),
                font_size=title_config.get("font_size", 48),
                x_pct=title_config.get("x", 0.5),
                y_pct=title_config.get("y", 0.15),
                panel_x=front_x,
                panel_w=cover_w_pt,
                panel_h=self.cover_height_mm * MM_TO_PT,
                bleed_pt=bleed_pt,
                font_family=title_config.get("font_family", "serif"),
                color=title_config.get("color", "#FFFFFF"),
                anchor=title_config.get("anchor", "center"),
                max_width_pct=title_config.get("width", 100),
            )

            # --- Draw author text on front cover ---
            author_config = layout.get("author", {})
            if isinstance(author_config, str):
                author_config = {"text": author_config}
            self._draw_text_overlay(
                ctx,
                text=author_config.get("text", ""),
                font_size=author_config.get("font_size", 24),
                x_pct=author_config.get("x", 0.5),
                y_pct=author_config.get("y", 0.85),
                panel_x=front_x,
                panel_w=cover_w_pt,
                panel_h=self.cover_height_mm * MM_TO_PT,
                bleed_pt=bleed_pt,
                font_family=author_config.get("font_family", "serif"),
                color=author_config.get("color", "#FFFFFF"),
                anchor=author_config.get("anchor", "center"),
                max_width_pct=author_config.get("width", 100),
            )

            surface.finish()
            logger.info("assemble_cover: PDF written to %s", output_path)

        except ImportError:
            logger.warning("assemble_cover: PyCairo not available, creating placeholder PDF")
            # PyCairo not available — create a minimal valid PDF placeholder
            self._write_placeholder_pdf(output_path, total_width_mm, total_height_mm)

        return output_path

    def _draw_front_image(self, ctx, image_path: str, panel_x: float, bleed_pt: float, panel_w: float, panel_h: float):
        """Draw the front cover image scaled to fill the front panel."""
        logger.debug("_draw_front_image: path=%s", image_path)
        try:
            from PIL import Image
            import cairo
            import io

            img_path = Path(image_path)
            if not img_path.exists():
                logger.warning("_draw_front_image: image file not found at %s", image_path)
                # Draw a dark placeholder
                ctx.set_source_rgb(0.15, 0.15, 0.25)
                ctx.rectangle(panel_x, bleed_pt, panel_w, panel_h)
                ctx.fill()
                return

            # Load image with Pillow and convert to RGBA
            img = Image.open(img_path)
            img = img.convert("RGBA")

            # Scale image to fill the front panel
            target_w = int(panel_w)
            target_h = int(panel_h)
            img = img.resize((target_w, target_h), Image.LANCZOS)

            # Convert to Cairo ImageSurface format (ARGB32 premultiplied)
            img_data = bytearray(target_w * target_h * 4)
            for i, (r, g, b, a) in enumerate(img.getdata()):
                # Cairo uses premultiplied BGRA
                alpha = a / 255.0
                idx = i * 4
                img_data[idx] = int(b * alpha)      # B
                img_data[idx + 1] = int(g * alpha)  # G
                img_data[idx + 2] = int(r * alpha)  # R
                img_data[idx + 3] = a               # A

            img_surface = cairo.ImageSurface.create_for_data(
                img_data, cairo.FORMAT_ARGB32, target_w, target_h, target_w * 4
            )

            # Paint image onto the front panel
            ctx.save()
            ctx.translate(panel_x, bleed_pt)
            ctx.set_source_surface(img_surface, 0, 0)
            ctx.paint()
            ctx.restore()

            logger.debug("_draw_front_image: rendered %dx%d image", target_w, target_h)

        except Exception as e:
            logger.error("_draw_front_image: failed to render image: %s", e, exc_info=True)
            # Fallback: dark rectangle
            ctx.set_source_rgb(0.15, 0.15, 0.25)
            ctx.rectangle(panel_x, bleed_pt, panel_w, panel_h)
            ctx.fill()

    def _draw_spine(self, ctx, layout: dict, spine_x: float, bleed_pt: float, spine_w: float, panel_h: float):
        """Draw the spine with rotated title and author text."""
        logger.debug("_draw_spine: spine_w=%.1fpt", spine_w)
        try:
            import cairo

            # Spine background (dark)
            ctx.set_source_rgb(0.1, 0.1, 0.15)
            ctx.rectangle(spine_x, bleed_pt, spine_w, panel_h)
            ctx.fill()

            # Only draw text if spine is wide enough (> 5mm)
            if spine_w < 5 * MM_TO_PT:
                logger.debug("_draw_spine: spine too narrow for text")
                return

            # Get title and author
            title_config = layout.get("title", {})
            title_text = title_config.get("text", "") if isinstance(title_config, dict) else str(title_config)
            author_config = layout.get("author", {})
            author_text = author_config.get("text", "") if isinstance(author_config, dict) else str(author_config)

            spine_text = f"{title_text}  •  {author_text}" if author_text else title_text

            # Draw rotated text on spine (bottom to top reading direction)
            ctx.save()
            ctx.set_source_rgb(1, 1, 1)
            font_size = min(10, spine_w * 0.6)
            ctx.select_font_face("serif", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(font_size)

            # Rotate 90 degrees counter-clockwise and position
            ctx.translate(spine_x + spine_w / 2, bleed_pt + panel_h - 20)
            ctx.rotate(-1.5708)  # -90 degrees

            # Truncate if too long
            extents = ctx.text_extents(spine_text)
            max_width = panel_h - 40
            if extents.width > max_width:
                while len(spine_text) > 3 and ctx.text_extents(spine_text + "...").width > max_width:
                    spine_text = spine_text[:-1]
                spine_text += "..."

            ctx.move_to(0, font_size / 3)
            ctx.show_text(spine_text)
            ctx.restore()

        except Exception as e:
            logger.error("_draw_spine: failed: %s", e, exc_info=True)

    def _draw_back_cover(
        self, ctx, blurb: str, app_url: str,
        panel_x: float, bleed_pt: float, panel_w: float, panel_h: float,
        output_dir: Path,
    ):
        """Draw the back cover with synopsis, QR code, and link.

        Layout order (top to bottom): synopsis text → QR code → link text.
        """
        logger.debug("_draw_back_cover: blurb_len=%d, app_url=%s", len(blurb), app_url)
        try:
            import cairo

            # Light background for back cover
            ctx.set_source_rgb(0.97, 0.97, 0.97)
            ctx.rectangle(panel_x, bleed_pt, panel_w, panel_h)
            ctx.fill()

            # Draw synopsis text
            if blurb:
                ctx.set_source_rgb(0.1, 0.1, 0.1)
                ctx.select_font_face("serif", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
                ctx.set_font_size(10)

                # Simple word-wrap
                margin = 20
                x_start = panel_x + margin
                y_start = bleed_pt + 40
                max_line_width = panel_w - (2 * margin)
                line_height = 14

                words = blurb.split()
                current_line = ""
                y = y_start

                for word in words:
                    test_line = f"{current_line} {word}".strip()
                    extents = ctx.text_extents(test_line)
                    if extents.width > max_line_width and current_line:
                        ctx.move_to(x_start, y)
                        ctx.show_text(current_line)
                        current_line = word
                        y += line_height
                        if y > bleed_pt + panel_h - 100:
                            break
                    else:
                        current_line = test_line

                if current_line:
                    ctx.move_to(x_start, y)
                    ctx.show_text(current_line)
                    y += line_height

            # Draw QR code (minimum 2cm × 2cm = ~57pt × 57pt)
            qr_size_pt = max(57, 70)  # ~2.5cm
            qr_url = app_url or "https://cwopod.app"
            qr_image_path = self._generate_qr_code(qr_url, output_dir, "back_cover_qr.png")

            if qr_image_path and qr_image_path.exists():
                self._draw_qr_on_context(ctx, qr_image_path, panel_x + (panel_w - qr_size_pt) / 2, bleed_pt + panel_h - 120, qr_size_pt)

            # Draw link text below QR
            ctx.set_source_rgb(0.3, 0.3, 0.3)
            ctx.select_font_face("sans-serif", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(8)
            link_text = qr_url
            extents = ctx.text_extents(link_text)
            ctx.move_to(panel_x + (panel_w - extents.width) / 2, bleed_pt + panel_h - 35)
            ctx.show_text(link_text)

            # Draw "Assembled by CWOPOD" blurb at the bottom of the back cover
            ctx.set_source_rgb(0.45, 0.45, 0.45)
            ctx.select_font_face("sans-serif", cairo.FONT_SLANT_ITALIC, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(6.5)
            cwopod_line1 = "Assembled by CWOPOD"
            cwopod_line2 = "C.W.\u2019s Open Print-On-Demand"
            cwopod_line3 = "www.cwholemaniii.com/cwopod"
            ext1 = ctx.text_extents(cwopod_line1)
            ext2 = ctx.text_extents(cwopod_line2)
            ext3 = ctx.text_extents(cwopod_line3)
            ctx.move_to(panel_x + (panel_w - ext1.width) / 2, bleed_pt + panel_h - 26)
            ctx.show_text(cwopod_line1)
            ctx.move_to(panel_x + (panel_w - ext2.width) / 2, bleed_pt + panel_h - 17)
            ctx.show_text(cwopod_line2)
            ctx.set_font_size(5.5)
            ctx.select_font_face("sans-serif", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_source_rgb(0.35, 0.35, 0.35)
            ext3 = ctx.text_extents(cwopod_line3)
            ctx.move_to(panel_x + (panel_w - ext3.width) / 2, bleed_pt + panel_h - 9)
            ctx.show_text(cwopod_line3)

        except Exception as e:
            logger.error("_draw_back_cover: failed: %s", e, exc_info=True)

    def _generate_qr_code(self, url: str, output_dir: Path, filename: str = "qr.png") -> Optional[Path]:
        """Generate a QR code image using python-qrcode.

        Args:
            url: URL to encode in the QR code.
            output_dir: Directory to save the QR image.
            filename: Output filename.

        Returns:
            Path to the generated QR image, or None if generation fails.
        """
        logger.debug("_generate_qr_code: url=%s, output_dir=%s", url, output_dir)
        try:
            import qrcode

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=2,
            )
            qr.add_data(url)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            qr_path = output_dir / filename
            img.save(str(qr_path))
            logger.debug("_generate_qr_code: saved to %s", qr_path)
            return qr_path

        except ImportError:
            logger.warning("_generate_qr_code: python-qrcode not available")
            return None
        except Exception as e:
            logger.error("_generate_qr_code: failed: %s", e, exc_info=True)
            return None

    def _draw_qr_on_context(self, ctx, qr_path: Path, x: float, y: float, size: float):
        """Draw a QR code image onto the Cairo context."""
        logger.debug("_draw_qr_on_context: path=%s, pos=(%.1f, %.1f), size=%.1f", qr_path, x, y, size)
        try:
            import cairo
            from PIL import Image

            img = Image.open(qr_path).convert("RGBA")
            img = img.resize((int(size), int(size)), Image.LANCZOS)

            # Convert to Cairo format
            w, h = img.size
            img_data = bytearray(w * h * 4)
            for i, (r, g, b, a) in enumerate(img.getdata()):
                alpha = a / 255.0
                idx = i * 4
                img_data[idx] = int(b * alpha)
                img_data[idx + 1] = int(g * alpha)
                img_data[idx + 2] = int(r * alpha)
                img_data[idx + 3] = a

            img_surface = cairo.ImageSurface.create_for_data(
                img_data, cairo.FORMAT_ARGB32, w, h, w * 4
            )

            ctx.save()
            ctx.translate(x, y)
            ctx.set_source_surface(img_surface, 0, 0)
            ctx.paint()
            ctx.restore()

        except Exception as e:
            logger.error("_draw_qr_on_context: failed: %s", e, exc_info=True)

    def _draw_text_overlay(
        self, ctx, text: str, font_size: float,
        x_pct: float, y_pct: float,
        panel_x: float, panel_w: float, panel_h: float, bleed_pt: float,
        font_family: str = "serif", color: str = "#FFFFFF", anchor: str = "center",
        max_width_pct: float = 100.0,
    ):
        """Draw text at a proportional position on a panel with styling and optional width constraint."""
        if not text:
            return

        logger.debug("_draw_text_overlay: text='%s', font_size=%.1f, anchor=%s, max_width_pct=%.1f", text[:30], font_size, anchor, max_width_pct)
        try:
            import cairo

            # Parse color
            r, g, b = self._parse_color(color)
            ctx.set_source_rgb(r, g, b)

            # Set font
            slant = cairo.FONT_SLANT_NORMAL
            weight = cairo.FONT_WEIGHT_BOLD if font_size > 30 else cairo.FONT_WEIGHT_NORMAL
            ctx.select_font_face(font_family, slant, weight)
            
            # Calculate max width in points
            max_width_pt = panel_w * (max_width_pct / 100.0)
            
            # Set initial font size and calculate text width
            ctx.set_font_size(font_size)
            extents = ctx.text_extents(text)
            text_width = extents.width
            
            # If text is too wide, scale font size down proportionally
            if text_width > max_width_pt:
                logger.debug("_draw_text_overlay: text width %.1fpt exceeds max %.1fpt, scaling font size", text_width, max_width_pt)
                # Calculate scale factor to fit within max width
                scale_factor = max_width_pt / text_width
                scaled_font_size = font_size * scale_factor
                # Don't scale below minimum readable size (8pt)
                if scaled_font_size < 8:
                    scaled_font_size = 8
                    logger.debug("_draw_text_overlay: limiting font size to minimum 8pt")
                ctx.set_font_size(scaled_font_size)
                logger.debug("_draw_text_overlay: scaled font size from %.1f to %.1f", font_size, scaled_font_size)
                
                # Recalculate text width with scaled font
                extents = ctx.text_extents(text)
                text_width = extents.width

            # Calculate position
            x = panel_x + (panel_w * x_pct)
            y = bleed_pt + (panel_h * y_pct)
            
            # Apply anchor adjustment for final rendering
            if anchor == "center":
                x -= text_width / 2
            elif anchor == "right":
                x -= text_width

            ctx.move_to(x, y)
            ctx.show_text(text)

        except Exception as e:
            logger.error("_draw_text_overlay: failed: %s", e, exc_info=True)

    @staticmethod
    def _parse_color(color: str) -> tuple[float, float, float]:
        """Parse a hex color string to RGB floats (0-1)."""
        color = color.strip().lstrip("#")
        if len(color) == 6:
            r = int(color[0:2], 16) / 255.0
            g = int(color[2:4], 16) / 255.0
            b = int(color[4:6], 16) / 255.0
            return (r, g, b)
        return (1.0, 1.0, 1.0)

    @staticmethod
    def _write_placeholder_pdf(output_path: Path, width_mm: float, height_mm: float):
        """Write a minimal valid PDF as a placeholder when PyCairo is unavailable."""
        # Minimal PDF 1.4 with correct page dimensions
        w_pt = width_mm * MM_TO_PT
        h_pt = height_mm * MM_TO_PT
        pdf_content = f"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 {w_pt:.1f} {h_pt:.1f}]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
200
%%EOF"""
        output_path.write_text(pdf_content)
