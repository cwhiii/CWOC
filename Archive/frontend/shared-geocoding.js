/**
 * shared-geocoding.js — Shared geocoding with progressive fallback.
 *
 * Provides _geocodeAddress() which tries multiple query variations
 * (full address, no zip, city/state, etc.) against the backend geocode
 * proxy to find coordinates for a given address string.
 *
 * No dependencies on other shared sub-scripts.
 */

// ── Shared Geocoding ─────────────────────────────────────────────────────────

/**
 * Geocode an address using Nominatim with progressive fallback.
 * Tries: full address → no zip → city/state/zip → city/state.
 * Returns {lat, lon} or throws Error("Location not found.") / Error("No address provided.").
 */
async function _geocodeAddress(address) {
  if (!address) throw new Error("No address provided.");
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
        return { lat: data.results[0].lat, lon: data.results[0].lon };
      }
    } catch (e) {
      console.warn('Geocoding attempt', i + 1, 'failed:', e);
    }
  }
  throw new Error("Location not found.");
}

