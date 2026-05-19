# Android Platform Limitations & Dependency Constraints

This document records parity gaps between the CWOC Android app and the web app that **cannot be implemented** due to platform hardware constraints or project dependency rules. These items are intentionally excluded from the parity checklist.

---

## Platform Limitations

These gaps exist because Android touch devices lack the hardware capability required by the web feature.

### Hover Tooltips on Calendar Events

**Parity checklist items:** 1.3, 2.5, 3.5, 4.5

**Web behavior:** Hovering over a calendar event displays a tooltip with event details (title, time, tags).

**Why it cannot be implemented:** Android touch devices have no hover state. There is no pointer that "hovers" over elements — the user either touches or doesn't. The closest equivalent (long-press) is already used for drag-to-reorder and context menus.

**Alternative on Android:** Tapping an event opens the event detail or editor, which provides the same information the tooltip would show.

---

## Dependency Constraints

These gaps exist because the required library is not in `build.gradle.kts` and project rules prohibit installing new dependencies.

### Marker Clustering on Maps

**Parity checklist item:** 44.1

**Web behavior:** When multiple map markers are close together at a given zoom level, they cluster into a single numbered badge that expands on tap/zoom.

**Why it cannot be implemented:** Marker clustering requires the `osmdroid-bonuspack` library, which is not included in the project's `build.gradle.kts`. The project rule "DO NOT INSTALL ANY SOFTWARE" prohibits adding new dependencies.

**Current behavior on Android:** All markers render individually. At low zoom levels with many markers, they may overlap. Users can zoom in to distinguish individual markers.
