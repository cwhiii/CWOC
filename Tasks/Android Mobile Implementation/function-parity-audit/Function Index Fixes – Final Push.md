# Function Index Fixes – Final Push

115 remaining web functions (82 ❌ Missing + 33 ⚠️ Partial) grouped into 5 specs for implementation.

---

## Spec 1: Recurrence, Calendar & Scheduling (26 functions)

Everything related to recurring events, calendar view enhancements, and time-based scheduling.

| W# | Function | Status | Gap File |
|----|----------|--------|----------|
| 314 | `_showInstanceBanner(dateStr)` | ❌ Missing | W095-recurrenceSeriesInfo.md |
| 315 | `_saveInstanceException(dateStr)` | ❌ Missing | W095-recurrenceSeriesInfo.md |
| 368 | `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` | ❌ Missing | W095-recurrenceSeriesInfo.md |
| 685 | `showRecurrenceActionModal(chit, onRefresh)` | ❌ Missing | W095-recurrenceSeriesInfo.md |
| 684 | `_showDeleteSubMenu(...)` | ⚠️ Partial — no recurrence instance options | W684-deleteSubMenuRecurrence.md |
| 195 | `_addAllDayHeightCap(eventsRow, container)` | ❌ Missing | W195-allDayHeightCap.md |
| 245 | `_weekViewDayOffset` | ❌ Missing | W245-weekViewDayOffset.md |
| 198 | `onPerpetualToggle()` | ❌ Missing | W198-perpetualToggle.md |
| 199 | `_fmtPerpetualDate()` | ❌ Missing | W198-perpetualToggle.md |
| 202 | `_applyDefaultNotifications(mode)` | ❌ Missing | W202-applyDefaultNotifications.md |
| 250 | `_describeCron(expr)` | ❌ Missing | W250-cronExpression.md |
| 251 | `_assembleCronExpression()` | ❌ Missing | W250-cronExpression.md |
| 252 | `_validateCronExpression(expr)` | ❌ Missing | W250-cronExpression.md |
| 113 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 114 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 115 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 116 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 117 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 118 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 119 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
| 218 | `_toggleCombineAlerts()` | ❌ Missing | W218-toggleCombineAlerts.md |
| 395 | `_applyEnabledPeriods()` | ⚠️ Partial — setting stored but dropdown unfiltered | W395-applyEnabledPeriods.md |
| 429 | `openAddChitModal()` | ⚠️ Partial — button exists, not wired | W429-openAddChitModal.md |
| 431 | `createNewChildChit(event)` | ⚠️ Partial — button exists, not wired | W429-openAddChitModal.md |

---

## Spec 2: Search, Filters & Omni View (25 functions)

Everything related to finding, filtering, and displaying chits across views.

| W# | Function | Status | Gap File |
|----|----------|--------|----------|
| 170 | (saved searches) | ❌ Missing | W170-savedSearches.md |
| 171 | (saved searches) | ❌ Missing | W170-savedSearches.md |
| 172 | (saved searches) | ❌ Missing | W170-savedSearches.md |
| 173 | (saved searches) | ❌ Missing | W170-savedSearches.md |
| 174 | `_getSearchSnippet(text, terms)` | ❌ Missing | W174-searchSnippets.md |
| 175 | `_getChitFieldValue(chit, fieldName)` | ❌ Missing | W174-searchSnippets.md |
| 129 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 130 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 131 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 132 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 133 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 134 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
| 203 | (omni misc) | ❌ Missing | W203-omniMisc.md |
| 204 | (omni misc) | ❌ Missing | W203-omniMisc.md |
| 205 | (omni misc) | ❌ Missing | W203-omniMisc.md |
| 206 | (omni misc) | ❌ Missing | W203-omniMisc.md |
| 207 | (omni misc) | ❌ Missing | W203-omniMisc.md |
| 879 | `_omniDeduplicateChits(filteredChits)` | ⚠️ Partial — no cross-section deduplication | W879-omniDeduplicateChits.md |
| 632 | `_applyCustomViewFilters(tab)` | ⚠️ Partial — stored but not applied at runtime | W632-customViewFilters.md |
| 633 | `_resetDefaultFilters()` | ⚠️ Partial — clears to empty, not custom defaults | W632-customViewFilters.md |
| 682 | `showQuickEditModal(chit, onRefresh)` | ⚠️ Partial — no inline status/priority dropdowns | W682-quickEditModal.md |
| 109 | `resolveChitLinks(html, allChits)` | ❌ Missing | W109-resolveChitLinks.md |
| 233 | (recent tags) | ❌ Missing | W233-recentTags.md |
| 234 | (recent tags) | ❌ Missing | W233-recentTags.md |
| 235 | (recent tags) | ❌ Missing | W233-recentTags.md |

---

## Spec 3: Maps, Weather & Location (20 functions)

Everything related to geographic display, weather, and location features.

