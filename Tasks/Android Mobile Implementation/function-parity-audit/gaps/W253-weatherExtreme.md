# W253-255: Weather Page Helpers

## What the web functions do
- `_wxIsExtreme(highC, lowC, weatherCode)` — Determines if weather conditions are "extreme" (very hot, very cold, severe storms) for visual highlighting on the weather page.
- `_wxInitBlockClick(container)` — Initializes click handlers on weather day blocks to navigate to the calendar for that date (click a weather day → jump to that day in calendar view).
- `_wxInitDragDrop(container)` — Initializes drag-and-drop reordering of weather location rows (user can reorder which location appears first/second/etc.).

## What exists on Android
- WeatherScreen shows forecasts for all saved locations
- No extreme weather highlighting
- No click-to-navigate from weather day to calendar
- No drag-to-reorder location rows

## What's missing
1. No extreme weather visual highlighting (red/orange backgrounds for severe conditions)
2. No tap-on-day → navigate to calendar for that date
3. No drag-to-reorder for weather location cards
4. Weather page is display-only with no interactive navigation or customization
