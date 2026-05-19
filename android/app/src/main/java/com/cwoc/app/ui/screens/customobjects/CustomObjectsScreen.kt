package com.cwoc.app.ui.screens.customobjects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val ParchmentBg = Color(0xFFFFFAF0)
private val ParchmentMedium = Color(0xFFF5E6CC)
private val ParchmentDivider = Color(0xFFD4C5A9)
private val TealAccent = Color(0xFF008080)
private val DangerRed = Color(0xFFB22222)

// ─── Value Type Options ─────────────────────────────────────────────────────────

private val valueTypeOptions = listOf("boolean", "integer", "decimal", "string")

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomObjectsScreen(
    onNavigateBack: () -> Unit,
    viewModel: CustomObjectsViewModel = hiltViewModel()
) {
    val filteredObjects by viewModel.filteredObjects.collectAsState()
    val customZones by viewModel.customZones.collectAsState()
    val indicatorObjects by viewModel.indicatorObjects.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val typeFilter by viewModel.typeFilter.collectAsState()

    // Modal states
    var showEditModal by remember { mutableStateOf(false) }
    var editingObject by remember { mutableStateOf<CustomObject?>(null) }
    var deleteTarget by remember { mutableStateOf<CustomObject?>(null) }
    var showCreateZoneDialog by remember { mutableStateOf(false) }
    var zoneEditorZone by remember { mutableStateOf<CustomZone?>(null) }
    var deleteZoneTarget by remember { mutableStateOf<CustomZone?>(null) }

    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Custom Objects") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        if (isLoading && filteredObjects.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(innerPadding), Alignment.Center) {
                CircularProgressIndicator(color = ParchmentBrown)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // ── Create Button ──
                item {
                    Button(
                        onClick = { editingObject = null; showEditModal = true },
                        modifier = Modifier.padding(top = 8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                    ) {
                        Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Create Object")
                    }
                }

                // ── Filter Toolbar ──
                item {
                    FilterToolbar(
                        searchQuery = searchQuery,
                        typeFilter = typeFilter,
                        availableTypes = viewModel.getAvailableTypes(),
                        onSearchChange = { viewModel.setSearchQuery(it) },
                        onTypeChange = { viewModel.setTypeFilter(it) }
                    )
                }

                // ── Objects List (grouped by type → sub_type) ──
                if (filteredObjects.isEmpty()) {
                    item {
                        Box(
                            Modifier.fillMaxWidth().padding(vertical = 40.dp),
                            Alignment.Center
                        ) {
                            Text(
                                "No custom objects found.",
                                color = ParchmentBrown,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                            )
                        }
                    }
                } else {
                    // Group by type → sub_type
                    val typeGroups = filteredObjects.groupBy { it.type.ifBlank { "Uncategorized" } }
                        .toSortedMap()

                    typeGroups.forEach { (typeName, typeObjects) ->
                        item(key = "type_header_$typeName") {
                            TypeGroupSection(
                                typeName = typeName,
                                objects = typeObjects,
                                onEdit = { editingObject = it; showEditModal = true },
                                onDelete = { deleteTarget = it },
                                onToggleActive = { obj, active -> viewModel.toggleActive(obj.id, active) },
                                onRestore = { viewModel.restoreObject(it.id) }
                            )
                        }
                    }
                }

                // ── Custom Zones Section ──
                item {
                    Spacer(Modifier.height(8.dp))
                    CustomZonesSection(
                        zones = customZones,
                        onCreateZone = { showCreateZoneDialog = true },
                        onEditZone = { zoneEditorZone = it },
                        onDeleteZone = { deleteZoneTarget = it }
                    )
                }

                // ── Indicators Zone Section ──
                if (indicatorObjects.isNotEmpty()) {
                    item {
                        Spacer(Modifier.height(8.dp))
                        IndicatorsZoneSection(indicators = indicatorObjects)
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }

    // ── Edit/Create Modal ──
    if (showEditModal) {
        EditObjectDialog(
            editingObject = editingObject,
            allObjects = viewModel.allObjects.collectAsState().value,
            onDismiss = { showEditModal = false; editingObject = null },
            onSave = { name, type, subType, valueType, units, metricUnits, rangeMin, rangeMax, conditional ->
                if (editingObject != null) {
                    viewModel.updateObject(editingObject!!.id, name, type, subType, valueType, units, metricUnits, rangeMin, rangeMax, conditional)
                } else {
                    viewModel.createObject(name, type, subType, valueType, units, metricUnits, rangeMin, rangeMax, conditional)
                }
                showEditModal = false
                editingObject = null
            }
        )
    }

    // ── Delete Confirmation ──
    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete Object") },
            text = { Text("Are you sure you want to remove \"${deleteTarget!!.name}\"?") },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteObject(deleteTarget!!.id); deleteTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
    }

    // ── Create Zone Dialog ──
    if (showCreateZoneDialog) {
        CreateZoneDialog(
            onDismiss = { showCreateZoneDialog = false },
            onCreate = { name ->
                viewModel.createZone(name) { zone ->
                    showCreateZoneDialog = false
                    zoneEditorZone = zone
                }
            }
        )
    }

    // ── Delete Zone Confirmation ──
    if (deleteZoneTarget != null) {
        AlertDialog(
            onDismissRequest = { deleteZoneTarget = null },
            title = { Text("Delete Zone") },
            text = {
                Text("Are you sure you want to delete the zone \"${deleteZoneTarget!!.name}\"?\n\nAll object assignments for this zone will be removed.")
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteZone(deleteZoneTarget!!.zone_id); deleteZoneTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteZoneTarget = null }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
    }

    // ── Zone Editor ──
    if (zoneEditorZone != null) {
        ZoneEditorDialog(
            zone = zoneEditorZone!!,
            viewModel = viewModel,
            onDismiss = { zoneEditorZone = null }
        )
    }
}

// ─── Filter Toolbar ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterToolbar(
    searchQuery: String,
    typeFilter: String,
    availableTypes: List<String>,
    onSearchChange: (String) -> Unit,
    onTypeChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Search field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search by name...") },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = ParchmentBrown) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Clear, "Clear")
                    }
                }
            },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = TealAccent,
                unfocusedBorderColor = ParchmentBrown
            )
        )

        // Type filter dropdown
        var expanded by remember { mutableStateOf(false) }
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            OutlinedTextField(
                value = if (typeFilter.isBlank()) "All Types" else typeFilter,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.fillMaxWidth().menuAnchor(),
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = TealAccent,
                    unfocusedBorderColor = ParchmentBrown
                )
            )
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                DropdownMenuItem(
                    text = { Text("All Types") },
                    onClick = { onTypeChange(""); expanded = false }
                )
                availableTypes.forEach { type ->
                    DropdownMenuItem(
                        text = { Text(type) },
                        onClick = { onTypeChange(type); expanded = false }
                    )
                }
            }
        }
    }
}

