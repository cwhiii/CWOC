# W221-222: Badge Custom Detector Modal

## What the web functions do
- `_openBadgeCustomModal(existing)` — Opens a modal for creating/editing custom badge detectors. Badges are visual indicators shown on chit cards based on custom conditions (e.g., show a 🔥 badge when priority is "Urgent").
- `_saveBadgeCustomDetector()` — Saves the custom badge detector configuration to settings.

## What exists on Android
- Badge settings are synced and stored
- Badges are displayed on cards based on stored configuration
- No UI to CREATE or EDIT custom badge detectors

## What's missing
1. No "Custom Badge" creation/editing modal in Android Settings
2. No UI to define badge conditions (field, operator, value → icon/color)
3. Users must configure custom badges from the web app; Android only displays them
