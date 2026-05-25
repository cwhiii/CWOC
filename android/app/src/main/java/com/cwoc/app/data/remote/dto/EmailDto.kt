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

/**
 * Request body for POST /api/bundles/{bundleId}/drop-email.
 * Unified endpoint for moving an email to a bundle with optional rule creation.
 */
data class DropEmailRequest(
    @SerializedName("chit_id") val chitId: String,
    val mode: String, // "move_once", "always_sender", "always_subject", "always_recipient"
    @SerializedName("match_value") val matchValue: String = "",
    @SerializedName("apply_retroactively") val applyRetroactively: Boolean = false
)

/**
 * Response from POST /api/bundles/{bundleId}/drop-email.
 */
data class DropEmailResponse(
    val success: Boolean = false,
    val mode: String? = null,
    @SerializedName("bundle_id") val bundleId: String? = null,
    @SerializedName("bundle_name") val bundleName: String? = null,
    @SerializedName("rule_id") val ruleId: String? = null,
    @SerializedName("rule_name") val ruleName: String? = null,
    @SerializedName("reclassified_count") val reclassifiedCount: Int = 0
)
