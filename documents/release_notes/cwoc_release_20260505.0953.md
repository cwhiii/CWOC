# Release 20260505.0953

- Extracted chit text search into shared `chitMatchesSearch()` function in shared-utils.js
- Both the dashboard filter and the add-to-project modal now use the same search logic
- Search covers: title (with HTML entity normalization), note, tags, status, people, location, priority, severity, and checklist items
- Fixed syntax error in editor_projects.js (duplicate closing brace)
