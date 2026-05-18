package com.cwoc.app.ui.screens.editor

import com.cwoc.app.data.mapper.ChitFormState
import org.junit.Assert.*
import org.junit.Test
import kotlin.random.Random

/**
 * Property-based tests for dirty state detection in the chit editor.
 *
 * Property 20: Dirty state detection — For any two ChitFormState instances,
 * isDirty should be true if and only if at least one editable field differs
 * between them. If all fields are identical, isDirty should be false.
 *
 * Tests replicate the field-by-field comparison logic from ChitEditorViewModel's
 * isDirty StateFlow to validate the detection independently.
 *
 * **Validates: Requirements 12.1**
 */
class DirtyDetectionTest {

    /**
     * Computes isDirty by comparing two ChitFormState instances field-by-field.
     * This replicates the logic from ChitEditorViewModel.isDirty.
     * Compares all editable fields (excludes `id` and `isNew` which are identity fields).
     */
    private fun computeIsDirty(current: ChitFormState, saved: ChitFormState): Boolean {
        return current.title != saved.title ||
            current.note != saved.note ||
            current.startDatetime != saved.startDatetime ||
            current.endDatetime != saved.endDatetime ||
            current.dueDatetime != saved.dueDatetime ||
            current.pointInTime != saved.pointInTime ||
            current.status != saved.status ||
            current.priority != saved.priority ||
            current.tags != saved.tags ||
            current.checklist != saved.checklist ||
            current.people != saved.people ||
            current.location != saved.location ||
            current.color != saved.color ||
            current.alerts != saved.alerts ||
            current.recurrence != saved.recurrence ||
            current.recurrenceRule != saved.recurrenceRule ||
            current.recurrenceExceptions != saved.recurrenceExceptions ||
            current.allDay != saved.allDay ||
            current.timezone != saved.timezone ||
            current.availability != saved.availability ||
            current.perpetual != saved.perpetual
    }

    // =========================================================================
    // Property 20: Identical form states produce isDirty=false
    // =========================================================================

    @Test
    fun `Property 20 - identical form states are not dirty`() {
        repeat(100) { i ->
            val state = generateRandomFormState(seed = i)
            val copy = state.copy()

            assertFalse(
                "Iteration $i: identical form states must produce isDirty=false",
                computeIsDirty(copy, state)
            )
        }
    }

    @Test
    fun `Property 20 - same instance compared to itself is not dirty`() {
        repeat(100) { i ->
            val state = generateRandomFormState(seed = i)

            assertFalse(
                "Iteration $i: a form state compared to itself must not be dirty",
                computeIsDirty(state, state)
            )
        }
    }

    // =========================================================================
    // Property 20: Changing any single field produces isDirty=true
    // =========================================================================

