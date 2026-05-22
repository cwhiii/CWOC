# Implementation Plan: Sync Push Audit Logging

## Overview

Add comprehensive audit logging to the `POST /api/sync/push` endpoint in `src/backend/routes/sync.py` so that all changes from the Android app are captured in the audit log, matching the behavior of the direct REST API endpoints.

Platform scope: Server only (backend Python).

## Tasks

- [x] 1. Add `_resolve_sync_actor` helper and compute actor once per request: Add `compute_audit_diff` to the import from `src.backend.routes.audit`. Create `_resolve_sync_actor(request, cursor)` that resolves device_id → device_name → fallback. Call it once at the top of `sync_push()` after cursor creation. Replace inline actor-resolution code in both existing conflict audit branches with the pre-resolved `actor` variable. [R6, R7]
- [x] 2. Audit chit creates via sync push: In the chit "created" branch, after the INSERT, add a try/except that calls `insert_audit_entry(conn, "chit", chit_id, "created", actor, entity_summary=client_chit.get("title"))`. Log failures and continue. [R1, R7]
- [x] 3. Audit chit non-conflicting updates and soft-deletes: In the chit "accepted" branch, fetch the full existing row before the UPDATE. After the UPDATE, detect soft-delete (deleted 0→1) and restore (deleted 1→0). If soft-delete: audit "deleted". If restore: audit "restored". Otherwise compute diff with `compute_audit_diff` excluding metadata fields; if non-empty audit "updated" with changes. Wrap in try/except. [R2, R3, R7]
- [x] 4. Audit chit soft-deletes in conflict resolution path: In the chit "merged" branch, after conflict resolution, check if "deleted" is in merged_updates. If flipped 0→1: audit "deleted". If flipped 1→0: audit "restored". Wrap in try/except. [R3, R7]
- [x] 5. Audit contact creates via sync push: In the contact "created" branch, after the INSERT, add a try/except that calls `insert_audit_entry(conn, "contact", contact_id, "created", actor, entity_summary=display_name)`. [R4, R7]
- [x] 6. Audit contact non-conflicting updates: In the contact "accepted" branch, fetch the full existing row before the UPDATE. After the UPDATE, compute diff with `compute_audit_diff` excluding metadata fields. If non-empty: audit "updated" with changes and entity_summary=display_name. Wrap in try/except. [R4, R7]
- [x] 7. Audit settings changes via sync push: In settings "created" branch, audit "created" with entity_summary "user settings". In settings "accepted" and client-wins-conflict branches, fetch settings before applying, re-read after, compute diff excluding metadata. If non-empty: audit "updated". Wrap in try/except. [R5, R7]
- [x] 8. Update version number: Run `date "+%Y%m%d.%H%M"` and update `src/VERSION` with new server version `sYYYYMMDD.HHMM`. [N/A]

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2, 3, 4, 5, 6, 7]},
    {"tasks": [8]}
  ]
}
```

Task 1 must be completed first (provides the actor variable and import). Tasks 2–7 can be done in any order after Task 1. Task 8 is always last.

## Notes

- All changes are in a single file: `src/backend/routes/sync.py`
- The existing `insert_audit_entry` helper already swallows exceptions internally, but we add an outer try/except at each call site for defense-in-depth
- The conflict resolution branches already have audit entries for "sync_conflict_resolved" — those remain unchanged; we only add delete/restore detection on top
- No new dependencies, no database migrations, no frontend changes
