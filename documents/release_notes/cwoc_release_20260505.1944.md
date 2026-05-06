# Release 20260505.1944

Unified tag management code. Both the settings page and chit editor now use the exact same shared code path: `cwocTagModal.open()` for the UI, and `createTagInline`/`updateTagInline`/`deleteTagInline` from `shared-tags.js` for persistence. Removed the `skipPersist` option and all settings-page-specific tag modal wrappers. The settings page tag tree now reads from the API after each change, same as the editor.
