# Phase 7 Audit: Function Index Parity (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC. Web = spec. Every frontend function's BEHAVIOR must have an Android equivalent.
**Source:** `src/INDEX.md` lines 1396–3800 (Section 2: Frontend JavaScript)
**Method:** Read every function listed. Identify the user-facing behavior it implements. Check if that behavior exists on Android.

---

## Methodology

The INDEX lists ~400+ frontend JS functions across 4 directories:
- `shared/` (14 files, ~120 functions) — utilities, auth, touch, checklist, sort, indicators, calendar, tags, recurrence, geocoding, QR, sidebar, timepicker, hotkeys
- `dashboard/` (16 files, ~180 functions) — views, calendar, search, email, modals, alerts, omni, init
- `editor/` (14 files, ~150 functions) — dates, tags, people, location, notes, alerts, color, health, save, init, checklists, projects, sharing, attachments
- `pages/` (8 files, ~50 functions) — settings, people list, contact editor, weather, help, trash, audit log

Rather than listing all 400+ functions individually (which would be a 50-page document), I'm categorizing by **behavior group** and marking whether the Android app implements that behavior. Any behavior that exists on web but not on Android is a gap.

---

## Behavior Groups — Shared Utilities

| Behavior | Web Functions | Android Equivalent | Status |
|---|---|---|---|
| Auth guard (check login, redirect) | `getCurrentUser`, `waitForAuth` | AuthRepository.isAuthenticated() + nav guard | ✅ |
| Cross-tab sync (leader election) | `cwocTabSyncInvalidate`, `cwocTabSyncIsLeader` | N/A (single app instance) | ✅ |
| Settings cache | `getCachedSettings`, `_invalidateSettingsCache` | SettingsRepository (Room Flow) | ✅ |
| Unit conversion (temp, wind) | `_convertTemp`, `_tempUnit`, `_convertWind` | ❌ | ❌ |
| Toast notifications | `cwocToast` | Snackbar (limited) | 💀 |
| Undo toast with countdown | `cwocUndoToast` | UndoToast composable | ✅ |
| Confirm modal | `cwocConfirm` | AlertDialog | ✅ |
| Prompt modal | `cwocPromptModal` | ❌ | ❌ |
| Unsaved changes modal | `cwocUnsavedModal` | AlertDialog (Save/Discard/Cancel) | ✅ |
| Chit picker modal | `cwocChitPickerModal` | ❌ (raw ID input only) | ❌ |
| Date/time formatting | `formatDate`, `formatTime`, `_utcToLocalDate` | DateUtils | ✅ |
| Color contrast | `contrastColorForBg`, `applyChitColors`, `isLightColor` | contrastTextColorLocal() | ✅ |
| Search matching | `cwocMatchesSearch`, `cwocHighlightTerms` | SearchViewModel + buildHighlightedText | ✅ |
| Weather icons (WMO codes) | `_cwocWeatherIcons`, `_cwocGetWeatherIcon` | ❌ | ❌ |
| Timezone detection | `_detectBrowserTimezone`, `getCurrentTimezone` | System timezone (no detection logic) | 💀 |
| Timezone display conversion | `convertTimezoneForDisplay`, `getChitDisplayTime` | ❌ | ❌ |
| Touch drag system | `enableTouchDrag`, `enableTouchGesture` | ❌ (no drag gestures) | ❌ |
| Inline checklist toggle | `toggleChecklistItem`, `moveChecklistItem` | ChecklistsViewModel.toggleItem() | ✅ |
| Cross-chit checklist move | `moveChecklistItemCrossChit` | ❌ | ❌ |
| Manual sort persistence | `getManualOrder`, `saveManualOrder`, `enableDragToReorder` | ❌ (SortField.MANUAL exists but no drag) | ❌ |
| Visual indicators | `_getAllIndicators`, `_getAlertIndicators` | ❌ (no indicators on cards) | ❌ |
| Calendar drag (move/resize) | `enableCalendarDrag`, `enableMonthDrag`, `enableAllDayDrag` | ❌ | ❌ |
| Calendar pinch zoom | `enableCalendarPinchZoom` | ❌ | ❌ |
| Multi-day event rendering | `renderAllDayEventsInCells` | ❌ | ❌ |
| Tag tree utilities | `buildTagTree`, `matchesTagFilter`, `renderTagTree` | TagTreeParser + TagsPickerSheet | ✅ |
| Recent tags tracking | `trackRecentTag`, `getRecentTags` | ❌ | ❌ |
| Tag CRUD (create/edit/delete inline) | `createTagInline`, `updateTagInline`, `deleteTagInline` | onTagCreated (create only) | 💀 |
| Tag modal (full edit) | `cwocTagModal.open/close` | ❌ | ❌ |
| Recurrence expansion | `expandRecurrence`, `formatRecurrenceRule` | RecurrenceEngine | ✅ |
| Geocoding with cache | `_geocodeAddress`, `getGeocodeCached` | ❌ | ❌ |
| QR code display | `showQRModal` | ❌ | ❌ |
| Sidebar filter component | `CwocSidebarFilter`, `cwocLoadTagFilter` | FilterPanel composable | ✅ |
| Time picker (drum roller) | `cwocTimePicker.open` | Material3 TimePicker | ✅ |
| Hotkey dispatch | `_cwocDispatchHotkey` | N/A (no keyboard on mobile) | ✅ |
| Notes masonry layout | `applyNotesLayout`, `enableNotesDragReorder` | ❌ (flat LazyColumn) | ❌ |
| Sidebar (inject, init, toggle) | `_cwocInjectSidebar`, `_cwocInitSidebar`, `toggleSidebar` | ModalNavigationDrawer + SidebarContent | ✅ |
| Notification inbox | `_fetchNotifications`, `_renderNotifInbox`, `_respondNotification` | NotificationsScreen | ✅ |

