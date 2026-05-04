# Implementation Plan: Rules Engine

## Overview

The Rules Engine adds "if this, then that" automation to CWOC. Implementation proceeds in layers: data model and migration first, then the pure-function evaluation engine, then the REST API, then trigger hooks and scheduler, then the frontend pages, and finally integration wiring and housekeeping. Each task builds on the previous ones so there is no orphaned code.

**CRITICAL CONSTRAINTS:**
- NO pip installs, NO npm installs, NO software installation of any kind
- Tests use Python stdlib only (unittest + random) — no hypothesis or external libraries
- All tests runnable with `python -m pytest` without installing anything
- Update Mega Index (src/INDEX.md) only once at the very end
- Update version number only once at the very end
- Update release notes only once at the very end

## Tasks

- [x] 1. Database migration and Pydantic models
  - [x] 1.1 Add `migrate_create_rules_tables()` to `src/backend/migrations.py`
    - Create `rules`, `rule_confirmations`, and `rule_execution_log` tables using `CREATE TABLE IF NOT EXISTS`
    - Follow the existing inline migration pattern with column-existence checks
    - Include all columns from the design: id, owner_id, name, description, enabled, priority, trigger_type, conditions, actions, confirm_before_apply, schedule_config, created_datetime, modified_datetime, last_run_datetime, run_count, last_run_result for rules table
    - Include all columns for rule_confirmations and rule_execution_log tables per design
    - _Requirements: 1.1, 1.2, 8.4, 13.1_

  - [x] 1.2 Add `RuleCreate`, `RuleUpdate`, and `RuleReorder` Pydantic models to `src/backend/models.py`
    - Follow existing Pydantic v1 pattern with Optional fields and defaults
    - `RuleCreate`: name (str), description (Optional), enabled (Optional bool, default True), priority (Optional int, default 0), trigger_type (str), conditions (Optional dict), actions (Optional list), confirm_before_apply (Optional bool, default True), schedule_config (Optional dict)
    - `RuleUpdate`: all fields Optional
    - `RuleReorder`: rule_ids (List[str])
    - _Requirements: 7.8_

- [x] 2. Condition tree evaluator — pure-function engine
  - [x] 2.1 Create `src/backend/rules_engine.py` with condition tree evaluation functions
    - Implement `evaluate_condition_tree(tree, entity, contacts=None)` — recursive group/leaf evaluator
    - Implement `evaluate_leaf(leaf, entity, contacts=None)` — single leaf condition evaluator
    - Support all 14 operators: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, greater_than, less_than, regex_match, tag_present, tag_not_present, person_on_chit, person_not_on_chit
    - Deserialize JSON-serialized list fields (tags, people, alerts) before comparison using `deserialize_json_field`
    - Return False for missing fields instead of raising errors
    - Implement `_regex_match_with_timeout(pattern, text, timeout_seconds=2)` with signal-based timeout guard
    - Implement `resolve_contact_cross_ref(field, operator, value, entity, contacts)` for contact cross-reference conditions
    - Implement `validate_condition_tree(tree)` — validates structure (leaf has field/operator/value, group has operator AND/OR and children array)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 12.4_

  - [x] 2.2 Write property test: Condition Tree Serialization Round-Trip
    - **Property 1: Condition Tree Serialization Round-Trip**
    - Generate random condition trees with arbitrary nesting, serialize via `serialize_json_field`, deserialize via `deserialize_json_field`, verify structural equivalence
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 1.4, 12.1, 12.2, 12.3**

  - [x] 2.3 Write property test: Leaf Condition Operator Correctness
    - **Property 2: Leaf Condition Operator Correctness**
    - Generate random entities and leaf conditions for each supported operator, verify correct boolean result against operator semantics
    - Include JSON-serialized list field deserialization verification
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 2.2, 2.5, 2.7**

  - [x] 2.4 Write property test: Boolean Group Evaluation Correctness
    - **Property 3: Boolean Group Evaluation Correctness**
    - Generate random nested AND/OR trees with known leaf values, verify group evaluation matches expected boolean logic (AND = all, OR = any) at every nesting level
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 2.1**

  - [x] 2.5 Write property test: Missing Field Safety
    - **Property 4: Missing Field Safety**
    - Generate random field names not present on entity, verify evaluator returns False without raising exceptions
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 2.8**

  - [x] 2.6 Write property test: Condition Tree Validation
    - **Property 10: Condition Tree Validation**
    - Generate random valid and invalid condition trees, verify validation accepts valid trees and rejects malformed ones (missing keys, invalid operator, non-array children)
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 12.4**

