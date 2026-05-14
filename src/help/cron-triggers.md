# Cron Triggers & Habit Rules

The Rules Engine supports **cron-based scheduling** for precise control over when rules fire, and **habit mode** for tracking whether automated maintenance tasks actually run on schedule.

## Cron Expression Syntax

A cron expression is a 5-field string that defines a recurring schedule: `minute hour day-of-month month day-of-week`. When a rule's schedule config includes a `cron` field, it takes precedence over the simple frequency/interval settings.

| Field | Range | Description |
|-------|-------|-------------|
| Minute | 0–59 | Minute of the hour |
| Hour | 0–23 | Hour of the day (24h) |
| Day of Month | 1–31 | Day of the month |
| Month | 1–12 or JAN–DEC | Month of the year |
| Day of Week | 0–6 or MON–SUN | Day of the week (0 = Sunday) |

## Supported Syntax

| Token | Example | Meaning |
|-------|---------|---------|
| `*` | `* * * * *` | Every minute (wildcard) |
| Value | `30 9 * * *` | At a specific value (9:30 AM) |
| Range | `0 9-17 * * *` | Every hour from 9 AM to 5 PM |
| List | `0 9,12,17 * * *` | At 9 AM, noon, and 5 PM |
| Step | `*/15 * * * *` | Every 15 minutes |
| Range + Step | `0 9-17/2 * * *` | Every 2 hours from 9 AM to 5 PM |
| Day names | `0 9 * * MON-FRI` | Weekdays at 9 AM |
| Month names | `0 0 1 JAN,JUL *` | Jan 1 and Jul 1 at midnight |

## Common Examples

| Expression | Description |
|-----------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * MON-FRI` | Weekdays at 9:00 AM |
| `0 0 1 * *` | First of every month at midnight |
| `0 6 * * *` | Every morning at 6:00 AM |
| `0 * * * *` | Every hour on the hour |
| `30 8 * * 1` | Every Monday at 8:30 AM |

## Cron Builder UI

In the Rule Editor, when the "Scheduled" trigger type is selected, a **Simple/Cron** toggle lets you switch between the basic frequency picker and the full cron builder. The cron builder provides five labeled input fields (Minute, Hour, Day of Month, Month, Day of Week) plus a live human-readable preview of the expression. Preset buttons — "Every morning", "Every hour", "Weekdays 9am", "1st of month" — populate common schedules with one click.

## Habit Mode for Rules

Any scheduled rule can be marked as a **habit** by checking "Track as Habit" in the Rule Editor. When enabled, the rule's execution is tracked as a recurring obligation — each scheduled run is recorded as **achieved** or **missed**, with streak and success rate calculations visible in the [Habits view](/frontend/html/help.html#habits).

- **Achieved** — The rule ran on schedule (regardless of how many entities matched)
- **Missed** — The rule was due but didn't fire (e.g., server was down during the scheduled time)
- **Period** — Derived from the cron expression: daily cron = daily period, weekly cron = weekly period, monthly cron = monthly period. Sub-daily cron expressions default to a daily period
- **Streak** — Consecutive periods where the rule achieved its goal
- **Success rate** — Percentage of periods where the rule was achieved vs. total periods

Habit rules appear in the **[Habits view](/frontend/html/help.html#habits)** alongside habit chits, distinguished by a 🤖 badge.

## "Days Ago" Condition Operators

Two date-based operators let you build conditions based on how old a record is:

- **`days_ago_greater_than`** — True when the field's date is more than N days in the past
- **`days_ago_less_than`** — True when the field's date is fewer than N days in the past

These operators work on any date/datetime field: `email_date`, `created_datetime`, `start_datetime`, `due_datetime`, `modified_datetime`, `point_in_time`, `completed_datetime`.

## Weather Condition Operators

Rules can trigger based on current weather conditions or forecast data for your default location.

### Current Weather Operators

- **weather: low temp below** — Today's low temperature is below threshold (°C)
- **weather: high temp above** — Today's high temperature is above threshold (°C)
- **weather: precipitation above** — Today's precipitation is above threshold (mm)
- **weather: wind speed above** — Today's max wind speed is above threshold (km/h)
- **weather: wind gusts above** — Today's max wind gusts are above threshold (km/h)

### Forecast Window Operators

These operators check if ANY day in the forecast window meets the condition. Use format "threshold|days":

- **forecast: contains low temp below** — Any day in next N days has low temp below threshold
- **forecast: contains high temp above** — Any day in next N days has high temp above threshold
- **forecast: contains precipitation above** — Any day in next N days has precipitation above threshold
- **forecast: contains wind speed above** — Any day in next N days has wind speed above threshold
- **forecast: contains wind gusts above** — Any day in next N days has wind gusts above threshold

## Create Chit Action

The "Create Chit" action generates new chits based on rule conditions. Template variables available:

- `{{title}}`, `{{note}}`, `{{status}}`, `{{location}}`, `{{today}}`, `{{now}}`, `{{owner_id}}`
- `{{weather_low}}`, `{{weather_high}}`, `{{weather_precipitation}}`, `{{weather_wind_speed}}`, `{{weather_wind_gusts}}`

## Habit Event Triggers

Rules can react to habit state changes using three dedicated trigger types:

- **🎯 Habit Achieved** — Fires when a habit is completed for its current period
- **🎯 Habit Missed** — Fires when a habit's period passes without being achieved
- **🎯 Habit Due (with offset)** — Fires at a configurable time offset relative to the habit's scheduled time

---

**See also:** [Habits](/frontend/html/help.html#habits) · [Home Assistant](/frontend/html/help.html#home-assistant) · [Weather](/frontend/html/weather.html) · [Settings](/frontend/html/settings.html)
