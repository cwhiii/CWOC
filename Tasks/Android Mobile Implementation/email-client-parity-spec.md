# Email Client — Exhaustive Web Mobile → Android Parity Spec

This document is a painfully detailed, field-by-field, button-by-button specification of every single element, behavior, and interaction present in the CWOC web mobile email client. It is derived directly from the JavaScript, HTML, and CSS source code. The Android app must reproduce every item listed here.

---

## 1. EMAIL TAB — Dashboard Entry Point

### 1.1 Tab Bar Entry
- **Tab icon**: Custom `email.png` image (not a Font Awesome icon)
- **Tab label**: "Email" with the "E" underlined (hotkey indicator)
- **Unread badge**: A small badge (`#email-unread-badge`) appears on the tab when unread inbox emails exist
  - Shows count (number), capped at "99+" for counts > 99
  - Hidden when count is 0
  - Badge updates in real-time as emails are read/unread

### 1.2 Sidebar Controls (Email-Specific Section)
When the Email tab is active, a dedicated sidebar section appears with:

#### 1.2.1 Folder Radio Buttons
- **Inbox** (default)
- **Sent**
- **Drafts**
- **Scheduled**
- **Trash**
- **Archived**

Selecting a folder filters the email list to that folder. Only one can be active at a time.

#### 1.2.2 "Check Mail" Button
- Button with a sync/refresh icon (`fa-sync-alt`)
- Triggers `POST /api/email/sync`
- While syncing: icon spins (`fa-spin`), account pills show spinners
- On success: toast with count of new emails per account
- On error: persistent error toast with "⚙️ Email Settings" and "📋 Copy Error" and "✕ Dismiss" buttons

#### 1.2.3 "Compose" Button
- Navigates to `/frontend/html/editor.html?new=email&expand=email`
- Creates a new email draft chit

#### 1.2.4 Account Filter Pills
- One pill button per configured email account (by nickname)
- All accounts start selected (dark/active state)
- Clicking a pill toggles that account on/off
- When all are selected: show all emails
- When some are deselected: only show emails from selected accounts
- **Error state**: If an account fails sync, its pill turns red with ⚠️ prefix
  - Clicking an error pill shows a detailed error toast with "⚙️ Email Settings", "📋 Copy Error", "✕ Dismiss"
- **Success state**: After successful sync, pill gets a green indicator class
- **Last sync time**: Shown in tooltip on hover (e.g., "Last check: 10:32:15 AM May 18")
- **Spinner**: During sync, each pill shows a spinning `fa-circle-notch` icon

#### 1.2.5 Unread-at-Top Toggle
- Checkbox labeled "Unread at top"
- When checked: unread threads sort above read threads (within each group, still sorted by newest)
- When unchecked: all threads sorted by newest first (default)

---

## 2. BUNDLE TOOLBAR (Sticky, Two-Row)

The bundle toolbar is a sticky element at the top of the email list area. It has two rows.

### 2.1 Row 1: Bulk Action Controls

A horizontal row containing:
1. **Select All checkbox** — Toggles all visible email cards selected/deselected
2. **Archive button** — `<i class="fas fa-archive"></i> Archive` — Bulk archives selected emails
3. **Tag button** — `<i class="fas fa-tag"></i> Tag` — Opens tag picker modal to apply tags to selected emails
4. **Read/Unread button** — `<i class="fas fa-envelope-open"></i> Read/Unread` — Toggles read state on all selected
5. **Delete button** — `<i class="fas fa-trash"></i> Delete` — Bulk soft-deletes selected emails (with confirmation)
6. **Selected count** — Right-aligned text showing "N selected" when items are checked

**Button states:**
- **Inactive** (no selection): Greyed out, `opacity: 0.5`, `pointer-events: none`
- **Active** (has selection): Full opacity, clickable, hover effects
- Delete button uses danger styling (red text/border) when active

### 2.2 Row 2: Bundle Tabs

A horizontally scrollable row of bundle tab buttons:
- Each tab shows: **bundle name** + **count badge** (unread/total based on setting)
- **Active tab**: Bold bottom border, stronger background, `font-weight: 900`
- **Inactive tabs**: Lighter background, `opacity: 0.6` if colored
- **Tab colors**: Each bundle can have a custom color applied as background
- **Count badge modes** (from settings `bundles_show_count`):
  - `"both"` → shows "unread/total" (e.g., "3/12")
  - `"unread"` → shows unread count only
  - `"total"` → shows total count only
  - `"none"` → no badge
- **"+" button**: At the end of the row, opens the Create Bundle modal
- **Priority arrows**: In single-placement mode, `→` arrows appear between tabs showing priority order
- **Dimmed state**: When sub-filter is NOT "inbox", all bundle tabs are dimmed and non-interactive

#### 2.2.1 Bundle Tab Interactions
- **Click**: Sets that bundle as the active filter
- **Shift+Click** (desktop): Opens the Edit Bundle modal
- **Right-click** (desktop) / **Long-press** (mobile, 500ms): Opens context menu
- **Drag-and-drop**: Tabs are always draggable for reorder (except "Everything Else" in single-placement mode)
  - Visual indicators: `border-left: 3px solid #6b4e31` or `border-right` on drop target
  - Persists via `PUT /api/bundles/reorder`

#### 2.2.2 Bundle Context Menu
A floating menu with options:
- **Edit** — Opens the Edit Bundle modal
- **Disable** (auto-bundles only) — Hides the bundle, strips tags from emails
- **Delete** (user-created bundles only) — Confirms then deletes via `DELETE /api/bundles/{id}`
- "Everything Else" cannot be deleted

