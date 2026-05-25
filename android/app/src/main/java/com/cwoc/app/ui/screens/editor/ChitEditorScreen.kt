package com.cwoc.app.ui.screens.editor

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FileCopy
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.FormatStrikethrough
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Surface
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.tags.TagNode
import com.cwoc.app.ui.components.CalculatorSheet
import com.cwoc.app.ui.components.ContactAvatar
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.screens.editor.zones.AlertsZone
import com.cwoc.app.ui.screens.editor.zones.ChecklistZoneV2
import com.cwoc.app.ui.screens.editor.zones.ColorZone
import com.cwoc.app.ui.screens.editor.zones.DateZone
import com.cwoc.app.ui.screens.editor.zones.EditorZoneHeader
import com.cwoc.app.ui.screens.editor.zones.HabitsZone
import com.cwoc.app.ui.screens.editor.zones.TagsPickerSheet
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocInputDefaults
import com.cwoc.app.ui.theme.CwocAgedBrownDark
import com.cwoc.app.ui.theme.CwocBackground
import com.cwoc.app.ui.theme.CwocOutline
import com.cwoc.app.ui.theme.CwocPrimary
import androidx.compose.material3.Button

/**
 * Full-screen editor for creating and editing chits.
 * Phase 2 remediation: all 43 audit gaps addressed.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun ChitEditorScreen(
    chitId: String,
    sourceTab: String? = null,
    onNavigateBack: () -> Unit,
    viewModel: ChitEditorViewModel = hiltViewModel(),
    chitRepository: ChitRepository? = null
) {
    val formState by viewModel.formState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSaved by viewModel.isSaved.collectAsState()
    val editorSettings by viewModel.editorSettings.collectAsState()
    val showUnsavedDialog by viewModel.showUnsavedDialog.collectAsState()
    val tagTree by viewModel.tagTree.collectAsState()
    val recentTags by viewModel.recentTags.collectAsState()
    val lastSavedAt by viewModel.lastSavedAt.collectAsState()
    val contactNames by viewModel.contactNames.collectAsState()
    val contactColors by viewModel.contactColors.collectAsState()
    val contactImages by viewModel.contactImages.collectAsState()
    val peopleSearchResults by viewModel.peopleSearchResults.collectAsState()
    val availableChitsForPicker by viewModel.availableChitsForPicker.collectAsState()

    var isPinned by remember { mutableStateOf(false) }
    var isArchived by remember { mutableStateOf(false) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    var showOptionsMenu by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showCalculator by remember { mutableStateOf(false) }
    var showQrDialog by remember { mutableStateOf(false) }
    // 18.1: Timezone detected from Location zone geocoding, passed to DateZone for suggestion prompt
    var suggestedTimezone by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current

    LaunchedEffect(formState.id, isLoading) {
        if (!isLoading && !formState.isNew && chitRepository != null) {
            val entity = chitRepository.getById(formState.id)
            if (entity != null) {
                isPinned = entity.pinned
                isArchived = entity.archived
            }
        }
    }

    BackHandler(enabled = true) {
        viewModel.onBackPressed()
    }

    LaunchedEffect(isSaved) {
        if (isSaved) {
            onNavigateBack()
        }
    }

    // Unsaved Changes Dialog
    if (showUnsavedDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.cancelBack() },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Unsaved Changes", style = CwocDialogDefaults.titleStyle) },
            text = { Text("You have unsaved changes. What would you like to do?") },
            confirmButton = {
                TextButton(onClick = { viewModel.saveAndExit() }, colors = CwocDialogDefaults.confirmButtonColors()) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelBack() }) {
                    Text("Cancel")
                }
                TextButton(onClick = { viewModel.discardAndExit() }, colors = CwocDialogDefaults.confirmButtonColors()) {
                    Text("Discard")
                }
            }
        )
    }

    // Delete Confirmation Dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Delete Chit?", style = CwocDialogDefaults.titleStyle) },
            text = { Text("This chit will be moved to trash.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteChit()
                }, colors = CwocDialogDefaults.dangerButtonColors()) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ─── Zone Navigation State ────────────────────────────────────────────
    val isDirty by viewModel.isDirty.collectAsState()
    val zoneState = rememberEditorZoneState(
        sourceTab = sourceTab,
        hasDatePrefill = false
    )

    // Update visible zones when form state changes (email/habit visibility)
    LaunchedEffect(formState.emailStatus, formState.habit) {
        zoneState.updateVisibleZones(formState)
    }

    // ─── Auto-Navigate to Email Zone for Existing Email Chits ─────────────
    // When opened from a notification with sourceTab=Email, jump directly to the email section
    LaunchedEffect(sourceTab, formState.isNew, formState.emailStatus) {
        if (sourceTab == "Email" && !formState.isNew && formState.emailStatus != null) {
            // Small delay to ensure updateVisibleZones has run first
            delay(100)
            zoneState.navigateToZoneId("emailSection")
        }
    }

    // ─── Auto-Focus for New Chits (Notes / Checklists) ────────────────────
    val notesFocusRequester = remember { FocusRequester() }
    val checklistFocusRequester = remember { FocusRequester() }

    LaunchedEffect(sourceTab, formState.isNew) {
        if (formState.isNew && (sourceTab == "Notes" || sourceTab == "Checklists")) {
            delay(300)
            try {
                when (sourceTab) {
                    "Notes" -> notesFocusRequester.requestFocus()
                    "Checklists" -> checklistFocusRequester.requestFocus()
                }
            } catch (_: Exception) {
                // Component may not be composed yet — silently ignore
            }
        }
    }

    // Parse chit color for nav bar
    val chitNavColor = remember(formState.color) {
        val colorStr = formState.color
        if (colorStr != null && colorStr != "transparent") {
            try {
                val hex = colorStr.removePrefix("#")
                val colorLong = when (hex.length) {
                    6 -> (0xFF000000 or hex.toLong(16))
                    8 -> hex.toLong(16)
                    else -> null
                }
                colorLong?.let { Color(it.toInt()) }
            } catch (_: Exception) { null }
        } else null
    }

    // Build actions for the sidebar
    val sidebarActions = remember(isDirty, isPinned, isArchived, formState.showOnCalendar, formState.notification, formState.isNew) {
        buildList {
            // ─── Navigation group ───
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = "← Exit",
                onClick = { viewModel.onBackPressed() }
            ))
            if (isDirty) {
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "🚪 Save & Exit",
                    onClick = { viewModel.save() },
                    isHighlighted = true
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "📌 Save & Stay",
                    onClick = { viewModel.saveAndStay() },
                    isHighlighted = true
                ))
            }

            // ─── Separator ───
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = "",
                onClick = {},
                isSeparator = true
            ))

            // ─── All options (flattened, no duplicates) ───
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = if (formState.showOnCalendar == false) "🗓️ Show in Calendar" else "🗓️ Hide in Calendar",
                onClick = { viewModel.updateForm(formState.copy(showOnCalendar = !(formState.showOnCalendar ?: true))) }
            ))
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = if (formState.notification == true) "🔕 Remove Reminder" else "🔔 Mark as Reminder",
                onClick = { viewModel.updateForm(formState.copy(notification = !(formState.notification ?: false))) }
            ))
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = "🧮 Calculator",
                onClick = { showCalculator = true }
            ))
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = "📱 QR Code",
                onClick = { showQrDialog = true }
            ))
            add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                label = "😴 Snooze",
                onClick = { showSnoozeDialog = true }
            ))
            if (!formState.isNew) {
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = if (isPinned) "📌 Unpin" else "📌 Pin",
                    onClick = {
                        chitRepository?.let { repo ->
                            coroutineScope.launch {
                                if (isPinned) { repo.unpin(formState.id); isPinned = false }
                                else { repo.pin(formState.id); isPinned = true }
                            }
                        }
                    }
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = if (isArchived) "📦 Unarchive" else "📦 Archive",
                    onClick = {
                        chitRepository?.let { repo ->
                            coroutineScope.launch {
                                if (isArchived) { repo.unarchive(formState.id); isArchived = false }
                                else { repo.archive(formState.id); isArchived = true }
                            }
                        }
                    }
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "📋 Duplicate",
                    onClick = { viewModel.duplicateChit() }
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "📤 Share",
                    onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, formState.title)
                            putExtra(Intent.EXTRA_TEXT, buildShareText(formState))
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Chit"))
                    }
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "✉️ Make Email",
                    onClick = { viewModel.updateForm(formState.copy(emailStatus = "draft")) }
                ))
                add(com.cwoc.app.ui.screens.editor.zones.ActionItem(
                    label = "🗑️ Delete",
                    onClick = { showDeleteConfirm = true },
                    isDanger = true
                ))
            }
        }
    }

    // Options menu removed — all options are now directly in the actions sidebar

    // ─── Main Layout: Nav Header + Zone Content + Sidebars ──────────────
    Box(modifier = Modifier.fillMaxSize()) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(48.dp))
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
                // Sticky nav header with swipe for prev/next zone (matching web)
                // Uses a consumed flag to ensure only ONE zone change per swipe gesture
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .pointerInput(Unit) {
                            var startX = 0f
                            var startTime = 0L
                            var consumed = false
                            detectHorizontalDragGestures(
                                onDragStart = { offset ->
                                    startX = offset.x
                                    startTime = System.currentTimeMillis()
                                    consumed = false
                                },
                                onDragEnd = { consumed = false },
                                onDragCancel = { consumed = false },
                                onHorizontalDrag = { change, _ ->
                                    if (consumed) return@detectHorizontalDragGestures
                                    val elapsed = System.currentTimeMillis() - startTime
                                    val totalDrag = change.position.x - startX
                                    if (elapsed < 500 && kotlin.math.abs(totalDrag) > 80) {
                                        if (totalDrag < 0) {
                                            zoneState.nextZone()
                                        } else {
                                            zoneState.prevZone()
                                        }
                                        consumed = true
                                    }
                                }
                            )
                        }
                ) {
                    com.cwoc.app.ui.screens.editor.zones.EditorZoneNavHeader(
                        chitTitle = formState.title,
                        currentZoneIndex = zoneState.currentZoneIndex,
                        totalZones = zoneState.totalZones,
                        currentZoneLabel = zoneState.currentZone.label,
                        chitColor = chitNavColor,
                        hasUnsavedChanges = isDirty,
                        repeatEnabled = !formState.recurrenceRule.isNullOrBlank(),
                        habitActive = formState.habit,
                        isOverviewZone = zoneState.currentZone.id == "titleZone",
                        onTitleChange = { viewModel.updateForm(formState.copy(title = it)) },
                        onActionsClick = { zoneState.showActionsSidebar = true; focusManager.clearFocus() },
                        onZoneListClick = { zoneState.showZoneList = true; focusManager.clearFocus() }
                    )
                }

                // Zone content — single zone at a time, scrollable
                // Apply chit color as background (matching web: mainEditor.style.backgroundColor = hex)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .background(chitNavColor ?: CwocBackground)
                        .pointerInput(Unit) {
                            var startX = 0f
                            var startTime = 0L
                            detectHorizontalDragGestures(
                                onDragStart = { offset ->
                                    startX = offset.x
                                    startTime = System.currentTimeMillis()
                                },
                                onDragEnd = {},
                                onDragCancel = {},
                                onHorizontalDrag = { change, dragAmount ->
                                    val elapsed = System.currentTimeMillis() - startTime
                                    val totalDrag = change.position.x - startX
                                    if (elapsed < 500 && kotlin.math.abs(totalDrag) > 100) {
                                        if (totalDrag < 0 && !zoneState.showZoneList && !zoneState.showActionsSidebar) {
                                            zoneState.showZoneList = true
                                            focusManager.clearFocus()
                                            startX = change.position.x // reset to prevent re-trigger
                                        } else if (totalDrag > 0 && !zoneState.showActionsSidebar && !zoneState.showZoneList) {
                                            zoneState.showActionsSidebar = true
                                            focusManager.clearFocus()
                                            startX = change.position.x
                                        }
                                    }
                                }
                            )
                        }
                ) {
                    // Notes zone gets special treatment: rendered directly in the Box
                    // (not inside the scrollable Column) so the toolbar can be pinned
                    // above the keyboard using imePadding().
                    if (zoneState.currentZone.id == "notesSection") {
                        val chitLinkSuggestions by viewModel.chitLinkSuggestions.collectAsState()
                        NotesZone(
                            note = formState.note,
                            onNoteChange = { viewModel.updateForm(formState.copy(note = it)) },
                            context = context,
                            onMoveToChecklist = { lines ->
                                val gson = com.google.gson.Gson()
                                val existingItems: MutableList<Map<String, Any>> = try {
                                    if (!formState.checklist.isNullOrBlank() && formState.checklist != "[]") {
                                        gson.fromJson(formState.checklist, object : com.google.gson.reflect.TypeToken<MutableList<Map<String, Any>>>() {}.type)
                                    } else mutableListOf()
                                } catch (_: Exception) { mutableListOf() }
                                val newItems = lines.map { text ->
                                    mapOf<String, Any>("id" to java.util.UUID.randomUUID().toString(), "text" to text, "level" to 0.0, "checked" to false)
                                }
                                existingItems.addAll(newItems)
                                viewModel.updateForm(formState.copy(checklist = gson.toJson(existingItems)))
                            },
                            chitLinkSuggestions = chitLinkSuggestions,
                            onChitLinkSearch = { viewModel.searchChitTitles(it) },
                            availableChits = availableChitsForPicker,
                            onSendNoteToChit = { targetChitId, mode -> viewModel.sendNoteToChit(targetChitId, mode) },
                            externalFocusRequester = notesFocusRequester,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .navigationBarsPadding()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        // Render the current zone's content
                        when (zoneState.currentZone.id) {
                            "titleZone" -> {
                                // Pin button row (title is now in the nav header)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    // Pin button (matches web's bookmark icon in title row)
                                    IconButton(
                                        onClick = {
                                            chitRepository?.let { repo ->
                                                coroutineScope.launch {
                                                    if (isPinned) { repo.unpin(formState.id); isPinned = false }
                                                    else { repo.pin(formState.id); isPinned = true }
                                                }
                                            }
                                        },
                                        modifier = Modifier.size(36.dp)
                                    ) {
                                        Text(
                                            text = if (isPinned) "📌" else "📍",
                                            fontSize = 18.sp
                                        )
                                    }
                                    Text(
                                        text = if (isPinned) "Pinned" else "Not pinned",
                                        color = CwocAgedBrownDark.copy(alpha = 0.6f),
                                        fontSize = 13.sp
                                    )
                                }
                                TitleMetadataRow(formState = formState)

                                if (formState.isNew && sourceTab != null) {
                                    // New chit: embed the relevant zone content inline
                                    Spacer(modifier = Modifier.height(12.dp))
                                    HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                                    Spacer(modifier = Modifier.height(12.dp))

                                    when (sourceTab) {
                                        "Calendar" -> {
                                            DateZone(
                                                startDatetime = formState.startDatetime,
                                                endDatetime = formState.endDatetime,
                                                dueDatetime = formState.dueDatetime,
                                                pointInTime = formState.pointInTime,
                                                perpetual = formState.perpetual,
                                                allDay = formState.allDay,
                                                timezone = formState.timezone,
                                                onStartDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(startDatetime = it)) },
                                                onEndDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(endDatetime = it)) },
                                                onDueDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(dueDatetime = it)) },
                                                onPointInTimeChange = { viewModel.updateForm(viewModel.formState.value.copy(pointInTime = it)) },
                                                onPerpetualChange = { viewModel.updateForm(viewModel.formState.value.copy(perpetual = it)) },
                                                onAllDayChange = { viewModel.updateForm(viewModel.formState.value.copy(allDay = it)) },
                                                onTimezoneChange = { viewModel.updateForm(viewModel.formState.value.copy(timezone = it)) },
                                                status = formState.status,
                                                onStatusChange = { viewModel.updateForm(viewModel.formState.value.copy(status = it)) },
                                                recurrenceRule = formState.recurrenceRule,
                                                onRecurrenceRuleChanged = { viewModel.updateForm(viewModel.formState.value.copy(recurrenceRule = it)) },
                                                recurrenceExceptions = formState.recurrenceExceptions,
                                                suggestedTimezone = suggestedTimezone,
                                                habitActive = formState.habit,
                                                habitResetPeriod = formState.habitResetPeriod,
                                                onHabitResetPeriodChange = { viewModel.updateForm(viewModel.formState.value.copy(habitResetPeriod = it)) },
                                                isNewChit = formState.isNew,
                                                timeFormat = editorSettings.timeFormat,
                                                calendarSnap = editorSettings.calendarSnap,
                                                defaultTimezone = editorSettings.defaultTimezone,
                                                defaultNotifications = editorSettings.defaultNotifications,
                                                alertsJson = formState.alerts,
                                                onAlertsChanged = { viewModel.updateForm(viewModel.formState.value.copy(alerts = it)) },
                                                highlightDueDate = false
                                            )
                                        }
                                        "Tasks" -> {
                                            // Status
                                            DropdownField(
                                                label = "Status",
                                                value = formState.status,
                                                options = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected"),
                                                onValueChange = { viewModel.updateForm(formState.copy(status = it)) }
                                            )
                                            // Priority
                                            DropdownField(
                                                label = "Priority",
                                                value = formState.priority,
                                                options = listOf("High", "Medium", "Low"),
                                                onValueChange = { viewModel.updateForm(formState.copy(priority = it)) }
                                            )
                                            // Severity
                                            DropdownField(
                                                label = "Severity",
                                                value = formState.severity,
                                                options = listOf("Critical", "Major", "Normal", "Minor"),
                                                onValueChange = { viewModel.updateForm(formState.copy(severity = it)) }
                                            )
                                            // Assignee
                                            DropdownField(
                                                label = "Assignee",
                                                value = formState.assignedTo,
                                                options = editorSettings.sharedUsers,
                                                onValueChange = { newAssignee ->
                                                    val updatedPeople = if (newAssignee != null && newAssignee.isNotBlank() && !formState.people.contains(newAssignee)) {
                                                        formState.people + newAssignee
                                                    } else {
                                                        formState.people
                                                    }
                                                    viewModel.updateForm(formState.copy(assignedTo = newAssignee, people = updatedPeople))
                                                }
                                            )
                                            // Auto-Complete & Habit toggles
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text("Auto-Complete", style = MaterialTheme.typography.labelSmall)
                                                    androidx.compose.material3.Switch(
                                                        checked = formState.autoCompleteChecklist ?: false,
                                                        onCheckedChange = { viewModel.updateForm(formState.copy(autoCompleteChecklist = it)) },
                                                        modifier = Modifier.height(24.dp)
                                                    )
                                                }
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text("Habit", style = MaterialTheme.typography.labelSmall)
                                                    androidx.compose.material3.Switch(
                                                        checked = formState.habit,
                                                        onCheckedChange = { viewModel.updateForm(formState.copy(habit = it)) },
                                                        modifier = Modifier.height(24.dp)
                                                    )
                                                }
                                            }
                                            // Prerequisites
                                            Spacer(modifier = Modifier.height(8.dp))
                                            PrerequisitesZone(
                                                prerequisites = formState.prerequisites,
                                                onPrerequisitesChange = { viewModel.updateForm(formState.copy(prerequisites = it)) }
                                            )
                                        }
                                        "Notes" -> {
                                            OutlinedTextField(
                                                value = formState.note,
                                                onValueChange = { viewModel.updateForm(formState.copy(note = it)) },
                                                label = { Text("Notes") },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height(200.dp)
                                                    .focusRequester(notesFocusRequester),
                                                colors = CwocInputDefaults.outlinedColors(),
                                                maxLines = 10
                                            )
                                        }
                                        "Checklists" -> {
                                            ChecklistZoneV2(
                                                checklistJson = formState.checklist,
                                                chitId = chitId,
                                                isNewChit = formState.isNew,
                                                autoSaveEnabled = formState.checklistAutosave == "enabled",
                                                onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) },
                                                onStatusChange = { viewModel.updateForm(formState.copy(status = it)) },
                                                noteText = formState.note,
                                                onNoteChange = { viewModel.updateForm(formState.copy(note = it ?: "")) },
                                                autoCompleteEnabled = formState.autoCompleteChecklist == true,
                                                currentStatus = formState.status,
                                                availableChits = availableChitsForPicker,
                                                onSendItemsToChit = { targetId, items -> viewModel.sendChecklistItemsToChit(targetId, items) },
                                                externalFocusRequester = checklistFocusRequester
                                            )
                                        }
                                        "Alarms" -> {
                                            AlertsZone(
                                                alertsJson = formState.alerts,
                                                onAlertsChanged = { viewModel.updateForm(formState.copy(alerts = it)) },
                                                timeFormat = editorSettings.timeFormat,
                                                calendarSnap = editorSettings.calendarSnap
                                            )
                                        }
                                        "Projects" -> {
                                            // Projects zone
                                            LaunchedEffect(formState.childChits) {
                                                viewModel.loadChildChitSummaries(formState.childChits)
                                            }
                                            val childChitSummaries by viewModel.childChitSummaries.collectAsState()
                                            ProjectsZone(
                                                isProjectMaster = formState.isProjectMaster,
                                                childChits = formState.childChits,
                                                childChitSummaries = childChitSummaries,
                                                onProjectMasterChange = { viewModel.updateForm(formState.copy(isProjectMaster = it)) },
                                                onChildChitsChange = { viewModel.updateForm(formState.copy(childChits = it)) },
                                                onChildStatusChange = { childId, newStatus ->
                                                    viewModel.updateChildChitStatus(childId, newStatus)
                                                }
                                            )
                                            // Checklist zone (Projects shows both)
                                            Spacer(modifier = Modifier.height(12.dp))
                                            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                                            Spacer(modifier = Modifier.height(12.dp))
                                            ChecklistZoneV2(
                                                checklistJson = formState.checklist,
                                                chitId = chitId,
                                                isNewChit = formState.isNew,
                                                autoSaveEnabled = formState.checklistAutosave == "enabled",
                                                onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) },
                                                onStatusChange = { viewModel.updateForm(formState.copy(status = it)) },
                                                noteText = formState.note,
                                                onNoteChange = { viewModel.updateForm(formState.copy(note = it ?: "")) },
                                                autoCompleteEnabled = formState.autoCompleteChecklist == true,
                                                currentStatus = formState.status,
                                                availableChits = availableChitsForPicker,
                                                onSendItemsToChit = { targetId, items -> viewModel.sendChecklistItemsToChit(targetId, items) },
                                                externalFocusRequester = checklistFocusRequester
                                            )
                                        }
                                        "Indicators" -> {
                                            val indicatorObjects by viewModel.indicatorObjects.collectAsState()
                                            HealthIndicatorsZone(
                                                healthData = formState.healthData,
                                                onHealthDataChange = { viewModel.updateForm(formState.copy(healthData = it)) },
                                                indicatorObjects = indicatorObjects
                                            )
                                        }
                                        "Email" -> {
                                            // Email zone content handled by the dedicated emailSection zone
                                            // Navigate there instead
                                            LaunchedEffect(Unit) {
                                                zoneState.navigateToZoneId("emailSection")
                                            }
                                        }
                                    }
                                } else {
                                    // Existing chit (or new with no sourceTab): show overview summary rows
                                    Spacer(modifier = Modifier.height(12.dp))
                                    val overviewRows = remember(formState) { buildOverviewRows(formState, sourceTab) }
                                    com.cwoc.app.ui.screens.editor.zones.OverviewZoneContent(
                                        rows = overviewRows,
                                        onRowClick = { targetZoneId -> zoneState.navigateToZoneId(targetZoneId) },
                                        chitColor = chitNavColor
                                    )
                                }
                            }

                            "datesSection" -> {
                                DateZone(
                                    startDatetime = formState.startDatetime,
                                    endDatetime = formState.endDatetime,
                                    dueDatetime = formState.dueDatetime,
                                    pointInTime = formState.pointInTime,
                                    perpetual = formState.perpetual,
                                    allDay = formState.allDay,
                                    timezone = formState.timezone,
                                    onStartDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(startDatetime = it)) },
                                    onEndDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(endDatetime = it)) },
                                    onDueDatetimeChange = { viewModel.updateForm(viewModel.formState.value.copy(dueDatetime = it)) },
                                    onPointInTimeChange = { viewModel.updateForm(viewModel.formState.value.copy(pointInTime = it)) },
                                    onPerpetualChange = { viewModel.updateForm(viewModel.formState.value.copy(perpetual = it)) },
                                    onAllDayChange = { viewModel.updateForm(viewModel.formState.value.copy(allDay = it)) },
                                    onTimezoneChange = { viewModel.updateForm(viewModel.formState.value.copy(timezone = it)) },
                                    status = formState.status,
                                    onStatusChange = { viewModel.updateForm(viewModel.formState.value.copy(status = it)) },
                                    recurrenceRule = formState.recurrenceRule,
                                    onRecurrenceRuleChanged = { viewModel.updateForm(viewModel.formState.value.copy(recurrenceRule = it)) },
                                    recurrenceExceptions = formState.recurrenceExceptions,
                                    suggestedTimezone = suggestedTimezone,
                                    habitActive = formState.habit,
                                    habitResetPeriod = formState.habitResetPeriod,
                                    onHabitResetPeriodChange = { viewModel.updateForm(viewModel.formState.value.copy(habitResetPeriod = it)) },
                                    isNewChit = formState.isNew,
                                    timeFormat = editorSettings.timeFormat,
                                    calendarSnap = editorSettings.calendarSnap,
                                    defaultTimezone = editorSettings.defaultTimezone,
                                    defaultNotifications = editorSettings.defaultNotifications,
                                    alertsJson = formState.alerts,
                                    onAlertsChanged = { viewModel.updateForm(viewModel.formState.value.copy(alerts = it)) },
                                    highlightDueDate = (sourceTab == "Tasks" && formState.isNew)
                                )
                            }

                            "taskSection" -> {
                                // Status
                                DropdownField(
                                    label = "Status",
                                    value = formState.status,
                                    options = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected"),
                                    onValueChange = { viewModel.updateForm(formState.copy(status = it)) }
                                )
                                // Priority
                                DropdownField(
                                    label = "Priority",
                                    value = formState.priority,
                                    options = listOf("High", "Medium", "Low"),
                                    onValueChange = { viewModel.updateForm(formState.copy(priority = it)) }
                                )
                                // Severity
                                DropdownField(
                                    label = "Severity",
                                    value = formState.severity,
                                    options = listOf("Critical", "Major", "Normal", "Minor"),
                                    onValueChange = { viewModel.updateForm(formState.copy(severity = it)) }
                                )
                                // Assignee
                                DropdownField(
                                    label = "Assignee",
                                    value = formState.assignedTo,
                                    options = editorSettings.sharedUsers,
                                    onValueChange = { newAssignee ->
                                        val updatedPeople = if (newAssignee != null && newAssignee.isNotBlank() && !formState.people.contains(newAssignee)) {
                                            formState.people + newAssignee
                                        } else {
                                            formState.people
                                        }
                                        viewModel.updateForm(formState.copy(assignedTo = newAssignee, people = updatedPeople))
                                    }
                                )
                                // Auto-Complete & Habit toggles
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Auto-Complete", style = MaterialTheme.typography.labelSmall)
                                        androidx.compose.material3.Switch(
                                            checked = formState.autoCompleteChecklist ?: false,
                                            onCheckedChange = { viewModel.updateForm(formState.copy(autoCompleteChecklist = it)) },
                                            modifier = Modifier.height(24.dp)
                                        )
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Habit", style = MaterialTheme.typography.labelSmall)
                                        androidx.compose.material3.Switch(
                                            checked = formState.habit,
                                            onCheckedChange = { viewModel.updateForm(formState.copy(habit = it)) },
                                            modifier = Modifier.height(24.dp)
                                        )
                                    }
                                }
                                // Prerequisites
                                Spacer(modifier = Modifier.height(8.dp))
                                PrerequisitesZone(
                                    prerequisites = formState.prerequisites,
                                    onPrerequisitesChange = { viewModel.updateForm(formState.copy(prerequisites = it)) }
                                )
                            }

                            "checklistSection" -> {
                                ChecklistZoneV2(
                                    checklistJson = formState.checklist,
                                    chitId = chitId,
                                    isNewChit = formState.isNew,
                                    autoSaveEnabled = formState.checklistAutosave == "enabled",
                                    onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) },
                                    onStatusChange = { viewModel.updateForm(formState.copy(status = it)) },
                                    noteText = formState.note,
                                    onNoteChange = { viewModel.updateForm(formState.copy(note = it ?: "")) },
                                    autoCompleteEnabled = formState.autoCompleteChecklist == true,
                                    currentStatus = formState.status,
                                    availableChits = availableChitsForPicker,
                                    onSendItemsToChit = { targetId, items -> viewModel.sendChecklistItemsToChit(targetId, items) },
                                    externalFocusRequester = checklistFocusRequester
                                )
                            }

                            "tagsSection" -> {
                                TagsZone(
                                    tags = formState.tags,
                                    tagTree = tagTree,
                                    recentTags = recentTags,
                                    onTagsChange = { viewModel.updateForm(formState.copy(tags = it)) },
                                    onTagCreated = { viewModel.onTagCreated(it) },
                                    onTagTracked = { viewModel.trackRecentTag(it) },
                                    currentColor = formState.color,
                                    onAutoColor = { color ->
                                        viewModel.updateForm(formState.copy(color = color))
                                    }
                                )
                            }

                            "peopleSection" -> {
                                val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
                                val serverUrl = prefs.getString("server_url", "") ?: ""
                                val authToken = prefs.getString("auth_token", "") ?: ""
                                PeopleZone(
                                    people = formState.people,
                                    stealth = formState.stealth,
                                    contactNames = contactNames,
                                    contactColors = contactColors,
                                    contactImages = contactImages,
                                    serverUrl = serverUrl,
                                    authToken = authToken,
                                    shares = formState.shares,
                                    sharedUsers = editorSettings.sharedUsers,
                                    assignedTo = formState.assignedTo,
                                    peopleSearchResults = peopleSearchResults,
                                    onPeopleSearchQueryChange = { viewModel.updatePeopleSearchQuery(it) },
                                    onPeopleChange = { viewModel.updateForm(formState.copy(people = it)) },
                                    onStealthChange = { viewModel.updateForm(formState.copy(stealth = it)) },
                                    onSharesChange = { viewModel.updateForm(formState.copy(shares = it)) },
                                    onAssignedToChange = { viewModel.updateForm(formState.copy(assignedTo = it)) }
                                )
                            }

                            "locationSection" -> {
                                LocationZone(
                                    location = formState.location,
                                    onLocationChange = { viewModel.updateForm(formState.copy(location = it.ifBlank { null })) },
                                    savedLocations = editorSettings.savedLocations,
                                    context = context,
                                    onTimezoneDetected = { detectedTz -> suggestedTimezone = detectedTz }
                                )
                            }

                            "alertsSection" -> {
                                AlertsZone(
                                    alertsJson = formState.alerts,
                                    onAlertsChanged = { viewModel.updateForm(formState.copy(alerts = it)) },
                                    timeFormat = editorSettings.timeFormat,
                                    calendarSnap = editorSettings.calendarSnap
                                )
                            }

                            "projectsSection" -> {
                                // Load child chit summaries when child IDs change
                                LaunchedEffect(formState.childChits) {
                                    viewModel.loadChildChitSummaries(formState.childChits)
                                }
                                val childChitSummaries by viewModel.childChitSummaries.collectAsState()
                                ProjectsZone(
                                    isProjectMaster = formState.isProjectMaster,
                                    childChits = formState.childChits,
                                    childChitSummaries = childChitSummaries,
                                    onProjectMasterChange = { viewModel.updateForm(formState.copy(isProjectMaster = it)) },
                                    onChildChitsChange = { viewModel.updateForm(formState.copy(childChits = it)) },
                                    onChildStatusChange = { childId, newStatus ->
                                        viewModel.updateChildChitStatus(childId, newStatus)
                                    }
                                )
                            }

                            "colorSection" -> {
                                ColorZone(
                                    selectedColor = formState.color,
                                    customColors = editorSettings.customColors,
                                    onColorSelected = { viewModel.updateForm(formState.copy(color = it)) }
                                )
                            }

                            "healthIndicatorsSection" -> {
                                val indicatorObjects by viewModel.indicatorObjects.collectAsState()
                                HealthIndicatorsZone(
                                    healthData = formState.healthData,
                                    onHealthDataChange = { viewModel.updateForm(formState.copy(healthData = it)) },
                                    indicatorObjects = indicatorObjects
                                )
                            }

                            "attachmentsSection" -> {
                                val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
                                val serverUrl = prefs.getString("server_url", "") ?: ""
                                val authToken = prefs.getString("auth_token", "") ?: ""
                                com.cwoc.app.ui.screens.editor.zones.AttachmentsZone(
                                    chitId = formState.id,
                                    attachmentsJson = formState.attachments,
                                    onAttachmentsChange = { viewModel.updateForm(formState.copy(attachments = it)) },
                                    serverUrl = serverUrl,
                                    authToken = authToken,
                                    okHttpClient = viewModel.okHttpClient,
                                    isNewChit = formState.isNew,
                                    onCommitAttachments = { callback ->
                                        if (callback != null) viewModel.registerOnSaveCallback(callback)
                                    },
                                    onRollbackAttachments = { callback ->
                                        if (callback != null) viewModel.registerOnDiscardCallback(callback)
                                    }
                                )
                            }

                            "emailSection" -> {
                                if (formState.emailStatus == "draft" || formState.emailStatus == "received" || formState.emailStatus == "sent") {
                                    val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
                                    val emailAccountsJson = prefs.getString("email_accounts", null)
                                    val emailAccounts = remember(emailAccountsJson) {
                                        try {
                                            if (!emailAccountsJson.isNullOrBlank()) {
                                                com.google.gson.Gson().fromJson<List<String>>(
                                                    emailAccountsJson,
                                                    object : com.google.gson.reflect.TypeToken<List<String>>() {}.type
                                                )
                                            } else emptyList()
                                        } catch (_: Exception) { emptyList() }
                                    }
                                    com.cwoc.app.ui.screens.editor.zones.EmailComposeZone(
                                        formState = formState,
                                        emailAccounts = emailAccounts,
                                        contactNames = contactNames,
                                        onFormUpdate = { viewModel.updateForm(it) },
                                        onSend = { viewModel.sendEmail() },
                                        onSendLater = { },
                                        onSendAndArchive = { viewModel.sendEmail() },
                                        onDiscard = { viewModel.discardEmailDraft() },
                                        onReply = { },
                                        onForward = { },
                                        onArchive = { }
                                    )
                                }
                            }

                            "habitLogSection" -> {
                                HabitsZone(
                                    isHabit = formState.habit,
                                    habitGoal = formState.habitGoal,
                                    habitSuccess = formState.habitSuccess,
                                    habitResetPeriod = formState.habitResetPeriod,
                                    habitLastActionDate = formState.habitLastActionDate,
                                    habitHideOverall = formState.habitHideOverall,
                                    showOnCalendar = formState.showOnCalendar,
                                    onHabitToggle = { viewModel.updateForm(formState.copy(habit = it)) },
                                    onGoalChange = { viewModel.updateForm(formState.copy(habitGoal = it)) },
                                    onSuccessIncrement = {
                                        val current = formState.habitSuccess ?: 0
                                        viewModel.updateForm(formState.copy(
                                            habitSuccess = current + 1,
                                            habitLastActionDate = java.time.LocalDate.now().toString()
                                        ))
                                    },
                                    onSuccessDecrement = {
                                        val current = formState.habitSuccess ?: 0
                                        if (current > 0) viewModel.updateForm(formState.copy(habitSuccess = current - 1))
                                    },
                                    onResetPeriodChange = { viewModel.updateForm(formState.copy(habitResetPeriod = it)) },
                                    onHideOverallChange = { viewModel.updateForm(formState.copy(habitHideOverall = it)) },
                                    onShowOnCalendarChange = { viewModel.updateForm(formState.copy(showOnCalendar = it)) }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))
                    }
                    } // end else (non-notes zones)
                }

            }
        }

        // Zone List Panel (right sidebar overlay)
        com.cwoc.app.ui.screens.editor.zones.ZoneListPanel(
            visible = zoneState.showZoneList,
            zones = zoneState.visibleZones,
            currentZoneIndex = zoneState.currentZoneIndex,
            isZoneEmpty = { zoneId -> isZoneEmpty(zoneId, formState) },
            onZoneSelected = { index -> zoneState.navigateTo(index) },
            onDismiss = { zoneState.showZoneList = false }
        )

        // Actions Sidebar (left sidebar overlay)
        com.cwoc.app.ui.screens.editor.zones.ActionsSidebar(
            visible = zoneState.showActionsSidebar,
            actions = sidebarActions,
            onDismiss = { zoneState.showActionsSidebar = false }
        )
    }
    // Snooze picker dialog
    if (showSnoozeDialog) {
        SnoozePickerDialog(
            is24Hour = (editorSettings.timeFormat == "24hour"),
            calendarSnap = editorSettings.calendarSnap,
            onSnoozeSelected = { isoString ->
                chitRepository?.let { repo ->
                    coroutineScope.launch { repo.snooze(formState.id, isoString) }
                }
                showSnoozeDialog = false
            },
            onDismiss = { showSnoozeDialog = false }
        )
    }

    // Calculator bottom sheet
    if (showCalculator) {
        CalculatorSheet(
            onDismiss = { showCalculator = false },
            onInsert = { result ->
                val currentNote = formState.note
                viewModel.updateForm(formState.copy(note = currentNote + result))
                showCalculator = false
            }
        )
    }

    // QR Code dialog (matches web's _showQRCode with link/data toggle)
    if (showQrDialog && !formState.isNew) {
        val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        com.cwoc.app.ui.components.ChitQrCodeDialog(
            chitId = formState.id,
            chitTitle = formState.title,
            chitStatus = formState.status ?: "",
            chitPriority = formState.priority ?: "",
            chitTags = formState.tags,
            chitNote = formState.note,
            chitDue = formState.dueDatetime ?: "",
            chitStart = formState.startDatetime ?: "",
            chitEnd = formState.endDatetime ?: "",
            serverUrl = serverUrl,
            onDismiss = { showQrDialog = false }
        )
    }
}

// ─── Title Metadata Row (gaps 1-3) ──────────────────────────────────────────────

/**
 * Displays owner chip, nest thread label, and recurrence icon below the title.
 */
