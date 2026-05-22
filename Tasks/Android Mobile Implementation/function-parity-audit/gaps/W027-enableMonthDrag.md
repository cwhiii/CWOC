# W27: enableMonthDrag(monthGrid, onDrop)

## What the web function does
Enables drag-and-drop of chit events between day cells in the month calendar view:
- User can drag a chit from one day cell to another
- On drop: updates the chit's start/end/due dates to the target day
- Prevents drag for viewer-role shared chits
- Saves via API on drop

## What exists on Android
CalendarMonthView.kt has no drag support. Events are tap-only (navigate to editor or long-press for quick edit).

## What's missing
The entire month-view drag-to-reschedule feature. Users cannot drag events between days in the month view on Android.

## Fix needed
Add drag gesture detection to month view event chips, with drop targets on each day cell. On drop, call CalendarViewModel.updateChitDateTimes() with the new date (same pattern as the time grid drag).
