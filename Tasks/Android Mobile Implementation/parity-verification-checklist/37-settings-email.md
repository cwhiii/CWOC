# Settings — Email Tab

**Category:** Standalone Pages
**Item #:** 37
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Accounts & Syncing Section
- [ ] emailAccountsSummary — displays summary of configured email accounts
- [ ] "📧 Manage Email Accounts" button — opens email accounts modal
- [ ] openEmailAccountsModal() — opens the email accounts management modal
- [ ] closeEmailAccountsModal() — closes the modal
- [ ] emailMaxPull (number input) — Max Pull emails per sync per account (1–1000)
- [ ] emailCheckInterval (select) — Check Mail interval (Manual/5/15/30/60 min)
- [ ] emailBackfillBtn — "📥 Backfill" button
- [ ] emailBackfill() — triggers email backfill operation
- [ ] emailBackfillResult — displays backfill result text

### Email Accounts Modal
- [ ] email-accounts-modal — modal overlay
- [ ] emailModalListView — account list view (shows all accounts)
- [ ] emailModalAccountList — container for account list items
- [ ] emailModalEditView — account edit view (form for single account)
- [ ] emailModalEditTitle — title showing which account is being edited
- [ ] emailModalEditForm — form fields for account configuration
- [ ] "➕ Add Account" button — _emailModalAddAccount()
- [ ] "← Back" button — _emailModalBackToList()
- [ ] "✅ Done" button — _emailModalSaveAccount()
- [ ] "🗑️ Delete" button — _emailModalDeleteAccount()
- [ ] _emailModalAddAccount() — switches to edit view for new account
- [ ] _emailModalBackToList() — returns to account list view
- [ ] _emailModalSaveAccount() — saves current account configuration
- [ ] _emailModalDeleteAccount() — deletes current account with confirmation
- [ ] _loadEmailAccountSettings(settings) — loads account data into UI
- [ ] _collectEmailAccountSettings() — gathers single account data (legacy)
- [ ] _collectEmailAccountsSettings() — gathers all accounts data

### Privacy & Sending Section
- [ ] emailBlockTrackingPixels (checkbox) — Block Tracking Pixels
- [ ] emailExternalContent (select) — External Content (Allow all/Block all/Allow from contacts)
- [ ] emailReadReceipts (select) — Read Receipts (Never/Always/Ask/Contacts only)
- [ ] emailUndoSendDelay (select) — Undo Send Delay (5/10/15/30 seconds)
- [ ] _loadEmailPrivacySettings(settings) — loads privacy settings into form
- [ ] _collectEmailPrivacySettings() — gathers privacy settings for saving

### Signature Section
- [ ] emailSignatureInlinePreview — clickable preview of current signature
- [ ] emailSignature (hidden textarea) — stores raw signature markdown
- [ ] "✏️ Edit Signature" button — openSignatureModal()
- [ ] openSignatureModal() — opens signature editing modal
- [ ] _updateSignatureInlinePreview() — renders signature preview from stored value

### Attachments Section
- [ ] "📎 View All Attachments" button — navigates to /attachments page

### Display & Bundles Section
- [ ] emailGroupBy (select) — Group Emails By (Date/None)
- [ ] emailPaginate (checkbox) — Paginate Emails (50 at a time with Load More)
- [ ] bundlesEnabled (checkbox) — Enable Email Bundles
- [ ] bundlesMultiPlacement (checkbox) — Allow Multi-Placement
- [ ] bundlesShowCount (select) — Bundle Count Display (Unread/Total/Both/Hidden)

### Auto-Bundles Section
- [ ] autoBundleToggles container — checkboxes for built-in auto-bundle categories
- [ ] _renderAutoBundleToggles(settings) — renders auto-bundle toggle checkboxes

### Badges (Smart Actions) Section
- [ ] smart-actions-max (select) — Max badges per email (1/2/3/5/10)
- [ ] smart-actions-categories container — detector category toggles
- [ ] smart-actions-custom-list container — custom detector list
- [ ] "+ Add Custom Detector" button — opens custom detector modal
- [ ] _initBadgesSettings() — initializes badges settings UI
- [ ] _gatherBadgesConfig() — collects badges configuration for saving

### Custom Detector Modal
- [ ] badge-custom-modal-overlay — modal overlay
- [ ] badge-custom-name (text input) — detector name
- [ ] badge-custom-category (select) — category (Custom/Package/Flight/Hotel/etc.)
- [ ] badge-custom-modal-title — modal title (Add/Edit)
- [ ] Save/Cancel/Delete buttons within modal