@Composable
private fun TitleMetadataRow(formState: ChitFormState) {
    val hasMetadata = formState.ownerDisplayName != null ||
        formState.nestThreadId != null ||
        formState.recurrenceRule != null ||
        formState.habit

    if (!hasMetadata) return

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Owner chip (gap 1/6)
        if (formState.ownerDisplayName != null) {
            AssistChip(
                onClick = {},
                label = { Text(formState.ownerDisplayName, style = MaterialTheme.typography.labelSmall) }
            )
        }
        // Nest thread label (gap 2/7) — P1: now clickable
        if (formState.nestThreadId != null) {
            Box(
                modifier = Modifier
                    .background(
                        MaterialTheme.colorScheme.secondaryContainer,
                        RoundedCornerShape(4.dp)
                    )
                    .clickable {
                        // P1: Clicking the thread label would open a thread picker
                        // to change/view the thread this chit is nested into
                    }
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "Thread",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }
        // Recurrence icon (gap 3/8)
        // 13.7: Show 🎯 with title "Habit" when habit active
        // 13.12: Show 🔁 with title "Recurring chit" when repeat enabled (habit not active)
        // 16.3: Hide when repeat disabled and habit not active
        if (formState.habit) {
            Text(
                text = "🎯",
                fontSize = 18.sp,
                modifier = Modifier
                    .alpha(0.7f)
                    .semantics { contentDescription = "Habit" }
            )
        } else if (formState.recurrenceRule != null) {
            Text(
                text = "🔁",
                fontSize = 18.sp,
                modifier = Modifier
                    .alpha(0.7f)
                    .semantics { contentDescription = "Recurring chit" }
            )
        }
    }
}

