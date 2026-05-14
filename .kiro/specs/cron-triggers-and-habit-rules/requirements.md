# Requirements Document

## Introduction

This feature extends the CWOC Rules Engine with two enhancements:

1. **Cron-based triggers** — Replace the limited "daily/hourly" schedule config with full cron expression support, enabling rules to fire on complex schedules like "every Monday at 9am", "first of the month at midnight", "every 15 minutes during work hours", etc.

2. **Habit rule type: due/achieved** — A new top-level rule concept where a rule itself has a "habit" lifecycle. The rule is "due" on its cron schedule and "achieved" when its conditions match and actions execute successfully. This enables tracking rule execution as a recurring obligation (e.g., "archive old emails from X address" should happen regularly — if it hasn't fired in a while, it's overdue).

**Example use case:** A rule that checks for email chits from a specific sender address that arrived 7+ days ago and archives them. This rule runs on a cron schedule (e.g., daily at 6am). As a habit rule, it shows as "due" each day and "achieved" once it successfully runs and archives matching emails.

## Glossary

- **Cron_Expression**: A standard 5-field cron string (`minute hour day-of-month month day-of-week`) that defines when a scheduled rule should fire. Supports standard cron syntax including wildcards (`*`), ranges (`1-5`), lists (`1,3,5`), and step values (`*/15`).
- **Habit_Rule**: A rule with `habit_mode` enabled that tracks its execution as a recurring obligation. Each scheduled execution is either "achieved" (conditions matched and actions ran) or "missed" (no entities matched or rule didn't fire). This integrates with the existing habits view for visibility.
- **Due_State**: A habit rule is "due" when its cron schedule indicates it should have fired but hasn't yet in the current period.
- **Achieved_State**: A habit rule is "achieved" when it has successfully executed (matched entities and applied actions) within its current period.

## Requirements

### Requirement 1: Cron Expression Support in Schedule Config

**User Story:** As a CWOC user, I want to define rule schedules using cron expressions, so that I can trigger rules on complex recurring patterns beyond just "daily" or "every N hours."

#### Acceptance Criteria

1. THE schedule_config JSON SHALL support a new `cron` field containing a standard 5-field cron expression string (minute, hour, day-of-month, month, day-of-week)
2. THE Rules_Engine scheduled loop SHALL parse cron expressions and determine whether the current time matches the expression, replacing the existing frequency/interval/time_of_day logic when a `cron` field is present
3. THE cron parser SHALL support: wildcards (`*`), specific values (`5`), ranges (`1-5`), lists (`1,3,5`), step values (`*/15`, `1-30/5`), and day-of-week names (`MON-FRI`)
4. THE Rules_Engine SHALL maintain backward compatibility — existing rules with `frequency`/`interval`/`time_of_day` in their schedule_config SHALL continue to work unchanged
5. WHEN a cron expression is invalid or unparseable, THE Rules_Engine SHALL log a warning and skip that rule's execution (not crash the scheduler loop)
6. THE cron evaluation SHALL account for the 60-second polling interval — a rule is "due" if the current minute matches the cron expression and the rule hasn't already run in this minute

### Requirement 2: Cron Expression UI in Rule Editor

**User Story:** As a CWOC user, I want a user-friendly way to build cron schedules in the Rule Editor, so that I don't have to memorize cron syntax.

#### Acceptance Criteria

1. WHEN the "Scheduled" trigger type is selected, THE Rule_Editor SHALL display a schedule mode toggle: "Simple" (existing daily/hourly) and "Cron" (new cron expression mode)
2. IN Cron mode, THE Rule_Editor SHALL display a cron builder with five labeled fields (Minute, Hour, Day of Month, Month, Day of Week) each with a text input and a helper dropdown for common values
3. THE Rule_Editor SHALL display a human-readable preview of the cron expression below the builder (e.g., "Every weekday at 9:00 AM", "Every 15 minutes", "First of each month at midnight")
4. THE Rule_Editor SHALL provide preset buttons for common schedules: "Every morning (0 9 * * *)", "Every hour (0 * * * *)", "Weekdays at 9am (0 9 * * 1-5)", "First of month (0 0 1 * *)"
5. THE Rule_Editor SHALL validate the cron expression on save and display an error if it's invalid
6. THE Rule_Editor SHALL store the cron expression in `schedule_config.cron` alongside any existing fields for backward compatibility

### Requirement 3: Habit Mode for Rules

**User Story:** As a CWOC user, I want to mark certain rules as "habits" so that I can track whether my automated maintenance tasks are actually running and achieving their goals on schedule.

#### Acceptance Criteria

1. THE rules table SHALL support a `habit_mode` boolean column (default false) indicating whether the rule tracks execution as a habit
2. WHEN a habit rule executes on schedule and matches at least one entity (actions applied or queued), THE Rules_Engine SHALL record the execution as "achieved" for that period
3. WHEN a habit rule executes on schedule but matches zero entities, THE Rules_Engine SHALL record the execution as "due but not achieved" (the rule ran but found nothing to act on — this is informational, not a failure)
4. THE Rules_Engine SHALL track habit rule state using a `habit_history` JSON field on the rule record, storing an array of `{date, status, entities_matched, actions_applied}` entries (similar to chit recurrence_exceptions)
5. THE Rules_Engine SHALL expose habit rule status via the existing `/api/rules` endpoint, including current period status (due/achieved/missed) and streak information
6. A habit rule's "period" SHALL be derived from its cron expression — daily cron = daily period, weekly cron = weekly period, monthly cron = monthly period. For sub-daily cron expressions, the period defaults to daily.

### Requirement 4: Habit Rules Visibility in Habits View

**User Story:** As a CWOC user, I want my habit rules to appear alongside my habit chits in the Habits view, so that I have a unified view of all my recurring obligations.

#### Acceptance Criteria

1. THE Habits view SHALL display habit rules alongside habit chits, visually distinguished with a 🤖 badge or similar indicator
2. EACH habit rule in the Habits view SHALL show: rule name, current period status (due/achieved/missed), streak count, and success rate
3. THE user SHALL be able to click a habit rule in the Habits view to navigate to the Rule Editor for that rule
4. THE Habits view SHALL include habit rules in its overall success rate calculation if the user has opted in (via a toggle or setting)
5. THE `/api/rules` endpoint SHALL include a `habit_summary` object for habit rules containing: `current_status` (due/achieved/missed), `streak`, `success_rate`, `last_achieved_datetime`

### Requirement 5: Email Age Condition Operator

**User Story:** As a CWOC user, I want to create conditions based on how old an email is (days since received), so that I can build rules like "archive emails older than 7 days from address X."

#### Acceptance Criteria

1. THE Rules_Engine SHALL support a new operator `days_ago_greater_than` that compares the age of a date field (in days from now) against a numeric threshold
2. THE Rules_Engine SHALL support a new operator `days_ago_less_than` for the inverse comparison
3. THESE operators SHALL work on any date/datetime field (email_date, created_datetime, start_datetime, due_datetime, etc.)
4. THE Rule_Editor field/operator dropdowns SHALL include these new operators when a date-type field is selected
5. THE age calculation SHALL use UTC for consistency with the existing datetime handling in CWOC

### Requirement 6: Example Rule — Archive Old Emails from Specific Sender

**User Story:** As a CWOC user, I want to set up a rule that automatically archives emails from a specific address that are 7+ days old, running on a daily schedule as a habit rule.

#### Acceptance Criteria

1. THE system SHALL support creating a rule with: trigger_type "scheduled", cron expression "0 6 * * *" (daily at 6am), habit_mode enabled
2. THE rule's condition tree SHALL support: AND group containing (email_from equals "specific@address.com") AND (email_date days_ago_greater_than 7) AND (archived equals false)
3. THE rule's action SHALL be: archive (sets archived=true on matching chits)
4. WHEN this rule fires daily and finds matching emails, it SHALL archive them and record the execution as "achieved"
5. WHEN this rule fires daily and finds no matching emails (all already archived or none old enough), it SHALL record as "achieved" (the rule ran successfully — absence of work is still success for maintenance rules)
6. THIS requirement serves as a validation scenario — no special code needed beyond the features in Requirements 1-5
