package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.filter.FilterState

/**
 * Display toggle checkboxes matching the web sidebar's Display filter group.
 * Three groups separated by dashed lines. Each checkbox immediately updates FilterState.
 */
@Composable
fun DisplayToggleCheckboxes(
    filterState: FilterState,
    onFilterStateChanged: (FilterState) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        // Group 1: Pin/Archive state
        ParchmentCheckbox(
            checked = filterState.showPinned,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showPinned = it)) },
            label = "📌 Pinned"
        )
        ParchmentCheckbox(
            checked = filterState.showArchived,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showArchived = it)) },
            label = "📦 Archived"
        )
        ParchmentCheckbox(
            checked = filterState.showSnoozed,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showSnoozed = it)) },
            label = "😴 Snoozed"
        )
        ParchmentCheckbox(
            checked = filterState.showUnmarked,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showUnmarked = it)) },
            label = "📄 Unmarked"
        )

        // Dashed separator
        DashedSeparator()

        // Group 2: Status/type visibility
        ParchmentCheckbox(
            checked = filterState.showPastDue,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showPastDue = it)) },
            label = "⏰ Past-Due"
        )
        ParchmentCheckbox(
            checked = filterState.showComplete,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showComplete = it)) },
            label = "✅ Complete"
        )
        ParchmentCheckbox(
            checked = filterState.showDeclined,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showDeclined = it)) },
            label = "✗ Declined"
        )
        ParchmentCheckbox(
            checked = filterState.showHabits,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showHabits = it)) },
            label = "🎯 Habits"
        )
        ParchmentCheckbox(
            checked = filterState.showEmailReceived,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showEmailReceived = it)) },
            label = "📨 Email (Received)"
        )
        ParchmentCheckbox(
            checked = filterState.showEmailSent,
            onCheckedChange = { onFilterStateChanged(filterState.copy(showEmailSent = it)) },
            label = "📤 Email (Sent)"
        )

        // Dashed separator
        DashedSeparator()

        // Group 3: Sharing
        ParchmentCheckbox(
            checked = filterState.sharedWithMe,
            onCheckedChange = { onFilterStateChanged(filterState.copy(sharedWithMe = it)) },
            label = "🔗 Shared with me"
        )
        ParchmentCheckbox(
            checked = filterState.sharedByMe,
            onCheckedChange = { onFilterStateChanged(filterState.copy(sharedByMe = it)) },
            label = "📤 Shared by me"
        )
    }
}

/**
 * A dashed horizontal separator line matching the web's dashed <hr> style.
 */
@Composable
private fun DashedSeparator() {
    Spacer(modifier = Modifier.height(4.dp))
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .padding(vertical = 0.dp)
    ) {
        val dashEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)
        drawLine(
            color = FilterSeparatorColor,
            start = Offset(0f, 0f),
            end = Offset(size.width, 0f),
            pathEffect = dashEffect,
            strokeWidth = 2f
        )
    }
    Spacer(modifier = Modifier.height(4.dp))
}
