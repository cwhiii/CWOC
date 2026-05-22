# W791: _onWeatherModalManualGo()

## What the web function does
In the weather modal's location dropdown, there's a "✏️ Type a location…" option. When selected:
1. A text input + "Go" button row appears below the dropdown
2. The user types any address into the text input
3. Clicking "Go" calls `_fetchWeatherForModal(inp.value.trim(), 'Custom')` — geocodes the typed address and fetches weather for it

This allows viewing weather for ANY location, not just saved locations.

## What exists on Android
- `WeatherModal` has an `ExposedDropdownMenuBox` with saved locations
- Selecting a location triggers `fetchWeather(locations[selectedIndex].second)`
- No "type a custom location" option exists in the dropdown
- The dropdown only shows pre-configured saved locations

## What's missing
1. **No "Type a location…" option** in the WeatherModal dropdown
2. **No text input field** for entering a custom/arbitrary address
3. **No "Go" button** to trigger weather fetch for the typed address
4. Users can ONLY view weather for their saved locations — cannot check weather for an arbitrary address from the modal
