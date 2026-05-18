# Phase 5: Missing Screens

## Problem
Several pages that exist on the web have routes defined in `Screen.kt` but no actual screen implementation. Some don't even have routes or nav links.

## Tasks

### 5.1 Audit Log Screen (complete implementation from Phase 1 stub)
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/auditlog/AuditLogScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/auditlog/AuditLogViewModel.kt`

Full implementation matching the web's audit-log.html:

**Layout:**
- Top bar: "Audit Log" + back button + CSV export button
- Filter panel (collapsible or in sidebar):
  - Entity type radio: All | Chits | Contacts | Ind. Alerts | Settings | System
  - Sort by dropdown: Time ▼ | Time ▲ | Entity | Actor
  - Actor dropdown (populated from data)
  - Start date picker
  - End date picker
  - Page size dropdown (25, 50, 100, 200)
- Main content: LazyColumn of audit entries
- Pagination controls at bottom (Previous | Page X of Y | Next)

**Each audit entry card shows:**
- Timestamp (formatted)
- Actor (username)
- Action (created/updated/deleted)
- Entity type + entity ID (tap to navigate to editor if it's a chit)
- Changes summary (field: old → new, collapsible for long lists)

**API:** `GET /api/audit?entity_type=&actor=&since=&until=&offset=&limit=&sort_by=&sort_order=`

**Web reference:** `src/frontend/html/audit-log.html` (inline JS starting at line 521)

### 5.2 Custom Objects Editor Screen (complete implementation from Phase 1 stub)
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/customobjects/CustomObjectsScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/customobjects/CustomObjectsViewModel.kt`

Matches the web's custom-objects-editor.html:

**Layout:**
- Top bar: "Custom Objects" + back button + "New Type" button
- List of custom object types (each expandable)
- Each type shows: name, field count, expand arrow
- Expanded: shows all fields with type, name, unit, min/max

**Create/Edit type:**
- Name field
- Fields list (add/remove/reorder):
  - Field name
  - Field type (number, text, boolean, select)
  - Unit (optional, for numbers)
  - Min/Max (optional, for numbers)
  - Options (for select type)
- Save / Delete buttons

**API:** `GET /api/custom-objects`, `POST /api/custom-objects`, `PUT /api/custom-objects/{id}`, `DELETE /api/custom-objects/{id}`

**Web reference:** `src/frontend/html/custom-objects-editor.html`

### 5.3 User Admin Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/useradmin/UserAdminScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/useradmin/UserAdminViewModel.kt`

**Add sidebar link** in `SidebarContent.kt` (only visible to admin users).
**Register in NavGraph.**

**Layout:**
- Top bar: "User Management" + back button + "New User" button
- List of users: username, display name, role (admin/user), last login
- Tap user → edit form (username, display name, password reset, role toggle)
- Delete user button (with confirmation, can't delete self)

**API:** `GET /api/auth/users`, `POST /api/auth/users`, `PUT /api/auth/users/{id}`, `DELETE /api/auth/users/{id}`

**Web reference:** `src/frontend/html/user-admin.html`

### 5.4 Rules Manager Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/rules/RulesManagerScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/rules/RulesManagerViewModel.kt`

**Add sidebar link** in `SidebarContent.kt`.
**Register in NavGraph.**

**Layout:**
- Top bar: "Rules" + back button + "New Rule" button
- List of rules: name, trigger description, enabled toggle
- Tap rule → navigate to Rule Editor
- Swipe to delete (with confirmation)

**API:** `GET /api/rules`, `DELETE /api/rules/{id}`

### 5.5 Rule Editor Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/rules/RuleEditorScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/rules/RuleEditorViewModel.kt`

**Register in NavGraph** with route `rule-editor/{ruleId}`.

**Layout:**
- Top bar: "Edit Rule" / "New Rule" + back button + save button
- Name field
- Trigger section: type dropdown (cron, event, condition), configuration fields per type
- Action section: what happens when triggered (create chit, update chit, send notification, etc.)
- Enabled toggle
- Test button (dry run)

**API:** `GET /api/rules/{id}`, `POST /api/rules`, `PUT /api/rules/{id}`

**Web reference:** `src/frontend/html/rules-manager.html`, `src/frontend/html/rule-editor.html`

### 5.6 Contact Trash Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactTrashScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactTrashViewModel.kt`

**Add nav link** — accessible from the Contacts list screen (e.g., overflow menu "View Deleted Contacts").
**Register in NavGraph** with route `contact-trash`.

**Layout:**
- Top bar: "Deleted Contacts" + back button + "Purge All" button
- List of deleted contacts: name, deleted date
- Each row: Restore button, Purge button
- Select all + bulk restore/purge

**API:** `GET /api/contacts/trash`, `POST /api/contacts/trash/{id}/restore`, `DELETE /api/contacts/trash/{id}/purge`

### 5.7 Attachments Browser Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/attachments/AttachmentsScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/attachments/AttachmentsViewModel.kt`

**Add sidebar link** in `SidebarContent.kt`.
**Register in NavGraph** with route `attachments`. Add to `Screen.kt`.

**Layout:**
- Top bar: "Attachments" + back button + bulk delete button (when selected)
- Filter bar: type dropdown (All, Images, Videos, Audio, Documents), size range, search field
- Sort dropdown: Date ▼ | Name | Size
- Grid of attachment cards (2-3 columns):
  - Thumbnail (image preview for images, icon for others)
  - Filename
  - Size
  - Checkbox for multi-select
- Tap card → preview modal (full image, video player, audio player, or download prompt)
- Multi-select: Shift+tap for range, checkbox for toggle

**API:** `GET /api/attachments` (returns all attachments across all chits)

**Web reference:** `src/frontend/html/attachments.html`, `src/frontend/js/pages/attachments.js`

### 5.8 Admin Chits Screen
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/adminchits/AdminChitsScreen.kt`
**New file:** `android/app/src/main/java/com/cwoc/app/ui/screens/adminchits/AdminChitsViewModel.kt`

**Add nav link** — accessible from Admin Settings tab ("Chit Manager" button).
**Register in NavGraph** with route `admin-chits`. Add to `Screen.kt`.

**Layout:**
- Top bar: "Chit Manager" + back button
- Table/list of ALL chits (including other users') with: title, owner, status, created date, tags
- Bulk actions: delete, change owner, change status
- Filter by owner dropdown
- Search field

**API:** `GET /api/admin/chits` (admin-only endpoint)

**Web reference:** `src/frontend/html/admin-chits.html`

## Navigation Updates Required
**`Screen.kt`** — Add: `Attachments`, `ContactTrash`, `AdminChits`, `RuleEditor`
**`CwocNavGraph.kt`** — Register all new composables
**`SidebarContent.kt`** — Add links for: Attachments, Rules Manager (+ User Admin for admin users)

## Verification
- [ ] Audit Log shows paginated entries with filters, tapping chit entries navigates to editor
- [ ] Custom Objects shows type list, supports full CRUD on types and fields
- [ ] User Admin shows user list (admin only), supports create/edit/delete
- [ ] Rules Manager shows rule list, tap navigates to Rule Editor
- [ ] Rule Editor supports create/edit rules with triggers and actions
- [ ] Contact Trash shows deleted contacts with restore/purge
- [ ] Attachments browser shows grid with filters, preview modal works
- [ ] Admin Chits shows all chits with bulk actions (admin only)
- [ ] All screens are reachable from the UI (sidebar links, buttons, or overflow menus)
