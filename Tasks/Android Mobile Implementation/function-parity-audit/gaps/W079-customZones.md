# W79-W84: Custom Zones in Editor (editor-custom-zones.js)

## What the web feature does
User-defined custom zones in the chit editor. Users can create named zones (via Custom Objects editor), assign custom objects to them, and those zones appear as collapsible sections in the chit editor with input fields for each assigned object.

Functions:
- W79: `window._customZoneData` — state holding custom zone field values
- W80: `_fetchCustomZones()` — fetch user's custom zones from API
- W81: `_fetchZoneObjects(zoneId)` — fetch objects assigned to a specific zone
- W82: `_renderCustomZonePanel(zone, objects, settings, healthData)` — render a zone panel with fields
- W83: `_loadCustomZones(chit)` — entry point: load zones and populate from chit's health_data
- W84: `_gatherCustomZoneData()` — collect zone data for saving

## What exists on Android
Nothing in the editor. The `HealthIndicatorsZone` exists (for the built-in indicators_zone), but user-defined custom zones with their own zone IDs do NOT appear in the Android editor.

The Custom Objects screen (`ui/screens/customobjects/`) exists for managing the objects themselves, but the editor doesn't render custom zone panels.

## What's missing
The entire custom zones rendering in the chit editor. When a user creates a custom zone and assigns objects to it, those zones should appear as additional collapsible sections in the editor (below the health indicators zone).

## Fix needed
1. Fetch custom zones from `/api/custom-zones` in ChitEditorViewModel
2. For each zone, fetch assigned objects from `/api/custom-objects?zone_id=X`
3. Render a collapsible zone panel for each custom zone with input fields per object
4. Read/write values from/to the chit's `health_data` JSON field (same storage as indicators)
