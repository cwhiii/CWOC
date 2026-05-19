# Attachment Preview Modal

**Category:** Modals & Overlays
**Item #:** 71
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Function (shared-utils.js)
- [ ] cwocAttachmentPreview(url, filename, mimeType) — Shows an attachment in a preview modal; supports multiple file types; single source of truth for all attachment previews

### Parameters
- [ ] url — The attachment download URL
- [ ] filename — Display name for the file
- [ ] mimeType — MIME type string (e.g., "image/png", "application/pdf")

### Supported File Types & Rendering

#### Images (mime starts with "image/")
- [ ] Renders as `<img>` element
- [ ] max-width: 100%, max-height: 75vh, object-fit: contain
- [ ] Border-radius: 4px

#### PDFs (mime === "application/pdf")
- [ ] Renders as `<iframe>` element
- [ ] width: 100%, height: 75vh
- [ ] Border: 1px solid #c4a882, border-radius: 4px

#### Text files (mime starts with "text/" or === "application/json")
- [ ] Renders as `<pre>` element
- [ ] Fetches content via fetch(url).then(r => r.text())
- [ ] max-height: 75vh, overflow: auto, white-space: pre-wrap, word-break: break-word
- [ ] Shows "Loading..." while fetching, "Failed to load file content." on error

#### Audio (mime starts with "audio/")
- [ ] Renders as `<audio>` element with controls
- [ ] width: 100%, margin-top: 20px

#### Video (mime starts with "video/")
- [ ] Renders as `<video>` element with controls
- [ ] max-width: 100%, max-height: 75vh, border-radius: 4px

#### Unsupported types (fallback)
- [ ] Shows 📄 icon (3em)
- [ ] "Preview not available for this file type." message
- [ ] Download button (zone-button styled link)

### Header Elements
- [ ] Filename title (.cwoc-attachment-preview-title) — Shows filename or "Attachment"
- [ ] Download button (.cwoc-attachment-preview-dl) — `<a>` element with download attribute; icon: fas fa-download + "Download" text
- [ ] Close button (.cwoc-attachment-preview-close) — "✕" button, closes modal on click

### Controls & Interactions
- [ ] ESC key — Closes modal (capture phase, stopImmediatePropagation, preventDefault)
- [ ] Click overlay (outside modal) — Closes modal
- [ ] Download button click — stopPropagation to prevent overlay close; triggers native download

### Modal Structure
- [ ] Overlay (#cwocAttachmentPreviewModal) — .cwoc-attachment-preview-overlay class
- [ ] Modal container — .cwoc-attachment-preview-modal class
- [ ] Header — .cwoc-attachment-preview-header class
- [ ] Button row — .cwoc-attachment-preview-btns class
- [ ] Content area — .cwoc-attachment-preview-content class

### Singleton Behavior
- [ ] Removes existing modal (id: cwocAttachmentPreviewModal) before creating new one

### Usage Contexts
- [ ] Editor email attachments (editor-email.js) — Click on attachment opens preview
- [ ] Dashboard email view (main-email.js) — Click on attachment opens preview
- [ ] Attachments page (attachments.js) — Click on attachment card opens preview (has its own openPreviewModal with additional features)

### Attachments Page Extended Preview (attachments.js — openPreviewModal)
- [ ] Additional modal with more details (separate implementation)
- [ ] #att-preview-modal overlay
- [ ] .att-modal-overlay class
- [ ] Shows full attachment metadata
- [ ] Selection and multi-select support
