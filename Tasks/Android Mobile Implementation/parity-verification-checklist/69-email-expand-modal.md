# Email Expand Modal

**Category:** Modals & Overlays
**Item #:** 69
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (editor-email.js)
- [ ] _openEmailExpandModal — Opens fullscreen email compose/view modal (desktop only, skipped on mobile ≤768px)
- [ ] _closeEmailExpandModal(syncBack) — Closes modal; if syncBack=true, copies field values back to small editor
- [ ] _emailCopyChipsToExpand(sourceInputId, targetInputId) — Copies email chips from small editor to expand modal fields
- [ ] _switchExpandView(mode) — Switches between HTML and Text view (pill toggle)
- [ ] _switchEmailExpandMode(mode) — Switches between "Live" preview and "Edit/Render" mode
- [ ] _toggleEmailExpandRender — Toggles rendered markdown preview in edit/render mode
- [ ] _toggleExpandCcBcc(field) — Shows/hides CC or BCC row in expand modal
- [ ] _wireExpandBodyPreview — Wires live markdown preview for draft compose
- [ ] _renderExpandEmailAttachmentBar — Renders attachment icons in the expand modal

### Header Controls
- [ ] Modal title — "✉️ Email"
- [ ] "Live" / "Render" toggle (cwoc-2val-toggle, #emailExpandModeToggle) — Switches between live preview and edit/render mode (draft only)
- [ ] "Render" button (#emailExpandRenderBtn) — Toggles rendered view (shown in edit/render mode only)
- [ ] HTML/Text pill toggle (#emailExpandPillToggle) — Switches between HTML iframe and plain text view (only when email has HTML body)

### Action Buttons (vary by email status)

#### Draft Status
- [ ] "Send" button — Closes modal (sync back), calls _emailSend()
- [ ] "Send Later" button — Closes modal (sync back), calls _emailSendLater()
- [ ] "Send & Archive" button — Closes modal (sync back), calls _emailSaveAndSendArchive()
- [ ] "Discard" button (danger) — Closes modal (no sync), calls _emailDiscardDraft()

#### Received Status
- [ ] "Reply" button — Closes modal (sync back), calls _emailReply()
- [ ] "Forward" button — Closes modal (sync back), calls _emailForward()
- [ ] "Raw" button — Downloads raw email source via _emailDownloadRaw()

#### Sent Status
- [ ] "Forward" button — Closes modal (sync back), calls _emailForward()
- [ ] "Raw" button — Downloads raw email source via _emailDownloadRaw()

#### Always Present
- [ ] "Done" button — Closes modal with sync back

### Email Fields
- [ ] From display — Read-only, shows sender with "Add sender as contact" button (for received emails)
- [ ] To input (#emailExpandTo) — Email address input with autocomplete dropdown (#emailExpandToDropdown)
- [ ] CC toggle button — Shows/hides CC row
- [ ] BCC toggle button — Shows/hides BCC row
- [ ] CC input (#emailExpandCc) — Email address input with autocomplete (#emailExpandCcDropdown); removable via ✕ button
- [ ] BCC input (#emailExpandBcc) — Email address input with autocomplete (#emailExpandBccDropdown); removable via ✕ button
- [ ] Subject input (#emailExpandSubject) — Text input for email subject
- [ ] All fields: readonly/disabled when viewing received/sent emails

### Email Body
- [ ] Textarea (#emailExpandBody) — Markdown compose area (draft mode); hidden when HTML view is active
- [ ] Rendered preview (#emailExpandRendered) — Shows rendered markdown; double-click to toggle back to edit
- [ ] HTML iframe (#emailExpandHtmlIframe) — Sandboxed iframe for HTML email content (allow-same-origin, allow-popups)
- [ ] DOMPurify sanitization — Strips scripts, objects, embeds, forms from HTML content
- [ ] Links forced to target="_blank" — All links open in new tabs

### Formatting Toolbar (draft mode only, #emailExpandToolbar)
- [ ] Bold (Ctrl+B) — Wraps selection in **bold**
- [ ] Italic (Ctrl+I) — Wraps selection in *italic*
- [ ] Strikethrough (Ctrl+Shift+X) — Wraps selection in ~~strikethrough~~
- [ ] Link (Ctrl+K) — Wraps selection in [text](url)
- [ ] Heading dropdown (H1, H2, H3) — Prefixes line with #, ##, ###
- [ ] Bullet List (Ctrl+Shift+8) — Prefixes lines with "- "
- [ ] Numbered List (Ctrl+Shift+7) — Prefixes lines with "1. "
- [ ] Blockquote (Ctrl+Shift+.) — Prefixes lines with "> "
- [ ] Code (Ctrl+E) — Wraps selection in `code`
- [ ] Horizontal Rule (Ctrl+Shift+-) — Inserts "---"

### Email Autocomplete
- [ ] _wireEmailAutocomplete — Wires autocomplete on To/Cc/Bcc fields using cached contacts
- [ ] Dropdown suggestions — Shows matching contacts as user types
- [ ] Chip creation — Converts typed/selected addresses into visual chips

### Modal Layout
- [ ] Full viewport with 1em margin — width: calc(100vw - 2em), height: calc(100vh - 2em)
- [ ] Flex column layout — Header (fixed) + Body (scrollable, flex:1)
- [ ] Body area height — calc(100vh - 2em - 280px) for the textarea/iframe

### Interactions
- [ ] ESC key — Closes modal without syncing back (capture phase, stopImmediatePropagation)
- [ ] Click overlay — Closes modal without syncing back
- [ ] Auto-open — Opens automatically when editor loads with ?expand=email URL param

### Attachment Bar
- [ ] _renderExpandEmailAttachmentBar — Shows attachment icons/chips in the expand modal for the current email

### State
- [ ] _emailExpandModalOpen — Boolean flag tracking if modal is open (used by other code to preserve expand state during reply/forward navigation)

### Sync Back Logic
- [ ] When closing with syncBack=true: copies expand modal To/Cc/Bcc/Subject/Body values back to the small editor fields
- [ ] Preserves expand state in navigation — Reply/Forward URLs include &expand=email param when modal was open
