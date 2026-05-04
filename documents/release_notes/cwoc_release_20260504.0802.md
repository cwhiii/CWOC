# CWOC Release 20260504.0802

Signature editor is now an inline div on the settings page (not a modal) — textarea on top, live markdown preview below, auto-updates 500ms after typing stops. Ctrl+B/I/K shortcuts still work.

Fixed signature not applying when creating a new email from the Create Chit button — _applySignatureIfEmpty now waits for settings to load via getCachedSettings() if they aren't available yet.

Outgoing emails with a signature now include an HTML alternative part. The markdown signature is converted to HTML (bold, italic, links, line breaks) and sent as a multipart/alternative message so email clients render it properly instead of showing raw markdown.
