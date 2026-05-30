"""Unit tests for UploadProvider.validate() (task 4.1).

Tests file validation: extension check, size limit, magic bytes, and readability.
"""

import zipfile
from pathlib import Path

import pytest

from app.services.source_service.models import ValidationErrorCode
from app.services.source_service.providers.upload import UploadProvider


@pytest.fixture
def provider():
    return UploadProvider()


def create_minimal_epub(path: Path) -> None:
    """Create a minimal valid EPUB file (ZIP with META-INF/container.xml)."""
    container_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("META-INF/container.xml", container_xml)
        zf.writestr("content.opf", "<package/>")
        zf.writestr("mimetype", "application/epub+zip")


def create_minimal_docx(path: Path) -> None:
    """Create a minimal valid DOCX file (ZIP with [Content_Types].xml and word/document.xml)."""
    content_types = b"""<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
</Types>"""
    document_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body>
</w:document>"""
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("word/document.xml", document_xml)


def create_minimal_pdf(path: Path) -> None:
    """Create a minimal valid PDF file."""
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF"""
    path.write_bytes(pdf_content)


class TestValidateExtension:
    """Test that unsupported file extensions are rejected."""

    @pytest.mark.asyncio
    async def test_unsupported_extension_zip(self, provider, tmp_path):
        file = tmp_path / "archive.zip"
        file.write_bytes(b"PK\x03\x04" + b"\x00" * 100)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.UNSUPPORTED_FORMAT
        assert ".zip" in result.error_message

    @pytest.mark.asyncio
    async def test_unsupported_extension_html(self, provider, tmp_path):
        file = tmp_path / "page.html"
        file.write_text("<html><body>Hello</body></html>")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.UNSUPPORTED_FORMAT

    @pytest.mark.asyncio
    async def test_unsupported_extension_mobi(self, provider, tmp_path):
        file = tmp_path / "book.mobi"
        file.write_bytes(b"\x00" * 100)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.UNSUPPORTED_FORMAT

    @pytest.mark.asyncio
    async def test_no_extension(self, provider, tmp_path):
        file = tmp_path / "noextension"
        file.write_text("some content")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.UNSUPPORTED_FORMAT


class TestValidateFileSize:
    """Test that files exceeding 200 MB are rejected."""

    @pytest.mark.asyncio
    async def test_file_exceeds_200mb(self, provider, tmp_path):
        """File larger than 200 MB is rejected with FILE_TOO_LARGE."""
        file = tmp_path / "huge.txt"
        # Create a file just over 200 MB using sparse write
        with open(file, "wb") as f:
            f.seek(200 * 1024 * 1024 + 1)
            f.write(b"\x00")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_TOO_LARGE
        assert "200 MB" in result.error_message

    @pytest.mark.asyncio
    async def test_file_exactly_200mb_passes_size_check(self, provider, tmp_path):
        """File exactly at 200 MB passes the size check (boundary)."""
        file = tmp_path / "exact.txt"
        with open(file, "wb") as f:
            f.seek(200 * 1024 * 1024 - 1)
            f.write(b"x")

        result = await provider.validate(file)

        # Should pass size check (may fail on magic bytes since it's sparse)
        assert result.error_code != ValidationErrorCode.FILE_TOO_LARGE


class TestValidateMagicBytes:
    """Test that magic bytes are verified against the file extension."""

    @pytest.mark.asyncio
    async def test_epub_extension_but_not_zip(self, provider, tmp_path):
        """File with .epub extension but non-ZIP content is rejected."""
        file = tmp_path / "fake.epub"
        file.write_bytes(b"This is not a zip file at all" * 10)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.MAGIC_BYTES_MISMATCH

    @pytest.mark.asyncio
    async def test_docx_extension_but_not_zip(self, provider, tmp_path):
        """File with .docx extension but non-ZIP content is rejected."""
        file = tmp_path / "fake.docx"
        file.write_bytes(b"%PDF-1.4 this is actually a pdf")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.MAGIC_BYTES_MISMATCH

    @pytest.mark.asyncio
    async def test_pdf_extension_but_not_pdf(self, provider, tmp_path):
        """File with .pdf extension but non-PDF content is rejected."""
        file = tmp_path / "fake.pdf"
        file.write_bytes(b"PK\x03\x04" + b"\x00" * 100)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.MAGIC_BYTES_MISMATCH

    @pytest.mark.asyncio
    async def test_txt_extension_with_binary_content(self, provider, tmp_path):
        """File with .txt extension but binary content (null bytes) is rejected."""
        file = tmp_path / "binary.txt"
        file.write_bytes(b"\x00\x01\x02\x03\x00\x05\x06\x07" * 100)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.MAGIC_BYTES_MISMATCH


