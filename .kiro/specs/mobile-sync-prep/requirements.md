# Requirements: Mobile Sync Preparation (Server-Side)

## Introduction

This document defines the server-side changes required to support the upcoming Android mobile app. These changes prepare the CWOC backend for bidirectional offline-capable sync with mobile clients while maintaining full backward compatibility with the existing web app.

The mobile app will operate in two modes: live sync (WebSocket, same as the web app) when online, and offline-first with queued sync on reconnect. These server changes provide the infrastructure for both modes.

## Glossary

- **Sync Version** — A monotonically increasing integer on each chit record, incremented on every write. Used by clients to determine what's changed since their last sync.
- **Device Token** — A long-lived API authentication token tied to a specific device. Unlike session cookies, device tokens don't expire on inactivity and survive app restarts.
- **Dirty Record** — A record that has been modified locally on a device but not yet pushed to the server.
- **Tombstone** — A soft-deleted record retained so that other devices can learn about the deletion during sync.
- **Conflict Resolution** — The process of reconciling two versions of the same record that were edited independently on different devices while offline.
- **LWW (Last Write Wins)** — A conflict resolution strategy where the most recent edit by timestamp is kept.
- **Catch-up Sync** — The process a device performs on reconnect: pushing local dirty records and pulling all server changes since its last known sync version.
- **CRUD** — Create, Read, Update, Delete — the four basic data operations.

## Requirements

### Requirement 1: Sync Version Tracking

**User Story:** As a mobile client reconnecting after being offline, I need to efficiently determine which chits have changed on the server since my last sync, so that I can pull only the updates I'm missing.

#### Acceptance Criteria

1. WHEN a chit is created, THE system SHALL assign it a `sync_version` value equal to the current global sync counter and increment the global counter
2. WHEN a chit is updated (any field change), THE system SHALL update its `sync_version` to the current global sync counter and increment the global counter
3. WHEN a chit is soft-deleted, THE system SHALL update its `sync_version` so that the deletion is visible to sync clients
4. THE `sync_version` SHALL be a monotonically increasing integer that never decreases or resets
5. THE `sync_version` SHALL be included in all chit API responses (GET single, GET list, sync endpoints)

### Requirement 2: Sync Pull Endpoint

**User Story:** As a mobile client, I need to request all chits that have changed since a given sync version, so that I can update my local database with the latest server state.

#### Acceptance Criteria

1. THE system SHALL provide a `GET /api/sync/changes` endpoint that accepts a `since` parameter (sync version integer)
2. WHEN called with a `since` value, THE endpoint SHALL return all chits (including soft-deleted) belonging to the authenticated user with `sync_version` greater than the provided value
3. THE response SHALL include the current maximum `sync_version` as a `server_version` field so the client knows its new high-water mark
4. WHEN `since` is 0 or omitted, THE endpoint SHALL return ALL chits for the user (full sync)
5. THE endpoint SHALL respect user ownership and sharing permissions (same access rules as existing chit list endpoint)
6. THE response SHALL include chits shared with the user (not just owned), with their current sync versions

### Requirement 3: Sync Push Endpoint

**User Story:** As a mobile client that has made offline edits, I need to push my local changes to the server in a batch, so that the server has the latest state and other clients can see my edits.

#### Acceptance Criteria

1. THE system SHALL provide a `POST /api/sync/push` endpoint that accepts a JSON array of chit records with their `modified_datetime` values
2. FOR each pushed chit that does not exist on the server, THE endpoint SHALL create it (using the client-provided UUID as the ID)
3. FOR each pushed chit that exists on the server and has NOT been modified since the client's last sync, THE endpoint SHALL update it with the client's version
4. FOR each pushed chit that exists on the server and HAS been modified since the client's last sync (conflict), THE endpoint SHALL perform field-level merge with LWW fallback per field based on `modified_datetime`
5. WHEN a conflict is resolved, THE endpoint SHALL create an audit log entry of type `sync_conflict_resolved` containing both the client version and server version of all conflicting fields
6. WHEN a conflict is resolved, THE endpoint SHALL set `has_unviewed_conflict = true` on the resulting merged chit record
7. THE endpoint SHALL return a response indicating for each pushed chit: accepted (no conflict), merged (conflict resolved), or error (validation failure)
8. THE endpoint SHALL assign new `sync_version` values to all created or updated chits
9. THE endpoint SHALL broadcast changes via the existing WebSocket sync hub so other connected clients (web app) see updates immediately

