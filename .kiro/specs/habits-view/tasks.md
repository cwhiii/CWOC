# Implementation Plan: Habits View

## Overview

Add a Habits view mode to the Tasks tab that surfaces recurring chits as trackable habit cards with completion toggles, success rate badges, and streak indicators. The implementation touches backend (data model + migrations), shared helpers (period/rate/streak calculations), frontend dashboard (sidebar toggle + habit renderer), editor (hide-when-done checkbox), settings (success window dropdown), and CSS (habit card styles). No new files, no new endpoints, no new dependencies — all changes extend existing files following established patterns.

## Tasks

- [ ] 1. Backend data model and migrations
  - [ ] 1.1 Add `hide_when_instance_done` field to the Chit model and CRUD operations
    - Add `hide_when_instance_done: Optional[bool] = False` to the `Chit` Pydantic model in `backend/main.py`
    - Add `hide_when_instance_done` to the column list in `create_chit()` INSERT statement and its value tuple
    - Add `hide_when_instance_done` to the column list in `update_chit()` UPDATE SET clause and its value tuple (both update and insert branches)
    - Add `chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))` to the deserialization in `get_all_chits()`, `get_chit()`, `search_chits()`, and `export_chits()`
    - Add `hide_when_instance_done` to the `import_chits()` INSERT column list and value tuple
    - _Requirements: 7.1, 7.5_

  - [ ] 1.2 Add `habits_success_window` field to the Settings model and CRUD operations
    - Add `habits_success_window: Optional[str] = "30"` to the `Settings` Pydantic model in `backend/main.py`
    - Add `habits_success_window` to the `save_settings()` INSERT OR REPLACE column list, value tuple, and `new_settings_dict`
    - No deserialization needed in `get_settings()` — it's a plain TEXT column returned as-is by the `SELECT *` + `dict(zip(...))` pattern
    - _Requirements: 7.2, 7.6_

  - [ ] 1.3 Add `migrate_add_habits_fields()` migration function
    - Create a new migration function `migrate_add_habits_fields()` in `backend/main.py` following the existing pattern (e.g., `migrate_add_audit_settings`)
    - Check `PRAGMA table_info(chits)` for `hide_when_instance_done`, add via `ALTER TABLE chits ADD COLUMN hide_when_instance_done INTEGER DEFAULT 0` if missing
    - Check `PRAGMA table_info(settings)` for `habits_success_window`, add via `ALTER TABLE settings ADD COLUMN habits_success_window TEXT DEFAULT '30'` if missing
    - Call `migrate_add_habits_fields()` in the startup migration sequence (after the last existing migration call)
    - _Requirements: 7.3, 7.4_

