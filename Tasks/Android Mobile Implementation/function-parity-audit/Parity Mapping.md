# Web → Android Function Parity Mapping

> Built incrementally. Each section verified by reading actual source code on both sides.

---

## Progress

| Batch | Web File | Functions | Status |
|-------|----------|-----------|--------|
| 1 | shared-utils.js | 51 | ✅ Done (24✅ 4⚠️ 16❌ 4N/A) |
| 2 | shared-calendar.js | 16 | ✅ Done (10✅ 1⚠️ 3❌ 1N/A) |
| 3 | shared-checklist.js | 6 | ✅ Done (6✅) |
| 4 | shared-sort.js | 10 | ✅ Done (8✅ 1⚠️ 0❌ 1N/A) |
| 5 | shared-indicators.js | 9 | ✅ Done (5✅ 2⚠️ 2❌) |
| 6 | shared-tags.js | 13 | ⬜ Not started |
| 7 | shared-recurrence.js | 4 | ⬜ Not started |
| 8 | shared-geocoding.js | 6 | ⬜ Not started |
| 9 | shared.js | ~80 | ⬜ Not started |
| 10 | main-calendar.js | ~30 | ⬜ Not started |
| 11 | main-views.js + sub-files | ~60 | ⬜ Not started |
| 12 | editor-*.js | ~120 | ⬜ Not started |
| 13 | main-email.js + bundles | ~60 | ⬜ Not started |
| 14 | Page scripts | ~80 | ⬜ Not started |
| 15 | CSS sections | ~50 | ⬜ Not started |

---

<!-- Audit results will be appended below as each batch is completed -->


## Batch 1: shared-utils.js (50 functions)

