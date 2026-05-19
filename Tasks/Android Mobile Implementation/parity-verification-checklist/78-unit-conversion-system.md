# Unit Conversion System

**Category:** Cross-Cutting Behaviors
**Item #:** 78
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files
- `src/frontend/js/shared/shared-utils.js`
- `src/frontend/js/editor/editor-location.js`
- `src/frontend/js/editor/editor-alerts.js`
- `src/frontend/js/editor/editor-health.js`
- `src/frontend/js/editor/editor-custom-zones.js`
- `src/frontend/js/pages/weather.js`
- `src/frontend/js/pages/settings.js`

## Functions, Buttons, Controls & Inputs

### Unit System Setting

- [ ] `unit_system` setting — Stored in user settings; values: `'imperial'` (default) or `'metric'`
- [ ] Unit system pill toggle in Settings (`#unit-pill`, `#unit-system-toggle`) — Switches between Imperial and Metric
- [ ] Setting persisted via `POST /api/settings/{user_id}` with `unit_system` field

### Core Detection Function

- [ ] `_isMetricUnits()` — Returns `true` if `window._cwocSettings.unit_system === 'metric'`

### Temperature Conversion

- [ ] `_convertTemp(c)` — Converts Celsius to display unit; metric: returns °C as-is (rounded); imperial: converts to °F (`c * 9/5 + 32`, rounded)
- [ ] `_tempUnit()` — Returns unit label: `'°C'` for metric, `'°F'` for imperial
- [ ] `_tempAltUnit(tempC)` — Converts Celsius to the OPPOSITE unit for tooltip display (e.g., if showing °F, tooltip shows °C)
- [ ] `_tempDisplayAlt(displayTemp)` — Converts a temperature already in display units to the opposite for tooltip
- [ ] `_getTempColor(tempC)` — Returns gradient color for a given Celsius temperature (for visual bars)
- [ ] `_getTempBorderColor(tempC)` — Same as `_getTempColor` (alias for border styling)
- [ ] `_getTempFeeling(minC, maxC)` — Returns feeling word: frigid/freezing/cold/cool/mild/warm/hot/scorching
- [ ] `_tempBarRange()` — Returns min/max for temperature bar: metric `{-10, 40}`, imperial `{-14, 104}`
- [ ] `_buildTempGradient()` — Builds CSS linear-gradient string for temperature bar using gradient stops

### Temperature Gradient Stops

- [ ] `_cwocTempGradientStops` array — Canonical gradient stops:
  - [ ] -10°C → `#001040` (deep blue)
  - [ ] 0°C → `#2166ac` (blue)
  - [ ] 15°C → `#e0ddd4` (neutral)
  - [ ] 22°C → `#f0c830` (gold)
  - [ ] 30°C → `#d73027` (red)
  - [ ] 40°C → `#3a0000` (dark red)

### Wind Speed Conversion

- [ ] `_convertWind(kmh)` — Converts km/h to display unit; metric: returns `{ value: km/h, unit: 'km/h' }`; imperial: returns `{ value: mph, unit: 'mph' }` (factor: 0.621371)
- [ ] `_windDisplayAlt(displayValue)` — Converts wind in display units to opposite for tooltip

### Precipitation Conversion

- [ ] `_cwocFormatPrecip(precipMm, weatherCode, emptyVal)` — Formats precipitation amount with type for display; converts mm to cm; returns e.g., "3cm rain"
- [ ] `_cwocGetPrecipType(code)` — Maps WMO weather code to precipitation type string: rain, snow, thunder, drizzle, or empty
- [ ] `_precipAlt(precipMm)` — Converts precipitation (mm) to opposite unit for tooltip: metric shows inches, imperial shows cm
- [ ] `_editorFormatPrecipAmount(precipMm)` — Formats precipitation amount only (no type word) for merged display in editor

### Precipitation Unit Display

- [ ] Metric: displays in mm or cm
- [ ] Imperial: displays in inches (mm / 25.4)
- [ ] Weather alerts use mm as canonical storage unit; display converts based on unit_system

### Weather Description

- [ ] `_getWeatherDescription(weatherCode, minC, maxC, windGustsKmh)` — Full weather description with temperature feeling; detects blizzard conditions (snow + gusts ≥ 56 km/h)
- [ ] `_weatherDescriptions` object — Maps WMO codes to human-readable descriptions (Clear, Partly cloudy, Overcast, Fog, Drizzle, Rain, Snow, Thunderstorm, etc.)

### Weather Alert Conditions (Unit-Aware)

- [ ] Temperature alerts — Compare in Celsius internally; display threshold in user's unit
- [ ] Precipitation alerts — Compare in mm internally; display in user's unit (mm or inches)
- [ ] Wind alerts — Compare in km/h internally; display in user's unit (km/h or mph)
- [ ] Precipitation mode: "any" (any precip code) vs "more_than" (threshold comparison)

### Health Indicators (Unit-Aware)

- [ ] `window._healthUnitSystem` — Set from `settings.unit_system` in editor-health.js
- [ ] Custom zone rendering — Passes `unitSystem` to `_renderCustomZonePanel()` for unit-aware display
- [ ] Weight indicators — Display in lbs (imperial) or kg (metric)
- [ ] Distance indicators — Display in miles (imperial) or km (metric)

### Weather Page Display

- [ ] Temperature display — High/low in user's unit with alt tooltip
- [ ] Precipitation display — Formatted via `_cwocFormatPrecip()` with type
- [ ] Wind display — Converted via `_convertWind()`
- [ ] Temperature bars — Gradient colored using `_buildTempGradient()` with unit-appropriate range

### Editor Weather Display

- [ ] Compact weather section — Shows high/low temps, precipitation, wind in user's units
- [ ] Alt tooltips — Hover shows opposite unit (e.g., "72°F" tooltip shows "22°C")
- [ ] Precipitation alt tooltip — Shows opposite unit conversion

### Dashboard Card Weather Indicators

- [ ] Card weather tooltip — Shows high°/low° in user's unit + precipitation text
- [ ] `_convertTemp()` used for card weather display
- [ ] `_cwocFormatPrecip()` used for card precipitation text

### Stale Weather Detection

- [ ] `_isWeatherStale(updatedTime)` — Returns true if weather data is older than threshold (shows ⏳ icon)

### Settings UI

- [ ] Unit system toggle in Settings → General tab
- [ ] Pill toggle: "Imperial" vs "Metric"
- [ ] Hidden input `#unit-system-toggle` stores current value
- [ ] Change triggers settings save → all weather/indicator displays update on next render
