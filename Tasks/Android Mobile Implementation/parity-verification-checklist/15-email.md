# Email (all folders + bundles + thread expansion + compose)

**Category:** Dashboard Views
**Item #:** 15
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### main-email.js — Core Email View

#### State Variables
- [ ] _emailSubFilter — current folder filter state ('inbox', 'sent', 'drafts', 'scheduled', 'trash', 'archived')
- [ ] _emailSelectedIds — array of selected email chit IDs for bulk actions
- [ ] _emailLastCheckedIndex — last checkbox index for shift+click range selection
- [ ] _emailAutoCheckTimer — interval timer for auto-check mail
- [ ] _emailAccountFilter — array of selected account nicknames (empty = show all)
- [ ] _emailAccountErrors — object mapping account nicknames to error messages
- [ ] _emailAccountSuccess — object mapping account nicknames to success state
- [ ] _emailAccountLastSync — object mapping account nicknames to last sync ISO timestamp
- [ ] _emailAccountFilterInitialized — whether account filter has been initialized
- [ ] _emailDashContactsCache — cached contacts for sender image lookup
- [ ] _emailDashUsersCache — cached users for sender image lookup
- [ ] _emailRepliedToCache — Set of message IDs that have been replied to
- [ ] _emailUnreadTop — whether to sort unread emails to the top
- [ ] _emailPaginationOffset — tracks how many threads have been rendered (pagination)

#### View Rendering Functions
- [ ] displayEmailView(chitsToDisplay) — main entry point: renders the Email tab list view with folder filtering, account filtering, bundle filtering, threading, pagination, and date grouping
- [ ] _buildEmailCard(chit, viSettings) — builds a single email card element with sender, subject, preview, attachments, tags, hover actions, swipe gestures, pin button, contact image/checkbox
- [ ] _buildThreadedEmailCard(thread, viSettings) — builds a stacked parchment card for multi-message threads with thread count badge and expand/collapse
- [ ] _buildNestedChitCard(chit) — builds a card for a nested (non-email) chit displayed within an email thread (nest icon, title, preview, date)
- [ ] _emailEmptyState(container) — renders empty state message when no emails match current filter
- [ ] _emailLoadMoreThreads(scrollWrap, allThreads, currentOffset, viSettings, loadMoreWrap) — pagination: loads next batch of 50 threads into the scroll wrapper

#### Folder Switching
- [ ] _setEmailSubFilter(filter) — sets the email sub-filter ('inbox', 'sent', 'drafts', 'scheduled', 'trash', 'archived') and re-renders
- [ ] _chitHasTag(c, tagSuffix) — checks if a chit has a specific CWOC_System/Email/ tag (used for folder filtering)

#### Thread Expansion/Collapse
- [ ] _emailGroupByThread(emailChits) — groups email chits into threads using Message-ID/In-Reply-To/References headers with subject fallback
- [ ] _emailNormalizeSubject(subject) — strips Re:/Fwd:/Fw: prefixes for thread matching
- [ ] _toggleThreadExpand(wrapper, thread, viSettings) — toggles inline expansion of a threaded email group, populating child cards on first expand
- [ ] _emailInjectNests(threads) — injects non-email chits with nest_thread_id into their associated email threads

#### Compose & Send
- [ ] _composeEmail() — navigates to editor in compose mode (/editor?new=email&expand=email)
- [ ] _emailCheckPendingSend() — checks localStorage for pending email send from editor undo-send flow, shows undo countdown
- [ ] _emailDoActualSendFromDash(chitId, archiveOriginal, inReplyTo) — actually sends the email after undo countdown expires, optionally archives original

#### Check Mail / Sync
- [ ] _checkMail() — triggers manual email sync via POST /api/email/sync, shows spinners on pills, handles per-account errors/success, refreshes chit list
- [ ] _emailStartAutoCheck() — starts or restarts the auto-check mail interval timer based on settings
- [ ] _emailSetPillSpinners(spinning) — shows/hides spinning indicators on all account pills and Check Mail button

#### Account Filter
- [ ] _emailRenderAccountFilterButtons() — renders account filter pill buttons in the sidebar (all start selected, click to deselect)
- [ ] _emailToggleAccountFilter(nickname) — toggles an account nickname in the filter, re-renders email view
- [ ] _emailPersistAccountStatus() — persists account sync status (errors, success, lastSync) to localStorage

