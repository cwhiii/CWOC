package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.domain.email.ContrastColor

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentBackground = Color(0xFFFFF8F0)
private val TealBase = Color(0xFF00897B)
private val NeutralChipBackground = Color(0xFFF5EDE4)
private val FavoriteStarColor = Color(0xFFFFC107)

/**
 * A recipient chip field composable for To/CC/BCC email fields.
 *
 * Displays styled recipient chips with contact images, colors, and remove buttons.
 * Provides autocomplete dropdown (max 5 results, favorites first, star indicator).
 * Chipifies input on Enter, comma, or focus loss.
 * Computes contrast-safe text color for chip backgrounds.
 *
 * Validates: Requirements 36.1-36.8, 37.1-37.6
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecipientChipField(
    label: String,
    recipients: List<RecipientChip>,
    autocompleteResults: List<ContactEntity>,
    onQueryChange: (String) -> Unit,
    onAddRecipient: (ContactEntity) -> Unit,
    onRemoveRecipient: (String) -> Unit,
    onChipify: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    var isFocused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    Column(modifier = modifier.fillMaxWidth()) {
        // Label
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = ParchmentBrown,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 4.dp)
        )

        // Chip flow + text input
        Box(modifier = Modifier.fillMaxWidth()) {
            Column {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = ParchmentBackground,
                    tonalElevation = 1.dp
                ) {
                    FlowRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // Render existing chips
                        recipients.forEach { chip ->
                            RecipientChipItem(
                                chip = chip,
                                onRemove = { onRemoveRecipient(chip.email) }
                            )
                        }

                        // Inline text input
                        BasicTextField(
                            value = inputText,
                            onValueChange = { newValue ->
                                // Check for comma — chipify immediately
                                if (newValue.contains(",")) {
                                    val textToChipify = newValue.replace(",", "").trim()
                                    if (textToChipify.isNotBlank()) {
                                        onChipify(textToChipify)
                                    }
                                    inputText = ""
                                    onQueryChange("")
                                } else {
                                    inputText = newValue
                                    onQueryChange(newValue)
                                }
                            },
                            modifier = Modifier
                                .widthIn(min = 100.dp)
                                .height(32.dp)
                                .onFocusChanged { focusState ->
                                    if (isFocused && !focusState.isFocused) {
                                        // Blur — chipify remaining text (Requirement 37.6)
                                        if (inputText.isNotBlank()) {
                                            onChipify(inputText)
                                            inputText = ""
                                            onQueryChange("")
                                        }
                                    }
                                    isFocused = focusState.isFocused
                                },
                            textStyle = TextStyle(
                                fontSize = 14.sp,
                                color = ParchmentBrown
                            ),
                            cursorBrush = SolidColor(ParchmentBrown),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    // Enter key — chipify (Requirement 36.8)
                                    if (inputText.isNotBlank()) {
                                        onChipify(inputText)
                                        inputText = ""
                                        onQueryChange("")
                                    }
                                }
                            ),
                            decorationBox = { innerTextField ->
                                Box(
                                    modifier = Modifier.padding(vertical = 6.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    if (inputText.isEmpty() && recipients.isEmpty()) {
                                        Text(
                                            text = "Add recipients...",
                                            style = TextStyle(
                                                fontSize = 14.sp,
                                                color = ParchmentBrown.copy(alpha = 0.5f)
                                            )
                                        )
                                    }
                                    innerTextField()
                                }
                            }
                        )
                    }
                }

                // Autocomplete dropdown
                DropdownMenu(
                    expanded = autocompleteResults.isNotEmpty() && isFocused,
                    onDismissRequest = { /* Keep open while focused */ },
                    modifier = Modifier.fillMaxWidth(0.9f)
                ) {
                    autocompleteResults.forEach { contact ->
                        AutocompleteResultItem(
                            contact = contact,
                            onSelect = {
                                onAddRecipient(contact)
                                inputText = ""
                                onQueryChange("")
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * A single styled recipient chip.
 *
 * Known contacts: colored background (from contact color or teal), contact image/initial,
 * display name, remove button.
 * Unknown addresses: neutral parchment background, email text, remove button.
 *
 * Validates: Requirements 37.1-37.5
 */
@Composable
private fun RecipientChipItem(
    chip: RecipientChip,
    onRemove: () -> Unit
) {
    val isKnownContact = chip.contactId != null
    val chipBackgroundColor = if (isKnownContact) {
        chip.color?.let { parseChipColor(it) } ?: TealBase
    } else {
        NeutralChipBackground
    }
    val textColor = ContrastColor.forBackground(chipBackgroundColor)

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = chipBackgroundColor,
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier.padding(start = 4.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Small circular avatar or initial
            ChipAvatar(chip = chip, textColor = textColor)

            // Display name or email
            Text(
                text = chip.displayName ?: chip.email,
                style = TextStyle(
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = textColor
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 150.dp)
            )

            // Remove (X) button (Requirement 37.3)
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Remove ${chip.displayName ?: chip.email}",
                modifier = Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .clickable { onRemove() },
                tint = textColor.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * Small circular avatar for a recipient chip.
 * Shows contact image if available, otherwise shows the first letter initial.
 */
@Composable
private fun ChipAvatar(
    chip: RecipientChip,
    textColor: Color
) {
    val avatarSize = 20.dp

    if (chip.imageUrl != null) {
        AsyncImage(
            model = chip.imageUrl,
            contentDescription = "Contact image for ${chip.displayName ?: chip.email}",
            modifier = Modifier
                .size(avatarSize)
                .clip(CircleShape),
            contentScale = ContentScale.Crop
        )
    } else {
        // Initial circle
        val initial = extractInitial(chip.displayName ?: chip.email)
        val initialBgColor = textColor.copy(alpha = 0.2f)

        Box(
            modifier = Modifier
                .size(avatarSize)
                .clip(CircleShape)
                .background(initialBgColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initial,
                style = TextStyle(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )
            )
        }
    }
}

/**
 * A single autocomplete result item in the dropdown.
 * Shows: star indicator (if favorite), display name, and email address.
 *
 * Validates: Requirements 36.3, 36.5
 */
@Composable
private fun AutocompleteResultItem(
    contact: ContactEntity,
    onSelect: () -> Unit
) {
    val displayName = contact.displayName
        ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ")
    val primaryEmail = extractPrimaryEmail(contact)

    DropdownMenuItem(
        text = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Star indicator for favorites (Requirement 36.5)
                if (contact.favorite) {
                    Icon(
                        imageVector = Icons.Filled.Star,
                        contentDescription = "Favorite",
                        modifier = Modifier.size(16.dp),
                        tint = FavoriteStarColor
                    )
                } else {
                    Spacer(modifier = Modifier.width(16.dp))
                }

                // Name + email column
                Column {
                    Text(
                        text = displayName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (primaryEmail != null) {
                        Text(
                            text = primaryEmail,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        },
        onClick = onSelect
    )
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Extracts the first letter initial from a name or email string.
 * Trims whitespace and quotes, returns uppercase first character.
 *
 * Validates: Requirement 1.2 (sender initial extraction)
 */
private fun extractInitial(text: String): String {
    val cleaned = text.trim().trimStart('"', '\'', ' ')
    return if (cleaned.isNotEmpty()) {
        cleaned.first().uppercase()
    } else {
        "?"
    }
}

/**
 * Extracts the primary email address from a ContactEntity.
 * The emails field is stored as a JSON array string.
 */
private fun extractPrimaryEmail(contact: ContactEntity): String? {
    val emailsJson = contact.emails ?: return null
    return try {
        // emails is stored as JSON array: [{"email": "...", "label": "..."}, ...]
        // or simple array: ["email1", "email2"]
        val cleaned = emailsJson.trim()
        if (cleaned.startsWith("[")) {
            // Try parsing as array of objects first
            if (cleaned.contains("\"email\"")) {
                val regex = """"email"\s*:\s*"([^"]+)"""".toRegex()
                regex.find(cleaned)?.groupValues?.get(1)
            } else {
                // Simple string array
                val regex = """"([^"]+)"""".toRegex()
                regex.find(cleaned)?.groupValues?.get(1)
            }
        } else {
            cleaned
        }
    } catch (_: Exception) {
        null
    }
}

/**
 * Parses a hex color string into a Compose Color for chip backgrounds.
 * Supports formats: "#RRGGBB", "#AARRGGBB", "RRGGBB".
 * Returns null if parsing fails.
 */
private fun parseChipColor(hex: String): Color? {
    if (hex.isBlank()) return null
    return try {
        val cleaned = hex.trim().removePrefix("#")
        val colorLong = when (cleaned.length) {
            6 -> (0xFF000000 or cleaned.toLong(16))
            8 -> cleaned.toLong(16)
            else -> return null
        }
        Color(colorLong.toInt())
    } catch (_: Exception) {
        null
    }
}
