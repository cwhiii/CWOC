- Dashboard layout polish: removed padding, backgrounds, and borders for edge-to-edge card layouts
- Added print functionality to context menus (checklist and email print options)

## cwoc_server-20260524_1908

Removed all padding from dashboard view containers (Tasks, Alarms, Projects, Notes, Checklists, Notebook, Email) — cards now go edge-to-edge with zero gap to the container walls.

## cwoc_server-20260524_1906

Removed the cream background panel and border from the chit-list container — content now sits directly on the parchment background. Also reduced card internal padding and removed the grey content-zone recess backgrounds from all views.

## cwoc_server-20260524_1902

Reduced padding around content in all dashboard tab views (Tasks, Alarms, Projects, Notes, Checklists, Notebook) from 0.75em to 2px, matching the tight layout already used in the Email view.

## cwoc_server-20260524_1856

Context menu print options are now view-aware: Checklists view shows only "Print Checklist", Email view shows only "Print Email" (formats From/To/CC/Date/Subject + body), and other views show the appropriate options based on chit content.

## cwoc_server-20260524_1853

Added "Print Checklist" to the right-click context menu on the Checklists view. Uses the same print modal as the editor (with "Include completed items" option). Also kept "Print Note" available when a chit has notes.

## cwoc_server-20260524_1851

Fixed accept/decline notifications appearing for every incoming email. Notifications with Accept/Decline buttons now only generate for actual calendar invites (emails with text/calendar MIME part). Regular emails no longer create notification entries. Also cleaned up any existing stale email-type notifications on server restart. Frontend rendering updated to properly handle email vs calendar_invite vs sharing notification types.

## cwoc_server-20260524_1851a

Fixed 500 errors caused by `migrate_unify_users_contacts` renaming the `users` table to `users_deprecated` while `chits.py` and `sharing.py` still queried `FROM users`. Updated all runtime references to query `contacts` table instead. Also fixed `MutableHeaders.pop()` crash in the HTTP exception handler.

## cwoc_server-20260524_1848 / cwoc_app-20260524_1848

Notification improvements across all platforms: Added proper monochrome CWOC "C" icon for Android status bar (replaces blurry launcher icon), added full-color CWOC logo as large icon in notification shade for all notification types (alarms, reminders, timers, email, sync). Added "Mark Read" action button to email notifications in the Android app (now has Trash, Archive, Mark Read, Snooze). Renamed "Delete" to "Trash" for clarity. Added Web Push notifications for new emails on mobile web with action buttons (Trash, Archive, Mark Read) via service worker.

## cwoc_server-20260524_1835

Fixed "JSON.parse: unexpected character" error when toggling "Include in Omni View" for email bundles. The backend update_bundle endpoint had an orphaned code block referencing an undefined `rule_ids` variable, causing a 500 error on any bundle update that didn't include a name change.

## cwoc_app-20260524_1829

Fixed build error in CreateRuleFromChitDialog: tags and people fields are already `List<String>?` (deserialized by Room TypeConverter), not JSON strings. Removed incorrect `isNullOrBlank()` and `Gson.fromJson()` calls, replaced with direct list operations.

## cwoc_server-20260524_1717

Email View Performance: complete implementation of four layered optimizations — thread cache (fingerprint-based skip of _emailGroupByThread recomputation), DOM cache (instant reattach on tab switch back), progressive rendering (first 10 threads sync, rest via rAF), and editor return single-chit refresh (restore snapshot + fetch only edited chit). Integration verification fixed 3 bugs: duplicate bundle toolbar on DOM cache hit, stale checkbox state after reattach, and missing DOM cache invalidation on unread-at-top toggle.

## cwoc_server-20260524_1710

Implemented editor return single-chit refresh for the Email tab. When returning from the editor after viewing/editing an email, the dashboard now restores the chits array from a sessionStorage snapshot and fetches only the single edited chit, providing near-instant perceived load instead of a full API re-fetch. Falls back to full fetchChits() on sync events during edit, quota errors, or fetch failures.

## cwoc_server-20260524_1702

Added DOM cache for the Email tab. When switching away from Email and back, the rendered email list is instantly reattached from cache (no rebuild) if the underlying data hasn't changed. Filter changes, sync events, and data fetches correctly invalidate the cache. Also cancels any in-progress progressive render on tab switch away.

## cwoc_server-20260524_1839

Fixed ESC not closing the snooze custom date/time picker modal on the dashboard. The keydown listener was on the overlay element (which never has focus) instead of `document`. Now uses a document-level capture listener with proper cleanup on all close paths.

## cwoc_server-20260524_1833

Reduced context menu width from 260px to 230px — previous bump was too wide.

## cwoc_server-20260524_1700

Fixed context menu width (200px → 260px) so snooze circle buttons fit without overflow. Replaced native browser `<input type="time">` in both snooze custom pickers (dashboard context menu and editor snooze modal) with the approved cwocTimePicker drum roller.

