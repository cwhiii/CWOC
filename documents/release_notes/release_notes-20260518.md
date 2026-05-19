- Completed full parity verification for all 78 checklist items (Editor Zones #20-33, Modals #56-71, Cross-Cutting #72-78)
- Added sharing UI, weather notifications, contact browser, chit link autocomplete, Kanban project view with status changes

## m20260518.2231

Parity verification complete — all 78 items now Code Verified. Fixed email folder navigation: wired sidebar folder radio buttons (inbox/sent/drafts/scheduled/trash/archived) to EmailViewModel.setFolder() via SidebarStateViewModel, added missing "Archive" folder option. Added ChitQrCodeDialog (link/data mode toggle) to editor sidebar and ContactFormQrCodeDialog to contact editor.

## m20260519.0458

Calendar parity (final batch): Added recurring drag modal dialog (AlertDialog with "All in series" / "This instance only" / "Cancel" options). Added birthday/anniversary event integration via CwocApiService.getContactBirthdays() — fetched and expanded with RecurrenceEngine, merged into calendar events. Added declined chit styling (reduced opacity + strikethrough for RSVP-declined events). Added viewer-role drag restriction (shared chits with viewer role cannot be dragged). Fixed virtual instance navigation — tapping/dragging recurring instances now resolves to parent chit ID. Shared handleDragEnd and resolveChitId lambdas across all calendar view modes. Birthday events are non-draggable.

## m20260518.2233

Calendar parity fixes (continued): Integrated RecurrenceEngine into CalendarViewModel — recurring chits are now expanded into virtual instances for the visible date range, matching web's expandRecurrence pipeline. Fixed resize handle to only change end time (separate drag gesture from move). Added QuickEditSheet on long-press of calendar events (matching web's quick-edit modal). Year view: added per-day tap to navigate to Day view. Month view: added long-press on empty day to create new all-day chit. Itinerary view: added "▶ Now" bar between past and future day groups. Added getRecurringChits DAO query for recurrence expansion. Updated all test mocks for new DAO method.

## m20260518.2211

