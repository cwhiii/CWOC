# Implementation Plan: Home Assistant Integration

## Overview

Full bidirectional Home Assistant integration spanning two codebases: CWOC Backend (FastAPI/Python) and HA Custom Integration (Python package). Implementation proceeds in five phases: backend foundation, HA custom integration files, frontend UI, testing & documentation, and final wiring.

**Language:** Python (backend + HA integration), vanilla JavaScript (frontend)

## Tasks

- [ ] 1. CWOC Backend Foundation
  - [ ] 1.1 Create database migration for ha_config table
    - Add `migrate_create_ha_config()` to `src/backend/migrations.py`
    - CREATE TABLE IF NOT EXISTS ha_config with columns: id (INTEGER PRIMARY KEY CHECK id=1), ha_base_url (TEXT), ha_access_token (TEXT), ha_webhook_secret (TEXT), ha_poll_interval (INTEGER DEFAULT 30), configured_by (TEXT), modified_datetime (TEXT)
    - INSERT OR IGNORE a single row with id=1 and auto-generated UUID for ha_webhook_secret
    - Follow existing migration pattern: sqlite3 connect, try/except, finally close
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 1.2 Add Pydantic models for HA integration
    - Add `HAConfigUpdate` model to `src/backend/models.py`: ha_base_url (Optional[str]), ha_access_token (Optional[str]), ha_poll_interval (Optional[int] = 30)
    - Add `HAWebhookPayload` model to `src/backend/models.py`: action (str), user_id (Optional[str]), chit_id (Optional[str]), chit_title (Optional[str]), title (Optional[str]), note (Optional[str]), tags (Optional[List[str]]), status (Optional[str]), priority (Optional[str]), due_datetime (Optional[str]), checklist (Optional[List[Dict[str, Any]]]), item_text (Optional[str]), fields (Optional[Dict[str, Any]]), payload (Optional[Dict[str, Any]])
    - _Requirements: 11.1, 12.1, 12.2_

  - [ ] 1.3 Create HA Bridge module (ha_bridge.py)
    - Create `src/backend/ha_bridge.py` with all HA communication logic using stdlib `urllib.request`
    - Implement `get_ha_config()` — read ha_config row, decrypt token using existing `_decrypt_password` from routes/email.py
    - Implement `is_ha_configured()` — quick check for URL + token presence
    - Implement `call_ha_service(domain, service, entity_id, service_data, timeout=10)` — POST to `{ha_base_url}/api/services/{domain}/{service}` with Bearer token auth
    - Implement `fire_ha_event(event_type, event_data, timeout=10)` — POST to `{ha_base_url}/api/events/{event_type}`
    - Implement `get_ha_entity_state(entity_id)` — GET `/api/states/{entity_id}`
    - Implement `get_ha_entities()` — GET `/api/states`, return simplified list
    - Implement `get_ha_services()` — GET `/api/services`
    - Implement `test_ha_connection(base_url, token)` — GET `/api/` to validate
    - Implement `substitute_template_placeholders(data, context)` — replace `{chit_title}`, `{chit_status}`, `{rule_name}`, `{entity_id}` in string values
    - Implement polling scheduler: `start_ha_polling_scheduler()`, `_ha_polling_loop()`, `update_monitored_entities()`
    - In-memory `_monitored_entities` and `_last_known_states` dicts
    - All HTTP errors return `{success: False, message: "..."}` without raising exceptions
    - _Requirements: 7.1, 7.5, 7.6, 7.7, 7.8, 9.1, 9.2, 9.4, 9.5, 9.7, 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 14.1, 14.2, 14.5, 14.6, 15.1, 15.2_

  - [ ] 1.4 Create Stats API endpoint
    - Add `GET /api/ha/stats` to `src/backend/routes/ha.py`
    - Query non-deleted chits for the authenticated user
    - Return JSON: total_chits, todo_count, in_progress_count, blocked_count, complete_count, overdue_count, inbox_count, tag_counts (user-defined tags only, excluding CWOC_System/ prefixed tags)
    - Require authentication via session cookie or Bearer token
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 1.5 Create HA routes module (routes/ha.py)
    - Create `src/backend/routes/ha.py` with an APIRouter
    - `POST /api/ha/config` — admin-only, save HA config (encrypt token before storage)
    - `GET /api/ha/config` — admin-only, return config with masked token
    - `POST /api/ha/config/test` — admin-only, test connection via `ha_bridge.test_ha_connection()`
    - `POST /api/ha/config/regenerate-webhook` — admin-only, regenerate webhook secret UUID
    - `GET /api/ha/entities` — authenticated, proxy to HA `/api/states` with 60s cache, return simplified entity list
    - `GET /api/ha/services` — authenticated, proxy to HA `/api/services` with 60s cache
    - `POST /api/ha/webhook` — token-authenticated (query param or Authorization header), process webhook actions: create_chit, add_checklist_item, update_chit, trigger_rule
    - Webhook validates token against ha_config.ha_webhook_secret, resolves user_id (default to configured_by admin), returns appropriate HTTP errors (401, 400, 404, 500)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 15.1, 15.2, 15.3, 15.4_

  - [ ] 1.6 Extend rules engine with HA actions and triggers
    - Add `call_ha_service` action type to `execute_action()` in `src/backend/rules_engine.py` — delegate to `ha_bridge.call_ha_service()` with template substitution on service_data
    - Add `fire_ha_event` action type to `execute_action()` — delegate to `ha_bridge.fire_ha_event()` with template substitution on event_data
    - Add `ha_state_change` and `ha_webhook` to recognized trigger types in `dispatch_trigger()`
    - Add `_build_action_description()` entries: `call_ha_service` → "Call HA service {domain}.{service} on {entity_id}", `fire_ha_event` → "Fire Home Assistant event '{event_type}' with {N} data fields"
    - _Requirements: 7.1, 7.2, 7.5, 7.9, 9.1, 9.2, 9.5, 9.6, 10.1, 10.4, 18.1, 18.2, 18.3_

  - [ ] 1.7 Register HA routes and polling scheduler in main.py
    - Import `migrate_create_ha_config` in `src/backend/main.py` and call it in the migration sequence
    - Import and include the HA router (`ha_router`)
    - Import `start_ha_polling_scheduler` from `ha_bridge` and call it in `on_startup()`
    - _Requirements: 14.1, 14.2_

