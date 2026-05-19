# People / Contact List

**Category:** Standalone Pages
**Item #:** 39
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Toolbar Buttons
- [ ] "New Contact" button — navigates to /frontend/html/contact-editor.html
- [ ] import-btn — "Import" button (triggers file picker for .vcf/.csv)
- [ ] export-btn — "Export" button (shows export format dropdown)
- [ ] group-toggle-btn — "Group/Ungroup" button (toggles grouped/flat view)
- [ ] "Trash" button — navigates to /frontend/html/contact-trash.html
- [ ] people-search (text input) — "🔍 Search contacts..." search field

### Contact List Display
- [ ] people-list container — scrollable list of contacts
- [ ] Table header row — Name / Phone · Email · Org columns
- [ ] _renderList() — renders the full contact list (grouped or ungrouped)

### Grouped Mode (default)
- [ ] ★ Favorites section — favorited contacts and users at top
- [ ] Users section — app users (from /api/auth/switchable-users)
- [ ] All Contacts section — non-favorite, non-vault contacts
- [ ] 🏛️ Contact Vault section — vault-shared contacts
- [ ] _renderSection(sectionId, label, items, query, rowFactory) — renders a collapsible section

### Ungrouped Mode
- [ ] Combined flat alphabetical list — merges users and contacts sorted by name

### Section Collapse
- [ ] People dividers — clickable section headers with collapse toggle
- [ ] _isSectionCollapsed(sectionId) — checks localStorage for collapse state
- [ ] _toggleSection(sectionId) — toggles collapse and re-renders
- [ ] _getCollapseState() / _setCollapseState(state) — localStorage persistence
- [ ] COLLAPSE_KEY ('cwoc_people_collapsed') — localStorage key

### Group Toggle
- [ ] _loadGroupState() — loads grouped/ungrouped preference from localStorage
- [ ] _updateGroupButton() — updates button label and icon
- [ ] GROUP_KEY ('cwoc_people_grouped') — localStorage key

### Contact Row (_createRow)
- [ ] Star toggle (★/☆) — click to toggle favorite via PATCH API
- [ ] Contact thumbnail (image or placeholder icon)
- [ ] Contact name (bold if favorite)
- [ ] Contact detail line (email · phone · org)
- [ ] Vault icon (🏛️) — shown for vault contacts
- [ ] Contact color — applied as row background with auto-contrast text
- [ ] Share/QR button — shows QR code for contact sharing
- [ ] Row click — navigates to contact editor (Cmd/Ctrl+click = new tab)

### User Row (_createUserRow)
- [ ] Star toggle (★/☆) — persisted in localStorage per user
- [ ] User thumbnail (profile image or users icon placeholder)
- [ ] User display name + @username detail
- [ ] Row click — navigates to profile view (mode=profile&user_id=...)

### Search
- [ ] _onSearchInput() — client-side filter + debounced API search (300ms)
- [ ] _applyFilter() — filters contacts by name, nickname, org, emails, phones, addresses, call signs, x handles, websites, dates
- [ ] _highlightMatch(text, query) — highlights matching substring (uses cwocHighlightMatch)
- [ ] Debounced server-side search — hits /api/contacts?q=... after 300ms

### Favorite Toggle
- [ ] _toggleFavorite(contact, starEl) — PATCH /api/contacts/:id/favorite, updates UI

### Import
- [ ] import-file-input (hidden file input) — accepts .vcf, .csv
- [ ] File change handler — uploads file via POST /api/contacts/import (FormData)
- [ ] _showImportResult(result) — shows import results modal
- [ ] import-modal — import results modal overlay
- [ ] import-summary — shows imported/skipped counts
- [ ] import-errors — shows error details
- [ ] closeImportModal() — closes import modal
- [ ] Backdrop click closes modal

### Export
- [ ] export-dropdown — floating dropdown menu
- [ ] "Export as .vcf (vCard)" option — downloads /api/contacts/export?format=vcf
- [ ] "Export as .csv" option — downloads /api/contacts/export?format=csv
- [ ] _hideExportDropdown() — hides dropdown
- [ ] Click-outside closes dropdown

### QR Sharing
- [ ] _shareContact(contact) — calls showContactQrCode(contact) from contact-qr.js
- [ ] Uses shared showQRModal() overlay

### ESC Key Handler
- [ ] Closes import modal → QR overlay → export dropdown → navigates to /
- [ ] Uses capture phase for priority

### Data Loading
- [ ] loadContacts(query) — fetches from GET /api/contacts (optional ?q= param)
- [ ] _loadUsers() — fetches from GET /api/auth/switchable-users
- [ ] DOMContentLoaded — loads group state, users, contacts, wires search
