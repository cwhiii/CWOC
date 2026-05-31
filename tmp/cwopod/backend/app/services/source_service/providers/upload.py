"""Upload provider for handling user file uploads.

Supports EPUB, DOCX, TXT, and PDF formats with a maximum file size of 200 MB.
Processing pipeline:
1. Validate file format (extension + magic bytes)
2. Extract metadata (format-specific extraction)
3. Normalize to internal format via Pandoc
4. Extract and store images (EPUB)
"""

import asyncio
import logging
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from app.services.source_service.exceptions import NormalizationError
from app.services.source_service.models import (
    BookMetadata,
    Chapter,
    ExtractedImage,
    NormalizationResult,
    ValidationErrorCode,
    ValidationResult,
)

logger = logging.getLogger(__name__)


# Mapping of file extensions to Pandoc input format identifiers
PANDOC_FORMAT_MAP: dict[str, str] = {
    ".epub": "epub",
    ".docx": "docx",
    ".txt": "markdown",
    ".pdf": "markdown",  # PDF is preprocessed with pdftotext, then treated as markdown
    ".html": "html",
    ".htm": "html",
}

# Supported file formats and their MIME types
SUPPORTED_FORMATS: dict[str, str] = {
    ".epub": "application/epub+zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
}

MAX_FILE_SIZE: int = 200 * 1024 * 1024  # 200 MB