- [ ] 2. Checkpoint — Backend foundation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. HA Custom Integration
  - [ ] 3.1 Create integration scaffolding files
    - Create `ha_integration/custom_components/cwoc/manifest.json` with domain "cwoc", config_flow true, version, documentation_url, no requirements (uses built-in aiohttp)
    - Create `ha_integration/custom_components/cwoc/const.py` with DOMAIN, DEFAULT_SCAN_INTERVAL (30), service name constants
    - Create `ha_integration/custom_components/cwoc/strings.json` with config flow step titles, field labels, error messages
    - Create `ha_integration/custom_components/cwoc/translations/en.json` matching strings.json
    - Create `ha_integration/custom_components/cwoc/icons.json` mapping services to MDI icons
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 3.2 Implement config flow (config_flow.py)
    - Create `ha_integration/custom_components/cwoc/config_flow.py`
    - Implement `CwocConfigFlow` extending `ConfigFlow` with DOMAIN
    - `async_step_user()` — present form with cwoc_url, username, password fields
    - On submit: POST to `{cwoc_url}/api/auth/login` to validate credentials, store session token
    - On success: create config entry with cwoc_url, username, password, session_token
    - On failure: show "cannot_connect" or "invalid_auth" error, allow retry
    - Implement options flow for reconfiguration (update URL/credentials)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 3.3 Implement DataUpdateCoordinator (coordinator.py)
    - Create `ha_integration/custom_components/cwoc/coordinator.py`
    - Implement `CwocDataUpdateCoordinator` extending `DataUpdateCoordinator`
    - `_async_update_data()` — GET `{cwoc_url}/api/ha/stats` with session auth
    - Handle connection errors (log warning, retry next interval)
    - Handle 401 errors (raise `ConfigEntryAuthFailed`)
    - Default update interval: 30 seconds (configurable)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.4 Implement sensor platform (sensor.py)
    - Create `ha_integration/custom_components/cwoc/sensor.py`
    - Implement `async_setup_entry()` to register sensor entities
    - Create fixed sensors: cwoc_total_chits, cwoc_todo_count, cwoc_in_progress_count, cwoc_overdue_count, cwoc_inbox_count
    - Create dynamic tag sensors: cwoc_tag_{name}_count for each tracked tag
    - Each sensor reads `native_value` from coordinator data
    - Set appropriate device_class, state_class, icon (mdi:note-multiple, mdi:checkbox-blank-outline, etc.)
    - Tag sensors report 0 when count is zero (not unavailable)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 3.5 Implement service actions (services.py + services.yaml)
    - Create `ha_integration/custom_components/cwoc/services.yaml` with full field descriptions for: cwoc.create_chit, cwoc.add_checklist_item, cwoc.update_chit, cwoc.set_chit_status, cwoc.add_tag, cwoc.remove_tag
    - Create `ha_integration/custom_components/cwoc/services.py` with handler functions
    - Each service makes REST API call to CWOC backend using stored credentials
    - Raise `HomeAssistantError` on CWOC errors
    - `create_chit` returns created chit ID in response data
    - `set_chit_status`, `add_tag`, `remove_tag` support lookup by chit_id or chit_title
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 3.6 Implement integration setup (__init__.py)
    - Create `ha_integration/custom_components/cwoc/__init__.py`
    - Implement `async_setup_entry()` — create coordinator, forward to sensor platform, register services
    - Implement `async_unload_entry()` — unload platforms
    - Register all service handlers from services.py
    - _Requirements: 3.4, 4.1, 6.1, 8.6_

