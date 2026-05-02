## Release 20260501.2056

Fixed desktop project master reorder. The dragstart handler was checking e.target.closest('.kanban-project-header'), but e.target in a dragstart event is always the draggable element (projectBox), not the element the user clicked on. Since projectBox is the parent of the header, closest() walked up and never found it. Added a mousedown tracker to capture the actual click origin, and the dragstart now checks that origin instead.