class UploadProvider:
    """Handles user file uploads: validation, metadata extraction, normalization, and image extraction."""

    # Magic byte signatures for format verification
    _ZIP_MAGIC = b"PK\x03\x04"  # ZIP-based formats (EPUB, DOCX)
    _PDF_MAGIC = b"%PDF"  # PDF files

    async def validate(self, file_path: Path) -> ValidationResult:
        """Validate file format, size, and readability.

        Checks performed in order:
        1. File extension is one of the supported formats (.epub, .docx, .txt, .pdf)
        2. File size does not exceed 200 MB
        3. File magic bytes match expected content type
        4. File is readable/not corrupt (attempt to open with appropriate library)

        Args:
            file_path: Path to the uploaded file.

        Returns:
            ValidationResult with success/failure and error details.
        """
        extension = file_path.suffix.lower()

        # 1. Check file extension
        if extension not in SUPPORTED_FORMATS:
            supported = ", ".join(sorted(SUPPORTED_FORMATS.keys()))
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.UNSUPPORTED_FORMAT,
                error_message=(
                    f"Unsupported file format '{extension or '(none)'}'. "
                    f"Supported formats: {supported}"
                ),
                file_size_bytes=0,
            )

        # 2. Check file size
        try:
            file_size = file_path.stat().st_size
        except OSError as e:
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.FILE_CORRUPT,
                error_message=f"Cannot read file: {e}",
                detected_format=extension,
                file_size_bytes=0,
            )

        if file_size > MAX_FILE_SIZE:
            max_mb = MAX_FILE_SIZE // (1024 * 1024)
            actual_mb = file_size / (1024 * 1024)
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.FILE_TOO_LARGE,
                error_message=(
                    f"File size ({actual_mb:.1f} MB) exceeds the maximum "
                    f"allowed size of {max_mb} MB."
                ),
                detected_format=extension,
                file_size_bytes=file_size,
            )

        # 3. Check magic bytes
        try:
            with open(file_path, "rb") as f:
                header = f.read(8192)  # Read first 8KB for magic byte checks
        except OSError as e:
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.FILE_CORRUPT,
                error_message=f"Cannot read file: {e}",
                detected_format=extension,
                file_size_bytes=file_size,
            )

        if not self._check_magic_bytes(header, extension):
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.MAGIC_BYTES_MISMATCH,
                error_message=(
                    f"File content does not match the expected format for "
                    f"'{extension}'. The file may be mislabeled or corrupted."
                ),
                detected_format=extension,
                file_size_bytes=file_size,
            )

        # 4. Check file readability/corruption
        corruption_error = self._check_readability(file_path, extension)
        if corruption_error is not None:
            return ValidationResult(
                is_valid=False,
                error_code=ValidationErrorCode.FILE_CORRUPT,
                error_message=corruption_error,
                detected_format=extension,
                file_size_bytes=file_size,
            )

        # All checks passed
        return ValidationResult(
            is_valid=True,
            detected_format=extension,
            file_size_bytes=file_size,
        )

    def _check_magic_bytes(self, header: bytes, extension: str) -> bool:
        """Verify that file content starts with expected magic bytes for the format.

        Args:
            header: First bytes of the file (at least 4 bytes).
            extension: The file extension (e.g., ".epub").

        Returns:
            True if magic bytes match, False otherwise.
        """
        if not header:
            return False

        if extension in (".epub", ".docx"):
            # Both EPUB and DOCX are ZIP-based formats
            return header[:4] == self._ZIP_MAGIC

        if extension == ".pdf":
            # PDF files start with %PDF
            return header[:4] == self._PDF_MAGIC

        if extension == ".txt":
            # Plain text has no specific magic bytes.
            # Verify it's decodable as text (no null bytes in the sample).
            return self._is_text_content(header)

        if extension in (".html", ".htm"):
            # HTML is text-based, verify it's decodable as text
            return self._is_text_content(header)

        return False

    @staticmethod
    def _is_text_content(sample: bytes) -> bool:
        """Check if content appears to be valid text.

        Checks for UTF-8 decodability first, then falls back to checking
        for binary indicators (null bytes).
        """
        try:
            sample.decode("utf-8")
            return True
        except UnicodeDecodeError:
            pass

        # If not valid UTF-8, check for null bytes which indicate binary content
        if b"\x00" in sample:
            return False

        # Likely a text file in a non-UTF-8 encoding (e.g., Latin-1)
        return True

    def _check_readability(self, file_path: Path, extension: str) -> Optional[str]:
        """Attempt to open the file with the appropriate method to verify it's not corrupt.

        Args:
            file_path: Path to the file.
            extension: The file extension.

        Returns:
            None if the file is readable, or an error message string if corrupt.
        """
        if extension == ".epub":
            return self._check_epub_readable(file_path)
        elif extension == ".docx":
            return self._check_docx_readable(file_path)
        elif extension == ".pdf":
            return self._check_pdf_readable(file_path)
        elif extension == ".txt":
            return self._check_txt_readable(file_path)
        elif extension in (".html", ".htm"):
            return self._check_txt_readable(file_path)  # HTML is text-based
        return None

    @staticmethod
    def _check_epub_readable(file_path: Path) -> Optional[str]:
        """Verify EPUB is a valid ZIP archive containing expected EPUB structure."""
        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                names = zf.namelist()
                # A valid EPUB must contain META-INF/container.xml
                if "META-INF/container.xml" not in names:
                    return (
                        "File appears to be a ZIP archive but is not a valid EPUB: "
                        "missing META-INF/container.xml"
                    )
                # Try to read the container.xml to ensure it's not corrupt
                zf.read("META-INF/container.xml")
        except zipfile.BadZipFile:
            return "File is corrupt: not a valid ZIP archive (required for EPUB format)."
        except Exception as e:
            return f"File is corrupt or unreadable: {e}"
        return None

    @staticmethod
    def _check_docx_readable(file_path: Path) -> Optional[str]:
        """Verify DOCX is a valid ZIP archive containing expected DOCX structure."""
        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                names = zf.namelist()
                # A valid DOCX must contain [Content_Types].xml
                if "[Content_Types].xml" not in names:
                    return (
                        "File appears to be a ZIP archive but is not a valid DOCX: "
                        "missing [Content_Types].xml"
                    )
                # Check for the main document part
                has_document = any(
                    "word/document.xml" in name for name in names
                )
                if not has_document:
                    return (
                        "File appears to be a ZIP archive but is not a valid DOCX: "
                        "missing word/document.xml"
                    )
                # Try to read the content types to ensure it's not corrupt
                zf.read("[Content_Types].xml")
        except zipfile.BadZipFile:
            return "File is corrupt: not a valid ZIP archive (required for DOCX format)."
        except Exception as e:
            return f"File is corrupt or unreadable: {e}"
        return None

    @staticmethod
    def _check_pdf_readable(file_path: Path) -> Optional[str]:
        """Verify PDF has basic structural validity."""
        try:
            content = file_path.read_bytes()

            # Check for PDF header
            if not content.startswith(b"%PDF"):
                return "File does not have a valid PDF header."

            # Check for EOF marker (%%EOF should appear near the end)
            tail = content[-1024:]
            if b"%%EOF" not in tail:
                return (
                    "File appears to be a truncated or corrupt PDF: "
                    "missing %%EOF marker."
                )

            # Check for at least one object definition (basic structure check)
            if b" obj" not in content[:65536]:
                return (
                    "File does not appear to contain valid PDF objects. "
                    "The file may be corrupt."
                )
        except OSError as e:
            return f"File is corrupt or unreadable: {e}"
        return None

    @staticmethod
    def _check_txt_readable(file_path: Path) -> Optional[str]:
        """Verify text file is decodable."""
        try:
            # Read first 8KB for encoding check
            with open(file_path, "rb") as f:
                sample = f.read(8192)

            # Try UTF-8 first
            try:
                sample.decode("utf-8")
                return None
            except UnicodeDecodeError:
                pass

            # Check for null bytes which indicate binary content
            if b"\x00" in sample:
                return (
                    "File contains null bytes and does not appear to be a valid "
                    "text file. It may be a binary file with an incorrect extension."
                )

            # Likely a valid text file in a non-UTF-8 encoding
            return None
        except OSError as e:
            return f"File is corrupt or unreadable: {e}"

    async def extract_metadata(self, file_path: Path, format: str) -> BookMetadata:
        """Extract metadata using format-specific libraries.

        - EPUB: ebooklib (reads OPF metadata: dc:title, dc:creator, dc:date, dc:language)
        - DOCX: python-docx (reads core properties: title, author, created date)
        - PDF: pypdf (reads document info dictionary: /Title, /Author, /CreationDate)
        - TXT: no metadata extraction (returns empty BookMetadata)

        Args:
            file_path: Path to the file to extract metadata from.
            format: File extension (e.g., ".epub", ".docx", ".pdf", ".txt").

        Returns:
            BookMetadata with extracted fields (None for absent fields).
        """
        format_lower = format.lower().lstrip(".")

        if format_lower == "epub":
            return self._extract_epub_metadata(file_path)
        elif format_lower == "docx":
            return self._extract_docx_metadata(file_path)
        elif format_lower == "pdf":
            return self._extract_pdf_metadata(file_path)
        elif format_lower in ("txt", "html", "htm"):
            return BookMetadata(source_provider="upload")
        else:
            return BookMetadata(source_provider="upload")

    def _extract_epub_metadata(self, file_path: Path) -> BookMetadata:
        """Extract metadata from an EPUB file using ebooklib.

        Reads OPF metadata fields: dc:title, dc:creator, dc:date, dc:language.
        Handles missing or malformed metadata gracefully by returning None for absent fields.
        """
        try:
            import ebooklib
            from ebooklib import epub
        except ImportError:
            logger.warning("ebooklib not available; cannot extract EPUB metadata")
            return BookMetadata(source_provider="upload")

        try:
            book = epub.read_epub(str(file_path))
        except Exception as e:
            logger.warning(f"Failed to read EPUB for metadata extraction: {e}")
            return BookMetadata(source_provider="upload")

        title = self._get_epub_field(book, "DC", "title")
        author = self._get_epub_field(book, "DC", "creator")
        date = self._get_epub_field(book, "DC", "date")
        language = self._get_epub_field(book, "DC", "language")

        return BookMetadata(
            title=title,
            author=author,
            publication_date=date,
            language=language,
            source_provider="upload",
        )

    def _get_epub_field(self, book, namespace: str, field: str) -> Optional[str]:
        """Safely extract a single metadata field from an EPUB book.

        Args:
            book: An ebooklib EpubBook instance.
            namespace: Metadata namespace (e.g., "DC" for Dublin Core).
            field: Field name (e.g., "title", "creator", "date", "language").

        Returns:
            The field value as a string, or None if not found or malformed.
        """
        try:
            values = book.get_metadata(namespace, field)
            if values:
                # get_metadata returns list of tuples: [(value, attributes), ...]
                value = values[0][0]
                if isinstance(value, str) and value.strip():
                    return value.strip()
            return None
        except Exception:
            return None

    def _extract_docx_metadata(self, file_path: Path) -> BookMetadata:
        """Extract metadata from a DOCX file using python-docx.

        Reads core properties: title, author, created date.
        Handles missing or malformed metadata gracefully.
        """
        try:
            from docx import Document
        except ImportError:
            logger.warning("python-docx not available; cannot extract DOCX metadata")
            return BookMetadata(source_provider="upload")

        try:
            doc = Document(str(file_path))
            props = doc.core_properties
        except Exception as e:
            logger.warning(f"Failed to read DOCX for metadata extraction: {e}")
            return BookMetadata(source_provider="upload")

        title: Optional[str] = None
        author: Optional[str] = None
        publication_date: Optional[str] = None

        try:
            if props.title and props.title.strip():
                title = props.title.strip()
        except Exception:
            pass

        try:
            if props.author and props.author.strip():
                author = props.author.strip()
        except Exception:
            pass

        try:
            if props.created:
                publication_date = props.created.isoformat()
        except Exception:
            pass

        return BookMetadata(
            title=title,
            author=author,
            publication_date=publication_date,
            source_provider="upload",
        )

    def _extract_pdf_metadata(self, file_path: Path) -> BookMetadata:
        """Extract metadata from a PDF file using pypdf.

        Reads document info dictionary: /Title, /Author, /CreationDate.
        Handles missing or malformed metadata gracefully.
        """
        try:
            from pypdf import PdfReader
        except ImportError:
            logger.warning("pypdf not available; cannot extract PDF metadata")
            return BookMetadata(source_provider="upload")

        try:
            reader = PdfReader(str(file_path))
            info = reader.metadata
        except Exception as e:
            logger.warning(f"Failed to read PDF for metadata extraction: {e}")
            return BookMetadata(source_provider="upload")

        if info is None:
            return BookMetadata(source_provider="upload")

        title: Optional[str] = None
        author: Optional[str] = None
        publication_date: Optional[str] = None

        try:
            raw_title = info.get("/Title")
            if raw_title and str(raw_title).strip():
                title = str(raw_title).strip()
        except Exception:
            pass

        try:
            raw_author = info.get("/Author")
            if raw_author and str(raw_author).strip():
                author = str(raw_author).strip()
        except Exception:
            pass

        try:
            raw_date = info.get("/CreationDate")
            if raw_date:
                publication_date = self._parse_pdf_date(str(raw_date))
        except Exception:
            pass

        return BookMetadata(
            title=title,
            author=author,
            publication_date=publication_date,
            source_provider="upload",
        )

    def _parse_pdf_date(self, date_str: str) -> Optional[str]:
        """Parse a PDF date string into ISO 8601 format.

        PDF dates follow the format: D:YYYYMMDDHHmmSSOHH'mm'
        Example: D:20230615120000+00'00'

        Returns:
            ISO 8601 date string (YYYY-MM-DD), or the raw string if parsing fails.
            Returns None if the input is empty.
        """
        if not date_str or not date_str.strip():
            return None

        date_str = date_str.strip()

        # Remove the "D:" prefix if present
        if date_str.startswith("D:"):
            date_str = date_str[2:]

        # Try to parse at least the date portion (YYYYMMDD)
        try:
            if len(date_str) >= 8:
                year = date_str[0:4]
                month = date_str[4:6]
                day = date_str[6:8]
                # Basic validation
                int(year)
                int(month)
                int(day)
                return f"{year}-{month}-{day}"
        except (ValueError, IndexError):
            pass

        # Return the raw string if we can't parse it
        return date_str if date_str else None

    async def normalize(self, file_path: Path, format: str) -> NormalizationResult:
        """Normalize a document to structured HTML using Pandoc.

        Converts the input file to HTML format via Pandoc subprocess, preserving
        document structure (headings, paragraphs, lists) and extracting embedded images.

        For PDF files, a preprocessing step using pdftotext extracts the text content
        before passing it to Pandoc as markdown.

        Args:
            file_path: Path to the input file.
            format: File extension (e.g., ".epub", ".docx", ".txt", ".pdf").

        Returns:
            NormalizationResult with HTML content, detected chapters, and extracted images.

        Raises:
            NormalizationError: If Pandoc fails (non-zero exit code or stderr output).
        """
        format_lower = format.lower().lstrip(".")
        format_ext = f".{format_lower}" if not format.startswith(".") else format.lower()

        if format_ext not in PANDOC_FORMAT_MAP:
            raise NormalizationError(
                f"Unsupported format for normalization: {format_ext}"
            )

        # For PDF: preprocess with pdftotext to extract text first
        if format_ext == ".pdf":
            return await self._normalize_pdf(file_path)

        pandoc_format = PANDOC_FORMAT_MAP[format_ext]
        return await self._run_pandoc(file_path, pandoc_format)

    async def _normalize_pdf(self, file_path: Path) -> NormalizationResult:
        """Preprocess PDF with pdftotext, then normalize the extracted text.

        Uses pdftotext (from poppler-utils) to extract text content from the PDF,
        writes it to a temporary file, then runs Pandoc on the text as markdown.

        Args:
            file_path: Path to the PDF file.

        Returns:
            NormalizationResult with HTML content from the extracted text.

        Raises:
            NormalizationError: If pdftotext or Pandoc fails.
        """
        # Run pdftotext to extract text from PDF
        try:
            pdftotext_proc = await asyncio.create_subprocess_exec(
                "pdftotext",
                "-layout",
                str(file_path),
                "-",  # Output to stdout
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await pdftotext_proc.communicate()
        except FileNotFoundError:
            raise NormalizationError(
                "pdftotext not found. Please install poppler-utils.",
                stderr="pdftotext: command not found",
            )
        except OSError as e:
            raise NormalizationError(
                f"Failed to run pdftotext: {e}",
                stderr=str(e),
            )

        if pdftotext_proc.returncode != 0:
            stderr_text = stderr.decode("utf-8", errors="replace")
            raise NormalizationError(
                f"pdftotext failed with exit code {pdftotext_proc.returncode}: {stderr_text}",
                stderr=stderr_text,
            )

        extracted_text = stdout.decode("utf-8", errors="replace")

        if not extracted_text.strip():
            raise NormalizationError(
                "pdftotext produced no text output from the PDF file.",
                stderr="",
            )

        # Write extracted text to a temporary file and normalize as markdown
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".md", delete=False, encoding="utf-8"
        ) as tmp_file:
            tmp_file.write(extracted_text)
            tmp_path = Path(tmp_file.name)

        try:
            return await self._run_pandoc(tmp_path, "markdown")
        finally:
            # Clean up temporary file
            try:
                tmp_path.unlink()
            except OSError:
                pass

    async def _run_pandoc(
        self, input_path: Path, pandoc_format: str
    ) -> NormalizationResult:
        """Run Pandoc to convert a file to HTML.

        Constructs and executes the Pandoc command:
            pandoc -f {format} -t html --extract-media={media_dir} -o {output} {input}

        Args:
            input_path: Path to the input file.
            pandoc_format: Pandoc format identifier (epub, docx, markdown).

        Returns:
            NormalizationResult with parsed HTML content and detected chapters.

        Raises:
            NormalizationError: If Pandoc returns a non-zero exit code.
        """
        # Create a temporary directory for extracted media and output
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_dir_path = Path(tmp_dir)
            media_dir = tmp_dir_path / "media"
            media_dir.mkdir(exist_ok=True)
            output_path = tmp_dir_path / "output.html"

            # Construct Pandoc command
            cmd = [
                "pandoc",
                "-f", pandoc_format,
                "-t", "html",
                f"--extract-media={media_dir}",
                "-o", str(output_path),
                str(input_path),
            ]

            logger.info(f"Running Pandoc: {' '.join(cmd)}")

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()
            except FileNotFoundError:
                raise NormalizationError(
                    "Pandoc not found. Please install Pandoc.",
                    stderr="pandoc: command not found",
                )
            except OSError as e:
                raise NormalizationError(
                    f"Failed to run Pandoc: {e}",
                    stderr=str(e),
                )

            if proc.returncode != 0:
                stderr_text = stderr.decode("utf-8", errors="replace")
                raise NormalizationError(
                    f"Pandoc failed with exit code {proc.returncode}: {stderr_text}",
                    stderr=stderr_text,
                )

            # Read the HTML output
            if not output_path.exists():
                raise NormalizationError(
                    "Pandoc did not produce an output file.",
                    stderr=stderr.decode("utf-8", errors="replace"),
                )

            html_content = output_path.read_text(encoding="utf-8")

            # Parse chapters from HTML headings (h1/h2)
            chapters = self._detect_chapters(html_content)

            # Collect extracted images from media directory
            images = self._collect_extracted_images(media_dir)

            section_count = len(chapters)

            return NormalizationResult(
                html_content=html_content,
                chapters=chapters,
                section_count=section_count,
                images=images,
            )

    def _detect_chapters(self, html_content: str) -> list[Chapter]:
        """Parse HTML content to detect chapters based on h1/h2 headings.

        Args:
            html_content: The Pandoc-generated HTML string.

        Returns:
            List of Chapter objects representing detected chapter divisions.
        """
        chapters: list[Chapter] = []

        # Match h1 and h2 tags with their content
        heading_pattern = re.compile(
            r"<h([12])[^>]*>(.*?)</h\1>", re.IGNORECASE | re.DOTALL
        )

        for match in heading_pattern.finditer(html_content):
            level = int(match.group(1))
            # Strip HTML tags from heading content to get plain text title
            raw_title = match.group(2)
            title = re.sub(r"<[^>]+>", "", raw_title).strip()
            start_index = match.start()

            chapters.append(
                Chapter(title=title, level=level, start_index=start_index)
            )

        return chapters

    def _collect_extracted_images(self, media_dir: Path) -> list[ExtractedImage]:
        """Collect images extracted by Pandoc from the media directory.

        Args:
            media_dir: Path to the directory where Pandoc extracted media files.

        Returns:
            List of ExtractedImage objects with file data and content types.
        """
        images: list[ExtractedImage] = []

        if not media_dir.exists():
            return images

        # Map file extensions to MIME types
        mime_map: dict[str, str] = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
            ".tif": "image/tiff",
        }

        # Recursively find all image files in the media directory
        for file_path in sorted(media_dir.rglob("*")):
            if not file_path.is_file():
                continue

            ext = file_path.suffix.lower()
            content_type = mime_map.get(ext)

            if content_type is None:
                continue  # Skip non-image files

            try:
                data = file_path.read_bytes()
                images.append(
                    ExtractedImage(
                        filename=file_path.name,
                        content_type=content_type,
                        data=data,
                        placement_ref=None,
                    )
                )
            except OSError as e:
                logger.warning(f"Failed to read extracted image {file_path}: {e}")

        return images

    async def extract_images(self, file_path: Path) -> list[ExtractedImage]:
        """Extract embedded images from EPUB files using ebooklib.

        Iterates over all image items in the EPUB, extracts each image's filename,
        content type, and binary data. Determines image placement by parsing the
        EPUB spine and finding image references in HTML content.

        Args:
            file_path: Path to the EPUB file.

        Returns:
            List of ExtractedImage objects with placement references.
        """
        import os

        import ebooklib
        from ebooklib import epub

        book = epub.read_epub(str(file_path))

        # Build a mapping from image filename/path to placement references
        # by parsing spine documents for image references
        image_placements = self._build_image_placement_map(book)

        images: list[ExtractedImage] = []
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            filename = os.path.basename(item.get_name())
            content_type = item.media_type
            data = item.get_content()

            # Look up placement reference from the spine analysis
            item_href = item.get_name()
            placement_ref = image_placements.get(item_href) or image_placements.get(filename)

            images.append(
                ExtractedImage(
                    filename=filename,
                    content_type=content_type,
                    data=data,
                    placement_ref=placement_ref,
                )
            )

        return images

    def _build_image_placement_map(self, book) -> dict[str, Optional[str]]:
        """Parse the EPUB spine to find image references in HTML content.

        Walks through each document in the spine order, parses the HTML content
        for <img> tags and SVG image references, and maps each image filename
        to a placement reference (spine document heading or ID).

        Args:
            book: An ebooklib EpubBook instance.

        Returns:
            Dict mapping image href/filename to a placement reference string.
        """
        import os

        placements: dict[str, Optional[str]] = {}

        # Get spine items in reading order
        spine_docs = self._get_spine_documents(book)

        for spine_index, doc_item in enumerate(spine_docs):
            content = doc_item.get_content()
            if not content:
                continue

            html_text = content.decode("utf-8", errors="replace")

            # Determine a human-readable placement reference for this spine document
            placement_label = self._get_document_label(doc_item, spine_index)

            # Find all image references in this HTML document
            image_refs = self._find_image_references(html_text)

            for img_ref in image_refs:
                # Normalize the reference path — images may be referenced with
                # relative paths like ../images/fig1.png or just images/fig1.png
                normalized_ref = self._normalize_image_path(img_ref, doc_item.get_name())
                basename = os.path.basename(img_ref)

                # Map both the full path and basename to the placement
                if normalized_ref not in placements:
                    placements[normalized_ref] = placement_label
                if basename not in placements:
                    placements[basename] = placement_label

        return placements

    def _get_spine_documents(self, book) -> list:
        """Get document items from the EPUB spine in reading order.

        Args:
            book: An ebooklib EpubBook instance.

        Returns:
            List of EpubHtml items in spine order.
        """
        spine_docs = []
        for item_id, _linear in book.spine:
            item = book.get_item_with_id(item_id)
            if item is not None:
                spine_docs.append(item)
        return spine_docs

    def _get_document_label(self, doc_item, spine_index: int) -> str:
        """Generate a human-readable label for a spine document.

        Uses the first heading found in the document's HTML content if available,
        otherwise falls back to the item ID or spine position.

        Args:
            doc_item: An ebooklib EpubHtml item.
            spine_index: The zero-based index of this item in the spine.

        Returns:
            A string label for placement reference.
        """
        content = doc_item.get_content()
        if content:
            html_text = content.decode("utf-8", errors="replace")
            # Look for heading tags to use as a label
            heading_match = re.search(
                r"<h[1-3][^>]*>(.*?)</h[1-3]>", html_text, re.IGNORECASE | re.DOTALL
            )
            if heading_match:
                # Strip HTML tags from the heading text
                heading_text = re.sub(r"<[^>]+>", "", heading_match.group(1)).strip()
                if heading_text:
                    return heading_text

        # Fall back to item ID or filename
        item_id = doc_item.get_id()
        if item_id:
            return f"section:{item_id}"

        return f"spine:{spine_index}"

    def _find_image_references(self, html_text: str) -> list[str]:
        """Find all image references in HTML content.

        Looks for:
        - <img src="..."> tags
        - <image xlink:href="..."> (SVG embedded images)

        Args:
            html_text: The HTML content of a spine document.

        Returns:
            List of image reference paths found in the HTML.
        """
        refs: list[str] = []

        # Match <img> src attributes
        img_pattern = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
        refs.extend(img_pattern.findall(html_text))

        # Match SVG <image> xlink:href attributes
        svg_pattern = re.compile(
            r'<image[^>]+(?:xlink:)?href=["\']([^"\']+)["\']', re.IGNORECASE
        )
        refs.extend(svg_pattern.findall(html_text))

        return refs

    @staticmethod
    def _normalize_image_path(img_ref: str, doc_path: str) -> str:
        """Normalize a relative image reference to an absolute EPUB-internal path.

        Resolves relative paths like '../images/fig1.png' against the
        document's location within the EPUB.

        Args:
            img_ref: The image reference path from the HTML (may be relative).
            doc_path: The path of the referencing document within the EPUB.

        Returns:
            Normalized path within the EPUB structure.
        """
        import os

        if img_ref.startswith("/"):
            # Already absolute within the EPUB
            return img_ref.lstrip("/")

        # Get the directory of the referencing document
        doc_dir = os.path.dirname(doc_path)

        # Join and normalize
        combined = os.path.normpath(os.path.join(doc_dir, img_ref))

        # Convert backslashes to forward slashes (Windows compatibility)
        return combined.replace("\\", "/")
