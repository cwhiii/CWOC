# 20260511 Highlights

- Added auto-save for chit editor (2-second debounce)
- Contacts soft-delete with trash/restore
- Added Custom Objects Editor (user-defined zones with custom fields)
- QR code contact sharing (vCard)

---

## 20260511.2157

Added F7 (save & stay) and Shift+F7 (save & exit) hotkeys to both the chit editor and contact/people editor.

## 20260511.2156

Auto-save feature for the chit editor — automatically persists edits after a 2-second debounce. Per-platform toggles (mobile/desktop) in settings, save status indicator, validation gating, and clean exit handling with save-before-navigate.

## 20260511.2150

Added auto-save feature for the chit editor — automatically persists edits after a 2-second debounce period, controlled by per-platform (desktop/mobile) toggles in user settings, with a visual save status indicator and graceful exit handling.

## 20260511.2135

Contacts now use soft-delete instead of permanent deletion. A new "Deleted Contacts" trash page (accessible via the Trash button on the People page) lets you restore or permanently purge deleted contacts.

## 20260511.2131

Added "Add Contact" button to the People zone header in the chit editor, allowing quick navigation to create a new contact without leaving the editor flow.

## 20260511.2130

Vault contacts are now editable by all users — removed the read-only restriction so anyone with access can modify contacts shared to the vault.

## 20260511.2129

Creating a new chit from the Indicators view now auto-populates Point in Time with the current date/time and sets status to Complete, streamlining health data logging.

## 20260511.2114

Fixed checklist undo not restoring checked/unchecked state — toggling a checkbox now properly pushes the pre-toggle state to the undo stack.

## 20260511.2109

## 20260511.2109

Replaced the hover tooltip on the desktop-only notification dropdown with inline hint text: "(add a time for additional notification options)" displayed directly in the row when no date mode is active.

## 20260511.2106

## 20260511.2106

Reordered notification row to read naturally: "Notify 15 minutes before start" — number, unit, direction, target. "At" mode reads "Notify at start". Desktop mode reads "Notify Next Time on Desktop".

## 20260511.2104

## 20260511.2104

Notifications now re-render when the date mode changes, so existing notifications immediately show the full timing options (At/Before/After + target) as soon as a time-based date mode is selected.

## 20260511.2102

## 20260511.2102

Editor logo and audit log buttons now go through the CWOC unsaved-changes modal instead of triggering the browser's native "Leave site?" dialog. Added `_cwocSkipBeforeUnload` to all modal navigation paths so the browser dialog never double-fires. Fixed ESC handler on the unsaved-changes modal to use capture phase. Added hover tooltip on the notification direction dropdown when no date mode is active: "Add a time to this chit for additional timing options."

## 20260511.2058

## 20260511.2058

Renamed "Desktop" option in notification direction dropdown to "Next Time on Desktop" for clarity.

## 20260511.2057

## 20260511.2057

When no date mode is selected (None/Perpetual), notifications are now restricted to Desktop-only. The direction dropdown only shows "Desktop" and new notifications default to desktop mode. Time-based options (At/Before/After) are only available when a date mode with a time reference is active (Start/End, Due, or Point in Time).

## 20260511.2054

## 20260511.2054

Restructured notification timing UI into a two-step flow: first select direction (At/Before/After/Desktop), then the number+unit fields and target dropdown appear as appropriate. "At" hides the number and unit since it fires exactly at the target. "Desktop" hides all timing fields. Before/After shows the full offset controls plus a target selector (start/end/due/point based on active date mode).

## 20260511.2052

## 20260511.2052

Added context-aware notification timing options. The timing dropdown now adapts to the active date mode: Start/End mode offers before/at/after start and before/at/after end; Due mode offers before/at/after due; Point in Time mode offers before/at/after point. Selecting "at" hides the number and unit fields since it fires exactly at the target time. Backend push notification scheduler updated to resolve end_datetime and point_in_time targets.

## 20260511.2046

## 20260511.2046

Fixed the point-in-time time picker not loading the current field value when clicked. The picker now correctly reads the stored time from `dataset.time` instead of defaulting to noon. Also fixed the save path to read from `dataset.time` ensuring 12-hour formatted display text doesn't corrupt the saved ISO timestamp.

