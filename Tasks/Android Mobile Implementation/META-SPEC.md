# Meta Spec: Android Mobile Implementation Audit

## Purpose

Produce a grinding-detail, field-by-field, function-by-function audit of every phase of the Android app implementation. The goal is to identify EVERY gap between what the Android app has and what the mobile web version has, so we know exactly what needs to be built.

## Rules

1. **Read the actual web code.** For every feature being audited, open and read the corresponding web HTML, JS, and CSS files. Do not rely on memory, summaries, requirements docs, or assumptions. The web code IS the source of truth.

2. **Read the actual Android code.** For every feature being audited, open and read the corresponding Kotlin files. Do not assume something exists because a task was "marked complete."

3. **Compare side-by-side.** For every screen, every form, every modal, every API call — list what the web has and what the Android app has. If there's a difference, document it.

4. **No assumptions.** If you haven't read the file, you don't know what's in it. Don't write "✅ Complete" unless you've verified it by reading both the web and Android implementations.

5. **No shortcuts.** Don't skip features because they seem minor. A missing logo is a gap. A missing error message is a gap. A missing field label is a gap. Document everything.

6. **No cleverness.** Don't try to summarize or abstract. Be tediously specific. If the web has 47 settings fields, list all 47 and mark each one present/absent in the Android app.

