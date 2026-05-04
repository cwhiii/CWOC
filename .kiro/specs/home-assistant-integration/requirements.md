# Requirements Document

## Introduction

Deep bidirectional integration between CWOC and Home Assistant (HA). The CWOC rules engine gains the ability to call HA services (flash lights, trigger scenes, send TTS, etc.) when rule conditions match, and Home Assistant automations gain the ability to call CWOC API endpoints (create chits, add checklist items, change statuses, etc.) via webhooks. An admin configures the HA connection once (URL and long-lived access token) and the integration is available to all users. The rules editor exposes HA-specific actions and triggers.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the host application
- **Home_Assistant**: The open-source home automation platform running on the user's network, exposing a REST API
- **HA_Service**: A callable function in Home Assistant identified by domain and service name (e.g. `light.turn_on`, `tts.speak`)
- **HA_Entity**: A device or virtual object in Home Assistant identified by an entity_id (e.g. `light.living_room`)
- **Long_Lived_Access_Token**: A bearer token generated in Home Assistant used to authenticate REST API calls
- **Webhook**: An HTTP POST callback — Home Assistant fires webhooks to external URLs when automations trigger
- **Rules_Engine**: The CWOC automation subsystem that evaluates condition trees and executes actions on trigger events
- **Trigger_Dispatcher**: The component in the Rules_Engine that loads matching rules, evaluates conditions, and executes or queues actions
- **HA_Bridge**: The new backend module responsible for communicating with the Home Assistant REST API
- **Webhook_Endpoint**: A new CWOC API route that receives inbound POST requests from Home Assistant automations
- **HA_Config**: The instance-wide HA connection parameters (HA URL, access token, webhook secret) configured by an admin and stored in a dedicated table
- **Admin**: A CWOC user with `is_admin = True` who can configure instance-wide settings like the HA connection

## Requirements

### Requirement 1: HA Connection Configuration (Admin-Only, Instance-Wide)

**User Story:** As a CWOC admin, I want to configure the Home Assistant connection once for the entire CWOC instance, so that all users can use HA integration without individual setup.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Home Assistant" section (visible only to admin users) containing fields for HA base URL and Long_Lived_Access_Token.
2. WHEN the admin saves HA_Config, THE Settings_API SHALL persist the HA base URL and access token to an instance-wide configuration record (not per-user settings).
3. WHEN the admin clicks a "Test Connection" button, THE HA_Bridge SHALL make a GET request to the HA `/api/` endpoint using the provided URL and token and display the result (success with HA version, or error message).
4. THE Settings_Page SHALL mask the Long_Lived_Access_Token field by default, with a toggle to reveal it.
5. IF the HA base URL or access token is not configured, THEN THE HA_Bridge SHALL skip all HA service calls and log a warning instead of failing.
6. THE Settings_API SHALL store the Long_Lived_Access_Token as an encrypted value in the database, not as plaintext.
7. THE HA_Config SHALL be shared across all users — any user's rules can trigger HA service calls using the instance-wide credentials.

### Requirement 2: CWOC → HA Service Call Action

**User Story:** As a CWOC user, I want my rules engine to call Home Assistant services when conditions match, so that CWOC events can control my smart home devices.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a new action type `call_ha_service` with parameters: `domain` (string), `service` (string), `entity_id` (string, optional), and `service_data` (dict, optional).
2. WHEN the Rules_Engine executes a `call_ha_service` action, THE HA_Bridge SHALL POST to `{ha_base_url}/api/services/{domain}/{service}` with the provided entity_id and service_data as the JSON body, using the stored Long_Lived_Access_Token as a Bearer token.
3. IF the HA service call returns a non-2xx HTTP status, THEN THE HA_Bridge SHALL log the error and return a failure result to the Rules_Engine execution log.
4. IF the HA_Config is not configured, THEN THE Rules_Engine SHALL skip the `call_ha_service` action and log a descriptive warning in the execution log.
5. THE Rules_Engine SHALL support template placeholders in `call_ha_service` service_data values, substituting `{chit_title}`, `{chit_status}`, `{rule_name}`, and `{entity_id}` from the triggering entity context.
6. WHEN a `call_ha_service` action is queued for confirmation, THE Confirmation_UI SHALL display a human-readable description including the HA domain, service, and target entity_id.
7. IF the HA service call exceeds a 10-second timeout, THEN THE HA_Bridge SHALL abort the request and return a timeout failure result.

### Requirement 3: HA State Change Trigger

**User Story:** As a CWOC user, I want CWOC rules to fire when a Home Assistant entity changes state, so that smart home events can drive CWOC automations.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a new trigger type `ha_state_change` that fires when a Home Assistant entity changes state.
2. THE HA_Bridge SHALL implement a polling mechanism that periodically checks configured HA entity states via `GET {ha_base_url}/api/states/{entity_id}` and compares against the last known state.
3. WHEN a polled HA entity's state differs from its last known value, THE Trigger_Dispatcher SHALL fire `ha_state_change` with an entity dict containing `ha_entity_id`, `old_state`, `new_state`, `attributes`, and `last_changed`.
4. THE Rules_Editor SHALL allow the user to specify which HA entity_ids to monitor when creating a rule with the `ha_state_change` trigger.
5. THE Rules_Engine condition tree SHALL be able to evaluate fields from the HA state change entity dict (e.g. `ha_entity_id equals light.living_room`, `new_state equals on`).
6. WHEN no rules use the `ha_state_change` trigger, THE HA_Bridge SHALL not poll Home Assistant states, conserving resources.
7. THE HA_Bridge SHALL poll monitored entities at a configurable interval with a default of 30 seconds.
8. IF the HA state poll request fails, THEN THE HA_Bridge SHALL log the error and retry on the next polling cycle without crashing.

