# 20260512 Highlights

- Custom Objects Editor — zone preview, drag-to-reorder indicators
- Enhanced global search with snippets and dropdown filters
- Added chit prerequisites/dependencies system

---

## 20260512.2140

Chit picker modals (Add Child Chits, Prerequisites) now show which field matched when the search term isn't in the title — displays a small "field: …snippet…" line with the match highlighted below the title row.

## 20260512.2134

Added zone preview panel to the Custom Objects Editor — clicking "Preview" in the zone editor modal renders a live preview showing the zone as it appears in the chit editor, with collapsible panel, 3-column field grid, appropriate input types, range highlighting, and unit labels.

## 20260512.2130

Fixed search snippets to show for ALL matched fields (not just non-title ones) with ~50 char context window centered on the match, with highlighting.

## 20260512.2124

Added drag-to-reorder for the Indicators Zone section in the Custom Objects Editor, allowing users to reorder health indicator objects via desktop drag or mobile touch-hold with persistence via the bulk reorder API.

## 20260512.2122

Enhanced global search with title-prioritized results, contextual snippets for non-title matches, dropdown filters (Status, Priority, Tag picker), a 3-value email toggle (Exclude/All/Only), and fixed a bug where lone `&` characters in search queries caused an infinite loop in the tokenizer.

## 20260512.2117

Changed the attachments page size filter from a dropdown to min/max number inputs in MB, allowing precise size range filtering.

## 20260512.2116

Enhanced the All Attachments page: clicking a card now opens a preview modal (images render inline, video/audio have player controls, other types show icon). Each card displays file size. Added filter controls (by type: images/documents/audio/video/archives/other; by size: <100KB, 100KB–1MB, 1–10MB, >10MB) and sort options (newest/oldest, name A–Z/Z–A, largest/smallest). Added filename search. Multi-select now uses Ctrl/Cmd+click and Shift+click (plain click opens preview).

## 20260512.2110

Added "View All Attachments" button to the Settings page under the Attachments subheader in the Email Account section.

## 20260512.2109

Sort order (field + direction) is now saved per view tab in the backend, so it persists across devices and page reloads. Switching tabs restores the last-used sort for that view. A "Reset All Sort Orders" button was added under Display Options in Settings to clear all saved sort preferences and manual item ordering.

## 20260512.2108

Added All Attachments page (`/attachments`) — a visual grid showing every attachment across all chits with thumbnails, clickable filenames (download) and chit names (open editor). Supports multi-select via click, Shift+click for range, and Ctrl/Cmd+click to toggle individual items, with a bulk delete action when 1+ items are selected.

## 20260512.2104

Made the Trash button half-sized and added a half-sized Custom Objects navigation button next to it in the Data Management section of Settings.

## 20260512.2058

Auto-complete checklist now defaults to enabled (true) for chits in a project header, instead of requiring manual activation.

## 20260512.2047

Fixed low-contrast text color on the private PGP key status message. Changed from var(--aged-brown-dark) to #1a1208 for proper readability against the light background.

## 20260512.2042

Added a shift-click / right-click context menu on people chips in the chit editor's People zone, offering "View Contact" (opens contact editor) and "Remove" options.

## 20260512.2038

Added private PGP key storage to user profiles. The Security zone in profile mode now has a locked "Private PGP Key" section that requires your account password to unlock. The key is encrypted at rest using Fernet and never returned in normal API responses. Two new password-protected endpoints (POST and PUT /api/auth/private-pgp-key) handle retrieval and storage. The UI provides Unlock, Save, Lock, and Remove actions with a parchment-themed password prompt modal.

## 20260512.2034

Added a "Signal" message button to the contact editor that opens Signal to start a conversation with the contact when they have Signal enabled and a username or phone number entered.

## 20260512.2032

Added PGP key validation in the contact editor. A "Validate Key" button appears below the PGP textarea in the Security zone. Clicking it (or blurring the field) parses the key with OpenPGP.js and shows the result: user ID, algorithm, bit strength, and fingerprint on success, or an error message if the key is invalid. Auto-validates on contact load when a key is present.

## 20260512.2029

Audited and fixed all push/browser notification click targets to navigate to the most appropriate location. Email notifications now go to the Email tab, independent alarm notifications go to the Alarms/Independent view, chit-based notifications go directly to the chit editor. Also fixed: rules engine ntfy missing click URL, browser notification fallback (service worker path) missing URL data, sidebar system notifications missing onclick handler, and corrected broken #Email hash navigation to use the working ?tab=Email query parameter.

