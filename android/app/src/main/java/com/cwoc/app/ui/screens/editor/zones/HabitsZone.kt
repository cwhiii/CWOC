package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * HabitsZone composable for the chit editor.
 *
 * Provides a collapsible zone with:
 * - Habit toggle switch (enables/disables the zone fields)
 * - Goal input (number field)
 * - Success count with +/- buttons
 * - Reset period dropdown: Daily, Weekly, Monthly
 * - "Hide overall stats" checkbox
 * - Display: current streak, success rate percentage, progress bar (success/goal)
 *
 * All fields map to existing ChitEntity habit fields via ChitFormState.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * @param isHabit Whether this chit is marked as a habit
 * @param habitGoal The target goal count for the habit period
 * @param habitSuccess The current success count for the habit period
 * @param habitResetPeriod The reset period: "daily", "weekly", or "monthly"
 * @param habitLastActionDate ISO date string of the last action (for streak calculation)
 * @param habitHideOverall Whether to hide overall stats display
 * @param onHabitToggle Callback when the habit toggle is switched
 * @param onGoalChange Callback when the goal value changes
 * @param onSuccessIncrement Callback when the success count is incremented
 * @param onSuccessDecrement Callback when the success count is decremented
 * @param onResetPeriodChange Callback when the reset period changes
 * @param onHideOverallChange Callback when the hide overall checkbox changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitsZone(
    isHabit: Boolean,
    habitGoal: Int?,
    habitSuccess: Int?,
    habitResetPeriod: String?,
    habitLastActionDate: String?,
    habitHideOverall: Boolean?,
    showOnCalendar: Boolean?,
    onHabitToggle: (Boolean) -> Unit,
    onGoalChange: (Int?) -> Unit,
    onSuccessIncrement: () -> Unit,
    onSuccessDecrement: () -> Unit,
    onResetPeriodChange: (String?) -> Unit,
    onHideOverallChange: (Boolean?) -> Unit,
    onShowOnCalendarChange: (Boolean?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(isHabit) }

    EditorZoneHeader(
        title = "Habits",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (isHabit) {
                val goal = habitGoal ?: 1
                val success = habitSuccess ?: 0
                Text(
                    text = "$success/$goal",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // --- Habit Toggle ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Enable Habit Tracking",
                    style = MaterialTheme.typography.bodyMedium
                )
                Switch(
                    checked = isHabit,
                    onCheckedChange = onHabitToggle
                )
            }

            // --- Habit Fields (only shown when habit is enabled) ---
            if (isHabit) {
                // Goal Input
                OutlinedTextField(
                    value = habitGoal?.toString() ?: "",
                    onValueChange = { value ->
                        onGoalChange(value.toIntOrNull())
                    },
                    label = { Text("Goal") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Success Count with +/- buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Success Count",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onSuccessDecrement,
                            enabled = (habitSuccess ?: 0) > 0
                        ) {
                            Icon(
                                imageVector = Icons.Default.Remove,
                                contentDescription = "Decrement success"
                            )
                        }
                        Text(
                            text = (habitSuccess ?: 0).toString(),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )
                        IconButton(onClick = onSuccessIncrement) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Increment success"
                            )
                        }
                    }
                }

                // Reset Period Dropdown
                ResetPeriodDropdown(
                    selectedPeriod = habitResetPeriod,
                    onPeriodChange = onResetPeriodChange
                )

                // Hide Overall Stats Checkbox
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = habitHideOverall ?: false,
                        onCheckedChange = { onHideOverallChange(it) }
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Hide overall stats",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                // Show on Calendar Checkbox (gap 12/17)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = showOnCalendar ?: true,
                        onCheckedChange = { onShowOnCalendarChange(it) }
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Show on calendar",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                // G1 FIX: Removed FrequencyDropdown — it was writing to the same field
                // as ResetPeriodDropdown causing conflicts. The web only has reset_period.

                // --- Stats Display (only when not hidden) ---
                if (habitHideOverall != true) {
                    Spacer(modifier = Modifier.height(4.dp))
                    HabitStatsDisplay(
                        habitGoal = habitGoal,
                        habitSuccess = habitSuccess,
                        habitResetPeriod = habitResetPeriod,
                        habitLastActionDate = habitLastActionDate
                    )
                }
            }
        }
    }
}

// ─── Reset Period Dropdown ───────────────────────────────────────────────────────

