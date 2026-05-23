## m20260522.1749

Keyboard now auto-dismisses when opening either sidebar (left drawer or right views panel) in the Android app — covers button taps and swipe gestures in both the main views and the chit editor.

## s20260522.1530 / m20260522.1530

Fixed sort order not syncing across platforms: mobile web now awaits server sort preferences before first render (fixing race condition where localStorage was empty), and Android app now correctly maps between web field names (due, start, updated, created) and its internal enum names (DUE_DATE, START_DATE, etc.), plus maps between web tab names (Tasks, Notes) and Android routes (tasks, notes) for proper cross-device sort sync.

## s20260522.1610 / m20260522.1610

FAB create_new icon now displays with its natural colors (no white tint) on both web and Android.

## s20260522.1522 / m20260522.1522

Mobile header: right Views button stripped to icon-only + matching ☰ hamburger (no text label). Dashboard header order: logo → hamburger → title. FAB "create new" button now uses the create_new.png image (matching the old sidebar icon). Removed "Create Chit" button from the left sidebar on both mobile web and Android app.

## m20260522.1519

Android calendar now honors all user settings: week_start_day (Month/Year/Week views), all_view_start_hour/all_view_end_hour (Day/Week/X-Day hour clipping), work_days (Work Hours view only shows configured work days), and enabled_periods (period dropdown filters to enabled periods only).

## s20260522.1727 / m20260522.1727

Chit editor actions sidebar reordered (app + mobile): Exit (with ← arrow) at top, then Save & Exit, Save & Stay, then a separator, then all options flattened (no more Options submenu). Includes: Hide in Calendar, Reminder, Calculator, Snooze, QR Code, Nest, Audit Log, Make Email, Print, Pin, Archive, Delete. No duplicates.

## s20260522.1704 / m20260522.1704

Chit editor nav header now shows ONLY the editable title between the two hamburger buttons — removed counter, recurrence/habit icons, and logo.

## s20260522.1521 / m20260522.1521

Chit editor title is now editable from ANY zone via the nav header (app + mobile), not just the Overview zone.

## s20260522.1452 / m20260522.1452

Chit editor top bar improvements (app + mobile): swipe on the nav header now moves exactly one zone per gesture (fixed Android multi-trigger issue). Chit title is now displayed in the nav header across all zones — editable when on the Overview zone, read-only elsewhere. Removed the separate title input from the Overview zone content since it's now in the header.

## s20260522.1448

Mobile web header layout: swapped logo and hamburger positions (logo now leftmost), added Omni logo to chit editor mobile nav header, and restyled the editor's right zone-picker button to match the dashboard Views button pattern (label + ☰ pill).

## m20260522.1447

Fixed Android app not firing native notifications for chits with `_notify_flags` alerts (the most common alert type — "notify at start" / "notify at due"). The NotificationScheduler only handled `alarm` and `notification` alert types but silently ignored `_notify_flags`, which meant the vast majority of chits with start/due times never got local AlarmManager notifications scheduled.

## m20260522.1355

Restyled Android app header to match mobile web: left side now has the circular Omni logo + brown hamburger button, right side views selector has brown background with cream text and border. Profile avatar vertically aligned with the content row (not centered including status bar inset).

## m20260522.1259

Fixed Android app profile menu: profile picture now loads from the correct server URL (user profile image, not contact image), displays the user's actual name and username instead of generic "User", and the avatar is truly centered in the top bar. Also fixed font color mismatch on the right-side view selector by removing the TextButton wrapper.

## s20260522.1254 / m20260522.1254

New chit button now opens the editor to the Overview zone with the title field + the relevant zone content embedded inline based on which C CAPTN view you came from (e.g., Calendar → title + dates zone, Projects → title + projects + checklist zones). Applies to both mobile web and Android app.

## m20260522.1241

Moved the all-day events hide/show button in the calendar week view to the empty space left of the first day header. Now cycles through 3 states: hidden (☀), show first 3 (☀³), show all (☀∞).

## s20260522.1208

