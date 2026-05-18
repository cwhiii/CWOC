package com.cwoc.app.domain.sort

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for SortEngine.
 *
 * Property 17: Sort ordering correctness — for any non-empty list of chits and any sort field,
 * the sorted result in ascending order should have each element's sort key ≤ the next element's
 * sort key. Descending order should have each element's sort key ≥ the next. The sorted list
 * should contain exactly the same elements as the input.
 *
 * Property 6: List reorder preserves items — for any ordered list of chits and any sort operation,
 * the resulting list should contain exactly the same set of items with no additions or removals.
 *
 * **Validates: Requirements 10.2, 10.3, 10.5**
 */
class SortEngineTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val priorities = listOf("Critical", "High", "Medium", "Low", null)
    private val statuses = listOf("ToDo", "In Progress", "Blocked", "Complete", null)

    /**
     * Creates a ChitEntity with the given field values, defaulting everything else.
     */
    private fun makeChit(
        id: String = "chit-1",
        title: String? = "Test Chit",
        dueDatetime: String? = null,
        startDatetime: String? = null,
        createdDatetime: String? = null,
        modifiedDatetime: String? = null,
        priority: String? = null,
        status: String? = null
    ): ChitEntity = ChitEntity(
        id = id,
        title = title,
        note = null,
        tags = null,
        startDatetime = startDatetime,
        endDatetime = null,
        dueDatetime = dueDatetime,
        pointInTime = null,
        completedDatetime = null,
        status = status,
        priority = priority,
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
        archived = false,
        deleted = false,
        createdDatetime = createdDatetime,
        modifiedDatetime = modifiedDatetime,
        isProjectMaster = false,
        childChits = null,
        allDay = false,
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
        lastSyncedAt = null
    )

    /**
     * Generates a random list of chits with varied field values for property testing.
     */
    private fun generateRandomChits(seed: Int, size: Int): List<ChitEntity> {
        val r = java.util.Random(seed.toLong())
        return (0 until size).map { i ->
            makeChit(
                id = "chit-${seed}-${i}",
                title = if (r.nextInt(10) < 2) null else "Title_${r.nextInt(1000)}",
                dueDatetime = if (r.nextInt(10) < 3) null else "2024-${(r.nextInt(12) + 1).toString().padStart(2, '0')}-${(r.nextInt(28) + 1).toString().padStart(2, '0')}T${r.nextInt(24).toString().padStart(2, '0')}:00:00",
                startDatetime = if (r.nextInt(10) < 3) null else "2024-${(r.nextInt(12) + 1).toString().padStart(2, '0')}-${(r.nextInt(28) + 1).toString().padStart(2, '0')}T${r.nextInt(24).toString().padStart(2, '0')}:00:00",
                createdDatetime = "2024-01-${(r.nextInt(28) + 1).toString().padStart(2, '0')}T${r.nextInt(24).toString().padStart(2, '0')}:${r.nextInt(60).toString().padStart(2, '0')}:00",
                modifiedDatetime = "2024-06-${(r.nextInt(28) + 1).toString().padStart(2, '0')}T${r.nextInt(24).toString().padStart(2, '0')}:${r.nextInt(60).toString().padStart(2, '0')}:00",
                priority = priorities[r.nextInt(priorities.size)],
                status = statuses[r.nextInt(statuses.size)]
            )
        }
    }

    // =========================================================================
    // Property 17: Sort ordering correctness
    // =========================================================================
    //
    // For any non-empty list of chits and any sort field, the sorted result in
    // ascending order should have each element's sort key ≤ the next element's
    // sort key. Descending order should have each element's sort key ≥ the next.
    //
    // **Validates: Requirements 10.2, 10.3**

    /**
     * Property 17: ASC sort produces non-decreasing order for TITLE field.
     */
    @Test
    fun `Property 17 - ASC sort by title produces non-decreasing order`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.TITLE, SortDirection.ASC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].title
                val b = sorted[i + 1].title
                // Nulls sort last in ASC
                if (a != null && b != null) {
                    assertTrue(
                        "Seed $seed, index $i: '${a}' should be <= '${b}' (case-insensitive)",
                        a.compareTo(b, ignoreCase = true) <= 0
                    )
                } else if (a == null) {
                    // a is null means all remaining should also be null
                    // (nulls sort last)
                    // Actually b can be null too, that's fine
                    // But if a is null and b is not null, that's wrong
                    assertNull(
                        "Seed $seed, index $i: null should not appear before non-null in ASC",
                        // If a is null, b must also be null (since nulls are last)
                        // Actually this assertion is: if a is null, b should be null
                        b.takeIf { a == null && b != null }
                    )
                }
            }
        }
    }

    /**
     * Property 17: DESC sort by title produces non-increasing order.
     */
    @Test
    fun `Property 17 - DESC sort by title produces non-increasing order`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.TITLE, SortDirection.DESC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].title
                val b = sorted[i + 1].title
                // Nulls sort first in DESC
                if (a != null && b != null) {
                    assertTrue(
                        "Seed $seed, index $i: '${a}' should be >= '${b}' (case-insensitive) in DESC",
                        a.compareTo(b, ignoreCase = true) >= 0
                    )
                } else if (b == null && a != null) {
                    // In DESC, nulls sort first, so non-null after null is wrong
                    fail("Seed $seed, index $i: non-null '${a}' should not appear after null in DESC")
                }
            }
        }
    }

    /**
     * Property 17: ASC sort by DUE_DATE produces non-decreasing order.
     */
    @Test
    fun `Property 17 - ASC sort by due date produces non-decreasing order`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.DUE_DATE, SortDirection.ASC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].dueDatetime
                val b = sorted[i + 1].dueDatetime
                if (a != null && b != null) {
                    assertTrue(
                        "Seed $seed, index $i: '$a' should be <= '$b'",
                        a.compareTo(b, ignoreCase = true) <= 0
                    )
                } else if (a == null && b != null) {
                    fail("Seed $seed, index $i: null should not appear before non-null in ASC (nulls last)")
                }
            }
        }
    }

    /**
     * Property 17: DESC sort by DUE_DATE produces non-increasing order.
     */
    @Test
    fun `Property 17 - DESC sort by due date produces non-increasing order`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.DUE_DATE, SortDirection.DESC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].dueDatetime
                val b = sorted[i + 1].dueDatetime
                if (a != null && b != null) {
                    assertTrue(
                        "Seed $seed, index $i: '$a' should be >= '$b' in DESC",
                        a.compareTo(b, ignoreCase = true) >= 0
                    )
                } else if (b == null && a != null) {
                    fail("Seed $seed, index $i: non-null should not appear after null in DESC (nulls first)")
                }
            }
        }
    }

    /**
     * Property 17: Priority sort ASC produces Low → Medium → High → Critical order.
     */
    @Test
    fun `Property 17 - ASC sort by priority produces correct ordinal order`() {
        val priorityOrdinal = mapOf("Critical" to 4, "High" to 3, "Medium" to 2, "Low" to 1)

        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.PRIORITY, SortDirection.ASC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].priority
                val b = sorted[i + 1].priority
                if (a != null && b != null) {
                    val ordA = priorityOrdinal[a] ?: 0
                    val ordB = priorityOrdinal[b] ?: 0
                    assertTrue(
                        "Seed $seed, index $i: priority '$a' (ord=$ordA) should be <= '$b' (ord=$ordB) in ASC",
                        ordA <= ordB
                    )
                } else if (a == null && b != null) {
                    fail("Seed $seed, index $i: null priority should not appear before non-null in ASC")
                }
            }
        }
    }

    /**
     * Property 17: Priority sort DESC produces Critical → High → Medium → Low order.
     */
    @Test
    fun `Property 17 - DESC sort by priority produces correct ordinal order`() {
        val priorityOrdinal = mapOf("Critical" to 4, "High" to 3, "Medium" to 2, "Low" to 1)

        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.PRIORITY, SortDirection.DESC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].priority
                val b = sorted[i + 1].priority
                if (a != null && b != null) {
                    val ordA = priorityOrdinal[a] ?: 0
                    val ordB = priorityOrdinal[b] ?: 0
                    assertTrue(
                        "Seed $seed, index $i: priority '$a' (ord=$ordA) should be >= '$b' (ord=$ordB) in DESC",
                        ordA >= ordB
                    )
                } else if (b == null && a != null) {
                    fail("Seed $seed, index $i: non-null priority should not appear after null in DESC (nulls first)")
                }
            }
        }
    }

    /**
     * Property 17: Status sort ASC produces ToDo → In Progress → Blocked → Complete order.
     */
    @Test
    fun `Property 17 - ASC sort by status produces correct ordinal order`() {
        val statusOrdinal = mapOf("ToDo" to 1, "In Progress" to 2, "Blocked" to 3, "Complete" to 4)

        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)
            val sorted = SortEngine.sort(chits, SortField.STATUS, SortDirection.ASC)

            for (i in 0 until sorted.size - 1) {
                val a = sorted[i].status
                val b = sorted[i + 1].status
                if (a != null && b != null) {
                    val ordA = statusOrdinal[a] ?: 0
                    val ordB = statusOrdinal[b] ?: 0
                    assertTrue(
                        "Seed $seed, index $i: status '$a' (ord=$ordA) should be <= '$b' (ord=$ordB) in ASC",
                        ordA <= ordB
                    )
                } else if (a == null && b != null) {
                    fail("Seed $seed, index $i: null status should not appear before non-null in ASC")
                }
            }
        }
    }

    /**
     * Property 17: MANUAL sort preserves original order.
     */
    @Test
    fun `Property 17 - MANUAL sort preserves original order`() {
        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)

            val sortedAsc = SortEngine.sort(chits, SortField.MANUAL, SortDirection.ASC)
            val sortedDesc = SortEngine.sort(chits, SortField.MANUAL, SortDirection.DESC)

            assertEquals(
                "Seed $seed: MANUAL ASC should preserve original order",
                chits,
                sortedAsc
            )
            assertEquals(
                "Seed $seed: MANUAL DESC should preserve original order",
                chits,
                sortedDesc
            )
        }
    }

    /**
     * Property 17: Null handling — nulls sort last in ASC, first in DESC.
     */
    @Test
    fun `Property 17 - nulls sort last in ASC and first in DESC`() {
        val chitsWithNulls = listOf(
            makeChit(id = "1", title = null),
            makeChit(id = "2", title = "Banana"),
            makeChit(id = "3", title = null),
            makeChit(id = "4", title = "Apple"),
            makeChit(id = "5", title = "Cherry")
        )

        val sortedAsc = SortEngine.sort(chitsWithNulls, SortField.TITLE, SortDirection.ASC)
        // Non-null titles should come first, nulls last
        val nonNullCount = chitsWithNulls.count { it.title != null }
        for (i in 0 until nonNullCount) {
            assertNotNull("ASC: index $i should be non-null", sortedAsc[i].title)
        }
        for (i in nonNullCount until sortedAsc.size) {
            assertNull("ASC: index $i should be null", sortedAsc[i].title)
        }

        val sortedDesc = SortEngine.sort(chitsWithNulls, SortField.TITLE, SortDirection.DESC)
        // Nulls should come first in DESC
        val nullCount = chitsWithNulls.count { it.title == null }
        for (i in 0 until nullCount) {
            assertNull("DESC: index $i should be null", sortedDesc[i].title)
        }
        for (i in nullCount until sortedDesc.size) {
            assertNotNull("DESC: index $i should be non-null", sortedDesc[i].title)
        }
    }

    /**
     * Property 17: Sort by all date fields produces correct ordering.
     */
    @Test
    fun `Property 17 - sort by all date fields produces correct ordering`() {
        val dateFields = listOf(
            SortField.START_DATE,
            SortField.CREATED_DATE,
            SortField.MODIFIED_DATE
        )

        for (field in dateFields) {
            for (seed in 1..50) {
                val size = (seed % 8) + 2
                val chits = generateRandomChits(seed, size)
                val sorted = SortEngine.sort(chits, field, SortDirection.ASC)

                for (i in 0 until sorted.size - 1) {
                    val a = getDateField(sorted[i], field)
                    val b = getDateField(sorted[i + 1], field)
                    if (a != null && b != null) {
                        assertTrue(
                            "Field $field, Seed $seed, index $i: '$a' should be <= '$b'",
                            a.compareTo(b, ignoreCase = true) <= 0
                        )
                    } else if (a == null && b != null) {
                        fail("Field $field, Seed $seed, index $i: null should not appear before non-null in ASC")
                    }
                }
            }
        }
    }

    private fun getDateField(chit: ChitEntity, field: SortField): String? {
        return when (field) {
            SortField.START_DATE -> chit.startDatetime
            SortField.CREATED_DATE -> chit.createdDatetime
            SortField.MODIFIED_DATE -> chit.modifiedDatetime
            SortField.DUE_DATE -> chit.dueDatetime
            else -> null
        }
    }

    // =========================================================================
    // Property 6: List reorder preserves items
    // =========================================================================
    //
    // For any ordered list of chits and any sort operation, the resulting list
    // should contain exactly the same set of items with no additions or removals.
    //
    // **Validates: Requirements 10.5**

    /**
     * Property 6: Sort preserves all items — same set, no duplicates, no losses.
     *
     * Tests across all sort fields and both directions with 100 random inputs.
     */
    @Test
    fun `Property 6 - sort preserves all items for all fields and directions`() {
        val allFields = SortField.values()
        val allDirections = SortDirection.values()

        for (seed in 1..100) {
            val size = (seed % 10) + 2
            val chits = generateRandomChits(seed, size)

            for (field in allFields) {
                for (direction in allDirections) {
                    val sorted = SortEngine.sort(chits, field, direction)

                    // Same size
                    assertEquals(
                        "Seed $seed, $field $direction: sorted list should have same size",
                        chits.size,
                        sorted.size
                    )

                    // Same items by ID (no duplicates, no losses)
                    val originalIds = chits.map { it.id }.toSet()
                    val sortedIds = sorted.map { it.id }.toSet()
                    assertEquals(
                        "Seed $seed, $field $direction: sorted list should contain same IDs",
                        originalIds,
                        sortedIds
                    )

                    // Same items by content (sorted by ID for comparison)
                    val originalSorted = chits.sortedBy { it.id }
                    val resultSorted = sorted.sortedBy { it.id }
                    assertEquals(
                        "Seed $seed, $field $direction: sorted list should contain exactly the same items",
                        originalSorted,
                        resultSorted
                    )
                }
            }
        }
    }

    /**
     * Property 6: Sort of empty list returns empty list.
     */
    @Test
    fun `Property 6 - sort of empty list returns empty list`() {
        val empty = emptyList<ChitEntity>()

        for (field in SortField.values()) {
            for (direction in SortDirection.values()) {
                val result = SortEngine.sort(empty, field, direction)
                assertTrue(
                    "$field $direction: sorting empty list should return empty",
                    result.isEmpty()
                )
            }
        }
    }

    /**
     * Property 6: Sort of single-item list returns same single item.
     */
    @Test
    fun `Property 6 - sort of single item list returns same item`() {
        val single = listOf(makeChit(id = "only-one", title = "Solo"))

        for (field in SortField.values()) {
            for (direction in SortDirection.values()) {
                val result = SortEngine.sort(single, field, direction)
                assertEquals(
                    "$field $direction: sorting single-item list should return same item",
                    single,
                    result
                )
            }
        }
    }

    /**
     * Property 6: Sort does not mutate the original list.
     */
    @Test
    fun `Property 6 - sort does not mutate original list`() {
        for (seed in 1..50) {
            val size = (seed % 8) + 2
            val chits = generateRandomChits(seed, size)
            val originalCopy = chits.toList()

            SortEngine.sort(chits, SortField.TITLE, SortDirection.ASC)
            SortEngine.sort(chits, SortField.PRIORITY, SortDirection.DESC)
            SortEngine.sort(chits, SortField.DUE_DATE, SortDirection.ASC)

            assertEquals(
                "Seed $seed: original list should not be mutated by sort",
                originalCopy,
                chits
            )
        }
    }

    /**
     * Property 6: Sort with duplicate values preserves all items.
     */
    @Test
    fun `Property 6 - sort with duplicate field values preserves all items`() {
        // Create chits with duplicate priorities
        val chits = listOf(
            makeChit(id = "1", priority = "High", title = "Alpha"),
            makeChit(id = "2", priority = "High", title = "Beta"),
            makeChit(id = "3", priority = "Low", title = "Gamma"),
            makeChit(id = "4", priority = "High", title = "Delta"),
            makeChit(id = "5", priority = "Low", title = "Epsilon")
        )

        val sorted = SortEngine.sort(chits, SortField.PRIORITY, SortDirection.ASC)

        assertEquals("Same size after sort", chits.size, sorted.size)
        assertEquals(
            "Same IDs after sort",
            chits.map { it.id }.toSet(),
            sorted.map { it.id }.toSet()
        )
    }

    /**
     * Property 6: Sort with all-null field values preserves all items.
     */
    @Test
    fun `Property 6 - sort with all null values preserves all items`() {
        val chits = (1..5).map { makeChit(id = "chit-$it", dueDatetime = null) }

        val sorted = SortEngine.sort(chits, SortField.DUE_DATE, SortDirection.ASC)

        assertEquals("Same size", chits.size, sorted.size)
        assertEquals(
            "Same IDs",
            chits.map { it.id }.toSet(),
            sorted.map { it.id }.toSet()
        )
    }
}
