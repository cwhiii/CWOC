# Release 20260505.1936

Fixed realtime tag filtering. Added `data-tag-row` attribute to each rendered tag tree row in `renderTagTree` for reliable DOM selection. Rewrote `_filterTagTree` to hide all rows first, then show only those whose full path matches the query, walking up the DOM to reveal ancestor containers and parent group headers.
