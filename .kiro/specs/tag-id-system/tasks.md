# Implementation Plan: Tag ID System

## Overview

Replaces the name-based tag reference system with UUID-based IDs. Tags get unique IDs at creation; all storage uses IDs internally. Names become mutable display labels. Covers backend (models, routes, rules, migration), web frontend (tag picker, sidebar, filters, editor, settings), and Android app sync.

## Tasks

- [x] 1. Backend — Add `id` field to Tag model in `src/backend/models.py` (Optional[str], UUID v4, assigned by backend)
- [x] 2. Backend — Add helper functions to `src/backend/db.py`: `is_tag_id(value)` (UUID regex check), `is_system_tag(value)` (CWOC_System/ and Habits/ prefix check), `resolve_tag_ids(tag_ids, tag_registry)` (resolves IDs/system names to `[{id, name}]`), `get_tag_registry(conn, user_id)` (loads user's tag registry from settings)
- [x] 3. Backend — Modify `ensure_tags_in_settings()` in `src/backend/db.py` to accept both IDs and names, generate UUID for new tags, skip system tags, return name→ID mapping
- [x] 4. Backend — Modify `compute_system_tags()` in `src/backend/db.py` to accept optional `tag_registry` param, resolve user tag IDs to names for "Project" check, return user tag IDs + system tag name strings
- [x] 5. Backend — Modify `POST /api/settings` in `src/backend/routes/settings.py` to assign UUID v4 `id` to any tag object missing one, validate duplicate names (case-insensitive), validate name length (1-200), cascade parent rename to child tags, reject rename on path collision, invalidate chit cache on rename
- [x] 6. Backend — Modify chit read path in `src/backend/routes/chits.py` to load tag registry and call `resolve_tag_ids()` returning `[{id, name}]` in response; modify `_build_chit_list_for_user()` to resolve tags with single registry load
- [x] 7. Backend — Modify chit save/update path in `src/backend/routes/chits.py` to accept mixed array (UUIDs + new name strings), auto-create registry entries for new names, strip CWOC_System/ entries, deduplicate IDs, store final UUIDs + system tags
- [x] 8. Backend — Modify `tag_present` and `tag_not_present` operators in `src/backend/rules_engine.py` to use case-sensitive exact UUID match; modify `add_tag`/`remove_tag` actions to use Tag_IDs, validate ID exists in registry, skip duplicates
- [x] 9. Backend — Modify `/api/kiosk` endpoint in `src/backend/routes/health.py` to accept Tag_IDs as filter params, match against chit tag IDs directly, support hierarchical matching by resolving IDs to names
- [x] 10. Backend — Modify tag-level sharing resolution in `src/backend/routes/sync.py` to compare chit tag IDs against `shared_tags[].tag` (now a Tag_ID) directly
- [x] 11. Backend — Add `migrate_tags_to_id_system()` in `src/backend/migrations.py`: assign UUIDs to registry entries, convert chit tags from names to IDs, convert recent_tags/custom_view_filters/shared_tags/kiosk_selected_tags/omni_locked_filters/rules from names to IDs, create entries for orphaned names, ensure idempotency, wrap in single transaction, register in main.py startup
- [x] 12. Frontend — Add tag registry maps to `src/frontend/js/shared/shared-tags.js`: `_tagIdToObj`, `_tagNameToId`, `_rebuildTagMaps(tags)`, `getTagById(id)`, `getTagIdByName(name)`, `resolveTagId(id)`; call `_rebuildTagMaps()` in `loadAllTags()`
- [x] 13. Frontend — Modify `buildTagTree()` to include `id` field on tree nodes; modify `matchesTagFilter()` to accept tag objects `[{id, name}]` and filter by Tag_ID with hierarchical name fallback
- [x] 14. Frontend — Modify `renderTagTree()` and `buildTagPicker()` so `selectedTags` stores Tag_IDs, `onToggle` passes Tag_ID, display resolves IDs to names/colors via registry maps
- [x] 15. Frontend — Modify `createTagInline()`, `updateTagInline()`, `deleteTagInline()` to work with tag IDs (create sends name → gets ID back; update/delete identify by ID); modify `trackRecentTag()`/`getRecentTags()` to store/resolve IDs
- [x] 16. Frontend — Modify tag modal (`src/frontend/js/shared/shared-tag-modal.js`) to identify tags by ID internally, look up by ID when editing, send ID for updates/deletes, send name for creates, use tag_id in sharing config
- [x] 17. Frontend — Modify sidebar tag filter (`src/frontend/js/dashboard/main-sidebar.js`): `_sidebarTagSelection` becomes ID array, `_buildTagFilterPanel()` renders names but stores IDs, filter application uses ID-based `matchesTagFilter()`
- [x] 18. Frontend — Modify custom view filters (`src/frontend/js/pages/settings-custom-filters.js`): `_customViewFilters[view].tags` stores Tag_IDs, tag checkboxes display names but have ID values, `_gatherCustomViewFilters()` collects IDs, filter application matches by ID
- [x] 19. Frontend — Modify editor tags zone (`src/frontend/js/editor/editor-tags.js`): store selected tags as IDs, resolve to names/colors for display, send Tag_IDs in save payload, extract IDs from `[{id, name}]` response on load
- [x] 20. Frontend — Modify settings page (`src/frontend/js/pages/settings.js`): tag list uses IDs for identification, kiosk tag selection stores/loads Tag_IDs, omni locked filters stores/loads Tag_IDs, shared tags config uses tag_id field
- [x] 21. Android — Update tag handling in sync/display: store Tag_Registry with `id` field, store chit tags as ID arrays, add local tag resolution utility, update tag display to resolve IDs, update tag creation to send name and receive ID, add Room migration if needed
- [x] 22. Integration — Verify end-to-end: tag rename reflects everywhere without chit updates, rules still fire after rename, filters still work after rename, migration is idempotent, orphaned IDs handled gracefully, Android sync works correctly

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1"]},
    {"tasks": ["2"]},
    {"tasks": ["3", "4"]},
    {"tasks": ["5"]},
    {"tasks": ["6", "7"]},
    {"tasks": ["8", "9", "10"]},
    {"tasks": ["11"]},
    {"tasks": ["12"]},
    {"tasks": ["13"]},
    {"tasks": ["14", "15"]},
    {"tasks": ["16", "17", "18", "19", "20"]},
    {"tasks": ["21"]},
    {"tasks": ["22"]}
  ]
}
```

## Notes

- System tags (CWOC_System/, Habits/) remain as name strings — they never get IDs and coexist in the same tags array alongside UUIDs.
- The migration must be idempotent and transactional — safe to run multiple times, rolls back entirely on failure.
- Frontend never displays UUIDs to users — all display goes through the registry lookup maps.
- The chit cache (`_ChitCache` in db.py) must be invalidated on tag rename since cached responses contain resolved names.
- The "Project" tag detection in `compute_system_tags()` requires resolving user tag IDs to names — this is the one place where the backend needs the registry to interpret chit tags.
