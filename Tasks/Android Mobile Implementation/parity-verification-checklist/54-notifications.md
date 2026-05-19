# Notifications

**Category:** Standalone Pages
**Item #:** 54
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] notifData — array of notification objects from API
- [ ] MONTHS — month abbreviation array for date formatting

### Toolbar
- [ ] Notification count display (#notif-count) — shows "N notifications (M pending)"

### Notifications Table
- [ ] Table columns: Chit (linked), Type, From, Status, Date, Actions
- [ ] Chit title column — linked to editor (/frontend/html/editor.html?id={chit_id})
- [ ] Type column — "Assigned" or "Shared"
- [ ] From column — owner display name
- [ ] Status column — styled span with class:
  - [ ] .notif-status-pending (brown, bold)
  - [ ] .notif-status-accepted (green)
  - [ ] .notif-status-declined (red)
- [ ] Date column — formatted as "Mon-DD HH:MM"
- [ ] Actions column:
  - [ ] For pending notifications:
    - [ ] ✅ Accept button (.cwoc-btn.restore) — onclick → respondNotification(id, 'accepted')
    - [ ] ❌ Decline button (.cwoc-btn.danger) — onclick → respondNotification(id, 'declined')
  - [ ] For non-pending notifications:
    - [ ] ✖ Dismiss button — onclick → dismissNotification(id)

### Functions — Date Formatting
- [ ] fmtDateTime(iso) — formats ISO to "Mon-DD HH:MM"

### Functions — Notification Actions
- [ ] respondNotification(notifId, status) — async PATCH /api/notifications/{id} with status, reloads
- [ ] dismissNotification(notifId) — async DELETE /api/notifications/{id}, reloads

### Functions — Data Loading
- [ ] loadNotifications() — async GET /api/notifications, sorts (pending first, then by date desc), renders table

### Functions — Rendering
- [ ] renderTable(wrap, notifications) — builds table with thead and tbody, creates rows with all columns and action buttons

### Sorting Logic
- [ ] Pending notifications sorted first
- [ ] Then sorted by created_datetime descending (newest first)

### Empty State
- [ ] "No notifications." message when list is empty

### Error States
- [ ] "Failed to load." message on API error
- [ ] "Error loading notifications." on fetch exception

### Initialization
- [ ] waitForAuth integration — waits for auth before loading
- [ ] Fallback: loads immediately if waitForAuth not available

### Page Configuration
- [ ] data-page-title="Notifications"
- [ ] data-page-icon="🔔"
- [ ] data-show-nav="notifications" — highlights notifications in nav
