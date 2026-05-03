# Release 20260503.1228 — Weather Scrolling, Map Controls, Mobile

- **Weather scrolling**: Fixed — `.settings-panel` changed from `overflow: hidden` to `overflow: visible` so the `.weather-page-layout` child (with `overflow: auto; flex: 1; min-height: 0`) can properly scroll its content.
- **Map zoom controls**: Moved from top-left (Leaflet default) to bottom-right for better accessibility and to avoid overlapping the sidebar toggle.
- **Map mobile**: Added margin rules for fullscreen and default-view controls. Permanent tooltips hidden on mobile to reduce clutter.
