# 20260501 Highlights

- Habits overhaul — explicit opt-in habit tracking with streaks and goals
- Added Tailscale VPN administration to Settings
- Project Kanban board drag-and-drop reordering

---

## 20260501.2300

Habits Overhaul — replaced the implicit habit inference (all recurring chits) with an explicit opt-in model via a "Track as habit" checkbox. Habits now have goal/progress tracking (habit_goal, habit_success), per-habit calendar visibility (show_on_calendar), auto-tagging (Habits, Habits/[title]), lazy period rollover with historical snapshots, retroactive editing via a Habit Log zone with canvas-based charts (completion, success rate trend, streak timeline), and configurable success rate windows. The legacy hide_when_instance_done field and "Show completed" toggle have been removed. The Habits view now shows only explicitly marked habits with progress cards, checkbox/counter interactions, streaks, and success rates.

## 20260501.2258

Habits Overhaul — replaced the implicit habit inference (all recurring chits) with an explicit opt-in model via a "Track as habit" checkbox. Habits now have goal/progress tracking (habit_goal, habit_success), per-habit calendar visibility (show_on_calendar), auto-tagging (Habits, Habits/[title]), lazy period rollover with historical snapshots, retroactive editing via a Habit Log zone with canvas-based charts (completion, success rate trend, streak timeline), and configurable success rate windows. The legacy hide_when_instance_done field and "Show completed" toggle have been removed. The Habits view now shows only explicitly marked habits with progress cards, checkbox/counter interactions, streaks, and success rates.

## 20260501.2124

## 20260501.2124

Improved project reorder drag UX in both kanban and list views. Instead of requiring precise targeting on another project's border, dragging now shows a dashed placeholder gap between projects that follows your cursor/finger, matching the task view's behavior. Applied to both desktop (HTML5 drag) and mobile (touch gesture) in both view modes. Also includes the scroll-position preservation fix from the previous version.

## 20260501.2119

## 20260501.2119

Fixed project master reorder on mobile (kanban and list views) jumping to the top of the page after each move. The scroll position is now saved before `displayChits()` rebuilds the DOM and restored afterward.

## 20260501.2057

## Release 20260501.2057

Removed debug console.log statements from kanban drag handlers.

## 20260501.2056

## Release 20260501.2056

Fixed desktop project master reorder. The dragstart handler was checking e.target.closest('.kanban-project-header'), but e.target in a dragstart event is always the draggable element (projectBox), not the element the user clicked on. Since projectBox is the parent of the header, closest() walked up and never found it. Added a mousedown tracker to capture the actual click origin, and the dragstart now checks that origin instead.

## 20260501.2049

## Release 20260501.2049

Fixed desktop project master reorder. The column dragover handlers were correctly skipping during project drags, but no element between the column and the wrapper was calling preventDefault on dragover — so the browser rejected the drop. Added a dragover handler on each projectBox that accepts project reorder drags, ensuring preventDefault is called at the right DOM level for the drop to be accepted.

## 20260501.2047

## Release 20260501.2047

Fixed desktop project master reorder. The wrapper's dragover handler was also using e.dataTransfer.types.includes() which fails on DOMStringList. Replaced with the same _kanbanProjectDragActive boolean flag used by the column handlers.

## 20260501.2043

## Release 20260501.2043

Fixed desktop project reorder and mobile scroll jump. Project reorder now uses a simple boolean flag (_kanbanProjectDragActive) instead of checking dataTransfer.types in dragover — the flag is set in dragstart and cleared in dragend, and column dragover handlers skip when it's true. Scroll preservation now temporarily wraps displayChits to restore scroll position after the DOM is rebuilt, instead of relying on a flag checked at render time.

## 20260501.2037

## Release 20260501.2037

Fixed three kanban drag issues: (1) Desktop project reorder — used cross-browser DOMStringList check for dragover type filtering instead of Array.includes. (2) Mobile card column targeting — elementFromPoint now runs BEFORE restoring pointer-events so it finds the target column, not the dragged card's original parent. (3) Mobile project reorder — added pointer-events:none on the dragged project box during drag so elementFromPoint finds the target box behind it, not the dragged box itself.

## 20260501.2034

## Release 20260501.2034

Fixed two kanban issues: (1) Desktop project reorder was broken because status column dragover handlers were unconditionally calling preventDefault, intercepting the project-reorder drag before it reached the wrapper's drop handler. Added a check to skip project-reorder drags. (2) Improved scroll preservation after kanban drag operations — now sets scrollTop synchronously on the wrapper element plus rAF and setTimeout fallbacks.

## 20260501.2030

## Release 20260501.2030

