# CWOC Release 20260504.0750

Signature editor is now a full modal with the textarea on top and a live markdown preview on the bottom half. Preview auto-updates 500ms after you stop typing. Ctrl+B/I/K shortcuts work in the modal. The settings page shows an inline preview snippet that opens the modal on click.

Fixed signature not auto-applying to new emails — now applied in both _activateEmailZone and initEmailZone for drafts with empty bodies. The signature is pre-filled with the standard `--` separator.
