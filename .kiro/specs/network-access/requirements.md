# Requirements Document

## Introduction

This feature adds a "Network Access" administration block to the CWOC settings page, providing a centralized place for configuring external network access and hole-punching solutions. The initial implementation focuses on Tailscale — a WireGuard-based mesh VPN that enables secure remote access to the CWOC instance without port forwarding or public IP addresses. The architecture is designed to be extensible so that future network access providers (e.g., Cloudflare Tunnel, ZeroTier, ngrok) can be added alongside Tailscale without restructuring.

The feature spans three layers: a frontend settings UI block for configuring Tailscale, backend API endpoints for managing network access provider configuration, a database table for persisting provider settings, and a configurinator.sh integration that installs and configures Tailscale during server provisioning or upgrade.

## Glossary

- **Settings_Page**: The CWOC settings page (`settings.html`) where per-user and admin-level preferences are configured.
- **Network_Access_Block**: The new admin-level settings group on the Settings_Page that contains configuration for all network access providers.
- **Network_Provider**: A generic term for any external network access/hole-punching service (Tailscale, Cloudflare Tunnel, ZeroTier, etc.). Only Tailscale is implemented now, but the data model supports multiple providers.
- **Tailscale_Block**: The UI sub-section within the Network_Access_Block for configuring Tailscale specifically.
- **Tailscale_Auth_Key**: A pre-authentication key from the Tailscale admin console used to register a node on a tailnet without interactive login.
- **Tailscale_Status**: The current operational state of the Tailscale service on the server, one of: `not_installed`, `installed_inactive`, `active`, `error`.
- **Configurinator**: The server provisioning/upgrade script (`install/configurinator.sh`) that installs system packages, deploys code, and configures services.
- **Backend**: The FastAPI Python backend (`src/backend/`) that serves the API and frontend files.
- **Network_Access_Table**: The SQLite database table that stores configuration for all network access providers.
- **Admin_User**: A user with `is_admin = true` in the users table, who has permission to modify network access settings.

## Requirements

### Requirement 1: Network Access Database Schema

**User Story:** As a system administrator, I want network access provider configurations stored persistently, so that settings survive server restarts and upgrades.

#### Acceptance Criteria

1. THE Backend SHALL create a `network_access` database table with columns for `id` (TEXT PRIMARY KEY), `provider` (TEXT NOT NULL), `enabled` (BOOLEAN DEFAULT 0), `config` (TEXT for JSON), `created_datetime` (TEXT), and `modified_datetime` (TEXT).
2. THE Backend SHALL create the `network_access` table via a migration function in `migrations.py` that checks for table existence before creating it.
3. THE `config` column SHALL store a JSON object whose schema varies by provider, allowing each Network_Provider to define its own configuration fields.
4. THE Backend SHALL enforce that only one row exists per `provider` value in the Network_Access_Table.

### Requirement 2: Network Access API Endpoints

**User Story:** As a system administrator, I want API endpoints for reading and updating network access configurations, so that the frontend can manage provider settings.

#### Acceptance Criteria

1. THE Backend SHALL provide a `GET /api/network-access` endpoint that returns all rows from the Network_Access_Table as a JSON array.
2. THE Backend SHALL provide a `GET /api/network-access/{provider}` endpoint that returns the configuration for a single Network_Provider.
3. WHEN a provider has no saved configuration, THE `GET /api/network-access/{provider}` endpoint SHALL return a default object with `provider` set, `enabled` set to `false`, and `config` set to an empty object.
4. THE Backend SHALL provide a `POST /api/network-access/{provider}` endpoint that creates or updates the configuration for a Network_Provider.
5. THE Backend SHALL restrict all network access API endpoints to Admin_User accounts only.
6. IF a non-admin user calls any network access endpoint, THEN THE Backend SHALL return a 403 Forbidden response.
7. THE Backend SHALL log network access configuration changes to the audit log, consistent with existing settings audit behavior.

### Requirement 3: Tailscale Status Endpoint

**User Story:** As a system administrator, I want to check the current status of Tailscale on the server, so that I can see whether it is installed, running, and connected.

#### Acceptance Criteria

1. THE Backend SHALL provide a `GET /api/network-access/tailscale/status` endpoint that returns the current Tailscale_Status.
2. WHEN Tailscale is not installed on the server, THE status endpoint SHALL return `not_installed`.
3. WHEN Tailscale is installed but the service is not running, THE status endpoint SHALL return `installed_inactive`.
4. WHEN Tailscale is installed and the service is running and connected, THE status endpoint SHALL return `active` along with the Tailscale IP address and hostname.
5. IF an error occurs while checking Tailscale status, THEN THE status endpoint SHALL return `error` with a descriptive message.
6. THE status endpoint SHALL be restricted to Admin_User accounts only.

### Requirement 4: Network Access Settings UI Block

