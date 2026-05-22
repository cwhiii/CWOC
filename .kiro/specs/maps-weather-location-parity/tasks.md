# Implementation Plan: Maps, Weather & Location Parity

## Overview

This plan implements 20 web functions (W176-179, W183, W186, W779, W767, W768, W773, W165-167, W253-255, W791, W921) for Android parity across Maps, Weather, and Location features. Tasks are ordered by dependency — foundational utilities first (GeocodingUtil), then shared composables, then feature-specific integrations, then UI wiring. Each task builds on previous work and ends with integration into the running app.

## Tasks

- [x] 1. Implement Progressive Fallback Geocoding in GeocodingUtil
  - [x] 1.1 Add variant generation to GeocodingUtil <!-- dep: none -->
    - In `GeocodingUtil.kt`, implement `fun generateVariants(address: String): List<String>` that produces deduplicated variants in order: original, no-zip (strip trailing 5-digit or 5+4 zip), period-normalized (`. ` → `, `), comma-split-after-first (everything after first comma), last-two-parts (last two comma-separated segments), city-state-with-zip (regex for `City, ST ZIP`), city-state-without-zip
    - Deduplicate using case-insensitive trimmed comparison, preserving generation order
    - Cap at 7 unique variants maximum
    - Return empty list only if input is blank/whitespace
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 1.2 Add server proxy geocoding with progressive fallback <!-- dep: 1.1 -->
    - Modify `GeocodingUtil.geocode()` to accept `serverUrl: String` and `authToken: String` parameters
    - Check in-memory cache first (keyed by `address.lowercase().trim()`)
    - Call `generateVariants(address)` and try each sequentially against `$serverUrl/api/geocode?q=$variant`
    - On first successful result (non-empty response with lat/lon): cache as `GeoResult(lat, lon, displayName, countryCode)` under the original address key, return result
    - If all variants fail: throw an exception with message "Location not found"
    - Keep existing `geocodeDirect()` as a fallback for when server is unreachable
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 1.3 Write property tests for variant generation (Properties 7, 8) <!-- dep: 1.1 -->
    - **Property 7: Variant generation correctness** — For any non-empty address, variants are unique (case-insensitive trimmed), in specified order, and omit empty/duplicate entries
    - **Property 8: Variant count bound** — For any address, deduplicated variant list contains at most 7 entries
    - Use `@RepeatedTest(100)` with `kotlin.random.Random` to generate random address strings
    - **Validates: Requirements 7.1, 7.2, 7.5**

  - [ ]* 1.4 Write property test for geocode cache round-trip (Property 9) <!-- dep: 1.2 -->
    - **Property 9: Geocode cache round-trip** — For any address that successfully geocodes, cache retrieval with `address.lowercase().trim()` returns same lat/lon/countryCode
    - Mock the server API to return controlled results
    - **Validates: Requirements 7.3**

- [x] 2. Implement StaticMapTile Composable
  - [x] 2.1 Create StaticMapTile composable <!-- dep: none -->
    - Create `android/app/src/main/java/com/cwoc/app/ui/components/StaticMapTile.kt`
    - Implement `@Composable fun StaticMapTile(lat: Double, lon: Double, modifier: Modifier, sizeDp: DpSize)` that:
      - Computes tile x/y from lat/lon at zoom level 14 using Mercator projection: `x = floor((lon + 180) / 360 * 2^14)`, `y = floor((1 - ln(tan(lat_rad) + 1/cos(lat_rad)) / π) / 2 * 2^14)`
      - Constructs URL: `https://tile.openstreetmap.org/14/$x/$y.png`
      - Renders via Coil `AsyncImage` with a pin overlay (small circle or marker icon) centered on the tile
      - Shows a map-marker placeholder icon while loading or on error
    - _Requirements: 1.3, 1.5, 1.6_

  - [ ]* 2.2 Write property test for tile coordinate calculation (Property 2) <!-- dep: 2.1 -->
    - **Property 2: Tile coordinate calculation** — For any lat in [-85.05, 85.05] and lon in [-180, 180], tile x ∈ [0, 16383] and tile y ∈ [0, 16383] at zoom 14
    - Use `@RepeatedTest(100)` with random doubles in valid ranges
    - **Validates: Requirements 1.3**

