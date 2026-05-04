# CWOC Release 20260504.0707

Fixed emails arriving as read: IMAP fetch was using RFC822 which implicitly sets the \Seen flag on the server. Switched to BODY.PEEK[] to fetch without marking as read. Existing emails will need to be deleted and re-synced to get correct read/unread state.

Added "Send & Archive" button alongside Send in both the editor header and the expand modal. Sends the reply then archives the original email. New backend endpoint POST /api/email/archive-original handles the archive by Message-ID.
