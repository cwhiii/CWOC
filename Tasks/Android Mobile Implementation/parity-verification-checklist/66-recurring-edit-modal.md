# Recurring Edit Modal

**Category:** Modals & Overlays
**Item #:** 66
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Overview
The "Recurring Edit Modal" is not a standalone modal — it is the **recurrence actions section** within the Quick-Edit Modal (Item 58) that appears only for recurring/virtual chits. It provides the "edit this instance / edit series / break off" workflow.

### Recurrence Action Buttons (in Quick-Edit Modal, shared.js)
- [ ] ✏️🔁 "Edit entire series" button — Navigates to /editor?id={parentId} to edit the parent recurring chit
- [ ] ✏️1️⃣ "Edit only this one instance" button — Navigates to /editor?id={parentId}&instance={dateStr} to edit as instance exception
- [ ] ✏️✂️ "Break off from series & edit as standalone" button — Calls _recurrenceBreakOff to create a new standalone chit

### Instance Editing in Editor (editor-init.js, editor-save.js)
- [ ] window._editingInstance — URL param "instance" value; when set, editor operates in instance-exception mode
- [ ] _showInstanceBanner(dateStr) — Shows a yellow banner: "✏️🔁 Editing instance for {date}. Changes will only apply to this date."
- [ ] _saveInstanceException(dateStr) — Saves changes as a recurrence exception (PATCH /api/chits/{id}/recurrence-exceptions) instead of modifying the parent

### Instance Exception Save Logic (editor-save.js)
- [ ] Builds exception object with date + changed fields (title, start_datetime, end_datetime, status, priority, severity, note, etc.)
- [ ] If status is "Complete", sets exception.completed = true
- [ ] Sends PATCH /api/chits/{parentId}/recurrence-exceptions with the exception object
- [ ] saveChitAndStay() — Also supports instance mode (saves exception without navigating away)

### Break-Off Function (shared.js)
- [ ] _recurrenceBreakOff(parentId, virtualChit, dateStr) — Full workflow:
  1. Fetches full parent chit from API
  2. Creates a new standalone chit (copy of parent, new UUID, no recurrence fields)
  3. Uses the virtual instance's specific dates (start_datetime, end_datetime, due_datetime)
  4. POSTs new chit to /api/chits
  5. Adds broken_off exception to parent via _recurrenceAddException
  6. Opens new chit in editor

### Delete Sub-Menu for Recurring (shared.js — _showDeleteSubMenu)
- [ ] "🗑️ Delete this instance" — Adds broken_off exception for this date only
- [ ] "🗑️ Delete this and following" — Sets recurrence_rule.until to day before this date (truncates series)
- [ ] "🗑️ Delete all (entire series)" — Confirms via cwocConfirm, then DELETE /api/chits/{parentId} with undo toast
- [ ] Cancel button — Reverts to normal modal view (restores hidden elements)

### Quick-Edit Dropdown "All" Checkbox (shared.js)
- [ ] Per-field "All" checkbox — When checked, field change applies to parent (all instances); when unchecked, applies as instance exception
- [ ] allInstancesFlags object — Tracks which fields have "All" checked
- [ ] Save logic splits changes: parent changes via PUT, instance changes via PATCH recurrence-exceptions

### Recurrence Helper Functions (shared.js)
- [ ] _recurrenceAddException(parentId, exception) — PATCH /api/chits/{id}/recurrence-exceptions; then checks auto-archive
- [ ] _checkRecurrenceAutoArchive(parentId) — Auto-archives series if end date passed and all instances are completed/broken-off
- [ ] _recurrenceRemoveException(parentId, dateStr) — Removes exception for a date (un-complete)
- [ ] _recurrenceCompleteSeries(parentId) — Marks entire series as Complete with completed_datetime
- [ ] _renderSeriesSummary(container, virtualChit, parentId) — Shows all instances with status (✅ completed, ❌ missed, ✂️ broken off, ⬜ upcoming)

### Series Summary Display
- [ ] Max 50 instances shown
- [ ] Shows past instances + up to 30 days future
- [ ] Each row: status icon + date + day name + label
- [ ] Scrollable container (max-height 200px)

### Recurrence Info Display (in Quick-Edit Modal)
- [ ] Icon: 🎯 for habits, 🔁 for regular recurring
- [ ] Formatted recurrence rule text (via formatRecurrenceRule)
- [ ] Instance date
- [ ] Instance number (#N)
- [ ] Series stats: "✅ X/Y completed (Z% success rate)" via getRecurrenceSeriesInfo
