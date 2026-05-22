# Requirements: Parity Gaps W200-W363

## Overview
Resolve all Android parity gaps identified in the W200-W363 range of the function parity audit. Each requirement maps to a cluster of missing web functions that need Android equivalents.

## Requirements

### REQ-1: Default Notifications on Date Mode (W202)
When a date mode (start date or due date) is activated on a NEW chit in the editor, auto-populate the alerts list from `settings.default_notifications`. Only fire once per mode per editing session. Only add if no notifications exist yet. Expand the alerts zone after adding.

**Acceptance Criteria:**
- Setting a start date on a new chit auto-adds notifications from `settings.default_notifications.start`
- Setting a due date on a new chit auto-adds notifications from `settings.default_notifications.due`
- Does not fire on existing chits (only new)
- Does not fire if notifications already exist
- Does not fire twice for the same mode in one session
- Alerts zone expands to show the added notifications

### REQ-2: Omni View Filter Lock System (W203-207)
Allow users to save their current sidebar filter state as "locked defaults" for the Omni View. When entering Omni View, these saved filters are automatically applied. Show a visual indicator when locked filters are active.

**Acceptance Criteria:**
- "Lock Filters" button visible only when Omni View tab is active
- Clicking "Lock" saves current filter state (statuses, tags, priorities, people, text) to `omni_locked_filters` setting
- Entering Omni View applies locked filters automatically
- 🔒 indicator shown when locked filters are active
- Filters can be cleared/changed within the session without affecting the saved lock
- Works with existing FilterSortViewModel

### REQ-3: Email Add-to-Bundle (W208-209)
Allow users to add an email to a bundle by creating a matching rule. Show a modal/sheet with match type selection (sender or subject) and bundle picker. Execute the rule creation and immediately move the email to the target bundle.

**Acceptance Criteria:**
- "Add to Bundle" action available on email chits (in email list or editor)
- Shows match type options: by sender email address, or by subject
- Shows dropdown/picker of available bundles (excluding "Everything Else")
- Calls POST `/api/bundles/{id}/add-rule` with match_type and match_value
- On success, immediately updates the chit's tags to move it to the target bundle
- Shows success/error feedback

### REQ-4: Combine Alerts Toggle (W218)
In settings, provide a toggle that controls whether alert notifications are shown as combined (single row) or individual (separate rows per type).

**Acceptance Criteria:**
- Toggle in settings (Views or General tab) for "Combine Alerts"
- When enabled, shows combined alert configuration row
- When disabled, shows individual alert type rows
- Persists to settings and syncs

### REQ-5: Badge Custom Detector Modal (W221-222)
Allow users to create and edit custom badge detectors with fields: name, category, keywords, regex pattern, URL template, and label.

**Acceptance Criteria:**
- "Add Custom Detector" button in Badges settings tab
- Edit button on existing custom detectors
- Dialog/sheet with fields: name (required), category, keywords (comma-separated), regex (required, validated), URL template (required, must contain `{code}`), label
- Validation with error messages
- Saves to badges config JSON
- Re-renders custom detector list after save

### REQ-6: Custom Objects Zone Management (W223-227)
Render user-defined custom zones in the chit editor. Fetch zone definitions and their objects from the API, render as collapsible sections with appropriate input fields, and save values back into health_data.

**Acceptance Criteria:**
- On editor load, fetches custom zones from GET /api/custom-zones
- For each zone, fetches objects from GET /api/custom-objects/zone/{zoneId}
- Renders collapsible zone panels with grouped fields
- Supports boolean (checkbox), string (text field), and numeric (number field) value types
- Evaluates conditional_display rules to show/hide fields
- Applies range highlighting for numeric fields (high/low indicators)
- Saves values into health_data on chit save
- Groups fields by sub_type within each zone

### REQ-7: Attachments Multi-Select & Bulk Delete (W228-229)
Enable multi-select mode for attachments with bulk delete capability.

