# Design Document

## Overview

This design brings the CWOC Android app to full visual-state parity with the mobile web version across 9 implementation phases. The architecture follows the existing Jetpack Compose + Navigation Compose + Hilt + Room + MVVM patterns already established in the codebase.

## Architecture

### Navigation Layer
- **Screen.kt** — Sealed class defining all routes. New routes added: `Attachments`, `ContactTrash`, `AdminChits`, `RuleEditor`
- **CwocNavGraph.kt** — Registers composable destinations. Every new screen gets a `composable(Screen.X.route)` block
- **CCaptnTabRow.kt** — Tab enum extended with `Indicators` and `Email` entries
- **SidebarContent.kt** — Drawer links extended with `Attachments`, `Rules Manager`, `User Admin` (admin-only)
- **MainActivity.kt** — `cCaptnRoutes` set extended to include `Indicators` and `Email` routes for full nav chrome

### Screen Pattern (for all new screens)
Each new screen follows the established pattern:
```
ui/screens/{feature}/
  ├── {Feature}Screen.kt      — @Composable with Scaffold, TopAppBar, content
  └── {Feature}ViewModel.kt   — @HiltViewModel with StateFlow, API calls, Room queries
```

### Data Flow
All data flows through the existing sync architecture:
1. Server → `/api/sync` → `SyncEngine` → Room DB (local cache)
2. Room DB → ViewModel (via `Flow<List<Entity>>`) → Composable (via `collectAsState()`)
3. User edits → ViewModel → Room DB (mark dirty) → `PushSyncWorker` → Server

For screens that need direct API calls (Audit Log, Custom Objects, User Admin, Rules), use Retrofit/OkHttp calls from the ViewModel since these aren't part of the sync cycle.

### Component Reuse
- **ChitListScaffold** — FAB + sync indicator wrapper (Tasks, Notes, Checklists, Email)
- **SwipeableChitCard** — Swipe-to-delete/archive (Tasks, Email, Trash)
- **ChitActionMenu** — Long-press context menu (all chit list views)
- **EditorZoneHeader** — Collapsible zone headers (Editor zones, Settings sections)
- **FilterChip** — Sub-mode toggles (Tasks, Alarms, Projects, Indicators, Maps, People)
- **CwocPromptDialog** — Text input modals (Tag create, Rule name, etc.)
- **UndoToast** — Countdown undo bar (Delete, Email send)
- **SnoozePickerDialog** — Snooze time selection (Alerts, Projects)

## Design Details

### Phase 1: Fix Broken Navigation (Requirements 1-3)

**Indicators Tab Addition:**
- Add `Indicators("Indicators", "indicators", Icons.Default.ShowChart)` to `CCaptnTab` enum
- Add `Screen.Indicators.route` to `cCaptnRoutes` in `MainActivity.kt`
- The existing `IndicatorsScreen` composable is already registered in NavGraph — just needs tab access

**Audit Log & Custom Objects Registration:**
- Create minimal functional screens (not placeholders) at:
  - `ui/screens/auditlog/AuditLogScreen.kt` + `AuditLogViewModel.kt`
  - `ui/screens/customobjects/CustomObjectsScreen.kt` + `CustomObjectsViewModel.kt`
- Register both in `CwocNavGraph.kt` with `onNavigateBack` callbacks
- Both use direct API calls (not sync) since audit/custom-objects data isn't in the Room schema

### Phase 2: Tab Sub-Modes (Requirements 5, 6, 18, 19, 20, 21)

**Tasks Sub-Modes (Tasks | Habits | Assigned):**
- Add `tasksMode: String` state to `TasksScreen` (persisted via `remember { mutableStateOf("tasks") }`)
- FilterChip row at top: Tasks, Habits, Assigned
- Habits mode: filter `uiState.tasks` to `habit == true`, render with `HabitCard` composable showing progress bar, streak, sections (On Deck / Out of Mind / Accomplished)
- Assigned mode: filter to `assignedTo == currentUsername`

**Alarms Sub-Modes (add Notifications, Reminders):**
- Extend existing `alertsMode` state from 2 values to 4
- Add FilterChips for "Notifications" and "Reminders"
- Filter alerts by `alertType` field

**Projects List/Tree View:**
- Add `projectsMode: String` state ("kanban" | "list")
- FilterChip toggle at top
- List mode: `LazyColumn` with project headers + indented child items

