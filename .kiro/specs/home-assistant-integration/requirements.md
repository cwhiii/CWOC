# Requirements Document

## Introduction

Full, first-class Home Assistant custom integration for CWOC. This feature spans two codebases working together:

1. **CWOC Backend** (Python/FastAPI) — new stats API endpoint, auth support for HA config flow, rules engine extensions (`call_ha_service`, `fire_ha_event`), HA state polling trigger, webhook endpoint, HA config storage, and database migration.
2. **HA Custom Integration** (Python package at `ha_integration/custom_components/cwoc/`) — a proper Home Assistant custom component that provides a config flow, sensors, services, events, and a DataUpdateCoordinator. Deployed to HA by copying the folder to HA's `config/custom_components/cwoc/`.

The result: CWOC shows up as a proper integration in HA's Settings → Integrations panel. Users configure it via the HA UI (enter CWOC URL + credentials), get live sensors on dashboards ("5 todo chits"), call CWOC services from HA automations (`cwoc.create_chit`, `cwoc.set_chit_status`, etc.), and receive CWOC events on the HA event bus (`cwoc_chit_created`, `cwoc_status_changed`, etc.) for automation triggers.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the host application (FastAPI backend at `http://192.168.1.111:3333`)
- **Home_Assistant**: The open-source home automation platform running on the user's network
- **HA_Custom_Integration**: A Python package installed in HA's `custom_components/cwoc/` directory that registers CWOC as a native HA integration
- **Config_Flow**: The HA UI wizard (Settings → Integrations → Add Integration) that guides the user through connecting to CWOC
- **DataUpdateCoordinator**: An HA helper class that polls an external API at a set interval and distributes updated data to all sensor entities
- **HA_Service**: A callable action registered in HA's service registry, accessible from the automation GUI (e.g., `cwoc.create_chit`)
- **HA_Event_Bus**: The Home Assistant event system; external integrations fire events that HA automations can trigger on
- **HA_Entity**: A device or virtual object in Home Assistant identified by an entity_id (e.g., `sensor.cwoc_todo_count`)
- **Stats_API**: A new CWOC backend endpoint (`GET /api/ha/stats`) that returns aggregated chit counts for the DataUpdateCoordinator to poll
- **Long_Lived_Access_Token**: A bearer token generated in Home Assistant used to authenticate REST API calls from CWOC to HA
- **Webhook_Endpoint**: A CWOC API route (`POST /api/ha/webhook`) that receives inbound POST requests from HA automations
- **Rules_Engine**: The CWOC automation subsystem that evaluates condition trees and executes actions on trigger events
- **Trigger_Dispatcher**: The component in the Rules_Engine that loads matching rules, evaluates conditions, and executes or queues actions
- **HA_Bridge**: The CWOC backend module responsible for communicating with the Home Assistant REST API (service calls, event firing, state polling)
- **HA_Config**: The instance-wide HA connection parameters stored in a dedicated `ha_config` table, configured by an admin
- **Admin**: A CWOC user with `is_admin = True` who can configure instance-wide settings
- **Chit**: The core CWOC data record — a flexible item that can be a task, note, calendar event, alarm, checklist, or project

## Requirements

### Requirement 1: CWOC Stats API for HA Polling

**User Story:** As a Home Assistant DataUpdateCoordinator, I want to poll a single CWOC endpoint for aggregated chit statistics, so that I can efficiently update all CWOC sensors without making multiple API calls.

#### Acceptance Criteria

1. THE CWOC_API SHALL expose a GET endpoint at `/api/ha/stats` that returns a JSON object containing chit counts grouped by status (ToDo, In Progress, Blocked, Complete), total non-deleted chit count, overdue chit count, inbox (unread email) count, and per-tag counts for all tags present in the user's chits.
2. THE Stats_API SHALL require authentication via session cookie or a Bearer token (the same credentials used by the HA Config_Flow).
3. WHEN a chit's status, tags, due_datetime, deleted flag, or email_read flag changes, THE Stats_API SHALL reflect the updated counts on the next request.
4. THE Stats_API SHALL compute the overdue count as the number of non-deleted chits where `due_datetime` is in the past and `status` is not "Complete".
5. THE Stats_API SHALL compute the inbox count as the number of non-deleted chits where `email_read` is false and `email_status` is "received".
6. THE Stats_API SHALL return per-tag counts only for user-defined tags (excluding system tags like Calendar, Tasks, Notes, etc.).

