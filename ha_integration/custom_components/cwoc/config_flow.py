"""Config flow for CWOC integration."""
import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_PASSWORD, CONF_URL, CONF_USERNAME
from homeassistant.core import callback

from .const import DOMAIN


class CwocConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for CWOC."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step — user enters CWOC URL and credentials."""
        errors = {}

        if user_input is not None:
            cwoc_url = user_input["cwoc_url"].rstrip("/")
            username = user_input["username"]
            password = user_input["password"]

            # Try to authenticate against CWOC
            try:
                session_token = await self._test_credentials(cwoc_url, username, password)
                if session_token:
                    # Check if already configured
                    await self.async_set_unique_id(cwoc_url)
                    self._abort_if_unique_id_configured()

                    return self.async_create_entry(
                        title=f"CWOC ({cwoc_url})",
                        data={
                            "cwoc_url": cwoc_url,
                            "username": username,
                            "password": password,
                            "session_token": session_token,
                        },
                    )
                else:
                    errors["base"] = "invalid_auth"
            except aiohttp.ClientError:
                errors["base"] = "cannot_connect"
            except Exception:
                errors["base"] = "cannot_connect"

        # Show the form
        data_schema = vol.Schema({
            vol.Required("cwoc_url", default="http://192.168.1.111:3333"): str,
            vol.Required("username"): str,
            vol.Required("password"): str,
        })

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )

    async def _test_credentials(self, cwoc_url, username, password):
        """Test credentials by POSTing to CWOC login endpoint.

        Returns session token on success, None on auth failure.
        Raises aiohttp.ClientError on connection failure.
        """
        url = f"{cwoc_url}/api/auth/login"
        payload = {"username": username, "password": password}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("token") or data.get("session_token")
                elif resp.status == 401:
                    return None
                else:
                    return None

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return CwocOptionsFlow(config_entry)


class CwocOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for CWOC (reconfiguration)."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        errors = {}

        if user_input is not None:
            cwoc_url = user_input.get("cwoc_url", "").rstrip("/")
            username = user_input.get("username", "")
            password = user_input.get("password", "")

            # Validate new credentials
            try:
                flow = CwocConfigFlow()
                flow.hass = self.hass
                session_token = await flow._test_credentials(cwoc_url, username, password)
                if session_token:
                    # Update the config entry
                    self.hass.config_entries.async_update_entry(
                        self.config_entry,
                        data={
                            "cwoc_url": cwoc_url,
                            "username": username,
                            "password": password,
                            "session_token": session_token,
                        },
                    )
                    return self.async_create_entry(title="", data={})
                else:
                    errors["base"] = "invalid_auth"
            except Exception:
                errors["base"] = "cannot_connect"

        # Pre-fill with current values
        current = self.config_entry.data
        data_schema = vol.Schema({
            vol.Required("cwoc_url", default=current.get("cwoc_url", "")): str,
            vol.Required("username", default=current.get("username", "")): str,
            vol.Required("password", default=current.get("password", "")): str,
        })

        return self.async_show_form(
            step_id="init",
            data_schema=data_schema,
            errors=errors,
        )
