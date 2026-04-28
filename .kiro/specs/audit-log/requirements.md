# Requirements Document

## Introduction

The Audit Log feature provides a comprehensive change-tracking system for CWOC. Every create, update, and delete operation on chits, contacts, and settings is recorded in a dedicated audit log table. Each log entry captures who made the change (the username from settings), what entity was affected, which fields changed (with before and after values), and when the change occurred. The audit history is viewable per chit, per contact, and globally through a dedicated audit log page. This enables users to understand the full history of their data and diagnose unintended changes.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application
- **Audit_Log**: A persistent record of all create, update, and delete operations performed on tracked entities (chits, contacts, settings)
- **Audit_Entry**: A single row in the audit_log database table representing one change event
- **Backend_API**: The FastAPI backend (`backend/main.py`) serving REST endpoints under `/api/`
- **Settings_Page**: The CWOC settings page (`frontend/settings.html`)
- **Editor_Page**: The CWOC chit editor page (`frontend/editor.html`)
- **Audit_Log_Page**: A new dedicated page (`frontend/audit-log.html`) for viewing the global audit history
- **Entity_Type**: The category of the changed record — one of "chit", "contact", or "settings"
- **Action_Type**: The kind of operation performed — one of "created", "updated", or "deleted"
- **Change_Detail**: A JSON object describing which fields changed, containing field name, old value, and new value for each modified field
- **Actor**: The username string from the settings table identifying who performed the change; defaults to "system" when no username is configured
- **Audit_Panel**: An inline expandable section on the Editor_Page or contact detail view showing the audit history for that specific entity

## Requirements

### Requirement 1: Audit Log Database Table

**User Story:** As a developer, I want a dedicated database table for audit log entries, so that all change history is stored persistently and queryable.

#### Acceptance Criteria

1. THE Backend_API SHALL create an `audit_log` table at startup using the existing inline migration pattern with column-existence checks
2. THE `audit_log` table SHALL contain the columns: `id` (TEXT, primary key, UUID), `entity_type` (TEXT, one of "chit", "contact", "settings"), `entity_id` (TEXT, the ID of the changed record), `action` (TEXT, one of "created", "updated", "deleted"), `actor` (TEXT, the username of the user who made the change), `timestamp` (TEXT, ISO 8601 datetime), `changes` (TEXT, JSON-serialized Change_Detail), and `entity_summary` (TEXT, a human-readable label for the affected entity such as the chit title or contact display name)
3. THE Backend_API SHALL create an index on the `audit_log` table covering `entity_type` and `entity_id` columns for efficient per-entity queries
4. THE Backend_API SHALL create an index on the `audit_log` table covering the `timestamp` column for efficient chronological queries

### Requirement 2: Capture Username as Actor

**User Story:** As a CWOC user, I want audit entries to record who made each change, so that I can identify the source of modifications.

#### Acceptance Criteria

1. WHEN recording an Audit_Entry, THE Backend_API SHALL read the current username from the settings table for user "default_user"
2. IF no username is configured in settings, THEN THE Backend_API SHALL use the string "system" as the Actor value
3. THE Actor value in each Audit_Entry SHALL be the username string at the time the change was made, stored as a snapshot (not a foreign key reference)

### Requirement 3: Audit Chit Changes

**User Story:** As a CWOC user, I want all changes to my chits recorded in the audit log, so that I can review the full history of any chit.

#### Acceptance Criteria

1. WHEN a chit is created via `PUT /api/chits/{chit_id}` (new chit path), THE Backend_API SHALL insert an Audit_Entry with action "created", the chit ID as entity_id, entity_type "chit", and the chit title as entity_summary
2. WHEN a chit is updated via `PUT /api/chits/{chit_id}` (existing chit path), THE Backend_API SHALL insert an Audit_Entry with action "updated" containing a Change_Detail listing each field that differs between the old and new values
3. WHEN a chit is soft-deleted via `DELETE /api/chits/{chit_id}`, THE Backend_API SHALL insert an Audit_Entry with action "deleted", the chit ID as entity_id, and the chit title as entity_summary
4. THE Change_Detail for chit updates SHALL include the field name, old value, and new value for each changed field, excluding `modified_datetime`

### Requirement 4: Audit Contact Changes

**User Story:** As a CWOC user, I want all changes to my contacts recorded in the audit log, so that I can review the full history of any contact.

#### Acceptance Criteria

1. WHEN a contact is created via `POST /api/contacts`, THE Backend_API SHALL insert an Audit_Entry with action "created", the contact ID as entity_id, entity_type "contact", and the contact display_name as entity_summary
2. WHEN a contact is updated via `PUT /api/contacts/{contact_id}`, THE Backend_API SHALL insert an Audit_Entry with action "updated" containing a Change_Detail listing each field that differs between the old and new values
3. WHEN a contact is deleted via `DELETE /api/contacts/{contact_id}`, THE Backend_API SHALL insert an Audit_Entry with action "deleted", the contact ID as entity_id, and the contact display_name as entity_summary
4. THE Change_Detail for contact updates SHALL include the field name, old value, and new value for each changed field, excluding `modified_datetime`

### Requirement 5: Audit Settings Changes

**User Story:** As a CWOC user, I want changes to my settings recorded in the audit log, so that I can see when and what configuration was modified.

#### Acceptance Criteria

1. WHEN settings are saved via `POST /api/settings`, THE Backend_API SHALL compare the incoming settings with the currently stored settings
2. WHEN one or more settings fields differ from the stored values, THE Backend_API SHALL insert an Audit_Entry with action "updated", entity_type "settings", entity_id equal to the user_id, and a Change_Detail listing each changed field
3. WHEN settings are saved and no fields have changed, THE Backend_API SHALL not insert an Audit_Entry
4. THE Change_Detail for settings updates SHALL include the field name, old value, and new value for each changed field


