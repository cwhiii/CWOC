package com.cwoc.app.ui.screens.contacts

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.filled.ViewModule
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ContactEntity
import java.io.File

/**
 * Contact List screen — displays all contacts with search, alphabetical index,
 * grouped/ungrouped toggle, and import/export functionality.
 */
@Composable
fun ContactListScreen(
    onNavigateToContact: (String) -> Unit,
    onNavigateToTrash: () -> Unit = {},
    onNavigateToProfile: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: ContactListViewModel = hiltViewModel()
) {
    val contacts by viewModel.contacts.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isGrouped by viewModel.isGrouped.collectAsState()
    val groupedContacts by viewModel.groupedContacts.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()
    val sectionIndex = remember(contacts) { viewModel.computeSectionIndex(contacts) }
    var showOverflowMenu by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // File picker launchers for import
    val vcardPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.importVcard(it) }
    }

    val csvPickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.importCsv(it) }
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            // Search input with grouped toggle and overflow menu
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Search contacts...") },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Search")
                    },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF6B4E31),
                        cursorColor = Color(0xFF6B4E31)
                    )
                )

                // Grouped/Ungrouped toggle button
                IconButton(onClick = { viewModel.toggleGroupedMode() }) {
                    Icon(
                        imageVector = if (isGrouped) Icons.Default.ViewModule else Icons.Default.ViewList,
                        contentDescription = if (isGrouped) "Switch to ungrouped" else "Switch to grouped",
                        tint = Color(0xFF6B4E31)
                    )
                }

                Box {
                    IconButton(onClick = { showOverflowMenu = true }) {
                        Icon(
                            Icons.Default.MoreVert,
                            contentDescription = "More options",
                            tint = Color(0xFF6B4E31)
                        )
                    }
                    DropdownMenu(
                        expanded = showOverflowMenu,
                        onDismissRequest = { showOverflowMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Import vCard") },
                            onClick = {
                                showOverflowMenu = false
                                vcardPickerLauncher.launch("text/*")
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Upload, contentDescription = null, tint = Color(0xFF6B4E31))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Import CSV") },
                            onClick = {
                                showOverflowMenu = false
                                csvPickerLauncher.launch("text/*")
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Upload, contentDescription = null, tint = Color(0xFF6B4E31))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Export vCard") },
                            onClick = {
                                showOverflowMenu = false
                                viewModel.exportVcard { data ->
                                    if (data != null) {
                                        shareExportedFile(context, data, "contacts.vcf", "text/vcard")
                                    }
                                }
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Download, contentDescription = null, tint = Color(0xFF6B4E31))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Export CSV") },
                            onClick = {
                                showOverflowMenu = false
                                viewModel.exportCsv { data ->
                                    if (data != null) {
                                        shareExportedFile(context, data, "contacts.csv", "text/csv")
                                    }
                                }
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Download, contentDescription = null, tint = Color(0xFF6B4E31))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("View Deleted") },
                            onClick = {
                                showOverflowMenu = false
                                onNavigateToTrash()
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFF6B4E31))
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Mode indicator chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = isGrouped,
                    onClick = { if (!isGrouped) viewModel.toggleGroupedMode() },
                    label = { Text("Grouped") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFF6B4E31),
                        selectedLabelColor = Color.White
                    )
                )
                FilterChip(
                    selected = !isGrouped,
                    onClick = { if (isGrouped) viewModel.toggleGroupedMode() },
                    label = { Text("Ungrouped") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFF6B4E31),
                        selectedLabelColor = Color.White
                    )
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (contacts.isEmpty() && !isGrouped) {
                EmptyContactsState(hasQuery = searchQuery.isNotBlank())
            } else if (isGrouped) {
                // Grouped mode
                GroupedContactList(
                    grouped = groupedContacts,
                    onContactTap = { onNavigateToContact(it) },
                    onUserTap = { userId -> onNavigateToProfile(userId) }
                )
            } else {
                // Ungrouped mode — flat alphabetical list
                LazyColumn {
                    itemsIndexed(contacts, key = { _, c -> c.id }) { index, contact ->
                        // Section header
                        val letter = (contact.givenName.firstOrNull()
                            ?: contact.surname?.firstOrNull() ?: '#').uppercaseChar()
                        if (sectionIndex[letter] == index) {
                            SectionHeader(letter = letter)
                        }

                        ContactRow(
                            contact = contact,
                            onTap = { onNavigateToContact(contact.id) }
                        )
                    }
                }
            }
        }

        // New Contact FAB
        FloatingActionButton(
            onClick = { onNavigateToContact("new") },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            containerColor = Color(0xFF6B4E31),
            contentColor = Color.White
        ) {
            Icon(Icons.Default.Add, contentDescription = "New Contact")
        }
    }
}

// ─── Grouped Contact List ───────────────────────────────────────────────────────

