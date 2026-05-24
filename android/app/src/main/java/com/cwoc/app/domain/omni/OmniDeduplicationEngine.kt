package com.cwoc.app.domain.omni

import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.domain.recurrence.HabitPeriodCalculator
import com.cwoc.app.domain.recurrence.RecurrenceRule
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Result of deduplication — each chit appears in at most one section.
 * Mirrors the web's _omniDeduplicateChits() return structure exactly.
 */
data class DeduplicatedSections(
    val reminders: List<ChitEntity>,
    val email: List<ChitEntity>,
    val chrono: List<ChitEntity>,
    val onDeck: List<ChitEntity>,
    val soon: List<ChitEntity>,
    val pinnedNotes: List<ChitEntity>,
    val pinnedChecklists: List<ChitEntity>
)

/**
 * Pure utility object that assigns chits to Omni View sections in priority order,
 * ensuring no chit appears in more than one section.
 *
 * This is a line-for-line port of the web's _omniDeduplicateChits() function
 * from main-omni.js. The algorithm is:
 *
 *   0. Separate reminder chits (notification=true, not complete, not archived):
 *      - point_in_time is today → Reminders
 *      - pinned=true → Reminders (regardless of date)
 *   1. Separate email chits → email section only
 *   2. Categorize remaining into itinerary buckets:
 *      - Habits: due today → On Deck, active but not due today → Soon
 *      - Non-habits:
 *        - All-day events today → On Deck
 *        - Timed events today → Chrono Anchored
 *        - Due today with specific time → Chrono Anchored
 *        - Due today (no specific time) → On Deck
 *        - Due this week (not today) → Soon
 *   3. Track all chit IDs placed in steps 0-2
 *   4. For pinned chits NOT already placed:
 *      - Has checklist items → Pinned Checklists
 *      - Otherwise → Pinned Notes
 *   5. Each chit appears in exactly one section
 */
object OmniDeduplicationEngine {

    private val gson = Gson()
    private val habitPeriodCalculator = HabitPeriodCalculator()