// ─── Type Group Section ─────────────────────────────────────────────────────────

@Composable
private fun TypeGroupSection(
    typeName: String,
    objects: List<CustomObject>,
    onEdit: (CustomObject) -> Unit,
    onDelete: (CustomObject) -> Unit,
    onToggleActive: (CustomObject, Boolean) -> Unit,
    onRestore: (CustomObject) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = ParchmentBg),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            // Type header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = typeName,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = ParchmentText
                )
                Text(
                    text = "(${objects.size})",
                    fontSize = 12.sp,
                    color = ParchmentBrown
                )
            }

            // Group by sub_type
            val subTypeGroups = objects.groupBy { it.sub_type ?: "" }
                .toSortedMap(compareBy { if (it.isEmpty()) "\u0000" else it })

            subTypeGroups.forEach { (subType, items) ->
                if (subType.isNotEmpty()) {
                    // Sub-type header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ParchmentDivider.copy(alpha = 0.15f))
                            .padding(start = 24.dp, end = 14.dp, top = 6.dp, bottom = 4.dp)
                    ) {
                        Text(
                            text = subType,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ParchmentBrown
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("(${items.size})", fontSize = 12.sp, color = ParchmentBrown.copy(alpha = 0.5f))
                    }
                }

                items.sortedBy { it.name }.forEach { obj ->
                    ObjectRow(
                        obj = obj,
                        onEdit = { onEdit(obj) },
                        onDelete = { onDelete(obj) },
                        onToggleActive = { active -> onToggleActive(obj, active) },
                        onRestore = { onRestore(obj) }
                    )
                    HorizontalDivider(color = ParchmentDivider, thickness = 0.5.dp)
                }
            }
        }
    }
}