### Requirement 4: HA → CWOC Webhook Endpoint

**User Story:** As a CWOC user, I want Home Assistant automations to call CWOC via webhooks, so that HA events can create chits, modify checklists, and trigger other CWOC actions.

#### Acceptance Criteria

1. THE CWOC_API SHALL expose a POST endpoint at `/api/ha/webhook` that accepts JSON payloads from Home Assistant automations.
2. THE Webhook_Endpoint SHALL authenticate requests using the instance-wide webhook secret token passed in the `Authorization` header or as a `token` query parameter.
3. THE Webhook_Endpoint SHALL accept a `user_id` field in the JSON payload to specify which CWOC user the action is performed on behalf of; IF `user_id` is omitted, THE Webhook_Endpoint SHALL default to the admin user who configured the HA integration.
4. WHEN the webhook receives an `action` of `create_chit`, THE Webhook_Endpoint SHALL create a new chit with the provided fields (title, note, tags, status, priority, checklist, due_datetime) owned by the resolved user.
5. WHEN the webhook receives an `action` of `add_checklist_item`, THE Webhook_Endpoint SHALL append a new item to the checklist of the chit identified by `chit_id` or `chit_title`.
6. WHEN the webhook receives an `action` of `update_chit`, THE Webhook_Endpoint SHALL update the specified fields on the chit identified by `chit_id`.
7. WHEN the webhook receives an `action` of `trigger_rule`, THE Webhook_Endpoint SHALL fire the Trigger_Dispatcher with trigger type `ha_webhook` and the webhook payload as the entity dict for the resolved user.
8. IF the webhook token is missing or invalid, THEN THE Webhook_Endpoint SHALL return HTTP 401 with an error message.
9. IF the webhook payload is missing required fields for the requested action, THEN THE Webhook_Endpoint SHALL return HTTP 400 with a descriptive error message.
10. THE Settings_Page SHALL display the instance-wide webhook secret token (auto-generated on first admin access) and a copyable webhook URL for use in Home Assistant automations.

### Requirement 5: Webhook Token Management

**User Story:** As a CWOC admin, I want to manage the instance-wide webhook authentication token, so that I can securely connect Home Assistant to CWOC.

#### Acceptance Criteria

1. THE Settings_API SHALL auto-generate a unique instance-wide webhook secret token when the HA settings section is first accessed by an admin.
2. THE Settings_Page SHALL display the full webhook URL (including the server address and token) with a one-click copy button.
3. WHEN the admin clicks "Regenerate Token," THE Settings_API SHALL generate a new webhook secret token and invalidate the previous one.
4. THE Webhook_Endpoint SHALL validate incoming requests against the stored instance-wide webhook secret.
5. THE Settings_Page SHALL display a warning that regenerating the token will break existing Home Assistant automations using the old token.

### Requirement 6: Rules Editor HA Action UI

**User Story:** As a CWOC user, I want to configure Home Assistant service calls in the rules editor, so that I can set up HA actions without writing JSON by hand.

#### Acceptance Criteria

1. WHEN the user selects `call_ha_service` as an action type in the Rules_Editor, THE Rules_Editor SHALL display input fields for domain, service, entity_id, and a key-value editor for service_data.
2. THE Rules_Editor SHALL provide a "Fetch Entities" button that queries the HA REST API via a backend proxy endpoint and populates a searchable dropdown of available entity_ids.
3. THE Rules_Editor SHALL provide a "Fetch Services" button that queries the HA REST API via a backend proxy endpoint and populates a searchable dropdown of available services grouped by domain.
4. IF the HA connection is not configured, THEN THE Rules_Editor SHALL display a message directing the user to ask an admin to configure HA settings, and disable the entity/service fetch buttons.
5. THE Rules_Editor SHALL display a preview of the HA service call payload as formatted JSON below the input fields.

### Requirement 7: Rules Editor HA Trigger UI

**User Story:** As a CWOC user, I want to select HA state change as a trigger in the rules editor, so that I can create rules that respond to smart home events.

#### Acceptance Criteria

1. WHEN the user selects `ha_state_change` as a trigger type in the Rules_Editor, THE Rules_Editor SHALL display an entity_id input field with a "Fetch Entities" button for autocomplete.
2. THE Rules_Editor SHALL store the monitored entity_id in the rule's `schedule_config` field as `{"ha_entity_id": "<entity_id>"}`.
3. WHEN the user selects `ha_state_change` trigger, THE Rules_Editor SHALL display a hint explaining that CWOC polls HA for state changes at the configured interval.
4. THE condition tree builder SHALL include `ha_entity_id`, `old_state`, `new_state`, and `attributes` as available fields when the trigger type is `ha_state_change`.