    /**
     * Assigns chits into deduplicated sections. Each chit appears in at most one section.
     * This is a direct port of the web's _omniDeduplicateChits(filteredChits).
     *
     * @param filteredChits Pre-filtered chits (active, non-snoozed — equivalent to web's filteredChits).
     * @param allChits All non-deleted chits (used for email section which bypasses sidebar filters).
     * @param weekStartDay The user's week_start_day setting for habit period calculation.
     * @return [DeduplicatedSections] with each chit placed in at most one section.
     */
    fun deduplicate(
        filteredChits: List<ChitEntity>,
        allChits: List<ChitEntity>,
        weekStartDay: String? = null
    ): DeduplicatedSections {
        val reminders = mutableListOf<ChitEntity>()
        val email = mutableListOf<ChitEntity>()
        val chrono = mutableListOf<ChitEntity>()
        val onDeck = mutableListOf<ChitEntity>()
        val soon = mutableListOf<ChitEntity>()
        val pinnedNotes = mutableListOf<ChitEntity>()
        val pinnedChecklists = mutableListOf<ChitEntity>()

        val placedIds = mutableSetOf<String>()

        val now = LocalDateTime.now()
        val zone = ZoneId.systemDefault()
        val nowInstant = now.atZone(zone).toInstant()
        val today = now.toLocalDate()
        val todayStart = today.atStartOfDay(zone).toInstant()
        val todayEnd = today.plusDays(1).atStartOfDay(zone).toInstant().minusMillis(1)

        // End of week (7 days from today start)
        val weekEnd = today.plusDays(7)

        // ── Step 0: Separate reminder chits (today + all pinned reminders) ───────
        // Web: if (chit.notification && chit.status !== 'Complete' && !chit.archived)
        //      if (isToday || chit.pinned) → reminders
        filteredChits.forEach { chit ->
            if (chit.notification == true && chit.status != "Complete" && !chit.archived) {
                var isToday = false
                val pit = chit.pointInTime
                if (!pit.isNullOrBlank()) {
                    val pitDate = parseToLocalDate(pit, zone)
                    if (pitDate != null && pitDate == today) {
                        isToday = true
                    }
                }
                // Show if reminder is for today OR if it's pinned
                if (isToday || chit.pinned) {
                    reminders.add(chit)
                    placedIds.add(chit.id)
                }
            }
        }

        // ── Step 1: Separate email chits ────────────────────────────────────────
        // Web uses the GLOBAL chits array for emails — sidebar filters should not exclude emails
        allChits.forEach { chit ->
            if (!chit.emailMessageId.isNullOrBlank()) {
                email.add(chit)
                placedIds.add(chit.id)
            }
        }

        // ── Step 2: Categorize remaining into itinerary buckets ─────────────────

        // Process habits first (same logic as web's displayItineraryView)
        // Web: var habitChits = _originalChits.filter(c => c.habit === true && c.status !== 'Complete' && c.status !== 'Rejected')
        val habitChits = allChits.filter { c ->
            c.habit && c.status != "Complete" && c.status != "Rejected"
        }

        habitChits.forEach { chit ->
            if (chit.id in placedIds) return@forEach

            // Web: var goal = chit.habit_goal || 1;
            val goal = chit.habitGoal ?: 1
            // Web: var success = chit.habit_success || 0;
            val success = chit.habitSuccess ?: 0
            // Skip completed habits
            if (success >= goal) return@forEach

            // Calculate days left in cycle
            // Web: var rule = chit.recurrence_rule;
            //      var freq = (rule && rule.freq) ? rule.freq : 'DAILY';
            //      var interval = (rule && rule.interval) ? rule.interval : 1;
            val rule = parseRecurrenceRule(chit.recurrenceRule)
            val freq = rule?.freq?.uppercase() ?: "DAILY"
            val interval = (rule?.interval ?: 1).coerceAtLeast(1)

            // Web: var daysInCycle = 1;
            //      if (freq === 'DAILY') daysInCycle = 1 * interval;
            //      else if (freq === 'WEEKLY') daysInCycle = 7 * interval;
            //      else if (freq === 'MONTHLY') daysInCycle = 30 * interval;
            //      else if (freq === 'YEARLY') daysInCycle = 365 * interval;
            val daysInCycle = when (freq) {
                "DAILY" -> 1 * interval
                "WEEKLY" -> 7 * interval
                "MONTHLY" -> 30 * interval
                "YEARLY" -> 365 * interval
                else -> 1
            }

            // Web: var currentPeriod = (typeof getCurrentPeriodDate === 'function') ? getCurrentPeriodDate(chit) : null;
            val currentPeriod = habitPeriodCalculator.getCurrentPeriodDate(
                chit.recurrenceRule,
                chit.startDatetime,
                weekStartDay,
                today
            )

            // Web: var daysLeft = daysInCycle;
            //      if (currentPeriod) {
            //          var periodStart = new Date(currentPeriod + 'T00:00:00');
            //          var elapsed = Math.floor((today - periodStart) / 86400000);
            //          if (elapsed < 0) return; // Period hasn't started yet
            //          daysLeft = Math.max(0, daysInCycle - elapsed);
            //      }
            var daysLeft = daysInCycle
            if (currentPeriod.isNotBlank()) {
                val periodStart = try {
                    LocalDate.parse(currentPeriod, DateTimeFormatter.ISO_LOCAL_DATE)
                } catch (_: Exception) {
                    null
                }
                if (periodStart != null) {
                    val elapsed = ChronoUnit.DAYS.between(periodStart, today).toInt()
                    if (elapsed < 0) return@forEach // Period hasn't started yet
                    daysLeft = (daysInCycle - elapsed).coerceAtLeast(0)
                }
            }

            // Web: if (daysLeft <= 1) → On Deck
            //      else → Soon
            if (daysLeft <= 1) {
                onDeck.add(chit)
                placedIds.add(chit.id)
            } else {
                soon.add(chit)
                placedIds.add(chit.id)
            }
        }

        // Process non-habit chits (same logic as web's displayItineraryView)
        val seenChitIds = mutableSetOf<String>()
        seenChitIds.addAll(placedIds)
        // Pre-seed with habit IDs so they don't get double-processed
        habitChits.forEach { c -> seenChitIds.add(c.id) }

        filteredChits.forEach { chit ->
            if (chit.id in placedIds) return@forEach
            // Web: if (chit.habit) return;
            if (chit.habit) return@forEach
            // Web: if (chit.status === 'Complete') return;
            if (chit.status == "Complete") return@forEach
            // Web: if (chit.point_in_time && !chit.start_datetime && !chit.due_datetime) return;
            if (!chit.pointInTime.isNullOrBlank() && chit.startDatetime.isNullOrBlank() && chit.dueDatetime.isNullOrBlank()) return@forEach
            // Web: if (chit.email_message_id || chit.email_status) return;
            if (!chit.emailMessageId.isNullOrBlank() || !chit.emailStatus.isNullOrBlank()) return@forEach

            // Web: Skip virtual recurrence instances not matching today
            // (Android doesn't have virtual instances in the same way — skip this check)

            // Web: Skip non-recurring chits whose dates are entirely outside today/this week
            // if (!chit._isVirtual && !chit.recurrence_rule) { ... }
            if (chit.recurrenceRule.isNullOrBlank() || chit.recurrenceRule == "null") {
                val hasStart = !chit.startDatetime.isNullOrBlank()
                val hasDue = !chit.dueDatetime.isNullOrBlank()

                if (hasStart && !hasDue) {
                    val sd = parseToInstant(chit.startDatetime!!)
                    val ed = if (!chit.endDatetime.isNullOrBlank()) {
                        parseToInstant(chit.endDatetime!!)
                    } else {
                        sd?.plusMillis(3600000) // +1 hour default
                    }
                    if (ed != null && ed.isBefore(todayStart)) return@forEach
                }
                if (hasDue && !hasStart) {
                    val dd = parseToInstant(chit.dueDatetime!!)
                    if (dd != null && dd.isBefore(todayStart)) return@forEach
                }
                if (hasStart && hasDue) {
                    val sd2 = parseToInstant(chit.startDatetime!!)
                    val dd2 = parseToInstant(chit.dueDatetime!!)
                    if (sd2 != null && dd2 != null && sd2.isBefore(todayStart) && dd2.isBefore(todayStart)) return@forEach
                }
            }

            // Deduplicate by chit ID
            if (chit.id in seenChitIds) return@forEach
            seenChitIds.add(chit.id)

            val isAllDay = chit.allDay
            val hasStart = !chit.startDatetime.isNullOrBlank()
            val hasDue = !chit.dueDatetime.isNullOrBlank()
            val isTask = !chit.status.isNullOrBlank()

            // Web: All-day events today → On Deck
            if (isAllDay && hasStart) {
                val startInstant = parseToInstant(chit.startDatetime!!)
                val endInstant = if (!chit.endDatetime.isNullOrBlank()) {
                    parseToInstant(chit.endDatetime!!)
                } else {
                    startInstant
                }
                if (startInstant != null && endInstant != null) {
                    // Web: if (startDate <= todayEnd && endDate >= today)
                    if (!startInstant.isAfter(todayEnd) && !endInstant.isBefore(todayStart)) {
                        onDeck.add(chit)
                        placedIds.add(chit.id)
                        return@forEach
                    }
                }
            }

            // Web: Timed events today → Chrono Anchored
            if (hasStart && !isAllDay) {
                val startInstant = parseToInstant(chit.startDatetime!!)
                val endInstant = if (!chit.endDatetime.isNullOrBlank()) {
                    parseToInstant(chit.endDatetime!!)
                } else {
                    startInstant?.plusMillis(3600000) // +1 hour default
                }
                if (startInstant != null && endInstant != null) {
                    // Web: if (startDate <= todayEnd && endDate >= today)
                    if (!startInstant.isAfter(todayEnd) && !endInstant.isBefore(todayStart)) {
                        // Web: var eventIsPast = endDate <= now;
                        val eventIsPast = !endInstant.isAfter(nowInstant)
                        // Web: if (eventIsPast && !isTask) return; // Past non-task events hidden
                        if (eventIsPast && !isTask) return@forEach
                        chrono.add(chit)
                        placedIds.add(chit.id)
                        return@forEach
                    }
                }
            }

            // Web: Due today with a specific time → Chrono Anchored
            if (hasDue) {
                val dueInstant = parseToInstant(chit.dueDatetime!!)
                if (dueInstant != null) {
                    val dueLdt = dueInstant.atZone(zone).toLocalDateTime()
                    val dueHour = dueLdt.hour
                    val dueMin = dueLdt.minute
                    // Web: if ((dueHour > 0 || dueMin > 0) && dueDate >= today && dueDate <= todayEnd)
                    if ((dueHour > 0 || dueMin > 0) && !dueInstant.isBefore(todayStart) && !dueInstant.isAfter(todayEnd)) {
                        // Web: var dueIsPast = dueDate <= now;
                        val dueIsPast = !dueInstant.isAfter(nowInstant)
                        // Web: if (dueIsPast && !isTask) return;
                        if (dueIsPast && !isTask) return@forEach
                        chrono.add(chit)
                        placedIds.add(chit.id)
                        return@forEach
                    }
                }
            }

            // Web: Due today (no specific time) → On Deck
            if (hasDue) {
                val dueInstant = parseToInstant(chit.dueDatetime!!)
                if (dueInstant != null) {
                    val dueDate = dueInstant.atZone(zone).toLocalDate()
                    // Web: if (dueDate >= today && dueDate <= todayEnd)
                    if (dueDate == today) {
                        onDeck.add(chit)
                        placedIds.add(chit.id)
                        return@forEach
                    }
                    // Web: if (dueDate > todayEnd && dueDate <= weekEnd)
                    if (dueDate.isAfter(today) && !dueDate.isAfter(weekEnd)) {
                        soon.add(chit)
                        placedIds.add(chit.id)
                        return@forEach
                    }
                }
            }
        }

        // ── Step 3: Sort chrono and soon ────────────────────────────────────────
        // Web: result.chrono.sort(function(a, b) { return a.start - b.start; });
        val sortedChrono = chrono.sortedBy { it.startDatetime ?: it.dueDatetime }
        // Web: result.soon.sort by dueDate
        val sortedSoon = soon.sortedBy { it.dueDatetime ?: "9999-12-31" }

        // ── Step 4: Pinned chits NOT already placed ─────────────────────────────
        // Web: filteredChits.forEach(function(chit) {
        //          if (placedIds.has(chit.id)) return;
        //          if (!chit.pinned) return;
        //          if (chit.archived) return;
        //          ... check checklist ...
        //      });
        filteredChits.forEach { chit ->
            if (chit.id in placedIds) return@forEach
            if (!chit.pinned) return@forEach
            if (chit.archived) return@forEach

            // Web: var checklist = chit.checklist;
            //      if (typeof checklist === 'string') { try { checklist = JSON.parse(checklist); } ... }
            //      var hasChecklist = Array.isArray(checklist) && checklist.length > 0;
            val hasChecklist = hasNonEmptyChecklist(chit.checklist)

            if (hasChecklist) {
                pinnedChecklists.add(chit)
            } else {
                pinnedNotes.add(chit)
            }
            placedIds.add(chit.id)
        }

        return DeduplicatedSections(
            reminders = reminders,
            email = email,
            chrono = sortedChrono,
            onDeck = onDeck,
            soon = sortedSoon,
            pinnedNotes = pinnedNotes,
            pinnedChecklists = pinnedChecklists
        )
    }

