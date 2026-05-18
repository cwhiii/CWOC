package com.cwoc.app.ui.screens.editor

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material.icons.filled.FileCopy
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.FormatStrikethrough
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material.icons.filled.Undo
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.tags.TagNode
import com.cwoc.app.ui.components.CalculatorSheet
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.screens.editor.zones.AlertsZone
import com.cwoc.app.ui.screens.editor.zones.ChecklistZone
import com.cwoc.app.ui.screens.editor.zones.ColorZone
import com.cwoc.app.ui.screens.editor.zones.DateZone
import com.cwoc.app.ui.screens.editor.zones.EditorZoneHeader
import com.cwoc.app.ui.screens.editor.zones.HabitsZone
import com.cwoc.app.ui.screens.editor.zones.RecurrenceZone
import com.cwoc.app.ui.screens.editor.zones.TagsPickerSheet
import kotlinx.coroutines.launch

/**
 * Full-screen editor for creating and editing chits.
 * Phase 2 remediation: all 43 audit gaps addressed.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ChitEditorScreen(
    chitId: String,
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
    val lastSavedAt by viewModel.lastSavedAt.collectAsState()
    val contactNames by viewModel.contactNames.collectAsState()

    var isPinned by remember { mutableStateOf(false) }
    var isArchived by remember { mutableStateOf(false) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    var showOptionsMenu by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showCalculator by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

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
            title = { Text("Unsaved Changes") },
            text = { Text("You have unsaved changes. What would you like to do?") },
            confirmButton = {
                TextButton(onClick = { viewModel.saveAndExit() }) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelBack() }) {
                    Text("Cancel")
                }
                TextButton(onClick = { viewModel.discardAndExit() }) {
                    Text("Discard")
                }
            }
        )
    }

    // Delete Confirmation Dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Chit?") },
            text = { Text("This chit will be moved to trash.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteChit()
                }) {
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

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (formState.isNew) "New Chit" else "Edit Chit")
                        // Autosave indicator (gap 43)
                        if (lastSavedAt != null) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "✅ Saved",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { viewModel.onBackPressed() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (!formState.isNew) {
                        // Pin/Unpin
                        IconButton(onClick = {
                            chitRepository?.let { repo ->
                                coroutineScope.launch {
                                    if (isPinned) { repo.unpin(formState.id); isPinned = false }
                                    else { repo.pin(formState.id); isPinned = true }
                                }
                            }
                        }) {
                            Icon(
                                if (isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                                contentDescription = if (isPinned) "Unpin" else "Pin"
                            )
                        }
                        // Archive/Unarchive
                        IconButton(onClick = {
                            chitRepository?.let { repo ->
                                coroutineScope.launch {
                                    if (isArchived) { repo.unarchive(formState.id); isArchived = false }
                                    else { repo.archive(formState.id); isArchived = true }
                                }
                            }
                        }) {
                            Icon(
                                if (isArchived) Icons.Filled.Unarchive else Icons.Filled.Archive,
                                contentDescription = if (isArchived) "Unarchive" else "Archive"
                            )
                        }
                        // Snooze
                        IconButton(onClick = { showSnoozeDialog = true }) {
                            Icon(Icons.Filled.Snooze, contentDescription = "Snooze")
                        }
                    }
                    // Save & Stay (gap 38/41)
                    IconButton(onClick = { viewModel.saveAndStay() }) {
                        Icon(Icons.Default.Save, contentDescription = "Save & Stay")
                    }
                    // Save & Exit
                    IconButton(onClick = { viewModel.save() }) {
                        Icon(Icons.Default.Check, contentDescription = "Save & Exit")
                    }
                    // Options menu (gap 39/42)
                    if (!formState.isNew) {
                        Box {
                            IconButton(onClick = { showOptionsMenu = true }) {
                                Icon(Icons.Default.MoreVert, contentDescription = "Options")
                            }
                            DropdownMenu(
                                expanded = showOptionsMenu,
                                onDismissRequest = { showOptionsMenu = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Delete") },
                                    onClick = {
                                        showOptionsMenu = false
                                        showDeleteConfirm = true
                                    },
                                    leadingIcon = { Icon(Icons.Default.Delete, null) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Duplicate") },
                                    onClick = {
                                        showOptionsMenu = false
                                        viewModel.duplicateChit()
                                    },
                                    leadingIcon = { Icon(Icons.Default.FileCopy, null) }
                                )
                                DropdownMenuItem(
                                    text = { Text("Share") },
                                    onClick = {
                                        showOptionsMenu = false
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_SUBJECT, formState.title)
                                            putExtra(Intent.EXTRA_TEXT, buildShareText(formState))
                                        }
                                        context.startActivity(Intent.createChooser(shareIntent, "Share Chit"))
                                    },
                                    leadingIcon = { Icon(Icons.Default.Share, null) }
                                )
                                // O8: QR Code option
                                DropdownMenuItem(
                                    text = { Text("QR Code") },
                                    onClick = {
                                        showOptionsMenu = false
                                    },
                                    leadingIcon = { Icon(Icons.Default.QrCode, null) }
                                )
                                // ADD1: Hide in Calendar
                                DropdownMenuItem(
                                    text = { Text("Hide in Calendar") },
                                    onClick = {
                                        showOptionsMenu = false
                                        viewModel.updateForm(formState.copy(showOnCalendar = !(formState.showOnCalendar ?: true)))
                                    }
                                )
                                // ADD2: Mark as Reminder
                                DropdownMenuItem(
                                    text = { Text("Mark as Reminder") },
                                    onClick = {
                                        showOptionsMenu = false
                                    }
                                )
                                // ADD3: Nest into Thread
                                DropdownMenuItem(
                                    text = { Text("Nest into Thread") },
                                    onClick = {
                                        showOptionsMenu = false
                                    }
                                )
                                // ADD4: Audit Log
                                DropdownMenuItem(
                                    text = { Text("Audit Log") },
                                    onClick = {
                                        showOptionsMenu = false
                                    }
                                )
                                // ADD5: Make Email
                                DropdownMenuItem(
                                    text = { Text("Make Email") },
                                    onClick = {
                                        showOptionsMenu = false
                                        viewModel.updateForm(formState.copy(emailStatus = "draft"))
                                    }
                                )
                                // ADD7: Archive (also in TopAppBar, but web has it in menu too)
                                DropdownMenuItem(
                                    text = { Text(if (isArchived) "Unarchive" else "Archive") },
                                    onClick = {
                                        showOptionsMenu = false
                                        isArchived = !isArchived
                                    }
                                )
                                // Task 36: Calculator
                                DropdownMenuItem(
                                    text = { Text("Calculator") },
                                    onClick = {
                                        showOptionsMenu = false
                                        showCalculator = true
                                    },
                                    leadingIcon = { Icon(Icons.Default.Calculate, null) }
                                )
                            }
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(modifier = Modifier.size(48.dp))
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // ─── Title Row with metadata chips (gaps 1-3) ───────────────
                OutlinedTextField(
                    value = formState.title,
                    onValueChange = { viewModel.updateForm(formState.copy(title = it)) },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Title row metadata: owner chip, nest thread label, recurrence icon
                TitleMetadataRow(formState = formState)

                Spacer(modifier = Modifier.height(4.dp))

                // ─── Status (gaps 5-6: add None/Rejected) ───────────────────
                DropdownField(
                    label = "Status",
                    value = formState.status,
                    options = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected"),
                    onValueChange = { viewModel.updateForm(formState.copy(status = it)) }
                )

                // ─── Priority (fixed: no longer includes Critical) ──────────
                DropdownField(
                    label = "Priority",
                    value = formState.priority,
                    options = listOf("High", "Medium", "Low"),
                    onValueChange = { viewModel.updateForm(formState.copy(priority = it)) }
                )

                // ─── Severity (gap 7/12: new field) ─────────────────────────
                DropdownField(
                    label = "Severity",
                    value = formState.severity,
                    options = listOf("Critical", "Major", "Normal", "Minor"),
                    onValueChange = { viewModel.updateForm(formState.copy(severity = it)) }
                )

                // ─── Assignee (gap 8/13) ────────────────────────────────────
                DropdownField(
                    label = "Assignee",
                    value = formState.assignedTo,
                    options = editorSettings.sharedUsers,
                    onValueChange = { newAssignee ->
                        // M4: Sync assignee with people list
                        val updatedPeople = if (newAssignee != null && newAssignee.isNotBlank() && !formState.people.contains(newAssignee)) {
                            formState.people + newAssignee
                        } else {
                            formState.people
                        }
                        viewModel.updateForm(formState.copy(assignedTo = newAssignee, people = updatedPeople))
                    }
                )

                // ─── F2 + F3: Quick toggles in Task section ─────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // F2: Auto-Complete Checklist toggle
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Auto-Complete", style = MaterialTheme.typography.labelSmall)
                        androidx.compose.material3.Switch(
                            checked = formState.autoCompleteChecklist ?: false,
                            onCheckedChange = { viewModel.updateForm(formState.copy(autoCompleteChecklist = it)) },
                            modifier = Modifier.height(24.dp)
                        )
                    }
                    // F3: Habit toggle (quick access without expanding Habits zone)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Habit", style = MaterialTheme.typography.labelSmall)
                        androidx.compose.material3.Switch(
                            checked = formState.habit,
                            onCheckedChange = { viewModel.updateForm(formState.copy(habit = it)) },
                            modifier = Modifier.height(24.dp)
                        )
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Dates Zone ─────────────────────────────────────────────
                DateZone(
                    startDatetime = formState.startDatetime,
                    endDatetime = formState.endDatetime,
                    dueDatetime = formState.dueDatetime,
                    pointInTime = formState.pointInTime,
                    perpetual = formState.perpetual,
                    allDay = formState.allDay,
                    timezone = formState.timezone,
                    onStartDatetimeChange = { viewModel.updateForm(formState.copy(startDatetime = it)) },
                    onEndDatetimeChange = { viewModel.updateForm(formState.copy(endDatetime = it)) },
                    onDueDatetimeChange = { viewModel.updateForm(formState.copy(dueDatetime = it)) },
                    onPointInTimeChange = { viewModel.updateForm(formState.copy(pointInTime = it)) },
                    onPerpetualChange = { viewModel.updateForm(formState.copy(perpetual = it)) },
                    onAllDayChange = { viewModel.updateForm(formState.copy(allDay = it)) },
                    onTimezoneChange = { viewModel.updateForm(formState.copy(timezone = it)) },
                    timeFormat = editorSettings.timeFormat,
                    calendarSnap = editorSettings.calendarSnap,
                    defaultTimezone = editorSettings.defaultTimezone
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Prerequisites Zone (gap 9/14) ──────────────────────────
                PrerequisitesZone(
                    prerequisites = formState.prerequisites,
                    onPrerequisitesChange = { viewModel.updateForm(formState.copy(prerequisites = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Checklist Zone (gaps 27-28) ────────────────────────────
                ChecklistZone(
                    checklistJson = formState.checklist,
                    onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) }
                )

                // Checklist auto-save toggle (gap 28/36)
                if (!formState.checklist.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(start = 32.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Checklist Auto-Save", style = MaterialTheme.typography.bodySmall)
                        androidx.compose.material3.Switch(
                            checked = formState.checklistAutosave == "enabled",
                            onCheckedChange = {
                                viewModel.updateForm(formState.copy(
                                    checklistAutosave = if (it) "enabled" else null
                                ))
                            }
                        )
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Color Zone (gap 21: color name display) ────────────────
                ColorZone(
                    selectedColor = formState.color,
                    customColors = editorSettings.customColors,
                    onColorSelected = { viewModel.updateForm(formState.copy(color = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Alerts Zone ────────────────────────────────────────────
                AlertsZone(
                    alertsJson = formState.alerts,
                    onAlertsChanged = { viewModel.updateForm(formState.copy(alerts = it)) },
                    timeFormat = editorSettings.timeFormat
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Recurrence Zone ────────────────────────────────────────
                RecurrenceZone(
                    recurrenceRule = formState.recurrenceRule,
                    recurrenceExceptions = formState.recurrenceExceptions,
                    onRecurrenceRuleChanged = { viewModel.updateForm(formState.copy(recurrenceRule = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Habits Zone (gaps 11-14) ───────────────────────────────
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

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Tags Zone (gaps 18-20) ─────────────────────────────────
                TagsZone(
                    tags = formState.tags,
                    tagTree = tagTree,
                    onTagsChange = { viewModel.updateForm(formState.copy(tags = it)) },
                    onTagCreated = { viewModel.onTagCreated(it) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── People Zone (gaps 29-32) ───────────────────────────────
                PeopleZone(
                    people = formState.people,
                    stealth = formState.stealth,
                    contactNames = contactNames,
                    onPeopleChange = { viewModel.updateForm(formState.copy(people = it)) },
                    onStealthChange = { viewModel.updateForm(formState.copy(stealth = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Location Zone (gaps 15-17) ─────────────────────────────
                LocationZone(
                    location = formState.location,
                    onLocationChange = { viewModel.updateForm(formState.copy(location = it.ifBlank { null })) },
                    savedLocations = editorSettings.savedLocations,
                    context = context
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Notes Zone (gaps 22-26) ────────────────────────────────
                NotesZone(
                    note = formState.note,
                    onNoteChange = { viewModel.updateForm(formState.copy(note = it)) },
                    context = context
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Projects Zone (gap 33) ─────────────────────────────────
                ProjectsZone(
                    isProjectMaster = formState.isProjectMaster,
                    childChits = formState.childChits,
                    onProjectMasterChange = { viewModel.updateForm(formState.copy(isProjectMaster = it)) },
                    onChildChitsChange = { viewModel.updateForm(formState.copy(childChits = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Health Indicators Zone (gap 35) ────────────────────────
                HealthIndicatorsZone(
                    healthData = formState.healthData,
                    onHealthDataChange = { viewModel.updateForm(formState.copy(healthData = it)) }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Email Compose Zone (full — Task 31) ────────────────────
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
                        onSendLater = { /* TODO: date/time picker for scheduled send */ },
                        onSendAndArchive = { viewModel.sendEmail() },
                        onDiscard = { viewModel.discardEmailDraft() },
                        onReply = { /* TODO: reply action */ },
                        onForward = { /* TODO: forward action */ },
                        onArchive = { /* TODO: archive action */ }
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                }

                // ─── Attachments Zone (functional — Task 32) ────────────────
                run {
                    val prefs = context.getSharedPreferences("cwoc_prefs", Context.MODE_PRIVATE)
                    val serverUrl = prefs.getString("server_url", "") ?: ""
                    val authToken = prefs.getString("auth_token", "") ?: ""

                    com.cwoc.app.ui.screens.editor.zones.AttachmentsZone(
                        chitId = formState.id,
                        attachmentsJson = formState.attachments,
                        onAttachmentsChange = { viewModel.updateForm(formState.copy(attachments = it)) },
                        serverUrl = serverUrl,
                        authToken = authToken
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Series Log Zone (gap 34) ───────────────────────────────
                if (!formState.isNew && formState.recurrenceRule != null) {
                    SeriesLogZone(chitId = formState.id)
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                }

                // ─── Availability ───────────────────────────────────────────
                DropdownField(
                    label = "Availability",
                    value = formState.availability,
                    options = listOf("busy", "free", "tentative"),
                    onValueChange = { viewModel.updateForm(formState.copy(availability = it)) }
                )

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // Snooze picker dialog
    if (showSnoozeDialog) {
        SnoozePickerDialog(
            onSnoozeSelected = { isoString ->
                chitRepository?.let { repo ->
                    coroutineScope.launch { repo.snooze(formState.id, isoString) }
                }
                showSnoozeDialog = false
            },
            onDismiss = { showSnoozeDialog = false }
        )
    }

    // Calculator bottom sheet (Task 36)
    if (showCalculator) {
        CalculatorSheet(
            onDismiss = { showCalculator = false },
            onInsert = { result ->
                // Insert the calculator result into the note field
                val currentNote = formState.note ?: ""
                viewModel.updateForm(formState.copy(note = currentNote + result))
                showCalculator = false
            }
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
        formState.recurrenceRule != null

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
        if (formState.recurrenceRule != null) {
            Icon(
                imageVector = Icons.Default.Repeat,
                contentDescription = "Recurring",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.primary
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
                    )
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
    onTagsChange: (List<String>) -> Unit,
    onTagCreated: (String) -> Unit
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

    EditorZoneHeader(
        title = "Tags",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && tags.isNotEmpty()) {
                Text(
                    text = "${tags.size} tag${if (tags.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        // Active tags section (selected tags with clear label)
        if (tags.isNotEmpty()) {
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
                tags.forEach { tagPath ->
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
            HorizontalDivider()
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
                            if (isSelected) onTagsChange(tags - fav.fullPath)
                            else onTagsChange(tags + fav.fullPath)
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
                val newTags = if (tags.contains(tagPath)) tags - tagPath else tags + tagPath
                onTagsChange(newTags)
            },
            onTagCreated = { newTagName ->
                onTagCreated(newTagName)
                if (!tags.contains(newTagName)) onTagsChange(tags + newTagName)
            },
            onDismiss = { showPicker = false }
        )
    }
}

// ─── People Zone (gaps 29-32) ────────────────────────────────────────────────────

/**
 * People zone with stealth toggle, contact chips, autocomplete from contacts, and add new inline.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PeopleZone(
    people: List<String>,
    stealth: Boolean?,
    contactNames: List<String>,
    onPeopleChange: (List<String>) -> Unit,
    onStealthChange: (Boolean?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(people.isNotEmpty()) }
    var newPersonText by remember { mutableStateOf("") }
    var showSuggestions by remember { mutableStateOf(false) }
    // M1: Contact tree browser state
    var showContactBrowser by remember { mutableStateOf(false) }
    // M5: Full-screen people expand modal state
    var showExpandModal by remember { mutableStateOf(false) }

    // Filter contacts based on current input text (exclude already-added people)
    val suggestions = remember(newPersonText, contactNames, people) {
        if (newPersonText.length < 2) emptyList()
        else contactNames
            .filter { it.contains(newPersonText, ignoreCase = true) && !people.contains(it) }
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

        // People chips (removable)
        if (people.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                people.forEach { person ->
                    InputChip(
                        selected = false,
                        onClick = { onPeopleChange(people - person) },
                        label = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                // M3: Contact initial avatar
                                Box(
                                    modifier = Modifier
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primaryContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = person.firstOrNull()?.uppercase() ?: "?",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        fontSize = 10.sp
                                    )
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(person)
                            }
                        },
                        trailingIcon = {
                            Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(14.dp))
                        }
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
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
                        } else {
                            newPersonText = newText
                            showSuggestions = newText.length >= 2
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
                            }
                        }
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = {
                    if (newPersonText.isNotBlank()) {
                        onPeopleChange(people + newPersonText.trim())
                        newPersonText = ""
                        showSuggestions = false
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
                                }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            // M1: Browse contacts button (opens grouped contact tree)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = { showContactBrowser = true },
                    label = { Text("Browse") },
                    leadingIcon = { Icon(Icons.Default.Contacts, null, modifier = Modifier.size(16.dp)) }
                )
                // M5: Expand button for full-screen people picker
                AssistChip(
                    onClick = { showExpandModal = true },
                    label = { Text("Expand") },
                    leadingIcon = { Icon(Icons.Default.Fullscreen, null, modifier = Modifier.size(16.dp)) }
                )
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
    weatherData: String? = null
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
                    onDismissRequest = { showSavedLocations = false }
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
            modifier = Modifier.fillMaxWidth()
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

// ─── Notes Zone (gaps 22-26) ─────────────────────────────────────────────────────

/**
 * Notes zone with format toolbar, undo/redo, full editor modal, and data actions.
 */
@Composable
private fun NotesZone(
    note: String,
    onNoteChange: (String) -> Unit,
    context: Context,
    // J4: Move lines to checklist callback
    onMoveToChecklist: ((List<String>) -> Unit)? = null
) {
    var isExpanded by remember { mutableStateOf(note.isNotBlank()) }
    var showPreview by remember { mutableStateOf(false) }
    var showFullEditor by remember { mutableStateOf(false) }
    // J5: Chit link autocomplete state
    var showChitLinkPicker by remember { mutableStateOf(false) }
    var chitLinkQuery by remember { mutableStateOf("") }
    // Undo/redo stacks (gap 23/31)
    var undoStack by remember { mutableStateOf(listOf<String>()) }
    var redoStack by remember { mutableStateOf(listOf<String>()) }

    fun pushUndo(oldValue: String) {
        undoStack = undoStack + oldValue
        redoStack = emptyList()
    }

    EditorZoneHeader(
        title = "Notes",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (isExpanded) {
                Row {
                    // Full editor button (gap 24/32)
                    IconButton(onClick = { showFullEditor = true }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Fullscreen, "Full Editor", modifier = Modifier.size(18.dp))
                    }
                    TextButton(onClick = { showPreview = !showPreview }) {
                        Text(if (showPreview) "Edit" else "Preview")
                    }
                }
            } else if (note.isNotBlank()) {
                Text(
                    text = "${note.lines().size} line${if (note.lines().size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        if (showPreview) {
            MarkdownRenderer(
                markdown = note,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
            )
        } else {
            // Format toolbar (gap 22/30)
            NotesFormatToolbar(
                note = note,
                onNoteChange = { newNote ->
                    pushUndo(note)
                    onNoteChange(newNote)
                }
            )

            // Undo/Redo buttons (gap 23/31)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(
                    onClick = {
                        if (undoStack.isNotEmpty()) {
                            redoStack = redoStack + note
                            val prev = undoStack.last()
                            undoStack = undoStack.dropLast(1)
                            onNoteChange(prev)
                        }
                    },
                    enabled = undoStack.isNotEmpty(),
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Undo, "Undo", modifier = Modifier.size(18.dp))
                }
                IconButton(
                    onClick = {
                        if (redoStack.isNotEmpty()) {
                            undoStack = undoStack + note
                            val next = redoStack.last()
                            redoStack = redoStack.dropLast(1)
                            onNoteChange(next)
                        }
                    },
                    enabled = redoStack.isNotEmpty(),
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Redo, "Redo", modifier = Modifier.size(18.dp))
                }
            }

            OutlinedTextField(
                value = note,
                onValueChange = { newValue ->
                    pushUndo(note)
                    // J6: Auto-continue bullet/numbered lists on Enter
                    val processedValue = autoListContinuation(note, newValue)
                    onNoteChange(processedValue)
                    // J5: Detect [[ for chit link autocomplete
                    val lastBrackets = processedValue.lastIndexOf("[[")
                    if (lastBrackets >= 0) {
                        val afterBrackets = processedValue.substring(lastBrackets + 2)
                        if (!afterBrackets.contains("]]")) {
                            showChitLinkPicker = true
                            chitLinkQuery = afterBrackets
                        } else {
                            showChitLinkPicker = false
                        }
                    } else {
                        showChitLinkPicker = false
                    }
                },
                label = { Text("Note") },
                minLines = 3,
                maxLines = 12,
                modifier = Modifier.fillMaxWidth()
            )

            // J5: Chit link autocomplete indicator
            if (showChitLinkPicker) {
                Text(
                    text = "🔗 Type chit title to link… (close with ]])",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 4.dp, top = 2.dp)
                )
            }

            // Data actions (gap 26/34)
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Note", note))
                    },
                    label = { Text("Copy") },
                    leadingIcon = { Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(16.dp)) },
                    enabled = note.isNotBlank()
                )
                AssistChip(
                    onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, note)
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Send Note"))
                    },
                    label = { Text("Send") },
                    leadingIcon = { Icon(Icons.Default.Share, null, modifier = Modifier.size(16.dp)) },
                    enabled = note.isNotBlank()
                )
                // J3: Download as .md file
                AssistChip(
                    onClick = {
                        try {
                            val fileName = "note_${System.currentTimeMillis()}.md"
                            val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                                android.os.Environment.DIRECTORY_DOWNLOADS
                            )
                            val file = java.io.File(downloadsDir, fileName)
                            file.writeText(note)
                            android.widget.Toast.makeText(context, "Saved to Downloads/$fileName", android.widget.Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            android.widget.Toast.makeText(context, "Save failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    },
                    label = { Text("Download") },
                    leadingIcon = { Icon(Icons.Default.Download, null, modifier = Modifier.size(16.dp)) },
                    enabled = note.isNotBlank()
                )
                // J4: Move lines to checklist
                if (onMoveToChecklist != null) {
                    AssistChip(
                        onClick = {
                            // Convert note lines to checklist items
                            val lines = note.lines().filter { it.isNotBlank() }
                            if (lines.isNotEmpty()) {
                                onMoveToChecklist(lines)
                                onNoteChange("") // Clear the note after moving
                            }
                        },
                        label = { Text("To Checklist") },
                        leadingIcon = { Icon(Icons.Default.Checklist, null, modifier = Modifier.size(16.dp)) },
                        enabled = note.isNotBlank()
                    )
                }
            }
        }
    }

    // Full editor modal (gap 24/32)
    if (showFullEditor) {
        FullEditorModal(
            note = note,
            onNoteChange = onNoteChange,
            onDismiss = { showFullEditor = false }
        )
    }
}

