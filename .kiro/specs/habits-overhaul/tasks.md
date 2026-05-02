# Tasks

## Task 1: Backend Data Model & Migration

- [x] 1.1 Add `habit`, `habit_goal`, `habit_success`, `show_on_calendar` fields to the `Chit` Pydantic model in `models.py`
- [x] 1.2 Remove `hide_when_instance_done` field from the `Chit` Pydantic model in `models.py`
- [x] 1.3 Add `default_show_habits_on_calendar` field to the `Settings` Pydantic model in `models.py`
- [x] 1.4 Write `migrate_habits_overhaul()` in `migrations.py` — add new columns with existence checks, add settings column, remove `hide_when_instance_done` via table rebuild (copy-to-temp, recreate, copy-back)
- [x] 1.5 Register the new migration in `main.py` startup sequence
- [x] 1.6 Update `compute_system_tags()` in `db.py` to add `Habits` and `Habits/[title]` tags when `habit=True`

## Task 2: Backend CRUD Updates

- [x] 2.1 Update `create_chit()` in `routes/chits.py` — add `habit`, `habit_goal`, `habit_success`, `show_on_calendar` to INSERT statement; remove `hide_when_instance_done`
- [x] 2.2 Update `update_chit()` in `routes/chits.py` — add new fields to UPDATE statement; remove `hide_when_instance_done`
- [x] 2.3 Update `get_all_chits()` and `get_chit()` in `routes/chits.py` — deserialize new fields as proper types (bool/int); remove `hide_when_instance_done` deserialization
- [x] 2.4 Update `search_chits()` in `routes/chits.py` — remove `hide_when_instance_done` reference
- [x] 2.5 Update `export_chits()` and `import_chits()` — handle new fields in export/import envelope
- [x] 2.6 Update `save_settings()` and `get_settings()` in `routes/settings.py` — add `default_show_habits_on_calendar` to INSERT/SELECT

## Task 3: Frontend Editor — Habit Controls in Dates Zone

- [x] 3.1 Add "Track as habit" checkbox HTML to `editor.html` in the Dates zone (below the Repeat row, always visible)
- [x] 3.2 Add habit controls HTML: Goal input, progress display "X / Y", "Show on calendar" toggle (hidden by default, revealed when habit=true)
- [x] 3.3 Implement `onHabitToggle()` in `editor-dates.js` — when checked: auto-enable Repeat with Daily if not already on, reveal controls, lock Repeat; when unchecked: hide controls, unlock Repeat
- [x] 3.4 Implement habit field loading in editor init — read `habit`, `habit_goal`, `habit_success`, `show_on_calendar` from chit data and populate controls
- [x] 3.5 Implement habit field gathering in `editor-save.js` — include new fields in the save payload
- [x] 3.6 Remove `hideWhenDoneRow` HTML from `editor.html` and all `hide_when_instance_done` references from editor JS

## Task 4: Frontend — Habit Log Zone (New File)

- [x] 4.1 Create `src/frontend/js/editor/editor-habits.js` — new file for Habit Log zone logic
- [x] 4.2 Add Habit Log zone HTML to `editor.html` — collapsible zone with zone-header pattern, contains period list container and charts container
- [x] 4.3 Add `<script>` tag for `editor-habits.js` in `editor.html` load order
- [x] 4.4 Implement `_loadHabitLog(chit)` — build period history from recurrence_exceptions, display in reverse chronological order with editable counts
- [x] 4.5 Implement inline editing of past period counts — click to edit, save updates the recurrence exception entry
- [x] 4.6 Implement habit charts using `<canvas>` — completion bar chart, success rate trend line, streak timeline
- [x] 4.7 Wire zone visibility to habit flag — show only when `habit=true`, hide otherwise

## Task 5: Frontend — Period Rollover Logic

