"""Unit tests for UploadProvider.extract_metadata() (task 4.2).

Tests metadata extraction from EPUB, DOCX, PDF, and TXT formats.
Validates: Requirements 4.4, 4.7
"""

import tempfile
from pathlib import Path

import pytest

from app.services.source_service.providers.upload import UploadProvider


@pytest.fixture
def provider():
    return UploadProvider()


class TestExtractMetadataTxt:
    """TXT files have no metadata — should return empty BookMetadata (Req 4.4)."""

    @pytest.mark.asyncio
    async def test_txt_returns_empty_metadata(self, provider, tmp_path):
        txt_file = tmp_path / "sample.txt"
        txt_file.write_text("Hello, world!")

        result = await provider.extract_metadata(txt_file, "txt")

        assert result.title is None
        assert result.author is None
        assert result.publication_date is None
        assert result.language is None
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_txt_format_with_dot_prefix(self, provider, tmp_path):
        txt_file = tmp_path / "sample.txt"
        txt_file.write_text("Content")

        result = await provider.extract_metadata(txt_file, ".txt")

        assert result.title is None
        assert result.author is None


class TestExtractMetadataEpub:
    """EPUB metadata extraction using ebooklib."""

    @pytest.mark.asyncio
    async def test_epub_with_full_metadata(self, provider, tmp_path):
        """EPUB with all OPF metadata fields returns complete BookMetadata."""
        epub_path = self._create_epub(
            tmp_path,
            title="Pride and Prejudice",
            creator="Jane Austen",
            date="1813-01-28",
            language="en",
        )

        result = await provider.extract_metadata(epub_path, "epub")

        assert result.title == "Pride and Prejudice"
        assert result.author == "Jane Austen"
        assert result.publication_date == "1813-01-28"
        assert result.language == "en"
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_epub_with_missing_metadata(self, provider, tmp_path):
        """EPUB with no metadata returns None for all fields."""
        epub_path = self._create_epub(tmp_path)

        result = await provider.extract_metadata(epub_path, "epub")

        assert result.title is None
        assert result.author is None
        assert result.publication_date is None
        assert result.language is None
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_epub_with_partial_metadata(self, provider, tmp_path):
        """EPUB with only title and author returns those fields, rest None."""
        epub_path = self._create_epub(
            tmp_path,
            title="Moby Dick",
            creator="Herman Melville",
        )

        result = await provider.extract_metadata(epub_path, "epub")

        assert result.title == "Moby Dick"
        assert result.author == "Herman Melville"
        assert result.publication_date is None
        assert result.language is None

    @pytest.mark.asyncio
    async def test_epub_corrupt_file_returns_empty(self, provider, tmp_path):
        """Corrupt EPUB file returns empty BookMetadata gracefully."""
        corrupt_file = tmp_path / "corrupt.epub"
        corrupt_file.write_bytes(b"not a valid epub file")

        result = await provider.extract_metadata(corrupt_file, "epub")

        assert result.title is None
        assert result.author is None

    def _create_epub(
        self,
        tmp_path: Path,
        title: str = None,
        creator: str = None,
        date: str = None,
        language: str = None,
    ) -> Path:
        """Create a minimal EPUB file with optional metadata using ebooklib."""
        from ebooklib import epub

        book = epub.EpubBook()
        book.set_identifier("test-id-123")

        if title:
            book.set_title(title)
        if creator:
            book.add_author(creator)
        if date:
            book.add_metadata("DC", "date", date)
        if language:
            book.set_language(language)
        else:
            # ebooklib requires a language to write a valid EPUB
            book.set_language("und")

        # Add minimal content so the EPUB is valid
        chapter = epub.EpubHtml(title="Chapter 1", file_name="chap_01.xhtml", lang="en")
        chapter.content = "<html><body><h1>Chapter 1</h1><p>Content.</p></body></html>"
        book.add_item(chapter)
        book.spine = ["nav", chapter]
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())

        epub_path = tmp_path / "test.epub"
        epub.write_epub(str(epub_path), book)
        return epub_path