// ─── Prerequisites Zone (gap 9/14) ──────────────────────────────────────────────

/**
 * Collapsible zone for managing prerequisite chit IDs.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PrerequisitesZone(
    prerequisites: List<String>?,
    onPrerequisitesChange: (List<String>?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(!prerequisites.isNullOrEmpty()) }
    var newPrereqText by remember { mutableStateOf("") }

    EditorZoneHeader(
        title = "Prerequisites",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && !prerequisites.isNullOrEmpty()) {
                Text(
                    text = "${prerequisites.size} prerequisite${if (prerequisites.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            if (!prerequisites.isNullOrEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    prerequisites.forEach { prereqId ->
                        InputChip(
                            selected = false,
                            onClick = {
                                onPrerequisitesChange(prerequisites.filter { it != prereqId }.ifEmpty { null })
                            },
                            label = { Text(prereqId.take(8) + "…", style = MaterialTheme.typography.labelSmall) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(14.dp))
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newPrereqText,
                    onValueChange = { newPrereqText = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("Chit ID") },
                    placeholder = { Text("Enter prerequisite chit ID") },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        imeAction = androidx.compose.ui.text.input.ImeAction.Done
                    ),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onDone = {
                            if (newPrereqText.isNotBlank()) {
                                val current = prerequisites ?: emptyList()
                                onPrerequisitesChange(current + newPrereqText.trim())
                                newPrereqText = ""
                            }
                        }
                    ),
                    colors = CwocInputDefaults.outlinedColors()
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = {
                    if (newPrereqText.isNotBlank()) {
                        val current = prerequisites ?: emptyList()
                        onPrerequisitesChange(current + newPrereqText.trim())
                        newPrereqText = ""
                    }
                }) {
                    Icon(Icons.Default.Add, "Add prerequisite")
                }
            }
        }
    }
}

// ─── Tags Zone (gaps 18-20) ─────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun TagsZone(
    tags: List<String>,
    tagTree: List<TagNode>,
    recentTags: List<String> = emptyList(),
    onTagsChange: (List<String>) -> Unit,
    onTagCreated: (String) -> Unit,
    onTagTracked: (String) -> Unit = {},
    currentColor: String? = null,
    onAutoColor: (String) -> Unit = {}
) {
    var isExpanded by remember { mutableStateOf(tags.isNotEmpty()) }
    var showPicker by remember { mutableStateOf(false) }

    val tagNodeMap = remember(tagTree) {
        val map = mutableMapOf<String, TagNode>()
        fun walk(nodes: List<TagNode>) {
            nodes.forEach { node ->
                map[node.fullPath] = node
                walk(node.children)
            }
        }
        walk(tagTree)
        map
    }

    // Favorites row (gap 18/26)
    val favoriteTags = remember(tagTree) {
        val favs = mutableListOf<TagNode>()
        fun walk(nodes: List<TagNode>) {
            nodes.forEach { node ->
                if (node.favorite) favs.add(node)
                walk(node.children)
            }
        }
        walk(tagTree)
        favs
    }

    // Count only user tags (exclude system tags) for display
    val userTagCount = remember(tags) {
        tags.count { tag ->
            tag !in setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes") &&
                !tag.startsWith("CWOC_System/", ignoreCase = true)
        }
    }

    EditorZoneHeader(
        title = "Tags",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && userTagCount > 0) {
                Text(
                    text = "$userTagCount tag${if (userTagCount != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        // Filter out system tags — they're auto-computed and not user-editable
        val displayTags = remember(tags) {
            tags.filter { tag ->
                tag !in setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes") &&
                    !tag.startsWith("CWOC_System/", ignoreCase = true)
            }
        }

        // Active tags section (selected tags with clear label)
        if (displayTags.isNotEmpty()) {
            Text(
                "Active Tags",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                displayTags.forEach { tagPath ->
                    val node = tagNodeMap[tagPath]
                    val chipColor = node?.color?.let { parseTagColorLocal(it) }
                    InputChip(
                        selected = true,
                        onClick = { onTagsChange(tags - tagPath) },
                        label = {
                            Text(
                                tagPath.substringAfterLast("/"),
                                color = chipColor?.let { contrastTextColorLocal(it) }
                                    ?: MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        trailingIcon = {
                            Icon(Icons.Default.Close, "Remove tag", modifier = Modifier.size(16.dp),
                                tint = chipColor?.let { contrastTextColorLocal(it) }
                                    ?: MaterialTheme.colorScheme.onSurfaceVariant)
                        },
                        colors = if (chipColor != null) {
                            InputChipDefaults.inputChipColors(
                                selectedContainerColor = chipColor,
                                selectedLabelColor = contrastTextColorLocal(chipColor),
                                selectedTrailingIconColor = contrastTextColorLocal(chipColor)
                            )
                        } else InputChipDefaults.inputChipColors()
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Favorites row (gap 18/26) — quick-add without opening picker
        if (favoriteTags.isNotEmpty()) {
            Text("Favorites", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                favoriteTags.forEach { fav ->
                    val isSelected = tags.contains(fav.fullPath)
                    val chipColor = fav.color?.let { parseTagColorLocal(it) }
                    InputChip(
                        selected = isSelected,
                        onClick = {
                            if (isSelected) {
                                onTagsChange(tags - fav.fullPath)
                            } else {
                                onTagsChange(tags + fav.fullPath)
                                onTagTracked(fav.fullPath)
                                // Auto-color: if chit has no color and this is the first tag, apply tag color
                                if (currentColor.isNullOrBlank() || currentColor == "transparent") {
                                    fav.color?.let { onAutoColor(it) }
                                }
                            }
                        },
                        label = {
                            Text(
                                fav.fullPath.substringAfterLast("/"),
                                color = chipColor?.let { contrastTextColorLocal(it) }
                                    ?: MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        colors = if (chipColor != null) {
                            InputChipDefaults.inputChipColors(
                                selectedContainerColor = chipColor,
                                selectedLabelColor = contrastTextColorLocal(chipColor)
                            )
                        } else InputChipDefaults.inputChipColors()
                    )
                }
            }
        }

        // Add Tag button — opens the full tree picker
        AssistChip(
            onClick = { showPicker = true },
            label = { Text("Browse All Tags") },
            leadingIcon = { Icon(Icons.Default.Add, "Add tag", modifier = Modifier.size(18.dp)) }
        )
    }

    if (showPicker) {
        TagsPickerSheet(
            allTags = tagTree,
            selectedTags = tags,
            onTagToggled = { tagPath ->
                val isAdding = !tags.contains(tagPath)
                val newTags = if (isAdding) tags + tagPath else tags - tagPath
                onTagsChange(newTags)
                if (isAdding) {
                    onTagTracked(tagPath)
                    // Auto-color: if chit has no color, apply the first selected tag's color
                    if (currentColor.isNullOrBlank() || currentColor == "transparent") {
                        tagNodeMap[tagPath]?.color?.let { onAutoColor(it) }
                    }
                }
            },
            onTagCreated = { newTagName ->
                onTagCreated(newTagName)
                if (!tags.contains(newTagName)) {
                    onTagsChange(tags + newTagName)
                    onTagTracked(newTagName)
                }
            },
            onDismiss = { showPicker = false },
            recentTags = recentTags
        )
    }
}

// ─── People Zone (gaps 29-32) ────────────────────────────────────────────────────

/**
 * People zone with stealth toggle, contact chips, autocomplete from contacts,
 * sharing (viewer/manager roles), and add new inline.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PeopleZone(
    people: List<String>,
    stealth: Boolean?,
    contactNames: List<String>,
    contactColors: Map<String, String> = emptyMap(),
    contactImages: Map<String, String?> = emptyMap(),
    serverUrl: String = "",
    authToken: String = "",
    shares: String? = null,
    sharedUsers: List<String> = emptyList(),
    assignedTo: String? = null,
    peopleSearchResults: List<String> = emptyList(),
    onPeopleSearchQueryChange: (String) -> Unit = {},
    onPeopleChange: (List<String>) -> Unit,
    onStealthChange: (Boolean?) -> Unit,
    onSharesChange: (String?) -> Unit = {},
    onAssignedToChange: (String?) -> Unit = {}
) {
    var isExpanded by remember { mutableStateOf(people.isNotEmpty()) }
    var newPersonText by remember { mutableStateOf("") }
    var showSuggestions by remember { mutableStateOf(false) }
    // M1: Contact tree browser state
    var showContactBrowser by remember { mutableStateOf(false) }
    // M5: Full-screen people expand modal state
    var showExpandModal by remember { mutableStateOf(false) }

    // Parse shares JSON into a list of share entries
    val shareEntries = remember(shares) {
        if (shares.isNullOrBlank()) emptyList()
        else try {
            com.google.gson.Gson().fromJson<List<Map<String, Any?>>>(
                shares,
                object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
            ) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    // Filter contacts based on full-field DAO search (exclude already-added people)
    val suggestions = remember(peopleSearchResults, people) {
        peopleSearchResults
            .filter { !people.contains(it) }
            .take(5)
    }

    EditorZoneHeader(
        title = "People",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && people.isNotEmpty()) {
                Text(
                    text = "${people.size} ${if (people.size == 1) "person" else "people"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        // Stealth toggle (gap 30/38)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Stealth Mode", style = MaterialTheme.typography.bodySmall)
            androidx.compose.material3.Switch(
                checked = stealth ?: false,
                onCheckedChange = { onStealthChange(it) }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Stealth greyout: when stealth is active, reduce opacity of sharing controls
        val stealthAlpha = if (stealth == true) 0.35f else 1f

        Column(modifier = Modifier.alpha(stealthAlpha)) {
        // People chips (removable, colorized by contact color)
        if (people.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                people.forEach { person ->
                    val chipColorHex = contactColors[person]
                    val chipBgColor = chipColorHex?.let { parseTagColorLocal(it) }
                    val chipTextColor = chipBgColor?.let { contrastTextColorLocal(it) }

                    InputChip(
                        selected = false,
                        onClick = { onPeopleChange(people - person) },
                        label = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                // Contact avatar (profile image or initials fallback)
                                ContactAvatar(
                                    imageUrl = contactImages[person],
                                    name = person,
                                    size = 18.dp,
                                    serverUrl = serverUrl,
                                    authToken = authToken
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    person,
                                    color = chipTextColor ?: MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        trailingIcon = {
                            Icon(
                                Icons.Default.Close, "Remove",
                                modifier = Modifier.size(14.dp),
                                tint = chipTextColor ?: MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        colors = if (chipBgColor != null) {
                            InputChipDefaults.inputChipColors(
                                containerColor = chipBgColor,
                                labelColor = chipTextColor ?: Color.White,
                                trailingIconColor = chipTextColor ?: Color.White
                            )
                        } else InputChipDefaults.inputChipColors()
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        // ── Shared Users Section (viewer/manager roles) ──────────────────────
        if (shareEntries.isNotEmpty()) {
            Text(
                "Shared With",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            shareEntries.forEach { share ->
                val userId = share["user_id"] as? String ?: return@forEach
                val displayName = share["display_name"] as? String ?: userId
                val role = share["role"] as? String ?: "viewer"
                val rsvpStatus = share["rsvp_status"] as? String ?: "invited"

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // User avatar
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = displayName.firstOrNull()?.uppercase() ?: "?",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontSize = 11.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))

                    // Name
                    Text(
                        text = displayName,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )

                    // RSVP badge
                    Text(
                        text = when (rsvpStatus) {
                            "accepted" -> "✓"
                            "declined" -> "✗"
                            else -> "⏳"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = when (rsvpStatus) {
                            "accepted" -> Color(0xFF388E3C)
                            "declined" -> Color(0xFFD32F2F)
                            else -> Color(0xFFB8860B)
                        }
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Role pill toggle (Viewer / Manager)
                    Row(
                        modifier = Modifier
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(4.dp)
                            )
                            .clickable {
                                val newRole = if (role == "viewer") "manager" else "viewer"
                                val updatedShares = shareEntries.map { s ->
                                    if ((s["user_id"] as? String) == userId) {
                                        s.toMutableMap().apply { put("role", newRole) }
                                    } else s
                                }
                                onSharesChange(com.google.gson.Gson().toJson(updatedShares))
                            }
                            .padding(horizontal = 2.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "V",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (role == "viewer") FontWeight.Bold else FontWeight.Normal,
                            color = if (role == "viewer") MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .background(
                                    if (role == "viewer") MaterialTheme.colorScheme.primary
                                    else Color.Transparent,
                                    RoundedCornerShape(3.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                        Text(
                            text = "M",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (role == "manager") FontWeight.Bold else FontWeight.Normal,
                            color = if (role == "manager") MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .background(
                                    if (role == "manager") MaterialTheme.colorScheme.primary
                                    else Color.Transparent,
                                    RoundedCornerShape(3.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    // Remove share button
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Remove share",
                        modifier = Modifier
                            .size(18.dp)
                            .clickable {
                                val updatedShares = shareEntries.filter {
                                    (it["user_id"] as? String) != userId
                                }
                                onSharesChange(
                                    if (updatedShares.isEmpty()) null
                                    else com.google.gson.Gson().toJson(updatedShares)
                                )
                            },
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(4.dp))
        }

        // ── Add Shared User (from system users list) ─────────────────────────
        if (sharedUsers.isNotEmpty()) {
            val availableUsers = sharedUsers.filter { user ->
                shareEntries.none { (it["display_name"] as? String) == user }
            }
            if (availableUsers.isNotEmpty()) {
                var showUserPicker by remember { mutableStateOf(false) }
                Box {
                    AssistChip(
                        onClick = { showUserPicker = true },
                        label = { Text("Share With…") },
                        leadingIcon = { Icon(Icons.Default.PersonAdd, null, modifier = Modifier.size(16.dp)) }
                    )
                    DropdownMenu(
                        expanded = showUserPicker,
                        onDismissRequest = { showUserPicker = false },
                        modifier = Modifier
                            .background(CwocDialogDefaults.containerColor)
                            .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
                    ) {
                        availableUsers.forEach { userName ->
                            DropdownMenuItem(
                                text = { Text(userName) },
                                onClick = {
                                    val newShare = mapOf(
                                        "user_id" to userName,
                                        "role" to "viewer",
                                        "display_name" to userName,
                                        "rsvp_status" to "invited"
                                    )
                                    val updatedShares = shareEntries + newShare
                                    onSharesChange(com.google.gson.Gson().toJson(updatedShares))
                                    showUserPicker = false
                                }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
            }
        }

        // Add person input with autocomplete suggestions
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newPersonText,
                    onValueChange = { newText ->
                        if (newText.contains(",")) {
                            val parts = newText.split(",")
                            val newPeople = parts.dropLast(1).map { it.trim() }.filter { it.isNotBlank() }
                            if (newPeople.isNotEmpty()) {
                                onPeopleChange(people + newPeople)
                            }
                            newPersonText = parts.last().trimStart()
                            onPeopleSearchQueryChange(parts.last().trimStart())
                        } else {
                            newPersonText = newText
                            showSuggestions = newText.length >= 2
                            onPeopleSearchQueryChange(newText)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("Add person") },
                    placeholder = { Text("Type name or comma to add") },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        imeAction = androidx.compose.ui.text.input.ImeAction.Done
                    ),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onDone = {
                            if (newPersonText.isNotBlank()) {
                                onPeopleChange(people + newPersonText.trim())
                                newPersonText = ""
                                showSuggestions = false
                                onPeopleSearchQueryChange("")
                            }
                        }
                    ),
                    colors = CwocInputDefaults.outlinedColors()
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = {
                    if (newPersonText.isNotBlank()) {
                        onPeopleChange(people + newPersonText.trim())
                        newPersonText = ""
                        showSuggestions = false
                        onPeopleSearchQueryChange("")
                    }
                }) {
                    Icon(Icons.Default.Add, "Add person")
                }
            }

            // Autocomplete suggestions from contacts
            if (showSuggestions && suggestions.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(4.dp)
                        )
                        .padding(4.dp)
                ) {
                    suggestions.forEach { suggestion ->
                        Text(
                            text = suggestion,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onPeopleChange(people + suggestion)
                                    newPersonText = ""
                                    showSuggestions = false
                                    onPeopleSearchQueryChange("")
                                }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            // M1: Browse contacts button (opens grouped contact tree)
            Spacer(modifier = Modifier.height(8.dp))

            // ── Assigned-To Dropdown ─────────────────────────────────────────
            if (sharedUsers.isNotEmpty()) {
                var assignedExpanded by remember { mutableStateOf(false) }
                val assignableUsers = listOf("") + sharedUsers
                ExposedDropdownMenuBox(
                    expanded = assignedExpanded,
                    onExpandedChange = { assignedExpanded = it }
                ) {
                    OutlinedTextField(
                        value = assignedTo ?: "(Unassigned)",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Assigned To") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(assignedExpanded) },
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    ExposedDropdownMenu(
                        expanded = assignedExpanded,
                        onDismissRequest = { assignedExpanded = false },
                        modifier = Modifier
                            .background(CwocDialogDefaults.containerColor)
                            .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
                    ) {
                        DropdownMenuItem(
                            text = { Text("(Unassigned)") },
                            onClick = { onAssignedToChange(null); assignedExpanded = false }
                        )
                        sharedUsers.forEach { user ->
                            DropdownMenuItem(
                                text = { Text(user) },
                                onClick = { onAssignedToChange(user); assignedExpanded = false }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = { showContactBrowser = true },
                    label = { Text("Browse") },
                    leadingIcon = { Icon(Icons.Default.Contacts, null, modifier = Modifier.size(16.dp)) }
                )
                // M5: Expand button — hidden on mobile (matches web behavior: if (window.innerWidth <= 768) return)
            }
        } // end stealth Column
    }

    // M1: Contact tree browser bottom sheet
    if (showContactBrowser) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        var browserSearch by remember { mutableStateOf("") }

        // Group contacts alphabetically, favorites first
        val groupedContacts = remember(contactNames, people, browserSearch) {
            val available = contactNames.filter { !people.contains(it) }
            val filtered = if (browserSearch.isBlank()) available
                else available.filter { it.contains(browserSearch, ignoreCase = true) }
            filtered.groupBy { (it.firstOrNull() ?: '?').uppercaseChar() }
                .toSortedMap()
        }

        ModalBottomSheet(
            onDismissRequest = { showContactBrowser = false },
            sheetState = sheetState,
            containerColor = CwocDialogDefaults.containerColor,
            dragHandle = { BottomSheetDefaults.DragHandle(color = CwocPrimary) }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 24.dp)
            ) {
                Text(
                    "Browse Contacts",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(12.dp))

                // Search field
                OutlinedTextField(
                    value = browserSearch,
                    onValueChange = { browserSearch = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search contacts…") },
                    singleLine = true,
                    colors = CwocInputDefaults.outlinedColors()
                )
                Spacer(modifier = Modifier.height(12.dp))

                // Grouped contact list
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(320.dp)
                ) {
                    groupedContacts.forEach { (letter, contacts) ->
                        item {
                            Text(
                                text = "$letter (${contacts.size})",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                            )
                        }
                        items(contacts, key = { it }) { contact ->
                            val chipColor = contactColors[contact]?.let { parseTagColorLocal(it) }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onPeopleChange(people + contact)
                                        showContactBrowser = false
                                    }
                                    .padding(vertical = 6.dp, horizontal = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Avatar (profile image or initials fallback)
                                ContactAvatar(
                                    imageUrl = contactImages[contact],
                                    name = contact,
                                    size = 28.dp,
                                    serverUrl = serverUrl,
                                    authToken = authToken
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = contact,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                    if (groupedContacts.isEmpty()) {
                        item {
                            Text(
                                text = if (browserSearch.isBlank()) "No contacts available"
                                    else "No matches for \"$browserSearch\"",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
}

// ─── Location Zone (gaps 15-17, H1-H6) ───────────────────────────────────────────

/**
 * Location zone with saved locations dropdown, text input, geocoding, map preview,
 * and action buttons.
 *
 * H1: Geocoding via Nominatim
 * H2: Map preview (inline coordinates display)
 * H3: Search/geocode button
 * H4: Context button (view in maps page)
 * H5: Weather display for location+date (via WeatherIndicator)
 * H6: Geocode cache (in GeocodingUtil)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LocationZone(
    location: String?,
    onLocationChange: (String) -> Unit,
    savedLocations: List<String>,
    context: Context,
    // H1: Coordinate callbacks for geocoded results
    latitude: Double? = null,
    longitude: Double? = null,
    onCoordinatesChange: ((Double?, Double?) -> Unit)? = null,
    // H5: Weather data for this location
    weatherData: String? = null,
    // 18.1: Timezone detection callback for geocoded locations
    onTimezoneDetected: ((String) -> Unit)? = null
) {
    var isExpanded by remember { mutableStateOf(!location.isNullOrBlank()) }
    var showSavedLocations by remember { mutableStateOf(false) }
    // H1: Geocoding state
    var isGeocoding by remember { mutableStateOf(false) }
    var geocodeResult by remember { mutableStateOf<com.cwoc.app.ui.util.GeocodingUtil.GeoResult?>(null) }
    var geocodeError by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    // Initialize geocodeResult from existing coordinates
    LaunchedEffect(latitude, longitude) {
        if (latitude != null && longitude != null) {
            geocodeResult = com.cwoc.app.ui.util.GeocodingUtil.GeoResult(latitude, longitude, location ?: "")
        }
    }

    EditorZoneHeader(
        title = "Location",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && !location.isNullOrBlank()) {
                Text(
                    text = location,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        }
    ) {
        // Saved locations dropdown
        if (savedLocations.isNotEmpty()) {
            Box {
                AssistChip(
                    onClick = { showSavedLocations = true },
                    label = { Text("Saved Locations") },
                    leadingIcon = { Icon(Icons.Default.MyLocation, null, modifier = Modifier.size(16.dp)) }
                )
                DropdownMenu(
                    expanded = showSavedLocations,
                    onDismissRequest = { showSavedLocations = false },
                    modifier = Modifier
                        .background(CwocDialogDefaults.containerColor)
                        .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
                ) {
                    savedLocations.forEach { loc ->
                        DropdownMenuItem(
                            text = { Text(loc) },
                            onClick = {
                                onLocationChange(loc)
                                showSavedLocations = false
                                // Auto-geocode when selecting a saved location
                                coroutineScope.launch {
                                    isGeocoding = true
                                    geocodeError = null
                                    val result = com.cwoc.app.ui.util.GeocodingUtil.geocode(loc)
                                    geocodeResult = result
                                    if (result != null) {
                                        onCoordinatesChange?.invoke(result.lat, result.lon)
                                        // 18.1: Detect timezone from geocoded coordinates
                                        val detectedTz = com.cwoc.app.ui.components.detectTimezoneFromCoords(
                                            result.lat, result.lon, null
                                        )
                                        if (detectedTz != null) {
                                            onTimezoneDetected?.invoke(detectedTz)
                                        }
                                    }
                                    isGeocoding = false
                                }
                            }
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Location text input
        OutlinedTextField(
            value = location ?: "",
            onValueChange = onLocationChange,
            label = { Text("Location") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        Spacer(modifier = Modifier.height(8.dp))

        // H3: Search/Geocode button + action buttons row
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // H3: Search button — triggers geocoding
            AssistChip(
                onClick = {
                    val loc = location ?: return@AssistChip
                    coroutineScope.launch {
                        isGeocoding = true
                        geocodeError = null
                        val result = com.cwoc.app.ui.util.GeocodingUtil.geocode(loc)
                        geocodeResult = result
                        if (result != null) {
                            onCoordinatesChange?.invoke(result.lat, result.lon)
                            // 18.1: Detect timezone from geocoded coordinates
                            val detectedTz = com.cwoc.app.ui.components.detectTimezoneFromCoords(
                                result.lat, result.lon, null
                            )
                            if (detectedTz != null) {
                                onTimezoneDetected?.invoke(detectedTz)
                            }
                        } else {
                            geocodeError = "Location not found"
                        }
                        isGeocoding = false
                    }
                },
                label = { Text(if (isGeocoding) "Searching…" else "Search") },
                leadingIcon = { Icon(Icons.Default.Search, null, modifier = Modifier.size(16.dp)) },
                enabled = !location.isNullOrBlank() && !isGeocoding
            )

            // Open in Maps
            AssistChip(
                onClick = {
                    val loc = location ?: return@AssistChip
                    val uri = Uri.parse("geo:0,0?q=${Uri.encode(loc)}")
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    try { context.startActivity(intent) } catch (_: Exception) {}
                },
                label = { Text("Map") },
                leadingIcon = { Icon(Icons.Default.OpenInNew, null, modifier = Modifier.size(16.dp)) },
                enabled = !location.isNullOrBlank()
            )
            // Directions
            AssistChip(
                onClick = {
                    val loc = location ?: return@AssistChip
                    val uri = Uri.parse("google.navigation:q=${Uri.encode(loc)}")
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    try { context.startActivity(intent) } catch (_: Exception) {}
                },
                label = { Text("Directions") },
                leadingIcon = { Icon(Icons.Default.OpenInNew, null, modifier = Modifier.size(16.dp)) },
                enabled = !location.isNullOrBlank()
            )
            // Clear location
            AssistChip(
                onClick = {
                    onLocationChange("")
                    geocodeResult = null
                    geocodeError = null
                    onCoordinatesChange?.invoke(null, null)
                },
                label = { Text("Clear") },
                leadingIcon = { Icon(Icons.Default.Close, null, modifier = Modifier.size(16.dp)) },
                enabled = !location.isNullOrBlank()
            )
        }

        // H1/H2: Geocode result display (coordinates + resolved address)
        if (geocodeResult != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text(
                        text = "📍 ${geocodeResult!!.displayName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2
                    )
                    Text(
                        text = "Lat: ${"%.5f".format(geocodeResult!!.lat)}, Lon: ${"%.5f".format(geocodeResult!!.lon)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Geocode error
        if (geocodeError != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = geocodeError!!,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        // H5: Weather display for location+date
        if (weatherData != null) {
            Spacer(modifier = Modifier.height(4.dp))
            com.cwoc.app.ui.components.WeatherIndicator(weatherDataJson = weatherData)
        }
    }
}

// ─── Notes Zone ──────────────────────────────────────────────────────────────────

/**
 * Notes zone — no expand/collapse, always fully visible.
 * Single-row toolbar: pinned left (Data, Preview/Edit, Undo, Redo) + scrollable right (format buttons).
 * Full-width text input. Data button dropdown matches web (Copy, Download, Send to chit, Move to checklist, Share).
 * Formatting buttons wrap the currently selected text (matching web behavior exactly).
 * Heading buttons are stacked in a dropdown (tap "H" to show H1/H2/H3 options).
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun NotesZone(
    note: String,
    onNoteChange: (String) -> Unit,
    context: Context,
    onMoveToChecklist: ((List<String>) -> Unit)? = null,
    chitLinkSuggestions: List<Pair<String, String>> = emptyList(),
    onChitLinkSearch: (String) -> Unit = {},
    availableChits: List<Pair<String, String>> = emptyList(),
    onSendNoteToChit: ((targetChitId: String, mode: String) -> Unit)? = null,
    externalFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier
) {
    var showPreview by remember { mutableStateOf(false) }
    var showDataMenu by remember { mutableStateOf(false) }
    var showSendToChit by remember { mutableStateOf(false) }
    var showHeadingDropdown by remember { mutableStateOf(false) }
    // J5: Chit link autocomplete state
    var showChitLinkPicker by remember { mutableStateOf(false) }
    var chitLinkQuery by remember { mutableStateOf("") }
    // Undo/redo stacks
    var undoStack by remember { mutableStateOf(listOf<String>()) }
    var redoStack by remember { mutableStateOf(listOf<String>()) }
    // TextFieldValue to track selection state for formatting
    var textFieldValue by remember {
        mutableStateOf(TextFieldValue(text = note, selection = TextRange(note.length)))
    }
    // Focus tracking for keyboard-pinned toolbar
    var isNotesFocused by remember { mutableStateOf(false) }
    val focusRequester = externalFocusRequester ?: remember { FocusRequester() }

    // Sync external note changes into textFieldValue (e.g. from undo/redo)
    LaunchedEffect(note) {
        if (textFieldValue.text != note) {
            textFieldValue = TextFieldValue(text = note, selection = TextRange(note.length))
        }
    }

    fun pushUndo(oldValue: String) {
        undoStack = undoStack + oldValue
        redoStack = emptyList()
    }

    /** Wrap formatting (bold, italic, strikethrough, code). If no selection, inserts at cursor. */
    fun applyWrapFormat(delimiter: String) {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text
        pushUndo(text)
        if (start == end) {
            // No selection — insert delimiter pair at cursor
            val before = text.substring(0, start)
            val after = text.substring(start)
            val newText = "$before$delimiter$delimiter$after"
            val cursorPos = start + delimiter.length
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(cursorPos))
            onNoteChange(newText)
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val newText = "$before$delimiter$selected$delimiter$after"
            val newEnd = start + delimiter.length + selected.length + delimiter.length
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(start, newEnd))
            onNoteChange(newText)
        }
    }

    /** Link formatting. If no selection, inserts [text](url) at cursor. */
    fun applyLinkFormat() {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text
        pushUndo(text)
        if (start == end) {
            // No selection — insert template at cursor
            val before = text.substring(0, start)
            val after = text.substring(start)
            val newText = "${before}[text](url)$after"
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(start + 1, start + 5))
            onNoteChange(newText)
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val isUrl = selected.trim().let { it.startsWith("http://") || it.startsWith("https://") }
            val newText: String
            val newSel: TextRange
            if (isUrl) {
                newText = "${before}[link text](${selected.trim()})$after"
                newSel = TextRange(start + 1, start + 1 + "link text".length)
            } else {
                newText = "${before}[$selected](url)$after"
                val urlPos = start + 1 + selected.length + 2
                newSel = TextRange(urlPos, urlPos + 3)
            }
            textFieldValue = TextFieldValue(text = newText, selection = newSel)
            onNoteChange(newText)
        }
    }

    /** Heading: strips existing prefix, applies new level. Works with or without selection. */
    fun applyHeadingFormat(level: Int) {
        val text = textFieldValue.text
        val cursorPos = textFieldValue.selection.min
        val lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
        val lineEnd = text.indexOf('\n', cursorPos).let { if (it == -1) text.length else it }
        val lineText = text.substring(lineStart, lineEnd)
        if (lineText.isBlank() && textFieldValue.selection.min == textFieldValue.selection.max) return
        pushUndo(text)
        val stripped = lineText.replace(Regex("^#{1,3}\\s+"), "")
        val prefix = "#".repeat(level) + " "
        val replacement = prefix + stripped
        val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
        textFieldValue = TextFieldValue(text = newText, selection = TextRange(lineStart, lineStart + replacement.length))
        onNoteChange(newText)
    }

    /** List prefix: prefixes current line or each selected line. */
    fun applyLinePrefixFormat(prefix: String, numbered: Boolean = false) {
        val text = textFieldValue.text
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        pushUndo(text)
        if (start != end) {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val prefixed = if (numbered) {
                selected.split('\n').mapIndexed { i, l -> "${i + 1}. $l" }.joinToString("\n")
            } else {
                selected.split('\n').joinToString("\n") { "$prefix$it" }
            }
            val newText = "$before$prefixed$after"
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(start, start + prefixed.length))
            onNoteChange(newText)
        } else {
            val lineStart = text.lastIndexOf('\n', start - 1) + 1
            val lineEnd = text.indexOf('\n', start).let { if (it == -1) text.length else it }
            val lineText = text.substring(lineStart, lineEnd)
            val actualPrefix = if (numbered) "1. " else prefix
            val replacement = actualPrefix + lineText
            val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
            val newCursor = lineStart + replacement.length
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(newCursor))
            onNoteChange(newText)
        }
    }

    /** Blockquote: prefixes selected lines with "> ", or current line if no selection. */
    fun applyBlockquoteFormat() {
        val start = textFieldValue.selection.min
        val end = textFieldValue.selection.max
        val text = textFieldValue.text
        pushUndo(text)
        if (start == end) {
            // No selection — prefix current line
            val lineStart = text.lastIndexOf('\n', start - 1) + 1
            val lineEnd = text.indexOf('\n', start).let { if (it == -1) text.length else it }
            val lineText = text.substring(lineStart, lineEnd)
            val replacement = "> $lineText"
            val newText = text.substring(0, lineStart) + replacement + text.substring(lineEnd)
            val newCursor = lineStart + replacement.length
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(newCursor))
            onNoteChange(newText)
        } else {
            val before = text.substring(0, start)
            val selected = text.substring(start, end)
            val after = text.substring(end)
            val quoted = selected.split('\n').joinToString("\n") { "> $it" }
            val newText = "$before$quoted$after"
            textFieldValue = TextFieldValue(text = newText, selection = TextRange(start, start + quoted.length))
            onNoteChange(newText)
        }
    }

    /** Horizontal rule: inserts at cursor position. */
    fun applyHorizontalRule() {
        val text = textFieldValue.text
        val cursorPos = textFieldValue.selection.min
        pushUndo(text)
        val insertion = "\n---\n"
        val newText = text.substring(0, cursorPos) + insertion + text.substring(cursorPos)
        val newCursor = cursorPos + insertion.length
        textFieldValue = TextFieldValue(text = newText, selection = TextRange(newCursor))
        onNoteChange(newText)
    }

    Column(modifier = modifier) {
        // ── Content area (scrollable, takes remaining space) ──
        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
        if (showPreview) {
            // Preview mode: tap anywhere to enter edit mode
            MarkdownRenderer(
                markdown = note.ifBlank { "_Tap to edit_" },
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        showPreview = false
                        textFieldValue = TextFieldValue(text = note, selection = TextRange(0))
                        try { focusRequester.requestFocus() } catch (_: Exception) {}
                    }
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )
        } else {
            // Edit mode: full-width text input, no horizontal margins
            OutlinedTextField(
                value = textFieldValue,
                onValueChange = { newValue ->
                    val oldText = textFieldValue.text
                    textFieldValue = newValue
                    if (newValue.text != oldText) {
                        pushUndo(oldText)
                        val processedValue = autoListContinuation(oldText, newValue.text)
                        if (processedValue != newValue.text) {
                            textFieldValue = TextFieldValue(text = processedValue, selection = TextRange(processedValue.length))
                        }
                        onNoteChange(processedValue)
                        val lastBrackets = processedValue.lastIndexOf("[[")
                        if (lastBrackets >= 0) {
                            val afterBrackets = processedValue.substring(lastBrackets + 2)
                            if (!afterBrackets.contains("]]")) { showChitLinkPicker = true; chitLinkQuery = afterBrackets }
                            else { showChitLinkPicker = false }
                        } else { showChitLinkPicker = false }
                    }
                },
                placeholder = { Text("Tap to start writing...") },
                minLines = 8,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 0.dp)
                    .focusRequester(focusRequester)
                    .onFocusChanged { focused -> isNotesFocused = focused.isFocused },
                colors = CwocInputDefaults.outlinedColors(),
                shape = RoundedCornerShape(0.dp)
            )

            // J5: Chit link autocomplete with suggestions dropdown
            if (showChitLinkPicker) {
                LaunchedEffect(chitLinkQuery) {
                    onChitLinkSearch(chitLinkQuery)
                }

                if (chitLinkSuggestions.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(4.dp)
                            )
                            .padding(4.dp)
                    ) {
                        Text(
                            text = "🔗 Select chit to link:",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                        )
                        chitLinkSuggestions.forEach { (_, title) ->
                            Text(
                                text = title,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        val lastBrackets = note.lastIndexOf("[[")
                                        if (lastBrackets >= 0) {
                                            val before = note.substring(0, lastBrackets + 2)
                                            val newText = before + title + "]]"
                                            textFieldValue = TextFieldValue(text = newText, selection = TextRange(newText.length))
                                            onNoteChange(newText)
                                        }
                                        showChitLinkPicker = false
                                    }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                } else {
                    Text(
                        text = "🔗 Type chit title to link… (close with ]])",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 4.dp, top = 2.dp)
                    )
                }
            }

        }
        } // end scrollable content Column

        // ── Toolbar (always visible — full in edit mode, minimal in preview mode) ──
        if (showPreview) {
            // Preview mode: Data + Edit buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .background(androidx.compose.ui.graphics.Color(0xFFF5F0E8))
                    .padding(horizontal = 2.dp, vertical = 0.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box {
                    IconButton(onClick = { showDataMenu = !showDataMenu }, modifier = Modifier.size(42.dp)) {
                        Icon(Icons.Default.MoreVert, "Data", modifier = Modifier.size(23.dp))
                    }
                    DropdownMenu(expanded = showDataMenu, onDismissRequest = { showDataMenu = false }) {
                        DropdownMenuItem(text = { Text("📋 Copy to clipboard") }, onClick = {
                            showDataMenu = false
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Note", note))
                            android.widget.Toast.makeText(context, "Copied", android.widget.Toast.LENGTH_SHORT).show()
                        }, enabled = note.isNotBlank())
                        DropdownMenuItem(text = { Text("⬇️ Download as file") }, onClick = {
                            showDataMenu = false
                            try {
                                val fileName = "note_${System.currentTimeMillis()}.md"
                                val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                                java.io.File(downloadsDir, fileName).writeText(note)
                                android.widget.Toast.makeText(context, "Saved to Downloads/$fileName", android.widget.Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) { android.widget.Toast.makeText(context, "Save failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show() }
                        }, enabled = note.isNotBlank())
                        DropdownMenuItem(text = { Text("📤 Send to another chit") }, onClick = { showDataMenu = false; showSendToChit = true }, enabled = note.isNotBlank() && onSendNoteToChit != null)
                        if (onMoveToChecklist != null) {
                            DropdownMenuItem(text = { Text("☑️ Move to checklist") }, onClick = {
                                showDataMenu = false
                                val lines = note.lines().filter { it.isNotBlank() }
                                if (lines.isNotEmpty()) { onMoveToChecklist(lines); onNoteChange("") }
                            }, enabled = note.isNotBlank())
                        }
                        DropdownMenuItem(text = { Text("🔗 Share") }, onClick = {
                            showDataMenu = false
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, note) }, "Share Note"))
                        }, enabled = note.isNotBlank())
                    }
                }
                IconButton(onClick = { showPreview = false }, modifier = Modifier.size(42.dp)) {
                    Icon(Icons.Default.Edit, "Edit", modifier = Modifier.size(23.dp))
                }
            }
        } else {
            var showBlockDropdown by remember { mutableStateOf(false) }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding()
                    .background(androidx.compose.ui.graphics.Color(0xFFF5F0E8))
                    .padding(horizontal = 2.dp, vertical = 0.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Data menu (works in edit mode)
                Box {
                    IconButton(onClick = { showDataMenu = !showDataMenu }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { showDataMenu = !showDataMenu }, onLongClick = { android.widget.Toast.makeText(context, "Data actions", android.widget.Toast.LENGTH_SHORT).show() })) {
                        Icon(Icons.Default.MoreVert, "Data", modifier = Modifier.size(23.dp))
                    }
                    DropdownMenu(expanded = showDataMenu, onDismissRequest = { showDataMenu = false }) {
                        DropdownMenuItem(text = { Text("📋 Copy to clipboard") }, onClick = {
                            showDataMenu = false
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Note", note))
                            android.widget.Toast.makeText(context, "Copied", android.widget.Toast.LENGTH_SHORT).show()
                        }, enabled = note.isNotBlank())
                        DropdownMenuItem(text = { Text("⬇️ Download as file") }, onClick = {
                            showDataMenu = false
                            try {
                                val fileName = "note_${System.currentTimeMillis()}.md"
                                val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                                java.io.File(downloadsDir, fileName).writeText(note)
                                android.widget.Toast.makeText(context, "Saved to Downloads/$fileName", android.widget.Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) { android.widget.Toast.makeText(context, "Save failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show() }
                        }, enabled = note.isNotBlank())
                        DropdownMenuItem(text = { Text("📤 Send to another chit") }, onClick = { showDataMenu = false; showSendToChit = true }, enabled = note.isNotBlank() && onSendNoteToChit != null)
                        if (onMoveToChecklist != null) {
                            DropdownMenuItem(text = { Text("☑️ Move to checklist") }, onClick = {
                                showDataMenu = false
                                val lines = note.lines().filter { it.isNotBlank() }
                                if (lines.isNotEmpty()) { onMoveToChecklist(lines); onNoteChange("") }
                            }, enabled = note.isNotBlank())
                        }
                        DropdownMenuItem(text = { Text("🔗 Share") }, onClick = {
                            showDataMenu = false
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, note) }, "Share Note"))
                        }, enabled = note.isNotBlank())
                    }
                }
                IconButton(onClick = { showPreview = true }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { showPreview = true }, onLongClick = { android.widget.Toast.makeText(context, "Preview", android.widget.Toast.LENGTH_SHORT).show() })) {
                    Icon(Icons.Default.Visibility, "Preview", modifier = Modifier.size(23.dp))
                }
                IconButton(onClick = { if (undoStack.isNotEmpty()) { redoStack = redoStack + note; val prev = undoStack.last(); undoStack = undoStack.dropLast(1); onNoteChange(prev) } }, enabled = undoStack.isNotEmpty(), modifier = Modifier.size(42.dp).combinedClickable(onClick = {}, onLongClick = { android.widget.Toast.makeText(context, "Undo", android.widget.Toast.LENGTH_SHORT).show() })) {
                    Icon(Icons.Default.Undo, "Undo", modifier = Modifier.size(23.dp))
                }
                IconButton(onClick = { if (redoStack.isNotEmpty()) { undoStack = undoStack + note; val next = redoStack.last(); redoStack = redoStack.dropLast(1); onNoteChange(next) } }, enabled = redoStack.isNotEmpty(), modifier = Modifier.size(42.dp).combinedClickable(onClick = {}, onLongClick = { android.widget.Toast.makeText(context, "Redo", android.widget.Toast.LENGTH_SHORT).show() })) {
                    Icon(Icons.Default.Redo, "Redo", modifier = Modifier.size(23.dp))
                }
                Row(modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    IconButton(onClick = { applyWrapFormat("**") }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyWrapFormat("**") }, onLongClick = { android.widget.Toast.makeText(context, "Bold", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatBold, "Bold", modifier = Modifier.size(23.dp)) }
                    IconButton(onClick = { applyWrapFormat("_") }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyWrapFormat("_") }, onLongClick = { android.widget.Toast.makeText(context, "Italic", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatItalic, "Italic", modifier = Modifier.size(23.dp)) }
                    IconButton(onClick = { applyWrapFormat("~~") }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyWrapFormat("~~") }, onLongClick = { android.widget.Toast.makeText(context, "Strikethrough", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatStrikethrough, "S", modifier = Modifier.size(23.dp)) }
                    IconButton(onClick = { applyLinkFormat() }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyLinkFormat() }, onLongClick = { android.widget.Toast.makeText(context, "Link", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.Link, "Link", modifier = Modifier.size(23.dp)) }
                    // Heading dropdown
                    Box {
                        IconButton(onClick = { showHeadingDropdown = true }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { showHeadingDropdown = true }, onLongClick = { android.widget.Toast.makeText(context, "Heading", android.widget.Toast.LENGTH_SHORT).show() })) { Text("H▾", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)) }
                        DropdownMenu(expanded = showHeadingDropdown, onDismissRequest = { showHeadingDropdown = false }) {
                            DropdownMenuItem(text = { Text("H1", fontWeight = FontWeight.Bold) }, onClick = { applyHeadingFormat(1); showHeadingDropdown = false })
                            DropdownMenuItem(text = { Text("H2", fontWeight = FontWeight.Bold) }, onClick = { applyHeadingFormat(2); showHeadingDropdown = false })
                            DropdownMenuItem(text = { Text("H3", fontWeight = FontWeight.Bold) }, onClick = { applyHeadingFormat(3); showHeadingDropdown = false })
                        }
                    }
                    IconButton(onClick = { applyLinePrefixFormat("- ") }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyLinePrefixFormat("- ") }, onLongClick = { android.widget.Toast.makeText(context, "Bullet List", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatListBulleted, "Bullet", modifier = Modifier.size(23.dp)) }
                    IconButton(onClick = { applyLinePrefixFormat("1. ", numbered = true) }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { applyLinePrefixFormat("1. ", numbered = true) }, onLongClick = { android.widget.Toast.makeText(context, "Numbered List", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatListNumbered, "Num", modifier = Modifier.size(23.dp)) }
                    // Block dropdown (Blockquote + Code + HR)
                    Box {
                        IconButton(onClick = { showBlockDropdown = true }, modifier = Modifier.size(42.dp).combinedClickable(onClick = { showBlockDropdown = true }, onLongClick = { android.widget.Toast.makeText(context, "Block formatting", android.widget.Toast.LENGTH_SHORT).show() })) { Icon(Icons.Default.FormatQuote, "Block", modifier = Modifier.size(23.dp)) }
                        DropdownMenu(expanded = showBlockDropdown, onDismissRequest = { showBlockDropdown = false }) {
                            DropdownMenuItem(text = { Text("❝ Blockquote") }, onClick = { applyBlockquoteFormat(); showBlockDropdown = false })
                            DropdownMenuItem(text = { Text("⟨⟩ Inline Code") }, onClick = { applyWrapFormat("`"); showBlockDropdown = false })
                            DropdownMenuItem(text = { Text("— Horizontal Rule") }, onClick = { applyHorizontalRule(); showBlockDropdown = false })
                        }
                    }
                }
            }
        }
    } // end outer NotesZone Column

    // Send-to-Chit picker
    if (showSendToChit && availableChits.isNotEmpty()) {
        com.cwoc.app.ui.components.ChitPickerSheet(
            chits = availableChits,
            onChitSelected = { targetChitId ->
                onSendNoteToChit?.invoke(targetChitId, "copy")
                showSendToChit = false
            },
            onDismiss = { showSendToChit = false },
            title = "Send Notes To..."
        )
    }
}

