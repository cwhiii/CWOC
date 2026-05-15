# Weather

- [Weather Data on Chits](#weather-data-on-chits)
- [Calendar View Weather Display](#calendar-view-weather-display)
- [Weather Page](#weather-page)
- [City Rows from Chits](#city-rows-from-chits)
- [Weather Update Schedule](#weather-update-schedule)


Press `W` on the dashboard to open the full Weather page. Press `Shift+W` for a quick weather modal showing the current forecast for your default saved location, including weather icon, high/low temperatures, and precipitation. Temperatures display in °F or °C based on your unit system setting ([Settings → Unit System](/frontend/html/settings.html#unit-system)). If no default location is configured, the modal will prompt you to set one in [Settings](/frontend/html/settings.html). The modal includes a **📊 Full Forecast** button that opens the dedicated Weather page.

In the [chit editor](/editor), weather loads automatically when a chit has both a location and a date. Stored forecast data displays immediately on load, then a live fetch updates it in the background. Placeholder messages appear when either location or date is missing.

## Weather Data on Chits

Each chit with a location and date stores its own weather forecast. The stored data includes:

- **High / Low** — Forecast high and low temperatures (stored in Celsius, displayed in °F or °C based on your unit system setting)
- **Precipitation** — Expected precipitation sum in mm
- **Weather Code** — Determines the weather icon (☀️ sunny, 🌧️ rainy, 🌨️ snowy, etc.)
- **Focus Date** — The date the forecast applies to (earliest of start or due date)
- **Updated Time** — When the forecast was last refreshed

Weather data is updated automatically by the server — no browser needs to be open. When you save a chit in the editor, any fetched weather data is saved with it.

## Calendar View Weather Display

On the calendar, chits with stored weather data show a compact weather summary on their event card:

- **Weather icon** — Derived from the weather code (e.g., ☀️, 🌤️, 🌧️, 🌨️)
- **High / Low temps** — Displayed in °F or °C based on your unit system setting
- **Precipitation** — Shown on Day, Week, Work Hours, and X Days views
- **⏳ Stale indicator** — Appears when the forecast data is more than 24 hours old

If a chit has a location but no stored weather data yet, it falls back to fetching weather in the background. The 🌤️ Weather button in the sidebar opens the full Weather page (click) or the quick weather modal (Shift+click).

## Weather Page

The Weather page shows a comprehensive forecast table for all your saved locations. Access it via:

- `W` from the dashboard
- The **📊 Full Forecast** button in the weather modal
- Click the **🌤️ Weather** button in the sidebar

The page displays one row per saved location, with up to 16 days of forecast data. Each day block shows the weather icon, high/low temperatures, and precipitation. Temperatures respect your unit system setting (°F or °C). Drag rows by the ☰ handle to reorder locations — your arrangement is saved automatically. Days where you have a chit at that location are highlighted with a darker background. Click any day block to jump to that day in the Calendar Day view — any chits at that location will flash briefly to draw your eye. If no saved locations are configured, a message directs you to add them in Settings. Press `ESC` to navigate back.

## City Rows from Chits

Below the saved-location rows, the Weather page automatically adds rows for cities where you have upcoming chits but no saved location. These rows are labeled with the city name (extracted from the chit's address) and only show weather blocks on days that have chits in that city — other days are left empty. Click a day block to jump to that day in the Calendar, same as saved-location rows.

## Weather Update Schedule

The server automatically refreshes weather forecasts on two schedules:

- **Hourly** — Chits with dates in the next 7 days are updated every 60 minutes for higher accuracy
- **Daily** — Chits with dates 8–16 days out are updated once every 24 hours for a general outlook

Updates run in the background on the server. Each unique location is geocoded once and reused for all chits at that address. You can also trigger a manual update via the API.

---

**See also:** [Saved Locations](/frontend/html/help.html#saved-locations) · [Calendar](/frontend/html/help.html#calendar) · [Chit Editor](/editor) · [Settings](/frontend/html/settings.html)
