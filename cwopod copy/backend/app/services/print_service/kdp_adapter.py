"""KDP Print adapter (file generation only, no API submission).

KDP Print does not offer a public submission API.
This adapter generates properly formatted files and provides
step-by-step manual upload instructions.
"""

import logging
import zipfile
from pathlib import Path

from app.services.print_service.base import (
    BookSpec,
    OrderStatusResult,
    OrderSubmissionResult,
    PricingEstimate,
    PrintProviderAdapter,
    ProviderError,
)

logger = logging.getLogger(__name__)

# KDP pricing formula (approximate, USD, as of 2024)
# Black & white interior:
#   Fixed cost: $0.85
#   Per-page cost: $0.012 per page
# Color interior:
#   Fixed cost: $0.85
#   Per-page cost: $0.07 per page
KDP_FIXED_COST = 0.85
KDP_BW_PER_PAGE = 0.012
KDP_COLOR_PER_PAGE = 0.07


class KDPAdapter(PrintProviderAdapter):
    """KDP Print adapter for file generation and manual upload.

    Since KDP does not have a public API for order submission,
    this adapter:
    1. Calculates estimated pricing from KDP's published rates
    2. Packages files with KDP-specific naming conventions
    3. Generates a ZIP archive for download
    4. Provides step-by-step upload instructions
    """

    def __init__(self):
        logger.info("KDPAdapter initialized (no credentials required)")

    @property
    def provider_name(self) -> str:
        return "kdp"

    async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
        """Return estimated KDP pricing based on page count and trim size.

        Uses KDP's published pricing formula. No API call needed.
        """
        logger.info(
            "KDPAdapter.get_pricing: pages=%d, color=%s, quantity=%d",
            book_spec.page_count, book_spec.color_interior, book_spec.quantity,
        )

        per_page = KDP_COLOR_PER_PAGE if book_spec.color_interior else KDP_BW_PER_PAGE
        unit_cost = KDP_FIXED_COST + (per_page * book_spec.page_count)
        total_cost = unit_cost * book_spec.quantity

        # KDP doesn't charge shipping for author copies ordered through the dashboard
        # but does for expanded distribution. Estimate $3.99 for standard shipping.
        shipping_cost = 3.99 if book_spec.quantity > 0 else 0.0

        estimate = PricingEstimate(
            unit_cost=round(unit_cost, 2),
            shipping_cost=shipping_cost,
            total_cost=round(total_cost + shipping_cost, 2),
            currency="USD",
            provider="kdp",
            details={
                "fixed_cost": KDP_FIXED_COST,
                "per_page_cost": per_page,
                "page_count": book_spec.page_count,
                "note": "Estimated pricing based on KDP's published rates. Actual cost may vary.",
            },
        )
        logger.info(
            "KDPAdapter.get_pricing: estimated total=%.2f USD", estimate.total_cost
        )
        return estimate

    async def submit_order(
        self, book_specs: list[BookSpec], shipping_address: dict,
        contact_email: str = "",
    ) -> OrderSubmissionResult:
        """Generate KDP-ready files and return upload instructions.

        Does NOT submit via API. Instead packages files and provides instructions.
        """
        if not book_specs:
            return OrderSubmissionResult(
                success=False,
                error_message="No books specified.",
                is_retryable=False,
            )

        spec = book_specs[0]
        logger.info(
            "KDPAdapter.submit_order: packaging files for '%s'", spec.title
        )

        # Verify files exist
        interior_path = Path(spec.interior_pdf_path)
        cover_path = Path(spec.cover_pdf_path)

        if not interior_path.exists():
            return OrderSubmissionResult(
                success=False,
                error_message=f"Interior PDF not found: {spec.interior_pdf_path}. Please regenerate.",
                is_retryable=False,
            )

        if not cover_path.exists():
            return OrderSubmissionResult(
                success=False,
                error_message=f"Cover PDF not found: {spec.cover_pdf_path}. Please regenerate.",
                is_retryable=False,
            )

        # Create KDP-ready ZIP package
        output_dir = interior_path.parent
        zip_path = output_dir / "kdp_package.zip"

        try:
            # KDP naming conventions
            safe_title = "".join(c for c in spec.title if c.isalnum() or c in " -_")[:50].strip()
            interior_name = f"{safe_title}_interior.pdf"
            cover_name = f"{safe_title}_cover.pdf"

            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(interior_path, interior_name)
                zf.write(cover_path, cover_name)

                # Include instructions file
                instructions = self._generate_instructions(spec)
                zf.writestr("UPLOAD_INSTRUCTIONS.txt", instructions)

            logger.info("KDPAdapter.submit_order: ZIP created at %s", zip_path)

        except Exception as e:
            logger.error("KDPAdapter.submit_order: file packaging failed: %s", e, exc_info=True)
            return OrderSubmissionResult(
                success=False,
                error_message=f"Failed to package files: {e}",
                is_retryable=False,
            )

        instructions_summary = (
            f"KDP files packaged successfully.\n\n"
            f"Download your files and upload them to KDP Print:\n"
            f"1. Go to https://kdp.amazon.com\n"
            f"2. Click 'Create New Title' → 'Paperback'\n"
            f"3. Enter book details (title: '{spec.title}', author: '{spec.author}')\n"
            f"4. Upload interior PDF: {interior_name}\n"
            f"5. Upload cover PDF: {cover_name}\n"
            f"6. Set trim size to {spec.trim_width_inches}\" × {spec.trim_height_inches}\"\n"
            f"7. Review and publish\n\n"
            f"ZIP package location: {zip_path}"
        )

        return OrderSubmissionResult(
            success=True,
            provider_order_id=f"KDP-MANUAL-{spec.project_id}",
            error_message=instructions_summary,  # Repurposed as instructions
        )

    async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
        """Not supported for KDP (manual process)."""
        logger.info("KDPAdapter.get_order_status: manual tracking required for %s", provider_order_id)

        return OrderStatusResult(
            provider_order_id=provider_order_id,
            status="submitted",
            tracking_number=None,
            tracking_url="https://kdp.amazon.com/bookshelf",
            estimated_delivery=None,
        )

    def _generate_instructions(self, spec: BookSpec) -> str:
        """Generate detailed upload instructions for KDP."""
        return f"""KDP Print Upload Instructions
{'=' * 40}

Book: {spec.title}
Author: {spec.author}
Pages: {spec.page_count}
Trim Size: {spec.trim_width_inches}" × {spec.trim_height_inches}"
Paper: {'Color' if spec.color_interior else 'Black & White'} on {spec.paper_type} paper
{f'ISBN: {spec.isbn}' if spec.isbn else 'ISBN: None (KDP will assign an ASIN)'}

Steps to Upload:
1. Log in to https://kdp.amazon.com
2. Click "+ Create" → "Paperback"
3. Fill in the Paperback Details:
   - Book Title: {spec.title}
   - Author: {spec.author}
   {f'- ISBN: {spec.isbn}' if spec.isbn else '- Use free KDP ISBN'}
4. In the Paperback Content section:
   - Upload the interior PDF file
   - Set trim size to {spec.trim_width_inches}" × {spec.trim_height_inches}"
   - Select {'color' if spec.color_interior else 'black & white'} interior
   - Select {spec.paper_type} paper
5. In the Cover section:
   - Upload the cover PDF file
6. Click "Launch Previewer" to verify formatting
7. Set pricing and distribution
8. Click "Publish Your Paperback"

Notes:
- KDP may take 24-72 hours to review and publish
- Author copies can be ordered at printing cost after publishing
- The cover PDF includes proper bleed margins (3mm)
"""
