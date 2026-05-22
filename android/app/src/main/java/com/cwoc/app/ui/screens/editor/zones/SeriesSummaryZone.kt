package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.recurrence.RecurrenceEngine
import com.cwoc.app.domain.recurrence.RecurrenceException
import com.cwoc.app.domain.recurrence.RecurrenceInstance
import com.cwoc.app.domain.recurrence.RecurrenceRule
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Status of a series instance for display purposes.
 */
private enum class InstanceDisplayStatus {
    COMPLETED,
    BROKEN_OFF,
    UPCOMING
}

/**
 * Renders a scrollable visual summary of all instances in a recurring series.
 * Shows instances from start date up to 30 days in the future, max 50 instances.
 * Each row displays: status emoji, date formatted as "Mon, Jan 15".
 * Instances are listed in chronological order (oldest first).
 *
 * Does not render if rule.freq is blank or startDate is not available.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * @param rule The recurrence rule
 * @param startDate Series start date
 * @param exceptions List of recurrence exceptions
 */
@Composable
fun SeriesSummaryUI(
    rule: RecurrenceRule,
    startDate: LocalDate,
    exceptions: List<RecurrenceException>
) {
    // Don't render if rule is missing/blank
    if (rule.freq.isBlank()) return

    val engine = remember { RecurrenceEngine() }
    val today = remember { LocalDate.now() }
    val rangeEnd = remember { today.plusDays(30) }

    val instances = remember(rule, startDate, exceptions) {
        engine.expand(
            rule = rule,
            baseStart = LocalDateTime.of(startDate, java.time.LocalTime.MIDNIGHT),
            baseEnd = null,
            rangeStart = startDate,
            rangeEnd = rangeEnd,
            exceptions = exceptions
        ).take(50)
    }

    if (instances.isEmpty()) return

    // Build a set of broken-off dates from exceptions
    val brokenOffDates = remember(exceptions) {
        exceptions.filter { it.brokenOff }.map { it.date }.toSet()
    }

    val dateFormatter = remember {
        DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault())
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp)
    ) {
        items(instances) { instance ->
            val status = when {
                instance.isCompleted -> InstanceDisplayStatus.COMPLETED
                instance.isException && brokenOffDates.contains(instance.date.toString()) ->
                    InstanceDisplayStatus.BROKEN_OFF
                else -> InstanceDisplayStatus.UPCOMING
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp, horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status emoji
                Text(
                    text = statusEmoji(status),
                    style = MaterialTheme.typography.bodyMedium
                )

                Spacer(modifier = Modifier.width(12.dp))

                // Date formatted as "Mon, Jan 15"
                Text(
                    text = instance.date.format(dateFormatter),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

/**
 * Maps an InstanceDisplayStatus to its display emoji.
 */
private fun statusEmoji(status: InstanceDisplayStatus): String {
    return when (status) {
        InstanceDisplayStatus.COMPLETED -> "✅"
        InstanceDisplayStatus.BROKEN_OFF -> "✂️"
        InstanceDisplayStatus.UPCOMING -> "⬜"
    }
}
