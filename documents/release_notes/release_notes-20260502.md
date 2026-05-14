# 20260502 Highlights

- Added interactive Maps View page with Leaflet
- Added Maps People Mode for contact locations
- Added floating Calculator popover (F4 hotkey)
- Added Kiosk mode (full-screen dashboard)

---

## 20260502.2156

Added Maps People Mode — the Maps View page now supports two display modes (Chits and People) with a persistent toggle, mode-specific filter panels, contact address markers with popups, separate cluster groups, and responsive mobile layout.

## 20260502.2126

Added a Calculator half-button below the Maps/Kiosk row in the dashboard sidebar, which opens the existing calculator popover (same as F4 hotkey).

## 20260502.2040

Added Calculator Popover — a floating, draggable arithmetic calculator available on every page via F4 hotkey. Supports basic arithmetic with operator precedence, Insert Result and Persist mode for the editor, and integrates into the ESC chain.

## 20260502.1948

Added Maps and Kiosk half-width shortcut buttons to the dashboard sidebar, positioned below the Clock/Weather row.

## 20260502.1930

Added Maps View page at `/maps` with an interactive Leaflet map showing chits with locations as color-coded status markers, date range filtering, marker clustering, popups with chit details and editor links, and navigation integration from the sidebar and dashboard hotkeys.

## 20260502.1904

## CWOC Release 20260502.1904

Added Habits section to the product README covering goal/progress tracking, cycle frequencies, per-period history, charts, and cycle-based notifications. Confirmed all technical content (setup, dependencies, service management) is in technical_details.md.

## 20260502.1902

## CWOC Release 20260502.1902

Restructured documentation: moved all technical content (Python versions, prerequisites, local dev setup, production deployment, service management, dependencies) from documents/README.md to documents/technical_details.md. The product README is now feature-focused with a single curl install line. Removed the keyboard shortcuts table — replaced with a mention of full keyboard navigation with hotkeys. Added Indicators to the C CAPTN table. Fixed Courier New → Lora in the theme description.

## 20260502.1859

## CWOC Release 20260502.1859

README updates: added Indicators row to the C CAPTN table, removed Tailscale mention from the intro paragraph, noted that Ntfy requires Tailscale or a BYOB connection for remote delivery. Removed emoji icons from the documents/README.md title.

## 20260502.1852

## CWOC Release 20260502.1852

Renamed `weather.py` to `schedulers.py` and updated all imports. Added Dependencies sections to both READMEs covering Tailscale (remote access) and Ntfy (push notifications) with setup details. Removed the broken X-Attach file download from ntfy notifications. Updated steering files and INDEX.md to reflect the rename.

## 20260502.1839

## CWOC Release 20260502.1839