### Requirement 6: Global Audit Log API

**User Story:** As a CWOC user, I want to retrieve audit log entries through an API, so that the frontend can display audit history.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a `GET /api/audit-log` endpoint that returns Audit_Entries in reverse chronological order (newest first)
2. THE `GET /api/audit-log` endpoint SHALL accept optional query parameters: `entity_type` (filter by "chit", "contact", or "settings"), `entity_id` (filter by specific entity), `limit` (maximum number of entries, default 100), and `offset` (pagination offset, default 0)
3. WHEN both `entity_type` and `entity_id` are provided, THE Backend_API SHALL return only Audit_Entries matching both filters
4. WHEN only `entity_type` is provided, THE Backend_API SHALL return all Audit_Entries for that entity type
5. THE Backend_API SHALL return each Audit_Entry with the `changes` field deserialized from JSON into an object

### Requirement 7: Global Audit Log Page

**User Story:** As a CWOC user, I want a dedicated page to browse the full audit history across all entities, so that I can review all recent changes in one place.

#### Acceptance Criteria

1. THE Audit_Log_Page SHALL be accessible at `/frontend/audit-log.html` and use `shared-page.css` and `shared-page.js` for consistent styling and header/footer injection
2. THE Audit_Log_Page SHALL display Audit_Entries in a scrollable table with columns: timestamp, actor, action, entity type, entity summary, and a details toggle
3. WHEN the user expands the details toggle for an Audit_Entry, THE Audit_Log_Page SHALL display the Change_Detail showing field names with old and new values
4. THE Audit_Log_Page SHALL provide filter controls to narrow entries by entity type (All, Chits, Contacts, Settings)
5. THE Audit_Log_Page SHALL load entries in pages of 50, with a "Load More" button to fetch the next page
6. THE Audit_Log_Page SHALL follow the existing parchment/1940s visual theme with brown tones and Courier New font
7. THE Audit_Log_Page SHALL be accessible from the navigation header via a link or icon

### Requirement 8: Per-Entity Audit History on Editor Page

**User Story:** As a CWOC user, I want to see the audit history for a specific chit while editing it, so that I can understand what changed and when without leaving the editor.

#### Acceptance Criteria

1. THE Editor_Page SHALL include an Audit_Panel section that displays the audit history for the currently loaded chit
2. WHEN the Editor_Page loads a chit, THE Editor_Page SHALL fetch Audit_Entries from `GET /api/audit-log?entity_type=chit&entity_id={chit_id}` and display them in the Audit_Panel
3. THE Audit_Panel SHALL display each Audit_Entry as a compact row showing timestamp, actor, and action, with an expandable detail view for Change_Detail
4. WHEN the chit has no audit history, THE Audit_Panel SHALL display the message "No audit history for this chit"
5. THE Audit_Panel SHALL be collapsible and collapsed by default to avoid cluttering the editor

### Requirement 9: Per-Contact Audit History

**User Story:** As a CWOC user, I want to see the audit history for a specific contact, so that I can track changes made to their information.

#### Acceptance Criteria

1. THE contact detail view SHALL include an Audit_Panel section that displays the audit history for the currently viewed contact
2. WHEN a contact is loaded, THE contact detail view SHALL fetch Audit_Entries from `GET /api/audit-log?entity_type=contact&entity_id={contact_id}` and display them in the Audit_Panel
3. THE Audit_Panel for contacts SHALL display each Audit_Entry as a compact row showing timestamp, actor, and action, with an expandable detail view for Change_Detail
4. WHEN the contact has no audit history, THE Audit_Panel SHALL display the message "No audit history for this contact"

### Requirement 10: Change Detail Diff Computation

**User Story:** As a developer, I want a reliable method to compute field-level diffs between old and new entity states, so that audit entries accurately capture what changed.

#### Acceptance Criteria

1. THE Backend_API SHALL implement a diff helper function that accepts two dictionaries (old state and new state) and returns a list of Change_Detail objects for fields that differ
2. THE diff helper SHALL compare JSON-serialized fields (tags, checklist, people, alerts, etc.) in their deserialized form to produce meaningful diffs
3. THE diff helper SHALL exclude internal bookkeeping fields (`modified_datetime`, `created_datetime`) from the Change_Detail output
4. WHEN a field value changes from null to a non-null value, THE diff helper SHALL record the change with old value as null
5. WHEN a field value changes from a non-null value to null, THE diff helper SHALL record the change with new value as null
6. FOR ALL pairs of identical dictionaries, THE diff helper SHALL return an empty Change_Detail list (no false positives)
7. FOR ALL pairs of dictionaries differing in at least one tracked field, THE diff helper SHALL return a non-empty Change_Detail list (no false negatives)

### Requirement 11: Audit Log Entry Immutability

**User Story:** As a CWOC user, I want audit log entries to be permanent and uneditable, so that the change history is trustworthy.

#### Acceptance Criteria

1. THE Backend_API SHALL provide no endpoint to update or delete individual Audit_Entries
2. THE `audit_log` table SHALL only support INSERT operations through the application code
3. THE Audit_Log_Page SHALL display entries as read-only with no edit or delete controls

### Requirement 12: Help and Reference Documentation

**User Story:** As a CWOC user, I want the help page to document the audit log feature, so that I understand how change tracking works.

#### Acceptance Criteria

1. WHEN the Audit Log feature is implemented, THE help page SHALL include a new "Audit Log" section describing the change tracking functionality
2. THE help page SHALL document what actions are tracked (create, update, delete) and for which entities (chits, contacts, settings)
3. THE help page SHALL document how to access the global audit log page and per-entity audit history panels
4. THE help page SHALL document that the actor field reflects the username configured in settings