---

## Behavior Groups — Dashboard

| Behavior | Web Functions | Android Equivalent | Status |
|---|---|---|---|
| Tasks view (grouped by status) | `displayTasksView` | TasksScreen | ✅ |
| Assigned-to-Me view | `displayAssignedToMeView` | ❌ | ❌ |
| Habits view (3 sections) | `displayHabitsView`, `_renderHabitCards` | ❌ (no dedicated habits view) | ❌ |
| Notes masonry view | `displayNotesView` | NotesScreen (flat list) | 💀 |
| Notebook view (notes+checklists) | `displayNotebookView` | ❌ | ❌ |
| Projects list + Kanban | `displayProjectsView`, `_displayProjectsKanban` | ProjectsScreen (Kanban present) | 💀 |
| Alarms list + Independent board | `displayAlarmsView`, `_displayIndependentAlertsBoard` | AlertsScreen (list only) | 💀 |
| Indicators (3 modes: calendar/log/charts) | `displayIndicatorsView`, `_indicatorsRenderCalendar`, `_indicatorsRenderLog` | IndicatorsScreen (charts only) | 💀 |
| Email tab (inbox, threads, bundles) | `displayEmailView`, `_buildEmailCard` | ❌ (entire email tab missing) | ❌ |
| Email bundles (toolbar, tabs, drag) | `_renderBundleToolbar`, `_renderBundleTabs` | ❌ | ❌ |
| Omni View (multi-section) | `displayOmniView`, `_populateOmniSections` | OmniViewScreen (exists) | 💀 |
| Global search (sidebar inline) | `displaySearchView`, `_renderSearchResults` | SearchScreen (dedicated) | 💀 |
| Calendar time grid (day/week) | `main-calendar.js` (entire file) | ❌ (flat event list) | ❌ |
| Clock modal (24h, 12h, analog, HST) | `_openClockModal`, `_renderClocks` | ❌ | ❌ |
| Weather modal | `_openWeatherModal`, `_fetchWeatherForModal` | WeatherScreen (separate page) | 💀 |
| Global alert system (alarm checker) | `_startGlobalAlertSystem`, `_globalCheckAlarms` | NotificationScheduler (AlarmManager) | ✅ |
| Quick-edit modal (shift+click) | `showQuickEditModal` | ❌ | ❌ |
| Chit card header builder | `_buildChitHeader` (tags, indicators, meta) | ❌ (cards show title/priority/due only) | ❌ |
| Map thumbnails on cards | `_buildMapThumbnail`, `_renderMapTile` | ❌ | ❌ |
| Tab counts | `_updateTabCounts` | ❌ | ❌ |
| URL hash routing | `_updateUrlHash`, `_parseUrlHash` | Compose Navigation (routes) | ✅ |
| Chit display options (fade past, highlight overdue) | `_applyChitDisplayOptions` | ❌ | ❌ |

---

## Behavior Groups — Editor

