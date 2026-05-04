# Implementation Plan: Home Assistant Integration

## Overview

Bidirectional integration between CWOC and Home Assistant. The implementation proceeds bottom-up: database migration → Pydantic models → HA bridge module → routes → rules engine extensions → frontend UI → property-based tests → help documentation. Each task builds on the previous, with no orphaned code.

## Tasks

- [ ] 1. Database migration and Pydantic models
  - [ ] 1.1 Add `migrate_create_ha_config()` to `src/backend/migrations.py`
    - Create `ha_config` table with `id INTEGER PRIMARY KEY CHECK (id = 1)`, `ha_base_url TEXT`, `ha_access_token TEXT`, `ha_webhook_secret TEXT`, `ha_poll_interval INTEGER DEFAULT 30`, `configured_by TEXT`, `modified_datetime TEXT`
    - Use `CREATE TABLE IF NOT EXISTS` for idempotency, then `INSERT OR IGNORE INTO ha_config (id) VALUES (1)` to seed the single row
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 1.2 Register the migration in `src/backend/main.py`
    - Import `migrate_create_ha_config` from migrations and call it in the startup migration sequence (after `migrate_add_email_accounts`)
    - _Requirements: 12.2_

  - [ ] 1.3 Add `HAConfigUpdate` and `HAWebhookPayload` Pydantic models to `src/backend/models.py`
    - `HAConfigUpdate`: `ha_base_url`, `ha_access_token`, `ha_poll_interval` (all Optional)
    - `HAWebhookPayload`: `action`, `user_id`, `chit_id`, `chit_title`, `title`, `note`, `tags`, `status`, `priority`, `due_datetime`, `checklist`, `item_text`, `fields`, `payload` (per design)
    - _Requirements: 1.2, 4.4, 4.5, 4.6, 4.7_

- [ ] 2. HA Bridge module (`src/backend/ha_bridge.py`)
  - [ ] 2.1 Create `src/backend/ha_bridge.py` with config helpers
    - `get_ha_config()`: read `ha_config` row, decrypt token using `_decrypt_password` from `routes/email.py`, return dict or None
    - `is_ha_configured()`: quick check returning bool
    - `test_ha_connection(base_url, token)`: GET `{base_url}/api/` with Bearer token, return `{success, message, ha_version}`
    - Use `urllib.request` (stdlib) for HTTP calls, matching the existing weather scheduler pattern
    - _Requirements: 1.2, 1.3, 1.5, 1.6_

  - [ ] 2.2 Add HA service call and entity/service fetch functions
    - `call_ha_service(domain, service, entity_id, service_data, timeout=10)`: POST to `{ha_base_url}/api/services/{domain}/{service}`, return `{success, message, status_code}`
    - `get_ha_entity_state(entity_id)`: GET single entity state
    - `get_ha_entities()`: GET `/api/states`, return simplified list `[{entity_id, state, friendly_name}]`
    - `get_ha_services()`: GET `/api/services`, return list of `{domain, services}`
    - Handle connection errors, timeouts, non-2xx responses per design error table
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 8.1, 8.2_

  - [ ] 2.2a Add `fire_ha_event()` function to `src/backend/ha_bridge.py`
    - `fire_ha_event(event_type, event_data, timeout=10)`: POST to `{ha_base_url}/api/events/{event_type}` with event_data as JSON body, Bearer token auth
    - Return `{success, message, status_code}` matching the same pattern as `call_ha_service`
    - Handle: HA not configured (skip with warning), non-2xx response, timeout (10s), connection refused, missing event_type
    - _Requirements: 14.1, 14.2, 14.6, 14.7, 14.8_

  - [ ] 2.3 Add template placeholder substitution
    - `substitute_template_placeholders(service_data, context)`: replace `{chit_title}`, `{chit_status}`, `{rule_name}`, `{entity_id}` in string values within the dict
    - _Requirements: 2.5_

  - [ ] 2.4 Add HA polling scheduler
    - In-memory `_monitored_entities` (dict of owner_id → set of entity_ids) and `_last_known_states` (dict of entity_id → state dict)
    - `start_ha_polling_scheduler()`: async function called from `main.py` on_startup, loads monitored entities from DB, starts polling loop
    - `_ha_polling_loop()`: background loop polling at configured interval, fires `ha_state_change` trigger via `dispatch_trigger` when state differs
    - `update_monitored_entities()`: reload monitored entity set from DB (called when rules change)
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. HA routes (`src/backend/routes/ha.py`)
  - [ ] 4.1 Create `src/backend/routes/ha.py` with admin-only config endpoints
    - `POST /api/ha/config`: save HA config (URL, token encrypted via `_encrypt_password`, poll interval, configured_by, webhook secret auto-generated if missing)
    - `GET /api/ha/config`: return config with token masked (show only last 4 chars)
    - `POST /api/ha/config/test`: test connection with provided or saved credentials
    - `POST /api/ha/config/regenerate-token`: regenerate webhook secret UUID
    - Admin-only access check (same pattern as user management routes)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 5.1, 5.3_

  - [ ] 4.2 Add proxy endpoints for entities and services
    - `GET /api/ha/entities`: proxy to HA `/api/states`, return simplified entity list, 60s in-memory cache
    - `GET /api/ha/services`: proxy to HA `/api/services`, return service list, 60s in-memory cache
    - Return HTTP 400 if HA not configured, HTTP 502 if HA unreachable
    - Any authenticated user can access (not admin-only)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 4.3 Add webhook endpoint
    - `POST /api/ha/webhook`: validate token from query param or Authorization header against stored `ha_webhook_secret`
    - Resolve user_id (from payload or default to `configured_by` admin)
    - Dispatch by action: `create_chit`, `add_checklist_item`, `update_chit`, `trigger_rule`
    - `create_chit`: insert new chit with provided fields, compute system tags
    - `add_checklist_item`: find chit by `chit_id` or `chit_title`, append item
    - `update_chit`: update specified fields on target chit
    - `trigger_rule`: fire `ha_webhook` trigger via `dispatch_trigger` with full payload as entity dict
    - Return appropriate HTTP status codes per design error table (401, 400, 404, 500)
    - No session/auth middleware required — token-authenticated
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ] 4.4 Register HA routes in `src/backend/main.py`
    - Import `ha_router` from `routes/ha.py` and `app.include_router(ha_router)`
    - Import and call `start_ha_polling_scheduler()` in `on_startup`
    - _Requirements: 4.1, 9.2_

