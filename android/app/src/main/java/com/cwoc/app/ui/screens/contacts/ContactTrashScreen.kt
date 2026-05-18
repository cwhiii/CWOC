package com.cwoc.app.ui.screens.contacts

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.ui.components.firstMultiValue
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Contact Trash screen — lists soft-deleted contacts with restore and permanent delete.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactTrashScreen(
    onNavigateBack: () -> Unit,
    viewModel: ContactTrashViewModel = hiltViewModel()
) {
    val trashContacts by viewModel.trashContacts.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    var showPurgeConfirm by remember { mutableStateOf<String?>(null) } // single contact ID
    var showBulkPurgeConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.message) {
        uiState.message?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("🗑️ Deleted Contacts") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    if (uiState.selectedIds.isNotEmpty()) {
                        // Bulk restore
                        IconButton(onClick = { viewModel.bulkRestore() }) {
                            Icon(Icons.Default.RestoreFromTrash, "Restore Selected", tint = Color(0xFF2E7D32))
                        }
                        // Bulk delete
                        IconButton(onClick = { showBulkPurgeConfirm = true }) {
                            Icon(Icons.Default.Delete, "Delete Selected", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Count + select all
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = viewModel.isAllSelected(trashContacts),
                    onCheckedChange = { viewModel.toggleSelectAll(trashContacts) }
                )
                Text(
                    text = "${trashContacts.size} deleted contact${if (trashContacts.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (uiState.selectedIds.isNotEmpty()) {
                    Text(
                        text = " · ${uiState.selectedIds.size} selected",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (trashContacts.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("No deleted contacts.", color = Color(0xFF8B7355))
                }
            } else {
                LazyColumn {
                    items(trashContacts, key = { it.id }) { contact ->
                        TrashContactRow(
                            contact = contact,
                            isSelected = viewModel.isSelected(contact.id),
                            onToggleSelect = { viewModel.toggleSelection(contact.id) },
                            onRestore = { viewModel.restoreContact(contact.id) },
                            onDelete = { showPurgeConfirm = contact.id }
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    // Single purge confirm
    showPurgeConfirm?.let { contactId ->
        AlertDialog(
            onDismissRequest = { showPurgeConfirm = null },
            title = { Text("Permanently Delete") },
            text = { Text("This contact will be permanently deleted. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.purgeContact(contactId)
                    showPurgeConfirm = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showPurgeConfirm = null }) { Text("Cancel") }
            }
        )
    }

    // Bulk purge confirm
    if (showBulkPurgeConfirm) {
        AlertDialog(
            onDismissRequest = { showBulkPurgeConfirm = false },
            title = { Text("Permanently Delete ${uiState.selectedIds.size} Contact(s)") },
            text = { Text("These contacts will be permanently deleted. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.bulkPurge()
                    showBulkPurgeConfirm = false
                }) { Text("Delete All", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showBulkPurgeConfirm = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun TrashContactRow(
    contact: ContactEntity,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggleSelect() }
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })

        Column(modifier = Modifier.weight(1f).padding(horizontal = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = contact.displayName ?: contact.givenName.ifBlank { "(Unnamed)" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (contact.sharedToVault) {
                    Text(" 🏛️", style = MaterialTheme.typography.bodySmall)
                }
            }
            val details = buildList {
                contact.organization?.takeIf { it.isNotBlank() }?.let { add(it) }
                firstMultiValue(contact.emails)?.let { add(it) }
                firstMultiValue(contact.phones)?.let { add(it) }
            }
            if (details.isNotEmpty()) {
                Text(
                    text = details.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            // Deleted timestamp
            contact.deletedDatetime?.let { dt ->
                Text(
                    text = "Deleted: ${formatTrashDate(dt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Restore button
        IconButton(onClick = onRestore) {
            Icon(Icons.Default.RestoreFromTrash, "Restore", tint = Color(0xFF2E7D32))
        }
        // Delete button
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.error)
        }
    }
}

private fun formatTrashDate(iso: String): String {
    return try {
        val instant = Instant.parse(iso)
        val zdt = instant.atZone(ZoneId.systemDefault())
        val formatter = DateTimeFormatter.ofPattern("MMM-dd HH:mm")
        zdt.format(formatter)
    } catch (_: Exception) {
        iso.take(16)
    }
}
