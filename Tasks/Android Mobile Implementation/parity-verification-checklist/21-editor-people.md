# People

**Category:** Editor Zones
**Item #:** 21
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### People Zone Structure (editor.html)

- [ ] `<div id="peopleSection" class="zone-container">` — People zone container
- [ ] `<div id="peopleContent" class="zone-body">` — People zone body (collapsible)
- [ ] Zone header with expand/collapse toggle
- [ ] `<span id="activePeopleCount">` — Count of active people (contacts + shared users)

### People Zone Header Buttons (editor.html)

- [ ] Expand/Collapse All button (`id="people-expand-collapse-btn"`) — Toggles all letter groups
- [ ] Stealth button (`id="stealthHeaderBtn"`) — Toggles stealth mode (hide from other users)
- [ ] Add Contact button — Navigates to contact editor
- [ ] Expand Modal button — Opens fullscreen people management modal (desktop only)

### People Search (editor-people.js)

- [ ] `<input id="peopleSearchInput">` — People search input
- [ ] `_initPeopleAutocomplete()` — Initializes search, loads contacts and users
- [ ] `_clearPeopleSearch(event)` — Clears search input and resets filter
- [ ] `_focusPeopleSearch()` — Focuses the search input
- [ ] Search filters across all contact fields (name, email, org, notes, tags)
- [ ] Enter key adds typed name as free-text person
- [ ] Escape key clears search

### People Chips (Right Column) (editor-people.js)

- [ ] `<div id="peopleChips">` — Container for people chips (contacts + shared users)
- [ ] `_renderPeopleChips()` — Renders all contact chips and shared user rows
- [ ] `_addPeopleChip(data)` — Adds a contact chip (display_name, id, color, image_url)
- [ ] `_removePeopleChip(index)` — Removes a contact chip by index
- [ ] `_syncPeopleHiddenField()` — Syncs hidden `#people` input with chip display names
- [ ] `_updateActivePeopleCount()` — Updates the active count badge
- [ ] `_setPeopleFromArray(peopleArray)` — Populates chips from chit's people array

### Contact Chip Features (editor-people.js)

- [ ] Chip thumbnail: profile image or `?` placeholder
- [ ] Chip name text
- [ ] ✕ remove button on each chip
- [ ] Double-click opens contact editor in new tab
- [ ] Shift+click or right-click opens context menu
- [ ] `_showPeopleChipContextMenu(e, chipData, chipIdx)` — Context menu with View Contact and Remove options

### People Tree (Left Column) (editor-people.js)

- [ ] `<div id="peopleTreeContainer">` — Container for the merged alphabetical tree
- [ ] `_renderPeopleTree(filter)` — Renders merged tree of contacts + system users
- [ ] Letter group headers (A, B, C...) — clickable to expand/collapse
- [ ] `_peopleGroupsExpanded` — Tracks which letter groups are expanded
- [ ] `_currentPeopleFilter` — Current search filter (preserved across re-renders)

### Contact Loading (editor-people.js)

- [ ] `_loadAllContactsForTree()` — Fetches all contacts from `/api/contacts`
- [ ] `_allContactsCache` — Full contacts list cache
- [ ] `_contactMatchesFilter(c, filter)` — Multi-field contact search (delegates to `cwocContactMatchesFilter`)

### System User Loading (editor-people.js)

- [ ] `_loadAllUsersForTree()` — Fetches system users from `/api/auth/switchable-users`
- [ ] `_allUsersCache` — System users cache
- [ ] Current user excluded from tree display
- [ ] Owner excluded from tree for non-owner users

### Contact Chips in Tree (editor-people.js)

- [ ] `_renderContactChipInTree(parent, c)` — Renders a contact chip in the tree
- [ ] Chip with thumbnail (image or placeholder), name, favorite star prefix
- [ ] Click adds contact to chit (moves to right column)
- [ ] Already-added contacts hidden from tree

### User Chips in Tree (editor-people.js)

- [ ] `_renderUserChipInTree(parent, u, showControls)` — Renders a system user chip in the tree
- [ ] User icon placeholder (`<i class="fas fa-users">`)
- [ ] Username shown on hover (title attribute)
- [ ] Click adds user as shared viewer (moves to right column)
- [ ] Already-shared users hidden from tree
- [ ] Only shown when user has sharing controls (owner/manager)

### Sharing Controls (editor-people.js)

- [ ] `_addShare(userId, role, displayName)` — Adds a share entry (viewer/manager)
- [ ] `_removeShare(userId)` — Removes a share entry
- [ ] `_updateShareRole(userId, newRole)` — Changes share role (viewer ↔ manager)
- [ ] `_findShareByUserId(userId)` — Finds share entry by user ID
- [ ] `_getUserInfoById(userId)` — Gets user info from cache
- [ ] `_currentShares` — Array of share entries `{user_id, role, display_name, rsvp_status}`
- [ ] Self-invite prevention (current user cannot share with self)