#### 2.2.3 Create/Edit Bundle Modal
Fields:
- **Name** (required text input)
- **Description** (optional textarea)
- **Tab Color** (color picker with swatches + "None" option)
- **Show in Omni View** (checkbox)
- **Actions**: "Cancel" and "Define Rule" (create) or "Save" (edit)
- Edit mode also shows: "Change Rules" button (navigates to Rule Editor) and "Delete" button

---

## 3. EMAIL LIST — Thread Cards

### 3.1 Date Group Headers
When `email_group_by` setting is `"date"` (default), section headers appear:
- **"Today"** — emails from today
- **"Yesterday"** — emails from yesterday
- **"Last Week"** — emails from the past 7 days
- **"Older"** — everything else

### 3.2 Single Email Card Layout
Each email card is a horizontal row containing (left to right):

#### 3.2.1 Contact Image / Checkbox Area
- **Default state**: Shows contact profile image (circular avatar)
  - If contact has `image_url`: shows that image
  - If no image: shows first letter of sender name as initial in a circle
- **Hover state** (desktop): Checkbox appears over the image
- **Checked state**: Checkbox stays visible, image hidden; `email-cb-checked` class applied
- **Shift+Click**: Range-selects all checkboxes between last clicked and current

#### 3.2.2 Pin Button
- Bookmark icon (`fa-bookmark`)
- **Unpinned**: Outline icon (`far fa-bookmark`)
- **Pinned**: Solid icon (`fas fa-bookmark`) with active class
- Click toggles pin state via `PUT /api/chits/{id}` with `{pinned: true/false}`
- Pinned emails always sort to the top of the list

#### 3.2.3 Content Row (fills remaining space)
A single horizontal line containing these elements in order:

1. **Status badges** (if applicable):
   - Draft: `<span class="email-draft-badge">Draft</span>`
   - Sent: `<span class="email-sent-badge">Sent</span>`

2. **Sender name**: Bold text, truncated with ellipsis. Shows display name extracted from "Name <email>" format. Full email shown in tooltip.

