# W176-179: Map Thumbnails on Cards

## What the web functions do
W176-179 render inline map thumbnail previews on chit cards that have a location. Shows a small static map image (from OpenStreetMap tiles) directly on the card in list/calendar views, giving visual context about where the chit is located without opening the editor.

## What exists on Android
- Cards show location text but no map thumbnail preview
- The editor's LocationZone shows coordinates after geocoding
- The full MapScreen shows all chits on a map
- `showMapThumbnails` setting exists in TasksViewModel but no thumbnail rendering on cards

## What's missing
1. No inline map thumbnail/preview on chit cards in list views
2. No static map tile rendering for card-level location preview
3. The setting `showMapThumbnails` is read but not used to render anything
4. Users must open the editor or navigate to the Map screen to see location context
