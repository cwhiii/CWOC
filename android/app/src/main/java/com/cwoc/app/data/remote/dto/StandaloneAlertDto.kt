package com.cwoc.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * DTO for standalone alerts (alarms, timers, stopwatches) from /api/standalone-alerts.
 * Uses @SerializedName for snake_case API field mapping.
 */
data class StandaloneAlertDto(
    val id: String,

    @SerializedName("_type")
    val type: String,

    val name: String? = null,

    val data: Map<String, Any?> = emptyMap(),

    @SerializedName("created_datetime")
    val createdDatetime: String? = null,

    @SerializedName("modified_datetime")
    val modifiedDatetime: String? = null
)
