# Design: Mobile Sync Preparation (Server-Side)

## Overview

This design covers the server-side infrastructure changes needed before building the Android mobile app. The goal is to add sync version tracking, a sync API, device token authentication, and conflict resolution — all while maintaining full backward compatibility with the existing web app.

All changes are backend-only (Python/FastAPI/SQLite). The web app continues to work exactly as before. The new sync endpoints are additive — they don't replace existing CRUD endpoints.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CWOC Server                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Existing (unchanged):                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ /api/chit│  │ /api/    │  │ /ws/sync │  │ Auth     │       │
│  │ CRUD     │  │ contacts │  │ WebSocket│  │ Middleware│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  New (additive):                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ /api/sync/changes│  │ /api/sync/push   │  │ /api/auth/   │  │
│  │ (pull endpoint)  │  │ (push endpoint)  │  │ device-token │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ /api/devices     │  │ Conflict         │                    │
│  │ (management)     │  │ Resolution Engine│                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Database (SQLite)                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ chits (+ sync_version, has_unviewed_conflict)              │ │
│  │ contacts (+ sync_version)                                  │ │
│  │ settings (+ sync_version)                                  │ │
│  │ device_tokens (NEW table)                                  │ │
│  │ sync_state (NEW table — global counter)                    │ │
│  │ audit_log (existing — new action type: sync_conflict)      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Database Changes

### New Columns

**chits table:**
```sql
ALTER TABLE chits ADD COLUMN sync_version INTEGER DEFAULT 0;
ALTER TABLE chits ADD COLUMN has_unviewed_conflict BOOLEAN DEFAULT 0;
```

**contacts table:**
```sql
ALTER TABLE contacts ADD COLUMN sync_version INTEGER DEFAULT 0;
```

**settings table:**
```sql
ALTER TABLE settings ADD COLUMN sync_version INTEGER DEFAULT 0;
```

### New Tables

**sync_state** — Global sync counter (single row):
```sql
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_version INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO sync_state (id, next_version) VALUES (1, 1);
```

**device_tokens** — Long-lived device authentication:
```sql
CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL DEFAULT 'Unknown Device',
    created_datetime TEXT NOT NULL,
    last_seen_datetime TEXT NOT NULL,
    last_sync_version INTEGER DEFAULT 0,
    revoked BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_hash ON device_tokens (token_hash);
```

### New Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_chits_sync_version ON chits (sync_version);
CREATE INDEX IF NOT EXISTS idx_chits_owner_sync ON chits (owner_id, sync_version);
CREATE INDEX IF NOT EXISTS idx_contacts_sync_version ON contacts (sync_version);
```

## Sync Version Mechanism

The sync version is a global monotonically increasing counter stored in `sync_state.next_version`. Every time a chit, contact, or settings record is created or modified, it gets assigned the current counter value, and the counter increments.

```python
def get_next_sync_version(cursor) -> int:
    """Atomically get and increment the global sync version counter."""
    cursor.execute("UPDATE sync_state SET next_version = next_version + 1 WHERE id = 1")
    cursor.execute("SELECT next_version - 1 FROM sync_state WHERE id = 1")
    return cursor.fetchone()[0]
```

This is called inside the same transaction as the chit write, ensuring atomicity.

### Integration with Existing CRUD

The existing chit create/update routes in `routes/chits.py` will be modified to call `get_next_sync_version()` and set `sync_version` on every write. This is a minimal change — one additional column in the INSERT/UPDATE statements and one function call.

The existing WebSocket sync hub continues to work as-is. The mobile app connects to the same `/ws/sync` WebSocket when online.

## Sync Pull Endpoint

**`GET /api/sync/changes?since={version}&include=chits,contacts,settings`**

Returns all records with `sync_version > since` for the authenticated user.

Response shape:
```json
{
    "server_version": 4523,
    "chits": [ /* full chit objects with sync_version > since */ ],
    "contacts": [ /* if requested */ ],
    "settings": { /* if requested, single object */ }
}
```

The `server_version` field is the current max sync_version across all tables. The client stores this as its high-water mark for the next pull.

For `since=0` (full sync), returns everything. This is used on first device setup or when a device hasn't synced in >90 days.

## Sync Push Endpoint

**`POST /api/sync/push`**

Request body:
```json
{
    "chits": [
        {
            "id": "uuid-here",
            "title": "...",
            "modified_datetime": "2026-05-15T10:30:00",
            "...all fields..."
        }
    ],
    "contacts": [ /* optional */ ],
    "settings": { /* optional */ }
}
```

Response:
```json
{
    "results": {
        "chits": [
            {"id": "uuid-1", "status": "accepted", "sync_version": 4524},
            {"id": "uuid-2", "status": "merged", "sync_version": 4525, "conflict_fields": ["title", "note"]},
            {"id": "uuid-3", "status": "created", "sync_version": 4526}
        ],
        "contacts": [ /* ... */ ]
    },
    "server_version": 4526
}
```

## Conflict Resolution Engine

When a pushed chit has a `sync_version` on the server that's newer than what the client last saw (meaning the server version was modified after the client's last sync), a conflict exists.

### Resolution Algorithm

```python
def resolve_conflict(server_chit: dict, client_chit: dict, merge_fields: list) -> dict:
    """
    Field-level merge with LWW fallback.
    
    For each field in merge_fields:
    - If only one side changed it (vs. the common ancestor), take that side's value
    - If both sides changed it, take the one with the later modified_datetime
    
    Returns the merged chit and a list of conflicting fields.
    """
    merged = dict(server_chit)  # Start with server version
    conflict_fields = []
    
    for field in merge_fields:
        server_val = server_chit.get(field)
        client_val = client_chit.get(field)
        
        if server_val == client_val:
            continue  # No conflict on this field
        
        # Both differ — LWW based on modified_datetime
        server_time = server_chit.get("modified_datetime", "")
        client_time = client_chit.get("modified_datetime", "")
        
        if client_time > server_time:
            merged[field] = client_val
        # else: keep server_val (already in merged)
        
        conflict_fields.append(field)
    
    return merged, conflict_fields
