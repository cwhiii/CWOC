# Release 20260501.1358

Fixed chits not displaying in kanban view by removing the `overflow:hidden` and `max-height:60vh` constraints that were clipping project content. Each project now grows naturally to fit all its sub-chits, with the overall projects-view container scrolling when projects exceed the viewport. Added drag-to-reorder for project boxes in kanban mode (drag by the header grip). All non-calendar/indicator views already had scroll support via their CSS classes.
