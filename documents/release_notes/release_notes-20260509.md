# 20260509 Highlights

- Added chit-level snooze (hide until date/time)
- Added chit revert from audit log
- Added Email Thread Nests (attach chits to email threads)
- Map thumbnails on chit cards

---

## 20260509.2128

Map thumbnails on chit cards: Tasks, Checklists, and Assigned-to-Me views show a small OpenStreetMap tile for non-default locations. Notes view shows a clickable map-marker icon in the title row. Calendar, Alarms, and Projects show a compact icon in the header. Double-clicking a map thumbnail opens the Maps page centered on that location. Per-user toggle in Settings → Chit Options.

Fixed a bug where double-click and shift+click on Notes view cards were broken — the notes drag system was incorrectly setting the `_dragJustEnded` flag on every mouseup (even without movement), blocking all click/dblclick handlers for 300ms after each click.

## 20260509.2118

Added chit-level snooze: hide a chit from all views until a specified date/time, then it automatically reappears. Accessible from the editor header button and quick-edit modal, with preset durations (15 min to 1 week) and custom date/time picker. Background scheduler auto-unsnoozes expired chits and sends a push notification. Snoozed chits show a 😴 badge and can be revealed via the "Snoozed" display filter in the sidebar.

## 20260509.2029

Added chit revert from audit log. Expand any chit update entry with real field changes and click "⏪ Revert to Before This Edit" to restore previous values. Reverts are clearly marked with a blue "reverted" badge in the audit log. Also fixed bogus audit entries that only contained metadata fields (id, owner_id, etc.) — a startup migration cleans existing junk entries, and the audit diff now excludes those fields going forward.

## 20260509.1825

Added Email Thread Nests — attach any non-email chit to an existing email thread via a nest button in the editor title row. Nested chits appear inline within the email thread's expanded view (both in the Email tab and the editor's thread display), sorted by due date or start date. Includes a thread picker modal for selecting which thread to nest into, backend validation ensuring nest references point to valid email chits, cascade cleanup on permanent deletion, help page documentation, and 11 property-based correctness tests covering all invariants.

## 20260509.1412

Fixed email quick action buttons (archive, delete, mark unread) being hidden behind the date text by adding z-index to ensure they render above the date element on hover.

## 20260509.1405

Fixed 405 "Method Not Allowed" error when creating new chits — the `create_chit()` function was missing its `@router.post("/api/chits")` route decorator.

## 20260509.1359

Fixed cwocConfirm ESC handler so it stops event propagation. Previously, pressing ESC would both cancel the modal AND trigger the page-level ESC exit. Now uses capture phase + stopImmediatePropagation to ensure one ESC press = one action only.

## 20260509.1358

Fixed Email Bundles not rendering on first load — bundle tabs and "+" button now appear immediately. Added help documentation for the Bundles feature. Fixed timing issue where async bundle fetch completed after toolbar was already rendered with empty data.

## 20260509.1357

Cleaned up redundant console logging on page load — removed hardcoded layout banner, downgraded noisy informational logs (sync attempts, email threading stats, PWA registration, weather scheduling, bulk operation step-by-step) to console.debug so they're hidden by default. Normal console now shows only: auth confirmation, WebSocket connected, and version.

## 20260509.1353

Added "Restart CWOC" button to the Version & Updates section in Settings. Admin-only, requires confirmation before restarting the systemd service. The page auto-reloads once the server comes back up.

## 20260509.1352

Added Email Bundles — Google Inbox-style bundle categorization for the Email tab. Emails are automatically classified into user-defined bundles (with a default "From Contacts" and "Everything Else"). Includes a permanent toolbar with bundle tabs, unread badges, bulk actions, a creation modal that flows into the Rule Editor, right-click context menu for edit/reorder/delete, drag-to-reorder, and a multi-placement toggle in Settings.
