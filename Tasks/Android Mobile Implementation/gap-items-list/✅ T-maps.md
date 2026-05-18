# T — Maps (3 items: T1–T3)

## Status: COMPLETE — all 3 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/map/MapViewModel.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/map/MapScreen.kt`

---

## T1 — Saved locations not shown as markers ✅ COMPLETE (3/3 sub-items)

1. ✅ MapViewModel loads `settings.savedLocations` JSON and parses into `ChitMarker` objects
2. ✅ Saved locations shown with gold color (#FFD700) and "⭐" prefix to differentiate from chit markers
3. ✅ Saved markers prepended to the markers list so they appear alongside chit markers

## T2 — No settings integration (default lat/lon/zoom) ✅ COMPLETE (3/3 sub-items)

1. ✅ `defaultLat`, `defaultLon`, `defaultZoom` StateFlows loaded from `settings.mapDefaultLat/Lon/Zoom`
2. ✅ MapView factory uses these values for initial center and zoom level
3. ✅ Falls back to US center (39.8, -98.5, zoom 4) when no settings configured

## T3 — Text addresses not geocoded (most chits invisible) ✅ COMPLETE (3/3 sub-items)

1. ✅ When `parseMarker()` returns null (no coordinates in location field), falls through to geocoding
2. ✅ Calls `GeocodingUtil.geocode(chit.location)` to resolve text addresses to coordinates
3. ✅ Successfully geocoded chits are added to the markers list and appear on the map
