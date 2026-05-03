/**
 * shared-geocoding.js — Shared geocoding with progressive fallback and
 * localStorage-backed cache.
 *
 * Provides _geocodeAddress() which checks a shared cache first, then tries
 * multiple query variations (full address, no zip, city/state, etc.) against
 * the backend geocode proxy to find coordinates for a given address string.
 *
 * The cache is shared across all pages (maps, weather, editor, etc.) via
 * localStorage so geocode results are reused everywhere.
 *
 * No dependencies on other shared sub-scripts.
 */

// ── Shared Geocode Cache (localStorage-backed) ──────────────────────────────

var _GEOCODE_LS_KEY = 'cwoc_geocode_cache';
var _geocodeCache = {};

/** Load geocode cache from localStorage on startup. */
function _loadGeocodeCache() {
  try {
    var raw = localStorage.getItem(_GEOCODE_LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _geocodeCache = parsed;
        return;
      }
    }
  } catch (e) { /* ignore corrupt cache */ }
  _geocodeCache = {};
}

/** Save geocode cache to localStorage. */
function _saveGeocodeCache() {
  try {
    localStorage.setItem(_GEOCODE_LS_KEY, JSON.stringify(_geocodeCache));
  } catch (e) { /* ignore — quota exceeded or private browsing */ }
}

/**
 * Get cached geocode result for an address, or null if not cached.
 * @param {string} address
 * @returns {{ lat: number, lon: number } | null}
 */
function getGeocodeCached(address) {
  if (!address) return null;
  var key = address.toLowerCase().trim();
  return _geocodeCache[key] || null;
}

/**
 * Store a geocode result in the shared cache.
 * @param {string} address
 * @param {number} lat
 * @param {number} lon
 */
function setGeocodeCache(address, lat, lon) {
  if (!address) return;
  var key = address.toLowerCase().trim();
  _geocodeCache[key] = { lat: lat, lon: lon };
  _saveGeocodeCache();
}

// Load cache immediately on script load
_loadGeocodeCache();

// Migrate old maps-only cache into the shared cache (one-time)
(function _migrateOldMapsCache() {
  try {
    var oldKey = 'cwoc_maps_geocode_cache';
    var raw = localStorage.getItem(oldKey);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    var migrated = 0;
    for (var k in parsed) {
      if (!_geocodeCache[k] && parsed[k] && parsed[k].lat && parsed[k].lon) {
        _geocodeCache[k] = { lat: parsed[k].lat, lon: parsed[k].lon };
        migrated++;
      }
    }
    if (migrated > 0) _saveGeocodeCache();
    // Remove old key so migration only runs once
    localStorage.removeItem(oldKey);
  } catch (e) { /* ignore */ }
})();

// ── Shared Geocoding ─────────────────────────────────────────────────────────

/**
 * Geocode an address using Nominatim with progressive fallback.
 * Checks the shared localStorage cache first. On cache miss, tries:
 * full address → no zip → city/state/zip → city/state.
 * Caches successful results for reuse across all pages.
 * Returns {lat, lon} or throws Error("Location not found.") / Error("No address provided.").
 */
async function _geocodeAddress(address) {
  if (!address) throw new Error("No address provided.");

  // Check shared cache first
  var cached = getGeocodeCached(address);
  if (cached) return { lat: cached.lat, lon: cached.lon };

  var queries = [address];

  // Strip zip code (5-digit or 5+4 at end)
  var noZip = address.replace(/\s*\d{5}(-\d{4})?\s*$/, '').trim();
  if (noZip && noZip !== address) queries.push(noZip);

  // Normalize periods to commas for addresses like "123 Main St. City, ST 12345"
  var normalized = address.replace(/\.\s+/g, ', ');
  if (normalized !== address) queries.push(normalized);

  // Comma-split fallbacks
  var parts = normalized.split(',');
  if (parts.length >= 2) queries.push(parts.slice(1).join(',').trim());
  if (parts.length >= 3) queries.push(parts.slice(-2).join(',').trim());

  // Try to extract "City, ST ZIP" or "City, ST" via state abbreviation pattern
  var stateMatch = address.match(/([A-Za-z\s]+),?\s+([A-Z]{2})\s*(\d{5})?/);
  if (stateMatch) {
    var cityState = stateMatch[1].trim() + ', ' + stateMatch[2];
    if (stateMatch[3]) queries.push(cityState + ' ' + stateMatch[3]);
    queries.push(cityState);
  }

  // Deduplicate queries while preserving order
  var seen = {};
  var unique = [];
  for (var u = 0; u < queries.length; u++) {
    var key = queries[u].toLowerCase().trim();
    if (!key || seen[key]) continue;
    seen[key] = true;
    unique.push(queries[u]);
  }

  for (var i = 0; i < unique.length; i++) {
    var q = unique[i];
    try {
      // Use backend proxy to avoid CORS and rate-limit issues
      var url = '/api/geocode?q=' + encodeURIComponent(q);
      var resp = await fetch(url);
      if (!resp.ok) continue;
      var data = await resp.json();
      if (data && data.results && data.results.length > 0) {
        var result = { lat: data.results[0].lat, lon: data.results[0].lon };
        // Cache the result under the original address key
        setGeocodeCache(address, result.lat, result.lon);
        return result;
      }
    } catch (e) {
      console.warn('Geocoding attempt', i + 1, 'failed:', e);
    }
  }
  throw new Error("Location not found.");
}