- [ ] 5. Rules engine extensions
  - [ ] 5.1 Add `call_ha_service` action to `execute_action()` in `src/backend/rules_engine.py`
    - New `elif action_type == "call_ha_service"` branch
    - Import and call `ha_bridge.call_ha_service()` with template substitution on service_data
    - Build context dict from entity (chit_title, chit_status) and rule_name
    - Return success/failure result for execution log
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [ ] 5.1a Add `fire_ha_event` action to `execute_action()` in `src/backend/rules_engine.py`
    - New `elif action_type == "fire_ha_event"` branch
    - Import and call `ha_bridge.fire_ha_event()` with template substitution on event_data (reuse `substitute_template_placeholders`)
    - Build context dict from entity (chit_title, chit_status) and rule_name
    - Return success/failure result for execution log
    - _Requirements: 14.1, 14.2, 14.5, 14.6_

  - [ ] 5.2 Add `call_ha_service` description to `_build_action_description()` in `src/backend/rules_engine.py`
    - Format: `"Call Home Assistant service {domain}.{service} on {entity_id}"`
    - _Requirements: 2.6, 11.1_

  - [ ] 5.2a Add `fire_ha_event` description to `_build_action_description()` in `src/backend/rules_engine.py`
    - Format: `"Fire Home Assistant event '{event_type}' with {N} data fields"`
    - _Requirements: 14.9_

  - [ ] 5.3 Add `ha_state_change` and `ha_webhook` trigger type support
    - These trigger types work with the existing `dispatch_trigger` function — no code changes needed in the dispatcher itself since it already loads rules by `trigger_type` dynamically
    - Verify that condition tree evaluation works with HA entity dict fields (`ha_entity_id`, `old_state`, `new_state`, `attributes`)
    - _Requirements: 3.1, 3.5, 10.1, 10.2, 10.3_

  - [ ] 5.4 Call `update_monitored_entities()` when rules are created/updated/deleted
    - In `src/backend/routes/rules.py`, after rule create/update/delete operations, call `ha_bridge.update_monitored_entities()` if the rule's trigger_type is `ha_state_change`
    - _Requirements: 9.3, 9.4_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend — Settings page HA section
  - [ ] 7.1 Add HA configuration section to `src/frontend/html/settings.html`
    - New "Home Assistant" section (admin-only, hidden for non-admins)
    - Fields: HA base URL input, access token input (masked by default with toggle), poll interval input
    - Test Connection button with status display
    - Webhook URL display (read-only) with copy button
    - Regenerate Token button with warning text
    - Mobile-friendly layout, 1940s parchment aesthetic matching existing sections
    - _Requirements: 1.1, 1.3, 1.4, 4.10, 5.1, 5.2, 5.3, 5.5_

  - [ ] 7.2 Add HA settings logic to `src/frontend/js/pages/settings.js`
    - Load HA config on page init (admin only), populate fields
    - Save HA config on save (include in existing save flow or separate save button)
    - Test Connection button handler: POST to `/api/ha/config/test`, show result
    - Copy webhook URL button handler
    - Regenerate Token button handler with confirmation dialog
    - Token mask/reveal toggle
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 5.5_

