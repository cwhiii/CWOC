# Contact Editor

**Category:** Standalone Pages
**Item #:** 40
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Header Row
- [ ] Logo link — navigates to dashboard
- [ ] "Contact Editor" title
- [ ] favoriteBtn (star toggle) — toggleFavorite() toggles ★/☆
- [ ] saveStayButton — "📌 Save & Stay" (shown when unsaved)
- [ ] saveExitButton — "🚪 Save & Exit" (shown when unsaved)
- [ ] saveButton — disabled "Save" indicator (shown when saved)
- [ ] "Exit" button — cancelOrExit() with unsaved changes check
- [ ] qrButton — "📱 QR" button — shareContact() shows QR code
- [ ] headerAuditBtn — "📜 Audit" button — navigates to audit log for this contact
- [ ] deleteButton — "Delete" button — deleteContact() with confirmation
- [ ] cwoc-profile-menu — user profile menu button

### Save System (CwocEditorSaveSystem)
- [ ] _initSaveSystem() — creates CwocEditorSaveSystem instance
- [ ] saveContactAndStay() — saves contact, stays on page
- [ ] saveContactAndExit() — saves contact, navigates to people list
- [ ] _saveContact() — gathers form data, POSTs/PUTs to API
- [ ] cwocInterceptRefresh() — intercepts Cmd+R/F5 with unsaved changes modal
- [ ] beforeunload handler — warns on page close with unsaved changes

### Hotkeys
- [ ] _initHotkeys() — cwocInitEditorHotkeys for zones 1–8
- [ ] Alt+1: Name zone, Alt+2: Phone/Email, Alt+3: Social, Alt+4: Security, Alt+5: Context, Alt+6: Color, Alt+7: Notes, Alt+8: Tags
- [ ] Ctrl+S / Cmd+S: Save & Stay
- [ ] Ctrl+Shift+S / Cmd+Shift+S: Save & Exit

