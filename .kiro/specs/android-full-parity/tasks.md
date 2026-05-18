# Implementation Plan

## Overview
Bring the CWOC Android app to 100% visual-state parity with the mobile web version across 9 phases, implementing 30 requirements covering navigation fixes, tab sub-modes, email client, settings completion, missing screens, maps/people parity, omni view, editor/modals, and polish items.

## Tasks

- [x] 1. Add Indicators tab to CCaptnTabRow and register in cCaptnRoutes
  - [x] 1.1. Add `Indicators("Indicators", "indicators", Icons.Default.ShowChart)` entry to `CCaptnTab` enum in `CCaptnTabRow.kt`
  - [x] 1.2. Add `Screen.Indicators.route` to the `cCaptnRoutes` set in `MainActivity.kt`
  - [x] 1.3. Verify Indicators screen renders with full nav chrome (drawer, top bar, tab row) when tapped

- [x] 2. Create and register Audit Log screen
  - [x] 2.1. Create `ui/screens/auditlog/AuditLogViewModel.kt` with state for entries, filters (entity type, actor, date range), pagination (offset, limit, total), and API fetch logic calling `GET /api/audit`
  - [x] 2.2. Create `ui/screens/auditlog/AuditLogScreen.kt` with TopAppBar (title + back button), filter chips for entity type, date pickers, LazyColumn of entry cards showing timestamp/actor/action/entity/changes, and pagination controls
  - [x] 2.3. Register `composable(Screen.AuditLog.route) { AuditLogScreen(...) }` in `CwocNavGraph.kt`
  - [x] 2.4. Verify tapping "Audit Log" in sidebar navigates without crash and displays entries

- [x] 3. Create and register Custom Objects Editor screen
  - [x] 3.1. Create `ui/screens/customobjects/CustomObjectsViewModel.kt` with state for object type list, CRUD operations calling `GET/POST/PUT/DELETE /api/custom-objects`
  - [x] 3.2. Create `ui/screens/customobjects/CustomObjectsScreen.kt` with TopAppBar (title + back + "New Type" button), expandable type list showing fields, and create/edit form with field definitions (name, type, unit, min/max)
  - [x] 3.3. Register `composable(Screen.CustomObjects.route) { CustomObjectsScreen(...) }` in `CwocNavGraph.kt`
  - [x] 3.4. Verify tapping "Custom Objects" in sidebar navigates without crash and displays type list

- [x] 4. Add Tasks tab sub-mode toggles (Tasks | Habits | Assigned)
  - [x] 4.1. Add FilterChip row at top of `TasksScreen` with Tasks/Habits/Assigned options and `tasksMode` state variable
  - [x] 4.2. Implement Habits mode: filter chits to `habit == true`, create `HabitCard` composable showing progress bar (success/goal), streak badge, reset period, grouped into On Deck / Out of Mind / Accomplished sections
  - [x] 4.3. Implement Assigned mode: filter chits to `assignedTo == currentUsername`, display in same card format as Tasks mode

- [x] 5. Add Alarms tab Notifications and Reminders sub-modes
  - [x] 5.1. Extend `alertsMode` state in `AlertsScreen` to support 4 values: "list", "independent", "notifications", "reminders"
  - [x] 5.2. Add Notifications and Reminders FilterChips to the existing toggle row
  - [x] 5.3. Implement Notifications mode: filter alerts where `alertType == "notification"`
  - [x] 5.4. Implement Reminders mode: filter alerts where `alertType == "reminder"`

- [x] 6. Add Projects tab List/Tree view toggle
  - [x] 6.1. Add `projectsMode` state ("kanban" | "list") and FilterChip toggle to `ProjectsScreen`
  - [x] 6.2. Implement List mode: LazyColumn showing project masters as headers with indented child chits below, each showing title + status + priority + due date