- [x] 3. Integrate Map Thumbnails on Chit Cards
  - [x] 3.1 Add thumbnail visibility logic and render StaticMapTile on cards <!-- dep: 2.1, 1.2 -->
    - In the chit card composables (list/calendar views), add logic: show `StaticMapTile` if `showMapThumbnails` setting is enabled AND chit has non-empty location AND location differs (case-insensitive) from user's default saved location address
    - Size: 90×60dp (mobile viewport)
    - Show map-marker placeholder while geocode is pending
    - Read `showMapThumbnails` from settings (already exists in TasksViewModel)
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ]* 3.2 Write property test for thumbnail visibility decision (Property 1) <!-- dep: 3.1 -->
    - **Property 1: Thumbnail visibility decision** — Thumbnail shown iff: setting enabled AND location non-empty AND location ≠ default (case-insensitive)
    - Use `@RepeatedTest(100)` with random strings and booleans
    - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 4. Checkpoint — Geocoding and Map Thumbnails
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement InlineMapPreview Composable
  - [x] 5.1 Create InlineMapPreview with osmdroid MapView <!-- dep: none -->
    - Create `android/app/src/main/java/com/cwoc/app/ui/components/InlineMapPreview.kt`
    - Implement `@Composable fun InlineMapPreview(lat: Double, lon: Double, modifier: Modifier)` that:
      - Wraps an osmdroid `MapView` in `AndroidView` composable
      - Sets center to GeoPoint(lat, lon), zoom level 15
      - Adds a `Marker` at the center point
      - Disables touch interactions (scroll, zoom, rotate) — display only
      - Fixed height 200dp, full width
      - Handles lifecycle (onResume/onPause) via `DisposableEffect`
    - _Requirements: 2.1, 2.2_

- [x] 6. Integrate Inline Map Preview and Default Location in Editor LocationZone
  - [x] 6.1 Add InlineMapPreview to LocationZone <!-- dep: 5.1, 1.2 -->
    - In `ChitEditorScreen.kt` LocationZone section, after successful geocode:
      - Display `InlineMapPreview(lat, lon)` below the location input field
      - When location is cleared, remove the map preview
      - If geocode fails, do not show map preview; show toast "Location not found"
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 6.2 Add One-Tap Default Location button <!-- dep: 1.2 -->
    - In LocationZone, when location field is empty: show button with plus icon + "Location" text
    - On tap: read default saved location from settings; populate location field with the `address` field value (NOT name/label)
    - If no default location configured: show toast "No default location set — configure in Settings"
    - After population: replace button with clear button (times icon + "Clear")
    - Trigger geocode + weather fetch (if date is set) or geocode + map only (if no date)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 6.3 Write property tests for address extraction and weather gating (Properties 3, 4) <!-- dep: 6.2 -->
    - **Property 3: Saved location address extraction** — For any saved location JSON with name/label and address fields, extraction always returns address field value
    - **Property 4: Weather fetch gating on date presence** — If location populated but no date set, geocoding triggers but weather fetch does NOT
    - **Validates: Requirements 3.2, 3.4, 3.8**

