package com.cwoc.app.ui.theme

import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable

/**
 * Shared input field styling defaults for the CWOC parchment theme.
 * Provides consistent colors for OutlinedTextField and ExposedDropdownMenuBox usage.
 */
object CwocInputDefaults {

    @Composable
    fun outlinedColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = CwocTealAccent,
        unfocusedBorderColor = CwocOutsetBorder,
        focusedContainerColor = CwocInputBg,
        unfocusedContainerColor = CwocInputBg
    )

    @Composable
    fun dropdownColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = CwocTealAccent,
        unfocusedBorderColor = CwocOutsetBorder,
        focusedContainerColor = CwocInputBg,
        unfocusedContainerColor = CwocInputBg
    )
}
