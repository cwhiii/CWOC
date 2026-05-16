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
}
