# Release 20260506.1939

Eliminated all browser `alert()`, `confirm()`, and `prompt()` calls across the entire frontend. Replaced with `cwocToast` for notifications/errors, `cwocConfirm` for confirmations, and a new `cwocPromptModal` for text input — all using the parchment theme. Added "Create New Child Chit" button (+) on project headers in both list and kanban dashboard views, and a "Create New" button in the editor Projects zone. Added steering rule prohibiting system dialogs.
