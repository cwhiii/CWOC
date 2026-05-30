"""Credential service: encrypted storage and retrieval of provider credentials."""

import json
import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credentials import ProviderCredential
from app.utils.encryption import decrypt_value, encrypt_value

logger = logging.getLogger(__name__)


class CredentialService:
    """Manages encrypted provider credentials.

    Credentials are stored as encrypted JSON per provider using Fernet
    encryption with the user's ID as salt.
    """

    def __init__(self, db: AsyncSession, user_id: UUID):
        logger.debug("CredentialService initialized: user_id=%s", user_id)
        self.db = db
        self.user_id = user_id
        self._user_salt = str(user_id)

    async def store_credentials(self, provider: str, credentials: dict) -> None:
        """Encrypt and store credentials for a provider.

        Upserts: updates existing record or creates new one.
        """
        logger.info(
            "CredentialService.store_credentials: provider=%s, user_id=%s",
            provider, self.user_id,
        )

        # Serialize and encrypt
        plaintext = json.dumps(credentials)
        encrypted = encrypt_value(plaintext, self._user_salt)

        # Check for existing record
        result = await self.db.execute(
            select(ProviderCredential).where(
                ProviderCredential.user_id == self.user_id,
                ProviderCredential.provider == provider,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.credentials_encrypted = encrypted
            logger.debug("CredentialService.store_credentials: updated existing record")
        else:
            record = ProviderCredential(
                user_id=self.user_id,
                provider=provider,
                credentials_encrypted=encrypted,
            )
            self.db.add(record)
            logger.debug("CredentialService.store_credentials: created new record")

        await self.db.flush()

    async def get_credentials(self, provider: str) -> dict | None:
        """Retrieve and decrypt credentials for a provider.

        Returns None if no credentials stored for this provider.
        """
        logger.debug(
            "CredentialService.get_credentials: provider=%s, user_id=%s",
            provider, self.user_id,
        )

        result = await self.db.execute(
            select(ProviderCredential).where(
                ProviderCredential.user_id == self.user_id,
                ProviderCredential.provider == provider,
            )
        )
        record = result.scalar_one_or_none()

        if record is None:
            logger.debug("CredentialService.get_credentials: no credentials found")
            return None

        try:
            plaintext = decrypt_value(record.credentials_encrypted, self._user_salt)
            credentials = json.loads(plaintext)
            logger.debug("CredentialService.get_credentials: decrypted successfully")
            return credentials
        except Exception as e:
            logger.error(
                "CredentialService.get_credentials: decryption failed for provider=%s: %s",
                provider, e,
            )
            return None

    async def delete_credentials(self, provider: str) -> None:
        """Delete stored credentials for a provider."""
        logger.info(
            "CredentialService.delete_credentials: provider=%s, user_id=%s",
            provider, self.user_id,
        )

        await self.db.execute(
            delete(ProviderCredential).where(
                ProviderCredential.user_id == self.user_id,
                ProviderCredential.provider == provider,
            )
        )
        await self.db.flush()

    async def list_configured_providers(self) -> list[str]:
        """Return list of provider names that have stored credentials."""
        logger.debug(
            "CredentialService.list_configured_providers: user_id=%s", self.user_id
        )

        result = await self.db.execute(
            select(ProviderCredential.provider).where(
                ProviderCredential.user_id == self.user_id,
            )
        )
        providers = [row[0] for row in result.all()]
        logger.debug(
            "CredentialService.list_configured_providers: found %d providers", len(providers)
        )
        return providers