**Indicators Calendar & Log:**
- Add `indicatorsMode: String` state ("charts" | "calendar" | "log")
- 3-way FilterChip toggle
- Calendar: year grid composable (12×31 colored cells)
- Log: `LazyColumn` of entries with date, type, value

**Month Compress/Scroll:**
- Add `monthMode: String` state ("compress" | "scroll") to `CalendarViewModel`
- FilterChip toggle visible only when `viewMode == MONTH`
- Compress: fixed-height cells with `maxLines` truncation
- Scroll: `LazyColumn` wrapping the month grid

### Phase 3: Email Client (Requirement 4)

**New files:**
- `ui/screens/email/EmailScreen.kt`
- `ui/screens/email/EmailViewModel.kt`
- `ui/screens/email/EmailThreadCard.kt`
- `ui/screens/email/EmailComposeZone.kt` (reused in editor)

**EmailScreen layout:**
1. Folder FilterChips (Inbox | Sent | Drafts | Scheduled | Trash | Archived)
2. Bundle tabs (LazyRow, only when folder=Inbox and bundles configured)
3. Account filter pills (only when multiple accounts)
4. Email list (LazyColumn of `EmailThreadCard`)

**EmailViewModel:**
- Queries Room for chits with `email_message_id != null OR email_status != null`
- Applies folder logic (tag-based filtering)
- Groups into threads by normalized subject + in_reply_to chain
- Exposes `unreadCount` for tab badge

**Email Compose (in Editor):**
- New `EmailComposeZone` composable shown when `formState.emailStatus == "draft"`
- Fields: From (dropdown), To/CC/BCC (chip inputs), Subject, Body
- Send calls `POST /api/email/send/{chitId}` with UndoToast delay

**Tab & Navigation:**
- Add `Email("Email", "email", Icons.Default.Email)` to `CCaptnTab`
- Add `Screen.Email.route` to `cCaptnRoutes`
- Register `EmailScreen` in NavGraph

### Phase 4: Settings Completion (Requirements 7, 8)

**Collections Tab (`CollectionsSettingsTab.kt`):**
- 4 collapsible sections using `EditorZoneHeader` pattern
- Tag Editor: tree list with color swatches, CRUD via settings sync
- Custom Colors: swatch grid + add button with hex picker
- Saved Locations: list with radio for default, geocode on add
- Default Notifications: offset rules list with add/remove

**Email Settings Tab (`EmailSettingsTab.kt`):**
- Replace `EmailSettingsPlaceholder()`
- Sections: Accounts (card list with expand/collapse), Privacy, Display & Bundles
- Account form: nickname, email, IMAP/SMTP host/port/user/pass

**Badges Settings Tab (`BadgesSettingsTab.kt`):**
- Replace `BadgesSettingsPlaceholder()`
- Built-in detector toggles + custom detector CRUD

**Admin Tab Additions:**
- Data Management section: Export/Import/Replace/Purge buttons with confirmation dialogs
- Calendar Export: ICS URL display + copy button
- Dependent Apps: Tailscale/Ntfy/Home Assistant config fields
- Version: Release notes button → `ReleaseNotesDialog`

### Phase 5: Missing Screens (Requirements 11-17)

Each screen follows the standard pattern. Key details:

**Audit Log:** Direct API (`GET /api/audit`), filter panel, paginated LazyColumn, entry detail expansion
**Custom Objects:** Direct API (`GET/POST/PUT/DELETE /api/custom-objects`), expandable type list, field editor
**User Admin:** Direct API (`GET/POST/PUT/DELETE /api/auth/users`), admin-only sidebar link
**Rules Manager/Editor:** Direct API (`GET/POST/PUT/DELETE /api/rules`), list → detail navigation
**Contact Trash:** Direct API (`GET /api/contacts/trash`), restore/purge actions
**Attachments Browser:** Direct API (`GET /api/attachments`), grid layout, preview dialog
**Admin Chits:** Direct API (`GET /api/admin/chits`), bulk actions, owner filter

### Phase 6: Maps & People (Requirements 9, 10, 22)

**Maps Mode Toggle:**
- Add `mapMode` state to `MapViewModel`
- FilterChip row: Chits | Both | People
- People mode: fetch contacts from Room, geocode addresses, add markers with person icon
- Both mode: show both marker sets

