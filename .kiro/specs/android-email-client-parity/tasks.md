# Implementation Plan: Android Email Client Parity

## Overview

This plan implements full email client feature parity between the CWOC Android app and the web mobile email client. Implementation proceeds in layers: domain-layer pure functions (independently testable), data layer (repositories + API), ViewModel extensions, then UI composables. All code is Kotlin with Jetpack Compose.

## Tasks

- [x] 1. Domain Layer — Pure Functions
  - [x] 1.1 Implement BodyPreviewStripper.kt
    - Create `domain/email/BodyPreviewStripper.kt` as a Kotlin object
    - Implement `strip(body: String?): String` that removes HTML tags, style/script blocks, markdown syntax markers, raw URLs, zero-width characters, collapses whitespace, and truncates to 250 chars
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 1.2 Implement SmartLinkDetector.kt
    - Create `domain/email/SmartLinkDetector.kt` with `SmartLink` data class and `detect()` function
    - Implement regex patterns for: package tracking (UPS, FedEx, USPS, DHL), flights, hotels, rental cars, events, restaurants, transit, orders
    - Enforce max N badges total and max 1 per category
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.3 Implement EmailDateFormatter.kt
    - Create `domain/email/EmailDateFormatter.kt` as a Kotlin object
    - Implement `format(dateStr: String?, use24Hour: Boolean): String` returning time-only for today, "Yesterday" for yesterday, "Mon DD" for this-year, "Mon DD, YYYY" for prior-year
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 1.4 Implement DateGrouper.kt
    - Create `domain/email/DateGrouper.kt` with `DateGroup` enum (TODAY, YESTERDAY, LAST_WEEK, OLDER)
    - Implement `assign(dateStr: String?): DateGroup` for temporal grouping
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 1.5 Implement ContrastColor.kt
    - Create `domain/email/ContrastColor.kt` as a Kotlin object
    - Implement `forBackground(backgroundColor: Color): Color` returning black or white for WCAG 4.5:1 contrast ratio
    - Implement `contrastRatio(fg: Color, bg: Color): Double` using relative luminance formula
    - _Requirements: 10.3, 12.2, 37.5_

  - [x] 1.6 Implement MarkdownFormatter.kt
    - Create `domain/email/MarkdownFormatter.kt` with `TextSelection` data class
    - Implement all formatting operations: applyBold, applyItalic, applyStrikethrough, applyLink, applyHeading, applyBulletList, applyNumberedList, applyBlockquote, applyInlineCode, applyHorizontalRule
    - Each wraps/prefixes the selection with appropriate markdown markers
    - _Requirements: 38.3, 38.4, 38.5, 38.6, 38.7, 38.8, 38.9, 38.10, 38.11, 38.12_

  - [x] 1.7 Implement AutocompleteSearch.kt
    - Create `domain/email/AutocompleteSearch.kt` as a Kotlin object
    - Implement `search(query: String, contacts: List<ContactEntity>, existingChips: List<String>, maxResults: Int = 5): List<ContactEntity>`
    - Search by name and email, favorites first, exclude existing chips, max 5 results
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6_

  - [x] 1.8 Implement DraftDetector.kt
    - Create `domain/email/DraftDetector.kt` as a Kotlin object
    - Implement `findExistingReply(drafts: List<ChitEntity>, originalMessageId: String?): ChitEntity?`
    - Implement `findExistingForward(drafts: List<ChitEntity>, originalSubject: String?): ChitEntity?`
    - Match by emailInReplyTo for replies, normalized subject for forwards
    - _Requirements: 58.1, 58.2, 58.3, 58.4_

  - [x] 1.9 Implement PgpManager.kt
    - Create `domain/email/PgpManager.kt` for PGP encryption/decryption
    - Implement `encrypt(plaintext: String, recipientPublicKeys: List<String>): String`
    - Implement `decrypt(ciphertext: String, privateKey: String): String`
    - Use Bouncy Castle (Android-compatible OpenPGP)
    - _Requirements: 48.2, 48.7, 49.3, 49.4_

  - [ ]* 1.10 Write property test for BodyPreviewStripper
    - **Property 1: Body Preview Stripping Produces Clean Text**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

  - [ ]* 1.11 Write property test for SmartLinkDetector
    - **Property 2: Smart Link Badge Constraints**
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 1.12 Write property test for ContrastColor
    - **Property 3: Contrast-Safe Color Computation**
    - **Validates: Requirements 10.3, 12.2, 37.5**

  - [ ]* 1.13 Write property test for EmailDateFormatter
    - **Property 5: Date Formatting Correctness**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

  - [ ]* 1.14 Write property test for DateGrouper
    - **Property 6: Date Group Assignment**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [ ]* 1.15 Write property test for AutocompleteSearch
    - **Property 11: Contact Autocomplete Search**
    - **Validates: Requirements 36.1, 36.2, 36.3, 36.4, 36.5, 36.6**

  - [ ]* 1.16 Write property test for MarkdownFormatter
    - **Property 12: Markdown Formatting Round-Trip Structure**
    - **Validates: Requirements 38.3, 38.4, 38.5, 38.11**

  - [ ]* 1.17 Write property test for DraftDetector
    - **Property 21: Existing Draft Detection**
    - **Validates: Requirements 58.1, 58.2, 58.3, 58.4**

  - [ ]* 1.18 Write property test for sender initial extraction
    - **Property 22: Sender Initial Extraction**
    - **Validates: Requirements 1.2**

