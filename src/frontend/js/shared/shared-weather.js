/**
 * shared-weather.js — Weather & saved locations utilities.
 *
 * Provides:
 *   - Saved locations loading and default location lookup
 *   - Weather forecast cache (localStorage-backed, 1-hour TTL)
 *   - Fetch and cache weather from Open-Meteo API
 *   - Prefetch weather for all saved locations
 *
 * Loaded BEFORE shared.js.
 */

// ── Saved Locations Utilities ────────────────────────────────────────────────

/**
 * Fetch saved locations from settings and cache them for the page lifetime.
 * Returns the saved_locations array (or empty array on error / no data).
 * Subsequent calls return the cached value without re-fetching.
 * @returns {Promise<object[]>}
 */
async function loadSavedLocations() {
  if (window._savedLocations) return window._savedLocations;
  try {
    const settings = await getCachedSettings();
    window._savedLocations = Array.isArray(settings.saved_locations) ? settings.saved_locations : [];
    return window._savedLocations;
  } catch (e) {
    console.error('Error loading saved locations:', e);
    window._savedLocations = [];
    return [];
  }
}

/**
 * Return the saved location marked as default (is_default === true), or null.
 * Reads from the cached window._savedLocations — call loadSavedLocations() first.
 * @returns {object|null}
 */
function getDefaultLocation() {
  if (!Array.isArray(window._savedLocations)) return null;
  return window._savedLocations.find(function (loc) { return loc.is_default === true; }) || null;
}


// ═══════════════════════════════════════════════════════════════════════════
// Weather Forecast Cache — shared across all pages
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global weather forecast cache.
 * Key: lowercase trimmed address string
 * Value: { daily: {...}, ts: timestamp, lat, lon }
 *
 * Populated by prefetchSavedLocationWeather() on dashboard load.
 * Consumed by calendar cards, weather page, editor, weather modal.
 */
window._weatherForecastCache = window._weatherForecastCache || {};

var _WEATHER_CACHE_LS_KEY = 'cwoc_weather_forecast_cache';
var _WEATHER_CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour

/** Load weather cache from localStorage on init. */
(function _loadWeatherCacheFromLS() {
  try {
    var raw = localStorage.getItem(_WEATHER_CACHE_LS_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var now = Date.now();
    // Only restore entries less than 1 hour old
    for (var key in parsed) {
      if (parsed[key] && parsed[key].ts && (now - parsed[key].ts) < _WEATHER_CACHE_MAX_AGE) {
        window._weatherForecastCache[key] = parsed[key];
      }
    }
  } catch (e) { /* ignore corrupt cache */ }
})();

/** Persist weather cache to localStorage. */
function _saveWeatherCacheToLS() {
  try {
    localStorage.setItem(_WEATHER_CACHE_LS_KEY, JSON.stringify(window._weatherForecastCache));
  } catch (e) { /* quota exceeded or private mode */ }
}

/**
 * Get cached 16-day forecast for an address, or null if not cached / stale.
 * @param {string} address
 * @returns {object|null} { daily: {...}, lat, lon, ts } or null
 */
function getWeatherFromCache(address) {
  if (!address) return null;
  var key = address.toLowerCase().trim();
  var entry = window._weatherForecastCache[key];
  if (!entry || !entry.ts) return null;
  if ((Date.now() - entry.ts) > _WEATHER_CACHE_MAX_AGE) return null;
  return entry;
}

/**
 * Fetch 16-day forecast for a single address and store in cache.
 * @param {string} address
 * @returns {Promise<object|null>} cached entry or null on failure
 */
async function fetchAndCacheWeather(address) {
  if (!address) return null;
  var key = address.toLowerCase().trim();
  try {
    var geo = await _geocodeAddress(address);
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + geo.lat
      + '&longitude=' + geo.lon
      + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum'
      + '&timezone=auto&forecast_days=16';
    var resp = await fetch(url);
    if (!resp.ok) return null;
    var data = await resp.json();
    if (!data.daily || !data.daily.time) return null;
    var entry = { daily: data.daily, lat: geo.lat, lon: geo.lon, ts: Date.now() };
    window._weatherForecastCache[key] = entry;
    _saveWeatherCacheToLS();
    return entry;
  } catch (e) {
    console.warn('Weather fetch failed for "' + address + '":', e);
    return null;
  }
}

/**
 * Prefetch weather for all saved locations. Call once on dashboard init.
 * Runs async — does not block page load.
 */
async function prefetchSavedLocationWeather() {
  try {
    var locations = await loadSavedLocations();
    if (!locations || locations.length === 0) return;
    var promises = locations.map(function (loc) {
      var addr = loc.address || loc.label || '';
      if (!addr) return Promise.resolve(null);
      // Skip if already cached and fresh
      if (getWeatherFromCache(addr)) return Promise.resolve(null);
      return fetchAndCacheWeather(addr);
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('Error prefetching weather:', e);
  }
}