#### Error Display
- [ ] _showAccountErrorDetails(nickname, errorMsg) — shows persistent toast with full error details, Copy Error button, and Go to Settings button
- [ ] _emailShowErrorWithSettingsLink(errorMsg, hint) — shows error toast with Go to Settings button for email configuration issues

#### Multi-Select & Bulk Actions
- [ ] _emailToggleSelect(chitId, checked) — toggles a single chit's selection state
- [ ] _emailShiftSelect(currentCb) — shift+click range selection for email checkboxes
- [ ] _emailUpdateBulkBar() — updates bulk actions bar visibility and count
- [ ] _emailBulkSelectAll() — selects/deselects all visible email cards (toggle)
- [ ] _emailBulkClear() — clears all selections
- [ ] _emailBulkArchive() — bulk archives selected emails via GET+PUT per chit
- [ ] _emailBulkToggleRead() — bulk toggles read/unread for selected emails via PATCH
- [ ] _emailBulkDelete() — bulk soft-deletes selected emails with confirmation
- [ ] _emailBulkTag() — shows tag picker modal, applies selected tags to all selected emails

#### Quick Actions (Single Email)
- [ ] _emailQuickArchive(chit, card) — quick-archives a single email with undo countdown (hides card immediately)
- [ ] _emailQuickDelete(chit, card) — quick-deletes a single email with undo countdown (hides card immediately)
- [ ] _emailRestoreCard(card) — restores a hidden email card back to visible state (used by undo), plays flash animation

#### Read/Unread
- [ ] _toggleEmailReadStatus(chit, card) — toggles read/unread status via PATCH, updates card visual and badge
- [ ] _toggleEmailUnreadTop() — toggles unread-at-top sorting, re-renders email view

#### Badge & Counts
- [ ] _getUnreadCount() — returns count of unread inbox emails for the tab badge
- [ ] _updateEmailBadge() — updates the unread count badge on the Email tab

#### Replied-To Detection
- [ ] _emailBuildRepliedCache() — builds a Set of message IDs that have been replied to (only sent/draft replies count)
- [ ] _emailHasReply(messageId) — checks if a given message ID has been replied to

#### Nested Chit Helpers
- [ ] _nestGetContentPreview(chit) — gets content preview for a nested chit (first line of note → checklist summary → status)

#### Contact/User Image Lookup
- [ ] _emailLoadDashContacts() — loads contacts for sender image lookup (cached)
- [ ] _emailLoadDashUsers() — loads users for sender image lookup (cached)
- [ ] _emailGetContactImage(senderRaw) — looks up contact/user image_url by matching sender email address

#### Sidebar Visibility
- [ ] _toggleEmailSidebarSection() — toggles the email sidebar section body visibility
- [ ] _updateEmailSidebarVisibility(tab) — shows/hides email sidebar section based on current tab

#### Date & Formatting Helpers
- [ ] _emailFormatDateSmart(emailDate) — formats date smartly: today → time, yesterday → "Yesterday", this year → "Mon DD", older → "Mon DD, YYYY"
- [ ] _emailGetDateGroup(chit) — determines date group label ("Today", "Yesterday", "Last Week", "Older")
- [ ] _emailStripHtml(str) — strips HTML tags, decodes entities, removes CSS/scripts, collapses whitespace
- [ ] _emailStripMarkdown(str) — strips markdown formatting, extracts link text, removes bold/italic markers
- [ ] _emailGetFileIcon(mimeType) — returns file type emoji icon for attachment display

#### Tracking/Smart Links (Legacy)
- [ ] _emailDetectTracking(chit) — legacy wrapper delegating to shared detectSmartLinkFirst()

#### Attachment Context Menu
- [ ] _showAttachmentContextMenu(e, url, filename, mimeType) — shows context menu with View and Download options for an attachment

---

### main-email-bundles.js — Bundle Toolbar & Tab Logic

#### State Variables
- [ ] _emailActiveBundle — active bundle name (null = no bundle filter)
- [ ] _emailBundlesData — cached bundles data from settings/API
- [ ] _bundleFetchInFlight — whether a bundle fetch is currently in flight
- [ ] _bundleRefreshInProgress — prevents re-entrant refresh
- [ ] _bundleModalOpen — whether the bundle modal is currently open
- [ ] _bundleModalEditBundle — the bundle being edited (null = creating new)
- [ ] _bundleLongPressTimer — long-press timer ID for mobile context menu
- [ ] _bundleContextMenuEl — currently open context menu element
- [ ] _bundleReorderActive — whether reorder mode is currently active
- [ ] _bundleReorderDraggedTab — the tab element currently being dragged

