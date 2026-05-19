package com.cwoc.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Response from the server after a successful attachment upload.
 * Matches the JSON returned by POST /api/chits/{chit_id}/attachments.
 */
data class AttachmentUploadResponse(
    val id: String,
    val filename: String,
    val size: Long,
    @SerializedName("mime_type")
    val mimeType: String?
)