- [x] 7. Add Indicators Calendar and Log sub-modes
  - [x] 7.1. Add `indicatorsMode` state ("charts" | "calendar" | "log") and 3-way FilterChip toggle to `IndicatorsScreen`
  - [x] 7.2. Implement Calendar mode: year-grid composable showing 12 months x days, each day cell color-coded based on indicator values (good/neutral/bad thresholds from custom object definitions)
  - [x] 7.3. Implement Log mode: LazyColumn of indicator entries in reverse chronological order showing date, indicator name, value, and associated chit title

- [x] 8. Add Month view Compress/Scroll toggle
  - [x] 8.1. Add `monthMode` state ("compress" | "scroll") to `CalendarViewModel` and FilterChip toggle visible only when `viewMode == MONTH`
  - [x] 8.2. Implement Compress mode: fixed-height day cells with `maxLines` truncation on event text
  - [x] 8.3. Implement Scroll mode: day cells expand to fit all events, month grid wrapped in vertical scroll

- [x] 9. Add Email tab to CCaptnTabRow and navigation
  - [x] 9.1. Add `Email("Email", "email", Icons.Default.Email)` to `CCaptnTab` enum
  - [x] 9.2. Add `Screen.Email.route` to `cCaptnRoutes` in `MainActivity.kt`
  - [x] 9.3. Register `EmailScreen` composable in `CwocNavGraph.kt`

- [x] 10. Create EmailViewModel with folder filtering and threading
  - [x] 10.1. Create `ui/screens/email/EmailViewModel.kt` with state for currentFolder, activeBundle, accountFilter, threaded email list, and unreadCount
  - [x] 10.2. Implement folder filtering logic: query Room for chits with email fields, apply folder rules (Inbox=tag "Inbox" + not archived, Sent=tag "Sent", Drafts=status "draft" + no send_at, Scheduled=status "draft" + has send_at, Trash=tag "Trash", Archived=archived)
  - [x] 10.3. Implement threading: group emails by normalized subject (strip Re:/Fwd:) + email_in_reply_to/email_references chain

- [x] 11. Create EmailScreen with folder chips, bundle tabs, and email list
  - [x] 11.1. Create `ui/screens/email/EmailScreen.kt` with ChitListScaffold wrapper, folder FilterChips row, bundle tabs LazyRow (visible when folder=Inbox), account filter pills
  - [x] 11.2. Create `EmailThreadCard` composable showing: unread dot, sender, reply indicator, subject, tag chips, attachment icon, preview snippet, date, badge chips
  - [x] 11.3. Implement thread expansion: tap card -> expand inline showing all messages, tap message -> navigate to editor
  - [x] 11.4. Implement swipe actions: swipe right -> archive, swipe left -> delete (move to trash)

- [x] 12. Implement email compose via editor Email Zone
  - [x] 12.1. Create `EmailComposeZone` composable with From dropdown, To/CC/BCC chip inputs with contact autocomplete, Subject field, Body markdown area, and action buttons (Send, Send Later, Discard)
  - [x] 12.2. Show `EmailComposeZone` in `ChitEditorScreen` when `formState.emailStatus == "draft"`
  - [x] 12.3. Implement Send flow: save chit -> call `POST /api/email/send/{chitId}` with UndoToast delay -> navigate back
  - [x] 12.4. Implement Reply/Forward: create new draft chit with email_in_reply_to set, subject prefixed, body quoted, navigate to editor

- [x] 13. Add unread badge to Email tab and sidebar controls
  - [x] 13.1. Pass `unreadCount` from EmailViewModel to CCaptnTabRow via `tabCounts` map for Email tab badge
  - [x] 13.2. Add email sidebar controls (folder radios, account checkboxes, "Check Mail" button, unread-at-top toggle) visible when Email tab is active