## 20260512.2028

Manual sort order now persists across devices. When you arrange chits in manual mode, the order is saved to the backend database and synced to any device on page load.

## 20260512.2023

Permanently hid the List/Kanban view mode toggle in the Projects tab sidebar. Kanban is now the only visible mode. List view code is preserved but never rendered.

## 20260512.2021

Added PGP encryption option for outgoing emails. When composing an email to a contact with a PGP public key stored in their Security zone, a PGP button appears in the email toolbar. Clicking it encrypts the message body client-side using OpenPGP.js before sending. All recipients must have PGP keys on file. The backend detects PGP-encrypted bodies and sends them as plain text without HTML conversion. Sent PGP emails display a green lock banner.

## 20260512.2019

Fixed email notification click URL — clicking a new-email push notification now navigates to the Email tab instead of the Calendar/dashboard root.

## 20260512.2017

Added "Rejected" as a new terminal status for chits. Rejected means "deliberately declined or skipped" — distinct from Complete which means "accomplished." Available in all status dropdowns (editor, Tasks view, Assigned view, calendar, quick-edit, Projects Kanban, rules engine). Rejected chits are faded like Complete, hidden by the "Hide Complete" filter, sorted to the bottom, exempt from overdue highlighting, and do NOT trigger prerequisite cascade unblocking. Projects Kanban shows a separate collapsed "Rejected" column below Complete. Maps, kiosk, and Home Assistant sensor data all updated.

## 20260512.2016

Added Forward button visibility for sent emails — previously only showed on received emails, now appears in both the zone header and the expand modal for sent messages.

## 20260512.2003

Custom Objects picker is now multi-select with checkboxes and an "Add Selected (N)" button. Search renamed to "Search custom objects" and matches on name, type, and sub_type. Types expanded by default, sub-types collapsed. Button renamed to "+ Custom Object". CO editor groups by Type → Sub-Type with alphabetical sorting at all levels.

## 20260512.1929

Calculator fixes: close button moved to right corner of title bar with larger tap target, fixed drag handler eating close button clicks/taps, and Insert button now inserts at cursor position in the last-focused text field instead of replacing the entire value.

## 20260512.1927

Fix show_on_calendar checkbox not filtering chits/contact dates from calendar views. Made the frontend filter catch both `false` and `0` values, broadened the backend birthday endpoint filter to handle integer `0` in addition to boolean `False`, and fixed the chit deserialization to properly distinguish between "explicitly disabled" (0/false) and "not set" (NULL/missing).

## 20260512.1819

Fixed sidebar indicator checkboxes overflowing instead of scrolling. Added visible "Custom Objects" navigation link to secondary page headers and a ⚙️ gear link in the Indicators zone header and dashboard Indicators view for quick access to the Custom Objects Editor.

## 20260512.1749

Wired graph filter dropdown into the Indicators charts mode — sidebar now populates from the "graphs" zone via `GET /api/custom-objects/zone/graphs`, charts render using UUID-keyed data from Custom Objects, "Add Graph" picker allows one-off graphs for objects not in the zone, and filter selections persist/restore via localStorage.

## 20260512.1743

Added a 3-value pill toggle (Calendar | Log | Charts) to the Dashboard Indicators View. The selected mode persists to localStorage and switches between the calendar year-view, reverse-chronological log, and existing charts view.

## 20260512.1741

Implemented Dashboard Indicators View Log Mode — a reverse-chronological list of chits with health readings, showing date, chit title, and a summary of indicator names and values for each entry. Clicking an entry navigates to the chit editor. Mobile-friendly layout with responsive stacking on narrow screens.

## 20260512.1737

Added Log Mode to the Dashboard Indicators View — displays health readings in a reverse-chronological list with UUID-to-name resolution, clickable entries that open the chit editor, and mobile-friendly responsive layout.

## 20260512.1735

Added "⚡ Quick Log" button to the Custom Objects Editor page — creates a new chit with point_in_time set to now and status "Complete", then navigates to the editor for immediate health indicator data entry.

## 20260512.1717

Added "Add Indicator" picker to the Health Indicators zone — a parchment-themed modal that lists available non-default Custom Objects for one-off per-chit tracking.

## 20260512.1517

