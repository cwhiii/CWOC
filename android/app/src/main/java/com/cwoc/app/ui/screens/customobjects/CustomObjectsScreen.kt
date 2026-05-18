package com.cwoc.app.ui.screens.customobjects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)

// ─── Field Type Options ─────────────────────────────────────────────────────────

private val fieldTypeOptions = listOf("number", "text", "boolean", "select")

// ─── Main Screen ────────────────────────────────────────────────────────────────

/**
 * Custom Objects Editor screen displaying custom object type definitions with
 * expandable cards showing field details, and a create/edit form via bottom sheet.
 *
 * Validates: Requirements 3.1, 3.2
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomObjectsScreen(
    onNavigateBack: () -> Unit,
    viewModel: CustomObjectsViewModel = hiltViewModel()
) {
    val objectTypes by viewModel.objectTypes.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    // Form state
    var showForm by remember { mutableStateOf(false) }
    var editingType by remember { mutableStateOf<CustomObjectType?>(null) }
    var deleteConfirmType by remember { mutableStateOf<CustomObjectType?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Custom Objects") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        editingType = null
                        showForm = true
                    }) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "New Type"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                isLoading -> LoadingState()
                error != null -> ErrorState(
                    message = error!!,
                    onRetry = { viewModel.loadTypes() }
                )
                objectTypes.isEmpty() -> EmptyState()
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(objectTypes, key = { it.id }) { type ->
                            CustomObjectTypeCard(
                                type = type,
                                onEdit = {
                                    editingType = type
                                    showForm = true
                                },
                                onDelete = { deleteConfirmType = type }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                    }
                }
            }
        }
    }

    // Create/Edit bottom sheet
    if (showForm) {
        CustomObjectFormSheet(
            editingType = editingType,
            onDismiss = {
                showForm = false
                editingType = null
            },
            onSave = { name, fields ->
                if (editingType != null) {
                    viewModel.updateType(
                        editingType!!.copy(name = name, fields = fields)
                    )
                } else {
                    viewModel.createType(name, fields)
                }
                showForm = false
                editingType = null
            }
        )
    }

    // Delete confirmation dialog
    if (deleteConfirmType != null) {
        DeleteConfirmDialog(
            typeName = deleteConfirmType!!.name,
            onConfirm = {
                viewModel.deleteType(deleteConfirmType!!.id)
                deleteConfirmType = null
            },
            onDismiss = { deleteConfirmType = null }
        )
    }
}

// ─── Type Card ──────────────────────────────────────────────────────────────────

@Composable
private fun CustomObjectTypeCard(
    type: CustomObjectType,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = { expanded = !expanded }
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Collapsed header row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = type.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Medium,
                        color = ParchmentText
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${type.fields.size} field${if (type.fields.size != 1) "s" else ""}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (!type.zone.isNullOrBlank()) {
                            ZoneBadge(zone = type.zone)
                        }
                    }
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp
                    else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                    tint = ParchmentBrown
                )
            }

            // Expanded content
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    // Fields list
                    type.fields.forEach { field ->
                        FieldRow(field = field)
                    }

                    // Action buttons
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = onEdit,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = ParchmentBrown
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Edit")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        OutlinedButton(
                            onClick = onDelete,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color(0xFFC62828)
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Delete")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ZoneBadge(zone: String) {
    val displayName = zone.replace("_", " ").replaceFirstChar { it.uppercase() }
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = ParchmentBrown.copy(alpha = 0.15f)
    ) {
        Text(
            text = displayName,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = ParchmentBrown,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun FieldRow(field: CustomObjectField) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = field.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = ParchmentText
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = field.value_type,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (!field.units.isNullOrBlank()) {
                        Text(
                            text = "unit: ${field.units}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (field.min != null || field.max != null) {
                        val rangeText = buildString {
                            append("range: ")
                            append(field.min?.toString() ?: "–")
                            append(" to ")
                            append(field.max?.toString() ?: "–")
                        }
                        Text(
                            text = rangeText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (!field.options.isNullOrEmpty()) {
                        Text(
                            text = "options: ${field.options.joinToString(", ")}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// ─── Create/Edit Form (Bottom Sheet) ────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomObjectFormSheet(
    editingType: CustomObjectType?,
    onDismiss: () -> Unit,
    onSave: (name: String, fields: List<CustomObjectField>) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var typeName by remember { mutableStateOf(editingType?.name ?: "") }
    val fields = remember {
        mutableStateListOf<MutableFieldState>().apply {
            if (editingType != null) {
                addAll(editingType.fields.map { it.toMutableState() })
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Title
            Text(
                text = if (editingType != null) "Edit Type" else "New Type",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = ParchmentText
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Name field
            OutlinedTextField(
                value = typeName,
                onValueChange = { typeName = it },
                label = { Text("Type Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Fields section header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Fields",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    color = ParchmentText
                )
                TextButton(onClick = {
                    fields.add(MutableFieldState())
                }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Field", color = ParchmentBrown)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Field entries
            fields.forEachIndexed { index, fieldState ->
                FieldEditor(
                    fieldState = fieldState,
                    onRemove = { fields.removeAt(index) }
                )
                if (index < fields.lastIndex) {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Save / Cancel buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = ParchmentBrown)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (typeName.isNotBlank()) {
                            val builtFields = fields.map { it.toCustomObjectField() }
                            onSave(typeName.trim(), builtFields)
                        }
                    },
                    enabled = typeName.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ParchmentBrown
                    )
                ) {
                    Text("Save")
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

// ─── Field Editor ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FieldEditor(
    fieldState: MutableFieldState,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Field name + remove button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = fieldState.name,
                    onValueChange = { fieldState.name = it },
                    label = { Text("Field Name") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                IconButton(onClick = onRemove) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Remove field",
                        tint = Color(0xFFC62828)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Type dropdown
            var typeExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = typeExpanded,
                onExpandedChange = { typeExpanded = it }
            ) {
                OutlinedTextField(
                    value = fieldState.valueType,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Type") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = typeExpanded,
                    onDismissRequest = { typeExpanded = false }
                ) {
                    fieldTypeOptions.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.replaceFirstChar { it.uppercase() }) },
                            onClick = {
                                fieldState.valueType = option
                                typeExpanded = false
                            }
                        )
                    }
                }
            }

            // Conditional fields based on type
            if (fieldState.valueType == "number") {
                Spacer(modifier = Modifier.height(8.dp))

                // Unit field
                OutlinedTextField(
                    value = fieldState.units,
                    onValueChange = { fieldState.units = it },
                    label = { Text("Unit") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Min / Max row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = fieldState.min,
                        onValueChange = { fieldState.min = it },
                        label = { Text("Min") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    OutlinedTextField(
                        value = fieldState.max,
                        onValueChange = { fieldState.max = it },
                        label = { Text("Max") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
            }

            if (fieldState.valueType == "select") {
                Spacer(modifier = Modifier.height(8.dp))

                // Options field (comma-separated)
                OutlinedTextField(
                    value = fieldState.options,
                    onValueChange = { fieldState.options = it },
                    label = { Text("Options (comma-separated)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        }
    }
}

// ─── Mutable Field State ────────────────────────────────────────────────────────

private class MutableFieldState(
    name: String = "",
    valueType: String = "number",
    units: String = "",
    min: String = "",
    max: String = "",
    options: String = ""
) {
    var name by mutableStateOf(name)
    var valueType by mutableStateOf(valueType)
    var units by mutableStateOf(units)
    var min by mutableStateOf(min)
    var max by mutableStateOf(max)
    var options by mutableStateOf(options)

    fun toCustomObjectField(): CustomObjectField {
        return CustomObjectField(
            name = name.trim(),
            value_type = valueType,
            units = units.trim().ifBlank { null },
            min = min.toDoubleOrNull(),
            max = max.toDoubleOrNull(),
            options = if (valueType == "select" && options.isNotBlank()) {
                options.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            } else null
        )
    }
}

private fun CustomObjectField.toMutableState(): MutableFieldState {
    return MutableFieldState(
        name = name,
        valueType = value_type,
        units = units ?: "",
        min = min?.toString() ?: "",
        max = max?.toString() ?: "",
        options = options?.joinToString(", ") ?: ""
    )
}

// ─── Delete Confirmation Dialog ─────────────────────────────────────────────────

@Composable
private fun DeleteConfirmDialog(
    typeName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete Type") },
        text = {
            Text("Are you sure you want to delete \"$typeName\"? This action cannot be undone.")
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFC62828)
                )
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    )
}

// ─── State Composables ──────────────────────────────────────────────────────────

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = ParchmentBrown)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ParchmentBrown
                )
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No custom object types",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Tap + to create a new type",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
