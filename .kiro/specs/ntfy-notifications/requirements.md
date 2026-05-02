# Requirements Document — Ntfy Push Notifications

## Introduction

CWOC currently sends push notifications for chit alarms, start times, and due dates via the Web Push API (pywebpush). This works well on most platforms but fails on Firefox Android with self-signed certificates — a common CWOC deployment scenario. Ntfy is a lightweight, self-hosted push notification service that uses a simple HTTP POST API and has native Android/iOS apps with persistent connection ("instant delivery") support. Integrating Ntfy as an additional notification channel ensures users receive phone notifications even when the browser is closed and regardless of certificate trust issues.

The Ntfy binary is a single Go executable (~10MB) that runs as a systemd service on port 2586. It requires no pip or npm dependencies — CWOC communicates with it via Python stdlib `urllib.request` HTTP POST calls. The configurator script handles installation. For remote access, users enable Tailscale and point the Ntfy app at the Tailscale IP.

## Glossary

- **Ntfy_Service**: The self-hosted Ntfy server binary running as a systemd service on port 2586 on the CWOC host machine.
- **Ntfy_Client**: The Ntfy mobile app (Android/iOS) installed on the user's phone, subscribed to a topic on the Ntfy_Service.
- **Ntfy_Provider**: The network access provider entry in the CWOC Settings UI (Network Access block) that stores Ntfy configuration.
- **Ntfy_Sender**: The Python module (`src/backend/routes/ntfy.py`) responsible for sending HTTP POST notifications to the Ntfy_Service.
- **Topic**: A Ntfy channel identifier. Each CWOC user gets an auto-generated topic derived from their user ID (e.g., `cwoc-<user_id_prefix>`).
- **Server_URL**: The base URL of the Ntfy server. Defaults to `http://localhost:2586` for local self-hosted installs. Users may override this to point at `https://ntfy.sh` or any other Ntfy-compatible server.
- **Alert_Scheduler**: The existing background loop in `weather.py` (`_alert_push_loop`) that fires notifications when chit start/due times arrive.
- **Configurator**: The server provisioning script (`install/configurinator.sh`) that installs system dependencies and configures services.
- **Push_Script**: The local development deployment script (`cwoc-push.sh`) that syncs code to the server and restarts services.
- **Network_Access_Table**: The existing `network_access` SQLite table that stores provider configurations (currently used by Tailscale).

## Requirements

### Requirement 1: Ntfy Provider Configuration Storage

**User Story:** As an admin, I want to store Ntfy server configuration in the database, so that the backend knows where and how to send Ntfy notifications.

#### Acceptance Criteria

1. THE Ntfy_Provider SHALL store its configuration in the Network_Access_Table with provider name `"ntfy"`, reusing the existing generic CRUD endpoints in `network_access.py`.
2. WHEN an admin saves Ntfy configuration, THE Ntfy_Provider SHALL persist the Server_URL and enabled state in the `config` JSON column of the Network_Access_Table.
3. THE Ntfy_Provider SHALL default the Server_URL to `http://localhost:2586` when no Server_URL has been configured.
4. IF the admin saves an empty or whitespace-only Server_URL, THEN THE Ntfy_Provider SHALL reject the save and return an error message indicating a valid URL is required.

### Requirement 2: Per-User Topic Generation

**User Story:** As a user, I want an auto-generated Ntfy topic unique to my account, so that I only receive my own notifications on my phone.

#### Acceptance Criteria

1. THE Ntfy_Sender SHALL generate a deterministic Topic for each user by combining the prefix `cwoc-` with the first 12 characters of the user's UUID (e.g., `cwoc-a1b2c3d4e5f6`).
2. THE Ntfy_Sender SHALL use the same Topic generation logic consistently across all notification sends for a given user.
3. WHEN a user views the Ntfy settings section, THE Settings_UI SHALL display the user's auto-generated Topic so the user can subscribe to it in the Ntfy_Client.

### Requirement 3: Ntfy Notification Sending

**User Story:** As a backend service, I want to send notifications to the Ntfy server via HTTP POST, so that users receive push notifications on their phones.

#### Acceptance Criteria

