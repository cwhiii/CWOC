package com.cwoc.app.ui.screens.rules

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)

// ─── Constants ──────────────────────────────────────────────────────────────────

private val TRIGGER_TYPES = listOf("cron", "event", "manual")
private val EVENT_TYPES = listOf(
    "chit_created", "chit_updated", "chit_deleted",
    "chit_completed", "chit_overdue"
)
private val ACTION_TYPES = listOf(
    "create_chit", "update_chit", "send_notification", "webhook", "run_script"
)

// ─── Condition Field Options by Trigger Type ────────────────────────────────────

private val CHIT_FIELDS = listOf(
    FieldOption("title", "Title"),
    FieldOption("note", "Note"),
    FieldOption("status", "Status"),
    FieldOption("priority", "Priority"),
    FieldOption("severity", "Severity"),
    FieldOption("location", "Location"),
    FieldOption("color", "Color"),
    FieldOption("tags", "Tags"),
    FieldOption("people", "People"),
    FieldOption("archived", "Archived"),
    FieldOption("pinned", "Pinned"),
    FieldOption("all_day", "All Day"),
    FieldOption("habit", "Habit"),
    FieldOption("created_datetime", "Created Date"),
    FieldOption("modified_datetime", "Modified Date"),
    FieldOption("start_datetime", "Start Date"),
    FieldOption("due_datetime", "Due Date"),
    FieldOption("point_in_time", "Point in Time"),
    FieldOption("completed_datetime", "Completed Date")
)

private val EMAIL_FIELDS = listOf(
    FieldOption("title", "Title / Subject"),
    FieldOption("note", "Note / Body"),
    FieldOption("email_from", "Email From"),
    FieldOption("email_to", "Email To"),
    FieldOption("email_cc", "Email CC"),
    FieldOption("email_bcc", "Email BCC"),
    FieldOption("email_account_id", "Email Account"),
    FieldOption("email_subject", "Email Subject"),
    FieldOption("email_body_text", "Email Body"),
    FieldOption("email_folder", "Email Folder"),
    FieldOption("email_read", "Email Read"),
    FieldOption("email_date", "Email Date"),
    FieldOption("status", "Status"),
    FieldOption("priority", "Priority"),
    FieldOption("tags", "Tags"),
    FieldOption("people", "People"),
    FieldOption("location", "Location"),
    FieldOption("created_datetime", "Created Date"),
    FieldOption("modified_datetime", "Modified Date"),
    FieldOption("start_datetime", "Start Date"),
    FieldOption("due_datetime", "Due Date"),
    FieldOption("completed_datetime", "Completed Date")
)

private val CONTACT_FIELDS = listOf(
    FieldOption("given_name", "First Name"),
    FieldOption("surname", "Last Name"),
    FieldOption("organization", "Organization"),
    FieldOption("tags", "Tags"),
    FieldOption("emails", "Emails"),
    FieldOption("phones", "Phones"),
    FieldOption("addresses", "Addresses")
)

private val WEATHER_FIELDS = listOf(
    FieldOption("weather_code", "Weather Code (WMO)"),
    FieldOption("weather_temperature_high", "Temperature High (°C)"),
    FieldOption("weather_temperature_low", "Temperature Low (°C)"),
    FieldOption("weather_precipitation", "Precipitation (mm)"),
    FieldOption("weather_wind_speed", "Wind Speed (km/h)")
)

