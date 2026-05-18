# Phase 3: Email Client

## Problem
The entire email client feature is missing from the Android app. On the web, Email is a full tab in the C CAPTN row with folders, threading, compose, reply, forward, bundles, and account management.

## Scope
This is the largest single feature gap. It requires:
- A new tab in the C CAPTN row
- A full email list view with folder switching
- Thread expansion (inline)
- Email compose/reply/forward (uses the chit editor with email fields)
- Bundle tabs (user-defined email groupings)
- Account filter pills
- Unread badge on the tab

## Tasks

### 3.1 Add Email Tab to C CAPTN Row
**Files:**
- `CCaptnTabRow.kt` — Add `Email("Email", "email", Icons.Default.Email)` to enum
- `MainActivity.kt` — Add `Screen.Email.route` to `cCaptnRoutes`
- `CwocNavGraph.kt` — Register the Email screen composable

### 3.2 Create EmailScreen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/email/EmailScreen.kt`

Layout (top to bottom):
1. **Folder selector** — Row of FilterChips: Inbox (default) | Sent | Drafts | Scheduled | Trash | Archived
2. **Bundle tabs** (only visible when folder = Inbox) — Horizontal scrollable row of bundle names from settings
3. **Account filter pills** (only visible when multiple email accounts configured) — Toggle pills per account nickname
4. **Email list** — LazyColumn of email cards (threaded)

Each email card shows:
- Unread indicator (dot)
- Sender name/avatar
- Reply indicator (if replied to)
- Subject line
- Tag chips (if any)
- Attachment indicator (📎)
- Preview snippet (first ~80 chars of body)
- Date/time
- Badge chips (if badge detectors match)

**Tap behavior:**
- Tap email card → expand thread inline (show all messages in thread)
- Tap individual message in expanded thread → navigate to editor with that chit

**Swipe actions:**
- Swipe right → Archive
- Swipe left → Delete (move to email trash)

### 3.3 Create EmailViewModel
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/email/EmailViewModel.kt`

State:
- `currentFolder: String` (inbox/sent/drafts/scheduled/trash/archived)
- `activeBundle: String?` (null = show all inbox)
- `accountFilter: List<String>` (selected account nicknames)
- `emails: List<EmailThread>` (grouped by thread)
- `unreadCount: Int` (for badge)

Data source: Filter local Room chits where `email_message_id IS NOT NULL` or `email_status IS NOT NULL`, then apply folder logic:
- Inbox: has tag "Inbox" AND not archived
- Sent: has tag "Sent" AND not archived
- Drafts: email_status = "draft" AND not archived AND no email_send_at
- Scheduled: email_status = "draft" AND has email_send_at AND not archived
- Trash: has tag "Trash"
- Archived: archived = true

Threading: Group by normalized subject (strip Re:/Fwd: prefixes) + email_in_reply_to / email_references chain.

### 3.4 Email Compose (via Editor)
The web composes emails by navigating to the editor with `?new=email&expand=email`. On Android:

**Add to editor:**
- When a chit has `email_status = "draft"`, show an **Email Zone** in the editor with:
  - From (dropdown of configured accounts)
  - To (text field with contact autocomplete)
  - CC (text field, collapsible)
  - BCC (text field, collapsible)
  - Subject (text field)
  - Body (markdown text area — same as Notes zone but for email)
  - Send button
  - Send Later button (date/time picker)
  - Discard button

**New email from Email tab:**
- FAB on EmailScreen → navigate to `editor/new` with email_status pre-set to "draft"

**Reply/Forward:**
- In expanded thread, show Reply / Forward buttons on each message
- Reply: Create new chit with email_status=draft, email_in_reply_to set, subject prefixed with "Re:", body quoted
- Forward: Same but subject prefixed with "Fwd:"

### 3.5 Email Send Flow
When user taps "Send":
1. Save the chit (email_status remains "draft")
2. Call `POST /api/email/send/{chitId}` 
3. On success, the server marks it as sent and moves it to Sent folder
4. Navigate back to email list

Undo send: Show `UndoToast` with configurable delay (from settings `undo_send_delay`) before actually calling the send API.

### 3.6 Unread Badge on Tab
The `CCaptnTabRow` already supports `tabCounts`. Pass the unread email count for the Email tab so it shows a badge number.

### 3.7 Email Sidebar Controls
When the Email tab is active, the sidebar should show:
- Folder radio buttons (same as the FilterChips but in sidebar form)
- Account filter checkboxes
- "Check Mail" button (triggers `/api/email/check`)
- Unread-at-top toggle

## Web Reference Files
- `src/frontend/js/dashboard/main-email.js` — Email view, folder switching, compose, send
- `src/frontend/js/dashboard/main-email-bundles.js` — Bundle tabs, bundle filtering
- `src/frontend/html/index.html` (lines 339-341) — Email tab HTML
- `src/frontend/js/editor/editor-email.js` — Email compose/read in editor

## Verification
- [ ] Email tab appears in C CAPTN row with envelope icon
- [ ] Tapping Email shows inbox by default
- [ ] Folder chips switch between Inbox/Sent/Drafts/Scheduled/Trash/Archived
- [ ] Email cards show sender, subject, preview, date, unread dot
- [ ] Tapping a card expands the thread inline
- [ ] Tapping a message in expanded thread opens editor
- [ ] FAB creates new email draft in editor
- [ ] Editor shows full email compose UI for draft chits
- [ ] Send button calls API and shows undo toast
- [ ] Reply/Forward create new drafts with proper headers
- [ ] Unread count shows as badge on Email tab
- [ ] Bundle tabs filter inbox when bundles are configured