## cwoc_server-20260524_1656

Added thread cache with fingerprint detection to the Email tab. Thread grouping results are now cached and only recomputed when email data actually changes (new emails, read/unread status, archived status), making sub-filter switching and tab re-renders near-instant.

## cwoc_server-20260524_1647

Added "Create a Rule" option to the right-click context menu on all chit views (web, mobile, Android app). Shows a field picker modal with the chit's populated fields, then opens the rule editor with the selected condition pre-populated.

## cwoc_server-20260524_1634

Added custom date/time picker ("X" button) to snooze options in the dashboard context menu and quick-edit modal. Added Snooze to the desktop editor Options (⋮) menu.

## cwoc_server-20260524_1616

Email chits on the web dashboard now open with a single click instead of requiring a double-click.

## cwoc_server-20260524_1611

Fixed checklist "Send to Chit" popup vanishing immediately on click — the outside-click listener was catching the tail end of the same click event that opened it.

## cwoc_app-20260524_1607

Email notifications now have Delete, Archive, and Snooze action buttons visible when expanded in the notification shade. Tapping the notification opens the email directly in the email expanded editor zone.

## cwoc_server-20260524_1634

Fixed email ESC quick exit setting not persisting — added database column migration, backend whitelist entry, and sync support.

## cwoc_server-20260524_1606

Email fullscreen viewer is now truly fullscreen (no margins, 1px border). Added "Email Options" dropdown to the email zone header with Archive, Mark Read/Unread, Add to Bundle, Snooze, Tag, and Delete actions. Same actions appear as individual buttons in the expanded email modal. Added "Quick exit: ESC closes email and exits chit" setting on the Email tab.

## cwoc_server-20260524_1302 / cwoc_app-20260524_1302

Added "Last Viewed" option to the Default View setting (all platforms). When selected, the dashboard opens to whichever view you used most recently instead of a fixed tab.

## cwoc_app-20260524_1253

Tapping an email notification now opens the chit directly in the email expanded editor zone instead of the overview.

## cwoc_server-20260524_1233

Bundle drop success toast now includes an "Edit Bundle" button when a rule is created/updated. Clicking it opens the rule editor for the bundle's consolidated rule, so you can immediately see and modify all conditions.

## cwoc_server-20260524_1123

Fixed bundle rules architecture: each bundle now has a single rule with an OR group containing all conditions, instead of creating separate rules per sender/subject. Drag-dropping emails with "always from this sender" now adds an OR condition to the existing rule. "Change Rules" button consolidates any legacy multi-rule bundles into one rule before opening the editor, so all conditions are visible in one place.

## cwoc_server-20260524_1111

Fixed bundle "Change Rules" button only showing the most recent rule. Now opens a rules list modal displaying ALL rules associated with the bundle, with Edit and Remove buttons for each rule and an "Add Rule" button to create new ones.

## cwoc_app-20260524_1110

Removed inline email controls (Account Filter Pills, Check Mail button, Unread-at-top toggle) from the email screen content area. These controls now live exclusively in the sidebar, matching the mobile web layout where all email controls are sidebar-only.

## cwoc_server-20260524_1858 / cwoc_app-20260524_1858

Slowed down swipe-to-archive/delete animation on mobile web and Android app. After the card slides off-screen, the colored indicator (green for archive, red for delete) now stays visible for 600ms before fading out, giving clear visual feedback that the action was recognized.

## cwoc_server-20260524_1100 / cwoc_app-20260524_1100

Unified the two separate "Add to Bundle" implementations (context menu and drag-drop) into a single robust modal. Now supports 4 modes (move once, always by sender/subject/recipient), editable match value with wildcard support, retroactive reclassification checkbox, and inline "Create new bundle" option. All entry points (context menu, drag-drop, mobile long-press) use the same unified flow. Android app updated to match with the same feature set via the /api/bundles/{id}/drop-email endpoint.

## cwoc_server-20260524_1058

