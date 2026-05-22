package com.cwoc.app.domain.cron

/**
 * Cron expression utilities for the rule editor.
 * Provides human-readable description, assembly, and validation of 5-field cron expressions.
 *
 * Mirrors the web implementation in rule-editor.js (_describeCron, _assembleCronExpression, _validateCronExpression).
 */
object CronUtils {

    private val DAY_NAMES = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    private val MONTH_NAMES = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    )

    // ── Data classes ────────────────────────────────────────────────────────────

    data class CronValidationResult(
        val isValid: Boolean,
        val errors: List<CronFieldError>
    )

    data class CronFieldError(
        val field: String,  // "minute", "hour", "dayOfMonth", "month", "dayOfWeek"
        val message: String
    )

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Convert a 5-field cron expression to human-readable text.
     * Handles all special characters: * (every), , (list), - (range), / (step).
     *
     * @param expr A 5-field cron expression string (minute hour dom month dow)
     * @param timeFormat "12hour" for AM/PM display, "24hour" for 24-hour display
     * @return Human-readable description of the cron schedule
     */
    fun describe(expr: String, timeFormat: String = "12hour"): String {
        if (expr.isBlank()) return "Invalid cron expression"
        val fields = expr.trim().split(Regex("\\s+"))
        if (fields.size != 5) return "Invalid cron expression"

        val minF = fields[0]
        val hourF = fields[1]
        val domF = fields[2]
        val monF = fields[3]
        val dowF = fields[4]

        // Validate basic structure before describing
        val validation = validate(expr)
        if (!validation.isValid) return "Invalid cron expression"

        val parts = mutableListOf<String>()

        // Build time description
        val timePart = describeTime(minF, hourF, timeFormat)
        if (timePart.isNotEmpty()) parts.add(timePart)

        // Build day-of-month description
        val domPart = describeDom(domF)
        if (domPart.isNotEmpty()) parts.add(domPart)

        // Build month description
        val monPart = describeMonth(monF)
        if (monPart.isNotEmpty()) parts.add(monPart)

        // Build day-of-week description
        val dowPart = describeDow(dowF)
        if (dowPart.isNotEmpty()) parts.add(dowPart)

        return if (parts.isEmpty()) "Every minute" else parts.joinToString(", ")
    }

    /**
     * Validate a cron expression and return detailed field-specific errors.
     *
     * @param expr The cron expression to validate
     * @return CronValidationResult with isValid flag and list of field errors
     */
    fun validate(expr: String): CronValidationResult {
        if (expr.isBlank()) {
            return CronValidationResult(
                isValid = false,
                errors = listOf(CronFieldError("expression", "Cron expression cannot be empty"))
            )
        }

        val fields = expr.trim().split(Regex("\\s+"))
        if (fields.size != 5) {
            return CronValidationResult(
                isValid = false,
                errors = listOf(CronFieldError("expression", "Must have exactly 5 space-separated fields, found ${fields.size}"))
            )
        }

        val errors = mutableListOf<CronFieldError>()

        // Validate each field
        validateField(fields[0], "minute", 0, 59)?.let { errors.add(it) }
        validateField(fields[1], "hour", 0, 23)?.let { errors.add(it) }
        validateField(fields[2], "dayOfMonth", 1, 31)?.let { errors.add(it) }
        validateField(fields[3], "month", 1, 12)?.let { errors.add(it) }
        validateField(fields[4], "dayOfWeek", 0, 6)?.let { errors.add(it) }

        return CronValidationResult(
            isValid = errors.isEmpty(),
            errors = errors
        )
    }

    /**
     * Assemble a 5-field cron expression from individual field values.
     * Substitutes `*` for empty fields.
     *
     * @param minute Minute field (0-59, asterisk, step, ranges, lists)
     * @param hour Hour field (0-23, asterisk, step, ranges, lists)
     * @param dom Day of month field (1-31, asterisk, step, ranges, lists)
     * @param month Month field (1-12, asterisk, step, ranges, lists)
     * @param dow Day of week field (0-6, asterisk, step, ranges, lists)
     * @return Assembled cron expression string
     */
    fun assemble(minute: String, hour: String, dom: String, month: String, dow: String): String {
        val min = minute.trim().ifEmpty { "*" }
        val hr = hour.trim().ifEmpty { "*" }
        val d = dom.trim().ifEmpty { "*" }
        val mon = month.trim().ifEmpty { "*" }
        val dw = dow.trim().ifEmpty { "*" }
        return "$min $hr $d $mon $dw"
    }

    // ── Time description ────────────────────────────────────────────────────────

    private fun describeTime(minF: String, hourF: String, timeFormat: String): String {
        // Both wild: every minute
        if (isWild(minF) && isWild(hourF)) return "Every minute"

        // Step minutes with wild hour: */N * → "Every N minutes"
        if (minF.startsWith("*/") && isWild(hourF)) {
            val step = minF.substringAfter("/")
            return "Every $step minutes"
        }

        // Wild minute with step hour: * */N → "Every N hours"
        if (isWild(minF) && hourF.startsWith("*/")) {
            val step = hourF.substringAfter("/")
            return "Every $step hours"
        }

        // Single minute with wild hour: M * → "Every hour at minute M"
        if (isSingle(minF) && isWild(hourF)) {
            return "Every hour at minute $minF"
        }

        // Single minute with step hour: M */N → "Every N hours at minute M"
        if (isSingle(minF) && hourF.startsWith("*/")) {
            val step = hourF.substringAfter("/")
            return "Every $step hours at minute $minF"
        }

        // Single minute + single hour: specific time
        if (isSingle(minF) && isSingle(hourF)) {
            val h = hourF.toInt()
            val m = minF.toInt()
            return "At ${formatTime(h, m, timeFormat)}"
        }

        // Single minute + hour range: M H1-H2 → "At minute M, hours H1 through H2"
        if (isSingle(minF) && hourF.contains("-") && !hourF.contains("/") && !hourF.contains(",")) {
            val parts = hourF.split("-")
            if (parts.size == 2) {
                val h1 = parts[0].toIntOrNull()
                val h2 = parts[1].toIntOrNull()
                if (h1 != null && h2 != null) {
                    return "At minute $minF, ${formatTime(h1, 0, timeFormat).substringBefore(":")} through ${formatTime(h2, 0, timeFormat).substringBefore(":")}"
                }
            }
        }

        // Single minute + hour list: M H1,H2,H3 → "At minute M, at hours ..."
        if (isSingle(minF) && hourF.contains(",")) {
            val hours = hourF.split(",").mapNotNull { it.toIntOrNull() }
            if (hours.isNotEmpty()) {
                val m = minF.toInt()
                val timeList = hours.joinToString(", ") { formatTime(it, m, timeFormat) }
                return "At $timeList"
            }
        }

        // Minute list with single hour: M1,M2 H → "At H:M1, H:M2, ..."
        if (minF.contains(",") && isSingle(hourF)) {
            val minutes = minF.split(",").mapNotNull { it.toIntOrNull() }
            val h = hourF.toInt()
            if (minutes.isNotEmpty()) {
                val timeList = minutes.joinToString(", ") { formatTime(h, it, timeFormat) }
                return "At $timeList"
            }
        }

        // Minute range with single hour
        if (minF.contains("-") && !minF.contains("/") && !minF.contains(",") && isSingle(hourF)) {
            val parts = minF.split("-")
            if (parts.size == 2) {
                val h = hourF.toInt()
                return "Every minute from ${formatTime(h, parts[0].toIntOrNull() ?: 0, timeFormat)} through ${formatTime(h, parts[1].toIntOrNull() ?: 59, timeFormat)}"
            }
        }

        // Step minutes with single hour: M/S H → "Every S minutes starting at minute M during hour H"
        if (minF.contains("/") && isSingle(hourF)) {
            val stepParts = minF.split("/")
            val base = stepParts[0]
            val step = stepParts[1]
            val h = hourF.toInt()
            val hStr = formatTime(h, 0, timeFormat).replace(":00", "")
            return if (base == "*") {
                "Every $step minutes during the ${formatHourOnly(h, timeFormat)} hour"
            } else {
                "Every $step minutes starting at minute $base during the ${formatHourOnly(h, timeFormat)} hour"
            }
        }

        // Fallback for complex time patterns
        val minDesc = describeFieldValues(minF, "minute")
        val hourDesc = describeFieldValues(hourF, "hour")
        return "At $minDesc minutes past $hourDesc"
    }

    // ── Day-of-month description ────────────────────────────────────────────────

    private fun describeDom(domF: String): String {
        if (isWild(domF)) return ""

        if (isSingle(domF)) {
            return "on day $domF"
        }

        if (domF.contains(",")) {
            val days = domF.split(",").map { it.trim() }
            return "on days ${formatList(days)}"
        }

        if (domF.contains("-") && !domF.contains("/")) {
            val parts = domF.split("-")
            if (parts.size == 2) {
                return "on days ${parts[0]} through ${parts[1]}"
            }
        }

        if (domF.contains("/")) {
            val stepParts = domF.split("/")
            val base = stepParts[0]
            val step = stepParts[1]
            return if (base == "*") {
                "every $step days"
            } else {
                "every $step days starting on day $base"
            }
        }

        return "on day $domF"
    }

    // ── Month description ───────────────────────────────────────────────────────

    private fun describeMonth(monF: String): String {
        if (isWild(monF)) return ""

        if (isSingle(monF)) {
            val idx = monF.toIntOrNull()
            return if (idx != null && idx in 1..12) {
                "in ${MONTH_NAMES[idx - 1]}"
            } else {
                "in month $monF"
            }
        }

        if (monF.contains(",")) {
            val months = monF.split(",").map { it.trim() }
            val names = months.map { monthToName(it) }
            return "in ${formatList(names)}"
        }

        if (monF.contains("-") && !monF.contains("/")) {
            val parts = monF.split("-")
            if (parts.size == 2) {
                return "from ${monthToName(parts[0])} through ${monthToName(parts[1])}"
            }
        }

        if (monF.contains("/")) {
            val stepParts = monF.split("/")
            val step = stepParts[1]
            return "every $step months"
        }

        return "in month $monF"
    }

    // ── Day-of-week description ─────────────────────────────────────────────────

    private fun describeDow(dowF: String): String {
        if (isWild(dowF)) return ""

        val normalized = normalizeDow(dowF)

        // Check for common patterns
        if (normalized == "1-5") return "Monday through Friday"
        if (normalized == "0,6" || normalized == "6,0") return "Saturday and Sunday"

        if (isSingle(normalized)) {
            val idx = normalized.toIntOrNull()
            return if (idx != null && idx in 0..6) {
                "on ${DAY_NAMES[idx]}"
            } else {
                "on day-of-week $dowF"
            }
        }

        if (normalized.contains(",")) {
            val days = normalized.split(",").map { it.trim() }
            val names = days.map { dayToName(it) }
            return "on ${formatList(names)}"
        }

        if (normalized.contains("-") && !normalized.contains("/")) {
            val parts = normalized.split("-")
            if (parts.size == 2) {
                return "${dayToName(parts[0])} through ${dayToName(parts[1])}"
            }
        }

        if (normalized.contains("/")) {
            val stepParts = normalized.split("/")
            val step = stepParts[1]
            return "every $step days of the week"
        }

        return "on day-of-week $dowF"
    }

    // ── Field validation ────────────────────────────────────────────────────────

    private fun validateField(field: String, name: String, min: Int, max: Int): CronFieldError? {
        if (field == "*") return null

        // Valid characters check
        val validChars = Regex("^[0-9*\\-/,]+$")
        if (!field.matches(validChars)) {
            return CronFieldError(name, "Contains invalid characters. Only digits, *, -, /, and , are allowed")
        }

        // Handle comma-separated list
        if (field.contains(",")) {
            val parts = field.split(",")
            for (part in parts) {
                val error = validateSingleOrRange(part.trim(), name, min, max)
                if (error != null) return error
            }
            return null
        }

        return validateSingleOrRange(field, name, min, max)
    }

    private fun validateSingleOrRange(field: String, name: String, min: Int, max: Int): CronFieldError? {
        // Handle step: base/step
        if (field.contains("/")) {
            val parts = field.split("/")
            if (parts.size != 2) {
                return CronFieldError(name, "Invalid step format")
            }
            val base = parts[0]
            val step = parts[1]

            // Validate step divisor is a positive integer
            val stepVal = step.toIntOrNull()
            if (stepVal == null || stepVal <= 0) {
                return CronFieldError(name, "Step divisor must be a positive integer, got '$step'")
            }

            // Validate base (can be * or a range or a single value)
            if (base != "*") {
                if (base.contains("-")) {
                    return validateRange(base, name, min, max)
                }
                val baseVal = base.toIntOrNull()
                if (baseVal == null) {
                    return CronFieldError(name, "Invalid base value '$base' in step expression")
                }
                if (baseVal < min || baseVal > max) {
                    return CronFieldError(name, "Value $baseVal is out of range ($min-$max)")
                }
            }
            return null
        }

        // Handle range: start-end
        if (field.contains("-")) {
            return validateRange(field, name, min, max)
        }

        // Single value
        if (field == "*") return null
        val value = field.toIntOrNull()
        if (value == null) {
            return CronFieldError(name, "Invalid value '$field'. Must be a number between $min and $max")
        }
        if (value < min || value > max) {
            return CronFieldError(name, "Value $value is out of range ($min-$max)")
        }
        return null
    }

    private fun validateRange(field: String, name: String, min: Int, max: Int): CronFieldError? {
        val parts = field.split("-")
        if (parts.size != 2) {
            return CronFieldError(name, "Invalid range format '$field'")
        }
        val start = parts[0].toIntOrNull()
        val end = parts[1].toIntOrNull()
        if (start == null || end == null) {
            return CronFieldError(name, "Range values must be numbers in '$field'")
        }
        if (start < min || start > max) {
            return CronFieldError(name, "Range start $start is out of range ($min-$max)")
        }
        if (end < min || end > max) {
            return CronFieldError(name, "Range end $end is out of range ($min-$max)")
        }
        return null
    }

    // ── Internal helpers ────────────────────────────────────────────────────────

    private fun isWild(field: String): Boolean = field == "*"

    private fun isSingle(field: String): Boolean = field.matches(Regex("^\\d+$"))

    /**
     * Format time according to the specified format.
     */
    private fun formatTime(hour: Int, minute: Int, timeFormat: String): String {
        return if (timeFormat == "24hour") {
            val h = if (hour < 10) "0$hour" else "$hour"
            val m = if (minute < 10) "0$minute" else "$minute"
            "$h:$m"
        } else {
            val period = if (hour < 12) "AM" else "PM"
            var displayHour = hour % 12
            if (displayHour == 0) displayHour = 12
            val displayMinute = if (minute < 10) "0$minute" else "$minute"
            "$displayHour:$displayMinute $period"
        }
    }

    /**
     * Format just the hour for display (e.g., "9 AM" or "14").
     */
    private fun formatHourOnly(hour: Int, timeFormat: String): String {
        return if (timeFormat == "24hour") {
            "$hour:00"
        } else {
            val period = if (hour < 12) "AM" else "PM"
            var displayHour = hour % 12
            if (displayHour == 0) displayHour = 12
            "$displayHour $period"
        }
    }

    /**
     * Normalize day-of-week field by replacing day name abbreviations with numbers.
     */
    private fun normalizeDow(dow: String): String {
        return dow.uppercase()
            .replace("SUN", "0")
            .replace("MON", "1")
            .replace("TUE", "2")
            .replace("WED", "3")
            .replace("THU", "4")
            .replace("FRI", "5")
            .replace("SAT", "6")
    }

    /**
     * Convert a day number or abbreviation to its full name.
     */
    private fun dayToName(value: String): String {
        val idx = value.toIntOrNull()
        return if (idx != null && idx in 0..6) {
            DAY_NAMES[idx]
        } else {
            value
        }
    }

    /**
     * Convert a month number to its full name.
     */
    private fun monthToName(value: String): String {
        val idx = value.toIntOrNull()
        return if (idx != null && idx in 1..12) {
            MONTH_NAMES[idx - 1]
        } else {
            value
        }
    }

    /**
     * Format a list of items with commas and "and" before the last item.
     */
    private fun formatList(items: List<String>): String {
        return when (items.size) {
            0 -> ""
            1 -> items[0]
            2 -> "${items[0]} and ${items[1]}"
            else -> items.dropLast(1).joinToString(", ") + ", and " + items.last()
        }
    }

    /**
     * Describe raw field values for fallback descriptions.
     */
    private fun describeFieldValues(field: String, type: String): String {
        if (isWild(field)) return "every $type"
        return field
    }
}
