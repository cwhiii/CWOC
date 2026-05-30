# Technical Design: Tag ID System

## Overview

This design replaces the current name-based tag reference system with a UUID-based system. Tags get unique IDs at creation time; all internal storage references tags by ID. Names become mutable display labels. The change touches the backend (models, routes, rules engine, migrations), the web frontend (shared-tags.js, tag modal, sidebar, custom filters), and the Android app (sync, Room schema).

## Architecture

The tag ID system adds a UUID-based identity layer to the existing tag infrastructure. The Tag_Registry (in settings.tags) becomes the authoritative source of tag identity. All other storage locations (chits, rules, filters, sharing configs) reference tags by UUID. The backend resolves IDs to names on read and accepts IDs (or new names for auto-creation) on write. The frontend maintains in-memory lookup maps rebuilt from the registry on each settings load.

## Components and Interfaces

### Backend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Tag Model | `src/backend/models.py` | Pydantic model with `id` field |
| DB Helpers | `src/backend/db.py` | `is_tag_id()`, `is_system_tag()`, `resolve_tag_ids()`, `get_tag_registry()`, modified `compute_system_tags()`, modified `ensure_tags_in_settings()` |
| Settings Route | `src/backend/routes/settings.py` | ID assignment on tag creation, rename validation, cascade |
| Chits Route | `src/backend/routes/chits.py` | Tag resolution on read, ID/name handling on write |
| Kiosk Route | `src/backend/routes/health.py` | ID-based tag filtering |
| Sync Route | `src/backend/routes/sync.py` | ID-based tag-level sharing resolution |
| Rules Engine | `src/backend/rules_engine.py` | ID-based `tag_present`/`tag_not_present`, `add_tag`/`remove_tag` |
| Migration | `src/backend/migrations.py` | `migrate_tags_to_id_system()` — one-time data conversion |

### Frontend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Tag Registry Maps | `src/frontend/js/shared/shared-tags.js` | `_tagIdToObj`, `_tagNameToId` lookup maps, resolution functions |
| Tag Tree/Picker | `src/frontend/js/shared/shared-tags.js` | Tree building with IDs, picker with ID-based selection |
| Tag Modal | `src/frontend/js/shared/shared-tag-modal.js` | Create/edit/delete by ID, display by name |
| Sidebar Filter | `src/frontend/js/dashboard/main-sidebar.js` | ID-based tag selection and filtering |
| Custom Filters | `src/frontend/js/pages/settings-custom-filters.js` | ID-based filter storage |
| Editor Tags | `src/frontend/js/editor/editor-tags.js` | ID-based tag selection on chits |
| Settings Page | `src/frontend/js/pages/settings.js` | Tag management, kiosk, omni filters by ID |

### Interfaces

**Settings API (`GET/POST /api/settings`):**
- Returns `settings.tags` as array of `{id, name, color, fontColor, favorite}` objects
- Accepts partial updates; assigns UUID to any tag missing an `id`

**Chit API (`GET/POST/PUT /api/chits`):**
- Returns `chit.tags` as `[{id: "uuid"|null, name: "string"}]`
- Accepts `chit.tags` as `["uuid1", "uuid2", "NewTagName"]` (mixed IDs and new names)

**Kiosk API (`GET /api/kiosk?tags=uuid1,uuid2`):**
- Accepts Tag_IDs as comma-separated query param
- Filters chits by direct ID match + hierarchical name resolution

## Data Models

