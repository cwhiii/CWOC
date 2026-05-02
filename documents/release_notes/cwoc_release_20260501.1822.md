# Release 20260501.1822

Found and fixed the actual root cause of checklist centering: `shared-editor.css` has `.editor input { flex: 1; padding: 8px 12px }` which applies to ALL inputs inside the editor wrapper, including checkboxes in checklist items. This made checkboxes expand with `flex:1` and get oversized padding, pushing them to the center. Fixed by adding targeted overrides in `editor.css`: `.checklist-container input[type="checkbox"] { flex: 0 0 auto; padding: 0; width: auto }` with `!important` on the `.left-container` rule to guarantee it wins.
