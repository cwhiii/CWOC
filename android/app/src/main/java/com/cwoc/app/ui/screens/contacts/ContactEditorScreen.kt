package com.cwoc.app.ui.screens.contacts

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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.mapper.ContactFormState
import com.cwoc.app.ui.screens.editor.zones.ColorZone
import com.cwoc.app.ui.screens.editor.zones.EditorZoneHeader
import com.google.gson.Gson
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import com.google.gson.reflect.TypeToken

/**
 * Full-screen editor for creating and editing contacts.
 *
 * Uses a zone-based layout with collapsible sections matching the ChitEditorScreen pattern:
 * - Name fields (always visible): given, family, middle, prefix, suffix
 * - Contact Info zone (collapsible): phones, emails, addresses
 * - Details zone (collapsible): organization, nickname, social context
 * - Tags zone (collapsible): color-coded chips
 * - Color zone (collapsible): reuses ColorZone pattern
 * - Notes zone (collapsible): multiline text
 * - Dates zone (collapsible): labeled date entries
 * - Favorite toggle in the top section
 * - Delete button at bottom with confirmation dialog
 *
 * Uses existing ContactEditorViewModel for save/delete/dirty/sync logic.
 * BackHandler checks for unsaved changes before navigating back.
 * LaunchedEffect on isSaved triggers navigation back.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ContactEditorScreen(
    contactId: String,
    userId: String? = null,
    onNavigateBack: () -> Unit,
    viewModel: ContactEditorViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSaved by viewModel.isSaved.collectAsState()
    val isOwnProfile by viewModel.isOwnProfile.collectAsState()

    val isProfileMode = viewModel.isProfileMode
    val isReadOnly = isProfileMode && !isOwnProfile

    var showUnsavedDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // Track the initial form state for dirty comparison
    var initialFormState by remember { mutableStateOf<ContactFormState?>(null) }
    LaunchedEffect(isLoading) {
        if (!isLoading && initialFormState == null) {
            initialFormState = formState
        }
    }

    val isDirty = !isReadOnly && initialFormState != null && formState != initialFormState

    // Intercept system back button — check for unsaved changes
    BackHandler(enabled = true) {
        if (isDirty) {
            showUnsavedDialog = true
        } else {
            onNavigateBack()
        }
    }

    // Navigate back when save or delete completes
    LaunchedEffect(isSaved) {
        if (isSaved) {
            onNavigateBack()
        }
    }

    // ─── Unsaved Changes Dialog ─────────────────────────────────────────────
    if (showUnsavedDialog) {
        AlertDialog(
            onDismissRequest = { showUnsavedDialog = false },
            title = { Text("Unsaved Changes") },
            text = { Text("You have unsaved changes. What would you like to do?") },
            confirmButton = {
                TextButton(onClick = {
                    showUnsavedDialog = false
                    viewModel.save()
                }) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnsavedDialog = false }) {
                    Text("Cancel")
                }
                TextButton(onClick = {
                    showUnsavedDialog = false
                    viewModel.discard()
                }) {
                    Text("Discard")
                }
            }
        )
    }

    // ─── Delete Confirmation Dialog ─────────────────────────────────────────
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Contact") },
            text = { Text("Are you sure you want to delete this contact? This action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    viewModel.delete()
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when {
                            isProfileMode -> "Profile"
                            formState.isNew -> "New Contact"
                            else -> "Edit Contact"
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (isDirty) {
                            showUnsavedDialog = true
                        } else {
                            onNavigateBack()
                        }
                    }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    if (!isReadOnly) {
                        // Favorite toggle in toolbar (not shown in profile mode)
                        if (!isProfileMode) {
                            IconButton(onClick = {
                                viewModel.updateField { it.copy(favorite = !it.favorite) }
                            }) {
                                Icon(
                                    imageVector = if (formState.favorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                    contentDescription = if (formState.favorite) "Remove from favorites" else "Add to favorites",
                                    tint = if (formState.favorite) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                        // Save button
                        IconButton(onClick = { viewModel.save() }) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Save"
                            )
                        }
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
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Y2: Conflict banner for contacts (simplified — checks form state)
                // Note: hasUnviewedConflict would need to be exposed from the ViewModel

                // Profile mode: read-only banner for other users
                if (isReadOnly) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD))
                    ) {
                        Text(
                            text = "Viewing another user's profile (read-only)",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF1565C0),
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // ─── Profile Image Section (Task 35.5) ────────────────────────
                ContactProfileImageSection(
                    contactId = formState.id,
                    isNew = formState.isNew,
                    readOnly = isReadOnly
                )

                Spacer(modifier = Modifier.height(8.dp))

                // ─── Name Section (always visible) ──────────────────────────────
                NameSection(
                    formState = formState,
                    onUpdate = { if (!isReadOnly) viewModel.updateForm(it) },
                    readOnly = isReadOnly
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Contact Info Zone (collapsible) ────────────────────────────
                ContactInfoZone(formState = formState, onUpdate = { viewModel.updateForm(it) })

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Details Zone (collapsible) ─────────────────────────────────
                DetailsZone(formState = formState, onUpdate = { viewModel.updateForm(it) })

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Tags Zone (collapsible) ────────────────────────────────────
                ContactTagsZone(
                    tags = formState.tags,
                    onTagsChange = { viewModel.updateField { state -> state.copy(tags = it) } }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Color Zone (collapsible) ───────────────────────────────────
                ColorZone(
                    selectedColor = formState.color.ifBlank { null },
                    customColors = emptyList(),
                    onColorSelected = {
                        viewModel.updateField { state -> state.copy(color = it ?: "") }
                    }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Notes Zone (collapsible) ───────────────────────────────────
                ContactNotesZone(
                    notes = formState.notes,
                    onNotesChange = { viewModel.updateField { state -> state.copy(notes = it) } }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Dates Zone (collapsible) ───────────────────────────────────
                ContactDatesZone(
                    datesJson = formState.dates,
                    onDatesChange = { viewModel.updateField { state -> state.copy(dates = it) } }
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Delete Button ──────────────────────────────────────────────
                if (!formState.isNew && !isProfileMode) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { showDeleteDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Delete Contact")
                    }
                }

                // Bottom spacing
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

// ─── Name Section (always visible) ──────────────────────────────────────────────

/**
 * Name fields section — always visible, not collapsible.
 * Contains: given name, family name, middle names, prefix, suffix.
 */
