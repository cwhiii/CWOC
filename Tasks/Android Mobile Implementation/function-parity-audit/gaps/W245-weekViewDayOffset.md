# W245: _weekViewDayOffset

## What the web function does
`_weekViewDayOffset` is a state variable that tracks how many days the week view is offset from the standard week start. Used for the "X-day view" feature where the user can show 1, 2, 3, 4, or 5 days instead of a full 7-day week. The offset determines which days are visible in the narrower view.

## What exists on Android
- CalendarViewModel has viewMode (Day, Week, Month, Year, Itinerary)
- Week view shows 7 days
- Day view shows 1 day
- No configurable X-day view (2, 3, 4, 5 days)

## What's missing
1. No X-day view mode (configurable number of visible days between 1 and 7)
2. No day offset tracking for partial-week views
3. Users can only choose Day (1) or Week (7) — no intermediate options