1. THE Ntfy_Sender SHALL send notifications by making an HTTP POST request to `{Server_URL}/{Topic}` using Python stdlib `urllib.request` with no additional pip dependencies.
2. WHEN sending a notification, THE Ntfy_Sender SHALL include the notification title in the `X-Title` header and the notification body as the POST request body.
3. WHEN sending a notification, THE Ntfy_Sender SHALL include a `X-Tags` header with a relevant emoji tag (e.g., `alarm_clock` for alarms, `calendar` for start/due times).
4. WHEN sending a notification, THE Ntfy_Sender SHALL include a `X-Click` header containing the URL to the relevant chit editor page (e.g., `https://<host>/frontend/html/editor.html?id=<chit_id>`).
5. IF the Ntfy_Service is unreachable or returns a non-2xx status code, THEN THE Ntfy_Sender SHALL log the error and return gracefully without raising an exception.
6. THE Ntfy_Sender SHALL set a request timeout of 10 seconds to prevent blocking the Alert_Scheduler.

### Requirement 4: Alert Scheduler Integration

**User Story:** As a user, I want to receive Ntfy notifications when my chit alarms, start times, and due dates arrive, so that I get phone alerts even when my browser is closed.

#### Acceptance Criteria

1. WHEN the Alert_Scheduler detects a chit start_datetime or due_datetime within the current 60-second window, THE Alert_Scheduler SHALL send a notification via the Ntfy_Sender in addition to the existing Web Push notification.
2. WHILE the Ntfy_Provider is disabled (enabled = false) in the Network_Access_Table, THE Alert_Scheduler SHALL skip Ntfy notification sends.
3. THE Alert_Scheduler SHALL send Ntfy notifications only to the chit owner's Topic.
4. IF the Ntfy_Sender fails to deliver a notification, THEN THE Alert_Scheduler SHALL continue processing remaining chits without interruption.
5. THE Ntfy_Sender SHALL format the notification title as the chit title (or "CWOC Reminder" if the chit has no title) and the body as `"{time_label} {time_value}"` (e.g., "Starts at 3:00 PM").

### Requirement 5: Settings UI — Ntfy Provider Section

**User Story:** As an admin, I want to configure Ntfy in the Settings page alongside Tailscale, so that I can enable/disable the service and set the server URL.

#### Acceptance Criteria

1. THE Settings_UI SHALL display an Ntfy section in the Network Access block, following the same collapsible toggle-button pattern used by the Tailscale section.
2. WHEN the admin clicks the Ntfy toggle button, THE Settings_UI SHALL expand or collapse the Ntfy configuration body.
3. THE Settings_UI SHALL display a status indicator showing whether the Ntfy_Service is reachable (checking via a health endpoint or test publish).
4. THE Settings_UI SHALL provide a Server URL input field, pre-populated with the saved Server_URL or the default `http://localhost:2586`.
5. THE Settings_UI SHALL provide a "💾 Save Config" button that saves the Server_URL and enabled state to the backend via the existing `/api/network-access/ntfy` endpoint.
6. THE Settings_UI SHALL display each user's auto-generated Topic as a read-only field so the user knows which topic to subscribe to in the Ntfy_Client.
7. THE Settings_UI SHALL provide a "🔔 Test" button that sends a test notification to the current user's Topic and displays success or failure feedback.

### Requirement 6: Ntfy Status Check Endpoint

**User Story:** As an admin, I want to check whether the Ntfy service is running and reachable, so that I can troubleshoot connectivity issues.

#### Acceptance Criteria

1. THE Backend SHALL expose a `GET /api/network-access/ntfy/status` endpoint that checks Ntfy_Service reachability.
2. WHEN the status endpoint is called, THE Backend SHALL attempt an HTTP GET request to `{Server_URL}/v1/health` (the Ntfy health endpoint) and return a status of `"active"` if it responds with HTTP 200.
3. IF the Ntfy_Service is not reachable, THEN THE Backend SHALL return a status of `"unreachable"` with an error message.
4. IF no Server_URL is configured, THEN THE Backend SHALL return a status of `"not_configured"`.
5. THE status endpoint SHALL require admin access, consistent with other network access endpoints.

### Requirement 7: Test Notification Endpoint

