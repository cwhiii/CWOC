# Requirements Document — Email Integration

## Introduction

This feature integrates a basic email client into CWOC (C.W.'s Omni Chits). Emails become chits with an "Email" zone active in the chit editor, following CWOC's core philosophy of "one record, many views." A new "Email" dashboard tab provides an inbox-style view for managing email chits. The implementation is intentionally minimal — a super basic email client grafted onto the existing chit system.

### Architectural Decisions & Rationale

The `email_thoughts.md` research document explored a full mail server stack (Postfix + Dovecot + Notmuch + FastAPI API layer). Below is an evaluation of each recommendation, with the chosen approach for this initial implementation.

#### Decision 1: Direct IMAP/SMTP vs. API Abstraction Layer

**Document recommended:** API abstraction layer (Option B) with a mail sync engine — Postfix (SMTP) + Dovecot (IMAP/storage) + Notmuch (indexing) + FastAPI on top.

**This spec recommends:** A hybrid approach — use Python's stdlib `imaplib` and `smtplib` to connect to an *existing* external mail server (e.g., Gmail, Fastmail, self-hosted), with CWOC's FastAPI backend acting as the API abstraction layer and SQLite as the local cache/store.

**Why disagree with the full stack:** The document's recommended stack (Postfix + Dovecot + Notmuch) turns CWOC into a full mail server. That's a massive operational burden for a "super basic" email feature — you'd need DNS MX records, SPF/DKIM/DMARC configuration, spam filtering, and ongoing server maintenance. It also violates the "no installing software" constraint during development, and would require significant configurinator.sh changes for deployment.

**Pros of the full stack (Postfix + Dovecot + Notmuch):**
- Complete control over mail flow
- No dependency on external mail providers
- Fast local search via Notmuch
- Real mail server — can receive mail directly

**Cons of the full stack:**
- Enormous operational complexity (DNS, spam, deliverability, security)
- Requires installing and configuring 3+ system services
- Overkill for "super basic" email
- Maintenance burden (updates, security patches, monitoring)

**Pros of the chosen approach (IMAP/SMTP client to external server):**
- Uses Python stdlib (`imaplib`, `smtplib`, `email`) — no new dependencies
- Works with any existing email provider (Gmail, Fastmail, self-hosted Dovecot, etc.)
- Minimal operational burden — CWOC is a client, not a server
- Fits the "super basic" requirement
- SQLite cache gives fast local access to synced messages

**Cons of the chosen approach:**
- Depends on an external mail server
- IMAP sync can be finicky (but Python's imaplib handles the basics)
- No offline send (queued sends require the SMTP server to be reachable)

#### Decision 2: Data Model — Emails as Chits

**Document recommended:** Separate message fields (From, To, Subject, Body, Message-ID, etc.) with folders and flags.

**This spec recommends:** Agree with the field set, but store them as new optional fields on the existing Chit model (following CWOC's "one record, many views" philosophy). Email-specific fields are added to the Chit Pydantic model and the `chits` SQLite table. The backend auto-assigns an `"CWOC_System/Email"` system tag to chits with email data, just like Calendar, Tasks, and Notes.

#### Decision 3: Folder Structure

**Document recommended:** Inbox, Sent, Drafts, Trash.

**This spec recommends:** Agree. Map these to an `email_folder` field on the chit. CWOC's existing soft-delete maps naturally to Trash. Drafts are chits with `email_status: "draft"`. Sent messages have `email_folder: "sent"`.

### Resolved Questions

> **Q1: Email provider?** Gmail for MVP. This means Gmail App Passwords for authentication (no OAuth2 needed for v1). Gmail IMAP: `imap.gmail.com:993`, SMTP: `smtp.gmail.com:587`.

> **Q2: Sync scope?** Fetch new emails going forward only. Settings will include a "Backfill" option with a prominent warning about space consumption and a pre-check that estimates how much storage a full backfill would require before proceeding.

> **Q3: Attachments?** Deferred from MVP. (Added to ToDo.md)

> **Q4: HTML email rendering?** Plain-text only for MVP. HTML emails will have their text extracted. (Added to ToDo.md)

> **Q5: Search?** SQLite LIKE queries are sufficient for MVP. (Added to ToDo.md for future full-text search upgrade)

> **Q6: Configurinator changes?** No changes needed — Python stdlib `imaplib`/`smtplib` require no new system packages. External provider is the plan.

> **Q7: Email tab view?** Full inbox view with read/unread display. Email-specific sub-filter (only visible on Email tab) with options: Inbox, By Tag, Drafts, Trash. Read/unread status is displayed but not toggleable from the tab in MVP. (Toggle added to ToDo.md)

---

## Glossary

- **CWOC**: C.W.'s Omni Chits — the host application
- **Chit**: The universal record type in CWOC; a single data object that can serve as a task, note, calendar event, email, etc.
- **Email_Zone**: A collapsible section in the chit editor for email-specific fields (recipients, body, send/reply controls)
- **Email_Tab**: A new dashboard tab that displays email chits in an inbox-style list view
- **Email_Chit**: A chit that has email data populated (email_message_id, email_from, email_to, etc.)
- **Email_Account**: A configured email identity with IMAP/SMTP server credentials stored in user settings
- **Sync_Engine**: A backend process that fetches new messages from the configured IMAP server and creates/updates email chits in SQLite
- **Email_Folder**: A classification field on email chits: inbox, sent, drafts, trash
- **Email_Status**: The lifecycle state of an email chit: draft, sent, received
- **IMAP**: Internet Message Access Protocol — used to fetch and manage email from a remote server
- **SMTP**: Simple Mail Transfer Protocol — used to send outgoing email
- **Message_ID**: A globally unique identifier assigned to each email message by the originating mail server (RFC 2822 Message-ID header)

---

## Requirements

### Requirement 1: Email Account Configuration

**User Story:** As a user, I want to configure my email account credentials in CWOC settings, so that CWOC can connect to my mail server to send and receive email.

#### Acceptance Criteria

1. THE Settings_Page SHALL provide an "Email Account" configuration section with fields for: email address, display name, IMAP server host, IMAP server port, SMTP server host, SMTP server port, username, and password. For MVP, these SHALL be pre-populated with Gmail defaults (`imap.gmail.com:993`, `smtp.gmail.com:587`).
2. WHEN the user saves email account settings, THE Backend SHALL store the credentials in the `settings` table as a JSON field (`email_account`).
3. WHEN the user clicks a "Test Connection" button, THE Backend SHALL attempt to connect to both the IMAP and SMTP servers using the provided credentials and return a success or failure message.
4. IF the IMAP or SMTP connection test fails, THEN THE Backend SHALL return a descriptive error message indicating which connection failed and why.
5. THE Backend SHALL store email account passwords using reversible encryption so they can be used for IMAP/SMTP authentication but are not stored as plaintext in SQLite.
6. THE Settings_Page SHALL mask the password field and only display it when the user explicitly clicks a "show" toggle.
7. THE Settings_Page SHALL include a "Backfill" button that, when clicked, first queries the IMAP server to estimate the total number of messages and approximate storage size, displays a prominent warning (e.g., "This will download ~X messages, estimated ~Y MB. This may take a long time and consume significant disk space."), and only proceeds with the full sync after the user confirms.

---

### Requirement 2: Email Sync — Fetching Inbound Messages

**User Story:** As a user, I want CWOC to fetch new emails from my mail server, so that I can view and manage my email within CWOC as chits.

#### Acceptance Criteria

1. WHEN the user triggers a manual sync (via a "Check Mail" button on the Email_Tab), THE Sync_Engine SHALL connect to the configured IMAP server and fetch only messages newer than the most recent synced message (by date), not already present in the local SQLite database (identified by Message_ID).
2. WHEN a new email message is fetched, THE Sync_Engine SHALL create a new Chit with the following email fields populated: `email_message_id`, `email_from`, `email_to`, `email_cc`, `email_subject` (mapped to chit `title`), `email_body_text` (plain-text extracted from the message), `email_date`, `email_folder` (set to "inbox"), `email_status` (set to "received"), and `email_read` (set to false).
3. THE Sync_Engine SHALL parse the email `Date` header and store it as the chit's `start_datetime` so that email chits appear on the Calendar view.
4. THE Backend SHALL auto-assign the `"CWOC_System/Email"` system tag to any chit that has a non-null `email_message_id` field, following the same pattern as Calendar, Tasks, and Notes system tags.
5. WHEN a fetched email has `In-Reply-To` or `References` headers, THE Sync_Engine SHALL store these in the `email_in_reply_to` and `email_references` fields for future threading support.
6. IF the IMAP connection fails during sync, THEN THE Sync_Engine SHALL return an error message to the frontend and leave existing email chits unchanged.
7. THE Sync_Engine SHALL use the IMAP `SEEN` flag to set the `email_read` field: messages marked as read on the server are stored with `email_read: true`.

---

### Requirement 3: Sending Email

**User Story:** As a user, I want to compose and send emails from within CWOC, so that I can manage my email communication without leaving the application.

#### Acceptance Criteria

1. WHEN the user clicks "Send" on an email chit with `email_status: "draft"`, THE Backend SHALL connect to the configured SMTP server and send the message using the `email_to`, `email_cc`, `email_bcc`, `email_subject` (from chit title), and `email_body_text` fields.
2. WHEN an email is sent successfully, THE Backend SHALL update the chit's `email_status` to "sent", set `email_folder` to "sent", and populate `email_message_id` with the server-assigned Message-ID.
3. IF the SMTP connection or send operation fails, THEN THE Backend SHALL return a descriptive error message and leave the chit's `email_status` as "draft" so the user can retry.
4. WHEN composing a reply, THE Backend SHALL set the `email_in_reply_to` field to the original message's Message_ID and prepend "Re: " to the subject if not already present.
5. THE Backend SHALL construct a valid RFC 2822 email message from the chit fields using Python's `email.message` stdlib module.

---

### Requirement 4: Email Zone in the Chit Editor

**User Story:** As a user, I want an Email zone in the chit editor, so that I can view and compose email content within the familiar chit editing interface.

#### Acceptance Criteria

1. THE Editor SHALL display an "Email" zone (collapsible, following the existing zone pattern) containing: a "From" display (read-only, showing the configured email account), "To" input field, "Cc" input field, "Bcc" input field, and an email body textarea.
2. WHEN an existing email chit is loaded in the editor, THE Email_Zone SHALL populate all fields from the chit's email data (`email_from`, `email_to`, `email_cc`, `email_bcc`, `email_body_text`).
3. WHEN the email chit has `email_status: "received"`, THE Email_Zone SHALL display the body and recipient fields as read-only and show a "Reply" button and a "Forward" button.
4. WHEN the user clicks "Reply", THE Editor SHALL create a new draft chit with `email_to` set to the original sender, `email_in_reply_to` set to the original Message_ID, the subject prefixed with "Re: ", and the original body quoted below a separator line.
5. WHEN the user clicks "Forward", THE Editor SHALL create a new draft chit with an empty `email_to`, the subject prefixed with "Fwd: ", and the original body quoted below a separator line.
6. WHEN the email chit has `email_status: "draft"`, THE Email_Zone SHALL display all fields as editable and show a "Send" button.
7. THE Email_Zone SHALL auto-expand when opening an email chit and auto-collapse when the chit has no email data, following the existing `applyZoneStates` pattern.
8. THE Email_Zone SHALL be mobile-friendly, with recipient fields and body area using full-width layout on small screens.

---

### Requirement 5: Email Dashboard Tab

**User Story:** As a user, I want an "Email" tab on the dashboard, so that I can see my emails in an inbox-style list view alongside my other chit views.

#### Acceptance Criteria

1. THE Dashboard SHALL include an "Email" tab in the tab bar, following the existing tab pattern (icon + label, keyboard shortcut).
2. WHEN the Email tab is active, THE Dashboard SHALL display email chits in a list view sorted by `email_date` descending (newest first), showing: sender, subject (chit title), date, and read/unread status.
3. THE Email_Tab SHALL visually distinguish unread emails from read emails (unread emails displayed with bold text and a distinct background).
4. WHEN the user double-clicks an email chit in the Email_Tab, THE Dashboard SHALL open the chit editor with the Email_Zone expanded, following the existing navigation pattern.
5. THE Email_Tab SHALL include a "Check Mail" button that triggers a manual sync with the IMAP server and refreshes the email list.
6. THE Email_Tab SHALL include a "Compose" button that opens the chit editor with a new draft email chit (Email_Zone expanded, `email_status: "draft"`).
7. THE Email_Tab SHALL include an email-specific sub-filter control (only visible when the Email tab is active) with options: Inbox (default), By Tag, Drafts, and Trash.
8. THE Email_Tab SHALL display read/unread status visually on each email row, but toggling read/unread from the tab is NOT required for MVP.
9. THE Email_Tab SHALL display an empty state message with a "Compose" button when no email chits exist, following the existing `_emptyState` pattern.
10. THE Email_Tab SHALL be mobile-friendly, with the email list using a compact single-column layout on small screens.

---

### Requirement 6: Email Data Model — Chit Fields

**User Story:** As a developer, I want email-specific fields on the Chit model, so that email data integrates cleanly with the existing chit system.

#### Acceptance Criteria

1. THE Chit model SHALL include the following optional email fields: `email_message_id` (TEXT), `email_from` (TEXT), `email_to` (TEXT — JSON array of addresses), `email_cc` (TEXT — JSON array of addresses), `email_bcc` (TEXT — JSON array of addresses), `email_subject` (TEXT), `email_body_text` (TEXT), `email_date` (TEXT — ISO 8601), `email_folder` (TEXT — "inbox", "sent", "drafts", "trash"), `email_status` (TEXT — "draft", "sent", "received"), `email_read` (BOOLEAN), `email_in_reply_to` (TEXT), `email_references` (TEXT).
2. THE Backend SHALL add these columns to the `chits` table via inline migration functions in `migrations.py`, following the existing column-existence-check pattern.
3. THE Backend SHALL serialize `email_to`, `email_cc`, and `email_bcc` as JSON arrays using the existing `serialize_json_field` / `deserialize_json_field` helpers.
4. WHEN a chit has a non-null `email_message_id`, THE `compute_system_tags` function SHALL include `"CWOC_System/Email"` in the chit's system tags.
5. THE Chit model fields SHALL preserve all existing chit functionality — email fields are purely additive and do not alter the behavior of non-email chits.

---

### Requirement 7: Email Deletion and Trash

**User Story:** As a user, I want to delete emails, so that I can manage my inbox and remove unwanted messages.

#### Acceptance Criteria

1. WHEN the user deletes an email chit from the Email_Tab or editor, THE Backend SHALL set the chit's `email_folder` to "trash" and set the chit's `deleted` flag to true, following CWOC's existing soft-delete pattern.
2. WHEN the user restores an email chit from the Trash view, THE Backend SHALL set `email_folder` back to "inbox" and clear the `deleted` flag.
3. THE Email_Tab trash folder filter SHALL show email chits where `email_folder` is "trash", consistent with the main Trash view.

---

### Requirement 8: Read/Unread State Management

**User Story:** As a user, I want to mark emails as read or unread, so that I can track which emails I have reviewed.

#### Acceptance Criteria

1. WHEN the user opens an email chit in the editor, THE Backend SHALL automatically set `email_read` to true.
2. THE Email_Tab SHALL display an unread count badge next to the "Email" tab label, showing the number of email chits with `email_read: false` and `email_folder: "inbox"`.
3. FOR MVP, read/unread toggling from the Email_Tab is deferred. The read/unread state is display-only on the tab and auto-set when opening an email in the editor.

---

### Requirement 9: Email-Specific Styling

**User Story:** As a user, I want the email interface to match CWOC's parchment/1940s aesthetic, so that the experience is visually consistent.

#### Acceptance Criteria

1. THE Email_Zone SHALL use the existing parchment theme variables, Lora font, and brown-tone color palette defined in `shared-page.css` and `styles-variables.css`.
2. THE Email_Tab list view SHALL style email rows as chit cards using the existing `chit-card` CSS class with email-specific additions (read/unread visual distinction, sender/subject layout).
3. THE Email_Zone recipient fields (To, Cc, Bcc) SHALL use a tag-chip style consistent with the existing tag and people chip patterns in the editor.
4. THE email-specific CSS SHALL be placed in a new file `src/frontend/css/editor/editor-email.css` for the editor zone, and email tab styles SHALL be added to the dashboard CSS files following the existing modular pattern.

---

### Requirement 10: Backend Email Routes

**User Story:** As a developer, I want dedicated email API endpoints, so that the frontend can interact with email functionality through a clean REST interface.

#### Acceptance Criteria

1. THE Backend SHALL expose email endpoints in a new route module `src/backend/routes/email.py`, following the existing route module pattern.
2. THE Backend SHALL provide `POST /api/email/sync` to trigger a manual IMAP sync that fetches new messages and returns a count of new emails fetched.
3. THE Backend SHALL provide `POST /api/email/send/{chit_id}` to send a draft email chit via SMTP and update its status to "sent".
4. THE Backend SHALL provide `PATCH /api/email/{chit_id}/read` to toggle the `email_read` field on an email chit.
5. THE Backend SHALL provide `POST /api/email/test-connection` to test IMAP and SMTP connectivity using the configured account credentials.
6. IF any email endpoint is called before an email account is configured, THEN THE Backend SHALL return a 400 error with a message directing the user to configure their email account in settings.

---

### Requirement 11: Reserved System Tag Namespace

**User Story:** As a system administrator, I want the `CWOC_System/` tag prefix to be reserved and protected, so that no user (including admins) can create, rename, or manually assign tags that conflict with auto-generated system tags.

#### Acceptance Criteria

1. WHEN any user (including admins) attempts to create a tag whose name starts with `CWOC_System/` (case-insensitive), THE Backend SHALL reject the request with a 400 error and message: "Tags starting with 'CWOC_System/' are reserved for system use and cannot be created manually."
2. WHEN any user attempts to add a tag starting with `CWOC_System/` to a chit via the editor or API, THE Backend SHALL strip the tag from the request and only allow system-generated `CWOC_System/` tags computed by `compute_system_tags`.
3. THE Frontend tag creation UI (settings page tag management and inline tag creation in the editor) SHALL validate tag names client-side and prevent submission of tags starting with `CWOC_System/`, displaying an inline error message.
4. THE Backend validation SHALL apply to all tag-related endpoints: settings save (tag list), chit create, and chit update.