- [x] 5.1 Implement `_evaluateHabitRollover(chit)` in `shared.js` — detect period change, snapshot habit_success/habit_goal into recurrence exception, reset habit_success to 0, clear Complete status
- [x] 5.2 Call `_evaluateHabitRollover()` in `displayHabitsView()` before rendering each habit card
- [x] 5.3 Call `_evaluateHabitRollover()` in editor init when loading a habit chit
- [x] 5.4 When rollover occurs, persist the updated chit via PUT /api/chits/{id}

## Task 6: Frontend — Habits View Overhaul

- [x] 6.1 Rewrite `displayHabitsView()` in `main-views.js` — filter by `chit.habit === true` instead of `recurrence_rule` presence
- [x] 6.2 Remove "Show completed" toggle and all `hide_when_instance_done` logic from the Habits view
- [x] 6.3 Implement new habit card layout — progress "X/Y", frequency, streak 🔥, success rate %, status badge
- [x] 6.4 Implement checkbox interaction for goal=1 habits (tap to toggle complete for period)
- [x] 6.5 Implement counter interaction for goal>1 habits (+/− buttons to increment/decrement habit_success)
- [x] 6.6 Implement goal completion logic — when habit_success reaches habit_goal, auto-set status to Complete; when decremented below, clear Complete
- [x] 6.7 Implement habit_success cap — never exceed habit_goal
- [x] 6.8 Sort habits: incomplete first, completed last

## Task 7: Frontend — Updated Habit Metrics

- [x] 7.1 Rewrite `getHabitSuccessRate()` in `shared.js` — use `habit_success`/`habit_goal` from recurrence exceptions; fall back to legacy `completed` field for old entries
- [x] 7.2 Rewrite `getHabitStreak()` in `shared.js` — use `habit_success >= habit_goal` from exceptions; handle legacy entries
- [x] 7.3 Ensure both functions respect the `habits_success_window` setting and exclude broken-off periods

## Task 8: Frontend — Calendar Filtering

- [x] 8.1 Add calendar filter in `main-calendar.js` and/or `shared-calendar.js` — exclude chits where `habit === true && show_on_calendar === false`
- [x] 8.2 Verify filter applies to all calendar periods (Day, Week, Month, Year, Itinerary, Work, X Days)

## Task 9: Frontend — Settings Page

- [x] 9.1 Add "Default: show habits on calendar" toggle to the Habits section in `settings.html`
- [x] 9.2 Wire the toggle to load/save via `settings.js` — read from settings on load, include in save payload
- [x] 9.3 Ensure the existing "Success rate window" dropdown continues to work with the new habit metrics

## Task 10: Cleanup & Legacy Removal

- [x] 10.1 Remove all frontend references to `hide_when_instance_done` across all JS files (main-views.js, shared.js, editor-dates.js, etc.)
- [x] 10.2 Remove `hideWhenDoneRow` from editor.html and any related CSS
- [x] 10.3 Remove `hide_when_instance_done` from the settings save payload in `settings.js`
- [x] 10.4 Update the Tasks tab view mode toggle — ensure "Habits" mode calls the new `displayHabitsView()` that filters by `habit === true`

## Task 11: Property-Based Tests

- [x] 11.1 Create `src/backend/test_habits.py` with property tests for: tag computation (Properties 4, 5), habit_success cap (Property 8), success rate calculation (Property 12), streak calculation (Property 13), migration idempotency (Property 16), CRUD round-trip (Property 17)
- [x] 11.2 Ensure all tests use Python stdlib only (unittest + random), no pip installs, minimum 100 iterations each

## Task 12: Documentation & Versioning

- [x] 12.1 Update `help.html` — rewrite the Habits View section to document the new opt-in model, goal/progress tracking, charts, and Habit Log
- [x] 12.2 Update `src/INDEX.md` — add new functions, files, and migration entries
- [x] 12.3 Update `src/VERSION` with current timestamp (run `date "+%Y%m%d.%H%M"` at the very end)
- [x] 12.4 Create release notes file for the new version
