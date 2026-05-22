# W198-199: Perpetual Mode Toggle & Date Formatting

## What the web functions do
- `onPerpetualToggle()` — Toggles perpetual mode in the editor's date zone. Perpetual means "started on X date, no end date" (ongoing). Sets start date to today if empty, clears end date, shows a description like "Since Jan 15, 2024".
- `_fmtPerpetualDate()` — Formats the perpetual start date for display (e.g., "Since January 15, 2024").

## What exists on Android
- The `perpetual` field exists on ChitEntity
- DateZone has date mode options but perpetual mode UI is not implemented
- The field is synced and stored but there's no way to SET it from the Android editor

## What's missing
1. No "Perpetual" date mode option in the DateZone mode selector
2. No UI to toggle perpetual mode on/off
3. No "Since [date]" display for perpetual chits
4. The field exists in the data model but is not exposed in the editor UI