Added the Custom Objects registry system — a generic, extensible infrastructure for trackable data entities. Includes database tables (custom_objects + zone_assignments), seed data library (41 standard items across Illnesses, Injuries, Allergies, Vitals, Body, Activity), full REST API with CRUD and zone assignment endpoints, Pydantic models, and a dedicated editor page for browsing, creating, editing, and managing objects and their zone assignments.

## 20260512.1514

Implemented full zone management UI in the Custom Objects Editor — zone modal now shows all known zones with assign/unassign toggles, per-zone config JSON editor, sort order fields, and an "Add to Zone" input for new assignments.

## 20260512.1504

Added USPS tracking detection to the email view. Matches 20-22 digit tracking numbers and 13-char international format (e.g., EA123456789US).

## 20260512.1458

Added tracking number and flight detection to the email view. Emails containing UPS, FedEx, or UniUni tracking numbers (or flight numbers with airline keywords) now show a carrier logo + "Track" button that opens the carrier's tracking page in a new tab.

## 20260512.1421

Auto-complete cascades are now fully recursive. If C→B→A (A depends on B depends on C), completing C cascades up through B to A. Reverting C cascades the revert all the way up. Visited-set prevents infinite loops in circular edge cases.

## 20260512.1419

Auto-complete now considers prerequisites: a chit won't auto-complete unless all prerequisite chits are also Complete. If a prerequisite loses its Complete status, dependent chits with auto-complete enabled are reverted to ToDo (cascade). When all prereqs complete and checklist is done (or empty), the chit auto-completes. Works both in-editor and server-side.

## 20260512.1406

Auto-complete button now shows immediately for any chit that's already on a project (or has auto-complete previously enabled), without waiting for the async project dropdown to load.

## 20260512.1401

Fixed auto-complete checklist to properly refresh dashboard views when status changes. Calls fetchChits() (with displayChits fallback) after a status transition triggered by checking items on the dashboard.

## 20260512.1359

Auto-complete checklist now triggers when checking items from the dashboard (outside the editor). Added server-side enforcement in both the PUT and PATCH checklist endpoints, plus client-side logic in the shared toggleChecklistItem function. Dashboard view refreshes when status changes due to auto-complete.

## 20260512.1346

Added "Auto-Complete" toggle button to the Projects zone header for chits that are children of a project. When enabled, the chit's status automatically changes to Complete when all non-blank checklist items are checked, and reverts to ToDo if any item becomes unchecked or a new unchecked item is added.

## 20260512.1135

Fixed: Enter on an empty checklist row now correctly creates a new empty row below (removed overzealous empty-guard that was swallowing the keypress).

## 20260512.1126

Checklist behavior overhaul: New item input box only adds on Enter or page exit (no more 2s debounce auto-add). Existing items save per-keystroke to memory without flooding undo stack. Enter in an existing item correctly creates a new item below (fixed blur-triggered re-render race). On exit, pending checklist content is committed and force-saved — no confirmation modal for checklist-only changes. Non-checklist unsaved changes still show the confirm modal as before.

## 20260512.1119

Checklist inline editing now saves per keystroke (every input event updates the item text immediately). The server PATCH is still debounced at 2s, but the in-memory state is always current — leaving mid-edit can never lose text.

## 20260512.1118

Restored per-keystroke debounced auto-save for checklist items (2s after last keystroke). On exit, any text in the "Add new item" input box or active inline edit is silently committed as a checklist item — no confirmation modal needed since autosave handles persistence.

## 20260512.1109

Fixed checklist drag-and-drop: dragging a parent item now correctly moves its children along with it, preserving the subtree hierarchy. The bug was that `_updateSubLevels` was called after the root item's level was already modified, resulting in a zero delta — children's levels weren't adjusted and they appeared as siblings instead of descendants.

## 20260512.1020

Fixed 8 checklist bugs: mobile swipe left/right now indents/unindents items, removed per-character auto-save during inline editing (only saves on blur/Enter), checklist changes now properly honor save/discard/cancel when autosave is off, dragging items with children correctly moves the subtree, pressing Enter on empty items no longer creates infinite empties, added "Clean up empty items" button to the Data menu, removed opacity fade from completed chits in the Checklists dashboard view, and empty items are auto-removed on blur.

## 20260512.1007

Fixed "Show on Calendar" toggle not persisting when deselected. The Pydantic MultiValueEntry model was missing the show_on_calendar field, so Pydantic silently stripped it during request validation. Added the field as Optional[bool] = None to the model.

## 20260512.0955

