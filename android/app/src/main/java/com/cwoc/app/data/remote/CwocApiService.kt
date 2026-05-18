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
