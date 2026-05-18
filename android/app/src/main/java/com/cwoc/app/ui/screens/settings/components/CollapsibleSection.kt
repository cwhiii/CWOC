package com.cwoc.app.ui.screens.settings.components

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocOnBackground

private const val PREFS_NAME = "cwoc_settings_sections"
private const val KEY_PREFIX = "settings_section_"

/**
 * A collapsible section composable for the Settings screen.
 *
 * Renders a header row with title text and an animated chevron icon
 * (▼ when expanded, ▶ when collapsed). Tapping the header or chevron
 * toggles content visibility. Expanded/collapsed state is persisted to
 * SharedPreferences keyed as "settings_section_$sectionId", so the state
 * survives app restarts.
 *
 * @param title The section title text displayed in the header
 * @param sectionId Unique key for SharedPreferences persistence
 * @param defaultExpanded Whether the section is expanded on first use (default: true)
 * @param content The collapsible body content
 */
@Composable
fun CollapsibleSection(
    title: String,
    sectionId: String,
    defaultExpanded: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Read persisted state, defaulting to defaultExpanded if no saved value exists
    var expanded by remember {
        val key = "$KEY_PREFIX$sectionId"
        val savedState = if (prefs.contains(key)) {
            prefs.getBoolean(key, defaultExpanded)
        } else {
            defaultExpanded
        }
        mutableStateOf(savedState)
    }

    // Animate chevron rotation: 0° = collapsed (▶), -90° = expanded (▼)
    val chevronRotation by animateFloatAsState(
        targetValue = if (expanded) 90f else 0f,
        animationSpec = tween(durationMillis = 200),
        label = "chevronRotation"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        // Header row: title + animated chevron
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    expanded = !expanded
                    // Persist the new state
                    prefs.edit().putBoolean("$KEY_PREFIX$sectionId", expanded).apply()
                }
                .padding(vertical = 10.dp)
        ) {
            // Section title
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = CwocOnBackground,
                modifier = Modifier.weight(1f)
            )

            // Animated chevron icon using rotation on ▶ character
            Text(
                text = "▶",
                fontSize = 12.sp,
                color = CwocOnBackground,
                modifier = Modifier
                    .padding(start = 8.dp)
                    .rotate(chevronRotation)
            )
        }

        // Animated collapsible body
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(animationSpec = tween(durationMillis = 200)),
            exit = shrinkVertically(animationSpec = tween(durationMillis = 200))
        ) {
            Column(modifier = Modifier.padding(bottom = 8.dp)) {
                content()
            }
        }
    }
}