## 20260511.2043

## v20260511.2043

Added a "▶ Create & Start" button to the Quick Alert timer modal so timers can be created and immediately started in one step. Also supports Ctrl+Enter keyboard shortcut.

## 20260511.2035

## Release 20260511.2035

Row background highlight now only appears when hovering the trash or send buttons specifically, not the entire row.

## 20260511.2034

## Release 20260511.2034

Added subtle background highlight on checklist item rows when hovering (covers the whole row including control buttons on the right).

## 20260511.2032

## Release 20260511.2032

Fixed undo requiring two clicks after deleting a checklist item — deleteItem no longer calls _notifyChange (which was pushing a duplicate post-delete state onto the undo stack).

## 20260511.2029

## Release 20260511.2029

Fixed Cmd+Z in checklist editing — uses `document.execCommand('undo')` to trigger browser text undo synchronously, then falls through to checklist-level undo when there's nothing left to undo.

## 20260511.2028

## Release 20260511.2028

Cmd+Z in checklist editing now cascades: first undoes text changes (browser-native), then once there's nothing left to undo in the textarea, triggers checklist-level undo (e.g., restoring a split).

## 20260511.2027

## Release 20260511.2027

Cmd+Z while editing a checklist item now does native text undo (browser-handled) instead of triggering checklist-level undo. Checklist undo is still available via the undo button in the header.

## 20260511.2025

## Release 20260511.2025

Fixed undo for split — the undo snapshot now captures the full textarea content (the combined text the user sees) before splitting, so undoing restores the original unsplit item with its complete text.

## 20260511.2023

## Release 20260511.2023

Fixed split undo requiring multiple Cmd+Z — now cancels the edit debounce timer before pushing the undo state, so only one state is pushed for the entire split operation.

## 20260511.2021

## Release 20260511.2021

