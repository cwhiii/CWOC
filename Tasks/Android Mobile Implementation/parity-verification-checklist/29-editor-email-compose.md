# Email Compose Zone

**Category:** Editor Zones
**Item #:** 29
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor-email.js`

## Global State

- [ ] `_emailCurrentChit` — Currently loaded chit for reply/forward operations
- [ ] `_emailExpandModalOpen` — Whether the email expand modal is open
- [ ] `_emailContactsCache` — Cached contacts for autocomplete

## Functions

### Initialization

- [ ] `initEmailZone(chit)` — Populate all email fields from chit data, wire events, set read-only state
- [ ] `_activateEmailZone()` — Activate email on a regular chit (show fields, apply signature)
- [ ] `_deactivateEmailZone()` — Deactivate email zone (clear fields, confirm if content exists)
- [ ] `_applySignatureIfEmpty()` — Auto-apply email signature from settings if body is empty

### Data Collection

- [ ] `getEmailData()` — Collect all email field values for save (to, cc, bcc, body, subject)
- [ ] `hasEmailData(chit)` — Check if chit has email data (email_message_id or email_status)

### Contacts & Autocomplete

- [ ] `_emailLoadContacts()` — Fetch contacts from /api/contacts (cached)
- [ ] `_emailSearchContacts(query)` — Search contacts by name/email, return top 5 (favorites first)
- [ ] `_wireEmailAutocomplete(inputId, dropdownId)` — Wire autocomplete on email input field
- [ ] `_emailChipifyRecipient(input, result)` — Create a chip from autocomplete result
- [ ] `_emailChipifyRawInput(input)` — Create chip from raw email text (comma/Enter)
- [ ] `_emailLookupKnown(email)` — Look up if email belongs to a known contact
- [ ] `_emailGetChipEmails(input)` — Get array of emails from chips on an input
- [ ] `_emailChipTextColor(hex)` — Calculate contrasting text color for chip background
- [ ] `_emailSyncChipsToInput(input)` — Sync chip data back to hidden input value
- [ ] `_emailGetFieldValue(input)` — Get field value from chips or raw input text

### Email Fields

- [ ] From field (`#emailFrom`) — Display-only, populated from settings email_account
- [ ] To field (`#emailTo`) — Comma-separated recipients with autocomplete + chips
- [ ] Cc field (`#emailCc`) — Carbon copy recipients (toggle visibility)
- [ ] Bcc field (`#emailBcc`) — Blind carbon copy recipients (toggle visibility)
- [ ] Subject field (`#emailSubject`) — Email subject (syncs to chit title)
- [ ] Body textarea (`#emailBody`) — Email body text (markdown supported)
- [ ] `_toggleEmailCcBcc(field)` — Show/hide Cc or Bcc field

### Buttons & Actions

- [ ] Send button (`#emailSendBtn`) — Send email with undo countdown
- [ ] Send Later button (`#emailSendLaterBtn`) — Schedule email for future sending
- [ ] Reply button (`#emailReplyBtn`) — Create reply draft
- [ ] Forward button (`#emailForwardBtn`) — Create forward draft
- [ ] Discard button (`#emailDiscardBtn`) — Discard draft (with confirmation)
- [ ] Activate button (`#emailActivateBtn`) — Activate email on regular chit
- [ ] Quick Activate button (`#emailQuickActivateBtn`) — Quick activate email
- [ ] Expand button — Open email in expanded modal view
- [ ] Download Raw button — Download raw email source
- [ ] Load External Content button — Load external images/content
- [ ] Add Sender as Contact button — Add email sender to contacts
- [ ] Read Receipt toggle (`#emailReadReceiptRow`) — Request read receipt

### Send Operations

- [ ] `_emailSend()` — Save then send email with undo countdown toast
- [ ] `_emailUndoSendCountdown(chitId, archiveOriginal)` — Show countdown bar, cancel on undo
- [ ] `_emailSendLater()` — Schedule email: pick date/time, save scheduled_send_at
- [ ] `_emailCancelScheduled()` — Cancel a scheduled send, revert to draft
- [ ] `_emailSaveAndSend()` — Save and send (delegates to _emailSend)
- [ ] `_emailSaveAndSendArchive()` — Save, send, and archive original

### Reply & Forward

- [ ] `_emailReply()` — Create reply draft: set To=sender, prefix "Re:", quote body
- [ ] `_emailForward()` — Create forward draft: empty To, prefix "Fwd:", quote body
- [ ] Quoted body format — Separator line + "On [date], [sender] wrote:" + indented original

