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
        ownerDisplayName = owner_display_name,
        ownerUsername = owner_username,
        hasUnviewedConflict = has_unviewed_conflict ?: false,
        availability = availability,
        snoozedUntil = snoozed_until,
        prerequisites = prerequisites,
        syncVersion = sync_version,
        lastSyncedAt = syncedAt,
        // Email fields
        emailMessageId = email_message_id,
        emailFrom = email_from,
        emailTo = email_to.toJsonString(gson),
        emailCc = email_cc.toJsonString(gson),
        emailBcc = email_bcc.toJsonString(gson),
        emailSubject = email_subject,
        emailBodyText = email_body_text,
        emailDate = email_date,
        emailFolder = email_folder,
        emailStatus = email_status,
        emailRead = email_read,
        emailInReplyTo = email_in_reply_to,
        emailReferences = email_references,
        emailBodyHtml = email_body_html,
        emailAccountId = email_account_id,
        emailSendAt = email_send_at,
        emailRequestReadReceipt = when (email_request_read_receipt) {
            is Boolean -> email_request_read_receipt
            is Number -> email_request_read_receipt.toInt() != 0
            else -> null
        },
        // Attachments
        attachments = attachments.toJsonString(gson),
        // Checklist/thread fields
        checklistAutosave = checklist_autosave?.toString(),
        nestThreadId = nest_thread_id,
        autoCompleteChecklist = auto_complete_checklist
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
        givenName = given_name ?: "",
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
        ownerId = owner_id,
        deleted = when (deleted) {
            is Boolean -> deleted
            is Number -> deleted.toInt() != 0
            else -> false
        },
        deletedDatetime = deleted_datetime,
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
        activeClocks = active_clocks.toJsonString(gson),
        savedLocations = saved_locations.toJsonString(gson),
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
        lastSyncedAt = syncedAt,
        // Audit settings
        auditLogMaxDays = audit_log_max_days,
        auditLogMaxMb = audit_log_max_mb,
        // Notification defaults
        defaultNotifications = default_notifications.toJsonString(gson),
        // Shared/kiosk
        sharedTags = shared_tags.toJsonString(gson),
        kioskUsers = kiosk_users.toJsonString(gson),
        // Map settings
        mapDefaultLat = map_default_lat,
        mapDefaultLon = map_default_lon,
        mapDefaultZoom = map_default_zoom,
        mapAutoZoom = map_auto_zoom,
        // Email settings
        emailAccount = email_account.toJsonString(gson),
        emailAccounts = email_accounts.toJsonString(gson),
        // Attachment limits
        attachmentMaxSizeMb = attachment_max_size_mb,
        attachmentMaxStorageMb = attachment_max_storage_mb,
        // Sharing
        defaultShareContacts = default_share_contacts,
        // Autosave
        checklistAutosave = checklist_autosave,
        autosaveDesktop = autosave_desktop,
        autosaveMobile = autosave_mobile,
        // Tags
        recentTags = recent_tags.toJsonString(gson),
        // Email pagination
        paginateEmail = paginate_email,
        // Bundles
        bundlesMultiPlacement = when (bundles_multi_placement) {
            is Boolean -> bundles_multi_placement
            is Number -> bundles_multi_placement.toInt() != 0
            else -> null
        },
        bundlesEnabled = when (bundles_enabled) {
            is Boolean -> bundles_enabled
            is Number -> bundles_enabled.toInt() != 0
            else -> null
        },
        bundlesShowCount = bundles_show_count,
        // Map thumbnails
        showMapThumbnails = show_map_thumbnails,
        // Session
        sessionLifetime = session_lifetime,
        // Omni view
        omniLayout = omni_layout.toJsonString(gson),
        omniLockedFilters = omni_locked_filters.toJsonString(gson),
        omniHstClockMode = omni_hst_clock_mode,
        omniEmailCount = omni_email_count,
        omniNormalizeColors = omni_normalize_colors,
        // Smart actions
        smartActionsConfig = smart_actions_config.toJsonString(gson),
        // Custom view filters
        customViewFilters = custom_view_filters.toJsonString(gson),
        // Email privacy
        emailBlockTrackingPixels = email_block_tracking_pixels,
        emailExternalContent = email_external_content,
        emailReadReceipts = email_read_receipts,
        emailUndoSendDelay = email_undo_send_delay,
        emailGroupBy = email_group_by,
        // Timezone override
        timezoneOverride = timezone_override
    )
}
