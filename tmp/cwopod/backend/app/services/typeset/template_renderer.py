"""Typst template renderer: assembles full book source from chapters and metadata."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from app.services.typeset.chapter_detector import Chapter
from app.services.typeset.provider_specs import ProviderSpec

if TYPE_CHECKING:
    from app.models.illustration import Illustration

logger = logging.getLogger(__name__)


@dataclass
class BookMetadata:
    title: str = "Untitled"
    author: str = "Unknown"
    source_name: str | None = None
    source_url: str | None = None
    original_publisher: str | None = None
    publication_year: str | None = None
    edition: str | None = None
    license_text: str | None = None
    app_url: str = ""
    dedication_text: str | None = None
    dedication_image_path: Path | None = None


@dataclass
class TypesetAssets:
    info_qr_path: Path | None = None
    attribution_qr_path: Path | None = None
    image_paths: list[Path] = field(default_factory=list)


class TemplateRenderer:
    """Renders parameterized Typst source for book interior."""

    def render_full(
        self,
        chapters: list[Chapter],
        metadata: BookMetadata,
        provider_spec: ProviderSpec,
        assets: TypesetAssets,
        font_size: str = "11pt",
        illustrations: list[Illustration] | None = None,
        body_font: str | None = None,
        heading_font: str | None = None,
        heading_size: str | None = None,
        dropcap_enabled: bool = False,
        dropcap_font: str | None = None,
        dropcap_lines: int = 3,
        dropcap_color: str = "#000000",
        dropcap_weight: str = "normal",
        dropcap_style: str = "normal",
        dropcap_padding: float = 4.0,
    ) -> str:
        """Render the complete Typst source.

        Args:
            chapters: List of chapters to render.
            metadata: Book metadata (title, author, etc.).
            provider_spec: Print provider trim/margin spec.
            assets: QR codes and other asset paths.
            font_size: Base font size for body text.
            illustrations: Optional list of Illustration model instances.
                Only locked illustrations are emitted into the Typst source.
            body_font: Font family for body text (default: Libertinus Serif).
            heading_font: Font family for chapter headings (default: body_font).
            heading_size: Font size for chapter headings (default: 16pt).
            dropcap_enabled: Whether to enable drop caps for chapter openings.
            dropcap_font: Font family for drop caps (default: body_font).
            dropcap_lines: Number of lines the drop cap spans (2-10).
            dropcap_color: Color of the drop cap (hex format).
            dropcap_weight: Weight of the drop cap (normal/bold).
            dropcap_style: Style of the drop cap (normal/italic).
            dropcap_padding: Padding between drop cap and body text (points).
        """
        logger.info(
            "render_full: title=%s, author=%s, chapters=%d, font_size=%s, illustrations=%d, "
            "body_font=%s, heading_font=%s, heading_size=%s, dropcap_enabled=%s",
            metadata.title, metadata.author, len(chapters), font_size,
            len(illustrations) if illustrations else 0, body_font, heading_font, heading_size,
            dropcap_enabled,
        )
        logger.debug("render_full: info_qr_path=%s, attribution_qr_path=%s", assets.info_qr_path, assets.attribution_qr_path)
        parts = [
            self._render_document_setup(provider_spec, font_size, body_font, heading_font, heading_size),
            self._render_front_matter(metadata, assets, chapters),
            self._render_body(chapters, metadata, illustrations=illustrations, dropcap_enabled=dropcap_enabled,
                             dropcap_font=dropcap_font, dropcap_lines=dropcap_lines, dropcap_color=dropcap_color,
                             dropcap_weight=dropcap_weight, dropcap_style=dropcap_style, dropcap_padding=dropcap_padding,
                             body_font=body_font),
            self._render_back_matter(metadata, assets),
        ]
        result = "\n\n".join(parts)
        logger.info("render_full: complete, output length=%d chars", len(result))
        return result

    def _render_document_setup(self, spec: ProviderSpec, font_size: str = "11pt", body_font: str | None = None, heading_font: str | None = None, heading_size: str | None = None) -> str:
        # Default to Libertinus Serif if no body font specified
        body_font_name = body_font if body_font else "Libertinus Serif"
        # Default heading font to body font if not specified
        heading_font_name = heading_font if heading_font else body_font_name
        # Default heading size to 16pt if not specified
        heading_size_value = heading_size if heading_size else "16pt"

        return f"""// === Document Setup ===