Fixed kanban view scroll-jumping to top after drag operations. All kanban drag handlers (card moves, grandchild moves, child reorder) now use _kanbanFetchAndPreserveScroll which saves the scroll position before fetchChits and restores it after the DOM is rebuilt in _displayProjectsKanban.

## 20260501.2026

## Release 20260501.2026

Fixed mobile kanban cross-project drag always landing in ToDo column. The dragged card's pointer-events were blocking elementFromPoint from finding the actual target column behind it, so .closest('[data-status]') was walking up to the card's original parent column instead. Added pointer-events:none on the card during drag so the finger hits the correct target column.

## 20260501.2021

## Release 20260501.2021

Mobile Notes view now uses the same drag-to-reorder system as Tasks and Checklists (enableDragToReorder with floating card + placeholder). The custom masonry drag in enableNotesDragReorder is now desktop-only. Long-press on mobile notes triggers inline editing via the standard long-press map pattern.

## 20260501.2018

## Release 20260501.2018

Fixed mobile Notes view drag-to-reorder. The CSS `!important` rules for single-column mobile layout were overriding the JS-set absolute positioning, preventing cards from moving. Added a `cwoc-notes-floating` CSS class and a separate mobile drag path that uses `position: fixed` with a placeholder, matching the checklist/tasks drag behavior.

## 20260501.2013

## Release 20260501.2013

Fixed notes masonry drag leaving empty gaps in intermediate columns when dragging a card across more than one column. The live preview now re-stacks all columns on every move instead of only the source and target.

## 20260501.2007

## Release 20260501.2007

Overhauled mobile touch drag-to-reorder for Checklists, Tasks, and Alarms views: dragged card now floats under the finger with a dashed placeholder showing the drop target, and other cards shift out of the way in real-time. Added `overscroll-behavior: contain` to all scrollable list views to prevent pull-to-refresh from hijacking drag gestures on the top card.

## 20260501.1942

Mobile touch drag fixes across six dashboard views:

- Fixed calendar quick-edit popup firing after touch drag by replacing the deprecated standalone `enableLongPress()` with unified gesture coordination through `enableTouchGesture()` in `enableCalendarDrag()`
- Fixed notes drag targeting in masonry layout by setting `pointer-events: none` on the dragged card before `elementFromPoint()` calls
- Added touch drag-to-reorder for Projects kanban headers via `enableTouchGesture()`
- Added touch drag-to-reorder for Projects list view project headers via `enableTouchGesture()`
- Added touch drag-to-reorder for independent alert cards (alarms, timers, stopwatches) with localStorage persistence
- Added touch drag-to-reorder for indicator chart sections with localStorage persistence

## 20260501.1845

Dashboard checklist view: title strikethrough now applies immediately when the last item is checked off, instead of requiring a page refresh. The checkbox change handler now checks if all items are done and toggles the `checklist-all-done` class on the card in real time.

## 20260501.1835

Fixed clicking within a checklist item in edit mode to reposition the cursor. The parent element's `draggable="true"` attribute was intercepting mouse events and preventing the textarea from receiving normal click-to-position behavior. Now `draggable` is set to `false` when editing starts and restored to `true` when editing ends.

## 20260501.1829

Checklist editing polish: Fixed font/size mismatch between view and edit mode — textarea now uses `font-size: inherit !important; font-family: inherit !important; padding: 0 !important; background: transparent !important` to override the `.editor textarea` rules from shared-editor.css. Clicking empty space on the line (text-wrapper or left-container) now starts editing or focuses the existing textarea with cursor at end.

## 20260501.1822

Found and fixed the actual root cause of checklist centering: `shared-editor.css` has `.editor input { flex: 1; padding: 8px 12px }` which applies to ALL inputs inside the editor wrapper, including checkboxes in checklist items. This made checkboxes expand with `flex:1` and get oversized padding, pushing them to the center. Fixed by adding targeted overrides in `editor.css`: `.checklist-container input[type="checkbox"] { flex: 0 0 auto; padding: 0; width: auto }` with `!important` on the `.left-container` rule to guarantee it wins.

## 20260501.1819

Added a hard guard at the top of showQuickEditModal itself — if a drag just ended or is in progress, the modal refuses to open. This is a single chokepoint that covers every caller (calendar shift+click, long-press, touch gesture callbacks). Also guarded the notes inline-edit long-press path.

## 20260501.1816

Three fixes for mobile drag-and-drop:

1. Fixed capture-phase click suppression to use correct CSS classes for calendar events (timed-event, day-event, itinerary-event) instead of the non-existent cal-event class. This was why quick-edit still opened after dragging calendar events.

2. Fixed enableLongPress to re-check drag state when its timer fires, not just at touchstart. Prevents long-press from firing if a drag started during the hold period.

