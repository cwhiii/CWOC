# CWOC Release 20260503.2132

- Replaced right-click context menu on email cards with shift+click to toggle read/unread; added bulk "Mark Read/Unread" button to the email selection bar
- Added debug logging to the email thread endpoint for troubleshooting threading issues (logs anchor message_id, in_reply_to, references, and match count)
- Moved the Attachments zone to the very bottom of column-two in the chit editor (after Health Indicators and Email)
- Fixed save button state not resetting when deactivating email mode on a chit — now unpatches CwocSaveSystem and restores normal save buttons
- Added 📎 attachment indicator with count tooltip to chit header cards across all views
- Added console.log debug statements to email HTML rendering pipeline (initEmailZone, _setupHtmlEmailView) for diagnosing raw HTML display issues
- Updated README.md and technical_details.md to reflect shift+click read/unread change
