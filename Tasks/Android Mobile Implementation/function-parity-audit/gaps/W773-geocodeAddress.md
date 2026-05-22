# W773: _geocodeAddress(address)

## What the web function does
Geocodes an address with progressive fallback strategy:
1. Checks shared cache first
2. Builds multiple query variants from the address:
   - Original address
   - Address with zip code stripped
   - Address with periods normalized to commas
   - Comma-split fallbacks (last 2 parts, last 1 part)
   - City/State extraction via regex
3. Deduplicates queries
4. Tries each variant sequentially against `/api/geocode` backend proxy (which calls Nominatim)
5. Caches first successful result
6. Returns `{lat, lon, country_code}` or throws "Location not found"

The progressive fallback means addresses like "123 Main St. Springfield, IL 62701" will try:
- "123 Main St. Springfield, IL 62701" (full)
- "123 Main St. Springfield, IL" (no zip)
- "123 Main St, Springfield, IL 62701" (normalized periods)
- "Springfield, IL 62701" (last 2 parts)
- "Springfield, IL" (city/state)

## What exists on Android
- `GeocodingUtil.geocode(address)` — single Nominatim API call with the raw address
- In-memory cache check before API call
- Returns `GeoResult(lat, lon, displayName)` or null

## What's missing
1. **No progressive fallback** — only tries the raw address once; if Nominatim can't resolve it, gives up
2. **No address normalization** — doesn't strip zip codes, normalize periods, or extract city/state
3. **No backend proxy** — calls Nominatim directly (may hit rate limits on mobile)
4. **No country_code** in result (minor — not used for map display)

This means some addresses that successfully geocode on web will fail on Android.