- [x] 2. Checkpoint — Domain layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Data Layer — API Endpoints and Repositories
  - [x] 3.1 Add new API endpoints to CwocApiService.kt
    - Add bundle CRUD endpoints: POST /api/bundles, PUT /api/bundles/{id}, DELETE /api/bundles/{id}, PUT /api/bundles/reorder
    - Add email operation endpoints: POST /api/email/schedule/{chitId}, POST /api/email/archive-original, PATCH /api/email/{id}/read, GET /api/email/{chitId}/raw
    - Add PGP endpoint: POST /api/auth/private-pgp-key
    - Add request/response DTOs: CreateBundleRequest, UpdateBundleRequest, ReorderBundlesRequest, ScheduleEmailRequest, ArchiveOriginalRequest, PgpKeyRequest, PgpKeyResponse, MarkReadRequest
    - _Requirements: 19.1, 22.6, 23.3, 24.7, 25.6, 28.3, 30.2, 31.3, 44.3, 45.3, 46.4, 47.3, 49.3, 53.2_

  - [x] 3.2 Implement BundleRepository.kt
    - Create `data/repository/BundleRepository.kt` interface and `BundleRepositoryImpl.kt`
    - Implement: fetchBundles, createBundle, updateBundle, deleteBundle, disableBundle, enableBundle, reorderBundles
    - Expose `bundles: StateFlow<List<BundleDto>>` for reactive UI updates
    - Register with Hilt DI in AppModule
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 22.2, 22.4, 22.6, 23.3, 24.7, 25.6, 64.1, 64.4, 64.5_

  - [x] 3.3 Implement EmailRepository.kt
    - Create `data/repository/EmailRepository.kt` interface and `EmailRepositoryImpl.kt`
    - Implement: syncEmail, sendEmail, scheduleEmail, cancelSchedule, archiveOriginal, markRead, backfillEstimate, testConnection, getPrivatePgpKey, downloadRawEml
    - Delegate chit CRUD to existing ChitRepository
    - Register with Hilt DI in AppModule
    - _Requirements: 32.2, 44.3, 45.3, 46.4, 47.3, 49.3, 53.2, 60.2, 65.2, 65.4_