- [ ] 8. Frontend — Rules editor HA action and trigger UI
  - [ ] 8.1 Add HA action fields to the rules editor
    - When `call_ha_service` is selected as action type, show: domain input, service input, entity_id input, service_data key-value editor
    - "Fetch Entities" button → GET `/api/ha/entities` → populate searchable dropdown for entity_id
    - "Fetch Services" button → GET `/api/ha/services` → populate searchable dropdown for domain.service
    - JSON preview of the service call payload below the fields
    - If HA not configured, show message directing user to admin settings, disable fetch buttons
    - Add `call_ha_service` to the action type dropdown in the rules editor
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.1a Add HA event firing fields to the rules editor
    - When `fire_ha_event` is selected as action type, show: event_type input with autocomplete/dropdown suggesting common types (`cwoc_chit_created`, `cwoc_chit_updated`, `cwoc_email_received`, `cwoc_status_changed`, `cwoc_tag_added`), and a key-value editor for event_data
    - JSON preview of the event payload (event_type + event_data) below the fields
    - If HA not configured, show message directing user to admin settings
    - Add `fire_ha_event` to the action type dropdown in the rules editor
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 8.2 Add HA trigger fields to the rules editor
    - Add `ha_state_change` and `ha_webhook` to the trigger type dropdown
    - When `ha_state_change` selected: show entity_id input with "Fetch Entities" autocomplete, store in `schedule_config.ha_entity_id`
    - When `ha_state_change` selected: show hint text about polling interval
    - When `ha_webhook` selected: show hint text about webhook `trigger_rule` action
    - Add `ha_entity_id`, `old_state`, `new_state`, `attributes` to condition field dropdown when trigger is `ha_state_change`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.4_

  - [ ] 8.3 Add HA trigger badge styles to `src/frontend/css/shared/shared-rules.css`
    - Add `.trigger-badge.ha_state_change` and `.trigger-badge.ha_webhook` color styles matching the existing badge pattern
    - _Requirements: 7.1, 10.1_

