# W95-W99: Recurrence Series Info & Actions

## What the web functions do
- W95 `getRecurrenceSeriesInfo`: walks recurrence to compute instance number, total past instances, completed count, success rate for a virtual instance
- W96 `_renderSeriesSummary`: renders a visual summary showing all instances with completion status (used in quick-edit modal)
- W97 `_recurrenceCompleteSeries`: marks the entire recurring series as Complete
- W98 `_recurrenceBreakOff`: breaks off a single recurring instance into a standalone chit and opens it in editor
- W99 `_checkRecurrenceAutoArchive`: auto-archives a recurring chit if all instances up to end date are completed or broken off

## What exists on Android
- RecurringEditDialog exists for "edit this/all/following" scope selection
- RecurrenceEngine.expand() generates virtual instances
- ChitRepository handles recurrence exceptions
- But NO series summary view, NO complete-series action, NO break-off action, NO auto-archive

## What's missing
1. Series info computation (instance count, completion stats)
2. Series summary UI (visual list of all instances with status)
3. "Complete Series" action
4. "Break Off Instance" action (create standalone from virtual)
5. Auto-archive when all instances are done

## Fix needed
Implement these as actions in QuickEditSheet or a dedicated series info dialog. The break-off action requires creating a new chit with the virtual instance's dates and adding an exception to the parent.