### Requirement 2: CWOC Auth Support for HA Config Flow

**User Story:** As a Home Assistant user adding the CWOC integration, I want to authenticate with my CWOC credentials during the config flow, so that the integration can securely access my CWOC data.

#### Acceptance Criteria

1. THE CWOC_API SHALL accept authentication via the existing `/api/auth/login` endpoint, returning a session token that the HA integration can use for subsequent API calls.
2. WHEN the HA Config_Flow submits CWOC URL, username, and password, THE CWOC_API SHALL validate the credentials and return a session token on success or an error on failure.
3. IF the CWOC server is unreachable during the Config_Flow, THEN THE Config_Flow SHALL display a "Cannot connect" error to the user.
4. IF the credentials are invalid, THEN THE Config_Flow SHALL display an "Invalid authentication" error to the user.

### Requirement 3: HA Custom Integration — Config Flow

**User Story:** As a Home Assistant user, I want to add CWOC through the standard HA Integrations panel, so that I can configure the connection using the familiar HA UI.

#### Acceptance Criteria

1. THE HA_Custom_Integration SHALL provide a `config_flow.py` that registers a UI config flow accessible from Settings → Integrations → Add Integration → search "CWOC".
2. THE Config_Flow SHALL present a form with three fields: CWOC server URL (e.g., `http://192.168.1.111:3333`), username, and password.
3. WHEN the user submits the form, THE Config_Flow SHALL attempt to authenticate against the CWOC Stats_API to validate both connectivity and credentials.
4. IF authentication succeeds, THE Config_Flow SHALL create a config entry storing the CWOC URL and credentials, and set up the integration.
5. IF authentication fails, THE Config_Flow SHALL display an appropriate error message (cannot connect, invalid auth) and allow the user to retry.
6. THE Config_Flow SHALL support reconfiguration — the user can update the CWOC URL or credentials from the integration's options flow.
7. THE HA_Custom_Integration SHALL include a `manifest.json` with `domain` set to `"cwoc"`, appropriate version, and documentation URL.

### Requirement 4: HA Custom Integration — DataUpdateCoordinator

**User Story:** As a Home Assistant user, I want CWOC data to update automatically on a regular interval, so that my dashboard sensors always show current chit counts.

#### Acceptance Criteria

1. THE HA_Custom_Integration SHALL implement a `DataUpdateCoordinator` in `coordinator.py` that polls the CWOC Stats_API (`GET /api/ha/stats`) at a configurable interval (default 30 seconds).
2. WHEN the DataUpdateCoordinator receives updated stats, THE Coordinator SHALL distribute the new data to all registered sensor entities.
3. IF the CWOC server is unreachable during a poll, THEN THE Coordinator SHALL log a warning and retry on the next interval without crashing the integration.
4. IF the CWOC server returns an authentication error during a poll, THEN THE Coordinator SHALL raise a config entry authentication error so HA can prompt the user to re-authenticate.
5. THE Coordinator SHALL use the stored session credentials from the config entry to authenticate each poll request.

### Requirement 5: HA Custom Integration — Sensor Platform

**User Story:** As a Home Assistant user, I want CWOC chit counts displayed as sensors on my dashboard, so that I can see "5 todo chits" or "2 overdue" at a glance.

#### Acceptance Criteria

