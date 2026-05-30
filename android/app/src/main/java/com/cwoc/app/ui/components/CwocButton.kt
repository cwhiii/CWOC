package com.cwoc.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocAgedBrownLight
import com.cwoc.app.ui.theme.CwocAgedBrownMedium
import com.cwoc.app.ui.theme.CwocBackground
import com.cwoc.app.ui.theme.CwocButtonBorder

/**
 * CWOC-styled button matching the web's `.zone-button` style:
 * - Brown background (#a0522d — aged-brown-light)
 * - Parchment/cream text (#fdf5e6)
 * - Outset border (#8b4513 — aged-brown-medium)
 *
 * Use this for zone action buttons (undo, redo, data, clear, etc.)
 * within editor zones. Matches the web CSS `.zone-button` exactly.
 */
@Composable
fun CwocZoneButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        border = BorderStroke(1.dp, if (enabled) CwocAgedBrownMedium else CwocAgedBrownMedium.copy(alpha = 0.4f)),
        colors = ButtonDefaults.buttonColors(
            containerColor = CwocAgedBrownLight,
            contentColor = CwocBackground,
            disabledContainerColor = CwocAgedBrownLight.copy(alpha = 0.4f),
            disabledContentColor = CwocBackground.copy(alpha = 0.5f)
        ),
        contentPadding = contentPadding,
        content = content
    )
}

/**
 * CWOC-styled primary action button matching the web's filled brown buttons:
 * - Brown background (#8b5a2b)
 * - White text
 * - Slightly darker border (#5a3f2a)
 *
 * Use this for primary actions like "Save", "Create", "Send".
 */
@Composable
fun CwocPrimaryButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
            disabledContentColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f)
        ),
        border = BorderStroke(1.dp, CwocButtonBorder),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        content = content
    )
}
