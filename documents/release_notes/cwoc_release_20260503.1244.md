# Release 20260503.1244 — Maps Geocode Cache

Geocoded coordinates (address → lat/lon) are now persisted to localStorage under `cwoc_maps_geocode_cache`. On the first visit, each address is geocoded via the Nominatim API and cached. On subsequent visits, cached coordinates are used instantly — markers appear immediately without waiting for API calls. Only new or changed addresses need fresh geocoding.

Both chit locations and contact addresses share the same unified cache. The cache is loaded at script parse time and saved after each new geocode result.
