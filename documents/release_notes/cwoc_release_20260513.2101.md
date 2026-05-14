# Release 20260513.2101

Added localStorage cache-first rendering for the dashboard. On page load, chits now render instantly from a cached copy while a background fetch retrieves fresh data. This eliminates the loading spinner on repeat visits.
