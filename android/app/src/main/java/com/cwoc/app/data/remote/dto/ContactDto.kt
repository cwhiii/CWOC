package com.cwoc.app.data.remote.dto

/**
 * DTO matching the server's contact JSON response shape.
 * Fields use snake_case to match server field names.
 * Complex nested JSON objects (phones, emails, addresses, etc.) use Any?
 * since we store them as raw JSON strings in Room.
 */
data class ContactDto(
    val id: String,
    val given_name: String?,
    val surname: String?,
    val middle_names: String?,
    val prefix: String?,
    val suffix: String?,
    val nickname: String?,
    val display_name: String?,
    val phones: Any?,
    val emails: Any?,
    val addresses: Any?,
    val call_signs: Any?,
    val x_handles: Any?,
    val websites: Any?,
    val dates: Any?,
    val has_signal: Boolean?,
    val signal_username: String?,
    val pgp_key: String?,
    val favorite: Boolean?,
    val color: String?,
    val organization: String?,
    val social_context: String?,
    val image_url: String?,
    val notes: String?,
    val tags: List<String>?,
    val shared_to_vault: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?,
    val sync_version: Int = 0
)
