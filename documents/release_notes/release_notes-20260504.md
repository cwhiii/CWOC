# 20260504 Highlights

- Email editor expand modal (full viewport)
- Birthday/Anniversary calendar entries from contacts
- Email CC/BCC support

---

## 20260504.2159

## v20260504.2159 — Birthday chip styling matches sidebar people chips

Birthday calendar entries now render with the same rounded pill chip style as the sidebar people filter chips (border, background, font). The 🎂 cake icon is positioned to the left of the chip rather than inside it.

## 20260504.2154

## v20260504.2154 — Fix birthday endpoint route ordering

Moved `/api/contacts/birthdays` endpoint before `/api/contacts/{contact_id}` routes so FastAPI doesn't match "birthdays" as a contact_id parameter. Birthday entries now actually return data and display on the calendar with person chip styling.

## 20260504.2152

## v20260504.2152 — Birthday calendar entries now display person chip

Birthday/anniversary events on the calendar now render as a styled person chip with the contact's thumbnail image (when available), rather than plain title text. The chip has a rounded pill style with the 🎂 emoji, name, date label, and age.

## 20260504.2150

## v20260504.2150 — Fix "leave page" warning after saving contact

Fixed a pre-existing bug where the contact editor's `beforeunload` warning would fire after saving because `markSaved()` was only called after a 1500ms delay. Now the dirty flag is cleared immediately on successful save, preventing the spurious "leave page" confirmation dialog.

## 20260504.2145

## v20260504.2145 — Birthday/Anniversary Calendar Entries

Contact dates (birthdays, anniversaries, etc.) now generate annual all-day events on the calendar. Each date entry in the contact editor has a calendar icon toggle (default: on) to control visibility. Birthday events display the person's name and age, appear in all calendar views, and are included in search results. Double-clicking a birthday event opens the contact editor for that person.

## 20260504.2028

Completed the Obsidian-style token-level live preview engine for the Notes and Email body editors. The system renders all inline markdown as formatted HTML except the specific token the cursor touches, which reveals its raw syntax for editing. Supports three cycling modes (Source → Live Preview → Reading), a format toolbar with keyboard shortcuts (Ctrl+B/I/K/E, Ctrl+Shift+X/1/2/3/7/8/./-), Enter/Backspace line splitting/merging, paste handling, mobile touch support with virtual keyboard awareness, and full reuse for the Email body editor with independent state.

## 20260504.2006

Added email body live preview with Obsidian-style token-level editing. The email body now supports the same three-mode cycling (Source → Live Preview → Reading) as the Notes zone, with its own format toolbar, cursor tracking, and independent state. Reuses the shared tokenizer/parser/builder from the notes engine.

## 20260504.1903

Added spacing below the maps "Go to" search bar to match the Create button's bottom margin.

## 20260504.1901

Refined the maps "Go to" search bar: removed the label (placeholder now reads "Go to…"), styled the button to match the Create Chit button color, and made the input+button row the same width as the Create button.

## 20260504.1900

Fixed completed tasks appearing greyed out with forced grey background instead of showing their actual chit color. Removed `!important` color/background overrides from `.completed-task` CSS so that completed tasks now display their real color at reduced opacity rather than being forced to a flat grey.

## 20260504.1858

Added a "Go to" search field in the maps sidebar directly below the Create Chit button. Typing an address or city and pressing Enter (or the search icon) geocodes the location and flies the map to it.

## 20260504.1849

Replace browser's native "Leave site?" dialog with a CWOC-styled modal when refreshing the chit editor or contact editor with unsaved changes. Keyboard refresh shortcuts (Cmd+R, Ctrl+R, F5) now show a parchment-themed modal with Cancel, Save & Refresh, and Discard & Refresh options. The native dialog remains as a fallback for browser-button refresh and tab close.

## 20260504.1843

Removed the border around the notes format toolbar and email format toolbar containers. Individual button borders remain unchanged.

## 20260504.1837

Fixed hotkeys on Maps page: instead of disabling Leaflet keyboard entirely, added a capture-phase listener that re-dispatches key events to the document so both CWOC hotkeys and Leaflet's arrow/zoom keyboard navigation work simultaneously.