- [x] 4. Checkpoint — Data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. ViewModel Layer — Extend and Create ViewModels
  - [x] 5.1 Extend EmailViewModel with multi-select, sorting, pagination, undo, and sync state
    - Add multi-select state: isMultiSelectMode, selectedIds, enterMultiSelect(), toggleSelection(), exitMultiSelect()
    - Add sorting logic: pinned-first (Property 7), unread-at-top toggle (Property 8), date grouping
    - Add pagination state: currentPage, totalThreadCount, loadMore()
    - Add undo state: undoAction, executeUndo(), cancelUndo()
    - Add sync state: syncingAccounts, accountErrors, triggerSync(), auto-check timer
    - Add account filter state: accounts, activeAccounts, toggleAccountFilter()
    - Inject BodyPreviewStripper, SmartLinkDetector, EmailDateFormatter, DateGrouper, DraftDetector
    - _Requirements: 1.1-1.4, 2.1-2.5, 3.1-3.4, 9.1-9.4, 13.1-13.6, 14.1-14.6, 15.1-15.3, 16.1-16.3, 17.1-17.4, 18.1-18.6, 32.1-32.6, 33.1-33.8, 34.1-34.3, 35.1-35.4_

  - [ ]* 5.2 Write property tests for EmailViewModel sorting and filtering
    - **Property 7: Pinned Emails Sort First**
    - **Property 8: Unread-at-Top Sorting**
    - **Property 9: Selection State Consistency**
    - **Property 10: Account Filter Correctness**
    - **Property 14: Reply Indicator Detection**
    - **Property 16: Nested Chit Sort Order**
    - **Property 17: Pagination Invariant**
    - **Validates: Requirements 2.5, 3.4, 5.1, 5.2, 15.1, 15.2, 18.5, 27.2-27.4, 33.3, 33.4, 34.2**

  - [x] 5.3 Create BundleViewModel.kt
    - Create `ui/screens/email/BundleViewModel.kt` with Hilt injection
    - Implement: fetchBundles, selectBundle, createBundle, updateBundle, deleteBundle, disableBundle, reorderBundles
    - Expose bundle count formatting (Property 15) based on bundles_show_count setting
    - Manage bundle context menu state and drag-to-reorder state
    - _Requirements: 19.1-19.5, 20.1-20.5, 21.1-21.2, 22.1-22.7, 23.1-23.4, 24.1-24.7, 25.1-25.6, 26.1-26.2, 64.1-64.5_

  - [ ]* 5.4 Write property test for bundle count badge formatting
    - **Property 15: Bundle Count Badge Formatting**
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4**

  - [x] 5.5 Create EmailComposeViewModel.kt
    - Create `ui/screens/email/EmailComposeViewModel.kt` with Hilt injection
    - Implement autocomplete state: query, results, addRecipient, removeRecipient, chipify
    - Implement PGP state: pgpEnabled, togglePgp, validateRecipientKeys, encrypt/decrypt flows
    - Implement formatting state: applyFormatting (delegates to MarkdownFormatter), keyboard shortcuts
    - Implement undo-send flow: initiateSend, startCountdown, cancelSend, executeSend
    - Implement send-and-archive flow: sendAndArchive with archive-original API call
    - Implement send-later flow: scheduleSend, cancelSchedule
    - Implement draft detection: checkExistingDraft (delegates to DraftDetector)
    - Implement subject/title sync (Property 13)
    - Implement signature auto-apply on new drafts
    - _Requirements: 36.1-36.8, 37.1-37.6, 38.1-38.12, 39.1-39.8, 42.1-42.3, 43.1-43.3, 44.1-44.6, 45.1-45.3, 46.1-46.6, 47.1-47.3, 48.1-48.7, 49.1-49.7, 52.1-52.3, 57.1-57.5, 58.1-58.4_

  - [ ]* 5.6 Write property test for subject/title sync
    - **Property 13: Subject/Title Bidirectional Sync**
    - **Validates: Requirements 43.1, 43.2, 43.3**

  - [ ]* 5.7 Write property test for PGP key validation
    - **Property 18: PGP Key Validation**
    - **Validates: Requirements 48.2, 48.3**

  - [x] 5.8 Create EmailSettingsViewModel.kt
    - Create `ui/screens/email/EmailSettingsViewModel.kt` with Hilt injection
    - Manage settings state: accounts list, privacy settings, display settings, bundle settings
    - Implement: loadSettings, saveSettings, testConnection, backfillEstimate, triggerBackfill
    - Implement signature state: currentSignature, saveSignature
    - Implement account CRUD: addAccount, editAccount, deleteAccount
    - _Requirements: 59.1-59.8, 60.1-60.4, 61.1-61.7, 62.1-62.5, 63.1-63.3, 64.1-64.5, 65.1-65.6_