Contact date calendar entries now show context-appropriate emojis: 🎂 for birthdays, 💍 for anniversaries, and no emoji for other date types. Updated both the backend title generation and the frontend chip rendering to match on the date label.

## 20260512.0953

Fixed contact editor date fields still loading as Jan 1 2026. Added a custom parseDate function to Flatpickr that handles both ISO format (YYYY-MM-DD from the database) and display format (YYYY-Mon-DD from user input). Used an IIFE closure to properly capture the date value for each setTimeout callback, preventing variable hoisting issues across multiple date entries.

## 20260512.0951

Fixed birthday event concave-notch shape not displaying in week view. Moved the clip-path from the outer container (.all-day-event.birthday-event) to the inner .birthday-chip element, which is the element that actually has the visible background color. The outer container is now transparent with overflow:hidden to prevent the chip from overflowing its grid cell bounds. Removed the pill-shaped border-radius from the chip so the concave notch shape is the only visual treatment.

## 20260512.0949

Fixed contact editor date fields always showing Jan 1 of the current year instead of the saved date. The issue was Flatpickr trying to parse the ISO date string (YYYY-MM-DD) using its display format (YYYY-Mon-DD), which failed silently. Now parses the ISO date into a proper Date object before passing it to Flatpickr's defaultDate option.

## 20260512.0945

Fixed birthday calendar event concave-notch shape not displaying correctly on month, day all-day, and itinerary views. Added `!important` overrides for border, border-radius, and padding to ensure the clip-path renders cleanly without interference from base element styles. Removed the border from the birthday chip as well.

## 20260512.0939

Fixed month view header alignment permanently — day-of-week headers (Sat, Sun, etc.) are now inside the grid as the first row of cells rather than a separate element. They share the same columns, gap, and borders as the day cells, so alignment is guaranteed in both scroll and compress modes. Headers are sticky in scroll mode.

## 20260512.0933

Fixed scroll mode header misalignment — added gap:2px to .day-headers to match the .month-grid gap so columns line up.

## 20260512.0916

Fixed broken "All following" button (was missing addBtn wrapper after bad replacement). Added toast feedback after "All in series" — shows "Series moved: Tuesday → Monday" for BYDAY changes, or "Series shifted +1 day" for simple shifts.

## 20260512.0913

"All in series" and "All following" now handle BYDAY recurrences Google-style: when you drag a Tuesday instance to Monday, it replaces "TU" with "MO" in the byDay rule so all instances in the series move to Monday. For non-BYDAY recurrences, it shifts the parent start date as before.

## 20260512.0855