7. **Functional focus.** This audit is about functional completeness — does the Android app have the same fields, options, behaviors, API calls, data handling, and user-facing features as the web? Visual/layout differences are noted but not the primary focus (that's Phase 8).

## Process for Each Phase

For each phase audit, follow these steps IN ORDER:

### Step 1: Identify all features claimed by the phase
Read the phase description in `mobile_app_initial_thoughts.md`. List every feature, sub-feature, and bullet point.

### Step 2: For each feature, identify the web implementation files
Find the HTML page, JS file(s), and CSS that implement this feature on the web. Read them.

### Step 3: For each feature, identify the Android implementation files
Find the Kotlin composable, ViewModel, entity, DAO, or repository that implements this feature on Android. Read them.

### Step 4: Compare — field by field, function by function

For **screens/pages**, compare:
- Every field/input on the screen
- Every button and what it does
- Every dropdown and its options
- Every toggle and its states
- Every label and its text
- Every error state and its message
- Every empty state and its message
- Every loading state
- Every modal/dialog that can appear
- Every API endpoint called
- Every piece of data displayed
- Every user action available (tap, long-press, swipe, etc.)

For **data models**, compare:
- Every field name and type
- Every default value
- Every nullable vs required distinction
- Every JSON-serialized sub-structure

For **API interactions**, compare:
- Every endpoint called
- Every request parameter
- Every response field handled
- Every error code handled
- Every retry/fallback behavior

For **business logic**, compare:
- Every filter predicate
- Every sort comparator
- Every validation rule
- Every computed/derived value
- Every state machine transition

### Step 4b: Verify FUNCTIONAL COMPLETENESS (MANDATORY)

**This step catches the class of bugs where UI elements exist but don't actually work.**

For EVERY interactive element identified in Step 4, verify:

**Input fields:**
- Can the user type into it?
- Does the value persist when the form is saved?
- Does the keyboard Done/Enter action do the expected thing (submit, add, move to next field)?
- If it's a search/filter field, does typing actually filter results?
- If it has autocomplete/suggestions, do suggestions appear from the correct data source?
- If it accepts comma-separated values, does typing a comma actually create a chip/entry?

**Add/Create buttons:**
- Does tapping the button actually add the item to the list/collection?
- Does the input field clear after adding?
- Is there visual feedback that the item was added?
- Can the user add multiple items in sequence?

**Remove/Delete buttons:**
- Does tapping actually remove the item?
- Is the removal reflected in the form state (will it persist on save)?

**Dropdowns/Pickers:**
- Does the dropdown open when tapped?
- Are the correct options populated (from the right data source)?
- Does selecting an option update the form state?
- Does the "None" option clear the field?

**Toggles/Switches:**
- Does toggling change the underlying state?
- Does the visual state match the data state?
- Does the change persist on save?

**Chips (tag chips, people chips, etc.):**
- Can chips be added via the designated input mechanism?
- Can chips be removed by tapping the X or the chip itself?
- Do chips display the correct data (name, color, etc.)?
- Are chips populated from the correct data source (contacts DB, tags settings, etc.)?

**Navigation/Action buttons:**
- Does the button navigate to the correct destination?
- Does the button trigger the correct action (share intent, map intent, etc.)?
- Is the button disabled when it should be (e.g., no location entered)?

**Data population:**
- Are dropdowns populated from the correct source (settings, contacts, chits)?
- Are autocomplete suggestions drawn from the correct database table?
- Are "saved items" lists (saved locations, favorite tags, recent tags) loaded from settings?
- Are shared users/assignees loaded from the correct API or local cache?

**Save/Persist flow:**
- Does every field's value make it into the form state?
- Does the form state correctly map to the entity for Room persistence?
- Does the dirty tracker detect changes to this field?
- Does the sync push include this field in the push DTO?

**If ANY of these checks fail, the element is marked as 💀 BROKEN (not ⚠️ PARTIAL).** A UI element that exists but doesn't function is worse than one that's missing — it misleads the user into thinking the feature works.

### Zone/Page/View Completeness Rule (ABSOLUTE)

**If ANY button, input, toggle, or interactive element that should exist in a zone/page/view is MISSING or BROKEN, the ENTIRE zone/page/view is rated 💀 BROKEN. No exceptions.**

This means:
- A zone that renders its header and content area but is missing its action buttons → 💀 BROKEN
- A page that displays data but is missing its toolbar actions (delete, share, export) → 💀 BROKEN  
- A view that shows a list but is missing its sort/filter controls → 💀 BROKEN
- An editor zone that shows fields but is missing its "Add" button → 💀 BROKEN
- A form that has inputs but no working "Save" button → 💀 BROKEN

**The logic:** A zone without its buttons is like a car without a steering wheel. It doesn't matter that the engine runs and the seats are comfortable — you can't drive it. The zone is non-functional as a unit. Users cannot complete the intended workflow.

**"Partially working" is not a thing for interactive zones.** Either the user can complete the full workflow (view data, add items, remove items, modify items, save changes) or they can't. If they can't, it's broken.

**This applies recursively:** If a page contains 5 zones and 3 of them are broken, the PAGE is broken. If a view has a toolbar with 4 actions and 2 are missing, the VIEW is broken.

### Step 5: Document gaps

For each gap found, document:
- What the web has (specific: field name, behavior, text, etc.)
- What the Android app has (or doesn't have)
- Severity:
  - **MISSING** — not there at all
  - **BROKEN** — the feature does not match the web implementation. This includes: UI elements that don't respond to interaction, fields that don't save, dropdowns with empty data, AND features that are "partially" implemented. **There is no "partial." If it doesn't do exactly what the web does, it's BROKEN.** A Kanban board without drag-drop is BROKEN. A map that can't geocode text addresses is BROKEN. A format toolbar that doesn't wrap selected text is BROKEN. The web version IS the spec. Anything less than full parity is a defect.

**The word "partial" is banned from gap descriptions.** Use MISSING (not there) or BROKEN (there but doesn't fully work like the web). There is no middle ground. The user expects every feature to work identically to the web version. Anything else is a bug.

### Step 6: Verdict

Rate each feature section as:
- ✅ **Complete** — every field, function, and behavior matches the web version exactly AND has been verified functional (Step 4b passes)
- ❌ **Missing** — not implemented at all
- 💀 **Broken** — exists but does not fully replicate the web behavior. **This includes what was previously called "partial."** If the web has drag-drop and Android doesn't, that's BROKEN. If the web has 4 alert types and Android has 3, that's BROKEN. If the web geocodes text addresses and Android doesn't, that's BROKEN. The web version is the spec. Anything less is a defect.

**There is no ⚠️ Partial or 🔄 Different verdict.** Those categories are eliminated. A feature either matches the web completely (✅) or it doesn't (💀 BROKEN) or it's not there at all (❌ MISSING).

### Zone/Page/View Completeness Rule (ABSOLUTE — NO EXCEPTIONS)

**If ANY button, input, toggle, or interactive element that should exist in a zone/page/view is MISSING or BROKEN, the ENTIRE zone/page/view is rated 💀 BROKEN.**

This means:
- A zone that renders its header and content area but is missing its action buttons → 💀 BROKEN
- A page that displays data but is missing its toolbar actions (delete, share, export) → 💀 BROKEN
- A view that shows a list but is missing its sort/filter controls → 💀 BROKEN
- An editor zone that shows fields but is missing its "Add" button → 💀 BROKEN
- A form that has inputs but no working "Save" button → 💀 BROKEN
- A zone that has an "Add" button but the button doesn't actually add anything → 💀 BROKEN
- A dropdown that exists but populates from an empty list instead of the correct data source → 💀 BROKEN

**The logic:** A zone without its buttons is like a car without a steering wheel. It doesn't matter that the engine runs and the seats are comfortable — you can't drive it. The zone is non-functional as a unit. Users cannot complete the intended workflow.

**"Partially working" is not a thing for interactive zones.** Either the user can complete the full workflow (view data, add items, remove items, modify items, save changes) or they can't. If they can't, it's 💀 BROKEN.

**This applies recursively:** If a page contains 5 zones and 3 of them are broken, the PAGE is 💀 BROKEN. If a view has a toolbar with 4 actions and 2 are missing, the VIEW is 💀 BROKEN. If an editor has 12 zones and 1 zone is broken, the EDITOR is 💀 BROKEN.

## Report Format

Each phase audit file (`phase-N-audit.md`) must contain:

```
# Phase N Audit: [Phase Name]

## Feature: [Feature Name]

### Web Implementation
- Files read: [list of files]
- [Detailed description of what the web does]

### Android Implementation  
- Files read: [list of files]
- [Detailed description of what the Android app does]

### Comparison

| Item | Web | Android | Status |
|------|-----|---------|--------|
| [specific item] | [what web has] | [what android has] | ✅/💀/❌ |

### Gaps
- [specific gap 1]
- [specific gap 2]

### Verdict: [✅/💀/❌]

---

[Repeat for each feature in the phase]

---

## Phase Summary

| Feature | Verdict |
|---------|---------|
| [feature 1] | [verdict] |
| [feature 2] | [verdict] |

## Complete Gap List

1. [gap 1 — specific and actionable]
2. [gap 2 — specific and actionable]
...
```

## What counts as a "feature" to audit

- Every screen/page
- Every form/editor
- Every modal/dialog
- Every API integration
- Every data model
- Every background process (sync, notifications, etc.)
- Every user interaction pattern (swipe, long-press, drag, etc.)
- Every settings field
- Every navigation path

## Phases to Audit

| Phase | Focus Areas |
|-------|-------------|
| 1 | Login (compare web login.html to Android LoginScreen), Room entities vs server schema (EVERY table, EVERY field — compare `migrations.py` column definitions against Room entities field-by-field), initial sync mechanism, core views (Tasks/Notes/Calendar — compare web rendering to Android rendering), visual identity |
| 2 | Chit editor (ALL fields — compare web editor.html + editor JS files to Android ChitEditorScreen), dirty tracking, sync push, WebSocket live sync, connectivity management |
| 3 | Conflict handling UI, contacts sync, settings sync, attachments, local notifications, edge cases |
| 4 | Checklists view, Projects/Kanban view, Alerts view, Indicators view, Maps, Widgets |
| 5 | Sidebar/menu, search, filters, sort, editor zones (date/checklist/color/alerts/recurrence), settings page (ALL fields — compare web settings.html + settings.js to Android SettingsScreen), trash, unsaved changes, undo |
| 6 | Contact editor, calendar views (Month/Year/Itinerary/X-Day), Omni View, tags UI, markdown preview, pin/archive/snooze, habits, weather, help, notifications |
| 7 | **Function Index Parity Audit** — Read `src/INDEX.md` (the complete code index). For EVERY frontend function listed (JS functions in shared/, dashboard/, editor/, pages/ directories), determine if an equivalent exists in the Android app. Server-side Python functions are excluded (they're shared infrastructure). This catches any client-side logic, utility, UI behavior, or interaction pattern that exists on web but has no Android equivalent — the "everything else" sweep that the per-phase audits might have missed. |

### Phase 1 — Database Parity (CRITICAL)

Phase 1's database audit must be exhaustive. The server's SQLite schema is the source of truth. To audit it:

1. **Read `src/backend/migrations.py`** — this contains every `ALTER TABLE ADD COLUMN` and `CREATE TABLE` statement. It defines the actual production schema.
2. **Read `src/backend/db.py`** — this may contain table creation logic or helper functions that reveal schema details.
3. **Read `src/backend/models.py`** — this defines the Pydantic models showing every field the API sends/receives.
4. **Compare against every Room entity** — `ChitEntity.kt`, `ContactEntity.kt`, `SettingsEntity.kt`, `SyncMetadataEntity.kt`, `AttachmentMetadata.kt`, `NotificationEntity.kt`.

For EACH table, produce a complete field-by-field comparison:

```
| Column (Server) | Type (Server) | Field (Android) | Type (Android) | Status |
|-----------------|---------------|-----------------|----------------|--------|
| id              | TEXT PK       | id              | String @PK     | ✅     |
| title           | TEXT          | title           | String?        | ✅     |
| email_from      | TEXT          | —               | —              | ❌ MISSING |
```

Every single column. No exceptions. If the server has 60 columns on the chits table, list all 60.

## Critical Reminders

- **THE WEB VERSION IS THE SPEC. PERIOD.** If the web does something and the Android app doesn't do that exact thing, it's BROKEN. Not "partial." Not "different." Not "a nice-to-have." BROKEN. There is no acceptable deviation from web behavior unless the feature is physically impossible on Android (hardware limitation, OS restriction) — and even then, you STOP AND ASK before marking it as acceptable.

- **"Partial" does not exist.** The word is banned. A Kanban board without drag-drop is not "partially implemented" — it's BROKEN. A map that can't geocode addresses is not "partially working" — it's BROKEN. A format toolbar that appends to the end instead of wrapping the selection is not "close enough" — it's BROKEN. Every gap is either MISSING (not there) or BROKEN (there but wrong).

- **FUNCTIONAL VERIFICATION IS NOT OPTIONAL.** The Phase 2 remediation revealed that UI elements can exist (fields, buttons, zones) but be completely non-functional — inputs that don't accept text, Add buttons that don't add, autocomplete that doesn't populate, chips that can't be created. Step 4b exists because of this. Every audit must verify that interactive elements ACTUALLY WORK, not just that they're present in the composable tree.

- **"It compiles" ≠ "It works."** A composable can render without errors but have broken callbacks, empty data sources, missing keyboard actions, or disconnected state. The audit must catch these.

- **Data source verification is critical.** If a dropdown shows "Assignee" options, WHERE do those options come from? If the answer is "an empty list because nothing loads them," that's BROKEN. Every populated list must trace back to a real data source (Room query, settings JSON parse, API call).

- **Input → State → Persist → Sync chain.** For every editable field, verify the FULL chain: user types → form state updates → entity maps the field → dirty tracker detects the change → push DTO includes the field. A break anywhere in this chain means the field doesn't actually save.

- The web app's settings page has ~100 fields across multiple tabs. List every single one.
- The web app's chit editor has ~50 fields across multiple zones. List every single one.
- The web app's contact editor has ~25 fields. List every single one.
- The web app's calendar has 6 view modes, each with specific behaviors. Document each one.
- The web app's login page fetches instance name and welcome message. Don't skip "minor" features.
- Every API endpoint the web calls, the Android app should call (or have an equivalent).
- Every error message the web shows, the Android app should show (or have an equivalent).
- Every empty state the web shows, the Android app should show (or have an equivalent).

## After All Audits Are Complete

Update the tracker file with completion status for each phase. The tracker is the single source of truth for what's been audited.

The audit reports become the work orders for fixing the gaps. Each gap is a specific, actionable item that can be implemented without further research.