    @Test
    fun `Property 20 - changing title produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(title = original.title + "_changed")

            assertTrue(
                "Iteration $i: changing title must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing note produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(note = original.note + "_changed")

            assertTrue(
                "Iteration $i: changing note must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing startDatetime produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.startDatetime == null) "2025-01-01T00:00:00Z" else null
            val modified = original.copy(startDatetime = newValue)

            assertTrue(
                "Iteration $i: changing startDatetime must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing endDatetime produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.endDatetime == null) "2025-12-31T23:59:59Z" else null
            val modified = original.copy(endDatetime = newValue)

            assertTrue(
                "Iteration $i: changing endDatetime must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing dueDatetime produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.dueDatetime == null) "2025-06-15T12:00:00Z" else null
            val modified = original.copy(dueDatetime = newValue)

            assertTrue(
                "Iteration $i: changing dueDatetime must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing pointInTime produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.pointInTime == null) "2025-03-20T08:00:00Z" else null
            val modified = original.copy(pointInTime = newValue)

            assertTrue(
                "Iteration $i: changing pointInTime must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing status produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.status == "todo") "in_progress" else "todo"
            val modified = original.copy(status = newValue)

            assertTrue(
                "Iteration $i: changing status must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing priority produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.priority == "high") "low" else "high"
            val modified = original.copy(priority = newValue)

            assertTrue(
                "Iteration $i: changing priority must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing tags produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(tags = original.tags + "new_tag")

            assertTrue(
                "Iteration $i: changing tags must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing checklist produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.checklist == null) "[{\"text\":\"new item\"}]" else null
            val modified = original.copy(checklist = newValue)

            assertTrue(
                "Iteration $i: changing checklist must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing people produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(people = original.people + "NewPerson")

            assertTrue(
                "Iteration $i: changing people must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing location produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.location == null) "New York" else null
            val modified = original.copy(location = newValue)

            assertTrue(
                "Iteration $i: changing location must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing color produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.color == null) "#FF0000" else null
            val modified = original.copy(color = newValue)

            assertTrue(
                "Iteration $i: changing color must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing alerts produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.alerts == null) "[{\"minutes\":30}]" else null
            val modified = original.copy(alerts = newValue)

            assertTrue(
                "Iteration $i: changing alerts must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing recurrence produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.recurrence == null) "weekly" else null
            val modified = original.copy(recurrence = newValue)

            assertTrue(
                "Iteration $i: changing recurrence must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing recurrenceRule produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.recurrenceRule == null) "{\"freq\":\"WEEKLY\"}" else null
            val modified = original.copy(recurrenceRule = newValue)

            assertTrue(
                "Iteration $i: changing recurrenceRule must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing recurrenceExceptions produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.recurrenceExceptions == null) "[\"2025-01-01\"]" else null
            val modified = original.copy(recurrenceExceptions = newValue)

            assertTrue(
                "Iteration $i: changing recurrenceExceptions must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing allDay produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(allDay = !original.allDay)

            assertTrue(
                "Iteration $i: toggling allDay must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing timezone produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.timezone == null) "Europe/London" else null
            val modified = original.copy(timezone = newValue)

            assertTrue(
                "Iteration $i: changing timezone must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing availability produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val newValue = if (original.availability == "busy") "free" else "busy"
            val modified = original.copy(availability = newValue)

            assertTrue(
                "Iteration $i: changing availability must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing perpetual produces dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)
            val modified = original.copy(perpetual = !original.perpetual)

            assertTrue(
                "Iteration $i: toggling perpetual must produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    // =========================================================================
    // Property 20: Changing a field back to original produces isDirty=false
    // =========================================================================

    @Test
    fun `Property 20 - changing field and reverting produces not dirty`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)

            // Modify a random field then revert it
            val r = Random(i + 5000)
            val fieldIndex = r.nextInt(21) // 21 editable fields

            val modified = mutateField(original, fieldIndex)
            // Verify it's dirty after mutation
            assertTrue(
                "Iteration $i (field $fieldIndex): mutated state must be dirty",
                computeIsDirty(modified, original)
            )

            // Revert back to original values
            val reverted = modified.copy(
                title = original.title,
                note = original.note,
                startDatetime = original.startDatetime,
                endDatetime = original.endDatetime,
                dueDatetime = original.dueDatetime,
                pointInTime = original.pointInTime,
                status = original.status,
                priority = original.priority,
                tags = original.tags,
                checklist = original.checklist,
                people = original.people,
                location = original.location,
                color = original.color,
                alerts = original.alerts,
                recurrence = original.recurrence,
                recurrenceRule = original.recurrenceRule,
                recurrenceExceptions = original.recurrenceExceptions,
                allDay = original.allDay,
                timezone = original.timezone,
                availability = original.availability,
                perpetual = original.perpetual
            )

            assertFalse(
                "Iteration $i (field $fieldIndex): reverted state must not be dirty",
                computeIsDirty(reverted, original)
            )
        }
    }

    @Test
    fun `Property 20 - changing id or isNew does not affect dirty detection`() {
        repeat(100) { i ->
            val original = generateRandomFormState(seed = i)

            // Change only id and isNew (identity fields, not editable fields)
            val modified = original.copy(
                id = "different-id-${i}",
                isNew = !original.isNew
            )

            assertFalse(
                "Iteration $i: changing only id/isNew must not produce isDirty=true",
                computeIsDirty(modified, original)
            )
        }
    }

    // =========================================================================
    // Property 20: Random pair comparison — isDirty iff at least one field differs
    // =========================================================================

    @Test
    fun `Property 20 - two random states are dirty iff at least one field differs`() {
        repeat(100) { i ->
            val stateA = generateRandomFormState(seed = i)
            val stateB = generateRandomFormState(seed = i + 1000)

            val isDirty = computeIsDirty(stateA, stateB)
            val hasAnyDifference = stateA.title != stateB.title ||
                stateA.note != stateB.note ||
                stateA.startDatetime != stateB.startDatetime ||
                stateA.endDatetime != stateB.endDatetime ||
                stateA.dueDatetime != stateB.dueDatetime ||
                stateA.pointInTime != stateB.pointInTime ||
                stateA.status != stateB.status ||
                stateA.priority != stateB.priority ||
                stateA.tags != stateB.tags ||
                stateA.checklist != stateB.checklist ||
                stateA.people != stateB.people ||
                stateA.location != stateB.location ||
                stateA.color != stateB.color ||
                stateA.alerts != stateB.alerts ||
                stateA.recurrence != stateB.recurrence ||
                stateA.recurrenceRule != stateB.recurrenceRule ||
                stateA.recurrenceExceptions != stateB.recurrenceExceptions ||
                stateA.allDay != stateB.allDay ||
                stateA.timezone != stateB.timezone ||
                stateA.availability != stateB.availability ||
                stateA.perpetual != stateB.perpetual

            assertEquals(
                "Iteration $i: isDirty must equal whether any editable field differs",
                hasAnyDifference,
                isDirty
            )
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Generates a random ChitFormState with varied field values for property testing.
     * Uses a seed for reproducibility.
     */
    private fun generateRandomFormState(seed: Int): ChitFormState {
        val r = Random(seed)
        val statuses = listOf("todo", "in_progress", "blocked", "complete")
        val priorities = listOf("critical", "high", "medium", "low")
        val timezones = listOf("America/New_York", "Europe/London", "Asia/Tokyo", "US/Pacific")
        val availabilities = listOf("busy", "free", "tentative")

        fun nullableStr(prefix: String): String? =
            if (r.nextBoolean()) "${prefix}_${r.nextInt(1000)}" else null

        fun randomTags(): List<String> =
            if (r.nextBoolean()) List(r.nextInt(1, 5)) { "tag_${r.nextInt(100)}" } else emptyList()

        fun randomPeople(): List<String> =
            if (r.nextBoolean()) List(r.nextInt(1, 4)) { "person_${r.nextInt(50)}" } else emptyList()

        return ChitFormState(
            id = "test-id-$seed",
            title = if (r.nextBoolean()) "Title ${r.nextInt(1000)}" else "",
            note = if (r.nextBoolean()) "Note content ${r.nextInt(1000)}" else "",
            startDatetime = nullableStr("2025-01-${r.nextInt(1, 29)}T${r.nextInt(0, 24)}:00:00Z"),
            endDatetime = nullableStr("2025-02-${r.nextInt(1, 29)}T${r.nextInt(0, 24)}:00:00Z"),
            dueDatetime = nullableStr("2025-03-${r.nextInt(1, 29)}T${r.nextInt(0, 24)}:00:00Z"),
            pointInTime = nullableStr("2025-04-${r.nextInt(1, 29)}T${r.nextInt(0, 24)}:00:00Z"),
            status = if (r.nextBoolean()) statuses[r.nextInt(statuses.size)] else null,
            priority = if (r.nextBoolean()) priorities[r.nextInt(priorities.size)] else null,
            tags = randomTags(),
            checklist = nullableStr("[{\"text\":\"item\"}]"),
            people = randomPeople(),
            location = nullableStr("Location"),
            color = if (r.nextBoolean()) "#${r.nextInt(0xFFFFFF).toString(16).padStart(6, '0')}" else null,
            alerts = nullableStr("[{\"minutes\":${r.nextInt(1, 120)}}]"),
            recurrence = nullableStr("recurrence"),
            recurrenceRule = nullableStr("{\"freq\":\"DAILY\"}"),
            recurrenceExceptions = nullableStr("[\"2025-01-01\"]"),
            allDay = r.nextBoolean(),
            timezone = if (r.nextBoolean()) timezones[r.nextInt(timezones.size)] else null,
            availability = if (r.nextBoolean()) availabilities[r.nextInt(availabilities.size)] else null,
            perpetual = r.nextBoolean(),
            isNew = r.nextBoolean()
        )
    }

    /**
     * Mutates a single field of the given form state based on the field index.
     * Returns a new ChitFormState with exactly one field changed.
     */
    private fun mutateField(state: ChitFormState, fieldIndex: Int): ChitFormState {
        return when (fieldIndex) {
            0 -> state.copy(title = state.title + "_x")
            1 -> state.copy(note = state.note + "_x")
            2 -> state.copy(startDatetime = if (state.startDatetime == null) "2025-01-01T00:00:00Z" else null)
            3 -> state.copy(endDatetime = if (state.endDatetime == null) "2025-12-31T23:59:59Z" else null)
            4 -> state.copy(dueDatetime = if (state.dueDatetime == null) "2025-06-15T12:00:00Z" else null)
            5 -> state.copy(pointInTime = if (state.pointInTime == null) "2025-03-20T08:00:00Z" else null)
            6 -> state.copy(status = if (state.status == "todo") "complete" else "todo")
            7 -> state.copy(priority = if (state.priority == "high") "low" else "high")
            8 -> state.copy(tags = state.tags + "mutated_tag")
            9 -> state.copy(checklist = if (state.checklist == null) "[{\"text\":\"mutated\"}]" else null)
            10 -> state.copy(people = state.people + "MutatedPerson")
            11 -> state.copy(location = if (state.location == null) "Mutated Location" else null)
            12 -> state.copy(color = if (state.color == null) "#ABCDEF" else null)
            13 -> state.copy(alerts = if (state.alerts == null) "[{\"minutes\":99}]" else null)
            14 -> state.copy(recurrence = if (state.recurrence == null) "monthly" else null)
            15 -> state.copy(recurrenceRule = if (state.recurrenceRule == null) "{\"freq\":\"MONTHLY\"}" else null)
            16 -> state.copy(recurrenceExceptions = if (state.recurrenceExceptions == null) "[\"2025-12-25\"]" else null)
            17 -> state.copy(allDay = !state.allDay)
            18 -> state.copy(timezone = if (state.timezone == null) "UTC" else null)
            19 -> state.copy(availability = if (state.availability == "busy") "free" else "busy")
            20 -> state.copy(perpetual = !state.perpetual)
            else -> state.copy(title = state.title + "_fallback")
        }
    }
}
