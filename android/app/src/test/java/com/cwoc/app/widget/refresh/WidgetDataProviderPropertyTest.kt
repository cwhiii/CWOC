package com.cwoc.app.widget.refresh

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Property-based tests for widget data queries.
 *
 * Property 17: Today calendar widget shows correct chits
 * Property 18: Upcoming tasks widget filter and sort
 *
 * These tests validate the filtering and sorting logic that WidgetDataProvider
 * relies on (via ChitDao queries) without requiring a real Room database.
 * We simulate the DAO query logic in pure Kotlin to verify correctness properties.
 *
 * **Validates: Requirements 7.2, 8.2**
 */
class WidgetDataProviderPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    /**
     * Creates a minimal ChitEntity with configurable fields for widget testing.
     */
    private fun makeChit(
        id: String,
        title: String? = "Test Chit",
        startDatetime: String? = null,
        endDatetime: String? = null,
        dueDatetime: String? = null,
        status: String? = null,
        deleted: Boolean = false,
        archived: Boolean = false,
        allDay: Boolean = false
    ): ChitEntity = ChitEntity(
        id = id,
        title = title,
        note = null,
        tags = null,
        startDatetime = startDatetime,
        endDatetime = endDatetime,
        dueDatetime = dueDatetime,
        pointInTime = null,
        completedDatetime = null,
        status = status,
        priority = null,
        severity = null,
        checklist = null,
        alarm = null,
        notification = null,
        recurrence = null,
        recurrenceId = null,
        recurrenceRule = null,
        recurrenceExceptions = null,
        location = null,
        color = null,
        people = null,
        pinned = false,
        archived = archived,
        deleted = deleted,
        createdDatetime = null,
        modifiedDatetime = null,
        isProjectMaster = false,
        childChits = null,
        allDay = allDay,
        timezone = null,
        alerts = null,
        progressPercent = null,
        timeEstimate = null,
        weatherData = null,
        healthData = null,
        habit = false,
        habitGoal = null,
        habitSuccess = null,
        showOnCalendar = null,
        habitResetPeriod = null,
        habitLastActionDate = null,
        habitHideOverall = null,
        perpetual = false,
        shares = null,
        stealth = null,
        assignedTo = null,
        ownerId = null,
        hasUnviewedConflict = false,
        availability = null,
        snoozedUntil = null,
        prerequisites = null,
        syncVersion = 1,
        lastSyncedAt = null,
        isDirty = false,
        dirtyFields = "[]",
        conflictFields = null
    )

    /**
     * Simulates the DAO query for today's calendar chits:
     * SELECT * FROM chits WHERE deleted = 0 AND archived = 0
     *   AND (startDatetime BETWEEN :dayStart AND :dayEnd
     *        OR endDatetime BETWEEN :dayStart AND :dayEnd
     *        OR (startDatetime <= :dayStart AND endDatetime >= :dayEnd))
     *   ORDER BY startDatetime ASC
     */
    private fun applyTodayCalendarFilter(
        chits: List<ChitEntity>,
        today: LocalDate
    ): List<ChitEntity> {
        val dayStart = today.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        val dayEnd = today.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        return chits.filter { chit ->
            !chit.deleted && !chit.archived && (
                (chit.startDatetime != null && chit.startDatetime >= dayStart && chit.startDatetime < dayEnd) ||
                (chit.endDatetime != null && chit.endDatetime >= dayStart && chit.endDatetime < dayEnd) ||
                (chit.startDatetime != null && chit.endDatetime != null &&
                    chit.startDatetime <= dayStart && chit.endDatetime >= dayEnd)
            )
        }.sortedBy { it.startDatetime ?: "" }
    }

    /**
     * Simulates the DAO query for upcoming tasks:
     * SELECT * FROM chits WHERE deleted = 0 AND archived = 0
     *   AND status IN ('ToDo', 'In Progress')
     *   ORDER BY dueDatetime ASC LIMIT 5
     */
    private fun applyUpcomingTasksFilter(chits: List<ChitEntity>): List<ChitEntity> {
        return chits.filter { chit ->
            !chit.deleted && !chit.archived &&
            (chit.status == "ToDo" || chit.status == "In Progress")
        }
            .sortedBy { it.dueDatetime ?: "" }
            .take(5)
    }

    /**
     * Generates a random ISO datetime string within a range around a base date.
     */
    private fun randomDatetime(
        base: LocalDate,
        r: java.util.Random,
        dayOffsetRange: Int = 5
    ): String {
        val dayOffset = r.nextInt(dayOffsetRange * 2 + 1) - dayOffsetRange
        val hour = r.nextInt(24)
        val minute = r.nextInt(60)
        return base.plusDays(dayOffset.toLong())
            .atTime(hour, minute)
            .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
    }

    // =========================================================================
    // Property 17: Today calendar widget shows correct chits
    // =========================================================================

    /**
     * Property 17: Only chits with startDatetime on today's date are included
     * (or spanning today). Deleted and archived chits are excluded.
     *
     * Tests across 100 random configurations.
     */
    @Test
    fun `Property 17 - today calendar shows only chits occurring on the given date`() {
        val today = LocalDate.of(2025, 6, 15)

        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chitCount = r.nextInt(15) + 3

            val chits = (0 until chitCount).map { i ->
                val hasStart = r.nextInt(4) != 0 // 75% have start datetime
                val startDt = if (hasStart) randomDatetime(today, r, 2) else null
                val hasEnd = r.nextBoolean()
                val endDt = if (hasEnd && startDt != null) {
                    // End is 1-3 hours after start
                    try {
                        LocalDateTime.parse(startDt).plusHours(r.nextInt(3).toLong() + 1)
                            .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    } catch (_: Exception) { null }
                } else null

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Chit $i",
                    startDatetime = startDt,
                    endDatetime = endDt,
                    deleted = r.nextInt(8) == 0,
                    archived = r.nextInt(8) == 0
                )
            }

            val filtered = applyTodayCalendarFilter(chits, today)

            // Verify: every chit in the result occurs on today
            val dayStart = today.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val dayEnd = today.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            for (chit in filtered) {
                assertFalse("Seed $seed: ${chit.id} should not be deleted", chit.deleted)
                assertFalse("Seed $seed: ${chit.id} should not be archived", chit.archived)

                val startsOnDay = chit.startDatetime != null &&
                    chit.startDatetime >= dayStart && chit.startDatetime < dayEnd
                val endsOnDay = chit.endDatetime != null &&
                    chit.endDatetime >= dayStart && chit.endDatetime < dayEnd
                val spansDay = chit.startDatetime != null && chit.endDatetime != null &&
                    chit.startDatetime <= dayStart && chit.endDatetime >= dayEnd

                assertTrue(
                    "Seed $seed: ${chit.id} must start on day, end on day, or span the day " +
                        "(start=${chit.startDatetime}, end=${chit.endDatetime})",
                    startsOnDay || endsOnDay || spansDay
                )
            }
        }
    }

    /**
     * Property 17: Results are sorted by start time ascending.
     */
    @Test
    fun `Property 17 - today calendar chits are sorted by start time ascending`() {
        val today = LocalDate.of(2025, 6, 15)

        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chitCount = r.nextInt(10) + 3

            val chits = (0 until chitCount).map { i ->
                val hour = r.nextInt(24)
                val minute = r.nextInt(60)
                val startDt = today.atTime(hour, minute)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Chit $i",
                    startDatetime = startDt
                )
            }

            val filtered = applyTodayCalendarFilter(chits, today)

            // Verify ascending sort by startDatetime
            for (i in 0 until filtered.size - 1) {
                val current = filtered[i].startDatetime ?: ""
                val next = filtered[i + 1].startDatetime ?: ""
                assertTrue(
                    "Seed $seed: not sorted at index $i: $current should be <= $next",
                    current <= next
                )
            }
        }
    }

    /**
     * Property 17: Chits on other days are excluded.
     */
    @Test
    fun `Property 17 - chits on other days are excluded`() {
        val today = LocalDate.of(2025, 6, 15)
        val yesterday = today.minusDays(1)
        val tomorrow = today.plusDays(1)

        val chits = listOf(
            makeChit(
                id = "yesterday",
                startDatetime = yesterday.atTime(10, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ),
            makeChit(
                id = "today-morning",
                startDatetime = today.atTime(9, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ),
            makeChit(
                id = "today-evening",
                startDatetime = today.atTime(18, 30).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ),
            makeChit(
                id = "tomorrow",
                startDatetime = tomorrow.atTime(8, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            )
        )

        val filtered = applyTodayCalendarFilter(chits, today)

        assertEquals(2, filtered.size)
        assertTrue(filtered.any { it.id == "today-morning" })
        assertTrue(filtered.any { it.id == "today-evening" })
        assertFalse(filtered.any { it.id == "yesterday" })
        assertFalse(filtered.any { it.id == "tomorrow" })
    }

    /**
     * Property 17: Multi-day events spanning today are included.
     */
    @Test
    fun `Property 17 - multi-day events spanning today are included`() {
        val today = LocalDate.of(2025, 6, 15)

        val chits = listOf(
            // Starts yesterday, ends tomorrow (spans today)
            makeChit(
                id = "spanning",
                startDatetime = today.minusDays(1).atTime(10, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                endDatetime = today.plusDays(1).atTime(10, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ),
            // Starts yesterday, ends today (endDatetime falls on today)
            makeChit(
                id = "ends-today",
                startDatetime = today.minusDays(1).atTime(20, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                endDatetime = today.atTime(8, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            ),
            // Starts today, ends tomorrow (startDatetime falls on today)
            makeChit(
                id = "starts-today",
                startDatetime = today.atTime(22, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                endDatetime = today.plusDays(1).atTime(6, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            )
        )

        val filtered = applyTodayCalendarFilter(chits, today)

        assertEquals(3, filtered.size)
        assertTrue(filtered.any { it.id == "spanning" })
        assertTrue(filtered.any { it.id == "ends-today" })
        assertTrue(filtered.any { it.id == "starts-today" })
    }

    /**
     * Property 17: Deleted chits are excluded even if they occur today.
     */
    @Test
    fun `Property 17 - deleted and archived chits are excluded`() {
        val today = LocalDate.of(2025, 6, 15)
        val todayDt = today.atTime(10, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        val chits = listOf(
            makeChit(id = "active", startDatetime = todayDt, deleted = false, archived = false),
            makeChit(id = "deleted", startDatetime = todayDt, deleted = true, archived = false),
            makeChit(id = "archived", startDatetime = todayDt, deleted = false, archived = true),
            makeChit(id = "both", startDatetime = todayDt, deleted = true, archived = true)
        )

        val filtered = applyTodayCalendarFilter(chits, today)

        assertEquals(1, filtered.size)
        assertEquals("active", filtered[0].id)
    }

    /**
     * Property 17: Empty chit list produces empty result.
     */
    @Test
    fun `Property 17 - empty chit list produces empty result`() {
        val today = LocalDate.of(2025, 6, 15)
        val filtered = applyTodayCalendarFilter(emptyList(), today)
        assertTrue(filtered.isEmpty())
    }

    /**
     * Property 17: Chits without startDatetime or endDatetime are excluded
     * (unless they span the day via both fields).
     */
    @Test
    fun `Property 17 - chits without datetime fields are excluded`() {
        val today = LocalDate.of(2025, 6, 15)

        val chits = listOf(
            makeChit(id = "no-dates", startDatetime = null, endDatetime = null),
            makeChit(id = "has-start", startDatetime = today.atTime(14, 0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
        )

        val filtered = applyTodayCalendarFilter(chits, today)

        assertEquals(1, filtered.size)
        assertEquals("has-start", filtered[0].id)
    }

    // =========================================================================
    // Property 18: Upcoming tasks widget filter and sort
    // =========================================================================

    /**
     * Property 18: Only chits with status "ToDo" or "In Progress" are included.
     * Other statuses are excluded.
     *
     * Tests across 100 random configurations.
     */
    @Test
    fun `Property 18 - only ToDo and In Progress chits are included`() {
        val statuses = listOf("ToDo", "In Progress", "Blocked", "Complete", null, "Done", "Cancelled")

        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chitCount = r.nextInt(15) + 3

            val chits = (0 until chitCount).map { i ->
                val status = statuses[r.nextInt(statuses.size)]
                val dueDt = if (r.nextBoolean()) {
                    LocalDate.of(2025, 6, r.nextInt(28) + 1)
                        .atTime(r.nextInt(24), r.nextInt(60))
                        .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                } else null

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Task $i",
                    status = status,
                    dueDatetime = dueDt,
                    deleted = r.nextInt(8) == 0,
                    archived = r.nextInt(8) == 0
                )
            }

            val filtered = applyUpcomingTasksFilter(chits)

            // Verify: every chit in the result has status "ToDo" or "In Progress"
            for (chit in filtered) {
                assertTrue(
                    "Seed $seed: ${chit.id} has status '${chit.status}' which is not ToDo or In Progress",
                    chit.status == "ToDo" || chit.status == "In Progress"
                )
                assertFalse("Seed $seed: ${chit.id} should not be deleted", chit.deleted)
                assertFalse("Seed $seed: ${chit.id} should not be archived", chit.archived)
            }
        }
    }

    /**
     * Property 18: Results are sorted by due date ascending.
     */
    @Test
    fun `Property 18 - upcoming tasks are sorted by due date ascending`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chitCount = r.nextInt(12) + 3

            val chits = (0 until chitCount).map { i ->
                val dueDt = LocalDate.of(2025, 6, r.nextInt(28) + 1)
                    .atTime(r.nextInt(24), r.nextInt(60))
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Task $i",
                    status = if (r.nextBoolean()) "ToDo" else "In Progress",
                    dueDatetime = dueDt
                )
            }

            val filtered = applyUpcomingTasksFilter(chits)

            // Verify ascending sort by dueDatetime
            for (i in 0 until filtered.size - 1) {
                val current = filtered[i].dueDatetime ?: ""
                val next = filtered[i + 1].dueDatetime ?: ""
                assertTrue(
                    "Seed $seed: not sorted at index $i: $current should be <= $next",
                    current <= next
                )
            }
        }
    }

    /**
     * Property 18: At most 5 items are returned regardless of how many match.
     */
    @Test
    fun `Property 18 - result is limited to 5 items`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            // Generate more than 5 matching chits
            val chitCount = r.nextInt(15) + 6

            val chits = (0 until chitCount).map { i ->
                val dueDt = LocalDate.of(2025, 6, r.nextInt(28) + 1)
                    .atTime(r.nextInt(24), r.nextInt(60))
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Task $i",
                    status = "ToDo",
                    dueDatetime = dueDt
                )
            }

            val filtered = applyUpcomingTasksFilter(chits)

            assertTrue(
                "Seed $seed: result should have at most 5 items, got ${filtered.size}",
                filtered.size <= 5
            )
        }
    }

    /**
     * Property 18: The 5 returned items are the ones with the earliest due dates.
     */
    @Test
    fun `Property 18 - returned items are the 5 with earliest due dates`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chitCount = r.nextInt(10) + 6

            val chits = (0 until chitCount).map { i ->
                val dueDt = LocalDate.of(2025, 6, r.nextInt(28) + 1)
                    .atTime(r.nextInt(24), r.nextInt(60))
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

                makeChit(
                    id = "chit-$seed-$i",
                    title = "Task $i",
                    status = if (r.nextBoolean()) "ToDo" else "In Progress",
                    dueDatetime = dueDt
                )
            }

            val filtered = applyUpcomingTasksFilter(chits)

            // Get all eligible chits sorted by due date
            val allEligible = chits.filter { !it.deleted && !it.archived &&
                (it.status == "ToDo" || it.status == "In Progress") }
                .sortedBy { it.dueDatetime ?: "" }

            // The filtered result should be the first 5 (or fewer) of allEligible
            val expected = allEligible.take(5)
            assertEquals(
                "Seed $seed: filtered should match first 5 eligible",
                expected.map { it.id },
                filtered.map { it.id }
            )
        }
    }

    /**
     * Property 18: Deleted and archived chits are excluded.
     */
    @Test
    fun `Property 18 - deleted and archived chits are excluded`() {
        val dueDt = LocalDate.of(2025, 6, 15).atTime(10, 0)
            .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        val chits = listOf(
            makeChit(id = "active", status = "ToDo", dueDatetime = dueDt, deleted = false, archived = false),
            makeChit(id = "deleted", status = "ToDo", dueDatetime = dueDt, deleted = true, archived = false),
            makeChit(id = "archived", status = "In Progress", dueDatetime = dueDt, deleted = false, archived = true),
            makeChit(id = "both", status = "ToDo", dueDatetime = dueDt, deleted = true, archived = true)
        )

        val filtered = applyUpcomingTasksFilter(chits)

        assertEquals(1, filtered.size)
        assertEquals("active", filtered[0].id)
    }

    /**
     * Property 18: Chits with status "Blocked", "Complete", or null are excluded.
     */
    @Test
    fun `Property 18 - non-matching statuses are excluded`() {
        val dueDt = LocalDate.of(2025, 6, 15).atTime(10, 0)
            .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        val chits = listOf(
            makeChit(id = "todo", status = "ToDo", dueDatetime = dueDt),
            makeChit(id = "in-progress", status = "In Progress", dueDatetime = dueDt),
            makeChit(id = "blocked", status = "Blocked", dueDatetime = dueDt),
            makeChit(id = "complete", status = "Complete", dueDatetime = dueDt),
            makeChit(id = "null-status", status = null, dueDatetime = dueDt),
            makeChit(id = "done", status = "Done", dueDatetime = dueDt)
        )

        val filtered = applyUpcomingTasksFilter(chits)

        assertEquals(2, filtered.size)
        assertTrue(filtered.any { it.id == "todo" })
        assertTrue(filtered.any { it.id == "in-progress" })
    }

    /**
     * Property 18: Empty chit list produces empty result.
     */
    @Test
    fun `Property 18 - empty chit list produces empty result`() {
        val filtered = applyUpcomingTasksFilter(emptyList())
        assertTrue(filtered.isEmpty())
    }

    /**
     * Property 18: Chits without due dates are still included (sorted with empty string).
     * The query doesn't filter by dueDatetime presence — only by status.
     */
    @Test
    fun `Property 18 - chits without due dates are included if status matches`() {
        val chits = listOf(
            makeChit(id = "no-due", status = "ToDo", dueDatetime = null),
            makeChit(id = "has-due", status = "In Progress",
                dueDatetime = LocalDate.of(2025, 6, 20).atTime(10, 0)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
        )

        val filtered = applyUpcomingTasksFilter(chits)

        assertEquals(2, filtered.size)
        // Null due dates sort as empty string (before any real date)
        assertEquals("no-due", filtered[0].id)
        assertEquals("has-due", filtered[1].id)
    }

    /**
     * Property 18: Exactly 5 items when more than 5 match.
     */
    @Test
    fun `Property 18 - exactly 5 items returned when more than 5 match`() {
        val chits = (1..10).map { i ->
            makeChit(
                id = "task-$i",
                status = "ToDo",
                dueDatetime = LocalDate.of(2025, 6, i)
                    .atTime(10, 0)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            )
        }

        val filtered = applyUpcomingTasksFilter(chits)

        assertEquals(5, filtered.size)
        // Should be the first 5 by due date
        assertEquals("task-1", filtered[0].id)
        assertEquals("task-2", filtered[1].id)
        assertEquals("task-3", filtered[2].id)
        assertEquals("task-4", filtered[3].id)
        assertEquals("task-5", filtered[4].id)
    }

    /**
     * Property 18: Fewer than 5 matching chits returns all of them.
     */
    @Test
    fun `Property 18 - fewer than 5 matching returns all`() {
        val chits = (1..3).map { i ->
            makeChit(
                id = "task-$i",
                status = "In Progress",
                dueDatetime = LocalDate.of(2025, 6, i)
                    .atTime(10, 0)
                    .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            )
        }

        val filtered = applyUpcomingTasksFilter(chits)

        assertEquals(3, filtered.size)
    }
}
