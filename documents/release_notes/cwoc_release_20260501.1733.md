# Release 20260501.1733

Fixed drag-and-drop in all views (calendar, tasks, checklists, notes, projects/kanban, alarms, indicators) so that completing a drag no longer triggers spurious click/dblclick events that would open quick-edit modals, navigate to the editor, or follow title links. Added a global `_markDragJustEnded()` flag with capture-phase event suppression covering both mouse and touch drag paths.
