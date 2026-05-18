package com.cwoc.app.data.remote

import com.cwoc.app.data.remote.dto.DeviceTokenRequest
import com.cwoc.app.data.remote.dto.DeviceTokenResponse
import com.cwoc.app.data.remote.dto.SyncResponseDto
import com.cwoc.app.data.remote.dto.SyncPushRequestDto
import com.cwoc.app.data.remote.dto.SyncPushResponseDto
import com.cwoc.app.data.remote.dto.ClientLogRequest
import com.cwoc.app.data.remote.dto.ClientLogResponse
import com.cwoc.app.data.remote.dto.AttachmentUploadResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

/**
 * Retrofit service interface for the CWOC server API.
 * All methods are suspend functions returning Response<T> for explicit error handling.
 */
interface CwocApiService {

    /**
     * Authenticate with the server using device credentials.
     * Returns a device token for subsequent API calls.
     */
    @POST("/api/auth/device-token")
    suspend fun authenticate(
        @Body request: DeviceTokenRequest
    ): Response<DeviceTokenResponse>

    /**
     * Fetch the login message (instance name + welcome message) for the login screen.
     * No auth required — called before authentication.
     */
    @GET("/api/auth/login-message")
    suspend fun getLoginMessage(): Response<LoginMessageResponse>

    /**
     * Fetch sync changes from the server since a given version.
     * Returns chits, contacts, and settings that have changed.
     */
    @GET("/api/sync/changes")
    suspend fun getSyncChanges(
        @Query("since") since: Int,
        @Query("include") include: String = "chits,contacts,settings"
    ): Response<SyncResponseDto>

    /**
     * Push locally-modified (dirty) chits to the server.
     * Returns per-chit results (accepted, created, merged, error) and updated server version.
     */
    @POST("/api/sync/push")
    suspend fun pushChanges(
        @Body request: SyncPushRequestDto
    ): Response<SyncPushResponseDto>

    /**
     * Post a client log entry to the server for remote diagnostics.
     * No auth required — works even before device authentication.
     */
    @POST("/api/client-log")
    suspend fun postClientLog(
        @Body entry: ClientLogRequest
    ): Response<ClientLogResponse>

    /**
     * Dismiss the conflict banner for a chit on the server.
     * Clears the has_unviewed_conflict flag server-side.
     * If this call fails due to network issues, the server will clear
     * the flag on the next successful sync cycle.
     */
    @POST("/api/chit/{id}/dismiss-conflict")
    suspend fun dismissConflict(
        @Path("id") chitId: String
    ): Response<Unit>

    /**
     * Download an attachment file by ID.
     * Uses @Streaming to avoid loading the entire file into memory.
     */
    @Streaming
    @GET("/api/attachment/{id}/download")
    suspend fun downloadAttachment(
        @Path("id") attachmentId: String
    ): Response<ResponseBody>

    /**
     * Upload an attachment file via multipart POST.
     * Returns the server-assigned URL and metadata for the uploaded file.
     */
    @Multipart
    @POST("/api/attachment/upload")
    suspend fun uploadAttachment(
        @Part("chitId") chitId: RequestBody,
        @Part("filename") filename: RequestBody,
        @Part("mimeType") mimeType: RequestBody,
        @Part file: MultipartBody.Part
    ): Response<AttachmentUploadResponse>

    /**
     * Fetch weather forecasts for all saved locations.
     * Returns forecast data (16-day daily) for each configured location.
     */
    @GET("/api/weather/forecasts")
    suspend fun getWeatherForecasts(): Response<com.cwoc.app.ui.screens.weather.WeatherForecastsResponse>

    /**
     * Fetch the help documentation index.
     * Returns the index content and list of available doc filenames.
     */
    @GET("/api/docs")
    suspend fun getDocsIndex(): Response<DocsIndexResponse>

    /**
     * Fetch the content of a specific help documentation topic by slug.
     * The slug is the filename without the .md extension.
     */
    @GET("/api/docs/{slug}")
    suspend fun getDocContent(
        @Path("slug") slug: String
    ): Response<DocContentResponse>

    /**
     * Send an email draft via the server.
     * The server handles SMTP delivery and moves the chit to Sent folder.
     */
    @POST("/api/email/send/{chitId}")
    suspend fun sendEmail(
        @Path("chitId") chitId: String
    ): Response<EmailSendResponse>

    // ─── Contact-specific endpoints ─────────────────────────────────────────

