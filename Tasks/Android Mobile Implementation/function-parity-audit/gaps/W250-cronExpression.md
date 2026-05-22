# W250-252: Cron Expression Functions (Rules Engine)

## What the web functions do
- `_describeCron(expr)` — Converts a cron expression into a human-readable description (e.g., "0 9 * * 1-5" → "At 9:00 AM, Monday through Friday").
- `_assembleCronExpression()` — Builds a cron expression from the rule editor's UI inputs (minute, hour, day-of-month, month, day-of-week fields).
- `_validateCronExpression(expr)` — Validates a cron expression for correctness (proper field count, valid ranges, valid special characters).

## What exists on Android
- RuleEditorScreen has trigger type selection
- Cron-based triggers may be configured but the expression builder/validator is unclear

## What's missing
1. No human-readable cron description display
2. No visual cron expression builder (UI inputs → cron string)
3. No cron expression validation with user-friendly error messages
4. Users may need to type raw cron expressions without assistance
