"""HTML-to-plain-text converter for the typesetting pipeline.

Converts Pandoc-generated HTML (from EPUB/DOCX normalization) into clean plain
text suitable for chapter detection and Typst rendering.

Key responsibilities:
- Strip all HTML/XML tags
- Preserve paragraph structure (double newlines between paragraphs)
- Preserve heading text (so chapter detector regex can find them)
- Remove Gutenberg boilerplate (pg-boilerplate sections)
- Remove SVG, script, style, and image elements entirely
- Decode HTML entities
- Collapse excessive whitespace
"""

import logging
import re
from html import unescape
from html.parser import HTMLParser
from io import StringIO

logger = logging.getLogger(__name__)

# Tags whose content should be completely removed (not just the tags)
REMOVE_CONTENT_TAGS = frozenset([
    "svg", "script", "style", "head", "nav", "figure",
])

# Block-level tags that should produce paragraph breaks
BLOCK_TAGS = frozenset([
    "p", "div", "section", "article", "blockquote",
    "li", "tr", "dt", "dd", "figcaption",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "pre", "hr", "br", "table",
])

# Heading tags — we want their text on its own line
HEADING_TAGS = frozenset(["h1", "h2", "h3", "h4", "h5", "h6"])


class _HTMLToTextParser(HTMLParser):
    """Custom HTML parser that extracts plain text with structural formatting."""

    def __init__(self):
        super().__init__()
        self._output = StringIO()
        self._skip_depth = 0  # When > 0, we're inside a tag whose content should be removed
        self._skip_tag_stack: list[str] = []
        self._in_pre = False
        self._last_was_block = False
        self._boilerplate_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        tag_lower = tag.lower()
        attrs_dict = dict(attrs)

        # Skip Gutenberg boilerplate sections
        classes = (attrs_dict.get("class") or "").lower()
        if "pg-boilerplate" in classes or "pgheader" in classes:
            self._boilerplate_depth += 1
            return

        if self._boilerplate_depth > 0:
            return

        # Skip content of certain tags entirely
        if tag_lower in REMOVE_CONTENT_TAGS:
            self._skip_depth += 1
            self._skip_tag_stack.append(tag_lower)
            return

        if self._skip_depth > 0:
            return

        # Track <pre> for whitespace preservation
        if tag_lower == "pre":
            self._in_pre = True

        # Block-level tags produce paragraph breaks
        if tag_lower in BLOCK_TAGS:
            self._write_block_break()

        # <br> produces a single newline
        if tag_lower == "br":
            self._output.write("\n")

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()

        # Handle boilerplate section end
        if self._boilerplate_depth > 0:
            # We can't perfectly track which end tag closes the boilerplate
            # since HTML can be messy, but we decrement on any section/div end
            if tag_lower in ("section", "div"):
                self._boilerplate_depth -= 1
            return

        # Handle skip-content tags
        if self._skip_depth > 0:
            if self._skip_tag_stack and self._skip_tag_stack[-1] == tag_lower:
                self._skip_tag_stack.pop()
                self._skip_depth -= 1
            return

        if tag_lower == "pre":
            self._in_pre = False

        # Block-level end tags produce paragraph breaks
        if tag_lower in BLOCK_TAGS:
            self._write_block_break()

    def handle_data(self, data: str):
        if self._skip_depth > 0 or self._boilerplate_depth > 0:
            return

        if self._in_pre:
            self._output.write(data)
        else:
            self._output.write(data)
        self._last_was_block = False

    def handle_entityref(self, name: str):
        if self._skip_depth > 0 or self._boilerplate_depth > 0:
            return
        char = unescape(f"&{name};")
        self._output.write(char)

    def handle_charref(self, name: str):
        if self._skip_depth > 0 or self._boilerplate_depth > 0:
            return
        char = unescape(f"&#{name};")
        self._output.write(char)

    def _write_block_break(self):
        if not self._last_was_block:
            self._output.write("\n\n")
            self._last_was_block = True

    def get_text(self) -> str:
        return self._output.getvalue()


def html_to_text(html_content: str) -> str:
    """Convert HTML content to clean plain text for typesetting.

    Args:
        html_content: Raw HTML string (typically from Pandoc normalization).

    Returns:
        Clean plain text with paragraph breaks preserved and all markup removed.
    """
    logger.info("html_to_text: input length=%d chars", len(html_content))

    if not html_content or not html_content.strip():
        logger.warning("html_to_text: empty input")
        return ""

    # Quick check: if there are no HTML tags at all, return as-is
    if "<" not in html_content:
        logger.info("html_to_text: no HTML tags detected, returning as-is")
        return html_content

    # Pre-processing: remove the Gutenberg START/END markers
    html_content = _remove_gutenberg_markers(html_content)

    # Parse HTML and extract text
    parser = _HTMLToTextParser()
    try:
        parser.feed(html_content)
    except Exception as e:
        logger.error("html_to_text: parser error: %s, falling back to regex strip", e)
        return _fallback_strip_tags(html_content)

    text = parser.get_text()

    # Post-processing: clean up whitespace
    text = _clean_whitespace(text)

    # Decode any remaining HTML entities
    text = unescape(text)

    logger.info("html_to_text: output length=%d chars", len(text))
    return text


def _remove_gutenberg_markers(html: str) -> str:
    """Remove Project Gutenberg START/END marker sections."""
    # Remove "START OF THE PROJECT GUTENBERG EBOOK" markers
    html = re.sub(
        r"<[^>]*>\s*START OF THE PROJECT GUTENBERG EBOOK[^<]*</[^>]*>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    # Remove "END OF THE PROJECT GUTENBERG EBOOK" markers
    html = re.sub(
        r"<[^>]*>\s*END OF THE PROJECT GUTENBERG EBOOK[^<]*</[^>]*>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    return html


def _clean_whitespace(text: str) -> str:
    """Normalize whitespace in the extracted text.

    - Collapse runs of 3+ newlines to exactly 2 (paragraph break)
    - Collapse multiple spaces/tabs on a single line to one space
    - Strip trailing whitespace from each line
    - Strip leading/trailing whitespace from the whole text
    """
    # Collapse horizontal whitespace (but not newlines) to single space
    text = re.sub(r"[^\S\n]+", " ", text)

    # Strip trailing spaces from each line
    text = re.sub(r" +\n", "\n", text)

    # Collapse 3+ consecutive newlines to exactly 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip leading/trailing whitespace
    text = text.strip()

    return text


def _fallback_strip_tags(html: str) -> str:
    """Fallback: strip HTML tags using regex when the parser fails.

    This is less accurate but ensures we never pass raw HTML to the typesetter.
    """
    logger.warning("_fallback_strip_tags: using regex fallback for HTML stripping")
    # Remove script/style/svg content
    text = re.sub(r"<(script|style|svg)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    # Replace block tags with newlines
    text = re.sub(r"</(p|div|h[1-6]|li|tr|section|article)>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode entities
    text = unescape(text)
    # Clean whitespace
    text = _clean_whitespace(text)
    return text
