# Email

CWOC includes a built-in email client that supports multiple email accounts. Configure your accounts in [Settings](/frontend/html/settings.html) → Email → Accounts. Each account has its own IMAP/SMTP server settings, while syncing configuration (max pull, check interval) and signature are shared across all accounts. Emails are stored as chits with special email fields.

## Multiple Accounts

- **Add Account** — Click "Add Account" in [Settings](/frontend/html/settings.html) → Email to add a new email account. You can add any number of accounts, including third-party providers (Gmail, Outlook, Yahoo, custom IMAP servers, etc.)
- **Per-Account Settings** — Each account has its own email address, display name, username, password, and IMAP/SMTP server configuration
- **Shared Settings** — Max pull count, check interval, and email signature are shared across all accounts
- **Test Connection** — Each account card has its own "Test Connection" button to verify IMAP and SMTP connectivity independently
- **Sync All** — When syncing, all configured accounts are checked for new messages

## Email Features

- **Email View** — View inbox, sent, drafts, and trash folders. Shift+click an email card to toggle read/unread status
- **Compose** — Click Compose to create a new email draft. Fill in To, CC, BCC, and body fields. The body supports **markdown** with a live HTML preview below the text area. When sent, the email is delivered as properly rendered HTML
- **Expanded Editor** — Click Expand to open the full-screen email editor with a formatting toolbar, subject field, and split view (markdown on top, preview on bottom). Opening an email from the Email view auto-expands
- **Reply / Forward** — Open a received email and use the Reply or Forward buttons to create a new draft with quoted content. The expand/collapse state is preserved across reply and forward
- **Send & Archive** — Alongside the Send button, Send & Archive sends the reply and archives the original email in one step
- **Threading** — When viewing an email that's part of a conversation, a Thread section appears below the body showing all related messages. Click any thread entry to navigate to that email
- **HTML Rendering** — Received emails with HTML content display in a sandboxed iframe. Use the HTML/Text toggle to switch between rendered and plain-text views
- **Signature** — Configure a markdown signature in [Settings](/frontend/html/settings.html) → Email → Signature. It is automatically appended to all outgoing emails, converted to HTML
- **Auto-check** — Configure automatic mail checking intervals in [Settings](/frontend/html/settings.html) → Email → Syncing (5, 15, 30, or 60 minutes)
- **Deletion Sync** — When you delete an email in Gmail (or any IMAP provider), the deletion propagates to CWOC on the next sync. The deleted email chit is soft-deleted and moved to Trash. This happens automatically during every mail check, whether manual or auto-check
- **PGP Encryption** — When composing an email to a contact who has a PGP public key stored in their contact record (Security zone), a PGP button appears in the email zone toolbar. Click it to enable encryption. The message body is encrypted client-side using the recipient's public key before sending. All recipients must have PGP keys on file to enable encryption. PGP-encrypted sent emails display a green lock banner
- **PGP Decryption** — When viewing a received PGP-encrypted email, a green banner with a "Decrypt" button appears above the message body. Click Decrypt, enter your account password to unlock your private PGP key, and the message is decrypted in-place for viewing. The decrypted text is never saved — it's display-only. If you navigate away, the message returns to its encrypted state. Your private PGP key must be configured in your profile's Security zone

## Email Bundles

Bundles organize your inbox into categories, similar to Google Inbox. Emails are automatically sorted into bundles based on rules you define. Two default bundles are created automatically:

- **From Contacts** — Emails from senders in your contacts list
- **Everything Else** — Emails that don't match any other bundle's rules

Bundle tabs appear in a toolbar above your email list when viewing the Inbox sub-filter. Click a tab to filter emails to that bundle. The toolbar also shows unread counts per bundle.

