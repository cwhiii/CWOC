# Release 20260509.2128

Map thumbnails on chit cards: Tasks, Checklists, and Assigned-to-Me views show a small OpenStreetMap tile for non-default locations. Notes view shows a clickable map-marker icon in the title row. Calendar, Alarms, and Projects show a compact icon in the header. Double-clicking a map thumbnail opens the Maps page centered on that location. Per-user toggle in Settings → Chit Options.

Fixed a bug where double-click and shift+click on Notes view cards were broken — the notes drag system was incorrectly setting the `_dragJustEnded` flag on every mouseup (even without movement), blocking all click/dblclick handlers for 300ms after each click.