#set page(
  width: {spec.trim_width}in,
  height: {spec.trim_height}in,
  margin: (
    top: {spec.margin_top}in,
    bottom: {spec.margin_bottom}in,
    outside: {spec.margin_outer}in,
    inside: {spec.gutter}in,
  ),
)
#set text(font: "{body_font_name}", size: {font_size})
#set par(justify: true, leading: 0.65em)
#set heading(numbering: none)
#show heading: set text(font: "{heading_font_name}", size: {heading_size_value})"""

    def _render_front_matter(self, metadata: BookMetadata, assets: TypesetAssets, chapters: list[Chapter]) -> str:
        title_escaped = self._escape_typst(metadata.title)
        author_escaped = self._escape_typst(metadata.author)

        parts = [
            "// === Front Matter ===",
            '#set page(numbering: "i")',
            "",
            "// Half-title page",
            "#page[",
            "  #v(1fr)",
            f'  #align(center, text(size: 24pt, weight: "bold")[{title_escaped}])',
            "  #v(1fr)",
            "]",
            "",
            "// Blank verso",
            "#pagebreak()",
            "#page[]",
            "",
            "// Title page",
            "#page[",
            "  #v(1fr)",
            f'  #align(center, text(size: 28pt, weight: "bold")[{title_escaped}])',
            "  #v(0.5em)",
            f"  #align(center, text(size: 16pt)[{author_escaped}])",
            "  #v(1fr)",
            "]",
            "",
        ]

        # Presentation inscription page (optional — user-customizable gift message or image)
        if metadata.dedication_image_path and metadata.dedication_image_path.exists():
            logger.info("_render_front_matter: including presentation inscription image, path=%s", metadata.dedication_image_path.name)
            parts.extend([
                "// Presentation inscription page (image)",
                "#page[",
                "  #v(1fr)",
                f'  #align(center)[#image("{metadata.dedication_image_path.name}", width: 80%)]',
                "  #v(1fr)",
                "]",
                "",
            ])
        elif metadata.dedication_text:
            logger.info("_render_front_matter: including presentation inscription text, length=%d", len(metadata.dedication_text))
            dedication_content = self._render_dedication_text(metadata.dedication_text)
            parts.extend([
                "// Presentation inscription page (text)",
                "#page[",
                "  #v(1fr)",
                "  #align(center)[",
                dedication_content,
                "  ]",
                "  #v(1fr)",
                "]",
                "",
            ])

        parts.extend([
            "// Copyright page",
            "#page[",
            f"  #text(size: 9pt)[This edition produced by CWOPOD (Open Print-On-Demand).]",
            "]",
        ])

        # Info page with QR
        if assets.info_qr_path and metadata.app_url:
            logger.debug("_render_front_matter: including info QR, filename=%s", assets.info_qr_path.name)
            parts.extend([
                "",
                "// Info Page",
                '#pagebreak(to: "odd")',
                "#page[",
                '  #align(center)[#text(size: 14pt, weight: "bold")[About This Edition]]',
                "  #v(1em)",
                "  #align(center)[This book was produced using CWOPOD (Open Print-On-Demand).]",
                "  #v(1em)",
                f'  #align(center)[#link("{metadata.app_url}")[{metadata.app_url}]]',
                "  #v(1em)",
                f'  #align(center)[#image("{assets.info_qr_path.name}", width: 2cm)]',
                "]",
            ])

        # Table of Contents (only if more than one chapter)
        if len(chapters) > 1:
            logger.info("_render_front_matter: generating TOC for %d chapters", len(chapters))
            parts.extend([
                "",
                "// Table of Contents",
                '#pagebreak(to: "odd")',
                '#align(center)[#text(size: 18pt, weight: "bold")[Contents]]',
                "#v(1em)",
                "#outline(title: none, indent: 1em)",
            ])
        else:
            logger.debug("_render_front_matter: skipping TOC (single chapter)")

        return "\n".join(parts)

    def _render_body(self, chapters: list[Chapter], metadata: BookMetadata, illustrations: list[Illustration] | None = None, dropcap_enabled: bool = False, dropcap_font: str | None = None, dropcap_lines: int = 3, dropcap_color: str = "#000000", dropcap_weight: str = "normal", dropcap_style: str = "normal", dropcap_padding: float = 4.0, body_font: str | None = None) -> str:
        title_escaped = self._escape_typst(metadata.title)

        # Filter to only locked illustrations and sort by page number
        locked_illustrations = self._get_locked_illustrations(illustrations)
        logger.debug(
            "_render_body: total illustrations=%d, locked=%d",
            len(illustrations) if illustrations else 0,
            len(locked_illustrations),
        )

        parts = [
            "// === Body ===",
            '#set page(numbering: "1")',
            "#counter(page).update(1)",
            "",
            "// Chapter heading spacing: drop from top, generous space below before body text",
            "// The = heading is used for TOC entries but hidden visually;",
            "// the actual display is handled by the custom chapter block below it.",
            "#show heading.where(level: 1): it => {",
            "  // Invisible heading — only exists for outline/TOC registration",
            "  hide(it)",
            "}",
            "",
            "// Running headers",
            "#set page(",
            "  header: context {",
            "    let page-num = counter(page).get().first()",
            "    if calc.odd(page-num) {",
            '      align(right, emph[])  // Chapter title set per chapter',
            "    } else {",
            f"      align(left, emph[{title_escaped}])",
            "    }",
            "  },",
            "  footer: context {",
            "    align(center)[#counter(page).display()]",
            "  },",
            ")",
        ]

        for chapter in chapters:
            # Render chapter heading as two lines (if both exist):
            #   CHAPTER II          ← number_label from source (roman, arabic, or "Chapter N")
            #   Matthew Cuthbert Is Surprised   ← title
            # Preserves the original numbering style from the source text.
            chapter_label = self._escape_typst(chapter.number_label) if chapter.number_label else ""
            chapter_title = self._escape_typst(chapter.title) if chapter.title else ""
            content = self._escape_typst(chapter.content)

            # TOC entry: combine number label and title so the outline shows both.
            # e.g. "CHAPTER I — BEAUTIFUL AS THE DAY"
            # Fall back gracefully when one or both are missing.
            if chapter_label and chapter_title:
                toc_title = f"{chapter_label} — {chapter_title}"
            elif chapter_label:
                toc_title = chapter_label
            elif chapter_title:
                toc_title = chapter_title
            else:
                toc_title = f"Chapter {chapter.number}"
            logger.debug(
                "_render_body: chapter %d toc_title=%r (label=%r, title=%r)",
                chapter.number, toc_title, chapter_label, chapter_title,
            )

            # Add drop cap if enabled and chapter has content
            if dropcap_enabled and chapter.content.strip():
                # Get the first letter of the chapter content
                first_char = self._get_first_letter(chapter.content)
                if first_char:
                    # Default drop cap font to body font if not specified
                    dropcap_font_name = dropcap_font if dropcap_font else (body_font if body_font else "Libertinus Serif")
                    # Convert padding from points to em (approx 1pt = 0.083em)
                    padding_em = dropcap_padding * 0.083
                    # Build drop cap style string
                    dropcap_style_str = f'color: {dropcap_color}, weight: "{dropcap_weight}", font: "{dropcap_font_name}"'
                    if dropcap_style == "italic":
                        dropcap_style_str += ', style: "italic"'
                    parts.extend([
                        "",
                        f"// Drop cap for chapter {chapter.number}",
                        f'#dropcap("{first_char}", lines: {dropcap_lines}, {dropcap_style_str}, padding: {padding_em}em)',
                    ])

            parts.extend([
                "",
                f"// Chapter {chapter.number}",
                '#pagebreak(to: "odd")',
                f"= {toc_title}",
            ])
            if chapter_label:
                parts.extend([
                    "#v(2em)",
                    f'#align(center, text(size: 11pt, tracking: 0.1em, weight: "regular")[#upper[{chapter_label}]])',
                ])
            if chapter_title:
                # Tight gap between label and title; if no label, drop 2em from top
                spacing = "#v(0.5em)" if chapter_label else "#v(2em)"
                parts.extend([
                    spacing,
                    f'#align(center, text(size: 16pt, weight: "bold")[{chapter_title}])',
                    "#v(2em)",  # 2em gap after the title, before body text
                ])
            elif chapter_label:
                # Label only (no title) — 2em gap after the label
                parts.append("#v(2em)")
            else:
                # Neither label nor title — just the drop space
                parts.append("#v(2em)")
            # Only add the pre-body gap when there's no title — the title block
            # already emits #v(2em) after itself.
            if not chapter_title:
                parts.append("#v(1.5em)")
            parts.extend([
                "",
                content,
            ])

            # Emit inline illustrations targeted at this chapter's pages
            chapter_inline = [
                ill for ill in locked_illustrations
                if ill.placement_mode and ill.placement_mode.value == "inline"
                and ill.page_number is not None
            ]
            if chapter_inline:
                for ill in chapter_inline:
                    parts.append(self._render_inline_illustration(ill))

        # Emit full_page and plate illustrations after body text
        # These are page-level insertions sorted by page number
        page_level_illustrations = [
            ill for ill in locked_illustrations
            if ill.placement_mode and ill.placement_mode.value in ("full_page", "plate")
        ]
        if page_level_illustrations:
            parts.append("")
            parts.append("// === Illustrations (full page and plate) ===")
            for ill in page_level_illustrations:
                if ill.placement_mode.value == "full_page":
                    parts.append(self._render_full_page_illustration(ill))
                elif ill.placement_mode.value == "plate":
                    parts.append(self._render_plate_illustration(ill))

        return "\n".join(parts)

    def _get_locked_illustrations(self, illustrations: list[Illustration] | None) -> list[Illustration]:
        """Filter and sort illustrations to only locked ones, ordered by page number.

        Args:
            illustrations: Full list of illustration model instances (or None).

        Returns:
            List of locked illustrations sorted by page_number (nulls last).
        """
        if not illustrations:
            logger.debug("_get_locked_illustrations: no illustrations provided, returning empty list")
            return []

        locked = [ill for ill in illustrations if ill.lock_state]
        # Sort by page_number; illustrations without a page number go last
        locked.sort(key=lambda ill: ill.page_number if ill.page_number is not None else float("inf"))
        logger.debug(
            "_get_locked_illustrations: filtered %d total → %d locked illustrations",
            len(illustrations), len(locked),
        )
        return locked

    def _render_illustrations(self, illustrations: list[Illustration] | None) -> str:
        """Generate Typst markup for all locked illustrations.

        This is a convenience method that renders all locked illustrations
        into a single Typst markup string. Used for testing and standalone rendering.

        Args:
            illustrations: List of Illustration model instances.

        Returns:
            Typst markup string for all locked illustrations.
        """
        logger.info(
            "_render_illustrations: rendering illustrations, count=%d",
            len(illustrations) if illustrations else 0,
        )
        locked = self._get_locked_illustrations(illustrations)
        if not locked:
            logger.debug("_render_illustrations: no locked illustrations to render")
            return ""

        parts = []
        for ill in locked:
            if not ill.placement_mode:
                logger.debug(
                    "_render_illustrations: skipping illustration %s — no placement_mode",
                    ill.image_uuid,
                )
                continue

            mode = ill.placement_mode.value if hasattr(ill.placement_mode, "value") else ill.placement_mode
            if mode == "full_page":
                parts.append(self._render_full_page_illustration(ill))
            elif mode == "plate":
                parts.append(self._render_plate_illustration(ill))
            elif mode == "inline":
                parts.append(self._render_inline_illustration(ill))
            else:
                logger.warning(
                    "_render_illustrations: unknown placement_mode=%s for image_uuid=%s",
                    mode, ill.image_uuid,
                )

        result = "\n".join(parts)
        logger.info("_render_illustrations: complete, output length=%d chars", len(result))
        return result

    def _render_full_page_illustration(self, ill: Illustration) -> str:
        """Emit Typst markup for a full-page illustration.

        Emits a #pagebreak() followed by a #page block containing only the image.
        The image path is relative to the project storage directory.

        Args:
            ill: Illustration model instance with placement_mode='full_page'.

        Returns:
            Typst markup string for the full-page illustration.
        """
        image_path = f"images/{ill.image_uuid}.{ill.file_ext}"
        logger.debug(
            "_render_full_page_illustration: image_uuid=%s, file_ext=%s, "
            "page_number=%s, layout=%s, path=%s",
            ill.image_uuid, ill.file_ext, ill.page_number,
            ill.layout, image_path,
        )

        # Determine width/height based on layout mode
        layout_value = ill.layout.value if ill.layout and hasattr(ill.layout, "value") else (ill.layout or "margins")
        if layout_value == "edges":
            # Push to edges: image fills the full page (100%)
            size_param = "width: 100%, height: 100%"
        else:
            # Stay in margins: image fits within the text area
            size_param = "width: 100%"

        markup = (
            f'\n// Full-page illustration: {ill.image_uuid}\n'
            f'#pagebreak()\n'
            f'#page[\n'
            f'  #align(center + horizon)[\n'
            f'    #image("{image_path}", {size_param})\n'
            f'  ]\n'
            f']'
        )
        logger.debug(
            "_render_full_page_illustration: emitted markup for image_uuid=%s, length=%d",
            ill.image_uuid, len(markup),
        )
        return markup

    def _render_plate_illustration(self, ill: Illustration) -> str:
        """Emit Typst markup for a plate illustration (new sheet: image page + blank page).

        The side field determines whether the image appears on the left or right
        page of the inserted sheet. The opposite page is blank.

        Args:
            ill: Illustration model instance with placement_mode='plate'.

        Returns:
            Typst markup string for the plate illustration (two pages).
        """
        image_path = f"images/{ill.image_uuid}.{ill.file_ext}"
        side_value = ill.side.value if ill.side and hasattr(ill.side, "value") else (ill.side or "right")
        layout_value = ill.layout.value if ill.layout and hasattr(ill.layout, "value") else (ill.layout or "margins")

        logger.debug(
            "_render_plate_illustration: image_uuid=%s, file_ext=%s, "
            "page_number=%s, side=%s, layout=%s, path=%s",
            ill.image_uuid, ill.file_ext, ill.page_number,
            side_value, layout_value, image_path,
        )

        if layout_value == "edges":
            size_param = "width: 100%, height: 100%"
        else:
            size_param = "width: 100%"

        image_page = (
            f'#page[\n'
            f'  #align(center + horizon)[\n'
            f'    #image("{image_path}", {size_param})\n'
            f'  ]\n'
            f']'
        )
        blank_page = "#page[]"

        if side_value == "left":
            # Image on left page, blank on right
            markup = (
                f'\n// Plate illustration (left): {ill.image_uuid}\n'
                f'#pagebreak()\n'
                f'{image_page}\n'
                f'{blank_page}'
            )
        else:
            # Blank on left, image on right
            markup = (
                f'\n// Plate illustration (right): {ill.image_uuid}\n'
                f'#pagebreak()\n'
                f'{blank_page}\n'
                f'{image_page}'
            )

        logger.debug(
            "_render_plate_illustration: emitted markup for image_uuid=%s, side=%s, length=%d",
            ill.image_uuid, side_value, len(markup),
        )
        return markup

    def _render_inline_illustration(self, ill: Illustration) -> str:
        """Emit Typst markup for an inline illustration.

        The image is placed at the configured position in the text flow
        with the specified height. Typst handles text flowing above and below.

        Args:
            ill: Illustration model instance with placement_mode='inline'.

        Returns:
            Typst markup string for the inline illustration.
        """
        image_path = f"images/{ill.image_uuid}.{ill.file_ext}"
        # Height for inline is in lines; convert to em (each line ≈ 1.65em with leading)
        height_value = ill.height if ill.height else 8.0
        # Express height in em units (line height = 1em + 0.65em leading = 1.65em per line)
        height_em = height_value * 1.65

        logger.debug(
            "_render_inline_illustration: image_uuid=%s, file_ext=%s, "
            "page_number=%s, position_x=%s, position_y=%s, height=%s lines (%.2fem), path=%s",
            ill.image_uuid, ill.file_ext, ill.page_number,
            ill.position_x, ill.position_y, height_value, height_em, image_path,
        )

        markup = (
            f'\n// Inline illustration: {ill.image_uuid}\n'
            f'#align(center)[\n'
            f'  #image("{image_path}", height: {height_em:.2f}em)\n'
            f']'
        )
        logger.debug(
            "_render_inline_illustration: emitted markup for image_uuid=%s, length=%d",
            ill.image_uuid, len(markup),
        )
        return markup

    def _render_back_matter(self, metadata: BookMetadata, assets: TypesetAssets) -> str:
        parts = [
            "// === Back Matter ===",
            '#pagebreak(to: "odd")',
            "= Attribution",
            "",
        ]

        if metadata.source_name:
            parts.append(f"*Source:* {self._escape_typst(metadata.source_name)}")
        if metadata.source_url:
            parts.append(f'*URL:* #link("{metadata.source_url}")[{metadata.source_url}]')
        if metadata.original_publisher:
            parts.append(f"*Original Publisher:* {self._escape_typst(metadata.original_publisher)}")
        if metadata.publication_year:
            parts.append(f"*Publication Year:* {metadata.publication_year}")
        if metadata.edition:
            parts.append(f"*Edition:* {self._escape_typst(metadata.edition)}")

        if assets.attribution_qr_path:
            logger.debug("_render_back_matter: including attribution QR, filename=%s", assets.attribution_qr_path.name)
            parts.extend([
                "",
                f'#align(center)[#image("{assets.attribution_qr_path.name}", width: 2cm)]',
            ])

        if metadata.license_text:
            parts.extend([
                "",
                "#pagebreak()",
                "= License",
                "",
                self._escape_typst(metadata.license_text),
            ])

        return "\n".join(parts)

    def _render_dedication_text(self, text: str) -> str:
        """Convert markdown presentation inscription text to Typst markup.

        Supports:
        - **bold** → #strong[...]
        - *italic* → #emph[...]
        - Line breaks preserved
        - Text is centered and rendered at a slightly larger size
        """
        import re
        logger.debug("_render_dedication_text: converting markdown text, length=%d", len(text))

        lines = text.strip().split("\n")
        typst_lines = []

        for line in lines:
            if not line.strip():
                typst_lines.append("    #v(0.5em)")
                continue

            # Process the line to convert markdown to Typst markup
            processed = self._convert_markdown_to_typst(line.strip())
            typst_lines.append(f"    #text(size: 14pt)[{processed}]")

        return "\n".join(typst_lines)

    def _convert_markdown_to_typst(self, text: str) -> str:
        """Convert inline markdown to Typst markup.
        
        Handles:
        - **bold** → #strong[...]
        - _italic_ → #emph[...]
        - Escapes special Typst characters
        """
        import re
        
        # First, escape all special Typst characters except markdown markers
        # We'll handle markdown markers after escaping
        text = text.replace('\\', '\\\\')
        text = text.replace('#', '\\#')
        text = text.replace('$', '\\$')
        text = text.replace('@', '\\@')
        text = text.replace('<', '\\<')
        text = text.replace('>', '\\>')
        text = text.replace('*', '\\*')
        text = text.replace('`', '\\`')
        text = text.replace('~', '\\~')
        
        # Convert **bold** to #strong[...]
        text = re.sub(r'\*\*([^*]+?)\*\*', r'#strong[\1]', text)
        
        # Convert _italic_ to #emph[...]
        text = re.sub(r'_([^_]+?)_', r'#emph[\1]', text)
        
        return text

    def _escape_typst(self, text: str) -> str:
        """Escape special Typst characters."""
        if not text:
            return ""
        # Escape characters that have special meaning in Typst
        replacements = [
            ("\\", "\\\\"),
            ("#", "\\#"),
            ("$", "\\$"),
            ("@", "\\@"),
            ("<", "\\<"),
            (">", "\\>"),
            ("*", "\\*"),
            ("_", "\\_"),
            ("`", "\\`"),
            ("~", "\\~"),
        ]
        for old, new in replacements:
            text = text.replace(old, new)
        return text

    def _get_first_letter(self, text: str) -> str | None:
        """Extract the first letter from chapter content, skipping leading non-letter characters.

        Args:
            text: The chapter content string.

        Returns:
            The first letter found, or None if no letters are present.
        """
        if not text:
            return None
        for char in text:
            if char.isalpha():
                return char
        return None
