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

| # | Function | Description | Android Equivalent | Gap File | Resolved By |
|-----|----------|-------------|-------------------|----------|-------------|
|  1 |  `displayHabitsView(chitsToDisplay)` | ✅ HabitPeriodCalculator + HabitRolloverEngine + TasksViewModel + HabitCard composable | | .kiro/specs/habits-calendar-parity/tasks.md — Tasks 2, 3, 4, 5, 6 |
|  2 |  `_renderHabitCards(container, habitData, windowDays)` | ✅ A#1841 | | |
|  3 |  `_isResetPeriodActive(chit)` | ✅ A#1857 | | |
|  4 |  `_getResetEndDate(chit)` | ✅ A#1855 | | |
|  5 |  `_habitUrgencyScore(h)` | ✅ A#1856 | | .kiro/specs/habits-calendar-parity/tasks.md — Task 4 |
|  6 |  `_persistHabitUpdate(chit)` | ✅ A#271, A#254 | | |
|  7 |  `_optimisticHabitCardUpdate(card, chit, newSuccess, goal)` | ✅ A#1843 (Compose reactive recomposition) | | |
|  8 |  `_updateStatusBadge(card, status)` | ✅ A#1841 (inline in HabitCard composable) | | |
|  9 |  `_onHabitsWindowChange(newVal)` | ✅ SidebarStateViewModel.setHabitsSuccessWindow() + Room sync | | .kiro/specs/habits-calendar-parity/tasks.md — Task 7 |
|  10 |  `_initHabitsWindowDropdown()` | ✅ A#1964 (SidebarStateViewModel init) | | |
|  11 |  `_fetchAndRenderRuleHabits(container)` | ✅ TasksViewModel.fetchRuleHabits() + HabitsView RuleHabitCard | | |
|  12 |  `_renderAggregateSuccessRate(container, ruleHabits)` | ✅ TasksViewModel.calculateCombinedSuccessRate() + HabitsView bar | | .kiro/specs/habits-calendar-parity/tasks.md — Task 8 |
|  13 |  `_onHabitsIncludeRulesChange(checked)` | ✅ SidebarStateViewModel.setHabitsIncludeRules() | | |
|  14 |  `getCurrentPeriodDate(chit)` | ✅ HabitPeriodCalculator.getCurrentPeriodDate() | | .kiro/specs/habits-calendar-parity/tasks.md — Task 1 |
|  15 |  `_getPreviousPeriodDate(chit)` | ✅ HabitPeriodCalculator.getPreviousPeriodDate() | | .kiro/specs/habits-calendar-parity/tasks.md — Task 1 |
|  16 |  `_evaluateHabitRollover(chit)` | ✅ HabitRolloverEngine.evaluateRollover() | | .kiro/specs/habits-calendar-parity/tasks.md — Task 2 |
|  17 |  `_persistHabitRollover(chit)` | ✅ HabitRolloverEngine.persistRollover() | | .kiro/specs/habits-calendar-parity/tasks.md — Task 2 |
|  18 |  `getHabitSuccessRate(chit, windowDays)` | ✅ TasksScreen.calculateHistoricalSuccessRate() (rewritten) | | .kiro/specs/habits-calendar-parity/tasks.md — Task 3 |
|  19 |  `getHabitStreak(chit)` | ✅ HabitsZone.calculateStreak() (rewritten) | | .kiro/specs/habits-calendar-parity/tasks.md — Task 3 |
|  20 |  `_buildHabitCounter(opts)` | ✅ A#1841 HabitCard (inline +/- buttons) | | |
|  21 |  `_cwocGetHabitCycleEnd(freq)` | N/A (server handles via push notifications) | | |
|  22 |  `fetchHabitRules()` | ✅ TasksViewModel.fetchRuleHabits() | | |
|  23 |  `_renderHabitRuleCards(container, habitRules)` | ✅ RuleHabitCard composable in TasksScreen.kt | | |

---

### Calendar Drag-and-Drop

| # | Function | Description | Android Equivalent | Gap File | Resolved By |
|-----|----------|-------------|-------------------|----------|-------------|
|  24 |  `enableCalendarDrag(...)` | ✅ CalendarTimeGrid.kt detectDragGestures | | |
|  25 |  `_onCalDragMove(e)` | ✅ CalendarTimeGrid.kt onDrag lambda | | |
|  26 |  `_onCalDragEnd(e)` | ✅ CalendarTimeGrid.kt onDragEnd + persistDragMove() | | |
|  27 |  `enableMonthDrag(monthGrid, onDrop)` | ✅ CalendarMonthView.kt detectDragGesturesAfterLongPress + CalendarViewModel.handleMonthDrag() | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 1 |
|  28 |  `enableAllDayDrag(allDayEventsRow, days)` | ✅ CalendarTimeGrid.kt all-day drag + CalendarViewModel.handleAllDayDrag() | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 2 |
|  29 |  `_calSnapMinutes` | ✅ CalendarViewModel.UiState.calendarSnap | | |
|  30 |  `_loadCalSnapSetting()` | ✅ CalendarViewModel loads calendarSnap from settings | | |
|  31 |  `_snapToGrid(minutes)` | ✅ CalendarTimeGrid.kt snapToGrid() | | |
|  32 |  `_showSnapGrid(container)` | ✅ CalendarTimeGrid.kt Canvas snap lines + time labels (shown when isAnyEventDragging) | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 3 |
|  33 |  `_hideSnapGrid()` | ✅ CalendarTimeGrid.kt (grid hidden when drag ends) | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 3 |

---

### Calendar Pinch-to-Zoom

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  34 |  `_calZoomScale` | ✅ CalendarTimeGrid.kt zoomScale state | |
|  35 |  `enableCalendarPinchZoom(scrollContainer)` | ✅ CalendarTimeGrid.kt detectTransformGestures | |

---

### Editor Prerequisites

| # | Function | Description | Android Equivalent | Gap File | Resolved By |
|-----|----------|-------------|-------------------|----------|-------------|
|  36 |  `initPrerequisites(chit)` | ✅ PrerequisitesZone composable + ChitEditorViewModel.loadPrereqChitData() | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 4 |
|  37 |  `getPrerequisitesData()` | ✅ ChitEditorViewModel formState.prerequisites | | |
|  38 |  `openPrereqPicker()` | ✅ ChitPickerSheet (multi-select, server search, circular dep check) | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 4 |
|  39 |  `_renderPrereqList()` | ✅ PrerequisitesZone PrerequisiteItem composable (color, title, status) | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 4 |
|  40 |  `_onPrereqStatusChange(selectEl)` | ✅ ChitEditorViewModel.updatePrereqStatus() + inline dropdown | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 6 |
|  41 |  `_removePrereq(id)` | ✅ PrerequisitesZone remove chip onClick | | |
|  42 |  `_checkPrereqAutoBlock()` | ✅ ChitEditorViewModel.checkPrereqAutoBlock() | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 7 |
|  43 |  `checkPrereqStatusOverride(newStatus)` | ✅ ChitEditorViewModel.checkPrereqStatusOverride() + AlertDialog | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 7 |

---

### Editor Send-Content / Send-Item

| # | Function | Description | Android Equivalent | Gap File | Resolved By |
|-----|----------|-------------|-------------------|----------|-------------|
|  44 | (send-content feature) | ✅ SendContentSheet composable + ChitEditorViewModel.executeSendContent() | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  45 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  46 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  47 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  48 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  49 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  50 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  51 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  52 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  53 | (send-content feature) | ✅ SendContentSheet composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Task 8 |
|  54 | (send-item feature) | ✅ SendItemPopup + ChitEditorViewModel.executeSendItem() | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  55 | (send-item feature) | ✅ SendItemPopup composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  56 | (send-item feature) | ✅ SendItemPopup composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  57 | (send-item feature) | ✅ SendItemPopup composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  58 | (send-item feature) | ✅ SendItemPopup composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  59 | (send-item feature) | ✅ SendItemPopup composable | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  60 | (send-item feature) | ✅ SendItemPopup spawn-new-chit flow | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  61 | (send-item feature) | ✅ SendItemPopup spawn-new-chit flow | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |
|  62 | (send-item feature) | ✅ SendItemPopup spawn-new-chit flow | | .kiro/specs/calendar-prereqs-send/tasks.md — Tasks 9, 10 |

---

### People Zone (Full Tree, Sharing)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  63 |  `_initPeopleAutocomplete()` | ✅ ChitEditorViewModel.loadContactNames() + PeopleZone | |
|  64 |  `_loadAllContactsForTree()` | ✅ ChitEditorViewModel.loadContactNames() | |
|  65 |  `_loadAllUsersForTree()` | ✅ editorSettings.sharedUsers in ChitEditorScreen | |
|  66 |  `_renderPeopleTree(filter)` | ✅ PeopleZone contactBrowser (ModalBottomSheet) | |
|  67 |  `_addShare(userId, role, displayName)` | ✅ PeopleZone add shared user section | |
|  68 |  `_removeShare(userId)` | ✅ PeopleZone share remove button | |
|  69 |  `_updateShareRole(userId, newRole)` | ✅ PeopleZone role toggle clickable | |
|  70 |  `initPeopleSharingControls(chit)` | ✅ PeopleZone shares parsing (Compose declarative) | |
|  71 |  `_addPeopleChip(data)` | ✅ PeopleZone add person (text field + suggestions) | |
|  72 |  `_removePeopleChip(index)` | ✅ PeopleZone InputChip onClick remove | |
|  73 |  `openPeopleExpandModal()` | ✅ PeopleExpandModal composable + showExpandModal state | | .kiro/specs/editor-zones-parity/tasks.md — Task 1.3 |
|  74 |  `closePeopleExpandModal()` | ✅ PeopleExpandModal onDismiss callback | | .kiro/specs/editor-zones-parity/tasks.md — Task 1.3 |
|  75 |  `_loadSharingUserList()` | ✅ editorSettings.sharedUsers (from settings) | |
|  76 |  `_getUserDisplayName(userId)` | ✅ Inline in PeopleZone (display_name from shares JSON) | |
|  77 |  `getSharingData()` | ✅ ChitEditorViewModel formState (shares, stealth, assignedTo) | |
|  78 |  `hasSharingData(chit)` | ✅ Inline checks (shares.isNullOrBlank) | |

---

### Custom Zones in Editor

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  79 |  `window._customZoneData` | ✅ ChitEditorViewModel.customZones StateFlow + loadCustomZones() | | .kiro/specs/editor-zones-parity/tasks.md — Task 2.2 |
|  80 | (custom zones) | ✅ CustomZonePanel composable (zones/CustomZonePanel.kt) | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 4.1, 4.2 |
|  81 | (custom zones) | ✅ CustomZonePanel typed input fields (integer/decimal/boolean/string) | | .kiro/specs/editor-zones-parity/tasks.md — Task 4.2 |
|  82 | (custom zones) | ✅ CustomZonePanel grouping by sub_type/type with collapsible sub-sections | | .kiro/specs/editor-zones-parity/tasks.md — Task 4.1 |
|  83 | (custom zones) | ✅ health_data JSON merge persistence for custom zones | | .kiro/specs/editor-zones-parity/tasks.md — Task 5.1 |
|  84 | (custom zones) | ✅ CwocApiService.getCustomZones() + getCustomObjectsForZone() | | .kiro/specs/editor-zones-parity/tasks.md — Task 2.1 |

---

### Health Indicators Zone in Editor

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  85 |  `window._healthData` | ✅ formState.healthData in ChitEditorViewModel | |
|  86 |  `window._indicatorObjects` | ✅ ChitEditorViewModel.indicatorObjects StateFlow | |
|  87 |  `_evaluateConditionalDisplay(rule, settings)` | ✅ evaluateConditionalDisplay() in EditorZoneUtils.kt | | .kiro/specs/editor-zones-parity/tasks.md — Task 3.1 |
|  88 |  `_getUnitLabel(obj, unitSystem)` | ✅ resolveUnitLabel() in EditorZoneUtils.kt (metric_units support) | | .kiro/specs/editor-zones-parity/tasks.md — Task 3.2 |
|  89 |  `_getRangeHighlightClass(value, rangeMin, rangeMax)` | ✅ rangeHighlightColor() in EditorZoneUtils.kt | | .kiro/specs/editor-zones-parity/tasks.md — Task 3.3 |
|  90 |  `_fetchIndicatorObjects()` | ✅ ChitEditorViewModel.loadIndicatorObjects() | |
|  91 |  `_renderIndicatorField(obj, value)` | ✅ HealthIndicatorsZone with range highlight + metric_units | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 6.1, 6.2, 6.3 |
|  92 |  `_showAddIndicatorPicker()` | N/A (Android shows all indicators, no picker needed) | |
|  93 |  `_loadHealthData(chit)` | ✅ HealthIndicatorsZone composable (declarative loading) | |
|  94 |  `_gatherHealthData()` | ✅ onHealthDataChange callback (reactive JSON updates) | |

---

### Recurrence Series Summary / Break-Off / Complete Series

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  95 |  `getRecurrenceSeriesInfo(chit, virtualDate)` | ✅ RecurrenceEngine.computeSeriesInfo() + SeriesInfo data class | | .kiro/specs/editor-zones-parity/tasks.md — Task 8.1 |
|  96 | (recurrence series) | ✅ SeriesSummaryUI composable + generateSeriesInstances() | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 9.1, 9.2 |
|  97 | (recurrence series) | ✅ completeSeries() in ChitEditorViewModel + confirmation dialog | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 10.1, 10.2 |
|  98 | (recurrence series) | ✅ breakOffInstance() in ChitEditorViewModel + Break Off UI | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 11.1, 11.2 |
|  99 | (recurrence series) | ✅ shouldAutoArchive() + checkAutoArchive() | | .kiro/specs/editor-zones-parity/tasks.md — Tasks 12.1, 12.2 |

---

### Auto-Complete Checklist → Status

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  100 |  `_autoCompleteChecklistEnabled` | ✅ ChecklistZoneV2 autoCompleteEnabled param | |
|  101 |  `_initAutoCompleteChecklist(chit)` | ✅ ChitEditorScreen autoCompleteChecklist checkbox | |
|  102 |  `_showAutoCompleteBtnIfChild()` | ✅ Always visible checkbox in ChitEditorScreen | |
|  103 |  `_updateAutoCompleteBtn()` | ✅ Compose reactive checkbox state | |
|  104 |  `_evaluateAutoCompleteChecklist()` | ✅ ChecklistZoneV2 LaunchedEffect auto-complete | |

---

### Chit Link Autocomplete

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  105 |  `_checkChitLinkAutocomplete(textarea)` | ✅ NotesZone [[ ]] detection in ChitEditorScreen | |
|  106 |  `_showChitLinkDropdown(textarea, matches)` | ✅ NotesZone chitLinkSuggestions list | |
|  107 |  `_removeChitLinkDropdown()` | ✅ showChitLinkPicker = false | |
|  108 |  `_insertChitLink(textarea, title)` | ✅ NotesZone suggestion click inserts title + ]] | |
|  109 |  `resolveChitLinks(html, allChits)` | ❌ Missing | W109-resolveChitLinks.md |

---

### Notes Fullscreen Modal

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  110 |  `openNotesModal(event)` | ✅ FullEditorModal in ChitEditorScreen | |
|  111 |  `closeNotesModal(save)` | ✅ showFullEditor = false | |
|  112 |  `toggleModalNotesRender()` | ✅ FullEditorModal viewMode (edit/preview/split) | |

---

### Quick Alert Modal

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  113 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  114 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  115 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  116 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  117 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  118 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |
|  119 | (quick alert modal) | ❌ Missing | W113-quickAlertModal.md |

---

### Editor Auto-Save

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  120 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |
|  121 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |
|  122 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |
|  123 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |
|  124 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |
|  125 | (auto-save) | ✅ ChecklistZoneViewModel AutoSaveState machine | |

---

### Export/Import Data

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  126 |  `exportChitData()` | ✅ AdminSettingsTab.kt export wiring | |
|  127 |  `exportUserData()` | ✅ AdminSettingsTab.kt export wiring | |
|  128 |  `exportAllData()` | ✅ AdminSettingsTab.kt export wiring | |

---


## Priority 2: Feature Gaps (❌ Not Implemented — Medium Impact)

Functions not implemented but less critical — nice-to-haves, secondary features, smaller scope items.

---

### Omni View Filter Locking

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  129 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
|  130 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
|  131 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
|  132 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
|  133 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |
|  134 | (omni filter locking) | ❌ Missing | W129-omniFilterLock.md |

---

### Email Nesting

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  135 | (email nesting) | ✅ NestThreadPickerSheet.kt + EmailThreadView.kt + ChitEditorViewModel | |
|  136 | (email nesting) | ✅ NestThreadPickerSheet.kt + EmailThreadView.kt + ChitEditorViewModel | |
|  137 | (email nesting) | ✅ NestThreadPickerSheet.kt + EmailThreadView.kt + ChitEditorViewModel | |
| Editor nest thread picker functions | Email thread nesting | ✅ NestThreadPickerSheet.kt + EmailThreadView.kt + ChitEditorViewModel | |

---

### Email Shift-Select

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  138 |  `_emailShiftSelect(currentCb)` | N/A (web-only — Android uses long-press multi-select) | |
|  139 |  `_emailLastCheckedIndex` | N/A (web-only — Shift+click pattern) | |

---

### Bundle Drag Reorder

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  140 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  141 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  142 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  143 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  144 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  145 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  146 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |
|  147 | (bundle reorder) | ✅ BundleToolbar.kt + BundleViewModel.reorderBundles() | |

---

### Indicators Calendar/Log Modes

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  148 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  149 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  150 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  151 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  152 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  153 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  154 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |
|  155 | (indicators modes) | ✅ IndicatorsScreen Calendar/Log/Charts modes | |

---

### Indicators Drag Reorder

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  156 | (indicators drag reorder) | ❌ Missing | W156-indicatorsDragReorder.md |
|  157 | (indicators drag reorder) | ❌ Missing | W156-indicatorsDragReorder.md |

---

### Custom View Filters (Settings)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  158 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  159 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  160 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  161 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  162 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  163 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |
|  164 | (custom view filters) | ✅ CustomFilterModal in GeneralSettingsTab | |

---

### Weather Navigation Intent

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  165 | (weather nav intent) | ✅ WeatherScreen.kt day block Modifier.clickable → navigate to Calendar Day view with date + location | |
|  166 | (weather nav intent) | ✅ CalendarViewModel.kt weather navigation parameter handling + day view date selection | |
|  167 | (weather nav intent) | ✅ CalendarTimeGrid.kt location-based chit highlighting on weather navigation | |

---

### Habit Rules Integration

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  168 |  `_globalGetHabitCycleEnd(chit)` | N/A (server handles via push) | |
|  169 |  `_globalCheckWeatherNotification(chit, alert, alertIdx)` | N/A (server handles via push) | |

---

### Saved Searches

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  170 | (saved searches) | ❌ Missing | W170-savedSearches.md |
|  171 | (saved searches) | ❌ Missing | W170-savedSearches.md |
|  172 | (saved searches) | ❌ Missing | W170-savedSearches.md |
|  173 | (saved searches) | ❌ Missing | W170-savedSearches.md |

---

### Search Snippets

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  174 |  `_getSearchSnippet(text, terms)` | ❌ Missing | W174-searchSnippets.md |
|  175 |  `_getChitFieldValue(chit, fieldName)` | ❌ Missing | W174-searchSnippets.md |

---

### Map Thumbnails in Editor

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  176 | (map thumbnails) | ✅ StaticMapTile.kt (Mercator tile calculation + AsyncImage) + ChitCardEnhancements.kt LocationIndicator | |
|  177 | (map thumbnails) | ✅ StaticMapTile.kt (pin overlay on tile) + thumbnail visibility logic in chit card composables | |
|  178 | (map thumbnails) | ✅ StaticMapTile.kt (90×60dp sizing, placeholder while loading) | |
|  179 | (map thumbnails) | ✅ ChitCardEnhancements.kt (showMapThumbnails setting check + default location exclusion) | |

---

### Work Hours View

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  180 |  `displayWorkView(chitsToDisplay)` | ✅ CalendarScreen WORK_HOURS mode | |

---