### Profile Image Area
- [ ] profilePlaceholder — placeholder icon (shown when no image)
- [ ] profileImage — contact photo (shown when image exists)
- [ ] imageFileInput (hidden file input) — accepts image/*
- [ ] triggerImageUpload() — opens file picker on image area click
- [ ] _initImageUpload() — wires file input change handler
- [ ] _stageImage(file) — resizes image (max 512px), shows preview, marks unsaved
- [ ] viewContactImage() — opens full-size image modal
- [ ] removeContactImage() — removes image, marks unsaved
- [ ] _uploadPendingImage() — uploads staged image on save
- [ ] _removePendingImage() — DELETEs image on save if flagged
- [ ] _setProfileImage(url) — updates image display state
- [ ] cameraBtn — "Camera" button — openCameraCapture()
- [ ] viewImageBtn — "View" button (shown when image exists)
- [ ] removeImageBtn — "Remove" button (shown when image exists)

### Camera Capture
- [ ] camera-modal — camera capture modal overlay
- [ ] openCameraCapture() — opens modal, starts camera stream
- [ ] _startCamera() — requests getUserMedia with facing mode
- [ ] _stopCameraStream() — stops all media tracks
- [ ] switchCamera() — toggles front/back camera
- [ ] capturePhoto() — draws video frame to canvas, shows preview
- [ ] retakePhoto() — restarts camera for new capture
- [ ] useCapturedPhoto() — converts canvas to blob, stages as image
- [ ] closeCameraCapture() — stops stream, hides modal

### Display Name Header
- [ ] displayNameHeader — live-updating display name from form fields
- [ ] _initDisplayNameUpdater() — attaches input/change listeners to name fields
- [ ] _updateDisplayNameHeader() — rebuilds display name from prefix+given+middle+surname+suffix

### Vault Toggle
- [ ] vault-pill (cwoc-2val-toggle) — Private/Vault toggle
- [ ] vault-toggle (hidden input) — stores "0" or "1"
- [ ] _initPillToggle('vault-pill', 'vault-toggle') — wires click handler
- [ ] _applyDefaultVaultSetting() — applies default from settings for new contacts
- [ ] vaultOwnerInfo — shows vault owner info for vault contacts

### Name Zone
- [ ] prefixSelect (select) — Prefix dropdown (None/Mr./Mrs./Ms./Miss/Dr./Prof./Rev./Hon./Custom)
- [ ] prefixCustom (text input) — custom prefix (shown when "Custom..." selected)
- [ ] givenName (text input) — Given name (required)
- [ ] middleNames (text input) — Middle name(s)
- [ ] surname (text input) — Surname / Last name
- [ ] suffixSelect (select) — Suffix dropdown (None/Jr./Sr./Esq./Ph.D./M.D./I–X/Custom)
- [ ] suffixCustom (text input) — custom suffix
- [ ] nickname (text input) — Nickname / alias
- [ ] onDropdownCustomChange(selectId, customId) — shows/hides custom input
- [ ] _getDropdownCustomValue(selectId, customId) — gets value from select or custom input

### Phone & Email Zone (Multi-Value)
- [ ] Phones multi-value section — label + value + remove button per row
- [ ] Emails multi-value section — label + value + remove button per row
- [ ] "Add" buttons for each — adds empty row
- [ ] _setMultiValueEntries(field, entries) — programmatically sets entries (e.g., from URL prefill)

### Social Zone (Multi-Value)
- [ ] Addresses multi-value section
- [ ] Websites multi-value section (with clickable link icon)
- [ ] X Handles multi-value section
- [ ] Call Signs multi-value section

### Security Zone
- [ ] hasSignal (checkbox) — "Has Signal" toggle
- [ ] signalUsername (text input) — Signal username or phone (shown when checked)
- [ ] signalMessageBtn — "Signal" button — openSignalMessage()
- [ ] onSignalToggle() — shows/hides Signal username field
- [ ] _initSignalToggle() — initializes Signal toggle state
- [ ] _updateSignalMessageBtn() — shows/hides message button based on value
- [ ] openSignalMessage() — opens Signal deep link (phone or username)
- [ ] pgpKey (textarea) — PGP Public Key
- [ ] pgpValidateBtn — "Validate Key" button
- [ ] validatePgpKey() — validates PGP key using openpgp.js library
- [ ] pgpValidationResult — shows validation result (✅ Valid / ❌ Invalid)
- [ ] _initPgpValidation() — auto-validates on blur

### Private PGP Key (Profile Mode Only)
- [ ] privatePgpSection — shown only in profile mode for own user
- [ ] Password-protected unlock flow

### Context Zone
- [ ] organization (text input) — Organization
- [ ] social_context (text input) — Social Context / Relationship
- [ ] Dates multi-value section — label + date value + calendar toggle per row

### Color Zone
- [ ] Color swatches — clickable color palette
- [ ] _initColorPicker() — renders color swatches
- [ ] Color selection updates contact color

### Notes Zone
- [ ] notes (textarea) — free-text notes field

### Tags Zone
- [ ] contactTagsInput (text input) — tag input with Enter to add
- [ ] contactTagsChips container — rendered tag chips with remove buttons
- [ ] _initContactTags() — wires Enter key handler
- [ ] _renderContactTags() — renders tag chips from _contactTags array
- [ ] Auto-prepends "Contact/" prefix if not present

### Account Zone (Profile Mode Only)
- [ ] accountSection — shown only in profile mode
- [ ] accountUsername (readonly text input) — username display
- [ ] accountDisplayName (text input) — display name
- [ ] accountEmail (text input) — email address

### Mode Detection
- [ ] _isProfileMode — true when mode=profile in URL
- [ ] _profileUserId — user_id from URL params
- [ ] _viewingOtherUser — true when viewing another user's profile (read-only)
- [ ] _initProfileMode() — initializes profile-specific UI

### Data Loading
- [ ] _loadContact(id) — fetches contact from GET /api/contacts/:id
- [ ] populateContactForm(contact) — fills all form fields from contact data
- [ ] URL param prefill — prefill_email and prefill_name from URL

### ESC Key Handler
- [ ] Closes: camera modal → image modal → QR overlay → unsaved modal → navigates away
- [ ] Uses capture phase for priority

### Zone Toggle
- [ ] cwocToggleZone(event, sectionId, contentId) — collapses/expands editor zones
- [ ] Zone headers with 🔼 toggle icon

### Image Modal
- [ ] image-modal — full-size image viewer overlay
- [ ] Click on modal backdrop closes it

### QR Sharing
- [ ] shareContact() — generates and shows QR code with vCard data