3. Restored drag hold to 400ms (matching Android default) and increased long-press to 1200ms, giving an 800ms gap. The sequential timer model ensures long-press timer only starts after drag activates, and any movement permanently cancels it.

## 20260501.1813

Checklist layout rebuild: Nuked all conflicting/duplicate CSS rules for checklist items. Removed `display:flex; flex-direction:column` from container (was fighting with item widths), removed old contenteditable selectors, removed dashed borders, removed duplicate `.checklist-input` rules. Items now use simple `display:flex` with `.left-container { flex:1 }` and `.text-wrapper { flex:1 }` — checkbox hugs the left edge, text fills to the trash icon. Edit textarea uses `!important` on width/display/box-sizing to override any inherited rules. Clear Checked button back in zone header (cwocConfirm Promise fix was already in place, cwocToggleZone already skips `.zone-button` clicks). Multi-line text now renders with `white-space:pre-wrap` in both editor and dashboard checklist view.

## 20260501.1812

Removed vibration debug overlay. Kept the `_cwocVibrate()` helper with longer durations (200ms) for browsers that do support the Vibration API (Chrome Android, Samsung Internet, etc.). Firefox for Android removed `navigator.vibrate` entirely starting in version 129 — no workaround is possible on that browser.

## 20260501.1759

Fixed mobile touch gesture model so drag and long-press use sequential timers instead of parallel. Drag activates at 250ms, then long-press timer starts — any movement after drag activates permanently cancels long-press. This prevents quick-edit from firing when the user is trying to drag.

## 20260501.1758

Checklist overhaul: Fixed Clear Checked button (was broken due to cwocConfirm being Promise-based, not callback-based; also click was being swallowed by zone header toggle). Replaced the Undo Delete button with an inline undo countdown bar that appears right in the checklist — shows a message, Undo button, and shrinking timer bar for 8 seconds. Same countdown pattern used for both single-item delete and Clear Checked. Dashboard checklist view now hides completed items (only unchecked items shown, count in header).

## 20260501.1752

Checklist fixes: Fixed items being centered instead of left-aligned (changed container from `align-items: flex-start` to `stretch`). Fixed edit input being too narrow — now fills full width. Improved cursor positioning accuracy using canvas text measurement. Moved completed section collapse/expand toggle to the far right. Dashboard checklist view now hides checked-off items (only shows unchecked items with the count in the header).

## 20260501.1748

Checklist view now strikes through the title when all items are checked. Retuned mobile touch gesture timing: drag activates faster (250ms, down from 400ms) and long-press requires a longer hold (1000ms, up from 800ms), giving a 750ms gap so users can reliably drag without accidentally triggering quick-edit or inline edit mode.

## 20260501.1744

Checklist editor overhaul: clicking to edit no longer pre-selects all text — cursor is placed at the click position. Edit input now fills the full width from checkbox to trashcan. Added item count (x / y) in the checklist zone header next to "Checklist". Completed items section is now collapsible (collapsed by default) with a toggle indicator and count. Added "Clear Checked" button in the zone header that deletes all checked items after confirmation (with undo support). In the dashboard Checklists view, the progress count now appears inline with the chit title instead of on a separate line.

## 20260501.1733

Fixed drag-and-drop in all views (calendar, tasks, checklists, notes, projects/kanban, alarms, indicators) so that completing a drag no longer triggers spurious click/dblclick events that would open quick-edit modals, navigate to the editor, or follow title links. Added a global `_markDragJustEnded()` flag with capture-phase event suppression covering both mouse and touch drag paths.

## 20260501.1729

Mobile drag fixes: Added drag-to-reorder support for child chits in the non-Kanban projects list view (both HTML5 drag and touch gesture with long-press for quick-edit). Enhanced visual drag feedback across all views — dragged items now show a dashed outline with pulse animation, stronger shadow, and ring highlight so it's immediately obvious when drag is active. Replaced inline opacity hacks with CSS classes (`cwoc-dragging`, `cwoc-touch-dragging`) for consistent feedback on both desktop and mobile.

## 20260501.1727

Fixed two kiosk-related issues: the editor logo now navigates back to the kiosk (or wherever the user came from) instead of always going to the dashboard, and checking/unchecking checklist items in the Checklists view now immediately updates the progress count.

## 20260501.1721

Fixed kiosk direct navigation (`/kiosk`) showing "No tags configured" by making the config endpoint prioritize settings rows with kiosk tags. Added full Kiosk documentation to the Help page covering setup, access methods, display layout, period navigation, and auto-refresh.

## 20260501.1707

Kiosk navigation now stays in the same tab throughout: opening the kiosk from Settings, clicking a chit from the kiosk, and exiting the editor all navigate in-place instead of opening new tabs. The editor detects when it was opened from the kiosk (via a `from` query param) and returns to the kiosk on save, cancel, or delete.