## 20260504.1836

"Append to Notes" now only appends incomplete (unchecked) checklist items. Completed items are skipped.

## 20260504.1835

Fixed hotkeys not working on the Maps page by disabling Leaflet's built-in keyboard handler which was stopping event propagation and preventing CWOC hotkeys from firing.

## 20260504.1834

Browser refresh/close now prompts "Leave site?" when there are unsaved changes in the chit editor or contact editor. Prevents accidental data loss from F5/Cmd+R/closing the tab.

## 20260504.1830

Added M hotkey to navigate to the Map page from all secondary pages, and from the dashboard (plain M = Map, Shift+M = Mode panel which was previously on plain M).

## 20260504.1829

Checklist↔Note append buttons now show an 8-second undo countdown bar (matching the checklist clear pattern). Both operations auto-expand the target zone when collapsed. Undo restores the previous state cleanly.

## 20260504.1826

Attachments are now fully staged: uploads are rolled back if you exit without saving, deletes don't take effect until you save. Fixed archived chits not being properly filtered in checklist view (API now returns pinned/archived as proper booleans). Swapped checklist↔note buttons to correct positions: "Append to Notes" on checklist zone, "Append to Checklist" on notes zone.

## 20260504.1818

Attachment drag-drop now works on the zone header (auto-expands when collapsed). Uploading/deleting attachments marks the editor as unsaved instead of silently saving. Fixed auto-archive button styling to match manual archive. Swapped checklist↔note conversion buttons to correct zones: "Append to Notes" on checklist zone, "Append to Checklist" on notes zone.

## 20260504.1706

Multi-feature update: Pruning now enabled by default for new users. Export-all strips sensitive fields (email passwords, encrypted credentials). Added Busy/Free/"-" availability field to chits (Task zone, iCal TRANSP support). Habit charts now render crisply on HiDPI displays via devicePixelRatio canvas scaling. Habit notifications now fire from any page (not just the editor). Checklist auto-complete/auto-archive button marks chit Complete when all items checked. Bidirectional checklist ↔ note conversion (additive, non-destructive). Admin password reset now invalidates target user sessions. Tailscale auth keys encrypted at rest with Fernet. Admin can update usernames via Edit User modal (was already wired but now confirmed working).

## 20260504.1640

Added 3em right margin on the email subject column to create clear visual separation from the body preview.

## 20260504.1638

Moved the replied-to icon from the badges area to a fixed-width slot between sender name and subject. Emails without a reply get an equal-width empty spacer so all columns stay aligned.

## 20260504.1636

Email view: improved text contrast on read emails (darker sender/subject/preview colors, reduced opacity from 0.7→0.85), applied contrastColorForBg to email card text when custom chit colors are set, and added the parchment background image to the email scroll area.

## 20260504.1634

Extracted hotkey dispatch into shared-hotkeys.js — a single file loaded by every page. Tab keys (C, H, A, P, T, N, E, I, G) and action keys (K, S, W, L, R) now work universally. On the dashboard they call filterChits() directly; on secondary pages (maps, weather, contacts, etc.) they navigate to the dashboard with the target tab pre-selected via cwoc_jump_tab. Change the key map once, it applies everywhere.

## 20260504.1632

Aligned weather page time period options to match the calendar/dashboard labels (Day, Work Hours, Week, X Days, Month, Year). Replaced "Itinerary" with "1 Hour" and kept "Forecast Max (16 day)" as the last option.

## 20260504.1625

Added W hotkey support to secondary pages (maps, weather, contacts, etc.) via shared-page.js. Pressing W now navigates to the Weather page from any page, matching the dashboard behavior.

## 20260504.1622

Reordered the time period dropdown options from shortest to longest window across all views (dashboard, weather, maps), and renamed the sidebar label from "Period" to "Time Period."

## 20260504.1621

Swapped W and Shift+W hotkeys: W now opens the full Weather page, Shift+W opens the quick weather modal. Sidebar click/Shift+click behavior updated to match. Help page and reference overlay updated.

## 20260504.1616