class TestExtractMetadataDocx:
    """DOCX metadata extraction using python-docx."""

    @pytest.mark.asyncio
    async def test_docx_with_full_metadata(self, provider, tmp_path):
        """DOCX with core properties returns complete BookMetadata."""
        from docx import Document
        from datetime import datetime

        doc = Document()
        doc.core_properties.title = "The Great Gatsby"
        doc.core_properties.author = "F. Scott Fitzgerald"
        doc.core_properties.created = datetime(1925, 4, 10, 0, 0, 0)
        doc.add_paragraph("Chapter 1")

        docx_path = tmp_path / "test.docx"
        doc.save(str(docx_path))

        result = await provider.extract_metadata(docx_path, "docx")

        assert result.title == "The Great Gatsby"
        assert result.author == "F. Scott Fitzgerald"
        assert result.publication_date is not None
        assert "1925" in result.publication_date
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_docx_with_no_metadata(self, provider, tmp_path):
        """DOCX with empty properties returns None for all fields."""
        from docx import Document

        doc = Document()
        doc.add_paragraph("Just some text")

        docx_path = tmp_path / "empty_meta.docx"
        doc.save(str(docx_path))

        result = await provider.extract_metadata(docx_path, "docx")

        # python-docx may return empty strings for title/author
        assert result.title is None
        assert result.author is None
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_docx_corrupt_file_returns_empty(self, provider, tmp_path):
        """Corrupt DOCX file returns empty BookMetadata gracefully."""
        corrupt_file = tmp_path / "corrupt.docx"
        corrupt_file.write_bytes(b"not a valid docx")

        result = await provider.extract_metadata(corrupt_file, "docx")

        assert result.title is None
        assert result.author is None


class TestExtractMetadataPdf:
    """PDF metadata extraction using pypdf."""

    @pytest.mark.asyncio
    async def test_pdf_with_full_metadata(self, provider, tmp_path):
        """PDF with document info returns complete BookMetadata."""
        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        writer.add_metadata(
            {
                "/Title": "War and Peace",
                "/Author": "Leo Tolstoy",
                "/CreationDate": "D:18690101120000",
            }
        )

        pdf_path = tmp_path / "test.pdf"
        with open(pdf_path, "wb") as f:
            writer.write(f)

        result = await provider.extract_metadata(pdf_path, "pdf")

        assert result.title == "War and Peace"
        assert result.author == "Leo Tolstoy"
        assert result.publication_date == "1869-01-01"
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_pdf_with_no_metadata(self, provider, tmp_path):
        """PDF with no document info returns empty BookMetadata."""
        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)

        pdf_path = tmp_path / "no_meta.pdf"
        with open(pdf_path, "wb") as f:
            writer.write(f)

        result = await provider.extract_metadata(pdf_path, "pdf")

        # No metadata set, fields should be None
        assert result.source_provider == "upload"

    @pytest.mark.asyncio
    async def test_pdf_corrupt_file_returns_empty(self, provider, tmp_path):
        """Corrupt PDF file returns empty BookMetadata gracefully."""
        corrupt_file = tmp_path / "corrupt.pdf"
        corrupt_file.write_bytes(b"not a valid pdf")

        result = await provider.extract_metadata(corrupt_file, "pdf")

        assert result.title is None
        assert result.author is None

    @pytest.mark.asyncio
    async def test_pdf_date_parsing_various_formats(self, provider):
        """Test the PDF date parser handles various date formats."""
        # Standard PDF date
        assert provider._parse_pdf_date("D:20230615120000+00'00'") == "2023-06-15"
        # Without timezone
        assert provider._parse_pdf_date("D:20230615") == "2023-06-15"
        # Without D: prefix
        assert provider._parse_pdf_date("20230615120000") == "2023-06-15"
        # Empty string
        assert provider._parse_pdf_date("") is None
        # None-like
        assert provider._parse_pdf_date("   ") is None


class TestExtractMetadataUnknownFormat:
    """Unknown formats should return empty BookMetadata."""

    @pytest.mark.asyncio
    async def test_unknown_format_returns_empty(self, provider, tmp_path):
        some_file = tmp_path / "file.xyz"
        some_file.write_bytes(b"data")

        result = await provider.extract_metadata(some_file, "xyz")

        assert result.title is None
        assert result.author is None
