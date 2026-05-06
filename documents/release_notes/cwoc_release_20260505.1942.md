# Release 20260505.1942

Fixed tag creation from the chit editor not persisting. Removed duplicated persistence logic from `shared-tag-modal.js` and replaced it with calls to the shared functions in `shared-tags.js` (`createTagInline`, `updateTagInline`, `deleteTagInline`). Both the settings page and the editor now use the exact same code path for tag CRUD operations.
