# Design Document: Cron Triggers & Habit Rules

## Overview

This feature extends the existing Rules Engine with two capabilities:

1. **Cron-based scheduling** — Full cron expression support for the `scheduled` trigger type, replacing the limited daily/hourly frequency model with standard 5-field cron syntax.
2. **Habit mode for rules** — Rules can opt into "habit" tracking, where each scheduled execution is recorded as achieved/missed, with streak and success rate calculations visible in the Habits view.

Both features build directly on the existing rules infrastructure (tables, scheduler loop, condition evaluator, action executor) with minimal new code.

## Architecture

```mermaid
flowchart TD
    subgraph "Scheduler Loop (existing, enhanced)"
        A[_rules_scheduled_loop<br/>polls every 60s] --> B{For each enabled<br/>scheduled rule}
        B --> C{schedule_config<br/>has 'cron' field?}
        C -->|yes| D[Parse cron expression<br/>check if current minute matches]
        C -->|no| E[Existing frequency/interval<br/>logic (backward compat)]
        D -->|matches| F[Evaluate conditions<br/>against all entities]
        E -->|due| F
        F --> G{habit_mode?}
        G -->|yes| H[Record habit history entry<br/>achieved/not-achieved]
        G -->|no| I[Standard execution<br/>log only]
        H --> J[Execute/queue actions]
        I --> J
    end

    subgraph "Habits View Integration"
        K[GET /api/rules?habit=true] --> L[Return habit rules<br/>with habit_summary]
        L --> M[Habits View renders<br/>rule habits alongside<br/>chit habits]
    end
```

### Design Rationale

- **Cron parsing in pure Python** — A lightweight cron parser implemented in `rules_engine.py` (no external dependencies). Cron is a well-defined standard; parsing 5 fields is ~80 lines of code. No need for `croniter` or similar packages.
- **Backward compatibility** — The `schedule_config` JSON gains an optional `cron` field. If present, it takes precedence over `frequency`/`interval`/`time_of_day`. Existing rules continue working unchanged.
- **Habit history on the rule record** — Rather than creating a separate table, habit execution history is stored as a JSON array in a new `habit_history` column on the `rules` table. This mirrors how chit habits use `recurrence_exceptions`. Keeps queries simple and avoids join overhead.
- **Period derivation from cron** — A daily cron (fires once per day) = daily habit period. A weekly cron (fires once per week, e.g., `0 9 * * 1`) = weekly period. Sub-daily cron = daily period (multiple fires per day, but the habit is "achieved" once any execution matches).
- **"Achieved" semantics for maintenance rules** — For rules like "archive old emails," success means the rule ran without errors. Whether it found 0 or 50 matching emails, the maintenance task was performed. The habit is only "missed" if the rule didn't fire at all (server was down, rule was disabled).

## File Changes

### Modified Files

| File | Change |
|------|--------|
| `src/backend/migrations.py` | Add `migrate_add_habit_mode_to_rules()` — adds `habit_mode` (BOOLEAN DEFAULT 0) and `habit_history` (TEXT) columns to `rules` table |
| `src/backend/rules_engine.py` | Add `parse_cron_expression(expr)` and `cron_matches_time(parsed, now)` functions. Add `days_ago_greater_than` and `days_ago_less_than` operators to `evaluate_leaf()` |
| `src/backend/schedulers.py` | Modify `_is_scheduled_rule_due()` to check for `cron` field first, falling back to existing logic. Add habit history recording after execution |
| `src/backend/routes/rules.py` | Extend `list_rules` response to include `habit_summary` for habit rules. Add `habit_history` to serialized output |
| `src/backend/models.py` | Add `habit_mode` (Optional[bool]) and `habit_history` (Optional[list]) to `RuleCreate`/`RuleUpdate` |
| `src/frontend/js/pages/rule-editor.js` | Add cron builder UI, schedule mode toggle (Simple/Cron), cron presets, human-readable preview, habit mode checkbox |
| `src/frontend/html/rule-editor.html` | Add cron builder HTML section, habit mode toggle |
| `src/frontend/js/shared/shared-habits.js` | Add function to fetch and render habit rules alongside habit chits |

### New Files

| File | Purpose |
|------|---------|
| `src/backend/cron_parser.py` | Pure-Python cron expression parser — `parse_cron(expr) → ParsedCron`, `matches(parsed, datetime) → bool`, `describe(parsed) → str` (human-readable description) |

## Data Model Changes

### Rules Table — New Columns

```sql
ALTER TABLE rules ADD COLUMN habit_mode BOOLEAN DEFAULT 0;
ALTER TABLE rules ADD COLUMN habit_history TEXT;  -- JSON array
```

### schedule_config JSON — Extended Shape

```json
{
  "cron": "0 6 * * *",
  "frequency": "daily",
  "interval": 1,
  "time_of_day": "06:00"
}
```

When `cron` is present, it takes precedence. The `frequency`/`interval`/`time_of_day` fields are kept for backward compatibility and for the "Simple" mode in the UI.

### habit_history JSON Shape