// ─── Object Row ─────────────────────────────────────────────────────────────────

@Composable
private fun ObjectRow(
    obj: CustomObject,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleActive: (Boolean) -> Unit,
    onRestore: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Name
        Text(
            text = obj.name,
            modifier = Modifier.weight(1f),
            fontSize = 14.sp,
            color = if (obj.active) ParchmentText else ParchmentText.copy(alpha = 0.5f),
            textDecoration = if (!obj.active) TextDecoration.LineThrough else TextDecoration.None,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        // Zone badges
        obj.zone_assignments?.forEach { za ->
            Surface(
                shape = RoundedCornerShape(3.dp),
                color = TealAccent.copy(alpha = 0.15f)
            ) {
                Text(
                    text = za.zone_id,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    fontSize = 10.sp,
                    color = Color(0xFF006060)
                )
            }
        }

        if (obj.deleted) {
            // Deleted: show restore button for standard objects
            if (obj.is_standard) {
                IconButton(onClick = onRestore, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, "Restore", tint = ParchmentBrown, modifier = Modifier.size(18.dp))
                }
            }
        } else {
            // Active toggle
            Switch(
                checked = obj.active,
                onCheckedChange = onToggleActive,
                modifier = Modifier.height(24.dp),
                colors = SwitchDefaults.colors(
                    checkedThumbColor = ParchmentBg,
                    checkedTrackColor = ParchmentBrown,
                    uncheckedThumbColor = ParchmentBrown.copy(alpha = 0.5f),
                    uncheckedTrackColor = ParchmentMedium
                )
            )

            // Edit button
            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Edit, "Edit", tint = ParchmentText, modifier = Modifier.size(16.dp))
            }

            // Delete button
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// ─── Custom Zones Section ───────────────────────────────────────────────────────

@Composable
private fun CustomZonesSection(
    zones: List<CustomZone>,
    onCreateZone: () -> Unit,
    onEditZone: (CustomZone) -> Unit,
    onDeleteZone: (CustomZone) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = ParchmentBg),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Custom Zones", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = ParchmentText)
                TextButton(onClick = onCreateZone) {
                    Icon(Icons.Default.Add, null, Modifier.size(16.dp), tint = ParchmentBrown)
                    Spacer(Modifier.width(4.dp))
                    Text("Create", color = ParchmentBrown, fontSize = 13.sp)
                }
            }

            if (zones.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(20.dp), Alignment.Center) {
                    Text(
                        "No custom zones yet — create one to get started.",
                        color = ParchmentBrown,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        fontSize = 13.sp
                    )
                }
            } else {
                zones.forEach { zone ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onEditZone(zone) }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            Icons.Default.Menu, "Drag",
                            tint = ParchmentBrown.copy(alpha = 0.5f),
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = zone.name,
                            modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.Medium,
                            color = ParchmentText
                        )
                        Surface(
                            shape = RoundedCornerShape(3.dp),
                            color = TealAccent.copy(alpha = 0.1f)
                        ) {
                            Text(
                                "${zone.object_count} object${if (zone.object_count != 1) "s" else ""}",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                fontSize = 11.sp,
                                color = ParchmentBrown
                            )
                        }
                        IconButton(onClick = { onEditZone(zone) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Edit, "Edit", tint = ParchmentText, modifier = Modifier.size(16.dp))
                        }
                        IconButton(onClick = { onDeleteZone(zone) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Delete, "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
                        }
                    }
                    HorizontalDivider(color = ParchmentDivider, thickness = 0.5.dp)
                }
            }
        }
    }
}

// ─── Indicators Zone Section ────────────────────────────────────────────────────

@Composable
private fun IndicatorsZoneSection(indicators: List<ZoneObject>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = ParchmentBg),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8DCC8))
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text("Indicators Zone", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = ParchmentText)
                Spacer(Modifier.width(8.dp))
                Text("(${indicators.size})", fontSize = 12.sp, color = ParchmentBrown)
            }

            indicators.forEach { obj ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        Icons.Default.Menu, "Drag",
                        tint = ParchmentBrown.copy(alpha = 0.5f),
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = obj.name,
                        modifier = Modifier.weight(1f),
                        color = ParchmentText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!obj.sub_type.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(3.dp),
                            color = TealAccent.copy(alpha = 0.1f)
                        ) {
                            Text(
                                obj.sub_type,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                fontSize = 11.sp,
                                color = Color(0xFF006060)
                            )
                        }
                    }
                }
                HorizontalDivider(color = ParchmentDivider, thickness = 0.5.dp)
            }
        }
    }
}

