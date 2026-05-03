# Release 20260503.1210 — Weather Page Layout Alignment

Weather page now uses the same layout structure as the maps page: `.settings-panel > .weather-page-layout > #weather-content`. The sidebar/header/content relationship follows the identical pattern — header stays full-width, content area shifts right when sidebar is active, border pseudo-element clips at the sidebar edge. Previously the weather page had a flat structure that caused the sidebar to cover content.
