# Code Deduplication Design

## Approach

### Analysis Phase
1. Read every function in the codebase using INDEX.md as the map
2. For each function, check: does another function in a different file do the same thing?
3. Apply the threshold: "If I changed one, would I need to change the other?"
4. Categorize into Fixed / Left Alone / Gray Area

### Consolidation Phase
For each "Fixed" item:
1. Identify the best location for the shared implementation (existing shared file or new one if needed)
2. Write the shared function with a signature that covers all callers
3. Replace all duplicate implementations with calls to the shared function
4. Verify no behavior change

## Where Shared Code Lives

**Frontend JS:**
- `shared-utils.js` — general utilities (already exists)
- `shared-tags.js` — tag-related shared logic (already exists)
- `shared-checklist.js` — checklist interactions (already exists)
- `shared.js` — coordinator/larger shared patterns (already exists)
- New shared file only if nothing existing fits

**Backend Python:**
- `db.py` — database helpers (already exists)
- `sharing.py` — permission logic (already exists)
- New utility module only if nothing existing fits

## Consolidation Pattern

```
BEFORE:
  file-a.js: function _escHtml(str) { ... }
  file-b.js: function _escHtml(str) { ... }
  file-c.js: function _escHtml(str) { ... }

AFTER:
  shared-utils.js: function _escHtml(str) { ... }
  file-a.js: (uses global _escHtml from shared-utils.js)
  file-b.js: (uses global _escHtml from shared-utils.js)
  file-c.js: (uses global _escHtml from shared-utils.js)
```

## Tracking File Format

```markdown
# Deduplication Tracker

## Will Fix
(Clear duplicates — presented for review BEFORE any code changes are made)

1. **_escHtml()** — identical implementation in main-modals.js, main-email.js, main-omni.js. Will consolidate to shared-utils.js.
2. ...

## Gray Area
(Borderline cases — user decides yes/no before any code changes)

1. **Weather icon lookup** — `_getWeatherIcon()` in main-modals.js and `weatherIcons` map in editor.js. Same data, slightly different interface. Worth consolidating? Low maintenance burden since the icon map rarely changes.
2. ...

## Left Alone
(Not real duplication — with reason)

1. **DB connection boilerplate** — every route opens sqlite3.connect(). Not real duplication, just the pattern.
2. ...

## Fixed
(Items move here ONLY after code has been changed)

(empty until Phase 2)
```

## Workflow

1. Analysis produces the tracker with Will Fix, Gray Area, and Left Alone populated
2. User reviews the FULL list before any edits happen
3. User approves "Will Fix" and decides on each Gray Area item
4. Only then does consolidation begin
5. Items move to "Fixed" as each change is completed

## Risk Mitigation

- Each consolidation is a single logical change
- Shared functions maintain the exact same signature/behavior as the originals
- If a duplicate has slight variations, the shared version accepts parameters to cover all cases
- No changes to HTML load order unless absolutely necessary (and documented if so)