| # | Web Function | Description | Status | Android Location |
|---|-------------|-------------|--------|-----------------|
| 1 | `getCachedSettings()` | Settings fetch with promise cache | ✅ | `data/repository/SettingsRepository.kt` — `settings` Flow from Room |
| 2 | `_invalidateSettingsCache()` | Force fresh settings fetch | ✅ | `data/repository/SettingsRepository.kt` — sync pull replaces entity |
| 3 | `_detectBrowserTimezone()` | Detect timezone via Intl API | ✅ | Android framework: `TimeZone.getDefault().id` |
| 4 | `getCurrentTimezone()` | Resolve user timezone (override → browser → default → UTC) | ⚠️ | `data/local/entity/SettingsEntity.kt` has `defaultTimezone` + `timezoneOverride` fields; no single resolver function found |
| 5 | `convertTimezoneForDisplay(isoString, fromTz, toTz, opts)` | Convert datetime between IANA timezones | ❌ | No dedicated function found |
| 6 | `getChitDisplayTime(chit, field, currentTz)` | Get display time, converting if anchored | ❌ | No dedicated function found |
| 7 | `cwocConfirm(message, opts)` | Parchment-styled confirm modal → Promise<boolean> | ✅ | `ui/components/CwocPromptDialog.kt` |
| 8 | `cwocToast(message, type, duration)` | Auto-dismissing notification toast | ✅ | `ui/components/UndoToast.kt` — `UndoToast()` composable |
| 9 | `cwocUndoToast(message, opts)` | Undo toast with countdown bar | ✅ | `ui/components/UndoToast.kt` — `UndoToast()` composable |
| 10 | `cwocUnsavedModal(opts)` | Save/Discard/Cancel modal | ⚠️ | Handled inline in `ChitEditorViewModel` back-press logic; no reusable shared component |
| 11 | `cwocPromptModal(title, placeholder, onConfirm, opts)` | Text input modal | ✅ | `ui/components/CwocPromptDialog.kt` |
| 12 | `_convertTemp(c)` | Convert Celsius for display by unit_system | ✅ | `ui/util/UnitConverter.kt` — `formatTemperature()` |
| 13 | `_tempUnit()` | Return °C or °F label | ⚠️ | Embedded in `formatTemperature()` return string; no standalone function |
| 14 | `_isMetricUnits()` | Return true if metric | ❌ | No standalone function; checked inline via settings.unitSystem |
| 15 | `_convertWind(kmh)` | Convert wind speed for display | ✅ | `ui/util/UnitConverter.kt` — `formatSpeed()` |
| 16 | `_tempBarRange()` | Return barMin/barMax for temp visuals | ❌ | Not found |
| 17 | `_getTempFeeling(minC, maxC)` | Human-readable temp feeling | ❌ | Not found |
| 18 | `_getWeatherDescription(weatherCode, minC, maxC, windGustsKmh)` | Weather description string | ❌ | Not found |
| 19 | `_getTempColor(tempC)` | Map temperature to color | ❌ | Not found |
| 20 | `_buildTempGradient()` | Build CSS gradient for temp bar | N/A | Web-only (CSS) |
| 21 | `_getTempBorderColor(tempC)` | Border color from temperature | ❌ | Not found |
| 22 | `_tempAltUnit(tempC)` | Alternate unit display (hover tooltip) | ❌ | Not found |
| 23 | `_tempDisplayAlt(displayTemp)` | Alternate temp display | ❌ | Not found |
| 24 | `_windDisplayAlt(displayValue)` | Alternate wind display | ❌ | Not found |
| 25 | `_precipAlt(precipMm)` | Alternate precip display (mm↔in) | ❌ | Not found |
| 26 | `generateUniqueId()` | Timestamp + random base-36 ID | ✅ | `java.util.UUID.randomUUID().toString()` used throughout |
| 27 | `formatDate(date)` | Format as YYYY-Mon-DD | ✅ | `ui/util/DateUtils.kt` — `formatDisplayDate()` (different format: "Mon d, yyyy") |
| 28 | `formatTime(date)` | Format as HH:MM | ✅ | `ui/util/DateUtils.kt` — `formatDisplayTime()` |
| 29 | `setSaveButtonUnsaved()` | Mark save button dirty | ✅ | `ChitEditorViewModel` — `hasUnsavedChanges` StateFlow |
| 30 | `contrastColorForBg(hex)` | Dark/light text for contrast | ✅ | `ui/theme/ColorUtils.kt` — `computeAutoContrast()` |
| 31 | `applyChitColors(el, bgColor)` | Apply bg + auto-contrast text | ✅ | `ui/components/CwocChitCardStyle.kt` + `ColorUtils.applyContactRowColors()` |
| 32 | `isLightColor(hex)` | True if luminance > threshold | ✅ | `ui/theme/ColorUtils.kt` — `computeAutoContrast()` (logic embedded) |
| 33 | `cwocRenderColorPicker(container, currentColor, onChange, opts)` | Render color swatch picker | ✅ | `ui/screens/editor/zones/ColorZone.kt` |
| 34 | `_utcToLocalDate(isoString)` | Parse ISO to local Date | ✅ | `ui/util/DateUtils.kt` — `LocalDateTime.parse()` |
| 35 | `_parseISOTime(isoString)` | Parse ISO to HH:MM string | ✅ | `ui/util/DateUtils.kt` — `formatDisplayTime()` |
| 36 | `getPastelColor(label)` | Deterministic pastel from string | ❌ | Not found in ColorUtils |
| 37 | `chitMatchesSearch(chit, searchText)` | Plain-text search across chit fields | ✅ | `domain/search/BooleanSearchEvaluator.kt` — `matches()` |
| 38 | `cwocExtractSearchTerms(query)` | Extract terms for highlighting | ❌ | Not found |
| 39 | `cwocHighlightTerms(text, terms)` | Wrap matches in `<mark>` | N/A | Web-only (HTML markup) |
| 40 | `cwocWireLivePreview(textareaId, previewId)` | Wire markdown live preview | N/A | Web-only (DOM wiring) |
| 41 | `cwocUpdateLivePreview(textareaId, previewId)` | Update markdown preview | ✅ | `ui/components/MarkdownRenderer.kt` (Compose state-driven) |
| 42 | `cwocChitPickerModal(options)` | Chit picker with search/filters | ✅ | `ui/components/ChitPickerSheet.kt` |
| 43 | `_escHtml(str)` | Escape HTML chars | N/A | Web-only |
| 44 | `_cwocGetWeatherIcon(code)` | WMO code → emoji | ✅ | `ui/components/ChitCardEnhancements.kt` — `weatherCodeToEmoji()` |
| 45 | `_cwocGetPrecipType(code)` | WMO code → precip type string | ❌ | Not found as standalone |
| 46 | `_cwocFormatPrecip(precipMm, weatherCode, emptyVal)` | Format precip with type | ❌ | Not found |
| 47 | `_convertDBDateToDisplayDate(dateString)` | UTC ISO → local display date | ✅ | `ui/util/DateUtils.kt` — `formatDisplayDate()` |
| 48 | `cwocContactMatchesFilter(contact, query)` | Contact search across all fields | ⚠️ | `ui/screens/contacts/ContactListViewModel.kt` has filtering but no standalone reusable function |
| 49 | `_cwocGetHabitCycleEnd(freq)` | Calculate habit cycle end datetime | ❌ | Not found |
| 50 | `cwocHighlightMatch(text, query)` | Highlight query matches in text | ❌ | Not found |
| 51 | `cwocAttachmentPreview(url, filename, mimeType)` | Render attachment preview | ✅ | `ui/screens/editor/zones/AttachmentsZone.kt` |