### Tag Object (in settings.tags JSON array)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Work/Projects",
  "color": "#8b5a2b",
  "fontColor": "#fff8e1",
  "favorite": true
}
```

- `id`: UUID v4, 36 chars, assigned by backend, immutable after creation
- `name`: 1-200 chars, mutable, unique per user (case-insensitive), hierarchical via `/`
- `color`: hex color string or null
- `fontColor`: hex color string or null
- `favorite`: boolean, default false

### Chit Tags Field (stored in chits.tags SQLite column)

Mixed array of Tag_IDs (UUIDs) and system tag name strings:

```json
["a1b2c3d4-e5f6-7890-abcd-ef1234567890", "CWOC_System/Calendar", "Habits/Exercise"]
```

Discrimination: UUIDs match `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`; anything else is a system tag.

### Chit Tags API Response Format

```json
[
  {"id": "a1b2c3d4-...", "name": "Work/Projects"},
  {"id": null, "name": "CWOC_System/Calendar"}
]
```

### Rules Engine Condition (tag_present/tag_not_present)

```json
{"type": "leaf", "field": "tags", "operator": "tag_present", "value": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}
```

### Settings Fields Storing Tag References

| Field | Format |
|-------|--------|
| `recent_tags` | `["uuid1", "uuid2", ...]` (max 5) |
| `custom_view_filters.{view}.tags` | `["uuid1", "uuid2", ...]` |
| `shared_tags[].tag` | `"uuid1"` |
| `kiosk_selected_tags` | `["uuid1", "uuid2", ...]` |
| `omni_locked_filters.tags` | `["uuid1", "uuid2", ...]` |

### Frontend Tag Registry Maps

```javascript
var _tagIdToObj = {};   // "uuid" → {id, name, color, fontColor, favorite}
var _tagNameToId = {};  // "work/projects" (lowercase) → "uuid"
```

Rebuilt on every settings load. Used for all display resolution.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Orphaned tag ID on chit (tag deleted from registry) | Omit from API response, log warning with chit ID and orphaned tag ID |
| Duplicate tag name on create | Return 400 with "Tag name already exists" message |
| Duplicate tag name on rename | Return 400 with "Tag name already exists" message |
| Empty or >200 char tag name | Return 400 with validation error |
| Rename causes child path collision | Return 400 with conflicting path(s) listed |
| Rule references non-existent tag ID | Skip action, log warning, continue rule evaluation |
| Frontend encounters unknown tag ID | Display "[unknown tag]" fallback, trigger settings refresh |
| Migration failure | Rollback entire transaction, log error, leave data in pre-migration state |
| Reserved prefix (CWOC_System/) submitted as user tag | Strip silently on chit save; reject on registry creation with 400 |

## Correctness Properties

### Property 1: ID Immutability
Once assigned, a tag's UUID never changes regardless of renames, color changes, or any other modification. The ID is permanent for the lifetime of the tag.

**Validates: Requirements 1.5**

### Property 2: Referential Integrity
Every tag ID stored on a chit, in rules, or in filter configs either resolves to a valid registry entry OR is gracefully handled as orphaned (omitted from display, logged as warning).

**Validates: Requirements 2.4, 3.5**

### Property 3: Rename Atomicity
Renaming a parent tag updates all child tag names in the same database transaction. Either all child renames succeed or none do — no partial state.

**Validates: Requirements 14.3, 14.4**

### Property 4: Migration Idempotency
Running the migration multiple times produces identical results. Already-converted data (entries with UUIDs) is detected and skipped.

**Validates: Requirements 11.10**

### Property 5: System Tag Isolation
System tags (CWOC_System/, Habits/) never enter the tag registry and never receive IDs. They coexist as name strings alongside UUIDs in the chit tags array.

**Validates: Requirements 12.1, 12.4**

### Property 6: Display Transparency
Users never see UUIDs in any UI context. All user-facing display resolves IDs through the registry lookup maps to show human-readable names.

**Validates: Requirements 9.1**

## Testing Strategy

Since this project doesn't use a test framework in the standard sense, verification is manual + integration:

1. **Migration verification:** Run migration on existing data, verify all chit tags converted to UUIDs, all settings references converted, registry has IDs on all entries.
2. **Rename verification:** Rename a tag via settings, verify all chit displays show new name without any chit record updates.
3. **Rules verification:** Create rule with tag_present condition, rename the tag, verify rule still fires.
4. **Filter verification:** Set custom view filter by tag, rename tag, verify filter still works.
5. **New tag creation:** Save a chit with a new tag name string, verify registry entry created with UUID, chit stores the UUID.
6. **Orphan handling:** Delete a tag from registry, verify chits that had it no longer show it but don't error.
7. **Android sync:** Verify app receives tag objects with IDs, displays names correctly, handles rename.