### Editor Location Features

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  181 |  `_fetchWeatherData(address)` | ✅ LocationZone weatherData prop | |
|  182 |  `_displayWeatherInCompactSection(weatherData, address)` | ✅ LocationZone WeatherIndicator (H5) | |
|  183 |  `_displayMapInUI(lat, lon, address)` | ✅ InlineMapPreview.kt (osmdroid MapView in AndroidView, zoom 15, marker at center) + ChitEditorScreen LocationZone integration | |
|  184 |  `loadSavedLocationsDropdown()` | ✅ LocationZone savedLocations dropdown | |
|  185 |  `onSavedLocationSelect()` | ✅ A#1028 (LocationZone dropdown onClick → onLocationChange + geocode + timezone detect) | |
|  186 |  `onAddDefaultLocation(event)` | ✅ ChitEditorScreen LocationZone default location button (reads saved location address, populates field, triggers geocode + weather fetch) | |
|  187 |  `searchLocationMap(event)` | ✅ A#1028, A#1931 (LocationZone Search chip → GeocodingUtil.geocode + coordinates + timezone) | |
|  188 |  `_updateViewInContextBtn()` | N/A (web DOM show/hide — Android uses declarative `enabled` prop on Compose chips) | |

---

### Notes Editor Features

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  189 |  `_notesListContinue(textarea)` | ❌ Missing | W189-notesListContinue.md |
|  190 |  `shrinkNoteToFourLines(event)` | N/A (Android uses expandable text natively) | |

---

### Tasks View Modes

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  191 |  `displayAssignedToMeView(chitsToDisplay)` | ✅ TasksScreen "assigned" mode | |
|  192 |  `_setTasksMode(mode)` | ✅ SidebarStateViewModel.setTasksViewMode() | |
|  193 |  `_tasksViewMode` | ✅ SidebarState.tasksViewMode | |

---

### Calendar Misc

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  194 |  `attachEmptySlotCreate(col, day, defaultDurationMin)` | ✅ CalendarTimeGrid onEmptySlotTap | |
|  195 |  `_addAllDayHeightCap(eventsRow, container)` | ❌ Missing | W195-allDayHeightCap.md |

---

### Editor Date Features

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  196 |  `_snapMinutes` | ✅ Same as W29 (CalendarViewModel.calendarSnap) | |
|  197 |  `_loadSnapSetting()` | ✅ Same as W30 | |
|  198 |  `onPerpetualToggle()` | ❌ Missing (field exists, no UI toggle) | W198-perpetualToggle.md |
|  199 |  `_fmtPerpetualDate()` | ❌ Missing | W198-perpetualToggle.md |
|  200 |  `onHabitResetToggle()` | ✅ HabitsZone ResetPeriodDropdown | |
|  201 |  `_updateResetUnitOptions()` | ✅ HabitsZone FrequencyDropdown | |

---

### Editor Alerts Features

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  202 |  `_applyDefaultNotifications(mode)` | ❌ Missing | W202-applyDefaultNotifications.md |

---

### Omni View Misc

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  203 | (omni misc) | ❌ Missing | W203-omniMisc.md |
|  204 | (omni misc) | ❌ Missing | W203-omniMisc.md |
|  205 | (omni misc) | ❌ Missing | W203-omniMisc.md |
|  206 | (omni misc) | ❌ Missing | W203-omniMisc.md |
|  207 | (omni misc) | ❌ Missing | W203-omniMisc.md |

---

### Email Add-to-Bundle

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  208 |  `_showAddToBundleModal(chit)` | ✅ EmailContextMenu.kt + BundlePickerDialog.kt + AddToBundleSheet + EmailViewModel.addEmailToBundle() | |
|  209 |  `_executeAddToBundle(chit, overlay)` | ✅ EmailContextMenu.kt + BundlePickerDialog.kt + AddToBundleSheet + EmailViewModel.addEmailToBundle() | |

---

### Weather Prefetch

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  210 | (weather prefetch) | N/A (server provides weather_data via sync) | |
|  211 | (weather prefetch) | N/A (server provides weather_data via sync) | |
|  212 | (weather prefetch) | N/A (server provides weather_data via sync) | |
|  213 | (weather prefetch) | N/A (server provides weather_data via sync) | |
|  214 | (weather prefetch) | N/A (server provides weather_data via sync) | |
|  215 | (weather prefetch) | N/A (server provides weather_data via sync) | |

---

### Settings Misc

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  216 |  `updateGrid(preserveOrder)` | ✅ GeneralSettingsTab DragGrid for clocks | |
|  217 |  `setupDragListeners()` | ✅ DragGrid component handles drag | |
|  218 |  `_toggleCombineAlerts()` | ❌ Missing | W218-toggleCombineAlerts.md |
|  219 |  `_loadMapSettings(settings)` | ✅ ViewsSettingsTab map settings section | |
|  220 |  `_collectMapSettings()` | ✅ SettingsViewModel map fields | |
|  221 |  `_openBadgeCustomModal(existing)` | ✅ CustomDetectorsSection + CustomDetectorDialog in BadgesSettingsTab.kt | |
|  222 |  `_saveBadgeCustomDetector()` | ✅ CustomDetectorsSection + CustomDetectorDialog in BadgesSettingsTab.kt | |

---

### Custom Objects Zone Management

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  223 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
|  224 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
|  225 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
|  226 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |
|  227 | (custom objects zone mgmt) | ❌ Missing | W223-customObjectsZoneMgmt.md |

---

### Attachments Multi-Select

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  228 |  `handleSelect(idx, e)` | ✅ AttachmentsViewModel.enterMultiSelectMode() + toggleSelection() + exitMultiSelectMode() + AttachmentsScreen long-press/tap/toolbar UI | W228-attachmentMultiSelect.md |
|  229 |  `bulkDelete()` | ✅ AttachmentsViewModel.bulkDelete() + AttachmentsScreen delete confirmation dialog | W228-attachmentMultiSelect.md |

---

### User Admin

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  230 | (password management) | ✅ PasswordChangeZone() in ContactEditorScreen.kt | |
|  231 | (password management) | ✅ PasswordChangeZone() in ContactEditorScreen.kt | |
|  232 | (password management) | ✅ PasswordChangeZone() in ContactEditorScreen.kt | |

---

### Misc Smaller Gaps

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  233 | (recent tags) | ❌ Missing | W233-recentTags.md |
|  234 | (recent tags) | ❌ Missing | W233-recentTags.md |
|  235 | (recent tags) | ❌ Missing | W233-recentTags.md |
|  236 | (highlight match) | N/A (web HTML markup — Android uses Compose AnnotatedString) | |
|  237 | (highlight match) | N/A (web HTML markup — Android uses Compose AnnotatedString) | |
|  238 | (highlight match) | N/A (web HTML markup — Android uses Compose AnnotatedString) | |
|  239 |  `_detectTimezoneFromCoords(lat, lon, country)` | ✅ TimezonePickerModal.detectTimezoneFromCoords() | |
|  240 |  `_getUserRsvpStatus(chit)` | ❌ Missing | W240-rsvpStatus.md |
|  241 |  `_isDeclinedByCurrentUser(chit)` | ❌ Missing | W240-rsvpStatus.md |
|  242 |  `_showProjectQuickMenu(e, project)` | ❌ Missing (no project context menu) | W242-projectQuickMenu.md |
|  243 |  `moveChildChitToProject(childChitId, targetProjectId)` | ❌ Missing | W242-projectQuickMenu.md |
|  244 |  `_checkPendingDeleteUndo()` | N/A (Android handles via UndoToast lifecycle) | |
|  245 |  `_weekViewDayOffset` | ❌ Missing | W245-weekViewDayOffset.md |
|  246 |  `_renderMobileOverview(container)` | N/A (web mobile-specific — Android has native zone nav) | |
|  247 |  `_pasteClipboardAsChecklistItems(checklist)` | ❌ Missing | W247-checklistClipboard.md |
|  248 |  `_copyIncompleteToClipboard(checklist)` | ❌ Missing | W247-checklistClipboard.md |
|  249 |  `closeImportModal()` | ✅ ContactListScreen import handling | |
|  250 |  `_describeCron(expr)` | ❌ Missing | W250-cronExpression.md |
|  251 |  `_assembleCronExpression()` | ❌ Missing | W250-cronExpression.md |
|  252 |  `_validateCronExpression(expr)` | ❌ Missing | W250-cronExpression.md |
|  253 |  `_wxIsExtreme(highC, lowC, weatherCode)` | ✅ WeatherViewModel.kt isExtreme() — highC≥35 OR lowC≤-18 OR weatherCode∈{95,96,99}; red border on extreme days | |
|  254 |  `_wxInitBlockClick(container)` | ✅ WeatherScreen.kt DailyForecastRow Modifier.clickable → navigate to Calendar Day view (same as W165) | |
|  255 |  `_wxInitDragDrop(container)` | ✅ WeatherViewModel.kt reorderLocations() + WeatherScreen.kt long-press drag-to-reorder with ReorderableList | |

---


## Priority 3: Implemented ✅

Functions that already have Android equivalents, grouped by functional area.

---

### Auth & Settings

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  256 |  `getCurrentUser()` | ✅ A#241 (AuthRepository.fetchUserProfile + userId/displayName StateFlows) | |
|  257 |  `isAdmin()` | ✅ SettingsViewModel.isAdmin StateFlow (reads SharedPreferences "is_admin") | |
|  258 |  `waitForAuth()` | ✅ A#244 (AuthRepository.isAuthenticated — synchronous check, Compose reactive navigation) | |
|  259 |  `getCachedSettings()` | ✅ A#313 (SettingsRepository.get + settings Flow — Room DB cache, synced from server) | |
|  260 |  `_invalidateSettingsCache()` | ✅ A#314 (SettingsRepository.replaceWithServerVersion — sync overwrites local cache) | |
|  261 |  `_populateTimezoneDatalist()` | ✅ A#662 (TimezonePickerModal — ZoneId.getAvailableZoneIds + searchable list) | |
|  262 |  `renderLocationsSection(locations)` | ✅ A#1711 (SavedLocationsSection — LocationRow with default radio, edit, delete) | |
|  263 |  `addLocationRow()` | ✅ A#1711 (SavedLocationsSection "Add Location" button → LocationEditDialog) | |
|  264 |  `collectLocationsData()` | ✅ A#1724 (serializeLocationsJson — collects LocationItem list to JSON for save) | |
|  265 |  `loadColors()` | ✅ A#1704 (CustomColorsSection + parseColorsJson — reads custom_colors from settings) | |
|  266 |  `openColorPicker()` | ✅ A#1702 (ColorEditDialog — hex input dialog for adding custom colors) | |
|  267 |  `saveColors(colors)` | ✅ A#1723 (serializeColorsJson → onColorsChanged → SettingsViewModel.updateSetting) | |
|  268 |  `addColor(newColor)` | ✅ A#1702 (ColorEditDialog confirm → appends to list → onColorsChanged) | |
|  269 |  `deleteColor(hex, name)` | ✅ A#1702 (ColorEditDialog onDelete → removes from list → onColorsChanged) | |
|  270 |  `renderColors(colors)` | ✅ A#1704 (CustomColorsSection — FlowRow of ColorSwatchWithBorderIndicator) | |
|  271 |  `handleTagInput(event)` | ✅ A#1712 (TagEditorSection "Add Tag" button → EnhancedTagEditDialog with reserved prefix check) | |
|  272 |  `addTag()` | ✅ A#1712 (TagEditorSection "Add Tag" → EnhancedTagEditDialog → appends to tag list) | |
|  273 |  `openTagModal(tag)` | ✅ A#1706 (EnhancedTagEditDialog in edit mode — shows tag properties for editing) | |
|  274 |  `saveTag()` | ✅ A#1706 (EnhancedTagEditDialog onConfirm → updates tag list → serializeTagsJson) | |
|  275 |  `deleteTag()` | ✅ A#1712 (TagEditorSection delete confirmation → removeAt → onTagsChanged) | |
|  276 |  `_renderSettingsTagTree()` | ✅ A#1714 (buildTagTree) + A#1713 (TagTreeNodeRow — hierarchical with expand/collapse, edit, delete) | |
|  277 |  `_switchSettingsTab(tabId)` | ✅ A#1755 (SettingsScreen ScrollableTabRow + selectedTabIndex state) | |
|  278 |  `saveSettings()` | ✅ A#1776 (SettingsViewModel.saveAndExit — validates, saves, navigates back) | |
|  279 |  `saveSettingsAndStay()` | ✅ A#1777 (SettingsViewModel.saveAndStay — saves without navigating) | |
|  280 |  `cancelSettings()` | ✅ A#1755 (SettingsScreen BackHandler + unsaved changes AlertDialog) | |
|  281 |  `_initPillToggle(pillId, hiddenInputId)` | N/A (web DOM event wiring — Android uses Compose state for toggles directly) | |
|  282 |  `SettingsService.loadAll()` | ✅ A#1767 (SettingsViewModel.loadSettings — reads from Room via settingsRepository.get) | |
|  283 |  `SettingsService.saveAll(settings)` | ✅ A#1775 (SettingsViewModel.save — validates, maps to entity, repository.update triggers push) | |
|  284 |  `SettingsManager.initialize()` | ✅ A#1767 (SettingsViewModel.loadSettings + mapEntityToFormState → Compose UI) | |
|  285 |  `SettingsManager.gatherSettings()` | ✅ A#1756 (SettingsViewModel.buildSavePayload + mapFormStateToEntity) | |
|  286 |  `SettingsManager.save()` | ✅ A#1775 (SettingsViewModel.save — validates, gathers, persists, triggers sync) | |
|  287 |  `_openArrangeViewsModal()` | ✅ A#550 (ArrangeViewsDialog — parses viewOrder, shows visible/hidden entries) | |
|  288 |  `_closeArrangeViewsModal()` | ✅ A#550 (ArrangeViewsDialog onDismiss callback) | |
|  289 |  `_resetViewOrder()` | ✅ A#550 (ArrangeViewsDialog "Reset" button → DEFAULT_VIEW_ORDER) | |
|  290 |  `_renderArrangeViewsGrid()` | ✅ A#549, A#551, A#552 (ArrangeViewRow + HiddenViewRow + OmniFixedRow) | |
|  291 |  `_resetSortOrders()` | ✅ A#1773 (SettingsViewModel.resetSortOrders — API DELETE + clears local prefs) | |
|  292 |  `_initBadgesSettings()` | ✅ A#1691 (BadgesSettingsTab — parses badge config, renders display/built-in/custom sections) | |
|  293 |  `_renderBadgeCategories()` | ✅ A#1692 (BuiltInDetectorsSection — groups detectors by category with toggles) | |
|  294 |  `_onBadgeCategoryToggle(e)` | ✅ A#1692 (BuiltInDetectorsSection category toggle → updates detectors JSON) | |
|  295 |  `_onBadgeDetectorToggle(e)` | ✅ A#1698 (updateDetectorEnabled — toggles individual detector enabled state) | |
|  296 |  `_renderBadgeCustomList()` | ✅ A#1694 (CustomDetectorsSection — renders custom detectors with edit/delete/toggle) | |
|  297 |  `_gatherBadgesConfig()` | ✅ A#1697 (serializeBadgeDetectorsJson — serializes detector config to JSON) | |

---

