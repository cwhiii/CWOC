# Release 20260505.1827

Extracted the tag creation/editing modal from the settings page into a shared component (`shared-tag-modal.js`) and integrated it into the chit editor. Users can now create, rename, recolor, set favorites, delete, and manage sharing for tags directly from the editor's tag zone without navigating to settings. The settings page continues to use the same shared modal with its batch-save model preserved via a `skipPersist` option.
