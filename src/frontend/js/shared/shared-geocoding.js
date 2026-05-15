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
 * @param {string|null} [country_code] - ISO 3166-1 alpha-2 country code
 */
function setGeocodeCache(address, lat, lon, country_code) {
  if (!address) return;
  var key = address.toLowerCase().trim();
  _geocodeCache[key] = { lat: lat, lon: lon, country_code: country_code || null };
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

// ── Timezone Detection from Coordinates ──────────────────────────────────────

/**
 * Country-to-timezone lookup table.
 * Single-timezone countries map to a single string.
 * Multi-timezone countries map to an array of { tz, minLon, maxLon } bands
 * sorted west-to-east. The longitude of the geocode result picks the best match.
 */
var _COUNTRY_TIMEZONE_MAP = {
  // ── Single-timezone countries (major ones) ──
  'GB': 'Europe/London',
  'IE': 'Europe/Dublin',
  'IS': 'Atlantic/Reykjavik',
  'PT': 'Europe/Lisbon',
  'ES': 'Europe/Madrid',
  'FR': 'Europe/Paris',
  'BE': 'Europe/Brussels',
  'NL': 'Europe/Amsterdam',
  'LU': 'Europe/Luxembourg',
  'DE': 'Europe/Berlin',
  'AT': 'Europe/Vienna',
  'CH': 'Europe/Zurich',
  'IT': 'Europe/Rome',
  'MT': 'Europe/Malta',
  'CZ': 'Europe/Prague',
  'SK': 'Europe/Bratislava',
  'PL': 'Europe/Warsaw',
  'HU': 'Europe/Budapest',
  'HR': 'Europe/Zagreb',
  'SI': 'Europe/Ljubljana',
  'RS': 'Europe/Belgrade',
  'BA': 'Europe/Sarajevo',
  'ME': 'Europe/Podgorica',
  'AL': 'Europe/Tirane',
  'MK': 'Europe/Skopje',
  'BG': 'Europe/Sofia',
  'RO': 'Europe/Bucharest',
  'MD': 'Europe/Chisinau',
  'GR': 'Europe/Athens',
  'TR': 'Europe/Istanbul',
  'CY': 'Asia/Nicosia',
  'FI': 'Europe/Helsinki',
  'EE': 'Europe/Tallinn',
  'LV': 'Europe/Riga',
  'LT': 'Europe/Vilnius',
  'SE': 'Europe/Stockholm',
  'NO': 'Europe/Oslo',
  'DK': 'Europe/Copenhagen',
  'JP': 'Asia/Tokyo',
  'KR': 'Asia/Seoul',
  'KP': 'Asia/Pyongyang',
  'TW': 'Asia/Taipei',
  'PH': 'Asia/Manila',
  'SG': 'Asia/Singapore',
  'MY': 'Asia/Kuala_Lumpur',
  'TH': 'Asia/Bangkok',
  'VN': 'Asia/Ho_Chi_Minh',
  'KH': 'Asia/Phnom_Penh',
  'LA': 'Asia/Vientiane',
  'MM': 'Asia/Yangon',
  'BD': 'Asia/Dhaka',
  'NP': 'Asia/Kathmandu',
  'LK': 'Asia/Colombo',
  'PK': 'Asia/Karachi',
  'AF': 'Asia/Kabul',
  'IR': 'Asia/Tehran',
  'IQ': 'Asia/Baghdad',
  'SA': 'Asia/Riyadh',
  'AE': 'Asia/Dubai',
  'OM': 'Asia/Muscat',
  'QA': 'Asia/Qatar',
  'BH': 'Asia/Bahrain',
  'KW': 'Asia/Kuwait',
  'JO': 'Asia/Amman',
  'LB': 'Asia/Beirut',
  'SY': 'Asia/Damascus',
  'IL': 'Asia/Jerusalem',
  'PS': 'Asia/Gaza',
  'EG': 'Africa/Cairo',
  'LY': 'Africa/Tripoli',
  'TN': 'Africa/Tunis',
  'DZ': 'Africa/Algiers',
  'MA': 'Africa/Casablanca',
  'NG': 'Africa/Lagos',
  'GH': 'Africa/Accra',
  'KE': 'Africa/Nairobi',
  'TZ': 'Africa/Dar_es_Salaam',
  'UG': 'Africa/Kampala',
  'ET': 'Africa/Addis_Ababa',
  'ZA': 'Africa/Johannesburg',
  'ZW': 'Africa/Harare',
  'MZ': 'Africa/Maputo',
  'ZM': 'Africa/Lusaka',
  'BW': 'Africa/Gaborone',
  'NA': 'Africa/Windhoek',
  'SN': 'Africa/Dakar',
  'CI': 'Africa/Abidjan',
  'CM': 'Africa/Douala',
  'AO': 'Africa/Luanda',
  'NZ': 'Pacific/Auckland',
  'FJ': 'Pacific/Fiji',
  'PG': 'Pacific/Port_Moresby',
  'CO': 'America/Bogota',
  'VE': 'America/Caracas',
  'PE': 'America/Lima',
  'EC': 'America/Guayaquil',
  'BO': 'America/La_Paz',
  'PY': 'America/Asuncion',
  'UY': 'America/Montevideo',
  'CR': 'America/Costa_Rica',
  'PA': 'America/Panama',
  'GT': 'America/Guatemala',
  'HN': 'America/Tegucigalpa',
  'SV': 'America/El_Salvador',
  'NI': 'America/Managua',
  'CU': 'America/Havana',
  'JM': 'America/Jamaica',
  'HT': 'America/Port-au-Prince',
  'DO': 'America/Santo_Domingo',
  'PR': 'America/Puerto_Rico',
  'TT': 'America/Port_of_Spain',
  'UA': 'Europe/Kyiv',
  'BY': 'Europe/Minsk',
  'GE': 'Asia/Tbilisi',
  'AM': 'Asia/Yerevan',
  'AZ': 'Asia/Baku',
  'UZ': 'Asia/Tashkent',
  'KG': 'Asia/Bishkek',
  'TJ': 'Asia/Dushanbe',
  'TM': 'Asia/Ashgabat',

  // ── Multi-timezone countries (longitude bands) ──
  'US': [
    { tz: 'America/Adak',        minLon: -180, maxLon: -169 },
    { tz: 'America/Anchorage',   minLon: -169, maxLon: -141 },
    { tz: 'America/Los_Angeles', minLon: -141, maxLon: -115 },
    { tz: 'America/Denver',      minLon: -115, maxLon: -102 },
    { tz: 'America/Chicago',     minLon: -102, maxLon: -87 },
    { tz: 'America/New_York',    minLon: -87,  maxLon: -60 }
  ],
  'CA': [
    { tz: 'America/Vancouver',   minLon: -141, maxLon: -120 },
    { tz: 'America/Edmonton',    minLon: -120, maxLon: -102 },
    { tz: 'America/Winnipeg',    minLon: -102, maxLon: -89 },
    { tz: 'America/Toronto',     minLon: -89,  maxLon: -67 },
    { tz: 'America/Halifax',     minLon: -67,  maxLon: -59 },
    { tz: 'America/St_Johns',    minLon: -59,  maxLon: -50 }
  ],
  'RU': [
    { tz: 'Europe/Kaliningrad',    minLon: 19,   maxLon: 32 },
    { tz: 'Europe/Moscow',         minLon: 32,   maxLon: 45 },
    { tz: 'Europe/Samara',         minLon: 45,   maxLon: 56 },
    { tz: 'Asia/Yekaterinburg',    minLon: 56,   maxLon: 68 },
    { tz: 'Asia/Omsk',             minLon: 68,   maxLon: 80 },
    { tz: 'Asia/Krasnoyarsk',      minLon: 80,   maxLon: 93 },
    { tz: 'Asia/Irkutsk',          minLon: 93,   maxLon: 108 },
    { tz: 'Asia/Yakutsk',          minLon: 108,  maxLon: 125 },
    { tz: 'Asia/Vladivostok',      minLon: 125,  maxLon: 138 },
    { tz: 'Asia/Magadan',          minLon: 138,  maxLon: 155 },
    { tz: 'Asia/Kamchatka',        minLon: 155,  maxLon: 180 }
  ],
  'AU': [
    { tz: 'Australia/Perth',     minLon: 112, maxLon: 129 },
    { tz: 'Australia/Adelaide',  minLon: 129, maxLon: 141 },
    { tz: 'Australia/Sydney',    minLon: 141, maxLon: 155 }
  ],
  'BR': [
    { tz: 'America/Manaus',      minLon: -74, maxLon: -56 },
    { tz: 'America/Sao_Paulo',   minLon: -56, maxLon: -35 },
    { tz: 'America/Noronha',     minLon: -35, maxLon: -29 }
  ],
  'MX': [
    { tz: 'America/Tijuana',       minLon: -118, maxLon: -111 },
    { tz: 'America/Chihuahua',     minLon: -111, maxLon: -104 },
    { tz: 'America/Mexico_City',   minLon: -104, maxLon: -86 },
    { tz: 'America/Cancun',        minLon: -86,  maxLon: -82 }
  ],
  'CN': 'Asia/Shanghai',
  'IN': 'Asia/Kolkata',
  'AR': 'America/Argentina/Buenos_Aires',
  'CL': [
    { tz: 'America/Santiago',    minLon: -76, maxLon: -66 },
    { tz: 'Pacific/Easter',      minLon: -110, maxLon: -108 }
  ],
  'ID': [
    { tz: 'Asia/Jakarta',        minLon: 95,  maxLon: 115 },
    { tz: 'Asia/Makassar',       minLon: 115, maxLon: 130 },
    { tz: 'Asia/Jayapura',       minLon: 130, maxLon: 142 }
  ],
  'KZ': [
    { tz: 'Asia/Aqtau',          minLon: 50,  maxLon: 60 },
    { tz: 'Asia/Almaty',         minLon: 60,  maxLon: 88 }
  ],
  'MN': [
    { tz: 'Asia/Hovd',           minLon: 87,  maxLon: 100 },
    { tz: 'Asia/Ulaanbaatar',    minLon: 100, maxLon: 120 }
  ],
  'CD': [
    { tz: 'Africa/Kinshasa',     minLon: 12,  maxLon: 24 },
    { tz: 'Africa/Lubumbashi',   minLon: 24,  maxLon: 32 }
  ]
};

/**
 * Detect timezone from coordinates using a lightweight heuristic.
 * Uses country code to look up timezone(s), then longitude to pick the
 * best match for multi-timezone countries.
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} country - ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
 * @returns {string|null} IANA timezone identifier or null if detection fails
 */
function _detectTimezoneFromCoords(lat, lon, country) {
  if (lat == null || lon == null || !country) return null;

  var code = country.toUpperCase().trim();
  var entry = _COUNTRY_TIMEZONE_MAP[code];

  if (!entry) return null;

  // Single-timezone country — return directly
  if (typeof entry === 'string') return entry;

  // Multi-timezone country — find the band that contains this longitude
  if (Array.isArray(entry)) {
    for (var i = 0; i < entry.length; i++) {
      var band = entry[i];
      if (lon >= band.minLon && lon < band.maxLon) {
        return band.tz;
      }
    }
    // If longitude didn't match any band (edge case), return the closest band
    var closest = null;
    var closestDist = Infinity;
    for (var j = 0; j < entry.length; j++) {
      var midLon = (entry[j].minLon + entry[j].maxLon) / 2;
      var dist = Math.abs(lon - midLon);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entry[j].tz;
      }
    }
    return closest || null;
  }

  return null;
}

// ── Shared Geocoding ─────────────────────────────────────────────────────────

/**
 * Geocode an address using Nominatim with progressive fallback.
 * Checks the shared localStorage cache first. On cache miss, tries:
 * full address → no zip → city/state/zip → city/state.
 * Caches successful results for reuse across all pages.
 * Returns {lat, lon, country_code} or throws Error("Location not found.") / Error("No address provided.").
 */
async function _geocodeAddress(address) {
  if (!address) throw new Error("No address provided.");

  // Check shared cache first
  var cached = getGeocodeCached(address);
  if (cached) return { lat: cached.lat, lon: cached.lon, country_code: cached.country_code || null };

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
        var r = data.results[0];
        var result = { lat: r.lat, lon: r.lon, country_code: r.country_code || null };
        // Cache the result under the original address key (including country_code)
        setGeocodeCache(address, result.lat, result.lon, result.country_code);
        return result;
      }
    } catch (e) {
      console.warn('Geocoding attempt', i + 1, 'failed:', e);
    }
  }
  throw new Error("Location not found.");
}

