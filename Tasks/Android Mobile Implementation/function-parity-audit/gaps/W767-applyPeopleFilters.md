# W767: _applyPeopleFilters(contacts)

## What the web function does
Filters the contacts array before geocoding/displaying on the map. Three AND-combined filters:
1. **Favorites filter** — if `_mapsPeopleFilterFavoritesOnly` is true, only show contacts with `favorite === true`
2. **Tag filter** — if `_mapsPeopleFilterTags` has entries, only show contacts whose tags overlap
3. **Text search filter** — if `_mapsPeopleFilterText` is non-empty, only show contacts matching `_mapsContactMatchesFilter()` (searches name, org, phones, emails, addresses)

The web has a dedicated "People" filter panel in the sidebar with:
- Favorites-only toggle
- Tag chips (built from actual contact tags)
- Text search input

## What exists on Android
- `MapViewModel._allPeople` StateFlow (Boolean) — toggles "show all people" but this just controls whether contacts are shown at all, not filtering within contacts
- `MapViewModel.contactMarkers` — loaded unfiltered from Room (all active contacts with addresses)
- `updateVisibleMarkers()` includes ALL contactMarkers when mode is PEOPLE or BOTH — no filtering applied

## What's missing
1. **No favorites filter** for contacts on the map
2. **No tag filter** for contacts on the map
3. **No text search filter** for contacts on the map
4. **No people filter panel UI** in the Android MapScreen for contact-specific filtering
5. The `_allPeople` toggle exists but doesn't actually filter — it's vestigial since contacts are never filtered anyway
