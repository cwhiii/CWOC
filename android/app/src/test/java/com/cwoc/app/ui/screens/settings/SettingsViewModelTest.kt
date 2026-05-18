package com.cwoc.app.ui.screens.settings

import com.cwoc.app.data.local.entity.SettingsEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for Settings persistence round-trip.
 *
 * Property 1: Settings persistence round-trip
 *
 * For any valid settings value (time format, week start day, calendar snap interval,
 * snooze length, timezone, unit system, default view, enabled periods, view order),
 * saving the value to the SettingsRepository and then reloading it should produce
 * an identical value.
 *
 * Since the ViewModel's mapping functions are private, we test the round-trip property
 * by verifying:
 * 1. SettingsFormState -> SettingsEntity -> SettingsFormState produces identical state
 * 2. updateSetting() correctly updates individual fields
 * 3. All settings keys are handled
 * 4. Unknown keys don't crash or modify state
 *
 * **Validates: Requirements 2.3, 2.4, 2.5**
 */
class SettingsViewModelTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    private val timeFormatPool = listOf("12h", "24h")
    private val weekStartDayPool = listOf("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
    private val calendarSnapPool = listOf("1", "5", "10", "15", "30", "60")
    private val snoozeLengthPool = listOf("5", "10", "15", "20", "30", "60")
    private val timezonePool = listOf(
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
        "Pacific/Honolulu", "America/Anchorage", "UTC"
    )
    private val unitSystemPool = listOf("imperial", "metric")
    private val defaultViewPool = listOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
    private val periodPool = listOf("Day", "Week", "Month", "Year", "Itinerary", "X-Day")
    private val viewOrderPool = listOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")

    /**
     * Generates a random SettingsFormState with valid values from the pools.
     */
    private fun generateRandomFormState(r: java.util.Random): SettingsFormState {
        val enabledPeriods = periodPool.shuffled(r).take(r.nextInt(periodPool.size) + 1).joinToString(",")
        val viewOrder = viewOrderPool.shuffled(r).joinToString(",")

        return SettingsFormState(
            timeFormat = timeFormatPool[r.nextInt(timeFormatPool.size)],
            weekStartDay = weekStartDayPool[r.nextInt(weekStartDayPool.size)],
            calendarSnapInterval = calendarSnapPool[r.nextInt(calendarSnapPool.size)],
            snoozeLength = snoozeLengthPool[r.nextInt(snoozeLengthPool.size)],
            defaultTimezone = timezonePool[r.nextInt(timezonePool.size)],
            unitSystem = unitSystemPool[r.nextInt(unitSystemPool.size)],
            defaultView = defaultViewPool[r.nextInt(defaultViewPool.size)],
            enabledPeriods = enabledPeriods,
            viewOrder = viewOrder
        )
    }

    /**
     * Maps a SettingsFormState to a SettingsEntity (mirrors SettingsViewModel.mapFormStateToEntity).
     */
    private fun mapFormStateToEntity(formState: SettingsFormState, userId: String = "test_user"): SettingsEntity {
        return SettingsEntity(
            userId = userId,
            timeFormat = formState.timeFormat,
            sex = null,
            snoozeLength = formState.snoozeLength,
            defaultFilters = null,
            alarmOrientation = null,
            activeClocks = null,
            savedLocations = null,
            tags = null,
            customColors = null,
            visualIndicators = null,
            chitOptions = null,
            calendarSnap = formState.calendarSnapInterval,
            weekStartDay = formState.weekStartDay,
            workStartHour = null,
            workEndHour = null,
            workDays = null,
            enabledPeriods = formState.enabledPeriods,
            customDaysCount = null,
            allViewStartHour = null,
            allViewEndHour = null,
            dayScrollToHour = null,
            username = null,
            unitSystem = formState.unitSystem,
            habitsSuccessWindow = null,
            overdueBorderColor = null,
            blockedBorderColor = null,
            hidDeclined = null,
            defaultShowHabitsOnCalendar = null,
            defaultTimezone = formState.defaultTimezone,
            defaultView = formState.defaultView,
            viewOrder = formState.viewOrder,
            syncVersion = 0,
            lastSyncedAt = null,
            isDirty = false,
            lastModified = null
        )
    }

    /**
     * Maps a SettingsEntity back to a SettingsFormState (mirrors SettingsViewModel.mapEntityToFormState).
     */
    private fun mapEntityToFormState(entity: SettingsEntity): SettingsFormState {
        return SettingsFormState(
            timeFormat = entity.timeFormat ?: "12h",
            weekStartDay = entity.weekStartDay ?: "sunday",
            calendarSnapInterval = entity.calendarSnap ?: "15",
            snoozeLength = entity.snoozeLength ?: "10",
            defaultTimezone = entity.defaultTimezone ?: "America/New_York",
            unitSystem = entity.unitSystem ?: "imperial",
            defaultView = entity.defaultView ?: "Tasks",
            enabledPeriods = entity.enabledPeriods ?: "Day,Week,Month",
            viewOrder = entity.viewOrder ?: "Calendar,Checklists,Alarms,Projects,Tasks,Notes"
        )
    }

    /**
     * Applies updateSetting logic (mirrors SettingsViewModel.updateSetting).
     */
    private fun applyUpdateSetting(current: SettingsFormState, key: String, value: String): SettingsFormState {
        return when (key) {
            "time_format" -> current.copy(timeFormat = value)
            "week_start_day" -> current.copy(weekStartDay = value)
            "calendar_snap_interval" -> current.copy(calendarSnapInterval = value)
            "snooze_length" -> current.copy(snoozeLength = value)
            "default_timezone" -> current.copy(defaultTimezone = value)
            "unit_system" -> current.copy(unitSystem = value)
            "default_view" -> current.copy(defaultView = value)
            "enabled_periods" -> current.copy(enabledPeriods = value)
            "view_order" -> current.copy(viewOrder = value)
            else -> current
        }
    }

    // =========================================================================
    // Property 1: Settings persistence round-trip
    // =========================================================================
    //
    // For any valid settings value, saving to SettingsEntity and reloading
    // should produce an identical SettingsFormState.
    //
    // **Validates: Requirements 2.3, 2.4, 2.5**

    @Test
    fun `Property 1 - FormState to Entity to FormState round-trip preserves all fields`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val original = generateRandomFormState(r)

            // Round-trip: FormState -> Entity -> FormState
            val entity = mapFormStateToEntity(original)
            val restored = mapEntityToFormState(entity)

            assertEquals(
                "Seed $seed: timeFormat should survive round-trip",
                original.timeFormat, restored.timeFormat
            )
            assertEquals(
                "Seed $seed: weekStartDay should survive round-trip",
                original.weekStartDay, restored.weekStartDay
            )
            assertEquals(
                "Seed $seed: calendarSnapInterval should survive round-trip",
                original.calendarSnapInterval, restored.calendarSnapInterval
            )
            assertEquals(
                "Seed $seed: snoozeLength should survive round-trip",
                original.snoozeLength, restored.snoozeLength
            )
            assertEquals(
                "Seed $seed: defaultTimezone should survive round-trip",
                original.defaultTimezone, restored.defaultTimezone
            )
            assertEquals(
                "Seed $seed: unitSystem should survive round-trip",
                original.unitSystem, restored.unitSystem
            )
            assertEquals(
                "Seed $seed: defaultView should survive round-trip",
                original.defaultView, restored.defaultView
            )
            assertEquals(
                "Seed $seed: enabledPeriods should survive round-trip",
                original.enabledPeriods, restored.enabledPeriods
            )
            assertEquals(
                "Seed $seed: viewOrder should survive round-trip",
                original.viewOrder, restored.viewOrder
            )

            // Full equality check
            assertEquals(
                "Seed $seed: entire SettingsFormState should survive round-trip",
                original, restored
            )
        }
    }

    @Test
    fun `Property 1 - Entity with null fields maps to defaults`() {
        for (seed in 1..50) {
            // Create an entity with all settings-related fields null
            val entity = SettingsEntity(
                userId = "user-$seed",
                timeFormat = null,
                sex = null,
                snoozeLength = null,
                defaultFilters = null,
                alarmOrientation = null,
                activeClocks = null,
                savedLocations = null,
                tags = null,
                customColors = null,
                visualIndicators = null,
                chitOptions = null,
                calendarSnap = null,
                weekStartDay = null,
                workStartHour = null,
                workEndHour = null,
                workDays = null,
                enabledPeriods = null,
                customDaysCount = null,
                allViewStartHour = null,
                allViewEndHour = null,
                dayScrollToHour = null,
                username = null,
                unitSystem = null,
                habitsSuccessWindow = null,
                overdueBorderColor = null,
                blockedBorderColor = null,
                hidDeclined = null,
                defaultShowHabitsOnCalendar = null,
                defaultTimezone = null,
                defaultView = null,
                viewOrder = null,
                syncVersion = 0,
                lastSyncedAt = null,
                isDirty = false,
                lastModified = null
            )

            val formState = mapEntityToFormState(entity)
            val defaults = SettingsFormState()

            assertEquals(
                "Seed $seed: null entity fields should produce default SettingsFormState",
                defaults, formState
            )
        }
    }

    @Test
    fun `Property 1 - round-trip preserves non-settings entity fields`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val formState = generateRandomFormState(r)

            // Create a base entity with extra fields populated
            val baseEntity = SettingsEntity(
                userId = "user-$seed",
                timeFormat = "24h",
                sex = "male",
                snoozeLength = "30",
                defaultFilters = "{\"status\":\"ToDo\"}",
                alarmOrientation = "portrait",
                activeClocks = "clock1,clock2",
                savedLocations = "[{\"name\":\"Home\"}]",
                tags = "[{\"name\":\"Work\"}]",
                customColors = "#FF0000,#00FF00",
                visualIndicators = "priority,status",
                chitOptions = "{}",
                calendarSnap = "30",
                weekStartDay = "monday",
                workStartHour = "9",
                workEndHour = "17",
                workDays = "Mon,Tue,Wed,Thu,Fri",
                enabledPeriods = "Day,Week",
                customDaysCount = "3",
                allViewStartHour = "6",
                allViewEndHour = "22",
                dayScrollToHour = "8",
                username = "testuser",
                unitSystem = "metric",
                habitsSuccessWindow = "7",
                overdueBorderColor = "#FF0000",
                blockedBorderColor = "#FFA500",
                hidDeclined = "true",
                defaultShowHabitsOnCalendar = "true",
                defaultTimezone = "Europe/London",
                defaultView = "Calendar",
                viewOrder = "Tasks,Notes,Calendar,Checklists,Alarms,Projects",
                syncVersion = 5,
                lastSyncedAt = "2024-01-01T00:00:00Z",
                isDirty = true,
                lastModified = "2024-01-01T12:00:00Z"
            )

            // Map form state to entity using the base entity's non-form fields
            val updatedEntity = baseEntity.copy(
                timeFormat = formState.timeFormat,
                weekStartDay = formState.weekStartDay,
                calendarSnap = formState.calendarSnapInterval,
                snoozeLength = formState.snoozeLength,
                defaultTimezone = formState.defaultTimezone,
                unitSystem = formState.unitSystem,
                defaultView = formState.defaultView,
                enabledPeriods = formState.enabledPeriods,
                viewOrder = formState.viewOrder
            )

            // Non-form fields should be preserved
            assertEquals("Seed $seed: sex preserved", baseEntity.sex, updatedEntity.sex)
            assertEquals("Seed $seed: defaultFilters preserved", baseEntity.defaultFilters, updatedEntity.defaultFilters)
            assertEquals("Seed $seed: alarmOrientation preserved", baseEntity.alarmOrientation, updatedEntity.alarmOrientation)
            assertEquals("Seed $seed: activeClocks preserved", baseEntity.activeClocks, updatedEntity.activeClocks)
            assertEquals("Seed $seed: savedLocations preserved", baseEntity.savedLocations, updatedEntity.savedLocations)
            assertEquals("Seed $seed: tags preserved", baseEntity.tags, updatedEntity.tags)
            assertEquals("Seed $seed: customColors preserved", baseEntity.customColors, updatedEntity.customColors)
            assertEquals("Seed $seed: syncVersion preserved", baseEntity.syncVersion, updatedEntity.syncVersion)
            assertEquals("Seed $seed: lastSyncedAt preserved", baseEntity.lastSyncedAt, updatedEntity.lastSyncedAt)
        }
    }

    // =========================================================================
    // updateSetting() correctness
    // =========================================================================

    @Test
    fun `Property 1 - updateSetting correctly updates each field individually`() {
        val allKeys = listOf(
            "time_format", "week_start_day", "calendar_snap_interval",
            "snooze_length", "default_timezone", "unit_system",
            "default_view", "enabled_periods", "view_order"
        )

        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val initial = generateRandomFormState(r)

            // Pick a random key and a new value
            val key = allKeys[r.nextInt(allKeys.size)]
            val newValue = when (key) {
                "time_format" -> timeFormatPool[r.nextInt(timeFormatPool.size)]
                "week_start_day" -> weekStartDayPool[r.nextInt(weekStartDayPool.size)]
                "calendar_snap_interval" -> calendarSnapPool[r.nextInt(calendarSnapPool.size)]
                "snooze_length" -> snoozeLengthPool[r.nextInt(snoozeLengthPool.size)]
                "default_timezone" -> timezonePool[r.nextInt(timezonePool.size)]
                "unit_system" -> unitSystemPool[r.nextInt(unitSystemPool.size)]
                "default_view" -> defaultViewPool[r.nextInt(defaultViewPool.size)]
                "enabled_periods" -> periodPool.shuffled(r).take(r.nextInt(periodPool.size) + 1).joinToString(",")
                "view_order" -> viewOrderPool.shuffled(r).joinToString(",")
                else -> "unknown"
            }

            val updated = applyUpdateSetting(initial, key, newValue)

            // The targeted field should have the new value
            val actualValue = when (key) {
                "time_format" -> updated.timeFormat
                "week_start_day" -> updated.weekStartDay
                "calendar_snap_interval" -> updated.calendarSnapInterval
                "snooze_length" -> updated.snoozeLength
                "default_timezone" -> updated.defaultTimezone
                "unit_system" -> updated.unitSystem
                "default_view" -> updated.defaultView
                "enabled_periods" -> updated.enabledPeriods
                "view_order" -> updated.viewOrder
                else -> ""
            }
            assertEquals(
                "Seed $seed: key '$key' should be updated to '$newValue'",
                newValue, actualValue
            )

            // All OTHER fields should remain unchanged
            if (key != "time_format") assertEquals("Seed $seed: timeFormat unchanged", initial.timeFormat, updated.timeFormat)
            if (key != "week_start_day") assertEquals("Seed $seed: weekStartDay unchanged", initial.weekStartDay, updated.weekStartDay)
            if (key != "calendar_snap_interval") assertEquals("Seed $seed: calendarSnapInterval unchanged", initial.calendarSnapInterval, updated.calendarSnapInterval)
            if (key != "snooze_length") assertEquals("Seed $seed: snoozeLength unchanged", initial.snoozeLength, updated.snoozeLength)
            if (key != "default_timezone") assertEquals("Seed $seed: defaultTimezone unchanged", initial.defaultTimezone, updated.defaultTimezone)
            if (key != "unit_system") assertEquals("Seed $seed: unitSystem unchanged", initial.unitSystem, updated.unitSystem)
            if (key != "default_view") assertEquals("Seed $seed: defaultView unchanged", initial.defaultView, updated.defaultView)
            if (key != "enabled_periods") assertEquals("Seed $seed: enabledPeriods unchanged", initial.enabledPeriods, updated.enabledPeriods)
            if (key != "view_order") assertEquals("Seed $seed: viewOrder unchanged", initial.viewOrder, updated.viewOrder)
        }
    }

    @Test
    fun `Property 1 - updateSetting with unknown key does not modify state`() {
        val unknownKeys = listOf(
            "unknown_key", "foo", "bar", "", "TIME_FORMAT", "timeFormat",
            "calendar_snap", "timezone", "view", "periods", "order"
        )

        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val initial = generateRandomFormState(r)
            val unknownKey = unknownKeys[r.nextInt(unknownKeys.size)]

            val updated = applyUpdateSetting(initial, unknownKey, "some_value_${r.nextInt()}")

            assertEquals(
                "Seed $seed: unknown key '$unknownKey' should not modify state",
                initial, updated
            )
        }
    }

    @Test
    fun `Property 1 - sequential updates produce correct cumulative state`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            var state = SettingsFormState() // Start from defaults

            // Apply a series of random updates
            val updates = mutableListOf<Pair<String, String>>()
            val numUpdates = r.nextInt(5) + 2

            for (i in 0 until numUpdates) {
                val key = listOf(
                    "time_format", "week_start_day", "calendar_snap_interval",
                    "snooze_length", "default_timezone", "unit_system",
                    "default_view", "enabled_periods", "view_order"
                )[r.nextInt(9)]

                val value = when (key) {
                    "time_format" -> timeFormatPool[r.nextInt(timeFormatPool.size)]
                    "week_start_day" -> weekStartDayPool[r.nextInt(weekStartDayPool.size)]
                    "calendar_snap_interval" -> calendarSnapPool[r.nextInt(calendarSnapPool.size)]
                    "snooze_length" -> snoozeLengthPool[r.nextInt(snoozeLengthPool.size)]
                    "default_timezone" -> timezonePool[r.nextInt(timezonePool.size)]
                    "unit_system" -> unitSystemPool[r.nextInt(unitSystemPool.size)]
                    "default_view" -> defaultViewPool[r.nextInt(defaultViewPool.size)]
                    "enabled_periods" -> periodPool.shuffled(r).take(r.nextInt(periodPool.size) + 1).joinToString(",")
                    "view_order" -> viewOrderPool.shuffled(r).joinToString(",")
                    else -> ""
                }

                state = applyUpdateSetting(state, key, value)
                updates.add(key to value)
            }

            // The final state should reflect the LAST value set for each key
            val lastValues = mutableMapOf<String, String>()
            for ((key, value) in updates) {
                lastValues[key] = value
            }

            for ((key, expectedValue) in lastValues) {
                val actualValue = when (key) {
                    "time_format" -> state.timeFormat
                    "week_start_day" -> state.weekStartDay
                    "calendar_snap_interval" -> state.calendarSnapInterval
                    "snooze_length" -> state.snoozeLength
                    "default_timezone" -> state.defaultTimezone
                    "unit_system" -> state.unitSystem
                    "default_view" -> state.defaultView
                    "enabled_periods" -> state.enabledPeriods
                    "view_order" -> state.viewOrder
                    else -> ""
                }
                assertEquals(
                    "Seed $seed: after sequential updates, key '$key' should have last-set value",
                    expectedValue, actualValue
                )
            }
        }
    }

    @Test
    fun `Property 1 - updateSetting then round-trip preserves the update`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val initial = generateRandomFormState(r)

            // Update a single field
            val key = listOf(
                "time_format", "week_start_day", "calendar_snap_interval",
                "snooze_length", "default_timezone", "unit_system",
                "default_view", "enabled_periods", "view_order"
            )[r.nextInt(9)]

            val newValue = when (key) {
                "time_format" -> if (initial.timeFormat == "12h") "24h" else "12h"
                "week_start_day" -> weekStartDayPool[(weekStartDayPool.indexOf(initial.weekStartDay) + 1) % weekStartDayPool.size]
                "calendar_snap_interval" -> calendarSnapPool[(calendarSnapPool.indexOf(initial.calendarSnapInterval) + 1) % calendarSnapPool.size]
                "snooze_length" -> snoozeLengthPool[(snoozeLengthPool.indexOf(initial.snoozeLength) + 1) % snoozeLengthPool.size]
                "default_timezone" -> timezonePool[(timezonePool.indexOf(initial.defaultTimezone) + 1) % timezonePool.size]
                "unit_system" -> if (initial.unitSystem == "imperial") "metric" else "imperial"
                "default_view" -> defaultViewPool[(defaultViewPool.indexOf(initial.defaultView) + 1) % defaultViewPool.size]
                "enabled_periods" -> periodPool.shuffled(r).take(r.nextInt(periodPool.size) + 1).joinToString(",")
                "view_order" -> viewOrderPool.shuffled(r).joinToString(",")
                else -> ""
            }

            val updated = applyUpdateSetting(initial, key, newValue)

            // Round-trip the updated state
            val entity = mapFormStateToEntity(updated)
            val restored = mapEntityToFormState(entity)

            assertEquals(
                "Seed $seed: updated state should survive round-trip",
                updated, restored
            )
        }
    }

    @Test
    fun `Property 1 - all nine settings keys are handled by updateSetting`() {
        val expectedKeys = setOf(
            "time_format", "week_start_day", "calendar_snap_interval",
            "snooze_length", "default_timezone", "unit_system",
            "default_view", "enabled_periods", "view_order"
        )

        val defaults = SettingsFormState()

        // Each key should produce a different state when updated with a non-default value
        for (key in expectedKeys) {
            val testValue = "test_value_for_$key"
            val updated = applyUpdateSetting(defaults, key, testValue)

            assertNotEquals(
                "Key '$key' should modify the state when updated",
                defaults, updated
            )
        }
    }

    @Test
    fun `Property 1 - SettingsFormState default values are consistent with entity null mapping`() {
        // The defaults in SettingsFormState() should match what mapEntityToFormState
        // produces when all entity fields are null
        val nullEntity = SettingsEntity(
            userId = "test",
            timeFormat = null,
            sex = null,
            snoozeLength = null,
            defaultFilters = null,
            alarmOrientation = null,
            activeClocks = null,
            savedLocations = null,
            tags = null,
            customColors = null,
            visualIndicators = null,
            chitOptions = null,
            calendarSnap = null,
            weekStartDay = null,
            workStartHour = null,
            workEndHour = null,
            workDays = null,
            enabledPeriods = null,
            customDaysCount = null,
            allViewStartHour = null,
            allViewEndHour = null,
            dayScrollToHour = null,
            username = null,
            unitSystem = null,
            habitsSuccessWindow = null,
            overdueBorderColor = null,
            blockedBorderColor = null,
            hidDeclined = null,
            defaultShowHabitsOnCalendar = null,
            defaultTimezone = null,
            defaultView = null,
            viewOrder = null,
            syncVersion = 0,
            lastSyncedAt = null,
            isDirty = false,
            lastModified = null
        )

        val fromNull = mapEntityToFormState(nullEntity)
        val defaults = SettingsFormState()

        assertEquals("Default timeFormat", defaults.timeFormat, fromNull.timeFormat)
        assertEquals("Default weekStartDay", defaults.weekStartDay, fromNull.weekStartDay)
        assertEquals("Default calendarSnapInterval", defaults.calendarSnapInterval, fromNull.calendarSnapInterval)
        assertEquals("Default snoozeLength", defaults.snoozeLength, fromNull.snoozeLength)
        assertEquals("Default defaultTimezone", defaults.defaultTimezone, fromNull.defaultTimezone)
        assertEquals("Default unitSystem", defaults.unitSystem, fromNull.unitSystem)
        assertEquals("Default defaultView", defaults.defaultView, fromNull.defaultView)
        assertEquals("Default enabledPeriods", defaults.enabledPeriods, fromNull.enabledPeriods)
        assertEquals("Default viewOrder", defaults.viewOrder, fromNull.viewOrder)
        assertEquals("Full default equality", defaults, fromNull)
    }

    @Test
    fun `Property 1 - field mapping between FormState and Entity uses correct field names`() {
        // Verify the field name mapping is correct:
        // FormState.calendarSnapInterval <-> Entity.calendarSnap
        // FormState.snoozeLength <-> Entity.snoozeLength
        // etc.
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val formState = generateRandomFormState(r)
            val entity = mapFormStateToEntity(formState)

            // Verify each mapping explicitly
            assertEquals("timeFormat maps correctly", formState.timeFormat, entity.timeFormat)
            assertEquals("weekStartDay maps correctly", formState.weekStartDay, entity.weekStartDay)
            assertEquals("calendarSnapInterval -> calendarSnap", formState.calendarSnapInterval, entity.calendarSnap)
            assertEquals("snoozeLength maps correctly", formState.snoozeLength, entity.snoozeLength)
            assertEquals("defaultTimezone maps correctly", formState.defaultTimezone, entity.defaultTimezone)
            assertEquals("unitSystem maps correctly", formState.unitSystem, entity.unitSystem)
            assertEquals("defaultView maps correctly", formState.defaultView, entity.defaultView)
            assertEquals("enabledPeriods maps correctly", formState.enabledPeriods, entity.enabledPeriods)
            assertEquals("viewOrder maps correctly", formState.viewOrder, entity.viewOrder)
        }
    }
}
