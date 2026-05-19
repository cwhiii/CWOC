package com.cwoc.app.data.repository

import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.EmailBackfillEstimateResponse
import com.cwoc.app.data.remote.EmailSendResponse
import com.cwoc.app.data.remote.EmailSyncResponse
import com.cwoc.app.data.remote.EmailTestConnectionResponse
import com.cwoc.app.data.remote.dto.ArchiveOriginalRequest
import com.cwoc.app.data.remote.dto.MarkReadRequest
import com.cwoc.app.data.remote.dto.PgpKeyRequest
import com.cwoc.app.data.remote.dto.ScheduleEmailRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementation of [EmailRepository] backed by [CwocApiService].
 *
 * Delegates chit CRUD operations (pin, archive, delete, update) to [ChitRepository].
 * Email-specific operations (sync, send, schedule, etc.) go directly to the API.
 *
 * Validates: Requirements 32.2, 44.3, 45.3, 46.4, 47.3, 49.3, 53.2, 60.2, 65.2, 65.4
 */
@Singleton
class EmailRepositoryImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val chitRepository: ChitRepository
) : EmailRepository {

    override suspend fun syncEmail(backfill: Boolean): Result<EmailSyncResponse> {
        return try {
            val body = mapOf("backfill" to backfill)
            val response = apiService.emailSync(body)
            if (response.isSuccessful) {
                val syncResponse = response.body()
                    ?: return Result.failure(Exception("Empty response from email sync"))
                Result.success(syncResponse)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Email sync failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun sendEmail(chitId: String): Result<EmailSendResponse> {
        return try {
            val response = apiService.sendEmail(chitId)
            if (response.isSuccessful) {
                val sendResponse = response.body()
                    ?: return Result.failure(Exception("Empty response from email send"))
                Result.success(sendResponse)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Email send failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun scheduleEmail(chitId: String, sendAt: String): Result<Unit> {
        return try {
            val request = ScheduleEmailRequest(sendAt = sendAt)
            val response = apiService.scheduleEmail(chitId, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Schedule email failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelSchedule(chitId: String): Result<Unit> {
        return try {
            val request = ScheduleEmailRequest(sendAt = "", cancel = true)
            val response = apiService.scheduleEmail(chitId, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Cancel schedule failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun archiveOriginal(inReplyToMessageId: String): Result<Unit> {
        return try {
            val request = ArchiveOriginalRequest(messageId = inReplyToMessageId)
            val response = apiService.archiveOriginal(request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Archive original failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun markRead(chitId: String, read: Boolean): Result<Unit> {
        return try {
            val request = MarkReadRequest(read = read)
            val response = apiService.markEmailRead(chitId, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Mark read failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun backfillEstimate(): Result<EmailBackfillEstimateResponse> {
        return try {
            val response = apiService.emailBackfillEstimate()
            if (response.isSuccessful) {
                val estimateResponse = response.body()
                    ?: return Result.failure(Exception("Empty response from backfill estimate"))
                Result.success(estimateResponse)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Backfill estimate failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun testConnection(config: Map<String, Any?>): Result<EmailTestConnectionResponse> {
        return try {
            val response = apiService.testEmailConnection(config)
            if (response.isSuccessful) {
                val testResponse = response.body()
                    ?: return Result.failure(Exception("Empty response from test connection"))
                Result.success(testResponse)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Test connection failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPrivatePgpKey(password: String): Result<String> {
        return try {
            val request = PgpKeyRequest(password = password)
            val response = apiService.getPrivatePgpKey(request)
            if (response.isSuccessful) {
                val pgpResponse = response.body()
                    ?: return Result.failure(Exception("Empty response from PGP key retrieval"))
                Result.success(pgpResponse.privateKey)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("PGP key retrieval failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun downloadRawEml(chitId: String): Result<ByteArray> {
        return try {
            val response = apiService.downloadRawEmail(chitId)
            if (response.isSuccessful) {
                val body = response.body()
                    ?: return Result.failure(Exception("Empty response from raw EML download"))
                val bytes = body.bytes()
                Result.success(bytes)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Raw EML download failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun addRuleToBundle(bundleId: String, matchType: String, matchValue: String): Result<Unit> {
        return try {
            val body = mapOf("match_type" to matchType, "match_value" to matchValue)
            val response = apiService.addRuleToBundle(bundleId, body)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Add rule to bundle failed (${response.code()}): $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