**User Story:** As a system administrator, I want a "Network Access" section on the settings page, so that I can configure external access providers from the CWOC interface.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a new setting group titled "🌐 Network Access" in the settings grid.
2. THE Network_Access_Block SHALL only be visible to Admin_User accounts.
3. WHEN a non-admin user loads the Settings_Page, THE Network_Access_Block SHALL be hidden.
4. THE Network_Access_Block SHALL contain a Tailscale_Block sub-section as its first provider entry.
5. THE Network_Access_Block SHALL use the existing `setting-group` CSS class and visual style, consistent with other settings blocks on the page.

### Requirement 5: Tailscale Configuration UI

**User Story:** As a system administrator, I want to configure Tailscale from the settings page, so that I can enable remote access without SSH-ing into the server.

#### Acceptance Criteria

1. THE Tailscale_Block SHALL display the current Tailscale_Status with a visual indicator (icon and text label) showing one of: "Not Installed", "Inactive", "Connected", or "Error".
2. THE Tailscale_Block SHALL include a text input field for the Tailscale_Auth_Key, with the value masked by default and a toggle to reveal it.
3. THE Tailscale_Block SHALL include an "Enable / Disable" toggle that controls whether Tailscale should be active.
4. WHEN the Tailscale_Status is `active`, THE Tailscale_Block SHALL display the Tailscale IP address and hostname.
5. WHEN the admin saves Tailscale configuration, THE Settings_Page SHALL send the configuration to the `POST /api/network-access/tailscale` endpoint.
6. THE Tailscale_Block SHALL include a "Refresh Status" button that re-fetches the current Tailscale_Status from the status endpoint.
7. IF the Tailscale_Status is `error`, THEN THE Tailscale_Block SHALL display the error message returned by the status endpoint.

### Requirement 6: Configurinator Tailscale Integration

**User Story:** As a system administrator, I want the configurinator script to install and configure Tailscale during server provisioning or upgrade, so that Tailscale is ready to use after deployment.

#### Acceptance Criteria

1. THE Configurinator SHALL include a new phase function for installing Tailscale that installs the Tailscale package using the official Tailscale package repository setup script.
2. THE Configurinator Tailscale phase SHALL check whether Tailscale is already installed before attempting installation, making the phase idempotent.
3. THE Configurinator Tailscale phase SHALL be called during both fresh provisioning and upgrade flows.
4. THE Configurinator Tailscale phase SHALL log progress using the existing `log_step`, `log_ok`, `log_warn`, and `log_error` helper functions.
5. IF Tailscale installation fails, THEN THE Configurinator SHALL log a warning and continue with the remaining provisioning steps rather than aborting the entire install.
6. THE Configurinator SHALL NOT attempt to authenticate or start the Tailscale service — authentication is handled via the settings UI using the auth key.

### Requirement 7: Tailscale Service Control via API

**User Story:** As a system administrator, I want the backend to be able to start and stop the Tailscale service using the saved auth key, so that I can control Tailscale from the settings page.

#### Acceptance Criteria

1. THE Backend SHALL provide a `POST /api/network-access/tailscale/up` endpoint that starts the Tailscale service using the saved Tailscale_Auth_Key from the Network_Access_Table.
2. THE Backend SHALL provide a `POST /api/network-access/tailscale/down` endpoint that stops the Tailscale service.
3. WHEN the `tailscale/up` endpoint is called and no auth key is saved, THE Backend SHALL return a 400 error with a descriptive message.
4. THE `tailscale/up` endpoint SHALL execute `tailscale up --authkey=<key>` as a subprocess and return the result.
5. THE `tailscale/down` endpoint SHALL execute `tailscale down` as a subprocess and return the result.
6. IF the Tailscale command execution fails, THEN THE Backend SHALL return the error output in the response body with a 500 status code.
7. THE `tailscale/up` and `tailscale/down` endpoints SHALL be restricted to Admin_User accounts only.
8. THE Backend SHALL log Tailscale service control actions to the audit log.

### Requirement 8: Extensible Provider Architecture

**User Story:** As a developer, I want the network access system designed for multiple providers, so that adding future providers (Cloudflare Tunnel, ZeroTier, etc.) requires minimal restructuring.

#### Acceptance Criteria

1. THE Network_Access_Table SHALL use the `provider` column as a discriminator, allowing multiple provider rows with different configuration schemas.
2. THE `GET /api/network-access` endpoint SHALL return all configured providers, enabling the frontend to render multiple provider blocks.
3. THE Network_Access_Block UI SHALL be structured so that each provider is a distinct sub-section, allowing new provider sub-sections to be added alongside the Tailscale_Block.
4. THE Backend route module for network access SHALL be a separate file (`routes/network_access.py`) to keep provider logic isolated from existing settings routes.
5. THE Configurinator SHALL structure its Tailscale phase as a standalone function that can be called independently, so future provider install functions follow the same pattern.
