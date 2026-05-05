"""DataUpdateCoordinator for CWOC integration."""
import logging
from datetime import timedelta

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)
from homeassistant.exceptions import ConfigEntryAuthFailed

from .const import DOMAIN, DEFAULT_SCAN_INTERVAL

_LOGGER = logging.getLogger(__name__)


class CwocDataUpdateCoordinator(DataUpdateCoordinator):
    """Coordinator to poll CWOC stats API."""

    def __init__(self, hass: HomeAssistant, entry) -> None:
        """Initialize the coordinator."""
        self.cwoc_url = entry.data["cwoc_url"].rstrip("/")
        self.session_token = entry.data.get("session_token", "")
        self.username = entry.data.get("username", "")
        self.password = entry.data.get("password", "")

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL),
        )

    async def _async_update_data(self) -> dict:
        """Fetch stats from CWOC API.

        Returns the stats dict on success.
        Raises ConfigEntryAuthFailed on 401.
        Raises UpdateFailed on connection errors.
        """
        url = f"{self.cwoc_url}/api/ha/stats"
        headers = {}

        # Use session token for auth (Bearer token)
        if self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 401:
                        # Try to re-authenticate
                        new_token = await self._re_authenticate()
                        if new_token:
                            self.session_token = new_token
                            # Retry with new token
                            headers["Authorization"] = f"Bearer {new_token}"
                            async with session.get(
                                url,
                                headers=headers,
                                timeout=aiohttp.ClientTimeout(total=15),
                            ) as retry_resp:
                                if retry_resp.status == 401:
                                    raise ConfigEntryAuthFailed(
                                        "Authentication failed — please reconfigure"
                                    )
                                if retry_resp.status != 200:
                                    raise UpdateFailed(
                                        f"CWOC returned status {retry_resp.status}"
                                    )
                                return await retry_resp.json()
                        else:
                            raise ConfigEntryAuthFailed(
                                "Authentication failed — please reconfigure"
                            )

                    if resp.status != 200:
                        raise UpdateFailed(
                            f"CWOC returned status {resp.status}"
                        )

                    return await resp.json()

        except ConfigEntryAuthFailed:
            raise
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Cannot connect to CWOC: {err}") from err
        except Exception as err:
            raise UpdateFailed(f"Error fetching CWOC stats: {err}") from err

    async def _re_authenticate(self) -> str | None:
        """Re-authenticate with stored credentials. Returns new token or None."""
        if not self.username or not self.password:
            return None

        url = f"{self.cwoc_url}/api/auth/login"
        payload = {"username": self.username, "password": self.password}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("token") or data.get("session_token")
        except Exception:
            pass

        return None