Removed file attachment from ntfy notifications (was showing as a download instead of an image). Notifications now have three action buttons: Open (chit editor or independent alerts), Snooze (based on user's snooze setting), and Dismiss. All priorities bumped to max (5) for persistent notifications.

## 20260502.1835

## CWOC Release 20260502.1835

Ntfy notifications now include three action buttons (Open, Snooze, Dismiss) and the CWOC logo as a large image attachment. Snooze duration is pulled from the user's snooze_length setting. Applies to all notification types: chit alarms, timers, reminders, independent alarms, and the test notification. Also added ntfy disable/enable button and fixed independent alert timer click URLs.

## 20260502.1828

## CWOC Release 20260502.1828

Added Disable/Enable button for the ntfy service in the Dependent Apps section of Settings. The button toggles ntfy notifications on/off while preserving the server config for easy re-enabling. Status icon shows ⚫ when disabled.

Also fixed independent alert timer ntfy notifications opening to the wrong tab — they now deep-link to the Alarms tab in independent mode instead of whatever tab was last active. Added `?tab=` URL parameter support to the dashboard for this.

## 20260502.1821

## CWOC Release 20260502.1821

Tailscale "Open App" button now opens in a new tab instead of replacing the current page.

## 20260502.1809

## CWOC Release 20260502.1809

Fixed Tailscale "Open App" button on Android — Tailscale doesn't register a custom `tailscale://` URL scheme on Android, so the button now uses an `intent://` URI targeting the app's main activity by package name (`com.tailscale.ipn`), with a Play Store fallback if the app isn't installed.

## 20260502.1805

Server-registered timers are now cancelled when the editor is abandoned without saving. If a timer is running and the user exits without saving (cancel, navigate away, close tab), the server-side scheduled task is cancelled via sendBeacon so no Ntfy notification fires for the abandoned timer. Saved timers continue to fire normally.

## 20260502.1804

## CWOC Release 20260502.1804

Fixed Tailscale "Open App" deep link not launching the app on Android Firefox — switched from a plain `<a href="tailscale://">` anchor to an `intent://` URI with the correct package name (`com.tailscale.ipn`), matching the approach already used by the ntfy button.

## 20260502.1755

Styled all Ntfy notifications with the CWOC logo icon and appropriate priority levels. Alarms and timers use priority 5 (urgent — long vibration, pop-over notification). Start/due reminders use priority 4 (high). All notifications display the CWOC logo as the notification icon. Removed inline emojis from titles since the icon now provides visual identity.

## 20260502.1752

Fixed Ntfy notifications failing for titles with emojis (timers, alarms). Python's urllib encodes HTTP headers as latin-1 which can't handle emoji characters. Non-ASCII titles are now encoded as RFC 2047 base64 UTF-8, which Ntfy supports natively. This fixes the "'latin-1' codec can't encode characters" error that was silently preventing timer and alarm Ntfy notifications from sending.

## 20260502.1741

Reduced alert push loop interval from 60 seconds to 15 seconds for near-instant Ntfy delivery of alarms, start/due times, and notification alerts. Timers already use instant scheduling via asyncio tasks.

## 20260502.1740

Replaced timer polling with instant scheduled delivery. When a timer starts, the server schedules an asyncio task that fires the Ntfy notification at exactly the right time — no 60-second polling delay. Pausing or resetting cancels the scheduled task. Timer state is in-memory (asyncio tasks), not database-polled.

## 20260502.1737

Added server-side timer tracking for Ntfy notifications. When a timer is started (chit or independent), the browser registers the expected end time with the server. The alert loop checks for expired timers every 60 seconds and sends Ntfy notifications when they finish. Pausing or resetting a timer cancels the server-side tracking. Tapping the notification opens the chit editor (for chit timers) or the dashboard (for independent timers).

## 20260502.1733

All Ntfy notifications now include click URLs. Tapping a chit alarm/notification opens the chit editor. Tapping an independent alarm opens the dashboard. URLs use the server's detected local IP with HTTPS so they work from the Ntfy Android app.

## 20260502.1731

Expanded the server-side alert push loop to send Ntfy notifications for alarms, notification-type alerts, and independent alarms — not just start/due times. Alarms fire when the current time matches the alarm's HH:MM and day of week. Notification alerts fire at their computed offset from start/due time (e.g., "15 min before start"). Independent alarms from the standalone alerts board are also checked. All notifications are deduplicated per day to prevent re-firing.

## 20260502.1730

## Release 20260502.1730

Weather temperatures now respect the user's unit system setting. Previously, all weather displays (weather page, dashboard chit cards, editor location zone, weather modal) were hardcoded to Fahrenheit regardless of the metric/imperial preference. Temperatures, wind speeds, and temperature bar ranges now correctly display in °C/km/h for metric users and °F/mph for imperial users.

## 20260502.1727

Rewrote Ntfy notification documentation for single-subscription setup using Tailscale subnet routing. Help page now has clear step-by-step setup, explains how one local-IP subscription works both at home and remotely, includes Tailscale subnet route approval instructions, and warns against duplicate subscriptions. Settings quick-help updated to match. Configurator now auto-advertises the local subnet through Tailscale for remote Ntfy access.

## 20260502.1715

Added unique X-Id header to Ntfy notifications to help with deduplication when the Ntfy app has multiple subscriptions to the same server via different IPs.

## 20260502.1711

Mobile "Views" button now shows the name of the current view (e.g. "☰ Calendar") instead of the generic "☰ Views" label, updating whenever you switch tabs.

## 20260502.1708

Replaced the broken Web Push test buttons in Settings → Install as App with a single "Test Phone Notification" button that sends via Ntfy. Tapping the notification on your phone opens the CWOC settings page. Removed the browser notification and push notification test buttons that didn't work on Firefox Android.

## 20260502.1655

Push test button now gracefully falls back to Ntfy-only delivery when Web Push service worker fails (e.g. Firefox Android with self-signed certs). No longer blocks on service worker errors.

## 20260502.1653

Fixed push notification test so the delayed second notification fires even when the browser is backgrounded or closed. The 10-second delay now runs server-side via asyncio instead of a client-side JS timer that gets throttled by mobile browsers. Both test notifications also send via Ntfy.

## 20260502.1649

The push send endpoint now also sends via Ntfy alongside Web Push. This means the existing test buttons (browser notification and push notification) in Settings will deliver to the Ntfy phone app too, so the 10-second delayed test notification arrives even with Firefox completely closed.

## 20260502.1646

Renamed "Network Access" section to "Dependent Apps" in Settings and Help pages.

## 20260502.1645

Changed "Open" buttons to app deep links — Tailscale button uses tailscale:// and Ntfy button uses ntfy:// to launch the phone apps directly. Fixed mobile overflow in the Network Access section so monospace URLs and long text wrap properly on narrow screens.

## 20260502.1640

Push script now auto-installs ntfy if not present on the server (downloads binary, creates systemd service, starts it). Added "Open Tailscale" button to the Tailscale config section and "Open Ntfy" button to the Ntfy config section for quick access to their web UIs.

## 20260502.1638

Added ntfy binary installation to the configurator script. Downloads the official ntfy release, installs to /usr/bin/ntfy, creates a systemd service on port 2586, and enables it on boot. Idempotent — skips if already installed. Also updated the Ntfy settings UI to show both local and Tailscale server URLs with a hint to subscribe to both for seamless local + remote coverage.

## 20260502.1635

Ntfy settings now shows both local and Tailscale server URLs (when Tailscale is active) with a hint to subscribe to both in the phone app. This ensures notifications work seamlessly whether at home or remote, without ever needing to reconfigure.

## 20260502.1633

Simplified Ntfy settings: removed the editable Server URL input and Save button. The server URL is now read-only and auto-computed — Tailscale IP if active, local IP as fallback. Ntfy auto-enables in the database when the status check confirms the service is reachable.

## 20260502.1628

Ntfy Server URL copy button now replaces localhost/127.0.0.1 with the actual server hostname so the phone app gets a reachable address.

## 20260502.1626

Added copy-to-clipboard buttons (📋) for the Server URL and Topic fields in the Ntfy settings section.

## 20260502.1620

Added Ntfy push notifications as a parallel channel alongside Web Push. Ntfy solves the Firefox Android + self-signed certificate problem by using a native app with persistent connections. Includes deterministic per-user topics, admin config UI in Settings (status check, server URL, test button), automatic chit alert delivery via the existing scheduler, help page documentation, and property-based tests.

## 20260502.1534

Improved push notification diagnostics. subscribeToPush now returns detailed step-by-step results (sw-ready, vapid-fetch, push-subscribe, server-store) with specific error messages. The push test button displays exactly which step failed so the issue can be identified.

## 20260502.1530

Fixed session cookie not persisting across browser restarts. Added max_age (24 hours) to the session cookie so it survives closing and reopening the browser.

## 20260502.1529

Fixed push notification test hanging on "Subscribing to push" after browser restart. Added 10-second timeout to service worker ready check, and the push test now re-registers the service worker before attempting to subscribe.

## 20260502.1522

Added two-step notification test buttons to Settings → Install as App. Both browser and push tests now send a first notification, wait for the user to acknowledge it, count down 10 seconds, then send a second notification to confirm delivery works in the background.

## 20260502.1508

Replaced the single self-signed SSL certificate with a proper CA + server certificate chain. The configurator now generates a local CA (cwoc-ca.crt) and signs a server cert with SANs (IP + hostname) so Chrome/Android properly trust the connection for PWA installation. The Settings cert download button now serves the CA certificate. Existing servers will get new certs on next upgrade.

## 20260502.1506

Added "Open in Chrome to Install" button to Settings → Install as App. On Firefox Android (which can't install standalone PWAs), the button launches Chrome directly to the CWOC server URL via an Android intent, so users can install the real standalone app from there. Updated help page with accurate Firefox limitations and the Chrome install workflow.

## 20260502.1502

Moved the PWA install button from the dashboard sidebar to Settings → Install as App. The section now shows a direct install button (on browsers that support it) plus instructions for using the browser menu. Clarified that Firefox's "Add to Home Screen" is the correct PWA install method. Updated help page accordingly.

## 20260502.1456

Added "Install as App" section to Settings with a button to download the server's self-signed SSL certificate. Users can install the cert on their phone/tablet to trust the server, enabling PWA installation from Firefox, Chrome, and Safari. Updated Help page with Firefox-specific install instructions and certificate trust steps.

## 20260502.1447

Added "Install as App" section to the Help page with instructions for installing CWOC as a PWA on desktop, Android, and iOS, plus notes on push notifications and offline behavior.

## 20260502.1427

Added Progressive Web App (PWA) wrapper — CWOC can now be installed as a standalone app on phones, tablets, and desktops. Includes web app manifest, service worker with app-shell caching and offline fallback, install prompt button in the dashboard sidebar, and Web Push notifications via VAPID/pywebpush for server-sent chit reminders even when the app tab is closed.

## 20260502.1200

Updated help documentation and INDEX.md to reflect all habit system changes: rewrote the Habits View help section to document the 3-section view (On Deck / Out of Mind / Accomplished), habit toggle in Task zone header, perpetual as a date radio option, reset period with unit limits, metric boxes on habit cards, note preview, urgency sorting, fade animations, sidebar filter, and auto-enable from Habits mode. Updated INDEX.md with new functions (`_buildHabitCounter`, `_isResetPeriodActive`, `_getResetEndDate`, `_habitUrgencyScore`, `_getTodayISO`, `onHabitResetToggle`, `_updateResetUnitOptions`, `_fmtPerpetualDate`, `_formatCurrentPeriodLabel`) and updated descriptions for `onHabitToggle`, `onDateModeChange`, `_setDateMode`, `displayHabitsView`, `_renderHabitCards`, and `onPerpetualToggle`.

## 20260502.1128

Habits now support due dates ("do X times before date Y" = start now, end on due date). Perpetual converted from checkbox to radio option in the date mode group (Start/End, Due, Perpetual). None option always hidden for habits. Only the selected date mode's inputs are visible (others hidden, not greyed). Task zone auto-collapses when habit is toggled on. Date mode properly handles all three habit options with correct save/load logic.

## 20260502.1114

Fixed syntax errors in editor-people.js (stray box-drawing character after function closing brace) and editor-dates.js (orphaned `setSaveButtonUnsaved()` and extra `}` at end of file) that were preventing the entire chit editor from loading.

## 20260502.1108

Fixed People zone in the chit editor: search filter is now preserved across re-renders, typing a name and pressing Enter adds it as a free-text person, empty state messages are more visible and guide the user, and the tree now renders even if the contacts API fails. Updated help docs.

## 20260502.1104

Chit editor habit UI reorganization: moved Habits zone after Task zone, moved Perpetual row into Dates zone, removed redundant habit dates display row, renamed "Period History" to "History", made Reset a checkbox-enabled option with show/hide controls, reversed "Hide overall %" to "Show overall %" with checked-by-default, added auto-expand of Dates zone when habit is toggled on, and updated Perpetual description to include the start date.

## 20260502.1053

Major habit editor restructuring: removed dashed HRs from habit zone, added vertical column divider in period history, renamed zone to "Habits", moved habit toggle button to Task zone header (visible when collapsed via zone-button-persist class), moved all habit controls (Goal/per, Reset, Calendar, Overall, Perpetual) into a collapsible Settings section inside the Habits zone, added read-only dates mirror synced with the Dates zone, auto-expands Habits zone and all sub-sections when habit is toggled on.

## 20260502.1052

Added M hotkey for switching view modes across tabs. Opens a modal with sub-key options: Calendar periods (I/D/W/K/X/M/Y), Tasks modes (T/H/A), Alarms modes (L/I), and Projects modes (L/K). Updated reference overlay and help page.

## 20260502.1051

Major restructuring of the habit zones in the chit editor: renamed "Habit Log" to "Habits", moved the habit toggle button from the Dates header to the Task zone header (persists when collapsed), relocated all habit settings (perpetual, goal, reset, calendar, hide overall) into a collapsible "Settings" section inside the Habits zone, added a read-only dates summary mirror in the Settings section, added a vertical divider between period history columns, and removed dashed HRs from period rows.

## 20260502.1046

Swapped calendar header date format to show day-of-week first — now displays "Mon 5" instead of "5 Mon".

## 20260502.1039

Removed zero-padding from calendar date headers — single-digit days now display as "1 Mon" instead of "01 Mon".

## 20260502.1034

Added reverse-color "today" highlighting across all calendar views — day headers, day columns, month cells, year view cells, and itinerary day separators now use a dark-on-light inverted color scheme to make the current date immediately visible.

## 20260502.1032

Removed the "loop until acknowledged" checkbox from notifications (and all associated loop/acknowledge code). For habit chits, the notification timing dropdown now shows "before end of [day/week/month/year]" instead of "before/after start/due", and a "disable if done" checkbox suppresses the notification when the habit goal is already met for the current cycle.

## 20260502.1017

Habit counter controls moved to zone headers — the [−] X/Y [+] counter now appears in both the Dates zone header and the Habit Log zone header, visible even when zones are collapsed. All three locations (Habits View, Dates header, Habit Log header) use the same shared _buildHabitCounter() function. Perpetual habits hide all date rows. Counter removed from the habit controls row body.

## 20260502.1004

Shared habit counter widget — extracted the −/+ counter into _buildHabitCounter() in shared.js, used by both the Habits View and the Chit Editor. The − button is now on the left of the progress text, + on the right: [−] 2 / 5 each Week [+]. Editor now has the same interactive counter in the habit controls row.

## 20260502.0912

Perpetual now hides all date rows (Start/End, Due, None) — just the habit controls remain visible. Reset period changed from a simple dropdown to "Reset every [X] [unit]" format with a number input and unit dropdown. Reset units are limited to one level smaller than the cycle frequency (weekly cycle → days only, monthly → days/weeks, yearly → days/weeks/months, daily → no reset). Calendar and reset rows swapped (reset now above calendar). Reset period stored as "N:UNIT" format (e.g., "3:DAILY"). Backward compatible with legacy single-value format.

## 20260502.0903

## Habits Phase 2: Reset Period, Out of Mind, Hide Overall %, Perpetual

Four new habit features added:

- **Reset Period**: Cooldown after incrementing a habit (Daily/Weekly/Monthly). Prevents over-clicking and moves habits to a new "Out of Mind" section while the cooldown is active.
- **Out of Mind Section**: New section in the Habits view between On Deck and Accomplished. Shows habits where the user has done their part for the reset period but the cycle isn't complete yet. Cards appear faded at 0.6 opacity.
- **Hide Overall %**: Per-habit option to hide the overall success rate percentage badge in the view. Configurable in the editor under habit controls.
- **Perpetual Checkbox**: New checkbox at the top of the Dates zone that sets start date to today with no end date — "starts now, continues forever." Disables the end date input when active.

## 20260502.0827

Fixed rollover bug (third attempt) — the fundamental rule is now: never roll over if there are no previous snapshots. Rollover only triggers when the last snapshot date is strictly older than the previous period, meaning the period has genuinely changed. This prevents the bug where current-period progress was being snapshotted into a past period and reset to 0. Completed habit cards now use parchment cream background matching the metric boxes.

## 20260502.0816

Fixed critical rollover bug that was resetting habit progress to 0 on every page load — the key fix is checking if the last snapshot date equals the previous period (meaning current progress belongs to the current period, not a past one). Note preview now fills the full right side of the card, renders basic markdown inline (bold, italic, links, headers as bold text), and collapses list items with bullet separators instead of newlines.

## 20260502.0801

Habit card layout overhaul: completion text now inline with title ("— ✅ Complete (next: May 5)"), note preview on the right side of each card (hidden on narrow screens), metric badges now have subtle background colors for readability, card body uses flex layout with metrics left and note right.

## 20260502.0753

Replaced broken FLIP animation with simple fade-out/reposition/fade-in (400ms each phase, works in Firefox). Complete badge moved from metrics row to inline below the title as italic green text: "✅ Habit complete for this cycle (next cycle starts May 5)". Cycle tooltip updated to "This period, X of Y tasks completed". Overall tooltip updated to "Completed X of Y cycles successfully". Removed Highlight Overdue and Highlight Blocked from sidebar filters. Added "🎯 Hide Habits" filter to the Show section.

## 20260502.0739

Habit cards now slide smoothly between On Deck and Accomplished sections using FLIP animation — all cards animate to their new positions over 450ms instead of jumping instantly. Due Complete checkbox is hidden when habit is active (habits manage completion via goal). Show on calendar label updated to "Show on calendar views". All Day button icon changed to 🗓️. Metric boxes with labeled icons (📊 Progress, 🎯 Cycle, 📈 Overall, 🔥 Streak) each in a subtle bordered box.

## 20260502.0735

Habit view: debounced saves (1-second delay, resets on each click so you can click multiple times), optimistic UI updates (progress, badges, and status update instantly without waiting for server), animated card movement between On Deck and Accomplished sections (slide out, reposition, slide in). Changed calendar row icon to 🗓️ and label to "Show on calendar views".

## 20260502.0730

Major habit UI polish: All Day is now a styled button (hidden until a date is set, matches Habit button style, disabled when habit forces it). Show on Calendar moved to its own row with 📅 icon. Habit icon 🎯 now replaces 🔁 everywhere — editor title bar, calendar events, tooltips, quick-edit modal, and indicators. Habits View now shows two percentage badges: cycle progress (this period, teal) and overall success rate (past cycles, brown).

## 20260502.0729

Habit system UI refinements: All Day is now a styled button (hidden until a date mode is selected, disabled when habit forces all-day), Show on Calendar moved to its own row with 📅 icon, habit chits show 🎯 instead of 🔁 everywhere (editor title bar, calendar events, quick-edit modal, tooltips), and the Habits View now shows two metric badges — cycle progress (this period) and overall success rate (past cycles).

## 20260502.0720

Fixed habit success rate calculation — current in-progress period no longer counts against you (only included when goal is met). Enhanced logging to show each period's date and values for debugging. The bogus 0-value snapshots from the earlier rollover bug are visible in the logs and can be cleaned up via the Habit Log editor. Also removed line above On Deck header and hid the None date option when habit is active.

## 20260502.0713

Fixed habit success rate showing 50% for completed habits — legacy recurrence exceptions (from before the chit was marked as a habit) were being counted as missed periods. Now only entries with habit_success/habit_goal fields from actual period rollover snapshots are counted.

## 20260502.0704

Habits View default sort now puts habits closest to missing their goal at the top. Sorts by remaining percentage (remaining / goal) — a habit at 4/5 appears above one at 1/5 since it has less room left to complete.

## 20260502.0703

Added section headers to the Habits View: "🎯 On Deck" above incomplete habits and "✅ Accomplished" above completed habits, with styled dividers matching the parchment theme.

## 20260502.0655

Rewrote habit success rate calculation in the Habits View — replaced the occurrence-walking approach (which didn't align with period dates) with a direct count from recurrence_exceptions plus the current period's live progress. Added console logging for debugging habit metrics. Habit Log zone confirmed in column-one directly below Dates.

## 20260502.0653

Fixed fast button clicks on habit cards triggering double-click navigation — dblclick handler now ignores clicks on buttons and checkboxes. Fixed repeat row still showing when loading an existing habit in the editor — onDateModeChange now respects the habit active state, and the habit toggle is applied after date mode and all-day setup to prevent re-showing.

## 20260502.0651

Fixed habit success rate percentage not updating in the Habits View — the current period's live progress is now temporarily injected into the exceptions for rate/streak calculation, so clicking +/− immediately reflects in the percentage. Moved the Habit Log zone from column-two to directly below the Dates zone in column-one.

## 20260502.0647

Habit period labels now show context-aware dates: "Week of Apr 21" for weekly, "May 2026" for monthly, "Year of 2026" for yearly, and plain dates for daily. Applied to both the Habit Log zone in the editor and the habit cards in the Habits View (replacing the generic "Weekly"/"Daily" frequency label with the current period).

## 20260502.0645

Moved habit toggle from a checkbox in the dates zone body to a 🎯 Habit button in the Dates zone header (next to All Day). Button shows active state with teal background and ✓ when habit is on. Repeat row is now fully hidden when habit is active — the habit controls row (Goal per Day/Week/Month/Year) replaces it. Habit Log zone icon updated to 🎯.

## 20260502.0641

Fixed habit counter buttons not working — the root cause was _evaluateHabitRollover incorrectly resetting habit_success to 0 on every re-render when the previous period was already snapshotted. Also changed Habit Log zone icon to 🎯, added type="button" and preventDefault to counter buttons, and removed auto-population of default location on new chits.

## 20260502.0632

Habit editor UX overhaul — consolidated the habit controls into a single row: "Goal: [X] per [Day/Week/Month/Year]" with an inline frequency dropdown that replaces the separate Repeat row. The Repeat row is now hidden when habit mode is active (habit subsumes it). End date from the Start/End fields serves as the recurrence end. Show on calendar toggle spaced further right. Habit frequency dropdown syncs bidirectionally with the underlying recurrence rule.

## 20260502.0623

Habits feedback fixes — counter increment/decrement now works correctly (deep copy instead of shallow), habits are forced to all-day events with a date, habit icon changed from 🔁 to 🎯 everywhere (indicators, editor, sidebar), recurrence labels simplified for habits (no "on Saturday" suffixes), habit row moved above repeat row in editor, and recurrence dropdown labels update dynamically when habit is toggled.

## 20260502.0621

Habit system improvements: fixed stale-state bug in habit counter +/− buttons by switching from shallow copy to deep copy, changed habit icon from 🔁 to 🎯 across dashboard/editor/indicators, forced habits to be all-day events with a date (auto-switches to startend mode and locks all-day/none controls), simplified recurrence labels in habit cards (no day/date suffixes), and reordered editor layout to show the habit row above the repeat row.
