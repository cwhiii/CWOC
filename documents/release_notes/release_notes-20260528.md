- Added About & Buy Me a Coffee page (web + Android)
- Built Badges Page with smart link detection across all platforms
- Added weather forecast caching to Android app

## cwoc_server-20260528_2003 / cwoc_app-20260528_2003

Added About & Buy Me a Coffee page across all platforms. Web: new /about page with app overview, creator info, philosophy, tech stack, and Buy Me a Coffee link. Android: native AboutScreen with matching content. Accessible from the V-key navigate panel (web) and sidebar (app).

## cwoc_server-20260528_0942 / cwoc_app-20260528_0942

Badges Page — dedicated command-center view consolidating all active and recently-completed smart link detections (packages, flights, hotels, rentals, events, restaurants, transit, orders) into a categorized page. Backend: Python detector registry, badge persistence with dedup, email-based and date-based auto-completion, API endpoints. Web: badges.html with category sections, staleness indicators, dismiss, refresh, sidebar controls. Android: native BadgesScreen with Room caching, offline support, and sidebar navigation.

## cwoc_app-20260528_0825

Added weather forecast caching to the Android app. Weather data from the server is now stored in Room and displayed from cache when offline. The sync engine refreshes weather during each sync cycle. The weather modal also reads from cache for instant display.

## cwoc_server-20260528_0731

Fixed mobile notes toolbar heading buttons (H1, H2, H3) appearing in the bottom-left corner on desktop. The dropdown menus were appended to document.body but only had a `display: none` rule inside a mobile media query — added a global hide rule so they're invisible on all viewports.

## cwoc_server-20260528_0718

Fixed editor crash on load caused by a stale `_attachColorSwatchListeners()` call left over from the color picker refactor. The function no longer exists — the new `_initEditorColorPicker()` handles everything. This was preventing chit data from loading into the editor form.

## cwoc_server-20260528_0704

Fixed email sidebar controls (Check Mail, Unify, folder filters) not hiding when switching to Omni View via the header click. The Omni trigger bypassed filterChits and never called _updateEmailSidebarVisibility.

## cwoc_server-20260528_0645

Added "Unify" button to the email sidebar (below Check Mail). When enabled, temporarily hides all bundle tabs and shows all inbox emails in one flat list, bypassing bundle filtering.

## cwoc_server-20260528_0600

Added a small Check Mail button (sync icon only, no text) to the Omni View email section header — spins during sync just like the sidebar Check Mail button.
