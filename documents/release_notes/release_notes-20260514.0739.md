# Release 20260514.0739

Fixed parent tag filtering on dashboard views. Selecting a parent tag (e.g. "Work") now correctly filters to only chits tagged with that tag or any of its children (e.g. "Work/Projects"). The bug was that the filter relied on hidden DOM checkboxes which only existed for explicitly-defined tags, not virtual parent nodes in the tag tree. The filter now reads directly from the selection state array.