- [x] 6. Checkpoint — ViewModel layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. UI Layer — Email List View Composables
  - [x] 7.1 Implement EmailCardEnhanced.kt
    - Create `ui/screens/email/EmailCardEnhanced.kt` composable
    - Display: circular contact avatar (image or initial), pin bookmark button, status badges (Draft/Sent), reply indicator, body preview (via BodyPreviewStripper), tag chips with colors (via ContrastColor), attachment thumbnails, smart link badges, custom chit color background, thread ribbon bar and count badge
    - Handle multi-select mode: replace avatar with checkbox on long-press
    - Handle date formatting via EmailDateFormatter
    - _Requirements: 1.1-1.4, 2.1-2.4, 3.1-3.3, 4.1-4.4, 5.1-5.2, 6.1-6.8, 7.1-7.4, 10.1-10.5, 11.1-11.4, 12.1-12.3, 17.1-17.4_

  - [x] 7.2 Implement SmartLinkBadges.kt
    - Create `ui/screens/email/SmartLinkBadges.kt` composable
    - Display badge chips with carrier/service logo and label
    - Handle tap to open tracking URL in device browser
    - _Requirements: 8.1-8.5_

  - [x] 7.3 Implement EmailContextMenu.kt
    - Create `ui/screens/email/EmailContextMenu.kt` composable
    - Display context menu on long-press (when not in multi-select mode): Archive, Delete, Mark Unread/Read
    - Each action triggers undo toast flow
    - _Requirements: 9.1-9.4_

  - [x] 7.4 Implement BundleToolbar.kt (two-row sticky toolbar)
    - Create `ui/screens/email/BundleToolbar.kt` composable
    - Row 1: Bulk actions bar (delegated to BulkActionsBar)
    - Row 2: Bundle tabs from API with colors, count badges, priority arrows, dimmed state when not inbox
    - Handle bundle tab selection, drag-to-reorder, long-press context menu
    - _Requirements: 19.1-19.5, 20.1-20.5, 21.1-21.2, 23.1-23.4, 26.1-26.2_

  - [x] 7.5 Implement BulkActionsBar.kt
    - Create `ui/screens/email/BulkActionsBar.kt` composable
    - Display: Select All checkbox (with indeterminate state), Archive button, Tag button, Read/Unread button, Delete button (danger styling)
    - Enable/disable buttons based on selection state
    - Display "N selected" count
    - _Requirements: 2.5, 27.1-27.4, 28.1-28.5, 29.1-29.5, 30.1-30.5, 31.1-31.6_

  - [x] 7.6 Implement AccountFilterPills.kt
    - Create `ui/screens/email/AccountFilterPills.kt` composable
    - Display one pill per configured account with nickname
    - Handle toggle active/inactive, sync spinner, error state (red + warning icon), success indicator (green)
    - Long-press tooltip showing last sync time
    - Tap error-state pill shows detailed error toast with "Email Settings", "Copy Error", "Dismiss" options
    - _Requirements: 33.1-33.8_

  - [x] 7.7 Implement BundleContextMenu.kt
    - Create `ui/screens/email/BundleContextMenu.kt` composable
    - Display on long-press (500ms): Edit, Disable (auto-bundles), Delete (user-created, not "Everything Else")
    - _Requirements: 22.1-22.7_

  - [x] 7.8 Implement BundleModals.kt (Create and Edit Bundle)
    - Create `ui/screens/email/BundleModals.kt` composable
    - Create Bundle modal: Name field, Description textarea, Tab Color picker, Show in Omni View checkbox, Cancel/Define Rule buttons
    - Edit Bundle modal: pre-populated fields, Change Rules button, Delete button with confirmation, Cancel/Save buttons
    - _Requirements: 24.1-24.7, 25.1-25.6_

  - [x] 7.9 Implement TagPickerModal.kt
    - Create `ui/screens/email/TagPickerModal.kt` composable
    - Full-screen modal with header "Tag N email(s)"
    - Display shared tag tree view with search functionality
    - Apply/Cancel actions
    - _Requirements: 29.2-29.5_

  - [x] 7.10 Implement EmailThreadView.kt (nested chits in threads)
    - Create `ui/screens/email/EmailThreadView.kt` composable
    - Display nested chit cards inline within expanded threads: nest icon, title, content preview, due date
    - Sort nested chits by due_date ascending, then start_datetime ascending
    - Never display nested chit as topmost card of collapsed thread
    - Tap navigates to chit editor
    - _Requirements: 18.1-18.6_

  - [x] 7.11 Update EmailScreen.kt to integrate all new list view components
    - Replace existing EmailThreadCard with EmailCardEnhanced
    - Add BundleToolbar (with BulkActionsBar) as sticky header
    - Add AccountFilterPills row
    - Add date group headers (via DateGrouper)
    - Add pagination "Load More" button
    - Add empty state with context (folder name, account names, suggestion)
    - Add Check Mail button with sync animation
    - Add Unread-at-top toggle
    - Add auto-check mail timer
    - Wire undo toast for archive/delete actions
    - _Requirements: 13.1-13.6, 14.1-14.6, 15.1-15.3, 16.1-16.3, 32.1-32.6, 34.1-34.3, 35.1-35.4_

