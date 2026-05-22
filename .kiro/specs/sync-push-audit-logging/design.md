# Technical Design: Sync Push Audit Logging

## Overview

Add audit log entries to the `POST /api/sync/push` endpoint so that all changes made from the Android app (chit creates, updates, soft-deletes, restores, contact creates/updates, and settings changes) are recorded in the audit log — matching the behavior of the direct REST API endpoints used by web and mobile browser.

All changes are confined to a single file: `src/backend/routes/sync.py`.

## Architecture

The change is entirely within the sync push endpoint. No new services, tables, or external dependencies are introduced. The existing `insert_audit_entry` and `compute_audit_diff` helpers from `src/backend/routes/audit.py` are reused. A new private helper `_resolve_sync_actor` is added to `sync.py` to centralize actor resolution.

## Components and Interfaces

### New Helper Function: `_resolve_sync_actor`

```python
def _resolve_sync_actor(request: Request, cursor) -> str:
    """Determine the actor string for audit entries in a sync push request.
    
    Priority:
    1. device:<device_name> (from device_tokens table via request.state.device_id)
    2. device:<device_id> (if name lookup fails)
    3. username (from request.state.username)
    4. "web" (final fallback)
    """
```

Called once at the top of `sync_push()` after the cursor is created. The returned string is reused for all audit entries within that request.

### Modified Function: `sync_push`

The existing `sync_push` function gains audit calls at each decision point:

| Branch | Audit Action | Changes Field |
|--------|-------------|---------------|
| Chit created | "created" | None |
| Chit accepted (deleted 0→1) | "deleted" | None |
| Chit accepted (deleted 1→0) | "restored" | None |
| Chit accepted (other changes) | "updated" | field-level diff |
| Chit merged (deleted flipped) | "deleted" or "restored" | None |
| Contact created | "created" | None |
| Contact accepted | "updated" | field-level diff |
| Settings created | "created" | None |
| Settings accepted | "updated" | field-level diff |

### Import Changes

Add `compute_audit_diff` to the existing import:

```python
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff
```

## Data Models

No new tables or columns. Uses the existing `audit_log` table:

```sql
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT,    -- "chit", "contact", "settings"
    entity_id TEXT,      -- chit/contact ID or user_id for settings
    action TEXT,         -- "created", "updated", "deleted", "restored", "sync_conflict_resolved"
    actor TEXT,          -- "device:<name>", "device:<id>", username, or "web"
    timestamp TEXT,      -- ISO 8601 UTC
    changes TEXT,        -- JSON array of {field, old, new} or NULL
    entity_summary TEXT  -- chit title, contact display_name, or "user settings"
);
```

### Actor Format

| Auth Type | Actor String |
|-----------|-------------|
| Device token with name | `device:Pixel 7` |
| Device token without name | `device:abc123-def456` |
| Session auth (username) | `cwhiii` |
| No auth info | `web` |

### Diff Exclude Fields

| Entity | Excluded from diff |
|--------|-------------------|
| Chit | modified_datetime, created_datetime, id, owner_id, owner_display_name, owner_username, deleted_datetime, sync_version |
| Contact | modified_datetime, created_datetime, id, owner_id, sync_version |
| Settings | modified_datetime, created_datetime, user_id, sync_version |

## Correctness Properties

### Property 1: Completeness
Every successful data write (create, update, delete, restore) in the sync push endpoint produces exactly one audit entry. Empty diffs (no meaningful field changes) produce no entry.

**Validates: Requirements 1, 2, 3, 4, 5**

### Property 2: Isolation
Audit failures never affect data writes. The `insert_audit_entry` helper already swallows exceptions, and each call site adds an additional try/except. A failed audit write never causes the sync push to return an error.

**Validates: Requirement 7**

### Property 3: Ordering
Audit entries are inserted within the same transaction as the data write, so they share the same commit boundary. If the transaction rolls back, no audit entry is persisted.

**Validates: Requirements 1, 2, 3, 4, 5**

### Property 4: Idempotency
Audit entries are append-only. Re-running a sync push with the same data will produce a new audit entry only if the diff is non-empty (which it won't be if the data hasn't changed on the server since the last push).

**Validates: Requirements 2, 4, 5**

## Error Handling

- All audit insertions are wrapped in try/except blocks
- Failures are logged with `logger.error` including entity type and ID
- The sync push response is never affected by audit failures
- The transaction commit includes both data writes and audit writes — if the commit fails, both are rolled back together (this is correct behavior: if data didn't persist, audit shouldn't either)

## Testing Strategy

- Manual testing: push changes from the Android app, verify audit entries appear in the audit log page
- Verify actor format shows as `device:<name>` in the audit log UI
- Verify field-level diffs match what was changed
- Verify soft-delete shows as "deleted" action, not "updated"
- Verify settings changes appear with entity_summary "user settings"

## Performance Considerations

- **Extra SELECT for updates**: The non-conflicting update path now requires a `SELECT * FROM chits WHERE id = ?` before the UPDATE. This is a single-row primary key lookup — negligible cost (~0.1ms on SQLite).
- **Settings re-read**: Reading settings after write for diff comparison adds one extra SELECT. Acceptable since settings pushes are infrequent.
- **No new indexes needed**: All queries use primary key lookups.
- **Batch efficiency**: Actor resolution happens once per request, not per entity.

## Files Modified

| File | Change |
|------|--------|
| `src/backend/routes/sync.py` | Add `_resolve_sync_actor` helper, add `compute_audit_diff` import, add audit calls to create/update/delete paths for chits, contacts, and settings. Refactor existing conflict audit to use shared actor variable. |
