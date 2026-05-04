# Requirements Document

## Introduction

The Rules Engine adds "if this, then that" automation to CWOC. Users define rules with triggers, conditions, and actions. When a trigger fires (chit created, email received, scheduled time, etc.), the engine evaluates the rule's condition tree and executes matching actions in priority order. The feature includes a Rules Manager page for listing and managing rules, a Rule Editor page for creating and editing rules with full boolean condition logic, a confirmation safety net for action execution, and full audit log integration. Rules are per-user and execute with the creating user's permissions.

## Glossary

- **Rules_Engine**: The backend evaluation component that listens for trigger events, evaluates condition trees against the triggering entity, and dispatches actions for all matching rules in priority order.
- **Rules_Manager**: The frontend page that lists all of the current user's rules with controls for enabling/disabling, reordering priority, and deleting rules.
- **Rule_Editor**: The frontend form-based page for creating and editing a single rule, including trigger selection, condition tree builder, and action configuration.
- **Condition_Tree**: A recursive boolean expression structure where each node is either a leaf condition (field + operator + value) or a group node (AND/OR containing child nodes). Supports arbitrary nesting depth.
- **Leaf_Condition**: A single comparison in the Condition_Tree consisting of a field name, an operator (equals, contains, regex match, etc.), and a comparison value.
- **Group_Node**: A boolean operator node (AND or OR) in the Condition_Tree that contains one or more child nodes (Leaf_Conditions or nested Group_Nodes).
- **Trigger**: The event type that causes the Rules_Engine to evaluate a rule. One of: chit_created, chit_updated, email_received, contact_created, contact_updated, or scheduled.
- **Action**: An operation the Rules_Engine performs when a rule's conditions are satisfied. Examples: add tag, set status, archive, send notification.
- **Confirmation_Popup**: A modal dialog shown to the user before a rule action is applied, displaying the rule name and proposed action with accept/dismiss buttons.
- **Rule**: A user-defined automation record stored in SQLite containing an id, owner_id, name, description, enabled flag, priority, trigger_type, conditions JSON tree, actions JSON array, confirm_before_apply flag, and execution metadata.
- **Contact_Cross_Reference**: A condition or action that resolves data by looking up the user's contacts — for example, matching a chit's location against contact addresses or adding people whose city matches the chit location.
- **Priority**: An integer sort order that determines the sequence in which matching rules fire. Lower numbers execute first. All matching rules fire (not first-match-wins).

## Requirements

### Requirement 1: Rule Data Model and Storage

**User Story:** As a CWOC user, I want my automation rules stored persistently in the database, so that they survive server restarts and are available whenever I use the app.

#### Acceptance Criteria

1. THE Rules_Engine SHALL store each Rule in a SQLite `rules` table with columns: id (TEXT PRIMARY KEY), owner_id (TEXT), name (TEXT), description (TEXT), enabled (BOOLEAN DEFAULT 1), priority (INTEGER DEFAULT 0), trigger_type (TEXT), conditions (TEXT for JSON), actions (TEXT for JSON), confirm_before_apply (BOOLEAN DEFAULT 1), created_datetime (TEXT), modified_datetime (TEXT), last_run_datetime (TEXT), run_count (INTEGER DEFAULT 0), last_run_result (TEXT)
2. THE Rules_Engine SHALL create the `rules` table via an inline migration in `migrations.py` with column-existence checks, following the existing CWOC migration pattern
3. THE Rules_Engine SHALL scope all rule queries by owner_id so that each user can only read, update, and delete rules owned by that user
4. THE Rules_Engine SHALL store the conditions field as a JSON string representing a Condition_Tree with recursive Group_Nodes and Leaf_Conditions
5. THE Rules_Engine SHALL store the actions field as a JSON array where each element specifies an action type and its parameters

### Requirement 2: Condition Tree Evaluation

**User Story:** As a CWOC user, I want to define complex boolean conditions with AND/OR groups and nested sub-groups, so that my rules can match precisely the situations I care about.

#### Acceptance Criteria