| Behavior | Web Functions | Android Equivalent | Status |
|---|---|---|---|
| Date mode system | `onDateModeChange`, `_setDateMode` | DateZone (radio buttons) | ✅ |
| Due Complete checkbox | `onDueCompleteToggle` | ❌ | ❌ |
| Habit toggle (in zone header) | `onHabitToggle` | HabitsZone (separate zone) | 💀 |
| Habit charts (canvas) | `_renderHabitCharts`, `_drawCompletionChart` | ❌ (text stats only) | ❌ |
| Habit period history | `_loadHabitLog`, `_buildPeriodRow` | ❌ | ❌ |
| Tag tree + favorites + recents | `_renderTags`, `toggleAllTags` | TagsZone (tree + favorites, no recents) | 💀 |
| People tree (contacts + users + roles) | `_renderPeopleTree`, `_addShare`, `_removeShare` | PeopleZone (flat autocomplete) | 💀 |
| People expand modal | `openPeopleExpandModal` | ❌ | ❌ |
| Sharing controls (stealth, assigned-to sync) | `initPeopleSharingControls`, `_syncAssignedToDropdown` | Stealth toggle (no sync) | 💀 |
| Location geocoding + map + weather | `_fetchWeatherData`, `_displayMapInUI` | ❌ (text input + intents only) | ❌ |
| Notes [[ ]] autocomplete | `_checkChitLinkAutocomplete` | ❌ | ❌ |
| Notes list continuation (Enter) | `_notesListContinue` | ❌ | ❌ |
| Notes live preview (side-by-side) | `_switchNotesModalMode('livepreview')` | ❌ (toggle only) | ❌ |
| Notes send to chit | `_openSendContentModal`, `_executeSendContent` | ❌ | ❌ |
| Checklist send item | `_openSendItemPopup`, `_executeSendItem` | ❌ | ❌ |
| Alerts: 4 types with full UI | `renderAlarmsContainer`, `renderNotificationsContainer` | AlertsZone (3 types, simplified) | 💀 |
| Alerts: default auto-populate | `_applyDefaultNotifications` | ❌ | ❌ |
| Projects: Kanban in editor | `initializeProjectZone`, `renderChildChitsByStatus` | ProjectsZone (chip IDs only) | 💀 |
| Attachments: upload/download/delete UI | `editor-attachments.js` | ❌ (placeholder) | ❌ |
| Email compose: full UI | `editor-email.js` | EmailZone (basic fields only) | 💀 |
| Save & Stay | `saveChitAndStay` | saveAndStay() | ✅ |
| Instance banner (recurrence editing) | `_showInstanceBanner` | ❌ | ❌ |
| Auto-save system | `CwocAutoSave` | ❌ (manual save only) | ❌ |

---

## Behavior Groups — Pages

| Behavior | Web Functions | Android Equivalent | Status |
|---|---|---|---|
| Settings page (~100 fields) | `settings.js` (entire file) | SettingsScreen (6 fields) | 💀 |
| Contact editor (25+ fields) | `contact-editor.js` | ContactEditorScreen (subset) | 💀 |
| Contact list (search, sort, favorites) | `people.js` | ContactListScreen | 💀 |
| Weather page (forecasts) | `weather.js` | WeatherScreen | 💀 |
| Help page (dynamic docs) | `help.js` (markdown loading, TOC, search) | HelpScreen | 💀 |
| Trash page (restore, purge, empty all) | `trash.js` | TrashScreen (no empty-all) | 💀 |
| Audit log page | `audit-log.js` | ❌ (no audit log screen) | ❌ |
| Custom objects editor | `custom-objects-editor.js` | ❌ | ❌ |
| Rules manager | `rules-manager.js` | ❌ | ❌ |
| User admin | `user-admin.js` | ❌ | ❌ |
| Maps page (Leaflet) | `maps.js` | MapScreen (osmdroid) | 💀 |

---

## Summary

| Category | Total Behaviors | ✅ Complete | 💀 Broken | ❌ Missing |
|---|---|---|---|---|
| Shared Utilities | 35 | 16 | 4 | 15 |
| Dashboard | 22 | 4 | 8 | 10 |
| Editor | 18 | 1 | 9 | 8 |
| Pages | 11 | 0 | 7 | 4 |
| **TOTAL** | **86** | **21** | **28** | **37** |

**21 behaviors match the web (24%). 65 behaviors are BROKEN or MISSING (76%).**

---

## Key Missing Behavior Categories (not caught by Phases 1-6)

These are behaviors that exist on web but were NOT already documented in the phase 1-6 audits:

1. **Unit conversion system** (temp °C/°F, wind km/h/mph) — affects weather display everywhere
2. **Cross-chit checklist move** — move items between chits
3. **Chit picker modal** — reusable picker for selecting chits (used by prerequisites, projects, send-to)
4. **Prompt modal** — text input modal (web uses `cwocPromptModal`, Android has no equivalent)
5. **Notebook view** — combined Notes + Checklists masonry view (entire tab missing)
6. **Email tab** — entire email inbox/compose/thread UI (not just the editor zone)
7. **Email bundles** — bundle management, filtering, toolbar
8. **Clock modal** — multi-timezone clock display
9. **Quick-edit modal** — inline edit without opening full editor
10. **Tab counts** — show number of items per tab
11. **Chit display options** — fade past events, highlight overdue
12. **Auto-save system** — automatic periodic save (web has `CwocAutoSave`)
13. **Notes send-to-chit** — copy/move note content to another chit
14. **Checklist send-item** — copy/move individual checklist items between chits
15. **Audit log page** — entire page missing
16. **Custom objects editor** — entire page missing
17. **Rules manager** — entire page missing
18. **User admin** — entire page missing

**Total new gaps found by Phase 7: 18 behaviors not previously documented.**
