package com.cwoc.app.data.remote.dto

/**
 * Response from the server after a successful attachment upload.
 * Contains the server-assigned URL for the uploaded file.
 */
data class AttachmentUploadResponse(
    val id: String,
    val url: String,
    val filename: String,
    val sizeBytes: Long,
    val mimeType: String?
)