- [x] 8. Checkpoint — Email list view UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. UI Layer — Compose/Editor Composables
  - [x] 9.1 Implement RecipientChipField.kt
    - Create `ui/screens/email/RecipientChipField.kt` composable
    - Display To/CC/BCC fields with styled recipient chips (contact image, color, remove button)
    - Implement autocomplete dropdown (max 5 results, favorites first, star indicator, name + email)
    - Chipify on Enter, comma, or blur
    - Compute contrast-safe text color for chip backgrounds
    - _Requirements: 36.1-36.8, 37.1-37.6_

  - [x] 9.2 Implement FormattingToolbar.kt
    - Create `ui/screens/email/FormattingToolbar.kt` composable
    - Display buttons: Bold, Italic, Strikethrough, Link, Heading (H1/H2/H3 dropdown), Bullet List, Numbered List, Blockquote, Inline Code, Horizontal Rule
    - Each button delegates to MarkdownFormatter via EmailComposeViewModel
    - Wire keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+E, Ctrl+Shift+X, Ctrl+Shift+8, Ctrl+Shift+7, Ctrl+Shift+.)
    - _Requirements: 38.1-38.12, 39.1-39.8_

  - [x] 9.3 Implement HtmlEmailRenderer.kt
    - Create `ui/screens/email/HtmlEmailRenderer.kt` composable
    - Render HTML email in sandboxed WebView (JavaScript disabled)
    - Sanitize HTML: remove script, iframe, object, embed, form, input, button, select, textarea tags
    - Force links to open in device browser
    - Auto-resize WebView height (200-800dp range)
    - Implement external content blocking based on setting (block/allow/known_senders)
    - Display "External images blocked" banner with "Load External Content" button
    - Display HTML/Text toggle pill
    - _Requirements: 50.1-50.6, 51.1-51.5_

  - [ ]* 9.4 Write property test for HTML sanitization
    - **Property 19: HTML Sanitization**
    - **Validates: Requirements 50.2**

  - [ ]* 9.5 Write property test for external content blocking
    - **Property 20: External Content Blocking**
    - **Validates: Requirements 51.1, 51.4, 51.5**

  - [x] 9.6 Implement SendLaterModal.kt
    - Create `ui/screens/email/SendLaterModal.kt` composable
    - Date picker (min: today) and time picker (default: now + 1 hour)
    - Schedule/Cancel buttons
    - On schedule: save chit + call schedule API, navigate to Scheduled folder
    - _Requirements: 46.1-46.6_

  - [x] 9.7 Implement AttachmentBar.kt
    - Create `ui/screens/email/AttachmentBar.kt` composable
    - Display attachment chips: icon/thumbnail, filename, file size
    - Image attachments show actual thumbnails; non-image show file type icon
    - Tap opens preview modal; long-press shows View/Download context menu
    - _Requirements: 56.1-56.6_

  - [x] 9.8 Implement EmailThreadViewInEditor.kt (thread section in editor)
    - Create `ui/screens/email/EmailThreadViewInEditor.kt` composable
    - Display "Thread (N messages)" section below email body
    - Simple list for ≤3 messages (sender, date, 100-char preview)
    - Stacked/collapsed view for >3 messages with Expand button
    - Expanded: full scrollable list (max 60% viewport height)
    - Highlight current message; tap navigates to other messages
    - Display nested chits interspersed with messages
    - _Requirements: 55.1-55.7_

  - [x] 9.9 Update EmailComposeZone.kt to integrate all compose features
    - Add RecipientChipField for To/CC/BCC
    - Add FormattingToolbar above/below body textarea
    - Add live markdown preview with 500ms debounce and Render toggle
    - Add email-specific save buttons: Save Draft, Send, Send & Archive (for replies)
    - Add PGP toggle button (green lock when enabled, open lock when disabled)
    - Add PGP decryption banner with Decrypt button and password modal
    - Add Read Receipt checkbox
    - Add Download Raw button for received/sent emails
    - Add "Add Contact" button for unknown senders
    - Add scheduled send indicator with Cancel button
    - Add signature auto-apply on new drafts
    - Add subject/title bidirectional sync
    - Add undo-send flow integration
    - Add AttachmentBar at bottom of body area
    - Add EmailThreadViewInEditor section
    - _Requirements: 40.1-40.3, 41.1-41.3, 42.1-42.3, 43.1-43.3, 44.1-44.6, 45.1-45.3, 47.1-47.3, 48.1-48.7, 49.1-49.7, 50.5-50.6, 52.1-52.3, 53.1-53.3, 54.1-54.3, 57.1-57.5_

