package com.cwoc.app.domain.omni

import com.cwoc.app.data.local.entity.ChitEntity
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
 * Priority order: Reminders → Email → Chrono → On Deck → Soon → Pinned Notes → Pinned Checklists
 *
 * Completed and archived chits are excluded before processing.
 */
object OmniDeduplicationEngine {

    private val gson = Gson()

    /**
     * Assigns [activeChits] into deduplicated sections. Each chit appears in at most one section.
     *
     * @param activeChits Pre-filtered chits (already excludes deleted, snoozed, RSVP-declined).
     * @param allChits All non-deleted chits (used for email section which has its own deleted/read filtering).
     * @param today The current date for date-range comparisons.
     * @param zone The timezone for date parsing.
     * @param now The current instant for time-based comparisons.
     * @return [DeduplicatedSections] with each chit placed in at most one section.
     */
    fun deduplicate(
        activeChits: List<ChitEntity>,
        allChits: List<ChitEntity>,
        today: LocalDate,
        zone: ZoneId,
        now: LocalDateTime
    ): DeduplicatedSections {
        val nowInstant = now.atZone(zone).toInstant()

        // Exclude completed and archived chits before processing
        val eligible = activeChits.filter { chit ->
            chit.status != "Complete" && !chit.archived
        }

        val placedIds = mutableSetOf<String>()

        // 1. Reminders — chits with alerts in the next 24 hours
        val reminders = filterReminders(eligible, nowInstant)
            .filter { it.id !in placedIds }
        placedIds.addAll(reminders.map { it.id })

        // 2. Email — unread inbox emails (uses allChits with its own filtering)
        val email = filterEmailChits(allChits)
            .filter { it.id !in placedIds }
        placedIds.addAll(email.map { it.id })

        // 3. Chrono — today's timed events
        val chrono = filterChronoAnchored(eligible, today, zone)
            .filter { it.id !in placedIds }
        placedIds.addAll(chrono.map { it.id })

        // 4. On Deck — next 5 tasks by due date
        val onDeck = filterOnDeck(eligible)
            .filter { it.id !in placedIds }
        placedIds.addAll(onDeck.map { it.id })

        // 5. Soon — tasks due within 7 days
        val soon = filterSoon(eligible, today, zone)
            .filter { it.id !in placedIds }
        placedIds.addAll(soon.map { it.id })

        // 6. Pinned Notes — pinned with note, no checklist
        val pinnedNotes = filterPinnedNotes(eligible)
            .filter { it.id !in placedIds }
        placedIds.addAll(pinnedNotes.map { it.id })

        // 7. Pinned Checklists — pinned with checklist
        val pinnedChecklists = filterPinnedChecklists(eligible)
            .filter { it.id !in placedIds }
        placedIds.addAll(pinnedChecklists.map { it.id })

        return DeduplicatedSections(
            reminders = reminders,
            email = email,
            chrono = chrono,
            onDeck = onDeck,
            soon = soon,
            pinnedNotes = pinnedNotes,
            pinnedChecklists = pinnedChecklists
        )
    }

    // ─── Section Filters (replicated from OmniViewViewModel) ────────────────

    /**
     * Reminders: chits with alerts in the next 24 hours.
     */
    private fun filterReminders(
        chits: List<ChitEntity>,
        now: Instant
    ): List<ChitEntity> {
        val next24h = now.plus(24, ChronoUnit.HOURS)

        return chits.filter { chit ->
            val alertsJson = chit.alerts ?: return@filter false
            if (alertsJson.isBlank() || alertsJson == "[]" || alertsJson == "null") return@filter false

            try {
                val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
                val alerts: List<Map<String, Any?>> = gson.fromJson(alertsJson, type)
                    ?: return@filter false

                alerts.any { alert ->
                    val absoluteTime = alert["absoluteTime"] as? String
                    val offsetMinutes = (alert["offsetMinutes"] as? Number)?.toInt()

                    when {
                        absoluteTime != null && absoluteTime.isNotBlank() -> {
                            val alertInstant = parseToInstant(absoluteTime)
                            alertInstant != null && alertInstant.isAfter(now) && alertInstant.isBefore(next24h)
                        }
                        offsetMinutes != null && chit.startDatetime != null -> {
                            val startInstant = parseToInstant(chit.startDatetime)
                            if (startInstant != null) {
                                val alertInstant = startInstant.minus(offsetMinutes.toLong(), ChronoUnit.MINUTES)
                                alertInstant.isAfter(now) && alertInstant.isBefore(next24h)
                            } else false
                        }
                        else -> false
                    }
                }
            } catch (_: Exception) {
                false
            }
        }.sortedBy { it.startDatetime ?: it.dueDatetime }
    }

    /**
     * Email: chits with emailMessageId, in Inbox, unread, sorted by date desc.
     */
    private fun filterEmailChits(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            !chit.deleted &&
                !chit.emailMessageId.isNullOrBlank() &&
                chit.emailRead != true &&
                (chit.emailFolder?.contains("Inbox", ignoreCase = true) == true ||
                    chit.tags?.any { it.equals("Inbox", ignoreCase = true) } == true)
        }.sortedByDescending { it.emailDate ?: it.createdDatetime }
    }

    /**
     * Chrono Anchored: today's timed events (has startDatetime today, not all-day).
     */
    private fun filterChronoAnchored(
        chits: List<ChitEntity>,
        today: LocalDate,
        zone: ZoneId
    ): List<ChitEntity> {
        return chits.filter { chit ->
            val startDt = chit.startDatetime ?: return@filter false
            if (chit.allDay) return@filter false
            val chitDate = parseToLocalDate(startDt, zone) ?: return@filter false
            chitDate == today
        }.sortedBy { it.startDatetime }
    }

    /**
     * On Deck: next 5 tasks by due date (status != Complete, has dueDatetime).
     */
    private fun filterOnDeck(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.status != null &&
                chit.status != "Complete" &&
                chit.dueDatetime != null
        }
            .sortedBy { it.dueDatetime }
            .take(5)
    }

    /**
     * Soon: tasks due within 7 days (status != Complete).
     */
    private fun filterSoon(
        chits: List<ChitEntity>,
        today: LocalDate,
        zone: ZoneId
    ): List<ChitEntity> {
        val sevenDaysFromNow = today.plusDays(7)

        return chits.filter { chit ->
            if (chit.status == null || chit.status == "Complete") return@filter false
            val dueDt = chit.dueDatetime ?: return@filter false
            val dueDate = parseToLocalDate(dueDt, zone) ?: return@filter false
            dueDate.isAfter(today) && !dueDate.isAfter(sevenDaysFromNow)
        }.sortedBy { it.dueDatetime }
    }

    /**
     * Pinned Notes: pinned=true, has note content, no checklist.
     */
    private fun filterPinnedNotes(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.pinned &&
                !chit.note.isNullOrBlank() &&
                (chit.checklist.isNullOrBlank() || chit.checklist == "[]" || chit.checklist == "null")
        }.sortedByDescending { it.modifiedDatetime }
    }

    /**
     * Pinned Checklists: pinned=true, has checklist content.
     */
    private fun filterPinnedChecklists(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            chit.pinned &&
                !chit.checklist.isNullOrBlank() &&
                chit.checklist != "[]" &&
                chit.checklist != "null"
        }.sortedByDescending { it.modifiedDatetime }
    }

    // ─── Date Parsing Helpers ───────────────────────────────────────────────

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
                null
            }
        }
    }
}