@Composable
private fun NameSection(
    formState: ContactFormState,
    onUpdate: (ContactFormState) -> Unit,
    readOnly: Boolean = false
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Given name and family name side by side
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = formState.givenName,
                onValueChange = { onUpdate(formState.copy(givenName = it)) },
                label = { Text("Given Name") },
                singleLine = true,
                enabled = !readOnly,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = formState.surname,
                onValueChange = { onUpdate(formState.copy(surname = it)) },
                label = { Text("Family Name") },
                singleLine = true,
                enabled = !readOnly,
                modifier = Modifier.weight(1f)
            )
        }

        // Middle names
        OutlinedTextField(
            value = formState.middleNames,
            onValueChange = { onUpdate(formState.copy(middleNames = it)) },
            label = { Text("Middle Names") },
            singleLine = true,
            enabled = !readOnly,
            modifier = Modifier.fillMaxWidth()
        )

        // Prefix and suffix side by side
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = formState.prefix,
                onValueChange = { onUpdate(formState.copy(prefix = it)) },
                label = { Text("Prefix") },
                singleLine = true,
                enabled = !readOnly,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = formState.suffix,
                onValueChange = { onUpdate(formState.copy(suffix = it)) },
                label = { Text("Suffix") },
                singleLine = true,
                enabled = !readOnly,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

// ─── Profile Image Section (Task 35.5) ──────────────────────────────────────────

/**
 * Contact profile image section with camera capture, gallery picker, and image viewer.
 *
 * Tap profile image → options: "Take Photo" | "Choose Gallery" | "Remove"
 * - Camera intent + upload to /api/contacts/{id}/image
 * - Gallery picker + upload
 * - Remove: DELETE /api/contacts/{id}/image
 */