Darkened email attachment chip background for better contrast and added a hint of HST gold (#d4af37) on hover.

## 20260504.1615

Added three new time period options (Next Hour, Today, Next X Days) to the map and weather page dropdowns. Renamed map page period labels from "This Week/Month/Quarter/Year" to shorter "Week/Month/Quarter/Year".

## 20260504.1613

Fixed email card hover layout shift. Date is now absolutely positioned to the far right and never moves. Hover action buttons are absolutely positioned to the left of the date (1em gap). Preview uses `visibility: hidden` instead of `display: none` on hover so it doesn't cause reflow. Content area has right padding to reserve space for the date.

## 20260504.1611

Subject column widened to 300px. Hover actions now have a 1em gap to the left of the date, and the date stays pinned in place (fixed min-width, right-aligned) so it never shifts when action buttons appear.

## 20260504.1608

Redesigned email cards to a single-row layout: sender name (bold, fixed 160px), subject (slightly smaller, fixed 200px, truncated with tooltip on hover), body preview (fills remaining space), hover actions (appear to the left of the date), and date (small, fixed right). Preview hides on hover to make room for action buttons. New mail triggers a prominent 📬 toast notification with 5-second duration.

## 20260504.1601

Redesigned email card layout. Sender name is now the primary element (bold, dark, 1em — old subject style). Subject sits below it in a slightly smaller, muted brown. Body preview moved to the right column in a grid layout (like habit note previews). Date/time is larger and bolder. Badges (Draft/Sent/Replied) sit above the grid. On mobile the grid collapses to single column.

## 20260504.1555

Added contrast to the email view: scroll area gets a subtle warm tint background, email cards get a solid cream (#fdf5e6) so they stand out from the surrounding area.

## 20260504.1553

Fixed account filter pills crashing when clicked (filterChits called without tab parameter). Cleaned up email card display: removed "From:" prefix, shows sender display name only with full email on hover, strips CSS rules and invisible Unicode characters (&#847;, &#8204; zero-width joiners) from body previews.

## 20260504.1420

Fixed email account nickname tags not appearing on existing emails. Sync now backfills the `CWOC_System/Email/Account/{nickname}` tag onto all email chits belonging to each account, and assigns orphan emails (synced before multi-account) to the first account. Sidebar account pills now wait for settings to load before rendering.

## 20260504.1402

Email account nicknames now use system tags (`CWOC_System/Email/Account/{nickname}`) instead of a custom badge. This means account names show up in the tag tree, work with the rules engine, and are filterable via the standard tag infrastructure. Added multi-select account filter pill buttons in the Email sidebar above the Folder section — click to toggle which accounts' emails are shown. Empty selection shows all.

## 20260504.1355

Added SSL/TLS security options, nickname field, and account badge to email. Each email account now has IMAP Security (SSL/TLS, STARTTLS, None) and SMTP Security (STARTTLS, SSL/TLS, None) dropdowns. Added a Nickname field per account (e.g. "Work", "Personal"). The Email view now shows the account nickname as a badge on each message card so you can see which account a message came from. OAuth2 is noted as not currently supported.

## 20260504.1350

Updated email account delete confirmation to use a styled modal matching the chit editor's delete dialog — same structure, classes, and styling (modal-title, modal-message, modal-button-danger "Nuke Account!", modal-button-cancel "Keep Account"). Message shows "Email [username] on [IMAP host]".

## 20260504.1343

Restructured email accounts UI to use a "Manage Email Accounts" button that opens a modal. The modal shows a list of configured accounts as clickable items. Clicking an account opens its edit form within the same modal where you can modify or delete it. An "Add Account" button in the modal lets you add new accounts. ESC key properly navigates back through the modal layers.

## 20260504.1335

Email deletion sync: when you delete an email in Gmail (or any IMAP provider), the deletion now propagates to CWOC on the next mail check. The sync compares local inbox email chits against the IMAP server by Message-ID and soft-deletes any that are no longer present. The check-mail toast and settings sync status now show both new and removed counts.

## 20260504.1329

Multi-account email support. You can now add an arbitrary number of email accounts in Settings → Email → Accounts, each with its own IMAP/SMTP server configuration (including third-party providers like Gmail, Outlook, Yahoo, or any custom IMAP server). Syncing settings (max pull, check interval) and email signature are shared across all accounts. Existing single-account configurations are automatically migrated.

## 20260504.1216

Replaced the plain text input for add_tag and remove_tag actions in the rule editor with a tag picker dropdown that shows existing tags from user settings, with colored dots, favorite stars, and type-to-filter search.

## 20260504.1208

— Rules Engine Fixes

Fixed critical bug where rules engine triggers never fired. The `dispatch_trigger` function was async but called from synchronous FastAPI endpoints via `asyncio.get_event_loop().create_task()`, which silently fails from threadpool threads. Converted to synchronous function with `threading.Thread` for fire-and-forget execution. Added comprehensive logging throughout the dispatch pipeline. Moved rule editor save buttons to the header bar matching the chit editor pattern.

## 20260504.1206

Fixed critical bug where rules engine triggers silently failed because `dispatch_trigger` was async but called from sync FastAPI endpoints via `asyncio.get_event_loop().create_task()` in a threadpool. Converted `dispatch_trigger` to a synchronous function and switched all call sites (chits, contacts, email) to use `threading.Thread` for fire-and-forget dispatch. Moved rule editor save buttons from the bottom of the page into the header row to match the chit editor pattern. Added comprehensive logging to `dispatch_trigger` and all trigger call sites for traceability.

## 20260504.1151

## CWOC Release 20260504.1151

Email body preview now strips raw URLs (http/https links) that were cluttering the preview text, especially from marketing emails where HTML-to-text conversion left tracking URLs intact.

## 20260504.1145

## CWOC Release 20260504.1145

Email view polish: Select All now uses a native checkbox matching the row checkboxes for visual consistency, positioned at the far left of the bulk bar. From field expanded from 300px to 500px max-width and allowed to wrap so multiple addresses aren't cut off. Subjects now strip markdown link syntax (showing just the link text, not URLs) via new `_emailStripMarkdown` helper. Body preview also strips markdown in addition to HTML. Scoped bulk bar checkbox queries to avoid conflicts with the Select All checkbox.

## 20260504.1141

— Rules Engine

Added "if this, then that" automation via a new Rules Engine. Users define rules with triggers (chit created, chit updated, email received, contact created/updated, scheduled), boolean condition trees (AND/OR groups with 14 operators including regex and contact cross-references), and actions (add/remove tags, set status/priority/severity/color/location, add person, archive, trash, share, assign, send notification, mark email read/unread, move email to folder, add matching contacts as people). Rules fire in priority order with an optional confirmation safety net. Includes a Rules Manager page (🤖 sidebar button, F10 hotkey) for listing, toggling, reordering, and deleting rules, plus a Rule Editor page with a visual condition tree builder and action configurator. Scheduled rules run via a background loop every 60 seconds. Full execution logging and audit trail integration.

## 20260504.1138

## CWOC Release 20260504.1138

Email view fixes: body preview now strips residual HTML tags for clean plain-text display, Select All button moved to the left of the bulk bar with a checkbox icon that toggles between checked/unchecked states, and shift+click on checkboxes now does range selection (select/deselect all between last clicked and current). Removed the old shift+click-to-toggle-read behavior on email cards.

## 20260504.1129

## CWOC Release 20260504.1129

Added a gold flash animation to email cards restored by the undo action, making it immediately obvious which message was untouched.

## 20260504.1124

## CWOC Release 20260504.1124

Fixed false-positive "Replied" badges on emails — now only shows when the user has actually sent or drafted a reply, not when incoming emails happen to have In-Reply-To headers. Added undo countdown timer (10s with progress bar) for email archive and delete hover actions, matching the checklist undo pattern.

## 20260504.1103

## CWOC Release 20260504.1103

Added email list enhancements: replied badge (shows when a message has been responded to), hover action buttons (archive, delete, mark unread) that appear on the right side when hovering over a message, and a stronger visual highlight on the hovered email card. Action buttons are always visible on mobile.

## 20260504.0938

Updated the Help page Email section with full documentation of the email formatting shortcuts, expanded editor, signature, Send & Archive, and all recent email features.

## 20260504.0934

Reverted Contact badge and vault toggle positioning back to the simple centered layout — align-self:center, 3px gap, no absolute positioning or margin hacks.

## 20260504.0931

Repositioned Contact badge and vault toggle using absolute positioning inside the profile-image-area. Both elements are fully inside the box. The profile area has extra bottom padding to accommodate the toggle below the h2 border-bottom (the HR line).

## 20260504.0925

Fixed Contact badge and vault toggle positioning — both elements are vertically centered inside the header box with align-self:center, with a 0.5em gap between them. The gap aligns with the HR line on the left. No elements extend outside the box.

## 20260504.0920

Fixed Contact badge / vault toggle positioning — badge area uses align-self:flex-end with position:relative;top:16px to straddle the profile area border. Contact badge above the line, vault toggle below. Profile area overflow set to visible with increased margin-bottom to accommodate.

## 20260504.0917

Repositioned Contact badge and vault toggle so the Contact badge sits above the profile area border and the vault toggle sits below it, with a small gap between them straddling the line.

## 20260504.0916

Every email formatting action now has a keyboard shortcut, working in both the small zone and expanded editor:

- Ctrl+B → Bold
- Ctrl+I → Italic
- Ctrl+K → Link
- Ctrl+E → Inline Code
- Ctrl+Shift+X → Strikethrough
- Ctrl+Shift+8 → Bullet List
- Ctrl+Shift+7 → Numbered List
- Ctrl+Shift+. → Blockquote
- Ctrl+Shift+1 → Heading 1
- Ctrl+Shift+2 → Heading 2
- Ctrl+Shift+3 → Heading 3
- Ctrl+Shift+- → Horizontal Rule

All toolbar button tooltips updated to show their hotkey.

## 20260504.0914

Positioned the Contact badge and vault toggle to straddle the profile area border — badge sits above the line, toggle sits below it, with a small 6px gap between them. Both are separate rounded elements at the same width.

## 20260504.0913

Styled the Contact badge and vault pill toggle as a stacked unit — badge stretches to match the pill width, they share a border between them (badge has rounded top corners, pill has rounded bottom corners), and the dividing line aligns with the profile area border.

## 20260504.0912

Full keyboard shortcuts for all email formatting actions, working in both the small zone and expanded editor:
- Ctrl+B → Bold, Ctrl+I → Italic, Ctrl+K → Link
- Ctrl+Shift+X → Strikethrough (new)
- Ctrl+Shift+8 → Bullet list
- Ctrl+Shift+7 → Numbered list

Added strikethrough support: ~~text~~ renders as strikethrough in preview and sent HTML. New S̶ button in the expanded editor toolbar. Backend _markdown_to_html converts ~~text~~ to del tags.

## 20260504.0909

Ctrl+B/I/K formatting shortcuts now work in the small (non-expanded) email body textarea too. The _emailFormatBtn function accepts an optional textarea ID parameter so it can target either the small zone or expand modal textarea.

## 20260504.0907

Formatting toolbar buttons now require selected text for Bold, Italic, Link, Code, and Blockquote — clicking without a selection does nothing. List buttons (bullet and numbered) prefix the current line with `- ` or `1. ` even without selection. Headings apply to the current line. Horizontal rule always inserts.

## 20260504.0904

Fixed the expand modal preview being pushed below the visible area. The textarea and preview now share the space equally (both flex:1) — textarea on top for editing markdown, rendered preview on bottom showing the HTML output. Preview always shows (with placeholder text when empty) so the user can see the rendered signature immediately.

## 20260504.0903

Fixed DOM error on People page — vault icon was using insertBefore on a node that hadn't been appended to the row yet. Changed to appendChild so the icon is added in the correct order (after thumbnail, before info column).

## 20260504.0900

Improved the unsaved changes prompt when leaving the editor. Now offers four options: Cancel (stay), Save as Draft (for email drafts), Save & Exit, and Discard. The Save as Draft option only appears when the chit has email content. Discard button is styled in danger red. This applies to all exit paths: Exit button, ESC key, and browser back.

## 20260504.0858

Email formatting toolbar: Heading button is now a dropdown with H1, H2, H3 options. Added numbered list button (1. List). Blockquote button now uses ❝ Quote for better readability. Backend _markdown_to_html now supports ordered lists (1. item → ol/li).

## 20260504.0854

Added a markdown formatting toolbar to the expanded email editor. Buttons for Bold, Italic, Link, Heading, Bullet List, Blockquote, Code, and Horizontal Rule. Each applies to the selected text (or inserts placeholder text). Ctrl+B/I/K keyboard shortcuts also work in the expand textarea. Toolbar only appears for draft emails, not received/sent.

## 20260504.0853

Fixed "Failed to load contacts" error caused by the GET /api/contacts query referencing the `shared_to_vault` column before the migration had run. The endpoint now checks for column existence via PRAGMA table_info before using it in the WHERE clause, gracefully falling back to owner-only queries if the column doesn't exist yet.

## 20260504.0851

Fixed vault pill toggle in contact editor — now uses the exact same `_initPillToggle`/`_updatePillToggle` pattern as the settings page Man/Woman and Imperial/Metric toggles. Sized the Contact badge and vault toggle to match at 0.8em.

## 20260504.0847

Added a 🏛️ vault icon on each shared contact row in the People (Rolodex) page. The icon appears between the thumbnail and the name for any contact shared to the vault, whether it's your own or from another user.

## 20260504.0846

Moved the Contact Vault toggle from a separate zone into the contact editor header, directly below the "Contact" badge as a matching-size pill toggle (🔒 Private / 🏛️ Vault). Restyled all slider toggles on the contact editor page to use the brown pill toggle color palette (active: #8b5a2b, inactive: #f5e6cc) for visual consistency.

## 20260504.0831

Added shared Contact Vault feature. Contacts can now be shared with all users on the server via a "Share to Vault" toggle in the contact editor. Vault contacts from other users appear in a dedicated "🏛️ Contact Vault" section on the People page and are read-only. A per-user default setting in Settings → General → Contact Vault controls whether new contacts are shared by default.

## 20260504.0827

Added live markdown preview for email compose. Draft emails now show a rendered HTML preview below the textarea that updates as you type (debounced 500ms). The expand modal gets the same preview. On send, the backend converts the full markdown body to proper HTML via multipart/alternative, so recipients see nicely formatted emails. The backend markdown converter was enhanced to support headers, lists, blockquotes, inline code, and horizontal rules.

## 20260504.0821

Fixed signature modal preview text being centered — added text-align:left to the modal content and preview div.

Fixed raw HTML tags showing in the email compose textarea. The signature is now inserted as raw markdown (the way the user wrote it) into the body textarea. The server handles converting markdown to HTML when the email is actually sent. A textarea can only display plain text, so inserting HTML tags was wrong.

## 20260504.0817

Fixed signature editor modal not appearing as an overlay. Was using `.modal-overlay` class (only defined in editor.css) on the settings page which only loads shared-page.css. Switched to the standard `.modal` + `.modal-content` classes that all other settings page modals use. The signature editor now pops up as a proper overlay with dark backdrop, centered on screen.

## 20260504.0811

Restored the signature editor as a proper modal (textarea on top, live preview on bottom, 500ms debounced updates, Ctrl+B/I/K shortcuts). Settings page shows an inline preview snippet with an "Edit Signature" button to open the modal.

Signature is now inserted as rendered HTML into the email body (converted from markdown via marked.js) instead of raw markdown text. The backend also sends a multipart/alternative HTML version for email clients that support it, and skips double-appending if the body already contains the signature.

## 20260504.0802

Signature editor is now an inline div on the settings page (not a modal) — textarea on top, live markdown preview below, auto-updates 500ms after typing stops. Ctrl+B/I/K shortcuts still work.

Fixed signature not applying when creating a new email from the Create Chit button — _applySignatureIfEmpty now waits for settings to load via getCachedSettings() if they aren't available yet.

Outgoing emails with a signature now include an HTML alternative part. The markdown signature is converted to HTML (bold, italic, links, line breaks) and sent as a multipart/alternative message so email clients render it properly instead of showing raw markdown.

## 20260504.0750

Signature editor is now a full modal with the textarea on top and a live markdown preview on the bottom half. Preview auto-updates 500ms after you stop typing. Ctrl+B/I/K shortcuts work in the modal. The settings page shows an inline preview snippet that opens the modal on click.

Fixed signature not auto-applying to new emails — now applied in both _activateEmailZone and initEmailZone for drafts with empty bodies. The signature is pre-filled with the standard `--` separator.

## 20260504.0734

Fixed quick-create from email view not opening expanded mode (was missing &expand=email in the sidebar Create Chit URL).

Email save buttons are now content-aware: normal Save buttons show until there's actual email content (To, Subject, or Body). Once any email field has content, Save as Draft appears. Send buttons only appear when all three fields have content.

Signature preview now respects single line breaks (marked.js `breaks: true`). Added Ctrl+B (bold), Ctrl+I (italic), Ctrl+K (link) keyboard shortcuts to the signature textarea. For links, if selected text is a URL it becomes the href; otherwise it becomes the display text with cursor placed in the URL field.

## 20260504.0724

Added email signature support. Configure a markdown signature in Settings → Email → Signature with live preview. Signature is automatically appended to all outgoing emails (with a standard `--` separator) and pre-filled in the expand modal for new drafts.

Reorganized the Email settings section into collapsible sub-sections: Account (credentials + test connection), Server (IMAP/SMTP hosts, collapsed by default), Syncing (max pull, check interval, backfill), Signature, and Attachments (reference to Admin settings). Renamed the section from "Email Account" to "Email".

## 20260504.0717

Fixed four email issues:

1. Compose from email view now opens in expanded mode (increased init delay to 350ms with DOM readiness check).

2. Email expand modal now includes a Subject field between To and Body. Editable for drafts, read-only for received/sent. Syncs back to the editor title field on close.

3. Ntfy notifications for new emails now show subject and sender per email instead of generic "You have new mail." Title line shows count, body shows up to 5 email summaries.

4. Critical fix: synced emails were missing owner_id in the INSERT, so they never appeared in the inbox (the GET /api/chits query filters by owner_id). Added owner_id to _create_email_chit. Existing orphaned emails will need to be deleted and re-synced.

## 20260504.0707

Fixed emails arriving as read: IMAP fetch was using RFC822 which implicitly sets the \Seen flag on the server. Switched to BODY.PEEK[] to fetch without marking as read. Existing emails will need to be deleted and re-synced to get correct read/unread state.

Added "Send & Archive" button alongside Send in both the editor header and the expand modal. Sends the reply then archives the original email. New backend endpoint POST /api/email/archive-original handles the archive by Message-ID.

## 20260504.0702

Fixed reply/forward from the email expand modal marking the original email as having unsaved changes. Closing the expand modal for received/sent emails no longer syncs fields back or triggers the unsaved-changes state, so the original email stays untouched in the inbox. Also removed the word "tabs" from the help page — replaced with "views" throughout.

## 20260504.0655

Reorganized the Help page. The table of contents now has two labeled columns: Views (left) and Reference (right). Body sections reordered to match — all view documentation (Calendar, Notes, Habits, Maps, Email, Global Search, Trash, Kiosk) comes first, followed by reference material (Chits, Editor, Shortcuts, Tags, Settings, etc.).

## 20260504.0647

Fixed email expand state not persisting on reply/forward — the expand modal was being removed from the DOM before the navigation check. Now uses a `_emailExpandModalOpen` flag that survives the modal close. Compose from email tab also opens in expanded mode.

## 20260504.0641

Emails opened from the Email tab now launch directly into the expanded email modal. Reply, forward, and thread navigation all preserve the current expand/collapse state — if you're in expanded mode, the next email opens expanded too. Compose from the email tab also opens expanded.

## 20260504.0636

Email editor polish: removed "Body:" label from email zone, expanded email modal now fills full viewport (1em margin) matching notes modal, added CC/BCC toggle buttons in expand modal, fixed pill toggle border stretching. Both notes and email expand modals now use full viewport sizing. Fixed attachment settings (max size and max storage per user) not persisting when saving settings.
