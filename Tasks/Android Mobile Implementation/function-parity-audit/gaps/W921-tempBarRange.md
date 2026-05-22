# W921: _tempBarRange()

## What the web function does
Returns the min/max temperature range for visual temperature bars. Metric: -10°C to 40°C. Imperial: -14°F to 104°F. Used by the weather forecast display to render colored gradient bars showing where the day's high/low temperatures fall within the overall range.

## What exists on Android
The Android weather screen (WeatherScreen.kt) displays high/low temperatures as text only ("H: 75° L: 55°"). There is no visual temperature bar with a gradient showing the relative position of temps within a range.

## What's missing
- The entire visual temperature bar feature is missing from the Android weather display. The web shows a colored gradient bar (blue→green→yellow→orange→red) with the day's low-to-high range highlighted, plus tick marks and callout labels. The Android just shows plain text values.
- This helper function (`_tempBarRange`) would need to be implemented as part of adding the temperature bar visualization to the Android weather screen.