// ─── Projects Zone (gap 33) ──────────────────────────────────────────────────────

/**
 * Projects zone: Project Master toggle, child chits management.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProjectsZone(
    isProjectMaster: Boolean,
    childChits: List<String>?,
    childChitSummaries: List<ChitEditorViewModel.ChildChitSummary> = emptyList(),
    onProjectMasterChange: (Boolean) -> Unit,
    onChildChitsChange: (List<String>?) -> Unit,
    onChildStatusChange: ((String, String) -> Unit)? = null,
    // N1: Chit picker callback
    onPickChit: (() -> Unit)? = null,
    // N2: Create new child callback
    onCreateNewChild: (() -> Unit)? = null,
    // N3: Move to project callback (for non-master chits)
    onMoveToProject: (() -> Unit)? = null
) {
    var isExpanded by remember { mutableStateOf(isProjectMaster || !childChits.isNullOrEmpty()) }
    var newChildId by remember { mutableStateOf("") }

    EditorZoneHeader(
        title = "Projects",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && isProjectMaster) {
                Text(
                    text = "Master • ${childChits?.size ?: 0} children",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // Project Master toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Project Master", style = MaterialTheme.typography.bodyMedium)
                androidx.compose.material3.Switch(
                    checked = isProjectMaster,
                    onCheckedChange = onProjectMasterChange
                )
            }

            if (isProjectMaster) {
                // Child chits grouped by status (Kanban-style)
                if (childChitSummaries.isNotEmpty()) {
                    val statusGroups = listOf("ToDo", "In Progress", "Blocked", "Complete")
                    statusGroups.forEach { status ->
                        val chitsInStatus = childChitSummaries.filter {
                            (it.status ?: "ToDo") == status
                        }
                        if (chitsInStatus.isNotEmpty()) {
                            Text(
                                text = "$status (${chitsInStatus.size})",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                            )
                            chitsInStatus.forEach { child ->
                                var showStatusMenu by remember { mutableStateOf(false) }
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 2.dp)
                                        .background(
                                            MaterialTheme.colorScheme.surfaceVariant,
                                            RoundedCornerShape(6.dp)
                                        )
                                        .clickable { showStatusMenu = true }
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = child.title,
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.weight(1f)
                                    )
                                    // Status badge (tappable to change)
                                    Box {
                                        Text(
                                            text = when (child.status) {
                                                "In Progress" -> "🔄"
                                                "Blocked" -> "🚫"
                                                "Complete" -> "✅"
                                                else -> "📋"
                                            },
                                            modifier = Modifier.clickable { showStatusMenu = true }
                                        )
                                        DropdownMenu(
                                            expanded = showStatusMenu,
                                            onDismissRequest = { showStatusMenu = false },
                                            modifier = Modifier
                                                .background(CwocDialogDefaults.containerColor)
                                                .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
                                        ) {
                                            listOf("ToDo", "In Progress", "Blocked", "Complete").forEach { newStatus ->
                                                DropdownMenuItem(
                                                    text = { Text(newStatus) },
                                                    onClick = {
                                                        showStatusMenu = false
                                                        onChildStatusChange?.invoke(child.id, newStatus)
                                                    }
                                                )
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    // Remove button
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Remove",
                                        modifier = Modifier
                                            .size(18.dp)
                                            .clickable {
                                                onChildChitsChange(
                                                    childChits?.filter { it != child.id }?.ifEmpty { null }
                                                )
                                            },
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                } else if (!childChits.isNullOrEmpty()) {
                    // Fallback: show raw IDs if summaries haven't loaded yet
                    Text("Child Chits:", style = MaterialTheme.typography.labelMedium)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        childChits.forEach { childId ->
                            InputChip(
                                selected = false,
                                onClick = {
                                    onChildChitsChange(childChits.filter { it != childId }.ifEmpty { null })
                                },
                                label = { Text(childId.take(8) + "…", style = MaterialTheme.typography.labelSmall) },
                                trailingIcon = {
                                    Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(14.dp))
                                }
                            )
                        }
                    }
                }

                // Add child chit
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = newChildId,
                        onValueChange = { newChildId = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text("Add Child Chit ID") },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            imeAction = androidx.compose.ui.text.input.ImeAction.Done
                        ),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                            onDone = {
                                if (newChildId.isNotBlank()) {
                                    val current = childChits ?: emptyList()
                                    onChildChitsChange(current + newChildId.trim())
                                    newChildId = ""
                                }
                            }
                        ),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(onClick = {
                        if (newChildId.isNotBlank()) {
                            val current = childChits ?: emptyList()
                            onChildChitsChange(current + newChildId.trim())
                            newChildId = ""
                        }
                    }) {
                        Icon(Icons.Default.Add, "Add child")
                    }
                }

                // N1: Pick existing chit button (opens chit picker)
                // N2: Create new child button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (onPickChit != null) {
                        AssistChip(
                            onClick = onPickChit,
                            label = { Text("Pick Chit") },
                            leadingIcon = { Icon(Icons.Default.Search, null, modifier = Modifier.size(16.dp)) }
                        )
                    }
                    if (onCreateNewChild != null) {
                        AssistChip(
                            onClick = onCreateNewChild,
                            label = { Text("Create New") },
                            leadingIcon = { Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp)) }
                        )
                    }
                }
            }

            // N3: Move to Project (for non-master chits)
            if (!isProjectMaster && onMoveToProject != null) {
                HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))
                AssistChip(
                    onClick = onMoveToProject,
                    label = { Text("Add to Project") },
                    leadingIcon = { Icon(Icons.Default.Folder, null, modifier = Modifier.size(16.dp)) }
                )
            }
        }
    }
}

// ─── Health Indicators Zone (gap 35) ─────────────────────────────────────────────

/**
 * Health Indicators zone for custom health data (vitals, measurements, symptoms).
 * Stores data as JSON string in healthData field.
 */
