# CWOC — Web → Android Function Mapping (Priority-Based)

> Maps every web frontend function to its Android app equivalent, organized by implementation priority.
> Use this to identify parity gaps, plan work, and find where functionality lives on each platform.

---

## Table of Contents

1. [Priority 1: Core Parity Gaps (❌ Not Implemented — High Impact)](#priority-1-core-parity-gaps--not-implemented--high-impact)
2. [Priority 2: Feature Gaps (❌ Not Implemented — Medium Impact)](#priority-2-feature-gaps--not-implemented--medium-impact)
3. [Priority 3: Implemented ✅](#priority-3-implemented-)
4. [Priority 4: Web-Only (N/A — No Android Equivalent Needed)](#priority-4-web-only-na--no-android-equivalent-needed)
5. [Priority 5: Android Framework (Handled Natively)](#priority-5-android-framework-handled-natively)
6. [Summary Statistics](#summary-statistics)

---

## Priority 1: Core Parity Gaps (❌ Not Implemented — High Impact)

Functions that are NOT implemented on Android but represent major user-facing features. These are the biggest parity gaps.

---

### Habits System

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displayHabitsView(chitsToDisplay)` | Render Habits view | ❌ Not implemented |
| `_renderHabitCards(container, habitData, windowDays)` | Render habit cards | ❌ Not implemented |
| `_isResetPeriodActive(chit)` | Check if reset period is active | ❌ Not implemented |
| `_getResetEndDate(chit)` | Calculate reset period end date | ❌ Not implemented |
| `_habitUrgencyScore(h)` | Calculate urgency score | ❌ Not implemented |
| `_persistHabitUpdate(chit)` | Debounced habit update | ❌ Not implemented |
| `_optimisticHabitCardUpdate(card, chit, newSuccess, goal)` | Instant UI feedback for habit | ❌ Not implemented |
| `_updateStatusBadge(card, status)` | Update status badge on habit card | ❌ Not implemented |
| `_onHabitsWindowChange(newVal)` | Handle habits window dropdown change | ❌ Not implemented |
| `_initHabitsWindowDropdown()` | Initialize habits window dropdown | ❌ Not implemented |
| `_fetchAndRenderRuleHabits(container)` | Fetch and render rule habits | ❌ Not implemented |
| `_renderAggregateSuccessRate(container, ruleHabits)` | Render combined success rate | ❌ Not implemented |
| `_onHabitsIncludeRulesChange(checked)` | Handle include rules toggle | ❌ Not implemented |
| `getCurrentPeriodDate(chit)` | Return current period date for recurring chit | ❌ Not implemented |
| `_getPreviousPeriodDate(chit)` | Return previous period date | ❌ Not implemented |
| `_evaluateHabitRollover(chit)` | Detect period change for habit | ❌ Not implemented |
| `_persistHabitRollover(chit)` | Persist habit rollover state | ❌ Not implemented |
| `getHabitSuccessRate(chit, windowDays)` | Calculate habit success percentage | ❌ Not implemented |
| `getHabitStreak(chit)` | Count consecutive successful periods | ❌ Not implemented |
| `_buildHabitCounter(opts)` | Build habit counter widget | ❌ Not implemented |
| `_cwocGetHabitCycleEnd(freq)` | Calculate end-of-cycle for habit | ❌ Not implemented |
| `fetchHabitRules()` | Fetch habit rules from API | ❌ Not implemented |
| `_renderHabitRuleCards(container, habitRules)` | Render habit rule cards | ❌ Not implemented |

---

### Calendar Drag-and-Drop

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap)` | Make calendar events draggable | ❌ Not implemented |
| `_onCalDragMove(e)` | Handle move during calendar drag | ❌ Not implemented |
| `_onCalDragEnd(e)` | Handle end of calendar drag | ❌ Not implemented |
| `enableMonthDrag(monthGrid, onDrop)` | Enable month view drag | ❌ Not implemented |
| `enableAllDayDrag(allDayEventsRow, days)` | Enable all-day event drag | ❌ Not implemented |
| `_calSnapMinutes` | Snap grid interval in minutes | ❌ Not implemented |
| `_loadCalSnapSetting()` | Load calendar snap setting | ❌ Not implemented |
| `_snapToGrid(minutes)` | Snap minute value to grid interval | ❌ Not implemented |
| `_showSnapGrid(container)` | Show visual snap grid overlay | ❌ Not implemented |
| `_hideSnapGrid()` | Remove snap grid overlay | ❌ Not implemented |

---

### Calendar Pinch-to-Zoom

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_calZoomScale` | Current vertical zoom scale | ❌ Not implemented |
| `enableCalendarPinchZoom(scrollContainer)` | Enable pinch-to-zoom on calendar | ❌ Not implemented |

---

### Editor Prerequisites

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `initPrerequisites(chit)` | Load prerequisites into UI | ❌ Not implemented |
| `getPrerequisitesData()` | Return prerequisites for save | ❌ Not implemented |
| `openPrereqPicker()` | Open chit picker for prerequisites | ❌ Not implemented |
| `_renderPrereqList()` | Render selected prerequisites | ❌ Not implemented |
| `_onPrereqStatusChange(selectEl)` | Handle inline status change | ❌ Not implemented |
| `_removePrereq(id)` | Remove prerequisite | ❌ Not implemented |
| `_checkPrereqAutoBlock()` | Auto-block based on prereq status | ❌ Not implemented |
| `checkPrereqStatusOverride(newStatus)` | Warn on manual override | ❌ Not implemented |

---

### Editor Send-Content / Send-Item

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_openSendContentModal(e, contentType)` | Open chit picker for sending notes/checklist | ❌ Not implemented |
| `_closeSendContentModal()` | Close send-content modal | ❌ Not implemented |
| `_sendContentRenderChits(chits)` | Render chit list with radio-select | ❌ Not implemented |
| `_sendContentHighlight(text, term)` | Highlight search matches | ❌ Not implemented |
| `_sendContentUpdateButtons()` | Enable/disable Copy/Move buttons | ❌ Not implemented |
| `_sendContentApplyFilters()` | Apply search and status filter | ❌ Not implemented |
| `_sendContentMatchesSearch(chit, term)` | Check if chit matches search | ❌ Not implemented |
| `_executeSendContent(mode)` | Execute copy/move operation | ❌ Not implemented |
| `_showSendContentUndoBar(mode, targetChit, savedTarget, undoData)` | Show undo bar after send | ❌ Not implemented |
| `_undoSendContent(mode, targetChit, undoData)` | Undo send operation | ❌ Not implemented |
| `_openSendItemPopup(e, item, checklist)` | Open quick send popup | ❌ Not implemented |
| `_closeSendItemPopup()` | Close send-item popup | ❌ Not implemented |
| `_fetchRecentChitsForItem()` | Fetch recent chits for popup | ❌ Not implemented |
| `_renderSendItemPopup(allChits)` | Render popup with recent chits | ❌ Not implemented |
| `_openSendItemSearchModal()` | Open full search modal | ❌ Not implemented |
| `_closeSendItemSearchModal()` | Close search modal | ❌ Not implemented |
| `_executeSendItem(mode, targetChit)` | Execute copy/move of item | ❌ Not implemented |
| `_sendItemSpawnNewChit(mode)` | Spawn new chit from item | ❌ Not implemented |
| `_flashChecklistAddArrow()` | Flash arrow when item added | ❌ Not implemented |

---

### People Zone (Full Tree, Sharing)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_initPeopleAutocomplete()` | Initialize people zone | ❌ Not implemented (partial — basic people chips) |
| `_loadAllContactsForTree()` | Fetch contacts for tree | ❌ Not implemented |
| `_loadAllUsersForTree()` | Fetch system users | ❌ Not implemented |
| `_renderPeopleTree(filter)` | Render grouped alphabetical tree | ❌ Not implemented |
| `_addShare(userId, role, displayName)` | Add user to shares | ❌ Not implemented |
| `_removeShare(userId)` | Remove user from shares | ❌ Not implemented |
| `_updateShareRole(userId, newRole)` | Update share role | ❌ Not implemented |
| `initPeopleSharingControls(chit)` | Initialize sharing controls | ❌ Not implemented |
| `_addPeopleChip(data)` | Add person chip | ❌ Not implemented |
| `_removePeopleChip(index)` | Remove person chip | ❌ Not implemented |
| `openPeopleExpandModal()` | Open full-screen People modal | ❌ Not implemented |
| `closePeopleExpandModal()` | Close People modal | ❌ Not implemented |
| `_loadSharingUserList()` | Fetch switchable users | ❌ Not implemented |
| `_getUserDisplayName(userId)` | Look up user display name | ❌ Not implemented |
| `getSharingData()` | Return sharing fields for save | ❌ Not implemented |
| `hasSharingData(chit)` | Check if chit has sharing data | ❌ Not implemented |

---

### Custom Zones in Editor

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `window._customZoneData` | Custom zone field values | ❌ Not implemented |
| `_fetchCustomZones()` | Fetch custom zones | ❌ Not implemented |
| `_fetchZoneObjects(zoneId)` | Fetch objects for zone | ❌ Not implemented |
| `_renderCustomZonePanel(zone, objects, settings, healthData)` | Render zone panel | ❌ Not implemented |
| `_loadCustomZones(chit)` | Entry point for zone loading | ❌ Not implemented |
| `_gatherCustomZoneData()` | Collect zone data for save | ❌ Not implemented |

---

### Health Indicators Zone in Editor

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `window._healthData` | Health indicator values | ❌ Not implemented |
| `window._indicatorObjects` | Cached zone query result | ❌ Not implemented |
| `_evaluateConditionalDisplay(rule, settings)` | Evaluate conditional display rule | ❌ Not implemented |
| `_getUnitLabel(obj, unitSystem)` | Get unit label for system | ❌ Not implemented |
| `_getRangeHighlightClass(value, rangeMin, rangeMax)` | Determine range highlight | ❌ Not implemented |
| `_fetchIndicatorObjects()` | Fetch indicator objects | ❌ Not implemented |
| `_renderIndicatorField(obj, value)` | Render indicator field | ❌ Not implemented |
| `_showAddIndicatorPicker()` | Show add indicator picker | ❌ Not implemented |
| `_loadHealthData(chit)` | Orchestrate health data loading | ❌ Not implemented |
| `_gatherHealthData()` | Collect health data for saving | ❌ Not implemented |

---

### Recurrence Series Summary / Break-Off / Complete Series

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `getRecurrenceSeriesInfo(chit, virtualDate)` | Count occurrence number, completed count, success rate | ❌ Not implemented |
| `_renderSeriesSummary(container, virtualChit, parentId)` | Render series summary | ❌ Not implemented |
| `_recurrenceCompleteSeries(parentId)` | Mark entire series Complete | ❌ Not implemented |
| `_recurrenceBreakOff(parentId, virtualChit, dateStr)` | Break off instance to standalone | ❌ Not implemented |
| `_checkRecurrenceAutoArchive(parentId)` | Auto-archive if all instances done | ❌ Not implemented |

---

### Auto-Complete Checklist → Status

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_autoCompleteChecklistEnabled` | Auto-complete checklist flag | ❌ Not implemented |
| `_initAutoCompleteChecklist(chit)` | Initialize auto-complete | ❌ Not implemented |
| `_showAutoCompleteBtnIfChild()` | Show/hide auto-complete button | ❌ Not implemented |
| `_updateAutoCompleteBtn()` | Update auto-complete button state | ❌ Not implemented |
| `_evaluateAutoCompleteChecklist()` | Auto-set status from checklist | ❌ Not implemented |

---

### Chit Link Autocomplete

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_checkChitLinkAutocomplete(textarea)` | Show [[ ]] autocomplete | ❌ Not implemented |
| `_showChitLinkDropdown(textarea, matches)` | Render autocomplete dropdown | ❌ Not implemented |
| `_removeChitLinkDropdown()` | Remove autocomplete dropdown | ❌ Not implemented |
| `_insertChitLink(textarea, title)` | Insert chit link | ❌ Not implemented |
| `resolveChitLinks(html, allChits)` | Replace [[title]] with links | ❌ Not implemented |

---

### Notes Fullscreen Modal

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `openNotesModal(event)` | Open fullscreen notes modal | ❌ Not implemented |
| `closeNotesModal(save)` | Close notes modal | ❌ Not implemented |
| `toggleModalNotesRender()` | Toggle modal edit/rendered | ❌ Not implemented |

---

### Quick Alert Modal

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_openQuickAlertModal()` | Open Quick Alert modal (! hotkey) | ❌ Not implemented |
| `_closeQuickAlertModal()` | Close Quick Alert modal | ❌ Not implemented |
| `_quickAlertShowEditor(type)` | Show editor for selected alert type | ❌ Not implemented |
| `_quickAlertSave(type, data, andView, autoStart)` | Save alert from quick alert editor | ❌ Not implemented |
| `_quickReminderSave(data, andView)` | Create chit with notification alert | ❌ Not implemented |
| `_quickAlertJumpToIndependent()` | Switch to Alarms tab independent mode | ❌ Not implemented |
| `_showQuickAlertToast(type)` | Show alert creation toast | ❌ Not implemented |

---

### Editor Auto-Save

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `CwocAutoSave(settings)` | Constructor — initialize auto-save | ❌ Not implemented |
| `CwocAutoSave.prototype.scheduleAutoSave()` | Schedule auto-save after debounce | ❌ Not implemented |
| `CwocAutoSave.prototype.cancelPending()` | Cancel pending auto-save | ❌ Not implemented |
| `CwocAutoSave.prototype.isEnabled()` | Check if auto-save enabled | ❌ Not implemented |
| `CwocAutoSave.prototype._performSave()` | Perform actual save | ❌ Not implemented |
| `CwocAutoSave.prototype.saveImmediately()` | Immediate save for exit | ❌ Not implemented |

---

### Export/Import Data

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `exportChitData()` | Export chits as JSON | ❌ Not implemented |
| `exportUserData()` | Export user data as JSON | ❌ Not implemented |
| `exportAllData()` | Export all data as JSON | ❌ Not implemented |

---


## Priority 2: Feature Gaps (❌ Not Implemented — Medium Impact)

Functions not implemented but less critical — nice-to-haves, secondary features, smaller scope items.

---

### Omni View Filter Locking

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_applyOmniEntryFilters()` | Apply locked filter defaults | ❌ Not implemented |
| `_applyLockedFiltersToSidebar(locked)` | Set sidebar filter UI | ❌ Not implemented |
| `_showOmniLockedIndicator(show)` | Show/hide locked indicator | ❌ Not implemented |
| `_lockOmniFilters()` | Save current filters as defaults | ❌ Not implemented |
| `_showOmniLockBtn()` | Show Lock Filters button | ❌ Not implemented |
| `_hideOmniLockBtn()` | Hide Lock Filters button | ❌ Not implemented |

---

### Email Nesting

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_emailInjectNests(threads)` | Inject nested chits into threads | ❌ Not implemented |
| `_buildNestedChitCard(chit)` | Build nested chit card | ❌ Not implemented |
| `_nestGetContentPreview(chit)` | Get content preview for nested chit | ❌ Not implemented |
| Editor nest thread picker functions | Email thread nesting | ❌ Not implemented |

---

### Email Shift-Select

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_emailShiftSelect(currentCb)` | Shift+click range selection | ❌ Not implemented |
| `_emailLastCheckedIndex` | Last clicked checkbox index | ❌ Not implemented |

---

### Bundle Drag Reorder

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_enableBundleReorder()` | Enable drag-and-drop reorder | ❌ Not implemented |
| `_bundleReorderDragStart(e)` | Drag start for reorder | ❌ Not implemented |
| `_bundleReorderDragEnd(e)` | Drag end for reorder | ❌ Not implemented |
| `_bundleReorderDragOver(e)` | Drag over for reorder | ❌ Not implemented |
| `_bundleReorderDrop(e)` | Drop for reorder | ❌ Not implemented |
| `_persistBundleReorder(orderedIds)` | PUT reorder to API | ❌ Not implemented |
| `_bundleReorderFinishOnClick(e)` | Click-outside to finish reorder | ❌ Not implemented |
| `_disableBundleReorder()` | Disable reorder mode | ❌ Not implemented |

---

### Indicators Calendar/Log Modes

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_classifyDayColor(dayReadings, objects)` | Classify day color for calendar mode | ❌ Not implemented |
| `_indicatorsRenderCalendar(data, objects)` | Render Calendar Mode | ❌ Not implemented |
| `_findObjectByLegacyKey(legacyKey, objects)` | Find Custom Object by legacy key | ❌ Not implemented |
| `_buildLogSummary(healthData, objects)` | Build readable summary from health_data | ❌ Not implemented |
| `_indicatorsRenderLog(data, objects)` | Render Log Mode | ❌ Not implemented |
| `_indRestoreOneOffGraphs()` | Restore one-off graph entries | ❌ Not implemented |
| `_indShowAddGraphPicker()` | Show add graph picker modal | ❌ Not implemented |
| `_indAddOneOffGraph(obj)` | Add one-off graph checkbox | ❌ Not implemented |

---

### Indicators Drag Reorder

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_enableIndicatorsDragReorder(container)` | Enable drag-to-reorder charts | ❌ Not implemented |
| `_restoreIndicatorsOrder(container)` | Restore saved chart order | ❌ Not implemented |

---

### Custom View Filters (Settings)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_customFilterViews` | View definitions array | ❌ Not implemented |
| `_customViewFilters` | In-memory custom view filters | ❌ Not implemented |
| `_renderCustomFilterButtons()` | Render per-view buttons | ❌ Not implemented |
| `_loadCustomViewFilters(settings)` | Load custom view filters | ❌ Not implemented |
| `_gatherCustomViewFilters()` | Serialize for save | ❌ Not implemented |
| `_openCustomFilterModal(viewKey)` | Open filter modal for view | ❌ Not implemented |
| `_closeCustomFilterModal()` | Close filter modal | ❌ Not implemented |

---

### Weather Navigation Intent

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_checkWeatherNavIntent()` | Check weather→Day view navigation | ❌ Not implemented |
| `_executeWeatherFlash()` | Flash chits at weather location | ❌ Not implemented |
| `_flashChitsAtLocation(location)` | Flash-highlight chits at location | ❌ Not implemented |

---

### Habit Rules Integration

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_globalGetHabitCycleEnd(chit)` | Calculate habit cycle end | ❌ Not implemented |
| `_globalCheckWeatherNotification(chit, alert, alertIdx)` | Check weather notification | ❌ Not implemented |

---

### Saved Searches

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_saveSearch()` | Save search to localStorage | ❌ Not implemented |
| `_loadSavedSearch(text)` | Load saved search | ❌ Not implemented |
| `_deleteSavedSearch(text)` | Delete saved search | ❌ Not implemented |
| `_renderSavedSearches()` | Render saved search chips | ❌ Not implemented |

---

### Search Snippets

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_getSearchSnippet(text, terms)` | Extract contextual snippet | ❌ Not implemented |
| `_getChitFieldValue(chit, fieldName)` | Extract displayable field value | ❌ Not implemented |

---

### Map Thumbnails in Editor

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_hasNonDefaultLocation(chit)` | Check if location differs from default | ❌ Not implemented |
| `_buildMapThumbnail(chit)` | Build static map thumbnail | ❌ Not implemented |
| `_renderMapTile(container, lat, lon)` | Render OSM tile with pin | ❌ Not implemented |
| `_buildMapIcon(chit)` | Build map pin icon for compact views | ❌ Not implemented |

---

### Work Hours View

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displayWorkView(chitsToDisplay)` | Render work hours view | ❌ Not implemented |

---

### Editor Location Features

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_fetchWeatherData(address)` | Full weather pipeline | ❌ Not implemented |
| `_displayWeatherInCompactSection(weatherData, address)` | Render weather section | ❌ Not implemented |
| `_displayMapInUI(lat, lon, address)` | Render OSM map embed | ❌ Not implemented |
| `loadSavedLocationsDropdown()` | Populate saved locations | ❌ Not implemented |
| `onSavedLocationSelect()` | Handle saved location select | ❌ Not implemented |
| `onAddDefaultLocation(event)` | Add default location | ❌ Not implemented |
| `searchLocationMap(event)` | Search location and show map | ❌ Not implemented |
| `_updateViewInContextBtn()` | Show/hide View in Context button | ❌ Not implemented |

---

### Notes Editor Features

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_notesListContinue(textarea)` | Auto-continue list items on Enter | ❌ Not implemented |
| `shrinkNoteToFourLines(event)` | Collapse notes to 4 lines | ❌ Not implemented |

---

### Tasks View Modes

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displayAssignedToMeView(chitsToDisplay)` | Render Assigned to Me view | ❌ Not implemented |
| `_setTasksMode(mode)` | Set Tasks view mode | ❌ Not implemented |
| `_tasksViewMode` | Current Tasks view mode | ❌ Not implemented |

---

### Calendar Misc

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `attachEmptySlotCreate(col, day, defaultDurationMin)` | Dblclick empty space to create chit | ❌ Not implemented |
| `_addAllDayHeightCap(eventsRow, container)` | Cap all-day area with Show More | ❌ Not implemented |

---

### Editor Date Features

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_snapMinutes` | Time picker snap interval | ❌ Not implemented |
| `_loadSnapSetting()` | Load snap interval from settings | ❌ Not implemented |
| `onPerpetualToggle()` | Handle Perpetual radio option | ❌ Not implemented |
| `_fmtPerpetualDate()` | Format perpetual date | ❌ Not implemented |
| `onHabitResetToggle()` | Handle Reset checkbox toggle | ❌ Not implemented |
| `_updateResetUnitOptions()` | Update reset unit dropdown | ❌ Not implemented |

---

### Editor Alerts Features

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_applyDefaultNotifications(mode)` | Auto-populate default notifications | ❌ Not implemented |

---

### Omni View Misc

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_updateOmniTimeUntilBadges(contentEl)` | Periodic badge updater | ❌ Not implemented |
| `_calculateHabitStreak(chit)` | Calculate habit streak | ❌ Not implemented |
| `_renderOmniHST(contentEl, chronoItems)` | HST bar renderer | ❌ Not implemented |
| `_placeOmniHSTWeather(iconsLayer)` | Place weather icons on HST | ❌ Not implemented |
| `_renderHSTWeatherIcons(iconsLayer, codes)` | Render weather icons at hours | ❌ Not implemented |

---

### Email Add-to-Bundle

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_showAddToBundleModal(chit)` | Show Add to Bundle modal for email | ❌ Not implemented |
| `_executeAddToBundle(chit, overlay)` | Execute Add to Bundle action | ❌ Not implemented |

---

### Weather Prefetch

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `prefetchSavedLocationWeather()` | Prefetch weather for saved locations | ❌ Not implemented |
| `_fetchWeatherForCache(address, cacheKey)` | Pre-fetch weather for cache | ❌ Not implemented |
| `_prefetchChitWeather(chitList)` | Pre-fetch weather for all chits | ❌ Not implemented |
| `_queueChitWeatherFetch(location, span)` | Queue weather fetch for indicator | ❌ Not implemented |
| `_processChitWxQueue()` | Process queued weather fetches | ❌ Not implemented |
| `_fetchAndApplyChitWeather(address, spans)` | Fetch weather for indicators | ❌ Not implemented |

---

### Settings Misc

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `updateGrid(preserveOrder)` | Rebuild clock format grid | ❌ Not implemented |
| `setupDragListeners()` | Wire drag listeners for clocks | ❌ Not implemented |
| `_toggleCombineAlerts()` | Toggle combined alert rows | ❌ Not implemented |
| `_loadMapSettings(settings)` | Populate map settings UI | ❌ Not implemented |
| `_collectMapSettings()` | Read map settings for save | ❌ Not implemented |
| `_openBadgeCustomModal(existing)` | Open custom detector modal | ❌ Not implemented |
| `_saveBadgeCustomDetector()` | Save custom detector | ❌ Not implemented |

---

### Custom Objects Zone Management

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_coOpenZoneModal(obj)` | Open zone management modal | ❌ Not implemented |
| `_coFetchZones()` | Fetch custom zones | ❌ Not implemented |
| `_coRenderZonesList()` | Render zones listing | ❌ Not implemented |
| `_coDeleteZone(zone)` | Delete zone | ❌ Not implemented |
| `_coOpenZoneEditor(zone)` | Open zone editor modal | ❌ Not implemented |

---

### Attachments Multi-Select

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `handleSelect(idx, e)` | Handle card selection | ❌ Not implemented (multi-select) |
| `bulkDelete()` | Bulk delete attachments | ❌ Not implemented |

---

### User Admin

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `openResetPasswordModal(userId, username)` | Open reset password modal | ❌ Not implemented |
| `submitResetPassword()` | Submit reset password | ❌ Not implemented |
| `changeProfilePassword()` | Change password | ❌ Not implemented |

---

### Misc Smaller Gaps

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `trackRecentTag(tagPath)` | Track recently used tag | ❌ Not implemented |
| `getRecentTags()` | Get recently used tags | ❌ Not implemented |
| `_selectOnlyTag(fullPath)` | Select only one tag (Shift+Click) | ❌ Not implemented |
| `cwocHighlightMatch(text, query)` | Highlight matching query substrings | ❌ Not implemented (Compose text styling) |
| `highlightMatch(text, query)` | Highlight query matches | ❌ Not implemented (Compose text) |
| `cwocHighlightTerms(text, terms)` | Wrap matching terms in mark tags | ❌ Not implemented (handled in Compose UI) |
| `_detectTimezoneFromCoords(lat, lon, country)` | Detect timezone from coordinates | ❌ Not implemented |
| `_getUserRsvpStatus(chit)` | Get current user's RSVP status | ❌ Not implemented |
| `_isDeclinedByCurrentUser(chit)` | Check if user declined chit | ❌ Not implemented |
| `_showProjectQuickMenu(e, project)` | Show context menu on Shift+click | ❌ Not implemented |
| `moveChildChitToProject(childChitId, targetProjectId)` | Move child to different project | ❌ Not implemented |
| `_checkPendingDeleteUndo()` | Check for pending delete-undo | ❌ Not implemented |
| `_weekViewDayOffset` | Week view paging offset | ❌ Not implemented |
| `_renderMobileOverview(container)` | Render mobile Overview panel | ❌ Not implemented |
| `_pasteClipboardAsChecklistItems(checklist)` | Paste clipboard as items | ❌ Not implemented |
| `_copyIncompleteToClipboard(checklist)` | Copy unchecked to clipboard | ❌ Not implemented |
| `closeImportModal()` | Close import result modal | ❌ Not implemented |
| `_describeCron(expr)` | Human-readable cron description | ❌ Not implemented |
| `_assembleCronExpression()` | Assemble cron from fields | ❌ Not implemented |
| `_validateCronExpression(expr)` | Validate cron expression | ❌ Not implemented |
| `_wxIsExtreme(highC, lowC, weatherCode)` | Check if weather is extreme | ❌ Not implemented |
| `_wxInitBlockClick(container)` | Wire day block click → Day view | ❌ Not implemented |
| `_wxInitDragDrop(container)` | Wire drag-and-drop row reorder | ❌ Not implemented |

---


## Priority 3: Implemented ✅

Functions that already have Android equivalents, grouped by functional area.

---

### Auth & Settings

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `getCurrentUser()` | Returns cached authenticated user object | `AuthRepository.currentUser` |
| `isAdmin()` | Returns true if cached user has admin privileges | `AuthRepository.currentUser.isAdmin` |
| `waitForAuth()` | Returns Promise resolving to user once auth check completes | `AuthRepository.authState` (StateFlow) |
| `getCachedSettings()` | Promise-based settings fetch with caching | `SettingsRepository.settings` (StateFlow) |
| `_invalidateSettingsCache()` | Clear settings cache to force fresh fetch | `SettingsRepository.refreshSettings()` |
| `_populateTimezoneDatalist()` | Populate timezone datalists | `TimezonePickerModal` |
| `renderLocationsSection(locations)` | Render saved location rows | Settings screen (locations section) |
| `addLocationRow()` | Add empty location row | Settings screen add location |
| `collectLocationsData()` | Read location rows for saving | `SettingsViewModel.gatherSettings()` |
| `loadColors()` | Load custom colors | Settings screen (colors section) |
| `openColorPicker()` | Open native color picker | Settings screen color picker |
| `saveColors(colors)` | Save custom colors | `SettingsViewModel.save()` |
| `addColor(newColor)` | Add new color | Settings screen add color |
| `deleteColor(hex, name)` | Delete color with confirmation | Settings screen delete color |
| `renderColors(colors)` | Render color swatches | Settings screen (colors) |
| `handleTagInput(event)` | Handle tag input keypress | `CollectionsSettingsTab` |
| `addTag()` | Quick-create new tag | `TagCreateDialog` |
| `openTagModal(tag)` | Open tag editor modal | `TagCreateDialog` |
| `saveTag()` | Save tag name/colors/favorite | `TagCreateDialog` save |
| `deleteTag()` | Delete tag | `TagCreateDialog` delete |
| `_renderSettingsTagTree()` | Render tag tree in settings | `CollectionsSettingsTab` (tag tree) |
| `_switchSettingsTab(tabId)` | Switch settings tabs | `SettingsScreen` tab navigation |
| `saveSettings()` | Save & Exit | `SettingsViewModel.saveAndExit()` |
| `saveSettingsAndStay()` | Save & Stay | `SettingsViewModel.saveAndStay()` |
| `cancelSettings()` | Cancel/exit with check | Android back navigation |
| `_initPillToggle(pillId, hiddenInputId)` | Initialize pill toggle | Compose toggle composable |
| `SettingsService.loadAll()` | Load all settings | `SettingsRepository.fetchSettings()` |
| `SettingsService.saveAll(settings)` | Save all settings | `SettingsRepository.saveSettings()` |
| `SettingsManager.initialize()` | Load and populate form | `SettingsViewModel.init` |
| `SettingsManager.gatherSettings()` | Gather form values | `SettingsViewModel.gatherSettings()` |
| `SettingsManager.save()` | Save to backend | `SettingsViewModel.save()` |
| `_openArrangeViewsModal()` | Open Arrange Views modal | `ArrangeViewsDialog` |
| `_closeArrangeViewsModal()` | Close Arrange Views modal | `ArrangeViewsDialog` dismiss |
| `_resetViewOrder()` | Reset view order to default | `ArrangeViewsDialog` reset |
| `_renderArrangeViewsGrid()` | Render draggable tab buttons | `ArrangeViewsDialog` (drag grid) |
| `_resetSortOrders()` | Reset all sort orders | `FilterSortViewModel.resetAll()` |
| `_initBadgesSettings()` | Initialize badges settings | `BadgesSettingsTab` |
| `_renderBadgeCategories()` | Render detector categories | `BadgesSettingsTab` composable |
| `_onBadgeCategoryToggle(e)` | Handle category toggle | `BadgesSettingsTab` (inline) |
| `_onBadgeDetectorToggle(e)` | Handle detector toggle | `BadgesSettingsTab` (inline) |
| `_renderBadgeCustomList()` | Render custom detectors | `BadgesSettingsTab` (custom list) |
| `_gatherBadgesConfig()` | Serialize badges config | `SettingsViewModel.gatherSettings()` |

---

### Chit CRUD & Editor

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `chitId` | Current chit ID | `ChitEditorViewModel.chitId` |
| `currentWeatherLat` | Weather latitude state | `ChitEditorViewModel` weather state |
| `currentWeatherLon` | Weather longitude state | `ChitEditorViewModel` weather state |
| `currentWeatherData` | Weather response data | `ChitEditorViewModel` weather state |
| `defaultColors` | Default color palette | `ColorZone` default colors |
| `_onChecklistChange()` | Mark unsaved on checklist change | `ChecklistZoneViewModel.onChange()` |
| `userTimezoneOffset` | User timezone offset | `DateUtils.getCurrentTimezone()` |
| `_convertDBDateToDisplayDate(dateString)` | Convert UTC to display date | `DateUtils.convertDBDateToDisplay()` |
| `_initializeChitId()` | Parse chit ID from URL | `ChitEditorViewModel` (nav argument) |
| `toggleZone(event, sectionId, contentId)` | Toggle zone expand/collapse | `CollapsibleZone` composable |
| `resetEditorForNewChit()` | Reset all fields for new chit | `ChitEditorViewModel.resetForNew()` |
| `loadChitData(chitId)` | Load chit and populate fields | `ChitEditorViewModel.loadChit()` |
| `applyZoneStates(chit)` | Expand zones with data | `EditorZoneState` |
| `createISODateTimeString(dateStr, timeStr, isAllDay, isEnd)` | Convert to ISO datetime | `ChitEditorViewModel.createISODateTime()` |
| `convertMonthFormat(dateStr)` | Convert YYYY-Mon-DD to YYYY-MM-DD | `DateUtils.convertMonthFormat()` |
| `buildChitObject()` | Collect all form values into chit | `ChitEditorViewModel.buildChitObject()` |
| `_showInstanceBanner(dateStr)` | Show instance editing banner | `RecurringEditDialog` |
| `_saveInstanceException(dateStr)` | Save as recurrence exception | `ChitEditorViewModel.saveException()` |
| `saveChitData()` | Main save — POST/PUT to API | `ChitEditorViewModel.save()` |
| `saveChit()` | Convenience wrapper | `ChitEditorViewModel.save()` |
| `saveChitAndStay()` | Save and stay on editor | `ChitEditorViewModel.saveAndStay()` |
| `deleteChit()` | Show delete confirmation | `ChitEditorViewModel.deleteChit()` |
| `performDeleteChit()` | Execute deletion with undo | `ChitEditorViewModel.performDelete()` |
| `setSaveButtonSaved()` | Mark as saved | `ChitEditorViewModel.markSaved()` |
| `cancelOrExit()` | Cancel/exit editor | Android back navigation |
| `markEditorUnsaved()` | Mark as unsaved | `ChitEditorViewModel.markUnsaved()` |
| `markEditorSaved()` | Mark as saved | `ChitEditorViewModel.markSaved()` |
| `togglePinned()` | Toggle pinned state | `ChitEditorViewModel.togglePinned()` |
| `toggleArchived()` | Toggle archived state | `ChitEditorViewModel.toggleArchived()` |
| `_showQRCode(e)` | Show QR code modal | `QrCodeDialog` |
| `cwocToggleZone(event, sectionId, contentId)` | Toggle zone open/closed | `CollapsibleZone` composable |
| `CwocEditorSaveSystem` | Editor save system wrapper | `ChitEditorViewModel` save logic |
| `CwocSaveSystem` | Save/cancel button system | Android back navigation + ViewModel save |
| `CwocSaveSystem.hasChanges()` | Returns true if unsaved changes | ViewModel `hasUnsavedChanges` |
| `CwocSaveSystem.markSaved()` | Mark as saved | ViewModel `markSaved()` |
| `CwocSaveSystem.markUnsaved()` | Mark as unsaved | ViewModel `markUnsaved()` |
| `CwocSaveSystem.cancelOrExit()` | Handle exit with confirmation | Android back + unsaved dialog |
| `_fetchCustomColors()` | Fetch custom colors from settings | `SettingsRepository.settings` (colors) |
| `_setColor(hex, name)` | Set chit color | `ColorZone` color selection |
| `_updateColorPreview()` | Sync color preview | `ColorZone` (state-driven) |
| `_renderCustomColors(customColors)` | Render custom color swatches | `ColorZone` composable |
| `_attachColorSwatchListeners()` | Attach click listeners to swatches | `ColorZone` (Compose clickable) |
| `initEmailZone(chit)` | Populate email zone fields | `EmailComposeZone` composable |
| `getEmailData()` | Collect email fields for save | `EmailComposeViewModel.getEmailData()` |
| `hasEmailData(chit)` | Check if chit has email data | `EmailComposeViewModel.hasEmailData()` |
| `_emailReply()` | Create reply draft | `EmailComposeViewModel.reply()` |
| `_emailForward()` | Create forward draft | `EmailComposeViewModel.forward()` |
| `_emailSend()` | Send draft with undo-send | `EmailComposeViewModel.send()` |
| `_emailSendLater()` | Schedule email for later | `SendLaterModal` |
| `_emailCancelScheduled()` | Cancel scheduled send | `EmailComposeViewModel.cancelScheduled()` |
| `_emailLoadExternalContent()` | Restore blocked images | `HtmlEmailRenderer` |
| `_emailUndoSendCountdown(chitId, archiveOriginal)` | Show undo-send countdown | `UndoToast` composable |
| `_emailDoActualSend(chitId, archiveOriginal)` | Actually send email | `EmailComposeViewModel.doSend()` |
| `_setEmailZoneReadOnly(readOnly)` | Toggle field editability | `EmailComposeZone` (read-only state) |
| `_fetchEmailThread(chitId)` | Fetch email thread | `EmailThreadViewInEditor` |
| `_renderEmailThread(thread, currentId)` | Render email thread | `EmailThreadViewInEditor` composable |
| `toggleEmailViewMode(event)` | Toggle email body edit/rendered | `EmailComposeZone` (mode toggle) |
| `_activateEmailZone()` | Activate email mode on non-email chit | `EmailComposeZone` activation |
| `_deactivateEmailZone()` | Deactivate email mode | `EmailComposeZone` deactivation |
| `_initSnoozeControls(chit)` | Initialize snooze controls | `SnoozePickerDialog` |
| `_renderSnoozeState(chit)` | Render current snooze state | `SnoozePickerDialog` state display |
| `_snoozeChit(duration)` | Snooze chit for duration | `SnoozePickerDialog` action |
| `_doUnsnooze()` | Remove snooze (wake up now) | `SnoozePickerDialog` unsnooze |
| `initSmartLinkRegistry(config)` | Initialize detector registry | `SmartLinkDetector.init()` |
| `detectSmartLinks(chit, options)` | Detect smart links in email chit | `SmartLinkDetector.detect()` |
| `detectSmartLinkFirst(chit)` | Legacy wrapper — first match | `SmartLinkDetector.detectFirst()` |
| Editor-tags zone functions | Tag management in editor | `TagsPickerSheet` composable |
| Editor-attachments functions | File attachment management | `AttachmentsZone` composable |
| Editor-email-pgp functions | Email PGP operations | `PgpManager` |

---

### Calendar

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `getCalendarDateInfo(chit)` | Normalize chit date info for calendar | `CalendarViewModel.getDateInfo()` |
| `chitMatchesDay(chit, day)` | Check if chit appears on a calendar day | `CalendarViewModel.chitMatchesDay()` |
| `calendarEventTitle(chit, isDueOnly, info, settings, context)` | Build title HTML for calendar event | `CalendarScreen` composable (inline) |
| `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` | Render all-day events with spanning | `CalendarTimeGrid` (all-day section) |
| `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` | Modal after dragging recurring instance | `RecurringEditDialog` |
| `getWeekStart(date)` | Get start of week for date | `CalendarViewModel.getWeekStart()` |
| `getMonthStart(date)` | Get first day of month | `CalendarViewModel.getMonthStart()` |
| `getYearStart(date)` | Get January 1st of year | `CalendarViewModel.getYearStart()` |
| `formatDate(date)` | Format date as "DD Day" for headers | `DateUtils.formatCalendarHeader()` |
| `formatWeekRange(start, end)` | Format week range as "Mon DD — Mon DD" | `CalendarViewModel.formatWeekRange()` |
| `chitColor(chit)` | Return display color for chit | `CwocChitCardStyle` |
| `changePeriod()` | Handle period dropdown change | `CalendarViewModel.changePeriod()` |
| `goToToday()` | Navigate calendar to today | `CalendarViewModel.goToToday()` |
| `previousPeriod()` | Navigate to previous period | `CalendarViewModel.previousPeriod()` |
| `nextPeriod()` | Navigate to next period | `CalendarViewModel.nextPeriod()` |
| `updateDateRange()` | Update date range display | `CalendarViewModel` (state-driven) |
| `openChitForEdit(chit)` | Open chit in editor | Android navigation to Editor screen |
| `attachCalendarChitEvents(el, chit)` | Attach dblclick/shift+click to event | Compose `clickable` + `combinedClickable` |
| `displayWeekView(chitsToDisplay, opts)` | Render week calendar view | `CalendarTimeGrid` composable |
| `displayMonthView(chitsToDisplay)` | Render month calendar grid | `CalendarMonthView` composable |
| `displayItineraryView(chitsToDisplay)` | Render itinerary/agenda view | `CalendarItineraryView` composable |
| `displayDayView(chitsToDisplay, opts)` | Render single-day view | `CalendarTimeGrid` (day mode) |
| `displayYearView(chitsToDisplay)` | Render year overview heat-map | `CalendarYearView` composable |
| `scrollToSixAM()` | Scroll to configured scroll-to hour | `CalendarTimeGrid` (auto-scroll) |
| `renderTimeBar(viewType)` | Render current-time bar | `CalendarTimeGrid` (time indicator) |
| `displaySevenDayView(chitsToDisplay, opts)` | Render X-day view | `CalendarXDayView` composable |
| `_getResponsiveDayCount()` | Return days to show in week view | `CalendarViewModel` (always 7) |
| `changeView()` | Handle period dropdown change | `CalendarViewModel.changePeriod()` |
| `toggleAllDay()` | Toggle all-day mode | `DateZone` (all-day toggle) |
| `currentWeekStart` | Start of current calendar period | `CalendarViewModel.currentWeekStart` |
| `currentView` | Active calendar view name | `CalendarViewModel.currentView` |
| `_applyEnabledPeriods()` | Hide disabled period options | `CalendarViewModel.enabledPeriods` |

---

### Tasks / Checklists / Notes / Projects

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displayTasksView(chitsToDisplay)` | Render Tasks tab | Tasks screen composable |
| `displayChecklistView(chitsToDisplay)` | Render Checklists tab | Checklists screen composable |
| `displayNotesView(chitsToDisplay)` | Render Notes tab with masonry layout | Notes screen composable |
| `displayNotebookView(chitsToDisplay)` | Render Notebook tab (Notes + Checklists) | Notebook screen composable |
| `_setProjectsMode(mode)` | Set Projects view mode (list/kanban) | `ProjectsViewModel.setMode()` |
| `_projectQuickCreateChild(project)` | Create new child chit for project | `ProjectsViewModel.createChild()` |
| `displayProjectsView(chitsToDisplay)` | Render Projects tab — list view | `ProjectsScreen` composable |
| `_kanbanState` | Kanban board state | `ProjectsViewModel.kanbanState` |
| `displayKanbanView(chitsToDisplay)` | Render Kanban board view | `KanbanColumn` composable |
| `renderChecklistItemMarkdown(span, text)` | Render markdown inline for checklist item | `MarkdownRenderer` in checklist zone |
| `toggleChecklistItem(chitId, itemIndex, newChecked)` | Toggle checklist item checked state | `ChecklistOperationsV2.toggleItem()` |
| `moveChecklistItem(chitId, fromIndex, toIndex)` | Move checklist item within chit | `ChecklistOperationsV2.moveItem()` |
| `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | Move item between chits | `ChecklistOperationsV2.moveItemCrossChit()` |
| `renderInlineChecklist(container, chit, onUpdate)` | Render interactive checklist | `ChecklistZoneV2` composable |
| `_updateChecklistProgressCount(container, chit)` | Update progress count element | `ChecklistZoneV2` (inline in composable) |
| `MAX_INDENT_LEVEL` | Maximum nesting depth (4) | `ChecklistOperationsV2.MAX_INDENT` |
| `Checklist.constructor(container, initialItems, onChangeCallback)` | Initialize checklist | `ChecklistZoneV2` composable |
| `Checklist.loadItems(itemsArray)` | Load items from array | `ChecklistZoneViewModel.loadItems()` |
| `Checklist.getChecklistData()` | Return deep copy for serialization | `ChecklistZoneViewModel.getData()` |
| `Checklist.addNewItem(text, level, checked, id)` | Add new item | `ChecklistOperationsV2.addItem()` |
| `Checklist.render()` | Re-render all items | `ChecklistZoneV2` recomposition |
| `Checklist.startEditing(item, textSpan, clickEvent)` | Start inline editing | `ChecklistZoneV2` (inline edit) |
| `Checklist.toggleCheck(item, checked)` | Toggle checked state | `ChecklistOperationsV2.toggleItem()` |
| `Checklist.deleteItem(item, element)` | Delete item with undo | `ChecklistOperationsV2.deleteItem()` |
| `Checklist.getSubtree(item)` | Get item and descendants | `ChecklistOperationsV2.getSubtree()` |
| `Checklist.clearCheckedItems()` | Delete all checked items | `ChecklistOperationsV2.clearChecked()` |
| `Checklist._showUndoCountdown(removedItems, label)` | Show inline undo bar | `UndoToast` composable |
| `initializeProjectZone(projectChitId)` | Initialize projects zone | `ProjectsViewModel.initialize()` |
| `renderChildChitsByStatus()` | Render child chits by status | `KanbanColumn` composable |
| `updateChitStatus(chitId, newStatus)` | Update child chit status | `ProjectsViewModel.updateStatus()` |
| `createChildChitCard(chit)` | Create child chit card | `KanbanColumn` card composable |
| `fetchProjectMasters()` | Fetch all project masters | `ProjectsViewModel.fetchMasters()` |
| `saveProjectChanges()` | Save child chit changes | `ProjectsViewModel.save()` |
| `openAddChitModal()` | Open modal to add child | `ChitPickerSheet` |
| `addChildChit(chit)` | Add chit as child | `ProjectsViewModel.addChild()` |
| `createNewChildChit(event)` | Create new child chit | `ProjectsViewModel.createChild()` |
| `toggleProjectMaster()` | Toggle project master status | `ProjectsViewModel.toggleMaster()` |
| `loadProjectData(projectChitId)` | Fetch project and children | `ProjectsViewModel.loadProject()` |
| `autoGrowNote(el)` | Auto-grow textarea to fit content | Android framework (auto-size) |
| `toggleNotesViewMode(event)` | Toggle edit/rendered views | `MarkdownRenderer` toggle |
| `copyNotesToClipboard(event, source)` | Copy notes to clipboard | Android clipboard API |
| `downloadNotes(event, source)` | Download notes as .md file | Android share intent |

---

### Alerts & Notifications

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_setAlarmsMode(mode)` | Set Alarms view mode (list/independent) | Alerts screen mode toggle |
| `_fetchIndependentAlerts()` | Fetch independent alerts from API | `StandaloneAlertRepository.fetchAll()` |
| `_createIndependentAlert(alertData)` | Create new independent alert | `StandaloneAlertRepository.create()` |
| `_updateIndependentAlert(id, alertData)` | Update independent alert | `StandaloneAlertRepository.update()` |
| `_deleteIndependentAlert(id)` | Delete independent alert | `StandaloneAlertRepository.delete()` |
| `displayAlarmsView(chitsToDisplay)` | Render Alarms tab | Alerts screen composable |
| `_displayIndependentAlertsBoard()` | Render independent alerts board | Alerts screen (independent mode) |
| `_addIndependentAlert(type)` | Create alert with defaults | Alerts screen create action |
| `_buildIndependentCard(id, type, data)` | Build alert card element | Alerts screen card composable |
| `_parseTimeInput(str)` | Parse time input to 24h format | `DateUtils.parseTimeInput()` |
| `_buildSaAlarmCard(card, id, data)` | Build alarm card UI | Alerts screen alarm card |
| `_saFmtTimer(s, tenths)` | Format seconds as HH:MM:SS | `TimerRuntime.format()` |
| `_buildSaTimerCard(card, id, data)` | Build timer card UI | Alerts screen timer card |
| `_saSwFmt(ms)` | Format ms as HH:MM:SS.cc | `StopwatchRuntime.format()` |
| `_buildSaStopwatchCard(card, id, data)` | Build stopwatch card UI | Alerts screen stopwatch card |
| `_renderSaLaps(container, laps)` | Render lap times list | Alerts screen laps display |
| `_alarmsViewMode` | Current Alarms view mode | Alerts screen state |
| `_loadAlertStates()` | Load dismiss/snooze states from API | `NotificationScheduler` state loading |
| `_persistDismiss(alertKey)` | Persist alert dismiss | `NotificationScheduler.dismiss()` |
| `_persistSnooze(snoozeKey, untilTs)` | Persist alert snooze | `NotificationScheduler.snooze()` |
| `_globalFmtTime(time24)` | Format time respecting setting | `DateUtils.formatTime()` |
| `_globalPlayAlarm()` | Play alarm sound | `AlarmSoundPlayer.playAlarm()` |
| `_globalStopAlarm()` | Stop alarm sound | `AlarmSoundPlayer.stopAlarm()` |
| `_globalPlayTimer()` | Play timer sound | `AlarmSoundPlayer.playTimer()` |
| `_globalStopTimer()` | Stop timer sound | `AlarmSoundPlayer.stopTimer()` |
| `_globalDayAbbr(date)` | Get 3-letter day abbreviation | `DateUtils` |
| `_showGlobalToast(emoji, label, chitTitle, chitId, onDismiss)` | Show persistent toast | Android notification |
| `_showAlertModal(opts)` | Show full-screen alert modal | Android full-screen notification |
| `_dismissAlertModal(overlay, onDismiss)` | Dismiss alert modal | Android notification dismiss |
| `_showTimerDoneModal(timerName, onDismiss)` | Show "Time's up!" modal | `TimerNotificationHelper` |
| `_sendBrowserNotification(title, body, chitId, playSound)` | Send browser notification | Android notification (`NotificationScheduler`) |
| `_globalCheckAlarms()` | Check all alarms against current time | `AlarmReceiver` (exact alarms) |
| `_globalCheckNotifications()` | Check notification alerts | `NotificationScheduler` |
| `_getSnoozeMs()` | Get snooze duration from settings | `NotificationScheduler.getSnoozeDuration()` |
| `_startGlobalAlertSystem()` | Initialize global alert system | `NotificationScheduler.scheduleAll()` |
| `window._alertsData` | Alerts state (alarms, timers, stopwatches, notifications) | `AlertsZone` state |
| `_stopwatchIntervals` | Stopwatch interval IDs | `StopwatchRuntime` |
| `_loadEditorTimeFormat()` | Load time format setting | `DateUtils.getTimeFormat()` |
| `_fmtAlarmTime(time24)` | Format alarm time | `DateUtils.formatTime()` |
| `_playAlarmSound()` | Play alarm sound | `AlarmSoundPlayer.playAlarm()` |
| `_stopAlarmSound()` | Stop alarm sound | `AlarmSoundPlayer.stopAlarm()` |
| `_playTimerSound()` | Play timer sound | `AlarmSoundPlayer.playTimer()` |
| `_startAlarmChecker()` | Start alarm checker interval | `NotificationScheduler` |
| `_stopAlarmChecker()` | Stop alarm checker | `NotificationScheduler` |
| `_checkAlarms()` | Check alarms against current time | `AlarmReceiver` |
| `_showAlarmAlert(alarm, onDismiss)` | Show alarm alert overlay | Android notification |
| `_startNotificationChecker()` | Start notification checker | `NotificationScheduler` |
| `_stopNotificationChecker()` | Stop notification checker | `NotificationScheduler` |
| `_checkNotificationAlerts()` | Check notifications against dates | `NotificationScheduler` |
| `_alertsFromChit(chit)` | Parse chit alerts into structure | `AlertsZone` (state parsing) |
| `_alertsToArray()` | Flatten alerts for saving | `ChitEditorViewModel.buildAlerts()` |
| `renderAllAlerts()` | Render all alert containers | `AlertsZone` composable |
| `renderAlarmsContainer()` | Render alarms list | `AlertsZone` (alarms section) |
| `renderNotificationsContainer()` | Render notifications list | `AlertsZone` (notifications section) |
| `openAlarmModal(event)` | Add new alarm inline | `AlertsZone` add alarm |
| `editAlarmItem(idx)` | Open alarm edit modal | `AlertsZone` edit alarm |
| `addAlarm()` | Save alarm data | `AlertsZone` save |
| `toggleAlarmEnabled(idx)` | Toggle alarm enabled state | `AlertsZone` toggle |
| `deleteAlarmItem(idx)` | Delete alarm | `AlertsZone` delete |
| `openTimerModal(event)` | Add new timer | `AlertsZone` add timer |
| `editTimerItem(idx)` | Open timer edit modal | `AlertsZone` edit timer |
| `addTimer()` | Save timer data | `AlertsZone` save |
| `addStopwatch(event)` | Add new stopwatch | `AlertsZone` add stopwatch |
| `deleteStopwatchItem(idx)` | Delete stopwatch | `AlertsZone` delete |
| `_swFmt(ms)` | Format ms as stopwatch display | `StopwatchRuntime.format()` |
| `renderStopwatchesContainer()` | Render stopwatches list | `AlertsZone` (stopwatches section) |
| `renderTimersContainer()` | Render timers list | `AlertsZone` (timers section) |
| `deleteTimerItem(idx)` | Delete timer | `AlertsZone` delete |
| `openNotificationModal(event)` | Add new notification | `AlertsZone` add notification |
| `addNotification()` | Save notification data | `AlertsZone` save |
| `deleteNotificationItem(idx)` | Delete notification | `AlertsZone` delete |
| `_sharedFmtTime(time24)` | Format 24h time respecting user setting | `DateUtils.formatTime()` |
| `_sharedPlayAlarm()` | Play alarm sound (looping) | `AlarmSoundPlayer.playAlarm()` |
| `_sharedStopAlarm()` | Stop alarm sound | `AlarmSoundPlayer.stopAlarm()` |
| `_sharedPlayTimer()` | Play timer sound (looping) | `AlarmSoundPlayer.playTimer()` |
| `_sharedStopTimer()` | Stop timer sound | `AlarmSoundPlayer.stopTimer()` |
| `_sharedGetSnoozeMs()` | Get snooze duration from settings | `NotificationScheduler.getSnoozeDuration()` |
| `_sharedPersistDismiss(key)` | Persist alert dismiss state | `StandaloneAlertRepository.dismiss()` |
| `_sharedPersistSnooze(key, untilTs)` | Persist alert snooze state | `StandaloneAlertRepository.snooze()` |
| `_sharedLoadAlertStates()` | Load persisted dismiss/snooze states | `StandaloneAlertRepository.loadStates()` |
| `_sharedFetchData()` | Fetch chits and alerts for alarm system | `NotificationScheduler` data fetch |
| `_sharedShowAlertModal(opts)` | Show full-screen alert modal | Android notification (full-screen intent) |
| `_sharedDismissModal(overlay, opts)` | Dismiss alert modal | Android notification dismiss |
| `_sharedBrowserNotif(title, body, chitId)` | Show browser notification | Android notification (`NotificationScheduler`) |
| `_sharedCheckAlarms()` | Alarm checker — runs every second | `AlarmReceiver` + `NotificationScheduler` |
| `_initSharedAlarmSync()` | Register sync handlers for alarms | `NotificationScheduler` sync integration |
| `_initSharedAlarmSystem()` | Initialize global alarm system | `NotificationScheduler.scheduleAll()` |

---

### Email

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_emailSubFilter` | Email sub-filter state | `EmailViewModel.subFilter` |
| `_emailUnreadTop` | Sort unread to top toggle | `EmailViewModel.unreadTop` |
| `_emailDashContactsCache` | Cached contacts for sender lookup | `EmailViewModel.contactsCache` |
| `_emailLoadDashContacts()` | Load contacts for sender images | `EmailViewModel.loadContacts()` |
| `_emailGetContactImage(senderRaw)` | Look up contact image by email | `EmailViewModel.getContactImage()` |
| `displayEmailView(chitsToDisplay)` | Display email list view | `EmailScreen` composable |
| `_buildEmailCard(chit, viSettings)` | Build email card element | `EmailCardEnhanced` composable |
| `_setEmailSubFilter(filter)` | Set email sub-filter | `EmailViewModel.setSubFilter()` |
| `_checkMail()` | Trigger manual email sync | `EmailViewModel.checkMail()` |
| `_composeEmail()` | Navigate to editor for new email | `EmailComposeViewModel` |
| `_getUnreadCount()` | Return unread inbox count | `EmailBadgeViewModel.unreadCount` |
| `_updateEmailBadge()` | Update unread badge | `EmailBadgeViewModel` |
| `_emailEmptyState(container)` | Show empty state for email | `EmailScreen` empty state |
| `_emailGetFileIcon(mimeType)` | Get file type emoji for attachment | `AttachmentBar` (inline) |
| `_emailShowErrorWithSettingsLink(errorMsg, hint)` | Show error with Settings link | `EmailScreen` error handling |
| `_showAccountErrorDetails(nickname, errorMsg)` | Show account error details | `EmailScreen` error handling |
| `_toggleEmailReadStatus(chit, card)` | Toggle read/unread status | `EmailViewModel.toggleRead()` |
| `_toggleEmailUnreadTop()` | Toggle unread-at-top sorting | `EmailViewModel.toggleUnreadTop()` |
| `_emailBulkToggleRead()` | Bulk toggle read/unread | `EmailViewModel.bulkToggleRead()` |
| `_emailRepliedToCache` | Cache of replied message IDs | `EmailViewModel` (inline) |
| `_emailBuildRepliedCache()` | Build replied-to cache | `EmailViewModel` (inline) |
| `_emailHasReply(messageId)` | Check if message has reply | `EmailViewModel` (inline) |
| `_emailDetectTracking(chit)` | Detect tracking/flight numbers | `SmartLinkDetector.detect()` |
| `_emailQuickArchive(chit, card)` | Quick-archive email with undo | `EmailViewModel.archive()` + `UndoToast` |
| `_emailQuickDelete(chit, card)` | Quick-delete email with undo | `EmailViewModel.delete()` + `UndoToast` |
| `_emailRestoreCard(card)` | Restore hidden email card | `UndoToast` undo action |
| `_emailStripHtml(str)` | Strip HTML for plain-text display | `BodyPreviewStripper.stripHtml()` |
| `_emailStripMarkdown(str)` | Strip markdown formatting | `BodyPreviewStripper.stripMarkdown()` |
| `_emailActiveBundle` | Currently active bundle name | `BundleViewModel.activeBundle` |
| `_emailBundlesData` | Cached bundles array | `BundleViewModel.bundles` |
| `_fetchBundles(callback)` | Fetch bundles from API | `BundleRepository.fetchBundles()` |
| `_filterByBundle(chits, activeBundle)` | Filter emails by active bundle | `BundleViewModel.filterByBundle()` |
| `_getBundleUnreadCount(bundleName, emailChits)` | Compute unread count for bundle | `BundleViewModel.getUnreadCount()` |
| `_renderBundleToolbar(emailChits)` | Build bundle toolbar | `BundleToolbar` composable |
| `_renderBundleTabs(container, bundles, emailChits)` | Render bundle tabs with badges | `BundleToolbar` composable |
| `_setActiveBundle(bundleName)` | Set active bundle | `BundleViewModel.setActive()` |
| `_persistActiveBundle()` | Save active bundle to localStorage | `BundleViewModel` (persisted) |
| `_updateBundleTabActiveStates()` | Update tab active states | `BundleToolbar` (state-driven) |
| `_bundleOnSubFilterChange(newFilter)` | Reset bundles on sub-filter change | `BundleViewModel.onSubFilterChange()` |
| `_emailBundleSelectAll(checked)` | Select/deselect all emails | `BulkActionsBar` |
| `_bundleUpdateActionStates()` | Enable/disable bulk actions | `BulkActionsBar` (state-driven) |
| `_openBundleModal(editBundle)` | Open bundle create/edit modal | `BundleModals` composable |
| `_bundleModalEscHandler(e)` | ESC handler for bundle modal | Android back button |
| `_closeBundleModal()` | Close bundle modal | `BundleModals` dismiss |
| `_bundleModalSubmit()` | Validate and submit bundle | `BundleViewModel.createOrUpdate()` |
| `_bundleModalCreate(name, description)` | POST to create bundle | `BundleRepository.create()` |
| `_bundleModalUpdate(name, description)` | PUT to update bundle | `BundleRepository.update()` |
| `_showBundleModalHint(msg)` | Show validation hint | `BundleModals` (inline) |
| `_showBundleContextMenu(bundle, x, y)` | Show context menu on bundle tab | `BundleContextMenu` composable |
| `_closeBundleContextMenu()` | Close context menu | `BundleContextMenu` dismiss |
| `_bundleContextMenuOutsideClick(e)` | Outside-click handler | Android back/outside tap |
| `_bundleContextMenuEscHandler(e)` | ESC handler | Android back button |
| `_attachBundleTabContextMenu(tab, bundle)` | Attach right-click/long-press | `BundleToolbar` long-press |
| `_deleteBundleConfirm(bundle)` | Show delete confirmation | `BundleViewModel.delete()` + confirm |
| `_showToast(msg, type)` | Toast helper | Snackbar |

---

### Contacts

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_loadUsers()` | Fetch active users | `ContactListViewModel.loadUsers()` |
| `loadContacts(query)` | Fetch contacts | `ContactRepository.getAllContacts()` |
| `_onSearchInput()` | Search input handler | `ContactListViewModel.setSearchQuery()` |
| `_applyFilter()` | Client-side filter | `ContactListViewModel.filterContacts()` |
| `_renderList()` | Render contact list | `ContactListScreen` composable |
| `_createUserRow(user, query)` | Create user row element | `ContactListScreen` (user section) |
| `_createRow(contact, query)` | Create contact row element | `ContactListScreen` (contact card) |
| `_toggleFavorite(contact, starEl)` | Toggle favorite | `ContactListViewModel.toggleFavorite()` |
| `_shareContact(contact)` | Share via QR code | `QrCodeDialog` |
| `_renderContactTags()` | Render contact tag chips | `ContactEditorScreen` (tags section) |
| `_initContactTags()` | Initialize contact tags input | `ContactEditorScreen` (tags) |
| `_loadContact(id)` | Load contact from API | `ContactEditorViewModel.loadContact()` |
| `_stageImage(file)` | Stage image locally | `ContactEditorViewModel.stageImage()` |
| `_uploadPendingImage()` | Upload image to API | `ContactEditorViewModel.uploadImage()` |
| `triggerImageUpload()` | Trigger file input | Android image picker intent |
| `_initColorPicker()` | Build color swatches | `ContactEditorScreen` (color section) |
| `_selectColor(hex, fromInput)` | Select color | `ContactEditorViewModel.setColor()` |
| `addMultiValueEntry(fieldName, defaultLabel, defaultValue)` | Add multi-value row | `MultiValueSection` composable |
| `_getMultiValueEntries(fieldName)` | Read multi-value rows | `ContactEditorViewModel.getEntries()` |
| `toggleFavorite()` | Toggle favorite | `ContactEditorViewModel.toggleFavorite()` |
| `collectContactData()` | Gather form into contact object | `ContactEditorViewModel.buildContact()` |
| `populateContactForm(contact)` | Populate form from contact | `ContactEditorViewModel.loadContact()` |
| `_saveContact()` | Save via POST/PUT | `ContactEditorViewModel.save()` |
| `saveContactAndStay()` | Save without navigating | `ContactEditorViewModel.saveAndStay()` |
| `saveContactAndExit()` | Save then navigate | `ContactEditorViewModel.saveAndExit()` |
| `deleteContact()` | Delete with confirmation | `ContactEditorViewModel.delete()` |
| `shareContact()` | Share via QR | `QrCodeDialog` |
| `generateContactVCard(contact)` | Build vCard 3.0 string | `QrCodeDialog` (vCard generation) |
| `showContactQrCode(contact)` | Show QR code for contact | `QrCodeDialog` |
| `cwocContactMatchesFilter(contact, query)` | Check if contact matches search query | `ContactListViewModel.filterContacts()` |

---

### Search & Filter & Sort

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displaySearchView()` | Render global search view | Search screen composable |
| `_renderSearchResults(container, viSettings)` | Render search result cards | Search screen results |
| `cwocMatchesSearch(chit, searchText)` | Check if chit matches plain-text search | `BooleanSearchEvaluator.evaluate()` |
| `cwocExtractSearchTerms(query)` | Extract positive search terms for highlighting | `BooleanSearchParser.extractTerms()` |
| `CwocSidebarFilter(config)` | Creates filter panel with search/hotkeys | `FilterPanel` composable |
| `cwocLoadTagFilter(config)` | Shared tag filter loader | `FilterPanel` (tag section) |
| `cwocChitPassesTagFilter(chitTags)` | Check if chit passes tag filter | `FilterEngine.applyFilters()` |
| `cwocClearTagFilter()` | Reset tag filter to default | `FilterSortViewModel.clearTagFilter()` |
| `_cwocUpdateTagVirtualOptions()` | Update Any Tag / Tagless button states | `FilterPanel` composable (inline) |
| `_cwocRenderTagList(container, tagObjects, onChange)` | Render tag filter list | `FilterPanel` composable (inline) |
| `_initDashboardSidebar()` | Register dashboard Page_Context callbacks | `SidebarContent` composable |
| `onSortSelectChange()` | Handle sort dropdown change | `SortPanel` composable |
| `toggleSortDir()` | Toggle sort direction | `SortPanel` composable |
| `_updateSortUI()` | Update sort direction button | `SortPanel` (state-driven) |
| `onFilterChange()` | Re-render after filter change | `FilterSortViewModel` → recomposition |
| `onFilterAnyToggle(anyCb)` | When Any checked, uncheck specifics | `FilterPanel` composable |
| `onFilterSpecificToggle(filterType)` | When specific checked, uncheck Any | `FilterPanel` composable |
| `clearFilterGroup(containerId)` | Clear all checkboxes in group | `FilterPanel.clearGroup()` |
| `_filterTagCheckboxes()` | Filter visible tags by search | `FilterPanel` (tag search) |
| `_clearAllFilters()` | Reset sidebar filters to defaults | `FilterSortViewModel.clearAll()` |
| `_applySystemDefaults()` | Apply hardcoded system defaults | `FilterSortViewModel.applyDefaults()` |
| `_applyFilterStateToSidebar(state)` | Apply saved filter state to UI | `FilterSortViewModel.applyState()` |
| `_applyCustomViewFilters(tab)` | Apply custom view filters on entry | `FilterSortViewModel.applyCustomView()` |
| `_resetDefaultFilters()` | Reset to custom/legacy defaults | `FilterSortViewModel.resetDefaults()` |
| `_updateClearFiltersButton()` | Show/hide defaults button | `FilterPanel` (state-driven) |
| `_getSelectedFilterValues(containerId, filterType)` | Get checked filter values | `FilterSortViewModel.filterState` |
| `_getSelectedStatuses()` | Get selected status values | `FilterSortViewModel.filterState.statuses` |
| `_getSelectedLabels()` | Get selected tag values | `FilterSortViewModel.filterState.tags` |
| `_getSelectedPriorities()` | Get selected priority values | `FilterSortViewModel.filterState.priorities` |
| `_buildTagFilterPanel()` | Build tag filter with colored badges | `FilterPanel` (tag section) |
| `_buildPeopleFilterPanel()` | Fetch contacts and render people filter | `FilterPanel` (people section) |
| `_renderPeopleFilterPanel(contacts)` | Render people filter chips | `FilterPanel` (people chips) |
| `_renderPeopleChipFilter(containerId, contacts, users, selection)` | Render chip-based people filter | `FilterPanel` (people chips) |
| `_isPeopleColorLight(hex)` | Check if people chip color is light | `ColorUtils.isLightColor()` |
| `clearPeopleFilter()` | Clear people filter selection | `FilterSortViewModel.clearPeopleFilter()` |
| `_updateTagVirtualOptions()` | Update Any Tag / Tagless states | `FilterPanel` (inline) |
| `_onTagToggled()` | Handle tag toggle | `FilterPanel` (inline) |
| `_loadLabelFilters()` | Load tag filter settings | `FilterSortViewModel` init |
| `filterChits(tab)` | Switch tab, update hash, re-render | `CCaptnTabRow` + `FilterSortViewModel` |
| `searchChits()` | Trigger re-render from search | `FilterSortViewModel.setSearchText()` |
| `_applyArchiveFilter(chitList)` | Filter by pinned/archived toggle | `FilterEngine.applyFilters()` |
| `_applyMultiSelectFilters(chitList)` | Apply multi-select filters | `FilterEngine.applyFilters()` |
| `_applySort(chitList)` | Sort by current field/direction | `SortEngine.sort()` |
| `_loadSortPreferencesFromServer()` | Load sort prefs from backend | `FilterSortViewModel` init |
| `_loadSortOrdersFromServer()` | Load sort orders from backend | `FilterSortViewModel` init |
| `getSortPreference(tab)` | Get saved sort preference for tab | `FilterSortViewModel.getSortState()` |
| `saveSortPreference(tab, field, dir)` | Save sort preference for tab | `FilterSortViewModel.setSortState()` |
| `resetAllSortOrders()` | Reset all sort orders and preferences | `FilterSortViewModel.resetAll()` |
| `getManualOrder(tab)` | Get saved manual sort order for tab | `FilterSortViewModel.getManualOrder()` |
| `saveManualOrder(tab, ids)` | Save manual sort order for tab | `FilterSortViewModel.saveManualOrder()` |
| `applyManualOrder(tab, chitList)` | Sort chit list by saved manual order | `SortEngine.sort()` with MANUAL field |
| `enableDragToReorder(container, tab, onReorder, longPressMap)` | Enable drag-to-reorder on cards | `ReorderableList` composable |
| `currentSortField` | Active sort field | `FilterSortViewModel.sortState.field` |
| `currentSortDir` | Sort direction | `FilterSortViewModel.sortState.direction` |

---

### UI Components (Modals, Toasts, Pickers)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `cwocToast(message, type, duration)` | Show auto-dismissing notification toast | `UndoToast` composable / Snackbar |
| `cwocUndoToast(message, opts)` | Show undo toast with countdown | `UndoToast` composable |
| `cwocConfirm(message, opts)` | Show confirm modal, returns Promise<boolean> | Android AlertDialog / `CwocPromptDialog` |
| `cwocPromptModal(title, placeholder, onConfirm, opts)` | Show input modal | `CwocPromptDialog` |
| `cwocUnsavedModal(opts)` | Show Save/Discard/Cancel modal | Android AlertDialog in `ChitEditorViewModel` |
| `cwocChitPickerModal(options)` | Shared chit picker modal with search/filters | `ChitPickerSheet` |
| `showQRModal(opts)` | Show QR code in full-screen modal | `QrCodeDialog` |
| `cwocTimePicker.open(inputEl, options)` | Open drum roller time picker | `DrumRollerTimePicker` |
| `cwocToggleCalculator()` | Open/close calculator popover | `CalculatorSheet` |
| `cwocIsCalculatorOpen()` | Returns true if calculator visible | `CalculatorSheet` state |
| `cwocCloseCalculator()` | Close calculator | `CalculatorSheet` dismiss |
| `_calcTokenize(expr)` | Tokenize arithmetic expression | `CalculatorSheet` (inline logic) |
| `_calcParse(tokens)` | Recursive-descent parser | `CalculatorSheet` (inline logic) |
| `_calcEvaluate(expr)` | Evaluate arithmetic expression | `CalculatorSheet` (inline logic) |
| `_calcFormatResult(num)` | Format numeric result | `CalculatorSheet` (inline logic) |
| `_calcOnButton(value)` | Handle calculator button press | `CalculatorSheet` (inline logic) |
| `_calcUpdateDisplay()` | Update calculator display | `CalculatorSheet` (state-driven) |
| `_calcInsertResult()` | Write result into source field | `CalculatorSheet` insert action |
| `showQuickEditModal(chit, onRefresh)` | Quick-edit modal for calendar chits | `QuickEditSheet` |
| `_showSnoozeSubMenu(actionRow, snzBtn, chitId, closeModal, onRefresh)` | Inline snooze presets | `SnoozePickerDialog` |
| `_showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, closeModal, onRefresh)` | Delete sub-menu with options | `RecurringEditDialog` / `ChitActionMenu` |
| `showRecurrenceActionModal(chit, onRefresh)` | Backward-compat alias for quickEdit | `QuickEditSheet` |
| `_showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo, customMessage)` | Show delete-undo toast | `UndoToast` composable |
| `_openClockModal()` | Open clock modal | `ClockModal` composable |
| `_renderClocks(container, activeClocks, isVertical)` | Render clock displays | `ClockModal` composable |
| `_renderHSTClock(dayFraction, hstVal)` | Render HST progress bar clock | `ClockModal` (HST section) |
| `_renderAnalogClock(h24, min, sec)` | Render SVG analog clock | `ClockModal` (analog section) |
| `_closeClockModal()` | Close clock modal | `ClockModal` dismiss |
| `cwocTagModal.inject()` | Inject modal HTML into page | N/A (Compose — `TagCreateDialog`) |
| `cwocTagModal.open(tagName, opts)` | Open tag editor/creator modal | `TagCreateDialog` |
| `cwocTagModal.close()` | Close the modal | `TagCreateDialog` dismiss |
| `cwocTagModal.isOpen()` | Returns true if modal is displayed | `TagCreateDialog` state |

---

### Navigation & Sidebar

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_cwocSidebarContext` | Module-level stored Page_Context | `SidebarStateViewModel` |
| `_notifInboxItems` | Cached notification list | `NotificationBadgeViewModel.notifications` |
| `_cwocInjectSidebar()` | Build and inject sidebar HTML | `SidebarContent` composable |
| `_cwocInitSidebar(context)` | Initialize sidebar with page callbacks | `SidebarContent` composable init |
| `_wireFilterCheckboxes(context)` | Wire filter checkbox events | `FilterPanel` composable |
| `toggleSidebar()` | Sidebar open/close toggle | `SidebarStateViewModel.toggle()` |
| `restoreSidebarState()` | Restore sidebar state from localStorage | `SidebarStateViewModel` (persisted) |
| `toggleSidebarSection(sectionId)` | Toggle section visibility | `CollapsibleSection` composable |
| `expandSidebarSection(sectionId)` | Expand a sidebar section | `CollapsibleSection` composable |
| `_toggleFiltersSection()` | Toggle Filters section | `SidebarContent` (inline) |
| `_expandFiltersSection()` | Ensure Filters section expanded | `SidebarContent` (inline) |
| `toggleFilterGroup(groupId)` | Toggle filter sub-group | `FilterPanel` composable |
| `expandFilterGroup(groupId)` | Expand filter sub-group | `FilterPanel` composable |
| `_toggleNotifInbox()` | Toggle notification inbox | `NotificationBadgeViewModel` |
| `_fetchNotifications()` | Fetch notifications from API | `NotificationBadgeViewModel.fetchNotifications()` |
| `_updateNotifBadge()` | Update notification badge count | `NotificationBadgeViewModel.badgeCount` |
| `_renderNotifInbox()` | Render notification inbox list | Notifications screen composable |
| `_respondNotification(notifId, status)` | Accept/decline notification | `NotificationBadgeViewModel.respond()` |
| `_fetchSidebarVersion()` | Fetch version for sidebar footer | `SettingsViewModel` (version display) |
| `initMobileSidebar()` | Initialize mobile sidebar overlay | `SidebarContent` composable |
| `initMobileViewsButton()` | Add Views button with slide-in panel | `ViewsPanel` composable |
| `initMobileReferenceClose()` | Add close button to reference overlay | `ReferenceDialog` |
| `_restoreViewModeButtons()` | Restore view mode button highlights | `ViewsPanel` composable |
| `currentTab` | Active tab name | `CCaptnTabRow` selected tab state |
| `chits` | Array of all loaded chits | `ChitRepository.chits` (Flow) |
| `previousState` | Previous tab/view state | Android navigation back stack |
| `_cachedTagObjects` | Cached tag objects for colors | `SettingsRepository.settings` (tags) |
| `_chitOptions` | Chit display options | `SettingsRepository.settings` (display options) |
| `_snoozeRegistry` | Snooze registry | `NotificationScheduler` state |
| `_defaultFilters` | Default search filters per tab | `FilterSortViewModel.customViewFilters` |
| `_globalSearchResults` | Cached search results | Search screen ViewModel |
| `_globalSearchQuery` | Current search query | Search screen ViewModel |
| `_weekStartDay` | Week start day setting | `SettingsRepository.settings.weekStartDay` |
| `fetchChits()` | Fetch owned + shared chits | `ChitRepository.getAllChits()` |
| `displayChits()` | Main render dispatcher | ViewModel → Compose recomposition |
| `_updateTabCounts(filteredChits)` | Update tab count labels | `CCaptnTabRow` badge counts |
| `_applyChitDisplayOptions()` | Apply visual options (fade past, highlight overdue) | `CwocChitCardStyle` |
| `storePreviousState()` | Save UI state to localStorage | Android navigation back stack |
| `_restoreUIState()` | Restore UI state | Android navigation state restoration |
| `_checkTabOverflow()` | Detect tab bar overflow | `CCaptnTabRow` (scrollable) |
| `_applyViewOrder(viewOrder)` | Reorder tab bar DOM | `CCaptnTabRow` (view order from settings) |
| `openHelpPage()` | Navigate to help page | Android navigation to Help screen |
| `_toggleReference()` | Toggle keyboard reference overlay | `ReferenceDialog` |
| `_closeReference()` | Close keyboard reference | `ReferenceDialog` dismiss |
| `_mobileZoneOrder` | Ordered zone definitions | `EditorZoneNav` composable |
| `_mobileShowZone(idx)` | Show specific zone by index | `EditorZoneNav` navigation |
| `_mobileNextZone()` | Navigate to next zone | `EditorZoneNav` swipe/button |
| `_mobilePrevZone()` | Navigate to previous zone | `EditorZoneNav` swipe/button |
| `_createMobileZoneHeader()` | Create sticky zone header | `EditorZoneHeader` composable |
| `_createMobileZoneList()` | Create zone list overlay | `EditorZoneNav` (zone list) |
| `_activateMobileZoneMode()` | Activate mobile zone mode | `EditorZoneNav` (always active on Android) |
| `initMobileZoneNav()` | Initialize mobile zone navigation | `EditorZoneNav` composable |
| `_cwocToggleUserDropdown(switcherWrap)` | Toggle user dropdown | `ProfileMenu` composable |
| `_cwocShowSwitchPasswordPrompt(targetUser)` | Show password prompt for switch | `ProfileMenu` (switch dialog) |
| `_cwocLogout()` | Logout and redirect | `ProfileMenuViewModel.logout()` |
| `_initProfileMode()` | Switch UI to profile mode | `ProfileMenu` → Contact Editor (profile mode) |
| `_loadProfile()` | Load own profile | `ProfileMenuViewModel.loadProfile()` |
| `_saveProfile()` | Save profile data | `ProfileMenuViewModel.saveProfile()` |

---

### Maps & Weather

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_mapsInit()` | Entry point — init map | `MapScreen` composable |
| `_initLeafletMap()` | Create Leaflet map instance | `MapScreen` (OSM MapView) |
| `_injectModeToggle()` | Create Chits/Both/People toggle | `MapScreen` mode toggle |
| `_mapsSetMode(mode)` | Set mode and trigger switch | `MapViewModel.setMode()` |
| `_fetchAndDisplayChits()` | Fetch chits, geocode, place markers | `MapViewModel.loadChits()` |
| `_fetchAndDisplayContacts()` | Fetch contacts, geocode, place markers | `MapViewModel.loadContacts()` |
| `_geocodeChits(chits)` | Geocode chit locations | `GeocodingUtil.geocodeAddress()` |
| `_geocodeContacts(contacts)` | Geocode contact addresses | `GeocodingUtil.geocodeAddress()` |
| `_placeMarkers(geocodedChits)` | Create colored markers | `MapScreen` (marker placement) |
| `_placeContactMarkers(geocodedContacts)` | Create contact markers | `MapScreen` (contact markers) |
| `_buildPopupContent(chit)` | Build chit marker popup | `MapScreen` (marker info window) |
| `_buildContactPopupContent(contact, address)` | Build contact popup | `MapScreen` (contact info window) |
| `_applyChitsFilters(chits)` | Apply all chit filters | `MapViewModel.applyFilters()` |
| `_applyPeopleFilters(contacts)` | Apply people filters | `MapViewModel.applyPeopleFilters()` |
| `_handleFocusAddress(focusType, address)` | Center map on address | `MapViewModel.focusAddress()` |
| `_loadGeocodeCache()` | Load geocode cache from localStorage | `GeocodingUtil` (in-memory cache) |
| `_saveGeocodeCache()` | Persist geocode cache to localStorage | `GeocodingUtil` (in-memory cache) |
| `getGeocodeCached(address)` | Get cached lat/lon for address | `GeocodingUtil.getCached()` |
| `setGeocodeCache(address, lat, lon)` | Store geocode result in cache | `GeocodingUtil.setCache()` |
| `_geocodeAddress(address)` | Geocode with progressive fallback | `GeocodingUtil.geocodeAddress()` |
| `_getCoordinates(address)` | Geocode address | `GeocodingUtil.geocodeAddress()` |
| `_getWeather(lat, lon)` | Fetch 1-day weather | API call via ViewModel |
| `onClearLocation(event)` | Clear location | `ChitEditorViewModel` (clear location) |
| `openLocationInNewTab(event)` | Open in Google Maps | Android intent (Maps app) |
| `openLocationDirections(event)` | Open directions | Android intent (Maps app) |
| `_viewLocationInContext(event)` | Navigate to maps page | Android navigation to Map screen |
| `loadSavedLocations()` | Fetch saved locations from settings | `SettingsRepository.settings` (locations field) |
| `getDefaultLocation()` | Return default saved location | `SettingsRepository` (default location) |
| `getWeatherFromCache(address)` | Get cached forecast for address | `WeatherModal` (in-memory cache) |
| `fetchAndCacheWeather(address)` | Fetch forecast and store in cache | `WeatherModal` / API call |
| `_getWeatherIcon(code)` | Get weather emoji for WMO code | `UnitConverter.getWeatherIcon()` |
| `_getPrecipLabel(code)` | Get precipitation type label | `UnitConverter.getPrecipType()` |
| `_formatPrecip(precipMm, weatherCode)` | Format precipitation display | `UnitConverter.formatPrecip()` |
| `_celsiusToFahrenheit(c)` | Convert C to F | `UnitConverter.convertTemp()` |
| `_isWeatherStale(updatedTime)` | Check if weather is stale | `WeatherModal` (inline) |
| `_buildLocationSelectorHTML(locations, selectedAddress)` | Build location dropdown | `WeatherModal` (location picker) |
| `_onWeatherModalLocChange()` | Handle location dropdown change | `WeatherModal` (inline) |
| `_onWeatherModalManualGo()` | Handle manual location input | `WeatherModal` (inline) |
| `_openWeatherModal()` | Open weather modal | `WeatherModal` composable |
| `_fetchWeatherForModal(address, label)` | Fetch weather for modal | `WeatherModal` ViewModel |
| `_closeWeatherModal()` | Close weather modal | `WeatherModal` dismiss |
| `_wxPageIcons` | WMO code → emoji map | `UnitConverter` weather icons |
| `_wxPageGetIcon(code)` | Get emoji for WMO code | `UnitConverter.getWeatherIcon()` |
| `_wxPageC2F(c)` | Convert C to F | `UnitConverter.convertTemp()` |
| `_wxPrecipType(code)` | Get precip type from code | `UnitConverter.getPrecipType()` |
| `_wxFormatPrecip(precipMm, weatherCode)` | Format precipitation | `UnitConverter.formatPrecip()` |
| `_initWeatherPage()` | Main page init | Weather screen composable |
| `_wxFetchForecast(loc)` | Fetch 16-day forecast | Weather screen ViewModel |
| `_wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate)` | Render forecast table | Weather screen composable |

---

### Rules Engine

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `loadRules()` | Fetch rules from API | `RulesManagerViewModel.loadRules()` |
| `renderRulesTable()` | Render rules table | `RulesManagerScreen` composable |
| `toggleRule(ruleId)` | Toggle rule enabled state | `RulesManagerViewModel.toggleRule()` |
| `deleteRule(ruleId, ruleName)` | Delete rule with confirmation | `RulesManagerViewModel.deleteRule()` |
| `_saveRule()` | Save rule via POST/PUT | `RuleEditorViewModel.save()` |
| `cancelOrExit()` | Cancel/exit via save system | Android back navigation |
| `_loadRule(ruleId)` | Load rule and populate form | `RuleEditorViewModel.loadRule()` |

---

### Tags

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_postSettingsWithRetry(body)` | POST settings with 401 retry | `SettingsRepository.updateSettings()` |
| `buildTagTree(flatTags)` | Build nested tag tree from flat array | `TagTreeParser.buildTree()` |
| `flattenTagTree(tree, originalNames)` | Flatten tag tree to flat list | `TagTreeParser.flatten()` |
| `matchesTagFilter(chitTags, filterTag)` | Check if chit tags match filter (with descendants) | `FilterEngine` (tag filter with descendant matching) |
| `renderTagTree(container, tree, selectedTags, onToggle, opts)` | Render expandable tag tree HTML | `FilterPanel` composable (tag tree) |
| `createTagInline(name, opts)` | Create tag inline in settings | `TagCreateDialog` + `SettingsRepository` |
| `updateTagInline(oldName, tagData)` | Update existing tag in settings | `TagCreateDialog` + `SettingsRepository` |
| `deleteTagInline(tagName)` | Delete tag from settings | `SettingsRepository.deleteTag()` |
| `SYSTEM_TAGS` | Array of system tag names | `TagTreeParser.SYSTEM_TAGS` |
| `isSystemTag(tagName)` | Return true if tag is system tag | `TagTreeParser.isSystemTag()` |

---

### Recurrence

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_advanceRecurrence(current, freq, interval, byDayNums)` | Advance Date by one recurrence interval | `RecurrenceEngine.advanceDate()` |
| `expandRecurrence(chit, rangeStart, rangeEnd)` | Expand recurring chit into virtual instances | `RecurrenceEngine.expand()` |
| `formatRecurrenceRule(rule, isHabit)` | Format recurrence rule as readable string | `RecurrenceEngine.formatRule()` |
| `_recurrenceAddException(parentId, exception)` | Add exception on recurring chit | `ChitRepository.addRecurrenceException()` |
| `_recurrenceRemoveException(parentId, dateStr)` | Remove exception for date | `ChitRepository.removeRecurrenceException()` |
| `_dateModeSuppressUnsaved` | Suppress unsaved during init | `ChitEditorViewModel` init flag |
| `onDateModeChange()` | Handle date mode radio change | `DateZone` mode selection |
| `onDueCompleteToggle()` | Toggle status to Complete | `DateZone` (inline) |
| `onStatusChange()` | Sync Due Complete checkbox | `DateZone` (inline) |
| `_detectDateMode(chit)` | Detect date mode from chit | `ChitEditorViewModel.detectDateMode()` |
| `_setDateMode(mode)` | Set date mode radio | `DateZone` mode state |
| `toggleAllDay()` | Toggle all-day mode | `DateZone` all-day toggle |
| `_updateRecurrenceLabels()` | Update recurrence labels | `RecurrenceZone` (inline) |
| `onRecurrenceChange()` | Handle recurrence dropdown change | `RecurrenceZone` |
| `onRepeatToggle()` | Toggle repeat options | `RecurrenceZone` |
| `onRecurrenceFreqChange()` | Show/hide by-day checkboxes | `RecurrenceZone` |
| `onRecurrenceEndsToggle()` | Toggle recurrence end-date | `RecurrenceZone` |
| `_buildRecurrenceRule()` | Build recurrence rule from form | `ChitEditorViewModel.buildRecurrenceRule()` |
| `_loadRecurrenceRule(rule)` | Populate UI from saved rule | `RecurrenceZone` (state loading) |
| `clearStartAndEndDates()` | Clear start/end date fields | `DateZone` clear action |
| `clearDueDate()` | Clear due date fields | `DateZone` clear action |
| `onHabitToggle()` | Handle Habit button toggle | `HabitsZone` |
| `_updateHabitProgressDisplay()` | Update habit progress display | `HabitsZone` (state-driven) |
| `onHabitGoalChange()` | Handle habit goal change | `HabitsZone` |
| `_toggleAllDayBtn()` | Toggle All Day button | `DateZone` all-day button |
| `_updateAllDayBtnState()` | Sync All Day button appearance | `DateZone` (state-driven) |
| `setPointInTimeNow()` | Set Point in Time to now | `DateZone` (point-in-time) |
| `clearPointInTime()` | Clear Point in Time fields | `DateZone` (point-in-time) |
| `_initTimezonePicker()` | Initialize timezone picker | `TimezonePickerModal` |
| `_getTimezoneAbbreviation(ianaTimezone)` | Get short timezone abbreviation | `DateUtils.getTimezoneAbbreviation()` |
| `_getTimezoneLongName(ianaTimezone)` | Get long timezone name | `DateUtils.getTimezoneLongName()` |
| `_buildTzTooltip(ianaTimezone)` | Build timezone tooltip | `TimezonePickerModal` (inline) |
| `_injectTzAbbrevLabels()` | Inject timezone abbreviation labels | `DateZone` (timezone display) |
| `_updateTzAbbrevLabels()` | Update timezone labels | `DateZone` (state-driven) |

---

### Indicators

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_ALERT_TYPES` | Array of valid alert type values | `AlertClassifier.ALERT_TYPES` |
| `_chitHasAlerts(chit)` | Return true if chit has alerts | `AlertClassifier.hasAlerts()` |
| `_ALERT_ICON_MAP` | Alert types to emoji icons | `AlertClassifier.ALERT_ICON_MAP` |
| `_STATUS_ICONS` | Status strings to icon strings | `ChitCardEnhancements` (status icons) |
| `_getAlertIndicators(chit, settings, context)` | Return alert indicator icons | `ChitCardEnhancements.getAlertIndicators()` |
| `_getAllIndicators(chit, settings, context)` | Return all visual indicator icons | `ChitCardEnhancements.getAllIndicators()` |
| `_shouldShow(mode, context)` | Check if display mode permits showing | `ChitCardEnhancements.shouldShow()` |
| `_chitAlertTypesPresent(chit)` | Return alert type presence map | `AlertClassifier.typesPresent()` |
| `_computePrerequisiteFlags(allChits)` | Compute prerequisite chain indicator | `ChitCardEnhancements.computePrereqFlags()` |
| `_indInitViewMode()` | Initialize view mode (calendar/log/charts) | Indicators screen mode state |
| `_indBuildModeToggleHtml(activeMode)` | Build 3-value pill toggle | Indicators screen mode toggle |
| `_indAttachModeToggleListener()` | Attach mode toggle listener | Indicators screen (Compose) |
| `displayIndicatorsView()` | Render Indicators tab | Indicators screen composable |
| `_indicatorsLoad()` | Fetch health data and render charts | Indicators screen ViewModel |
| `_indSaveSelection()` | Persist selected indicators | Indicators screen ViewModel |
| `_indRestoreSelection()` | Restore indicator selection | Indicators screen ViewModel |
| `_indPopulateGraphFilter()` | Populate graph filter checkboxes | Indicators screen filter |
| `_indFmtDate(d)` | Format Date as YYYY-MM-DD | `DateUtils` |
| `_indicatorsSetRange(range)` | Set indicator time range | Indicators screen ViewModel |
| `_indicatorsHighlightBtn(range)` | Highlight active range button | Indicators screen (state-driven) |
| `_indicatorsLoadCustomRange()` | Load with custom date range | Indicators screen ViewModel |
| `_indToggleExpand(key)` | Expand/collapse single chart | Indicators screen (state) |

---

### Omni View

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `displayOmniView(filteredChits)` | Main entry — two-column layout | Omni screen composable |
| `_buildOmniSection(sectionConfig, widthClass)` | Build section wrapper | Omni screen section composable |
| `_populateOmniSections(filteredChits, visibleSections)` | Route chits to sections | Omni screen ViewModel |
| `_omniDeduplicateChits(filteredChits)` | Categorize with deduplication | Omni screen ViewModel |
| `_renderOmniChrono(contentEl, chronoItems, viSettings)` | Chrono Anchored section | Omni screen (chrono section) |
| `_buildTimeUntilBadge(startTime, now)` | Create time-until badge | Omni screen (inline) |
| `_formatTimeUntil(minutes)` | Format minutes to readable string | Omni screen (inline) |
| `_renderOmniOnDeck(contentEl, ondeckItems, viSettings)` | On Deck section | Omni screen (on-deck section) |
| `_renderOmniSoon(contentEl, soonItems, viSettings)` | Soon section | Omni screen (soon section) |
| `_buildDueDateBadge(dueDate, now)` | Create due-date badge | Omni screen (inline) |
| `_renderOmniWeather(contentEl)` | Weather bar renderer | Omni screen (weather section) |
| `_populateOmniWeatherBar(bar)` | Populate weather bar | Omni screen (weather) |
| `_buildWeatherBarContent(bar, daily, locationLabel)` | Build weather bar content | Omni screen (weather) |
| `_renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings)` | Pinned Notes section | Omni screen (pinned notes) |
| `_renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings)` | Pinned Checklists section | Omni screen (pinned checklists) |
| `_renderOmniEmail(contentEl, allEmailChits)` | Email section with pagination | Omni screen (email section) |
| `_getOmniEnabledBundles()` | Returns Omni-enabled bundles | Omni screen ViewModel |

---

### Custom Objects

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_coFetchAll()` | Fetch all custom objects | Custom Objects screen ViewModel |
| `_coRenderList()` | Render filtered object list | Custom Objects screen composable |
| `_coOpenEditModal(obj)` | Open create/edit modal | Custom Objects screen (edit dialog) |
| `_coSaveObject()` | Save custom object | Custom Objects screen ViewModel |
| `_coToggleActive(objectId, newActive)` | Toggle active status | Custom Objects screen ViewModel |
| `_coConfirmDelete()` | Confirm soft-delete | Custom Objects screen ViewModel |
| `_coRestoreObject(objectId)` | Restore soft-deleted object | Custom Objects screen ViewModel |

---

### Attachments

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `loadAttachments()` | Fetch all attachments | Attachments screen ViewModel |
| `renderGrid(wrap)` | Build attachment card grid | Attachments screen composable |

---

### User Admin

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_loadUsers()` | Fetch all users | User Admin screen ViewModel |
| `_renderUserTable()` | Render user table | User Admin screen composable |
| `openCreateUserModal()` | Open create user modal | User Admin screen (create dialog) |
| `submitCreateUser()` | Submit create user form | User Admin screen ViewModel |
| `deactivateUser(userId)` | Deactivate user | User Admin screen ViewModel |
| `reactivateUser(userId)` | Reactivate user | User Admin screen ViewModel |

---

### Sync

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `initSyncWebSocket()` | Initialize WebSocket sync connection | `SyncRepository` (HTTP polling) |
| `_startSyncPolling()` | Start HTTP polling fallback | `SyncRepository.startPolling()` |
| `_pollSync()` | Execute single sync poll | `SyncRepository.poll()` |
| `_dispatchSyncMessage(msg)` | Dispatch sync message to handlers | `SyncRepository` (Flow emissions) |
| `syncSend(type, data)` | Send sync message | `SyncRepository.send()` |
| `syncOn(type, callback)` | Register handler for sync type | `SyncRepository` (Flow collection) |
| `_pageHasUnsavedChanges()` | Check if page has unsaved changes | `ChitEditorViewModel.hasUnsavedChanges` |
| `_showAutoRefreshBanner()` | Show data-updated warning banner | `ConflictBanner` composable |
| `_handleRemoteDataChange(type)` | Handle remote data change | `SyncRepository` → ViewModel refresh |

---

### Utilities

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_convertTemp(c)` | Convert Celsius for display based on unit_system | `UnitConverter.convertTemp()` |
| `_tempUnit()` | Return temperature unit label | `UnitConverter.tempUnit()` |
| `_isMetricUnits()` | Return true if unit_system is metric | `UnitConverter.isMetric()` |
| `_convertWind(kmh)` | Convert wind speed for display | `UnitConverter.convertWind()` |
| `_tempBarRange()` | Return barMin/barMax for temperature visuals | `UnitConverter.tempBarRange()` |
| `generateUniqueId()` | Create unique ID from timestamp + random | `java.util.UUID.randomUUID()` |
| `formatDate(date)` | Format Date as YYYY-Mon-DD | `DateUtils.formatDate()` |
| `formatTime(date)` | Format Date as HH:MM | `DateUtils.formatTime()` |
| `setSaveButtonUnsaved()` | Mark save button as unsaved | `ChitEditorViewModel.markUnsaved()` |
| `contrastColorForBg(hex)` | Return dark/light text for contrast | `ColorUtils.contrastColorForBg()` |
| `applyChitColors(el, bgColor)` | Apply background + auto-contrast font color | `CwocChitCardStyle` composable |
| `isLightColor(hex)` | Return true if hex color is light | `ColorUtils.isLightColor()` |
| `_utcToLocalDate(isoString)` | Parse ISO datetime to local Date | `DateUtils.utcToLocal()` |
| `_parseISOTime(isoString)` | Parse ISO datetime to formatted HH:MM | `DateUtils.parseISOTime()` |
| `getPastelColor(label)` | Generate deterministic pastel color from string | `ColorUtils.getPastelColor()` |
| `_convertDBDateToDisplayDate(dateString)` | Convert UTC ISO to local display date | `DateUtils.convertDBDateToDisplay()` |
| `getCurrentTimezone()` | Resolve user's current timezone | `DateUtils.getCurrentTimezone()` |
| `convertTimezoneForDisplay(isoString, fromTz, toTz, opts)` | Convert datetime between timezones | `DateUtils.convertTimezone()` |
| `getChitDisplayTime(chit, field, currentTz)` | Get display time, converting if anchored | `DateUtils.getChitDisplayTime()` |
| `_cwocWeatherIcons` | WMO weather code → emoji icon map | `WeatherModal` / `UnitConverter` weather icons |
| `_cwocGetWeatherIcon(code)` | Get weather emoji for WMO code | `UnitConverter.getWeatherIcon()` |
| `_cwocGetPrecipType(code)` | Get precipitation type from WMO code | `UnitConverter.getPrecipType()` |
| `_cwocFormatPrecip(precipMm, weatherCode, emptyVal)` | Format precipitation with type | `UnitConverter.formatPrecip()` |
| `_isViewerRole(chit)` | Check if chit is viewer-only | `ChitCardEnhancements.isViewerRole()` |
| `_isSharedChit(chit)` | Check if chit is shared | `ChitCardEnhancements.isShared()` |
| `_emptyState(message)` | Build empty-state message | Compose empty state composable |
| `_getTagColor(tagName)` | Get tag color from settings | `ColorUtils.getTagColor()` |
| `_getTagFontColor(tagName)` | Get tag font color | `ColorUtils.getTagFontColor()` |
| `_buildChitHeader(chit, titleHtml, settings, opts)` | Build chit card header | `SwipeableChitCard` composable |
| `_buildNotePreview(chit, extraStyle)` | Build expandable note preview | Notes screen card composable |
| `_renderChitMeta(chit, mode)` | Legacy compact meta builder | `SwipeableChitCard` (meta section) |
| `_updateUrlHash()` | Update URL hash for tab+mode | N/A (web-only — Android uses nav state) |
| `_loadBundlesForModal(selectEl)` | Load bundles into dropdown | `BundleViewModel.bundles` |
| `_populateBundleSelect(selectEl, bundles)` | Populate bundle select dropdown | `BundleToolbar` composable |
| `cwocPlayAudio(audio, opts)` | Play audio file reliably | `AlarmSoundPlayer` |
| `_getTodayISO()` | Get today as YYYY-MM-DD | `DateUtils` (trivial) |
| `_syncSidebarTagCheckboxes(container, tagObjects)` | Sync hidden checkboxes to selection | N/A (web-only DOM sync) |
| `_escOmniHtml(str)` | HTML escape | N/A (web-only) |

---

## Priority 4: Web-Only (N/A — No Android Equivalent Needed)

Functions that are inherently web-only and don't need Android implementation.

---

### DOM Manipulation & Browser APIs

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_escHtml(str)` | Escape HTML special characters | N/A (web-only — Compose handles escaping) |
| `_escHtml(str)` (shared.js) | HTML-escape for print functions | N/A (web-only) |
| `_escHtml(str)` (main-email.js) | HTML escape | N/A (web-only) |
| `_escapeHtml(str)` (indicators) | Escape HTML | N/A (web-only) |
| `_calcCreatePopover()` | Build calculator DOM | N/A (Compose — `CalculatorSheet`) |
| `_calcClampToViewport(el)` | Clamp popover to viewport | N/A (web-only) |
| `_buildWeatherModalHTML(content)` | Build weather modal HTML | N/A (Compose — `WeatherModal`) |
| `_getBreakpointCategory()` | Return breakpoint category | N/A (web-only — Android is always mobile) |
| `_onDebouncedResize()` | Debounced resize handler | N/A (web-only) |
| `_parseUrlHash()` | Parse URL hash | N/A (web-only) |
| `_updateUrlHash()` | Update URL hash for tab+mode | N/A (web-only — Android uses nav state) |
| `cwocTagModal.inject()` | Inject modal HTML into page | N/A (Compose — `TagCreateDialog`) |
| `Auto-header/footer injection` | Inject header and footer | N/A (web-only — Compose Scaffold) |

---

### Keyboard Shortcuts / Hotkeys

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_cwocHotkeyTabMap` | Key-to-tab mapping | N/A (web-only — keyboard shortcuts) |
| `_cwocIsDashboard()` | Returns true if on dashboard | N/A (web-only) |
| `_cwocSwitchTab(tabName)` | Switch to a tab | N/A (web-only — keyboard shortcuts) |
| `_cwocHandleActionHotkey(keyLower, e)` | Handle action hotkeys | N/A (web-only — keyboard shortcuts) |
| `_cwocDispatchHotkey(e)` | Main hotkey dispatcher | N/A (web-only — keyboard shortcuts) |
| `_resolveHotkeyTab(keyLower)` | Resolve hotkey to tab | N/A (web-only — keyboard shortcuts) |
| `_showPanel(panelId)` | Show hotkey overlay panel | N/A (web-only — keyboard shortcuts) |
| `_hideAllPanels()` | Hide all hotkey panels | N/A (web-only) |
| `_dimSidebar(activeId, activeFilterGroupId)` | No-op legacy | N/A (web-only) |
| `_undimSidebar()` | Hide all panels (legacy) | N/A (web-only) |
| `_exitHotkeyMode()` | Exit hotkey submenu mode | N/A (web-only) |
| `_pickNav(href)` | Navigate from hotkey panel | N/A (web-only) |
| `_pickPeriod(period)` | Switch calendar period from hotkey | N/A (web-only) |
| `_openModePanel()` | Show Mode panel (M key) | N/A (web-only) |
| `_enterFilterSub(type)` | Enter filter sub-panel | N/A (web-only) |
| `_buildFilterSubPanel(containerId, checkboxSelector)` | Build hotkey sub-panel | N/A (web-only) |
| `_rulesSetupHotkey()` | Register F10 for Rules Manager | N/A (web-only — keyboard shortcut) |
| `_initSharedHotkeys()` | Register global hotkey listener | N/A (web-only — keyboard shortcuts) |
| `cwocInitEditorHotkeys(zoneMap, saveFns)` | Initialize Alt+N hotkeys | N/A (web-only — keyboard shortcuts) |
| `_toggleFilterArchived()` | Toggle show-archived via hotkey | N/A (web-only — keyboard shortcut) |
| `_toggleFilterPinned()` | Toggle show-pinned via hotkey | N/A (web-only — keyboard shortcut) |
| `_filterFocusSearch()` | Focus search input via hotkey | N/A (web-only — keyboard shortcut) |
| `_pickSort(field)` | Set sort field via hotkey | N/A (web-only — keyboard shortcut) |
| `_hotkeyMode` | Current hotkey submenu state | N/A (web-only) |
| `_calcSetupHotkey()` | Register F4 hotkey | N/A (web-only — keyboard shortcut) |

---

### CSS Concerns

| Section | Description | Android Equivalent |
|---------|-------------|-------------------|
| CSS Variables (shared-page.css) | Parchment colors, brown tones, accent gold | `Color.kt` + `Theme.kt` |
| Base Body | Parchment background, font | `ParchmentBackground` composable |
| Page Panel | Main content wrapper | Compose `Scaffold` |
| Page Header Bar | Logo + title + nav buttons | Compose top app bar |
| Standard Button | Gradient nav/action buttons | `CwocButton` composable |
| Settings Grid | CSS Grid for settings layouts | Compose `Column`/`Row` layouts |
| Form Elements | Select, input, textarea styling | `CwocTextField` composable |
| Tables | Shared table styling | Compose `LazyColumn` |
| Tag Chips | Inline tag chip styling | Compose `FilterChip` / custom chips |
| Empty State | Centered empty-state message | Compose empty state composable |
| Modal | Full-screen modal overlay | Compose `Dialog` / `ModalBottomSheet` |
| Calculator Popover | Calculator styling | `CalculatorSheet` composable |
| Maps Page Layout | Full viewport map layout | `MapScreen` composable |
| CSS Variables (shared-editor.css) | Editor color palette | `Color.kt` editor colors |
| Header Row | Logo + title + buttons | `ChitEditorScreen` top bar |
| Zone Container Pattern | Collapsible sections | `CollapsibleZone` composable |
| Main Zones Grid | Two-column grid | Compose `Column` (single column on mobile) |
| Toggle Switch | On/off toggle | Compose `Switch` |
| User Switcher | User switcher styles | `ProfileMenu` composable |
| Overlay (timepicker) | Full-screen backdrop | `DrumRollerTimePicker` overlay |
| Modal (timepicker) | Bottom-sheet/centered card | `DrumRollerTimePicker` sheet |
| Drums | Scroll columns | `DrumRollerTimePicker` wheels |
| Buttons (timepicker) | Cancel/Now/Set row | `DrumRollerTimePicker` buttons |
| Shared Variables (styles-variables.css) | Parchment, brown tones | `Color.kt` + `Theme.kt` |
| Dashboard-specific Variables | Sidebar bg/border | `SidebarContent` colors |
| Body (styles-layout.css) | Parchment background, font | `ParchmentBackground` |
| Header | Title styling | Compose top app bar |
| Week Navigation | Period nav buttons | `CalendarScreen` navigation |
| Completed Task | Dimmed styling | `CwocChitCardStyle` (completed state) |
| Sidebar (styles-sidebar.css) | Fixed positioning, slide-in | `SidebarContent` + `ModalDrawer` |
| Filter Groups | Collapsible filter sections | `FilterPanel` composable |
| Multi-select Controls | Checkbox lists | `FilterPanel` checkboxes |
| Sort Controls | Sort dropdown and direction | `SortPanel` composable |
| Notification Inbox | Notification badge and list | `NotificationBadgeViewModel` |
| Tab Bar (styles-tabs.css) | Flex container | `CCaptnTabRow` composable |
| Tab Styling | Background, border, hover | `CCaptnTabRow` tab styling |
| Tab Count | Badge indicators | `CCaptnTabRow` badge counts |
| Week View Grid (styles-calendar.css) | CSS Grid layout | `CalendarTimeGrid` composable |
| Day Headers | Sticky headers | `CalendarTimeGrid` headers |
| Timed Events | Absolute-positioned cards | `CalendarTimeGrid` event cards |
| All-day Events | Multi-day spanning | `CalendarTimeGrid` all-day section |
| Month Grid | Month view cells | `CalendarMonthView` composable |
| Year View | Compact year overview | `CalendarYearView` composable |
| Itinerary View | List-style display | `CalendarItineraryView` composable |
| Time-now Bar | Current time indicator | `CalendarTimeGrid` time indicator |
| Chit Card (styles-cards.css) | Border, padding, color | `SwipeableChitCard` composable |
| Card Header Row | Title, meta, states | `SwipeableChitCard` header |
| Drag Feedback | Visual feedback during drag | Compose drag modifier |
| Notes Masonry | Multi-column layout | Compose `StaggeredGrid` |
| People Chips | People name chips | Compose chip composable |
| Checklist Container (editor.css) | Item layout, drag, nesting | `ChecklistZoneV2` composable |
| Zone Extensions | Health, color, chit-specific | Editor zone composables |
| Notes Modal | Expandable notes modal | ❌ Not implemented |
| Date Mode Layout | Radio-based date selector | `DateZone` composable |
| Projects Zone | Kanban container | `KanbanColumn` composable |
| Sharing Panel | Sharing zone styles | ❌ Not implemented |
| People Expand Modal | Full-screen people modal | ❌ Not implemented |
| Email Zone Container (editor-email.css) | Border, collapse | `EmailComposeZone` composable |
| Email Field Rows | Label + input pairs | `EmailComposeZone` fields |
| Email Body | Textarea styling | `EmailComposeZone` body |
| Recipient Tag Chips | Chip styling | `RecipientChipField` composable |
| Email Thread Section | Thread conversation view | `EmailThreadViewInEditor` composable |
| HTML Email Rendering | Toggle, iframe | `HtmlEmailRenderer` composable |
| Attachment List (editor-attachments.css) | Flex layout for items | `AttachmentsZone` composable |
| Upload Area | Drop zone | `AttachmentsZone` (file picker) |

---

### Tab Sync (BroadcastChannel)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `cwocTabSyncInvalidate()` | Notify all tabs that data has changed | N/A (web-only — single app instance) |
| `cwocTabSyncIsLeader()` | Returns true if this tab is the leader | N/A (web-only — single app instance) |
| `cwocTabSyncBroadcastChits(chitsData)` | Broadcasts fresh data to follower tabs | N/A (web-only — single app instance) |

---

### Print Functions

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_printNoteWithChoice(text, title)` | Show Raw/Rendered choice then print | N/A (web-only — use Android share) |
| `_openPrintTab(text, title, mode)` | Print via hidden iframe | N/A (web-only — use Android print) |
| `_printChit()` | Print entire chit with all zones | N/A (web-only — use Android share/print) |
| `_printNote(event)` | Print note | N/A (web-only — use Android share) |

---

### Service Worker / PWA

| File | Description | Android Equivalent |
|------|-------------|-------------------|
| `manifest.json` | Web App Manifest | N/A (native Android app) |
| `sw.js` | Service Worker | N/A (native app — no service worker needed) |
| `pwa-register.js` | SW registration + push subscription | `NotificationScheduler` (FCM/local) |
| `offline.html` | Offline fallback page | Android offline handling (Room DB) |

---

### Install Scripts (Server-Only)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `install_tailscale()` | Install Tailscale on server | N/A (server-only) |
| `deploy_ha_integration()` | Deploy HA custom integration | N/A (server-only) |

---

### Mobile Web Workarounds (Not Needed on Native)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `initMobileActionsModal()` | Replace header buttons with Actions trigger | N/A (web-only) |
| `_openMobileActionsModal()` | Open mobile actions modal | N/A (web-only) |
| `_isMobileOverlay()` | Check if viewport is mobile overlay mode | N/A (web-only — always mobile on Android) |
| `_toggleTopbar()` | Toggle topbar visibility | N/A (web-only — Android has native app bar) |
| `_restoreTopbarState()` | Restore topbar from localStorage | N/A (web-only) |
| `initAudioUnlock()` | Initialize mobile audio unlock | N/A (web-only — Android handles natively) |
| `_onNotesDragKey(e)` | Handle ESC to cancel notes drag | N/A (web-only) |

---

### Deprecated / Legacy

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_quickAlertAddToChit(type)` | Deprecated | N/A |
| `_quickAlertAddIndependent(type)` | Deprecated | N/A |
| `_quickAlertAddIndependentDashboard(type)` | Deprecated | N/A |
| `enableLongPress(el, callback)` | DEPRECATED: long-press handler | N/A |

---

### Test Files (Not App Code)

| Symbol | Description | Android Equivalent |
|--------|-------------|-------------------|
| Property 3 (test_habits_helpers.js) | getCurrentPeriodDate property test | N/A (test file — not app code) |
| Property 4 (test_habits_success_rate.js) | Success rate calculation test | N/A (test file — not app code) |
| Property 5 (test_habits_streak.js) | Streak calculation test | N/A (test file — not app code) |
| Property 8 (test_habits_sort.js) | Completion-based sort test | N/A (test file — not app code) |

---

## Priority 5: Android Framework (Handled Natively)

Functions where Android handles the equivalent natively through Compose, system APIs, or framework features.

---

### Touch Gestures (Compose Gesture System)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `TOUCH_DRAG_HOLD_MS` | Hold duration before drag activates (400ms) | Android framework (Compose gesture detection) |
| `TOUCH_LONGPRESS_HOLD_MS` | Hold duration before long-press fires (1200ms) | Android framework (Compose `combinedClickable`) |
| `TOUCH_DRAG_MOVE_THRESHOLD` | Max finger movement during hold (10px) | Android framework (touch slop) |
| `enableTouchDrag(element, callbacks, options)` | Drag-only touch adapter | Android framework (Compose drag gestures) |
| `enableTouchGesture(element, callbacks, options)` | Unified drag + long-press gesture | Android framework (Compose `combinedClickable` + drag) |

---

### Layout (Compose Layout)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `NOTES_CARD_WIDTH` | Default card width for notes masonry | N/A (web-only — Compose handles layout) |
| `NOTES_GAP` | Gap between notes cards | N/A (web-only — Compose handles layout) |
| `_notesColMetrics(container)` | Calculate column count for notes | N/A (web-only — Compose StaggeredGrid) |
| `_notesColLeft(colIdx, actualCardWidth)` | Get left offset for column | N/A (web-only) |
| `_assignMissingCols(cards, colCount)` | Assign columns to cards | N/A (web-only) |
| `_buildNoteColumns(cards, colCount)` | Build column groups from cards | N/A (web-only) |
| `_stackColumn(colCards, colIdx, actualCardWidth, skipCard)` | Position cards in column | N/A (web-only) |
| `applyNotesLayout(container)` | Apply masonry layout to notes | N/A (web-only — Compose StaggeredGrid) |

---

### Navigation (Compose Navigation)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `Navigate Panel` | V-hotkey navigation overlay | N/A (web-only — Android uses nav drawer) |
| `DOMContentLoaded handler` | Main init | `MainActivity` + Compose setup |

---

### Drag & Reorder (Compose Drag Modifiers)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `enableNotesDragReorder(container, tab, onReorder)` | Enable drag-to-reorder on notes | `ReorderableList` composable |
| `_onNotesDragMove(e)` | Handle mouse move during notes drag | Android framework (Compose drag) |
| `_onNotesDragMoveXY(clientX, clientY)` | Shared drag-move logic for notes | Android framework (Compose drag) |
| `_onNotesDragEnd(e)` | Handle mouse up during notes drag | Android framework (Compose drag) |
| `_edgeScrollUpdate(container, clientY, opts)` | Auto-scroll near edges during drag | Android framework (LazyColumn auto-scroll) |
| `_edgeScrollStop()` | Stop edge-scroll animation | Android framework |
| `_markDragJustEnded()` | Suppress post-drag click events | N/A (web-only — Android handles natively) |

---

### Sidebar Backdrop (ModalDrawer)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_ensureSidebarBackdrop()` | Ensure sidebar backdrop exists | Android framework (ModalDrawer) |
| `_showSidebarBackdrop()` | Show sidebar backdrop overlay | Android framework (ModalDrawer) |
| `_hideSidebarBackdrop()` | Hide sidebar backdrop overlay | Android framework (ModalDrawer) |

---

### Audio (MediaPlayer)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| Audio playback functions | Web audio API usage | `AlarmSoundPlayer` (MediaPlayer) |

---

### Calculator Drag (Bottom Sheet on Android)

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_calcInitDrag(titleBar)` | Attach drag handlers to title bar | N/A (web-only — bottom sheet on Android) |
| `_calcDragStart(clientX, clientY)` | Begin drag operation | N/A (web-only) |
| `_calcDragMove(clientX, clientY)` | Reposition during drag | N/A (web-only) |
| `_calcDragEnd()` | End drag operation | N/A (web-only) |
| `_calcInitKeyboard(popover)` | Attach keyboard input listener | N/A (web-only) |
| `_calcInitFocusTrap(popover)` | Attach focus-trap listener | N/A (web-only) |
| `_calcIsEditorPage()` | Returns true if on editor page | N/A (web-only) |

---

### Timezone Detection

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `_detectBrowserTimezone()` | Detect browser timezone | Android framework (`TimeZone.getDefault()`) |

---

### Load Order & File Dependencies

> Load order is a web-only concern. Android uses Hilt dependency injection and Compose navigation — no script load order needed.

| Concept | Android Equivalent |
|---------|-------------------|
| Script load order | Hilt `@Inject` + `@HiltViewModel` |
| Global variables | ViewModel StateFlow / Repository |
| DOM manipulation | Compose recomposition |
| Event listeners | Compose gesture modifiers + callbacks |
| localStorage | SharedPreferences / Room DB |
| fetch() API calls | Retrofit `CwocApiService` |
| CSS styling | Material3 Theme + custom composables |

---

### Web-Only Storage

| Function | Description | Android Equivalent |
|----------|-------------|-------------------|
| `MANUAL_ORDER_KEY` | LocalStorage key for manual sort orders | `SettingsRepository` (persisted to API) |
| `SORT_PREFS_KEY` | LocalStorage key for sort preferences | `FilterSortViewModel.sortState` |
| `_saveWeatherCacheToLS()` | Persist weather cache to localStorage | N/A (web-only — Android uses in-memory) |

---


## Summary Statistics

| Category | Count | Notes |
|----------|-------|-------|
| Total web functions mapped | ~1,100+ | Core functions from all JS files |
| **Priority 1** — Core Parity Gaps | ~130 | Major missing user-facing features |
| **Priority 2** — Feature Gaps | ~120 | Medium-impact nice-to-haves |
| **Priority 3** — Implemented ✅ | ~450 | Has a clear Android equivalent |
| **Priority 4** — Web-Only (N/A) | ~200 | Browser/DOM-specific, no Android equivalent needed |
| **Priority 5** — Android Framework | ~100 | Handled natively by Android/Compose |

### Priority 1 Breakdown (Core Gaps)

| Feature Area | Function Count |
|---|---|
| Habits System | 22 |
| Editor Send-Content / Send-Item | 19 |
| People Zone (Full Tree, Sharing) | 16 |
| Calendar Drag-and-Drop | 10 |
| Health Indicators Zone | 10 |
| Editor Prerequisites | 8 |
| Quick Alert Modal | 7 |
| Custom Zones in Editor | 6 |
| Editor Auto-Save | 6 |
| Auto-Complete Checklist → Status | 5 |
| Chit Link Autocomplete | 5 |
| Recurrence Series / Break-Off | 5 |
| Notes Fullscreen Modal | 3 |
| Export/Import Data | 3 |
| Calendar Pinch-to-Zoom | 2 |
