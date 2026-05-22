package com.cwoc.app.domain.recurrence

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.cwoc.app.data.local.entity.ChitEntity
import java.time.LocalDate

/**
 * Result of evaluating rollover for a single habit chit.
 *
 * @param rolledOver Whether rollover actually occurred
 * @param updatedChit The chit with rolled-over state (same as input if no rollover)
 * @param snapshotEntry The new/updated exception entry added (null if no rollover)
 */
data class RolloverResult(
    val rolledOver: Boolean,
    val updatedChit: ChitEntity,
    val snapshotEntry: Map<String, Any?>? = null
)

/**
 * Client-side habit rollover detection and state mutation engine.
 *
 * Detects when a habit's current period has advanced past the last recorded period,
 * snapshots the current progress into recurrence_exceptions, and resets the counter.
 *
 * This engine is idempotent — calling it multiple times on the same chit in the same
 * session will not double-rollover (because after the first call, the exception entry
 * for the previous period date will already have habit_success, triggering rule "no rollover").
 *
 * Persistence (PATCH to server) is handled externally by the caller (Task 2.2).
 *
 * @param periodCalculator Injected HabitPeriodCalculator for computing period dates
 */
class HabitRolloverEngine(
    private val periodCalculator: HabitPeriodCalculator
) {

    private val gson = Gson()

    /**
     * Evaluate rollover for a single habit chit.
     *
     * Rules:
     * 1. No history (no entries with habit_success) → no rollover
     * 2. Most recent snapshot date >= previous period date → no rollover
     * 3. Most recent snapshot date < previous period date → snapshot + reset
     *
     * Also handles:
     * - Existing exception entry for previous period date without habit_success → augment it
     * - Existing exception entry for previous period date with habit_success → no rollover (AC 9)
     *
     * @param chit The habit chit to evaluate
     * @param weekStartDay The user's week_start_day setting
     * @param today Override for today's date (for testing)
     * @return RolloverResult with the (possibly updated) chit and rollover status
     */
    fun evaluateRollover(
        chit: ChitEntity,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): RolloverResult {
        // Only evaluate habits with a recurrence rule containing freq
        if (!chit.habit) return RolloverResult(rolledOver = false, updatedChit = chit)

        val rule = parseRecurrenceRule(chit.recurrenceRule)
            ?: return RolloverResult(rolledOver = false, updatedChit = chit)

        if (rule.freq.isBlank()) return RolloverResult(rolledOver = false, updatedChit = chit)

        // Compute previous period date
        val previousPeriodDate = periodCalculator.getPreviousPeriodDate(
            rule, chit.startDatetime, weekStartDay, today
        ) ?: return RolloverResult(rolledOver = false, updatedChit = chit)

        // Parse recurrence_exceptions
        val exceptions = parseExceptions(chit.recurrenceExceptions)

        // Find entries with habit_success defined (snapshots)
        val snapshotEntries = exceptions.filter { it.containsKey("habit_success") }

        // Rule 1: No history = no rollover
        if (snapshotEntries.isEmpty()) {
            return RolloverResult(rolledOver = false, updatedChit = chit)
        }

        // Check if an exception entry already exists for the previous period date
        val existingEntryForPrevPeriod = exceptions.find { entry ->
            (entry["date"] as? String) == previousPeriodDate
        }

        // AC 9: If exception entry exists for previous period date AND already has habit_success → no rollover
        if (existingEntryForPrevPeriod != null && existingEntryForPrevPeriod.containsKey("habit_success")) {
            return RolloverResult(rolledOver = false, updatedChit = chit)
        }

        // Find the most recent snapshot date
        val mostRecentSnapshotDate = snapshotEntries
            .mapNotNull { it["date"] as? String }
            .filter { it.isNotBlank() }
            .mapNotNull { dateStr ->
                try { LocalDate.parse(dateStr) } catch (_: Exception) { null }
            }
            .maxOrNull()

        // If no valid dates found among snapshots, treat as no history
        if (mostRecentSnapshotDate == null) {
            return RolloverResult(rolledOver = false, updatedChit = chit)
        }

        val previousPeriodLocalDate = try {
            LocalDate.parse(previousPeriodDate)
        } catch (_: Exception) {
            return RolloverResult(rolledOver = false, updatedChit = chit)
        }

        // Rule 2: Most recent snapshot date >= previous period date → no rollover
        if (!mostRecentSnapshotDate.isBefore(previousPeriodLocalDate)) {
            return RolloverResult(rolledOver = false, updatedChit = chit)
        }

        // Rule 3: Most recent snapshot date < previous period date → snapshot + reset
        return performRollover(chit, exceptions, existingEntryForPrevPeriod, previousPeriodDate)
    }

    /**
     * Perform the actual rollover: snapshot current progress and reset.
     */
    private fun performRollover(
        chit: ChitEntity,
        exceptions: List<MutableMap<String, Any?>>,
        existingEntryForPrevPeriod: MutableMap<String, Any?>?,
        previousPeriodDate: String
    ): RolloverResult {
        val currentSuccess = chit.habitSuccess ?: 0
        val currentGoal = chit.habitGoal ?: 1
        val completed = currentSuccess >= currentGoal

        // Build the snapshot fields
        val snapshotFields = mutableMapOf<String, Any?>(
            "habit_success" to currentSuccess,
            "habit_goal" to currentGoal,
            "completed" to completed
        )

        val updatedExceptions: List<MutableMap<String, Any?>>
        val snapshotEntry: Map<String, Any?>

        if (existingEntryForPrevPeriod != null) {
            // AC 8: Entry exists for previous period date but lacks habit_success → augment it
            existingEntryForPrevPeriod.putAll(snapshotFields)
            updatedExceptions = exceptions
            snapshotEntry = existingEntryForPrevPeriod.toMap()
        } else {
            // Create a new exception entry
            val newEntry = mutableMapOf<String, Any?>(
                "date" to previousPeriodDate
            )
            newEntry.putAll(snapshotFields)
            updatedExceptions = exceptions + newEntry
            snapshotEntry = newEntry.toMap()
        }

        // Serialize updated exceptions back to JSON
        val updatedExceptionsJson = gson.toJson(updatedExceptions)

        // Reset habit_success to 0, preserve habit_goal (AC 6)
        // If status is "Complete", clear to empty string (AC 7)
        val updatedStatus = if (chit.status == "Complete") "" else chit.status

        val updatedChit = chit.copy(
            habitSuccess = 0,
            status = updatedStatus,
            recurrenceExceptions = updatedExceptionsJson
        )

        return RolloverResult(
            rolledOver = true,
            updatedChit = updatedChit,
            snapshotEntry = snapshotEntry
        )
    }

    /**
     * Evaluate rollover for a list of habit chits.
     * Convenience method for batch processing (e.g., when habits view loads).
     *
     * @param chits List of chits to evaluate
     * @param weekStartDay The user's week_start_day setting
     * @param today Override for today's date (for testing)
     * @return List of RolloverResults in the same order as input
     */
    fun evaluateRolloverBatch(
        chits: List<ChitEntity>,
        weekStartDay: String? = null,
        today: LocalDate = LocalDate.now()
    ): List<RolloverResult> {
        return chits.map { chit -> evaluateRollover(chit, weekStartDay, today) }
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Parse recurrence_rule JSON string into a RecurrenceRule object.
     */
    private fun parseRecurrenceRule(json: String?): RecurrenceRule? {
        if (json.isNullOrBlank() || json == "null") return null
        return try {
            gson.fromJson(json, RecurrenceRule::class.java)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Parse recurrence_exceptions JSON string into a mutable list of mutable maps.
     * Using mutable maps so we can augment existing entries (AC 8).
     */
    private fun parseExceptions(json: String?): List<MutableMap<String, Any?>> {
        if (json.isNullOrBlank() || json == "null" || json == "[]") return emptyList()
        return try {
            val type = object : TypeToken<List<MutableMap<String, Any?>>>() {}.type
            gson.fromJson<List<MutableMap<String, Any?>>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }
}