    /**
     * Toggle a contact's favorite status.
     */
    @retrofit2.http.PATCH("/api/contacts/{id}/favorite")
    suspend fun toggleContactFavorite(
        @Path("id") contactId: String
    ): Response<Map<String, Any>>

    /**
     * Upload a profile image for a contact.
     */
    @Multipart
    @POST("/api/contacts/{id}/image")
    suspend fun uploadContactImage(
        @Path("id") contactId: String,
        @Part file: MultipartBody.Part
    ): Response<Map<String, String>>

    /**
     * Remove a contact's profile image.
     */
    @retrofit2.http.DELETE("/api/contacts/{id}/image")
    suspend fun deleteContactImage(
        @Path("id") contactId: String
    ): Response<Unit>

    /**
     * Import contacts from a .vcf or .csv file.
     */
    @Multipart
    @POST("/api/contacts/import")
    suspend fun importContacts(
        @Part file: MultipartBody.Part
    ): Response<ImportResultDto>

    /**
     * Export all contacts as .vcf or .csv file.
     */
    @Streaming
    @GET("/api/contacts/export")
    suspend fun exportContacts(
        @Query("format") format: String
    ): Response<ResponseBody>

    /**
     * Export a single contact as .vcf file.
     */
    @Streaming
    @GET("/api/contacts/{id}/export")
    suspend fun exportSingleContact(
        @Path("id") contactId: String,
        @Query("format") format: String
    ): Response<ResponseBody>

    /**
     * Get list of soft-deleted contacts (trash).
     */
    @GET("/api/trash/contacts")
    suspend fun getTrashContacts(): Response<List<Map<String, Any?>>>

    /**
     * Restore a soft-deleted contact from trash.
     */
    @POST("/api/trash/contacts/{id}/restore")
    suspend fun restoreContact(
        @Path("id") contactId: String
    ): Response<Unit>

    /**
     * Permanently delete a contact from trash.
     */
    @retrofit2.http.DELETE("/api/trash/contacts/{id}/purge")
    suspend fun purgeContact(
        @Path("id") contactId: String
    ): Response<Unit>

    /**
     * Get list of switchable users (for People page Users section).
     */
    @GET("/api/auth/switchable-users")
    suspend fun getSwitchableUsers(): Response<List<SwitchableUserDto>>

    /**
     * Get virtual calendar entries for contact birthdays/anniversaries.
     */
    @GET("/api/contacts/birthdays")
    suspend fun getContactBirthdays(): Response<List<Map<String, Any?>>>

    // ─── Settings endpoints ─────────────────────────────────────────────────

    /**
     * Load all settings for a user.
     */
    @GET("/api/settings/{user_id}")
    suspend fun getSettings(
        @Path("user_id") userId: String
    ): Response<Map<String, Any?>>