```

### Audit Log Entry for Conflicts

```python
{
    "entity_type": "chit",
    "entity_id": "uuid-of-chit",
    "action": "sync_conflict_resolved",
    "actor": "device:My Phone",
    "changes": [
        {
            "field": "title",
            "server_value": "Old Title (from web)",
            "client_value": "New Title (from phone)",
            "resolved_to": "client"  # or "server"
        },
        {
            "field": "note",
            "server_value": "Server's note content...",
            "client_value": "Phone's note content...",
            "resolved_to": "server"
        }
    ]
}
```

This gives the audit log UI everything it needs to show both versions side-by-side and let the user cherry-pick.

## Device Token Authentication

### Token Generation Flow

1. Mobile app sends `POST /api/auth/device-token` with `{username, password, device_name}`
2. Server validates credentials (same as login)
3. Server generates a random 256-bit token: `secrets.token_urlsafe(32)`
4. Server stores `sha256(token)` in `device_tokens` table (never store raw token)
5. Server returns the raw token to the client (only time it's ever sent)
6. Client stores token in Android EncryptedSharedPreferences

### Auth Middleware Integration

The existing auth middleware in `middleware.py` checks for a `cwoc_session` cookie. It will be extended to also check for an `Authorization: Bearer <token>` header:

```python
# In auth_middleware, after cookie check fails:
auth_header = request.headers.get("authorization", "")
if auth_header.startswith("Bearer "):
    raw_token = auth_header[7:]
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    # Look up in device_tokens table
    # If found and not revoked: authenticate, update last_seen_datetime
```

This is additive — the cookie path continues to work for the web app. The Bearer token path is used by the mobile app.

### Token Security

- Raw tokens are never stored on the server (only sha256 hash)
- Tokens are 256-bit random (cryptographically secure via `secrets` module)
- Revocation is immediate (check `revoked` flag on every request)
- `last_seen_datetime` provides visibility into device activity

## Tombstone Retention

The existing trash system soft-deletes chits (sets `deleted = 1`, `deleted_datetime`). The current "purge trash" feature hard-deletes records older than N days.

With sync, hard-deletion must be gated:

```python
def can_purge_chit(chit_sync_version: int, user_id: str) -> bool:
    """Check if all active devices have synced past this chit's deletion."""
    # Get minimum last_sync_version across all non-revoked devices for this user
    min_device_version = get_min_device_sync_version(user_id)
    
    # If no devices registered, allow purge (web-only user)
    if min_device_version is None:
        return True
    
    # Only purge if all devices have seen this version
    return chit_sync_version <= min_device_version
```

Devices that haven't synced in 90+ days are excluded from this check (they'll get a full re-sync).

## File Organization

New files:
- `src/backend/routes/sync.py` — Sync pull/push endpoints, conflict resolution
- `src/backend/routes/devices.py` — Device token management endpoints

Modified files:
- `src/backend/migrations.py` — New migration functions for schema changes
- `src/backend/middleware.py` — Add Bearer token auth path
- `src/backend/routes/chits.py` — Add sync_version assignment on create/update
- `src/backend/routes/contacts.py` — Add sync_version assignment on create/update
- `src/backend/routes/settings.py` — Add sync_version assignment on update
- `src/backend/routes/trash.py` — Gate hard-delete with tombstone retention check
- `src/backend/main.py` — Register new route modules

## Backward Compatibility

All changes are additive:
- Existing API endpoints continue to work identically
- The web app doesn't need any changes (it ignores `sync_version` and `has_unviewed_conflict` fields)
- The WebSocket sync hub continues to work — mobile app is just another client
- Session cookie auth continues to work for the web app
- New columns have defaults (0/false) so existing data is unaffected

The only behavioral change: trash purge becomes slightly more conservative (won't hard-delete until devices have synced). This is invisible to the user.
