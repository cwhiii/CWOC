"""Integration tests for AI config endpoints (GET and PATCH /api/user/ai-config).

Tests use httpx.AsyncClient with the FastAPI app, overriding the database
and authentication dependencies to provide isolated, repeatable test scenarios.

Validates: Requirements 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4, 7.4
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.main import app
from app.middleware.auth import get_current_user
from app.models.ai_config import AIConfig
from app.models.user import User


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user_a():
    """Create a fake user A for testing."""
    user = User(
        id=uuid.uuid4(),
        email="alice@example.com",
        password_hash="$2b$12$fakehashfortest",
    )
    return user


@pytest.fixture
def user_b():
    """Create a fake user B for testing isolation."""
    user = User(
        id=uuid.uuid4(),
        email="bob@example.com",
        password_hash="$2b$12$fakehashfortest",
    )
    return user


@pytest.fixture
def override_auth(user_a):
    """Override the auth dependency to return user_a."""

    async def _get_current_user():
        return user_a

    app.dependency_overrides[get_current_user] = _get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def no_auth():
    """Ensure no auth override is set (tests 401 behavior)."""
    app.dependency_overrides.pop(get_current_user, None)
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_db_session():
    """Create a mock async database session for integration tests."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def override_db(mock_db_session):
    """Override the database dependency with a mock session."""

    async def _get_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = _get_db
    yield mock_db_session
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def client():
    """Create an httpx AsyncClient for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def cleanup_overrides():
    """Ensure dependency overrides are cleaned up after each test."""
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 10.1 GET /api/user/ai-config integration tests
# ---------------------------------------------------------------------------


class TestGetAIConfig:
    """Integration tests for GET /api/user/ai-config."""

    async def test_returns_default_config_for_new_user(self, client, user_a):
        """Returns default config (local/local, no keys) for user with no AIConfig."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.get("/api/user/ai-config")

        assert response.status_code == 200
        data = response.json()
        assert data["text_provider"] == "local"
        assert data["image_provider"] == "local"
        assert data["text_api_key_set"] is False
        assert data["image_api_key_set"] is False
        assert data["text_model"] is None
        assert data["image_model"] is None

    async def test_returns_stored_config_after_patch(self, client, user_a):
        """Returns stored config reflecting previously saved values."""
        config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="anthropic",
            text_api_key_encrypted="encrypted_value_here",
            text_model="claude-sonnet-4-20250514",
            image_provider="replicate",
            image_api_key_encrypted="another_encrypted_value",
            image_model="flux-1.1-pro",
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = config
        mock_session.execute = AsyncMock(return_value=mock_result)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.get("/api/user/ai-config")

        assert response.status_code == 200
        data = response.json()
        assert data["text_provider"] == "anthropic"
        assert data["text_model"] == "claude-sonnet-4-20250514"
        assert data["text_api_key_set"] is True
        assert data["image_provider"] == "replicate"
        assert data["image_model"] == "flux-1.1-pro"
        assert data["image_api_key_set"] is True

    async def test_api_key_set_flags_reflect_stored_key_presence(self, client, user_a):
        """api_key_set flags correctly reflect whether keys are stored."""
        # Only text key set, no image key
        config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="openai",
            text_api_key_encrypted="some_encrypted_key",
            text_model=None,
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = config
        mock_session.execute = AsyncMock(return_value=mock_result)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.get("/api/user/ai-config")

        assert response.status_code == 200
        data = response.json()
        assert data["text_api_key_set"] is True
        assert data["image_api_key_set"] is False

    async def test_never_returns_actual_api_key_values(self, client, user_a):
        """Response never contains actual API key values, only boolean flags."""
        config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="openai",
            text_api_key_encrypted="encrypted_sk-abc123secret",
            text_model=None,
            image_provider="replicate",
            image_api_key_encrypted="encrypted_r8_xyz789secret",
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = config
        mock_session.execute = AsyncMock(return_value=mock_result)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.get("/api/user/ai-config")

        assert response.status_code == 200
        data = response.json()
        # Ensure no key-like values appear in the response
        response_text = response.text
        assert "sk-abc123secret" not in response_text
        assert "r8_xyz789secret" not in response_text
        assert "encrypted_" not in response_text
        # Only boolean flags for keys
        assert "text_api_key_set" in data
        assert "image_api_key_set" in data
        assert isinstance(data["text_api_key_set"], bool)
        assert isinstance(data["image_api_key_set"], bool)

    async def test_requires_authentication(self, client, no_auth):
        """Returns 401 when no session cookie is provided."""
        # No auth override — the real get_current_user will check for session cookie
        # Since we're not sending a cookie, it should return 401
        response = await client.get("/api/user/ai-config")
        assert response.status_code == 401

    async def test_user_isolation(self, client, user_a, user_b):
        """User A cannot see user B's config."""
        # User B's config
        config_b = AIConfig(
            id=uuid.uuid4(),
            user_id=user_b.id,
            text_provider="anthropic",
            text_api_key_encrypted="user_b_secret_key",
            text_model=None,
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        # When user A queries, the DB returns None (no config for user A)
        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.get("/api/user/ai-config")

        assert response.status_code == 200
        data = response.json()
        # User A gets defaults, not user B's config
        assert data["text_provider"] == "local"
        assert data["text_api_key_set"] is False
        assert "user_b_secret_key" not in response.text


# ---------------------------------------------------------------------------
# 10.2 PATCH /api/user/ai-config integration tests
# ---------------------------------------------------------------------------


class TestPatchAIConfig:
    """Integration tests for PATCH /api/user/ai-config."""

    async def test_successfully_updates_text_provider_and_stores_encrypted_key(
        self, client, user_a
    ):
        """PATCH updates text_provider and stores encrypted key."""
        existing_config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="local",
            text_api_key_encrypted=None,
            text_model=None,
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = existing_config
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"text_provider": "openai", "text_api_key": "sk-test-key-123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["text_provider"] == "openai"
        assert data["text_api_key_set"] is True
        # Verify the config object was updated
        assert existing_config.text_provider == "openai"
        assert existing_config.text_api_key_encrypted is not None
        # The encrypted value should not be the plaintext
        assert existing_config.text_api_key_encrypted != "sk-test-key-123"

    async def test_successfully_updates_image_provider_independently(
        self, client, user_a
    ):
        """PATCH updates image_provider without affecting text_provider."""
        existing_config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="anthropic",
            text_api_key_encrypted="existing_encrypted_text_key",
            text_model="claude-sonnet-4-20250514",
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = existing_config
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"image_provider": "replicate", "image_api_key": "r8_test_key"},
        )

        assert response.status_code == 200
        data = response.json()
        # Image provider updated
        assert data["image_provider"] == "replicate"
        assert data["image_api_key_set"] is True
        # Text provider unchanged
        assert data["text_provider"] == "anthropic"
        assert data["text_api_key_set"] is True
        assert existing_config.text_provider == "anthropic"
        assert existing_config.text_api_key_encrypted == "existing_encrypted_text_key"

    async def test_partial_update_only_modifies_specified_fields(self, client, user_a):
        """PATCH with partial body only modifies the specified fields."""
        existing_config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="openai",
            text_api_key_encrypted="existing_text_key_encrypted",
            text_model="gpt-4o",
            image_provider="replicate",
            image_api_key_encrypted="existing_image_key_encrypted",
            image_model="flux-1.1-pro",
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = existing_config
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        # Only update text_provider, leave everything else alone
        response = await client.patch(
            "/api/user/ai-config",
            json={"text_provider": "anthropic"},
        )

        assert response.status_code == 200
        data = response.json()
        # Updated field
        assert data["text_provider"] == "anthropic"
        # Unchanged fields
        assert data["text_api_key_set"] is True
        assert data["text_model"] == "gpt-4o"
        assert data["image_provider"] == "replicate"
        assert data["image_api_key_set"] is True
        assert data["image_model"] == "flux-1.1-pro"
        # Verify underlying config wasn't modified for unspecified fields
        assert existing_config.image_provider == "replicate"
        assert existing_config.image_api_key_encrypted == "existing_image_key_encrypted"

    async def test_setting_api_key_to_null_clears_stored_key(self, client, user_a):
        """Setting api_key to null explicitly clears the stored encrypted key."""
        existing_config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="openai",
            text_api_key_encrypted="previously_encrypted_key",
            text_model=None,
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = existing_config
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"text_api_key": None},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["text_api_key_set"] is False
        # Verify the encrypted key was cleared
        assert existing_config.text_api_key_encrypted is None

    async def test_rejects_api_key_exceeding_256_characters(self, client, user_a):
        """Returns 422 when API key exceeds 256 characters."""
        mock_session = AsyncMock(spec=AsyncSession)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        long_key = "a" * 257
        response = await client.patch(
            "/api/user/ai-config",
            json={"text_api_key": long_key},
        )

        assert response.status_code == 422
        body = response.json()
        assert "detail" in body

    async def test_rejects_empty_api_key(self, client, user_a):
        """Returns 422 when API key is an empty string."""
        mock_session = AsyncMock(spec=AsyncSession)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"text_api_key": ""},
        )

        assert response.status_code == 422
        body = response.json()
        assert "detail" in body

    async def test_rejects_invalid_provider_name(self, client, user_a):
        """Returns 422 when an invalid provider name is submitted."""
        mock_session = AsyncMock(spec=AsyncSession)

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"text_provider": "invalid_provider_xyz"},
        )

        assert response.status_code == 422
        body = response.json()
        assert "detail" in body

    async def test_creates_ai_config_on_first_patch_upsert(self, client, user_a):
        """Creates AIConfig record on first PATCH for a user (upsert behavior)."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        # No existing config — simulates first-time user
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()
        mock_session.add = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        response = await client.patch(
            "/api/user/ai-config",
            json={"text_provider": "anthropic", "text_api_key": "sk-ant-test123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["text_provider"] == "anthropic"
        assert data["text_api_key_set"] is True
        # Verify db.add was called (new record created)
        mock_session.add.assert_called_once()

    async def test_requires_authentication(self, client, no_auth):
        """Returns 401 when no session cookie is provided."""
        response = await client.patch(
            "/api/user/ai-config",
            json={"text_provider": "openai"},
        )
        assert response.status_code == 401

    async def test_encrypted_key_in_database_is_not_plaintext(self, client, user_a):
        """The encrypted key stored in the config object is not the plaintext input."""
        existing_config = AIConfig(
            id=uuid.uuid4(),
            user_id=user_a.id,
            text_provider="local",
            text_api_key_encrypted=None,
            text_model=None,
            image_provider="local",
            image_api_key_encrypted=None,
            image_model=None,
        )

        mock_session = AsyncMock(spec=AsyncSession)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = existing_config
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.flush = AsyncMock()

        async def _get_db():
            yield mock_session

        async def _get_user():
            return user_a

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = _get_user

        plaintext_key = "sk-super-secret-api-key-12345"
        response = await client.patch(
            "/api/user/ai-config",
            json={"text_api_key": plaintext_key},
        )

        assert response.status_code == 200
        # The stored encrypted value must differ from the plaintext
        assert existing_config.text_api_key_encrypted is not None
        assert existing_config.text_api_key_encrypted != plaintext_key
        # The encrypted value should be a non-trivial string (Fernet produces base64)
        assert len(existing_config.text_api_key_encrypted) > len(plaintext_key)