class TestValidateReadability:
    """Test that corrupt files are detected during readability checks."""

    @pytest.mark.asyncio
    async def test_corrupt_epub_bad_zip(self, provider, tmp_path):
        """EPUB that starts with PK but is not a valid ZIP is rejected."""
        file = tmp_path / "corrupt.epub"
        # Start with ZIP magic but corrupt the rest
        file.write_bytes(b"PK\x03\x04" + b"\xff" * 200)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT

    @pytest.mark.asyncio
    async def test_epub_zip_missing_container_xml(self, provider, tmp_path):
        """EPUB that is a valid ZIP but missing META-INF/container.xml is rejected."""
        file = tmp_path / "no_container.epub"
        with zipfile.ZipFile(file, "w") as zf:
            zf.writestr("some_file.txt", "not an epub")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT
        assert "META-INF/container.xml" in result.error_message

    @pytest.mark.asyncio
    async def test_docx_zip_missing_content_types(self, provider, tmp_path):
        """DOCX that is a valid ZIP but missing [Content_Types].xml is rejected."""
        file = tmp_path / "no_content_types.docx"
        with zipfile.ZipFile(file, "w") as zf:
            zf.writestr("word/document.xml", "<doc/>")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT
        assert "[Content_Types].xml" in result.error_message

    @pytest.mark.asyncio
    async def test_docx_zip_missing_document_xml(self, provider, tmp_path):
        """DOCX that is a valid ZIP but missing word/document.xml is rejected."""
        file = tmp_path / "no_document.docx"
        with zipfile.ZipFile(file, "w") as zf:
            zf.writestr("[Content_Types].xml", "<Types/>")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT
        assert "word/document.xml" in result.error_message

    @pytest.mark.asyncio
    async def test_pdf_missing_eof_marker(self, provider, tmp_path):
        """PDF without %%EOF marker is rejected as truncated."""
        file = tmp_path / "truncated.pdf"
        file.write_bytes(b"%PDF-1.4\n1 0 obj\n<< >>\nendobj\n")

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT
        assert "%%EOF" in result.error_message

    @pytest.mark.asyncio
    async def test_pdf_missing_objects(self, provider, tmp_path):
        """PDF without any object definitions is rejected."""
        file = tmp_path / "no_objects.pdf"
        # Has header and EOF but no objects
        content = b"%PDF-1.4\n" + b"x" * 100 + b"\n%%EOF\n"
        file.write_bytes(content)

        result = await provider.validate(file)

        assert not result.is_valid
        assert result.error_code == ValidationErrorCode.FILE_CORRUPT


class TestValidateSuccess:
    """Test that valid files pass validation."""

    @pytest.mark.asyncio
    async def test_valid_epub(self, provider, tmp_path):
        """Valid EPUB file passes all validation checks."""
        file = tmp_path / "valid.epub"
        create_minimal_epub(file)

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".epub"
        assert result.file_size_bytes > 0
        assert result.error_code is None
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_valid_docx(self, provider, tmp_path):
        """Valid DOCX file passes all validation checks."""
        file = tmp_path / "valid.docx"
        create_minimal_docx(file)

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".docx"
        assert result.file_size_bytes > 0

    @pytest.mark.asyncio
    async def test_valid_pdf(self, provider, tmp_path):
        """Valid PDF file passes all validation checks."""
        file = tmp_path / "valid.pdf"
        create_minimal_pdf(file)

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".pdf"
        assert result.file_size_bytes > 0

    @pytest.mark.asyncio
    async def test_valid_txt_utf8(self, provider, tmp_path):
        """Valid UTF-8 text file passes all validation checks."""
        file = tmp_path / "valid.txt"
        file.write_text("Hello, world! This is a valid text file.\n", encoding="utf-8")

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".txt"
        assert result.file_size_bytes > 0

    @pytest.mark.asyncio
    async def test_valid_txt_latin1(self, provider, tmp_path):
        """Latin-1 encoded text file (no null bytes) passes validation."""
        file = tmp_path / "latin1.txt"
        # Latin-1 content with accented characters (not valid UTF-8 as raw bytes)
        file.write_bytes(b"Caf\xe9 cr\xe8me\n")

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".txt"

    @pytest.mark.asyncio
    async def test_valid_epub_uppercase_extension(self, provider, tmp_path):
        """EPUB with uppercase extension is handled correctly."""
        file = tmp_path / "book.EPUB"
        create_minimal_epub(file)

        result = await provider.validate(file)

        assert result.is_valid
        assert result.detected_format == ".epub"
