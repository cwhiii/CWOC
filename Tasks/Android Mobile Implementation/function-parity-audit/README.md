# Function Parity Audit — Execution Guide

## Purpose
Systematically verify that every web frontend function is FULLY realized in the Android app. Not "does something similar exist" — does the Android app do EVERYTHING the web function does?

## Files in this directory

- **Web Function Index.md** — THE MASTER FILE. Contains all 1,052 numbered web frontend functions. Columns: `# | Function | Description | Android Equivalent | Gap File`. This is what you work through.
- **Android App Function Index.md** — Reference. All 1,982 Android functions with file locations. Use this to look up Android function numbers when recording matches.
- **Parity Mapping.md** — Progress tracking (which batches are done).
- **gaps/** — Directory of gap files. One file per web function that is NOT fully realized on Android.

## The Web Function Index columns

| Column | Meaning |
|--------|---------|
| # | Sequential number (W1, W2, etc.) |
| Function | The web JS function name with parameters |
| Description | One-line description of what it does |
| Android Equivalent | BLANK until verified. Once verified: either "✅ A#123, A#456" (list of Android function numbers that fully cover it) OR "⚠️ Partial — see gap file" OR "N/A (web-only)" |
| Gap File | Filename in gaps/ directory if there's a discrepancy. Blank if fully covered or N/A. |

## Status values for Android Equivalent column

- `⬜ Unchecked` — Not yet audited (default state)
- `✅ A#123, A#456` — Fully realized. Lists the Android App Function Index numbers that cover ALL the web function's behavior.
- `⚠️ Partial` — Android code exists but doesn't cover everything. Gap file explains what's missing.
- `❌ Missing` — No Android equivalent exists at all. Gap file explains what needs to be built.
- `N/A` — Web-only concept (DOM manipulation, CSS, keyboard shortcuts, browser APIs). No Android equivalent needed.

## Gap file format

Filename: `gaps/W042-functionName.md`

Contents:
```
# W42: _tempBarRange()

## What the web function does
[Read the actual web JS code and describe ALL its behavior]

## What exists on Android
[List any Android functions that partially cover this, with file paths]

## What's missing
[Specific behaviors/logic that the Android app does NOT have]
```

## Execution workflow (for each web function)

**CRITICAL: Process ONE function at a time. Do not batch. Do not look at W(N+1) until W(N) is fully complete (result recorded in the master file).**

**ABSOLUTE RULE: ONE FUNCTION PER str_replace. NEVER mark 2+ functions in a single edit. NEVER group functions that "follow the same pattern." NEVER skip reading source code because "the name is obvious."**

1. **Read the web function's actual source code** (in `src/frontend/js/`). Understand EVERYTHING it does — not just the name, but the full logic, edge cases, and behavior. Read the actual lines of code. Use `grep_search` to find it, then `read_file` to read the implementation.

2. **Search the Android codebase** (`android/app/src/main/java/com/cwoc/app/`) for equivalent functionality. Use grep, readCode, etc. Look for:
   - Functions with similar names (camelCase in Kotlin vs JS)
   - Functions in the corresponding screen/feature area
   - Logic that produces the same outcome

3. **Read the Android code** you find. Actually read the implementation line by line. Compare it against the web function's behavior point by point.

4. **Record the result** in Web Function Index.md with a SINGLE str_replace for THIS ONE function:
   - If FULLY covered: put `✅ A#X, A#Y` in Android Equivalent column (reference Android function numbers from Android App Function Index.md)
   - If partially covered or missing: put `⚠️ Partial` or `❌ Missing`, create a gap file, put the gap filename in the Gap File column

5. **Only after the result for W(N) is written to the file**, move to W(N+1).

### What "one at a time" means — NO EXCEPTIONS

- ❌ DO NOT mark W100 and W101 in the same str_replace, even if they're "the same pattern"
- ❌ DO NOT skip reading the web source because "it's just a wrapper"
- ❌ DO NOT skip reading the Android source because "I already found it for the previous function"
- ❌ DO NOT decide a function is "trivially simple" and mark it without reading both sides
- ❌ DO NOT group N/A functions together — verify EACH one is truly web-only individually
- ❌ DO NOT say "same as W(N-1)" without re-reading the actual source for W(N)
- ✅ DO read the web source for EVERY function
- ✅ DO search the Android codebase for EVERY function
- ✅ DO read the Android source you find for EVERY function
- ✅ DO make ONE str_replace per function
- ✅ DO verify your claim by reading actual code, not guessing from names

### Why this matters

Previous attempts at this audit resulted in the agent claiming "fully implemented" for functions that were NOT implemented, because it batched dozens of functions together based on name similarity without reading the actual code. This led to false confidence that the app was complete when it wasn't. The one-at-a-time rule exists because EVERY shortcut has produced wrong results.

## Current progress

- **W1–W755**: Audited (mix of properly verified and some that need re-verification)
- **W756–W1052**: Audited — all entries marked with status (✅, ⚠️, ❌, or N/A)
- **Audit complete**: All 1,052 web functions have been reviewed and categorized

## Key file locations

- Web frontend JS: `src/frontend/js/` (shared/, dashboard/, editor/, pages/)
- Android source: `android/app/src/main/java/com/cwoc/app/`
- Android key directories:
  - `domain/` — Pure business logic (filter, sort, search, recurrence, checklist, tags, alerts, email)
  - `ui/screens/` — Screen composables and ViewModels
  - `ui/components/` — Shared UI components
  - `ui/util/` — Utility functions (DateUtils, UnitConverter, GeocodingUtil, MarkdownRenderer)
  - `ui/theme/` — Colors, typography, theme
  - `ui/viewmodel/` — Shared ViewModels (FilterSort, Sidebar, EmailBadge, etc.)
  - `ui/navigation/` — Nav graph, tab row, filter/sort panels, sidebar
  - `data/repository/` — Data access (Auth, Chit, Contact, Settings, Email, Sync, etc.)
  - `data/sync/` — Sync engine, push engine, dirty tracker
  - `notification/` — Alarm scheduling, sound, boot receiver

## Important notes

- The web function index was reorganized by "priority" (old guessed categories). Ignore those priority headers — just work through the numbered functions sequentially.
- The old "Android Equivalent" column was filled with GUESSES that were proven wrong. It has been cleared to "⬜ Unchecked". Do NOT trust any pre-filled values.
- Architecture differs: one web function may map to multiple Android functions (ViewModel + Composable + Repository). That's fine — list all the Android # refs.
- Some web functions are purely DOM/CSS/browser (innerHTML, addEventListener, etc.). Mark those N/A immediately.
- "Fully realized" means the Android app produces the SAME user-facing outcome. The code doesn't need to be structured identically — it needs to DO the same thing.


## Integration with Kiro Specs

Any Kiro spec (`.kiro/specs/`) that implements Android parity for web functions **MUST** update this Web Function Index upon completion. This is the single source of truth for what's been implemented.

**After completing a parity spec:**
1. Update the Web Function Index entries for the W# functions that were implemented — change status from `❌ Missing` or `⚠️ Partial` to `✅` with the relevant Android function/class references.
2. Add the spec path in the "Resolved By" column (e.g., `.kiro/specs/editor-zones-parity/tasks.md — Task 3.1`).
3. Remove or update any associated gap files in `gaps/`.

**When creating a new parity spec:**
1. Read this README first to understand the tracking system.
2. Reference the Web Function Index to identify which W# entries the spec covers.
3. Include those W# references in the spec's requirements or design doc so the connection is traceable.

This file lives at: `Tasks/Android Mobile Implementation/function-parity-audit/README.md`