- [ ] 4. Checkpoint — HA custom integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. CWOC Frontend — HA UI
  - [ ] 5.1 Settings page HA section
    - Add "Home Assistant" section to `src/frontend/html/settings.html` (admin-only visibility)
    - Fields: HA base URL input, Long-Lived Access Token input (masked with reveal toggle), Poll Interval input
    - Test Connection button with status indicator
    - Webhook URL display with copy button (read-only)
    - Regenerate Webhook Secret button with confirmation warning
    - Add corresponding JS in `src/frontend/js/pages/settings.js`: load/save HA config, test connection handler, copy webhook URL, regenerate secret
    - Add CSS for HA section in `src/frontend/css/shared/shared-page.css` (reuse existing settings patterns)
    - Mobile-friendly layout from the start
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 5.2 Rules editor HA action UI (call_ha_service + fire_ha_event)
    - In `src/frontend/js/pages/rule-editor.js`, add `call_ha_service` action type rendering
    - Fields: domain input, service input, entity_id input, key-value editor for service_data
    - Add "Fetch Entities" and "Fetch Services" buttons → query `/api/ha/entities` and `/api/ha/services`, populate searchable dropdowns
    - Add `fire_ha_event` action type rendering: event_type input with autocomplete suggestions (cwoc_chit_created, cwoc_chit_updated, cwoc_email_received, cwoc_status_changed, cwoc_tag_added), key-value editor for event_data
    - JSON preview panel below inputs for both action types
    - Show "HA not configured" message when ha_config is empty, disable fetch buttons
    - Mobile-friendly layout
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ] 5.3 Rules editor HA trigger UI (ha_state_change + ha_webhook)
    - In `src/frontend/js/pages/rule-editor.js`, add `ha_state_change` trigger type rendering
    - Entity_id input with "Fetch Entities" autocomplete button
    - Store entity_id in schedule_config.ha_entity_id
    - Display hint about polling interval
    - Add condition tree fields: ha_entity_id, old_state, new_state, attributes
    - Add `ha_webhook` trigger type rendering: hint text explaining webhook-driven rules
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 6. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Testing & Documentation
  - [ ] 7.1 Create property-based test file for HA integration
    - Create `src/backend/test_ha_integration.py` using Python stdlib `unittest` + `random` (120 iterations per property)
    - Follow existing pattern from `test_rules_engine.py`: inline minimal production logic, no imports of main.py/db.py
    - Each test method tagged with comment: `# Feature: home-assistant-integration, Property N: {title}`
    - _Requirements: 1.1, 7.1, 9.2, 10.3, 11.2, 13.1_

  - [ ]* 7.2 Property test: Stats Computation Correctness (Property 1)
    - Generate random chit sets with varying statuses, tags, due_datetimes, deleted flags, email_read/email_status
    - Verify total_chits = non-deleted count, todo_count = non-deleted with status "ToDo", overdue_count = non-deleted past-due non-complete, inbox_count = non-deleted email_read=False email_status="received", tag_counts excludes CWOC_System/ tags
    - **Property 1: Stats Computation Correctness**
    - **Validates: Requirements 1.1, 1.4, 1.5, 1.6**

  - [ ]* 7.3 Property test: HA Config Save/Read Round-Trip (Property 2)
    - Generate random URL strings and token strings, simulate save (encrypt) then read (decrypt)
    - Verify base_url and decrypted token match originals, poll_interval round-trips
    - **Property 2: HA Config Save/Read Round-Trip**
    - **Validates: Requirements 12.2, 12.5, 13.1**

  - [ ]* 7.4 Property test: Graceful Skip When HA Unconfigured (Property 3)
    - Generate random action params, call bridge functions with no config
    - Verify returns {success: False} with descriptive message, no exception raised
    - **Property 3: Graceful Skip When HA Unconfigured**
    - **Validates: Requirements 7.6, 9.4**

  - [ ]* 7.5 Property test: HA Bridge Request URL Construction (Property 4)
    - Generate random domain/service/event_type strings
    - Verify call_ha_service constructs POST to `{base}/api/services/{domain}/{service}`
    - Verify fire_ha_event constructs POST to `{base}/api/events/{event_type}`
    - Verify Authorization header contains Bearer token
    - **Property 4: HA Bridge Request URL Construction**
    - **Validates: Requirements 7.1, 9.2**

  - [ ]* 7.6 Property test: Template Placeholder Substitution (Property 5)
    - Generate random dicts with placeholder strings and context values
    - Verify all placeholders replaced, non-placeholder text unchanged, non-string values unchanged
    - **Property 5: Template Placeholder Substitution**
    - **Validates: Requirements 7.5, 9.5**

  - [ ]* 7.7 Property test: call_ha_service Description Format (Property 6)
    - Generate random domain, service, entity_id strings
    - Verify description contains all three values in human-readable format
    - **Property 6: call_ha_service Confirmation Description Format**
    - **Validates: Requirements 9.6**

  - [ ]* 7.8 Property test: fire_ha_event Description Format (Property 7)
    - Generate random event_type and event_data dict with N keys
    - Verify description format: "Fire Home Assistant event '{event_type}' with {N} data fields"
    - **Property 7: fire_ha_event Confirmation Description Format**
    - **Validates: Requirements 7.9**

  - [ ]* 7.9 Property test: State Change Detection (Property 8)
    - Generate random entity_id, old_state, new_state pairs
    - If old != new: verify entity dict contains ha_entity_id, old_state, new_state, attributes, last_changed
    - If old == new: verify no trigger fires
    - **Property 8: State Change Detection**
    - **Validates: Requirements 10.3**

  - [ ]* 7.10 Property test: Webhook Token Validation (Property 9)
    - Generate random tokens and stored secrets
    - If token != secret: verify rejection (401 equivalent)
    - If token == secret: verify acceptance
    - **Property 9: Webhook Token Validation**
    - **Validates: Requirements 11.2, 11.8**

  - [ ]* 7.11 Property test: Webhook User Resolution (Property 10)
    - Generate random payloads with/without user_id field
    - If user_id present and non-empty: resolved user = user_id
    - If user_id absent/empty: resolved user = configured_by admin
    - **Property 10: Webhook User Resolution**
    - **Validates: Requirements 11.3**

  - [ ]* 7.12 Property test: Webhook Trigger Rule Payload Passthrough (Property 14)
    - Generate random webhook payloads with action "trigger_rule"
    - Verify entity dict passed to trigger dispatcher contains all original payload fields
    - **Property 14: Webhook Trigger Rule Payload Passthrough**
    - **Validates: Requirements 11.7, 18.2**

  - [ ]* 7.13 Property test: Webhook Required Field Validation (Property 15)
    - Generate payloads missing required fields for each action type
    - Verify HTTP 400 equivalent with descriptive error for: create_chit missing title, add_checklist_item missing chit_id/chit_title + item_text, update_chit missing chit_id
    - **Property 15: Webhook Required Field Validation**
    - **Validates: Requirements 11.9**

  - [ ]* 7.14 Property test: Entity List Simplification (Property 16)
    - Generate random HA states API responses (list of state objects)
    - Verify simplified list has same count, each item has entity_id, state, friendly_name
    - **Property 16: Entity List Simplification**
    - **Validates: Requirements 15.1**

  - [ ]* 7.15 Property test: Monitored Entity Set Computation (Property 17)
    - Generate random rule sets with ha_state_change triggers, enabled/disabled states
    - Verify monitored set = union of ha_entity_id from enabled ha_state_change rules
    - Verify disabling removes entity only if no other enabled rule references it
    - **Property 17: Monitored Entity Set Computation**
    - **Validates: Requirements 10.5, 14.3, 14.4**

  - [ ]* 7.16 Property test: Migration Idempotency (Property 18)
    - Call migrate_create_ha_config multiple times on same in-memory DB
    - Verify no errors, table exists with correct schema, exactly one row after each call
    - **Property 18: Migration Idempotency**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [ ]* 7.17 Property test: Sensor Creation from Stats Data (Property 19)
    - Generate random stats responses with varying tag_counts
    - Verify sensor count = 5 + N (where N = number of tags), each native_value matches stats field
    - **Property 19: Sensor Creation from Stats Data**
    - **Validates: Requirements 5.1, 5.4, 5.5**

  - [ ]* 7.18 Property test: Chit Lookup by Title or ID (Property 20)
    - Generate random chit sets with unique and duplicate titles
    - Verify title lookup returns same chit as ID lookup for unique titles
    - Verify title lookup returns most recently modified for duplicates
    - **Property 20: Chit Lookup by Title or ID**
    - **Validates: Requirements 6.6**

  - [ ] 7.19 Add Help page documentation for HA integration
    - Add "Home Assistant Integration" section to `src/frontend/html/help.html`
    - Document full setup process: deploying HA custom integration, adding via HA Integrations panel, configuring CWOC connection in HA, configuring HA connection in CWOC settings
    - Include common use case examples: chit counts on dashboards, creating chits from HA automations, triggering HA scenes from CWOC rules, firing HA events on CWOC state changes
    - Document webhook payload format for each action (create_chit, add_checklist_item, update_chit, trigger_rule)
    - Document fire_ha_event usage in CWOC rules and HA automation subscription
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [ ] 7.20 Update configurator script with HA deployment option
    - Add HA custom integration deployment option to `install/configurinator.sh`
    - Prompt user for HA custom_components path
    - Copy `ha_integration/custom_components/cwoc/` to specified path
    - Offer update (overwrite) option for existing deployments
    - Display reminder to restart Home Assistant after deployment
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [ ] 8. Checkpoint — Testing and documentation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Final Wiring
  - [ ] 9.1 Update INDEX.md, VERSION, and create release notes
    - Update `src/INDEX.md` with all new files, functions, routes, and CSS sections added by this feature
    - Run `date "+%Y%m%d.%H%M"` and update `src/VERSION` with the real datetime
    - Create release notes file at `documents/release_notes/cwoc_release_{version}.md` with brief summary of the HA integration feature
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Python stdlib unittest + random (120 iterations)
- NO software installation required — all code is written directly, no pip/npm
- HA custom integration is pure Python files copied to HA's custom_components directory
- Frontend uses vanilla JS with the existing 1940s parchment aesthetic
- All UI is mobile-friendly from the start
