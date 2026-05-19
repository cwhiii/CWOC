package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import com.cwoc.app.ui.components.DrumRollerTimePicker
import com.cwoc.app.ui.components.FlatpickrCalendarPicker
import com.cwoc.app.ui.components.TimezonePickerModal
import com.cwoc.app.ui.components.ZoneButton
import com.cwoc.app.ui.components.formatYMDDate
import com.cwoc.app.ui.components.parseYMDDate
import com.cwoc.app.ui.theme.LoraFontFamily
import com.google.gson.Gson
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.TextStyle as JavaTextStyle
import java.util.Locale
import java.util.TimeZone

// ─── Colors matching web parchment theme ─────────────────────────────────────
private val ZoneBodyBg = Color(0xFFFFF8DC)
private val InputBg = Color(0xFFFFF8E1)
private val InputBorder = Color(0xFF8B4513)
private val LabelColor = Color(0xFF4A2C2A)
private val FieldText = Color(0xFF1A1208)
private val MutedText = Color(0xFF8B7355)
private val AllDayInactiveBg = Color(0xFFA0522D)
private val AllDayInactiveText = Color(0xFFFDF5E6)
private val AllDayActiveBg = Color(0xFF008080)
private val AllDayActiveText = Color(0xFFFFF8E1)
private val SeparatorColor = Color(0xFF4A2C2A)
private val TzFloatingColor = Color(0xFF8B5A2B)
private val TzAnchoredColor = Color(0xFF1A1208)
private val TealAccent = Color(0xFF008080)

/**
 * Date mode options matching the web's radio buttons.
 */
enum class DateMode(val label: String, val icon: String) {
    NONE("None", ""),
    START_END("Start/End", "🗓️"),
    DUE("Due", "⏳"),
    POINT_IN_TIME("Point in Time", "📌"),
    PERPETUAL("Perpetual", "♾️")
}