- [x] 14. Create Collections settings tab
  - [x] 14.1. Create `CollectionsSettingsTab.kt` and add "Collections" tab to the settings tab list (between Views and Email)
  - [x] 14.2. Implement Tag Editor section: hierarchical tag tree display with color swatches, create/edit/delete via `CwocPromptDialog` + color picker, drag-to-reorder, persists to `shared_tags` in settings
  - [x] 14.3. Implement Custom Colors section: default palette display + user-defined colors list, add (hex picker), edit, swipe-to-delete, border color assignment dropdown
  - [x] 14.4. Implement Saved Locations section: list with name/address/coordinates, radio for default, add with geocode lookup, edit, swipe-to-delete, reorderable
  - [x] 14.5. Implement Default Notifications section: start-time and due-time notification rule lists with offset dropdowns, add/remove rules

- [x] 15. Replace Email settings placeholder with real implementation
  - [x] 15.1. Create `EmailSettingsTab.kt` replacing `EmailSettingsPlaceholder()` with Accounts & Syncing section (account card list with IMAP/SMTP fields, add/edit/delete, sync settings)
  - [x] 15.2. Add Privacy & Sending section: tracking block toggle, external content dropdown, read receipts toggle, undo send delay dropdown, signature text field, max attachment size dropdown
  - [x] 15.3. Add Display & Bundles section: group-by toggle, paginate toggle + page size, bundles enable/multi-placement/count toggles, auto-bundles rule list

- [x] 16. Replace Badges settings placeholder with real implementation
  - [x] 16.1. Create `BadgesSettingsTab.kt` replacing `BadgesSettingsPlaceholder()` with display settings (max badges per email dropdown), built-in detector list with enable/disable toggles, custom detector CRUD (name, regex, icon, enabled)

- [x] 17. Complete Admin settings tab missing sections
  - [x] 17.1. Add Data Management section: Export All (GET /api/export -> share file), Import (file picker -> POST /api/import), Replace All (danger confirm -> POST /api/replace), Purge All (double confirm -> DELETE /api/purge)
  - [x] 17.2. Add Calendar Export section: ICS feed URL display with copy button, subscription instructions text
  - [x] 17.3. Add Dependent Apps section: Tailscale status/info, Ntfy server URL + topic + test button, Home Assistant URL + token + test button
  - [x] 17.4. Add Version & Updates section: release notes button (opens ReleaseNotesDialog), check for updates button

- [x] 18. Complete Audit Log screen with full functionality
  - [x] 18.1. Add CSV export button to top bar that calls `GET /api/audit?format=csv` and shares the file
  - [x] 18.2. Add actor dropdown filter (populated from unique actors in data)
  - [x] 18.3. Add sort-by dropdown (Time desc, Time asc, Entity, Actor)
  - [x] 18.4. Add page size dropdown (25, 50, 100, 200) and pagination controls (Previous | Page X of Y | Next)
  - [x] 18.5. Make chit entity entries tappable -> navigate to editor

- [x] 19. Complete Custom Objects Editor with full CRUD
  - [x] 19.1. Implement create type form: name field + fields list (add/remove/reorder) with field name, type dropdown (number/text/boolean/select), unit, min/max, options
  - [x] 19.2. Implement edit type: tap type -> expand to show edit form pre-populated with existing data
  - [x] 19.3. Implement delete type: swipe or button with confirmation dialog

