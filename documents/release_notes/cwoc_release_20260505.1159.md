# Release 20260505.1159

Fixed project views (Kanban and list) not showing all child chits. The dashboard was only displaying children already in the global chits array, silently skipping any that were missing. Both views now fetch missing child chits on demand before rendering. Also fixed the editor's project zone showing soft-deleted children that should be hidden.
