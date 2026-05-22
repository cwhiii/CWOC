# W183: _displayMapInUI(lat, lon, address)

## What the web function does
Renders an inline map embed (iframe or Leaflet mini-map) in the editor's location zone showing the geocoded coordinates. Provides a visual preview of the location directly in the editor without navigating away.

## What exists on Android
- LocationZone shows geocoded coordinates as text (lat/lon display)
- "Open in Maps" button opens external maps app
- No inline map preview within the editor's location zone

## What's missing
1. No inline map preview/embed in the editor's LocationZone
2. Users see coordinates as numbers but no visual map context
3. The web shows a clickable mini-map; Android only shows text coordinates + external app button