- **Create Bundle** — Click the "+" button at the end of the tab row. Enter a name and optional description, then click "Define Rule" to set up the classification rule in the [Rule Editor](/frontend/html/help.html#cron-triggers)
- **Edit / Delete** — Right-click (or long-press on mobile) a bundle tab to open the context menu with Edit, Reorder, and Delete options. "Everything Else" cannot be deleted
- **Reorder** — Choose "Reorder" from the context menu, then drag tabs to rearrange. In single-placement mode, order determines priority (first match wins)
- **Multi-Placement** — By default, each email goes to the first matching bundle only. Enable "Allow Multi-Placement" in [Settings](/frontend/html/settings.html) → Email to let emails appear in multiple bundles simultaneously
- **Bulk Actions** — Use the Select All checkbox, Archive, Tag, and Mark Read/Unread buttons in the toolbar row above the bundle tabs to act on multiple emails at once

## Thread Nests

Thread Nests let you attach any non-email chit (task, note, checklist, etc.) to an existing email thread. The nested chit then appears inline within the thread's expanded view, bridging email conversations with related CWOC content.

- **Nest Button** — In the [chit editor](/editor) title row (after the owner chip, before the email button), a nest icon appears on all non-email chits. Click it to open the thread picker
- **Thread Picker** — A modal showing your 20 most recent email threads. Type in the search box to filter by subject. Click a thread to nest the chit into it
- **Active State** — When nested, the button turns blue and shows the first 15 characters of the thread subject. Click the active button again to remove the nest
- **In Thread View** — Nested chits appear in the expanded thread (both in the Email tab and the editor's thread display) with a dove icon, the chit title, and a content preview. Click to navigate to that chit
- **Sort Order** — Within a thread, nested chits sort by due date (ascending), then start date (ascending), then after the top email if no dates are set
- **Top Card Rule** — A nested chit never appears as the topmost card of a collapsed thread — that's always a real email
- **Inbox Exclusion** — Nested chits never appear independently in the email inbox list; they only show inside their thread
- **Cleanup** — If the referenced email is permanently deleted from trash, the nest association is automatically removed

## Email Formatting Shortcuts

These keyboard shortcuts work in both the small email zone and the expanded editor. The expanded editor also has a toolbar with buttons for each action.

- `Ctrl+B` — **Bold** (wraps selection with `**`)
- `Ctrl+I` — *Italic* (wraps selection with `*`)
- `Ctrl+K` — Link (wraps selection as `[text](url)`)
- `Ctrl+E` — Inline code (wraps selection with `` ` ``)
- `Ctrl+Shift+X` — ~~Strikethrough~~ (wraps selection with `~~`)
- `Ctrl+Shift+8` — Bullet list (prefixes line with `-`)
- `Ctrl+Shift+7` — Numbered list (prefixes line with `1.`)
- `Ctrl+Shift+.` — Blockquote (prefixes selection with `>`)
- `Ctrl+Shift+1` — Heading 1 · `Ctrl+Shift+2` — Heading 2 · `Ctrl+Shift+3` — Heading 3
- `Ctrl+Shift+-` — Horizontal rule (inserts `---`)

Bold, italic, strikethrough, link, code, and blockquote require selected text. Lists prefix the current line. Headings apply to the current line. Horizontal rule always inserts.

## Badges

Badges are smart action buttons that appear on email cards when actionable content is detected. They scan email text for tracking numbers, flight numbers, hotel confirmations, rental car bookings, event tickets, restaurant reservations, rideshare receipts, and order confirmations — then show a shield-shaped button you can click to open the relevant service.

- **Automatic Detection** — Badges detect patterns automatically using keyword gates and regex matching. No manual tagging needed
- **Categories** — Package (UPS, FedEx, USPS, DHL, Amazon, UniUni, OnTrac, LaserShip), Flight, Hotel (Marriott, Hilton, IHG, Hyatt, Airbnb, Booking.com, VRBO), Rental (Enterprise, Hertz, Avis/Budget, Turo), Event (Ticketmaster, Eventbrite, AXS, StubHub, SeatGeek), Restaurant (OpenTable, Resy), Transit (Uber, Lyft), Order (Amazon, Apple, Best Buy, Walmart, Target)
- **One Per Category** — At most one badge per category per email, up to the configured maximum (default 3)
- **Configure in Settings** — Go to [Settings](/frontend/html/settings.html) → Badges to enable/disable individual detectors or entire categories, change the max badges per email, or create custom detectors
- **Custom Detectors** — Define your own detection patterns with keywords, regex, and a URL template. Useful for services not covered by the built-in set (pharmacies, loyalty programs, etc.)

---

**See also:** [Views](/frontend/html/help.html#views) · [Omni View](/frontend/html/help.html#omni-view) · [Contacts](/frontend/html/people.html) · [Keyboard Shortcuts](/frontend/html/help.html#hotkeys)
