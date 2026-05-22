# W195: _addAllDayHeightCap(eventsRow, container)

## What the web function does
Caps the height of the all-day events row in calendar week/day views. When there are many all-day events, this prevents them from consuming the entire viewport. Adds a "show more" toggle if events overflow the cap.

## What exists on Android
- Calendar views render all-day events
- No height cap or overflow handling for the all-day section

## What's missing
1. No height cap on the all-day events section in calendar views
2. No "show more" / collapse toggle when many all-day events exist
3. Many all-day events could push the time grid off-screen on mobile
