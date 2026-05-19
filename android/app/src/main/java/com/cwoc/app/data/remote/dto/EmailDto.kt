package com.cwoc.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Request body for POST /api/bundles (create a new bundle).
 */
data class CreateBundleRequest(
    val name: String,
    val description: String? = null,
    val color: String? = null,
    @SerializedName("show_in_omni") val showInOmni: Boolean = false
)

/**
 * Request body for PUT /api/bundles/{id} (update an existing bundle).
 */
data class UpdateBundleRequest(
    val name: String? = null,
    val description: String? = null,
    val color: String? = null,
    @SerializedName("show_in_omni") val showInOmni: Boolean? = null
)

/**
 * Request body for PUT /api/bundles/reorder (reorder bundles by ID list).
 */
data class ReorderBundlesRequest(
    @SerializedName("ordered_ids") val orderedIds: List<String>
)

/**
 * Request body for POST /api/email/schedule/{chitId} (schedule or cancel email send).
 */
data class ScheduleEmailRequest(
    @SerializedName("send_at") val sendAt: String,
    val cancel: Boolean? = null
)

/**
 * Request body for POST /api/email/archive-original (archive the original email after reply).
 */
data class ArchiveOriginalRequest(
    @SerializedName("message_id") val messageId: String
)

/**
 * Request body for POST /api/auth/private-pgp-key (retrieve private PGP key).
 */
data class PgpKeyRequest(
    val password: String
)

/**
 * Response from POST /api/auth/private-pgp-key.
 */
data class PgpKeyResponse(
    @SerializedName("private_key") val privateKey: String
)

/**
 * Request body for PATCH /api/email/{id}/read (mark email as read/unread).
 */
data class MarkReadRequest(
    val read: Boolean
)