## 20260501.1702

Trash is now user-scoped: regular users see only their own deleted chits, while admins see all deleted chits across all users with an Owner column. Restore and purge operations are also permission-checked — non-admins can only act on their own chits.

## 20260501.1700

Mobile touch drag now uses a tap-and-hold pattern: hold ~400ms before drag activates, allowing normal scrolling when you just swipe. Haptic feedback and visual cues indicate when drag mode engages. Calendar resize handles still activate immediately. Chit card titles and metadata now wrap properly on tablet and mobile instead of being hidden by ellipsis. Note previews on task, project, and assigned-to-me cards are expandable on mobile via a "show more…" toggle. Added a Mobile Touch section to the help page documenting the new interaction patterns.

## 20260501.1657

Kiosk now remembers its tag configuration. Navigating to `/kiosk` with no query parameters automatically loads the saved tag list from Settings. A new public endpoint `GET /api/kiosk/config` returns the saved tags without requiring authentication. The URL is updated via `history.replaceState` so bookmarks and refreshes work correctly.

## 20260501.1654

Major kiosk view overhaul: chits are now clickable (tap to open in editor in a new tab), colored with their chit color and auto-contrast text, and the view has Day/Week/Month period buttons with ◄/► navigation and a Today button. Tag legend moved to the bottom of the page. Calendar events are filtered to the selected period range. Tasks remain unfiltered (always show all active tasks).

## 20260501.1652

Kiosk tag picker now uses the same tree-style layout as the rest of the app (expand/collapse, color badges, favorites). Selecting a parent tag automatically includes all child tags on the kiosk — e.g. selecting "Work" will show chits tagged "Work", "Work/Projects", "Work/Projects/CWOC", etc. System tags are filtered out of the picker.

## 20260501.1646

Kiosk view is now tag-based instead of user-based. Select tags in Settings → Kiosk to control which chits appear. Any chit with a matching tag (case-insensitive) is included regardless of owner. The URL parameter changed from `?users=` to `?tags=TagName1,TagName2`. The old "Share" tag requirement is removed — any selected tags work. The settings UI shows all tags with color swatches and checkboxes.

## 20260501.1641

Swapped mobile header order: profile image now sits left of the Views hamburger button, with the Views button at the far right edge.

## 20260501.1640

Mobile header swipe and profile image positioning fixes:

- Swiping left/right on the mobile header bar (across logo, title, views button, or profile image) now correctly cycles through views. Previously the swipe was attached to the hidden `.tabs` element.
- Profile image is now positioned tight against the Views button on mobile, with only a 4px gap matching the hamburger-to-logo spacing on the left side. Uses CSS `order` to ensure views-btn → profile-menu ordering.

## 20260501.1638

Username is now case-insensitive for login, user switching, and uniqueness checks. Typing "Admin", "admin", or "ADMIN" all resolve to the same account. Rate limiting also normalizes by lowercase username.

## 20260501.1633

Batch fix addressing 12 UI/UX issues:

- **Rolodex users**: Users can now be favorited (★ toggle, persisted locally) and appear in the Favorites section alongside contacts. Clicking a user row opens their profile.
- **Stealth greyout**: When stealth is enabled on a chit, all sharing controls, assignment dropdown, people search, and shared user chips are greyed out and disabled.
- **All-day drag & drop**: Fixed all-day event drag-and-drop to correctly detect target day when using grid-based multi-day event rendering.
- **X-Days hotkey**: Changed period hotkey for X Days from `.→S` to `.→X`. Updated panel, reference overlay, and help page.
- **Profile picture sizing**: Profile images in the top-right corner now match the height of adjacent buttons on both dashboard and secondary pages.
- **Past-due label in Tasks**: Overdue items now display "Past Due: YYYY-MMM-DD" (e.g., "Past Due: 2026-Apr-28") instead of the generic "Due:" label.
- **Indicator chart date labels**: Charts now use smarter, shorter date labels based on the time range (time for ≤2 days, day-of-month for ≤2 weeks, M/D for ≤3 months, M/D/YY for longer).
- **Heart rate icon**: Changed from 💓 to plain red ❤️ across indicator charts, sidebar filter, and editor health zone.
- **Indicator chart drag-reorder**: Charts in the Indicators view can now be dragged to reorder, with order persisted in localStorage.
- **Mobile top bar swipe**: Swiping left/right on the tab bar cycles through views on mobile.
- **Mobile day view overflow**: Timed events on mobile now stay within column bounds when pinch-zooming, with proper max-width and box-sizing.
- **User switcher buttons**: Modal buttons now stay on one line with `flex-wrap: nowrap`.

## 20260501.1619

