# Release 20260503.1144 — Proximity Clustering, Hexagon Fix, Weather Layout

- **Maps clustering**: Chits and contacts now cluster together by proximity instead of separately by type. Both marker types use the same MarkerClusterGroup, so nearby chits and contacts merge into mixed clusters naturally. Removed the separate people cluster group.
- **Mixed cluster hexagon**: Fixed — the hexagon shape is now applied via CSS `clip-path` on the cluster icon class itself (purple gradient, `!important` to override Leaflet defaults). Previously the clip-path was on the inner div which didn't render correctly.
- **Maps loading spinner**: Moved to the RIGHT of "Loading…" text (was incorrectly above it).
- **Weather page layout**: Fixed sidebar covering content — only `#weather-content` shifts right when sidebar is active, not the entire `.settings-panel`. Header stays full-width.
- **Header border**: Changed from margin-left approach to pseudo-element approach — header stays full-width, only the bottom border line starts at 240px from left when sidebar is active.