- [x] 7. Implement View in Context Navigation
  - [x] 7.1 Extend Screen.Map route with focus parameters <!-- dep: none -->
    - In `Screen.kt`, modify `Screen.Map` to accept optional query parameters: `focusType` and `address`
    - Add `fun createRoute(focusType: String?, address: String?): String` that builds the route with URL-encoded parameters
    - In `CwocNavGraph.kt`, update the Map composable route to parse and pass `focusType` and `address` arguments to `MapViewModel`
    - _Requirements: 4.2, 4.5_

  - [x] 7.2 Add View in Context button to LocationZone <!-- dep: 7.1 -->
    - Show "View in Context" button when location input is non-empty; hide when empty
    - On tap: check for unsaved changes → if dirty, show confirmation dialog ("Leave without saving?" with Leave/Cancel)
    - On confirm (or if not dirty): navigate to `Screen.Map.createRoute(focusType = "chit", address = locationText)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Checkpoint — Editor Location Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement People Filter Panel on MapScreen
  - [x] 9.1 Create PeopleFilterPanel composable <!-- dep: none -->
    - Create `android/app/src/main/java/com/cwoc/app/ui/screens/map/PeopleFilterPanel.kt`
    - Implement panel with: text search input (with 300ms debounce), favorites-only toggle, tag filter chips (from all contact tags), "Clear Filters" button
    - Panel visible only when MapScreen is in People or Both display mode
    - _Requirements: 5.1, 5.6_

  - [x] 9.2 Add PeopleFilterState and filter logic to MapViewModel <!-- dep: 9.1 -->
    - Add `PeopleFilterState` data class and `_peopleFilterState` MutableStateFlow to `MapViewModel`
    - Implement `fun applyPeopleFilters(contacts: List<Contact>, state: PeopleFilterState): List<Contact>` with AND composition:
      - If `allPeopleOverride` is true: return all contacts with non-empty address (bypass all filters)
      - If favorites active: filter to `contact.favorite == true`
      - If tags selected: filter to contacts with at least one matching tag (OR within tags)
      - If text search non-empty: case-insensitive substring match across display_name, given_name, surname, middle_names, nickname, organization, social_context, notes, emails, phones, addresses, call_signs, x_handles, websites, tags
    - Wire filter state changes to re-render map markers
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7_

  - [ ]* 9.3 Write property tests for people filter logic (Properties 5, 6) <!-- dep: 9.2 -->
    - **Property 5: People filter AND composition** — Contact appears iff it satisfies ALL active filters simultaneously
    - **Property 6: All People override bypasses filters** — When allPeople=true, every contact with non-empty address appears regardless of other filter values
    - Use `@RepeatedTest(100)` with random contact lists and random filter states
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7**

- [x] 10. Implement Focus Address Handling on MapScreen
  - [x] 10.1 Add FocusState and focus mode behavior to MapViewModel <!-- dep: 7.1, 1.2 -->
    - Add `FocusState` data class and `_focusState` MutableStateFlow
    - On receiving focus parameters from navigation:
      - Set `focusType` → switch to People mode (if "contact") or Chits mode (otherwise)
      - Override time period to "All Time", reset period offset to 0
      - Geocode the focus address via `GeocodingUtil.geocode()`
      - On success: set `highlightPoint`, center map at zoom 15, set `highlightVisible = true`
      - Start 8-second coroutine timer → set `highlightVisible = false`
      - Prevent auto-zoom (fitBounds) while in focus mode
    - On geocode failure: clear focus state, show error toast, remain on default view
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 10.2 Create HighlightMarker composable <!-- dep: 10.1 -->
    - Create `android/app/src/main/java/com/cwoc/app/ui/screens/map/HighlightMarker.kt`
    - Implement a gold pulsing circle overlay at the highlight GeoPoint with a popup showing the address text
    - Animate with infinite pulse (scale 1.0→1.3→1.0) while visible
    - Auto-remove after 8 seconds (controlled by ViewModel state)
    - _Requirements: 6.4, 6.5_

- [x] 11. Checkpoint — Map Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Weather → Calendar Navigation
  - [x] 12.1 Add tap handlers to weather day blocks <!-- dep: none -->
    - In `WeatherScreen.kt`, add `Modifier.clickable` with ripple effect to each day block composable
    - On tap: read the block's date (YYYY-MM-DD format) and associated location name
    - Navigate to Calendar Day view passing date and location as parameters
    - If day block has no valid date attribute: no-op (do not navigate)
    - _Requirements: 8.1, 8.3, 10.1, 10.2, 10.3, 10.4_

  - [x] 12.2 Handle weather navigation parameters in Calendar <!-- dep: 12.1 -->
    - In the Calendar/Day view, accept date and location navigation parameters
    - Display the Day view for the specified date
    - Highlight chits whose location matches the passed location name
    - _Requirements: 8.2_

- [x] 13. Implement Extreme Weather Highlighting
  - [x] 13.1 Add isExtreme detection to WeatherViewModel <!-- dep: none -->
    - In `WeatherViewModel.kt`, implement `fun isExtreme(highC: Double?, lowC: Double?, weatherCode: Int?): Boolean`
      - Return true if: highC ≥ 35 OR lowC ≤ -18 OR weatherCode ∈ {95, 96, 99}
      - Return single boolean regardless of how many conditions are met
    - Apply to each forecast day and expose as part of the day's UI state
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 13.2 Add extreme weather border styling to day blocks <!-- dep: 13.1 -->
    - In `WeatherScreen.kt`, when a day is marked extreme: apply a visually distinct red/orange border (e.g., `Border(2.dp, Color(0xFFD73027))`)
    - Non-extreme days have no special border
    - Single highlight per day regardless of how many extreme conditions are met
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 13.3 Write property test for extreme weather detection (Property 10) <!-- dep: 13.1 -->
    - **Property 10: Extreme weather detection** — isExtreme returns true iff at least one of: highC ≥ 35, lowC ≤ -18, weatherCode ∈ {95, 96, 99}
    - Use `@RepeatedTest(100)` with random doubles and ints
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [x] 14. Implement Weather Location Row Reordering
  - [x] 14.1 Add reorder persistence to WeatherViewModel <!-- dep: none -->
    - In `WeatherViewModel.kt`, add `private val _locationOrder = MutableStateFlow<List<String>>(emptyList())`
    - Implement `fun reorderLocations(fromIndex: Int, toIndex: Int)`:
      - Reorder the list, update state, persist to SharedPreferences as JSON array
    - On load: read saved order from SharedPreferences, apply to forecast list (new locations not in saved order appended at end)
    - _Requirements: 11.2, 11.3_

  - [x] 14.2 Wire drag-to-reorder UI on WeatherScreen <!-- dep: 14.1 -->
    - Add drag handle on each location row
    - Long-press (500ms) + vertical movement initiates reorder
    - During drag: reduce dragged row opacity, highlight drop target
    - On drop: call `viewModel.reorderLocations(from, to)`
    - _Requirements: 11.1, 11.4_

  - [ ]* 14.3 Write property test for reorder persistence round-trip (Property 11) <!-- dep: 14.1 -->
    - **Property 11: Weather location reorder persistence round-trip** — Reorder + persist + load produces reordered sequence with new locations appended at end
    - Use `@RepeatedTest(100)` with random lists and valid index pairs
    - **Validates: Requirements 11.2, 11.3**

- [x] 15. Implement Weather Modal Custom Location Input
  - [x] 15.1 Add "Type a location" option and input UI to WeatherModal <!-- dep: 1.2 -->
    - In `WeatherModal.kt`, add "Type a location" as the last entry in the location selector dropdown
    - On selection: show text input field with placeholder + "Go" button, focus the input
    - On "Go" with non-empty/non-whitespace input: show loading indicator, geocode via `GeocodingUtil.geocode()`, fetch weather for result coordinates, display results
    - On "Go" with empty/whitespace-only input: no-op
    - On geocode failure: show error "Location not found: [address]"
    - On service unreachable: show error "Weather service could not be reached"
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 15.2 Write property test for whitespace input rejection (Property 12) <!-- dep: 15.1 -->
    - **Property 12: Whitespace input rejection** — For any string of only whitespace/empty, "Go" action does not trigger geocoding or weather fetch
    - Use `@RepeatedTest(100)` with random whitespace-only strings
    - **Validates: Requirements 12.4**

- [x] 16. Checkpoint — Weather Interaction Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement Temperature Bar Visualization
  - [x] 17.1 Create TemperatureBar composable <!-- dep: none -->
    - Create `android/app/src/main/java/com/cwoc/app/ui/components/TemperatureBar.kt`
    - Implement `@Composable fun TemperatureBar(config: TempBarConfig, modifier: Modifier)` using `Canvas`:
      - Draw full gradient at reduced opacity (0.3) using color stops: -10°C→deep blue, 0°C→blue, 15°C→neutral, 22°C→yellow, 30°C→red, 40°C→dark red
      - Compute startPct = clamp((dayLow - barMin) / (barMax - barMin) * 100, 0, 100)
      - Compute endPct = clamp((dayHigh - barMin) / (barMax - barMin) * 100, 0, 100)
      - Overlay the segment [startPct, endPct] at full opacity
      - Scale: metric [-10, 40]°C, imperial [14, 104]°F
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 17.2 Integrate TemperatureBar into WeatherScreen day rows <!-- dep: 17.1 -->
    - In `WeatherScreen.kt`, add `TemperatureBar` to each forecast day row
    - Pass `TempBarConfig` with the day's low/high and the user's unit system
    - If temperature data is null for a day: skip bar rendering, show "—" for temp text
    - _Requirements: 13.1_

  - [ ]* 17.3 Write property test for temperature bar position calculation (Property 13) <!-- dep: 17.1 -->
    - **Property 13: Temperature bar position calculation** — For any low, high, and unit system: correct scale used, startPct/endPct clamped to [0, 100], startPct ≤ endPct
    - Use `@RepeatedTest(100)` with random temperature values including out-of-range
    - **Validates: Requirements 13.1, 13.4, 13.5, 13.6**

- [x] 18. Final Checkpoint — All Features Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Final Integration and Wiring
  - [x] 19.1 Update Web Function Index <!-- dep: all previous -->
    - Update the Web Function Index entries for W176-179, W183, W186, W779, W767, W768, W773, W165-167, W253-255, W791, W921 to ✅ with Android function references
    - _Requirements: all_

  - [x] 19.2 Update version number <!-- dep: 19.1 -->
    - Bump `versionName` in `android/app/build.gradle.kts` to current timestamp format `mYYYYMMDD.HHMM`
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `@RepeatedTest(100)` with `kotlin.random.Random` (no new dependencies needed)
- GeocodingUtil (Task 1) is foundational — many subsequent tasks depend on it for geocoding
- The existing `ReorderableLazyColumn` pattern in WeatherScreen can be reused for Task 14 (drag-to-reorder)
- No new external dependencies are introduced — uses existing osmdroid, Coil/AsyncImage, OkHttp, Gson
- Room database version does NOT need to be incremented — no new entities or table changes
- Deployment: Mobile: clean build → update (no schema changes, no server changes needed)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "5.1", "7.1", "9.1", "12.1", "13.1", "14.1", "17.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "7.2", "9.2", "12.2", "13.2", "13.3", "14.2", "14.3", "17.2", "17.3"] },
    { "id": 2, "tasks": ["1.4", "3.1", "3.2", "6.1", "6.2", "9.3", "10.1", "15.1"] },
    { "id": 3, "tasks": ["6.3", "10.2", "15.2"] },
    { "id": 4, "tasks": ["19.1"] },
    { "id": 5, "tasks": ["19.2"] }
  ]
}
```
