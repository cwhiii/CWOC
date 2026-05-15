package com.cwoc.app.data.sync

import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.remote.dto.ChitDto
import com.cwoc.app.data.remote.dto.ContactDto
import com.cwoc.app.data.remote.dto.SettingsDto
import com.google.gson.Gson

/**
 * Extension functions to map server DTOs to Room entities.
 * Complex JSON fields (Any?) are serialized back to JSON strings using Gson.
 */

private fun Any?.toJsonString(gson: Gson): String? {
    return this?.let { gson.toJson(it) }
}

/**
 * Maps a ChitDto from the server to a ChitEntity for Room storage.
 * @param syncedAt ISO timestamp of when this sync occurred
 * @param gson Gson instance for serializing complex JSON fields
 */
fun ChitDto.toEntity(syncedAt: String, gson: Gson): ChitEntity {
    return ChitEntity(
        id = id,
        title = title,
        note = note,
        tags = tags,
        startDatetime = start_datetime,
        endDatetime = end_datetime,
        dueDatetime = due_datetime,
        pointInTime = point_in_time,
        completedDatetime = completed_datetime,
        status = status,
        priority = priority,
        severity = severity,
        checklist = checklist.toJsonString(gson),
        alarm = alarm,
        notification = notification,
        recurrence = recurrence,
        recurrenceId = recurrence_id,
        recurrenceRule = recurrence_rule.toJsonString(gson),
        recurrenceExceptions = recurrence_exceptions.toJsonString(gson),
        location = location,
        color = color,
        people = people,
        pinned = pinned ?: false,
        archived = archived ?: false,
        deleted = deleted ?: false,
        createdDatetime = created_datetime,
        modifiedDatetime = modified_datetime,
        isProjectMaster = is_project_master ?: false,
        childChits = child_chits,
        allDay = all_day ?: false,
        timezone = timezone,
        alerts = alerts.toJsonString(gson),
        progressPercent = progress_percent,
        timeEstimate = time_estimate,
        weatherData = weather_data.toJsonString(gson),
        healthData = health_data.toJsonString(gson),
        habit = habit ?: false,
        habitGoal = habit_goal,
        habitSuccess = habit_success,
        showOnCalendar = show_on_calendar,
        habitResetPeriod = habit_reset_period,
        habitLastActionDate = habit_last_action_date,
        habitHideOverall = habit_hide_overall,
        perpetual = perpetual ?: false,
        shares = shares.toJsonString(gson),
        stealth = stealth,
        assignedTo = assigned_to,
        ownerId = owner_id,
        hasUnviewedConflict = has_unviewed_conflict ?: false,
        availability = availability,
        snoozedUntil = snoozed_until,
        prerequisites = prerequisites,
        syncVersion = sync_version,
        lastSyncedAt = syncedAt
    )
}

/**
 * Maps a ContactDto from the server to a ContactEntity for Room storage.
 * @param syncedAt ISO timestamp of when this sync occurred
 * @param gson Gson instance for serializing complex JSON fields
 */
fun ContactDto.toEntity(syncedAt: String, gson: Gson): ContactEntity {
    return ContactEntity(
        id = id,
        givenName = given_name,
        surname = surname,
        middleNames = middle_names,
        prefix = prefix,
        suffix = suffix,
        nickname = nickname,
        displayName = display_name,
        phones = phones.toJsonString(gson),
        emails = emails.toJsonString(gson),
        addresses = addresses.toJsonString(gson),
        callSigns = call_signs.toJsonString(gson),
        xHandles = x_handles.toJsonString(gson),
        websites = websites.toJsonString(gson),
        dates = dates.toJsonString(gson),
        hasSignal = has_signal ?: false,
        signalUsername = signal_username,
        pgpKey = pgp_key,
        favorite = favorite ?: false,
        color = color,
        organization = organization,
        socialContext = social_context,
        imageUrl = image_url,
        notes = notes,
        tags = tags,
        sharedToVault = shared_to_vault ?: false,
        createdDatetime = created_datetime,
        modifiedDatetime = modified_datetime,
        syncVersion = sync_version,
        lastSyncedAt = syncedAt
    )
}

/**
 * Maps a SettingsDto from the server to a SettingsEntity for Room storage.
 * @param syncedAt ISO timestamp of when this sync occurred
 * @param gson Gson instance for serializing complex JSON fields
 */
fun SettingsDto.toEntity(syncedAt: String, gson: Gson): SettingsEntity {
    return SettingsEntity(
        userId = user_id ?: "default",
        timeFormat = time_format,
        sex = sex,
        snoozeLength = snooze_length,
        defaultFilters = default_filters.toJsonString(gson),
        alarmOrientation = alarm_orientation,
        activeClocks = active_clocks,
        savedLocations = saved_locations,
        tags = tags.toJsonString(gson),
        customColors = custom_colors.toJsonString(gson),
        visualIndicators = visual_indicators.toJsonString(gson),
        chitOptions = chit_options.toJsonString(gson),
        calendarSnap = calendar_snap,
        weekStartDay = week_start_day,
        workStartHour = work_start_hour,
        workEndHour = work_end_hour,
        workDays = work_days,
        enabledPeriods = enabled_periods,
        customDaysCount = custom_days_count,
        allViewStartHour = all_view_start_hour,
        allViewEndHour = all_view_end_hour,
        dayScrollToHour = day_scroll_to_hour,
        username = username,
        unitSystem = unit_system,
        habitsSuccessWindow = habits_success_window,
        overdueBorderColor = overdue_border_color,
        blockedBorderColor = blocked_border_color,
        hidDeclined = hide_declined,
        defaultShowHabitsOnCalendar = default_show_habits_on_calendar,
        defaultTimezone = default_timezone,
        defaultView = default_view,
        viewOrder = view_order.toJsonString(gson),
        syncVersion = sync_version,
        lastSyncedAt = syncedAt
    )
}