**People Grouped Mode:**
- Add `isGrouped` state to `ContactListViewModel`
- Grouped: 4 collapsible sections (Favorites, Users, Contacts, Vault)
- Users section fetches from `/api/auth/switchable-users`

**Contact Editor Profile Mode:**
- Add optional `userId` nav argument
- When present: fetch from `/api/auth/users/{userId}/profile`, show as read-only (or editable if self)

### Phase 7: Omni View Completion (Requirements 23, 30)

**New sections added to OmniViewScreen:**
- HST: Horizontal `LazyRow` of time slots with event/weather icons
- Weather: Card with current conditions + forecast strip
- Email: Recent unread list with pagination
- Pinned All: Combined pinned notes + checklists

**Layout Configuration (`OmniLayoutDialog.kt`):**
- Bottom sheet with draggable section list
- Each row: drag handle + name + visibility toggle
- Persists to `omni_layout` settings field

### Phase 8: Editor & Modals (Requirements 24-29)

**Email Compose Zone:** Full compose UI in editor for draft chits
**Attachment Upload:** File picker → multipart upload → refresh list
**Calendar Pre-fill:** Empty slot tap → navigate to editor with start/end params
**Tag Create Dialog:** Name + color + parent fields, saves to settings
**Recurring Edit Dialog:** 4-option AlertDialog for instance/all/following/cancel
**Project Quick Menu:** Extended ChitActionMenu with "Create Child" for project masters
**Release Notes Dialog:** Bottom sheet with markdown + day navigation
**Image View:** Full-screen overlay with pinch-to-zoom
**Camera Capture:** Camera intent + crop + upload
**QR Code:** ZXing generation + dialog display

### Phase 9: Polish (Requirement 24 + remaining)

**Calculator:** Bottom sheet with number pad, operators, live preview, insert-to-field
**Arrange Views:** Drag-to-reorder dialog for tab order, persists to `view_order`
**Trash Email Filter:** FilterChip toggle on TrashScreen
**Full-Screen Alarm:** Separate Activity with lock-screen display
**Help Verification:** Ensure all 41 topics load from API with markdown rendering

