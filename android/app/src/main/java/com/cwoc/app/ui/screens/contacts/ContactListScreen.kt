package com.cwoc.app.ui.screens.contacts

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ContactEntity

/**
 * Contact List screen — displays all contacts with search and alphabetical index.
 */
@Composable
fun ContactListScreen(
    onNavigateToContact: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ContactListViewModel = hiltViewModel()
) {
    val contacts by viewModel.contacts.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val sectionIndex = remember(contacts) { viewModel.computeSectionIndex(contacts) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        // Search input
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { viewModel.updateSearchQuery(it) },
            modifier = Modifier.fillMaxWidth(),
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

        Spacer(modifier = Modifier.height(8.dp))

        if (contacts.isEmpty()) {
            EmptyContactsState(hasQuery = searchQuery.isNotBlank())
        } else {
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
}

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
        }
    }
}

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