- [ ] 2. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Shared helper functions in `frontend/shared.js`
  - [ ] 3.1 Implement `getCurrentPeriodDate(chit)` function
    - Add a new function `getCurrentPeriodDate(chit)` in `frontend/shared.js` in a new `// ── Habits Helpers ──` section
    - Accept a chit object, return a `YYYY-MM-DD` string for the current period's date
    - Handle DAILY (interval=1): return today's date
    - Handle DAILY (interval>1): walk from chit `start_datetime` by interval days, find the period containing today
    - Handle WEEKLY (no byDay): return start of current week using `window._cwocSettings.week_start_day` (default `"0"` for Sunday)
    - Handle WEEKLY (with byDay): find the most recent scheduled day ≤ today
    - Handle MONTHLY: return first day of current month
    - Handle YEARLY: return Jan 1 of current year
    - Handle custom intervals: walk from start date by interval steps, find most recent occurrence ≤ today
    - Fallback: if chit has no `start_datetime`, use today's date
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 3.2 Implement `getHabitSuccessRate(chit, windowDays)` function
    - Add `getHabitSuccessRate(chit, windowDays)` in the same Habits Helpers section of `frontend/shared.js`
    - Accept a chit and `windowDays` (number or `"all"`)
    - Determine date range: if `"all"`, from chit start to today; otherwise last N days from today
    - Walk recurrence from start date, collecting occurrences within range
    - Exclude broken-off dates from both numerator and denominator
    - Count completed dates from `recurrence_exceptions` where `completed === true`
    - Return `Math.round((completed / total) * 100)`, or `0` if total is 0
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 3.3 Implement `getHabitStreak(chit)` function
    - Add `getHabitStreak(chit)` in the same Habits Helpers section of `frontend/shared.js`
    - Walk recurrence from start date forward, collecting all occurrence dates up to today
    - Skip broken-off dates entirely (they neither contribute to nor break the streak)
    - Walk backward from the most recent non-broken-off occurrence
    - Count consecutive completed occurrences
    - Stop at the first genuinely missed occurrence (not completed, not broken off)
    - Return the count (0 if no completed occurrences exist)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.4 Write property test for `getCurrentPeriodDate`
    - **Property 3: getCurrentPeriodDate returns a valid current-period date**
    - Implement as a vanilla JS parameterized test loop (no external libraries), minimum 100 iterations
    - Generate random recurring chits with various frequencies (DAILY, WEEKLY, MONTHLY, YEARLY), intervals, byDay combinations, and start dates in the past
    - Verify: output matches `YYYY-MM-DD` format, result ≤ today, frequency-specific rules hold (daily=today, monthly=1st of month, etc.)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [ ]* 3.5 Write property test for `getHabitSuccessRate`
    - **Property 4: Success rate calculation correctness**
    - Implement as a vanilla JS parameterized test loop, minimum 100 iterations
    - Generate random recurring chits with random exception arrays (completed, broken-off, neither)
    - Verify: calculated rate matches manual computation excluding broken-off dates, result is 0–100 integer, 0 when no occurrences
    - **Validates: Requirements 4.1, 4.6, 4.7**

  - [ ]* 3.6 Write property test for `getHabitStreak`
    - **Property 5: Streak calculation correctness**
    - Implement as a vanilla JS parameterized test loop, minimum 100 iterations
    - Generate random recurring chits with random exception patterns (completed, broken-off, missed)
    - Verify: streak count matches manual backward walk, broken-off dates skipped, stops at first missed
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 4. Checkpoint — Shared helpers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Frontend Habits view rendering in `frontend/main.js`
  - [ ] 5.1 Add view mode state variable and `_setTasksMode()` function
    - Add `let _tasksViewMode = localStorage.getItem('cwoc_tasksViewMode') || 'tasks';` near the existing `_alarmsViewMode` declaration
    - Add `_setTasksMode(mode)` function that stores mode in `_tasksViewMode` and `localStorage` key `cwoc_tasksViewMode`, updates button highlight styles (ivory background for active), and calls `displayChits()`
    - Extend `_restoreViewModeButtons()` to also sync the Tasks mode buttons on init
    - _Requirements: 1.2, 1.5_

  - [ ] 5.2 Add habits mode dispatch in `displayTasksView()`
    - Add a mode check at the top of the existing `displayTasksView()` function: if `_tasksViewMode === 'habits'`, call `displayHabitsView(chitsToDisplay)` and return
    - This ensures the existing Tasks renderer is unchanged when in tasks mode
    - _Requirements: 1.3, 1.4_

  - [ ] 5.3 Implement `displayHabitsView(chitsToDisplay)` function
    - Add new function `displayHabitsView(chitsToDisplay)` in `frontend/main.js`
    - Filter to only chits with `chit.recurrence_rule && chit.recurrence_rule.freq`
    - Read `habits_success_window` from `window._cwocSettings` (fallback to `"30"`)
    - For each habit chit: call `getCurrentPeriodDate(chit)`, check `recurrence_exceptions` for completed entry, call `getHabitSuccessRate()` and `getHabitStreak()`
    - Render habit cards with: completion checkbox, title as clickable link to editor, frequency label via `formatRecurrenceRule()`, middle dot separator, success rate badge, streak indicator with 🔥 emoji
    - Sort: incomplete habits first, completed habits last; preserve relative order within each group (stable sort)
    - Handle `hide_when_instance_done`: if true and current period completed, hide card unless show-completed toggle is checked
    - Render "Show completed" checkbox at top when any habits are hidden
    - Completed cards get faded/strikethrough visual style (CSS class `habit-done`)
    - Attach double-click to navigate to editor, long-press to open quick edit modal (matching existing Tasks view interaction patterns)
    - _Requirements: 1.4, 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 2.9, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3_

  - [ ] 5.4 Implement completion checkbox toggle handler
    - When user checks the completion checkbox, call `PATCH /api/chits/{chit_id}/recurrence-exceptions` with `{ "exception": { "date": "<current_period_date>", "completed": true } }`
    - When user unchecks, call the same endpoint with `{ "exception": { "date": "<current_period_date>", "completed": false } }`
    - On success, re-fetch chits and re-render (no optimistic UI update)
    - On failure, log error with `console.error`
    - _Requirements: 2.3, 2.4_

  - [ ]* 5.5 Write property test for completion-based sort ordering
    - **Property 8: Completion-based sort ordering**
    - Implement as a vanilla JS parameterized test loop, minimum 100 iterations
    - Generate random arrays of habit chits with varying completion states
    - Verify: all incomplete cards precede all completed cards, relative order within groups preserved (stable sort)
    - **Validates: Requirements 2.7, 2.8, 9.1, 9.2**