### Requirement 8: HA Proxy Endpoints

**User Story:** As a CWOC user, I want CWOC to proxy requests to my Home Assistant API, so that the frontend can fetch HA entities and services without exposing the HA token to the browser.

#### Acceptance Criteria

1. THE CWOC_API SHALL expose a GET endpoint at `/api/ha/entities` that proxies to `{ha_base_url}/api/states` and returns a simplified list of entity_ids with their current states and friendly names.
2. THE CWOC_API SHALL expose a GET endpoint at `/api/ha/services` that proxies to `{ha_base_url}/api/services` and returns the list of available services grouped by domain.
3. THE HA proxy endpoints SHALL use the instance-wide HA_Config (URL and token) to make the upstream request.
4. IF the HA_Config is not configured, THEN THE HA proxy endpoints SHALL return HTTP 400 with a message indicating HA is not configured.
5. THE HA proxy endpoints SHALL cache responses for 60 seconds to avoid excessive requests to the HA instance.

### Requirement 9: HA State Polling Scheduler

**User Story:** As a CWOC user, I want CWOC to automatically poll Home Assistant for state changes, so that my HA-triggered rules fire without manual intervention.

#### Acceptance Criteria

1. THE HA_Bridge SHALL run a background polling loop that checks monitored HA entity states at the configured interval.
2. WHEN the CWOC server starts, THE HA_Bridge SHALL load all enabled rules with `ha_state_change` triggers across all users and begin polling their monitored entity_ids.
3. WHEN a rule with `ha_state_change` trigger is created, enabled, or updated, THE HA_Bridge SHALL update the set of monitored entities without requiring a server restart.
4. WHEN a rule with `ha_state_change` trigger is disabled or deleted, THE HA_Bridge SHALL remove that entity from the monitored set if no other rules reference it.
5. THE HA_Bridge SHALL store the last known state of each monitored entity in memory, not in the database, to minimize disk I/O.
6. IF the polling loop encounters a connection error, THEN THE HA_Bridge SHALL log the error and continue polling on the next cycle.

### Requirement 10: HA Webhook Trigger Type

**User Story:** As a CWOC user, I want to create rules that trigger when a Home Assistant webhook fires, so that I can use HA automations to drive complex CWOC rule chains.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a new trigger type `ha_webhook` that fires when the Webhook_Endpoint receives a `trigger_rule` action.
2. THE Trigger_Dispatcher SHALL pass the full webhook payload as the entity dict when dispatching `ha_webhook` triggers.
3. THE condition tree builder SHALL allow evaluating arbitrary fields from the webhook payload when the trigger type is `ha_webhook`.
4. WHEN the user selects `ha_webhook` as a trigger type in the Rules_Editor, THE Rules_Editor SHALL display a hint explaining that this trigger fires when HA sends a webhook with `action: trigger_rule`.

### Requirement 11: HA Action Description and Logging

**User Story:** As a CWOC user, I want to see clear descriptions of HA actions in the confirmation UI and execution logs, so that I understand what CWOC is doing with my smart home.

#### Acceptance Criteria

1. WHEN a `call_ha_service` action is queued for confirmation, THE Confirmation_UI SHALL display a description in the format: "Call Home Assistant service {domain}.{service} on {entity_id}".
2. THE execution log SHALL record the HA service call result (success or failure with HTTP status) for each `call_ha_service` action.
3. THE execution log SHALL record the HA entity state change details (entity_id, old_state, new_state) for each `ha_state_change` trigger event.

### Requirement 12: HA Integration Database Schema

**User Story:** As a CWOC admin, I want the HA configuration to persist across server restarts, so that the integration does not need to be reconfigured each time.

#### Acceptance Criteria

1. THE Migrations module SHALL create an `ha_config` table with columns: `id` (primary key), `ha_base_url` (text), `ha_access_token` (text, encrypted), `ha_webhook_secret` (text), `ha_poll_interval` (integer, default 30), `configured_by` (text, user_id of the admin who set it up), and `modified_datetime` (text).
2. THE Migrations module SHALL use table-existence checks to avoid errors on repeated startup.
3. THE HA_Config SHALL be a single-row table — only one HA connection is supported per CWOC instance.

### Requirement 13: Help Documentation

**User Story:** As a CWOC user, I want documentation for the Home Assistant integration, so that I can understand how to set it up and use it.

#### Acceptance Criteria

1. THE Help_Page SHALL include a "Home Assistant Integration" section explaining the setup process (admin configures URL and token in settings, webhook URL is generated automatically).
2. THE Help_Page SHALL include examples of common use cases: flashing a light on email receipt, creating a chit from an HA automation, triggering a scene when a chit status changes.
3. THE Help_Page SHALL include the webhook payload format with field descriptions for each supported action (create_chit, add_checklist_item, update_chit, trigger_rule).
4. THE Help_Page SHALL document how to pass `user_id` in webhook payloads to target specific CWOC users.
