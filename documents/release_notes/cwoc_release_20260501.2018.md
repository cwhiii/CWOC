## Release 20260501.2018

Fixed mobile Notes view drag-to-reorder. The CSS `!important` rules for single-column mobile layout were overriding the JS-set absolute positioning, preventing cards from moving. Added a `cwoc-notes-floating` CSS class and a separate mobile drag path that uses `position: fixed` with a placeholder, matching the checklist/tasks drag behavior.
