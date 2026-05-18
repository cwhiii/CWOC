# Phase 6: Maps & People Parity

## Problem
The Maps screen only shows chit markers (no People/Both mode). The People screen only shows a flat list (no grouped mode). The Contact Editor has no profile mode for viewing user profiles.

## Tasks

### 6.1 Maps — Add Chits/Both/People Mode Toggle
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/map/MapScreen.kt`
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/map/MapViewModel.kt`

The web has a 3-way toggle: Chits | Both | People.

**Add a FilterChip row** at the top of the map:
- **Chits** (default): Current behavior — shows markers for chits with locations
- **People**: Shows markers for contacts with addresses (geocoded)
- **Both**: Shows both chit markers and contact markers simultaneously

**Implementation:**
1. Add `mapMode: String` state to MapViewModel ("chits", "people", "both")
2. Fetch contacts from Room (ContactEntity) and geocode their addresses
3. Use different marker colors/icons for chits vs contacts:
   - Chits: existing marker style
   - Contacts: different color (e.g., blue) with person icon
4. Tap contact marker → navigate to contact editor
5. Add "All People" checkbox — when checked, shows ALL contacts regardless of date filters

**Also add sidebar filters** (matching web):
- Date range filter (affects which chits show, not contacts unless "All People" is unchecked)
- Tag filter
- Status filter

**Web reference:** `src/frontend/js/pages/maps.js` (`_mapsSetMode`, `_switchToPeopleMode`, `_switchToBothMode`, `_fetchAndDisplayContacts`)

### 6.2 People — Add Grouped Mode
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactListScreen.kt`
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactListViewModel.kt`

The web has Grouped (default) | Ungrouped toggle.

**Add a toggle button** in the top bar or as a FilterChip:
- **Grouped** (default): Contacts organized into collapsible sections:
  1. **Favorites** — contacts marked as favorite
  2. **Users** — app users (from `/api/auth/switchable-users`)
  3. **All Contacts** — non-vault contacts
  4. **Vault Contacts** — contacts with vault=true (shared across users)
- **Ungrouped**: Current behavior — flat alphabetical list

**Implementation:**
1. Add `isGrouped: Boolean` state (persisted to SharedPreferences)
2. Fetch users from `/api/auth/switchable-users` for the Users section
3. Render each section with a collapsible header (section name + count + expand/collapse arrow)
4. Users section shows user rows (tap → navigate to contact editor in profile mode)

**Web reference:** `src/frontend/js/pages/people.js` (`_grouped`, `_renderList`)

### 6.3 People — Add Import/Export
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactListScreen.kt`

Add overflow menu (⋮) in the top bar with:
- **Import vCard** — file picker for .vcf files, calls `POST /api/contacts/import/vcard`
- **Import CSV** — file picker for .csv files, calls `POST /api/contacts/import/csv`
- **Export vCard** — calls `GET /api/contacts/export/vcard`, saves/shares the file
- **Export CSV** — calls `GET /api/contacts/export/csv`, saves/shares the file
- **View Deleted** — navigates to Contact Trash screen (from Phase 5)

**Web reference:** `src/frontend/js/pages/people.js` (import/export buttons)

### 6.4 Contact Editor — Add Profile Mode
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorScreen.kt`
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorViewModel.kt`

The web has `?mode=profile&user_id=...` which shows a user's profile (their contact info as a user, not a contact record).

**Implementation:**
1. Add optional `userId` parameter to the ContactEditor route: `contact-editor/{contactId}?userId={userId}`
2. When `userId` is provided:
   - Fetch user profile from `/api/auth/users/{userId}/profile`
   - Show the same contact editor form but with:
     - Title says "Profile" instead of "Edit Contact"
     - If viewing another user's profile (not self): read-only mode
     - If viewing own profile: editable, save calls `PUT /api/auth/users/{userId}/profile`
3. Navigate to profile mode from:
   - People screen → Users section → tap user row
   - Settings → profile button (if exists)

**Web reference:** `src/frontend/js/pages/contact-editor.js` (`_isProfileMode`, `_initProfileMode`)

## Verification
- [ ] Maps shows Chits | Both | People toggle
- [ ] People mode shows contact markers with person icons
- [ ] Both mode shows both chit and contact markers
- [ ] Tap contact marker navigates to contact editor
- [ ] "All People" checkbox shows all contacts regardless of filters
- [ ] People screen shows Grouped | Ungrouped toggle
- [ ] Grouped mode shows Favorites / Users / All Contacts / Vault sections
- [ ] Each section is collapsible with count
- [ ] Users section shows app users, tap navigates to profile
- [ ] Import vCard/CSV works via file picker
- [ ] Export vCard/CSV saves/shares file
- [ ] Contact Editor in profile mode shows user profile (read-only for others, editable for self)