**Batch 1 Summary:** 51 functions — ✅ 24, ⚠️ 4, ❌ 16, N/A 4

---

## Batch 2: shared-calendar.js (16 functions)

| # | Web Function | Description | Status | Android Location |
|---|-------------|-------------|--------|-----------------|
| 52 | `getCalendarDateInfo(chit)` | Normalize chit date info for calendar display | ✅ | `ui/screens/calendar/CalendarViewModel.kt` — inline in event mapping |
| 53 | `chitMatchesDay(chit, day)` | Check if chit appears on a given day | ✅ | `ui/screens/calendar/CalendarViewModel.kt` — inline in day filtering |
| 54 | `calendarEventTitle(chit, isDueOnly, info, settings, context)` | Build event title with indicators | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — inline in event composable |
| 55 | `calendarEventTooltip(chit, info)` | Build tooltip string | N/A | Web-only (hover tooltips; Android uses long-press) |
| 56 | `_loadCalSnapSetting()` | Load snap interval from settings | ✅ | `ui/screens/calendar/CalendarViewModel.kt` — `calendarSnap` in UiState |
| 57 | `_snapToGrid(minutes)` | Snap minute value to grid | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — `snapToGrid()` private fun |
| 58 | `_showSnapGrid(container)` | Show visual snap grid overlay | ❌ | No visual snap grid overlay found |
| 59 | `_hideSnapGrid()` | Remove snap grid overlay | ❌ | No visual snap grid overlay found |
| 60 | `enableCalendarDrag(...)` | Make timed events draggable/resizable | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — `detectDragGestures` in event composable |
| 61 | `_onCalDragMove(e)` | Handle move during drag | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — `onDrag` lambda |
| 62 | `_onCalDragEnd(e)` | Handle end of drag, save new times | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — `onDragEnd` + `persistDragMove()` |
| 63 | `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` | Modal for recurring drag scope | ✅ | `ui/screens/calendar/CalendarScreen.kt` — `PendingRecurringDrag` + AlertDialog |
| 64 | `enableMonthDrag(monthGrid, onDrop)` | Month view drag between cells | ❌ | Not found in CalendarMonthView |
| 65 | `enableAllDayDrag(allDayEventsRow, days)` | All-day event drag between days | ❌ | Not found |
| 66 | `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` | Render all-day events with multi-day spanning | ⚠️ | `CalendarTimeGrid.kt` has all-day section but multi-day spanning not confirmed |
| 67 | `enableCalendarPinchZoom(scrollContainer)` | Pinch-to-zoom on calendar | ✅ | `ui/screens/calendar/CalendarTimeGrid.kt` — `detectTransformGestures` + `zoomScale` |

**Batch 2 Summary:** 16 functions — ✅ 10, ⚠️ 1, ❌ 3, N/A 1

---

## Batch 3: shared-checklist.js (6 functions)

