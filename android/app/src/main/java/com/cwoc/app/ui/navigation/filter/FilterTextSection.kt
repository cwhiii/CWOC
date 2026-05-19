package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Filter text search input with saved search chips.
 * Debounces text input by 300ms before calling onSearchTextChanged.
 * Saved search chips are shown below in a wrapping layout.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterTextSection(
    searchText: String,
    onSearchTextChanged: (String) -> Unit,
    savedSearches: List<String>,
    onSavedSearchTap: (String) -> Unit,
    onSavedSearchDelete: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var localText by remember(searchText) { mutableStateOf(searchText) }

    // Use rememberUpdatedState so the LaunchedEffect always calls the latest callback
    val currentOnSearchTextChanged by rememberUpdatedState(onSearchTextChanged)

    // Debounce: wait 300ms after last keystroke before propagating
    LaunchedEffect(localText) {
        if (localText != searchText) {
            delay(300)
            currentOnSearchTextChanged(localText)
        }
    }

    // Search text field
    OutlinedTextField(
        value = localText,
        onValueChange = { localText = it },
        placeholder = { Text("Filter Chits...", fontSize = 13.sp, color = FilterBrownText.copy(alpha = 0.5f)) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        textStyle = androidx.compose.ui.text.TextStyle(
            fontSize = 13.sp,
            color = FilterBrownText
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = FilterBrownBorder,
            unfocusedBorderColor = FilterBrownBorder.copy(alpha = 0.6f),
            focusedContainerColor = FilterParchmentBg,
            unfocusedContainerColor = FilterParchmentBg,
            cursorColor = FilterBrownBorder
        ),
        shape = RoundedCornerShape(3.dp)
    )

    // Saved search chips (hidden when empty)
    if (savedSearches.isNotEmpty()) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
        ) {
            savedSearches.forEach { search ->
                SavedSearchChip(
                    text = search,
                    onTap = { onSavedSearchTap(search) },
                    onDelete = { onSavedSearchDelete(search) }
                )
            }
        }
    }
}

@Composable
private fun SavedSearchChip(
    text: String,
    onTap: () -> Unit,
    onDelete: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = FilterParchmentLight,
        border = androidx.compose.foundation.BorderStroke(1.dp, FilterBrownBorder.copy(alpha = 0.3f)),
        modifier = Modifier.clickable { onTap() }
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        ) {
            // Truncate to 15 chars
            val displayText = if (text.length > 15) text.take(15) + "…" else text
            Text(
                text = displayText,
                fontSize = 11.sp,
                color = FilterBrownText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.width(4.dp))
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Remove saved search",
                tint = FilterBrownBorder.copy(alpha = 0.6f),
                modifier = Modifier
                    .size(12.dp)
                    .clickable { onDelete() }
            )
        }
    }
}