// ─── Edit Object Dialog ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditObjectDialog(
    editingObject: CustomObject?,
    allObjects: List<CustomObject>,
    onDismiss: () -> Unit,
    onSave: (
        name: String, type: String, subType: String?, valueType: String,
        units: String?, metricUnits: String?, rangeMin: Double?, rangeMax: Double?,
        conditionalDisplay: Map<String, Any?>?
    ) -> Unit
) {
    var name by remember { mutableStateOf(editingObject?.name ?: "") }
    var type by remember { mutableStateOf(editingObject?.type ?: "") }
    var subType by remember { mutableStateOf(editingObject?.sub_type ?: "") }
    var valueType by remember { mutableStateOf(editingObject?.value_type ?: "boolean") }
    var units by remember { mutableStateOf(editingObject?.units ?: "") }
    var metricUnits by remember { mutableStateOf(editingObject?.metric_units ?: "") }
    var rangeMin by remember { mutableStateOf(editingObject?.range_min?.toString() ?: "") }
    var rangeMax by remember { mutableStateOf(editingObject?.range_max?.toString() ?: "") }

    // Autocomplete suggestions
    val typeSuggestions = remember { allObjects.mapNotNull { it.type.ifBlank { null } }.distinct().sorted() }
    val subTypeSuggestions = remember { allObjects.mapNotNull { it.sub_type?.ifBlank { null } }.distinct().sorted() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .padding(vertical = 24.dp),
            colors = CardDefaults.cardColors(containerColor = ParchmentBg),
            shape = RoundedCornerShape(10.dp)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Title
                Text(
                    text = if (editingObject != null) "Edit Custom Object" else "Create Custom Object",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp,
                    color = ParchmentText
                )
                HorizontalDivider(color = ParchmentDivider)

                // Name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealAccent,
                        unfocusedBorderColor = ParchmentBrown
                    )
                )

                // Type (with suggestions)
                OutlinedTextField(
                    value = type,
                    onValueChange = { type = it },
                    label = { Text("Type *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealAccent,
                        unfocusedBorderColor = ParchmentBrown
                    )
                )
                if (typeSuggestions.isNotEmpty() && type.isNotBlank()) {
                    val filtered = typeSuggestions.filter { it.lowercase().contains(type.lowercase()) && it != type }
                    if (filtered.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                            filtered.take(3).forEach { suggestion ->
                                SuggestionChip(
                                    onClick = { type = suggestion },
                                    label = { Text(suggestion, fontSize = 11.sp) }
                                )
                            }
                        }
                    }
                }

                // Sub-type / Category
                OutlinedTextField(
                    value = subType,
                    onValueChange = { subType = it },
                    label = { Text("Category / Sub-type") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealAccent,
                        unfocusedBorderColor = ParchmentBrown
                    )
                )

                // Value Type dropdown
                var vtExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(expanded = vtExpanded, onExpandedChange = { vtExpanded = it }) {
                    OutlinedTextField(
                        value = valueType.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Value Type") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(vtExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TealAccent,
                            unfocusedBorderColor = ParchmentBrown
                        )
                    )
                    ExposedDropdownMenu(expanded = vtExpanded, onDismissRequest = { vtExpanded = false }) {
                        valueTypeOptions.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.replaceFirstChar { it.uppercase() }) },
                                onClick = { valueType = option; vtExpanded = false }
                            )
                        }
                    }
                }

                // Numeric fields (only for integer/decimal)
                if (valueType == "integer" || valueType == "decimal") {
                    OutlinedTextField(
                        value = units,
                        onValueChange = { units = it },
                        label = { Text("Units (imperial)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TealAccent,
                            unfocusedBorderColor = ParchmentBrown
                        )
                    )
                    OutlinedTextField(
                        value = metricUnits,
                        onValueChange = { metricUnits = it },
                        label = { Text("Units (metric)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TealAccent,
                            unfocusedBorderColor = ParchmentBrown
                        )
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = rangeMin,
                            onValueChange = { rangeMin = it },
                            label = { Text("Range Min") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = TealAccent,
                                unfocusedBorderColor = ParchmentBrown
                            )
                        )
                        OutlinedTextField(
                            value = rangeMax,
                            onValueChange = { rangeMax = it },
                            label = { Text("Range Max") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = TealAccent,
                                unfocusedBorderColor = ParchmentBrown
                            )
                        )
                    }
                }

                // Buttons
                HorizontalDivider(color = ParchmentDivider)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = ParchmentBrown)
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank() && type.isNotBlank()) {
                                onSave(
                                    name.trim(),
                                    type.trim(),
                                    subType.trim().ifBlank { null },
                                    valueType,
                                    units.trim().ifBlank { null },
                                    metricUnits.trim().ifBlank { null },
                                    rangeMin.toDoubleOrNull(),
                                    rangeMax.toDoubleOrNull(),
                                    null // conditional_display not exposed in mobile UI
                                )
                            }
                        },
                        enabled = name.isNotBlank() && type.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                    ) {
                        Text(if (editingObject != null) "Save" else "Create")
                    }
                }
            }
        }
    }
}

