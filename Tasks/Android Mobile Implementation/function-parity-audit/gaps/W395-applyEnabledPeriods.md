# W395: _applyEnabledPeriods()

## What the web function does
Reads the `enabled_periods` setting (comma-separated list like "Day,Week,Month") and hides/disables period options that aren't in the list. The sidebar's period dropdown only shows periods the user has enabled in settings. For example, if "Year" is disabled, it won't appear in the period selector.

## What exists on Android
- `enabled_periods` setting is synced and stored in SettingsEntity
- SidebarContent has a TimePeriodDropdown
- The dropdown shows ALL periods regardless of the enabled_periods setting

## What's missing
1. TimePeriodDropdown does not filter options based on `enabled_periods` setting
2. All period options (Day, Week, Month, Quarter, Year, All) are always shown
3. Users cannot hide period options they don't use (setting is ignored on Android)