3. **Reply indicator**: Fixed-width slot showing `<i class="fas fa-reply"></i>` if the user has replied to this email (checks if any sent/draft chit has `email_in_reply_to` matching this message's ID)

4. **Subject**: Slightly smaller text, truncated. Markdown stripped (links extracted as text, bold/italic markers removed)

5. **Tag chips** (up to 3 non-system tags):
   - Each chip shows tag name with the tag's color as background
   - Contrast-safe text color computed from background
   - If >3 tags: shows "+N" overflow indicator with tooltip listing remaining tags

6. **Body preview**: Fills remaining space. Plain text extracted from email body:
   - HTML stripped (style/script blocks removed, tags removed, entities decoded)
   - Markdown stripped
   - Zero-width characters removed
   - Raw URLs removed
   - Whitespace collapsed to single spaces
   - Truncated to 250 characters

7. **Attachment thumbnails** (if email has attachments):
   - Image attachments: show actual thumbnail `<img>` with lazy loading
   - Non-image attachments: show file type emoji icon + filename
   - Click: opens attachment preview modal
   - Shift+Click: downloads directly
   - Right-click: context menu with "View" and "Download" options

8. **Smart link badges** (tracking numbers, flights, hotels, etc.):
   - Auto-detected from email body text using keyword gates + regex
   - Each badge shows: carrier/service logo image + label text
   - Clicking opens the tracking URL in a new tab
   - Categories: Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order
   - Max badges per email configurable in settings (default 3)

9. **Hover action buttons** (appear on hover, to the left of date):
   - **Archive**: `<i class="fas fa-archive"></i>` — Quick-archives with undo countdown
   - **Delete**: `<i class="fas fa-trash"></i>` — Quick-deletes with undo countdown
   - **Mark Unread**: `<i class="fas fa-envelope"></i>` — Toggles read/unread state

10. **Date**: Right-aligned, fixed position
    - Today: shows time (honors 12/24h setting)
    - Yesterday: shows "Yesterday"
    - This year: shows "Mon DD" (e.g., "May 18")
    - Older: shows "Mon DD, YYYY"

#### 3.2.4 Card Visual States
- **Unread**: Card has `email-unread` class (bolder text, visual weight)
- **Custom color**: If chit has a color, card background is tinted and all text uses contrast-safe color
- **Flash animation**: When a card is restored after undo, it briefly flashes (`email-card-flash` class)

#### 3.2.5 Card Interactions
- **Double-click**: Navigates to editor with `?id={chitId}&expand=email`
- **Right-click**: Opens the standard chit context menu (same as other views)
- **Swipe right** (touch): Archive gesture
  - Green background with archive icon slides in from left
  - Threshold: 40% of card width
  - Below threshold: snaps back
  - Above threshold: card slides off-screen, then archives with undo toast
- **Swipe left** (touch): Delete gesture
  - Red background with trash icon slides in from right
  - Same threshold behavior
  - Triggers soft-delete with undo toast

### 3.3 Threaded Email Card (Multi-Message)
When a thread has >1 message:

#### 3.3.1 Thread Visual Indicators
- **Thread ribbon**: A vertical bar on the left edge of the card group (`email-thread-ribbon`)
- **Thread count badge**: Inline badge after sender name showing total message count (e.g., "5")
  - Tooltip: "5 messages in this thread — click to expand"
  - Click expands/collapses the thread inline

#### 3.3.2 Thread Expansion
- Clicking the thread badge toggles expansion
- **Expanded state**: Shows all messages in the thread below the top card
  - Each child card has class `email-thread-child-card`
  - Messages from other folders show a folder tag (e.g., "sent", "drafts") unless redundant with status badge
  - Nested chits (non-email chits with `nest_thread_id`) show with a nest icon (dove/eggs SVG)
- **Collapsed state**: Only the latest visible message shows as the top card

#### 3.3.3 Thread Grouping Logic
Emails are grouped into threads using:
1. **Message-ID / In-Reply-To / References chain** (primary)
2. **Normalized subject matching** (fallback) — strips Re:/Fwd:/Fw: prefixes, case-insensitive compare

#### 3.3.4 Nested Chit Cards (within threads)
- Show nest icon (SVG image `/static/nest-eggs.svg`)
- Display: chit title + content preview (first line of note, or checklist summary "☑ 3/5 items", or status)
- Date shown if due_date or start_datetime exists
- Single-click navigates to that chit's editor
- Sort order within thread: due_date ascending → start_datetime ascending → no-date after top email
- Never appears as the topmost card of a collapsed thread

### 3.4 Empty State
When no emails match the current filter:
- Shows "No emails in {folder}." centered
- If account filter is active, shows account names: "No emails in Personal, Work inbox."

### 3.5 Pagination
When `paginate_email` setting is `"1"`:
- Only first 50 threads render initially
- "Load More (N remaining)" button appears at the bottom
- Clicking loads the next 50 threads

---

## 4. QUICK ACTIONS & UNDO SYSTEM

### 4.1 Quick Archive
- Hides card immediately with fade+slide animation (opacity 0, translateX 30px)
- Shows undo countdown toast: "📦 Archived: {subject}"
- On countdown expire: PUTs `archived: true` to the chit
- On undo: restores card with flash animation

### 4.2 Quick Delete
- Same hide animation as archive
- Shows undo countdown toast: "🗑️ Deleted: {subject}"
- On countdown expire: DELETEs the chit (soft-delete)
- On undo: restores card with flash animation

### 4.3 Undo Toast Behavior
- Uses `cwocUndoToast()` from shared-utils.js
- Bottom-center positioned
- Shows countdown progress bar
- "Undo" button cancels the action
- Duration: configurable via `email_undo_send_delay` setting (default 5 seconds)

---

## 5. BULK ACTIONS

### 5.1 Bulk Select All
- Toggles all visible email checkboxes
- Updates the bundle toolbar select-all checkbox state
- Updates the "N selected" count

### 5.2 Bulk Archive
- For each selected email: GET full chit → set `archived: true` → PUT back
- Shows progress toast: "N email(s) archived" or "N archived, M failed"
- Refreshes the email list after completion

### 5.3 Bulk Toggle Read/Unread
- For each selected email: PATCH `/api/email/{id}/read`
- Updates card visual state in-place (adds/removes `email-unread` class)
- Updates unread badge count
- Refreshes bundle tab counts

### 5.4 Bulk Delete
- Confirmation dialog: "Delete N email(s)? They will be moved to Trash."
- For each selected email: DELETE `/api/chits/{id}`
- Shows result toast
- Refreshes email list

### 5.5 Bulk Tag
- Opens a full-screen tag picker modal
- Header: "🏷️ Tag N email(s)"
- Uses the shared `buildTagPicker` component (tree view with search)
- "Apply" button: For each selected email, adds the chosen tags
- ESC or click-outside closes the modal

---

## 6. EMAIL COMPOSE (Editor Email Zone)

### 6.1 Activating Email Mode

Two ways to activate:
1. **Quick-activate button** in the title row: envelope icon that expands on hover to show "Email" label
   - Click activates email mode on any non-email chit
2. **Zone header button**: "✉️ Email" in the email zone header
   - When active: changes to "✕ Email" with teal background (click to deactivate)

Activation behavior:
- Moves email zone to top of column-one
- Expands the zone
- Sets `email_status = "draft"`, `email_folder = "drafts"`
- Populates From field from configured account
- Auto-applies signature to body (if empty)
- Focuses the To field
- Wires autocomplete on To/CC/BCC
- Shows email-specific save buttons (Save Draft, Send, Send & Archive)
- Auto-collapses the Dates zone

### 6.2 Email Zone Fields

#### 6.2.1 From Field (read-only display)
- Shows sender address from configured account: "Display Name <email@example.com>"
- Styled as italic text on dotted border background
- For received emails: shows the original sender
- **Add Contact button** (received emails only): `<i class="fas fa-plus-circle"></i>` next to From
  - Creates a new contact pre-populated with sender's email and name

#### 6.2.2 To Field (with autocomplete + chips)
- Text input with autocomplete dropdown
- **Autocomplete behavior**:
  - Triggers after 2+ characters typed
  - Searches contacts by name and email address
  - Favorites float to the top of results
  - Shows up to 5 results
  - Each result shows: star (if favorite) + display name + email address
  - Arrow keys navigate, Enter selects, ESC closes
  - Already-chipped recipients are excluded from results
- **Chip behavior**:
  - Typing a comma or pressing Enter chipifies the current text
  - On blur: any remaining valid email is chipified
  - **Known contact chips**: Teal background with contact's color, shows profile image + name
  - **Unknown email chips**: Neutral parchment background, shows email address
  - Each chip has a "✕" remove button
  - Chip text color auto-contrasts against background
- **CC/BCC toggle buttons**: Small "CC" and "BCC" buttons next to the To field
  - Click shows/hides the CC or BCC row
  - When field has content, row stays visible and toggle button hides

#### 6.2.3 CC Field
- Same autocomplete + chip behavior as To
- Hidden by default, shown via CC toggle button
- Has a "✕" remove button to re-hide the row

#### 6.2.4 BCC Field
- Same as CC field

#### 6.2.5 Subject Field
- Text input synced bidirectionally with the chit title
- Auto-populates title if title is empty or matches previous subject value

#### 6.2.6 Body Field (Markdown Textarea)
- Multi-line textarea with markdown support
- Placeholder: "Body"
- Min-height: 180px (120px on mobile)
- Font: Lora serif, 14px (16px on mobile to prevent iOS zoom)
- **Live preview**: Below the textarea, a rendered markdown preview updates on input (500ms debounce)
- **Render toggle button**: `<i class="fas fa-eye"></i> Render` / `<i class="fas fa-edit"></i> Edit`
  - Toggles between textarea (edit) and rendered markdown (view)

#### 6.2.7 Formatting Toolbar (in Expand Modal)
Buttons for markdown formatting:
- **B** (Bold) — wraps selection with `**`
- **I** (Italic) — wraps selection with `_`
- **S** (Strikethrough) — wraps selection with `~~`
- **🔗** (Link) — wraps as `[text](url)`
- **H ▾** (Heading dropdown) — H1, H2, H3 options
- **• List** (Bullet list) — prefixes lines with `- `
- **1. List** (Numbered list) — prefixes lines with `1. `
- **❝ Quote** (Blockquote) — prefixes lines with `> `
- **⟨⟩** (Code) — wraps selection with backticks
- **―** (Horizontal rule) — inserts `\n---\n`

#### 6.2.8 Keyboard Shortcuts (Body Textarea)
- `Ctrl+B` → Bold
- `Ctrl+I` → Italic
- `Ctrl+K` → Link
- `Ctrl+E` → Inline code
- `Ctrl+Shift+X` → Strikethrough
- `Ctrl+Shift+8` → Bullet list
- `Ctrl+Shift+7` → Numbered list
- `Ctrl+Shift+.` → Blockquote
- `Ctrl+Shift+1/2/3` → H1/H2/H3
- `Ctrl+Shift+-` → Horizontal rule

### 6.3 Email Action Buttons

#### 6.3.1 Draft Mode Buttons
- **Send** (`emailSendBtn`): Validates To field, saves chit, triggers undo-send countdown
- **Send Later** (`emailSendLaterBtn`): Opens date/time picker modal for scheduled send
- **Discard** (`emailDiscardBtn`): Confirms then soft-deletes the draft (or clears email fields if user-activated)
- **Expand** (`emailExpandBtn`): Opens fullscreen email modal (desktop only, not on mobile ≤768px)
- **PGP** (`emailPgpBtn`): Toggle PGP encryption (only shown when recipients have PGP keys)
  - Active state: green lock icon with "PGP ✓"
  - Inactive state: open lock icon with "PGP"
- **Render toggle** (`email-render-toggle-btn`): Toggle markdown preview

#### 6.3.2 Received Mode Buttons
- **Reply** (`emailReplyBtn`): Creates reply draft and navigates to it
- **Forward** (`emailForwardBtn`): Creates forward draft and navigates to it
- **Expand** (`emailExpandBtn`): Opens fullscreen modal

#### 6.3.3 Sent Mode Buttons
- **Forward** (`emailForwardBtn`): Creates forward draft
- **Expand** (`emailExpandBtn`): Opens fullscreen modal

### 6.4 Email Save Buttons (Replace Normal Save)
When email has content, normal save buttons are hidden and replaced with:

- **Save Draft** (`saveDraftButton`): Always visible when email has any content
- **Send** (`saveSendButton`): Only visible when To + Subject + Body all have content
- **Send & Archive** (`saveSendArchiveButton`): Same visibility as Send; sends then archives the original

### 6.5 Undo-Send Flow
1. User clicks Send (or Send & Archive)
2. PGP encryption runs if enabled (encrypts body in-place before save)
3. Chit is saved via normal save flow
4. Pending send info stored in `localStorage` (`cwoc_email_pending_send`)
5. Page navigates to `index.html?tab=Email`
6. Dashboard picks up the pending send from localStorage
7. Shows `cwocUndoToast` countdown (duration from `email_undo_send_delay` setting, default 5s)
8. If countdown expires: `POST /api/email/send/{chitId}` fires
   - On success: "Email sent successfully." toast
   - If `archiveOriginal`: also `POST /api/email/archive-original` with the In-Reply-To message ID
9. If user clicks Undo: "Send cancelled." toast, nothing happens

### 6.6 Send Later Modal
- Parchment-themed modal with:
  - **Date input** (HTML date picker, min = today)
  - **Time input** (uses `cwocTimePicker` — click to open time wheel, default = now + 1 hour)
  - **"📅 Schedule" button**: Saves chit, then `POST /api/email/schedule/{chitId}` with `{send_at: ISO}`
  - **"Cancel" button**: Closes modal
- After scheduling: navigates to `index.html?tab=Email&sub=scheduled`
- Scheduled emails show a badge in the editor: "⏰ Scheduled: {datetime}" with a "Cancel" button

### 6.7 Reply Behavior
- Checks for existing draft reply (same `email_in_reply_to`) — if found, navigates to it instead
- Creates new chit with:
  - `email_to`: original sender
  - `email_subject`: "Re: " prefix (no doubling)
  - `email_body_text`: "\n\n--- Original Message ---\n" + quoted original body
  - `email_in_reply_to`: original message ID
  - `email_references`: original references + original message ID
  - `email_status`: "draft", `email_folder`: "drafts"
- Navigates to the new draft's editor

### 6.8 Forward Behavior
- Checks for existing forward draft (same normalized subject) — if found, navigates to it
- Creates new chit with:
  - `email_to`: empty (user fills in)
  - `email_subject`: "Fwd: " prefix (no doubling)
  - `email_body_text`: "\n\n--- Forwarded Message ---\n" + original body
  - `email_status`: "draft", `email_folder`: "drafts"
- Navigates to the new draft's editor

### 6.9 Discard Draft Behavior
Two modes:
1. **Original email chit** (loaded from server with email_status):
   - Confirmation: "Discard this draft? It will be moved to Trash."
   - On confirm: `DELETE /api/chits/{id}`, then exits editor
2. **User-activated email** (compose-from-chit):
   - If content exists: confirmation "Discard this email draft?"
   - Clears all email fields, hides email zone
   - If thread exists: keeps zone visible but collapsed with Reply/Forward buttons
   - Does NOT delete the underlying chit

---

## 7. FULLSCREEN EMAIL EXPAND MODAL

Only opens on desktop (>768px). On mobile, the zone already fills the screen.

### 7.1 Modal Layout
- Full viewport minus 1em margin on all sides
- Header row: "✉️ Email" title + action buttons + "Done" button
- Body: From (read-only) + To/CC/BCC fields + Subject + Format toolbar + Body textarea + Live preview

### 7.2 Mode Toggle (Draft Only)
- **Live Preview** (default): Textarea on top, rendered markdown preview below (split view)
- **Edit/Render**: Textarea OR rendered view, with a toggle button to switch

### 7.3 HTML/Text Toggle (Received/Sent Only)
- Pill toggle: "HTML" | "Text"
- HTML mode: renders email_body_html in a sandboxed iframe
  - `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"`
  - All links forced to `target="_blank"`
  - DOMPurify sanitization (strips scripts, forms, iframes, objects)
  - Auto-resizes iframe to content height (200-800px range)
- Text mode: shows plain text in textarea (read-only)

### 7.4 Expand Modal Action Buttons
**Draft mode:**
- Send, Send Later, Send & Archive, Discard (all close modal first, then execute)

**Received mode:**
- Reply, Forward, Download Raw (.eml file)

**Sent mode:**
- Forward, Download Raw

### 7.5 Field Sync
- On "Done" (save=true): copies expand modal field values back to the small zone
  - Body textarea value
  - Subject → title field
  - To/CC/BCC chips synced back
- On dismiss (save=false): no sync, changes in modal are lost

---

## 8. HTML EMAIL RENDERING

### 8.1 Privacy Features

#### 8.1.1 Tracking Pixel Stripping
- Server-side: removes 1x1 and 1x2 pixel `<img>` tags before storing
- Detects by: explicit width/height attributes of 1-2, or inline style with 1px/2px dimensions

#### 8.1.2 External Content Blocking
- Server-side: replaces external image `src` with a transparent 1x1 GIF placeholder
- Stores original URL in `data-original-src` attribute
- Settings control (`email_external_content`): "block", "allow", "known_senders"
- **Blocked content banner**: Shows when images were blocked
  - "🛡️ External images blocked for privacy. [Load External Content]"
  - Button click: restores all `data-original-src` → `src` in the iframe

#### 8.1.3 Read Receipts
- Setting `email_read_receipts`: "never", "always", "ask", "contacts_only"
- Draft compose: checkbox "Request read receipt" (`emailRequestReadReceipt`)
  - When checked: adds `Disposition-Notification-To` header to outgoing email

### 8.2 HTML Sanitization (DOMPurify)
Allowed tags: html, head, body, div, span, p, br, hr, h1-h6, a, img, table, thead, tbody, tr, td, th, ul, ol, li, b, i, u, em, strong, blockquote, pre, code, style, font, center, small, big, sub, sup, dl, dt, dd, abbr, cite, del, ins, mark, s, strike, caption, col, colgroup, details, summary, figure, figcaption, header, footer, main, nav, section, article, aside, address

Forbidden tags: script, iframe, object, embed, form, input, button, select, textarea

---

## 9. EMAIL THREAD VIEW (In Editor)

### 9.1 Thread Section
Appears below the email body when the chit is part of a conversation (>1 related message).

#### 9.1.1 Header
- "🧵 Thread (N messages)"

#### 9.1.2 Simple List (≤3 messages)
- Each thread item shows: sender, date, body preview (100 chars)
- Current message highlighted with teal border/background
- Other messages are clickable → navigate to that email's editor
- Nested chits show with nest icon + title + note preview

#### 9.1.3 Stacked View (>3 messages)
- **Collapsed state**: Visual "stacked parchment" effect
  - 2 background layers (slightly rotated) showing sender names
  - Front card showing: count + "messages in thread" + "▼ Expand"
  - Click anywhere expands
- **Expanded state**: Full scrollable list (max-height 60vh)
  - "▲ Collapse thread" button at top
  - All messages listed chronologically
  - Nested chits interspersed

---

## 10. PGP ENCRYPTION

### 10.1 PGP Toggle Button
- Only shown for drafts when at least one recipient has a PGP public key in their contact record
- Uses `openpgp.min.js` CDN library
- **Enable**: Validates all recipients have keys → enables encryption
- **Disable**: Click again to turn off
- **Recipient change detection**: MutationObserver on chip container + input change listener
  - If PGP was enabled but a new recipient without a key is added → auto-disables with toast

### 10.2 PGP Encryption Flow (Outgoing)
1. User enables PGP toggle
2. On send: `_pgpPreSendEncrypt()` runs before save
3. Reads all recipient public keys from contacts cache
4. Encrypts body using `openpgp.encrypt()` with all recipient keys
5. Replaces textarea value with ASCII-armored ciphertext
6. Marks chit as PGP-encrypted
7. Server sends as plain text only (no HTML alternative) — no signature appended

### 10.3 PGP Decryption (Incoming)
- **Banner**: "🔒 This message is PGP encrypted. [🔓 Decrypt]"
- **Decrypt button** click:
  1. Shows password modal (parchment-themed): "Enter your account password to unlock your private PGP key."
  2. `POST /api/auth/private-pgp-key` with password → returns private key
  3. Decrypts key (if passphrase-protected, uses account password)
  4. Decrypts message body with `openpgp.decrypt()`
  5. Displays decrypted text in-place (textarea becomes read-only)
  6. Banner updates: "🔓 Message decrypted (view only — not saved)."
  7. Original ciphertext stored in `data-pgp-original` — never saved as decrypted

---

## 11. EMAIL ATTACHMENTS

### 11.1 In Email List Cards
- Attachment thumbnails appear inline in the card content row
- Image attachments: actual thumbnail image (lazy loaded)
- Non-image: file type emoji + filename
- Click: preview modal (`cwocAttachmentPreview`)
- Shift+Click: direct download
- Right-click: context menu with "View" and "Download"

### 11.2 In Editor (Attachment Bar)
- Rendered at the bottom of the email body field
- Shows all attachments as clickable chips: icon/thumbnail + filename + size
- Same click/shift-click/right-click behavior as list cards
- Email-origin attachments in the Attachments zone get a left border + ✉ indicator

### 11.3 Attachment Context Menu
- Fixed-position floating menu at click coordinates
- Options: "👁 View" and "⬇ Download"
- Closes on click-outside or another right-click

---

## 12. AUTO-CHECK MAIL

### 12.1 Configuration
- Setting: `check_interval` on the email account (shared across accounts)
- Values: "manual" (no auto-check), or minutes: "5", "15", "30", "60"

### 12.2 Behavior
- Timer starts 3 seconds after page load
- Calls `_checkMail()` at the configured interval
- Same behavior as manual Check Mail button (spinners, toasts, error handling)

---

## 13. SETTINGS — EMAIL TAB

### 13.1 Email Accounts Section

- **Account summary**: Shows pill chips for each configured account email
- **"Manage Accounts" button**: Opens the accounts modal

#### 13.1.1 Accounts Modal — List View
- Shows all configured accounts as clickable items
- Each item: 📧 icon + nickname/email + server info + "›" arrow
- "Add Account" button at the bottom

#### 13.1.2 Accounts Modal — Edit View
Fields for each account:
- **Nickname** (text input, e.g., "Work", "Personal")
- **Email Address** (text input)
- **Display Name** (text input)
- **Username** (text input, autocomplete off)
- **Password** (password input with 👁️ toggle button)
  - Hint: "For Gmail, use an App Password..."
- **IMAP Host** (text, default "imap.gmail.com")
- **IMAP Port** (number, default 993)
- **IMAP Security** (select: SSL/TLS, STARTTLS, None)
- **SMTP Host** (text, default "smtp.gmail.com")
- **SMTP Port** (number, default 587)
- **SMTP Security** (select: STARTTLS, SSL/TLS, None)
- **"🔌 Test Connection" button** + result span
  - Tests both IMAP and SMTP independently
  - Shows: "✅ IMAP & SMTP connected" or individual results with ❌
- **"Back" button**: Returns to list view
- **"Delete" button**: Confirms then removes the account

### 13.2 Shared Sync Settings
- **Max Pull** (number input, default 50): Maximum emails to fetch per sync
- **Check Interval** (select): Manual, 5 min, 15 min, 30 min, 60 min
- **Signature** (hidden textarea + inline preview + "✍️ Edit Signature" button)

#### 13.2.1 Signature Editor Modal
- Full-height modal with:
  - Textarea (top half): markdown input with Ctrl+B/I/K shortcuts
  - Preview (bottom half): live-rendered markdown (500ms debounce)
  - "✅ Done" and "✕ Cancel" buttons
  - ESC closes without saving

### 13.3 Email Privacy Settings
- **Block Tracking Pixels** (checkbox, default checked)
- **External Content** (select: "Allow", "Block", "Known Senders Only")
- **Read Receipts** (select: "Never", "Always", "Ask", "Contacts Only")
- **Undo Send Delay** (number input, default 5 seconds)

### 13.4 Email Display Settings
- **Group By** (select: "Date" or "None")
- **Paginate Email** (checkbox): Show 50 per page with "Load More"

### 13.5 Bundle Settings
- **Bundles Enabled** (checkbox): Show/hide bundle tabs
- **Multi-Placement** (checkbox): Allow emails in multiple bundles
- **Show Count** (select: "Both", "Unread Only", "Total Only", "None")
- **Auto-Bundle Toggles**: Checkboxes for each auto-bundle (Newsletters, Receipts, Calendar Invites)
  - Each shows name + description
  - Toggle enables/disables the auto-bundle

### 13.6 Backfill
- **"📥 Backfill" button**: Estimates mailbox size, confirms, then syncs all
  - Step 1: `POST /api/email/backfill-estimate` → shows "~N messages (~M MB)"
  - Step 2: Confirmation dialog
  - Step 3: `POST /api/email/sync` with backfill flag
  - Result: "✅ N imported" or error

---

## 14. WHAT THE ANDROID APP CURRENTLY HAS vs. WHAT'S MISSING

### Currently Implemented (Android):
1. ✅ Email tab with unread badge
2. ✅ Folder filter chips (Inbox, Sent, Drafts, Scheduled, Trash, Archived)
3. ✅ Bundle tabs row (placeholder "All" only)
4. ✅ Thread grouping logic (Message-ID/In-Reply-To/References + subject fallback)
5. ✅ Thread card with: unread dot, sender name, reply indicator, subject, attachment icon, preview snippet, date, tag chips
6. ✅ Thread expansion (animated, shows all messages)
7. ✅ Swipe-to-dismiss (archive right, delete left)
8. ✅ Compose FAB (navigates to editor)
9. ✅ EmailViewModel with folder filtering, threading, mark-as-read, archive, trash
10. ✅ EmailComposeZone (basic From/To/CC/BCC/Subject/Body fields + Send/Send Later/Discard)
11. ✅ Reply/Forward creation (in ViewModel)

### MISSING from Android (everything below must be implemented):

#### List View / Cards:
1. ❌ **Contact profile images** on email cards (circular avatar from contacts/users, or initial letter fallback)
2. ❌ **Checkbox multi-select** (with shift-click range selection on desktop, long-press on mobile)
3. ❌ **Pin button** (bookmark icon toggle on each card)
4. ❌ **Status badges** (Draft/Sent inline badges)
5. ❌ **Reply indicator** (fa-reply icon when user has replied to this email)
6. ❌ **Body preview** with full HTML/markdown stripping, URL removal, zero-width char removal
7. ❌ **Attachment thumbnails** inline on cards (image previews, file type icons)
8. ❌ **Smart link badges** (tracking numbers, flights, hotels, etc.)
9. ❌ **Hover action buttons** (Archive, Delete, Mark Unread) — on mobile these could be swipe actions or long-press menu
10. ❌ **Tag chips** with custom colors on email cards (up to 3 + overflow count)
11. ❌ **Date formatting** honoring 12/24h setting, "Yesterday", "Mon DD" format
12. ❌ **Custom chit colors** applied to email cards with contrast-safe text
13. ❌ **Undo toast** for archive/delete (currently just immediately executes)
14. ❌ **Flash animation** on card restore after undo
15. ❌ **Date group headers** (Today / Yesterday / Last Week / Older)
16. ❌ **Pagination** (Load More button after 50 threads)
17. ❌ **Empty state** with account filter context ("No emails in Personal inbox.")
18. ❌ **Thread ribbon** (vertical bar on left of threaded cards)
19. ❌ **Thread count badge** (clickable inline badge showing message count)
20. ❌ **Nested chit cards** within threads (nest icon, title, content preview, date)

#### Bundle System:
21. ❌ **Real bundle tabs** from API data (currently just "All" placeholder)
22. ❌ **Bundle unread/total count badges** on tabs
23. ❌ **Bundle tab colors** (custom background per bundle)
24. ❌ **Bundle filtering** (clicking a tab filters emails to that bundle)
25. ❌ **Priority arrows** between tabs (single-placement mode)
26. ❌ **Bundle context menu** (long-press: Edit, Disable, Delete)
27. ❌ **Bundle drag-to-reorder**
28. ❌ **Create Bundle modal** (name, description, color, Omni View checkbox)
29. ❌ **Edit Bundle modal**
30. ❌ **Dimmed state** when not in inbox sub-filter

#### Bulk Actions Toolbar:
31. ❌ **Select All checkbox** in toolbar
32. ❌ **Bulk Archive button**
33. ❌ **Bulk Tag button** (with tag picker)
34. ❌ **Bulk Read/Unread button**
35. ❌ **Bulk Delete button** (with confirmation)
36. ❌ **Selected count display**
37. ❌ **Button active/inactive states** based on selection

#### Sidebar / Controls:
38. ❌ **Check Mail button** with sync animation (spinning icon, pill spinners)
39. ❌ **Account filter pills** (per-account toggle with error/success states)
40. ❌ **Unread-at-top toggle**
41. ❌ **Auto-check mail timer** (background periodic sync)

#### Compose / Editor:
42. ❌ **Contact autocomplete** on To/CC/BCC fields (search contacts, arrow key nav, favorites first)
43. ❌ **Recipient chips** with contact images, colors, and remove buttons
44. ❌ **Known vs. unknown chip styling** (teal for known contacts, neutral for unknown)
45. ❌ **Markdown formatting toolbar** (Bold, Italic, Strikethrough, Link, Headings, Lists, Quote, Code, HR)
46. ❌ **Keyboard shortcuts** for formatting
47. ❌ **Live markdown preview** below body textarea
48. ❌ **Render toggle** (edit ↔ rendered view)
49. ❌ **Email signature** auto-applied to new drafts
50. ❌ **Subject ↔ Title sync**
51. ❌ **Undo-send flow** (countdown toast before actual send)
52. ❌ **Send & Archive** action
53. ❌ **Send Later modal** (date + time picker → schedule)
54. ❌ **Scheduled send indicator** in editor with Cancel button
55. ❌ **PGP encryption toggle** (check recipient keys, encrypt body)
56. ❌ **PGP decryption** (password modal → decrypt in-place, view-only)
57. ❌ **HTML email rendering** (sandboxed WebView with DOMPurify-equivalent sanitization)
58. ❌ **HTML/Text toggle** for received emails
59. ❌ **External content blocking** with "Load External Content" button
60. ❌ **Tracking pixel stripping** indicator
61. ❌ **Read receipt request** checkbox (drafts)
62. ❌ **Download Raw .eml** button
63. ❌ **Add sender as contact** button
64. ❌ **Email thread view** in editor (stacked parchment for >3, simple list for ≤3)
65. ❌ **Thread collapse/expand** in editor
66. ❌ **Attachment bar** at bottom of email body (chips with thumbnails)
67. ❌ **Attachment preview modal** (click to view, shift-click to download)
68. ❌ **Email-specific save buttons** (Save Draft / Send / Send & Archive replacing normal save)
69. ❌ **Deactivate email mode** (clear fields, hide zone, restore normal save)
70. ❌ **Existing draft detection** (reply/forward checks for existing draft before creating new)

#### Settings:
71. ❌ **Multi-account management modal** (list view + edit view per account)
72. ❌ **Test Connection** per account (IMAP + SMTP independently)
73. ❌ **Signature editor** (markdown textarea + live preview)
74. ❌ **Privacy settings** (tracking pixels, external content, read receipts, undo delay)
75. ❌ **Display settings** (group by, paginate)
76. ❌ **Bundle settings** (enabled, multi-placement, show count, auto-bundle toggles)
77. ❌ **Backfill** (estimate + confirm + sync)

---

## 15. API ENDPOINTS USED BY EMAIL CLIENT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/email/sync` | Fetch new emails from all IMAP accounts |
| POST | `/api/email/send/{chit_id}` | Send a draft email via SMTP |
| POST | `/api/email/schedule/{chit_id}` | Schedule/cancel a send-later |
| GET | `/api/email/thread/{chit_id}` | Get conversation thread for an email |
| GET | `/api/email/threads/recent` | Get 20 most recent threads (for nest picker) |
| POST | `/api/email/archive-original` | Archive the replied-to email by Message-ID |
| PATCH | `/api/email/{chit_id}/read` | Toggle read/unread state |
| GET | `/api/email/{chit_id}/raw` | Download reconstructed .eml file |
| POST | `/api/email/test-connection` | Test IMAP + SMTP connectivity |
| POST | `/api/email/backfill-estimate` | Estimate mailbox size for backfill |
| GET | `/api/bundles` | Get all bundles for the user |
| POST | `/api/bundles` | Create a new bundle |
| PUT | `/api/bundles/{id}` | Update a bundle |
| DELETE | `/api/bundles/{id}` | Delete a bundle |
| PUT | `/api/bundles/reorder` | Reorder bundle display order |
| POST | `/api/bundles/reclassify` | Re-run classification on all emails |
| POST | `/api/bundles/{id}/disable` | Disable an auto-bundle |
| POST | `/api/auth/private-pgp-key` | Fetch private PGP key (password-protected) |
| GET | `/api/contacts` | Get contacts for autocomplete + image lookup |
| GET | `/api/auth/switchable-users` | Get users for sender image lookup |
| GET/PUT | `/api/chits/{id}` | Read/update chit (for archive, tag, pin) |
| DELETE | `/api/chits/{id}` | Soft-delete a chit |
| POST | `/api/chits` | Create new chit (reply/forward drafts) |
| GET | `/api/chit/{id}` | Get single chit (for bulk operations) |
| GET | `/api/chits/{id}/attachments/{att_id}` | Download/preview attachment |

---

## 16. DATA MODEL — EMAIL FIELDS ON CHIT

| Field | Type | Description |
|-------|------|-------------|
| `email_message_id` | TEXT | RFC 2822 Message-ID |
| `email_from` | TEXT | Sender "Name <email>" |
| `email_to` | TEXT (JSON array) | Recipients |
| `email_cc` | TEXT (JSON array) | CC recipients |
| `email_bcc` | TEXT (JSON array) | BCC recipients |
| `email_subject` | TEXT | Subject line (also mapped to title) |
| `email_body_text` | TEXT | Plain-text body |
| `email_body_html` | TEXT | HTML body for rich rendering |
| `email_date` | TEXT (ISO 8601) | Date from email Date header |
| `email_folder` | TEXT | "inbox", "sent", "drafts", "trash" |
| `email_status` | TEXT | "draft", "sent", "received" |
| `email_read` | BOOLEAN | Read/unread state |
| `email_in_reply_to` | TEXT | In-Reply-To Message-ID |
| `email_references` | TEXT | References header (space-separated) |
| `email_account_id` | TEXT | Which account this email belongs to |
| `email_send_at` | TEXT (ISO 8601) | Scheduled send time |
| `email_request_read_receipt` | BOOLEAN | Request MDN when sending |
| `attachments` | TEXT (JSON array) | [{id, filename, size, mime_type, uploaded_at}] |
| `nest_thread_id` | TEXT | ID of email chit this is nested into |
| `pinned` | BOOLEAN | Pinned to top of list |
| `archived` | BOOLEAN | Archived (hidden from inbox) |

---

*End of spec. Every element described above exists in the web mobile implementation and must be reproduced in the Android app for full parity.*
