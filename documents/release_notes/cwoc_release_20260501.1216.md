# Release 20260501.1216

Three changes:

1. Moved "Hide declined chits" from Settings into the dashboard sidebar's Display filter group (renamed from "Show" to "Display"). It's now a live toggle alongside Hide Past-Due and Hide Complete, with a separator between the show/hide groups. Initializes from the saved setting, persists across refresh, and resets with Clear Filters.

2. Renamed the "Audit Log" zone in the chit editor to "Habit Log" (with 🔁 icon) since it only shows the series completion summary for recurring/habit chits.

3. Chit delete now exits the editor immediately and shows the undo countdown toast on the dashboard instead of lingering in the editor. The editor stores undo info in sessionStorage, navigates home, and the dashboard picks it up on load.
