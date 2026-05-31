"""Chapter detector: identifies chapter boundaries via regex and EPUB nav."""

import re
from dataclasses import dataclass


@dataclass
class Chapter:
    number: int
    title: str
    heading: str
    content: str
    start_position: int
    number_label: str = ""  # Original number/numeral as it appeared in source (e.g. "II", "XIV", "3")


# Patterns ordered by specificity
CHAPTER_PATTERNS = [
    # "CHAPTER I — Title" or "CHAPTER 1 — Title"
    re.compile(
        r"^(?:CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*[—\-:\.]\s*(.+)$",
        re.MULTILINE,
    ),
    # "CHAPTER I" or "CHAPTER 1" (no title)
    re.compile(
        r"^(?:CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*$",
        re.MULTILINE,
    ),
    # Standalone roman numerals: "I.", "II.", "III."
    re.compile(r"^([IVXLCDM]+)\.\s*$", re.MULTILINE),
    # Standalone arabic numerals: "1.", "2.", "3."
    re.compile(r"^(\d+)\.\s*$", re.MULTILINE),
]


class ChapterDetector:
    """Detects chapter boundaries in book text."""

    def detect(self, text: str, epub_nav: list[dict] | None = None) -> list[Chapter]:
        """Detect chapters. Uses EPUB nav if available, else regex patterns."""
        import logging
        logger = logging.getLogger(__name__)

        if epub_nav:
            chapters = self._detect_from_epub_nav(text, epub_nav)
            if chapters:
                logger.info(
                    "ChapterDetector.detect: found %d chapters via EPUB nav", len(chapters)
                )
                # Log first few titles to help debug title issues
                for ch in chapters[:5]:
                    logger.info(
                        "ChapterDetector.detect: chapter %d title='%s'",
                        ch.number, ch.title,
                    )
                if len(chapters) > 5:
                    logger.info("ChapterDetector.detect: ... (%d more chapters)", len(chapters) - 5)
                return chapters

        chapters = self._detect_from_patterns(text)
        logger.info(
            "ChapterDetector.detect: found %d chapters via regex patterns", len(chapters)
        )
        return chapters

    def _detect_from_epub_nav(self, text: str, nav_entries: list[dict]) -> list[Chapter]:
        """Use EPUB navigation entries to split text into chapters."""
        if not nav_entries:
            return []

        chapters = []
        sorted_entries = sorted(nav_entries, key=lambda e: e.get("position", 0))

        # Detect duplicate titles — if most entries share the same title,
        # the EPUB nav is poorly formatted and we should use numbered fallbacks.
        raw_titles = [e.get("title", "") for e in sorted_entries]
        unique_titles = set(t for t in raw_titles if t)
        has_duplicate_titles = len(unique_titles) < len(sorted_entries) * 0.5

        for i, entry in enumerate(sorted_entries):
            start = entry.get("position", 0)
            end = sorted_entries[i + 1]["position"] if i + 1 < len(sorted_entries) else len(text)
            content = text[start:end].strip()

            raw_title = entry.get("title", "")
            # Try to extract number label and clean title from EPUB nav title
            number_label, clean_title = self._parse_epub_nav_title(raw_title, i + 1)

            # If titles are mostly duplicates, prefer "Chapter N" with the raw title as a suffix
            if has_duplicate_titles and raw_title:
                title = clean_title or f"Chapter {i + 1}"
                if not number_label:
                    number_label = f"Chapter {i + 1}"
            else:
                title = clean_title
                # If no number label was extracted, don't fabricate one
                # (the source may not use chapter numbers at all)

            chapters.append(
                Chapter(
                    number=i + 1,
                    title=title,
                    heading=entry.get("title", f"Chapter {i + 1}"),
                    content=content,
                    start_position=start,
                    number_label=number_label,
                )
            )

        # Filter out TOC entries that may have been picked up from EPUB nav
        chapters = self._filter_toc_entries(chapters)
        return chapters

    def _detect_from_patterns(self, text: str) -> list[Chapter]:
        """Use regex patterns to detect chapter headings."""
        import logging
        logger = logging.getLogger(__name__)

        for pattern in CHAPTER_PATTERNS:
            matches = list(pattern.finditer(text))
            if len(matches) >= 2:
                chapters = self._split_by_matches(text, matches, pattern)
                chapters = self._filter_toc_entries(chapters)
                if chapters:
                    logger.info(
                        "_detect_from_patterns: %d chapters after TOC filtering (pattern=%s)",
                        len(chapters), pattern.pattern[:40],
                    )
                    return chapters

        # No chapters detected — return entire text as one chapter
        logger.info("_detect_from_patterns: no chapters detected, returning entire text as one chapter")
        return [
            Chapter(
                number=1,
                title="",
                heading="",
                content=text,
                start_position=0,
            )
        ]

    def _filter_toc_entries(self, chapters: list[Chapter]) -> list[Chapter]:
        """Filter out table-of-contents entries that were detected as chapters.

        Many books (especially from Project Gutenberg) have a TOC section at the
        beginning that lists chapter headings. The regex detector picks these up
        as chapters with very little content between them. This method identifies
        and removes those near-empty TOC entries.

        Strategy: if the first N chapters have very short content (< 100 words)
        and are followed by chapters with substantial content, the short ones are
        TOC entries and should be removed.
        """
        import logging
        logger = logging.getLogger(__name__)

        if len(chapters) < 4:
            # Too few chapters to have a meaningful TOC pattern
            return chapters

        # Calculate word counts for each chapter
        word_counts = [len(ch.content.split()) for ch in chapters]

        # Find the boundary where chapters start having real content.
        # A TOC entry typically has < 100 words (just the next heading or nothing).
        # A real chapter typically has > 200 words.
        MIN_REAL_CHAPTER_WORDS = 100

        # Count how many leading chapters are "short" (likely TOC entries)
        short_prefix_count = 0
        for wc in word_counts:
            if wc < MIN_REAL_CHAPTER_WORDS:
                short_prefix_count += 1
            else:
                break

        if short_prefix_count == 0:
            # No TOC pattern detected
            return chapters

        # Verify that the remaining chapters have substantial content
        remaining = chapters[short_prefix_count:]
        if not remaining:
            # All chapters are short — don't filter, this might just be a short book
            logger.debug("_filter_toc_entries: all chapters are short, not filtering")
            return chapters

        remaining_word_counts = word_counts[short_prefix_count:]
        avg_remaining_words = sum(remaining_word_counts) / len(remaining_word_counts)

        # Only filter if the remaining chapters are substantially longer than the
        # short prefix (at least 5x longer on average)
        if avg_remaining_words > MIN_REAL_CHAPTER_WORDS * 5:
            logger.info(
                "_filter_toc_entries: removing %d TOC entries (avg %d words) "
                "before %d real chapters (avg %d words)",
                short_prefix_count,
                sum(word_counts[:short_prefix_count]) // max(short_prefix_count, 1),
                len(remaining),
                int(avg_remaining_words),
            )
            # Renumber the remaining chapters starting from 1
            for i, ch in enumerate(remaining):
                ch.number = i + 1
            return remaining

        logger.debug(
            "_filter_toc_entries: short prefix found (%d) but remaining avg (%d words) "
            "not substantially longer, keeping all chapters",
            short_prefix_count, int(avg_remaining_words),
        )
        return chapters

    def _split_by_matches(
        self, text: str, matches: list[re.Match], pattern: re.Pattern
    ) -> list[Chapter]:
        """Split text at match positions into Chapter objects."""
        chapters = []

        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)

            heading = match.group(0).strip()
            title = self._extract_title(match)
            number_label = self._extract_number_label(match)
            content = text[match.end() : end].strip()

            chapters.append(
                Chapter(
                    number=i + 1,
                    title=title,
                    heading=heading,
                    content=content,
                    start_position=start,
                    number_label=number_label,
                )
            )

        return chapters

    def _extract_number_label(self, match: re.Match) -> str:
        """Extract the original chapter number/numeral label from the regex match.

        Returns the full label line as it appeared in the source, e.g.:
        - "CHAPTER II" from "CHAPTER II. Matthew Cuthbert Is Surprised"
        - "CHAPTER XIV" from "CHAPTER XIV"
        - "III" from "III."
        - "3" from "3."
        """
        groups = match.groups()
        if not groups:
            return ""
        numeral = groups[0]  # The captured number/roman numeral
        full_heading = match.group(0).strip()

        # If the heading starts with "CHAPTER" or "Chapter", preserve that prefix with the numeral
        heading_upper = full_heading.upper()
        if heading_upper.startswith("CHAPTER"):
            # Preserve original case: extract the "CHAPTER"/"Chapter" prefix + numeral
            # Find where the numeral starts in the full heading
            prefix_match = re.match(r"^((?:CHAPTER|Chapter)\s+)", full_heading)
            if prefix_match:
                return f"{prefix_match.group(1)}{numeral}"
        # For standalone numerals (patterns 3 & 4), just return the numeral
        return numeral

    def _extract_title(self, match: re.Match) -> str:
        """Extract chapter title from regex match groups."""
        groups = match.groups()
        if len(groups) >= 2 and groups[1]:
            return groups[1].strip()
        elif len(groups) >= 1:
            return ""
        return ""

    def _parse_epub_nav_title(self, raw_title: str, fallback_number: int) -> tuple[str, str]:
        """Parse an EPUB nav title into (number_label, clean_title).

        Handles formats like:
        - "CHAPTER II. Matthew Cuthbert Is Surprised" → ("CHAPTER II", "Matthew Cuthbert Is Surprised")
        - "Chapter 3 — The Journey" → ("Chapter 3", "The Journey")
        - "Chapter XIV" → ("Chapter XIV", "")
        - "The Odd Couple" → ("", "The Odd Couple")  # no number, just a title
        - "III. The Storm" → ("III", "The Storm")
        - "3. The Storm" → ("3", "The Storm")
        """
        if not raw_title:
            return "", ""

        # Try "CHAPTER N. Title" or "Chapter N — Title" pattern
        m = re.match(
            r"^((?:CHAPTER|Chapter)\s+(?:[IVXLCDM]+|\d+))\s*[—\-:\.]\s*(.+)$",
            raw_title,
        )
        if m:
            return m.group(1), m.group(2).strip()

        # Try "CHAPTER N" or "Chapter N" with no title
        m = re.match(r"^((?:CHAPTER|Chapter)\s+(?:[IVXLCDM]+|\d+))\s*$", raw_title)
        if m:
            return m.group(1), ""

        # Try standalone numeral with title: "III. The Storm" or "3. The Storm"
        m = re.match(r"^([IVXLCDM]+|\d+)\s*[—\-:\.]\s*(.+)$", raw_title)
        if m:
            return m.group(1), m.group(2).strip()

        # Try standalone numeral only: "III" or "3"
        m = re.match(r"^([IVXLCDM]+|\d+)\s*$", raw_title)
        if m:
            return m.group(1), ""

        # No number pattern found — it's just a title (e.g., "The Odd Couple")
        return "", raw_title
