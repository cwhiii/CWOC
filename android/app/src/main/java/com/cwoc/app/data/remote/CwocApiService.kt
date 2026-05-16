package com.cwoc.app.data.remote

import com.cwoc.app.data.remote.dto.DeviceTokenRequest
import com.cwoc.app.data.remote.dto.DeviceTokenResponse
import com.cwoc.app.data.remote.dto.SyncResponseDto
import com.cwoc.app.data.remote.dto.SyncPushRequestDto
import com.cwoc.app.data.remote.dto.SyncPushResponseDto
import com.cwoc.app.data.remote.dto.ClientLogRequest
import com.cwoc.app.data.remote.dto.ClientLogResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

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
}