| W# | Function | Status | Gap File |
|----|----------|--------|----------|
| 176 | (map thumbnails) | ✅ StaticMapTile.kt + ChitCardEnhancements.kt LocationIndicator | |
| 177 | (map thumbnails) | ✅ StaticMapTile.kt (pin overlay on tile) | |
| 178 | (map thumbnails) | ✅ StaticMapTile.kt (90×60dp, placeholder) | |
| 179 | (map thumbnails) | ✅ ChitCardEnhancements.kt (setting check + default exclusion) | |
| 183 | `_displayMapInUI(lat, lon, address)` | ✅ InlineMapPreview.kt + ChitEditorScreen LocationZone | |
| 186 | `onAddDefaultLocation(event)` | ✅ ChitEditorScreen LocationZone default location button | |
| 779 | `_viewLocationInContext(event)` | ✅ LocationZone "View in Context" → Screen.Map.createRoute + MapViewModel focus mode | |
| 767 | `_applyPeopleFilters(contacts)` | ✅ PeopleFilterPanel.kt + MapViewModel.applyPeopleFilters() | |
| 768 | `_handleFocusAddress(focusType, address)` | ✅ MapViewModel.handleFocusNavigation() + FocusState + HighlightMarker.kt | |
| 773 | `_geocodeAddress(address)` | ✅ GeocodingUtil.kt geocode() + generateVariants() progressive fallback + server proxy | |
| 165 | (weather nav intent) | ✅ WeatherScreen.kt day block tap → Calendar Day view | |
| 166 | (weather nav intent) | ✅ CalendarViewModel.kt weather navigation handling | |
| 167 | (weather nav intent) | ✅ CalendarTimeGrid.kt location-based chit highlighting | |
| 253 | `_wxIsExtreme(highC, lowC, weatherCode)` | ✅ WeatherViewModel.kt isExtreme() + red border styling | |
| 254 | `_wxInitBlockClick(container)` | ✅ WeatherScreen.kt DailyForecastRow clickable | |
| 255 | `_wxInitDragDrop(container)` | ✅ WeatherViewModel.kt reorderLocations() + drag-to-reorder UI | |
| 791 | `_onWeatherModalManualGo()` | ✅ WeatherModal.kt "Type a location" + text input + geocode | |
| 921 | `_tempBarRange()` | ✅ TemperatureBar.kt composable + WeatherScreen DailyForecastRow | |

---

## Spec 4: Email, Bundles & Data Management (22 functions)

Email features, bundle operations, export, and data management.

| W# | Function | Status | Gap File |
|----|----------|--------|----------|
| 135 | (email nesting) | ❌ Missing | W135-emailNesting.md |
| 136 | (email nesting) | ❌ Missing | W135-emailNesting.md |
| 137 | (email nesting) | ❌ Missing | W135-emailNesting.md |
| — | Editor nest thread picker functions | ❌ Missing | W135-emailNesting.md |
| 140 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 141 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 142 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 143 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 144 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 145 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 146 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 147 | (bundle reorder) | ❌ Missing | W140-bundleReorder.md |
| 208 | `_showAddToBundleModal(chit)` | ❌ Missing | W208-addToBundleModal.md |
| 209 | `_executeAddToBundle(chit, overlay)` | ❌ Missing | W208-addToBundleModal.md |
| 126 | `exportChitData()` | ⚠️ Partial — API exists, no UI button | W126-export.md |
| 127 | `exportUserData()` | ⚠️ Partial — API exists, no UI button | W126-export.md |
| 128 | `exportAllData()` | ⚠️ Partial — API exists, no UI button | W126-export.md |
| 230 | (password management) | ❌ Missing | W230-passwordManagement.md |
| 231 | (password management) | ❌ Missing | W230-passwordManagement.md |
| 232 | (password management) | ❌ Missing | W230-passwordManagement.md |
| 221 | `_openBadgeCustomModal(existing)` | ❌ Missing | W221-badgeCustomModal.md |
| 222 | `_saveBadgeCustomDetector()` | ❌ Missing | W221-badgeCustomModal.md |

---

## Spec 5: Editor Enhancements & Miscellaneous (22 functions)

Editor zone features, checklist improvements, and remaining small gaps.

| W# | Function | Status | Gap File |
|----|----------|--------|----------|
| 223 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
| 224 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
| 225 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
| 226 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
| 227 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
| 228 | `handleSelect(idx, e)` | ✅ AttachmentsViewModel.enterMultiSelectMode() + toggleSelection() + exitMultiSelectMode() + AttachmentsScreen UI | W228-attachmentMultiSelect.md |
| 229 | `bulkDelete()` | ✅ AttachmentsViewModel.bulkDelete() + AttachmentsScreen delete confirmation dialog | W228-attachmentMultiSelect.md |
| 247 | `_pasteClipboardAsChecklistItems(checklist)` | ❌ Missing | W247-checklistClipboard.md |
| 248 | `_copyIncompleteToClipboard(checklist)` | ❌ Missing | W247-checklistClipboard.md |
| 405 | `renderChecklistItemMarkdown(span, text)` | ❌ Missing — plain text only, no inline markdown | W405-checklistItemMarkdown.md |
| 189 | `_notesListContinue(textarea)` | ❌ Missing | W189-notesListContinue.md |
| 156 | (indicators drag reorder) | ❌ Missing | W156-indicatorsDragReorder.md |
| 157 | (indicators drag reorder) | ❌ Missing | W156-indicatorsDragReorder.md |
| 240 | `_getUserRsvpStatus(chit)` | ❌ Missing | W240-rsvpStatus.md |
| 241 | `_isDeclinedByCurrentUser(chit)` | ❌ Missing | W240-rsvpStatus.md |
| 242 | `_showProjectQuickMenu(e, project)` | ❌ Missing — no project context menu | W242-projectQuickMenu.md |
| 243 | `moveChildChitToProject(childChitId, targetProjectId)` | ❌ Missing | W242-projectQuickMenu.md |
| 603 | `saveContactAndStay()` | ❌ Missing — save always navigates back | W603-saveContactAndStay.md |
| 901 | `renderGrid(wrap)` | ⚠️ Partial — grid renders but missing chit titles | W901-renderGrid.md |

---

## Summary

| Spec | Theme | Functions |
|------|-------|-----------|
| 1 | Recurrence, Calendar & Scheduling | 26 |
| 2 | Search, Filters & Omni View | 25 |
| 3 | Maps, Weather & Location | 20 |
| 4 | Email, Bundles & Data Management | 22 |
| 5 | Editor Enhancements & Miscellaneous | 22 |
| **Total** | | **115** |