#### Bundle Data & Filtering
- [ ] _fetchBundles(callback) — fetches bundles from settings/API, stores in _emailBundlesData
- [ ] _filterByBundle(chits, activeBundle) — filters email chits by active bundle tag (handles "Everything Else" catch-all)
- [ ] _getBundleUnreadCount(bundleName, emailChits) — gets unread count for a specific bundle
- [ ] _getAllInboxEmailChits() — gets all inbox email chits from global chits array (single source of truth)

#### Toolbar Rendering
- [ ] _renderBundleToolbar(emailChits) — builds the permanent two-row bundle toolbar (Row 1: bulk actions, Row 2: bundle tabs)
- [ ] _renderBundleTabs(container, bundles, emailChits) — renders bundle tabs with colors, counts, drag-and-drop, context menus
- [ ] _refreshBundleTabsInPlace() — re-renders just the bundle tabs row after async fetch
- [ ] _refreshBundleTabCounts() — refreshes badge counts on existing bundle tabs without full re-render

#### Active Bundle Management
- [ ] _setActiveBundle(bundleName) — sets active bundle, persists to localStorage, updates tab states, re-renders
- [ ] _persistActiveBundle() — persists active bundle to localStorage
- [ ] _updateBundleTabActiveStates() — updates visual active state on bundle tabs without full re-render
- [ ] _bundleOnSubFilterChange(newFilter) — resets active bundle when sub-filter changes away from "inbox"

#### Bulk Action State (Bundle Toolbar)
- [ ] _emailBundleSelectAll(checked) — select all/deselect all via bundle toolbar checkbox
- [ ] _bundleUpdateActionStates() — updates bundle toolbar action button states based on selection count

#### Bundle Modal (Create/Edit)
- [ ] _openBundleModal(editBundle) — opens bundle creation/edit modal from template, configures for edit vs create
- [ ] _closeBundleModal() — closes the bundle modal and cleans up event listeners
- [ ] _bundleModalSubmit() — validates and submits the bundle modal form (create or update)
- [ ] _bundleModalCreate(name, description, color, omniView) — creates new bundle via POST /api/bundles, navigates to Rule Editor
- [ ] _bundleModalUpdate(name, description, color, omniView) — updates existing bundle via PUT /api/bundles/{id}
- [ ] _showBundleModalHint(msg) — shows hint/error message in the bundle modal
- [ ] _bundleModalEscHandler(e) — ESC key handler for the bundle modal (capture phase)

#### Bundle Context Menu
- [ ] _showBundleContextMenu(bundle, x, y) — shows context menu at position with Edit/Delete/Disable options
- [ ] _closeBundleContextMenu() — closes the bundle context menu
- [ ] _bundleContextMenuOutsideClick(e) — click-outside handler for context menu
- [ ] _bundleContextMenuEscHandler(e) — ESC handler for context menu
- [ ] _attachBundleTabContextMenu(tab, bundle) — attaches right-click and long-press context menu to a bundle tab

#### Bundle Enable/Disable (Auto-Bundles)
- [ ] _toggleAutoBundle(bundle, enable) — toggles auto-bundle enabled/disabled state via API

#### Bundle Delete
- [ ] _deleteBundleConfirm(bundle) — shows delete confirmation, calls DELETE API, clears active bundle if needed

#### Bundle Reorder (Drag-and-Drop)
- [ ] _enableBundleReorder() — enables drag-and-drop reorder mode on bundle tabs
- [ ] _bundleReorderDragStart(e) — dragstart handler for bundle tab reorder
- [ ] _bundleReorderDragEnd(e) — dragend handler, clears indicators
- [ ] _bundleReorderDragOver(e) — dragover handler, shows left/right drop indicators
- [ ] _bundleReorderDrop(e) — drop handler, calculates new order, persists via API
- [ ] _persistBundleReorder(orderedIds) — persists new bundle order via PUT /api/bundles/reorder
- [ ] _bundleReorderFinishOnClick(e) — finishes reorder mode when clicking outside tab row
- [ ] _disableBundleReorder() — disables reorder mode and cleans up

---

### main-sidebar.js — Email-Related Sidebar Controls

- [ ] _initDashboardSidebar() — registers dashboard callbacks including onCreateChit (auto-opens email zone when on Email tab)