- [ ] 6. Sidebar view mode toggle in `frontend/index.html` and `frontend/main.js`
  - [ ] 6.1 Add Tasks view mode toggle HTML in sidebar
    - Add a new `<div class="sidebar-section" id="section-tasks-mode" style="display:none;">` in `frontend/index.html`, following the exact pattern of `section-kanban` and `section-alarms-mode`
    - Include "View Mode" label, two buttons: "📋 Tasks" (`onclick="_setTasksMode('tasks')"`) and "🔁 Habits" (`onclick="_setTasksMode('habits')"`)
    - Default "Tasks" button to `background:ivory`
    - _Requirements: 1.1_

  - [ ] 6.2 Wire sidebar section visibility to tab switching
    - In the tab-switch function in `frontend/main.js`, show `section-tasks-mode` when `tab === 'Tasks'`, hide otherwise
    - Follow the same pattern used for `section-kanban` (Projects) and `section-alarms-mode` (Alarms)
    - Also update the `_restoreViewModeButtons` / sidebar restore logic to show/hide `section-tasks-mode` based on `currentTab`
    - _Requirements: 1.1, 1.6_

- [ ] 7. Editor — "Hide from Habits when done" checkbox
  - [ ] 7.1 Add checkbox HTML in `frontend/editor.html`
    - Add a new `<div class="date-mode-row" id="hideWhenDoneRow" style="display:none;">` inside the recurrence section, after the existing repeat options
    - Include a checkbox with id `hideWhenInstanceDone` and label "🙈 Hide from Habits when done"
    - _Requirements: 6.1_

  - [ ] 7.2 Wire checkbox visibility and load/save in `frontend/editor.js`
    - In `onRepeatToggle()` (or equivalent), show `hideWhenDoneRow` when repeat is enabled, hide when disabled
    - In `_loadRecurrenceRule()` (or the chit load function), set the checkbox checked state from `chit.hide_when_instance_done`
    - In the save payload construction, include `hide_when_instance_done: document.getElementById('hideWhenInstanceDone').checked`
    - _Requirements: 6.1, 6.2, 6.6_

- [ ] 8. Settings — Success window dropdown
  - [ ] 8.1 Add Habits section HTML in `frontend/settings.html`
    - Add a new `<div class="setting-group">` with heading "🔁 Habits" in the `.settings-grid`
    - Include a `<label>` "Success rate window" and a `<select id="habits-success-window">` with four options: "Last 7 days" (value="7"), "Last 30 days" (value="30", selected), "Last 90 days" (value="90"), "All time" (value="all")
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 8.2 Wire dropdown load/save in `frontend/settings.js`
    - In `loadSettings()` (or `CwocSettingsManager`), set the dropdown value from `this.settings.habits_success_window`
    - In `gatherSettings()`, include `habits_success_window: document.getElementById('habits-success-window').value`
    - _Requirements: 8.4, 8.5, 8.6_

- [ ] 9. Habit card CSS styles in `frontend/styles.css`
  - [ ] 9.1 Add habit card CSS classes
    - Add `.habit-card` base styles (card container matching parchment theme, brown tones, Courier New font)
    - Add `.habit-card.habit-done` with `opacity: 0.6` and strikethrough on title
    - Add `.habit-header` for the title + frequency row layout
    - Add `.habit-metrics` for the success badge + streak row layout
    - Add `.habit-success-badge` for the percentage badge styling
    - Add `.habit-streak` for the streak indicator styling
    - Add `.habit-show-completed` for the show-completed toggle at the top
    - _Requirements: 2.7, 2.8_

- [ ] 10. Checkpoint — All features wired together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Help documentation and version update
  - [ ] 11.1 Update `frontend/help.html` with Habits view documentation
    - Add a "Habits View" section documenting: how to switch to Habits mode, what habit cards show, how completion toggling works, success rate and streak explanations, the "Hide from Habits when done" editor option, and the success window setting
    - Add entry to the table of contents if one exists
    - _Requirements: 1.1, 2.1, 6.1, 8.1_

  - [ ] 11.2 Update VERSION file
    - Run `date "+%Y%m%d.%H%M"` and update `/app/VERSION` with the current timestamp
    - _(Workspace versioning rule)_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests are implemented as vanilla JavaScript parameterized test loops (no external libraries, no installs)
- No software installation of any kind (no pip, no npm, no test frameworks)
- No server running required — all tasks are pure code changes
- All changes extend existing files following established patterns — no new files created
