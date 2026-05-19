package com.cwoc.app.ui.screens.contacts

import android.content.Intent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.filled.ViewModule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.remote.SwitchableUserDto
import com.cwoc.app.ui.components.PeopleSectionHeader
import com.cwoc.app.ui.components.ContactQrCodeDialog
import com.cwoc.app.ui.components.firstMultiValue
import com.cwoc.app.ui.theme.ColorUtils
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

/**
 * People Page — Contact Rolodex list with toolbar, search, grouped/ungrouped modes,
 * import/export, and properly rendered contact rows with images and parsed data.
 */
@Composable
fun ContactListScreen(
    onNavigateToContact: (String) -> Unit,
    onNavigateToTrash: () -> Unit = {},
    onNavigateToProfile: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: ContactListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val contacts by viewModel.contacts.collectAsState()
    val context = LocalContext.current

    // File picker for import
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.importFile(it) }
    }

    // Export dropdown state
    var showExportMenu by remember { mutableStateOf(false) }

    // QR code dialog state
    var qrContact by remember { mutableStateOf<ContactEntity?>(null) }

    // Handle messages
    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearError()
        }
    }
    LaunchedEffect(uiState.exportSuccess) {
        uiState.exportSuccess?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearExportSuccess()
        }
    }

    // Server URL for image loading
    val serverUrl = remember {
        context.getSharedPreferences("cwoc_secure_prefs", android.content.Context.MODE_PRIVATE)
            .getString("server_url", "") ?: ""
    }

    Column(modifier = modifier.fillMaxSize()) {
        // ─── Toolbar ────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // New Contact
            IconButton(onClick = { onNavigateToContact("new") }) {
                Icon(Icons.Default.Add, "New Contact", tint = CwocZoneHeaderBrown)
            }
            // Import
            IconButton(onClick = { importLauncher.launch("*/*") }) {
                if (uiState.isImporting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.FileUpload, "Import", tint = CwocZoneHeaderBrown)
                }
            }
            // Export
            Box {
                IconButton(onClick = { showExportMenu = true }) {
                    Icon(Icons.Default.FileDownload, "Export", tint = CwocZoneHeaderBrown)
                }
                DropdownMenu(expanded = showExportMenu, onDismissRequest = { showExportMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Export as .vcf (vCard)") },
                        onClick = { showExportMenu = false; viewModel.exportContacts("vcf") }
                    )
                    DropdownMenuItem(
                        text = { Text("Export as .csv") },
                        onClick = { showExportMenu = false; viewModel.exportContacts("csv") }
                    )
                }
            }
            // Group/Ungroup toggle
            IconButton(onClick = { viewModel.toggleGroupedMode() }) {
                Icon(
                    if (uiState.isGrouped) Icons.Default.ViewModule else Icons.Default.ViewList,
                    if (uiState.isGrouped) "Ungroup" else "Group",
                    tint = CwocZoneHeaderBrown
                )
            }
            // Trash
            IconButton(onClick = { onNavigateToTrash() }) {
                Icon(Icons.Default.Delete, "Trash", tint = CwocZoneHeaderBrown)
            }
        }

        // ─── Search ─────────────────────────────────────────────────────────
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = { viewModel.updateSearchQuery(it) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            placeholder = { Text("🔍 Search contacts...") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF008080),
                unfocusedContainerColor = Color(0xFFF5E6CC)
            )
        )

        Spacer(modifier = Modifier.height(8.dp))

        // ─── Contact List ───────────────────────────────────────────────────
        if (contacts.isEmpty() && uiState.users.isEmpty()) {
            // Empty state
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = if (uiState.searchQuery.isNotBlank()) "No contacts match your search."
                    else "No contacts yet. Tap '+' to add one.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFF8B7355)
                )
            }
        } else if (uiState.isGrouped) {
            // Grouped mode
            GroupedContactList(
                uiState = uiState,
                contacts = contacts,
                serverUrl = serverUrl,
                onContactTap = { onNavigateToContact(it) },
                onUserTap = { onNavigateToProfile(it) },
                onToggleFavorite = { viewModel.toggleFavorite(it) },
                onToggleUserFavorite = { viewModel.toggleUserFavorite(it) },
                onToggleSection = { viewModel.toggleSection(it) },
                isSectionCollapsed = { viewModel.isSectionCollapsed(it) },
                isUserFavorite = { viewModel.isUserFavorite(it) },
                onShareQr = { qrContact = it }
            )
        } else {
            // Ungrouped flat list
            LazyColumn {
                items(contacts, key = { it.id }) { contact ->
                    ContactRow(
                        contact = contact,
                        serverUrl = serverUrl,
                        onTap = { onNavigateToContact(contact.id) },
                        onToggleFavorite = { viewModel.toggleFavorite(contact.id) },
                        onShareQr = { qrContact = contact }
                    )
                }
            }
        }
    }

    // QR code dialog
    qrContact?.let { contact ->
        ContactQrCodeDialog(
            contact = contact,
            onDismiss = { qrContact = null }
        )
    }

    // Import result dialog
    uiState.importResult?.let { result ->
        AlertDialog(
            onDismissRequest = { viewModel.clearImportResult() },
            title = { Text("📋 Import Results") },
            text = {
                Column {
                    Text("✅ ${result.imported} imported", color = Color(0xFF2E7D32))
                    Text("⚠️ ${result.skipped} skipped", color = Color(0xFFF57F17))
                    if (result.errors.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Errors:", fontWeight = FontWeight.Bold)
                        result.errors.take(10).forEach { err ->
                            Text(
                                "Entry ${err.entry ?: "?"}: ${err.reason ?: "Unknown"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.clearImportResult() }) { Text("Close") }
            }
        )
    }
}

// ─── Grouped Contact List ───────────────────────────────────────────────────────

@Composable
private fun GroupedContactList(
    uiState: PeopleUiState,
    contacts: List<ContactEntity>,
    serverUrl: String,
    onContactTap: (String) -> Unit,
    onUserTap: (String) -> Unit,
    onToggleFavorite: (String) -> Unit,
    onToggleUserFavorite: (String) -> Unit,
    onToggleSection: (String) -> Unit,
    isSectionCollapsed: (String) -> Boolean,
    isUserFavorite: (String) -> Boolean,
    onShareQr: (ContactEntity) -> Unit
) {
    LazyColumn {
        // ★ Favorites
        if (uiState.favorites.isNotEmpty()) {
            item(key = "header_favorites") {
                PeopleSectionHeader(
                    label = "★ Favorites",
                    count = uiState.favorites.size,
                    isExpanded = !isSectionCollapsed("favorites"),
                    onToggle = { onToggleSection("favorites") }
                )
            }
            if (!isSectionCollapsed("favorites")) {
                items(uiState.favorites, key = { "fav_${it.id}" }) { contact ->
                    ContactRow(contact, serverUrl, { onContactTap(contact.id) }, { onToggleFavorite(contact.id) }, { onShareQr(contact) })
                }
            }
        }

        // Users
        if (uiState.users.isNotEmpty()) {
            val nonFavUsers = uiState.users.filter { !isUserFavorite(it.id) }
            if (nonFavUsers.isNotEmpty()) {
                item(key = "header_users") {
                    PeopleSectionHeader(
                        label = "Users",
                        count = nonFavUsers.size,
                        isExpanded = !isSectionCollapsed("users"),
                        onToggle = { onToggleSection("users") }
                    )
                }
                if (!isSectionCollapsed("users")) {
                    items(nonFavUsers, key = { "user_${it.id}" }) { user ->
                        UserRow(user, serverUrl, { onUserTap(user.id) }, isUserFavorite(user.id), { onToggleUserFavorite(user.id) })
                    }
                }
            }
        }

        // All Contacts
        if (uiState.allContacts.isNotEmpty()) {
            item(key = "header_all") {
                PeopleSectionHeader(
                    label = "All Contacts",
                    count = uiState.allContacts.size,
                    isExpanded = !isSectionCollapsed("all"),
                    onToggle = { onToggleSection("all") }
                )
            }
            if (!isSectionCollapsed("all")) {
                items(uiState.allContacts, key = { "all_${it.id}" }) { contact ->
                    ContactRow(contact, serverUrl, { onContactTap(contact.id) }, { onToggleFavorite(contact.id) }, { onShareQr(contact) })
                }
            }
        }

        // 🏛️ Contact Vault
        if (uiState.vaultContacts.isNotEmpty()) {
            item(key = "header_vault") {
                PeopleSectionHeader(
                    label = "🏛️ Contact Vault",
                    count = uiState.vaultContacts.size,
                    isExpanded = !isSectionCollapsed("vault"),
                    onToggle = { onToggleSection("vault") }
                )
            }
            if (!isSectionCollapsed("vault")) {
                items(uiState.vaultContacts, key = { "vault_${it.id}" }) { contact ->
                    ContactRow(contact, serverUrl, { onContactTap(contact.id) }, { onToggleFavorite(contact.id) }, { onShareQr(contact) })
                }
            }
        }
    }
}

// ─── Contact Row ────────────────────────────────────────────────────────────────

@Composable
private fun ContactRow(
    contact: ContactEntity,
    serverUrl: String,
    onTap: () -> Unit,
    onToggleFavorite: () -> Unit,
    onShareQr: () -> Unit = {}
) {
    val colorPair = ColorUtils.applyContactRowColors(contact.color)
    val borderColor = ColorUtils.contactBorderColor(contact.color)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (borderColor != null) Modifier.border(
                    width = 3.dp,
                    color = borderColor,
                    shape = RoundedCornerShape(0.dp)
                ) else Modifier
            )
            .background(colorPair?.first ?: Color.Transparent)
            .clickable { onTap() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Star toggle
        Text(
            text = if (contact.favorite) "★" else "☆",
            fontSize = 20.sp,
            color = if (contact.favorite) Color(0xFFE3B23C) else Color(0xFF8B7355),
            modifier = Modifier
                .clickable { onToggleFavorite() }
                .padding(end = 8.dp)
        )

        // Thumbnail
        val imageUrl = contact.imageUrl?.let { url ->
            if (url.startsWith("http")) url else "$serverUrl$url"
        }
        if (imageUrl != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .border(1.dp, Color(0xFF8B5A2B), CircleShape),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF5E6CC))
                    .border(1.dp, Color(0xFFC4A484), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, null, modifier = Modifier.size(18.dp), tint = Color(0xFF8B5A2B))
            }
        }

        Spacer(modifier = Modifier.width(10.dp))

        // Name + detail column
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = contact.displayName ?: contact.givenName.ifBlank { "(unnamed)" },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (contact.favorite) FontWeight.Bold else FontWeight.Normal,
                color = colorPair?.second ?: MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            // Detail line: first email · first phone · org
            val details = buildList {
                firstMultiValue(contact.emails)?.let { add(it) }
                firstMultiValue(contact.phones)?.let { add(it) }
                contact.organization?.takeIf { it.isNotBlank() }?.let { add(it) }
            }
            if (details.isNotEmpty()) {
                Text(
                    text = details.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = (colorPair?.second ?: MaterialTheme.colorScheme.onSurfaceVariant).copy(alpha = 0.8f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        // Vault icon
        if (contact.sharedToVault) {
            Text("🏛️", modifier = Modifier.padding(horizontal = 4.dp))
        }

        // QR share button
        IconButton(onClick = { onShareQr() }, modifier = Modifier.size(32.dp)) {
            Icon(Icons.Default.QrCode, "Share QR", tint = CwocZoneHeaderBrown, modifier = Modifier.size(18.dp))
        }
    }
}

// ─── User Row ───────────────────────────────────────────────────────────────────

@Composable
private fun UserRow(
    user: SwitchableUserDto,
    serverUrl: String,
    onTap: () -> Unit,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Star toggle
        Text(
            text = if (isFavorite) "★" else "☆",
            fontSize = 20.sp,
            color = if (isFavorite) Color(0xFFE3B23C) else Color(0xFF8B7355),
            modifier = Modifier
                .clickable { onToggleFavorite() }
                .padding(end = 8.dp)
        )

        // Thumbnail
        val imageUrl = user.profileImageUrl?.let { url ->
            if (url.startsWith("http")) url else "$serverUrl$url"
        }
        if (imageUrl != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .border(1.dp, Color(0xFF8B5A2B), CircleShape),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFE3F2FD))
                    .border(1.dp, Color(0xFF90CAF9), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, null, modifier = Modifier.size(18.dp), tint = Color(0xFF2196F3))
            }
        }

        Spacer(modifier = Modifier.width(10.dp))

        // Name + username
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = user.displayName ?: user.username,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isFavorite) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "@${user.username}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
