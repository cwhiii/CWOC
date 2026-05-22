- Removed zone collapse from Android editor (zones always expanded)
- Major Android settings restructure for web parity
- Fixed calendar filters, habits expansion, multi-day events, and 10+ other Android bugs
- Fixed critical server performance regression (60s delays from logging/DB contention)

## m20260521.0638

Android app: Removed all zone toggle/collapse icons and behavior from the editor. Zones are now always expanded with content always visible — no chevron icons, no collapse/expand animation. Notes zone fills available space with toolbar directly visible, fullscreen modal removed.

## m20260520.2026

Android app: Settings page restructured for web parity — (1) General tab reorganized: removed Week Start Day (moved to Views→Calendar), removed Saved Locations/Tags/Habits placeholders (belong in Collections/Views), consolidated duplicate Display Options sections into one containing Landing View, Arrange Views, Reset Sort, Chit Options, and Visual Indicators, added Clocks and Timezone as collapsible sections. (2) Views tab cleaned up: removed standalone Default View/Enabled Periods/View Order/Alerts sections, moved Enabled Periods inside Calendar section where it belongs on web. (3) Fixed pre-existing build errors: QuickEditSheet ExposedDropdownMenu scope issue, CalendarScreen EventList missing parameters, ChitEditorScreen LocationZone missing ExperimentalLayoutApi opt-in and FullEditorModal missing onChitLinkClick parameter.

## m20260520.1721

Android app: Major bug fix batch — (1) Calendar filters now apply full FilterEngine (previously only declined filter worked), (2) Habits no longer expand as recurring events on calendar (were showing zillions of times/day instead of 1x max), (3) Multi-day events now render in the all-day section instead of as impossibly tall bars in the time grid, (4) Settings sections always start collapsed matching mobile web, (5) Default View dropdown now includes all views (Omni, Email, Indicators), (6) View order display fixed for JSON array format (no more partial JSON showing), (7) X-Day count picker removed from sidebar (only in Settings, matching browser), (8) Work days checkboxes layout fixed (labels below checkboxes, no overflow), (9) Year view months now all use same physical height (6 rows always), (10) Attachments can now be added before saving a new chit, (11) Tab row properly parses simple JSON string array view_order format.

## s20260520.1700

Fixed critical performance regression causing ~60 second delays on desktop web. Root causes: (1) verbose debug logging in auth middleware on every request, (2) middleware writing session last_active to SQLite on every single request causing write contention, (3) rules scheduler holding a single DB transaction open across all rule evaluations, (4) multiple DB connections missing PRAGMA busy_timeout causing immediate failures under contention. Fixes: removed debug logging, throttled last_active updates to once per minute, rules scheduler now commits after each rule, added busy_timeout=5000 to all high-traffic DB connections (chits, settings, sync, sharing, contacts, rules engine). Also deferred openpgp.min.js loading on editor and contact-editor pages to eliminate render-blocking parse of 553KB library.