**User Story:** As a user, I want to send a test notification from the Settings page, so that I can verify my Ntfy setup is working before relying on it for real alerts.

#### Acceptance Criteria

1. THE Backend SHALL expose a `POST /api/network-access/ntfy/test` endpoint that sends a test notification to the requesting user's Topic.
2. WHEN the test endpoint is called, THE Ntfy_Sender SHALL send a notification with the title "CWOC Test" and body "If you see this, Ntfy is working!" to the user's auto-generated Topic.
3. IF the test notification is sent successfully, THEN THE Backend SHALL return a success response with the Topic name included.
4. IF the test notification fails, THEN THE Backend SHALL return an error response with the failure reason.
5. THE test endpoint SHALL require authentication (any logged-in user, not just admin).

### Requirement 8: Configurator — Ntfy Binary Installation

**User Story:** As a server operator, I want the configurator script to install and configure the Ntfy binary, so that the Ntfy service is ready to use after provisioning.

#### Acceptance Criteria

1. THE Configurator SHALL download the Ntfy server binary from the official release URL and install it to a system-accessible path.
2. THE Configurator SHALL create a systemd service unit for Ntfy that runs the server on port 2586 with local-only listening (bound to `127.0.0.1`).
3. THE Configurator SHALL enable and start the Ntfy systemd service so it runs on boot.
4. IF the Ntfy binary is already installed, THEN THE Configurator SHALL skip the download and log that Ntfy is already present.
5. THE Configurator SHALL verify the Ntfy binary is executable after installation.

### Requirement 9: Push Script — Ntfy Service Persistence

**User Story:** As a developer, I want the `cwoc-push.sh` deployment script to ensure the Ntfy service stays running after a push, so that notifications continue working after code deployments.

#### Acceptance Criteria

1. WHEN `cwoc-push.sh` restarts the CWOC service, THE Push_Script SHALL check whether the Ntfy systemd service (`ntfy`) is installed and start it if it is not already running.
2. THE Push_Script SHALL log the Ntfy service status after the restart check, consistent with the existing Tailscale status logging pattern.
3. IF the Ntfy binary is not installed on the server, THEN THE Push_Script SHALL skip the Ntfy check silently without producing an error.

### Requirement 10: Help Page Documentation

**User Story:** As a user, I want documentation explaining how to set up Ntfy on my phone, so that I can receive push notifications without needing technical knowledge.

#### Acceptance Criteria

1. THE Help_Page SHALL include a "Ntfy Notifications" section under or near the existing "Network Access" section.
2. THE Help_Page SHALL document the complete setup flow: enabling Ntfy in Settings, finding the user's Topic, installing the Ntfy app on the phone, subscribing to the Topic with the correct Server URL, and configuring instant delivery mode.
3. THE Help_Page SHALL explain the two access modes: local-only (phone on same network, using the server's local IP and port 2586) and remote (via Tailscale IP).
4. THE Help_Page SHALL include troubleshooting guidance for common issues: Ntfy service not running, wrong server URL, topic mismatch, and notifications not arriving.

### Requirement 11: Ntfy Sender Module

**User Story:** As a developer, I want the Ntfy sending logic encapsulated in a dedicated module, so that it can be reused by the alert scheduler, test endpoint, and any future notification triggers.

#### Acceptance Criteria

1. THE Ntfy_Sender SHALL be implemented as a standalone Python module at `src/backend/routes/ntfy.py`, following the existing route module pattern.
2. THE Ntfy_Sender SHALL expose a `send_ntfy_notification(user_id, title, body, click_url=None, tags=None)` function that handles topic generation, URL construction, and HTTP POST delivery.
3. THE Ntfy_Sender SHALL expose a `get_ntfy_topic(user_id)` function that returns the deterministic Topic for a given user ID.
4. THE Ntfy_Sender SHALL read the Ntfy_Provider configuration (Server_URL, enabled state) from the Network_Access_Table on each send, so that configuration changes take effect immediately without server restart.
5. IF the Ntfy_Provider is not configured or is disabled, THEN the `send_ntfy_notification` function SHALL return immediately with a descriptive skip reason and not attempt any HTTP request.
