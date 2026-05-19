## m20260519.0814

Removed system tag display from all Android views. System tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) and CWOC_System/ prefixed tags are now filtered out everywhere: TagChipsRow shared component, Search results, Editor tags zone (active tags + collapsed count + overview row), AdminChits screen, Email cards, sidebar filter tag tree, and kiosk tag list. Previously only ChecklistsScreen and EmailCardEnhanced filtered them; Tasks, Notes, Notebook, Search, Editor, and AdminChits were all showing system tags as visible chips.

## m20260519.0647

Removed gear icon from Omni View screen (per user request — all layout config belongs in Settings only). Moved hideWhenEmpty toggle into the Settings OmniLayoutModal (eye icon per section). Updated OmniLayout data class and serialization to persist hideWhenEmpty per section. Cleaned up unused imports from OmniViewScreen.

## m20260519.0644

Parity re-verification #61-69: Fixed TagCreateDialog (#65) — added edit mode support with TagEditData, favorite toggle (★/☆), font color field, delete button with confirmation. Updated TagsPickerSheet call site for new signature. All other items (#61-64, #66-69) verified with no gaps: Omni Layout (column concept is desktop-only), Arrange Views, Calculator, Release Notes, Recurring Edit, Project Quick Menu, Bundle Modals, Email Expand (web skips on mobile).

## m20260519.0638

Deep verification items #61-69: Fixed Calculator 50-char expression cap. Added Notebook tab to ArrangeViewsDialog. Fixed ChitActionMenu to show "Unsnooze" when chit is already snoozed. Added removable check to EditBundleModal (hides Delete button for non-removable bundles). Added live preview chip to TagCreateDialog.

## m20260519.0636

Parity verification #31-33 deep verification: (31) Recurrence — fixed Perpetual mode now shows InlineRecurrenceRow (was hidden, web shows it). Fixed "Ends never" unchecking to use local state variable instead of serializing empty string to JSON (was producing `"until":""` which web interprets differently). Moved showUntilField state to correct scope. (32) Habits — verified all auto-behaviors exist in DateZone.kt (auto-enable repeat, force all-day, force ends-never, bidirectional freq sync). No gaps found. (33) Mobile zone navigation — added swipe-on-header gesture for prev/next zone navigation (was missing — web has this). Body swipe for actions/zone-list already existed.

## m20260519.0628

Parity gap fixes: (1) Created SharingUtils.kt — client-side viewer-role resolution from shares JSON, used to disable status dropdown for viewer-role shared chits in Tasks view. (2) Added [[title]] inter-chit link rendering to MarkdownRenderer — renders as styled underlined text in steel blue. (3) Indicators Calendar now classifies days as green (in range) / amber (out of range) / empty using Custom Objects range_min/range_max fetched from API. (4) Fixed Email bulk tag picker — wired tagTree from SettingsRepository via EmailViewModel, added bulkApplyTags() method that merges selected tags into all selected emails.

## m20260519.0624

Parity verification deep-dive fixes: Performed additional verification on already-marked items and found/fixed real gaps: (1) Integrated RecurrenceEngine into CalendarViewModel — recurring chits now expand into virtual instances for visible date range. (2) Added birthday/anniversary event fetching via CwocApiService.getContactBirthdays() with yearly recurrence expansion. (3) Fixed resize handle to only change end time (separate drag gesture). (4) Added QuickEditSheet on long-press of calendar events. (5) Added recurring drag modal (AlertDialog with "All in series" / "This instance only" / "Cancel"). (6) Added declined chit styling (opacity + strikethrough). (7) Added viewer-role drag restriction. (8) Added all-day row collapse/expand toggle in WeekTimeGrid. (9) Year view per-day tap → Day view. (10) Month view long-press on empty day → create all-day chit. (11) Itinerary "Now" bar between past/future days. (12) Virtual instance ID resolution for navigation and drag. (13) Tasks: functional habit +/− buttons, markdown note preview, weather emoji indicator. (14) Checklists: title strikethrough when all done. (15) Added getRecurringChits DAO query + updated 4 test mocks.

## m20260519.0502

Parity verification #37-39: Email tab (#37) verified — badge_detectors/badge_max_per_email are dead fields (server stores in smart_actions_config which is preserved via mergePayload), no data loss. Admin tab (#38) verified — all keys match server columns. People/Contact List (#39): Fixed ungrouped mode to include users in the flat list (was contacts-only). Fixed favorited users now appearing in the ★ Favorites section alongside favorited contacts. Added share intent for exported files (was just saving to disk with no way to access). Added external-files-path to FileProvider for export sharing.

## m20260519.0457

Completed all remaining parity items #70-78: Added RSVP indicators to Notes and Checklists screens. Wired drag-to-reorder with full API sync (GET/PUT /api/sort-orders, GET/PUT /api/sort-preferences). FilterSortViewModel now loads sort orders and preferences from server on init and persists changes to both SharedPreferences and backend API. Cleaned up unused imports in ReorderableList.kt. Fixed fully-qualified SortField reference.

## m20260519.0457

Parity verification #36 (Settings Collections tab): Fixed critical default notifications data format mismatch — Android now uses web's JSON format `{start: [{value, unit, afterTarget}], due: [...]}` instead of incompatible `{start_notifications: [{label, offset_minutes}], ...}`. Added before/after toggle to notification dialog (matching web's pill toggle). Changed from preset-only dropdown to free-form value+unit input (matching web's arbitrary number + minutes/hours/days). Added reserved tag prefix check (`CWOC_System/` blocked). Updated parse logic to handle both web and legacy Android formats for backward compatibility.

## m20260519.0636

Parity re-verification items #11-19: Deep function-by-function comparison confirmed #11 (Notebook), #12 (Projects), #13 (Alerts), #15 (Email), #17 (Omni), #18 (Header), #19 (Dates) are at parity. Fixed #14 (Indicators): added expand/collapse toggle per chart card and graph filter chip row to show/hide individual indicator types. Fixed #16 (Search): added status, priority, and email filter dropdowns to search results with post-search filtering in SearchViewModel.

## m20260519.0454

Parity verification #24 Alerts — final gap closed: Added weather-based notification support. Users can now select "Weather" direction when creating a notification, choose a weather condition (high/low temp above/below, precipitation, rain, snow, hail, wind above), and set a threshold value. Weather condition and threshold are stored in the AlertItem and displayed in the alert row. All 9 web weather conditions are available. This completes items #20-33 (all Editor Zones) with zero remaining gaps.
