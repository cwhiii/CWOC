## 20260514.1721

Import batch management now supports admin mode. Admins see all import batches across all users (with owner usernames displayed) and can delete any user's batch. Regular users only see and can delete their own batches.

## 20260514.1713

ICS calendar import now tracks import batches. Each import tags chits with `cwoc_system/imported/[calendar name]/[date]` for batch identification and `calendar/imported/[calendar name]` for user-facing filtering. Calendar name is extracted from the ICS file's X-WR-CALNAME property. Added Import Batches UI in Settings showing all previous imports with a one-click Delete button to send an entire batch to trash. New API endpoints: GET /api/import/ics/batches and POST /api/import/ics/batches/delete.

## 20260514.1700

Fixed help doc links to point to actual app pages — "Settings" links to `/frontend/html/settings.html`, "Audit Log" links to `/frontend/html/audit-log.html`, "Maps" links to `/maps`, etc. Help-to-help cross-references use `help.html#slug` hash navigation. Links to real app pages navigate directly to those pages.

## 20260514.1647

Moved help documentation from `documentation/` to `src/help/` — now deploys automatically as part of `src/` without needing a separate configurinator entry. Updated backend path resolution to match.

## 20260514.1639

Fixed help page 500 errors — the `documentation/` directory wasn't being deployed to the server. Added it to the configurinator deploy script. Also added `/app/src/documentation` as a fallback path and improved error handling so missing docs return graceful JSON responses instead of 500s.

## 20260514.1635

Fixed help page 401 errors — excluded `/api/docs*` GET endpoints from auth middleware. The help page is served from `/frontend/` (which skips auth), so fetch calls from it don't reliably send the session cookie on self-signed cert setups. Documentation content isn't sensitive, so auth isn't needed.

## 20260514.1626

Fixed help page doc loading and search: renamed search endpoint to `/api/docs-search` to avoid route conflicts, changed doc fetch to use slug without `.md` extension in the URL path (avoids framework issues with dots in path params), added better error messages, and added `cwd` fallback for documentation directory resolution.

## 20260514.1621

Added full cross-linking across all help documentation files — references to other pages (Omni View, Chit Editor, Habits view, Custom Objects, Audit Log, Weather page, etc.) are now clickable links that navigate between docs. Help index page shows a categorized table of contents organized into 7 sections.

## 20260514.1618

Split the monolithic help page into 28 individual documentation files in `documentation/`. The help page now loads content dynamically with a categorized table of contents, breadcrumb navigation, and cross-file search. All "Settings →" references are cross-linked to their respective pages.

## 20260514.1610

Fixed release notes modal scroll position not resetting when navigating between days — content now scrolls to top on each Older/Newer click so it doesn't appear to append.

## 20260514.1557

Added "How to Export" guide to the Calendar Import section in Settings. Clicking the link opens a tabbed modal with step-by-step instructions for exporting from Google Calendar, Apple Calendar, and Outlook. Also expanded the Help page calendar import documentation with detailed export instructions for all three platforms.

## 20260514.1550

Redesigned the Omni Layout configurator to show 3 visual zones: Full Width (top), Left Column, and Right Column side by side, plus an Unused zone at the bottom. Sections are placed by dragging them into the appropriate zone — no more L/R/Full buttons. Drop position within each zone controls ordering. Full-width sections always render at the top of the Omni View. Added drop-highlight feedback when dragging over zones.

## 20260514.1543

Added per-section "hide when empty" toggle to the Omni Layout configurator. Each section now has an eye icon button — eye-slash (filled) means the section hides when empty, eye (outline) means it always shows with a "No X right now" message. Defaults: Reminders always visible, HST/Weather bars always visible, all others hide when empty. Also fixed Quick Reminder not appearing in the Alarms→Reminders view until hard refresh (was calling displayChits on stale cache instead of fetchChits to reload from server).

## 20260514.1535

Fixed Reminders block not appearing on the Omni View dashboard. The "hide empty sections" logic was hiding it when no reminders existed for today, preventing the "No reminders for today" empty state from ever being visible. Reminders section now always renders (like Weather/HST bars) so users can see it's active.

## 20260514.1530

Fixed Reminders block missing from the Omni Layout configurator modal. The settings page's `_omniLayoutAreas` array was missing the reminders entry, so it never appeared in the Arrange Omni Layout drag-and-drop UI despite being fully implemented in the renderer.

## 20260514.1525

Moved Omni View to first position in the Views tab.

## 20260514.1512