### Shared User Display (editor-people.js)

- [ ] Shared user rows in right column with:
  - [ ] User chip (avatar, name, ✕ remove)
  - [ ] RSVP status badge (✓ accepted, ✗ declined, ⏳ invited)
  - [ ] Pill toggle (👁️ V / ✏️ M) for viewer/manager role
  - [ ] Assigned indicator (📌 thumbtack) — clickable to toggle assignment
- [ ] Pill toggle click flips role between viewer and manager
- [ ] Assigned indicator click toggles assignment in dropdown

### RSVP Controls (editor-people.js)

- [ ] RSVP badge classes: `cwoc-editor-rsvp-accepted`, `cwoc-editor-rsvp-declined`, `cwoc-editor-rsvp-invited`
- [ ] Accept button (✓) — PATCH to `/api/chits/{id}/rsvp` with `{rsvp_status: 'accepted'}`
- [ ] Decline button (✗) — PATCH to `/api/chits/{id}/rsvp` with `{rsvp_status: 'declined'}`
- [ ] RSVP actions only shown for current user's own share entry (not owner)

### Stealth Mode (editor-people.js)

- [ ] `<input type="checkbox" id="sharingStealthToggle">` — Hidden stealth checkbox
- [ ] `_renderStealthToggle()` — Renders stealth toggle (ensures checkbox exists)
- [ ] `_toggleStealthFromHeader(event)` — Toggles stealth from header button
- [ ] `_updateStealthHeaderBtn()` — Updates stealth button appearance (active/inactive)
- [ ] `_applyStealthGreyout()` — Greys out sharing controls when stealth is on
- [ ] Stealth disables: tree container, chips, assigned-to row, search input

### Assigned-To Dropdown (editor-people.js)

- [ ] `_syncAssignedToDropdown()` — Populates dropdown with owner + all system users
- [ ] `_onAssignedToChange()` — Auto-adds assigned user to shares as manager
- [ ] Dropdown disabled for viewers (read-only)
- [ ] Owner shown as "(owner)" in dropdown
- [ ] Username shown alongside display name when different

### Sharing Initialization (editor-people.js)

- [ ] `initPeopleSharingControls(chit)` — Initializes sharing for existing chit
- [ ] `initPeopleSharingForNewChit()` — Initializes sharing for new chit
- [ ] `_effectiveRole` — Current user's role: 'owner', 'manager', 'viewer', or null
- [ ] `_chitOwnerId` — Owner user_id of current chit
- [ ] `_chitOwnerDisplayName` — Owner display name
- [ ] `_sharingInitialized` — Flag indicating sharing has been initialized

### Expand/Collapse Functions (editor-people.js)

- [ ] `_toggleAllPeopleGroups(event, expand)` — Expands/collapses all letter groups
- [ ] `_togglePeopleExpandCollapse(event)` — Toggles expand/collapse state
- [ ] `_updatePeopleExpandCollapseBtn()` — Updates button icon/text (both zone and modal)
- [ ] `var _peopleGroupsAllExpanded` — Tracks current expand/collapse state

### Add New Contact (editor-people.js)

- [ ] `_addNewContactFromEditor(event)` — Navigates to contact editor with save check

### People Expand Modal (editor-people.js)

- [ ] `openPeopleExpandModal(event)` — Opens fullscreen management modal (desktop only, ≤768px returns)
- [ ] `closePeopleExpandModal()` — Closes the expand modal
- [ ] `_renderExpandModalContent()` — Renders full modal content (search, table, groups)
- [ ] `_onExpandModalKeydown(e)` — Enter closes modal (unless search focused)
- [ ] `_expandModalFilter` — Modal search filter state
- [ ] `_expandModalSort` — Modal column sort state `{column, dir}`

### Expand Modal Features (editor-people.js)

- [ ] Search bar with Enter-to-add and Escape-to-clear
- [ ] Sortable columns: Name, Email, Org, Notes, Status
- [ ] `_getExpandSortValue(person, key)` — Gets sortable value for a column
- [ ] `_renderExpandRow(person, showControls, assignedToId)` — Renders a single table row
- [ ] Favorites section (contacts with favorite flag)
- [ ] Alphabetical letter groups (non-favorites)
- [ ] Controls column: +/✕ button, pill toggle, assign badge, RSVP badge
- [ ] Edit column: open profile/contact in new tab
- [ ] `_el(tag, cls, text)` — Helper to create elements

### State Variables (editor-people.js)

- [ ] `_peopleChipData` — Array of `{display_name, id, color, image_url}`
- [ ] `_peopleDropdown` — Dropdown reference (legacy)
- [ ] `_peopleDebounceTimer` — Debounce timer for search
- [ ] `_peopleApiAvailable` — API availability flag