@Composable
private fun ContactProfileImageSection(
    contactId: String,
    isNew: Boolean,
    readOnly: Boolean
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    var showImageOptions by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var showImageViewer by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    var imageUrl by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }

    val prefs = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
    val serverUrl = prefs.getString("server_url", "") ?: ""
    val authToken = prefs.getString("auth_token", "") ?: ""

    // Build image URL
    val contactImageUrl = if (!isNew && serverUrl.isNotBlank()) {
        "$serverUrl/api/contacts/$contactId/image"
    } else null

    // Gallery picker
    val galleryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        if (uri != null && !isNew) {
            coroutineScope.launch {
                uploadContactImage(context, uri, contactId, serverUrl, authToken)
                // Force refresh
                imageUrl = "$serverUrl/api/contacts/$contactId/image?t=${System.currentTimeMillis()}"
            }
        }
    }

    // Camera capture
    val cameraLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.TakePicturePreview()
    ) { bitmap: android.graphics.Bitmap? ->
        if (bitmap != null && !isNew) {
            coroutineScope.launch {
                uploadContactBitmap(bitmap, contactId, serverUrl, authToken)
                imageUrl = "$serverUrl/api/contacts/$contactId/image?t=${System.currentTimeMillis()}"
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Profile image circle
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable {
                    if (readOnly && contactImageUrl != null) {
                        showImageViewer = true
                    } else if (!readOnly) {
                        showImageOptions = true
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            if (contactImageUrl != null) {
                // Show contact image (using text placeholder since Coil may not be available)
                Text(
                    text = "👤",
                    style = MaterialTheme.typography.headlineLarge
                )
            } else {
                Text(
                    text = "👤",
                    style = MaterialTheme.typography.headlineLarge
                )
            }
        }

        if (!readOnly && !isNew) {
            Text(
                text = "Tap to change photo",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }

    // Image options dialog
    if (showImageOptions) {
        AlertDialog(
            onDismissRequest = { showImageOptions = false },
            title = { Text("Profile Photo") },
            text = { Text("Choose an option for the profile photo.") },
            confirmButton = {
                Column {
                    TextButton(onClick = {
                        showImageOptions = false
                        cameraLauncher.launch(null)
                    }) {
                        Text("📷 Take Photo")
                    }
                    TextButton(onClick = {
                        showImageOptions = false
                        galleryLauncher.launch("image/*")
                    }) {
                        Text("🖼️ Choose from Gallery")
                    }
                    if (!isNew) {
                        TextButton(onClick = {
                            showImageOptions = false
                            coroutineScope.launch {
                                deleteContactImage(contactId, serverUrl, authToken)
                                imageUrl = null
                            }
                        }) {
                            Text("🗑️ Remove Photo", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showImageOptions = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Full-screen image viewer
    if (showImageViewer && contactImageUrl != null) {
        com.cwoc.app.ui.components.ImageViewDialog(
            imageUrl = contactImageUrl,
            contentDescription = "Contact profile photo",
            onDismiss = { showImageViewer = false }
        )
    }
}

private suspend fun uploadContactImage(
    context: android.content.Context,
    uri: android.net.Uri,
    contactId: String,
    serverUrl: String,
    authToken: String
) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    try {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val inputStream = contentResolver.openInputStream(uri) ?: return@withContext
        val bytes = inputStream.readBytes()
        inputStream.close()

        val requestBody = bytes.toRequestBody(mimeType.toMediaType())
        val multipartBody = okhttp3.MultipartBody.Builder()
            .setType(okhttp3.MultipartBody.FORM)
            .addFormDataPart("image", "profile.jpg", requestBody)
            .build()

        val request = okhttp3.Request.Builder()
            .url("$serverUrl/api/contacts/$contactId/image")
            .addHeader("Authorization", "Bearer $authToken")
            .post(multipartBody)
            .build()

        okhttp3.OkHttpClient().newCall(request).execute()
    } catch (_: Exception) {}
}

private suspend fun uploadContactBitmap(
    bitmap: android.graphics.Bitmap,
    contactId: String,
    serverUrl: String,
    authToken: String
) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    try {
        val stream = java.io.ByteArrayOutputStream()
        bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, stream)
        val bytes = stream.toByteArray()

        val requestBody = bytes.toRequestBody("image/jpeg".toMediaType())
        val multipartBody = okhttp3.MultipartBody.Builder()
            .setType(okhttp3.MultipartBody.FORM)
            .addFormDataPart("image", "profile.jpg", requestBody)
            .build()

        val request = okhttp3.Request.Builder()
            .url("$serverUrl/api/contacts/$contactId/image")
            .addHeader("Authorization", "Bearer $authToken")
            .post(multipartBody)
            .build()

        okhttp3.OkHttpClient().newCall(request).execute()
    } catch (_: Exception) {}
}

private suspend fun deleteContactImage(
    contactId: String,
    serverUrl: String,
    authToken: String
) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    try {
        val request = okhttp3.Request.Builder()
            .url("$serverUrl/api/contacts/$contactId/image")
            .addHeader("Authorization", "Bearer $authToken")
            .delete()
            .build()

        okhttp3.OkHttpClient().newCall(request).execute()
    } catch (_: Exception) {}
}

// ─── Contact Info Zone (collapsible) ────────────────────────────────────────────

/**
 * Collapsible zone for phones, emails, and addresses.
 * Each is a multi-value list stored as a JSON array string in the form state.
 * Provides add/remove buttons for each entry.
 *
 * Validates: Requirements 1.2, 1.3
 */
@Composable
private fun ContactInfoZone(
    formState: ContactFormState,
    onUpdate: (ContactFormState) -> Unit
) {
    val hasContent = formState.phones.isNotBlank() ||
            formState.emails.isNotBlank() ||
            formState.addresses.isNotBlank()
    var isExpanded by remember { mutableStateOf(hasContent) }

    EditorZoneHeader(
        title = "Contact Info",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasContent) {
                val count = countJsonArrayItems(formState.phones) +
                        countJsonArrayItems(formState.emails) +
                        countJsonArrayItems(formState.addresses)
                Text(
                    text = "$count item${if (count != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Phones
            MultiValueField(
                label = "Phones",
                jsonValue = formState.phones,
                itemLabel = "Phone",
                onValueChange = { onUpdate(formState.copy(phones = it)) }
            )

            // Emails
            MultiValueField(
                label = "Emails",
                jsonValue = formState.emails,
                itemLabel = "Email",
                onValueChange = { onUpdate(formState.copy(emails = it)) }
            )

            // Addresses
            MultiValueField(
                label = "Addresses",
                jsonValue = formState.addresses,
                itemLabel = "Address",
                onValueChange = { onUpdate(formState.copy(addresses = it)) }
            )
        }
    }
}

// ─── Details Zone (collapsible) ─────────────────────────────────────────────────

/**
 * Collapsible zone for organization, nickname, and social context fields.
 */
@Composable
private fun DetailsZone(
    formState: ContactFormState,
    onUpdate: (ContactFormState) -> Unit
) {
    val hasContent = formState.organization.isNotBlank() ||
            formState.nickname.isNotBlank() ||
            formState.socialContext.isNotBlank()
    var isExpanded by remember { mutableStateOf(hasContent) }

    EditorZoneHeader(
        title = "Details",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasContent) {
                val summary = listOfNotNull(
                    formState.organization.ifBlank { null },
                    formState.nickname.ifBlank { null }
                ).joinToString(", ")
                if (summary.isNotBlank()) {
                    Text(
                        text = summary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1
                    )
                }
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = formState.organization,
                onValueChange = { onUpdate(formState.copy(organization = it)) },
                label = { Text("Organization") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = formState.nickname,
                onValueChange = { onUpdate(formState.copy(nickname = it)) },
                label = { Text("Nickname") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = formState.socialContext,
                onValueChange = { onUpdate(formState.copy(socialContext = it)) },
                label = { Text("Social Context") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // X1: Display Name field
            OutlinedTextField(
                value = formState.displayName,
                onValueChange = { onUpdate(formState.copy(displayName = it)) },
                label = { Text("Display Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // X3: Call Signs field
            OutlinedTextField(
                value = formState.callSigns,
                onValueChange = { onUpdate(formState.copy(callSigns = it)) },
                label = { Text("Call Signs") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // X4: X Handles field
            OutlinedTextField(
                value = formState.xHandles,
                onValueChange = { onUpdate(formState.copy(xHandles = it)) },
                label = { Text("X Handles") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // X5: Websites field
            OutlinedTextField(
                value = formState.websites,
                onValueChange = { onUpdate(formState.copy(websites = it)) },
                label = { Text("Websites") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // X6: Has Signal toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Has Signal", style = MaterialTheme.typography.bodyMedium)
                androidx.compose.material3.Switch(
                    checked = formState.hasSignal,
                    onCheckedChange = { onUpdate(formState.copy(hasSignal = it)) }
                )
            }
            // X7: Signal Username (shown when hasSignal is true)
            if (formState.hasSignal) {
                OutlinedTextField(
                    value = formState.signalUsername,
                    onValueChange = { onUpdate(formState.copy(signalUsername = it)) },
                    label = { Text("Signal Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            // X8: PGP Key field
            OutlinedTextField(
                value = formState.pgpKey,
                onValueChange = { onUpdate(formState.copy(pgpKey = it)) },
                label = { Text("PGP Public Key") },
                minLines = 2,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth()
            )
            // X11: Shared to Vault toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Shared to Vault", style = MaterialTheme.typography.bodyMedium)
                androidx.compose.material3.Switch(
                    checked = formState.sharedToVault,
                    onCheckedChange = { onUpdate(formState.copy(sharedToVault = it)) }
                )
            }
        }
    }
}

// ─── Tags Zone (collapsible) ────────────────────────────────────────────────────

/**
 * Collapsible Tags zone for contacts. Displays tags as InputChips with
 * comma-separated input for adding new tags.
 * Simple chip-based pattern (full picker comes in task 5.3).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ContactTagsZone(
    tags: List<String>,
    onTagsChange: (List<String>) -> Unit
) {
    var isExpanded by remember { mutableStateOf(tags.isNotEmpty()) }
    var textFieldValue by remember { mutableStateOf("") }

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
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // Display existing tags as chips
            if (tags.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    tags.forEach { tag ->
                        InputChip(
                            selected = false,
                            onClick = { onTagsChange(tags - tag) },
                            label = { Text(tag) },
                            trailingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Remove $tag",
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                }
            }

            // Input field for adding tags
            OutlinedTextField(
                value = textFieldValue,
                onValueChange = { newText ->
                    if (newText.contains(",")) {
                        val parts = newText.split(",")
                        val newTags = parts.dropLast(1)
                            .map { it.trim() }
                            .filter { it.isNotBlank() && it !in tags }
                        if (newTags.isNotEmpty()) {
                            onTagsChange(tags + newTags)
                        }
                        textFieldValue = parts.last().trimStart()
                    } else {
                        textFieldValue = newText
                    }
                },
                label = { Text("Add tag (comma-separated)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─── Notes Zone (collapsible) ───────────────────────────────────────────────────

/**
 * Collapsible Notes zone with a multiline text field.
 */
@Composable
private fun ContactNotesZone(
    notes: String,
    onNotesChange: (String) -> Unit
) {
    var isExpanded by remember { mutableStateOf(notes.isNotBlank()) }

    EditorZoneHeader(
        title = "Notes",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && notes.isNotBlank()) {
                Text(
                    text = "${notes.lines().size} line${if (notes.lines().size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        OutlinedTextField(
            value = notes,
            onValueChange = onNotesChange,
            label = { Text("Notes") },
            minLines = 3,
            maxLines = 12,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

// ─── Dates Zone (collapsible) ───────────────────────────────────────────────────

/**
 * Collapsible Dates zone for labeled date entries (birthday, anniversary, etc.).
 * Dates are stored as a JSON array of objects: [{"label": "Birthday", "date": "1990-01-15"}, ...]
 * Provides add/remove buttons for each date entry.
 */
@Composable
private fun ContactDatesZone(
    datesJson: String,
    onDatesChange: (String) -> Unit
) {
    val dates = remember(datesJson) { parseDateEntries(datesJson) }
    var isExpanded by remember { mutableStateOf(dates.isNotEmpty()) }

    EditorZoneHeader(
        title = "Dates",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && dates.isNotEmpty()) {
                Text(
                    text = "${dates.size} date${if (dates.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            dates.forEachIndexed { index, entry ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = entry.label,
                        onValueChange = { newLabel ->
                            val updated = dates.toMutableList()
                            updated[index] = entry.copy(label = newLabel)
                            onDatesChange(serializeDateEntries(updated))
                        },
                        label = { Text("Label") },
                        singleLine = true,
                        modifier = Modifier.weight(0.4f)
                    )
                    OutlinedTextField(
                        value = entry.date,
                        onValueChange = { newDate ->
                            val updated = dates.toMutableList()
                            updated[index] = entry.copy(date = newDate)
                            onDatesChange(serializeDateEntries(updated))
                        },
                        label = { Text("Date") },
                        singleLine = true,
                        modifier = Modifier.weight(0.5f)
                    )
                    IconButton(
                        onClick = {
                            val updated = dates.toMutableList()
                            updated.removeAt(index)
                            onDatesChange(serializeDateEntries(updated))
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Remove date",
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Add date button
            TextButton(
                onClick = {
                    val updated = dates + DateEntry(label = "", date = "")
                    onDatesChange(serializeDateEntries(updated))
                }
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Date")
            }
        }
    }
}

// ─── Multi-Value Field Component ────────────────────────────────────────────────

/**
 * Reusable multi-value field for phones, emails, addresses.
 * Parses a JSON array string into individual text fields with add/remove buttons.
 *
 * Validates: Requirements 1.3
 */
@Composable
private fun MultiValueField(
    label: String,
    jsonValue: String,
    itemLabel: String,
    onValueChange: (String) -> Unit,
    // X2: Type labels for each entry
    typeOptions: List<String> = emptyList()
) {
    val items = remember(jsonValue) { parseJsonArray(jsonValue) }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        items.forEachIndexed { index, item ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // X2: Type label dropdown (Home/Work/Mobile/Other)
                if (typeOptions.isNotEmpty()) {
                    var typeExpanded by remember { mutableStateOf(false) }
                    Box {
                        Text(
                            text = typeOptions.firstOrNull() ?: "Type",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .clickable { typeExpanded = true }
                                .padding(4.dp)
                        )
                        androidx.compose.material3.DropdownMenu(
                            expanded = typeExpanded,
                            onDismissRequest = { typeExpanded = false }
                        ) {
                            typeOptions.forEach { type ->
                                androidx.compose.material3.DropdownMenuItem(
                                    text = { Text(type) },
                                    onClick = { typeExpanded = false }
                                )
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = item,
                    onValueChange = { newValue ->
                        val updated = items.toMutableList()
                        updated[index] = newValue
                        onValueChange(serializeJsonArray(updated))
                    },
                    label = { Text("$itemLabel ${index + 1}") },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    onClick = {
                        val updated = items.toMutableList()
                        updated.removeAt(index)
                        onValueChange(serializeJsonArray(updated))
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove $itemLabel",
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Add button
        TextButton(
            onClick = {
                val updated = items + ""
                onValueChange(serializeJsonArray(updated))
            }
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("Add $itemLabel")
        }
    }
}

// ─── JSON Utility Functions ─────────────────────────────────────────────────────

/**
 * Parses a JSON array string (e.g., '["555-1234","555-5678"]') into a list of strings.
 * Returns an empty list if the string is blank or not valid JSON.
 */
private fun parseJsonArray(json: String): List<String> {
    if (json.isBlank()) return emptyList()
    return try {
        val type = object : TypeToken<List<String>>() {}.type
        Gson().fromJson<List<String>>(json, type) ?: emptyList()
    } catch (_: Exception) {
        // If it's not a JSON array, treat the whole string as a single item
        if (json.isNotBlank()) listOf(json) else emptyList()
    }
}

/**
 * Serializes a list of strings into a JSON array string.
 * Keeps all entries (including blank ones for in-progress editing).
 * Returns empty string if the list is empty.
 */
private fun serializeJsonArray(items: List<String>): String {
    if (items.isEmpty()) return ""
    return Gson().toJson(items)
}

/**
 * Counts the number of items in a JSON array string.
 */
private fun countJsonArrayItems(json: String): Int {
    return parseJsonArray(json).size
}

/**
 * Data class for a labeled date entry.
 */
private data class DateEntry(
    val label: String,
    val date: String
)

/**
 * Parses a JSON string of date entries.
 * Expected format: [{"label": "Birthday", "date": "1990-01-15"}, ...]
 */
private fun parseDateEntries(json: String): List<DateEntry> {
    if (json.isBlank()) return emptyList()
    return try {
        val type = object : TypeToken<List<Map<String, String>>>() {}.type
        val list: List<Map<String, String>> = Gson().fromJson(json, type) ?: emptyList()
        list.map { map ->
            DateEntry(
                label = map["label"] ?: "",
                date = map["date"] ?: ""
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Serializes a list of DateEntry objects into a JSON string.
 * Filters out entries where both label and date are blank.
 */
private fun serializeDateEntries(entries: List<DateEntry>): String {
    val filtered = entries.filter { it.label.isNotBlank() || it.date.isNotBlank() }
    if (filtered.isEmpty()) return ""
    val maps = filtered.map { mapOf("label" to it.label, "date" to it.date) }
    return Gson().toJson(maps)
}
