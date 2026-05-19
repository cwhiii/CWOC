package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * A multi-select checkbox group with "— Any" mutual exclusion.
 * When "— Any" is checked (selectedOptions is empty), all specific options are unchecked.
 * When any specific option is checked, "— Any" unchecks.
 * When the last specific option is unchecked, "— Any" re-checks automatically.
 * "— Any" cannot be directly unchecked by tapping it when already checked.
 *
 * Matches the web sidebar's Status and Priority filter groups.
 */
@Composable
fun AnyToggleCheckboxGroup(
    options: List<String>,
    selectedOptions: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        // "— Any" checkbox: checked when no specific options are selected
        val isAnyChecked = selectedOptions.isEmpty()

        ParchmentCheckbox(
            checked = isAnyChecked,
            onCheckedChange = { checked ->
                // Only respond when checking "— Any" (unchecking is a no-op)
                if (checked) {
                    onSelectionChanged(emptySet())
                }
                // If already checked and user taps, do nothing
            },
            label = "— Any"
        )

        // Specific option checkboxes
        options.forEach { option ->
            val isSelected = option in selectedOptions

            ParchmentCheckbox(
                checked = isSelected,
                onCheckedChange = { checked ->
                    val newSelection = if (checked) {
                        selectedOptions + option
                    } else {
                        val removed = selectedOptions - option
                        // If removing the last one, revert to empty (= "Any")
                        removed
                    }
                    onSelectionChanged(newSelection)
                },
                label = option
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Clear button
        FilterClearButton(
            onClick = onClear,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}