Fixed phantom color save bug: opening a chit and leaving without changes would incorrectly save a red color (#C66B6B) to the chit. Root cause was _setColor() marking the editor dirty during initial load, combined with auto-save scheduling not being cancelled by markEditorSaved(). Fixed by suppressing dirty-marking during load and ensuring notifySaveComplete cancels pending auto-save timers.

## cwoc_app-20260524_1058

Fixed app showing "No [type] found" empty state messages on first launch before initial sync completes. All C CAPTN tab views (Tasks, Notes, Checklists, Projects, Calendar, Alerts, Notebook) now show a "Loading chits…" spinner when the database is empty and sync is in progress.

## cwoc_server-20260524_1056 / cwoc_app-20260524_1056

Fixed OmniView Reminders section showing "No reminders" empty state instead of hiding when no reminders exist. The section now correctly hides when empty, matching the hideWhenEmpty behavior of other sections. Also corrects stale saved layout settings that had hideWhenEmpty set to false for reminders.

## cwoc_server-20260524_1052

Fixed browser Cmd+F (find-in-page) not working on the Email view. The email cards were inside a nested scroll container that prevented the browser's native find from locating text. Moved scroll responsibility to the main chit-list container for the email view so find-in-page works like all other tabs.

## cwoc_server-20260524_1051 / cwoc_app-20260524_1051

Email select-all button now cycles through four modes: All → None → Read → Unread. A brief label indicator shows which mode was activated, then fades away after 2 seconds. Applies to web, mobile web, and Android app.

## cwoc_server-20260524_1055

Server now suppresses ntfy email notifications when a WebSocket client is connected. If the Android app (or any client) has an active WebSocket connection, the server skips ntfy and lets the app show its own native notification instead. Ntfy still fires when no WebSocket clients are connected (app off-network or killed).

## cwoc_server-20260524_1041 / cwoc_app-20260524_1041

Added native Android email notifications. When new emails arrive via server sync, the app now shows its own notification (sender + subject) instead of relying solely on ntfy. Server-side fix: email chits now get a `sync_version` assigned and a WebSocket `chits_changed` broadcast fires after email sync, so the app's incremental sync picks up new emails immediately.

## cwoc_server-20260524_1031

Fixed second deploy crash in `migrate_unify_users_contacts`: the `users` table had already been renamed to `users_deprecated` in a previous partial run, so the rename failed. Now checks if `users_deprecated` already exists before attempting the rename, and drops the leftover `users` table if so.

## cwoc_server-20260524_1020

Fixed deploy crash in `migrate_unify_users_contacts`: added idempotency guard for partial migration reruns — checks if username already exists in contacts before INSERT, and uses `INSERT OR IGNORE` as a safety net to prevent `UNIQUE constraint failed: contacts.username` errors.

## cwoc_server-20260524_0924

People page: removed separate user-fetching logic (`/api/auth/switchable-users`). All entries now come from the unified `/api/contacts` endpoint. User-contacts are visually distinguished with a shield badge icon (`fa-user-shield`) next to their name. Username is now included in client-side search filtering.

## cwoc_server-20260524_0923

User admin page: updated profile image reference from `profile_image_url` to `image_url` to match the unified contacts backend. Verified create user form correctly sends email for System email storage and all other admin operations (edit, deactivate, reactivate, reset password) work with the unified contacts API.

## cwoc_app-20260524_0820

Fixed app stuck on splash screen. The NavHost was not being rendered while the splash logo was shown, creating a deadlock where `currentRoute` could never resolve. Now renders the NavGraph behind the splash overlay so navigation resolves immediately. Also added duplicate-connection guard to WebSocketClient and try/catch protection around foreground service starts to prevent crashes on Android 12+.

## cwoc_app-20260524_0714

Rewrote Android OmniView deduplication to use identical logic to the web's `_omniDeduplicateChits()`. Previously the app used independent filter functions per section (no deduplication, no habits, On Deck required status!=null, Chrono missed due-today timed items). Now uses a single-pass priority-ordered algorithm matching the web line-for-line: Reminders → Email → Habits → Chrono/OnDeck/Soon → Pinned. Also fixed the `ondeck` layout config ID mismatch and ensured emails bypass sidebar filters.

## cwoc_server-20260524_1015 / cwoc_app-20260524_1015

Server-side email threading: added `thread_id` column to chits. The server now computes a thread_id (root message-ID from the References chain) at email sync time and stores it on each email chit. Existing emails are backfilled on server restart. The Android app now does a simple O(n) groupBy on threadId instead of the previous O(n²) client-side threading algorithm. Room schema bumped to v12.

## cwoc_app-20260524_0909

Fixed email view locking up for 5-10 seconds on load. Root causes: O(n²) subject-based thread grouping with per-call regex allocation, all computation running on the UI thread, and per-thread O(n) scans for reply indicators and nested chits. Fix moves all computation to Dispatchers.Default, uses pre-compiled regex, HashMap for O(1) subject lookup, and pre-built indexes for reply/nested chit lookups.

## cwoc_app-20260524_0712

Fixed email inbox showing zero emails on Android. The app was checking for a plain "Inbox" tag but the server assigns "CWOC_System/Email/Inbox". Now correctly checks for the system tag with a fallback to the emailFolder field, matching the web frontend's logic. Also fixed the same issue in the email badge count, Omni View email widget, and deduplication engine.

## cwoc_server-20260524_0618 / cwoc_app-20260524_0618

Rules engine: email address fields (From, To, CC, BCC) now show the user's configured email accounts as quick-select options in the contacts dropdown. On web, accounts appear at the top of the autocomplete on focus (before typing). On Android, email address condition values show an editable dropdown with all configured accounts. Works across all platforms.
