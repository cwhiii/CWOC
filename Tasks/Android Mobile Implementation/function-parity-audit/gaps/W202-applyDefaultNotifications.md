# W202: _applyDefaultNotifications(mode)

## What the web function does
When a NEW chit first gets a date mode assigned (due, startend, perpetual), automatically populates the alerts/notifications list with the user's configured default notifications from settings. For example, if the user has "15 min before start" as a default, it auto-adds that notification when they set a start date.

Settings field: `default_notifications` — JSON with `{start: [...], due: [...]}` arrays of default notification configs.

## What exists on Android
- `default_notifications` setting is synced and stored in SettingsEntity
- ChitEditorViewModel has access to settings
- AlertsZone renders notifications
- No auto-population of defaults when date mode is first set

## What's missing
1. No auto-population of default notifications when a date mode is first activated on a new chit
2. The `default_notifications` setting is stored but never read/applied during editor initialization
3. Users must manually add notifications every time, even though they've configured defaults