## API Endpoints Used (New)

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/api/audit` | GET | Audit Log screen |
| `/api/custom-objects` | GET/POST/PUT/DELETE | Custom Objects screen |
| `/api/auth/users` | GET/POST/PUT/DELETE | User Admin screen |
| `/api/auth/users/{id}/profile` | GET/PUT | Contact Editor profile mode |
| `/api/auth/switchable-users` | GET | People grouped mode (Users section) |
| `/api/rules` | GET/POST/PUT/DELETE | Rules Manager/Editor |
| `/api/contacts/trash` | GET | Contact Trash screen |
| `/api/contacts/trash/{id}/restore` | POST | Contact Trash restore |
| `/api/contacts/trash/{id}/purge` | DELETE | Contact Trash purge |
| `/api/contacts/import/vcard` | POST | People import |
| `/api/contacts/import/csv` | POST | People import |
| `/api/contacts/export/vcard` | GET | People export |
| `/api/contacts/export/csv` | GET | People export |
| `/api/attachments` | GET | Attachments browser |
| `/api/chits/{id}/attachments` | POST | Editor attachment upload |
| `/api/admin/chits` | GET | Admin Chits screen |
| `/api/email/send/{chitId}` | POST | Email send |
| `/api/email/check` | POST | Email manual check |
| `/api/release-notes` | GET | Release notes viewer |
| `/api/export` | GET | Data export |
| `/api/import` | POST | Data import |
| `/api/health-data` | GET | Indicators calendar/log |

## Components and Interfaces

### New Screen Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `AuditLogScreen` | `ui/screens/auditlog/` | Audit log viewer with filters and pagination |
| `CustomObjectsScreen` | `ui/screens/customobjects/` | Custom object type CRUD editor |
| `EmailScreen` | `ui/screens/email/` | Email client with folders, threads, bundles |
| `UserAdminScreen` | `ui/screens/useradmin/` | User account management (admin) |
| `RulesManagerScreen` | `ui/screens/rules/` | Automation rules list |
| `RuleEditorScreen` | `ui/screens/rules/` | Individual rule editor |
| `ContactTrashScreen` | `ui/screens/contacts/` | Deleted contacts restore/purge |
| `AttachmentsScreen` | `ui/screens/attachments/` | Attachment browser grid |
| `AdminChitsScreen` | `ui/screens/adminchits/` | Admin chit management |
| `CollectionsSettingsTab` | `ui/screens/settings/` | Tags, colors, locations, notifications |
| `EmailSettingsTab` | `ui/screens/settings/` | Email account configuration |
| `BadgesSettingsTab` | `ui/screens/settings/` | Badge detector configuration |

### New Shared Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `EmailComposeZone` | `ui/screens/email/` | Email compose UI (reused in editor) |
| `EmailThreadCard` | `ui/screens/email/` | Email thread display card |
| `HabitCard` | `ui/screens/tasks/` | Habit progress card with streak/progress |
| `TagCreateDialog` | `ui/components/` | Tag creation/editing modal |
| `RecurringEditDialog` | `ui/components/` | Recurring event edit disambiguation |
| `ReleaseNotesDialog` | `ui/components/` | Release notes viewer with day navigation |
| `ImageViewDialog` | `ui/components/` | Full-screen image viewer with zoom |
| `QrCodeDialog` | `ui/components/` | QR code generation and display |
| `CalculatorSheet` | `ui/components/` | Calculator bottom sheet |
| `ArrangeViewsDialog` | `ui/components/` | Tab order configuration |
| `OmniLayoutDialog` | `ui/screens/omni/` | Omni View section layout config |
| `AlarmFiredActivity` | `ui/screens/alerts/` | Full-screen alarm over lock screen |

### Navigation Interfaces
- `Screen.kt` extended with: `Attachments`, `ContactTrash`, `AdminChits`, `RuleEditor`
- `CCaptnTab` enum extended with: `Indicators`, `Email`
- `CwocNavGraph.kt` registers all new composables
- `SidebarContent.kt` adds links: Attachments, Rules Manager, User Admin (admin-only)

## Data Models

### New ViewModels (StateFlow-based)
| ViewModel | Key State Fields |
|-----------|-----------------|
| `AuditLogViewModel` | entries, entityTypeFilter, actorFilter, dateRange, offset, limit, total |
| `CustomObjectsViewModel` | objectTypes, selectedType, editForm |
| `EmailViewModel` | currentFolder, activeBundle, accountFilter, threads, unreadCount |
| `UserAdminViewModel` | users, selectedUser, editForm |
| `RulesManagerViewModel` | rules |
| `RuleEditorViewModel` | ruleForm, triggers, actions |
| `ContactTrashViewModel` | deletedContacts, selectedIds |
| `AttachmentsViewModel` | attachments, typeFilter, sizeRange, searchQuery, sortField, selectedIds |
| `AdminChitsViewModel` | allChits, ownerFilter, searchQuery, selectedIds |

### Data Sources
- **Room DB (via sync):** ChitEntity, ContactEntity, SettingsEntity — used by Email, Tasks, Notes, Calendar, Projects, Indicators, Maps, People, Omni View
- **Direct API calls:** Audit Log, Custom Objects, User Admin, Rules, Contact Trash, Attachments, Admin Chits — these aren't part of the sync cycle

### Settings Fields Used (from SettingsEntity)
- `shared_tags` — Tag tree (Collections tab)
- `custom_colors` — User color palette (Collections tab)
- `saved_locations` — Location list (Collections tab)
- `default_notifications` — Notification rules (Collections tab)
- `email_accounts` — Email account configs (Email Settings tab)
- `badge_detectors` — Badge detector rules (Badges tab)
- `omni_layout` — Omni View section layout (Omni View)
- `view_order` — Tab order preference (Arrange Views)

## Error Handling

- **API failures:** Show Snackbar with error message, retain last-known-good state in ViewModel
- **Empty states:** Each screen shows a descriptive empty state matching the web pattern (icon + message + action button where applicable)
- **Navigation crashes (P0 fix):** All routes registered in NavGraph before any navigation occurs; missing composables replaced with functional screens
- **Offline mode:** Screens using Room data work offline; screens using direct API calls show "No connection" state with retry button
- **Sync conflicts:** Existing ConflictBanner component handles merge conflicts from sync

## Testing Strategy

Each phase is independently verifiable:
1. **Navigation test:** Every new screen/mode is reachable from the UI without knowing routes
2. **Data test:** Screens display correct data from Room/API
3. **Interaction test:** Toggles, filters, CRUD operations work correctly
4. **Persistence test:** Mode selections and settings survive app restart
