## m20260522.0813

Android Notes view: removed extra metadata sections (tags, people, health badges, weather text, location, sharing, RSVP, archive/snooze indicators) from note cards to match web parity — web only shows emoji indicators in the title row. Android Indicators view: moved mode toggle (Charts/Calendar/Log) from main view area to sidebar, removed non-functional Custom Range and Show Graphs controls, kept working Time Range buttons in sidebar.

## m20260522.0656

Fixed undo-delete toast being positioned too low and getting covered by the create chit FAB button. Increased bottom padding from 24dp to 96dp so the toast sits well above the hexagonal FAB.

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