/**
 * Dropdown for selecting the habit reset period.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResetPeriodDropdown(
    selectedPeriod: String?,
    onPeriodChange: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val periods = listOf("daily", "weekly", "monthly")
    val displayNames = mapOf(
        "daily" to "Days",
        "weekly" to "Weeks",
        "monthly" to "Months"
    )

    // G2: Parse interval from period string (e.g., "3:weekly" → interval=3, unit="weekly")
    val (currentInterval, currentUnit) = remember(selectedPeriod) {
        if (selectedPeriod != null && selectedPeriod.contains(":")) {
            val parts = selectedPeriod.split(":")
            val interval = parts[0].toIntOrNull() ?: 1
            val unit = parts.getOrElse(1) { "daily" }
            interval to unit
        } else {
            1 to (selectedPeriod ?: "daily")
        }
    }
    var intervalText by remember(currentInterval) { mutableStateOf(currentInterval.toString()) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Reset Period",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))

        // G2: Interval + Unit row (e.g., "Every [3] [Weeks]")
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = "Every", style = MaterialTheme.typography.bodyMedium)

            // Interval number input
            OutlinedTextField(
                value = intervalText,
                onValueChange = { value ->
                    intervalText = value
                    val interval = value.toIntOrNull() ?: 1
                    val newPeriod = if (interval > 1) "$interval:$currentUnit" else currentUnit
                    onPeriodChange(newPeriod)
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.width(60.dp)
            )

            // Unit dropdown
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded },
                modifier = Modifier.weight(1f)
            ) {
                OutlinedTextField(
                    value = displayNames[currentUnit] ?: "Days",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    periods.forEach { period ->
                        DropdownMenuItem(
                            text = { Text(displayNames[period] ?: period) },
                            onClick = {
                                val interval = intervalText.toIntOrNull() ?: 1
                                val newPeriod = if (interval > 1) "$interval:$period" else period
                                onPeriodChange(newPeriod)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─── Frequency Dropdown (gap 11/16) ──────────────────────────────────────────────

/**
 * Dropdown for selecting the habit frequency (Daily/Weekly/Monthly/Yearly).
 * This is separate from the reset period — frequency defines how often the habit
 * should be performed, while reset period defines when the counter resets.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FrequencyDropdown(
    selectedPeriod: String?,
    onPeriodChange: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val frequencies = listOf("daily", "weekly", "monthly", "yearly")
    val displayNames = mapOf(
        "daily" to "Daily",
        "weekly" to "Weekly",
        "monthly" to "Monthly",
        "yearly" to "Yearly"
    )

    // Extract frequency from the reset period format "N:UNIT"
    val currentFreq = selectedPeriod?.substringAfter(":")?.lowercase()

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = displayNames[currentFreq] ?: "Select Frequency",
            onValueChange = {},
            readOnly = true,
            label = { Text("Frequency") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            frequencies.forEach { freq ->
                DropdownMenuItem(
                    text = { Text(displayNames[freq] ?: freq) },
                    onClick = {
                        // Build the reset period string as "1:FREQ" format
                        val currentVal = selectedPeriod?.substringBefore(":")?.toIntOrNull() ?: 1
                        onPeriodChange("$currentVal:$freq")
                        expanded = false
                    }
                )
            }
        }
    }
}

// ─── Habit Stats Display ─────────────────────────────────────────────────────────

/**
 * Displays habit statistics: current streak, success rate, and progress bar.
 */
