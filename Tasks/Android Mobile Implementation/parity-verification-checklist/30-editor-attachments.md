# Attachments Zone

**Category:** Editor Zones
**Item #:** 30
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor-attachments.js`

## Global State

- [ ] `_attachmentsData` — Array of current attachment objects {id, filename, size, mime_type, uploaded_at}
- [ ] `_pendingUploads` — Array of attachment IDs uploaded this session (rolled back on exit without save)
- [ ] `_pendingDeletes` — Array of attachment IDs marked for deletion (committed on save)

## Functions

### Initialization

- [ ] `initAttachmentsZone(chit)` — Parse chit.attachments JSON, render list, wire upload area
- [ ] `hasAttachmentData(chit)` — Check if chit has attachments (for zone auto-expand)

### Data Management

- [ ] `getAttachmentsData()` — Return JSON string of attachments array for save (or null if empty)
- [ ] `commitAttachmentChanges()` — On save: delete pending-delete files from server, clear pending state
- [ ] `rollbackAttachmentChanges()` — On exit without save: delete pending uploads from server

### Rendering

- [ ] `_renderAttachmentsList()` — Render all attachments in the list container
- [ ] `_updateAttachmentCount()` — Update count badge in zone header (`#attachmentCount`)
- [ ] Empty state message — "No attachments yet." when list is empty

### Attachment Item Display

- [ ] File icon (emoji) — Based on MIME type (🖼️ image, 🎬 video, 🎵 audio, 📕 PDF, 📦 archive, 📊 spreadsheet, 📽️ presentation, 📝 document, 📄 default)
- [ ] Image thumbnail — For image/* MIME types, shows actual image preview
- [ ] Filename span — Display attachment filename
- [ ] File size span — Human-readable size (B, KB, MB, GB)
- [ ] Download button (link) — Opens attachment URL in new tab
- [ ] Delete button (trash icon) — Delete attachment with confirmation

### Upload

- [ ] `_wireAttachmentUpload()` — Wire file input change, drag-drop events on upload area and zone header
- [ ] `_uploadFiles(files)` — Upload files to server via POST /api/chits/:id/attachments (FormData)
- [ ] File input (`#attachmentFileInput`) — Hidden file input, triggered by "Add Files" button
- [ ] "Add Files" button — Triggers file input click
- [ ] Drag-drop on upload area — dragover/dragleave/drop handlers with visual feedback
- [ ] Drag-drop on zone header — Works even when zone is collapsed (auto-expands)
- [ ] Upload progress indicator — Shows "Uploading [filename]..." during upload
- [ ] `_showUploadProgress()` — Create and show progress element
- [ ] `_hideUploadProgress()` — Remove progress element
- [ ] Zero-byte file check — Skip files with size === 0 (show error toast)
- [ ] Error handling — Toast for 413 (too large), generic upload failures
- [ ] Success toast — "N file(s) uploaded"
- [ ] Auto-expand zone — Expand attachments zone after successful upload
- [ ] New chit guard — Prevent upload on unsaved new chits ("Save the chit first")

### Delete

- [ ] `_deleteAttachment(attachmentId, filename)` — Mark for deletion or delete immediately if pending upload
- [ ] Confirmation dialog — cwocConfirm with danger styling
- [ ] Pending upload immediate delete — If uploaded this session, delete from server immediately
- [ ] Staged delete — If existing attachment, mark for deletion (committed on save)
- [ ] Success toast — "Attachment removed"

### Utility Functions

- [ ] `_getFileIcon(mimeType)` — Map MIME type to emoji icon
- [ ] `_formatFileSize(bytes)` — Format bytes to human-readable string

### Android/Mobile Considerations

- [ ] Visibility change listener — Re-sync attachments from server when page resumes (Android file picker may kill tab)
- [ ] Merge logic — Add server-side attachments not in local list after resume

### Behaviors

- [ ] Staged operations — Uploads go to server immediately but tracked; deletes are local-only until save
- [ ] Rollback on cancel — Pending uploads deleted from server if user exits without saving
- [ ] setSaveButtonUnsaved() — Called after upload or delete
- [ ] Drag-over visual feedback — CSS class "attachment-drag-over" on upload area
- [ ] Zone header drag-drop — Outline style on dragover, auto-expand on drop
