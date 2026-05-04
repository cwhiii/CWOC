# CWOC Release 20260503.2118 — Email Integration Enhancements

Five email-related features added in this release:

1. **Read/Unread Toggle** — Right-click (or long-press on mobile) email cards in the Email tab to toggle read/unread status via context menu. The PATCH endpoint now toggles instead of only marking as read.

2. **Email Threading** — New `GET /api/email/thread/{chit_id}` endpoint finds related emails by Message-ID references and subject line matching. Thread view renders below the email body in the editor, showing sender, date, and preview for each message in the conversation.

3. **Attachments Zone** — New zone in the chit editor for file attachments with drag-drop upload, download, and delete. Backend stores files at `/app/data/attachments/{chit_id}/` with metadata in a JSON column. Configurable max file size (5/10/25/50 MB) in Settings.

4. **HTML Email Rendering** — Incoming emails now preserve their HTML body. The editor shows a sandboxed iframe with DOMPurify sanitization and an HTML/Text toggle button for switching between rendered and plain-text views.

5. **FTS5 Full-Text Search** — SQLite FTS5 virtual table indexes title, note, email_body_text, and email_subject with automatic sync triggers. Search results are now ranked by relevance. Falls back to LIKE queries if FTS5 is unavailable.