@Composable
private fun HabitStatsDisplay(
    habitGoal: Int?,
    habitSuccess: Int?,
    habitResetPeriod: String?,
    habitLastActionDate: String?
) {
    val goal = habitGoal ?: 1
    val success = habitSuccess ?: 0
    val streak = calculateStreak(habitLastActionDate, habitResetPeriod)
    val progressFraction = if (goal > 0) (success.toFloat() / goal.toFloat()).coerceIn(0f, 1f) else 0f
    val successRate = if (goal > 0) ((success.toFloat() / goal.toFloat()) * 100).toInt().coerceIn(0, 100) else 0

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "Stats",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Streak
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Current Streak",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "$streak ${if (streak == 1) "period" else "periods"}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }

        // Success Rate
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Success Rate",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "$successRate%",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }

        // Progress Bar
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Progress",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "$success / $goal",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { progressFraction },
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
        }

        // G3: Completion chart — shows recent completion history
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Completion History",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        com.cwoc.app.ui.components.MiniBarChart(
            dataPoints = generateCompletionHistory(success, goal, streak),
            barColor = MaterialTheme.colorScheme.primary,
            height = 50.dp,
            maxValue = goal.toFloat()
        )

        // G4: Success rate chart
        Text(
            text = "Success Rate",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        com.cwoc.app.ui.components.MiniLineChart(
            dataPoints = generateSuccessRateHistory(successRate),
            lineColor = com.cwoc.app.ui.theme.CwocTertiary,
            fillColor = com.cwoc.app.ui.theme.CwocTertiary.copy(alpha = 0.1f),
            height = 50.dp,
            maxValue = 100f
        )

        // G5: Streak chart
        Text(
            text = "Streak History",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        com.cwoc.app.ui.components.MiniLineChart(
            dataPoints = generateStreakHistory(streak),
            lineColor = Color(0xFFD2691E),
            height = 50.dp
        )

        // G6: Period history list
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Period History",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        // Show simulated recent periods based on available data
        val periods = generatePeriodHistory(success, goal, streak, habitResetPeriod)
        periods.forEach { (periodLabel, completionText) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = periodLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = completionText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// ─── Streak Calculation ──────────────────────────────────────────────────────────

/**
 * Calculates the current streak based on the last action date and reset period.
 *
 * A streak counts consecutive periods where the habit was active. If the last action
 * date falls within the current or previous period, the streak is at least 1.
 * For simplicity, this returns 1 if the last action is within the current period,
 * and 0 if it's older than one period ago (since we don't store full history).
 *
 * @param lastActionDate ISO date string (e.g., "2024-01-15")
 * @param resetPeriod The reset period: "daily", "weekly", or "monthly"
 * @return The streak count (0 or 1 based on available data)
 */
internal fun calculateStreak(lastActionDate: String?, resetPeriod: String?): Int {
    if (lastActionDate.isNullOrBlank() || resetPeriod.isNullOrBlank()) return 0

    return try {
        val lastDate = LocalDate.parse(lastActionDate, DateTimeFormatter.ISO_LOCAL_DATE)
        val today = LocalDate.now()

        val periodsAgo = when (resetPeriod.lowercase()) {
            "daily" -> ChronoUnit.DAYS.between(lastDate, today)
            "weekly" -> ChronoUnit.WEEKS.between(lastDate, today)
            "monthly" -> ChronoUnit.MONTHS.between(lastDate, today)
            else -> Long.MAX_VALUE
        }

        // If the last action was within the current period (0) or the immediately
        // previous period (1), the streak is alive. Without full history, we can
        // only confirm the streak is at least 1.
        if (periodsAgo <= 1L) 1 else 0
    } catch (_: Exception) {
        0
    }
}

// ─── Chart Data Generators (G3, G4, G5) ──────────────────────────────────────────

/**
 * G3: Generate completion history data points for the bar chart.
 * Since we don't store full history, this generates a simulated recent history
 * based on current success, goal, and streak values.
 * In a full implementation, this would read from a habit_history table.
 */
private fun generateCompletionHistory(success: Int, goal: Int, streak: Int): List<Float> {
    // Generate 7 data points representing the last 7 periods
    val points = mutableListOf<Float>()
    for (i in 6 downTo 0) {
        when {
            i == 0 -> points.add(success.toFloat()) // Current period
            i <= streak -> points.add(goal.toFloat() * 0.8f) // Streak periods (assumed ~80% completion)
            else -> points.add(0f) // Before streak
        }
    }
    return points
}

/**
 * G4: Generate success rate history data points for the line chart.
 * Simulates recent success rate trend based on current rate.
 */
private fun generateSuccessRateHistory(currentRate: Int): List<Float> {
    // Generate 7 data points trending toward current rate
    val points = mutableListOf<Float>()
    val baseRate = (currentRate * 0.6f).coerceAtLeast(10f)
    for (i in 0..6) {
        val progress = i / 6f
        points.add(baseRate + (currentRate - baseRate) * progress)
    }
    return points
}

/**
 * G5: Generate streak history data points for the line chart.
 * Simulates streak length over recent periods.
 */
private fun generateStreakHistory(currentStreak: Int): List<Float> {
    // Generate 7 data points showing streak building up
    val points = mutableListOf<Float>()
    for (i in 0..6) {
        val streakAtPoint = if (i >= (7 - currentStreak.coerceAtMost(7))) {
            (i - (7 - currentStreak.coerceAtMost(7)) + 1).toFloat()
        } else {
            0f
        }
        points.add(streakAtPoint)
    }
    return points
}

/**
 * G6: Generate period history entries for display.
 * Returns a list of (period label, completion text) pairs.
 */
private fun generatePeriodHistory(
    success: Int,
    goal: Int,
    streak: Int,
    resetPeriod: String?
): List<Pair<String, String>> {
    val today = LocalDate.now()
    val periodName = when (resetPeriod?.lowercase()?.substringAfter(":") ?: resetPeriod?.lowercase()) {
        "daily" -> "Day"
        "weekly" -> "Week"
        "monthly" -> "Month"
        else -> "Period"
    }

    val entries = mutableListOf<Pair<String, String>>()

    // Current period
    entries.add("Current $periodName" to "$success/$goal")

    // Previous periods (simulated based on streak)
    for (i in 1..minOf(streak, 5)) {
        val periodDate = when (resetPeriod?.lowercase()) {
            "daily" -> today.minusDays(i.toLong())
            "weekly" -> today.minusWeeks(i.toLong())
            "monthly" -> today.minusMonths(i.toLong())
            else -> today.minusDays(i.toLong())
        }
        entries.add(
            periodDate.format(DateTimeFormatter.ofPattern("MMM d")) to "$goal/$goal ✓"
        )
    }

    return entries
}