1. THE Rules_Engine SHALL evaluate a Condition_Tree by recursively processing each node: Leaf_Conditions return true or false, and Group_Nodes combine child results using their boolean operator (AND or OR)
2. THE Rules_Engine SHALL support the following operators for Leaf_Conditions: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, greater_than, less_than, regex_match
3. THE Rules_Engine SHALL support conditions on all chit fields including: title, note, status, priority, severity, location, color, tags, people, email_from, email_subject, email_body_text, email_folder, email_read, archived, pinned, all_day, habit
4. THE Rules_Engine SHALL support conditions on contact fields including: given_name, surname, organization, tags, emails, phones, addresses
5. THE Rules_Engine SHALL support special condition types: "tag is present" (checks if a specific tag exists in the tags list), "tag is not present", "person is on chit" (checks if a name exists in the people list), "person is not on chit"
6. THE Rules_Engine SHALL support Contact_Cross_Reference conditions that look up the current user's contacts to resolve comparisons — for example, "location contains city" checks whether the chit's location string matches any city found in the user's contact addresses
7. WHEN a Leaf_Condition references a JSON-serialized field (tags, people, alerts), THE Rules_Engine SHALL deserialize the field before comparison using the existing `deserialize_json_field` helper
8. IF a Leaf_Condition references a field that does not exist on the triggering entity, THEN THE Rules_Engine SHALL treat the condition as not satisfied rather than raising an error
9. WHEN the regex_match operator is used, THE Rules_Engine SHALL compile the pattern with a timeout guard so that a malformed or catastrophic regex does not block rule evaluation

### Requirement 3: Rule Triggers

**User Story:** As a CWOC user, I want my rules to fire automatically when specific events happen in CWOC, so that I do not have to manually perform repetitive actions.

#### Acceptance Criteria

1. WHEN a chit is created via the API, THE Rules_Engine SHALL evaluate all enabled rules with trigger_type "chit_created" against the new chit
2. WHEN a chit is updated via the API, THE Rules_Engine SHALL evaluate all enabled rules with trigger_type "chit_updated" against the updated chit
3. WHEN a new email chit is created during IMAP sync, THE Rules_Engine SHALL evaluate all enabled rules with trigger_type "email_received" against the new email chit
4. WHEN a contact is created via the API, THE Rules_Engine SHALL evaluate all enabled rules with trigger_type "contact_created" against the new contact
5. WHEN a contact is updated via the API, THE Rules_Engine SHALL evaluate all enabled rules with trigger_type "contact_updated" against the updated contact
6. THE Rules_Engine SHALL support scheduled triggers with configurable timing (daily at a specific time, every N hours) that evaluate rules against all chits or contacts matching the conditions at the scheduled time
7. THE Rules_Engine SHALL evaluate triggered rules in ascending priority order (lower priority number executes first) so that rule execution order is deterministic and user-controllable
8. WHEN multiple rules match the same trigger event, THE Rules_Engine SHALL execute all matching rules (not first-match-wins), each in priority order

### Requirement 4: Rule Actions

**User Story:** As a CWOC user, I want rules to perform a variety of actions on my chits and contacts, so that I can automate common workflows like tagging, prioritizing, and organizing.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support the following chit actions: add_tag, remove_tag, set_status, set_priority, set_severity, set_color, set_location, add_person, archive, move_to_trash, add_to_project, add_alert, share_with_user, assign_to_user
2. THE Rules_Engine SHALL support the following email-specific actions: mark_email_read, mark_email_unread, move_email_to_folder
3. THE Rules_Engine SHALL support a send_notification action that sends a push notification and/or ntfy notification with a user-configured message template
4. THE Rules_Engine SHALL support a Contact_Cross_Reference action "add person whose city matches chit location" that looks up the user's contacts, finds contacts with an address containing the chit's location city, and adds their display names to the chit's people list
5. WHEN an action modifies a chit, THE Rules_Engine SHALL update the chit's modified_datetime field
6. WHEN an action modifies a chit, THE Rules_Engine SHALL recompute system tags using the existing `compute_system_tags` function
7. THE Rules_Engine SHALL execute actions using the same permission checks as manual operations — a rule cannot modify a chit the owning user does not have edit access to
8. IF an action fails (database error, permission denied, invalid target), THEN THE Rules_Engine SHALL log the failure in the rule's last_run_result field and continue executing remaining actions for that rule

