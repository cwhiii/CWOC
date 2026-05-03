# Release 20260503.0938 — Maps Sidebar Styling Fix

Added missing `styles-variables.css` and `styles-layout.css` to the maps page so the shared sidebar gets the same CSS variables and button styles as the dashboard. The sidebar was missing its background color, border, and action button styling because those depend on CSS custom properties (`--sidebar-bg`, `--btn-bg`, etc.) defined in `styles-variables.css`.
