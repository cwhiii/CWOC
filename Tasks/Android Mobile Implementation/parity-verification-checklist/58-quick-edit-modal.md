# Quick-Edit Modal

**Category:** Modals & Overlays
**Item #:** 58
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (shared.js)
- [ ] showQuickEditModal(chit, onRefresh) — Opens the quick-edit modal for a chit (shift+click on calendar chits); handles recurring and non-recurring chits
- [ ] _showSnoozeSubMenu — Shows inline snooze preset buttons (15 min, 1 hour, 4 hours, 1 day, 3 days, 1 week) + Cancel
- [ ] _showDeleteSubMenu — Shows delete options for recurring chits (this instance / this and following / all / cancel)
- [ ] showRecurrenceActionModal — Backward-compat alias for showQuickEditModal

### Title Section
- [ ] Title display (h3) — Shows chit title or "(Untitled)"
- [ ] Double-click to edit title — Makes title contentEditable, selects all text, saves on blur/Enter, cancels on Escape
- [ ] Title save — Fetches full chit, updates title via PUT /api/chits/{id}

### Recurrence Info (recurring chits only)
- [ ] Recurrence rule line — Shows icon (🎯 for habits, 🔁 for recurring) + formatted rule + date + instance number
- [ ] Series stats line — Shows "✅ X/Y completed (Z% success rate)" for past instances

### People Chips (read-only)
- [ ] People chips row — Displays people associated with the chit as colored chips
- [ ] Contact color matching — Matches people names to cached contacts for background color
- [ ] Contact thumbnail — Shows small circular profile image if available
- [ ] Contrast text color — Calculates luminance for readable text on colored background
- [ ] Prefix stripping — Removes contact prefix from display name
- [ ] Double-click chip — Opens contact editor for matched contacts
- [ ] Overflow handling — Hides chips that overflow first row, shows "+N more" indicator with full list in title

### Editable Task Fields (dropdowns, only shown if field has a value)
- [ ] Priority dropdown — Options: (empty), High, Medium, Low
- [ ] Severity dropdown — Options: (empty), Critical, Major, Normal, Minor
- [ ] Status dropdown — Options: (empty), ToDo, In Progress, Blocked, Complete, Rejected
- [ ] "All" checkbox per field (recurring only) — Applies change to all instances (parent) vs. this instance (exception)
- [ ] "Save Changes" button — Saves pending changes; for recurring: splits between parent changes and instance exceptions

### RSVP Controls (shared chits where user is not owner)
- [ ] "✓ Accept" button — Sends PATCH /api/chits/{id}/rsvp with status "accepted"
- [ ] "✗ Decline" button — Sends PATCH /api/chits/{id}/rsvp with status "declined"
- [ ] RSVP status text — Shows "(accepted)", "(declined)", or "(pending)"
- [ ] Visual feedback — Active button gets colored background (green for accept, red for decline)

### Recurrence Actions (recurring chits only)
- [ ] ✏️🔁 Edit Series button — Navigates to editor with parent ID
- [ ] ✏️1️⃣ Edit Instance button — Navigates to editor with parent ID + instance date param
- [ ] ✏️✂️ Break Off button — Calls _recurrenceBreakOff to create standalone chit from instance

### Action Row (Pin / Snooze / Delete / QR)
- [ ] Pin/Unpin button — Toggles chit.pinned via PUT /api/chits/{id}
- [ ] Snooze/Unsnooze button — If snoozed: unsnoozes (POST /api/chits/{id}/snooze with null); if not: shows snooze presets
- [ ] Delete button — For non-recurring: confirms then DELETE /api/chits/{id} with undo toast; for recurring: shows delete sub-menu
- [ ] QR button — Click: shows data QR (JSON with id, title, status, priority, tags, note); Shift+click: shows link QR (editor URL)

### Snooze Presets (inline sub-menu)
- [ ] 15 min button
- [ ] 1 hour button
- [ ] 4 hours button
- [ ] 1 day button
- [ ] 3 days button
- [ ] 1 week button
- [ ] Cancel button — Removes snooze sub-menu

### Delete Sub-Menu (recurring chits)
- [ ] "🗑️ Delete this instance" — Adds broken_off exception for this date
- [ ] "🗑️ Delete this and following" — Sets recurrence_rule.until to day before this date
- [ ] "🗑️ Delete all (entire series)" — Confirms then DELETE /api/chits/{parentId} with undo toast
- [ ] Cancel button — Reverts to normal modal view

### Open in Editor (non-recurring only)
- [ ] "Open in Editor" button — Navigates to /editor?id={chitId}

### Cancel Button
- [ ] Cancel button — Closes the modal

### Modal Interactions
- [ ] ESC key — Closes the modal
- [ ] Click outside (overlay click) — Closes the modal
- [ ] Drag guard — Won't open if _dragJustEnded or _touchDragActive is true
- [ ] Birthday guard — Redirects to contact editor for birthday entries

### Recurrence Helper Functions
- [ ] _recurrenceAddException — PATCH /api/chits/{id}/recurrence-exceptions to add/replace an exception
- [ ] _checkRecurrenceAutoArchive — Auto-archives series if all instances are complete and end date has passed
- [ ] _recurrenceRemoveException — Removes an exception for a specific date
- [ ] _recurrenceCompleteSeries — Marks entire series as Complete
- [ ] _recurrenceBreakOff — Creates standalone chit copy, adds broken_off exception to parent, opens new chit in editor
