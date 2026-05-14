# Implementation Plan: Cron Triggers & Habit Rules

## Overview

Extends the existing Rules Engine with cron expression scheduling and habit-mode tracking. Implementation proceeds in layers: cron parser first, then backend integration, then new condition operators, then habit mode, then frontend UI, and finally habits view integration.

**CRITICAL CONSTRAINTS:**
- NO pip installs, NO npm installs, NO software installation of any kind
- Tests are optional (no external test libraries required)
- All code uses existing patterns from the rules engine
- Update Mega Index (src/INDEX.md) only once at the very end
- Update version number only once at the very end
- Update release notes only once at the very end

## Tasks

- [x] 1. Cron expression parser
  - [x] 1.1 Create `src/backend/cron_parser.py` with pure-Python cron parsing
    - Implement `parse_cron(expression: str) -> dict` — parses 5-field cron string into sets of valid values for each field (minutes, hours, days_of_month, months, days_of_week)
    - Support: wildcards (`*`), specific values, ranges (`1-5`), lists (`1,3,5`), step values (`*/15`, `1-30/5`), day-of-week names (MON-SUN), month names (JAN-DEC)
    - Implement `matches(parsed: dict, dt: datetime) -> bool` — checks if a datetime's minute/hour/day/month/dow all fall within the parsed sets
    - Implement `describe(expression: str) -> str` — returns human-readable description (e.g., "Every weekday at 9:00 AM")
    - Handle invalid expressions gracefully (return None from parse, False from matches)
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 1.2 (Optional) Write unit tests for cron parser
    - Test standard expressions: `* * * * *`, `0 9 * * *`, `0 9 * * MON-FRI`, `*/15 * * * *`, `0 0 1 * *`
    - Test edge cases: invalid syntax, out-of-range values, empty string
    - Test `describe()` output for common patterns
    - _Requirements: 1.3, 1.5_

- [x] 2. Backend integration — cron scheduling
  - [x] 2.1 Modify `_is_scheduled_rule_due()` in `src/backend/schedulers.py`
    - At the top of the function, check if `schedule_config` contains a `cron` field
    - If `cron` is present: parse it with `parse_cron()`, check `matches(parsed, now)`, verify rule hasn't already run in this minute (compare `last_run_datetime` minute to current minute)
    - If `cron` is not present: fall through to existing frequency/interval/time_of_day logic (backward compatibility)
    - Import `parse_cron` and `matches` from `src.backend.cron_parser`
    - _Requirements: 1.2, 1.4, 1.6_

  - [x] 2.2 Add database migration for habit mode columns
    - Add `migrate_add_habit_mode_to_rules()` in `src/backend/migrations.py`
    - Add columns: `habit_mode` (BOOLEAN DEFAULT 0), `habit_history` (TEXT)
    - Use existing column-existence check pattern
    - Call the migration from `main.py` startup sequence
    - _Requirements: 3.1_

  - [x] 2.3 Update Pydantic models in `src/backend/models.py`
    - Add `habit_mode: Optional[bool] = False` to `RuleCreate` and `RuleUpdate`
    - Add `habit_history: Optional[list] = None` to `RuleUpdate` (not settable on create — engine manages it)
    - _Requirements: 3.1_

- [x] 3. New condition operators
  - [x] 3.1 Add `days_ago_greater_than` and `days_ago_less_than` operators to `evaluate_leaf()` in `src/backend/rules_engine.py`
    - Parse the entity's field value as a datetime (handle ISO 8601 format)
    - Compute age in days: `(datetime.utcnow() - field_datetime).days`
    - Compare against the leaf's `value` (cast to int)
    - Return False gracefully if field is empty, None, or unparseable
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 4. Habit mode — execution tracking
  - [x] 4.1 Modify `_rules_scheduled_loop()` in `src/backend/schedulers.py` to record habit history
    - After a habit rule executes, append an entry to its `habit_history` JSON: `{date, status, entities_matched, actions_applied, executed_datetime}`
    - Status is "achieved" if the rule ran (regardless of match count — maintenance rules succeed by running)
    - Trim `habit_history` to last 365 entries to prevent unbounded growth
    - Write updated `habit_history` back to the rules table
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 4.2 Add habit summary computation to `src/backend/routes/rules.py`
    - In `_deserialize_rule()`, if `habit_mode` is true, compute and attach `habit_summary` object
    - `habit_summary` contains: `current_status` (due/achieved/missed for current period), `streak` (consecutive achieved periods), `success_rate` (achieved / total periods in window), `last_achieved_datetime`, `period` (derived from cron — daily/weekly/monthly)
    - Derive period from cron expression: if cron fires once per day → daily, once per week → weekly, once per month → monthly, sub-daily → daily
    - Add `?habit=true` query parameter support to `list_rules` endpoint to filter only habit rules
    - _Requirements: 3.5, 3.6, 4.5_

  - [x] 4.3 Handle "missed" detection
    - In the scheduler loop, when checking if a habit rule is due: if the rule should have fired in a previous period but `habit_history` has no entry for that period, insert a "missed" entry
    - This handles cases where the server was down during a scheduled execution
    - _Requirements: 3.2_

