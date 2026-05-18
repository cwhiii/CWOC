# Phase 8: Editor & Modals

## Problem
The editor is missing full email compose UI, attachment upload capability, and calendar pre-fill. Several modals/dialogs that exist on web are missing on Android.

## Tasks

### 8.1 Editor — Full Email Compose Zone
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

When a chit has `email_status = "draft"`, the editor should show a full Email zone (not just "Make Email" in overflow menu).

**Email Zone contents:**
- From: dropdown of configured email accounts (from settings `email_accounts`)
- To: text field with contact autocomplete (chips for multiple recipients)
- CC: text field (collapsible, hidden by default)
- BCC: text field (collapsible, hidden by default)
- Subject: text field (pre-filled from chit title)
- Body: multi-line markdown text area (same as Notes zone)
- Attachments: list of attached files + "Add Attachment" button
- Action buttons:
  - Send (calls `/api/email/send/{chitId}`)
  - Send Later (date/time picker, sets `email_send_at`)
  - Send & Archive (send + archive the original if replying)
  - Discard Draft (delete the chit)

**For received emails (email_status = "received"):**
- Show read-only: From, To, CC, Subject, Body (rendered HTML/markdown)
- Action buttons: Reply, Forward, Archive, Download Raw
- Body toggle: HTML view | Text view (for emails with HTML content)

**For sent emails (email_status = "sent"):**
- Show read-only: From, To, CC, Subject, Body
- Action buttons: Forward, Download Raw

**Web reference:** `src/frontend/js/editor/editor-email.js` (entire file)

### 8.2 Editor — Attachment Upload
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt` (AttachmentsZone)

Currently the Attachments zone is read-only ("Upload from web editor"). Make it functional:

**Implementation:**
- "Add Attachment" button → Android file picker (any file type)
- Selected file gets uploaded to `/api/chits/{chitId}/attachments` (multipart form)
- Show upload progress indicator
- After upload, refresh attachment list
- Each attachment shows: filename, size, type icon, delete button
- Tap attachment → download/open with system viewer
- Image attachments show thumbnail preview

**Web reference:** `src/frontend/js/editor/editor-init.js` (attachment upload handling)

### 8.3 Editor — Calendar Pre-fill
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarScreen.kt`
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorViewModel.kt`

On the web, double-clicking an empty time slot in the calendar creates a new chit pre-filled with that date/time.

**Implementation:**
1. In Day/Week time grids, add tap handler on empty slots
2. On tap, navigate to editor with pre-fill params: `editor/new?start={datetime}&end={datetime}`
3. In ChitEditorViewModel, parse URL params and pre-fill `startDatetime` and `endDatetime`
4. The DateZone should show these pre-filled values immediately

**Web reference:** `src/frontend/js/dashboard/main-calendar.js` (`attachEmptySlotCreate`)

### 8.4 Tag Create/Edit Dialog
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/TagCreateDialog.kt`

Currently there's no way to create or edit tags from the Android app (only select existing ones).

**Implementation:**
- Dialog with: tag name field, color picker (swatches), parent tag dropdown (optional)
- Accessible from:
  - Editor Tags zone → "Create Tag" button at bottom of tag picker
  - Settings Collections tab → Tag Editor (Phase 4)
- On save: adds to `shared_tags` in settings and syncs

**Web reference:** `src/frontend/js/shared/shared-tags.js` (tag creation modal)

### 8.5 Recurring Event Drag Disambiguation Dialog
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/RecurringEditDialog.kt`

When editing a recurring chit (from calendar drag or from editor), show a dialog asking:
- "This instance only"
- "All events"
- "This and all following"
- "Cancel"

**Implementation:**
- AlertDialog with 4 options
- Show when: user taps a recurring event in calendar, or when saving changes to a recurring chit in the editor
- Based on selection, either:
  - Add an exception date (this instance only)
  - Modify the recurrence rule (all)
  - Split the recurrence (this and following)

**Web reference:** `src/frontend/js/shared/shared-calendar.js` (recurring drag modal)

### 8.6 Project Quick Menu
**New file or update:** `android/app/src/main/java/com/cwoc/app/ui/components/ProjectQuickMenu.kt`

On web, Shift+click on a project header shows a quick menu. On Android, long-press on a project card in the Projects tab should show:
- Create child chit
- Quick edit (title/status)
- Pin/Unpin
- Archive
- Snooze
- Delete

Currently only the generic `ChitActionMenu` shows on long-press. Add "Create Child" option specific to project masters.

### 8.7 Release Notes Dialog
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/ReleaseNotesDialog.kt`

Shows release notes with day navigation (Older / Newer buttons).

**Implementation:**
- Bottom sheet or dialog
- Fetches from `GET /api/release-notes` (returns `{notes: [{date, content}, ...]}`)
- Shows current day's notes (markdown rendered)
- Older / Newer buttons to navigate between days
- Accessible from: Settings → Admin → Version section → "Release Notes" button

**Web reference:** Settings page release notes modal

### 8.8 Image View Modal (Contact Photos)
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/ImageViewDialog.kt`

When tapping a contact's profile image in the contact editor, show a full-screen image viewer.

**Implementation:**
- Full-screen overlay with the image
- Pinch-to-zoom
- Tap to dismiss
- Share button

### 8.9 Camera Capture for Contact Photos
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorScreen.kt`

Add camera capture option for contact profile photos:
- Tap profile image area → show options: "Take Photo" | "Choose from Gallery" | "Remove Photo"
- Take Photo: launch camera intent, crop to square, upload to `/api/contacts/{id}/image`
- Choose from Gallery: launch gallery picker, crop, upload
- Remove Photo: call `DELETE /api/contacts/{id}/image`

**Web reference:** `src/frontend/js/pages/contact-editor.js` (`openCameraCapture`, image upload handling)

### 8.10 QR Code Sharing for Contacts
**New file:** `android/app/src/main/java/com/cwoc/app/ui/components/QrCodeDialog.kt`

Generate and display a QR code containing the contact's vCard data.

**Implementation:**
- Use a QR code generation library (e.g., ZXing)
- Encode the contact as a vCard string
- Show in a dialog with: QR code image, "Share" button (share the QR image), "Copy vCard" button
- Accessible from: Contact Editor → overflow menu → "Share QR Code"

**Web reference:** `src/frontend/js/shared/shared-qr.js`, `src/frontend/js/pages/contact-qr.js`

## Verification
- [ ] Draft emails show full compose UI (From, To, CC, BCC, Subject, Body, Send)
- [ ] Received emails show read-only view with Reply/Forward buttons
- [ ] Attachment upload works via file picker with progress indicator
- [ ] Tapping empty calendar slot creates pre-filled new chit
- [ ] Tag creation dialog works from editor and settings
- [ ] Recurring event edit shows disambiguation dialog
- [ ] Project long-press shows "Create Child" option
- [ ] Release notes dialog shows with day navigation
- [ ] Contact photo tap shows full-screen viewer
- [ ] Camera capture and gallery picker work for contact photos
- [ ] QR code sharing generates and displays vCard QR