- [ ] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Property-based tests (`src/backend/test_ha_integration.py`)
  - [ ] 10.1 Create test file with inlined production logic and generators
    - Inline minimal HA bridge logic (config round-trip, template substitution, state change detection, entity simplification, action description, webhook validation/resolution/required fields, monitored entity computation, migration idempotency, payload passthrough, event fire request construction, event fire graceful skip, event fire action description, event fire template substitution)
    - Inline `_encrypt_password` / `_decrypt_password` logic for config round-trip test
    - Random generators for: URLs, tokens, domain/service strings, entity_ids, service_data dicts, webhook payloads, state dicts, event_type strings, event_data dicts
    - Set `_ITERATIONS = 120`
    - Follow existing pattern from `test_rules_engine.py` (unittest + random, no external deps)
    - _Requirements: All_

  - [ ]* 10.2 Property 1: HA Config Save/Read Round-Trip
    - **Property 1: HA Config Save/Read Round-Trip**
    - For any valid HA base URL and access token, saving and reading back SHALL return the same URL and a token that decrypts to the original plaintext
    - **Validates: Requirements 1.2, 1.6**

  - [ ]* 10.3 Property 2: Graceful Skip When Unconfigured
    - **Property 2: Graceful Skip When Unconfigured**
    - For any call_ha_service params, if HA not configured, SHALL return `{success: False}` with warning, no exception
    - **Validates: Requirements 1.5, 2.4**

  - [ ]* 10.4 Property 3: HA Service Call Request Construction
    - **Property 3: HA Service Call Request Construction**
    - For any domain, service, entity_id, service_data, SHALL construct correct POST URL and JSON body with Bearer token
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 10.5 Property 4: Template Placeholder Substitution
    - **Property 4: Template Placeholder Substitution**
    - For any service_data with placeholders and context dict, SHALL replace all placeholders leaving non-placeholder text unchanged
    - **Validates: Requirements 2.5**

  - [ ]* 10.6 Property 5: HA Action Description Format
    - **Property 5: HA Action Description Format**
    - For any domain, service, entity_id, the action description SHALL contain all three values in the specified format
    - **Validates: Requirements 2.6, 11.1**

  - [ ]* 10.7 Property 6: State Change Detection
    - **Property 6: State Change Detection**
    - For any entity_id and two state strings, if different SHALL produce entity dict with required fields; if same SHALL not fire trigger
    - **Validates: Requirements 3.3**

  - [ ]* 10.8 Property 7: Webhook Token Validation
    - **Property 7: Webhook Token Validation**
    - For any request, if token doesn't match stored secret SHALL reject; if matches SHALL proceed
    - **Validates: Requirements 4.2, 4.8, 5.4**

  - [ ]* 10.9 Property 8: Webhook User Resolution
    - **Property 8: Webhook User Resolution**
    - For any payload, if user_id present use it; if absent/empty use configured_by admin
    - **Validates: Requirements 4.3**

  - [ ]* 10.10 Property 12: Webhook Required Field Validation
    - **Property 12: Webhook Required Field Validation**
    - For any payload missing required params for its action, SHALL return error with descriptive message
    - **Validates: Requirements 4.9**

  - [ ]* 10.11 Property 13: Entity List Simplification
    - **Property 13: Entity List Simplification**
    - For any HA states response, proxy SHALL return simplified objects with same count, each containing entity_id, state, friendly_name
    - **Validates: Requirements 8.1**

  - [ ]* 10.12 Property 14: Monitored Entity Set Computation
    - **Property 14: Monitored Entity Set Computation**
    - For any set of rules, monitored set SHALL be union of ha_entity_id values from enabled ha_state_change rules
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 10.13 Property 15: Webhook Payload Passthrough
    - **Property 15: Webhook Payload Passthrough**
    - For any trigger_rule webhook payload, entity dict passed to dispatcher SHALL contain all original fields
    - **Validates: Requirements 10.2**

  - [ ]* 10.14 Property 16: Migration Idempotency
    - **Property 16: Migration Idempotency**
    - For any number of consecutive migration calls, SHALL complete without error and table SHALL exist with correct schema
    - **Validates: Requirements 12.2**

  - [ ]* 10.15 Property 17: HA Event Fire Request Construction
    - **Property 17: HA Event Fire Request Construction**
    - For any valid event_type and optional event_data dict, SHALL construct correct POST URL `{ha_base_url}/api/events/{event_type}` and JSON body with Bearer token
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 10.16 Property 18: HA Event Fire Graceful Skip When Unconfigured
    - **Property 18: HA Event Fire Graceful Skip When Unconfigured**
    - For any fire_ha_event params, if HA not configured, SHALL return `{success: False}` with warning, no exception
    - **Validates: Requirements 14.6**

  - [ ]* 10.17 Property 19: HA Event Fire Action Description Format
    - **Property 19: HA Event Fire Action Description Format**
    - For any event_type and event_data dict with N keys, the action description SHALL contain the event_type and count in the specified format
    - **Validates: Requirements 14.9**

  - [ ]* 10.18 Property 20: HA Event Fire Template Placeholder Substitution
    - **Property 20: HA Event Fire Template Placeholder Substitution**
    - For any event_data with placeholders and context dict, SHALL replace all placeholders leaving non-placeholder text unchanged (validates the fire_ha_event code path reuses substitution correctly)
    - **Validates: Requirements 14.5**

- [ ] 11. Help page documentation
  - [ ] 11.1 Add "Home Assistant Integration" section to `src/frontend/html/help.html`
    - Setup instructions (admin configures URL and token in settings, webhook URL auto-generated)
    - Common use cases: flash light on email receipt, create chit from HA automation, trigger scene on chit status change, fire HA event when chit created so HA automations can react
    - Webhook payload format with field descriptions for each action (create_chit, add_checklist_item, update_chit, trigger_rule)
    - How to pass `user_id` in webhook payloads to target specific users
    - Event firing documentation: how to use `fire_ha_event` action in rules, common event types, how HA automations subscribe to CWOC events
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.3_

- [ ] 12. Final wiring and cleanup
  - [ ] 12.1 Update `src/INDEX.md` with all new files, functions, routes, and CSS sections
    - Add `ha_bridge.py` module with all functions (including `fire_ha_event`)
    - Add `routes/ha.py` with all endpoints
    - Add rules engine extensions (new action types `call_ha_service` and `fire_ha_event`, new trigger types, new descriptions)
    - Add new Pydantic models
    - Add new migration function
    - Add new CSS classes
    - Add new frontend functions
    - _Requirements: All_

  - [ ] 12.2 Update `src/VERSION` with current datetime
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - _Requirements: N/A (project convention)_

  - [ ] 12.3 Create release notes file
    - Create `documents/release_notes/cwoc_release_{version}.md` with brief summary of the Home Assistant integration feature
    - _Requirements: N/A (project convention)_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- NO software installation tasks — all code is built using existing dependencies
- Property-based tests use Python stdlib `unittest` + `random` (120 iterations), matching the existing `test_rules_engine.py` pattern
- Frontend is vanilla JS with no frameworks or build step
- Database migration uses inline `CREATE TABLE IF NOT EXISTS` with existence checks
- INDEX.md and VERSION are updated only once at the very end