### Requirement 5: Confirmation Mode

**User Story:** As a CWOC user, I want a safety net that asks me to confirm rule actions before they are applied, so that I can verify automation behavior before trusting it to run unattended.

#### Acceptance Criteria

1. WHILE a Rule has confirm_before_apply set to true, THE Rules_Engine SHALL queue the action for confirmation rather than executing it immediately
2. WHEN an action is queued for confirmation, THE Rules_Engine SHALL store a pending confirmation record with the rule id, rule name, proposed action description, target entity id, and a timestamp
3. THE Confirmation_Popup SHALL display the rule name and a human-readable description of the proposed action (e.g., "Rule 'Auto-tag invoices' wants to add tag 'Invoice' to chit 'Meeting Notes'") with Accept and Dismiss buttons
4. WHEN the user clicks Accept on a Confirmation_Popup, THE Rules_Engine SHALL execute the queued action and remove the pending confirmation record
5. WHEN the user clicks Dismiss on a Confirmation_Popup, THE Rules_Engine SHALL discard the queued action without applying it and remove the pending confirmation record
6. THE Rules_Engine SHALL expose a REST endpoint to list pending confirmations for the current user so the frontend can poll for and display them
7. WHILE a Rule has confirm_before_apply set to false, THE Rules_Engine SHALL execute matching actions immediately without queuing for confirmation

### Requirement 6: Audit Logging for Rule Actions

**User Story:** As a CWOC user, I want all rule-triggered changes recorded in the audit log with the rule's identity, so that I can trace which automations modified my data.

#### Acceptance Criteria

1. WHEN a rule action modifies an entity, THE Rules_Engine SHALL insert an audit log entry using the existing `insert_audit_entry` function with entity_type set to the target type (e.g., "chit", "contact")
2. THE Rules_Engine SHALL set the audit actor field to a string in the format "Rule: {rule_name} ({rule_id}) on behalf of {username} ({user_id})" so that rule-triggered changes are distinguishable from manual changes
3. THE Rules_Engine SHALL include the computed diff of changes in the audit entry using the existing `compute_audit_diff` function
4. WHEN a rule executes, THE Rules_Engine SHALL update the rule's last_run_datetime to the current UTC timestamp, increment run_count by 1, and set last_run_result to a summary string (e.g., "success: 2 actions applied" or "partial: 1 of 3 actions failed")

### Requirement 7: Rules CRUD API

**User Story:** As a CWOC user, I want REST API endpoints for creating, reading, updating, and deleting my rules, so that the frontend can manage rules through standard HTTP calls.

#### Acceptance Criteria

1. THE Rules_Engine SHALL expose a GET `/api/rules` endpoint that returns all rules owned by the authenticated user, sorted by priority ascending
2. THE Rules_Engine SHALL expose a GET `/api/rules/{rule_id}` endpoint that returns a single rule if owned by the authenticated user
3. THE Rules_Engine SHALL expose a POST `/api/rules` endpoint that creates a new rule with a generated UUID, sets owner_id to the authenticated user, and returns the created rule
4. THE Rules_Engine SHALL expose a PUT `/api/rules/{rule_id}` endpoint that updates an existing rule if owned by the authenticated user
5. THE Rules_Engine SHALL expose a DELETE `/api/rules/{rule_id}` endpoint that deletes a rule if owned by the authenticated user
6. THE Rules_Engine SHALL expose a PATCH `/api/rules/{rule_id}/toggle` endpoint that toggles the enabled flag of a rule owned by the authenticated user
7. THE Rules_Engine SHALL expose a PUT `/api/rules/reorder` endpoint that accepts an ordered list of rule IDs and updates their priority values to match the new order
8. THE Rules_Engine SHALL validate rule input using a Pydantic v1 model with Optional fields and defaults, following the existing CWOC model pattern
9. IF a rule CRUD operation targets a rule not owned by the authenticated user, THEN THE Rules_Engine SHALL return HTTP 404 to avoid leaking the existence of other users' rules

### Requirement 8: Pending Confirmations API

**User Story:** As a CWOC user, I want API endpoints for managing pending rule confirmations, so that the frontend can display and resolve them.