### Chit CRUD & Editor

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  298 |  `chitId` | ✅ ChitEditorViewModel.chitId (from SavedStateHandle) | |
|  299 |  `currentWeatherLat` | ✅ LocationZone geocodeResult.lat (local Compose state from geocoding) | |
|  300 |  `currentWeatherLon` | ✅ LocationZone geocodeResult.lon (local Compose state from geocoding) | |
|  301 |  `currentWeatherData` | ✅ ChitEntity.weatherData (server-provided, displayed via WeatherIndicator) | |
|  302 |  `defaultColors` | ✅ ColorZone.kt DEFAULT_COLOR_PALETTE (includes "transparent" + color palette) | |
|  303 |  `_onChecklistChange()` | ✅ ChecklistZoneV2 onChecklistChange callback + ChecklistZoneViewModel auto-save | |
|  304 |  `userTimezoneOffset` | ✅ ZoneId.systemDefault() (Java time API handles timezone natively) | |
|  305 |  `_convertDBDateToDisplayDate(dateString)` | ✅ DateUtils.formatDisplayDate (parses ISO → local display format) | |
|  306 |  `_initializeChitId()` | ✅ ChitEditorViewModel init (reads chitId from SavedStateHandle, generates UUID if new) | |
|  307 |  `toggleZone(event, sectionId, contentId)` | ✅ EditorZoneHeader onToggle (clickable header toggles isExpanded state) | |
|  308 |  `resetEditorForNewChit()` | ✅ ChitEditorViewModel init with isNew=true (empty ChitFormState defaults) | |
|  309 |  `loadChitData(chitId)` | ✅ A#1056 (ChitEditorViewModel.loadExistingChit — Room DB → toFormState) | |
|  310 |  `applyZoneStates(chit)` | ✅ Each zone composable initializes isExpanded based on field data (declarative) | |
|  311 |  `createISODateTimeString(dateStr, timeStr, isAllDay, isEnd)` | ✅ DateZone LocalDateTime.of(date, time).format(ISO_LOCAL_DATETIME_FORMATTER) | |
|  312 |  `convertMonthFormat(dateStr)` | N/A (web-specific month name→number conversion — Android uses java.time LocalDate natively) | |
|  313 |  `buildChitObject()` | ✅ ChitFormState (reactive state) + ChitFormState.toEntity() for save | |
|  314 |  `_showInstanceBanner(dateStr)` | ❌ Missing (part of recurrence instance editing — see W095) | W095-recurrenceSeriesInfo.md |
|  315 |  `_saveInstanceException(dateStr)` | ❌ Missing (part of recurrence instance editing — see W095) | W095-recurrenceSeriesInfo.md |
|  316 |  `saveChitData()` | ✅ A#1065 (ChitEditorViewModel.save — toEntity, Room upsert, dirty track, push sync) | |
|  317 |  `saveChit()` | ✅ A#1066 (ChitEditorViewModel.saveAndExit — calls save + navigates back) | |
|  318 |  `saveChitAndStay()` | ✅ A#1067 (ChitEditorViewModel.saveAndStay — saves without triggering navigation) | |
|  319 |  `deleteChit()` | ✅ A#1047 (ChitEditorViewModel.deleteChit — soft delete + dirty track + push) | |
|  320 |  `performDeleteChit()` | ✅ A#1047 (same as W319 — Android combines confirm + delete in one flow) | |
|  321 |  `setSaveButtonSaved()` | ✅ ChitEditorViewModel._savedState = form (isDirty becomes false reactively) | |
|  322 |  `cancelOrExit()` | ✅ A#1060 (ChitEditorViewModel.onBackPressed — dirty check → unsaved dialog) | |
|  323 |  `markEditorUnsaved()` | ✅ ChitEditorViewModel.updateForm (isDirty auto-computed from formState != savedState) | |
|  324 |  `markEditorSaved()` | ✅ ChitEditorViewModel save() sets _savedState = form (isDirty → false) | |
|  325 |  `togglePinned()` | ✅ ChitEditorScreen isPinned state + ChitRepository.pin/unpin | |
|  326 |  `toggleArchived()` | ✅ ChitEditorScreen isArchived state + ChitRepository.archive/unarchive | |
|  327 |  `_showQRCode(e)` | ✅ ChitEditorScreen showQrDialog + ChitQrCodeDialog (link/data toggle) | |
|  328 |  `cwocToggleZone(event, sectionId, contentId)` | ✅ EditorZoneHeader onToggle (same as W307 — shared zone expand/collapse) | |
|  329 |  `CwocEditorSaveSystem` | ✅ ChitEditorViewModel isDirty + unsaved dialog (reactive dirty tracking) | |
|  330 |  `CwocSaveSystem` | ✅ SettingsViewModel isDirty + save + unsaved changes dialog pattern | |
|  331 |  `CwocSaveSystem.hasChanges()` | ✅ SettingsViewModel.isDirty StateFlow (computed from settings != savedSnapshot) | |
|  332 |  `CwocSaveSystem.markSaved()` | ✅ SettingsViewModel save sets _savedSnapshot = formState (isDirty → false) | |
|  333 |  `CwocSaveSystem.markUnsaved()` | ✅ SettingsViewModel.updateSetting changes formState (isDirty auto-computed) | |
|  334 |  `CwocSaveSystem.cancelOrExit()` | ✅ SettingsScreen BackHandler + unsaved changes AlertDialog (same as W280) | |
|  335 |  `_fetchCustomColors()` | ✅ A#1055 (ChitEditorViewModel.loadEditorSettings extracts customColors from settings) | |
|  336 |  `_setColor(hex, name)` | ✅ ColorZone.onColorSelected callback → updateForm(formState.copy(color = hex)) | |
|  337 |  `_updateColorPreview()` | N/A (web DOM sync — Android Compose renders reactively from selectedColor state) | |
|  338 |  `_renderCustomColors(customColors)` | ✅ ColorZone FlowRow renders customColors as ColorSwatch composables | |
|  339 |  `_attachColorSwatchListeners()` | N/A (web DOM event wiring — Compose uses onClick directly on ColorSwatch) | |
|  340 |  `initEmailZone(chit)` | ✅ A#1291 (EmailComposeViewModel.initializeForChit — loads chit, populates email fields) | |
|  341 |  `getEmailData()` | ✅ EmailComposeViewModel state (to/cc/bcc/body/subject StateFlows → ChitFormState email fields) | |
|  342 |  `hasEmailData(chit)` | ✅ ChitEditorScreen checks formState.emailStatus for email zone visibility | |
|  343 |  `_emailReply()` | ✅ A#1376 (EmailViewModel.createReply — Re: prefix, quoted body, in_reply_to) | |
|  344 |  `_emailForward()` | ✅ EmailViewModel.createForward (Fwd: prefix, quoted body, existing draft check) | |
|  345 |  `_emailSend()` | ✅ A#1292 (EmailComposeViewModel.initiateSend — validates, saves, starts undo countdown) | |
|  346 |  `_emailSendLater()` | ✅ A#1297 (EmailComposeViewModel.scheduleSend + SendLaterModal date/time picker) | |
|  347 |  `_emailCancelScheduled()` | ✅ A#1279 (EmailComposeViewModel.cancelSchedule — clears send_at via API) | |
|  348 |  `_emailLoadExternalContent()` | ✅ HtmlEmailRenderer ExternalContentBanner + externalContentLoaded state | |
|  349 |  `_emailUndoSendCountdown(chitId, archiveOriginal)` | ✅ A#1299 (EmailComposeViewModel.startSendCountdown — countdown with undo) | |
|  350 |  `_emailDoActualSend(chitId, archiveOriginal)` | ✅ A#1298 (EmailComposeViewModel.sendAndArchive — POST /api/email/send) | |
|  351 |  `_setEmailZoneReadOnly(readOnly)` | ✅ A#1189, A#1191 (ReceivedEmailContent/SentEmailContent — separate read-only composables) | |
|  352 |  `_fetchEmailThread(chitId)` | ✅ A#1362 (EmailThreadViewInEditor — receives thread messages from ViewModel) | |
|  353 |  `_renderEmailThread(thread, currentId)` | ✅ A#1362, A#1366 (EmailThreadViewInEditor + buildThreadDisplayItems) | |
|  354 |  `toggleEmailViewMode(event)` | ✅ EmailComposeZone showRenderMode toggle + MarkdownPreviewBox (A#1311) | |
|  355 |  `_activateEmailZone()` | ✅ ChitEditorScreen "Make Email" → formState.copy(emailStatus = "draft") → zone visible | |
|  356 |  `_deactivateEmailZone()` | ✅ ChitEditorScreen email discard → formState.copy(emailStatus = null) → zone hidden | |
|  357 |  `_initSnoozeControls(chit)` | ✅ ChitEditorScreen snooze action + SnoozePickerDialog (A#652) | |
|  358 |  `_renderSnoozeState(chit)` | ✅ A#566 (ArchiveSnoozeIndicators) + editor sidebar snooze label | |
|  359 |  `_snoozeChit(duration)` | ✅ A#274 (ChitRepository.snooze — sets snoozed_until, marks dirty, pushes) | |
|  360 |  `_doUnsnooze()` | ✅ A#278 (ChitRepository.unsnooze — clears snoozed_until) | |
|  361 |  `initSmartLinkRegistry(config)` | ✅ A#497 (SmartLinkDetector — static registry, maxBadges param; per-detector disable not wired) | |
|  362 |  `detectSmartLinks(chit, options)` | ✅ A#497 (SmartLinkDetector.detect — runs patterns against body text) | |
|  363 |  `detectSmartLinkFirst(chit)` | ✅ A#497 (SmartLinkDetector.detect with maxBadges=1 equivalent) | |
| Editor-tags zone functions | Tag management in editor | ✅ TagsPickerSheet + ChitEditorViewModel tag operations | |
| Editor-attachments functions | File attachment management | ✅ AttachmentsZone composable + AttachmentManager | |
| Editor-email-pgp functions | Email PGP operations | ✅ A#490-496 (PgpManager) + A#1300 (togglePgp) + A#1312-1314 (PGP UI) | |

---

### Calendar

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  364 |  `getCalendarDateInfo(chit)` | ✅ A#883 (CalendarTimeGrid.getCalendarDateInfoForEvent — same priority/duration logic) | |
|  365 |  `chitMatchesDay(chit, day)` | ✅ CalendarTimeGrid.eventMatchesDay (same overlap logic: start ≤ dayEnd && end ≥ dayStart) | |
|  366 |  `calendarEventTitle(chit, isDueOnly, info, settings, context)` | ✅ A#869, A#871 (EventCard title + buildTimeText + indicator icons in Compose) | |
|  367 |  `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` | ✅ A#873 (AllDayEventChip in collapsible all-day row above time grid) | |
|  368 |  `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` | ❌ Missing (part of recurrence series editing — see W095) | W095-recurrenceSeriesInfo.md |
|  369 |  `getWeekStart(date)` | ✅ CalendarViewModel.getDateRange WEEK mode (hardcodes Monday — doesn't respect weekStartDay setting) | |
|  370 |  `getMonthStart(date)` | ✅ CalendarViewModel.getDateRange MONTH mode (date.withDayOfMonth(1)) | |
|  371 |  `getYearStart(date)` | ✅ CalendarViewModel.getDateRange YEAR mode (LocalDate.of(date.year, 1, 1)) | |
|  372 |  `formatDate(date)` | ✅ CalendarTimeGrid day.dayOfWeek.name.take(3) + dayOfMonth for headers | |
|  373 |  `formatWeekRange(start, end)` | ✅ CalendarViewModel headerText for WEEK mode ("MMM d – MMM d, yyyy") | |
|  374 |  `chitColor(chit)` | ✅ A#872 (CalendarScreen.parseColor) + A#570 (Modifier.chitColorBorder) — fallback to default | |
|  375 |  `changePeriod()` | ✅ A#899 (CalendarViewModel.setViewMode — switches mode, reloads events) | |
|  376 |  `goToToday()` | ✅ A#889 (CalendarViewModel.goToToday — sets selectedDate to now, reloads) | |
|  377 |  `previousPeriod()` | ✅ A#896 (CalendarViewModel.previousPeriod — moves back by day/week/month/year per mode) | |
|  378 |  `nextPeriod()` | ✅ A#891 (CalendarViewModel.nextPeriod — moves forward by day/week/month/year per mode) | |
|  379 |  `updateDateRange()` | ✅ CalendarViewModel.uiState.headerText (computed reactively from viewMode + selectedDate) | |
|  380 |  `openChitForEdit(chit)` | ✅ navController.navigate(Screen.ChitEditor.createRoute(chitId)) — standard navigation | |
|  381 |  `attachCalendarChitEvents(el, chit)` | N/A (web DOM event wiring — Android uses Compose onClick/onLongClick on event cards) | |
|  382 |  `displayWeekView(chitsToDisplay, opts)` | ✅ A#868 (CalendarScreen WEEK mode → CalendarTimeGrid with day columns) | |
|  383 |  `displayMonthView(chitsToDisplay)` | ✅ A#862 (CalendarMonthView.MonthView — grid with day cells and events) | |
|  384 |  `displayItineraryView(chitsToDisplay)` | ✅ A#857 (CalendarItineraryView.ItineraryView — grouped by day with event cards) | |
|  385 |  `displayDayView(chitsToDisplay, opts)` | ✅ A#868 (CalendarScreen DAY mode → CalendarTimeGrid with single day column) | |
|  386 |  `displayYearView(chitsToDisplay)` | ✅ A#911 (CalendarYearView.YearView — 12 mini month grids) | |
|  387 |  `scrollToSixAM()` | ✅ CalendarTimeGrid scrollToHour param + LaunchedEffect auto-scroll | |
|  388 |  `renderTimeBar(viewType)` | ✅ CalendarTimeGrid currentTime state + Canvas drawLine (updates every minute) | |
|  389 |  `displaySevenDayView(chitsToDisplay, opts)` | ✅ A#904 (CalendarXDayView.XDayView — configurable day count columns) | |
|  390 |  `_getResponsiveDayCount()` | ✅ CalendarViewModel.uiState.xDayCount (from settings, default 7) | |
|  391 |  `changeView()` | ✅ A#899 (CalendarViewModel.setViewMode — same as W375 changePeriod) | |
|  392 |  `toggleAllDay()` | ✅ DateZone onAllDayChange + "All Day" button (auto-default, auto-uncheck on time pick) | |
|  393 |  `currentWeekStart` | ✅ CalendarViewModel.uiState.selectedDate (base date for all view calculations) | |
|  394 |  `currentView` | ✅ CalendarViewModel.uiState.viewMode (CalendarViewMode enum) | |
|  395 |  `_applyEnabledPeriods()` | ⚠️ Partial — setting stored but TimePeriodDropdown shows all periods without filtering | W395-applyEnabledPeriods.md |

---

### Tasks / Checklists / Notes / Projects

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  396 |  `displayTasksView(chitsToDisplay)` | ✅ A#1853 (TasksScreen — filters by status, renders TaskCard with status dropdown) | |
|  397 |  `displayChecklistView(chitsToDisplay)` | ✅ A#918 (ChecklistsScreen — filters chits with checklists, inline toggle, progress) | |
|  398 |  `displayNotesView(chitsToDisplay)` | ✅ A#1541 (NotesScreen — masonry-style note cards with markdown preview) | |
|  399 |  `displayNotebookView(chitsToDisplay)` | ✅ A#1530 (NotebookScreen — combined notes+checklists view) | |
|  400 |  `_setProjectsMode(mode)` | ✅ SidebarStateViewModel.setProjectsViewMode (kanban/list toggle) | |
|  401 |  `_projectQuickCreateChild(project)` | ✅ A#1621 (ProjectsViewModel.createChildChit — prompt title, create, add to project) | |
|  402 |  `displayProjectsView(chitsToDisplay)` | ✅ A#1620 (ProjectsScreen — kanban or list mode based on projectsMode) | |
|  403 |  `_kanbanState` | ✅ A#1614 (KanbanColumn.groupByKanbanStatus — groups children by status into columns) | |
|  404 |  `displayKanbanView(chitsToDisplay)` | ✅ A#1617, A#1618 (KanbanBoard + KanbanColumnView — status columns with child cards) | |
|  405 |  `renderChecklistItemMarkdown(span, text)` | ❌ Missing (Android shows plain text in checklist items, no inline markdown rendering) | W405-checklistItemMarkdown.md |
|  406 |  `toggleChecklistItem(chitId, itemIndex, newChecked)` | ✅ A#922 (ChecklistsViewModel.toggleItem — toggles, persists, marks dirty) | |
|  407 |  `moveChecklistItem(chitId, fromIndex, toIndex)` | ✅ A#921 (ChecklistsViewModel.reorderItem — reorders and persists) | |
|  408 |  `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | ✅ ChecklistZoneV2 onSendItemsToChit callback (sends items to another chit) | |
|  409 |  `renderInlineChecklist(container, chit, onUpdate)` | ✅ A#916, A#917 (ChecklistChitCard + ChecklistItemRow — inline toggle on dashboard) | |
|  410 |  `_updateChecklistProgressCount(container, chit)` | ✅ A#567, A#578 (ChecklistProgressBadge + countChecklistItems) | |
|  411 |  `MAX_INDENT_LEVEL` | ✅ ChecklistOperationsV2.MAX_INDENT_LEVEL = 4 (same value) | |
|  412 |  `Checklist.constructor(container, initialItems, onChangeCallback)` | ✅ A#1113 (ChecklistZoneV2 + ChecklistZoneViewModel — receives json, manages state) | |
|  413 |  `Checklist.loadItems(itemsArray)` | ✅ A#1133 (ChecklistZoneViewModel.loadItems — parses JSON into items list) | |
|  414 |  `Checklist.getChecklistData()` | ✅ A#459 (ChecklistOperationsV2.serialize — items list to JSON string) | |
|  415 |  `Checklist.addNewItem(text, level, checked, id)` | ✅ A#1116 (ChecklistZoneViewModel.addItem) | |
|  416 |  `Checklist.render()` | ✅ A#1113 (ChecklistZoneV2 Compose rendering from ViewModel items state) | |
|  417 |  `Checklist.startEditing(item, textSpan, clickEvent)` | ✅ A#1110 (ChecklistItemRowV2 — tap text to enter inline edit mode) | |
|  418 |  `Checklist.toggleCheck(item, checked)` | ✅ A#461 (ChecklistOperationsV2.toggleCheck) | |
|  419 |  `Checklist.deleteItem(item, element)` | ✅ A#1125 (ChecklistZoneViewModel.deleteItem) | |
|  420 |  `Checklist.getSubtree(item)` | ✅ A#447 (ChecklistOperationsV2.getSubtree) | |
|  421 |  `Checklist.clearCheckedItems()` | ✅ A#1121 (ChecklistZoneViewModel.clearCheckedItems) | |
|  422 |  `Checklist._showUndoCountdown(removedItems, label)` | ✅ ChecklistZoneV2 UndoToast + ChecklistZoneViewModel undo stack | |
|  423 |  `initializeProjectZone(projectChitId)` | ✅ ProjectsZone composable in ChitEditorScreen (loads child summaries, renders kanban) | |
|  424 |  `renderChildChitsByStatus()` | ✅ ProjectsZone renders childChitSummaries grouped by KanbanStatus columns | |
|  425 |  `updateChitStatus(chitId, newStatus)` | ✅ A#1071 (ChitEditorViewModel.updateChildChitStatus) | |
|  426 |  `createChildChitCard(chit)` | ✅ ProjectsZone child chit card rendering (title + status chip) | |
|  427 |  `fetchProjectMasters()` | ✅ ProjectsViewModel loads project masters from Room (isProjectMaster filter) | |
|  428 |  `saveProjectChanges()` | ✅ ChitEditorViewModel.save includes formState.childChits in entity persistence | |
|  429 |  `openAddChitModal()` | ⚠️ Partial — ProjectsZone has "Pick Chit" button but onPickChit not wired (only manual ID entry works) | W429-openAddChitModal.md |
|  430 |  `addChildChit(chit)` | ✅ ProjectsZone manual ID text field → appends to childChits list | |
|  431 |  `createNewChildChit(event)` | ⚠️ Partial — ProjectsZone has "Create New" button but onCreateNewChild not wired | W429-openAddChitModal.md |
|  432 |  `toggleProjectMaster()` | ✅ ProjectsZone "Project Master" Switch → onProjectMasterChange | |
|  433 |  `loadProjectData(projectChitId)` | ✅ A#1053 (ChitEditorViewModel.loadChildChitSummaries — loads child chit data from Room) | |
|  434 |  `autoGrowNote(el)` | N/A (web textarea auto-resize — Android TextField grows natively in Compose) | |
|  435 |  `toggleNotesViewMode(event)` | ✅ NotesZone showPreview state toggle (edit ↔ rendered markdown) | |
|  436 |  `copyNotesToClipboard(event, source)` | ✅ NotesZone "Copy" AssistChip → ClipboardManager.setPrimaryClip | |
|  437 |  `downloadNotes(event, source)` | ✅ NotesZone "Send" AssistChip → Intent.createChooser (share/export note) | |

---

### Alerts & Notifications

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  438 |  `_setAlarmsMode(mode)` | ✅ A#764 (AlertsViewModel.setMode — switches between list/independent/notifications/reminders) | |
|  439 |  `_fetchIndependentAlerts()` | ✅ A#319 (StandaloneAlertRepository.fetchAndCache — fetches from API, caches in Room) | |
|  440 |  `_createIndependentAlert(alertData)` | ✅ A#317 (StandaloneAlertRepository.create) + A#742-744 (createAlarm/Timer/Stopwatch) | |
|  441 |  `_updateIndependentAlert(id, alertData)` | ✅ A#322 (StandaloneAlertRepository.update) | |
|  442 |  `_deleteIndependentAlert(id)` | ✅ A#748 (AlertsViewModel.deleteStandaloneAlert) | |
|  443 |  `displayAlarmsView(chitsToDisplay)` | ✅ A#734 (AlertsScreen — renders alarms/notifications/reminders/independent modes) | |
|  444 |  `_displayIndependentAlertsBoard()` | ✅ A#734 (AlertsScreen independent mode — renders alarm/timer/stopwatch cards) | |
|  445 |  `_addIndependentAlert(type)` | ✅ A#742, A#743, A#744 (AlertsViewModel.createAlarm/Stopwatch/Timer) | |
|  446 |  `_buildIndependentCard(id, type, data)` | ✅ IndependentAlertsBoard dispatches to IndependentAlarmCard/TimerCard/StopwatchCard by type | |
|  447 |  `_parseTimeInput(str)` | N/A (Android uses native TimePickerDialog — returns structured hour/minute, no string parsing needed) | |
|  448 |  `_buildSaAlarmCard(card, id, data)` | ✅ IndependentAlarmCard (name, time picker, day checkboxes, on/off toggle, delete) | |
|  449 |  `_saFmtTimer(s, tenths)` | ✅ IndependentTimerCard.formatRemainingTime (HH:MM:SS.T format) | |
|  450 |  `_buildSaTimerCard(card, id, data)` | ✅ IndependentTimerCard (name, countdown, start/pause/reset, duration editor, progress bar) | |
|  451 |  `_saSwFmt(ms)` | ✅ StopwatchRuntime.formatElapsed (HH:MM:SS.cc format — same as web) | |
|  452 |  `_buildSaStopwatchCard(card, id, data)` | ✅ IndependentStopwatchCard (name, elapsed time, start/pause/lap/reset, laps list) | |
|  453 |  `_renderSaLaps(container, laps)` | ✅ IndependentStopwatchCard laps list (Column of monospace Text items) | |
|  454 |  `_alarmsViewMode` | ✅ AlertsViewModel._selectedMode StateFlow | |
|  455 |  `_loadAlertStates()` | ✅ AlertsViewModel startChitsCollection + startIndependentCollection (loads from Room) | |
|  456 |  `_persistDismiss(alertKey)` | ✅ AlertsViewModel dismiss actions (archive/complete/delete) | |
|  457 |  `_persistSnooze(snoozeKey, untilTs)` | ✅ A#765 (AlertsViewModel.snoozeNotification) | |
|  458 |  `_globalFmtTime(time24)` | ✅ DateUtils.formatDisplayTime (12h/24h formatting) | |
|  459 |  `_globalPlayAlarm()` | ✅ A#532 (AlarmSoundPlayer.playLooping) + A#731 (AlarmFiredActivity.startAlarmSound) | |
|  460 |  `_globalStopAlarm()` | ✅ A#533 (AlarmSoundPlayer.stop) + A#733 (AlarmFiredActivity.stopAlarm) | |
|  461 |  `_globalPlayTimer()` | ✅ A#548 (TimerNotificationHelper.fireTimerCompleteNotification) | |
|  462 |  `_globalStopTimer()` | ✅ Timer notification dismissal (system notification cancel) | |
|  463 |  `_globalDayAbbr(date)` | ✅ Kotlin DayOfWeek formatting (standard java.time API) | |
|  464 |  `_showGlobalToast(emoji, label, chitTitle, chitId, onDismiss)` | ✅ AlarmFiredActivity (full-screen alarm) + system notifications via NotificationScheduler | |
|  465 |  `_showAlertModal(opts)` | ✅ A#728 (AlarmFiredActivity — full-screen alarm with title, dismiss, snooze, open chit) | |
|  466 |  `_dismissAlertModal(overlay, onDismiss)` | ✅ AlarmFiredActivity onDismiss → stopAlarm() + finish() (closes activity) | |
|  467 |  `_showTimerDoneModal(timerName, onDismiss)` | ✅ A#548 (TimerNotificationHelper.fireTimerCompleteNotification — system notification) | |
|  468 |  `_sendBrowserNotification(title, body, chitId, playSound)` | ✅ AlarmReceiver + NotificationCompat.Builder (Android system notifications) | |
|  469 |  `_globalCheckAlarms()` | ✅ A#547 (NotificationScheduler.scheduleExactAlarm — OS fires at exact time via AlarmManager) | |
|  470 |  `_globalCheckNotifications()` | ✅ A#546 (NotificationScheduler.scheduleAlarms — calculates fire time, OS triggers via AlarmManager) | |
|  471 |  `_getSnoozeMs()` | ✅ AlarmFiredActivity snooze duration (from settings snooze_length, passed as minutes param) | |
|  472 |  `_startGlobalAlertSystem()` | ✅ A#545 (NotificationScheduler.rescheduleAll — schedules all alarms after sync/boot) | |
|  473 |  `window._alertsData` | ✅ AlertsZone.parseAlertsJson (A#1093) — parses alerts JSON into typed AlertItem list | |
|  474 |  `_stopwatchIntervals` | ✅ StopwatchRuntime.tickJob (coroutine-based 50ms tick, equivalent to setInterval) | |
|  475 |  `_loadEditorTimeFormat()` | ✅ A#1055 (ChitEditorViewModel.loadEditorSettings → EditorSettings.timeFormat) | |
|  476 |  `_fmtAlarmTime(time24)` | ✅ IndependentAlarmCard.formatAlarmTime (12h/24h display based on timeFormat setting) | |
|  477 |  `_playAlarmSound()` | ✅ A#532 (AlarmSoundPlayer.playLooping — system alarm ringtone, looped) | |
|  478 |  `_stopAlarmSound()` | ✅ A#533 (AlarmSoundPlayer.stop) | |
|  479 |  `_playTimerSound()` | ✅ A#548 (TimerNotificationHelper — notification with DEFAULT_SOUND on timer complete) | |
|  480 |  `_startAlarmChecker()` | ✅ A#546 (NotificationScheduler.scheduleAlarms — exact AlarmManager scheduling, no polling) | |
|  481 |  `_stopAlarmChecker()` | ✅ A#540 (NotificationScheduler.cancelAlarms — cancels AlarmManager intents) | |
|  482 |  `_checkAlarms()` | ✅ AlarmReceiver.onReceive (OS fires at exact time — same outcome as polling check) | |
|  483 |  `_showAlarmAlert(alarm, onDismiss)` | ✅ AlarmFiredScreen composable (dismiss + snooze buttons, alarm name/time display) | |
|  484 |  `_startNotificationChecker()` | ✅ A#546 (NotificationScheduler.scheduleAlarms — exact scheduling, no polling interval) | |
|  485 |  `_stopNotificationChecker()` | ✅ A#540 (NotificationScheduler.cancelAlarms — cancels scheduled notification intents) | |
|  486 |  `_checkNotificationAlerts()` | ✅ A#544, A#547 (NotificationScheduler.parseAlerts + scheduleExactAlarm — OS fires at calculated time) | |
|  487 |  `_alertsFromChit(chit)` | ✅ A#1093 (AlertsZone.parseAlertsJson — parses alerts JSON into List<AlertItem>) | |
|  488 |  `_alertsToArray()` | ✅ A#1095 (AlertsZone.serializeAlerts — List<AlertItem> to JSON string) | |
|  489 |  `renderAllAlerts()` | ✅ A#1086 (AlertsZone composable — renders all AlertRow items + AddAlertForm) | |
|  490 |  `renderAlarmsContainer()` | ✅ A#1084 (AlertRow for type="alarm" — shows time, days, enabled toggle) | |
|  491 |  `renderNotificationsContainer()` | ✅ A#1084 (AlertRow for type="notification" — shows offset, unit, target) | |
|  492 |  `openAlarmModal(event)` | ✅ A#1083 (AlertsZone.AddAlertForm — type selector + time/offset inputs for new alerts) | |
|  493 |  `editAlarmItem(idx)` | ✅ AlertRow tap-to-edit (inline editing in AlertsZone) | |
|  494 |  `addAlarm()` | ✅ A#1083 (AddAlertForm onAdd → creates AlertItem, appends to list) | |
|  495 |  `toggleAlarmEnabled(idx)` | ✅ AlertsZone AlertRow onToggleEnabled (toggles alert.enabled, re-serializes) | |
|  496 |  `deleteAlarmItem(idx)` | ✅ AlertsZone AlertRow onDelete (filters out alert, re-serializes) | |
|  497 |  `openTimerModal(event)` | ✅ A#1083 (AddAlertForm with type="timer" — adds new timer to alerts list) | |
|  498 |  `editTimerItem(idx)` | ✅ AlertRow tap-to-edit for timer items | |
|  499 |  `addTimer()` | ✅ A#1083 (AddAlertForm onAdd for timer type — creates timer AlertItem) | |
|  500 |  `addStopwatch(event)` | ✅ A#1083 (AddAlertForm with type="stopwatch" — adds new stopwatch AlertItem) | |
|  501 |  `deleteStopwatchItem(idx)` | ✅ AlertsZone AlertRow onDelete for stopwatch items | |
|  502 |  `_swFmt(ms)` | ✅ StopwatchRuntime.formatElapsed (same as W451 — HH:MM:SS.cc format) | |
|  503 |  `renderStopwatchesContainer()` | ✅ A#1084 (AlertRow for type="stopwatch" in AlertsZone) | |
|  504 |  `renderTimersContainer()` | ✅ A#1084 (AlertRow for type="timer" in AlertsZone) | |
|  505 |  `deleteTimerItem(idx)` | ✅ AlertsZone AlertRow onDelete for timer items (stops runtime, removes from list) | |
|  506 |  `openNotificationModal(event)` | ✅ A#1083 (AddAlertForm with type="notification" — adds new notification AlertItem) | |
|  507 |  `addNotification()` | ✅ A#1083 (AddAlertForm onAdd for notification type — value, unit, direction) | |
|  508 |  `deleteNotificationItem(idx)` | ✅ AlertsZone AlertRow onDelete for notification items | |
|  509 |  `_sharedFmtTime(time24)` | ✅ A#1092 (AlertsZone.formatTimeForDisplay — 12h/24h based on timeFormat) | |
|  510 |  `_sharedPlayAlarm()` | ✅ A#532 (AlarmSoundPlayer.playLooping — same as W477) | |
|  511 |  `_sharedStopAlarm()` | ✅ A#533 (AlarmSoundPlayer.stop — same as W478) | |
|  512 |  `_sharedPlayTimer()` | ✅ A#548 (TimerNotificationHelper — same as W479) | |
|  513 |  `_sharedStopTimer()` | ✅ Timer notification auto-dismiss / user tap dismiss (system notification lifecycle) | |
|  514 |  `_sharedGetSnoozeMs()` | ✅ Snooze duration from settings (same as W471) | |
|  515 |  `_sharedPersistDismiss(key)` | ✅ AlarmFiredActivity dismiss (AlarmManager one-shot — doesn't re-fire after dismiss) | |
|  516 |  `_sharedPersistSnooze(key, untilTs)` | ✅ A#730 (AlarmFiredActivity.scheduleSnooze — reschedules alarm for snooze time) | |
|  517 |  `_sharedLoadAlertStates()` | ✅ AlarmManager state (scheduled = active, cancelled = dismissed — no separate state API) | |
|  518 |  `_sharedFetchData()` | ✅ Room DB (chits always available locally after sync — no separate fetch needed) | |
|  519 |  `_sharedShowAlertModal(opts)` | ✅ A#728 (AlarmFiredActivity — same as W465, works app-wide) | |
|  520 |  `_sharedDismissModal(overlay, opts)` | ✅ AlarmFiredActivity onDismiss (same as W466) | |
|  521 |  `_sharedBrowserNotif(title, body, chitId)` | ✅ AlarmReceiver + NotificationCompat.Builder (same as W468) | |
|  522 |  `_sharedCheckAlarms()` | ✅ AlarmManager exact scheduling (same as W469/W482 — OS fires at time) | |
|  523 |  `_initSharedAlarmSync()` | ✅ NotificationScheduler.rescheduleAll called after SyncEngine completes | |
|  524 |  `_initSharedAlarmSystem()` | ✅ NotificationScheduler init at app startup + BootReceiver (A#535) on device boot | |

---

### Email

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  525 |  `_emailSubFilter` | ✅ EmailViewModel folder state (set via setFolder — inbox/sent/drafts/scheduled/trash/archived) | |
|  526 |  `_emailUnreadTop` | ✅ EmailViewModel.uiState.unreadAtTop (boolean, toggled via toggleUnreadAtTop) | |
|  527 |  `_emailDashContactsCache` | ✅ EmailViewModel._senderImageUrls (cached sender email → image URL map) | |
|  528 |  `_emailLoadDashContacts()` | ✅ EmailViewModel.resolveSenderImages (loads contact images for visible threads) | |
|  529 |  `_emailGetContactImage(senderRaw)` | ✅ ContactRepository.getImageUrlForEmail (looks up image by sender email) | |
|  530 |  `displayEmailView(chitsToDisplay)` | ✅ A#1320 (EmailScreen — renders email list with threads, date groups, cards) | |
|  531 |  `_buildEmailCard(chit, viSettings)` | ✅ A#1265 (EmailCardEnhanced — sender avatar, subject, preview, badges, tags) | |
|  532 |  `_setEmailSubFilter(filter)` | ✅ A#1397 (EmailViewModel.setFolder) | |
|  533 |  `_checkMail()` | ✅ EmailViewModel.triggerSync (syncs all configured email accounts) | |
|  534 |  `_composeEmail()` | ✅ EmailScreen FAB → navigates to ChitEditor with new draft (emailStatus = "draft") | |
|  535 |  `_getUnreadCount()` | ✅ EmailViewModel.uiState.unreadCount (computed from inbox unread emails) | |
|  536 |  `_updateEmailBadge()` | ✅ EmailBadgeViewModel.unreadCount → CCaptnTabRow shows "(N)" on Email tab | |
|  537 |  `_emailEmptyState(container)` | ✅ A#1321 (EmailScreen.EmptyStateWithContext — contextual empty message per folder) | |
|  538 |  `_emailGetFileIcon(mimeType)` | ✅ A#1100 (AttachmentsZone.getFileTypeIcon — icon by MIME/filename) | |
|  539 |  `_emailShowErrorWithSettingsLink(errorMsg, hint)` | ✅ EmailViewModel.uiState.accountErrors → EmailScreen error display | |
|  540 |  `_showAccountErrorDetails(nickname, errorMsg)` | ✅ EmailViewModel.uiState.accountErrors (per-account error messages) | |
|  541 |  `_toggleEmailReadStatus(chit, card)` | ✅ EmailViewModel.toggleReadState (toggles email_read, marks dirty, pushes) | |
|  542 |  `_toggleEmailUnreadTop()` | ✅ EmailViewModel.toggleUnreadAtTop (toggles unreadAtTop, recomputes state) | |
|  543 |  `_emailBulkToggleRead()` | ✅ EmailViewModel.bulkToggleRead (toggles read for all selected) | |
|  544 |  `_emailRepliedToCache` | ✅ EmailViewModel.hasReplyIndicator (computed per-thread, no global cache needed) | |
|  545 |  `_emailBuildRepliedCache()` | ✅ EmailViewModel.hasReplyIndicator (scans allEmailChits for in_reply_to matches) | |
|  546 |  `_emailHasReply(messageId)` | ✅ A#1385 (EmailViewModel.hasReplyIndicator — checks if thread has reply/draft) | |
|  547 |  `_emailDetectTracking(chit)` | ✅ HtmlEmailRenderer.blockExternalImages (blocks all external images including trackers) | |
|  548 |  `_emailQuickArchive(chit, card)` | ✅ EmailViewModel.archiveWithUndo (hides card, undo countdown, archives on expiry) | |
|  549 |  `_emailQuickDelete(chit, card)` | ✅ EmailViewModel.deleteWithUndo (hides card, undo countdown, deletes on expiry) | |
|  550 |  `_emailRestoreCard(card)` | ✅ EmailViewModel undo action (restores chit state → Compose re-renders card in list) | |
|  551 |  `_emailStripHtml(str)` | ✅ BodyPreviewStripper.strip (removes HTML/style/script, decodes entities, strips markdown) | |
|  552 |  `_emailStripMarkdown(str)` | ✅ BodyPreviewStripper.strip (includes markdown stripping — links, bold, italic, code, headings) | |
|  553 |  `_emailActiveBundle` | ✅ EmailViewModel.uiState.activeBundle (nullable String, set via setBundle) | |
|  554 |  `_emailBundlesData` | ✅ A#1256 (BundleViewModel.fetchBundles → cached bundles list from BundleRepository) | |
|  555 |  `_fetchBundles(callback)` | ✅ A#1256 (BundleViewModel.fetchBundles → BundleRepository.fetchBundles from API) | |
|  556 |  `_filterByBundle(chits, activeBundle)` | ✅ EmailViewModel.recomputeState Step 3 (filters by bundle tag in chit.tags) | |
|  557 |  `_getBundleUnreadCount(bundleName, emailChits)` | ✅ BundleToolbar uses bundle.unreadCount (computed per bundle from email chits) | |
|  558 |  `_renderBundleToolbar(emailChits)` | ✅ A#1246 (BundleToolbar composable — renders bundle tab chips with counts) | |
|  559 |  `_renderBundleTabs(container, bundles, emailChits)` | ✅ A#1245 (BundleTabsRow + BundleTabChip — renders individual bundle tabs) | |
|  560 |  `_setActiveBundle(bundleName)` | ✅ A#1259 (BundleViewModel.selectBundle) + EmailViewModel.setBundle | |
|  561 |  `_persistActiveBundle()` | ✅ BundleViewModel persists selected bundle to SharedPreferences | |
|  562 |  `_updateBundleTabActiveStates()` | N/A (web DOM class toggle — Compose renders isSelected state declaratively) | |
|  563 |  `_bundleOnSubFilterChange(newFilter)` | ✅ EmailViewModel.setFolder (bundle filter only applies to inbox — auto-cleared on folder change) | |
|  564 |  `_emailBundleSelectAll(checked)` | ✅ EmailViewModel.selectAll (selects all visible thread IDs) | |
|  565 |  `_bundleUpdateActionStates()` | N/A (web DOM enable/disable — Android BulkActionsBar renders declaratively from selectedIds state) | |
|  566 |  `_openBundleModal(editBundle)` | ✅ BundleModals.kt CreateBundleModal / EditBundleModal (name, description, color, omni toggle) | |
|  567 |  `_bundleModalEscHandler(e)` | N/A (web ESC handler — Android modals dismiss via onDismissRequest/back button) | |
|  568 |  `_closeBundleModal()` | ✅ CreateBundleModal/EditBundleModal onDismiss callback | |
|  569 |  `_bundleModalSubmit()` | ✅ A#1252, A#1263 (BundleViewModel.createBundle / updateBundle — validates + API call) | |
|  570 |  `_bundleModalCreate(name, description)` | ✅ A#1252 (BundleViewModel.createBundle → BundleRepository.createBundle API call) | |
|  571 |  `_bundleModalUpdate(name, description)` | ✅ A#1263 (BundleViewModel.updateBundle → BundleRepository.updateBundle API call) | |
|  572 |  `_showBundleModalHint(msg)` | ✅ CreateBundleModal/EditBundleModal inline validation error text | |
|  573 |  `_showBundleContextMenu(bundle, x, y)` | ✅ A#1260 (BundleViewModel.showContextMenu → context menu with Edit/Disable/Delete) | |
|  574 |  `_closeBundleContextMenu()` | ✅ A#1255 (BundleViewModel.dismissContextMenu) | |
|  575 |  `_bundleContextMenuOutsideClick(e)` | N/A (web click-outside handler — Android DropdownMenu has onDismissRequest) | |
|  576 |  `_bundleContextMenuEscHandler(e)` | N/A (web ESC handler — Android DropdownMenu dismisses on back press) | |
|  577 |  `_attachBundleTabContextMenu(tab, bundle)` | ✅ BundleTabChip long-press → showContextMenu (Compose combinedClickable) | |
|  578 |  `_deleteBundleConfirm(bundle)` | ✅ A#1253 (BundleViewModel.deleteBundle — confirmation + API DELETE) | |
|  579 |  `_showToast(msg, type)` | N/A (removed — now cwocToast; Android uses Snackbar/inline status) | |

---

### Contacts

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  580 |  `_loadUsers()` | ✅ ContactListViewModel.loadSwitchableUsers (fetches from contactRepository) | |
|  581 |  `loadContacts(query)` | ✅ ContactListViewModel.observeContacts (Room DB Flow, synced from server) | |
|  582 |  `_onSearchInput()` | ✅ ContactListViewModel.updateSearchQuery (debounced 150ms, filters contacts) | |
|  583 |  `_applyFilter()` | ✅ ContactListViewModel contacts Flow (Room LIKE query across display_name, emails, etc.) | |
|  584 |  `_renderList()` | ✅ ContactListScreen LazyColumn (ContactRow + UserRow, grouped/flat modes) | |
|  585 |  `_createUserRow(user, query)` | ✅ ContactListScreen.UserRow composable (avatar, name, email) | |
|  586 |  `_createRow(contact, query)` | ✅ ContactListScreen.ContactRow composable (avatar, name, org, favorite star) | |
|  587 |  `_toggleFavorite(contact, starEl)` | ✅ ContactListViewModel.toggleFavorite (contactRepository.toggleFavorite) | |
|  588 |  `_shareContact(contact)` | ✅ ContactListScreen QR button → ContactQrCodeDialog (vCard QR code) | |
|  589 |  `_renderContactTags()` | ✅ ContactEditorScreen.ContactTagsZone (renders tag chips with add/remove) | |
|  590 |  `_initContactTags()` | ✅ ContactTagsZone (TextField + tag picker — Compose declarative init) | |
|  591 |  `_loadContact(id)` | ✅ ContactEditorViewModel.loadExistingContact (loads from Room via contactRepository) | |
|  592 |  `_stageImage(file)` | ✅ ContactProfileImageSection galleryLauncher/cameraLauncher (stages image for upload) | |
|  593 |  `_uploadPendingImage()` | ✅ uploadContactImage / uploadContactBitmap (uploads to server API) | |
|  594 |  `triggerImageUpload()` | ✅ ContactProfileImageSection showImageOptions → gallery/camera picker | |
|  595 |  `_initColorPicker()` | ✅ ContactEditorScreen uses ColorZone composable (same as chit editor) | |
|  596 |  `_selectColor(hex, fromInput)` | ✅ ColorZone.onColorSelected → updateField(state.copy(color = hex)) | |
|  597 |  `addMultiValueEntry(fieldName, defaultLabel, defaultValue)` | ✅ ContactEditorScreen.MultiValueField (add row for emails/phones/addresses/etc.) | |
|  598 |  `_getMultiValueEntries(fieldName)` | ✅ MultiValueField serializes entries to JSON via onValueChange callback | |
|  599 |  `toggleFavorite()` | ✅ ContactEditorScreen toolbar favorite IconButton → updateField(copy(favorite = !favorite)) | |
|  600 |  `collectContactData()` | ✅ ContactEditorViewModel.formState (reactive state — all fields gathered declaratively) | |
|  601 |  `populateContactForm(contact)` | ✅ ContactEditorViewModel.loadExistingContact → entity.toFormState → Compose renders | |
|  602 |  `_saveContact()` | ✅ ContactEditorViewModel.save (persists via ContactRepository, marks dirty, pushes) | |
|  603 |  `saveContactAndStay()` | ❌ Missing (Android ContactEditorViewModel.save always navigates back — no stay option) | W603-saveContactAndStay.md |
|  604 |  `saveContactAndExit()` | ✅ ContactEditorViewModel.save (saves + sets _isSaved = true → navigates back) | |
|  605 |  `deleteContact()` | ✅ ContactEditorViewModel.delete (soft-delete, marks dirty, pushes, navigates back) | |
|  606 |  `shareContact()` | ✅ ContactEditorScreen shareContactAsVCard (generates vCard, shares via Intent) | |
|  607 |  `generateContactVCard(contact)` | ✅ shareContactAsVCard generates vCard inline (BEGIN:VCARD...END:VCARD) | |
|  608 |  `showContactQrCode(contact)` | ✅ ContactQrCodeDialog (vCard QR code — same as W588) | |
|  609 |  `cwocContactMatchesFilter(contact, query)` | ✅ ContactRepository.searchContacts (Room LIKE query across fields) | |

---

### Search & Filter & Sort

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  610 |  `displaySearchView()` | ✅ A#1652 (SearchScreen — renders search results with highlighted terms) | |
|  611 |  `_renderSearchResults(container, viSettings)` | ✅ A#1651 (SearchScreen.SearchResultCard — title, preview, status, highlighted terms) | |
|  612 |  `cwocMatchesSearch(chit, searchText)` | ✅ SearchViewModel uses BooleanSearchParser + BooleanSearchEvaluator for matching | |
|  613 |  `cwocExtractSearchTerms(query)` | ✅ A#1656 (SearchViewModel.extractTerms — extracts terms for highlighting) | |
|  614 |  `CwocSidebarFilter(config)` | ✅ FilterSortViewModel + SidebarContent filter panels (tag, status, priority, people) | |
|  615 |  `cwocLoadTagFilter(config)` | ✅ FilterSortViewModel.filterState includes tag filter (loaded from SidebarContent) | |
|  616 |  `cwocChitPassesTagFilter(chitTags)` | ✅ A#501 (FilterEngine.passesAllFilters — includes tag filter check) | |
|  617 |  `cwocClearTagFilter()` | ✅ A#1939 (FilterSortViewModel.clearFilters — resets all filter state) | |
|  618 |  `_cwocUpdateTagVirtualOptions()` | ✅ FilterEngine handles system tags (Calendar, Tasks, Notes, etc.) in filter logic | |
|  619 |  `_cwocRenderTagList(container, tagObjects, onChange)` | ✅ SidebarContent tag filter section (FilterChip list with tag tree) | |
|  620 |  `_initDashboardSidebar()` | ✅ SidebarContent composable (filter/sort/period controls — declarative init) | |
|  621 |  `onSortSelectChange()` | ✅ A#1947 (FilterSortViewModel.updateSort — changes sort field) | |
|  622 |  `toggleSortDir()` | ✅ FilterSortViewModel.updateSort (toggles SortDirection.ASC/DESC) | |
|  623 |  `_updateSortUI()` | N/A (web DOM update — Compose renders sort state declaratively from FilterSortViewModel) | |
|  624 |  `onFilterChange()` | ✅ A#1946 (FilterSortViewModel.updateFilter — updates FilterState) | |
|  625 |  `onFilterAnyToggle(anyCb)` | ✅ FilterState.tagMatchMode (TagMatchMode.ANY / TagMatchMode.ALL) | |
|  626 |  `onFilterSpecificToggle(filterType)` | ✅ FilterSortViewModel.updateFilter (toggles specific filter values in FilterState) | |
|  627 |  `clearFilterGroup(containerId)` | ✅ FilterSortViewModel.clearFilters (clears all filter groups) | |
|  628 |  `_filterTagCheckboxes()` | ✅ SidebarContent tag filter chips (Compose declarative rendering) | |
|  629 |  `_clearAllFilters()` | ✅ A#1939 (FilterSortViewModel.clearFilters) | |
|  630 |  `_applySystemDefaults()` | ✅ FilterSortViewModel.clearFilters resets to system defaults | |
|  631 |  `_applyFilterStateToSidebar(state)` | N/A (web imperative DOM update — Android SidebarContent renders from FilterState declaratively) | |
|  632 |  `_applyCustomViewFilters(tab)` | ⚠️ Partial — custom_view_filters stored/synced but NOT applied at runtime on tab switch | W632-customViewFilters.md |
|  633 |  `_resetDefaultFilters()` | ⚠️ Partial — clearFilters resets to empty, but custom view defaults not auto-applied (same as W632) | W632-customViewFilters.md |
|  634 |  `_updateClearFiltersButton()` | N/A (web DOM show/hide — Android renders "Clear Filters" button declaratively from FilterState) | |
|  635 |  `_getSelectedFilterValues(containerId, filterType)` | ✅ FilterState holds selected values directly (statuses, priorities, tags sets) | |
|  636 |  `_getSelectedStatuses()` | ✅ FilterState.statuses (Set<String> of selected status values) | |
|  637 |  `_getSelectedLabels()` | ✅ FilterState.tags (Set<String> of selected tag paths) | |
|  638 |  `_getSelectedPriorities()` | ✅ FilterState.priorities (Set<String> of selected priority values) | |
|  639 |  `_buildTagFilterPanel()` | ✅ FilterPanel composable (tag section with FilterChips from availableTags) | |
|  640 |  `_buildPeopleFilterPanel()` | ✅ FilterPanel composable (people section with PersonItem chips) | |
|  641 |  `_renderPeopleFilterPanel(contacts)` | ✅ FilterPanel people section renders from availablePeople list | |
|  642 |  `_renderPeopleChipFilter(containerId, contacts, users, selection)` | ✅ FilterPanel people chips (contacts + users as selectable chips) | |
|  643 |  `_isPeopleColorLight(hex)` | ✅ ColorUtils.isLightColor (shared utility) | |
|  644 |  `clearPeopleFilter()` | ✅ FilterPanel onClearAll / FilterSortViewModel.clearFilters | |
|  645 |  `_updateTagVirtualOptions()` | ✅ FilterPanel tag section includes system tags (same as W618) | |
|  646 |  `_onTagToggled()` | ✅ FilterPanel tag chip onClick → onFilterStateChanged(updated tags) | |
|  647 |  `_loadLabelFilters()` | ✅ FilterPanel loads availableTags from settings (passed as prop) | |
|  648 |  `filterChits(tab)` | ✅ CCaptnTabRow tab selection → screen navigation + FilterSortViewModel.onTabChanged | |
|  649 |  `searchChits()` | ✅ SearchViewModel reactive search (debounced query → filtered results) | |
|  650 |  `_applyArchiveFilter(chitList)` | ✅ FilterEngine.passesAllFilters (showArchived, showPinned, showUnmarked toggles) | |
|  651 |  `_applyMultiSelectFilters(chitList)` | ✅ A#498 (FilterEngine.applyFilters — status, priority, tag, people filters) | |
|  652 |  `_applySort(chitList)` | ✅ A#520 (SortEngine.sort — sorts by field + direction, supports manual order) | |
|  653 |  `_loadSortPreferencesFromServer()` | ✅ A#1941 (FilterSortViewModel.loadSortPreference — reads from SharedPreferences, synced from server) | |
|  654 |  `_loadSortOrdersFromServer()` | ✅ A#1940 (FilterSortViewModel.getManualOrder — reads from SharedPreferences) | |
|  655 |  `getSortPreference(tab)` | ✅ A#1941 (FilterSortViewModel.loadSortPreference — per-tab sort field + direction) | |
|  656 |  `saveSortPreference(tab, field, dir)` | ✅ A#1943 (FilterSortViewModel.persistSortPreference — saves to prefs + API) | |
|  657 |  `resetAllSortOrders()` | ✅ A#1773 (SettingsViewModel.resetSortOrders — same as W291) | |
|  658 |  `getManualOrder(tab)` | ✅ A#1940 (FilterSortViewModel.getManualOrder — reads ordered IDs from prefs) | |
|  659 |  `saveManualOrder(tab, ids)` | ✅ A#1945 (FilterSortViewModel.saveManualOrder — persists to prefs + API) | |
|  660 |  `applyManualOrder(tab, chitList)` | ✅ SortEngine.sort with SortField.MANUAL (applies saved ID order) | |
|  661 |  `enableDragToReorder(container, tab, onReorder, longPressMap)` | ✅ A#1944 (FilterSortViewModel.reorderItems + ReorderableStaggeredGrid composable) | |
|  662 |  `currentSortField` | ✅ FilterSortViewModel.sortState.field (SortField enum) | |
|  663 |  `currentSortDir` | ✅ FilterSortViewModel.sortState.direction (SortDirection.ASC/DESC) | |

---

### UI Components (Modals, Toasts, Pickers)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  664 |  `cwocToast(message, type, duration)` | ✅ SnackbarHostState.showSnackbar (used throughout app for brief notifications) | |
|  665 |  `cwocUndoToast(message, opts)` | ✅ A#670 (UndoToast composable — countdown bar with Undo button) | |
|  666 |  `cwocConfirm(message, opts)` | ✅ AlertDialog composable (used throughout for yes/no confirmations) | |
|  667 |  `cwocPromptModal(title, placeholder, onConfirm, opts)` | ✅ CwocPromptDialog composable (text input with title, placeholder, confirm/cancel) | |
|  668 |  `cwocUnsavedModal(opts)` | ✅ Unsaved changes AlertDialog (Save/Discard/Cancel — used in editor + settings) | |
|  669 |  `cwocChitPickerModal(options)` | ✅ ChitPickerSheet composable (searchable chit list with selection) | |
|  670 |  `showQRModal(opts)` | ✅ ChitQrCodeDialog / ContactQrCodeDialog (QR code display modals) | |
|  671 |  `cwocTimePicker.open(inputEl, options)` | ✅ Android native TimePickerDialog (Material3 TimePicker) | |
|  672 |  `cwocToggleCalculator()` | ✅ ChitEditorScreen showCalculator state toggle → CalculatorSheet | |
|  673 |  `cwocIsCalculatorOpen()` | ✅ ChitEditorScreen showCalculator boolean state | |
|  674 |  `cwocCloseCalculator()` | ✅ CalculatorSheet onDismiss callback | |
|  675 |  `_calcTokenize(expr)` | ✅ A#564 (CalculatorSheet.tokenize) | |
|  676 |  `_calcParse(tokens)` | ✅ A#563 (CalculatorSheet.parseExpression) | |
|  677 |  `_calcEvaluate(expr)` | ✅ A#562 (CalculatorSheet.evaluateExpression) | |
|  678 |  `_calcFormatResult(num)` | ✅ CalculatorSheet result formatting (inline in evaluateExpression) | |
|  679 |  `_calcOnButton(value)` | ✅ CalculatorKeypad button onClick handlers | |
|  680 |  `_calcUpdateDisplay()` | ✅ A#559 (CalculatorDisplay — renders expression + result reactively) | |
|  681 |  `_calcInsertResult()` | ✅ CalculatorSheet onInsert callback (inserts result into note/field) | |
|  682 |  `showQuickEditModal(chit, onRefresh)` | ⚠️ Partial — ChitActionMenu has pin/archive/snooze/delete but no inline status/priority dropdowns | W682-quickEditModal.md |
|  683 |  `_showSnoozeSubMenu(actionRow, snzBtn, chitId, closeModal, onRefresh)` | ✅ A#652 (SnoozePickerDialog — preset durations + custom time) | |
|  684 |  `_showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, closeModal, onRefresh)` | ⚠️ Partial — simple delete exists but no recurrence instance options (see W095) | W684-deleteSubMenuRecurrence.md |
|  685 |  `showRecurrenceActionModal(chit, onRefresh)` | ❌ Missing (part of recurrence series editing — see W095) | W095-recurrenceSeriesInfo.md |
|  686 |  `_showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo, customMessage)` | ✅ A#670 (UndoToast — countdown with undo for delete actions) | |
|  687 |  `_openClockModal()` | ✅ MainActivity showClockDialog → ClockModal composable | |
|  688 |  `_renderClocks(container, activeClocks, isVertical)` | ✅ ClockModal renders clocks from timezones list | |
|  689 |  `_renderHSTClock(dayFraction, hstVal)` | ✅ ClockModal handles HST clock type | |
|  690 |  `_renderAnalogClock(h24, min, sec)` | ✅ ClockModal handles analog clock type | |
|  691 |  `_closeClockModal()` | ✅ ClockModal onDismiss callback | |
|  692 |  `cwocTagModal.inject()` | ✅ A#659 (TagCreateDialog) + A#1436 (TagPickerModal) — injected as composables | |
|  693 |  `cwocTagModal.open(tagName, opts)` | ✅ TagCreateDialog / TagPickerModal shown via state toggle | |
|  694 |  `cwocTagModal.close()` | ✅ TagCreateDialog/TagPickerModal onDismiss callback | |
|  695 |  `cwocTagModal.isOpen()` | ✅ showTagDialog boolean state in parent composable | |

---

### Navigation & Sidebar

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  696 |  `_cwocSidebarContext` | ✅ SidebarStateViewModel (holds sidebar state — period, mode, filters) | |
|  697 |  `_notifInboxItems` | ✅ ProfileMenuViewModel.notifications (List<NotificationDto> — polled every 30s) | |
|  698 |  `_cwocInjectSidebar()` | ✅ SidebarContent composable rendered in MainActivity (Compose declarative) | |
|  699 |  `_cwocInitSidebar(context)` | ✅ SidebarContent composable (receives tab, callbacks, state as props) | |
|  700 |  `_wireFilterCheckboxes(context)` | N/A (web DOM event wiring — Compose FilterChips have onClick directly) | |
|  701 |  `toggleSidebar()` | ✅ MainActivity ModalNavigationDrawer + drawerState.open()/close() | |
|  702 |  `restoreSidebarState()` | ✅ SidebarStateViewModel persists state (period, mode) to SharedPreferences | |
|  703 |  `toggleSidebarSection(sectionId)` | ✅ CollapsibleSection in SidebarContent (expand/collapse state) | |
|  704 |  `expandSidebarSection(sectionId)` | ✅ CollapsibleSection initiallyExpanded prop | |
|  705 |  `_toggleFiltersSection()` | ✅ CollapsibleSection "🔍 Filters" in SidebarContent | |
|  706 |  `_expandFiltersSection()` | ✅ CollapsibleSection initiallyExpanded for filters | |
|  707 |  `toggleFilterGroup(groupId)` | ✅ FilterPanel collapsible sub-sections (status, priority, tags, people) | |
|  708 |  `expandFilterGroup(groupId)` | ✅ FilterPanel sub-section expand state | |
|  709 |  `_toggleNotifInbox()` | ✅ ProfileMenu dropdown shows notifications list (NotificationsScreen) | |
|  710 |  `_fetchNotifications()` | ✅ A#1951 (ProfileMenuViewModel.fetchNotifications — GET /api/notifications) | |
|  711 |  `_updateNotifBadge()` | ✅ ProfileMenuViewModel.pendingCount StateFlow → badge in ProfileMenu | |
|  712 |  `_renderNotifInbox()` | ✅ NotificationsScreen renders notification cards (accept/decline/dismiss) | |
|  713 |  `_respondNotification(notifId, status)` | ✅ A#1948, A#1949 (ProfileMenuViewModel.acceptNotification/declineNotification) | |
|  714 |  `_fetchSidebarVersion()` | ✅ AdminSettingsTab displays server version (fetched from API) | |
|  715 |  `initMobileSidebar()` | ✅ ModalNavigationDrawer (native Android drawer pattern) | |
|  716 |  `initMobileViewsButton()` | ✅ ViewsPanel (right-swipe panel for view switching) | |
|  717 |  `initMobileReferenceClose()` | N/A (web mobile-specific — Android has native back navigation) | |
|  718 |  `_restoreViewModeButtons()` | N/A (web DOM state restore — Android Compose renders from ViewModel state) | |
|  719 |  `currentTab` | ✅ MainActivity selectedTab (CCaptnTab) + navController currentRoute | |
|  720 |  `chits` | ✅ Room DB ChitDao.getAll() Flow (local cache of all non-deleted chits) | |
|  721 |  `previousState` | ✅ navController back stack (Android navigation handles state restoration) | |
|  722 |  `_cachedTagObjects` | ✅ Settings entity tags field (parsed into tag tree by ViewModels) | |
|  723 |  `_chitOptions` | ✅ SettingsFormState.chitOptions (JSON string from settings) | |
|  724 |  `_snoozeRegistry` | ✅ AlarmManager scheduling (snoozed alarms rescheduled, no registry needed) | |
|  725 |  `_defaultFilters` | ✅ SettingsFormState.customViewFilters (per-tab default filters) | |
|  726 |  `_globalSearchResults` | ✅ SearchViewModel.searchResults StateFlow | |
|  727 |  `_globalSearchQuery` | ✅ SearchViewModel.query StateFlow | |
|  728 |  `_weekStartDay` | ✅ SettingsFormState.weekStartDay (from settings) | |
|  729 |  `fetchChits()` | ✅ SyncEngine syncs chits from server → Room DB (reactive Flows provide data) | |
|  730 |  `displayChits()` | ✅ Each screen ViewModel (filter + sort + Compose rendering — reactive pipeline) | |
|  731 |  `_updateTabCounts(filteredChits)` | ✅ CCaptnTabRow tabCounts prop (shows "(N)" next to each tab label) | |
|  732 |  `_applyChitDisplayOptions()` | ✅ ChitCardEnhancements (isOverdue, isPastEvent, chitColorBorder — display options) | |
|  733 |  `storePreviousState()` | ✅ navController back stack (automatic state preservation) | |
|  734 |  `_restoreUIState()` | ✅ navController back stack restoration (automatic on navigate back) | |
|  735 |  `_checkTabOverflow()` | N/A (web-specific — Android ScrollableTabRow handles overflow natively) | |
|  736 |  `_applyViewOrder(viewOrder)` | ✅ CCaptnTabRow.getOrderedVisibleTabs (parses viewOrder, reorders tabs) | |
|  737 |  `openHelpPage()` | ✅ A#1445 (HelpScreen — navigated to via navController) | |
|  738 |  `_toggleReference()` | N/A (web keyboard shortcut reference — Android has no keyboard shortcuts) | |
|  739 |  `_closeReference()` | N/A (web keyboard shortcut reference — Android has no keyboard shortcuts) | |
|  740 |  `_mobileZoneOrder` | ✅ EditorZoneState visible zones order (managed by ChitEditorScreen) | |
|  741 |  `_mobileShowZone(idx)` | ✅ EditorZoneNav zone selection (navigates to specific zone) | |
|  742 |  `_mobileNextZone()` | ✅ EditorZoneNavHeader next zone navigation | |
|  743 |  `_mobilePrevZone()` | ✅ EditorZoneNavHeader previous zone navigation | |
|  744 |  `_createMobileZoneHeader()` | ✅ A#1181 (EditorZoneNavHeader — zone name + prev/next arrows) | |
|  745 |  `_createMobileZoneList()` | ✅ A#1184 (ZoneListPanel — scrollable zone list for quick jump) | |
|  746 |  `_activateMobileZoneMode()` | ✅ ChitEditorScreen zone navigation mode (always active on mobile) | |
|  747 |  `initMobileZoneNav()` | ✅ EditorZoneNav initialization (Compose declarative — no explicit init) | |
|  748 |  `_cwocToggleUserDropdown(switcherWrap)` | ✅ ProfileMenu dropdown (shows Switch User, Logout, View Profile options) | |
|  749 |  `_cwocShowSwitchPasswordPrompt(targetUser)` | ✅ ProfileMenu onSwitchUser → clearToken + navigate to Login (re-auth as different user) | |
|  750 |  `_cwocLogout()` | ✅ A#238 (AuthRepository.clearToken + navigate to Login screen) | |
|  751 |  `_initProfileMode()` | ✅ ContactEditorScreen isProfileMode (hides favorite/delete/share, shows password zone, title="Profile") | |
|  752 |  `_loadProfile()` | ✅ ContactEditorViewModel.loadProfile (fetches /api/auth/users/{id}/profile → populates formState) | |
|  753 |  `_saveProfile()` | ✅ ContactEditorViewModel.saveProfile (gathers formState → PUT /api/auth/users/{id}/profile) | |

---

### Maps & Weather

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  754 |  `_mapsInit()` | ✅ MapViewModel.init (loadSettings + loadChitMarkers + loadContactMarkers + mode restore) | |
|  755 |  `_initLeafletMap()` | ✅ MapScreen AndroidView(MapView) with MAPNIK tiles, multi-touch, zoom controls | |
|  756 |  `_injectModeToggle()` | ✅ A#1497 (MapModeToggle composable — FilterChips for Chits/Both/People + "All People" checkbox, same layout on all screen sizes) | |
|  757 |  `_mapsSetMode(mode)` | ✅ A#1522 (MapViewModel.setMapMode — sets mode, persists to SharedPreferences, triggers updateVisibleMarkers; UI updates reactively via Compose) | |
|  758 |  `_fetchAndDisplayChits()` | ✅ A#1510 (MapViewModel.loadChitMarkers — loads chits from Room, geocodes locations, builds markers, sets loading state, calls updateVisibleMarkers) | |
|  759 |  `_fetchAndDisplayContacts()` | ✅ A#1511 (MapViewModel.loadContactMarkers — loads contacts from Room, geocodes addresses, builds markers, calls updateVisibleMarkers; allPeople flag handled in filter logic) | |
|  760 |  `_geocodeChits(chits)` | ✅ A#1510 (inline in loadChitMarkers — iterates chits, calls GeocodingUtil.geocode for text addresses, same cache-then-network pattern) | |
|  761 |  `_geocodeContacts(contacts)` | ✅ A#1511 (inline in loadContactMarkers — iterates contacts, extracts addresses, calls GeocodingUtil.geocode, same cache-then-network pattern) | |
|  762 |  `_placeMarkers(geocodedChits)` | ✅ A#1498, A#1528 (MapScreen update lambda creates osmdroid Markers from viewModel.markers; updateVisibleMarkers computes bounds for fitBounds; same colored markers + tap-to-navigate) | |
|  763 |  `_placeContactMarkers(geocodedContacts)` | ✅ A#1498, A#1528 (MapScreen update lambda renders contact markers from viewModel.markers where type="contact"; tap navigates to contact editor; same outcome as web circle markers) | |
|  764 |  `_buildPopupContent(chit)` | ✅ A#1498 (MapScreen marker tap → direct navigation to editor; no intermediate popup — mobile UX pattern skips preview and navigates directly, which is standard for touch interfaces) | |
|  765 |  `_buildContactPopupContent(contact, address)` | ✅ A#1498 (MapScreen contact marker tap → direct navigation to contact editor; no intermediate popup — same mobile UX pattern as W764) | |
|  766 |  `_applyChitsFilters(chits)` | ✅ A#1500 (MapViewModel.applyChitFilters — filters by status, priority, tags, people, text search, period/date range; all AND-combined; same logic) | |
|  767 |  `_applyPeopleFilters(contacts)` | ✅ PeopleFilterPanel.kt (text search, favorites toggle, tag chips) + MapViewModel.kt applyPeopleFilters() (AND composition, allPeopleOverride bypass) | |
|  768 |  `_handleFocusAddress(focusType, address)` | ✅ MapViewModel.kt handleFocusNavigation() + FocusState (mode switch by focusType, "All Time" period override, geocode → center at zoom 15) + HighlightMarker.kt (gold pulsing circle, 8s auto-dismiss) | |
|  769 |  `_loadGeocodeCache()` | ✅ GeocodingUtil.cache (in-memory HashMap checked before API calls; not persisted to disk like web's localStorage, but serves same purpose of avoiding redundant geocode calls within a session) | |
|  770 |  `_saveGeocodeCache()` | ✅ GeocodingUtil.geocode() auto-caches results in memory (line `cache[cacheKey] = result`); no separate save step needed — no disk persistence but same runtime behavior | |
|  771 |  `getGeocodeCached(address)` | ✅ GeocodingUtil.geocode() cache check (line `if (cache.containsKey(cacheKey)) return cache[cacheKey]` — same lowercase-trimmed key lookup, returns cached result or null) | |
|  772 |  `setGeocodeCache(address, lat, lon)` | ✅ GeocodingUtil.geocode() inline cache write (`cache[cacheKey] = result` — stores result in memory for future lookups; same functional behavior) | |
|  773 |  `_geocodeAddress(address)` | ✅ GeocodingUtil.kt geocode() with server proxy + generateVariants() progressive fallback (zip strip, period normalize, comma split, city/state extract; 7 variant max) | |
|  774 |  `_getCoordinates(address)` | ✅ GeocodingUtil.geocode (thin wrapper — web delegates to _geocodeAddress; Android calls GeocodingUtil.geocode directly from LocationZone) | |
|  775 |  `_getWeather(lat, lon)` | N/A (function no longer exists in web codebase — weather fetching refactored into shared-weather.js fetchAndCacheWeather system) | |
|  776 |  `onClearLocation(event)` | ✅ LocationZone "Clear" AssistChip onClick (sets location="", clears geocodeResult/geocodeError/coordinates; weather indicator hides reactively when location is empty) | |
|  777 |  `openLocationInNewTab(event)` | ✅ ChitEditorScreen LocationZone "Open in Maps" AssistChip (fires geo: intent → opens device maps app with location query; Android equivalent of opening in browser tab) | |
|  778 |  `openLocationDirections(event)` | ✅ ChitEditorScreen LocationZone "Directions" AssistChip (fires google.navigation: intent → opens Google Maps navigation to location; Android equivalent of opening directions in browser) | |
|  779 |  `_viewLocationInContext(event)` | ✅ ChitEditorScreen LocationZone "View in Context" button → Screen.Map.createRoute(focusType, address) + unsaved changes check + MapViewModel focus mode | |
|  780 |  `loadSavedLocations()` | ✅ ChitEditorViewModel loads savedLocations from SettingsEntity (parsed from JSON → List<String>); LocationZone renders "Saved Locations" dropdown with auto-geocode on selection | |
|  781 |  `getDefaultLocation()` | ✅ MapViewModel uses mapDefaultLat/mapDefaultLon from settings for default map center; WeatherViewModel fetches forecasts for all saved locations from server (server handles default selection) | |
|  782 |  `getWeatherFromCache(address)` | ✅ Server-side caching (Android fetches from /api/weather/forecasts which has server-side cache; no client-side cache needed — server pre-fetches and caches weather data) | |
|  783 |  `fetchAndCacheWeather(address)` | ✅ Server-side (Android gets weather from /api/weather/forecasts; server's schedulers.py pre-fetches from Open-Meteo and caches; same data available to app) | |
|  784 |  `_getWeatherIcon(code)` | ✅ WeatherScreen.getWeatherIcon + OmniViewViewModel.weatherCodeToIcon + WeatherModal.weatherCodeToIcon (all map WMO codes to same emojis as web) | |
|  785 |  `_getPrecipLabel(code)` | ✅ weatherCodeToCondition (in WeatherViewModel, OmniViewViewModel, WeatherModal) — precipitation type embedded in condition string ("Light rain", "Heavy snow", etc.) rather than separate label | |
|  786 |  `_formatPrecip(precipMm, weatherCode)` | ✅ WeatherScreen inline formatting (shows "💧 X.X mm" or "❄️ X.X mm" based on weather code; same concept as web's "Xcm rain/snow" with different unit display) | |
|  787 |  `_celsiusToFahrenheit(c)` | ✅ UnitConverter.formatTemperature(celsius, unitSystem) — converts C→F when unitSystem is "imperial", returns formatted string with unit symbol | |
|  788 |  `_isWeatherStale(updatedTime)` | N/A (web-specific staleness indicator — Android fetches fresh from server each time; server handles weather data freshness via scheduler) | |
|  789 |  `_buildLocationSelectorHTML(locations, selectedAddress)` | ✅ WeatherModal ExposedDropdownMenuBox (location selector dropdown from saved locations; same UI pattern — select location to view weather) | |
|  790 |  `_onWeatherModalLocChange()` | ✅ WeatherModal LaunchedEffect(selectedIndex) triggers fetchWeather for the newly selected location (same behavior — dropdown change → fetch weather for that location) | |
|  791 |  `_onWeatherModalManualGo()` | ✅ WeatherModal.kt "Type a location" option + text input + "Go" button (geocode via GeocodingUtil.geocode, fetch weather, display results; whitespace rejection + error handling) | |
|  792 |  `_openWeatherModal()` | ✅ MainActivity showWeatherDialog state → WeatherModal composable (triggered by sidebar weather long-press; shows location selector + current conditions + "Full Forecast" button) | |
|  793 |  `_fetchWeatherForModal(address, label)` | ✅ WeatherModal.fetchWeather + fetchWeatherData (geocodes address, fetches from Open-Meteo, displays icon/description/temps/precip/wind in modal) | |
|  794 |  `_closeWeatherModal()` | ✅ WeatherModal onDismiss callback (sets showWeatherDialog = false; Compose removes the dialog from composition) | |
|  795 |  `_wxPageIcons` | ✅ Same as W784 — weatherCodeToIcon maps in WeatherScreen, OmniViewViewModel, WeatherModal (shared WMO code → emoji mapping) | |
|  796 |  `_wxPageGetIcon(code)` | ✅ Same as W784 — thin wrapper calling _cwocGetWeatherIcon; Android equivalent is getWeatherIcon/weatherCodeToIcon | |
|  797 |  `_wxPageC2F(c)` | N/A (removed from web codebase — replaced by _convertTemp, already covered by W787 / UnitConverter.formatTemperature) | |
|  798 |  `_wxPrecipType(code)` | N/A (removed from web codebase — replaced by _cwocGetPrecipType, already covered by W785 / weatherCodeToCondition) | |
|  799 |  `_wxFormatPrecip(precipMm, weatherCode)` | N/A (removed from web codebase — replaced by _cwocFormatPrecip, already covered by W786 / WeatherScreen inline formatting) | |
|  800 |  `_initWeatherPage()` | ✅ A#1908 WeatherScreen composable + A#1913 WeatherViewModel.loadForecasts (initializes weather page, loads saved locations from server, renders forecast cards) | |
|  801 |  `_wxFetchForecast(loc)` | ✅ A#1913 WeatherViewModel.loadForecasts (fetches forecasts from server /api/weather/forecasts; server handles Open-Meteo calls and caching) | |
|  802 |  `_wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate)` | ✅ A#1904 WeatherContent + A#1903 LocationForecastCard + A#1902 DailyForecastRow (renders forecast data as cards in LazyColumn; same data, different layout for mobile) | |

---

### Rules Engine

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  803 |  `loadRules()` | ✅ A#1648 (RulesManagerViewModel.loadRules — fetches rules from /api/rules, populates _rules StateFlow) | |
|  804 |  `renderRulesTable()` | ✅ A#1645 RulesManagerScreen + A#1644 RuleCard (LazyColumn of rule cards with name, trigger summary, enabled toggle, edit/delete actions) | |
|  805 |  `toggleRule(ruleId)` | ✅ A#1649 (RulesManagerViewModel.toggleRule — PATCH /api/rules/{id}/toggle, updates local state) | |
|  806 |  `deleteRule(ruleId, ruleName)` | ✅ A#1628 (RuleEditorViewModel.deleteRule — confirm dialog + DELETE /api/rules/{id}, navigates back on success) | |
|  807 |  `_saveRule()` | ✅ A#1631 (RuleEditorViewModel.saveRule — validates, builds payload, POST/PUT to /api/rules, navigates back on success) | |
|  808 |  `cancelOrExit()` | ✅ RuleEditorScreen onNavigateBack (navigates back to RulesManagerScreen; unsaved changes handled by ViewModel state) | |
|  809 |  `_loadRule(ruleId)` | ✅ A#1629 (RuleEditorViewModel.loadRule — GET /api/rules/{id}, populates form state) | |

---

### Tags

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  810 |  `_postSettingsWithRetry(body)` | ✅ SettingsRepository/SyncEngine push with OkHttp auth interceptor (automatic token refresh on 401; same retry-on-auth-failure pattern) | |
|  811 |  `buildTagTree(flatTags)` | ✅ A#525 (TagTreeParser.parseTagTree — splits by "/", builds hierarchical tree, inherits colors, sorts favorites first then alphabetical) | |
|  812 |  `flattenTagTree(tree, originalNames)` | ✅ A#521 (TagTreeParser.flattenTree — converts tree back to flat list of TagNode objects) | |
|  813 |  `matchesTagFilter(chitTags, filterTag)` | ✅ A#501 FilterEngine.passesAllFilters inline logic (`chitTag == filterTag || chitTag.startsWith("$filterTag/")` — same hierarchical matching) | |
|  814 |  `renderTagTree(container, tree, selectedTags, onToggle, opts)` | ✅ A#1213 TagsPickerSheet.renderTagTree + A#1211 TagTreeRow (renders hierarchical tag tree with checkboxes, indentation, colors, expand/collapse) | |
|  815 |  `createTagInline(name, opts)` | ✅ A#1061 ChitEditorViewModel.onTagCreated (adds tag to settings JSON, marks settings dirty, refreshes tagTree; same create-and-persist behavior) | |
|  816 |  `updateTagInline(oldName, tagData)` | ✅ CollectionsSettingsTab EnhancedTagEditDialog (edits tag in local list, serializes to JSON, pushes via settings sync; tag renames propagated via EdgeCaseHandler.applyTagRename) | |
|  817 |  `deleteTagInline(tagName)` | ✅ CollectionsSettingsTab tag delete action (removes tag from list, serializes to JSON, pushes via settings sync; sub-tags removed by filtering prefix) | |
|  818 |  `SYSTEM_TAGS` | ✅ SYSTEM_TAGS constant defined in ChitCardEnhancements.kt, EmailCardEnhanced.kt, SearchScreen.kt, AdminChitsScreen.kt (same set: Calendar, Checklists, Alarms, Projects, Tasks, Notes) | |
|  819 |  `isSystemTag(tagName)` | ✅ Inline checks throughout Android (`tag !in SYSTEM_TAGS && !tag.startsWith("CWOC_System/")` — same logic, used in ChitCardEnhancements, SearchScreen, etc.) | |

---

### Recurrence

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  820 |  `_advanceRecurrence(current, freq, interval, byDayNums)` | ✅ A#503 (RecurrenceEngine.advanceDate — advances LocalDate by freq/interval, handles DAILY/WEEKLY/MONTHLY/YEARLY + byDay) | |
|  821 |  `expandRecurrence(chit, rangeStart, rangeEnd)` | ✅ A#504 (RecurrenceEngine.expand — expands recurring chit into instances for date range, handles exceptions/broken-off/completed) | |
|  822 |  `formatRecurrenceRule(rule, isHabit)` | ✅ A#505 (RecurrenceEngine.formatRule — formats rule into human-readable string like "Every 2 weeks on Mon, Wed") | |
|  823 |  `_recurrenceAddException(parentId, exception)` | ✅ ChitEntity.recurrenceExceptions modified locally + DirtyTracker.markDirty + PushEngine syncs to server (same outcome — exception added and persisted) | |
|  824 |  `_recurrenceRemoveException(parentId, dateStr)` | ✅ Same mechanism as W823 — modifies ChitEntity.recurrenceExceptions (removes entry for date), marks dirty, pushes via sync | |
|  825 |  `_dateModeSuppressUnsaved` | N/A (web-specific dirty-tracking suppression during init — Android ViewModel handles this via separate isDirty flag that's only set after initial load completes) | |
|  826 |  `onDateModeChange()` | ✅ A#1165 DateZone.applyDateMode (shows/hides date fields based on mode, handles perpetual defaults, auto-populates notifications; Compose reactive rendering) | |
|  827 |  `onDueCompleteToggle()` | N/A (function no longer exists in web codebase — due/complete toggle handled inline in editor-init.js) | |
|  828 |  `onStatusChange()` | ✅ ChitEditorScreen status dropdown onChange (updates formState.status; project unlinking handled via parentProjectId clearing; Compose reactive UI update) | |
|  829 |  `_detectDateMode(chit)` | ✅ A#1169 (DateZone.deriveDateMode — determines date mode from populated fields: due/startend/pointintime/perpetual/none) | |
|  830 |  `_setDateMode(mode)` | ✅ A#1165 (DateZone.applyDateMode — sets date mode state, triggers field visibility updates via Compose recomposition) | |
|  831 |  `toggleAllDay()` | ✅ A#1159 (DateZone.AllDayButton — toggles allDay state; time inputs hidden/shown reactively via Compose when allDay changes) | |
|  832 |  `_updateRecurrenceLabels()` | ✅ A#1167 (DateZone.buildContextualFreqOptions — builds contextual labels like "Weekly on Monday", "Monthly on the 15th" based on active date) | |
|  833 |  `onRecurrenceChange()` | ✅ A#1161 (DateZone.InlineRecurrenceRow — shows/hides custom recurrence fields based on frequency selection; Compose reactive) | |
|  834 |  `onRepeatToggle()` | ✅ A#1161 (InlineRecurrenceRow repeat checkbox — toggles visibility of frequency dropdown and recurrence options; Compose reactive) | |
|  835 |  `onRecurrenceFreqChange()` | ✅ A#1161 (InlineRecurrenceRow — shows by-day checkboxes when custom weekly selected; Compose conditional rendering) | |
|  836 |  `onRecurrenceEndsToggle()` | ✅ A#1161 (InlineRecurrenceRow "Ends never" checkbox — toggles until-date input visibility; Compose reactive) | |
|  837 |  `_buildRecurrenceRule()` | ✅ A#1161 InlineRecurrenceRow (builds RecurrenceRule JSON from UI state — freq, interval, byDay, until — and calls onRecurrenceRuleChanged) | |
|  838 |  `_loadRecurrenceRule(rule)` | ✅ A#1161 InlineRecurrenceRow initial state (reads formState.recurrenceRule JSON, populates freq dropdown, interval, byDay checkboxes, until date) | |
|  839 |  `clearStartAndEndDates()` | ✅ DateZone.applyDateMode clears date fields when mode changes (sets startDatetime/endDatetime/startTime/endTime to null in formState) | |
|  840 |  `clearDueDate()` | ✅ DateZone.applyDateMode clears due fields when mode changes (sets dueDatetime/dueTime to null in formState; same pattern as W839) | |
|  841 |  `onHabitToggle()` | ✅ A#1195 HabitsZone + DateZone habit toggle (enables habit mode, forces date mode/all-day/repeat, shows habit controls; formState.habit toggled) | |
|  842 |  `_updateHabitProgressDisplay()` | ✅ A#1194 HabitStatsDisplay (shows success/goal count with +/- buttons; Compose reactive recomposition on state change) | |
|  843 |  `onHabitGoalChange()` | ✅ A#1195 HabitsZone goal input onValueChange (clamps to min 1, updates formState.habitGoal; progress display recomposes reactively) | |
|  844 |  `_toggleAllDayBtn()` | ✅ A#1159 (DateZone.AllDayButton — handles toggle + visual state in single composable; no separate toggle/update functions needed) | |
|  845 |  `_updateAllDayBtnState()` | ✅ A#1159 (DateZone.AllDayButton — visual state managed by Compose based on isActive/isDisabled props; no separate update function needed) | |
|  846 |  `setPointInTimeNow()` | ✅ DateZone "Now" button (sets formState.pointInTime to current ISO datetime; same user-facing outcome) | |
|  847 |  `clearPointInTime()` | ✅ DateZone clear button (sets formState.pointInTime to null; same pattern as W839/W840) | |
|  848 |  `_initTimezonePicker()` | ✅ A#1164 DateZone.TimezoneLabel (shows current timezone with tap-to-change; Android uses system timezone list via java.time.ZoneId) | |
|  849 |  `_getTimezoneAbbreviation(ianaTimezone)` | ✅ A#1173 (DateZone.getTimezoneAbbr — converts IANA timezone to abbreviation like "EST", "PST") | |
|  850 |  `_getTimezoneLongName(ianaTimezone)` | ✅ A#1174 (DateZone.getTimezoneFullName — converts IANA timezone to full display name) | |
|  851 |  `_buildTzTooltip(ianaTimezone)` | N/A (web-specific hover tooltip — Android shows timezone info inline in TimezoneLabel; no hover tooltips on mobile) | |
|  852 |  `_injectTzAbbrevLabels()` | N/A (web-specific DOM injection of timezone labels next to time inputs — Android shows timezone in TimezoneLabel composable) | |
|  853 |  `_updateTzAbbrevLabels()` | N/A (web-specific DOM update — Android TimezoneLabel recomposes reactively when timezone changes) | |

---

### Indicators

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  854 |  `_ALERT_TYPES` | ✅ AlertsZone AlertItem.type field accepts same values (alarm, timer, stopwatch, notification); validated in AddAlertForm type selector | |
|  855 |  `_chitHasAlerts(chit)` | ✅ Inline checks in ChitCardEnhancements + NotificationScheduler (parses alerts JSON, checks for non-empty array with valid types) | |
|  856 |  `_ALERT_ICON_MAP` | ✅ AlertsZone + ChitCardEnhancements use same emoji icons for alert types (🔔 alarm, 📢 notification, ⏱️ timer, ⏱ stopwatch) | |
|  857 |  `_STATUS_ICONS` | ✅ ChitCardEnhancements + TasksScreen use status icons/colors (Material icons or colored indicators for ToDo/InProgress/Blocked/Complete/Rejected) | |
|  858 |  `_getAlertIndicators(chit, settings, context)` | ✅ ChitCardEnhancements inline alert indicator logic (shows 🔔/📢/⏱️ icons on cards based on alert types present; combined mode for calendar views) | |
|  859 |  `_getAllIndicators(chit, settings, context)` | ✅ ChitCardEnhancements indicator composables (ArchiveSnoozeIndicators, ChecklistProgressBadge, HealthIndicatorBadges, LocationIndicator, PeopleChipsRow, WeatherIndicator — same icons shown on cards) | |
|  860 |  `_shouldShow(mode, context)` | ✅ ChitCardEnhancements respects visual indicator settings (always/never/space modes; calendar views show fewer indicators for space) | |
|  861 |  `_chitAlertTypesPresent(chit)` | ✅ Inline in ChitCardEnhancements/AlertsZone (parses alerts JSON, determines which types are present for indicator display) | |
|  862 |  `_computePrerequisiteFlags(allChits)` | ✅ ChitEditorViewModel.checkPrereqAutoBlock + TasksScreen ⛓️ indicator (evaluates prereq statuses, auto-blocks/unblocks, shows blocked indicator on cards) | |
|  863 |  `_indInitViewMode()` | ✅ A#1459 IndicatorsScreen (initializes view mode from SidebarStateViewModel; Compose declarative — no explicit init needed) | |
|  864 |  `_indBuildModeToggleHtml(activeMode)` | ✅ A#1458 IndicatorsModeToggle (FilterChips for Graph/Calendar/Log mode selection) | |
|  865 |  `_indAttachModeToggleListener()` | N/A (web-specific DOM event wiring — Compose FilterChips have onClick directly in A#1458) | |
|  866 |  `displayIndicatorsView()` | ✅ A#1459 IndicatorsScreen (main composable — renders mode toggle, charts/calendar/log based on mode, time range selector) | |
|  867 |  `_indicatorsLoad()` | ✅ IndicatorsViewModel loads health entries from Room DB (reactive Flow; same data source — chits with health_data) | |
|  868 |  `_indSaveSelection()` | ✅ IndicatorsViewModel persists visible graph selection (SidebarStateViewModel.indicatorsVisibleGraphs) | |
|  869 |  `_indRestoreSelection()` | ✅ SidebarStateViewModel restores indicatorsVisibleGraphs from SharedPreferences on init | |
|  870 |  `_indPopulateGraphFilter()` | ✅ IndicatorsScreen graph filter chips (populated from available indicator types in health data; same filtering UI) | |
|  871 |  `_indFmtDate(d)` | ✅ IndicatorsScreen inline date formatting (LocalDate.format for chart labels and log entries) | |
|  872 |  `_indicatorsSetRange(range)` | ✅ A#1461 (IndicatorsViewModel.setTimeRange — sets time range for data filtering; same ranges: week/month/quarter/year/all) | |
|  873 |  `_indicatorsHighlightBtn(range)` | N/A (web-specific DOM class toggle — Compose FilterChip `selected` prop handles active state highlighting) | |
|  874 |  `_indicatorsLoadCustomRange()` | ✅ SidebarStateViewModel.setIndicatorsCustomRange (reads custom start/end dates, applies to IndicatorsViewModel filtering) | |
|  875 |  `_indToggleExpand(key)` | ✅ IndicatorChartCard expand/collapse state (each chart card can be expanded/collapsed independently) | |

---

### Omni View

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  876 |  `displayOmniView(filteredChits)` | ✅ A#1565 OmniViewScreen (main composable — renders all Omni sections based on config, filters chits into sections) | |
|  877 |  `_buildOmniSection(sectionConfig, widthClass)` | ✅ A#1563 OmniSectionHeader + section content composables (each section rendered as header + content based on config) | |
|  878 |  `_populateOmniSections(filteredChits, visibleSections)` | ✅ A#1578 OmniViewViewModel.sectionData + filter functions (filterChronoAnchored, filterOnDeck, filterSoon, filterReminders, etc.) | |
|  879 |  `_omniDeduplicateChits(filteredChits)` | ⚠️ Partial — Android sections independently filter chits (no cross-section deduplication; a chit may appear in multiple sections) | W879-omniDeduplicateChits.md |
|  880 |  `_renderOmniChrono(contentEl, chronoItems, viSettings)` | ✅ A#1556 OmniChronoCard (renders chronological items with time, title, indicators; same data display) | |
|  881 |  `_buildTimeUntilBadge(startTime, now)` | ✅ A#1569 TimeUntilBadge (shows countdown like "in 2h 30m" for upcoming events) | |
|  882 |  `_formatTimeUntil(minutes)` | ✅ A#1572 computeTimeUntil (formats duration into "Xh Ym" or "in X min" human-readable string) | |
|  883 |  `_renderOmniOnDeck(contentEl, ondeckItems, viSettings)` | ✅ A#1555 OmniChitCard (renders on-deck items with title, status, priority, indicators) | |
|  884 |  `_renderOmniSoon(contentEl, soonItems, viSettings)` | ✅ A#1564 OmniSoonCard (renders upcoming items with due date badge and countdown) | |
|  885 |  `_buildDueDateBadge(dueDate, now)` | ✅ A#1554 DueDateBadge + A#1570 computeDueDateText (shows "Due today", "Due in 3d", "Overdue 2d" badge) | |
|  886 |  `_renderOmniWeather(contentEl)` | ✅ A#1566 OmniWeatherBar + A#1567 OmniWeatherStrip (renders weather forecast strip with hourly icons and temps) | |
|  887 |  `_populateOmniWeatherBar(bar)` | ✅ A#1600 OmniViewViewModel.loadWeatherData (fetches weather data and populates OmniWeatherBar state) | |
|  888 |  `_buildWeatherBarContent(bar, daily, locationLabel)` | ✅ A#1567 OmniWeatherStrip (renders hourly weather icons, temps, location label — same visual content) | |
|  889 |  `_renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings)` | ✅ A#1561 OmniPinnedAllCard + A#1591 filterPinnedNotes (renders pinned notes with title and preview) | |
|  890 |  `_renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings)` | ✅ A#1561 OmniPinnedAllCard + A#1590 filterPinnedChecklists (renders pinned checklists with progress) | |
|  891 |  `_renderOmniEmail(contentEl, allEmailChits)` | ✅ A#1557 OmniEmailCard + A#1586 filterEmailChits (renders email section with thread cards, pagination) | |
|  892 |  `_getOmniEnabledBundles()` | ✅ OmniViewViewModel uses omniBundleToggles from settings to filter which email bundles appear in Omni email section | |

---

### Custom Objects

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  893 |  `_coFetchAll()` | ✅ A#1011 CustomObjectsViewModel.loadAll (fetches all custom objects from /api/custom-objects) | |
|  894 |  `_coRenderList()` | ✅ CustomObjectsScreen TypeGroupSection + ObjectRow (renders grouped list of custom objects with status, type, actions) | |
|  895 |  `_coOpenEditModal(obj)` | ✅ CustomObjectsScreen EditObjectDialog (modal for creating/editing custom objects with all fields) | |
|  896 |  `_coSaveObject()` | ✅ A#1004 createObject + A#1022 updateObject (POST/PUT to /api/custom-objects) | |
|  897 |  `_coToggleActive(objectId, newActive)` | ✅ A#1021 toggleActive (PATCH active status on custom object) | |
|  898 |  `_coConfirmDelete()` | ✅ A#1006 deleteObject (confirm dialog + DELETE /api/custom-objects/{id}) | |
|  899 |  `_coRestoreObject(objectId)` | ✅ A#1018 restoreObject (restores a deleted custom object) | |

---

### Attachments

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  900 |  `loadAttachments()` | ✅ A#817 AttachmentsViewModel.loadAttachments (fetches from /api/attachments, populates state for AttachmentsScreen) | |
|  901 |  `renderGrid(wrap)` | ⚠️ Partial — A#801, A#800 (grid renders but missing chit title on cards) | W901-renderGrid.md |

---

### User Admin

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  902 |  `_loadUsers()` | ✅ A#1898 UserAdminViewModel.loadUsers() — fetches from /api/users, populates state for UserAdminScreen | |
|  903 |  `_renderUserTable()` | ✅ A#1892, A#1893 — UserAdminScreen renders LazyColumn of UserCard composables showing profile image, username, display name, email, status/role badges, with edit dialog on tap | |
|  904 |  `openCreateUserModal()` | ✅ A#1886 CreateUserDialog — AlertDialog with username, display name, email, password, admin toggle fields | |
|  905 |  `submitCreateUser()` | ✅ A#1896 UserAdminViewModel.createUser() — validates, POSTs to /api/users, shows success message, refreshes list | |
|  906 |  `deactivateUser(userId)` | ✅ A#1897 UserAdminViewModel.deactivateUser() — PUTs to /api/users/{id}/deactivate, shows message, refreshes list | |
|  907 |  `reactivateUser(userId)` | ✅ A#1899 UserAdminViewModel.reactivateUser() — PUTs to /api/users/{id}/reactivate, shows message, refreshes list | |

---

### Sync

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  908 |  `initSyncWebSocket()` | ✅ A#371, A#373, A#380, A#362 — WebSocketClientImpl.connect() establishes /ws/sync connection with reconnect backoff; SyncOrchestrator.start() initiates on app startup | |
|  909 |  `_startSyncPolling()` | ✅ A#369 SyncWorker.enqueue() — periodic WorkManager sync every 5 min as fallback when WebSocket unavailable (mobile-appropriate equivalent of web's 2s HTTP polling) | |
|  910 |  `_pollSync()` | ✅ A#358 SyncEngine.performSync(since) — fetches changes from server since watermark, processes them into local DB (equivalent of web's poll endpoint fetch + dispatch) | |
|  911 |  `_dispatchSyncMessage(msg)` | ✅ A#362 SyncOrchestrator.start() collects WebSocket messages and dispatches by type (handleWebSocketMessage triggers incremental pull on "change" messages) | |
|  912 |  `syncSend(type, data)` | ✅ A#363, A#364 SyncPushEngine.pushAll()/pushSingle() — pushes dirty records to server via REST API; server broadcasts to other clients (mobile-appropriate equivalent of web's WebSocket send) | |
|  913 |  `syncOn(type, callback)` | ✅ A#362 SyncOrchestrator.start() — collects WebSocketClient.messages Flow and dispatches by type (Kotlin Flow equivalent of JS callback registration) | |
|  914 |  `_pageHasUnsavedChanges()` | N/A — web-specific page-refresh concept; Android uses reactive Compose UI + Room dirty tracking to handle sync without page reloads | |
|  915 |  `_showAutoRefreshBanner()` | N/A — web-specific; Android's reactive Compose UI auto-updates when Room DB changes from sync, no manual refresh banner needed | |
|  916 |  `_handleRemoteDataChange(type)` | N/A — web-specific page-reload pattern; Android's reactive architecture (Room → Flow → Compose recomposition) auto-updates UI when sync writes new data | |

---

### Utilities

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  917 |  `_convertTemp(c)` | ✅ A#1937 UnitConverter.formatTemperature() — converts Celsius to user's preferred unit (metric/imperial) | |
|  918 |  `_tempUnit()` | ✅ A#1937 UnitConverter.formatTemperature() — includes unit symbol (°C/°F) in formatted output | |
|  919 |  `_isMetricUnits()` | ✅ Settings entity `unitSystem` field — checked inline wherever unit conversion is needed (e.g., passed to UnitConverter functions) | |
|  920 |  `_convertWind(kmh)` | ✅ A#1936 UnitConverter.formatSpeed() — converts km/h to mph for imperial, keeps km/h for metric | |
|  921 |  `_tempBarRange()` | ✅ TemperatureBar.kt composable (Canvas gradient bar, color stops -10°C→40°C, day range overlay at full opacity, metric/imperial scale) + WeatherScreen.kt DailyForecastRow integration | |
|  922 |  `generateUniqueId()` | ✅ UUID.randomUUID().toString() used throughout Android codebase (e.g., ChitEditorViewModel, ChecklistOperationsV2.generateId()) | |
|  923 |  `formatDate(date)` | ✅ A#1924 DateUtils.formatDisplayDate() — formats ISO datetime string for display | |
|  924 |  `formatTime(date)` | ✅ A#1926 DateUtils.formatDisplayTime() — formats ISO datetime string to time display | |
|  925 |  `setSaveButtonUnsaved()` | N/A — web-specific CwocSaveSystem UI pattern; Android ViewModels manage dirty state reactively via Compose state | |
|  926 |  `contrastColorForBg(hex)` | ✅ A#600 CwocChitCardStyle.contrastTextColor() — same luminance formula, returns dark/light text color for given background | |
|  927 |  `applyChitColors(el, bgColor)` | ✅ A#598 CwocChitCardStyle.cardColorsForChit() — applies background color and auto-contrast text color to card composables | |
|  928 |  `isLightColor(hex)` | ✅ A#600 CwocChitCardStyle.contrastTextColor() + inline isLightColor() in KioskScreen.kt, CollectionsSettingsTab.kt — same luminance threshold check | |
|  929 |  `_utcToLocalDate(isoString)` | ✅ A#1924-1927 DateUtils functions parse ISO strings and convert to local time via Java time APIs (Instant, LocalDateTime, ZonedDateTime) | |
|  930 |  `_parseISOTime(isoString)` | ✅ A#1926 DateUtils.formatDisplayTime() — parses ISO datetime and returns formatted time string | |
|  931 |  `getPastelColor(label)` | ✅ generatePastelColor() in FilterColors.kt — deterministic pastel color from string label (explicitly matches web behavior) | |
|  932 |  `_convertDBDateToDisplayDate(dateString)` | ✅ A#1924 DateUtils.formatDisplayDate() — converts ISO datetime string to display date format | |
|  933 |  `getCurrentTimezone()` | ✅ SettingsFormState.timezoneOverride + defaultTimezone fields — Android uses timezone override → device ZoneId.systemDefault() → default timezone fallback chain | |
|  934 |  `convertTimezoneForDisplay(isoString, fromTz, toTz, opts)` | ✅ Java time API (ZonedDateTime.withZoneSameInstant, Instant.atZone) used throughout Android for timezone conversion — ClockModal, DateZone, OmniView, etc. | |
|  935 |  `getChitDisplayTime(chit, field, currentTz)` | ✅ DateUtils formatters + RecurrenceEngine timezone-aware expansion + TasksScreen timezone warning indicator — Android handles floating vs anchored chit time display | |
|  936 |  `_cwocWeatherIcons` | ✅ weatherCodeToIcon() in WeatherModal.kt, getWeatherIcon() in WeatherScreen.kt, weatherCodeToEmoji() in ChitCardEnhancements.kt — same WMO code → emoji map | |
|  937 |  `_cwocGetWeatherIcon(code)` | ✅ getWeatherIcon() in WeatherScreen.kt, weatherCodeToIcon() in WeatherModal.kt — looks up WMO code in emoji map | |
|  938 |  `_cwocGetPrecipType(code)` | ✅ Inline in WeatherScreen.kt and WeatherModal.kt — checks if code is in snow list (❄️) else rain (💧); minor: thunder ⚡ not distinguished | |
|  939 |  `_cwocFormatPrecip(precipMm, weatherCode, emptyVal)` | ✅ Inline in WeatherScreen.kt — formats as "💧/❄️ X.X mm" (different format but same info: amount + type icon) | |
|  940 |  `_isViewerRole(chit)` | ✅ SharingUtils.isViewerRole() in domain/sharing/SharingUtils.kt — checks if current user has viewer-only access; used in CalendarTimeGrid, TasksScreen, etc. | |
|  941 |  `_isSharedChit(chit)` | ✅ SharingUtils.resolveEffectiveRole() returns non-null for shared chits; also chit.shares field checked inline throughout the app | |
|  942 |  `_emptyState(message)` | ✅ TasksEmptyState(), FilteredEmptyState() in TasksScreen.kt + per-screen EmptyState composables throughout the app | |
|  943 |  `_getTagColor(tagName)` | ✅ tagColor()/tagColorFromHash() + tagColorMap from settings — looks up configured color, falls back to hash-based color (ChitCardEnhancements.kt, EmailCardEnhanced.kt) | |
|  944 |  `_getTagFontColor(tagName)` | ✅ TagNode.fontColor field + TagCreateDialog + ChitCardEnhancements TagChip — configured font color from settings, fallback to contrast calculation | |
|  945 |  `_buildChitHeader(chit, titleHtml, settings, opts)` | ✅ A#1844 IndicatorIcons + A#566 ArchiveSnoozeIndicators + A#567 ChecklistProgressBadge + A#577 WeatherIndicator + per-screen card composables — renders all header indicators, title, and meta | |
|  946 |  `_buildNotePreview(chit, extraStyle)` | ✅ A#624 MarkdownRenderer composable (full) + A#1933 renderToAnnotatedString (truncated preview) in NotesScreen — markdown note preview with expand/collapse | |
|  947 |  `_renderChitMeta(chit, mode)` | N/A — legacy dead code (returns empty div), superseded by _buildChitHeader; no Android equivalent needed | |
|  948 |  `_updateUrlHash()` | N/A — web-specific browser URL hash management; Android uses Jetpack Navigation NavGraph for navigation state | |
|  949 |  `_loadBundlesForModal(selectEl)` | ✅ A#1765 SettingsViewModel.loadBundles() + AddToBundleSheet/BundlePickerDialog — loads bundles from settings and presents for selection | |
|  950 |  `_populateBundleSelect(selectEl, bundles)` | ✅ AddToBundleSheet renders bundle list as LazyColumn items — same data, platform-appropriate rendering | |
|  951 |  `cwocPlayAudio(audio, opts)` | ✅ A#531 AlarmSoundPlayer.play() + A#532 playLooping() — MediaPlayer-based audio with loop support; vibration via notification channels | |
|  952 |  `_getTodayISO()` | ✅ LocalDate.now().toString() used throughout Android — produces same YYYY-MM-DD format | |
|  953 |  `_syncSidebarTagCheckboxes(container, tagObjects)` | N/A — web-specific DOM manipulation for sidebar tag filter checkboxes; Android uses FilterSortViewModel + TagTreeFilter composable for tag filtering | |
|  954 |  `_escOmniHtml(str)` | N/A — HTML escaping utility (alias for _escHtml); Android Compose handles text safely without HTML injection concerns | |

---

## Priority 4: Web-Only (N/A — No Android Equivalent Needed)

Functions that are inherently web-only and don't need Android implementation.

---

### DOM Manipulation & Browser APIs

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  955 |  `_escHtml(str)` | N/A — HTML escaping for DOM innerHTML; Compose text rendering is inherently safe | |
|  956 |  `_escHtml(str)` (shared.js) | N/A — HTML escaping for DOM innerHTML; Compose text rendering is inherently safe | |
|  957 |  `_escHtml(str)` (main-email.js) | N/A — HTML escaping for DOM innerHTML; Compose text rendering is inherently safe | |
|  958 |  `_escapeHtml(str)` (indicators) | N/A — HTML escaping for DOM innerHTML; Compose text rendering is inherently safe | |
|  959 |  `_calcCreatePopover()` | N/A — web-specific DOM popover for calculator; Android has CalculatorSheet composable | |
|  960 |  `_calcClampToViewport(el)` | N/A — web-specific viewport clamping for popover positioning | |
|  961 |  `_buildWeatherModalHTML(content)` | N/A — web-specific DOM construction; Android has WeatherModal composable | |
|  962 |  `_getBreakpointCategory()` | N/A — web-specific CSS breakpoint detection; Android uses Compose adaptive layouts | |
|  963 |  `_onDebouncedResize()` | N/A — web-specific window resize handler; Android handles orientation/size changes natively | |
|  964 |  `_parseUrlHash()` | N/A — web-specific URL hash parsing; Android uses Jetpack Navigation | |
|  965 |  `_updateUrlHash()` | N/A — web-specific URL hash management; Android uses Jetpack Navigation | |
|  966 |  `cwocTagModal.inject()` | N/A — web-specific DOM injection for tag modal; Android has TagsPickerSheet composable | |
|  967 |  `Auto-header/footer injection` | N/A — web-specific shared-page.js DOM injection; Android uses Scaffold composable pattern | |

---

### Keyboard Shortcuts / Hotkeys

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  968 |  `_cwocHotkeyTabMap` | N/A — web-only keyboard shortcut mapping; no physical keyboard on mobile | |
|  969 |  `_cwocIsDashboard()` | N/A — web-only hotkey context check | |
|  970 |  `_cwocSwitchTab(tabName)` | N/A — web-only hotkey tab switching; Android uses bottom nav/tab row taps | |
|  971 |  `_cwocHandleActionHotkey(keyLower, e)` | N/A — web-only keyboard shortcut handler | |
|  972 |  `_cwocDispatchHotkey(e)` | N/A — web-only keyboard shortcut dispatcher | |
|  973 |  `_resolveHotkeyTab(keyLower)` | N/A — web-only hotkey tab resolution | |
|  974 |  `_showPanel(panelId)` | N/A — web-only hotkey panel display | |
|  975 |  `_hideAllPanels()` | N/A — web-only hotkey panel management | |
|  976 |  `_dimSidebar(activeId, activeFilterGroupId)` | N/A — web-only sidebar dimming for hotkey mode | |
|  977 |  `_undimSidebar()` | N/A — web-only sidebar undimming | |
|  978 |  `_exitHotkeyMode()` | N/A — web-only hotkey mode exit | |
|  979 |  `_pickNav(href)` | N/A — web-only hotkey navigation picker | |
|  980 |  `_pickPeriod(period)` | N/A — web-only hotkey period picker | |
|  981 |  `_openModePanel()` | N/A — web-only hotkey mode panel | |
|  982 |  `_enterFilterSub(type)` | N/A — web-only hotkey filter sub-panel | |
|  983 |  `_buildFilterSubPanel(containerId, checkboxSelector)` | N/A — web-only hotkey filter panel builder | |
|  984 |  `_rulesSetupHotkey()` | N/A — web-only hotkey for rules | |
|  985 |  `_initSharedHotkeys()` | N/A — web-only shared hotkey initialization | |
|  986 |  `cwocInitEditorHotkeys(zoneMap, saveFns)` | N/A — web-only editor keyboard shortcuts | |
|  987 |  `_toggleFilterArchived()` | N/A — web-only hotkey filter toggle | |
|  988 |  `_toggleFilterPinned()` | N/A — web-only hotkey filter toggle | |
|  989 |  `_filterFocusSearch()` | N/A — web-only hotkey search focus | |
|  990 |  `_pickSort(field)` | N/A — web-only hotkey sort picker | |
|  991 |  `_hotkeyMode` | N/A — web-only hotkey mode state variable | |
|  992 |  `_calcSetupHotkey()` | N/A — web-only calculator hotkey setup | |

---

### CSS Concerns

| # | Section | Status | |
|-----|---------|-------------|-------------------|----------|
| CSS Variables (shared-page.css) | Parchment colors, brown tones, accent gold | N/A — web CSS; Android uses Compose Material3 theme + CwocTheme colors | |
| Base Body | Parchment background, font | N/A — web CSS; Android uses Scaffold + theme | |
| Page Panel | Main content wrapper | N/A — web CSS; Android uses Scaffold | |
| Page Header Bar | Logo + title + nav buttons | N/A — web CSS; Android uses TopAppBar | |
| Standard Button | Gradient nav/action buttons | N/A — web CSS; Android uses Material3 Button | |
| Settings Grid | CSS Grid for settings layouts | N/A — web CSS; Android uses Column/Row composables | |
| Form Elements | Select, input, textarea styling | N/A — web CSS; Android uses Material3 form components | |
| Tables | Shared table styling | N/A — web CSS; Android uses LazyColumn/Card layouts | |
| Tag Chips | Inline tag chip styling | N/A — web CSS; Android uses Material3 chips | |
| Empty State | Centered empty-state message | N/A — web CSS; Android uses Box + Column composables | |
| Modal | Full-screen modal overlay | N/A — web CSS; Android uses AlertDialog/ModalBottomSheet | |
| Calculator Popover | Calculator styling | N/A — web CSS; Android uses CalculatorSheet composable | |
| Maps Page Layout | Full viewport map layout | N/A — web CSS; Android uses MapView composable | |
| CSS Variables (shared-editor.css) | Editor color palette | N/A — web CSS; Android uses theme colors | |
| Header Row | Logo + title + buttons | N/A — web CSS; Android uses TopAppBar | |
| Zone Container Pattern | Collapsible sections | N/A — web CSS; Android uses EditorZoneHeader composable | |
| Main Zones Grid | Two-column grid | N/A — web CSS; Android uses Column layout | |
| Toggle Switch | On/off toggle | N/A — web CSS; Android uses Material3 Switch | |
| User Switcher | User switcher styles | N/A — web CSS; Android uses dropdown composable | |
| Overlay (timepicker) | Full-screen backdrop | N/A — web CSS; Android uses Material3 TimePicker | |
| Modal (timepicker) | Bottom-sheet/centered card | N/A — web CSS; Android uses Material3 TimePicker | |
| Drums | Scroll columns | N/A — web CSS; Android uses Material3 TimePicker | |
| Buttons (timepicker) | Cancel/Now/Set row | N/A — web CSS; Android uses Material3 TimePicker | |
| Shared Variables (styles-variables.css) | Parchment, brown tones | N/A — web CSS; Android uses CwocTheme | |
| Dashboard-specific Variables | Sidebar bg/border | N/A — web CSS; Android uses drawer/sidebar composable | |
| Body (styles-layout.css) | Parchment background, font | N/A — web CSS; Android uses theme | |
| Header | Title styling | N/A — web CSS; Android uses TopAppBar | |
| Week Navigation | Period nav buttons | N/A — web CSS; Android uses CalendarScreen nav | |
| Completed Task | Dimmed styling | N/A — web CSS; Android uses alpha/opacity modifiers | |
| Sidebar (styles-sidebar.css) | Fixed positioning, slide-in | N/A — web CSS; Android uses ModalDrawer | |
| Filter Groups | Collapsible filter sections | N/A — web CSS; Android uses FilterSortPanel composable | |
| Multi-select Controls | Checkbox lists | N/A — web CSS; Android uses Checkbox composables | |
| Sort Controls | Sort dropdown and direction | N/A — web CSS; Android uses SortPanel composable | |
| Notification Inbox | Notification badge and list | N/A — web CSS; Android uses system notifications | |
| Tab Bar (styles-tabs.css) | Flex container | N/A — web CSS; Android uses CwocTabRow composable | |
| Tab Styling | Background, border, hover | N/A — web CSS; Android uses CwocTabRow theme | |
| Tab Count | Badge indicators | N/A — web CSS; Android uses Badge composable | |
| Week View Grid (styles-calendar.css) | CSS Grid layout | N/A — web CSS; Android uses CalendarTimeGrid composable | |
| Day Headers | Sticky headers | N/A — web CSS; Android uses stickyHeader in LazyColumn | |
| Timed Events | Absolute-positioned cards | N/A — web CSS; Android uses offset modifiers | |
| All-day Events | Multi-day spanning | N/A — web CSS; Android uses AllDayRow composable | |
| Month Grid | Month view cells | N/A — web CSS; Android uses MonthGrid composable | |
| Year View | Compact year overview | N/A — web CSS; Android uses YearView composable | |
| Itinerary View | List-style display | N/A — web CSS; Android uses ItineraryView composable | |
| Time-now Bar | Current time indicator | N/A — web CSS; Android uses Canvas drawLine | |
| Chit Card (styles-cards.css) | Border, padding, color | N/A — web CSS; Android uses CwocChitCardStyle | |
| Card Header Row | Title, meta, states | N/A — web CSS; Android uses Row composables | |
| Drag Feedback | Visual feedback during drag | N/A — web CSS; Android uses drag modifier feedback | |
| Notes Masonry | Multi-column layout | N/A — web CSS; Android uses StaggeredGrid | |
| People Chips | People name chips | N/A — web CSS; Android uses PeopleChipsRow composable | |
| Checklist Container (editor.css) | Item layout, drag, nesting | N/A — web CSS; Android uses ChecklistZone composable | |
| Zone Extensions | Health, color, chit-specific | N/A — web CSS; Android uses zone composables | |
| Notes Modal | Expandable notes modal | N/A — web CSS; Android uses BottomSheet | |
| Date Mode Layout | Radio-based date selector | N/A — web CSS; Android uses DateZone composable | |
| Projects Zone | Kanban container | N/A — web CSS; Android uses ProjectsScreen composable | |
| Sharing Panel | Sharing zone styles | N/A — web CSS; Android uses sharing section in editor | |
| People Expand Modal | Full-screen people modal | N/A — web CSS; Android uses PeopleZone composable | |
| Email Zone Container (editor-email.css) | Border, collapse | N/A — web CSS; Android uses EmailZone composable | |
| Email Field Rows | Label + input pairs | N/A — web CSS; Android uses OutlinedTextField | |
| Email Body | Textarea styling | N/A — web CSS; Android uses TextField | |
| Recipient Tag Chips | Chip styling | N/A — web CSS; Android uses RecipientChipField | |
| Email Thread Section | Thread conversation view | N/A — web CSS; Android uses EmailThreadView | |
| HTML Email Rendering | Toggle, iframe | N/A — web CSS; Android uses WebView/HtmlRenderer | |
| Attachment List (editor-attachments.css) | Flex layout for items | N/A — web CSS; Android uses AttachmentsZone composable | |
| Upload Area | Drop zone | N/A — web CSS; Android uses file picker intent | |

---

### Tab Sync (BroadcastChannel)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  993 |  `cwocTabSyncInvalidate()` | N/A — web-only BroadcastChannel for multi-tab sync; Android is single-instance | |
|  994 |  `cwocTabSyncIsLeader()` | N/A — web-only tab leader election; Android is single-instance | |
|  995 |  `cwocTabSyncBroadcastChits(chitsData)` | N/A — web-only BroadcastChannel for multi-tab data sharing; Android is single-instance | |

---

### Print Functions

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  996 |  `_printNoteWithChoice(text, title)` | N/A — web-only print functionality; Android uses system share/print intent | |
|  997 |  `_openPrintTab(text, title, mode)` | N/A — web-only print tab; Android uses system print service | |
|  998 |  `_printChit()` | N/A — web-only print; Android uses system share/print intent | |
|  999 |  `_printNote(event)` | N/A — web-only print; Android uses system share/print intent | |

---

### Service Worker / PWA

| # | File | Status | |
|-----|------|-------------|-------------------|----------|
|  1000 |  `manifest.json` | N/A — PWA manifest; Android is a native app | |
|  1001 |  `sw.js` | N/A — service worker for offline caching; Android uses Room DB for offline | |
|  1002 |  `pwa-register.js` | N/A — PWA registration; Android is a native app | |
|  1003 |  `offline.html` | N/A — PWA offline fallback page; Android uses Room DB for offline access | |

---

### Install Scripts (Server-Only)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1004 |  `install_tailscale()` | N/A — server provisioning script; not app code | |
|  1005 |  `deploy_ha_integration()` | N/A — server provisioning script; not app code | |

---

### Mobile Web Workarounds (Not Needed on Native)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1006 |  `initMobileActionsModal()` | N/A — mobile web workaround; native Android has proper touch interactions | |
|  1007 |  `_openMobileActionsModal()` | N/A — mobile web workaround; native Android has proper context menus | |
|  1008 |  `_isMobileOverlay()` | N/A — mobile web detection; Android is always native mobile | |
|  1009 |  `_toggleTopbar()` | N/A — mobile web topbar toggle; Android uses TopAppBar natively | |
|  1010 |  `_restoreTopbarState()` | N/A — mobile web topbar state; Android manages TopAppBar natively | |
|  1011 |  `initAudioUnlock()` | N/A — web audio autoplay policy workaround; Android MediaPlayer has no such restriction | |
|  1012 |  `_onNotesDragKey(e)` | N/A — web keyboard+drag workaround; Android uses native drag gestures | |

---

### Deprecated / Legacy

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1013 |  `_quickAlertAddToChit(type)` | N/A — deprecated/legacy web code | |
|  1014 |  `_quickAlertAddIndependent(type)` | N/A — deprecated/legacy web code | |
|  1015 |  `_quickAlertAddIndependentDashboard(type)` | N/A — deprecated/legacy web code | |
|  1016 |  `enableLongPress(el, callback)` | N/A — deprecated; Android uses combinedClickable(onLongClick) natively | |

---

### Test Files (Not App Code)

| # | Symbol | Status | |
|-----|--------|-------------|-------------------|----------|
| Property 3 (test_habits_helpers.js) | getCurrentPeriodDate property test | N/A — web test file; Android has its own test suite | |
| Property 4 (test_habits_success_rate.js) | Success rate calculation test | N/A — web test file; Android has its own test suite | |
| Property 5 (test_habits_streak.js) | Streak calculation test | N/A — web test file; Android has its own test suite | |
| Property 8 (test_habits_sort.js) | Completion-based sort test | N/A — web test file; Android has its own test suite | |

---

## Priority 5: Android Framework (Handled Natively)

Functions where Android handles the equivalent natively through Compose, system APIs, or framework features.

---

### Touch Gestures (Compose Gesture System)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1017 |  `TOUCH_DRAG_HOLD_MS` | N/A — web touch polyfill constant; Android Compose has native gesture detection | |
|  1018 |  `TOUCH_LONGPRESS_HOLD_MS` | N/A — web touch polyfill constant; Android uses ViewConfiguration.longPressTimeout | |
|  1019 |  `TOUCH_DRAG_MOVE_THRESHOLD` | N/A — web touch polyfill constant; Android uses touchSlop from LocalDensity | |
|  1020 |  `enableTouchDrag(element, callbacks, options)` | N/A — web touch polyfill; Android uses Modifier.pointerInput/detectDragGestures | |
|  1021 |  `enableTouchGesture(element, callbacks, options)` | N/A — web touch polyfill; Android uses Modifier.combinedClickable/pointerInput | |

---

### Layout (Compose Layout)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1022 |  `NOTES_CARD_WIDTH` | N/A — web masonry layout constant; Android uses StaggeredGrid/adaptive columns | |
|  1023 |  `NOTES_GAP` | N/A — web masonry layout constant; Android uses Arrangement.spacedBy | |
|  1024 |  `_notesColMetrics(container)` | N/A — web masonry column calculation; Android uses LazyStaggeredGrid | |
|  1025 |  `_notesColLeft(colIdx, actualCardWidth)` | N/A — web masonry positioning; Android uses LazyStaggeredGrid | |
|  1026 |  `_assignMissingCols(cards, colCount)` | N/A — web masonry column assignment; Android uses LazyStaggeredGrid | |
|  1027 |  `_buildNoteColumns(cards, colCount)` | N/A — web masonry column building; Android uses LazyStaggeredGrid | |
|  1028 |  `_stackColumn(colCards, colIdx, actualCardWidth, skipCard)` | N/A — web masonry stacking; Android uses LazyStaggeredGrid | |
|  1029 |  `applyNotesLayout(container)` | N/A — web masonry layout application; Android uses LazyStaggeredGrid | |

---

### Navigation (Compose Navigation)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1030 |  `Navigate Panel` | N/A — web navigation panel; Android uses Jetpack Navigation + bottom nav | |
|  1031 |  `DOMContentLoaded handler` | N/A — web page load event; Android uses Activity/Fragment lifecycle | |

---

### Drag & Reorder (Compose Drag Modifiers)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1032 |  `enableNotesDragReorder(container, tab, onReorder)` | N/A — web drag-reorder; Android uses Modifier.pointerInput + detectDragGestures | |
|  1033 |  `_onNotesDragMove(e)` | N/A — web drag event handler; Android uses Compose drag modifiers | |
|  1034 |  `_onNotesDragMoveXY(clientX, clientY)` | N/A — web drag coordinate handler; Android uses Compose offset modifiers | |
|  1035 |  `_onNotesDragEnd(e)` | N/A — web drag end handler; Android uses onDragEnd in gesture detection | |
|  1036 |  `_edgeScrollUpdate(container, clientY, opts)` | N/A — web edge-scroll during drag; Android handles scroll during drag natively | |
|  1037 |  `_edgeScrollStop()` | N/A — web edge-scroll stop; Android handles this natively | |
|  1038 |  `_markDragJustEnded()` | N/A — web drag state flag; Android uses Compose state | |

---

### Sidebar Backdrop (ModalDrawer)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1039 |  `_ensureSidebarBackdrop()` | N/A — web sidebar backdrop; Android uses ModalDrawer with built-in scrim | |
|  1040 |  `_showSidebarBackdrop()` | N/A — web sidebar backdrop show; Android ModalDrawer handles scrim natively | |
|  1041 |  `_hideSidebarBackdrop()` | N/A — web sidebar backdrop hide; Android ModalDrawer handles scrim natively | |

---

### Audio (MediaPlayer)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
| Audio playback functions | Web audio API usage | N/A — web Audio API; Android uses MediaPlayer/AlarmSoundPlayer | |

---

### Calculator Drag (Bottom Sheet on Android)

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1042 |  `_calcInitDrag(titleBar)` | N/A — web calculator drag; Android uses ModalBottomSheet for calculator | |
|  1043 |  `_calcDragStart(clientX, clientY)` | N/A — web calculator drag; Android uses ModalBottomSheet | |
|  1044 |  `_calcDragMove(clientX, clientY)` | N/A — web calculator drag; Android uses ModalBottomSheet | |
|  1045 |  `_calcDragEnd()` | N/A — web calculator drag; Android uses ModalBottomSheet | |
|  1046 |  `_calcInitKeyboard(popover)` | N/A — web calculator keyboard nav; Android uses native keyboard | |
|  1047 |  `_calcInitFocusTrap(popover)` | N/A — web focus trap; Android handles focus natively | |
|  1048 |  `_calcIsEditorPage()` | N/A — web page detection; Android uses navigation state | |

---

### Timezone Detection

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1049 |  `_detectBrowserTimezone()` | N/A — web Intl.DateTimeFormat timezone detection; Android uses ZoneId.systemDefault() | |

---

### Load Order & File Dependencies

> Load order is a web-only concern. Android uses Hilt dependency injection and Compose navigation — no script load order needed.

| Concept | Android Equivalent | Status | |
|-----|---------|-------------------|----------|
| Script load order | Hilt `@Inject` + `@HiltViewModel` | N/A — web-only concern; Android uses Hilt DI | |
| Global variables | ViewModel StateFlow / Repository | N/A — web-only concern; Android uses ViewModel state | |
| DOM manipulation | Compose recomposition | N/A — web-only concern; Android uses Compose | |
| Event listeners | Compose gesture modifiers + callbacks | N/A — web-only concern; Android uses Compose modifiers | |
| localStorage | SharedPreferences / Room DB | N/A — web-only concern; Android uses SharedPreferences/Room | |
| fetch() API calls | Retrofit `CwocApiService` | N/A — web-only concern; Android uses OkHttp/Retrofit | |
| CSS styling | Material3 Theme + custom composables | N/A — web-only concern; Android uses Compose theming | |

---

### Web-Only Storage

| # | Function | Description | Android Equivalent | Gap File |
|-----|----------|-------------|-------------------|----------|
|  1050 |  `MANUAL_ORDER_KEY` | N/A — web localStorage key; Android uses Room DB for sort order persistence | |
|  1051 |  `SORT_PREFS_KEY` | N/A — web localStorage key; Android uses SharedPreferences for sort prefs | |
|  1052 |  `_saveWeatherCacheToLS()` | N/A — web localStorage weather cache; Android uses Room/SharedPreferences | |

---


## Summary Statistics

| Category | Count | Status |
|-----|----------|-------|
| Total web functions mapped | 1,052 | ✅ Complete |
| **Priority 1** — Core Parity Gaps | ~130 | Audited |
| **Priority 2** — Feature Gaps | ~120 | Audited |
| **Priority 3** — Implemented ✅ | ~450 | Audited |
| **Priority 4** — Web-Only (N/A) | ~200 | Audited |
| **Priority 5** — Android Framework | ~100 | Audited |

### Priority 1 Breakdown (Core Gaps)

| Feature Area | Function Count | Status |
|---|---|---|
| Habits System | 22 | Audited |
| Editor Send-Content / Send-Item | 19 | Audited |
| People Zone (Full Tree, Sharing) | 16 | Audited |
| Calendar Drag-and-Drop | 10 | Audited |
| Health Indicators Zone | 10 | Audited |
| Editor Prerequisites | 8 | Audited |
| Quick Alert Modal | 7 | Audited |
| Custom Zones in Editor | 6 | Audited |
| Editor Auto-Save | 6 | Audited |
| Auto-Complete Checklist → Status | 5 | Audited |
| Chit Link Autocomplete | 5 | Audited |
| Recurrence Series / Break-Off | 5 | Audited |
| Notes Fullscreen Modal | 3 | Audited |
| Export/Import Data | 3 | Audited |
| Calendar Pinch-to-Zoom | 2 | Audited |
