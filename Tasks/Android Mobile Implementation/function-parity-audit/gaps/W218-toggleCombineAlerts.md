# W218: _toggleCombineAlerts()

## What the web function does
Toggles the "Combine Alerts" visual indicator setting. When enabled, all alert types (alarm, notification, timer, stopwatch) are shown as a single 🛎️ icon on cards instead of individual icons per type. This is a settings toggle in the Visual Indicators section.

## What exists on Android
- `combine_alerts` setting is synced and stored
- ChitCardEnhancements reads visual indicator settings
- The setting value is available but there's no UI toggle to change it

## What's missing
1. No "Combine Alerts" toggle in the Android Settings → Visual Indicators section
2. The setting is stored/synced but cannot be changed from the Android app
3. Users must change this setting from the web app
