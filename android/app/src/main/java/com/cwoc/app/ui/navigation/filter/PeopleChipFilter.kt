package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Data class representing a person (contact or system user) for the filter.
 */
data class PersonItem(
    val name: String,
    val color: String?,
    val imageUrl: String?,
    val favorite: Boolean,
    val prefix: String?,
    val isSystemUser: Boolean
)

/**
 * People chip filter composable matching the web sidebar's People filter group.
 * Features: search, colored chips with images, favorites first, user/contact distinction.
 */
@Composable
fun PeopleChipFilter(
    people: List<PersonItem>,
    selectedPeople: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }

    // Sort: contacts (favorites first → alphabetical), then users (alphabetical), deduplicate
    val sortedPeople = remember(people) {
        val contacts = people.filter { !it.isSystemUser }
            .sortedWith(compareByDescending<PersonItem> { it.favorite }.thenBy { it.name.lowercase() })
        val users = people.filter { it.isSystemUser }
            .sortedBy { it.name.lowercase() }
        // Deduplicate by name (case-insensitive)
        val seen = mutableSetOf<String>()
        (contacts + users).filter { seen.add(it.name.lowercase()) }
    }

    // Filter by search
    val filteredPeople = remember(sortedPeople, searchQuery) {
        if (searchQuery.isBlank()) sortedPeople
        else sortedPeople.filter { it.name.lowercase().contains(searchQuery.lowercase()) }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        // Search input
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search people...", fontSize = 12.sp, color = FilterBrownText.copy(alpha = 0.5f)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = FilterBrownText),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = FilterBrownBorder,
                unfocusedBorderColor = FilterBrownBorder.copy(alpha = 0.6f),
                focusedContainerColor = FilterParchmentBg,
                unfocusedContainerColor = FilterParchmentBg,
                cursorColor = FilterBrownBorder
            ),
            shape = RoundedCornerShape(3.dp)
        )

        Spacer(modifier = Modifier.height(6.dp))

        // People chips
        when {
            sortedPeople.isEmpty() -> {
                Text(
                    text = "No contacts or users",
                    fontSize = 12.sp,
                    color = FilterBrownText.copy(alpha = 0.5f),
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
            filteredPeople.isEmpty() -> {
                Text(
                    text = "No matches",
                    fontSize = 12.sp,
                    color = FilterBrownText.copy(alpha = 0.5f),
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
            else -> {
                filteredPeople.forEach { person ->
                    val isSelected = person.name in selectedPeople
                    PersonChipRow(
                        person = person,
                        isSelected = isSelected,
                        onClick = {
                            val newSelection = if (isSelected) {
                                selectedPeople - person.name
                            } else {
                                selectedPeople + person.name
                            }
                            onSelectionChanged(newSelection)
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Clear button
        FilterClearButton(
            onClick = onClear,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}

@Composable
private fun PersonChipRow(
    person: PersonItem,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bgColor = parseHexColor(person.color, FilterDefaultChipColor)
    val textColor = if (isLightColor(bgColor)) FilterDarkestBrown else Color.White
    val borderWidth = if (person.isSystemUser) 2.dp else 1.dp
    val borderColor = if (person.isSystemUser) FilterDarkestBrown else bgColor

    val chipAlpha = if (isSelected) 1f else 0.7f

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = bgColor,
        border = if (isSelected) {
            BorderStroke(2.dp, FilterSelectedOutline)
        } else {
            BorderStroke(borderWidth, borderColor)
        },
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .alpha(chipAlpha)
            .clickable { onClick() }
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            // Circular thumbnail (18dp)
            if (person.imageUrl != null) {
                AsyncImage(
                    model = person.imageUrl,
                    contentDescription = person.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                )
            } else {
                // Placeholder
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.1f),
                    modifier = Modifier.size(18.dp)
                ) {
                    Text(
                        text = if (person.isSystemUser) "👤" else "?",
                        fontSize = 9.sp,
                        color = textColor,
                        modifier = Modifier.padding(3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Name (with prefix stripped, favorite star prepended)
            val displayName = buildString {
                if (person.favorite) append("★ ")
                val name = if (person.prefix != null && person.name.startsWith(person.prefix)) {
                    person.name.removePrefix(person.prefix).trim()
                } else {
                    person.name
                }
                append(name)
            }

            Text(
                text = displayName,
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                color = textColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