Fixed "All in series" / "All following" for recurring drag — now computes the time shift (difference between instance's old and new times) and applies that shift to the parent's dates, instead of overwriting the parent with the instance's absolute new time which broke the recurrence anchor. Also fixed compress view missing days (min-width:0).

## 20260512.0853

Fixed compress view showing only 4 days — added min-width:0 to .month-compress .month-day (without overflow:hidden, which breaks drag). This allows grid columns to shrink below their content width when events have white-space:nowrap.

## 20260512.0851

Fixed "All in series" and "All following" recurring drag — added health_data/weather_data stringify before PUT in all drag save paths (recurring modal handlers and week view non-recurring handler).

## 20260512.0847

Fixed recurring chit drag in month view — virtual instances are now found correctly by looking in the expanded displayed chits (window._cwocDisplayedChits) rather than the raw chits array which doesn't contain virtual instances. The recurring drag modal (_showRecurringDragModal) now fires properly.

## 20260512.0831

Month drag now handles recurring chits using the same _showRecurringDragModal as week/day view — shows "This instance only / All in series / All following / Cancel" popup. Finds the virtual chit object from the in-memory chits array by matching parentId + virtualDate from the source day cell.

## 20260512.0824

Fixed drag for recurring chits — removed recurrence_rule and recurrence_exceptions from stringify list (Pydantic expects them as dict/list, not strings). Only health_data and weather_data need stringifying.

## 20260512.0822

Fixed drag failing on chits with weather data — added weather_data to the list of fields that get re-serialized to JSON strings before PUT.

## 20260512.0821

Fixed drag & drop in compress mode — removed overflow:hidden from .month-day (kept only on .day-events container). The browser needs the dragged element to not be clipped by its parent to generate the drag ghost.

## 20260512.0817

Fixed month compress grid — stripped back to minimal CSS overrides. No longer changes gap, borders, or width from the base month-grid styles (which work correctly in scroll mode). Compress mode now only adds height constraints (grid-auto-rows:1fr, height:0, overflow:hidden) and single-line event styling.

## 20260512.0815

Fixed missing days in compressed month view — added min-width:0 and overflow:hidden to day cells so long event titles can't force grid columns wider than 1fr, preventing the rightmost columns from being clipped off-screen.

## 20260512.0814

Fixed month compress view header alignment — removed grid gap (using borders instead) so day-of-week headers line up exactly with the day cells below them.

## 20260512.0812

Month compress view confirmed working — all dates fit in viewport, drag & drop saves correctly, overflow popups position within screen bounds.

## 20260512.0759

Fixed month drag 422 error — only stringify fields that the Pydantic model expects as strings (health_data, recurrence_rule, recurrence_exceptions). List fields (tags, checklist, people, etc.) are already in the correct format from the GET response.

## 20260512.0755

Fixed month drag save: switched back to PUT (which passes auth) and re-serialize JSON fields (tags, checklist, etc.) before sending to avoid 422 validation errors. The PATCH endpoint was returning 401 due to a cookie/auth issue specific to that endpoint.

## 20260512.0753

Month drag debug: added credentials:'include' to PATCH fetch, logging document.cookie presence, and logging response body on failure to diagnose the 401.

## 20260512.0748

Fixed month drag & drop: (1) Target date now parsed as local midnight instead of UTC midnight, fixing the 0.75-day offset that caused incorrect time shifts. (2) Switched from PUT (full chit) to PATCH /fields (only date fields), fixing the 422 validation errors caused by serialized JSON fields being sent back as objects.

## 20260512.0738

Added comprehensive logging to month view drag & drop — every step from dragstart through drop, fetch, date calculation, save, and refresh is logged with [MonthDrag] prefix.

## 20260512.0736

Fixed drag & drop in compressed month view — removed overflow:hidden from day cells (kept only on events container), added cursor:grab and -webkit-user-drag for proper drag ghost rendering. Reduced grid gap to 1px and added width:100% to eliminate dead space around the calendar.

## 20260512.0731

Fixed "...more..." link being clipped in compressed month view — link is now appended to the day cell itself (outside the overflow-hidden events container) so it's always fully visible.

## 20260512.0729

Fixed "...more..." popup positioning — now measures actual popup size after rendering, then clamps to viewport bounds so it never overflows off-screen.

## 20260512.0727

Fixed month compress mode to properly fit all dates within the viewport. Grid now uses `height: 0; min-height: 0` with `grid-auto-rows: 1fr` to force equal row distribution within the available space. Overflow detection uses double-rAF for reliable post-layout measurement.

## 20260512.0723

Fixed month Compress/Scroll pill toggle not rendering styled — added shared-editor.css to dashboard index.html so the cwoc-2val-toggle styles apply.

## 20260512.0722

Calendar month Compress/Scroll toggle now uses the standard CWOC pill toggle pattern (hidden input + _initPillToggle style click handler + label title), matching the settings page toggles like Man/Woman.

## 20260512.0719

Calendar month Compress/Scroll toggle now uses the standard CWOC 2-value pill toggle instead of a switch slider.

## 20260512.0718

Calendar Options sidebar section is now collapsible (matching the Filters pattern) and defaults to collapsed.

## 20260512.0716

Calendar month view now has a Compress/Scroll toggle in a new "Options" sidebar section. Compress mode (default) fits the entire month in the viewport without scrolling — events are single-line and overflow days show a "...More..." link that opens a popup with all events for that day. Scroll mode preserves the previous expanding-row behavior. Email chits also now default to hidden on all non-Email views (sidebar checkboxes start unchecked).

## 20260512.0706

All calendar views now default to NOT displaying email chits. The "Show Email (Received)" and "Show Email (Sent)" sidebar checkboxes start unchecked. Users can still toggle them on manually.

## 20260512.0700

Contact date fields now allow direct text editing in addition to the Flatpickr date picker.

## 20260512.0651

Added concave-notch CSS shape for birthday/anniversary calendar entries — the visual inverse of the point-in-time diamond shape. Birthday events now display with inward triangular cutouts on left and right edges across all calendar views (month, week all-day, day all-day, itinerary). Also added birthday-event class to itinerary view and updated help documentation.

## 20260512.0626

Collapsed zone header text (title and toggle icon) no longer fades with the rest of the zone — stays at full opacity for readability regardless of chit background color.