### Draft Management

- [ ] `_emailDiscardDraft()` — Discard draft with confirmation (different behavior for original vs activated)
- [ ] `_hasEmailContent()` — Check if any email field has content
- [ ] `_hasEmailSendableContent()` — Check if To + Subject + Body all have content
- [ ] `_updateEmailSaveButtonVisibility()` — Show/hide save+send buttons based on content
- [ ] `_updateEmailButtons(status)` — Show/hide buttons based on email_status (draft/sent/received)
- [ ] `_showEmailSaveButtons(isEmail)` — Toggle save button variants for email mode

### Formatting

- [ ] `_emailUndo(e)` — Undo in email body (document.execCommand)
- [ ] `_emailRedo(e)` — Redo in email body (document.execCommand)
- [ ] `_getEmailFormatAction(e)` — Map keyboard shortcut to format action (bold/italic/underline/etc.)
- [ ] `_emailFormatBtn(action, textareaId, textareaEl)` — Apply markdown formatting to selection
- [ ] Cmd/Ctrl+B — Bold
- [ ] Cmd/Ctrl+I — Italic
- [ ] Cmd/Ctrl+U — Underline
- [ ] Cmd/Ctrl+K — Link
- [ ] Cmd/Ctrl+Shift+X — Strikethrough

### Expand Modal

- [ ] `_openEmailExpandModal()` — Open full-screen email compose/view modal
- [ ] `_closeEmailExpandModal(save)` — Close modal, optionally sync changes back
- [ ] `_switchExpandView(mode)` — Switch between compose/rendered in expand modal
- [ ] `_toggleExpandCcBcc(field)` — Toggle Cc/Bcc in expand modal
- [ ] `_emailCopyChipsToExpand(sourceInputId, targetInputId)` — Copy chips to expand modal
- [ ] `_emailCopyChipsFromExpand(expandInputId, smallInputId)` — Copy chips back from expand modal
- [ ] `_switchEmailExpandMode(mode)` — Switch expand modal mode (compose/preview)
- [ ] `_toggleEmailExpandRender()` — Toggle rendered view in expand modal
- [ ] `_setEmailExpandRenderLabel(isRendered)` — Update render toggle label

### View Modes

- [ ] `toggleEmailViewMode(event)` — Toggle between raw text and rendered HTML view
- [ ] `_setEmailRenderToggleLabel(isRendered)` — Update render toggle button label
- [ ] `_wireEmailBodyPreview()` — Wire live preview for email body
- [ ] `_wireExpandBodyPreview()` — Wire live preview in expand modal
- [ ] `_setupHtmlEmailView(htmlContent, bodyEl)` — Set up HTML email view with iframe
- [ ] `_switchEmailView(mode)` — Switch between text/html/thread views
- [ ] `_resizeEmailIframe(iframe)` — Auto-resize iframe to content height

### Thread View

- [ ] `_fetchEmailThread(chitId)` — Fetch email thread from API
- [ ] `_buildThreadItem(entry, currentId)` — Build a single thread entry element
- [ ] `_buildNestedChitThreadItem(entry)` — Build nested chit thread item
- [ ] `_renderEmailThread(thread, currentId)` — Render full email thread

### Attachments (Email-specific)

- [ ] `_renderEmailAttachmentBar(chit)` — Render attachment bar in email zone
- [ ] `_renderExpandEmailAttachmentBar(chit)` — Render attachment bar in expand modal
- [ ] `_getEmailAttachmentList(chit)` — Get list of email attachments
- [ ] `_buildEmailAttachmentBar(attachments, chitId)` — Build attachment bar DOM
- [ ] `_formatAttSize(bytes)` — Format attachment size

### Utility

- [ ] `_emailSyncSubjectToTitle()` — Sync email subject field to chit title
- [ ] `_emailAddSenderAsContact()` — Add sender email to contacts
- [ ] `_emailConfirmUnsavedForNav()` — Confirm unsaved email changes before navigation
- [ ] `_emailDownloadRaw()` — Download raw email source file
- [ ] `_emailLoadExternalContent()` — Load external images/resources in email
- [ ] `_setEmailZoneReadOnly(readOnly)` — Set email zone to read-only (for received emails)

### Read-Only State (Received Emails)

- [ ] Fields disabled for received emails — To, Cc, Bcc, Subject, Body all read-only
- [ ] Reply/Forward buttons shown — For received emails
- [ ] Send button hidden — For received emails