Settings refinements: Swapped Geography↔Custom Filters between General and Views tabs. Renamed Geography to "Maps". Broke the monolithic Email settings group into 3 logical boxes: Accounts & Syncing, Display & Bundles, Privacy & Sending. Moved badge custom detector modal outside the Email tab so it renders correctly regardless of active tab. Added Wyndham Hotels badge detector (Days Inn, Super 8, Ramada, La Quinta, Wingate, Baymont, Microtel, Hawthorn, Trademark, Tryp, Dolce).

## 20260514.1500

Settings page expanded to 5 tabs: General, Views, Collections, Email, Administration. View-specific configurators (Calendar, Omni View, Habits, Projects, Custom Filters) moved to Views tab. Collection-type settings (Tags, Colors, Saved Locations, Default Notifications) moved to Collections tab. Geography split — map settings stay in General, saved locations moved to Collections.

## 20260514.1444

Settings page reorganized into tabbed interface: General, Email, and Administration tabs. Email settings (accounts, syncing, display, privacy, signature, badges) moved to dedicated Email tab. Admin-only settings (user management, data management, dependent apps, version/updates) moved to Administration tab. Tab state persists across page loads. Hash-based deep linking (#email, #admin) switches to the correct tab.

## 20260514.1436

Fixed time picker barrel selector not updating the center number on mouse wheel scroll. The _suppressSync flag was only cleared by touch/mousedown events, so wheel scrolling left it suppressed.

## 20260514.1419

Fixed two weather notification bugs: (1) Thresholds now stored in canonical units (°C, km/h, mm) so changing unit systems doesn't break comparisons — the UI converts to/from display units transparently. (2) Recurring chits now get fresh weather data for today instead of using stale forecast from the original instance date. Also added a freshness check so notifications won't fire on outdated weather data.

## 20260514.1414

Auto-bundles: three built-in system bundles that auto-classify emails during sync. **Newsletters** (detected via List-Unsubscribe header), **Receipts** (noreply sender + transactional subject patterns), **Calendar Invites** (text/calendar MIME part). Promoted sender logic: if a sender is manually moved to a user bundle, they're excluded from the Newsletters auto-bundle. Auto-bundles are non-removable and created automatically for all users.

## 20260514.1518

"Create Reminder Chit" action now uses the same UI style as the Quick Reminder (!R) modal: parchment-styled title input, date picker with "Use {{today}}" checkbox (for rules that fire daily), and the drum roller time picker (cwocTimePicker). Renamed action label to "Create Reminder Chit". Weather manual location now accepts city names and addresses (backend geocodes via Nominatim), not just lat/lon. Placeholder updated to "City, address, or lat,lon".

## 20260514.1505

Fixed weather location picker jumping back to default. Root cause: selecting "Manual" stored empty string as location, but on re-render no SELECT option had value="" so browser defaulted to first option. Fix: now stores "_manual" literally as the location value (persists across re-renders), and coordinates are stored as "_manual:lat,lon". Backend _resolve_location_coords updated to parse both formats. Default location option now shows the actual location name (e.g., "📍 Home" instead of "📍 Default Location"). Non-default saved locations listed separately without the ★ suffix.

## 20260514.1502

Fixed weather location picker for real this time. Root cause: _loadSavedLocations was async but called without await — saved locations were never populated on first render. Now uses window._cwocSettings (already loaded by shared-utils) synchronously when available, with async fallback that re-renders the condition tree when locations arrive. Renamed field label from "Weather (default location)" to just "Weather" since location is now a separate picker control.

## 20260514.1454

Fixed weather location picker — selecting "Manual coordinates" now correctly shows the coordinate input field (bug was empty string failing the display condition). Implemented field-specific operator filtering: each field now only shows operators that make sense for it. Status/priority/severity/color only get equals/not_equals/is_empty/is_not_empty. Boolean fields (archived, pinned, all_day) only get equals/not_equals. Tags only get tag_present/tag_not_present/is_empty/is_not_empty. People only get person_on_chit/person_not_on_chit/is_empty/is_not_empty. Date fields get comparison + days_ago operators. Text fields get the full text set. Numeric fields (streak, habit_goal) get comparison operators. Changing field now auto-resets operator to first valid option if current operator isn't valid for the new field.

## 20260514.1435

Weather condition builder fixes: Manual coordinates now properly shows an input field when selected. Metrics organized into optgroups (Temperature: Low/High, Wind: Speed/Gusts, Precipitation: Total/Rain/Snow/Showers+Hail). Threshold unit label now updates dynamically when metric changes (°C for temp, km/h for wind, mm for rain/precipitation, cm for snow). Backend updated to fetch rain_sum, snowfall_sum, showers_sum from Open-Meteo. Generic _check_weather_condition now parses metric+comparison from operator name instead of hardcoded if/elif chain. Added "Create Reminder" action — simplified version of Create Chit with just title, reminder time, and optional note. Creates a notification chit with point_in_time and CWOC_System/Reminders tag.

## 20260514.1424

Overhauled weather condition UI in rule editor. Weather conditions now use a dedicated multi-input builder: [Field: Weather] → [Location: saved location picker or manual lat,lon] → [Metric: Temperature Low/High, Wind Speed, Wind Gusts, Precipitation] → [Comparison: Above/Below] → [Threshold with unit label] → [Window: Today / Next 2-14 days]. Field dropdown is now organized into optgroups (Properties, Tags & People, Dates, Habit, Weather). Backend refactored to support per-location weather lookups via _resolve_location_coords (accepts saved location labels, "_default", or manual "lat,lon" coordinates). Value format is now "threshold|days|location".

## 20260514.1418

Added column header labels above each input in the rule condition rows. Each condition now shows "FIELD", "OPERATOR", and "VALUE" (or "THRESHOLD|DAYS", "TAG", "PERSON", "LOCATION" as appropriate) as small uppercase labels above the respective dropdowns/inputs, like table column headers.

## 20260514.1410

Fixed weather condition operators to use synchronous HTTP fetch (avoids asyncio event loop conflicts when called from background threads). Added alert/notification time field to Create Chit action UI with template support (e.g., {{today}}T08:00:00). Added weather template variables for create_chit titles/notes: {{weather_low}}, {{weather_high}}, {{weather_precipitation}}, {{weather_wind_speed}}, {{weather_wind_gusts}}. Added 🌤️ Weather field to habit trigger condition fields.

## 20260514.1500

Added Reminders as its own customizable/organizable block in the Omni View. Shows today's incomplete reminders sorted by time, with a check-circle button for quick completion (with undo countdown). Reminders are excluded from all other Omni blocks (chrono, on deck, soon, pinned).

## 20260514.1448

Reminder "Mark Complete" now uses the same undo countdown bar as email archive/delete — card fades out immediately, a 5-second timer bar appears with an Undo button, and the actual complete+archive only fires when the countdown expires. Clicking Undo restores the card.

## 20260514.1427

Reminder complete button now auto-archives when marking complete, and un-archives + clears status (back to no status) when reverting to incomplete.

## 20260514.1420

Reminder card action icons now match the email view exactly: bookmark (pin), check-circle/undo (status), archive, trash (delete). Uses the same `email-pin-btn` and `email-hover-btn` CSS classes.

## 20260514.1415

Added inline action buttons to Reminders view cards (hover to reveal): pin toggle, status toggle (Complete/ToDo), archive, and delete with confirmation. Cards show status badges (✓ done, past) and completed reminders are dimmed. Uses the same email-hover-btn styling pattern.

## 20260514.1409

Added Reminders mode to the Alarms tab (4th view mode). Shows all reminder chits (notification + point_in_time) split into Upcoming and Past sections. Sidebar buttons now use a 2x2 grid layout. Email notifications are now stored in the notifications DB table so they appear in the Notifications view. Added CWOC_System/Reminders system tag for chits created via Quick Reminder.

## 20260514.1353

Email notifications are now sent individually — one notification per email, each showing the sender as the title and subject as the body. Clicking a notification opens that specific email directly in the editor. Previously all new emails were grouped into a single notification linking to the inbox.

## 20260514.1345

Added right-click "Add to Bundle" feature for emails. Users can now right-click any email and select "Add to Bundle" to create a new rule that matches future emails by subject or sender address. The modal allows choosing between subject line matching or sender email matching, then selecting which bundle to add the rule to. The system automatically creates an OR condition rule and triggers reclassification of existing emails.

## 20260514.1402

Rule editor UX overhaul: organized all dropdowns into logical optgroups (triggers grouped by Chits/Email/Contacts/Scheduling/Habits/Home Assistant; actions grouped by Tags & People/Status & Priority/Appearance & Location/Lifecycle/Create & Notify/Email/Home Assistant; operators grouped by Comparison/Text/Presence/Tags & People/Date Age/Weather Current/Weather Forecast). Added smart searchable inputs for tags, people, and locations — type to filter or pick from existing values. Weather conditions now properly appear when selecting the "Weather (default location)" field. Clarified "Track as Habit" tooltip to explain it tracks whether the rule fires on schedule.

## 20260514.1343

Completed weather condition system for rules engine. Added sophisticated weather operators for current conditions and forecast windows (e.g., "forecast for next 3 days contains wind above 13 mph"). Added "create chit" action type for rules to generate new chits based on conditions. Weather conditions use existing Open-Meteo integration and saved_locations with is_default flag. Frontend rule editor now includes weather operators with smart input placeholders and create chit action panel with template variable support.