- [x] 5. Frontend — Cron builder UI
  - [x] 5.1 Add cron builder HTML to `src/frontend/html/rule-editor.html`
    - Add a schedule mode toggle (Simple/Cron) using the standard `cwoc-2val-toggle` pattern
    - Add five labeled input fields for minute, hour, day-of-month, month, day-of-week
    - Add a preview line that shows human-readable description
    - Add preset buttons: "Every morning", "Every hour", "Weekdays 9am", "1st of month"
    - Add a "Track as Habit" checkbox below the schedule config section
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Add cron builder JS logic to `src/frontend/js/pages/rule-editor.js`
    - Wire the schedule mode toggle to show/hide Simple vs. Cron sections
    - Implement `_describeCron(expr)` — client-side human-readable cron description for the preview
    - Wire preset buttons to populate the five cron fields
    - On save: if in Cron mode, set `schedule_config.cron` to the assembled expression
    - On load: if rule has `schedule_config.cron`, switch to Cron mode and populate fields
    - Wire habit mode checkbox to `habit_mode` field in payload
    - Validate cron expression on save (basic client-side check: 5 space-separated fields, valid characters)
    - _Requirements: 2.5, 2.6_

  - [x] 5.3 Add `days_ago_greater_than` and `days_ago_less_than` to the operator dropdown in the condition builder
    - Add these operators to the operator list in the rule editor
    - Show them when a date-type field is selected (email_date, created_datetime, start_datetime, due_datetime, modified_datetime, point_in_time, completed_datetime)
    - _Requirements: 5.4_

- [x] 6. Frontend — Habits view integration
  - [x] 6.1 Add habit rule fetching and rendering to `src/frontend/js/shared/shared-habits.js`
    - Add `fetchHabitRules()` function that calls `GET /api/rules?habit=true`
    - Render habit rules in the habits list with a 🤖 badge to distinguish from chit habits
    - Show: rule name, current period status (due/achieved/missed), streak, success rate
    - Click navigates to rule editor page for that rule
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Include habit rules in habits success rate calculation
    - Add a toggle/setting for whether habit rules count toward overall success rate
    - When enabled, merge habit rule periods into the success rate computation
    - _Requirements: 4.4_

- [x] 7. Help & documentation
  - [x] 7.1 Update help page with cron trigger and habit rule documentation
    - Document cron expression syntax with examples
    - Document habit mode for rules
    - Document the "days ago" condition operators
    - Document the example use case (archive old emails from specific sender)

- [x] 8. Finalization
  - [x] 8.1 Update Mega Index (`src/INDEX.md`) with new functions and files
  - [x] 8.2 Update version number (`src/VERSION`) — run `date "+%Y%m%d.%H%M"` and use returned value
  - [x] 8.3 Write release notes

## Task Dependency Graph

1.1 ->
1.2 -> 1.1
2.1 -> 1.1
2.2 ->
2.3 ->
3.1 ->
4.1 -> 2.1, 2.2
4.2 -> 2.2, 2.3, 4.1
4.3 -> 4.1
5.1 -> 2.1
5.2 -> 5.1, 1.1
5.3 -> 3.1
6.1 -> 4.2
6.2 -> 6.1
7.1 -> 1.1, 3.1, 4.2, 5.2
8.1 -> 7.1, 6.2
8.2 -> 8.1
8.3 -> 8.2

## Notes

- Tests (task 1.2) are optional per project conventions
- NO pip installs, NO npm installs — all code is pure Python/vanilla JS
- Version number and index updates happen only once at the very end (task 8)
