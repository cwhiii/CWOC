package com.cwoc.app.ui.screens.map

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import com.cwoc.app.ui.theme.CwocInputDefaults

private val ParchmentBrown = Color(0xFF6B4E31)

/**
 * People filter panel for the MapScreen.
 * Displays a text search input (with 300ms debounce), favorites-only toggle,
 * tag filter chips (from all contact tags), and a "Clear Filters" button.
 *
 * Visible only when MapScreen is in People or Both display mode.
 */
@Composable
fun PeopleFilterPanel(
    searchText: String,
    favoritesOnly: Boolean,
    selectedTags: Set<String>,
    allTags: List<String>,
    onSearchTextChanged: (String) -> Unit,
    onFavoritesToggled: (Boolean) -> Unit,
    onTagToggled: (String) -> Unit,
    onClearFilters: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Local text state for debounce — the actual filter callback fires after 300ms
    var localSearchText by remember { mutableStateOf(searchText) }

    // Sync external changes back to local state
    LaunchedEffect(searchText) {
        if (searchText != localSearchText) {
            localSearchText = searchText
        }
    }

    // Debounce: emit search text changes after 300ms of inactivity
    LaunchedEffect(localSearchText) {
        if (localSearchText != searchText) {
            delay(300L)
            onSearchTextChanged(localSearchText)
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp)
    ) {
        // ─── Search Input + Favorites Toggle ────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Text search input
            OutlinedTextField(
                value = localSearchText,
                onValueChange = { localSearchText = it },
                placeholder = { Text("Filter people…", style = MaterialTheme.typography.bodySmall) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodySmall,
                trailingIcon = {
                    if (localSearchText.isNotBlank()) {
                        IconButton(onClick = {
                            localSearchText = ""
                            onSearchTextChanged("")
                        }) {
                            Icon(Icons.Default.Clear, "Clear search", modifier = Modifier.size(18.dp))
                        }
                    }
                },
                colors = CwocInputDefaults.outlinedColors()
            )

            // Favorites-only toggle chip
            FilterChip(
                selected = favoritesOnly,
                onClick = { onFavoritesToggled(!favoritesOnly) },
                label = { Text("★", style = MaterialTheme.typography.labelMedium) },
                leadingIcon = {
                    Icon(
                        imageVector = if (favoritesOnly) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = if (favoritesOnly) "Favorites active" else "Show favorites only",
                        modifier = Modifier.size(16.dp)
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ParchmentBrown,
                    selectedLabelColor = Color.White,
                    selectedLeadingIconColor = Color.White
                )
            )
        }

        // ─── Tag Filter Chips ───────────────────────────────────────────────
        if (allTags.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                allTags.forEach { tag ->
                    FilterChip(
                        selected = tag in selectedTags,
                        onClick = { onTagToggled(tag) },
                        label = { Text(tag, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ParchmentBrown,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }
        }

        // ─── Clear Filters Button ───────────────────────────────────────────
        val hasActiveFilters = searchText.isNotBlank() || favoritesOnly || selectedTags.isNotEmpty()
        if (hasActiveFilters) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onClearFilters) {
                    Text("Clear Filters", style = MaterialTheme.typography.labelSmall, color = ParchmentBrown)
                }
            }
        }
    }
}
