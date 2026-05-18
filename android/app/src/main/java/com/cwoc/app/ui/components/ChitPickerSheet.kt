package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * BB2: Reusable chit picker modal bottom sheet.
 * Shows a searchable list of chits by title for selection.
 *
 * Used by:
 * - Projects zone (N1): pick existing chit to add as child
 * - Checklist zone (K2/K3): pick destination chit for item transfer
 * - Notes zone (J5): [[ ]] chit link autocomplete
 *
 * @param chits List of (id, title) pairs to display
 * @param onChitSelected Callback with the selected chit ID
 * @param onDismiss Callback when the sheet is dismissed
 * @param title Header title for the picker
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChitPickerSheet(
    chits: List<Pair<String, String>>,
    onChitSelected: (String) -> Unit,
    onDismiss: () -> Unit,
    title: String = "Select Chit"
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var searchQuery by remember { mutableStateOf("") }

    val filteredChits = remember(chits, searchQuery) {
        if (searchQuery.isBlank()) chits
        else chits.filter { (_, chitTitle) ->
            chitTitle.contains(searchQuery, ignoreCase = true)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Search field
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search by title…") },
                singleLine = true
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Results list
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
            ) {
                items(filteredChits) { (chitId, chitTitle) ->
                    Text(
                        text = chitTitle,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onChitSelected(chitId)
                                onDismiss()
                            }
                            .padding(vertical = 12.dp, horizontal = 4.dp)
                    )
                    HorizontalDivider()
                }

                if (filteredChits.isEmpty()) {
                    item {
                        Text(
                            text = if (searchQuery.isBlank()) "No chits available" else "No matches",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