// ─── Create Zone Dialog ─────────────────────────────────────────────────────────

@Composable
private fun CreateZoneDialog(
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit
) {
    var zoneName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Zone") },
        text = {
            OutlinedTextField(
                value = zoneName,
                onValueChange = { zoneName = it },
                label = { Text("Zone Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        },
        confirmButton = {
            Button(
                onClick = { if (zoneName.isNotBlank()) onCreate(zoneName.trim()) },
                enabled = zoneName.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = ParchmentBrown) }
        }
    )
}

// ─── Zone Editor Dialog ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ZoneEditorDialog(
    zone: CustomZone,
    viewModel: CustomObjectsViewModel,
    onDismiss: () -> Unit
) {
    val zoneObjects by viewModel.zoneEditorObjects.collectAsState()
    var zoneName by remember { mutableStateOf(zone.name) }
    var showAddPicker by remember { mutableStateOf(false) }

    // Load zone objects on open
    LaunchedEffect(zone.zone_id) {
        viewModel.loadZoneObjects(zone.zone_id)
    }

    Dialog(
        onDismissRequest = {
            // Save name if changed
            if (zoneName.isNotBlank() && zoneName != zone.name) {
                viewModel.renameZone(zone.zone_id, zoneName)
            }
            onDismiss()
        },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.85f),
            colors = CardDefaults.cardColors(containerColor = ParchmentBg),
            shape = RoundedCornerShape(10.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFE8DCC8))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = zoneName,
                        onValueChange = { zoneName = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TealAccent,
                            unfocusedBorderColor = ParchmentBrown,
                            focusedContainerColor = ParchmentBg,
                            unfocusedContainerColor = ParchmentBg
                        )
                    )
                    IconButton(onClick = {
                        if (zoneName.isNotBlank() && zoneName != zone.name) {
                            viewModel.renameZone(zone.zone_id, zoneName)
                        }
                        onDismiss()
                    }) {
                        Icon(Icons.Default.Close, "Close")
                    }
                }

                // Toolbar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { showAddPicker = true },
                        colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                    ) {
                        Icon(Icons.Default.Add, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add Objects", fontSize = 13.sp)
                    }
                }

                // Objects list
                if (zoneObjects.isEmpty()) {
                    Box(
                        Modifier.fillMaxWidth().weight(1f),
                        Alignment.Center
                    ) {
                        Text(
                            "No objects assigned to this zone yet.\nClick \"Add Objects\" to get started.",
                            color = ParchmentBrown,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            fontSize = 13.sp
                        )
                    }
                } else {
                    // Group by sub_type
                    val groups = zoneObjects
                        .sortedBy { it.zone_sort_order ?: 9999 }
                        .groupBy { it.sub_type ?: "Uncategorized" }
                        .toSortedMap()

                    LazyColumn(
                        modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        groups.forEach { (groupName, items) ->
                            item {
                                Text(
                                    "$groupName (${items.size})",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = ParchmentBrown,
                                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                )
                            }
                            items(items, key = { it.id }) { obj ->
                                ZoneObjectCard(
                                    obj = obj,
                                    onRemove = { viewModel.removeObjectFromZone(obj.id, zone.zone_id) }
                                )
                            }
                        }
                        item { Spacer(Modifier.height(8.dp)) }
                    }
                }
            }
        }
    }

    // Add Objects Picker
    if (showAddPicker) {
        AddObjectsPickerDialog(
            availableObjects = viewModel.getAvailableObjectsForZone(zone.zone_id),
            onDismiss = { showAddPicker = false },
            onAdd = { selectedIds ->
                val maxSort = zoneObjects.maxOfOrNull { it.zone_sort_order ?: 0 } ?: 0
                selectedIds.forEachIndexed { idx, id ->
                    viewModel.addObjectToZone(id, zone.zone_id, maxSort + idx + 1)
                }
                showAddPicker = false
            }
        )
    }
}