---

### shared-sidebar.js — Email Sidebar Section (HTML)

#### Sidebar Controls (injected HTML)
- [ ] Check Mail button (id="sidebar-check-mail-btn") — triggers _checkMail()
- [ ] Account filter pill buttons container (id="email-account-filter-wrap") — rendered by _emailRenderAccountFilterButtons()
- [ ] Folder radio group (id="email-folder-select") — radio buttons for folder switching
- [ ] Unread at top checkbox (id="email-unread-top-toggle") — toggles _toggleEmailUnreadTop()

#### Display Filter Checkboxes (in Filters section)
- [ ] Show Email (Received) checkbox (id="show-email-received") — filters email chits in non-Email tabs
- [ ] Show Email (Sent) checkbox (id="show-email-sent") — filters email chits in non-Email tabs

---

### index.html — Email Tab & Controls

#### Tab Bar
- [ ] Email tab button — onclick="filterChits('Email')" with email.png icon and unread badge
- [ ] Email unread badge (id="email-unread-badge") — shows unread count, hidden when 0

#### Bundle Modal Template (tmpl-bundle-modal)
- [ ] Bundle name input (id="bundleNameInput") — text input, maxlength=50
- [ ] Bundle description textarea (id="bundleDescInput") — optional, 2 rows
- [ ] Bundle color picker (id="bundleColorPicker") — rendered by cwocRenderColorPicker
- [ ] Bundle color hidden input (id="bundleColorInput") — stores selected color hex
- [ ] Include in Omni View checkbox (id="bundleOmniViewCheck") — toggles omni_view flag
- [ ] Cancel button (id="bundleCancelBtn") — closes modal
- [ ] Define Rule / Save button (id="bundleDefineRuleBtn") — submits form (create navigates to Rule Editor, edit saves)
- [ ] Modal hint paragraph (id="bundleModalHint") — shows validation errors

#### Script Load Order
- [ ] main-email.js — loaded after main-views.js
- [ ] main-email-bundles.js — loaded after main-email.js

---

### Sidebar Folder Options (Radio Buttons)

- [ ] Inbox radio (value="inbox") — _setEmailSubFilter('inbox')
- [ ] Sent radio (value="sent") — _setEmailSubFilter('sent')
- [ ] Drafts radio (value="drafts") — _setEmailSubFilter('drafts')
- [ ] Scheduled radio (value="scheduled") — _setEmailSubFilter('scheduled')
- [ ] Trash radio (value="email-trash") — navigates to /frontend/html/trash.html?filter=email

---

### Email Card Interactions (Event Handlers)

#### Per-Card Controls
- [ ] Checkbox (email-select-cb) — click: toggle selection; shift+click: range selection
- [ ] Contact image / checkbox wrap (email-cb-wrap) — shows contact image by default, checkbox on hover
- [ ] Pin button (email-pin-btn) — click: toggles pinned state via PUT /api/chits/{id}
- [ ] Hover action: Archive button — click: _emailQuickArchive()
- [ ] Hover action: Delete button — click: _emailQuickDelete()
- [ ] Hover action: Mark Unread button — click: _toggleEmailReadStatus()
- [ ] Card double-click — navigates to editor with ?expand=email
- [ ] Card right-click (contextmenu) — opens chit context menu
- [ ] Card swipe right (touch) — archive with undo
- [ ] Card swipe left (touch) — delete with undo
- [ ] Attachment click — preview modal (or shift+click to download)
- [ ] Attachment right-click — context menu with View/Download options
- [ ] Smart link badges — clickable links to tracking URLs (opens in new tab)

#### Thread Controls
- [ ] Thread count badge click — _toggleThreadExpand() to expand/collapse thread inline
- [ ] Thread ribbon — visual indicator of thread depth (1-3 layers)
- [ ] Nested chit card click — navigates to editor for that chit
- [ ] Nested chit card double-click — navigates to editor for that chit

#### Bundle Toolbar Controls (Row 1: Bulk Actions)
- [ ] Select All checkbox (id="bundleSelectAllCb") — _emailBundleSelectAll()
- [ ] Archive button (id="bundleArchiveBtn") — _emailBulkArchive()
- [ ] Tag button (id="bundleTagBtn") — _emailBulkTag()
- [ ] Read/Unread button (id="bundleReadBtn") — _emailBulkToggleRead()
- [ ] Delete button (id="bundleDeleteBtn") — _emailBulkDelete()
- [ ] Selected count display (id="bundleSelectedCount") — shows "N selected"

