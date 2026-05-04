# CWOC Release 20260504.0811

Restored the signature editor as a proper modal (textarea on top, live preview on bottom, 500ms debounced updates, Ctrl+B/I/K shortcuts). Settings page shows an inline preview snippet with an "Edit Signature" button to open the modal.

Signature is now inserted as rendered HTML into the email body (converted from markdown via marked.js) instead of raw markdown text. The backend also sends a multipart/alternative HTML version for email clients that support it, and skips double-appending if the body already contains the signature.