// ─── Zone Object Card ───────────────────────────────────────────────────────────

@Composable
private fun ZoneObjectCard(
    obj: ZoneObject,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFDF5E6)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = RoundedCornerShape(6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Default.Menu, "Drag",
                tint = ParchmentBrown.copy(alpha = 0.5f),
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = obj.name,
                modifier = Modifier.weight(1f),
                fontSize = 13.sp,
                color = ParchmentText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Surface(
                shape = RoundedCornerShape(3.dp),
                color = TealAccent.copy(alpha = 0.12f)
            ) {
                Text(
                    obj.type,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    fontSize = 10.sp,
                    color = Color(0xFF006060)
                )
            }
            IconButton(onClick = onRemove, modifier = Modifier.size(28.dp)) {
                Text("×", fontSize = 18.sp, color = DangerRed)
            }
        }
    }
}

// ─── Add Objects Picker Dialog ──────────────────────────────────────────────────

@Composable
private fun AddObjectsPickerDialog(
    availableObjects: List<CustomObject>,
    onDismiss: () -> Unit,
    onAdd: (List<String>) -> Unit
) {
    var searchText by remember { mutableStateOf("") }
    val selected = remember { mutableStateListOf<String>() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.75f),
            colors = CardDefaults.cardColors(containerColor = ParchmentBg),
            shape = RoundedCornerShape(8.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                Text(
                    "Add Objects to Zone",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = ParchmentText
                )
                Spacer(Modifier.height(12.dp))

                // Search
                OutlinedTextField(
                    value = searchText,
                    onValueChange = { searchText = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search by name, type, or category...") },
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = ParchmentBrown) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealAccent,
                        unfocusedBorderColor = ParchmentBrown
                    )
                )
                Spacer(Modifier.height(8.dp))

                // Filtered list
                val filtered = availableObjects.filter { obj ->
                    if (searchText.isBlank()) true
                    else {
                        val q = searchText.lowercase()
                        obj.name.lowercase().contains(q) ||
                            obj.type.lowercase().contains(q) ||
                            (obj.sub_type?.lowercase()?.contains(q) == true)
                    }
                }

                // Group by type
                val typeGroups = filtered.groupBy { it.type.ifBlank { "Other" } }.toSortedMap()

                if (filtered.isEmpty()) {
                    Box(Modifier.weight(1f).fillMaxWidth(), Alignment.Center) {
                        Text("No matches.", color = ParchmentBrown, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                    }
                } else {
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        typeGroups.forEach { (typeName, items) ->
                            item {
                                Text(
                                    "$typeName (${items.size})",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ParchmentText,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFFF0E6D3))
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                            items(items.sortedBy { it.name }, key = { it.id }) { obj ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (obj.id in selected) selected.remove(obj.id)
                                            else selected.add(obj.id)
                                        }
                                        .padding(horizontal = 12.dp, vertical = 7.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Checkbox(
                                        checked = obj.id in selected,
                                        onCheckedChange = {
                                            if (it) selected.add(obj.id) else selected.remove(obj.id)
                                        },
                                        colors = CheckboxDefaults.colors(checkedColor = ParchmentBrown)
                                    )
                                    Text(obj.name, fontSize = 13.sp, color = ParchmentText)
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = ParchmentBrown)
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { onAdd(selected.toList()) },
                        enabled = selected.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                    ) {
                        Text(
                            if (selected.isEmpty()) "Add Selected"
                            else "Add Selected (${selected.size})"
                        )
                    }
                }
            }
        }
    }
}
