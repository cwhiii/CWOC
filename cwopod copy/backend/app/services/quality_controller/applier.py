"""Correction applier: applies accepted corrections to create working copy."""

from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.correction import Correction, CorrectionStatus
from app.models.project import BookProject


class CorrectionApplierService:
    """Applies accepted corrections to the project text."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def apply_corrections(self, project_id: UUID) -> dict:
        """Apply all accepted corrections to the project text.

        1. Load original text
        2. Fetch accepted corrections ordered by position DESC
        3. Apply each in reverse order (preserves positions)
        4. Write result to working_text_path
        5. Return summary
        """
        # Load project
        result = await self.db.execute(
            select(BookProject).where(
                BookProject.id == project_id,
                BookProject.user_id == self.user_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError("Project not found")

        if not project.original_text_path:
            raise ValueError("Project has no text to correct")

        # Read original text
        original_path = Path(project.original_text_path)
        text = original_path.read_text(encoding="utf-8")

        # Fetch accepted corrections in reverse position order
        result = await self.db.execute(
            select(Correction)
            .where(
                Correction.project_id == project_id,
                Correction.status == CorrectionStatus.ACCEPTED,
            )
            .order_by(Correction.position.desc())
        )
        corrections = result.scalars().all()

        if not corrections:
            # No corrections to apply — use original as working copy
            project.working_text_path = project.original_text_path
            return {"applied": 0, "skipped": 0, "working_text_path": project.original_text_path}

        # Apply corrections in reverse order
        applied = 0
        skipped = 0

        for correction in corrections:
            pos = correction.position
            original = correction.original_text
            suggested = correction.suggested_text

            # Validate text at position matches expected
            end_pos = pos + len(original)
            if pos >= 0 and end_pos <= len(text) and text[pos:end_pos] == original:
                text = text[:pos] + suggested + text[end_pos:]
                applied += 1
            else:
                skipped += 1

        # Write working copy
        working_path = original_path.parent / "working.txt"
        working_path.write_text(text, encoding="utf-8")

        project.working_text_path = str(working_path)

        return {
            "applied": applied,
            "skipped": skipped,
            "working_text_path": str(working_path),
        }