#### Acceptance Criteria

1. THE Rules_Engine SHALL expose a GET `/api/rules/confirmations` endpoint that returns all pending confirmation records for the authenticated user, sorted by timestamp descending
2. THE Rules_Engine SHALL expose a POST `/api/rules/confirmations/{confirmation_id}/accept` endpoint that executes the queued action and deletes the confirmation record
3. THE Rules_Engine SHALL expose a POST `/api/rules/confirmations/{confirmation_id}/dismiss` endpoint that discards the queued action and deletes the confirmation record
4. THE Rules_Engine SHALL store pending confirmations in a `rule_confirmations` SQLite table with columns: id (TEXT PRIMARY KEY), rule_id (TEXT), rule_name (TEXT), owner_id (TEXT), action_description (TEXT), action_data (TEXT for JSON), target_entity_type (TEXT), target_entity_id (TEXT), created_datetime (TEXT)

### Requirement 9: Rules Manager Page

**User Story:** As a CWOC user, I want a dedicated page to see all my rules at a glance and manage them, so that I can quickly enable, disable, reorder, or delete rules.

#### Acceptance Criteria

1. THE Rules_Manager SHALL be accessible via a 🤖 Rules sidebar button placed in a half-width row next to the Calculator button in the sidebar
2. THE Rules_Manager SHALL be accessible via the F10 keyboard hotkey from the dashboard
3. THE Rules_Manager SHALL display a table of all rules owned by the current user with columns: enabled toggle, name, trigger type, priority, last run datetime, and run count
4. THE Rules_Manager SHALL allow the user to toggle a rule's enabled state by clicking an enable/disable toggle in the rule row
5. THE Rules_Manager SHALL allow the user to reorder rules by drag-and-drop, updating priority values via the reorder API endpoint
6. THE Rules_Manager SHALL allow the user to delete a rule with a confirmation prompt before deletion
7. THE Rules_Manager SHALL provide a "New Rule" button that navigates to the Rule_Editor page for creating a new rule
8. WHEN the user clicks a rule name in the Rules_Manager, THE Rules_Manager SHALL navigate to the Rule_Editor page with that rule loaded for editing
9. THE Rules_Manager SHALL display a pending confirmations section at the top of the page showing any queued rule actions awaiting user approval, with Accept and Dismiss buttons for each
10. THE Rules_Manager SHALL start from `_template.html` and use `shared-page.js` for header/footer injection, following the existing CWOC secondary page pattern
11. THE Rules_Manager SHALL use the existing parchment/brown aesthetic with Lora serif font, matching the visual style of other CWOC pages

### Requirement 10: Rule Editor Page

**User Story:** As a CWOC user, I want a form-based editor for creating and editing rules with visual condition tree building, so that I can define complex automations without writing code.

#### Acceptance Criteria

1. THE Rule_Editor SHALL provide a text input for the rule name and an optional text input for the rule description
2. THE Rule_Editor SHALL provide a dropdown to select the trigger type from the available triggers: Chit Created, Chit Updated, Email Received, Contact Created, Contact Updated, Scheduled
3. WHEN the Scheduled trigger type is selected, THE Rule_Editor SHALL display additional fields for configuring the schedule: frequency (daily, every N hours) and time of day
4. THE Rule_Editor SHALL provide a visual condition tree builder that allows the user to add Leaf_Conditions, add Group_Nodes (AND/OR), nest groups within groups, and remove any node
5. THE Rule_Editor SHALL provide dropdowns for each Leaf_Condition to select the field, operator, and a text input for the comparison value
6. THE Rule_Editor SHALL dynamically filter the available fields based on the selected trigger type — chit triggers show chit fields, contact triggers show contact fields, email triggers show chit fields plus email-specific fields
7. THE Rule_Editor SHALL provide an actions section where the user can add one or more actions, each with a dropdown for action type and relevant parameter inputs
8. THE Rule_Editor SHALL provide a toggle for the confirm_before_apply setting, defaulting to enabled
9. THE Rule_Editor SHALL use the CwocSaveSystem pattern for save/cancel buttons with dirty-state tracking
10. THE Rule_Editor SHALL validate that the rule has a name, a trigger type, at least one condition, and at least one action before allowing save
11. THE Rule_Editor SHALL start from `_template.html` and use `shared-page.js` for header/footer injection, following the existing CWOC secondary page pattern
12. THE Rule_Editor SHALL be mobile-friendly with responsive layout that works on small screens