- [x] 20. Create User Admin screen
  - [x] 20.1. Create `ui/screens/useradmin/UserAdminScreen.kt` + `UserAdminViewModel.kt` with user list from `GET /api/auth/users`, showing username, display name, role, last login
  - [x] 20.2. Implement create user: "New User" button -> form with username, display name, password, role toggle
  - [x] 20.3. Implement edit user: tap -> edit form, delete button (can't delete self)
  - [x] 20.4. Add sidebar link in `SidebarContent.kt` (visible only to admin users) and register in NavGraph

- [x] 21. Create Rules Manager and Rule Editor screens
  - [x] 21.1. Create `ui/screens/rules/RulesManagerScreen.kt` + `RulesManagerViewModel.kt` with rule list from `GET /api/rules`, showing name, trigger description, enabled toggle
  - [x] 21.2. Create `ui/screens/rules/RuleEditorScreen.kt` + `RuleEditorViewModel.kt` with name field, trigger section (type dropdown + config), action section, enabled toggle, test button
  - [x] 21.3. Add `RuleEditor` route to `Screen.kt`, register both screens in NavGraph, add Rules Manager sidebar link

- [x] 22. Create Contact Trash screen
  - [x] 22.1. Create `ui/screens/contacts/ContactTrashScreen.kt` + `ContactTrashViewModel.kt` fetching from `GET /api/contacts/trash`, showing deleted contacts with name and deleted date
  - [x] 22.2. Implement restore (POST) and purge (DELETE) actions per contact, plus bulk restore/purge all
  - [x] 22.3. Add `ContactTrash` route to `Screen.kt`, register in NavGraph, add "View Deleted" option in People screen overflow menu

- [x] 23. Create Attachments Browser screen
  - [x] 23.1. Create `ui/screens/attachments/AttachmentsScreen.kt` + `AttachmentsViewModel.kt` fetching from `GET /api/attachments`, displaying grid of attachment cards with thumbnails
  - [x] 23.2. Implement filter bar (type dropdown, size range, search), sort dropdown (date/name/size), multi-select with bulk delete
  - [x] 23.3. Implement preview: tap card -> dialog with full image/video/audio player or download prompt
  - [x] 23.4. Add `Attachments` route to `Screen.kt`, register in NavGraph, add sidebar link

- [x] 24. Create Admin Chits screen
  - [x] 24.1. Create `ui/screens/adminchits/AdminChitsScreen.kt` + `AdminChitsViewModel.kt` fetching from `GET /api/admin/chits`, showing all chits with title, owner, status, created date, tags
  - [x] 24.2. Implement bulk actions (delete, change owner, change status), owner filter dropdown, search field
  - [x] 24.3. Add `AdminChits` route to `Screen.kt`, register in NavGraph, add access from Admin Settings tab "Chit Manager" button

- [x] 25. Add Maps Chits/Both/People mode toggle
  - [x] 25.1. Add `mapMode` state to `MapViewModel` and FilterChip row (Chits | Both | People) to `MapScreen`
  - [x] 25.2. Implement People mode: fetch contacts from Room, geocode addresses, display markers with person icon and different color
  - [x] 25.3. Implement Both mode: display both chit markers and contact markers simultaneously
  - [x] 25.4. Add "All People" checkbox and tap-contact-marker -> navigate to contact editor

- [x] 26. Add People page Grouped mode
  - [x] 26.1. Add `isGrouped` state (persisted to SharedPreferences) and toggle button to `ContactListScreen`
  - [x] 26.2. Implement Grouped mode: 4 collapsible sections (Favorites, Users from `/api/auth/switchable-users`, All Contacts, Vault Contacts) with section headers showing count and expand/collapse
  - [x] 26.3. Add import/export overflow menu: Import vCard (file picker -> POST), Import CSV, Export vCard (GET -> share), Export CSV, View Deleted (navigate to Contact Trash)

- [x] 27. Add Contact Editor Profile mode
  - [x] 27.1. Add optional `userId` navigation argument to ContactEditor route
  - [x] 27.2. When `userId` is provided: fetch from `/api/auth/users/{userId}/profile`, display as "Profile" title, read-only for other users, editable for self with save to `PUT /api/auth/users/{userId}/profile`
  - [x] 27.3. Wire navigation from People -> Users section -> tap user -> contact editor in profile mode

- [x] 28. Add HST Bar and Weather sections to Omni View
  - [x] 28.1. Add `OmniSectionType.HST`, `WEATHER`, `HST_WEATHER`, `HST_TEMP_STRIP` to the section type enum and update `OmniViewViewModel` to provide data for them
  - [x] 28.2. Implement HST section: horizontal `LazyRow` showing next 12-24 hours with time labels, event titles, and weather icons; tap event -> editor
  - [x] 28.3. Implement Weather section: card with current temp/condition/high/low/location + 3-5 hour forecast strip; tap -> Weather screen

- [x] 29. Add Email and Pinned All sections to Omni View
  - [x] 29.1. Implement Email section: show up to N recent unread emails (from settings), each with sender/subject/time, "Show More" pagination, tap -> editor; only visible when email accounts configured
  - [x] 29.2. Implement Pinned All section: combined list of all pinned chits (notes + checklists + others), sorted by modified date, with type indicator icons
  - [x] 29.3. Add `OmniSectionType.EMAIL` and `PINNED_ALL` to enum and wire data in ViewModel

- [x] 30. Create Omni Layout Configuration dialog
  - [x] 30.1. Create `ui/screens/omni/OmniLayoutDialog.kt` as bottom sheet showing all sections with drag handles for reorder and visibility toggles (eye icon)
  - [x] 30.2. Add "Configure" gear icon button in Omni View top area that opens the layout dialog
  - [x] 30.3. Persist layout to `omni_layout` settings field (JSON array of {id, visible, position, hideWhenEmpty}) and immediately update Omni View on save

- [x] 31. Implement full Email Compose Zone in editor
  - [x] 31.1. Create `EmailComposeZone` composable with From dropdown (configured accounts), To/CC/BCC chip inputs with contact autocomplete, Subject field, Body markdown area
  - [x] 31.2. Add action buttons: Send (POST /api/email/send/{chitId} with UndoToast), Send Later (date/time picker -> set email_send_at), Send & Archive, Discard Draft
  - [x] 31.3. For received emails: show read-only From/To/CC/Subject/Body with Reply/Forward/Archive buttons and HTML/Text body toggle
  - [x] 31.4. Show EmailComposeZone in ChitEditorScreen when `formState.emailStatus` is "draft", "received", or "sent"

- [x] 32. Implement Attachment Upload in editor
  - [x] 32.1. Replace read-only AttachmentsZone with functional version: "Add Attachment" button -> Android file picker, upload via multipart POST to `/api/chits/{chitId}/attachments`, show progress indicator
  - [x] 32.2. Display attachment list with filename, size, type icon, delete button; tap -> download/open with system viewer; image attachments show thumbnail

- [x] 33. Implement Calendar pre-fill for new chits
  - [x] 33.1. Add tap handler on empty time slots in DayTimeGrid and WeekTimeGrid that navigates to `editor/new?start={datetime}&end={datetime}`
  - [x] 33.2. In ChitEditorViewModel, parse start/end query params and pre-fill `startDatetime` and `endDatetime` in form state

- [x] 34. Create Tag Create/Edit dialog
  - [x] 34.1. Create `ui/components/TagCreateDialog.kt` with name field, color picker (swatches), optional parent tag dropdown
  - [x] 34.2. Add "Create Tag" button at bottom of TagsPickerSheet that opens the dialog; on save, add to `shared_tags` in settings and sync

- [x] 35. Create remaining modals and dialogs
  - [x] 35.1. Create `RecurringEditDialog.kt`: AlertDialog with 4 options (This instance / All events / This and following / Cancel), shown when editing recurring chits
  - [x] 35.2. Extend `ChitActionMenu` for project masters: add "Create Child Chit" option that opens CwocPromptDialog for title, creates chit via API, adds to project's child_chits
  - [x] 35.3. Create `ReleaseNotesDialog.kt`: bottom sheet fetching from `GET /api/release-notes`, showing markdown content with Older/Newer day navigation buttons
  - [x] 35.4. Create `ImageViewDialog.kt`: full-screen overlay with pinch-to-zoom image, tap to dismiss, share button
  - [x] 35.5. Add camera capture to ContactEditorScreen: tap profile image -> options (Take Photo / Choose Gallery / Remove), camera intent + crop + upload to `/api/contacts/{id}/image`
  - [x] 35.6. Create `QrCodeDialog.kt`: generate QR code from contact vCard string using ZXing, display in dialog with Share and Copy buttons; accessible from contact editor overflow menu

- [x] 36. Create Calculator bottom sheet
  - [x] 36.1. Create `ui/components/CalculatorSheet.kt` with display area (expression + result), number pad (0-9, decimal), operators (+, -, x, /), Clear/Backspace/Equals/Insert buttons
  - [x] 36.2. Implement correct operator precedence (x and / before + and -), live result preview, and "Insert" button that inserts result into the currently focused editor text field
  - [x] 36.3. Add access point: editor overflow menu -> "Calculator" option

- [x] 37. Create Arrange Views dialog for tab order
  - [x] 37.1. Create `ui/components/ArrangeViewsDialog.kt` showing all CCaptnTab entries with drag handles and visibility toggles
  - [x] 37.2. Persist order to `view_order` settings field; update `CCaptnTabRow` to read `view_order` and render tabs in saved order, hiding disabled ones
  - [x] 37.3. Add "Arrange Views" button in Settings -> Views tab that opens the dialog

- [x] 38. Add Trash email filter and remaining polish items
  - [x] 38.1. Add FilterChip row ("All" | "Emails Only") to `TrashScreen`; when "Emails Only" selected, filter to chits with email_message_id or email_status
  - [x] 38.2. Create `AlarmFiredActivity.kt`: full-screen Activity showing over lock screen with alarm title/time, Dismiss/Snooze buttons, alarm sound + vibration
  - [x] 38.3. Verify Help screen loads all 41 topics from `GET /api/docs` with proper markdown rendering and topic navigation
  - [x] 38.4. Ensure Contact Editor vault toggle is visible and functional, defaulting based on `default_share_contacts` setting

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": "wave-1",
      "name": "Fix Broken Navigation",
      "tasks": [1, 2, 3],
      "dependencies": []
    },
    {
      "id": "wave-2",
      "name": "Tab Sub-Modes",
      "tasks": [4, 5, 6, 7, 8],
      "dependencies": ["wave-1"]
    },
    {
      "id": "wave-3",
      "name": "Email Client Foundation",
      "tasks": [9, 10],
      "dependencies": ["wave-1"]
    },
    {
      "id": "wave-4",
      "name": "Email Client UI",
      "tasks": [11, 12, 13],
      "dependencies": ["wave-3"]
    },
    {
      "id": "wave-5",
      "name": "Settings Completion",
      "tasks": [14, 15, 16, 17],
      "dependencies": ["wave-1"]
    },
    {
      "id": "wave-6",
      "name": "Missing Screens",
      "tasks": [18, 19, 20, 21, 22, 23, 24],
      "dependencies": ["wave-1"]
    },
    {
      "id": "wave-7",
      "name": "Maps and People Parity",
      "tasks": [25, 26, 27],
      "dependencies": ["wave-6"]
    },
    {
      "id": "wave-8",
      "name": "Omni View Completion",
      "tasks": [28, 29, 30],
      "dependencies": ["wave-4"]
    },
    {
      "id": "wave-9",
      "name": "Editor and Modals",
      "tasks": [31, 32, 33, 34, 35],
      "dependencies": ["wave-4", "wave-5"]
    },
    {
      "id": "wave-10",
      "name": "Polish and Remaining",
      "tasks": [36, 37, 38],
      "dependencies": ["wave-9"]
    }
  ]
}
```

## Notes

- All new screens follow the existing MVVM pattern: `{Feature}Screen.kt` + `{Feature}ViewModel.kt`
- Screens using sync data query Room DB via repository flows; screens needing direct API calls (Audit Log, Custom Objects, User Admin, Rules) use Retrofit/OkHttp from ViewModel
- No software installation required — this is purely Kotlin/Compose code changes
- The web implementation files (referenced in each phase spec) serve as the authoritative source for behavior details
- Each phase can be independently verified by checking that all new screens/modes are reachable from the UI