#### Bundle Toolbar Controls (Row 2: Bundle Tabs)
- [ ] Bundle tab buttons — click: _setActiveBundle(); shift+click: _openBundleModal() for edit
- [ ] Bundle tab right-click — _showBundleContextMenu()
- [ ] Bundle tab long-press (mobile) — _showBundleContextMenu()
- [ ] Bundle tab drag-and-drop — reorder tabs via _bundleReorderDragStart/Over/Drop
- [ ] Add bundle "+" button — click: _openBundleModal(null) for create
- [ ] Bundle tab unread/total badge — shows count based on bundles_show_count setting

#### Bundle Context Menu Items
- [ ] Edit — opens _openBundleModal(bundle)
- [ ] Disable/Enable (auto-bundles only) — _toggleAutoBundle()
- [ ] Delete (removable bundles only) — _deleteBundleConfirm()

#### Bundle Modal Controls
- [ ] Name input — text field with Enter key to submit
- [ ] Description textarea — optional
- [ ] Color picker — cwocRenderColorPicker with showNone option
- [ ] Omni View checkbox — include bundle in Omni View
- [ ] Cancel button — _closeBundleModal()
- [ ] Define Rule / Save button — _bundleModalSubmit()
- [ ] Change Rules button (edit mode only) — navigates to Rule Editor
- [ ] Delete button (edit mode, removable only) — _deleteBundleConfirm()
- [ ] ESC key — closes modal via capture-phase handler

#### Email Tag Modal (Bulk Tag)
- [ ] Tag picker container — uses shared buildTagPicker
- [ ] Apply button — applies selected tags to all selected emails
- [ ] Close button — removes modal
- [ ] Overlay click — closes modal
- [ ] ESC key — closes modal

#### Pagination
- [ ] Load More button — _emailLoadMoreThreads(), shows remaining count

---

### Sub-Filters (Folder Views)

- [ ] Inbox — emails with CWOC_System/Email/Inbox tag, not archived
- [ ] Sent — emails with CWOC_System/Email/Sent tag, not archived
- [ ] Drafts — emails with CWOC_System/Email/Drafts tag, status=draft, not archived, no send_at
- [ ] Scheduled — emails with status=draft AND email_send_at set, not archived
- [ ] Trash — emails with CWOC_System/Email/Trash tag (navigates to trash page)
- [ ] Archived — emails with archived=true (code exists but no sidebar radio button)

---

### Sorting & Grouping

- [ ] Default sort: pinned at top, then by email_date descending (newest first)
- [ ] Unread-at-top mode: unread threads sort above read threads (within each, by newest)
- [ ] Date grouping: "Today", "Yesterday", "Last Week", "Older" headers between groups
- [ ] Thread sorting: threads sorted by their latest message date (newest thread first)

---

### Auto-Initialization

- [ ] Auto-check mail timer starts on page load (after 3s delay for settings)
- [ ] Pending email send check on page load (after 500ms)
- [ ] Contact/user cache loading on page load (after 500ms/600ms)
- [ ] Active bundle restored from localStorage on load
- [ ] Reclassification triggered on return from Rule Editor (localStorage flag)
- [ ] Account sync status restored from localStorage on load

---

### API Endpoints Used

- [ ] POST /api/email/sync — check mail / sync
- [ ] PATCH /api/email/{id}/read — toggle read/unread
- [ ] POST /api/email/send/{id} — send email
- [ ] POST /api/email/archive-original — archive original after reply
- [ ] GET /api/contacts — load contacts for sender images
- [ ] GET /api/auth/switchable-users — load users for sender images
- [ ] GET /api/chit/{id} — fetch full chit for bulk operations
- [ ] PUT /api/chits/{id} — update chit (archive, tag, pin)
- [ ] DELETE /api/chits/{id} — soft-delete email
- [ ] GET /api/bundles — fetch bundles (via settings cache)
- [ ] POST /api/bundles — create bundle
- [ ] PUT /api/bundles/{id} — update bundle
- [ ] DELETE /api/bundles/{id} — delete bundle
- [ ] PUT /api/bundles/reorder — reorder bundles
- [ ] POST /api/bundles/reclassify — trigger bundle reclassification
- [ ] POST /api/bundles/{id}/disable — disable auto-bundle