- [x] 10. Checkpoint — Compose/editor UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. UI Layer — Email Settings Screen
  - [x] 11.1 Implement EmailSettingsScreen.kt
    - Create `ui/screens/email/EmailSettingsScreen.kt` composable
    - Accounts section: account pill chips summary, "Manage Accounts" button
    - Privacy section: Block Tracking Pixels checkbox, External Content selector (Allow/Block/Known Senders), Read Receipts selector (Never/Always/Ask/Contacts Only), Undo Send Delay number input
    - Display section: Group By selector (Date/None), Paginate Email checkbox
    - Bundle section: Bundles Enabled checkbox, Multi-Placement checkbox, Show Count selector (Both/Unread/Total/None), auto-bundle toggles (Newsletters, Receipts, Calendar Invites)
    - Signature section: inline preview + "Edit Signature" button
    - Backfill section: Backfill button with estimate display and confirmation
    - _Requirements: 59.1-59.2, 62.1-62.5, 63.1-63.3, 64.1-64.5, 65.1-65.6_

  - [x] 11.2 Implement AccountsModal.kt
    - Create `ui/screens/email/AccountsModal.kt` composable
    - List view: all accounts (icon, nickname/email, server info), Add Account button
    - Edit view: Nickname, Email, Display Name, Username, Password (visibility toggle), IMAP Host/Port/Security, SMTP Host/Port/Security
    - Test Connection button with IMAP/SMTP status indicators
    - Back button, Delete button with confirmation
    - _Requirements: 59.3-59.8, 60.1-60.4_

  - [x] 11.3 Implement SignatureEditorModal.kt
    - Create `ui/screens/email/SignatureEditorModal.kt` composable
    - Markdown textarea (top half) with keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
    - Live-rendered markdown preview (bottom half) with 500ms debounce
    - Done/Cancel buttons
    - _Requirements: 61.1-61.7_

- [x] 12. Final Checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Domain layer is implemented first because pure functions can be tested independently
- Data layer comes second to establish API communication before UI needs it
- ViewModels bridge domain + data layers before UI composables consume them
- UI composables are last since they depend on all lower layers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9"] },
    { "id": 1, "tasks": ["1.10", "1.11", "1.12", "1.13", "1.14", "1.15", "1.16", "1.17", "1.18"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["5.1", "5.3", "5.8"] },
    { "id": 5, "tasks": ["5.2", "5.4", "5.5"] },
    { "id": 6, "tasks": ["5.6", "5.7"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.6", "7.7", "7.8", "7.9", "7.10"] },
    { "id": 8, "tasks": ["7.4", "7.5"] },
    { "id": 9, "tasks": ["7.11"] },
    { "id": 10, "tasks": ["9.1", "9.2", "9.3", "9.6", "9.7", "9.8"] },
    { "id": 11, "tasks": ["9.4", "9.5"] },
    { "id": 12, "tasks": ["9.9"] },
    { "id": 13, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
