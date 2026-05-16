package com.cwoc.app.ui.screens.editor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.mapper.ChitFormState

/**
 * Full-screen editor for creating and editing chits.
 *
 * Provides editable controls for all chit fields: title, note, dates, status,
 * priority, tags, checklist, people, location, color, alerts, recurrence,
 * all-day flag, timezone, and availability.
 *
 * TopAppBar contains back/discard (arrow) and save (check) actions.
 * When isSaved becomes true, navigates back via onNavigateBack callback.
 *
 * Validates: Requirements 1.3, 1.4, 1.5
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ChitEditorScreen(
    chitId: String,
    onNavigateBack: () -> Unit,
    viewModel: ChitEditorViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSaved by viewModel.isSaved.collectAsState()

    // Navigate back when save or discard completes
    LaunchedEffect(isSaved) {
        if (isSaved) {
            onNavigateBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (formState.isNew) "New Chit" else "Edit Chit")
                },
                navigationIcon = {
                    IconButton(onClick = { viewModel.discard() }) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Discard and go back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.save() }) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Save"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
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
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // --- Title ---
                OutlinedTextField(
                    value = formState.title,
                    onValueChange = { viewModel.updateForm(formState.copy(title = it)) },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- Note (multiline) ---
                OutlinedTextField(
                    value = formState.note,
                    onValueChange = { viewModel.updateForm(formState.copy(note = it)) },
                    label = { Text("Note") },
                    minLines = 3,
                    maxLines = 8,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider()

                // --- Status dropdown ---
                DropdownField(
                    label = "Status",
                    value = formState.status,
                    options = listOf("ToDo", "In Progress", "Blocked", "Complete"),
                    onValueChange = { viewModel.updateForm(formState.copy(status = it)) }
                )

                // --- Priority dropdown ---
                DropdownField(
                    label = "Priority",
                    value = formState.priority,
                    options = listOf("Critical", "High", "Medium", "Low"),
                    onValueChange = { viewModel.updateForm(formState.copy(priority = it)) }
                )

                HorizontalDivider()

                // --- Dates section ---
                Text(
                    text = "Dates",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary
                )

                OutlinedTextField(
                    value = formState.startDatetime ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(startDatetime = it.ifBlank { null }))
                    },
                    label = { Text("Start Date/Time") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = formState.endDatetime ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(endDatetime = it.ifBlank { null }))
                    },
                    label = { Text("End Date/Time") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = formState.dueDatetime ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(dueDatetime = it.ifBlank { null }))
                    },
                    label = { Text("Due Date/Time") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- All-day toggle ---
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "All Day",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Switch(
                        checked = formState.allDay,
                        onCheckedChange = { viewModel.updateForm(formState.copy(allDay = it)) }
                    )
                }

                // --- Timezone ---
                OutlinedTextField(
                    value = formState.timezone ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(timezone = it.ifBlank { null }))
                    },
                    label = { Text("Timezone") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider()

                // --- Tags (comma-separated text field with chip display) ---
                Text(
                    text = "Tags",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                ChipInputField(
                    values = formState.tags,
                    label = "Add tag (comma-separated)",
                    onValuesChange = { viewModel.updateForm(formState.copy(tags = it)) }
                )

                // --- People (comma-separated text field with chip display) ---
                Text(
                    text = "People",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                ChipInputField(
                    values = formState.people,
                    label = "Add person (comma-separated)",
                    onValuesChange = { viewModel.updateForm(formState.copy(people = it)) }
                )

                HorizontalDivider()

                // --- Location ---
                OutlinedTextField(
                    value = formState.location ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(location = it.ifBlank { null }))
                    },
                    label = { Text("Location") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- Color ---
                OutlinedTextField(
                    value = formState.color ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(color = it.ifBlank { null }))
                    },
                    label = { Text("Color") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider()

                // --- Checklist (JSON text field) ---
                OutlinedTextField(
                    value = formState.checklist ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(checklist = it.ifBlank { null }))
                    },
                    label = { Text("Checklist (JSON)") },
                    minLines = 2,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- Alerts (JSON text field) ---
                OutlinedTextField(
                    value = formState.alerts ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(alerts = it.ifBlank { null }))
                    },
                    label = { Text("Alerts (JSON)") },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- Recurrence ---
                OutlinedTextField(
                    value = formState.recurrence ?: "",
                    onValueChange = {
                        viewModel.updateForm(formState.copy(recurrence = it.ifBlank { null }))
                    },
                    label = { Text("Recurrence") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // --- Availability dropdown ---
                DropdownField(
                    label = "Availability",
                    value = formState.availability,
                    options = listOf("busy", "free", "tentative"),
                    onValueChange = { viewModel.updateForm(formState.copy(availability = it)) }
                )

                // Bottom spacing
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

// ─── Reusable Components ────────────────────────────────────────────────────────

/**
 * Dropdown field using ExposedDropdownMenuBox for Material3 style.
 * Displays the current value (or placeholder) and allows selection from options.
 * Selecting the already-selected value clears it (sets to null).
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
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            // "None" option to clear the field
            DropdownMenuItem(
                text = { Text("None") },
                onClick = {
                    onValueChange(null)
                    expanded = false
                }
            )
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

/**
 * A text field that parses comma-separated input into chips.
 * Displays existing values as InputChips above the text field.
 * Typing a comma or pressing enter adds the current text as a new chip.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipInputField(
    values: List<String>,
    label: String,
    onValuesChange: (List<String>) -> Unit
) {
    var textFieldValue by remember { mutableStateOf("") }

    // Display existing values as chips
    if (values.isNotEmpty()) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            values.forEach { value ->
                InputChip(
                    selected = false,
                    onClick = {
                        // Remove chip on click
                        onValuesChange(values - value)
                    },
                    label = { Text(value) }
                )
            }
        }
    }

    OutlinedTextField(
        value = textFieldValue,
        onValueChange = { newText ->
            if (newText.contains(",")) {
                // Split on comma, add non-blank entries
                val parts = newText.split(",")
                val newValues = parts.dropLast(1)
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                if (newValues.isNotEmpty()) {
                    onValuesChange(values + newValues)
                }
                // Keep the text after the last comma for continued typing
                textFieldValue = parts.last().trimStart()
            } else {
                textFieldValue = newText
            }
        },
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth()
    )
}
