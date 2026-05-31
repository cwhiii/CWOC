"""Typo scanner: chunks text by chapter and sends to AI Engine for typo detection.

Strategy:
1. Detect chapters using the typeset ChapterDetector
2. Each chapter becomes one chunk (one AI call)
3. If a chapter exceeds MAX_CHAPTER_WORDS, split it into smaller sub-chunks
4. Sub-chunks split on paragraph boundaries with overlap for context
"""

import json
from dataclasses import dataclass

MAX_CHAPTER_WORDS = 3000  # Max words per AI call — keeps context window manageable
SUB_CHUNK_SIZE = 2000  # Words per sub-chunk when a chapter is too big
SUB_CHUNK_OVERLAP = 100  # Overlap words between sub-chunks


@dataclass
class TextChunk:
    text: str
    start_position: int
    end_position: int
    chapter_number: int
    chunk_index: int  # 0 if whole chapter, 1+ if sub-chunked
    chapter_title: str


def chunk_by_chapters(
    text: str,
    epub_nav: list[dict] | None = None,
    max_chapter_words: int = MAX_CHAPTER_WORDS,
) -> list[TextChunk]:
    """Split text into chunks based on chapter boundaries.

    Uses the ChapterDetector to find chapters first. Each chapter that fits
    within max_chapter_words becomes a single chunk. Chapters that exceed
    the limit are split into smaller sub-chunks on paragraph boundaries.

    Args:
        text: Full book text.
        epub_nav: Optional EPUB navigation entries for chapter detection.
        max_chapter_words: Maximum words per chunk before sub-chunking.

    Returns:
        List of TextChunk objects ready for AI processing.
    """
    if not text.strip():
        return []

    from app.services.typeset.chapter_detector import ChapterDetector

    detector = ChapterDetector()
    chapters = detector.detect(text, epub_nav)

    chunks: list[TextChunk] = []

    for chapter in chapters:
        chapter_words = chapter.content.split()
        chapter_start = chapter.start_position

        if len(chapter_words) <= max_chapter_words:
            # Chapter fits in one call — use it as-is
            chunks.append(
                TextChunk(
                    text=chapter.content,
                    start_position=chapter_start,
                    end_position=chapter_start + len(chapter.content),
                    chapter_number=chapter.number,
                    chunk_index=0,
                    chapter_title=chapter.title or f"Chapter {chapter.number}",
                )
            )
        else:
            # Chapter too big — split into sub-chunks on paragraph boundaries
            sub_chunks = _split_large_chapter(
                chapter.content, chapter_start, chapter.number, chapter.title
            )
            chunks.extend(sub_chunks)

    return chunks


def _split_large_chapter(
    content: str,
    chapter_start: int,
    chapter_number: int,
    chapter_title: str,
) -> list[TextChunk]:
    """Split a large chapter into sub-chunks, preferring paragraph boundaries.

    Tries to split on double-newlines (paragraph breaks). Falls back to
    word-based splitting if paragraphs are too large.
    """
    paragraphs = content.split("\n\n")
    chunks: list[TextChunk] = []
    current_text = ""
    current_start = chapter_start
    chunk_idx = 1

    for para in paragraphs:
        para_stripped = para.strip()
        if not para_stripped:
            continue

        # Would adding this paragraph exceed the limit?
        combined = (current_text + "\n\n" + para_stripped).strip() if current_text else para_stripped
        combined_words = len(combined.split())

        if combined_words <= SUB_CHUNK_SIZE:
            current_text = combined
        else:
            # Flush current chunk if it has content
            if current_text:
                chunks.append(
                    TextChunk(
                        text=current_text,
                        start_position=current_start,
                        end_position=current_start + len(current_text),
                        chapter_number=chapter_number,
                        chunk_index=chunk_idx,
                        chapter_title=chapter_title,
                    )
                )
                chunk_idx += 1
                current_start = current_start + len(current_text) + 2  # +2 for \n\n

            # If this single paragraph is itself too big, split by words
            if len(para_stripped.split()) > SUB_CHUNK_SIZE:
                word_chunks = _split_by_words(
                    para_stripped, current_start, chapter_number, chapter_title, chunk_idx
                )
                chunks.extend(word_chunks)
                chunk_idx += len(word_chunks)
                current_start += len(para_stripped) + 2
                current_text = ""
            else:
                current_text = para_stripped

    # Flush remaining
    if current_text.strip():
        chunks.append(
            TextChunk(
                text=current_text,
                start_position=current_start,
                end_position=current_start + len(current_text),
                chapter_number=chapter_number,
                chunk_index=chunk_idx,
                chapter_title=chapter_title,
            )
        )

    return chunks


def _split_by_words(
    text: str,
    start_pos: int,
    chapter_number: int,
    chapter_title: str,
    start_chunk_idx: int,
) -> list[TextChunk]:
    """Last resort: split a massive paragraph by word count with overlap."""
    words = text.split()
    chunks: list[TextChunk] = []
    word_index = 0
    chunk_idx = start_chunk_idx

    while word_index < len(words):
        chunk_words = words[word_index : word_index + SUB_CHUNK_SIZE]
        chunk_text_str = " ".join(chunk_words)

        # Approximate character position
        char_offset = len(" ".join(words[:word_index])) + (1 if word_index > 0 else 0)

        chunks.append(
            TextChunk(
                text=chunk_text_str,
                start_position=start_pos + char_offset,
                end_position=start_pos + char_offset + len(chunk_text_str),
                chapter_number=chapter_number,
                chunk_index=chunk_idx,
                chapter_title=chapter_title,
            )
        )

        word_index += SUB_CHUNK_SIZE - SUB_CHUNK_OVERLAP
        chunk_idx += 1

    return chunks


# --- Legacy function kept for backward compatibility -------------------------

def chunk_text(
    text: str, chunk_size: int = SUB_CHUNK_SIZE, overlap: int = SUB_CHUNK_OVERLAP
) -> list[TextChunk]:
    """Legacy word-based chunking. Prefer chunk_by_chapters() instead."""
    return chunk_by_chapters(text)


# --- Response parsing --------------------------------------------------------

def parse_ai_response(response: str, chunk_start_position: int) -> list[dict]:
    """Parse the AI Engine's JSON response into correction candidates.

    Converts position_in_chunk to absolute position in full text.
    Returns empty list if response is empty or unparseable.
    """
    if not response or not response.strip():
        return []

    # Try to extract JSON from the response
    text = response.strip()

    # Handle case where AI wraps in markdown code block
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else ""

    try:
        corrections = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array in the response
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            try:
                corrections = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return []
        else:
            return []

    if not isinstance(corrections, list):
        return []

    result = []
    for c in corrections:
        if not isinstance(c, dict):
            continue
        if "original" not in c or "suggested" not in c:
            continue

        position = c.get("position_in_chunk", 0)
        result.append(
            {
                "original_text": c["original"],
                "suggested_text": c["suggested"],
                "context_sentence": c.get("context", ""),
                "position": chunk_start_position + position,
            }
        )

    return result


def deduplicate_corrections(corrections: list[dict]) -> list[dict]:
    """Remove duplicate corrections from overlapping chunk regions."""
    if not corrections:
        return []

    seen = set()
    deduplicated = []

    for c in corrections:
        key = (c["original_text"], c["position"] // 50)  # Group by ~50 char proximity
        if key not in seen:
            seen.add(key)
            deduplicated.append(c)

    return deduplicated
