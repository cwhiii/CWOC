# Maps View

The Maps View displays an interactive map with two modes: **Chits** and **People**. Access it from the navigation menu (🗺️ Maps) or by navigating to `/maps`. The map fills all available viewport space for maximum visibility.

## Mode Toggle

A Chits/People toggle in the page header switches between modes. The toggle is always visible regardless of whether the sidebar is open or closed. Your selected mode is saved and restored automatically on the next visit.

- **Chits** — Shows chits with locations as color-coded markers (the original Maps behavior)
- **People** — Shows contacts from your address book at their addresses

Switching modes swaps the markers, filter panel, and legend. Only one mode is active at a time.

## Collapsible Sidebar

All filter controls live in a collapsible left sidebar. Click the **☰** toggle button in the header to expand or collapse it. When collapsed, the map expands to fill the freed space. The sidebar remembers its open/closed state between visits.

The sidebar displays the filter panel for the currently active mode — switching between Chits and People swaps the filter panel automatically.

## Fullscreen Mode

A fullscreen button in the top-right corner of the map enters true browser fullscreen for maximum map visibility. Click it again to exit fullscreen. You can also press `Escape` to exit fullscreen. The button is hidden if your browser does not support the Fullscreen API.

## Default View Button

A home button in the top-right corner of the map resets the view to your configured default. The reset behavior depends on your Map Settings:

- **Auto-zoom enabled** — Fits the map bounds to encompass all visible markers
- **Auto-zoom disabled with custom center/zoom** — Pans and zooms to your configured center point and zoom level
- **No custom settings** — Defaults to a view of the continental United States

## Map Start Settings

Configure how the map opens each time in **[Settings](/frontend/html/settings.html) → 🗺️ Map Settings**:

- **Auto-zoom to markers** — When enabled (the default), the map automatically fits all visible markers into view on load
- **Custom center and zoom** — When auto-zoom is disabled, set a default latitude, longitude, and zoom level (1–18). The map will open at this position each time

If auto-zoom is disabled and no custom center/zoom is configured, the map defaults to a view of the continental United States.

## Chits Mode

Chits mode displays chits that have locations as markers on the map. Each marker is color-coded by status:

- ● **ToDo** — Blue
- ● **In Progress** — Orange
- ● **Blocked** — Red
- ● **Complete** — Green
- ● **Rejected** — Grey (deliberately declined)
- ● **No Status** — Grey

Click a marker to see a popup with the chit's title, date, and status, plus a link to open the chit in the editor.

## Chits Mode Filters

The sidebar filter panel in Chits mode lets you narrow which chits appear on the map:

- **Status** — Checkboxes for ToDo, In Progress, Blocked, Complete, and Rejected
- **Tags** — Click tag chips to filter by one or more tags
- **Priority** — Checkboxes for Low, Medium, High, and Critical
- **People** — Click people chips to filter by assigned contacts
- **Text search** — Searches across chit title, note, location, and tags (case-insensitive)
- **Date range** — Start and end date inputs (defaults to ±30 days from today). Only chits with a start, due, or created date within the range appear

All filters combine with AND logic — a chit must match every active filter to appear. Click **Clear Filters** to reset all filters to their defaults.

## People Mode

People mode displays your contacts on the map at their addresses. Each contact with an address gets a colored marker using the contact's assigned color (or teal if no color is set). Contact markers have semi-transparent fills so that overlapping markers remain partially visible underneath each other. Contacts with multiple addresses get a separate marker for each address. Contacts without addresses are skipped.

Click a contact marker to see a popup with the contact's name, address, organization, phone, and email (when available). Click **"Open Contact"** in the popup to go to the [contact editor](/frontend/html/people.html). Contact markers use a distinct square shape so they're easy to tell apart from chit markers.

## People Mode Filters

The sidebar filter panel in People mode lets you narrow which contacts appear on the map:

- **Text search** — Searches across all contact fields (name, email, phone, address, organization, tags, and more)
- **Favorites Only** — Toggle to show only contacts marked as favorites
- **Tags** — Click tag chips to filter by contact tags

All filters combine with AND logic. Click **Clear Filters** to reset.

## Cluster Markers

When many markers are close together, they cluster into numbered group icons. Zoom in or click a cluster to expand it. Clusters use distinct color schemes so you can identify their contents at a glance:

- **Chit-only clusters** — Amber/brown square icons
- **People-only clusters** — Teal square icons
- **Mixed clusters** — Purple square icons with an inscribed circle, indicating the cluster contains both chits and contacts

Each cluster displays the total count of markers it contains.

## Mobile

On mobile devices, the sidebar defaults to collapsed and overlays the map when expanded. Tap the backdrop to close it.

## Google Maps Preference

If "Prefer Google for Maps" is enabled in [Settings](/frontend/html/settings.html) → Chit Options, the Maps View displays a warning message instead of loading the map. Google Maps is not supported for this feature due to billing restrictions. Disable the preference in [Settings](/frontend/html/settings.html) to use the Maps View.

---

**See also:** [Views](/frontend/html/help.html#views) · [Contacts](/frontend/html/people.html) · [Settings](/frontend/html/settings.html) · [Saved Locations](/frontend/html/help.html#saved-locations)
