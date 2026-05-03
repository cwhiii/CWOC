# Release 20260503.1224 — Weather Page Full Layout Parity with Maps

Added the missing CSS rules in shared-page.css for the Weather page that the Maps page already had. The weather page was using the default secondary page styling (padded, max-width constrained, decorative border) instead of the full-viewport layout. Now both pages have identical rules:

- Body: full viewport (padding:0, margin:0, overflow:hidden, height:100vh, flex column)
- .settings-panel: full-width, no decoration (no border, no border-radius, no box-shadow, no background, no max-width)
- .settings-panel::before: hidden (removes the decorative top element)
- .author-info: hidden (sidebar has its own footer)
- .header-and-buttons: 100px height, full-width, gradient background, 2px bottom border, relative positioning
- .weather-page-layout: flex:1, overflow:auto (scrollable content area below the header)

This fixes the logo being cut off, the sidebar covering content, and the Help button overflowing.