@Composable
private fun GroupedContactList(
    grouped: GroupedContacts,
    onContactTap: (String) -> Unit,
    onUserTap: (String) -> Unit
) {
    var favoritesExpanded by remember { mutableStateOf(true) }
    var usersExpanded by remember { mutableStateOf(true) }
    var allContactsExpanded by remember { mutableStateOf(true) }
    var vaultExpanded by remember { mutableStateOf(true) }

    LazyColumn {
        // ─── Favorites Section ──────────────────────────────────────────
        item {
            GroupSectionHeader(
                title = "Favorites",
                count = grouped.favorites.size,
                isExpanded = favoritesExpanded,
                onToggle = { favoritesExpanded = !favoritesExpanded },
                icon = Icons.Default.Favorite
            )
        }
        if (favoritesExpanded) {
            itemsIndexed(grouped.favorites, key = { _, c -> "fav_${c.id}" }) { _, contact ->
                ContactRow(contact = contact, onTap = { onContactTap(contact.id) })
            }
            if (grouped.favorites.isEmpty()) {
                item {
                    Text(
                        text = "No favorites yet",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp)
                    )
                }
            }
        }

        // ─── Users Section ──────────────────────────────────────────────
        item {
            GroupSectionHeader(
                title = "Users",
                count = grouped.users.size,
                isExpanded = usersExpanded,
                onToggle = { usersExpanded = !usersExpanded },
                icon = Icons.Default.Person
            )
        }
        if (usersExpanded) {
            itemsIndexed(grouped.users, key = { _, u -> "user_${u.id}" }) { _, user ->
                UserRow(user = user, onTap = { onUserTap(user.id) })
            }
            if (grouped.users.isEmpty()) {
                item {
                    Text(
                        text = "No other users",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp)
                    )
                }
            }
        }

        // ─── All Contacts Section ───────────────────────────────────────
        item {
            GroupSectionHeader(
                title = "All Contacts",
                count = grouped.allContacts.size,
                isExpanded = allContactsExpanded,
                onToggle = { allContactsExpanded = !allContactsExpanded }
            )
        }
        if (allContactsExpanded) {
            itemsIndexed(grouped.allContacts, key = { _, c -> "all_${c.id}" }) { _, contact ->
                ContactRow(contact = contact, onTap = { onContactTap(contact.id) })
            }
            if (grouped.allContacts.isEmpty()) {
                item {
                    Text(
                        text = "No contacts",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp)
                    )
                }
            }
        }

        // ─── Vault Contacts Section ─────────────────────────────────────
        item {
            GroupSectionHeader(
                title = "Vault Contacts",
                count = grouped.vaultContacts.size,
                isExpanded = vaultExpanded,
                onToggle = { vaultExpanded = !vaultExpanded }
            )
        }
        if (vaultExpanded) {
            itemsIndexed(grouped.vaultContacts, key = { _, c -> "vault_${c.id}" }) { _, contact ->
                ContactRow(contact = contact, onTap = { onContactTap(contact.id) })
            }
            if (grouped.vaultContacts.isEmpty()) {
                item {
                    Text(
                        text = "No vault contacts",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp, bottom = 8.dp)
                    )
                }
            }
        }
    }
}

// ─── Group Section Header ───────────────────────────────────────────────────────

@Composable
private fun GroupSectionHeader(
    title: String,
    count: Int,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle() }
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = Color(0xFF6B4E31)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = Color(0xFF6B4E31),
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f)
        )

        Text(
            text = "$count",
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF8B7355),
            modifier = Modifier.padding(end = 4.dp)
        )

        Icon(
            imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
            contentDescription = if (isExpanded) "Collapse" else "Expand",
            tint = Color(0xFF6B4E31),
            modifier = Modifier.size(20.dp)
        )
    }
}

// ─── User Row ───────────────────────────────────────────────────────────────────

@Composable
private fun UserRow(
    user: SwitchableUser,
    onTap: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clickable { onTap() },
        colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape),
                tint = Color(0xFF2196F3)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = user.displayName ?: user.username,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF1A1208),
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                user.email?.let { email ->
                    Text(
                        text = email,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

// ─── Alphabetical Section Header ────────────────────────────────────────────────

@Composable
private fun SectionHeader(letter: Char) {
    Text(
        text = letter.toString(),
        style = MaterialTheme.typography.titleSmall,
        color = Color(0xFF6B4E31),
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(vertical = 4.dp, horizontal = 4.dp)
    )
}

// ─── Contact Row ────────────────────────────────────────────────────────────────

@Composable
private fun ContactRow(
    contact: ContactEntity,
    onTap: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clickable { onTap() },
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5E6D3))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar placeholder
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape),
                tint = Color(0xFF6B4E31)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                val displayName = contact.displayName
                    ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
                Text(
                    text = displayName.ifBlank { "Unnamed" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF1A1208),
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Show email or phone if available
                val subtitle = contact.emails?.takeIf { it.isNotBlank() && it != "[]" }
                    ?: contact.phones?.takeIf { it.isNotBlank() && it != "[]" }
                subtitle?.let {
                    Text(
                        text = it.removeSurrounding("[\"", "\"]").split("\",\"").firstOrNull() ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B7355),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Favorite indicator
            if (contact.favorite) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = "Favorite",
                    modifier = Modifier.size(16.dp),
                    tint = Color(0xFFE91E63)
                )
            }
        }
    }
}

// ─── Empty State ────────────────────────────────────────────────────────────────

@Composable
private fun EmptyContactsState(hasQuery: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = if (hasQuery) "No contacts found" else "No contacts yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (hasQuery) "Try a different search term."
            else "Contacts will appear here after syncing.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}

// ─── Helper: Share exported file ────────────────────────────────────────────────

private fun shareExportedFile(
    context: android.content.Context,
    data: ByteArray,
    fileName: String,
    mimeType: String
) {
    try {
        val cacheDir = File(context.cacheDir, "exports")
        cacheDir.mkdirs()
        val file = File(cacheDir, fileName)
        file.writeBytes(data)

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Export $fileName"))
    } catch (e: Exception) {
        android.util.Log.e("CWOC_CONTACTS", "Failed to share exported file: ${e.message}")
    }
}