/** Returns the available condition fields based on the current trigger type. */
private fun getFieldsForTrigger(triggerType: String, eventType: String): List<FieldOption> {
    return when {
        triggerType == "event" && eventType == "email_received" -> EMAIL_FIELDS
        triggerType == "event" && (eventType == "contact_created" || eventType == "contact_updated") -> CONTACT_FIELDS
        triggerType == "cron" -> CHIT_FIELDS + WEATHER_FIELDS
        else -> CHIT_FIELDS
    }
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RuleEditorScreen(
    ruleId: String,
    onNavigateBack: () -> Unit,
    viewModel: RuleEditorViewModel = hiltViewModel()
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()

    val name by viewModel.name.collectAsState()
    val description by viewModel.description.collectAsState()
    val triggerType by viewModel.triggerType.collectAsState()
    val cronExpression by viewModel.cronExpression.collectAsState()
    val eventType by viewModel.eventType.collectAsState()
    val actionType by viewModel.actionType.collectAsState()
    val actionConfigJson by viewModel.actionConfigJson.collectAsState()
    val enabled by viewModel.enabled.collectAsState()
    val isHabit by viewModel.isHabit.collectAsState()
    val conditionTree by viewModel.conditionTree.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val isNew = ruleId == "new"

    // Load rule on first composition
    LaunchedEffect(ruleId) {
        viewModel.loadRule(ruleId)
    }

    // Show snackbar for action messages
    LaunchedEffect(actionMessage) {
        actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearActionMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isNew) "New Rule" else "Edit Rule") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    if (!isNew) {
                        IconButton(onClick = { showDeleteConfirm = true }) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Delete Rule",
                                tint = Color(0xFFC62828)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ParchmentBrown)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Error display
                if (error != null) {
                    Text(
                        text = error!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                // Name field
                OutlinedTextField(
                    value = name,
                    onValueChange = { viewModel.setName(it) },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Description field
                OutlinedTextField(
                    value = description,
                    onValueChange = { viewModel.setDescription(it) },
                    label = { Text("Description") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )

                // ─── Trigger Section ────────────────────────────────────────
                Text(
                    text = "Trigger",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = ParchmentText
                )

                // Trigger type dropdown
                DropdownField(
                    label = "Trigger Type",
                    selectedValue = triggerType,
                    options = TRIGGER_TYPES,
                    onValueChange = { viewModel.setTriggerType(it) }
                )

                // Trigger config based on type
                when (triggerType) {
                    "cron" -> {
                        OutlinedTextField(
                            value = cronExpression,
                            onValueChange = { viewModel.setCronExpression(it) },
                            label = { Text("Cron Expression") },
                            placeholder = { Text("0 9 * * *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    "event" -> {
                        DropdownField(
                            label = "Event Type",
                            selectedValue = eventType,
                            options = EVENT_TYPES,
                            onValueChange = { viewModel.setEventType(it) }
                        )
                    }
                    // "manual" — no config needed
                }

                // ─── Conditions Section ─────────────────────────────────────
                Text(
                    text = "Conditions",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = ParchmentText
                )

                ConditionTreeBuilder(
                    root = conditionTree,
                    onTreeChange = { updatedTree -> viewModel.setConditionTree(updatedTree) },
                    availableFields = getFieldsForTrigger(triggerType, eventType)
                )

                // ─── Action Section ─────────────────────────────────────────
                Text(
                    text = "Action",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = ParchmentText
                )

                // Action type dropdown
                DropdownField(
                    label = "Action Type",
                    selectedValue = actionType,
                    options = ACTION_TYPES,
                    onValueChange = { viewModel.setActionType(it) }
                )

                // Action config (JSON text field)
                OutlinedTextField(
                    value = actionConfigJson,
                    onValueChange = { viewModel.setActionConfigJson(it) },
                    label = { Text("Action Config (JSON)") },
                    placeholder = { Text("{\"key\": \"value\"}") },
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )

                // ─── Toggles ────────────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Enabled", color = ParchmentText)
                    Switch(
                        checked = enabled,
                        onCheckedChange = { viewModel.setEnabled(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = ParchmentBrown
                        )
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Is Habit", color = ParchmentText)
                    Switch(
                        checked = isHabit,
                        onCheckedChange = { viewModel.setIsHabit(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = ParchmentBrown
                        )
                    )
                }

                // ─── Save Button ────────────────────────────────────────────
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = { viewModel.saveRule(onSuccess = onNavigateBack) },
                    enabled = name.isNotBlank() && !isSaving,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.padding(end = 8.dp),
                            strokeWidth = 2.dp
                        )
                    }
                    Text(if (isNew) "Create Rule" else "Save Rule")
                }

                // ─── Delete Button (existing rules only) ────────────────────
                if (!isNew) {
                    OutlinedButton(
                        onClick = { showDeleteConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color(0xFFC62828)
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = null,
                            modifier = Modifier.padding(end = 8.dp)
                        )
                        Text("Delete Rule")
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Rule", color = ParchmentText) },
            text = { Text("Are you sure you want to delete this rule? This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteRule(onSuccess = onNavigateBack)
                        showDeleteConfirm = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
    }
}

// ─── Dropdown Field Component ───────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    selectedValue: String,
    options: List<String>,
    onValueChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = selectedValue,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