/**
 * DateZone composable — complete rewrite for mobile browser parity.
 *
 * Renders the Dates & Times zone matching the web's mobile zone mode exactly:
 * - No zone header (navigation handled by zone nav bar)
 * - All Day button at top (styled as zone-button, not a Switch)
 * - Date mode radio group with fields indented below each option
 * - Parchment-themed date inputs and time buttons
 * - Drum roller time picker (not Material clock face)
 * - Timezone abbreviation labels (tappable, floating/anchored states)
 * - Inline recurrence controls (not a separate zone)
 * - All auto-behaviors (auto-default all-day, auto-populate, etc.)
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
fun DateZone(
    startDatetime: String?,
    endDatetime: String?,
    dueDatetime: String?,
    pointInTime: String?,
    perpetual: Boolean,
    allDay: Boolean,
    timezone: String?,
    onStartDatetimeChange: (String?) -> Unit,
    onEndDatetimeChange: (String?) -> Unit,
    onDueDatetimeChange: (String?) -> Unit,
    onPointInTimeChange: (String?) -> Unit,
    onPerpetualChange: (Boolean) -> Unit,
    onAllDayChange: (Boolean) -> Unit,
    onTimezoneChange: (String?) -> Unit,
    status: String? = null,
    onStatusChange: ((String) -> Unit)? = null,
    recurrenceRule: String? = null,
    onRecurrenceRuleChanged: ((String?) -> Unit)? = null,
    recurrenceExceptions: String? = null,
    suggestedTimezone: String? = null,
    habitActive: Boolean = false,
    habitResetPeriod: String? = null,
    onHabitResetPeriodChange: ((String?) -> Unit)? = null,
    isNewChit: Boolean = false,
    timeFormat: String = "24h",
    calendarSnap: Int = 5,
    defaultTimezone: String = "America/New_York",
    defaultNotifications: String? = null,
    alertsJson: String? = null,
    onAlertsChanged: ((String?) -> Unit)? = null
) {
    // ─── State ───────────────────────────────────────────────────────────────
    var showTimePicker by remember { mutableStateOf(false) }
    var timePickerTarget by remember { mutableStateOf("") } // "start", "end", "due", "pit"
    var showDatePicker by remember { mutableStateOf(false) }
    var datePickerTarget by remember { mutableStateOf("") }
    var showTzModal by remember { mutableStateOf(false) }
    var allDayAutoDefaulted by remember { mutableStateOf(false) }
    var tzSuggestionDismissed by remember { mutableStateOf(false) }
    // 11.9: Suppress-unsaved flag — true during initial load, prevents auto-behaviors from firing
    var suppressUnsaved by remember { mutableStateOf(true) }
    // 11.11: Track which modes have already had default notifications applied
    var defaultNotifsApplied by remember { mutableStateOf(setOf<DateMode>()) }

    // Derive current date mode
    val currentMode = remember(startDatetime, endDatetime, dueDatetime, pointInTime, perpetual) {
        deriveDateMode(startDatetime, endDatetime, dueDatetime, pointInTime, perpetual)
    }

    // Compute timezone abbreviation
    val tzIanaId = timezone ?: defaultTimezone
    val tzAbbr = remember(timezone, defaultTimezone) {
        getTimezoneAbbr(tzIanaId)
    }
    val tzFullName = remember(timezone, defaultTimezone) {
        getTimezoneFullName(tzIanaId)
    }
    val isTimezoneAnchored = timezone != null

    // Compute contextual recurrence labels
    val activeDate = remember(startDatetime, dueDatetime, currentMode) {
        when (currentMode) {
            DateMode.DUE -> parseIsoDatetime(dueDatetime)?.toLocalDate()
            else -> parseIsoDatetime(startDatetime)?.toLocalDate()
        }
    }

    // ─── Auto-behaviors ──────────────────────────────────────────────────────

    // 11.9: Clear suppress-unsaved flag after initial composition (load complete)
    LaunchedEffect(Unit) {
        // After the first composition, clear the suppress flag so subsequent
        // mode changes will trigger side effects (mark unsaved, auto-populate, etc.)
        suppressUnsaved = false
    }

    // 3.3: Point in Time auto-populate
    LaunchedEffect(currentMode) {
        if (currentMode == DateMode.POINT_IN_TIME && pointInTime.isNullOrBlank()) {
            val now = LocalDateTime.now()
            onPointInTimeChange(now.format(ISO_LOCAL_DATETIME_FORMATTER))
        }
    }

    // 15.3: Perpetual auto-set start date to today if empty when mode selected
    // 15.4: Perpetual always clears end date and end time when mode selected
    LaunchedEffect(currentMode) {
        if (currentMode == DateMode.PERPETUAL) {
            if (startDatetime.isNullOrBlank()) {
                val today = LocalDate.now().atStartOfDay()
                onStartDatetimeChange(today.format(ISO_LOCAL_DATETIME_FORMATTER))
            }
            // Always clear end date/time in Perpetual mode
            // (applyDateMode already does this on user click, but this also handles
            // the case where mode is derived from existing data on load)
            if (!endDatetime.isNullOrBlank()) {
                onEndDatetimeChange(null)
            }
        }
    }

    // 3.5: Habit mode forces
    LaunchedEffect(habitActive) {
        if (habitActive) {
            // 13.2: Force All Day to active state
            if (!allDay) onAllDayChange(true)
            // 13.3: Auto-enable repeat with Daily frequency if not already enabled
            if (recurrenceRule.isNullOrBlank() && onRecurrenceRuleChanged != null) {
                onRecurrenceRuleChanged("""{"freq":"DAILY","interval":1}""")
            }
            // 13.6: Force "Ends never" to checked — clear any until/count from recurrence rule
            if (!recurrenceRule.isNullOrBlank() && onRecurrenceRuleChanged != null) {
                try {
                    val parsed = Gson().fromJson(recurrenceRule, com.cwoc.app.domain.recurrence.RecurrenceRule::class.java)
                    if (parsed.until != null || parsed.count != null) {
                        val updated = parsed.copy(until = null, count = null)
                        onRecurrenceRuleChanged(Gson().toJson(updated))
                    }
                } catch (_: Exception) { /* ignore parse errors */ }
            }
            if (currentMode == DateMode.NONE) {
                // Auto-switch to Start/End
                onPerpetualChange(false)
                val today = LocalDate.now().atStartOfDay()
                onStartDatetimeChange(today.format(ISO_LOCAL_DATETIME_FORMATTER))
            }
        } else {
            if (!suppressUnsaved) {
                // 13.10: On habit deactivation, show Recurrence Row with checkbox unchecked
                if (onRecurrenceRuleChanged != null) {
                    onRecurrenceRuleChanged(null)
                }
                // 13.11: Hide Perpetual row — if currently in Perpetual mode, switch to Start/End
                if (currentMode == DateMode.PERPETUAL) {
                    onPerpetualChange(false)
                    // Keep the start date but switch to Start/End mode
                    if (startDatetime.isNullOrBlank()) {
                        val today = LocalDate.now().atStartOfDay()
                        onStartDatetimeChange(today.format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                }
            }
        }
    }

    // 13.13: Bidirectional frequency sync — habit reset period → recurrence rule frequency
    // When habit is active and the reset period changes externally (from HabitsZone),
    // sync the recurrence rule frequency to match.
    LaunchedEffect(habitResetPeriod, habitActive) {
        if (!habitActive || suppressUnsaved) return@LaunchedEffect
        if (habitResetPeriod.isNullOrBlank() || recurrenceRule.isNullOrBlank()) return@LaunchedEffect
        if (onRecurrenceRuleChanged == null) return@LaunchedEffect

        // Extract the unit from habitResetPeriod (format: "daily", "weekly", "monthly" or "N:unit")
        val unit = if (habitResetPeriod.contains(":")) {
            habitResetPeriod.substringAfter(":")
        } else {
            habitResetPeriod
        }
        val targetFreq = when (unit.lowercase()) {
            "daily" -> "DAILY"
            "weekly" -> "WEEKLY"
            "monthly" -> "MONTHLY"
            "yearly" -> "YEARLY"
            else -> null
        } ?: return@LaunchedEffect

        try {
            val parsed = Gson().fromJson(recurrenceRule, com.cwoc.app.domain.recurrence.RecurrenceRule::class.java)
            if (parsed.freq.uppercase() != targetFreq) {
                val updated = parsed.copy(freq = targetFreq, interval = 1, byDay = null)
                onRecurrenceRuleChanged(Gson().toJson(updated))
            }
        } catch (_: Exception) { /* ignore parse errors */ }
    }

    // ─── Zone Container ─────────────────────────────────────────────────────
    // Matches web: background #fff8dc, no border-radius, no left/right borders,
    // full width, flex 1, min-height 0, overflow visible
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(ZoneBodyBg)
    ) {
        // ── Zone Header (simple row, no border, no background) ───────────────
        // Contains only the zone actions row (All Day button).
        // Zone title "🗓️ Dates & Times" and toggle icon are HIDDEN in mobile zone mode.
        if (currentMode != DateMode.NONE && currentMode != DateMode.POINT_IN_TIME) {
            // Zone actions row: flex wrap, gap 6dp, width 100%, justify-content flex-start
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AllDayButton(
                    isActive = allDay,
                    isDisabled = habitActive,
                    onClick = {
                        if (!habitActive) {
                            allDayAutoDefaulted = false
                            onAllDayChange(!allDay)
                        }
                    }
                )
            }
        }

        // ── Zone Body (flex column, padding 8dp 16dp, width 100%) ────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // ── Date Mode Radio Group (7.1: Column, gap 0, fillMaxWidth, padding 0, margin 0) ──
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                DateMode.entries.forEach { mode ->
                    // 7.7: Hide None when habit is active
                    if (mode == DateMode.NONE && habitActive) return@forEach
                    // 15.5: Perpetual hidden by default, only visible when habit mode is active
                    // (also shown if perpetual is already true, for loading existing perpetual chits)
                    if (mode == DateMode.PERPETUAL && !habitActive && !perpetual) return@forEach

                    // 7.2: Each Date_Mode_Row as Column: align stretch, padding 4dp vertical, margin 0
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .let { mod ->
                                if (mode == DateMode.NONE && habitActive) mod.alpha(0.5f)
                                else mod
                            }
                    ) {
                        // 7.3: Date_Mode_Label as Row: align flex-start, gap 0, no wrap
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = (mode == currentMode),
                                    enabled = !(mode == DateMode.NONE && habitActive),
                                    onClick = {
                                        applyDateMode(
                                            mode, onStartDatetimeChange, onEndDatetimeChange,
                                            onDueDatetimeChange, onPointInTimeChange, onPerpetualChange
                                        )
                                        // 11.6: Auto-default all-day on first activation of Start/End, Due, or Perpetual
                                        // Only when not suppressed during load
                                        if (!suppressUnsaved && mode != DateMode.NONE && mode != DateMode.POINT_IN_TIME && !allDay) {
                                            allDayAutoDefaulted = true
                                            onAllDayChange(true)
                                        }
                                        // 11.11: Auto-populate default notifications for new chits when date mode first activated
                                        if (!suppressUnsaved && isNewChit && mode != DateMode.NONE) {
                                            applyDefaultNotifications(
                                                mode = mode,
                                                defaultNotifications = defaultNotifications,
                                                alertsJson = alertsJson,
                                                onAlertsChanged = onAlertsChanged,
                                                appliedModes = defaultNotifsApplied,
                                                onAppliedModesUpdate = { defaultNotifsApplied = it }
                                            )
                                        }
                                    },
                                    role = Role.RadioButton
                                ),
                            verticalAlignment = Alignment.Top
                        ) {
                            // 7.4: Radio buttons at exactly 16×16dp with min-size 16dp,
                            // margin 2dp top 6dp right 0 bottom 0 left, no flex-shrink/grow
                            RadioButton(
                                selected = (mode == currentMode),
                                onClick = null,
                                modifier = Modifier
                                    .padding(top = 2.dp, end = 6.dp, bottom = 0.dp, start = 0.dp)
                                    .requiredSize(16.dp),
                                colors = RadioButtonDefaults.colors(
                                    selectedColor = InputBorder,
                                    unselectedColor = InputBorder
                                )
                            )
                            // 7.5: Label text: font-size 0.9em (~14sp), bold, Lora, color #4a2c2a
                            Text(
                                text = if (mode.icon.isNotBlank()) "${mode.icon} ${mode.label}" else mode.label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = LoraFontFamily,
                                color = LabelColor
                            )
                        }

                        // 7.6: Date_Mode_Fields below label: margin-left 22dp, width calc(100% - 22dp), flex-wrap, gap 6dp
                        if (mode == currentMode && mode != DateMode.NONE) {
                            FlowRow(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 22.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                when (mode) {
                                    // 7.8: Start/End fields: Start Date → Start Time → "to" → End Time → End Date → TZ label
                                    DateMode.START_END -> {
                                        val showTime = !allDay || allDayAutoDefaulted
                                        ParchmentDateField(
                                            value = formatDateForDisplay(startDatetime),
                                            placeholder = "Start Date",
                                            onClick = { datePickerTarget = "start"; showDatePicker = true }
                                        )
                                        if (showTime) {
                                            ParchmentTimeButton(
                                                value = formatTimeForDisplay(startDatetime, timeFormat),
                                                onClick = { timePickerTarget = "start"; showTimePicker = true }
                                            )
                                        }
                                        // 7.12: "to" separator between start time and end time
                                        Text(
                                            text = "to",
                                            fontSize = 14.sp,
                                            fontFamily = LoraFontFamily,
                                            color = SeparatorColor,
                                            modifier = Modifier.align(Alignment.CenterVertically)
                                        )
                                        if (showTime) {
                                            ParchmentTimeButton(
                                                value = formatTimeForDisplay(endDatetime, timeFormat),
                                                onClick = { timePickerTarget = "end"; showTimePicker = true }
                                            )
                                        }
                                        ParchmentDateField(
                                            value = formatDateForDisplay(endDatetime),
                                            placeholder = "End Date",
                                            onClick = { datePickerTarget = "end"; showDatePicker = true }
                                        )
                                        TimezoneLabel(
                                            abbr = tzAbbr,
                                            isAnchored = isTimezoneAnchored,
                                            onClick = { showTzModal = true },
                                            modifier = Modifier.align(Alignment.CenterVertically),
                                            fullName = tzFullName,
                                            ianaId = tzIanaId
                                        )
                                    }
                                    // 7.9: Due fields: Due Date → Due Time → Complete checkbox (conditional) → TZ label
                                    DateMode.DUE -> {
                                        val showTime = !allDay || allDayAutoDefaulted
                                        ParchmentDateField(
                                            value = formatDateForDisplay(dueDatetime),
                                            placeholder = "Due Date",
                                            onClick = { datePickerTarget = "due"; showDatePicker = true }
                                        )
                                        if (showTime) {
                                            ParchmentTimeButton(
                                                value = formatTimeForDisplay(dueDatetime, timeFormat),
                                                onClick = { timePickerTarget = "due"; showTimePicker = true }
                                            )
                                        }
                                        // Complete checkbox (conditional — shown only when status is set)
                                        // 14.1: Hidden by default, shown only when status is set on the chit
                                        if (onStatusChange != null && !status.isNullOrBlank()) {
                                            // 14.2: margin-left 8dp, align-items center, gap 4dp, font-size 0.85em, cursor pointer
                                            // 14.3: title/tooltip "Yes, this is the same as the 'Status' Complete."
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier
                                                    .padding(start = 8.dp)
                                                    .align(Alignment.CenterVertically)
                                                    .semantics {
                                                        contentDescription = "Yes, this is the same as the 'Status' Complete."
                                                    }
                                                    .clickable {
                                                        // 14.4: Toggling syncs with Task zone's status dropdown (bidirectional)
                                                        val newStatus = if (status == "Complete") "ToDo" else "Complete"
                                                        onStatusChange(newStatus)
                                                    }
                                            ) {
                                                Checkbox(
                                                    checked = status == "Complete",
                                                    onCheckedChange = { checked ->
                                                        // 14.4: Toggling syncs with Task zone's status dropdown (bidirectional)
                                                        onStatusChange(if (checked) "Complete" else "ToDo")
                                                    },
                                                    modifier = Modifier.requiredSize(16.dp),
                                                    colors = CheckboxDefaults.colors(checkedColor = TealAccent)
                                                )
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Complete", fontSize = 13.sp, fontFamily = LoraFontFamily, color = LabelColor)
                                            }
                                        }
                                        TimezoneLabel(
                                            abbr = tzAbbr,
                                            isAnchored = isTimezoneAnchored,
                                            onClick = { showTzModal = true },
                                            modifier = Modifier.align(Alignment.CenterVertically),
                                            fullName = tzFullName,
                                            ianaId = tzIanaId
                                        )
                                    }
                                    // 7.10: Point in Time fields: Date → Time → "Now" button → TZ label
                                    DateMode.POINT_IN_TIME -> {
                                        ParchmentDateField(
                                            value = formatDateForDisplay(pointInTime),
                                            placeholder = "Date",
                                            onClick = { datePickerTarget = "pit"; showDatePicker = true }
                                        )
                                        ParchmentTimeButton(
                                            value = formatTimeForDisplay(pointInTime, timeFormat),
                                            onClick = { timePickerTarget = "pit"; showTimePicker = true }
                                        )
                                        // 14.5: "Now" button with Zone_Button styling
                                        // 14.6: Sets both date and time to current moment
                                        ZoneButton(
                                            text = "Now",
                                            onClick = {
                                                val now = LocalDateTime.now()
                                                onPointInTimeChange(now.format(ISO_LOCAL_DATETIME_FORMATTER))
                                            },
                                            modifier = Modifier
                                                .height(34.dp)
                                                .semantics {
                                                    contentDescription = "Set to current date and time"
                                                }
                                        )
                                        TimezoneLabel(
                                            abbr = tzAbbr,
                                            isAnchored = isTimezoneAnchored,
                                            onClick = { showTzModal = true },
                                            modifier = Modifier.align(Alignment.CenterVertically),
                                            fullName = tzFullName,
                                            ianaId = tzIanaId
                                        )
                                    }
                                    // 15.1: Perpetual fields: description span
                                    // "Starts now, continues forever" in color #6b4e31, font-size 0.85em, Lora
                                    DateMode.PERPETUAL -> {
                                        // 15.2: Append " (Started [date].)" when start date exists
                                        val dateText = if (!startDatetime.isNullOrBlank()) {
                                            val formatted = formatDateForDisplay(startDatetime)
                                            "Starts now, continues forever. (Started $formatted.)"
                                        } else {
                                            "Starts now, continues forever"
                                        }
                                        Text(
                                            text = dateText,
                                            fontSize = 13.sp, // 0.85em of 16sp base ≈ 13.6sp
                                            fontFamily = LoraFontFamily,
                                            color = Color(0xFF6B4E31)
                                        )
                                    }
                                    DateMode.NONE -> { /* No fields */ }
                                }
                            }

                            // 18.3: Inject TimezoneSuggestionPrompt into the first visible Date_Mode_Fields container
                            // 18.2: Show when: suggestedTimezone is non-null AND differs from current
                            // AND no explicit timezone set AND date mode is not "None"
                            if (!suggestedTimezone.isNullOrBlank() &&
                                timezone == null &&
                                suggestedTimezone != defaultTimezone &&
                                !tzSuggestionDismissed
                            ) {
                                Box(modifier = Modifier.padding(start = 22.dp).fillMaxWidth()) {
                                    com.cwoc.app.ui.components.TimezoneSuggestionPrompt(
                                        detectedTimezone = suggestedTimezone,
                                        onUse = {
                                            // 18.4: Set chit timezone, update all TZ labels to anchored, mark unsaved, remove prompt
                                            onTimezoneChange(suggestedTimezone)
                                            tzSuggestionDismissed = true
                                        },
                                        onDismiss = {
                                            // 18.5: Remove prompt, leave timezone unchanged
                                            tzSuggestionDismissed = true
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ── Repeat Row (inline recurrence) ───────────────────────────────
            // 12.2: Shown when date mode is Start/End or Due, hidden when habit active
            // Section 11.1: Hidden when mode is None, Point in Time, or Perpetual
            if (!habitActive && (currentMode == DateMode.START_END || currentMode == DateMode.DUE)) {
                Spacer(modifier = Modifier.height(8.dp))
                InlineRecurrenceRow(
                    recurrenceRule = recurrenceRule,
                    onRecurrenceRuleChanged = onRecurrenceRuleChanged,
                    activeDate = activeDate,
                    calendarSnap = calendarSnap,
                    habitActive = habitActive,
                    onHabitResetPeriodChange = onHabitResetPeriodChange
                )
            }
        }
    }

    // ─── Dialogs ─────────────────────────────────────────────────────────────

    // Drum Roller Time Picker
    if (showTimePicker) {
        val currentTime = when (timePickerTarget) {
            "start" -> parseIsoDatetime(startDatetime)?.toLocalTime()
            "end" -> parseIsoDatetime(endDatetime)?.toLocalTime()
            "due" -> parseIsoDatetime(dueDatetime)?.toLocalTime()
            "pit" -> parseIsoDatetime(pointInTime)?.toLocalTime()
            else -> null
        } ?: LocalTime.NOON

        DrumRollerTimePicker(
            initialHour = currentTime.hour,
            initialMinute = currentTime.minute,
            is24Hour = (timeFormat == "24h"),
            minuteStep = calendarSnap,
            onDismiss = { showTimePicker = false },
            onTimeSelected = { hour, minute ->
                showTimePicker = false
                val newTime = LocalTime.of(hour, minute)
                when (timePickerTarget) {
                    "start" -> {
                        val date = parseIsoDatetime(startDatetime)?.toLocalDate() ?: LocalDate.now()
                        onStartDatetimeChange(LocalDateTime.of(date, newTime).format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                    "end" -> {
                        val date = parseIsoDatetime(endDatetime)?.toLocalDate() ?: LocalDate.now()
                        onEndDatetimeChange(LocalDateTime.of(date, newTime).format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                    "due" -> {
                        val date = parseIsoDatetime(dueDatetime)?.toLocalDate() ?: LocalDate.now()
                        onDueDatetimeChange(LocalDateTime.of(date, newTime).format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                    "pit" -> {
                        val date = parseIsoDatetime(pointInTime)?.toLocalDate() ?: LocalDate.now()
                        onPointInTimeChange(LocalDateTime.of(date, newTime).format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                }
                // 3.2: Auto-uncheck all-day on time selection
                if (allDay) {
                    allDayAutoDefaulted = false
                    onAllDayChange(false)
                }
            }
        )
    }

    // FlatpickrCalendarPicker (replaces Material 3 DatePickerDialog)
    if (showDatePicker) {
        val currentDate = when (datePickerTarget) {
            "start" -> parseIsoDatetime(startDatetime)?.toLocalDate()
            "end" -> parseIsoDatetime(endDatetime)?.toLocalDate()
            "due" -> parseIsoDatetime(dueDatetime)?.toLocalDate()
            "pit" -> parseIsoDatetime(pointInTime)?.toLocalDate()
            else -> null
        }
        val initialDateStr = currentDate?.let { formatYMDDate(it) }

        FlatpickrCalendarPicker(
            isOpen = true,
            initialDate = initialDateStr,
            onDateSelected = { ymdDate ->
                // Parse the YYYY-Mon-DD date from the picker
                val selectedDate = parseYMDDate(ymdDate) ?: return@FlatpickrCalendarPicker
                val existingTime = when (datePickerTarget) {
                    "start" -> parseIsoDatetime(startDatetime)?.toLocalTime()
                    "end" -> parseIsoDatetime(endDatetime)?.toLocalTime()
                    "due" -> parseIsoDatetime(dueDatetime)?.toLocalTime()
                    "pit" -> parseIsoDatetime(pointInTime)?.toLocalTime()
                    else -> null
                } ?: LocalTime.NOON
                val newDt = LocalDateTime.of(selectedDate, existingTime)
                    .format(ISO_LOCAL_DATETIME_FORMATTER)
                when (datePickerTarget) {
                    "start" -> onStartDatetimeChange(newDt)
                    "end" -> onEndDatetimeChange(newDt)
                    "due" -> onDueDatetimeChange(newDt)
                    "pit" -> onPointInTimeChange(newDt)
                }
                showDatePicker = false
            },
            onDismiss = { showDatePicker = false }
        )
    }

    // Timezone Picker Modal
    if (showTzModal) {
        TimezonePickerModal(
            currentTimezone = timezone,
            onTimezoneSelected = { tz ->
                onTimezoneChange(tz)
                showTzModal = false
            },
            onClear = {
                onTimezoneChange(null)
                showTzModal = false
            },
            onCancel = { showTzModal = false },
            onLocationGeocoded = { address ->
                // Populate location zone with geocoded address if callback available
                // This will be wired when the location zone integration is complete
            }
        )
    }
}


// ─── All Day Button ──────────────────────────────────────────────────────────

private val AllDayInactivePressedBg = Color(0xFF924525)

@Composable
private fun AllDayButton(isActive: Boolean, isDisabled: Boolean, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // 13.2: When disabled (habit active), always show as active state
    val effectiveActive = isActive || isDisabled

    val bg = when {
        effectiveActive -> AllDayActiveBg
        isPressed && !isDisabled -> AllDayInactivePressedBg
        else -> AllDayInactiveBg
    }
    val text = if (effectiveActive) AllDayActiveText else AllDayInactiveText
    val borderColor = if (effectiveActive) Color(0xFF006060) else InputBorder
    val label = if (effectiveActive) "🗓️ All Day ✓" else "🗓️ All Day"
    // 13.2: When disabled (habit active), title is "Habits are always all-day"
    val accessibilityTitle = if (isDisabled) "Habits are always all-day" else label

    Box(
        modifier = Modifier
            .height(30.dp)
            .background(bg, RoundedCornerShape(3.dp))
            .border(1.dp, borderColor, RoundedCornerShape(3.dp))
            .alpha(if (isDisabled) 0.6f else 1f)
            .semantics { contentDescription = accessibilityTitle }
            .clickable(
                enabled = !isDisabled,
                interactionSource = interactionSource,
                indication = null
            ) { onClick() }
            .padding(horizontal = 10.dp, vertical = 5.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontFamily = LoraFontFamily,
            color = text,
            maxLines = 1
        )
    }
}

// ─── Parchment Date Field ────────────────────────────────────────────────────
// 8.1: border 1dp solid #8b4513, border-radius 3dp, background #fff8e1, Lora,
// font-size 16sp, min-height 38dp, padding 4dp 8dp, flex 1, min-width 80dp,
// max-width 100%, margin-right 4dp

@Composable
private fun ParchmentDateField(
    value: String,
    placeholder: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fixedWidth: Int? = null
) {
    Box(
        modifier = modifier
            .heightIn(min = 38.dp)
            .then(
                if (fixedWidth != null) Modifier.width(fixedWidth.dp)
                else Modifier.widthIn(min = 80.dp)
            )
            .padding(end = 4.dp)
            .background(InputBg, RoundedCornerShape(3.dp))
            .border(1.dp, InputBorder, RoundedCornerShape(3.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = value.ifBlank { placeholder },
            fontSize = 16.sp,
            fontFamily = LoraFontFamily,
            color = if (value.isBlank()) MutedText else FieldText
        )
    }
}

// ─── Parchment Time Button ───────────────────────────────────────────────────
// 9.1: width 80dp, font-size 0.85em, padding 3dp 6dp, Lora, border 1dp solid #8b4513,
//      border-radius 3dp, background #fff8e1, margin-right 4dp, text-align center,
//      line-height 22dp, color #1a1208, min-height 34dp
// 9.2: Empty state: text "HH:MM", color #8b7355 (muted)
// 9.3: Filled state (24h): zero-padded "HH:MM" (e.g., "14:30")
// 9.4: Filled state (12h): no zero-pad hours + AM/PM (e.g., "2:30 PM")
// 9.5: Value storage: internal 24-hour format regardless of display preference
// 9.6: Tap opens DrumRollerTimePicker with current value (or empty)
// 9.7: Active/pressed state: background rgba(139,90,43,0.15)
// 9.8: Tap-highlight: rgba(139,90,43,0.2)

private val TimeButtonPressedBg = Color(0x268B5A2B) // rgba(139,90,43,0.15)

@Composable
private fun ParchmentTimeButton(
    value: String,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // 9.7: Pressed state uses background rgba(139,90,43,0.15)
    val bgColor = if (isPressed) TimeButtonPressedBg else InputBg

    Box(
        modifier = Modifier
            .width(80.dp)
            .heightIn(min = 34.dp)
            .background(bgColor, RoundedCornerShape(3.dp))
            .border(1.dp, InputBorder, RoundedCornerShape(3.dp))
            .clickable(
                interactionSource = interactionSource,
                indication = null // 9.8: suppress default ripple, use custom pressed bg
            ) { onClick() }
            .padding(horizontal = 6.dp, vertical = 3.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = value.ifBlank { "HH:MM" },
            fontSize = 14.sp, // 0.85em of 16sp base ≈ 13.6sp, rounded to 14sp
            fontFamily = LoraFontFamily,
            color = if (value.isBlank()) MutedText else FieldText,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp // line-height 22dp
        )
    }
}

// ─── Timezone Label ──────────────────────────────────────────────────────────

/**
 * Timezone abbreviation label composable.
 *
 * Matches web spec: inline-flex, align-items center, Lora, font-size 0.85em (mobile),
 * cursor pointer, padding 4dp 8dp (mobile), border-radius 3dp, margin-left 6dp,
 * white-space nowrap, min-width 36dp (mobile), min-height 32dp (mobile),
 * justify-content center, transition bg/color 0.2s.
 *
 * Two states:
 * - Floating: color #8b5a2b, opacity 0.55, normal font-weight
 * - Anchored: color #1a1208, opacity 1, font-weight 500
 *
 * Tap opens TimezonePickerModal.
 * Pressed state: background rgba(139,90,43,0.1).
 * Long-press shows tooltip with timezone details.
 *
 * @param abbr The timezone abbreviation text (e.g., "MST")
 * @param fullName The full timezone display name (e.g., "Mountain Standard Time")
 * @param ianaId The IANA timezone identifier (e.g., "America/Denver")
 * @param isAnchored Whether an explicit timezone is set (anchored) or assumed (floating)
 * @param onClick Called when the label is tapped (opens TimezonePickerModal)
 * @param modifier Optional modifier
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TimezoneLabel(
    abbr: String,
    isAnchored: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fullName: String = "",
    ianaId: String = ""
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    var showTooltip by remember { mutableStateOf(false) }

    // Pressed/hover background: rgba(139,90,43,0.1)
    val bgColor = if (isPressed) Color(0x1A8B5A2B) else Color.Transparent

    Box(
        modifier = modifier
            .padding(start = 6.dp) // margin-left 6dp
            .heightIn(min = 32.dp) // min-height 32dp (mobile)
            .widthIn(min = 36.dp) // min-width 36dp (mobile)
            .background(bgColor, RoundedCornerShape(3.dp))
            .combinedClickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = { onClick() },
                onLongClick = { showTooltip = true }
            )
            .padding(horizontal = 8.dp, vertical = 4.dp) // padding 4dp 8dp (mobile)
            .alpha(if (isAnchored) 1f else 0.55f),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = abbr,
            fontSize = 14.sp, // 0.85em on mobile ≈ 14sp
            fontFamily = LoraFontFamily,
            fontWeight = if (isAnchored) FontWeight.Medium else FontWeight.Normal,
            color = if (isAnchored) TzAnchoredColor else TzFloatingColor,
            maxLines = 1
        )
    }

    // Tooltip popup on long-press
    if (showTooltip) {
        Popup(
            alignment = Alignment.TopCenter,
            onDismissRequest = { showTooltip = false }
        ) {
            Box(
                modifier = Modifier
                    .background(Color(0xFFFFFAF0), RoundedCornerShape(6.dp))
                    .border(1.dp, Color(0xFF6B4E31), RoundedCornerShape(6.dp))
                    .padding(10.dp)
                    .clickable { showTooltip = false }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(text = abbr, fontSize = 13.sp, fontFamily = LoraFontFamily, fontWeight = FontWeight.Bold, color = FieldText)
                    if (fullName.isNotBlank()) {
                        Text(text = fullName, fontSize = 12.sp, fontFamily = LoraFontFamily, color = FieldText)
                    }
                    if (ianaId.isNotBlank()) {
                        Text(text = ianaId, fontSize = 12.sp, fontFamily = LoraFontFamily, color = MutedText)
                    }
                    if (!isAnchored) {
                        Text(
                            text = "(assumed — click to set)",
                            fontSize = 11.sp,
                            fontFamily = LoraFontFamily,
                            color = MutedText,
                            fontWeight = FontWeight.Normal
                        )
                    }
                }
            }
        }
    }
}

// ─── Inline Recurrence Row ───────────────────────────────────────────────────
// Task 12: Full inline recurrence controls matching web spec Section 11.
// Replaces the separate RecurrenceZone.kt (now deprecated).

/**
 * Custom recurrence unit options matching the web's `<select id="recurrenceFreq">`.
 */
private enum class CustomRecurrenceUnit(val label: String, val value: String) {
    MINUTES("minutes", "MINUTELY"),
    HOURS("hours", "HOURLY"),
    DAYS("days", "DAILY"),
    WEEKS("weeks", "WEEKLY"),
    MONTHS("months", "MONTHLY"),
    YEARS("years", "YEARLY")
}

/**
 * Day-of-week options for by-day checkboxes (Su, Mo, Tu, We, Th, Fr, Sa).
 * Order matches the web: Sunday first.
 */
private enum class RecurrenceDayOption(val label: String, val code: String) {
    SU("Su", "SU"),
    MO("Mo", "MO"),
    TU("Tu", "TU"),
    WE("We", "WE"),
    TH("Th", "TH"),
    FR("Fr", "FR"),
    SA("Sa", "SA")
}

/**
 * InlineRecurrenceRow — the repeat/recurrence controls rendered as a Date_Mode_Row
 * with checkbox labeled "🔁 Repeat".
 *
 * Matches web spec Section 11 exactly:
 * - 12.1: Date_Mode_Row with checkbox labeled "🔁 Repeat"
 * - 12.3: Inline options when checked: frequency dropdown + ends-never checkbox + conditional until-date
 * - 12.4: Frequency dropdown with contextual labels
 * - 12.5: Contextual label updates when active date changes
 * - 12.6: Habit-mode simplified labels
 * - 12.7: "Ends never" checkbox: font-size 0.85em, margin-left 8dp, checked by default
 * - 12.8: Until-date input: shown when "Ends never" unchecked, placeholder "End date", width 90dp
 * - 12.9: Custom Recurrence Block: shown when "Custom…" selected
 * - 12.10: Custom interval: "Every [number] [unit]" — number + unit dropdown
 * - 12.11: By-day checkboxes: shown when custom unit is "weeks"
 * - 12.12: By-day hidden when custom unit is not "weeks"
 * - 12.14: Frequency dropdown styling: Lora font, width auto, matching zone input styling
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InlineRecurrenceRow(
    recurrenceRule: String?,
    onRecurrenceRuleChanged: ((String?) -> Unit)?,
    activeDate: LocalDate?,
    calendarSnap: Int,
    habitActive: Boolean = false,
    onHabitResetPeriodChange: ((String?) -> Unit)? = null
) {
    if (onRecurrenceRuleChanged == null) return

    val isEnabled = !recurrenceRule.isNullOrBlank()
    var frequencyExpanded by remember { mutableStateOf(false) }
    var customUnitExpanded by remember { mutableStateOf(false) }

    // Track whether "Custom…" is selected (either from dropdown or from parsed rule with non-standard freq)
    var showCustomBlock by remember(recurrenceRule) {
        val parsed = if (recurrenceRule.isNullOrBlank()) null
        else try { Gson().fromJson(recurrenceRule, com.cwoc.app.domain.recurrence.RecurrenceRule::class.java) }
        catch (_: Exception) { null }
        // Show custom block if freq is MINUTELY or HOURLY (not in standard presets),
        // or if interval > 1, or if byDay is set
        val isCustom = parsed != null && (
            parsed.freq.uppercase() in listOf("MINUTELY", "HOURLY") ||
            parsed.interval > 1 ||
            !parsed.byDay.isNullOrEmpty()
        )
        mutableStateOf(isCustom)
    }

    // Parse current rule
    val parsedRule = remember(recurrenceRule) {
        if (recurrenceRule.isNullOrBlank()) null
        else try { Gson().fromJson(recurrenceRule, com.cwoc.app.domain.recurrence.RecurrenceRule::class.java) }
        catch (_: Exception) { null }
    }

    // 12.1: Date_Mode_Row structure — Column with padding 4dp vertical
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        // 12.1: Checkbox + label row (Date_Mode_Label style)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Checkbox at 16×16dp matching radio button sizing
            Checkbox(
                checked = isEnabled,
                onCheckedChange = { checked ->
                    if (checked) {
                        onRecurrenceRuleChanged("""{"freq":"DAILY","interval":1}""")
                    } else {
                        onRecurrenceRuleChanged(null)
                        showCustomBlock = false
                    }
                },
                modifier = Modifier
                    .padding(top = 2.dp, end = 6.dp, bottom = 0.dp, start = 0.dp)
                    .requiredSize(16.dp),
                colors = CheckboxDefaults.colors(checkedColor = InputBorder)
            )
            // 12.1: Label "🔁 Repeat" — font-size 0.9em (~14sp), bold, Lora, color #4a2c2a
            Text(
                text = "🔁 Repeat",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = LoraFontFamily,
                color = LabelColor
            )
        }

        // 12.3: Inline options (shown when checkbox is checked)
        if (isEnabled && parsedRule != null) {
            // Date_Mode_Fields style: margin-left 22dp, flex-wrap, gap 6dp
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 22.dp, top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // 12.4 + 12.14: Frequency dropdown — Lora font, width auto, matching zone input styling
                val freqOptions = if (habitActive) {
                    // 12.6: Habit-mode simplified labels
                    buildHabitFreqOptions()
                } else {
                    // 12.4 + 12.5: Contextual labels based on active date
                    buildContextualFreqOptions(activeDate)
                }
                val currentFreqLabel = if (showCustomBlock) {
                    "Custom…"
                } else {
                    freqOptions.find { it.second == parsedRule.freq.uppercase() }?.first
                        ?: parsedRule.freq.lowercase().replaceFirstChar { it.uppercase() }
                }

                // Frequency dropdown trigger (styled as zone input)
                Box {
                    Box(
                        modifier = Modifier
                            .heightIn(min = 34.dp)
                            .background(InputBg, RoundedCornerShape(3.dp))
                            .border(1.dp, InputBorder, RoundedCornerShape(3.dp))
                            .clickable { frequencyExpanded = true }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(
                            text = currentFreqLabel,
                            fontSize = 14.sp,
                            fontFamily = LoraFontFamily,
                            color = FieldText
                        )
                    }
                    androidx.compose.material3.DropdownMenu(
                        expanded = frequencyExpanded,
                        onDismissRequest = { frequencyExpanded = false }
                    ) {
                        freqOptions.forEach { (label, freq) ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = label,
                                        fontFamily = LoraFontFamily,
                                        fontSize = 14.sp
                                    )
                                },
                                onClick = {
                                    frequencyExpanded = false
                                    if (freq == "CUSTOM") {
                                        showCustomBlock = true
                                        // Initialize custom with current rule or default to weekly interval 1
                                        if (parsedRule.interval == 1 && parsedRule.freq.uppercase() in listOf("DAILY", "WEEKLY", "MONTHLY", "YEARLY")) {
                                            val updated = parsedRule.copy(freq = "WEEKLY")
                                            onRecurrenceRuleChanged(Gson().toJson(updated))
                                        }
                                    } else {
                                        showCustomBlock = false
                                        val updated = parsedRule.copy(
                                            freq = freq,
                                            interval = 1,
                                            byDay = null
                                        )
                                        onRecurrenceRuleChanged(Gson().toJson(updated))
                                        // 13.13: Bidirectional sync — recurrence freq → habit reset period
                                        if (habitActive && onHabitResetPeriodChange != null) {
                                            val habitPeriod = when (freq) {
                                                "DAILY" -> "daily"
                                                "WEEKLY" -> "weekly"
                                                "MONTHLY" -> "monthly"
                                                "YEARLY" -> "yearly"
                                                else -> null
                                            }
                                            if (habitPeriod != null) {
                                                onHabitResetPeriodChange(habitPeriod)
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }
                }

                // 12.7: "Ends never" checkbox — font-size 0.85em, margin-left 8dp, checked by default
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    val endsNever = parsedRule.until == null && parsedRule.count == null
                    Checkbox(
                        checked = endsNever,
                        onCheckedChange = { checked ->
                            if (checked) {
                                val updated = parsedRule.copy(until = null, count = null)
                                onRecurrenceRuleChanged(Gson().toJson(updated))
                            } else {
                                // Uncheck "ends never" — set until to empty string to show input
                                val updated = parsedRule.copy(until = "", count = null)
                                onRecurrenceRuleChanged(Gson().toJson(updated))
                            }
                        },
                        modifier = Modifier
                            .padding(top = 2.dp, end = 4.dp)
                            .requiredSize(16.dp),
                        colors = CheckboxDefaults.colors(checkedColor = InputBorder)
                    )
                    Text(
                        text = "Ends never",
                        fontSize = 13.sp, // 0.85em
                        fontFamily = LoraFontFamily,
                        color = LabelColor
                    )
                }
            }

            // 12.8: Until-date input — shown when "Ends never" is unchecked
            if (parsedRule.until != null) {
                var showUntilPicker by remember { mutableStateOf(false) }
                Row(
                    modifier = Modifier
                        .padding(start = 22.dp, top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // 12.8: placeholder "End date", width 90dp, FlatpickrCalendarPicker, format "Y-M-d"
                    ParchmentDateField(
                        value = parsedRule.until ?: "",
                        placeholder = "End date",
                        onClick = { showUntilPicker = true },
                        fixedWidth = 90
                    )
                }

                // FlatpickrCalendarPicker for recurrence until date
                if (showUntilPicker) {
                    FlatpickrCalendarPicker(
                        isOpen = true,
                        initialDate = parsedRule.until?.takeIf { it.isNotBlank() },
                        onDateSelected = { ymdDate ->
                            val updated = parsedRule.copy(until = ymdDate)
                            onRecurrenceRuleChanged(Gson().toJson(updated))
                            showUntilPicker = false
                        },
                        onDismiss = { showUntilPicker = false }
                    )
                }
            }

            // 12.9: Custom Recurrence Block — shown when "Custom…" selected
            if (showCustomBlock) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 22.dp, top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // 12.10: Custom interval: "Every [number] [unit]"
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Every",
                            fontSize = 13.sp,
                            fontFamily = LoraFontFamily,
                            color = LabelColor
                        )

                        // Number input: value 1, min 1, max 999, width 45dp
                        var intervalText by remember(parsedRule.interval) {
                            mutableStateOf(parsedRule.interval.toString())
                        }
                        androidx.compose.foundation.text.BasicTextField(
                            value = intervalText,
                            onValueChange = { newValue ->
                                // Only allow digits, max 3 chars
                                val filtered = newValue.filter { it.isDigit() }.take(3)
                                intervalText = filtered
                                val interval = filtered.toIntOrNull()?.coerceIn(1, 999) ?: 1
                                val updated = parsedRule.copy(interval = interval)
                                onRecurrenceRuleChanged(Gson().toJson(updated))
                            },
                            modifier = Modifier
                                .width(45.dp)
                                .heightIn(min = 34.dp)
                                .background(InputBg, RoundedCornerShape(3.dp))
                                .border(1.dp, InputBorder, RoundedCornerShape(3.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(
                                fontSize = 14.sp,
                                fontFamily = LoraFontFamily,
                                color = FieldText,
                                textAlign = TextAlign.Center
                            ),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )

                        // Unit dropdown: minutes, hours, days, weeks, months, years
                        val currentUnit = CustomRecurrenceUnit.entries.find {
                            it.value == parsedRule.freq.uppercase()
                        } ?: CustomRecurrenceUnit.WEEKS

                        Box {
                            Box(
                                modifier = Modifier
                                    .heightIn(min = 34.dp)
                                    .background(InputBg, RoundedCornerShape(3.dp))
                                    .border(1.dp, InputBorder, RoundedCornerShape(3.dp))
                                    .clickable { customUnitExpanded = true }
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                Text(
                                    text = currentUnit.label,
                                    fontSize = 14.sp,
                                    fontFamily = LoraFontFamily,
                                    color = FieldText
                                )
                            }
                            androidx.compose.material3.DropdownMenu(
                                expanded = customUnitExpanded,
                                onDismissRequest = { customUnitExpanded = false }
                            ) {
                                CustomRecurrenceUnit.entries.forEach { unit ->
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = unit.label,
                                                fontFamily = LoraFontFamily,
                                                fontSize = 14.sp
                                            )
                                        },
                                        onClick = {
                                            customUnitExpanded = false
                                            val updated = parsedRule.copy(
                                                freq = unit.value,
                                                // Clear byDay if switching away from weekly
                                                byDay = if (unit.value == "WEEKLY") parsedRule.byDay else null
                                            )
                                            onRecurrenceRuleChanged(Gson().toJson(updated))
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // 12.11: By-day checkboxes — shown when custom unit is "weeks" (WEEKLY)
                    // 12.12: Hidden when custom unit is not "weeks"
                    if (parsedRule.freq.uppercase() == "WEEKLY") {
                        // Container: margin-top 4dp, gap 4dp, flex-wrap
                        FlowRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            val selectedDays = parsedRule.byDay?.map { it.uppercase() }?.toSet() ?: emptySet()
                            RecurrenceDayOption.entries.forEach { day ->
                                val isSelected = day.code in selectedDays
                                // Each: checkbox + label, font-size 0.85em
                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = isSelected,
                                        onCheckedChange = { checked ->
                                            val newDays = if (checked) {
                                                selectedDays + day.code
                                            } else {
                                                selectedDays - day.code
                                            }
                                            val updated = parsedRule.copy(
                                                byDay = if (newDays.isEmpty()) null else newDays.toList()
                                            )
                                            onRecurrenceRuleChanged(Gson().toJson(updated))
                                        },
                                        modifier = Modifier.requiredSize(16.dp),
                                        colors = CheckboxDefaults.colors(checkedColor = InputBorder)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = day.label,
                                        fontSize = 13.sp, // 0.85em
                                        fontFamily = LoraFontFamily,
                                        color = LabelColor
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Builds habit-mode simplified frequency options.
 * 12.6: Just "Daily", "Weekly", "Monthly", "Yearly" without context.
 */
private fun buildHabitFreqOptions(): List<Pair<String, String>> {
    return listOf(
        "Daily" to "DAILY",
        "Weekly" to "WEEKLY",
        "Monthly" to "MONTHLY",
        "Yearly" to "YEARLY",
        "Custom…" to "CUSTOM"
    )
}

/**
 * Builds contextual frequency options based on the active date.
 * Returns list of (displayLabel, freqValue) pairs.
 *
 * 12.4: Options: Daily, "Weekly on [day]" (contextual), "Monthly on the [date]th" (contextual),
 *        "Yearly on [month] [date]th" (contextual), "Custom…"
 * 12.5: Labels update dynamically when active date changes.
 */
private fun buildContextualFreqOptions(activeDate: LocalDate?): List<Pair<String, String>> {
    if (activeDate == null) {
        return listOf(
            "Daily" to "DAILY",
            "Weekly" to "WEEKLY",
            "Monthly" to "MONTHLY",
            "Yearly" to "YEARLY",
            "Custom…" to "CUSTOM"
        )
    }
    val dayName = activeDate.dayOfWeek.getDisplayName(JavaTextStyle.FULL, Locale.getDefault())
    val dayOfMonth = activeDate.dayOfMonth
    val monthName = activeDate.month.getDisplayName(JavaTextStyle.FULL, Locale.getDefault())
    val ordinalSuffix = when {
        dayOfMonth in 11..13 -> "th"
        dayOfMonth % 10 == 1 -> "st"
        dayOfMonth % 10 == 2 -> "nd"
        dayOfMonth % 10 == 3 -> "rd"
        else -> "th"
    }

    return listOf(
        "Daily" to "DAILY",
        "Weekly on $dayName" to "WEEKLY",
        "Monthly on the $dayOfMonth$ordinalSuffix" to "MONTHLY",
        "Yearly on $monthName $dayOfMonth$ordinalSuffix" to "YEARLY",
        "Custom…" to "CUSTOM"
    )
}


// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Derives the current DateMode from field values.
 * Priority order matches the web's _detectDateMode:
 *   perpetual → due → start/end → pointInTime → none
 *
 * The web checks perpetual separately (window._chitIsPerpetual), then:
 *   hasDue → hasStart → hasPointInTime → none
 */
private fun deriveDateMode(
    startDatetime: String?,
    endDatetime: String?,
    dueDatetime: String?,
    pointInTime: String?,
    perpetual: Boolean
): DateMode {
    return when {
        perpetual -> DateMode.PERPETUAL
        dueDatetime != null -> DateMode.DUE
        startDatetime != null || endDatetime != null -> DateMode.START_END
        pointInTime != null -> DateMode.POINT_IN_TIME
        else -> DateMode.NONE
    }
}

/**
 * Applies a date mode change by clearing irrelevant fields.
 */
private fun applyDateMode(
    mode: DateMode,
    onStartDatetimeChange: (String?) -> Unit,
    onEndDatetimeChange: (String?) -> Unit,
    onDueDatetimeChange: (String?) -> Unit,
    onPointInTimeChange: (String?) -> Unit,
    onPerpetualChange: (Boolean) -> Unit
) {
    when (mode) {
        DateMode.START_END -> {
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
        }
        DateMode.DUE -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
        }
        DateMode.PERPETUAL -> {
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(true)
        }
        DateMode.POINT_IN_TIME -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPerpetualChange(false)
        }
        DateMode.NONE -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
        }
    }
}

/**
 * Parses an ISO datetime string into a LocalDateTime.
 */
private fun parseIsoDatetime(value: String?): LocalDateTime? {
    if (value.isNullOrBlank()) return null
    return try {
        Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDateTime()
    } catch (_: DateTimeParseException) {
        try { LocalDateTime.parse(value) }
        catch (_: DateTimeParseException) {
            try { LocalDate.parse(value).atStartOfDay() }
            catch (_: DateTimeParseException) { null }
        }
    }
}

/**
 * Formats a datetime value for date display in "YYYY-Mon-DD" format.
 * Matches the web's Flatpickr format exactly.
 */
private fun formatDateForDisplay(value: String?): String {
    val dt = parseIsoDatetime(value) ?: return ""
    val months = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    return "${dt.year}-${months[dt.monthValue - 1]}-${String.format("%02d", dt.dayOfMonth)}"
}

/**
 * Formats a datetime value for time display.
 * 24h: "14:30" (zero-padded)
 * 12h: "2:30 PM" (no leading zero on hour)
 */
private fun formatTimeForDisplay(value: String?, timeFormat: String): String {
    val dt = parseIsoDatetime(value) ?: return ""
    val hour = dt.hour
    val minute = dt.minute
    // Don't show time if it's midnight (likely all-day with no time set)
    if (hour == 0 && minute == 0) return ""

    return if (timeFormat == "24h") {
        String.format("%02d:%02d", hour, minute)
    } else {
        val h12 = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        val ampm = if (hour >= 12) "PM" else "AM"
        String.format("%d:%02d %s", h12, minute, ampm)
    }
}

/**
 * Gets the timezone abbreviation for display.
 * Falls back to the full IANA name if abbreviation is unavailable.
 */
private fun getTimezoneAbbr(tzId: String): String {
    return try {
        val tz = TimeZone.getTimeZone(tzId)
        val abbr = tz.getDisplayName(tz.useDaylightTime(), TimeZone.SHORT)
        // If the abbreviation is the same as the IANA ID (e.g., "GMT+05:30"),
        // it means no proper abbreviation exists — fall back to IANA name
        if (abbr.isNullOrBlank()) tzId else abbr
    } catch (_: Exception) {
        // Fallback: use the IANA name itself
        tzId
    }
}

/**
 * Gets the full timezone display name (e.g., "Mountain Standard Time").
 */
private fun getTimezoneFullName(tzId: String): String {
    return try {
        val tz = TimeZone.getTimeZone(tzId)
        tz.getDisplayName(tz.useDaylightTime(), TimeZone.LONG)
    } catch (_: Exception) { tzId }
}

private val ISO_LOCAL_DATETIME_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")

/**
 * Backward-compatible function for tests.
 * Formats a datetime value for display based on the user's time format preference.
 * Now uses the CWOC "YYYY-Mon-DD" date format.
 */
internal fun formatDatetimeForDisplay(value: String?, allDay: Boolean, timeFormat: String): String {
    if (value.isNullOrBlank()) return ""
    val dt = parseIsoDatetimeInternal(value) ?: return ""
    val dateStr = run {
        val months = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        "${dt.year}-${months[dt.monthValue - 1]}-${String.format("%02d", dt.dayOfMonth)}"
    }
    if (allDay) return dateStr
    val hour = dt.hour
    val minute = dt.minute
    val timeStr = if (timeFormat == "24h") {
        String.format("%02d:%02d", hour, minute)
    } else {
        val h12 = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        val ampm = if (hour >= 12) "PM" else "AM"
        String.format("%d:%02d %s", h12, minute, ampm)
    }
    return "$dateStr  $timeStr"
}

/**
 * Snaps a time to the nearest interval that is <= the original time.
 * Exposed as internal for tests.
 */
internal fun snapTime(time: LocalTime, snapMinutes: Int): LocalTime {
    if (snapMinutes <= 0 || snapMinutes > 60) return time
    val snappedMinute = (time.minute / snapMinutes) * snapMinutes
    return LocalTime.of(time.hour, snappedMinute)
}

/**
 * Snaps a minute value to the nearest interval that is <= the original.
 * Exposed as internal for tests.
 */
internal fun snapMinute(minute: Int, snapMinutes: Int): Int {
    if (snapMinutes <= 0 || snapMinutes > 60) return minute
    return (minute / snapMinutes) * snapMinutes
}

/**
 * Common IANA timezones — exposed as internal for tests.
 * The canonical list lives in TimezonePickerModal.kt.
 */
internal val COMMON_TIMEZONES: List<String> = listOf(
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
    "America/Toronto", "America/Vancouver", "America/Mexico_City",
    "America/Bogota", "America/Lima", "America/Sao_Paulo", "America/Buenos_Aires",
    "America/Santiago", "America/Halifax", "America/St_Johns",
    "Pacific/Auckland", "Pacific/Fiji", "Pacific/Guam",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
    "Europe/Rome", "Europe/Amsterdam", "Europe/Brussels", "Europe/Zurich",
    "Europe/Vienna", "Europe/Stockholm", "Europe/Oslo", "Europe/Helsinki",
    "Europe/Warsaw", "Europe/Prague", "Europe/Budapest", "Europe/Bucharest",
    "Europe/Athens", "Europe/Istanbul", "Europe/Moscow", "Europe/Kiev",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
    "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai",
    "Asia/Taipei", "Asia/Seoul", "Asia/Tokyo", "Asia/Jakarta",
    "Asia/Manila", "Asia/Riyadh", "Asia/Tehran", "Asia/Kabul",
    "Asia/Kathmandu", "Asia/Yangon", "Asia/Vladivostok",
    "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
    "Africa/Casablanca",
    "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
    "Australia/Perth", "Australia/Adelaide", "Australia/Darwin",
    "Indian/Maldives", "Atlantic/Reykjavik"
)

/**
 * Internal version of parseIsoDatetime for use by the backward-compat function.
 */
private fun parseIsoDatetimeInternal(value: String?): LocalDateTime? {
    if (value.isNullOrBlank()) return null
    return try {
        Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDateTime()
    } catch (_: DateTimeParseException) {
        try { LocalDateTime.parse(value) }
        catch (_: DateTimeParseException) {
            try { LocalDate.parse(value).atStartOfDay() }
            catch (_: DateTimeParseException) { null }
        }
    }
}

// ─── Default Notifications Auto-Populate (11.11) ─────────────────────────────

/**
 * Auto-populates default notifications for new chits when a date mode is first activated.
 * Matches the web's _applyDefaultNotifications behavior:
 * - Only fires once per mode (tracked by appliedModes set)
 * - Only fires if no notifications already exist on the chit
 * - Reads default_notifications from settings JSON
 * - For 'startend' mode: adds start-time defaults
 * - For 'due' mode: adds due-time defaults
 *
 * The settings JSON format is:
 * {"start": [{"value": 15, "unit": "minutes", "afterTarget": false}], "due": [...]}
 */
private fun applyDefaultNotifications(
    mode: DateMode,
    defaultNotifications: String?,
    alertsJson: String?,
    onAlertsChanged: ((String?) -> Unit)?,
    appliedModes: Set<DateMode>,
    onAppliedModesUpdate: (Set<DateMode>) -> Unit
) {
    if (onAlertsChanged == null) return
    if (mode in appliedModes) return
    if (defaultNotifications.isNullOrBlank()) return

    // Don't add defaults if notifications already exist
    if (!alertsJson.isNullOrBlank()) {
        try {
            val parsed = Gson().fromJson(alertsJson, Map::class.java) as? Map<*, *>
            val notifications = parsed?.get("notifications") as? List<*>
            if (notifications != null && notifications.isNotEmpty()) return
        } catch (_: Exception) {
            // If we can't parse, check if it's a non-empty array
            if (alertsJson.contains("\"notifications\"") && alertsJson.contains("\"value\"")) return
        }
    }

    try {
        val gson = Gson()
        val defaults = gson.fromJson(defaultNotifications, Map::class.java) as? Map<*, *> ?: return

        val toAdd = mutableListOf<Map<String, Any>>()

        when (mode) {
            DateMode.START_END -> {
                val startDefaults = defaults["start"] as? List<*>
                startDefaults?.forEach { item ->
                    val notif = item as? Map<*, *> ?: return@forEach
                    toAdd.add(mapOf(
                        "_type" to "notification",
                        "value" to (notif["value"] ?: 15),
                        "unit" to (notif["unit"] ?: "minutes"),
                        "afterTarget" to (notif["afterTarget"] ?: false),
                        "only_if_undone" to true,
                        "message" to ""
                    ))
                }
            }
            DateMode.DUE -> {
                val dueDefaults = defaults["due"] as? List<*>
                dueDefaults?.forEach { item ->
                    val notif = item as? Map<*, *> ?: return@forEach
                    toAdd.add(mapOf(
                        "_type" to "notification",
                        "value" to (notif["value"] ?: 15),
                        "unit" to (notif["unit"] ?: "minutes"),
                        "afterTarget" to (notif["afterTarget"] ?: false),
                        "only_if_undone" to true,
                        "message" to ""
                    ))
                }
            }
            else -> return
        }

        if (toAdd.isEmpty()) return

        // Mark this mode as applied
        onAppliedModesUpdate(appliedModes + mode)

        // Build the updated alerts JSON
        val currentAlerts = if (!alertsJson.isNullOrBlank()) {
            try {
                gson.fromJson(alertsJson, Map::class.java) as? MutableMap<String, Any>
                    ?: mutableMapOf()
            } catch (_: Exception) { mutableMapOf() }
        } else {
            mutableMapOf()
        }

        val existingNotifications = (currentAlerts["notifications"] as? MutableList<Any>) ?: mutableListOf()
        existingNotifications.addAll(toAdd)
        currentAlerts["notifications"] = existingNotifications

        // Ensure other alert types exist
        if (!currentAlerts.containsKey("alarms")) currentAlerts["alarms"] = emptyList<Any>()
        if (!currentAlerts.containsKey("timers")) currentAlerts["timers"] = emptyList<Any>()
        if (!currentAlerts.containsKey("stopwatches")) currentAlerts["stopwatches"] = emptyList<Any>()

        onAlertsChanged(gson.toJson(currentAlerts))
    } catch (_: Exception) {
        // Silently fail — don't break the date zone for notification defaults
    }
}