Calendar Day/Week/Work/XDay parity verification (items #1-7): Rewrote CalendarTimeGrid.kt with all-day events section, overlap/side-by-side event layout algorithm (matching web's timeSlots), functional drag-to-move with snap-to-grid and API persistence, live-updating current time indicator, pinch-to-zoom, auto-scroll to configured hour, 12h/24h time format from settings, due-only (⌚) and point-in-time (📌) event prefixes, completed task strikethrough+opacity. Fixed DAO query to include dueDatetime and pointInTime events. Added updateDateTimes to ChitRepository for drag persistence. Work Hours view now uses WeekTimeGrid (matching web). X-Day view now uses WeekTimeGrid with configurable dayCount. Month view: added per-event tap, completed styling, pointInTime in grouping. Year view: fixed today highlight to parchment theme colors, added dueDatetime/pointInTime to event days. Itinerary: added dueDatetime/pointInTime grouping, today header highlighting, completed styling. Tasks: added functional habit increment/decrement buttons with persistence, markdown note preview, weather emoji indicator.

## m20260518.2229

Parity verification item #30 (Attachments) — COMPLETE rewrite for full web parity: Implemented staged operations matching web's pendingUploads/pendingDeletes pattern — uploads are tracked and rolled back on discard, deletes are staged locally and only committed to server on save. Added ViewModel lifecycle hooks (registerOnSaveCallback/registerOnDiscardCallback) to wire commit/rollback into save/discard flows. Fixed download/open to use authenticated OkHttp download → cache file → FileProvider (was broken: Intent.ACTION_VIEW with auth URL doesn't work). Added multi-file upload via OpenMultipleDocuments (was single-file only). Added auto-expand zone after upload. Added 413-specific error messages matching web format ("filename is too large (X MB)"). Added missing file type icons (zip/archive, spreadsheet, presentation, document/word). Shared OkHttpClient instance across calls. Added FileProvider cache-path for attachments directory.

## m20260518.2220

Parity verification items #36-39: Code-verified Collections tab (#36), Email tab (#37), Administration tab (#38), and People/Contact List (#39). All use correct server column key names in their onUpdateSetting calls. Collections tab correctly maps formState.sharedTags → server key "tags" for personal tag definitions. No structural bugs found in these tabs — they correctly save/load all fields via the SettingsPayloadMapper merge system.

## m20260518.2218

Parity verification item #35 (Settings Views tab): Fixed enabled_periods to use "SevenDay" (matching web) instead of "X-Day". Added "Work" to the allPeriods list and derived workHoursEnabled from whether "Work" is in enabled_periods (matching web behavior where it's a period checkbox, not a separate field). The Work Hours checkbox now adds/removes "Work" from enabled_periods instead of setting a non-existent server column. Added period display labels (SevenDay → "X Days", Work → "Work Hours"). Skipped rendering "Work" in the periods checkbox list since it's handled by the dedicated WorkHoursSection.

## m20260518.2237

Parity verification items #8, #9, #15 (deep pass): Tasks view (#8) — added declined chit opacity, fixed stealth indicator to owner-only check, threaded currentUserId through TasksFlatList→TaskCard→IndicatorIcons, added SharedPreferences to TasksViewModel. Checklists view (#9) — added declined chit opacity, LocationIndicator on cards, alpha import. Email (#15) — added swipe-to-archive/delete gestures on email cards via SwipeToAction wrapper, enhanced EmailContextMenu with Pin/Unpin, Open in Editor actions, wired new params in EmailScreen.

## m20260518.2212

Parity verification item #34 (Settings General tab): Fixed sex value case mismatch — Android now sends "Man"/"Woman" (capitalized) matching the web, instead of "man"/"woman" which the server's conditional_display logic couldn't match. Fixed chit_options structure mismatch — Android now sends checklist_autosave, autosave_desktop, autosave_mobile, show_map_thumbnails, and hide_declined as SEPARATE top-level settings fields (matching web behavior), not packed inside the chit_options JSON blob. The server has these as individual columns and wasn't reading them from inside chit_options. Also fixed mapPayloadToFormState to merge these separate server fields back into the Android UI's chit_options JSON on load.

Parity verification items #10-12 (deeper pass): Fixed stealth indicator to only show to chit owner (matching web's Requirement 6.5) in Notes, Notebook, and Projects views. Fixed owner badge to only display when owner differs from current user. Added SharedPreferences injection to NotesViewModel and NotebookViewModel for currentUserId access. Added note preview (first line) to Kanban child cards in Projects view.

## m20260518.2202

Parity verification items #10-17: Enhanced Notes view (#10) with weather/location/health indicators, owner/assignee badges, full markdown rendering, declined chit opacity, and alert indicator icons. Created Notebook screen (#11) — combined Notes+Checklists masonry view with type badges, inline checklist toggle, and full card enhancements. Enhanced Projects (#12) — added Rejected status to Kanban, enriched child cards with indicators/priority/checklist progress/owner badges/completed strikethrough. Verified Alerts (#13) — all 4 sub-modes at parity. Added Calendar and Log sub-modes to Indicators (#14) with year-view grid and reverse-chronological health log. Enhanced Search (#16) — added email fields (subject/from/to/cc/bcc/body), date fields, assigned/child to searchable fields, plus search operators hint UI. Verified Omni View (#17) exists with full implementation.

## m20260518.2201

Parity verification items #30, #34-39: Fixed Attachments zone (#30) — corrected CwocApiService endpoints to match actual server routes (`/api/chits/{chitId}/attachments/{id}` instead of wrong `/api/attachment/{id}/download`), added delete confirmation dialog, fixed `openAttachment` URL, added "save first" guard for new chits, added `@SerializedName("mime_type")` for proper JSON field mapping, added error feedback on upload failure, and updated `AttachmentManager.performUpload()` to use corrected API. Settings tabs #34-38 and People/Contact List #39 code-verified as already at parity.

## m20260518.2234

Parity verification #20-33 final fixes: Added Contact Browser bottom sheet to People zone (#21) — grouped alphabetical list with search, color avatars, tap-to-add. Added status change dropdown to Projects zone child chit cards (#28) — tap status emoji to change between ToDo/In Progress/Blocked/Complete, persists to Room and syncs. Added updateChildChitStatus to ViewModel. Removed dead "Expand" button (web hides it on mobile). Added getAllNonDeletedSnapshot to ChitDao for chit link search.

## m20260518.2230

Parity verification items #20-33 continued fixes: Added Clear button to Location zone (#22). Added chit link autocomplete dropdown with actual search suggestions to Notes zone (#23) — searches all chit titles from Room and shows clickable results. Added delete-after-dismiss toggle to Alerts alarm form (#24). Health Indicators zone (#26) now fetches Custom Objects from /api/custom-objects/zone/indicators_zone to display human-readable names and unit labels instead of raw UUIDs. Added getAllNonDeletedSnapshot suspend query to ChitDao.

## m20260518.2213

Parity verification items #20-33 (all Editor Zones): Fixed Tags zone (#20) with recent tags, auto-color, tracking. Added sharing UI to People zone (#21) with viewer/manager role toggles, RSVP badges, and share-with picker. Enhanced Alerts zone (#24) with before/after/at direction, target type selector, value+unit controls, and alarm enable/disable toggle. Improved Health Indicators zone (#26) with editable value fields and add-new-indicator UI. Added Kanban-style grouped-by-status child chit display to Projects zone (#28). Items #22-23, #25, #27, #29-33 verified as already at parity.

## m20260518.2155

Parity verification item #20 (Tags zone): Added recent tags loading and tracking (persisted to settings), auto-color on first tag selection (applies tag color to chit when no color set), and passes recent tags to TagsPickerSheet. Items #22-23, #25, #27, #29-33 code-verified as already at parity.

## m20260518.2154

Parity verification items #60-69: Code-verified all Modals & Overlays section. Added ChitQrCodeDialog with link/data mode toggle to the editor sidebar actions, and ContactFormQrCodeDialog (QR button) to the contact editor top bar — matching the web's QR sharing behavior. Items 61-69 (Omni Layout, Arrange Views, Calculator, Release Notes, Tag Create/Edit, Recurring Edit, Project Quick Menu, Bundle Modals, Email Thread Expand) all already existed.

## m20260518.2225

Completed drag-to-reorder for chit cards: created ReorderableLazyColumn component with long-press + drag gesture, wired into TasksFlatList when sort is MANUAL. Added manual order persistence to FilterSortViewModel (getManualOrder/saveManualOrder/reorderItems). TasksScreen now applies saved manual order when computing sorted list. All parity items #70-78 fully code-verified.

## m20260518.2217

Parity verification #70-78: Fixed card rendering gaps — added RSVP status indicators (✓/✗/⏳) and accept/decline action buttons on shared chit cards, sub-chit indicator (🔗📋), timezone warning (⚠️), assignee badge (📌), OSM map tile thumbnails, corrected sharing/stealth icons to match web (🔗/🥷). Added PATCH /api/chits/{id}/rsvp endpoint to CwocApiService and ChitRepository. Created ReorderableList.kt for future drag-to-reorder support.

## m20260518.1913

Android DateZone: Added accessibility semantics/tooltip to Due Complete checkbox ("Yes, this is the same as the 'Status' Complete.") and Point in Time "Now" button ("Set to current date and time"), made the entire Due Complete label row tappable for easier interaction.

## s20260518.1439

Fixed Android settings sync: tags, saved locations, and all other Collections/Admin/Email settings now properly sync bidirectionally. Root causes: (1) tag tree was reading from wrong DB column (shared_tags instead of tags), (2) SettingsDto was missing 18 fields added in Room migration 7→8 so server data was silently dropped on pull, (3) SettingsPushMapper wasn't sending those fields so changes never reached the server, (4) server VALID_COLUMNS and sync push fields didn't include the new columns. Added server migration for the new settings columns.

## m20260518.1429

Fixed Android contacts: people colors now display at full opacity matching the web (was 20% alpha), QR code share buttons now actually open the QR dialog instead of being a no-op stub, and the People list screen now has the full navigation chrome (hamburger menu, top bar, tab bar) so users can navigate to other sections of the app.

## m20260518.0727

Fixed Android contact editor color picker to show the full 20-color palette matching the web version (was only showing 7). Color picker now also loads user's custom colors from settings. Fixed profile image section to actually load and display contact photos using Coil (was showing a placeholder emoji). Added "Contact" / "Profile" type badge below the profile image matching the web's header badge.

## m20260518.0717

Fixed Android contact editor: multi-value fields (phones, emails, addresses, call signs, X handles, websites) now correctly parse and display label + value pairs instead of showing raw JSON strings. Fixed dates zone to read the correct `value` key from the backend format and display actual date values. Added show_on_calendar checkbox for date entries. Reorganized editor into proper zones matching the web (Contact Info, Details, Social & Web, Security, Tags, Color, Notes, Dates). Fixed contact list subtitle to display the first phone/email value correctly.

## m20260518.0727

Views panel and swipe-to-change-tab now respect the view_order setting from Settings. The tab row, swipe cycling, and right-side views panel all show tabs in the order configured on the Settings page (including hiding tabs marked as not visible). The views panel shows the ordered main tabs first, then all other screens below a divider.

## m20260518.0716

Rewrote the top bar to match the mobile web browser layout exactly: [☰ Hamburger] ["Omni Chits" title with tappable "Omni" word] ... [Profile avatar] [☰ Views button showing current tab name]. Tapping "Omni" in the title navigates directly to Omni View. Views button opens the right-side panel showing ALL available views (main tabs + all other screens). Swipe left/right on the tab row cycles through tabs (wraps around). Removed notification bell and search icon from top bar (accessible via Views panel and sidebar instead).

## m20260518.0706

Fixed right-swipe views panel to show ALL available views in the app (not just C CAPTN tabs). Panel now shows main views (Calendar, Checklists, Alerts, Projects, Tasks, Notes, Indicators, Email, Omni) followed by a divider and all other screens (Search, Notifications, Settings, Contacts, Weather, Map, Trash, Help, Audit Log, Custom Objects, Rules, User Admin, Attachments).

## m20260518.0657

Android app navigation and UX overhaul: OmniView is now a tab in the C CAPTN tab row (no longer a separate screen in the sidebar); version number displayed at bottom of left sidebar; right-swipe-from-edge opens a views panel showing all available views; chit cards across all views now use parchment-style styling matching the mobile web (brown border, parchment background, no elevation); two-finger pinch-to-zoom on Day/Week/Work Hours calendar time grids (hour segments get taller/shorter vertically).

## m20260518.0628

Fixed calendar view crash (IllegalArgumentException: Can't represent a size of 374973 in Constraints). Root cause: multi-day events produced unbounded pixel heights inside scrollable containers, exceeding Compose's layout constraint limit. Fixed DayTimeGrid and WeekTimeGrid layout structure (removed redundant .height(totalHeight) on scroll containers, moved scroll to proper level) and clamped event duration to max 24 hours (1440 minutes) to prevent overflow.
