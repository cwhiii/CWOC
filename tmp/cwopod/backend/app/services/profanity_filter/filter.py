"""Profanity filter service: whole-word matching with █ replacement or silent stripping."""

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path to the default word list shipped with the source code
DEFAULT_WORD_LIST_PATH = Path(__file__).parent / "default_word_list.txt"


def load_default_word_list() -> str:
    """Load the default profanity word list from disk. Returns newline-separated string."""
    logger.debug("load_default_word_list: loading from %s", DEFAULT_WORD_LIST_PATH)
    try:
        text = DEFAULT_WORD_LIST_PATH.read_text(encoding="utf-8").strip()
        word_count = len([w for w in text.splitlines() if w.strip()])
        logger.info("load_default_word_list: loaded %d words", word_count)
        return text
    except FileNotFoundError:
        logger.error("load_default_word_list: file not found at %s", DEFAULT_WORD_LIST_PATH)
        return ""


def _build_regex(word_list_text: str) -> Optional[re.Pattern]:
    """Build a compiled regex from a newline-separated word list.

    Uses word boundaries for whole-word matching, case-insensitive.
    Supports multi-word phrases (matched as-is with word boundaries at edges).
    """
    logger.debug("_build_regex: building pattern from word list")
    words = [w.strip() for w in word_list_text.splitlines() if w.strip()]
    if not words:
        logger.warning("_build_regex: empty word list, returning None")
        return None

    # Sort by length descending so longer phrases match first
    words.sort(key=len, reverse=True)

    # Escape each word for regex safety, join with alternation
    escaped = [re.escape(w) for w in words]
    pattern_str = r"\b(" + "|".join(escaped) + r")\b"

    try:
        pattern = re.compile(pattern_str, re.IGNORECASE)
        logger.info("_build_regex: compiled pattern with %d entries", len(words))
        return pattern
    except re.error as e:
        logger.error("_build_regex: failed to compile regex: %s", e)
        return None


def censor_text(text: str, word_list_text: str) -> str:
    """Replace profanity in text with █ characters (one per character of matched word).

    Used for typeset output — the reader sees the redaction blocks.

    Args:
        text: The source text to censor.
        word_list_text: Newline-separated word list.

    Returns:
        Censored text with matched words replaced by █ blocks.
    """
    logger.debug("censor_text: input length=%d", len(text))
    pattern = _build_regex(word_list_text)
    if pattern is None:
        logger.debug("censor_text: no pattern, returning text unchanged")
        return text

    def replace_with_blocks(match: re.Match) -> str:
        return "█" * len(match.group(0))

    result = pattern.sub(replace_with_blocks, text)
    if result != text:
        # Count how many replacements were made
        diff_count = len(pattern.findall(text))
        logger.info("censor_text: replaced %d occurrences", diff_count)
    else:
        logger.debug("censor_text: no matches found")
    return result


def strip_profanity(text: str, word_list_text: str) -> str:
    """Silently remove profanity from text (for AI prompts/inputs).

    Removes the matched word and collapses extra whitespace.

    Args:
        text: The text to clean.
        word_list_text: Newline-separated word list.

    Returns:
        Text with profanity silently removed.
    """
    logger.debug("strip_profanity: input length=%d", len(text))
    pattern = _build_regex(word_list_text)
    if pattern is None:
        logger.debug("strip_profanity: no pattern, returning text unchanged")
        return text

    result = pattern.sub("", text)
    # Collapse multiple spaces into one
    result = re.sub(r"  +", " ", result).strip()

    if result != text:
        diff_count = len(pattern.findall(text))
        logger.info("strip_profanity: stripped %d occurrences", diff_count)
    else:
        logger.debug("strip_profanity: no matches found")
    return result
