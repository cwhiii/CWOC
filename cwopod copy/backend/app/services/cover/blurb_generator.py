"""Back cover blurb generator: produces spoiler-free synopses."""

import logging

from app.services.ai_engine import AIRouter, AIResult
from app.services.cover.prompt_generator import CoverServiceError

logger = logging.getLogger(__name__)

BLURB_SYSTEM = """You are a professional book copywriter. Write a compelling back cover synopsis for the provided book. The synopsis must:
- Be between 100 and 250 words
- Be completely spoiler-free (no plot twists, endings, or major revelations)
- Hook the reader and create intrigue without giving away the story
- Be written in third person present tense
- Focus on the premise, main character's situation, and central conflict
Return ONLY the synopsis text, no additional commentary or labels."""


class BlurbGenerator:
    """Generates spoiler-free back cover synopses."""

    def __init__(self, ai_router: AIRouter):
        self.ai_router = ai_router

    async def generate_blurb(
        self, book_text: str, title: str, author: str, chapter_extracts: list[dict] | None = None
    ) -> str:
        """Generate a spoiler-free synopsis of 100-250 words.

        If chapter_extracts are available (saved from a previous read), uses those
        for better context. Otherwise falls back to the first ~12000 chars.
        """
        logger.info(
            "generate_blurb: title=%r, author=%r, has_chapter_extracts=%s",
            title, author, chapter_extracts is not None,
        )

        if chapter_extracts and len(chapter_extracts) >= 3:
            # Use chapter extracts for richer context (first few chapters only to avoid spoilers)
            max_chapters = min(5, len(chapter_extracts))
            excerpt_parts = []
            for ch in chapter_extracts[:max_chapters]:
                ch_title = ch.get("title", "")
                ch_text = ch.get("extract", "")
                excerpt_parts.append(f"[{ch_title}]\n{ch_text}")
            excerpt = "\n\n".join(excerpt_parts)
            logger.debug("generate_blurb: using %d chapter extracts as context", max_chapters)
        else:
            # Fallback: use first ~12000 chars
            excerpt = book_text[:12000]
            logger.debug("generate_blurb: using first 12000 chars as context")

        user_prompt = (
            f"Book: \"{title}\" by {author}\n\n"
            f"Text excerpt:\n{excerpt}\n\n"
            "Write a back cover synopsis for this book."
        )

        logger.debug("generate_blurb: sending to AI, prompt length=%d chars", len(user_prompt))
        result: AIResult = await self.ai_router.generate_text(
            prompt=user_prompt,
            system_prompt=BLURB_SYSTEM,
            max_tokens=512,
        )

        if not result.success:
            logger.error("generate_blurb: AI failed: %s", result.error)
            raise CoverServiceError(
                f"Failed to generate synopsis: {result.error}",
                can_retry=result.can_retry,
            )

        blurb = result.data.strip()
        logger.info("generate_blurb: success, word_count=%d", len(blurb.split()))
        return blurb

    def validate_blurb_length(self, text: str) -> bool:
        """Validate blurb is within 500-word maximum for user-edited content."""
        word_count = len(text.split())
        logger.debug("validate_blurb_length: word_count=%d, valid=%s", word_count, word_count <= 500)
        return word_count <= 500
