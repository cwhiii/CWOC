# Phase 4: Settings Completion

## Problem
The Settings screen has 5 tabs but only General, Views, and Admin are real implementations. Email and Badges are placeholders. The entire Collections tab (which exists on web) is missing. Many settings sections within existing tabs are incomplete.

## Tasks

### 4.1 Add Collections Tab
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/settings/SettingsScreen.kt`

Add a "Collections" tab (insert between Views and Email in the tab list). Create `CollectionsSettingsTab.kt`.

The Collections tab contains 4 sections (each collapsible):

#### 4.1.1 Tag Editor
- Displays the full tag tree (hierarchical, parent/child)
- Each tag shows: name, color swatch, child count
- Tap tag → edit (rename, change color, change parent)
- Long-press → delete (with confirmation)
- "Add Tag" button → CwocPromptDialog for name, then color picker, then optional parent selector
- Drag-to-reorder within same level

**API:** `GET /api/settings/default_user` returns `shared_tags` (JSON array of tag objects with name, color, parent)
**Save:** Include in settings push via sync

#### 4.1.2 Custom Colors
- Shows default color swatches (the built-in palette)
- Shows user-defined custom colors below
- "Add Color" button → color picker (hex input + visual picker)
- Tap existing custom color → edit
- Swipe to delete
- Border color assignment: dropdown to pick which color gets a border treatment

**Data:** `custom_colors` field in settings (JSON array of hex strings)

#### 4.1.3 Saved Locations
- List of saved locations (name + address + coordinates)
- One marked as "default" (radio button)
- "Add Location" button → name field + address field (with geocode lookup)
- Tap to edit, swipe to delete
- Reorderable

**Data:** `saved_locations` field in settings (JSON array of objects: {name, address, lat, lon, default})

#### 4.1.4 Default Notifications
- "Start time notifications" section: list of notification rules for chit start times
- "Due time notifications" section: list of notification rules for due times
- Each rule: offset (e.g., "15 minutes before", "1 hour before", "1 day before")
- Add/remove rules

**Data:** `default_notifications` field in settings (JSON object with start_notifications and due_notifications arrays)

### 4.2 Implement Email Settings Tab (Replace Placeholder)
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/settings/SettingsScreen.kt` (replace `EmailSettingsPlaceholder`)

Create `EmailSettingsTab.kt` with sections:

#### 4.2.1 Accounts & Syncing
- List of email accounts (each with: nickname, email, IMAP host/port, SMTP host/port, username, password)
- Add account button → multi-field form
- Edit/delete existing accounts
- Syncing settings: max pull count, check interval dropdown, backfill toggle

#### 4.2.2 Privacy & Sending
- Block tracking pixels toggle
- Load external content toggle (Always / Ask / Never)
- Read receipts toggle (Send / Don't Send)
- Undo send delay (dropdown: 5s, 10s, 15s, 30s)
- Signature (multi-line text field)
- Max attachment size (dropdown: 5MB, 10MB, 25MB, 50MB)

#### 4.2.3 Display & Bundles
- Group by toggle (Thread / None)
- Paginate toggle + page size
- Bundles enable toggle
- Multi-placement toggle
- Count display toggle
- Auto-bundles section (list of auto-bundle rules)

**Data:** `email_accounts` (JSON array), plus individual settings fields

### 4.3 Implement Badges Settings Tab (Replace Placeholder)
**File:** Replace `BadgesSettingsPlaceholder` with `BadgesSettingsTab.kt`

The web's "Badges" section is about email badge detectors — patterns that detect things like tracking numbers, order confirmations, etc. in email subjects/bodies.

Sections:
- Display settings: max badges per email (dropdown)
- Built-in detectors: list with enable/disable toggles (tracking numbers, order confirmations, flight info, etc.)
- Custom detectors: list with add/edit/delete
  - Each detector: name, regex pattern, icon/emoji, enabled toggle

**Data:** `badge_detectors` field in settings (JSON array)

### 4.4 Complete Admin Tab Missing Sections
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/settings/AdminSettingsTab.kt`

Add missing sections that exist on web:

#### 4.4.1 Data Management
- Export All Data button → calls `GET /api/export` and saves/shares the JSON file
- Import Data button → file picker, then calls `POST /api/import`
- Replace All Data button (DANGER) → confirmation dialog, then `POST /api/replace`
- Purge All Data button (DANGER) → double confirmation, then `DELETE /api/purge`

#### 4.4.2 Calendar Export
- Instructions for subscribing to the CWOC calendar from Google Calendar / Apple Calendar / Outlook
- Shows the ICS feed URL: `http://{server}/api/calendar/ics`
- Copy URL button

#### 4.4.3 Dependent Apps
- Tailscale: status indicator, connection info
- Ntfy: server URL field, topic field, test button
- Home Assistant: URL field, token field, test button

#### 4.4.4 Version & Updates
- Current version display (already exists)
- Release notes button → shows release notes in a dialog/bottom sheet
- Check for updates button

## Web Reference Files
- `src/frontend/html/settings.html` — Full settings HTML structure
- `src/frontend/js/pages/settings.js` — Settings page logic (all tabs)

## Verification
- [ ] Collections tab appears between Views and Email
- [ ] Tag Editor shows full tag tree, supports create/edit/delete/reorder
- [ ] Custom Colors shows palette + user colors, supports add/edit/delete
- [ ] Saved Locations shows list with default radio, supports CRUD
- [ ] Default Notifications shows start/due rules, supports add/remove
- [ ] Email tab shows real account management (not placeholder text)
- [ ] Badges tab shows detector list with enable/disable + custom detectors
- [ ] Admin tab has Data Management, Calendar Export, Dependent Apps, Version sections
- [ ] All settings changes persist via sync