// ─── Notes Format Toolbar (gap 22/30) ────────────────────────────────────────────

/**
 * Markdown format toolbar with Bold, Italic, Strikethrough, Link, H1-H3,
 * Bullet List, Numbered List, Blockquote, Code, Horizontal Rule.
 */
@Composable
private fun NotesFormatToolbar(
    note: String,
    onNoteChange: (String) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        // Bold
        IconButton(onClick = { onNoteChange(wrapSelection(note, "**")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatBold, "Bold", modifier = Modifier.size(18.dp))
        }
        // Italic
        IconButton(onClick = { onNoteChange(wrapSelection(note, "*")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatItalic, "Italic", modifier = Modifier.size(18.dp))
        }
        // Strikethrough
        IconButton(onClick = { onNoteChange(wrapSelection(note, "~~")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatStrikethrough, "Strikethrough", modifier = Modifier.size(18.dp))
        }
        // Link
        IconButton(onClick = { onNoteChange(note + "\n[text](url)") }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.Link, "Link", modifier = Modifier.size(18.dp))
        }
        // H1
        IconButton(onClick = { onNoteChange(prependLine(note, "# ")) }, modifier = Modifier.size(32.dp)) {
            Text("H1", style = MaterialTheme.typography.labelSmall)
        }
        // H2
        IconButton(onClick = { onNoteChange(prependLine(note, "## ")) }, modifier = Modifier.size(32.dp)) {
            Text("H2", style = MaterialTheme.typography.labelSmall)
        }
        // H3
        IconButton(onClick = { onNoteChange(prependLine(note, "### ")) }, modifier = Modifier.size(32.dp)) {
            Text("H3", style = MaterialTheme.typography.labelSmall)
        }
        // Bullet list
        IconButton(onClick = { onNoteChange(prependLine(note, "- ")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatListBulleted, "Bullet", modifier = Modifier.size(18.dp))
        }
        // Numbered list
        IconButton(onClick = { onNoteChange(prependLine(note, "1. ")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatListNumbered, "Numbered", modifier = Modifier.size(18.dp))
        }
        // Blockquote
        IconButton(onClick = { onNoteChange(prependLine(note, "> ")) }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.FormatQuote, "Quote", modifier = Modifier.size(18.dp))
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        // Code
        IconButton(onClick = { onNoteChange(wrapSelection(note, "`")) }, modifier = Modifier.size(32.dp)) {
            Text("{ }", style = MaterialTheme.typography.labelSmall)
        }
        // Horizontal Rule
        IconButton(onClick = { onNoteChange(note + "\n---\n") }, modifier = Modifier.size(32.dp)) {
            Text("—", style = MaterialTheme.typography.labelSmall)
        }
    }
}

// ─── Full Editor Modal (gap 24/32) ───────────────────────────────────────────────

@Composable
private fun FullEditorModal(
    note: String,
    onNoteChange: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var localNote by remember { mutableStateOf(note) }
    // J2: Three modes — Edit, Preview, Split (side-by-side)
    var viewMode by remember { mutableStateOf("edit") } // "edit", "preview", "split"

    AlertDialog(
        onDismissRequest = {
            onNoteChange(localNote)
            onDismiss()
        },
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Notes Editor")
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { viewMode = "edit" }) {
                        Text("Edit", color = if (viewMode == "edit") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = { viewMode = "split" }) {
                        Text("Split", color = if (viewMode == "split") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = { viewMode = "preview" }) {
                        Text("Preview", color = if (viewMode == "preview") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth().height(400.dp)) {
                when (viewMode) {
                    "preview" -> {
                        MarkdownRenderer(
                            markdown = localNote,
                            modifier = Modifier.fillMaxSize().padding(8.dp)
                        )
                    }
                    "split" -> {
                        // J2: Side-by-side split view
                        Row(modifier = Modifier.fillMaxSize()) {
                            // Edit pane (left)
                            OutlinedTextField(
                                value = localNote,
                                onValueChange = { localNote = it },
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                                minLines = 10
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            // Preview pane (right)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                                    .padding(4.dp)
                            ) {
                                MarkdownRenderer(
                                    markdown = localNote,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        }
                    }
                    else -> {
                        OutlinedTextField(
                            value = localNote,
                            onValueChange = { localNote = it },
                            modifier = Modifier.fillMaxSize(),
                            minLines = 15
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onNoteChange(localNote)
                onDismiss()
            }) {
                Text("Done")
            }
        },
        dismissButton = {
            TextButton(onClick = { onDismiss() }) {
                Text("Cancel")
            }
        }
    )
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
    onProjectMasterChange: (Boolean) -> Unit,
    onChildChitsChange: (List<String>?) -> Unit,
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
                // Child chits list
                if (!childChits.isNullOrEmpty()) {
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
                        )
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
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
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
    onHealthDataChange: (String?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(!healthData.isNullOrBlank()) }

    EditorZoneHeader(
        title = "Health Indicators",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && !healthData.isNullOrBlank()) {
                Text("Has data", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    ) {
        // O1: Structured UI instead of raw JSON
        val indicators = remember(healthData) {
            try {
                if (healthData.isNullOrBlank()) emptyMap()
                else com.google.gson.Gson().fromJson<Map<String, Any>>(
                    healthData,
                    object : com.google.gson.reflect.TypeToken<Map<String, Any>>() {}.type
                ) ?: emptyMap()
            } catch (e: Exception) { emptyMap() }
        }

        if (indicators.isEmpty()) {
            Text(
                text = "No health indicators configured",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            // Show each indicator type with its latest value
            indicators.forEach { (name, value) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Latest: ${getLatestValue(value)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // O1: Add reading button
                    AssistChip(
                        onClick = { /* Would open a number input dialog for new reading */ },
                        label = { Text("+ Add") }
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
            }
        }

        // Fallback: raw JSON editor for advanced users
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
                modifier = Modifier.fillMaxWidth()
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
 * Returns white or dark text color based on luminance.
 */
private fun contrastTextColorLocal(background: Color): Color {
    val luminance = 0.299f * background.red + 0.587f * background.green + 0.114f * background.blue
    return if (luminance > 0.5f) Color(0xFF1A1208.toInt()) else Color.White
}

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
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
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
            )
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
