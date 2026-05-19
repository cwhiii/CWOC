## m20260518.1913

Android DateZone: Added accessibility semantics/tooltip to Due Complete checkbox ("Yes, this is the same as the 'Status' Complete.") and Point in Time "Now" button ("Set to current date and time"), made the entire Due Complete label row tappable for easier interaction.

## s20260518.1439

Fixed Android settings sync: tags, saved locations, and all other Collections/Admin/Email settings now properly sync bidirectionally. Root causes: (1) tag tree was reading from wrong DB column (shared_tags instead of tags), (2) SettingsDto was missing 18 fields added in Room migration 7→8 so server data was silently dropped on pull, (3) SettingsPushMapper wasn't sending those fields so changes never reached the server, (4) server VALID_COLUMNS and sync push fields didn't include the new columns. Added server migration for the new settings columns.

## m20260518.1429

Fixed Android contacts: people colors now display at full opacity matching the web (was 20% alpha), QR code share buttons now actually open the QR dialog instead of being a no-op stub, and the People list screen now has the full navigation chrome (hamburger menu, top bar, tab bar) so users can navigate to other sections of the app.

## m20260518.0727

Fixed Android contact editor color picker to show the full 20-color palette matching the web version (was only showing 7). Color picker now also loads user's custom colors from settings. Fixed profile image section to actually load and display contact photos using Coil (was showing a placeholder emoji). Added "Contact" / "Profile" type badge below the profile image matching the web's header badge.

## m20260518.0717

Fixed Android contact editor: multi-value fields (phones, emails, addresses, call signs, X handles, websites) now correctly parse and display label + value pairs instead of showing raw JSON strings. Fixed dates zone to read the correct `value` key from the backend format and display actual date values. Added show_on_calendar checkbox for date entries. Reorganized editor into proper zones matching the web (Contact Info, Details, Social & Web, Security, Tags, Color, Notes, Dates). Fixed contact list subtitle to display the first phone/email value correctly.

## m20260518.0727

Views panel and swipe-to-change-tab now respect the view_order setting from Settings. The tab row, swipe cycling, and right-side views panel all show tabs in the order configured on the Settings page (including hiding tabs marked as not visible). The views panel shows the ordered main tabs first, then all other screens below a divider.

## m20260518.0716

Rewrote the top bar to match the mobile web browser layout exactly: [☰ Hamburger] ["Omni Chits" title with tappable "Omni" word] ... [Profile avatar] [☰ Views button showing current tab name]. Tapping "Omni" in the title navigates directly to Omni View. Views button opens the right-side panel showing ALL available views (main tabs + all other screens). Swipe left/right on the tab row cycles through tabs (wraps around). Removed notification bell and search icon from top bar (accessible via Views panel and sidebar instead).

## m20260518.0706

Fixed right-swipe views panel to show ALL available views in the app (not just C CAPTN tabs). Panel now shows main views (Calendar, Checklists, Alerts, Projects, Tasks, Notes, Indicators, Email, Omni) followed by a divider and all other screens (Search, Notifications, Settings, Contacts, Weather, Map, Trash, Help, Audit Log, Custom Objects, Rules, User Admin, Attachments).

## m20260518.0657

Android app navigation and UX overhaul: OmniView is now a tab in the C CAPTN tab row (no longer a separate screen in the sidebar); version number displayed at bottom of left sidebar; right-swipe-from-edge opens a views panel showing all available views; chit cards across all views now use parchment-style styling matching the mobile web (brown border, parchment background, no elevation); two-finger pinch-to-zoom on Day/Week/Work Hours calendar time grids (hour segments get taller/shorter vertically).

## m20260518.0628

Fixed calendar view crash (IllegalArgumentException: Can't represent a size of 374973 in Constraints). Root cause: multi-day events produced unbounded pixel heights inside scrollable containers, exceeding Compose's layout constraint limit. Fixed DayTimeGrid and WeekTimeGrid layout structure (removed redundant .height(totalHeight) on scroll containers, moved scroll to proper level) and clamped event duration to max 24 hours (1440 minutes) to prevent overflow.
