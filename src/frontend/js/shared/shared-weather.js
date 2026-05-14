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
      + '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,wind_speed_10m_max'
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


// ═══════════════════════════════════════════════════════════════════════════
// Shared Weather Data — single function for today's weather at a location
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get today's weather for an address. Uses cache first, fetches fresh in background.
 * Returns a structured object with all computed display values.
 *
 * @param {string} address - Location address string
 * @param {object} [options] - Optional: { targetDate: 'YYYY-MM-DD' } for a specific date
 * @returns {Promise<object|null>} Weather data object or null on failure:
 *   { minC, maxC, minT, maxT, tUnit, icon, weatherCode, precipMm, precipText,
 *     wind: { value, unit }, windText, fullDesc, tempBarHtml,
 *     lowAlt, highAlt, precipAlt, windAlt }
 */
async function getWeatherForLocation(address, options) {
  if (!address) return null;

  var targetDate = (options && options.targetDate) ? options.targetDate : null;

  // Try cache first (only for today — not historical dates)
  if (!targetDate) {
    var cached = getWeatherFromCache(address);
    if (cached && cached.daily) {
      var result = _buildWeatherResult(cached.daily);
      if (result) {
        // Refresh in background (non-blocking)
        fetchAndCacheWeather(address);
        return result;
      }
    }
  }

  // Fetch fresh
  try {
    var geo = await _geocodeAddress(address);
    var baseUrl = 'https://api.open-meteo.com/v1/forecast';
    var dateParam = '&forecast_days=1';

    if (targetDate) {
      // Historical dates use archive API
      var today = new Date();
      var target = new Date(targetDate + 'T12:00:00');
      var diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));
      if (diffDays > 5) {
        baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
      }
      dateParam = '&start_date=' + targetDate + '&end_date=' + targetDate;
    }

    var url = baseUrl + '?latitude=' + geo.lat + '&longitude=' + geo.lon +
      '&daily=weathercode,weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max' +
      '&timezone=auto' + dateParam;

    var resp = await fetch(url);
    if (!resp.ok) return null;
    var data = await resp.json();
    if (!data || !data.daily) return null;

    // Normalize: archive API uses 'weather_code', forecast uses 'weathercode'
    if (data.daily.weather_code && !data.daily.weathercode) {
      data.daily.weathercode = data.daily.weather_code;
    }

    // Also update the shared cache (for today only)
    if (!targetDate) {
      var key = address.toLowerCase().trim();
      window._weatherForecastCache[key] = { daily: data.daily, lat: geo.lat, lon: geo.lon, ts: Date.now() };
      _saveWeatherCacheToLS();
    }

    return _buildWeatherResult(data.daily);
  } catch (e) {
    console.warn('[SharedWeather] Failed for "' + address + '":', e);
    return null;
  }
}

/**
 * Build a weather result object from daily forecast data.
 * Always uses index [0] (today or the single requested day).
 * @param {object} daily - Open-Meteo daily data
 * @returns {object|null}
 */
function _buildWeatherResult(daily) {
  if (!daily) return null;

  // Use index 0 for single-day fetches.
  // For multi-day cache, find today's local date.
  var dayIndex = 0;
  if (daily.time && Array.isArray(daily.time) && daily.time.length > 1) {
    var now = new Date();
    var localToday = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    var idx = daily.time.indexOf(localToday);
    if (idx >= 0) dayIndex = idx;
  }

  var weatherCode = (daily.weathercode && daily.weathercode[dayIndex] !== undefined)
    ? daily.weathercode[dayIndex] : null;
  var maxC = (daily.temperature_2m_max && daily.temperature_2m_max[dayIndex] !== undefined)
    ? daily.temperature_2m_max[dayIndex] : null;
  var minC = (daily.temperature_2m_min && daily.temperature_2m_min[dayIndex] !== undefined)
    ? daily.temperature_2m_min[dayIndex] : null;
  var precipMm = (daily.precipitation_sum && daily.precipitation_sum[dayIndex] !== undefined)
    ? daily.precipitation_sum[dayIndex] : 0;
  var windKmh = 0;
  if (daily.wind_gusts_10m_max && daily.wind_gusts_10m_max[dayIndex] !== undefined) {
    windKmh = daily.wind_gusts_10m_max[dayIndex];
  } else if (daily.wind_speed_10m_max && daily.wind_speed_10m_max[dayIndex] !== undefined) {
    windKmh = daily.wind_speed_10m_max[dayIndex];
  }

  if (weatherCode === null && maxC === null && minC === null) return null;

  var minT = (minC !== null && typeof _convertTemp === 'function') ? _convertTemp(minC) : null;
  var maxT = (maxC !== null && typeof _convertTemp === 'function') ? _convertTemp(maxC) : null;
  var tUnit = (typeof _tempUnit === 'function') ? _tempUnit() : '°F';
  var icon = (typeof _getWeatherIcon === 'function') ? _getWeatherIcon(weatherCode) : '❓';
  var wind = (typeof _convertWind === 'function') ? _convertWind(windKmh) : { value: Math.round(windKmh), unit: 'km/h' };
  var precipText = (typeof _formatPrecip === 'function') ? _formatPrecip(precipMm, weatherCode) : '';
  var windText = wind.value >= ((_isMetricUnits && _isMetricUnits()) ? 24 : 15) ? '💨 ' + wind.value + ' ' + wind.unit + ' wind' : '';
  var fullDesc = (typeof _getWeatherDescription === 'function') ? _getWeatherDescription(weatherCode, minC, maxC, windKmh) : '';

  // Temp bar HTML
  var tempBarHtml = '';
  if (minT !== null && maxT !== null && typeof _buildTempBarHTML === 'function' && typeof _tempBarRange === 'function') {
    var barR = _tempBarRange();
    var barMin = barR.barMin, barMax = barR.barMax, barRange = barMax - barMin;
    var lowPct = Math.max(0, Math.min(100, ((minT - barMin) / barRange) * 100));
    var highPct = Math.max(0, Math.min(100, ((maxT - barMin) / barRange) * 100));
    tempBarHtml = _buildTempBarHTML(lowPct, highPct, minT, maxT, tUnit);
  }

  // Alt units
  var lowAlt = (typeof _tempAltUnit === 'function' && minC !== null) ? _tempAltUnit(minC) : '';
  var highAlt = (typeof _tempAltUnit === 'function' && maxC !== null) ? _tempAltUnit(maxC) : '';
  var precipAlt = (typeof _precipAlt === 'function' && precipMm > 0) ? _precipAlt(precipMm) : '';
  var windAlt = (typeof _windDisplayAlt === 'function' && wind.value > 0) ? _windDisplayAlt(wind.value) : '';

  return {
    minC: minC, maxC: maxC,
    minT: minT, maxT: maxT, tUnit: tUnit,
    icon: icon, weatherCode: weatherCode,
    precipMm: precipMm, precipText: precipText,
    wind: wind, windText: windText,
    fullDesc: fullDesc, tempBarHtml: tempBarHtml,
    lowAlt: lowAlt, highAlt: highAlt, precipAlt: precipAlt, windAlt: windAlt
  };
}
