# W779: _viewLocationInContext(event)

## What the web function does
Navigates to the CWOC maps page (`/frontend/html/maps.html`) with `?focus=chit&address=...` query parameters, so the internal map centers on the chit's location. Checks for unsaved changes before navigating (shows confirm dialog if dirty).

This is different from "Open in Maps" (which opens an external maps service) — this opens the INTERNAL CWOC maps page with the chit's location highlighted.

## What exists on Android
- "Open in Maps" AssistChip fires a `geo:` intent → opens external maps app (Google Maps, etc.)
- Comment in code mentions "H4: Context button (view in maps page)" but it's NOT implemented
- The Map route (`Screen.Map`) doesn't accept focus/address navigation arguments
- MapViewModel reads `focusAddress` from savedStateHandle but the route doesn't pass it

## What's missing
1. **No "View in Context" button** in the editor's LocationZone that navigates to the internal MapScreen
2. **Map route doesn't accept parameters** — `Screen.Map` is just `"map"` with no args for focus/address
3. **No unsaved changes check** before navigating (though this would be needed if the button existed)
4. The infrastructure partially exists (MapViewModel reads focusAddress from savedStateHandle) but the navigation path to pass it doesn't exist