Merged the user profile page into the contact editor. Both contacts and user profiles now use a single HTML page (contact-editor.html) and a single JS file (contact-editor.js). The page detects `?mode=profile` to swap behavior: profile mode shows Account and Change Password zones, hides contact-only features (favorite, tags, delete, QR), and uses the profile API endpoints for load/save/image. The old profile.html and profile.js files have been deleted. The `/profile` route now redirects to the contact editor in profile mode. Removed the "Profile updated successfully" message — save feedback now uses the same brief save-button flash as contacts.

## 20260501.1607

Fixed profile page color tinting to match the chit editor and contact editor behavior. Now uses `applyChitColors()` for proper background + auto-contrast text, and overrides the `.settings-panel` gradient background with the `background` shorthand so the color actually shows through.

## 20260501.1604

Profile page now tints its background to match the selected color, just like the chit editor does. The tint applies on load if the user already has a color set, and updates live when picking a new color or clearing it.

## 20260501.1558

User profile color picker now shows standard and custom colors from Settings instead of a hardcoded palette. System users appear in the sidebar People filter alongside contacts, with a user icon placeholder and a thicker dark brown border to distinguish them from contact chips. User chips in the editor People zone also display the user's chosen color and the thicker border. The switchable-users API now returns the color field.

## 20260501.1554

User profiles now have full parity with contact profiles. Added all missing fields: Name section (prefix, given, middle, surname, suffix), Security section (Signal toggle + username, PGP public key), and Color section (hex input + 20-color swatch palette). DB migration adds given_name, surname, middle_names, prefix, suffix, has_signal, signal_username, pgp_key, color, and tags columns to the users table. Backend GET /me, GET /user-profile/{id}, and PUT /profile all handle the complete field set via a shared _user_profile_dict helper. Read-only mode disables all new fields including selects, checkboxes, and color swatches.

## 20260501.1547

Compact view assign badge is now clickable — click to assign, click again to unassign. Updates the Task zone dropdown and re-renders the badge state.

## 20260501.1545

Fixed: compact assign badge not showing active on chit load. The chips were rendered before the assigned-to dropdown value was set, so the badge always read an empty value. Added a second _renderPeopleChips() call after the dropdown value is populated.

## 20260501.1543

Fixed: compact view assign badge not updating when a user is set as assigned. The issue was that _onAssignedToChange() skipped re-rendering when the user was already a manager. Now all code paths (including "None" selection and already-manager) call _renderPeopleChips() to ensure the assign badge reflects the current state.

## 20260501.1540

Assign button consistency: in the expanded view, the unassigned state is now a round circle (matching the compact badge), and morphs into the pill shape with "Assigned" text when active. In the compact view, the assign badge moved to after the Viewer/Manager pill toggle, and now flashes red when a viewer downgrade auto-removes assignment (same animation as the expanded view).

## 20260501.1537

Compact people view now shows a thumbtack assign indicator next to each shared user chip. When the user is assigned, the thumbtack appears as a solid dark brown circle with parchment icon. When not assigned, it's a faded grey pin.

## 20260501.1536

Added a green "✅ Done" button to the People expand modal header. Pressing Enter also closes the modal (unless the search input is focused). Sort state resets when reopening the modal.

## 20260501.1530

When a shared user's role is changed from Manager to Viewer, and that user is currently assigned to the chit, the assignment is automatically cleared and the assign button flashes red briefly to indicate the change. Viewers cannot be assignees.

## 20260501.1527