    // ─── Private Helpers ────────────────────────────────────────────────────────

    /**
     * Parse a checklist JSON string and determine if it has items.
     * Mirrors web: JSON.parse(checklist) → Array.isArray && length > 0
     */
    private fun hasNonEmptyChecklist(checklistJson: String?): Boolean {
        if (checklistJson.isNullOrBlank() || checklistJson == "[]" || checklistJson == "null") return false
        return try {
            val type = object : TypeToken<List<Any>>() {}.type
            val list: List<Any> = gson.fromJson(checklistJson, type)
            list.isNotEmpty()
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Parse a recurrence rule JSON string into a RecurrenceRule object.
     */
    private fun parseRecurrenceRule(ruleJson: String?): RecurrenceRule? {
        if (ruleJson.isNullOrBlank() || ruleJson == "null") return null
        return try {
            gson.fromJson(ruleJson, RecurrenceRule::class.java)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseToLocalDate(dateStr: String, zone: ZoneId): LocalDate? {
        return try {
            val ldt = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ldt.toLocalDate()
        } catch (_: Exception) {
            try {
                LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            } catch (_: Exception) {
                try {
                    val instant = Instant.parse(dateStr)
                    instant.atZone(zone).toLocalDate()
                } catch (_: Exception) {
                    null
                }
            }
        }
    }

    private fun parseToInstant(dateStr: String): Instant? {
        return try {
            Instant.parse(dateStr)
        } catch (_: Exception) {
            try {
                val ldt = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                ldt.atZone(ZoneId.systemDefault()).toInstant()
            } catch (_: Exception) {
                try {
                    // Handle date-only strings like "2025-03-15"
                    val ld = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
                    ld.atStartOfDay(ZoneId.systemDefault()).toInstant()
                } catch (_: Exception) {
                    null
                }
            }
        }
    }
}