### Requirement 4: Conflict Notification Flag

**User Story:** As a user who opens a chit that had a sync conflict resolved automatically, I want to see a notification that a conflict occurred, so that I can review the resolution and correct it if needed.

#### Acceptance Criteria

1. THE chits table SHALL have a `has_unviewed_conflict` boolean column (default false)
2. WHEN a sync conflict is resolved on a chit, THE system SHALL set `has_unviewed_conflict = true` on that chit
3. THE `has_unviewed_conflict` flag SHALL be included in chit API responses (GET single chit, GET list, sync pull)
4. THE system SHALL provide a `POST /api/chit/{id}/dismiss-conflict` endpoint that sets `has_unviewed_conflict = false`
5. THE audit log entry for a sync conflict SHALL include both the local (device) version and server version of every conflicting field, structured so a UI can display them side-by-side
6. THE audit log entry SHALL include a `conflict_fields` array listing which specific fields had conflicting values

### Requirement 5: Device Token Authentication

**User Story:** As a mobile app user, I need a long-lived authentication token that survives app restarts and offline periods, so that I can sync without re-entering my password every time.

#### Acceptance Criteria

1. THE system SHALL provide a `POST /api/auth/device-token` endpoint that accepts username and password, and returns a device-specific API token
2. THE device token SHALL be a cryptographically random 256-bit string (hex or base64url encoded)
3. THE device token SHALL NOT expire based on time or inactivity (unlike session cookies)
4. THE device token SHALL only be invalidated by explicit revocation
5. THE system SHALL store device tokens in a `device_tokens` table with: id, token (hashed), user_id, device_name, created_datetime, last_seen_datetime, last_sync_version
6. WHEN a request includes an `Authorization: Bearer <token>` header with a valid device token, THE auth middleware SHALL authenticate the request the same as a valid session cookie (setting request.state.user_id and request.state.username)
7. THE system SHALL update `last_seen_datetime` on the device token record each time it is used for authentication
8. THE system SHALL update `last_sync_version` on the device token record after each successful sync pull

### Requirement 6: Device Management

**User Story:** As a user, I need to see which devices are registered and revoke access to any device, so that I maintain control over which devices can access my data.

#### Acceptance Criteria

1. THE system SHALL provide a `GET /api/devices` endpoint that returns all registered device tokens for the authenticated user (excluding the token value itself)
2. THE response SHALL include: device_name, created_datetime, last_seen_datetime, last_sync_version for each device
3. THE system SHALL provide a `DELETE /api/devices/{device_id}` endpoint that revokes a specific device token
4. WHEN a device token is revoked, THE system SHALL immediately reject any subsequent requests using that token
5. THE system SHALL provide a `PATCH /api/devices/{device_id}` endpoint to rename a device

### Requirement 7: Tombstone Retention Policy

**User Story:** As a system administrator, I need soft-deleted records to be retained long enough for all devices to sync the deletion, so that no device misses a delete event and keeps showing deleted chits.

#### Acceptance Criteria

1. THE system SHALL NOT hard-delete (purge from database) any soft-deleted chit until all registered devices for that user have synced past the deletion's `sync_version`
2. WHEN all devices have synced past a tombstone's sync_version AND the deletion is older than 90 days, THE system MAY purge the record
3. IF a device has not synced in more than 90 days, THE system SHALL treat its next sync as a full sync (since=0) rather than blocking tombstone cleanup
4. THE existing trash purge functionality SHALL respect these retention rules (do not hard-delete if any active device hasn't synced past it)

### Requirement 8: Contacts and Settings Sync

**User Story:** As a mobile app user, I need my contacts and settings to sync between devices using the same mechanism as chits, so that my full data set is available offline.

#### Acceptance Criteria

1. THE contacts table SHALL have a `sync_version` column with the same semantics as chits
2. THE settings table SHALL have a `sync_version` column with the same semantics as chits
3. THE `GET /api/sync/changes` endpoint SHALL accept an optional `include` parameter to request contacts and/or settings changes alongside chits
4. THE `POST /api/sync/push` endpoint SHALL accept contacts and settings records in addition to chits
5. FOR settings conflicts, THE system SHALL use LWW (last write wins) on the entire settings record without field-level merge
6. FOR contacts conflicts, THE system SHALL use field-level merge with LWW fallback (same strategy as chits)
