package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.remote.dto.ContactPushDto
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Converts a ContactEntity to a ContactPushDto for the POST /api/sync/push request.
 * Maps camelCase entity fields to snake_case DTO fields.
 * JSON-stored fields (phones, emails, addresses, etc.) are deserialized to Any? for the DTO.
 * Includes dirty_fields so the server knows which fields were locally modified.
 */
fun ContactEntity.toPushDto(): ContactPushDto {
    val gson = Gson()
    return ContactPushDto(
        id = id,
        last_known_sync_version = syncVersion,
        given_name = givenName,
        surname = surname,
        middle_names = middleNames,
        prefix = prefix,
        suffix = suffix,
        nickname = nickname,
        display_name = displayName,
        phones = phones?.let { gson.fromJson(it, Any::class.java) },
        emails = emails?.let { gson.fromJson(it, Any::class.java) },
        addresses = addresses?.let { gson.fromJson(it, Any::class.java) },
        call_signs = callSigns?.let { gson.fromJson(it, Any::class.java) },
        x_handles = xHandles?.let { gson.fromJson(it, Any::class.java) },
        websites = websites?.let { gson.fromJson(it, Any::class.java) },
        dates = dates?.let { gson.fromJson(it, Any::class.java) },
        has_signal = hasSignal,
        signal_username = signalUsername,
        pgp_key = pgpKey,
        favorite = favorite,
        color = color,
        organization = organization,
        social_context = socialContext,
        image_url = imageUrl,
        notes = notes,
        tags = tags,
        shared_to_vault = sharedToVault,
        deleted = deleted,
        created_datetime = createdDatetime,
        modified_datetime = modifiedDatetime,
        dirty_fields = parseDirtyFieldsList(dirtyFields)
    )
}

/**
 * Parses the JSON array string of dirty fields into a List for the push DTO.
 * Returns null for null, blank, or empty array inputs.
 */
private fun parseDirtyFieldsList(json: String?): List<String>? {
    if (json.isNullOrBlank() || json == "[]") return null
    val gson = Gson()
    val type = object : TypeToken<List<String>>() {}.type
    return gson.fromJson(json, type)
}