1. THE HA_Custom_Integration SHALL create the following sensor entities from the DataUpdateCoordinator data: `sensor.cwoc_total_chits` (total non-deleted count), `sensor.cwoc_todo_count` (status "ToDo"), `sensor.cwoc_in_progress_count` (status "In Progress"), `sensor.cwoc_overdue_count` (past due, not complete), and `sensor.cwoc_inbox_count` (unread email chits).
2. WHEN the DataUpdateCoordinator updates, THE Sensor entities SHALL reflect the new counts immediately.
3. THE Sensor entities SHALL have appropriate `device_class`, `state_class`, and `icon` attributes for display in HA dashboards.
4. THE HA_Custom_Integration SHALL create dynamic `sensor.cwoc_tag_{tag_name}_count` sensors for each tag the user has configured to track (specified during config flow or options flow).
5. IF a tag sensor's count is zero, THE Sensor SHALL still be present and report 0 (not become unavailable).

### Requirement 6: HA Custom Integration — Service Actions

**User Story:** As a Home Assistant user, I want to call CWOC actions from HA automations using the native service call GUI, so that I can create chits, update statuses, and manage checklists from HA.

#### Acceptance Criteria

1. THE HA_Custom_Integration SHALL register the following services with full field descriptions in `services.yaml`: `cwoc.create_chit` (fields: title, note, tags, status, priority, due_datetime), `cwoc.add_checklist_item` (fields: chit_id or chit_title, item_text), `cwoc.update_chit` (fields: chit_id, field updates), `cwoc.set_chit_status` (fields: chit_id or chit_title, status), `cwoc.add_tag` (fields: chit_id or chit_title, tag), and `cwoc.remove_tag` (fields: chit_id or chit_title, tag).
2. WHEN an HA automation calls a CWOC service, THE HA_Custom_Integration SHALL make the corresponding REST API call to the CWOC backend using the stored credentials.
3. THE service field descriptions in `services.yaml` SHALL be detailed enough that the HA automation GUI displays proper input fields with labels and descriptions for each parameter.
4. IF the CWOC server returns an error for a service call, THEN THE HA_Custom_Integration SHALL raise a `HomeAssistantError` with a descriptive message.
5. THE `cwoc.create_chit` service SHALL return the created chit's ID in the service response data.
6. THE `cwoc.set_chit_status` and `cwoc.add_tag` and `cwoc.remove_tag` services SHALL support lookup by either `chit_id` or `chit_title` (searching the user's chits by title if `chit_id` is not provided).

### Requirement 7: HA Custom Integration — Event Firing

**User Story:** As a Home Assistant user, I want CWOC state changes to appear as events on the HA event bus, so that my HA automations can trigger when chits are created, updated, or when emails arrive.

#### Acceptance Criteria

1. THE CWOC Rules_Engine SHALL support a `fire_ha_event` action type that POSTs to `{ha_base_url}/api/events/{event_type}` with event data as the JSON body.
2. THE `fire_ha_event` action SHALL accept parameters: `event_type` (string, required) and `event_data` (dict, optional).
3. THE following event types SHALL be supported as user-configurable values: `cwoc_chit_created`, `cwoc_chit_updated`, `cwoc_email_received`, `cwoc_status_changed`, and `cwoc_tag_added`.
4. THE `event_data` SHALL include relevant entity fields from the triggering context such as `chit_title`, `chit_id`, `tags`, `status`, `priority`, and `rule_name`.
5. THE Rules_Engine SHALL support template placeholder substitution in `fire_ha_event` `event_data` string values using `{chit_title}`, `{chit_status}`, `{rule_name}`, and `{entity_id}` placeholders.
6. IF the HA_Config is not configured, THEN THE Rules_Engine SHALL skip the `fire_ha_event` action and log a descriptive warning.
7. IF the HA event fire request exceeds a 10-second timeout, THEN THE HA_Bridge SHALL abort the request and return a timeout failure result.
8. IF the HA event fire request returns a non-2xx HTTP status, THEN THE HA_Bridge SHALL log the error and return a failure result.
9. WHEN a `fire_ha_event` action is queued for confirmation, THE Confirmation_UI SHALL display a description in the format: "Fire Home Assistant event '{event_type}' with {N} data fields".

### Requirement 8: HA Custom Integration — Manifest and Packaging

**User Story:** As a Home Assistant user, I want the CWOC integration to follow HA's custom component conventions, so that it installs cleanly and appears correctly in the HA UI.

#### Acceptance Criteria

1. THE HA_Custom_Integration SHALL be packaged at `ha_integration/custom_components/cwoc/` in the CWOC repository.
2. THE `manifest.json` SHALL specify `domain` as `"cwoc"`, include a version string, set `config_flow` to `true`, and list no external dependencies (the integration uses only HA's built-in `aiohttp` for HTTP calls).
3. THE HA_Custom_Integration SHALL include `strings.json` and `translations/en.json` for all user-facing text in the config flow and service descriptions.
4. THE HA_Custom_Integration SHALL include `const.py` defining the domain constant, default poll interval, and other shared constants.
5. THE HA_Custom_Integration SHALL include `icons.json` mapping service actions to Material Design Icons for the HA UI.
6. THE integration SHALL be deployable by copying the `ha_integration/custom_components/cwoc/` folder to HA's `config/custom_components/cwoc/` directory and restarting HA.

### Requirement 9: CWOC → HA Service Call Action (Rules Engine)

**User Story:** As a CWOC user, I want my rules engine to call Home Assistant services when conditions match, so that CWOC events can control my smart home devices.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a `call_ha_service` action type with parameters: `domain` (string), `service` (string), `entity_id` (string, optional), and `service_data` (dict, optional).
2. WHEN the Rules_Engine executes a `call_ha_service` action, THE HA_Bridge SHALL POST to `{ha_base_url}/api/services/{domain}/{service}` with the entity_id and service_data as the JSON body, using the stored Long_Lived_Access_Token as a Bearer token.
3. IF the HA service call returns a non-2xx HTTP status, THEN THE HA_Bridge SHALL log the error and return a failure result.
4. IF the HA_Config is not configured, THEN THE Rules_Engine SHALL skip the action and log a descriptive warning.
5. THE Rules_Engine SHALL support template placeholders in service_data values, substituting `{chit_title}`, `{chit_status}`, `{rule_name}`, and `{entity_id}` from the triggering entity context.
6. WHEN a `call_ha_service` action is queued for confirmation, THE Confirmation_UI SHALL display a description including the HA domain, service, and target entity_id.
7. IF the HA service call exceeds a 10-second timeout, THEN THE HA_Bridge SHALL abort the request and return a timeout failure result.

### Requirement 10: HA State Change Trigger (Rules Engine)

**User Story:** As a CWOC user, I want CWOC rules to fire when a Home Assistant entity changes state, so that smart home events can drive CWOC automations.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a `ha_state_change` trigger type that fires when a Home Assistant entity changes state.
2. THE HA_Bridge SHALL implement a polling mechanism that periodically checks configured HA entity states via `GET {ha_base_url}/api/states/{entity_id}`.
3. WHEN a polled entity's state differs from its last known value, THE Trigger_Dispatcher SHALL fire `ha_state_change` with an entity dict containing `ha_entity_id`, `old_state`, `new_state`, `attributes`, and `last_changed`.
4. THE Rules_Engine condition tree SHALL evaluate fields from the HA state change entity dict.
5. WHEN no rules use the `ha_state_change` trigger, THE HA_Bridge SHALL not poll HA states.
6. THE HA_Bridge SHALL poll at a configurable interval with a default of 30 seconds.
7. IF the HA state poll fails, THEN THE HA_Bridge SHALL log the error and retry on the next cycle.

### Requirement 11: HA → CWOC Webhook Endpoint

**User Story:** As a CWOC user, I want Home Assistant automations to call CWOC via webhooks, so that HA events can create chits, modify checklists, and trigger CWOC rule chains.

#### Acceptance Criteria

1. THE CWOC_API SHALL expose a POST endpoint at `/api/ha/webhook` that accepts JSON payloads from HA automations.
2. THE Webhook_Endpoint SHALL authenticate requests using the instance-wide webhook secret token passed in the `Authorization` header or as a `token` query parameter.
3. THE Webhook_Endpoint SHALL accept a `user_id` field to specify which CWOC user the action targets; IF omitted, THE Webhook_Endpoint SHALL default to the admin who configured HA.
4. WHEN the webhook receives `action: "create_chit"`, THE Webhook_Endpoint SHALL create a new chit with the provided fields (title, note, tags, status, priority, checklist, due_datetime).
5. WHEN the webhook receives `action: "add_checklist_item"`, THE Webhook_Endpoint SHALL append a new item to the chit identified by `chit_id` or `chit_title`.
6. WHEN the webhook receives `action: "update_chit"`, THE Webhook_Endpoint SHALL update the specified fields on the chit identified by `chit_id`.
7. WHEN the webhook receives `action: "trigger_rule"`, THE Webhook_Endpoint SHALL fire the Trigger_Dispatcher with trigger type `ha_webhook` and the payload as the entity dict.
8. IF the webhook token is missing or invalid, THEN THE Webhook_Endpoint SHALL return HTTP 401.
9. IF required fields are missing for the requested action, THEN THE Webhook_Endpoint SHALL return HTTP 400 with a descriptive error message.

### Requirement 12: HA Connection Configuration (Admin Settings)

**User Story:** As a CWOC admin, I want to configure the Home Assistant connection in the CWOC settings page, so that the rules engine and HA bridge can communicate with HA.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Home Assistant" section (visible only to admin users) with fields for HA base URL, Long_Lived_Access_Token, and poll interval.
2. WHEN the admin saves HA_Config, THE Settings_API SHALL persist the values to an instance-wide `ha_config` table (not per-user settings).
3. WHEN the admin clicks "Test Connection," THE HA_Bridge SHALL GET the HA `/api/` endpoint and display the result.
4. THE Settings_Page SHALL mask the access token by default with a toggle to reveal it.
5. THE Settings_API SHALL store the access token encrypted in the database.
6. THE Settings_Page SHALL display the webhook URL (auto-generated) with a copy button.
7. THE Settings_Page SHALL provide a "Regenerate Token" button for the webhook secret, with a warning that it breaks existing HA automations.

### Requirement 13: HA Integration Database Schema

**User Story:** As a CWOC admin, I want the HA configuration to persist across server restarts.

#### Acceptance Criteria

1. THE Migrations module SHALL create an `ha_config` table with columns: `id` (primary key, single-row constraint), `ha_base_url` (text), `ha_access_token` (text, encrypted), `ha_webhook_secret` (text), `ha_poll_interval` (integer, default 30), `configured_by` (text), and `modified_datetime` (text).
2. THE Migrations module SHALL use `CREATE TABLE IF NOT EXISTS` for idempotency.
3. THE HA_Config SHALL be a single-row table — one HA connection per CWOC instance.

### Requirement 14: HA State Polling Scheduler

**User Story:** As a CWOC user, I want CWOC to automatically poll Home Assistant for state changes, so that my HA-triggered rules fire without manual intervention.

#### Acceptance Criteria

1. THE HA_Bridge SHALL run a background polling loop that checks monitored HA entity states at the configured interval.
2. WHEN the CWOC server starts, THE HA_Bridge SHALL load all enabled `ha_state_change` rules and begin polling their monitored entity_ids.
3. WHEN a `ha_state_change` rule is created, enabled, or updated, THE HA_Bridge SHALL update the monitored entity set without a server restart.
4. WHEN a `ha_state_change` rule is disabled or deleted, THE HA_Bridge SHALL remove that entity from the monitored set if no other rules reference it.
5. THE HA_Bridge SHALL store last known entity states in memory, not in the database.
6. IF the polling loop encounters a connection error, THEN THE HA_Bridge SHALL log the error and continue on the next cycle.

### Requirement 15: HA Proxy Endpoints

**User Story:** As a CWOC user, I want CWOC to proxy requests to my HA API, so that the frontend can fetch HA entities and services without exposing the HA token to the browser.

#### Acceptance Criteria

1. THE CWOC_API SHALL expose `GET /api/ha/entities` that proxies to HA `/api/states` and returns a simplified list of entity_ids with states and friendly names.
2. THE CWOC_API SHALL expose `GET /api/ha/services` that proxies to HA `/api/services` and returns available services grouped by domain.
3. IF HA is not configured, THEN THE proxy endpoints SHALL return HTTP 400.
4. THE proxy endpoints SHALL cache responses for 60 seconds.

### Requirement 16: Rules Editor HA Action UI

**User Story:** As a CWOC user, I want to configure HA service calls and event firing in the rules editor GUI.

#### Acceptance Criteria

1. WHEN the user selects `call_ha_service` as an action type, THE Rules_Editor SHALL display fields for domain, service, entity_id, and a key-value editor for service_data.
2. THE Rules_Editor SHALL provide "Fetch Entities" and "Fetch Services" buttons that query the backend proxy and populate searchable dropdowns.
3. WHEN the user selects `fire_ha_event` as an action type, THE Rules_Editor SHALL display an event_type input with autocomplete suggestions (`cwoc_chit_created`, `cwoc_chit_updated`, `cwoc_email_received`, `cwoc_status_changed`, `cwoc_tag_added`) and a key-value editor for event_data.
4. THE Rules_Editor SHALL display a JSON preview of the payload below the input fields for both action types.
5. IF HA is not configured, THEN THE Rules_Editor SHALL display a message directing the user to admin settings and disable fetch buttons.

### Requirement 17: Rules Editor HA Trigger UI

**User Story:** As a CWOC user, I want to select HA state change as a trigger in the rules editor.

#### Acceptance Criteria

1. WHEN the user selects `ha_state_change` as a trigger type, THE Rules_Editor SHALL display an entity_id input with a "Fetch Entities" autocomplete button.
2. THE Rules_Editor SHALL store the monitored entity_id in `schedule_config.ha_entity_id`.
3. THE Rules_Editor SHALL display a hint about the polling interval for `ha_state_change` triggers.
4. THE condition tree builder SHALL include `ha_entity_id`, `old_state`, `new_state`, and `attributes` as available fields when the trigger is `ha_state_change`.
5. WHEN the user selects `ha_webhook` as a trigger type, THE Rules_Editor SHALL display a hint explaining that this trigger fires when HA sends a webhook with `action: trigger_rule`.

### Requirement 18: HA Webhook Trigger Type

**User Story:** As a CWOC user, I want rules that trigger when an HA webhook fires, so that HA automations can drive complex CWOC rule chains.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a `ha_webhook` trigger type that fires when the Webhook_Endpoint receives `action: "trigger_rule"`.
2. THE Trigger_Dispatcher SHALL pass the full webhook payload as the entity dict.
3. THE condition tree builder SHALL allow evaluating arbitrary fields from the webhook payload.

### Requirement 19: Configurator Script HA Deployment Support

**User Story:** As a CWOC admin, I want the configurator script to offer to deploy the HA custom integration to my Home Assistant instance, so that I do not have to manually copy files.

#### Acceptance Criteria

1. THE Configurator_Script SHALL offer an option to deploy the HA custom integration to a user-specified HA `custom_components` path.
2. WHEN the user chooses to deploy, THE Configurator_Script SHALL copy the `ha_integration/custom_components/cwoc/` directory to the specified HA path.
3. THE Configurator_Script SHALL offer an option to update an existing deployment (overwrite files).
4. THE Configurator_Script SHALL display a reminder to restart Home Assistant after deployment.

### Requirement 20: Help Documentation

**User Story:** As a CWOC user, I want documentation for the Home Assistant integration.

#### Acceptance Criteria

1. THE Help_Page SHALL include a "Home Assistant Integration" section explaining the full setup process: installing the HA custom integration, adding it via HA's Integrations panel, configuring the CWOC connection in HA settings, and configuring the HA connection in CWOC settings.
2. THE Help_Page SHALL include examples of common use cases: showing chit counts on HA dashboards, creating chits from HA automations via services, triggering HA scenes from CWOC rules, and firing HA events on CWOC state changes.
3. THE Help_Page SHALL document the webhook payload format for each supported action.
4. THE Help_Page SHALL document how to use `fire_ha_event` in CWOC rules and how HA automations subscribe to CWOC events.
