"""Unit tests for illustrations file storage utilities (task 7.1).

Tests path construction, directory creation, and file copy operations.
"""

import uuid
from pathlib import Path

import pytest

from app.services.illustrations.storage import (
    copy_image_to_project,
    ensure_image_directory,
    get_project_image_path,
    get_shared_image_path,
)


class TestGetProjectImagePath:
    """Test project image path construction."""

    def test_basic_path_construction(self, tmp_path):
        """Path follows {storage_path}/{project_id}/images/{uuid}.{ext} format."""
        project_id = uuid.uuid4()
        image_uuid = uuid.uuid4()

        result = get_project_image_path(tmp_path, project_id, image_uuid, "png")

        assert result == tmp_path / str(project_id) / "images" / f"{image_uuid}.png"

    def test_string_ids(self, tmp_path):
        """Accepts string IDs as well as UUID objects."""
        result = get_project_image_path(tmp_path, "proj-123", "img-456", "jpg")

        assert result == tmp_path / "proj-123" / "images" / "img-456.jpg"

    def test_strips_leading_dot_from_extension(self, tmp_path):
        """Extension with leading dot is normalized."""
        image_uuid = uuid.uuid4()

        result = get_project_image_path(tmp_path, "proj", image_uuid, ".webp")

        assert result.name == f"{image_uuid}.webp"

    def test_webp_extension(self, tmp_path):
        """WEBP extension is handled correctly."""
        project_id = uuid.uuid4()
        image_uuid = uuid.uuid4()

        result = get_project_image_path(tmp_path, project_id, image_uuid, "webp")

        assert result.suffix == ".webp"

    def test_string_storage_path(self):
        """Accepts string storage path."""
        result = get_project_image_path("/data/storage", "proj-1", "img-1", "png")

        assert result == Path("/data/storage/proj-1/images/img-1.png")


class TestGetSharedImagePath:
    """Test shared pool image path construction."""

    def test_basic_path_construction(self, tmp_path):
        """Path follows {storage_path}/shared/{user_id}/images/{uuid}.{ext} format."""
        user_id = uuid.uuid4()
        image_uuid = uuid.uuid4()

        result = get_shared_image_path(tmp_path, user_id, image_uuid, "png")

        assert result == tmp_path / "shared" / str(user_id) / "images" / f"{image_uuid}.png"

    def test_string_ids(self, tmp_path):
        """Accepts string IDs as well as UUID objects."""
        result = get_shared_image_path(tmp_path, "user-789", "img-abc", "jpg")

        assert result == tmp_path / "shared" / "user-789" / "images" / "img-abc.jpg"

    def test_strips_leading_dot_from_extension(self, tmp_path):
        """Extension with leading dot is normalized."""
        image_uuid = uuid.uuid4()

        result = get_shared_image_path(tmp_path, "user-1", image_uuid, ".png")

        assert result.name == f"{image_uuid}.png"

    def test_string_storage_path(self):
        """Accepts string storage path."""
        result = get_shared_image_path("/data/storage", "user-1", "img-1", "webp")

        assert result == Path("/data/storage/shared/user-1/images/img-1.webp")


class TestEnsureImageDirectory:
    """Test directory creation utility."""

    def test_creates_missing_directory(self, tmp_path):
        """Creates the parent directory when it does not exist."""
        image_path = tmp_path / "project-1" / "images" / "test.png"

        ensure_image_directory(image_path)

        assert image_path.parent.exists()
        assert image_path.parent.is_dir()

    def test_creates_nested_directories(self, tmp_path):
        """Creates multiple levels of missing directories."""
        image_path = tmp_path / "shared" / "user-1" / "images" / "test.jpg"

        ensure_image_directory(image_path)

        assert image_path.parent.exists()

    def test_no_error_if_directory_exists(self, tmp_path):
        """Does not raise if the directory already exists."""
        image_path = tmp_path / "existing" / "test.png"
        image_path.parent.mkdir(parents=True)

        # Should not raise
        ensure_image_directory(image_path)

        assert image_path.parent.exists()


class TestCopyImageToProject:
    """Test file copy from shared pool to project."""

    def test_copies_file_successfully(self, tmp_path):
        """Copies file content from source to destination."""
        # Setup source
        shared_dir = tmp_path / "shared" / "user-1" / "images"
        shared_dir.mkdir(parents=True)
        source = shared_dir / "img.png"
        source.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        # Destination (directory does not exist yet)
        dest = tmp_path / "project-1" / "images" / "img.png"

        copy_image_to_project(source, dest)

        assert dest.exists()
        assert dest.read_bytes() == source.read_bytes()

    def test_creates_destination_directory(self, tmp_path):
        """Creates the destination directory if it does not exist."""
        shared_dir = tmp_path / "shared" / "user-1" / "images"
        shared_dir.mkdir(parents=True)
        source = shared_dir / "photo.jpg"
        source.write_bytes(b"\xff\xd8\xff" + b"\x00" * 50)

        dest = tmp_path / "new-project" / "images" / "photo.jpg"

        copy_image_to_project(source, dest)

        assert dest.parent.exists()
        assert dest.exists()

    def test_raises_if_source_missing(self, tmp_path):
        """Raises FileNotFoundError when source does not exist."""
        source = tmp_path / "nonexistent" / "img.png"
        dest = tmp_path / "project" / "images" / "img.png"

        with pytest.raises(FileNotFoundError):
            copy_image_to_project(source, dest)

    def test_preserves_file_metadata(self, tmp_path):
        """Uses shutil.copy2 which preserves file metadata."""
        shared_dir = tmp_path / "shared" / "images"
        shared_dir.mkdir(parents=True)
        source = shared_dir / "test.webp"
        source.write_bytes(b"RIFF" + b"\x00" * 80)

        dest = tmp_path / "project" / "images" / "test.webp"

        copy_image_to_project(source, dest)

        # File sizes should match
        assert dest.stat().st_size == source.stat().st_size
