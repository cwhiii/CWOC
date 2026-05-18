package com.cwoc.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A reusable collapsible section for the sidebar.
 * Shows a header with expand/collapse arrow (▶/▼) + title.
 * Tapping the header toggles visibility of the body content.
 * Matches the web sidebar's collapsible filter group pattern.
 *
 * @param title The section title text
 * @param initiallyExpanded Whether the section starts expanded (default: false = collapsed)
 * @param headerExtra Optional composable rendered to the right of the title (e.g., Clear/Defaults buttons)
 * @param content The collapsible body content
 */
@Composable
fun CollapsibleSection(
    title: String,
    initiallyExpanded: Boolean = false,
    modifier: Modifier = Modifier,
    headerExtra: @Composable (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    var expanded by rememberSaveable { mutableStateOf(initiallyExpanded) }

    Column(modifier = modifier.fillMaxWidth()) {
        // Header row: arrow + title + optional extra content
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 6.dp)
        ) {
            // Expand/collapse arrow
            Text(
                text = if (expanded) "▼" else "▶",
                fontSize = 10.sp,
                color = Color(0xFF4A3728),
                modifier = Modifier.padding(end = 6.dp)
            )

            // Title
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4A3728),
                modifier = Modifier.weight(1f)
            )

            // Optional extra content (Clear/Defaults buttons)
            if (headerExtra != null) {
                headerExtra()
            }
        }

        // Animated collapsible body
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(modifier = Modifier.padding(start = 4.dp)) {
                content()
            }
        }
    }
}
