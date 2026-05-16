package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.remote.dto.ChitPushDto
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

/**
 * Property-based tests for ChitMapper functions.
 *
 * Property 1: Entity-to-FormState round-trip — converting an entity to form state
 * and back should preserve all editable fields.
 *
 * Property 11: Entity-to-PushDto mapping completeness — all entity fields should
 * map to the corresponding PushDto fields.
 *
 * **Validates: Requirements 1.1, 1.4, 7.2, 13.1, 13.2**
 */
class ChitMapperPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    private fun randomNullableString(): String? =
        if (random.nextBoolean()) "value_${random.nextInt(1000)}" else null

    private fun randomNullableBoolean(): Boolean? =
        if (random.nextBoolean()) random.nextBoolean() else null

    private fun randomNullableInt(): Int? =
        if (random.nextBoolean()) random.nextInt(100) else null

    private fun randomNullableStringList(): List<String>? =
        if (random.nextBoolean()) List(random.nextInt(4)) { "item_$it" } else null

    private fun randomBoolean(): Boolean = random.nextBoolean()

    private fun randomString(): String = "str_${random.nextInt(10000)}"

    /**
     * Generates a random ChitEntity with varied field values for property testing.
     * Uses a seed-based approach to produce diverse but reproducible test cases.
     */
    private fun generateRandomChitEntity(seed: Int): ChitEntity {
        val r = java.util.Random(seed.toLong())
        fun nullStr(): String? = if (r.nextBoolean()) "val_${r.nextInt(1000)}" else null
        fun nullBool(): Boolean? = if (r.nextBoolean()) r.nextBoolean() else null
        fun nullInt(): Int? = if (r.nextBoolean()) r.nextInt(100) else null
        fun nullStrList(): List<String>? = if (r.nextBoolean()) List(r.nextInt(4)) { "i$it" } else null
        fun bool(): Boolean = r.nextBoolean()

        return ChitEntity(
            id = UUID.nameUUIDFromBytes("seed$seed".toByteArray()).toString(),
            title = nullStr(),
            note = nullStr(),
            tags = nullStrList(),
            startDatetime = nullStr(),
            endDatetime = nullStr(),
            dueDatetime = nullStr(),
            pointInTime = nullStr(),
            completedDatetime = nullStr(),
            status = nullStr(),
            priority = nullStr(),
            severity = nullStr(),
            checklist = nullStr(),
            alarm = nullBool(),
            notification = nullBool(),
            recurrence = nullStr(),
            recurrenceId = nullStr(),
            recurrenceRule = nullStr(),
            recurrenceExceptions = nullStr(),
            location = nullStr(),
            color = nullStr(),
            people = nullStrList(),
            pinned = bool(),
            archived = bool(),
            deleted = bool(),
            createdDatetime = nullStr(),
            modifiedDatetime = nullStr(),
            isProjectMaster = bool(),
            childChits = nullStrList(),
            allDay = bool(),
            timezone = nullStr(),
            alerts = nullStr(),
            progressPercent = nullInt(),
            timeEstimate = nullStr(),
            weatherData = nullStr(),
            healthData = nullStr(),
            habit = bool(),
            habitGoal = nullInt(),
            habitSuccess = nullInt(),
            showOnCalendar = nullBool(),
            habitResetPeriod = nullStr(),
            habitLastActionDate = nullStr(),
            habitHideOverall = nullBool(),
            perpetual = bool(),
            shares = nullStr(),
            stealth = nullBool(),
            assignedTo = nullStr(),
            ownerId = nullStr(),
            hasUnviewedConflict = bool(),
            availability = nullStr(),
            snoozedUntil = nullStr(),
            prerequisites = nullStrList(),
            syncVersion = r.nextInt(100),
            lastSyncedAt = nullStr(),
            isDirty = bool(),
            dirtyFields = if (r.nextBoolean()) "[\"title\"]" else "[]"
        )
    }

    // =========================================================================
    // Property 1: Entity-to-FormState round-trip
    // =========================================================================
    //
    // For any valid ChitEntity, converting it to a ChitFormState via toFormState()
    // and then back to a ChitEntity via toEntity() SHALL preserve all editable
    // field values (title, note, dates, status, priority, tags, checklist, people,
    // location, color, alerts, recurrence, allDay, timezone, availability).
    //
    // **Validates: Requirements 1.1, 1.4**

    /**
     * Property 1: Entity→FormState→Entity round-trip preserves editable fields.
     *
     * Tests across 100 randomly generated entities that the editable fields
     * survive the round-trip conversion without data loss or corruption.
     */
    @Test
    fun `Property 1 - Entity to FormState round-trip preserves editable fields`() {
        // Run across 100 diverse entity configurations
        for (seed in 1..100) {
            val original = generateRandomChitEntity(seed)
            val formState = original.toFormState()
            val roundTripped = formState.toEntity(
                originalEntity = original,
                modifiedDatetime = original.modifiedDatetime ?: "2025-01-01T00:00:00Z",
                createdDatetime = original.createdDatetime
            )

            // Editable fields that go through FormState must be preserved
            assertEquals(
                "Seed $seed: title mismatch",
                original.title,
                roundTripped.title
            )
            assertEquals(
                "Seed $seed: note mismatch",
                original.note,
                roundTripped.note
            )
            assertEquals(
                "Seed $seed: startDatetime mismatch",
                original.startDatetime,
                roundTripped.startDatetime
            )
            assertEquals(
                "Seed $seed: endDatetime mismatch",
                original.endDatetime,
                roundTripped.endDatetime
            )
            assertEquals(
                "Seed $seed: dueDatetime mismatch",
                original.dueDatetime,
                roundTripped.dueDatetime
            )
            assertEquals(
                "Seed $seed: pointInTime mismatch",
                original.pointInTime,
                roundTripped.pointInTime
            )
            assertEquals(
                "Seed $seed: status mismatch",
                original.status,
                roundTripped.status
            )
            assertEquals(
                "Seed $seed: priority mismatch",
                original.priority,
                roundTripped.priority
            )
            assertEquals(
                "Seed $seed: tags mismatch",
                original.tags,
                roundTripped.tags
            )
            assertEquals(
                "Seed $seed: checklist mismatch",
                original.checklist,
                roundTripped.checklist
            )
            assertEquals(
                "Seed $seed: people mismatch",
                original.people,
                roundTripped.people
            )
            assertEquals(
                "Seed $seed: location mismatch",
                original.location,
                roundTripped.location
            )
            assertEquals(
                "Seed $seed: color mismatch",
                original.color,
                roundTripped.color
            )
            assertEquals(
                "Seed $seed: alerts mismatch",
                original.alerts,
                roundTripped.alerts
            )
            assertEquals(
                "Seed $seed: recurrence mismatch",
                original.recurrence,
                roundTripped.recurrence
            )
            assertEquals(
                "Seed $seed: recurrenceRule mismatch",
                original.recurrenceRule,
                roundTripped.recurrenceRule
            )
            assertEquals(
                "Seed $seed: allDay mismatch",
                original.allDay,
                roundTripped.allDay
            )
            assertEquals(
                "Seed $seed: timezone mismatch",
                original.timezone,
                roundTripped.timezone
            )
            assertEquals(
                "Seed $seed: availability mismatch",
                original.availability,
                roundTripped.availability
            )
        }
    }

    /**
     * Property 1 (edge case): Round-trip with all-null optional fields.
     * Ensures the mapper handles the minimal entity correctly.
     */
    @Test
    fun `Property 1 - round-trip with all-null optional fields`() {
        val minimal = ChitEntity(
            id = "minimal-id",
            title = null,
            note = null,
            tags = null,
            startDatetime = null,
            endDatetime = null,
            dueDatetime = null,
            pointInTime = null,
            completedDatetime = null,
            status = null,
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
            archived = false,
            deleted = false,
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
            snoozedUntil = null,
            prerequisites = null,
            syncVersion = 0,
            lastSyncedAt = null,
            isDirty = false,
            dirtyFields = "[]"
        )

        val formState = minimal.toFormState()
        val roundTripped = formState.toEntity(
            originalEntity = minimal,
            modifiedDatetime = "2025-01-01T00:00:00Z",
            createdDatetime = null
        )

        // All editable fields should remain null/default after round-trip
        assertNull(roundTripped.title)
        assertNull(roundTripped.note)
        assertNull(roundTripped.tags)
        assertNull(roundTripped.startDatetime)
        assertNull(roundTripped.endDatetime)
        assertNull(roundTripped.dueDatetime)
        assertNull(roundTripped.pointInTime)
        assertNull(roundTripped.status)
        assertNull(roundTripped.priority)
        assertNull(roundTripped.checklist)
        assertNull(roundTripped.people)
        assertNull(roundTripped.location)
        assertNull(roundTripped.color)
        assertNull(roundTripped.alerts)
        assertNull(roundTripped.recurrence)
        assertNull(roundTripped.recurrenceRule)
        assertFalse(roundTripped.allDay)
        assertNull(roundTripped.timezone)
        assertNull(roundTripped.availability)
    }

    /**
     * Property 1 (edge case): Round-trip with all fields populated.
     * Ensures no data loss when every field has a value.
     */
    @Test
    fun `Property 1 - round-trip with all fields populated`() {
        val full = ChitEntity(
            id = "full-id",
            title = "My Title",
            note = "My Note",
            tags = listOf("tag1", "tag2"),
            startDatetime = "2025-06-01T09:00:00Z",
            endDatetime = "2025-06-01T10:00:00Z",
            dueDatetime = "2025-06-02T17:00:00Z",
            pointInTime = "2025-06-01T12:00:00Z",
            completedDatetime = "2025-06-01T11:00:00Z",
            status = "in_progress",
            priority = "high",
            severity = "critical",
            checklist = "[{\"text\":\"item1\",\"done\":false}]",
            alarm = true,
            notification = true,
            recurrence = "daily",
            recurrenceId = "rec-123",
            recurrenceRule = "{\"freq\":\"DAILY\"}",
            recurrenceExceptions = "[\"2025-06-05\"]",
            location = "New York",
            color = "#FF5733",
            people = listOf("Alice", "Bob"),
            pinned = true,
            archived = false,
            deleted = false,
            createdDatetime = "2025-05-01T00:00:00Z",
            modifiedDatetime = "2025-06-01T08:00:00Z",
            isProjectMaster = true,
            childChits = listOf("child-1", "child-2"),
            allDay = true,
            timezone = "America/New_York",
            alerts = "[{\"minutes\":15}]",
            progressPercent = 50,
            timeEstimate = "2h",
            weatherData = "{\"temp\":72}",
            healthData = "{\"steps\":5000}",
            habit = true,
            habitGoal = 7,
            habitSuccess = 3,
            showOnCalendar = true,
            habitResetPeriod = "weekly",
            habitLastActionDate = "2025-06-01",
            habitHideOverall = false,
            perpetual = true,
            shares = "{\"user1\":\"read\"}",
            stealth = false,
            assignedTo = "user-456",
            ownerId = "owner-789",
            hasUnviewedConflict = false,
            availability = "busy",
            snoozedUntil = "2025-06-03T09:00:00Z",
            prerequisites = listOf("prereq-1"),
            syncVersion = 5,
            lastSyncedAt = "2025-06-01T07:00:00Z",
            isDirty = false,
            dirtyFields = "[]"
        )

        val formState = full.toFormState()
        val roundTripped = formState.toEntity(
            originalEntity = full,
            modifiedDatetime = full.modifiedDatetime!!,
            createdDatetime = full.createdDatetime
        )

        // All editable fields preserved
        assertEquals("My Title", roundTripped.title)
        assertEquals("My Note", roundTripped.note)
        assertEquals(listOf("tag1", "tag2"), roundTripped.tags)
        assertEquals("2025-06-01T09:00:00Z", roundTripped.startDatetime)
        assertEquals("2025-06-01T10:00:00Z", roundTripped.endDatetime)
        assertEquals("2025-06-02T17:00:00Z", roundTripped.dueDatetime)
        assertEquals("2025-06-01T12:00:00Z", roundTripped.pointInTime)
        assertEquals("in_progress", roundTripped.status)
        assertEquals("high", roundTripped.priority)
        assertEquals("[{\"text\":\"item1\",\"done\":false}]", roundTripped.checklist)
        assertEquals(listOf("Alice", "Bob"), roundTripped.people)
        assertEquals("New York", roundTripped.location)
        assertEquals("#FF5733", roundTripped.color)
        assertEquals("[{\"minutes\":15}]", roundTripped.alerts)
        assertEquals("daily", roundTripped.recurrence)
        assertEquals("{\"freq\":\"DAILY\"}", roundTripped.recurrenceRule)
        assertTrue(roundTripped.allDay)
        assertEquals("America/New_York", roundTripped.timezone)
        assertEquals("busy", roundTripped.availability)
    }

    /**
     * Property 1: Non-editable fields are preserved from originalEntity.
     * The round-trip should carry forward fields that aren't in FormState
     * (completedDatetime, severity, alarm, notification, etc.) from the original.
     */
    @Test
    fun `Property 1 - non-editable fields preserved from original entity`() {
        for (seed in 1..50) {
            val original = generateRandomChitEntity(seed)
            val formState = original.toFormState()
            val roundTripped = formState.toEntity(
                originalEntity = original,
                modifiedDatetime = original.modifiedDatetime ?: "2025-01-01T00:00:00Z",
                createdDatetime = original.createdDatetime
            )

            // Non-editable fields should come from originalEntity
            assertEquals("Seed $seed: completedDatetime", original.completedDatetime, roundTripped.completedDatetime)
            assertEquals("Seed $seed: severity", original.severity, roundTripped.severity)
            assertEquals("Seed $seed: alarm", original.alarm, roundTripped.alarm)
            assertEquals("Seed $seed: notification", original.notification, roundTripped.notification)
            assertEquals("Seed $seed: recurrenceId", original.recurrenceId, roundTripped.recurrenceId)
            assertEquals("Seed $seed: recurrenceExceptions", original.recurrenceExceptions, roundTripped.recurrenceExceptions)
            assertEquals("Seed $seed: pinned", original.pinned, roundTripped.pinned)
            assertEquals("Seed $seed: archived", original.archived, roundTripped.archived)
            assertEquals("Seed $seed: deleted", original.deleted, roundTripped.deleted)
            assertEquals("Seed $seed: isProjectMaster", original.isProjectMaster, roundTripped.isProjectMaster)
            assertEquals("Seed $seed: childChits", original.childChits, roundTripped.childChits)
            assertEquals("Seed $seed: progressPercent", original.progressPercent, roundTripped.progressPercent)
            assertEquals("Seed $seed: timeEstimate", original.timeEstimate, roundTripped.timeEstimate)
            assertEquals("Seed $seed: weatherData", original.weatherData, roundTripped.weatherData)
            assertEquals("Seed $seed: healthData", original.healthData, roundTripped.healthData)
            assertEquals("Seed $seed: habit", original.habit, roundTripped.habit)
            assertEquals("Seed $seed: habitGoal", original.habitGoal, roundTripped.habitGoal)
            assertEquals("Seed $seed: habitSuccess", original.habitSuccess, roundTripped.habitSuccess)
            assertEquals("Seed $seed: showOnCalendar", original.showOnCalendar, roundTripped.showOnCalendar)
            assertEquals("Seed $seed: habitResetPeriod", original.habitResetPeriod, roundTripped.habitResetPeriod)
            assertEquals("Seed $seed: habitLastActionDate", original.habitLastActionDate, roundTripped.habitLastActionDate)
            assertEquals("Seed $seed: habitHideOverall", original.habitHideOverall, roundTripped.habitHideOverall)
            assertEquals("Seed $seed: perpetual", original.perpetual, roundTripped.perpetual)
            assertEquals("Seed $seed: shares", original.shares, roundTripped.shares)
            assertEquals("Seed $seed: stealth", original.stealth, roundTripped.stealth)
            assertEquals("Seed $seed: assignedTo", original.assignedTo, roundTripped.assignedTo)
            assertEquals("Seed $seed: ownerId", original.ownerId, roundTripped.ownerId)
            assertEquals("Seed $seed: snoozedUntil", original.snoozedUntil, roundTripped.snoozedUntil)
            assertEquals("Seed $seed: prerequisites", original.prerequisites, roundTripped.prerequisites)
            assertEquals("Seed $seed: syncVersion", original.syncVersion, roundTripped.syncVersion)
            assertEquals("Seed $seed: lastSyncedAt", original.lastSyncedAt, roundTripped.lastSyncedAt)
        }
    }

    // =========================================================================
    // Property 11: Entity-to-PushDto mapping completeness
    // =========================================================================
    //
    // For any ChitEntity, converting it via toPushDto() SHALL produce a ChitPushDto
    // where last_known_sync_version equals the entity's syncVersion, and all entity
    // fields are mapped to their corresponding snake_case DTO fields with values
    // preserved (accounting for JSON string → object conversion for complex fields).
    //
    // **Validates: Requirements 7.2, 13.1, 13.2**

    /**
     * Property 11: Entity→PushDto maps all simple fields correctly.
     *
     * Tests across 100 randomly generated entities that all non-JSON fields
     * map to the correct snake_case DTO fields with values preserved.
     */
    @Test
    fun `Property 11 - Entity to PushDto maps all simple fields correctly`() {
        for (seed in 1..100) {
            val entity = generateRandomChitEntity(seed)
            val dto = entity.toPushDto()

            // Core identity and version
            assertEquals("Seed $seed: id", entity.id, dto.id)
            assertEquals("Seed $seed: last_known_sync_version", entity.syncVersion, dto.last_known_sync_version)

            // Simple string/nullable fields
            assertEquals("Seed $seed: title", entity.title, dto.title)
            assertEquals("Seed $seed: note", entity.note, dto.note)
            assertEquals("Seed $seed: tags", entity.tags, dto.tags)
            assertEquals("Seed $seed: start_datetime", entity.startDatetime, dto.start_datetime)
            assertEquals("Seed $seed: end_datetime", entity.endDatetime, dto.end_datetime)
            assertEquals("Seed $seed: due_datetime", entity.dueDatetime, dto.due_datetime)
            assertEquals("Seed $seed: point_in_time", entity.pointInTime, dto.point_in_time)
            assertEquals("Seed $seed: completed_datetime", entity.completedDatetime, dto.completed_datetime)
            assertEquals("Seed $seed: status", entity.status, dto.status)
            assertEquals("Seed $seed: priority", entity.priority, dto.priority)
            assertEquals("Seed $seed: severity", entity.severity, dto.severity)
            assertEquals("Seed $seed: alarm", entity.alarm, dto.alarm)
            assertEquals("Seed $seed: notification", entity.notification, dto.notification)
            assertEquals("Seed $seed: recurrence", entity.recurrence, dto.recurrence)
            assertEquals("Seed $seed: recurrence_id", entity.recurrenceId, dto.recurrence_id)
            assertEquals("Seed $seed: location", entity.location, dto.location)
            assertEquals("Seed $seed: color", entity.color, dto.color)
            assertEquals("Seed $seed: people", entity.people, dto.people)
            assertEquals("Seed $seed: pinned", entity.pinned, dto.pinned)
            assertEquals("Seed $seed: archived", entity.archived, dto.archived)
            assertEquals("Seed $seed: deleted", entity.deleted, dto.deleted)
            assertEquals("Seed $seed: created_datetime", entity.createdDatetime, dto.created_datetime)
            assertEquals("Seed $seed: modified_datetime", entity.modifiedDatetime, dto.modified_datetime)
            assertEquals("Seed $seed: is_project_master", entity.isProjectMaster, dto.is_project_master)
            assertEquals("Seed $seed: child_chits", entity.childChits, dto.child_chits)
            assertEquals("Seed $seed: all_day", entity.allDay, dto.all_day)
            assertEquals("Seed $seed: timezone", entity.timezone, dto.timezone)
            assertEquals("Seed $seed: progress_percent", entity.progressPercent, dto.progress_percent)
            assertEquals("Seed $seed: time_estimate", entity.timeEstimate, dto.time_estimate)
            assertEquals("Seed $seed: habit", entity.habit, dto.habit)
            assertEquals("Seed $seed: habit_goal", entity.habitGoal, dto.habit_goal)
            assertEquals("Seed $seed: habit_success", entity.habitSuccess, dto.habit_success)
            assertEquals("Seed $seed: show_on_calendar", entity.showOnCalendar, dto.show_on_calendar)
            assertEquals("Seed $seed: habit_reset_period", entity.habitResetPeriod, dto.habit_reset_period)
            assertEquals("Seed $seed: habit_last_action_date", entity.habitLastActionDate, dto.habit_last_action_date)
            assertEquals("Seed $seed: habit_hide_overall", entity.habitHideOverall, dto.habit_hide_overall)
            assertEquals("Seed $seed: perpetual", entity.perpetual, dto.perpetual)
            assertEquals("Seed $seed: stealth", entity.stealth, dto.stealth)
            assertEquals("Seed $seed: assigned_to", entity.assignedTo, dto.assigned_to)
            assertEquals("Seed $seed: owner_id", entity.ownerId, dto.owner_id)
            assertEquals("Seed $seed: availability", entity.availability, dto.availability)
            assertEquals("Seed $seed: snoozed_until", entity.snoozedUntil, dto.snoozed_until)
            assertEquals("Seed $seed: prerequisites", entity.prerequisites, dto.prerequisites)
        }
    }

    /**
     * Property 11: JSON-stored fields are deserialized for the DTO.
     *
     * Fields stored as JSON strings in the entity (checklist, recurrenceRule,
     * recurrenceExceptions, alerts, weatherData, healthData, shares) should be
     * deserialized to Any? in the PushDto. Null entity values should map to null DTO values.
     */
    @Test
    fun `Property 11 - JSON fields are deserialized or null in PushDto`() {
        // Entity with valid JSON in complex fields
        val entityWithJson = ChitEntity(
            id = "json-test-id",
            title = "Test",
            note = null,
            tags = null,
            startDatetime = null,
            endDatetime = null,
            dueDatetime = null,
            pointInTime = null,
            completedDatetime = null,
            status = null,
            priority = null,
            severity = null,
            checklist = "[{\"text\":\"item1\",\"done\":false}]",
            alarm = null,
            notification = null,
            recurrence = null,
            recurrenceId = null,
            recurrenceRule = "{\"freq\":\"DAILY\",\"interval\":1}",
            recurrenceExceptions = "[\"2025-06-05\"]",
            location = null,
            color = null,
            people = null,
            pinned = false,
            archived = false,
            deleted = false,
            createdDatetime = null,
            modifiedDatetime = null,
            isProjectMaster = false,
            childChits = null,
            allDay = false,
            timezone = null,
            alerts = "[{\"minutes\":15}]",
            progressPercent = null,
            timeEstimate = null,
            weatherData = "{\"temp\":72,\"condition\":\"sunny\"}",
            healthData = "{\"steps\":5000}",
            habit = false,
            habitGoal = null,
            habitSuccess = null,
            showOnCalendar = null,
            habitResetPeriod = null,
            habitLastActionDate = null,
            habitHideOverall = null,
            perpetual = false,
            shares = "{\"user1\":\"read\"}",
            stealth = null,
            assignedTo = null,
            ownerId = null,
            hasUnviewedConflict = false,
            availability = null,
            snoozedUntil = null,
            prerequisites = null,
            syncVersion = 3,
            lastSyncedAt = null,
            isDirty = true,
            dirtyFields = "[]"
        )

        val dto = entityWithJson.toPushDto()

        // JSON fields should be deserialized (non-null)
        assertNotNull("checklist should be deserialized", dto.checklist)
        assertNotNull("recurrence_rule should be deserialized", dto.recurrence_rule)
        assertNotNull("recurrence_exceptions should be deserialized", dto.recurrence_exceptions)
        assertNotNull("alerts should be deserialized", dto.alerts)
        assertNotNull("weather_data should be deserialized", dto.weather_data)
        assertNotNull("health_data should be deserialized", dto.health_data)
        assertNotNull("shares should be deserialized", dto.shares)

        // Entity with null JSON fields → DTO should have null
        val entityWithNulls = entityWithJson.copy(
            checklist = null,
            recurrenceRule = null,
            recurrenceExceptions = null,
            alerts = null,
            weatherData = null,
            healthData = null,
            shares = null
        )

        val dtoNulls = entityWithNulls.toPushDto()

        assertNull("null checklist → null dto", dtoNulls.checklist)
        assertNull("null recurrenceRule → null dto", dtoNulls.recurrence_rule)
        assertNull("null recurrenceExceptions → null dto", dtoNulls.recurrence_exceptions)
        assertNull("null alerts → null dto", dtoNulls.alerts)
        assertNull("null weatherData → null dto", dtoNulls.weather_data)
        assertNull("null healthData → null dto", dtoNulls.health_data)
        assertNull("null shares → null dto", dtoNulls.shares)
    }

    /**
     * Property 11: syncVersion maps to last_known_sync_version.
     *
     * For any entity, the PushDto's last_known_sync_version must exactly equal
     * the entity's syncVersion — this is critical for server conflict detection.
     */
    @Test
    fun `Property 11 - syncVersion maps to last_known_sync_version for all entities`() {
        val testVersions = listOf(0, 1, 5, 42, 99, 100, 999)
        for (version in testVersions) {
            val entity = generateRandomChitEntity(version).copy(syncVersion = version)
            val dto = entity.toPushDto()
            assertEquals(
                "syncVersion $version must map to last_known_sync_version",
                version,
                dto.last_known_sync_version
            )
        }
    }

    /**
     * Property 11: Entity ID is preserved in PushDto.
     *
     * The id field must pass through unchanged — it's the primary key for
     * server-side record matching.
     */
    @Test
    fun `Property 11 - entity ID preserved in PushDto`() {
        for (seed in 1..50) {
            val entity = generateRandomChitEntity(seed)
            val dto = entity.toPushDto()
            assertEquals(
                "Seed $seed: entity ID must be preserved in PushDto",
                entity.id,
                dto.id
            )
        }
    }
}
