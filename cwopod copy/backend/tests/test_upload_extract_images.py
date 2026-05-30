"""Unit tests for UploadProvider.extract_images() method."""

import tempfile
from pathlib import Path

import pytest
from ebooklib import epub

from app.services.source_service.providers.upload import UploadProvider


def _create_test_epub(images: list[dict], include_in_spine: bool = True) -> Path:
    """Create a minimal EPUB file with the specified images for testing.

    Args:
        images: List of dicts with keys: filename, content_type, data, referenced_in_html
        include_in_spine: Whether to include HTML documents referencing images in the spine.

    Returns:
        Path to the created EPUB file.
    """
    book = epub.EpubBook()
    book.set_identifier("test-book-001")
    book.set_title("Test Book")
    book.set_language("en")
    book.add_author("Test Author")

    # Add a basic chapter
    chapter = epub.EpubHtml(title="Chapter 1", file_name="text/chapter1.xhtml", lang="en")

    # Build HTML content with image references
    img_tags = ""
    for img_info in images:
        if img_info.get("referenced_in_html", True):
            img_tags += f'<img src="../images/{img_info["filename"]}" alt="test image"/>\n'

    chapter.content = f"""<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
<h1>Chapter 1</h1>
<p>Some text content.</p>
{img_tags}
</body>
</html>""".encode("utf-8")

    book.add_item(chapter)

    # Add images to the EPUB
    for img_info in images:
        img_item = epub.EpubImage()
        img_item.file_name = f"images/{img_info['filename']}"
        img_item.media_type = img_info["content_type"]
        img_item.content = img_info["data"]
        book.add_item(img_item)

    # Set up spine and TOC
    book.spine = ["nav", chapter]
    book.toc = [epub.Link("text/chapter1.xhtml", "Chapter 1", "ch1")]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    # Write to a temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".epub", delete=False)
    epub.write_epub(tmp.name, book)
    return Path(tmp.name)


@pytest.fixture
def provider():
    return UploadProvider()


@pytest.mark.asyncio
async def test_extract_images_with_multiple_images(provider):
    """Test extracting multiple images from an EPUB."""
    images_data = [
        {
            "filename": "cover.png",
            "content_type": "image/png",
            "data": b"\x89PNG\r\n\x1a\n" + b"\x00" * 100,
            "referenced_in_html": True,
        },
        {
            "filename": "figure1.jpeg",
            "content_type": "image/jpeg",
            "data": b"\xff\xd8\xff\xe0" + b"\x00" * 200,
            "referenced_in_html": True,
        },
        {
            "filename": "diagram.svg",
            "content_type": "image/svg+xml",
            "data": b"<svg></svg>",
            "referenced_in_html": True,
        },
    ]

    epub_path = _create_test_epub(images_data)
    try:
        result = await provider.extract_images(epub_path)

        assert len(result) == 3

        # Verify each image has correct attributes
        filenames = {img.filename for img in result}
        assert "cover.png" in filenames
        assert "figure1.jpeg" in filenames
        assert "diagram.svg" in filenames

        for img in result:
            assert img.content_type != ""
            assert len(img.data) > 0
    finally:
        epub_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_images_empty_epub(provider):
    """Test extracting images from an EPUB with no images returns empty list."""
    epub_path = _create_test_epub([])
    try:
        result = await provider.extract_images(epub_path)
        assert result == []
    finally:
        epub_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_images_preserves_binary_data(provider):
    """Test that image binary data is preserved exactly."""
    original_data = b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 4
    images_data = [
        {
            "filename": "test.png",
            "content_type": "image/png",
            "data": original_data,
            "referenced_in_html": True,
        },
    ]

    epub_path = _create_test_epub(images_data)
    try:
        result = await provider.extract_images(epub_path)

        assert len(result) == 1
        assert result[0].data == original_data
        assert result[0].filename == "test.png"
        assert result[0].content_type == "image/png"
    finally:
        epub_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_images_placement_reference(provider):
    """Test that images referenced in HTML get a placement reference."""
    images_data = [
        {
            "filename": "fig1.png",
            "content_type": "image/png",
            "data": b"\x89PNG" + b"\x00" * 50,
            "referenced_in_html": True,
        },
    ]

    epub_path = _create_test_epub(images_data)
    try:
        result = await provider.extract_images(epub_path)

        assert len(result) == 1
        # The image is referenced in Chapter 1's HTML, so it should have a placement ref
        assert result[0].placement_ref is not None
        assert result[0].placement_ref != ""
    finally:
        epub_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_images_unreferenced_image(provider):
    """Test that images not referenced in any HTML have None placement."""
    images_data = [
        {
            "filename": "orphan.png",
            "content_type": "image/png",
            "data": b"\x89PNG" + b"\x00" * 50,
            "referenced_in_html": False,
        },
    ]

    epub_path = _create_test_epub(images_data)
    try:
        result = await provider.extract_images(epub_path)

        assert len(result) == 1
        assert result[0].filename == "orphan.png"
        # Not referenced in any spine document, so placement_ref should be None
        assert result[0].placement_ref is None
    finally:
        epub_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_images_content_types(provider):
    """Test that various image content types are correctly preserved."""
    images_data = [
        {
            "filename": "photo.jpeg",
            "content_type": "image/jpeg",
            "data": b"\xff\xd8\xff" + b"\x00" * 50,
            "referenced_in_html": True,
        },
        {
            "filename": "icon.gif",
            "content_type": "image/gif",
            "data": b"GIF89a" + b"\x00" * 50,
            "referenced_in_html": True,
        },
    ]

    epub_path = _create_test_epub(images_data)
    try:
        result = await provider.extract_images(epub_path)

        content_types = {img.content_type for img in result}
        assert "image/jpeg" in content_types
        assert "image/gif" in content_types
    finally:
        epub_path.unlink(missing_ok=True)
