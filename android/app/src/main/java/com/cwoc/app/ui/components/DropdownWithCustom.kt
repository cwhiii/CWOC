package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Prefix options matching the web contact editor.
 */
val PrefixOptions = listOf("", "Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Rev.", "Hon.")

/**
 * Suffix options matching the web contact editor.
 */
val SuffixOptions = listOf("", "Jr.", "Sr.", "Esq.", "Ph.D.", "M.D.", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")

private const val CUSTOM_OPTION = "__custom__"

/**
 * A dropdown field with predefined options plus a "Custom..." option that reveals a text input.
 * Used for prefix and suffix fields in the contact editor.
 *
 * @param label The field label (e.g. "Prefix", "Suffix")
 * @param value The current value (may be a predefined option or custom text)
 * @param options The list of predefined options (first should be "" for "None")
 * @param onValueChange Callback when the value changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownWithCustom(
    label: String,
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val isCustom = value.isNotBlank() && value !in options
    var showCustomInput by remember(value) { mutableStateOf(isCustom) }

    Column(modifier = modifier.fillMaxWidth()) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = when {
                    showCustomInput -> "Custom..."
                    value.isBlank() -> "— None —"
                    else -> value
                },
                onValueChange = {},
                readOnly = true,
                label = { Text(label) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                // "None" option
                DropdownMenuItem(
                    text = { Text("— None —") },
                    onClick = {
                        expanded = false
                        showCustomInput = false
                        onValueChange("")
                    }
                )

                // Predefined options (skip empty string since we handle it above)
                options.filter { it.isNotBlank() }.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            expanded = false
                            showCustomInput = false
                            onValueChange(option)
                        }
                    )
                }

                // Custom option
                DropdownMenuItem(
                    text = { Text("Custom...") },
                    onClick = {
                        expanded = false
                        showCustomInput = true
                        if (!isCustom) onValueChange("")
                    }
                )
            }
        }

        // Custom text input (shown when "Custom..." is selected)
        if (showCustomInput) {
            OutlinedTextField(
                value = if (isCustom) value else "",
                onValueChange = { onValueChange(it) },
                placeholder = { Text("Custom $label") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                textStyle = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
