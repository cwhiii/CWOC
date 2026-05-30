"""Cover prompt generator: analyzes book chapter-by-chapter to produce spoiler-free image prompts."""

import logging
import re
from typing import Callable

from app.services.ai_engine import AIRouter, AIResult

logger = logging.getLogger(__name__)

CHAPTER_ANALYSIS_SYSTEM = """You are a book cover art director. Analyze the provided chapter text and extract visual themes, settings, moods, and symbolic imagery that could inspire cover art. Focus on:
- Physical settings and landscapes described
- Atmospheric details (weather, lighting, time of day)
- Symbolic objects or recurring motifs
- Emotional tone and mood
- Character archetypes (without spoilers)

Return 2-4 brief visual notes, one per line. Each should be a short phrase describing a visual element. Do NOT describe plot events. Example:
- Misty English countryside with railway tracks disappearing into fog
- Warm golden light from a cottage kitchen window
- Children's silhouettes against a dramatic sunset sky"""


class CoverServiceError(Exception):
    def __init__(self, message: str, can_retry: bool = True):
        self.message = message
        self.can_retry = can_retry
        super().__init__(message)


class PromptGenerator:
    """Generates spoiler-free cover art prompts by analyzing each chapter."""

    def __init__(self, ai_router: AIRouter):
        self.ai_router = ai_router

    async def generate_prompts(
        self,
        chapters: list,
        title: str,
        author: str,
        on_progress: Callable[[int, int, str, list], None] | None = None,
        on_tokens: Callable[[int, int, str, int], None] | None = None,
        mode: str = "standard",
        num_prompts: int = 5,
    ) -> list[str]:
        """Analyze book chapter-by-chapter and produce cover art prompts.

        Args:
            chapters: List of Chapter objects (from ChapterDetector).
            title: Book title.
            author: Book author.
            on_progress: Optional callback(current_chapter, total_chapters, chapter_title, visual_notes_so_far).
            on_tokens: Optional callback(current_chapter, token_count, chapter_title, total_chapters) called during inference.
            mode: "standard" for full analysis, "lucky" for single prompt from one section.
            num_prompts: Number of prompts to generate in standard mode (3, 5, 7, or 11).

        Returns:
            List of prompt strings (num_prompts for standard, 1 for lucky).
        """
        total = len(chapters)
        logger.info(
            "generate_prompts: analyzing %d chapters for '%s' by %s, mode=%s, num_prompts=%d",
            total, title, author, mode, num_prompts,
        )

        # --- Lucky mode: single chapter, single prompt, no synthesis ---
        if mode == "lucky":
            return await self._generate_lucky_prompt(
                chapters[0], title, author, on_progress, on_tokens,
            )

        # If the chapter detector returned the entire book as 1 chapter (no headings found),
        # split it into ~10 evenly-spaced 1% samples instead of feeding the whole thing.
        # A small model on CPU can't handle a full book in one shot.
        if total == 1 and len(chapters[0].content) > 20000:
            logger.info(
                "generate_prompts: single-chapter fallback detected (%d chars), "
                "splitting into 1%% samples spaced across the book",
                len(chapters[0].content),
            )
            full_text = chapters[0].content
            text_len = len(full_text)
            sample_size = max(1000, text_len // 100)  # 1% of the book per sample
            num_samples = 10
            step = text_len // num_samples

            from app.services.typeset.chapter_detector import Chapter
            chapters = []
            for i in range(num_samples):
                start = i * step
                sample = full_text[start:start + sample_size]
                # Don't start mid-word — find the first space
                if start > 0:
                    first_space = sample.find(" ")
                    if first_space > 0 and first_space < 50:
                        sample = sample[first_space + 1:]
                chapters.append(Chapter(
                    number=i + 1,
                    title=f"Section {i + 1}",
                    heading=f"Section {i + 1}",
                    content=sample,
                    start_position=start,
                ))
            total = len(chapters)
            logger.info(
                "generate_prompts: created %d samples of ~%d chars each",
                total, sample_size,
            )

        # Filter out chapters with insufficient content BEFORE the loop so that
        # progress reporting accurately reflects actual work (no instant jump past
        # empty front-matter chapters).
        processable_chapters = [
            ch for ch in chapters if len(ch.content[:6000].strip()) >= 100
        ]
        skipped_count = total - len(processable_chapters)
        if skipped_count > 0:
            logger.info(
                "generate_prompts: filtered out %d chapters with < 100 chars of content, "
                "%d chapters remain for analysis",
                skipped_count, len(processable_chapters),
            )
        total = len(processable_chapters)

        all_visual_notes = []
        # Structured notes for progress reporting: list of {chapter, notes: [str]}
        chapter_notes_list = []

        for i, chapter in enumerate(processable_chapters):
            chapter_title = chapter.title or f"Chapter {chapter.number}"
            logger.info(
                "generate_prompts: processing chapter %d/%d: %s",
                i + 1, total, chapter_title,
            )

            if on_progress:
                on_progress(i + 1, total, chapter_title, chapter_notes_list)

            # Truncate individual chapter to 6000 chars max to keep inference fast
            chapter_text = chapter.content[:6000]

            user_prompt = (
                f"Book: \"{title}\" by {author}\n"
                f"Chapter: {chapter_title}\n\n"
                f"Text:\n{chapter_text}\n\n"
                "Extract visual themes and imagery from this chapter."
            )

            # Build a token callback that reports progress for this chapter
            def _make_token_cb(ch_num, ch_title, ch_total):
                def _cb(token_count):
                    if on_tokens:
                        on_tokens(ch_num, token_count, ch_title, ch_total)
                return _cb

            token_cb = _make_token_cb(i + 1, chapter_title, total)

            result: AIResult = await self.ai_router.generate_text(
                prompt=user_prompt,
                system_prompt=CHAPTER_ANALYSIS_SYSTEM,
                max_tokens=512,
                on_token=token_cb,
            )

            if result.success and result.data:
                all_visual_notes.append(f"[{chapter_title}]\n{result.data.strip()}")
                # Parse individual bullet points from the AI response
                notes_lines = [
                    line.lstrip("- ").strip()
                    for line in result.data.strip().splitlines()
                    if line.strip() and line.strip() != "-"
                ]
                chapter_notes_list.append({
                    "chapter": chapter_title,
                    "notes": notes_lines,
                })
                logger.debug(
                    "generate_prompts: chapter %d yielded %d notes (%d chars)",
                    i + 1, len(notes_lines), len(result.data),
                )
                # Report progress again after chapter completes so frontend sees the new notes
                if on_progress:
                    on_progress(i + 1, total, chapter_title, chapter_notes_list)
            else:
                logger.warning(
                    "generate_prompts: chapter %d failed: %s",
                    i + 1, result.error if result else "no result",
                )

        if not all_visual_notes:
            raise CoverServiceError(
                "Failed to extract visual themes from any chapter",
                can_retry=True,
            )

        # Final synthesis: combine all chapter notes into prompts
        logger.info(
            "generate_prompts: synthesizing %d chapter analyses into %d prompts",
            len(all_visual_notes), num_prompts,
        )

        if on_progress:
            on_progress(total, total, "Synthesizing final prompts", chapter_notes_list)

        combined_notes = "\n\n".join(all_visual_notes)
        synthesis_prompt = (
            f"Book: \"{title}\" by {author}\n\n"
            f"Visual notes collected from each chapter:\n{combined_notes}\n\n"
            f"Generate exactly {num_prompts} cover art image prompts that capture the essence of this book."
        )

        synthesis_system = (
            f"You are a book cover art director. Based on the collected visual notes from analyzing "
            f"a book's chapters, generate exactly {num_prompts} image prompts for potential book cover art. "
            f"Each prompt must:\n"
            f"- Describe a visual scene, mood, or symbolic imagery (NOT literal plot events)\n"
            f"- Be completely spoiler-free (no plot twists, endings, character deaths, revelations)\n"
            f"- Be suitable for AI image generation (descriptive, atmospheric, artistic)\n"
            f"- Focus on themes, settings, emotions, or symbolic elements\n"
            f"- Be 1-3 sentences long, vivid and specific\n"
            f"- Combine and elevate the visual notes into cohesive artistic concepts\n\n"
            f"Return exactly {num_prompts} prompts, one per line, numbered 1-{num_prompts}. Example format:\n"
            f"1. A misty Victorian garden at dawn, with iron gates half-open and morning light filtering through ancient oak trees.\n"
            f"2. ..."
        )

        # Scale max_tokens based on prompt count (~150 tokens per prompt)
        synthesis_max_tokens = num_prompts * 150

        # Token callback for synthesis step
        def _synth_token_cb(token_count):
            if on_tokens:
                on_tokens(total, token_count, "Synthesizing final prompts", total)

        result = await self.ai_router.generate_text(
            prompt=synthesis_prompt,
            system_prompt=synthesis_system,
            max_tokens=synthesis_max_tokens,
            on_token=_synth_token_cb,
        )

        if not result.success:
            raise CoverServiceError(
                f"Failed to synthesize prompts: {result.error}",
                can_retry=result.can_retry,
            )

        prompts = self._parse_prompts(result.data, max_count=num_prompts)
        logger.info("generate_prompts: final prompt count=%d", len(prompts))
        return prompts

    async def _generate_lucky_prompt(
        self,
        chapter,
        title: str,
        author: str,
        on_progress: Callable[[int, int, str, list], None] | None = None,
        on_tokens: Callable[[int, int, str, int], None] | None = None,
    ) -> list[str]:
        """Lucky mode: analyze one section and produce a single cover art prompt directly.

        No synthesis step — just one AI call to turn a text sample into one prompt.
        """
        chapter_title = chapter.title or f"Chapter {chapter.number}"
        logger.info(
            "_generate_lucky_prompt: analyzing '%s' (%d chars)",
            chapter_title, len(chapter.content),
        )

        if on_progress:
            on_progress(1, 1, chapter_title, [])

        # Take a reasonable sample — 3000 chars max to keep inference fast
        sample = chapter.content[:3000]

        # Build a token callback
        def _token_cb(token_count):
            if on_tokens:
                on_tokens(1, token_count, chapter_title, 1)

        # Single AI call: go straight from text to one cover prompt
        user_prompt = (
            f"Book: \"{title}\" by {author}\n"
            f"Chapter: {chapter_title}\n\n"
            f"Text:\n{sample}\n\n"
            "Based on the visual themes, settings, and mood in this text, generate exactly 1 "
            "book cover art image prompt. The prompt should:\n"
            "- Describe a visual scene, mood, or symbolic imagery (NOT literal plot events)\n"
            "- Be completely spoiler-free\n"
            "- Be suitable for AI image generation (descriptive, atmospheric, artistic)\n"
            "- Be 1-3 sentences long, vivid and specific\n\n"
            "Return only the prompt text, nothing else."
        )

        system_prompt = (
            "You are a book cover art director. Generate a single vivid, atmospheric "
            "image prompt for a book cover based on the provided text excerpt. "
            "Focus on mood, setting, and symbolism. No plot spoilers."
        )

        result: AIResult = await self.ai_router.generate_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=256,
            on_token=_token_cb,
        )

        if not result.success or not result.data:
            raise CoverServiceError(
                f"Failed to generate lucky prompt: {result.error if result else 'no result'}",
                can_retry=True,
            )

        prompt_text = result.data.strip()
        # Clean up any numbering prefix the model might add
        prompt_text = re.sub(r"^\d+[\.\)]\s*", "", prompt_text)
        # Take just the first meaningful line if the model returned multiple
        lines = [l.strip() for l in prompt_text.splitlines() if l.strip() and len(l.strip()) > 10]
        final_prompt = lines[0] if lines else prompt_text

        logger.info("_generate_lucky_prompt: result=%s", final_prompt[:100])

        if on_progress:
            on_progress(1, 1, chapter_title, [{"chapter": chapter_title, "notes": [final_prompt]}])

        return [final_prompt]

    def _parse_prompts(self, raw_response: str, max_count: int = 10) -> list[str]:
        """Parse numbered prompts from AI response."""
        if not raw_response:
            return []

        prompts = []
        for line in raw_response.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # Remove numbering prefix (1., 2., etc.)
            cleaned = re.sub(r"^\d+[\.\)]\s*", "", line)
            if cleaned and len(cleaned) > 10:
                prompts.append(cleaned)

        return prompts[:max_count]