**Acceptance Criteria:**
- Long-press on attachment enters multi-select mode
- Checkboxes appear on all items
- Shift-equivalent: select range between last and current tap
- Selection count shown in action bar
- Bulk delete button with confirmation dialog
- Calls DELETE /api/attachments/bulk
- Shows success/error toast
- Exit multi-select mode after action or back press

### REQ-8: Password Management (W230-232)
Allow admin users to reset passwords for other users.

**Acceptance Criteria:**
- "Reset Password" option available in user admin/management
- Shows dialog with username label and password input field
- Validates password not empty
- Calls PUT `/api/users/{id}/reset-password`
- Shows success/error feedback
- Only visible to admin users

### REQ-9: Recent Tags (W233-235)
Track and display recently used tags for quick access in the tag picker.

**Acceptance Criteria:**
- Tracks last 5 tags used (MRU order)
- Persists to `settings.recent_tags` via settings API
- Shows "Recent" chip row above tag tree in tag picker
- Tapping a recent tag adds it immediately
- Debounced save (don't hammer API on rapid tag usage)
- Loads from settings on first access

### REQ-10: RSVP Status Utilities (W240-241)
Provide utility functions to check the current user's RSVP status on shared chits, and use this to filter/display declined chits differently.

**Acceptance Criteria:**
- Function to get current user's RSVP status from a chit's shares array
- Function to check if current user has declined a shared chit
- Declined chits displayed differently in views (dimmed, filtered, or marked)
- Owners don't have RSVP status (always shown normally)

### REQ-11: Project Quick Menu & Move Child (W242-243)
Provide a context menu on project cards with common actions, and ability to move child chits between projects.

**Acceptance Criteria:**
- Long-press on project card shows context menu
- Menu items: Create New Child, Open in Editor, Quick Edit, Pin/Unpin, Archive/Unarchive, Snooze (with duration options: 1h, 1d, 1w, 2w, 1mo)
- "Move to Project" option on child chit cards
- Moving a child removes from current project and adds to target
- Re-renders after move
- Persists changes via API

### REQ-12: Week View Day Offset / Responsive Paging (W245)
When the calendar week view can't fit all 7 days on screen, show a subset with prev/next navigation to page through days.

**Acceptance Criteria:**
- Detects when screen width can't fit all days
- Shows prev/next buttons in day header row
- Pages by the number of visible days
- Offset clamped to valid range [0, totalDays - visibleDays]
- Resets to 0 on period change or view mode change

### REQ-13: Checklist Clipboard Operations (W247-248)
Allow pasting clipboard text as checklist items and copying incomplete items to clipboard.

**Acceptance Criteria:**
- "Paste from Clipboard" action in checklist zone toolbar
- Parses clipboard text: detects indent (tabs/spaces), markdown checklist format (`- [x]`, `- [ ]`), list markers
- Assigns parent relationships based on indent levels
- Supports undo after paste
- "Copy Incomplete" action copies unchecked items as markdown checklist format
- Shows feedback toast with item count

### REQ-14: Cron Expression Functions (W250-252)
Provide cron expression description, assembly, and validation utilities for the rule editor.

**Acceptance Criteria:**
- `describeCron(expr)`: Converts 5-field cron to human-readable text
- Handles common patterns: every minute, step minutes, every hour, daily at time, weekdays, weekends, first of month, specific day
- Falls back to "Cron: {expr}" for unrecognized patterns
- `assembleCronExpression()`: Joins 5 field values
- `validateCronExpression(expr)`: Validates 5 fields with valid cron characters
- Pure functions usable from any screen

### REQ-15: Weather Functions (W253-255)
Add extreme weather detection, day block navigation, and location row drag reordering to the weather screen.

**Acceptance Criteria:**
- Extreme weather indicator on day blocks (currently: high > 5°C)
- Tapping a weather day block navigates to calendar day view for that date
- Drag-to-reorder weather location rows
- Persists new order to settings
- Uses existing ReorderableList pattern for drag