- [x] 3. Action executor and trigger dispatcher
  - [x] 3.1 Add action executor to `src/backend/rules_engine.py`
    - Implement `execute_action(action, entity_type, entity_id, owner_id, rule_name, rule_id)` returning `{"success": bool, "message": str}`
    - Support all chit actions: add_tag, remove_tag, set_status, set_priority, set_severity, set_color, set_location, add_person, archive, move_to_trash, add_to_project, add_alert, share_with_user, assign_to_user
    - Support email actions: mark_email_read, mark_email_unread, move_email_to_folder
    - Support send_notification action using existing push/ntfy helpers
    - Support add_matching_contacts_as_people contact cross-reference action
    - Each action: read entity, verify owner access, apply modification, update modified_datetime, recompute system tags via `compute_system_tags()`, insert audit entry with actor format `"Rule: {rule_name} ({rule_id}) on behalf of {username} ({user_id})"`
    - On failure: log error, return failure result, continue (don't raise)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.1, 6.2, 6.3_

  - [x] 3.2 Add trigger dispatcher to `src/backend/rules_engine.py`
    - Implement `async dispatch_trigger(trigger_type, entity_type, entity, owner_id)` as fire-and-forget background task
    - Load all enabled rules for owner_id with matching trigger_type, ordered by priority ASC
    - For each rule: evaluate condition tree, handle confirm_before_apply branching (queue to rule_confirmations or execute immediately)
    - Insert rule_execution_log entry for every rule evaluated
    - Update rule's last_run_datetime, increment run_count, set last_run_result
    - Load contacts once if any rule uses contact cross-reference conditions
    - _Requirements: 3.7, 3.8, 5.1, 5.2, 5.7, 6.4, 13.2_

  - [x] 3.3 Write property test: Dispatch Priority Ordering and All-Match Semantics
    - **Property 5: Dispatch Priority Ordering and All-Match Semantics**
    - Generate random rule sets with different priorities, verify dispatch evaluates in ascending priority order and executes ALL matching rules
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 3.7, 3.8**

  - [x] 3.4 Write property test: Confirmation Mode Branching
    - **Property 8: Confirmation Mode Branching**
    - Generate random rules with confirm_before_apply True/False, verify queuing vs immediate execution behavior
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 5.1, 5.2, 5.7**

  - [x] 3.5 Write property test: Action Failure Continuation
    - **Property 7: Action Failure Continuation**
    - Generate action sequences where some actions fail, verify executor continues executing remaining actions and logs failures
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 4.8**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass with `python -m pytest src/backend/test_rules_engine.py -v`, ask the user if questions arise.
  - NO pip installs — tests must run with stdlib only

- [x] 5. Rules CRUD API routes
  - [x] 5.1 Create `src/backend/routes/rules.py` with all 12 REST endpoints
    - GET `/api/rules` — list all rules for authenticated user, sorted by priority ASC
    - GET `/api/rules/{rule_id}` — get single rule (404 if not owned)
    - POST `/api/rules` — create new rule (UUID generated, owner_id from auth)
    - PUT `/api/rules/{rule_id}` — update existing rule (404 if not owned)
    - DELETE `/api/rules/{rule_id}` — delete rule (404 if not owned)
    - PATCH `/api/rules/{rule_id}/toggle` — toggle enabled flag
    - PUT `/api/rules/reorder` — accept ordered list of rule IDs, update priorities
    - GET `/api/rules/confirmations` — list pending confirmations for user
    - POST `/api/rules/confirmations/{id}/accept` — execute queued action, delete confirmation
    - POST `/api/rules/confirmations/{id}/dismiss` — discard queued action, delete confirmation
    - GET `/api/rules/{rule_id}/log` — execution log for specific rule (paginated)
    - GET `/api/rules/log` — execution log across all rules (filterable)
    - Use `get_actor_from_request()` for authentication, scope all queries by owner_id
    - Return 404 for rules not owned by authenticated user (avoid leaking existence)
    - Use RuleCreate/RuleUpdate/RuleReorder Pydantic models for validation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.2, 8.3, 13.3, 13.4_

  - [x] 5.2 Write property test: Owner Scoping Isolation
    - **Property 11: Owner Scoping Isolation**
    - Generate random users and rules, verify querying with user A's owner_id never returns user B's rules
    - Minimum 100 iterations using stdlib random — no external libraries
    - **Validates: Requirements 1.3, 7.9**

- [x] 6. Trigger hooks in existing route handlers
  - [x] 6.1 Add trigger hooks to `src/backend/routes/chits.py`
    - After chit create: call `dispatch_trigger("chit_created", "chit", chit_data, owner_id)` as fire-and-forget background task
    - After chit update: call `dispatch_trigger("chit_updated", "chit", chit_data, owner_id)` as fire-and-forget background task
    - After email chit creation (IMAP sync path): call `dispatch_trigger("email_received", "chit", chit_data, owner_id)`
    - Import dispatch_trigger from rules_engine
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Add trigger hooks to `src/backend/routes/contacts.py`
    - After contact create: call `dispatch_trigger("contact_created", "contact", contact_data, owner_id)` as fire-and-forget background task
    - After contact update: call `dispatch_trigger("contact_updated", "contact", contact_data, owner_id)` as fire-and-forget background task
    - Import dispatch_trigger from rules_engine
    - _Requirements: 3.4, 3.5_

- [x] 7. Scheduled rule execution
  - [x] 7.1 Add `start_rules_scheduler()` to `src/backend/schedulers.py`
    - Background loop checking for scheduled rules every 60 seconds
    - For each due scheduled rule: query all matching entities, evaluate condition tree against each, execute/queue actions
    - Track last execution time to prevent duplicate runs within same interval
    - On server restart: check last_run_datetime and execute overdue scheduled rules
    - Follow the same pattern as `start_weather_schedulers()`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 8. Register rules in main.py
  - [x] 8.1 Update `src/backend/main.py` to register rules routes, migration, and scheduler
    - Import and call `migrate_create_rules_tables()` in the migration sequence
    - Import and include the rules router from `routes/rules.py`
    - Import and call `start_rules_scheduler()` in the startup event
    - _Requirements: 1.2, 3.6, 11.1_

- [x] 9. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass with `python -m pytest src/backend/test_rules_engine.py -v`, ask the user if questions arise.
  - NO pip installs — tests must run with stdlib only

- [x] 10. Frontend — Rules Manager page
  - [x] 10.1 Create `src/frontend/html/rules-manager.html`
    - Start from `_template.html` with `data-page-title="Rules Manager"` and `data-page-icon="🤖"`
    - Use `shared-page.js` for header/footer injection
    - Include `shared-rules.css` stylesheet link
    - Pending confirmations section at top (collapsible, hidden when empty) with Accept/Dismiss buttons
    - Rules table with columns: enabled toggle, name (clickable), trigger type badge, priority, last run, run count
    - "New Rule" button navigating to rule-editor.html
    - Parchment/brown aesthetic with Lora serif font
    - Mobile-friendly responsive layout
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_

  - [x] 10.2 Create `src/frontend/js/pages/rules-manager.js`
    - Fetch and display rules from GET `/api/rules`
    - Toggle enabled state via PATCH `/api/rules/{id}/toggle`
    - Drag-and-drop reorder via PUT `/api/rules/reorder` (use `shared-sort.js` pattern)
    - Delete with confirmation via `cwocConfirm()` then DELETE `/api/rules/{id}`
    - Click rule name to navigate to `rule-editor.html?id={rule_id}`
    - Poll and display pending confirmations from GET `/api/rules/confirmations`
    - Accept/Dismiss confirmations via POST endpoints
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

- [x] 11. Frontend — Rule Editor page
  - [x] 11.1 Create `src/frontend/html/rule-editor.html`
    - Start from `_template.html` with `data-page-title="Rule Editor"` and `data-page-icon="🤖"`
    - Use `shared-page.js` for header/footer injection
    - Include `shared-rules.css` stylesheet link
    - Sections: Rule Info (name, description), Trigger (dropdown), Conditions (tree builder area), Actions (list area), Settings (confirm toggle), Save/Cancel
    - Use `CwocSaveSystem` for save/cancel with dirty-state tracking
    - Mobile-friendly responsive layout
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12_

  - [x] 11.2 Create `src/frontend/js/pages/rule-editor.js`
    - Load existing rule data if `?id=` query param present (GET `/api/rules/{id}`)
    - Trigger type dropdown with dynamic field filtering for conditions
    - Visual condition tree builder: add leaf conditions, add AND/OR groups, nest groups, remove nodes
    - Field dropdown filtered by trigger type (chit fields, contact fields, email fields)
    - Actions section: add/remove action rows with type dropdown and dynamic parameter inputs
    - Scheduled trigger: show frequency and time-of-day inputs when "Scheduled" selected
    - Confirm before apply toggle (default: on)
    - Validation: require name, trigger type, at least one condition, at least one action
    - Save via POST (new) or PUT (existing) to `/api/rules` endpoints
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [x] 12. Frontend — Shared CSS for rules pages
  - [x] 12.1 Create `src/frontend/css/shared/shared-rules.css`
    - Condition tree styles: indentation, left-border lines for nesting, group operator toggles
    - Action row styles: type dropdown, parameter inputs, add/remove buttons
    - Rules table styles: enabled toggle, trigger type badges, drag handle
    - Pending confirmations section styles
    - Responsive breakpoints for mobile
    - Follow parchment/brown aesthetic, use existing CSS variables from `shared-page.css`
    - _Requirements: 9.11, 10.12_

- [x] 13. Sidebar button and F10 hotkey
  - [x] 13.1 Add 🤖 Rules sidebar button to `src/frontend/js/shared/shared-sidebar.js`
    - Place in half-width row next to Calculator button using `sidebar-compact-btn` CSS class
    - Display 🤖 emoji and "Rules" text
    - Navigate to `/frontend/html/rules-manager.html` on click
    - Add title attribute "Rules Engine (F10)"
    - _Requirements: 14.1, 14.2, 14.4_

  - [x] 13.2 Register F10 hotkey in `src/frontend/js/dashboard/main-hotkeys.js`
    - Navigate to `/frontend/html/rules-manager.html` on F10 press
    - Follow existing hotkey registration pattern (e.g., F4 for Calculator)
    - Add to keyboard shortcuts reference overlay
    - _Requirements: 9.2, 14.3, 14.5_

- [x] 14. Checkpoint — Verify frontend pages load and backend integration works
  - Ensure all tests pass with `python -m pytest src/backend/test_rules_engine.py -v`, ask the user if questions arise.
  - Verify no syntax errors in all new JS/HTML/CSS files
  - NO pip installs, NO npm installs

- [x] 15. Update Mega Index, version, and release notes
  - [x] 15.1 Update `src/INDEX.md` with all new files, functions, routes, and CSS sections
    - Add rules_engine.py functions (evaluate_condition_tree, evaluate_leaf, execute_action, dispatch_trigger, validate_condition_tree, etc.)
    - Add routes/rules.py endpoints (all 12 REST endpoints)
    - Add new Pydantic models (RuleCreate, RuleUpdate, RuleReorder)
    - Add migration function (migrate_create_rules_tables)
    - Add scheduler function (start_rules_scheduler)
    - Add frontend files (rules-manager.html, rule-editor.html, rules-manager.js, rule-editor.js, shared-rules.css)
    - Add sidebar and hotkey additions
    - _Requirements: all_

  - [x] 15.2 Update version number in `src/VERSION`
    - Run `date "+%Y%m%d.%H%M"` to get the real timestamp
    - Write the timestamp to `src/VERSION`
    - Do this ONCE at the very end — never guess the time

  - [x] 15.3 Create release notes file
    - Create `documents/release_notes/cwoc_release_{version}.md` with brief summary of the Rules Engine feature
    - _Requirements: all_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass with `python -m pytest src/backend/test_rules_engine.py -v`, ask the user if questions arise.
  - Verify no regressions in existing tests
  - NO pip installs, NO npm installs

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using stdlib only (unittest + random)
- Unit tests validate specific examples and edge cases
- NO software installation at any point — no pip, no npm, no hypothesis
- Tests must be runnable with `python -m pytest` without installing anything
- Mega Index, version, and release notes are updated only once at the very end (task 15)