| # | Web Function | Description | Status | Android Location |
|---|-------------|-------------|--------|-----------------|
| 68 | `renderChecklistItemMarkdown(el, text)` | Render markdown inline for checklist item | ✅ | `ui/components/MarkdownRenderer.kt` used in checklist zone |
| 69 | `toggleChecklistItem(chitId, itemIndex, newChecked)` | Toggle item checked + save via API | ✅ | `domain/checklist/ChecklistOperationsV2.kt` — `toggleCheck()` |
| 70 | `moveChecklistItem(chitId, fromIndex, toIndex)` | Move item within chit + save | ✅ | `domain/checklist/ChecklistOperationsV2.kt` — `moveAbove()` / `moveBelow()` |
| 71 | `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | Move item between chits | ✅ | `ui/screens/editor/zones/ChecklistZoneV2.kt` — `onSendItemsToChit` |
| 72 | `_updateChecklistProgressCount(container, chit)` | Update X/Y progress count | ✅ | `ui/components/ChitCardEnhancements.kt` — `ChecklistProgressBadge()` |
| 73 | `renderInlineChecklist(container, chit, onUpdate)` | Render interactive checklist with drag-reorder | ✅ | `ui/screens/editor/zones/ChecklistZoneV2.kt` |

**Batch 3 Summary:** 6 functions — ✅ 6, ⚠️ 0, ❌ 0, N/A 0

---

## Batch 4: shared-sort.js (10 functions)

| # | Web Function | Description | Status | Android Location |
|---|-------------|-------------|--------|-----------------|
| 74 | `_markDragJustEnded()` | Suppress post-drag click events | N/A | Web-only (browser event quirk) |
| 75 | `_loadSortPreferencesFromServer()` | Load sort prefs from API | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `loadSortPreference()` |
| 76 | `getSortPreference(tab)` | Get saved sort field+direction for tab | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `loadSortPreference()` |
| 77 | `saveSortPreference(tab, field, dir)` | Save sort pref to API | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `persistSortPreference()` |
| 78 | `resetAllSortOrders()` | Reset all sort orders + prefs | ⚠️ | Not found as single function; `clearFilters()` exists but doesn't reset sort orders |
| 79 | `_loadSortOrdersFromServer()` | Load manual sort orders from API | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `getManualOrder()` |
| 80 | `getManualOrder(tab)` | Get saved manual order for tab | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `getManualOrder()` |
| 81 | `saveManualOrder(tab, ids)` | Save manual order to API | ✅ | `ui/viewmodel/FilterSortViewModel.kt` — `saveManualOrder()` |
| 82 | `applyManualOrder(tab, chitList)` | Sort list by saved manual order | ✅ | `domain/sort/SortEngine.kt` — `sort()` with MANUAL field |
| 83 | `enableDragToReorder(container, tab, onReorder, longPressMap)` | Enable drag-to-reorder on cards | ✅ | `ui/components/ReorderableList.kt` |

**Batch 4 Summary:** 10 functions — ✅ 8, ⚠️ 1, ❌ 0, N/A 1

---

## Batch 5: shared-indicators.js (9 functions)

| # | Web Function | Description | Status | Android Location |
|---|-------------|-------------|--------|-----------------|
| 84 | `_ALERT_TYPES` | Array of valid alert type values | ✅ | `domain/alerts/AlertClassifier.kt` |
| 85 | `_chitHasAlerts(chit)` | Return true if chit has any alerts | ✅ | `domain/alerts/AlertClassifier.kt` — alert detection logic |
| 86 | `_ALERT_ICON_MAP` | Alert types → emoji icons | ✅ | `ui/components/ChitCardEnhancements.kt` — inline in indicator rendering |
| 87 | `_STATUS_ICONS` | Status → icon mapping | ✅ | `ui/screens/tasks/TasksScreen.kt` — status icons inline |
| 88 | `_getAlertIndicators(chit, settings, context)` | Return alert indicator icons based on settings | ⚠️ | `ui/components/ChitCardEnhancements.kt` — indicators exist but settings-based display modes (always/never/space) not confirmed |
| 89 | `_getAllIndicators(chit, settings, context)` | Return all visual indicators (alerts+people+health+recurrence+attachments) | ⚠️ | `ui/components/ChitCardEnhancements.kt` — individual indicator composables exist (WeatherIndicator, PeopleChipsRow, etc.) but no single unified function matching web's combined logic |
| 90 | `_shouldShow(mode, context)` | Check if display mode permits showing in context | ❌ | No equivalent found; web has always/never/space logic per indicator |
| 91 | `_chitAlertTypesPresent(chit)` | Map each alert type to presence boolean | ✅ | `domain/alerts/AlertClassifier.kt` — classification logic |
| 92 | `_computePrerequisiteFlags(allChits)` | Compute _hasIncompletePrereqs flag on each chit | ❌ | Not found as batch computation; prerequisites field exists but no pre-computation of blocked state |

**Batch 5 Summary:** 9 functions — ✅ 5, ⚠️ 2, ❌ 2, N/A 0

---

## Batches 1–5 Totals

| Status | Count | % |
|--------|-------|---|
| ✅ Fully matched | 53 | 57% |
| ⚠️ Partial | 8 | 9% |
| ❌ Missing | 21 | 23% |
| N/A Web-only | 6 | 6% |
| **Total** | **92** | |
