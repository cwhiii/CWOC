# Requirements Document

## Introduction

The CWOC backend audit log system captures all creates, updates, and deletes for chits, contacts, and settings when performed via the direct REST API endpoints (used by web and mobile browser clients). However, the Android app syncs via `POST /api/sync/push`, and this endpoint only audits conflict resolutions — it does NOT audit routine creates, non-conflicting updates, or deletes pushed from the app. This creates a blind spot in the audit log where changes made on the Android app are invisible to the audit trail.

This feature closes that gap by adding audit log entries for all non-conflict sync push operations, matching the same audit behavior as the direct REST endpoints.

## Glossary

- **Sync_Push_Endpoint**: The `POST /api/sync/push` route in `src/backend/routes/sync.py` that accepts batched changes from the Android app
- **Audit_Log**: The `audit_log` SQLite table that records entity changes with actor, action, timestamp, and field-level diffs
- **Actor**: The identity string recorded in audit entries; for sync push operations this is `"device:<device_name>"` derived from the authenticated device token
- **Chit**: The core data entity in CWOC (task, note, event, etc.)
- **Contact**: A person record in the contacts table
- **Settings**: The user preferences record in the settings table
- **Soft_Delete**: Setting `deleted = 1` on a chit rather than removing the row
- **Audit_Diff**: The output of `compute_audit_diff()` — a list of `{field, old, new}` entries showing what changed
- **Non_Conflicting_Update**: A sync push update where `server_sync_version <= client_last_known_sync_version` (status: "accepted")

## Requirements

### Requirement 1: Audit Chit Creates via Sync Push

**User Story:** As a system administrator, I want chit creations pushed from the Android app to appear in the audit log, so that I have a complete record of when and how chits were created regardless of client platform.

#### Acceptance Criteria

1. WHEN a chit is created via the Sync_Push_Endpoint (status: "created"), THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "chit", entity_id set to the chit's ID, action "created", and entity_summary set to the chit title (or null if the chit has no title).
2. IF the device_id is available on the request state, THEN THE Sync_Push_Endpoint SHALL set the audit actor to `"device:<device_name>"` by looking up the device_name from the device_tokens table using the authenticated device_id.
3. IF the device_id is not available on the request state, THEN THE Sync_Push_Endpoint SHALL fall back to using the username from request state as the actor, or "web" if neither device_id nor username is available.
4. THE Sync_Push_Endpoint SHALL insert the audit entry using the existing `insert_audit_entry` helper with best-effort semantics (audit failures SHALL be logged but SHALL NOT cause the sync push request to fail or return an error to the client).

### Requirement 2: Audit Chit Non-Conflicting Updates via Sync Push

