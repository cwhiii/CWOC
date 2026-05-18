package com.cwoc.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocButtonBorder
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

/**
 * CWOC-styled button matching the web's `.zone-button` style:
 * - Parchment background (surface color)
 * - Brown border (#5a3f2a)
 * - Brown text (#6b4e31)
 * - Lora font (inherited from theme typography)
 *
 * Use this for zone action buttons, form buttons, and secondary actions.
 * For primary CTA buttons (like "LOG IN"), use the standard Material 3 Button.
 */
@Composable
fun CwocZoneButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        border = BorderStroke(1.dp, if (enabled) CwocButtonBorder else CwocButtonBorder.copy(alpha = 0.4f)),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = CwocZoneHeaderBrown,
            disabledContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
            disabledContentColor = CwocZoneHeaderBrown.copy(alpha = 0.4f)
        ),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
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
