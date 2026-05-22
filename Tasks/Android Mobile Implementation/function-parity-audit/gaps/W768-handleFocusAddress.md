# W768: _handleFocusAddress(focusType, address)

## What the web function does
When the maps page is opened with `?focus=...&address=...` query params:
1. Sets `_mapsFocusMode = true` (prevents fitBounds from overriding the centered view)
2. Sets period to "All Time" so the focused chit is guaranteed visible
3. Sets mode based on focusType: "contact" → people mode, else → chits mode
4. Geocodes the address
5. Centers map at zoom 15
6. Adds a temporary gold highlight marker (pulsing circle, 8s auto-remove)
7. Opens popup showing the address

## What exists on Android
- `MapViewModel.focusAddress` / `focusType` read from `savedStateHandle` (navigation args)
- `goToAddress(focusAddress)` called in init — geocodes and emits `flyToPoint`
- `MapScreen` LaunchedEffect animates to `flyToPoint` at zoom 14
- A#1508 `goToAddress` handles the geocoding + fly-to

## What's missing
1. **No mode switching based on focusType** — doesn't switch to People mode when focusType is "contact"
2. **No period override to "All Time"** — focused chit might be filtered out by current period
3. **No temporary highlight marker** — no visual indicator at the focused location (gold circle)
4. **No focus mode flag** — doesn't prevent auto-zoom from overriding the centered view after markers load