**User Story:** As a system administrator, I want chit updates pushed from the Android app (that don't trigger conflicts) to appear in the audit log with field-level diffs, so that I can see exactly what changed on each chit from the app.

#### Acceptance Criteria

1. WHEN a chit is updated via the Sync_Push_Endpoint without conflict (status: "accepted"), THE Sync_Push_Endpoint SHALL fetch the full existing chit row as a dictionary before applying the update.
2. WHEN the existing chit state has been fetched, THE Sync_Push_Endpoint SHALL compute a field-level diff between the old chit state and the new client state using `compute_audit_diff`, excluding at minimum the fields `modified_datetime`, `created_datetime`, `id`, `owner_id`, `owner_display_name`, `owner_username`, and `deleted_datetime` from the comparison.
3. WHEN the computed diff is non-empty, THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "chit", action "updated", the computed diff as changes, entity_id set to the chit id, and entity_summary set to the chit title.
4. WHEN the computed diff is empty (no field values differ after exclusions), THE Sync_Push_Endpoint SHALL skip inserting an audit entry for that chit update.
5. THE Sync_Push_Endpoint SHALL identify the Actor using the same device-based logic as Requirement 1.

### Requirement 3: Audit Chit Soft-Deletes via Sync Push

**User Story:** As a system administrator, I want chit soft-deletes pushed from the Android app to appear in the audit log, so that I can track when chits are deleted from the app.

#### Acceptance Criteria

1. WHEN a chit update via the Sync_Push_Endpoint sets the `deleted` field from 0 (or NULL) to 1, THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "chit", action "deleted", and entity_summary set to the chit title (or NULL if the chit has no title).
2. THE Sync_Push_Endpoint SHALL detect soft-deletes by comparing the server's current `deleted` value against the client's pushed `deleted` value before applying the update, on both the no-conflict ("accepted") path and the conflict-resolution ("merged") path.
3. WHEN a soft-delete is detected, THE Sync_Push_Endpoint SHALL record the "deleted" action instead of the generic "updated" action, matching the behavior of the direct REST delete endpoint.
4. THE Sync_Push_Endpoint SHALL identify the Actor using the same device-based logic as Requirement 1.
5. WHEN a chit update via the Sync_Push_Endpoint sets the `deleted` field from 1 to 0, THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "chit", action "restored", and entity_summary set to the chit title.

### Requirement 4: Audit Contact Creates and Updates via Sync Push

**User Story:** As a system administrator, I want contact creates and updates pushed from the Android app to appear in the audit log, so that the contact change history is complete regardless of client platform.

#### Acceptance Criteria

1. WHEN a contact is created via the Sync_Push_Endpoint (status: "created"), THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "contact", entity_id set to the contact's ID, action "created", and entity_summary set to the contact display_name.
2. WHEN a contact is updated via the Sync_Push_Endpoint without conflict (status: "accepted"), THE Sync_Push_Endpoint SHALL fetch the existing contact state as a dict before applying the update.
3. WHEN the existing contact state has been fetched for a non-conflicting update, THE Sync_Push_Endpoint SHALL compute a field-level diff between the old contact state and the new client state using `compute_audit_diff` with exclude_fields containing at minimum "modified_datetime" and "created_datetime".
4. WHEN the computed diff is non-empty, THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "contact", entity_id set to the contact's ID, action "updated", the computed diff as changes, and entity_summary set to the contact display_name.
5. WHEN the computed diff is empty, THE Sync_Push_Endpoint SHALL skip inserting an audit entry for that contact update.
6. THE Sync_Push_Endpoint SHALL identify the Actor using the same device-based logic as Requirement 1: lookup device_name from device_tokens table using the authenticated device_id, formatted as `"device:<device_name>"`, falling back to `"device:<device_id>"` if the name lookup fails, or username/web if no device_id is present.

### Requirement 5: Audit Settings Changes via Sync Push

**User Story:** As a system administrator, I want settings changes pushed from the Android app to appear in the audit log, so that I can track when and what settings were modified from the app.

#### Acceptance Criteria

1. WHEN settings are created via the Sync_Push_Endpoint (status: "created"), THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "settings", action "created", entity_summary "user settings", and actor identified via the device-based logic defined in Requirement 1.
2. WHEN settings are updated via the Sync_Push_Endpoint (status: "accepted"), THE Sync_Push_Endpoint SHALL fetch the existing settings state before applying the update.
3. WHEN settings are updated via the Sync_Push_Endpoint (status: "accepted"), THE Sync_Push_Endpoint SHALL compute a field-level diff between the old settings state and the new client state using `compute_audit_diff`.
4. WHEN the computed diff is non-empty, THE Sync_Push_Endpoint SHALL insert an audit entry with entity_type "settings", action "updated", the computed diff as changes, and entity_summary "user settings".
5. WHEN the computed diff is empty, THE Sync_Push_Endpoint SHALL skip inserting an audit entry for that settings update.
6. THE Sync_Push_Endpoint SHALL identify the Actor using the same device-based logic as Requirement 1.

### Requirement 6: Actor Identification Consistency

**User Story:** As a system administrator, I want all sync push audit entries to use a consistent actor format, so that I can easily filter and identify which device made each change.

#### Acceptance Criteria

1. WHEN a sync push request is received, THE Sync_Push_Endpoint SHALL determine the actor string once at the start of request processing and reuse that same string for all audit entries created within that request.
2. IF the request is authenticated via a device token and the device_tokens table returns a non-empty device_name for that token's device_id, THEN THE Sync_Push_Endpoint SHALL format the actor as `"device:<device_name>"`.
3. IF the device_name lookup fails, returns no row, or returns an empty string, THEN THE Sync_Push_Endpoint SHALL use `"device:<device_id>"` as the actor.
4. IF no device_id is present on the request state, THEN THE Sync_Push_Endpoint SHALL use the username from request state formatted as the plain username string, or `"web"` if no username is available.
5. THE Sync_Push_Endpoint SHALL produce actor strings matching one of exactly three formats: `"device:<device_name>"`, `"device:<device_id>"`, or a plain username string (with `"web"` as the final fallback), and the same format SHALL be used for both chit conflict and contact conflict audit entries within a single request.

### Requirement 7: Audit Entry Failure Isolation

**User Story:** As a system administrator, I want audit logging failures to never block or fail sync push operations, so that the sync mechanism remains reliable even if audit logging encounters errors.

#### Acceptance Criteria

1. IF an audit entry insertion fails during sync push processing, THEN THE Sync_Push_Endpoint SHALL log the error with the entity type and entity ID, and continue processing the remaining entities in the push batch without raising an exception to the caller.
2. IF an audit entry insertion fails for any entity in the push batch, THEN THE Sync_Push_Endpoint SHALL still return an HTTP 200 response with per-entity results reflecting the outcome of the data write (created, accepted, or merged), unaffected by the audit failure.
3. THE Sync_Push_Endpoint SHALL isolate each audit insertion call so that a failure in one audit write does not prevent audit writes for subsequent entities in the same push batch.
4. THE Sync_Push_Endpoint SHALL never roll back a successful data write (chit, contact, or settings) due to an audit logging failure.