### Requirement 11: Scheduled Rule Execution

**User Story:** As a CWOC user, I want rules that run on a schedule (daily, hourly), so that I can automate periodic tasks like tagging overdue chits or sending daily summaries.

#### Acceptance Criteria

1. THE Rules_Engine SHALL run a background loop (similar to the existing weather and alert scheduler loops) that checks for scheduled rules at their configured intervals
2. WHEN a scheduled rule's configured time arrives, THE Rules_Engine SHALL query all entities matching the rule's trigger scope (all chits for chit-scoped rules, all contacts for contact-scoped rules) and evaluate the condition tree against each entity
3. THE Rules_Engine SHALL execute actions on all entities that satisfy the condition tree, respecting the confirmation mode setting
4. THE Rules_Engine SHALL track the last execution time for each scheduled rule to prevent duplicate executions within the same interval
5. IF the server restarts during a scheduled interval, THEN THE Rules_Engine SHALL check last_run_datetime on startup and execute any overdue scheduled rules

### Requirement 12: Condition Tree Serialization Round-Trip

**User Story:** As a developer, I want the condition tree JSON to serialize and deserialize without data loss, so that rules are stored and retrieved faithfully.

#### Acceptance Criteria

1. THE Rules_Engine SHALL serialize Condition_Trees to JSON using the existing `serialize_json_field` helper
2. THE Rules_Engine SHALL deserialize Condition_Trees from JSON using the existing `deserialize_json_field` helper
3. FOR ALL valid Condition_Trees, serializing then deserializing SHALL produce an equivalent Condition_Tree structure (round-trip property)
4. THE Rules_Engine SHALL validate the deserialized Condition_Tree structure on load, verifying that each node is either a valid Leaf_Condition (has field, operator, value keys) or a valid Group_Node (has operator as "AND" or "OR" and a children array)

### Requirement 13: Rule Execution Logging

**User Story:** As a CWOC user, I want to see a log of when my rules ran and what they did, so that I can troubleshoot automation behavior.

#### Acceptance Criteria

1. THE Rules_Engine SHALL maintain a `rule_execution_log` SQLite table with columns: id (TEXT PRIMARY KEY), rule_id (TEXT), owner_id (TEXT), trigger_event (TEXT), entities_evaluated (INTEGER), entities_matched (INTEGER), actions_executed (INTEGER), actions_failed (INTEGER), result_summary (TEXT), executed_datetime (TEXT)
2. WHEN a rule is evaluated (regardless of whether conditions match), THE Rules_Engine SHALL insert an execution log entry recording the trigger event, count of entities evaluated, count matched, actions executed, and actions failed
3. THE Rules_Engine SHALL expose a GET `/api/rules/{rule_id}/log` endpoint that returns execution log entries for a specific rule owned by the authenticated user, sorted by executed_datetime descending, with pagination support
4. THE Rules_Engine SHALL expose a GET `/api/rules/log` endpoint that returns execution log entries across all rules owned by the authenticated user, with optional filters for rule_id and date range

### Requirement 14: Sidebar and Hotkey Integration

**User Story:** As a CWOC user, I want quick access to the Rules Manager from the sidebar and via keyboard, so that managing rules is as convenient as other CWOC features.

#### Acceptance Criteria

1. THE Rules_Manager sidebar button SHALL be placed in a half-width row alongside the Calculator button, using the existing `sidebar-compact-btn` CSS class
2. THE Rules_Manager sidebar button SHALL display the 🤖 emoji and the text "Rules"
3. WHEN the user presses F10 on the dashboard, THE Rules_Manager page SHALL open
4. THE Rules_Manager sidebar button SHALL navigate to the Rules Manager page on click, following the same navigation pattern as other sidebar buttons (e.g., People, Weather)
5. THE Rules_Manager hotkey SHALL be registered in the existing hotkey system in `main-hotkeys.js` and displayed in the keyboard shortcuts reference overlay
