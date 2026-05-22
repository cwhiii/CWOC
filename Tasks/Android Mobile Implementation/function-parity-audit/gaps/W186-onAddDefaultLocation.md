# W186: onAddDefaultLocation(event)

## What the web function does
When the user clicks the "+Location" button in the editor's location zone (when no location is set), it:
1. Calls `getDefaultLocation()` which finds the saved location with `is_default === true`
2. If no default location exists, shows an error toast: "No default location set — configure in Settings"
3. If a default exists, populates the location input with `defaultLoc.address`
4. Calls `_updateViewInContextBtn()` to show action buttons (Search, Map, Directions, Clear)
5. Marks the editor as dirty (`setSaveButtonUnsaved()`)
6. Triggers `searchLocationMap()` to geocode and fetch weather

The button toggles between "+Location" (when empty) and "✕ Clear" (when populated) via `_updateViewInContextBtn()`.

## What exists on Android
- `LocationZone` (A#1028) in ChitEditorScreen.kt has a "Saved Locations" dropdown that shows all saved locations by name
- When a location is selected from the dropdown, it populates the field and auto-geocodes
- The "Clear" button exists and works
- However, there is NO dedicated "+Location" / "Add default" button that instantly populates from the default saved location without requiring the user to open the dropdown and pick

## Additional issue
The Android `ChitEditorViewModel` only extracts `name` from saved locations JSON (`it["name"] as? String`), not `address`. The web uses `loc.address` as the value that goes into the location field. This means even when selecting from the dropdown, Android puts the label (e.g., "Home") into the location field rather than the full address (e.g., "123 Main St, Springfield, IL 62701"). The geocoding then has to resolve the label, which may be less reliable than geocoding a full address.

## What's missing
1. A "+Location" button (or equivalent quick-action) that instantly populates the location field from the user's default saved location without requiring dropdown interaction
2. The ViewModel should extract `address` (not just `name`) from saved locations, and use the address as the location field value (matching web behavior)
3. The toggle behavior: button shows "+Location" when field is empty, "Clear" when populated (Android has a separate always-visible "Clear" chip, which is acceptable but the one-tap default population is missing)