    /**
     * Save settings (partial update). Only fields present in the body are updated.
     */
    @POST("/api/settings")
    suspend fun saveSettings(
        @Body settings: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any?>>

    // ─── Email test connection ──────────────────────────────────────────────

    /**
     * Test email IMAP/SMTP connectivity with current credentials.
     */
    @POST("/api/email/test-connection")
    suspend fun testEmailConnection(
        @Body config: Map<String, @JvmSuppressWildcards Any?>
    ): Response<EmailTestConnectionResponse>

    // ─── Email backfill ─────────────────────────────────────────────────────

    /**
     * Estimate mailbox size for backfill (message count and storage).
     */
    @POST("/api/email/backfill-estimate")
    suspend fun emailBackfillEstimate(): Response<EmailBackfillEstimateResponse>

    /**
     * Trigger email sync (with optional backfill flag to pull all messages).
     */
    @POST("/api/email/sync")
    suspend fun emailSync(
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Response<EmailSyncResponse>

    // ─── Ntfy endpoints ─────────────────────────────────────────────────────

    /**
     * Get ntfy service status (reachability check).
     */
    @GET("/api/network-access/ntfy/status")
    suspend fun getNtfyStatus(): Response<NtfyStatusResponse>

    /**
     * Send a test notification to the user's ntfy topic.
     */
    @POST("/api/network-access/ntfy/test")
    suspend fun testNtfy(): Response<NtfyTestResponse>

    /**
     * Enable the ntfy provider.
     */
    @POST("/api/network-access/ntfy/enable")
    suspend fun enableNtfy(): Response<NtfyToggleResponse>

    /**
     * Disable the ntfy provider.
     */
    @POST("/api/network-access/ntfy/disable")
    suspend fun disableNtfy(): Response<NtfyToggleResponse>

    // ─── Tailscale endpoints ────────────────────────────────────────────────

    /**
     * Get Tailscale service status (installation and connection state).
     */
    @GET("/api/network-access/tailscale/status")
    suspend fun getTailscaleStatus(): Response<TailscaleStatusResponse>

    /**
     * Connect (bring up) Tailscale with the saved auth key.
     */
    @POST("/api/network-access/tailscale/up")
    suspend fun connectTailscale(): Response<TailscaleConnectResponse>

    /**
     * Disconnect (bring down) Tailscale.
     */
    @POST("/api/network-access/tailscale/down")
    suspend fun disconnectTailscale(): Response<TailscaleDisconnectResponse>

    /**
     * Save Tailscale config (auth key, enabled state).
     */
    @POST("/api/network-access/tailscale")
    suspend fun saveTailscaleConfig(
        @Body config: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any?>>

    // ─── Home Assistant endpoints ───────────────────────────────────────────

    /**
     * Save Home Assistant config (URL, token, poll interval).
     */
    @POST("/api/ha/config")
    suspend fun saveHaConfig(
        @Body config: HaConfigRequest
    ): Response<HaConfigSaveResponse>

    /**
     * Get Home Assistant config (with masked token).
     */
    @GET("/api/ha/config")
    suspend fun getHaConfig(): Response<HaConfigResponse>

    /**
     * Test Home Assistant connection.
     */
    @POST("/api/ha/config/test")
    suspend fun testHaConnection(): Response<HaTestResponse>

    /**
     * Regenerate the HA webhook secret.
     */
    @POST("/api/ha/config/regenerate-webhook")
    suspend fun regenerateHaWebhook(): Response<HaWebhookRegenerateResponse>

    // ─── Disk usage & version ───────────────────────────────────────────────

    /**
     * Get disk usage stats (total, used, free, percent, cwoc data size).
     */
    @GET("/api/disk-usage")
    suspend fun getDiskUsage(): Response<DiskUsageResponse>

    /**
     * Get server version info.
     */
    @GET("/api/version")
    suspend fun getVersion(): Response<VersionResponse>

    // ─── Update / upgrade ───────────────────────────────────────────────────

    /**
     * Stream upgrade logs via SSE. Use @Streaming to avoid buffering the
     * entire response in memory. The caller should read the ResponseBody
     * as a stream and parse SSE events (or use OkHttp EventSource).
     */
    @Streaming
    @GET("/api/update/run")
    suspend fun streamUpgrade(): Response<ResponseBody>

    /**
     * Get the last upgrade log text.
     */
    @GET("/api/update/log")
    suspend fun getUpdateLog(): Response<UpdateLogResponse>

    // ─── Restart ────────────────────────────────────────────────────────────

    /**
     * Restart the CWOC service. Admin only.
     */
    @POST("/api/restart")
    suspend fun restartService(): Response<RestartResponse>

    // ─── Release notes ──────────────────────────────────────────────────────

    /**
     * Get all daily release notes, newest first.
     */
    @GET("/api/release-notes")
    suspend fun getReleaseNotes(): Response<ReleaseNotesResponse>

    // ─── Export endpoints ───────────────────────────────────────────────────

    /**
     * Export chit data as JSON.
     */
    @Streaming
    @GET("/api/export/chits")
    suspend fun exportChits(): Response<ResponseBody>

    /**
     * Export user data (settings + contacts) as JSON.
     */
    @Streaming
    @GET("/api/export/userdata")
    suspend fun exportUsers(): Response<ResponseBody>

    /**
     * Export all data (chits + settings + contacts) as JSON.
     */
    @Streaming
    @GET("/api/export/all")
    suspend fun exportAll(): Response<ResponseBody>

    // ─── Import endpoint ────────────────────────────────────────────────────

    /**
     * Import data from a JSON export envelope.
     * The body contains the export JSON with a "type" field indicating chits/userdata/all.
     */
    @POST("/api/import/all")
    suspend fun importAll(
        @Body data: Map<String, @JvmSuppressWildcards Any?>
    ): Response<ImportDataResponse>

    /**
     * Import chit data from a JSON export envelope.
     */
    @POST("/api/import/chits")
    suspend fun importChits(
        @Body data: Map<String, @JvmSuppressWildcards Any?>
    ): Response<ImportDataResponse>

    /**
     * Import user data (settings + contacts) from a JSON export envelope.
     */
    @POST("/api/import/userdata")
    suspend fun importUserdata(
        @Body data: Map<String, @JvmSuppressWildcards Any?>
    ): Response<ImportDataResponse>

    // ─── Bundles endpoints ──────────────────────────────────────────────────

    /**
     * List all email bundles for the authenticated user.
     */
    @GET("/api/bundles")
    suspend fun getBundles(): Response<List<BundleDto>>

    /**
     * Disable an auto-bundle (set display_order to -1, strip tags from emails).
     */
    @POST("/api/bundles/{bundle_id}/disable")
    suspend fun disableBundle(
        @Path("bundle_id") bundleId: String
    ): Response<BundleToggleResponse>

    /**
     * Enable a previously disabled bundle (restore display_order).
     */
    @POST("/api/bundles/{bundle_id}/enable")
    suspend fun enableBundle(
        @Path("bundle_id") bundleId: String
    ): Response<BundleToggleResponse>

    /**
     * Reset all sort orders and manual item ordering for every view.
     * Clears all saved sort preferences.
     */
    @POST("/api/settings/reset-sort-orders")
    suspend fun resetSortOrders(): Response<ResetSortOrdersResponse>
}

/**
 * Response from GET /api/docs — the documentation index.
 */
data class DocsIndexResponse(
    val index: String,
    val files: List<String>,
    val error: String? = null
)

/**
 * Response from GET /api/docs/{slug} — a single documentation topic.
 */
data class DocContentResponse(
    val filename: String,
    val content: String
)

/**
 * Response from GET /api/auth/login-message — instance name and welcome message.
 */
data class LoginMessageResponse(
    val instance_name: String?,
    val message: String?
)

/**
 * Response from POST /api/email/send/{chitId} — email send result.
 */
data class EmailSendResponse(
    val status: String? = null,
    val message: String? = null
)

/**
 * Response from POST /api/contacts/import — import result summary.
 */
data class ImportResultDto(
    val imported: Int = 0,
    val skipped: Int = 0,
    val errors: List<ImportErrorDto> = emptyList()
)

/**
 * Individual error entry from a contact import operation.
 */
data class ImportErrorDto(
    val entry: Int? = null,
    val reason: String? = null
)

/**
 * A switchable user from GET /api/auth/switchable-users.
 */
data class SwitchableUserDto(
    val id: String,
    val username: String,
    @com.google.gson.annotations.SerializedName("display_name") val displayName: String?,
    val email: String?,
    @com.google.gson.annotations.SerializedName("profile_image_url") val profileImageUrl: String?
)

// ─── Settings-parity response DTOs ──────────────────────────────────────────

/**
 * Response from POST /api/email/test-connection.
 */
data class EmailTestConnectionResponse(
    val imap: EmailTestResult? = null,
    val smtp: EmailTestResult? = null,
    val success: Boolean? = null,
    val message: String? = null
)

data class EmailTestResult(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Response from POST /api/email/backfill-estimate.
 */
data class EmailBackfillEstimateResponse(
    @com.google.gson.annotations.SerializedName("message_count") val messageCount: Int? = null,
    @com.google.gson.annotations.SerializedName("estimated_mb") val estimatedMb: Double? = null,
    val error: String? = null,
    val detail: String? = null
)

/**
 * Response from POST /api/email/sync.
 */
data class EmailSyncResponse(
    @com.google.gson.annotations.SerializedName("new_count") val newCount: Int? = null,
    @com.google.gson.annotations.SerializedName("deleted_count") val deletedCount: Int? = null,
    val error: String? = null,
    val detail: String? = null
)

/**
 * Response from GET /api/network-access/ntfy/status.
 */
data class NtfyStatusResponse(
    val status: String? = null,
    val message: String? = null,
    @com.google.gson.annotations.SerializedName("server_url") val serverUrl: String? = null,
    val topic: String? = null
)

/**
 * Response from POST /api/network-access/ntfy/test.
 */
data class NtfyTestResponse(
    val success: Boolean = false,
    val message: String? = null,
    val topic: String? = null
)

/**
 * Response from POST /api/network-access/ntfy/enable or /disable.
 */
data class NtfyToggleResponse(
    val success: Boolean = false,
    val message: String? = null,
    val status: String? = null
)

/**
 * Response from GET /api/network-access/tailscale/status.
 */
data class TailscaleStatusResponse(
    val status: String? = null,
    val message: String? = null,
    val ip: String? = null,
    val hostname: String? = null
)

/**
 * Response from POST /api/network-access/tailscale/up.
 */
data class TailscaleConnectResponse(
    val success: Boolean = false,
    val message: String? = null,
    val ip: String? = null,
    val hostname: String? = null
)

/**
 * Response from POST /api/network-access/tailscale/down.
 */
data class TailscaleDisconnectResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Request body for POST /api/ha/config.
 */
data class HaConfigRequest(
    @com.google.gson.annotations.SerializedName("ha_base_url") val haBaseUrl: String? = null,
    @com.google.gson.annotations.SerializedName("ha_access_token") val haAccessToken: String? = null,
    @com.google.gson.annotations.SerializedName("ha_poll_interval") val haPollInterval: Int? = null
)

/**
 * Response from POST /api/ha/config.
 */
data class HaConfigSaveResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Response from GET /api/ha/config.
 */
data class HaConfigResponse(
    @com.google.gson.annotations.SerializedName("ha_base_url") val haBaseUrl: String? = null,
    @com.google.gson.annotations.SerializedName("ha_access_token_masked") val haAccessTokenMasked: String? = null,
    @com.google.gson.annotations.SerializedName("ha_webhook_secret") val haWebhookSecret: String? = null,
    @com.google.gson.annotations.SerializedName("ha_poll_interval") val haPollInterval: Int? = null,
    @com.google.gson.annotations.SerializedName("configured_by") val configuredBy: String? = null,
    @com.google.gson.annotations.SerializedName("modified_datetime") val modifiedDatetime: String? = null
)

/**
 * Response from POST /api/ha/config/test.
 */
data class HaTestResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Response from POST /api/ha/config/regenerate-webhook.
 */
data class HaWebhookRegenerateResponse(
    val success: Boolean = false,
    @com.google.gson.annotations.SerializedName("webhook_secret") val webhookSecret: String? = null,
    val message: String? = null
)

/**
 * Response from GET /api/disk-usage.
 */
data class DiskUsageResponse(
    val total: Long? = null,
    val used: Long? = null,
    val free: Long? = null,
    val percent: Double? = null,
    @com.google.gson.annotations.SerializedName("cwoc_data_bytes") val cwocDataBytes: Long? = null,
    @com.google.gson.annotations.SerializedName("cwoc_data_percent") val cwocDataPercent: Double? = null
)

/**
 * Response from GET /api/version.
 */
data class VersionResponse(
    val version: String? = null,
    @com.google.gson.annotations.SerializedName("installed_datetime") val installedDatetime: String? = null
)

/**
 * Response from GET /api/update/log.
 */
data class UpdateLogResponse(
    val log: String? = null,
    val error: String? = null
)

/**
 * Response from POST /api/restart.
 */
data class RestartResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Response from GET /api/release-notes.
 */
data class ReleaseNotesResponse(
    val notes: List<ReleaseNoteDay> = emptyList()
)

data class ReleaseNoteDay(
    val date: String,
    val content: String
)

/**
 * Response from POST /api/import/chits, /api/import/userdata, or /api/import/all.
 */
data class ImportDataResponse(
    val success: Boolean = false,
    val message: String? = null,
    val imported: Int? = null,
    val skipped: Int? = null,
    val errors: List<String>? = null
)

/**
 * A bundle from GET /api/bundles.
 */
data class BundleDto(
    val id: String,
    val name: String? = null,
    @com.google.gson.annotations.SerializedName("owner_id") val ownerId: String? = null,
    @com.google.gson.annotations.SerializedName("display_order") val displayOrder: Int? = null,
    val removable: Boolean? = null,
    val tag: String? = null,
    val icon: String? = null,
    val color: String? = null,
    @com.google.gson.annotations.SerializedName("unread_count") val unreadCount: Int? = null,
    @com.google.gson.annotations.SerializedName("total_count") val totalCount: Int? = null
)

/**
 * Response from POST /api/bundles/{id}/disable or /enable.
 */
data class BundleToggleResponse(
    val success: Boolean = false,
    val message: String? = null
)

/**
 * Response from POST /api/settings/reset-sort-orders.
 */
data class ResetSortOrdersResponse(
    val success: Boolean = false,
    val message: String? = null
)
