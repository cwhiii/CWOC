package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * A single entry in a multi-value field (phone, email, address, etc.)
 */
data class MultiValueEntry(
    val label: String = "",
    val value: String = "",
    val showOnCalendar: Boolean? = null
)

/**
 * Parse a JSON string of multi-value entries into a list.
 * Handles both [{label, value}] format and empty/null strings.
 */
fun parseMultiValueJson(json: String?): List<MultiValueEntry> {
    if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()
    return try {
        val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
        val list: List<Map<String, Any?>> = Gson().fromJson(json, type) ?: emptyList()
        list.map { map ->
            MultiValueEntry(
                label = (map["label"] as? String) ?: "",
                value = (map["value"] as? String) ?: "",
                showOnCalendar = when (val sc = map["show_on_calendar"]) {
                    is Boolean -> sc
                    is Number -> sc.toInt() != 0
                    else -> null
                }
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Serialize a list of multi-value entries back to JSON string.
 * Returns null if the list is empty (matching server convention).
 */
fun serializeMultiValue(entries: List<MultiValueEntry>): String? {
    val nonEmpty = entries.filter { it.value.isNotBlank() }
    if (nonEmpty.isEmpty()) return null
    val maps = nonEmpty.map { entry ->
        buildMap {
            put("label", entry.label.ifBlank { null })
            put("value", entry.value)
            if (entry.showOnCalendar != null) {
                put("show_on_calendar", entry.showOnCalendar)
            }
        }
    }
    return Gson().toJson(maps)
}

/**
 * Extract the first value from a multi-value JSON string.
 * Used for displaying detail lines (first email, first phone, etc.)
 */
fun firstMultiValue(json: String?): String? {
    val entries = parseMultiValueJson(json)
    return entries.firstOrNull()?.value?.takeIf { it.isNotBlank() }
}

/**
 * Reusable composable for a multi-value field section (phones, emails, addresses, etc.)
 * Each row has a label input, value input, remove button, and optional extra actions.
 */
@Composable
fun MultiValueSection(
    title: String,
    icon: ImageVector,
    entries: List<MultiValueEntry>,
    defaultLabel: String,
    valuePlaceholder: String,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit,
    onLabelChange: (Int, String) -> Unit,
    onValueChange: (Int, String) -> Unit,
    modifier: Modifier = Modifier,
    extraActions: @Composable ((Int, MultiValueEntry) -> Unit)? = null
) {
    Column(modifier = modifier.fillMaxWidth()) {
        // Section title
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = title.uppercase(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }

        // Entry rows
        entries.forEachIndexed { index, entry ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Label input (narrow)
                OutlinedTextField(
                    value = entry.label,
                    onValueChange = { onLabelChange(index, it) },
                    modifier = Modifier.width(80.dp),
                    placeholder = { Text(defaultLabel, style = MaterialTheme.typography.bodySmall) },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall
                )

                // Value input (flex)
                OutlinedTextField(
                    value = entry.value,
                    onValueChange = { onValueChange(index, it) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(valuePlaceholder, style = MaterialTheme.typography.bodySmall) },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodySmall
                )

                // Extra actions (map button, link icon, calendar toggle, etc.)
                extraActions?.invoke(index, entry)

                // Remove button
                IconButton(
                    onClick = { onRemove(index) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // Add button
        TextButton(onClick = onAdd) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("Add ${title.replaceFirstChar { it.lowercase() }}")
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}