Fixed undo after split — Cmd+Z now discards the editing state (doesn't save) before undoing, so the split is fully reversed in one step.

## 20260511.2020

## Release 20260511.2020

Splitting a checklist item with Enter is now a single undo operation — one Cmd/Ctrl+Z restores the original item. Also added Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z support while editing a checklist item's text.

## 20260511.2018

## Release 20260511.2018

Enter now splits a checklist item at the cursor position — text before stays in the current item, text after becomes a new sibling below. Children stay with the original item.

## 20260511.2016

## Release 20260511.2016

Fixed arrow key navigation between checklist items — now skips over checked items so you can always navigate from any unchecked item (including empty ones) to the next/previous unchecked item.

## 20260511.2014

## Release 20260511.2014

Fixed checklist markdown rendering — headings keep their larger font-size but all margin/padding is stripped via `!important`. Headings render inline to prevent block-level spacing.

## 20260511.2010

## Release 20260511.2010

Fixed checklist markdown rendering — used a blanket `*` reset to strip all margin and padding from any element inside `.checklist-text`, so bold/heading items no longer get extra vertical space.

## 20260511.2005

## Release 20260511.2005

Checklist markdown rendering now uses zero margin/padding — only font-size changes for headings and code. Deleting a checklist item now removes all its descendants too (undo restores everything). Drag & drop continues to move the full subtree preserving relative indentation.

## 20260511.2000

## Release 20260511.2000

Simplified checklist Data menu: top two actions are now "Delete checked items" and "Delete unchecked items". Removed the "Clear all checklist data" option.

## 20260511.1959

## Release 20260511.1959

Changed subtree indent/unindent shortcut to Cmd/Ctrl+Shift+( and Cmd/Ctrl+Shift+).

## 20260511.1956

## Release 20260511.1956

Added Shift+Ctrl+<,> (and Shift+Ctrl+[,]) to indent/unindent a checklist item along with all its children and grandchildren. Added "Delete unchecked items" and "Clear all checklist data" actions to the checklist Data menu.

## 20260511.1902

Added prerequisites feature to the Task zone with shared chit picker modal. Both the prerequisites picker and the "Add Child Chits" project modal now have an "Email" checkbox (unchecked by default) that controls whether email chits appear in search results. Also fixed Task zone layout alignment and added full-color prerequisite items with inline-editable status, circular dependency detection, cascade unblocking, and ⛓️ chain indicator.

## 20260511.1626

Itinerary view overhauled as a "what do I need to think about today" dashboard. Three sections: **On Deck** (all-day events today, tasks due today, habits whose period ends today), **Timed** (chronological events with specific times that haven't ended yet — disappear once passed), and **Soon** (tasks due this week but not today, habits due this week but not today, shown with due dates/days remaining). Completed items and point-in-time chits are excluded entirely. Habits render with full interactive controls (same cards as the Tasks/Habits view with increment/decrement, progress, streak, etc.).

## 20260511.1523

## Release 20260511.1523

Fixed global search email filter: renamed "Hide Email" checkboxes to "Show Email (Received)" and "Show Email (Sent)" with inverted logic (checked = show, default enabled). Global search results now correctly respect the email filter from the sidebar.

## 20260511.1515

Added 2-second debounced auto-save to checklist new-item input and inline editing. Typing and pausing for 2s auto-adds/saves the item without needing Enter. Enter still works instantly. Existing checklist autosave timer also aligned to 2s. Visual border glow indicates pending auto-save.

## 20260511.1512

Fixed ==highlight== markdown syntax not working in the editor — marked.js was loading after shared-utils.js so the extension never registered. Moved marked.js to load before shared-utils in editor.html.

## 20260511.1509

Restored autoGrowNote to size parent/grandparent with textarea at 100% height (capped at viewport). Renamed Notes and Email expand buttons to "Full Editor". Fixed newline loss when closing the full editor — contenteditable div now uses a proper DOM walker to extract text with preserved line breaks.

## 20260511.1440

Fixed note textarea sizing: now uses viewport-relative height (calc(100vh - 300px)) which bypasses parent CSS constraints entirely. The textarea fills most of the viewport height with internal scrolling for long content.

## 20260511.1439

Fixed note textarea size: changed min-height from 6em to 20em with overflow-y:auto so the textarea is always a usable size with internal scrolling, regardless of parent CSS constraints. Removed debug logging.

## 20260511.1435

Renamed notes and email expand button labels to "Full Editor".

## 20260511.1434

Renamed notes "Expand" button label to "F. Editor" (full editor).

## 20260511.1433

Added Print button to the expanded (fullscreen) notes modal, and updated _printNote to read from the active modal textarea when the modal is open.

## 20260511.1430

Fixed notes modal (fullscreen editor) to use a textarea instead of a contenteditable div — this fixes the bug where notes content got jammed into a single line when closing the modal back to the inline editor. Also makes the format toolbar (bold, italic, lists, etc.) and keyboard shortcuts work correctly in the modal, achieving full feature parity between the inline and expanded notes editors.

## 20260511.1428

Fixed note textarea being capped at ~6 lines (102px). The CSS rule `.main-zones-grid > *` had `overflow: hidden` which clipped the textarea vertically regardless of its style.height. Changed to `overflow-x: hidden; overflow-y: visible` so the textarea can grow to show note content.

## 20260511.1424

Fixed note textarea appearing at only 6 lines when switching from rendered to edit mode. The textarea now immediately takes the rendered output's height before autoGrowNote runs, preventing the small-textarea flash and scroll jump.

## 20260511.1423

List continuation on Enter now renumbers subsequent ordered list items. When a new numbered item is inserted (e.g. between "2." and "3."), all following items are automatically incremented to maintain correct sequential numbering. Works in source mode, live preview, and the email editor.

## 20260511.1419

Fixed note textarea shrinking to ~6 lines when clicking to edit. autoGrowNote now caps at 70vh instead of calculating from element position (which was unreliable after layout changes). Switching from rendered to edit mode preserves the rendered height as a starting point.

## 20260511.1418

Print checklist now shows a modal with an "Include completed items" checkbox (defaulted to unchecked) before printing, so you can choose whether checked-off items appear in the printout.

## 20260511.1416

Fixed scroll jumping when clicking the note textarea. autoGrowNote now preserves scroll position during height recalculation. Also changed rendered note output from double-click to single-click to switch back to edit mode. Checklist markdown rendering now strips generated input elements and prevents links from stealing focus.

## 20260511.1415

Added "Print checklist" option to the checklist zone's Data menu, mirroring the existing print note functionality. Prints checklist items with proper indentation, checkboxes, and a completed section divider using the same hidden-iframe print approach.

## 20260511.1412

Notes textarea in edit mode now expands to fill available viewport height (up to the bottom of the screen) rather than capping at 60%. It grows to fit content without exceeding the viewport, and becomes scrollable only when content overflows. Also re-sizes on window resize.

## 20260511.1410

Added ==highlight== markdown syntax support. Wrapping text in double equals renders it with a warm yellow highlight background.

## 20260511.1409

Fixed checklist markdown rendering to support block-level elements (headers, bullet lists, numbered lists, blockquotes, code blocks) in multi-line checklist items. Single-line items still render compactly without extra paragraph wrapping.

## 20260511.1408

Fixed: Editor now prompts about unsaved changes on page refresh/close via the browser's native beforeunload dialog. Previously, refreshing the page with unsaved note content would silently discard changes.

## 20260511.1405

Print Note now defaults to landscape orientation via @page { size: landscape } in the print stylesheet.

## 20260511.1404

Print Note now uses a hidden iframe instead of opening a new tab — prints in-place without navigating away from the current page.

## 20260511.1403

Fixed Notes toolbar buttons (Bold, Italic, etc.) stealing focus from the textarea instead of applying formatting to selected text. Added mousedown preventDefault on all format toolbars to preserve text selection when clicking toolbar buttons.

## 20260511.1402

Checklist items now render inline markdown (bold, italic, links, code, strikethrough) when not being actively edited. Click to edit shows raw text as before.

## 20260511.1401

Fix: Notes with single newlines (no blank line between text) now correctly render as line breaks instead of collapsing into one line. Added global `marked.use({ breaks: true })` in shared-utils.js and fixed script load order so marked.js loads before shared scripts in editor.html and settings.html.

## 20260511.1358

Added Print Note feature: a print button in the editor's Notes zone Data menu and a "Print Note" option in the dashboard right-click context menu. Offers Raw (monospace markdown) or Rendered (formatted HTML) output, opens in a new tab, and auto-triggers the browser print dialog.

## 20260511.1349

Weather page: drag handle back in top-left corner on mobile with city name below it. Chit-derived city rows now use theme-matching parchment color (#f0e6cc) instead of green. Added touch-based drag reordering for mobile (long-press drag handle to start, drag to target row). Pin emoji hidden on mobile.

## 20260511.1314

Fixed editor return navigation: opening a chit from maps now passes `from=/frontend/html/maps.html` so closing the editor returns to the maps page. Increased logo to 42px and sidebar button to 36px at ≤480px. Set minZoom:2 on the map to prevent showing the world twice.

## 20260511.1241

Removed the 📌 pin emoji prefix from reminder notifications in the Alarms notification view.

## 20260511.1236

Desktop-only notifications feature. Profile image sized 64×64px on desktop (20% smaller than logo), 32×32px on mobile (matches mobile logo). Notification badge bottom-left, clears on entering notifications mode. Full notification lifecycle with Unread/Addressed sections, localStorage toast tracking, labeled fields, proper pill toggles, sized buttons.

## 20260511.1235

Force all "Hide Sidebar" buttons to never grey out using !important overrides on opacity, background, color, and pointer-events for both normal and :disabled states.

## 20260511.1222

Adjusted ⇤ arrow position to top:-0.25em for better vertical centering on Hide Sidebar buttons.

## 20260511.1220

Moved the ⇤ arrow up by 0.5em to better center it against the "Hide Sidebar" text.

## 20260511.1215

Fixed "Hide Sidebar" buttons: capitalized S, added overflow:hidden + line-height:0 on the arrow so the large character clips instead of expanding button height.

## 20260511.1212

Made the ⇤ arrow on "Hide sidebar" buttons much larger (2.2em, font-weight 900) for better visibility.

## 20260511.1209

Changed all sidebar close buttons from "✕ Close" to "⇤ Hide sidebar" with a large bold arrow across the dashboard, editor, views panel, and audit log.

## 20260511.1158

Renamed the unsaved-changes button to "❌ Discard Changes" on both mobile and desktop.

## 20260511.1153

Mobile side menu: moved Close button to the top, separated from the action buttons below by a spacer.

## 20260511.1152

Mobile side menu now has three distinct sections separated by visual gaps: Save/Exit buttons at the top, Snooze in its own middle section, and Archive/Delete at the bottom.

## 20260511.1147

## v20260511.1147 — Mobile Drum Roller Time Picker

Replaced all time pickers with a custom iOS-style drum roller. Tap any time input to open the picker. Inside the picker, editable number fields are overlaid on the drums and focused immediately — start typing on the numeric keyboard right away, or scroll the drums. Typing auto-advances from hour to minute. Honors 12/24 hour setting, no seconds, Enter to confirm, ESC to cancel.

## 20260511.1140

## v20260511.1140 — Mobile Drum Roller Time Picker (Dual Mode)

Replaced all time pickers with a custom iOS-style drum roller time picker. The new picker uses CSS scroll-snap for smooth native-feeling scroll on mobile, honors the 12/24 hour setting, and shows only hours and minutes. Time inputs now support dual-mode entry: tap the input to type a time directly with the numeric keyboard, or tap the 🕐 clock button to open the drum roller picker. Auto-formats typed input (inserts colon after 2 digits) and validates on blur.

## 20260511.1136

Mobile editor: removed Archive and Snooze from the title zone. Title zone now only shows QR and Log. All other actions (Save, Save & Stay, Save & Exit, Exit, Archive, Snooze, Delete) are exclusively in the side menu.

## 20260511.1134

Mobile editor: decluttered the title zone and side menu. Title zone now only shows QR, Log, Archive, and Snooze. Side menu now only shows Save, Save & Stay, Save & Exit, Exit, Archive, Snooze, and Delete (QR and Log removed). Archive and Snooze appear in both places for quick access.

## 20260511.1056

When a user is assigned to a chit, they now receive an immediate push notification (Web Push + ntfy) and the assigner sees a toast confirming the notification was sent.

## 20260511.1050

Removed all debug logging that was dumping date/time troubleshooting info into the notes field (editor-init.js debug block and editor-attachments.js save logging).

## 20260511.1049

Mobile-friendly undo countdown toasts. Refactored all undo bars (delete, archive, snooze, email send, send-content) to use CSS classes instead of inline styles, added responsive rules for proper touch targets (44px min-height on mobile), full-width positioning on narrow screens, and scroll-into-view for the editor's send-content undo bar.

## 20260511.1046

Removed debug logging in editor-dates.js that was appending diagnostic info to the notes field every time the date mode changed.

## 20260511.1015

Added smooth edge-scrolling during drag & drop across all views. When dragging chits to the top or bottom edge of the screen, the view auto-scrolls continuously with speed proportional to proximity to the edge. Uses a document-level dragover listener so scrolling works even when the cursor is beyond the container bounds (e.g. over the header). Works for Tasks, Notes, Checklists, Alarms, Projects (list and kanban), and Calendar views, on both desktop (mouse) and mobile (touch).

## 20260511.1007

Restored dates zone mobile CSS to the exact committed working state. The layout rules that were working before (flex-direction:column on rows, 22px indent on fields, radio alignment) are back. Only addition is Flatpickr time picker (disableMobile:true, time_24hr:true, dateFormat:"H:i") for proper 24-hour clock input without native mobile interference.

## 20260511.1003

Fixed missing date/time inputs on mobile: removed all custom date-mode layout overrides (flex-direction:column, display:flex on date-mode-group/row/fields) that were breaking the show/hide logic. Now relies on the existing 480px responsive rules which already work. Kept only minimal touch-target sizing. Flatpickr time picker with disableMobile:true and time_24hr:true remains for proper 24-hour clock input.

## 20260511.0956

Notes view: newly created or updated notes now appear at the top-left of the masonry grid. Fixed sort to use `modified_datetime` instead of the non-existent `last_edited` field, and new notes are assigned to column 0 (leftmost) instead of the shortest column.

## 20260511.0954

Fixed missing time/date inputs on mobile: Flatpickr's mobile mode was converting inputs to type="hidden" and creating native inputs (which ignored time_24hr). Added `disableMobile: true` to force Flatpickr's custom UI on all devices. Also added `display: flex` to the date-mode-fields CSS rule in mobile-zone-mode to prevent table-cell collapse. Time picker now properly shows 24-hour format with no seconds on mobile.

## 20260511.0944

When a user is assigned to a chit that has no status, the status is now automatically set to "ToDo".

## 20260511.0938

Fixed time picker: Flatpickr time-only mode now initialized synchronously with hardcoded `time_24hr: true` and `dateFormat: "H:i"` (no seconds, no AM/PM). All time value assignments from loadChitData and URL params use Flatpickr's setDate() to ensure consistent 24-hour display. Removed the broken CSS date/time hiding system entirely.

## 20260511.0930

Assignee dropdown in the Task zone is now always visible for all users. Selecting an assignee auto-adds them to the people/shares list as a manager. Viewers see the dropdown but can't change it (disabled).

## 20260511.0925

Reverted all time picker and date/time hiding experiments. Time inputs are back to plain text fields with inputmode="numeric" — values display exactly as stored (HH:MM, 24-hour). No Flatpickr on time inputs, no CSS hiding of date/time fields. The dates zone now shows all relevant inputs for the active mode without any hide/show magic.

## 20260511.0918

Fixed time picker display: Flatpickr now uses the correct dateFormat based on the app's time_format setting ("H:i" for 24-hour, "h:i K" for 12-hour). All time values are set via Flatpickr's setDate() to ensure consistent formatting. Seconds are explicitly disabled (enableSeconds: false). Values loaded from chit data or URL params are re-formatted through Flatpickr to match the configured format.

## 20260511.0917

Mobile editor now remembers which zone you were viewing across page refreshes, using sessionStorage scoped per chit.

## 20260511.0913

Reverted time inputs from native `type="time"` (which ignored the app's 24h setting) to text inputs with Flatpickr time-only picker. Flatpickr respects the app's `time_format` setting — shows 24-hour mode when configured for 24-hour. Uses 5-minute increment for quick selection.

## 20260511.0908

Time inputs in the dates zone are now native `type="time"` inputs, giving a proper time picker on mobile (respects device locale for 12/24 hour display). Removed the "Complete" checkbox from the dates zone on both mobile and desktop — status is managed via the Task zone dropdown only.

## 20260511.0841

Fixed mobile dates zone alignment: radios and checkboxes now use fixed 16px size with explicit 6px right margin, overriding the base table-cell layout. The date-mode-group is forced to flex-column, eliminating table display interference. Labels top-align with inputs, and all radio/checkbox controls sit in a perfectly straight vertical line.

## 20260511.0835

Mobile dates zone: removed the ⏰ reveal button. Labels (Start/End, Due, etc.) are now top-aligned with their inputs. Radio buttons and checkboxes are in a perfectly straight vertical line with consistent 16px sizing and 22px left indent for the fields below.

## 20260511.0827

Further Android attachment fixes: added 0-byte file check (Android can return empty File objects from content URIs). Made getAttachmentsData() return undefined (not null) when pending uploads exist but data array is empty — prevents save from overwriting server data. Backend preserves existing attachments when the field isn't in the PUT payload.

## 20260511.0822

Mobile editor no longer loads the wrong zone while waiting for email. When coming from the Email tab, the mobile zone system now waits (polls every 100ms, up to 5s) until the email zone becomes available, then navigates directly to it. No intermediate zone is shown.

## 20260511.0820

Fixed mobile editor opening email chits on the title zone instead of the email zone. The mobile zone system now starts on the notes zone (neutral landing) when coming from Email tab if the email zone isn't visible yet, then navigates to the email zone once loadChitData completes and makes it visible. Also fixed _activateEmailZone to navigate directly to the email zone on mobile.

## 20260511.0817

Mobile editor nav bar now uses the chit's color as its background, with proper contrasting text colors via contrastColorForBg. Buttons invert (text color becomes button bg, chit color becomes button text). Updates live when the user changes the chit color.

## 20260511.0816

Mobile editor: date inputs now also hidden unless they have a value (same as time inputs, with ⏰ reveal button). Fixed email zone combining with title zone when opened from Email view — title container is now immediately hidden on mobile and _activateEmailZone navigates directly to the email zone. Verified all fullscreen modal controls are available inline on mobile (HTML/Text toggle for received emails now visible inline, email format toolbar added inline).

## 20260511.0811

Mobile editor improvements: time inputs in the Dates zone are now hidden unless they have a value (with a ⏰ button to reveal them), the right hamburger button shows the current zone name (like the dashboard Views button), and fullscreen modals (Notes, Email, People) never open on mobile — all controls are available inline in the zone instead. Also added an inline email format toolbar visible on mobile.

## 20260511.0804

Mobile-only: reduced font size and tightened spacing on Calendar, Checklists, and Projects views. Tasks, Alerts, Notes, Email, and Indicators views are unchanged.

## 20260511.0742

Added disk storage display to Version & Updates section showing system disk usage and CWOC-specific data storage with percentage of disk used. Added configurable session lifetime setting (1hr/12hr/24hr/1wk/1mo/never) in Administration.

## 20260511.0724

Added notification badge on the profile picture across all pages (dashboard + editor). Shows pending notification count as a small brown circle. Clicking the profile picture now shows notifications at the bottom of the dropdown menu with Accept/Decline buttons, same format as the sidebar. Badge updates every 30 seconds. Also: undo toast duration set to 5s everywhere, sidebar Notifications/Trash buttons use compact style, email folder list has Trash option linking to trash page filtered to emails.

## 20260511.0722

Comprehensive mobile zone layout fixes: Dates zone radios/checkboxes normalized to 16px (not oversized), inputs properly sized. All zone header buttons now show their labels (hideWhenNarrow visible). Checklist inputs have breathing room on right edge. Tags zone checkboxes fixed to 16px with tight spacing matching desktop. People zone no longer crammed against right edge. Health Indicators renamed to "Indicators" in zone list, labels wrap instead of overflowing. Email zone fields are single-line rows (From/To/CC/BCC/Subject), body fills remaining space. All zones fill full viewport height with no background gap at bottom. Global checkbox/radio override prevents comical oversizing.

## 20260511.0701

Comprehensive mobile zone layout overhaul. Zone header action buttons now display at top of each zone below the nav bar. Title zone reformatted with title input at top, controls below in mobile-friendly layout. Every zone's content now fills available viewport space — Notes textarea, Email body, Checklist container, Projects list all expand to fill screen. All inputs/selects sized at 40px+ min-height with 16px font (prevents iOS zoom). Date fields wrap properly, Location/People fields stack vertically, Tags tree scrolls within bounds.

## 20260511.0649

Mobile editor zone nav overhaul: Title zone now shows full header content (title input, pinned, owner chip) as a zone in the list. Nav bar buttons replaced with ☰ hamburger menus (left=actions, right=zones). Hidden zones (habit, email) excluded from zone list. Both sidebars and dashboard panels now use parchment.jpg background. Footer hidden. Body locked with only zone content scrolling. Pull-to-refresh contained to prevent accidental triggers from zone content.

## 20260511.0630

Fixed mobile editor swipe: moved body swipe listeners to document level so right-edge swipes register properly. Swipe left → actions, swipe right → zone list. Hidden the editor header bar entirely in mobile zone mode (actions still accessible via swipe-left).

## 20260511.0626

Fixed mobile zone navigation layout — zones were pushed off-screen to the right. Root cause: editor container centering (width: 95%, margin: auto), body padding, and column wrapper divs taking up space. Fixed by forcing full-width layout in zone mode, removing body padding, hiding inactive column wrappers, and overriding grid/overflow constraints.

## 20260511.0620

Mobile chit editor revamped with swipe-based zone navigation. On mobile (≤768px), zones now display one at a time with a sticky navigation header. Swipe left/right on the header to cycle zones, swipe right on zone body to open a zone list sidebar, swipe left to access exit/action controls. Zone list greys out empty zones. Starting zone matches the dashboard view the chit was opened from.