```json
[
  {
    "date": "2026-05-13",
    "status": "achieved",
    "entities_matched": 3,
    "actions_applied": 3,
    "executed_datetime": "2026-05-13T06:00:12"
  },
  {
    "date": "2026-05-12",
    "status": "achieved",
    "entities_matched": 0,
    "actions_applied": 0,
    "executed_datetime": "2026-05-12T06:00:08"
  }
]
```

Status values: `"achieved"` (rule ran, regardless of match count), `"missed"` (rule was due but didn't fire — e.g., server was down).

### habit_summary Response Shape (computed, not stored)

```json
{
  "current_status": "achieved",
  "streak": 14,
  "success_rate": 0.93,
  "last_achieved_datetime": "2026-05-13T06:00:12",
  "period": "daily"
}
```

## Cron Parser Design

### Input Format

Standard 5-field cron: `minute hour day-of-month month day-of-week`

### Supported Syntax

| Token | Example | Meaning |
|-------|---------|---------|
| `*` | `* * * * *` | Every minute |
| Value | `30 9 * * *` | At 9:30 |
| Range | `0 9-17 * * *` | Every hour 9am–5pm |
| List | `0 9,12,17 * * *` | At 9am, noon, 5pm |
| Step | `*/15 * * * *` | Every 15 minutes |
| Range+Step | `0 9-17/2 * * *` | Every 2 hours 9am–5pm |
| Day names | `0 9 * * MON-FRI` | Weekdays at 9am |
| Month names | `0 0 1 JAN,JUL *` | Jan 1 and Jul 1 at midnight |

### Implementation

```python
# src/backend/cron_parser.py

def parse_cron(expression: str) -> dict:
    """Parse a 5-field cron expression into a structured dict.
    
    Returns: {
        "minutes": set of ints (0-59),
        "hours": set of ints (0-23),
        "days_of_month": set of ints (1-31),
        "months": set of ints (1-12),
        "days_of_week": set of ints (0-6, 0=Sunday)
    }
    """

def matches(parsed: dict, dt: datetime) -> bool:
    """Check if a datetime matches a parsed cron expression."""

def describe(expression: str) -> str:
    """Return a human-readable description of a cron expression."""
```

## New Condition Operators

### `days_ago_greater_than`

Computes `(now_utc - field_value).days` and checks if it exceeds the threshold.

```python
# In evaluate_leaf():
if operator == "days_ago_greater_than":
    field_dt = parse_datetime(field_value)
    if not field_dt:
        return False
    age_days = (datetime.utcnow() - field_dt).days
    return age_days > int(value)
```

### `days_ago_less_than`

Same logic, reversed comparison.

## Frontend: Cron Builder UI

The cron builder appears when "Scheduled" trigger is selected and the user toggles to "Cron" mode (vs. "Simple" mode which shows the existing daily/hourly UI).

```
┌─────────────────────────────────────────────────┐
│ Schedule Mode: [Simple] [Cron]                  │
├─────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Minute  │ │  Hour   │ │  DoM    │            │
│ │  [0   ] │ │  [6   ] │ │  [*   ] │            │
│ └─────────┘ └─────────┘ └─────────┘            │
│ ┌─────────┐ ┌─────────┐                        │
│ │  Month  │ │   DoW   │                        │
│ │  [*   ] │ │  [*   ] │                        │
│ └─────────┘ └─────────┘                        │
│                                                 │
│ Preview: "Every day at 6:00 AM"                 │
│                                                 │
│ Presets: [Every morning] [Every hour]           │
│          [Weekdays 9am] [1st of month]          │
├─────────────────────────────────────────────────┤
│ ☐ Track as Habit                                │
│   (Show in Habits view, track streak)           │
└─────────────────────────────────────────────────┘
```

## Integration Points

### Habits View

The existing habits rendering code (`shared-habits.js`) will gain a new function `fetchHabitRules()` that calls `GET /api/rules?habit=true` and renders them in the habits list with a robot badge. Clicking navigates to the rule editor.

### Scheduler Loop

The existing `_rules_scheduled_loop()` in `schedulers.py` is modified minimally:
1. In `_is_scheduled_rule_due()`, check for `schedule_config.cron` first
2. After execution, if `habit_mode` is true, append to `habit_history`
3. Trim `habit_history` to last 365 entries to prevent unbounded growth

### Example Rule: Archive Old Emails

```json
{
  "name": "Archive old emails from noreply@example.com",
  "trigger_type": "scheduled",
  "habit_mode": true,
  "schedule_config": {
    "cron": "0 6 * * *"
  },
  "conditions": {
    "type": "group",
    "operator": "AND",
    "children": [
      {"type": "leaf", "field": "email_from", "operator": "equals", "value": "noreply@example.com"},
      {"type": "leaf", "field": "email_date", "operator": "days_ago_greater_than", "value": "7"},
      {"type": "leaf", "field": "archived", "operator": "equals", "value": "false"}
    ]
  },
  "actions": [
    {"type": "archive", "params": {}}
  ],
  "confirm_before_apply": false
}
```
