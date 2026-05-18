package com.cwoc.app.domain.filter

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Property-based tests for FilterEngine.
 *
 * Property 15: Filter predicate correctness
 * Property 16: Tag filter match modes
 *
 * **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**
 */
class FilterEngineTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    private val statusPool = listOf("ToDo", "In Progress", "Blocked", "Complete")
    private val priorityPool = listOf("Critical", "High", "Medium", "Low")
    private val tagPool = listOf(
        "Work", "Personal", "Urgent", "Home", "Health",
        "Finance", "Travel", "Shopping", "Project-A", "Project-B"
    )
    private val peoplePool = listOf(
        "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"
    )

    /**
     * Creates a minimal ChitEntity with specified fields for filter testing.
     */
    private fun makeChit(
        id: String = "chit-${random.nextInt(100000)}",
        title: String? = null,
        status: String? = null,
        priority: String? = null,
        tags: List<String>? = null,
        people: List<String>? = null,
        pinned: Boolean = false,
        archived: Boolean = false,
        deleted: Boolean = false,
        dueDatetime: String? = null,
        snoozedUntil: String? = null
    ): ChitEntity = ChitEntity(
        id = id,
        title = title,
        note = null,
        tags = tags,
        startDatetime = null,
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
        people = people,
        pinned = pinned,
        archived = archived,
        deleted = deleted,
        createdDatetime = null,
        modifiedDatetime = null,
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
        snoozedUntil = snoozedUntil,
        prerequisites = null,
        syncVersion = 0,
        lastSyncedAt = null,
        isDirty = false,
        dirtyFields = "[]"
    )


    // =========================================================================
    // Property 15: Filter predicate correctness
    // =========================================================================
    //
    // For any set of chits and any filter state (selected statuses, priorities,
    // people, archive/pinned/snoozed toggles, past-due toggle), the filtered
    // result should contain exactly those chits that satisfy all active filter
    // predicates simultaneously. A chit passes a multi-value filter (status,
    // priority, people) if its value is in the selected set (or the set is empty,
    // meaning "any").
    //
    // **Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7**

    @Test
    fun `Property 15 - empty filter state passes all chits through`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val chits = (1..r.nextInt(10) + 1).map {
                makeChit(
                    id = "chit-$seed-$it",
                    status = statusPool[r.nextInt(statusPool.size)],
                    priority = priorityPool[r.nextInt(priorityPool.size)],
                    tags = listOf(tagPool[r.nextInt(tagPool.size)]),
                    people = listOf(peoplePool[r.nextInt(peoplePool.size)])
                )
            }

            val emptyFilter = FilterState()
            val result = FilterEngine.applyFilters(chits, emptyFilter)

            assertEquals(
                "Seed $seed: empty filter should pass all chits through",
                chits.size,
                result.size
            )
            assertEquals(
                "Seed $seed: empty filter should return same chits",
                chits.map { it.id }.toSet(),
                result.map { it.id }.toSet()
            )
        }
    }

    @Test
    fun `Property 15 - status filter includes only chits with matching status`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            // Pick 1-2 statuses to filter on
            val selectedStatuses = statusPool.shuffled(r).take(r.nextInt(2) + 1).toSet()

            val chits = statusPool.mapIndexed { idx, status ->
                makeChit(id = "status-$seed-$idx", status = status)
            } + listOf(makeChit(id = "null-status-$seed", status = null))

            val filter = FilterState(statuses = selectedStatuses)
            val result = FilterEngine.applyFilters(chits, filter)

            // Every result must have a status in the selected set
            for (chit in result) {
                assertTrue(
                    "Seed $seed: chit ${chit.id} with status '${chit.status}' should be in $selectedStatuses",
                    chit.status in selectedStatuses
                )
            }

            // Every chit NOT in result must have a status NOT in the selected set (or null)
            val resultIds = result.map { it.id }.toSet()
            for (chit in chits) {
                if (chit.id !in resultIds) {
                    assertTrue(
                        "Seed $seed: excluded chit ${chit.id} with status '${chit.status}' should NOT be in $selectedStatuses",
                        chit.status == null || chit.status !in selectedStatuses
                    )
                }
            }
        }
    }

    @Test
    fun `Property 15 - priority filter includes only chits with matching priority`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            val selectedPriorities = priorityPool.shuffled(r).take(r.nextInt(2) + 1).toSet()

            val chits = priorityPool.mapIndexed { idx, priority ->
                makeChit(id = "priority-$seed-$idx", priority = priority)
            } + listOf(makeChit(id = "null-priority-$seed", priority = null))

            val filter = FilterState(priorities = selectedPriorities)
            val result = FilterEngine.applyFilters(chits, filter)

            for (chit in result) {
                assertTrue(
                    "Seed $seed: chit ${chit.id} with priority '${chit.priority}' should be in $selectedPriorities",
                    chit.priority in selectedPriorities
                )
            }

            val resultIds = result.map { it.id }.toSet()
            for (chit in chits) {
                if (chit.id !in resultIds) {
                    assertTrue(
                        "Seed $seed: excluded chit ${chit.id} with priority '${chit.priority}' should NOT be in $selectedPriorities",
                        chit.priority == null || chit.priority !in selectedPriorities
                    )
                }
            }
        }
    }

    @Test
    fun `Property 15 - people filter includes only chits with at least one matching person`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            val selectedPeople = peoplePool.shuffled(r).take(r.nextInt(3) + 1).toSet()

            val chits = listOf(
                makeChit(id = "match-$seed", people = listOf(selectedPeople.first())),
                makeChit(id = "nomatch-$seed", people = listOf("Zara", "Xavier")),
                makeChit(id = "null-$seed", people = null),
                makeChit(id = "empty-$seed", people = emptyList()),
                makeChit(id = "multi-$seed", people = listOf("Zara", selectedPeople.first()))
            )

            val filter = FilterState(people = selectedPeople)
            val result = FilterEngine.applyFilters(chits, filter)

            for (chit in result) {
                val chitPeople = chit.people ?: emptyList()
                assertTrue(
                    "Seed $seed: chit ${chit.id} with people $chitPeople should have overlap with $selectedPeople",
                    chitPeople.any { it in selectedPeople }
                )
            }

            val resultIds = result.map { it.id }.toSet()
            for (chit in chits) {
                if (chit.id !in resultIds) {
                    val chitPeople = chit.people ?: emptyList()
                    assertTrue(
                        "Seed $seed: excluded chit ${chit.id} with people $chitPeople should have NO overlap with $selectedPeople",
                        chitPeople.none { it in selectedPeople }
                    )
                }
            }
        }
    }


    @Test
    fun `Property 15 - archived toggle excludes archived chits when false`() {
        for (seed in 1..50) {
            val chits = listOf(
                makeChit(id = "active-$seed", archived = false),
                makeChit(id = "archived-$seed", archived = true)
            )

            // showArchived = false (default) should exclude archived
            val filterHide = FilterState(showArchived = false)
            val resultHide = FilterEngine.applyFilters(chits, filterHide)

            assertTrue(
                "Seed $seed: archived chit should be excluded when showArchived=false",
                resultHide.none { it.archived }
            )

            // showArchived = true should include archived
            val filterShow = FilterState(showArchived = true)
            val resultShow = FilterEngine.applyFilters(chits, filterShow)

            assertEquals(
                "Seed $seed: all chits should pass when showArchived=true",
                chits.size,
                resultShow.size
            )
        }
    }

    @Test
    fun `Property 15 - pinned toggle excludes pinned chits when false`() {
        for (seed in 1..50) {
            val chits = listOf(
                makeChit(id = "unpinned-$seed", pinned = false),
                makeChit(id = "pinned-$seed", pinned = true)
            )

            // showPinned = false should exclude pinned
            val filterHide = FilterState(showPinned = false)
            val resultHide = FilterEngine.applyFilters(chits, filterHide)

            assertTrue(
                "Seed $seed: pinned chit should be excluded when showPinned=false",
                resultHide.none { it.pinned }
            )

            // showPinned = true (default) should include pinned
            val filterShow = FilterState(showPinned = true)
            val resultShow = FilterEngine.applyFilters(chits, filterShow)

            assertEquals(
                "Seed $seed: all chits should pass when showPinned=true",
                chits.size,
                resultShow.size
            )
        }
    }

    @Test
    fun `Property 15 - snoozed toggle excludes snoozed chits when false`() {
        val futureTime = Instant.now().plus(1, ChronoUnit.HOURS).toString()
        val pastTime = Instant.now().minus(1, ChronoUnit.HOURS).toString()

        for (seed in 1..50) {
            val chits = listOf(
                makeChit(id = "not-snoozed-$seed", snoozedUntil = null),
                makeChit(id = "snoozed-future-$seed", snoozedUntil = futureTime),
                makeChit(id = "snoozed-past-$seed", snoozedUntil = pastTime)
            )

            // showSnoozed = false (default) should exclude actively snoozed (future)
            val filterHide = FilterState(showSnoozed = false)
            val resultHide = FilterEngine.applyFilters(chits, filterHide)

            assertTrue(
                "Seed $seed: actively snoozed chit should be excluded when showSnoozed=false",
                resultHide.none { it.id == "snoozed-future-$seed" }
            )
            // Past-snoozed should still be included (snooze expired)
            assertTrue(
                "Seed $seed: past-snoozed chit should be included (snooze expired)",
                resultHide.any { it.id == "snoozed-past-$seed" }
            )

            // showSnoozed = true should include all
            val filterShow = FilterState(showSnoozed = true)
            val resultShow = FilterEngine.applyFilters(chits, filterShow)

            assertEquals(
                "Seed $seed: all chits should pass when showSnoozed=true",
                chits.size,
                resultShow.size
            )
        }
    }

    @Test
    fun `Property 15 - past-due toggle excludes past-due chits when false`() {
        val pastDue = Instant.now().minus(2, ChronoUnit.DAYS).toString()
        val futureDue = Instant.now().plus(2, ChronoUnit.DAYS).toString()

        for (seed in 1..50) {
            val chits = listOf(
                makeChit(id = "no-due-$seed", dueDatetime = null),
                makeChit(id = "past-due-$seed", dueDatetime = pastDue),
                makeChit(id = "future-due-$seed", dueDatetime = futureDue)
            )

            // showPastDue = false should exclude past-due chits
            val filterHide = FilterState(showPastDue = false)
            val resultHide = FilterEngine.applyFilters(chits, filterHide)

            assertTrue(
                "Seed $seed: past-due chit should be excluded when showPastDue=false",
                resultHide.none { it.id == "past-due-$seed" }
            )
            // Future-due and no-due should still be included
            assertTrue(
                "Seed $seed: future-due chit should be included",
                resultHide.any { it.id == "future-due-$seed" }
            )
            assertTrue(
                "Seed $seed: no-due chit should be included",
                resultHide.any { it.id == "no-due-$seed" }
            )

            // showPastDue = true (default) should include all
            val filterShow = FilterState(showPastDue = true)
            val resultShow = FilterEngine.applyFilters(chits, filterShow)

            assertEquals(
                "Seed $seed: all chits should pass when showPastDue=true",
                chits.size,
                resultShow.size
            )
        }
    }

    @Test
    fun `Property 15 - multiple filters are conjunctive (all must pass)`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            val selectedStatus = statusPool[r.nextInt(statusPool.size)]
            val selectedPriority = priorityPool[r.nextInt(priorityPool.size)]

            val chits = listOf(
                makeChit(id = "both-$seed", status = selectedStatus, priority = selectedPriority),
                makeChit(id = "status-only-$seed", status = selectedStatus, priority = "Low"),
                makeChit(id = "priority-only-$seed", status = "Blocked", priority = selectedPriority),
                makeChit(id = "neither-$seed", status = "Blocked", priority = "Low")
            )

            val filter = FilterState(
                statuses = setOf(selectedStatus),
                priorities = setOf(selectedPriority)
            )
            val result = FilterEngine.applyFilters(chits, filter)

            // Only the chit matching BOTH status and priority should pass
            for (chit in result) {
                assertTrue(
                    "Seed $seed: result chit ${chit.id} must match status $selectedStatus",
                    chit.status == selectedStatus
                )
                assertTrue(
                    "Seed $seed: result chit ${chit.id} must match priority $selectedPriority",
                    chit.priority == selectedPriority
                )
            }

            // Verify the "both" chit is always in results (unless status/priority happen to be "Low"/"Blocked")
            if (selectedStatus != "Blocked" || selectedPriority != "Low") {
                assertTrue(
                    "Seed $seed: chit matching both filters should be in result",
                    result.any { it.id == "both-$seed" }
                )
            }
        }
    }

    @Test
    fun `Property 15 - null status chit excluded when status filter is active`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val selectedStatus = statusPool[r.nextInt(statusPool.size)]

            val chits = listOf(
                makeChit(id = "has-status-$seed", status = selectedStatus),
                makeChit(id = "null-status-$seed", status = null)
            )

            val filter = FilterState(statuses = setOf(selectedStatus))
            val result = FilterEngine.applyFilters(chits, filter)

            assertTrue(
                "Seed $seed: chit with null status should be excluded when status filter is active",
                result.none { it.id == "null-status-$seed" }
            )
            assertTrue(
                "Seed $seed: chit with matching status should be included",
                result.any { it.id == "has-status-$seed" }
            )
        }
    }


    // =========================================================================
    // Property 16: Tag filter match modes
    // =========================================================================
    //
    // For any set of selected tags and any set of chits, match-ANY mode should
    // return chits that have at least one of the selected tags, and match-ALL
    // mode should return only chits that have every selected tag.
    //
    // **Validates: Requirements 9.4**

    @Test
    fun `Property 16 - ANY mode returns chits with at least one matching tag`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            val selectedTags = tagPool.shuffled(r).take(r.nextInt(3) + 1).toSet()

            val chits = listOf(
                makeChit(id = "has-one-$seed", tags = listOf(selectedTags.first())),
                makeChit(id = "has-all-$seed", tags = selectedTags.toList()),
                makeChit(id = "has-none-$seed", tags = listOf("Unrelated", "Other")),
                makeChit(id = "null-tags-$seed", tags = null),
                makeChit(id = "empty-tags-$seed", tags = emptyList())
            )

            val filter = FilterState(
                tags = selectedTags,
                tagMatchMode = TagMatchMode.ANY
            )
            val result = FilterEngine.applyFilters(chits, filter)

            // Every result must have at least one tag in the selected set
            for (chit in result) {
                val chitTags = chit.tags ?: emptyList()
                assertTrue(
                    "Seed $seed: chit ${chit.id} with tags $chitTags should have at least one of $selectedTags",
                    chitTags.any { it in selectedTags }
                )
            }

            // Every excluded chit must have NO tags in the selected set
            val resultIds = result.map { it.id }.toSet()
            for (chit in chits) {
                if (chit.id !in resultIds) {
                    val chitTags = chit.tags ?: emptyList()
                    assertTrue(
                        "Seed $seed: excluded chit ${chit.id} with tags $chitTags should have none of $selectedTags",
                        chitTags.none { it in selectedTags }
                    )
                }
            }
        }
    }

    @Test
    fun `Property 16 - ALL mode returns only chits with every selected tag`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            val selectedTags = tagPool.shuffled(r).take(r.nextInt(3) + 1).toSet()

            val chits = listOf(
                makeChit(id = "has-all-$seed", tags = selectedTags.toList() + listOf("Extra")),
                makeChit(id = "has-one-$seed", tags = listOf(selectedTags.first())),
                makeChit(id = "has-none-$seed", tags = listOf("Unrelated")),
                makeChit(id = "null-tags-$seed", tags = null),
                makeChit(id = "exact-$seed", tags = selectedTags.toList())
            )

            val filter = FilterState(
                tags = selectedTags,
                tagMatchMode = TagMatchMode.ALL
            )
            val result = FilterEngine.applyFilters(chits, filter)

            // Every result must have ALL selected tags
            for (chit in result) {
                val chitTags = chit.tags ?: emptyList()
                assertTrue(
                    "Seed $seed: chit ${chit.id} with tags $chitTags should contain all of $selectedTags",
                    chitTags.containsAll(selectedTags)
                )
            }

            // Every excluded chit must be missing at least one selected tag
            val resultIds = result.map { it.id }.toSet()
            for (chit in chits) {
                if (chit.id !in resultIds) {
                    val chitTags = chit.tags ?: emptyList()
                    assertFalse(
                        "Seed $seed: excluded chit ${chit.id} with tags $chitTags should NOT contain all of $selectedTags",
                        chitTags.containsAll(selectedTags)
                    )
                }
            }
        }
    }

    @Test
    fun `Property 16 - ANY mode with single tag is equivalent to membership check`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val singleTag = tagPool[r.nextInt(tagPool.size)]

            val chits = (1..5).map { idx ->
                val chitTags = if (r.nextBoolean()) listOf(singleTag, "Other") else listOf("Unrelated")
                makeChit(id = "single-any-$seed-$idx", tags = chitTags)
            }

            val filter = FilterState(
                tags = setOf(singleTag),
                tagMatchMode = TagMatchMode.ANY
            )
            val result = FilterEngine.applyFilters(chits, filter)

            // With a single tag, ANY and ALL should produce the same result
            val filterAll = FilterState(
                tags = setOf(singleTag),
                tagMatchMode = TagMatchMode.ALL
            )
            val resultAll = FilterEngine.applyFilters(chits, filterAll)

            assertEquals(
                "Seed $seed: single tag filter should produce same result in ANY and ALL modes",
                result.map { it.id }.toSet(),
                resultAll.map { it.id }.toSet()
            )
        }
    }

    @Test
    fun `Property 16 - ALL mode is stricter than ANY mode`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())

            // Use 2+ tags so ALL is meaningfully stricter
            val selectedTags = tagPool.shuffled(r).take(r.nextInt(2) + 2).toSet()

            val chits = (1..10).map { idx ->
                // Give each chit a random subset of tags
                val chitTags = tagPool.shuffled(r).take(r.nextInt(4) + 1)
                makeChit(id = "strict-$seed-$idx", tags = chitTags)
            }

            val filterAny = FilterState(tags = selectedTags, tagMatchMode = TagMatchMode.ANY)
            val filterAll = FilterState(tags = selectedTags, tagMatchMode = TagMatchMode.ALL)

            val resultAny = FilterEngine.applyFilters(chits, filterAny)
            val resultAll = FilterEngine.applyFilters(chits, filterAll)

            // ALL results must be a subset of ANY results
            val anyIds = resultAny.map { it.id }.toSet()
            val allIds = resultAll.map { it.id }.toSet()

            assertTrue(
                "Seed $seed: ALL results ($allIds) must be a subset of ANY results ($anyIds)",
                anyIds.containsAll(allIds)
            )
        }
    }

    @Test
    fun `Property 16 - empty tag filter passes all chits regardless of mode`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())

            val chits = (1..5).map { idx ->
                makeChit(
                    id = "empty-tag-$seed-$idx",
                    tags = tagPool.shuffled(r).take(r.nextInt(3))
                )
            }

            val filterAny = FilterState(tags = emptySet(), tagMatchMode = TagMatchMode.ANY)
            val filterAll = FilterState(tags = emptySet(), tagMatchMode = TagMatchMode.ALL)

            val resultAny = FilterEngine.applyFilters(chits, filterAny)
            val resultAll = FilterEngine.applyFilters(chits, filterAll)

            assertEquals(
                "Seed $seed: empty tag set with ANY mode should pass all chits",
                chits.size,
                resultAny.size
            )
            assertEquals(
                "Seed $seed: empty tag set with ALL mode should pass all chits",
                chits.size,
                resultAll.size
            )
        }
    }

    @Test
    fun `Property 16 - tag filter combined with other filters is conjunctive`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())

            val selectedTag = tagPool[r.nextInt(tagPool.size)]
            val selectedStatus = statusPool[r.nextInt(statusPool.size)]

            val chits = listOf(
                makeChit(id = "both-$seed", tags = listOf(selectedTag), status = selectedStatus),
                makeChit(id = "tag-only-$seed", tags = listOf(selectedTag), status = "Blocked"),
                makeChit(id = "status-only-$seed", tags = listOf("Other"), status = selectedStatus),
                makeChit(id = "neither-$seed", tags = listOf("Other"), status = "Blocked")
            )

            val filter = FilterState(
                tags = setOf(selectedTag),
                tagMatchMode = TagMatchMode.ANY,
                statuses = setOf(selectedStatus)
            )
            val result = FilterEngine.applyFilters(chits, filter)

            // Only the chit matching BOTH tag and status should pass
            for (chit in result) {
                val chitTags = chit.tags ?: emptyList()
                assertTrue(
                    "Seed $seed: result chit ${chit.id} must have tag $selectedTag",
                    chitTags.contains(selectedTag)
                )
                assertEquals(
                    "Seed $seed: result chit ${chit.id} must have status $selectedStatus",
                    selectedStatus,
                    chit.status
                )
            }
        }
    }
}