Assign button in the people expand modal redesigned: now uses a Font Awesome thumbtack icon (fa-thumbtack) instead of the 📌 emoji. Inactive state uses the pill toggle's dimmed style (light parchment background, grey text). Active/assigned state uses the pill toggle's active style (dark brown #8b5a2b background, parchment #fff8e1 text) with "Assigned" label text. Clear visual distinction between enabled and disabled states.

## 20260501.1525

People expand modal add/remove buttons recolored from pastel to rich solid colors matching the app palette: add button is now dark green (#2e7d32) with parchment text, remove button is danger-red (#b22222) with parchment text.

## 20260501.1523

Favorites header background changed to a neutral warm brown (`rgba(139, 90, 43, 0.2)`) with dark text for better contrast — no more gold tint. User label badge recolored to use the HST bar's amber tone (`rgba(200, 150, 90, 0.3)`) with near-black text (`#3c2210`), giving it a warm but distinct look.

## 20260501.1520

User profiles now include all contact-like fields: phones, additional emails, addresses, call signs, X/social handles, websites, organization, social context, nickname, and notes. New DB migration adds these columns to the users table. Both GET /api/auth/me and GET /api/auth/user-profile/{id} return the new fields; PUT /api/auth/profile accepts them. Profile page has new "Contact Details" and "Social & Web" sections with multi-value entry management. Contact editor and user profile pages now show a type badge (Contact with blue styling, User with gold/fa-users icon). Expand modal: swapped label colors — Contact is now blue, User is gold with dark text. Favorites header background darkened for better contrast. Column headers are now clickable to sort ascending/descending (toggles on each click); when sorted, the list renders flat without grouping.

## 20260501.1508

People expand modal overhaul: all controls (add/remove, Viewer/Manager pill, assign, RSVP) moved to the left Controls column; status labels (Contact, User, Shared) now use vibrant themed colors (brown for contacts, steel blue for users, teal for shared); favorites section has a darker gold background; edit button restyled with gradient matching the app theme. Both contacts and users now have an edit/view button on the right — contacts open the contact editor, users open the profile page. User profiles open in read-only mode unless it's your own profile. New backend endpoint GET /api/auth/user-profile/{user_id} returns public profile data. Rolodex user rows are now clickable, opening the user's profile page. Rolodex user icon updated to fa-users.

## 20260501.1450

People zone pill toggles: collapsed view now uses compressed labels (👁️ V / ✏️ M), expanded modal uses full labels (👁️ Viewer / ✏️ Manager). Updated Contact/User/Added label badges to use the parchment/brown theme colors — contacts use warm brown, managers use teal (matching existing sharing-role-manager), viewers use subtle brown.

## 20260501.1448

People expand modal: moved add/remove/assign controls to the left side of each row, added an edit button (external link icon) on the right side that opens the contact's profile in a new tab.

## 20260501.1444

Rebuilt the People expand modal as a table layout with column headers (Name, Email, Org, Notes, Role, Actions). Contacts show email, organization, and notes in dedicated columns; system users show @username in the email column. A sticky header row labels each column. Favorites appear in a dedicated "★ Favorites" section at the top. Columns hide responsively on tablet (org, notes hidden) and mobile (email, org, notes hidden). All management controls (add/remove, role toggle, assign, RSVP) remain in the Role and Actions columns.

## 20260501.1433

People expand modal: fixed user icon to fa-users (matching rolodex group header), added inline detail fields (email, org, notes for contacts; @username for users) that fill remaining row space with hidden overflow, and favorites now appear in a dedicated "★ Favorites" section at the top before the alphabetical groups.

## 20260501.1424

People zone overhaul: system user chips now show the user-circle icon (matching the rolodex), contact chips show favorite stars, search now queries all contact fields (name, email, phone, address, org, tags, notes, etc.), and the expanded people view is now fully interactive — add/remove contacts and users, change sharing roles via pill toggles, set assignees with the 📌 button, and view RSVP status, all from the full-screen modal. Backend contact search also expanded to cover all fields.

## 20260501.1358

Fixed chits not displaying in kanban view by removing the `overflow:hidden` and `max-height:60vh` constraints that were clipping project content. Each project now grows naturally to fit all its sub-chits, with the overall projects-view container scrolling when projects exceed the viewport. Added drag-to-reorder for project boxes in kanban mode (drag by the header grip). All non-calendar/indicator views already had scroll support via their CSS classes.

## 20260501.1350

Fixed project views not scrolling when content overflows. Dashboard kanban columns now expand to fit sub-chits and scroll individually when they exceed 60vh. The editor's project container also scrolls when there are too many items. The overall projects wrapper already had scroll support via the `.projects-view` container.

## 20260501.1342

Fixed the "Add to Project" dropdown being clipped by the zone container's `overflow: hidden`. The menu is now appended to `document.body` and positioned dynamically relative to the trigger button, so it floats above all containers without clipping.

## 20260501.1336

Fixed the "Add to Project" dropdown menu overflowing to the right by anchoring it to the right edge of the button instead of the left.

## 20260501.1325

Added "Highlight Overdue" and "Highlight Blocked" toggles to the dashboard's Display options group. Both default to on and are live toggles — unchecking either disables that border highlighting across all views. The toggles persist across refresh and reset with Clear Filters. In Settings, a new "Highlight Blocked" checkbox joins the existing "Highlight Overdue" under Chit Options. When either is unchecked, the corresponding color ring indicator on color swatches and the border assignment button in the popup are hidden.

## 20260501.1324

Replaced the native `<select>` "Add to Project" dropdown in the Projects zone header with a custom parchment-styled dropdown menu, fixing the ugly black background on dropdown options. Also replaced all `alert()` calls in the project zone code (editor-init.js and editor_projects.js) with styled `cwocToast()` notifications.

## 20260501.1322

— Tag Sharing Persistence Fix

Fixed tag-level sharing config being wiped every time settings were saved. The main settings save (`POST /api/settings`) used `INSERT OR REPLACE` which overwrote the entire row, but the frontend never included `shared_tags` in the payload — so it was reset to NULL on every save. Fixed both sides: the backend now preserves the existing `shared_tags` value when the frontend doesn't send it, and the tag modal Done button now always persists the sharing config to the server (previously it only saved on tag rename).

## 20260501.1217

— Tag-Level Sharing Debug Logging

Added debug logging to the tag-level sharing query path in `get_shared_chits_for_user` to diagnose why tag-shared chits don't appear for the sharee. Logs show: number of owner settings rows found, relevant tags per owner, candidate chit counts, and tag match/mismatch details.

## 20260501.1216

Three changes:

1. Moved "Hide declined chits" from Settings into the dashboard sidebar's Display filter group (renamed from "Show" to "Display"). It's now a live toggle alongside Hide Past-Due and Hide Complete, with a separator between the show/hide groups. Initializes from the saved setting, persists across refresh, and resets with Clear Filters.

2. Renamed the "Audit Log" zone in the chit editor to "Habit Log" (with 🔁 icon) since it only shows the series completion summary for recurring/habit chits.

3. Chit delete now exits the editor immediately and shows the undo countdown toast on the dashboard instead of lingering in the editor. The editor stores undo info in sessionStorage, navigates home, and the dashboard picks it up on load.

## 20260501.1209

Fixed dashboard view state not surviving page refresh. The root cause was that `_restoreUIState()` prioritized a stale `localStorage` snapshot (written on every tab switch by `storePreviousState()`) over the fresh `sessionStorage` snapshot (written on every render by `displayChits()`). Rewrote the restore logic to always prefer `sessionStorage` for tab/view/period recovery, falling back to `localStorage` only for richer filter state on editor return. Refreshing now reliably returns to the same tab, calendar mode, and period.

## 20260501.1205

Added a ✕ remove button next to the "Add to Project" dropdown in the Projects zone header. If the chit already belongs to a project, the dropdown pre-selects it and the remove button appears. Clicking ✕ confirms and removes the chit from its parent project.

## 20260501.1204

— Sharing Hardening

Hardened the sharing backend: `get_shared_chits_for_user` now raises exceptions instead of silently returning an empty list, making errors visible. Added notification creation when new chits are created with shares (POST and PUT-create paths were missing it). Enriched `owner_display_name` from the users table for shared chit responses. Improved frontend error logging for the `/api/shared-chits` fetch. Removed temporary debug logging.

## 20260501.1201

Fixed the Projects zone header layout in the chit editor: shortened "Make A Project Master" button text, renamed "Move to Project" dropdown to "Add to Project," styled the dropdown to match the parchment theme, and cleaned up the per-card move-project dropdown with proper CSS instead of inline styles.

## 20260501.1154

— Sharing Bug Fixes

Fixed shared chits not appearing for viewer users. The `get_shared_chits_for_user` query engine was silently swallowing all exceptions and returning an empty list, masking any runtime errors. It now properly raises exceptions so the API returns a 500 with details. Also fixed missing notification creation when new chits are created with shares (POST and PUT-create paths), added owner display name enrichment from the users table for shared chit responses, and improved frontend error logging for the `/api/shared-chits` endpoint.

## 20260501.1150

## CWOC Release 20260501.1150

Added all 18 property-based tests for the sharing overhaul feature. Tests cover the permission engine (assignment grants manager, manager soft-delete, stealth preservation), notification system (creation completeness, ordering, RSVP sync), chit route permissions (manager persistence, self-only RSVP), invite/assign actions, notification count accuracy, dashboard sharing filters, tag sharing hierarchy and permissions, and people modal sorting/labeling. All tests use unittest with 120 randomized iterations per property — no external dependencies.

## 20260501.1117

— Sharing Overhaul

Comprehensive overhaul of the chit sharing system. Replaces the generic share action with two explicit paths: Invite (adds user as viewer with RSVP flow) and Assign (sets assigned-to and auto-adds user as manager). Managers can now persist shares, assigned-to, and soft-delete chits — stealth remains owner-only. A new notification system with inbox UI in the dashboard sidebar alerts users when chits are shared with them, with Accept/Decline actions that sync RSVP status. Tag sharing gains sub-tag propagation and per-user view/manage permission toggles. Two new dashboard sidebar filters ("Shared with me" / "Shared by me") let users focus on collaborative chits. A People zone expand modal provides a full-screen alphabetical view of all contacts and system users associated with a chit.

## 20260501.1030

Updated root README with self-hosted and Tailscale mentions, expanded description highlighting what makes CWOC different from other productivity tools.

## 20260501.1026

Added a root README.md for GitHub with the logo, a brief overview of C CAPTN views and tech stack, and links to the full documentation in the documents directory.

## 20260501.1011

TUN device check now runs on every status check (not just daemon startup), so missing TUN shows red error immediately. Daemon startup failure also shows as error instead of inactive.

## 20260501.1000

Status check "Checking..." message now shows for at least 1 second before switching to the result, so it doesn't flash by too fast.

## 20260501.0959

Fixed Tailscale button and help icon clicking independently — changed wrapper from label to div so clicks don't bleed between them.

## 20260501.0958

Tailscale button status indicator now uses the same emoji circles (🟢🟡⚪🔴) as the status row below.

## 20260501.0956

Tailscale button larger with Lora font, solid colored status dot at full opacity with spacing. Setup help text now explains what Tailscale is and why you'd use it with CWOC.

## 20260501.0951

Tailscale button is now the label itself ("Tailscale ✓/✗") with FA status icon. Button just toggles config visibility (no connect/disconnect). Check Status shows "Checking..." then result. Disconnect messages are yellow. Header icon updates on page load even when collapsed.

## 20260501.0946

Tailscale Enable/Disable button now uses zone-button styling to match editor zone headers. Clicking Disable actually disconnects Tailscale and saves enabled=false to the server.

## 20260501.0941

Tailscale Enable/Disable is now a toggle button on the header line. When disabled, the entire config section collapses. When enabled, it expands and loads status. Help text updated, CTID clarified in troubleshooting.

## 20260501.0934

Tailscale feedback messages now appear inline in the Network Access block instead of floating toasts. Messages stay until dismissed (click) or replaced. Save button has tooltip clarifying it saves immediately. Help page clarifies CTID is the container ID and documents save/connect behavior.

## 20260501.0928

Saving a changed Tailscale auth key now immediately disconnects and logs out the old node registration, purging the previous credentials. Connect then re-authenticates fresh with the new key.

## 20260501.0925

Tailscale Connect now uses --reset to force re-authentication with the saved key (supports switching accounts). Removing the auth key and saving auto-disconnects and logs out the node. Status refreshes after save.

## 20260501.0923

Tailscale connect now verifies the connection actually works after running `tailscale up` — reports failure if the node isn't reachable, even if the command itself succeeded (catches bad/expired auth keys on already-registered nodes).

## 20260501.0915

Tailscale UI polish: Save button greyed out until config changes, Connect/Disconnect buttons enable/disable based on connection state, Save on its own row, help text links to troubleshooting in help page.

## 20260501.0900

Fixed Tailscale status showing "Connected" after disconnect — now checks BackendState field ("Stopped" vs "Running") instead of just checking for IPs.

## 20260501.0855

Replaced system alert() dialogs in Network Access with styled cwocToast() notifications. Added cwocToast() to shared-utils.js as a reusable parchment-themed toast for success, error, and info messages across all pages.

## 20260501.0846

Tailscale now detects missing TUN device (/dev/net/tun) and shows specific fix instructions for Proxmox LXC containers. Added troubleshooting section to help page covering TUN, daemon, and auth key issues.

## 20260501.0840

Improved tailscaled daemon startup — now waits for the socket file to appear (up to 5s) before running tailscale commands. Better error logging on connect failure.

## 20260501.0831

Fixed "Updated" date in Version & Updates to refresh whenever the version number changes, instead of only being set on first install.

## 20260501.0759

Rewrote cwoc-push.sh to sync the correct directories (src/, documents/, install/), exclude junk files, ensure Tailscale stays connected after restart, and display the deployed version.

## 20260501.0754

Fixed Tailscale daemon startup — both status check and connect now ensure tailscaled is running before issuing commands, with clear error messages if the daemon won't start. Renamed "Refresh" to "Check Status" for clarity.

## 20260501.0750

Changed Tailscale help text to strongly recommend one-time auth keys instead of reusable. Added 1-second wait after starting tailscaled daemon to ensure socket is ready before `tailscale up`.

## 20260501.0653

Fixed Tailscale connect failing when tailscaled daemon isn't running — the backend now starts the daemon automatically before running `tailscale up`. Configurinator also enables tailscaled on boot after installation.

## 20260501.0647

Switched Tailscale help icon from text "(?) " to Font Awesome circle-question icon.

## 20260501.0646

Added (?) help icon next to the Tailscale subheader that toggles step-by-step setup instructions including account creation, auth key generation, and client installation.

## 20260501.0644

Added "🔑 Get Key" button next to the Tailscale auth key input that links directly to the Tailscale admin console key generation page.

## 20260501.0626

Added Network Access administration block to the Settings page with Tailscale VPN configuration, status monitoring, and service control. Includes backend API endpoints, database migration, property-based tests, and configurinator integration for automated Tailscale installation during provisioning.
