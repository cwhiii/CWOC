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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.QrCode
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
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.mapper.ContactFormState
import com.cwoc.app.ui.components.DropdownWithCustom
import com.cwoc.app.ui.components.PrefixOptions
import com.cwoc.app.ui.components.SuffixOptions
import com.cwoc.app.ui.screens.editor.zones.ColorZone
import com.cwoc.app.ui.screens.editor.zones.EditorZoneHeader
import com.google.gson.Gson
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
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
    val customColors by viewModel.customColors.collectAsState()

    val isProfileMode = viewModel.isProfileMode
    val isReadOnly = isProfileMode && !isOwnProfile

    var showUnsavedDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showQrDialog by remember { mutableStateOf(false) }

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

    // ─── QR Code Dialog ─────────────────────────────────────────────────────
    if (showQrDialog && !formState.isNew) {
        com.cwoc.app.ui.components.ContactFormQrCodeDialog(
            givenName = formState.givenName,
            surname = formState.surname,
            middleNames = formState.middleNames,
            prefix = formState.prefix,
            suffix = formState.suffix,
            displayName = formState.displayName,
            phones = formState.phones,
            emails = formState.emails,
            addresses = formState.addresses,
            websites = formState.websites,
            callSigns = formState.callSigns,
            xHandles = formState.xHandles,
            hasSignal = formState.hasSignal,
            signalUsername = formState.signalUsername,
            pgpKey = formState.pgpKey,
            favorite = formState.favorite,
            organization = formState.organization,
            nickname = formState.nickname,
            socialContext = formState.socialContext,
            color = formState.color,
            onDismiss = { showQrDialog = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    // Show computed display name like the web does
                    val displayTitle = when {
                        isProfileMode -> "Profile"
                        formState.isNew -> "New Contact"
                        else -> {
                            val parts = listOfNotNull(
                                formState.prefix.ifBlank { null },
                                formState.givenName.ifBlank { null },
                                formState.middleNames.ifBlank { null },
                                formState.surname.ifBlank { null },
                                formState.suffix.ifBlank { null }
                            )
                            if (parts.isNotEmpty()) parts.joinToString(" ") else "Edit Contact"
                        }
                    }
                    Text(
                        text = displayTitle,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
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
                        // Share button (not shown for new contacts or profile mode)
                        if (!isProfileMode && !formState.isNew) {
                            val shareContext = LocalContext.current
                            IconButton(onClick = {
                                shareContactAsVCard(shareContext, formState)
                            }) {
                                Icon(
                                    imageVector = Icons.Default.Share,
                                    contentDescription = "Share contact"
                                )
                            }
                            // QR code button (matches web's qrButton)
                            IconButton(onClick = { showQrDialog = true }) {
                                Icon(
                                    imageVector = Icons.Default.QrCode,
                                    contentDescription = "Show QR code"
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
                    readOnly = isReadOnly,
                    isProfileMode = viewModel.isProfileMode
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

                // ─── Social & Web Zone (collapsible) ────────────────────────────
                SocialWebZone(formState = formState, onUpdate = { viewModel.updateForm(it) })

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                // ─── Security Zone (collapsible) ────────────────────────────────
                SecurityZone(formState = formState, onUpdate = { viewModel.updateForm(it) })

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
                    customColors = customColors,
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

                // ─── Profile-Only: Password Change Zone ─────────────────────────
                if (isProfileMode && !isReadOnly) {
                    PasswordChangeZone()
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                }

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

        // Prefix and suffix side by side — using dropdown with predefined options + custom
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DropdownWithCustom(
                label = "Prefix",
                value = formState.prefix,
                options = PrefixOptions,
                onValueChange = { onUpdate(formState.copy(prefix = it)) },
                modifier = Modifier.weight(1f)
            )
            DropdownWithCustom(
                label = "Suffix",
                value = formState.suffix,
                options = SuffixOptions,
                onValueChange = { onUpdate(formState.copy(suffix = it)) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

// ─── Profile Image Section (Task 35.5) ──────────────────────────────────────────

/**
 * Contact profile image section with camera capture, gallery picker, and image viewer.
 * Actually loads and displays the contact's profile image using Coil.
 * Shows a type badge ("Contact" or "Profile") below the image.
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
    readOnly: Boolean,
    isProfileMode: Boolean = false
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    var showImageOptions by remember { mutableStateOf(false) }
    var showImageViewer by remember { mutableStateOf(false) }
    var imageRefreshKey by remember { mutableStateOf(0L) }

    val prefs = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
    val serverUrl = prefs.getString("server_url", "") ?: ""
    val authToken = prefs.getString("auth_token", "") ?: ""

    // Build image URL with cache-busting key
    val contactImageUrl = if (!isNew && serverUrl.isNotBlank()) {
        if (imageRefreshKey > 0) {
            "$serverUrl/api/contacts/$contactId/image?t=$imageRefreshKey"
        } else {
            "$serverUrl/api/contacts/$contactId/image"
        }
    } else null

    // Gallery picker
    val galleryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        if (uri != null && !isNew) {
            coroutineScope.launch {
                uploadContactImage(context, uri, contactId, serverUrl, authToken)
                imageRefreshKey = System.currentTimeMillis()
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
                imageRefreshKey = System.currentTimeMillis()
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
                AsyncImage(
                    model = coil.request.ImageRequest.Builder(context)
                        .data(contactImageUrl)
                        .addHeader("Authorization", "Bearer $authToken")
                        .crossfade(true)
                        .build(),
                    contentDescription = "Contact photo",
                    modifier = Modifier
                        .size(80.dp)
                        .clip(androidx.compose.foundation.shape.CircleShape),
                    contentScale = ContentScale.Crop
                )
                // Fallback placeholder shown behind AsyncImage if it fails
            }
            // Always show placeholder behind (AsyncImage will cover it on success)
            if (isNew || contactImageUrl == null) {
                Text(
                    text = "👤",
                    style = MaterialTheme.typography.headlineLarge
                )
            }
        }

        // Type badge: "Contact" or "Profile"
        Spacer(modifier = Modifier.height(4.dp))
        Card(
            colors = CardDefaults.cardColors(
                containerColor = Color(0x2E4682B4) // Light blue tint
            ),
            modifier = Modifier.padding(horizontal = 8.dp)
        ) {
            Text(
                text = if (isProfileMode) "👤 Profile" else "📇 Contact",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF1565C0),
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        if (!readOnly && !isNew) {
            Text(
                text = "Tap photo to change",
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
                                imageRefreshKey = System.currentTimeMillis()
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

    // ─── Address Map Preview: geocode first address for inline map ───────
    val context = LocalContext.current
    var mapLat by remember { mutableStateOf<Double?>(null) }
    var mapLon by remember { mutableStateOf<Double?>(null) }
    var firstAddressValue by remember { mutableStateOf<String?>(null) }

    // Parse addresses JSON to extract first non-empty address value and check for lat/lon
    LaunchedEffect(formState.addresses) {
        mapLat = null
        mapLon = null
        firstAddressValue = null

        if (formState.addresses.isBlank()) return@LaunchedEffect

        try {
            val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
            val entries: List<Map<String, Any?>> = Gson().fromJson(formState.addresses, type) ?: emptyList()

            // First check if any entry has lat/lon fields (geocoded coordinates)
            for (entry in entries) {
                val lat = (entry["lat"] as? Number)?.toDouble()
                val lon = (entry["lon"] as? Number)?.toDouble()
                if (lat != null && lon != null) {
                    mapLat = lat
                    mapLon = lon
                    firstAddressValue = (entry["value"] as? String)?.trim()
                    return@LaunchedEffect
                }
            }

            // No stored coordinates — geocode the first non-empty address
            val firstAddr = entries.firstOrNull { ((it["value"] as? String) ?: "").trim().isNotBlank() }
            val addrValue = (firstAddr?.get("value") as? String)?.trim()
            if (addrValue.isNullOrBlank()) return@LaunchedEffect

            firstAddressValue = addrValue
            val result = com.cwoc.app.ui.util.GeocodingUtil.geocode(addrValue)
            if (result != null) {
                mapLat = result.lat
                mapLon = result.lon
            }
        } catch (_: Exception) {
            // JSON parse or geocoding failure — hide map
        }
    }

    EditorZoneHeader(
        title = "Contact Info",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasContent) {
                val count = countMultiValueItems(formState.phones) +
                        countMultiValueItems(formState.emails) +
                        countMultiValueItems(formState.addresses)
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
                onValueChange = { onUpdate(formState.copy(phones = it)) },
                defaultLabel = "Mobile",
                valuePlaceholder = "+1-555-0100"
            )

            // Emails
            MultiValueField(
                label = "Emails",
                jsonValue = formState.emails,
                itemLabel = "Email",
                onValueChange = { onUpdate(formState.copy(emails = it)) },
                defaultLabel = "Home",
                valuePlaceholder = "user@example.com"
            )

            // Addresses
            MultiValueField(
                label = "Addresses",
                jsonValue = formState.addresses,
                itemLabel = "Address",
                onValueChange = { onUpdate(formState.copy(addresses = it)) },
                defaultLabel = "Home",
                valuePlaceholder = "123 Main St, City, ST 12345",
                showMapButton = true
            )

            // ─── Inline Map Preview (Req 18.4, 18.5) ────────────────────────
            // Show map preview when geocoded coordinates are available
            val lat = mapLat
            val lon = mapLon
            if (lat != null && lon != null) {
                Spacer(modifier = Modifier.height(4.dp))
                ContactMapPreview(
                    lat = lat,
                    lon = lon,
                    onTap = {
                        // Open full maps app with the address
                        val addr = firstAddressValue ?: "$lat,$lon"
                        openAddressInMaps(context, addr)
                    }
                )
            }
        }
    }
}

// ─── Details Zone (collapsible) ─────────────────────────────────────────────────

/**
 * Collapsible zone for organization, nickname, social context, and display name.
 * Matches the web's "Context" zone.
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
                placeholder = { Text("How you know them") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            // Display Name field
            OutlinedTextField(
                value = formState.displayName,
                onValueChange = { onUpdate(formState.copy(displayName = it)) },
                label = { Text("Display Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─── Social & Web Zone (collapsible) ────────────────────────────────────────────

/**
 * Collapsible zone for X handles, websites, and call signs.
 * These are multi-value fields stored as JSON arrays of {label, value} objects.
 * Matches the web's "Social & Web" zone.
 */
@Composable
private fun SocialWebZone(
    formState: ContactFormState,
    onUpdate: (ContactFormState) -> Unit
) {
    val hasContent = formState.xHandles.isNotBlank() ||
            formState.websites.isNotBlank() ||
            formState.callSigns.isNotBlank()
    var isExpanded by remember { mutableStateOf(hasContent) }

    EditorZoneHeader(
        title = "Social & Web",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasContent) {
                val count = countMultiValueItems(formState.xHandles) +
                        countMultiValueItems(formState.websites) +
                        countMultiValueItems(formState.callSigns)
                Text(
                    text = "$count item${if (count != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // X Handles
            MultiValueField(
                label = "X Handles",
                jsonValue = formState.xHandles,
                itemLabel = "Handle",
                onValueChange = { onUpdate(formState.copy(xHandles = it)) },
                defaultLabel = "X",
                valuePlaceholder = "@username"
            )

            // Websites
            MultiValueField(
                label = "Websites",
                jsonValue = formState.websites,
                itemLabel = "URL",
                onValueChange = { onUpdate(formState.copy(websites = it)) },
                defaultLabel = "Website",
                valuePlaceholder = "https://example.com"
            )

            // Call Signs
            MultiValueField(
                label = "Call Signs",
                jsonValue = formState.callSigns,
                itemLabel = "Call Sign",
                onValueChange = { onUpdate(formState.copy(callSigns = it)) },
                defaultLabel = "Ham",
                valuePlaceholder = "KD2ABC"
            )
        }
    }
}

// ─── Security Zone (collapsible) ────────────────────────────────────────────────

/**
 * Collapsible zone for Signal, PGP key, and Vault toggle.
 * Matches the web's "Security" zone.
 */
@Composable
private fun SecurityZone(
    formState: ContactFormState,
    onUpdate: (ContactFormState) -> Unit
) {
    val hasContent = formState.hasSignal ||
            formState.pgpKey.isNotBlank() ||
            formState.sharedToVault
    var isExpanded by remember { mutableStateOf(hasContent) }

    EditorZoneHeader(
        title = "Security",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasContent) {
                val items = mutableListOf<String>()
                if (formState.hasSignal) items.add("Signal")
                if (formState.pgpKey.isNotBlank()) items.add("PGP")
                if (formState.sharedToVault) items.add("Vault")
                Text(
                    text = items.joinToString(", "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // Has Signal toggle
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
            // Signal Username (shown when hasSignal is true)
            if (formState.hasSignal) {
                OutlinedTextField(
                    value = formState.signalUsername,
                    onValueChange = { onUpdate(formState.copy(signalUsername = it)) },
                    label = { Text("Signal Username") },
                    placeholder = { Text("Signal username or phone") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                // Signal message button (shown when username is not blank)
                if (formState.signalUsername.isNotBlank()) {
                    val signalContext = LocalContext.current
                    TextButton(
                        onClick = { openSignalMessage(signalContext, formState.signalUsername) }
                    ) {
                        Text("💬 Message on Signal")
                    }
                }
            }
            // PGP Key field
            OutlinedTextField(
                value = formState.pgpKey,
                onValueChange = { onUpdate(formState.copy(pgpKey = it)) },
                label = { Text("PGP Public Key") },
                placeholder = { Text("Paste PGP public key here...") },
                minLines = 2,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth()
            )
            // PGP Validation button + result
            if (formState.pgpKey.isNotBlank()) {
                var pgpValidationResult by remember { mutableStateOf<String?>(null) }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(onClick = {
                        pgpValidationResult = validatePgpKey(formState.pgpKey)
                    }) {
                        Text("✓ Validate Key")
                    }
                    pgpValidationResult?.let { result ->
                        Text(
                            text = result,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (result.startsWith("✅")) Color(0xFF1B5E20) else Color(0xFFB22222)
                        )
                    }
                }
            }
            // Shared to Vault toggle
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
 * Dates are stored as a JSON array of objects: [{"label": "Birthday", "value": "1990-01-15", "show_on_calendar": true}, ...]
 * Provides add/remove buttons for each date entry with a show_on_calendar toggle.
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
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Label input (e.g., "Birthday", "Anniversary")
                    OutlinedTextField(
                        value = entry.label,
                        onValueChange = { newLabel ->
                            val updated = dates.toMutableList()
                            updated[index] = entry.copy(label = newLabel)
                            onDatesChange(serializeDateEntries(updated))
                        },
                        label = { Text("Label") },
                        placeholder = { Text("Birthday") },
                        singleLine = true,
                        modifier = Modifier.weight(0.3f)
                    )
                    // Date value input (YYYY-MM-DD format)
                    OutlinedTextField(
                        value = entry.value,
                        onValueChange = { newValue ->
                            val updated = dates.toMutableList()
                            updated[index] = entry.copy(value = newValue)
                            onDatesChange(serializeDateEntries(updated))
                        },
                        label = { Text("Date") },
                        placeholder = { Text("YYYY-MM-DD") },
                        singleLine = true,
                        modifier = Modifier.weight(0.4f)
                    )
                    // Show on calendar toggle
                    androidx.compose.material3.Checkbox(
                        checked = entry.showOnCalendar,
                        onCheckedChange = { checked ->
                            val updated = dates.toMutableList()
                            updated[index] = entry.copy(showOnCalendar = checked)
                            onDatesChange(serializeDateEntries(updated))
                        }
                    )
                    // Remove button
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
                    val updated = dates + DateEntry(label = "", value = "", showOnCalendar = true)
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
 * Reusable multi-value field for phones, emails, addresses, call signs, X handles, websites.
 * Parses a JSON array of {label, value} objects into individual rows with label + value text fields
 * and add/remove buttons.
 *
 * Matches the web contact editor's multi-value row pattern.
 */
@Composable
private fun MultiValueField(
    label: String,
    jsonValue: String,
    itemLabel: String,
    onValueChange: (String) -> Unit,
    defaultLabel: String = "",
    valuePlaceholder: String = "",
    showMapButton: Boolean = false
) {
    val entries = remember(jsonValue) { parseMultiValueEntries(jsonValue) }
    val mapContext = if (showMapButton) LocalContext.current else null

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        entries.forEachIndexed { index, entry ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Label input (e.g., "Home", "Work", "Mobile")
                OutlinedTextField(
                    value = entry.label,
                    onValueChange = { newLabel ->
                        val updated = entries.toMutableList()
                        updated[index] = entry.copy(label = newLabel)
                        onValueChange(serializeMultiValueEntries(updated))
                    },
                    label = { Text("Label") },
                    placeholder = { Text(defaultLabel) },
                    singleLine = true,
                    modifier = Modifier.weight(0.35f)
                )
                // Value input (e.g., phone number, email address)
                OutlinedTextField(
                    value = entry.value,
                    onValueChange = { newValue ->
                        val updated = entries.toMutableList()
                        updated[index] = entry.copy(value = newValue)
                        onValueChange(serializeMultiValueEntries(updated))
                    },
                    label = { Text(itemLabel) },
                    placeholder = { Text(valuePlaceholder) },
                    singleLine = true,
                    modifier = Modifier.weight(0.55f)
                )
                // Open in Maps button (for addresses)
                if (showMapButton && entry.value.isNotBlank() && mapContext != null) {
                    IconButton(
                        onClick = { openAddressInMaps(mapContext, entry.value) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("🗺️", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                // Remove button
                IconButton(
                    onClick = {
                        val updated = entries.toMutableList()
                        updated.removeAt(index)
                        onValueChange(serializeMultiValueEntries(updated))
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
                val updated = entries + MultiValueEntry(label = defaultLabel, value = "")
                onValueChange(serializeMultiValueEntries(updated))
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
 * Data class for a multi-value entry (phone, email, address, call sign, X handle, website).
 * Matches the backend MultiValueEntry model: {label: "Home", value: "555-1234"}
 */
private data class MultiValueEntry(
    val label: String,
    val value: String
)

/**
 * Parses a JSON string of multi-value entries.
 * Handles both formats:
 * - Object array: [{"label": "Home", "value": "555-1234"}, ...]  (correct backend format)
 * - String array: ["555-1234", "555-5678"]  (legacy/fallback)
 * Returns an empty list if the string is blank or not valid JSON.
 */
private fun parseMultiValueEntries(json: String): List<MultiValueEntry> {
    if (json.isBlank()) return emptyList()
    return try {
        // First try parsing as array of objects with label/value keys
        val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
        val list: List<Map<String, Any?>> = Gson().fromJson(json, type) ?: emptyList()
        list.map { map ->
            MultiValueEntry(
                label = (map["label"] as? String) ?: "",
                value = (map["value"] as? String) ?: ""
            )
        }
    } catch (_: Exception) {
        try {
            // Fallback: try parsing as flat string array
            val type = object : TypeToken<List<String>>() {}.type
            val strings: List<String> = Gson().fromJson(json, type) ?: emptyList()
            strings.map { MultiValueEntry(label = "", value = it) }
        } catch (_: Exception) {
            // Last resort: treat the whole string as a single entry
            if (json.isNotBlank()) listOf(MultiValueEntry(label = "", value = json)) else emptyList()
        }
    }
}

/**
 * Serializes a list of MultiValueEntry objects into a JSON string.
 * Uses the backend format: [{"label": "Home", "value": "555-1234"}, ...]
 * Filters out entries where value is blank.
 */
private fun serializeMultiValueEntries(entries: List<MultiValueEntry>): String {
    val filtered = entries.filter { it.value.isNotBlank() }
    if (filtered.isEmpty()) return ""
    val maps = filtered.map { mapOf("label" to it.label, "value" to it.value) }
    return Gson().toJson(maps)
}

/**
 * Counts the number of items in a multi-value JSON string.
 */
private fun countMultiValueItems(json: String): Int {
    return parseMultiValueEntries(json).size
}

/**
 * Data class for a labeled date entry with optional show_on_calendar flag.
 * Matches the backend format: {label: "Birthday", value: "1990-01-15", show_on_calendar: true}
 */
private data class DateEntry(
    val label: String,
    val value: String,
    val showOnCalendar: Boolean = true
)

/**
 * Parses a JSON string of date entries.
 * Expected format: [{"label": "Birthday", "value": "1990-01-15", "show_on_calendar": true}, ...]
 * Also handles legacy format with "date" key instead of "value".
 */
private fun parseDateEntries(json: String): List<DateEntry> {
    if (json.isBlank()) return emptyList()
    return try {
        val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
        val list: List<Map<String, Any?>> = Gson().fromJson(json, type) ?: emptyList()
        list.map { map ->
            DateEntry(
                label = (map["label"] as? String) ?: "",
                // Backend uses "value" key; also handle legacy "date" key
                value = (map["value"] as? String) ?: (map["date"] as? String) ?: "",
                showOnCalendar = (map["show_on_calendar"] as? Boolean) ?: true
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Serializes a list of DateEntry objects into a JSON string.
 * Uses the backend format: [{"label": "Birthday", "value": "1990-01-15", "show_on_calendar": true}, ...]
 * Filters out entries where both label and value are blank.
 */
private fun serializeDateEntries(entries: List<DateEntry>): String {
    val filtered = entries.filter { it.label.isNotBlank() || it.value.isNotBlank() }
    if (filtered.isEmpty()) return ""
    val maps = filtered.map {
        mapOf("label" to it.label, "value" to it.value, "show_on_calendar" to it.showOnCalendar)
    }
    return Gson().toJson(maps)
}

// ─── Password Change Zone (profile mode only) ──────────────────────────────────

/**
 * Password change zone — only shown in profile mode for the user's own profile.
 * Matches the web's "Change Password" zone with current/new/confirm fields.
 */
@Composable
private fun PasswordChangeZone() {
    var isExpanded by remember { mutableStateOf(false) }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()

    EditorZoneHeader(
        title = "🔑 Change Password",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = currentPassword,
                onValueChange = { currentPassword = it },
                label = { Text("Current Password") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation()
            )
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("New Password") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation()
            )
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = { Text("Confirm New Password") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation()
            )

            message?.let { msg ->
                Text(
                    text = msg,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isError) Color(0xFFB22222) else Color(0xFF1B5E20)
                )
            }

            TextButton(onClick = {
                if (currentPassword.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
                    message = "Please fill in all password fields."
                    isError = true
                    return@TextButton
                }
                if (newPassword != confirmPassword) {
                    message = "New passwords do not match."
                    isError = true
                    return@TextButton
                }
                coroutineScope.launch {
                    val result = changePassword(context, currentPassword, newPassword)
                    if (result == null) {
                        message = "Password changed successfully."
                        isError = false
                        currentPassword = ""
                        newPassword = ""
                        confirmPassword = ""
                    } else {
                        message = result
                        isError = true
                    }
                }
            }) {
                Text("🔑 Change Password")
            }
        }
    }
}

/**
 * Calls PUT /api/auth/password to change the user's password.
 * Returns null on success, or an error message string on failure.
 */
private suspend fun changePassword(
    context: android.content.Context,
    currentPassword: String,
    newPassword: String
): String? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    try {
        val prefs = context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)?.trimEnd('/') ?: return@withContext "No server URL"
        val authToken = prefs.getString("auth_token", "") ?: ""

        val json = """{"current_password":"$currentPassword","new_password":"$newPassword"}"""
        val requestBody = json.toRequestBody("application/json".toMediaType())
        val request = okhttp3.Request.Builder()
            .url("$serverUrl/api/auth/password")
            .addHeader("Authorization", "Bearer $authToken")
            .put(requestBody)
            .build()

        val response = okhttp3.OkHttpClient().newCall(request).execute()
        when {
            response.code == 403 -> "Current password is incorrect."
            !response.isSuccessful -> "Failed to change password (${response.code})"
            else -> null
        }
    } catch (e: Exception) {
        "Error: ${e.message}"
    }
}

// ─── Helper Functions (Share, Signal, Maps) ─────────────────────────────────────

/**
 * Share a contact as vCard text via Android share sheet.
 * Mirrors the web's shareContact() → generateContactVCard() → share intent.
 */
private fun shareContactAsVCard(context: android.content.Context, form: ContactFormState) {
    val lines = mutableListOf<String>()
    lines.add("BEGIN:VCARD")
    lines.add("VERSION:3.0")

    // N property
    val surname = form.surname
    val givenName = form.givenName
    val middleNames = form.middleNames
    val prefix = form.prefix
    val suffix = form.suffix
    lines.add("N:$surname;$givenName;$middleNames;$prefix;$suffix")

    // FN property
    val displayName = listOfNotNull(
        prefix.ifBlank { null },
        givenName.ifBlank { null },
        middleNames.ifBlank { null },
        surname.ifBlank { null },
        suffix.ifBlank { null }
    ).joinToString(" ")
    if (displayName.isNotBlank()) {
        lines.add("FN:$displayName")
    }

    // Multi-value fields
    fun addMulti(prop: String, json: String) {
        val entries = parseMultiValueEntries(json)
        for (entry in entries) {
            if (entry.value.isBlank()) continue
            if (entry.label.isNotBlank()) {
                lines.add("$prop;TYPE=${entry.label}:${entry.value}")
            } else {
                lines.add("$prop:${entry.value}")
            }
        }
    }

    addMulti("TEL", form.phones)
    addMulti("EMAIL", form.emails)

    // Addresses
    val addresses = parseMultiValueEntries(form.addresses)
    for (entry in addresses) {
        if (entry.value.isBlank()) continue
        val adrValue = ";;${entry.value};;;;"
        if (entry.label.isNotBlank()) {
            lines.add("ADR;TYPE=${entry.label}:$adrValue")
        } else {
            lines.add("ADR:$adrValue")
        }
    }

    addMulti("URL", form.websites)
    addMulti("X-CALLSIGN", form.callSigns)
    addMulti("X-XHANDLE", form.xHandles)

    if (form.hasSignal) lines.add("X-SIGNAL:true")
    if (form.pgpKey.isNotBlank()) lines.add("X-PGP-KEY:${form.pgpKey}")
    if (form.favorite) lines.add("X-FAVORITE:true")
    if (form.organization.isNotBlank()) lines.add("ORG:${form.organization}")
    if (form.nickname.isNotBlank()) lines.add("NICKNAME:${form.nickname}")

    val extraNotes = mutableListOf<String>()
    if (form.socialContext.isNotBlank()) extraNotes.add("Social Context: ${form.socialContext}")
    if (form.signalUsername.isNotBlank()) extraNotes.add("Signal: ${form.signalUsername}")
    if (form.color.isNotBlank()) extraNotes.add("Color: ${form.color}")
    if (extraNotes.isNotEmpty()) {
        lines.add("NOTE:${extraNotes.joinToString("\\n")}")
    }

    lines.add("END:VCARD")
    val vcardStr = lines.joinToString("\r\n")

    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "text/vcard"
        putExtra(android.content.Intent.EXTRA_TEXT, vcardStr)
        putExtra(android.content.Intent.EXTRA_SUBJECT, displayName.ifBlank { "Contact" })
    }
    context.startActivity(android.content.Intent.createChooser(intent, "Share Contact"))
}

/**
 * Open Signal to message a contact. Mirrors the web's openSignalMessage().
 * If the value looks like a phone number, uses signal.me/#p/+number.
 * Otherwise treats it as a Signal username and uses signal.me/#u/username.
 */
private fun openSignalMessage(context: android.content.Context, signalValue: String) {
    val val_ = signalValue.trim()
    if (val_.isBlank()) return

    val url = if (val_.matches(Regex("^\\+?[\\d\\s\\-().]+$"))) {
        // Phone number
        val phone = val_.replace(Regex("[\\s\\-().]+"), "")
        val normalized = if (phone.startsWith("+")) phone else "+$phone"
        "https://signal.me/#p/$normalized"
    } else {
        // Username
        val username = if (val_.startsWith("@")) val_.substring(1) else val_
        "https://signal.me/#u/$username"
    }

    try {
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
        context.startActivity(intent)
    } catch (_: Exception) {
        // Signal not installed — open in browser
        val browserIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
        context.startActivity(browserIntent)
    }
}

/**
 * Open an address in the device's maps app.
 * Mirrors the web's "Open in Maps" button behavior.
 */
private fun openAddressInMaps(context: android.content.Context, address: String) {
    if (address.isBlank()) return
    val uri = android.net.Uri.parse("geo:0,0?q=${android.net.Uri.encode(address)}")
    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
    try {
        context.startActivity(intent)
    } catch (_: Exception) {
        // No maps app — fall back to browser with Google Maps
        val browserUri = android.net.Uri.parse("https://www.google.com/maps/search/?api=1&query=${android.net.Uri.encode(address)}")
        val browserIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, browserUri)
        context.startActivity(browserIntent)
    }
}

/**
 * Validates a PGP public key by checking for proper BEGIN/END markers
 * and extracting basic info. Mirrors the web's validatePgpKey() behavior.
 * Full cryptographic validation would require BouncyCastle, but basic
 * structural validation catches most errors.
 */
private fun validatePgpKey(keyText: String): String {
    val trimmed = keyText.trim()
    if (!trimmed.contains("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
        return "❌ Missing BEGIN PGP PUBLIC KEY BLOCK header"
    }
    if (!trimmed.contains("-----END PGP PUBLIC KEY BLOCK-----")) {
        return "❌ Missing END PGP PUBLIC KEY BLOCK header"
    }
    // Extract the base64 content between headers
    val startIdx = trimmed.indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----")
    val endIdx = trimmed.indexOf("-----END PGP PUBLIC KEY BLOCK-----")
    if (startIdx >= endIdx) {
        return "❌ Invalid key structure"
    }
    val body = trimmed.substring(
        startIdx + "-----BEGIN PGP PUBLIC KEY BLOCK-----".length,
        endIdx
    ).trim()
    // Remove any header lines (Version:, Comment:, etc.)
    val lines = body.lines().filter { line ->
        !line.contains(":") && line.isNotBlank() && line != ""
    }
    if (lines.isEmpty()) {
        return "❌ No key data found"
    }
    // Check that the content is valid base64
    val base64Content = lines.joinToString("")
    val validBase64 = base64Content.all { it.isLetterOrDigit() || it == '+' || it == '/' || it == '=' }
    if (!validBase64) {
        return "❌ Invalid base64 encoding"
    }
    val byteCount = (base64Content.length * 3) / 4
    return "✅ Valid PGP key (${byteCount} bytes)"
}

// ─── Contact Address Map Preview ────────────────────────────────────────────────

/**
 * Static inline map preview showing a contact's geocoded address location.
 * Uses osmdroid MapView wrapped in AndroidView with MAPNIK tiles.
 * Touch interactions are disabled — the map is a visual preview only.
 * Tapping the map triggers the onTap callback (to open full maps app).
 *
 * Uses DisposableEffect for proper MapView lifecycle management,
 * matching the pattern from MapScreen.kt.
 *
 * Validates: Requirements 18.1, 18.2, 18.3
 */
@Composable
fun ContactMapPreview(lat: Double, lon: Double, onTap: () -> Unit) {
    val context = LocalContext.current
    var mapViewRef by remember { mutableStateOf<MapView?>(null) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable { onTap() }
    ) {
        AndroidView(
            factory = { ctx ->
                MapView(ctx).apply {
                    // Configure osmdroid
                    Configuration.getInstance().apply {
                        userAgentValue = "CWOC-Android/1.0"
                        osmdroidTileCache = ctx.cacheDir.resolve("osmdroid").also { it.mkdirs() }
                    }

                    // Set tile source and zoom
                    setTileSource(TileSourceFactory.MAPNIK)
                    controller.setZoom(15.0)
                    controller.setCenter(GeoPoint(lat, lon))

                    // Disable all touch interactions (static preview)
                    setMultiTouchControls(false)
                    setBuiltInZoomControls(false)
                    isHorizontalMapRepetitionEnabled = false
                    isVerticalMapRepetitionEnabled = false

                    // Intercept all touch events so the map doesn't respond to gestures
                    setOnTouchListener { _, _ -> true }

                    // Place marker at geocoded coordinates
                    val marker = Marker(this)
                    marker.position = GeoPoint(lat, lon)
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    marker.setOnMarkerClickListener { _, _ -> true } // consume click
                    overlays.add(marker)

                    mapViewRef = this
                }
            },
            update = { view ->
                // Update center and marker if coordinates change
                view.controller.setCenter(GeoPoint(lat, lon))
                view.overlays.removeAll { it is Marker }
                val marker = Marker(view)
                marker.position = GeoPoint(lat, lon)
                marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                marker.setOnMarkerClickListener { _, _ -> true }
                view.overlays.add(marker)
                view.invalidate()
            },
            modifier = Modifier.fillMaxSize()
        )
    }

    // Proper lifecycle management for the MapView
    DisposableEffect(Unit) {
        onDispose {
            mapViewRef?.onDetach()
        }
    }
}
