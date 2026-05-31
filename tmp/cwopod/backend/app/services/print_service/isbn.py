"""ISBN manager: validation and Lulu free ISBN integration."""

import logging

logger = logging.getLogger(__name__)


class ISBNManager:
    """Manages ISBN assignment for book projects.

    Supports three modes:
    - No ISBN (toggle off): proceed without ISBN
    - Lulu free ISBN: request via Lulu API
    - User-provided ISBN: validate ISBN-13 format
    """

    def validate_isbn13(self, isbn: str) -> tuple[bool, str | None]:
        """Validate an ISBN-13 string.

        Strips hyphens/spaces, checks 13 digits, validates check digit.
        Returns (is_valid, error_message).
        """
        logger.debug("ISBNManager.validate_isbn13: validating '%s'", isbn)

        # Strip hyphens and spaces
        cleaned = isbn.replace("-", "").replace(" ", "")

        # Check length
        if len(cleaned) != 13:
            return False, f"ISBN-13 must be exactly 13 digits (got {len(cleaned)})"

        # Check all digits
        if not cleaned.isdigit():
            return False, "ISBN-13 must contain only digits (and optional hyphens/spaces)"

        # Validate check digit
        total = 0
        for i, digit in enumerate(cleaned[:12]):
            weight = 1 if i % 2 == 0 else 3
            total += int(digit) * weight

        check_digit = (10 - (total % 10)) % 10

        if int(cleaned[12]) != check_digit:
            return False, f"Invalid check digit. Expected {check_digit}, got {cleaned[12]}"

        logger.debug("ISBNManager.validate_isbn13: valid ISBN-13")
        return True, None

    async def request_lulu_isbn(self, lulu_adapter, book_spec) -> tuple[str | None, str | None]:
        """Request a free ISBN through Lulu's program.

        Args:
            lulu_adapter: Authenticated LuluAdapter instance.
            book_spec: Book details for ISBN registration.

        Returns:
            Tuple of (isbn, error_message).
            isbn is None on failure; error_message is None on success.

        Timeout: 30 seconds (enforced by LuluAdapter).
        """
        logger.info(
            "ISBNManager.request_lulu_isbn: requesting for title='%s'",
            book_spec.title,
        )

        try:
            isbn = await lulu_adapter.request_free_isbn(book_spec)
            if isbn:
                # Validate the returned ISBN
                is_valid, error = self.validate_isbn13(isbn)
                if is_valid:
                    logger.info("ISBNManager.request_lulu_isbn: assigned ISBN=%s", isbn)
                    return isbn, None
                else:
                    logger.warning(
                        "ISBNManager.request_lulu_isbn: Lulu returned invalid ISBN: %s (%s)",
                        isbn, error,
                    )
                    return isbn, None  # Still return it; Lulu knows their ISBNs
            else:
                return None, "Lulu returned an empty ISBN response"
        except Exception as e:
            error_msg = f"ISBN request failed: {str(e)}"
            logger.error("ISBNManager.request_lulu_isbn: %s", error_msg)
            return None, error_msg