Reorganized `src/static/` into subdirectories: images in `images/`, audio in `sounds/`, unused assets in `archive/`. Updated all web frontend references (HTML, CSS, JS, SW). No Android app changes needed (uses bundled drawables).

## m20260522.1344

Fixed project header child count (X/Y) not showing in the app. The count is controlled by settings `projects_show_child_count` and `projects_show_checklist_count` (same as web) — the app now reads these from the synced settings and only shows the count when enabled. Also shows aggregate checklist progress when that setting is on. Previously the app was hardcoding the count display without checking settings.

## m20260522.1247

Projects view complete rework to match mobile web styling: removed all excessive padding (project cards, kanban columns, child cards now use tight 2-4dp spacing matching web's 0.2-0.3em). Removed ChitActionMenu/context menu on project master cards (long-press no longer triggers a menu — tap to expand/collapse only). Kanban columns now use proper border-right dividers and centered bold headers matching web. Child chit cards use 1px borders, minimal padding, and compact 10sp font. Removed progress bar (replaced with inline count in header). Removed background color on columns (transparent like web).

## m20260522.1208

Projects view now respects the server-synced manual sort order. Project cards display in the same order you arranged them on web/mobile, synced across all devices via the sort_orders API. Reads directly from ChitReorderHelper's local cache (populated from server on app init) rather than depending on FilterSortViewModel's tab routing.

## m20260522.1202

Projects view: projects now start expanded on view load (previously collapsed). Rejected chits are now nested as a collapsible sub-section inside the Complete column (matching web/mobile behavior) instead of being a separate 5th column.

## m20260522.1250

Fixed profile avatar not loading — root cause was Coil using its own default OkHttpClient which doesn't trust the self-signed certificate on the local server. Implemented ImageLoaderFactory in CwocApplication to provide a global Coil ImageLoader that uses the app's OkHttpClient (which trusts all certs and has the AuthInterceptor for automatic token injection). Also fixed previous token-reading bug (was reading "auth_token" from wrong prefs, now uses authRepository.getToken() for device_token from EncryptedSharedPreferences).

## m20260522.1225

Fixed profile avatar not loading in Android app — was reading auth token from wrong SharedPreferences key ("auth_token" in regular prefs instead of "device_token" in EncryptedSharedPreferences). Now uses AuthRepository.getToken() and getLastServerUrl() to correctly authenticate image requests. Profile dropdown already matches mobile web (display name, @username, Switch User, View Profile, Logout, Notifications).

## s20260522.1156 / m20260522.1156

Fixed mobile header: views control font size now matches "Omni Chits" title on both sides. Profile avatar is now absolutely centered on the full screen width (won't shift when view name changes length).

## s20260522.1134 / m20260522.1134

Mobile header & sidebar redesign (mobile web + Android app): Unified views control on the right side of the header shows [view icon] [view name] [☰] as a single tappable element that opens the views panel. User profile avatar moved to center of header bar. Removed all "Close"/"Hide Sidebar" buttons from sidebars — dismiss via backdrop tap or swipe. Views panel now uses the same PNG tab images as the web app instead of generic Material icons.

## m20260522.1159

Fixed date mode radio buttons requiring multiple taps — replaced `.selectable()` with `.clickable()` to avoid touch event competition with scroll/drag gesture detectors. Also fixed stale closure in callbacks (using live ViewModel state). Removed week number label ("W21") from calendar time grid header.

## m20260522.1127

Fixed chit editor date mode radio buttons requiring 2-3 taps to register a change — stale closure in callbacks meant rapid sequential state updates were overwriting each other. Now reads live ViewModel state in each callback.

## m20260522.1101

Fixed race condition in Indicators view — API calls to fetch zone objects were completing after chit data was already processed, resulting in empty filter sets and no charts shown. Now awaits both zone object fetches before processing chit data.

## s20260522.1036 / m20260522.1037

Removed "Created" and "Updated" date chips from the Tasks view across all platforms (web, mobile web, Android app) to reduce visual clutter on task cards.

## m20260522.1025

Fixed Indicators view showing charts for non-indicator custom objects. Now only shows data for objects explicitly assigned to the indicators_zone or graphs zone — removed the "show everything" fallback that was displaying unrelated custom object data.

## m20260522.0950

Complete rewrite of the Android Indicators view to match web functionality. Fixed critical data parsing bug — the parser expected an array format but health_data is stored as a flat dict (UUID→value). Now correctly parses the dict format, resolves UUIDs to display names via Custom Objects API, fetches graph zone objects to determine which charts to show, adds gridlines/axis labels/date labels to charts, adds click-to-navigate on chart points/calendar cells/log entries, and properly maps sidebar time range buttons (Day=1d, Week=7d, Month=30d, Year=365d, All).

## m20260522.0940

Removed redundant title bar (TopAppBar) from Tasks, Notes, and Notebook views that was creating wasted whitespace below the main header. Made "Omni Chits" and the current view name in the header bar bold and slightly larger (19sp/15sp) using the Lora font, without increasing the header bar height.

## m20260522.0813

Android Notes view: removed extra metadata sections (tags, people, health badges, weather text, location, sharing, RSVP, archive/snooze indicators) from note cards to match web parity — web only shows emoji indicators in the title row. Android Indicators view: moved mode toggle (Charts/Calendar/Log) from main view area to sidebar, removed non-functional Custom Range and Show Graphs controls, kept working Time Range buttons in sidebar.

## m20260522.0656

Fixed undo-delete toast being positioned too low and getting covered by the create chit FAB button. Increased bottom padding from 24dp to 96dp so the toast sits well above the hexagonal FAB.

## m20260522.1102

Fixed login screen flash on app launch: when authenticated, show parchment background while nav resolves instead of briefly rendering the full-screen (login) layout. Eliminates the visual flash between login and the main tab view.

## m20260522.1025

Fixed default_view (Landing View) setting: app now actually navigates to the configured landing view on launch instead of always starting on Tasks. Also fixed sync to populate the landingView entity field from the server's default_view value so the setting is honored immediately after sync.

## m20260522.1019

Settings sections now ALWAYS start collapsed on every page load. Removed SharedPreferences persistence of expanded/collapsed state — sections reset to collapsed each time you open settings.

## m20260522.0948

Restructured all settings tabs to match web section layout exactly. General tab now has proper CollapsibleSections: ⚙️ General, 🏛️ Contact Vault, 🕐 Clocks, 🌐 Timezone, Default View, View Order, Sort Order, Chit Options, Visual Indicators, Custom Filters & Sorting. All sections across all tabs (General, Views, Collections, Email, Administration) now start collapsed by default.

## m20260522.0809

Fixed all remaining save/send mismatches: audit_log_max_mb now sends as integer (not double), audit_log_max_days/mb send null when pruning disabled (matching web), kiosk tags now also sent as `kiosk_users` key (matching web), session_lifetime "Never" sends "0".

## m20260522.0806

Fixed remaining display mismatches: Landing View dropdown now has all 9 options matching web (added Omni, Email, Indicators). View Hours End dropdown now goes to 24 (midnight) matching web. Session Lifetime "Never" now sends "0" matching web (was sending "never").

## m20260522.0759

Fixed settings tab placement to match web exactly: removed duplicate Week Start Day from General tab (only in Views → Calendar now), removed stub Tags and Saved Locations sections from General tab (already properly implemented in Collections tab), removed stub Habits section from General tab (already in Views tab).

## m20260522.0736

Fixed settings format parity: Room now stores web-format values directly (single source of truth). snooze_length stores "5 minutes", alarm_orientation stores "Horizontal"/"Vertical", work_days stores "1,2,3,4,5", email booleans store "1"/"0". The push mapper sends exactly what Room stores — no conversion layer. UI converts for display only.

## m20260522.0654

Fixed all settings format mismatches between Android app and web: snooze_length now sends "5 minutes" format (not just "5"), alarm_orientation sends capitalized "Horizontal"/"Vertical" (not lowercase), work_days sends numeric "1,2,3,4,5" (not "mon,tue,wed,thu,fri"), and email boolean fields (block_tracking, paginate, bundles_enabled, bundles_multi_placement) send "1"/"0" (not "true"/"false"). Settings saved on any platform now display correctly on all others.