@Composable
private fun HealthIndicatorsZone(
    healthData: String?,
    onHealthDataChange: (String?) -> Unit,
    indicatorObjects: List<com.cwoc.app.data.remote.IndicatorObject> = emptyList()
) {
    var isExpanded by remember { mutableStateOf(!healthData.isNullOrBlank()) }

    // Build a lookup map: object ID → IndicatorObject
    val objectMap = remember(indicatorObjects) {
        indicatorObjects.associateBy { it.id }
    }

    EditorZoneHeader(
        title = "Health Indicators",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && !healthData.isNullOrBlank()) {
                val count = try {
                    val map = com.google.gson.Gson().fromJson<Map<String, Any>>(
                        healthData, object : com.google.gson.reflect.TypeToken<Map<String, Any>>() {}.type
                    )
                    map?.count { it.value != null } ?: 0
                } catch (_: Exception) { 0 }
                if (count > 0) {
                    Text("$count recorded", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    ) {
        // Parse health data as UUID-keyed map
        val indicators = remember(healthData) {
            try {
                if (healthData.isNullOrBlank()) mutableMapOf()
                else com.google.gson.Gson().fromJson<MutableMap<String, Any?>>(
                    healthData,
                    object : com.google.gson.reflect.TypeToken<MutableMap<String, Any?>>() {}.type
                ) ?: mutableMapOf()
            } catch (_: Exception) { mutableMapOf() }
        }

        if (indicators.isEmpty()) {
            Text(
                text = "No health indicators recorded. Add readings below or configure indicators in Custom Objects.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            // Render each indicator with an editable value field
            indicators.forEach { (key, value) ->
                val indicatorObj = objectMap[key]
                val displayName = indicatorObj?.name ?: key.take(8) + if (key.length > 8) "…" else ""
                val unitLabel = indicatorObj?.units ?: ""

                var editValue by remember(key, value) {
                    mutableStateOf(
                        when (value) {
                            is Number -> value.toString().removeSuffix(".0")
                            is Boolean -> if (value) "true" else "false"
                            else -> value?.toString() ?: ""
                        }
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Name label (from Custom Object or truncated UUID)
                    Text(
                        text = displayName,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(0.4f)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Editable value
                    OutlinedTextField(
                        value = editValue,
                        onValueChange = { newVal ->
                            editValue = newVal
                            // Update the map and serialize
                            val updated = indicators.toMutableMap()
                            updated[key] = when {
                                newVal.isBlank() -> null
                                newVal.toDoubleOrNull() != null -> newVal.toDouble()
                                newVal == "true" -> true
                                newVal == "false" -> false
                                else -> newVal
                            }
                            onHealthDataChange(com.google.gson.Gson().toJson(updated))
                        },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium,
                        colors = CwocInputDefaults.outlinedColors()
                    )

                    // Unit label
                    if (unitLabel.isNotBlank()) {
                        Text(
                            text = unitLabel,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )
                    }

                    // Clear button
                    if (editValue.isNotBlank()) {
                        IconButton(
                            onClick = {
                                editValue = ""
                                val updated = indicators.toMutableMap()
                                updated[key] = null
                                onHealthDataChange(com.google.gson.Gson().toJson(updated))
                            },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, "Clear", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Add new indicator reading
        var newKey by remember { mutableStateOf("") }
        var newValue by remember { mutableStateOf("") }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = newKey,
                onValueChange = { newKey = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("ID") },
                placeholder = { Text("Indicator ID") },
                colors = CwocInputDefaults.outlinedColors()
            )
            OutlinedTextField(
                value = newValue,
                onValueChange = { newValue = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Value") },
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                ),
                colors = CwocInputDefaults.outlinedColors()
            )
            IconButton(
                onClick = {
                    if (newKey.isNotBlank()) {
                        val updated = indicators.toMutableMap()
                        updated[newKey.trim()] = when {
                            newValue.toDoubleOrNull() != null -> newValue.toDouble()
                            newValue == "true" -> true
                            newValue == "false" -> false
                            newValue.isBlank() -> null
                            else -> newValue
                        }
                        onHealthDataChange(com.google.gson.Gson().toJson(updated))
                        newKey = ""
                        newValue = ""
                    }
                },
                enabled = newKey.isNotBlank()
            ) {
                Icon(Icons.Default.Add, "Add indicator")
            }
        }

        // Raw JSON toggle for advanced editing
        var showRawJson by remember { mutableStateOf(false) }
        TextButton(onClick = { showRawJson = !showRawJson }) {
            Text(if (showRawJson) "Hide JSON" else "Edit Raw JSON")
        }
        if (showRawJson) {
            OutlinedTextField(
                value = healthData ?: "",
                onValueChange = { onHealthDataChange(it.ifBlank { null }) },
                label = { Text("Health Data (JSON)") },
                minLines = 3,
                maxLines = 8,
                modifier = Modifier.fillMaxWidth(),
                colors = CwocInputDefaults.outlinedColors()
            )
        }
    }
}

/** Helper to extract latest value from a health indicator entry */
private fun getLatestValue(value: Any?): String {
    return when (value) {
        is List<*> -> {
            val last = value.lastOrNull()
            when (last) {
                is Map<*, *> -> last["value"]?.toString() ?: "—"
                is Number -> last.toString()
                else -> last?.toString() ?: "—"
            }
        }
        is Number -> value.toString()
        is String -> value
        else -> "—"
    }
}

// ─── Series Log Zone (gap 34) ────────────────────────────────────────────────────

/**
 * Series Log zone for recurring chits — shows recurrence audit log.
 */
@Composable
private fun SeriesLogZone(chitId: String) {
    var isExpanded by remember { mutableStateOf(false) }

    EditorZoneHeader(
        title = "Series Log",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            Text("Recurrence history", style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    ) {
        Text(
            text = "Recurrence instance log for chit $chitId.\nView full history on the web editor.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 8.dp)
        )
    }
}

// ─── Reusable Components ────────────────────────────────────────────────────────

/**
 * Parses a hex color string into a Compose Color.
 */
private fun parseTagColorLocal(hex: String): Color {
    return try {
        val cleanHex = hex.removePrefix("#")
        val colorLong = when (cleanHex.length) {
            6 -> (0xFF000000 or cleanHex.toLong(16))
            8 -> cleanHex.toLong(16)
            else -> return Color.Gray
        }
        Color(colorLong.toInt())
    } catch (_: NumberFormatException) {
        Color.Gray
    }
}

/**
 * Delegate to the single source of truth for contrast color.
 */
private fun contrastTextColorLocal(background: Color): Color =
    com.cwoc.app.ui.components.CwocChitCardStyle.contrastTextColor(background)

/**
 * Dropdown field with None option to clear.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    value: String?,
    options: List<String>,
    onValueChange: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = value ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            colors = CwocInputDefaults.outlinedColors()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .background(CwocDialogDefaults.containerColor)
                .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
        ) {
            DropdownMenuItem(
                text = { Text("None") },
                onClick = { onValueChange(null); expanded = false }
            )
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = { onValueChange(option); expanded = false }
                )
            }
        }
    }
}

/**
 * Chip input field for comma-separated values.
 * Supports: comma to add, Enter/Done to add, and displays existing values as removable chips.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipInputField(
    values: List<String>,
    label: String,
    onValuesChange: (List<String>) -> Unit
) {
    var textFieldValue by remember { mutableStateOf("") }

    if (values.isNotEmpty()) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            values.forEach { value ->
                InputChip(
                    selected = false,
                    onClick = { onValuesChange(values - value) },
                    label = { Text(value) },
                    trailingIcon = {
                        Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(14.dp))
                    }
                )
            }
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = textFieldValue,
            onValueChange = { newText ->
                if (newText.contains(",")) {
                    val parts = newText.split(",")
                    val newValues = parts.dropLast(1).map { it.trim() }.filter { it.isNotBlank() }
                    if (newValues.isNotEmpty()) onValuesChange(values + newValues)
                    textFieldValue = parts.last().trimStart()
                } else {
                    textFieldValue = newText
                }
            },
            label = { Text(label) },
            singleLine = true,
            modifier = Modifier.weight(1f),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                imeAction = androidx.compose.ui.text.input.ImeAction.Done
            ),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                onDone = {
                    if (textFieldValue.isNotBlank()) {
                        onValuesChange(values + textFieldValue.trim())
                        textFieldValue = ""
                    }
                }
            ),
            colors = CwocInputDefaults.outlinedColors()
        )
        Spacer(modifier = Modifier.width(8.dp))
        IconButton(onClick = {
            if (textFieldValue.isNotBlank()) {
                onValuesChange(values + textFieldValue.trim())
                textFieldValue = ""
            }
        }) {
            Icon(Icons.Default.Add, "Add", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

/**
 * J1 FIX: Wraps text at the current selection with a markdown delimiter.
 * If selectionStart == selectionEnd (no selection), inserts delimiter pair with "text" placeholder.
 * If there IS a selection, wraps the selected text with the delimiter.
 *
 * @param text The full note text
 * @param delimiter The markdown delimiter (e.g., "**" for bold, "*" for italic)
 * @param selectionStart Start index of the current selection (cursor position)
 * @param selectionEnd End index of the current selection
 * @return Pair of (new text, new cursor position)
 */
private fun wrapSelection(
    text: String,
    delimiter: String,
    selectionStart: Int = text.length,
    selectionEnd: Int = text.length
): String {
    val start = selectionStart.coerceIn(0, text.length)
    val end = selectionEnd.coerceIn(0, text.length)

    return if (start == end) {
        // No selection — insert delimiter pair with placeholder at cursor
        val before = text.substring(0, start)
        val after = text.substring(start)
        "$before${delimiter}text${delimiter}$after"
    } else {
        // Has selection — wrap selected text
        val before = text.substring(0, minOf(start, end))
        val selected = text.substring(minOf(start, end), maxOf(start, end))
        val after = text.substring(maxOf(start, end))
        "$before$delimiter$selected$delimiter$after"
    }
}

/**
 * Legacy overload for backward compatibility (appends at end).
 */
@Suppress("unused")
private fun wrapSelection(text: String, delimiter: String): String {
    return wrapSelection(text, delimiter, text.length, text.length)
}

/**
 * Prepends a markdown prefix to a new line at the end of the note.
 */
private fun prependLine(text: String, prefix: String): String {
    return if (text.isBlank()) prefix
    else text + "\n" + prefix
}

/**
 * J6: Auto-continue bullet and numbered lists when Enter is pressed.
 * Detects when a newline was inserted after a line starting with "- ", "* ", or "N. "
 * and automatically inserts the next list prefix.
 *
 * @param oldText The text before the change
 * @param newText The text after the change
 * @return The processed text with auto-continued list prefix (or newText unchanged)
 */
private fun autoListContinuation(oldText: String, newText: String): String {
    // Only process if a newline was just inserted (text grew by at least 1 char including \n)
    if (newText.length <= oldText.length) return newText
    if (!newText.contains("\n")) return newText

    // Find the newly inserted newline
    val newLines = newText.split("\n")
    val oldLines = oldText.split("\n")

    // If a new line was added (more lines than before)
    if (newLines.size > oldLines.size) {
        // Get the line before the new empty line
        val newLineIndex = newLines.indexOfFirst { it.isEmpty() && newLines.indexOf(it) > 0 }
        if (newLineIndex <= 0) return newText

        val previousLine = newLines[newLineIndex - 1]

        // Check for bullet list: "- " or "* "
        val bulletMatch = Regex("""^(\s*)([-*])\s""").find(previousLine)
        if (bulletMatch != null) {
            val indent = bulletMatch.groupValues[1]
            val bullet = bulletMatch.groupValues[2]
            // If previous line was ONLY the bullet (empty item), remove it instead of continuing
            if (previousLine.trim() == "$bullet") return newText
            val mutableLines = newLines.toMutableList()
            mutableLines[newLineIndex] = "$indent$bullet "
            return mutableLines.joinToString("\n")
        }

        // Check for numbered list: "1. ", "2. ", etc.
        val numberMatch = Regex("""^(\s*)(\d+)\.\s""").find(previousLine)
        if (numberMatch != null) {
            val indent = numberMatch.groupValues[1]
            val number = numberMatch.groupValues[2].toIntOrNull() ?: 1
            // If previous line was ONLY the number (empty item), remove it
            if (previousLine.trim() == "${number}.") return newText
            val mutableLines = newLines.toMutableList()
            mutableLines[newLineIndex] = "$indent${number + 1}. "
            return mutableLines.joinToString("\n")
        }
    }

    return newText
}

/**
 * Builds share text from a ChitFormState.
 */
private fun buildShareText(form: ChitFormState): String {
    val sb = StringBuilder()
    if (form.title.isNotBlank()) sb.appendLine(form.title)
    if (form.note.isNotBlank()) sb.appendLine(form.note)
    if (form.location != null) sb.appendLine("Location: ${form.location}")
    if (form.startDatetime != null) sb.appendLine("Start: ${form.startDatetime}")
    if (form.dueDatetime != null) sb.appendLine("Due: ${form.dueDatetime}")
    if (form.tags.isNotEmpty()) sb.appendLine("Tags: ${form.tags.joinToString(", ")}")
    return sb.toString()
}
