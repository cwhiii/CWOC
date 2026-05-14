# Indicators View

The Indicators view displays health and activity data tracked via the [Custom Objects](/frontend/html/custom-objects-editor.html) system. Access it from the dashboard tab bar. Three display modes are available via a pill toggle at the top:

- **Calendar** — Year-view grid (12 rows × 31 columns). Each cell represents a day: green = all readings in range, amber = at least one out of range, empty = no data. Click a day cell to navigate to the chit(s) for that date
- **Log** — Reverse-chronological list of all chits with health data. Each entry shows the date and a summary of readings (resolved to display names). Click an entry to open the chit in the editor
- **Charts** — SVG line charts for selected indicators over a configurable date range (week, month, 3 months, year, or custom). Use the filter dropdown to select which indicators to display. "Add Graph" lets you include any Custom Object not already in the graphs zone

The selected mode and graph filter selections persist in localStorage between visits. A ⚙️ Objects link in the header navigates to the [Custom Objects](/frontend/html/custom-objects-editor.html) Editor for managing indicator definitions.

---

**See also:** [Views](/frontend/html/help.html#views) · [Custom Objects](/frontend/html/custom-objects-editor.html) · [Chit Editor](/editor)
